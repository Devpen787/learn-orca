# Sources and third-party notices

## ORCA model

The URDF and STL assets in `model/` are from
[orcahand_description](https://github.com/orcahand/orcahand_description), revision
`b9b349a21ee0238c62b6cf92ae7597027867adf8`,
`v1/models/urdf/orcahand_right_extended.urdf`.
The upstream MIT license is retained in `model/LICENSE` and provenance in
`model/SOURCE.json`. Collision elements were removed and mesh paths localized;
geometry was not modified. These are legacy v1 assets, not current product specifications.

## Runtime libraries

Three.js and urdf-loader are MIT-licensed dependencies, pinned in the lockfile.
esbuild is the MIT-licensed build tool. Their notices are included in npm packages;
esbuild retains applicable legal comments in the generated bundle.

## Example hardware interfaces

Lesson links point to ORCA Core revision
`4a590d6512bfe24acff153968a1ba999b49e4ad5` and ORCA UI revision
`bc0934f3b76d98c500ca5af6ba50edd736e00932`.
Code snippets describe configured hardware interfaces; they are not executed.
Links to current ORCA product pages may change. No hardware was tested here.

## Manufacturer recording

The optional Touch recording is streamed from ORCA’s external public video host
only when opened. It is not copied, bundled, or relicensed by this project.
The official product link remains available if the recording fails. The fallback
SVG is original project artwork. An external request discloses normal network
metadata to that host; no analytics are installed in this application.

## Design inspiration

[Learn Arduino by Dilum Sanjaya](https://learn-arduino-red.vercel.app/) inspired
the progression from explanation to interactive experiment. Captured font files,
SVG frame artwork, navigation icon exports and review screenshots are not included
in this distribution. Control icons are original geometric drawings in `icons.mjs`;
the background is generated with CSS. The lesson layout serves this project's
own model, controls and source explanations. This project has no affiliation with
Learn Arduino or ORCA Dexterity.
