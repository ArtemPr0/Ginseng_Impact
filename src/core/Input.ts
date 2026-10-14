/** Keyboard + pointer-lock mouse input with per-step edge detection. Call `endStep()` after each fixed update. */
export class Input {
  private readonly down = new Set<string>();
  private readonly pressed = new Set<string>();
  private readonly mouseDownSet = new Set<number>();
  private readonly mousePressed = new Set<number>();
  private readonly mouseReleased = new Set<number>();
  /** When true, keys and mouse are swallowed by a UI panel. */
  uiOpen = false;
  mouseDX = 0;
  mouseDY = 0;
  locked = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.down.add(e.code);
      this.pressed.add(e.code);
      if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());
    canvas.addEventListener('mousedown', (e) => {
      if (!this.locked) {
        if (!this.uiOpen) void canvas.requestPointerLock();
        return;
      }
      this.mouseDownSet.add(e.button);
      this.mousePressed.add(e.button);
    });
    window.addEventListener('mouseup', (e) => { if (this.mouseDownSet.has(e.button)) this.mouseReleased.add(e.button); this.mouseDownSet.delete(e.button); });
    window.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) this.down.clear();
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  justPressed(code: string): boolean {
    return this.pressed.has(code);
  }

  mouseDown(button: number): boolean {
    return this.mouseDownSet.has(button);
  }

  mouseJustPressed(button: number): boolean {
    return this.mousePressed.has(button);
  }

  mouseJustReleased(button: number): boolean {
    return this.mouseReleased.has(button);
  }

  /** Releases the pointer so a panel can be used. */
  unlock(): void {
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  /** Raw WASD axis in input space: x = right, z = forward (positive = forward). */
  moveAxis(): { x: number; z: number } {
    const x = (this.isDown('KeyD') ? 1 : 0) - (this.isDown('KeyA') ? 1 : 0);
    const z = (this.isDown('KeyW') ? 1 : 0) - (this.isDown('KeyS') ? 1 : 0);
    const len = Math.hypot(x, z);
    return len > 1 ? { x: x / len, z: z / len } : { x, z };
  }

  /** Returns and clears accumulated mouse motion. */
  takeMouseDelta(): { dx: number; dy: number } {
    const d = { dx: this.mouseDX, dy: this.mouseDY };
    this.mouseDX = 0;
    this.mouseDY = 0;
    return d;
  }

  endStep(): void {
    this.pressed.clear();
    this.mousePressed.clear();
    this.mouseReleased.clear();
  }
}
