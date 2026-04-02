// ==UserScript==
// @name         Demonicscans PvP Auto Bot
// @namespace    demonicscans-pvp-bot
// @version      1.2
// @description  Auto join solo PvP and leave when battle ends
// @match        https://demonicscans.org/*
// @grant        none
// @updateURL    https://github.com/nobody65321/VeyraPersonalAddons/raw/refs/heads/main/demonicscans-pvp.user.js
// @downloadURL  https://github.com/nobody65321/VeyraPersonalAddons/raw/refs/heads/main/demonicscans-pvp.user.js
// ==/UserScript==

(function() {
    'use strict';

    if (!location.hostname.includes("demonicscans.org")) return;

    // Toggle button
    let botEnabled = false;

    const btn = document.createElement('button');
    btn.textContent = "PvP Auto";
    Object.assign(btn.style, {
        position: "fixed",
        top: "10px",
        right: "10px",
        zIndex: 9999,
        padding: "10px",
        backgroundColor: "#3498db",
        color: "#fff",
        border: "none",
        borderRadius: "5px",
        cursor: "pointer"
    });
    btn.onclick = () => {
        botEnabled = !botEnabled;
        btn.style.backgroundColor = botEnabled ? "#2ecc71" : "#3498db";
        console.log("PvP Bot Enabled:", botEnabled);
    };
    document.body.appendChild(btn);

    const checkPvP = () => {
        if(!botEnabled) return;

        const statusBadge = document.getElementById("matchStatusBadge");
        if(statusBadge && (/victory/i.test(statusBadge.textContent))){
            const backBtn = document.querySelector('a.back-btn[href*="pvp.php"]');
            if(backBtn){
                console.log("⬅️ Leaving finished battle");
                backBtn.click();
            }
        }

        const joinBtn = document.querySelector('.js-matchmake[data-ladder="solo"]');
        if(joinBtn){
            console.log("➡️ Joining solo PvP match");
            joinBtn.click();
        }
    };

    setInterval(checkPvP, 500); // check twice per second
})();
