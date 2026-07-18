#!/bin/bash
set -e

cd "$(dirname "$0")"

# Activate Emscripten if available
if [ -f "/opt/emsdk/emsdk_env.sh" ]; then
  source /opt/emsdk/emsdk_env.sh
elif [ -f "/content/build_space/emsdk/emsdk_env.sh" ]; then
  source "/content/build_space/emsdk/emsdk_env.sh"
elif [ -f "/root/emsdk/emsdk_env.sh" ]; then
  source "/root/emsdk/emsdk_env.sh"
fi

# Build
emcmake cmake -B build -S .
emmake make -C build

# Copy to public
mkdir -p ../public/wasm
cp build/pixelocity_wasm.js ../public/wasm/
cp build/pixelocity_wasm.wasm ../public/wasm/

echo "✅ WASM build complete! Output in public/wasm/"
