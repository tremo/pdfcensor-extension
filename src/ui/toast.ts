import type { PIIMatch } from "../lib/pii/types";

export interface ToastActions {
  matchCount: number;
  onMask: () => void;
  onIgnore: () => void;
  onReview: () => void;
}

export interface ToastController {
  show(actions: ToastActions): void;
  showWarning(count: number): void;
  showLimit(): void;
  showDetails(matches: PIIMatch[]): void;
  hide(): void;
  destroy(): void;
}

const TOAST_STYLES = `
  :host { all: initial; }
  .pdfcensor-toast {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
  }
  .toast-card {
    background: #1a1a2e;
    color: #eee;
    border-radius: 12px;
    padding: 16px;
    min-width: 300px;
    max-width: 400px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    animation: slideIn 0.2s ease-out;
  }
  @keyframes slideIn {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  .toast-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }
  .toast-icon { font-size: 20px; }
  .toast-title { font-weight: 600; flex: 1; }
  .toast-close {
    background: none;
    border: none;
    color: #888;
    cursor: pointer;
    font-size: 18px;
    padding: 0;
  }
  .toast-body { margin-bottom: 12px; color: #ccc; }
  .toast-actions { display: flex; gap: 8px; }
  .btn {
    padding: 8px 16px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: opacity 0.15s;
  }
  .btn:hover { opacity: 0.85; }
  .btn-mask { background: #e74c3c; color: white; }
  .btn-ignore { background: #333; color: #ccc; }
  .btn-review { background: #2563eb; color: white; }
  .toast-warning {
    background: #f59e0b22;
    border: 1px solid #f59e0b;
    color: #f59e0b;
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 13px;
  }
  .toast-limit {
    background: #ef444422;
    border: 1px solid #ef4444;
    color: #ef4444;
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 13px;
  }
  .details-list {
    max-height: 200px;
    overflow-y: auto;
    margin: 8px 0;
  }
  .detail-item {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
    border-bottom: 1px solid #333;
    font-size: 12px;
  }
  .detail-type { color: #f59e0b; font-weight: 500; }
  .detail-value { color: #888; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;

// Safe DOM element creation helpers (no innerHTML / XSS risk)
function el(tag: string, attrs?: Record<string, string>, children?: (Node | string)[]): HTMLElement {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "className") node.className = v;
      else node.setAttribute(k, v);
    }
  }
  if (children) {
    for (const child of children) {
      node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    }
  }
  return node;
}

function btn(className: string, text: string, onClick: () => void): HTMLElement {
  const button = el("button", { className: `btn ${className}` }, [text]);
  button.addEventListener("click", onClick);
  return button;
}

export function createToast(): ToastController {
  const host = document.createElement("pdfcensor-toast");
  const shadow = host.attachShadow({ mode: "closed" });

  const style = document.createElement("style");
  style.textContent = TOAST_STYLES;
  shadow.appendChild(style);

  const container = document.createElement("div");
  container.className = "pdfcensor-toast";
  shadow.appendChild(container);

  document.body.appendChild(host);

  function clear() {
    while (container.firstChild) container.removeChild(container.firstChild);
  }

  return {
    show(actions: ToastActions) {
      clear();

      const closeBtn = el("button", { className: "toast-close" }, ["\u00d7"]);
      const card = el("div", { className: "toast-card" }, [
        el("div", { className: "toast-header" }, [
          el("span", { className: "toast-icon" }, ["\u26a0"]),
          el("span", { className: "toast-title" }, [`${actions.matchCount} hassas veri tespit edildi`]),
          closeBtn,
        ]),
        el("div", { className: "toast-body" }, [
          "Mesaj\u0131n\u0131zda ki\u015fisel veriler bulundu. G\u00f6ndermeden \u00f6nce maskelemek ister misiniz?",
        ]),
        el("div", { className: "toast-actions" }, [
          btn("btn-mask", "Maskele", actions.onMask),
          btn("btn-ignore", "Yoksay", actions.onIgnore),
          btn("btn-review", "\u0130ncele", actions.onReview),
        ]),
      ]);

      closeBtn.addEventListener("click", () => this.hide());
      container.appendChild(card);
    },

    showWarning(count: number) {
      clear();
      const text = count === 0
        ? "\u26a0 Taran\u0131yor..."
        : `\u26a0 ${count} hassas veri tespit edildi \u2014 g\u00f6ndermeden \u00f6nce kontrol edin.`;
      container.appendChild(
        el("div", { className: "toast-warning" }, [text])
      );
    },

    showLimit() {
      clear();
      container.appendChild(
        el("div", { className: "toast-limit" }, [
          "G\u00fcnl\u00fck \u00fccretsiz tarama limitinize ula\u015ft\u0131n\u0131z. Pro'ya ge\u00e7in.",
        ])
      );
      setTimeout(() => this.hide(), 5000);
    },

    showDetails(matches: PIIMatch[]) {
      clear();

      const list = el("div", { className: "details-list" });
      for (const m of matches) {
        const truncated = m.value.length > 30 ? m.value.slice(0, 30) + "..." : m.value;
        list.appendChild(
          el("div", { className: "detail-item" }, [
            el("span", { className: "detail-type" }, [m.type]),
            el("span", { className: "detail-value" }, [truncated]),
          ])
        );
      }

      const closeBtn = el("button", { className: "toast-close" }, ["\u00d7"]);
      closeBtn.addEventListener("click", () => this.hide());

      container.appendChild(
        el("div", { className: "toast-card" }, [
          el("div", { className: "toast-header" }, [
            el("span", { className: "toast-title" }, [`Tespit Edilen Veriler (${matches.length})`]),
            closeBtn,
          ]),
          list,
        ])
      );
    },

    hide() {
      clear();
    },

    destroy() {
      host.remove();
    },
  };
}
