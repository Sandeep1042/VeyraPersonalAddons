// ==UserScript==
// @name         Demonicscans PvP Auto Bot
// @namespace    demonicscans-pvp-bot
// @version      1.3
// @description  Auto PvP bot for Demonicscans (page-safe)
// @match        https://demonicscans.org/pvp.php
// @match        https://demonicscans.org/pvp_battle.php
// @updateURL    https://github.com/nobody65321/VeyraPersonalAddons/raw/refs/heads/main/demonicscans-pvp.user.js
// @downloadURL  https://github.com/nobody65321/VeyraPersonalAddons/raw/refs/heads/main/demonicscans-pvp.user.js
// @grant        none
// ==/UserScript==

(() => {
    'use strict';

    // ===== Page-Safe Check =====
    const allowedPaths = ['/pvp.php', '/pvp_battle.php'];
    if (!allowedPaths.includes(location.pathname)) return;

    console.log("⚡ Demonicscans PvP Bot Active");

    // ===== Button to Turn Bot On/Off =====
    let botEnabled = false;
    const button = document.createElement('button');
    button.textContent = "Toggle PvP Bot";
    Object.assign(button.style, {
        position: 'fixed',
        top: '10px',
        right: '10px',
        zIndex: 9999,
        padding: '10px',
        backgroundColor: '#8e44ad',
        color: '#fff',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer'
    });
    button.onclick = () => {
        botEnabled = !botEnabled;
        console.log("PvP Bot Enabled:", botEnabled);
        button.style.backgroundColor = botEnabled ? '#27ae60' : '#8e44ad';
    };
    document.body.appendChild(button);

    // ===== Main Loop =====
    const checkLoop = async () => {
        if (!botEnabled) return;

        // Check battle status
        const statusBadge = document.querySelector('#matchStatusBadge');
        const battleOver = statusBadge && /victory/i.test(statusBadge.textContent);

        if (battleOver) {
            console.log("⬅️ Battle finished, clicking Back...");
            const backBtn = document.querySelector('a.back-btn[href*="pvp.php"]');
            if (backBtn) backBtn.click();
            return;
        }

        // If on PvP selection page, auto-join solo match
        if (location.pathname === '/pvp.php') {
            const soloBtn = document.querySelector('button.js-matchmake[data-ladder="solo"]');
            if (soloBtn) {
                console.log("➡️ Joining Solo PvP Match...");
                soloBtn.click();
            }
        }
    };

    setInterval(checkLoop, 500); // check every 0.5s
})();
