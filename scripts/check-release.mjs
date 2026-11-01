import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
const root = new URL("../", import.meta.url).pathname;
const skip = new Set([
  ".git",
  "node_modules",
  "test-results",
  "playwright-report",
]);
const errors = [];
let checked = 0;
async function walk(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    if (skip.has(item.name) || item.name === "app.js") continue;
    const file = join(dir, item.name);
    if (item.isSymbolicLink()) {
      errors.push(`Symlink: ${file.slice(root.length)}`);
      continue;
    }
    if (item.isDirectory()) {
      await walk(file);
      continue;
    }
    if (
      ![".md", ".mjs", ".js", ".html", ".css", ".json", ".svg"].includes(
        extname(file),
      )
    )
      continue;
    const body = await readFile(file, "utf8");
    checked++;
    const rules = [
      [/\/Users\/[\w.-]+\//, "home path"],
      [/[\w.+-]+@(?:gmail|hotmail|outlook)\.com/i, "personal email"],
      [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, "private key"],
      [/gh[pousr]_[A-Za-z0-9]{30,}/, "token"],
      [
        new RegExp(
          ["nick", "facing"].join("-") +
            "|" +
            ["private", "planning"].join("-"),
          "i",
        ),
        "private workspace reference",
      ],
    ];
    for (const [regex, label] of rules)
      if (regex.test(body)) errors.push(`${file.slice(root.length)}: ${label}`);
  }
}
await walk(root);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(
  `Release source scan: ${checked} text files checked; configured patterns clear.`,
);
