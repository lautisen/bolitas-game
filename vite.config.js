import { defineConfig } from 'vite';
import obfuscator from 'vite-plugin-javascript-obfuscator';

export default defineConfig(({ mode }) => ({
  // Use './' for Capacitor/Android native builds and GitHub Pages compatibility
  base: './',
  build: {
    sourcemap: mode !== 'production',
  },
  plugins: [
    mode === 'production'
      ? obfuscator({
          compact: true,
          controlFlowFlattening: false,
          deadCodeInjection: false,
          debugProtection: false,
          debugProtectionInterval: 0,
          disableConsoleOutput: true,
          identifierNamesGenerator: 'hexadecimal',
          log: false,
          numbersToExpressions: true,
          renameGlobals: false,
          selfDefending: false,
          splitStrings: true,
          splitStringsChunkLength: 10,
          stringArray: true,
          stringArrayCallsTransform: true,
          stringArrayCallsTransformThreshold: 0.75,
          stringArrayEncoding: ['base64'],
          stringArrayIndexesType: ['hexadecimal-number'],
          stringArrayIndexShift: true,
          stringArrayRotate: true,
          stringArrayShuffle: true,
          stringArrayWrappersCount: 2,
          stringArrayWrappersChainedCalls: true,
          stringArrayWrappersParametersMaxCount: 4,
          stringArrayWrappersType: 'function',
          stringArrayThreshold: 0.75,
          transformObjectKeys: false,
          unicodeEscapeSequence: false,
        })
      : [],
  ],
}));
