window.initDashboard = window.initDashboard || function initDashboard(root) {
  try {
    if (!root || !(root instanceof Element)) root = document;
    if (root.__dashboard_inited) return;
    root.__dashboard_inited = true;

    // Request notification permission upfront
    try {
      if (window.Notification && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission().catch(() => {});
      }
    } catch (e) { console.warn('Notification permission request failed', e); }

    const q = (sel) => root.querySelector(sel);
    const timeDisplay = q('#time-display');
    const startBtn = q('#start-btn');
    const resetBtn = q('#reset-btn');
    const switchBtn = q('#switch-btn');
    const progressEl = q('.progress');
    const belowBtn = q('#below');
    const quickStudy = document.getElementById('quick-study-duration');
    const quickBreak = document.getElementById('quick-break-duration');

    if (!timeDisplay || !startBtn || !resetBtn || !switchBtn || !progressEl || !belowBtn) {
      console.warn('Dashboard: missing required UI elements');
      return;
    }

    // ----------------- STATE -----------------
    let state = {
      isRunning: false,
      isStudy: true,
      timerSeconds: 0,
      initialSeconds: 0,
      lastUpdate: null,
    };

    const TIMER_STORAGE_KEY = 'ds_timer_state_v2';

    // ----------------- TIME FORMATTING -----------------
  function formatTime(s) {
  const totalSeconds = Math.floor(s); // <- floor it here
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const sec = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}


    // ----------------- RENDER UI -----------------
    function render() {
      timeDisplay.textContent = formatTime(state.timerSeconds);
      const pct = state.initialSeconds > 0
        ? 100 - Math.round((state.timerSeconds / state.initialSeconds) * 100)
        : 0;
      progressEl.style.width = pct + '%';
      belowBtn.textContent = state.isStudy
        ? `Focus for ${window.studyDuration} minutes`
        : `Break for ${window.breakDuration} minutes`;
      switchBtn.textContent = state.isStudy ? 'Switch to Break' : 'Switch to Study';
      if (quickStudy) quickStudy.textContent = `${window.studyDuration} min`;
      if (quickBreak) quickBreak.textContent = `${window.breakDuration} min`;
    }

    // ----------------- PERSISTENCE -----------------
    function saveTimerState() {
      try {
        localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify({
          isRunning: state.isRunning,
          isStudy: state.isStudy,
          timerSeconds: state.timerSeconds,
          lastUpdate: state.lastUpdate || Date.now()
        }));
      } catch (e) { console.warn('Failed to save timer state', e); }
    }

    function loadTimerState() {
      try {
        const raw = localStorage.getItem(TIMER_STORAGE_KEY);
        if (!raw) return false;
        const saved = JSON.parse(raw);
        if (!saved || typeof saved.timerSeconds !== 'number') return false;

        let restored = saved.timerSeconds;
        const wasRunning = !!saved.isRunning;
        if (wasRunning && saved.lastUpdate) {
          const elapsed = Math.floor((Date.now() - Number(saved.lastUpdate)) / 1000);
          restored = Math.max(0, restored - elapsed);
        }

        state.timerSeconds = restored;
        state.isStudy = !!saved.isStudy;
        state.initialSeconds = state.isStudy
          ? window.studyDuration * 60
          : window.breakDuration * 60;

        if (wasRunning && restored > 0) startTimer();
        else state.isRunning = false;

        return true;
      } catch (e) { console.warn('Failed to load timer state', e); return false; }
    }

    // ----------------- TOAST -----------------
    function showToast(text, duration = 1500) {
      try {
        let toast = document.getElementById('ds-toast');
        if (!toast) {
          toast = document.createElement('div');
          toast.id = 'ds-toast';
          document.body.appendChild(toast);
        }
        toast.textContent = text;
        toast.style.display = "block";
        requestAnimationFrame(() => toast.classList.add("show"));
        setTimeout(() => {
          toast.classList.remove("show");
          setTimeout(() => { toast.style.display = "none"; }, 250);
        }, duration);
      } catch (e) {}
    }

    // ----------------- NOTIFICATIONS -----------------
    function notifyFinish() {
      try {
        const title = state.isStudy ? 'Time for Break!' : 'Break finished';
        const body = state.isStudy ? 'Take a short break.' : 'Back to work!';

        if (window.Notification && Notification.permission === 'granted') {
          new Notification(title, { body, tag: 'ds-session', renotify: true });
        } else if (window.Notification && Notification.permission !== 'denied') {
          Notification.requestPermission().then(p => {
            if (p === 'granted') new Notification(title, { body, tag: 'ds-session', renotify: true });
          });
        }

        showToast(body, 1800);

        const alarmEl = document.getElementById('ds-alarm');
        if (alarmEl && typeof alarmEl.play === 'function') alarmEl.play();
      } catch (e) { console.warn('notifyFinish error', e); }
    }

    // ----------------- TIMER LOGIC (smooth) -----------------
    let animationFrameId = null;

    function tick() {
      if (!state.isRunning) return;

      const now = Date.now();
      const elapsed = (now - (state.lastUpdate || now)) / 1000;
      state.lastUpdate = now;

      state.timerSeconds = Math.max(0, state.timerSeconds - elapsed);

      if (state.timerSeconds <= 0) {
        state.timerSeconds = 0;
        pauseTimer();
        notifyFinish();
      }

      render();
      saveTimerState();

      animationFrameId = requestAnimationFrame(tick);
    }

    function startTimer() {
      if (state.isRunning) return;
      state.isRunning = true;
      state.lastUpdate = Date.now();
      startBtn.textContent = '\u23F8 Pause';
      cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(tick);
      saveTimerState();
    }

    function pauseTimer() {
      if (!state.isRunning) return;
      state.isRunning = false;
      startBtn.textContent = '\u25B6 Start';
      cancelAnimationFrame(animationFrameId);
      state.lastUpdate = null;
      saveTimerState();
    }

    function resetTimer() {
      pauseTimer();
      state.initialSeconds = state.isStudy ? window.studyDuration * 60 : window.breakDuration * 60;
      state.timerSeconds = state.initialSeconds;
      render();
      saveTimerState();
    }

    function switchMode() {
      pauseTimer();
      state.isStudy = !state.isStudy;
      state.initialSeconds = state.isStudy ? window.studyDuration * 60 : window.breakDuration * 60;
      state.timerSeconds = state.initialSeconds;
      render();
      saveTimerState();
    }

    // ----------------- EVENT LISTENERS -----------------
    startBtn.addEventListener('click', () => {
      if (state.timerSeconds <= 0) {
        // If timer finished, reset first
        resetTimer();
        startTimer();
      } else {
        state.isRunning ? pauseTimer() : startTimer();
      }
    });

    resetBtn.addEventListener('click', resetTimer);
    switchBtn.addEventListener('click', switchMode);
    belowBtn.addEventListener('click', startTimer);

    // ----------------- INITIALIZE -----------------
    const hasSaved = loadTimerState();
    if (!hasSaved) {
      state.isStudy = true;
      state.initialSeconds = window.studyDuration * 60;
      state.timerSeconds = state.initialSeconds;
      render();
      saveTimerState();
    }

    // ----------------- STRETCH & HYDRATION REMINDERS -----------------
    const stretchToggle = q('#stretch-toggle');
    const hydrationToggle = q('#hydration-toggle');
    let stretchReminderId = null;
    let hydrationReminderId = null;

    function clearReminderTimers() {
      if (stretchReminderId) { clearTimeout(stretchReminderId); stretchReminderId = null; }
      if (hydrationReminderId) { clearTimeout(hydrationReminderId); hydrationReminderId = null; }
    }

    function scheduleReminder(toggle, msg, notificationTitle) {
      if (!toggle || !toggle.checked) return null;

      function reminder() {
        showToast(msg, 1500);
        try {
          if (window.Notification && Notification.permission === 'granted') {
            new Notification(notificationTitle, { body: msg, tag: 'ds-reminder' });
          }
          const el = document.getElementById('ds-reminder-alarm');
          if (el && typeof el.play === 'function') el.play();
        } catch (e) { console.warn('reminder error', e); }

        return setTimeout(reminder, (window.reminderIntervalMinutes || 30) * 60 * 1000);
      }

      return setTimeout(reminder, (window.reminderIntervalMinutes || 30) * 60 * 1000);
    }

    function scheduleReminders() {
      clearReminderTimers();
      stretchReminderId = scheduleReminder(stretchToggle, 'Time to stretch!', 'Stretch reminder');
      hydrationReminderId = scheduleReminder(hydrationToggle, 'Time to hydrate!', 'Hydration reminder');
    }

    if (stretchToggle) stretchToggle.addEventListener('change', scheduleReminders);
    if (hydrationToggle) hydrationToggle.addEventListener('change', scheduleReminders);
    scheduleReminders();

    // ----------------- INTERVAL BUTTONS -----------------
    const intervalBtnsContainer = q('.interval-btns');
    if (intervalBtnsContainer) {
      const buttons = Array.from(intervalBtnsContainer.querySelectorAll('button'));
      function getMinutesFromText(text) {
        const m = (text || '').match(/(\d+)/);
        return m ? parseInt(m[0], 10) : 30;
      }

      try {
        const stored = parseInt(localStorage.getItem('reminderIntervalMinutes'), 10);
        if (!Number.isNaN(stored)) window.reminderIntervalMinutes = stored;
      } catch (_) {}

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
          window.reminderIntervalMinutes = getMinutesFromText(btn.textContent);
          localStorage.setItem('reminderIntervalMinutes', String(window.reminderIntervalMinutes));
          showToast(`Reminder interval set to ${window.reminderIntervalMinutes} minutes`, 1200);
          scheduleReminders();
        });
      });
    }

    return state;

  } catch (err) { console.error('initDashboard error', err); }
};

// Auto-init
try {
  if (document.querySelector && document.querySelector('#time-display')) {
    window.initDashboard(document);
  }
} catch (e) { console.warn('Dashboard auto-init failed', e); }
