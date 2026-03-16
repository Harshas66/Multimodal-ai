import { auth, googleProvider, signInWithPopup } from "./firebase.js";

/* ---------------- API URL DETECTION ---------------- */

const API = (() => {

  if (window.API_ENDPOINT) return window.API_ENDPOINT;

  const stored = localStorage.getItem("apiEndpoint");
  if (stored) return stored;

  if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    return "http://127.0.0.1:8000";
  }

  return window.location.origin;

})();

/* ---------------- GOOGLE AUTH ---------------- */

async function authenticateWithGoogle() {

  showLoader();

  try {

    console.log("Starting Google authentication...");

    if (!auth) {
      throw new Error("Firebase authentication not initialized.");
    }
    
    console.log("Opening Google popup...");
    const result = await signInWithPopup(auth, googleProvider);

    const user = result.user;

    if (!user) {
      throw new Error("Google authentication failed.");
    }

    const token = await user.getIdToken();

    /* ---------- STORE AUTH DATA ---------- */

    localStorage.setItem("token", token);

    localStorage.setItem(
      "user",
      JSON.stringify({
        id: user.uid,
        name: user.displayName || "",
        email: user.email || "",
        provider: "google"
      })
    );

    localStorage.setItem("authProvider", "google");

    /* ---------- BACKEND AUTH ---------- */

    const response = await fetch(`${API}/api/auth/google`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ id_token: token })
    });

    if (!response.ok) {

      const data = await response.json().catch(() => ({}));

      console.error("Backend authentication error:", data);

      throw new Error(data.detail || "Backend authentication failed");

    }

    console.log("Authentication successful");

    /* ---------- REDIRECT ---------- */

    window.location.href = "chat.html";

  } catch (error) {

    console.error("Google Auth Error:", error);

    alert(error.message || "Unable to continue with Google");

  } finally {

    hideLoader();

  }

}

/* ---------------- LOADER ---------------- */

function showLoader() {

  const loader = document.getElementById("loadingSpinner");

  if (loader) loader.style.display = "flex";

}

function hideLoader() {

  const loader = document.getElementById("loadingSpinner");

  if (loader) loader.style.display = "none";

}

/**/
document.addEventListener("DOMContentLoaded", () => {

  const googleButtons = document.querySelectorAll("#googleLoginBtn");

  googleButtons.forEach(btn => {
    btn.addEventListener("click", authenticateWithGoogle);
  });

});
