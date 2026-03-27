import type { SiteAdapter } from "./types";

/** Generic fallback adapter — works on any site with textarea/input */
export const genericAdapter: SiteAdapter = {
  name: "Generic",
  hostnames: [],

  getInputElement() {
    // Find the most likely active text input
    const active = document.activeElement;
    if (active instanceof HTMLTextAreaElement) return active;
    if (active instanceof HTMLInputElement && active.type === "text") return active;
    if (active instanceof HTMLElement && active.isContentEditable) return active;

    // Fallback: find largest visible textarea
    const textareas = document.querySelectorAll<HTMLTextAreaElement>("textarea");
    let best: HTMLTextAreaElement | null = null;
    let bestArea = 0;
    for (const ta of textareas) {
      const rect = ta.getBoundingClientRect();
      const area = rect.width * rect.height;
      if (area > bestArea && rect.width > 0) {
        best = ta;
        bestArea = area;
      }
    }
    return best;
  },

  getSendButton() {
    // Heuristic: find submit-like button near the input
    return document.querySelector<HTMLElement>(
      'button[type="submit"], button:has(svg), form button:last-of-type'
    );
  },

  getMessageText() {
    const el = this.getInputElement();
    if (!el) return "";
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) return el.value;
    return el.innerText || el.textContent || "";
  },

  setMessageText(text: string) {
    const el = this.getInputElement();
    if (!el) return;
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      const setter = Object.getOwnPropertyDescriptor(
        el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
        "value"
      )?.set;
      setter?.call(el, text);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      el.innerText = text;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  },

  getFileInput() {
    return document.querySelector<HTMLInputElement>('input[type="file"]');
  },

  interceptSend(callback: () => boolean): () => void {
    const formHandler = (e: SubmitEvent) => {
      if (!callback()) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && document.activeElement === this.getInputElement()) {
        if (!callback()) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    document.addEventListener("submit", formHandler, true);
    document.addEventListener("keydown", keyHandler, true);

    return () => {
      document.removeEventListener("submit", formHandler, true);
      document.removeEventListener("keydown", keyHandler, true);
    };
  },

  observe(callback: () => void): () => void {
    // Listen for input events on all textareas and contenteditable
    const handler = (e: Event) => {
      const target = e.target;
      if (
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        callback();
      }
    };

    document.addEventListener("input", handler, true);
    return () => document.removeEventListener("input", handler, true);
  },
};
