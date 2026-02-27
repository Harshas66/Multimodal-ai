from backend.utils.env_loader import load_env
load_env()  # ensures all API keys load globally


import streamlit as st
import os, base64, datetime, getpass, sounddevice as sd, time
from backend.agents.head_agent import HeadAgent
from memory.memory_manager import MemoryManager
from backend.utils.speech_to_text import listen_once

# ---------------------------------------------------------
# 🌐 PAGE CONFIG
# ---------------------------------------------------------
st.set_page_config(page_title="Multimodal AI Assistant", layout="wide")

# ---------------------------------------------------------
# 🧠 SESSION STATE INIT
# ---------------------------------------------------------
if "agent" not in st.session_state:
    st.session_state.agent = HeadAgent()
if "memory" not in st.session_state:
    st.session_state.memory = MemoryManager()
if "chat" not in st.session_state:
    st.session_state.chat = []
if "typing" not in st.session_state:
    st.session_state.typing = False

# ---------------------------------------------------------
# 🌄 GREETING + USERNAME
# ---------------------------------------------------------
hour = datetime.datetime.now().hour
greeting = "Good morning" if hour < 12 else "Good afternoon" if hour < 17 else "Good evening"
username = getpass.getuser().capitalize()

# ---------------------------------------------------------
# 🖼️ LOGO
# ---------------------------------------------------------
logo_path = os.path.join("assets", "logo.svg")
if os.path.exists(logo_path):
    with open(logo_path, "rb") as f:
        logo_base64 = base64.b64encode(f.read()).decode("utf-8")
    logo_html = f"<img src='data:image/svg+xml;base64,{logo_base64}' class='logo-glow'>"
else:
    logo_html = "<div style='color:#FF5555;font-weight:bold;'>⚠️ Logo not found</div>"

# ---------------------------------------------------------
# 🌈 MODERN GLASS UI FIXED VERSION (Perfectly Centered)
# ---------------------------------------------------------
st.markdown(f"""
<style>
/* ===== GLOBAL RESET ===== */
html, body, [data-testid="stAppViewContainer"] {{
    background: radial-gradient(circle at 10% 10%, #0A0A1A 0%, #12123B 100%);
    color: #EAF6FF;
    font-family: 'Inter', 'Segoe UI', sans-serif;
    overflow: hidden !important;
    margin: 0;
    padding: 0;
}}
* {{
    box-sizing: border-box;
}}
::selection {{
    background: #00FFFF99;
    color: #000;
}}

/* ===== HEADER ===== */
.header {{
    position: fixed;
    top: 25px;
    left: 50%;
    transform: translateX(-50%);
    text-align: center;
    z-index: 100;
}}
.logo-glow {{
    height: 80px;
    filter: drop-shadow(0 0 35px #00FFFF);
    animation: floatLogo 4s ease-in-out infinite;
    display: block;
    margin: 0 auto 8px auto;
}}
@keyframes floatLogo {{
    0%, 100% {{ transform: translateY(0px); }}
    50% {{ transform: translateY(-6px); }}
}}
.header h1 {{
    color: #E9FAFF;
    font-size: 26px;
    font-weight: 700;
    margin-bottom: 3px;
    text-shadow: 0 0 20px #00FFFF80;
}}
.header h2 {{
    color: #B0C4DE;
    font-size: 14px;
    font-weight: 400;
    margin-top: 0;
    letter-spacing: 1px;
}}

/* ===== CHAT CONTAINER ===== */
.chat-container {{
    position: absolute;
    top: 160px;
    bottom: 110px;
    left: 50%;
    transform: translateX(-50%);
    width: 78%;
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.05);
    box-shadow: 0 0 25px rgba(0,255,255,0.15);
    padding: 25px 30px;
    overflow-y: auto;
    overflow-x: hidden;
    scroll-behavior: smooth;
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255,255,255,0.08);
}}
.chat-container::-webkit-scrollbar {{
    width: 8px;
}}
.chat-container::-webkit-scrollbar-thumb {{
    background: linear-gradient(180deg, #00FFFF80, #00BFFF50);
    border-radius: 4px;
}}

/* ===== MESSAGES ===== */
.user-msg, .assistant-msg {{
    padding: 14px 20px;
    border-radius: 20px;
    margin: 12px 0;
    font-size: 16px;
    line-height: 1.6;
    animation: fadeIn 0.4s ease;
    word-wrap: break-word;
}}
.user-msg {{
    background: linear-gradient(90deg, #00BFFF, #00FFFF);
    color: #0A0A1A;
    margin-left: auto;
    width: fit-content;
    max-width: 70%;
    box-shadow: 0 0 20px rgba(0,255,255,0.3);
}}
.assistant-msg {{
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(0,255,255,0.25);
    color: #EAF6FF;
    width: fit-content;
    max-width: 85%;
    backdrop-filter: blur(6px);
}}
@keyframes fadeIn {{
    from {{ opacity: 0; transform: translateY(8px); }}
    to {{ opacity: 1; transform: translateY(0); }}
}}

/* ===== INPUT BAR ===== */
.input-bar {{
    position: fixed;
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%);
    width: 60%;
    background: rgba(255,255,255,0.08);
    border-radius: 40px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 18px;
    backdrop-filter: blur(12px);
    box-shadow: 0 0 25px rgba(0,255,255,0.25);
}}
.input-bar input {{
    flex: 1;
    background: transparent;
    border: none;
    color: white;
    font-size: 16px;
    outline: none;
}}
.input-bar button {{
    background: linear-gradient(90deg, #00FFFF, #00BFFF);
    border: none;
    border-radius: 25px;
    padding: 8px 20px;
    font-weight: 600;
    color: #0A0A1A;
    cursor: pointer;
    transition: 0.3s ease;
}}
.input-bar button:hover {{
    transform: scale(1.05);
    box-shadow: 0 0 12px #00FFFF;
}}

/* ===== FOOTER ===== */
.footer {{
    position: fixed;
    bottom: 6px;
    left: 50%;
    transform: translateX(-50%);
    text-align: center;
    color: #A0B4D8;
    font-size: 13px;
    letter-spacing: 0.5px;
    width: 100%;
}}
</style>

<div class="header">
    {logo_html}
    <h1>{greeting}, {username} 👋</h1>
    <h2>Memory • Context • Intelligence</h2>
</div>
""", unsafe_allow_html=True)

