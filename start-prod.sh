#!/bin/bash
set -e

# Start the API server in background
echo "Starting API server on port 8080..."
cd /home/runner/workspace/artifacts/api-server
PORT=8080 node --enable-source-maps ./dist/index.mjs &
API_PID=$!

# Serve the built frontend with vite preview
echo "Serving frontend on port 5000..."
cd /home/runner/workspace/artifacts/video-call
PORT=5000 npx vite preview --config vite.config.ts --host 0.0.0.0

kill $API_PID 2>/dev/null || true
