# leaflet-heatmap-layer

A modern heatmap layer plugin for [Leaflet](https://leafletjs.com/).

This Plugin is inspired by [Leaflet.heat](https://github.com/Leaflet/Leaflet.heat), built from scratch under the MIT license. It fixes some long-standing bugs and ships as a proper ES module with TypeScript declarations.

## Installation

```bash
npm install leaflet-heatmap-layer
```

Or include via script tag (UMD build):

```html
<script src="https://unpkg.com/leaflet-heatmap-layer/dist/leaflet-heatmap-layer.umd.js"></script>
```

## Quick Start

```js
import L from 'leaflet';
import 'leaflet-heatmap-layer';

const map = L.map('map').setView([51.505, -0.09], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

const points = [
  [51.5, -0.09, 0.8],
  [51.51, -0.1, 0.5],
  [51.49, -0.08, 1.0],
  // ...
];

L.heatLayer(points, { radius: 25 }).addTo(map);
```

You can also use named exports directly:

```js
import { HeatLayer, heatLayer } from 'leaflet-heatmap-layer';
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `radius` | `number` | `25` | Radius of each heat point in pixels |
| `blur` | `number` | `15` | Amount of blur in pixels |
| `minOpacity` | `number` | `0.05` | Minimum opacity of the heatmap |
| `maxZoom` | `number` | map's maxZoom | Zoom level where points reach full intensity |
| `max` | `number` | *auto* | Manual intensity cap. When omitted, computed automatically per redraw |
| `gradient` | `object` | `{0.4:'blue', 0.6:'cyan', 0.7:'lime', 0.8:'yellow', 1:'red'}` | Color gradient stops |
| `zoomCrossfadeDuration` | `number` | `250` | Duration in ms to crossfade between zoom levels (0 to disable) |

## Methods

| Method | Returns | Description |
|---|---|---|
| `setLatLngs(points)` | `this` | Replace all data points and redraw |
| `addLatLng(point)` | `this` | Add a single point and redraw |
| `setOptions(options)` | `this` | Update options and redraw |
| `getBounds()` | `L.LatLngBounds` | Return bounds covering all points |
| `redraw()` | `this` | Force a redraw |

## Point Format

Each point can be:
- `[lat, lng]` — intensity defaults to 1.0
- `[lat, lng, intensity]` — intensity between 0.0 and 1.0
- `L.latLng(lat, lng)` — use `.alt` property for intensity

## Migration from Leaflet.heat

The API is intentionally compatible. For most users:

1. Replace `leaflet.heat` with `leaflet-heatmap-layer` in `package.json`
2. Update your import/script tag

Key differences from Leaflet.heat:
- Intensity is automatically normalized across **all** data points per redraw, fixing the [intensity scaling bug](https://github.com/Leaflet/Leaflet.heat/issues/78)
- Full TypeScript support with exported types
- ES module, CommonJS, and UMD builds

## License

MIT
