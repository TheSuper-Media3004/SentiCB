import os
import json
import logging
import requests
import torch
import pandas as pd
import re
import nltk
from collections import Counter

nltk.download('punkt')
nltk.download('punkt_tab')
from nltk.tokenize import sent_tokenize

from flask import Flask, request, jsonify, render_template, session
from dotenv import load_dotenv
import google.generativeai as genai
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from bs4 import BeautifulSoup


logging.basicConfig(level=logging.INFO)


load_dotenv()

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "default-insecure-secret-key")


api_key = os.getenv("GEMINI_API_KEY")
genai_configured = False
if api_key:
    try:
        genai.configure(api_key=api_key)
        genai_configured = True
        logging.info("Gemini API configured.")
    except Exception as e:
        logging.error(f"Error configuring Gemini API: {e}")
else:
    logging.error("GEMINI_API_KEY not found. Gemini disabled.")


MODEL_PATH = "cardiffnlp/twitter-roberta-base-sentiment-latest"
HATE_MODEL_PATH = "unitary/toxic-bert"

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
bert_configured = False
hate_configured = False

try:
    tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
    bert_model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)
    bert_model.to(device)
    bert_model.eval()
    bert_configured = True
    labels = {0: "negative", 1: "neutral", 2: "positive"}
    logging.info("Sentiment model loaded from %s.", MODEL_PATH)
except Exception as e:
    logging.error(f"Error loading sentiment model: {e}")

try:
    hate_tokenizer = AutoTokenizer.from_pretrained(HATE_MODEL_PATH)
    hate_model = AutoModelForSequenceClassification.from_pretrained(HATE_MODEL_PATH)
    hate_model.to(device)
    hate_model.eval()
    hate_configured = True
    logging.info("Hate speech model loaded from %s.", HATE_MODEL_PATH)
except Exception as e:
    logging.error(f"Error loading hate speech model: {e}")

def preprocess_tweet(text):
    text = re.sub(r"(@[A-Za-z0-9_]+)", "@user", text)
    text = re.sub(r"(https?://[^\s]+)", "http", text)
    return text

def upload_to_ipfs_web3_storage(json_data):
    WEB3_STORAGE_TOKEN = os.getenv("WEB3_STORAGE_TOKEN")
    if not WEB3_STORAGE_TOKEN:
        logging.error("WEB3_STORAGE_TOKEN not found.")
        return None

    headers = {"Authorization": f"Bearer {WEB3_STORAGE_TOKEN}"}
    files = {
        'file': ('sentiment_analysis.json', json.dumps(json_data), 'application/json')
    }
    try:
        resp = requests.post('https://api.web3.storage/upload', headers=headers, files=files)
        resp.raise_for_status()
        cid = resp.json().get("cid")
        logging.info(f"Uploaded to IPFS: {cid}")
        return cid
    except Exception as e:
        logging.error(f"IPFS upload failed: {e}")
        return None


@app.route('/')
def index():
    if 'user_id' not in session:
        session['user_id'] = f"user_{os.urandom(4).hex()}"
        logging.info(f"New session: {session['user_id']}")
    return render_template('index.html')



BAD_WORDS = {"retard", "idiot", "stupid", "moron", "fool", "dumb", "trash", "garbage", "bastard", "ass", "shit", "fuck",
             "dick", "bitch"}


