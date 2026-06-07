/**
 * JARVIS Main Application Logic
 * Coordinates Speech Recognition, Web Audio Synthesizer, Canvas Waveform Visualizer,
 * UI state updates, and Command Orchestration.
 */

// Global Application State
const state = {
    currentLanguage: 'en-US',
    apiKey: '',
    pitch: 1.0,
    rate: 1.0,
    selectedVoiceName: '',
    isListening: false,
    isSpeaking: false,
    isThinking: false,
    isWakeWordMode: true, // true: listening for "Hey Jarvis", false: listening for active command
    soundsEnabled: true,
    alarmCheckInterval: null,
    audioCtx: null,
    audioAnalyser: null,
    audioSource: null,
    micStream: null,
    recognition: null,
    commandTimeout: null,
    activeAlarmOscillator: null, // Track firing siren
    activeAlarmGain: null
};

// DOM Elements
const els = {
    reactorBtn: document.getElementById('arc-reactor-trigger'),
    jarvisState: document.getElementById('jarvis-state'),
    micStatus: document.getElementById('mic-status'),
    speechStatus: document.getElementById('speech-status'),
    wakewordStatus: document.getElementById('wakeword-status'),
    apiStatusLabel: document.getElementById('api-status-label'),
    canvas: document.getElementById('visualizer-canvas'),
    userSpeech: document.getElementById('user-speech-text'),
    jarvisSpeech: document.getElementById('jarvis-speech-text'),
    hudIndicator: document.getElementById('hud-indicator'),
    weatherDetails: document.getElementById('weather-details'),
    newsList: document.getElementById('news-list-container'),
    todoList: document.getElementById('todo-list-container'),
    alertsList: document.getElementById('alerts-list-container'),
    chatHistory: document.getElementById('chat-history-container'),
    headerDate: document.getElementById('header-date'),
    headerTime: document.getElementById('header-time'),
    
    // Buttons
    toggleSoundsBtn: document.getElementById('toggle-sounds-btn'),
    openSettingsBtn: document.getElementById('open-settings-btn'),
    closeSettingsBtn: document.getElementById('close-settings-btn'),
    saveSettingsBtn: document.getElementById('save-settings-btn'),
    refreshWeather: document.getElementById('refresh-weather'),
    refreshNews: document.getElementById('refresh-news'),
    clearTodos: document.getElementById('clear-todos'),
    clearAlerts: document.getElementById('clear-alerts'),
    addTodoBtn: document.getElementById('add-todo-btn'),
    newTodoInput: document.getElementById('new-todo-input'),
    addAlarmBtn: document.getElementById('add-alarm-btn'),
    alarmSecondsInput: document.getElementById('alarm-seconds'),
    alarmLabelInput: document.getElementById('alarm-label'),
    clearHistoryBtn: document.getElementById('clear-history-btn'),
    historyToggle: document.getElementById('history-toggle'),
    historyFooter: document.querySelector('.history-footer'),
    
    // Modal fields
    settingsModal: document.getElementById('settings-modal'),
    geminiKeyInput: document.getElementById('gemini-key-input'),
    voicePitch: document.getElementById('voice-pitch'),
    voicePitchVal: document.getElementById('voice-pitch-val'),
    voiceRate: document.getElementById('voice-rate'),
    voiceRateVal: document.getElementById('voice-rate-val'),
    ttsVoiceSelect: document.getElementById('tts-voice-select'),
    permNotification: document.getElementById('perm-notification')
};

// Canvas drawing setup
const canvasCtx = els.canvas.getContext('2d');

// --------------------------------------------------
// INITIALIZATION
// --------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    initClock();
    initSpeechRecognition();
    populateVoices();
    setupEventListeners();
    
    // Periodically update weather and news
    updateWeather();
    updateNews();
    
    // Start Alarm checking loop
    startAlarmMonitor();
    
    // Log startup
    logToHUD('SYSTEM', 'Core modules loaded. Web Audio API initialized on user interaction.');
    
    // If voices change load them again
    if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = populateVoices;
    }
});

// --------------------------------------------------
// CONFIG & LOCAL STORAGE
// --------------------------------------------------
function loadSettings() {
    state.apiKey = localStorage.getItem('jarvis_api_key') || '';
    state.currentLanguage = localStorage.getItem('jarvis_language') || 'en-US';
    state.pitch = parseFloat(localStorage.getItem('jarvis_voice_pitch')) || 1.0;
    state.rate = parseFloat(localStorage.getItem('jarvis_voice_rate')) || 1.0;
    state.selectedVoiceName = localStorage.getItem('jarvis_selected_voice') || '';
    state.soundsEnabled = localStorage.getItem('jarvis_sounds_enabled') !== 'false';
    
    // Populate form fields
    els.geminiKeyInput.value = state.apiKey;
    els.voicePitch.value = state.pitch;
    els.voicePitchVal.textContent = state.pitch.toFixed(1);
    els.voiceRate.value = state.rate;
    els.voiceRateVal.textContent = state.rate.toFixed(1);
    
    document.querySelector(`input[name="lang-selection"][value="${state.currentLanguage}"]`).checked = true;
    els.toggleSoundsBtn.querySelector('.icon').textContent = state.soundsEnabled ? '🔊' : '🔇';
    
    // Notification Permission toggle state
    if (Notification.permission === 'granted') {
        els.permNotification.checked = true;
    }
    
    updateAPIStatusLabel();
    
    // Render widgets initial state
    renderTodos();
    renderAlarms();
}

