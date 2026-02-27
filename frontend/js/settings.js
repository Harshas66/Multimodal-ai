/* ===== MODERN SETTINGS PAGE ===== */

const API = "http://127.0.0.1:8000";

// Initialize on load
document.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  loadUserInfo();
  loadSettings();
  setupEventListeners();
});

// Setup navigation
function setupNavigation() {
  const navItems = document.querySelectorAll(".nav-item");
  const sections = document.querySelectorAll(".settings-section");

  navItems.forEach(item => {
    item.addEventListener("click", () => {
      // Remove active from all
      navItems.forEach(i => i.classList.remove("active"));
      sections.forEach(s => s.classList.remove("active"));

      // Add active to clicked
      item.classList.add("active");
      const sectionId = item.getAttribute("data-section");
      document.getElementById(sectionId)?.classList.add("active");
    });
  });
}

// Setup event listeners
function setupEventListeners() {
  // Model select
  const modelSelect = document.getElementById("modelSelect");
  if (modelSelect) {
    modelSelect.addEventListener("change", saveSettings);
  }

  // Sliders
  const temperature = document.getElementById("temperature");
  const maxTokens = document.getElementById("maxTokens");
  const topP = document.getElementById("topP");

  if (temperature) {
    temperature.addEventListener("change", () => {
      document.getElementById("tempValueDisplay").textContent = temperature.value;
      saveSettings();
    });
  }

  if (maxTokens) {
    maxTokens.addEventListener("change", () => {
      document.getElementById("tokensValueDisplay").textContent = maxTokens.value;
      saveSettings();
    });
  }

  if (topP) {
    topP.addEventListener("change", () => {
      document.getElementById("topPValueDisplay").textContent = topP.value;
      saveSettings();
    });
  }

  // Action buttons
  const exportBtn = document.querySelector('button[onclick="exportAllChats()"]');
  const clearBtn = document.querySelector('button[onclick="clearAllChats()"]');

  if (exportBtn) exportBtn.addEventListener("click", exportAllChats);
  if (clearBtn) clearBtn.addEventListener("click", clearAllChats);

  // Danger zone
  const deleteBtn = document.querySelector('button[onclick="deleteAccount()"]');
  if (deleteBtn) deleteBtn.addEventListener("click", deleteAccount);
}

// Load user info
function loadUserInfo() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const totalChats = JSON.parse(localStorage.getItem("chats") || "[]").length;

  const accountEmail = document.getElementById("accountEmail");
  const accountCreated = document.getElementById("accountCreated");
  const totalChatsEl = document.getElementById("totalChats");

  if (accountEmail) accountEmail.textContent = user.email || "user@example.com";
  if (accountCreated) accountCreated.textContent = new Date().toLocaleDateString();
  if (totalChatsEl) totalChatsEl.textContent = totalChats;

  // Storage info
  const chats = JSON.parse(localStorage.getItem("chats") || "[]");
  const storageSize = document.getElementById("storageSize");
  if (storageSize) {
    const messages = chats.reduce((acc, chat) => acc + chat.messages.length, 0);
    const estimatedSize = (messages * 200).toLocaleString(); // Rough estimate
    storageSize.textContent = `${estimatedSize} bytes`;
  }
}

// Load settings
function loadSettings() {
  const modelSelect = document.getElementById("modelSelect");
  const temperature = document.getElementById("temperature");
  const maxTokens = document.getElementById("maxTokens");
  const topP = document.getElementById("topP");

  const settings = JSON.parse(localStorage.getItem("aiSettings") || "{}");

  if (modelSelect && settings.model) modelSelect.value = settings.model;
  if (temperature && settings.temperature) {
    temperature.value = settings.temperature;
    document.getElementById("tempValueDisplay").textContent = settings.temperature;
  }
  if (maxTokens && settings.maxTokens) {
    maxTokens.value = settings.maxTokens;
    document.getElementById("tokensValueDisplay").textContent = settings.maxTokens;
  }
  if (topP && settings.topP) {
    topP.value = settings.topP;
    document.getElementById("topPValueDisplay").textContent = settings.topP;
  }

  // Load feature toggles
  const imageAnalysis = document.querySelector('input[onchange="toggleFeature(\'imageAnalysis\'');
  const voiceInput = document.querySelector('input[onchange="toggleFeature(\'voiceInput\'"]');
  const voiceOutput = document.querySelector('input[onchange="toggleFeature(\'voiceOutput\'"]');
  const autoSave = document.querySelector('input[onchange="toggleFeature(\'autoSave\'"]');

  if (imageAnalysis && settings.imageAnalysis === false) imageAnalysis.checked = false;
  if (voiceInput && settings.voiceInput === false) voiceInput.checked = false;
  if (voiceOutput && settings.voiceOutput === false) voiceOutput.checked = false;
  if (autoSave && settings.autoSave === false) autoSave.checked = false;
}

// Save settings
function saveSettings() {
  const modelSelect = document.getElementById("modelSelect");
  const temperature = document.getElementById("temperature");
  const maxTokens = document.getElementById("maxTokens");
  const topP = document.getElementById("topP");

  const settings = {
    model: modelSelect?.value || "llama",
    temperature: temperature?.value || "0.7",
    maxTokens: maxTokens?.value || "512",
    topP: topP?.value || "0.9"
  };

  localStorage.setItem("aiSettings", JSON.stringify(settings));
}

// Toggle feature
function toggleFeature(feature, enabled) {
  const settings = JSON.parse(localStorage.getItem("aiSettings") || "{}");
  settings[feature] = enabled;
  localStorage.setItem("aiSettings", JSON.stringify(settings));
}

// Update display values
function updateTempValue(value) {
  document.getElementById("tempValueDisplay").textContent = value;
  saveSettings();
}

function updateTokensValue(value) {
  document.getElementById("tokensValueDisplay").textContent = value;
  saveSettings();
}

function updateTopPValue(value) {
  document.getElementById("topPValueDisplay").textContent = value;
  saveSettings();
}

// Export all chats
function exportAllChats() {
  const chats = JSON.parse(localStorage.getItem("chats") || "[]");
  if (chats.length === 0) {
    alert("No chats to export");
    return;
  }

  const data = JSON.stringify(chats, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `multimodal-ai-chats-${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Clear all chats
function clearAllChats() {
  if (!confirm("Delete all chats? This cannot be undone.")) return;
  
  localStorage.setItem("chats", JSON.stringify([]));
  document.getElementById("totalChats").textContent = "0";
  alert("All chats cleared");
}

// Delete account
async function deleteAccount() {
  if (!confirm("Are you sure? This will permanently delete your account.")) return;
  if (!confirm("This action cannot be undone. Are you absolutely certain?")) return;

  try {
    const token = localStorage.getItem("token");
    const response = await fetch(`${API}/api/auth/delete-account`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    if (response.ok) {
      localStorage.clear();
      alert("Account deleted successfully");
      window.location.href = "index.html";
    } else {
      const data = await response.json();
      alert(`Error: ${data.detail || "Failed to delete account"}`);
    }
  } catch (error) {
    console.error("Delete account error:", error);
    alert("Connection error. Please try again.");
  }
}

// Logout
function logout() {
  if (!confirm("Log out?")) return;
  localStorage.clear();
  window.location.href = "index.html";
}

// Export for inline handlers
window.updateTempValue = updateTempValue;
window.updateTokensValue = updateTokensValue;
window.updateTopPValue = updateTopPValue;
window.toggleFeature = toggleFeature;
window.exportAllChats = exportAllChats;
window.clearAllChats = clearAllChats;
window.deleteAccount = deleteAccount;
window.logout = logout;
