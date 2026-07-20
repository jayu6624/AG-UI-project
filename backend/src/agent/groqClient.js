import OpenAI from "openai";
import "dotenv/config";

const activeLlm = (process.env.ACTIVE_LLM || "groq").toLowerCase();
const isGemini = activeLlm === "gemini";

if (isGemini && !process.env.GEMINI_API_KEY) {
  console.warn("[llmClient] ACTIVE_LLM is gemini but GEMINI_API_KEY is missing.");
} else if (!isGemini && !process.env.GROQ_API_KEY) {
  console.warn("[llmClient] ACTIVE_LLM is groq but GROQ_API_KEY is missing.");
}

export const groq = new OpenAI({
  apiKey: isGemini ? process.env.GEMINI_API_KEY : process.env.GROQ_API_KEY,
  baseURL: isGemini ? "https://generativelanguage.googleapis.com/v1beta/openai/" : "https://api.groq.com/openai/v1",
});

export const MODEL = isGemini 
  ? (process.env.GEMINI_MODEL || "gemini-2.5-flash")
  : (process.env.GROQ_MODEL || "llama-3.3-70b-versatile");
