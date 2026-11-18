// Neon Bay — keyboard and mouse, with edge detection: `down` tells you a
// key is held, `pressed` tells you it went down this frame. The game loop
// calls endFrame() after each update so edges only fire once.

export function createInput(canvas) {
  const keys = new Set();
  const justPressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false, clickedX: 0, clickedY: 0 };

  const GAME_KEYS = new Set([
    'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'Space', 'ShiftLeft', 'ShiftRight', 'KeyE', 'KeyF', 'KeyR', 'KeyP', 'KeyM', 'Enter', 'Escape',
  ]);

  function onKeyDown(e) {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (!e.repeat) {
      keys.add(e.code);
      justPressed.add(e.code);
    }
  }
  function onKeyUp(e) {
    keys.delete(e.code);
  }
  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  }
  function onMouseDown(e) {
    onMouseMove(e);
    mouse.down = true;
    mouse.clicked = true;
    mouse.clickedX = mouse.x;
    mouse.clickedY = mouse.y;
  }
  function onMouseUp() {
    mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    keys,
    mouse,
    down(code) {
      return keys.has(code);
    },
    pressed(code) {
      return justPressed.has(code);
    },
    // WASD / arrows as a -1..1 pair.
    moveAxis() {
      let x = 0;
      let y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      return { x, y };
    },
    sprint() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
    endFrame() {
      justPressed.clear();
      mouse.clicked = false;
    },
  };
}
