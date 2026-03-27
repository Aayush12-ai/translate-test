#!/bin/bash
set -e

# Build the API server
echo "Building API server..."
cd /home/runner/workspace/artifacts/api-server
node ./build.mjs

# Start the API server in background
echo "Starting API server on port 18080..."
PORT=18080 node --enable-source-maps ./dist/index.mjs &
API_PID=$!

# Start the frontend on port 5000
echo "Starting frontend on port 5000..."
cd /home/runner/workspace/artifacts/video-call
PORT=5000 API_PROXY_TARGET=http://127.0.0.1:18080 npx vite --config vite.config.ts --host 0.0.0.0

# Cleanup API on exit
kill $API_PID 2>/dev/null || true
