// The game's rules and state, with no drawing and no browser in it: the player
// on foot and in cars, traffic, pedestrians, police, wanted level, missions,
// combat, pickups and particles. step() advances one fixed step and returns
// what happened as bit flags, so the caller can react (sound, announcements)
// without the world knowing about screens or sound.
import { CAR, MISSIONS, PALETTE, PED, PLAYER, POLICE, ROADS_H, ROADS_V, ROAD_W, TRAFFIC, WANTED, WORLD } from './config.js';
import { buildCity, resolveBuildings } from './city.js';

export const EVENT_PICKUP = 1;
export const EVENT_HIT = 2;
export const EVENT_CRIME = 4;
export const EVENT_MISSION = 8;
export const EVENT_OVER = 16;
export const EVENT_SHOT = 32;
export const EVENT_CRASH = 64;

const CAR_COLORS = ['#d94f3d', '#3d7ad9', '#e8c53a', '#4fae5a', '#e8e8e8', '#8a5fc0', '#e07a2e', '#2ec4b6'];
const PED_COLORS = ['#f2d16b', '#7fb069', '#e07a5f', '#81b29a', '#f4a259', '#a3b18a'];

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export function createWorld(random) {
  const city = buildCity(random);
  const player = { x: 1600, y: 1350, angle: -Math.PI / 2, health: PLAYER.health, money: 60, ammo: PLAYER.startAmmo, car: null, speed: 0 };
  const cars = [];
  const peds = [];
  const enemies = [];
  const particles = [];
  const camera = { x: player.x, y: player.y };
  const state = {
    player, cars, peds, enemies, particles, city, camera,
    wanted: 0, missionIndex: 0, missionStage: 'go', missionTimer: 0,
    elapsed: 0, clock: 8 * 3600, message: '', messageTimer: 0, banner: '', bannerTimer: 0,
    storyDone: false, missionsDone: 0, carsStolen: 0, over: false, overCause: '',
    punchCooldown: 0, shootCooldown: 0, policeTimer: 0, quietTimer: 0, decayTimer: 0,
  };

  function setMessage(text, seconds) {
    state.message = text;
    state.messageTimer = seconds || 4;
  }
  function setBanner(text, seconds) {
    state.banner = text;
    state.bannerTimer = seconds || 3;
  }
  function addWanted(n) {
    if (state.wanted >= WANTED.max) return;
    state.wanted = Math.min(WANTED.max, state.wanted + n);
    state.quietTimer = 0;
    state.decayTimer = 0;
  }
  function crime(n) {
    addWanted(n);
    return EVENT_CRIME;
  }
  function spawnParticles(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      if (particles.length > 220) return;
      const a = random() * Math.PI * 2;
      particles.push({ x, y, vx: Math.cos(a) * speed * (0.4 + random() * 0.8), vy: Math.sin(a) * speed * (0.4 + random() * 0.8), life: 0.5 + random() * 0.5, color, size: 2 + random() * 4 });
    }
  }

  function spawnTrafficCar() {
    const vertical = random() < 0.5;
    const road = vertical ? ROADS_V[Math.floor(random() * ROADS_V.length)] : ROADS_H[Math.floor(random() * ROADS_H.length)];
    const dir = random() < 0.5 ? 1 : -1;
    const lane = (random() < 0.5 ? -1 : 1) * 24;
    const along = 100 + random() * (WORLD.height - 200);
    const car = {
      x: vertical ? road + lane : along, y: vertical ? along : road + lane,
      angle: vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
      speed: TRAFFIC.speedMin + random() * (TRAFFIC.speedMax - TRAFFIC.speedMin),
      color: CAR_COLORS[Math.floor(random() * CAR_COLORS.length)],
      traffic: true, parked: false, police: false, driver: true, health: CAR.health,
      axis: vertical ? 'v' : 'h', dir, lane, turnAt: 0,
    };
    cars.push(car);
    return car;
  }

  function spawnParkedCar(x, y, angle) {
    cars.push({
      x, y, angle: angle || 0, speed: 0,
      color: CAR_COLORS[Math.floor(random() * CAR_COLORS.length)],
      traffic: false, parked: true, police: false, driver: false, health: CAR.health,
      axis: 'v', dir: 1, lane: 0, turnAt: 0,
    });
  }

  function spawnPed() {
    const road = ROADS_V[Math.floor(random() * ROADS_V.length)];
    const y = 100 + random() * (WORLD.height - 200);
    peds.push({
      x: road + (random() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 22), y,
      angle: random() * Math.PI * 2, speed: PED.speed * (0.8 + random() * 0.5),
      tx: 0, ty: 0, flee: 0, color: PED_COLORS[Math.floor(random() * PED_COLORS.length)],
    });
    const p = peds[peds.length - 1];
    p.tx = p.x + (random() - 0.5) * 600;
    p.ty = p.y + (random() - 0.5) * 600;
  }

  function spawnPolice() {
    const a = random() * Math.PI * 2;
    const x = clamp(player.x + Math.cos(a) * 700, 100, WORLD.width - 100);
    const y = clamp(player.y + Math.sin(a) * 700, 100, WORLD.height - 100);
    const car = {
      x, y, angle: 0, speed: 0, color: '#2b4acb', traffic: false, parked: false,
      police: true, driver: true, health: CAR.health, axis: 'v', dir: 1, lane: 0, turnAt: 0,
    };
    cars.push(car);
    return car;
  }

  function spawnEnemies() {
    const base = { x: 1600, y: 1000 };
    for (let i = 0; i < 3; i += 1) {
      enemies.push({
        x: base.x - 120 + i * 120, y: base.y - 80 + (i % 2) * 160,
        angle: 0, health: 60, shootTimer: 1 + i * 0.4, alive: true,
      });
    }
  }

  function reset() {
    player.x = 1600; player.y = 1350; player.angle = -Math.PI / 2;
    player.health = PLAYER.health; player.money = 60; player.ammo = PLAYER.startAmmo;
    player.car = null; player.speed = 0;
    cars.length = 0; peds.length = 0; enemies.length = 0; particles.length = 0;
    for (const p of city.pickups) p.taken = false;
    for (let i = 0; i < TRAFFIC.count; i += 1) spawnTrafficCar();
    const parked = [[1750, 1350, 0], [1050, 1750, Math.PI / 2], [2250, 1050, 0], [450, 1050, Math.PI / 2], [2850, 1050, 0], [1050, 450, Math.PI / 2], [2250, 2050, 0], [1650, 2050, Math.PI / 2]];
    for (const [x, y, a] of parked) spawnParkedCar(x, y, a);
    for (let i = 0; i < 18; i += 1) spawnPed();
    state.wanted = 0; state.missionIndex = 0; state.missionStage = 'go'; state.missionTimer = 0;
    state.elapsed = 0; state.clock = 8 * 3600; state.storyDone = false; state.missionsDone = 0;
    state.carsStolen = 0; state.over = false; state.overCause = '';
    state.punchCooldown = 0; state.shootCooldown = 0; state.policeTimer = 0;
    state.quietTimer = 0; state.decayTimer = 0;
    camera.x = player.x; camera.y = player.y;
    setMessage('Vera: Rook. You are back. I have work — check the mission at the top.', 6);
  }

  function currentMission() { return MISSIONS[state.missionIndex] || null; }

  function completeMission() {
    const m = currentMission();
    if (!m) return 0;
    player.money += m.reward;
    state.missionsDone += 1;
    setBanner(`Mission complete: ${m.title}  +$${m.reward}`, 4);
    state.missionIndex += 1;
    state.missionStage = 'go';
    state.missionTimer = 0;
    if (state.missionIndex >= MISSIONS.length) {
      state.storyDone = true;
      setBanner('You own Coral Bay. Free roam — keep the city yours.', 6);
      setMessage('Story complete. The Marlin Crew is paid. Coral Bay is yours.', 6);
    } else {
      const next = MISSIONS[state.missionIndex];
      setMessage(`${next.contact}: ${next.brief}`, 6);
      if (next.wanted) addWanted(next.wanted);
    }
    return EVENT_MISSION;
  }

  function hitBuildingDamage(car, dt) {
    if (Math.abs(car.speed) < 150) return;
    car.health -= 10 * dt;
    if (car.health <= 0 && car === player.car) {
      spawnParticles(car.x, car.y, '#888', 20, 120);
    }
  }

  // One fixed step. ctl: {mx, my, run, enter, punch, shoot, aim} — aim is a world
  // angle, or null to shoot where the player faces. harmless: title backdrop.
  function step(dt, ctl, harmless) {
    let events = 0;
    state.elapsed += dt;
    state.clock = (8 * 3600 + state.elapsed * 60) % 86400;
    if (state.messageTimer > 0) state.messageTimer -= dt;
    if (state.bannerTimer > 0) state.bannerTimer -= dt;
    if (state.punchCooldown > 0) state.punchCooldown -= dt;
    if (state.shootCooldown > 0) state.shootCooldown -= dt;
    const mission = currentMission();

    // --- player ---
    if (!harmless && !state.over) {
      if (player.car) {
        const car = player.car;
        // Throttle: my -1 is up (accelerate), +1 is brake/reverse.
        if (ctl.my < 0) car.speed += CAR.accel * dt;
        else if (ctl.my > 0) car.speed -= CAR.brake * dt;
        else car.speed *= Math.pow(0.4, dt);
        if (ctl.my > 0 && car.speed < 0) car.speed = Math.max(car.speed, -CAR.reverse);
        car.speed = clamp(car.speed, -CAR.reverse, CAR.maxSpeed);
        const steer = ctl.mx * CAR.turn * clamp(Math.abs(car.speed) / 220, 0.3, 1) * (car.speed < 0 ? -1 : 1);
        car.angle += steer * dt;
        car.x += Math.cos(car.angle) * car.speed * dt;
        car.y += Math.sin(car.angle) * car.speed * dt;
        car.x = clamp(car.x, 40, WORLD.width - 40);
        car.y = clamp(car.y, 40, WORLD.height - 40);
        player.x = car.x; player.y = car.y; player.angle = car.angle; player.speed = car.speed;
        if (resolveBuildings(city, car, 30)) {
          car.speed *= -0.25;
          hitBuildingDamage(car, dt);
          if (Math.abs(car.speed) > 120) { events |= EVENT_CRASH; spawnParticles(car.x, car.y, '#aaa', 10, 100); }
        }
        if (car.health <= 0) {
          spawnParticles(car.x, car.y, '#666', 14, 90);
          player.car = null;
          player.x = car.x + 60; player.y = car.y;
          setMessage('Your car is wrecked. Find another.', 4);
        }
        if (ctl.enter) {
          player.car = null;
          player.x = car.x + 60; player.y = car.y;
          player.speed = 0;
          car.parked = true;
          car.speed = 0;
        }
      } else {
        const len = Math.hypot(ctl.mx, ctl.my) || 1;
        const speed = ctl.run ? PLAYER.run : PLAYER.walk;
        const nx = ctl.mx / len, ny = ctl.my / len;
        if (ctl.mx || ctl.my) {
          player.x += nx * speed * dt;
          player.y += ny * speed * dt;
          player.angle = Math.atan2(ny, nx);
        }
        player.x = clamp(player.x, 20, WORLD.width - 20);
        player.y = clamp(player.y, 20, WORLD.height - 20);
        if (player.y > 2320) player.y = 2320;
        resolveBuildings(city, player, PLAYER.radius);
        if (ctl.enter) {
          let best = null, bestD = 80;
          for (const car of cars) {
            const d = dist(player, car);
            if (d < bestD) { bestD = d; best = car; }
          }
          if (best) {
            if (best.traffic && best.driver) {
              best.driver = false;
              best.traffic = false;
              spawnPed();
              events |= crime(1);
              setMessage('Car stolen. The police will be looking.', 3);
            }
            if (best.police) { events |= crime(1); }
            player.car = best;
            best.parked = false;
            best.speed = 0;
            state.carsStolen += 1;
          }
        }
        if (ctl.punch && state.punchCooldown <= 0) {
          state.punchCooldown = PLAYER.punchCooldown;
          const px = player.x + Math.cos(player.angle) * PLAYER.punchRange;
          const py = player.y + Math.sin(player.angle) * PLAYER.punchRange;
          for (const e of enemies) {
            if (e.alive && Math.hypot(e.x - px, e.y - py) < 46) {
              e.health -= PLAYER.punchDamage;
              spawnParticles(e.x, e.y, '#e5534b', 8, 90);
              if (e.health <= 0) e.alive = false;
            }
          }
          for (const p of peds) {
            if (Math.hypot(p.x - px, p.y - py) < 40) { p.flee = 3; events |= crime(1); }
          }
        }
        if (ctl.shoot && player.ammo > 0 && state.shootCooldown <= 0) {
          state.shootCooldown = PLAYER.shootCooldown;
          player.ammo -= 1;
          events |= EVENT_SHOT;
          const aim = ctl.aim === null || ctl.aim === undefined ? player.angle : ctl.aim;
          spawnParticles(player.x + Math.cos(aim) * 22, player.y + Math.sin(aim) * 22, '#f2c94c', 4, 60);
          let hitAny = false;
          for (const e of enemies) {
            if (!e.alive) continue;
            const d = Math.hypot(e.x - player.x, e.y - player.y);
            const a = Math.atan2(e.y - player.y, e.x - player.x);
            if (d < PLAYER.shootRange && Math.abs(((a - aim + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.18) {
              e.health -= PLAYER.shootDamage;
              spawnParticles(e.x, e.y, '#e5534b', 8, 90);
              if (e.health <= 0) e.alive = false;
              hitAny = true;
            }
          }
          if (!hitAny) events |= crime(1);
        }
      }
    }

    // --- traffic ---
    for (const car of cars) {
      if (!car.traffic || car.police) continue;
      if (car.axis === 'v') {
        car.y += car.dir * car.speed * dt;
        // Stay in its lane on the nearest vertical road.
        const roadX = ROADS_V.reduce((a, b) => Math.abs(b - car.x) < Math.abs(a - car.x) ? b : a, ROADS_V[0]);
        car.x = roadX + car.lane;
        if (car.y < 60) { car.y = 60; car.dir = 1; }
        if (car.y > WORLD.height - 60) { car.y = WORLD.height - 60; car.dir = -1; }
        // At an intersection, sometimes turn onto the cross road.
        for (const cy of ROADS_H) {
          if (Math.abs(car.y - cy) < 4 && random() < 0.25) {
            car.axis = 'h'; car.dir = random() < 0.5 ? 1 : -1; car.lane = (random() < 0.5 ? -1 : 1) * 24;
            car.y = cy + car.lane; car.angle = car.dir > 0 ? 0 : Math.PI;
            break;
          }
        }
      } else {
        car.x += car.dir * car.speed * dt;
        const roadY = ROADS_H.reduce((a, b) => Math.abs(b - car.y) < Math.abs(a - car.y) ? b : a, ROADS_H[0]);
        car.y = roadY + car.lane;
        if (car.x < 60) { car.x = 60; car.dir = 1; }
        if (car.x > WORLD.width - 60) { car.x = WORLD.width - 60; car.dir = -1; }
        for (const cx of ROADS_V) {
          if (Math.abs(car.x - cx) < 4 && random() < 0.25) {
            car.axis = 'v'; car.dir = random() < 0.5 ? 1 : -1; car.lane = (random() < 0.5 ? -1 : 1) * 24;
            car.x = cx + car.lane; car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
            break;
          }
        }
      }
      car.angle = car.axis === 'v' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
    }

    // --- pedestrians ---
    for (let i = peds.length - 1; i >= 0; i -= 1) {
      const p = peds[i];
      const dPlayer = dist(p, player);
      if (p.flee > 0) {
        p.flee -= dt;
        const a = Math.atan2(p.y - player.y, p.x - player.x);
        p.x += Math.cos(a) * PED.fleeSpeed * dt;
        p.y += Math.sin(a) * PED.fleeSpeed * dt;
      } else if (player.car && dPlayer < 140 && Math.abs(player.speed) > 150) {
        p.flee = 3;
      } else {
        const d = Math.hypot(p.tx - p.x, p.ty - p.y);
        if (d < 12) {
          p.tx = clamp(p.x + (random() - 0.5) * 700, 60, WORLD.width - 60);
          p.ty = clamp(p.y + (random() - 0.5) * 700, 60, WORLD.height - 60);
        } else {
          p.angle = Math.atan2(p.ty - p.y, p.tx - p.x);
          p.x += Math.cos(p.angle) * p.speed * dt;
          p.y += Math.sin(p.angle) * p.speed * dt;
        }
      }
      p.x = clamp(p.x, 20, WORLD.width - 20);
      p.y = clamp(p.y, 20, WORLD.height - 20);
      resolveBuildings(city, p, 10);
      // Run over by the player's car.
      if (player.car && dPlayer < 34 && Math.abs(player.speed) > 60) {
        peds.splice(i, 1);
        events |= crime(1);
        spawnParticles(p.x, p.y, '#e5534b', 10, 80);
        setMessage('You hit a pedestrian. The police are coming.', 3);
      }
    }

    // --- police ---
    const policeCars = cars.filter((c) => c.police);
    if (!harmless && state.wanted > 0 && policeCars.length < Math.min(1 + state.wanted, POLICE.maxCars)) {
      state.policeTimer -= dt;
      if (state.policeTimer <= 0) {
        spawnPolice();
        state.policeTimer = 4;
      }
    }
    for (const car of policeCars) {
      const a = Math.atan2(player.y - car.y, player.x - car.x);
      let da = ((a - car.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      car.angle += clamp(da, -2.2 * dt, 2.2 * dt);
      car.speed = POLICE.speed;
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      resolveBuildings(city, car, 30);
      if (dist(car, player) < 52 && !state.over) {
        if (player.car) {
          player.car.health -= POLICE.ramDamage * dt * 4;
          car.speed *= 0.5;
          if (Math.abs(player.car.speed) > 100) events |= EVENT_CRASH;
        } else if (state.punchCooldown <= 0) {
          player.health -= 12;
          state.punchCooldown = 0.6;
          events |= EVENT_HIT;
          spawnParticles(player.x, player.y, '#e5534b', 8, 80);
        }
      }
    }
    if (state.wanted === 0) {
      for (let i = cars.length - 1; i >= 0; i -= 1) {
        if (cars[i].police && dist(cars[i], player) > 900) cars.splice(i, 1);
      }
    }

    // --- wanted decay ---
    if (!harmless) {
      state.quietTimer += dt;
      if (state.wanted > 0 && state.quietTimer > WANTED.quietSeconds) {
        state.decayTimer += dt;
        if (state.decayTimer > WANTED.decaySeconds) {
          state.wanted -= 1;
          state.decayTimer = 0;
          state.quietTimer = 0;
          if (state.wanted === 0) setMessage('You lost them. Stay clean.', 3);
        }
      }
    }

    // --- enemies (mission 3) ---
    for (const e of enemies) {
      if (!e.alive) continue;
      const d = dist(e, player);
      e.angle = Math.atan2(player.y - e.y, player.x - e.x);
      if (d > 220) {
        e.x += Math.cos(e.angle) * 90 * dt;
        e.y += Math.sin(e.angle) * 90 * dt;
      }
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && d < 420 && !player.car && !state.over) {
        e.shootTimer = 1.2 + random() * 0.6;
        if (random() < 0.6) {
          player.health -= 6;
          events |= EVENT_HIT;
          spawnParticles(player.x, player.y, '#e5534b', 5, 60);
        }
      }
    }

    // --- pickups ---
    if (!harmless) {
      for (const p of city.pickups) {
        if (p.taken) continue;
        if (dist(p, player) < 36) {
          p.taken = true;
          if (p.kind === 'cash') player.money += p.value;
          else if (p.kind === 'health') player.health = Math.min(PLAYER.health, player.health + p.value);
          else player.ammo += p.value;
          events |= EVENT_PICKUP;
          spawnParticles(p.x, p.y, PALETTE.gold, 10, 70);
        }
      }
    }

    // --- missions ---
    if (!harmless && mission && !state.over) {
      const t = mission.target;
      const d = Math.hypot(player.x - t.x, player.y - t.y);
      if (state.missionStage === 'go') {
        if (mission.id === 3 && d < 140 && !player.car) {
          state.missionStage = 'fight';
          spawnEnemies();
          setMessage('Marcus: There they are. Three Sharks. Make it count.', 5);
        } else if (mission.id !== 3 && d < 110) {
          if (mission.id === 1 && !player.car) {
            setMessage('You need a car for this one. Steal one (E) and drive here.', 3);
          } else if (mission.id === 2 && !player.car) {
            setMessage('The package goes by car. Bring one.', 3);
          } else {
            events |= completeMission();
          }
        }
      } else if (state.missionStage === 'fight') {
        if (enemies.every((e) => !e.alive)) {
          events |= completeMission();
        }
      }
      if (mission.id === 4 && mission.timeLimit) {
        state.missionTimer += dt;
        if (state.missionTimer > mission.timeLimit) {
          state.missionTimer = 0;
          setMessage('Too slow — the net closed in. Try the getaway again.', 4);
        }
      }
    }

    // --- particles ---
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }

    // --- player down ---
    if (!harmless && player.health <= 0 && !state.over) {
      state.over = true;
      state.overCause = 'wasted';
      events |= EVENT_OVER;
    }

    // --- camera ---
    camera.x += (player.x - camera.x) * Math.min(1, dt * 5);
    camera.y += (player.y - camera.y) * Math.min(1, dt * 5);
    return events;
  }

  reset();
  return { state, reset, step, currentMission };
}
