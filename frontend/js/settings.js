import {
  auth,
  googleProvider,
  EmailAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  updatePassword,
  updateProfile,
  deleteUser
} from "./firebase.js?v=3.3";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const API = (() => {
  // Allow override (optional)
  if (window.API_ENDPOINT) return window.API_ENDPOINT;

  const stored = localStorage.getItem("apiEndpoint");
  if (stored) return stored;

  // Local development
  if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    return "http://127.0.0.1:8000";
  }

  // ✅ YOUR RENDER BACKEND (FINAL)
  return "https://multimodal-ai-backend-xu4a.onrender.com";
})();

const KEYS = {
  chats: "hybrid_chats",
  currentChatId: "hybrid_current_chat",
  token: "token",
  user: "user",
  authProvider: "authProvider",
  tokenTimestamp: "token_timestamp",
  memoryEnabled: "memory_enabled",
  platformMode: "platform_mode",
  profileImage: "profile_image_data_url"
};

const token = localStorage.getItem("token");
console.log("Settings Page Token:", token);

const dom = {
  loader: document.getElementById("settingsLoader"),
  status: document.getElementById("settingsStatus"),
  profileAvatar: document.getElementById("profileAvatar"),
  profileAvatarImage: document.getElementById("profileAvatarImage"),
  profileAvatarInitials: document.getElementById("profileAvatarInitials"),
  profileImageInput: document.getElementById("profileImageInput"),
  removeProfileImageBtn: document.getElementById("removeProfileImageBtn"),
  summaryRemoveProfileImageBtn: document.getElementById("summaryRemoveProfileImageBtn"),
  profileNameHeading: document.getElementById("profileNameHeading"),
  profileEmailHeading: document.getElementById("profileEmailHeading"),
  profileChats: document.getElementById("profileChats"),
  summaryPlatformMode: document.getElementById("summaryPlatformMode"),
  displayNameInput: document.getElementById("displayNameInput"),
  profileEmail: document.getElementById("profileEmail"),
  saveProfileBtn: document.getElementById("saveProfileBtn"),
  currentPassword: document.getElementById("currentPassword"),
  newPassword: document.getElementById("newPassword"),
  confirmPassword: document.getElementById("confirmPassword"),
  changePasswordBtn: document.getElementById("changePasswordBtn"),
  memoryToggle: document.getElementById("memoryToggle"),
  platformMode: document.getElementById("platformMode"),
  syncBtn: document.getElementById("syncBtn"),
  syncStatus: document.getElementById("syncStatus"),
  exportBtn: document.getElementById("exportBtn"),
  clearBtn: document.getElementById("clearBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  exportChatsModal: document.getElementById("exportChatsModal"),
  exportChatsBackdrop: document.getElementById("exportChatsBackdrop"),
  closeExportChatsModalBtn: document.getElementById("closeExportChatsModalBtn"),
  cancelExportChatsBtn: document.getElementById("cancelExportChatsBtn"),
  confirmExportChatsBtn: document.getElementById("confirmExportChatsBtn"),
  exportChatList: document.getElementById("exportChatList"),
  exportSelectAll: document.getElementById("exportSelectAll"),
  exportModalHint: document.getElementById("exportModalHint"),
  clearChatsModal: document.getElementById("clearChatsModal"),
  clearChatsBackdrop: document.getElementById("clearChatsBackdrop"),
  closeClearChatsModalBtn: document.getElementById("closeClearChatsModalBtn"),
  cancelClearChatsBtn: document.getElementById("cancelClearChatsBtn"),
  confirmClearChatsBtn: document.getElementById("confirmClearChatsBtn"),
  deleteAccountBtn: document.getElementById("deleteAccountBtn"),
  deleteAccountModal: document.getElementById("deleteAccountModal"),
  deleteAccountBackdrop: document.getElementById("deleteAccountBackdrop"),
  closeDeleteAccountModalBtn: document.getElementById("closeDeleteAccountModalBtn"),
  cancelDeleteAccountBtn: document.getElementById("cancelDeleteAccountBtn"),
  confirmDeleteAccountBtn: document.getElementById("confirmDeleteAccountBtn"),
  deleteAccountConfirmInput: document.getElementById("deleteAccountConfirmInput"),
  deleteAccountPasswordField: document.getElementById("deleteAccountPasswordField"),
  deleteAccountPasswordInput: document.getElementById("deleteAccountPasswordInput"),
  deleteAccountProviderHint: document.getElementById("deleteAccountProviderHint")
};

const state = {
  firebaseUser: null,
  profileImageDataUrl: localStorage.getItem(KEYS.profileImage) || "",
  providerId: "password",
  authLoading: true,
  token: token || "",
  exportModalOpen: false,
  clearChatsModalOpen: false,
  exportSelection: new Set(),
  deleteModalOpen: false,
  deletingAccount: false
};

function getToken() {
  const token = localStorage.getItem(KEYS.token) || "";
  console.log("Token:", token ? `${token.slice(0, 12)}...` : "");
  return token;
}

function setAuthLoading(isLoading) {
  state.authLoading = Boolean(isLoading);
  console.log("AuthLoading:", state.authLoading);
  if (!dom.loader) return;
  dom.loader.classList.toggle("is-hidden", !state.authLoading);
}

function getUser() {
  console.log("User:", state.firebaseUser);
  return state.firebaseUser;
}

function setStatus(message, type = "info") {
  if (!dom.status) return;
  dom.status.hidden = false;
  dom.status.className = `settings-status is-${type}`;
  dom.status.textContent = message;
}

function clearStatus() {
  if (!dom.status) return;
  dom.status.hidden = true;
  dom.status.className = "settings-status";
  dom.status.textContent = "";
}

function parseStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.user) || "{}");
  } catch (_error) {
    return {};
  }
}

