import { t } from './translations.js';
import { getCoins, addCoins, getBoosterCount } from './economy.js';
import { closeShop } from './shop.js';
import { isTutorialActive, setTutorialActive } from './tutorialState.js';

// Re-export so existing consumers (main.js) keep a single import point
export { isTutorialActive, setTutorialActive } from './tutorialState.js';

// ======================== HELPERS ========================
function tipHTML(icon, text) {
  return `<div class="booster-tutorial-tip-icon">${icon}</div><p>${text}</p>`;
}

// ======================== BOOSTER TUTORIALS ========================
// Tutorial levels match unlockLevel in economy.js SHOP_BOOSTERS
// Prices match shop prices so the player always gets enough coins to buy
export const BOOSTER_TUTORIALS = [
  {
    level: 6,
    boosterId: 'sniper',
    price: 100,
    icon: '🎯',
    name: 'Sniper',
    tipKey: 'tutorial_sniper_tip',
  },
  {
    level: 10,
    boosterId: 'shuffle',
    price: 150,
    icon: '🔀',
    name: 'Shuffle',
    tipKey: 'tutorial_shuffle_tip',
  },
  {
    level: 16,
    boosterId: 'magic_brush',
    price: 250,
    icon: '🖌️',
    name: 'Magic Brush',
    tipKey: 'tutorial_magic_brush_tip',
  },
  {
    level: 21,
    boosterId: 'bomb',
    price: 350,
    icon: '💣',
    name: 'Bomb',
    tipKey: 'tutorial_bomb_tip',
  },
  {
    level: 26,
    boosterId: 'color_bomb',
    price: 500,
    icon: '🌈',
    name: 'Color Bomb',
    tipKey: 'tutorial_color_bomb_tip',
  },
];

let currentTutorialPhase = 'select'; // 'select' | 'pop'

export function abortActiveTutorial() {
  setTutorialActive(false);

  if (window._currentTutorialCleanup) {
    window._currentTutorialCleanup();
    window._currentTutorialCleanup = null;
  }

  // Extra aggressive: remove any known overlay IDs that might block input
  document.getElementById('strict-tutorial-overlay')?.remove();
  document.querySelectorAll('.booster-tutorial-tip').forEach((t) => t.remove());
  document.querySelectorAll('.tutorial-hand-indicator').forEach((h) => h.remove());
  hideTutorialDialog();
}

export function checkBoosterTutorial(levelNum, callbacks) {
  const tutorial = BOOSTER_TUTORIALS.find((t) => t.level === levelNum);
  if (!tutorial) return;

  const doneKey = `boosterTutorial_${tutorial.boosterId}_done`;
  if (localStorage.getItem(doneKey)) return;

  // Give enough coins to buy the booster
  addCoins(tutorial.price);
  if (callbacks.updateHeaderCoins) callbacks.updateHeaderCoins();

  // Start the strict modal tutorial
  startStrictBoosterTutorial(tutorial, callbacks);
}

