import type { SiteAdapter } from "./types";

/** ChatGPT adapter — chatgpt.com / chat.openai.com */
export const chatgptAdapter: SiteAdapter = {
  name: "ChatGPT",
  hostnames: ["chatgpt.com", "chat.openai.com"],

  getInputElement() {
    // ChatGPT uses contenteditable divs — try multiple selectors for resilience
    return (
      document.querySelector<HTMLElement>("#prompt-textarea") ??
      document.querySelector<HTMLElement>('[contenteditable="true"][data-placeholder]') ??
      document.querySelector<HTMLElement>('div[contenteditable="true"]')
    );
  },

  getSendButton() {
    return (
      document.querySelector<HTMLElement>('[data-testid="send-button"]') ??
      document.querySelector<HTMLElement>('button[aria-label="Send prompt"]') ??
      document.querySelector<HTMLElement>('form button[type="submit"]') ??
      // Fallback: find the button closest to the input
      this.getInputElement()?.closest("form")?.querySelector<HTMLElement>("button:last-of-type") ??
      null
    );
  },

  getMessageText() {
    const el = this.getInputElement();
    if (!el) return "";
    return el.innerText || el.textContent || "";
  },

  setMessageText(text: string) {
    const el = this.getInputElement();
    if (!el) return;
    el.focus();
    // Select all and replace — works with ProseMirror/contenteditable
    document.execCommand("selectAll", false);
    document.execCommand("insertText", false, text);
  },

  getFileInput() {
    return document.querySelector<HTMLInputElement>('input[type="file"]');
  },

  interceptSend(callback: () => boolean): () => void {
    const clickHandler = (e: Event) => {
      const target = e.target as HTMLElement;
      const sendBtn = this.getSendButton();
      if (sendBtn && (target === sendBtn || sendBtn.contains(target))) {
        if (!callback()) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    // Enter key — only on the input element, NOT document-wide
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        if (!callback()) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    const inputEl = this.getInputElement();

    document.addEventListener("click", clickHandler, true);
    // Only attach Enter handler to input element if found
    inputEl?.addEventListener("keydown", keyHandler, true);

    return () => {
      document.removeEventListener("click", clickHandler, true);
      inputEl?.removeEventListener("keydown", keyHandler, true);
    };
  },

  observe(callback: () => void): () => void {
    // Watch for the input element to appear, then observe it
    let inputObserver: MutationObserver | null = null;
    let inputListener: (() => void) | null = null;
    let currentTarget: HTMLElement | null = null;

    function attachToInput(target: HTMLElement) {
      if (currentTarget === target) return;
      detachFromInput();
      currentTarget = target;
      inputObserver = new MutationObserver(callback);
      inputObserver.observe(target, { childList: true, subtree: true, characterData: true });
      target.addEventListener("input", callback);
      inputListener = () => target.removeEventListener("input", callback);
    }

    function detachFromInput() {
      inputObserver?.disconnect();
      inputListener?.();
      inputObserver = null;
      inputListener = null;
      currentTarget = null;
    }

    const el = this.getInputElement();
    if (el) attachToInput(el);

    // Periodically re-check for the input element (ChatGPT re-renders on route change)
    const poll = setInterval(() => {
      const input = this.getInputElement();
      if (input && input !== currentTarget) attachToInput(input);
    }, 2000);

    return () => {
      clearInterval(poll);
      detachFromInput();
    };
  },
};