function getLocalChats() {
  try {
    const chats = JSON.parse(localStorage.getItem(KEYS.chats) || "[]");
    return Array.isArray(chats) ? chats : [];
  } catch (_error) {
    return [];
  }
}

function providerIdForSession(user = state.firebaseUser || auth.currentUser) {
  if (user?.providerData?.length) {
    return user.providerData[0]?.providerId || state.providerId || "password";
  }
  const storedUser = parseStoredUser();
  const storedProvider = storedUser.provider || localStorage.getItem(KEYS.authProvider) || "";
  return storedProvider === "google" ? "google.com" : state.providerId || "password";
}

function initialsFromName(name, email = "") {
  const raw = String(name || email || "AI").trim();
  if (!raw) return "AI";
  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0] || ""}${words[1][0] || ""}`.toUpperCase();
  }
  return raw.replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase() || "AI";
}

function authHeaders() {
  const currentToken = state.token || getToken();
  console.log("[settings] Authorization header token:", currentToken ? "attached" : "missing");
  return {
    Authorization: `Bearer ${currentToken || ""}`,
    "Content-Type": "application/json"
  };
}

function setButtonBusy(button, busy, busyLabel) {
  if (!button) return;
  if (!button.dataset.defaultLabel) {
    button.dataset.defaultLabel = button.textContent.trim();
  }
  button.disabled = Boolean(busy);
  button.textContent = busy ? busyLabel : button.dataset.defaultLabel;
}

function clearLocalAccountState() {
  localStorage.removeItem(KEYS.token);
  localStorage.removeItem(KEYS.user);
  localStorage.removeItem(KEYS.authProvider);
  localStorage.removeItem(KEYS.tokenTimestamp);
  localStorage.removeItem(KEYS.profileImage);
  localStorage.removeItem(KEYS.chats);
  localStorage.removeItem(KEYS.currentChatId);
}

function closeExportChatsModal() {
  if (!dom.exportChatsModal) return;
  state.exportModalOpen = false;
  dom.exportChatsModal.hidden = true;
}

function closeClearChatsModal() {
  if (!dom.clearChatsModal) return;
  state.clearChatsModalOpen = false;
  dom.clearChatsModal.hidden = true;
}

function resetDeleteAccountModal() {
  if (dom.deleteAccountConfirmInput) dom.deleteAccountConfirmInput.value = "";
  if (dom.deleteAccountPasswordInput) dom.deleteAccountPasswordInput.value = "";
}

function closeDeleteAccountModal(force = false) {
  if (!dom.deleteAccountModal || (state.deletingAccount && !force)) return;
  state.deleteModalOpen = false;
  dom.deleteAccountModal.hidden = true;
  resetDeleteAccountModal();
}

function openDeleteAccountModal() {
  clearStatus();
  state.deleteModalOpen = true;
  state.providerId = providerIdForSession();
  if (dom.deleteAccountPasswordField) {
    dom.deleteAccountPasswordField.hidden = state.providerId === "google.com";
  }
  if (dom.deleteAccountProviderHint) {
    dom.deleteAccountProviderHint.textContent =
      state.providerId === "google.com"
        ? "Google accounts will open a secure Google reauthentication popup before deletion."
        : "Password accounts must enter the current password before deletion.";
  }
  dom.deleteAccountModal.hidden = false;
  resetDeleteAccountModal();
  window.setTimeout(() => {
    dom.deleteAccountConfirmInput?.focus();
  }, 20);
}

async function waitForFirebaseUser(timeoutMs = 1500) {
  if (auth.currentUser) return auth.currentUser;
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      unsubscribe();
      resolve(auth.currentUser || null);
    }, timeoutMs);
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const token = localStorage.getItem("token");
      console.log("Auth listener fired:", {
        firebaseUser: user,
        token
      });
      if (!user && !token) {
        console.log("🚨 Redirect from auth listener: no user AND no token");
      } else {
        console.log("Auth valid, no redirect");
      }
      window.clearTimeout(timeout);
      unsubscribe();
      resolve(user || null);
    });
  });
}

async function resolveAuthSession() {
  const storedToken = getToken();
  state.token = storedToken;
  if (!storedToken) {
    state.firebaseUser = null;
    getUser();
    return { token: "", user: null };
  }

  let user = auth.currentUser;
  if (!user) user = await waitForFirebaseUser();
  state.firebaseUser = user || null;
  getUser();

  if (user) {
    state.providerId = user.providerData?.[0]?.providerId || "password";
    let token = "";
    try {
      token = await user.getIdToken(true);
    } catch (err) {
      console.log(" Firebase token fetch failed:", err.message);
    }

    state.token = token;
    if (token) {
      state.token = token;
      localStorage.setItem(KEYS.token, token);
    }
    localStorage.setItem(
      KEYS.user,
      JSON.stringify({
        id: user.uid,
        name: user.displayName || "",
        email: user.email || "",
        provider: state.providerId === "google.com" ? "google" : "password"
      })
    );
    console.log("[settings] auth resolved from Firebase user");
    return { token, user };
  }

  if (storedToken) {
    state.token = storedToken;
    console.log("[settings] auth resolved from localStorage token fallback");
    return { token: storedToken, user: null };
  }

  return { token: "", user: null };
}

async function ensureToken() {
  const currentToken = state.token || getToken();
  state.token = currentToken;
  if (!currentToken) {
    console.log(" Missing token in ensureToken, skipping request but NOT logging out");
    return "";
  }
  return currentToken;
}

async function authorizedFetch(url, options = {}) {
  const token = await ensureToken();
  if (!token) {
    return new Response(JSON.stringify({ detail: "Missing token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  console.log("[settings] authorizedFetch:", url, token ? "token-ready" : "token-missing");
  const headers = { ...(options.headers || {}), ...authHeaders() };
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401) {
    console.warn("[settings] received 401 response; preserving token until explicit auth validation fails");
  }
  return response;
}

async function syncBackendSession() {
  const token = await ensureToken();
  if (!token) return;

  const storedUser = parseStoredUser();
  await fetch(`${API}/api/auth/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      name: storedUser.name || "",
      email: storedUser.email || "",
      provider: storedUser.provider || "password"
    })
  }).catch(() => {
    // Settings remains usable from local state when backend sync is unavailable.
  });
}