export function startStrictBoosterTutorial(tutorial, callbacks) {
  const { renderShopItems, renderPowerups } = callbacks;
  setTutorialActive(true);

  // Step timeout: if player doesn't interact within 10s, exit gracefully
  let _stepTimer = null;
  const resetStepTimeout = () => {
    if (_stepTimer) clearTimeout(_stepTimer);
    _stepTimer = setTimeout(() => {
      cleanupTutorial();
      localStorage.setItem(`boosterTutorial_${tutorial.boosterId}_done`, 'true');
    }, 10000);
  };
  const clearStepTimeout = () => {
    if (_stepTimer) {
      clearTimeout(_stepTimer);
      _stepTimer = null;
    }
  };

  // Create overlay for darkening grid
  const overlay = document.createElement('div');
  overlay.id = 'strict-tutorial-overlay';
  document.getElementById('game-container').appendChild(overlay);

  const step1Tip = document.createElement('div');
  step1Tip.className = 'booster-tutorial-tip';
  step1Tip.innerHTML = tipHTML(tutorial.icon, t(tutorial.tipKey));
  step1Tip.style.pointerEvents = 'none';
  document.getElementById('game-container').appendChild(step1Tip);

  // Global indicator and interceptor
  let currentAllowedElement = null;
  const tutHand = document.createElement('div');
  tutHand.className = 'tutorial-hand-indicator';
  tutHand.textContent = '👆';
  document.body.appendChild(tutHand);

  const moveHandTo = (el) => {
    if (!el) return;
    if (currentAllowedElement) {
      currentAllowedElement.classList.remove('tutorial-target');
      // Cleanup any manual lifting for non-bolitas
      if (currentAllowedElement.style.zIndex === '20000') {
        currentAllowedElement.style.zIndex = '';
        if (currentAllowedElement.style.position === 'relative')
          currentAllowedElement.style.position = '';
      }
    }

    // For non-bolitas (like shop buttons), we still need manual elevation
    if (!el.classList.contains('bolita')) {
      el.style.position = 'relative';
      el.style.zIndex = '20000';
    }

    const rect = el.getBoundingClientRect();
    // Prevent hand from going off-screen if element is near the bottom
    const isNearBottom = rect.bottom > window.innerHeight - 100;
    const topPos = isNearBottom ? rect.top - 44 : rect.bottom + 4;

    tutHand.textContent = isNearBottom ? '👇' : '👆';
    tutHand.style.cssText = `
      position: fixed;
      z-index: 100025;
      font-size: 2rem;
      pointer-events: none;
      animation: tutorialHandBounce 0.8s infinite alternate ease-in-out;
      top: ${topPos}px;
      left: ${rect.left + rect.width / 2 - 16}px;
    `;
    currentAllowedElement = el;
    el.classList.add('tutorial-target');

    // If we're targeting a bolita, ensure the grid is lifted
    if (el.classList.contains('bolita')) {
      document.getElementById('grid')?.classList.add('grid-lifted');
    } else {
      document.getElementById('grid')?.classList.remove('grid-lifted');
    }
  };

  const clearTarget = (el) => {
    if (el) el.classList.remove('tutorial-target');
  };

  // Intercept absolutely all clicks EXCEPT inside our allowed element (and magic brush picker)
  const clickInterceptor = (e) => {
    const isAllowed = currentAllowedElement && currentAllowedElement.contains(e.target);
    const isMagicBrushPicker = e.target.closest('.magic-brush-picker');

    if (currentAllowedElement && !isAllowed && !isMagicBrushPicker) {
      e.stopPropagation();
      e.preventDefault();
    }
  };
  document.addEventListener('click', clickInterceptor, true);

  const cleanupTutorial = () => {
    clearStepTimeout();
    document.removeEventListener('click', clickInterceptor, true);
    if (tutHand) tutHand.remove();
    if (overlay) overlay.remove();
    if (step1Tip) step1Tip.remove();
    // Ensure grid lifting is cleared
    document.getElementById('grid')?.classList.remove('grid-lifted');
    setTutorialActive(false);
    window._currentTutorialCleanup = null;
  };

  window._currentTutorialCleanup = cleanupTutorial;

  // Step 1: Open Shop
  const shopBtn = document.getElementById('header-shop-btn');
  moveHandTo(shopBtn);

  // Bring header to front so its click isn't beneath overlay
  const gameHeader = document.querySelector('#game-container header');
  if (gameHeader) {
    gameHeader.style.position = 'relative';
    gameHeader.style.zIndex = '16000';
  }
  if (shopBtn) {
    shopBtn.style.position = 'relative';
    shopBtn.style.zIndex = '17000';
  }

  const onShopOpen = (e) => {
    e.stopPropagation();
    e.preventDefault(); // manual trigger handling

    if (shopBtn) {
      clearTarget(shopBtn);
      shopBtn.removeEventListener('click', onShopOpen);
      shopBtn.style.zIndex = '';
    }
    if (gameHeader) gameHeader.style.zIndex = '';

    // Populate and open shop manually
    document.getElementById('shop-coin-count').innerText = getCoins();
    renderShopItems('boosters');
    document.querySelectorAll('.shop-tab').forEach((t) => t.classList.remove('active'));
    document.querySelector('.shop-tab[data-tab="boosters"]').classList.add('active');
    document.getElementById('shop-screen').classList.remove('hidden');
    document.getElementById('powerups-bar').classList.add('hidden'); // Hide bar during shop
    overlay.style.display = 'none'; // Grid overlay hidden while in shop

    const boosterName = t(`booster_${tutorial.boosterId}_name`);
    step1Tip.innerHTML = tipHTML('🪙', t('tutorial_buy_booster', { name: boosterName }));
    // Move tip box above shop
    step1Tip.style.zIndex = '99999';
    window._mandatoryBoosterPurchase = tutorial.boosterId;

    const highlightBuyBtn = () => {
      const shopItems = Array.from(document.querySelectorAll('.shop-item'));
      const targetItem = shopItems.find((item) => item.dataset.boosterId === tutorial.boosterId);
      if (targetItem) {
        const buyBtn = targetItem.querySelector('.shop-item-price');
        moveHandTo(buyBtn);
        resetStepTimeout(); // Step 2: waiting for buy click

        const onBuyComplete = () => {
          if (getBoosterCount(tutorial.boosterId) <= 0) return; // purchase didn't succeed

          clearTarget(buyBtn);
          buyBtn.removeEventListener('click', onBuyComplete);

          // --- AUTOMATED SHOP CLOSURE FOR TUTORIALS ---
          setTimeout(() => {
            closeShop(); // Close the shop automatically
            document.getElementById('powerups-bar').classList.remove('hidden'); // Show bar again
            overlay.style.display = 'block';
            step1Tip.style.zIndex = ''; // Restore tip box relative location
            const bName = t(`booster_${tutorial.boosterId}_name`);
            step1Tip.innerHTML = tipHTML(tutorial.icon, t('tutorial_use_booster', { name: bName }));

            // Force UI update so the newly bought booster throws away its grayscale "empty" state
            if (renderPowerups) renderPowerups();

            const waitForBoosterUse = () => {
              const powerupsBtn = document.querySelector(
                `.powerup-btn[data-booster="${tutorial.boosterId}"]`,
              );
              if (powerupsBtn) {
                moveHandTo(powerupsBtn);
                resetStepTimeout(); // Step 3: waiting for booster button click

                const checker = setInterval(() => {
                  // Check if selected/active
                  if (
                    powerupsBtn.classList.contains('active-target') ||
                    powerupsBtn.classList.contains('selected')
                  ) {
                    clearInterval(checker);
                    clearTarget(powerupsBtn);

                    if (tutorial.boosterId === 'shuffle') {
                      // Shuffle is instant, we are done
                      cleanupTutorial();
                      localStorage.setItem(`boosterTutorial_${tutorial.boosterId}_done`, 'true');
                    } else {
                      // Bomb / Color Bomb: Now ask to click a ball
                      const bName2 = t(`booster_${tutorial.boosterId}_name`);
                      step1Tip.innerHTML = tipHTML(
                        '👆',
                        t('tutorial_click_ball', { name: bName2 }),
                      );

                      // Clear all stray highlights from gameplay or previous steps
                      document.querySelectorAll('.bolita').forEach((b) => {
                        b.classList.remove('hint', 'tutorial-target');
                      });

                      // IMPORTANT: only look for bolitas INSIDE the #grid container
                      const gridEl = document.getElementById('grid');
                      if (gridEl) gridEl.classList.add('grid-lifted'); // Start lifting early

                      // Precise search for center-ish ball based on grid dimensions
                      let maxR = 0,
                        maxC = 0;
                      document.querySelectorAll('#grid .bolita').forEach((b) => {
                        const r = parseInt(b.dataset.row);
                        const c = parseInt(b.dataset.col);
                        if (!isNaN(r)) maxR = Math.max(maxR, r);
                        if (!isNaN(c)) maxC = Math.max(maxC, c);
                      });

                      const midR = Math.floor(maxR / 2);
                      const midC = Math.floor(maxC / 2);

                      // Target exact middle first, then one row below
                      let targetBall = document.querySelector(
                        `#grid .bolita[data-row="${midR}"][data-col="${midC}"]`,
                      );
                      if (!targetBall)
                        targetBall = document.querySelector(
                          `#grid .bolita[data-row="${midR + 1}"][data-col="${midC}"]`,
                        );

                      // Final fallback to middle of DOM list if attributes fail
                      if (!targetBall) {
                        const balls = Array.from(document.querySelectorAll('#grid .bolita'));
                        targetBall = balls[Math.floor(balls.length / 2)];
                      }

                      if (targetBall) {
                        // Position hand and apply target class
                        setTimeout(() => {
                          moveHandTo(targetBall);
                          resetStepTimeout(); // Step 4: waiting for ball click
                        }, 100);

                        const useChecker = setInterval(() => {
                          if (powerupsBtn.classList.contains('used')) {
                            clearInterval(useChecker);
                            clearTarget(targetBall);
                            cleanupTutorial();
                            localStorage.setItem(
                              `boosterTutorial_${tutorial.boosterId}_done`,
                              'true',
                            );
                          }
                        }, 200);
                      } else {
                        cleanupTutorial();
                        localStorage.setItem(`boosterTutorial_${tutorial.boosterId}_done`, 'true');
                      }
                    }
                  } else if (powerupsBtn.classList.contains('used')) {
                    // Fallback if it was somehow used instantly
                    clearInterval(checker);
                    clearTarget(powerupsBtn);
                    cleanupTutorial();
                    localStorage.setItem(`boosterTutorial_${tutorial.boosterId}_done`, 'true');
                  }
                }, 200);
              } else {
                setTimeout(waitForBoosterUse, 100);
              }
            };
            waitForBoosterUse();
          }, 800);
        };
        // Use setInterval approach or simply letting native listener trigger it
        buyBtn.addEventListener('click', onBuyComplete);
      }
    };
    // Briefly wait for shop items DOM to update
    setTimeout(highlightBuyBtn, 150);
  };

  if (shopBtn) {
    resetStepTimeout(); // Step 1: waiting for shop click
    shopBtn.addEventListener('click', onShopOpen);
  } else {
    // Failsafe
    setTimeout(() => {
      const retryBtn = document.getElementById('header-shop-btn');
      if (retryBtn) {
        resetStepTimeout();
        retryBtn.addEventListener('click', onShopOpen);
      }
    }, 500);
  }
}

