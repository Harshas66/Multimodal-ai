/* ================= CHATGPT-STYLE FINAL BUILD =================
✔ Full responses (never cut)
✔ Markdown → formatted HTML
✔ Clean paragraph spacing
✔ Image thumbnail preview (small)
✔ Enter key works
✔ Mic button works
✔ Voice mode unchanged
✔ Deploy ready
=============================================================== */

function getUserId() {
  let uid = localStorage.getItem("multimodal_ai_user_id");
  if (!uid) {
    uid = "user_" + crypto.randomUUID();
    localStorage.setItem("multimodal_ai_user_id", uid);
  }
  return uid;
}
const USER_ID = getUserId();

document.addEventListener("DOMContentLoaded", () => {
  const API = "http://127.0.0.1:8000";

  /* ---------- ELEMENTS ---------- */
  const chatBox = document.getElementById("chatBox");
  const chatList = document.getElementById("chatList");
  const userInput = document.getElementById("userInput");
  const sendBtn = document.getElementById("sendBtn");
  const newChatBtn = document.getElementById("newChat");
  const micBtn = document.getElementById("micBtn");
  const voiceModeBtn = document.getElementById("voiceModeBtn");
  const voiceOverlay = document.getElementById("voiceOverlay");
  const voiceStatus = document.getElementById("voiceStatus");
  const exitVoiceMode = document.getElementById("exitVoiceMode");
  const stopBtn = document.getElementById("stopBtn");
  const plusBtn = document.getElementById("plusBtn");
  const optionsMenu = document.getElementById("optionsMenu");
  const imageInput = document.getElementById("imageInput");
  const preview = document.getElementById("preview");
  const previewImg = document.getElementById("previewImg");
  const cancelPreview = document.getElementById("cancelPreview");

  /* ---------- STATE ---------- */
  let chats = JSON.parse(localStorage.getItem("chats") || "[]");
  let currentChatId = null;
  let isVoiceMode = false;
  let isTyping = false;
  let isSpeaking = false;
  let voiceLoopActive = false;
  let typingAbort = false;   // ✅ FIX

  stopBtn.style.display = "none"; // ✅ FIX

  /* ---------- UTILITIES ---------- */

  function markdownToHTML(md) {
    return md
      .replace(/^### (.*$)/gim, "<h3>$1</h3>")
      .replace(/^## (.*$)/gim, "<h2>$1</h2>")
      .replace(/^# (.*$)/gim, "<h1>$1</h1>")
      .replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/gim, "<em>$1</em>")
      .replace(/^\d+\.\s+(.*)$/gim, "<li>$1</li>")
      .replace(/(<li>.*<\/li>)/gims, "<ol>$1</ol>")
      .replace(/\n\n/g, "<br><br>")
      .trim();
  }

  function showThinking(text = "🤔 Thinking...") {
    const el = document.createElement("div");
    el.className = "bot-msg thinking";
    el.textContent = text;
    chatBox.appendChild(el);
    chatBox.scrollTop = chatBox.scrollHeight;
    return el;
  }

  function speakText(text) {
    if (!isVoiceMode || isSpeaking) return;

    isSpeaking = true;
    stopBtn.style.display = "inline-block";
    voiceStatus.textContent = "🔊 Speaking...";

    const clean = text.replace(/<[^>]+>/g, "").slice(0, 3500);
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = "en-IN";

    u.onend = () => {
      isSpeaking = false;
      stopBtn.style.display = "none";
      if (isVoiceMode) startVoiceLoop();
    };

    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  stopBtn.onclick = () => {
    typingAbort = true;
    isTyping = false;
    isSpeaking = false;
    speechSynthesis.cancel();
    stopBtn.style.display = "none";
    voiceStatus.textContent = "🛑 Stopped";
  };

  function saveChats() {
    localStorage.setItem("chats", JSON.stringify(chats));
  }

  /* ---------- CHAT ---------- */

  function createNewChat() {
    const id = Date.now().toString();
    chats.push({ id, title: "New Chat", messages: [] });
    currentChatId = id;
    saveChats();
    renderChatList();
    loadChat(id);
    appendMessage("bot", "✨ New chat started!");
  }

  function renderChatList() {
    chatList.innerHTML = "";
    chats.forEach(chat => {
      const item = document.createElement("div");
      item.className = "chat-item";
      if (chat.id === currentChatId) item.classList.add("active-chat");

      item.innerHTML = `
        <span class="chat-title">${chat.title}</span>
        <button class="chat-menu-btn">⋮</button>
        <div class="chat-menu hidden">
          <button class="rename-chat">Rename</button>
          <button class="delete-chat">Delete</button>
        </div>
      `;

      item.querySelector(".chat-title").onclick = () => loadChat(chat.id);
      item.querySelector(".rename-chat").onclick = () => {
        const n = prompt("Rename chat:", chat.title);
        if (n) { chat.title = n; saveChats(); renderChatList(); }
      };
      item.querySelector(".delete-chat").onclick = () => {
        chats = chats.filter(c => c.id !== chat.id);
        saveChats();
        chats.length ? loadChat(chats.at(-1).id) : createNewChat();
      };
      item.querySelector(".chat-menu-btn").onclick = e => {
        e.stopPropagation();
        document.querySelectorAll(".chat-menu").forEach(m => m.classList.add("hidden"));
        item.querySelector(".chat-menu").classList.toggle("hidden");
      };

      chatList.appendChild(item);
    });
  }

  function loadChat(id) {
    currentChatId = id;
    chatBox.innerHTML = "";
    chats.find(c => c.id === id).messages.forEach(m =>
      appendMessage(m.role, m.text, true)
    );
    renderChatList();
  }

  if (!chats.length) createNewChat();
  else loadChat(chats.at(-1).id);

  /* ---------- MESSAGE ---------- */

  async function appendMessage(role, text, skipSave = false) {
    const el = document.createElement("div");
    el.className = role === "user" ? "user-msg" : "bot-msg";
    chatBox.appendChild(el);

    if (role === "bot") {
      isTyping = true;
      typingAbort = false;
      stopBtn.style.display = "inline-block";

      const html = markdownToHTML(text);
      el.innerHTML = "";

      for (let i = 0; i < html.length; i++) {
        if (typingAbort) break;
        el.innerHTML = html.slice(0, i + 1);
        chatBox.scrollTop = chatBox.scrollHeight;
        await new Promise(r => setTimeout(r, 6));
      }

      isTyping = false;
      stopBtn.style.display = "none";
      speakText(html);
    } else {
      el.textContent = text;
    }

    if (!skipSave) {
      chats.find(c => c.id === currentChatId).messages.push({ role, text });
      saveChats();
    }
  }

  /* ---------- SEND ---------- */

  async function sendMessage() {
    if (isTyping || isSpeaking) return;

    const msg = userInput.value.trim();
    const hasImg = imageInput.files.length > 0;
    if (!msg && !hasImg) return;

    if (msg) appendMessage("user", msg);
    if (hasImg) appendMessage("user", "📷 Image");
    userInput.value = "";

    const thinkingEl = showThinking();

    let res;
    if (hasImg) {
      const fd = new FormData();
      fd.append("file", imageInput.files[0]);
      fd.append("query", msg);
      res = await fetch(`${API}/api/vision/analyze`, { method: "POST", body: fd });
      imageInput.value = "";
      preview.style.display = "none";
    } else {
      res = await fetch(`${API}/api/chat/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: USER_ID, chat_id: currentChatId, message: msg })
      });
    }

    const d = await res.json();
    thinkingEl.remove();
    appendMessage("bot", d.reply);
  }

  sendBtn.onclick = sendMessage;
  userInput.onkeydown = e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  /* ---------- MIC ---------- */

  micBtn.onclick = async () => {
    if (isTyping || isSpeaking) return;
    const listeningEl = showThinking("🎧 Listening...");

    try {
      const r = await fetch(`${API}/api/voice/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: USER_ID, chat_id: currentChatId })
      });
      const d = await r.json();
      listeningEl.remove();
      appendMessage("user", `🎤 ${d.text}`);
      appendMessage("bot", d.reply);
    } catch {
      listeningEl.remove();
      appendMessage("bot", "⚠️ Voice failed");
    }
  };

  /* ---------- VOICE MODE ---------- */

  async function startVoiceLoop() {
    if (!isVoiceMode || voiceLoopActive) return;
    voiceLoopActive = true;

    while (isVoiceMode) {
      if (isTyping || isSpeaking) {
        await new Promise(r => setTimeout(r, 300));
        continue;
      }
      const listeningEl = showThinking("🎧 Listening...");
      const r = await fetch(`${API}/api/voice/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: USER_ID, chat_id: currentChatId })
      });
      const d = await r.json();
      listeningEl.remove();
      await appendMessage("user", `🎤 ${d.text}`);
      await appendMessage("bot", d.reply);
    }

    voiceLoopActive = false;
  }

  voiceModeBtn.onclick = () => {
    isVoiceMode = !isVoiceMode;
    voiceOverlay.classList.toggle("hidden", !isVoiceMode);
    voiceModeBtn.textContent = isVoiceMode ? "🎧 Voice Mode: ON" : "🎧 Voice Mode: OFF";
    if (isVoiceMode) startVoiceLoop();
  };

  exitVoiceMode.onclick = () => {
    isVoiceMode = false;
    speechSynthesis.cancel();
    voiceOverlay.classList.add("hidden");
    voiceStatus.textContent = "";
  };

  /* ---------- IMAGE PREVIEW ---------- */

  imageInput.onchange = () => {
    const f = imageInput.files[0];
    if (!f) return;
    previewImg.src = URL.createObjectURL(f);
    preview.style.display = "flex";
    previewImg.style.width = "90px";
    previewImg.style.height = "90px";
    previewImg.style.objectFit = "cover";
    previewImg.style.borderRadius = "10px";
  };

  cancelPreview.onclick = () => {
    preview.style.display = "none";
    previewImg.src = "";
    imageInput.value = "";
  };

  /* ---------- MENU ---------- */

  plusBtn.onclick = e => {
    e.stopPropagation();
    optionsMenu.classList.toggle("hidden");
  };
  document.addEventListener("click", () => optionsMenu.classList.add("hidden"));

  newChatBtn.onclick = createNewChat;
});