function renderAvatar(name, email) {
  const initials = initialsFromName(name, email);
  const image = state.profileImageDataUrl;

  if (image) {
    dom.profileAvatarImage.hidden = false;
    dom.profileAvatarImage.src = image;
    dom.profileAvatarInitials.hidden = true;
  } else {
    dom.profileAvatarImage.hidden = true;
    dom.profileAvatarImage.src = "";
    dom.profileAvatarInitials.hidden = false;
    dom.profileAvatarInitials.textContent = initials;
  }
}

function renderProfile() {
  const storedUser = parseStoredUser();
  const user = state.firebaseUser;
  const name = user?.displayName || storedUser.name || "Multimodal User";
  const email = user?.email || storedUser.email || "-";
  const chats = JSON.parse(localStorage.getItem(KEYS.chats) || "[]");
  const platformMode = localStorage.getItem(KEYS.platformMode) || "web";

  dom.profileNameHeading.textContent = name;
  dom.profileEmailHeading.textContent = email;
  dom.displayNameInput.value = name;
  dom.profileEmail.value = email;
  dom.profileChats.textContent = String(chats.length);
  dom.summaryPlatformMode.textContent = platformMode === "app" ? "App" : "Web";

  renderAvatar(name, email);
}

function loadPreferences() {
  dom.memoryToggle.checked = localStorage.getItem(KEYS.memoryEnabled) !== "false";
  dom.platformMode.value = localStorage.getItem(KEYS.platformMode) || "web";
  dom.summaryPlatformMode.textContent = dom.platformMode.value === "app" ? "App" : "Web";
}

