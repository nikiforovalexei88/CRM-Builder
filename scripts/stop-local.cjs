const fs = require("node:fs");
const path = require("node:path");

const pidsFile = path.join(__dirname, "..", "logs", "local-pids.json");

if (!fs.existsSync(pidsFile)) {
  console.log("No local PID file found.");
  process.exit(0);
}

const pids = JSON.parse(fs.readFileSync(pidsFile, "utf8"));

for (const key of ["api", "crm"]) {
  const pid = pids[key];
  if (!pid) continue;
  try {
    process.kill(pid);
    console.log(`Stopped ${key} pid ${pid}`);
  } catch (error) {
    console.log(`${key} pid ${pid} is not running`);
  }
}
