import { auth } from "./firebase.js?v=3.3";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const API = (() => {
  // override support
  if (window.API_ENDPOINT) return window.API_ENDPOINT;

  const stored = localStorage.getItem("apiEndpoint");
  if (stored) return stored;

  // local dev
  if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    return "http://127.0.0.1:8000";
  }

  // ✅ production backend (IMPORTANT)
  return "https://multimodal-ai-backend-xu4a.onrender.com";
})();
const STORAGE_KEYS = {
  chats: "hybrid_chats",
  currentChatId: "hybrid_current_chat",
  platformMode: "platform_mode",
  memoryEnabled: "memory_enabled",
  tokenTimestamp: "token_timestamp",
  sidebarOpen: "chat_sidebar_open",
  token: "token",
  user: "user",
  authProvider: "authProvider"
};

const TOKEN_DURATION = 50 * 60 * 1000;
const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition || null;

const state = {
  chats: [],
  currentChatId: null,
  search: "",
  sending: false,
  activeChatMenuId: null,
  editingChatId: null,
  editingMessageId: null,
  selectedImageDataUrl: "",
  selectedImageFile: null,
  doubtMode: false,
  starredModalOpen: false,
  modalCloseTimer: null,
  isSidebarOpen: true,
  token: null,
  user: null,
  voiceRecognition: null,
  voiceSupported: Boolean(SpeechRecognitionCtor),
  voiceListening: false,
  voicePermissionDenied: false,
  voiceTranscriptBase: "",
  voiceLastStatus: ""
};

const dom = {
  chatApp: document.getElementById("chatApp"),
  sidebar: document.getElementById("sidebar"),
  chatTitle: document.getElementById("chatTitle"),
  chatSubtitle: document.getElementById("chatSubtitle"),
  chatSearch: document.getElementById("chatSearch"),
  chatList: document.getElementById("chatList"),
  chatBox: document.getElementById("chatBox"),
  userInput: document.getElementById("userInput"),
  sendBtn: document.getElementById("sendBtn"),
  newChatBtn: document.getElementById("newChatBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  settingsLink: document.querySelector('.sidebar-bottom a[href="settings.html"]'),
  mobileSidebarToggle: document.getElementById("mobileSidebarToggle"),
  sidebarOverlay: document.getElementById("sidebarOverlay"),
  aiStatus: document.getElementById("aiStatus"),
  imageInput: document.getElementById("imageInput"),
  imageBtn: document.getElementById("imageBtn"),
  composerImage: document.getElementById("composerImage"),
  composerImagePreview: document.getElementById("composerImagePreview"),
  removeImageBtn: document.getElementById("removeImageBtn"),
  micBtn: document.getElementById("micBtn"),
  doubtModeBtn: document.getElementById("doubtModeBtn"),
  starredBtn: document.getElementById("starredBtn"),
  starredModal: document.getElementById("starredModal"),
  starredList: document.getElementById("starredList"),
  closeStarredBtn: document.getElementById("closeStarredBtn")
};

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function getSourceMode() {
  return localStorage.getItem(STORAGE_KEYS.platformMode) === "app" ? "app" : "web";
}

function memoryEnabled() {
  return localStorage.getItem(STORAGE_KEYS.memoryEnabled) !== "false";
}

function isTokenFresh() {
  const raw = localStorage.getItem(STORAGE_KEYS.tokenTimestamp);
  if (!raw) return false;
  const ts = Number(raw);
  return Number.isFinite(ts) && Date.now() - ts < TOKEN_DURATION;
}

function escapeHtml(value) {
  const text = value == null ? "" : String(value);
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderMarkdown(text) {
  if (!text) return "";
  if (window.marked && typeof window.marked.parse === "function") {
    return window.marked.parse(text);
  }
  return escapeHtml(text).replace(/\n/g, "<br>");
}

function createChat() {
  return {
    id: makeId("chat"),
    session_id: makeId("session"),
    title: "New Chat",
    created_at: nowIso(),
    messages: []
  };
}

function normalizeMessage(message) {
  return {
    id: message.id || makeId("msg"),
    role: message.role === "user" ? "user" : "assistant",
    text: message.content || message.text || "",
    source: message.source || getSourceMode(),
    timestamp: message.timestamp || message.created_at || message.createdAt || nowIso(),
    imageDataUrl: message.imageDataUrl || "",
    starred: Boolean(message.starred),
    isDoubt: Boolean(message.isDoubt)
  };
}

function normalizeChat(chat) {
  const messages = Array.isArray(chat.messages) ? chat.messages.map(normalizeMessage) : [];
  return {
    id: chat.id || chat.chat_id || makeId("chat"),
    session_id: chat.session_id || chat.sessionId || chat.id || makeId("session"),
    title: String(chat.title || "New Chat").trim() || "New Chat",
    created_at: chat.created_at || chat.createdAt || nowIso(),
    messages
  };
}

function loadLocalChats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.chats) || "[]";
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeChat);
  } catch (_error) {
    return [];
  }
}