// ======================== TUTORIAL DIALOG SYSTEM ========================

function showTutorialDialog({
  icon = '',
  title = '',
  message,
  btnText = null,
  onNext = null,
  autoDismiss = 0,
  blocking = false,
}) {
  hideTutorialDialog();

  let backdrop = null;
  if (blocking) {
    backdrop = document.createElement('div');
    backdrop.className = 'tutorial-dialog-backdrop';
    document.body.appendChild(backdrop);
  }

  const dialog = document.createElement('div');
  dialog.id = 'tutorial-dialog';
  dialog.className = 'tutorial-dialog';
  dialog.innerHTML = `
    ${icon ? `<div class="tutorial-dialog-icon">${icon}</div>` : ''}
    <div class="tutorial-dialog-body">
      ${title ? `<div class="tutorial-dialog-title">${title}</div>` : ''}
      <div class="tutorial-dialog-msg">${message}</div>
    </div>
    ${btnText ? `<button class="tutorial-dialog-btn">${btnText}</button>` : ''}
  `;
  document.body.appendChild(dialog);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => dialog.classList.add('tutorial-dialog--in'));
  });

  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    dialog.classList.remove('tutorial-dialog--in');
    dialog.classList.add('tutorial-dialog--out');
    if (backdrop) backdrop.style.opacity = '0';
    setTimeout(() => {
      dialog.remove();
      backdrop?.remove();
      if (onNext) onNext();
    }, 300);
  };

  if (btnText) {
    dialog.querySelector('.tutorial-dialog-btn').addEventListener('click', dismiss);
  }
  if (autoDismiss > 0) {
    setTimeout(dismiss, autoDismiss);
  }

  return { dismiss };
}