function savePreferences() {
  localStorage.setItem(KEYS.memoryEnabled, dom.memoryToggle.checked ? "true" : "false");
  localStorage.setItem(KEYS.platformMode, dom.platformMode.value);
  dom.summaryPlatformMode.textContent = dom.platformMode.value === "app" ? "App" : "Web";
  setStatus("Preferences saved.", "success");
}

function updateExportHint(totalChats) {
  const selectedCount = state.exportSelection.size;
  if (!dom.exportModalHint) return;
  if (!totalChats) {
    dom.exportModalHint.textContent = "No chats available to export.";
    return;
  }
  dom.exportModalHint.textContent =
    selectedCount > 0
      ? `${selectedCount} chat${selectedCount === 1 ? "" : "s"} selected for export.`
      : "No chats selected yet.";
}

function renderExportChatList() {
  if (!dom.exportChatList) return;
  const chats = getLocalChats();
  if (!chats.length) {
    dom.exportChatList.innerHTML = `
      <div class="export-chat-item">
        <div class="export-chat-copy">
          <strong>No chats found</strong>
          <span>Create a conversation first, then return here to export it as PDF.</span>
        </div>
      </div>
    `;
    if (dom.exportSelectAll) {
      dom.exportSelectAll.checked = false;
      dom.exportSelectAll.disabled = true;
    }
    if (dom.confirmExportChatsBtn) {
      dom.confirmExportChatsBtn.disabled = true;
    }
    updateExportHint(0);
    return;
  }

  if (dom.exportSelectAll) {
    dom.exportSelectAll.disabled = false;
    dom.exportSelectAll.checked = state.exportSelection.size === chats.length;
  }
  if (dom.confirmExportChatsBtn) {
    dom.confirmExportChatsBtn.disabled = state.exportSelection.size === 0;
  }

  dom.exportChatList.innerHTML = chats
    .map((chat) => {
      const preview = (chat.messages || [])
        .map((message) => message.content || message.text || "")
        .find(Boolean) || "No messages yet.";
      const count = Array.isArray(chat.messages) ? chat.messages.length : 0;
      const checked = state.exportSelection.has(chat.id) ? "checked" : "";
      return `
        <label class="export-chat-item">
          <input type="checkbox" data-chat-id="${chat.id}" ${checked} />
          <div class="export-chat-copy">
            <strong>${escapeHtml(chat.title || "New Chat")}</strong>
            <span class="export-chat-meta">${count} message${count === 1 ? "" : "s"}</span>
            <span>${escapeHtml(preview.slice(0, 160))}</span>
          </div>
        </label>
      `;
    })
    .join("");

  updateExportHint(chats.length);
}

function openExportChatsModal() {
  clearStatus();
  const chats = getLocalChats();
  state.exportSelection = new Set(chats.map((chat) => chat.id));
  state.exportModalOpen = true;
  dom.exportChatsModal.hidden = false;
  renderExportChatList();
}

function openClearChatsModal() {
  clearStatus();
  state.clearChatsModalOpen = true;
  dom.clearChatsModal.hidden = false;
}

