// theme.js - Complete shared theme management for all pages

(function() {
    // ===== CONFIG =====
    const STORAGE_KEY = 'shoruto-theme';  // Consistent key name
    const DEFAULT_THEME = 'light';

    // ===== GET STORED THEME =====
    function getStoredTheme() {
        // Check both old and new keys for backward compatibility
        const oldTheme = localStorage.getItem('theme');
        const newTheme = localStorage.getItem(STORAGE_KEY);
        if (oldTheme && !newTheme) {
            // Migrate old theme to new key
            localStorage.setItem(STORAGE_KEY, oldTheme);
            localStorage.removeItem('theme');
            return oldTheme;
        }
        return newTheme || DEFAULT_THEME;
    }

    // ===== APPLY THEME TO HTML =====
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        updatePandaColors(theme);
        updateParticleColors(theme);
    }

    // ===== UPDATE PANDA LOGO COLORS =====
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

    // ===== UPDATE PARTICLE COLORS (for homepage) =====
    function updateParticleColors(theme) {
        const canvas = document.getElementById('particleCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        // Trigger particle redraw if available
        if (window._particleTick) {
            window._particleTick(theme);
        }
        if (window.redrawParticles) {
            window.redrawParticles(theme);
        }
    }

    // ===== TOGGLE THEME =====
    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || DEFAULT_THEME;
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        localStorage.setItem(STORAGE_KEY, newTheme);
        applyTheme(newTheme);
        return newTheme;
    }

    // ===== EXPOSE TO GLOBAL SCOPE =====
    window.toggleTheme = toggleTheme;
    window.getStoredTheme = getStoredTheme;
    window.applyTheme = applyTheme;
    window.updateParticleColors = updateParticleColors;

    // ===== INITIALIZE =====
    const initialTheme = getStoredTheme();
    applyTheme(initialTheme);

    // ===== LISTEN FOR CHANGES FROM OTHER TABS =====
    window.addEventListener('storage', function(e) {
        if (e.key === STORAGE_KEY) {
            const newTheme = e.newValue || DEFAULT_THEME;
            applyTheme(newTheme);
        }
    });

    // ===== APPLY ON DOM READY =====
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            applyTheme(getStoredTheme());
        });
    }

    console.log('🎨 Theme system initialized. Current theme:', getStoredTheme());
})();
