// ==UserScript==
// @name         Veyra Cube PvP Join Bot
// @namespace    https://demonicscans.org/
// @version      1.0.2
// @description  Auto joins cube PvP rooms using the node lock timer, with a 2 hour fallback cooldown.
// @match        https://demonicscans.org/guild_dungeon_cube.php*
// @match        https://demonicscans.org/pvp_style_node.php*
// @match        https://demonicscans.org/pvp_style_battle.php*
// @homepageURL  https://github.com/nobody65321/VeyraPersonalAddons
// @updateURL    https://raw.githubusercontent.com/nobody65321/VeyraPersonalAddons/main/Cube%20pvp%20bot.user.js
// @downloadURL  https://raw.githubusercontent.com/nobody65321/VeyraPersonalAddons/main/Cube%20pvp%20bot.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const ACTIVE_KEY = 'tm_cube_pvp_bot_active';
  const LAST_JOIN_KEY = 'tm_cube_pvp_last_join_at';
  const JOIN_COOLDOWN_MS = 2 * 60 * 60 * 1000;
  const LOOP_MS = 1500;
  const ACTION_GAP_MS = 1500;
  const PREFERRED_SLOTS = ['5', '4', '3', '2', '1'];

  let timerId = 0;

  function isActive() {
    return window.localStorage.getItem(ACTIVE_KEY) === 'true';
  }

  function setActive(value) {
    window.localStorage.setItem(ACTIVE_KEY, value ? 'true' : 'false');
  }

  function getLastJoinAt() {
    return Number(window.localStorage.getItem(LAST_JOIN_KEY) || 0);
  }

  function setLastJoinAt(value) {
    window.localStorage.setItem(LAST_JOIN_KEY, String(value));
  }

  function timeUntilNextJoin() {
    const remaining = (getLastJoinAt() + JOIN_COOLDOWN_MS) - Date.now();
    return Math.max(0, remaining);
  }

  function formatMs(ms) {
    const totalSeconds = Math.ceil(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
    }
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  }

  function parseLockWarningMs() {
    const warnings = Array.from(document.querySelectorAll('.warn'));
    const warning = warnings.find((node) => /locked to another match in this node/i.test(node.textContent || ''));
    if (!warning) {
      return null;
    }

    const text = String(warning.textContent || '');
    const match = text.match(/(\d{1,2}):(\d{2}):(\d{2})/);
    if (!match) {
      return null;
    }

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);
    return (((hours * 60) + minutes) * 60 + seconds) * 1000;
  }

  function setStatus(text) {
    const status = document.getElementById('tmCubePvpBotStatus');
    if (status) {
      status.textContent = text;
    }
    console.log('[Cube PvP Bot]', text);
  }

  function renderPanel() {
    if (document.getElementById('tmCubePvpBotPanel')) {
      const button = document.getElementById('tmCubePvpBotToggle');
      if (button) {
        button.textContent = isActive() ? 'Cube Bot ON' : 'Cube Bot OFF';
        button.style.background = isActive() ? '#1f9d63' : '#963838';
      }
      return;
    }

    const panel = document.createElement('div');
    panel.id = 'tmCubePvpBotPanel';
    Object.assign(panel.style, {
      position: 'fixed',
      top: '132px',
      right: '10px',
      zIndex: '99999',
      minWidth: '210px',
      padding: '10px',
      borderRadius: '10px',
      background: 'rgba(14,18,26,0.94)',
      border: '1px solid rgba(124,255,184,0.28)',
      boxShadow: '0 12px 28px rgba(0,0,0,0.35)',
      color: '#e6e9ff',
      fontSize: '12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px'
    });

    const button = document.createElement('button');
    button.id = 'tmCubePvpBotToggle';
    button.type = 'button';
    button.textContent = isActive() ? 'Cube Bot ON' : 'Cube Bot OFF';
    Object.assign(button.style, {
      padding: '8px 10px',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      color: '#fff',
      fontWeight: '700',
      background: isActive() ? '#1f9d63' : '#963838'
    });
    button.addEventListener('click', () => {
      setActive(!isActive());
      renderPanel();
      setStatus(isActive() ? 'Cube join bot enabled.' : 'Cube join bot idle.');
    });

    const status = document.createElement('div');
    status.id = 'tmCubePvpBotStatus';
    status.style.lineHeight = '1.35';
    status.style.color = '#c7cbdf';
    status.textContent = isActive() ? 'Watching cube PvP...' : 'Cube join bot idle.';

    panel.appendChild(button);
    panel.appendChild(status);
    document.body.appendChild(panel);
  }

  function scheduleNext(ms = LOOP_MS) {
    window.clearTimeout(timerId);
    timerId = window.setTimeout(runTick, ms);
  }

  function clickAndPause(element, statusText, pauseMs = ACTION_GAP_MS) {
    if (!element || element.disabled) {
      return false;
    }
    setStatus(statusText);
    element.click();
    scheduleNext(pauseMs);
    return true;
  }

  function goTo(url, statusText, pauseMs = ACTION_GAP_MS) {
    if (!url) {
      return false;
    }
    setStatus(statusText);
    scheduleNext(pauseMs);
    window.location.href = url;
    return true;
  }

  function isCubeNodePage() {
    return /\/pvp_style_node\.php$/i.test(window.location.pathname) && new URLSearchParams(window.location.search).get('source') === 'cube';
  }

  function isCubeBattlePage() {
    return /\/pvp_style_battle\.php$/i.test(window.location.pathname) && new URLSearchParams(window.location.search).get('source') === 'cube';
  }

  function getNodeBackUrl() {
    const back = document.querySelector('a.back-btn[href*="pvp_style_node.php"]');
    return back ? back.href : '';
  }

  function getJoinedMatchLink() {
    const cards = Array.from(document.querySelectorAll('.match'));
    for (const card of cards) {
      if (!/your slot/i.test(card.textContent || '')) {
        continue;
      }
      const link = card.querySelector('a.btn[href*="pvp_style_battle.php"]');
      if (link) {
        return link.href;
      }
    }
    return '';
  }

  function parseSlotCount(card) {
    const meta = card.querySelector('.meta');
    const text = meta ? meta.textContent || '' : '';
    const match = text.match(/Slots\s+(\d+)\s*\/\s*(\d+)/i);
    if (!match) {
      return null;
    }
    return {
      used: Number(match[1]),
      total: Number(match[2])
    };
  }

  function getOpenMatchLink() {
    const cards = Array.from(document.querySelectorAll('.match'));
    for (const card of cards) {
      const openBadge = card.querySelector('.badge.open');
      if (!openBadge) {
        continue;
      }
      const slotCount = parseSlotCount(card);
      if (slotCount && slotCount.used >= slotCount.total) {
        continue;
      }
      const link = card.querySelector('a.btn[href*="pvp_style_battle.php"]');
      if (link) {
        return link.href;
      }
    }
    return '';
  }

  function hasJoinedRoom() {
    return !!document.getElementById('leaveRoomBtn') || /your current slot/i.test(document.body.textContent || '');
  }

  function roomIsOver() {
    const badge = document.getElementById('matchStatusBadge');
    return !!badge && /victory|defeat|cleared|draw/i.test(badge.textContent || '');
  }

  function roomIsLive() {
    const note = document.getElementById('noteText');
    return /live|enemy turn|your turn/i.test((note && note.textContent) || '');
  }

  function getClaimableSlot() {
    const slots = Array.from(document.querySelectorAll('#bottomTeamCard .pSlot.joinable, #bottomTeamCard .pSlot'));
    const sorted = slots
      .filter((slot) => {
        const userId = String(slot.dataset.userId || '0');
        const key = String(slot.dataset.key || '');
        return !key && userId === '0';
      })
      .sort((a, b) => PREFERRED_SLOTS.indexOf(String(a.dataset.slot || '99')) - PREFERRED_SLOTS.indexOf(String(b.dataset.slot || '99')));
    return sorted[0] || null;
  }

  async function handleNodePage() {
    const joinedLink = getJoinedMatchLink();
    if (joinedLink) {
      goTo(joinedLink, 'Re-entering your joined cube match...');
      return;
    }

    const lockWarningMs = parseLockWarningMs();
    if (lockWarningMs !== null && lockWarningMs > 0) {
      setStatus(`Node lock active for ${formatMs(lockWarningMs)}.`);
      scheduleNext(Math.min(LOOP_MS, 1000));
      return;
    }

    const waitMs = timeUntilNextJoin();
    if (waitMs > 0) {
      setStatus(`Fallback join cooldown: ${formatMs(waitMs)}.`);
      scheduleNext(LOOP_MS);
      return;
    }

    const openLink = getOpenMatchLink();
    if (openLink) {
      goTo(openLink, 'Opening the next available cube PvP room...');
      return;
    }

    setStatus('No open cube PvP room found yet.');
    scheduleNext(LOOP_MS);
  }

  async function handleBattlePage() {
    if (roomIsOver()) {
      const backUrl = getNodeBackUrl();
      if (backUrl) {
        goTo(backUrl, 'Room resolved, heading back to cube PvP list...');
        return;
      }
    }

    if (hasJoinedRoom()) {
      if (timeUntilNextJoin() <= 0) {
        setLastJoinAt(Date.now());
      }
      setStatus(roomIsLive() ? 'Joined cube room and waiting for battle flow.' : 'Joined cube room and holding your slot.');
      scheduleNext(LOOP_MS);
      return;
    }

    const waitMs = timeUntilNextJoin();
    if (waitMs > 0) {
      const backUrl = getNodeBackUrl();
      if (backUrl) {
        goTo(backUrl, `Join cooldown active for ${formatMs(waitMs)}. Returning to room list...`);
        return;
      }
      setStatus(`Join cooldown active for ${formatMs(waitMs)}.`);
      scheduleNext(LOOP_MS);
      return;
    }

    const claimableSlot = getClaimableSlot();
    if (claimableSlot) {
      if (clickAndPause(claimableSlot, `Claiming cube slot ${claimableSlot.dataset.slot || '?' }...`)) {
        return;
      }
    }

    const joinBtn = document.getElementById('joinRoomBtn');
    if (joinBtn && !joinBtn.disabled) {
      setLastJoinAt(Date.now());
      if (clickAndPause(joinBtn, 'Joining cube PvP room...')) {
        return;
      }
    }

    setStatus('Waiting for a free cube slot or join button...');
    scheduleNext(LOOP_MS);
  }

  async function runTick() {
    renderPanel();

    if (!isActive()) {
      setStatus('Cube join bot idle.');
      scheduleNext(LOOP_MS);
      return;
    }

    try {
      if (isCubeNodePage()) {
        await handleNodePage();
        return;
      }

      if (isCubeBattlePage()) {
        await handleBattlePage();
        return;
      }

      setStatus('Open a cube PvP page to use this bot.');
    } catch (error) {
      console.error('[Cube PvP Bot]', error);
      setStatus(`Error: ${error.message || error}`);
    }

    scheduleNext(LOOP_MS);
  }

  renderPanel();
  scheduleNext(250);
})();
