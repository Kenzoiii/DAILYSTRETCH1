window.DS = window.DS || {};
window.DS.library = window.DS.library || {};
function getLibTimer() { return window.DS.library.timerInterval || null; }
function setLibTimer(v) { window.DS.library.timerInterval = v; }

// --- Helper Functions ---
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

function prettyCategory(cat) {
  if (!cat) return '';
  if (cat === 'eye-care') return 'Eye Care';
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

function makeTags(r) {
  let tags = '';
  tags += `<span class="lib-tag blue">${prettyCategory(r.category)}</span>`;
  if (r.difficulty === 'beginner') tags += `<span class="lib-tag green">Beginner</span>`;
  else if (r.difficulty === 'intermediate') tags += `<span class="lib-tag orange">Intermediate</span>`;
  else if (r.difficulty === 'advanced') tags += `<span class="lib-tag red">Advanced</span>`;
  const dur = r.duration_text || (r.duration_minutes ? String(r.duration_minutes) + ' min' : (r.duration || ''));
  if (dur) tags += `<span class="lib-tag gray">${dur}</span>`;
  return tags;
}

function durationSeconds(dur) {
  if (!dur) return 5 * 60; // default 5 minutes
  const m = parseInt(String(dur).replace(/[^0-9]/g, ''), 10);
  return (isNaN(m) ? 5 : m) * 60;
}

// --- Main Library Routine ---
window.initLibrary = window.initLibrary || async function initLibrary(root) {
  try {
    if (!root || !(root instanceof Element)) root = document;
    
    // FIX 1: Prevent double initialization
    if (root.__library_inited) return;
    root.__library_inited = true;

    async function fetchApiRoutines() {
      const resp = await fetch('/api/routines/', { credentials: 'same-origin' });
      if (!resp.ok) return [];
      return await resp.json();
    }
    async function fetchFavoriteList() {
      const resp = await fetch('/favorite-list/', { credentials: 'same-origin' });
      if (!resp.ok) return [];
      return await resp.json();
    }
    
    async function toggleFavorite(routineId, starEl) {
      const resp = await fetch('/favorite-toggle/', {
        method: 'POST',
        headers: {
          'X-CSRFToken': getCSRFToken(),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `routine_id=${routineId}`,
        credentials: 'same-origin'
      });
      const result = await resp.json();
      if (result.ok) {
        if (result.favorited) {
          starEl.classList.add('active');
          starEl.style.color = "#e7b900";
        } else {
          starEl.classList.remove('active');
          starEl.style.color = "#c6c6c6";
        }
      }
    }

    function renderRoutineCard(r, favs) {
      // FIX 2: Ensure ID comparison matches string vs int
      const isFav = favs.map(String).includes(String(r.id));
      return `
        <div class="lib-card" data-category="${r.category || ''}" data-difficulty="${r.difficulty || ''}">
          <div class="lib-card-header">
            <strong>${r.title}</strong>
            <span class="star${isFav ? ' active' : ''}" data-id="${r.id}" style="color:${isFav ? '#e7b900' : '#c6c6c6'}">★</span>
          </div>
          <p class="lib-desc">${r.description || ''}</p>
          <div class="lib-tags">${makeTags(r)}</div>
          <button class="routine-btn" data-id="${r.id}">
            <span style="margin-right:7px;color:#61cfff">▶</span> Start Routine
          </button>
        </div>
      `;
    }

    async function renderRoutines() {
      const grid = root.querySelector('#libraryGrid');
      if (!grid) return;
      
      // FIX 3: Clear grid before rendering to prevent doubling
      grid.innerHTML = '';

      // fetch backend data
      let routines = await fetchApiRoutines();
      let favs = await fetchFavoriteList();
      routines = routines || [];
      favs = favs || [];

      // normalize
      const normalized = routines.map((r, i) => ({
        id: String(r.id ?? r.pk ?? i),
        title: r.title ?? r.name ?? ('Routine ' + (i + 1)),
        description: r.description ?? r.desc ?? '',
        category: r.category ?? '',
        difficulty: r.difficulty ?? '',
        duration_text: r.duration_text ?? r.duration ?? (r.duration_minutes ? String(r.duration_minutes) + ' min' : ''),
        duration_minutes: r.duration_minutes ?? (r.duration ? parseInt(String(r.duration).replace(/[^0-9]/g, ''), 10) : null),
        instructions: r.instructions ?? ''
      }));

      // Store for modal lookup:
      root.__library_items = normalized;

      const catEl = root.querySelector('#category');
      const diffEl = root.querySelector('#difficulty');
      const cat = catEl ? catEl.value : '';
      const diff = diffEl ? diffEl.value : '';

      let count = 0;
      normalized.forEach(r => {
        const catMatch = !cat || r.category === cat;
        const diffMatch = !diff || r.difficulty === diff;
        if (catMatch && diffMatch) {
          grid.innerHTML += renderRoutineCard(r, favs);
          count++;
        }
      });
      if (count === 0) {
        grid.innerHTML = '<div class="lib-empty"><div style="text-align:center;padding:40px;color:#666"><div style="font-size:20px;margin-bottom:8px">No routines found</div><div style="font-size:13px">Add routines via the admin, the /api/routines/ endpoint, or connect Supabase and add rows to your `routines` table.</div></div></div>';
      }

      // Setup event handlers:
      grid.querySelectorAll('.star').forEach(el => {
        el.onclick = function (e) {
          e.stopPropagation();
          toggleFavorite(String(el.getAttribute('data-id')), el);
        };
      });
      grid.querySelectorAll('.routine-btn').forEach(btn => {
        btn.onclick = function () {
          // Calls the window.openRoutine defined below
          openRoutine(String(btn.getAttribute('data-id')));
        };
      });
    }

    // --- RESTORED: Modal + Timer Logic ---
    window.openRoutine = function (idx) {
      const libraryTimerInterval = getLibTimer();
      if (libraryTimerInterval) clearInterval(libraryTimerInterval);
      const itemsColl = root.__library_items || [];
      let r = itemsColl.find(it => String(it.id) === String(idx));
      if (!r) {
        console.warn('openRoutine: not found for idx', idx);
        return;
      }
      const modalBg = root.querySelector('#modalBg');
      const modalContent = root.querySelector('#modalContent');
      const routineTitle = root.querySelector('#routineTitle');
      const timerArea = root.querySelector('#timerArea');
      const modalStartBtn = root.querySelector('#modalStartBtn');
      const modalStopBtn = root.querySelector('#modalStopBtn');
      
      if (!modalBg || !modalContent) return;
      modalBg.style.display = 'flex';
      modalContent.innerHTML = `<strong>${r.title}</strong><br/><br/><span>${r.instructions || r.description || ''}</span>`;
      if (routineTitle) routineTitle.innerText = r.title;
      if (timerArea) timerArea.style.display = 'none';
      if (modalStartBtn) modalStartBtn.style.display = '';
      if (modalStopBtn) modalStopBtn.style.display = 'none';
      
      const durationArg = r.duration_text || (r.duration_minutes ? String(r.duration_minutes) + ' min' : '5 min');
      
      if (modalStartBtn) modalStartBtn.onclick = function() { startTimer(durationArg, r.title); };
      if (modalStopBtn) modalStopBtn.onclick = function() { closeModal(); };
      modalBg.onclick = function(e) { if (e.target === modalBg) closeModal(); };
    };

    function closeModal() {
      const modalBg = root.querySelector('#modalBg');
      const timerArea = root.querySelector('#timerArea');
      const modalStartBtn = root.querySelector('#modalStartBtn');
      const modalStopBtn = root.querySelector('#modalStopBtn');
      const timerDisplay = root.querySelector('#timerDisplay');
      if (modalBg) modalBg.style.display = 'none';
      if (timerArea) timerArea.style.display = 'none';
      if (modalStartBtn) modalStartBtn.style.display = '';
      if (modalStopBtn) modalStopBtn.style.display = 'none';
      if (timerDisplay) timerDisplay.innerText = '';
      const libraryTimerInterval = getLibTimer();
      if (libraryTimerInterval) clearInterval(libraryTimerInterval);
    }

    function startTimer(duration, title) {
      const modalStartBtn = root.querySelector('#modalStartBtn');
      const modalStopBtn = root.querySelector('#modalStopBtn');
      const timerArea = root.querySelector('#timerArea');
      const routineTitle = root.querySelector('#routineTitle');
      
      if (modalStartBtn) modalStartBtn.style.display = 'none';
      if (modalStopBtn) modalStopBtn.style.display = '';
      if (timerArea) timerArea.style.display = '';
      if (routineTitle) routineTitle.innerText = title;
      
      let seconds = durationSeconds(duration);
      updateTimerDisplay(seconds);
      const interval = setInterval(function() {
        seconds--;
        updateTimerDisplay(seconds);
        if (seconds <= 0) {
          clearInterval(interval);
          const timerDisplay = root.querySelector('#timerDisplay');
          if (timerDisplay) timerDisplay.innerText = 'Routine Complete!';
          setTimeout(closeModal, 1500);
        }
      }, 1000);
      setLibTimer(interval);
    }

    function updateTimerDisplay(seconds) {
      const timerDisplay = root.querySelector('#timerDisplay');
      let min = Math.floor(seconds / 60);
      let sec = seconds % 60;
      if (seconds < 0) seconds = 0;
      if (timerDisplay) timerDisplay.innerText = `${min}:${sec.toString().padStart(2, '0')}`;
    }

    const catEl = root.querySelector('#category');
    const diffEl = root.querySelector('#difficulty');
    if (catEl) catEl.onchange = renderRoutines;
    if (diffEl) diffEl.onchange = renderRoutines;

    // Initial render
    renderRoutines();
    return { render: renderRoutines };
  } catch (err) {
    console.error('initLibrary failed', err);
  }
};

// Boot on page load:
try {
  const grid = document.querySelector('#libraryGrid');
  // Check if grid exists and not already inited
  if (grid && !document.__library_inited) {
      window.initLibrary(document);
  }
} catch (e) { }