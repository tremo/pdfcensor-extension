/** Site adapter interface — abstracts DOM interaction per AI site */
export interface SiteAdapter {
  /** Human-readable site name */
  name: string;

  /** Hostname patterns this adapter handles */
  hostnames: string[];

  /** Find the main message input element */
  getInputElement(): HTMLElement | null;

  /** Find the send/submit button */
  getSendButton(): HTMLElement | null;

  /** Read current message text from the input */
  getMessageText(): string;

  /** Replace message text (after masking) */
  setMessageText(text: string): void;

  /** Find file upload input (Pro feature) */
  getFileInput(): HTMLInputElement | null;

  /**
   * Intercept the send action.
   * Callback should return `true` to allow send, `false` to block.
   * Returns a cleanup function.
   */
  interceptSend(callback: () => boolean): () => void;

  /**
   * Observe input changes (typing, paste).
   * Calls `callback` whenever content changes.
   * Returns a cleanup function.
   */
  observe(callback: () => void): () => void;
}