function saveLocalChats() {
  localStorage.setItem(STORAGE_KEYS.chats, JSON.stringify(state.chats));
  if (state.currentChatId) {
    localStorage.setItem(STORAGE_KEYS.currentChatId, state.currentChatId);
  }
}

function currentChat() {
  return state.chats.find((chat) => chat.id === state.currentChatId) || null;
}

function ensureCurrentChat() {
  if (!state.chats.length) {
    const chat = createChat();
    state.chats.unshift(chat);
    state.currentChatId = chat.id;
    saveLocalChats();
    return;
  }

  const stored = localStorage.getItem(STORAGE_KEYS.currentChatId);
  if (stored && state.chats.some((chat) => chat.id === stored)) {
    state.currentChatId = stored;
    return;
  }

  if (!state.currentChatId || !state.chats.some((chat) => chat.id === state.currentChatId)) {
    state.currentChatId = state.chats[0].id;
  }
}

function setStatus(text) {
  if (!dom.aiStatus) return;
  const statusText = dom.aiStatus.querySelector(".status-text");
  if (statusText) statusText.textContent = text;
}

function resizeComposerInput() {
  if (!dom.userInput) return;
  dom.userInput.style.height = "auto";
  dom.userInput.style.height = `${Math.min(dom.userInput.scrollHeight, 180)}px`;
}

function setMicButtonState() {
  if (!dom.micBtn) return;

  const disabled = state.voicePermissionDenied || state.voiceListening;
  dom.micBtn.disabled = disabled;
  dom.micBtn.classList.toggle("is-listening", state.voiceListening);
  dom.micBtn.classList.toggle("is-unsupported", !state.voiceSupported || state.voicePermissionDenied);
  dom.micBtn.setAttribute("aria-pressed", state.voiceListening ? "true" : "false");

  let label = "Click to speak";
  if (!state.voiceSupported) {
    label = "Voice input is not supported in your browser";
  } else if (state.voicePermissionDenied) {
    label = "Microphone permission denied";
  } else if (state.voiceListening) {
    label = "Listening...";
  }

  dom.micBtn.setAttribute("aria-label", label);
  dom.micBtn.title = label;
}

function composeVoiceText(transcript) {
  const base = state.voiceTranscriptBase.trim();
  const spoken = String(transcript || "").trim();
  if (!base) return spoken;
  if (!spoken) return base;
  return `${base} ${spoken}`;
}

function updateVoiceTranscript(transcript) {
  if (!dom.userInput) return;
  dom.userInput.value = composeVoiceText(transcript);
  resizeComposerInput();
}

function handleVoiceError(errorCode) {
  const messages = {
    "not-allowed": "Microphone permission denied",
    "service-not-allowed": "Microphone permission denied",
    "no-speech": "No speech detected",
    network: "Network error",
    "audio-capture": "No microphone was found",
    aborted: "Voice input stopped"
  };

  if (errorCode === "not-allowed" || errorCode === "service-not-allowed") {
    state.voicePermissionDenied = true;
  }

  state.voiceLastStatus = messages[errorCode] || "Voice input failed";
  setStatus(state.voiceLastStatus);
  setMicButtonState();
}

function initializeVoiceInput() {
  if (!dom.micBtn) return;

  if (!state.voiceSupported) {
    setMicButtonState();
    return;
  }

  const recognition = new SpeechRecognitionCtor();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  recognition.onstart = () => {
    state.voiceListening = true;
    state.voiceLastStatus = "Listening...";
    setMicButtonState();
    setStatus("Listening...");
  };

  recognition.onresult = (event) => {
    let transcript = "";
    for (let i = 0; i < event.results.length; i += 1) {
      transcript += event.results[i][0].transcript;
    }
    updateVoiceTranscript(transcript);
  };

  recognition.onerror = (event) => {
    console.log("Voice error:", event.error);
    handleVoiceError(event.error);
  };

  recognition.onend = () => {
    const wasListening = state.voiceListening;
    state.voiceListening = false;
    state.voiceTranscriptBase = "";
    setMicButtonState();

    if (wasListening) {
      setStatus(state.voiceLastStatus && state.voiceLastStatus !== "Listening..." ? state.voiceLastStatus : "Online");
    }

    state.voiceLastStatus = "";
  };

  state.voiceRecognition = recognition;
  setMicButtonState();
}

function startVoiceRecognition() {
  if (!state.voiceSupported) {
    setStatus("Voice input is not supported in your browser");
    setMicButtonState();
    return;
  }

  if (state.voicePermissionDenied) {
    setStatus("Microphone permission denied");
    setMicButtonState();
    return;
  }

  if (!state.voiceRecognition || state.voiceListening) return;

  state.voiceTranscriptBase = String(dom.userInput?.value || "").trim();

  try {
    state.voiceRecognition.start();
  } catch (error) {
    console.log("Voice error:", error?.message || error);
    setStatus("Voice input failed");
    setMicButtonState();
  }
}

