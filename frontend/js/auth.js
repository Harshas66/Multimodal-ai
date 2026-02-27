/* ===== MODERN AUTHENTICATION ===== */

import { auth, googleProvider, signInWithPopup } from "./firebase.js";

const API = "http://127.0.0.1:8000";

/* ============================= */
/* PASSWORD TOGGLE FUNCTIONS     */
/* ============================= */

function togglePasswordVisibility() {
  const input = document.getElementById("password");
  if (input) {
    input.type = input.type === "password" ? "text" : "password";
  }
}

function toggleConfirmPasswordVisibility() {
  const input = document.getElementById("confirm-password");
  if (input) {
    input.type = input.type === "password" ? "text" : "password";
  }
}

/* ============================= */
/* LOGIN                         */
/* ============================= */

async function handleLogin(event) {
  event.preventDefault();

  const email = document.getElementById("email")?.value.trim();
  const password = document.getElementById("password")?.value;

  if (!email || !password) {
    alert("Please fill in all fields");
    return;
  }

  showLoader();

  try {
    const response = await fetch(`${API}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      showError("email", data.detail || "Invalid email or password");
      hideLoader();
      return;
    }

    localStorage.setItem("token", data.access_token);
    localStorage.setItem("user", JSON.stringify(data.user));

    window.location.href = "chat.html";

  } catch (error) {
    console.error("Login error:", error);
    showError("email", "Connection error. Please try again.");
    hideLoader();
  }
}

/* ============================= */
/* SIGNUP                        */
/* ============================= */

async function handleSignup(event) {
  event.preventDefault();

  const name = document.getElementById("name")?.value.trim();
  const email = document.getElementById("email")?.value.trim();
  const password = document.getElementById("password")?.value;
  const confirmPassword = document.getElementById("confirm-password")?.value;

  if (!name || !email || !password || !confirmPassword) {
    alert("Please fill in all fields");
    return;
  }

  if (password.length < 8) {
    showError("password", "Password must be at least 8 characters");
    return;
  }

  if (password !== confirmPassword) {
    showError("confirm", "Passwords do not match");
    return;
  }

  showLoader();

  try {
    const response = await fetch(`${API}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      showError("email", data.detail || "Signup failed");
      hideLoader();
      return;
    }

    alert("Account created successfully!");
    window.location.href = "index.html";

  } catch (error) {
    console.error("Signup error:", error);
    showError("email", "Connection error. Please try again.");
    hideLoader();
  }
}

/* ============================= */
/* GOOGLE AUTH                   */
/* ============================= */

async function handleGoogleLogin() {
  try {
    const result = await signInWithPopup(auth, googleProvider);

    localStorage.setItem("token", result.user.accessToken);
    localStorage.setItem("user", JSON.stringify({
      email: result.user.email,
      name: result.user.displayName
    }));

    window.location.href = "chat.html";

  } catch (error) {
    console.error("Google login error:", error);
    alert(error.message);
  }
}

async function handleGoogleSignup() {
  await handleGoogleLogin();
}

/* ============================= */
/* FORGOT PASSWORD               */
/* ============================= */

async function handleForgotPassword(event) {
  event.preventDefault();

  const email = document.getElementById("email")?.value.trim();

  if (!email) {
    alert("Please enter your email address");
    return;
  }

  try {
    const response = await fetch(`${API}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });

    if (response.ok) {
      alert("Password reset link sent to your email");
    } else {
      alert("Email not found");
    }

  } catch (error) {
    console.error("Forgot password error:", error);
    alert("Connection error. Please try again.");
  }
}

/* ============================= */
/* HELPER FUNCTIONS              */
/* ============================= */

function showLoader() {
  const loader = document.getElementById("loadingSpinner");
  if (loader) loader.style.display = "flex";
}

function hideLoader() {
  const loader = document.getElementById("loadingSpinner");
  if (loader) loader.style.display = "none";
}

function showError(fieldId, message) {
  const errorEl = document.getElementById(`${fieldId}Error`);
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.add("show");
  }
}

function clearError(fieldId) {
  const errorEl = document.getElementById(`${fieldId}Error`);
  if (errorEl) {
    errorEl.textContent = "";
    errorEl.classList.remove("show");
  }
}

/* ============================= */
/* MAKE FUNCTIONS GLOBAL         */
/* ============================= */

window.handleLogin = handleLogin;
window.handleSignup = handleSignup;
window.handleGoogleLogin = handleGoogleLogin;
window.handleGoogleSignup = handleGoogleSignup;
window.handleForgotPassword = handleForgotPassword;
window.togglePasswordVisibility = togglePasswordVisibility;
window.toggleConfirmPasswordVisibility = toggleConfirmPasswordVisibility;