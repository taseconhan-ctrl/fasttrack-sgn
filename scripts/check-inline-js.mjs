import { readFileSync } from "node:fs";
import vm from "node:vm";

const files = ["ung-don-khach.html", "bootstrap-managers.html"];
let checked = 0;

for (const file of files) {
  const html = readFileSync(file, "utf8");
  const scripts = [...html.matchAll(/<script\\b([^>]*)>([\\s\\S]*?)<\\/script>/gi)];
  for (const match of scripts) {
    if (/\\bsrc\\s*=/.test(match[1])) continue;
    const source = match[2].trim();
    if (!source) continue;
    new vm.Script(source, { filename: file });
    checked++;
  }
}

if (checked < 2) throw new Error("Expected inline application scripts were not found.");
console.log(`Validated ${checked} inline JavaScript block(s).`);
