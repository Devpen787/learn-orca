// Elapsed-time playback: pause never advances either movement or hold time.
export class Playback {
  constructor({ read, apply, event = () => {}, reduced = () => false }) {
    Object.assign(this, { read, apply, event, reduced });
    this.state = "ready";
    this.phase = "idle";
  }
  start(steps, { loop = false } = {}) {
    this.steps = steps.map((s) => ({ ...s, targets: { ...s.targets } }));
    this.loop = loop;
    this.index = 0;
    this.elapsed = 0;
    this.last = null;
    this.state = "playing";
    this.enter();
  }
  enter() {
    this.phase = "move";
    this.origin = { ...this.read() };
    this.elapsed = 0;
    this.event("request", this);
  }
  tick(now) {
    if (this.state !== "playing") return;
    if (this.last === null) {
      this.last = now;
      return;
    }
    let dt = Math.max(0, now - this.last);
    this.last = now;
    this.elapsed += dt;
    const step = this.steps[this.index];
    const duration = this.reduced() ? 0 : (step.moveMs ?? 700);
    if (this.phase === "move") {
      const t = duration ? Math.min(1, this.elapsed / duration) : 1,
        e = t * t * (3 - 2 * t);
      this.apply(
        Object.fromEntries(
          Object.entries(step.targets).map(([k, v]) => [
            k,
            this.origin[k] + (v - this.origin[k]) * e,
          ]),
        ),
      );
      if (t === 1) {
        this.phase = "hold";
        this.elapsed = 0;
        this.event("hold", this);
      }
    } else if (this.elapsed >= (step.holdMs ?? 0)) {
      if (this.index + 1 < this.steps.length) {
        this.index++;
        this.enter();
      } else if (this.loop) {
        this.index = 0;
        this.enter();
      } else {
        this.state = "stopped";
        this.phase = "done";
        this.event("done", this);
      }
    }
  }
  pause() {
    if (this.state !== "playing") return;
    this.state = "paused";
    this.last = null;
    this.event("pause", this);
  }
  resume() {
    if (this.state !== "paused") return;
    this.state = "playing";
    this.last = null;
    this.event("resume", this);
  }
  stop() {
    this.state = "stopped";
    this.last = null;
    this.event("stop", this);
  }
}
export const SCENES = [
  { name: "assembly", part: null },
  { name: "knuckle", part: "KNUCKLE" },
  { name: "finger", part: "KNUCKLE" },
  { name: "sequence", part: null },
  { name: "touch", part: "FINGERTIPS" },
];

// Start a part demonstration with a visible change, including restart at its target.
export function partDemoAngles(current, target) {
  return Math.abs(current - target) < 0.5 ? [0, target] : [target, 0];
}
