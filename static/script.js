/* full script.js — unified, robust client for the upgraded UI
   Features:
   - addMessage (bubbles)
   - typing animation
   - sendMessage (POST /chat)
   - robust Speech-to-Text using Web Speech API
   - Text-to-Speech using SpeechSynthesis
   - File upload (text/plain, .md, .json supported client-side; images and pdfs handled gracefully)
   - Dark mode toggle
   - Console logging for debugging
*/

/* ------------------------------
   Utility: add message bubble
   ------------------------------ */
function addMessage(text, sender = "bot") {
    const chatBox = document.getElementById("chatBox");
    const msg = document.createElement("div");
    msg.classList.add("message", sender);
    msg.innerText = text;
    chatBox.appendChild(msg);
    chatBox.scrollTop = chatBox.scrollHeight;
}

/* ------------------------------
   Typing effect (non-blocking)
   callback receives incremental text
   ------------------------------ */
function typeWriterEffect(text, onUpdate, speed = 12) {
    let i = 0;
    let out = "";
    (function type() {
        if (i < text.length) {
            out += text.charAt(i++);
            onUpdate(out);
            setTimeout(type, speed);
        }
    })();
}

/* ------------------------------
   Text-to-Speech (browser)
   ------------------------------ */
function speak(text) {
    try {
        if (!("speechSynthesis" in window)) return;
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = "en-US";
        // you can set voice, rate, pitch here if you like
        speechSynthesis.cancel(); // stop previous
        speechSynthesis.speak(utter);
    } catch (e) {
        console.warn("TTS error:", e);
    }
}

/* ------------------------------
   sendMessage: sends message to backend
   Accepts optional customText to bypass input box
   ------------------------------ */
async function sendMessage(customText = null) {
    const inputEl = document.getElementById("userInput");
    const raw = customText !== null ? customText : inputEl.value.trim();
    if (!raw) return;

    // show user bubble
    addMessage(raw, "user");
    inputEl.value = "";

    // show temporary typing bubble so user has feedback
    const chatBox = document.getElementById("chatBox");
    const loading = document.createElement("div");
    loading.classList.add("message", "bot");
    loading.innerText = "Typing...";
    chatBox.appendChild(loading);
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
        const res = await fetch("/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: raw })
        });

        const data = await res.json();
        loading.remove();

        // prefer reply, but show error details if present
        const replyText = data.reply || (data.error ? `${data.error}${data.detail ? " — " + data.detail : ""}` : "No reply.");
        // typing animation into a new bubble
        const bubble = document.createElement("div");
        bubble.classList.add("message", "bot");
        chatBox.appendChild(bubble);

        typeWriterEffect(replyText, (partial) => {
            bubble.innerText = partial;
            chatBox.scrollTop = chatBox.scrollHeight;
        });

        // speak the final reply after a short delay (to allow type effect)
        setTimeout(() => speak(replyText), Math.min(600, replyText.length * 6));

    } catch (err) {
        loading.remove();
        console.error("Network / fetch error:", err);
        addMessage("Error connecting to server.", "bot");
    }
}

/* ------------------------------
   File upload handler
   - supports text/*, .md, .json client-side
   - for images/PDFs we notify and optionally send a simple description
   ------------------------------ */
function initFileUpload() {
    const fileBtn = document.getElementById("fileBtn");
    const fileInput = document.getElementById("fileInput");

    fileBtn.onclick = () => fileInput.click();

    fileInput.onchange = async function () {
        const file = this.files[0];
        if (!file) return;

        // simple size guard
        if (file.size > 4 * 1024 * 1024) { // 4MB limit in UI
            addMessage("File too large (max 4MB).", "bot");
            return;
        }

        addMessage(`Uploaded file: ${file.name} (processing...)`, "bot");

        const type = file.type || "";
        try {
            if (type.startsWith("text/") || file.name.endsWith(".md") || file.name.endsWith(".json")) {
                // read plain text
                const text = await file.text();
                // send file contents as a message (prefix so bot knows it's file content)
                sendMessage(`FILE_CONTENT_START\nFilename: ${file.name}\n\n${text}\n\nFILE_CONTENT_END`);
            } else if (type.startsWith("image/")) {
                // images: we cannot parse image on client without extra libs; send a short descriptor
                sendMessage(`I uploaded an image: ${file.name}. Please describe how to analyze it or tell me to ignore.`);
            } else if (file.name.toLowerCase().endsWith(".pdf")) {
                // PDFs require parsing (not implemented here). Offer helpful instructions.
                addMessage("PDF detected. This demo cannot extract PDF text in-browser. Please copy-paste the PDF text or use a .txt/.md file.", "bot");
            } else {
                // fallback: send name and size
                sendMessage(`I uploaded a file: ${file.name} (type: ${file.type || "unknown"}).`);
            }
        } catch (e) {
            console.error("File read error", e);
            addMessage("Failed to read file.", "bot");
        } finally {
            // clear input so same file can be uploaded again later
            fileInput.value = "";
        }
    };
}

