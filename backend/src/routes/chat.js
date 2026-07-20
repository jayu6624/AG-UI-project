import { Router } from "express";
import { runAgent } from "../agent/workflow.js";
import { sseHeaders, sendEvent } from "../agent/agUiLite.js";
import { TOOLS } from "../tools/index.js";

export const chatRouter = Router();

/**
 * POST /api/chat
 * Body: { message: string, history?: [{role,content}] }
 * Streams AG-UI-lite events over SSE, ending with a "ui.blocks" event
 * containing the validated { blocks: [...] } payload, then "run.end".
 */
chatRouter.post("/chat", async (req, res) => {
  const { message, history } = req.body || {};

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Body must include a non-empty 'message' string." });
  }

  sseHeaders(res);
  sendEvent(res, "run.start", { message });

  const onChunk = (partialJson) => {
    sendEvent(res, "ui.stream", { partialJson });
  };

  try {
    const { blocks, trace } = await runAgent({ userMessage: message, history: history || [], onChunk });

    // Surface tool activity as its own events (AG-UI style) for transparency/debugging
    for (const step of trace) {
      if (step.node === "toolNode") {
        sendEvent(res, "tool.call", { tool: step.tool });
        sendEvent(res, "tool.result", { tool: step.tool, result: step.result });
      }
    }

    sendEvent(res, "ui.blocks", { blocks });
    sendEvent(res, "run.end", {});
    res.end();
  } catch (err) {
    console.error("[chat] agent run failed:", err);
    sendEvent(res, "run.error", { message: err.message || "Unknown error" });
    res.end();
  }
});

/**
 * POST /api/action
 * Handles button clicks / form submits coming back from the rendered UI.
 * Body: { action: string, payload?: object }
 * For the POC this maps a couple of known actions to tool calls directly,
 * and forwards anything else to the agent as a synthetic user message so
 * it can keep the conversation going (requirement #12 in the spec).
 */
chatRouter.post("/action", async (req, res) => {
  const { action, payload } = req.body || {};
  if (!action) return res.status(400).json({ error: "Body must include 'action'." });

  sseHeaders(res);
  sendEvent(res, "run.start", { action });

  try {
    if (action === "create_customer") {
      const result = TOOLS.create_customer(payload || {});
      sendEvent(res, "tool.call", { tool: "create_customer" });
      sendEvent(res, "tool.result", { tool: "create_customer", result });
      sendEvent(res, "ui.blocks", {
        blocks: [
          { type: "text", content: `Customer "${result.name}" created successfully ✅` },
          {
            type: "table",
            title: "New Customer",
            columns: ["ID", "Name", "Email", "Phone"],
            rows: [[result.id, result.name, result.email, result.phone || "-"]],
          },
        ],
      });
    } else {
      // Generic fallback: treat the click as a follow-up message to the agent
      const syntheticMessage = `The user clicked an action button: "${action}"${
        payload ? ` with payload ${JSON.stringify(payload)}` : ""
      }. Respond appropriately.`;
      const { blocks } = await runAgent({ userMessage: syntheticMessage, history: [] });
      sendEvent(res, "ui.blocks", { blocks });
    }

    sendEvent(res, "run.end", {});
    res.end();
  } catch (err) {
    console.error("[action] failed:", err);
    sendEvent(res, "run.error", { message: err.message || "Unknown error" });
    res.end();
  }
});
