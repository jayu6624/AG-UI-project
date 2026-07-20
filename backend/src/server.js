import express from "express";
import cors from "cors";
import "dotenv/config";
import { chatRouter } from "./routes/chat.js";

const app = express();
app.use(cors({
  origin: process.env.FRONTEND_URL 
    ? process.env.FRONTEND_URL.split(",") 
    : "http://localhost:5173"
}));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api", chatRouter);

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`Dynamic UI POC backend listening on http://localhost:${PORT}`);
});
