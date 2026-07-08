// theme.js - Shared theme management for all pages

// Load and apply saved theme
function loadTheme() {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
  
  // Update particle colors if they exist
  setTimeout(() => updateParticleColors(theme), 300);
}

// Toggle between dark and light themes
function toggleTheme() {
  const html = document.documentElement;
  const currentTheme = html.getAttribute('data-theme');
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  html.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  
  // Update particle colors
  updateParticleColors(newTheme);
}

// Update particle canvas colors (for your homepage)
function updateParticleColors(theme) {
  const canvas = document.getElementById('particleCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  // The particles will be redrawn with new colors automatically
  // Just trigger a redraw if your particle system supports it
  if (window._particleTick) {
    // If you have a custom particle system, you can trigger redraw
  }
}

// Listen for theme changes from other tabs/windows
window.addEventListener('storage', function(e) {
  if (e.key === 'theme') {
    const newTheme = e.newValue;
    if (newTheme) {
      document.documentElement.setAttribute('data-theme', newTheme);
      updateParticleColors(newTheme);
    }
  }
});

// Load theme immediately when script runs
loadTheme();

// Also load when DOM is fully ready
document.addEventListener('DOMContentLoaded', loadTheme);

// theme.js - Shared theme toggle
(function() {
    // Get stored theme or default to light
    const storedTheme = localStorage.getItem('shoruto-theme') || 'light';
    document.documentElement.setAttribute('data-theme', storedTheme);
    
    // Update panda logo colors based on theme
    function updatePandaColors(theme) {
        const pandaLogo = document.getElementById('pandaLogo');
        if (!pandaLogo) return;
        const svg = pandaLogo.querySelector('svg');
        if (!svg) return;
        const color = theme === 'dark' ? '#DCEEFF' : '#0b1a33';
        svg.querySelectorAll('circle, path').forEach(el => {
            if (el.getAttribute('stroke')) {
                el.setAttribute('stroke', color);
            }
            if (el.getAttribute('fill') && el.getAttribute('fill') !== 'none') {
                el.setAttribute('fill', color);
            }
        });
    }
    
    // Apply theme on load
    updatePandaColors(storedTheme);
    
    // Listen for theme changes from other pages (optional)
    window.addEventListener('storage', function(e) {
        if (e.key === 'shoruto-theme') {
            const newTheme = e.newValue || 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            updatePandaColors(newTheme);
        }
    });
})();
