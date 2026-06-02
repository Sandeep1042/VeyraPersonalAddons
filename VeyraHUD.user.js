// ==UserScript==
// @name         Veyra HUD (All-in-One)
// @namespace    https://demonicscans.org/
// @version      3.18
// @description  All-in-one userscript: Emberfall Quest/Drops Helper, Graveyard multi-loot, Shadowbridge monster board, Cube intro skipper, Solo PvP bot.
// @icon         https://github.com/nobody65321/VeyraPersonalAddons/raw/refs/heads/main/VeyraHUD.icon.png
// @match        *://demonicscans.org/*
// @match        *://www.demonicscans.org/*
// @homepageURL  https://github.com/nobody65321/VeyraPersonalAddons
// @updateURL    https://github.com/nobody65321/VeyraPersonalAddons/raw/refs/heads/main/VeyraHUD.user.js
// @downloadURL  https://github.com/nobody65321/VeyraPersonalAddons/raw/refs/heads/main/VeyraHUD.user.js
// @grant        none
// @run-at       document-start
// ==/UserScript==

/*
  Combined script generated locally from:
  - cube-intro-skipper.user.js
  - Event.user.js
  - Graveyard.user.js
  - shadowbridge-warrens-monsters.user.js
  - demonicscans-pvp.user.js

  Intentionally excluded:
  - Any guild-dungeon instance scripts
  - temp-world-breaker.user.js (experimental/server-test)
*/

(function(){
  'use strict';
  try {
    window.__VEYRA_HUD_AIO__ = {
      name: 'Veyra HUD (All-in-One)',
      version: '3.17',
      builtAt: new Date().toISOString()
    };
    try { document.documentElement.dataset.veyrahudAioVersion = '3.17'; } catch (e) {}
    console.log('[VeyraHUD AIO] loaded v3.17');
  } catch (e) {
    // ignore
  }
})();

// ============================================================
// Module: Cube Intro Skipper (cube-intro-skipper.user.js)
// Loaded before the rest of the AIO so the cube intro can be hidden before first paint.
// ============================================================

(function () {
  'use strict';

  const path = String(window.location.pathname || '');
  const IS_CUBE_ENTER_PAGE = /\/guild_dungeon_enter\.php$/i.test(path);
  if (!IS_CUBE_ENTER_PAGE) return;

  const SETTING_KEY = 'tm_cube_auto_skip_intro_v3';
  const STYLE_ID = 'tmCubeIntroSkipperStyles';
  const RELOAD_FLAG_PREFIX = 'tm_cube_intro_pre_dismissed_';

  let dismissing = false;
  let observer = null;

  function readEnabled() {
    try {
      const raw = window.localStorage.getItem(SETTING_KEY);
      return raw === null ? true : raw === 'true';
    } catch (_error) {
      return true;
    }
  }

  function writeEnabled(value) {
    try {
      window.localStorage.setItem(SETTING_KEY, value ? 'true' : 'false');
    } catch (_error) {
      // ignore storage failures
    }
  }

  function ensureStyles() {
    if (!readEnabled() || document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #introOverlay.isOpen,
      #briefOverlay.isOpen {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function syncStyles() {
    const style = document.getElementById(STYLE_ID);
    if (readEnabled()) ensureStyles();
    else if (style) style.remove();
  }

  function getInstanceId() {
    const fromGlobal = Number(window.INSTANCE_ID || 0);
    if (Number.isFinite(fromGlobal) && fromGlobal > 0) return String(fromGlobal);

    try {
      const fromUrl = new URLSearchParams(window.location.search).get('id');
      const n = Number(fromUrl || 0);
      if (Number.isFinite(n) && n > 0) return String(n);
    } catch (_error) {
      // ignore bad URL parsing
    }

    const refresh = document.querySelector('button[onclick*="guild_dungeon_enter.php?id="]');
    const onclick = String(refresh?.getAttribute('onclick') || '');
    const match = onclick.match(/guild_dungeon_enter\.php\?id=(\d+)/i);
    return match ? match[1] : '';
  }

  function pageLooksLikeCube() {
    if (document.getElementById('introOverlay') || document.getElementById('briefOverlay')) return true;
    if (window.INSTANCE_ID && window.STATE && window.FACE_DATA) return true;
    return /polyhedral crucible|cube instance/i.test(String(document.title || ''));
  }

  function introNeedsDismissal() {
    if (window.STATE && window.STATE.intro_seen === false) return true;
    return !!(
      document.getElementById('introOverlay')?.classList.contains('isOpen') ||
      document.getElementById('briefOverlay')?.classList.contains('isOpen')
    );
  }

  async function postDismissIntro(instanceId) {
    const fd = new FormData();
    fd.append('action', 'dismiss_intro');
    fd.append('instance_id', String(instanceId));
    fd.append('node_id', String(window.STATE?.selected_node_id || window.STATE?.entry_node_id || 1));

    const res = await fetch('guild_dungeon_cube_action.php', {
      method: 'POST',
      body: fd,
      credentials: 'same-origin'
    });
    const data = await res.json().catch(() => null);
    return !!(res.ok && data && data.ok);
  }

  async function runSkipper() {
    if (dismissing || !readEnabled() || !pageLooksLikeCube() || !introNeedsDismissal()) return;
    syncStyles();

    const instanceId = getInstanceId();
    if (!instanceId) return;

    const reloadFlag = RELOAD_FLAG_PREFIX + instanceId;
    if (window.sessionStorage.getItem(reloadFlag) === '1') return;

    dismissing = true;
    try {
      const ok = await postDismissIntro(instanceId);
      if (!ok) return;
      window.sessionStorage.setItem(reloadFlag, '1');
      window.location.reload();
    } catch (_error) {
      // If the server endpoint fails, leave the normal cube intro alone.
    } finally {
      dismissing = false;
      syncStyles();
    }
  }

  function addSettingsToggle() {
    const container = document.getElementById('settingsDrawerContainer');
    if (!container || document.getElementById('tmCubeAutoSkipIntroSetting')) return;

    const group = document.createElement('div');
    group.className = 'settings-group';
    group.id = 'tmCubeAutoSkipIntroSetting';
    group.style.cssText = 'display:flex;flex-direction:column;gap:6px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.1);';

    const title = document.createElement('div');
    title.textContent = 'Cube';
    title.style.cssText = 'font-weight:700;font-size:14px;';

    const subtitle = document.createElement('div');
    subtitle.textContent = 'Polyhedral Crucible helpers';
    subtitle.style.cssText = 'font-size:12px;opacity:.7;';

    const label = document.createElement('label');
    label.className = 'settings-input switch-label';
    label.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer;margin-top:6px;';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = readEnabled();
    input.id = 'ui-improvements:autoSkipCubeIntro';
    input.setAttribute('data-setting-key', 'ui-improvements:autoSkipCubeIntro');

    const slider = document.createElement('span');
    slider.className = 'slider';

    const text = document.createElement('span');
    text.textContent = 'Auto-dismiss Cube intro';

    input.addEventListener('change', () => {
      writeEnabled(input.checked);
      syncStyles();
      if (input.checked) window.setTimeout(runSkipper, 50);
    });

    label.appendChild(input);
    label.appendChild(slider);
    label.appendChild(text);
    group.appendChild(title);
    group.appendChild(subtitle);
    group.appendChild(label);
    container.appendChild(group);
  }

  function watchPage() {
    if (observer) observer.disconnect();
    observer = new MutationObserver(() => {
      addSettingsToggle();
      syncStyles();
      runSkipper();
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'aria-hidden']
    });
  }

  function init() {
    syncStyles();
    addSettingsToggle();
    watchPage();
    runSkipper();
    window.setTimeout(runSkipper, 150);
    window.setTimeout(runSkipper, 500);
    window.setTimeout(runSkipper, 1200);
  }

  syncStyles();
  watchPage();
  runSkipper();

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();


// ---- One-time update notification (shows once per version) ----
(function(){
  'use strict';

  const VERSION = '3.17';
  const LS_KEY = 'tm_veyrahud_seen_version_v1';

  const CHANGELOG = {
    '0.3.42': {
      date: '2026-05-02',
      changes: [
        'Wave 3: moved the native Wave Multi Targets hide/show logic into the real Graveyard source module so AIO rebuilds keep the dead/unclaimed-view behavior.'
      ]
    },
    '0.3.40': {
      date: '2026-05-02',
      changes: [
        'Wave 3: simplify dead/unclaimed detection to the page-state button text (Show Alive monsters), so the native Wave Multi Targets panel hides consistently on that view.'
      ]
    },
    '0.3.39': {
      date: '2026-05-02',
      changes: [
        'Wave 3: hide the native Wave Multi Targets panel (#waveQolPanel) on the dead/unclaimed view and restore it on the alive view.'
      ]
    },
    '0.3.38': {
      date: '2026-05-02',
      changes: [
        'Wave / Graveyard: added direct alive/unclaimed toggle detection plus a light resync loop so the wave multi-select controls settle correctly even after refreshes into the dead/unclaimed view.'
      ]
    },
    '0.3.37': {
      date: '2026-05-02',
      changes: [
        'Wave / Graveyard: the wave multi-select controls now follow the actual alive-vs-unclaimed toggle state instead of just checking whether alive cards still exist elsewhere in the DOM.'
      ]
    },
    '0.3.36': {
      date: '2026-04-30',
      changes: [
        'Wave / Graveyard: the wave multi-select controls now stay visible only when alive monsters with HP are on screen.',
        'Those controls are hidden on the unclaimed/dead monster view.'
      ]
    },
    '0.3.35': {
      date: '2026-04-28',
      changes: [
        'Cube: switched the intro skipper to server-dismiss the intro through guild_dungeon_cube_action.php, then reload cleanly.'
      ]
    },
    '0.3.34': {
      date: '2026-04-28',
      changes: [
        'Cube: resets the auto-skip setting key so the fixed skipper defaults on even if an earlier test saved it off.'
      ]
    },
    '0.3.33': {
      date: '2026-04-28',
      changes: [
        'Cube: hide CSS no longer depends on an early html class that the page parser can overwrite, and hidden intro buttons are clicked programmatically.'
      ]
    },
    '0.3.32': {
      date: '2026-04-28',
      changes: [
        'Cube: marks cube enter pages for intro hiding immediately from the URL, before the overlay/title/global state exists.'
      ]
    },
    '0.3.31': {
      date: '2026-04-28',
      changes: [
        'Cube: loads the intro skipper at the very top of the AIO before update/changelog code.'
      ]
    },
    '0.3.30': {
      date: '2026-04-28',
      changes: [
        'Cube: the AIO now runs at document-start and loads the intro skipper first so the intro overlay is hidden before first paint.'
      ]
    },
    '0.3.29': {
      date: '2026-04-28',
      changes: [
        'Cube: hides the intro and briefing overlays while auto-skipping so they do not visibly pop up first.'
      ]
    },
    '0.3.28': {
      date: '2026-04-28',
      changes: [
        'Cube: added an auto-skipper for the Dungeon Creator intro and final Crucible briefing on new cube runs.',
        'Added a Cube setting in the Veyra-HUD settings drawer so the auto-skip can be turned off.'
      ]
    },
    '0.3.27': {
      date: '2026-04-14',
      changes: [
        'Shadowbridge (D1): the expanded monster board panel itself is now height-bounded so it cannot keep stretching the page.',
        'The board content now scrolls inside the panel while the rest of the page keeps its normal layout.'
      ]
    },
    '0.3.26': {
      date: '2026-04-14',
      changes: [
        'Shadowbridge (D1): the monster board now renders below the damage leaderboard instead of between the map and leaderboard.',
        'Removed the board page-scroll lock so expanding the board no longer traps the rest of the page.'
      ]
    },
    '0.3.25': {
      date: '2026-04-14',
      changes: [
        'Shadowbridge (D1): expanding the monster board now opens it as a fixed overlay panel instead of stretching the page layout.',
        'Background page scrolling is locked while the board is open so the leaderboard stays in place.'
      ]
    },
    '0.3.24': {
      date: '2026-04-14',
      changes: [
        'Shadowbridge (D1): the expanded monster board now scrolls inside its own panel instead of stretching the full page.',
        'This keeps the leaderboard and page footer from being pushed far downward when the board is open.'
      ]
    },
    '0.3.23': {
      date: '2026-04-14',
      changes: [
        'Shadowbridge (D1): viewport-fill spacing now only applies while the monster board is collapsed.',
        'Expanding the board lets the page height end naturally instead of forcing extra space below the leaderboard.'
      ]
    },
    '0.3.22': {
      date: '2026-04-14',
      changes: [
        'Shadowbridge (D1): the monster board now starts collapsed so the main map page stays compact until you expand it.',
        'The collapsed/expanded board state is remembered between visits.'
      ]
    },
    '0.3.21': {
      date: '2026-04-14',
      changes: [
        'AIO version bump to publish the D1 viewport-height fix and rebuilt bundle cleanly.',
        'Shadowbridge (D1): html/body/wrap sizing now fills the viewport so the page no longer appears to end at the leaderboard.'
      ]
    },
    '0.3.20': {
      date: '2026-04-14',
      changes: [
        'Synced the AIO builder with the live VeyraHUD template so rebuilds no longer regress the error filter, icon, or recent changelog entries.',
        'Shadowbridge (D1): tightened the map page spacing and reduced repeated board filter DOM lookups.'
      ]
    },
    '0.3.19': {
      date: '2026-04-13',
      changes: [
        'Emberfall drops index: wave mob list now ignores graveyard (dead) cards so mobs donâ€™t show twice.',
        'Emberfall helper: force-remove any leftover Hide/Show button from older versions.'
      ]
    },
    '0.3.18': {
      date: '2026-04-13',
      changes: [
        'Emberfall helper: removed the Hide/Show (collapse) button; it always renders fully open in the map modal.'
      ]
    },
    '0.3.17': {
      date: '2026-04-13',
      changes: [
        'Graveyard: Select all visible dead now respects Select qty if you typed a number.',
        'Emberfall map: Emberfall Helper HUD button now opens the helper inside the map modal.'
      ]
    },
    '0.3.16': {
      date: '2026-04-13',
      changes: [
        'Graveyard: added Select qty box to auto-check N visible dead monsters for the chosen type.',
        'Emberfall map: moved Emberfall Helper into a top HUD button (between Menu/Overview) and into the map modal UI.'
      ]
    },
    '0.3.15': {
      date: '2026-04-12',
      changes: [
        'AIO error toast now only triggers for actual AIO errors (ignores other userscripts/site errors).',
        'D1 strategy builder: internal stamina total helper no longer depends on a missing global name.',
        'Solo PvP bot no longer prints â€œUnsupported pageâ€¦â€ even if something calls it outside PvP.'
      ]
    },
    '0.3.14': {
      date: '2026-04-11',
      changes: [
        'Fixed D1 strategy builder again (missing helper + removed legacy references).',
        'Solo PvP bot no longer logs anything on non-solo-PvP pages in the AIO.',
        'Added a small CSS safeguard to reduce excess empty space at the bottom of the D1 map page.'
      ]
    },
    '0.3.13': {
      date: '2026-04-11',
      changes: [
        'Fixed D1 strategy builder crash (missing getStrategyTotalStam).',
        'Solo PvP bot now stays completely silent on non-solo-PvP pages when using the AIO.'
      ]
    },
    '0.3.12': {
      date: '2026-04-11',
      changes: [
        'Shadowbridge (D1) strategy builder now matches the Wave Strategy modal more closely: attack picker, strategy order list, and remembered settings.',
        'Damage limit now defaults OFF with value 0, and the selected strategy is remembered.'
      ]
    },
    '0.3.11': {
      date: '2026-04-11',
      changes: [
        'Shadowbridge (D1) multi-target panel now matches the Wave Multi Targets layout (filters row + 1/10/50/100/200 attack buttons + strategy modal).',
        'Added a strategy mode for D1 quick attacks: optional damage-remaining limit, configurable from a settings modal.'
      ]
    },
    '0.3.10': {
      date: '2026-04-11',
      changes: [
        'Shadowbridge (D1) monster board: button colors switched to a muted dungeon-blue theme; cards now hover/feel closer to Wave 3 monster cards.'
      ]
    },
    '0.3.9': {
      date: '2026-04-11',
      changes: [
        'Unified monster card sizing into a single setting (card + icon scale together).',
        'Added a Wave card size selector (Normal/Small/Tiny) styled to match the wave Multi Target buttons.',
        'Shadowbridge (D1) monster board: removed room text and updated UI/buttons/cards to match the Wave 3 look; wired the size selector to the same global size setting.'
      ]
    },
    '0.3.8': {
      date: '2026-04-11',
      changes: [
        'Update popup ordering fixed: newest versions now render at the top.'
      ]
    },
    '0.3.7': {
      date: '2026-04-11',
      changes: [
        'Update popup now shows the full changelog when a new version is installed (still only once per version).'
      ]
    },
    '0.3.6': {
      date: '2026-04-11',
      changes: [
        'Solo PvP bot button is now a clean button-only toggle (no extra status text in the button row).'
      ]
    },
    '0.3.5': {
      date: '2026-04-11',
      changes: [
        'Solo PvP bot UI moved into the PvP page button row (no more floating panel).',
        'Solo PvP bot button uses the PvP page button styling and Wave 3 yellow/orange color.'
      ]
    },
    '0.3.4': {
      date: '2026-04-11',
      changes: [
        'Fixed update popup code so the AIO loads correctly (previous versions could fail with a SyntaxError).'
      ]
    },
    '0.3.3': {
      date: '2026-04-11',
      changes: [
        'Added an AIO load marker + basic error trap to help debug when AIO appears not to run.'
      ]
    },
    '0.3.2': {
      date: '2026-04-11',
      changes: [
        'Replaced Cube PvP module with the normal Solo PvP bot (pvp.php / pvp_battle.php).'
      ]
    },
    '0.3.1': {
      date: '2026-04-11',
      changes: [
        'Added PvP bot to the all-in-one script.'
      ]
    },
    '0.3.0': {
      date: '2026-04-11',
      changes: [
        'Shadowbridge monster board now waits for pins to load (fixes cases where it did not run inside the AIO).',
        'Confirmed: AIO excludes broken dungeon modules.'
      ]
    },
    '0.2.9': {
      date: '2026-04-11',
      changes: [
        'Update popup wording cleaned up.'
      ]
    },
    '0.2.8': {
      date: '2026-04-11',
      changes: [
        'Removed references to excluded modules from the update popup.'
      ]
    },
    '0.2.7': {
      date: '2026-04-11',
      changes: [
        'Removed an excluded bot module from the all-in-one script (kept separate).'
      ]
    },
    '0.2.6': {
      date: '2026-04-11',
      changes: [
        'Removed an excluded bot module from the all-in-one script (kept separate).'
      ]
    },
    '0.2.5': {
      date: '2026-04-11',
      changes: [
        'Added this one-time update popup (shows once per version).',
        'All-in-one script excludes broken dungeon modules.'
      ]
    },
    '0.2.4': {
      date: '2026-04-11',
      changes: [
        'Removed any remaining broken-dungeon related wording and ensured those modules are not merged.'
      ]
    },
    '0.2.3': {
      date: '2026-04-10',
      changes: [
        'Fixed AIO build output so it loads correctly (no literal \\\\n tokens).',
        'Graveyard control text cleaned up; Emberfall helper messaging updated.'
      ]
    }
  };

  function safeGetSeen(){
    try { return String(window.localStorage.getItem(LS_KEY) || '').trim(); }
    catch (e) { return ''; }
  }
  function safeSetSeen(v){
    try { window.localStorage.setItem(LS_KEY, String(v || '')); } catch (e) {}
  }

  function semverParts(v){
    const m = String(v || '').match(/^(\\d+)\\.(\\d+)\\.(\\d+)/);
    if (!m) return null;
    return [Number(m[1]), Number(m[2]), Number(m[3])];
  }

  function showModal(unseenVersions){
    const id = 'tmVeyraHudUpdateModal';
    if (document.getElementById(id)) return;

    const overlay = document.createElement('div');
    overlay.id = id;
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:2147483647',
      'background:rgba(0,0,0,0.78)', 'display:flex',
      'align-items:center', 'justify-content:center', 'padding:14px'
    ].join(';');

    const box = document.createElement('div');
    box.style.cssText = 'width:min(720px, 95vw);max-height:92vh;overflow:auto;background:linear-gradient(180deg, rgba(36,39,62,.96), rgba(21,23,37,.96));border:1px solid rgba(255,255,255,0.12);border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.55);padding:14px 16px;color:#e6e9ff;font-family:Segoe UI,system-ui,Arial,sans-serif;';

    const title = document.createElement('div');
    title.textContent = 'Veyra HUD updated';
    title.style.cssText = 'font-weight:900;font-size:16px;color:#fff;';

    const sub = document.createElement('div');
    sub.textContent = 'Now running v' + VERSION;
    sub.style.cssText = 'margin-top:4px;color:#c7cbdf;';

    const listWrap = document.createElement('div');
    listWrap.style.cssText = 'margin-top:10px;display:flex;flex-direction:column;gap:10px;';

    for (const v of (unseenVersions || [])){
      const entry = CHANGELOG[v];
      if (!entry) continue;

      const card = document.createElement('div');
      card.style.cssText = 'padding:10px;border-radius:12px;border:1px solid rgba(255,255,255,0.10);background:rgba(0,0,0,0.22);';

      const head = document.createElement('div');
      head.style.cssText = 'display:flex;justify-content:space-between;gap:10px;align-items:center;';

      const vEl = document.createElement('div');
      vEl.textContent = 'v' + v;
      vEl.style.cssText = 'font-weight:900;color:#ffd369;';

      const dEl = document.createElement('div');
      dEl.textContent = String(entry.date || '');
      dEl.style.cssText = 'color:#9aa0be;font-size:12px;white-space:nowrap;';

      head.appendChild(vEl);
      head.appendChild(dEl);
      card.appendChild(head);

      if (Array.isArray(entry.changes) && entry.changes.length){
        const ul = document.createElement('ul');
        ul.style.cssText = 'margin:8px 0 0 18px;padding:0;color:#e6e9ff;line-height:1.45;';
        for (const c of entry.changes){
          const li = document.createElement('li');
          li.textContent = String(c);
          ul.appendChild(li);
        }
        card.appendChild(ul);
      }

      listWrap.appendChild(card);
    }

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;justify-content:flex-end;gap:10px;margin-top:14px;flex-wrap:wrap;';

    const btnOk = document.createElement('button');
    btnOk.type = 'button';
    btnOk.textContent = 'Got it';
    btnOk.style.cssText = 'cursor:pointer;border-radius:12px;padding:8px 12px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.08);color:#fff;font-weight:900;';

    btnOk.addEventListener('click', () => {
      safeSetSeen(VERSION);
      overlay.remove();
    });

    actions.appendChild(btnOk);
    box.appendChild(title);
    box.appendChild(sub);
    box.appendChild(listWrap);
    box.appendChild(actions);
    overlay.appendChild(box);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        safeSetSeen(VERSION);
        overlay.remove();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.getElementById(id)) {
        safeSetSeen(VERSION);
        overlay.remove();
      }
    }, { once: true });

    document.body.appendChild(overlay);
  }

  const seen = safeGetSeen();
  if (seen === VERSION) return;

  const known = Object.keys(CHANGELOG);

  function semverCmp(a, b){
    const pa = semverParts(a);
    const pb = semverParts(b);
    if (!pa || !pb) return 0;
    for (let i = 0; i < 3; i++){
      if (pa[i] !== pb[i]) return pa[i] - pb[i];
    }
    return 0;
  }

  // User request: always show full changelog, newest first.
  const toShow = known.slice().sort((a, b) => semverCmp(b, a));

  const run = () => showModal(toShow);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
})();

// ---- Early error trap (helps when AIO seems to do nothing) ----
(function(){
  'use strict';
  const errors = [];

  function looksLikeFromAio(text){
    const t = String(text || '');
    if (!t) return false;
    // Tampermonkey stacks typically contain: userscript.html?name=Veyra-HUD-All-in-One.user.js&id=...
    // Keep this narrow so we don't toast for other userscripts/site errors.
    return (
      t.includes('Veyra-HUD-All-in-One') ||
      t.includes('VeyraHUD.user.js') ||
      t.includes('VeyraHUD AIO')
    );
  }

  function onError(ev){
    try {
      const file = String(ev && ev.filename || '');
      const stack = String(ev && ev.error && ev.error.stack || '');
      if (!looksLikeFromAio(file || stack || '')) return;
      errors.push({
        kind: 'error',
        message: ev && ev.message,
        filename: ev && ev.filename,
        lineno: ev && ev.lineno,
        colno: ev && ev.colno
      });
    } catch (e) {}
  }

  function onRejection(ev){
    try {
      const reason = ev && ev.reason;
      const stack = (reason && typeof reason === 'object' && reason.stack) ? String(reason.stack) : '';
      const msg = (reason && typeof reason === 'object' && reason.message) ? String(reason.message) : String(reason || '');
      const fingerprint = stack || msg;
      if (fingerprint && !looksLikeFromAio(fingerprint)) return;
      errors.push({ kind: 'rejection', reason: msg, stack });
    } catch (e) {}
  }

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);

  window.setTimeout(() => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);

    if (!errors.length) return;

    try { console.warn('[VeyraHUD AIO] errors captured:', errors); } catch (e) {}

    try {
      const id = 'tmVeyraHudAioErrorToast';
      if (document.getElementById(id)) return;
      const toast = document.createElement('div');
      toast.id = id;
      toast.textContent = 'VeyraHUD AIO: script error detected (open DevTools Console)';
      toast.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:2147483647;padding:10px 12px;border-radius:12px;background:rgba(180,40,60,.92);border:1px solid rgba(255,255,255,.14);color:#fff;font-weight:900;font-family:Arial,sans-serif;box-shadow:0 10px 28px rgba(0,0,0,.55);max-width:92vw;';
      document.body.appendChild(toast);
      window.setTimeout(() => toast.remove(), 9000);
    } catch (e) {}
  }, 6000);
})();


// ============================================================
// Module: Emberfall Quest + Drops Helper (Event.user.js)
// ============================================================

