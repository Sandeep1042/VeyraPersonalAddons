// ==UserScript==
// @name         Veyra Emberfall Quest + Drops Helper
// @namespace    https://demonicscans.org/
// @version      0.2.4
// @description  Captures Emberfall Quest Journal from the event page and shows it on Arcane Wild Fringe (active_wave) + battle pages, including which mobs drop required quest items.
// @match        https://demonicscans.org/event_page.php*
// @match        https://demonicscans.org/active_wave.php*
// @match        https://demonicscans.org/battle.php*
// @homepageURL  https://github.com/nobody65321/VeyraPersonalAddons
// @updateURL    https://github.com/nobody65321/VeyraPersonalAddons/raw/refs/heads/main/Event.user.js
// @downloadURL  https://github.com/nobody65321/VeyraPersonalAddons/raw/refs/heads/main/Event.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const LS = {
    enabled: 'tm_emberfall_helper_enabled_v1',
    quests: 'tm_emberfall_quests_v1',
    dropsByMob: 'tm_emberfall_drops_by_mob_v1',
    dropsSeedVersion: 'tm_emberfall_drops_seed_version_v1',
    panelOpen: 'tm_emberfall_panel_open_v1'
  };

  // Seeded from your saved Emberfall battle pages so you don't have to open each mob manually.
  // If you later re-capture drops by visiting a battle page, those live values will be kept.
  const DROPS_SEED_VERSION = '2026-04-10a';
  const DROPS_SEED_COMPACT_JSON =
    `{"arcaneback bear":{"mobName":"Arcaneback Bear","capturedAt":0,"items":[{"name":"Broken Oath Rune","tier":"EPIC","dropPct":65,"dmgReq":1200000,"locked":false},{"name":"Arcane Treat S","tier":"RARE","dropPct":3,"dmgReq":3500000,"locked":false},{"name":"Ashscript Hood","tier":"RARE","dropPct":100,"dmgReq":2400000,"locked":false},{"name":"Ashscript Robe","tier":"RARE","dropPct":100,"dmgReq":2800000,"locked":false},{"name":"Full Hp Potion","tier":"RARE","dropPct":2,"dmgReq":3500000,"locked":false},{"name":"Mana Potion S","tier":"RARE","dropPct":2,"dmgReq":3500000,"locked":false},{"name":"Small Stamina Potion","tier":"RARE","dropPct":5,"dmgReq":5000000,"locked":true},{"name":"Emberfall Token","tier":"COMMON","dropPct":60,"dmgReq":3000000,"locked":false}],"mobKey":"arcaneback bear"},"arcanecrest hyena":{"mobName":"Arcanecrest Hyena","capturedAt":0,"items":[{"name":"Memory Ash","tier":"EPIC","dropPct":65,"dmgReq":1500000,"locked":true},{"name":"Arcane Treat S","tier":"RARE","dropPct":3,"dmgReq":3500000,"locked":true},{"name":"Ashscript Boots","tier":"RARE","dropPct":100,"dmgReq":2500000,"locked":true},{"name":"Ashscript Hood","tier":"RARE","dropPct":100,"dmgReq":2800000,"locked":true},{"name":"Full Hp Potion","tier":"RARE","dropPct":2,"dmgReq":3500000,"locked":true},{"name":"Mana Potion S","tier":"RARE","dropPct":2,"dmgReq":3500000,"locked":true},{"name":"Small Stamina Potion","tier":"RARE","dropPct":5,"dmgReq":5000000,"locked":true},{"name":"Emberfall Token","tier":"COMMON","dropPct":60,"dmgReq":3000000,"locked":true}],"mobKey":"arcanecrest hyena"},"arcanefang wolf":{"mobName":"Arcanefang Wolf","capturedAt":0,"items":[{"name":"Arcane Treat S","tier":"RARE","dropPct":3,"dmgReq":3500000,"locked":true},{"name":"Ashscript Gloves","tier":"RARE","dropPct":100,"dmgReq":2500000,"locked":true},{"name":"Full Hp Potion","tier":"RARE","dropPct":2,"dmgReq":3500000,"locked":true},{"name":"Mana Potion S","tier":"RARE","dropPct":2,"dmgReq":3500000,"locked":true},{"name":"Small Stamina Potion","tier":"RARE","dropPct":5,"dmgReq":5000000,"locked":true},{"name":"Burnt Spellpage","tier":"COMMON","dropPct":80,"dmgReq":1000000,"locked":true},{"name":"Emberfall Token","tier":"COMMON","dropPct":60,"dmgReq":3000000,"locked":true}],"mobKey":"arcanefang wolf"},"arcanehide boar":{"mobName":"Arcanehide Boar","capturedAt":0,"items":[{"name":"Arcane Treat S","tier":"RARE","dropPct":3,"dmgReq":3500000,"locked":true},{"name":"Ashscript Hood","tier":"RARE","dropPct":100,"dmgReq":2600000,"locked":true},{"name":"Ashscript Robe","tier":"RARE","dropPct":100,"dmgReq":3000000,"locked":true},{"name":"Cracked Mana Lens","tier":"RARE","dropPct":45,"dmgReq":1800000,"locked":true},{"name":"Full Hp Potion","tier":"RARE","dropPct":2,"dmgReq":3500000,"locked":true},{"name":"Mana Potion S","tier":"RARE","dropPct":2,"dmgReq":3500000,"locked":true},{"name":"Small Stamina Potion","tier":"RARE","dropPct":5,"dmgReq":5000000,"locked":true},{"name":"Burnt Spellpage","tier":"COMMON","dropPct":70,"dmgReq":1200000,"locked":true},{"name":"Emberfall Token","tier":"COMMON","dropPct":60,"dmgReq":3000000,"locked":true}],"mobKey":"arcanehide boar"},"hexpyre crow":{"mobName":"Hexpyre Crow","capturedAt":0,"items":[{"name":"Vaelith Sigil Fragment","tier":"EPIC","dropPct":45,"dmgReq":2200000,"locked":true},{"name":"Arcane Treat S","tier":"RARE","dropPct":3,"dmgReq":3500000,"locked":true},{"name":"Ashscript Gloves","tier":"RARE","dropPct":100,"dmgReq":3000000,"locked":true},{"name":"Ashscript Robe","tier":"RARE","dropPct":100,"dmgReq":2600000,"locked":true},{"name":"Black Ink Vial","tier":"RARE","dropPct":60,"dmgReq":1700000,"locked":true},{"name":"Full Hp Potion","tier":"RARE","dropPct":2,"dmgReq":3500000,"locked":true},{"name":"Mana Potion S","tier":"RARE","dropPct":2,"dmgReq":3500000,"locked":true},{"name":"Sealed Page","tier":"RARE","dropPct":80,"dmgReq":1300000,"locked":true},{"name":"Small Stamina Potion","tier":"RARE","dropPct":5,"dmgReq":5000000,"locked":true},{"name":"Emberfall Token","tier":"COMMON","dropPct":60,"dmgReq":3000000,"locked":true}],"mobKey":"hexpyre crow"},"runestag":{"mobName":"Runestag","capturedAt":0,"items":[{"name":"Arcane Treat S","tier":"RARE","dropPct":3,"dmgReq":3500000,"locked":true},{"name":"Ashscript Boots","tier":"RARE","dropPct":100,"dmgReq":2800000,"locked":true},{"name":"Ashscript Staff","tier":"RARE","dropPct":100,"dmgReq":2600000,"locked":true},{"name":"Cracked Mana Lens","tier":"RARE","dropPct":40,"dmgReq":1900000,"locked":true},{"name":"Full Hp Potion","tier":"RARE","dropPct":2,"dmgReq":3500000,"locked":true},{"name":"Mana Potion S","tier":"RARE","dropPct":2,"dmgReq":3500000,"locked":true},{"name":"Small Stamina Potion","tier":"RARE","dropPct":5,"dmgReq":5000000,"locked":true},{"name":"Starglass Shard","tier":"RARE","dropPct":75,"dmgReq":1500000,"locked":true},{"name":"Emberfall Token","tier":"COMMON","dropPct":60,"dmgReq":3000000,"locked":true}],"mobKey":"runestag"},"sigilscale viper":{"mobName":"Sigilscale Viper","capturedAt":0,"items":[{"name":"Archive Ember Seal","tier":"EPIC","dropPct":60,"dmgReq":2000000,"locked":true},{"name":"Sister\\u0027s Ribbon Thread","tier":"EPIC","dropPct":35,"dmgReq":2200000,"locked":true},{"name":"Ward Thread","tier":"EPIC","dropPct":70,"dmgReq":1800000,"locked":true},{"name":"Arcane Treat S","tier":"RARE","dropPct":3,"dmgReq":3500000,"locked":true},{"name":"Ashscript Boots","tier":"RARE","dropPct":100,"dmgReq":3000000,"locked":true},{"name":"Ashscript Staff","tier":"RARE","dropPct":100,"dmgReq":3000000,"locked":true},{"name":"Full Hp Potion","tier":"RARE","dropPct":2,"dmgReq":3500000,"locked":true},{"name":"Mana Potion S","tier":"RARE","dropPct":2,"dmgReq":3500000,"locked":true},{"name":"Small Stamina Potion","tier":"RARE","dropPct":5,"dmgReq":5000000,"locked":true},{"name":"Emberfall Token","tier":"COMMON","dropPct":60,"dmgReq":3000000,"locked":true}],"mobKey":"sigilscale viper"},"spellfurnace lynx":{"mobName":"Spellfurnace Lynx","capturedAt":0,"items":[{"name":"Ward Thread","tier":"EPIC","dropPct":60,"dmgReq":2000000,"locked":true},{"name":"Arcane Treat S","tier":"RARE","dropPct":3,"dmgReq":3500000,"locked":true},{"name":"Ashscript Gloves","tier":"RARE","dropPct":100,"dmgReq":2800000,"locked":true},{"name":"Ashscript Staff","tier":"RARE","dropPct":100,"dmgReq":2800000,"locked":true},{"name":"Full Hp Potion","tier":"RARE","dropPct":2,"dmgReq":3500000,"locked":true},{"name":"Mana Potion S","tier":"RARE","dropPct":2,"dmgReq":3500000,"locked":true},{"name":"Observatory Gear","tier":"RARE","dropPct":65,"dmgReq":1800000,"locked":true},{"name":"Small Stamina Potion","tier":"RARE","dropPct":5,"dmgReq":5000000,"locked":true},{"name":"Emberfall Token","tier":"COMMON","dropPct":60,"dmgReq":3000000,"locked":true}],"mobKey":"spellfurnace lynx"}}`;

  function isEnabled() {
    const raw = window.localStorage.getItem(LS.enabled);
    return raw === null ? true : raw === 'true';
  }

  function setEnabled(v) {
    window.localStorage.setItem(LS.enabled, v ? 'true' : 'false');
  }

  function isPanelOpen() {
    const raw = window.localStorage.getItem(LS.panelOpen);
    // Default open so it's discoverable (you can Hide it once and it will remember).
    return raw === null ? true : raw === 'true';
  }

  function setPanelOpen(v) {
    window.localStorage.setItem(LS.panelOpen, v ? 'true' : 'false');
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
    // Only seed once per version, and never overwrite existing mob entries.
    try {
      const currentSeed = window.localStorage.getItem(LS.dropsSeedVersion) || '';
      if (currentSeed === DROPS_SEED_VERSION) return;

      const seed = safeJsonParse(DROPS_SEED_COMPACT_JSON, null);
      if (!seed || typeof seed !== 'object') return;

      const existing = loadDropsByMob();
      let changed = false;

      for (const mobKey of Object.keys(seed)) {
        if (!existing[mobKey]) {
          existing[mobKey] = seed[mobKey];
          changed = true;
          continue;
        }
        const haveItems = Array.isArray(existing[mobKey].items) && existing[mobKey].items.length;
        const seedItems = Array.isArray(seed[mobKey].items) && seed[mobKey].items.length;
        if (!haveItems && seedItems) {
          existing[mobKey] = seed[mobKey];
          changed = true;
        }
      }

      if (changed) saveDropsByMob(existing);
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

  // Emberfall uses event_page id 7 in the nav, but wave/battle links point to event=8 in your snapshots.
  const EMBERFALL_EVENT_IDS = new Set(['7', '8']);

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
    // Example: "Objective: Collect 4 x Memory Ash. Drops in Arcane Wild Fringe."
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
    const cards = Array.from(document.querySelectorAll('.monster-card[data-monster-id]'));
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
    if (document.getElementById('tmEmberfallHelperPanel')) {
      const toggle = document.getElementById('tmEmberfallHelperToggle');
      if (toggle) {
        toggle.textContent = isEnabled() ? 'Emberfall Helper ON' : 'Emberfall Helper OFF';
        toggle.style.background = isEnabled() ? '#1f9d63' : '#963838';
      }
      const collapseBtn = document.getElementById('tmEmberfallHelperCollapse');
      if (collapseBtn) collapseBtn.textContent = isPanelOpen() ? 'Hide' : 'Show';
      return;
    }

    const panel = document.createElement('div');
    panel.id = 'tmEmberfallHelperPanel';
    Object.assign(panel.style, {
      position: 'fixed',
      top: '92px',
      right: '10px',
      zIndex: '2147483647',
      width: '360px',
      maxWidth: '92vw',
      padding: '10px',
      borderRadius: '12px',
      background: 'rgba(14,18,26,0.94)',
      border: '1px solid rgba(255,211,105,0.25)',
      boxShadow: '0 12px 28px rgba(0,0,0,0.45)',
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

    const collapse = document.createElement('button');
    collapse.id = 'tmEmberfallHelperCollapse';
    collapse.type = 'button';
    collapse.textContent = isPanelOpen() ? 'Hide' : 'Show';
    Object.assign(collapse.style, {
      padding: '6px 10px',
      borderRadius: '10px',
      border: '1px solid rgba(255,255,255,0.12)',
      background: 'rgba(255,255,255,0.06)',
      color: '#fff',
      cursor: 'pointer',
      fontWeight: '700'
    });
    collapse.addEventListener('click', () => {
      setPanelOpen(!isPanelOpen());
      const body = document.getElementById('tmEmberfallHelperBody');
      if (body) body.style.display = isPanelOpen() ? 'block' : 'none';
      collapse.textContent = isPanelOpen() ? 'Hide' : 'Show';
    });

    header.appendChild(title);
    header.appendChild(collapse);

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
    body.style.display = isPanelOpen() ? 'block' : 'none';
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
    document.body.appendChild(panel);

    // Auto-capture quests every time you open/refresh the Emberfall map.
    // (Quest Journal can render late, so retry briefly.)
    autoCaptureQuestsWithRetry();
    refresh();
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
        lines.push(`<div style="margin-top:8px;color:#c7cbdf;">No quests captured yet. Open Emberfall event page and press <strong>Capture Quests</strong>.</div>`);
      }
    }

    // On the wave list page, show which mob types are still missing drop data and give you quick links to open one.
    if (isActiveWavePage()) {
      const mobLinks = getMobTypeLinksFromWavePage();
      if (mobLinks.length) {
        const missing = mobLinks.filter((m) => !dropsByMob[normKey(m.mobName)]);
        lines.push(`<div style="margin-top:10px;font-weight:800;color:#fff;">Arcane Wild Fringe Mobs</div>`);
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
      else lines.push(`<div style="margin-top:6px;color:#c7cbdf;">No quests captured yet. Open the Emberfall map and press <strong>Capture Quests</strong>.</div>`);
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
