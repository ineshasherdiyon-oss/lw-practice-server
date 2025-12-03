// index.js — final clean server for Render + Supabase health check

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");

// ----------------------------------
// Base server setup
// ----------------------------------
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = Number(process.env.PORT) || 3000;
const HOST = "0.0.0.0"; // important for Render

// ----------------------------------
// Recordings folder
// ----------------------------------
const recordingsDir = path.join(__dirname, "recordings");
if (!fs.existsSync(recordingsDir)) fs.mkdirSync(recordingsDir);

// ----------------------------------
// Serve static files from /public
// ----------------------------------
app.use(express.static(path.join(__dirname, "public")));

// ----------------------------------
// Ping route
// ----------------------------------
app.get("/ping", (req, res) => {
  res.send("pong");
});

// ----------------------------------
// Supabase health check route
// ----------------------------------
app.get("/health", async (req, res) => {
  try {
    const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY; // fallback

    if (!supabaseUrl || !serviceKey) {
      return res.status(500).json({
        ok: false,
        error: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing",
      });
    }

    const restUrl = `${supabaseUrl}/rest/v1/health_check?select=*&limit=1&order=id.desc`;

    const r = await fetch(restUrl, {
      method: "GET",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    });

    const json = await r.json().catch(() => null);

    if (!r.ok) {
      return res.status(r.status).json({
        ok: false,
        error: json || `Supabase responded with ${r.status}`,
      });
    }

    return res.json({
      ok: true,
      row: Array.isArray(json) ? json[0] : json,
    });
  } catch (err) {
    console.error("health error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ----------------------------------
// Socket.io audio handling
// ----------------------------------
io.on("connection", (socket) => {
  console.log("client connected:", socket.id);

  const outfile = path.join(recordingsDir, `${socket.id}.webm`);

  socket.on("audio-chunk", (base64Data) => {
    try {
      const buff = Buffer.from(base64Data, "base64");
      fs.appendFileSync(outfile, buff);
      socket.emit("ack", { received: true });
    } catch (err) {
      console.error("write error:", err);
    }
  });

  socket.on("stop-audio", () => {
    console.log("audio stopped for", socket.id);
  });

  socket.on("disconnect", () => {
    console.log("client disconnected:", socket.id);
  });
});

// ----------------------------------
// Start server
// ----------------------------------
server.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});

server.on("error", (err) => {
  console.error("Server error:", err);
});
