
// ==UserScript==
// @name         Veyra Graveyard Multi-Loot
// @namespace    https://demonicscans.org/
// @version      0.2.1
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
  const SELECTOR_CARD = '.monster-card[data-dead="1"][data-monster-id]';
  const SELECTOR_ELIGIBLE_CARD = '.monster-card[data-dead="1"][data-eligible="1"][data-monster-id]';
  const SELECTOR_ANY_DEAD_CARD = '.monster-card[data-dead="1"][data-monster-id]';
  const FILTER_KEY = 'tm_graveyard_filter_mob_type_v1';
  const STYLE_ID = 'tmGraveyardMultiLootStyles';
  const MODAL_ID = 'tmGraveyardLootModal';

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
  }

  function ensureTypeFilterOptions() {
    const sel = document.getElementById('tmLootTypeFilter');
    if (!sel) return;

    const cards = Array.from(document.querySelectorAll(SELECTOR_ANY_DEAD_CARD));
    const types = new Set();
    for (const card of cards) {
      const t = getMonsterTypeFromCard(card);
      if (t) types.add(t);
    }

    const prev = sel.value || '';
    const nextOptions = [''].concat(Array.from(types).sort((a, b) => a.localeCompare(b)));

    const sig = nextOptions.join('\n');
    if (sel.dataset.tmOptionsSig !== sig) {
      sel.innerHTML = '';
      for (const v of nextOptions) {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v ? v : 'All dead monsters';
        sel.appendChild(opt);
      }
      sel.dataset.tmOptionsSig = sig;
    }

    const want = prev && nextOptions.includes(prev) ? prev : '';
    sel.value = want;
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

    const anchor =
      document.getElementById('lootStatus') ||
      document.getElementById('toggleDeadBtn') ||
      document.querySelector('.batch-loot-card');

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
      'background:rgba(255,255,255,0.06);color:#fff;font-size:12px;';

    typeWrap.appendChild(typeLabel);
    typeWrap.appendChild(selType);

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
    wrap.appendChild(btnSelVisible);
    wrap.appendChild(btnClear);
    wrap.appendChild(btnLoot);
    wrap.appendChild(count);

    anchor.parentElement.insertBefore(wrap, anchor.nextSibling);

    btnSelVisible.addEventListener('click', () => {
      ensureLootCheckboxes();
      const cards = getVisibleCards(getEligibleDeadCards());
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

    ensureTypeFilterOptions();
    applyTypeFilter();
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
      if (!hasGraveyard()) return;
      ensureControls();
      ensureTypeFilterOptions();
      applyTypeFilter();
      ensureLootCheckboxes();
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
  if (!hasGraveyard()) return;

  window.setTimeout(() => {
    ensureControls();
    ensureTypeFilterOptions();
    applyTypeFilter();
    ensureLootCheckboxes();
  }, 300);

  wireObservers();
})();
