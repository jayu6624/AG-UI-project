import React from "react";
import {
  TextBlock,
  CardBlock,
  ButtonBlock,
  ChartBlock,
  TableBlock,
  FormBlock,
  ImageBlock,
  ListBlock,
} from "./blocks.jsx";

/**
 * UI COMPONENT REGISTRY
 * ----------------------
 * This is the single source of truth mapping a block's `type` (as defined
 * by the backend's zod schema in backend/src/agent/schema.js) to the React
 * component that renders it.
 *
 * To add a new block type:
 *   1. Add it to backend/src/agent/schema.js (BlockSchema union)
 *   2. Mention it in backend/src/agent/systemPrompt.js so the LLM knows to emit it
 *   3. Add a component to ./blocks.jsx
 *   4. Register it below
 * That's it — DynamicRenderer picks it up automatically.
 */
export const componentRegistry = {
  text: TextBlock,
  card: CardBlock,
  button: ButtonBlock,
  chart: ChartBlock,
  table: TableBlock,
  form: FormBlock,
  image: ImageBlock,
  list: ListBlock,
};

/**
 * Renders an array of validated blocks. Blocks with an unknown/missing
 * `type` are skipped with a visible-but-non-crashing fallback, satisfying
 * the "invalid UI data must not crash the frontend" requirement.
 */
export function DynamicRenderer({ blocks, onAction }) {
  if (!Array.isArray(blocks) || blocks.length === 0) return null;

  const grouped = [];
  for (const block of blocks) {
    if (block?.type === "card") {
      const last = grouped[grouped.length - 1];
      if (last?.type === "card_group") {
        last.items.push(block);
      } else {
        grouped.push({ type: "card_group", items: [block] });
      }
    } else {
      grouped.push(block);
    }
  }

  return (
    <div className="dynamic-renderer">
      {grouped.map((group, i) => {
        if (group.type === "card_group") {
          return (
            <div className="cards-horizontal-group" key={i}>
              {group.items.map((block, j) => {
                const Component = componentRegistry.card;
                try {
                  return <Component key={j} {...block} onAction={onAction} />;
                } catch (e) {
                  return <div className="block block-error" key={j}>⚠️ Card failed</div>;
                }
              })}
            </div>
          );
        }

        const block = group;
        const Component = componentRegistry[block?.type];
        if (!Component) {
          return (
            <div className="block block-unknown" key={i}>
              ⚠️ Unsupported UI block type: <code>{String(block?.type)}</code>
            </div>
          );
        }
        try {
          return <Component key={i} {...block} onAction={onAction} />;
        } catch (e) {
          return (
            <div className="block block-error" key={i}>
              ⚠️ Failed to render a "{block.type}" block.
            </div>
          );
        }
      })}
    </div>
  );
}
