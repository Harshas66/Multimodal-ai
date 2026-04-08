import {
  auth,
  googleProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset
} from "./firebase.js?v=3.3";

const API = (() => {
  if (window.API_ENDPOINT) return window.API_ENDPOINT;
  const stored = localStorage.getItem("apiEndpoint");
  if (stored) return stored;
  if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    return "http://127.0.0.1:8000";
  }
  return window.location.origin;
})();

const dom = {
  authStatus: document.getElementById("authStatus"),
  loginBtn: document.getElementById("loginBtn"),
  signupBtn: document.getElementById("signupBtn"),
  googleLoginBtn: document.getElementById("googleLoginBtn"),
  googleSignupBtn: document.getElementById("googleSignupBtn"),
  email: document.getElementById("email"),
  password: document.getElementById("password"),
  name: document.getElementById("name"),
  resetPasswordLink: document.getElementById("resetPasswordLink"),
  resetEmail: document.getElementById("resetEmail"),
  sendResetBtn: document.getElementById("sendResetBtn"),
  resetIntro: document.getElementById("resetIntro"),
  resetPasswordForm: document.getElementById("resetPasswordForm"),
  newPassword: document.getElementById("newPassword"),
  confirmPassword: document.getElementById("confirmPassword"),
  confirmResetBtn: document.getElementById("confirmResetBtn"),
  resetSuccessState: document.getElementById("resetSuccessState")
};

let currentResetCode = "";

function injectLoaderStyles() {
  if (document.getElementById("auth-loader-styles")) return;
  const style = document.createElement("style");
  style.id = "auth-loader-styles";
  style.textContent = `
    @keyframes authSpin { to { transform: rotate(360deg); } }
    @keyframes authFadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes authFadeOut { from { opacity: 1; } to { opacity: 0; } }
  `;
  document.head.appendChild(style);
}

function showLoader(label = "Working...", detail = "Please wait...") {
  injectLoaderStyles();

  let loader = document.getElementById("loadingSpinner");
  if (!loader) {
    loader = document.createElement("div");
    loader.id = "loadingSpinner";
    loader.style.cssText = [
      "position: fixed",
      "inset: 0",
      "background: rgba(6,17,31,0.82)",
      "backdrop-filter: blur(18px)",
      "z-index: 9999",
      "display: flex",
      "align-items: center",
      "justify-content: center",
      "animation: authFadeIn 0.25s ease"
    ].join(";");
    document.body.appendChild(loader);
  }

  loader.innerHTML = `
    <div style="
      width:min(92vw, 320px);
      padding:28px;
      border-radius:24px;
      border:1px solid rgba(168,210,255,0.16);
      background:rgba(11,21,40,0.82);
      color:#f4f8ff;
      text-align:center;
      box-shadow:0 24px 80px rgba(0,0,0,0.38);
      ">
      <div style="
        width:56px;height:56px;margin:0 auto 18px;
        border:4px solid rgba(98,215,255,0.18);
        border-top-color:#62d7ff;
        border-radius:999px;
        animation: authSpin 0.9s linear infinite;"></div>
      <div style="font-weight:800;font-size:16px;">${label}</div>
      <div style="margin-top:8px;color:rgba(220,233,255,0.72);font-size:14px;line-height:1.5;">${detail}</div>
    </div>
  `;
  loader.style.display = "flex";
}

function hideLoader() {
  const loader = document.getElementById("loadingSpinner");
  if (!loader) return;
  loader.style.animation = "authFadeOut 0.2s ease";
  setTimeout(() => loader.remove(), 200);
}

function setStatus(message, type = "info") {
  if (!dom.authStatus) return;
  dom.authStatus.hidden = false;
  dom.authStatus.className = `auth-status is-${type}`;
  dom.authStatus.textContent = message;
}

