// src/apple.js — Feed apple: spawn apple at mouse, crab walks over and eats it

const { BrowserWindow, screen, globalShortcut } = require("electron");
const path = require("path");

module.exports = function initApple(ctx) {

const APPLE_SIZE    = 40;   // window size for the apple
const WALK_SPEED    = 40;   // px/s — same as wander
const STEP_MS       = 100;
const EAT_DURATION  = 2500; // how long the eating animation plays

let appleWin   = null;
let moveTimer  = null;
let eatTimer   = null;
let isFeeding  = false;

function spawnApple() {
  if (isFeeding) return;       // one apple at a time
  if (!ctx.win || ctx.win.isDestroyed()) return;
  if (ctx.miniMode) return;   // can't feed while tucked into screen edge

  const mousePos = screen.getCursorScreenPoint();
  isFeeding = true;

  // Pause wander and idle animations so nothing overrides the crabwalk
  if (ctx.pauseWander) ctx.pauseWander();
  ctx.idlePaused = true;

  // Create a small transparent window for the apple
  appleWin = new BrowserWindow({
    width: APPLE_SIZE,
    height: APPLE_SIZE,
    x: mousePos.x - APPLE_SIZE / 2,
    y: mousePos.y - APPLE_SIZE / 2,
    frame: false,
    transparent: true,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    show: false,
    title: "",
    backgroundColor: "#00000000",
    roundedCorners: false,
    webPreferences: { contextIsolation: true },
  });

  appleWin.loadFile(path.join(__dirname, "..", "assets", "apple.html"));

  appleWin.once("ready-to-show", () => {
    if (appleWin && !appleWin.isDestroyed()) {
      appleWin.show();
    }
  });

  // Walk the crab to the apple
  walkToApple(mousePos.x, mousePos.y);
}

function walkToApple(targetX, targetY) {
  if (!ctx.win || ctx.win.isDestroyed()) { cleanup(); return; }

  const bounds = ctx.win.getBounds();
  const crabCenterX = bounds.x + bounds.width / 2;
  const crabCenterY = bounds.y + bounds.height / 2;

  const dx = targetX - crabCenterX;
  const dy = targetY - crabCenterY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const durationMs = Math.max(500, Math.round((dist / WALK_SPEED) * 1000));
  const steps = Math.max(1, Math.floor(durationMs / STEP_MS));
  const startX = bounds.x;
  const startY = bounds.y;
  // Target: stop so apple is at crab's arm/mouth level
  // Crab body is in upper portion of window, offset up so apple meets the arms
  const endX = targetX - bounds.width / 2;
  const endY = targetY - bounds.height * 0.7;
  let step = 0;

  // Switch to crabwalk animation
  if (ctx.sendToRenderer) ctx.sendToRenderer("state-change", "idle", "clawd-mini-crabwalk.svg");

  if (moveTimer) { clearInterval(moveTimer); moveTimer = null; }

  moveTimer = setInterval(() => {
    if (!ctx.win || ctx.win.isDestroyed()) { cleanup(); return; }

    step++;
    const t = step / steps;

    try {
      ctx.win.setPosition(
        Math.round(startX + (endX - startX) * t),
        Math.round(startY + (endY - startY) * t)
      );
      ctx.syncHitWin();
    } catch (e) {
      cleanup();
      return;
    }

    if (step >= steps) {
      clearInterval(moveTimer); moveTimer = null;
      startEating();
    }
  }, STEP_MS);
}

function startEating() {
  // Destroy the apple
  if (appleWin && !appleWin.isDestroyed()) {
    appleWin.destroy();
    appleWin = null;
  }

  // Switch to eating animation
  if (ctx.sendToRenderer) ctx.sendToRenderer("state-change", "idle", "clawd-eating.svg");

  // After eating, return to idle and resume wander
  eatTimer = setTimeout(() => {
    eatTimer = null;
    if (ctx.sendToRenderer) ctx.sendToRenderer("state-change", "idle", "clawd-idle-follow.svg");
    isFeeding = false;
    ctx.idlePaused = false;
    if (ctx.resumeWander) ctx.resumeWander();
  }, EAT_DURATION);
}

function registerShortcut() {
  try {
    globalShortcut.register("CommandOrControl+Shift+A", () => {
      spawnApple();
    });
  } catch (e) {
    console.warn("Clawd: failed to register apple shortcut:", e.message);
  }
}

function unregisterShortcut() {
  try {
    globalShortcut.unregister("CommandOrControl+Shift+A");
  } catch (e) {}
}

function cleanup() {
  if (moveTimer) { clearInterval(moveTimer); moveTimer = null; }
  if (eatTimer) { clearTimeout(eatTimer); eatTimer = null; }
  if (appleWin && !appleWin.isDestroyed()) { appleWin.destroy(); appleWin = null; }
  isFeeding = false;
  ctx.idlePaused = false;
  if (ctx.resumeWander) ctx.resumeWander();
}

return { spawnApple, registerShortcut, unregisterShortcut, cleanup };

};
