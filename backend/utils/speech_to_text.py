#backend/utils/speech_to_text.py
import streamlit as st
import sounddevice as sd
from scipy.io.wavfile import write
import tempfile
import os
import numpy as np
import speech_recognition as sr

def listen_once(timeout=5):
    """
    Records a short audio clip from the microphone using sounddevice
    and converts it to text using SpeechRecognition.
    No PyAudio dependency required.
    """
    fs = 44100  # sample rate
    seconds = timeout

    st.info("🎤 Listening... please speak now")
    try:
        # record audio
        recording = sd.rec(int(seconds * fs), samplerate=fs, channels=1, dtype='int16')
        sd.wait()

        # temporary WAV file
        temp_path = tempfile.mktemp(prefix="input_", suffix=".wav", dir=".")
        write(temp_path, fs, recording)

        # use speech recognition
        recognizer = sr.Recognizer()
        with sr.AudioFile(temp_path) as source:
            audio_data = recognizer.record(source)
            try:
                text = recognizer.recognize_google(audio_data)
                return text
            except sr.UnknownValueError:
                return "⚠️ Sorry, I could not understand what you said."
            except sr.RequestError:
                return "⚠️ Speech recognition service unavailable."

    except Exception as e:
        return f"⚠️ Microphone error: {e}"

    finally:
        # cleanup
        try:
            if os.path.exists(temp_path):
                os.remove(temp_path)
        except Exception:
            pass
