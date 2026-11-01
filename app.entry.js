import { lessonContent, setupUrl } from "./lesson-content.mjs";
import { icon } from "./icons.mjs";
import { Playback, SCENES, partDemoAngles } from "./playback.mjs";
import * as T from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import URDFLoader from "urdf-loader";
const $ = (id) => document.getElementById(id),
  rad = T.MathUtils.degToRad;
const fingers = ["index", "middle", "ring", "pinky"];
const lessons = [
  ["Meet the hand", "Identify the parts, then put them in motion."],
  ["Move a joint", "Change one target. See one joint move."],
  ["Shape a finger", "Two joints, two different jobs."],
  ["Run a sequence", "Turn a pose into a repeatable movement."],
  ["Discover touch", "Movement asks. Sensing tells you more."],
];
let lesson = 0,
  tab = "overview",
  ready = false,
  robot,
  selected = "index",
  angle = 35,
  mcp = 0,
  pip = 0,
  speed = 1,
  seen = new Set(),
  done = new Set(),
  viewDistance = 0.4;
try {
  done = new Set(
    JSON.parse(localStorage.getItem("learn-orca-progress-v2") || "[]").filter(
      (n) => Number.isInteger(n) && n >= 0 && n < 5,
    ),
  );
} catch {}
const lessonThumbs = [];
const pose = Object.fromEntries([
  ...fingers.flatMap((f) => [
    ["" + f + "_mcp", 0],
    ["" + f + "_pip", 0],
  ]),
  ["wrist", 0],
]);
const parts = [
  {
    name: "FINGERTIPS",
    link: "right_index_fingertip",
    side: "left",
    at: 0.1,
    short: "Where the hand meets the world.",
    text: "Fingertips contact objects. A touch-equipped hand adds contact information to movement commands.",
  },
  {
    name: "KNUCKLE",
    link: "right_index_pp",
    side: "left",
    at: 0.37,
    short: "Bend a finger at its base.",
    text: "The knuckle changes the finger’s angle at the palm. You’ll control one in the next lesson.",
  },
  {
    name: "ACTUATION ASSEMBLY",
    link: "right_tower",
    side: "left",
    at: 0.71,
    short: "The drive system behind the movement.",
    text: "The published extended assembly shows the drive structure, cooling fans and controller hardware. Motors pull tendons to move the joints.",
  },
  {
    name: "MIDDLE JOINT",
    link: "right_middle_ip",
    side: "right",
    at: 0.18,
    short: "Shape the bend along a finger.",
    text: "This joint bends the finger further along its length. Control it separately from the knuckle to make different shapes.",
  },
  {
    name: "PALM",
    link: "right_palm",
    side: "right",
    at: 0.44,
    short: "The structure supporting the fingers.",
    text: "The palm connects the fingers to the wrist. Compare the soft contact surfaces with the rigid supporting parts.",
  },
  {
    name: "WRIST",
    link: "right_wrist_jointbody",
    side: "right",
    at: 0.7,
    short: "Position the hand above its base.",
    text: "The wrist joins the hand to the actuation assembly. This explorer shows the full published research assembly.",
  },
];
let covers = false;
const coverMeshes = [];
const scene = new T.Scene(),
  camera = new T.PerspectiveCamera(34, 1, 0.001, 20);
camera.up.set(0, 0, 1);
const toonRamp = new T.DataTexture(
  new Uint8Array([85, 155, 215, 255]),
  4,
  1,
  T.RedFormat,
);
toonRamp.minFilter = toonRamp.magFilter = T.NearestFilter;
toonRamp.needsUpdate = true;
const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.max(1.5, Math.min(devicePixelRatio, 2)));
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = T.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFShadowMap;
const pmrem = new T.PMREMGenerator(renderer),
  room = new RoomEnvironment();
scene.environment = pmrem.fromScene(room, 0.04).texture;
room.dispose();
pmrem.dispose();
$("viewer").append(renderer.domElement);
renderer.domElement.setAttribute("aria-hidden", "true");
scene.add(new T.AmbientLight(0xffffff, 0.85));
const sun = new T.DirectionalLight(0xffffff, 2.0);
sun.position.set(-0.6, -1.2, 2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = sun.shadow.camera.bottom = -0.6;
sun.shadow.camera.right = sun.shadow.camera.top = 0.6;
sun.shadow.camera.near = 0.1;
sun.shadow.camera.far = 5;
sun.shadow.bias = -0.00015;
scene.add(sun);
const ground = new T.Mesh(
  new T.PlaneGeometry(5, 5),
  new T.ShadowMaterial({ color: 0x5b4c36, opacity: 0.16 }),
);
ground.receiveShadow = true;
scene.add(ground);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableZoom = true;
controls.enablePan = true;
controls.screenSpacePanning = true;
controls.mouseButtons.LEFT = T.MOUSE.PAN;
controls.enableDamping = false;
controls.minPolarAngle = 0.2;
controls.maxPolarAngle = Math.PI - 0.2;
controls.touches.ONE = T.TOUCH.PAN;
renderer.domElement.style.touchAction = "pan-y";
let center = new T.Vector3(),
  defaultDistance = 0.5;
const defaultDirection = new T.Vector3(1, -2, 0.8).normalize();
function fit() {
  if (!ready) return;
  robot.updateMatrixWorld(true);
  const box = new T.Box3().setFromObject(robot);
  // Reserve the complete envelope of the existing assembly illustration.
  if (lesson === 0) box.max.z += 0.055;
  center = box.getCenter(new T.Vector3());
  const host = $("stage"),
    stageRect = host.getBoundingClientRect();
  const topSafe = Math.max(
      16,
      document.querySelector("header").getBoundingClientRect().bottom -
        stageRect.top +
        12,
    ),
    bottomSafe = 60;
  const dir = defaultDirection.clone(),
    right = new T.Vector3().crossVectors(camera.up, dir).normalize(),
    up = new T.Vector3().crossVectors(dir, right).normalize();
  const tangent = Math.tan(rad(camera.fov) / 2),
    reserve = host.clientWidth > 680 ? 0.75 : 0.8;
  const high = 1 - (2 * topSafe) / host.clientHeight,
    low = -1 + (2 * bottomSafe) / host.clientHeight;
  const shift = (topSafe - bottomSafe) / host.clientHeight,
    available = Math.max(0.2, 1 - (topSafe + bottomSafe) / host.clientHeight);
  let distance = 0;
  for (const x of [box.min.x, box.max.x])
    for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z]) {
        const v = new T.Vector3(x, y, z).sub(center),
          depth = v.dot(dir),
          vertical = v.dot(up) / tangent;
        distance = Math.max(
          distance,
          Math.abs(v.dot(right)) / (tangent * camera.aspect * reserve) + depth,
          (vertical + high * depth) / available,
          (-vertical - low * depth) / available,
        );
      }
  defaultDistance = distance * 1.04;
  controls.target
    .copy(center)
    .addScaledVector(up, shift * tangent * defaultDistance);
  camera.position.copy(controls.target).addScaledVector(dir, defaultDistance);
  viewDistance = defaultDistance;
  controls.update();
  host.dataset.distance = viewDistance.toFixed(4);
}

