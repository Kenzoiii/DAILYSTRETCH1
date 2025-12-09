window.initDashboard = window.initDashboard || function initDashboard(root) {
  try {
    // Ensure only one dashboard loop globally; cancel any previous animation frame
    window.DS = window.DS || {};
    window.DS.dashboard = window.DS.dashboard || {};
    if (window.DS.dashboard.animationFrameId) {
      try { cancelAnimationFrame(window.DS.dashboard.animationFrameId); } catch (_) {}
      window.DS.dashboard.animationFrameId = null;
    }
    if (window.DS.dashboard.finishTimeoutId) {
      try { clearTimeout(window.DS.dashboard.finishTimeoutId); } catch (_) {}
      window.DS.dashboard.finishTimeoutId = null;
    }
    if (!root || !(root instanceof Element)) root = document;
    if (root.__dashboard_inited) return;
    root.__dashboard_inited = true;

    // Request notification permission upfront (best-effort, silent on failure)
    try {
      if (window.Notification && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission().catch(() => {});
      }
    } catch (_) {}

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

    const USER_SUFFIX = (window.userKey !== undefined && window.userKey !== null) ? String(window.userKey) : 'anon';
    const TIMER_STORAGE_KEY = 'ds_timer_state_v2_' + USER_SUFFIX;
    const LAST_PAUSED_KEY = 'ds_last_paused_seconds_' + USER_SUFFIX;

    // ----------------- TIME FORMATTING -----------------
  function formatTime(s) {
    const totalSeconds = Math.floor(s);
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
        ? `Focus for ${window.studyDuration} minute/s`
        : `Break for ${window.breakDuration} minute/s`;
      switchBtn.textContent = state.isStudy ? 'Switch to Break' : 'Switch to Study';
      if (quickStudy) quickStudy.textContent = `${window.studyDuration} min`;
      if (quickBreak) quickBreak.textContent = `${window.breakDuration} min`;
    }

    // ----------------- PERSISTENCE -----------------
    function saveTimerState() {
      try {
        const payload = {
          isRunning: state.isRunning,
          isStudy: state.isStudy,
          timerSeconds: state.timerSeconds,
          lastUpdate: state.lastUpdate
        };
        localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(payload));
      } catch (e) { console.warn('Failed to save timer state', e); }
    }

    function loadTimerState() {
      try {
        const raw = localStorage.getItem(TIMER_STORAGE_KEY);
        if (!raw) return false;
        const saved = JSON.parse(raw);
        if (!saved || typeof saved.timerSeconds !== 'number') return false;

        // Determine resume intent first to guard against unintended elapsed subtraction
        const RESUME_FLAG = 'ds_timer_resume_on_return';
        const shouldResume = sessionStorage.getItem(RESUME_FLAG) === '1';

        // If not resuming, ensure no drift and no auto-resume
        if (!shouldResume) {
          saved.lastUpdate = null;
          saved.isRunning = false;
        }

        let restored = saved.timerSeconds;
        const wasRunning = !!saved.isRunning;
        if (wasRunning && saved.lastUpdate && shouldResume) {
          const elapsedMs = Date.now() - Number(saved.lastUpdate);
          const elapsed = Math.floor(elapsedMs / 1000);
          restored = Math.max(0, restored - elapsed);
        }

        // If not resuming, prefer the last explicitly paused time if available
        if (!shouldResume) {
          try {
            const lp = sessionStorage.getItem(LAST_PAUSED_KEY);
            const lpNum = lp ? Number(lp) : NaN;
            if (!Number.isNaN(lpNum) && lpNum >= 0) {
              restored = lpNum;
            }
          } catch (_) {}
        }

        state.timerSeconds = restored;
        state.isStudy = !!saved.isStudy;
        state.initialSeconds = state.isStudy
          ? window.studyDuration * 60
          : window.breakDuration * 60;
        // Resume strictly based on an explicit flag, not just previous state
        if (shouldResume && restored > 0) {
          startBtn.textContent = '\u23F8 Pause';
          state.isRunning = true;
          cancelAnimationFrame(animationFrameId);
          animationFrameId = requestAnimationFrame(tick);
        } else {
          state.isRunning = false;
          startBtn.textContent = '\u25B6 Start';
          cancelAnimationFrame(animationFrameId);
        }

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
      } catch (_) {}
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
      } catch (_) {}
    }

    // ----------------- TIMER LOGIC (smooth) -----------------
    let animationFrameId = null;
    // Suppress notifications briefly after reset/switch to avoid stray alarms
    let suppressNotifyUntil = 0;
    let finishTimeoutId = null;

    function clearFinishTimeout() {
      if (finishTimeoutId) { try { clearTimeout(finishTimeoutId); } catch(_) {} finishTimeoutId = null; }
      window.DS.dashboard.finishTimeoutId = null;
    }

    function scheduleFinishTimeout() {
      clearFinishTimeout();
      if (!state.isRunning) return;
      const ms = Math.max(0, Math.floor(state.timerSeconds * 1000));
      finishTimeoutId = setTimeout(() => {
        // Safety checks
        if (!state.isRunning) return;
        state.timerSeconds = 0;
        saveTimerState();
        if (Date.now() >= suppressNotifyUntil) {
          notifyFinish();
        }
        switchMode();
      }, ms);
      window.DS.dashboard.finishTimeoutId = finishTimeoutId;
    }

    function tick() {
      if (!state.isRunning) return;

      const now = Date.now();
      const elapsed = (now - (state.lastUpdate || now)) / 1000;
      state.lastUpdate = now;

      state.timerSeconds = Math.max(0, state.timerSeconds - elapsed);

      if (state.timerSeconds <= 0) {
        state.timerSeconds = 0;
        try { sessionStorage.removeItem(sessionKey); } catch (_) {}
        // Let the finish timeout handle notification/switch to avoid double triggers
      }

      render();
      saveTimerState();

      animationFrameId = requestAnimationFrame(tick);
      window.DS.dashboard.animationFrameId = animationFrameId;
    }

    const sessionKey = 'ds_quote_shown';
    function startTimer() {
      if (state.isRunning) return;
      state.isRunning = true;
      state.lastUpdate = Date.now();
      startBtn.textContent = '\u23F8 Pause';
      cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(tick);
      saveTimerState();
      try { sessionStorage.setItem('ds_timer_resume_on_return', '1'); } catch (_) {}
      scheduleFinishTimeout();
      
    
      if (!sessionStorage.getItem(sessionKey)) {
      const quotes = [
        "Creativity is just connecting things. – Steve Jobs",
        "Happiness is when what you think, what you say, and what you do are in harmony. – Mahatma Gandhi",
        "The biggest adventure you can take is to live the life of your dreams. – Oprah Winfrey",
        "Lead from the back — and let others believe they are in front. – Nelson Mandela",
        "Success is not final, failure is not fatal: It is the courage to continue that counts. – Winston Churchill",
        "Success is not how high you have climbed, but how you make a positive difference to the world. – Roy T. Bennett",
        "Your work is going to fill a large part of your life, and the only way to be truly satisfied is to do what you believe is great work. And the only way to do great work is to love what you do. – Steve Jobs",
        "It is our choices that show what we truly are, far more than our abilities. – J.K. Rowling",
        "Every child is an artist. The problem is how to remain an artist once we grow up. – Pablo Picasso",
        "Happiness is the key to success. If you love what you are doing, you will be successful. – Albert Schweitzer",
        "A leader is one who knows the way, goes the way, and shows the way. – John C. Maxwell",
        "You have power over your mind, not outside events. Realize this, and you will find strength. – Marcus Aurelius"
      ];

       const completionQuotes = [
        "Well done! The journey of a thousand miles begins with a single step. – Lao Tzu",
        "Great job! Continuous effort, not strength or intelligence, is the key to unlocking our potential. – Winston Churchill",
        "You did it! Success is the sum of small efforts, repeated day in and day out. – Robert Collier",
        "Session complete! Don’t watch the clock; do what it does. Keep going. – Sam Levenson",
        "Excellent work! The secret of getting ahead is getting started. – Mark Twain",
        "Nice! Quality is never an accident; it is always the result of intelligent effort. – John Ruskin",
        "Another session finished! Energy and persistence conquer all things. – Benjamin Franklin",
        "Well done! Motivation is what gets you started. Habit is what keeps you going. – Jim Ryun",
        "Congrats! Great things are done by a series of small things brought together. – Vincent Van Gogh",
        "Session completed! Don’t be afraid to give up the good to go for the great. – John D. Rockefeller"
      ];
      
      let quote = '';
      if(state.isStudy){
        quote = quotes[Math.floor(Math.random() * quotes.length)];
      }else{
        quote = completionQuotes[Math.floor(Math.random() * completionQuotes.length)];
      }
      showToast(quote, 10000);
      try { sessionStorage.setItem(sessionKey, '1'); } catch (_) {}
    }
    }

    function pauseTimer() {
      if (!state.isRunning) return;
      state.isRunning = false;
      startBtn.textContent = '\u25B6 Start';
      cancelAnimationFrame(animationFrameId);
      clearFinishTimeout();
      state.lastUpdate = null;
      saveTimerState();
      try {
        sessionStorage.setItem('ds_timer_resume_on_return', '0');
        sessionStorage.setItem(LAST_PAUSED_KEY, String(state.timerSeconds));
      } catch (_) {}
    }

    function resetTimer() {
      pauseTimer();
      state.initialSeconds = state.isStudy ? window.studyDuration * 60 : window.breakDuration * 60;
      state.timerSeconds = state.initialSeconds;
      render();
      saveTimerState();
      try { sessionStorage.setItem('ds_timer_resume_on_return', '0'); } catch (_) {}
      // Suppress finish notifications for 2 seconds after reset to avoid stray alarms
      suppressNotifyUntil = Date.now() + 2000;
      clearFinishTimeout();
    }

    function switchMode() {
      pauseTimer();
      state.isStudy = !state.isStudy;
      state.initialSeconds = state.isStudy ? window.studyDuration * 60 : window.breakDuration * 60;
      state.timerSeconds = state.initialSeconds;
      render();
      saveTimerState();
      try { sessionStorage.setItem('ds_timer_resume_on_return', '0'); } catch (_) {}
      suppressNotifyUntil = Date.now() + 2000;
      clearFinishTimeout();
    }

    // ----------------- EVENT LISTENERS -----------------
    startBtn.addEventListener('click', () => {
      if (state.timerSeconds <= 0) {
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
    } else {
      render();
      if (state.isRunning && state.timerSeconds > 0) scheduleFinishTimeout();
    }

    // ----------------- PAGE LIFECYCLE SAFEGUARDS -----------------
    function persistOnHide() {
      // When leaving the page, avoid unintended resume/drift
      try {
        if (!state.isRunning) {
          state.lastUpdate = null;
          sessionStorage.setItem('ds_timer_resume_on_return', '0');
          sessionStorage.setItem(LAST_PAUSED_KEY, String(state.timerSeconds));
        }
        saveTimerState();
      } catch (_) {}
    }

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') persistOnHide();
    });
    window.addEventListener('pagehide', persistOnHide);
    window.addEventListener('beforeunload', persistOnHide);

    // Proactive: when user clicks navigation links, persist paused state to avoid drift
    document.addEventListener('click', (ev) => {
      const t = ev.target;
      const anchor = (t && t.closest) ? t.closest('a[href]') : null;
      if (!anchor) return;
      const href = anchor.getAttribute('href') || '';
      // Only act for navigation (not JS anchors) and only when paused
      if (!href.startsWith('#') && !state.isRunning) {
        persistOnHide();
      }
    });

    // ----------------- STRETCH & HYDRATION REMINDERS -----------------
    const stretchToggle = q('#stretch-toggle');
    const hydrationToggle = q('#hydration-toggle');
    let stretchReminderId = null;
    let hydrationReminderId = null;
    const USER_SUFFIX_REM = (window.userKey !== undefined && window.userKey !== null) ? String(window.userKey) : 'anon';
    const STRETCH_TOGGLE_KEY = 'ds_toggle_stretch_' + USER_SUFFIX_REM;
    const HYDRATION_TOGGLE_KEY = 'ds_toggle_hydration_' + USER_SUFFIX_REM;

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
        } catch (_) {}

        return setTimeout(reminder, (window.reminderIntervalMinutes || 30) * 60 * 1000);
      }

      return setTimeout(reminder, (window.reminderIntervalMinutes || 30) * 60 * 1000);
    }

    function scheduleReminders() {
      clearReminderTimers();
      stretchReminderId = scheduleReminder(stretchToggle, 'Time to stretch!', 'Stretch reminder');
      hydrationReminderId = scheduleReminder(hydrationToggle, 'Time to hydrate!', 'Hydration reminder');
    }

    // Restore toggle state from storage on init
    try {
      if (stretchToggle) {
        const v = localStorage.getItem(STRETCH_TOGGLE_KEY);
        if (v === 'on' || v === 'off') {
          const on = (v === 'on');
          stretchToggle.checked = on;
          if (on) { stretchToggle.setAttribute('checked', 'checked'); } else { stretchToggle.removeAttribute('checked'); }
        }
      }
      if (hydrationToggle) {
        const v = localStorage.getItem(HYDRATION_TOGGLE_KEY);
        if (v === 'on' || v === 'off') {
          const on = (v === 'on');
          hydrationToggle.checked = on;
          if (on) { hydrationToggle.setAttribute('checked', 'checked'); } else { hydrationToggle.removeAttribute('checked'); }
        }
      }
    } catch (_) {}

    // Persist on change and reschedule reminders
    if (stretchToggle) stretchToggle.addEventListener('change', () => {
      try { localStorage.setItem(STRETCH_TOGGLE_KEY, stretchToggle.checked ? 'on' : 'off'); } catch (_) {}
      scheduleReminders();
    });
    if (hydrationToggle) hydrationToggle.addEventListener('change', () => {
      try { localStorage.setItem(HYDRATION_TOGGLE_KEY, hydrationToggle.checked ? 'on' : 'off'); } catch (_) {}
      scheduleReminders();
    });
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

// Auto-init: prefer content-area container to ensure proper re-init on segment switches
try {
  const contentArea = document.getElementById('content-area') || document;
  if (contentArea.querySelector && contentArea.querySelector('#time-display')) {
    window.initDashboard(contentArea);
  }
} catch (e) { console.warn('Dashboard auto-init failed', e); }
