# AI Canvas (Dynamic UI POC)

A working proof of concept: a user chats in natural language, a Multi-LLM powered agent decides whether to answer with plain text or with a structured UI payload (cards, charts, tables, forms, buttons, images, lists), and a React frontend renders whichever components the agent chose.

The UI supports **real-time token streaming** (using a partial-json parser) so the interface updates as the AI thinks! Everything is validated against a schema so bad LLM output never crashes the UI.

## Stack

- **Frontend:** React 18 + Vite (plain JS/JSX, no TypeScript, to keep the POC simple)
- **Backend:** Node.js + Express (JavaScript, ESM)
- **LLM:** Multi-LLM Support (Groq and Gemini API) using the standard `openai` SDK.
- **Validation:** Zod
- **Agent workflow:** Hand-rolled state machine shaped like a LangGraph graph (see below) — no LangGraph/AG-UI packages installed, but the seams are documented so you can swap them in later without changing calling code.

## Run it locally

### 1. Backend
```bash
cd backend
npm install
cp .env.example .env
# Edit .env and paste your API Keys (Groq and/or Gemini)
# Run the dev server
npm run dev
# -> http://localhost:8787
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
# -> http://localhost:5173  (proxies /api to :8787, see vite.config.js)
```

Open `http://localhost:5173` and try the suggestion chips, or type:
- "Show me some hotels in Ahmedabad"
- "Show me the sales performance for the last 6 months"
- "Create a new customer"
- "Show me products under ₹5000"
- "Get my latest orders"
- "Hello, how are you?"

## Architecture actually implemented

```
USER
  │
  ▼
React Frontend (App.jsx) — chat interface, SSE consumer
  │  POST /api/chat  { message, history }
  ▼
Express route (routes/chat.js)
  │
  ▼
Agent workflow (agent/workflow.js) — LangGraph-shaped state machine
  ├─ agentNode        → LLM decides: answer directly OR call a tool
  ├─ toolNode         → runs mock tool(s) from tools/index.js
  ├─ generateUINode   → LLM (JSON mode) turns tool result into {blocks:[...]}
  └─ validateNode     → Zod schema check; 1 retry; hard fallback to a text block
  │
  ▼
AG-UI-lite events (agent/agUiLite.js) — SSE Stream: run.start / tool.call / ui.stream (partial JSON) / ui.blocks / run.end
  │
  ▼
Frontend DynamicRenderer (components/registry.jsx) + partial-json logic
  │
  ┌────────┼─────────┬────────┬────────┬────────┬────────┬────────┐
  ▼        ▼         ▼        ▼        ▼        ▼        ▼        ▼
 text     card      button   chart    table    form     image    list
```

## Features & Honest Scope Notes

| Area | Status | Notes |
|---|---|---|
| Multi-LLM Support | ✅ | Switch instantly between Gemini (e.g. `gemini-2.5-flash`) and Groq (e.g. `llama-3.3-70b-versatile`) by setting `ACTIVE_LLM=gemini` in `.env`. |
| Dynamic UI generation | ✅ | LLM emits `{blocks:[...]}`; multiple block types can combine in one turn. |
| Streaming | ✅ | Supports **real-time token-level streaming**. As the LLM types out JSON, the frontend safely parses incomplete objects using `partial-json` and renders UI elements immediately! |
| Tool calling | ✅ | True function-calling supported seamlessly across Groq and Gemini; includes 5 mock tools with rich emojis. |
| Schema validation | ✅ | Zod, with 1 automatic LLM retry, then a safe text fallback — invalid data never crashes the frontend. |
| UI interactions | ✅ | Buttons and Forms. Click/submit → `/api/action` → tool or agent continuation → new blocks rendered. |
| LangGraph | ⚠️ | `workflow.js` is a **hand-rolled** node/edge state machine with the same shape LangGraph would produce (`agentNode → toolNode → generateUINode → validateNode`). |
| Human-in-the-loop | ❌ | Not built — out of scope for this POC. |
