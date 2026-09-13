#!/usr/bin/env bash
# build.sh — Compile the MarblePhysics C++ WASM module and copy the output to
# public/wasm/ so Vite can serve it as a static asset.
#
# Usage:
#   ./build.sh            Release build (default) → public/wasm/
#   ./build.sh --debug    Debug + ASan build → wasm/build-debug/ only
#                         (not copied to public/wasm/ — for local testing)
#
# Prerequisites
# ─────────────
# • Emscripten SDK (emsdk) installed and on PATH, or one of the standard
#   install paths below.  See: https://emscripten.org/docs/getting_started/downloads.html
# • CMake ≥ 3.20

set -euo pipefail

# Pinned to match CI (.github/workflows/debug_build.yml) and wasm/README.md so
# local builds produce byte-identical output to what CI verifies.
EMSCRIPTEN_VERSION_PIN="3.1.50"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

BUILD_TYPE="Release"
BUILD_DIR="build"
if [ "${1:-}" = "--debug" ]; then
    BUILD_TYPE="Debug"
    BUILD_DIR="build-debug"
fi

# ── Locate Emscripten ─────────────────────────────────────────────────────────
EMSDK_DIR=""
if [ -n "${EMSDK:-}" ] && [ -f "$EMSDK/emsdk_env.sh" ]; then
    EMSDK_DIR="$EMSDK"
elif [ -f "/opt/emsdk/emsdk_env.sh" ]; then
    EMSDK_DIR="/opt/emsdk"
elif [ -f "/content/build_space/emsdk/emsdk_env.sh" ]; then
    EMSDK_DIR="/content/build_space/emsdk"
elif [ -f "/root/emsdk/emsdk_env.sh" ]; then
    EMSDK_DIR="/root/emsdk"
elif command -v emcmake &>/dev/null; then
    : # Already on PATH, no emsdk checkout to pin — use whatever's active.
else
    echo "⚠️  Emscripten not found; skipping optional MarblePhysics WASM build."
    echo "    The browser will use JavaScript physics fallbacks when the WASM binary is absent."
    exit 0
fi

if [ -n "$EMSDK_DIR" ]; then
    # Idempotent: `install` no-ops if already downloaded, `activate` just
    # rewrites ~/.emscripten's config pointer, so this is cheap on repeat runs.
    "$EMSDK_DIR/emsdk" install "$EMSCRIPTEN_VERSION_PIN"
    "$EMSDK_DIR/emsdk" activate "$EMSCRIPTEN_VERSION_PIN"
    # shellcheck source=/dev/null
    source "$EMSDK_DIR/emsdk_env.sh"
fi

# ── Build ─────────────────────────────────────────────────────────────────────
echo "🔨  Building MarblePhysics WASM module ($BUILD_TYPE)…"

cd "$SCRIPT_DIR"
mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

emcmake cmake .. -DCMAKE_BUILD_TYPE="$BUILD_TYPE"
emmake make -j"$(nproc 2>/dev/null || echo 2)"
# Note: the fallback of 2 is intentional — this project targets 2-core systems.

if [ "$BUILD_TYPE" = "Debug" ]; then
    echo "✅  Debug/ASan build complete."
    echo "    Output → wasm/$BUILD_DIR/marble_physics.{js,wasm} (not copied to public/wasm/)"
    echo "    Load it directly under Node (it's built with -sENVIRONMENT=web,worker,node"
    echo "    for exactly this) to exercise the batch kernels under AddressSanitizer."
    exit 0
fi

# ── Copy artefacts to public/wasm/ ───────────────────────────────────────────
OUT_DIR="$REPO_ROOT/public/wasm"
mkdir -p "$OUT_DIR"
cp marble_physics.js   "$OUT_DIR/"
cp marble_physics.wasm "$OUT_DIR/"

echo "✅  MarblePhysics WASM build complete!"
echo "    Output → public/wasm/marble_physics.{js,wasm}"
