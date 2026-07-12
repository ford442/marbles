import { defineConfig } from 'vite';

const CROSS_ORIGIN_ISOLATION_HEADERS = {
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

export default defineConfig({
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
  build: {
    rollupOptions: {
      // marble_physics.js is loaded dynamically by src/wasm-bridge.js only when
      // ?wasmPhysics=1 is set, so it must remain a static asset rather than a bundle.
      external: ['/wasm/marble_physics.js']
    }
  }
});