def analyze_with_bert(text):

    sentences = sent_tokenize(text) if len(text) > 100 else [text]

    results = []
    any_hate = False

    for sentence in sentences:
        sentence = preprocess_tweet(sentence)
        contains_bad_word = any(word in sentence.lower() for word in BAD_WORDS)
        vulgar_but_positive = False

        inputs = tokenizer(sentence, return_tensors="pt", truncation=True,
                            padding="max_length", max_length=128)
        inputs = {k: v.to(device) for k, v in inputs.items()}
        with torch.no_grad():
            outputs = bert_model(**inputs)
            probs = torch.nn.functional.softmax(outputs.logits, dim=1)
            idx = torch.argmax(probs, dim=1).item()
            conf = probs[0][idx].item()

        sentiment = labels[idx]

        hate_inputs = hate_tokenizer(sentence, return_tensors="pt", truncation=True,
                                     padding="max_length", max_length=128)
        hate_inputs = {k: v.to(device) for k, v in hate_inputs.items()}
        with torch.no_grad():
            hate_outputs = hate_model(**hate_inputs)
            hate_probs = torch.nn.functional.softmax(hate_outputs.logits, dim=1)
            hate_idx = torch.argmax(hate_probs, dim=1).item()
            hate_conf = hate_probs[0][hate_idx].item()

        is_toxic = hate_idx == 1 and hate_conf > 0.75
        if is_toxic:
            any_hate = True

            if sentiment == "positive" and conf < 0.85:
                sentiment = "neutral"
                conf = 0.6

        if contains_bad_word:
            if sentiment == "positive" and conf < 0.75:
                sentiment = "neutral"
                conf = 0.6
            elif sentiment == "neutral":
                conf = min(conf, 0.5)

        results.append({
            "sentence": sentence,
            "sentiment": sentiment,
            "confidence": round(conf, 4),
            "hate_speech": is_toxic,
            "hate_confidence": round(hate_conf, 4),
            "bad_word": contains_bad_word,
            "vulgar_but_positive": vulgar_but_positive
        })


    counts = Counter(r["sentiment"] for r in results)
    if counts["positive"] > counts["negative"] and counts["positive"] > counts["neutral"]:
        overall = "positive"
    elif counts["negative"] > counts["positive"] and counts["negative"] > counts["neutral"]:
        overall = "negative"
    else:
        overall = "neutral"

    confidences = [r["confidence"] for r in results if r["sentiment"] == overall]
    overall_conf = round(sum(confidences) / len(confidences), 4) if confidences else 0.0

    return {
        "text": text,
        "sentiment": overall,
        "confidence": overall_conf,
        "hate_speech": any_hate,
        "details": results
    }




@app.route('/api/analyze', methods=['POST'])
def analyze_sentiment():
    if not bert_configured:
        return jsonify({"error": "Sentiment model not available"}), 503

    try:
        if 'file' in request.files:
            file = request.files['file']
            df = pd.read_csv(file)
            if 'text' not in df.columns:
                return jsonify({"error": "CSV must have a 'text' column"}), 400

            results = [analyze_with_bert(str(txt)) for txt in df['text']]
            return jsonify({"analysis": results})

        data = request.get_json() or {}

        if data.get('text'):
            return jsonify(analyze_with_bert(data['text']))

        if data.get('url'):
            page = requests.get(data['url'], timeout=5)
            soup = BeautifulSoup(page.content, 'html.parser')
            full_text = soup.get_text(separator=' ', strip=True)
            snippet = full_text[:512]
            return jsonify(analyze_with_bert(snippet))

        return jsonify({"error": "No input provided (send 'file', 'text', or 'url')"}), 400

    except Exception as e:
        logging.exception("Error in sentiment analysis")
        return jsonify({"error": "Internal sentiment analysis error"}), 500


@app.route('/api/chat', methods=['POST'])
def handle_chat():
    if not genai_configured:
        return jsonify({"error": "Chatbot is temporarily unavailable"}), 503

    user_id = session.get('user_id', 'anonymous')

    try:
        data = request.get_json()
        user_message = data.get('message')
        original_text_snippet = data.get('originalText')
        analysis_results = data.get('analysisResults')

        if not user_message:
            return jsonify({"error": "Missing 'message' in request"}), 400

        if original_text_snippet and analysis_results:
            analysis_str = json.dumps(analysis_results, indent=2)
            context = f"""
--- Original Text Snippet ---
{original_text_snippet}

--- Analysis Results ---
{analysis_str[:2500]}{'...' if len(analysis_str) > 2500 else ''}
"""
        else:
            context = (
                "The user has not provided specific document text or analysis results yet. "
                "Answer generally or ask them to analyze first."
            )

        prompt = f"""
You are a helpful AI assistant in the 'SentimentChain' app.
Use ONLY the provided context below. Do not hallucinate.

{context}

User Question:
{user_message}

Answer:
"""

        model = genai.GenerativeModel('gemini-2.0-flash')
        response = model.generate_content(
            prompt,
            safety_settings=[
                {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
                {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
                {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
                {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
            ]
        )

        if not response.candidates:
            return jsonify({"reply": "I cannot provide an answer."}), 200

        ai_reply = response.text
        payload = {
            "user_id": user_id,
            "original_text": original_text_snippet,
            "analysis_results": analysis_results,
            "gemini_reply": ai_reply
        }
        cid = upload_to_ipfs_web3_storage(payload)

        return jsonify({
            "reply": ai_reply,
            "ipfs_cid": cid,
            "ipfs_url": f"https://{cid}.ipfs.w3s.link" if cid else None
        })

    except Exception as e:
        logging.exception("Error in /api/chat")
        return jsonify({"error": "Internal server error"}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)
