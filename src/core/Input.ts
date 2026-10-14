/** Keyboard + pointer-lock mouse input with per-step edge detection. Call `endStep()` after each fixed update. */
export class Input {
  private readonly down = new Set<string>();
  private readonly pressed = new Set<string>();
  private readonly mouseDownSet = new Set<number>();
  private readonly mousePressed = new Set<number>();
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
        void canvas.requestPointerLock();
        return;
      }
      this.mouseDownSet.add(e.button);
      this.mousePressed.add(e.button);
    });
    window.addEventListener('mouseup', (e) => this.mouseDownSet.delete(e.button));
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
  }
}
