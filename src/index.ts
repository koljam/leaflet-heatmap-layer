/**
 * leaflet-heatmap-layer
 *
 * A modern, maintained heatmap layer plugin for Leaflet
 * with automatic intensity scaling across zoom levels.
 */

import L from 'leaflet';
import { HeatLayer, type HeatLayerOptions, type HeatLatLng } from './HeatLayer';
import { HeatRenderer, type HeatRendererOptions, type HeatPoint } from './HeatRenderer';

// Factory function: L.heatLayer(points, options)
function heatLayer(latlngs: HeatLatLng[], options?: HeatLayerOptions): HeatLayer {
  return new HeatLayer(latlngs, options);
}

// Extend L namespace for script-tag usage
declare module 'leaflet' {
  function heatLayer(latlngs: HeatLatLng[], options?: HeatLayerOptions): HeatLayer;
}

// Attach to L namespace for UMD/script-tag consumers
const _L = L as any;
_L.heatLayer = heatLayer;

export {
  HeatLayer,
  HeatRenderer,
  heatLayer,
  type HeatLayerOptions,
  type HeatLatLng,
  type HeatRendererOptions,
  type HeatPoint,
};
