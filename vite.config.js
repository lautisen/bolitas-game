import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
    // Use './' for Capacitor/Android native builds, '/bolitas-game/' for GitHub Pages
    base: process.env.CAPACITOR_BUILD ? './' : '/bolitas-game/',
}));
