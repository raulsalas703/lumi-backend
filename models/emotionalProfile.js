// models/emotionalProfile.js
import mongoose from "mongoose";

const emotionalProfileSchema = new mongoose.Schema(
  {
    userId: { type: String, unique: true, required: true },

    // última emoción detectada en sus mensajes
    lastEmotion: { type: String, default: "neutral" },

    // conteo histórico por tipo de emoción
    emotionCounts: {
      type: Map,
      of: Number,
      default: {}
    },

    // texto opcional con un mini resumen
    summary: { type: String, default: "" }
  },
  { timestamps: true }
);

export const EmotionalProfile = mongoose.model(
  "EmotionalProfile",
  emotionalProfileSchema
);
