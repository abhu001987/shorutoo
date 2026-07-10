// This is the Edge Chat Demo Worker, built using Durable Objects!
//
// ---------------------------------------------------------------------
// CHANGED: this Worker used to also serve chat.html at "/" (bundled in
// at build time via the wrangler.toml `[[rules]] type = "Data"` block).
// Static files (chat.html, theme.css, theme.js, index.html, etc.) are
// now served by GitHub Pages instead, so this Worker's only job is the
// WebSocket + Durable Object backend under /api/*. Any other path
// returns a small JSON message rather than a raw 404, to make it
// obvious in devtools that you've hit the API Worker, not the site.
// ---------------------------------------------------------------------

// `handleErrors()` is a little utility function that can wrap an HTTP request handler in a
// try/catch and return errors to the client. You probably wouldn't want to use this in production
// code but it is convenient when debugging and iterating.
async function handleErrors(request, func) {
  try {
    return await func();
  } catch (err) {
    if (request.headers.get("Upgrade") == "websocket") {
      // Annoyingly, if we return an HTTP error in response to a WebSocket request, Chrome devtools
      // won't show us the response body! So... let's send a WebSocket response with an error
      // frame instead.
      let pair = new WebSocketPair();
      pair[1].accept();
      pair[1].send(JSON.stringify({error: err.stack}));
      pair[1].close(1011, "Uncaught exception during session setup");
      return new Response(null, { status: 101, webSocket: pair[0] });
    } else {
      return new Response(err.stack, {status: 500});
    }
  }
}