function zoom(f) {
  const offset = camera.position.clone().sub(controls.target);
  offset.setLength(
    T.MathUtils.clamp(
      offset.length() * f,
      defaultDistance * 0.55,
      defaultDistance * 1.6,
    ),
  );
  camera.position.copy(controls.target).add(offset);
  viewDistance = offset.length();
  controls.update();
  $("stage").dataset.distance = viewDistance.toFixed(4);
}
function turn(a) {
  const off = camera.position.clone().sub(controls.target);
  off.applyAxisAngle(camera.up, a);
  camera.position.copy(controls.target).add(off);
  controls.update();
}
$("fit").onclick = () => {
  cameraMotion = null;
  fit();
};
$("in").onclick = () => zoom(0.85);
$("out").onclick = () => zoom(1 / 0.85);
$("left").onclick = () => turn(0.25);
$("right").onclick = () => turn(-0.25);
$("viewer").onkeydown = (e) => {
  if (e.key === "ArrowLeft") turn(0.2);
  else if (e.key === "ArrowRight") turn(-0.2);
  else if (e.key === "+") zoom(0.85);
  else if (e.key === "-") zoom(1 / 0.85);
  else if (e.key.toLowerCase() === "r") fit();
  else return;
  e.preventDefault();
};
function resize() {
  const el = $("viewer");
  renderer.setSize(el.clientWidth, el.clientHeight, false);
  camera.aspect = el.clientWidth / el.clientHeight;
  camera.updateProjectionMatrix();
  if (!cameraMotion) fit();
}
new ResizeObserver(resize).observe($("viewer"));
parts.forEach((part, i) => {
  const b = document.createElement("button");
  b.className = "label";
  b.innerHTML = `<span class="part-dot"></span><span><b>${part.name}</b><small>${part.short}</small></span>`;
  b.setAttribute("aria-label", part.name);
  b.setAttribute("aria-pressed", "false");
  b.onclick = () => choosePart(part, i);
  $("labels").append(b);
  part.button = b;
  const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
  $("leaders").append(line);
  part.line = line;
  const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  dot.setAttribute("r", "4");
  $("leaders").append(dot);
  part.dot = dot;
});
function highlight(link) {
  robot?.traverse((o) => {
    if (o.isMesh && o.material?.emissive) {
      let parent = o;
      while (parent && !parent.isURDFLink) parent = parent.parent;
      o.material.emissive.set(parent?.name === link ? 0x16383c : 0);
    }
  });
}
$("covers").onclick = () => {
  covers = !covers;
  coverMeshes.forEach((o) => (o.visible = covers));
  $("covers").setAttribute("aria-pressed", covers);
  $("covers").textContent = covers ? "Hide covers" : "Show covers";
};
$("close-tip").onclick = () => {
  $("tip").hidden = true;
  highlight(null);
  document
    .querySelectorAll(".label")
    .forEach((b) => b.setAttribute("aria-pressed", "false"));
};
function complete(n) {
  done.add(n);
  try {
    localStorage.setItem("learn-orca-progress-v2", JSON.stringify([...done]));
  } catch {}
  drawLessons();
}
function drawLessons() {
  $("progress").value = done.size;
  $("progress-label").textContent = done.size + "/5";
  $("lesson-list").innerHTML = "";
  lessons.forEach((l, i) => {
    const b = document.createElement("button");
    b.className = "lesson" + (done.has(i) ? " completed" : "");
    b.setAttribute("aria-label", `Lesson ${i + 1}: ${l[0]}`);
    if (i === lesson) b.setAttribute("aria-current", "step");
    b.innerHTML = `${lessonThumbs[i] ? `<img src="${lessonThumbs[i]}" alt="">` : `<span class="number">${String(i + 1).padStart(2, "0")}</span>`}<span>${l[0].toUpperCase()}</span><span class="check">${done.has(i) ? "✓" : "›"}</span>`;
    b.onclick = () => selectLesson(i);
    $("lesson-list").append(b);
  });
  $("lesson-position").textContent =
    String(lesson + 1).padStart(2, "0") + " / 05";
}
function info() {
  const content = lessonContent[lesson];
  let html = "";
  if (tab === "joints") {
    html =
      "<h3>A name for each movement.</h3><p>MCP = knuckle. PIP = middle joint. Core accepts joint targets in degrees.</p><table><tr><td>index_mcp</td><td>Index knuckle</td></tr><tr><td>index_pip</td><td>Index middle joint</td></tr><tr><td>Finger lesson targets</td><td>0–75° · learning subset</td></tr></table><p>The model has 17 moving joints; these lessons use a subset. Zero is a joint coordinate, not necessarily the configured neutral pose. These are model targets, not measured positions.</p>";
  } else if (tab === "hardware") {
    html = `<h3>${content.hardwareTitle}</h3><p>${content.hardware}</p><p><a href="${content.nextUrl}" target="_blank" rel="noopener">${content.nextLabel} ↗</a></p><p>Python excerpts assume a configured, connected, calibrated hand with torque enabled. Follow <a href="${setupUrl}" target="_blank" rel="noopener">ORCA’s setup and shutdown example ↗</a> for the correct hardware.</p><p><strong>Needs ORCA confirmation.</strong> ${content.confirmation.replace("Confirm with ORCA: ", "").replace(/^./, (c) => c.toUpperCase())}</p>`;
  } else {
    html =
      `<h3>${lessons[lesson][0]}.</h3>` +
      content.overview.map((text) => `<p>${text}</p>`).join("");
    if (lesson === 4)
      html +=
        '<p><button id="watch-recording">Watch the physical hand ↗</button></p>';
  }
  $("information-body").innerHTML = html;
  if ($("watch-recording")) $("watch-recording").onclick = showRecording;
}
function exercise() {
  const root = $("exercise");
  root.innerHTML = "";
  if (lesson === 0) root.textContent = "Explore the six labelled parts.";
  if (lesson === 1) {
    root.innerHTML =
      '<label>Finger <select id="finger">' +
      fingers
        .map((f) => `<option ${f === selected ? "selected" : ""}>${f}</option>`)
        .join("") +
      '</select></label><label>Knuckle <input id="angle" aria-label="Knuckle target" type="range" min="0" max="75" step="1" value="' +
      angle +
      '"><output id="angle-out">' +
      angle +
      "°</output></label>";
    $("finger").onchange = (e) => {
      selected = e.target.value;
      code();
    };
    $("angle").oninput = (e) => {
      angle = Number(e.target.value);
      $("angle-out").textContent = angle + "°";
      code();
    };
  }
  if (lesson === 2) {
    for (const [id, title, val] of [
      ["mcp", "Knuckle", mcp],
      ["pip", "Middle joint", pip],
    ]) {
      const label = document.createElement("label");
      label.innerHTML = `${title}<input id="${id}" aria-label="${title} target" type="range" min="0" max="75" step="1" value="${val}"><output id="${id}-out">${val}°</output>`;
      root.append(label);
      $(id).oninput = (e) => {
        if (id === "mcp") mcp = Number(e.target.value);
        else pip = Number(e.target.value);
        $(id + "-out").textContent = e.target.value + "°";
        code();
      };
    }
  }
  if (lesson === 3) {
    root.innerHTML = `<label>Pause <input id="pause" aria-label="Sequence pause" type="range" min="0.3" max="2" step="0.1" value="${speed}"><output id="pause-out">${speed.toFixed(1)}s</output></label>`;
    $("pause").oninput = (e) => {
      speed = Number(e.target.value);
      $("pause-out").textContent = speed.toFixed(1) + "s";
      code();
    };
  }
  if (lesson === 4) {
    root.innerHTML =
      '<div id="touch-question">What can fingertip sensing add?<button data-answer="wrong">Proof that a requested angle was reached</button><button data-answer="right">Information about contact with an object</button></div>';
    root.querySelectorAll("button").forEach(
      (b) =>
        (b.onclick = () => {
          if (b.dataset.answer === "right") {
            say(
              "Yes. Contact adds information that a position target alone cannot provide. It does not by itself prove a gentle or secure grasp.",
            );
            complete(4);
          } else
            say(
              "A position target is a request. This recording illustrates contact sensing. Try the other answer.",
            );
        }),
    );
  }
}
function updateTabs() {
  for (const name of ["overview", "joints", "hardware"])
    $("tab-" + name).setAttribute("aria-selected", tab === name);
}
for (const name of ["overview", "joints", "hardware"])
  $("tab-" + name).onclick = () => {
    document.querySelector("video")?.pause();
    tab = name;
    updateTabs();
    info();
  };
