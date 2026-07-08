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