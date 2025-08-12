const WebSocket = require("ws");
const express = require("express");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const ffmpegPath = require("ffmpeg-static");

const app = express();
const PORT = process.env.PORT || 8000; // Render gives us a port

// Use /tmp for HLS (Render allows writing here)
const hlsFolder = path.join("/tmp", "hls");
if (!fs.existsSync(hlsFolder)) {
  fs.mkdirSync(hlsFolder);
}

// Create one HTTP server for both Express and WebSocket
const server = require("http").createServer(app);
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  console.log("Broadcaster connected");

  const ffmpeg = spawn(ffmpegPath, [
    "-f", "s16le",
    "-ar", "16000",
    "-ac", "1",
    "-i", "pipe:0",
    "-c:a", "aac",
    "-b:a", "128k",
    "-f", "hls",
    "-hls_time", "2",
    "-hls_list_size", "5",
    "-hls_flags", "delete_segments",
    path.join(hlsFolder, "stream.m3u8"),
  ]);

  ffmpeg.stderr.on("data", (data) => {
    console.error(`FFmpeg stderr: ${data}`);
  });

  ffmpeg.on("close", (code) => {
    console.log(`FFmpeg exited with code ${code}`);
  });

  ws.on("message", (message) => {
    if (Buffer.isBuffer(message)) {
      ffmpeg.stdin.write(message);
    }
  });

  ws.on("close", () => {
    console.log("Broadcaster disconnected");
    ffmpeg.stdin.end();
  });
});

// Serve HLS files
app.use(express.static(hlsFolder));

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}/stream.m3u8`);
});
