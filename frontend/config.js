// frontend/config.js
// ============================================================
// 🔧 PRODUCTION CONFIG — Render backend URL
// ============================================================
// ✅ Replace the URL below with your actual Render service URL
// Example: "https://multimodal-ai-backend.onrender.com"
// For local dev, set to "" or "http://127.0.0.1:8000"
// ============================================================

// ── CHANGE THIS to your Render service URL after deploying ──
window.API_ENDPOINT = "https://multimodal-ai-backend.onrender.com";

// Alias used by chat.js (window.API_BASE) and auth.js (window.API_ENDPOINT)
window.API_BASE = window.API_ENDPOINT;
