// ==UserScript==
// @name         DemonicScans – Easy Account Switcher
// @namespace    https://demonicscans.org/
// @version      1.0.1
// @description  Floating draggable account switcher window on DemonicScans and make switching of account easier the credetial get stored in your local machine (phone or laptop)
// @author       You
// @match        https://demonicscans.org/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ── Storage ──────────────────────────────────────────────────────────────────
  const ACCT_KEY = 'ds_accounts';
  const POS_KEY = 'ds_float_pos';

  function getAccounts() {
    try { return JSON.parse(GM_getValue(ACCT_KEY, '[]')); } catch { return []; }
  }
  function saveAccounts(list) { GM_setValue(ACCT_KEY, JSON.stringify(list)); }
  function getSavedPos() {
    try { return JSON.parse(GM_getValue(POS_KEY, 'null')); } catch { return null; }
  }
  function savePos(x, y) { GM_setValue(POS_KEY, JSON.stringify({ x, y })); }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ── Styles ───────────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('ds-float-styles')) return;
    const s = document.createElement('style');
    s.id = 'ds-float-styles';
    s.textContent = `
      /* ── Sidebar trigger button – matches Battle Pass style ── */
      .ds-sidebar-btn {
        display: flex; align-items: center; gap: 10px;
        width: calc(100% - 20px); margin: 4px 10px;
        padding: 9px 12px; border: none; border-radius: 10px;
        background: rgba(255,255,255,0.06);
        color: #e8e8f0;
        font-size: 14px; font-family: inherit; font-weight: 500;
        cursor: pointer; text-align: left;
        transition: background 0.15s;
      }
      .ds-sidebar-btn:hover { background: rgba(255,255,255,0.11); }
      .ds-sidebar-btn-icon {
        width: 24px; height: 24px; border-radius: 6px;
        background: #e94560;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
      }
      .ds-sidebar-divider { border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 8px 12px; }

      /* ── Floating window ── */
      #ds-float-win {
        position: fixed;
        top: 80px; right: 24px;
        width: 310px;
        background: #1c1c2e;
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.55);
        z-index: 2147483646;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        color: #e8e8f0;
        user-select: none;
        overflow: hidden;
      }
      #ds-float-win.ds-hidden { display: none !important; }

      #ds-float-titlebar {
        display: flex; align-items: center; justify-content: space-between;
        padding: 10px 14px;
        background: #12122a;
        cursor: grab;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        border-radius: 12px 12px 0 0;
      }
      #ds-float-titlebar:active { cursor: grabbing; }
      #ds-float-titlebar-left { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; }
      #ds-float-titlebar-left svg { opacity: 0.7; }

      #ds-float-close {
        width: 22px; height: 22px;
        display: flex; align-items: center; justify-content: center;
        border: none; background: rgba(255,255,255,0.08);
        border-radius: 50%; color: #aaa;
        font-size: 13px; cursor: pointer; line-height: 1;
        transition: background 0.15s, color 0.15s;
        flex-shrink: 0;
      }
      #ds-float-close:hover { background: #e94560; color: #fff; }

      #ds-float-body { padding: 12px 14px 14px; user-select: text; }

      #ds-acct-list { list-style: none; margin: 0 0 12px; padding: 0; display: flex; flex-direction: column; gap: 6px; }
      .ds-acct-empty { font-size: 12px; color: #666; padding: 4px 0; }
      .ds-acct-item {
        display: flex; align-items: center; gap: 8px;
        padding: 8px 10px; border-radius: 8px;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.07);
        font-size: 13px;
      }
      .ds-acct-avatar {
        width: 30px; height: 30px; border-radius: 50%;
        background: #e94560; color: #fff;
        display: flex; align-items: center; justify-content: center;
        font-size: 13px; font-weight: 700; flex-shrink: 0;
      }
      .ds-acct-info { flex: 1; min-width: 0; }
      .ds-acct-name { display: block; font-size: 12px; font-weight: 600; color: #e8e8f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .ds-acct-user { display: block; font-size: 11px; color: #888; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .ds-use-btn {
        flex-shrink: 0; padding: 4px 9px;
        background: #e94560; color: #fff; border: none;
        border-radius: 5px; font-size: 11px; cursor: pointer;
        transition: background 0.15s;
      }
      .ds-use-btn:hover { background: #c73350; }
      .ds-del-btn {
        flex-shrink: 0; padding: 4px 7px;
        background: transparent; color: #555; border: none;
        border-radius: 5px; font-size: 12px; cursor: pointer;
        transition: background 0.15s, color 0.15s;
      }
      .ds-del-btn:hover { background: rgba(233,69,96,0.15); color: #e94560; }

      .ds-add-section { border-top: 1px solid rgba(255,255,255,0.07); padding-top: 12px; display: flex; flex-direction: column; gap: 6px; }
      .ds-add-title { font-size: 11px; color: #666; margin: 0 0 2px; letter-spacing: 0.04em; text-transform: uppercase; }
      .ds-input {
        width: 100%; box-sizing: border-box;
        padding: 7px 9px;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 6px; color: #e8e8f0;
        font-size: 12px; font-family: inherit; outline: none;
      }
      .ds-input::placeholder { color: #555; }
      .ds-input:focus { border-color: #e94560; background: rgba(255,255,255,0.08); }
      .ds-add-btn {
        align-self: flex-end;
        padding: 6px 14px; background: #e94560; color: #fff;
        border: none; border-radius: 6px; font-size: 12px;
        cursor: pointer; font-family: inherit;
        transition: background 0.15s;
      }
      .ds-add-btn:hover { background: #c73350; }
      .ds-note { font-size: 10px; color: #444; margin: 4px 0 0; }

      /* ── Blue Layered Processing Overlay ── */
      .ds-layered-overlay {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: #1a1a3a; z-index: 2147483647;
        display: flex; flex-direction: column; align-items: flex-start; justify-content: center;
        padding-left: 20%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        user-select: none; gap: 24px;
        transition: opacity 0.5s ease;
      }
      .ds-layered-status {
        font-size: 20px; font-weight: 500; display: flex; align-items: center; gap: 14px;
        transition: color 0.3s ease;
      }
      .ds-status-gray { color: #aaaaaa; }
      .ds-status-green { color: #2ecc71 !important; }

      .ds-layered-spinner {
        width: 20px; height: 20px; border: 3px solid rgba(255,255,255,0.1);
        border-top-color: inherit; border-radius: 50%;
        animation: ds-spin 0.8s linear infinite;
      }
      @keyframes ds-spin { to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(s);
  }

  // ── Floating window ──────────────────────────────────────────────────────────
  function buildFloatWindow() {
    if (document.getElementById('ds-float-win')) return;

    const win = document.createElement('div');
    win.id = 'ds-float-win';
    win.className = 'ds-hidden';
    win.setAttribute('role', 'dialog');
    win.setAttribute('aria-label', 'Account Switcher');

    win.innerHTML = `
      <div id="ds-float-titlebar">
        <div id="ds-float-titlebar-left">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          Account Switcher
        </div>
        <button id="ds-float-close" title="Close">✕</button>
      </div>
      <div id="ds-float-body">
        <ul id="ds-acct-list"></ul>
        <div class="ds-add-section">
          <p class="ds-add-title">Add account</p>
          <input id="ds-new-label"    class="ds-input" placeholder="Label (e.g. Alt)" autocomplete="off" />
          <input id="ds-new-email"    class="ds-input" placeholder="Email address" type="email" autocomplete="off" />
          <input id="ds-new-password" class="ds-input" type="password" placeholder="Password" />
          <button class="ds-add-btn" id="ds-add-btn">Add</button>
          <p class="ds-note">Stored locally in Tampermonkey only.</p>
        </div>
      </div>
    `;

    document.body.appendChild(win);

    const pos = getSavedPos();
    if (pos) {
      win.style.right = 'auto';
      win.style.left = pos.x + 'px';
      win.style.top = pos.y + 'px';
    }

    win.querySelector('#ds-float-close').addEventListener('click', () => {
      win.classList.add('ds-hidden');
    });

    win.querySelector('#ds-add-btn').addEventListener('click', () => {
      const label = win.querySelector('#ds-new-label').value.trim();
      const email = win.querySelector('#ds-new-email').value.trim();
      const password = win.querySelector('#ds-new-password').value;
      if (!email) { alert('Email is required.'); return; }
      const list = getAccounts();
      list.push({ label: label || email, email, password });
      saveAccounts(list);
      win.querySelector('#ds-new-label').value = '';
      win.querySelector('#ds-new-email').value = '';
      win.querySelector('#ds-new-password').value = '';
      renderList();
    });

    win.querySelector('#ds-acct-list').addEventListener('click', e => {
      const useBtn = e.target.closest('.ds-use-btn');
      const delBtn = e.target.closest('.ds-del-btn');
      if (useBtn) {
        const acct = getAccounts()[+useBtn.dataset.i];
        if (acct) executeActionPipeline(acct);
      }
      if (delBtn) {
        const list = getAccounts();
        const i = +delBtn.dataset.i;
        if (confirm(`Remove "${list[i].label}"?`)) {
          list.splice(i, 1);
          saveAccounts(list);
          renderList();
        }
      }
    });

    makeDraggable(win, win.querySelector('#ds-float-titlebar'));
    renderList();
  }

  function renderList() {
    const ul = document.querySelector('#ds-acct-list');
    if (!ul) return;
    const accounts = getAccounts();
    if (accounts.length === 0) {
      ul.innerHTML = '<li class="ds-acct-empty">No accounts saved yet.</li>';
      return;
    }
    ul.innerHTML = accounts.map((a, i) => `
      <li class="ds-acct-item">
        <div class="ds-acct-avatar">${esc((a.label || a.email).charAt(0).toUpperCase())}</div>
        <div class="ds-acct-info">
          <span class="ds-acct-name">${esc(a.label || a.email)}</span>
          <span class="ds-acct-user">${esc(a.email || a.username || '')}</span>
        </div>
        <button class="ds-use-btn" data-i="${i}">Use</button>
        <button class="ds-del-btn" data-i="${i}" title="Remove">✕</button>
      </li>
    `).join('');
  }

  // ── Drag ─────────────────────────────────────────────────────────────────────
  function makeDraggable(el, handle) {
    let ox = 0, oy = 0, startX = 0, startY = 0, dragging = false;

    handle.addEventListener('mousedown', e => {
      if (e.target.id === 'ds-float-close') return;
      dragging = true;
      if (el.style.left === '') {
        const rect = el.getBoundingClientRect();
        el.style.right = 'auto';
        el.style.left = rect.left + 'px';
        el.style.top = rect.top + 'px';
      }
      startX = e.clientX; startY = e.clientY;
      ox = parseInt(el.style.left) || 0;
      oy = parseInt(el.style.top) || 0;
      e.preventDefault();
    });

    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      const nx = ox + (e.clientX - startX);
      const ny = oy + (e.clientY - startY);
      el.style.left = Math.max(0, Math.min(nx, window.innerWidth - el.offsetWidth)) + 'px';
      el.style.top = Math.max(0, Math.min(ny, window.innerHeight - el.offsetHeight)) + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      savePos(parseInt(el.style.left), parseInt(el.style.top));
    });
  }

  // ── Sidebar button ───────────────────────────────────────────────────────────
  function buildSidebarBtn() {
    const menu = document.querySelector('.side-nav');
    if (!menu) {
      if ((buildSidebarBtn._r = (buildSidebarBtn._r || 0) + 1) < 15) {
        setTimeout(buildSidebarBtn, 400);
      }
      return;
    }
    if (menu.querySelector('.ds-sidebar-btn')) return;

    const hr = document.createElement('hr');
    hr.className = 'ds-sidebar-divider';

    const btn = document.createElement('button');
    btn.className = 'ds-sidebar-btn';
    btn.innerHTML = `
      <span class="ds-sidebar-btn-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
             fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      </span>
      Switch Account
    `;

    btn.addEventListener('click', () => {
      const win = document.getElementById('ds-float-win');
      if (!win) return;
      if (win.classList.contains('ds-hidden')) {
        renderList();
        win.classList.remove('ds-hidden');
      } else {
        win.classList.add('ds-hidden');
      }
    });

    menu.appendChild(hr);
    menu.appendChild(btn);
  }

  // ── Native Form UI Automation Orchestration ─────────────────────────────────
  function executeActionPipeline(acct) {
    const accountLabel = acct.label || acct.email;

    // 1. Render persistent layered layout overlay immediately over the page
    const overlay = document.createElement('div');
    overlay.id = 'ds-layered-overlay';
    overlay.className = 'ds-layered-overlay';
    overlay.innerHTML = `
      <div id="ds-step-1" class="ds-layered-status ds-status-gray">
        <span>1. signing out from existing account</span>
        <div class="ds-layered-spinner"></div>
      </div>
      <div id="ds-step-2" class="ds-layered-status ds-status-gray" style="opacity: 0.5;">
        <span>2. signing in from account with username ${esc(accountLabel)}</span>
        <div class="ds-layered-spinner" style="display: none;"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    const step1El = overlay.querySelector('#ds-step-1');
    const step2El = overlay.querySelector('#ds-step-2');

    // 2. Setup a single shared worker iframe instance to navigate the target endpoints natively
    const workerFrame = document.createElement('iframe');
    workerFrame.name = 'ds_shared_pipeline_frame';
    workerFrame.style.width = '0px';
    workerFrame.style.height = '0px';
    workerFrame.style.border = 'none';
    workerFrame.style.position = 'absolute';
    workerFrame.style.visibility = 'hidden';
    document.body.appendChild(workerFrame);

    let pipelineStage = 1;

    // Direct frame to signout.php to clear existing session state cookies cleanly
    workerFrame.src = 'https://demonicscans.org/signout.php';

    // Watch progression events inside the sandboxed iframe container
    workerFrame.addEventListener('load', () => {
      if (pipelineStage === 1) {
        // === STEP 1 COMPLETE (SIGNOUT RENDERED NATIVELY BY THE BROWSER) ===
        step1El.className = 'ds-layered-status ds-status-green';
        step1El.innerHTML = `<span>1. signing out from existing account ✓</span>`;

        // Advance configuration stage and unlock step 2 display visibility metrics
        pipelineStage = 2;
        step2El.style.opacity = '1';
        step2El.querySelector('.ds-layered-spinner').style.display = 'block';

        // Redirect the execution worker frame directly onto the signin page view
        workerFrame.src = 'https://demonicscans.org/signin.php';

      } else if (pipelineStage === 2) {
        // === STEP 2 INITIALIZED (SIGNIN PAGE LOADED INSIDE FRAME) ===
        pipelineStage = 3;

        let pollIntervalCounter = 40;

        // Poll frame dynamically to prevent race conditions during rendering cycles
        const frameInputCheckTimer = setInterval(() => {
          try {
            const frameDoc = workerFrame.contentDocument || workerFrame.contentWindow.document;
            if (!frameDoc) return;

            // Target fields configurations verified via your exact DOM structure screenshot
            const emailInput = frameDoc.querySelector('input[name="email"]');
            const passInput = frameDoc.querySelector('input[name="password"]');
            const submitBtn = frameDoc.querySelector('input[type="submit"][name="submit"]');

            if (emailInput && passInput && submitBtn) {
              clearInterval(frameInputCheckTimer);

              // Programmatically populate form elements inside the iframe scope context
              emailInput.value = acct.email || acct.username || '';
              passInput.value = acct.password;

              // Fire standard event updates to notify potential scripts running on the platform backend
              emailInput.dispatchEvent(new Event('input', { bubbles: true }));
              passInput.dispatchEvent(new Event('input', { bubbles: true }));

              // Trigger real click on the physical hardware element node to force a true POST request sequence
              submitBtn.click();
            } else {
              pollIntervalCounter--;
              if (pollIntervalCounter <= 0) {
                clearInterval(frameInputCheckTimer);
                step2El.innerHTML = `<span style="color: #e94560;">Error: Form interface rendering timeout.</span>`;
                workerFrame.remove();
              }
            }
          } catch (err) {
            clearInterval(frameInputCheckTimer);
            console.error('[Automation Framework Catch]:', err);
            step2El.innerHTML = `<span style="color: #e94560;">Error: Direct sandbox security restriction.</span>`;
            workerFrame.remove();
          }
        }, 150);

      } else if (pipelineStage === 3) {
        // === STEP 2 COMPLETE (AUTHENTICATED HOME RESPONSE JUMPED NATIVELY) ===
        step2El.className = 'ds-layered-status ds-status-green';
        step2El.innerHTML = `<span>2. signing in from account with username ${esc(accountLabel)} ✓</span>`;

        // Clear layout elements clean from parent trees
        setTimeout(() => {
          workerFrame.remove();
        }, 100);

        // Smooth fade overlay layout layer away, then apply active window refresh
        setTimeout(() => {
          overlay.style.opacity = '0';
          setTimeout(() => {
            overlay.remove();
            window.location.reload();
          }, 500);
        }, 1000);
      }
    });
  }

  // ── Init ─────────────────────────────────────────────────────────────────────
  function init() {
    injectStyles();
    buildFloatWindow();
    buildSidebarBtn();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();