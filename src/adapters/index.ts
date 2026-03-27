import type { SiteAdapter } from "./types";
import { chatgptAdapter } from "./chatgpt";
import { claudeAdapter } from "./claude";
import { geminiAdapter } from "./gemini";
import { copilotAdapter } from "./copilot";
import { genericAdapter } from "./generic";

const adapters: SiteAdapter[] = [
  chatgptAdapter,
  claudeAdapter,
  geminiAdapter,
  copilotAdapter,
];

/**
 * Get the appropriate adapter for the current hostname.
 * Falls back to genericAdapter if no specific adapter matches.
 */
export function getAdapter(hostname: string): SiteAdapter {
  for (const adapter of adapters) {
    if (adapter.hostnames.some((h) => hostname.includes(h))) {
      return adapter;
    }
  }
  return genericAdapter;
}

export type { SiteAdapter } from "./types";
