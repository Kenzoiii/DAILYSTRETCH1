// Simple modal and timer logic for Favorites page (idempotent)
(function(){
  window.DS = window.DS || {};
  window.DS.favorites = window.DS.favorites || {};

  function getTimer() { return window.DS.favorites.timerInterval || null; }
  function setTimer(v) { window.DS.favorites.timerInterval = v; }

  function openRoutineModal(title, instructions, durationText, container) {
  const favoritesTimerInterval = getTimer();
  if (favoritesTimerInterval) clearInterval(favoritesTimerInterval);
  const modalBg = document.getElementById('modalBg');
  const modalContent = document.getElementById('modalContent');
  const routineTitle = document.getElementById('routineTitle');
  const timerArea = document.getElementById('timerArea');
  const modalStartBtn = document.getElementById('modalStartBtn');
  const modalStopBtn = document.getElementById('modalStopBtn');
  const timerDisplay = document.getElementById('timerDisplay');
  if (!modalBg || !modalContent) return;
  modalBg.style.display = 'flex';
  modalContent.innerHTML = `<strong>${title}</strong><br/><br/><span>${instructions || ''}</span>`;
  if (routineTitle) routineTitle.innerText = title;
  if (timerArea) timerArea.style.display = 'none';
  if (modalStartBtn) modalStartBtn.style.display = '';
  if (modalStopBtn) modalStopBtn.style.display = 'none';
  const durationArg = durationText || '5 min';
    if (modalStartBtn) modalStartBtn.onclick = function() { startFavoritesTimer(durationArg, title, container); };
    if (modalStopBtn) modalStopBtn.onclick = function() { closeFavoritesModal(container); };
  modalBg.onclick = function(e) { if (e.target === modalBg) closeFavoritesModal(); };
}
function closeFavoritesModal() {
  const modalBg = document.getElementById('modalBg');
  const timerArea = document.getElementById('timerArea');
  const modalStartBtn = document.getElementById('modalStartBtn');
  const modalStopBtn = document.getElementById('modalStopBtn');
  const timerDisplay = document.getElementById('timerDisplay');
  if (modalBg) modalBg.style.display = 'none';
  if (timerArea) timerArea.style.display = 'none';
  if (modalStartBtn) modalStartBtn.style.display = '';
  if (modalStopBtn) modalStopBtn.style.display = 'none';
  if (timerDisplay) timerDisplay.innerText = '';
  const favoritesTimerInterval = getTimer();
  if (favoritesTimerInterval) clearInterval(favoritesTimerInterval);
}
function startFavoritesTimer(duration, title, container) {
  const modalStartBtn = document.getElementById('modalStartBtn');
  const modalStopBtn = document.getElementById('modalStopBtn');
  const timerArea = document.getElementById('timerArea');
  const routineTitle = document.getElementById('routineTitle');
  const timerDisplay = document.getElementById('timerDisplay');
  if (modalStartBtn) modalStartBtn.style.display = 'none';
  if (modalStopBtn) modalStopBtn.style.display = '';
  if (timerArea) timerArea.style.display = '';
  if (routineTitle) routineTitle.innerText = title;
  let seconds = durationSeconds(duration);
  updateFavoritesTimerDisplay(seconds);
  const interval = setInterval(function() {
    seconds--;
    updateFavoritesTimerDisplay(seconds);
    if (seconds <= 0) {
      clearInterval(interval);
      if (timerDisplay) timerDisplay.innerText = 'Routine Complete!';
      setTimeout(closeFavoritesModal, 1500);
    }
  }, 1000);
  // persist interval reference to avoid redeclaration conflicts
  setTimer(interval);
}
function updateFavoritesTimerDisplay(seconds) {
  const timerDisplay = document.getElementById('timerDisplay');
  let min = Math.floor(seconds / 60);
  let sec = seconds % 60;
  if (seconds < 0) seconds = 0;
  if (timerDisplay) timerDisplay.innerText = `${min}:${sec.toString().padStart(2, '0')}`;
}
function durationSeconds(dur) {
  if (!dur) return 5 * 60; // default 5 minutes
  const m = parseInt(String(dur).replace(/[^0-9]/g, ''), 10);
  return (isNaN(m) ? 5 : m) * 60;
}

  // --- API helpers (mirror library behavior) ---
  function getCSRFToken() {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
      const cookies = document.cookie.split(';');
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim();
        if (cookie.substring(0, 10) === ('csrftoken=')) {
          cookieValue = decodeURIComponent(cookie.substring(10));
          break;
        }
      }
    }
    return cookieValue;
  }

  async function toggleFavorite(routineId) {
    const resp = await fetch('/favorite-toggle/', {
      method: 'POST',
      headers: {
        'X-CSRFToken': getCSRFToken(),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `routine_id=${routineId}`,
      credentials: 'same-origin'
    });
    try { return await resp.json(); } catch(_) { return { ok: false }; }
  }

// Container-scoped initialization
  window.initFavorites = function(container) {
  const root = container || document;
  const grid = root.querySelector('#favoritesGrid');
  if (!grid) return;
  // Bind buttons
  grid.querySelectorAll('.routine-btn').forEach(btn => {
    if (btn.__bound) return;
    btn.__bound = true;
    btn.addEventListener('click', () => {
      const card = btn.closest('.lib-card');
      const title = card ? card.querySelector('strong')?.textContent || '' : '';
      const desc = card ? card.querySelector('.lib-desc')?.textContent || '' : '';
      const dur = card ? (card.querySelector('.lib-tag.gray')?.textContent || '5 min') : '5 min';
      openRoutineModal(title, desc, dur, root);
    });
  });

    // Bind star unfavorite (remove from favorites list similar to library)
    grid.querySelectorAll('.star').forEach(star => {
      if (star.__bound) return;
      star.__bound = true;
      star.addEventListener('click', async (e) => {
        e.stopPropagation();
        const routineId = String(star.getAttribute('data-id'));
        if (!routineId || routineId === 'null' || routineId === 'undefined') {
          // Fallback: attempt to fetch by title if id missing
          const title = star.closest('.lib-card')?.querySelector('strong')?.textContent || '';
          if (!title) return;
          try {
            const resp = await fetch('/favorite-lookup-id/', {
              method: 'POST',
              headers: { 'X-CSRFToken': getCSRFToken(), 'Content-Type': 'application/x-www-form-urlencoded' },
              credentials: 'same-origin',
              body: `title=${encodeURIComponent(title)}`
            });
            const data = await resp.json();
            if (data && data.id) {
              star.setAttribute('data-id', String(data.id));
            }
          } catch(_) {}
        }
        const finalId = String(star.getAttribute('data-id'));
        if (!finalId) return;
        const res = await toggleFavorite(finalId);
        if (res && res.ok) {
          const card = star.closest('.lib-card');
          if (res.favorited) {
            // still favorited: reflect UI state
            star.classList.add('active');
            star.style.color = '#e7b900';
          } else {
            // unfavorited: remove card from favorites grid
            star.classList.remove('active');
            star.style.color = '#c6c6c6';
            if (card && card.parentElement) {
              card.parentElement.removeChild(card);
            }
            // If grid becomes empty, show empty message
            const remaining = grid.querySelectorAll('.lib-card').length;
            if (remaining === 0) {
              grid.innerHTML = '<div class="lib-empty"><div style="text-align:center;padding:40px;color:#666"><div style="font-size:20px;margin-bottom:8px">No favorites yet</div><div style="font-size:13px">Add favorites from the Library by tapping the star.</div></div></div>';
            }
          }
        }
      });
    });
};
// expose API globally for template inline onclick (backward compat if needed)
window.openRoutineModal = openRoutineModal;
})();
