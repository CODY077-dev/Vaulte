import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
  });

  const PORT = 3000;
  const MESSAGES_FILE = path.join(process.cwd(), "chat_history.json");

  app.use(express.json());

  const FIREBASE_PROJECT = 'game-day-app-115a4';
  const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;

  // GET all events
  app.get('/api/events', async (req, res) => {
    try {
      const r = await fetch(`${FIRESTORE_BASE}/events`);
      const data = await r.json();
      const events = (data.documents || []).map((doc: any) => {
        const fields = doc.fields || {};
        const out: any = {};
        Object.keys(fields).forEach(k => {
          const v = fields[k];
          out[k] = v.stringValue ?? v.integerValue ?? v.booleanValue ?? v.timestampValue ?? v.nullValue ?? null;
        });
        return out;
      });
      res.json(events);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST save event
  app.post('/api/events', async (req, res) => {
    try {
      const event = req.body;
      const fields: any = {};
      Object.keys(event).forEach(k => {
        if (typeof event[k] === 'string') fields[k] = { stringValue: event[k] };
        else if (typeof event[k] === 'boolean') fields[k] = { booleanValue: event[k] };
        else if (typeof event[k] === 'number') fields[k] = { integerValue: String(event[k]) };
        else if (event[k] === null) fields[k] = { nullValue: null };
        else fields[k] = { stringValue: JSON.stringify(event[k]) };
      });
      const r = await fetch(`${FIRESTORE_BASE}/events?documentId=${event.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields })
      });
      const data = await r.json();
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // DELETE event
  app.delete('/api/events/:id', async (req, res) => {
    try {
      await fetch(`${FIRESTORE_BASE}/events/${req.params.id}`, { method: 'DELETE' });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Load existing messages from file
  let teamMessages: Record<string, any[]> = {};
  try {
    if (fs.existsSync(MESSAGES_FILE)) {
      const data = fs.readFileSync(MESSAGES_FILE, "utf-8");
      teamMessages = JSON.parse(data);
    }
  } catch (err) {
    console.error("Error loading chat history:", err);
  }

  const saveMessages = () => {
    try {
      fs.writeFileSync(MESSAGES_FILE, JSON.stringify(teamMessages), "utf-8");
    } catch (err) {
      console.error("Error saving chat history:", err);
    }
  };

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("join_room", ({ teamId, channelId }: { teamId: string, channelId: string }) => {
      const roomId = `${teamId}-${channelId}`;
      socket.join(roomId);
      console.log(`User ${socket.id} joined room: ${roomId}`);
      
      // Send existing messages for this specific room
      if (!teamMessages[roomId]) {
        teamMessages[roomId] = [];
      }
      socket.emit("initial_messages", { roomId, messages: teamMessages[roomId] });
    });

    socket.on("send_message", (msg) => {
      const { teamId, channelId } = msg;
      const roomId = `${teamId}-${channelId}`;
      console.log(`Received message from ${socket.id} for room ${roomId}: ${msg.text}`);
      
      const message = {
        ...msg,
        id: msg.id || Date.now().toString(),
        timestamp: msg.timestamp || new Date().toISOString(),
      };
      
      if (!teamMessages[roomId]) {
        teamMessages[roomId] = [];
      }
      teamMessages[roomId].push(message);
      
      if (teamMessages[roomId].length > 1000) teamMessages[roomId].shift();
      
      saveMessages();
      
      console.log(`Broadcasting message to room ${roomId}`);
      io.to(roomId).emit("new_message", message);
      // Notify everyone in the team about a new message in this channel for unread counts
      io.emit("global_new_message", { teamId, channelId });
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in development mode with Vite middleware");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        host: '0.0.0.0',
        port: 3000
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in production mode serving dist/");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Critical server start failure:", err);
});