async function ensurePdfLibrary() {
  const jsPDF = window.jspdf?.jsPDF;
  if (!jsPDF) {
    throw new Error("PDF export library is unavailable right now.");
  }
  return jsPDF;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function splitTranscriptParagraphs(doc, text, width) {
  const normalized = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

  if (!normalized) {
    const lines = doc.splitTextToSize("(empty message)", width);
    console.log("TEXT:", "(empty message)");
    console.log("LINES:", lines);
    return [lines];
  }

  return normalized
    .split("\n")
    .map((paragraph) => String(paragraph || "").replace(/\s+/g, " ").trim())
    .filter((paragraph, index, list) => paragraph || (index > 0 && list[index - 1] !== ""))
    .map((paragraph) => {
      const cleanText = paragraph || " ";
      const lines = doc.splitTextToSize(cleanText, width);
      console.log("TEXT:", cleanText);
      console.log("LINES:", lines);
      return lines;
    });
}

async function exportChats() {
  const chats = getLocalChats().filter((chat) => state.exportSelection.has(chat.id));
  if (!chats.length) {
    setStatus("Select at least one chat to export.", "error");
    return;
  }

  setButtonBusy(dom.confirmExportChatsBtn, true, "Generating PDF...");

  try {
    const jsPDF = await ensurePdfLibrary();
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 20;
    const topMargin = 20;
    const bottomMargin = 28;
    const contentWidth = pageWidth - marginX * 2;
    const lineHeight = 7;
    const paragraphGap = 4;
    const messageGap = 10;
    const sectionGap = 20;
    const headerGap = 16;
    const exportDate = new Date().toLocaleDateString();
    let y = topMargin;

    const ensurePageSpace = (heightNeeded = 24) => {
      if (y + heightNeeded <= pageHeight - bottomMargin) return;
      doc.addPage();
      y = topMargin;
      drawDocumentHeader(false);
    };

    const drawDocumentHeader = (drawDivider = false) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.text("Multimodal AI Chat Export", marginX, y);
      y += 16;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(90, 90, 90);
      doc.text(`Date: ${exportDate}`, marginX, y);
      y += headerGap;

      if (drawDivider) {
        doc.setDrawColor(190, 190, 190);
        doc.line(marginX, y, pageWidth - marginX, y);
        y += sectionGap;
      }
    };

    const addTranscriptMessage = (message) => {
      const label = message.role === "assistant" ? "AI:" : "User:";
      const body = String(message.content || message.text || "").trim();
      const paragraphs = splitTranscriptParagraphs(doc, body, contentWidth);

      ensurePageSpace(24);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(0, 0, 0);
      doc.text(label, marginX, y);
      y += 16;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      doc.setTextColor(20, 20, 20);
      paragraphs.forEach((lines) => {
        const paragraphHeight = Math.max(lines.length, 1) * lineHeight;
        ensurePageSpace(Math.max(20, paragraphHeight + paragraphGap + 5));
        doc.text(lines, marginX, y, {
          maxWidth: contentWidth,
          lineHeightFactor: 1.5,
        });
        y += Math.max(lines.length, 1) * 7;
        y += 5;
      });

      y += messageGap;
    };

    drawDocumentHeader(true);

    chats.forEach((chat, chatIndex) => {
      if (chatIndex > 0) {
        ensurePageSpace(sectionGap + 40);
      }

      ensurePageSpace(52);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.text(chat.title || `Chat ${chatIndex + 1}`, marginX, y);
      y += 10;

      doc.setDrawColor(210, 210, 210);
      doc.line(marginX, y, pageWidth - marginX, y);
      y += sectionGap;

      (chat.messages || []).forEach((message) => {
        addTranscriptMessage(message);
      });

      if (!(chat.messages || []).length) {
        ensurePageSpace(18);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(12);
        doc.setTextColor(70, 70, 70);
        doc.text("No messages found in this chat.", marginX, y + 12);
        y += 26;
      }

      y += sectionGap;
    });

    doc.save(`chat-history-${new Date().toISOString().slice(0, 10)}.pdf`);
    closeExportChatsModal();
    setStatus("Chat history exported as PDF.", "success");
  } catch (error) {
    setStatus(error.message || "Could not generate the PDF export.", "error");
  } finally {
    setButtonBusy(dom.confirmExportChatsBtn, false, "Generating PDF...");
  }
}

async function clearChats() {
  try {
    const response = await authorizedFetch(`${API}/api/user/data`, {
      method: "DELETE"
    });

    if (!response.ok && response.status !== 404) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.detail || "Could not clear your cloud chat data.");
    }
  } catch (error) {
    setStatus(error.message || "Could not clear your cloud chat data.", "error");
    return;
  }

  localStorage.setItem(KEYS.chats, "[]");
  localStorage.removeItem(KEYS.currentChatId);
  closeClearChatsModal();
  renderProfile();
  setStatus("Cloud and local chat history cleared.", "success");
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

    existing.messages = [...dedupe.values()].sort(
      (a, b) => new Date(a.timestamp || a.createdAt) - new Date(b.timestamp || b.createdAt)
    );
    existing.title = existing.title === "New Chat" && chat.title ? chat.title : existing.title;
  });
  return [...map.values()];
}

