// Everything on screen: the city, cars, people, effects, the HUD with its
// minimap, and the title, pause and game-over screens. The view is a fixed
// 1280x720 logical area scaled to the window; the camera follows the player.
import { FONT, MISSIONS, PALETTE, PLAYER, VIEW, WORLD } from './config.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_OVER = 3;

function starString(wanted) {
  let s = '';
  for (let i = 0; i < 5; i += 1) s += i < wanted ? '★' : '☆';
  return s;
}
function clockString(seconds) {
  const h = Math.floor(seconds / 3600) % 24;
  const m = Math.floor(seconds / 60) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const minimap = document.createElement('canvas');
  minimap.width = 176;
  minimap.height = 132;

  function fit() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
  }
  window.addEventListener('resize', fit);
  fit();

  function drawCar(x, y, angle, color, police) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-34, -20, 68, 40);
    ctx.fillStyle = color;
    ctx.fillRect(-36, -20, 72, 40);
    ctx.fillStyle = police ? '#fff' : '#222';
    ctx.fillRect(-14, -16, 22, 32);
    ctx.fillStyle = police ? '#e5534b' : '#9fc6e8';
    ctx.fillRect(10, -16, 16, 32);
    if (police) {
      ctx.fillStyle = '#e5534b';
      ctx.fillRect(-6, -20, 12, 6);
      ctx.fillStyle = '#2b4acb';
      ctx.fillRect(-6, 14, 12, 6);
    }
    ctx.restore();
  }

  function drawPerson(x, y, angle, color, radius) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.arc(2, 3, radius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(radius * 0.5, 0, radius * 0.45, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawWorld(state) {
    const city = state.city;
    const cam = state.camera;
    const ox = VIEW.width / 2 - cam.x;
    const oy = VIEW.height / 2 - cam.y;
    ctx.save();
    ctx.translate(ox, oy);
    // Ground: grass, then beach and water along the south edge.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(city.beach.x, city.beach.y, city.beach.w, city.beach.h);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(city.water.x, city.water.y, city.water.w, city.water.h);
    ctx.fillStyle = '#2f7fb0';
    ctx.fillRect(city.water.x, city.water.y, city.water.w, 4);
    // Parks.
    ctx.fillStyle = PALETTE.park;
    for (const p of city.parks) ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = '#4a7a3a';
    for (const p of city.parks) {
      for (let i = 0; i < 6; i += 1) {
        const tx = p.x + 20 + ((i * 67) % Math.max(1, p.w - 40));
        const ty = p.y + 20 + ((i * 43) % Math.max(1, p.h - 40));
        ctx.beginPath(); ctx.arc(tx, ty, 10, 0, Math.PI * 2); ctx.fill();
      }
    }
    // Docks.
    ctx.fillStyle = '#8a6f4d';
    ctx.fillRect(city.docks.x, city.docks.y, city.docks.w, city.docks.h);
    ctx.fillStyle = '#6b563d';
    for (let i = 0; i < 4; i += 1) ctx.fillRect(city.docks.x + 20, city.docks.y + 20 + i * 70, city.docks.w - 40, 8);
    // Roads.
    ctx.fillStyle = PALETTE.road;
    for (const r of city.roads) ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = PALETTE.roadLine;
    ctx.lineWidth = 3;
    ctx.setLineDash([22, 18]);
    ctx.beginPath();
    for (const x of [400, 1000, 1600, 2200, 2800]) { ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.height); }
    for (const y of [400, 1000, 1600, 2000]) { ctx.moveTo(0, y); ctx.lineTo(WORLD.width, y); }
    ctx.stroke();
    ctx.setLineDash([]);
    // Buildings with a sun-side shadow and windows.
    for (const b of city.buildings) {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(b.x + 8, b.y + 10, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(b.x, b.y, b.w, 6);
      ctx.fillStyle = 'rgba(20,30,50,0.55)';
      for (let wx = b.x + 12; wx < b.x + b.w - 10; wx += 26) {
        for (let wy = b.y + 14; wy < b.y + b.h - 10; wy += 24) ctx.fillRect(wx, wy, 12, 14);
      }
    }
    // Pickups.
    for (const p of city.pickups) {
      if (p.taken) continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.fillStyle = p.kind === 'cash' ? PALETTE.gold : p.kind === 'health' ? '#e5534b' : '#4fc3f7';
      ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.font = 'bold 13px ' + FONT;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(p.kind === 'cash' ? '$' : p.kind === 'health' ? '+' : 'A', 0, 1);
      ctx.restore();
    }
    // Mission marker: a pulsing yellow ring at the target.
    const mission = MISSIONS[state.missionIndex];
    if (mission && !state.storyDone) {
      const pulse = 26 + Math.sin(state.elapsed * 4) * 6;
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(mission.target.x, mission.target.y, pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath(); ctx.arc(mission.target.x, mission.target.y, 6, 0, Math.PI * 2); ctx.fill();
    }
    // Pedestrians.
    for (const p of state.peds) drawPerson(p.x, p.y, p.angle, p.color, 9);
    // Cars: parked and traffic first, police on top. The player's car gets a
    // white ring so it is easy to spot in the middle of traffic.
    for (const car of state.cars) if (!car.police) drawCar(car.x, car.y, car.angle, car.color, false);
    for (const car of state.cars) if (car.police) drawCar(car.x, car.y, car.angle, car.color, true);
    if (state.player.car) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(state.player.car.x, state.player.car.y, 52, 0, Math.PI * 2); ctx.stroke();
    }
    // Enemies.
    for (const e of state.enemies) {
      if (!e.alive) continue;
      drawPerson(e.x, e.y, e.angle, '#8e2f2f', 12);
      ctx.fillStyle = '#e5534b';
      ctx.fillRect(e.x - 14, e.y - 24, 28 * (e.health / 60), 4);
    }
    // The player: on foot a walker with a white jacket, in a car the car itself.
    const pl = state.player;
    if (!pl.car) drawPerson(pl.x, pl.y, pl.angle, PALETTE.player, PLAYER.radius);
    // Particles.
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.life * 1.6);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawMinimap(state) {
    const m = minimap.getContext('2d');
    const sx = minimap.width / WORLD.width;
    const sy = minimap.height / WORLD.height;
    m.fillStyle = '#20242c';
    m.fillRect(0, 0, minimap.width, minimap.height);
    m.fillStyle = '#7fae5a';
    m.fillRect(0, 0, minimap.width, minimap.height);
    m.fillStyle = '#3d4148';
    for (const r of state.city.roads) m.fillRect(r.x * sx, r.y * sy, Math.max(2, r.w * sx), Math.max(2, r.h * sy));
    m.fillStyle = '#3d8fc2';
    m.fillRect(0, 2330 * sy, minimap.width, 4);
    const mission = MISSIONS[state.missionIndex];
    if (mission && !state.storyDone) {
      m.fillStyle = PALETTE.gold;
      m.beginPath(); m.arc(mission.target.x * sx, mission.target.y * sy, 5, 0, Math.PI * 2); m.fill();
    }
    for (const car of state.cars) {
      m.fillStyle = car.police ? '#ff4444' : '#ddd';
      m.fillRect(car.x * sx - 1.5, car.y * sy - 1.5, 3, 3);
    }
    m.fillStyle = '#fff';
    m.beginPath(); m.arc(state.player.x * sx, state.player.y * sy, 4, 0, Math.PI * 2); m.fill();
    m.strokeStyle = '#fff';
    m.lineWidth = 1;
    m.beginPath(); m.arc(state.player.x * sx, state.player.y * sy, 6, 0, Math.PI * 2); m.stroke();
    ctx.drawImage(minimap, VIEW.width - minimap.width - 16, 16);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(VIEW.width - minimap.width - 16, 16, minimap.width, minimap.height);
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = PALETTE.hud;
    ctx.fillRect(x, y, w, h);
  }

  function drawHud(state) {
    const pl = state.player;
    const mission = MISSIONS[state.missionIndex];
    // Top-left: health, money, wanted, clock.
    panel(16, 16, 300, 96);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 20px ' + FONT;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(`$${pl.money}`, 28, 24);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = '22px ' + FONT;
    ctx.fillText(starString(state.wanted), 28, 50);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '15px ' + FONT;
    ctx.fillText(clockString(state.clock) + '  Coral Bay', 28, 82);
    // Health bar.
    ctx.fillStyle = '#333';
    ctx.fillRect(170, 28, 130, 14);
    ctx.fillStyle = pl.health > 40 ? PALETTE.green : PALETTE.red;
    ctx.fillRect(170, 28, 130 * Math.max(0, pl.health / 100), 14);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '12px ' + FONT;
    ctx.fillText(`HP ${Math.ceil(pl.health)}`, 170, 46);
    ctx.fillText(`Ammo ${pl.ammo}`, 170, 64);
    if (pl.car) ctx.fillText(`Car ${Math.ceil(pl.car.health)}%  ${Math.abs(Math.round(pl.speed * 0.12))} mph`, 170, 82);
    // Top-centre: mission.
    if (mission && !state.storyDone) {
      const d = Math.round(Math.hypot(pl.x - mission.target.x, pl.y - mission.target.y));
      panel(VIEW.width / 2 - 260, 16, 520, 64);
      ctx.fillStyle = PALETTE.gold;
      ctx.font = 'bold 17px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText(`${mission.id}. ${mission.title} — ${mission.contact}`, VIEW.width / 2, 24);
      ctx.fillStyle = PALETTE.text;
      ctx.font = '15px ' + FONT;
      ctx.fillText(`${mission.objective}  •  ${d}m`, VIEW.width / 2, 48);
      if (mission.id === 4 && mission.timeLimit) {
        ctx.fillStyle = state.missionTimer > mission.timeLimit - 15 ? PALETTE.red : PALETTE.text;
        ctx.fillText(`${Math.max(0, Math.ceil(mission.timeLimit - state.missionTimer))}s left`, VIEW.width / 2, 66);
      }
    } else if (state.storyDone) {
      panel(VIEW.width / 2 - 200, 16, 400, 40);
      ctx.fillStyle = PALETTE.gold;
      ctx.font = 'bold 16px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('Free roam — Coral Bay is yours', VIEW.width / 2, 28);
    }
    drawMinimap(state);
    // Bottom-left: contextual hint and messages.
    ctx.textAlign = 'left';
    ctx.font = '15px ' + FONT;
    let hint = 'WASD move • Shift run • E enter car • F punch • Space shoot • P pause • M mute';
    if (!pl.car) {
      let near = false;
      for (const car of state.cars) if (Math.hypot(car.x - pl.x, car.y - pl.y) < 80) near = true;
      if (near) hint = 'E — steal this car';
    } else {
      hint = 'W accelerate • S brake • A/D steer • E get out';
    }
    panel(16, VIEW.height - 64, ctx.measureText(hint).width + 24, 28);
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(hint, 28, VIEW.height - 56);
    if (state.messageTimer > 0 && state.message) {
      panel(16, VIEW.height - 104, ctx.measureText(state.message).width + 24, 28);
      ctx.fillStyle = PALETTE.gold;
      ctx.fillText(state.message, 28, VIEW.height - 96);
    }
    if (state.bannerTimer > 0 && state.banner) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 30px ' + FONT;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(VIEW.width / 2 - 340, 150, 680, 56);
      ctx.fillStyle = PALETTE.gold;
      ctx.fillText(state.banner, VIEW.width / 2, 164);
    }
  }

  function drawTitle(state, best) {
    drawWorld(state);
    ctx.fillStyle = 'rgba(8,10,16,0.72)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 64px ' + FONT;
    ctx.fillText('CORAL BAY', VIEW.width / 2, 150);
    ctx.fillText('NIGHTS', VIEW.width / 2, 220);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '20px ' + FONT;
    ctx.fillText('An open-world crime story in the sun-soaked city of Coral Bay.', VIEW.width / 2, 270);
    ctx.font = '16px ' + FONT;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('Rook is back with $60, a borrowed jacket and a debt to the Marlin Crew.', VIEW.width / 2, 300);
    ctx.fillText('Vera has work. Marcus has a grudge. The police have everyone\'s number.', VIEW.width / 2, 324);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 18px ' + FONT;
    ctx.fillText('Press Space or click to start', VIEW.width / 2, 400);
    ctx.font = '15px ' + FONT;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('WASD move • Shift run • E steal / enter a car • F punch • Space shoot • P pause • M mute', VIEW.width / 2, 440);
    ctx.fillText('Steal cars, lose the police, run four missions — and own Coral Bay.', VIEW.width / 2, 466);
    if (best > 0) {
      ctx.fillStyle = PALETTE.gold;
      ctx.fillText(`Best fortune so far: $${best}`, VIEW.width / 2, 500);
    }
    ctx.font = '13px ' + FONT;
    ctx.fillText('A wholly original game. No characters, places or music from any other game.', VIEW.width / 2, 640);
  }

  function drawOver(state, best) {
    drawWorld(state);
    ctx.fillStyle = 'rgba(20,4,6,0.78)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.red;
    ctx.font = 'bold 56px ' + FONT;
    ctx.fillText('WASTED', VIEW.width / 2, 240);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '20px ' + FONT;
    ctx.fillText(`Rook went down in Coral Bay. Missions done: ${state.missionsDone}  •  Fortune: $${state.player.money}`, VIEW.width / 2, 300);
    if (state.player.money > best) ctx.fillText('New best fortune!', VIEW.width / 2, 330);
    ctx.font = '18px ' + FONT;
    ctx.fillText('Press Space or click to try again', VIEW.width / 2, 400);
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(8,10,16,0.66)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 44px ' + FONT;
    ctx.fillText('PAUSED', VIEW.width / 2, 320);
    ctx.font = '17px ' + FONT;
    ctx.fillText('Press P or Space to keep playing. Your progress is saved.', VIEW.width / 2, 360);
  }

  function draw(state, screen, best) {
    const scale = Math.min(canvas.width / VIEW.width, canvas.height / VIEW.height);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = '#11141b';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    else if (screen === SCREEN_OVER) drawOver(state, best);
    else {
      drawWorld(state);
      drawHud(state);
      if (screen === SCREEN_PAUSED) drawPaused();
    }
  }

  return { draw };
}
