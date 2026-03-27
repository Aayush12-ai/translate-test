import fs from "node:fs";
import http from "http";
import path from "node:path";

function loadWorkspaceEnvFile() {
  const candidates = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), "..", "..", ".env.local"),
  ];

  if (typeof __dirname === "string") {
    candidates.push(path.resolve(__dirname, "..", "..", "..", ".env.local"));
  }

  for (const envFilePath of candidates) {
    if (!fs.existsSync(envFilePath)) {
      continue;
    }

    const fileContents = fs.readFileSync(envFilePath, "utf8");

    for (const line of fileContents.split(/\r?\n/)) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith("#")) {
        continue;
      }

      const separatorIndex = trimmedLine.indexOf("=");
      if (separatorIndex <= 0) {
        continue;
      }

      const key = trimmedLine.slice(0, separatorIndex).trim();
      const value = trimmedLine.slice(separatorIndex + 1).trim();

      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }

    return envFilePath;
  }

  return null;
}

const loadedEnvFile = loadWorkspaceEnvFile();
const rawPort = process.env["PORT"] ?? process.env["API_PORT"] ?? "18080";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const [
  { default: app },
  { logger },
  { SIGNALING_PATH, setupSignaling },
  { TRANSCRIPTION_PATH, setupTranscription },
] = await Promise.all([
  import("./app"),
  import("./lib/logger"),
  import("./signaling"),
  import("./transcription"),
]);

const server = http.createServer(app);
const signalingServer = setupSignaling();
const transcriptionServer = setupTranscription();

server.on("upgrade", (req, socket, head) => {
  const host = req.headers.host ?? "127.0.0.1";
  const pathname = new URL(req.url ?? "/", `http://${host}`).pathname;

  if (pathname === SIGNALING_PATH) {
    signalingServer.handleUpgrade(req, socket, head, (ws, upgradeReq) => {
      signalingServer.emit("connection", ws, upgradeReq);
    });
    return;
  }

  if (pathname === TRANSCRIPTION_PATH) {
    transcriptionServer.handleUpgrade(req, socket, head, (ws, upgradeReq) => {
      transcriptionServer.emit("connection", ws, upgradeReq);
    });
    return;
  }

  socket.destroy();
});

server.once("error", (err: NodeJS.ErrnoException) => {
  logger.error(
    { err, port },
    err.code === "EADDRINUSE" ? "Port already in use" : "Error listening on port",
  );
  process.exit(1);
});

server.listen(port, () => {
  if (loadedEnvFile) {
    logger.info({ envFile: loadedEnvFile }, "Loaded local environment configuration");
  }
  logger.info({ port }, "Server listening");
});
