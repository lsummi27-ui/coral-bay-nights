// The screenshot scenes behind ?shot=start|play|mission|end. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by
// a simple autopilot, so the frame is what real play looks like and the same
// seed always gives the same frame. The cover (play) is a police chase in a
// stolen car, with the wanted stars, minimap and mission objective on the HUD.
import { STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 6;
const MISSION_SECONDS = 9;
const END_SECONDS = 20;

/** Drive a loop around the central blocks, steering toward the next waypoint. */
const DRIVE_ROUTE = [
  { x: 1624, y: 1000 }, { x: 2224, y: 1000 }, { x: 2224, y: 1624 },
  { x: 1024, y: 1624 }, { x: 1024, y: 424 }, { x: 1624, y: 424 },
];
let driveWp = 0;
function driveAutopilot(state) {
  const car = state.player.car;
  if (!car) return { mx: 0, my: 0, run: false, enter: false, punch: false, shoot: false, aim: null };
  const wp = DRIVE_ROUTE[driveWp % DRIVE_ROUTE.length];
  if (Math.hypot(wp.x - car.x, wp.y - car.y) < 150) driveWp += 1;
  const targetAngle = Math.atan2(wp.y - car.y, wp.x - car.x);
  let da = ((targetAngle - car.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return { mx: da > 0.12 ? 1 : da < -0.12 ? -1 : 0, my: Math.abs(da) > 0.6 ? 1 : -1, run: false, enter: false, punch: false, shoot: false, aim: null };
}

function walkAutopilot(state) {
  const target = { x: 1600, y: 1000 };
  const dx = target.x - state.player.x;
  const dy = target.y - state.player.y;
  const len = Math.hypot(dx, dy) || 1;
  return {
    mx: Math.abs(dx) > 30 ? dx / len : 0,
    my: Math.abs(dy) > 30 ? dy / len : 0,
    run: true, enter: false, punch: Math.hypot(dx, dy) < 60, shoot: false, aim: null,
  };
}

export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  if (name !== 'play' && name !== 'mission' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, { mx: 0, my: 0, run: false, enter: false, punch: false, shoot: false, aim: null }, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'mission') {
    // Jump to mission 3: on foot at the warehouse, the Sharks closing in.
    state.missionIndex = 2;
    state.missionStage = 'go';
    state.player.x = 1600;
    state.player.y = 1180;
    state.player.health = 82;
    state.player.ammo = 24;
    state.player.money = 1240;
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
    for (let i = 0; i < MISSION_SECONDS / STEP; i += 1) {
      world.step(STEP, walkAutopilot(state), false);
      if (state.missionStage === 'fight') break;
    }
    for (let i = 0; i < 3 / STEP; i += 1) world.step(STEP, walkAutopilot(state), false);
    return { screen: SCREEN_PLAY, best: 1240 };
  }
  if (name === 'end') {
    // A chase that ends badly: wanted, police ramming, health running out.
    state.wanted = 3;
    const car = state.cars.find((c) => c.parked) || state.cars[0];
    state.player.car = car;
    car.parked = false; car.traffic = false;
    car.x = 1624; car.y = 1400; car.angle = -Math.PI / 2; car.axis = 'v'; car.dir = -1; car.lane = 24;
    state.player.x = car.x; state.player.y = car.y;
    state.player.health = 26;
    for (let i = 0; i < END_SECONDS / STEP; i += 1) {
      world.step(STEP, driveAutopilot(state), false);
      if (state.over) break;
    }
    if (!state.over) {
      state.player.health = 0;
      world.step(STEP, driveAutopilot(state), false);
    }
    return { screen: SCREEN_OVER, best: 0 };
  }
  // play: steal a car, get wanted, and run from the police through traffic.
  const car = state.cars.find((c) => c.parked) || state.cars[0];
  state.player.car = car;
  car.parked = false; car.traffic = false;
  car.x = 1624; car.y = 1400; car.angle = -Math.PI / 2; car.axis = 'v'; car.dir = -1; car.lane = 24;
  state.player.x = car.x; state.player.y = car.y;
  state.carsStolen = 1;
  state.wanted = 2;
  state.player.money = 460;
  for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) world.step(STEP, driveAutopilot(state), false);
  return { screen: SCREEN_PLAY, best: 460 };
}
