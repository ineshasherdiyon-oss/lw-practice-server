// minimal-practice-server.js
import express from "express";
import fetch from "node-fetch";
import rateLimit from "express-rate-limit";

const app = express();
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-pro";
const GEMINI_AUTH_TYPE = (process.env.GEMINI_AUTH_TYPE || "key").toLowerCase();
const PORT = process.env.PORT || 3000;

if (!GEMINI_API_KEY) console.error("⚠️ Missing GEMINI_API_KEY");

const limiter = rateLimit({ windowMs: 60000, max: 60 });
app.use("/api/", limiter);

async function callGemini(systemPrompt, userMessage) {
  let url = `https://generativelanguage.googleapis.com/v1beta2/models/${GEMINI_MODEL}:generate`;
  if (GEMINI_AUTH_TYPE === "key") url += `?key=${GEMINI_API_KEY}`;
  const headers = { "Content-Type": "application/json" };
  if (GEMINI_AUTH_TYPE === "bearer") headers["Authorization"] = `Bearer ${GEMINI_API_KEY}`;
  const body = {
    model: GEMINI_MODEL,
    prompt: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage }
    ],
    temperature: 0.0,
    max_output_tokens: 700
  };
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  const json = await res.json();
  const content = json?.candidates?.[0]?.content || json?.output?.[0]?.content || JSON.stringify(json);
  return { content, raw: json };
}

app.post("/api/practice", async (req, res) => {
  try {
    const { targetText = "", transcript = "", mode = "shadow", level = "A1" } = req.body;
    if (!targetText) return res.status(400).json({ error: "Missing targetText" });
    const systemPrompt = "You are a Sri Lankan spoken English tutor. Return JSON with: score(0-100), corrected, fluency, pronunciation, errors[], tips[], practice_variation, Sinhala explanation if requested. ONLY valid JSON.";
    const userMessage = `Target: "${targetText}"\nTranscript: "${transcript}"\nMode: ${mode}\nLevel: ${level}`;
    const { content } = await callGemini(systemPrompt, userMessage);
    let parsed;
    try { parsed = JSON.parse(content); } catch { parsed = { parse_error: true, raw: content }; }
    res.json({ feedback: parsed });
  } catch (err) {
    res.status(500).json({ error: "Server error", detail: err.message });
  }
});

app.get("/", (req, res) => res.send("Practice server running ✔"));
app.listen(PORT, () => console.log(`Server running on port ${PORT} ✔`));