# ---------------------------------------------------------
# 🧠 SIDEBAR MEMORY
# ---------------------------------------------------------
st.sidebar.markdown("### 🧠 Conversation Memory")
if st.session_state.chat:
    for q, a in st.session_state.chat[-5:]:
        if q == "You":
            st.sidebar.markdown(f"**🧍 You:** {a}")
        else:
            st.sidebar.markdown(f"**🤖 {q}:** {a}")
else:
    st.sidebar.info("No memory yet.")

st.sidebar.markdown("### ⚙️ Model")
st.sidebar.success(st.session_state.agent.get_active_model())

try:
    mic_available = len(sd.query_devices()) > 0
except Exception:
    mic_available = False
st.sidebar.info("🎙️ Microphone Detected" if mic_available else "🚫 No Microphone")

# ---------------------------------------------------------
# 💬 CHAT AREA (scrollable)
# ---------------------------------------------------------
st.markdown('<div class="chat-container">', unsafe_allow_html=True)
for speaker, msg in st.session_state.chat[-20:]:
    role_class = "user-msg" if speaker == "You" else "assistant-msg"
    st.markdown(f"<div class='{role_class}'><strong>{speaker}:</strong><br>{msg}</div>", unsafe_allow_html=True)
st.markdown('</div>', unsafe_allow_html=True)

# ---------------------------------------------------------
# 🧠 FIXED INPUT BAR
# ---------------------------------------------------------
st.markdown('<div class="input-bar">', unsafe_allow_html=True)
user_input = st.text_input("Ask me anything...", placeholder="Type your question and press Enter", label_visibility="collapsed", key="query_box")
col1, col2 = st.columns([0.15, 0.85])
with col1:
    speak_btn = st.button("🎤", use_container_width=True)
with col2:
    send_btn = st.button("Send", use_container_width=True)
st.markdown('</div>', unsafe_allow_html=True)

# ---------------------------------------------------------
# 🎙️ VOICE INPUT (also triggers AI response)
# ---------------------------------------------------------
if mic_available and speak_btn:
    st.info("🎧 Listening...")
    text = listen_once(timeout=6)
    if text and not text.startswith("⚠️"):
        st.success(f"You said: {text}")
        user_input = text
        send_btn = True
    else:
        st.warning("No speech detected.")

# ---------------------------------------------------------
# 🤖 HANDLE QUERY (with typing effect + memory)
# ---------------------------------------------------------
if send_btn and user_input.strip():
    st.session_state.chat.append(("You", user_input))
    with st.spinner("🤖 Thinking..."):
        head = st.session_state.agent
        response, agent_name = head.handle(user_input, "English", st.session_state.memory.get_context())

        # Typing animation effect
        displayed_text = ""
        message_placeholder = st.empty()
        for char in response:
            displayed_text += char
            message_placeholder.markdown(f"<div class='assistant-msg'><strong>{agent_name}:</strong><br>{displayed_text}▌</div>", unsafe_allow_html=True)
            time.sleep(0.015)
        message_placeholder.markdown(f"<div class='assistant-msg'><strong>{agent_name}:</strong><br>{response}</div>", unsafe_allow_html=True)

        # Add to memory + session
        st.session_state.memory.add(user_input, response)
        st.session_state.chat.append((agent_name, response))
    st.rerun()

# ---------------------------------------------------------
# 🌟 FOOTER
# ---------------------------------------------------------
st.markdown("<div class='footer'>Multimodal Copilot • Memory Powered • Hugging Face LLaMA 3.1 © 2025</div>", unsafe_allow_html=True)