function apply(values) {
  for (const [joint, val] of Object.entries(values)) {
    pose[joint] = val;
    robot.setJointValue("right_" + joint, rad(val));
  }
  robot.updateMatrixWorld(true);
  $("stage").dataset.pose = JSON.stringify(pose);
}
$("home").onclick = (e) => {
  e.preventDefault();
  selectLesson(0);
  window.scrollTo(0, 0);
};
$("copy").onclick = async () => {
  try {
    await navigator.clipboard.writeText(
      $("code").dataset.plain || $("code").textContent,
    );
    say(
      "Excerpt copied. See Real hand for setup and shutdown; preview timing is illustrative.",
    );
  } catch {
    say("Clipboard unavailable. Select and copy the code text.");
  }
};
async function load() {
  try {
    const manager = new T.LoadingManager(),
      stl = new STLLoader(manager),
      loader = new URDFLoader(manager);
    let failed = false;
    manager.onError = () => (failed = true);
    const complete = new Promise((resolve) => (manager.onLoad = resolve));
    loader.loadMeshCb = (...args) => {
      const url = args[0],
        done = args.at(-1);
      stl.load(
        url,
        (geometry) => {
          geometry.deleteAttribute("normal");
          geometry = mergeVertices(geometry, 1e-6);
          geometry.computeVertexNormals();
          const name = url.split("/").pop();
          let color = 0xdad3bd,
            metalness = 0.15,
            roughness = 0.45;
          if (name.includes("skin")) {
            color = 0x283b5b;
            roughness = 0.85;
            metalness = 0;
          }
          if (name.includes("tower_main")) {
            color = 0x536b87;
            metalness = 0.42;
            roughness = 0.4;
          }
          if (name.includes("hull")) {
            color = 0xd9d1bd;
            metalness = 0.15;
          }
          if (name.includes("fans")) {
            color = 0x2b3752;
            metalness = 0.35;
          }
          if (name.includes("u2d2")) {
            color = 0x4e978a;
            metalness = 0.2;
          }
          if (name.includes("camera")) {
            color = 0x343e50;
            metalness = 0.3;
          }
          if (name.includes("text")) {
            color = 0xddd6bc;
            metalness = 0.3;
          }
          const mesh = new T.Mesh(
            geometry,
            new T.MeshToonMaterial({ color, gradientMap: toonRamp }),
          );
          mesh.userData.part = name;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          if (name.includes("hull")) {
            mesh.visible = covers;
            coverMeshes.push(mesh);
          }
          const edges = new T.LineSegments(
            new T.EdgesGeometry(geometry, 38),
            new T.LineBasicMaterial({
              color: 0x202b42,
              transparent: true,
              opacity: 0.85,
            }),
          );
          mesh.add(edges);
          const outline = new T.Mesh(
            geometry,
            new T.MeshBasicMaterial({ color: 0x202b42, side: T.BackSide }),
          );
          outline.scale.setScalar(1.004);
          outline.userData.outline = true;
          mesh.add(outline);
          done(mesh);
        },
        undefined,
        (e) => done(null, e),
      );
    };
    robot = await loader.loadAsync(
      new URL("model/hand.urdf", location.href).href,
    );
    await complete;
    if (failed) throw Error("Mesh unavailable");
    scene.add(robot);
    robot.updateMatrixWorld(true);
    ground.position.z = new T.Box3().setFromObject(robot).min.z - 0.003;
    ready = true;
    $("loading").hidden = true;
    $("stage").dataset.loaded = "true";
    apply(pose);
    resize();
    makeLessonThumbs();
    selectLesson(lesson);
    $("run").disabled = false;
  } catch (e) {
    $("loading").textContent =
      "The ORCA model could not load. Reload to try again.";
    console.error(e);
  }
}
// Part exploration: geometry-aware selection, camera focus and joint-space demonstrations.
let activePart = null,
  cameraMotion = null,
  partOrigin = null,
  palmStructure = false;
const reduceMotion = () =>
  new URLSearchParams(location.search).get("qa-motion") === "reduce" ||
  matchMedia("(prefers-reduced-motion:reduce)").matches;
