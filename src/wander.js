// src/wander.js — Random wandering + idle fidget animations

module.exports = function initWander(ctx) {

const WALK_SPEED_PX       = 40;      // pixels per second
const MAX_WANDER_DIST     = 200;     // max distance per wander
const STEP_INTERVAL_MS    = 100;     // ~10fps
const ACTION_INTERVAL_MIN = 30000;   // minimum wait between actions (30s)
const ACTION_INTERVAL_MAX = 90000;   // maximum wait between actions (90s)
const WANDER_CHANCE       = 0.3;     // 30% chance to walk, 70% chance to fidget
const WANDER_IDLE_STATES  = new Set(["idle"]);

// Idle fidget animations: [svg, duration in ms]
const FIDGET_ANIMS = [
  ["clawd-idle-look.svg",   3000],   // look around
  ["clawd-idle-living.svg", 4000],   // stretch / living
  ["clawd-happy-hearts.svg", 3000],  // random happy with hearts (3 full bounces)
];

let moveTimer   = null;
let loopTimer   = null;
let fidgetTimer = null;
let isWandering = false;

function wanderToRandomPosition(onComplete) {
  if (!ctx.win || ctx.win.isDestroyed()) {
    if (onComplete) onComplete();
    return;
  }

  const { screen } = require("electron");
  const display = screen.getPrimaryDisplay();
  const { width: sw, height: sh } = display.workAreaSize;
  const bounds = ctx.win.getBounds();
  const { x: startX, y: startY, width: ww, height: wh } = bounds;

  const margin = 30;
  const angle = Math.random() * 2 * Math.PI;
  const dist = 80 + Math.random() * (MAX_WANDER_DIST - 80);
  const rawX = startX + Math.cos(angle) * dist;
  const rawY = startY + Math.sin(angle) * dist;
  const targetX = Math.round(Math.max(margin, Math.min(sw - ww - margin, rawX)));
  const targetY = Math.round(Math.max(margin, Math.min(sh - wh - margin, rawY)));

  const actualDist = Math.sqrt((targetX - startX) ** 2 + (targetY - startY) ** 2);
  const durationMs = Math.round((actualDist / WALK_SPEED_PX) * 1000);
  const steps = Math.max(1, Math.floor(durationMs / STEP_INTERVAL_MS));
  let step = 0;

  if (moveTimer) { clearInterval(moveTimer); moveTimer = null; }

  if (ctx.sendToRenderer) ctx.sendToRenderer("state-change", "idle", "clawd-mini-crabwalk.svg");

  moveTimer = setInterval(() => {
    if (!ctx.win || ctx.win.isDestroyed()) {
      clearInterval(moveTimer); moveTimer = null;
      isWandering = false;
      return;
    }

    step++;
    const t = step / steps;

    try {
      ctx.win.setPosition(
        Math.round(startX + (targetX - startX) * t),
        Math.round(startY + (targetY - startY) * t)
      );
      ctx.syncHitWin();
    } catch (e) {
      clearInterval(moveTimer); moveTimer = null;
      isWandering = false;
      scheduleNextAction();
      return;
    }

    if (step >= steps) {
      clearInterval(moveTimer); moveTimer = null;
      isWandering = false;
      if (ctx.sendToRenderer) ctx.sendToRenderer("state-change", "idle", "clawd-idle-follow.svg");
      if (onComplete) onComplete();
    }
  }, STEP_INTERVAL_MS);
}

function playFidget(onComplete) {
  const [svg, duration] = FIDGET_ANIMS[Math.floor(Math.random() * FIDGET_ANIMS.length)];

  if (ctx.sendToRenderer) ctx.sendToRenderer("state-change", "idle", svg);

  fidgetTimer = setTimeout(() => {
    fidgetTimer = null;
    // Return to normal idle
    if (ctx.sendToRenderer) ctx.sendToRenderer("state-change", "idle", "clawd-idle-follow.svg");
    if (onComplete) onComplete();
  }, duration);
}

function scheduleNextAction() {
  if (loopTimer) { clearTimeout(loopTimer); loopTimer = null; }
  const delay = ACTION_INTERVAL_MIN + Math.random() * (ACTION_INTERVAL_MAX - ACTION_INTERVAL_MIN);
  loopTimer = setTimeout(() => {
    loopTimer = null;
    const state = ctx.getCurrentState ? ctx.getCurrentState() : null;
    if (!isWandering && state && WANDER_IDLE_STATES.has(state)) {
      if (Math.random() < WANDER_CHANCE) {
        // Walk somewhere
        isWandering = true;
        wanderToRandomPosition(() => scheduleNextAction());
      } else {
        // Do a fidget animation in place
        playFidget(() => scheduleNextAction());
      }
    } else {
      scheduleNextAction();
    }
  }, delay);
}

function startWanderLoop() {
  if (loopTimer) return;
  scheduleNextAction();
}

function cleanup() {
  if (moveTimer)   { clearInterval(moveTimer);   moveTimer   = null; }
  if (loopTimer)   { clearTimeout(loopTimer);    loopTimer   = null; }
  if (fidgetTimer) { clearTimeout(fidgetTimer);  fidgetTimer = null; }
}

return { wanderToRandomPosition, startWanderLoop, cleanup };

};
