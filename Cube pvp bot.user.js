// ==UserScript==
// @name         Veyra Cube PvP Join Bot
// @namespace    https://demonicscans.org/
// @version      1.0.5
// @description  Joins a cube PvP match every 2 hours, claims a slot, then leaves back to the node list. Rotates nodes when a node has no OPEN matches.
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
  const PENDING_JOIN_KEY = 'tm_cube_pvp_pending_join_v1';
  const NODE_URLS_KEY = 'tm_cube_pvp_node_urls_v1';
  const NODE_INDEX_KEY = 'tm_cube_pvp_node_index_v1';
  const NODE_TITLE_MAP_KEY = 'tm_cube_pvp_node_title_map_v1';
  const JOIN_COOLDOWN_MS = 2 * 60 * 60 * 1000;
  const LOOP_MS = 1500;
  const ACTION_GAP_MS = 1500;
  const PREFERRED_SLOTS = ['5', '4', '3', '2', '1'];
  const SECONDARY_NODE_NAME = 'duel heart';

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

  function getInstanceIdFromUrl() {
    return new URLSearchParams(window.location.search).get('instance_id') || '';
  }

  function getPendingJoin() {
    try {
      const raw = window.localStorage.getItem(PENDING_JOIN_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }
      if (!Number.isFinite(Number(parsed.at))) {
        return null;
      }
      return { at: Number(parsed.at), url: String(parsed.url || '') };
    } catch (_e) {
      return null;
    }
  }

  function setPendingJoin(at, url) {
    try {
      window.localStorage.setItem(PENDING_JOIN_KEY, JSON.stringify({ at: Number(at || 0), url: String(url || '') }));
    } catch (_e) {
      // ignore
    }
  }

  function clearPendingJoin() {
    try {
      window.localStorage.removeItem(PENDING_JOIN_KEY);
    } catch (_e) {
      // ignore
    }
  }

  function getCachedNodeUrls() {
    try {
      const raw = window.localStorage.getItem(NODE_URLS_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed) && parsed.every((v) => typeof v === 'string')) {
        return parsed;
      }
    } catch (_e) {
      // ignore
    }
    return [];
  }

  function setCachedNodeUrls(urls) {
    try {
      window.localStorage.setItem(NODE_URLS_KEY, JSON.stringify(urls || []));
    } catch (_e) {
      // ignore
    }
  }

  function getNodeIndex() {
    return Math.max(0, Number(window.localStorage.getItem(NODE_INDEX_KEY) || 0));
  }

  function setNodeIndex(value) {
    window.localStorage.setItem(NODE_INDEX_KEY, String(Math.max(0, Number(value || 0))));
  }

  function advanceNodeIndex(urls) {
    if (!urls || !urls.length) {
      return 0;
    }
    const next = (getNodeIndex() + 1) % urls.length;
    setNodeIndex(next);
    return next;
  }

  function getNodeTitleMap() {
    try {
      const raw = window.localStorage.getItem(NODE_TITLE_MAP_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch (_e) {
      // ignore
    }
    return {};
  }

  function setNodeTitleMap(next) {
    try {
      window.localStorage.setItem(NODE_TITLE_MAP_KEY, JSON.stringify(next || {}));
    } catch (_e) {
      // ignore
    }
  }

  function rememberCurrentNodeTitle() {
    if (!isCubeNodePage()) {
      return;
    }
    const title = String(document.title || '').trim();
    if (!title) {
      return;
    }
    const map = getNodeTitleMap();
    map[String(window.location.href)] = title;
    setNodeTitleMap(map);
  }

  function findNodeUrlByName(nameLower) {
    const target = String(nameLower || '').toLowerCase();
    if (!target) {
      return '';
    }
    const map = getNodeTitleMap();
    const entries = Object.entries(map);
    for (const [url, title] of entries) {
      if (String(title || '').toLowerCase().includes(target)) {
        return String(url || '');
      }
    }
    return '';
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

  function isCubeMainPage() {
    return /\/guild_dungeon_cube\.php$/i.test(window.location.pathname);
  }

  function getCubeMainUrl() {
    const instanceId = getInstanceIdFromUrl();
    if (instanceId) {
      return `guild_dungeon_cube.php?instance_id=${encodeURIComponent(instanceId)}`;
    }
    return 'guild_dungeon_cube.php';
  }

  function collectNodeUrlsFromPage() {
    const links = Array.from(document.querySelectorAll('a[href*="pvp_style_node.php"][href*="source=cube"]'));
    const urls = links.map((a) => a.href).filter(Boolean);
    const uniq = Array.from(new Set(urls));
    // Prefer stable ordering by node_id if present.
    uniq.sort((a, b) => {
      const pa = new URL(a, window.location.href);
      const pb = new URL(b, window.location.href);
      const na = Number(pa.searchParams.get('node_id') || 0);
      const nb = Number(pb.searchParams.get('node_id') || 0);
      return na - nb;
    });
    return uniq;
  }

  function getNodeBackUrl() {
    const back = document.querySelector('a.back-btn[href*="pvp_style_node.php"]');
    return back ? back.href : '';
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
    const badge = document.getElementById('matchStatusBadge');
    if (badge && /live/i.test(badge.textContent || '')) {
      return true;
    }
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

  function handleMainPage() {
    const urls = collectNodeUrlsFromPage();
    if (urls.length) {
      setCachedNodeUrls(urls);
    }

    const cached = urls.length ? urls : getCachedNodeUrls();
    if (!cached.length) {
      setStatus('Open a cube PvP node list so I can learn the node URLs.');
      scheduleNext(LOOP_MS);
      return;
    }

    const idx = Math.min(getNodeIndex(), cached.length - 1);
    goTo(cached[idx], `Opening cube PvP node ${idx + 1}/${cached.length}...`);
  }

  function rotateToNextNode(reasonText) {
    const urls = getCachedNodeUrls();
    if (!urls.length) {
      const mainUrl = getCubeMainUrl();
      goTo(mainUrl, 'No cached cube PvP nodes. Returning to cube page...');
      return true;
    }

    // Prefer switching to the "Duel Heart" node (same cube) when present.
    // This matches the user's desired "second area" rotation behavior.
    const duelHeartUrl = findNodeUrlByName(SECONDARY_NODE_NAME);
    const currentTitle = String(document.title || '').toLowerCase();
    const onDuelHeart = currentTitle.includes(SECONDARY_NODE_NAME);
    if (!onDuelHeart && duelHeartUrl) {
      goTo(duelHeartUrl, reasonText || 'No OPEN matches here. Switching to Duel Heart...');
      return true;
    }

    const idx = advanceNodeIndex(urls);
    const nextUrl = urls[idx];
    goTo(nextUrl, reasonText || `Rotating to next cube PvP node (${idx + 1}/${urls.length})...`);
    return true;
  }

  async function handleNodePage() {
    rememberCurrentNodeTitle();

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

    rotateToNextNode('No OPEN matches in this node. Rotating to the next node...');
  }

  async function handleBattlePage() {
    if (roomIsOver()) {
      const leaveBtn = document.getElementById('leaveRoomBtn');
      if (leaveBtn && !leaveBtn.disabled) {
        if (clickAndPause(leaveBtn, 'Room resolved. Leaving match...')) {
          return;
        }
      }
      const backUrl = getNodeBackUrl();
      if (backUrl) {
        goTo(backUrl, 'Room resolved. Heading back to cube PvP list...');
        return;
      }
    }

    if (hasJoinedRoom()) {
      const pending = getPendingJoin();
      if (pending && pending.at && pending.url) {
        setLastJoinAt(pending.at);
        clearPendingJoin();
      } else if (!getLastJoinAt()) {
        setLastJoinAt(Date.now());
      }

      const leaveBtn = document.getElementById('leaveRoomBtn');
      if (leaveBtn && !leaveBtn.disabled) {
        if (clickAndPause(leaveBtn, 'Slot claimed. Leaving back to node list...')) {
          return;
        }
      }

      const backUrl = getNodeBackUrl();
      if (backUrl) {
        goTo(backUrl, 'Slot claimed. Returning to node list...');
        return;
      }

      setStatus('Slot claimed. Waiting for navigation...');
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
        setPendingJoin(Date.now(), window.location.href);
        return;
      }
    }

    const joinBtn = document.getElementById('joinRoomBtn');
    if (joinBtn && !joinBtn.disabled) {
      if (clickAndPause(joinBtn, 'Joining cube PvP room...')) {
        setPendingJoin(Date.now(), window.location.href);
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

      if (isCubeMainPage()) {
        handleMainPage();
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