const meshOwner = (o) => {
  let p = o;
  while (p && !p.isURDFLink) p = p.parent;
  return p?.name;
};
const partSpecs = {
  FINGERTIPS: {
    meshes: ["index_ip_skin"],
    joint: "index_pip",
    anchor: "right_index_fingertip",
    target: 35,
    title: "A fingertip follows the joints.",
    copy: "Watch the index fingertip change position as its middle joint bends. This is movement—not a touch measurement.",
    boundary:
      "Contact sensing needs equipped hardware. No contact or sensor response is simulated.",
    radius: 0.05,
  },
  KNUCKLE: {
    owners: ["right_index_pp"],
    joint: "index_mcp",
    anchor: "right_index_mcp",
    target: 45,
    title: "Move the index knuckle.",
    copy: "index_mcp means index knuckle—the joint marked by the ring. Core maps this joint target to the configured motor.",
    boundary: "Browser preview, not measured feedback.",
    radius: 0.12,
  },
  "MIDDLE JOINT": {
    owners: ["right_middle_ip"],
    joint: "middle_pip",
    anchor: "right_middle_pip",
    target: 45,
    title: "Change the finger’s shape.",
    copy: "This middle joint bends farther along the middle finger. It can move without changing the knuckle target.",
    boundary:
      "Only this named joint target changes. Physical motion can differ under load.",
    radius: 0.045,
  },
  PALM: {
    owners: ["right_palm"],
    anchor: "right_palm",
    title: "A fixed support for the fingers.",
    copy: "The palm supports the fingers. Reveal the rigid structure beneath its contact surface, then bring the surface back.",
    boundary:
      "This is a visibility view. There is no independent “move the palm” command.",
    radius: 0.075,
  },
  WRIST: {
    owners: ["right_palm"],
    joint: "wrist",
    anchor: "right_wrist",
    target: 20,
    title: "Tilt the hand at the wrist.",
    copy: "The hand and fingers tilt together above the fixed base. The highlighted ring marks the wrist joint.",
    boundary:
      "This preview uses 0–25°, inside this model’s published wrist limits. No physical motor motion is simulated.",
    radius: 0.1,
  },
  "ACTUATION ASSEMBLY": {
    meshes: ["tower_main", "tower_fans", "tower_u2d2"],
    joint: "index_mcp",
    anchor: "right_tower",
    target: 35,
    title: "Connect the drive assembly to a command.",
    copy: "Motors pull tendons to move the fingers. ORCA’s configuration and calibration map a joint target to its motor. Watch the index knuckle respond.",
    boundary:
      "Joint-space preview only. The published model does not animate motor rotation or tendon travel.",
    radius: 0.13,
  },
};
const jointRing = new T.Mesh(
  new T.TorusGeometry(0.008, 0.0012, 10, 48),
  new T.MeshBasicMaterial({
    color: 0x12b8b1,
    depthTest: false,
    transparent: true,
    opacity: 0.95,
  }),
);
jointRing.renderOrder = 100;
jointRing.visible = false;
scene.add(jointRing);
function selectedMeshes(part) {
  const spec = partSpecs[part.name],
    result = [];
  robot.traverse((o) => {
    if (!o.isMesh || o === jointRing || o.userData.outline) return;
    const match =
      spec.meshes?.some((n) => o.userData.part?.includes(n)) ||
      spec.owners?.includes(meshOwner(o));
    if (match) result.push(o);
  });
  return result;
}
function restoreSurface() {
  if (!palmStructure || !robot) return;
  robot.traverse((o) => {
    if (o.isMesh && o.userData.part?.includes("palm_skin")) o.visible = true;
  });
  palmStructure = false;
  $("stage").dataset.surface = "covered";
}
function markPart(part) {
  robot?.traverse((o) => {
    if (o.isMesh && o.material?.emissive) {
      if (!o.userData.baseColor)
        o.userData.baseColor = o.material.color.getHex();
      o.material.color.setHex(o.userData.baseColor);
      o.material.emissive.setHex(0);
    }
  });
  jointRing.visible = false;
  if (!part || !ready) {
    $("stage").dataset.highlight = "";
    return;
  }
  const meshes = selectedMeshes(part);
  for (const mesh of meshes) {
    mesh.material.emissive.setHex(0x0c2b2d);
    mesh.material.color.lerp(new T.Color(0x62c7bd), 0.25);
  }
  const spec = partSpecs[part.name];
  jointRing.visible = Boolean(spec.joint);
  $("stage").dataset.highlight = JSON.stringify({
    part: part.name,
    meshes: meshes.map((o) => o.userData.part),
    joint: spec.joint || null,
  });
}
function anchorPoint(part) {
  const spec = partSpecs[part.name];
  return (
    robot.links[spec.anchor] || robot.joints[spec.anchor]
  ).getWorldPosition(new T.Vector3());
}
function partPoint(part) {
  const spec = partSpecs[part.name];
  const joint = spec.joint ? robot.joints["right_" + spec.joint] : null;
  return (joint || robot.links[spec.anchor]).getWorldPosition(new T.Vector3());
}
function focusPart(part, instant = false) {
  if (!ready) return;
  const spec = partSpecs[part.name],
    meshes = selectedMeshes(part),
    box = new T.Box3();
  for (const mesh of meshes) box.expandByObject(mesh);
  let target = box.isEmpty() ? partPoint(part) : box.getCenter(new T.Vector3());
  if (part.name === "WRIST")
    target = partPoint(part).lerp(
      robot.links.right_palm.getWorldPosition(new T.Vector3()),
      0.35,
    );
  if (part.name === "KNUCKLE") {
    const finger = lesson === 1 && !activePart ? selected : "index";
    target = robot.joints["right_" + finger + "_mcp"]
      .getWorldPosition(new T.Vector3())
      .lerp(
        robot.links["right_" + finger + "_fingertip"].getWorldPosition(
          new T.Vector3(),
        ),
        0.35,
      );
  }
  let radius = spec.radius;
  if (!box.isEmpty())
    radius = Math.max(radius, box.getSize(new T.Vector3()).length() * 0.45);
  const half = Math.min(
    rad(camera.fov) / 2,
    Math.atan(Math.tan(rad(camera.fov) / 2) * camera.aspect),
  );
  let distance = (radius / Math.sin(half)) * 1.12;
  if (part.name === "ACTUATION ASSEMBLY") {
    const all = new T.Box3().setFromObject(robot);
    target = all.getCenter(new T.Vector3());
    distance = defaultDistance * 0.97;
  }
  const dir =
    part.name === "ACTUATION ASSEMBLY"
      ? defaultDirection.clone()
      : new T.Vector3(1, -2, 0.6).normalize();
  const end = target.clone().addScaledVector(dir, distance);
  cameraMotion = {
    start: performance.now(),
    duration: instant || reduceMotion() ? 1 : 900,
    from: camera.position.clone(),
    fromTarget: controls.target.clone(),
    to: end,
    toTarget: target,
  };
  $("stage").dataset.focus = part.name;
}
controls.addEventListener("start", () => (cameraMotion = null));
// Direct model selection uses the same inspector as the labelled parts.
const selectionRay = new T.Raycaster(),
  pointerStart = { x: 0, y: 0 };
renderer.domElement.addEventListener("pointerdown", (event) => {
  pointerStart.x = event.clientX;
  pointerStart.y = event.clientY;
});
renderer.domElement.addEventListener("pointerup", (event) => {
  if (
    !ready ||
    choreography ||
    lesson !== 0 ||
    Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) >
      6
  )
    return;
  const rect = renderer.domElement.getBoundingClientRect();
  selectionRay.setFromCamera(
    new T.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    ),
    camera,
  );
  const hit = selectionRay
    .intersectObject(robot, true)
    .find(
      (hit) =>
        hit.object.isMesh &&
        hit.object.visible &&
        !hit.object.userData.outline &&
        hit.object.userData.part,
    );
  if (!hit) return;
  const name = hit.object.userData.part || "";
  let partName = null;
  if (name.includes("tower_")) partName = "ACTUATION ASSEMBLY";
  else if (name.includes("palm"))
    partName =
      hit.point.distanceTo(
        robot.joints.right_wrist.getWorldPosition(new T.Vector3()),
      ) < 0.025
        ? "WRIST"
        : "PALM";
  else if (name.includes("index_ip")) partName = "FINGERTIPS";
  else if (name.includes("index_pp")) partName = "KNUCKLE";
  else if (name.includes("middle_ip")) partName = "MIDDLE JOINT";
  if (partName) {
    const i = parts.findIndex((part) => part.name === partName);
    choosePart(parts[i], i);
  }
});
function updatePartFrame(now) {
  if (cameraMotion) {
    const motion = cameraMotion,
      t = Math.min(1, (now - motion.start) / motion.duration),
      e = t * t * (3 - 2 * t);
    camera.position.lerpVectors(motion.from, motion.to, e);
    controls.target.lerpVectors(motion.fromTarget, motion.toTarget, e);
    if (t >= 1) {
      cameraMotion = null;
      motion.onDone?.();
    }
  }
  if (activePart && jointRing.visible) {
    jointRing.position.copy(partPoint(activePart));
    jointRing.quaternion.copy(camera.quaternion);
  }
}

