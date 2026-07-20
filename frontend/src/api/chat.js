/**
 * Talks to the backend's SSE endpoints and turns raw "event: X\ndata: Y\n\n"
 * frames into callback invocations. This is the frontend half of the
 * AG-UI-lite protocol described in backend/src/agent/agUiLite.js.
 */

async function streamRequest(url, body, handlers) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    handlers.onError?.(new Error(`Request failed: ${res.status}`));
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let frameEnd;
    while ((frameEnd = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, frameEnd);
      buffer = buffer.slice(frameEnd + 2);

      const eventLine = frame.split("\n").find((l) => l.startsWith("event: "));
      const dataLine = frame.split("\n").find((l) => l.startsWith("data: "));
      if (!eventLine || !dataLine) continue;

      const eventType = eventLine.replace("event: ", "").trim();
      let data;
      try {
        data = JSON.parse(dataLine.replace("data: ", ""));
      } catch {
        continue;
      }

      switch (eventType) {
        case "run.start":
          handlers.onRunStart?.(data);
          break;
        case "tool.call":
          handlers.onToolCall?.(data);
          break;
        case "tool.result":
          handlers.onToolResult?.(data);
          break;
        case "ui.blocks":
          handlers.onBlocks?.(data.blocks);
          break;
        case "ui.stream":
          handlers.onStream?.(data.partialJson);
          break;
        case "run.end":
          handlers.onRunEnd?.();
          break;
        case "run.error":
          handlers.onError?.(new Error(data.message));
          break;
        default:
          break;
      }
    }
  }
}

export function sendChatMessage(message, history, handlers) {
  const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  const baseUrl = import.meta.env.VITE_API_URL || (isLocal ? "" : "https://ag-ui-project.onrender.com");
  return streamRequest(`${baseUrl}/api/chat`, { message, history }, handlers);
}

export function sendAction(action, payload, handlers) {
  const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  const baseUrl = import.meta.env.VITE_API_URL || (isLocal ? "" : "https://ag-ui-project.onrender.com");
  return streamRequest(`${baseUrl}/api/action`, { action, payload }, handlers);
}