function saveConfiguration() {
    const key = els.geminiKeyInput.value.trim();
    const lang = document.querySelector('input[name="lang-selection"]:checked').value;
    const pitchVal = parseFloat(els.voicePitch.value);
    const rateVal = parseFloat(els.voiceRate.value);
    const voiceVal = els.ttsVoiceSelect.value;
    
    localStorage.setItem('jarvis_api_key', key);
    localStorage.setItem('jarvis_language', lang);
    localStorage.setItem('jarvis_voice_pitch', pitchVal);
    localStorage.setItem('jarvis_voice_rate', rateVal);
    localStorage.setItem('jarvis_selected_voice', voiceVal);
    
    state.apiKey = key;
    state.currentLanguage = lang;
    state.pitch = pitchVal;
    state.rate = rateVal;
    state.selectedVoiceName = voiceVal;
    
    // Notification permission request
    if (els.permNotification.checked && Notification.permission !== 'granted') {
        Notification.requestPermission();
    }
    
    updateAPIStatusLabel();
    closeSettings();
    playSound('success');
    
    // Say a quick confirmation
    const confirmMsg = lang === 'ta-IN' ? "அமைப்புகள் சேமிக்கப்பட்டன." : "Configuration successfully applied.";
    speakText(confirmMsg);
    
    // Restart recognition with new language context
    if (state.recognition) {
        state.recognition.stop(); // onend will restart it in wake-word mode with new language config
    }
}

function updateAPIStatusLabel() {
    if (state.apiKey) {
        els.apiStatusLabel.textContent = "GEMINI COGNITIVE CORE";
        els.apiStatusLabel.className = "status-on";
    } else {
        els.apiStatusLabel.textContent = "OFFLINE ENGINE";
        els.apiStatusLabel.className = "status-off";
    }
    
    const wakeText = state.currentLanguage === 'ta-IN' ? 'ஜார்விஸ் ("Jarvis")' : 'ACTIVE ("Hey Jarvis")';
    els.wakewordStatus.textContent = wakeText;
}

// --------------------------------------------------
// CLOCK
// --------------------------------------------------
function initClock() {
    const updateTime = () => {
        const now = new Date();
        
        // Date
        const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
        els.headerDate.textContent = now.toLocaleDateString(state.currentLanguage, options).toUpperCase();
        
        // Time
        els.headerTime.textContent = now.toLocaleTimeString(state.currentLanguage, { hour12: true });
    };
    updateTime();
    setInterval(updateTime, 1000);
}

// --------------------------------------------------
// AUDIO SYNTHESIS & GRAPHICS VISUALIZATION
// --------------------------------------------------
function initAudioContext() {
    if (state.audioCtx) return;
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        state.audioCtx = new AudioContext();
        
        // Create analyser node
        state.audioAnalyser = state.audioCtx.createAnalyser();
        state.audioAnalyser.fftSize = 64;
        state.audioAnalyser.connect(state.audioCtx.destination);
        
        els.micStatus.textContent = "INITIALISED";
        els.micStatus.className = "status-on";
        
        // Setup Canvas rendering
        drawVisualizer();
        
    } catch (e) {
        console.error("Web Audio API not supported", e);
        els.micStatus.textContent = "AUDIO ERR";
        els.micStatus.className = "status-off";
    }
}

/**
 * Connects user microphone to the Audio Analyser node for real-time visualization.
 */
async function connectMicToAnalyser() {
    if (!state.audioCtx) initAudioContext();
    if (state.micStream) return;
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        state.micStream = stream;
        state.audioSource = state.audioCtx.createMediaStreamSource(stream);
        state.audioSource.connect(state.audioAnalyser);
        
        els.micStatus.textContent = "ONLINE";
        els.micStatus.className = "status-on";
    } catch (e) {
        console.warn("Unable to capture microphone for visualizer canvas", e);
        els.micStatus.textContent = "VISUAL OFF";
        els.micStatus.className = "status-off";
    }
}

/**
 * Dynamically synthesizes cybernetic sound effects using oscillators.
 */
