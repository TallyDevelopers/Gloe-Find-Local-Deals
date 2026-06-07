#!/usr/bin/env bash
# Opens the Gloē docs site (The Tour + The Spec) in your browser.
# Serves from the repo ROOT so the page can read both HOW-IT-WORKS.md and GLOE.md.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-8750}"
cd "$ROOT"
# kill anything already on the port, then serve quietly in the background
lsof -ti:"$PORT" 2>/dev/null | xargs kill 2>/dev/null || true
python3 -m http.server "$PORT" >/dev/null 2>&1 &
sleep 1
URL="http://localhost:$PORT/how-it-works/index.html"
echo "Gloē docs → $URL  (Ctrl-C this terminal to stop the server)"
open "$URL"
wait
