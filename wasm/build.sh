#!/usr/bin/env bash
# build.sh — Compile the MarblePhysics C++ WASM module and copy the output to
# public/wasm/ so Vite can serve it as a static asset.
#
# Prerequisites
# ─────────────
# • Emscripten SDK (emsdk) installed and on PATH, or one of the standard
#   install paths below.  See: https://emscripten.org/docs/getting_started/downloads.html
# • CMake ≥ 3.20

set -euo pipefail
source /content/buil*/emsdk/emsdk_env.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Locate Emscripten ─────────────────────────────────────────────────────────
if [ -n "${EMSDK:-}" ] && [ -f "$EMSDK/emsdk_env.sh" ]; then
    # shellcheck source=/dev/null
    source "$EMSDK/emsdk_env.sh"
elif [ -f "/opt/emsdk/emsdk_env.sh" ]; then
    source /opt/emsdk/emsdk_env.sh
elif [ -f "$HOME/emsdk/emsdk_env.sh" ]; then
    source "$HOME/emsdk/emsdk_env.sh"
elif command -v emcmake &>/dev/null; then
    : # Already on PATH — nothing to source
else
    echo "❌  Emscripten not found."
    echo "    Install emsdk: https://emscripten.org/docs/getting_started/downloads.html"
    echo "    Then set the EMSDK environment variable or add emcmake to PATH."
    exit 1
fi

# ── Build ─────────────────────────────────────────────────────────────────────
echo "🔨  Building MarblePhysics WASM module…"

cd "$SCRIPT_DIR"
mkdir -p build
cd build

emcmake cmake .. -DCMAKE_BUILD_TYPE=Release
emmake make -j"$(nproc 2>/dev/null || echo 2)"
# Note: the fallback of 2 is intentional — this project targets 2-core systems.

# ── Copy artefacts to public/wasm/ ───────────────────────────────────────────
OUT_DIR="$REPO_ROOT/public/wasm"
mkdir -p "$OUT_DIR"
cp marble_physics.js   "$OUT_DIR/"
cp marble_physics.wasm "$OUT_DIR/"

echo "✅  MarblePhysics WASM build complete!"
echo "    Output → public/wasm/marble_physics.{js,wasm}"
