import React, { useRef, useState } from "react";
import { DynamicRenderer } from "./components/registry.jsx";
import { sendChatMessage, sendAction } from "./api/chat.js";
import { parsePartialBlocks } from "./utils/partial-json.js";

const SUGGESTIONS = [
  "Show me some hotels in Ahmedabad",
  "Show me the sales performance for the last 6 months",
  "Create a new customer",
  "Show me products under ₹5000",
  "Get my latest orders",
  "Hello, how are you?",
];

let idCounter = 0;
const nextId = () => `msg_${++idCounter}`;

export default function App() {
  const [messages, setMessages] = useState([
    {
      id: nextId(),
      role: "assistant",
      blocks: [
        {
          type: "text",
          content: "Hi! I'm a generative-UI agent 👋 Ask me about hotels, sales, products, orders, or say hello.",
        },
      ],
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [statusLine, setStatusLine] = useState("");
  const [streamingBlocks, setStreamingBlocks] = useState(null);
  const historyRef = useRef([]); // plain {role, content} pairs for LLM context
  const chatEndRef = useRef(null);

  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingBlocks, statusLine]);

  function pushMessage(msg) {
    setMessages((prev) => [...prev, { id: nextId(), ...msg }]);
  }

  async function runTurn(streamFn, streamArgs, userVisibleText) {
    setBusy(true);
    setStatusLine("Thinking…");

    if (userVisibleText) {
      pushMessage({ role: "user", blocks: [{ type: "text", content: userVisibleText }] });
      historyRef.current.push({ role: "user", content: userVisibleText });
    }

    let finalBlocks = null;

    await streamFn(...streamArgs, {
      onRunStart: () => setStatusLine("Agent is working…"),
      onToolCall: (data) => setStatusLine(`Calling tool: ${data.tool}…`),
      onToolResult: () => setStatusLine("Got tool results, generating UI…"),
      onStream: (partialJson) => {
        const parsed = parsePartialBlocks(partialJson);
        if (parsed.length > 0) setStreamingBlocks(parsed);
      },
      onBlocks: (blocks) => {
        finalBlocks = blocks;
      },
      onRunEnd: () => {
        setStatusLine("");
        setStreamingBlocks(null);
        setBusy(false);
        if (finalBlocks) {
          pushMessage({ role: "assistant", blocks: finalBlocks });
          const textSummary = finalBlocks
            .filter((b) => b.type === "text")
            .map((b) => b.content)
            .join(" ");
          historyRef.current.push({ role: "assistant", content: textSummary || "[UI response]" });
        }
      },
      onError: (err) => {
        setStatusLine("");
        setStreamingBlocks(null);
        setBusy(false);
        pushMessage({
          role: "assistant",
          blocks: [{ type: "text", content: `⚠️ Something went wrong: ${err.message}` }],
        });
      },
    });
  }

  function handleSend(text) {
    const message = (text ?? input).trim();
    if (!message || busy) return;
    setInput("");
    runTurn(sendChatMessage, [message, historyRef.current], message);
  }

  function handleAction(action, payload) {
    if (busy) return;
    runTurn(sendAction, [action, payload], null);
    pushMessage({ role: "user", blocks: [{ type: "text", content: `→ ${action}` }] });
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>AI Canvas</h1>
        <p>Generative UI agent · Multi-LLM · Tool calling · Structured output</p>
      </header>

      <main className="chat-window">
        {messages.map((m) => (
          <div key={m.id} className={`message ${m.role}`}>
            <div className="message-role">{m.role === "user" ? "You" : "Agent"}</div>
            <DynamicRenderer blocks={m.blocks} onAction={handleAction} />
          </div>
        ))}
        {streamingBlocks && (
          <div className="message assistant streaming">
            <div className="message-role">Agent</div>
            <DynamicRenderer blocks={streamingBlocks} onAction={handleAction} />
          </div>
        )}
        {statusLine && <div className="status-line">{statusLine}</div>}
        <div ref={chatEndRef} />
      </main>

      <div className="suggestions">
        {SUGGESTIONS.map((s) => (
          <button key={s} disabled={busy} onClick={() => handleSend(s)}>
            {s}
          </button>
        ))}
      </div>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask me anything…"
          disabled={busy}
        />
        <button type="submit" disabled={busy || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
