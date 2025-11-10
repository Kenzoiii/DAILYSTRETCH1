window.initDashboard = window.initDashboard || function initDashboard(root) {
  try {
    if (!root || !(root instanceof Element)) { root = document; }
    if (root.__dashboard_inited) return;
    root.__dashboard_inited = true;


    try {
      if (window.Notification && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission().catch(() => {});
      }
    } catch (e) { }

    const q = (sel) => root.querySelector(sel);
    const timeDisplay = q('#time-display');
    const startBtn = q('#start-btn');
    const resetBtn = q('#reset-btn');
    const switchBtn = q('#switch-btn');
    const progressEl = q('.progress');
    const belowBtn = q('#below');
    const quickStudy = document.getElementById('quick-study-duration');
    const quickBreak = document.getElementById('quick-break-duration');
    if (!timeDisplay || !startBtn || !resetBtn || !switchBtn || !progressEl || !belowBtn) { return; }

    let state = {
      isRunning: false,
      isStudy: true,
      timerSeconds: window.studyDuration * 60,
      initialSeconds: window.studyDuration * 60,
      lastUpdate: null,
    };
    function formatTime(s) {
      const m = Math.floor(s / 60).toString().padStart(2, '0');
      const sec = (s % 60).toString().padStart(2, '0');
      return `${m}:${sec}`;
    }
    function render() {
      timeDisplay.textContent = formatTime(state.timerSeconds);
      const pct = 100 - Math.round((state.timerSeconds / state.initialSeconds) * 100);
      progressEl.style.width = pct + '%';
      belowBtn.textContent = state.isStudy ? `Focus for ${window.studyDuration} minutes` : `Break for ${window.breakDuration} minutes`;
      switchBtn.textContent = state.isStudy ? 'Switch to Break' : 'Switch to Study';
      if (quickStudy) quickStudy.textContent = `${window.studyDuration} min`;
      if (quickBreak) quickBreak.textContent = `${window.breakDuration} min`;
    }

    function notifyFinish() {
      try {

        const title = state.isStudy ? 'Time for Break!' : 'Break finished';
        const body = state.isStudy ? 'Take a short break.' : 'Back to work!';

        try {
          if (window.Notification && Notification.permission === 'granted') {
            new Notification(title, { body, tag: 'ds-session', renotify: true });
          } else if (window.Notification && Notification.permission !== 'denied') {
            Notification.requestPermission().then(p => {
              if (p === 'granted') new Notification(title, { body, tag: 'ds-session', renotify: true });
            }).catch(() => {});
          }
        } catch (e) {  }

        try { showToast(body, 1800); } catch (e) {  }


        try {
          const alarmEl = document.getElementById('ds-alarm');
          if (alarmEl && typeof alarmEl.play === 'function') alarmEl.play();
        } catch (e) { /* ignore */ }
      } catch (e) { console.warn('notify failed', e); }
    }
    let timerInterval = null;
    function tick() {
      if (state.isRunning && state.lastUpdate) {
        const now = Date.now();
        const elapsed = Math.floor((now - state.lastUpdate) / 1000);
        if (elapsed > 0) {
          state.timerSeconds = Math.max(0, state.timerSeconds - elapsed);
          state.lastUpdate = now;
          if (state.timerSeconds === 0) {
            clearInterval(timerInterval); state.isRunning = false;
            notifyFinish();
          }
        }
      }
      if (state.isRunning) {
        state.timerSeconds = Math.max(0, state.timerSeconds - 1);
        if (state.timerSeconds === 0) {
          clearInterval(timerInterval); state.isRunning = false;
          notifyFinish();
        }
      }
      render();
    }
    function startTimer() {
      if (state.isRunning) return;
      state.isRunning = true;
      state.lastUpdate = Date.now();
      startBtn.textContent = '\u23f8 Pause';
      clearInterval(timerInterval);
      timerInterval = setInterval(tick, 1000);
    }
    function pauseTimer() {
      if (!state.isRunning) return;
      state.isRunning = false;
      startBtn.textContent = '\u25b6 Start';
      clearInterval(timerInterval);
      state.lastUpdate = null;
    }
    function resetTimer() {
      pauseTimer();
      state.timerSeconds = state.initialSeconds;
      render();
    }
    function switchMode() {
      pauseTimer();
      state.isStudy = !state.isStudy;
      state.initialSeconds = state.isStudy ? (window.studyDuration * 60) : (window.breakDuration * 60);
      state.timerSeconds = state.initialSeconds;
      render();
    }

    startBtn.addEventListener('click', () => { state.isRunning ? pauseTimer() : startTimer(); });
    resetBtn.addEventListener('click', resetTimer);
    switchBtn.addEventListener('click', switchMode);
    belowBtn.addEventListener('click', startTimer);

    // Force always fresh values from Django on every dashboard load:
    state.timerSeconds = window.studyDuration * 60;
    state.initialSeconds = window.studyDuration * 60;
    state.isStudy = true;
    render();


    const intervalBtnsContainer = q('.interval-btns');
    if (intervalBtnsContainer) {
      const buttons = Array.from(intervalBtnsContainer.querySelectorAll('button'));
      function getMinutesFromText(text) {
        const m = (text || '').match(/(\d+)/);
        return m ? parseInt(m[0], 10) : 30;
      }

      try {
        const stored = parseInt(localStorage.getItem('reminderIntervalMinutes'), 10);
        if (!Number.isNaN(stored)) {
          window.reminderIntervalMinutes = stored;
        }
      } catch (e) {  }


      if (window.reminderIntervalMinutes) {
        buttons.forEach(b => b.classList.toggle('active', getMinutesFromText(b.textContent) === window.reminderIntervalMinutes));
      } else {
        const activeBtn = buttons.find(b => b.classList.contains('active'));
        window.reminderIntervalMinutes = activeBtn ? getMinutesFromText(activeBtn.textContent) : 30;
      }

      buttons.forEach(btn => {
        btn.addEventListener('click', () => {
          buttons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const minutes = getMinutesFromText(btn.textContent);
          window.reminderIntervalMinutes = minutes;
          try { localStorage.setItem('reminderIntervalMinutes', String(minutes)); } catch (e) { }
          try { showToast(`Reminder interval set to ${minutes} minutes`, 1200); } catch (e) { }
        });
      });
    }

    // --- Reminder scheduling (stretch & hydration) ---
    const stretchToggle = q('#stretch-toggle');
    const hydrationToggle = q('#hydration-toggle');
    let stretchReminderId = null;
    let hydrationReminderId = null;

    function clearReminderTimers() {
      try { if (stretchReminderId) { clearInterval(stretchReminderId); stretchReminderId = null; } } catch (e) {}
      try { if (hydrationReminderId) { clearInterval(hydrationReminderId); hydrationReminderId = null; } } catch (e) {}
    }

    function scheduleReminders() {
      clearReminderTimers();
      const mins = window.reminderIntervalMinutes || 30;
      const intervalMs = Math.max(1, mins) * 60 * 1000;

      // Stretch reminders
      try {
        if (stretchToggle && stretchToggle.checked) {
          stretchReminderId = setInterval(() => {
            try { showToast('Time to stretch!', 1500); } catch (e) {}
            try {
              if (window.Notification && Notification.permission === 'granted') {
                new Notification('Stretch reminder', { body: `Take a stretch every ${mins} minutes.`, tag: 'ds-reminder' });
              }
            } catch (e) {}
            try { const el = document.getElementById('ds-reminder-alarm'); if (el && typeof el.play === 'function') el.play(); } catch (e) {}
          }, intervalMs);
        }
      } catch (e) {}

      // Hydration reminders
      try {
        if (hydrationToggle && hydrationToggle.checked) {
          hydrationReminderId = setInterval(() => {
            try { showToast('Time to hydrate!', 1500); } catch (e) {}
            try {
              if (window.Notification && Notification.permission === 'granted') {
                new Notification('Hydration reminder', { body: `Drink some water — every ${mins} minutes.`, tag: 'ds-reminder' });
              }
            } catch (e) {}
            try { const el = document.getElementById('ds-reminder-alarm'); if (el && typeof el.play === 'function') el.play(); } catch (e) {}
          }, intervalMs);
        }
      } catch (e) {}
    }

    // Attach change listeners so toggling reminders updates timers immediately
    try {
      if (stretchToggle) stretchToggle.addEventListener('change', scheduleReminders);
      if (hydrationToggle) hydrationToggle.addEventListener('change', scheduleReminders);
    } catch (e) {}

    // Start reminders according to current state
    try { scheduleReminders(); } catch (e) {}
    return state;
  } catch (err) {}
};
try {
  if (document.querySelector && document.querySelector('#time-display')) {
    window.initDashboard(document);
  }
} catch (e) {}

function showToast(text, duration = 1500) {
      try {
        let toast = document.getElementById('ds-toast');
        if (!toast) {
          toast = document.createElement('div');
          toast.id = 'ds-toast';
          document.body.appendChild(toast);
        }
        toast.textContent = text;
        toast.classList.add('show');
        setTimeout(() => {
          if (toast) toast.classList.remove('show');
        }, duration);
      } catch (e) { /* ignore */ }
    }

