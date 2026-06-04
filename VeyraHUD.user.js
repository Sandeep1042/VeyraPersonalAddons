// ==UserScript==
// @name         Veyra HUD (All-in-One)
// @namespace    https://demonicscans.org/
// @version      0.3.23.15
// @description  All-in-one userscript: Emberfall Quest/Drops Helper, Graveyard multi-loot, Monster Board, Cube intro skipper, Solo PvP bot.
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
  - Event.user.js
  - Graveyard.user.js
  - shadowbridge-warrens-monsters.user.js
  - cube-intro-skipper.user.js
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
      version: '0.3.23.15',
      builtAt: new Date().toISOString()
    };
    try { document.documentElement.dataset.veyrahudAioVersion = '0.3.23.15'; } catch (e) {}
    console.log('[VeyraHUD AIO] loaded v0.3.23.15');
  } catch (e) {
    // ignore
  }
})();

// ---- Pet link race-bonus stat correction ----
(function(){
  'use strict';

  const path = String(window.location.pathname || '').toLowerCase();
  const isPetsPage = /\/pets(?:\.php)?$/i.test(path);
  const isStatsPage = /\/stats(?:\.php)?$/i.test(path);
  const shouldRun = isPetsPage || isStatsPage;
  if (!shouldRun || window.__tmPetLinkShareFixInstalled) return;
  window.__tmPetLinkShareFixInstalled = true;

  function parseNumber(value) {
    const num = Number(String(value ?? '').replace(/,/g, ''));
    return Number.isFinite(num) ? num : 0;
  }

  function parseSharePct(link) {
    const label = String(link?.share_pct_label ?? link?.share_pct ?? link?.share_percent ?? '');
    const match = label.match(/(\d+(?:\.\d+)?)\s*%/);
    const parsed = match ? Number(match[1]) : NaN;
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
    const level = Number(link?.link_level || 0);
    if (level === 1) return 50;
    if (level === 2) return 25;
    return 0;
  }

  function actualSharePct(link) {
    const level = Number(link?.link_level || 0);
    const shown = parseSharePct(link);
    if (level === 1 && shown > 50) return 50;
    if (level === 2 && shown > 25) return 25;
    if (level === 1) return 50;
    if (level === 2) return 25;
    return shown;
  }

  function correctedShareValue(value, shownPct, actualPct) {
    const num = parseNumber(value);
    if (!num || !shownPct || !actualPct || shownPct === actualPct) return num;
    return Math.round(num * (actualPct / shownPct));
  }

  function getPetBaseStat(pet, statName, updatedValue, linkedShownTotal) {
    const keyOptions = statName === 'attack'
      ? ['base_attack', 'original_attack', 'raw_attack', 'attack']
      : ['base_defense', 'original_defense', 'raw_defense', 'defense'];
    for (const key of keyOptions) {
      const value = parseNumber(pet?.[key]);
      if (value > 0) return value;
    }
    return Math.max(0, parseNumber(updatedValue) - parseNumber(linkedShownTotal));
  }

  function correctEffectText(value) {
    return String(value || '')
      .replace(/Shares\s+50\s*%\s*\(or\s*60\s*(?:%|％|percent)\s*same race\)/gi, 'Shares 50%')
      .replace(/Shares\s+25\s*%\s*\(or\s*35\s*(?:%|％|percent)\s*same race\)/gi, 'Shares 25%')
      .replace(/60\s*(?:%|％|percent)/gi, '50%')
      .replace(/35\s*(?:%|％|percent)/gi, '25%');
  }
  try { window.__tmCorrectPetLinkEffectText = correctEffectText; } catch (e) {}

  function correctAllPetLinkStrings(value, depth = 0) {
    if (depth > 8 || value == null) return value;
    if (typeof value === 'string') return correctEffectText(value);
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        value[index] = correctAllPetLinkStrings(item, depth + 1);
      });
      return value;
    }
    if (typeof value === 'object') {
      Object.keys(value).forEach((key) => {
        value[key] = correctAllPetLinkStrings(value[key], depth + 1);
      });
    }
    return value;
  }

  function formatScaledEffectNumber(value, ratio) {
    const num = Number(value);
    if (!Number.isFinite(num) || !Number.isFinite(ratio) || ratio <= 0 || ratio === 1) return value;
    const scaled = num * ratio;
    const decimals = String(value).includes('.') ? Math.min(10, Math.max(2, String(value).split('.')[1].length)) : 2;
    return String(Number(scaled.toFixed(decimals)));
  }

  function scaleLinkedEffectText(value, shownPct, actualPct) {
    if (!value || !shownPct || !actualPct || shownPct === actualPct) return correctEffectText(value);
    const ratio = actualPct / shownPct;
    return correctEffectText(String(value))
      .replace(/(\bby\s+)([-+]?\d+(?:\.\d+)?)(\s*(?:%|percent|of\b))/gi, (_all, prefix, num, suffix) => `${prefix}${formatScaledEffectNumber(num, ratio)}${suffix}`)
      .replace(/(\bup\s+to\s+)([-+]?\d+(?:\.\d+)?)(\s*x\b)/gi, (_all, prefix, num, suffix) => `${prefix}${formatScaledEffectNumber(num, ratio)}${suffix}`)
      .replace(/(\bincrease\s+[^.\n]{0,120}?\s+)([-+]?\d+\.\d+)(\s+of\b)/gi, (_all, prefix, num, suffix) => `${prefix}${formatScaledEffectNumber(num, ratio)}${suffix}`);
  }

  function correctPetLinkPayload(data) {
    if (!data || data.status !== 'success' || !data.pet || !Array.isArray(data.links)) return correctAllPetLinkStrings(data);

    let shownAttack = 0;
    let shownDefense = 0;
    let realAttack = 0;
    let realDefense = 0;
    data.links.forEach((link) => {
      const shownPct = parseSharePct(link);
      const actualPct = actualSharePct(link);
      const addAttack = parseNumber(link.add_attack);
      const addDefense = parseNumber(link.add_defense);
      const fixedAttack = correctedShareValue(addAttack, shownPct, actualPct);
      const fixedDefense = correctedShareValue(addDefense, shownPct, actualPct);

      shownAttack += addAttack;
      shownDefense += addDefense;
      realAttack += fixedAttack;
      realDefense += fixedDefense;

      link.add_attack = fixedAttack;
      link.add_defense = fixedDefense;
      link.share_pct_label = actualPct ? `${actualPct}%` : String(link.share_pct_label || '');
      if ('share_pct' in link) link.share_pct = actualPct;
      if ('share_percent' in link) link.share_percent = actualPct;
      if (typeof link.effect_text === 'string') link.effect_text = scaleLinkedEffectText(link.effect_text, shownPct, actualPct);
    });

    const pet = data.pet;
    const baseAttack = getPetBaseStat(pet, 'attack', pet.updated_attack, shownAttack);
    const baseDefense = getPetBaseStat(pet, 'defense', pet.updated_defense, shownDefense);
    pet.base_attack = baseAttack;
    pet.base_defense = baseDefense;
    pet.updated_attack = Math.max(0, baseAttack + realAttack);
    pet.updated_defense = Math.max(0, baseDefense + realDefense);

    if (typeof data.pet.total_effect_text === 'string') {
      data.pet.total_effect_text = correctEffectText(data.pet.total_effect_text);
    }

    return correctAllPetLinkStrings(data);
  }

  function makeJsonResponse(response, data) {
    const headers = new Headers(response.headers);
    headers.set('content-type', 'application/json; charset=utf-8');
    return new Response(JSON.stringify(data), {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }

  const nativeFetch = window.fetch;
  if (typeof nativeFetch === 'function') {
    window.fetch = async function(input, init) {
      const response = await nativeFetch.call(this, input, init);
      let url = '';
      try {
        url = typeof input === 'string' ? input : String(input?.url || '');
      } catch (e) {
        url = '';
      }
      if (!/pet_links_ajax\.php/i.test(url)) return response;

      const data = await response.clone().json().catch(() => null);
      if (!data) return response;
      return makeJsonResponse(response, correctPetLinkPayload(data));
    };
  }

  function applyPetCardTotals(petInvId, data) {
    const pet = data?.pet || {};
    const atk = parseNumber(pet.updated_attack);
    const def = parseNumber(pet.updated_defense);
    const baseAtk = parseNumber(pet.base_attack);
    const baseDef = parseNumber(pet.base_defense);
    const effectText = String(pet.total_effect_text || '');
    if (!petInvId || (!atk && !def)) return;

    document.querySelectorAll(`.slot-box[data-pet-inv-id="${String(petInvId).replace(/"/g, '\\"')}"]`).forEach((card) => {
      if (isInventoryPetCard(card)) return;
      const equipped = isEquippedPetCard(card);
      const atkEl = card.querySelector('[data-attack]');
      const defEl = card.querySelector('[data-defense]');
      if (atkEl) atkEl.textContent = String(equipped ? atk : (baseAtk || atk));
      if (defEl) defEl.textContent = String(equipped ? def : (baseDef || def));

      const powerEl = card.querySelector('[data-power]');
      if (equipped && powerEl && effectText) {
        if (!powerEl.dataset.tmOriginalPowerText) powerEl.dataset.tmOriginalPowerText = powerEl.textContent || '';
        powerEl.textContent = `⚡ ${effectText}`;
        powerEl.dataset.tmLinkedTotalPower = '1';
        powerEl.style.display = '';
      } else if (!equipped && powerEl?.dataset.tmLinkedTotalPower === '1') {
        powerEl.textContent = powerEl.dataset.tmOriginalPowerText || '';
        delete powerEl.dataset.tmLinkedTotalPower;
      }
      normalizePetCardSpacing(card);
    });
  }

  function normalizePetCardSpacing(root = document) {
    if (!isPetsPage || !root) return;
    ensurePetCardSpacingStyles();
    const cards = root.matches?.('.slot-box, .pet-card') ? [root] : Array.from(root.querySelectorAll?.('.slot-box.pet-card, .pet-card') || []);
    cards.forEach((card) => {
      if (isInventoryPetCard(card)) return;
      if (card instanceof HTMLElement) {
        card.style.alignSelf = 'flex-start';
        card.style.height = 'auto';
      }
      card.querySelectorAll?.('[data-power], .pet-power').forEach((powerEl) => {
        if (!(powerEl instanceof HTMLElement)) return;
        const meaningfulText = String(powerEl.textContent || '')
          .replace(/^[^A-Za-z0-9%+.-]+/, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (!meaningfulText) {
          powerEl.classList.add('tm-pet-empty-row');
          powerEl.style.display = 'none';
          powerEl.style.marginTop = '0';
          powerEl.style.marginBottom = '0';
        } else {
          powerEl.classList.remove('tm-pet-empty-row');
          powerEl.style.display = '';
          if (powerEl.style.marginTop === '0px' || powerEl.style.marginTop === '0') powerEl.style.marginTop = '6px';
        }
      });
      card.querySelectorAll?.('.levelup-row, .pet-sigils-panel, .pet-sigils-grid').forEach((el) => {
        if (!(el instanceof HTMLElement)) return;
        const hasVisibleContent = Array.from(el.querySelectorAll('button, input, select, textarea, img, svg, canvas, a'))
          .some((child) => child instanceof HTMLElement && child.offsetParent !== null && String(child.textContent || child.getAttribute('aria-label') || '').trim());
        const text = String(el.textContent || '').replace(/\s+/g, ' ').trim();
        if (!text && !hasVisibleContent) {
          el.classList.add('tm-pet-empty-row');
          el.style.display = 'none';
          el.style.marginTop = '0';
          el.style.marginBottom = '0';
          el.style.paddingTop = '0';
          el.style.paddingBottom = '0';
        }
      });
    });
  }

  function ensurePetCardSpacingStyles() {
    if (document.getElementById('tmPetCardSpacingFixStyles')) return;
    const style = document.createElement('style');
    style.id = 'tmPetCardSpacingFixStyles';
    style.textContent = `
      body .tm-pet-empty-row{
        display:none !important;
        margin:0 !important;
        padding:0 !important;
        height:0 !important;
        min-height:0 !important;
        overflow:hidden !important;
      }
    `;
    document.head.appendChild(style);
  }

  function isInventoryPetCard(card) {
    const section = card?.closest?.('.section, [data-section-key], section, .card, .panel');
    const sectionText = String(section?.querySelector?.('.section-title, h1, h2, h3, h4')?.textContent || section?.getAttribute?.('data-section-key') || '');
    return /inventory/i.test(sectionText) || !!card?.querySelector?.('button[onclick*="equipPet"], button[onclick*="showEquipModal"]');
  }

  function isEquippedPetCard(card) {
    if (!card) return false;
    if (card.querySelector('button[onclick*="unequipPet"]')) return true;
    if (isInventoryPetCard(card)) return false;
    const section = card.closest('.section, [data-section-key], section, .card, .panel');
    const sectionText = String(section?.querySelector?.('.section-title, h1, h2, h3, h4')?.textContent || section?.getAttribute?.('data-section-key') || '');
    return /\b(team|equipped|pve|pvp|attack|defense)\b/i.test(sectionText);
  }

  function correctPetLinkModalText() {
    if (!isPetsPage) return;
    const body = document.getElementById('linksModalBody');
    if (!body || body.dataset.tmPetLinkShareTextFixed === body.innerHTML.length.toString()) return;

    correctRenderedPetLinkText(body);
    body.dataset.tmPetLinkShareTextFixed = body.innerHTML.length.toString();
  }

  function correctRenderedPetLinkText(root) {
    if (!isPetsPage || !root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach((node) => {
      const text = node.nodeValue || '';
      const fixed = correctEffectText(text);
      if (fixed !== text) node.nodeValue = fixed;
    });
  }

  function correctVisiblePetLinkText() {
    if (!isPetsPage) return;
    const modal = document.getElementById('linksModalBody');
    if (modal) correctRenderedPetLinkText(modal);
    Array.from(document.querySelectorAll('.slot-box.pet-card, .pet-card'))
      .filter((card) => !isInventoryPetCard(card))
      .forEach((card) => correctRenderedPetLinkText(card));
    document.querySelectorAll('#linksModalBody [data-power], #linksModalBody [data-effect], #linksModalBody [data-ability], #linksModalBody [data-passive], #linksModalBody [data-description], #linksModalBody [data-desc], #linksModalBody [data-text], #linksModalBody [data-content], #linksModalBody [data-bs-content], #linksModalBody [title], #linksModalBody [aria-label], #linksModalBody [onclick]').forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      Array.from(el.attributes || []).forEach((attr) => {
        if (!/^(?:data-(?:power|effect|ability|passive|description|desc|text|content|bs-content)|title$|aria-label$|onclick$)/i.test(attr.name)) return;
        const fixed = correctEffectText(attr.value);
        if (fixed !== attr.value) el.setAttribute(attr.name, fixed);
      });
    });
    normalizePetCardSpacing(document);
  }

  async function refreshVisibleLinkedPetCards() {
    if (!isPetsPage) return;
    const ids = Array.from(new Set(
      Array.from(document.querySelectorAll('.slot-box.pet-card[data-pet-inv-id]'))
        .filter((card) => !isInventoryPetCard(card) && !!card.querySelector('.linked-gold, [data-attack].linked-gold, [data-defense].linked-gold'))
        .map((card) => String(card.getAttribute('data-pet-inv-id') || '').trim())
        .filter(Boolean)
    ));
    if (!ids.length) return;

    for (const petInvId of ids) {
      try {
        const response = await fetch(`pet_links_ajax.php?pet_inv_id=${encodeURIComponent(petInvId)}`, { cache: 'no-store' });
        const data = await response.json().catch(() => null);
        if (data?.status === 'success') applyPetCardTotals(petInvId, data);
      } catch (e) {
        // Leave the stock pet card alone if the link endpoint cannot be loaded.
      }
    }
    correctVisiblePetLinkText();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      correctVisiblePetLinkText();
      refreshVisibleLinkedPetCards();
    }, { once: true });
  } else {
    correctVisiblePetLinkText();
    refreshVisibleLinkedPetCards();
  }

  if (isPetsPage) {
    let visibleFixTimer = 0;
    const queueVisibleFix = () => {
      window.clearTimeout(visibleFixTimer);
      visibleFixTimer = window.setTimeout(correctVisiblePetLinkText, 50);
    };

    const observePetPageText = () => {
      if (!document.body) return;
      const observer = new MutationObserver(queueVisibleFix);
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
      correctVisiblePetLinkText();
    };

    const observeModal = () => {
      const body = document.getElementById('linksModalBody');
      if (!body) return;
      const observer = new MutationObserver(() => {
        correctPetLinkModalText();
        correctVisiblePetLinkText();
      });
      observer.observe(body, { childList: true, subtree: true, characterData: true });
      correctPetLinkModalText();
      correctVisiblePetLinkText();
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        observePetPageText();
        observeModal();
      }, { once: true });
    } else {
      observePetPageText();
      observeModal();
    }
  }
})();

