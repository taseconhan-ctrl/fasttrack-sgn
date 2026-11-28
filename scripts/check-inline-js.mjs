import { readFileSync, readdirSync } from "node:fs";
import vm from "node:vm";
const files = readdirSync(".").filter(f=>f.endsWith(".html"));
let checked=0;
for(const file of files){
 const html=readFileSync(file,"utf8");
 for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
  if(/\bsrc\s*=/.test(match[1])||/type=["'](?:application\/json|application\/ld\+json|importmap)["']/i.test(match[1]))continue;
  const source=match[2].trim();if(!source)continue;
  new vm.Script(source,{filename:file});checked++;
 }
}
new vm.Script(readFileSync("sw.js","utf8"),{filename:"sw.js"});
if(checked<2)throw new Error("Expected application scripts not found");
console.log("Validated "+checked+" inline scripts across "+files.length+" HTML pages and service worker.");
