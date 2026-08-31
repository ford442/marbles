import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function copyAssetsPlugin() {
  return {
    name: 'copy-game-assets',
    closeBundle() {
      const srcDir = path.resolve('assets');
      const distAssetsDir = path.resolve('dist/assets');
      if (fs.existsSync(srcDir)) {
        copyDirSync(srcDir, distAssetsDir);
        const manifestSrc = path.join(srcDir, 'manifest.json');
        const manifestDist = path.resolve('dist/manifest.json');
        if (fs.existsSync(manifestSrc)) {
          fs.copyFileSync(manifestSrc, manifestDist);
        }
      }
    }
  };
}

const CROSS_ORIGIN_ISOLATION_HEADERS = {
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/marbles/',
  server: {
    headers: CROSS_ORIGIN_ISOLATION_HEADERS,
  },
  preview: {
    // Vite mirrors server.headers by default, but we set it explicitly so
    // the isolation policy is obvious and survives config refactors.
    headers: CROSS_ORIGIN_ISOLATION_HEADERS,
  },
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d-compat', 'filament']
  },
  assetsInclude: ['**/*.wasm', '**/*.filmat', '**/*.glb', '**/*.gltf', '**/*.wgsl'],
  plugins: [copyAssetsPlugin()],
  build: {
    rollupOptions: {
      // marble_physics.js is loaded dynamically by src/wasm-bridge.js when the
      // WASM binary is present; it must remain a static asset rather than a bundle.
      external: [/\/wasm\/marble_physics\.js$/]
    }
  }
});

