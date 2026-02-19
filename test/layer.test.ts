import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { installCanvasMock } from './canvas-mock';
import * as L from 'leaflet';
import { HeatLayer, heatLayer } from '../src/index';

beforeAll(() => {
  installCanvasMock();
});

describe('HeatLayer', () => {
  let container: HTMLDivElement;
  let map: L.Map;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '400px';
    container.style.height = '300px';
    document.body.appendChild(container);
    map = L.map(container, { center: [51.505, -0.09], zoom: 13 });
  });

  afterEach(() => {
    map.remove();
    document.body.removeChild(container);
  });

  it('creates a HeatLayer instance', () => {
    const layer = new HeatLayer([[51.5, -0.09, 0.8]]);
    expect(layer).toBeInstanceOf(HeatLayer);
  });

  it('factory function creates a HeatLayer', () => {
    const layer = heatLayer([[51.5, -0.09, 0.8]], { radius: 30 });
    expect(layer).toBeInstanceOf(HeatLayer);
  });

  it('can be added to and removed from a map', () => {
    const layer = new HeatLayer([[51.5, -0.09, 0.8]]);
    layer.addTo(map);
    expect(map.hasLayer(layer)).toBe(true);

    layer.remove();
    expect(map.hasLayer(layer)).toBe(false);
  });

  it('setLatLngs replaces data and is chainable', () => {
    const layer = new HeatLayer([[51.5, -0.09, 0.8]]);
    layer.addTo(map);

    const result = layer.setLatLngs([
      [51.51, -0.1, 0.5],
      [51.49, -0.08, 1.0],
    ]);
    expect(result).toBe(layer);
  });

  it('addLatLng adds a point and is chainable', () => {
    const layer = new HeatLayer([]);
    layer.addTo(map);

    const result = layer.addLatLng([51.5, -0.09, 0.8]);
    expect(result).toBe(layer);
  });

  it('setOptions is chainable', () => {
    const layer = new HeatLayer([[51.5, -0.09, 0.8]]);
    layer.addTo(map);

    const result = layer.setOptions({ radius: 30, blur: 20 });
    expect(result).toBe(layer);
  });

  it('getBounds returns valid bounds', () => {
    const layer = new HeatLayer([
      [51.5, -0.09, 0.8],
      [51.51, -0.1, 0.5],
    ]);
    const bounds = layer.getBounds();
    expect(bounds).toBeInstanceOf(L.LatLngBounds);
    expect(bounds.getSouth()).toBeCloseTo(51.5);
    expect(bounds.getNorth()).toBeCloseTo(51.51);
  });

  it('redraw returns this for chaining', () => {
    const layer = new HeatLayer([[51.5, -0.09, 0.8]]);
    layer.addTo(map);
    const result = layer.redraw();
    expect(result).toBe(layer);
  });

  it('accepts L.LatLng objects as points', () => {
    const point = L.latLng(51.5, -0.09);
    (point as any).alt = 0.7;
    const layer = new HeatLayer([point]);
    layer.addTo(map);
    expect(map.hasLayer(layer)).toBe(true);
  });

  it('handles points without intensity', () => {
    const layer = new HeatLayer([[51.5, -0.09]]);
    layer.addTo(map);
    expect(map.hasLayer(layer)).toBe(true);
  });

  it('L.heatLayer is available on L namespace', () => {
    expect(typeof (L as any).heatLayer).toBe('function');
  });
});
