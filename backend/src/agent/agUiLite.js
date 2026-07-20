/**
 * AG-UI "LITE"
 * ------------
 * This is NOT the official AG-UI protocol/package. It's a small,
 * self-contained event envelope inspired by AG-UI's shape (typed events
 * over a stream) so the POC demonstrates the same agent -> event -> UI
 * pattern without pulling in the real dependency. Swap `sendEvent` calls
 * here for real `@ag-ui/*` client/server events later — the call sites in
 * routes/chat.js won't need to change shape.
 *
 * Event types used in this POC:
 *   - "run.start"   : agent run began
 *   - "tool.call"    : a tool was invoked (name + args)
 *   - "tool.result"  : a tool finished (name + result)
 *   - "ui.blocks"    : final structured UI payload for the frontend to render
 *   - "run.end"      : agent run finished
 *   - "run.error"    : something failed
 */

export function sseHeaders(res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
}

export function sendEvent(res, type, data) {
  res.write(`event: ${type}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}
