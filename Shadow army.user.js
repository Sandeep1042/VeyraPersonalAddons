// ==UserScript==
// @name         Veyra Shadow Army Tag + Retreat Bot
// @namespace    https://demonicscans.org/
// @version      0.1.1
// @description  Refreshes Shadow Army list, enters the top eligible live battle, joins, assigns one target, waits, retreats, then returns to Shadow Army home.
// @match        https://demonicscans.org/shadow_army.php*
// @match        https://demonicscans.org/shadow_army_live_battle.php*
// @homepageURL  https://github.com/nobody65321/VeyraPersonalAddons
// @updateURL    https://github.com/nobody65321/VeyraPersonalAddons/raw/refs/heads/main/Shadow%20army.user.js
// @downloadURL  https://github.com/nobody65321/VeyraPersonalAddons/raw/refs/heads/main/Shadow%20army.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const LS = {
    active: 'tm_shadow_army_bot_active_v1',
    lastActionAt: 'tm_shadow_army_bot_last_action_at_v1',
    lastListRefreshAt: 'tm_shadow_army_bot_last_list_refresh_at_v1',
    stepDelayMs: 'tm_shadow_army_bot_step_delay_ms_v1',
    waitAfterAssignMs: 'tm_shadow_army_bot_wait_after_assign_ms_v1',
    listRefreshMs: 'tm_shadow_army_bot_list_refresh_ms_v1',
    maxLogs: 'tm_shadow_army_bot_max_logs_v1'
  };

  const DEFAULTS = {
    stepDelayMs: 2200,
    waitAfterAssignMs: 9000,
    listRefreshMs: 12000,
    maxLogs: 80
  };

  const MIN_ACTION_GAP_MS = 1200;
  const TICK_MS = 900;

  function getNum(key, fallback) {
    const raw = window.localStorage.getItem(key);
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  }

  function setNum(key, value) {
    window.localStorage.setItem(key, String(Math.max(0, Number(value || 0))));
  }

  function isActive() {
    return window.localStorage.getItem(LS.active) === 'true';
  }

  function setActive(value) {
    window.localStorage.setItem(LS.active, value ? 'true' : 'false');
  }

  function getLastActionAt() {
    return getNum(LS.lastActionAt, 0);
  }

  function setLastActionAt(value) {
    setNum(LS.lastActionAt, value);
  }

  function recentlyActed() {
    return (Date.now() - getLastActionAt()) < MIN_ACTION_GAP_MS;
  }

  function nowIso() {
    return new Date().toLocaleTimeString();
  }

  function fmtMs(ms) {
    const s = Math.max(0, Math.ceil(Number(ms || 0) / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  }

  function logLine(msg) {
    const max = Math.max(20, getNum(LS.maxLogs, DEFAULTS.maxLogs));
    const box = document.getElementById('tmShadowArmyBotLog');
    const line = `[${nowIso()}] ${msg}`;
    console.log('[Shadow Army Bot]', msg);
    if (!box) return;
    const rows = box.value ? box.value.split('\n') : [];
    rows.push(line);
    while (rows.length > max) rows.shift();
    box.value = rows.join('\n');
    box.scrollTop = box.scrollHeight;
  }

  function setStatus(msg) {
    const el = document.getElementById('tmShadowArmyBotStatus');
    if (el) el.textContent = msg;
    logLine(msg);
  }

  function sleep(ms) {
    return new Promise((r) => window.setTimeout(r, ms));
  }

  function isListPage() {
    return /\/shadow_army\.php$/i.test(window.location.pathname);
  }

  function isBattlePage() {
    return /\/shadow_army_live_battle\.php$/i.test(window.location.pathname);
  }

  function battleIdFromUrl() {
    return new URLSearchParams(window.location.search).get('battle_id') || '';
  }

  function getStepDelayMs() {
    return Math.max(350, getNum(LS.stepDelayMs, DEFAULTS.stepDelayMs));
  }

  function getWaitAfterAssignMs() {
    return Math.max(0, getNum(LS.waitAfterAssignMs, DEFAULTS.waitAfterAssignMs));
  }

  function getListRefreshMs() {
    return Math.max(2000, getNum(LS.listRefreshMs, DEFAULTS.listRefreshMs));
  }

  function renderPanel() {
    if (document.getElementById('tmShadowArmyBotPanel')) {
      const toggle = document.getElementById('tmShadowArmyBotToggle');
      if (toggle) {
        toggle.textContent = isActive() ? 'Army Bot ON' : 'Army Bot OFF';
        toggle.style.background = isActive() ? '#1f9d63' : '#963838';
      }
      const step = document.getElementById('tmShadowArmyBotStepDelay');
      if (step) step.value = String(getStepDelayMs());
      const wait = document.getElementById('tmShadowArmyBotWaitAfter');
      if (wait) wait.value = String(getWaitAfterAssignMs());
      const ref = document.getElementById('tmShadowArmyBotRefresh');
      if (ref) ref.value = String(getListRefreshMs());
      const hint = document.getElementById('tmShadowArmyBotHint');
      if (hint) hint.textContent = `Step ${fmtMs(getStepDelayMs())} | Wait ${fmtMs(getWaitAfterAssignMs())} | Refresh ${fmtMs(getListRefreshMs())}`;
      return;
    }

    const panel = document.createElement('div');
    panel.id = 'tmShadowArmyBotPanel';
    Object.assign(panel.style, {
      position: 'fixed',
      top: '180px',
      right: '10px',
      zIndex: '99999',
      width: '320px',
      padding: '10px',
      borderRadius: '12px',
      background: 'rgba(14,18,26,0.94)',
      border: '1px solid rgba(124,255,184,0.28)',
      boxShadow: '0 12px 28px rgba(0,0,0,0.35)',
      color: '#e6e9ff',
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    });

    const row1 = document.createElement('div');
    row1.style.display = 'flex';
    row1.style.gap = '8px';

    const toggle = document.createElement('button');
    toggle.id = 'tmShadowArmyBotToggle';
    toggle.type = 'button';
    toggle.textContent = isActive() ? 'Army Bot ON' : 'Army Bot OFF';
    Object.assign(toggle.style, {
      flex: '1 1 auto',
      padding: '8px 10px',
      border: 'none',
      borderRadius: '10px',
      cursor: 'pointer',
      color: '#fff',
      fontWeight: '700',
      background: isActive() ? '#1f9d63' : '#963838'
    });
    toggle.addEventListener('click', () => {
      setActive(!isActive());
      renderPanel();
      setStatus(isActive() ? 'Enabled.' : 'Idle.');
    });

    const oneStep = document.createElement('button');
    oneStep.type = 'button';
    oneStep.textContent = 'Step';
    Object.assign(oneStep.style, {
      flex: '0 0 auto',
      padding: '8px 10px',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: '10px',
      cursor: 'pointer',
      color: '#e6e9ff',
      fontWeight: '700',
      background: 'rgba(255,255,255,0.06)'
    });
    oneStep.addEventListener('click', () => {
      void tick(true);
    });

    row1.appendChild(toggle);
    row1.appendChild(oneStep);

    const status = document.createElement('div');
    status.id = 'tmShadowArmyBotStatus';
    status.style.color = '#c7cbdf';
    status.style.lineHeight = '1.3';
    status.textContent = 'Idle.';

    const hint = document.createElement('div');
    hint.id = 'tmShadowArmyBotHint';
    hint.style.color = '#9aa0b8';
    hint.textContent = `Step ${fmtMs(getStepDelayMs())} | Wait ${fmtMs(getWaitAfterAssignMs())} | Refresh ${fmtMs(getListRefreshMs())}`;

    const cfg = document.createElement('div');
    cfg.style.display = 'grid';
    cfg.style.gridTemplateColumns = '1fr 1fr 1fr';
    cfg.style.gap = '6px';

    function mkInput(id, label, value) {
      const wrap = document.createElement('div');
      wrap.style.display = 'flex';
      wrap.style.flexDirection = 'column';
      wrap.style.gap = '4px';
      const lab = document.createElement('div');
      lab.textContent = label;
      lab.style.color = '#9aa0b8';
      lab.style.fontSize = '11px';
      const input = document.createElement('input');
      input.id = id;
      input.type = 'number';
      input.min = '0';
      input.step = '250';
      input.value = String(value);
      Object.assign(input.style, {
        width: '100%',
        padding: '6px 8px',
        borderRadius: '10px',
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(0,0,0,0.22)',
        color: '#e6e9ff',
        fontWeight: '700'
      });
      wrap.appendChild(lab);
      wrap.appendChild(input);
      return { wrap, input };
    }

    const step = mkInput('tmShadowArmyBotStepDelay', 'Step ms', getStepDelayMs());
    step.input.addEventListener('change', () => {
      setNum(LS.stepDelayMs, step.input.value);
      renderPanel();
    });

    const wait = mkInput('tmShadowArmyBotWaitAfter', 'Wait ms', getWaitAfterAssignMs());
    wait.input.addEventListener('change', () => {
      setNum(LS.waitAfterAssignMs, wait.input.value);
      renderPanel();
    });

    const ref = mkInput('tmShadowArmyBotRefresh', 'Refresh ms', getListRefreshMs());
    ref.input.addEventListener('change', () => {
      setNum(LS.listRefreshMs, ref.input.value);
      renderPanel();
    });

    cfg.appendChild(step.wrap);
    cfg.appendChild(wait.wrap);
    cfg.appendChild(ref.wrap);

    const log = document.createElement('textarea');
    log.id = 'tmShadowArmyBotLog';
    log.readOnly = true;
    log.spellcheck = false;
    log.placeholder = 'Logs...';
    Object.assign(log.style, {
      width: '100%',
      height: '170px',
      resize: 'vertical',
      padding: '8px 10px',
      borderRadius: '10px',
      border: '1px solid rgba(255,255,255,0.10)',
      background: 'rgba(0,0,0,0.22)',
      color: '#e6e9ff',
      fontFamily: 'Consolas, monospace',
      fontSize: '11px',
      lineHeight: '1.35'
    });

    panel.appendChild(row1);
    panel.appendChild(status);
    panel.appendChild(hint);
    panel.appendChild(cfg);
    panel.appendChild(log);
    document.body.appendChild(panel);
  }

  function findTopEnterBattleLink() {
    // Heuristic selectors: support a range of layouts without hardcoding exact classes.
    const candidates = [];

    document.querySelectorAll('a[href*="shadow_army_live_battle.php?battle_id="]').forEach((a) => candidates.push(a));
    document.querySelectorAll('a[href*="shadow_army_live_battle.php"][href*="battle_id="]').forEach((a) => candidates.push(a));

    // Prefer links/buttons that look like "Enter" (started by someone else).
    const scored = Array.from(new Set(candidates))
      .map((a) => {
        const t = String(a.textContent || '').toLowerCase();
        let score = 0;
        if (t.includes('enter')) score += 5;
        if (t.includes('re-enter')) score += 6;
        if (t.includes('join')) score += 2;
        return { a, score };
      })
      .sort((x, y) => y.score - x.score);

    return scored.length ? scored[0].a : null;
  }

  function findJoinButton() {
    return document.getElementById('joinBattleBtn')
      || Array.from(document.querySelectorAll('button')).find((b) => /enter your army|join with my army/i.test(b.textContent || ''))
      || null;
  }

  function findMyCaptainId() {
    const mine = document.querySelector('.captain.ally.mine[data-captain-id]');
    if (mine) return String(mine.getAttribute('data-captain-id') || '').trim();
    return '';
  }

  function findEnemyCaptainId() {
    const enemy = document.querySelector('.captain.enemy[data-captain-id]');
    if (enemy) return String(enemy.getAttribute('data-captain-id') || '').trim();
    return '';
  }

  function findBackLink() {
    const a = document.querySelector('a[href*="shadow_army.php"]');
    return a ? a.href : 'shadow_army.php';
  }

  async function postBattleAction(action, extra) {
    const body = new URLSearchParams({ action, ...(extra || {}) });
    const res = await fetch('shadow_army_live_battle.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      credentials: 'same-origin',
      body: body.toString()
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json || !json.ok) {
      const msg = (json && (json.message || json.error)) ? (json.message || json.error) : `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return json;
  }

  async function joinBattleIfNeeded(battleId) {
    const joinBtn = findJoinButton();
    if (!joinBtn) {
      return false;
    }
    const style = window.getComputedStyle(joinBtn);
    if (style && style.display === 'none') {
      return false;
    }
    if (joinBtn.disabled) {
      return false;
    }
    setStatus('Joining with your army...');
    setLastActionAt(Date.now());
    joinBtn.click();
    await sleep(getStepDelayMs());
    return true;
  }

  async function assignOneTarget(battleId) {
    const myId = findMyCaptainId();
    const enemyId = findEnemyCaptainId();
    if (!myId) {
      setStatus('Waiting for your army captain to appear...');
      return false;
    }
    if (!enemyId) {
      setStatus('No enemy captain found to target.');
      return false;
    }
    setStatus(`Assigning target (my ${myId} -> enemy ${enemyId})...`);
    setLastActionAt(Date.now());
    await postBattleAction('assign_target', {
      battle_id: String(battleId),
      attacker_captain_unit_id: String(myId),
      defender_captain_unit_id: String(enemyId)
    });
    await sleep(getStepDelayMs());
    return true;
  }

  async function retreatMyCaptain(battleId) {
    const myId = findMyCaptainId();
    if (!myId) {
      setStatus('No owned captain id found for retreat.');
      return false;
    }
    setStatus(`Retreating captain ${myId}...`);
    setLastActionAt(Date.now());
    await postBattleAction('retreat_captain', {
      battle_id: String(battleId),
      captain_unit_id: String(myId)
    });
    await sleep(getStepDelayMs());
    return true;
  }

  async function tick(force = false) {
    renderPanel();

    if (!isActive() && !force) {
      return;
    }
    if (!force && recentlyActed()) {
      return;
    }

    try {
      if (isListPage()) {
        const last = getNum(LS.lastListRefreshAt, 0);
        const refreshMs = getListRefreshMs();
        const elapsed = Date.now() - last;

        const link = findTopEnterBattleLink();
        if (link) {
          setStatus('Entering the top available army battle...');
          setLastActionAt(Date.now());
          window.location.href = link.href;
          return;
        }

        if (elapsed >= refreshMs) {
          setStatus('No battle found. Refreshing list...');
          setNum(LS.lastListRefreshAt, Date.now());
          setLastActionAt(Date.now());
          window.location.reload();
          return;
        }

        setStatus(`Waiting for next battle... refresh in ${fmtMs(refreshMs - elapsed)}.`);
        return;
      }

      if (isBattlePage()) {
        const bid = battleIdFromUrl();
        if (!bid) {
          setStatus('No battle_id in URL.');
          return;
        }

        // Step 1: join
        const didJoin = await joinBattleIfNeeded(bid);
        if (didJoin) return;

        // Step 2: tag
        const didAssign = await assignOneTarget(bid);
        if (!didAssign) return;

        // Step 3: wait so you can see it, and hopefully tick 1 damage
        const waitMs = getWaitAfterAssignMs();
        if (waitMs > 0) {
          setStatus(`Waiting ${fmtMs(waitMs)} before retreat...`);
          setLastActionAt(Date.now());
          await sleep(waitMs);
        }

        // Step 4: retreat then back out
        await retreatMyCaptain(bid);
        const back = findBackLink();
        setStatus('Returning to Shadow Army home...');
        setLastActionAt(Date.now());
        window.location.href = back;
        return;
      }

      setStatus('Open shadow_army.php or a shadow_army_live_battle.php page.');
    } catch (e) {
      setStatus(`Error: ${e && e.message ? e.message : e}`);
      setLastActionAt(Date.now());
    }
  }

  window.setInterval(() => void tick(false), TICK_MS);
  void tick(false);
})();
