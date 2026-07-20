import { groq, MODEL } from "./groqClient.js";
import { SYSTEM_PROMPT } from "./systemPrompt.js";
import { TOOLS, TOOL_DEFINITIONS } from "../tools/index.js";
import { validateUIResponse } from "./schema.js";

/**
 * SIMPLIFIED LANGGRAPH-EQUIVALENT WORKFLOW
 * -----------------------------------------
 * This is a hand-rolled state machine that mirrors the node/edge shape
 * LangGraph would give us (agentNode -> toolNode -> generateUINode -> END),
 * without pulling in the LangGraph dependency for this POC. Swapping this
 * for a real StateGraph later is a drop-in change: each function below is
 * already a pure "node(state) -> state" function.
 *
 * Flow:
 *   START
 *     -> agentNode        (LLM decides: answer directly OR call a tool)
 *     -> [conditional edge]
 *          needsTool? -> toolNode -> generateUINode
 *          otherwise  -> parses agentNode's own output as the UI JSON
 *     -> validateNode      (zod schema check, one retry on failure)
 *     -> END (returns { blocks, meta })
 */

// ---- Node: agent (decide tool vs direct answer) ----------------------------
async function agentNode(state) {
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...state.history,
    { role: "user", content: state.userMessage },
  ];

  const stream = await groq.chat.completions.create({
    model: MODEL,
    messages,
    tools: TOOL_DEFINITIONS,
    tool_choice: "auto",
    temperature: 0.3,
    stream: true,
  });

  let fullContent = "";
  let toolCalls = null;

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta || {};
    if (delta.content) {
      fullContent += delta.content;
      if (state.onChunk) state.onChunk(fullContent);
      await new Promise(r => setTimeout(r, 40));
    }
    if (delta.tool_calls) {
      if (!toolCalls) toolCalls = [];
      for (const tc of delta.tool_calls) {
        if (!toolCalls[tc.index]) {
          toolCalls[tc.index] = { id: tc.id, type: "function", function: { name: tc.function?.name || "", arguments: "" } };
        }
        if (tc.function?.arguments) {
          toolCalls[tc.index].function.arguments += tc.function.arguments;
        }
      }
    }
  }

  const choice = {
    content: fullContent || null,
    tool_calls: toolCalls?.length > 0 ? toolCalls.filter(Boolean) : undefined,
  };

  state.trace.push({ node: "agentNode", toolCalls: choice.tool_calls?.map((t) => t.function.name) || [] });

  if (choice.tool_calls && choice.tool_calls.length > 0) {
    state.pendingToolCalls = choice.tool_calls;
    state.messagesSoFar = messages.concat([{ role: "assistant", tool_calls: choice.tool_calls, content: null }]);
    return { ...state, needsTool: true };
  }

  // No tool needed — the model's own content should already be the UI JSON
  state.rawUIJson = choice.content;
  return { ...state, needsTool: false };
}

// ---- Node: tool execution ----------------------------------------------------
async function toolNode(state) {
  const toolResults = [];
  for (const call of state.pendingToolCalls) {
    const fn = TOOLS[call.function.name];
    let result;
    try {
      const args = JSON.parse(call.function.arguments || "{}");
      result = fn ? fn(args) : { error: `Unknown tool ${call.function.name}` };
    } catch (e) {
      result = { error: `Bad tool arguments: ${e.message}` };
    }
    state.trace.push({ node: "toolNode", tool: call.function.name, result });
    toolResults.push({
      role: "tool",
      tool_call_id: call.id,
      content: JSON.stringify(result),
    });
  }
  state.toolMessages = toolResults;
  return state;
}

// ---- Node: generate final structured UI JSON after tool results -----------
async function generateUINode(state) {
  const messages = [
    ...state.messagesSoFar,
    ...state.toolMessages,
    {
      role: "user",
      content:
        "Using the tool result(s) above, respond now with ONLY the final JSON object " +
        "matching the schema you were given (the {\"blocks\": [...]} shape). No prose, no markdown fences.",
    },
  ];

  const stream = await groq.chat.completions.create({
    model: MODEL,
    messages,
    response_format: { type: "json_object" },
    temperature: 0.3,
    stream: true,
  });

  let fullContent = "";
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta || {};
    if (delta.content) {
      fullContent += delta.content;
      if (state.onChunk) state.onChunk(fullContent);
      await new Promise(r => setTimeout(r, 40));
    }
  }

  state.rawUIJson = fullContent;
  state.trace.push({ node: "generateUINode" });
  return state;
}

// ---- Node: validate against the zod schema, one retry on failure ----------
async function validateNode(state) {
  let result = validateUIResponse(state.rawUIJson);

  if (!result.ok) {
    state.trace.push({ node: "validateNode", status: "invalid", error: result.error });

    // Retry once: ask the LLM to fix its own output against the validation error
    const retryMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content:
          `Your previous JSON output was invalid: ${result.error}\n\n` +
          `Previous output: ${state.rawUIJson}\n\n` +
          `Return ONLY a corrected JSON object matching the {"blocks":[...]} schema.`,
      },
    ];
    const retryCompletion = await groq.chat.completions.create({
      model: MODEL,
      messages: retryMessages,
      response_format: { type: "json_object" },
      temperature: 0.1,
    });
    state.rawUIJson = retryCompletion.choices[0].message.content;
    result = validateUIResponse(state.rawUIJson);
  }

  if (!result.ok) {
    // Final fallback: never let bad JSON crash the frontend — degrade to plain text
    state.trace.push({ node: "validateNode", status: "fallback", error: result.error });
    return {
      ...state,
      final: { blocks: [{ type: "text", content: "Sorry, I had trouble formatting that response. Could you rephrase?" }] },
    };
  }

  state.trace.push({ node: "validateNode", status: "valid" });
  return { ...state, final: result.data };
}

// ---- Graph runner (conditional edges) --------------------------------------
export async function runAgent({ userMessage, history = [], onChunk }) {
  let state = {
    userMessage,
    history,
    trace: [],
    needsTool: false,
    pendingToolCalls: null,
    messagesSoFar: null,
    toolMessages: null,
    rawUIJson: null,
    final: null,
    onChunk,
  };

  state = await agentNode(state); // START -> agentNode

  if (state.needsTool) {
    state = await toolNode(state); // agentNode -> toolNode
    state = await generateUINode(state); // toolNode -> generateUINode
  }
  // else: direct-answer edge, agentNode's own content is already the candidate UI JSON

  state = await validateNode(state); // -> validateNode -> END

  return { blocks: state.final.blocks, trace: state.trace };
}
