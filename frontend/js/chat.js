/* Multimodal AI – FINAL FIXED CHAT LOGIC  chat.js*/
/*frontend/js/chat.js*/ 
const API = "http://127.0.0.1:8000";

// GLOBAL
let isSpeaking = false;
let recognition = null;

document.addEventListener("DOMContentLoaded", () => {

  /* ========== ELEMENTS ========== */
  const el = {
  sidebar: document.querySelector(".sidebar"),
  collapseBtn: document.getElementById("collapseSidebar"),
  chatSearch: document.querySelector(".chat-search input"),
  chatList: document.getElementById("chatList"),
  chatBox: document.getElementById("chatBox"),
  userInput: document.getElementById("userInput"),
  sendBtn: document.getElementById("sendBtn"),
  newChatBtn: document.getElementById("newChat"),

  plusBtn: document.getElementById("plusBtn"),
  optionsMenu: document.getElementById("optionsMenu"), // ✅ MISSING FIX
  imageInput: document.getElementById("imageInput"),
  preview: document.getElementById("preview"),
  previewImg: document.getElementById("previewImg"),
  cancelPreview: document.getElementById("cancelPreview"),

  micBtn: document.getElementById("micBtn"),
  voiceOverlay: document.getElementById("voiceOverlay"),
  voiceStatus: document.getElementById("voiceStatus"),
  exitVoiceMode: document.getElementById("exitVoiceMode")
};


  /* ========== USER ========== */
  function getUserId() {
    let uid = localStorage.getItem("multimodal_ai_user_id");
    if (!uid) {
      uid = "user_" + crypto.randomUUID();
      localStorage.setItem("multimodal_ai_user_id", uid);
    }
    return uid;
  }
  const USER_ID = getUserId();

  /* ========== STATE ========== */
  let chats = JSON.parse(localStorage.getItem("chats") || "[]");
  let currentChatId = null;
  let isTyping = false;

  /* ========== HELPERS ========== */
  function saveChats() {
    localStorage.setItem("chats", JSON.stringify(chats));
  }

  function markdownToHTML(md) {
    return marked.parse(md);
  }

  function showThinking(text = "Thinking…") {
    const d = document.createElement("div");
    d.className = "bot-msg";
    d.textContent = text;
    el.chatBox.appendChild(d);
    el.chatBox.scrollTop = el.chatBox.scrollHeight;
    return d;
  }

  /* ========== CHAT MANAGEMENT ========== */
  function createNewChat() {
    const id = Date.now().toString();
    chats.push({ id, title: "New Chat", messages: [] });
    currentChatId = id;
    saveChats();
    renderChatList();
    loadChat(id);
  }

  function renderChatList(filter = "") {
    el.chatList.innerHTML = "";
    chats
      .filter(c => c.title.toLowerCase().includes(filter.toLowerCase()))
      .forEach(chat => {
        const item = document.createElement("div");
        item.className = "chat-item" + (chat.id === currentChatId ? " active-chat" : "");
        item.innerHTML = `
          <span class="chat-title">${chat.title}</span>
          <div class="chat-actions">
            <button onclick="renameChat('${chat.id}')">✏️</button>
            <button onclick="deleteChat('${chat.id}')">🗑️</button>
            <button onclick="archiveChat('${chat.id}')">📦</button>
          </div>
        `;
        item.onclick = e => {
          if (!e.target.closest("button")) loadChat(chat.id);
        };
        el.chatList.appendChild(item);
      });
  }

  window.renameChat = id => {
    const t = prompt("Rename chat");
    if (!t) return;
    const c = chats.find(x => x.id === id);
    if (c) c.title = t;
    saveChats();
    renderChatList(el.chatSearch.value);
  };

  window.deleteChat = id => {
    if (!confirm("Delete chat?")) return;
    chats = chats.filter(c => c.id !== id);
    saveChats();
    chats.length ? loadChat(chats.at(-1).id) : createNewChat();
  };

  window.archiveChat = id => {
  const chat = chats.find(c => c.id === id);
  if (!chat) return;

  chat.archived = true;
  saveChats();
  renderChatList(el.chatSearch.value);
};

  window.showArchived = () => {
  el.chatList.innerHTML = "";

  chats
    .filter(c => c.archived)
    .forEach(chat => {
      const item = document.createElement("div");
      item.className = "chat-item";
      item.innerHTML = `
        <span class="chat-title">${chat.title}</span>
        <button onclick="restoreChat('${chat.id}')">♻ Restore</button>
      `;
      el.chatList.appendChild(item);
    });
};

window.restoreChat = id => {
  const chat = chats.find(c => c.id === id);
  if (chat) chat.archived = false;
  saveChats();
  renderChatList();
};



  function loadChat(id) {
    currentChatId = id;
    el.chatBox.innerHTML = "";
    const c = chats.find(x => x.id === id);
    if (c) c.messages.forEach(m => appendMessage(m.role, m.text, true));
    renderChatList(el.chatSearch.value);
  }

  async function appendMessage(role, text, skipSave = false) {
    const m = document.createElement("div");
    m.className = role === "user" ? "user-msg" : "bot-msg";
    el.chatBox.appendChild(m);

    if (role === "bot") {
      isTyping = true;
      m.innerHTML = markdownToHTML(text);
      isTyping = false;
    } else {
      m.textContent = text;
    }

    el.chatBox.scrollTop = el.chatBox.scrollHeight;

    if (!skipSave) {
      chats.find(c => c.id === currentChatId)
        .messages.push({ role, text });
      saveChats();
    }
  }

  /* ========== SEND MESSAGE ========== */
  async function sendMessage() {
    if (isTyping || isSpeaking) return;

    const msg = el.userInput.value.trim();
    const hasImg = el.imageInput.files.length > 0;
    if (!msg && !hasImg) return;

    if (msg) appendMessage("user", msg);
    else appendMessage("user", "📷 Image");

    el.userInput.value = "";

    const thinking = showThinking();

    try {
      let res;
      if (hasImg) {
        const fd = new FormData();
        fd.append("file", el.imageInput.files[0]);
        fd.append("query", msg || "Describe image");
        res = await fetch(`${API}/api/vision/analyze`, { method: "POST", body: fd });
        el.preview.classList.add("hidden");
        el.imageInput.value = "";
      } else {
        res = await fetch(`${API}/api/chat/ask`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: USER_ID,
            chat_id: currentChatId,
            message: msg
          })
        });
      }

      const d = await res.json();
      thinking.remove();
      appendMessage("bot", d.reply || "No response");
    } catch {
      thinking.remove();
      appendMessage("bot", "Error");
    }
  }

  /* ========== VOICE (ONE-SHOT) ========== */
  function startVoiceRecognition() {
    if (isSpeaking) return;

    if (!("SpeechRecognition" in window || "webkitSpeechRecognition" in window)) {
      alert("Voice not supported");
      return;
    }

    recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = "en-US";

    recognition.onstart = () => {
      isSpeaking = true;
      el.voiceOverlay?.classList.remove("hidden");
      el.voiceStatus.textContent = "Listening…";
    };

    recognition.onresult = e => {
      const text = e.results[0][0].transcript;
      el.userInput.value = text;
      sendMessage();
    };

    recognition.onend = () => {
      isSpeaking = false;
      el.voiceOverlay?.classList.add("hidden");
    };

    recognition.start();
  }

  /* ========== EVENTS ========== */
  el.sendBtn.onclick = sendMessage;

  el.userInput.onkeydown = e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // + button → toggle menu

  // + button → toggle menu
  el.plusBtn.addEventListener("click", e => {
    e.stopPropagation();
    el.optionsMenu.classList.toggle("hidden");
  });

  // Upload image option
  document.getElementById("uploadImageBtn").addEventListener("click", () => {
    el.optionsMenu.classList.add("hidden");
    el.imageInput.click();
  });

  // Click outside → close menu
  document.addEventListener("click", () => {
    el.optionsMenu.classList.add("hidden");
  });



  el.imageInput.onchange = () => {
    const f = el.imageInput.files[0];
    if (!f) return;
    el.previewImg.src = URL.createObjectURL(f);
    el.preview.classList.remove("hidden");
  };

  el.cancelPreview.onclick = () => {
    el.preview.classList.add("hidden");
    el.imageInput.value = "";
  };

  el.micBtn.onclick = startVoiceRecognition;

  el.newChatBtn.onclick = createNewChat;

  el.collapseBtn.onclick = () => {
    el.sidebar.classList.toggle("collapsed");
  };

  el.chatSearch.oninput = e => renderChatList(e.target.value);



  /* ========== INIT ========== */
  if (!chats.length) createNewChat();
  else loadChat(chats.at(-1).id);
});
