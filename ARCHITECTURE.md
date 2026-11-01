# How the lesson works

`index.html` supplies semantic regions and controls. `app.entry.js` loads the
URDF through urdf-loader, uses Three.js to render STL geometry, and connects
lesson navigation to camera framing, joint targets and the output log.
`icons.mjs` supplies original geometric control artwork.

`lesson-content.mjs` contains the educational explanations and official next-step
links. `playback.mjs` owns elapsed-time movement and waiting, with pause, resume
and cancellation. Its node tests isolate timing from rendering.

The model is local. There is no server API, arbitrary Python execution, telemetry
or account. Completed lessons are recorded in browser localStorage. Pose is not
persisted across reloads. The optional manufacturer video makes a separate
external request only after the visitor asks to view it.

`npm run build` bundles source into ignored `app.js`. Development uses a loopback
static server; publish only this repository's files, never the parent workspace.
The browser suite covers five lesson routes at desktop and mobile widths.
