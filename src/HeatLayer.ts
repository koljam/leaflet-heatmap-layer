/**
 * HeatLayer — A Leaflet layer that renders a canvas-based heatmap.
 *
 * Handles map lifecycle (add/remove/zoom/pan), projects geographic coordinates
 * to pixel space, performs grid-clustering optimization, computes auto-max
 * intensity, and delegates rendering to HeatRenderer.
 */

import * as L from 'leaflet';
import { HeatRenderer, type HeatPoint } from './HeatRenderer';

export interface HeatLayerOptions extends L.LayerOptions {
  /** Radius of each heat point in pixels (default: 25). */
  radius?: number;
  /** Additional blur in pixels (default: 15). */
  blur?: number;
  /** Minimum opacity of the heatmap (default: 0.05). */
  minOpacity?: number;
  /** Zoom level at which points reach maximum intensity (default: map maxZoom or 18). */
  maxZoom?: number;
  /**
   * Manual maximum intensity cap. When omitted, computed automatically
   * per redraw from all data points — this is the core fix over Leaflet.heat.
   */
  max?: number;
  /** Color gradient stops (default: blue -> cyan -> lime -> yellow -> red). */
  gradient?: Record<number, string>;
  /** Duration in ms to crossfade between old and new heatmap on zoom (default: 250, 0 to disable). */
  zoomCrossfadeDuration?: number;
}

/** Input point: [lat, lng] or [lat, lng, intensity], or L.LatLng (with optional .alt for intensity). */
export type HeatLatLng = [number, number] | [number, number, number] | L.LatLng;

export class HeatLayer extends L.Layer {
  private _latlngs: HeatLatLng[];
  private _options: HeatLayerOptions;
  private _canvas: HTMLCanvasElement | null = null;
  private _renderer: HeatRenderer | null = null;
  private _frame: number | null = null;

  // Zoom crossfade state
  private _snapshotCanvas: HTMLCanvasElement | null = null;
  private _zooming = false;
  private _crossfadeTimer: number | null = null;

  constructor(latlngs: HeatLatLng[], options?: HeatLayerOptions) {
    super(options);
    this._latlngs = latlngs;
    this._options = {
      radius: 25,
      blur: 15,
      minOpacity: 0.05,
      ...options,
    };
  }

  // ---- Leaflet Layer lifecycle ----

  onAdd(map: L.Map): this {
    this._map = map;

    if (!this._canvas) {
      this._createCanvas();
    }

    const pane = this.getPane();
    if (pane && this._canvas) {
      pane.appendChild(this._canvas);
    }

    map.on('moveend', this._onMoveEnd, this);
    map.on('zoomanim', this._onZoomAnim, this);

    this._onMoveEnd();
    return this;
  }

  onRemove(map: L.Map): this {
    // Cancel any pending animation frame to avoid zombie redraws
    if (this._frame !== null) {
      cancelAnimationFrame(this._frame);
      this._frame = null;
    }

    // Clean up crossfade
    this._clearCrossfade();
    if (this._snapshotCanvas && this._snapshotCanvas.parentNode) {
      this._snapshotCanvas.parentNode.removeChild(this._snapshotCanvas);
    }
    this._snapshotCanvas = null;

    const pane = this.getPane();
    if (pane && this._canvas) {
      pane.removeChild(this._canvas);
    }

    map.off('moveend', this._onMoveEnd, this);
    map.off('zoomanim', this._onZoomAnim, this);

    return this;
  }

  // ---- Public API ----

  /** Replace all data points and redraw. */
  setLatLngs(latlngs: HeatLatLng[]): this {
    this._latlngs = latlngs;
    return this.redraw();
  }

  /** Add a single data point and redraw. */
  addLatLng(latlng: HeatLatLng): this {
    this._latlngs.push(latlng);
    return this.redraw();
  }

  /** Update options and redraw. */
  setOptions(options: Partial<HeatLayerOptions>): this {
    Object.assign(this._options, options);
    if (this._renderer) {
      this._renderer.setOptions({
        radius: this._options.radius,
        blur: this._options.blur,
        minOpacity: this._options.minOpacity,
        gradient: this._options.gradient,
      });
    }
    return this.redraw();
  }

  /** Return a LatLngBounds covering all data points. */
  getBounds(): L.LatLngBounds {
    const latlngs = this._latlngs.map((p) => this._toLatLng(p));
    return L.latLngBounds(latlngs);
  }

  /** Schedule a redraw on the next animation frame. */
  redraw(): this {
    if (this._map && this._frame === null) {
      this._frame = requestAnimationFrame(() => {
        this._frame = null;
        this._redraw();
      });
    }
    return this;
  }

  // ---- Internal ----

