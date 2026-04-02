// ==UserScript==
// @name         Demonicscans PvP Bot
// @namespace    demonicscans-pvp-bot
// @version      2.4
// @description  Auto joins solo PvP, enables Auto Play, and leaves finished matches.
// @match        https://demonicscans.org/pvp.php*
// @match        https://demonicscans.org/pvp_battle.php*
// @homepageURL  https://github.com/nobody65321/VeyraPersonalAddons
// @updateURL    https://raw.githubusercontent.com/nobody65321/VeyraPersonalAddons/main/demonicscans-pvp.user.js
// @downloadURL  https://raw.githubusercontent.com/nobody65321/VeyraPersonalAddons/main/demonicscans-pvp.user.js
// @grant        none
// ==/UserScript==

(() => {
    'use strict';

    const STORAGE_KEY = 'pvpBotActive';
    const LAST_ACTION_KEY = 'pvpBotLastActionAt';
    const ACTION_GAP_MS = 1500;
    const LOBBY_RETRY_MS = 5000;
    const BATTLE_RETRY_MS = 1000;

    const isActive = () => localStorage.getItem(STORAGE_KEY) === 'true';

    const setActive = (value) => {
        localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
    };

    const now = () => Date.now();

    const canAct = () => {
        const last = Number(localStorage.getItem(LAST_ACTION_KEY) || 0);
        return (now() - last) >= ACTION_GAP_MS;
    };

    const markActed = () => {
        localStorage.setItem(LAST_ACTION_KEY, String(now()));
    };

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const setStatus = (message) => {
        const el = document.getElementById('pvpBotStatus');
        if (el) {
            el.textContent = message;
        }
        console.log('[PvP Bot]', message);
    };

    const toggle = () => {
        setActive(!isActive());
        location.reload();
    };

    const renderToggle = () => {
        if (document.getElementById('pvpBotWrap')) {
            return;
        }

        const wrap = document.createElement('div');
        wrap.id = 'pvpBotWrap';
        Object.assign(wrap.style, {
            position: 'fixed',
            top: '84px',
            right: '10px',
            zIndex: '99999',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            minWidth: '180px',
            padding: '10px',
            background: 'rgba(14, 18, 26, 0.94)',
            border: '1px solid rgba(124, 255, 184, 0.28)',
            borderRadius: '10px',
            boxShadow: '0 12px 28px rgba(0,0,0,0.35)',
            color: '#e6e9ff',
            fontSize: '12px'
        });

        const button = document.createElement('button');
        button.id = 'pvpBotToggle';
        button.type = 'button';
        button.textContent = isActive() ? 'PvP Bot ON' : 'PvP Bot OFF';
        Object.assign(button.style, {
            padding: '8px 10px',
            background: isActive() ? '#1f9d63' : '#963838',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '700'
        });
        button.addEventListener('click', toggle);

        const status = document.createElement('div');
        status.id = 'pvpBotStatus';
        status.textContent = isActive() ? 'Watching page...' : 'Bot is idle.';
        status.style.lineHeight = '1.35';
        status.style.color = '#c7cbdf';

        wrap.appendChild(button);
        wrap.appendChild(status);
        document.body.appendChild(wrap);
    };

    const clickIfPossible = (element, reason) => {
        if (!element || element.disabled || !canAct()) {
            return false;
        }
        markActed();
        setStatus(reason);
        element.click();
        return true;
    };

    const textIncludes = (element, value) => {
        return !!element && String(element.textContent || '').toLowerCase().includes(String(value || '').toLowerCase());
    };

    const battleEnded = () => {
        const badge = document.getElementById('matchStatusBadge');
        const note = document.getElementById('noteText');
        const rewardsModal = document.getElementById('rewardsModal');

        if (badge && /victory|battle ended/i.test(badge.textContent || '')) {
            return true;
        }
        if (note && /won this season match|battle ended|season match ended/i.test(note.textContent || '')) {
            return true;
        }
        if (rewardsModal && rewardsModal.classList.contains('show')) {
            return true;
        }
        return false;
    };

    const autoPlayEnabled = () => {
        const autoBtn = document.getElementById('autoPlayBtn');
        return !!autoBtn && (autoBtn.classList.contains('active') || textIncludes(autoBtn, 'on'));
    };

    const handleLobby = async () => {
        const soloBtn = document.querySelector('.js-matchmake[data-ladder="solo"]');
        if (soloBtn && !soloBtn.disabled) {
            if (clickIfPossible(soloBtn, 'Joining solo PvP match...')) {
                return;
            }
        }

        setStatus('Waiting for solo match button...');
        await sleep(LOBBY_RETRY_MS);
        if (isActive()) {
            location.reload();
        }
    };

    const handleBattle = async () => {
        const backBtn = document.querySelector('a.back-btn[href*="pvp.php"], a[href="pvp.php"], a[href="/pvp.php"]');
        const autoBtn = document.getElementById('autoPlayBtn');

        if (battleEnded()) {
            if (clickIfPossible(backBtn, 'Battle finished, leaving to PvP lobby...')) {
                return;
            }
            setStatus('Battle finished, waiting to leave...');
            return;
        }

        if (autoBtn && !autoBtn.disabled && !autoPlayEnabled()) {
            if (clickIfPossible(autoBtn, 'Enabling Auto Play...')) {
                return;
            }
        }

        if (autoPlayEnabled()) {
            setStatus('Auto Play running...');
        } else if (autoBtn && autoBtn.disabled) {
            setStatus('Waiting for battle controls...');
        } else {
            setStatus('Waiting for battle state...');
        }

        await sleep(BATTLE_RETRY_MS);
    };

    const loop = async () => {
        while (true) {
            if (!isActive()) {
                setStatus('Bot is idle.');
                await sleep(1000);
                continue;
            }

            if (/\/pvp\.php(?:\?|$)/i.test(location.pathname + location.search)) {
                await handleLobby();
                continue;
            }

            if (/\/pvp_battle\.php(?:\?|$)/i.test(location.pathname + location.search)) {
                await handleBattle();
                continue;
            }

            setStatus('Unsupported page for PvP bot.');
            await sleep(1500);
        }
    };

    renderToggle();
    loop();
})();
