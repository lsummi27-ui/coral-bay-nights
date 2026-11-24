// Keyboard and mouse input. Held keys give a movement vector; one-shot presses
// (confirm, pause, enter a car, punch, mute) are queued as bit flags and taken
// once by the loop, so a press between two frames is never lost or counted twice.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MUTE = 16;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let shootHeld = false;
  let mouse = { x: 0, y: 0 };

  function press(code) {
    if (CONFIRM.has(code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(code)) actions |= ACTION_PAUSE;
    else if (code === 'KeyE') actions |= ACTION_ENTER;
    else if (code === 'KeyF') actions |= ACTION_PUNCH;
    else if (code === 'KeyM') actions |= ACTION_MUTE;
  }

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space') shootHeld = true;
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      keys.add(event.code);
      event.preventDefault();
      return;
    }
    if (event.code === 'Space') { event.preventDefault(); return; }
    if (!event.repeat) press(event.code);
  });
  window.addEventListener('keyup', (event) => {
    if (event.code === 'Space') shootHeld = false;
    keys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    keys.clear();
    shootHeld = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button === 0) actions |= ACTION_CONFIRM;
  });

  return {
    /** Movement vector, each component -1, 0 or 1, plus whether Shift is held. */
    move() {
      const has = (set) => [...keys].some((k) => set.has(k));
      return {
        x: (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0),
        y: (has(DOWN) ? 1 : 0) - (has(UP) ? 1 : 0),
        run: keys.has('ShiftLeft') || keys.has('ShiftRight'),
      };
    },
    shootHeld() { return shootHeld; },
    mouse() { return mouse; },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