async function syncData() {
  setButtonBusy(dom.syncBtn, true, "Syncing...");
  dom.syncStatus.textContent = "Sync in progress...";
  clearStatus();

  try {
    const localChats = getLocalChats();
    const source = localStorage.getItem(KEYS.platformMode) === "app" ? "app" : "web";
    const upload = await authorizedFetch(`${API}/api/sync/manual`, {
      method: "POST",
      body: JSON.stringify({ source, chats: localChats })
    });

    if (upload.status === 404 || upload.status === 405) {
      throw new Error("Sync is not available currently.");
    }

    const uploadData = await upload.json().catch(() => ({}));
    if (!upload.ok) {
      throw new Error(uploadData.detail || "Sync could not be completed right now.");
    }

    const cloudChats = uploadData.cloud?.chats || [];
    const merged = mergeChats(localChats, cloudChats);
    localStorage.setItem(KEYS.chats, JSON.stringify(merged));
    renderProfile();

    const completeText = `Sync completed successfully at ${new Date().toLocaleTimeString()}`;
    dom.syncStatus.textContent = completeText;
    setStatus(completeText, "success");
  } catch (error) {
    const failText = error.message || "Sync failed due to a network issue.";
    dom.syncStatus.textContent = failText;
    setStatus(failText, "error");
  } finally {
    setButtonBusy(dom.syncBtn, false, "Syncing...");
  }
}

async function saveProfile() {
  clearStatus();
  const nextName = dom.displayNameInput.value.trim();
  const email = dom.profileEmail.value.trim();

  if (nextName.length < 2) {
    setStatus("Name must be at least 2 characters long.", "error");
    return;
  }

  try {
    const user = state.firebaseUser || auth.currentUser;
    if (user) {
      await updateProfile(user, {
        displayName: nextName,
        photoURL: state.profileImageDataUrl || null
      });
      state.firebaseUser = user;
    }

    const storedUser = parseStoredUser();
    const nextUser = {
      ...storedUser,
      name: nextName,
      email,
      provider: storedUser.provider || (state.providerId === "google.com" ? "google" : "password")
    };
    localStorage.setItem(KEYS.user, JSON.stringify(nextUser));
    if (state.profileImageDataUrl) {
      localStorage.setItem(KEYS.profileImage, state.profileImageDataUrl);
    } else {
      localStorage.removeItem(KEYS.profileImage);
    }
    renderProfile();
    setStatus("Profile updated successfully.", "success");
  } catch (error) {
    setStatus(`Unable to save profile: ${error.message}`, "error");
  }
}

function removeProfileImage() {
  state.profileImageDataUrl = "";
  if (dom.profileImageInput) dom.profileImageInput.value = "";
  localStorage.removeItem(KEYS.profileImage);
  renderProfile();
  setStatus("Profile image removed. Initials avatar restored.", "success");
}

function handleProfileImageChange(event) {
  clearStatus();
  const file = event.target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    setStatus("Please upload a valid image file.", "error");
    return;
  }

  if (file.size > 2 * 1024 * 1024) {
    setStatus("Profile image must be 2 MB or smaller.", "error");
    event.target.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    state.profileImageDataUrl = String(reader.result || "");
    localStorage.setItem(KEYS.profileImage, state.profileImageDataUrl);
    renderProfile();
    setStatus("Profile image selected. Save profile to persist the change.", "info");
  };
  reader.onerror = () => {
    setStatus("Could not read the selected image.", "error");
  };
  reader.readAsDataURL(file);
}

async function reauthenticateForDeletion(user) {
  state.providerId = providerIdForSession(user);

  if (state.providerId === "google.com") {
    await reauthenticateWithPopup(user, googleProvider);
    return;
  }

  const currentPassword = dom.deleteAccountPasswordInput?.value || "";
  if (!currentPassword) {
    throw new Error("Enter your current password to delete this account.");
  }

  const credential = EmailAuthProvider.credential(user.email || "", currentPassword);
  await reauthenticateWithCredential(user, credential);
}

async function deleteBackendAccountData() {
  const response = await authorizedFetch(`${API}/api/auth/delete-account`, {
    method: "DELETE"
  });

  if (!response.ok && response.status !== 404) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || "Could not delete server data.");
  }
}

