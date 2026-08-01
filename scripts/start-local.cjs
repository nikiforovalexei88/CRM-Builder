const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const logsDir = path.join(root, "logs");
const pidsFile = path.join(logsDir, "local-pids.json");

const apiPort = 5000;
const crmPort = 5173;

function loadDotEnv() {
  const file = path.join(root, ".env");
  if (!fs.existsSync(file)) return {};

  return Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function startNode(name, args, env, logName, cwd = root) {
  fs.mkdirSync(logsDir, { recursive: true });
  const log = fs.openSync(path.join(logsDir, logName), "a");
  const child = spawn(process.execPath, args, {
    cwd,
    env,
    detached: true,
    stdio: ["ignore", log, log],
    windowsHide: true,
  });
  child.unref();
  return { name, pid: child.pid };
}

async function main() {
  const pids = {};
  const envFile = loadDotEnv();

  if (await isPortOpen(apiPort)) {
    console.log(`API already runs on http://localhost:${apiPort}`);
  } else {
    const api = startNode(
      "api",
      ["--enable-source-maps", path.join(root, "artifacts/api-server/dist/index.mjs")],
      {
        ...envFile,
        ...process.env,
        SQLITE_FILE: path.join(root, "data/crm.sqlite"),
        SESSION_SECRET: process.env.SESSION_SECRET || envFile.SESSION_SECRET || "local-dev-session-secret-change-before-production",
        PORT: String(apiPort),
      },
      "api-server.log",
    );
    pids.api = api.pid;
    console.log(`Started API pid ${api.pid}`);
  }

  if (await isPortOpen(crmPort)) {
    console.log(`CRM already runs on http://localhost:${crmPort}`);
  } else {
    const viteEnv = {
      ...envFile,
      ...process.env,
      CRM_PORT: String(crmPort),
      API_PROXY_TARGET: `http://localhost:${apiPort}`,
    };
    delete viteEnv.PORT;

    const crm = startNode(
      "crm",
      [path.join(root, "artifacts/crm/node_modules/vite/bin/vite.js"), "--config", path.join(root, "artifacts/crm/vite.config.ts"), "--host", "0.0.0.0"],
      viteEnv,
      "crm-vite.log",
      path.join(root, "artifacts/crm"),
    );
    pids.crm = crm.pid;
    console.log(`Started CRM pid ${crm.pid}`);
  }

  fs.mkdirSync(logsDir, { recursive: true });
  fs.writeFileSync(pidsFile, JSON.stringify({ updatedAt: new Date().toISOString(), ...pids }, null, 2));
  console.log(`Open http://localhost:${crmPort}/`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
