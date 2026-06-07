/**
 * JARVIS Conversational AI Engine
 * Manages Gemini API connections, session history context, and offline fallback responses.
 */

const JarvisAI = {
    chatHistory: [], // Stores [{role: 'user'|'model', parts: [{text: '...'}]}]
    maxHistorySize: 12, // Maintain last 6 conversations (user + model turns)

    /**
     * Sends voice query to Gemini API or executes local offline fallback.
     */
    async generateResponse(userText, apiKey, language) {
        // Construct system instruction based on language and personality
        const isTamil = language === 'ta-IN';
        
        const systemInstructionEn = "You are J.A.R.V.I.S., a voice-first AI assistant modeled after Iron Man's JARVIS. Your personality is highly intelligent, professional, friendly, fast, and extremely concise. CRITICAL: Keep your response very brief (1 to 2 sentences, maximum 35 words) because the user will hear your answer read aloud by a text-to-speech engine. Avoid markdown bolding (*), lists, bullet points, or complex punctuation that sounds weird when spoken. Be natural, conversational, and direct.";
        
        const systemInstructionTa = "நீங்கள் ஜார்விஸ் (J.A.R.V.I.S.), ஒரு குரல்வழி செயற்கை நுண்ணறிவு உதவியாளர். உங்கள் பதில் மிகவும் சுருக்கமாக (1 அல்லது 2 வாக்கியங்கள், அதிகபட்சம் 30 வார்த்தைகள்) இருக்க வேண்டும். தமிழ் மொழியில் பதில் கூறவும். எளிமையான, இயற்கையான தமிழில் பேசவும்.";

        const systemInstruction = isTamil ? systemInstructionTa : systemInstructionEn;

        // If no API Key is specified, run the offline fallback responder
        if (!apiKey) {
            console.log("No Gemini API key detected. Running offline conversational logic.");
            return this.getOfflineResponse(userText, isTamil);
        }

        // Format message history for Gemini API
        // Gemini API uses 'user' and 'model' roles. We need to prepend the system instruction.
        // We can use the systemInstruction in the request parameter if using beta, or prepend to user prompt.
        // Prepending or systemInstruction configuration is cleanest. Let's make a standard contents payload.
        try {
            // Append user message to local history
            this.chatHistory.push({
                role: 'user',
                parts: [{ text: userText }]
            });

            // Keep history trimmed
            if (this.chatHistory.length > this.maxHistorySize) {
                this.chatHistory.shift();
            }

            // Construct full payload including system instruction as a system instruction configuration
            // or as a special role: system
            const requestBody = {
                contents: this.chatHistory,
                systemInstruction: {
                    parts: [{ text: systemInstruction }]
                },
                generationConfig: {
                    maxOutputTokens: 120,
                    temperature: 0.7
                }
            };

            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errData = await response.json();
                console.error("Gemini API error", errData);
                throw new Error("Gemini API connection error code: " + response.status);
            }

            const data = await response.json();
            const replyText = data.candidates[0].content.parts[0].text.trim();

            // Append response to history
            this.chatHistory.push({
                role: 'model',
                parts: [{ text: replyText }]
            });

            return replyText;

        } catch (error) {
            console.error("Gemini API failed, switching to offline fallback", error);
            // Remove the last user message from history as it failed
            this.chatHistory.pop();
            return this.getOfflineResponse(userText, isTamil) + " (Offline Mode)";
        }
    },

    /**
     * Local Offline Conversational fallback with clever keyword responses
     */
    getOfflineResponse(phrase, isTamil) {
        const text = phrase.toLowerCase().trim();

        if (isTamil) {
            // TAMIL OFFLINE RESPONSES
            if (text.includes("யார் நீ") || text.includes("உன் பெயர்")) {
                return "நான் ஜார்விஸ். உங்கள் குரல்வழி செயற்கை நுண்ணறிவு உதவியாளர்.";
            }
            if (text.includes("எப்படி இருக்கிறாய்") || text.includes("நலம்")) {
                return "நான் சிறப்பாக உள்ளேன், கேப்டன். எனக்கு நீங்கள் கட்டளையிடலாம்.";
            }
            if (text.includes("நன்றி")) {
                return "மகிழ்ச்சி கேப்டன். வேறேதும் உதவி தேவையா?";
            }
            if (text.includes("வணக்கம்") || text.includes("ஹலோ")) {
                return "வணக்கம் கேப்டன். உங்கள் கட்டளைக்காக காத்திருக்கிறேன்.";
            }
            if (text.includes("யார் டோனி ஸ்டார்க்") || text.includes("டோனி ஸ்டார்க்")) {
                return "டோனி ஸ்டார்க் என் படைப்பாளர். அவர் ஒரு சிறந்த தொழில்நுட்ப மேதை.";
            }
            if (text.includes("நகைச்சுவை") || text.includes("கதை")) {
                return "ஒரு கணிப்பொறி ஏன் மருத்துவமனைக்குச் சென்றது? அதற்கு வைரஸ் இருந்ததால்!";
            }
            return "உள்ளூர் ஆஃப்லைன் பயன்முறையில் இதற்கான விடையை என்னால் பெற முடியவில்லை. தயவுசெய்து செட்டிங்ஸ் பக்கத்தில் ஜெமினி ஏபிஐ கீ உள்ளிடவும்.";
        } else {
            // ENGLISH OFFLINE RESPONSES
            if (text.includes("who are you") || text.includes("your name")) {
                return "I am J.A.R.V.I.S., your cybernetic virtual assistant. Standing by.";
            }
            if (text.includes("how are you") || text.includes("how is it going")) {
                return "All subsystems are nominal, Captain. Energy levels at one hundred percent. How can I assist you?";
            }
            if (text.includes("hello") || text.includes("hi jarvis") || text.includes("hey jarvis")) {
                return "Hello Captain. Listening for your voice commands.";
            }
            if (text.includes("thank you") || text.includes("thanks")) {
                return "At your service, Captain. It is always a pleasure.";
            }
            if (text.includes("who is tony stark") || text.includes("iron man")) {
                return "Tony Stark is my developer in the cinematic universe. A visionary billionaire, playboy, philanthropist.";
            }
            if (text.includes("joke") || text.includes("make me laugh")) {
                const jokes = [
                    "Why did the computer go to the doctor? Because it had a virus!",
                    "There are 10 types of people in the world: those who understand binary, and those who don't.",
                    "Why did the developer go broke? Because he used up all his cache!"
                ];
                return jokes[Math.floor(Math.random() * jokes.length)];
            }
            if (text.includes("what is your purpose") || text.includes("what can you do")) {
                return "I manage your environment. I can tell weather, read news, set alarms, log tasks, and converse using artificial intelligence.";
            }
            return "My local database doesn't have an answer for that. Please insert a Gemini API Key in Settings to enable advanced cognitive reasoning.";
        }
    },

    /**
     * Clears history cache
     */
    purgeHistory() {
        this.chatHistory = [];
    }
};
