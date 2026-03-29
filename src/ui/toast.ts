import type { PIIMatch } from "../lib/pii/types";
import { t, detectLocale } from "../lib/i18n";

export interface ToastActions {
  matchCount: number;
  onMask: () => void;
  onIgnore: () => void;
  onReview: () => void;
}

export interface FileWarningActions {
  fileName: string;
  piiCount: number;
  matches: PIIMatch[];
  onUpgradePro: () => void;
  onDismiss: () => void;
}

export interface ToastController {
  show(actions: ToastActions): void;
  showWarning(count: number): void;
  showLimit(): void;
  showDetails(matches: PIIMatch[]): void;
  showFileWarning(actions: FileWarningActions): void;
  hide(): void;
  destroy(): void;
  /** Last warning PII count — used to suppress duplicate warnings */
  lastWarningCount: number;
  /** Whether the user dismissed the warning toast */
  warningDismissed: boolean;
}

const TOAST_STYLES = `
  :host { all: initial; }
  .or-toast {
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
    padding: 0;
    min-width: 320px;
    max-width: 420px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    animation: slideIn 0.2s ease-out;
    overflow: hidden;
  }
  @keyframes slideIn {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  @keyframes fadeOut {
    from { opacity: 1; transform: translateY(0); }
    to { opacity: 0; transform: translateY(8px); }
  }
  .toast-fadeout {
    animation: fadeOut 0.4s ease-in forwards;
  }
  .brand-strip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    background: rgba(15, 23, 42, 0.6);
    border-bottom: 1px solid rgba(20, 184, 166, 0.15);
  }
  .brand-logo { flex-shrink: 0; line-height: 0; }
  .brand-logo svg { display: block; }
  .brand-name {
    font-size: 11px;
    font-weight: 600;
    color: #14b8a6;
    letter-spacing: 0.3px;
    opacity: 0.8;
    flex: 1;
  }
  .toast-content { padding: 14px 16px; }
  .toast-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
  }
  .toast-icon { font-size: 20px; }
  .toast-title { font-weight: 600; flex: 1; }
  .toast-close {
    background: none;
    border: none;
    color: #666;
    cursor: pointer;
    font-size: 14px;
    padding: 2px 4px;
    line-height: 1;
    border-radius: 4px;
    transition: color 0.15s, background 0.15s;
  }
  .toast-close:hover { color: #ccc; background: rgba(255,255,255,0.08); }
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
    background: #1a1a2e;
    border: 1px solid rgba(245, 158, 11, 0.4);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    animation: slideIn 0.2s ease-out;
    display: flex;
    align-items: center;
    gap: 0;
  }
  .toast-warning .brand-strip {
    border-bottom: none;
    border-right: 1px solid rgba(245, 158, 11, 0.15);
    padding: 10px 12px;
    background: rgba(15, 23, 42, 0.6);
    flex-shrink: 0;
  }
  .toast-warning-body {
    display: flex;
    align-items: center;
    flex: 1;
    padding: 10px 12px;
    gap: 10px;
  }
  .toast-warning-text {
    color: #f59e0b;
    font-size: 13px;
    flex: 1;
  }
  .toast-warning .toast-close {
    flex-shrink: 0;
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
    padding: 6px 0;
    border-bottom: 1px solid #333;
    font-size: 12px;
  }
  .detail-type { color: #f59e0b; font-weight: 500; }
  .detail-value { color: #888; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .file-warning-card {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border: 1px solid #f59e0b;
  }
  .file-warning-card .brand-strip {
    border-bottom-color: rgba(245, 158, 11, 0.2);
  }
  .file-icon { font-size: 24px; }
  .file-name { color: #f59e0b; font-weight: 600; font-size: 13px; word-break: break-all; }
  .file-pii-count {
    color: #ef4444;
    font-size: 22px;
    font-weight: 700;
    margin: 8px 0;
  }
  .file-pii-label { color: #ccc; font-size: 13px; }
  .btn-pro {
    background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%);
    color: white;
    width: 100%;
    margin-top: 8px;
    padding: 10px 16px;
    font-size: 14px;
    font-weight: 600;
  }
  .btn-dismiss {
    background: transparent;
    color: #888;
    width: 100%;
    margin-top: 4px;
    font-size: 12px;
  }
  .file-matches-preview {
    max-height: 120px;
    overflow-y: auto;
    margin: 8px 0;
    padding: 8px;
    background: rgba(0,0,0,0.2);
    border-radius: 6px;
  }
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

/** Inline SVG shield logo matching the extension icon */
function brandLogo(): HTMLElement {
  const wrapper = el("span", { className: "brand-logo" });
  wrapper.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L4 6v5c0 5.25 3.4 10.15 8 11.4 4.6-1.25 8-6.15 8-11.4V6l-8-4z" fill="#14b8a6"/>
    <path d="M10 14.2l-2.6-2.6L6 13l4 4 8-8-1.4-1.4L10 14.2z" fill="#fff"/>
  </svg>`;
  return wrapper;
}

/** Compact brand strip shown at the top of toast cards */
function brandStrip(closeBtn?: HTMLElement): HTMLElement {
  const children: (Node | string)[] = [
    brandLogo(),
    el("span", { className: "brand-name" }, ["OfflineRedact"]),
  ];
  if (closeBtn) children.push(closeBtn);
  return el("div", { className: "brand-strip" }, children);
}

