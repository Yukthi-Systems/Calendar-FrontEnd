module.exports = {
  root: true,
  extends: '@react-native',
  overrides: [
    {
      // A plain, un-bundled service worker (see its own header comment) — it
      // runs in a Worker global scope, not RN's, so it needs `self`/
      // `importScripts`/etc. from ESLint's own `serviceworker` env rather
      // than @react-native's browser-ish defaults. `firebase` is a true
      // global here too (set by the CDN script importScripts loads, not an
      // import ESLint can see).
      files: ['web/firebase-messaging-sw.js'],
      env: { serviceworker: true },
      globals: { firebase: 'readonly' },
    },
  ],
};
