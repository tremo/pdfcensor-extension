import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: ".",
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "PDFcensor — AI Privacy Guard",
    description:
      "Automatically detects and redacts sensitive personal data (PII) before you send it to AI chatbots like ChatGPT, Claude, Gemini, and more.",
    version: "1.0.0",
    permissions: ["storage", "activeTab", "identity", "alarms"],
    host_permissions: [
      "https://chatgpt.com/*",
      "https://chat.openai.com/*",
      "https://claude.ai/*",
      "https://gemini.google.com/*",
      "https://copilot.microsoft.com/*",
      "https://pdfcensor.com/*",
    ],
    icons: {
      16: "/icons/icon-16.png",
      48: "/icons/icon-48.png",
      128: "/icons/icon-128.png",
    },
    web_accessible_resources: [
      {
        resources: ["dictionaries/*.json"],
        matches: [
          "https://chatgpt.com/*",
          "https://chat.openai.com/*",
          "https://claude.ai/*",
          "https://gemini.google.com/*",
          "https://copilot.microsoft.com/*",
        ],
      },
    ],
  },
});
