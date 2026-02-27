/* ===== MODERN CHAT INTERFACE ===== */

const API = "http://127.0.0.1:8000";

// State
let chats = JSON.parse(localStorage.getItem("chats") || "[]");
let currentChatId = null;
let isTyping = false;
let USER_ID = localStorage.getItem("multimodal_ai_user_id") || "user_" + crypto.randomUUID();

localStorage.setItem("multimodal_ai_user_id", USER_ID);

// DOM Elements
const chatList = document.getElementById("chatList");
const chatBox = document.getElementById("chatBox");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const newChatBtn = document.getElementById("newChat");
const chatTitle = document.getElementById("chatTitle");
const chatSubtitle = document.getElementById("chatSubtitle");
const messageCount = document.getElementById("messageCount");
const imageInput = document.getElementById("imageInput");
const micBtn = document.getElementById("micBtn");
const imagePreview = document.getElementById("imagePreview");
const chatSearch = document.getElementById("chatSearch");
const modelSelect = document.getElementById("modelSelect");
const temperature = document.getElementById("temperature");
const tempValue = document.getElementById("tempValue");
const maxTokens = document.getElementById("maxTokens");
const tokensValue = document.getElementById("tokensValue");
const sidebar = document.querySelector(".sidebar");
const menuToggle = document.querySelector(".menu-toggle");

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  if (chats.length > 0) {
    loadChat(chats[chats.length - 1].id);
  } else {
    createNewChat();
  }
  renderChatList();
});

// Setup event listeners
function setupEventListeners() {
  sendBtn.addEventListener("click", sendMessage);
  newChatBtn.addEventListener("click", createNewChat);
  micBtn.addEventListener("click", startVoiceInput);
  
  userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  userInput.addEventListener("input", () => {
    userInput.style.height = "auto";
    userInput.style.height = Math.min(userInput.scrollHeight, 150) + "px";
  });

  temperature.addEventListener("change", () => {
    tempValue.textContent = temperature.value;
  });

  maxTokens.addEventListener("change", () => {
    tokensValue.textContent = maxTokens.value;
  });

  chatSearch.addEventListener("input", (e) => renderChatList(e.target.value));

  menuToggle.addEventListener("click", toggleSidebar);

  // Image input
  imageInput.addEventListener("change", handleImageUpload);
  document.querySelector(".btn-remove")?.addEventListener("click", removeImagePreview);

  // Export and clear buttons
  document.querySelectorAll(".btn-action").forEach(btn => {
    if (btn.textContent.includes("Export")) {
      btn.addEventListener("click", exportChat);
    } else if (btn.textContent.includes("Clear")) {
      btn.addEventListener("click", clearChat);
    }
  });
}

// Toggle sidebar on mobile
function toggleSidebar() {
  sidebar.classList.toggle("active");
}

// Create new chat
function createNewChat() {
  const id = Date.now().toString();
  chats.push({
    id,
    title: "New Chat",
    messages: [],
    createdAt: new Date().toISOString()
  });
  localStorage.setItem("chats", JSON.stringify(chats));
  loadChat(id);
}

// Load chat
function loadChat(id) {
  currentChatId = id;
  const chat = chats.find(c => c.id === id);
  
  if (!chat) return;

  chatTitle.textContent = chat.title || "New Chat";
  chatSubtitle.textContent = chat.messages.length > 0 ? 
    `${chat.messages.length} message${chat.messages.length !== 1 ? 's' : ''}` : 
    "Start a conversation";
  messageCount.textContent = chat.messages.length;

  chatBox.innerHTML = chat.messages.length === 0 ? 
    `<div class="empty-state">
      <div class="empty-icon">💬</div>
      <h2>No messages yet</h2>
      <p>Start a conversation or select an existing chat to begin</p>
    </div>` : 
    "";

  chat.messages.forEach(msg => displayMessage(msg.role, msg.text));
  renderChatList();
  closeSidebarOnMobile();
}

// Render chat list
function renderChatList(filter = "") {
  chatList.innerHTML = "";
  const filtered = chats.filter(c => 
    c.title.toLowerCase().includes(filter.toLowerCase())
  );

  if (filtered.length === 0) {
    chatList.innerHTML = '<div style="padding: 1rem; text-align: center; color: var(--text-muted);">No chats found</div>';
    return;
  }

  filtered.forEach(chat => {
    const item = document.createElement("button");
    item.className = `chat-item ${chat.id === currentChatId ? "active-chat" : ""}`;
    item.textContent = chat.title;
    item.addEventListener("click", () => loadChat(chat.id));
    chatList.appendChild(item);
  });
}