// ---- Stats menu breakdown ----
(function(){
  'use strict';

  const path = String(window.location.pathname || '').toLowerCase();
  if (!/\/stats\.php$/i.test(path)) return;

  const fmt = new Intl.NumberFormat();
  const pct = (value, total) => total > 0 ? `${((value / total) * 100).toFixed(2)}%` : '0.00%';
  const EQUIP_SETS = [
    { key: 'attack', title: 'PvE Set', note: 'Current PvE attack equipment' },
    { key: 'pvp_attack', title: 'PvP Attack Set', note: 'Current PvP attack equipment' },
    { key: 'defense', title: 'PvP Defense Set', note: 'Current PvP defense equipment' }
  ];
  let classPassiveState = { loading: true, className: '', passive: '', error: '' };

  function readNumber(id) {
    const el = document.getElementById(id);
    const raw = String(el?.textContent || '').replace(/[^\d.-]/g, '');
    const value = Number(raw);
    return Number.isFinite(value) ? value : 0;
  }

  function makeRow(label, value, note) {
    return `
      <div class="row tm-stat-breakdown-row">
        <span>${label}</span>
        <span>
          <strong>${value}</strong>
          ${note ? `<small>${note}</small>` : ''}
        </span>
      </div>
    `;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[ch]));
  }

  function cleanAbilityText(value) {
    return String(value || '')
      .replace(/^[^A-Za-z0-9%+.-]+/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function cleanPetLinkAbilityText(value) {
    const text = cleanAbilityText(value);
    const fixer = window.__tmCorrectPetLinkEffectText;
    if (typeof fixer === 'function') return cleanAbilityText(fixer(text));
    return text
      .replace(/Shares\s+50\s*%\s*\(or\s*60\s*(?:%|％|percent)\s*same race\)/gi, 'Shares 50%')
      .replace(/Shares\s+25\s*%\s*\(or\s*35\s*(?:%|％|percent)\s*same race\)/gi, 'Shares 25%')
      .replace(/60\s*(?:%|％|percent)/gi, '50%')
      .replace(/35\s*(?:%|％|percent)/gi, '25%');
  }

  function ensureStyles() {
    if (document.getElementById('tmStatBreakdownStyles')) return;
    const style = document.createElement('style');
    style.id = 'tmStatBreakdownStyles';
    style.textContent = `
      #tmStatBreakdownCard .value{
        color:#ffd369;
        font-variant-numeric:tabular-nums;
      }
      body.tm-veyra-stats-page .container{
        max-width:1100px;
      }
      body.tm-veyra-stats-page .grid{
        display:grid !important;
        grid-template-columns:repeat(3, minmax(0, 1fr));
        align-items:stretch;
        gap:20px;
      }
      body.tm-veyra-stats-page .card{
        width:auto !important;
        min-width:0;
        box-sizing:border-box;
      }
      #tmStatBreakdownCard .tm-stat-breakdown-row span:last-child,
      .tm-stat-set-card .tm-stat-breakdown-row span:last-child{
        text-align:right;
        display:flex;
        flex-direction:column;
        gap:2px;
        align-items:flex-end;
      }
      #tmStatBreakdownCard small,
      .tm-stat-set-card small{
        color:#aaa;
        font-size:11px;
        font-weight:400;
      }
      #tmStatBreakdownCard hr,
      .tm-stat-set-card hr{
        border:0;
        border-top:1px solid #333;
        margin:10px 0;
      }
      .tm-stat-set-card .value{
        color:#9ad39a;
        font-variant-numeric:tabular-nums;
      }
      .tm-stat-set-card .tm-stat-set-note{
        color:#9aa0be;
        font-size:12px;
        text-align:center;
        margin:-2px 0 8px;
        min-height:28px;
      }
      .tm-stat-pet-abilities{
        display:flex;
        flex-direction:column;
        gap:8px;
        margin-top:10px;
        text-align:left;
      }
      .tm-stat-pet-ability{
        border:1px solid #303449;
        border-radius:8px;
        background:#181a25;
        padding:8px;
      }
      .tm-stat-pet-ability b{
        display:block;
        color:#f3e2ac;
        font-size:12px;
        margin-bottom:4px;
      }
      .tm-stat-pet-ability p{
        margin:0;
        color:#dfe3f4;
        font-size:11px;
        line-height:1.35;
      }
      .tm-stat-pet-links{
        display:flex;
        flex-direction:column;
        gap:5px;
        margin-top:7px;
        padding-top:7px;
        border-top:1px dashed #34384d;
      }
      .tm-stat-pet-link{
        color:#c7cce6;
        font-size:11px;
        line-height:1.35;
      }
      .tm-stat-pet-link span{
        color:#9aa0be;
      }
      .tm-stat-class-passive{
        margin-top:10px;
        padding:9px;
        border:1px solid #303449;
        border-radius:8px;
        background:#181a25;
        text-align:left;
      }
      .tm-stat-class-passive b{
        display:block;
        color:#ffd369;
        font-size:12px;
        margin-bottom:5px;
      }
      .tm-stat-class-passive p{
        margin:0;
        color:#dfe3f4;
        font-size:12px;
        line-height:1.4;
      }
      .tm-stat-class-effects{
        margin-top:8px;
        padding-top:8px;
        border-top:1px dashed #34384d;
      }
      @media(max-width:900px){
        body.tm-veyra-stats-page .grid{
          grid-template-columns:1fr;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function parseNumberText(value) {
    const raw = String(value || '').replace(/,/g, '');
    const num = Number(raw);
    return Number.isFinite(num) ? num : 0;
  }

  function parseEquippedItemStats(item) {
    const dataAtk = item.getAttribute('data-atk');
    const dataDef = item.getAttribute('data-def');
    if (dataAtk !== null || dataDef !== null) {
      return {
        attack: parseNumberText(dataAtk),
        defense: parseNumberText(dataDef)
      };
    }

    const text = String(item.querySelector('.label')?.textContent || item.textContent || '').replace(/\s+/g, ' ');
    const attackMatch = text.match(/([\d,]+)\s*ATK\b/i);
    const defenseMatch = text.match(/([\d,]+)\s*DEF\b/i);

    return {
      attack: parseNumberText(attackMatch?.[1]),
      defense: parseNumberText(defenseMatch?.[1])
    };
  }

  function parseSetDocument(doc) {
    const equippedSection =
      doc.querySelector('.section[data-section-key$="-equipped"]') ||
      Array.from(doc.querySelectorAll('.section')).find((section) => /equipped items/i.test(section.textContent || ''));

    const scope = equippedSection || doc;
    const itemSelector = equippedSection
      ? '.slot-box'
      : '.slot-box[data-equip="1"][data-atk][data-def]';
    const items = Array.from(scope.querySelectorAll(itemSelector))
      .filter((item) => {
        if (!equippedSection) return true;
        return !!item.querySelector('button[onclick*="unequipItem"]') || /\bATK\b/i.test(item.textContent || '') || /\bDEF\b/i.test(item.textContent || '');
      });

    const totals = items.reduce((acc, item) => {
      const stats = parseEquippedItemStats(item);
      acc.attack += stats.attack;
      acc.defense += stats.defense;
      if (stats.attack || stats.defense) acc.count += 1;
      return acc;
    }, { attack: 0, defense: 0, count: 0 });

    totals.total = totals.attack + totals.defense;
    return totals;
  }

  function parsePetDocument(doc) {
    const sections = Array.from(doc.querySelectorAll('.section'));
    const equippedSection =
      sections.find((section) => {
        const title = section.querySelector('.section-title');
        return title && !/inventory/i.test(title.textContent || '');
      }) ||
      sections.find((section) => Array.from(section.querySelectorAll('.pet-card')).some((card) => card.querySelector('button[onclick*="unequipPet"]')));

    const scope = equippedSection || doc;
    const pets = Array.from(scope.querySelectorAll('.pet-card[data-pet-inv-id]'))
      .filter((pet) => !!pet.querySelector('button[onclick*="unequipPet"]') || !!equippedSection);

    const details = [];
    const totals = pets.reduce((acc, pet) => {
      const atk = parseNumberText(pet.querySelector('[data-attack]')?.textContent);
      const def = parseNumberText(pet.querySelector('[data-defense]')?.textContent);
      const id = parseNumberText(pet.getAttribute('data-pet-inv-id'));
      const name =
        String(pet.querySelector('.info-btn')?.getAttribute('data-name') || '').trim() ||
        String(pet.querySelector('img[alt]')?.getAttribute('alt') || '').trim() ||
        `Pet #${id || acc.count + 1}`;
      const ability = cleanPetLinkAbilityText(pet.querySelector('[data-power]')?.textContent);
      acc.attack += atk;
      acc.defense += def;
      if (atk || def) {
        acc.count += 1;
        details.push({ id, name, attack: atk, defense: def, ability, links: [] });
      }
      return acc;
    }, { attack: 0, defense: 0, count: 0 });

    totals.total = totals.attack + totals.defense;
    totals.mainCount = totals.count;
    totals.linkedCount = 0;
    totals.details = details;
    return totals;
  }

  function mergeTotals(...parts) {
    const totals = parts.reduce((acc, part) => {
      acc.attack += Number(part?.attack || 0);
      acc.defense += Number(part?.defense || 0);
      acc.count += Number(part?.count || 0);
      return acc;
    }, { attack: 0, defense: 0, count: 0 });
    totals.total = totals.attack + totals.defense;
    return totals;
  }

  async function fetchSetTotals(setKey) {
    const url = new URL('/inventory.php', window.location.origin);
    url.searchParams.set('set', setKey);

    const response = await fetch(url.toString(), { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return parseSetDocument(doc);
  }

  async function fetchPetTotals(setKey) {
    const url = new URL('/pets.php', window.location.origin);
    url.searchParams.set('team', setKey);

    const response = await fetch(url.toString(), { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const totals = parsePetDocument(doc);
    await hydratePetLinkDetails(totals);
    return totals;
  }

  function parseClassPassiveDocument(doc, html) {
    const scriptText = String(html || '');
    const configMatch = scriptText.match(/window\.SkillTreeConfig\s*=\s*\{([\s\S]*?)\n\};/);
    const configBody = configMatch ? configMatch[1] : '';
    const classNameMatch = configBody.match(/className\s*:\s*["']([^"']+)["']/);
    const passiveMatch = configBody.match(/classPassive\s*:\s*["']([\s\S]*?)["']\s*(?:,|\/\/|\n)/);

    const modalTitle = String(doc.querySelector('#passive-modal .modal-title')?.textContent || '').replace(/\s+Passive\s*$/i, '').trim();
    const modalPassive = String(doc.querySelector('#passive-body')?.textContent || '').replace(/\s+/g, ' ').trim();

    return {
      className: String(classNameMatch?.[1] || modalTitle || '').trim(),
      passive: cleanAbilityText(passiveMatch?.[1] || modalPassive || '')
    };
  }

  async function fetchClassPassive() {
    const url = new URL('/class_skill_tree.php', window.location.origin);
    const response = await fetch(url.toString(), { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return parseClassPassiveDocument(doc, html);
  }

  function renderClassPassive() {
    if (classPassiveState.loading) {
      return `
        <hr>
        <div class="tm-stat-class-passive">
          <b>Class Passive</b>
          <p>Loading...</p>
        </div>
      `;
    }

    if (classPassiveState.error) {
      return `
        <hr>
        <div class="tm-stat-class-passive">
          <b>Class Passive</b>
          <p>Unable to load class ability right now.</p>
        </div>
      `;
    }

    const title = classPassiveState.className ? `${classPassiveState.className} Passive` : 'Class Passive';
    return `
      <hr>
      <div class="tm-stat-class-passive">
        <b>${escapeHtml(title)}</b>
        <p>${escapeHtml(classPassiveState.passive || 'No passive ability found.')}</p>
      </div>
    `;
  }

  function getClassStatEffects(passiveText) {
    const text = String(passiveText || '')
      .toLowerCase()
      .replace(/\b(atk|attack)\s+(?:and|&|\/)\s+(def|defense)\b/gi, 'stats')
      .replace(/\b(def|defense)\s+(?:and|&|\/)\s+(atk|attack)\b/gi, 'stats');
    const effects = { attackPct: 0, defensePct: 0 };
    if (!text) return effects;

    const parts = text.split(/[.;]|\band\b/gi);
    for (const rawPart of parts) {
      const part = rawPart.trim();
      if (!part) continue;
      const percentMatch = part.match(/(\d+(?:\.\d+)?)\s*%/);
      if (!percentMatch) continue;

      let sign = 0;
      if (/\b(increase|increases|increased|boost|boosts|gain|gains|raise|raises)\b/i.test(part)) sign = 1;
      if (/\b(decrease|decreases|decreased|reduce|reduces|reduced|lower|lowers|lowered|lose|loses)\b/i.test(part)) sign = -1;
      if (!sign) continue;

      const amount = (Number(percentMatch[1]) || 0) / 100 * sign;
      const affectsAllStats =
        /\b(main|all|total|base)\s+stats?\b/i.test(part) ||
        /\bstats?\b/i.test(part) ||
        /\b(atk|attack)\b[\s\S]{0,30}\b(def|defense)\b/i.test(part) ||
        /\b(def|defense)\b[\s\S]{0,30}\b(atk|attack)\b/i.test(part);
      const affectsAttack = affectsAllStats || /\b(atk|attack|damage)\b/i.test(part);
      const affectsDefense = affectsAllStats || /\b(def|defense)\b/i.test(part);

      if (affectsAttack) effects.attackPct += amount;
      if (affectsDefense) effects.defensePct += amount;
    }

    return effects;
  }

  function renderClassAffectedStats(attack, defense) {
    if (classPassiveState.loading) {
      return `
        <div class="tm-stat-class-effects">
          ${makeRow('Raw/Lv ATK', 'Loading...', 'class passive only')}
          ${makeRow('Raw/Lv DEF', 'Loading...', 'class passive only')}
        </div>
      `;
    }

    if (classPassiveState.error) {
      return `
        <div class="tm-stat-class-effects">
          ${makeRow('Raw/Lv Stats', 'Unknown', 'class passive unavailable')}
        </div>
      `;
    }

    const effects = getClassStatEffects(classPassiveState.passive);
    const changed = Math.abs(effects.attackPct) > 0 || Math.abs(effects.defensePct) > 0;
    if (!changed) {
      return `
        <div class="tm-stat-class-effects">
          ${makeRow('Raw/Lv Stats', 'No changes', classPassiveState.className ? `${classPassiveState.className} passive only` : 'class passive only')}
        </div>
      `;
    }

    const affectedAttack = Math.round(attack * (1 + effects.attackPct));
    const affectedDefense = Math.round(defense * (1 + effects.defensePct));
    const atkNote = effects.attackPct ? `${effects.attackPct > 0 ? '+' : ''}${(effects.attackPct * 100).toFixed(2)}%` : 'unchanged';
    const defNote = effects.defensePct ? `${effects.defensePct > 0 ? '+' : ''}${(effects.defensePct * 100).toFixed(2)}%` : 'unchanged';

    return `
      <div class="tm-stat-class-effects">
        ${makeRow('Raw/Lv ATK', fmt.format(affectedAttack), `${atkNote}; gear/pets not included`)}
        ${makeRow('Raw/Lv DEF', fmt.format(affectedDefense), `${defNote}; gear/pets not included`)}
      </div>
    `;
  }

  async function hydrateClassPassive() {
    try {
      const data = await fetchClassPassive();
      classPassiveState = {
        loading: false,
        className: data.className || '',
        passive: data.passive || '',
        error: ''
      };
    } catch (error) {
      classPassiveState = {
        loading: false,
        className: '',
        passive: '',
        error: String(error?.message || error || 'Failed')
      };
    }
    render();
  }

  async function fetchPetLinkDetails(pet) {
    if (!pet?.id) return null;

    const url = new URL('/pet_links_ajax.php', window.location.origin);
    url.searchParams.set('pet_inv_id', String(pet.id));

    const response = await fetch(url.toString(), { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) return null;

    const data = await response.json().catch(() => null);
    if (!data || data.status !== 'success') return null;

    return data;
  }

  async function hydratePetLinkDetails(totals) {
    const details = Array.isArray(totals?.details) ? totals.details : [];
    if (!details.length) return;

    await Promise.all(details.map(async (pet) => {
      let data = null;
      try {
        data = await fetchPetLinkDetails(pet);
      } catch (e) {
        data = null;
      }
      if (!data) return;

      const linkedPet = data.pet || {};
      const updatedAttack = Number(linkedPet.updated_attack);
      const updatedDefense = Number(linkedPet.updated_defense);
      if (Number.isFinite(updatedAttack) && Number.isFinite(updatedDefense)) {
        totals.attack += updatedAttack - pet.attack;
        totals.defense += updatedDefense - pet.defense;
        pet.attack = updatedAttack;
        pet.defense = updatedDefense;
      }

      const totalEffect = cleanPetLinkAbilityText(linkedPet.total_effect_text);
      if (totalEffect) pet.ability = totalEffect;

      pet.links = Array.isArray(data.links)
        ? data.links.map((link) => ({
          level: parseNumberText(link.link_level),
          name: String(link.name || link.pet_name || link.link_pet_name || `Linked Pet #${link.link_pet_id || ''}`).trim(),
          ability: cleanPetLinkAbilityText(link.effect_text)
        })).filter((link) => link.name || link.ability)
        : [];
    }));

    totals.linkedCount = details.reduce((sum, pet) => sum + (Array.isArray(pet.links) ? pet.links.length : 0), 0);
    totals.count = Number(totals.mainCount || details.length) + totals.linkedCount;
    totals.total = totals.attack + totals.defense;
  }

  function renderPetAbilities(pets) {
    const details = Array.isArray(pets?.details) ? pets.details : [];
    if (!details.length) return '';

    return `
      <hr>
      <div class="tm-stat-pet-abilities">
        ${details.map((pet) => `
          <div class="tm-stat-pet-ability">
            <b>${escapeHtml(pet.name || 'Pet')}</b>
            <p>${escapeHtml(cleanPetLinkAbilityText(pet.ability) || 'No ability text found.')}</p>
            ${Array.isArray(pet.links) && pet.links.length ? `
              <div class="tm-stat-pet-links">
                ${pet.links.map((link) => `
                  <div class="tm-stat-pet-link">
                    <span>Link ${escapeHtml(link.level || '?')}:</span>
                    ${escapeHtml(link.name || 'Linked pet')} - ${escapeHtml(cleanPetLinkAbilityText(link.ability) || 'No ability text found.')}
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderSetCard(set, state) {
    const card = document.getElementById(`tmStatSetCard-${set.key}`);
    if (!card) return;

    if (state?.error) {
      card.innerHTML = `
        <h3>${set.title}</h3>
        <div class="tm-stat-set-note">${set.note}</div>
        <div class="value">Unable to load</div>
        ${makeRow('Status', 'Retry on refresh', state.error)}
      `;
      return;
    }

    if (!state) {
      card.innerHTML = `
        <h3>${set.title}</h3>
        <div class="tm-stat-set-note">${set.note}</div>
        <div class="value">Loading...</div>
      `;
      return;
    }

    const equipment = state.equipment || { attack: 0, defense: 0, total: 0, count: 0 };
    const pets = state.pets || { attack: 0, defense: 0, total: 0, count: 0 };
    const combined = mergeTotals(equipment, pets);

    card.innerHTML = `
      <h3>${set.title}</h3>
      <div class="tm-stat-set-note">${set.note}</div>
      <div class="value">${fmt.format(combined.total)}</div>
      ${makeRow('Total ATK', fmt.format(combined.attack), pct(combined.attack, combined.total))}
      ${makeRow('Total DEF', fmt.format(combined.defense), pct(combined.defense, combined.total))}
      <hr>
      ${makeRow('Equipment ATK', fmt.format(equipment.attack), pct(equipment.attack, combined.total))}
      ${makeRow('Equipment DEF', fmt.format(equipment.defense), pct(equipment.defense, combined.total))}
      ${makeRow('Pet ATK', fmt.format(pets.attack), pct(pets.attack, combined.total))}
      ${makeRow('Pet DEF', fmt.format(pets.defense), pct(pets.defense, combined.total))}
      <hr>
      ${makeRow('Equipped Count', fmt.format(combined.count), `${equipment.count} items + ${pets.mainCount || pets.count || 0} main pets + ${pets.linkedCount || 0} linked pets`)}
      ${renderPetAbilities(pets)}
    `;
  }

  async function hydrateSetCards() {
    await Promise.all(EQUIP_SETS.map(async (set) => {
      renderSetCard(set, null);
      try {
        const [equipment, pets] = await Promise.all([
          fetchSetTotals(set.key),
          fetchPetTotals(set.key)
        ]);
        renderSetCard(set, { equipment, pets });
      } catch (error) {
        renderSetCard(set, { error: String(error?.message || error || 'Failed') });
      }
    }));
  }

  function render() {
    const grid = document.querySelector('.grid');
    if (!grid) return false;

    ensureStyles();
    document.body.classList.add('tm-veyra-stats-page');

    let card = document.getElementById('tmStatBreakdownCard');
    if (!card) {
      card = document.createElement('div');
      card.id = 'tmStatBreakdownCard';
      card.className = 'card';
      grid.appendChild(card);
    }

    for (const set of EQUIP_SETS) {
      if (document.getElementById(`tmStatSetCard-${set.key}`)) continue;
      const setCard = document.createElement('div');
      setCard.id = `tmStatSetCard-${set.key}`;
      setCard.className = 'card tm-stat-set-card';
      grid.appendChild(setCard);
    }

    const attack = readNumber('v-attack');
    const defense = readNumber('v-defense');
    const stamina = readNumber('v-stamina');
    const total = attack + defense + stamina;
    const atkDef = attack + defense;

    card.innerHTML = `
      <h3>Stat Breakdown</h3>
      <div class="value">${fmt.format(total)}</div>
      ${makeRow('ATTACK', pct(attack, total), fmt.format(attack))}
      ${makeRow('DEFENSE', pct(defense, total), fmt.format(defense))}
      ${makeRow('STAMINA', pct(stamina, total), fmt.format(stamina))}
      <hr>
      ${makeRow('ATK + DEF / All', pct(atkDef, total), `${fmt.format(atkDef)} of ${fmt.format(total)}`)}
      ${renderClassAffectedStats(attack, defense)}
      ${renderClassPassive()}
    `;

    return true;
  }

  function init() {
    if (!render()) return;
    hydrateSetCards();
    hydrateClassPassive();

    const watched = ['v-attack', 'v-defense', 'v-stamina', 'v-points']
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    if (!watched.length) return;
    const observer = new MutationObserver(() => render());
    watched.forEach((el) => observer.observe(el, { childList: true, characterData: true, subtree: true }));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

// ---- Class passive in the top buff modal ----
(function(){
  'use strict';

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[ch]));
  }

  function cleanAbilityText(value) {
    return String(value || '')
      .replace(/^[^A-Za-z0-9%+.-]+/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function parseClassPassiveDocument(doc, html) {
    const scriptText = String(html || '');
    const configMatch = scriptText.match(/window\.SkillTreeConfig\s*=\s*\{([\s\S]*?)\n\};/);
    const configBody = configMatch ? configMatch[1] : '';
    const classNameMatch = configBody.match(/className\s*:\s*["']([^"']+)["']/);
    const passiveMatch = configBody.match(/classPassive\s*:\s*["']([\s\S]*?)["']\s*(?:,|\/\/|\n)/);

    const modalTitle = String(doc.querySelector('#passive-modal .modal-title')?.textContent || '').replace(/\s+Passive\s*$/i, '').trim();
    const modalPassive = String(doc.querySelector('#passive-body')?.textContent || '').replace(/\s+/g, ' ').trim();

    return {
      className: String(classNameMatch?.[1] || modalTitle || '').trim(),
      passive: cleanAbilityText(passiveMatch?.[1] || modalPassive || '')
    };
  }

  async function fetchClassPassive() {
    const url = new URL('/class_skill_tree.php', window.location.origin);
    const response = await fetch(url.toString(), { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return parseClassPassiveDocument(doc, html);
  }

  function getActiveBuffCount(list) {
    return Array.from(list.querySelectorAll('.buff-row'))
      .filter((row) => !/no active buffs/i.test(row.textContent || '') && row.id !== 'tmClassPassiveBuffRow')
      .length;
  }

  function syncBuffBadge(list) {
    const btn = document.getElementById('buffs_btn');
    if (!btn || !list) return;

    const count = getActiveBuffCount(list) + (document.getElementById('tmClassPassiveBuffRow') ? 1 : 0);
    let badge = btn.querySelector('.gtb-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'gtb-badge';
      btn.appendChild(badge);
    }
    badge.textContent = String(count);
    badge.style.display = count > 0 ? '' : 'none';
  }

  function injectClassBuff(data) {
    const list = document.getElementById('buffs_list');
    if (!list || !data?.passive) return;

    Array.from(list.querySelectorAll('.buff-row'))
      .filter((row) => /no active buffs/i.test(row.textContent || ''))
      .forEach((row) => row.remove());

    let row = document.getElementById('tmClassPassiveBuffRow');
    if (!row) {
      row = document.createElement('div');
      row.id = 'tmClassPassiveBuffRow';
      row.className = 'buff-row';
      list.prepend(row);
    }

    const title = data.className ? `${data.className} Passive` : 'Class Passive';
    row.innerHTML = `
      <div class="buff-ico">Class</div>
      <div class="buff-info">
        <div class="buff-name">${escapeHtml(title)}</div>
        <div class="buff-desc">${escapeHtml(data.passive)}</div>
      </div>
      <div class="buff-ends">always on</div>
    `;

    syncBuffBadge(list);
  }

  async function init() {
    const list = document.getElementById('buffs_list');
    if (!list) return;

    try {
      injectClassBuff(await fetchClassPassive());
    } catch (e) {
      // Keep the stock buff modal untouched if the class page cannot be loaded.
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

// ---- One-time update notification (shows once per version) ----
(function(){
  'use strict';

  const APP_VERSION = '0.3.23.15';
  const VERSION = '0.3.23';
  const LS_KEY = 'tm_veyrahud_seen_version_v1';

  const CHANGELOG = {
    '0.3.23': {
      date: '2026-06-03',
      changes: [
        'Olympus: replaces the Invade Olympus wave button with Shops, Hermes, and Artemis shortcuts.',
        'Olympus: adds a Shops landing panel on the Olympus map with quick buttons for the current shop NPCs.'
      ]
    },
    '0.3.22': {
      date: '2026-06-03',
      changes: [
        'Monster Board: hides the old D1/D2 dungeon map after the board reads the map locations, so the board becomes the main view.'
      ]
    },
    '0.3.21': {
      date: '2026-06-03',
      changes: [
        'Stats menu: added a Stat Breakdown card showing each stat percentage, total stats, and ATK+DEF / All percentage.'
      ]
    },
    '0.3.20': {
      date: '2026-06-02',
      changes: [
        'Monster Board: renamed the Shadowbridge board to Monster Board so it reads correctly across dungeon pages.',
        'Cube: added a standalone Monster Board view with sections for Merchant, PvE, Shadow Army, PvP, and Boss nodes.',
        'Cube Monster Board: node cards now expose linked node/location actions instead of leaving the IDs as plain text.',
        'Cube Monster Board: expanded the board, loads the visible view faster, and added PvE select/quick attack controls.',
        'Cube Monster Board: tightened the Cube layout, filtered PvP to the best open matches, and added section jump buttons.',
        'Cube Monster Board: added a PvP readiness/timer badge to the section jumper.',
        'Cube: bundled the intro skipper into the AIO so the intro stays dismissed after you have already seen it.'
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
        'Solo PvP bot no longer prints “Unsupported page…” even if something calls it outside PvP.'
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

  function semverGt(a, b){
    const pa = semverParts(a);
    const pb = semverParts(b);
    if (!pa || !pb) return false;
    for (let i = 0; i < 3; i++){
      if (pa[i] > pb[i]) return true;
      if (pa[i] < pb[i]) return false;
    }
    return false;
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
    sub.textContent = 'Now running v' + APP_VERSION;
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
// Module: Cube Intro Skipper (cube-intro-skipper.user.js)
// ============================================================

(function () {
  'use strict';

  const path = String(window.location.pathname || '');
  const IS_CUBE_PAGE = /\/guild_dungeon_(?:enter|cube)\.php$/i.test(path);
  if (!IS_CUBE_PAGE) return;

  const SETTING_KEY = 'tm_cube_auto_skip_intro_v3';
  const GLOBAL_SEEN_KEY = 'tm_cube_intro_seen_globally_v1';
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

  function markIntroSeenGlobally() {
    try {
      window.localStorage.setItem(GLOBAL_SEEN_KEY, '1');
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
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get('instance_id') || params.get('id');
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
    if (window.STATE && window.STATE.intro_seen === true) {
      markIntroSeenGlobally();
      return false;
    }
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
      markIntroSeenGlobally();
      window.sessionStorage.setItem(reloadFlag, '1');
      window.location.reload();
    } catch (_error) {
      // If the server endpoint fails, leave the normal cube intro alone.
    } finally {
      dismissing = false;
      syncStyles();
    }
  }

  function watchManualIntroDismissal() {
    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const text = String(target.textContent || target.getAttribute('aria-label') || '').trim();
      const id = String(target.id || '');
      if (
        id === 'briefContinue' ||
        /\b(?:continue|begin|enter|start|skip)\b/i.test(text)
      ) {
        window.setTimeout(() => {
          if (window.STATE?.intro_seen === true || !introNeedsDismissal()) markIntroSeenGlobally();
        }, 750);
      }
    }, true);
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
  watchManualIntroDismissal();
  runSkipper();

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
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
    dropsSeedVersion: 'tm_emberfall_drops_seed_version_v1',
    panelOpen: 'tm_emberfall_panel_open_v1'
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
    ensureHudButton();

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

    const anchor = findWaveDescriptionAnchor();

    if (!anchor || !anchor.parentElement) return;

    let wrap = document.getElementById('tmEmberfallHelperInlineWrap');
    if (!wrap) {
      wrap = document.createElement('div');
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
    }

    let inner = document.getElementById('tmEmberfallHelperInline');
    if (!inner) {
      inner = document.createElement('div');
      inner.id = 'tmEmberfallHelperInline';
      wrap.appendChild(inner);
    } else if (inner.parentElement !== wrap) {
      wrap.appendChild(inner);
    }

    anchor.parentElement.insertBefore(wrap, anchor.nextSibling);
  }

  function findWaveDescriptionAnchor() {
    const waveTitle = document.querySelector('.wave-title');
    if (waveTitle?.parentElement) return waveTitle;
    return null;
  }

  function maybeCaptureDropsFromBattle() {
    const payload = parseLootFromBattlePage();
    if (!payload) return;
    if (upsertDrops(payload)) {
      setStatus(`Captured drops for ${payload.mobName} (${payload.items.length} items).`);
    }
  }

  function scheduleInlineQuestSummary() {
    if (!isEmberfallActiveWavePage()) return;

    let tries = 0;
    const run = () => {
      tries += 1;
      ensureInlineQuestSummary();
      refresh();
      if (!document.getElementById('tmEmberfallHelperInlineWrap') && tries < 25) {
        window.setTimeout(run, 200);
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run, { once: true });
      window.setTimeout(run, 300);
    } else {
      run();
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

  // Keep the "Quest Journal" box directly under the Emberfall wave title/description.
  scheduleInlineQuestSummary();

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
  const LOOT_CONCURRENCY = 20;
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
    const candidates = Array.from(document.querySelectorAll('button, a, input[type="button"], input[type="submit"]'));
    for (const el of candidates) {
      if (!(el instanceof HTMLElement)) continue;
      const cs = window.getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || el.offsetParent === null) continue;
      const text = normName(el.value || el.textContent || '');
      if (/\bShow Alive monsters\b/i.test(text)) return true;
      if (/\bShow unclaimed kills\b/i.test(text)) return false;
    }
    return false;
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

  function hideNativeLootLine() {
    for (const el of Array.from(document.querySelectorAll('.bl-lootline'))) {
      if (el instanceof HTMLElement) el.style.display = 'none';
    }
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
    if (!document.body) return;

    const anchor =
      document.getElementById('waveQolPanel') ||
      document.querySelector('.wave-title');

    if (!anchor || !anchor.parentElement) return;

    let wrap = document.getElementById('tmWaveSizeControls');
    if (!wrap) {
      wrap = document.createElement('div');
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
    }

    const desiredNext = anchor.nextSibling;
    if (wrap.parentElement !== anchor.parentElement || wrap.previousElementSibling !== anchor) {
      anchor.parentElement.insertBefore(wrap, desiredNext);
    }

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
    const hide = isDeadLootViewActive();
    panel.classList.toggle('tm-waveqol-hidden', hide);
    if (!hide && panel.style.display === 'none') panel.style.display = '';
  }

  function enforceWaveTopbarFlush() {
    const topbar = document.querySelector('.game-topbar');
    if (!(topbar instanceof HTMLElement) || !document.body) return;

    const setImportant = (el, prop, value) => {
      if (el.style.getPropertyValue(prop) === value && el.style.getPropertyPriority(prop) === 'important') return;
      el.style.setProperty(prop, value, 'important');
    };

    setImportant(document.documentElement, 'margin-top', '0px');
    setImportant(document.body, 'margin-top', '0px');
    setImportant(document.body, 'padding-block-start', '0px');

    setImportant(topbar, 'position', 'fixed');
    setImportant(topbar, 'top', '0px');
    setImportant(topbar, 'left', '0px');
    setImportant(topbar, 'right', '0px');
    setImportant(topbar, 'margin-top', '0px');

    const height = Math.ceil(topbar.getBoundingClientRect().height || 74);
    if (height > 0) {
      const lastHeight = Number(document.body.dataset.tmVeyraTopbarHeight || 0);
      if (Math.abs(height - lastHeight) > 2) {
        document.body.dataset.tmVeyraTopbarHeight = String(height);
        setImportant(document.body, 'padding-top', `${height}px`);
      }
    }
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

      html:has(body .game-topbar),
      body:has(.game-topbar),
      html.tm-veyra-wave-page,
      html.tm-veyra-wave-page body{
        margin-top: 0 !important;
      }
      body:has(.game-topbar) .game-topbar,
      html.tm-veyra-wave-page .game-topbar{
        top: 0 !important;
        margin-top: 0 !important;
      }
      body:has(.game-topbar) .side-drawer,
      body:has(.game-topbar) .page-overlay,
      html.tm-veyra-wave-page .side-drawer,
      html.tm-veyra-wave-page .page-overlay{
        top: 0 !important;
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
    let done = 0;
    let firstFail = '';
    let totalExp = 0;
    let totalGold = 0;
    const allItems = [];
    const allNotes = [];

    setStatus(`Looting ${targetIds.length} selected dead monsters... (${Math.min(LOOT_CONCURRENCY, targetIds.length)} at a time)`);

    try {
      await runWithConcurrency(targetIds, LOOT_CONCURRENCY, async (targetId) => {
        try {
          const r = await lootOne(targetId);
          if (r.ok) {
            ok++;
            totalExp += Number(r.exp || 0) || 0;
            totalGold += Number(r.gold || 0) || 0;
            if (Array.isArray(r.items) && r.items.length) allItems.push(...r.items);
            else allNotes.push(r.message || 'Looted (no items)');
            const el = document.querySelector(`.monster-card[data-monster-id="${targetId}"]`);
            if (el) el.setAttribute('data-eligible', '0');
            const cb = document.querySelector(`input.tm-loot-select[data-monster-id="${targetId}"]`);
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
        } finally {
          done++;
          setStatus(`Looting ${done}/${targetIds.length}... (success: ${ok}, fail: ${fail})`);
        }
      });
    } finally {
      for (const b of disable) b.disabled = false;
    }

    updateSelectedCount();
    setStatus(`Done. Looted ${ok}, failed ${fail}.${firstFail ? ` First fail: ${firstFail}` : ''}`);
    openLootModal(
      { processed: targetIds.length, success: ok, fail, exp: totalExp, gold: totalGold },
      allItems,
      allNotes
    );
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
      hideNativeLootLine();
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
  try { document.documentElement.classList.add('tm-veyra-wave-page'); } catch {}

  // Always install styles + observers so the UI works even if dead cards render later (page 1 often loads them after toggles).
  ensureStyles();
  enforceWaveTopbarFlush();
  applyCardSizeFromStorage();
  syncWaveSizeControls();
  syncNativeWaveQolPanel();
  hideNativeLootLine();

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
    hideNativeLootLine();
    enforceWaveTopbarFlush();
  }, 300);

  window.setInterval(() => {
    syncWaveSizeControls();
    syncNativeWaveQolPanel();
    hideNativeLootLine();
    enforceWaveTopbarFlush();
  }, 750);

  wireObservers();
})();


// ---- Olympus wave shortcuts ----
(function(){
  'use strict';

  const path = String(window.location.pathname || '').toLowerCase();
  const isWavePage = /\/active_wave\.php$/i.test(path);
  const isOlympusMap = /\/olympus\.php$/i.test(path);
  if (!isWavePage && !isOlympusMap) return;

  const params = new URLSearchParams(window.location.search || '');
  const waveId = String(params.get('wave') || '');
  const isOlympusPage =
    isOlympusMap ||
    params.get('gate') === '5' ||
    /olympus/i.test(String(document.title || ''));
  if (!isOlympusPage) return;

  const SHOP_NPCS = [
    { npc: 'damon', label: 'Damon', note: 'Potions' },
    { npc: 'melanippe', label: 'Melanippe', note: 'Stable' },
    { npc: 'brontes', label: 'Brontes', note: 'Forge' },
    { npc: 'melinoe', label: 'Melinoe', note: 'Eggs' }
  ];

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[ch]));
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(String(value));
    return String(value).replace(/["\\]/g, '\\$&');
  }

  function ensureStyles() {
    if (document.getElementById('tmOlympusShortcutsStyles')) return;
    const style = document.createElement('style');
    style.id = 'tmOlympusShortcutsStyles';
    style.textContent = `
      .tm-olympus-shop-panel{
        margin:14px auto;
        width:min(980px, calc(100vw - 24px));
        box-sizing:border-box;
        border:1px solid rgba(255,255,255,.12);
        border-radius:12px;
        background:rgba(16,18,29,.92);
        color:#e8ebff;
        padding:12px;
        box-shadow:0 14px 34px rgba(0,0,0,.24);
      }
      .tm-olympus-shop-panel h3{
        margin:0 0 9px;
        font-size:15px;
        color:#ffd369;
      }
      .tm-olympus-shop-actions{
        display:flex;
        gap:9px;
        flex-wrap:wrap;
      }
      .tm-olympus-shop-actions button{
        cursor:pointer;
        border:1px solid rgba(255,255,255,.14);
        border-radius:10px;
        background:rgba(255,255,255,.08);
        color:#fff;
        padding:8px 10px;
        font-weight:800;
      }
      .tm-olympus-shop-actions button small{
        display:block;
        color:#aeb5d2;
        font-size:11px;
        font-weight:600;
      }
      .tm-olympus-shop-actions button:disabled{
        cursor:not-allowed;
        opacity:.45;
      }
      @media(max-width:620px){
        .tm-olympus-shop-panel{
          width:calc(100vw - 16px);
          margin:10px auto;
          border-radius:10px;
        }
        .tm-olympus-shop-actions button{
          flex:1 1 135px;
        }
      }
      .waves-nav .tm-olympus-map-chip{
        margin-left:auto;
        opacity:.72;
      }
      .waves-nav .tm-olympus-map-chip:hover,
      .waves-nav .tm-olympus-map-chip.active{
        opacity:1;
      }
      @media(max-width:620px){
        .waves-nav .tm-olympus-map-chip{
          margin-left:0;
          flex-basis:100%;
          text-align:center;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function makeChip(label, href, active, extraClass) {
    const chip = document.createElement('a');
    chip.className = `wave-chip tm-olympus-chip${extraClass ? ` ${extraClass}` : ''}${active ? ' active' : ''}`;
    chip.href = href;
    chip.textContent = label;
    chip.dataset.tmOlympusShortcut = '1';
    return chip;
  }

  function replaceInvadeChip() {
    const nav = document.querySelector('.waves-nav');
    if (!nav || nav.dataset.tmOlympusShortcuts === '1') return;

    const invade = Array.from(nav.querySelectorAll('a.wave-chip')).find((link) => {
      const text = String(link.textContent || '').trim();
      const href = String(link.getAttribute('href') || '');
      return /invade\s+olympus/i.test(text) || /(^|\/)olympus\.php(?:$|[?#])/i.test(href);
    });
    if (!invade) return;

    const shops = makeChip('Shops', 'merchant.php', /\/merchant\.php$/i.test(path));
    const hermes = makeChip('Hermes', 'active_wave.php?gate=5&wave=10', waveId === '10');
    const artemis = makeChip('Artemis', 'active_wave.php?gate=5&wave=11', waveId === '11');
    const map = makeChip('Invade Olympus', 'olympus.php', isOlympusMap, 'tm-olympus-map-chip');

    invade.replaceWith(shops, hermes, artemis, map);
    nav.dataset.tmOlympusShortcuts = '1';
  }

  function findShopPanelAnchor() {
    return (
      document.querySelector('.olympus-shell') ||
      document.querySelector('main') ||
      document.querySelector('.container') ||
      document.body
    );
  }

  function ensureShopPanel() {
    if (!isOlympusMap || !/^#(?:tm-)?shops$/i.test(window.location.hash || '') || document.getElementById('tmOlympusShopPanel')) return;

    const panel = document.createElement('section');
    panel.id = 'tmOlympusShopPanel';
    panel.className = 'tm-olympus-shop-panel';
    panel.innerHTML = `
      <h3>Olympus Shops</h3>
      <div class="tm-olympus-shop-actions">
        ${SHOP_NPCS.map((shop) => {
          const marker = document.querySelector(`.npc-marker[data-npc="${cssEscape(shop.npc)}"]`);
          return `
            <button type="button" data-npc-target="${escapeHtml(shop.npc)}"${marker ? '' : ' disabled'}>
              ${escapeHtml(shop.label)}
              <small>${escapeHtml(marker ? shop.note : 'Not available')}</small>
            </button>
          `;
        }).join('')}
      </div>
    `;

    panel.addEventListener('click', (event) => {
      const btn = event.target instanceof Element ? event.target.closest('button[data-npc-target]') : null;
      if (!btn || btn.disabled) return;
      const npc = btn.getAttribute('data-npc-target');
      const marker = npc ? document.querySelector(`.npc-marker[data-npc="${cssEscape(npc)}"]`) : null;
      if (marker instanceof HTMLElement) marker.click();
    });

    const anchor = findShopPanelAnchor();
    if (anchor === document.body) document.body.prepend(panel);
    else anchor.prepend(panel);

    if (/^#(?:tm-)?shops$/i.test(window.location.hash || '')) {
      window.setTimeout(() => {
        try { panel.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
        catch (e) { panel.scrollIntoView(); }
      }, 120);
    }
  }

  function init() {
    ensureStyles();
    replaceInvadeChip();
    ensureShopPanel();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  window.setTimeout(init, 400);
})();


// ============================================================
// Module: Shadowbridge Warrens Monster Board (shadowbridge-warrens-monsters.user.js)
// ============================================================

(function () {
  'use strict';

  const DUNGEON_NAME = 'Shadowbridge Warrens';
  const BOARD_TITLE = 'Monster Board';
  const PANEL_ID = 'tm-shadowbridge-monster-board';
  const STYLE_ID = 'tm-shadowbridge-monster-board-style';
  const QUOTA_STORAGE_KEY = 'tm_shadowbridge_daily_rule_usage_v2';
  const DAMAGE_MODEL_KEY = 'tm_shadowbridge_damage_model_v1';
  const DAMAGE_CACHE_KEY = 'tm_shadowbridge_damage_cache_v1';
  const CARD_SIZE_KEY = 'tm_monster_card_size_v1';
  const CARD_SIZE_LEGACY_KEYS = ['tm_sbw_card_size_v1', 'tm_graveyard_card_size_v1'];
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
  let cubeStateOverride = null;
  let cubeFaceDataOverride = null;
  const cubeNodeBoardCache = new Map();
  let cubeBoardRenderSeq = 0;
  const cubeSelectedMonsterIds = new Set();
  let cubeMonsterById = new Map();
  let cubeJumpStatusTimer = 0;
  let cubeJumpStatusGroups = [];
  let cubeJumpStatusBoards = new Map();

  startDungeonPrehide();

  function startOnce() {
    if (started) return;
    if (!isMainDungeonPage()) return;
    started = true;

    if (mo) {
      try { mo.disconnect(); } catch {}
      mo = null;
    }

    injectStyles();
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

  function startDungeonPrehide() {
    if (isCubePath()) return;

    injectPrehideStyles();

    const apply = () => {
      const mapPanels = Array.from(document.querySelectorAll('.mapframe'))
        .map((mapframe) => mapframe.closest('.panel'))
        .filter((panel) => panel && panel.querySelector('a.pin[href*="guild_dungeon_location.php"]'));

      for (const panel of mapPanels) {
        panel.classList.add('tm-sbw-hidden-map-panel', 'tm-sbw-prehidden-map-panel');
        panel.setAttribute('aria-hidden', 'true');

        const previous = panel.previousElementSibling;
        if (isDungeonOverviewPanel(previous)) {
          previous.classList.add('tm-sbw-hidden-dungeon-overview', 'tm-sbw-prehidden-dungeon-overview');
          previous.setAttribute('aria-hidden', 'true');
        }
      }

      for (const panel of Array.from(document.querySelectorAll('.panel'))) {
        if (isDungeonOverviewPanel(panel)) {
          panel.classList.add('tm-sbw-hidden-dungeon-overview', 'tm-sbw-prehidden-dungeon-overview');
          panel.setAttribute('aria-hidden', 'true');
        }
      }
    };

    apply();
    const prehideObserver = new MutationObserver(apply);
    prehideObserver.observe(document.documentElement, { childList: true, subtree: true });
    window.setTimeout(() => {
      try { prehideObserver.disconnect(); } catch {}
    }, 12000);
  }

  function injectPrehideStyles() {
    const id = `${STYLE_ID}-prehide`;
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      .tm-sbw-prehidden-map-panel,
      .tm-sbw-prehidden-dungeon-overview{
        display:none !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function isDungeonOverviewPanel(panel) {
    if (!(panel instanceof HTMLElement) || panel.id === PANEL_ID) return false;
    const tags = Array.from(panel.querySelectorAll('.tag')).map((tag) => cleanText(tag.textContent));
    return tags.some((text) => /^Locations:/i.test(text))
      && tags.some((text) => /^Monsters:/i.test(text))
      && tags.some((text) => /^Left:/i.test(text));
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

  function isMainDungeonPage() {
    if (isCubePage()) return true;

    const title = (document.title || '').toLowerCase();
    const hasTitle = title.includes(DUNGEON_NAME.toLowerCase());

    const hasMap = !!document.querySelector('.mapwrap, .mapframe');
    const pinCount = Array.from(document.querySelectorAll('a.pin[href*=\"guild_dungeon_location.php\"]')).length;

    // Primary signal: map+pins exist.
    if (hasMap && pinCount > 0) return true;

    // Fallback signal: title matches and pins exist (some layouts omit .mapwrap/.mapframe classes).
    if (hasTitle && pinCount > 0) return true;

    return false;
  }

  async function init() {
    if (isCubePage()) {
      await initCubeBoard();
      return;
    }

    const mapPanel = document.querySelector('.mapframe')?.closest('.panel');
    const mapWrap = document.querySelector('.mapwrap');
    const pins = Array.from(document.querySelectorAll('a.pin[href*="guild_dungeon_location.php"]'))
      .filter((pin) => !pin.classList.contains('locked'));

    if (!mapPanel || !mapWrap || pins.length === 0) {
      throw new Error('Could not find the dungeon map or location pins.');
    }

    const board = createBoardShell(pins.length);
    board.classList.toggle('tm-sbw-minimal-controls', isDungeonTwoPage());
    mapPanel.insertAdjacentElement('afterend', board);

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
    hideDungeonOverviewPanel(mapPanel);
    hideDungeonMapPanel(mapPanel);
  }

  function hideDungeonOverviewPanel(mapPanel) {
    if (isCubePage()) return;
    const candidates = [
      mapPanel?.previousElementSibling,
      ...Array.from(document.querySelectorAll('.panel'))
    ].filter(Boolean);

    const overviewPanel = candidates.find((panel) => isDungeonOverviewPanel(panel));

    if (!overviewPanel) return;
    overviewPanel.classList.add('tm-sbw-hidden-dungeon-overview');
    overviewPanel.setAttribute('aria-hidden', 'true');
  }

  function hideDungeonMapPanel(mapPanel) {
    if (!mapPanel || isCubePage()) return;
    mapPanel.classList.add('tm-sbw-hidden-map-panel');
    mapPanel.setAttribute('aria-hidden', 'true');
  }

  function isCubePage() {
    if (isCubePath() && (!!document.getElementById('nodeTableView') || !!getCubeState()?.nodes)) return true;
    return false;
  }

  function isCubePath() {
    const path = String(window.location.pathname || '').toLowerCase();
    return path.includes('guild_dungeon_cube.php');
  }

  function isDungeonTwoPage() {
    const idFromUrl = new URLSearchParams(window.location.search).get('id')
      || new URLSearchParams(window.location.search).get('dungeon_id');
    if (String(idFromUrl || '') === '2') return true;

    const infoLink = Array.from(document.querySelectorAll('a[href*="dungeon_info.php"]')).find((link) => {
      try {
        return new URL(link.getAttribute('href') || '', window.location.origin).searchParams.get('id') === '2';
      } catch (_error) {
        return false;
      }
    });
    return !!infoLink;
  }

  async function initCubeBoard() {
    const tableView = document.getElementById('nodeTableView');
    const stage = document.querySelector('.stage') || tableView?.parentElement;
    if (!tableView || !stage) {
      throw new Error('Could not find the cube view container.');
    }

    let board = document.getElementById(PANEL_ID);
    if (!board) {
      board = createCubeBoardShell();
      board.classList.add('tm-sbw-minimal-controls');
      tableView.insertAdjacentElement('afterend', board);
    } else if (board.parentElement !== stage) {
      board.classList.add('tm-sbw-minimal-controls');
      tableView.insertAdjacentElement('afterend', board);
    } else {
      board.classList.add('tm-sbw-minimal-controls');
    }

    const render = () => loadAndRenderCubeBoard(board).catch((error) => {
      console.error('[TM Shadowbridge]', error);
      board.innerHTML = `<div class="h">${BOARD_TITLE}</div><div class="tm-sbw-error">${escapeHtml(error.message || error)}</div>`;
    });

    await waitForCubeNodes();
    await render();
    setupCubeBoardView(stage, board);
  }

  async function waitForCubeNodes() {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      if (getCubeNodes().length > 0) return true;
      await delay(200);
    }
    return false;
  }

  function setupCubeBoardView(stage, board) {
    const button = document.getElementById('viewModeBtn');
    const storageKey = 'tm_cube_view_mode_v1';
    const modes = ['cube', 'table', 'board'];
    const labelForMode = (mode) => {
      if (mode === 'table') return 'Monster Board';
      if (mode === 'board') return 'Cube View';
      return 'Table View';
    };
    const normalizeMode = (mode) => modes.includes(mode) ? mode : (stage.classList.contains('table-mode') ? 'table' : 'cube');
    let currentMode = normalizeMode(sessionStorage.getItem(storageKey) || '');

    const applyMode = (mode) => {
      currentMode = normalizeMode(mode);
      try { sessionStorage.setItem(storageKey, currentMode); } catch {}
      stage.classList.toggle('table-mode', currentMode === 'table');
      stage.classList.toggle('tm-sbw-board-mode', currentMode === 'board');
      document.body?.classList.toggle('tm-sbw-cube-board-active', currentMode === 'board');
      if (board) board.setAttribute('aria-hidden', currentMode === 'board' ? 'false' : 'true');
      if (button) {
        button.disabled = false;
        button.textContent = labelForMode(currentMode);
      }
    };

    applyMode(currentMode);

      if (button && !button.dataset.tmSbwBoardToggle) {
      button.dataset.tmSbwBoardToggle = '1';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        const nextMode = currentMode === 'cube' ? 'table' : currentMode === 'table' ? 'board' : 'cube';
        applyMode(nextMode);
      }, true);
    }

    board.addEventListener('click', async (event) => {
      const selectPveButton = event.target.closest('[data-role="cube-select-pve"]');
      if (selectPveButton) {
        event.preventDefault();
        Array.from(cubeMonsterById.values()).forEach((monster) => {
          if (!monster.dead && monster.dgmid && monster.instanceId) cubeSelectedMonsterIds.add(monster.id);
        });
        syncCubePveControls(board);
        return;
      }

      const clearPveButton = event.target.closest('[data-role="cube-clear-pve"]');
      if (clearPveButton) {
        event.preventDefault();
        cubeSelectedMonsterIds.clear();
        syncCubePveControls(board);
        return;
      }

      const quickAttackButton = event.target.closest('[data-role="cube-quick-attack"]');
      if (quickAttackButton) {
        event.preventDefault();
        await runCubeQuickAttack(board, quickAttackButton);
        return;
      }

      const armyButton = event.target.closest('[data-enter-army-match]');
      if (armyButton) {
        event.preventDefault();
        const node = getCubeNodes().find((item) => String(item.id) === String(armyButton.dataset.nodeId));
        if (!node) return;
        const matchNo = Number(armyButton.dataset.enterArmyMatch || 0);
        if (!matchNo) return;
        const originalText = armyButton.textContent;
        armyButton.disabled = true;
        armyButton.textContent = 'Opening...';
        try {
          const data = await postCubeArmyAction('enter_fight', {
            instance_id: getCubeInstanceId(),
            node_id: node.id,
            match_no: matchNo
          });
          if (data.redirect) {
            window.location.href = data.redirect;
            return;
          }
          showCubeBoardMessage(board, data.message || 'Army fight updated.');
          cubeNodeBoardCache.clear();
          await loadAndRenderCubeBoard(board);
        } catch (error) {
          showCubeBoardMessage(board, error.message || 'Could not open that army fight.');
        } finally {
          armyButton.disabled = false;
          armyButton.textContent = originalText;
        }
        return;
      }

      const pvpSlotButton = event.target.closest('[data-pvp-join-slot]');
      if (pvpSlotButton) {
        event.preventDefault();
        const node = getCubeNodes().find((item) => String(item.id) === String(pvpSlotButton.dataset.nodeId));
        if (!node) return;
        const matchNo = Number(pvpSlotButton.dataset.matchNo || 0);
        const slotIndex = Number(pvpSlotButton.dataset.pvpJoinSlot || 0);
        if (!matchNo || !slotIndex) return;
        const originalText = pvpSlotButton.textContent;
        pvpSlotButton.disabled = true;
        pvpSlotButton.textContent = 'Joining...';
        try {
          const data = await postPvpStyleAction('pick_slot', {
            source: 'cube',
            instance_id: getCubeInstanceId(),
            node_id: node.id,
            match_no: matchNo,
            slot_index: slotIndex
          });
          showCubeBoardMessage(board, data.message || `Joined slot #${slotIndex}.`);
          cubeNodeBoardCache.clear();
          await loadAndRenderCubeBoard(board);
        } catch (error) {
          showCubeBoardMessage(board, error.message || 'Could not join that PvP slot.');
        } finally {
          pvpSlotButton.disabled = false;
          pvpSlotButton.textContent = originalText;
        }
        return;
      }

      const enterButton = event.target.closest('[data-enter-node]');
      if (!enterButton) return;
      event.preventDefault();
      const node = getCubeNodes().find((item) => String(item.id) === String(enterButton.dataset.enterNode));
      if (!node || !canEnterCubeNode(node)) return;
      const originalText = enterButton.textContent;
      enterButton.disabled = true;
      enterButton.textContent = 'Entering...';
      try {
        const data = await postCubeAction('enter_node', { node_id: node.id, face_key: node.face_key });
        if (data.redirect) {
          window.location.href = data.redirect;
          return;
        }
        if (data.message) {
          showCubeBoardMessage(board, data.message);
        }
        if (data.state) {
          cubeStateOverride = data.state;
          try { window.STATE = data.state; } catch {}
          await loadAndRenderCubeBoard(board);
        }
      } catch (error) {
        showCubeBoardMessage(board, error.message || 'Action failed.');
      } finally {
        enterButton.disabled = false;
        enterButton.textContent = originalText;
      }
    });

    board.addEventListener('change', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || !target.classList.contains('tm-sbw-cube-monster-check')) {
        return;
      }
      if (target.checked) cubeSelectedMonsterIds.add(target.value);
      else cubeSelectedMonsterIds.delete(target.value);
      syncCubePveControls(board);
    });
  }

  function getSelectedCubeMonsters() {
    return Array.from(cubeSelectedMonsterIds)
      .map((id) => cubeMonsterById.get(id))
      .filter((monster) => monster && !monster.dead && monster.dgmid && monster.instanceId);
  }

  function syncCubePveControls(board) {
    const controls = board.querySelector('[data-role="cube-pve-controls"]');
    const selectedCount = board.querySelector('[data-role="cube-selected-count"]');
    const attackButtons = board.querySelectorAll('[data-role="cube-quick-attack"]');
    const availableMonsters = Array.from(cubeMonsterById.values()).filter((monster) => !monster.dead && monster.dgmid && monster.instanceId);
    const selected = getSelectedCubeMonsters();
    if (controls) controls.style.display = availableMonsters.length ? '' : 'none';
    if (selectedCount) selectedCount.textContent = `Selected: ${selected.length}`;
    attackButtons.forEach((button) => {
      button.disabled = !selected.length || Boolean(button.dataset.busy);
    });
    board.querySelectorAll('.tm-sbw-cube-monster-check').forEach((checkbox) => {
      if (checkbox instanceof HTMLInputElement) checkbox.checked = cubeSelectedMonsterIds.has(checkbox.value);
    });
  }

  async function runCubeQuickAttack(board, button) {
    const selected = getSelectedCubeMonsters();
    const runLine = board.querySelector('[data-role="cube-attack-line"]');
    if (!selected.length) {
      if (runLine) runLine.textContent = 'Pick at least one Cube PvE monster first.';
      return;
    }

    const skillId = button.dataset.skillId || '0';
    const staminaCost = button.dataset.stam || '1';
    const buttons = board.querySelectorAll('[data-role="cube-quick-attack"]');
    buttons.forEach((item) => {
      item.dataset.busy = '1';
      item.disabled = true;
    });
    if (runLine) runLine.textContent = `Attacking ${selected.length} selected Cube PvE monster(s)...`;

    const results = [];
    let done = 0;
    try {
      await runWithConcurrency(selected, 4, async (monster) => {
        try {
          const result = await quickJoinAndAttack(monster, skillId, staminaCost);
          results.push(result);
        } catch (error) {
          results.push({ ok: false, messageText: error.message || 'Attack failed.' });
        }
        done += 1;
        if (runLine) runLine.textContent = `Attacked ${done}/${selected.length} Cube PvE monster(s)...`;
      });
      const okCount = results.filter((result) => result?.ok).length;
      if (runLine) runLine.textContent = `Quick attack finished: ${okCount}/${selected.length} succeeded.`;
      cubeSelectedMonsterIds.clear();
      await loadAndRenderCubeBoard(board);
    } catch (error) {
      if (runLine) runLine.textContent = error.message || 'Quick attack failed.';
    } finally {
      buttons.forEach((item) => {
        delete item.dataset.busy;
      });
      syncCubePveControls(board);
    }
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
          <div class="h">${BOARD_TITLE}</div>
          <div class="tm-sbw-sub">Loading monsters from ${locationCount} map locations...</div>
        </div>
        <button type="button" class="btn tm-sbw-refresh">Refresh</button>
      </div>
      <div class="tm-sbw-summary"></div>
      <div class="tm-sbw-qol">
        <div class="qol-top">
          <div class="qol-filters">
            <span class="qol-title">Monster Board Targets</span>

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

    return board;
  }

  function createCubeBoardShell() {
    const board = document.createElement('section');
    board.id = PANEL_ID;
    board.className = 'panel tm-sbw-board tm-sbw-cube-board';
    board.innerHTML = `
      <div class="tm-sbw-head">
        <div>
          <div class="h">${BOARD_TITLE}</div>
          <div class="tm-sbw-sub">Loading cube nodes...</div>
        </div>
        <button type="button" class="btn tm-sbw-refresh">Refresh</button>
      </div>
      <div class="tm-sbw-summary"></div>
      <nav id="tmSbwCubeJump" class="tm-sbw-cube-jump" data-role="cube-section-jump" aria-label="Cube Monster Board sections"></nav>
      <div class="tm-sbw-run-line" data-role="cube-board-message"></div>
      <div class="tm-sbw-cube-sections"></div>
    `;

    const jump = board.querySelector('[data-role="cube-section-jump"]');
    if (jump && document.body && jump.parentElement !== document.body) {
      document.body.appendChild(jump);
    }

    board.querySelector('.tm-sbw-refresh')?.addEventListener('click', () => {
      loadAndRenderCubeBoard(board).catch((error) => {
        console.error('[TM Shadowbridge]', error);
        const sections = board.querySelector('.tm-sbw-cube-sections');
        if (sections) sections.innerHTML = `<div class="tm-sbw-error">${escapeHtml(error.message || error)}</div>`;
      });
    });

    return board;
  }

  async function loadAndRenderCubeBoard(board) {
    const renderSeq = ++cubeBoardRenderSeq;
    const nodes = getCubeNodes();
    if (!nodes.length) {
      renderCubeBoardLoading(board);
      window.setTimeout(() => {
        if (getCubeNodes().length > 0) {
          loadAndRenderCubeBoard(board).catch((error) => {
            console.error('[TM Shadowbridge]', error);
          });
        }
      }, 350);
      return;
    }
    const instanceId = getCubeInstanceId();
    const grouped = createCubeGroups(nodes);
    const fetchTargets = nodes.filter((node) => {
      const group = getCubeNodeGroup(node);
      return node.linked_location_id && (group === 'pve' || group === 'boss');
    });
    const boardTargets = nodes.filter((node) => {
      const type = String(node.type || '').toLowerCase();
      return (type === 'army' || type === 'pvp') && canEnterCubeNode(node);
    });

    const monstersByNodeId = new Map();
    const nodeBoardsByNodeId = new Map();
    renderCubeBoard(board, grouped, monstersByNodeId, nodeBoardsByNodeId, { detailLoading: Boolean(fetchTargets.length || boardTargets.length) });

    await Promise.all(fetchTargets.map(async (node) => {
      try {
        const url = new URL('guild_dungeon_location.php', window.location.origin);
        if (instanceId) url.searchParams.set('instance_id', instanceId);
        url.searchParams.set('location_id', String(node.linked_location_id));
        const location = await fetchLocation(url, node.name || `Node ${node.id}`);
        monstersByNodeId.set(String(node.id), location.monsters.map((monster, index) => ({
          ...monster,
          id: `cube-${node.id}-${index}`,
          nodeName: node.name || `Node ${node.id}`,
          nodeTypeLabel: getCubeNodeTypeLabel(node),
          roomUrl: url.toString()
        })));
      } catch (error) {
        monstersByNodeId.set(String(node.id), []);
        console.error('[TM Shadowbridge]', error);
      }
    }));

    if (renderSeq !== cubeBoardRenderSeq) return;
    renderCubeBoard(board, grouped, monstersByNodeId, nodeBoardsByNodeId, { detailLoading: Boolean(boardTargets.length) });

    if (!boardTargets.length) return;
    Promise.all(boardTargets.map(async (node) => {
        try {
          const boardData = await fetchCubeNodeBoard(node);
          nodeBoardsByNodeId.set(String(node.id), boardData);
        } catch (error) {
          nodeBoardsByNodeId.set(String(node.id), null);
          console.error('[TM Shadowbridge]', error);
        }
      })).then(() => {
        if (renderSeq !== cubeBoardRenderSeq) return;
        renderCubeBoard(board, grouped, monstersByNodeId, nodeBoardsByNodeId);
      });
  }

  function renderCubeBoardLoading(board) {
    const summary = board.querySelector('.tm-sbw-summary');
    const sections = board.querySelector('.tm-sbw-cube-sections');
    if (summary) summary.innerHTML = [summaryPill('Waiting for cube nodes...')].join('');
    if (sections) sections.innerHTML = '<div class="tm-sbw-empty">Loading cube node data...</div>';
    const sub = board.querySelector('.tm-sbw-sub');
    if (sub) sub.textContent = 'Waiting for the cube page to finish loading node data.';
  }

  function getCubeNodes() {
    const stateNodes = getCubeState()?.nodes;
    if (Array.isArray(stateNodes)) return stateNodes;
    return [];
  }

  function getCubeInstanceId() {
    const url = new URL(window.location.href);
    return url.searchParams.get('instance_id') || url.searchParams.get('id') || getCubeState()?.instance_id || '';
  }

  function getCubeState() {
    if (cubeStateOverride?.nodes) return cubeStateOverride;
    if (window.STATE?.nodes) return window.STATE;
    try {
      if (typeof STATE !== 'undefined' && STATE?.nodes) return STATE;
    } catch {}
    const parsed = parseInlineCubeJson('STATE', 'TYPE_LABELS');
    if (parsed?.nodes) {
      cubeStateOverride = parsed;
      return parsed;
    }
    return null;
  }

  function getCubeFaceData() {
    if (cubeFaceDataOverride) return cubeFaceDataOverride;
    if (window.FACE_DATA) return window.FACE_DATA;
    try {
      if (typeof FACE_DATA !== 'undefined' && FACE_DATA) return FACE_DATA;
    } catch {}
    const parsed = parseInlineCubeJson('FACE_DATA', 'STATE');
    if (parsed) {
      cubeFaceDataOverride = parsed;
      return parsed;
    }
    return {};
  }

  function parseInlineCubeJson(varName, nextVarName) {
    try {
      const pattern = new RegExp(`const\\s+${varName}\\s*=\\s*([\\s\\S]*?);\\s*const\\s+${nextVarName}\\b`);
      for (const script of Array.from(document.scripts || [])) {
        const text = script.textContent || '';
        if (!text.includes(`const ${varName}`)) continue;
        const match = text.match(pattern);
        if (!match?.[1]) continue;
        return JSON.parse(match[1]);
      }
    } catch (_error) {
      // ignore parse failures and keep trying other sources
    }
    return null;
  }

  function createCubeGroups(nodes) {
    const groups = [
      { key: 'merchant', title: 'Merchant (non combat)', nodes: [] },
      { key: 'army', title: 'Shadow Army', nodes: [] },
      { key: 'pvp', title: 'PvP', nodes: [] },
      { key: 'pve', title: 'PvE', nodes: [] },
      { key: 'boss', title: 'Boss', nodes: [] }
    ];
    const byKey = new Map(groups.map((group) => [group.key, group]));
    nodes.forEach((node) => {
      const key = getCubeNodeGroup(node);
      (byKey.get(key) || byKey.get('merchant')).nodes.push(node);
    });
    return groups;
  }

  function getCubeNodeGroup(node) {
    const type = String(node?.type || '').toLowerCase();
    const unlockRule = String(node?.unlock_rule || '').toLowerCase();
    const name = String(node?.name || '').toLowerCase();
    const isBoss = type === 'boss' || node?.is_boss_gate || unlockRule.includes('boss') || unlockRule.includes('all_pvp_other') || unlockRule.includes('all_army_other') || name.includes('boss');
    if (isBoss) return 'boss';
    if (type === 'pve') return 'pve';
    if (type === 'army') return 'army';
    if (type === 'pvp') return 'pvp';
    return 'merchant';
  }

  function getCubeNodeTypeLabel(node) {
    const type = String(node?.type || '').toLowerCase();
    if (type === 'army') return 'Shadow Army';
    if (type === 'pve') return 'PvE';
    if (type === 'pvp') return 'PvP';
    if (type === 'boss') return 'Boss';
    if (type === 'shop') return 'Shop';
    if (type === 'forge') return 'Forge';
    if (type === 'arrival') return 'Arrival';
    return type ? type.replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Node';
  }

  function getCubeFaceLabel(node) {
    const faceKey = String(node?.face_key || '');
    const face = getCubeFaceData()?.[faceKey];
    if (face?.title) return cleanText(face.title);
    const stateFace = (getCubeState()?.faces || []).find((item) => String(item.FACE_KEY || '') === faceKey);
    return cleanText(stateFace?.DISPLAY_NAME || faceKey || 'Unknown face');
  }

  function getCubeNodeProgressText(node) {
    if (!node) return '';
    const type = String(node.type || '').toLowerCase();
    const meta = node.state_meta && typeof node.state_meta === 'object' && !Array.isArray(node.state_meta) ? node.state_meta : {};

    if ((type === 'pve' || type === 'boss') && Number(node.monsters_total || 0) > 0) {
      return `Enemies: ${Number(node.monsters_left || 0)} / ${Number(node.monsters_total || 0)} left`;
    }
    if (type === 'army') {
      if (String(node.unlock_rule || '') === 'all_army_other') {
        return 'Army boss trial';
      }
      const cleared = Number(node.army_matches_cleared || meta.army_fights_cleared || 0);
      const total = Number(node.army_matches_total || meta.army_fights_total || 0);
      const active = Number(node.army_matches_active || meta.army_fights_active || 0);
      const open = Number(meta.army_fights_open || 0);
      if (total > 0) return `Army fights: ${cleared} / ${total} cleared${active || open ? `, ${active || open} active/open` : ''}`;
      return 'Shared captain battle';
    }
    if (type === 'pvp') {
      if (String(node.unlock_rule || '') === 'all_pvp_other') {
        return 'PvP boss trial';
      }
      const cleared = Number(node.pvp_matches_cleared || meta.pvp_rooms_cleared || 0);
      const total = Number(node.pvp_matches_total || meta.pvp_rooms_total || 0);
      const open = Number(meta.pvp_rooms_open || 0);
      if (total > 0) return `PvP matches: ${cleared} / ${total} cleared${open ? `, ${open} open` : ''}`;
      return 'PvP-style chamber';
    }
    if (type === 'shop') return 'Shop room';
    if (type === 'forge') return 'Forge room';
    if (type === 'arrival') return 'Entry platform';
    return cleanText(node.hint || '');
  }

  function renderCubeNodeFields(node) {
    const fields = [
      ['Face', getCubeFaceLabel(node)],
      ['Status', cleanText(node.status || 'available')],
      ['Progress', getCubeNodeProgressText(node)]
    ].filter(([, value]) => cleanText(value));

    return fields.map(([label, value]) => `
      <span class="tm-sbw-cube-field"><b>${escapeHtml(label)}</b> ${escapeHtml(value)}</span>
    `).join('');
  }

  function getCubeLocationUrl(node) {
    const locationId = Number(node?.linked_location_id || 0);
    if (!locationId) return '';
    const url = new URL('guild_dungeon_location.php', window.location.origin);
    const instanceId = getCubeInstanceId();
    if (instanceId) url.searchParams.set('instance_id', instanceId);
    url.searchParams.set('location_id', String(locationId));
    return url.toString();
  }

  function getCubeNodeUrl(node) {
    const type = String(node?.type || '').toLowerCase();
    const instanceId = getCubeInstanceId();
    const nodeId = String(node?.id || '');
    if (!nodeId) return '';
    if (type === 'pvp') {
      const url = new URL('pvp_style_node.php', window.location.origin);
      url.searchParams.set('source', 'cube');
      if (instanceId) url.searchParams.set('instance_id', instanceId);
      url.searchParams.set('node_id', nodeId);
      return url.toString();
    }
    if (type === 'army') {
      const candidates = [
        `guild_dungeon_cube_army_node.php?instance_id=${encodeURIComponent(instanceId)}&node_id=${encodeURIComponent(nodeId)}`,
        `guild_dungeon_cube_army.php?instance_id=${encodeURIComponent(instanceId)}&node_id=${encodeURIComponent(nodeId)}`
      ];
      return new URL(candidates[0], window.location.origin).toString();
    }
    return '';
  }

  async function fetchCubeNodeBoard(node) {
    const type = String(node?.type || '').toLowerCase();
    const cacheKey = `${type}:${getCubeInstanceId()}:${node?.id || ''}`;
    const cached = cubeNodeBoardCache.get(cacheKey);
    if (cached && Date.now() - cached.loadedAt < 15000) return cached.data;

    const urls = getCubeNodeFetchUrls(node);
    for (const url of urls) {
      try {
        const response = await fetch(url, { credentials: 'include' });
        if (!response.ok) continue;
        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const data = type === 'army' ? parseArmyNodeBoard(html, doc, node, url) : parsePvpNodeBoard(doc, node, url);
        if (data && Array.isArray(data.items)) {
          cubeNodeBoardCache.set(cacheKey, { loadedAt: Date.now(), data });
          return data;
        }
      } catch (_error) {
        // Try the next likely URL.
      }
    }
    try {
      const redirect = await getCubeNodeRedirect(node);
      if (redirect) {
        const response = await fetch(redirect, { credentials: 'include' });
        if (response.ok) {
          const html = await response.text();
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const data = type === 'army' ? parseArmyNodeBoard(html, doc, node, redirect) : parsePvpNodeBoard(doc, node, redirect);
          if (data && Array.isArray(data.items)) {
            cubeNodeBoardCache.set(cacheKey, { loadedAt: Date.now(), data });
            return data;
          }
        }
      }
    } catch (_error) {
      // If the redirect probe fails, fall back to the node summary card.
    }
    return null;
  }

  async function getCubeNodeRedirect(node) {
    const data = await postCubeAction('enter_node', { node_id: node.id, face_key: node.face_key });
    if (data.state) {
      cubeStateOverride = data.state;
      try { window.STATE = data.state; } catch {}
    }
    return data.redirect ? new URL(data.redirect, window.location.origin).toString() : '';
  }

  function getCubeNodeFetchUrls(node) {
    const type = String(node?.type || '').toLowerCase();
    const instanceId = getCubeInstanceId();
    const nodeId = String(node?.id || '');
    if (type === 'pvp') {
      const url = new URL('pvp_style_node.php', window.location.origin);
      url.searchParams.set('source', 'cube');
      if (instanceId) url.searchParams.set('instance_id', instanceId);
      url.searchParams.set('node_id', nodeId);
      return [url.toString()];
    }
    if (type === 'army') {
      return [
        new URL(`guild_dungeon_cube_army_node.php?instance_id=${encodeURIComponent(instanceId)}&node_id=${encodeURIComponent(nodeId)}`, window.location.origin).toString(),
        new URL(`guild_dungeon_cube_army.php?instance_id=${encodeURIComponent(instanceId)}&node_id=${encodeURIComponent(nodeId)}`, window.location.origin).toString()
      ];
    }
    return [];
  }

  function parseArmyNodeBoard(html, doc, node, baseUrl) {
    const cards = parseScriptAssignmentJson(html, 'fightCards') || [];
    const activeMatchMatch = html.match(/let\s+activeMatchNo\s*=\s*(\d+)/);
    const activeMatchNo = activeMatchMatch ? Number(activeMatchMatch[1] || 0) : 0;
    const items = (Array.isArray(cards) ? cards : [])
      .filter((card) => String(card.status || '').toLowerCase() !== 'cleared')
      .map((card) => ({
        kind: 'army',
        nodeId: String(node.id),
        matchNo: Number(card.match_no || 0),
        status: String(card.status || 'open').toLowerCase(),
        title: `Fight #${Number(card.match_no || 0)}`,
        subtitle: cleanText(`${card.banner_name || 'Army Encounter'}${card.banner_power ? ` | ${card.banner_power}` : ''}`),
        image: card.banner_image || card.captains?.[0]?.image_src || '',
        participants: Number(card.participant_count || 0),
        totalDamage: Number(card.total_damage || 0),
        totalKills: Number(card.total_kills || 0),
        activeMatchNo,
        captains: Array.isArray(card.captains) ? card.captains : [],
        url: buildArmyBattleUrl(node, card, baseUrl)
      }));
    return { type: 'army', nodeId: String(node.id), items };
  }

  function buildArmyBattleUrl(node, card, baseUrl) {
    const instanceId = getCubeInstanceId();
    const url = new URL('guild_dungeon_cube_army_battle.php', window.location.origin);
    if (instanceId) url.searchParams.set('instance_id', instanceId);
    url.searchParams.set('node_id', String(node.id));
    url.searchParams.set('match_no', String(card.match_no || 0));
    if (card.battle_id) url.searchParams.set('battle_id', String(card.battle_id));
    return url.toString();
  }

  function parsePvpNodeBoard(doc, node, baseUrl) {
    const lockText = cleanText(doc.querySelector('.warn')?.textContent || '');
    const timerText = formatCubeTimerValue(lockText);
    const timerSeconds = parseCubeDurationSeconds(timerText);
    const timerExpiresAt = timerSeconds ? Date.now() + (timerSeconds * 1000) : 0;
    const items = Array.from(doc.querySelectorAll('.match')).map((match) => {
      const title = cleanText(match.querySelector('.matchTitle')?.textContent || 'PvP Match');
      const badge = cleanText(match.querySelector('.badge')?.textContent || '').toLowerCase();
      const metaText = cleanText(match.querySelector('.meta')?.textContent || '');
      const matchNo = Number((metaText.match(/Match\s*#(\d+)/i) || [])[1] || 0);
      const slotsMatch = metaText.match(/Slots\s*(\d+)\s*\/\s*(\d+)/i);
      const filledSlots = Number(slotsMatch?.[1] || 0);
      const totalSlots = Number(slotsMatch?.[2] || 0);
      const note = cleanText(match.querySelector('.note')?.textContent || '');
      const href = match.querySelector('a.btn[href*="pvp_style_battle.php"]')?.getAttribute('href') || '';
      const url = href ? new URL(href, baseUrl).toString() : '';
      const enemies = Array.from(match.querySelectorAll('.enemyUnit')).slice(0, 5).map((enemy) => ({
        name: cleanText(enemy.querySelector('.name')?.textContent || ''),
        image: enemy.querySelector('img')?.getAttribute('src') || ''
      }));
      const rewards = Array.from(match.querySelectorAll('.rewardItem')).map((reward) => ({
        name: cleanText(reward.querySelector('.rewardName')?.textContent || ''),
        qty: cleanText(reward.querySelector('.rewardQty')?.textContent || ''),
        image: reward.querySelector('img')?.getAttribute('src') || ''
      }));
      const openSlots = Array.from(match.querySelectorAll('.slots .slot')).map((slot) => {
        const text = cleanText(slot.textContent || '');
        const slotNo = Number((text.match(/Slot\s*(\d+)/i) || [])[1] || 0);
        const hasUser = !!slot.querySelector('img') || !!cleanText(slot.querySelector('.name')?.textContent || '');
        return slotNo && !hasUser ? slotNo : 0;
      }).filter(Boolean);
      return {
        kind: 'pvp',
        nodeId: String(node.id),
        matchNo,
        status: badge || 'open',
        title,
        subtitle: note,
        filledSlots,
        totalSlots,
        missingSlots: Math.max(0, totalSlots - filledSlots),
        hasPartialOpenSlots: filledSlots > 0 && totalSlots > filledSlots,
        openSlots,
        enemies,
        rewards,
        url
      };
    }).filter((item) => item.status !== 'cleared' && item.status !== 'clear');

    items.sort((a, b) => {
      if (a.hasPartialOpenSlots !== b.hasPartialOpenSlots) return a.hasPartialOpenSlots ? -1 : 1;
      if (a.filledSlots !== b.filledSlots) return b.filledSlots - a.filledSlots;
      return a.matchNo - b.matchNo;
    });
    return { type: 'pvp', nodeId: String(node.id), items, lockText, timerText, timerExpiresAt };
  }

  function parseScriptAssignmentJson(html, name) {
    try {
      const match = String(html || '').match(new RegExp(`(?:let|const|var)\\s+${name}\\s*=\\s*([\\s\\S]*?);\\s*(?:let|const|var|function)\\b`));
      if (!match?.[1]) return null;
      return JSON.parse(match[1]);
    } catch (_error) {
      return null;
    }
  }

  function renderCubeNodeLinks(node) {
    const links = [];
    const locationUrl = getCubeLocationUrl(node);
    if (locationUrl) {
      links.push(`<a class="tm-sbw-cube-link" href="${escapeHtml(locationUrl)}">Location ${escapeHtml(String(node.linked_location_id))}</a>`);
    }
    if (Number(node?.pvp_encounter_id || 0)) {
      links.push(`<button type="button" class="tm-sbw-cube-link" data-enter-node="${escapeHtml(String(node.id))}">PvP ${escapeHtml(String(node.pvp_encounter_id))}</button>`);
    }
    if (Number(node?.army_encounter_id || 0)) {
      links.push(`<button type="button" class="tm-sbw-cube-link" data-enter-node="${escapeHtml(String(node.id))}">Army ${escapeHtml(String(node.army_encounter_id))}</button>`);
    }
    if (Number(node?.shop_id || 0)) {
      links.push(`<button type="button" class="tm-sbw-cube-link" data-enter-node="${escapeHtml(String(node.id))}">Shop ${escapeHtml(String(node.shop_id))}</button>`);
    }
    if (!links.length) return '';
    return `<div class="tm-sbw-cube-links">${links.join('')}</div>`;
  }

  function renderCubeBoard(board, groups, monstersByNodeId, nodeBoardsByNodeId = new Map(), options = {}) {
    const allNodes = groups.flatMap((group) => group.nodes);
    const fetchedMonsters = Array.from(monstersByNodeId.values()).flat();
    const summary = board.querySelector('.tm-sbw-summary');
    const sections = board.querySelector('.tm-sbw-cube-sections');
    cubeMonsterById = new Map(fetchedMonsters.map((monster) => [monster.id, monster]));
    Array.from(cubeSelectedMonsterIds).forEach((id) => {
      if (!cubeMonsterById.has(id)) cubeSelectedMonsterIds.delete(id);
    });

    summary.innerHTML = [
      summaryPill(`${allNodes.length} cube nodes`),
      summaryPill(`${fetchedMonsters.length} linked monsters`, 'alive'),
      ...groups.map((group) => summaryPill(`${group.title}: ${group.nodes.length}`))
    ].join('');

    cubeJumpStatusGroups = groups;
    cubeJumpStatusBoards = nodeBoardsByNodeId;
    ensureCubeJumpStatusTimer();
    sections.innerHTML = groups.map((group) => renderCubeGroup(group, monstersByNodeId, nodeBoardsByNodeId)).join('');
    renderCubeSectionJump(board, groups, nodeBoardsByNodeId);
    board.querySelector('.tm-sbw-sub').textContent = options.detailLoading
      ? 'Monster Board is visible now; linked combat details are still loading.'
      : 'Standalone cube view with nodes grouped by combat type.';
    syncCubePveControls(board);
  }

  function renderCubeGroup(group, monstersByNodeId, nodeBoardsByNodeId = new Map()) {
    if (group.key === 'pvp') {
      return renderCubePvpGroup(group, nodeBoardsByNodeId);
    }

    const cards = group.nodes.map((node) => {
      const monsters = monstersByNodeId.get(String(node.id)) || [];
      if (monsters.length) {
        return monsters.map((monster) => renderCubeMonsterCard(monster, node)).join('');
      }
      const nodeBoard = nodeBoardsByNodeId.get(String(node.id));
      if (nodeBoard?.items?.length) {
        return nodeBoard.items.map((item) => item.kind === 'army' ? renderCubeArmyFightCard(item, node) : renderCubePvpMatchCard(item, node)).join('');
      }
      if (nodeBoard && !nodeBoard.items.length && ['army', 'pvp'].includes(String(node.type || '').toLowerCase())) {
        return '';
      }
      return renderCubeNodeCard(node);
    }).join('');

    return `
      <section class="tm-sbw-cube-section" data-section="${escapeHtml(group.key)}">
        <span id="tm-cube-section-${escapeHtml(group.key)}" class="tm-sbw-section-anchor"></span>
        <div class="tm-sbw-cube-section-head">
          <h3>${escapeHtml(group.title)}</h3>
          <span>${escapeHtml(String(group.nodes.length))} nodes</span>
        </div>
        ${group.key === 'pve' ? renderCubePveControls() : ''}
        <div class="tm-sbw-cube-grid">
          ${cards || '<div class="tm-sbw-empty">No nodes in this section.</div>'}
        </div>
      </section>
    `;
  }

  function renderCubePveControls() {
    return `
      <div class="tm-sbw-qol tm-sbw-cube-pve-controls" data-role="cube-pve-controls" style="display:none;">
        <div class="qol-top">
          <div class="qol-filters">
            <span class="qol-title">PvE Targets</span>
            <button class="btn" type="button" data-role="cube-select-pve">Select visible PvE</button>
            <button class="btn" type="button" data-role="cube-clear-pve">Clear</button>
            <span class="tm-sbw-selected-count" data-role="cube-selected-count">Selected: 0</span>
          </div>
          <div class="qol-attacks">
            <button class="btn btnQuickJoinAttack" type="button" data-role="cube-quick-attack" data-skill-id="0" data-stam="1">Quick Join & Attack (1)</button>
            <button class="btn btnQuickJoinAttack" type="button" data-role="cube-quick-attack" data-skill-id="-1" data-stam="10">Quick Join & Attack (10)</button>
            <button class="btn btnQuickJoinAttack" type="button" data-role="cube-quick-attack" data-skill-id="-2" data-stam="50">Quick Join & Attack (50)</button>
            <button class="btn btnQuickJoinAttack" type="button" data-role="cube-quick-attack" data-skill-id="-3" data-stam="100">Quick Join & Attack (100)</button>
            <button class="btn btnQuickJoinAttack" type="button" data-role="cube-quick-attack" data-skill-id="-4" data-stam="200">Quick Join & Attack (200)</button>
          </div>
        </div>
        <div class="tm-sbw-run-line" data-role="cube-attack-line"></div>
      </div>
    `;
  }

  function renderCubePvpGroup(group, nodeBoardsByNodeId = new Map()) {
    const loadedBoards = group.nodes.map((node) => nodeBoardsByNodeId.get(String(node.id))).filter(Boolean);
    const loading = loadedBoards.length < group.nodes.filter((node) => canEnterCubeNode(node)).length;
    const openItems = group.nodes.flatMap((node) => {
      const nodeBoard = nodeBoardsByNodeId.get(String(node.id));
      if (!nodeBoard?.items?.length) return [];
      return nodeBoard.items
        .filter(isOpenCubePvpItem)
        .map((item) => ({ item, node }));
    }).sort((a, b) => {
      if (a.item.hasPartialOpenSlots !== b.item.hasPartialOpenSlots) return a.item.hasPartialOpenSlots ? -1 : 1;
      if (a.item.filledSlots !== b.item.filledSlots) return b.item.filledSlots - a.item.filledSlots;
      return a.item.matchNo - b.item.matchNo;
    }).slice(0, 5);
    const cards = openItems.map(({ item, node }) => renderCubePvpMatchCard(item, node)).join('');

    return `
      <section class="tm-sbw-cube-section" data-section="${escapeHtml(group.key)}">
        <span id="tm-cube-section-${escapeHtml(group.key)}" class="tm-sbw-section-anchor"></span>
        <div class="tm-sbw-cube-section-head">
          <h3>${escapeHtml(group.title)}</h3>
          <span>${escapeHtml(String(openItems.length))} open match${openItems.length === 1 ? '' : 'es'} shown</span>
        </div>
        <div class="tm-sbw-cube-grid">
          ${cards || `<div class="tm-sbw-empty">${loading ? 'Loading open PvP matches...' : 'No open PvP matches with slots available.'}</div>`}
        </div>
      </section>
    `;
  }

  function isOpenCubePvpItem(item) {
    const status = String(item?.status || '').toLowerCase();
    if (status.includes('clear') || status.includes('closed') || status.includes('complete')) return false;
    return Number(item?.missingSlots || 0) > 0 && Array.isArray(item?.openSlots) && item.openSlots.length > 0;
  }

  function renderCubeSectionJump(board, groups, nodeBoardsByNodeId = new Map()) {
    const nav = document.getElementById('tmSbwCubeJump') || board.querySelector('[data-role="cube-section-jump"]');
    if (!nav) return;
    const status = getCubePvpJumpStatus(groups, nodeBoardsByNodeId);
    nav.innerHTML = groups.map((group) => `
      <a href="#tm-cube-section-${escapeHtml(group.key)}">${escapeHtml(group.title.replace(' (non combat)', ''))}</a>
    `).join('') + `
      <div class="tm-sbw-cube-pvp-status ${status.ready ? 'ready' : 'waiting'}">
        ${escapeHtml(status.text)}
      </div>
    `;
  }

  function ensureCubeJumpStatusTimer() {
    if (cubeJumpStatusTimer) return;
    cubeJumpStatusTimer = window.setInterval(() => {
      const nav = document.getElementById('tmSbwCubeJump');
      if (!nav || !document.body?.classList.contains('tm-sbw-cube-board-active')) return;
      const status = getCubePvpJumpStatus(cubeJumpStatusGroups, cubeJumpStatusBoards);
      const statusEl = nav.querySelector('.tm-sbw-cube-pvp-status');
      if (!statusEl) return;
      statusEl.classList.toggle('ready', status.ready);
      statusEl.classList.toggle('waiting', !status.ready);
      statusEl.textContent = status.text;
    }, 1000);
  }

  function getCubePvpJumpStatus(groups, nodeBoardsByNodeId = new Map()) {
    const pvpGroup = groups.find((group) => group.key === 'pvp');
    const pvpNodes = pvpGroup?.nodes || [];
    const timerText = getCubePvpTimerText(pvpNodes, nodeBoardsByNodeId);
    if (timerText) {
      return { ready: false, text: `PvP ${timerText}` };
    }

    const openItems = pvpNodes.flatMap((node) => {
      const board = nodeBoardsByNodeId.get(String(node.id));
      return (board?.items || []).filter(isOpenCubePvpItem);
    });
    if (openItems.length) {
      return { ready: true, text: 'Ready PvP' };
    }

    return { ready: false, text: 'PvP timer...' };
  }

  function getCubePvpTimerText(nodes, nodeBoardsByNodeId = new Map()) {
    for (const node of nodes || []) {
      const board = nodeBoardsByNodeId.get(String(node.id));
      const expiresAt = Number(board?.timerExpiresAt || 0);
      if (expiresAt > Date.now()) {
        return formatCubeDuration(Math.ceil((expiresAt - Date.now()) / 1000));
      }
      const text = formatCubeTimerValue(board?.timerText || board?.lockText || board?.cooldownText || '');
      if (text) return text;
    }

    for (const node of nodes || []) {
      const meta = node?.state_meta && typeof node.state_meta === 'object' && !Array.isArray(node.state_meta) ? node.state_meta : {};
      const values = [
        node?.pvp_timer,
        node?.pvp_cooldown,
        node?.pvp_cooldown_text,
        node?.next_pvp_at,
        node?.next_match_at,
        meta.pvp_timer,
        meta.pvp_cooldown,
        meta.pvp_cooldown_text,
        meta.next_pvp_at,
        meta.next_match_at,
        meta.timer,
        meta.cooldown,
        meta.cooldown_text
      ];
      for (const value of values) {
        const text = formatCubeTimerValue(value);
        if (text) return text;
      }
    }

    const pageText = cleanText(document.body?.textContent || '');
    const pvpTimerMatch =
      pageText.match(/locked\s+to\s+another\s+match[\s\S]{0,120}?\babout\s+((?:\d+\s*d\s*)?(?:\d{1,2}:)?\d{1,2}:\d{2}|\d+\s*(?:sec|secs|second|seconds|min|mins|minute|minutes|hour|hours))\s+more/i) ||
      pageText.match(/\babout\s+((?:\d+\s*d\s*)?(?:\d{1,2}:)?\d{1,2}:\d{2}|\d+\s*(?:sec|secs|second|seconds|min|mins|minute|minutes|hour|hours))\s+more/i) ||
      pageText.match(/(?:PvP|PVP)[^0-9]{0,90}((?:\d+\s*d\s*)?(?:\d{1,2}:)?\d{1,2}:\d{2}|\d+\s*(?:sec|secs|second|seconds|min|mins|minute|minutes|hour|hours))/i) ||
      pageText.match(/((?:\d+\s*d\s*)?(?:\d{1,2}:)?\d{1,2}:\d{2})\s*(?:left|remaining|until|cooldown|to join|before)/i) ||
      pageText.match(/(\d+\s*(?:sec|secs|second|seconds|min|mins|minute|minutes|hour|hours))\s*(?:left|remaining|until|cooldown|to join|before)/i);
    return pvpTimerMatch?.[1] ? cleanText(pvpTimerMatch[1]) : '';
  }

  function formatCubeTimerValue(value) {
    if (value === null || value === undefined || value === '') return '';
    if (typeof value === 'number' && Number.isFinite(value)) {
      if (value <= 0) return '';
      if (value > 1000000000) {
        const secondsUntil = Math.max(0, Math.floor(value - Date.now() / 1000));
        return secondsUntil ? formatCubeDuration(secondsUntil) : '';
      }
      return formatCubeDuration(value);
    }
    const text = cleanText(value);
    if (!text || /ready|open|join/i.test(text)) return '';
    const epoch = Number(text);
    if (Number.isFinite(epoch) && epoch > 0) return formatCubeTimerValue(epoch);
    const timeMatch = text.match(/(?:\d+\s*d\s*)?(?:\d{1,2}:)?\d{1,2}:\d{2}|\d+\s*(?:sec|secs|second|seconds|min|mins|minute|minutes|hour|hours)/i);
    return timeMatch ? cleanText(timeMatch[0]) : text;
  }

  function parseCubeDurationSeconds(value) {
    const text = cleanText(value);
    if (!text) return 0;
    const clock = text.match(/^(?:(\d+)\s*d\s*)?(?:(\d{1,2}):)?(\d{1,2}):(\d{2})$/i);
    if (clock) {
      const days = Number(clock[1] || 0);
      const hours = Number(clock[2] || 0);
      const minutes = Number(clock[3] || 0);
      const seconds = Number(clock[4] || 0);
      return (days * 86400) + (hours * 3600) + (minutes * 60) + seconds;
    }

    const amount = Number((text.match(/\d+/) || [])[0] || 0);
    if (!amount) return 0;
    if (/hour|hr/i.test(text)) return amount * 3600;
    if (/min/i.test(text)) return amount * 60;
    if (/sec|second/i.test(text)) return amount;
    return 0;
  }

  function formatCubeDuration(totalSeconds) {
    let seconds = Math.max(0, Math.floor(Number(totalSeconds || 0)));
    const hours = Math.floor(seconds / 3600);
    seconds -= hours * 3600;
    const minutes = Math.floor(seconds / 60);
    seconds -= minutes * 60;
    if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  function renderCubeMonsterCard(monster, node) {
    const imageUrl = monster.image ? new URL(monster.image, window.location.origin).toString() : '';
    const statusClass = monster.dead ? 'dead' : 'alive';
    const canQuickAttack = !monster.dead && monster.dgmid && monster.instanceId;
    return `
      <article class="tm-sbw-monster-card tm-sbw-cube-card ${statusClass}">
        <div class="tm-sbw-monster-top">
          ${imageUrl ? `<img class="tm-sbw-monster-img" src="${escapeHtml(imageUrl)}" alt="">` : ''}
          <div class="tm-sbw-monster-main">
            <div class="tm-sbw-monster-name">${escapeHtml(monster.name)}</div>
            <div class="tm-sbw-monster-meta">
              <span class="tm-sbw-badge ${statusClass}">${monster.dead ? 'Dead' : 'Alive'}</span>
              <span class="tm-sbw-badge">${escapeHtml(node.name || `Node ${node.id}`)}</span>
              <span class="tm-sbw-badge">${escapeHtml(getCubeNodeTypeLabel(node))}</span>
            </div>
            <div class="tm-sbw-stats">
              <span>${escapeHtml(getCubeFaceLabel(node))}</span>
              <span>${escapeHtml(getCubeNodeProgressText(node))}</span>
              <span>HP ${escapeHtml(monster.hp || '?')}</span>
              <span>ATK ${escapeHtml(monster.atk || '?')}</span>
              <span>DEF ${escapeHtml(monster.def || '?')}</span>
              <span>EXP/dmg ${escapeHtml(monster.expPerDamage || '?')}</span>
            </div>
            ${renderCubeNodeLinks(node)}
          </div>
        </div>
        <div class="tm-sbw-monster-actions">
          ${canQuickAttack ? `
            <label class="tm-sbw-cube-checkline">
              <input type="checkbox" class="tm-sbw-cube-monster-check" value="${escapeHtml(monster.id)}" ${cubeSelectedMonsterIds.has(monster.id) ? 'checked' : ''}>
              <span>Select</span>
            </label>
          ` : ''}
          ${monster.actionUrl ? `<a class="btn tm-sbw-action" href="${escapeHtml(monster.actionUrl)}">${escapeHtml(monster.actionLabel || 'Fight')}</a>` : ''}
          ${renderCubeEnterButton(node)}
        </div>
      </article>
    `;
  }

  function renderCubeArmyFightCard(item, node) {
    const imageUrl = item.image ? new URL(item.image, window.location.origin).toString() : '';
    const captains = (item.captains || []).slice(0, 3).map((captain) => {
      const hpMax = Math.max(1, Number(captain.squad_max_health || 1));
      const hpCur = Math.max(0, Number(captain.squad_current_health || 0));
      return `
        <div class="tm-sbw-cube-mini-row">
          ${captain.image_src ? `<img src="${escapeHtml(new URL(captain.image_src, window.location.origin).toString())}" alt="">` : ''}
          <span>${escapeHtml(captain.display_name || 'Captain')}</span>
          <b>${escapeHtml(formatDamage(hpCur))}/${escapeHtml(formatDamage(hpMax))}</b>
        </div>
      `;
    }).join('');
    const disabled = item.activeMatchNo > 0 && item.activeMatchNo !== item.matchNo;
    return `
      <article class="tm-sbw-monster-card tm-sbw-cube-card tm-sbw-cube-battle-card">
        <div class="tm-sbw-monster-top">
          ${imageUrl ? `<img class="tm-sbw-monster-img" src="${escapeHtml(imageUrl)}" alt="">` : ''}
          <div class="tm-sbw-monster-main">
            <div class="tm-sbw-monster-name">${escapeHtml(node.name || `Node ${node.id}`)} - ${escapeHtml(item.title)}</div>
            <div class="tm-sbw-monster-meta">
              <span class="tm-sbw-badge">${escapeHtml(getCubeNodeTypeLabel(node))}</span>
              <span class="tm-sbw-badge">${escapeHtml(item.status === 'active' ? 'Live' : item.status === 'failed' ? 'Failed' : 'Open')}</span>
            </div>
            <div class="tm-sbw-stats">
              <span>${escapeHtml(item.subtitle || 'Army fight')}</span>
              <span>${escapeHtml(formatDamage(item.participants))} members</span>
              <span>${escapeHtml(formatDamage(item.totalDamage))} dmg</span>
              <span>${escapeHtml(formatDamage(item.totalKills))} kills</span>
            </div>
            <div class="tm-sbw-cube-mini-list">${captains}</div>
          </div>
        </div>
        <div class="tm-sbw-monster-actions">
          <button type="button" class="btn" data-node-id="${escapeHtml(String(node.id))}" data-enter-army-match="${escapeHtml(String(item.matchNo))}" ${disabled ? 'disabled' : ''}>${item.status === 'active' ? 'Enter Fight' : item.status === 'failed' ? 'Retry Fight' : 'Launch Fight'}</button>
        </div>
      </article>
    `;
  }

  function renderCubePvpMatchCard(item, node) {
    const enemies = (item.enemies || []).slice(0, 5).map((enemy) => `
      <div class="tm-sbw-cube-mini-row">
        ${enemy.image ? `<img src="${escapeHtml(new URL(enemy.image, window.location.origin).toString())}" alt="">` : ''}
        <span>${escapeHtml(enemy.name || 'Enemy')}</span>
      </div>
    `).join('');
    const rewards = (item.rewards || []).slice(0, 3).map((reward) => `
      <span class="tm-sbw-cube-field"><b>${escapeHtml(reward.qty || 'x?')}</b> ${escapeHtml(reward.name || 'Reward')}</span>
    `).join('');
    const slotButtons = (item.openSlots || []).slice(0, 5).map((slot) => `
      <button type="button" class="tm-sbw-cube-link" data-node-id="${escapeHtml(String(node.id))}" data-match-no="${escapeHtml(String(item.matchNo))}" data-pvp-join-slot="${escapeHtml(String(slot))}">Join slot #${escapeHtml(String(slot))}</button>
    `).join('');
    return `
      <article class="tm-sbw-monster-card tm-sbw-cube-card tm-sbw-cube-battle-card ${item.hasPartialOpenSlots ? 'priority' : ''}">
        <div class="tm-sbw-monster-main">
          <div class="tm-sbw-monster-name">${escapeHtml(node.name || `Node ${node.id}`)} - Match #${escapeHtml(String(item.matchNo || '?'))}</div>
          <div class="tm-sbw-monster-meta">
            <span class="tm-sbw-badge">${escapeHtml(getCubeNodeTypeLabel(node))}</span>
            <span class="tm-sbw-badge">${escapeHtml(item.status || 'open')}</span>
            <span class="tm-sbw-badge">${escapeHtml(String(item.filledSlots))}/${escapeHtml(String(item.totalSlots))} slots</span>
            ${item.hasPartialOpenSlots ? '<span class="tm-sbw-badge alive">Joinable slots</span>' : ''}
          </div>
          <div class="tm-sbw-stats">
            <span>${escapeHtml(item.title || 'PvP match')}</span>
            ${item.subtitle ? `<span>${escapeHtml(item.subtitle)}</span>` : ''}
            ${item.missingSlots ? `<span>${escapeHtml(String(item.missingSlots))} open slot(s)</span>` : ''}
          </div>
          <div class="tm-sbw-cube-mini-list">${enemies}</div>
          ${rewards ? `<div class="tm-sbw-cube-links">${rewards}</div>` : ''}
          ${slotButtons ? `<div class="tm-sbw-cube-links">${slotButtons}</div>` : ''}
        </div>
        <div class="tm-sbw-monster-actions">
          ${item.url ? `<a class="btn tm-sbw-action" href="${escapeHtml(item.url)}">View Match</a>` : renderCubeEnterButton(node)}
        </div>
      </article>
    `;
  }

  function renderCubeNodeCard(node) {
    return `
      <article class="tm-sbw-monster-card tm-sbw-cube-card tm-sbw-cube-node-card" data-cube-node="${escapeHtml(String(node.id))}">
        <div class="tm-sbw-monster-main">
          <button type="button" class="tm-sbw-cube-node-title" data-enter-node="${escapeHtml(String(node.id))}">${escapeHtml(node.name || `Node ${node.id}`)}</button>
          <div class="tm-sbw-monster-meta">
            <span class="tm-sbw-badge">${escapeHtml(getCubeNodeTypeLabel(node))}</span>
            <span class="tm-sbw-badge">${escapeHtml(cleanText(node.status || 'available'))}</span>
          </div>
          <div class="tm-sbw-stats">
            ${renderCubeNodeFields(node)}
          </div>
          ${renderCubeNodeLinks(node)}
          ${node.description ? `<div class="tm-sbw-cube-desc">${escapeHtml(node.description)}</div>` : ''}
        </div>
        <div class="tm-sbw-monster-actions">
          ${renderCubeEnterButton(node)}
        </div>
      </article>
    `;
  }

  function renderCubeEnterButton(node) {
    if (!canEnterCubeNode(node)) {
      return '<button type="button" class="btn" disabled>Locked</button>';
    }
    const label = cleanText(node?.enter_label || (node?.type === 'shop' ? 'Visit' : 'Enter'));
    return `<button type="button" class="btn tableActionBtn" data-enter-node="${escapeHtml(String(node.id))}">${escapeHtml(label)}</button>`;
  }

  function canEnterCubeNode(node) {
    if (!node) return false;
    const status = String(node.status || '').toLowerCase();
    return status !== 'hidden' && status !== 'locked';
  }

  async function postCubeAction(action, payload) {
    const body = new URLSearchParams();
    body.set('action', String(action || ''));
    Object.entries(payload || {}).forEach(([key, value]) => body.set(key, String(value ?? '')));

    const response = await fetch('guild_dungeon_cube_action.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: body.toString(),
      credentials: 'same-origin'
    });

    const raw = await response.text();
    let data = null;
    try {
      data = JSON.parse(raw);
    } catch (_error) {
      data = null;
    }

    if (!response.ok || !data) {
      throw new Error(`Cube action failed (${response.status})`);
    }
    if (data.error) {
      throw new Error(cleanText(data.error));
    }
    return data;
  }

  async function postCubeArmyAction(action, payload) {
    const body = new URLSearchParams();
    body.set('action', String(action || ''));
    Object.entries(payload || {}).forEach(([key, value]) => body.set(key, String(value ?? '')));

    const response = await fetch('guild_dungeon_cube_army_action.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: body.toString(),
      credentials: 'same-origin'
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || data.ok === false) {
      throw new Error((data && (data.error || data.message)) ? (data.error || data.message) : `Army action failed (${response.status})`);
    }
    return data;
  }

  async function postPvpStyleAction(action, payload) {
    const body = new URLSearchParams();
    body.set('action', String(action || ''));
    Object.entries(payload || {}).forEach(([key, value]) => body.set(key, String(value ?? '')));

    const response = await fetch('pvp_style_action.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: body.toString(),
      credentials: 'same-origin'
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || data.ok === false) {
      throw new Error((data && (data.error || data.message)) ? (data.error || data.message) : `PvP action failed (${response.status})`);
    }
    return data;
  }

  function showCubeBoardMessage(board, message) {
    const line = board.querySelector('[data-role="cube-board-message"]');
    if (!line) return;
    line.textContent = cleanText(message);
    window.clearTimeout(showCubeBoardMessage._timer);
    showCubeBoardMessage._timer = window.setTimeout(() => {
      line.textContent = '';
    }, 3500);
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
      aliveFilter: board.querySelector('[data-role="alive-filter"]'),
      deadFilter: board.querySelector('[data-role="dead-filter"]'),
      joinedFilter: board.querySelector('[data-role="joined-filter"]'),
      unjoinedFilter: board.querySelector('[data-role="unjoined-filter"]'),
      monsterGrid: board.querySelector('[data-role="monster-grid"]'),
      selectedCount: board.querySelector('[data-role="selected-count"]'),
      openSelected: board.querySelector('[data-role="open-selected"]'),
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
      const visible = getVisibleMonsters(board, allMonsters);
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

    board.querySelector('[data-role="select-visible"]')?.addEventListener('click', () => {
      getVisibleMonsters(board, allMonsters).forEach((monster) => selected.add(monster.id));
      render();
    });

    board.querySelector('[data-role="clear-selected"]')?.addEventListener('click', () => {
      selected.clear();
      render();
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

    function calcStrategyTotalStam(order) {
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
      const total = calcStrategyTotalStam(order);
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
      const totalStam = calcStrategyTotalStam(order);
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

      const total = calcStrategyTotalStam(order);
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

  function getVisibleMonsters(board, monsters) {
    const showAlive = board.querySelector('[data-role="alive-filter"]')?.checked;
    const showDead = board.querySelector('[data-role="dead-filter"]')?.checked;
    const showJoined = board.querySelector('[data-role="joined-filter"]')?.checked;
    const showUnjoined = board.querySelector('[data-role="unjoined-filter"]')?.checked;
    const nameFilter = (board.querySelector('[data-role="name-filter"]')?.value || '').trim();

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
      if (personalDamage > 0 || (quotaStore.has(monster) && personalDamage === null)) {
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
      const anchor = document.querySelector('.mapframe')?.closest('.panel');
      if (anchor) {
        anchor.insertAdjacentElement('afterend', board);
      } else {
        document.body.appendChild(board);
      }
    }

    board.innerHTML = `<div class="h">${BOARD_TITLE}</div><div class="tm-sbw-error">${escapeHtml(message)}</div>`;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      body.tm-sbw-map-page{
        /* Prevent weird extra whitespace at the bottom on some layouts */
        min-height: 0 !important;
        padding-bottom: 0 !important;
        margin-bottom: 0 !important;
      }
      body.tm-sbw-map-page .panel{
        min-height: 0 !important;
      }
      body.tm-sbw-map-page .wrap{
        padding-bottom: 0 !important;
        margin-bottom: 0 !important;
      }
      body.tm-sbw-map-page .tm-sbw-hidden-map-panel{
        display: none !important;
      }
      body.tm-sbw-map-page .tm-sbw-hidden-dungeon-overview{
        display: none !important;
      }
      .tm-sbw-board {
        margin-top: 0;
      }
      .tm-sbw-board.tm-sbw-minimal-controls .tm-sbw-refresh,
      .tm-sbw-board.tm-sbw-minimal-controls .tm-sbw-select-actions,
      .tm-sbw-board.tm-sbw-minimal-controls [data-role="attack-strat-run"],
      .tm-sbw-board.tm-sbw-minimal-controls .tm-sbw-tools,
      .tm-sbw-board.tm-sbw-minimal-controls .tm-sbw-model-line,
      .tm-sbw-board.tm-sbw-minimal-controls .attack-strat-overlay,
      .tm-sbw-board.tm-sbw-minimal-controls [data-role="cube-select-pve"],
      .tm-sbw-board.tm-sbw-minimal-controls [data-role="cube-clear-pve"]{
        display: none !important;
      }
      .tm-sbw-head {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
        flex-wrap: wrap;
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
      }
      .tm-sbw-qol {
        margin-top: 16px;
        display: grid;
        gap: 12px;
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
      .tm-sbw-run-line {
        color: #fcd34d;
        font-size: 12px;
        min-height: 16px;
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
      .tm-sbw-cube-checkline {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 32px;
        padding: 6px 10px;
        border-radius: 10px;
        border: 1px solid #2e3655;
        background: rgba(255,255,255,.04);
        color: #dbe4ff;
        font-size: 12px;
        font-weight: 800;
        cursor: pointer;
      }
      .tm-sbw-cube-checkline input {
        width: 16px;
        height: 16px;
        margin: 0;
      }
      .tm-sbw-error {
        margin-top: 12px;
        color: #fca5a5;
      }
      .tm-sbw-cube-board {
        margin-top: 18px;
      }
      .stage > .tm-sbw-cube-board {
        display: none;
        width: min(72vw, 1080px);
        max-width: calc(100vw - 360px);
        max-height: none;
        margin: 0 auto 36px;
        overflow: visible;
        box-sizing: border-box;
      }
      .stage.tm-sbw-board-mode {
        min-height: 0 !important;
        width: 100%;
        align-items: stretch;
      }
      .stage.tm-sbw-board-mode .scene,
      .stage.tm-sbw-board-mode .nodeTableView {
        display: none !important;
      }
      .stage.tm-sbw-board-mode > .tm-sbw-cube-board {
        display: block;
      }
      body:not(.tm-sbw-cube-board-active) .tm-sbw-cube-jump {
        display: none !important;
      }
      .tm-sbw-cube-jump {
        position: fixed;
        top: 92px;
        right: 14px;
        z-index: 2147482500;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 7px;
        width: auto;
        max-width: 132px;
        margin: 0;
        padding: 8px;
        border-radius: 14px;
        border: 1px solid rgba(255,255,255,.12);
        background: rgba(13,15,24,.84);
        box-shadow: 0 10px 28px rgba(0,0,0,.38);
        backdrop-filter: blur(8px);
      }
      .tm-sbw-cube-jump a {
        display: block;
        min-width: 92px;
        padding: 7px 9px;
        border-radius: 10px;
        border: 1px solid rgba(160,210,255,.18);
        background: rgba(59,111,155,.22);
        color: #e4f2ff;
        font-size: 11px;
        font-weight: 900;
        line-height: 1.15;
        text-align: center;
        text-decoration: none;
      }
      .tm-sbw-cube-jump a:hover {
        background: rgba(255,211,105,.18);
        border-color: rgba(255,211,105,.32);
        color: #fff2c2;
      }
      .tm-sbw-cube-pvp-status {
        margin-top: 2px;
        padding: 8px 9px;
        border-radius: 10px;
        font-size: 11px;
        font-weight: 950;
        line-height: 1.15;
        text-align: center;
        border: 1px solid rgba(255,255,255,.14);
        box-shadow: inset 0 1px 0 rgba(255,255,255,.08);
      }
      .tm-sbw-cube-pvp-status.waiting {
        color: #fee2e2;
        background: rgba(153, 27, 27, .84);
        border-color: rgba(248, 113, 113, .42);
      }
      .tm-sbw-cube-pvp-status.ready {
        color: #dcfce7;
        background: rgba(22, 101, 52, .86);
        border-color: rgba(74, 222, 128, .46);
      }
      .tm-sbw-cube-sections {
        display: grid;
        gap: 42px;
        margin-top: 30px;
      }
      .tm-sbw-cube-section {
        position: relative;
        display: grid;
        gap: 18px;
        padding: 18px;
        border-radius: 14px;
        background: linear-gradient(180deg, rgba(24,27,40,.98), rgba(16,18,28,.98));
        border: 1px solid rgba(255,255,255,.12);
        box-shadow: 0 12px 30px rgba(0,0,0,.24);
        scroll-margin-top: 18px;
      }
      .tm-sbw-section-anchor {
        position: absolute;
        top: -18px;
      }
      .tm-sbw-cube-section-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }
      .tm-sbw-cube-section-head h3 {
        margin: 0;
        color: #FFD369;
        font-size: 15px;
        font-weight: 900;
      }
      .tm-sbw-cube-section-head span,
      .tm-sbw-empty {
        color: #94a3b8;
        font-size: 12px;
      }
      .tm-sbw-cube-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: 12px;
      }
      @media (max-width: 1100px) {
        .stage > .tm-sbw-cube-board {
          width: calc(100vw - 24px);
          max-width: calc(100vw - 24px);
        }
        .tm-sbw-cube-jump {
          top: 82px;
          right: 8px;
        }
        .tm-sbw-cube-jump a {
          min-width: 58px;
          padding: 6px 7px;
          font-size: 10.5px;
        }
        .tm-sbw-cube-pvp-status {
          padding: 7px;
          font-size: 10.5px;
        }
      }
      .tm-sbw-cube-card {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        min-height: 132px;
      }
      .tm-sbw-cube-card.dead {
        opacity: 0.8;
      }
      .tm-sbw-cube-field {
        display: inline-flex;
        gap: 4px;
        align-items: baseline;
        padding: 4px 7px;
        border-radius: 999px;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.08);
      }
      .tm-sbw-cube-field b {
        color: #FFD369;
      }
      .tm-sbw-cube-links {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 10px;
      }
      .tm-sbw-cube-link,
      .tm-sbw-cube-node-title {
        appearance: none;
        border: 1px solid rgba(160,210,255,.22);
        background: rgba(59,111,155,.24);
        color: #dff0ff;
        border-radius: 999px;
        cursor: pointer;
        font: inherit;
        font-size: 12px;
        font-weight: 800;
        line-height: 1.2;
        padding: 5px 8px;
        text-decoration: none;
      }
      .tm-sbw-cube-link:hover,
      .tm-sbw-cube-node-title:hover {
        filter: brightness(1.1);
      }
      .tm-sbw-cube-node-title {
        display: inline-flex;
        max-width: 100%;
        border-radius: 10px;
        color: #e6e9ff;
        font-size: 14px;
        font-weight: 900;
        text-align: left;
        padding: 4px 7px;
        margin: -4px 0 2px;
      }
      .tm-sbw-cube-desc {
        margin-top: 10px;
        color: #aeb6d8;
        font-size: 12px;
        line-height: 1.45;
      }
      .tm-sbw-cube-node-card .tm-sbw-stats {
        min-height: 24px;
      }
      .tm-sbw-cube-battle-card.priority {
        border-color: rgba(34,197,94,.55) !important;
        box-shadow: 0 0 0 2px rgba(34,197,94,.14) inset, 0 16px 32px rgba(0,0,0,.65) !important;
      }
      .tm-sbw-cube-mini-list {
        display: grid;
        gap: 6px;
        margin-top: 10px;
      }
      .tm-sbw-cube-mini-row {
        display: grid;
        grid-template-columns: 28px minmax(0,1fr) auto;
        gap: 8px;
        align-items: center;
        min-height: 28px;
        padding: 5px 7px;
        border-radius: 10px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.07);
        color: #cbd5e1;
        font-size: 12px;
      }
      .tm-sbw-cube-mini-row img {
        width: 28px;
        height: 28px;
        object-fit: cover;
        border-radius: 8px;
      }
      .tm-sbw-cube-mini-row span {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .tm-sbw-cube-mini-row b {
        color: #FFD369;
        font-size: 11px;
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
        html,
        body {
          max-width: 100vw;
          overflow-x: hidden;
        }
        .stage > .tm-sbw-cube-board {
          width: 100%;
          max-width: 100%;
          max-height: none !important;
          margin-left: 0;
          margin-right: 0;
          overflow: visible !important;
        }
        .tm-sbw-cube-jump {
          position: fixed;
          top: 74px;
          right: 6px;
          z-index: 2147482500;
          flex-direction: column;
          align-items: stretch;
          width: auto;
          max-width: 92px;
          gap: 6px;
          padding: 6px;
          margin: 0;
          transform: none;
        }
        .tm-sbw-cube-jump a {
          flex: 0 0 auto;
          min-width: 0;
          width: 78px;
          padding: 7px 6px;
          font-size: 10.5px;
        }
        .tm-sbw-cube-pvp-status {
          width: 78px;
          padding: 7px 6px;
          font-size: 10.5px;
          box-sizing: border-box;
        }
        .tm-sbw-cube-sections {
          gap: 34px;
          margin-top: 24px;
        }
        .tm-sbw-cube-section {
          padding: 14px;
          gap: 16px;
          border-radius: 12px;
          overflow: visible !important;
        }
        .tm-sbw-cube-section-head h3 {
          font-size: 16px;
        }
        .tm-sbw-cube-grid {
          grid-template-columns: minmax(0, 1fr);
          gap: 14px;
        }
        .tm-sbw-cube-card {
          min-height: 148px;
          padding: 14px !important;
        }
        .tm-sbw-cube-card .tm-sbw-monster-img {
          width: 64px;
          height: 64px;
        }
        .tm-sbw-cube-card .tm-sbw-monster-name {
          font-size: 15px;
        }
        .tm-sbw-cube-card .tm-sbw-stats,
        .tm-sbw-cube-card .tm-sbw-badge {
          font-size: 12px;
        }
        .tm-sbw-cube-card .btn,
        .tm-sbw-cube-link,
        .tm-sbw-cube-checkline {
          min-height: 38px;
          padding: 9px 11px;
          font-size: 12px;
        }
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
        const monsterKey = getQuotaMonsterKey(monster);
        if (!monsterKey) {
          return false;
        }
        const ruleList = state.rules[monster.limitRule.ruleKey] || [];
        return ruleList.includes(monsterKey);
      },
      mark(monster) {
        ensureCurrentCycle();
        if (!monster.limitRule) {
          return;
        }
        const monsterKey = getQuotaMonsterKey(monster);
        if (!monsterKey) {
          return;
        }
        const ruleKey = monster.limitRule.ruleKey;
        const ruleList = normalizeQuotaRuleList(state.rules[ruleKey]);
        if (!ruleList.includes(monsterKey)) {
          ruleList.push(monsterKey);
          state.rules[ruleKey] = ruleList;
          writeQuotaState(state);
        }
      }
    };
  }

  function getQuotaMonsterKey(monster) {
    if (!monster) {
      return '';
    }
    const instanceId = String(monster.instanceId || '').trim();
    const dgmid = String(monster.dgmid || '').trim();
    if (!instanceId || !dgmid) {
      return '';
    }
    return [USER_ID || 'nouser', instanceId, dgmid].join('|');
  }

  function normalizeQuotaRuleList(value) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map((item) => String(item || ''))
      .filter((item) => item.split('|').length >= 3);
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
        let changed = false;
        Object.keys(parsed.rules).forEach((ruleKey) => {
          const normalized = normalizeQuotaRuleList(parsed.rules[ruleKey]);
          if (normalized.length !== (Array.isArray(parsed.rules[ruleKey]) ? parsed.rules[ruleKey].length : 0)) {
            changed = true;
          }
          parsed.rules[ruleKey] = normalized;
        });
        if (changed) {
          writeQuotaState(parsed);
        }
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
    // Should never happen due to the hard-gate at the top, but stay silent if it does.
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
