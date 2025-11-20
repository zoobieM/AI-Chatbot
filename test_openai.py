# test_openai.py
from dotenv import load_dotenv
import os
import traceback
from openai import OpenAI
import json

load_dotenv()
print("OPENAI_API_KEY visible:", bool(os.environ.get("OPENAI_API_KEY")))

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

def try_responses(model):
    print("\n--- Trying Responses API with model:", model)
    try:
        resp = client.responses.create(
            model=model,
            instructions="You are a helpful assistant.",
            input="Hello, test.",
            max_output_tokens=50
        )
        # try to show simple text if present
        text = getattr(resp, "output_text", None)
        print("OK. output_text:", text)
        print("Full resp object:", resp)
    except Exception as e:
        print("Exception type:", type(e).__name__)
        print("Exception str:", str(e))
        # try to print extra details if present
        try:
            # some SDK exceptions provide .http_body or .args
            body = getattr(e, "http_body", None) or getattr(e, "body", None)
            if body:
                print("HTTP/body from exception:", body)
            # some exceptions keep JSON in args
            if hasattr(e, "args") and e.args:
                for a in e.args:
                    try:
                        j = json.loads(a)
                        print("Parsed JSON from args:", json.dumps(j, indent=2))
                        break
                    except Exception:
                        pass
        except Exception:
            pass
        traceback.print_exc()

def try_chat_completion(model):
    print("\n--- Trying Chat Completions API with model:", model)
    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[{"role":"user","content":"Hello test."}],
            max_tokens=50
        )
        print("OK. choices[0].message:", resp.choices[0].message)
    except Exception as e:
        print("Exception type:", type(e).__name__)
        print("Exception str:", str(e))
        traceback.print_exc()

if __name__ == "__main__":
    # Try a few models (Responses API)
    for m in ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo", "gpt-4o-mini-tts"]:
        try_responses(m)

    # Fallback: try chat completions on a common model
    try_chat_completion("gpt-3.5-turbo")
    print("\nFinished tests.")
