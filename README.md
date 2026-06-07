# J.A.R.V.I.S. Voice Assistant

JARVIS is a voice-first, highly responsive digital virtual assistant modeled after Tony Stark's iconic HUD dashboard. It uses native web technologies (HTML5, JavaScript, Vanilla CSS, Web Speech APIs, Web Audio API) combined with **Gemini AI** for high-quality conversational capabilities.

## Features
- **Wake Word Listening**: Continuously monitors audio inputs for "Hey Jarvis" or "Jarvis" ("ஜார்விஸ்" / "ஹே ஜார்விஸ்" in Tamil).
- **Stark Arc Reactor Core**: Features an animated, glowing CSS reactor that rotates and pulses dynamically based on state (`STANDBY`, `LISTENING`, `THINKING`, `SPEAKING`).
- **Live Frequency Waveform**: Employs Web Audio API `AnalyserNode` to render live mic input waveforms on a canvas.
- **Dynamic Sound Synthesizer**: Uses mathematical synth oscillators (frequencies between 100Hz and 900Hz) to create futuristic sound effects (wake beep, error alert, success chime, alarm siren) on-the-fly.
- **Cognitive Gemini Core**: Interacts with the Gemini API and remembers recent message histories (last 10 turns) for contextual responses.
- **Local Utilities (Offline Fallbacks)**:
  - **Weather Core**: Automatically performs IP-geolocation lookup and contacts the Open-Meteo API (keyless) for current temperature.
  - **News Data**: Gathers daily technology news from a news JSON repository.
  - **Reminders & Alarms**: Triggers browser push notifications, schedules alarms, and speaks aloud when countdown alerts expire.
  - **To-Do Task Logs**: Adds, completes, and clears task lists stored in `localStorage`.
  - **Math Calculator**: Parses spoken math instructions (e.g. "what is 45 plus 15", "100 divided by 5").
  - **App Shortcuts**: Opens popular websites ("open YouTube", "open Gmail", etc.) in separate tabs.

---

## Getting Started

### 1. Requirements & Setup
Because of security restrictions in browsers, the **Web Speech Recognition API** requires a secure context (`https://`) or `http://localhost`.

You can serve the project using any simple HTTP server:
```bash
# Option A: Using Python (Recommended)
python -m http.server 8000

# Option B: Using Node.js (with live-server or http-server)
npx live-server
```

Open `http://localhost:8000` (or `http://127.0.0.1:8000`) in **Google Chrome** or **Microsoft Edge**.

### 2. Grant Microphone Access
When the page loads, click the **Arc Reactor** core to prompt the browser to request microphone permissions. Once approved, the status monitor will display **MIC: ONLINE**.

### 3. Insert Gemini API Key
For advanced generative conversations, click the **Settings** icon (⚙️) in the top-right corner, paste your **Gemini API Key**, and click **APPLY CONFIGURATION**. JARVIS will save the key securely in local storage and switch to Gemini's cognitive response engine.

---

## Local Voice Commands Examples

### English
- **Wake Word**: `"Hey Jarvis"` (wait for wake beep and reactor state change to LISTENING)
- **Weather query**: `"What is the weather?"` or `"Is it raining?"`
- **Time/Date**: `"What is the time?"` or `"Tell me the date today"`
- **Calculations**: `"What is 150 multiplied by 5?"`
- **Set Alerts**: `"Set alarm for 10 seconds to drink water"` or `"Remind me in 5 seconds to stand up"`
- **To-Dos**: `"Add task write documentation"` or `"Add to-do buy milk"`
- **Open Sites**: `"Open YouTube"` or `"Open GitHub"`
- **Read News**: `"What is the news?"` or `"Tell me news headlines"`
- **Stop Siren**: Say `"Stop"` or click the Arc Reactor to silence a firing alarm.

### Tamil (தமிழ்)
- **Wake Word**: `"ஜார்விஸ்"` (அல்லது `"ஹே ஜார்விஸ்"`)
- **Time**: `"மணி என்ன?"`
- **Date**: `"தேதி என்ன?"`
- **Weather**: `"வானிலை எப்படி உள்ளது?"`
- **Set Alerts**: `"10 விநாடியில் அலாரம் வைக்கவும்"`
- **To-Dos**: `"வேலை சேர்க்க காய்கறிகள் வாங்கவும்"`
- **Open Sites**: `"யூடியூப் திற"`
- **Stop Siren**: Say `"நிறுத்து"`