function playSound(type) {
    if (!state.soundsEnabled) return;
    if (!state.audioCtx) initAudioContext();
    
    // Resume audio context if suspended (browser security)
    if (state.audioCtx.state === 'suspended') {
        state.audioCtx.resume();
    }
    
    const ctx = state.audioCtx;
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    const now = ctx.currentTime;
    
    if (type === 'wake') {
        // High sweep rise
        osc.type = 'sine';
        osc.frequency.setValueAtTime(250, now);
        osc.frequency.exponentialRampToValueAtTime(850, now + 0.15);
        gainNode.gain.setValueAtTime(0.01, now);
        gainNode.gain.linearRampToValueAtTime(0.1, now + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
    } 
    else if (type === 'success') {
        // Double electronic beep
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.setValueAtTime(660, now + 0.08);
        gainNode.gain.setValueAtTime(0.01, now);
        gainNode.gain.linearRampToValueAtTime(0.08, now + 0.02);
        gainNode.gain.setValueAtTime(0.08, now + 0.08);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);
    } 
    else if (type === 'error') {
        // Falling tech error hum
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.linearRampToValueAtTime(90, now + 0.25);
        gainNode.gain.setValueAtTime(0.01, now);
        gainNode.gain.linearRampToValueAtTime(0.08, now + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
    }
    else if (type === 'alarm-siren') {
        // Continuous siren oscillator loop (requires manual stop)
        if (state.activeAlarmOscillator) return; // Already running
        
        const sirenOsc = ctx.createOscillator();
        const sirenGain = ctx.createGain();
        sirenOsc.connect(sirenGain);
        sirenGain.connect(ctx.destination);
        
        sirenOsc.type = 'sine';
        // Warbling effect: sweep frequency back and forth
        sirenOsc.frequency.setValueAtTime(450, now);
        
        sirenGain.gain.setValueAtTime(0.1, now);
        
        // Modulator oscillator for frequency warbling
        const modOsc = ctx.createOscillator();
        const modGain = ctx.createGain();
        modOsc.frequency.value = 4; // 4Hz speed
        modGain.gain.value = 100;   // 100Hz depth
        
        modOsc.connect(modGain);
        modGain.connect(sirenOsc.frequency);
        
        modOsc.start(now);
        sirenOsc.start(now);
        
        state.activeAlarmOscillator = { sirenOsc, modOsc };
        state.activeAlarmGain = sirenGain;
    }
}

function stopAlarmSiren() {
    if (state.activeAlarmOscillator) {
        try {
            state.activeAlarmOscillator.sirenOsc.stop();
            state.activeAlarmOscillator.modOsc.stop();
        } catch(e){}
        state.activeAlarmOscillator = null;
        state.activeAlarmGain = null;
    }
}

/**
 * Animated canvas drawing loop to paint cyber-grid waveform bars.
 */
function drawVisualizer() {
    requestAnimationFrame(drawVisualizer);
    
    const bufferLength = state.audioAnalyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    // Read frequencies
    state.audioAnalyser.getByteFrequencyData(dataArray);
    
    // Draw styles
    const width = els.canvas.width;
    const height = els.canvas.height;
    
    canvasCtx.clearRect(0, 0, width, height);
    
    // Background glow
    canvasCtx.fillStyle = 'rgba(12, 16, 24, 0.5)';
    canvasCtx.fillRect(0, 0, width, height);
    
    const barWidth = (width / bufferLength) * 1.5;
    let barHeight;
    let x = 0;
    
    // Draw mirrored glow waveform bar charts
    for(let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i];
        
        // If speaking or listening make wave responsive, else draw small ambient noise
        let finalHeight = (barHeight / 255) * height * 0.9;
        if (state.isSpeaking) {
            // Mock dynamic volume mapping from TTS if synthesising
            finalHeight = (Math.sin(Date.now() * 0.05 + i) * 12 + 18) * (state.rate);
        } else if (!state.isListening && !state.isThinking) {
            // Static low ambient cyber wave
            finalHeight = 2 + Math.abs(Math.sin(Date.now() * 0.002 + i) * 3);
        }
        
        // Color mapping based on state
        let barColor = 'rgba(0, 242, 254, 0.4)';
        if (state.isListening) {
            barColor = `hsla(192, 100%, 50%, ${0.3 + (finalHeight/height)})`;
        } else if (state.isThinking) {
            barColor = `hsla(45, 100%, 50%, ${0.3 + (finalHeight/height)})`;
        } else if (state.isSpeaking) {
            barColor = `hsla(140, 100%, 45%, ${0.3 + (finalHeight/height)})`;
        }
        
        canvasCtx.fillStyle = barColor;
        
        // Render bar center-aligned vertically
        const yPos = (height - finalHeight) / 2;
        canvasCtx.fillRect(x, yPos, barWidth - 2, finalHeight);
        
        x += barWidth;
    }
}

// --------------------------------------------------
// SPEECH RECOGNITION (INPUT)
// --------------------------------------------------
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        logToHUD('SYSTEM', 'Warning: SpeechRecognition API not supported on this browser. Use Chrome/Edge.');
        els.wakewordStatus.textContent = "API UNSUPPORTED";
        els.wakewordStatus.className = "status-off";
        return;
    }
    
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = false;
    
    // Match current system settings
    rec.lang = state.currentLanguage;
    
    rec.onstart = () => {
        console.log(`Speech Recognition Loop started: [${rec.lang}]`);
        els.hudIndicator.textContent = "ONLINE";
        els.hudIndicator.className = "pulse-hud status-on";
    };
    
    rec.onerror = (event) => {
        console.warn("Speech Recognition Error:", event.error);
        if (event.error === 'not-allowed') {
            logToHUD('SYSTEM', 'Microphone access denied.');
            els.micStatus.textContent = "DENIED";
            els.micStatus.className = "status-off";
        }
    };
    
    rec.onend = () => {
        // Restart speech recognition automatically if JARVIS isn't speaking
        if (!state.isSpeaking) {
            console.log("Speech recognition stopped. Re-initializing listening cycle...");
            try {
                rec.lang = state.currentLanguage; // update language if changed
                rec.start();
            } catch (e) {
                console.error("Failed to restart speech recognition loop", e);
            }
        } else {
            console.log("Speech recognition suspended while JARVIS is speaking.");
        }
    };
    
    rec.onresult = (event) => {
        const lastResultIndex = event.resultIndex;
        const transcript = event.results[lastResultIndex][0].transcript.trim();
        console.log(`Speech Raw Transcript: "${transcript}"`);
        
        handleVoiceInput(transcript);
    };
    
    state.recognition = rec;
    
    // Start engine
    try {
        rec.start();
    } catch(e) {
        console.error("Initial Speech Recognition start error", e);
    }
}

