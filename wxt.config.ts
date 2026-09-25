import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'twitter-craft',
    description: 'Triage tech tweets with Jev, draft replies with GPT, capture build ideas.',
    permissions: ['storage', 'sidePanel'],
    host_permissions: ['https://api.typesafe.ai/*', 'https://api.openai.com/*'],
    action: { default_title: 'twitter-craft' },
    minimum_chrome_version: '116', // chrome.sidePanel.open()
  },
});