function hideTutorialDialog() {
  document.getElementById('tutorial-dialog')?.remove();
  document.querySelector('.tutorial-dialog-backdrop')?.remove();
}

// Adventure Mode Level 1 Tutorial Logic
export function positionTutorialHand(targetEl) {
  const hand = document.getElementById('tutorial-hand');
  const screen = document.getElementById('tutorial-screen');
  if (!hand || !screen) return;

  // Use viewport coords (fixed positioning) so hand isn't clipped by container overflow
  const targetRect = targetEl.getBoundingClientRect();
  const left = targetRect.left + targetRect.width / 2;
  const top = targetRect.top + targetRect.height / 2;

  hand.style.left = `${left}px`;
  hand.style.top = `${top}px`;
  hand.style.transform = 'translate(-50%, -70%)';
  hand.style.display = 'block';

  screen.classList.remove('hidden');
}

export function hideTutorialHand() {
  const hand = document.getElementById('tutorial-hand');
  const screen = document.getElementById('tutorial-screen');
  if (hand) hand.style.display = 'none';
  if (screen) screen.classList.add('hidden');
}

export function showAdventureTutorial(callbacks) {
  const { createBolita, showBannerAd, clearGrid, setHeaderMode, sizeGrid } = callbacks;

  setTutorialActive(true);
  currentTutorialPhase = 'select';

  if (setHeaderMode) setHeaderMode(`📚 ${t('tutorial')}`);

  const uiGrid = document.getElementById('grid');
  if (uiGrid) {
    document.documentElement.style.setProperty('--rows', '3');
    document.documentElement.style.setProperty('--cols', '3');
    uiGrid.style.aspectRatio = '3 / 3';
  }

  const grid = clearGrid(3, 3);

  const greenPos = new Set(['0,0', '1,0', '1,1']);
  const fillerLayout = [
    [null, 'red', 'blue'],
    [null, null, 'red'],
    ['blue', 'red', 'blue'],
  ];

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (greenPos.has(`${r},${c}`)) {
        createBolita(r, c, 'green');
      } else {
        createBolita(r, c, fillerLayout[r][c]);
      }
    }
  }

  if (sizeGrid) requestAnimationFrame(sizeGrid);

  greenPos.forEach((key) => {
    const [r, c] = key.split(',').map(Number);
    if (grid[r] && grid[r][c] && grid[r][c].el) {
      grid[r][c].el.classList.add('hint');
    }
  });

  if (showBannerAd) showBannerAd();

  // Step 1: Welcome dialog — blocks the grid until player acknowledges
  showTutorialDialog({
    icon: '🟢',
    title: t('tutorial_welcome_title'),
    message: t('tutorial_welcome_msg'),
    btnText: t('tutorial_btn_start'),
    blocking: true,
    onNext: () => {
      // Step 2: Point the hand at the green group + auto-dismiss hint
      if (grid[1] && grid[1][0] && grid[1][0].el) {
        positionTutorialHand(grid[1][0].el);
      }
      showTutorialDialog({
        icon: '👆',
        message: t('tutorial_select_hint'),
        autoDismiss: 3500,
      });
      // Exit tutorial if player doesn't interact after the hint dismisses
      setTimeout(() => {
        if (!isTutorialActive()) return;
        setTutorialActive(false);
        hideTutorialHand();
        hideTutorialDialog();
        localStorage.setItem('bolitasTutorialDone', 'true');
        if (callbacks?.onComplete) callbacks.onComplete();
      }, 3500 + 10000);
    },
  });
}

export function handleTutorialProgress(callbacks) {
  if (currentTutorialPhase === 'select') {
    currentTutorialPhase = 'pop';
    hideTutorialHand();
    hideTutorialDialog();
    // Step 3: Tell player to tap again to pop
    showTutorialDialog({
      icon: '💥',
      message: t('tutorial_pop_hint'),
      autoDismiss: 2200,
    });
  } else if (currentTutorialPhase === 'pop') {
    setTutorialActive(false);
    hideTutorialHand();
    hideTutorialDialog();
    localStorage.setItem('bolitasTutorialDone', 'true');
    // Step 4: Celebrate and send player forward
    showTutorialDialog({
      icon: '🎉',
      title: t('tutorial_done_title'),
      message: t('tutorial_done_msg'),
      btnText: t('tutorial_btn_got_it'),
      onNext: () => {
        if (callbacks?.onComplete) callbacks.onComplete();
      },
    });
  }
}
