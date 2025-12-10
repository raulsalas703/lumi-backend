// conversation.js
import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    message: { type: String, required: true },
    reply: { type: String, required: true },
    emotion: { type: String, default: "neutral" },
  },
  { timestamps: true }  // 👈 IMPORTANTE
);

export const Conversation = mongoose.model("Conversation", conversationSchema);
