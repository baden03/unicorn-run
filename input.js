// v1.2.1 - Input handling

export const keys = new Set();

export function setupInput(joystickLeft, joystickRight, callbacks) {
  const joystickState = {
    left: { active: false, dx: 0, dy: 0, id: null, stick: joystickLeft?.querySelector(".joystick-stick") },
    right: { active: false, dx: 0, dy: 0, id: null, stick: joystickRight?.querySelector(".joystick-stick") },
  };

  // Keyboard input
  document.addEventListener("keydown", (e) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "KeyW", "KeyA", "KeyS", "KeyD"].includes(e.code)) {
      e.preventDefault();
    }
    keys.add(e.code);
    if (e.code === "Space" && callbacks.onSpace) {
      callbacks.onSpace();
    }
  });

  document.addEventListener("keyup", (e) => keys.delete(e.code));

  // Button handlers
  if (callbacks.startButton) {
    callbacks.startButton.addEventListener("click", (e) => {
      e.preventDefault();
      if (callbacks.onStart) callbacks.onStart();
    });
  }

  if (callbacks.pauseButton) {
    callbacks.pauseButton.addEventListener("click", (e) => {
      e.preventDefault();
      if (callbacks.onPause) callbacks.onPause();
    });
  }

  // Joystick handlers
  function joystickHandlers(el, side) {
    const state = joystickState[side];
    const stick = state.stick;
    const start = (e) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      state.id = touch.identifier;
      state.active = true;
      el.classList.add("active");
      move(touch);
    };
    const move = (touch) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = touch.clientX - cx;
      const dy = touch.clientY - cy;
      const dist = Math.min(Math.sqrt(dx * dx + dy * dy), rect.width / 2 - 18);
      const angle = Math.atan2(dy, dx);
      const sx = Math.cos(angle) * dist;
      const sy = Math.sin(angle) * dist;
      stick.style.transform = `translate(calc(-50% + ${sx}px), calc(-50% + ${sy}px))`;
      const absX = Math.abs(Math.cos(angle));
      const absY = Math.abs(Math.sin(angle));
      if (dist < 10) { state.dx = 0; state.dy = 0; return; }
      if (absX > absY) { state.dx = Math.cos(angle) > 0 ? 1 : -1; state.dy = 0; }
      else { state.dy = Math.sin(angle) > 0 ? 1 : -1; state.dx = 0; }
    };
    const handleMove = (e) => {
      e.preventDefault();
      const touch = Array.from(e.touches).find((t) => t.identifier === state.id);
      if (touch) move(touch);
    };
    const end = (e) => {
      const touch = Array.from(e.changedTouches).find((t) => t.identifier === state.id);
      if (!touch) return;
      state.active = false;
      state.id = null;
      state.dx = 0;
      state.dy = 0;
      stick.style.transform = "translate(-50%, -50%)";
      el.classList.remove("active");
    };
    el.addEventListener("touchstart", start, { passive: false });
    el.addEventListener("touchmove", handleMove, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
  }

  if (joystickLeft) joystickHandlers(joystickLeft, "left");
  if (joystickRight) joystickHandlers(joystickRight, "right");

  return joystickState;
}

