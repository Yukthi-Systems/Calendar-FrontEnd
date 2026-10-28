#!/bin/sh

# Runtime config for the web build. The image is built once with no .env, and this
# script writes web-build/env-config.js from the container's env vars on every start,
# so one image can be pointed at any environment (see tasks-webui/.env.example).
# src/config/env.web.ts reads window._env_ first, falling back to build-time values.

cd /app

cat > ./web-build/env-config.js <<CONFIG
window._env_ = {
  API_URL: "${API_URL}",
  SSO_URL: "${SSO_URL}",
  SSO_APP_ID: "${SSO_APP_ID}",
};
CONFIG

# firebase-messaging-sw.js is a plain, un-bundled script (see its own header
# comment) — it can't read window._env_ like env.web.ts does, so it ships
# with __FIREBASE_*__ placeholders instead of real values; fill them in from
# the container's env here. An unset FIREBASE_* var blanks out its
# placeholder, same as an unset var would for env-config.js's fields above —
# background push then fails to initialize until it's set.
sw=./web-build/firebase-messaging-sw.js
sed -i \
  -e "s/__FIREBASE_API_KEY__/${FIREBASE_API_KEY}/" \
  -e "s/__FIREBASE_AUTH_DOMAIN__/${FIREBASE_AUTH_DOMAIN}/" \
  -e "s/__FIREBASE_PROJECT_ID__/${FIREBASE_PROJECT_ID}/" \
  -e "s/__FIREBASE_STORAGE_BUCKET__/${FIREBASE_STORAGE_BUCKET}/" \
  -e "s/__FIREBASE_MESSAGING_SENDER_ID__/${FIREBASE_MESSAGING_SENDER_ID}/" \
  -e "s/__FIREBASE_APP_ID__/${FIREBASE_APP_ID}/" \
  "$sw"

# Execute the passed command (starts the server)
exec "$@"
