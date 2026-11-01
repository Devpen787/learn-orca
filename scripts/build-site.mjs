import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

// Publish only the browser entry point, bundled application and licensed model.
await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await build({
  entryPoints: ["app.entry.js"],
  bundle: true,
  outfile: "dist/app.js",
});
await cp("index.html", "dist/index.html");
await cp("style.css", "dist/style.css");
await cp("model", "dist/model", { recursive: true });
for (const file of ["README.md", "THIRD_PARTY_NOTICES.md", "LICENSE"]) {
  await cp(file, `dist/${file}`);
}
