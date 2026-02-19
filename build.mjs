import * as esbuild from 'esbuild';

const shared = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  external: ['leaflet'],
  sourcemap: true,
};

// ESM
await esbuild.build({
  ...shared,
  format: 'esm',
  outfile: 'dist/leaflet-heatmap-layer.esm.js',
});

// CJS
await esbuild.build({
  ...shared,
  format: 'cjs',
  outfile: 'dist/leaflet-heatmap-layer.cjs.js',
});

// IIFE/UMD (for script tags)
await esbuild.build({
  ...shared,
  format: 'iife',
  globalName: 'LeafletHeatmapLayer',
  outfile: 'dist/leaflet-heatmap-layer.umd.js',
  // For IIFE, leaflet is expected as global `L`
  external: [],
  plugins: [{
    name: 'leaflet-external',
    setup(build) {
      build.onResolve({ filter: /^leaflet$/ }, () => ({
        path: 'leaflet',
        namespace: 'leaflet-global',
      }));
      build.onLoad({ filter: /.*/, namespace: 'leaflet-global' }, () => ({
        contents: 'module.exports = L;',
        loader: 'js',
      }));
    },
  }],
});

console.log('Build complete.');