export default {
  async fetch(request, env) {
    return await handleErrors(request, async () => {
      let url = new URL(request.url);
      let path = url.pathname.slice(1).split('/');

      if (!path[0]) {
        // Root path is no longer served here — GitHub Pages serves
        // index.html/chat.html/etc. This Worker is the API only.
        return new Response(
          JSON.stringify({ ok: true, message: "Shoruto chat API worker. Static site is served separately via GitHub Pages." }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      switch (path[0]) {
        case "api":
          // This is a request for `/api/...`, call the API handler.
          return handleApiRequest(path.slice(1), request, env);

        default:
          return new Response("Not found", {status: 404});
      }
    });
  }
}


async function handleApiRequest(path, request, env) {
  // We've received at API request. Route the request based on the path.

  switch (path[0]) {
    case "room": {
      // Request for `/api/room/...`.

      if (!path[1]) {
        // The request is for just "/api/room", with no ID.
        if (request.method == "POST") {
          // POST to /api/room creates a private room.
          let id = env.rooms.newUniqueId();
          return new Response(id.toString(), {headers: {"Access-Control-Allow-Origin": "*"}});
        } else {
          return new Response("Method not allowed", {status: 405});
        }
      }

      // OK, the request is for `/api/room/<name>/...`. It's time to route to the Durable Object
      // for the specific room.
      let name = path[1];

      let id;
      if (name.match(/^[0-9a-f]{64}$/)) {
        // The name is 64 hex digits, so let's assume it actually just encodes an ID.
        id = env.rooms.idFromString(name);
      } else if (name.length <= 32) {
        // Treat as a string room name (limited to 32 characters).
        id = env.rooms.idFromName(name);
      } else {
        return new Response("Name too long", {status: 404});
      }

      let roomObject = env.rooms.get(id);

      // Compute a new URL with `/api/room/<name>` removed. We'll forward the rest of the path
      // to the Durable Object.
      let newUrl = new URL(request.url);
      newUrl.pathname = "/" + path.slice(2).join("/");

      return roomObject.fetch(newUrl, request);
    }

    default:
      return new Response("Not found", {status: 404});
  }
}

// =======================================================================================
// The ChatRoom Durable Object Class

export class ChatRoom {
  constructor(state, env) {
    this.state = state
    this.storage = state.storage;
    this.env = env;

    this.sessions = new Map();
    this.state.getWebSockets().forEach((webSocket) => {
      let meta = webSocket.deserializeAttachment();

      let limiterId = this.env.limiters.idFromString(meta.limiterId);
      let limiter = new RateLimiterClient(
        () => this.env.limiters.get(limiterId),
        err => webSocket.close(1011, err.stack));

      let blockedMessages = [];
      this.sessions.set(webSocket, { ...meta, limiter, blockedMessages });
    });

    this.lastTimestamp = 0;
  }

  async fetch(request) {
    return await handleErrors(request, async () => {
      let url = new URL(request.url);

      switch (url.pathname) {
        case "/websocket": {
          if (request.headers.get("Upgrade") != "websocket") {
            return new Response("expected websocket", {status: 400});
          }

          let ip = request.headers.get("CF-Connecting-IP");

          let pair = new WebSocketPair();

          await this.handleSession(pair[1], ip);

          return new Response(null, { status: 101, webSocket: pair[0] });
        }

        default:
          return new Response("Not found", {status: 404});
      }
    });
  }

  async handleSession(webSocket, ip) {
    this.state.acceptWebSocket(webSocket);

    let limiterId = this.env.limiters.idFromName(ip);
    let limiter = new RateLimiterClient(
        () => this.env.limiters.get(limiterId),
        err => webSocket.close(1011, err.stack));

    let session = { limiterId, limiter, blockedMessages: [] };
    webSocket.serializeAttachment({ ...webSocket.deserializeAttachment(), limiterId: limiterId.toString() });
    this.sessions.set(webSocket, session);

    for (let otherSession of this.sessions.values()) {
      if (otherSession.name) {
        session.blockedMessages.push(JSON.stringify({joined: otherSession.name}));
      }
    }

    let storage = await this.storage.list({reverse: true, limit: 100});
    let backlog = [...storage.values()];
    backlog.reverse();
    backlog.forEach(value => {
      session.blockedMessages.push(value);
    });
  }

  async webSocketMessage(webSocket, msg) {
    try {
      let session = this.sessions.get(webSocket);
      if (session.quit) {
        webSocket.close(1011, "WebSocket broken.");
        return;
      }

      if (!session.limiter.checkLimit()) {
        webSocket.send(JSON.stringify({
          error: "Your IP is being rate-limited, please try again later."
        }));
        return;
      }

      let data = JSON.parse(msg);

      if (!session.name) {
        session.name = "" + (data.name || "anonymous");
        webSocket.serializeAttachment({ ...webSocket.deserializeAttachment(), name: session.name });

        if (session.name.length > 32) {
          webSocket.send(JSON.stringify({error: "Name too long."}));
          webSocket.close(1009, "Name too long.");
          return;
        }

        session.blockedMessages.forEach(queued => {
          webSocket.send(queued);
        });
        delete session.blockedMessages;

        this.broadcast({joined: session.name});

        webSocket.send(JSON.stringify({ready: true}));
        return;
      }

      data = { name: session.name, message: "" + data.message };

      if (data.message.length > 256) {
        webSocket.send(JSON.stringify({error: "Message too long."}));
        return;
      }

      data.timestamp = Math.max(Date.now(), this.lastTimestamp + 1);
      this.lastTimestamp = data.timestamp;

      let dataStr = JSON.stringify(data);
      this.broadcast(dataStr);

      let key = new Date(data.timestamp).toISOString();
      await this.storage.put(key, dataStr);
    } catch (err) {
      webSocket.send(JSON.stringify({error: err.stack}));
    }
  }

  async closeOrErrorHandler(webSocket) {
    let session = this.sessions.get(webSocket) || {};
    session.quit = true;
    this.sessions.delete(webSocket);
    if (session.name) {
      this.broadcast({quit: session.name});
    }
  }

  async webSocketClose(webSocket, code, reason, wasClean) {
    this.closeOrErrorHandler(webSocket)
  }

  async webSocketError(webSocket, error) {
    this.closeOrErrorHandler(webSocket)
  }

  broadcast(message) {
    if (typeof message !== "string") {
      message = JSON.stringify(message);
    }

    let quitters = [];
    this.sessions.forEach((session, webSocket) => {
      if (session.name) {
        try {
          webSocket.send(message);
        } catch (err) {
          session.quit = true;
          quitters.push(session);
          this.sessions.delete(webSocket);
        }
      } else {
        session.blockedMessages.push(message);
      }
    });

    quitters.forEach(quitter => {
      if (quitter.name) {
        this.broadcast({quit: quitter.name});
      }
    });
  }
}

// =======================================================================================
// The RateLimiter Durable Object class.

export class RateLimiter {
  constructor(state, env) {
    this.nextAllowedTime = 0;
  }

  async fetch(request) {
    return await handleErrors(request, async () => {
      let now = Date.now() / 1000;

      this.nextAllowedTime = Math.max(now, this.nextAllowedTime);

      if (request.method == "POST") {
        this.nextAllowedTime += 5;
      }

      let cooldown = Math.max(0, this.nextAllowedTime - now - 20);
      return new Response(cooldown);
    })
  }
}

class RateLimiterClient {
  constructor(getLimiterStub, reportError) {
    this.getLimiterStub = getLimiterStub;
    this.reportError = reportError;
    this.limiter = getLimiterStub();
    this.inCooldown = false;
  }

  checkLimit() {
    if (this.inCooldown) {
      return false;
    }
    this.inCooldown = true;
    this.callLimiter();
    return true;
  }

  async callLimiter() {
    try {
      let response;
      try {
        response = await this.limiter.fetch("https://dummy-url", {method: "POST"});
      } catch (err) {
        this.limiter = this.getLimiterStub();
        response = await this.limiter.fetch("https://dummy-url", {method: "POST"});
      }

      let cooldown = +(await response.text());
      await new Promise(resolve => setTimeout(resolve, cooldown * 1000));

      this.inCooldown = false;
    } catch (err) {
      this.reportError(err);
    }
  }
}
