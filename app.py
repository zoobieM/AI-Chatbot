# app.py — Free AI Chatbot (Groq + Flask + File Input Support)

import os
from flask import Flask, request, jsonify, render_template
from dotenv import load_dotenv
from groq import Groq

# Load environment variables
load_dotenv()

app = Flask(__name__, template_folder="templates", static_folder="static")

# Initialize Groq client
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json() or {}
    user_msg = data.get("message", "").strip()

    if not user_msg:
        return jsonify({"reply": "Please type something!"})

    try:
        # Send to Groq API
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",   # FREE MODEL
            messages=[
                {"role": "system", "content": "You are a helpful AI assistant."},
                {"role": "user", "content": user_msg}
            ],
            max_tokens=500
        )

        reply = response.choices[0].message.content
        return jsonify({"reply": reply})

    except Exception as e:
        return jsonify({"reply": f"Error: {str(e)}"})


if __name__ == "__main__":
    # Run the server
    app.run(host="0.0.0.0", port=7860, debug=True)
