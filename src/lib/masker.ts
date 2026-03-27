import type { PIIMatch, PIIType } from "./pii/types";
import { PII_LABELS } from "./pii/types";

/**
 * Mask PII matches in text, replacing detected values with type labels.
 *
 * Example:
 *   "Ahmet Yılmaz'ın TC: 12345678901"
 *   → "[İSİM]'ın TC: [TC KİMLİK]"
 *
 * Processes matches in reverse order to preserve index positions.
 */
export function maskText(text: string, matches: PIIMatch[]): string {
  if (matches.length === 0) return text;

  // Sort by startIndex descending — replace from end to preserve offsets
  const sorted = [...matches].sort((a, b) => b.startIndex - a.startIndex);

  let result = text;
  for (const match of sorted) {
    const label = getMaskLabel(match.type);
    result = result.slice(0, match.startIndex) + label + result.slice(match.endIndex);
  }

  return result;
}

/**
 * Get the mask label for a PII type.
 * Uses Turkish labels from PII_LABELS wrapped in brackets.
 */
function getMaskLabel(type: PIIType): string {
  const label = PII_LABELS[type] || type;
  return `[${label.toUpperCase()}]`;
}

/**
 * Generate a summary of masked items for display.
 */
export function getMaskSummary(
  matches: PIIMatch[]
): { type: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const m of matches) {
    const label = PII_LABELS[m.type] || m.type;
    counts[label] = (counts[label] || 0) + 1;
  }
  return Object.entries(counts).map(([type, count]) => ({ type, count }));
}