/**
 * Processes incoming speech, separating wake-word check from command collection.
 */
function handleVoiceInput(text) {
    // Stop any sounding sirens if user says "stop"
    if (state.activeAlarmOscillator) {
        if (text.toLowerCase().includes("stop") || text.toLowerCase().includes("நிறுத்து") || text.toLowerCase().includes("off")) {
            stopAlarmSiren();
            els.jarvisSpeech.textContent = "Alarm siren deactivated, Captain.";
            speakText(state.currentLanguage === 'ta-IN' ? "அலாரம் நிறுத்தப்பட்டது." : "Alarm deactivated.");
            return;
        }
    }

    if (state.isWakeWordMode) {
        // Checking for Wake Word: "Hey Jarvis" or "Jarvis" or "ஜார்விஸ்"
        const cleanText = text.toLowerCase();
        let wakeWordMatched = false;
        let wakeWordIndex = -1;
        let wakeWordLength = 0;
        
        if (cleanText.includes("hey jarvis")) {
            wakeWordIndex = cleanText.indexOf("hey jarvis");
            wakeWordLength = "hey jarvis".length;
            wakeWordMatched = true;
        } else if (cleanText.includes("jarvis")) {
            wakeWordIndex = cleanText.indexOf("jarvis");
            wakeWordLength = "jarvis".length;
            wakeWordMatched = true;
        } else if (cleanText.includes("ஹே ஜார்விஸ்")) {
            wakeWordIndex = cleanText.indexOf("ஹே ஜார்விஸ்");
            wakeWordLength = "ஹே ஜார்விஸ்".length;
            wakeWordMatched = true;
        } else if (cleanText.includes("ஜார்விஸ்")) {
            wakeWordIndex = cleanText.indexOf("ஜார்விஸ்");
            wakeWordLength = "ஜார்விஸ்".length;
            wakeWordMatched = true;
        } else if (cleanText.includes("ஜார்விஷ்")) {
            wakeWordIndex = cleanText.indexOf("ஜார்விஷ்");
            wakeWordLength = "ஜார்விஷ்".length;
            wakeWordMatched = true;
        }
        
        if (wakeWordMatched) {
            // Trigger wake up sequence
            clearTimeout(state.commandTimeout);
            state.isWakeWordMode = false;
            
            // Start audio visualizer connections
            initAudioContext();
            connectMicToAnalyser();
            
            playSound('wake');
            setJarvisState('listening');
            
            // Extract anything spoken after the wake word in the same transcript
            // e.g. "Hey Jarvis, what is the weather?" -> "what is the weather?"
            let commandPart = text.substring(wakeWordIndex + wakeWordLength).trim();
            // Remove leading punctuation like commas or spaces
            commandPart = commandPart.replace(/^[,.?!-\s]+/, '').trim();
            
            if (commandPart.length > 1) {
                // User spoke the command immediately along with the wake word!
                console.log(`Wake word & command combined. Extracting: "${commandPart}"`);
                
                // Collect command instruction directly
                els.userSpeech.textContent = commandPart;
                els.userSpeech.classList.remove('speech-placeholder');
                
                // Log user speech in archive logs
                logToHUD('USER', commandPart);
                
                // Process the command immediately
                processCommand(commandPart);
            } else {
                // Wake word only. Stand by for the command in the next result.
                els.userSpeech.textContent = "Listening for command...";
                els.userSpeech.classList.remove('speech-placeholder');
                
                // Give user 6.5 seconds to say the instruction
                state.commandTimeout = setTimeout(() => {
                    resetToWakeWordMode();
                    els.userSpeech.textContent = "Command timeout.";
                    els.userSpeech.classList.add('speech-placeholder');
                }, 6500);
            }
        }
    } else {
        // Collect command instruction
        clearTimeout(state.commandTimeout);
        els.userSpeech.textContent = text;
        els.userSpeech.classList.remove('speech-placeholder');
        
        // Log user speech in archive logs
        logToHUD('USER', text);
        
        // Run execution engine
        processCommand(text);
    }
}

function resetToWakeWordMode() {
    state.isWakeWordMode = true;
    setJarvisState('standby');
}

