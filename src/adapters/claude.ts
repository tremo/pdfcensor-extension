import type { SiteAdapter } from "./types";

/** Claude.ai adapter */
export const claudeAdapter: SiteAdapter = {
  name: "Claude",
  hostnames: ["claude.ai"],

  getInputElement() {
    return (
      document.querySelector<HTMLElement>('[contenteditable="true"].ProseMirror') ??
      document.querySelector<HTMLElement>('div[contenteditable="true"][role="textbox"]') ??
      document.querySelector<HTMLElement>('fieldset div[contenteditable="true"]')
    );
  },

  getSendButton() {
    return (
      document.querySelector<HTMLElement>('button[aria-label="Send Message"]') ??
      document.querySelector<HTMLElement>('button[data-testid="send-button"]') ??
      document.querySelector<HTMLElement>('fieldset button[type="button"]:last-of-type')
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
    inputEl?.addEventListener("keydown", keyHandler, true);

    return () => {
      document.removeEventListener("click", clickHandler, true);
      inputEl?.removeEventListener("keydown", keyHandler, true);
    };
  },

  observe(callback: () => void): () => void {
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
