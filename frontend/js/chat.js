/*frontend/js/chat.js*/
import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const API = "http://127.0.0.1:8000";

const STORAGE_KEYS = {
  chats: "hybrid_chats",
  currentChatId: "hybrid_current_chat",
  platformMode: "platform_mode",
  memoryEnabled: "memory_enabled"
};

const state = {
  chats: [],
  currentChatId: null,
  search: "",
  sending: false,
  activeChatMenuId: null,
  editingChatId: null,
  editingMessageId: null,
  activeDoubtMessageId: null,
  selectedImageFile: null,
  selectedImageDataUrl: ""
};

const dom = {
  chatApp: document.getElementById("chatApp"),
  chatTitle: document.getElementById("chatTitle"),
  chatSubtitle: document.getElementById("chatSubtitle"),
  chatSearch: document.getElementById("chatSearch"),
  chatList: document.getElementById("chatList"),
  chatBox: document.getElementById("chatBox"),
  userInput: document.getElementById("userInput"),
  sendBtn: document.getElementById("sendBtn"),
  newChatBtn: document.getElementById("newChatBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  mobileSidebarToggle: document.getElementById("mobileSidebarToggle"),
  aiStatus: document.getElementById("aiStatus"),
  imageInput: document.getElementById("imageInput"),
  imageBtn: document.getElementById("imageBtn"),
  composerImage: document.getElementById("composerImage"),
  composerImagePreview: document.getElementById("composerImagePreview"),
  removeImageBtn: document.getElementById("removeImageBtn"),
  micBtn: document.getElementById("micBtn")
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

  if (user) {
    const token = await user.getIdToken();
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify({
      id: user.uid,
      name: user.displayName || "",
      email: user.email || "",
      provider: "google"
    }));
    return token;
  }

  const storedToken = localStorage.getItem("token");
  if (storedToken) return storedToken;

  window.location.href = "index.html";
  throw new Error("Authentication required");
}

async function authorizedFetch(url, options = {}) {
  await ensureToken();
  const headers = { ...(options.headers || {}), ...authHeaders() };
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "index.html";
  }
  return response;
}

