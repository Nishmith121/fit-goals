#!/usr/bin/env bash
# build.sh — Render build script
# Installs backend + frontend deps, builds the React SPA

set -o errexit

echo "=== Installing backend dependencies ==="
pip install -r backend/requirements.txt

echo "=== Installing frontend dependencies ==="
cd frontend
npm install
echo "=== Building frontend ==="
npm run build
cd ..

echo "=== Build complete ==="