  private _createCanvas(): void {
    this._canvas = document.createElement('canvas');
    this._canvas.style.position = 'absolute';
    this._canvas.style.pointerEvents = 'none';
    this._canvas.style.willChange = 'transform';
    this._canvas.style.transformOrigin = '0 0';

    // Match original Leaflet.heat: mark as zoom-animated so Leaflet
    // handles visibility correctly during zoom transitions.
    const animated = this._map!.options.zoomAnimation && L.Browser.any3d;
    L.DomUtil.addClass(
      this._canvas,
      'leaflet-zoom-' + (animated ? 'animated' : 'hide'),
    );

    this._renderer = new HeatRenderer(this._canvas, {
      radius: this._options.radius,
      blur: this._options.blur,
      minOpacity: this._options.minOpacity,
      gradient: this._options.gradient,
    });
  }

  /** Handle moveend: reposition canvas and redraw. */
  private _onMoveEnd(): void {
    if (!this._map || !this._canvas) return;

    const wasZooming = this._zooming;
    this._zooming = false;

    const duration = this._options.zoomCrossfadeDuration ?? 250;

    // Snapshot old canvas content before we clear it (for zoom crossfade)
    if (wasZooming && duration > 0) {
      this._takeSnapshot();
    }

    const size = this._map.getSize();
    const topLeft = this._map.containerPointToLayerPoint([0, 0]);

    L.DomUtil.setPosition(this._canvas, topLeft);
    this._renderer!.resize(size.x, size.y);

    this._redraw();

    // Start crossfade from snapshot to freshly rendered canvas
    if (wasZooming && duration > 0) {
      this._startCrossfade(duration);
    }
  }

  /**
   * Handle zoomanim: apply CSS transform for smooth zoom transitions.
   *
   * Computes where the canvas top-left would be in the new zoom's layer
   * space, then applies translate + scale with transform-origin 0 0.
   * Same approach as Leaflet's ImageOverlay._animateZoom.
   */
  private _onZoomAnim(e: L.ZoomAnimEvent): void {
    if (!this._map || !this._canvas) return;

    // Set the zooming flag here (not zoomstart) so crossfade only triggers
    // when an actual zoom animation occurred.
    this._zooming = true;

    const map = this._map;
    const scale = map.getZoomScale(e.zoom);

    // The canvas's current position in layer space (set by _onMoveEnd)
    const canvasPos = L.DomUtil.getPosition(this._canvas);
    // Geographic location of the canvas top-left corner
    const topLeftLatLng = map.layerPointToLatLng(canvasPos);

    // Where this geographic point would be in the new zoom's layer space.
    // Equivalent to map._latLngToNewLayerPoint(latlng, zoom, center):
    //   project(latlng, zoom) - project(center, zoom) + size/2 + layerTopLeft
    const layerTopLeft = map.containerPointToLayerPoint([0, 0]);
    const newPos = map
      .project(topLeftLatLng, e.zoom)
      .subtract(map.project(e.center, e.zoom))
      .add(map.getSize().divideBy(2))
      .add(layerTopLeft)
      .round();

    L.DomUtil.setTransform(this._canvas, newPos, scale);
  }

  /** Copy the current canvas content + CSS transform to a snapshot canvas for crossfade. */
  private _takeSnapshot(): void {
    if (!this._canvas) return;

    // Cancel any in-progress crossfade
    this._clearCrossfade();

    const canvas = this._canvas;

    if (!this._snapshotCanvas) {
      this._snapshotCanvas = document.createElement('canvas');
      this._snapshotCanvas.style.position = 'absolute';
      this._snapshotCanvas.style.pointerEvents = 'none';
    }

    const snap = this._snapshotCanvas;
    snap.width = canvas.width;
    snap.height = canvas.height;
    snap.getContext('2d')!.drawImage(canvas, 0, 0);

    // Copy the CSS transform (zoomanim transform) so snapshot appears in the same position
    snap.style.transform = canvas.style.transform;
    snap.style.transformOrigin = canvas.style.transformOrigin;
    snap.style.opacity = '1';
    snap.style.transition = '';

    // Ensure snapshot is in the DOM and visually above the main canvas
    if (canvas.parentNode) {
      canvas.after(snap);
    }
  }

  /** Fade the snapshot canvas to transparent over the given duration. */
  private _startCrossfade(duration: number): void {
    const snap = this._snapshotCanvas;
    if (!snap) return;

    snap.style.transition = `opacity ${duration}ms ease-out`;

    // Force reflow so the transition triggers
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    snap.offsetHeight;

    snap.style.opacity = '0';

    this._crossfadeTimer = window.setTimeout(() => {
      this._crossfadeTimer = null;
      if (snap) {
        snap.style.transition = '';
      }
    }, duration);
  }

  /** Cancel any in-progress crossfade. */
  private _clearCrossfade(): void {
    if (this._crossfadeTimer !== null) {
      clearTimeout(this._crossfadeTimer);
      this._crossfadeTimer = null;
    }
    if (this._snapshotCanvas) {
      this._snapshotCanvas.style.transition = '';
      this._snapshotCanvas.style.opacity = '0';
    }
  }