function getSourceMode() { return localStorage.getItem(STORAGE_KEYS.platformMode) === "app" ? "app" : "web"; }
function memoryEnabled() { return localStorage.getItem(STORAGE_KEYS.memoryEnabled) !== "false"; }
function makeId(prefix) { return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`; }
function nowIso() { return new Date().toISOString(); }

function escapeHtml(value = "") {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
}

function loadLocalChats() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.chats) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalChats() {
  localStorage.setItem(STORAGE_KEYS.chats, JSON.stringify(state.chats));
  if (state.currentChatId) localStorage.setItem(STORAGE_KEYS.currentChatId, state.currentChatId);
}

function normalizeReply(reply) {
  return {
    id: reply.id || makeId("reply"),
    userText: reply.userText || "",
    botText: reply.botText || "",
    createdAt: reply.createdAt || nowIso()
  };
}

function normalizeMessage(message) {
  return {
    id: message.id || makeId("msg"),
    role: message.role === "user" ? "user" : "assistant",
    text: message.content || message.text || "",
    source: message.source || getSourceMode(),
    timestamp: message.timestamp || message.createdAt || nowIso(),
    imageDataUrl: message.imageDataUrl || "",
    starred: Boolean(message.starred),
    replies: Array.isArray(message.replies) ? message.replies.map(normalizeReply) : []
  };
}

function normalizeChat(chat) {
  const messages = Array.isArray(chat.messages) ? chat.messages.map(normalizeMessage) : [];
  return {
    id: chat.id || makeId("chat"),
    session_id: chat.session_id || chat.sessionId || chat.id || makeId("session"),
    title: (chat.title || "New Chat").trim() || "New Chat",
    created_at: chat.created_at || chat.createdAt || nowIso(),
    messages
  };
}

function mergeChats(localChats, cloudChats) {
  const index = new Map();
  [...localChats, ...cloudChats].forEach((rawChat) => {
    const chat = normalizeChat(rawChat);
    const existing = index.get(chat.id);
    if (!existing) {
      index.set(chat.id, chat);
      return;
    }

    const dedupe = new Map();
    [...existing.messages, ...chat.messages].forEach((msg) => {
      const key = msg.id || `${msg.role}|${msg.text}|${msg.timestamp}`;
      dedupe.set(key, normalizeMessage(msg));
    });

    existing.messages = [...dedupe.values()].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    existing.title = existing.title === "New Chat" && chat.title !== "New Chat" ? chat.title : existing.title;
  });

  return [...index.values()].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function currentChat() {
  return state.chats.find((chat) => chat.id === state.currentChatId) || null;
}

function findMessage(messageId) {
  return currentChat()?.messages.find((message) => message.id === messageId) || null;
}

function ensureCurrentChat() {
  if (!state.chats.length) {
    const chat = { id: makeId("chat"), session_id: makeId("session"), title: "New Chat", created_at: nowIso(), messages: [] };
    state.chats.push(chat);
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

function formatTs(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function renderChatList() {
  const term = state.search.trim().toLowerCase();
  const visible = state.chats.filter((chat) => {
    if (!term) return true;
    const last = chat.messages[chat.messages.length - 1]?.text || "";
    return chat.title.toLowerCase().includes(term) || last.toLowerCase().includes(term);
  });

  if (!visible.length) {
    dom.chatList.innerHTML = '<div class="chat-item-preview">No chats found.</div>';
    return;
  }

  dom.chatList.innerHTML = visible.map((chat) => {
    const active = chat.id === state.currentChatId ? "active" : "";
    const preview = chat.messages[chat.messages.length - 1]?.text || "No messages yet";

    if (state.editingChatId === chat.id) {
      return `
        <div class="chat-item ${active}" data-chat-id="${chat.id}">
          <div class="rename-mode-wrap">
            <div class="chat-rename-wrap">
              <input class="js-chat-rename-input" data-chat-id="${chat.id}" value="${escapeHtml(chat.title)}" />
              <button class="js-chat-rename-save" data-chat-id="${chat.id}" type="button">Save</button>
              <button class="js-chat-rename-cancel" data-chat-id="${chat.id}" type="button">Cancel</button>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="chat-item ${active}" data-chat-id="${chat.id}">
        <button class="chat-item-main" data-chat-id="${chat.id}" type="button">
          <div class="chat-item-title">${escapeHtml(chat.title)}</div>
          <div class="chat-item-preview">${escapeHtml(preview.slice(0, 80))}</div>
        </button>
        <div class="chat-item-menu-wrap">
          <button class="chat-item-menu-btn js-chat-menu-toggle" data-chat-id="${chat.id}" type="button">...</button>
          ${state.activeChatMenuId === chat.id ? `
            <div class="chat-item-menu">
              <button class="js-chat-rename" data-chat-id="${chat.id}" type="button">Rename</button>
              <button class="js-chat-delete" data-chat-id="${chat.id}" type="button">Delete</button>
            </div>
          ` : ""}
        </div>
      </div>
    `;
  }).join("");
}

function renderReplies(message) {
  if (!message.replies?.length) return "";

  return `
    <div class="doubt-thread">
      ${message.replies.map((reply) => `
        <div class="reply-item user-reply"><div class="reply-label">You</div><div>${escapeHtml(reply.userText).replace(/\n/g, "<br>")}</div></div>
        <div class="reply-item"><div class="reply-label">AI</div><div>${escapeHtml(reply.botText).replace(/\n/g, "<br>")}</div></div>
      `).join("")}
    </div>
  `;
}

function renderMessages() {
  const chat = currentChat();
  if (!chat || !chat.messages.length) {
    dom.chatBox.innerHTML = '<div class="empty-state"><h2>No messages yet</h2><p>Start a new chat to begin.</p></div>';
    return;
  }

  dom.chatBox.innerHTML = chat.messages.map((message) => {
    const assistantActions = message.role === "assistant" ? `
      <div class="msg-actions">
        <button class="msg-act-btn js-copy" data-message-id="${message.id}" type="button">Copy</button>
        <button class="msg-act-btn js-star ${message.starred ? "starred" : ""}" data-message-id="${message.id}" type="button">Star</button>
        <button class="msg-act-btn js-doubt" data-message-id="${message.id}" type="button">Doubt</button>
        <button class="msg-act-btn js-regenerate" data-message-id="${message.id}" type="button">Regenerate</button>
      </div>
    ` : "";

    const userActions = message.role === "user" ? `
      <div class="user-action-bar">
        <button class="msg-act-btn js-edit" data-message-id="${message.id}" type="button">Edit</button>
      </div>
    ` : "";

    const imageMarkup = message.imageDataUrl ? `<img class="user-image" src="${message.imageDataUrl}" alt="User upload" />` : "";

    const textMarkup = state.editingMessageId === message.id && message.role === "user"
      ? `
        <div class="user-edit-wrap">
          <textarea class="js-user-edit-input" data-message-id="${message.id}">${escapeHtml(message.text)}</textarea>
          <div class="user-edit-actions">
            <button class="js-user-edit-save" data-message-id="${message.id}" type="button">Save</button>
            <button class="js-user-edit-cancel" type="button">Cancel</button>
          </div>
        </div>
      `
      : `<div class="message-text">${message.role === "assistant" ? marked.parse(message.text || "") : escapeHtml(message.text || "").replace(/\n/g, "<br>")}</div>`;

    const doubtComposer = state.activeDoubtMessageId === message.id && message.role === "assistant"
      ? `
        <div class="doubt-input-wrap">
          <textarea class="js-doubt-input" data-message-id="${message.id}" placeholder="Ask a follow-up doubt"></textarea>
          <button class="js-doubt-send" data-message-id="${message.id}" type="button">Send</button>
          <button class="js-doubt-cancel" type="button">Cancel</button>
        </div>
      `
      : "";

    return `
      <div class="message-row ${message.role}" data-message-id="${message.id}">
        <article class="message-bubble">
          ${assistantActions}
          ${userActions}
          ${imageMarkup}
          ${textMarkup}
          ${renderReplies(message)}
          ${doubtComposer}
          <div class="message-meta">${formatTs(message.timestamp)} | ${message.source}</div>
        </article>
      </div>
    `;
  }).join("");

  dom.chatBox.querySelectorAll("pre > code").forEach((code) => {
    const codeId = makeId("code");
    code.id = codeId;
    const pre = code.parentElement;
    const wrapper = document.createElement("div");
    wrapper.className = "code-block";
    wrapper.innerHTML = `<div class="code-head"><span>code</span><button class="code-copy-btn js-copy-code" data-code-id="${codeId}">Copy</button></div>`;
    wrapper.appendChild(pre.cloneNode(true));
    pre.replaceWith(wrapper);
  });

  if (window.Prism?.highlightAllUnder) window.Prism.highlightAllUnder(dom.chatBox);
  dom.chatBox.scrollTo({ top: dom.chatBox.scrollHeight, behavior: "smooth" });
}

function renderHeader() {
  const chat = currentChat();
  dom.chatTitle.textContent = chat?.title || "New Chat";
  dom.chatSubtitle.textContent = memoryEnabled() ? "Memory enabled across chats" : "Memory is disabled";
}

function render() {
  renderHeader();
  renderChatList();
  renderMessages();
  autoResizeComposer();
}

function setStatus(status, label) {
  dom.aiStatus.dataset.state = status;
  const text = dom.aiStatus.querySelector(".status-text");
  if (text) text.textContent = label;
}

function autoResizeComposer() {
  dom.userInput.style.height = "auto";
  dom.userInput.style.height = `${Math.min(dom.userInput.scrollHeight, 180)}px`;
}

async function fetchCloudHistory() {
  if (getSourceMode() !== "web") return [];
  const response = await authorizedFetch(`${API}/api/chat/history`);
  if (!response.ok) throw new Error("Unable to fetch cloud history");
  const { chats } = await response.json();

  const hydrated = [];
  for (const chat of chats || []) {
    const msgRes = await authorizedFetch(`${API}/api/chat/${chat.id}/messages`);
    const data = msgRes.ok ? await msgRes.json() : { messages: [] };
    hydrated.push({ ...chat, messages: data.messages || [] });
  }
  return hydrated;
}

async function bootData() {
  state.chats = loadLocalChats().map(normalizeChat);
  if (getSourceMode() === "web") {
    try {
      const cloud = await fetchCloudHistory();
      state.chats = mergeChats(state.chats, cloud);
      saveLocalChats();
    } catch {
      // keep local fallback
    }
  }
  ensureCurrentChat();
  render();
}

function addMessage(chatId, message) {
  const chat = state.chats.find((item) => item.id === chatId);
  if (!chat) return null;

  const normalized = normalizeMessage(message);
  chat.messages.push(normalized);
  if (chat.title === "New Chat" && normalized.role === "user") chat.title = normalized.text.slice(0, 48) || "New Chat";
  saveLocalChats();
  return normalized;
}

function clearComposerImage() {
  state.selectedImageFile = null;
  state.selectedImageDataUrl = "";
  dom.imageInput.value = "";
  dom.composerImagePreview.src = "";
  dom.composerImage.hidden = true;
}

async function onImageSelected() {
  const file = dom.imageInput.files[0];
  if (!file) return;

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(String(event.target?.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  state.selectedImageFile = file;
  state.selectedImageDataUrl = dataUrl;
  dom.composerImagePreview.src = dataUrl;
  dom.composerImage.hidden = false;
}

async function askFallback({ chatId, messageText }) {
  const response = await authorizedFetch(`${API}/api/chat/ask`, {
    method: "POST",
    body: JSON.stringify({
      chat_id: chatId,
      session_id: chatId,
      title: currentChat()?.title || "New Chat",
      message: messageText,
      source: getSourceMode(),
      memory_enabled: memoryEnabled()
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || "Unable to send message");
  return data.reply || "";
}

async function streamReply({ chatId, messageText }) {
  const payload = {
    chat_id: chatId,
    session_id: chatId,
    title: currentChat()?.title || "New Chat",
    message: messageText,
    source: getSourceMode(),
    memory_enabled: memoryEnabled()
  };

  const response = await authorizedFetch(`${API}/api/chat/stream`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  if (!response.ok || !response.body) {
    const fallback = await askFallback({ chatId, messageText });
    addMessage(chatId, { role: "assistant", text: fallback, source: getSourceMode(), timestamp: nowIso() });
    return;
  }

  const assistantMessage = addMessage(chatId, { role: "assistant", text: "", source: getSourceMode(), timestamp: nowIso() });
  renderMessages();

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      if (rawEvent.startsWith("data: ")) {
        const payloadText = rawEvent.slice(6).trim();
        if (payloadText !== "[DONE]") {
          try {
            const data = JSON.parse(payloadText);
            if (data.type === "chunk" && assistantMessage) {
              assistantMessage.text += data.content;
              saveLocalChats();
              renderMessages();
            }
          } catch {
            // ignore malformed chunk
          }
        }
      }
      boundary = buffer.indexOf("\n\n");
    }
  }
}

async function sendMessage() {
  const text = dom.userInput.value.trim();
  const hasImage = Boolean(state.selectedImageFile);
  if ((!text && !hasImage) || state.sending) return;

  let chat = currentChat();
  if (!chat) {
    createNewChat();
    chat = currentChat();
  }
  if (!chat) return;

  state.sending = true;
  setStatus("processing", "Processing");
  dom.sendBtn.disabled = true;

  const userText = text || "Analyze this image";
  addMessage(chat.id, {
    role: "user",
    text: userText,
    source: getSourceMode(),
    timestamp: nowIso(),
    imageDataUrl: state.selectedImageDataUrl
  });

  dom.userInput.value = "";
  clearComposerImage();
  render();

  try {
    if (getSourceMode() === "app" && !navigator.onLine) {
      addMessage(chat.id, {
        role: "assistant",
        text: "Offline mode: message stored locally. Use Sync Data in settings once online.",
        source: "app",
        timestamp: nowIso()
      });
    } else {
      await streamReply({ chatId: chat.id, messageText: userText });
    }
  } catch (error) {
    addMessage(chat.id, { role: "assistant", text: `Error: ${error.message}`, source: getSourceMode(), timestamp: nowIso() });
  } finally {
    state.sending = false;
    dom.sendBtn.disabled = false;
    setStatus("online", "Online");
    render();
    dom.userInput.focus();
  }
}

async function regenerate(messageId) {
  const chat = currentChat();
  if (!chat) return;

  const index = chat.messages.findIndex((msg) => msg.id === messageId && msg.role === "assistant");
  if (index < 1) return;

  const previousUser = [...chat.messages.slice(0, index)].reverse().find((msg) => msg.role === "user");
  if (!previousUser) return;

  const response = await authorizedFetch(`${API}/api/chat/regenerate`, {
    method: "POST",
    body: JSON.stringify({
      chat_id: chat.id,
      message: previousUser.text,
      source: getSourceMode(),
      memory_enabled: memoryEnabled()
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || "Regeneration failed");

  chat.messages[index].text = data.reply || "";
  chat.messages[index].timestamp = data.assistant_message?.timestamp || nowIso();
  saveLocalChats();
  renderMessages();
}

function createNewChat() {
  const chat = { id: makeId("chat"), session_id: makeId("session"), title: "New Chat", created_at: nowIso(), messages: [] };
  state.chats.unshift(chat);
  state.currentChatId = chat.id;
  state.activeChatMenuId = null;
  state.editingChatId = null;
  saveLocalChats();
  render();
}

async function renameChat(chatId, newTitle) {
  const response = await authorizedFetch(`${API}/api/chat/${chatId}`, {
    method: "PATCH",
    body: JSON.stringify({ title: newTitle })
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || "Unable to rename chat");
  }
}

function deleteChat(chatId) {
  const index = state.chats.findIndex((chat) => chat.id === chatId);
  if (index === -1) return;
  state.chats.splice(index, 1);

  if (!state.chats.length) {
    createNewChat();
    return;
  }

  if (state.currentChatId === chatId) state.currentChatId = state.chats[Math.max(index - 1, 0)].id;
  saveLocalChats();
  render();
}

function toggleSidebar() {
  if (window.innerWidth <= 960) {
    dom.chatApp.classList.toggle("mobile-sidebar-open");
    return;
  }
  dom.chatApp.classList.toggle("sidebar-collapsed");
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "index.html";
}

async function voiceInput() {
  if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
    alert("Voice input is not supported in your browser");
    return;
  }

  const Speech = window.webkitSpeechRecognition || window.SpeechRecognition;
  const recognition = new Speech();
  recognition.lang = "en-US";
  recognition.onresult = (event) => {
    dom.userInput.value = event.results[0][0].transcript;
    autoResizeComposer();
  };
  recognition.start();
}

async function saveEditedMessage(messageId) {
  const chat = currentChat();
  if (!chat) return;

  const index = chat.messages.findIndex((message) => message.id === messageId && message.role === "user");
  if (index === -1) return;

  const input = dom.chatBox.querySelector(`.js-user-edit-input[data-message-id="${messageId}"]`);
  const nextText = input?.value.trim() || "";
  if (!nextText) return;

  chat.messages[index].text = nextText;
  chat.messages = chat.messages.slice(0, index + 1);
  state.editingMessageId = null;

  const response = await authorizedFetch(`${API}/api/chat/regenerate`, {
    method: "POST",
    body: JSON.stringify({
      chat_id: chat.id,
      message: nextText,
      source: getSourceMode(),
      memory_enabled: memoryEnabled()
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || "Unable to regenerate");

  chat.messages.push(normalizeMessage({
    role: "assistant",
    text: data.reply || "",
    source: getSourceMode(),
    timestamp: data.assistant_message?.timestamp || nowIso()
  }));

  saveLocalChats();
  render();
}

async function sendDoubt(messageId) {
  const parent = findMessage(messageId);
  const input = dom.chatBox.querySelector(`.js-doubt-input[data-message-id="${messageId}"]`);
  const doubtText = input?.value.trim() || "";
  if (!parent || !doubtText) return;

  const chat = currentChat();
  const response = await authorizedFetch(`${API}/api/chat/ask`, {
    method: "POST",
    body: JSON.stringify({
      chat_id: chat.id,
      session_id: chat.id,
      title: chat.title,
      message: `Regarding this response:\n${parent.text}\n\nFollow-up doubt:\n${doubtText}`,
      source: getSourceMode(),
      memory_enabled: memoryEnabled()
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || "Unable to send doubt");

  parent.replies.push(normalizeReply({ userText: doubtText, botText: data.reply || "" }));
  state.activeDoubtMessageId = null;
  saveLocalChats();
  renderMessages();
}

function bindEvents() {
  dom.sendBtn.addEventListener("click", sendMessage);
  dom.newChatBtn.addEventListener("click", createNewChat);
  dom.logoutBtn.addEventListener("click", logout);
  dom.mobileSidebarToggle.addEventListener("click", toggleSidebar);

  dom.imageBtn.addEventListener("click", () => dom.imageInput.click());
  dom.imageInput.addEventListener("change", onImageSelected);
  dom.removeImageBtn.addEventListener("click", clearComposerImage);
  dom.micBtn.addEventListener("click", voiceInput);

  dom.userInput.addEventListener("input", autoResizeComposer);
  dom.userInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  dom.chatSearch.addEventListener("input", (event) => {
    state.search = event.target.value || "";
    renderChatList();
  });

  dom.chatList.addEventListener("click", async (event) => {
    const menuToggle = event.target.closest(".js-chat-menu-toggle");
    if (menuToggle) {
      event.stopPropagation();
      const chatId = menuToggle.dataset.chatId;
      state.activeChatMenuId = state.activeChatMenuId === chatId ? null : chatId;
      renderChatList();
      return;
    }

    const rename = event.target.closest(".js-chat-rename");
    if (rename) {
      event.stopPropagation();
      state.editingChatId = rename.dataset.chatId;
      state.activeChatMenuId = null;
      renderChatList();
      return;
    }

    const remove = event.target.closest(".js-chat-delete");
    if (remove) {
      event.stopPropagation();
      if (!confirm("Delete this chat?")) return;
      deleteChat(remove.dataset.chatId);
      return;
    }

    const renameSave = event.target.closest(".js-chat-rename-save");
    if (renameSave) {
      event.stopPropagation();
      const chatId = renameSave.dataset.chatId;
      const input = dom.chatList.querySelector(`.js-chat-rename-input[data-chat-id="${chatId}"]`);
      const chat = state.chats.find((item) => item.id === chatId);
      const newTitle = (input?.value || "").trim() || "New Chat";
      if (chat) {
        const previousTitle = chat.title;
        chat.title = newTitle;
        try {
          await renameChat(chatId, newTitle);
        } catch (error) {
          chat.title = previousTitle;
          alert(error.message);
        }
      }
      state.editingChatId = null;
      saveLocalChats();
      render();
      return;
    }

    if (event.target.closest(".js-chat-rename-cancel")) {
      state.editingChatId = null;
      renderChatList();
      return;
    }

    const main = event.target.closest(".chat-item-main");
    if (main) {
      state.currentChatId = main.dataset.chatId;
      state.activeChatMenuId = null;
      state.editingChatId = null;
      saveLocalChats();
      render();
      if (window.innerWidth <= 960) dom.chatApp.classList.remove("mobile-sidebar-open");
    }
  });

  dom.chatBox.addEventListener("click", async (event) => {
    const copyBtn = event.target.closest(".js-copy");
    if (copyBtn) {
      const msg = findMessage(copyBtn.dataset.messageId);
      if (!msg) return;
      await navigator.clipboard.writeText(msg.text || "");
      copyBtn.textContent = "Copied";
      setTimeout(() => { copyBtn.textContent = "Copy"; }, 900);
      return;
    }

    const starBtn = event.target.closest(".js-star");
    if (starBtn) {
      const msg = findMessage(starBtn.dataset.messageId);
      if (!msg) return;
      msg.starred = !msg.starred;
      saveLocalChats();
      renderMessages();
      return;
    }

    const doubtBtn = event.target.closest(".js-doubt");
    if (doubtBtn) {
      state.activeDoubtMessageId = doubtBtn.dataset.messageId;
      renderMessages();
      return;
    }

    if (event.target.closest(".js-doubt-cancel")) {
      state.activeDoubtMessageId = null;
      renderMessages();
      return;
    }

    const doubtSend = event.target.closest(".js-doubt-send");
    if (doubtSend) {
      doubtSend.disabled = true;
      try {
        await sendDoubt(doubtSend.dataset.messageId);
      } catch (error) {
        alert(error.message);
      } finally {
        doubtSend.disabled = false;
      }
      return;
    }

    const regenBtn = event.target.closest(".js-regenerate");
    if (regenBtn) {
      regenBtn.disabled = true;
      try {
        await regenerate(regenBtn.dataset.messageId);
      } catch (error) {
        alert(error.message);
      } finally {
        regenBtn.disabled = false;
      }
      return;
    }

    const editBtn = event.target.closest(".js-edit");
    if (editBtn) {
      state.editingMessageId = editBtn.dataset.messageId;
      renderMessages();
      return;
    }

    if (event.target.closest(".js-user-edit-cancel")) {
      state.editingMessageId = null;
      renderMessages();
      return;
    }

    const editSave = event.target.closest(".js-user-edit-save");
    if (editSave) {
      editSave.disabled = true;
      try {
        await saveEditedMessage(editSave.dataset.messageId);
      } catch (error) {
        alert(error.message);
      } finally {
        editSave.disabled = false;
      }
      return;
    }

    const copyCodeBtn = event.target.closest(".js-copy-code");
    if (copyCodeBtn) {
      const code = dom.chatBox.querySelector(`#${copyCodeBtn.dataset.codeId}`);
      if (!code) return;
      await navigator.clipboard.writeText(code.textContent || "");
      copyCodeBtn.textContent = "Copied";
      setTimeout(() => { copyCodeBtn.textContent = "Copy"; }, 900);
    }
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".chat-item-menu-wrap")) {
      if (state.activeChatMenuId) {
        state.activeChatMenuId = null;
        renderChatList();
      }
    }
  });
}

async function init() {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "index.html";
    return;
  }

  await ensureToken();
  marked.setOptions({ breaks: true, gfm: true });
  bindEvents();
  await bootData();
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch(() => {
    window.location.href = "index.html";
  });
});