function mapDeleteAccountError(error) {
  switch (error?.code) {
    case "auth/requires-recent-login":
      return "Please reauthenticate and try again.";
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Current password is incorrect.";
    case "auth/popup-closed-by-user":
      return "Reauthentication popup was closed before completion.";
    case "auth/network-request-failed":
      return "Network error while deleting the account. Try again.";
    case "auth/user-not-found":
      return "This account was already removed.";
    default:
      return error?.message || "Account deletion failed.";
  }
}

async function handleDeleteAccount() {
  clearStatus();

  if ((dom.deleteAccountConfirmInput?.value || "").trim().toUpperCase() !== "DELETE") {
    setStatus('Type "DELETE" to confirm account deletion.', "error");
    return;
  }

  const user = auth.currentUser || (await waitForFirebaseUser());
  if (!user) {
    setStatus("User session unavailable. Sign in again before deleting your account.", "error");
    return;
  }

  state.deletingAccount = true;
  setButtonBusy(dom.confirmDeleteAccountBtn, true, "Deleting...");
  setButtonBusy(dom.deleteAccountBtn, true, "Deleting...");

  try {
    await reauthenticateForDeletion(user);
    await deleteBackendAccountData();
    await deleteUser(user);

    clearLocalAccountState();
    closeDeleteAccountModal(true);
    setStatus("Account deleted successfully. Redirecting to sign in...", "success");

    window.setTimeout(() => {
      console.log("🚨 Redirect triggered from:", "frontend/js/settings.js", "Reason:", "delete account success");
      window.location.href = "index.html";
    }, 450);
  } catch (error) {
    setStatus(mapDeleteAccountError(error), "error");
  } finally {
    state.deletingAccount = false;
    setButtonBusy(dom.confirmDeleteAccountBtn, false, "Deleting...");
    setButtonBusy(dom.deleteAccountBtn, false, "Deleting...");
  }
}

async function changePassword() {
  clearStatus();
  const currentPassword = dom.currentPassword.value;
  const newPassword = dom.newPassword.value;
  const confirmPassword = dom.confirmPassword.value;
  const user = state.firebaseUser || auth.currentUser;

  if (!user) {
    setStatus("User session unavailable. Sign in again and retry.", "error");
    return;
  }

  if (state.providerId === "google.com") {
    setStatus("Password change is unavailable for Google-only accounts. Sign in with Google instead.", "info");
    return;
  }

  if (!currentPassword) {
    setStatus("Enter your current password.", "error");
    return;
  }

  if (newPassword.length < 6) {
    setStatus("New password must be at least 6 characters.", "error");
    return;
  }

  if (newPassword !== confirmPassword) {
    setStatus("New password and confirmation do not match.", "error");
    return;
  }

  try {
    const credential = EmailAuthProvider.credential(user.email || "", currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
    dom.currentPassword.value = "";
    dom.newPassword.value = "";
    dom.confirmPassword.value = "";
    setStatus("Password updated successfully.", "success");
  } catch (error) {
    let message = error.message || "Password update failed.";
    if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
      message = "Current password is incorrect.";
    } else if (error.code === "auth/weak-password") {
      message = "Choose a stronger password with at least 6 characters.";
    }
    setStatus(message, "error");
  }
}

async function logout() {
  try {
    await auth?.signOut?.();
  } catch (_error) {
    // Local logout fallback is still valid.
  }
  localStorage.removeItem(KEYS.token);
  localStorage.removeItem(KEYS.user);
  localStorage.removeItem(KEYS.authProvider);
  localStorage.removeItem(KEYS.tokenTimestamp);
  console.log("Redirect triggered from:", "frontend/js/settings.js", "Reason:", "explicit logout");
  window.location.href = "index.html";
}

