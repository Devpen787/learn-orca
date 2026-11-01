// Upstream source revisions and evidence boundaries: THIRD_PARTY_NOTICES.md.
// Sources are pinned review references, not a claim of a validated hardware release.
const core =
  "https://github.com/orcahand/orca_core/blob/4a590d6512bfe24acff153968a1ba999b49e4ad5/";
export const lessonContent = [
  {
    overview: [
      "Explore ORCA’s published v1 assembly. Select a part; Zoom and Play are separate steps.",
      "Motors pull tendons to move the joints. ORCA provides open designs and tools for setup and maintenance.",
      "Drag to pan; turn buttons rotate. + / − zoom. Reset changes only the view.",
    ],
    hardwareTitle: "From design to working hardware.",
    hardware:
      "Build from the published files or start with an assembled hand. Physical setup includes the correct configuration, tendon tensioning and calibration.",
    nextLabel: "Explore ORCA’s build and setup guide",
    nextUrl: "https://www.orcahand.com/getting-started",
    confirmation:
      "Confirm with ORCA: which current product and supported Core release this v1-based lesson should accompany.",
  },
  {
    overview: [
      "Choose a finger, change its knuckle target, then press Play.",
      "You ask for a named joint angle. ORCA Core maps that target to the configured, calibrated motor.",
    ],
    hardwareTitle: "Control through ORCA Core.",
    hardware:
      "Core handles the joint-to-motor mapping. The standard hand estimates joint angles from motor positions and calibration; a request is not proof of arrival. ORCA UI provides manual control and hardware telemetry.",
    nextLabel: "See ORCA’s official control console",
    nextUrl:
      "https://github.com/orcahand/orca_ui/tree/bc0934f3b76d98c500ca5af6ba50edd736e00932",
    confirmation:
      "Confirm with ORCA: supported joint-encoder options. Dedicated joint sensing in the source is different from motor-derived estimates.",
  },
  {
    overview: [
      "Change the knuckle and middle joint separately. Aim for 45° and 15°, then press Play.",
      "Independent targets let you explore different finger shapes. Matching this model exercise does not prove a physical grasp.",
    ],
    hardwareTitle: "More than one way to bend.",
    hardware:
      "These lessons explore two finger joints. ORCA’s full hand has 17 independently controlled movements, including finger spread, the thumb and the wrist. The 0–75° sliders and ±4° challenge tolerance are learning choices, not product limits or accuracy specifications.",
    nextLabel: "Explore the current ORCA hand specification",
    nextUrl: "https://www.orcahand.com/models/full",
    confirmation:
      "Confirm with ORCA: the product/configuration to recommend. Our v1 geometry is not a dimensional preview of the current hand.",
  },
  {
    overview: [
      "Play a straight → bend → straight index-finger sequence. Change the pause between targets.",
      "Reusable poses and timing help you repeat an experimental procedure. ORCA’s tools also record and replay trajectories.",
      "Preview movement time is illustrative. A Python sleep is a delay, not confirmation that a joint arrived.",
    ],
    hardwareTitle: "From poses to repeatable trials.",
    hardware:
      "ORCA provides pose and trajectory recording/replay tools. Repeat the commands, then measure the physical outcome. Browser Pause, Stop and pose restoration are learning controls; they are not the hardware console’s E-stop.",
    nextLabel: "See ORCA’s recording and replay tools",
    nextUrl: core + "docs/pages/orca-core-docs/orca-core-scripts.md",
    confirmation:
      "Confirm with ORCA: the supported release and motion settings for a hardware example. This preview adds its own smooth movement timing.",
  },
  {
    overview: [
      "Joint targets describe movement. Touch adds fingertip force information about contact.",
      "Watch ORCA’s recorded sensing demonstration. For a soft sponge, contact information could help a controller adjust its grasp; gentle gripping still needs control and validation.",
    ],
    hardwareTitle: "Learn what contact adds.",
    hardware:
      "The public Core interface provides fingertip and per-taxel force readings. A taxel is a sensing point. Its force components describe pressing and sideways forces in defined axes. No sensor data is generated here.",
    nextLabel: "Read ORCA’s tactile-data guide",
    nextUrl: core + "docs/pages/orca-core-docs/tactile-frames.md",
    confirmation:
      "Confirm with ORCA: the product page describes 6D force/torque per taxel; the inspected Python interface exposes three force components. Supported channels and the recording’s hardware version need confirmation.",
  },
];
export const setupUrl =
  core + "docs/pages/getting-started-docs/quickstart-with-core-package.md";
