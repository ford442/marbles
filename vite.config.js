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

function walkFilesSync(dir, base = dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFilesSync(full, base, out);
    } else {
      out.push(path.relative(base, full).split(path.sep).join('/'));
    }
  }
  return out;
}

// Extensions the service worker should pre-cache on install so the game (WASM
// physics/renderer, track/marble models, materials, skyboxes, level/asset
// definitions) works fully offline after a single visit.
const PRECACHE_EXTENSIONS = new Set([
  '.wasm', '.glb', '.gltf', '.filmat', '.filament', '.mat',
  '.ktx', '.ktx2', '.js', '.css', '.json',
]);
const PRECACHE_ALWAYS = new Set(['index.html', 'manifest.webmanifest', 'icon.svg']);

function copyAssetsPlugin() {
  return {
    name: 'copy-game-assets',
    closeBundle() {
      const srcDir = path.resolve('assets');
      const distDir = path.resolve('dist');
      const distAssetsDir = path.resolve('dist/assets');
      if (fs.existsSync(srcDir)) {
        copyDirSync(srcDir, distAssetsDir);
        const manifestSrc = path.join(srcDir, 'manifest.json');
        const manifestDist = path.resolve('dist/manifest.json');
        if (fs.existsSync(manifestSrc)) {
          fs.copyFileSync(manifestSrc, manifestDist);
        }
      }

      if (!fs.existsSync(distDir)) return;
      const base = process.env.VITE_BASE_PATH || '/marbles/';
      const normalizedBase = base.endsWith('/') ? base : `${base}/`;

      const relFiles = walkFilesSync(distDir).filter((rel) => (
        PRECACHE_ALWAYS.has(rel) || PRECACHE_EXTENSIONS.has(path.extname(rel))
      ));
      const urls = [...new Set(relFiles.map((rel) => `${normalizedBase}${rel}`))].sort();
      fs.writeFileSync(
        path.join(distDir, 'precache-manifest.json'),
        JSON.stringify(urls, null, 2)
      );
      console.log(`[precache] Wrote ${urls.length} entries to dist/precache-manifest.json`);
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