// Display message
function displayMessage(role, text) {
  if (chatBox.querySelector(".empty-state")) {
    chatBox.innerHTML = "";
  }

  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${role}`;

  const contentDiv = document.createElement("div");
  contentDiv.className = "message-content";
  
  if (role === "bot") {
    contentDiv.innerHTML = marked.parse(text);
  } else {
    contentDiv.textContent = text;
  }

  messageDiv.appendChild(contentDiv);

  // Add actions for bot messages
  if (role === "bot") {
    const actionsDiv = document.createElement("div");
    actionsDiv.className = "message-actions";

    const copyBtn = document.createElement("button");
    copyBtn.className = "action-btn";
    copyBtn.textContent = "📋";
    copyBtn.title = "Copy";
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(text);
      copyBtn.textContent = "✓";
      setTimeout(() => copyBtn.textContent = "📋", 2000);
    });

    actionsDiv.appendChild(copyBtn);
    messageDiv.appendChild(actionsDiv);
  }

  chatBox.appendChild(messageDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Send message
async function sendMessage() {
  const msg = userInput.value.trim();
  const hasImage = imageInput.files.length > 0;

  if (!msg && !hasImage) return;
  if (isTyping) return;

  isTyping = true;
  sendBtn.disabled = true;

  displayMessage("user", msg || "📷 Image");
  userInput.value = "";
  userInput.style.height = "auto";

  const thinkingEl = showThinking();

  try {
    let response;

    if (hasImage) {
      const formData = new FormData();
      formData.append("file", imageInput.files[0]);
      formData.append("query", msg || "Analyze this image");

      response = await fetch(`${API}/api/vision/analyze`, {
        method: "POST",
        body: formData
      });

      removeImagePreview();
    } else {
      response = await fetch(`${API}/api/chat/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: USER_ID,
          chat_id: currentChatId,
          message: msg,
          temperature: parseFloat(temperature.value),
          max_tokens: parseInt(maxTokens.value)
        })
      });
    }

    const data = await response.json();
    thinkingEl.remove();

    if (!response.ok) {
      displayMessage("bot", `Error: ${data.detail || "Something went wrong"}`);
    } else {
      displayMessage("bot", data.reply || "No response generated");

      // Save to chat
      const chat = chats.find(c => c.id === currentChatId);
      if (chat) {
        chat.messages.push({ role: "user", text: msg || "📷 Image" });
        chat.messages.push({ role: "bot", text: data.reply });
        localStorage.setItem("chats", JSON.stringify(chats));
        messageCount.textContent = chat.messages.length;
        chatSubtitle.textContent = `${chat.messages.length} messages`;
      }
    }
  } catch (error) {
    thinkingEl.remove();
    displayMessage("bot", `Connection error: ${error.message}`);
    console.error("Send message error:", error);
  } finally {
    isTyping = false;
    sendBtn.disabled = false;
    userInput.focus();
  }
}

// Show thinking indicator
function showThinking() {
  const msgDiv = document.createElement("div");
  msgDiv.className = "message bot thinking";
  const contentDiv = document.createElement("div");
  contentDiv.className = "message-content";
  contentDiv.textContent = "🤔 Processing";
  msgDiv.appendChild(contentDiv);
  chatBox.appendChild(msgDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
  return msgDiv;
}

// Voice input
async function startVoiceInput() {
  if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
    alert("Voice input not supported in your browser");
    return;
  }

  const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";

  micBtn.style.opacity = "0.5";
  micBtn.textContent = "🎤 Listening...";

  recognition.onstart = () => {
    displayMessage("bot", "🎤 Listening for your voice...");
  };

  recognition.onresult = (event) => {
    const text = event.results[0][0].transcript;
    userInput.value = text;
    micBtn.style.opacity = "1";
    micBtn.textContent = "🎤";
  };

  recognition.onerror = (event) => {
    displayMessage("bot", `Voice recognition error: ${event.error}`);
    micBtn.style.opacity = "1";
    micBtn.textContent = "🎤";
  };

  recognition.onend = () => {
    micBtn.style.opacity = "1";
    micBtn.textContent = "🎤";
  };

  recognition.start();
}

// Image upload
function handleImageUpload() {
  const file = imageInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const previewImg = document.getElementById("previewImg");
    previewImg.src = e.target.result;
    imagePreview.style.display = "flex";
  };
  reader.readAsDataURL(file);
}

function removeImagePreview() {
  imagePreview.style.display = "none";
  imageInput.value = "";
  document.getElementById("previewImg").src = "";
}

// Export chat
function exportChat() {
  const chat = chats.find(c => c.id === currentChatId);
  if (!chat) return;

  const data = JSON.stringify(chat, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${chat.title}-${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Clear chat
function clearChat() {
  if (!confirm("Clear this conversation?")) return;
  
  const chat = chats.find(c => c.id === currentChatId);
  if (chat) {
    chat.messages = [];
    localStorage.setItem("chats", JSON.stringify(chats));
    loadChat(currentChatId);
  }
}

// Helper function
function closeSidebarOnMobile() {
  if (window.innerWidth <= 768) {
    sidebar.classList.remove("active");
  }
}

// Export functions for inline onclick handlers
window.createNewChat = createNewChat;
window.toggleSidebar = toggleSidebar;
window.startVoiceInput = startVoiceInput;
window.sendMessage = sendMessage;
window.exportChat = exportChat;
window.clearChat = clearChat;
window.removeImagePreview = removeImagePreview;
window.updateTempValue = (val) => {
  document.getElementById("tempValue").textContent = val;
};
window.updateTokensValue = (val) => {
  document.getElementById("tokensValue").textContent = val;
};