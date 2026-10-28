/**
 * theme.js - Controlador Universal de Modo Oscuro Completo + Demostración Móvil/PC (Melidan)
 * Persiste preferencias en localStorage (melidan_theme) y sincroniza data-theme + data-bs-theme.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'melidan_theme';
  const VIEWPORT_KEY = 'melidan_viewport_demo';

  function getPreferredTheme() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch (_) {}
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function getSavedViewport() {
    try {
      return sessionStorage.getItem(VIEWPORT_KEY) === 'mobile' ? 'mobile' : 'desktop';
    } catch (_) {
      return 'desktop';
    }
  }

  function applyTheme(theme) {
    const cleanTheme = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', cleanTheme);
    document.documentElement.setAttribute('data-bs-theme', cleanTheme);
    try {
      localStorage.setItem(STORAGE_KEY, cleanTheme);
    } catch (_) {}

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', cleanTheme === 'dark' ? '#0F172A' : '#FF5722');
    }

    document.querySelectorAll('.theme-toggle-btn').forEach((btn) => {
      if (cleanTheme === 'dark') {
        btn.innerHTML = '<i class="bi bi-sun-fill text-warning"></i><span class="d-none d-sm-inline ms-1 small">Claro</span>';
        btn.setAttribute('title', 'Cambiar a Modo Claro');
        btn.setAttribute('aria-label', 'Cambiar a Modo Claro');
      } else {
        btn.innerHTML = '<i class="bi bi-moon-stars-fill"></i><span class="d-none d-sm-inline ms-1 small">Oscuro</span>';
        btn.setAttribute('title', 'Cambiar a Modo Oscuro');
        btn.setAttribute('aria-label', 'Cambiar a Modo Oscuro');
      }
    });
  }

  function applyViewport(mode) {
    const cleanMode = mode === 'mobile' ? 'mobile' : 'desktop';
    document.documentElement.setAttribute('data-viewport', cleanMode);
    try {
      sessionStorage.setItem(VIEWPORT_KEY, cleanMode);
    } catch (_) {}

    document.querySelectorAll('.viewport-toggle-btn').forEach((btn) => {
      const isMobile = cleanMode === 'mobile';
      btn.classList.toggle('is-mobile-active', isMobile);
      if (isMobile) {
        btn.innerHTML = '<i class="bi bi-laptop"></i><span class="d-none d-md-inline ms-1 small">Vista PC</span>';
        btn.setAttribute('title', 'Volver a Vista Web de Escritorio');
        btn.setAttribute('aria-label', 'Volver a Vista Web de Escritorio');
      } else {
        btn.innerHTML = '<i class="bi bi-phone"></i><span class="d-none d-md-inline ms-1 small">Móvil</span>';
        btn.setAttribute('title', 'Demostración Responsive Móvil');
        btn.setAttribute('aria-label', 'Demostración Responsive Móvil');
      }
    });
  }

  window.toggleDarkMode = function () {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  };

  window.toggleViewportDemo = function () {
    const current = document.documentElement.getAttribute('data-viewport') || 'desktop';
    applyViewport(current === 'mobile' ? 'desktop' : 'mobile');
  };

  // Aplicar inmediatamente antes del renderizado del body para evitar parpadeos (FOUC)
  applyTheme(getPreferredTheme());
  applyViewport(getSavedViewport());

  document.addEventListener('DOMContentLoaded', () => {
    // Asegurar que exista el botón de demostración móvil junto al selector de tema
    document.querySelectorAll('.theme-toggle-btn').forEach((themeBtn) => {
      const parent = themeBtn.parentElement;
      if (parent && !parent.querySelector('.viewport-toggle-btn')) {
        const vpBtn = document.createElement('button');
        vpBtn.type = 'button';
        vpBtn.className = 'viewport-toggle-btn';
        parent.insertBefore(vpBtn, themeBtn);
      }
      themeBtn.removeEventListener('click', window.toggleDarkMode);
      themeBtn.addEventListener('click', window.toggleDarkMode);
    });

    document.querySelectorAll('.viewport-toggle-btn').forEach((vpBtn) => {
      vpBtn.removeEventListener('click', window.toggleViewportDemo);
      vpBtn.addEventListener('click', window.toggleViewportDemo);
    });

    applyTheme(getPreferredTheme());
    applyViewport(getSavedViewport());
  });
})();

