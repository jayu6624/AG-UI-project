import Groq from "groq-sdk";

const client = new Groq({
  apiKey: "test", // Doesn't matter if it fails auth, we just want to see if it reaches the Gemini endpoint
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
});

async function test() {
  try {
    const res = await client.chat.completions.create({
      model: "gemini-2.5-flash",
      messages: [{ role: "user", content: "hi" }]
    });
    console.log(res);
  } catch(e) {
    console.log("Error:", e.message);
  }
}
test();