(function () {
  'use strict';

  const LS = {
    enabled: 'tm_emberfall_helper_enabled_v1',
    quests: 'tm_emberfall_quests_v1',
    dropsByMob: 'tm_emberfall_drops_by_mob_v1',
    dropsSeedVersion: 'tm_emberfall_drops_seed_version_v1'
  };

  // Seeded from your saved Emberfall battle pages so you don't have to open each mob manually.
  // If you later re-capture drops by visiting a battle page, those live values will be kept.
  const DROPS_SEED_VERSION = '2026-06-02a';
  const DROPS_SEED_COMPACT_JSON =
    `{"black banner footsoldier":{"mobName":"Black Banner Footsoldier","capturedAt":0,"items":[{"name":"Black Banner Scrap","tier":"EPIC","dropPct":60,"dmgReq":5000000,"locked":true},{"name":"Arcane Treat S","tier":"RARE","dropPct":3,"dmgReq":3500000,"locked":true},{"name":"Full Hp Potion","tier":"RARE","dropPct":2,"dmgReq":3500000,"locked":true},{"name":"Mana Potion S","tier":"RARE","dropPct":2,"dmgReq":3500000,"locked":true},{"name":"Small Stamina Potion","tier":"RARE","dropPct":5,"dmgReq":5000000,"locked":true},{"name":"Emberfall Token","tier":"COMMON","dropPct":50,"dmgReq":3000000,"locked":true},{"name":"Last Gate Hood","tier":"COMMON","dropPct":100,"dmgReq":3000000,"locked":true},{"name":"Last Gate Vestment","tier":"COMMON","dropPct":100,"dmgReq":3000000,"locked":true}],"mobKey":"black banner footsoldier"},"ashlance skirmisher":{"mobName":"Ashlance Skirmisher","capturedAt":0,"items":[{"name":"Broken Gate Iron","tier":"EPIC","dropPct":60,"dmgReq":5000000,"locked":true},{"name":"Arcane Treat S","tier":"RARE","dropPct":3,"dmgReq":3500000,"locked":true},{"name":"Full Hp Potion","tier":"RARE","dropPct":2,"dmgReq":3500000,"locked":true},{"name":"Mana Potion S","tier":"RARE","dropPct":2,"dmgReq":3500000,"locked":true},{"name":"Small Stamina Potion","tier":"RARE","dropPct":5,"dmgReq":5000000,"locked":true},{"name":"Emberfall Token","tier":"COMMON","dropPct":50,"dmgReq":3000000,"locked":true},{"name":"Last Gate Handwraps","tier":"COMMON","dropPct":100,"dmgReq":3000000,"locked":true},{"name":"Last Gate Hood","tier":"COMMON","dropPct":100,"dmgReq":3000000,"locked":true}],"mobKey":"ashlance skirmisher"},"iron-grave shieldbearer":{"mobName":"Iron-Grave Shieldbearer","capturedAt":0,"items":[{"name":"Woundseal Cloth","tier":"EPIC","dropPct":60,"dmgReq":5000000,"locked":true},{"name":"Arcane Treat S","tier":"RARE","dropPct":3,"dmgReq":3500000,"locked":true},{"name":"Full Hp Potion","tier":"RARE","dropPct":2,"dmgReq":3500000,"locked":true},{"name":"Mana Potion S","tier":"RARE","dropPct":2,"dmgReq":3500000,"locked":true},{"name":"Small Stamina Potion","tier":"RARE","dropPct":5,"dmgReq":5000000,"locked":true},{"name":"Emberfall Token","tier":"COMMON","dropPct":50,"dmgReq":3000000,"locked":true},{"name":"Last Gate Greaves","tier":"COMMON","dropPct":100,"dmgReq":3000000,"locked":true},{"name":"Last Gate Vestment","tier":"COMMON","dropPct":100,"dmgReq":3000000,"locked":true}],"mobKey":"iron-grave shieldbearer"},"woundchant acolyte":{"mobName":"Woundchant Acolyte","capturedAt":0,"items":[{"name":"White Ash Bandage","tier":"EPIC","dropPct":60,"dmgReq":5000000,"locked":true},{"name":"Arcane Treat S","tier":"RARE","dropPct":3,"dmgReq":3500000,"locked":true},{"name":"Full Hp Potion","tier":"RARE","dropPct":2,"dmgReq":3500000,"locked":true},{"name":"Mana Potion S","tier":"RARE","dropPct":2,"dmgReq":3500000,"locked":true},{"name":"Small Stamina Potion","tier":"RARE","dropPct":5,"dmgReq":5000000,"locked":true},{"name":"Emberfall Token","tier":"COMMON","dropPct":50,"dmgReq":3000000,"locked":true},{"name":"Last Gate Handwraps","tier":"COMMON","dropPct":100,"dmgReq":3000000,"locked":true},{"name":"Last Gate Hood","tier":"COMMON","dropPct":100,"dmgReq":3000000,"locked":true}],"mobKey":"woundchant acolyte"},"siege maw hound":{"mobName":"Siege Maw Hound","capturedAt":0,"items":[{"name":"Siegefang Splinter","tier":"EPIC","dropPct":60,"dmgReq":5000000,"locked":true},{"name":"Arcane Treat S","tier":"RARE","dropPct":3,"dmgReq":3500000,"locked":true},{"name":"Full Hp Potion","tier":"RARE","dropPct":2,"dmgReq":3500000,"locked":true},{"name":"Mana Potion S","tier":"RARE","dropPct":2,"dmgReq":3500000,"locked":true},{"name":"Small Stamina Potion","tier":"RARE","dropPct":5,"dmgReq":5000000,"locked":true},{"name":"Emberfall Token","tier":"COMMON","dropPct":50,"dmgReq":3000000,"locked":true},{"name":"Last Gate Greaves","tier":"COMMON","dropPct":100,"dmgReq":3000000,"locked":true},{"name":"Last Gate Handwraps","tier":"COMMON","dropPct":100,"dmgReq":3000000,"locked":true}],"mobKey":"siege maw hound"},"cinder-tusk warbeast":{"mobName":"Cinder-Tusk Warbeast","capturedAt":0,"items":[{"name":"Hollow Warbone","tier":"EPIC","dropPct":60,"dmgReq":5000000,"locked":true},{"name":"Arcane Treat S","tier":"RARE","dropPct":3,"dmgReq":3500000,"locked":true},{"name":"Full Hp Potion","tier":"RARE","dropPct":2,"dmgReq":3500000,"locked":true},{"name":"Mana Potion S","tier":"RARE","dropPct":2,"dmgReq":3500000,"locked":true},{"name":"Small Stamina Potion","tier":"RARE","dropPct":5,"dmgReq":5000000,"locked":true},{"name":"Emberfall Token","tier":"COMMON","dropPct":50,"dmgReq":3000000,"locked":true},{"name":"Last Gate Greaves","tier":"COMMON","dropPct":100,"dmgReq":3000000,"locked":true},{"name":"Last Gate Vestment","tier":"COMMON","dropPct":100,"dmgReq":3000000,"locked":true}],"mobKey":"cinder-tusk warbeast"},"hollow standard-bearer":{"mobName":"Hollow Standard-Bearer","capturedAt":0,"items":[{"name":"Unfallen Oath Thread","tier":"EPIC","dropPct":60,"dmgReq":5000000,"locked":true},{"name":"Arcane Treat S","tier":"RARE","dropPct":3,"dmgReq":3500000,"locked":true},{"name":"Full Hp Potion","tier":"RARE","dropPct":2,"dmgReq":3500000,"locked":true},{"name":"Mana Potion S","tier":"RARE","dropPct":2,"dmgReq":3500000,"locked":true},{"name":"Small Stamina Potion","tier":"RARE","dropPct":5,"dmgReq":5000000,"locked":true},{"name":"Emberfall Token","tier":"COMMON","dropPct":50,"dmgReq":3000000,"locked":true},{"name":"Last Gate Hood","tier":"COMMON","dropPct":100,"dmgReq":3000000,"locked":true},{"name":"Last Gate Vestment","tier":"COMMON","dropPct":100,"dmgReq":3000000,"locked":true}],"mobKey":"hollow standard-bearer"},"last gate remnant":{"mobName":"Last Gate Remnant","capturedAt":0,"items":[{"name":"Dawnlit Prayer Bead","tier":"EPIC","dropPct":60,"dmgReq":5000000,"locked":true},{"name":"Arcane Treat S","tier":"RARE","dropPct":3,"dmgReq":3500000,"locked":true},{"name":"Full Hp Potion","tier":"RARE","dropPct":2,"dmgReq":3500000,"locked":true},{"name":"Mana Potion S","tier":"RARE","dropPct":2,"dmgReq":3500000,"locked":true},{"name":"Small Stamina Potion","tier":"RARE","dropPct":5,"dmgReq":5000000,"locked":true},{"name":"Emberfall Token","tier":"COMMON","dropPct":50,"dmgReq":3000000,"locked":true},{"name":"Last Gate Greaves","tier":"COMMON","dropPct":100,"dmgReq":3000000,"locked":true},{"name":"Last Gate Hood","tier":"COMMON","dropPct":100,"dmgReq":3000000,"locked":true}],"mobKey":"last gate remnant"},"memory of ten million":{"mobName":"Memory of Ten Million","capturedAt":0,"items":[{"name":"Unfallen Oath Thread","tier":"EPIC","dropPct":100,"dmgReq":5000000,"locked":true},{"name":"Arcane Treat S","tier":"RARE","dropPct":3,"dmgReq":3500000,"locked":true},{"name":"Full Hp Potion","tier":"RARE","dropPct":2,"dmgReq":3500000,"locked":true},{"name":"Mana Potion S","tier":"RARE","dropPct":2,"dmgReq":3500000,"locked":true},{"name":"Small Stamina Potion","tier":"RARE","dropPct":5,"dmgReq":5000000,"locked":true},{"name":"Emberfall Token","tier":"COMMON","dropPct":50,"dmgReq":3000000,"locked":true},{"name":"Last Gate Hood","tier":"COMMON","dropPct":100,"dmgReq":3000000,"locked":true},{"name":"Last Gate Vestment","tier":"COMMON","dropPct":100,"dmgReq":3000000,"locked":true}],"mobKey":"memory of ten million"}}`;

  function isEnabled() {
    const raw = window.localStorage.getItem(LS.enabled);
    return raw === null ? true : raw === 'true';
  }

  function setEnabled(v) {
    window.localStorage.setItem(LS.enabled, v ? 'true' : 'false');
  }

  function safeJsonParse(raw, fallback) {
    try {
      const v = raw ? JSON.parse(raw) : null;
      return v ?? fallback;
    } catch {
      return fallback;
    }
  }

  function loadQuests() {
    return safeJsonParse(window.localStorage.getItem(LS.quests), { updatedAt: 0, quests: [] });
  }

  function saveQuests(payload) {
    try {
      window.localStorage.setItem(LS.quests, JSON.stringify(payload || { updatedAt: Date.now(), quests: [] }));
    } catch {
      // ignore
    }
  }

  function loadDropsByMob() {
    return safeJsonParse(window.localStorage.getItem(LS.dropsByMob), {});
  }

  function saveDropsByMob(next) {
    try {
      window.localStorage.setItem(LS.dropsByMob, JSON.stringify(next || {}));
    } catch {
      // ignore
    }
  }

  function ensureDropsSeedInstalled() {
    // Keep the cache scoped to the current event seed so old event mobs do not linger.
    try {
      const currentSeed = window.localStorage.getItem(LS.dropsSeedVersion) || '';
      if (currentSeed === DROPS_SEED_VERSION) return;

      const seed = safeJsonParse(DROPS_SEED_COMPACT_JSON, null);
      if (!seed || typeof seed !== 'object') return;

      const existing = loadDropsByMob();
      const next = {};

      for (const mobKey of Object.keys(seed)) {
        const current = existing[mobKey];
        const haveItems = Array.isArray(current?.items) && current.items.length;
        next[mobKey] = haveItems ? current : seed[mobKey];
      }

      saveDropsByMob(next);
      window.localStorage.setItem(LS.dropsSeedVersion, DROPS_SEED_VERSION);
    } catch {
      // ignore
    }
  }

  function nowIso() {
    return new Date().toLocaleTimeString();
  }

  function normName(s) {
    return String(s || '').trim().replace(/\s+/g, ' ');
  }

  function normKey(s) {
    return normName(s).toLowerCase();
  }

  // Emberfall has used event ids 7 and 8 before; The Last Dawn uses event id 9.
  const EMBERFALL_EVENT_IDS = new Set(['7', '8', '9']);

  function getSearchParam(name) {
    try {
      return new URLSearchParams(window.location.search).get(name);
    } catch {
      return null;
    }
  }

  function titleLooksEmberfall() {
    const title = String(document.title || '').toLowerCase();
    return title.includes('emberfall') || title.includes('vaelith');
  }

  function pageHasLinkToEmberfallEventPage() {
    const links = Array.from(document.querySelectorAll('a[href]'));
    for (const a of links) {
      const href = String(a.getAttribute('href') || '');
      if (!/event_page\.php\?event=/i.test(href)) continue;
      const m = href.match(/[?&]event=(\d+)/i);
      if (m && EMBERFALL_EVENT_IDS.has(String(m[1]))) return true;
    }
    return false;
  }

  function pageHasBackToEmberfallEventButton() {
    const links = Array.from(document.querySelectorAll('a[href]'));
    for (const a of links) {
      const href = String(a.getAttribute('href') || '');
      if (!/event_page\.php\?event=/i.test(href)) continue;
      const m = href.match(/[?&]event=(\d+)/i);
      if (!m || !EMBERFALL_EVENT_IDS.has(String(m[1]))) continue;
      const text = normName(a.textContent || '').toLowerCase();
      if (text.includes('back') && text.includes('event')) return true;
    }
    return false;
  }

  function pageHasLinkToEmberfallActiveWave() {
    const links = Array.from(document.querySelectorAll('a[href]'));
    for (const a of links) {
      const href = String(a.getAttribute('href') || '');
      if (!/active_wave\.php\?event=/i.test(href)) continue;
      const m = href.match(/[?&]event=(\d+)/i);
      if (m && EMBERFALL_EVENT_IDS.has(String(m[1]))) return true;
    }
    return false;
  }

  function isEmberfallEventPage() {
    if (!/\/event_page\.php$/i.test(window.location.pathname)) return false;

    const ev = getSearchParam('event');
    if (ev && EMBERFALL_EVENT_IDS.has(String(ev))) return true;

    // Best signal: the Emberfall map has this panel.
    if (document.getElementById('questJournalPanel')) return true;
    if (document.querySelector('[id*="quest"][id*="journal"]')) return true;

    // Fallbacks.
    if (titleLooksEmberfall()) return true;
    if (pageHasLinkToEmberfallActiveWave()) return true;

    return false;
  }

  function isActiveWavePage() {
    return /\/active_wave\.php$/i.test(window.location.pathname);
  }

  function isBattlePage() {
    return /\/battle\.php$/i.test(window.location.pathname);
  }

  function isEmberfallActiveWavePage() {
    if (!isActiveWavePage()) return false;

    const ev = getSearchParam('event');
    if (ev && EMBERFALL_EVENT_IDS.has(String(ev))) return true;

    if (titleLooksEmberfall()) return true;
    if (pageHasBackToEmberfallEventButton()) return true; // "Back to Event" button on Emberfall waves

    return false;
  }

  function isEmberfallBattlePage() {
    if (!isBattlePage()) return false;

    const ev = getSearchParam('event');
    if (ev && EMBERFALL_EVENT_IDS.has(String(ev))) return true;

    // Emberfall battle pages include a "Back to event" link pointing to active_wave.php?event=...
    if (pageHasLinkToEmberfallActiveWave()) return true;

    return false;
  }

  function isRelevantPage() {
    if (isEmberfallEventPage()) return true;
    if (isEmberfallActiveWavePage()) return true;
    if (isEmberfallBattlePage()) return true;
    return false;
  }

  function shouldShowPanelUi() {
    // User requested: remove the right-side panel on waves; keep only inline on wave.
    return isEmberfallEventPage();
  }

  function getMonsterNameFromBattlePage() {
    // Works with your newer battle UI: .monster-card .card-title contains "🧟 Name"
    const titleEl =
      document.querySelector('.monster-card .card-title') ||
      document.querySelector('.battle-card.monster-card .card-title') ||
      document.querySelector('h1');
    if (!titleEl) return '';
    // Strip leading emoji/icon and collapse whitespace.
    const raw = normName(titleEl.textContent || '');
    return raw.replace(/^[^A-Za-z0-9]+/, '').trim();
  }

  function parseLootFromBattlePage() {
    const monsterName = getMonsterNameFromBattlePage();
    if (!monsterName) return null;

    const cards = Array.from(document.querySelectorAll('.loot-grid .loot-card'));
    if (!cards.length) return null;

    const items = cards.map((card) => {
      const nameEl = card.querySelector('.loot-name');
      const name = normName(nameEl ? nameEl.textContent : '');
      if (!name) return null;

      const chips = Array.from(card.querySelectorAll('.loot-stats .chip')).map((c) => normName(c.textContent));
      const dropChip = chips.find((t) => /^Drop:/i.test(t)) || '';
      const dmgChip = chips.find((t) => /^DMG req:/i.test(t)) || '';
      const tierChip = chips.find((t) => /^(EPIC|RARE|COMMON|LEGENDARY|MYTHIC)/i.test(t)) || '';

      const dropPct = (() => {
        const m = dropChip.match(/Drop:\s*([0-9.]+)\s*%/i);
        return m ? Number(m[1]) : null;
      })();

      const dmgReq = (() => {
        const m = dmgChip.match(/DMG req:\s*([0-9,]+)/i);
        return m ? Number(String(m[1]).replace(/,/g, '')) : null;
      })();

      const locked = card.classList.contains('locked');
      const tier = tierChip ? tierChip.toUpperCase() : '';

      return { name, tier, dropPct, dmgReq, locked };
    }).filter(Boolean);

    return {
      mobName: monsterName,
      mobKey: normKey(monsterName),
      capturedAt: Date.now(),
      items
    };
  }

  function upsertDrops(payload) {
    if (!payload || !payload.mobKey) return false;
    const all = loadDropsByMob();
    all[payload.mobKey] = payload;
    saveDropsByMob(all);
    return true;
  }

  function parseQuestNeedFromObjective(objectiveText) {
    const text = normName(objectiveText);

    // Collect X x ItemName
    // Example: "Objective: Collect 4 x Memory Ash. Drops in The Last Gate Battlefield."
    const mCollect = text.match(/Collect\s+(\d+)\s*x\s*([^.\n]+)/i);
    if (mCollect) {
      return { kind: 'item', qty: Number(mCollect[1]), name: normName(mCollect[2]) };
    }

    // Defeat X x MobName
    const mDefeat = text.match(/Defeat\s+(\d+)\s*x\s*([^.\n]+)/i);
    if (mDefeat) {
      return { kind: 'mob', qty: Number(mDefeat[1]), name: normName(mDefeat[2]) };
    }

    return null;
  }

  function captureQuestJournalFromEventPage() {
    const panel = document.getElementById('questJournalPanel');
    if (!panel) return { ok: false, reason: 'Quest Journal panel not found.' };

    const objectiveEls = Array.from(panel.querySelectorAll('div'))
      .map((el) => ({ el, text: normName(el.textContent) }))
      .filter(({ text }) => text.startsWith('Objective:'));

    if (!objectiveEls.length) {
      // When all missions are done, the journal can be empty. Clear old cached quests so the tracker shows 0 missions.
      saveQuests({ updatedAt: Date.now(), quests: [] });
      return { ok: true, questsCount: 0, cleared: true, reason: 'No objectives found in Quest Journal.' };
    }

    const quests = [];
    for (const { el, text } of objectiveEls) {
      const block = el.closest('div[style*="padding"]') || el.parentElement;
      const titleEl = block ? block.querySelector('div[style*="font-weight:700"]') : null;
      const typeEl = block ? block.querySelector('.pill') : null;
      const progressEl = block ? Array.from(block.querySelectorAll('div')).find((d) => normName(d.textContent).startsWith('Progress:')) : null;

      const title = titleEl ? normName(titleEl.textContent) : '';
      const type = typeEl ? normName(typeEl.textContent) : '';
      const objective = normName(text.replace(/^Objective:\s*/i, ''));
      const need = parseQuestNeedFromObjective(objective);

      let progress = null;
      if (progressEl) {
        const pm = normName(progressEl.textContent).match(/Progress:\s*([0-9]+)\s*\/\s*([0-9]+)/i);
        if (pm) progress = { have: Number(pm[1]), total: Number(pm[2]) };
      }

      quests.push({ title, type, objective, need, progress });
    }

    const payload = { updatedAt: Date.now(), quests };
    saveQuests(payload);
    return { ok: true, questsCount: quests.length };
  }

  function tryAutoCaptureQuestsOnEventPage() {
    if (!isEnabled()) return false;
    if (!isEmberfallEventPage()) return false;

    const r = captureQuestJournalFromEventPage();
    if (!r.ok) return false;

    // Keep status concise; avoid "failed" noise when it simply cleared to 0.
    if (r.cleared) setStatus('Auto-captured: 0 objectives (cleared).');
    else setStatus(`Auto-captured ${r.questsCount} quests.`);
    return true;
  }

  function autoCaptureQuestsWithRetry(maxMs = 8000, everyMs = 500) {
    if (!isEnabled()) return;
    if (!isEmberfallEventPage()) return;

    const startedAt = Date.now();

    const attempt = () => {
      if (tryAutoCaptureQuestsOnEventPage()) {
        refresh();
        return;
      }
      if (Date.now() - startedAt > maxMs) return;
      window.setTimeout(attempt, everyMs);
    };

    attempt();
  }

  function computeItemSources(itemName) {
    const key = normKey(itemName);
    const dropsByMob = loadDropsByMob();
    const sources = [];

    for (const mobKey of Object.keys(dropsByMob)) {
      const entry = dropsByMob[mobKey];
      const found = (entry.items || []).find((it) => normKey(it.name) === key);
      if (found) {
        sources.push({
          mobName: entry.mobName,
          dropPct: found.dropPct,
          dmgReq: found.dmgReq,
          tier: found.tier,
          locked: !!found.locked
        });
      }
    }

    sources.sort((a, b) => (a.locked === b.locked ? 0 : a.locked ? 1 : -1));
    return sources;
  }

  function buildDropsIndex() {
    const dropsByMob = loadDropsByMob();
    const mobs = Object.values(dropsByMob).sort((a, b) => String(a.mobName).localeCompare(String(b.mobName)));
    return mobs.map((m) => ({
      mobName: m.mobName,
      capturedAt: m.capturedAt,
      items: (m.items || []).slice().sort((a, b) => String(a.tier).localeCompare(String(b.tier)) || String(a.name).localeCompare(String(b.name)))
    }));
  }

  function getMobTypeLinksFromWavePage() {
    if (!isActiveWavePage()) return [];
    // On wave pages, both alive + graveyard (dead) monsters use .monster-card. Drops Index only needs alive.
    const cards = Array.from(document.querySelectorAll('.monster-card[data-monster-id]:not([data-dead="1"])'));
    if (!cards.length) return [];

    const map = new Map(); // mobKey -> { mobName, url }
    for (const card of cards) {
      const mobName =
        normName(card.querySelector('h3')?.textContent) ||
        normName(card.getAttribute('data-name')) ||
        '';
      if (!mobName) continue;

      const a = card.querySelector('a[href*="battle.php?id="]');
      const url = a ? a.href : '';
      if (!url) continue;

      const key = normKey(mobName);
      if (!map.has(key)) map.set(key, { mobName, url });
    }

    return Array.from(map.values()).sort((a, b) => a.mobName.localeCompare(b.mobName));
  }

  function renderPanel() {
    ensureHudButton();

    if (document.getElementById('tmEmberfallHelperPanel')) {
      // Cleanup for old versions that created a collapse button / persisted hidden state.
      try { document.getElementById('tmEmberfallHelperCollapse')?.remove(); } catch {}
      try {
        const body = document.getElementById('tmEmberfallHelperBody');
        if (body) body.style.display = 'block';
      } catch {}

      const toggle = document.getElementById('tmEmberfallHelperToggle');
      if (toggle) {
        toggle.textContent = isEnabled() ? 'Emberfall Helper ON' : 'Emberfall Helper OFF';
        toggle.style.background = isEnabled() ? '#1f9d63' : '#963838';
      }
      return;
    }

    const panel = document.createElement('div');
    panel.id = 'tmEmberfallHelperPanel';
    panel.className = 'panel';
    panel.setAttribute('data-map-section', 'emberfall_helper');
    Object.assign(panel.style, {
      color: '#e6e9ff',
      fontSize: '12px',
      fontFamily: 'Arial, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    });

    const header = document.createElement('div');
    Object.assign(header.style, { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' });

    const title = document.createElement('div');
    title.textContent = 'Emberfall Helper';
    Object.assign(title.style, { fontWeight: '800', color: '#fff' });

    header.appendChild(title);

    const toggle = document.createElement('button');
    toggle.id = 'tmEmberfallHelperToggle';
    toggle.type = 'button';
    toggle.textContent = isEnabled() ? 'Emberfall Helper ON' : 'Emberfall Helper OFF';
    Object.assign(toggle.style, {
      padding: '8px 10px',
      border: 'none',
      borderRadius: '10px',
      cursor: 'pointer',
      color: '#fff',
      fontWeight: '800',
      background: isEnabled() ? '#1f9d63' : '#963838'
    });
    toggle.addEventListener('click', () => {
      setEnabled(!isEnabled());
      toggle.textContent = isEnabled() ? 'Emberfall Helper ON' : 'Emberfall Helper OFF';
      toggle.style.background = isEnabled() ? '#1f9d63' : '#963838';
      const body = document.getElementById('tmEmberfallHelperBody');
      if (body) body.style.opacity = isEnabled() ? '1' : '0.55';
    });

    const body = document.createElement('div');
    body.id = 'tmEmberfallHelperBody';
    body.style.display = 'block';
    body.style.opacity = isEnabled() ? '1' : '0.55';

    const actions = document.createElement('div');
    Object.assign(actions.style, { display: 'flex', gap: '8px', flexWrap: 'wrap' });

    const btnRefresh = document.createElement('button');
    btnRefresh.type = 'button';
    btnRefresh.textContent = 'Refresh Panel';
    Object.assign(btnRefresh.style, {
      padding: '7px 9px',
      borderRadius: '10px',
      border: '1px solid rgba(255,255,255,0.12)',
      background: 'rgba(255,255,255,0.06)',
      color: '#fff',
      cursor: 'pointer',
      fontWeight: '700'
    });
    btnRefresh.addEventListener('click', () => refresh());

    actions.appendChild(btnRefresh);

    const status = document.createElement('div');
    status.id = 'tmEmberfallHelperStatus';
    status.style.color = '#c7cbdf';
    status.style.lineHeight = '1.35';
    status.textContent = 'Ready.';

    const content = document.createElement('div');
    content.id = 'tmEmberfallHelperContent';
    Object.assign(content.style, {
      borderRadius: '10px',
      border: '1px solid rgba(255,255,255,0.08)',
      background: 'rgba(0,0,0,0.20)',
      padding: '8px'
    });

    body.appendChild(toggle);
    body.appendChild(actions);
    body.appendChild(status);
    body.appendChild(content);

    panel.appendChild(header);
    panel.appendChild(body);

    const host = document.getElementById('mapHiddenPanels') || document.body;
    host.appendChild(panel);

    // Auto-capture quests every time you open/refresh the Emberfall map.
    // (Quest Journal can render late, so retry briefly.)
    autoCaptureQuestsWithRetry();
    refresh();
  }

  function ensureHudButton() {
    const hud = document.querySelector('.eventMapHud');
    if (!hud) return;
    if (document.getElementById('tmEmberfallHelperHudBtn')) return;

    const overviewBtn = hud.querySelector('[data-open-section="overview"]');
    const menuBtn = document.getElementById('mapMenuBtn');
    if (!overviewBtn || !menuBtn) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn';
    btn.id = 'tmEmberfallHelperHudBtn';
    btn.textContent = 'Emberfall Helper';
    btn.setAttribute('data-open-section', 'emberfall_helper');

    btn.addEventListener('click', () => {
      // Ensure panel exists, then open it inside the map's existing modal if present.
      renderPanel();
      if (openInMapModal()) return;

      // Fallback: if we can't find the map modal elements, just scroll to the panel host.
      const p = document.getElementById('tmEmberfallHelperPanel');
      if (p && typeof p.scrollIntoView === 'function') p.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });

    // Insert between Menu and Overview.
    hud.insertBefore(btn, overviewBtn);
  }

  function openInMapModal() {
    const overlay = document.getElementById('mapModalOverlay');
    const modalBody = document.getElementById('mapModalBody');
    const modalTitle = document.getElementById('mapModalTitle');
    if (!overlay || !modalBody || !modalTitle) return false;

    const panel = document.getElementById('tmEmberfallHelperPanel');
    if (!panel) return false;

    modalTitle.textContent = 'Emberfall Helper';
    modalBody.innerHTML = '';
    modalBody.appendChild(panel);

    overlay.style.display = 'flex';
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    return true;
  }

  function setStatus(text) {
    const el = document.getElementById('tmEmberfallHelperStatus');
    if (el) el.textContent = `[${nowIso()}] ${text}`;
    console.log('[Emberfall Helper]', text);
  }

  function renderQuestsHtml() {
    const q = loadQuests();
    const dropsByMob = loadDropsByMob();
    const updated = q.updatedAt ? new Date(q.updatedAt).toLocaleString() : 'never';
    const haveDrops = Object.keys(dropsByMob).length;
    const allQuests = Array.isArray(q.quests) ? q.quests : [];
    const activeQuests = allQuests.filter((quest) => {
      const p = quest?.progress;
      if (!p) return true;
      const have = Number(p.have);
      const total = Number(p.total);
      if (!Number.isFinite(have) || !Number.isFinite(total) || total <= 0) return true;
      return have < total;
    });

    const lines = [];
    lines.push(`<div style="font-weight:800;color:#fff;">Quest Journal</div>`);
    lines.push(`<div style="color:#9aa0b8;margin-top:4px;">Quests updated: <strong>${updated}</strong> | Drops known: <strong>${haveDrops}</strong> mobs</div>`);

    if (!activeQuests.length) {
      if (q.updatedAt) {
        lines.push(`<div style="margin-top:8px;color:#c7cbdf;">No active missions.</div>`);
      } else {
        lines.push(`<div style="margin-top:8px;color:#c7cbdf;">No quests captured yet. Open the Emberfall event page and wait a moment (auto-capture runs on load).</div>`);
      }
    }

    // On the wave list page, show which mob types are still missing drop data and give you quick links to open one.
    if (isActiveWavePage()) {
      const mobLinks = getMobTypeLinksFromWavePage();
      if (mobLinks.length) {
        const missing = mobLinks.filter((m) => !dropsByMob[normKey(m.mobName)]);
        lines.push(`<div style="margin-top:10px;font-weight:800;color:#fff;">The Last Gate Battlefield Mobs</div>`);
        lines.push(`<div style="color:#9aa0b8;margin-top:4px;">Mob types: <strong>${mobLinks.length}</strong> | Missing drop data: <strong>${missing.length}</strong></div>`);
        if (missing.length) {
          lines.push(`<div style="margin-top:6px;color:#c7cbdf;line-height:1.4;">Open one of these, then come back and hit <strong>Refresh Panel</strong>:</div>`);
          lines.push(`<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px;">`);
          for (const m of missing.slice(0, 10)) {
            lines.push(
              `<a href="${escapeHtml(m.url)}" style="text-decoration:none;display:inline-flex;align-items:center;gap:6px;padding:6px 8px;border-radius:10px;border:1px solid rgba(255,255,255,0.10);background:rgba(255,255,255,0.04);color:#e6e9ff;">` +
              `${escapeHtml(m.mobName)}` +
              `</a>`
            );
          }
          lines.push(`</div>`);
        }
      }
    }

    if (!activeQuests.length) {
      return lines.join('');
    }

    lines.push(`<div style="margin-top:10px;display:flex;flex-direction:column;gap:8px;">`);
    for (const quest of activeQuests) {
      const title = quest.title || '(untitled)';
      const type = quest.type || '';
      const objective = quest.objective || '';
      const progress = quest.progress ? `${quest.progress.have}/${quest.progress.total}` : '';

      let sourceHtml = '';
      if (quest.need && quest.need.kind === 'item') {
        const sources = computeItemSources(quest.need.name);
        if (sources.length) {
          sourceHtml =
            `<div style="margin-top:6px;color:#cfeccc;">Drops from: ` +
            sources
              .slice(0, 4)
              .map((s) => {
                const pct = (typeof s.dropPct === 'number') ? `${s.dropPct}%` : '?%';
                return `<span style="white-space:nowrap;">${escapeHtml(s.mobName)} (${pct})</span>`;
              })
              .join(', ') +
            (sources.length > 4 ? ` +${sources.length - 4} more` : '') +
            `</div>`;
        } else {
          sourceHtml = `<div style="margin-top:6px;color:#ffb3b3;">No drop sources cached yet. Open a few battles and refresh.</div>`;
        }
      }

      lines.push(
        `<div style="padding:8px;border-radius:10px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);">` +
          `<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">` +
            `<div style="font-weight:800;color:#fff;">${escapeHtml(title)}</div>` +
            `<div style="color:#9aa0b8;white-space:nowrap;">${escapeHtml(type)}${progress ? ` | ${escapeHtml(progress)}` : ''}</div>` +
          `</div>` +
          `<div style="margin-top:4px;color:#ffd369;font-weight:700;line-height:1.35;">${escapeHtml(objective)}</div>` +
          sourceHtml +
        `</div>`
      );
    }
    lines.push(`</div>`);

    lines.push(`<div style="margin-top:10px;font-weight:800;color:#fff;">Drops Index</div>`);
    lines.push(`<div style="margin-top:6px;color:#c7cbdf;">Drops are seeded from your saved mob pages; visiting a battle also refreshes that mob's Possible Loot table.</div>`);

    const idx = buildDropsIndex();
    if (!idx.length) {
      lines.push(`<div style="margin-top:6px;color:#9aa0b8;">No battles captured yet.</div>`);
      return lines.join('');
    }

    lines.push(`<div style="margin-top:8px;max-height:240px;overflow:auto;border-radius:10px;border:1px solid rgba(255,255,255,0.08);">`);
    for (const mob of idx) {
      const items = mob.items.slice(0, 6).map((it) => {
        const pct = (typeof it.dropPct === 'number') ? `${it.dropPct}%` : '?%';
        return `${it.name} (${pct})`;
      }).join(', ');
      lines.push(
        `<div style="padding:8px;border-bottom:1px solid rgba(255,255,255,0.06);">` +
          `<div style="font-weight:800;color:#fff;">${escapeHtml(mob.mobName)}</div>` +
          `<div style="margin-top:4px;color:#9aa0b8;line-height:1.4;">${escapeHtml(items || 'No items')}</div>` +
        `</div>`
      );
    }
    lines.push(`</div>`);

    return lines.join('');
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function refresh() {
    const content = document.getElementById('tmEmberfallHelperContent');
    if (content) content.innerHTML = renderQuestsHtml();

    const inline = document.getElementById('tmEmberfallHelperInline');
    if (inline) inline.innerHTML = renderQuestsInlineHtml();
  }

  function renderQuestsInlineHtml() {
    if (!isEmberfallActiveWavePage()) return '';

    const q = loadQuests();
    const dropsByMob = loadDropsByMob();
    const haveDrops = Object.keys(dropsByMob).length;
    const allQuests = Array.isArray(q.quests) ? q.quests : [];
    const activeQuests = allQuests.filter((quest) => {
      const p = quest?.progress;
      if (!p) return true;
      const have = Number(p.have);
      const total = Number(p.total);
      if (!Number.isFinite(have) || !Number.isFinite(total) || total <= 0) return true;
      return have < total;
    });

    const lines = [];
    lines.push(`<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">`);
    lines.push(`<div style="font-weight:900;color:#fff;">Quest Journal</div>`);
    lines.push(`<div style="color:#9aa0b8;white-space:nowrap;font-size:12px;">Drops known: <strong>${haveDrops}</strong> mobs</div>`);
    lines.push(`</div>`);

    if (!activeQuests.length) {
      if (q.updatedAt) lines.push(`<div style="margin-top:6px;color:#c7cbdf;">No active missions.</div>`);
      else lines.push(`<div style="margin-top:6px;color:#c7cbdf;">No quests captured yet. Open the Emberfall map and wait a moment (auto-capture runs on load).</div>`);
      return lines.join('');
    }

    lines.push(`<div style="margin-top:8px;display:flex;flex-direction:column;gap:8px;">`);
    for (const quest of activeQuests.slice(0, 6)) {
      const objective = quest.objective || '';
      let source = '';
      if (quest.need && quest.need.kind === 'item') {
        const sources = computeItemSources(quest.need.name);
        if (sources.length) {
          source =
            `<div style="margin-top:4px;color:#cfeccc;">Drops: ` +
            sources
              .slice(0, 2)
              .map((s) => escapeHtml(s.mobName))
              .join(', ') +
            (sources.length > 2 ? ` +${sources.length - 2}` : '') +
            `</div>`;
        }
      }

      lines.push(
        `<div style="padding:8px;border-radius:12px;border:1px solid rgba(255,255,255,0.10);background:rgba(20,22,35,0.55);">` +
          `<div style="color:#ffd369;font-weight:800;line-height:1.35;">${escapeHtml(objective)}</div>` +
          source +
        `</div>`
      );
    }
    lines.push(`</div>`);

    return lines.join('');
  }

  function ensureInlineQuestSummary() {
    if (!isEmberfallActiveWavePage()) return;
    if (document.getElementById('tmEmberfallHelperInlineWrap')) return;

    const anchor =
      document.querySelector('.waves-nav') ||
      document.querySelector('.gate-info') ||
      document.querySelector('h1') ||
      document.body.firstElementChild;

    if (!anchor || !anchor.parentElement) return;

    const wrap = document.createElement('div');
    wrap.id = 'tmEmberfallHelperInlineWrap';
    Object.assign(wrap.style, {
      maxWidth: '900px',
      margin: '12px auto 18px',
      padding: '12px 14px',
      borderRadius: '14px',
      border: '1px solid rgba(255,255,255,0.10)',
      background: 'linear-gradient(180deg, rgba(36,39,62,.90), rgba(21,23,37,.90))',
      boxShadow: '0 10px 24px rgba(0,0,0,.32)'
    });

    const inner = document.createElement('div');
    inner.id = 'tmEmberfallHelperInline';
    wrap.appendChild(inner);

    anchor.parentElement.insertBefore(wrap, anchor.nextSibling);
  }

  function maybeCaptureDropsFromBattle() {
    const payload = parseLootFromBattlePage();
    if (!payload) return;
    if (upsertDrops(payload)) {
      setStatus(`Captured drops for ${payload.mobName} (${payload.items.length} items).`);
    }
  }

  // ---- Main
  if (!isRelevantPage()) return;

  ensureDropsSeedInstalled();

  // Only show tracker UI on event map + event wave.
  if (shouldShowPanelUi()) {
    renderPanel();
    refresh();
  }

  // Keep the "Quest Journal" box at the top of the Emberfall event wave page.
  ensureInlineQuestSummary();
  refresh();

  if (isEmberfallBattlePage()) {
    // Auto-learn loot tables as you visit battles.
    maybeCaptureDropsFromBattle();
    // No UI on battle pages.
  }
})();


// ============================================================
// Module: Graveyard Multi-Loot (Graveyard.user.js)
// ============================================================

(function () {
  'use strict';

  const LOOT_URL = 'loot.php';
  const SELECTOR_CARD = '.monster-card[data-dead="1"]';
  const SELECTOR_ELIGIBLE_CARD = '.monster-card[data-dead="1"][data-eligible="1"]';
  const SELECTOR_ANY_DEAD_CARD = '.monster-card[data-dead="1"]';
  const FILTER_KEY = 'tm_graveyard_filter_mob_type_v1';
  const ALL_TYPES_CACHE_PREFIX = 'tm_graveyard_all_dead_index_v1:';
  const ALL_TYPES_TTL_MS = 5 * 60 * 1000;
  // Global monster card size (shared across Wave pages + D1 board).
  const UI_CARD_SIZE_KEY = 'tm_monster_card_size_v1';
  // Back-compat for older versions (Graveyard-only setting).
  const UI_CARD_SIZE_LEGACY_KEY = 'tm_graveyard_card_size_v1';
  const UI_AUTO_LOAD_ALL_DEAD_KEY = 'tm_graveyard_auto_load_all_dead_v1';
  const STYLE_ID = 'tmGraveyardMultiLootStyles';
  const MODAL_ID = 'tmGraveyardLootModal';

  let allDeadTypesFetch = null;
  let lastAllDeadTypesBaseUrl = '';
  let mergeDeadPagesFetch = null;

  function normName(s) {
    return String(s || '').trim().replace(/\s+/g, ' ');
  }

  function hasGraveyard() {
    return !!document.querySelector(SELECTOR_CARD);
  }

  function isDeadLootViewActive() {
    const text = document.body ? (document.body.textContent || '') : '';
    return /\bShow Alive monsters\b/i.test(text);
  }

  function hasAliveWaveMonsters() {
    if (isDeadLootViewActive()) return false;
    return Array.from(document.querySelectorAll('.monster-card[data-monster-id]:not([data-dead="1"])')).some((card) => {
      if (!(card instanceof HTMLElement)) return false;
      const cs = window.getComputedStyle(card);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      return /\bHP\b/i.test(card.textContent || '');
    });
  }

  function getEligibleDeadCards() {
    return Array.from(document.querySelectorAll(SELECTOR_ELIGIBLE_CARD));
  }

  function getVisibleCards(cards) {
    return (cards || []).filter((c) => c && c.style.display !== 'none' && c.offsetParent !== null);
  }

  function getMonsterTypeFromCard(card) {
    const direct = card ? (card.getAttribute('data-name') || '') : '';
    if (direct) return normName(direct).toLowerCase();
    const row = card ? card.closest('.monster-row') : null;
    const rowName = row ? (row.getAttribute('data-name') || '') : '';
    return normName(rowName).toLowerCase();
  }

  function getBaseWaveUrl() {
    const u = new URL(window.location.href);
    u.searchParams.delete('dead_page');
    u.hash = '';
    return u.toString();
  }

  function getWaveKey() {
    // Stable per wave (gate/event+wave) so we can store per-wave state.
    try {
      return getBaseWaveUrl();
    } catch {
      return String(window.location.href || '');
    }
  }

  function getAllTypesCacheKey(baseUrl) {
    return `${ALL_TYPES_CACHE_PREFIX}${String(baseUrl || '')}`;
  }

  function clearAllDeadTypesCacheForCurrentWave() {
    try {
      const baseUrl = getBaseWaveUrl();
      window.sessionStorage.removeItem(getAllTypesCacheKey(baseUrl));
    } catch {
      // ignore
    }
  }

  function tryLoadAllDeadIndex(baseUrl) {
    try {
      const raw = window.sessionStorage.getItem(getAllTypesCacheKey(baseUrl));
      if (!raw) return null;
      const data = JSON.parse(raw);
      const fetchedAt = Number(data?.fetchedAt || 0) || 0;
      const types = Array.isArray(data?.types) ? data.types.map((t) => normName(t).toLowerCase()).filter(Boolean) : [];
      if (!types.length) return null;
      if (fetchedAt && Date.now() - fetchedAt > ALL_TYPES_TTL_MS) return null;

      const firstPageByType = new Map();
      const fp = data?.firstPageByType && typeof data.firstPageByType === 'object' ? data.firstPageByType : null;
      if (fp) {
        for (const [k, v] of Object.entries(fp)) {
          const kk = normName(k).toLowerCase();
          const vv = parseInt(String(v || '0'), 10);
          if (kk && Number.isFinite(vv) && vv > 0) firstPageByType.set(kk, vv);
        }
      }

      return { types: new Set(types), firstPageByType };
    } catch {
      return null;
    }
  }

  function trySaveAllDeadIndex(baseUrl, typesSet, firstPageByType) {
    try {
      const types = Array.from(typesSet || []).map((t) => normName(t).toLowerCase()).filter(Boolean);
      if (!types.length) return;
      const fpObj = {};
      const fpMap = firstPageByType instanceof Map ? firstPageByType : new Map();
      for (const [k, v] of fpMap.entries()) {
        const kk = normName(k).toLowerCase();
        const vv = parseInt(String(v || '0'), 10);
        if (kk && Number.isFinite(vv) && vv > 0) fpObj[kk] = vv;
      }

      window.sessionStorage.setItem(
        getAllTypesCacheKey(baseUrl),
        JSON.stringify({ fetchedAt: Date.now(), types, firstPageByType: fpObj })
      );
    } catch {
      // ignore
    }
  }

  function getUnclaimedKillsCount(doc) {
    const pills = Array.from((doc || document).querySelectorAll('.unclaimed-pill'));
    for (const pill of pills) {
      const txt = normName(pill.textContent || '').toLowerCase();
      if (!txt.includes('unclaimed') || !txt.includes('kills')) continue;
      const countEl = pill.querySelector('.count');
      const n = parseInt(String(countEl ? countEl.textContent : '').replace(/[^\d]/g, ''), 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return 0;
  }

  function getDeadLootMaxPagesFromLinks(doc) {
    try {
      const links = Array.from((doc || document).querySelectorAll('a[href*="dead_page="]'));
      let max = 0;
      for (const a of links) {
        const href = a?.getAttribute?.('href') || '';
        if (!href) continue;
        const u = new URL(href, window.location.origin);
        const p = parseInt(u.searchParams.get('dead_page') || '0', 10);
        if (Number.isFinite(p) && p > max) max = p;
      }
      return max > 0 ? max : 0;
    } catch {
      return 0;
    }
  }

  function getDeadLootMaxPagesFromText(doc) {
    try {
      const bodyTxt = normName(((doc || document).body ? (doc || document).body.textContent : '') || '');
      const m = bodyTxt.match(/dead\s*loot\s*page\s*(\d+)\s*\/\s*(\d+)/i);
      const max = m ? parseInt(m[2] || '0', 10) : 0;
      return Number.isFinite(max) && max > 0 ? max : 0;
    } catch {
      return 0;
    }
  }

  function getDeadLootMaxPages(doc) {
    const fromText = getDeadLootMaxPagesFromText(doc);
    if (fromText > 0) return fromText;

    const fromLinks = getDeadLootMaxPagesFromLinks(doc);
    if (fromLinks > 0) return fromLinks;

    // Fallback: estimate from "unclaimed kills" / per-page count.
    const totalDead = getUnclaimedKillsCount(doc);
    const perPage = Math.max(0, (doc || document).querySelectorAll(SELECTOR_ANY_DEAD_CARD).length);
    if (totalDead > 0 && perPage > 0 && totalDead > perPage) return Math.ceil(totalDead / perPage);
    return 0;
  }

  async function runWithConcurrency(items, concurrency, worker) {
    const list = Array.from(items || []);
    if (!list.length) return [];

    const limit = Math.max(1, Math.min(6, Number(concurrency || 1) || 1));
    const results = new Array(list.length);
    let idx = 0;

    async function loop() {
      while (true) {
        const my = idx++;
        if (my >= list.length) return;
        results[my] = await worker(list[my], my);
      }
    }

    const runners = Array.from({ length: Math.min(limit, list.length) }, () => loop());
    await Promise.all(runners);
    return results;
  }

  async function fetchDeadTypesForPage(baseUrl, pageNumber) {
    const u = new URL(baseUrl);
    if (pageNumber && pageNumber > 1) u.searchParams.set('dead_page', String(pageNumber));
    else u.searchParams.delete('dead_page');

    const res = await fetch(u.toString(), { method: 'GET', credentials: 'same-origin', cache: 'no-store' });
    if (!res.ok) return { count: 0, types: new Set() };
    const html = await res.text().catch(() => '');
    if (!html) return { count: 0, types: new Set() };

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const cards = Array.from(doc.querySelectorAll(SELECTOR_ANY_DEAD_CARD));
    const types = new Set();
    for (const card of cards) {
      const t = getMonsterTypeFromCard(card);
      if (t) types.add(t);
    }
    return { count: cards.length, types };
  }

  function kickOffAllDeadTypesPrefetch() {
    const baseUrl = getBaseWaveUrl();
    if (allDeadTypesFetch && lastAllDeadTypesBaseUrl === baseUrl) return;
    if (tryLoadAllDeadIndex(baseUrl)) return;

    lastAllDeadTypesBaseUrl = baseUrl;

    // Update UI immediately to show "(loading...)" option text.
    window.setTimeout(() => ensureTypeFilterOptions(), 0);

    allDeadTypesFetch = (async () => {
      try {
        setStatus('Loading dead monster types from other pages...');
        const merged = new Set();
        const firstPageByType = new Map();
        for (const card of Array.from(document.querySelectorAll(SELECTOR_ANY_DEAD_CARD))) {
          const t = getMonsterTypeFromCard(card);
          if (t) {
            merged.add(t);
            if (!firstPageByType.has(t)) firstPageByType.set(t, 1);
          }
        }

        let maxPages = getDeadLootMaxPages(document);
        if (!Number.isFinite(maxPages) || maxPages < 2) maxPages = 10;
        maxPages = Math.max(2, Math.min(20, maxPages));

        const pages = [];
        for (let p = 2; p <= maxPages; p++) pages.push(p);

        try {
          console.info('[TM Graveyard] Prefetching dead types from pages:', pages);
        } catch {
          // ignore
        }

        const results = await runWithConcurrency(
          pages,
          3,
          async (p) => await fetchDeadTypesForPage(baseUrl, p).catch((e) => ({ count: 0, types: new Set(), error: e }))
        );

        for (let i = 0; i < results.length; i++) {
          const r = results[i];
          if (!r || !r.count) {
            // Don't abort: pagination count may still be right, but an individual request failed.
            // Keep going and let the dropdown populate with whatever we got.
            try {
              console.warn('[TM Graveyard] failed to prefetch dead_page=' + String(pages[i] || ''), r?.error || r);
            } catch {
              // ignore
            }
            continue;
          }
          for (const t of Array.from(r.types || [])) merged.add(t);
          for (const t of Array.from(r.types || [])) {
            if (!t) continue;
            const prev = firstPageByType.get(t);
            const p = parseInt(String(pages[i] || '0'), 10);
            if (!Number.isFinite(p) || p <= 0) continue;
            if (!prev || p < prev) firstPageByType.set(t, p);
          }
        }

        trySaveAllDeadIndex(baseUrl, merged, firstPageByType);
        window.setTimeout(() => ensureTypeFilterOptions(), 0);
        setStatus(`Dead monster types loaded (${merged.size}).`);
      } catch (e) {
        try {
          console.warn('[TM Graveyard] prefetch crashed', e);
        } catch {
          // ignore
        }
        setStatus('Dead monster types: failed to load.');
      }
    })().finally(() => {
      allDeadTypesFetch = null;
    });
  }

  function getSelectedLootIds() {
    return Array.from(document.querySelectorAll('input.tm-loot-select:checked[data-monster-id]'))
      .map((el) => parseInt(el.getAttribute('data-monster-id') || '0', 10))
      .filter(Boolean);
  }

  function setStatus(text) {
    const el = document.getElementById('lootStatus') || document.getElementById('tmLootStatus');
    if (!el) return;
    el.textContent = text;
  }

  function isAutoLoadAllDeadEnabled() {
    try {
      return window.sessionStorage.getItem(UI_AUTO_LOAD_ALL_DEAD_KEY) === '1';
    } catch {
      return false;
    }
  }

  function setAutoLoadAllDeadEnabled(on) {
    try {
      window.sessionStorage.setItem(UI_AUTO_LOAD_ALL_DEAD_KEY, on ? '1' : '0');
    } catch {
      // ignore
    }
  }

  function hasMergedAllDeadPages() {
    try {
      const base = getWaveKey();
      return document.body.getAttribute('data-tm-dead-merged') === base;
    } catch {
      return false;
    }
  }

  function markMergedAllDeadPages() {
    try {
      document.body.setAttribute('data-tm-dead-merged', getWaveKey());
    } catch {
      // ignore
    }
  }

  function getSavedCardSize() {
    try {
      return (
        window.sessionStorage.getItem(UI_CARD_SIZE_KEY) ||
        window.sessionStorage.getItem(UI_CARD_SIZE_LEGACY_KEY) ||
        ''
      );
    } catch {
      return '';
    }
  }

  function setSavedCardSize(value) {
    const v = String(value || '');
    try { window.sessionStorage.setItem(UI_CARD_SIZE_KEY, v); } catch {}
    try { window.sessionStorage.setItem(UI_CARD_SIZE_LEGACY_KEY, v); } catch {}
  }

  function setCardSize(size) {
    const s = String(size || '').toLowerCase();
    const normalized = s === 'compact' ? 'small' : s;
    setSavedCardSize(normalized);

    // Unified: icon size follows card size.
    document.body.classList.remove('tm-graveyard-cards-compact', 'tm-graveyard-cards-tiny');
    document.body.classList.remove('tm-graveyard-icons-small', 'tm-graveyard-icons-tiny');

    if (normalized === 'small') {
      document.body.classList.add('tm-graveyard-cards-compact');
      document.body.classList.add('tm-graveyard-icons-small');
    }
    if (normalized === 'tiny') {
      document.body.classList.add('tm-graveyard-cards-tiny');
      document.body.classList.add('tm-graveyard-icons-tiny');
    }
  }

  function applyCardSizeFromStorage() {
    const saved = getSavedCardSize();
    if (saved !== null && saved !== undefined) setCardSize(saved);
  }

  function ensureWaveSizeControls() {
    if (document.getElementById('tmWaveSizeControls')) return;

    const anchor =
      document.getElementById('waveQolPanel') ||
      document.querySelector('.waves-nav') ||
      document.querySelector('.gate-info') ||
      document.querySelector('h1') ||
      document.body.firstElementChild;

    if (!anchor || !anchor.parentElement) return;

    const wrap = document.createElement('div');
    wrap.id = 'tmWaveSizeControls';

    const label = document.createElement('span');
    label.className = 'tm-wave-label';
    label.textContent = 'Monster card size:';

    const sel = document.createElement('select');
    sel.id = 'tmWaveCardSizeSel';
    sel.className = 'btn';
    sel.innerHTML = `<option value="">Normal</option><option value="small">Small</option><option value="tiny">Tiny</option>`;
    sel.value = getSavedCardSize() || '';

    sel.addEventListener('change', () => setCardSize(sel.value));

    wrap.appendChild(label);
    wrap.appendChild(sel);
    anchor.parentElement.insertBefore(wrap, anchor.nextSibling);

    // Match wave button look (Multi Target buttons).
    applyButtonThemeFromReference(wrap);
  }

  function syncWaveSizeControls() {
    ensureWaveSizeControls();
    const controls = document.getElementById('tmWaveSizeControls');
    if (controls) controls.style.display = hasAliveWaveMonsters() ? '' : 'none';
  }

  function syncNativeWaveQolPanel() {
    const panel = document.getElementById('waveQolPanel');
    if (!panel) return;
    panel.classList.toggle('tm-waveqol-hidden', isDeadLootViewActive());
  }

  function findReferenceMultiTargetButton() {
    const selectors = [
      '#waveQolPanel .btnQuickJoinAttack:not([disabled])',
      '#waveQolPanel .qol-attacks .btn:not([disabled])',
      '#waveQolPanel .btn:not([disabled])',
      '.btnQuickJoinAttack:not([disabled])',
      '.qol-attacks .btn:not([disabled])',
      'button.btn:not([disabled])',
      'a.btn:not([disabled])'
    ];

    for (const sel of selectors) {
      const els = Array.from(document.querySelectorAll(sel));
      for (const el of els) {
        if (!(el instanceof HTMLElement)) continue;
        if (el.offsetParent === null) continue;
        return el;
      }
    }
    return null;
  }

  function applyButtonThemeFromReference(controlsEl) {
    if (!controlsEl) return;
    const ref = findReferenceMultiTargetButton();
    if (!ref) return;

    const cs = window.getComputedStyle(ref);
    const bg = cs.backgroundImage && cs.backgroundImage !== 'none' ? cs.backgroundImage : cs.backgroundColor;
    const border = `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`;
    const padding = `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`;

    // Spacing: try to match the Multi Target row spacing (gap).
    // NOTE: use single values (row/col) so we can safely reuse them in CSS without calc() issues.
    const parent = ref.closest('.qol-attacks') || ref.parentElement;
    if (parent) {
      const ps = window.getComputedStyle(parent);
      const rg = ps.rowGap && ps.rowGap !== 'normal' ? ps.rowGap : '';
      const cg = ps.columnGap && ps.columnGap !== 'normal' ? ps.columnGap : '';
      if (rg) controlsEl.style.setProperty('--tm-controls-row-gap', rg);
      if (cg) controlsEl.style.setProperty('--tm-controls-col-gap', cg);
      if (cg) controlsEl.style.setProperty('--tm-controls-gap', cg);
      else if (rg) controlsEl.style.setProperty('--tm-controls-gap', rg);
    }

    controlsEl.style.setProperty('--tm-btn-background', bg);
    controlsEl.style.setProperty('--tm-btn-color', cs.color);
    controlsEl.style.setProperty('--tm-btn-border', border);
    if (padding) controlsEl.style.setProperty('--tm-btn-padding', padding);
    if (cs.borderRadius) controlsEl.style.setProperty('--tm-btn-radius', cs.borderRadius);
    if (cs.boxShadow && cs.boxShadow !== 'none') controlsEl.style.setProperty('--tm-btn-shadow', cs.boxShadow);

    // Copy font so it feels native (buttons + inline status text).
    if (cs.fontFamily) controlsEl.style.setProperty('--tm-btn-font-family', cs.fontFamily);
    if (cs.fontSize) controlsEl.style.setProperty('--tm-btn-font-size', cs.fontSize);
    if (cs.fontWeight) controlsEl.style.setProperty('--tm-btn-font-weight', cs.fontWeight);
    if (cs.letterSpacing) controlsEl.style.setProperty('--tm-btn-letter-spacing', cs.letterSpacing);
    if (cs.textTransform) controlsEl.style.setProperty('--tm-btn-text-transform', cs.textTransform);

    // Reference text metrics (used for our non-button text so it matches Multi Target).
    if (cs.fontFamily) controlsEl.style.setProperty('--tm-ref-font-family', cs.fontFamily);
    if (cs.fontSize) controlsEl.style.setProperty('--tm-ref-font-size', cs.fontSize);
    if (cs.fontWeight) controlsEl.style.setProperty('--tm-ref-font-weight', cs.fontWeight);
    if (cs.letterSpacing) controlsEl.style.setProperty('--tm-ref-letter-spacing', cs.letterSpacing);
    if (cs.textTransform) controlsEl.style.setProperty('--tm-ref-text-transform', cs.textTransform);
  }

  function getDeadCardsContainer() {
    const monsterContainer = document.querySelector('.monster-container');
    if (monsterContainer) return monsterContainer;

    const first = document.querySelector(SELECTOR_ANY_DEAD_CARD);
    if (!first) return null;
    return first.closest('.custom-monster-container') || first.parentElement || document.body;
  }

  async function mergeAllDeadPagesIntoOne() {
    if (mergeDeadPagesFetch) return mergeDeadPagesFetch;
    if (hasMergedAllDeadPages()) {
      setStatus('Dead pages already loaded.');
      return null;
    }

    const baseUrl = getBaseWaveUrl();
    let maxPages = getDeadLootMaxPages(document) || 0;

    const container = getDeadCardsContainer();
    if (!container) {
      setStatus('Could not find monster container.');
      return null;
    }

    const cur = new URL(window.location.href);
    const curPage = parseInt(cur.searchParams.get('dead_page') || '1', 10) || 1;

    // If page 1 only shows a "Next" link, maxPages can be under-detected. Probe forward a bit.
    if (!maxPages || maxPages <= curPage + 1) {
      try {
        const probeU = new URL(baseUrl);
        probeU.searchParams.set('dead_page', String(curPage + 1));
        const res = await fetch(probeU.toString(), { method: 'GET', credentials: 'same-origin', cache: 'no-store' });
        if (res.ok) {
          const html = await res.text().catch(() => '');
          if (html) {
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const probed = getDeadLootMaxPages(doc) || 0;
            if (probed > maxPages) maxPages = probed;
          }
        }
      } catch {
        // ignore
      }
    }

    maxPages = Math.max(1, Math.min(20, Number(maxPages || 1) || 1));
    if (maxPages <= 1) {
      setStatus('Only 1 dead page here.');
      return null;
    }

    const existingIds = new Set(
      Array.from(document.querySelectorAll(SELECTOR_ANY_DEAD_CARD))
        .map((c) => parseInt(c.getAttribute('data-monster-id') || '0', 10))
        .filter(Boolean)
    );

    mergeDeadPagesFetch = (async () => {
      let appended = 0;
      setStatus(`Loading dead pages (this can be heavy)...`);

      const pages = [];
      for (let p = 1; p <= maxPages; p++) if (p !== curPage) pages.push(p);

      const results = await runWithConcurrency(
        pages,
        2,
        async (p) => {
          setStatus(`Loading dead page ${p}/${maxPages}... (added ${appended})`);
          const u = new URL(baseUrl);
          if (p > 1) u.searchParams.set('dead_page', String(p));
          else u.searchParams.delete('dead_page');
          const res = await fetch(u.toString(), { method: 'GET', credentials: 'same-origin', cache: 'no-store' });
          if (!res.ok) return { page: p, html: '' };
          const html = await res.text().catch(() => '');
          return { page: p, html };
        }
      );

      for (const r of results) {
        const html = String(r?.html || '');
        if (!html) continue;
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const cards = Array.from(doc.querySelectorAll(SELECTOR_ANY_DEAD_CARD));
        for (const card of cards) {
          const id = parseInt(card.getAttribute('data-monster-id') || '0', 10);
          if (!id || existingIds.has(id)) continue;
          existingIds.add(id);
          container.appendChild(document.importNode(card, true));
          appended++;
        }
      }

      setStatus(`Loaded ${appended} dead monsters from other pages.`);
      markMergedAllDeadPages();
      ensureTypeFilterOptions();
      applyTypeFilter();
      ensureLootCheckboxes();
      return appended;
    })().finally(() => {
      mergeDeadPagesFetch = null;
    });

    return mergeDeadPagesFetch;
  }

  function maybeAutoLoadAllDeadPages() {
    if (!isAutoLoadAllDeadEnabled()) return;
    if (!hasGraveyard()) return;
    if (hasMergedAllDeadPages()) return;
    // Fire and forget; status UI will show progress.
    mergeAllDeadPagesIntoOne().catch(() => {
      // ignore (merge function already sets status + logs if needed)
    });
  }

  function ensureStatusHost() {
    if (document.getElementById('lootStatus') || document.getElementById('tmLootStatus')) return;
    const anchor = document.getElementById('toggleDeadBtn') || document.querySelector('.batch-loot-card');
    if (!anchor || !anchor.parentElement) return;
    const s = document.createElement('div');
    s.id = 'tmLootStatus';
    s.style.cssText = 'color:#9aa0be;font-size:12px;flex-basis:100%;margin-top:8px;';
    s.textContent = '';
    anchor.parentElement.insertBefore(s, anchor.nextSibling);
  }

  function updateSelectedCount() {
    const el = document.getElementById('tmLootSelectedCount');
    if (!el) return;
    el.textContent = `Selected: ${getSelectedLootIds().length}`;
  }

  function clearSelection() {
    for (const cb of Array.from(document.querySelectorAll('input.tm-loot-select:checked'))) cb.checked = false;
    updateSelectedCount();
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .tm-loot-select {
        appearance: none;
        -webkit-appearance: none;
        width: 16px;
        height: 16px;
        border-radius: 4px;
        border: 1px solid rgba(255,255,255,0.35);
        background: rgba(10,11,14,0.55);
        display: inline-grid;
        place-content: center;
        box-shadow: 0 0 0 1px rgba(0,0,0,0.25) inset;
        cursor: pointer;
      }
      .tm-loot-select:checked {
        border-color: rgba(26,157,115,0.95);
        background: rgba(26,157,115,0.25);
      }
      .tm-loot-select:checked::before {
        content: "✓";
        color: #eafff6;
        font-size: 13px;
        line-height: 1;
        font-weight: 900;
        transform: translateY(-0.5px);
      }
      .tm-loot-select:focus-visible {
        outline: none;
        box-shadow: 0 0 0 2px rgba(47,125,255,0.35), 0 0 0 1px rgba(0,0,0,0.25) inset;
      }

      #tmLootTypeFilter{
        color:#e6e9ff !important;
        background: rgba(0,0,0,0.35) !important;
      }
      #tmLootTypeFilter option{
        color:#e6e9ff !important;
        background: #151725 !important;
      }

      /* Fix any encoding weirdness: force the actual checkmark glyph */
      .tm-loot-select:checked::before{
        content: "✓" !important;
      }

      /* ===== Wave card size control bar (Wave 3 style) ===== */
      #tmWaveSizeControls{
        max-width:900px;
        margin:10px auto 10px;
        display:flex;
        flex-wrap:wrap;
        align-items:center;
        gap:0 !important;

        --tm-btn-background: #333;
        --tm-btn-color: #fff;
        --tm-btn-border: 1px solid #2b2d44;
        --tm-btn-shadow: 0 6px 18px rgba(0,0,0,.6);

        --tm-btn-radius: 10px;
        --tm-btn-padding: 10px 12px;
        --tm-btn-font-family: inherit;
        --tm-btn-font-size: 13px;
        --tm-btn-font-weight: 800;
        --tm-btn-letter-spacing: normal;
        --tm-btn-text-transform: none;
        --tm-btn-min-height: 36px;

        --tm-controls-row-gap: 10px;
        --tm-controls-col-gap: 10px;

        --tm-ref-font-family: var(--tm-btn-font-family);
        --tm-ref-font-size: 13px;
        --tm-ref-font-weight: 800;
        --tm-ref-letter-spacing: var(--tm-btn-letter-spacing);
        --tm-ref-text-transform: none;
      }

      #tmWaveSizeControls > *{
        margin-right: var(--tm-controls-col-gap) !important;
        margin-bottom: var(--tm-controls-row-gap) !important;
      }

      #tmWaveSizeControls .tm-wave-label{
        font-family: var(--tm-ref-font-family) !important;
        font-size: var(--tm-ref-font-size) !important;
        font-weight: var(--tm-ref-font-weight) !important;
        letter-spacing: var(--tm-ref-letter-spacing) !important;
        text-transform: var(--tm-ref-text-transform) !important;
        color:#9aa0be !important;
        white-space: nowrap !important;
      }

      /* Readable select even on themed pages */
      #tmWaveSizeControls select{
        background:#11131b !important;
        color:#e6e9ff !important;
        border: 1px solid rgba(255,255,255,0.14) !important;
        font-family: var(--tm-btn-font-family) !important;
        font-size: var(--tm-btn-font-size) !important;
        font-weight: var(--tm-btn-font-weight) !important;
      }
      #tmWaveSizeControls select option{
        background:#11131b !important;
        color:#e6e9ff !important;
      }

      #tmWaveSizeControls .btn{
        border-radius: var(--tm-btn-radius) !important;
        padding: var(--tm-btn-padding) !important;
        font-family: var(--tm-btn-font-family) !important;
        font-size: var(--tm-btn-font-size) !important;
        font-weight: var(--tm-btn-font-weight) !important;
        letter-spacing: var(--tm-btn-letter-spacing) !important;
        text-transform: var(--tm-btn-text-transform) !important;
        line-height: 1.2 !important;
        min-height: var(--tm-btn-min-height) !important;
        white-space: nowrap !important;

        background: var(--tm-btn-background) !important;
        border: var(--tm-btn-border) !important;
        color: var(--tm-btn-color) !important;
        box-shadow: var(--tm-btn-shadow) !important;
        cursor: pointer !important;
        transition: filter .12s ease, transform .06s ease !important;
      }
      #tmWaveSizeControls .btn:hover{ filter: brightness(1.06) !important; transform: translateY(-1px) !important; }
      #tmWaveSizeControls .btn:active{ filter: brightness(0.98) !important; transform: translateY(0) !important; }
      #tmWaveSizeControls .btn:disabled{ opacity:.6 !important; cursor:not-allowed !important; transform:none !important; }

      #waveQolPanel.tm-waveqol-hidden{
        display:none !important;
      }

      /* Make our selects readable even during event themes */
      #tmLootControls select{
        background: #11131b !important;
        color: #e6e9ff !important;
        border: 1px solid rgba(255,255,255,0.14) !important;
        font-family: var(--tm-btn-font-family) !important;
        font-size: var(--tm-btn-font-size) !important;
        font-weight: var(--tm-btn-font-weight) !important;
      }
      #tmLootControls select option{
        background: #11131b !important;
        color: #e6e9ff !important;
      }

      /* Buttons: match the wave's "Multi Target" look via CSS vars (set from an existing button) */
      #tmLootControls{
        --tm-btn-background: #333;
        --tm-btn-color: #fff;
        --tm-btn-border: 1px solid #2b2d44;
        --tm-btn-shadow: 0 6px 18px rgba(0,0,0,.6);

        /* Keep Wave 3 sizing */
        --tm-btn-radius: 10px;
        --tm-btn-padding: 10px 12px;
        --tm-btn-font-family: inherit;
        --tm-btn-font-size: 13px;
        --tm-btn-font-weight: 800;
        --tm-btn-letter-spacing: normal;
        --tm-btn-text-transform: none;
        --tm-btn-min-height: 36px;
        --tm-controls-gap: 10px;
        --tm-controls-row-gap: 10px;
        --tm-controls-col-gap: 10px;

        --tm-ref-font-family: var(--tm-btn-font-family);
        --tm-ref-font-size: 13px;
        --tm-ref-font-weight: 800;
        --tm-ref-letter-spacing: var(--tm-btn-letter-spacing);
        --tm-ref-text-transform: none;
      }

      /* Spacing: use margins (more reliable than flex gap across weird CSS stacks) */
      #tmLootControls{ gap: 0 !important; }
      #tmLootControls > *{
        margin-right: var(--tm-controls-col-gap) !important;
        margin-bottom: var(--tm-controls-row-gap) !important;
      }

      #tmLootControls .btn{
        border-radius: var(--tm-btn-radius) !important;
        padding: var(--tm-btn-padding) !important;
        font-family: var(--tm-btn-font-family) !important;
        font-size: var(--tm-btn-font-size) !important;
        font-weight: var(--tm-btn-font-weight) !important;
        letter-spacing: var(--tm-btn-letter-spacing) !important;
        text-transform: var(--tm-btn-text-transform) !important;
        line-height: 1.2 !important;
        min-height: var(--tm-btn-min-height) !important;
        white-space: nowrap !important;

        background: var(--tm-btn-background) !important;
        border: var(--tm-btn-border) !important;
        color: var(--tm-btn-color) !important;
        box-shadow: var(--tm-btn-shadow) !important;
        cursor: pointer !important;
        transition: filter .12s ease, transform .06s ease !important;
      }
      #tmLootControls .btn:hover{ filter: brightness(1.06) !important; transform: translateY(-1px) !important; }
      #tmLootControls .btn:active{ filter: brightness(0.98) !important; transform: translateY(0) !important; }
      #tmLootControls .btn:disabled{ opacity:.6 !important; cursor:not-allowed !important; transform:none !important; }

      /* Loot button stays green */
      #tmLootControls .btn.tm-loot-btn{
        background: linear-gradient(180deg, #1f9d63, #158a56) !important;
        border: 1px solid rgba(31,157,99,0.95) !important;
        color: #ffffff !important;
        box-shadow: 0 10px 22px rgba(31,157,99,.22), 0 0 0 2px rgba(0,0,0,.18) inset !important;
      }

      /* Text spacing/fonts: match Multi Target */
      #tmLootControls #tmLootTypeBadge,
      #tmLootControls #tmLootSelectedCount{
        font-family: var(--tm-ref-font-family) !important;
        font-size: var(--tm-ref-font-size) !important;
        font-weight: var(--tm-ref-font-weight) !important;
        letter-spacing: var(--tm-ref-letter-spacing) !important;
        text-transform: var(--tm-ref-text-transform) !important;
        line-height: 1.2 !important;
      }

      #${MODAL_ID}{
        display:none; position:fixed; inset:0; z-index:99999;
        background: rgba(0,0,0,0.82);
        align-items:center; justify-content:center;
      }
      #${MODAL_ID} .tmml-box{
        width: 760px; max-width: 95vw; max-height: 92vh; overflow:auto;
        background: linear-gradient(180deg, rgba(36,39,62,.96), rgba(21,23,37,.96));
        border: 1px solid rgba(255,255,255,0.10);
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0,0,0,.55);
        padding: 14px 16px;
        color: #e6e9ff;
        font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      }
      #${MODAL_ID} .tmml-head{ margin:0; font-size:18px; font-weight:900; color:#FFD369; letter-spacing:.02em; }
      #${MODAL_ID} .tmml-summary{ display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }
      #${MODAL_ID} .tmml-chip{
        padding: 6px 10px; border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.10);
        background: rgba(255,255,255,0.04);
        font-size: 12px; color:#e6e9ff; font-weight: 800;
      }
      #${MODAL_ID} .tmml-grid{ display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-top: 12px; }
      #${MODAL_ID} .tmml-item{
        position: relative;
        border-radius: 14px;
        border: 1px solid rgba(255,255,255,0.10);
        background: rgba(0,0,0,0.18);
        padding: 10px;
        display:flex; flex-direction:column; gap:6px; align-items:center; text-align:center;
      }
      #${MODAL_ID} .tmml-count{
        position:absolute; top:8px; right:8px;
        padding: 3px 7px;
        border-radius: 999px;
        background: rgba(0,0,0,0.55);
        border: 1px solid rgba(255,255,255,0.14);
        color: #eafff6;
        font-size: 12px;
        font-weight: 900;
        line-height: 1.1;
      }
      #${MODAL_ID} .tmml-item img{ width: 56px; height: 56px; object-fit: contain; }
      #${MODAL_ID} .tmml-item small{ color:#e6e9ff; font-weight:800; line-height:1.2; }
      #${MODAL_ID} .tmml-item .muted{ color:#9aa0be; font-weight:700; }
      #${MODAL_ID} .tmml-note{ margin-top: 10px; color:#c7cbdf; font-size: 12px; line-height: 1.4; }
      #${MODAL_ID} .tmml-actions{ display:flex; justify-content:flex-end; gap: 10px; margin-top: 14px; }
      #${MODAL_ID} .tmml-close{
        cursor:pointer; border-radius: 12px; padding: 8px 12px;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(255,255,255,0.06);
        color: #fff; font-weight: 800;
      }

      /* Optional: smaller monster icons */
      body.tm-graveyard-icons-small .monster-card .monster-img{ max-height: 110px !important; }
      body.tm-graveyard-icons-tiny  .monster-card .monster-img{ max-height: 80px !important; }

      /* Optional: smaller monster cards (more columns) */
      body.tm-graveyard-cards-compact .monster-container{ grid-template-columns:repeat(auto-fit, minmax(210px, 210px)) !important; }
      body.tm-graveyard-cards-tiny .monster-container{ grid-template-columns:repeat(auto-fit, minmax(175px, 175px)) !important; }

      body.tm-graveyard-cards-compact .monster-card{ width:210px !important; padding:10px !important; border-radius:12px !important; }
      body.tm-graveyard-cards-tiny .monster-card{ width:175px !important; padding:8px !important; border-radius:12px !important; }
      body.tm-graveyard-cards-compact .monster-row{ gap: 10px !important; }
      body.tm-graveyard-cards-tiny .monster-row{ gap: 8px !important; }

      body.tm-graveyard-cards-compact .monster-card h3{ font-size:15px !important; margin:8px 0 6px !important; }
      body.tm-graveyard-cards-tiny .monster-card h3{ font-size:14px !important; margin:6px 0 5px !important; }

      body.tm-graveyard-cards-compact .monster-card .join-btn,
      body.tm-graveyard-cards-compact .monster-card .btn{ padding:8px 10px !important; font-size:12px !important; }
      body.tm-graveyard-cards-tiny .monster-card .join-btn,
      body.tm-graveyard-cards-tiny .monster-card .btn{ padding:7px 9px !important; font-size:12px !important; }

      body.tm-graveyard-cards-compact .monster-stats{ font-size:12px !important; }
      body.tm-graveyard-cards-tiny .monster-stats{ font-size:11.5px !important; }
    `;
    document.head.appendChild(style);
  }

  function ensureLootModal() {
    if (document.getElementById(MODAL_ID)) return;
    const modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = `
      <div class="tmml-box">
        <h2 class="tmml-head">🎁 Loot Gained</h2>
        <div class="tmml-note" id="${MODAL_ID}_note" style="display:none;"></div>
        <div class="tmml-summary" id="${MODAL_ID}_summary"></div>
        <div class="tmml-grid" id="${MODAL_ID}_grid"></div>
        <div class="tmml-actions">
          <button type="button" class="tmml-close" id="${MODAL_ID}_close">Close</button>
        </div>
      </div>
    `;
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeLootModal();
    });
    document.body.appendChild(modal);

    const btnClose = document.getElementById(`${MODAL_ID}_close`);
    if (btnClose) btnClose.addEventListener('click', closeLootModal);

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeLootModal();
    });
  }

  function closeLootModal() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal) return;
    modal.style.display = 'none';
  }

  function openLootModal(summary, items, notes) {
    ensureStyles();
    ensureLootModal();

    const modal = document.getElementById(MODAL_ID);
    const sumEl = document.getElementById(`${MODAL_ID}_summary`);
    const gridEl = document.getElementById(`${MODAL_ID}_grid`);
    const noteEl = document.getElementById(`${MODAL_ID}_note`);
    if (!modal || !sumEl || !gridEl || !noteEl) return;

    const nf = new Intl.NumberFormat();
    const chips = [
      ['Processed', summary.processed],
      ['Success', summary.success],
      ['Fail', summary.fail],
      ['EXP', nf.format(summary.exp || 0)],
      ['Gold', nf.format(summary.gold || 0)],
      ['Items', nf.format(items.length)]
    ];
    sumEl.innerHTML = chips.map(([k, v]) => `<span class="tmml-chip">${k}: ${v}</span>`).join('');

    const uniqNotes = Array.from(new Set((notes || []).filter(Boolean))).slice(0, 8);
    if (uniqNotes.length) {
      noteEl.style.display = 'block';
      noteEl.textContent = uniqNotes.join(' | ');
    } else {
      noteEl.style.display = 'none';
      noteEl.textContent = '';
    }

    const stack = new Map();
    for (const it of Array.isArray(items) ? items : []) {
      const name = String(it?.NAME || it?.name || 'Item');
      const tier = String(it?.TIER || it?.tier || '');
      const img = String(it?.IMAGE_URL || it?.image_url || it?.img || '');
      const key = `${img}|||${tier}|||${name}`;
      const prev = stack.get(key);
      if (prev) prev.count += 1;
      else stack.set(key, { name, tier, img, count: 1 });
    }

    const stackedItems = Array.from(stack.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    });

    gridEl.innerHTML = stackedItems.length
      ? stackedItems.slice(0, 160).map((it) => {
          const badge = it.count > 1 ? `<span class="tmml-count">x${it.count}</span>` : ``;
          return `
            <div class="tmml-item">
              ${badge}
              ${it.img ? `<img src="${String(it.img)}" alt="${String(it.name)}">` : `<div class="muted">No image</div>`}
              <small>${String(it.name)}</small>
              ${it.tier ? `<small class="muted">${String(it.tier)}</small>` : ``}
            </div>
          `;
        }).join('')
      : `<div class="tmml-note">No items this time.</div>`;

    modal.style.display = 'flex';
  }

  function applyTypeFilter() {
    const sel = document.getElementById('tmLootTypeFilter');
    if (!sel) return;
    const chosen = normName(sel.value || '').toLowerCase();

    try {
      window.sessionStorage.setItem(FILTER_KEY, chosen);
    } catch {
      // ignore
    }

    const cards = Array.from(document.querySelectorAll(SELECTOR_ANY_DEAD_CARD));
    for (const card of cards) {
      const type = getMonsterTypeFromCard(card);
      const hide = !!chosen && chosen !== type;
      if (hide) {
        card.dataset.tmFilterHidden = '1';
        card.style.display = 'none';
      } else if (card.dataset.tmFilterHidden === '1') {
        delete card.dataset.tmFilterHidden;
        card.style.display = '';
      }
    }

    for (const cb of Array.from(document.querySelectorAll('input.tm-loot-select:checked[data-monster-id]'))) {
      const id = cb.getAttribute('data-monster-id');
      const card = id ? document.querySelector(`.monster-card[data-monster-id="${id}"]`) : null;
      if (card && card.style.display === 'none') cb.checked = false;
    }

    updateSelectedCount();

    // If the chosen type isn't present on this page, help navigate to the right dead_page (if we know it).
    if (chosen) {
      const anyVisible = Array.from(document.querySelectorAll(SELECTOR_ANY_DEAD_CARD)).some(
        (card) => card && card.style.display !== 'none'
      );
      if (!anyVisible) {
        const baseUrl = getBaseWaveUrl();
        const cached = tryLoadAllDeadIndex(baseUrl);
        const firstPage = cached?.firstPageByType instanceof Map ? cached.firstPageByType.get(chosen) : 0;
        if (firstPage && firstPage > 0) {
          const cur = new URL(window.location.href);
          const curPage = parseInt(cur.searchParams.get('dead_page') || '1', 10) || 1;
          if (firstPage !== curPage) {
            setStatus(`No "${chosen}" on this page. It first appears on dead page ${firstPage}.`);
          }
        }
      }
    }
  }

  function ensureTypeFilterOptions() {
    const sel = document.getElementById('tmLootTypeFilter');
    if (!sel) return;

    const cards = Array.from(document.querySelectorAll(SELECTOR_ANY_DEAD_CARD));
    const pageTypes = new Set();
    for (const card of cards) {
      const t = getMonsterTypeFromCard(card);
      if (t) pageTypes.add(t);
    }

    const baseUrl = getBaseWaveUrl();
    const cached = tryLoadAllDeadIndex(baseUrl);
    const types = new Set(Array.from(pageTypes));
    if (cached?.types) for (const t of Array.from(cached.types)) types.add(t);
    else kickOffAllDeadTypesPrefetch();

    const prev = sel.value || '';
    const nextOptions = [''].concat(Array.from(types).sort((a, b) => a.localeCompare(b)));

    const isLoading = !cached?.types && !!allDeadTypesFetch && lastAllDeadTypesBaseUrl === baseUrl;
    const sig = nextOptions.join('\n') + `\n#loading=${isLoading ? '1' : '0'}`;
    if (sel.dataset.tmOptionsSig !== sig) {
      sel.innerHTML = '';
      for (const v of nextOptions) {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v ? v : (isLoading ? 'All dead monsters (loading...)' : 'All dead monsters');
        sel.appendChild(opt);
      }
      sel.dataset.tmOptionsSig = sig;
    }

    const want = prev && nextOptions.includes(prev) ? prev : '';
    sel.value = want;

    // Update badge, if present.
    const badge = document.getElementById('tmLootTypeBadge');
    if (badge) {
      const cachedCount = cached?.types ? cached.types.size : 0;
      badge.textContent = isLoading
        ? `types: ${pageTypes.size} (page) / ${cachedCount || '?'} (all) — loading…`
        : `types: ${pageTypes.size} (page) / ${cachedCount || pageTypes.size} (all)`;
    }
  }

  function ensureLootCheckboxes() {
    const cards = getVisibleCards(getEligibleDeadCards());
    for (const card of cards) {
      if (card.querySelector('input.tm-loot-select')) continue;

      const monsterId = parseInt(card.getAttribute('data-monster-id') || '0', 10);
      if (!monsterId) continue;

      const wrap = document.createElement('label');
      wrap.className = 'tm-loot-select-wrap';
      wrap.style.cssText =
        'position:absolute;top:10px;left:10px;display:flex;align-items:center;gap:8px;' +
        'padding:6px 8px;border-radius:999px;border:1px solid rgba(255,255,255,0.12);' +
        'background:rgba(0,0,0,0.45);color:#fff;font-size:12px;font-weight:800;cursor:pointer;z-index:5;';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'tm-loot-select';
      cb.setAttribute('data-monster-id', String(monsterId));
      cb.addEventListener('change', updateSelectedCount);

      const txt = document.createElement('span');
      txt.textContent = 'Loot';
      txt.style.cssText = 'user-select:none;';

      wrap.appendChild(cb);
      wrap.appendChild(txt);

      const curPos = window.getComputedStyle(card).position;
      if (!curPos || curPos === 'static') card.style.position = 'relative';

      card.appendChild(wrap);

      wrap.addEventListener('click', (e) => e.stopPropagation());
      cb.addEventListener('click', (e) => e.stopPropagation());
    }

    updateSelectedCount();
  }

  function ensureControls() {
    if (document.getElementById('tmLootControls')) return;

    ensureStyles();
    ensureStatusHost();

    let anchor =
      document.getElementById('lootStatus') ||
      document.getElementById('toggleDeadBtn') ||
      document.querySelector('.batch-loot-card');

    const containerForInsert = getDeadCardsContainer();
    if (!anchor || !anchor.parentElement) {
      if (containerForInsert && containerForInsert.parentElement) anchor = containerForInsert;
    }

    if (!anchor || !anchor.parentElement) return;

    const wrap = document.createElement('div');
    wrap.id = 'tmLootControls';
    wrap.style.cssText =
      'display:flex;gap:var(--tm-controls-gap,10px);align-items:center;flex-wrap:wrap;flex-basis:100%;margin-top:10px;';

    const typeWrap = document.createElement('div');
    typeWrap.className = 'tm-type-wrap';
    typeWrap.style.cssText = 'display:flex;gap:var(--tm-controls-gap,8px);align-items:center;flex-wrap:wrap;';

    const typeLabel = document.createElement('span');
    typeLabel.style.cssText = 'color:#c7cbdf;font-size:12px;';
    typeLabel.textContent = 'Show:';

    const selType = document.createElement('select');
    selType.id = 'tmLootTypeFilter';
    selType.style.cssText =
      'padding:6px 8px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);' +
      'background:#11131b;color:#e6e9ff;font-size:12px;';

    typeWrap.appendChild(typeLabel);
    typeWrap.appendChild(selType);

    const badge = document.createElement('span');
    badge.id = 'tmLootTypeBadge';
    badge.style.cssText = 'color:#9aa0be;';
    badge.textContent = 'types: ...';
    typeWrap.appendChild(badge);

    const btnReloadTypes = document.createElement('button');
    btnReloadTypes.type = 'button';
    btnReloadTypes.className = 'btn';
    btnReloadTypes.textContent = 'Reload types';

    const btnGoToType = document.createElement('button');
    btnGoToType.type = 'button';
    btnGoToType.className = 'btn';
    btnGoToType.textContent = 'Go to type page';
    btnGoToType.disabled = true;

    const btnLoadAllDead = document.createElement('button');
    btnLoadAllDead.type = 'button';
    btnLoadAllDead.className = 'btn';
    btnLoadAllDead.textContent = 'Load all dead pages';

    const autoLoadWrap = document.createElement('label');
    autoLoadWrap.style.cssText = 'display:inline-flex;gap:8px;align-items:center;color:#c7cbdf;font-size:12px;';
    autoLoadWrap.title = 'Automatically loads all dead pages into the current page (can be heavy).';

    const autoLoadCb = document.createElement('input');
    autoLoadCb.type = 'checkbox';
    autoLoadCb.style.cssText = 'width:16px;height:16px;';
    autoLoadCb.checked = isAutoLoadAllDeadEnabled();

    const autoLoadTxt = document.createElement('span');
    autoLoadTxt.textContent = 'Auto-load all dead pages';

    autoLoadWrap.appendChild(autoLoadCb);
    autoLoadWrap.appendChild(autoLoadTxt);

    const qtyWrap = document.createElement('label');
    qtyWrap.style.cssText = 'display:inline-flex;gap:8px;align-items:center;color:#c7cbdf;font-size:12px;';
    qtyWrap.title = 'Type a number to auto-check that many visible dead monsters (based on the Show filter).';

    const qtyLabel = document.createElement('span');
    qtyLabel.textContent = 'Select qty:';

    const qtyInput = document.createElement('input');
    qtyInput.id = 'tmLootSelectQty';
    qtyInput.type = 'number';
    qtyInput.inputMode = 'numeric';
    qtyInput.min = '0';
    qtyInput.step = '1';
    qtyInput.placeholder = '10';
    qtyInput.style.cssText =
      'width:72px;padding:6px 8px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);' +
      'background:#11131b;color:#e6e9ff;font-size:12px;';

    qtyWrap.appendChild(qtyLabel);
    qtyWrap.appendChild(qtyInput);

    const btnSelVisible = document.createElement('button');
    btnSelVisible.type = 'button';
    btnSelVisible.className = 'btn';
    btnSelVisible.textContent = 'Select all visible dead';

    const btnClear = document.createElement('button');
    btnClear.type = 'button';
    btnClear.className = 'btn';
    btnClear.textContent = 'Clear selection';

    const btnLoot = document.createElement('button');
    btnLoot.type = 'button';
    btnLoot.className = 'btn';
    btnLoot.textContent = 'Loot selected';
    // Let the page/theme style this button; we only enforce sizing via CSS.
    btnLoot.classList.add('tm-loot-btn');

    const count = document.createElement('span');
    count.id = 'tmLootSelectedCount';
    count.style.cssText = 'color:#9aa0be;';
    count.textContent = 'Selected: 0';

    wrap.appendChild(typeWrap);
    wrap.appendChild(btnReloadTypes);
    wrap.appendChild(btnGoToType);
    wrap.appendChild(btnLoadAllDead);
    wrap.appendChild(autoLoadWrap);
    wrap.appendChild(qtyWrap);
    wrap.appendChild(btnSelVisible);
    wrap.appendChild(btnClear);
    wrap.appendChild(btnLoot);
    wrap.appendChild(count);

    // Prefer inserting ABOVE the monster grid if we're anchoring to the container.
    const insertBefore = containerForInsert && anchor === containerForInsert;
    anchor.parentElement.insertBefore(wrap, insertBefore ? anchor : anchor.nextSibling);
    applyButtonThemeFromReference(wrap);

    btnSelVisible.addEventListener('click', () => {
      ensureLootCheckboxes();
      const rawQty = String(qtyInput.value || '').trim();
      if (rawQty !== '') {
        applyQtySelection();
        return;
      }
      const cards = getVisibleCards(getEligibleDeadCards());
      const chosen = normName(document.getElementById('tmLootTypeFilter')?.value || '').toLowerCase();
      if (!cards.length && chosen) {
        const baseUrl = getBaseWaveUrl();
        const cached = tryLoadAllDeadIndex(baseUrl);
        const firstPage = cached?.firstPageByType instanceof Map ? cached.firstPageByType.get(chosen) : 0;
        if (firstPage && firstPage > 0) {
          setStatus(`0 selected. "${chosen}" is on dead page ${firstPage} (use the Go to button).`);
        } else {
          setStatus('0 selected (none visible + lootable on this page).');
        }
        updateSelectedCount();
        return;
      }
      for (const card of cards) {
        const id = parseInt(card.getAttribute('data-monster-id') || '0', 10);
        const cb = id ? document.querySelector(`input.tm-loot-select[data-monster-id="${id}"]`) : null;
        if (cb) cb.checked = true;
      }
      updateSelectedCount();
      setStatus(`Selected ${getSelectedLootIds().length} visible dead monsters (all).`);
    });

    function applyQtySelection() {
      ensureLootCheckboxes();

      const raw = String(qtyInput.value || '').trim();
      if (!raw) return;

      const want = Math.max(0, parseInt(raw, 10) || 0);
      const cards = getVisibleCards(getEligibleDeadCards());
      const ids = cards
        .map((card) => parseInt(card.getAttribute('data-monster-id') || '0', 10))
        .filter((id) => !!id);

      const n = Math.min(want, ids.length);
      for (let i = 0; i < ids.length; i++) {
        const cb = document.querySelector(`input.tm-loot-select[data-monster-id="${ids[i]}"]`);
        if (cb) cb.checked = i < n;
      }

      updateSelectedCount();
      const chosen = normName(document.getElementById('tmLootTypeFilter')?.value || '').toLowerCase();
      const suffix = chosen ? ` (${chosen})` : '';
      setStatus(`Selected ${n}/${ids.length} visible dead monsters${suffix}.`);
    }

    qtyInput.addEventListener('input', () => {
      // Only apply when a real number is typed; empty input should not force-clear selection.
      if (String(qtyInput.value || '').trim() === '') return;
      applyQtySelection();
    });
    qtyInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') applyQtySelection();
    });

    btnClear.addEventListener('click', () => {
      clearSelection();
      setStatus('Selection cleared.');
    });

    btnLoot.addEventListener('click', async () => {
      ensureLootCheckboxes();
      const ids = getSelectedLootIds();
      if (!ids.length) {
        setStatus('No selected dead monsters to loot.');
        return;
      }
      await lootMany(ids, { disable: [btnSelVisible, btnClear, btnLoot] });
    });

    try {
      const saved = window.sessionStorage.getItem(FILTER_KEY);
      if (saved !== null && saved !== undefined) selType.value = String(saved);
    } catch {
      // ignore
    }

    selType.addEventListener('change', () => {
      applyTypeFilter();
      ensureLootCheckboxes();
    });

    btnReloadTypes.addEventListener('click', () => {
      clearAllDeadTypesCacheForCurrentWave();
      // Kick off fetch again and refresh options.
      allDeadTypesFetch = null;
      lastAllDeadTypesBaseUrl = '';
      kickOffAllDeadTypesPrefetch();
      ensureTypeFilterOptions();
    });

    btnLoadAllDead.addEventListener('click', async () => {
      btnLoadAllDead.disabled = true;
      try {
        await mergeAllDeadPagesIntoOne();
      } finally {
        btnLoadAllDead.disabled = false;
      }
    });

    autoLoadCb.addEventListener('change', () => {
      setAutoLoadAllDeadEnabled(!!autoLoadCb.checked);
      setStatus(autoLoadCb.checked ? 'Auto-load enabled.' : 'Auto-load disabled.');
      maybeAutoLoadAllDeadPages();
    });

    function updateGoToTypeButton() {
      const chosen = normName(selType.value || '').toLowerCase();
      if (!chosen) {
        btnGoToType.disabled = true;
        btnGoToType.textContent = 'Go to type page';
        return;
      }

      const baseUrl = getBaseWaveUrl();
      const cached = tryLoadAllDeadIndex(baseUrl);
      const firstPage = cached?.firstPageByType instanceof Map ? cached.firstPageByType.get(chosen) : 0;

      const cur = new URL(window.location.href);
      const curPage = parseInt(cur.searchParams.get('dead_page') || '1', 10) || 1;

      if (firstPage && firstPage > 0 && firstPage !== curPage) {
        btnGoToType.disabled = false;
        btnGoToType.textContent = `Go to dead page ${firstPage}`;
        btnGoToType.dataset.tmTargetPage = String(firstPage);
      } else {
        btnGoToType.disabled = true;
        btnGoToType.textContent = 'Go to type page';
        delete btnGoToType.dataset.tmTargetPage;
      }
    }

    btnGoToType.addEventListener('click', () => {
      const target = parseInt(btnGoToType.dataset.tmTargetPage || '0', 10);
      if (!target) return;
      const u = new URL(window.location.href);
      if (target > 1) u.searchParams.set('dead_page', String(target));
      else u.searchParams.delete('dead_page');
      window.location.href = u.toString();
    });

    ensureTypeFilterOptions();
    applyTypeFilter();
    updateGoToTypeButton();

    selType.addEventListener('change', updateGoToTypeButton);

    applyCardSizeFromStorage();
  }

  async function lootOne(monsterId) {
    const fd = new FormData();
    fd.append('monster_id', String(monsterId));
    const res = await fetch(LOOT_URL, { method: 'POST', body: fd, credentials: 'same-origin', cache: 'no-store' });
    const ct = String(res.headers.get('content-type') || '').toLowerCase();
    const data = ct.includes('application/json') ? await res.json().catch(() => ({})) : await res.text().catch(() => '');
    const ok = typeof data === 'object' && data && data.status === 'success';
    return {
      ok,
      message: ok
        ? (data.message || 'OK')
        : (typeof data === 'object' && data && data.message ? data.message : (res.ok ? 'Failed' : `HTTP ${res.status}`)),
      items: ok && Array.isArray(data.items) ? data.items : [],
      exp: ok ? (data.rewards?.exp || 0) : 0,
      gold: ok ? (data.rewards?.gold || 0) : 0
    };
  }

  async function lootMany(targetIds, opts) {
    const disable = Array.isArray(opts?.disable) ? opts.disable.filter(Boolean) : [];
    for (const b of disable) b.disabled = true;

    let ok = 0;
    let fail = 0;
    let firstFail = '';
    let totalExp = 0;
    let totalGold = 0;
    const allItems = [];
    const allNotes = [];

    for (let i = 0; i < targetIds.length; i++) {
      setStatus(`Looting ${i + 1}/${targetIds.length}... (success: ${ok}, fail: ${fail})`);
      try {
        const r = await lootOne(targetIds[i]);
        if (r.ok) {
          ok++;
          totalExp += Number(r.exp || 0) || 0;
          totalGold += Number(r.gold || 0) || 0;
          if (Array.isArray(r.items) && r.items.length) allItems.push(...r.items);
          else allNotes.push(r.message || 'Looted (no items)');
          const el = document.querySelector(`.monster-card[data-monster-id="${targetIds[i]}"]`);
          if (el) el.setAttribute('data-eligible', '0');
          const cb = document.querySelector(`input.tm-loot-select[data-monster-id="${targetIds[i]}"]`);
          if (cb) cb.checked = false;
        } else {
          fail++;
          if (!firstFail) firstFail = r.message || 'Failed';
          allNotes.push(r.message || 'Failed');
        }
      } catch {
        fail++;
        if (!firstFail) firstFail = 'Server error';
        allNotes.push('Server error');
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    updateSelectedCount();
    setStatus(`Done. Looted ${ok}, failed ${fail}.${firstFail ? ` First fail: ${firstFail}` : ''}`);
    openLootModal(
      { processed: targetIds.length, success: ok, fail, exp: totalExp, gold: totalGold },
      allItems,
      allNotes
    );
    for (const b of disable) b.disabled = false;
  }

  function debounce(fn, delayMs) {
    let t = 0;
    return function (...args) {
      if (t) window.clearTimeout(t);
      t = window.setTimeout(() => fn.apply(this, args), delayMs);
    };
  }

  function wireObservers() {
    const run = debounce(() => {
      ensureControls();
      applyButtonThemeFromReference(document.getElementById('tmLootControls'));
      if (hasGraveyard()) {
        const controls = document.getElementById('tmLootControls');
        if (controls) controls.style.display = '';
        ensureTypeFilterOptions();
        applyTypeFilter();
        ensureLootCheckboxes();
        maybeAutoLoadAllDeadPages();
      } else {
        const controls = document.getElementById('tmLootControls');
        if (controls) controls.style.display = 'none';
      }
      syncWaveSizeControls();
      syncNativeWaveQolPanel();
    }, 250);

    const firstCard = document.querySelector('.monster-card[data-monster-id]');
    const container =
      (firstCard ? (firstCard.closest('.monster-container') || firstCard.closest('.custom-monster-container') || firstCard.parentElement) : null) ||
      document.querySelector('.monster-container') ||
      document.querySelector('.custom-monster-container') ||
      document.body;
    if (container) {
      const mo = new MutationObserver(run);
      mo.observe(container, { childList: true, subtree: true });
    }

    document.addEventListener('click', (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const id = t.id || '';
      const text = (t.textContent || '').trim();
      if (
        id === 'toggleDeadBtn' ||
        id === 'toggleDeadBossBtn' ||
        /\bShow Alive monsters\b/i.test(text) ||
        /\bShow unclaimed kills\b/i.test(text)
      ) {
        window.setTimeout(run, 250);
      }
    }, true);
  }

  if (!/\/active_wave\.php$/i.test(window.location.pathname)) return;

  // Always install styles + observers so the UI works even if dead cards render later (page 1 often loads them after toggles).
  ensureStyles();
  applyCardSizeFromStorage();
  syncWaveSizeControls();
  syncNativeWaveQolPanel();

  window.setTimeout(() => {
    // Only show controls if there are dead cards. Observers will handle later renders.
    ensureControls();
    const controls = document.getElementById('tmLootControls');
    if (controls) controls.style.display = hasGraveyard() ? '' : 'none';

    if (hasGraveyard()) {
      ensureTypeFilterOptions();
      applyTypeFilter();
      ensureLootCheckboxes();
      maybeAutoLoadAllDeadPages();
    }
    syncWaveSizeControls();
    syncNativeWaveQolPanel();
  }, 300);

  window.setInterval(() => {
    syncWaveSizeControls();
    syncNativeWaveQolPanel();
  }, 750);

  wireObservers();
})();


