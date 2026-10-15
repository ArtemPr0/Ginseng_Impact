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

  /**
   * @param free Debug mode (`?at=` in the URL): behaves as if the pointer were locked so screenshots and
   * automated checks work without a user gesture; mouse look uses plain mouse movement.
   */
  constructor(private readonly canvas: HTMLCanvasElement, private readonly free = false) {
    this.locked = free;
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.down.add(e.code);
      // Presses only count in play: a key pressed in a dialogue or the bag must not fire once the game resumes.
      if (this.locked && !this.uiOpen) this.pressed.add(e.code);
      if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.releaseAll());
    canvas.addEventListener('mousedown', (e) => {
      if (!this.locked && !this.free) {
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
      if (this.free) return;
      this.locked = document.pointerLockElement === this.canvas;
      this.pressed.clear();
      this.mousePressed.clear();
      if (!this.locked) this.releaseAll();
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** Lets go of every key and button (the window lost focus or the pointer): a held RMB must not stay charging. */
  private releaseAll(): void {
    this.down.clear();
    for (const b of this.mouseDownSet) this.mouseReleased.add(b);
    this.mouseDownSet.clear();
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
