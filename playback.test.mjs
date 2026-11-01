import { test } from "node:test";
import assert from "node:assert/strict";
import { Playback, partDemoAngles } from "./playback.mjs";
function setup(reduced = false) {
  let pose = { joint: 0 };
  const events = [];
  const p = new Playback({
    read: () => pose,
    apply: (v) => Object.assign(pose, v),
    event: (e) => events.push(e),
    reduced: () => reduced,
  });
  return { p, pose, events };
}
test("pause freezes pose and interrupted phase; resume uses elapsed movement", () => {
  const { p, pose } = setup();
  p.start([{ targets: { joint: 60 }, moveMs: 1000, holdMs: 500 }]);
  p.tick(0);
  p.tick(400);
  const saved = pose.joint;
  p.pause();
  p.tick(9000);
  assert.equal(pose.joint, saved);
  p.resume();
  p.tick(10000);
  p.tick(10600);
  assert.equal(pose.joint, 60);
  assert.equal(p.phase, "hold");
});
test("hold excludes paused wall time and advances ordered sequence", () => {
  const { p, pose } = setup();
  p.start([
    { targets: { joint: 45 }, moveMs: 100, holdMs: 1000 },
    { targets: { joint: 0 }, moveMs: 100 },
  ]);
  p.tick(0);
  p.tick(100);
  p.tick(500);
  p.pause();
  p.resume();
  p.tick(9000);
  p.tick(9599);
  assert.equal(p.index, 0);
  p.tick(9600);
  assert.equal(p.index, 1);
  p.tick(9700);
  assert.equal(pose.joint, 0);
});
test("restart cancels prior target and stop holds current pose", () => {
  const { p, pose } = setup();
  p.start([{ targets: { joint: 75 } }]);
  p.tick(0);
  p.tick(200);
  p.start([{ targets: { joint: 10 } }]);
  p.tick(300);
  p.tick(1000);
  assert.equal(pose.joint, 10);
  p.stop();
  p.tick(9000);
  assert.equal(pose.joint, 10);
});
test("reduced motion reaches exact target", () => {
  const { p, pose } = setup(true);
  p.start([{ targets: { joint: 45 } }]);
  p.tick(0);
  p.tick(1);
  assert.equal(pose.joint, 45);
});

test("part Play requests the chosen target first, and moves within its first frames", () => {
  const { p, pose, events } = setup();
  p.start(
    partDemoAngles(0, 45).map((v) => ({ targets: { joint: v }, holdMs: 1000 })),
    { loop: true },
  );
  assert.equal(p.steps[0].targets.joint, 45);
  p.tick(0);
  p.tick(100);
  assert.ok(pose.joint > 0);
  assert.equal(p.phase, "move");
  assert.deepEqual(events, ["request"]);
});
test("restarting at the chosen target opens immediately instead of repeating an idle target", () => {
  assert.deepEqual(partDemoAngles(45, 45), [0, 45]);
  assert.deepEqual(partDemoAngles(20, 45), [45, 0]);
});