// --------------------------------------------------
// SPEECH SYNTHESIS (OUTPUT)
// --------------------------------------------------
function speakText(text) {
    if (!window.speechSynthesis) {
        console.warn("Speech Synthesis not supported by this browser.");
        return;
    }
    
    // Cancel any current utterances first
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = state.pitch;
    utterance.rate = state.rate;
    
    // Choose appropriate voice synthesizer
    const voices = window.speechSynthesis.getVoices();
    let selectedVoice = null;
    
    if (state.selectedVoiceName) {
        selectedVoice = voices.find(v => v.name === state.selectedVoiceName);
    }
    
    if (!selectedVoice) {
        // Auto fallback matching language
        if (state.currentLanguage === 'ta-IN') {
            selectedVoice = voices.find(v => v.lang.includes('ta') || v.lang.includes('TA'));
        } else {
            // Look for premium Google voices or English
            selectedVoice = voices.find(v => v.lang.includes('en-US') && v.name.includes('Google')) ||
                            voices.find(v => v.lang.includes('en') || v.lang.includes('EN'));
        }
    }
    
    if (selectedVoice) {
        utterance.voice = selectedVoice;
        console.log(`Speaking voice selected: ${selectedVoice.name} (${selectedVoice.lang})`);
    }
    
    utterance.onstart = () => {
        state.isSpeaking = true;
        setJarvisState('speaking');
        
        // Critical: Pause recognition while JARVIS is speaking to avoid hearing itself!
        if (state.recognition) {
            try {
                state.recognition.stop();
            } catch(e){}
        }
    };
    
    utterance.onend = () => {
        state.isSpeaking = false;
        resetToWakeWordMode();
        
        // Restart speech recognition listening cycle
        if (state.recognition) {
            try {
                state.recognition.start();
            } catch (e) {
                console.error("Error restarting recognition after speaking", e);
            }
        }
    };
    
    utterance.onerror = (e) => {
        console.error("Speech Synthesis Error:", e);
        state.isSpeaking = false;
        resetToWakeWordMode();
        if (state.recognition) {
            try {
                state.recognition.start();
            } catch(err){}
        }
    };
    
    window.speechSynthesis.speak(utterance);
}