// ============================================================
// Module: Shadowbridge Warrens Monster Board (shadowbridge-warrens-monsters.user.js)
// ============================================================

(function () {
  'use strict';

  const DUNGEON_NAME = 'Shadowbridge Warrens';
  const PANEL_ID = 'tm-shadowbridge-monster-board';
  const STYLE_ID = 'tm-shadowbridge-monster-board-style';
  const QUOTA_STORAGE_KEY = 'tm_shadowbridge_daily_rule_usage_v2';
  const DAMAGE_MODEL_KEY = 'tm_shadowbridge_damage_model_v1';
  const DAMAGE_CACHE_KEY = 'tm_shadowbridge_damage_cache_v1';
  const CARD_SIZE_KEY = 'tm_monster_card_size_v1';
  const CARD_SIZE_LEGACY_KEYS = ['tm_sbw_card_size_v1', 'tm_graveyard_card_size_v1'];
  const BOARD_COLLAPSED_KEY = 'tm_shadowbridge_board_collapsed_v1';
  const ATTACK_GAP_MS = 1100;
  const DAMAGE_FETCH_CONCURRENCY = 6;
  const USER_ID = getUserId();
  const LIMIT_PRESETS = [
    { item: 'Arcane Treat M', nameIncludes: 'talla', locationIncludes: ['plunder warrens'], maxTargets: 1, targetDamage: 9000000 },
    { item: 'Arcane Treat M', nameIncludes: 'rukka', locationIncludes: ['shattered stone causeways', 'territory center'], maxTargets: 5, targetDamage: 10000000 },
    { item: 'Arcane Treat M', nameIncludes: 'gorvash', locationIncludes: ['territory center'], maxTargets: 3, targetDamage: 10000000 },
    { item: 'Arcane Treat M', nameIncludes: 'pip', locationIncludes: ['shattered stone causeways'], maxTargets: 1, targetDamage: 10000000 },
    { item: 'Arcane Treat S', nameIncludes: 'shagra', locationIncludes: ['plunder warrens'], maxTargets: 10, targetDamage: 4000000 },
    { item: 'Arcane Treat S', nameIncludes: 'droknar', locationIncludes: ['shattered stone causeways'], maxTargets: 5, targetDamage: 4000000 },
    { item: 'Arcane Treat S', nameIncludes: 'vorga', locationIncludes: ['brood pits'], maxTargets: 10, targetDamage: 4000000 },
    { item: 'Arcane Treat S', nameIncludes: 'nib', locationIncludes: ['brood pits'], maxTargets: 3, targetDamage: 6000000 },
    { item: 'Full Stamina Potion', nameIncludes: 'gribble', locationIncludes: ['plunder warrens', 'territory center'], maxTargets: 15, targetDamage: 1000000 },

    // EXP cap targets (no daily max-target limit; aim slightly under cap).
    { item: 'EXP Cap', nameIncludes: 'urzul', locationIncludes: [''], maxTargets: 9999, targetDamage: 6900000 },
    { item: 'EXP Cap', nameIncludes: 'makra', locationIncludes: [''], maxTargets: 9999, targetDamage: 4900000 },
    { item: 'EXP Cap', nameIncludes: 'brog', locationIncludes: [''], maxTargets: 9999, targetDamage: 2900000 },
    { item: 'EXP Cap', nameIncludes: 'tharka', locationIncludes: [''], maxTargets: 9999, targetDamage: 4900000 },
    { item: 'EXP Cap', nameIncludes: 'hruk', locationIncludes: [''], maxTargets: 9999, targetDamage: 6900000 },
    { item: 'EXP Cap', nameIncludes: 'zorgra', locationIncludes: [''], maxTargets: 9999, targetDamage: 9900000 },
    { item: 'EXP Cap', nameIncludes: 'stone-rend', locationIncludes: [''], maxTargets: 9999, targetDamage: 6900000 },
    { item: 'EXP Cap', nameIncludes: 'krak', locationIncludes: [''], maxTargets: 9999, targetDamage: 6900000 },
    { item: 'EXP Cap', nameIncludes: 'skrit', locationIncludes: [''], maxTargets: 9999, targetDamage: 7500000 }
  ];

  let started = false;
  let mo = null;

  function startOnce() {
    if (started) return;
    if (!isMainDungeonPage()) return;
    started = true;

    if (mo) {
      try { mo.disconnect(); } catch {}
      mo = null;
    }

    injectStyles();
    try { document.documentElement.classList.add('tm-sbw-map-page-root'); } catch {}
    try { document.body.classList.add('tm-sbw-map-page'); } catch {}
    init().catch((error) => {
      console.error('[TM Shadowbridge]', error);
      renderError(`Failed to load monster list: ${error.message || error}`);
    });
  }

  // Some pages render pins a bit late; observe for a short while.
  startOnce();
  if (!started) {
    mo = new MutationObserver(() => startOnce());
    mo.observe(document.documentElement, { childList: true, subtree: true });
    window.setTimeout(() => {
      if (mo) {
        try { mo.disconnect(); } catch {}
        mo = null;
      }
    }, 12000);
  }

  function getSavedCardSize() {
    try {
      const direct = window.sessionStorage.getItem(CARD_SIZE_KEY);
      if (direct !== null && direct !== undefined) return String(direct || '');
    } catch {}

    for (const k of CARD_SIZE_LEGACY_KEYS) {
      try {
        const v = window.sessionStorage.getItem(k);
        if (v !== null && v !== undefined) return String(v || '');
      } catch {}
    }
    return '';
  }

  function setSavedCardSize(value) {
    const v = String(value || '');
    try { window.sessionStorage.setItem(CARD_SIZE_KEY, v); } catch {}
    for (const k of CARD_SIZE_LEGACY_KEYS) {
      try { window.sessionStorage.setItem(k, v); } catch {}
    }
  }

  function getSavedBoardCollapsed() {
    try {
      const raw = window.localStorage.getItem(BOARD_COLLAPSED_KEY);
      if (raw === null || raw === undefined || raw === '') return true;
      return raw === '1';
    } catch {}
    return true;
  }

  function setSavedBoardCollapsed(collapsed) {
    try {
      window.localStorage.setItem(BOARD_COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch {}
  }

  function applyBoardCollapsedState(board, collapsed) {
    board.classList.toggle('is-collapsed', !!collapsed);
    document.body?.classList.toggle('tm-sbw-board-collapsed', !!collapsed);
    document.documentElement?.classList.toggle('tm-sbw-board-collapsed', !!collapsed);
    const btn = board.querySelector('[data-role="toggle-board-collapse"]');
    if (btn) {
      btn.textContent = collapsed ? 'Expand Board' : 'Collapse Board';
      btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      btn.setAttribute('title', collapsed ? 'Show the full monster board' : 'Hide the full monster board');
    }
  }

  function isMainDungeonPage() {
    const title = (document.title || '').toLowerCase();
    const hasTitle = title.includes(DUNGEON_NAME.toLowerCase());

    const hasMap = !!document.querySelector('.mapwrap, .mapframe');
    const hasPin = !!document.querySelector('a.pin[href*="guild_dungeon_location.php"]');

    // Primary signal: map+pins exist.
    if (hasMap && hasPin) return true;

    // Fallback signal: title matches and pins exist (some layouts omit .mapwrap/.mapframe classes).
    if (hasTitle && hasPin) return true;

    return false;
  }

  async function init() {
    const mapPanel = document.querySelector('.mapframe')?.closest('.panel');
    const mapWrap = document.querySelector('.mapwrap');
    const pins = Array.from(document.querySelectorAll('a.pin[href*="guild_dungeon_location.php"]'))
      .filter((pin) => !pin.classList.contains('locked'));

    if (!mapPanel || !mapWrap || pins.length === 0) {
      throw new Error('Could not find the dungeon map or location pins.');
    }

    mapPanel.classList.add('tm-sbw-map-panel');
    const board = createBoardShell(pins.length);
    const leaderboardPanel = document.querySelector('.lb')?.closest('.panel');
    const insertAfter = leaderboardPanel || mapPanel;
    insertAfter.insertAdjacentElement('afterend', board);

    const locations = await Promise.all(
      pins.map(async (pin) => {
        const href = pin.getAttribute('href');
        const url = new URL(href, window.location.origin);
        const left = pin.style.left || '50%';
        const top = pin.style.top || '50%';
        const title = cleanText(pin.getAttribute('title') || pin.querySelector('.label')?.textContent || 'Unknown location');
        const location = await fetchLocation(url, title);
        return { ...location, url: url.toString(), left, top, title, key: slugify(location.locationName || title) };
      })
    );

    renderBoard(board, mapWrap, locations);
  }

  async function fetchLocation(url, fallbackName) {
    const response = await fetch(url.toString(), { credentials: 'include' });
    if (!response.ok) {
      throw new Error(`Request failed for ${fallbackName} (${response.status})`);
    }

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const locationName = cleanText(
      doc.querySelector('.h')?.textContent?.replace(/^📍\s*/u, '') || fallbackName
    );
    const monsterCards = Array.from(doc.querySelectorAll('.mon'));

    const monsters = monsterCards.map((card) => parseMonsterCard(card, url));
    return { locationName, monsters };
  }

  function parseMonsterCard(card, baseUrl) {
    const nameBlock = card.querySelector('div[style*="font-weight:700"]');
    const nameClone = nameBlock ? nameBlock.cloneNode(true) : null;
    if (nameClone) {
      nameClone.querySelectorAll('.row, .pill').forEach((node) => node.remove());
    }

    const actionLink = card.querySelector('a.btn[href*="battle.php"]');
    const hpText = cleanText(
      Array.from(card.querySelectorAll('.muted')).find((node) => /HP/i.test(node.textContent || ''))?.textContent || ''
    );
    const statValue = (label) =>
      cleanText(
        Array.from(card.querySelectorAll('.statpill')).find((node) =>
          node.textContent?.toUpperCase().includes(label)
        )?.querySelector('.v')?.textContent || ''
      );

    const actionUrl = actionLink ? new URL(actionLink.getAttribute('href'), baseUrl) : null;

    return {
      name: cleanText(nameClone?.textContent || 'Unknown monster'),
      dead: card.classList.contains('dead'),
      joined: /\bjoined\b/i.test(card.textContent || '') && !/\bnot joined\b/i.test(card.textContent || ''),
      hp: hpText,
      atk: statValue('ATK'),
      def: statValue('DEF'),
      expPerDamage: statValue('EXP/DMG'),
      image: card.querySelector('img')?.getAttribute('src') || '',
      actionLabel: cleanText(actionLink?.textContent || (card.classList.contains('dead') ? 'View' : 'Fight')),
      actionUrl: actionUrl ? actionUrl.toString() : '',
      dgmid: actionUrl?.searchParams.get('dgmid') || '',
      instanceId: actionUrl?.searchParams.get('instance_id') || '',
      personalDamage: null
    };
  }

  function createBoardShell(locationCount) {
    const board = document.createElement('section');
    board.id = PANEL_ID;
    board.className = 'panel tm-sbw-board';
    board.innerHTML = `
      <div class="tm-sbw-head">
        <div>
          <div class="h">All Shadowbridge Monsters</div>
          <div class="tm-sbw-sub">Loading monsters from ${locationCount} map locations...</div>
        </div>
        <div class="tm-sbw-head-actions">
          <button type="button" class="btn" data-role="toggle-board-collapse">Expand Board</button>
          <button type="button" class="btn tm-sbw-refresh">Refresh</button>
        </div>
      </div>
      <div class="tm-sbw-summary"></div>
      <div class="tm-sbw-qol">
        <div class="qol-top">
          <div class="qol-filters">
            <span class="qol-title">🗺️ D1 Multi Targets</span>

            <div class="select-wrap">
              <select id="fNameSel" class="modern-select" data-role="name-filter">
                <option value="">All monsters</option>
              </select>
            </div>

            <div class="select-wrap">
              <select id="d1SizeSel" class="modern-select" data-role="size-filter" title="Monster card size">
                <option value="">Size: Normal</option>
                <option value="small">Size: Small</option>
                <option value="tiny">Size: Tiny</option>
              </select>
            </div>

            <label><input type="checkbox" data-role="alive-filter" checked> Alive</label>
            <label><input type="checkbox" data-role="dead-filter" checked> Dead</label>
            <label><input type="checkbox" data-role="joined-filter" checked> Joined</label>
            <label><input type="checkbox" data-role="unjoined-filter" checked> Unjoined</label>

            <div class="qol-select-actions">
              <button class="btn" type="button" id="btnSelectVisible" data-role="select-visible">✅ Select visible</button>
              <button class="btn" type="button" id="btnClearSelect" data-role="clear-selected">🧹 Clear</button>
              <button type="button" class="btn btnAttackSettings" data-role="open-strat-settings">⚙️ 🧠 Settings</button>
            </div>

            <span class="tm-sbw-selected-count" data-role="selected-count">Selected: 0</span>
          </div>

          <div class="qol-attacks">
            <button class="btn btnQuickJoinAttack" type="button" data-role="quick-attack" data-skill-id="0" data-stam="1">⚡ Quick Join & Attack (1)</button>
            <button class="btn btnQuickJoinAttack" type="button" data-role="quick-attack" data-skill-id="-1" data-stam="10">⚡ Quick Join & Attack (10)</button>
            <button class="btn btnQuickJoinAttack" type="button" data-role="quick-attack" data-skill-id="-2" data-stam="50">⚡ Quick Join & Attack (50)</button>
            <button class="btn btnQuickJoinAttack" type="button" data-role="quick-attack" data-skill-id="-3" data-stam="100">⚡ Quick Join & Attack (100)</button>
            <button class="btn btnQuickJoinAttack" type="button" data-role="quick-attack" data-skill-id="-4" data-stam="200">⚡ Quick Join & Attack (200)</button>
            <button type="button" class="btn btnAttackStrat" data-role="attack-strat-run">🧠 Quick Join & Attack (50) (limit 3.5m)</button>
          </div>
        </div>

        <div class="tm-sbw-tools">
          <button class="btn" type="button" data-role="damage-test">DMG Test</button>
          <button class="btn" type="button" data-role="one-hit-quota">Fill Quota</button>
          <button class="btn" type="button" data-role="fill-all-treat-quotas">Fill Treat Quotas</button>
          <button class="btn" type="button" data-role="fill-all-xp-caps">Fill EXP Caps</button>
          <button class="btn" type="button" data-role="open-selected">Open selected</button>
        </div>

        <div class="tm-sbw-model-line" data-role="damage-model-line"></div>
        <div class="tm-sbw-run-line" data-role="run-line"></div>
        <div class="tm-sbw-multi-select-box" data-role="monster-grid"></div>
      </div>

      <div class="attack-strat-overlay" data-role="strat-overlay" style="display:none;">
        <div class="attack-strat-modal">
          <h3 class="attack-strat-title">🧠 Attack Strategy Builder</h3>

          <div class="attack-strat-picker" data-role="skill-picker">
            <button type="button" class="btn attack-strat-skill-btn" data-role="skill-pick" data-skill-id="0" data-stam="1">Slash (1)</button>
            <button type="button" class="btn attack-strat-skill-btn" data-role="skill-pick" data-skill-id="-1" data-stam="10">Power Slash (10)</button>
            <button type="button" class="btn attack-strat-skill-btn" data-role="skill-pick" data-skill-id="-2" data-stam="50">Heroic Slash (50)</button>
            <button type="button" class="btn attack-strat-skill-btn" data-role="skill-pick" data-skill-id="-3" data-stam="100">Ultimate Slash (100)</button>
            <button type="button" class="btn attack-strat-skill-btn" data-role="skill-pick" data-skill-id="-4" data-stam="200">Legendary Slash (200)</button>
          </div>

          <div class="attack-strat-label">Strategy order:</div>
          <div class="attack-strat-chips" data-role="strategy-chips"></div>

          <div class="attack-strat-meta">
            Total stamina cost: <span class="total-stam-cost" data-role="total-stam-cost">0</span>
            <div class="attack-strat-damage-limit" style="margin-top:8px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <input type="checkbox" class="attack-strat-checkbox" data-role="strat-use-limit">
              <label class="attack-strat-label">Use Damage Limit (useful for crits)</label>
              <input type="number" min="0" class="attack-strat-damage-limit-input" data-role="strat-limit" value="0">
            </div>
          </div>

          <div class="attack-strat-footer">
            <button class="btn attack-strat-close" type="button" data-role="strat-close">Close</button>
          </div>
        </div>
      </div>
      <div class="tm-sbw-modal" data-role="attack-modal" style="display:none;">
        <div class="tm-sbw-modal-box">
          <h2 class="tm-sbw-modal-head">Quick Join & Attack Results (refresh map after batches)</h2>
          <div class="tm-sbw-modal-note" data-role="attack-summary"></div>
          <div class="tm-sbw-modal-list" data-role="attack-list"></div>
          <div class="tm-sbw-modal-actions">
            <button class="btn" type="button" data-role="close-modal">Close</button>
          </div>
        </div>
      </div>
    `;

    board.querySelector('.tm-sbw-refresh')?.addEventListener('click', () => {
      board.remove();
      init().catch((error) => {
        console.error('[TM Shadowbridge]', error);
        renderError(`Refresh failed: ${error.message || error}`);
      });
    });

    board.querySelector('[data-role="close-modal"]')?.addEventListener('click', () => {
      const modal = board.querySelector('[data-role="attack-modal"]');
      if (modal) {
        modal.style.display = 'none';
      }
    });
    board.querySelector('[data-role="attack-modal"]')?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) {
        event.currentTarget.style.display = 'none';
      }
    });

    applyBoardCollapsedState(board, getSavedBoardCollapsed());

    return board;
  }

  function renderBoard(board, mapWrap, locations) {
    const summary = board.querySelector('.tm-sbw-summary');
    const nameFilter = board.querySelector('[data-role="name-filter"]');
    const sizeFilter = board.querySelector('[data-role="size-filter"]');

    const allMonsters = locations.flatMap((location) => location.monsters);
    const aliveCount = allMonsters.filter((monster) => !monster.dead).length;
    const deadCount = allMonsters.length - aliveCount;

    summary.innerHTML = [
      summaryPill(`${allMonsters.length} monsters found`),
      summaryPill(`${aliveCount} alive`, 'alive'),
      summaryPill(`${deadCount} dead`, 'dead')
    ].join('');

    nameFilter.innerHTML = [
      '<option value="">All monsters</option>',
      ...Array.from(new Set(allMonsters.map((monster) => monster.name))).sort((a, b) => a.localeCompare(b)).map(
        (name) => `<option value="${escapeHtml(name.toLowerCase())}">${escapeHtml(name)}</option>`
      )
    ].join('');

    // Restore size selector (shared global size).
    const saved = getSavedCardSize() || '';
    if (sizeFilter) sizeFilter.value = saved;
    board.dataset.size = saved;

    attachBoardBehavior(board, locations);
    board.querySelector('.tm-sbw-sub').textContent = 'Pulled live monster cards from each map location.';
  }

  function attachBoardBehavior(board, locations) {
    const selected = new Set();
    const quotaStore = createQuotaStore();
    const damageModel = createDamageModelStore();
    const damageCache = createDamageCacheStore();
    const allMonsters = locations.flatMap((location) =>
      location.monsters.map((monster, index) => ({
        ...monster,
        locationKey: location.key,
        locationName: location.locationName,
        roomUrl: location.url,
        id: `${location.key}-${index}`,
        limitRule: getLimitRule(monster.name, location.locationName)
      }))
    );

    const controls = {
      nameFilter: board.querySelector('[data-role="name-filter"]'),
      sizeFilter: board.querySelector('[data-role="size-filter"]'),
      toggleCollapse: board.querySelector('[data-role="toggle-board-collapse"]'),
      aliveFilter: board.querySelector('[data-role="alive-filter"]'),
      deadFilter: board.querySelector('[data-role="dead-filter"]'),
      joinedFilter: board.querySelector('[data-role="joined-filter"]'),
      unjoinedFilter: board.querySelector('[data-role="unjoined-filter"]'),
      monsterGrid: board.querySelector('[data-role="monster-grid"]'),
      selectedCount: board.querySelector('[data-role="selected-count"]'),
      openSelected: board.querySelector('[data-role="open-selected"]'),
      selectVisible: board.querySelector('[data-role="select-visible"]'),
      clearSelected: board.querySelector('[data-role="clear-selected"]'),
      damageTest: board.querySelector('[data-role="damage-test"]'),
      oneHitQuota: board.querySelector('[data-role="one-hit-quota"]'),
      fillAllTreatQuotas: board.querySelector('[data-role="fill-all-treat-quotas"]'),
      fillAllXpCaps: board.querySelector('[data-role="fill-all-xp-caps"]'),
      damageModelLine: board.querySelector('[data-role="damage-model-line"]'),
      runLine: board.querySelector('[data-role="run-line"]'),
      attackModal: board.querySelector('[data-role="attack-modal"]'),
      attackSummary: board.querySelector('[data-role="attack-summary"]'),
      attackList: board.querySelector('[data-role="attack-list"]')
    };

    const getRuleUsageMap = () => buildRuleUsageMap(allMonsters, quotaStore);

    const render = () => {
      const visible = getVisibleMonsters(controls, allMonsters);
      const usageMap = getRuleUsageMap();
      controls.monsterGrid.innerHTML = visible.map((monster) => renderMonsterChip(monster, selected.has(monster.id), usageMap, allMonsters)).join('');
      controls.selectedCount.textContent = `Selected: ${selected.size}`;
      controls.openSelected.disabled = selected.size === 0;
      controls.oneHitQuota.disabled = !damageModel.hasEstimate();
      controls.fillAllTreatQuotas.disabled = !damageModel.hasEstimate();
      controls.fillAllXpCaps.disabled = !damageModel.hasEstimate();
      controls.damageModelLine.textContent = `Non-crit estimate: ${damageModel.describe()}`;
      if (!controls.runLine.dataset.busy) {
        controls.runLine.textContent = '';
      }
    };

    hydratePersonalDamage(allMonsters, render).catch((error) => {
      console.error('[TM Shadowbridge damage hydrate]', error);
    });

    ['change', 'input'].forEach((eventName) => {
      controls.nameFilter.addEventListener(eventName, render);
      controls.sizeFilter?.addEventListener(eventName, () => {
        const next = String(controls.sizeFilter.value || '');
        board.dataset.size = next;
        setSavedCardSize(next);
      });
      controls.aliveFilter.addEventListener(eventName, render);
      controls.deadFilter.addEventListener(eventName, render);
      controls.joinedFilter.addEventListener(eventName, render);
      controls.unjoinedFilter.addEventListener(eventName, render);
    });

    controls.selectVisible?.addEventListener('click', () => {
      getVisibleMonsters(controls, allMonsters).forEach((monster) => selected.add(monster.id));
      render();
    });

    controls.clearSelected?.addEventListener('click', () => {
      selected.clear();
      render();
    });

    controls.toggleCollapse?.addEventListener('click', () => {
      const next = !board.classList.contains('is-collapsed');
      applyBoardCollapsedState(board, next);
      setSavedBoardCollapsed(next);
    });

    controls.monsterGrid.addEventListener('change', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || !target.classList.contains('tm-sbw-monster-check')) {
        return;
      }

      if (target.checked) {
        selected.add(target.value);
      } else {
        selected.delete(target.value);
      }
      controls.selectedCount.textContent = `Selected: ${selected.size}`;
      controls.openSelected.disabled = selected.size === 0;
    });

    controls.openSelected.addEventListener('click', () => {
      const selectedMonsters = allMonsters.filter((monster) => selected.has(monster.id) && monster.actionUrl);
      selectedMonsters.forEach((monster, index) => {
        window.open(monster.actionUrl, index === 0 ? '_self' : '_blank', 'noopener');
      });
    });

    controls.damageTest.addEventListener('click', async () => {
      const target = allMonsters.find((monster) =>
        selected.has(monster.id) &&
        monster.actionUrl &&
        monster.dgmid &&
        monster.instanceId &&
        !monster.dead
      );
      if (!target) {
        openAttackModal(board, {
          processed: 0,
          success: 0,
          failed: 1,
          results: [{ id: '-', ok: false, html: 'Select one live monster first for the damage test.' }]
        });
        return;
      }

      controls.damageTest.disabled = true;
      controls.damageTest.textContent = 'Testing...';
      const samples = [];
      const results = [];
      for (let i = 0; i < 5; i += 1) {
        try {
          const result = await quickJoinAndAttack(target, 0, 1);
          if (result.ok && result.damageDelta > 0) {
            samples.push(result.damageDelta);
            quotaStore.mark(target);
            target.personalDamage = Math.max(Number(target.personalDamage || 0) + Number(result.damageDelta || 0), Number(target.personalDamage || 0));
            damageCache.set(target, target.personalDamage);
            damageModel.addSample(result.damageDelta);
          }
          results.push({
            id: `${target.dgmid}-${i + 1}`,
            ok: result.ok,
            html: `Test hit ${i + 1}: ${result.html}`
          });
        } catch (error) {
          results.push({
            id: `${target.dgmid}-${i + 1}`,
            ok: false,
            html: `Test hit ${i + 1}: ${escapeHtml(error.message || 'Server error')}`
          });
        }
        await delay(ATTACK_GAP_MS);
      }

      openAttackModal(board, {
        processed: results.length,
        success: samples.length,
        failed: results.length - samples.length,
        results: [{
          id: target.dgmid,
          ok: samples.length > 0,
          html: `Estimated non-crit 1-stam damage: <strong>${escapeHtml(formatDamage(damageModel.getEstimate()))}</strong><br>Samples kept: ${escapeHtml(samples.map((value) => formatDamage(value)).join(', '))}`
        }].concat(results)
      });
      controls.damageTest.disabled = false;
      controls.damageTest.textContent = 'DMG Test';
      render();
    });

    const runFillQuota = async (candidates) => {
      const estimate = damageModel.getEstimate();
      if (!estimate) {
        return false;
      }

      const isMonsterStarted = (monster) => Number(monster.personalDamage || 0) > 0 || quotaStore.has(monster);
      const isMonsterFilled = (monster) =>
        monster.limitRule && Number(monster.personalDamage || 0) >= Number(monster.limitRule.targetDamage || 0);

      const buildFillPlan = () => {
        const usageMap = getRuleUsageMap();
        const byRule = new Map();

        candidates.forEach((monster) => {
          if (!monster.limitRule) {
            return;
          }
          const key = monster.limitRule.ruleKey;
          const list = byRule.get(key) || [];
          list.push(monster);
          byRule.set(key, list);
        });

        const planned = [];
        byRule.forEach((monsters, ruleKey) => {
          const usage = usageMap.get(ruleKey) || { started: 0 };
          const maxTargets = Number(monsters[0]?.limitRule?.maxTargets || 0);

          const started = monsters.filter((m) => isMonsterStarted(m));
          const startedUnfilled = started
            .filter((m) => !isMonsterFilled(m))
            .sort((a, b) => {
              const ar = Number(a.limitRule.targetDamage || 0) - Number(a.personalDamage || 0);
              const br = Number(b.limitRule.targetDamage || 0) - Number(b.personalDamage || 0);
              return br - ar;
            });

          const untouched = monsters.filter((m) => !isMonsterStarted(m));

          // If we've already started enough monsters for this rule, never start new ones.
          if (usage.started >= maxTargets) {
            planned.push(...startedUnfilled);
            return;
          }

          // Otherwise, allow starting only up to the remaining slots.
          const remainingStarts = Math.max(0, maxTargets - usage.started);
          planned.push(...startedUnfilled);
          planned.push(...untouched.slice(0, remainingStarts));
        });

        return planned;
      };

      // Pre-plan once so we don't start extra monsters due to stale/null damage values.
      const plannedCandidates = buildFillPlan();

      const results = [];
      let success = 0;
      let failed = 0;
      controls.oneHitQuota.disabled = true;
      controls.fillAllTreatQuotas.disabled = true;
      controls.fillAllXpCaps.disabled = true;
      controls.oneHitQuota.textContent = 'Running...';
      controls.fillAllTreatQuotas.textContent = 'Running...';
      controls.fillAllXpCaps.textContent = 'Running...';
      controls.runLine.dataset.busy = '1';
      controls.runLine.textContent = `Starting quota fill for ${plannedCandidates.length} monster(s)...`;

      for (let index = 0; index < plannedCandidates.length; index += 1) {
        const monster = plannedCandidates[index];
        const liveUsageMap = getRuleUsageMap();
        if (monster.limitRule && hasReachedLimit(monster, liveUsageMap)) {
          results.push({
            id: monster.dgmid || monster.name,
            ok: false,
            html: `Skipped: quota/cap reached<br>${escapeHtml(buildLimitSummary(monster, liveUsageMap, allMonsters))}`
          });
          controls.runLine.textContent = `Skipping ${monster.name} (${index + 1}/${plannedCandidates.length}) because quota/cap is already reached.`;
          continue;
        }

        try {
          let hitCount = 0;
          let dealtTotal = 0;
          let stopReason = 'estimate stop';
          let monsterOk = false;

          while (true) {
            const liveUsageMap = getRuleUsageMap();
            if (monster.limitRule && hasReachedLimit(monster, liveUsageMap)) {
              stopReason = 'quota/cap reached';
              controls.runLine.textContent = `Stopping ${monster.name}: quota/cap reached after ${hitCount} hit(s).`;
              break;
            }

            const currentRemaining = monster.limitRule
              ? Math.max(0, monster.limitRule.targetDamage - Number(monster.personalDamage || 0))
              : 0;
            const currentHp = parseCurrentHp(monster.hp);
            const pick = pickBestQuotaStamina(currentRemaining, estimate, currentHp);
            const chosenStamina = pick.stamina;
            const chosenEstimate = pick.estimatedDamage;
            controls.runLine.textContent = `Attacking ${monster.name} (${index + 1}/${plannedCandidates.length}) with ${chosenStamina} stam. Hit ${hitCount + 1}, current ${formatDamage(monster.personalDamage)}, left ${formatDamage(currentRemaining)}.`;

            const chosenSkill = getSkillByStamina(chosenStamina);
            const result = await quickJoinAndAttack(monster, chosenSkill.skillId, chosenStamina);
            if (!result.ok) {
              if (isRetryableAttackFailure(result)) {
                stopReason = 'cooldown wait';
                controls.runLine.textContent = `Waiting on cooldown for ${monster.name} before retrying...`;
                await delay(ATTACK_GAP_MS);
                continue;
              }
              failed += 1;
              results.push(result);
              stopReason = 'attack failed';
              controls.runLine.textContent = `Attack failed on ${monster.name}.`;
              break;
            }

            quotaStore.mark(monster);
            const delta = Number(result.damageDelta || 0);
            monster.personalDamage = Math.max(Number(monster.personalDamage || 0) + delta, Number(monster.personalDamage || 0));
            damageCache.set(monster, monster.personalDamage);
            damageModel.addSample(chosenStamina > 0 ? (delta / chosenStamina) : delta);
            dealtTotal += delta;
            hitCount += 1;
            monsterOk = true;
            stopReason = `${chosenStamina}-stam hit used (est. ${formatDamage(chosenEstimate)})`;
            await delay(ATTACK_GAP_MS);

            if (monster.limitRule && Number(monster.personalDamage || 0) >= Number(monster.limitRule.targetDamage || 0)) {
              stopReason = 'target reached';
              controls.runLine.textContent = `Finished ${monster.name}: now at ${formatDamage(monster.personalDamage)}.`;
              break;
            }
          }

          if (monsterOk) {
            success += 1;
            results.push({
              id: monster.dgmid || monster.name,
              ok: true,
              html: `Filled ${escapeHtml(monster.name)} with ${escapeHtml(String(hitCount))} hit(s)<br>Total dealt: <strong>${escapeHtml(formatDamage(dealtTotal))}</strong><br>Current DMG: ${escapeHtml(formatDamage(monster.personalDamage))}<br>Stopped: ${escapeHtml(stopReason)}`
            });
          }
        } catch (error) {
          failed += 1;
          results.push({
            id: monster.dgmid || monster.name,
            ok: false,
            html: `Failed: ${escapeHtml(error.message || 'Server error')}`
          });
          controls.runLine.textContent = `Unexpected error while filling ${monster.name}.`;
        }
        await delay(ATTACK_GAP_MS);
      }

      openAttackModal(board, {
        processed: results.length,
        success,
        failed: results.length - success,
        results
      });
      controls.oneHitQuota.disabled = !damageModel.hasEstimate();
      controls.fillAllTreatQuotas.disabled = !damageModel.hasEstimate();
      controls.fillAllXpCaps.disabled = !damageModel.hasEstimate();
      controls.oneHitQuota.textContent = 'Fill Quota';
      controls.fillAllTreatQuotas.textContent = 'Fill Treat Quotas';
      controls.fillAllXpCaps.textContent = 'Fill EXP Caps';
      controls.runLine.dataset.busy = '';
      controls.runLine.textContent = `Quota fill finished. Success: ${success}, Failed/Skipped: ${results.length - success}.`;
      render();
      return true;
    };

    controls.oneHitQuota.addEventListener('click', async () => {
      const candidates = allMonsters.filter((monster) =>
        selected.has(monster.id) &&
        monster.actionUrl &&
        monster.dgmid &&
        monster.instanceId &&
        !monster.dead
      );
      // Ensure limits are accurate before we start firing attacks.
      controls.runLine.dataset.busy = '1';
      controls.runLine.textContent = 'Loading your damage numbers...';
      await hydratePersonalDamage(candidates, render);
      await runFillQuota(candidates);
    });

    const runFillAllByKind = async (kind) => {
      const isXp = kind === 'xp';
      const candidates = allMonsters.filter((monster) => {
        if (!monster.limitRule) return false;
        if (isXp !== (monster.limitRule.item === 'EXP Cap')) return false;
        return (
          monster.actionUrl &&
          monster.dgmid &&
          monster.instanceId &&
          !monster.dead
        );
      });

      controls.runLine.dataset.busy = '1';
      controls.runLine.textContent = 'Loading your damage numbers...';
      await hydratePersonalDamage(candidates, render);
      await runFillQuota(candidates);
    };

    controls.fillAllTreatQuotas.addEventListener('click', async () => {
      await runFillAllByKind('treat');
    });

    controls.fillAllXpCaps.addEventListener('click', async () => {
      await runFillAllByKind('xp');
    });

    const STRAT_ORDER_KEY = 'tm_sbw_strategy_order_v1';
    const STRAT_USE_LIMIT_KEY = 'tm_sbw_strategy_use_limit_v2';
    const STRAT_LIMIT_KEY = 'tm_sbw_strategy_limit_v2';

    const SKILLS = [
      { skillId: 0, name: 'Slash', stamina: 1 },
      { skillId: -1, name: 'Power Slash', stamina: 10 },
      { skillId: -2, name: 'Heroic Slash', stamina: 50 },
      { skillId: -3, name: 'Ultimate Slash', stamina: 100 },
      { skillId: -4, name: 'Legendary Slash', stamina: 200 }
    ];

    function getSkillById(skillId) {
      const id = Number(skillId);
      return SKILLS.find((s) => s.skillId === id) || null;
    }

    function getSkillByStamina(stamina) {
      const s = Number(stamina);
      return SKILLS.find((sk) => sk.stamina === s) || SKILLS[0];
    }

    function readStrategyOrder() {
      try {
        const raw = window.sessionStorage.getItem(STRAT_ORDER_KEY) || '[]';
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr)) return [];
        return arr.map((x) => Number(x)).filter((n) => Number.isFinite(n) && !!getSkillById(n));
      } catch {
        return [];
      }
    }

    function writeStrategyOrder(order) {
      try { window.sessionStorage.setItem(STRAT_ORDER_KEY, JSON.stringify(order || [])); } catch {}
    }

    function readLimitConfig() {
      let useLimit = false;
      let limit = 0;
      try {
        useLimit = (window.sessionStorage.getItem(STRAT_USE_LIMIT_KEY) || '0') === '1';
        const l = parseInt(window.sessionStorage.getItem(STRAT_LIMIT_KEY) || '0', 10);
        if (Number.isFinite(l) && l >= 0) limit = l;
      } catch {}
      return { useLimit, limit };
    }

    function writeLimitConfig(next) {
      try { window.sessionStorage.setItem(STRAT_USE_LIMIT_KEY, next.useLimit ? '1' : '0'); } catch {}
      try { window.sessionStorage.setItem(STRAT_LIMIT_KEY, String(next.limit ?? 0)); } catch {}
    }

    function getStrategyTotalStam(order) {
      return (order || []).reduce((sum, id) => {
        const sk = getSkillById(id);
        return sum + (sk ? sk.stamina : 0);
      }, 0);
    }

    function fmtShort(n) {
      const num = Number(n || 0);
      if (!Number.isFinite(num)) return '0';
      if (num >= 1e9) return (num / 1e9).toFixed(1).replace(/\.0$/, '') + 'b';
      if (num >= 1e6) return (num / 1e6).toFixed(1).replace(/\.0$/, '') + 'm';
      if (num >= 1e3) return (num / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
      return String(Math.floor(num));
    }

    function updateStratRunLabel() {
      const btn = board.querySelector('[data-role="attack-strat-run"]');
      if (!btn) return;
      const order = readStrategyOrder();
      const total = getStrategyTotalStam(order);
      const lim = readLimitConfig();
      btn.disabled = order.length === 0;
      btn.textContent = `🧠 Quick Join & Attack (${total || 0})` + (lim.useLimit && lim.limit > 0 ? ` (limit ${fmtShort(lim.limit)})` : '');
      return;
      btn.textContent = `🧠 Quick Join & Attack (${total || 0})` + (lim.useLimit && lim.limit > 0 ? ` (limit ${fmtShort(lim.limit)})` : '');
      return;
      const s = readStrat();
      btn.textContent = `🧠 Quick Join & Attack (${s.stam})` + (s.useLimit ? ` (limit ${fmtShort(s.limit)})` : '');
    }

    function setAttackBusy(busy) {
      board.querySelectorAll('[data-role="quick-attack"], [data-role="attack-strat-run"], [data-role="open-selected"], [data-role="damage-test"], [data-role="one-hit-quota"], [data-role="fill-all-treat-quotas"], [data-role="fill-all-xp-caps"]').forEach((el) => {
        if (!(el instanceof HTMLButtonElement)) return;
        if (busy) {
          el.dataset.tmPrevDisabled = el.disabled ? '1' : '0';
          el.disabled = true;
        } else {
          const prev = el.dataset.tmPrevDisabled === '1';
          delete el.dataset.tmPrevDisabled;
          el.disabled = prev;
        }
      });
    }

    async function runQuickAttack(skillId, staminaCost) {
      const sid = Number(skillId);
      const stamina = Math.max(1, parseInt(String(staminaCost || '1'), 10) || 1);

      const candidates = allMonsters.filter((monster) =>
        selected.has(monster.id) &&
        monster.actionUrl &&
        monster.dgmid &&
        monster.instanceId &&
        !monster.dead
      );

      if (candidates.length === 0) {
        openAttackModal(board, {
          processed: 0,
          success: 0,
          failed: 1,
          results: [{ id: '-', ok: false, html: 'No live selected monsters with valid battle links were found.' }]
        });
        return;
      }

      setAttackBusy(true);
      const results = [];
      const skipped = [];
      let success = 0;
      let failed = 0;
      let processedCount = 0;

      for (const monster of candidates) {
        const liveUsageMap = getRuleUsageMap();
        if (monster.limitRule && hasReachedLimit(monster, liveUsageMap)) {
          skipped.push({
            id: monster.dgmid || monster.name,
            ok: false,
            html: `Skipped: target reached<br>${escapeHtml(buildLimitSummary(monster, liveUsageMap, allMonsters))}`
          });
          continue;
        }

        processedCount += 1;
        controls.selectedCount.textContent = `Selected: ${selected.size} | attacking ${processedCount}/${candidates.length}`;

        try {
          const result = await quickJoinAndAttack(monster, sid, stamina);
          if (result.ok) {
            results.push(result);
            quotaStore.mark(monster);
            const nextDamage = Number(monster.personalDamage || 0) + Number(result.damageDelta || 0);
            monster.personalDamage = Math.max(nextDamage, Number(monster.personalDamage || 0));
            damageCache.set(monster, monster.personalDamage);
            damageModel.addSample(stamina > 0 ? (Number(result.damageDelta || 0) / stamina) : Number(result.damageDelta || 0));
            success += 1;
          } else if (isRetryableAttackFailure(result)) {
            await delay(ATTACK_GAP_MS);
            processedCount -= 1;
            continue;
          } else {
            results.push(result);
            failed += 1;
          }
        } catch (error) {
          failed += 1;
          results.push({
            id: monster.dgmid || monster.name,
            ok: false,
            html: `Join: Failed<br>Attack: ${escapeHtml(error.message || 'Server error')}`
          });
        }
        await delay(ATTACK_GAP_MS);
      }

      openAttackModal(board, {
        processed: processedCount + skipped.length,
        success,
        failed: failed + skipped.length,
        results: results.concat(skipped)
      });

      setAttackBusy(false);
      controls.selectedCount.textContent = `Selected: ${selected.size}`;
      updateStratRunLabel();
      render();
    }

    async function runStrategyAttack() {
      const order = readStrategyOrder();
      const totalStam = getStrategyTotalStam(order);
      const lim = readLimitConfig();

      const candidates = allMonsters.filter((monster) =>
        selected.has(monster.id) &&
        monster.actionUrl &&
        monster.dgmid &&
        monster.instanceId &&
        !monster.dead
      );

      if (!order.length) {
        openAttackModal(board, { processed: 0, success: 0, failed: 1, results: [{ id: '-', ok: false, html: 'Add at least 1 attack to the strategy first.' }] });
        return;
      }

      if (candidates.length === 0) {
        openAttackModal(board, { processed: 0, success: 0, failed: 1, results: [{ id: '-', ok: false, html: 'No live selected monsters with valid battle links were found.' }] });
        return;
      }

      setAttackBusy(true);
      const results = [];
      let okCount = 0;
      let processedHits = 0;

      for (const monster of candidates) {
        for (let i = 0; i < order.length; i += 1) {
          const sk = getSkillById(order[i]);
          if (!sk) continue;

          const liveUsageMap = getRuleUsageMap();
          if (monster.limitRule && hasReachedLimit(monster, liveUsageMap)) {
            results.push({
              id: monster.dgmid || monster.name,
              ok: false,
              html: `Skipped: target reached<br>${escapeHtml(buildLimitSummary(monster, liveUsageMap, allMonsters))}`
            });
            break;
          }

          if (lim.useLimit && lim.limit > 0 && monster.limitRule) {
            const remaining = Math.max(0, Number(monster.limitRule.targetDamage || 0) - Number(monster.personalDamage || 0));
            if (remaining <= lim.limit) {
              results.push({
                id: monster.dgmid || monster.name,
                ok: false,
                html: `Stopped: remaining <= limit<br>Remaining: <strong>${escapeHtml(formatDamage(remaining))}</strong> | Limit: ${escapeHtml(formatDamage(lim.limit))}`
              });
              break;
            }
          }

          processedHits += 1;
          controls.selectedCount.textContent = `Selected: ${selected.size} | attacking ${processedHits}/${candidates.length} (${totalStam} stam)`;

          try {
            const r = await quickJoinAndAttack(monster, sk.skillId, sk.stamina);
            const withId = { ...r, id: `${monster.dgmid || monster.name} • ${sk.name} (${sk.stamina})` };
            results.push(withId);
            if (r.ok) {
              okCount += 1;
              quotaStore.mark(monster);
              const nextDamage = Number(monster.personalDamage || 0) + Number(r.damageDelta || 0);
              monster.personalDamage = Math.max(nextDamage, Number(monster.personalDamage || 0));
              damageCache.set(monster, monster.personalDamage);
              damageModel.addSample(sk.stamina > 0 ? (Number(r.damageDelta || 0) / sk.stamina) : Number(r.damageDelta || 0));
            } else if (isRetryableAttackFailure(r)) {
              await delay(ATTACK_GAP_MS);
              processedHits -= 1;
              i -= 1;
              results.pop();
              continue;
            }
          } catch (e) {
            results.push({
              id: `${monster.dgmid || monster.name} • ${sk.name} (${sk.stamina})`,
              ok: false,
              html: `Join: Failed<br>Attack: ${escapeHtml(e?.message || 'Server error')}`
            });
          }

          await delay(ATTACK_GAP_MS);
        }
      }

      openAttackModal(board, {
        processed: results.length,
        success: okCount,
        failed: results.length - okCount,
        results
      });

      setAttackBusy(false);
      controls.selectedCount.textContent = `Selected: ${selected.size}`;
      updateStratRunLabel();
      render();
    }

    board.querySelectorAll('[data-role="quick-attack"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const stam = parseInt(btn.getAttribute('data-stam') || '1', 10) || 1;
        const sid = parseInt(btn.getAttribute('data-skill-id') || '0', 10) || 0;
        await runQuickAttack(sid, stam);
      });
    });

    board.querySelector('[data-role="attack-strat-run"]')?.addEventListener('click', async () => {
      await runStrategyAttack();
    });

    const overlay = board.querySelector('[data-role="strat-overlay"]');
    const closeBtn = board.querySelector('[data-role="strat-close"]');
    const useLimitEl = board.querySelector('[data-role="strat-use-limit"]');
    const limitEl = board.querySelector('[data-role="strat-limit"]');
    const chipsEl = board.querySelector('[data-role="strategy-chips"]');
    const totalEl = board.querySelector('[data-role="total-stam-cost"]');

    function renderStrategyBuilder() {
      const order = readStrategyOrder();
      const lim = readLimitConfig();

      if (useLimitEl instanceof HTMLInputElement) useLimitEl.checked = !!lim.useLimit;
      if (limitEl instanceof HTMLInputElement) {
        limitEl.value = String(lim.limit || 0);
        limitEl.disabled = !lim.useLimit;
      }

      const total = getStrategyTotalStam(order);
      if (totalEl) totalEl.textContent = String(total);

      if (chipsEl) {
        chipsEl.innerHTML = order.length
          ? order.map((id, idx) => {
              const sk = getSkillById(id);
              const label = sk ? `${sk.name} (${sk.stamina})` : `Skill ${id}`;
              const upDis = idx === 0 ? 'is-disabled' : '';
              const dnDis = idx === order.length - 1 ? 'is-disabled' : '';
              return `
                <div class="attack-strat-chip" data-idx="${idx}">
                  <span class="attack-strat-chip-label">${escapeHtml(label)}</span>
                  <div class="attack-strat-chip-controls">
                    <button type="button" class="attack-strat-chip-btn attack-strat-chip-up ${upDis}" data-role="chip-up" title="Move up">↑</button>
                    <button type="button" class="attack-strat-chip-btn attack-strat-chip-down ${dnDis}" data-role="chip-down" title="Move down">↓</button>
                    <button type="button" class="attack-strat-chip-btn attack-strat-chip-remove" data-role="chip-remove" title="Remove">✕</button>
                  </div>
                </div>
              `;
            }).join('')
          : `<div class="attack-strat-chip" style="opacity:.65;"><span class="attack-strat-chip-label">Pick attacks above to build a strategy.</span></div>`;
      }

      updateStratRunLabel();
    }

    function openStratOverlay() {
      if (!overlay) return;
      overlay.style.display = 'flex';
      renderStrategyBuilder();
    }

    function closeStratOverlay() {
      if (!overlay) return;
      overlay.style.display = 'none';
      updateStratRunLabel();
    }

    board.querySelector('[data-role="open-strat-settings"]')?.addEventListener('click', openStratOverlay);
    closeBtn?.addEventListener('click', closeStratOverlay);
    overlay?.addEventListener('click', (e) => {
      if (e.target === overlay) closeStratOverlay();
    });

    board.querySelectorAll('[data-role="skill-pick"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const order = readStrategyOrder();
        const sid = parseInt(btn.getAttribute('data-skill-id') || '0', 10);
        if (!Number.isFinite(sid)) return;
        order.push(sid);
        writeStrategyOrder(order);
        renderStrategyBuilder();
      });
    });

    chipsEl?.addEventListener('click', (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const chip = t.closest('.attack-strat-chip');
      if (!chip) return;
      const idx = parseInt(chip.getAttribute('data-idx') || '-1', 10);
      if (!Number.isFinite(idx) || idx < 0) return;

      const order = readStrategyOrder();
      if (idx >= order.length) return;

      if (t.matches('[data-role="chip-remove"]')) {
        order.splice(idx, 1);
        writeStrategyOrder(order);
        renderStrategyBuilder();
        return;
      }
      if (t.matches('[data-role="chip-up"]') && idx > 0) {
        const tmp = order[idx - 1];
        order[idx - 1] = order[idx];
        order[idx] = tmp;
        writeStrategyOrder(order);
        renderStrategyBuilder();
        return;
      }
      if (t.matches('[data-role="chip-down"]') && idx < order.length - 1) {
        const tmp = order[idx + 1];
        order[idx + 1] = order[idx];
        order[idx] = tmp;
        writeStrategyOrder(order);
        renderStrategyBuilder();
        return;
      }
    });

    function persistLimit() {
      const next = readLimitConfig();
      if (useLimitEl instanceof HTMLInputElement) next.useLimit = !!useLimitEl.checked;
      if (limitEl instanceof HTMLInputElement) next.limit = Math.max(0, parseInt(limitEl.value || '0', 10) || 0);
      writeLimitConfig(next);
      renderStrategyBuilder();
    }

    useLimitEl?.addEventListener('change', persistLimit);
    limitEl?.addEventListener('input', persistLimit);

    updateStratRunLabel();

    render();
  }

  function getVisibleMonsters(controls, monsters) {
    const showAlive = !!controls.aliveFilter?.checked;
    const showDead = !!controls.deadFilter?.checked;
    const showJoined = !!controls.joinedFilter?.checked;
    const showUnjoined = !!controls.unjoinedFilter?.checked;
    const nameFilter = String(controls.nameFilter?.value || '').trim();

    return monsters.filter((monster) => {
      if (nameFilter && monster.name.toLowerCase() !== nameFilter) {
        return false;
      }
      if (monster.dead && !showDead) {
        return false;
      }
      if (!monster.dead && !showAlive) {
        return false;
      }
      if (monster.joined && !showJoined) {
        return false;
      }
      if (!monster.joined && !showUnjoined) {
        return false;
      }
      return true;
    });
  }

  function renderMonsterChip(monster, checked, usageMap, allMonsters) {
    const imageUrl = monster.image ? new URL(monster.image, window.location.origin).toString() : '';
    const statusClass = monster.dead ? 'dead' : 'alive';
    const metaLabel = monster.dead ? 'Dead' : 'Alive';
    const limitRule = monster.limitRule;
    const remaining = limitRule ? Math.max(0, limitRule.targetDamage - Number(monster.personalDamage || 0)) : null;
    const usage = limitRule ? usageMap.get(limitRule.ruleKey) || { started: 0, capped: 0 } : null;
    const slotLocked = limitRule ? isRuleSlotLocked(monster, usageMap) : false;
    const untouched = limitRule ? countUntouchedRuleMonsters(limitRule, allMonsters, usageMap) : 0;

    return `
      <label class="tm-sbw-monster-chip ${statusClass}">
        <input type="checkbox" class="tm-sbw-monster-check" value="${escapeHtml(monster.id)}" ${checked ? 'checked' : ''}>
        <div class="tm-sbw-monster-card">
          <div class="tm-sbw-monster-top">
            ${imageUrl ? `<img class="tm-sbw-monster-img" src="${escapeHtml(imageUrl)}" alt="">` : ''}
            <div class="tm-sbw-monster-main">
              <div class="tm-sbw-monster-name">${escapeHtml(monster.name)}</div>
              <div class="tm-sbw-monster-meta">
                <span class="tm-sbw-badge ${statusClass}">${metaLabel}</span>
                <span class="tm-sbw-badge">${monster.joined ? 'Joined' : 'Not joined'}</span>
              </div>
              <div class="tm-sbw-stats">
                <span class="tm-sbw-user-dmg">Your DMG ${escapeHtml(formatDamage(monster.personalDamage))}</span>
                ${limitRule ? `<span class="tm-sbw-limit-note ${remaining === 0 ? 'done' : ''} ${slotLocked ? 'locked' : ''}">${escapeHtml(limitRule.item)} ${escapeHtml(String(limitRule.maxTargets))}x${escapeHtml(shortDamage(limitRule.targetDamage))} | hit today ${escapeHtml(String(usage.started))}/${escapeHtml(String(limitRule.maxTargets))} | untouched ${escapeHtml(String(untouched))} | left ${escapeHtml(formatDamage(remaining))}${slotLocked ? ' | slots full' : ''}</span>` : ''}
                <span>HP ${escapeHtml(monster.hp || '?')}</span>
                <span>ATK ${escapeHtml(monster.atk || '?')}</span>
                <span>DEF ${escapeHtml(monster.def || '?')}</span>
                <span>EXP/dmg ${escapeHtml(monster.expPerDamage || '?')}</span>
              </div>
            </div>
          </div>
          <div class="tm-sbw-monster-actions">
            ${monster.actionUrl ? `<a class="btn tm-sbw-action" href="${escapeHtml(monster.actionUrl)}">${escapeHtml(monster.actionLabel)}</a>` : ''}
          </div>
        </div>
      </label>
    `;
  }

  async function quickJoinAndAttack(monster, skillId, staminaCost) {
    const joinPayload = {
      dgmid: monster.dgmid,
      instance_id: monster.instanceId
    };

    if (USER_ID) {
      joinPayload.user_id = USER_ID;
    }

    const joinResult = await postForm('dungeon_join_battle.php', joinPayload);
    const joinText = normalizeResponseMessage(joinResult);

    const attackResult = await postForm('damage.php', {
      dgmid: monster.dgmid,
      instance_id: monster.instanceId,
      skill_id: String(skillId ?? 0),
      stamina_cost: String(staminaCost)
    });

    const attackJson = attackResult.data || {};
    const attackText = normalizeAttackMessage(attackResult, monster.name);
    const ok = attackResult.ok && String(attackJson.status || '').trim().toLowerCase() === 'success';
    const damageDelta = Number(attackJson.damage_dealt || attackJson.damage || parseDamageFromHtml(attackJson.message || attackResult.raw) || 0);

    return {
      id: monster.dgmid,
      ok,
      damageDelta,
      messageText: cleanText(
        attackJson.message ||
        attackJson.error ||
        attackResult.raw ||
        ''
      ),
      data: attackJson,
      raw: attackResult.raw,
      html: `Join: ${escapeHtml(joinText)}<br>Attack: ${attackText}`
    };
  }

  async function postForm(url, payload) {
    const body = new URLSearchParams();
    Object.entries(payload || {}).forEach(([key, value]) => {
      body.set(key, String(value));
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      credentials: 'same-origin',
      body: body.toString()
    });

    const raw = await response.text();
    let data = null;
    try {
      data = JSON.parse(raw);
    } catch (_error) {
      data = null;
    }

    return { ok: response.ok, raw, data };
  }

  function normalizeResponseMessage(result) {
    if (result.data?.message) {
      return cleanText(result.data.message);
    }
    if (result.data?.error) {
      return cleanText(result.data.error);
    }
    return cleanText(result.raw || (result.ok ? 'OK' : 'Failed'));
  }

  function normalizeAttackMessage(result, fallbackName) {
    if (result.data?.message) {
      return result.data.message;
    }
    if (result.data?.error) {
      return escapeHtml(cleanText(result.data.error));
    }
    const raw = cleanText(result.raw || '');
    if (raw) {
      return escapeHtml(raw);
    }
    return `No response while attacking <strong>${escapeHtml(fallbackName)}</strong>.`;
  }

  function isRetryableAttackFailure(result) {
    const text = cleanText(
      result?.messageText ||
      result?.data?.message ||
      result?.data?.error ||
      result?.raw ||
      ''
    ).toLowerCase();
    return text.includes('slow down') || text.includes('too quickly') || text.includes('take your time');
  }

  function openAttackModal(board, summary) {
    const modal = board.querySelector('[data-role="attack-modal"]');
    const summaryEl = board.querySelector('[data-role="attack-summary"]');
    const listEl = board.querySelector('[data-role="attack-list"]');
    if (!modal || !summaryEl || !listEl) {
      return;
    }

    summaryEl.textContent = `Processed: ${summary.processed} | Success: ${summary.success} | Failed: ${summary.failed}`;
    listEl.innerHTML = (summary.results || []).map((result) => `
      <div class="tm-sbw-result ${result.ok ? 'ok' : 'fail'}">
        <div class="tm-sbw-result-head">
          <div class="tm-sbw-result-id">#${escapeHtml(result.id)}</div>
          <div class="tm-sbw-result-status">${result.ok ? 'OK' : 'FAILED'}</div>
        </div>
        <div class="tm-sbw-result-body">${result.html}</div>
      </div>
    `).join('');
    modal.style.display = 'flex';
  }

  async function hydratePersonalDamage(monsters, rerender) {
    if (!USER_ID) {
      return;
    }

    const damageCache = createDamageCacheStore();
    const queue = monsters.filter((monster) => monster.actionUrl && monster.personalDamage === null);

    let changed = false;
    queue.forEach((monster) => {
      const cached = damageCache.get(monster);
      if (cached !== null) {
        monster.personalDamage = cached;
        changed = true;
      }
    });
    if (changed) {
      rerender();
    }

    const pending = queue.filter((monster) => monster.personalDamage === null);
    let completed = 0;
    let lastRenderAt = 0;
    const maybeRender = (force = false) => {
      const now = Date.now();
      if (force || completed % 4 === 0 || (now - lastRenderAt) > 200) {
        lastRenderAt = now;
        rerender();
      }
    };
    await runWithConcurrency(pending, DAMAGE_FETCH_CONCURRENCY, async (monster) => {
      try {
        const damage = await fetchPersonalDamage(monster.actionUrl);
        monster.personalDamage = damage;
        damageCache.set(monster, damage);
      } catch (_error) {
        monster.personalDamage = 0;
        damageCache.set(monster, 0);
      }
      completed += 1;
      maybeRender();
    });
    if (pending.length > 0) {
      maybeRender(true);
    }
  }

  async function fetchPersonalDamage(actionUrl) {
    const response = await fetch(actionUrl, { credentials: 'same-origin' });
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const directValue = doc.getElementById('yourDamageValue')?.textContent;
    const directParsed = parseDamageValue(directValue);
    if (directParsed !== null) {
      return directParsed;
    }

    const myLink = doc.querySelector(`.leaderboard-panel a[href*="player.php?pid=${USER_ID}"]`);
    if (myLink) {
      const row = myLink.closest('.lb-row');
      const rowDamage = row?.querySelector('.lb-dmg')?.textContent;
      const rowParsed = parseDamageValue(rowDamage);
      if (rowParsed !== null) {
        return rowParsed;
      }
    }

    return 0;
  }

  function parseDamageValue(text) {
    const cleaned = cleanText(text).replace(/DMG/gi, '').replace(/,/g, '');
    const match = cleaned.match(/(\d+)/);
    return match ? Number(match[1]) : null;
  }

  function parseDamageFromHtml(text) {
    const normalized = String(text || '').replace(/,/g, '');
    const dealt = normalized.match(/dealt[^0-9]*(\d+)/i);
    return dealt ? Number(dealt[1]) : null;
  }

  function parseCurrentHp(hpText) {
    const normalized = String(hpText || '').replace(/,/g, '');
    const match = normalized.match(/(\d+)\s*\/\s*(\d+)/);
    return match ? Number(match[1]) : 0;
  }

  function getLimitRule(monsterName, locationName) {
    const monsterLower = cleanText(monsterName).toLowerCase();
    const locationLower = cleanText(locationName).toLowerCase();
    const rule = LIMIT_PRESETS.find((rule) =>
      monsterLower.includes(rule.nameIncludes) &&
      rule.locationIncludes.some((location) => locationLower.includes(location))
    );
    return rule ? { ...rule, ruleKey: `${rule.item}|${rule.nameIncludes}|${rule.locationIncludes.join(',')}|${rule.maxTargets}|${rule.targetDamage}` } : null;
  }

  function hasReachedLimit(monster, usageMap) {
    if (!monster.limitRule) {
      return false;
    }
    return Number(monster.personalDamage || 0) >= Number(monster.limitRule.targetDamage || 0) || isRuleSlotLocked(monster, usageMap);
  }

  function isRuleSlotLocked(monster, usageMap) {
    if (!monster.limitRule) {
      return false;
    }
    const currentDamage = Number(monster.personalDamage || 0);
    if (currentDamage > 0) {
      return false;
    }
    const usage = usageMap.get(monster.limitRule.ruleKey) || { started: 0 };
    return usage.started >= Number(monster.limitRule.maxTargets || 0);
  }

  function buildRuleUsageMap(monsters, quotaStore) {
    const usageMap = new Map();
    monsters.forEach((monster) => {
      if (!monster.limitRule) {
        return;
      }
      const key = monster.limitRule.ruleKey;
      const usage = usageMap.get(key) || { started: 0, capped: 0 };
      const personalDamage = Number(monster.personalDamage || 0);
      // Consider a monster "started" if it has any personal damage, even if it was
      // hit outside this script (or before quota-store tracking existed).
      if (personalDamage > 0 || quotaStore.has(monster)) {
        usage.started += 1;
      }
      if (personalDamage >= Number(monster.limitRule.targetDamage || 0)) {
        usage.capped += 1;
      }
      usageMap.set(key, usage);
    });
    return usageMap;
  }

  function countUntouchedRuleMonsters(limitRule, monsters, usageMap) {
    const usage = usageMap.get(limitRule.ruleKey) || { started: 0 };
    const total = monsters.filter((monster) => monster.limitRule?.ruleKey === limitRule.ruleKey).length;
    return Math.max(0, total - Number(usage.started || 0));
  }

  function countRuleTotalMonsters(limitRule, monsters) {
    return monsters.filter((monster) =>
      monster.limitRule?.ruleKey === limitRule.ruleKey
    ).length;
  }

  function buildLimitSummary(monster, usageMap, allMonsters) {
    if (!monster.limitRule) {
      return `Current: ${formatDamage(monster.personalDamage)}`;
    }
    const usage = usageMap.get(monster.limitRule.ruleKey) || { started: 0, capped: 0 };
    const untouched = countUntouchedRuleMonsters(monster.limitRule, allMonsters, usageMap);
    return `${monster.limitRule.item} ${monster.limitRule.maxTargets}x${shortDamage(monster.limitRule.targetDamage)} | hit today ${usage.started}/${monster.limitRule.maxTargets} | untouched ${untouched} | target ${formatDamage(monster.limitRule.targetDamage)} | current ${formatDamage(monster.personalDamage)}`;
  }

  function shortDamage(value) {
    const num = Number(value || 0);
    if (num >= 1000000 && num % 1000000 === 0) {
      return `${num / 1000000}M`;
    }
    if (num >= 1000 && num % 1000 === 0) {
      return `${num / 1000}K`;
    }
    return formatDamage(num);
  }

  function pickBestQuotaStamina(remainingDamage, oneStamEstimate, currentHp) {
    const baseline = Math.max(1, Number(oneStamEstimate || 0));
    const options = [1, 10, 50, 100, 200].map((stamina) => ({
      stamina,
      estimatedDamage: baseline * stamina
    }));
    const oneStam = options[0];
    const hpLimit = Math.max(0, Number(currentHp || 0));
    const mustOvershootToQualify = hpLimit > 0 && hpLimit < remainingDamage;

    // Endgame cleanup: once we're within about 10 normal hits, use 1-stam only
    // and keep going until the actual tracked damage reaches/exceeds the target.
    // But do not do that when the monster is so low HP that we *must* overshoot
    // the target on the killing hit to still qualify.
    if (!mustOvershootToQualify && remainingDamage <= baseline * 10) {
      return oneStam;
    }

    // If the monster is lower than the remaining target gap, choose the smallest
    // supported hit that is expected to clear the *damage target*, not the HP.
    if (mustOvershootToQualify) {
      const oversToTarget = options
        .filter((option) => option.estimatedDamage >= remainingDamage)
        .sort((a, b) => {
          const overA = a.estimatedDamage - remainingDamage;
          const overB = b.estimatedDamage - remainingDamage;
          if (overA !== overB) {
            return overA - overB;
          }
          return a.stamina - b.stamina;
        });

      if (oversToTarget.length > 0) {
        return oversToTarget[0];
      }

      return options.sort((a, b) => b.estimatedDamage - a.estimatedDamage)[0] || oneStam;
    }

    // Prefer the largest hit that still leaves at least one 1-stam cleanup hit.
    const safeUnder = options
      .filter((option) => option.estimatedDamage < remainingDamage)
      .filter((option) => (remainingDamage - option.estimatedDamage) >= baseline)
      .sort((a, b) => b.estimatedDamage - a.estimatedDamage);

    if (safeUnder.length > 0) {
      return safeUnder[0];
    }

    // If nothing fits that rule, use the smallest over to finish.
    const overs = options
      .filter((option) => option.estimatedDamage >= remainingDamage)
      .sort((a, b) => {
        const overA = a.estimatedDamage - remainingDamage;
        const overB = b.estimatedDamage - remainingDamage;
        if (overA !== overB) {
          return overA - overB;
        }
        return a.stamina - b.stamina;
      });

    if (overs.length > 0) {
      return overs[0];
    }

    return options.sort((a, b) => b.estimatedDamage - a.estimatedDamage)[0] || oneStam;
  }

  function summaryPill(text, extraClass = '') {
    return `<span class="tm-sbw-summary-pill ${extraClass}">${escapeHtml(text)}</span>`;
  }

  function renderError(message) {
    let board = document.getElementById(PANEL_ID);
      if (!board) {
        board = document.createElement('section');
        board.id = PANEL_ID;
        board.className = 'panel tm-sbw-board';
        const leaderboardPanel = document.querySelector('.lb')?.closest('.panel');
        const anchor = leaderboardPanel || document.querySelector('.mapframe')?.closest('.panel');
        if (anchor) {
          anchor.insertAdjacentElement('afterend', board);
        } else {
          document.body.appendChild(board);
        }
    }

    board.innerHTML = `<div class="h">All Shadowbridge Monsters</div><div class="tm-sbw-error">${escapeHtml(message)}</div>`;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      html.tm-sbw-map-page-root,
      body.tm-sbw-map-page{
        min-height: 100vh !important;
      }
      body.tm-sbw-map-page{
        padding-bottom: 0 !important;
      }
        body.tm-sbw-map-page.tm-sbw-board-collapsed .wrap{
          min-height: calc(100vh - 74px) !important;
        }
      body.tm-sbw-map-page .panel{
        min-height: 0 !important;
      }
      body.tm-sbw-map-page .panel:empty{
        display: none !important;
      }
      .tm-sbw-map-panel{
        margin-bottom: 10px !important;
      }
      .tm-sbw-map-panel .legend{
        margin-top: 6px !important;
      }
        .tm-sbw-board {
          margin-top: 10px;
        }
        body.tm-sbw-map-page .tm-sbw-board:not(.is-collapsed) {
          max-height: calc(100vh - 120px);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .tm-sbw-head {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        }
        .tm-sbw-head-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
        }
        .tm-sbw-sub {
          color: #94a3b8;
          font-size: 13px;
          margin-top: 4px;
        }
        .tm-sbw-summary {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
          flex: 0 0 auto;
        }
        .tm-sbw-qol {
          margin-top: 16px;
          display: grid;
          gap: 12px;
          min-height: 0;
        }
        .tm-sbw-board.is-collapsed .tm-sbw-qol {
          display: none;
        }
        body.tm-sbw-map-page .tm-sbw-board:not(.is-collapsed) .tm-sbw-qol {
          flex: 1 1 auto;
          overflow-y: auto;
          padding-right: 4px;
        }
        body.tm-sbw-map-page .tm-sbw-board:not(.is-collapsed) .tm-sbw-qol::-webkit-scrollbar {
          width: 8px;
        }
        body.tm-sbw-map-page .tm-sbw-board:not(.is-collapsed) .tm-sbw-qol::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.18);
          border-radius: 999px;
        }

      /* ===== Wave-style Multi Target layout (D1) ===== */
      .tm-sbw-board .qol-top{
        display:flex;
        flex-direction:column;
        gap:10px;
      }
      .tm-sbw-board .qol-filters{
        display:flex;
        flex-wrap:wrap;
        align-items:center;
        gap:10px;
        justify-content:flex-start;
        width:100%;
        padding:14px;
        border-radius:12px;
        background:#171923;
        border:1px solid #232437;
      }
      .tm-sbw-board .qol-title{
        color:#FFD369;
        font-weight:800;
        white-space:nowrap;
        margin-right:6px;
      }
      .tm-sbw-board .qol-filters label{
        display:inline-flex;
        align-items:center;
        gap:6px;
        color:#cdd1ea;
        white-space:nowrap;
        font-size:13px;
      }
      .tm-sbw-board .qol-select-actions{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
        align-items:center;
      }
      .tm-sbw-board .qol-attacks{
        display:flex;
        gap:8px;
        flex-wrap:wrap;
        align-items:stretch;
        justify-content:flex-start;
      }
      .tm-sbw-board .select-wrap{
        position:relative;
        display:inline-flex;
        align-items:center;
      }
      .tm-sbw-board .modern-select{
        appearance:none;
        -webkit-appearance:none;
        -moz-appearance:none;

        padding:10px 44px 10px 12px;
        border-radius:12px;
        border:1px solid rgba(140,160,255,.22);
        background: linear-gradient(180deg, rgba(30,33,50,.92), rgba(20,22,34,.92));
        color:#e6e9ff;
        font-weight:800;
        font-size:13px;
        line-height:1.1;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.07), 0 10px 24px rgba(0,0,0,.55);
        cursor:pointer;
      }
      .tm-sbw-board .select-wrap::after{
        content:"";
        position:absolute;
        right:12px;
        width:10px;
        height:10px;
        pointer-events:none;
        border-right:2px solid rgba(230,233,255,.65);
        border-bottom:2px solid rgba(230,233,255,.65);
        transform: rotate(45deg);
        opacity:.9;
      }
      .tm-sbw-board .modern-select option{
        background:#141625;
        color:#e6e9ff;
      }

      .tm-sbw-board .tm-sbw-tools{
        display:flex;
        flex-wrap:wrap;
        gap:10px;
        align-items:center;
      }

      /* Attack buttons (match Wave-style action colors) */
      .tm-sbw-board .btnQuickJoinAttack{
        background: linear-gradient(180deg, #2f7dff, #275ad6) !important;
        border-color: #2f7dff !important;
        color:#fff !important;
        box-shadow: 0 10px 22px rgba(47,125,255,.22), 0 0 0 2px rgba(0,0,0,.18) inset !important;
      }
      .tm-sbw-board .btnAttackStrat{
        background: linear-gradient(180deg, #7c3aed, #4c1d95) !important;
        border-color: #7c3aed !important;
        color:#fff !important;
        box-shadow: 0 10px 22px rgba(124,58,237,.22), 0 0 0 2px rgba(0,0,0,.18) inset !important;
      }

      /* Strategy modal (Wave-style) */
      .tm-sbw-board .attack-strat-overlay{
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,.6);
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
      }
      .tm-sbw-board .attack-strat-modal{
        background: #1f2233;
        padding: 16px;
        border-radius: 12px;
        width: 470px;
        max-width: 95vw;
        color: #e6e8ff;
        box-shadow: 0 10px 30px rgba(0,0,0,.4);
        max-height: 75vh;
        overflow: auto;
        border: 1px solid rgba(255,255,255,0.10);
      }
      .tm-sbw-board .attack-strat-title{ margin: 0 0 10px; }
      .tm-sbw-board .attack-strat-picker{ display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px; }
      .tm-sbw-board .attack-strat-label{ font-size:12px; color:#9aa0be; margin-bottom:6px; }
      .tm-sbw-board .attack-strat-footer{ margin-top: 14px; text-align: right; }
      .tm-sbw-board .attack-strat-checkbox{ width:16px; height:16px; }
      .tm-sbw-board .attack-strat-asterion-input, .tm-sbw-board .attack-strat-damage-limit-input{
        width: 120px;
        padding: 2px 6px;
        border-radius: 6px;
        border: 1px solid #2d3154;
        background: #2d3154;
        color: #e6e8ff;
      }
      .tm-sbw-board .attack-strat-chips{ display:flex; flex-direction:column; gap:6px; }
      .tm-sbw-board .attack-strat-chip{
        display:flex;
        align-items:center;
        background:#2d3154;
        padding:6px 10px;
        border-radius:10px;
        font-size:12px;
        width:100%;
        box-sizing:border-box;
      }
      .tm-sbw-board .attack-strat-chip-label{ flex:1; text-transform:capitalize; }
      .tm-sbw-board .attack-strat-chip-controls{ display:flex; align-items:center; gap:5px; }
      .tm-sbw-board .attack-strat-chip-btn{
        background:none;
        border:none;
        cursor:pointer;
        color:#9aa0be;
        font-size:12px;
        padding:5px 12px;
        background-color:#1f2233;
        border-radius:8px;
      }
      .tm-sbw-board .attack-strat-chip-btn.is-disabled{ opacity:.3; pointer-events:none; }
      .tm-sbw-board .attack-strat-chip-remove{ color:#ef4444; }
      .tm-sbw-board .total-stam-cost{
        color:#FFD369;
        font-weight:700;
        text-shadow:0 0 6px rgba(255, 211, 105, .6);
      }
      .tm-sbw-qol-top {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }
      .tm-sbw-filters {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
        width: 100%;
        padding: 14px;
        border-radius: 12px;
        background: #171923;
        border: 1px solid #232437;
      }
      .tm-sbw-title {
        font-weight: 800;
        color: #e6e9ff;
        margin-right: 4px;
      }
      .tm-sbw-select-wrap {
        position: relative;
      }
      .tm-sbw-modern-select {
        min-width: 220px;
        appearance: none;
        border-radius: 10px;
        border: 1px solid #2b2d44;
        background: #11131b;
        color: #e6e9ff;
        padding: 10px 36px 10px 12px;
      }
      .tm-sbw-filters label {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: #cfd4ff;
        font-size: 13px;
      }
      .tm-sbw-select-actions,
      .tm-sbw-selection-bar,
      .tm-sbw-mini-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        align-items: center;
      }
      .tm-sbw-location-filter {
        background: #191a24;
        padding: 16px;
        border-radius: 12px;
        border: 1px solid #232437;
      }
      .tm-sbw-mini-actions {
        margin-bottom: 10px;
        color: #8ea2ff;
        font-size: 12px;
      }
      .tm-sbw-mini-actions span {
        cursor: pointer;
      }
      .tm-sbw-location-chips {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 10px;
      }
      .tm-sbw-chip {
        display: flex;
        align-items: center;
        gap: 8px;
        background: #11131b;
        padding: 12px;
        border-radius: 10px;
        border: 1px solid #232437;
        cursor: pointer;
        color: #e6e9ff;
      }
      .tm-sbw-chip strong {
        color: #8ea2ff;
        margin-left: 6px;
      }
      .tm-sbw-selection-bar {
        justify-content: space-between;
        padding: 0 2px;
      }
      .tm-sbw-attack-controls {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        align-items: center;
      }
      .tm-sbw-stam-input {
        width: 90px;
        border-radius: 10px;
        border: 1px solid #2b2d44;
        background: #11131b;
        color: #e6e9ff;
        padding: 10px 12px;
      }
      .tm-sbw-stam-preset {
        min-width: 54px;
      }
      .tm-sbw-selected-count {
        color: #cfd4ff;
        font-size: 13px;
        font-weight: 700;
      }
      .tm-sbw-model-line {
        color: #93c5fd;
        font-size: 12px;
        margin-top: -2px;
      }
      .tm-sbw-model-line:empty {
        display: none;
      }
      .tm-sbw-run-line {
        color: #fcd34d;
        font-size: 12px;
        min-height: 0;
      }
      .tm-sbw-run-line:empty {
        display: none;
      }
      .tm-sbw-multi-select-box {
        max-height: 640px;
        overflow-y: auto;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 12px;
        background: #11131b;
        padding: 12px;
        border-radius: 10px;
        border: 1px solid #232437;
      }
      .tm-sbw-summary-pill,
      .tm-sbw-badge,
      .tm-sbw-location-count {
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 12px;
        background: rgba(15,23,42,0.45);
      }
      .tm-sbw-summary-pill.alive,
      .tm-sbw-badge.alive {
        border-color: rgba(34,197,94,0.45);
        color: #86efac;
      }
      .tm-sbw-summary-pill.dead,
      .tm-sbw-badge.dead {
        border-color: rgba(248,113,113,0.45);
        color: #fca5a5;
      }
      .tm-sbw-monster-chip {
        display: block;
        cursor: pointer;
      }
      .tm-sbw-monster-chip > input {
        position: absolute;
        opacity: 0;
        pointer-events: none;
      }
      .tm-sbw-monster-card {
        border-radius: 12px;
        padding: 12px;
        border: 1px solid rgba(255,255,255,0.08);
        background: rgba(15,23,42,0.55);
        transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
      }
      .tm-sbw-monster-chip > input:checked + .tm-sbw-monster-card {
        border-color: rgba(96,165,250,0.8);
        box-shadow: 0 0 0 2px rgba(59,130,246,0.25);
        transform: translateY(-1px);
      }
      .tm-sbw-monster-chip.dead .tm-sbw-monster-card {
        opacity: 0.8;
      }
      .tm-sbw-monster-top {
        display: flex;
        gap: 10px;
      }
      .tm-sbw-monster-img {
        width: 64px;
        height: 64px;
        object-fit: cover;
        border-radius: 10px;
        flex: 0 0 auto;
      }
      .tm-sbw-monster-main {
        min-width: 0;
        flex: 1;
      }
      .tm-sbw-monster-name {
        font-weight: 700;
        line-height: 1.3;
      }
      .tm-sbw-monster-meta,
      .tm-sbw-stats,
      .tm-sbw-monster-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 8px;
      }
      .tm-sbw-stats {
        font-size: 12px;
        color: #cbd5e1;
      }
      .tm-sbw-user-dmg {
        color: #f87171;
        font-weight: 800;
      }
      .tm-sbw-limit-note {
        color: #fbbf24;
        font-weight: 700;
      }
      .tm-sbw-limit-note.done {
        color: #86efac;
      }
      .tm-sbw-limit-note.locked {
        color: #f59e0b;
      }
      .tm-sbw-action {
        text-decoration: none;
      }
      .tm-sbw-error {
        margin-top: 12px;
        color: #fca5a5;
      }
      .tm-sbw-modal {
        position: fixed;
        inset: 0;
        z-index: 99999;
        background: rgba(0,0,0,0.85);
        align-items: center;
        justify-content: center;
        padding: 18px;
      }
      .tm-sbw-modal-box {
        width: 720px;
        max-width: 95vw;
        background: #131521;
        border: 1px solid #232437;
        border-radius: 14px;
        padding: 18px;
        box-shadow: 0 20px 50px rgba(0,0,0,0.45);
      }
      .tm-sbw-modal-head {
        margin: 0 0 10px;
        color: #e6e9ff;
        font-size: 22px;
      }
      .tm-sbw-modal-note {
        color: #9aa0be;
        font-size: 13px;
      }
      .tm-sbw-modal-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 10px;
        max-height: 60vh;
        overflow-y: auto;
      }
      .tm-sbw-modal-actions {
        margin-top: 14px;
        display: flex;
        justify-content: flex-end;
      }
      .tm-sbw-result {
        background: #1e1e2f;
        border-radius: 10px;
        padding: 10px 12px;
        border: 1px solid rgba(255,255,255,0.12);
      }
      .tm-sbw-result.ok {
        border-color: rgba(0,255,140,.25);
      }
      .tm-sbw-result.fail {
        border-color: rgba(248,113,113,.35);
      }
      .tm-sbw-result-head {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        align-items: center;
      }
      .tm-sbw-result-id {
        font-weight: 700;
        color: #e6e9ff;
      }
      .tm-sbw-result-status {
        font-weight: 800;
        color: #7cffb8;
      }
      .tm-sbw-result.fail .tm-sbw-result-status {
        color: #fca5a5;
      }
      .tm-sbw-result-body {
        margin-top: 6px;
        color: #9aa0be;
        font-size: 12px;
        line-height: 1.45;
      }
      .tm-sbw-dot {
        position: absolute;
        transform: translate(-50%, -50%);
        min-width: 28px;
        height: 28px;
        padding: 0 8px;
        border: 2px solid rgba(251,191,36,0.95);
        border-radius: 999px;
        background: rgba(15,23,42,0.92);
        color: #fde68a;
        font-weight: 700;
        font-size: 12px;
        z-index: 9;
        cursor: pointer;
        box-shadow: 0 0 0 3px rgba(15,23,42,0.4);
      }
      .tm-sbw-dot:hover {
        filter: brightness(1.1);
      }

      /* ============================
         Wave 3-style UI + sizing
         ============================ */
      .tm-sbw-board{
        font-family: 'Segoe UI', system-ui, -apple-system, Arial, sans-serif;
      }

      /* Buttons (Wave 3 gold) */
      .tm-sbw-board .btn{
        border-radius: 10px !important;
        padding: 10px 12px !important;
        font-size: 13px !important;
        font-weight: 800 !important;
        line-height: 1.2 !important;
        white-space: nowrap !important;

        /* Muted steel-blue (dungeon theme): not too bright, not too dark */
        background: linear-gradient(180deg, #3b6f9b, #2a4f71) !important;
        color: #eaf4ff !important;
        border: 1px solid rgba(160,210,255,.22) !important;
        box-shadow: 0 10px 22px rgba(0,0,0,.55), 0 0 0 2px rgba(0,0,0,.22) inset !important;
        cursor: pointer !important;
        transition: filter .12s ease, transform .06s ease !important;
      }
      .tm-sbw-board .btn:hover{ filter: brightness(1.06) !important; transform: translateY(-1px) !important; }
      .tm-sbw-board .btn:active{ filter: brightness(0.98) !important; transform: translateY(0) !important; }
      .tm-sbw-board .btn:disabled{ opacity:.6 !important; cursor:not-allowed !important; transform:none !important; }

      /* Make selects readable */
      .tm-sbw-board select.tm-sbw-modern-select{
        background: #11131b !important;
        color: #e6e9ff !important;
        border: 1px solid rgba(255,255,255,0.14) !important;
        font-weight: 800 !important;
      }
      .tm-sbw-board select.tm-sbw-modern-select option{
        background: #11131b !important;
        color: #e6e9ff !important;
      }

      /* Monster cards (closer to Wave 3 monster-card look) */
      .tm-sbw-monster-card{
        background: radial-gradient(120% 140% at 20% 0%, rgba(219,186,107,.08), rgba(0,0,0,0) 50%),
                    linear-gradient(180deg, rgba(25,26,30,.95), rgba(18,19,23,.95)) !important;
        border: 1px solid rgba(219,186,107,.18) !important;
        box-shadow:
          0 10px 24px rgba(0,0,0,.65),
          0 0 0 1px rgba(0,0,0,.5) inset,
          0 0 22px rgba(219,186,107,.06) inset !important;
        border-radius: 14px !important;
        transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease !important;
      }
      .tm-sbw-monster-chip:hover .tm-sbw-monster-card{
        transform: translateY(-2px);
        box-shadow:
          0 16px 32px rgba(0,0,0,.7),
          0 0 0 1px rgba(219,186,107,.25) inset,
          0 0 28px rgba(219,186,107,.10) inset !important;
      }
      .tm-sbw-monster-chip > input:checked + .tm-sbw-monster-card{
        border-color: rgba(219,186,107,.55) !important;
        box-shadow: 0 0 0 2px rgba(219,186,107,.20) inset, 0 16px 32px rgba(0,0,0,.7) !important;
      }
      .tm-sbw-monster-img{
        outline: 1px solid rgba(219,186,107,.15);
        border: 1px solid rgba(255,255,255,.08);
        box-shadow: 0 6px 18px rgba(0,0,0,.55);
      }
      .tm-sbw-monster-name{ color:#e6e9ff; font-weight:900; }
      .tm-sbw-selected-count{ color:#cfd4ff; font-weight:900; }

      /* Hide any legacy room/location UI if present */
      .tm-sbw-location-filter,
      .tm-sbw-dot{ display:none !important; }

      /* Size selector affects cards + icons together */
      .tm-sbw-board[data-size="small"] .tm-sbw-multi-select-box{
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)) !important;
      }
      .tm-sbw-board[data-size="tiny"] .tm-sbw-multi-select-box{
        grid-template-columns: repeat(auto-fill, minmax(205px, 1fr)) !important;
      }
      .tm-sbw-board[data-size="small"] .tm-sbw-monster-card{ padding: 10px !important; border-radius: 12px !important; }
      .tm-sbw-board[data-size="tiny"]  .tm-sbw-monster-card{ padding: 8px !important; border-radius: 12px !important; }
      .tm-sbw-board[data-size="small"] .tm-sbw-monster-img{ width: 54px !important; height: 54px !important; border-radius: 12px !important; }
      .tm-sbw-board[data-size="tiny"]  .tm-sbw-monster-img{ width: 44px !important; height: 44px !important; border-radius: 10px !important; }
      .tm-sbw-board[data-size="small"] .tm-sbw-monster-name{ font-size: 13.5px !important; }
      .tm-sbw-board[data-size="tiny"]  .tm-sbw-monster-name{ font-size: 13px !important; }
      .tm-sbw-board[data-size="small"] .tm-sbw-stats{ font-size: 11.5px !important; }
      .tm-sbw-board[data-size="tiny"]  .tm-sbw-stats{ font-size: 11px !important; }
      .tm-sbw-board[data-size="small"] .btn{ padding: 8px 10px !important; font-size: 12px !important; }
      .tm-sbw-board[data-size="tiny"]  .btn{ padding: 7px 9px !important; font-size: 12px !important; }
      @media (max-width: 700px) {
        .tm-sbw-dot {
          min-width: 24px;
          height: 24px;
          font-size: 11px;
        }
        .tm-sbw-filters,
        .tm-sbw-selection-bar {
          align-items: stretch;
        }
        .tm-sbw-modern-select,
        .tm-sbw-select-wrap,
        .tm-sbw-select-actions,
        .tm-sbw-select-actions .btn,
        .tm-sbw-selection-bar .btn,
        .tm-sbw-attack-controls,
        .tm-sbw-attack-controls .btn,
        .tm-sbw-stam-input {
          width: 100%;
        }
        .tm-sbw-multi-select-box,
        .tm-sbw-location-chips {
          grid-template-columns: 1fr;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function formatDamage(value) {
    if (value === null || value === undefined) {
      return '...';
    }
    return new Intl.NumberFormat().format(Number(value) || 0);
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function cssEscape(value) {
    if (window.CSS?.escape) {
      return window.CSS.escape(value);
    }

    return String(value).replace(/"/g, '\\"');
  }

  function getUserId() {
    const demonMatch = document.cookie.match(/(?:^|;\s*)demon=(\d+)/);
    return demonMatch ? demonMatch[1] : '';
  }

  function createQuotaStore() {
    let cycleKey = getServerCycleKey();
    let state = readQuotaState(cycleKey);

    const ensureCurrentCycle = () => {
      const nextCycleKey = getServerCycleKey();
      if (nextCycleKey !== cycleKey) {
        cycleKey = nextCycleKey;
        state = readQuotaState(cycleKey);
      }
    };

    return {
      has(monster) {
        ensureCurrentCycle();
        if (!monster.limitRule) {
          return false;
        }
        const monsterId = String(monster.id || '');
        if (!monsterId) {
          return false;
        }
        const ruleList = state.rules[monster.limitRule.ruleKey] || [];
        return ruleList.includes(monsterId);
      },
      mark(monster) {
        ensureCurrentCycle();
        if (!monster.limitRule) {
          return;
        }
        const monsterId = String(monster.id || '');
        if (!monsterId) {
          return;
        }
        const ruleKey = monster.limitRule.ruleKey;
        const ruleList = state.rules[ruleKey] || [];
        if (!ruleList.includes(monsterId)) {
          ruleList.push(monsterId);
          state.rules[ruleKey] = ruleList;
          writeQuotaState(state);
        }
      }
    };
  }

  function createDamageModelStore() {
    const state = readDamageModelState();

    return {
      addSample(value) {
        const num = Number(value || 0);
        if (!Number.isFinite(num) || num <= 0) {
          return;
        }
        state.samples.push(num);
        state.samples = state.samples.slice(-30);
        writeDamageModelState(state);
      },
      getEstimate() {
        const samples = state.samples.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
        if (samples.length === 0) {
          return 0;
        }
        if (samples.length < 3) {
          return Math.round(samples.reduce((sum, value) => sum + value, 0) / samples.length);
        }
        const trimmed = samples.slice(0, Math.max(1, Math.ceil(samples.length * 0.8)));
        return Math.round(trimmed.reduce((sum, value) => sum + value, 0) / trimmed.length);
      },
      hasEstimate() {
        return this.getEstimate() > 0;
      },
      describe() {
        if (!this.hasEstimate()) {
          return 'not learned yet';
        }
        return `${formatDamage(this.getEstimate())} from ${state.samples.length} sample(s), high outliers ignored`;
      }
    };
  }

  function createDamageCacheStore() {
    const state = readDamageCacheState();

    return {
      get(monster) {
        const key = getMonsterCacheKey(monster);
        if (!key) {
          return null;
        }
        const entry = state.values[key];
        if (!entry) {
          return null;
        }
        if (entry.cycleKey !== getServerCycleKey()) {
          delete state.values[key];
          writeDamageCacheState(state);
          return null;
        }
        return Number(entry.damage || 0);
      },
      set(monster, damage) {
        const key = getMonsterCacheKey(monster);
        if (!key) {
          return;
        }
        state.values[key] = {
          damage: Number(damage || 0),
          cycleKey: getServerCycleKey()
        };
        writeDamageCacheState(state);
      }
    };
  }

  function getMonsterCacheKey(monster) {
    if (!monster) {
      return '';
    }
    return [monster.instanceId || '', monster.dgmid || '', monster.id || '', USER_ID || ''].join('|');
  }

  function readDamageCacheState() {
    try {
      const raw = window.localStorage.getItem(DAMAGE_CACHE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && parsed.values && typeof parsed.values === 'object') {
        return parsed;
      }
    } catch (_error) {
      // ignore bad storage
    }
    const fresh = { values: {} };
    writeDamageCacheState(fresh);
    return fresh;
  }

  function writeDamageCacheState(state) {
    try {
      window.localStorage.setItem(DAMAGE_CACHE_KEY, JSON.stringify(state));
    } catch (_error) {
      // ignore storage failures
    }
  }

  function readDamageModelState() {
    try {
      const raw = window.localStorage.getItem(DAMAGE_MODEL_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && Array.isArray(parsed.samples)) {
        return parsed;
      }
    } catch (_error) {
      // ignore bad storage
    }
    const fresh = { samples: [] };
    writeDamageModelState(fresh);
    return fresh;
  }

  function writeDamageModelState(state) {
    try {
      window.localStorage.setItem(DAMAGE_MODEL_KEY, JSON.stringify(state));
    } catch (_error) {
      // ignore storage failures
    }
  }

  function getServerCycleKey() {
    const serverEl = document.getElementById('server_time');
    const epoch = Number(serverEl?.getAttribute('data-epoch') || Math.floor(Date.now() / 1000));
    const offsetSeconds = Number(serverEl?.getAttribute('data-tzoff') || 0);
    const bootClientMs = window.__tmShadowbridgeBootClientMs || Date.now();
    const bootServerEpoch = window.__tmShadowbridgeBootServerEpoch || epoch;
    if (!window.__tmShadowbridgeBootClientMs) {
      window.__tmShadowbridgeBootClientMs = bootClientMs;
      window.__tmShadowbridgeBootServerEpoch = bootServerEpoch;
    }
    const elapsedMs = Date.now() - window.__tmShadowbridgeBootClientMs;
    const serverMs = ((window.__tmShadowbridgeBootServerEpoch || epoch) * 1000) + elapsedMs + (offsetSeconds * 1000);
    const rolloverMs = 6 * 60 * 60 * 1000;
    const shifted = new Date(serverMs - rolloverMs);
    const year = shifted.getUTCFullYear();
    const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
    const day = String(shifted.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function readQuotaState(cycleKey) {
    try {
      const raw = window.localStorage.getItem(QUOTA_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && parsed.cycleKey === cycleKey && parsed.rules && typeof parsed.rules === 'object') {
        return parsed;
      }
    } catch (_error) {
      // ignore broken storage and rebuild
    }
    const fresh = { cycleKey, rules: {} };
    writeQuotaState(fresh);
    return fresh;
  }

  function writeQuotaState(state) {
    try {
      window.localStorage.setItem(QUOTA_STORAGE_KEY, JSON.stringify(state));
    } catch (_error) {
      // ignore storage failures
    }
  }

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  async function runWithConcurrency(items, limit, worker) {
    const queue = Array.from(items);
    const runners = Array.from({ length: Math.max(1, Math.min(limit, queue.length || 1)) }, async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (item === undefined) {
          return;
        }
        await worker(item);
      }
    });
    await Promise.all(runners);
  }

  function slugify(value) {
    return cleanText(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'location';
  }
})();


// ============================================================
// Module: Solo PvP Bot (demonicscans-pvp.user.js)
// ============================================================

(() => {
  'use strict';

  // When merged into the All-in-One script, this file still runs on every page.
  // Hard-gate it so it only does anything on solo PvP pages (no console noise elsewhere).
  const path = String(window.location.pathname || '');
  const IS_LOBBY = /\/pvp\.php$/i.test(path);
  const IS_BATTLE = /\/pvp_battle\.php$/i.test(path);
  if (!IS_LOBBY && !IS_BATTLE) return;

  const STORAGE_KEY = 'tm_pvp_bot_active_v1';
  const LAST_ACTION_KEY = 'tm_pvp_bot_last_action_at_v1';
  const ACTION_GAP_MS = 1500;
  const LOBBY_RETRY_MS = 2000;
  const BATTLE_RETRY_MS = 1000;

  let loopTimer = 0;

  const isActive = () => window.localStorage.getItem(STORAGE_KEY) === 'true';

  const setActive = (value) => {
    window.localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
  };

  const now = () => Date.now();

  const canAct = () => {
    const last = Number(window.localStorage.getItem(LAST_ACTION_KEY) || 0);
    return (now() - last) >= ACTION_GAP_MS;
  };

  const markActed = () => {
    window.localStorage.setItem(LAST_ACTION_KEY, String(now()));
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const setStatus = (message) => {
    console.log('[Solo PvP Bot]', message);
  };

  function isLobbyPage() {
    return IS_LOBBY;
  }

  function isBattlePage() {
    return IS_BATTLE;
  }

  function ensureStyles() {
    const id = 'tmSoloPvpBotStyles';
    if (document.getElementById(id)) return;
    const st = document.createElement('style');
    st.id = id;
    st.textContent = `
      .tm-solo-pvp-bot-btn{
        background: linear-gradient(180deg, #FFD369, #DBA23A) !important;
        color: #111 !important;
        border: 1px solid rgba(0,0,0,0.25) !important;
        font-weight: 900 !important;
      }
      .tm-solo-pvp-bot-btn:hover{
        filter: brightness(1.05);
      }
      .tm-solo-pvp-bot-btn.tm-off{
        opacity: .75;
      }
      .tm-solo-pvp-bot-inline{
        display:flex;
        align-items:center;
        gap:10px;
        flex-wrap:wrap;
      }
    `;
    document.head.appendChild(st);
  }

  function findSoloMatchButton() {
    // Current UI uses .js-matchmake[data-ladder="solo"] (snapshot: "Find Solo Match")
    const btn = document.querySelector('.js-matchmake[data-ladder="solo"]');
    if (btn) return btn;

    // Fallback by text.
    const candidates = Array.from(document.querySelectorAll('button, a'));
    return candidates.find((el) => {
      const t = String(el.textContent || '').toLowerCase();
      return (t.includes('solo') && (t.includes('find') || t.includes('join') || t.includes('continue'))) && el instanceof HTMLElement;
    }) || null;
  }

  function injectInlineButton() {
    if (!isLobbyPage()) return;
    if (document.getElementById('tmSoloPvpBotBtn')) return;

    const soloBtn = findSoloMatchButton();
    if (!soloBtn || !soloBtn.parentElement) return;

    ensureStyles();

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'tmSoloPvpBotBtn';

    // Match the exact style/layout of the Solo join/continue button.
    btn.className = soloBtn.className || '';
    btn.classList.add('tm-solo-pvp-bot-btn');

    function syncLabel() {
      const on = isActive();
      btn.textContent = on ? 'Solo Bot: ON' : 'Solo Bot: OFF';
      btn.classList.toggle('tm-off', !on);
    }

    btn.addEventListener('click', () => {
      setActive(!isActive());
      syncLabel();
      if (isActive()) queueNext(150);
    });

    // Insert left of the Solo join/continue button.
    soloBtn.parentElement.insertBefore(btn, soloBtn);

    // Try to keep spacing consistent with the page's button-row layout.
    const row = soloBtn.closest('.button-row') || soloBtn.parentElement;
    if (row && row instanceof HTMLElement) {
      const cs = window.getComputedStyle(row);
      if (cs && cs.display !== 'flex') {
        row.classList.add('tm-solo-pvp-bot-inline');
      }
    }

    // Place tiny status text after our button (still before the join button).
    syncLabel();
  }

  const clickIfPossible = (element, reason) => {
    if (!element || element.disabled || !canAct()) return false;
    markActed();
    setStatus(reason);
    element.click();
    return true;
  };

  const textIncludes = (element, value) => {
    return !!element && String(element.textContent || '').toLowerCase().includes(String(value || '').toLowerCase());
  };

  const parseSoloTokens = () => {
    const pills = Array.from(document.querySelectorAll('.info-pill'));
    const tokenPill = pills.find((pill) => /tokens/i.test(pill.textContent || ''));
    if (!tokenPill) return null;

    const valueNode = tokenPill.querySelector('span');
    const raw = valueNode ? valueNode.textContent : tokenPill.textContent;
    const digits = String(raw || '').replace(/[^\d]/g, '');
    if (!digits) return null;
    return Number(digits);
  };

  const battleEnded = () => {
    const badge = document.getElementById('matchStatusBadge');
    const note = document.getElementById('noteText');
    const rewardsModal = document.getElementById('rewardsModal');

    if (badge && /victory|battle ended/i.test(badge.textContent || '')) return true;
    if (note && /won this season match|battle ended|season match ended/i.test(note.textContent || '')) return true;
    if (rewardsModal && rewardsModal.classList.contains('show')) return true;
    return false;
  };

  const autoPlayEnabled = () => {
    const autoBtn = document.getElementById('autoPlayBtn');
    return !!autoBtn && (autoBtn.classList.contains('active') || textIncludes(autoBtn, 'on'));
  };

  const queueNext = (ms) => {
    window.clearTimeout(loopTimer);
    loopTimer = window.setTimeout(runTick, ms);
  };

  const handleLobby = async () => {
    const tokens = parseSoloTokens();
    if (tokens !== null && tokens <= 0) {
      setActive(false);
      const toggleBtn = document.getElementById('pvpBotToggle');
      if (toggleBtn) {
        toggleBtn.textContent = 'Solo PvP Bot OFF';
        toggleBtn.style.background = '#963838';
      }
      setStatus('Solo PvP tokens are at 0. Bot stopped.');
      queueNext(1000);
      return;
    }

    const soloBtn = document.querySelector('.js-matchmake[data-ladder="solo"]');
    if (soloBtn && !soloBtn.disabled) {
      if (clickIfPossible(soloBtn, 'Joining solo PvP match...')) {
        queueNext(ACTION_GAP_MS);
        return;
      }
    }

    setStatus('Waiting for solo match button...');
    await sleep(LOBBY_RETRY_MS);
    queueNext(250);
  };

  const handleBattle = async () => {
    const backBtn = document.querySelector('a.back-btn[href*="pvp.php"], a[href="pvp.php"], a[href="/pvp.php"]');
    const autoBtn = document.getElementById('autoPlayBtn');

    if (battleEnded()) {
      if (clickIfPossible(backBtn, 'Battle finished, leaving to PvP lobby...')) {
        queueNext(ACTION_GAP_MS);
        return;
      }
      setStatus('Battle finished, waiting to leave...');
      await sleep(BATTLE_RETRY_MS);
      queueNext(250);
      return;
    }

    if (autoBtn && !autoBtn.disabled && !autoPlayEnabled()) {
      if (clickIfPossible(autoBtn, 'Enabling Auto Play...')) {
        queueNext(ACTION_GAP_MS);
        return;
      }
    }

    if (autoPlayEnabled()) setStatus('Auto Play running...');
    else if (autoBtn && autoBtn.disabled) setStatus('Waiting for battle controls...');
    else setStatus('Waiting for battle state...');

    await sleep(BATTLE_RETRY_MS);
    queueNext(250);
  };

  const runTick = async () => {
    if (!isActive()) {
      setStatus('Bot is idle.');
      queueNext(1000);
      return;
    }

    if (isLobbyPage()) {
      await handleLobby();
      return;
    }

    if (isBattlePage()) {
      await handleBattle();
      return;
    }

    setStatus('Unsupported page for Solo PvP bot.');
    queueNext(1500);
  };

  // UI: only show on the Solo PvP lobby page (requested).
  if (isLobbyPage()) {
    const runUi = () => injectInlineButton();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', runUi, { once: true });
    else runUi();
  }

  queueNext(200);
})();

