import express from "express";
import mongoose from "mongoose";
import http from "http";
import { Server } from "socket.io";

const app = express();
app.use(express.json());

// Kết nối MongoDB
mongoose.connect("mongodb://localhost:27017/chat_service");

// Mongoose Schema
const MessageSchema = new mongoose.Schema({
  sender: String,
  text: String,
  createdAt: { type: Date, default: Date.now }
});
const Message = mongoose.model("Message", MessageSchema);

// API: Lấy danh sách tin nhắn
app.get("/messages", async (req, res) => {
  const messages = await Message.find().sort({ createdAt: 1 });
  res.json(messages);
});

// API: Gửi tin nhắn mới (tin tưởng header từ Kong)
app.post("/messages", async (req, res) => {
  try {
    const { text } = req.body;
    const sender = req.headers["x-consumer-username"]; // header do Kong inject

    if (!sender) {
      return res.status(401).json({ error: "Unauthorized - Missing user" });
    }

    const newMsg = new Message({ sender, text });
    await newMsg.save();

    io.emit("chat message", newMsg); // realtime
    res.json(newMsg);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tạo HTTP server + Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

server.listen(4000, () => console.log("Chat service running on port 4000"));
