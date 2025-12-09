document.addEventListener("DOMContentLoaded", () => {
  const tabs = document.querySelectorAll(".tab");
  const contentArea = document.getElementById("content-area");
  // One-time audio unlock to satisfy browser autoplay policies
  let audioUnlocked = false;
  function unlockAudioOnce() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    try {
      const a1 = document.getElementById('ds-alarm');
      const a2 = document.getElementById('ds-reminder-alarm');
      const tryUnlock = (el) => {
        if (!el || typeof el.play !== 'function') return;
        const p = el.play();
        if (p && typeof p.then === 'function') {
          p.then(() => { try { el.pause(); el.currentTime = 0; } catch (_) {} }).catch(() => {});
        }
      };
      tryUnlock(a1);
      tryUnlock(a2);
    } catch (_) {}
  }
  // Unlock on first user interaction
  const userEvents = ['click','touchstart','keydown'];
  userEvents.forEach(ev => document.addEventListener(ev, unlockAudioOnce, { once: true, passive: true }));

  // Global dark mode handler
  function applyDarkModeIfEnabled() {
    if (localStorage.getItem('dark_mode_enabled') === 'true') {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }

  // Initial apply on page load
  applyDarkModeIfEnabled();

  const loadPage = async (page) => {
    // Proactively stop any running dashboard timer loop before swapping segments
    try {
      if (window.DS && window.DS.dashboard && window.DS.dashboard.animationFrameId) {
        cancelAnimationFrame(window.DS.dashboard.animationFrameId);
        window.DS.dashboard.animationFrameId = null;
      }
    } catch (_) {}
    try {
      const response = await fetch(page);
      const html = await response.text();
      contentArea.innerHTML = html;

      const scripts = Array.from(contentArea.querySelectorAll('script'));
      const loadPromises = scripts.map((oldScript) => {
        return new Promise((resolve) => {
          const newScript = document.createElement('script');
          if (oldScript.type) newScript.type = oldScript.type;
          if (oldScript.src) {
            newScript.src = oldScript.src;
            newScript.async = false;
            newScript.onload = () => resolve();
            newScript.onerror = (e) => { console.error('Failed loading script', oldScript.src, e); resolve(); };
            document.body.appendChild(newScript);
          } else {
            newScript.textContent = oldScript.textContent;
            document.body.appendChild(newScript);
            resolve();
          }
          try { oldScript.parentNode && oldScript.parentNode.removeChild(oldScript); } catch (e) {}
        });
      });

      await Promise.all(loadPromises);

      // If the page loads an initX function, run it (e.g. for dashboard, settings, etc)
      try {
        const parts = page.split('/').filter(Boolean);
        let last = parts.pop() || '';
        last = last.split('.').shift();
        if (last) {
          const initName = 'init' + last.charAt(0).toUpperCase() + last.slice(1);
          if (typeof window[initName] === 'function') {
            try {
              const flag = '__' + last + '_inited';
              if (contentArea && Object.prototype.hasOwnProperty.call(contentArea, flag)) {
                try { delete contentArea[flag]; } catch (e) { /* ignore */ }
              }
              window[initName](contentArea);
            } catch (err) { console.error('Error running', initName, err); }
          }
        }
      } catch (e) {}

      // <<<< THIS is the important call for dark mode!
      applyDarkModeIfEnabled();

    } catch (err) {
      contentArea.innerHTML = "<p>⚠️ Failed to load content.</p>";
      console.error(err);
    }
  };

  if (tabs && tabs[0]) loadPage(tabs[0].getAttribute("data-page"));

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      loadPage(tab.getAttribute("data-page"));
    });
  });

  // Make applyDarkModeIfEnabled globally accessible
  window.applyDarkModeIfEnabled = applyDarkModeIfEnabled;
});
