import express from "express";
import mongoose from "mongoose";
import http from "http";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";

const JWT_SECRET = "your-secret-key"; // 👉 Thực tế để trong .env

const app = express();
app.use(express.json());

// ✅ Middleware check JWT
function checkJWT(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Missing token" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
}

// ✅ Kết nối MongoDB
mongoose.connect("mongodb://localhost:27017/chat_service");

// ✅ Schema
const MessageSchema = new mongoose.Schema({
  sender: String,
  text: String,
  createdAt: { type: Date, default: Date.now }
});
const Message = mongoose.model("Message", MessageSchema);

// ✅ API lấy danh sách tin nhắn (cần JWT)
app.get("/messages", checkJWT, async (req, res) => {
  const messages = await Message.find().sort({ createdAt: 1 });
  res.json(messages);
});

// ✅ API gửi tin nhắn (cần JWT)
app.post("/messages", checkJWT, async (req, res) => {
  try {
    const { text } = req.body;
    const sender = req.user.username; // 👈 Lấy từ JWT payload

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

// ✅ Tạo HTTP server + Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// ✅ Socket.IO cũng check JWT
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("No token"));

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return next(new Error("Invalid token"));
    socket.user = user;
    next();
  });
});

io.on("connection", (socket) => {
  console.log("🔌 User connected:", socket.user.username);

  socket.on("chat message", async (text) => {
    const newMsg = new Message({
      sender: socket.user.username,
      text
    });
    await newMsg.save();

    io.emit("chat message", newMsg);
  });

  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.user.username);
  });
});

server.listen(4000, () => console.log("🚀 Chat service running on port 4000"));
