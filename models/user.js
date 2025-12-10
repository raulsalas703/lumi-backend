// models/user.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    // ID lógico que usamos en Lumi para conversaciones y perfil emocional
    userId: { type: String, unique: true, required: true },

    // Datos de login
    email: { type: String, unique: true, required: true },
    username: { type: String, required: true },
    passwordHash: { type: String, required: true },

    // Por si luego quieres que el usuario elija si Lumi recuerde su historial
    consentMemory: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
