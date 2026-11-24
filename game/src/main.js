// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between four screens: title,
// play, paused and game over. Progress is saved to localStorage whenever a
// mission ends and whenever the game is paused.
// ?seed=N fixes the city's pattern. ?shot=start|play|mission|end (with
// &seed=N) stages that scene instead of running the loop, paints it twice and
// sets window.__shotReady for a screenshot.
import { BEST_KEY, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CRASH, EVENT_HIT, EVENT_MISSION, EVENT_OVER, EVENT_PICKUP, EVENT_SHOT } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, createInput } from './input.js';
import { createSound } from './sound.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const sound = createSound();

function readNumber(key) {
  try { return Number.parseInt(window.localStorage.getItem(key) ?? '0', 10) || 0; } catch { return 0; }
}
function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function saveGame() {
  try {
    const s = world.state;
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: s.player.money, health: s.player.health, ammo: s.player.ammo,
      x: s.player.x, y: s.player.y, missionIndex: s.missionIndex,
      missionsDone: s.missionsDone, carsStolen: s.carsStolen, wanted: s.wanted,
    }));
    if (s.player.money > readNumber(BEST_KEY)) window.localStorage.setItem(BEST_KEY, String(s.player.money));
  } catch { /* storage can be off: progress then lasts this visit only */ }
}
function loadSave() {
  const save = readSave();
  if (!save) return false;
  const s = world.state;
  s.player.money = save.money; s.player.health = save.health; s.player.ammo = save.ammo;
  s.player.x = save.x; s.player.y = save.y; s.missionIndex = save.missionIndex;
  s.missionsDone = save.missionsDone; s.carsStolen = save.carsStolen; s.wanted = save.wanted;
  s.camera.x = save.x; s.camera.y = save.y;
  return true;
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readNumber(BEST_KEY);
  let accumulator = 0;
  let last = performance.now();
  const hadSave = readSave() !== null;

  function announce(message) { status.textContent = message; }

  function startGame(fresh) {
    if (fresh) world.reset();
    else if (!loadSave()) world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    sound.unlock();
    sound.click();
    announce('Playing. Follow the mission at the top of the screen.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.player.money > best) {
      best = world.state.player.money;
      try { window.localStorage.setItem(BEST_KEY, String(best)); } catch { /* ignore */ }
    }
    sound.stopEngine();
    sound.siren(false);
    announce(`Wasted. Missions done ${world.state.missionsDone}. Fortune $${world.state.player.money}.`);
  }

  function aimAngle() {
    const m = input.mouse();
    const rect = canvas.getBoundingClientRect();
    const scaleX = 1280 / rect.width;
    const scaleY = 720 / rect.height;
    const wx = world.state.camera.x + (m.x * scaleX - 640);
    const wy = world.state.camera.y + (m.y * scaleY - 360);
    return Math.atan2(wy - world.state.player.y, wx - world.state.player.x);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = sound.toggleMute();
      announce(muted ? 'Sound muted.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) {
      startGame(screen === SCREEN_OVER || !hadSave);
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      saveGame();
      announce('Paused. Progress saved.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    return actions;
  }

  function step(actions) {
    if (screen === SCREEN_TITLE) {
      const move = { mx: 0, my: 0, run: false, enter: false, punch: false, shoot: false, aim: null };
      world.step(STEP, move, true);
      return;
    }
    const mv = input.move();
    const ctl = {
      mx: mv.x, my: mv.y, run: mv.run,
      enter: Boolean(actions & ACTION_ENTER),
      punch: Boolean(actions & ACTION_PUNCH),
      shoot: input.shootHeld(),
      aim: aimAngle(),
    };
    const events = world.step(STEP, ctl, false);
    if (events & EVENT_OVER) endGame();
    else if (events & EVENT_MISSION) { saveGame(); sound.jingle(); }
    else if (events & EVENT_PICKUP) sound.pickup();
    else if (events & EVENT_SHOT) sound.shot();
    else if (events & EVENT_HIT) sound.punch();
    else if (events & EVENT_CRASH) sound.crash();
    const driving = Boolean(world.state.player.car);
    sound.engine(world.state.player.speed, driving && screen === SCREEN_PLAY);
    sound.siren(world.state.wanted > 0 && screen === SCREEN_PLAY);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      let firstStep = true;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(firstStep ? actions : 0);
        firstStep = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      saveGame();
      announce('Paused. Progress saved.');
    }
  });

  announce(hadSave ? 'Coral Bay Nights. Press Space to continue your save, or start fresh.' : 'Coral Bay Nights. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
