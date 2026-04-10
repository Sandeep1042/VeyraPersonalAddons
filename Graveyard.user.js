// ==UserScript==
// @name         Veyra Graveyard Multi-Loot
// @namespace    https://demonicscans.org/
// @version      0.3.2
// @description  Adds checkbox multi-select + "Loot selected" to graveyard (dead mobs) on wave pages, plus a loot summary modal.
// @match        https://demonicscans.org/active_wave.php*
// @homepageURL  https://github.com/nobody65321/VeyraPersonalAddons
// @updateURL    https://github.com/nobody65321/VeyraPersonalAddons/raw/refs/heads/main/Graveyard.user.js
// @downloadURL  https://github.com/nobody65321/VeyraPersonalAddons/raw/refs/heads/main/Graveyard.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const LOOT_URL = 'loot.php';
  const SELECTOR_CARD = '.monster-card[data-dead="1"]';
  const SELECTOR_ELIGIBLE_CARD = '.monster-card[data-dead="1"][data-eligible="1"]';
  const SELECTOR_ANY_DEAD_CARD = '.monster-card[data-dead="1"]';
  const FILTER_KEY = 'tm_graveyard_filter_mob_type_v1';
  const ALL_TYPES_CACHE_PREFIX = 'tm_graveyard_all_dead_index_v1:';
  const ALL_TYPES_TTL_MS = 5 * 60 * 1000;
  const UI_ICON_SIZE_KEY = 'tm_graveyard_icon_size_v1';
  const UI_CARD_SIZE_KEY = 'tm_graveyard_card_size_v1';
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

  function setIconSize(size) {
    const s = String(size || '').toLowerCase();
    try {
      window.sessionStorage.setItem(UI_ICON_SIZE_KEY, s);
    } catch {
      // ignore
    }

    document.body.classList.remove('tm-graveyard-icons-small', 'tm-graveyard-icons-tiny');
    if (s === 'small') document.body.classList.add('tm-graveyard-icons-small');
    if (s === 'tiny') document.body.classList.add('tm-graveyard-icons-tiny');
  }

  function applyIconSizeFromStorage() {
    try {
      const saved = window.sessionStorage.getItem(UI_ICON_SIZE_KEY);
      if (saved !== null && saved !== undefined) setIconSize(saved);
    } catch {
      // ignore
    }
  }

  function setCardSize(size) {
    const s = String(size || '').toLowerCase();
    try {
      window.sessionStorage.setItem(UI_CARD_SIZE_KEY, s);
    } catch {
      // ignore
    }

    document.body.classList.remove('tm-graveyard-cards-compact', 'tm-graveyard-cards-tiny');
    if (s === 'compact') document.body.classList.add('tm-graveyard-cards-compact');
    if (s === 'tiny') document.body.classList.add('tm-graveyard-cards-tiny');
  }

  function applyCardSizeFromStorage() {
    try {
      const saved = window.sessionStorage.getItem(UI_CARD_SIZE_KEY);
      if (saved !== null && saved !== undefined) setCardSize(saved);
    } catch {
      // ignore
    }
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

      /* Make our selects readable even during event themes */
      #tmLootControls select{
        background: #11131b !important;
        color: #e6e9ff !important;
        border: 1px solid rgba(255,255,255,0.14) !important;
      }
      #tmLootControls select option{
        background: #11131b !important;
        color: #e6e9ff !important;
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
    wrap.style.cssText = 'display:flex;gap:10px;align-items:center;flex-wrap:wrap;flex-basis:100%;margin-top:10px;';

    const typeWrap = document.createElement('div');
    typeWrap.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;';

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
    badge.style.cssText = 'color:#9aa0be;font-size:12px;';
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

    const iconSizeWrap = document.createElement('div');
    iconSizeWrap.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;';

    const iconSizeLabel = document.createElement('span');
    iconSizeLabel.style.cssText = 'color:#c7cbdf;font-size:12px;';
    iconSizeLabel.textContent = 'Icons:';

    const iconSizeSel = document.createElement('select');
    iconSizeSel.style.cssText =
      'padding:6px 8px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);' +
      'background:rgba(255,255,255,0.06);color:#fff;font-size:12px;';
    iconSizeSel.innerHTML = `<option value="">Normal</option><option value="small">Small</option><option value="tiny">Tiny</option>`;

    iconSizeWrap.appendChild(iconSizeLabel);
    iconSizeWrap.appendChild(iconSizeSel);

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

    const cardSizeWrap = document.createElement('div');
    cardSizeWrap.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;';

    const cardSizeLabel = document.createElement('span');
    cardSizeLabel.style.cssText = 'color:#c7cbdf;font-size:12px;';
    cardSizeLabel.textContent = 'Cards:';

    const cardSizeSel = document.createElement('select');
    cardSizeSel.style.cssText =
      'padding:6px 8px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);' +
      'background:rgba(255,255,255,0.06);color:#fff;font-size:12px;';
    cardSizeSel.innerHTML = `<option value=\"\">Normal</option><option value=\"compact\">Compact</option><option value=\"tiny\">Tiny</option>`;

    cardSizeWrap.appendChild(cardSizeLabel);
    cardSizeWrap.appendChild(cardSizeSel);

    const btnSelVisible = document.createElement('button');
    btnSelVisible.type = 'button';
    btnSelVisible.className = 'btn';
    btnSelVisible.textContent = '✅ Select visible dead';

    const btnClear = document.createElement('button');
    btnClear.type = 'button';
    btnClear.className = 'btn';
    btnClear.textContent = '🧹 Clear selection';

    const btnLoot = document.createElement('button');
    btnLoot.type = 'button';
    btnLoot.className = 'btn';
    btnLoot.textContent = '💰 Loot selected';
    btnLoot.style.cssText = 'background:#1a9d73;border-color:#1a9d73;';

    const count = document.createElement('span');
    count.id = 'tmLootSelectedCount';
    count.style.cssText = 'color:#9aa0be;font-size:12px;';
    count.textContent = 'Selected: 0';

    wrap.appendChild(typeWrap);
    wrap.appendChild(btnReloadTypes);
    wrap.appendChild(btnGoToType);
    wrap.appendChild(iconSizeWrap);
    wrap.appendChild(cardSizeWrap);
    wrap.appendChild(btnLoadAllDead);
    wrap.appendChild(autoLoadWrap);
    wrap.appendChild(btnSelVisible);
    wrap.appendChild(btnClear);
    wrap.appendChild(btnLoot);
    wrap.appendChild(count);

    // Prefer inserting ABOVE the monster grid if we're anchoring to the container.
    const insertBefore = containerForInsert && anchor === containerForInsert;
    anchor.parentElement.insertBefore(wrap, insertBefore ? anchor : anchor.nextSibling);

    btnSelVisible.addEventListener('click', () => {
      ensureLootCheckboxes();
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
      setStatus(`Selected ${getSelectedLootIds().length} visible dead monsters.`);
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

    applyIconSizeFromStorage();
    try {
      iconSizeSel.value = window.sessionStorage.getItem(UI_ICON_SIZE_KEY) || '';
    } catch {
      iconSizeSel.value = '';
    }
    iconSizeSel.addEventListener('change', () => setIconSize(iconSizeSel.value));

    applyCardSizeFromStorage();
    try {
      cardSizeSel.value = window.sessionStorage.getItem(UI_CARD_SIZE_KEY) || '';
    } catch {
      cardSizeSel.value = '';
    }
    cardSizeSel.addEventListener('change', () => setCardSize(cardSizeSel.value));
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
      if (id === 'toggleDeadBtn' || id === 'toggleDeadBossBtn') {
        window.setTimeout(run, 250);
      }
    }, true);
  }

  if (!/\/active_wave\.php$/i.test(window.location.pathname)) return;

  // Always install styles + observers so the UI works even if dead cards render later (page 1 often loads them after toggles).
  ensureStyles();
  applyIconSizeFromStorage();
  applyCardSizeFromStorage();

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
  }, 300);

  wireObservers();
})();
