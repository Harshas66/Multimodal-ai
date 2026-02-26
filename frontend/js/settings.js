/*frontend/js/settings.js*/
const API = "http://127.0.0.1:8000";

/* ================= THEME ================= */
function toggleTheme() {
  document.body.classList.toggle("light-theme");
  localStorage.setItem(
    "theme",
    document.body.classList.contains("light-theme") ? "light" : "dark"
  );
}

/* ================= LANGUAGE ================= */
function changeLanguage(lang) {
  localStorage.setItem("language", lang);
  alert(`Language set to ${lang.toUpperCase()}`);
}

/* ================= ARCHIVE CHATS ================= */
function archiveChats() {
  let chats = JSON.parse(localStorage.getItem("chats") || "[]");

  const activeChats = chats.filter(c => !c.archived);
  if (!activeChats.length) {
    alert("No active chats to archive");
    return;
  }

  activeChats.forEach(chat => {
    chat.archived = true;
  });

  localStorage.setItem("chats", JSON.stringify(chats));
  alert("All active chats archived");
}


/* ================= CLEAR PERSONAL INFO ================= */
async function clearPersonalInfo() {
  if (!confirm("Clear stored personal info?")) return;

  try {
    const res = await fetch(`${API}/user/clear-personal-info`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${localStorage.getItem("token") || ""}`,
        "Content-Type": "application/json"
      }
    });

    if (!res.ok) {
      const data = await res.json();
      alert(data.detail || "Failed to clear personal info");
      return;
    }

    alert("Personal info cleared successfully");

  } catch (err) {
    console.error(err);
    alert("Server error while clearing personal info");
  }
}

/* ================= DELETE ACCOUNT ================= */
async function deleteAccount() {
  if (!confirm("This will permanently delete your account. Continue?")) return;

  const token = localStorage.getItem("token");

  const res = await fetch(`${API}/api/auth/delete-account`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    alert("Account deletion failed");
    return;
  }

  localStorage.clear();
  alert("Account deleted");
  window.location.href = "index.html";
}







/* ================= LOGOUT ================= */
function logout() {
  localStorage.clear();
  window.location.href = "index.html";
}

/* ================= INIT ================= */
if (localStorage.getItem("theme") === "light") {
  document.body.classList.add("light-theme");
}
