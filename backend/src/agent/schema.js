import { z } from "zod";

/**
 * UI RESPONSE SCHEMA
 * ------------------
 * Every agent turn returns ONE object: { blocks: [...] }
 * `blocks` is an ordered array so the AI can freely mix text, cards,
 * charts, forms, etc. in a single response (requirement #4/#5 in the POC brief).
 *
 * Each block has a `type` discriminator. The frontend's component registry
 * (frontend/src/components/registry.js) maps `type` -> React component 1:1
 * with this list. If you add a block type here, add it there too.
 */

const ActionSchema = z.object({
  label: z.string(),
  action: z.string(), // opaque action id the frontend sends back on click, e.g. "view_hotel:123"
});

const TextBlock = z.object({
  type: z.literal("text"),
  content: z.string(),
});

const CardBlock = z.object({
  type: z.literal("card"),
  title: z.string(),
  description: z.string().optional().default(""),
  image: z.string().url().optional(),
  price: z.string().optional(),
  rating: z.number().min(0).max(5).optional(),
  actions: z.array(ActionSchema).optional().default([]),
});

const ButtonBlock = z.object({
  type: z.literal("button"),
  label: z.string(),
  action: z.string(),
  variant: z.enum(["primary", "secondary", "danger"]).optional().default("primary"),
});

const ChartBlock = z.object({
  type: z.literal("chart"),
  chartType: z.enum(["bar", "line"]).default("bar"),
  title: z.string().optional(),
  labels: z.array(z.string()),
  data: z.array(z.number()),
});

const TableBlock = z.object({
  type: z.literal("table"),
  title: z.string().optional(),
  columns: z.array(z.string()),
  rows: z.array(z.array(z.union([z.string(), z.number()]))),
});

const FormFieldSchema = z.object({
  name: z.string(),
  label: z.string(),
  fieldType: z.enum(["text", "email", "phone", "number", "textarea"]).default("text"),
  required: z.boolean().optional().default(false),
});

const FormBlock = z.object({
  type: z.literal("form"),
  title: z.string(),
  fields: z.array(FormFieldSchema),
  submitLabel: z.string().optional().default("Submit"),
  submitAction: z.string(), // e.g. "create_customer"
});

const ImageBlock = z.object({
  type: z.literal("image"),
  url: z.string().url(),
  alt: z.string().optional().default(""),
});

const ListBlock = z.object({
  type: z.literal("list"),
  title: z.string().optional(),
  items: z.array(z.string()),
});

export const BlockSchema = z.discriminatedUnion("type", [
  TextBlock,
  CardBlock,
  ButtonBlock,
  ChartBlock,
  TableBlock,
  FormBlock,
  ImageBlock,
  ListBlock,
]);

export const UIResponseSchema = z.object({
  blocks: z.array(BlockSchema).min(1),
});

/**
 * Safe-parses raw LLM JSON text against the schema.
 * Never throws — always returns { ok, data|error } so the caller can
 * decide whether to retry the LLM call or fall back to a plain text block.
 */
export function validateUIResponse(rawJson) {
  let parsedJson;
  try {
    parsedJson = typeof rawJson === "string" ? JSON.parse(rawJson) : rawJson;
  } catch (e) {
    return { ok: false, error: `Invalid JSON from LLM: ${e.message}` };
  }

  const result = UIResponseSchema.safeParse(parsedJson);
  if (!result.success) {
    return { ok: false, error: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }
  return { ok: true, data: result.data };
}
