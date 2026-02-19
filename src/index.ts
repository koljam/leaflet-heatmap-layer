import L from 'leaflet';
import { HeatLayer, type HeatLayerOptions, type HeatLatLng } from './HeatLayer';
import { HeatRenderer, type HeatRendererOptions, type HeatPoint } from './HeatRenderer';

function heatLayer(latlngs: HeatLatLng[], options?: HeatLayerOptions): HeatLayer {
  return new HeatLayer(latlngs, options);
}

declare module 'leaflet' {
  function heatLayer(latlngs: HeatLatLng[], options?: HeatLayerOptions): HeatLayer;
}

(L as any).heatLayer = heatLayer;

export {
  HeatLayer,
  HeatRenderer,
  heatLayer,
  type HeatLayerOptions,
  type HeatLatLng,
  type HeatRendererOptions,
  type HeatPoint,
};
