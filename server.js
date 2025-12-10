// server.js
import bcrypt from "bcryptjs";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import Groq from "groq-sdk";
import path from "path";
import { fileURLToPath } from "url";

import { User } from "./models/user.js";
import { Conversation } from "./models/conversation.js";
import { EmotionalProfile } from "./models/emotionalProfile.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename)

const app = express();
const PORT = process.env.PORT || 3000;
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });


app.use(cors());
app.use(express.json());

// ====== FRONTEND (carpeta fronted) ======
app.use(express.static(path.join(__dirname, "fronted")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "fronted", "Lumi-chatbot.html"));
});


const EMOTION_LABELS = [
  "triste", "ansioso", "enojado", "frustrado", "estresado",
  "cansado", "feliz", "aliviado", "confundido", "solo", "neutral"
];

console.log("MONGO_URI:", process.env.MONGO_URI);

// ===================================
// Conexión a MongoDB
// ===================================
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Atlas conectado");
  } catch (err) {
    console.error("❌ Error conectando a MongoDB:", err);
  }
}

// ===================================
// Clasificador emocional
// ===================================
async function classifyEmotion(text) {
  const prompt = `
Eres un clasificador emocional.
Responde SOLO una palabra (minúsculas):
${EMOTION_LABELS.join(", ")}.
Si no estás seguro, responde "neutral".
`;

  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: text }
    ]
  });

  const raw = completion?.choices?.[0]?.message?.content || "neutral";
  const emo = raw.toLowerCase().trim();

  return EMOTION_LABELS.includes(emo) ? emo : "neutral";
}

// ===================================
// Actualización de perfil
// ===================================
async function updateEmotionalProfile(userId, emotion) {
  let prof = await EmotionalProfile.findOne({ userId });

  if (!prof) {
    return EmotionalProfile.create({
      userId,
      lastEmotion: emotion,
      emotionCounts: { [emotion]: 1 },
      summary: `Emoción más frecuente: ${emotion} (1)`
    });
  }

  const counts = prof.emotionCounts || {};
  counts[emotion] = (counts[emotion] || 0) + 1;

  prof.lastEmotion = emotion;
  prof.emotionCounts = counts;

  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  prof.summary = `Emociones frecuentes: ${entries
    .slice(0, 3)
    .map(([e, n]) => `${e} (${n})`)
    .join(", ")}`;

  await prof.save();
  return prof;
}

app.use(cors());
app.use(express.json());

// ===================================
// Auth: Registro
// ===================================
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, username, password, confirmPassword } = req.body;

    if (!email || !username || !password || !confirmPassword)
      return res.status(400).json({ message: "Faltan datos." });

    if (password !== confirmPassword)
      return res.status(400).json({ message: "Las contraseñas no coinciden." });

    if (password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password))
      return res.status(400).json({
        message: "Debes usar mínimo 8 caracteres, mayúscula y minúscula."
      });

    const exists = await User.findOne({ email });
    if (exists)
      return res.status(400).json({ message: "Ese correo ya está registrado." });

    const hash = await bcrypt.hash(password, 10);

    const userId = new mongoose.Types.ObjectId().toString();
    const user = await User.create({ userId, email, username, passwordHash: hash });

    res.json({
      message: "Cuenta creada correctamente.",
      userId: user.userId,
      username: user.username
    });
  } catch (err) {
    res.status(500).json({ message: "Error al registrar." });
  }
});

// ===================================
// Auth: Login
// ===================================
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: "Correo o contraseña incorrectos." });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok)
      return res.status(400).json({ message: "Correo o contraseña incorrectos." });

    res.json({
      message: "Login correcto.",
      userId: user.userId,
      username: user.username
    });
  } catch {
    res.status(500).json({ message: "Error al iniciar sesión." });
  }
});

// ========== HISTORIAL DE CONVERSACIÓN (tipo ChatGPT) ==========
app.get("/api/history/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: "Falta userId." });
    }

    // Buscar todas las interacciones de ese usuario, ordenadas por fecha (viejas arriba)
    const convs = await Conversation.find({ userId }).sort({ createdAt: 1 });

    res.json(convs);
  } catch (err) {
    console.error("Error en /api/history:", err);
    res.status(500).json({ message: "Error al obtener historial." });
  }
});


// ===================================
// Chat principal de Lumi
// ===================================
app.post("/api/chat", async (req, res) => {
  try {
    const { userId, message, isGuest } = req.body;

    console.log("Mensaje recibido:", { userId, message, isGuest });

    if (!message)
      return res.status(400).json({ message: "Falta el mensaje." });

    let emotionalContext = "";

    if (isGuest) {
      emotionalContext = `Usuario invitado sin historial emocional.`;
    } else {
      const prof = await EmotionalProfile.findOne({ userId });

      emotionalContext = prof
        ? `Historial emocional: ${prof.summary}. Última emoción: ${prof.lastEmotion}.`
        : `No hay historial emocional previo.`;
    }

    const systemPrompt = `
Eres Lumi, un ajolotito emocional.
Hablas cálido, amable y sin diagnosticar.
${emotionalContext}
Responde en un párrafo corto.
`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ]
    });

    const reply =
      completion?.choices?.[0]?.message?.content ||
      "Lo siento, tuve un error al responder.";

    const emotion = await classifyEmotion(message);

    if (!isGuest) {
      await updateEmotionalProfile(userId, emotion);
      await Conversation.create({ userId, message, reply, emotion });
    }

    res.json({ reply, emotion });
  } catch (err) {
    console.error("Error en chat:", err);
    res.status(500).json({ message: "Error interno." });
  }
});

// ========== HISTORIAL DE CONVERSACIÓN (tipo ChatGPT) ==========
app.get("/api/history/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: "Falta userId." });
    }

    const convs = await Conversation.find({ userId }).sort({ createdAt: 1 });
    res.json(convs);
  } catch (err) {
    console.error("Error en /api/history:", err);
    res.status(500).json({ message: "Error al obtener historial." });
  }
});


// ========== HISTORIAL DE CONVERSACIÓN (tipo ChatGPT) ==========
app.get("/api/history/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: "Falta userId." });
    }

    // Todas las interacciones de ese usuario, de las más viejas a las más nuevas
    const convs = await Conversation.find({ userId }).sort({ createdAt: 1 });

    res.json(convs);
  } catch (err) {
    console.error("Error en /api/history:", err);
    res.status(500).json({ message: "Error al obtener historial." });
  }
});


// ===================================
// Iniciar Servidor
// ===================================
(async () => {
  await connectDB();
  app.listen(PORT, () =>
    console.log(`🚀 Servidor escuchando en puerto ${PORT}`)
  );
})();
