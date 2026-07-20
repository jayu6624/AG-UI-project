import { parse } from "partial-json";

export function parsePartialBlocks(partialJson) {
  if (!partialJson) return [];
  try {
    const data = parse(partialJson);
    return data?.blocks || [];
  } catch (err) {
    console.warn("partial-json parsing failed", err);
    return [];
  }
}
