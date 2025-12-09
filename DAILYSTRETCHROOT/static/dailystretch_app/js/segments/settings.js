function initSettingsDarkMode(container) {
  const darkModeToggle = (container || document).querySelector('#dark-mode-toggle');
  const label = (container || document).querySelector('#theme-label');
  if (!darkModeToggle || !label) return;

  darkModeToggle.checked = localStorage.getItem('dark_mode_enabled') === 'true';
  label.textContent = darkModeToggle.checked ? 'Light Mode' : 'Dark Mode';

  darkModeToggle.onchange = () => {
    if (darkModeToggle.checked) {
      localStorage.setItem('dark_mode_enabled', 'true');
      label.textContent = 'Light Mode';
    } else {
      localStorage.setItem('dark_mode_enabled', 'false');
      label.textContent = 'Dark Mode';
    }
    if (typeof applyDarkModeIfEnabled === 'function') {
      applyDarkModeIfEnabled();
    }
    // Persist to server
    try {
      const theme = darkModeToggle.checked ? 'dark' : 'light';
      const csrftoken = (document.cookie.split('; ').find(r => r.startsWith('csrftoken=')) || '').split('=')[1] || '';
      fetch('/api/set-theme/', {
        method: 'POST',
        headers: { 'X-CSRFToken': csrftoken },
        body: new URLSearchParams({ theme })
      }).catch(() => {});
    } catch (_) {}
  };
}


function clearDashboardState() {
    try {
        localStorage.removeItem('ds_timer_state_v2');
        localStorage.removeItem('reminderIntervalMinutes');
        sessionStorage.removeItem('ds_quote_shown');
    } catch (e) {
        console.warn("Failed to clear dashboard state", e);s
    }
}

// Global init called from settings.html, idempotent and container-scoped
window.initSettings = function(opts) {
  try {
    const contentArea = document.getElementById('content-area') || document;
    const container = contentArea;
    initSettingsDarkMode(container);

    const logoutBtn = container.querySelector('#logout-btn');
    if (logoutBtn && !logoutBtn.__bound) {
      logoutBtn.__bound = true;
      logoutBtn.addEventListener('click', (e) => {
        clearDashboardState();
        if (opts && opts.logoutUrl) window.location.href = opts.logoutUrl;
      });
    }

    const settingsForm = container.querySelector(`form[action="${opts && opts.settingsUrl ? opts.settingsUrl : ''}"]`) || container.querySelector('form');
    if (settingsForm && !settingsForm.__bound) {
      settingsForm.__bound = true;
      settingsForm.addEventListener('submit', () => {
        try { localStorage.removeItem('ds_timer_state_v2'); } catch (e) { console.warn('Failed to clear old timer state', e); }
      });
    }
  } catch (e) {
    console.warn('initSettings error', e);
  }
};
