const net = require("node:net");

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

(async () => {
  console.log(`API  http://localhost:5000  ${await isPortOpen(5000) ? "running" : "stopped"}`);
  console.log(`CRM  http://localhost:5173  ${await isPortOpen(5173) ? "running" : "stopped"}`);
})();