export function createToast(): ToastController {
  // Init locale detection for toast strings
  detectLocale();

  const host = document.createElement("offlineredact-toast");
  const shadow = host.attachShadow({ mode: "closed" });

  const style = document.createElement("style");
  style.textContent = TOAST_STYLES;
  shadow.appendChild(style);

  const container = document.createElement("div");
  container.className = "or-toast";
  shadow.appendChild(container);

  document.body.appendChild(host);

  let autoHideTimer: ReturnType<typeof setTimeout> | null = null;

  function clear() {
    if (autoHideTimer) { clearTimeout(autoHideTimer); autoHideTimer = null; }
    while (container.firstChild) container.removeChild(container.firstChild);
  }

  /** Fade out current content then clear */
  function fadeOutAndClear() {
    const firstChild = container.firstChild as HTMLElement | null;
    if (!firstChild) return;
    firstChild.classList.add("toast-fadeout");
    setTimeout(() => clear(), 400);
  }

  return {
    lastWarningCount: 0,
    warningDismissed: false,

    show(actions: ToastActions) {
      clear();
      // Reset warning state when full toast is shown
      this.lastWarningCount = 0;
      this.warningDismissed = false;

      const closeBtn = el("button", { className: "toast-close" }, ["\u00d7"]);
      closeBtn.addEventListener("click", () => this.hide());

      const card = el("div", { className: "toast-card" }, [
        brandStrip(closeBtn),
        el("div", { className: "toast-content" }, [
          el("div", { className: "toast-header" }, [
            el("span", { className: "toast-icon" }, ["\u26a0"]),
            el("span", { className: "toast-title" }, [t("piiDetected", { COUNT: actions.matchCount })]),
          ]),
          el("div", { className: "toast-body" }, [t("personalDataInMessage")]),
          el("div", { className: "toast-actions" }, [
            btn("btn-mask", t("mask"), actions.onMask),
            btn("btn-ignore", t("ignore"), actions.onIgnore),
            btn("btn-review", t("review"), actions.onReview),
          ]),
        ]),
      ]);

      container.appendChild(card);
    },

    showWarning(count: number) {
      if (count > 0) {
        // Same count as already shown — don't re-render (avoids re-triggering animation)
        if (count === this.lastWarningCount && container.firstChild) return;
        // User dismissed and count hasn't increased — stay hidden
        if (this.warningDismissed && count <= this.lastWarningCount) return;
        this.lastWarningCount = count;
        this.warningDismissed = false;
      }

      clear();

      const text = count === 0
        ? `\u26a0 ${t("scanningText")}`
        : `\u26a0 ${t("piiDetectedCheck", { COUNT: count })}`;

      const closeBtn = el("button", { className: "toast-close" }, ["\u00d7"]);
      const self = this;
      closeBtn.addEventListener("click", () => {
        self.warningDismissed = true;
        fadeOutAndClear();
      });

      const warning = el("div", { className: "toast-warning" }, [
        el("div", { className: "brand-strip" }, [
          brandLogo(),
          el("span", { className: "brand-name" }, ["OfflineRedact"]),
        ]),
        el("div", { className: "toast-warning-body" }, [
          el("span", { className: "toast-warning-text" }, [text]),
          closeBtn,
        ]),
      ]);
      container.appendChild(warning);

      // Auto-fade after 4 seconds (only for non-zero counts)
      if (count > 0) {
        autoHideTimer = setTimeout(() => {
          self.warningDismissed = true;
          fadeOutAndClear();
        }, 4000);
      }
    },

    showLimit() {
      // No longer used — scanning is unlimited
      clear();
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
          brandStrip(closeBtn),
          el("div", { className: "toast-content" }, [
            el("div", { className: "toast-header" }, [
              el("span", { className: "toast-title" }, [`${t("detectedData")} (${matches.length})`]),
            ]),
            list,
          ]),
        ])
      );
    },

    showFileWarning(actions: FileWarningActions) {
      clear();

      const closeBtn = el("button", { className: "toast-close" }, ["\u00d7"]);
      closeBtn.addEventListener("click", actions.onDismiss);

      const matchPreview = el("div", { className: "file-matches-preview" });
      const shownMatches = actions.matches.slice(0, 5);
      for (const m of shownMatches) {
        const truncated = m.value.length > 25 ? m.value.slice(0, 25) + "..." : m.value;
        matchPreview.appendChild(
          el("div", { className: "detail-item" }, [
            el("span", { className: "detail-type" }, [m.type]),
            el("span", { className: "detail-value" }, [truncated]),
          ])
        );
      }
      if (actions.matches.length > 5) {
        matchPreview.appendChild(
          el("div", { className: "detail-item" }, [
            el("span", { className: "detail-value" }, [t("more", { COUNT: actions.matches.length - 5 })]),
          ])
        );
      }

      const card = el("div", { className: "toast-card file-warning-card" }, [
        brandStrip(closeBtn),
        el("div", { className: "toast-content" }, [
          el("div", { className: "toast-header" }, [
            el("span", { className: "file-icon" }, ["\ud83d\udcc4"]),
            el("span", { className: "toast-title" }, [t("fileUploadWarning")]),
          ]),
          el("div", { className: "toast-body" }, [
            el("div", { className: "file-name" }, [actions.fileName]),
            el("div", { className: "file-pii-count" }, [
              t("piiFoundInFile", { COUNT: actions.piiCount }),
            ]),
            el("div", { className: "file-pii-label" }, [t("fileContainsPii")]),
          ]),
          ...(actions.piiCount > 0 ? [matchPreview] : []),
          btn("btn-pro", `\ud83d\udd12 ${t("autoRedactPro")}`, actions.onUpgradePro),
          btn("btn-dismiss", t("dismissAndContinue"), actions.onDismiss),
        ]),
      ]);

      container.appendChild(card);
    },

    hide() {
      clear();
    },

    destroy() {
      host.remove();
    },
  };
}
