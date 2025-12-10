// =========================
// CONFIG BÁSICA
// =========================
const API_BASE = "https://lumi-chatbot.up.railway.app";

const chatEl = document.getElementById("chat");
const inputEl = document.getElementById("msg");
const sendBtn = document.getElementById("send-btn");
const typingEl = document.getElementById("typing-indicator");
const headerStatusEl = document.getElementById("header-status");

const authOverlay = document.getElementById("auth-overlay");
const tabLogin = document.getElementById("tab-login");
const tabRegister = document.getElementById("tab-register");
const formLogin = document.getElementById("form-login");
const formRegister = document.getElementById("form-register");
const loginErrorEl = document.getElementById("login-error");
const regErrorEl = document.getElementById("reg-error");
const guestBtn = document.getElementById("guest-btn");
const authModeLabel = document.getElementById("auth-mode-label");
const logoutBtn = document.getElementById("logout-btn");

const historyOverlay = document.getElementById("history-overlay");
const historyListEl = document.getElementById("history-list");
const historyBtn = document.getElementById("history-btn");
const closeHistoryBtn = document.getElementById("close-history");

// Temas
const themeDots = document.querySelectorAll(".theme-dot");

// Estado de usuario actual
let currentUser = {
  mode: "guest", // "guest" | "registered"
  userId: null,
  username: "Invitado",
};

let fullHistory = []; // historial desde BD (usuarios registrados)
let activeSessionKey = "all";

// =========================
// UTILIDADES DE MENSAJES
// =========================

function appendMessage(text, from = "lumi") {
  const div = document.createElement("div");
  div.className = `message ${from}`;

  const author = document.createElement("span");
  author.className = "author";
  author.textContent = from === "user" ? "Tú" : "Lumi";

  const body = document.createElement("span");
  body.className = "text";
  body.textContent = text;

  div.appendChild(author);
  div.appendChild(body);

  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function startTyping() {
  typingEl.style.display = "block";
}

function stopTyping() {
  typingEl.style.display = "none";
}

function activarChat() {
  inputEl.disabled = false;
  sendBtn.disabled = false;
}

function desactivarChat() {
  inputEl.disabled = true;
  sendBtn.disabled = true;
  inputEl.value = "";
}

// =========================
// TEMAS
// =========================

function applyTheme(themeName) {
  document.body.classList.remove("theme-purple", "theme-blue");
  if (themeName === "purple") document.body.classList.add("theme-purple");
  if (themeName === "blue") document.body.classList.add("theme-blue");
  if (themeName === "rose") {
    // sin clase = por defecto rosa
  }
  localStorage.setItem("lumi-theme", themeName);
}

const savedTheme = localStorage.getItem("lumi-theme") || "rose";
applyTheme(savedTheme);

themeDots.forEach((dot) => {
  dot.addEventListener("click", () => {
    const themeName = dot.dataset.theme;
    applyTheme(themeName);
  });
});

// =========================
// HISTORIAL LOCAL (INVITADO)
// =========================

function getStorageKey() {
  return "lumi-history-guest";
}

function saveHistory() {
  // Solo invitado guarda en localStorage
  if (currentUser.mode !== "guest") return;

  const messageEls = chatEl.querySelectorAll(".message");
  const messages = [];
  messageEls.forEach((el) => {
    const from = el.classList.contains("user") ? "user" : "lumi";
    const spans = el.querySelectorAll("span");
    const text = spans[1]?.textContent || "";
    messages.push({ from, text });
  });
  localStorage.setItem(getStorageKey(), JSON.stringify(messages));
}

async function loadHistory() {
  chatEl.innerHTML = "";

  // Invitado => solo localStorage
  if (currentUser.mode === "guest" || !currentUser.userId) {
    const raw = localStorage.getItem(getStorageKey());
    if (!raw) {
      appendMessage(
        "Hola, soy Lumi, tu ajolotito de apoyo emocional 🌸🦎 ¿Cómo te sientes hoy?",
        "lumi"
      );
      return;
    }
    try {
      const messages = JSON.parse(raw);
      messages.forEach((msg) => appendMessage(msg.text, msg.from));
    } catch {
      appendMessage(
        "Hola, soy Lumi, tu ajolotito de apoyo emocional 🌸🦎 ¿Cómo te sientes hoy?",
        "lumi"
      );
    }
    return;
  }

  // Usuario registrado => historial desde Mongo
  try {
    const res = await fetch(`${API_BASE}/api/history/${currentUser.userId}`);
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      fullHistory = [];
      appendMessage(
        `Hola ${currentUser.username}, soy Lumi 🌸🦎 ¿Cómo te sientes hoy?`,
        "lumi"
      );
      buildHistoryList([]);
      return;
    }

    fullHistory = data;
    activeSessionKey = "all";
    renderChatFromHistory(fullHistory);
    buildHistoryList(fullHistory);
  } catch (err) {
    console.error("Error cargando historial:", err);
    fullHistory = [];
    appendMessage(
      `Hola ${currentUser.username}, tuve un problema para cargar tu historial, pero podemos seguir platicando desde aquí 🦎💖`,
      "lumi"
    );
  }
}

