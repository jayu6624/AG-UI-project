# Dynamic UI / Generative UI POC

A working proof of concept: a user chats in natural language, a Groq-powered
LLM agent decides whether to answer with plain text or with a structured UI
payload (cards, charts, tables, forms, buttons, images, lists), and a React
frontend renders whichever components the agent chose — all validated
against a schema so bad LLM output can never crash the UI.

## Stack

- **Frontend:** React 18 + Vite (plain JS/JSX, no TypeScript, to keep the POC simple)
- **Backend:** Node.js + Express (JavaScript, ESM)
- **LLM:** Groq API (`groq-sdk`), default model `llama-3.3-70b-versatile`
- **Validation:** Zod
- **Agent workflow:** hand-rolled state machine shaped like a LangGraph graph (see below) — no LangGraph/AG-UI packages installed, but the seams are documented so you can swap them in later without changing calling code.

## Run it

### 1. Backend
```bash
cd backend
npm install
cp .env.example .env
# edit .env and paste your GROQ_API_KEY
npm start
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
  ├─ agentNode        → Groq LLM decides: answer directly OR call a tool
  ├─ toolNode         → runs mock tool(s) from tools/index.js
  ├─ generateUINode   → Groq LLM (JSON mode) turns tool result into {blocks:[...]}
  └─ validateNode     → Zod schema check; 1 retry; hard fallback to a text block
  │
  ▼
AG-UI-lite events (agent/agUiLite.js) — SSE: run.start / tool.call / tool.result / ui.blocks / run.end
  │
  ▼
Frontend DynamicRenderer (components/registry.jsx)
  │
  ┌────────┼─────────┬────────┬────────┬────────┬────────┬────────┐
  ▼        ▼         ▼        ▼        ▼        ▼        ▼        ▼
 text     card      button   chart    table    form     image    list
```

### Where things live
- **UI schema (contract):** `backend/src/agent/schema.js` — Zod discriminated union, one variant per block type.
- **System prompt teaching the LLM the schema:** `backend/src/agent/systemPrompt.js`
- **Mock tools + their function-calling definitions:** `backend/src/tools/index.js`
- **Agent graph:** `backend/src/agent/workflow.js`
- **AG-UI-lite event envelope:** `backend/src/agent/agUiLite.js`
- **Component registry (type → component):** `frontend/src/components/registry.jsx`
- **Actual components:** `frontend/src/components/blocks.jsx`
- **Chat UI + SSE client:** `frontend/src/App.jsx`, `frontend/src/api/chat.js`

### How a new UI component type is added
1. Add the Zod variant in `backend/src/agent/schema.js`.
2. Mention its shape in `backend/src/agent/systemPrompt.js` so the LLM knows to emit it.
3. Add a React component in `frontend/src/components/blocks.jsx`.
4. Register it in `frontend/src/components/registry.jsx`.
The renderer picks up unregistered/invalid types gracefully (shows a small warning block, never crashes — see `DynamicRenderer`).

## Honest scope notes (what's real vs. simplified)

| Area | Status | Notes |
|---|---|---|
| Dynamic UI generation | ✅ | LLM emits `{blocks:[...]}`; multiple block types can combine in one turn |
| Structured output | ✅ | Groq JSON mode (`response_format: json_object`) + Zod validation |
| UI component registry | ✅ | `registry.jsx`, extensible, documented above |
| Tool calling | ✅ | Real Groq function-calling; 5 mock tools |
| Schema validation | ✅ | Zod, with 1 automatic LLM retry, then a safe text fallback — invalid data never crashes the frontend |
| UI interactions (buttons/forms) | ✅ | Click/submit → `/api/action` → tool or agent continuation → new blocks rendered |
| Streaming | ⚠️ | Backend streams AG-UI-lite *events* over SSE (tool calls, then final blocks); it does **not** token-stream the LLM's text itself. Good enough to show progress states, not a true typing effect. |
| AG-UI protocol | ⚠️ | `agUiLite.js` is a **custom, lightweight** event envelope inspired by AG-UI's event-stream shape — not the official `@ag-ui/*` packages. Clearly labeled as such in code comments. |
| LangGraph | ⚠️ | `workflow.js` is a **hand-rolled** node/edge state machine with the same shape LangGraph would produce (`agentNode → toolNode → generateUINode → validateNode`). No `langgraph` dependency installed. |
| Security hardening | ⚠️ | No `dangerouslySetInnerHTML` anywhere; all data goes through Zod; image URLs are validated as URLs and fail gracefully via `onError`. No rate limiting, auth, or LLM timeout/retry-on-network-error yet. |
| Human-in-the-loop / shared state / multi-agent | ❌ | Not built — out of scope for this POC, listed below as Priority 3. |

## Priority roadmap

**Priority 1 — Critical (before calling this a solid POC)**
- Add a request timeout + retry around the Groq calls (network failures currently just surface as `run.error`).
- Persist chat history server-side per session instead of trusting the client-sent `history` array.
- Add basic input length limits / rate limiting on `/api/chat`.

**Priority 2 — Important (stronger agentic/AG-UI implementation)**
- Swap `agent/workflow.js` for a real LangGraph `StateGraph` (nodes are already pure functions, so this is a low-risk refactor).
- Swap `agent/agUiLite.js` for the official AG-UI client/server packages for real interoperability with other AG-UI frontends.
- True token-level streaming of the "text" portions while structured blocks resolve.

**Priority 3 — Optional / advanced**
- Human-in-the-loop confirmation before "destructive" tool calls (e.g. confirm before `create_customer` actually persists).
- Shared/persistent state across turns (e.g. remembered filters, cart).
- Predictive UI (pre-fetching likely next tool calls).
- Multi-agent workflows (e.g. a routing agent + specialist agents per domain).