function render(now) {
  requestAnimationFrame(render);
  if (!ready || document.hidden) return;
  player.tick(now);
  updateChoreography(now);
  updatePartFrame(now);
  updateMini();
  controls.update();
  $("stage").dataset.view = JSON.stringify({
    camera: camera.position.toArray(),
    target: controls.target.toArray(),
  });
  renderer.render(scene, camera);
  if (lesson === 0 && !choreography) {
    const host = $("stage"),
      w = host.clientWidth,
      h = host.clientHeight,
      desktop = w > 680;
    for (const part of parts) {
      const shown = !activePart || part === activePart;
      part.button.hidden = !shown;
      part.line.style.display = shown ? "" : "none";
      part.dot.style.display = shown ? "" : "none";
      if (!shown) continue;
      const link = robot.links[part.link];
      if (!link) continue;
      const point = anchorPoint(part).project(camera),
        px = (point.x * 0.5 + 0.5) * w,
        py = (-point.y * 0.5 + 0.5) * h;
      let x, y;
      if (activePart) {
        x = Math.min(w - part.button.offsetWidth - 12, Math.max(12, px + 22));
        y = Math.max(88, py - 35);
      } else if (desktop) {
        x = part.side === "left" ? 24 : w - part.button.offsetWidth - 24;
        y = 92 + part.at * (h - 160);
      } else {
        x = part.side === "left" ? 10 : w - part.button.offsetWidth - 10;
        y = part.at * (h - 90) + 20;
      }
      part.button.style.left = x + "px";
      part.button.style.top = y + "px";
      const startX = part.side === "left" ? x + part.button.offsetWidth : x,
        startY = y + part.button.offsetHeight / 2;
      const inView = px >= 0 && px <= w && py >= 0 && py <= h;
      part.line.style.display = inView ? "" : "none";
      part.dot.style.display = inView ? "" : "none";
      part.line.setAttribute(
        "d",
        `M${startX},${startY} L${(startX + px) / 2},${startY} L${px},${py}`,
      );
      part.dot.setAttribute("cx", px);
      part.dot.setAttribute("cy", py);
    }
  }
}

function makeLessonThumbs() {
  const thumb = new T.WebGLRenderer({ antialias: true, alpha: true });
  thumb.setSize(180, 140);
  thumb.setPixelRatio(1);
  thumb.setClearColor(0, 0);
  thumb.outputColorSpace = T.SRGBColorSpace;
  const box = new T.Box3().setFromObject(robot),
    c = box.getCenter(new T.Vector3()),
    size = box.getSize(new T.Vector3());
  for (let i = 0; i < 5; i++) {
    const cam = new T.PerspectiveCamera(34, 180 / 140, 0.001, 10);
    cam.up.set(0, 0, 1);
    let target = c.clone(),
      distance = size.length() * 1.9;
    if (i > 0 && i !== 3) {
      target = robot.links[
        i === 4 ? "right_index_fingertip" : "right_index_pp"
      ].getWorldPosition(new T.Vector3());
      distance = i === 4 ? 0.16 : 0.3;
    }
    cam.position.copy(target).addScaledVector(defaultDirection, distance);
    cam.lookAt(target);
    thumb.render(scene, cam);
    lessonThumbs.push(thumb.domElement.toDataURL("image/png"));
  }
  thumb.dispose();
  drawLessons();
}
function updateClock() {
  const d = new Date();
  $("clock").textContent =
    d
      .toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
      .toUpperCase() +
    "\n" +
    d.toLocaleTimeString("en-GB", { hour12: false });
}
updateClock();
setInterval(updateClock, 1000);

// Shared scene, inspector and command state. No hardware or sensor data is generated.
let choreography = null,
  illustratedMeshes = [],
  recordingPose = null,
  phase = "idle",
  historyItems = [],
  inspectorKind = null;
const output = $("feedback");
output.setAttribute("aria-live", "off");
const escape = (t) =>
  String(t)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
