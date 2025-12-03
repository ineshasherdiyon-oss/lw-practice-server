  // index.js
  const express = require("express");
  const http = require("http");
  const { Server } = require("socket.io");
  const fs = require("fs");
  const path = require("path");

  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: "*" } });

  const PORT = process.env.PORT || 3000;
  const recordingsDir = path.join(__dirname, "recordings");
  if (!fs.existsSync(recordingsDir)) fs.mkdirSync(recordingsDir, { recursive: true });

  // serve static client files from public/
  app.use(express.static(path.join(__dirname, "public")));

  // simple health route
  app.get("/ping", (req, res) => res.send("pong"));

  // list recordings and serve files
  app.get("/recordings", (req, res) => {
    const files = fs.readdirSync(recordingsDir).filter((f) => f.endsWith(".webm"));
    res.send(
      `<h2>Recordings</h2><ul>${files
        .map((f) => `<li><a href="/recordings/${encodeURIComponent(f)}">${f}</a></li>`)
        .join("")}</ul>`
    );
  });
  app.use("/recordings", express.static(recordingsDir));

  // socket handlers
  io.on("connection", (socket) => {
    console.log("client connected", socket.id);

    const outPath = path.join(recordingsDir, `${socket.id}.webm`);

    socket.on("audio-chunk", (base64Data) => {
      try {
        const buff = Buffer.from(base64Data, "base64");
        fs.appendFileSync(outPath, buff);
        socket.emit("ack", { received: true });
      } catch (err) {
        console.error("write error", err);
      }
    });

    socket.on("stop-audio", () => {
      console.log("stop received for", socket.id);
      socket.emit("stopped", { file: `${socket.id}.webm` });
    });

    socket.on("disconnect", () => {
      console.log("client disconnected", socket.id);
    });
  });

  // graceful error handling (catch EADDRINUSE etc)
  server.on("error", (err) => {
    if (err && err.code === "EADDRINUSE") {
      console.error("Port already in use — another process is listening on port", PORT);
    } else {
      console.error("Server error:", err);
    }
  });

  // start server
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  // optional: handle shutdown cleanly
  process.on("SIGINT", () => {
    console.log("Shutting down...");
    server.close(() => process.exit(0));
  });