/* ------------------------------
   Robust Speech-to-Text block
   - handles both SpeechRecognition and webkitSpeechRecognition
   - uses navigator.mediaDevices.getUserMedia to trigger permission prompt in some browsers
   - interim results shown in input box
   ------------------------------ */
function initMic() {
    const micBtn = document.getElementById("micBtn");
    const inputEl = document.getElementById("userInput");

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;
    if (!SpeechRecognition) {
        micBtn.disabled = true;
        micBtn.innerText = "Mic Unsupported";
        console.warn("SpeechRecognition not supported in this browser.");
        return;
    }

    let recognition = new SpeechRecognition();
    let recognizing = false;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
        recognizing = true;
        micBtn.innerText = "🎙 Listening...";
        console.log("[Speech] started");
    };

    recognition.onend = () => {
        recognizing = false;
        micBtn.innerText = "🎤 Speak";
        console.log("[Speech] ended");
    };

    recognition.onerror = (event) => {
        recognizing = false;
        micBtn.innerText = "🎤 Speak";
        console.error("[Speech] error", event);
        if (event.error === "not-allowed" || event.error === "permission-denied") {
            alert("Microphone permission denied. Check browser site settings and allow the microphone for this site.");
        } else if (event.error === "no-speech") {
            addMessage("No speech detected — try again.", "bot");
        } else {
            addMessage("Speech recognition error: " + event.error, "bot");
        }
    };

    recognition.onresult = (event) => {
        let interim = "";
        let finalTranscript = "";
        for (let i = 0; i < event.results.length; i++) {
            const res = event.results[i];
            if (res.isFinal) {
                finalTranscript += res[0].transcript;
            } else {
                interim += res[0].transcript;
            }
        }

        console.log("[Speech] interim:", interim, "final:", finalTranscript);

        // show interim result in input
        if (interim) {
            inputEl.value = interim;
        }
        if (finalTranscript) {
            inputEl.value = "";
            sendMessage(finalTranscript);
        }
    };

    micBtn.onclick = async () => {
        try {
            if (!recognizing) {
                // requesting mic permission explicitly helps in some browsers
                try {
                    await navigator.mediaDevices.getUserMedia({ audio: true });
                } catch (permErr) {
                    console.warn("getUserMedia error:", permErr);
                    alert("Microphone access blocked. Please allow the microphone in the browser site settings.");
                    return;
                }
                recognition.start();
            } else {
                recognition.stop();
            }
        } catch (err) {
            console.error("[Speech] start error:", err);
            addMessage("Speech start error: " + String(err), "bot");
        }
    };
}

/* ------------------------------
   Dark mode toggle init
   ------------------------------ */
function initThemeToggle() {
    const btn = document.getElementById("themeBtn");
    btn.onclick = () => {
        document.body.classList.toggle("dark");
        // optional: persist theme in localStorage
        localStorage.setItem("chat_theme_dark", document.body.classList.contains("dark") ? "1" : "0");
    };
    // restore if saved
    if (localStorage.getItem("chat_theme_dark") === "1") {
        document.body.classList.add("dark");
    }
}

/* ------------------------------
   Wire up send button and Enter key
   ------------------------------ */
function initInputHandlers() {
    const sendBtn = document.querySelector(".input-area button");
    const inputEl = document.getElementById("userInput");
    sendBtn.onclick = () => sendMessage();
    inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") sendMessage();
    });
}

/* ------------------------------
   Initialize everything on DOM load
   ------------------------------ */
document.addEventListener("DOMContentLoaded", () => {
    try {
        initThemeToggle();
        initInputHandlers();
        initFileUpload();
        initMic();

        // small welcome message
        addMessage("Hi! I can chat, listen, speak, and accept small files. Try the mic or upload a text file.", "bot");
        console.log("Client script initialized.");
    } catch (initErr) {
        console.error("Initialization error:", initErr);
        addMessage("Client initialization error. See console.", "bot");
    }
});