function bindEvents() {
  dom.profileImageInput.addEventListener("change", handleProfileImageChange);
  dom.removeProfileImageBtn.addEventListener("click", removeProfileImage);
  dom.summaryRemoveProfileImageBtn.addEventListener("click", removeProfileImage);
  dom.saveProfileBtn.addEventListener("click", () => {
    saveProfile().catch((error) => setStatus(error.message, "error"));
  });

  dom.changePasswordBtn.addEventListener("click", () => {
    changePassword().catch((error) => setStatus(error.message, "error"));
  });

  dom.memoryToggle.addEventListener("change", savePreferences);
  dom.platformMode.addEventListener("change", savePreferences);
  dom.exportBtn.addEventListener("click", openExportChatsModal);
  dom.clearBtn.addEventListener("click", openClearChatsModal);
  dom.syncBtn.addEventListener("click", () => {
    syncData().catch((error) => setStatus(error.message, "error"));
  });
  dom.logoutBtn.addEventListener("click", () => {
    logout().catch(() => {
      localStorage.removeItem(KEYS.token);
      localStorage.removeItem(KEYS.user);
      localStorage.removeItem(KEYS.authProvider);
      localStorage.removeItem(KEYS.tokenTimestamp);
      console.log("[settings] logout fallback completed without forced redirect");
    });
  });

  dom.deleteAccountBtn?.addEventListener("click", () => openDeleteAccountModal());
  dom.closeDeleteAccountModalBtn?.addEventListener("click", () => closeDeleteAccountModal());
  dom.cancelDeleteAccountBtn?.addEventListener("click", () => closeDeleteAccountModal());
  dom.deleteAccountBackdrop?.addEventListener("click", () => closeDeleteAccountModal());
  dom.confirmDeleteAccountBtn?.addEventListener("click", () => {
    handleDeleteAccount().catch((error) => setStatus(mapDeleteAccountError(error), "error"));
  });

  dom.closeExportChatsModalBtn?.addEventListener("click", () => closeExportChatsModal());
  dom.cancelExportChatsBtn?.addEventListener("click", () => closeExportChatsModal());
  dom.exportChatsBackdrop?.addEventListener("click", () => closeExportChatsModal());
  dom.confirmExportChatsBtn?.addEventListener("click", () => {
    exportChats().catch((error) => setStatus(error.message || "Export failed.", "error"));
  });
  dom.exportSelectAll?.addEventListener("change", (event) => {
    const chats = getLocalChats();
    state.exportSelection = event.target.checked ? new Set(chats.map((chat) => chat.id)) : new Set();
    renderExportChatList();
  });
  dom.exportChatList?.addEventListener("change", (event) => {
    const checkbox = event.target.closest('input[type="checkbox"][data-chat-id]');
    if (!checkbox) return;
    const chatId = checkbox.dataset.chatId;
    if (!chatId) return;
    if (checkbox.checked) {
      state.exportSelection.add(chatId);
    } else {
      state.exportSelection.delete(chatId);
    }
    renderExportChatList();
  });

  dom.closeClearChatsModalBtn?.addEventListener("click", () => closeClearChatsModal());
  dom.cancelClearChatsBtn?.addEventListener("click", () => closeClearChatsModal());
  dom.clearChatsBackdrop?.addEventListener("click", () => closeClearChatsModal());
  dom.confirmClearChatsBtn?.addEventListener("click", () => {
    clearChats().catch((error) => setStatus(error.message || "Could not clear chat history.", "error"));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.exportModalOpen) {
      closeExportChatsModal();
    }
    if (event.key === "Escape" && state.clearChatsModalOpen) {
      closeClearChatsModal();
    }
    if (event.key === "Escape" && state.deleteModalOpen) {
      closeDeleteAccountModal();
    }
  });
}

async function init() {
  setAuthLoading(true);
  const safeToken = localStorage.getItem("token");

  if (!safeToken) {
    console.log("No token at start, but waiting for recovery...");
  }

  state.token = safeToken || "";

  if (!state.token) {
    console.log(" No token found, delaying redirect for Firebase restore...");

    setTimeout(() => {
      const retryToken = localStorage.getItem("token");

      if (!retryToken) {
        console.log("🚨 Redirect after delay: still no token");
      } else {
        console.log(" Token recovered after delay");
        state.token = retryToken;
      }
    }, 1500);
  }

  // Token is the only auth source for page access during initialization.
  state.firebaseUser = state.token ? { token: state.token } : null;
  getUser();
  loadPreferences();
  renderProfile();
  bindEvents();

  try {
    // Firebase restoration is optional for page access. Do not redirect if it is temporarily null.
    await resolveAuthSession();
    await syncBackendSession();
  } catch (error) {
    console.log("[settings] auth bootstrap failed:", error.message);
    state.token = getToken();
    state.firebaseUser = state.token ? { token: state.token } : null;
  }

  loadPreferences();
  renderProfile();
  setAuthLoading(false);
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((error) => {
    console.log("[settings] init failed:", error?.message || error);
    setAuthLoading(false);
    state.token = getToken();
    state.firebaseUser = state.token ? { token: state.token } : null;
    getUser();
    setStatus("We could not fully verify your session yet, but your local settings remain available.", "info");
  });
});