function buildTitleFromMessage(text) {
  const clean = (text || "").trim();
  if (!clean) return "New Chat";
  return clean.length > 44 ? `${clean.slice(0, 44)}...` : clean;
}

function isDesktop() {
  return window.matchMedia("(min-width: 921px)").matches;
}

function loadSidebarState() {
  const stored = localStorage.getItem(STORAGE_KEYS.sidebarOpen);
  if (stored == null) return true;
  return stored !== "false";
}

function persistSidebarState() {
  localStorage.setItem(STORAGE_KEYS.sidebarOpen, state.isSidebarOpen ? "true" : "false");
}

function applySidebarState() {
  if (!dom.chatApp || !dom.sidebar) return;

  const desktop = isDesktop();
  const desktopOpen = desktop ? state.isSidebarOpen : true;
  const mobileOpen = desktop ? false : state.isSidebarOpen;

  dom.chatApp.classList.toggle("sidebar-collapsed", desktop && !desktopOpen);
  dom.chatApp.classList.toggle("sidebar-open", mobileOpen);
  dom.sidebar.classList.toggle("open", desktop ? desktopOpen : mobileOpen);
  dom.sidebar.classList.toggle("closed", desktop ? !desktopOpen : !mobileOpen);

  if (dom.mobileSidebarToggle) {
    dom.mobileSidebarToggle.setAttribute("aria-expanded", state.isSidebarOpen ? "true" : "false");
  }

  if (dom.sidebarOverlay) {
    dom.sidebarOverlay.hidden = !mobileOpen;
    dom.sidebarOverlay.classList.toggle("is-visible", mobileOpen);
  }
}

function setSidebarOpen(nextOpen, { persist = true } = {}) {
  state.isSidebarOpen = Boolean(nextOpen);
  applySidebarState();
  if (persist) persistSidebarState();
}

function toggleSidebar() {
  setSidebarOpen(!state.isSidebarOpen);
}

function formatTime(value) {
  try {
    return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch (_e) {
    return "";
  }
}

function composeMessageForAPI(rawText, isDoubt) {
  const text = (rawText || "").trim();
  if (!isDoubt) return text;
  return `This is a user doubt. Answer directly and clearly.\n\nDoubt: ${text}`;
}

function getStarredResponses() {
  const list = [];
  state.chats.forEach((chat) => {
    chat.messages.forEach((message) => {
      if (message.role === "assistant" && message.starred) {
        list.push({ chatId: chat.id, chatTitle: chat.title, message });
      }
    });
  });
  return list.sort((a, b) => new Date(b.message.timestamp) - new Date(a.message.timestamp));
}

async function refreshToken() {
  try {
    let user = auth?.currentUser || null;
    if (!user && auth) {
      user = await new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
          const token = localStorage.getItem("token");
          console.log("Auth listener fired:", {
            firebaseUser: u,
            token
          });
          if (!u && !token) {
            console.log("🚨 Redirect from auth listener: no user AND no token");
          } else {
            console.log("Auth valid, no redirect");
          }
          unsubscribe();
          resolve(u);
        });
      });
    }

    if (!user) {
      throw new Error("No Firebase user");
    }

    const token = await user.getIdToken(true);
    state.token = token;
    state.user = {
      id: user.uid,
      name: user.displayName || "",
      email: user.email || "",
      provider: "google"
    };

    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(state.user));
    localStorage.setItem(STORAGE_KEYS.tokenTimestamp, Date.now().toString());

    return token;
  } catch (error) {
    const existing = localStorage.getItem("token");
    if (existing) {
      state.token = existing;
      return existing;
    }
    throw error;
  }
}

async function ensureValidToken() {
  if (state.token && isTokenFresh()) return state.token;

  const stored = localStorage.getItem("token");
  if (stored) {
    state.token = stored;
    if (!localStorage.getItem(STORAGE_KEYS.tokenTimestamp)) {
      localStorage.setItem(STORAGE_KEYS.tokenTimestamp, Date.now().toString());
    }
    if (isTokenFresh()) return stored;
  }

  return refreshToken();
}

function authHeaders(extraHeaders = {}) {
  const headers = Object.assign({}, extraHeaders);
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }
  return headers;
}

