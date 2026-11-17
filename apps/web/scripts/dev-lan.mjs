import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import os from "node:os";

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");

const port = process.env.PORT || "3000";
const interfaces = os.networkInterfaces();

const lanUrls = [];
const virtualUrls = [];

for (const [name, list] of Object.entries(interfaces)) {
  for (const iface of list ?? []) {
    if (iface.family !== "IPv4" || iface.internal) continue;
    const lower = name.toLowerCase();
    const isVirtual =
      lower.includes("wsl") ||
      lower.includes("vethernet") ||
      lower.includes("hyper-v") ||
      lower.includes("docker") ||
      iface.address.startsWith("172.");
    const entry = `http://${iface.address}:${port} (${name})`;
    if (isVirtual) {
      virtualUrls.push(entry);
    } else {
      lanUrls.push(`http://${iface.address}:${port}`);
    }
  }
}

console.log("\n========================================================");
console.log("  Forms MESRC — Dev Server Endpoints");
console.log("========================================================");
console.log(`  Local (PC):            http://localhost:${port}`);
for (const url of lanUrls) {
  console.log(`  Local Network (Wi-Fi): ${url}`);
}
if (lanUrls.length === 0 && virtualUrls.length > 0) {
  for (const url of virtualUrls) {
    console.log(`  Network Adapter:       ${url}`);
  }
}
console.log("  Public (GitHub Pages): https://moonwiraja.github.io/forms-mesrc/");
console.log("========================================================\n");

const child = spawn(process.execPath, [nextBin, "dev", "-H", "0.0.0.0", "-p", port], {
  stdio: "inherit",
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
