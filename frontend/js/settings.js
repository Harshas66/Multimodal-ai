import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const API = (() => {
  if (window.API_ENDPOINT) return window.API_ENDPOINT;
  const stored = localStorage.getItem("apiEndpoint");
  if (stored) return stored;
  if (["localhost", "127.0.0.1"].includes(window.location.hostname)) return "http://127.0.0.1:8000";
  return window.location.origin;
})();

const KEYS = {
  chats: "hybrid_chats",
  token: "token",
  user: "user",
  memoryEnabled: "memory_enabled",
  darkMode: "dark_mode",
  language: "language",
  platformMode: "platform_mode"
};

function authHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Authorization": "Bearer " + token,
    "Content-Type": "application/json"
  };
}

async function waitForFirebaseUser() {
  if (auth.currentUser) return auth.currentUser;
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user || null);
    });
  });
}

async function ensureToken() {
  let user = auth.currentUser;
  if (!user) user = await waitForFirebaseUser();

  if (!user) {
    const token = localStorage.getItem(KEYS.token);
    if (!token) {
      window.location.href = "index.html";
      throw new Error("Authentication required");
    }
    return token;
  }

  const token = await user.getIdToken(true);
  localStorage.setItem(KEYS.token, token);
  localStorage.setItem(KEYS.user, JSON.stringify({
    id: user.uid,
    name: user.displayName || "",
    email: user.email || "",
    provider: "google"
  }));
  return token;
}

async function authorizedFetch(url, options = {}) {
  await ensureToken();
  const headers = { ...(options.headers || {}), ...authHeaders() };
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401) {
    localStorage.removeItem(KEYS.token);
    window.location.href = "index.html";
  }
  return response;
}

function loadProfile() {
  const user = JSON.parse(localStorage.getItem(KEYS.user) || "{}");
  const chats = JSON.parse(localStorage.getItem(KEYS.chats) || "[]");

  document.getElementById("profileName").textContent = user.name || "Unknown";
  document.getElementById("profileEmail").textContent = user.email || "Unknown";
  document.getElementById("profileChats").textContent = String(chats.length);
}

function loadPreferences() {
  document.getElementById("memoryToggle").checked = localStorage.getItem(KEYS.memoryEnabled) !== "false";
  const darkOn = localStorage.getItem(KEYS.darkMode) === "true";
  document.getElementById("darkModeToggle").checked = darkOn;
  document.getElementById("languageSelect").value = localStorage.getItem(KEYS.language) || "en";
  document.getElementById("platformMode").value = localStorage.getItem(KEYS.platformMode) || "web";
  document.body.classList.toggle("dark-mode", darkOn);
}

function savePreferences() {
  localStorage.setItem(KEYS.memoryEnabled, document.getElementById("memoryToggle").checked ? "true" : "false");
  const dark = document.getElementById("darkModeToggle").checked;
  localStorage.setItem(KEYS.darkMode, dark ? "true" : "false");
  document.body.classList.toggle("dark-mode", dark);
  localStorage.setItem(KEYS.language, document.getElementById("languageSelect").value);
  localStorage.setItem(KEYS.platformMode, document.getElementById("platformMode").value);
}

function exportChats() {
  const chats = localStorage.getItem(KEYS.chats) || "[]";
  const blob = new Blob([chats], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `chat-history-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function clearChats() {
  if (!confirm("Clear all chat history from local storage?")) return;
  localStorage.setItem(KEYS.chats, "[]");
  loadProfile();
  alert("Local chat history cleared.");
}

function mergeChats(localChats, cloudChats) {
  const map = new Map();
  [...localChats, ...cloudChats].forEach((chat) => {
    const id = chat.id;
    if (!id) return;
    if (!map.has(id)) {
      map.set(id, { ...chat, messages: Array.isArray(chat.messages) ? [...chat.messages] : [] });
      return;
    }

    const existing = map.get(id);
    const dedupe = new Map();
    [...(existing.messages || []), ...(chat.messages || [])].forEach((msg) => {
      const key = msg.id || `${msg.role}|${msg.content || msg.text}|${msg.timestamp || msg.createdAt}`;
      dedupe.set(key, msg);
    });

    existing.messages = [...dedupe.values()].sort((a, b) => new Date((a.timestamp || a.createdAt)) - new Date((b.timestamp || b.createdAt)));
    existing.title = existing.title === "New Chat" && chat.title ? chat.title : existing.title;
  });

  return [...map.values()];
}

async function syncData() {
  const status = document.getElementById("syncStatus");
  status.textContent = "Sync in progress...";

  try {
    const localChats = JSON.parse(localStorage.getItem(KEYS.chats) || "[]");
    const source = localStorage.getItem(KEYS.platformMode) === "app" ? "app" : "web";

    const upload = await authorizedFetch(`${API}/api/sync/manual`, {
      method: "POST",
      body: JSON.stringify({ source, chats: localChats })
    });

    const uploadData = await upload.json();
    if (!upload.ok) throw new Error(uploadData.detail || "Sync failed");

    const cloudChats = uploadData.cloud?.chats || [];
    const merged = mergeChats(localChats, cloudChats);
    localStorage.setItem(KEYS.chats, JSON.stringify(merged));
    loadProfile();

    status.textContent = `Sync complete at ${new Date().toLocaleTimeString()}`;
  } catch (error) {
    status.textContent = `Sync failed: ${error.message}`;
  }
}

function logout() {
  localStorage.removeItem(KEYS.token);
  localStorage.removeItem(KEYS.user);
  window.location.href = "index.html";
}

function bindEvents() {
  document.getElementById("memoryToggle").addEventListener("change", savePreferences);
  document.getElementById("darkModeToggle").addEventListener("change", savePreferences);
  document.getElementById("languageSelect").addEventListener("change", savePreferences);
  document.getElementById("platformMode").addEventListener("change", savePreferences);
  document.getElementById("exportBtn").addEventListener("click", exportChats);
  document.getElementById("clearBtn").addEventListener("click", clearChats);
  document.getElementById("syncBtn").addEventListener("click", syncData);
  document.getElementById("logoutBtn").addEventListener("click", logout);
}

async function init() {
  const token = localStorage.getItem(KEYS.token);
  if (!token) {
    window.location.href = "index.html";
    return;
  }

  await ensureToken();
  loadProfile();
  loadPreferences();
  bindEvents();
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch(() => {
    window.location.href = "index.html";
  });
});