function clearStatus() {
  if (!dom.authStatus) return;
  dom.authStatus.hidden = true;
  dom.authStatus.className = "auth-status";
  dom.authStatus.textContent = "";
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function mapFirebaseError(error) {
  switch (error?.code) {
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/user-not-found":
      return "No account was found for that email address.";
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "The email or password is incorrect.";
    case "auth/email-already-in-use":
      return "An account with that email already exists.";
    case "auth/weak-password":
      return "Choose a stronger password with at least 6 characters.";
    case "auth/expired-action-code":
      return "This reset link has expired. Request a new one.";
    case "auth/invalid-action-code":
      return "This reset link is invalid or has already been used.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    case "auth/popup-closed-by-user":
      return "Popup closed. Please try again.";
    default:
      return error?.message || "Something went wrong. Please try again.";
  }
}

async function persistUserSession(user, provider = "password") {
  const token = await user.getIdToken(true);
  localStorage.setItem("token", token);
  localStorage.setItem("token_timestamp", Date.now().toString());
  localStorage.setItem("authProvider", provider);
  localStorage.setItem(
    "user",
    JSON.stringify({
      id: user.uid,
      name: user.displayName || user.email?.split("@")[0] || "User",
      email: user.email || "",
      photoURL: user.photoURL || "",
      provider
    })
  );
}

async function syncBackendSession(user, provider = "password") {
  const token = localStorage.getItem("token");
  if (!token || !user) return;

  try {
    await fetch(`${API}/api/auth/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        name: user.displayName || user.email?.split("@")[0] || "User",
        email: user.email || "",
        provider
      })
    });
  } catch (_error) {
    // The frontend can continue using local session state as a fallback.
  }
}

async function authenticateWithGoogle() {
  showLoader("Authenticating", "Opening Google sign-in...");

  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    if (!user) throw new Error("No user returned from Google.");

    await persistUserSession(user, "google");
    await syncBackendSession(user, "google");

    try {
      await fetch(`${API}/api/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_token: localStorage.getItem("token") })
      });
    } catch (_error) {
      // Firebase auth remains valid even if backend sync is unavailable.
    }

    hideLoader();
    console.log("🚨 Redirect triggered from:", "frontend/js/auth.js", "Reason:", "google sign-in success");
    window.location.href = "/chat.html";
  } catch (error) {
    hideLoader();
    setStatus(mapFirebaseError(error), "error");
  }
}

async function handleEmailLogin() {
  clearStatus();
  const email = dom.email?.value?.trim() || "";
  const password = dom.password?.value || "";

  if (!validateEmail(email)) {
    setStatus("Enter a valid email address.", "error");
    return;
  }
  if (!password) {
    setStatus("Enter your password to continue.", "error");
    return;
  }

  showLoader("Signing in", "Verifying your credentials...");
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    await persistUserSession(result.user, "password");
    await syncBackendSession(result.user, "password");
    hideLoader();
    console.log("🚨 Redirect triggered from:", "frontend/js/auth.js", "Reason:", "email login success");
    window.location.href = "/chat.html";
  } catch (error) {
    hideLoader();
    setStatus(mapFirebaseError(error), "error");
  }
}

async function handleEmailSignup() {
  clearStatus();
  const name = dom.name?.value?.trim() || "";
  const email = dom.email?.value?.trim() || "";
  const password = dom.password?.value || "";

  if (!name) {
    setStatus("Enter your full name to create an account.", "error");
    return;
  }
  if (!validateEmail(email)) {
    setStatus("Enter a valid email address.", "error");
    return;
  }
  if (password.length < 6) {
    setStatus("Choose a password with at least 6 characters.", "error");
    return;
  }

  showLoader("Creating account", "Setting up your workspace...");
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    if (name) {
      await updateProfile(result.user, { displayName: name });
    }
    await persistUserSession(result.user, "password");
    await syncBackendSession(result.user, "password");
    hideLoader();
    console.log("🚨 Redirect triggered from:", "frontend/js/auth.js", "Reason:", "signup success");
    window.location.href = "/chat.html";
  } catch (error) {
    hideLoader();
    setStatus(mapFirebaseError(error), "error");
  }
}

async function handleSendResetLink() {
  clearStatus();
  const email = dom.resetEmail?.value?.trim() || "";
  if (!validateEmail(email)) {
    setStatus("Enter a valid email address.", "error");
    return;
  }

  const resetUrl = new URL("/reset-password.html", window.location.origin).toString();
  showLoader("Sending reset link", "Preparing a secure email to your inbox...");

  try {
    await sendPasswordResetEmail(auth, email, {
      url: resetUrl,
      handleCodeInApp: true
    });
    hideLoader();
    setStatus("Password reset link sent to your email. Check your inbox and spam folder.", "success");
  } catch (error) {
    hideLoader();
    setStatus(mapFirebaseError(error), "error");
  }
}

function getActionCodeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return {
    mode: params.get("mode") || "",
    oobCode: params.get("oobCode") || "",
    continueUrl: params.get("continueUrl") || ""
  };
}

async function initializeResetPage() {
  if (!dom.resetPasswordForm || !dom.resetIntro) return;

  clearStatus();
  const { mode, oobCode } = getActionCodeFromUrl();
  currentResetCode = oobCode;

  if (!oobCode || (mode && mode !== "resetPassword")) {
    dom.resetIntro.textContent = "This reset link is incomplete or invalid.";
    setStatus("This reset link is invalid. Request a new password reset email.", "error");
    return;
  }

  showLoader("Verifying link", "Checking that your reset link is still valid...");
  try {
    const email = await verifyPasswordResetCode(auth, oobCode);
    hideLoader();
    dom.resetIntro.textContent = `Resetting password for ${email}. Enter your new password below.`;
    dom.resetPasswordForm.hidden = false;
    setStatus("Reset link verified. Choose your new password.", "info");
  } catch (error) {
    hideLoader();
    dom.resetIntro.textContent = "We couldn’t verify your reset link.";
    setStatus(mapFirebaseError(error), "error");
  }
}

async function handleConfirmReset() {
  clearStatus();
  const newPassword = dom.newPassword?.value || "";
  const confirmPassword = dom.confirmPassword?.value || "";

  if (!currentResetCode) {
    setStatus("Reset token missing. Request a new password reset email.", "error");
    return;
  }
  if (newPassword.length < 6) {
    setStatus("Choose a password with at least 6 characters.", "error");
    return;
  }
  if (newPassword !== confirmPassword) {
    setStatus("Passwords do not match. Check both fields and try again.", "error");
    return;
  }

  showLoader("Updating password", "Saving your new password securely...");
  try {
    await confirmPasswordReset(auth, currentResetCode, newPassword);
    hideLoader();
    if (dom.resetPasswordForm) dom.resetPasswordForm.hidden = true;
    if (dom.resetSuccessState) dom.resetSuccessState.hidden = false;
    setStatus("Password updated successfully. You can now sign in with your new password.", "success");
    setTimeout(() => {
      console.log("🚨 Redirect triggered from:", "frontend/js/auth.js", "Reason:", "password reset success");
      window.location.href = "/index.html?reset=success";
    }, 1800);
  } catch (error) {
    hideLoader();
    setStatus(mapFirebaseError(error), "error");
  }
}

function bindGoogleButtons() {
  [dom.googleLoginBtn, dom.googleSignupBtn].forEach((button) => {
    button?.addEventListener("click", (event) => {
      event.preventDefault();
      authenticateWithGoogle();
    });
  });
}

function bindKeyboardShortcuts() {
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const activeId = document.activeElement?.id || "";

    if (activeId === "password" && dom.loginBtn) {
      event.preventDefault();
      handleEmailLogin();
    } else if (activeId === "password" && dom.signupBtn) {
      event.preventDefault();
      handleEmailSignup();
    } else if (activeId === "resetEmail" && dom.sendResetBtn) {
      event.preventDefault();
      handleSendResetLink();
    } else if ((activeId === "newPassword" || activeId === "confirmPassword") && dom.confirmResetBtn) {
      event.preventDefault();
      handleConfirmReset();
    }
  });
}

function handleLoginStatusFromQuery() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("reset") === "success") {
    setStatus("Password reset complete. Sign in with your new password.", "success");
  }
}

function bindPageHandlers() {
  dom.loginBtn?.addEventListener("click", handleEmailLogin);
  dom.signupBtn?.addEventListener("click", handleEmailSignup);
  dom.sendResetBtn?.addEventListener("click", handleSendResetLink);
  dom.confirmResetBtn?.addEventListener("click", handleConfirmReset);
}

document.addEventListener("DOMContentLoaded", () => {
  bindGoogleButtons();
  bindPageHandlers();
  bindKeyboardShortcuts();
  handleLoginStatusFromQuery();
  initializeResetPage().catch((error) => {
    setStatus(mapFirebaseError(error), "error");
  });
});

window.authenticateWithGoogle = authenticateWithGoogle;
window.googleLogin = authenticateWithGoogle;