async function authorizedFetch(url, options = {}) {
  await ensureValidToken();

  const hasBody = options.body !== undefined;
  const headers = authHeaders(options.headers || {});
  if (hasBody && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  let response = await fetch(url, Object.assign({}, options, { headers }));
  if (response.status === 401) {
    await refreshToken();
    const retryHeaders = authHeaders(options.headers || {});
    if (hasBody && !retryHeaders["Content-Type"]) {
      retryHeaders["Content-Type"] = "application/json";
    }
    response = await fetch(url, Object.assign({}, options, { headers: retryHeaders }));
  }

  if (response.status === 401) {
    throw new Error("Authentication failed");
  }

  return response;
}

async function syncBackendSession() {
  const token = await ensureValidToken();
  if (!token) return;

  const storedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.user) || "{}");
    } catch (_error) {
      return {};
    }
  })();

  await fetch(`${API}/api/auth/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      name: storedUser.name || state.user?.name || "",
      email: storedUser.email || state.user?.email || "",
      provider: storedUser.provider || "password"
    })
  }).catch(() => {
    // Local cache stays usable if backend sync is temporarily unavailable.
  });
}

function renderHeaderState() {
  const chat = currentChat();
  if (dom.chatTitle) dom.chatTitle.textContent = chat?.title || "New Chat";
  if (dom.chatSubtitle) {
    const count = chat?.messages?.length || 0;
    dom.chatSubtitle.textContent = count ? `${count} message${count === 1 ? "" : "s"}` : "Start a conversation";
  }

  if (dom.doubtModeBtn) {
    dom.doubtModeBtn.textContent = state.doubtMode ? "Doubt: On" : "Doubt: Off";
    dom.doubtModeBtn.classList.toggle("active", state.doubtMode);
    dom.doubtModeBtn.setAttribute("aria-pressed", state.doubtMode ? "true" : "false");
  }
}

function renderChatList() {
  if (!dom.chatList) return;

  const term = state.search.trim().toLowerCase();
  const visibleChats = state.chats.filter((chat) => {
    if (!term) return true;
    const last = chat.messages.at(-1)?.text || "";
    return chat.title.toLowerCase().includes(term) || last.toLowerCase().includes(term);
  });

  if (!visibleChats.length) {
    dom.chatList.innerHTML = '<div class="chat-list-empty">No chats found.</div>';
    return;
  }

    dom.chatList.innerHTML = visibleChats
      .map((chat) => {
        const active = chat.id === state.currentChatId ? "active" : "";
        const menuOpen = state.activeChatMenuId === chat.id ? "menu-open" : "";
        const preview = chat.messages.at(-1)?.text || "No messages yet";

        if (state.editingChatId === chat.id) {
          return `
            <div class="chat-item ${active} ${menuOpen}" data-chat-id="${chat.id}">
            <div class="chat-item-main">
              <span class="chat-item-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M4 20h4l10-10-4-4L4 16v4Z"></path>
                  <path d="m12 6 4 4"></path>
                </svg>
              </span>
              <div class="chat-item-body">
                <div class="chat-item-title">Rename Chat</div>
              </div>
            </div>
            <div class="edit-actions">
                <input class="js-chat-rename-input" data-chat-id="${chat.id}" value="${escapeHtml(chat.title)}" />
                <button class="msg-act-btn js-chat-rename-save" data-chat-id="${chat.id}" type="button">Save</button>
                <button class="msg-act-btn js-chat-rename-cancel" type="button">Cancel</button>
            </div>
          </div>
        `;
      }

      const safeTitle = escapeHtml(chat.title);
      const safePreview = escapeHtml(preview.slice(0, 78));

        return `
          <div class="chat-item ${active} ${menuOpen}" data-chat-id="${chat.id}">
          <button class="chat-item-main" data-chat-id="${chat.id}" type="button" title="${safeTitle}">
            <span class="chat-item-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M7 8h10"></path>
                <path d="M7 12h7"></path>
                <path d="M7 16h6"></path>
                <path d="M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 3V7a2 2 0 0 1 2-2Z"></path>
              </svg>
            </span>
            <span class="chat-item-body">
              <span class="chat-item-title">${safeTitle}</span>
              <span class="chat-item-preview">${safePreview}</span>
            </span>
          </button>
          <div class="chat-item-menu-wrap">
            <button class="chat-item-menu-btn js-chat-menu-toggle" data-chat-id="${chat.id}" type="button" title="Chat actions" aria-label="Chat actions">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="5" r="1.5"></circle>
                <circle cx="12" cy="12" r="1.5"></circle>
                <circle cx="12" cy="19" r="1.5"></circle>
              </svg>
            </button>
              ${
                state.activeChatMenuId === chat.id
                ? `
              <div class="chat-item-menu">
                <button class="js-chat-rename" data-chat-id="${chat.id}" type="button">Rename</button>
                <button class="js-chat-delete" data-chat-id="${chat.id}" type="button">Delete</button>
              </div>
            `
                : ""
            }
          </div>
        </div>
      `;
    })
    .join("");
}

function renderMessages() {
  if (!dom.chatBox) return;

  const chat = currentChat();
  if (!chat || !chat.messages.length) {
    dom.chatBox.innerHTML = `
      <div class="empty-state">
        <h2>No messages yet</h2>
        <p>Ask anything to start a new conversation.</p>
      </div>
    `;
    renderHeaderState();
    return;
  }

  const markup = chat.messages
    .map((message) => {
      const meta = `<div class="message-meta"><span>${message.role === "user" ? "You" : "Assistant"}</span><span>${formatTime(message.timestamp)}</span>${
        message.role === "assistant" && message.isDoubt ? '<span class="doubt-tag">Doubt Response</span>' : ""
      }</div>`;

      const image = message.imageDataUrl ? `<img class="user-image" src="${message.imageDataUrl}" alt="Uploaded" />` : "";

      const textSection =
        state.editingMessageId === message.id && message.role === "user"
          ? `
            <div class="user-edit-wrap">
              <textarea class="js-user-edit-input" data-message-id="${message.id}">${escapeHtml(message.text)}</textarea>
              <div class="edit-actions">
                <button class="msg-act-btn js-edit-save" data-message-id="${message.id}" type="button">Save + Refresh</button>
                <button class="msg-act-btn js-edit-cancel" type="button">Cancel</button>
              </div>
            </div>
          `
          : `<div class="msg-text">${message.role === "assistant" ? renderMarkdown(message.text) : escapeHtml(message.text).replace(/\n/g, "<br>")}</div>`;

      const userActions =
        message.role === "user"
          ? `<div class="user-action-bar"><button class="msg-act-btn js-edit" data-message-id="${message.id}" type="button">Edit</button></div>`
          : "";

      const assistantActions =
        message.role === "assistant"
          ? `
            <div class="msg-actions">
              <button class="msg-act-btn js-copy" data-message-id="${message.id}" type="button">Copy</button>
              <button class="msg-act-btn js-star ${message.starred ? "starred" : ""}" data-message-id="${message.id}" type="button">${
                message.starred ? "Unstar" : "Star"
              }</button>
              <button class="msg-act-btn js-regenerate" data-message-id="${message.id}" type="button">Regenerate</button>
            </div>
          `
          : "";

      return `
        <article class="message ${message.role}" data-message-id="${message.id}">
          <div class="bubble">
            ${meta}
            ${image}
            ${textSection}
            ${userActions}
            ${assistantActions}
          </div>
        </article>
      `;
    })
    .join("");

  dom.chatBox.innerHTML = `<div class="messages-inner">${markup}</div>`;

  if (window.Prism && typeof window.Prism.highlightAllUnder === "function") {
    window.Prism.highlightAllUnder(dom.chatBox);
  }

  renderHeaderState();
  dom.chatBox.scrollTop = dom.chatBox.scrollHeight;
}

function renderStarredModalContent() {
  if (!dom.starredModal || !dom.starredList) return;
  if (!state.starredModalOpen) return;

  const starred = getStarredResponses();
  if (!starred.length) {
    dom.starredList.innerHTML = '<div class="starred-item"><div class="msg-text">No starred responses yet.</div></div>';
    return;
  }

  dom.starredList.innerHTML = starred
    .map((entry) => {
      return `
        <div class="starred-item">
          <div class="starred-item-head">
            <span>${escapeHtml(entry.chatTitle)}</span>
            <span>${formatTime(entry.message.timestamp)}</span>
          </div>
          <div class="msg-text">${renderMarkdown(entry.message.text)}</div>
        </div>
      `;
    })
    .join("");

  if (window.Prism && typeof window.Prism.highlightAllUnder === "function") {
    window.Prism.highlightAllUnder(dom.starredList);
  }
}

function setStarredModalOpen(nextOpen, reason = "manual") {
  if (!dom.starredModal) return;

  console.log(`[starred-modal] ${nextOpen ? "open" : "close"} (${reason})`);
  state.starredModalOpen = Boolean(nextOpen);

  if (state.modalCloseTimer) {
    clearTimeout(state.modalCloseTimer);
    state.modalCloseTimer = null;
  }

  document.body.classList.toggle("modal-open", state.starredModalOpen);

  if (state.starredModalOpen) {
    dom.starredModal.hidden = false;
    requestAnimationFrame(() => {
      dom.starredModal.classList.add("is-open");
    });
    renderStarredModalContent();
    return;
  }

  dom.starredModal.classList.remove("is-open");
  state.modalCloseTimer = setTimeout(() => {
    if (!state.starredModalOpen) {
      dom.starredModal.hidden = true;
      document.body.classList.remove("modal-open");
    }
    state.modalCloseTimer = null;
  }, 180);
}

function showSelectedImage(dataUrl) {
  if (!dom.composerImage || !dom.composerImagePreview) return;
  dom.composerImage.hidden = false;
  dom.composerImagePreview.src = dataUrl;
}

function clearSelectedImage() {
  state.selectedImageDataUrl = "";
  state.selectedImageFile = null;

  if (dom.imageInput) dom.imageInput.value = "";
  if (dom.composerImage) dom.composerImage.hidden = true;
  if (dom.composerImagePreview) dom.composerImagePreview.src = "";
}

function closeMenus() {
  if (state.activeChatMenuId) {
    state.activeChatMenuId = null;
    renderChatList();
  }
}

async function fetchHistory() {
  try {
    const response = await authorizedFetch(`${API}/api/chat/history`);
    if (!response.ok) throw new Error(`History error ${response.status}`);

    const data = await response.json();
    const cloudChats = Array.isArray(data.chats) ? data.chats.map(normalizeChat) : [];
    if (cloudChats.length) {
      state.chats = cloudChats.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else {
      state.chats = loadLocalChats();
    }
    ensureCurrentChat();
    saveLocalChats();
    renderChatList();
    renderMessages();
    renderStarredModalContent();
  } catch (error) {
    console.warn("History fetch failed:", error);
    setStatus("History unavailable");
  }
}

async function askAssistant(chat, userMessage, { replaceAssistantAt = null } = {}) {
  const payload = {
    chat_id: chat.id,
    session_id: chat.session_id,
    title: chat.title,
    message: composeMessageForAPI(userMessage.text, userMessage.isDoubt),
    source: getSourceMode(),
    memory_enabled: memoryEnabled()
  };

  const endpoint = replaceAssistantAt == null ? `${API}/api/chat/ask` : `${API}/api/chat/regenerate`;
  const body =
    replaceAssistantAt == null
      ? payload
      : {
          chat_id: chat.id,
          message: composeMessageForAPI(userMessage.text, userMessage.isDoubt),
          source: getSourceMode(),
          memory_enabled: memoryEnabled()
        };

  const response = await authorizedFetch(endpoint, {
    method: "POST",
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const assistant = {
    id: data.assistant_message?.id || makeId("msg"),
    role: "assistant",
    text: data.reply || data.assistant_message?.content || "No response received.",
    source: getSourceMode(),
    timestamp: data.assistant_message?.created_at || nowIso(),
    imageDataUrl: "",
    starred: false,
    isDoubt: Boolean(userMessage.isDoubt)
  };

  if (replaceAssistantAt == null) {
    chat.messages.push(assistant);
  } else {
    chat.messages[replaceAssistantAt] = assistant;
  }
}

async function sendMessage() {
  if (state.sending || !dom.userInput) return;

  const rawText = dom.userInput.value.trim();
  if (!rawText && !state.selectedImageDataUrl) return;

  const chat = currentChat();
  if (!chat) return;

  const displayText = rawText || "[Image attached]";
  const userMessage = {
    id: makeId("msg"),
    role: "user",
    text: displayText,
    source: getSourceMode(),
    timestamp: nowIso(),
    imageDataUrl: state.selectedImageDataUrl,
    starred: false,
    isDoubt: state.doubtMode
  };

  chat.messages.push(userMessage);
  if (chat.title === "New Chat" && rawText) {
    chat.title = buildTitleFromMessage(rawText);
  }

  dom.userInput.value = "";
  resizeComposerInput();
  clearSelectedImage();

  state.sending = true;
  if (dom.sendBtn) dom.sendBtn.disabled = true;
  setStatus(state.doubtMode ? "Resolving doubt..." : "AI is typing...");

  renderChatList();
  renderMessages();
  saveLocalChats();

  try {
    await askAssistant(chat, userMessage);
  } catch (error) {
    chat.messages.push({
      id: makeId("msg"),
      role: "assistant",
      text: `Error: ${error.message}`,
      source: getSourceMode(),
      timestamp: nowIso(),
      imageDataUrl: "",
      starred: false,
      isDoubt: userMessage.isDoubt
    });
  } finally {
    state.sending = false;
    if (dom.sendBtn) dom.sendBtn.disabled = false;
    setStatus("Online");
    renderMessages();
    saveLocalChats();
  }
}

function findLinkedUserIndexForAssistant(chat, assistantIndex) {
  for (let i = assistantIndex - 1; i >= 0; i -= 1) {
    if (chat.messages[i].role === "user") return i;
  }
  return -1;
}

async function regenerateAssistantByMessageId(messageId) {
  const chat = currentChat();
  if (!chat) return;

  const assistantIndex = chat.messages.findIndex((m) => m.id === messageId && m.role === "assistant");
  if (assistantIndex < 0) return;

  const userIndex = findLinkedUserIndexForAssistant(chat, assistantIndex);
  if (userIndex < 0) return;

  setStatus("Regenerating...");
  const userMessage = chat.messages[userIndex];

  try {
    await askAssistant(chat, userMessage, { replaceAssistantAt: assistantIndex });
  } catch (error) {
    chat.messages[assistantIndex] = {
      ...chat.messages[assistantIndex],
      text: `Regeneration failed: ${error.message}`
    };
  } finally {
    setStatus("Online");
    renderMessages();
    saveLocalChats();
  }
}

async function saveEditedMessage(messageId) {
  const chat = currentChat();
  if (!chat) return;

  const userIndex = chat.messages.findIndex((m) => m.id === messageId && m.role === "user");
  if (userIndex < 0) return;

  const input = dom.chatBox?.querySelector(`.js-user-edit-input[data-message-id=\"${messageId}\"]`);
  const newText = input?.value?.trim() || "";
  if (!newText) return;

  const original = chat.messages[userIndex];
  original.text = newText;
  original.timestamp = nowIso();

  if (userIndex === 0 || chat.title === "New Chat") {
    chat.title = buildTitleFromMessage(newText);
  }

  // Remove stale turns after edited user query and rebuild with fresh response.
  chat.messages = chat.messages.slice(0, userIndex + 1);

  const placeholderIndex = chat.messages.length;
  chat.messages.push({
    id: makeId("msg"),
    role: "assistant",
    text: "Updating response...",
    source: getSourceMode(),
    timestamp: nowIso(),
    imageDataUrl: "",
    starred: false,
    isDoubt: Boolean(original.isDoubt)
  });

  state.editingMessageId = null;
  state.sending = true;
  if (dom.sendBtn) dom.sendBtn.disabled = true;
  setStatus("Refreshing response...");
  renderChatList();
  renderMessages();
  saveLocalChats();

  try {
    await askAssistant(chat, original, { replaceAssistantAt: placeholderIndex });
  } catch (error) {
    chat.messages[placeholderIndex] = {
      ...chat.messages[placeholderIndex],
      text: `Update failed: ${error.message}`
    };
  } finally {
    state.sending = false;
    if (dom.sendBtn) dom.sendBtn.disabled = false;
    setStatus("Online");
    renderMessages();
    saveLocalChats();
  }
}

function toggleStar(messageId) {
  const chat = currentChat();
  if (!chat) return;

  const msg = chat.messages.find((m) => m.id === messageId && m.role === "assistant");
  if (!msg) return;

  msg.starred = !msg.starred;
  saveLocalChats();
  renderMessages();
  renderStarredModalContent();
}

function bindEvents() {
  dom.chatSearch?.addEventListener("input", (event) => {
    state.search = event.target.value || "";
    renderChatList();
  });

  dom.sendBtn?.addEventListener("click", () => {
    sendMessage().catch((error) => {
      console.error(error);
      setStatus("Send failed");
    });
  });

  dom.userInput?.addEventListener("input", () => {
    resizeComposerInput();
  });

  dom.userInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage().catch((error) => {
        console.error(error);
        setStatus("Send failed");
      });
    }
  });

  dom.newChatBtn?.addEventListener("click", () => {
    const chat = createChat();
    state.chats.unshift(chat);
    state.currentChatId = chat.id;
    state.activeChatMenuId = null;
    state.editingChatId = null;
    saveLocalChats();
    renderChatList();
    renderMessages();
  });

  dom.settingsLink?.addEventListener("click", () => {
    console.log("Settings navigation clicked from:", "frontend/js/chat.js", "Token:", localStorage.getItem("token") ? "present" : "missing");
  });

  dom.logoutBtn?.addEventListener("click", async () => {
    try {
      await auth?.signOut?.();
    } catch (_error) {
      // ignore and continue local logout.
    }
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.user);
    localStorage.removeItem(STORAGE_KEYS.authProvider);
    localStorage.removeItem(STORAGE_KEYS.tokenTimestamp);
    console.log("🚨 Redirect triggered from:", "frontend/js/chat.js", "Reason:", "explicit logout");
    window.location.href = "index.html";
  });

  dom.doubtModeBtn?.addEventListener("click", () => {
    state.doubtMode = !state.doubtMode;
    renderHeaderState();
  });

  dom.starredBtn?.addEventListener("click", () => {
    setStarredModalOpen(true, "starred button");
  });

  dom.closeStarredBtn?.addEventListener("click", () => {
    setStarredModalOpen(false, "close button");
  });

  dom.starredModal?.addEventListener("click", (event) => {
    if (event.target === dom.starredModal) {
      setStarredModalOpen(false, "backdrop click");
    }
  });

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    const tagName = target?.tagName || "";
    const isTypingTarget =
      tagName === "INPUT" ||
      tagName === "TEXTAREA" ||
      target?.isContentEditable;

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b" && !isTypingTarget) {
      event.preventDefault();
      toggleSidebar();
      return;
    }

    if (event.key === "Escape" && state.starredModalOpen) {
      setStarredModalOpen(false, "escape key");
    }
  });

  dom.imageBtn?.addEventListener("click", () => dom.imageInput?.click());

  dom.imageInput?.addEventListener("change", () => {
    const file = dom.imageInput.files?.[0];
    if (!file) return;

    state.selectedImageFile = file;
    const reader = new FileReader();
    reader.onload = () => {
      state.selectedImageDataUrl = String(reader.result || "");
      if (state.selectedImageDataUrl) {
        showSelectedImage(state.selectedImageDataUrl);
      }
    };
    reader.readAsDataURL(file);
  });

  dom.removeImageBtn?.addEventListener("click", clearSelectedImage);

  dom.micBtn?.addEventListener("click", () => {
    startVoiceRecognition();
  });

  dom.mobileSidebarToggle?.addEventListener("click", () => {
    toggleSidebar();
  });

  dom.sidebarOverlay?.addEventListener("click", () => {
    if (!isDesktop()) {
      setSidebarOpen(false);
    }
  });

  dom.chatList?.addEventListener("click", (event) => {
    const target = event.target;

    const openBtn = target.closest(".chat-item-main");
    if (openBtn?.dataset.chatId) {
      const chatId = openBtn.dataset.chatId;
      if (state.currentChatId !== chatId) {
        state.currentChatId = chatId;
        state.activeChatMenuId = null;
        state.editingChatId = null;
        saveLocalChats();
        renderChatList();
        renderMessages();
      }
      if (!isDesktop()) setSidebarOpen(false);
      return;
    }

    const menuToggle = target.closest(".js-chat-menu-toggle");
    if (menuToggle?.dataset.chatId) {
      const chatId = menuToggle.dataset.chatId;
      state.activeChatMenuId = state.activeChatMenuId === chatId ? null : chatId;
      renderChatList();
      return;
    }

    const renameBtn = target.closest(".js-chat-rename");
    if (renameBtn?.dataset.chatId) {
      state.editingChatId = renameBtn.dataset.chatId;
      state.activeChatMenuId = null;
      renderChatList();
      return;
    }

    const renameSave = target.closest(".js-chat-rename-save");
    if (renameSave?.dataset.chatId) {
      const chatId = renameSave.dataset.chatId;
      const chat = state.chats.find((item) => item.id === chatId);
      if (!chat) return;

      const input = dom.chatList.querySelector(`.js-chat-rename-input[data-chat-id=\"${chatId}\"]`);
      const title = input?.value?.trim() || "New Chat";
      chat.title = title;
      state.editingChatId = null;
      saveLocalChats();
      renderChatList();
      renderHeaderState();

      authorizedFetch(`${API}/api/chat/${chatId}`, {
        method: "PATCH",
        body: JSON.stringify({ title })
      }).catch((error) => console.warn("Rename sync failed:", error));
      return;
    }

    const renameCancel = target.closest(".js-chat-rename-cancel");
    if (renameCancel) {
      state.editingChatId = null;
      renderChatList();
      return;
    }

    const deleteBtn = target.closest(".js-chat-delete");
    if (deleteBtn?.dataset.chatId) {
      const chatId = deleteBtn.dataset.chatId;
      state.chats = state.chats.filter((item) => item.id !== chatId);
      if (!state.chats.length) {
        const fresh = createChat();
        state.chats.unshift(fresh);
      }
      ensureCurrentChat();
      state.activeChatMenuId = null;
      saveLocalChats();
      renderChatList();
      renderMessages();

      authorizedFetch(`${API}/api/chat/${chatId}`, { method: "DELETE" }).catch((error) =>
        console.warn("Delete sync failed:", error)
      );
    }
  });

  dom.chatBox?.addEventListener("click", (event) => {
    const target = event.target;

    const copyBtn = target.closest(".js-copy");
    if (copyBtn?.dataset.messageId) {
      const chat = currentChat();
      if (!chat) return;
      const msg = chat.messages.find((item) => item.id === copyBtn.dataset.messageId);
      if (!msg) return;
      navigator.clipboard?.writeText(msg.text || "").catch(() => {});
      return;
    }

    const starBtn = target.closest(".js-star");
    if (starBtn?.dataset.messageId) {
      toggleStar(starBtn.dataset.messageId);
      return;
    }

    const editBtn = target.closest(".js-edit");
    if (editBtn?.dataset.messageId) {
      state.editingMessageId = editBtn.dataset.messageId;
      renderMessages();
      return;
    }

    const editCancel = target.closest(".js-edit-cancel");
    if (editCancel) {
      state.editingMessageId = null;
      renderMessages();
      return;
    }

    const editSave = target.closest(".js-edit-save");
    if (editSave?.dataset.messageId) {
      saveEditedMessage(editSave.dataset.messageId).catch((error) => {
        console.error(error);
        setStatus("Update failed");
      });
      return;
    }

    const regenerateBtn = target.closest(".js-regenerate");
    if (regenerateBtn?.dataset.messageId) {
      regenerateAssistantByMessageId(regenerateBtn.dataset.messageId).catch((error) => {
        console.error(error);
        setStatus("Regenerate failed");
      });
    }
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".chat-item-menu-wrap") && !event.target.closest(".js-chat-menu-toggle")) {
      closeMenus();
    }
  });

  window.addEventListener("resize", () => {
    const desktop = isDesktop();
    if (desktop) {
      dom.sidebarOverlay?.classList.remove("is-visible");
      if (dom.sidebarOverlay) dom.sidebarOverlay.hidden = true;
      applySidebarState();
      return;
    }
    applySidebarState();
  });
}

async function bootstrap() {
  state.chats = loadLocalChats();
  ensureCurrentChat();
  state.isSidebarOpen = loadSidebarState();

  const storedToken = localStorage.getItem("token");
  if (storedToken) {
    state.token = storedToken;
  }

  renderHeaderState();
  renderChatList();
  renderMessages();
  applySidebarState();
  setStarredModalOpen(false, "bootstrap");
  initializeVoiceInput();
  bindEvents();
  resizeComposerInput();

  try {
    await syncBackendSession();
    await fetchHistory();
  } catch (_error) {
    // local cache remains usable.
  }
}

bootstrap().catch((error) => {
  console.error("Chat bootstrap failed:", error);
  setStatus("Initialization error");
});
