import type { SiteAdapter } from "./types";

/** Microsoft Copilot adapter */
export const copilotAdapter: SiteAdapter = {
  name: "Copilot",
  hostnames: ["copilot.microsoft.com"],

  getInputElement() {
    return (
      document.querySelector<HTMLElement>('textarea#userInput') ??
      document.querySelector<HTMLElement>('#searchbox textarea') ??
      document.querySelector<HTMLElement>('textarea[placeholder]')
    );
  },

  getSendButton() {
    return (
      document.querySelector<HTMLElement>('button[aria-label="Submit"]') ??
      document.querySelector<HTMLElement>('button.submit-button') ??
      document.querySelector<HTMLElement>('button[type="submit"]')
    );
  },

  getMessageText() {
    const el = this.getInputElement();
    if (!el) return "";
    if (el instanceof HTMLTextAreaElement) return el.value;
    return el.innerText || el.textContent || "";
  },

  setMessageText(text: string) {
    const el = this.getInputElement();
    if (!el) return;
    if (el instanceof HTMLTextAreaElement) {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype, "value"
      )?.set;
      setter?.call(el, text);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      el.focus();
      document.execCommand("selectAll", false);
      document.execCommand("insertText", false, text);
    }
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
    let currentTarget: HTMLElement | null = null;
    let inputCleanup: (() => void) | null = null;

    function attachToInput(target: HTMLElement) {
      if (currentTarget === target) return;
      detachFromInput();
      currentTarget = target;

      if (target instanceof HTMLTextAreaElement) {
        target.addEventListener("input", callback);
        inputCleanup = () => target.removeEventListener("input", callback);
      } else {
        const observer = new MutationObserver(callback);
        observer.observe(target, { childList: true, subtree: true, characterData: true });
        target.addEventListener("input", callback);
        inputCleanup = () => {
          observer.disconnect();
          target.removeEventListener("input", callback);
        };
      }
    }

    function detachFromInput() {
      inputCleanup?.();
      inputCleanup = null;
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
