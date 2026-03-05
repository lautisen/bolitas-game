import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
    // Use './' for Capacitor/Android native builds and GitHub Pages compatibility
    base: './',
}));
