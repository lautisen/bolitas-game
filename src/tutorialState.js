/**
 * tutorialState.js — Shared tutorial-active flag
 *
 * Lives in its own module so shop.js can check the flag without importing
 * tutorial.js (which imports shop.js) — breaking that import cycle.
 */

let tutorialActive = false;

export function isTutorialActive() {
  return tutorialActive;
}

export function setTutorialActive(val) {
  tutorialActive = val;
}