function populateVoices() {
    if (!window.speechSynthesis) return;
    
    const select = els.ttsVoiceSelect;
    const voices = window.speechSynthesis.getVoices();
    
    // Clear select
    select.innerHTML = '<option value="">System Default Voice</option>';
    
    voices.forEach(voice => {
        const option = document.createElement('option');
        option.value = voice.name;
        option.textContent = `${voice.name} (${voice.lang}) ${voice.localService ? '[Local]' : ''}`;
        
        if (voice.name === state.selectedVoiceName) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}

// --------------------------------------------------
// STATE MANAGERS & HUD LOGS
// --------------------------------------------------
function setJarvisState(status) {
    state.isListening = status === 'listening';
    state.isThinking = status === 'thinking';
    
    document.body.setAttribute('data-state', status);
    
    els.jarvisState.textContent = status.toUpperCase();
    els.jarvisState.className = `status-value state-${status}`;
}

function logToHUD(sender, message) {
    const row = document.createElement('div');
    row.className = `chat-log-row chat-log-${sender.toLowerCase()}`;
    
    const timeStr = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    row.innerHTML = `<span class="chat-log-time tech-font">[${timeStr}]</span><strong>${sender}:</strong> ${message}`;
    
    els.chatHistory.appendChild(row);
    
    // Scroll to bottom
    els.chatHistory.parentElement.scrollTop = els.chatHistory.parentElement.scrollHeight;
}

// --------------------------------------------------
// COMMAND ROUTER & EXECUTION
// --------------------------------------------------
async function processCommand(rawText) {
    setJarvisState('thinking');
    
    const text = rawText.toLowerCase().trim();
    const lang = state.currentLanguage;
    const isTamil = lang === 'ta-IN';
    const dict = JarvisServices.translations[lang];
    
    let voiceResponse = "";
    
    // --------------------------------------------------
    // COMMAND 1: WEATHER TELEMETRY
    // --------------------------------------------------
    if (text.includes("weather") || text.includes("temperature") || text.includes("climate") ||
        text.includes("வானிலை") || text.includes("வெப்பநிலை") || text.includes("மழை")) {
        
        els.jarvisSpeech.textContent = isTamil ? "விசாரித்துக் கொண்டிருக்கிறேன்..." : "Querying satellite meteorology...";
        const w = await JarvisServices.getWeather();
        
        if (w.success) {
            const desc = JarvisServices.translateWeatherDesc(w.desc, lang);
            voiceResponse = dict.weatherSuccess
                .replace('{city}', w.city)
                .replace('{temp}', w.temp)
                .replace('{desc}', desc);
                
            // Update widget UI
            els.weatherDetails.innerHTML = `
                <div class="tech-font" style="font-size: 1.8rem; color: var(--jarvis-blue);">${w.temp}°C</div>
                <div style="font-weight: bold; margin-top: 5px;">${w.city.toUpperCase()}</div>
                <div style="color: var(--text-secondary); font-size: 0.9rem;">${desc}</div>
                <div style="color: var(--text-secondary); font-size: 0.8rem; margin-top: 5px;">Wind: ${w.wind} km/h</div>
            `;
            els.weatherDetails.classList.remove('loading');
        } else {
            voiceResponse = dict.weatherFail;
        }
    }
    
    // --------------------------------------------------
    // COMMAND 2: DATE & TIME
    // --------------------------------------------------
    else if (text.includes("time") || text.includes("date") || text.includes("today") ||
             text.includes("நேரம்") || text.includes("மணி என்ன") || text.includes("தேதி")) {
        
        const now = new Date();
        if (text.includes("time") || text.includes("மணி என்ன") || text.includes("நேரம்")) {
            const timeStr = now.toLocaleTimeString(lang, { hour: 'numeric', minute: '2-digit', hour12: true });
            voiceResponse = dict.timePrefix + timeStr;
        } else {
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            const dateStr = now.toLocaleDateString(lang, options);
            voiceResponse = dict.datePrefix + dateStr;
        }
    }
    
    // --------------------------------------------------
    // COMMAND 3: NEWS FEED HEADLINES
    // --------------------------------------------------
    else if (text.includes("news") || text.includes("headline") || text.includes("செய்தி") || text.includes("செய்திகள்")) {
        els.jarvisSpeech.textContent = isTamil ? "செய்திகளைத் திரட்டுகிறேன்..." : "Synchronizing news broadcasts...";
        const headlines = await JarvisServices.getNews();
        
        if (headlines && headlines.length > 0) {
            voiceResponse = dict.newsHeader;
            
            // Speak the first 3 news summaries to keep it concise
            const speakTitles = headlines.slice(0, 3).map((h, i) => `${i+1}. ${h.title}`).join(". ");
            voiceResponse += " " + speakTitles;
            
            // Render Widget List
            renderNewsList(headlines);
        } else {
            voiceResponse = dict.newsNone;
        }
    }
    
    // --------------------------------------------------
    // COMMAND 4: ADD TO-DO / TASK LIST
    // --------------------------------------------------
    else if (text.includes("add to-do") || text.includes("add task") || text.includes("todo") ||
             text.includes("பணி சேர்க்க") || text.includes("வேலை சேர்க்க")) {
        
        // Extract note text
        let todoText = "";
        if (isTamil) {
            // "வேலை சேர்க்க பாத்திரங்களை கழுவு" or similar
            todoText = rawText.replace(/பணி சேர்க்க/i, '').replace(/வேலை சேர்க்க/i, '').trim();
        } else {
            todoText = rawText.replace(/add to-do/i, '').replace(/add task/i, '').replace(/todo/i, '').trim();
        }
        
        if (todoText) {
            JarvisServices.addTodo(todoText);
            renderTodos();
            voiceResponse = dict.todoAdded.replace('{task}', todoText);
            playSound('success');
        } else {
            voiceResponse = isTamil ? "என்ன வேலை சேர்க்க வேண்டும் என்று கூறவும்." : "Please specify the task content, Captain.";
        }
    }
    
    // --------------------------------------------------
    // COMMAND 5: SET COUNTDOWN ALARMS / ALERTS
    // --------------------------------------------------
    else if (text.includes("alarm") || text.includes("remind me in") || 
             text.includes("அலாரம்") || text.includes("நினைவூட்டு")) {
        
        // Extract numbers (seconds)
        const matchNum = text.match(/\d+/);
        let seconds = matchNum ? parseInt(matchNum[0]) : 0;
        
        // Convert minutes or hours if mentioned
        if (text.includes("minute") || text.includes("நிமிடம்") || text.includes("நிமிடங்கள்")) {
            seconds *= 60;
        } else if (text.includes("hour") || text.includes("மணி")) {
            // Make sure "மணி" is not just time check
            if (matchNum) seconds *= 3600;
        }
        
        // Extract label
        let label = isTamil ? "அலாரம் எச்சரிக்கை" : "Jarvis Alarm Alert";
        const labelWords = rawText.split(/\d+/);
        if (labelWords.length > 1) {
            label = labelWords[1]
                .replace(/seconds/i, '')
                .replace(/second/i, '')
                .replace(/minutes/i, '')
                .replace(/minute/i, '')
                .replace(/in/i, '')
                .replace(/விநாடி/g, '')
                .replace(/நிமிடம்/g, '')
                .trim();
        }
        
        if (seconds > 0) {
            JarvisServices.addAlarm(seconds, label || "Timer Alert");
            renderAlarms();
            voiceResponse = dict.alarmSet.replace('{sec}', seconds).replace('{label}', label);
            playSound('success');
        } else {
            voiceResponse = isTamil ? "எத்தனை வினாடிகளில் அலாரம் அமைக்க வேண்டும் என்று கூறவும்." : "Please specify the alarm countdown duration in seconds, Captain.";
        }
    }
    
    // --------------------------------------------------
    // COMMAND 6: CALCULATIONS & MATH EXPRESSIONS
    // --------------------------------------------------
    else if (text.includes("plus") || text.includes("minus") || text.includes("multiplied by") || 
             text.includes("divided by") || text.includes("times") || text.includes("கூட்டல்") || 
             text.includes("கழித்தல்") || text.includes("வகுத்தல்") || text.includes("பெருக்கல்")) {
        
        const mathResult = JarvisServices.parseAndCalculate(text);
        if (mathResult) {
            const exprSpoken = JarvisServices.translateMathExpr(mathResult.expression, lang);
            voiceResponse = dict.mathPrefix.replace('{expr}', exprSpoken).replace('{val}', mathResult.value);
            playSound('success');
        } else {
            voiceResponse = dict.mathFail;
        }
    }
    
    // --------------------------------------------------
    // COMMAND 7: APP OPENER SYSTEM SHORTS
    // --------------------------------------------------
    else if (text.includes("open") || text.includes("திற")) {
        const appRes = JarvisServices.openApp(rawText);
        if (appRes.success) {
            voiceResponse = dict.appOpened.replace('{app}', appRes.app.toUpperCase());
            playSound('success');
        } else {
            voiceResponse = dict.appFail;
        }
    }
    
    // --------------------------------------------------
    // FALLBACK 8: GENERATIVE AI OR LOCAL CHATBOT
    // --------------------------------------------------
    if (!voiceResponse) {
        // Run Gemini or offline local conversational fallbacks
        try {
            voiceResponse = await JarvisAI.generateResponse(rawText, state.apiKey, lang);
        } catch (err) {
            voiceResponse = dict.notUnderstand;
            playSound('error');
        }
    }
    
    // Output response
    els.jarvisSpeech.textContent = voiceResponse;
    els.jarvisSpeech.classList.remove('speech-placeholder');
    logToHUD('JARVIS', voiceResponse);
    speakText(voiceResponse);
}

// --------------------------------------------------
// WIDGET UI RENDERERS
// --------------------------------------------------
function renderTodos() {
    const todos = JarvisServices.getTodos();
    els.todoList.innerHTML = '';
    
    if (todos.length === 0) {
        els.todoList.innerHTML = '<li class="empty-list-msg">No active tasks in queue.</li>';
        return;
    }
    
    todos.forEach(todo => {
        const li = document.createElement('li');
        li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
        
        li.innerHTML = `
            <label class="checkbox-label" style="flex:1;">
                <input type="checkbox" ${todo.completed ? 'checked' : ''} data-id="${todo.id}">
                <span>${todo.text}</span>
            </label>
            <button class="delete-item-btn" data-id="${todo.id}" aria-label="Delete task">&times;</button>
        `;
        
        // Listeners
        li.querySelector('input').addEventListener('change', (e) => {
            JarvisServices.toggleTodo(todo.id);
            renderTodos();
            playSound('success');
        });
        
        li.querySelector('.delete-item-btn').addEventListener('click', () => {
            JarvisServices.deleteTodo(todo.id);
            renderTodos();
            playSound('error');
        });
        
        els.todoList.appendChild(li);
    });
}

function renderAlarms() {
    const alarms = JarvisServices.getAlarms();
    els.alertsList.innerHTML = '';
    
    if (alarms.length === 0) {
        els.alertsList.innerHTML = '<li class="empty-list-msg">No active alerts scheduled.</li>';
        return;
    }
    
    alarms.forEach(alarm => {
        const li = document.createElement('li');
        li.className = 'alert-item';
        
        const timeRemaining = Math.max(0, Math.round((alarm.time - Date.now()) / 1000));
        
        li.innerHTML = `
            <span>⏰ [${timeRemaining}s] - ${alarm.label}</span>
            <button class="delete-item-btn" data-id="${alarm.id}" aria-label="Delete alarm">&times;</button>
        `;
        
        li.querySelector('.delete-item-btn').addEventListener('click', () => {
            JarvisServices.deleteAlarm(alarm.id);
            renderAlarms();
            playSound('error');
        });
        
        els.alertsList.appendChild(li);
    });
}

function renderNewsList(headlines) {
    els.newsList.innerHTML = '';
    
    headlines.forEach(hl => {
        const li = document.createElement('li');
        li.innerHTML = `
            <a href="${hl.url}" target="_blank" rel="noopener noreferrer">${hl.title}</a>
            <span class="news-date tech-font">${hl.source} | ${hl.date}</span>
        `;
        els.newsList.appendChild(li);
    });
}

async function updateWeather() {
    const w = await JarvisServices.getWeather();
    if (w.success) {
        const desc = JarvisServices.translateWeatherDesc(w.desc, state.currentLanguage);
        els.weatherDetails.innerHTML = `
            <div class="tech-font" style="font-size: 1.8rem; color: var(--jarvis-blue);">${w.temp}°C</div>
            <div style="font-weight: bold; margin-top: 5px;">${w.city.toUpperCase()}</div>
            <div style="color: var(--text-secondary); font-size: 0.9rem;">${desc}</div>
            <div style="color: var(--text-secondary); font-size: 0.8rem; margin-top: 5px;">Wind: ${w.wind} km/h</div>
        `;
        els.weatherDetails.classList.remove('loading');
    }
}

async function updateNews() {
    const hl = await JarvisServices.getNews();
    if (hl && hl.length > 0) {
        renderNewsList(hl);
    }
}

// --------------------------------------------------
// ALARM CHECK LOOP (BACKGROUND MONITOR)
// --------------------------------------------------
function startAlarmMonitor() {
    if (state.alarmCheckInterval) clearInterval(state.alarmCheckInterval);
    
    state.alarmCheckInterval = setInterval(() => {
        const alarms = JarvisServices.getAlarms();
        if (alarms.length === 0) return;
        
        let changeMade = false;
        const now = Date.now();
        
        alarms.forEach(alarm => {
            if (now >= alarm.time && !alarm.triggered) {
                alarm.triggered = true;
                changeMade = true;
                
                // Fire alarm alert!
                fireAlarmAlert(alarm);
            }
        });
        
        if (changeMade) {
            // Remove triggered alarms
            const activeAlarms = alarms.filter(a => !a.triggered);
            JarvisServices.saveAlarms(activeAlarms);
            renderAlarms();
        } else {
            // Periodic update of timer seconds display
            renderAlarms();
        }
    }, 1000);
}

function fireAlarmAlert(alarm) {
    console.log(`Alarm Firing! Label: "${alarm.label}"`);
    
    // Play pulsing alarm siren oscillator
    playSound('alarm-siren');
    
    // Setup alert warning phrase
    const lang = state.currentLanguage;
    const isTamil = lang === 'ta-IN';
    const dict = JarvisServices.translations[lang];
    const triggerSpeech = dict.alarmTriggered.replace('{label}', alarm.label);
    
    els.jarvisSpeech.textContent = triggerSpeech;
    els.jarvisSpeech.classList.remove('speech-placeholder');
    
    logToHUD('ALERT', `Alarm Fired: "${alarm.label}"`);
    
    // Speak warning
    speakText(triggerSpeech);
    
    // Desktop push notification
    if (Notification.permission === 'granted') {
        new Notification("J.A.R.V.I.S. Alert Grid", {
            body: `Warning: ${alarm.label} scheduled timer triggered!`,
            icon: 'favicon.ico' // Or simple placeholder
        });
    }
}

// --------------------------------------------------
// EVENT LISTENERS & MODALS
// --------------------------------------------------
function setupEventListeners() {
    // Arc Reactor Manual Activation
    els.reactorBtn.addEventListener('click', () => {
        // If alarm siren is firing, stop it on click
        if (state.activeAlarmOscillator) {
            stopAlarmSiren();
            els.jarvisSpeech.textContent = "Alarm siren deactivated, Captain.";
            speakText(state.currentLanguage === 'ta-IN' ? "அலாரம் நிறுத்தப்பட்டது." : "Alarm deactivated.");
            return;
        }
        
        // Else wake up manually
        state.isWakeWordMode = false;
        initAudioContext();
        connectMicToAnalyser();
        playSound('wake');
        setJarvisState('listening');
        els.userSpeech.textContent = "Listening for command...";
        els.userSpeech.classList.remove('speech-placeholder');
        
        // Set command timeout
        clearTimeout(state.commandTimeout);
        state.commandTimeout = setTimeout(() => {
            resetToWakeWordMode();
            els.userSpeech.textContent = "Command timeout.";
            els.userSpeech.classList.add('speech-placeholder');
        }, 6500);
    });

    // Header buttons
    els.toggleSoundsBtn.addEventListener('click', () => {
        state.soundsEnabled = !state.soundsEnabled;
        localStorage.setItem('jarvis_sounds_enabled', state.soundsEnabled);
        els.toggleSoundsBtn.querySelector('.icon').textContent = state.soundsEnabled ? '🔊' : '🔇';
        logToHUD('SYSTEM', `Sound FX modules: ${state.soundsEnabled ? 'ONLINE' : 'MUTED'}`);
    });
    
    els.openSettingsBtn.addEventListener('click', openSettings);
    els.closeSettingsBtn.addEventListener('click', closeSettings);
    els.saveSettingsBtn.addEventListener('click', saveConfiguration);
    
    // Settings adjustments
    els.voicePitch.addEventListener('input', (e) => {
        els.voicePitchVal.textContent = parseFloat(e.target.value).toFixed(1);
    });
    els.voiceRate.addEventListener('input', (e) => {
        els.voiceRateVal.textContent = parseFloat(e.target.value).toFixed(1);
    });
    
    // Services Refresher clicks
    els.refreshWeather.addEventListener('click', () => {
        updateWeather();
        playSound('success');
    });
    els.refreshNews.addEventListener('click', () => {
        updateNews();
        playSound('success');
    });
    
    // To-Do click inputs
    els.addTodoBtn.addEventListener('click', () => {
        const text = els.newTodoInput.value.trim();
        if (text) {
            JarvisServices.addTodo(text);
            els.newTodoInput.value = '';
            renderTodos();
            playSound('success');
        }
    });
    els.newTodoInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            els.addTodoBtn.click();
        }
    });
    els.clearTodos.addEventListener('click', () => {
        JarvisServices.clearTodos();
        renderTodos();
        playSound('error');
    });
    
    // Alarm click inputs
    els.addAlarmBtn.addEventListener('click', () => {
        const sec = parseInt(els.alarmSecondsInput.value);
        const label = els.alarmLabelInput.value.trim();
        if (!isNaN(sec) && sec > 0) {
            JarvisServices.addAlarm(sec, label || "Timer Alert");
            els.alarmSecondsInput.value = '';
            els.alarmLabelInput.value = '';
            renderAlarms();
            playSound('success');
        }
    });
    els.clearAlerts.addEventListener('click', () => {
        JarvisServices.clearAlarms();
        renderAlarms();
        playSound('error');
    });
    
    // Archive controls
    els.clearHistoryBtn.addEventListener('click', () => {
        JarvisAI.purgeHistory();
        els.chatHistory.innerHTML = '';
        logToHUD('SYSTEM', 'Cognitive history buffers purged.');
        playSound('error');
    });
    
    els.historyToggle.addEventListener('click', () => {
        els.historyFooter.classList.toggle('expanded');
    });
}

function openSettings() {
    els.settingsModal.classList.add('active');
    els.settingsModal.setAttribute('aria-hidden', 'false');
    populateVoices(); // update voices drop-down
}

function closeSettings() {
    els.settingsModal.classList.remove('active');
    els.settingsModal.setAttribute('aria-hidden', 'true');
}
