/**
 * JARVIS Telemetry and Utility Services Module
 * Deals with Weather, News, Reminders, Alarms, Tasks, Math, App Opening and Multi-language.
 */

const JarvisServices = {
    // --------------------------------------------------
    // GEOLOCATION & WEATHER
    // --------------------------------------------------
    async getWeather() {
        let lat = 13.0827; // Default Chennai
        let lon = 80.2707;
        let city = "Chennai";

        try {
            const geoRes = await fetch('https://ipapi.co/json/');
            if (geoRes.ok) {
                const geoData = await geoRes.json();
                if (geoData.latitude && geoData.longitude) {
                    lat = geoData.latitude;
                    lon = geoData.longitude;
                    city = geoData.city || "your location";
                }
            }
        } catch (e) {
            console.warn("IP Geolocation failed. Using defaults.", e);
        }

        try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=celsius`;
            const weatherRes = await fetch(url);
            if (weatherRes.ok) {
                const wData = await weatherRes.json();
                const temp = wData.current_weather.temperature;
                const wind = wData.current_weather.windspeed;
                const code = wData.current_weather.weathercode;
                const desc = this.getWMOWeatherDesc(code);
                
                return {
                    success: true,
                    city: city,
                    temp: Math.round(temp),
                    wind: wind,
                    desc: desc,
                    code: code
                };
            }
        } catch (err) {
            console.error("Open-Meteo weather request failed", err);
        }
        return { success: false, city: city };
    },

    getWMOWeatherDesc(code) {
        const codeMap = {
            0: "Clear sky",
            1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
            45: "Foggy", 48: "Depositing rime fog",
            51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
            61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
            71: "Slight snow fall", 73: "Moderate snow fall", 75: "Heavy snow fall",
            77: "Snow grains",
            80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
            85: "Slight snow showers", 86: "Heavy snow showers",
            95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail"
        };
        return codeMap[code] || "Unsettled atmosphere";
    },

    // --------------------------------------------------
    // NEWS RSS/API FEED
    // --------------------------------------------------
    async getNews() {
        try {
            // High-speed static JSON updated daily
            const newsRes = await fetch('https://saurav.tech/NewsAPI/top-headlines/category/technology/in.json');
            if (newsRes.ok) {
                const data = await newsRes.json();
                return data.articles.slice(0, 5).map(art => ({
                    title: art.title,
                    source: art.source.name || 'Satellite Data',
                    url: art.url,
                    date: art.publishedAt ? new Date(art.publishedAt).toLocaleDateString() : 'Today'
                }));
            }
        } catch (e) {
            console.warn("Technology News API failed. Launching backup feed.", e);
        }

        // Static fallback news array in case of offline / CORS issues
        return [
            { title: "JARVIS Core Engine successfully deployed locally", source: "Stark Tech", url: "#", date: "Today" },
            { title: "Artificial Intelligence reaches human-level speech synthesis performance", source: "NeuroNet", url: "#", date: "Yesterday" },
            { title: "Next-gen cybernetic grids announced with quantum security features", source: "AeroTech", url: "#", date: "2 days ago" },
            { title: "Astronomical solar arrays show 20% efficiency rise", source: "ScienceDaily", url: "#", date: "3 days ago" },
            { title: "Open-source developer builds fully autonomous home assistant", source: "GitGlow", url: "#", date: "4 days ago" }
        ];
    },

    // --------------------------------------------------
    // TO-DO LIST MANAGER (Local Storage)
    // --------------------------------------------------
    getTodos() {
        return JSON.parse(localStorage.getItem('jarvis_todos')) || [];
    },

    saveTodos(todos) {
        localStorage.setItem('jarvis_todos', JSON.stringify(todos));
    },

    addTodo(text) {
        const todos = this.getTodos();
        const newTodo = {
            id: Date.now(),
            text: text,
            completed: false
        };
        todos.push(newTodo);
        this.saveTodos(todos);
        return newTodo;
    },

    toggleTodo(id) {
        const todos = this.getTodos();
        const updated = todos.map(todo => {
            if (todo.id === id) {
                todo.completed = !todo.completed;
            }
            return todo;
        });
        this.saveTodos(updated);
    },

    deleteTodo(id) {
        const todos = this.getTodos();
        const filtered = todos.filter(todo => todo.id !== id);
        this.saveTodos(filtered);
    },

    clearTodos() {
        this.saveTodos([]);
    },

    // --------------------------------------------------
    // REMINDERS & ALARMS SCHEDULER
    // --------------------------------------------------
    getAlarms() {
        return JSON.parse(localStorage.getItem('jarvis_alarms')) || [];
    },

    saveAlarms(alarms) {
        localStorage.setItem('jarvis_alarms', JSON.stringify(alarms));
    },

    addAlarm(seconds, label = "Reminder Alert") {
        const alarms = this.getAlarms();
        const triggerTime = Date.now() + (seconds * 1000);
        const newAlarm = {
            id: Date.now(),
            time: triggerTime,
            seconds: seconds,
            label: label,
            triggered: false
        };
        alarms.push(newAlarm);
        this.saveAlarms(alarms);
        return newAlarm;
    },

    deleteAlarm(id) {
        const alarms = this.getAlarms();
        const filtered = alarms.filter(alarm => alarm.id !== id);
        this.saveAlarms(filtered);
    },

    clearAlarms() {
        this.saveAlarms([]);
    },

    // --------------------------------------------------
    // MATH ENGINE (CALCULATOR)
    // --------------------------------------------------
    parseAndCalculate(phrase) {
        // Remove conversational words
        let clean = phrase.toLowerCase()
            .replace(/what is/g, '')
            .replace(/calculate/g, '')
            .replace(/jarvis/g, '')
            .replace(/please/g, '')
            .replace(/\?/g, '')
            .trim();

        // Map verbal operators to math symbols
        clean = clean
            .replace(/multiplied by/g, '*')
            .replace(/multiply/g, '*')
            .replace(/times/g, '*')
            .replace(/x/g, '*')
            .replace(/divided by/g, '/')
            .replace(/divide/g, '/')
            .replace(/plus/g, '+')
            .replace(/add/g, '+')
            .replace(/minus/g, '-')
            .replace(/subtract/g, '-');

        // Clean any malicious non-mathematical inputs
        clean = clean.replace(/[^0-9+\-*/().\s]/g, '');

        try {
            if (!clean) return null;
            // Evaluate math expression safely using Function constructor rather than eval
            const result = new Function(`return (${clean})`)();
            if (typeof result === 'number' && !isNaN(result)) {
                return {
                    expression: clean,
                    value: result
                };
            }
        } catch (e) {
            console.error("Math parsing failed", e);
        }
        return null;
    },

    // --------------------------------------------------
    // APPLICATION LAUNCHER
    // --------------------------------------------------
    openApp(appName) {
        const name = appName.toLowerCase().trim();
        const appMap = {
            'youtube': 'https://youtube.com',
            'google': 'https://google.com',
            'gmail': 'https://mail.google.com',
            'github': 'https://github.com',
            'wikipedia': 'https://wikipedia.org',
            'translate': 'https://translate.google.com',
            'maps': 'https://maps.google.com',
            'weather': 'https://weather.com',
            'news': 'https://news.google.com',
            'spotify': 'https://open.spotify.com'
        };

        for (const [key, url] of Object.entries(appMap)) {
            if (name.includes(key)) {
                window.open(url, '_blank');
                return { success: true, app: key, url: url };
            }
        }
        return { success: false };
    },

    // --------------------------------------------------
    // TRANSLATIONS AND SPEECH HELPERS
    // --------------------------------------------------
    translations: {
        'en-US': {
            greeting: "Hello, I am JARVIS. Systems are fully operational. How can I help you, Captain?",
            notUnderstand: "I am sorry, Captain. My sensory grid could not decipher that command. Could you repeat?",
            timePrefix: "The local system time is ",
            datePrefix: "Today is ",
            weatherSuccess: "Environmental telemetry for {city}: Temperature is {temp} degrees Celsius, with {desc}.",
            weatherFail: "Unable to retrieve satellite meteorological data, Captain. I recommend checking local sensors.",
            newsHeader: "Synchronizing media feeds. Here are the top headlines:",
            newsNone: "Satellite feeds are currently clear of fresh telemetry.",
            alarmSet: "Affirmative. Alarm set for {sec} seconds, labeled {label}.",
            alarmTriggered: "Alert! Alarm warning triggered: {label}!",
            alarmCleared: "All system alerts have been purged.",
            todoAdded: "Task successfully logged: {task}.",
            todoCleared: "Task queue purged.",
            appOpened: "Accessing sub-matrix: launching {app}.",
            appFail: "Unable to locate application mapping for that system name.",
            mathPrefix: "Computation complete. The result of {expr} is {val}.",
            mathFail: "Unable to parse mathematical instructions, Captain. Please verify syntax.",
            alarmSpeech: "Alert, Captain! A scheduled alarm is firing."
        },
        'ta-IN': {
            greeting: "வணக்கம், நான் ஜார்விஸ். அனைத்து அமைப்புகளும் தயார் நிலையில் உள்ளன. உங்களுக்கு நான் எவ்வாறு உதவ முடியும்?",
            notUnderstand: "மன்னிக்கவும். உங்கள் கட்டளையை என்னால் முழுமையாகப் புரிந்துகொள்ள முடியவில்லை. மீண்டும் கூற முடியுமா?",
            timePrefix: "இப்போதைய நேரம் ",
            datePrefix: "இன்றைய தேதி ",
            weatherSuccess: "{city}-ல் தற்போதைய வெப்பநிலை {temp} டிகிரி செல்சியஸ் ஆகும். அங்கு {desc} வானிலை நிலவுகிறது.",
            weatherFail: "செயற்கைக்கோள் வானிலை தரவைப் பெற முடியவில்லை, கேப்டன்.",
            newsHeader: "முக்கிய செய்திகளின் சுருக்கம்:",
            newsNone: "புதிய செய்தி பதிவுகள் எதுவும் இல்லை.",
            alarmSet: "சரி. {sec} வினாடிகளில் அலாரம் அமைக்கப்பட்டது. பெயர்: {label}.",
            alarmTriggered: "எச்சரிக்கை! அலாரம் ஒலி எழுப்பப்படுகிறது: {label}!",
            alarmCleared: "அனைத்து அலாரங்களும் நீக்கப்பட்டன.",
            todoAdded: "புதிய பணி சேர்க்கப்பட்டது: {task}.",
            todoCleared: "பணிகள் அனைத்தும் நீக்கப்பட்டன.",
            appOpened: "செயலியைத் திறக்கிறேன்: {app}.",
            appFail: "இந்தச் செயலியைத் திறக்க என்னிடம் அனுமதி இல்லை.",
            mathPrefix: "கணக்கீடு முடிந்தது. {expr}-ன் மதிப்பு {val} ஆகும்.",
            mathFail: "கணக்கீட்டு வழிமுறைகளைப் புரிந்துகொள்ள முடியவில்லை.",
            alarmSpeech: "எச்சரிக்கை! அலாரம் மணிகள் ஒலிக்கின்றன."
        }
    },

    translateWeatherDesc(desc, lang) {
        if (lang !== 'ta-IN') return desc;
        // Simple translation map for Tamil weather description
        const taDescMap = {
            "Clear sky": "தெளிவான வானம்",
            "Mainly clear": "பெரும்பாலும் தெளிவான வானம்",
            "Partly cloudy": "பகுதி மேகமூட்டம்",
            "Overcast": "முழு மேகமூட்டம்",
            "Foggy": "அடர்ந்த பனிமூட்டம்",
            "Light drizzle": "மிதமான தூறல்",
            "Moderate drizzle": "மிதமான மழை தூறல்",
            "Dense drizzle": "அடர்ந்த தூறல்",
            "Slight rain": "லேசான மழை",
            "Moderate rain": "மிதமான மழை",
            "Heavy rain": "கனமழை",
            "Thunderstorm": "இடி மின்னலுடன் கூடிய மழை"
        };
        return taDescMap[desc] || desc;
    },

    translateMathExpr(expr, lang) {
        if (lang !== 'ta-IN') return expr;
        return expr
            .replace(/\*/g, 'பெருக்கல்')
            .replace(/\//g, 'வகுத்தல்')
            .replace(/\+/g, 'கூட்டல்')
            .replace(/-/g, 'கழித்தல்');
    }
};
