// ==UserScript==
// @name         Veyra Shadowbridge Warrens Monster Board
// @namespace    https://demonicscans.org/
// @version      1.0.5
// @description  Show every monster from each Shadowbridge Warrens room on the main dungeon map page.
// @match        *://demonicscans.org/*
// @match        *://www.demonicscans.org/*
// @homepageURL  https://github.com/nobody65321/VeyraPersonalAddons
// @updateURL    https://raw.githubusercontent.com/nobody65321/VeyraPersonalAddons/main/D1%20Quota.user.js
// @downloadURL  https://raw.githubusercontent.com/nobody65321/VeyraPersonalAddons/main/D1%20Quota.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const DUNGEON_NAME = 'Shadowbridge Warrens';
  const PANEL_ID = 'tm-shadowbridge-monster-board';
  const STYLE_ID = 'tm-shadowbridge-monster-board-style';
  const QUOTA_STORAGE_KEY = 'tm_shadowbridge_daily_rule_usage_v2';
  const DAMAGE_MODEL_KEY = 'tm_shadowbridge_damage_model_v1';
  const DAMAGE_CACHE_KEY = 'tm_shadowbridge_damage_cache_v1';
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
    { item: 'Full Stamina Potion', nameIncludes: 'gribble', locationIncludes: ['plunder warrens', 'territory center'], maxTargets: 1, targetDamage: 1000000 }
  ];

  if (!isMainDungeonPage()) {
    return;
  }

  injectStyles();
  init().catch((error) => {
    console.error('[TM Shadowbridge]', error);
    renderError(`Failed to load monster list: ${error.message || error}`);
  });

  function isMainDungeonPage() {
    const title = (document.title || '').toLowerCase();
    if (!title.includes(DUNGEON_NAME.toLowerCase())) {
      return false;
    }

    return Array.from(document.querySelectorAll('a.pin[href*="guild_dungeon_location.php"]')).length > 0;
  }

  async function init() {
    const mapPanel = document.querySelector('.mapframe')?.closest('.panel');
    const mapWrap = document.querySelector('.mapwrap');
    const pins = Array.from(document.querySelectorAll('a.pin[href*="guild_dungeon_location.php"]'))
      .filter((pin) => !pin.classList.contains('locked'));

    if (!mapPanel || !mapWrap || pins.length === 0) {
      throw new Error('Could not find the dungeon map or location pins.');
    }

    const board = createBoardShell(pins.length);
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
        <button type="button" class="btn tm-sbw-refresh">Refresh</button>
      </div>
      <div class="tm-sbw-summary"></div>
      <div class="tm-sbw-mapdots"></div>
      <div class="tm-sbw-qol">
        <div class="tm-sbw-qol-top">
          <div class="tm-sbw-filters">
            <span class="tm-sbw-title">Shadowbridge Multi Select</span>
            <div class="tm-sbw-select-wrap">
              <select class="tm-sbw-modern-select" data-role="name-filter">
                <option value="">All monsters</option>
              </select>
            </div>
            <label><input type="checkbox" data-role="alive-filter" checked> Alive</label>
            <label><input type="checkbox" data-role="dead-filter" checked> Dead</label>
            <label><input type="checkbox" data-role="joined-filter" checked> Joined</label>
            <label><input type="checkbox" data-role="unjoined-filter" checked> Unjoined</label>
            <div class="tm-sbw-select-actions">
              <button class="btn" type="button" data-role="select-visible">Select visible</button>
              <button class="btn" type="button" data-role="clear-selected">Clear</button>
            </div>
          </div>
        </div>
        <div class="tm-sbw-location-filter">
          <div class="tm-sbw-mini-actions">
            <span data-role="loc-all">Select all rooms</span>
            <span data-role="loc-none">None</span>
          </div>
          <div class="tm-sbw-location-chips" data-role="location-chips"></div>
        </div>
        <div class="tm-sbw-selection-bar">
          <span class="tm-sbw-selected-count" data-role="selected-count">0 selected</span>
          <div class="tm-sbw-attack-controls">
            <input class="tm-sbw-stam-input" data-role="stam-input" type="number" min="1" step="1" value="1">
            <button class="btn tm-sbw-stam-preset" type="button" data-role="stam-preset" data-stam="1">1</button>
            <button class="btn tm-sbw-stam-preset" type="button" data-role="stam-preset" data-stam="10">10</button>
            <button class="btn tm-sbw-stam-preset" type="button" data-role="stam-preset" data-stam="50">50</button>
            <button class="btn tm-sbw-stam-preset" type="button" data-role="stam-preset" data-stam="100">100</button>
            <button class="btn tm-sbw-stam-preset" type="button" data-role="stam-preset" data-stam="200">200</button>
            <button class="btn" type="button" data-role="damage-test">DMG Test</button>
            <button class="btn" type="button" data-role="one-hit-quota">Fill Quota</button>
            <button class="btn" type="button" data-role="fill-all-quotas">Fill All Quotas</button>
            <button class="btn" type="button" data-role="attack-selected">Quick Join & Attack</button>
            <button class="btn" type="button" data-role="open-selected">Open selected</button>
          </div>
        </div>
        <div class="tm-sbw-model-line" data-role="damage-model-line"></div>
        <div class="tm-sbw-run-line" data-role="run-line"></div>
        <div class="tm-sbw-multi-select-box" data-role="monster-grid"></div>
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

  function renderBoard(board, mapWrap, locations) {
    const summary = board.querySelector('.tm-sbw-summary');
    const dots = board.querySelector('.tm-sbw-mapdots');
    const nameFilter = board.querySelector('[data-role="name-filter"]');
    const locationChips = board.querySelector('[data-role="location-chips"]');

    const allMonsters = locations.flatMap((location) => location.monsters);
    const aliveCount = allMonsters.filter((monster) => !monster.dead).length;
    const deadCount = allMonsters.length - aliveCount;

    summary.innerHTML = [
      summaryPill(`${locations.length} locations loaded`),
      summaryPill(`${allMonsters.length} monsters found`),
      summaryPill(`${aliveCount} alive`, 'alive'),
      summaryPill(`${deadCount} dead`, 'dead')
    ].join('');

    dots.innerHTML = '';
    mapWrap.querySelectorAll('.tm-sbw-dot').forEach((node) => node.remove());
    mapWrap.style.position = mapWrap.style.position || 'relative';
    locations.forEach((location) => {
      const marker = document.createElement('button');
      marker.type = 'button';
      marker.className = 'tm-sbw-dot';
      marker.style.left = location.left;
      marker.style.top = location.top;
      marker.title = `${location.locationName}: ${location.monsters.length} monsters`;
      marker.textContent = String(location.monsters.length);
      marker.addEventListener('click', () => {
        const roomChecks = Array.from(board.querySelectorAll('.tm-sbw-room-check'));
        roomChecks.forEach((checkbox) => {
          checkbox.checked = checkbox.value === location.key;
        });
        board.querySelector('.tm-sbw-location-filter')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        board.querySelector('.tm-sbw-room-check')?.dispatchEvent(new Event('change', { bubbles: true }));
      });
      mapWrap.appendChild(marker);
    });

    nameFilter.innerHTML = [
      '<option value="">All monsters</option>',
      ...Array.from(new Set(allMonsters.map((monster) => monster.name))).sort((a, b) => a.localeCompare(b)).map(
        (name) => `<option value="${escapeHtml(name.toLowerCase())}">${escapeHtml(name)}</option>`
      )
    ].join('');

    locationChips.innerHTML = locations
      .map(
        (location) => `
          <label class="tm-sbw-chip">
            <input type="checkbox" class="tm-sbw-room-check" value="${escapeHtml(location.key)}" checked>
            <span>${escapeHtml(location.locationName)} <strong>${location.monsters.length}</strong></span>
          </label>
        `
      )
      .join('');

    attachBoardBehavior(board, locations);
    board.querySelector('.tm-sbw-sub').textContent = 'Pulled live monster cards from each room page.';
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
      aliveFilter: board.querySelector('[data-role="alive-filter"]'),
      deadFilter: board.querySelector('[data-role="dead-filter"]'),
      joinedFilter: board.querySelector('[data-role="joined-filter"]'),
      unjoinedFilter: board.querySelector('[data-role="unjoined-filter"]'),
      monsterGrid: board.querySelector('[data-role="monster-grid"]'),
      selectedCount: board.querySelector('[data-role="selected-count"]'),
      openSelected: board.querySelector('[data-role="open-selected"]'),
      attackSelected: board.querySelector('[data-role="attack-selected"]'),
      damageTest: board.querySelector('[data-role="damage-test"]'),
      oneHitQuota: board.querySelector('[data-role="one-hit-quota"]'),
      fillAllQuotas: board.querySelector('[data-role="fill-all-quotas"]'),
      stamInput: board.querySelector('[data-role="stam-input"]'),
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
      controls.selectedCount.textContent = `${selected.size} selected`;
      controls.openSelected.disabled = selected.size === 0;
      controls.attackSelected.disabled = selected.size === 0;
      controls.oneHitQuota.disabled = !damageModel.hasEstimate();
      controls.fillAllQuotas.disabled = !damageModel.hasEstimate();
      controls.damageModelLine.textContent = `Non-crit estimate: ${damageModel.describe()}`;
      if (!controls.runLine.dataset.busy) {
        controls.runLine.textContent = '';
      }
    };

    hydratePersonalDamage(allMonsters, render).catch((error) => {
      console.error('[TM Shadowbridge damage hydrate]', error);
    });

    board.querySelectorAll('.tm-sbw-room-check').forEach((checkbox) => {
      checkbox.addEventListener('change', render);
    });

    ['change', 'input'].forEach((eventName) => {
      controls.nameFilter.addEventListener(eventName, render);
      controls.aliveFilter.addEventListener(eventName, render);
      controls.deadFilter.addEventListener(eventName, render);
      controls.joinedFilter.addEventListener(eventName, render);
      controls.unjoinedFilter.addEventListener(eventName, render);
    });

    board.querySelectorAll('[data-role="stam-preset"]').forEach((button) => {
      button.addEventListener('click', () => {
        controls.stamInput.value = button.getAttribute('data-stam') || '1';
      });
    });

    board.querySelector('[data-role="select-visible"]')?.addEventListener('click', () => {
      getVisibleMonsters(board, allMonsters).forEach((monster) => selected.add(monster.id));
      render();
    });

    board.querySelector('[data-role="clear-selected"]')?.addEventListener('click', () => {
      selected.clear();
      render();
    });

    board.querySelector('[data-role="loc-all"]')?.addEventListener('click', () => {
      board.querySelectorAll('.tm-sbw-room-check').forEach((checkbox) => {
        checkbox.checked = true;
      });
      render();
    });

    board.querySelector('[data-role="loc-none"]')?.addEventListener('click', () => {
      board.querySelectorAll('.tm-sbw-room-check').forEach((checkbox) => {
        checkbox.checked = false;
      });
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
      controls.selectedCount.textContent = `${selected.size} selected`;
      controls.openSelected.disabled = selected.size === 0;
      controls.attackSelected.disabled = selected.size === 0;
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
          const result = await quickJoinAndAttack(target, 1);
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

      const results = [];
      let success = 0;
      let failed = 0;
      controls.oneHitQuota.disabled = true;
      controls.fillAllQuotas.disabled = true;
      controls.oneHitQuota.textContent = 'Running...';
      controls.fillAllQuotas.textContent = 'Running...';
      controls.runLine.dataset.busy = '1';
      controls.runLine.textContent = `Starting quota fill for ${candidates.length} monster(s)...`;

      for (let index = 0; index < candidates.length; index += 1) {
        const monster = candidates[index];
        const liveUsageMap = getRuleUsageMap();
        if (monster.limitRule && hasReachedLimit(monster, liveUsageMap)) {
          results.push({
            id: monster.dgmid || monster.name,
            ok: false,
            html: `Skipped: quota/cap reached<br>${escapeHtml(buildLimitSummary(monster, liveUsageMap, allMonsters))}`
          });
          controls.runLine.textContent = `Skipping ${monster.name} in ${monster.locationName} (${index + 1}/${candidates.length}) because quota/cap is already reached.`;
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
              controls.runLine.textContent = `Stopping ${monster.name} in ${monster.locationName}: quota/cap reached after ${hitCount} hit(s).`;
              break;
            }

            const currentRemaining = monster.limitRule
              ? Math.max(0, monster.limitRule.targetDamage - Number(monster.personalDamage || 0))
              : 0;
            const currentHp = parseCurrentHp(monster.hp);
            const pick = pickBestQuotaStamina(currentRemaining, estimate, currentHp);
            const chosenStamina = pick.stamina;
            const chosenEstimate = pick.estimatedDamage;
            controls.runLine.textContent = `Attacking ${monster.name} in ${monster.locationName} (${index + 1}/${candidates.length}) with ${chosenStamina} stam. Hit ${hitCount + 1}, current ${formatDamage(monster.personalDamage)}, left ${formatDamage(currentRemaining)}.`;

            const result = await quickJoinAndAttack(monster, chosenStamina);
            if (!result.ok) {
              if (isRetryableAttackFailure(result)) {
                stopReason = 'cooldown wait';
                controls.runLine.textContent = `Waiting on cooldown for ${monster.name} in ${monster.locationName} before retrying...`;
                await delay(ATTACK_GAP_MS);
                continue;
              }
              failed += 1;
              results.push(result);
              stopReason = 'attack failed';
              controls.runLine.textContent = `Attack failed on ${monster.name} in ${monster.locationName}.`;
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
              controls.runLine.textContent = `Finished ${monster.name} in ${monster.locationName}: now at ${formatDamage(monster.personalDamage)}.`;
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
          controls.runLine.textContent = `Unexpected error while filling ${monster.name} in ${monster.locationName}.`;
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
      controls.fillAllQuotas.disabled = !damageModel.hasEstimate();
      controls.oneHitQuota.textContent = 'Fill Quota';
      controls.fillAllQuotas.textContent = 'Fill All Quotas';
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
      await runFillQuota(candidates);
    });

    controls.fillAllQuotas.addEventListener('click', async () => {
      const candidates = allMonsters.filter((monster) =>
        monster.limitRule &&
        monster.actionUrl &&
        monster.dgmid &&
        monster.instanceId &&
        !monster.dead
      );
      await runFillQuota(candidates);
    });

    controls.attackSelected.addEventListener('click', async () => {
      const staminaCost = Math.max(1, parseInt(controls.stamInput.value || '1', 10) || 1);
      const candidates = allMonsters.filter((monster) =>
        selected.has(monster.id) &&
        monster.actionUrl &&
        monster.dgmid &&
        monster.instanceId &&
        !monster.dead
      );
      const skippedByLimit = [];

      if (candidates.length === 0) {
        openAttackModal(board, {
          processed: skippedByLimit.length,
          success: 0,
          failed: skippedByLimit.length === 0 ? 0 : skippedByLimit.length,
          results: skippedByLimit.length
            ? skippedByLimit.map((monster) => ({
                id: monster.dgmid || monster.name,
                ok: false,
                html: `Skipped: target reached for ${escapeHtml(monster.name)} (${escapeHtml(monster.locationName)})<br>Target: ${escapeHtml(formatDamage(monster.limitRule.targetDamage))} | Current: ${escapeHtml(formatDamage(monster.personalDamage))}`
              }))
            : [{ id: '-', ok: false, html: 'No live selected monsters with valid battle links were found.' }]
        });
        return;
      }

      controls.attackSelected.disabled = true;
      controls.attackSelected.textContent = 'Working...';

      const results = [];
      let success = 0;
      let failed = 0;
      let processedCount = 0;

      for (const monster of candidates) {
        const liveUsageMap = getRuleUsageMap();
        if (monster.limitRule && hasReachedLimit(monster, liveUsageMap)) {
          skippedByLimit.push({
            id: monster.dgmid || monster.name,
            ok: false,
            html: `Skipped: target reached for ${escapeHtml(monster.name)} (${escapeHtml(monster.locationName)})<br>${escapeHtml(buildLimitSummary(monster, liveUsageMap, allMonsters))}`
          });
          continue;
        }

        processedCount += 1;
        controls.selectedCount.textContent = `${selected.size} selected | attacking ${processedCount}/${candidates.length}`;
        try {
          const result = await quickJoinAndAttack(monster, staminaCost);
          if (result.ok) {
            results.push(result);
            quotaStore.mark(monster);
            const nextDamage = Number(monster.personalDamage || 0) + Number(result.damageDelta || 0);
            monster.personalDamage = Math.max(nextDamage, Number(monster.personalDamage || 0));
            damageCache.set(monster, monster.personalDamage);
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
            id: monster.dgmid,
            ok: false,
            html: `Join: Failed<br>Attack: ${escapeHtml(error.message || 'Server error')}`
          });
        }
        await delay(ATTACK_GAP_MS);
      }

      openAttackModal(board, {
        processed: processedCount + skippedByLimit.length,
        success,
        failed: failed + skippedByLimit.length,
        results: results.concat(
          skippedByLimit
        )
      });

      controls.attackSelected.disabled = selected.size === 0;
      controls.attackSelected.textContent = 'Quick Join & Attack';
      controls.selectedCount.textContent = `${selected.size} selected`;
    });

    render();
  }

  function getVisibleMonsters(board, monsters) {
    const selectedRooms = new Set(
      Array.from(board.querySelectorAll('.tm-sbw-room-check:checked')).map((checkbox) => checkbox.value)
    );
    const showAlive = board.querySelector('[data-role="alive-filter"]')?.checked;
    const showDead = board.querySelector('[data-role="dead-filter"]')?.checked;
    const showJoined = board.querySelector('[data-role="joined-filter"]')?.checked;
    const showUnjoined = board.querySelector('[data-role="unjoined-filter"]')?.checked;
    const nameFilter = (board.querySelector('[data-role="name-filter"]')?.value || '').trim();

    return monsters.filter((monster) => {
      if (!selectedRooms.has(monster.locationKey)) {
        return false;
      }
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
                <span class="tm-sbw-badge">${escapeHtml(monster.locationName)}</span>
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
            <a class="btn tm-sbw-action" href="${escapeHtml(monster.roomUrl)}">Room</a>
          </div>
        </div>
      </label>
    `;
  }

  async function quickJoinAndAttack(monster, staminaCost) {
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
      skill_id: '0',
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
      if (quotaStore.has(monster)) {
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

    board.innerHTML = `<div class="h">All Shadowbridge Monsters</div><div class="tm-sbw-error">${escapeHtml(message)}</div>`;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .tm-sbw-board {
        margin-top: 14px;
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
        const ruleList = state.rules[monster.limitRule.ruleKey] || [];
        return ruleList.includes(monster.id);
      },
      mark(monster) {
        ensureCurrentCycle();
        if (!monster.limitRule) {
          return;
        }
        const ruleKey = monster.limitRule.ruleKey;
        const ruleList = state.rules[ruleKey] || [];
        if (!ruleList.includes(monster.id)) {
          ruleList.push(monster.id);
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
