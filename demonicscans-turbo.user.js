// ==UserScript==
// @name         Demonicscans Turbo Stamina Farmer
// @namespace    demonicscans-fast-bot
// @version      2.3
// @description  Turbo stamina farming bot for Demonicscans manga reader (page-safe)
// @match        https://demonicscans.org/*
// @updateURL    https://github.com/nobody65321/VeyraPersonalAddons/raw/refs/heads/main/demonicscans-turbo.user.js
// @downloadURL  https://github.com/nobody65321/VeyraPersonalAddons/raw/refs/heads/main/demonicscans-turbo.user.js
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  // ===== Only run on manga pages =====
  if (!location.pathname.startsWith("/title/")) return;

  console.log("⚡ Demonicscans TURBO bot started");

  let lastStamina = null;
  let intervalId = null;
  let stopped = false;

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const stopBot = reason => {
    if (stopped) return;
    stopped = true;
    clearInterval(intervalId);
    console.warn("🛑 BOT STOPPED:", reason);
  };

  const getNums = el => {
    if (!el) return null;
    const m = el.textContent.match(/([\d,]+)\s*\/\s*([\d,]+)/);
    return m
      ? { cur: +m[1].replace(/,/g,""), max: +m[2].replace(/,/g,"") }
      : null;
  };

  // ===== Floating Counter =====
  let counterBox = null;
  function createCounter() {
    if (counterBox) return;
    counterBox = document.createElement("div");
    Object.assign(counterBox.style, {
      position: "fixed",
      right: "15px",
      top: "80px",
      background: "#111",
      color: "#00ff66",
      padding: "10px 14px",
      borderRadius: "8px",
      fontSize: "14px",
      fontFamily: "monospace",
      zIndex: "999999",
      boxShadow: "0 0 10px rgba(0,0,0,0.5)"
    });
    counterBox.innerHTML = `
⚡ Stamina: -- / --<br>
🌾 Farmed: -- / 1000
`;
    document.body.appendChild(counterBox);
  }

  function updateCounter(stamina,farm){
    if(!counterBox) return;
    counterBox.innerHTML = `
⚡ Stamina: ${stamina ? stamina.cur : "--"} / ${stamina ? stamina.max : "--"}<br>
🌾 Farmed: ${farm ? farm.cur : "--"} / 1000
`;
  }

  // ===== Daily Cap Banner =====
  function showCapBanner(){
    if(document.getElementById("daily-cap-banner")) return;
    const banner = document.createElement("div");
    banner.id="daily-cap-banner";
    Object.assign(banner.style, {
      position:"fixed",
      top:"0",
      left:"0",
      width:"100%",
      background:"#c40000",
      color:"white",
      fontSize:"20px",
      fontWeight:"bold",
      padding:"12px",
      textAlign:"center",
      zIndex:"999999"
    });
    banner.textContent="🛑 DAILY STAMINA LIMIT REACHED (1000 / 1000)";
    document.body.appendChild(banner);
  }

  // ===== Move UI to Top =====
  function moveUIToTop(){
    const header = document.querySelector("header") || document.body.firstElementChild || document.body;

    const pills = document.querySelectorAll(".stamina-pill");
    pills.forEach(p=>{
      if(!p.dataset.moved){
        header.after(p);
        p.dataset.moved="true";
      }
    });

    const userName = document.querySelector(".user-name") || document.querySelector(".username") || document.querySelector('[class*="user"] span');
    if(userName && !userName.dataset.moved){
      header.after(userName);
      userName.dataset.moved="true";
    }

    const reactBtn = document.querySelector(".reaction");
    if(reactBtn){
      const container = reactBtn.parentElement;
      if(container && !container.dataset.moved){
        header.after(container);
        container.dataset.moved="true";
      }
    }
  }

  // ===== Logout Check =====
  const isLoggedOut = () => !document.querySelector(".stamina-pill");

  // ===== Main Loop =====
  const loop = async () => {
    if(stopped) return;

    createCounter();
    moveUIToTop();

    if(isLoggedOut()){
      stopBot("Logged out detected");
      return;
    }

    const pills=[...document.querySelectorAll(".stamina-pill")];
    const staminaEl = pills.find(p=>p.textContent.includes("Stamina"));
    const farmEl = pills.find(p=>p.textContent.includes("Farmed"));

    const stamina = getNums(staminaEl);
    const farm = getNums(farmEl);

    updateCounter(stamina,farm);

    if(!stamina){
      stopBot("Cannot read stamina");
      return;
    }

    // Daily limit
    if(farm && farm.cur >= 1000){
      showCapBanner();
      stopBot("Daily farm limit reached");
      return;
    }

    // Stamina cap
    if(lastStamina !== null && stamina.cur <= lastStamina){
      stopBot("Stamina no longer increasing");
      return;
    }

    lastStamina = stamina.cur;

    // React
    const react = document.querySelector(".reaction:not(.active-reaction)");
    if(react) react.click();

    await sleep(70);

    // Next chapter
    const next = document.querySelector('a[rel="next"]') || [...document.querySelectorAll("a")].find(a=>/next/i.test(a.textContent));
    if(!next){
      stopBot("Next chapter not found");
      return;
    }

    next.click();
  };

  intervalId = setInterval(loop,120);

})();