function say(text) {
  historyItems.push(text);
  historyItems = historyItems.slice(-12);
  output.innerHTML = historyItems
    .map((t) => "<li>" + escape(t) + "</li>")
    .join("");
  output.scrollTop = output.scrollHeight;
}
const player = new Playback({
  read: () => pose,
  apply,
  reduced: reduceMotion,
  event(type, p) {
    phase = p.phase;
    if (type === "request")
      say(
        "Requested " +
          Object.entries(p.steps[p.index].targets)
            .map(([k, v]) => k + " → " + v + "°")
            .join(", ") +
          " · browser preview",
      );
    if (type === "hold" && p.steps[p.index].holdMs)
      say("Preview holds · wait " + p.steps[p.index].holdMs / 1000 + "s");
    if (type === "pause") say("Paused · pose and highlighted command held");
    if (type === "resume") say("Resumed · continuing interrupted command");
    if (type === "stop") say("Stopped · current model pose held");
    if (type === "done") {
      say("Preview complete");
      if (lesson === 2) {
        if (Math.abs(mcp - 45) <= 4 && Math.abs(pip - 15) <= 4) {
          say(
            "Shape matched · knuckle 45°, middle joint 15° (±4° model tolerance)",
          );
          complete(2);
        } else
          say(
            "Compare your shape: aim for 45° at the knuckle and 15° at the middle joint.",
          );
      } else if (lesson === 1 || lesson === 3) complete(lesson);
    }
    code();
    syncPartButtons();
  },
});
function restoreAssembly() {
  for (const { mesh, position } of illustratedMeshes)
    mesh.position.copy(position);
  illustratedMeshes = [];
  robot?.updateMatrixWorld(true);
  $("stage").dataset.assembly = "assembled";
}
function updateChoreography(now) {
  if (!choreography) return;
  const t = Math.min(1, (now - choreography.start) / choreography.duration);
  if (choreography.intro) {
    const f = Math.sin(Math.PI * t);
    for (const { mesh, position, offset } of illustratedMeshes)
      mesh.position.copy(position).addScaledVector(offset, f);
    robot.updateMatrixWorld(true);
  }
  if (t === 1) {
    restoreAssembly();
    choreography = null;
    $("stage").dataset.transition = "settled";
    $("labels").style.opacity = "1";
    $("leaders").style.opacity = "1";
    $("run").disabled = false;
    $("stage-label").textContent =
      "LESSON " + (lesson + 1) + " · " + lessons[lesson][0].toUpperCase();
  }
}
function sceneForLesson() {
  if (!ready) return;
  restoreAssembly();
  cameraMotion = null;
  const from = camera.position.clone(),
    fromTarget = controls.target.clone();
  fit();
  if (SCENES[lesson].part) {
    focusPart(
      parts.find((p) => p.name === SCENES[lesson].part),
      true,
    );
    camera.position.copy(cameraMotion.to);
    controls.target.copy(cameraMotion.toTarget);
    cameraMotion = null;
  }
  const to = camera.position.clone(),
    toTarget = controls.target.clone();
  if (lesson === 0) {
    from.copy(to);
    fromTarget.copy(toTarget);
  }
  camera.position.copy(from);
  controls.target.copy(fromTarget);
  cameraMotion = {
    start: performance.now(),
    duration: reduceMotion() ? 1 : 900,
    from,
    fromTarget,
    to,
    toTarget,
  };
  choreography = {
    start: performance.now(),
    duration: reduceMotion() ? 1 : lesson === 0 ? 1200 : 900,
    intro: lesson === 0 && !reduceMotion(),
  };
  $("stage").dataset.transition = "moving";
  $("labels").style.opacity = "0";
  $("leaders").style.opacity = "0";
  $("run").disabled = true;
  if (choreography.intro) {
    $("stage").dataset.assembly = "illustration";
    $("stage-label").textContent =
      "ASSEMBLY ILLUSTRATION · NOT AN ASSEMBLY PROCEDURE";
    robot.traverse((mesh) => {
      if (!mesh.userData.part || !mesh.isMesh || mesh.userData.outline) return;
      const n = mesh.userData.part,
        amount = n.includes("tower") ? 0 : n.includes("wrist") ? 0.025 : 0.055;
      if (!amount) return;
      const a = mesh.parent.worldToLocal(new T.Vector3(0, 0, 0)),
        b = mesh.parent.worldToLocal(new T.Vector3(0, 0, amount));
      illustratedMeshes.push({
        mesh,
        position: mesh.position.clone(),
        offset: b.sub(a),
      });
    });
  }
}
function selectLesson(i) {
  if (inspectorKind === "settings") {
    document.querySelector(".code-title").after($("exercise"));
    $("part-inspector")?.remove();
    inspectorKind = null;
  }
  if (activePart) leavePart();
  else player.stop();
  closeRecording();
  restoreAssembly();
  choreography = null;
  lesson = i;
  tab = "overview";
  phase = "idle";
  player.state = "ready";
  drawLessons();
  updateTabs();
  info();
  exercise();
  code();
  $("labels").hidden = i !== 0;
  $("leaders").style.display = i === 0 ? "" : "none";
  $("stage").dataset.lesson = String(i + 1);
  document.querySelector(".rail").dataset.active = i === 0 ? "home" : "lessons";
  markPart(null);
  history.replaceState(null, "", "#lesson-" + (i + 1));
  sceneForLesson();
  syncPartButtons();
  say("Lesson " + (i + 1) + " · " + lessons[i][0]);
  updateMarkers();
}
function syncPartButtons() {
  const state = player.state;
  $("run-state").textContent = state.toUpperCase();
  $("stage").dataset.playback = state;
  const text =
    state === "playing"
      ? "Ⅱ Pause"
      : state === "paused"
        ? "▶ Resume"
        : activePart && !partSpecs[activePart.name].joint
          ? palmStructure
            ? "Restore surface"
            : "Reveal structure"
          : lesson === 0 && !activePart
            ? "Next lesson →"
            : lesson === 4
              ? "▶ Watch"
              : "▶ Play";
  $("run").textContent = text;
  $("nav-run").setAttribute(
    "aria-label",
    state === "playing"
      ? "Pause lesson"
      : state === "paused"
        ? "Resume lesson"
        : lesson === 4
          ? "Watch recording"
          : "Play lesson",
  );
  $("nav-run").title = $("nav-run").getAttribute("aria-label");
  if ($("part-play")) $("part-play").textContent = text;
}
function haltPart(restore = true) {
  player.stop();
  if (restore && partOrigin) apply(partOrigin);
  restoreSurface();
  if (restore) partOrigin = null;
}
function leavePart() {
  haltPart(true);
  activePart = null;
  inspectorKind = null;
  $("part-inspector")?.remove();
  markPart(null);
  parts.forEach((p) => p.button.setAttribute("aria-pressed", "false"));
  code();
}
function choosePart(part, i) {
  if (!ready || choreography) return;
  if (activePart) leavePart();
  else player.stop();
  activePart = part;
  partOrigin = { ...pose };
  seen.add(i);
  inspectorKind = "part";
  markPart(part);
  parts.forEach((p) => p.button.setAttribute("aria-pressed", p === part));
  inspector();
  code();
  syncPartButtons();
  say(part.name + " selected · pose and camera unchanged");
  if (seen.size === parts.length) complete(0);
}
function inspector() {
  if (inspectorKind === "settings" && $("part-inspector"))
    document.querySelector(".code-title").after($("exercise"));
  $("part-inspector")?.remove();
  const panel = document.createElement("aside");
  panel.id = "part-inspector";
  panel.setAttribute("aria-label", "Selected part");
  const spec = activePart ? partSpecs[activePart.name] : null;
  panel.innerHTML = `<div class="inspector-heading"><b>${activePart?.name || "COMMAND SETTINGS"}</b><button id="part-back" aria-label="Close inspector">×</button></div><h3>${spec?.title || lessons[lesson][0]}</h3><p>${spec?.copy || "Change a target, then press Play. The code and model use these same values."}</p><div id="inspector-controls"></div><div class="inspector-actions"><button id="part-zoom">Zoom to it</button><button class="run" id="part-play">▶ Play</button></div><p class="part-boundary">${spec?.boundary || "Browser joint targets, not measured positions."}</p>`;
  if (innerWidth <= 900) $("stage").after(panel);
  else $("stage").append(panel);
  if (spec?.joint) {
    $("inspector-controls").innerHTML =
      `<label>Target <input id="part-angle" aria-label="Part demonstration target" type="range" min="5" max="${spec.joint === "wrist" ? 25 : 60}" value="${spec.target}"><output>${spec.target}°</output></label>`;
    $("part-angle").oninput = (e) => {
      spec.target = Number(e.target.value);
      e.target.nextElementSibling.textContent = spec.target + "°";
      parametersChanged();
    };
  } else if (!activePart) {
    $("inspector-controls").append($("exercise"));
  }
  $("part-zoom").onclick = () =>
    focusPart(activePart || parts.find((p) => p.name === "KNUCKLE"));
  $("part-play").onclick = playAction;
  $("part-back").onclick = () => {
    if (activePart) leavePart();
    else {
      document.querySelector(".code-title").after($("exercise"));
      $("part-inspector").remove();
      inspectorKind = null;
    }
    exercise();
    code();
    syncPartButtons();
  };
  syncPartButtons();
}
function playAction() {
  if (!ready || choreography) return;
  if (lesson === 4 && !activePart) {
    showRecording();
    return;
  }
  if (player.state === "playing") {
    player.pause();
    return;
  }
  if (player.state === "paused") {
    player.resume();
    return;
  }
  restoreAssembly();
  if (activePart) {
    const spec = partSpecs[activePart.name];
    if (!spec.joint) {
      palmStructure = !palmStructure;
      robot.traverse((o) => {
        if (o.userData.part?.includes("palm_skin")) o.visible = !palmStructure;
      });
      say(
        palmStructure
          ? "Palm surface hidden · structural view"
          : "Palm surface restored",
      );
      syncPartButtons();
      return;
    }
    player.start(
      partDemoAngles(pose[spec.joint], spec.target).map((v) => ({
        targets: { [spec.joint]: v },
        holdMs: 1000,
      })),
      { loop: true },
    );
  } else if (lesson === 0) selectLesson(1);
  else if (lesson === 1)
    player.start([{ targets: { [selected + "_mcp"]: angle } }]);
  else if (lesson === 2)
    player.start([{ targets: { index_mcp: mcp, index_pip: pip } }]);
  else if (lesson === 3)
    player.start(
      [0, 45, 0].map((v) => ({
        targets: { index_mcp: v, index_pip: 0 },
        holdMs: speed * 1000,
      })),
    );
}
function code() {
  let lines;
  if (activePart) {
    const spec = partSpecs[activePart.name];
    const demoAngles =
      player.state === "playing" || player.state === "paused"
        ? player.steps.map((step) => step.targets[spec.joint])
        : [spec.target, 0];
    lines = spec.joint
      ? [
          "# Excerpt: hand connected + configured",
          "import time",
          "while True:",
          `  for angle in [${demoAngles.join(", ")}]:`,
          `    targets = {"${spec.joint}": angle}`,
          "    hand.set_joint_positions(targets)",
          "    time.sleep(1.0)",
        ]
      : ["# Fixed palm structure", "# Visibility illustration only"];
  } else if (lesson === 1)
    lines = [
      "# Excerpt: hand connected + configured",
      "hand.set_joint_positions({",
      `    "${selected}_mcp": ${angle}  # ${selected} knuckle`,
      "})",
    ];
  else if (lesson === 2)
    lines = [
      "# Excerpt: hand connected + configured",
      "hand.set_joint_positions({",
      `    "index_mcp": ${mcp},  # index knuckle`,
      `    "index_pip": ${pip}   # index middle joint`,
      "})",
    ];
  else if (lesson === 3)
    lines = [
      "# Excerpt: hand connected + configured",
      "import time",
      "for target in [0, 45, 0]:",
      '    hand.set_joint_positions({"index_mcp": target, "index_pip": 0})',
      `    time.sleep(${speed.toFixed(1)})`,
    ];
  else
    lines =
      lesson === 4
        ? [
            "# Recorded evidence, not model output",
            "# No sensor stream is connected.",
          ]
        : [
            "# Select a part to explore it.",
            "# Excerpts: setup in Real hand tab.",
          ];
  $("code").dataset.plain = lines.join("\n");
  $("code").dataset.phase = phase;
  $("code").innerHTML = lines
    .map((line, i) => {
      const wait = line.includes("time.sleep"),
        cmd =
          line.includes("hand.set_") ||
          line.includes("targets =") ||
          line.includes('_mcp":') ||
          line.includes('_pip":');
      const on =
        player.state !== "stopped" &&
        player.state !== "ready" &&
        (phase === "hold" ? wait : cmd);
      const comment = line.indexOf("#");
      let literalIndex = 0;
      let body = escape(comment < 0 ? line : line.slice(0, comment));
      body = body
        .replace(/("[^"]*")/g, '<span class="syntax-string">$1</span>')
        .replace(
          /\b(import|while|for|in|True)\b/g,
          '<span class="syntax-keyword">$1</span>',
        )
        .replace(/\b(\d+(?:\.\d+)?)\b/g, (v) => {
          const editable = activePart
            ? i === 3 && Number(v) === partSpecs[activePart.name].target
            : lesson === 1
              ? i === 2
              : lesson === 2
                ? i === 2 || i === 3
                : lesson === 3 && wait;
          const ordinal = literalIndex++;
          const activeTarget =
            ((activePart && i === 3) ||
              (!activePart && lesson === 3 && i === 2)) &&
            ordinal === player.index &&
            player.state !== "stopped" &&
            player.state !== "ready";
          return editable
            ? `<button class="literal${activeTarget ? " current-target" : ""}" data-control="${activePart ? "part-angle" : lesson === 1 ? "angle" : lesson === 2 ? (i === 2 ? "mcp" : "pip") : "pause"}" aria-label="Edit ${wait ? "timing" : "target"} ${v}">${v}</button>`
            : activeTarget
              ? `<mark class="current-target">${v}</mark>`
              : v;
        });
      if (comment >= 0)
        body +=
          '<span class="syntax-comment">' +
          escape(line.slice(comment)) +
          "</span>";
      return `<span class="code-line${on ? " executing" : ""}${player.state === "paused" && on ? " paused" : ""}"><span class="line-number">${i + 1}</span>${body}</span>`;
    })
    .join("");
  keepActiveCodeVisible();
  $("code")
    .querySelectorAll(".literal")
    .forEach(
      (b) =>
        (b.onclick = () => {
          if (!activePart) {
            inspectorKind = "settings";
            inspector();
          }
          const input = $(b.dataset.control);
          input?.focus();
        }),
    );
}

// Scroll only the editor, never the page or the pinned Model output.
function keepActiveCodeVisible() {
  const editor = $("code"),
    active = [...editor.querySelectorAll(".executing")];
  if (!active.length) return;
  const target =
    phase === "move"
      ? editor.querySelector(".current-target")?.closest(".code-line")
      : null;
  const first = target || active[0],
    last = active.at(-1),
    frame = editor.getBoundingClientRect();
  const top = first.getBoundingClientRect().top - frame.top + editor.scrollTop;
  const bottom =
    last.getBoundingClientRect().bottom - frame.top + editor.scrollTop;
  if (bottom - top > editor.clientHeight - 8)
    editor.scrollTop = bottom - editor.clientHeight + 4;
  else if (top < editor.scrollTop + 4) editor.scrollTop = Math.max(0, top - 4);
  else if (bottom > editor.scrollTop + editor.clientHeight - 4)
    editor.scrollTop = bottom - editor.clientHeight + 4;
}
new ResizeObserver(keepActiveCodeVisible).observe($("code"));

function parametersChanged() {
  if (player.state === "playing" || player.state === "paused") player.stop();
  player.state = "ready";
  phase = "idle";
  code();
  syncPartButtons();
}
document.addEventListener("input", (e) => {
  if (e.target.matches("#angle,#mcp,#pip,#pause,#finger")) parametersChanged();
});
function showRecording() {
  if ($("recording")) return;
  player.stop();
  recordingPose = { ...pose };
  const overlay = document.createElement("section");
  overlay.id = "recording";
  overlay.innerHTML = `<div><b>RECORDED EVIDENCE · ORCA TOUCH</b><button id="close-recording">Return to model ×</button></div><video controls playsinline autoplay preload="metadata" poster="model/recording-placeholder.svg" aria-label="Recorded ORCA fingertip contact and sensing"><source src="https://firebasestorage.googleapis.com/v0/b/orca-public-a5h6t/o/videos%2Ftouch-sensing-demo-grasping-and-touching-fingertips_720p.mp4?alt=media" type="video/mp4"></video><img class="recording-poster" hidden src="model/recording-placeholder.svg" alt="Recording unavailable; use the official source link"><p id="recording-status">Manufacturer recording. Not your model pose or a live sensor stream.</p><p>The recording pairs physical fingertip contact with a sensor display. That is the extra information Touch adds to movement commands; it is not feedback from your model pose.</p><p>A soft sponge is a possible use case, not a demonstrated result here. Gentle gripping needs suitable control and testing.</p><p>Current ORCA products differ from this v1 model. Recording version and supported force/torque channels need ORCA confirmation; see Real hand.</p><a href="https://www.orcahand.com/models/touch" target="_blank" rel="noopener">Explore ORCA Touch ↗</a>`;
  $("stage").append(overlay);
  $("close-recording").onclick = closeRecording;
  const video = overlay.querySelector("video");
  if (new URLSearchParams(location.search).has("qa-recording-missing"))
    video.querySelector("source").src = "model/qa-missing-recording.mp4";
  video.onerror = () => {
    if (!overlay.isConnected) return;
    $("recording-status").textContent =
      "Recording unavailable. View the poster or open the official ORCA Touch source below.";
    video.style.display = "none";
    overlay.querySelector(".recording-poster").hidden = false;
  };
  video.querySelector("source").addEventListener("error", video.onerror);
  video.play().catch(() => {
    if (overlay.isConnected && !video.error && video.networkState !== 3)
      $("recording-status").textContent =
        "Press the video play control. Manufacturer recording, not live feedback.";
  });
}
function closeRecording() {
  if (!$("recording")) return;
  $("recording").querySelector("video").pause();
  $("recording").remove();
  if (recordingPose && ready) apply(recordingPose);
  recordingPose = null;
}
// Camera shortcuts only outside interactive form controls. Reset does not affect playback.
function pan(x, y) {
  const right = new T.Vector3().setFromMatrixColumn(camera.matrix, 0),
    up = new T.Vector3().setFromMatrixColumn(camera.matrix, 1),
    offset = right.multiplyScalar(x).add(up.multiplyScalar(y));
  camera.position.add(offset);
  controls.target.add(offset);
  controls.update();
}
$("viewer").onkeydown = null;
document.addEventListener("keydown", (e) => {
  if (e.target.closest("input,select,textarea,button,a,[contenteditable=true]"))
    return;
  const k = e.key.toLowerCase();
  if (k === "q") turn(0.15);
  else if (k === "e") turn(-0.15);
  else if (k === "w") pan(0, 0.015);
  else if (k === "s") pan(0, -0.015);
  else if (k === "a") pan(-0.015, 0);
  else if (k === "d") pan(0.015, 0);
  else if (k === "r") {
    $("fit").click();
  } else if (k === "+" || k === "=") zoom(0.85);
  else if (k === "-") zoom(1 / 0.85);
  else return;
  e.preventDefault();
});
const mini = document.createElement("button");
mini.id = "minimap";
mini.setAttribute("aria-label", "Minimap: move view toward clicked location");
mini.innerHTML = '<img alt="Full assembly"><span></span>';
$("stage").append(mini);
mini.onpointerdown = (e) => {
  if (e.pointerType === "touch") return;
  mini.setPointerCapture(e.pointerId);
  moveMini(e);
};
mini.onpointermove = (e) => {
  if (e.buttons) moveMini(e);
};
function moveMini(e) {
  const r = mini.getBoundingClientRect();
  const old = controls.target.clone();
  controls.target
    .copy(center)
    .add(
      new T.Vector3(
        (e.clientX - r.left) / r.width - 0.5,
        0,
        0.5 - (e.clientY - r.top) / r.height,
      ).multiplyScalar(0.4),
    );
  camera.position.add(controls.target.clone().sub(old));
  controls.update();
}
function updateMini() {
  mini.hidden =
    !ready ||
    camera.position.distanceTo(controls.target) > defaultDistance * 0.85;
  mini.querySelector("img").src = lessonThumbs[0] || "";
  const fraction = Math.min(
    0.9,
    camera.position.distanceTo(controls.target) / defaultDistance,
  );
  const viewport = mini.querySelector("span");
  viewport.style.width = viewport.style.height = fraction * 70 + "%";
  viewport.style.inset = "auto";
  viewport.style.left =
    50 - fraction * 35 + (controls.target.x - center.x) * 100 + "%";
  viewport.style.top =
    50 - fraction * 35 - (controls.target.z - center.z) * 100 + "%";
}
const marker2 = jointRing.clone();
marker2.material = jointRing.material.clone();
scene.add(marker2);
function updateMarkers() {
  marker2.visible = lesson === 2;
}
const originalPartFrame = updatePartFrame;
updatePartFrame = function (now) {
  originalPartFrame(now);
  if (lesson === 1 || lesson === 2) {
    jointRing.visible = true;
    jointRing.position.copy(
      robot.joints[
        "right_" + (lesson === 1 ? selected : "index") + "_mcp"
      ].getWorldPosition(new T.Vector3()),
    );
    jointRing.quaternion.copy(camera.quaternion);
  }
  if (lesson === 2) {
    marker2.position.copy(
      robot.joints.right_index_pip.getWorldPosition(new T.Vector3()),
    );
    marker2.quaternion.copy(camera.quaternion);
  }
};
for (const [el, label] of [
  [document.querySelector(".information"), "information"],
  [document.querySelector(".workbench"), "code"],
]) {
  const b = document.createElement("button");
  b.className = "expand-panel";
  b.setAttribute("aria-label", "Expand " + label);
  b.textContent = "⤢";
  (label === "code" ? document.querySelector(".code-title") : el).append(b);
  b.onclick = () => {
    const expanded = el.classList.toggle("expanded");
    b.innerHTML = expanded ? "×" : icon("Expand panel");
    b.setAttribute("aria-label", (expanded ? "Collapse " : "Expand ") + label);
  };
}
const nav = document.createElement("div");
nav.className = "lesson-arrows";
nav.innerHTML =
  '<button aria-label="Previous lesson">←</button><button aria-label="Next lesson">→</button>';
document.querySelector(".lesson-strip h2").append(nav);
nav.children[0].onclick = () => selectLesson(Math.max(0, lesson - 1));
nav.children[1].onclick = () => selectLesson(Math.min(4, lesson + 1));
const sidebar = document.createElement("button");
sidebar.id = "expand-sidebar";
sidebar.textContent = "☰";
sidebar.setAttribute("aria-label", "Expand sidebar");
document.querySelector(".rail").prepend(sidebar);
sidebar.onclick = () => {
  const expanded = document.querySelector(".rail").classList.toggle("wide");
  sidebar.setAttribute("aria-expanded", expanded);
  sidebar.setAttribute(
    "aria-label",
    expanded ? "Collapse sidebar" : "Expand sidebar",
  );
};
document
  .querySelectorAll(".rail a,.rail button:not(#expand-sidebar)")
  .forEach((el) => {
    el.title = el.getAttribute("aria-label");
    const label = document.createElement("span");
    label.textContent = el.title;
    el.append(label);
  });
$("run").onclick = $("nav-run").onclick = playAction;
$("stop").onclick = () => {
  player.stop();
  closeRecording();
};

for (const [id, label] of [
  ["copy", "Copy code"],
  ["expand-sidebar", "Expand sidebar"],
  ["left", "Turn left"],
  ["right", "Turn right"],
  ["fit", "Reset view"],
  ["out", "Zoom out"],
  ["in", "Zoom in"],
])
  $(id).innerHTML = icon(label);
for (const b of document.querySelectorAll(".expand-panel"))
  b.innerHTML = icon("Expand panel");
nav.children[0].innerHTML = icon("Earlier lessons");
nav.children[1].innerHTML = icon("More lessons");
const partIcons = [
  icon("Reset view"),
  icon("Turn left"),
  document.querySelector('[aria-label="Hand information"] svg').outerHTML,
  icon("Turn right"),
  icon("Expand panel"),
  icon("Reset view"),
];
parts.forEach((part, i) => {
  part.button.querySelector(".part-dot").outerHTML =
    '<span class="part-icon" aria-hidden="true">' + partIcons[i] + "</span>";
});
const jointTags = ["index_mcp", "index_pip"].map((joint, i) => {
  const el = document.createElement("button");
  el.className = "joint-tag";
  el.textContent = joint + " · " + (i ? "middle joint" : "knuckle");
  el.onclick = () => {
    inspectorKind = "settings";
    inspector();
    $(i ? "pip" : lesson === 1 ? "angle" : "mcp")?.focus();
  };
  $("stage").append(el);
  return { el, joint };
});
const beforeFrame = updatePartFrame;
updatePartFrame = function (now) {
  beforeFrame(now);
  for (const { el, joint } of jointTags) {
    el.hidden =
      !((lesson === 1 && joint === "index_mcp") || lesson === 2) ||
      !!choreography ||
      !!$("recording");
    if (el.hidden) continue;
    const actualJoint = lesson === 1 ? selected + "_mcp" : joint;
    el.textContent =
      actualJoint +
      " · " +
      (joint === "index_pip" ? "middle joint" : "knuckle");
    const point = robot.joints["right_" + actualJoint]
      .getWorldPosition(new T.Vector3())
      .project(camera);
    el.style.left = (point.x * 0.5 + 0.5) * $("stage").clientWidth + 18 + "px";
    el.style.top =
      (-point.y * 0.5 + 0.5) * $("stage").clientHeight +
      (joint === "index_pip" ? -30 : 10) +
      "px";
  }
};
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const expanded = document.querySelector(".expanded");
    if (expanded) expanded.querySelector(".expand-panel")?.click();
    else if ($("recording")) closeRecording();
    else $("part-back")?.click();
  }
});

requestAnimationFrame(render);
drawLessons();
selectLesson(
  Math.min(
    4,
    Math.max(0, Number(location.hash.match(/lesson-(\d)/)?.[1] || 1) - 1),
  ),
);
load();
