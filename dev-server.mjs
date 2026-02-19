import * as esbuild from 'esbuild';
import { copyFileSync } from 'fs';

// Build UMD bundle with watch + serve for the demo page
const ctx = await esbuild.context({
  entryPoints: ['src/index.ts'],
  bundle: true,
  format: 'iife',
  globalName: 'LeafletHeatmapLayer',
  outfile: 'docs/leaflet-heatmap-layer.umd.js',
  sourcemap: true,
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

await ctx.watch();

const { host, port } = await ctx.serve({ servedir: 'docs' });
console.log(`Demo running at http://localhost:${port}`);