// =========================
// FORMATO DE FECHAS
// =========================

function formatDateKey(dateStr) {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`; // 2025-12-09
}

function formatDateHuman(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  const diffMs = today - d;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";

  return d.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

// =========================
// RENDER DE CHAT DESDE HISTORIAL
// =========================

function renderChatFromHistory(history, sessionKey = "all") {
  chatEl.innerHTML = "";

  let filtered = history;
  if (sessionKey !== "all") {
    filtered = history.filter(
      (h) => formatDateKey(h.createdAt) === sessionKey
    );
  }

  if (!filtered || filtered.length === 0) {
    appendMessage(
      "No hay mensajes en esta conversación todavía, pero puedes comenzar cuando quieras 🦎🌸",
      "lumi"
    );
    return;
  }

  filtered.forEach((item) => {
    appendMessage(item.message, "user");
    appendMessage(item.reply, "lumi");
  });

  chatEl.scrollTop = chatEl.scrollHeight;
}

// =========================
// LISTA LATERAL DE HISTORIAL
// =========================

function buildHistoryList(history) {
  historyListEl.innerHTML = "";

  // Item "Todo el historial"
  const allItem = document.createElement("div");
  allItem.className =
    "history-item" + (activeSessionKey === "all" ? " active" : "");
  allItem.innerHTML = `
    <div class="history-item-date">Todo el historial</div>
    <div class="history-item-snippet">Ver todos los mensajes con Lumi</div>
  `;
  allItem.addEventListener("click", () => {
    activeSessionKey = "all";
    renderChatFromHistory(fullHistory, "all");
    buildHistoryList(fullHistory);
  });
  historyListEl.appendChild(allItem);

  if (!history || history.length === 0) return;

  const sessionsMap = new Map();
  history.forEach((item) => {
    const key = formatDateKey(item.createdAt);
    if (!sessionsMap.has(key)) {
      sessionsMap.set(key, []);
    }
    sessionsMap.get(key).push(item);
  });

  const keysSorted = Array.from(sessionsMap.keys()).sort((a, b) =>
    a < b ? 1 : -1
  );

  keysSorted.forEach((key) => {
    const items = sessionsMap.get(key);
    const last = items[items.length - 1];
    const humanDate = formatDateHuman(last.createdAt);
    const snippetSource = last.reply || last.message || "";
    const snippet =
      snippetSource.length > 60
        ? snippetSource.slice(0, 60) + "..."
        : snippetSource;

    const itemDiv = document.createElement("div");
    itemDiv.className =
      "history-item" + (activeSessionKey === key ? " active" : "");
    itemDiv.innerHTML = `
      <div class="history-item-date">${humanDate}</div>
      <div class="history-item-snippet">${snippet}</div>
      <div class="history-item-meta">${items.length} mensajes</div>
    `;

    itemDiv.addEventListener("click", () => {
      activeSessionKey = key;
      renderChatFromHistory(fullHistory, key);
      buildHistoryList(fullHistory);
    });

    historyListEl.appendChild(itemDiv);
  });
}

// =========================
// ENVÍO DE MENSAJE
// =========================

async function sendCurrentMessage() {
  const text = inputEl.value.trim();
  if (!text) return;
  appendMessage(text, "user");
  inputEl.value = "";
  saveHistory();

  startTyping();

  try {
    const body = {
      userId: currentUser.userId,
      message: text,
      isGuest: currentUser.mode === "guest",
    };

    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    stopTyping();

    if (data && data.reply) {
      appendMessage(data.reply, "lumi");
      saveHistory();
    } else {
      appendMessage(
        "Lo siento, tuve un problema al responder 😿.",
        "lumi"
      );
    }
  } catch (err) {
    console.error(err);
    stopTyping();
    appendMessage(
      "Tuve un problema al conectar con el servidor 😿.",
      "lumi"
    );
  }
}

sendBtn.addEventListener("click", () => {
  sendCurrentMessage();
});

inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendCurrentMessage();
  }
});

// =========================
// AUTENTICACIÓN
// =========================

tabLogin.addEventListener("click", () => {
  tabLogin.classList.add("active");
  tabRegister.classList.remove("active");
  formLogin.style.display = "flex";
  formRegister.style.display = "none";
  loginErrorEl.textContent = "";
  regErrorEl.textContent = "";
});

tabRegister.addEventListener("click", () => {
  tabRegister.classList.add("active");
  tabLogin.classList.remove("active");
  formLogin.style.display = "none";
  formRegister.style.display = "flex";
  loginErrorEl.textContent = "";
  regErrorEl.textContent = "";
});

formLogin.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginErrorEl.textContent = "";

  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      loginErrorEl.textContent = data.message || "Error al iniciar sesión.";
      return;
    }

    currentUser = {
      mode: "registered",
      userId: data.userId,
      username: data.username || "Usuario",
    };

    headerStatusEl.textContent = `Conectado como ${currentUser.username}`;
    authModeLabel.textContent =
      "Usuario registrado (se guarda en la base de datos)";
    authOverlay.style.display = "none";
    activarChat();
    inputEl.placeholder =
      "Escríbele a Lumi lo que quieras compartir...";

    logoutBtn.style.display = "inline-flex";
    logoutBtn.textContent = "Cerrar sesión";
    historyBtn.style.display = "inline-flex";

    await loadHistory();

  } catch (err) {
    console.error(err);
    loginErrorEl.textContent = "Error de conexión con el servidor.";
  }
});

formRegister.addEventListener("submit", async (e) => {
  e.preventDefault();
  regErrorEl.textContent = "";

  const username = document.getElementById("reg-username").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;
  const confirmPassword = document.getElementById("reg-confirm").value;

  if (password !== confirmPassword) {
    regErrorEl.textContent = "Las contraseñas no coinciden.";
    return;
  }

  if (
    password.length < 8 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password)
  ) {
    regErrorEl.textContent =
      "La contraseña debe tener mínimo 8 caracteres, una mayúscula y una minúscula.";
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, username, password, confirmPassword }),
    });

    const data = await res.json();

    if (!res.ok) {
      regErrorEl.textContent = data.message || "Error al registrar.";
      return;
    }

    currentUser = {
      mode: "registered",
      userId: data.userId,
      username: data.username || username,
    };

    headerStatusEl.textContent = `Conectado como ${currentUser.username}`;
    authModeLabel.textContent =
      "Usuario registrado (se guarda en la base de datos)";
    authOverlay.style.display = "none";
    activarChat();
    inputEl.placeholder =
      "Escríbele a Lumi lo que quieras compartir...";

    logoutBtn.style.display = "inline-flex";
    logoutBtn.textContent = "Cerrar sesión";
    historyBtn.style.display = "inline-flex";

    await loadHistory();

  } catch (err) {
    console.error(err);
    regErrorEl.textContent = "Error de conexión con el servidor.";
  }
});

// Invitado
guestBtn.addEventListener("click", () => {
  currentUser = {
    mode: "guest",
    userId: null,
    username: "Invitado",
  };

  headerStatusEl.textContent = "Modo invitado (solo local)";
  authModeLabel.textContent = "Invitado (no se guarda en la base de datos)";
  authOverlay.style.display = "none";

  historyBtn.style.display = "none";

  // 👇 Mostrar botón para poder ir luego a login/registro
  logoutBtn.style.display = "inline-flex";
  logoutBtn.textContent = "Iniciar sesión / Registrarse";

  activarChat();
  inputEl.placeholder =
    "Estás en modo invitado, lo que hables se guarda solo en tu navegador.";

  loadHistory();
});


// Logout
logoutBtn.addEventListener("click", () => {
  // 👇 Si estamos en invitado, solo abrir el panel para que pueda iniciar sesión/registrarse
  if (currentUser.mode === "guest" || !currentUser.userId) {
    authOverlay.style.display = "flex";
    return;
  }

  // 👇 Si está logueado como usuario registrado, entonces sí hacemos logout real
  currentUser = {
    mode: "guest",
    userId: null,
    username: "Invitado",
  };

  headerStatusEl.textContent = "Modo invitado";
  desactivarChat();
  authModeLabel.textContent = "Invitado (no se guarda en la base de datos)";
  authOverlay.style.display = "flex";
  historyBtn.style.display = "none";

  // al regresar a invitado, el botón sirve para volver a login/registro
  logoutBtn.style.display = "inline-flex";
  logoutBtn.textContent = "Iniciar sesión / Registrarse";
});


// Historial lateral
historyBtn.addEventListener("click", () => {
  if (currentUser.mode !== "registered" || !currentUser.userId) return;
  historyOverlay.style.display = "flex";
});

closeHistoryBtn.addEventListener("click", () => {
  historyOverlay.style.display = "none";
});

// Al inicio: chat desactivado hasta elegir modo
desactivarChat();
loadHistory();