  /**
   * Core redraw logic:
   * 1. Project all points to pixel space
   * 2. Compute auto-max intensity (the key fix)
   * 3. Grid-cluster points for performance
   * 4. Normalize intensities and delegate to HeatRenderer
   */
  private _redraw(): void {
    if (!this._map || !this._renderer || !this._canvas) return;

    const map = this._map;
    const size = map.getSize();
    if (size.x === 0 || size.y === 0) return; // no container dimensions yet
    const renderer = this._renderer;
    const r = renderer.radius + renderer.blur;
    const cellSize = Math.max(1, Math.floor(renderer.radius / 2));
    const maxZoom = this._options.maxZoom ?? map.getMaxZoom();
    const zoom = map.getZoom();

    // Zoom scaling factor: at maxZoom intensity is full, at lower zooms it tapers
    const v = 1 / Math.pow(2, Math.max(0, Math.min(maxZoom - zoom, 12)));

    const bounds = map.getBounds();

    // Pad visible bounds by the point radius so edge points are drawn correctly
    const padLat = (r / size.y) * (bounds.getNorth() - bounds.getSouth());
    const padLng = (r / size.x) * (bounds.getEast() - bounds.getWest());
    const paddedBounds = L.latLngBounds(
      [bounds.getSouth() - padLat, bounds.getWest() - padLng],
      [bounds.getNorth() + padLat, bounds.getEast() + padLng],
    );

    // --- Pass 1: compute auto-max across ALL points (not just visible) ---
    // This is the core fix for the intensity/zoom scaling bug.
    let autoMax = 0;
    if (this._options.max === undefined) {
      for (const p of this._latlngs) {
        const intensity = this._getIntensity(p);
        const scaled = intensity * v;
        if (scaled > autoMax) autoMax = scaled;
      }
    }
    const effectiveMax = this._options.max ?? Math.max(autoMax, 1e-10);

    // Layer-space origin of the viewport. Used to:
    // 1. Convert layer points to canvas-local coordinates for drawing
    // 2. Compute stable grid offsets (layer points don't shift on pan)
    const topLeft = map.containerPointToLayerPoint([0, 0]);

    // --- Pass 2: grid-cluster visible points ---
    // Points are aggregated into grid cells of size `cellSize` pixels.
    // Multiple points in the same cell are merged by weighted average.
    //
    // Grid keys use layer-space coordinates which are stable across pans.
    // Without this, panning causes points to fall into different grid cells,
    // producing flickering intensity changes.
    const grid: Record<string, [number, number, number, number]> = {}; // key -> [sumX, sumY, sumIntensity, count]
    const pixelPoints: HeatPoint[] = [];

    for (const p of this._latlngs) {
      const latlng = this._toLatLng(p);
      if (!paddedBounds.contains(latlng)) continue;

      // Layer point: stable across pans (used for grid cell assignment)
      const lp = map.latLngToLayerPoint(latlng);

      // Canvas-local coordinates for drawing
      const x = lp.x - topLeft.x;
      const y = lp.y - topLeft.y;
      const intensity = this._getIntensity(p) * v;

      // Grid cell key in stable layer space
      const gx = Math.floor(lp.x / cellSize);
      const gy = Math.floor(lp.y / cellSize);
      const key = `${gx}:${gy}`;

      const cell = grid[key];
      if (cell) {
        cell[0] += x * intensity; // weighted x (canvas-local)
        cell[1] += y * intensity; // weighted y (canvas-local)
        cell[2] += intensity;
        cell[3]++;
      } else {
        grid[key] = [x * intensity, y * intensity, intensity, 1];
      }
    }

    // Convert grid cells to normalized pixel points
    for (const key in grid) {
      const cell = grid[key];
      const totalIntensity = cell[2];
      if (totalIntensity === 0) continue;

      pixelPoints.push([
        cell[0] / totalIntensity, // weighted avg x (canvas-local)
        cell[1] / totalIntensity, // weighted avg y (canvas-local)
        totalIntensity / effectiveMax, // normalized intensity (0-1)
      ]);
    }

    renderer.draw(pixelPoints);
  }

  /** Extract intensity from a point. Defaults to 1.0. */
  private _getIntensity(p: HeatLatLng): number {
    if (p instanceof L.LatLng) {
      return (p as L.LatLng & { alt?: number }).alt ?? 1.0;
    }
    if (Array.isArray(p) && p.length >= 3) {
      return (p as [number, number, number])[2];
    }
    return 1.0;
  }

  /** Convert any input point format to L.LatLng. */
  private _toLatLng(p: HeatLatLng): L.LatLng {
    if (p instanceof L.LatLng) return p;
    return L.latLng(p[0], p[1]);
  }
}
