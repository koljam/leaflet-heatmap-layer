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
    if (this._frame !== null) {
      cancelAnimationFrame(this._frame);
      this._frame = null;
    }

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

  /** Return a LatLngBounds covering all data points, or an invalid bounds if empty. */
  getBounds(): L.LatLngBounds {
    if (this._latlngs.length === 0) return L.latLngBounds([]);
    return L.latLngBounds(this._latlngs.map((p) => this._toLatLng(p)));
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

  private _createCanvas(): void {
    this._canvas = document.createElement('canvas');
    this._canvas.style.position = 'absolute';
    this._canvas.style.pointerEvents = 'none';
    this._canvas.style.willChange = 'transform';
    this._canvas.style.transformOrigin = '0 0';

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

  private _onMoveEnd(): void {
    if (!this._map || !this._canvas) return;

    const wasZooming = this._zooming;
    this._zooming = false;

    const duration = this._options.zoomCrossfadeDuration ?? 250;

    if (wasZooming && duration > 0) {
      this._takeSnapshot();
    }

    const size = this._map.getSize();
    const topLeft = this._map.containerPointToLayerPoint([0, 0]);

    L.DomUtil.setPosition(this._canvas, topLeft);
    this._renderer!.resize(size.x, size.y);

    this._redraw();

    if (wasZooming && duration > 0) {
      this._startCrossfade(duration);
    }
  }

  /** Apply CSS transform during zoom animation (same approach as Leaflet's ImageOverlay). */
  private _onZoomAnim(e: L.ZoomAnimEvent): void {
    if (!this._map || !this._canvas) return;

    this._zooming = true;

    const map = this._map;
    const scale = map.getZoomScale(e.zoom);
    const canvasPos = L.DomUtil.getPosition(this._canvas);
    const topLeftLatLng = map.layerPointToLatLng(canvasPos);

    const layerTopLeft = map.containerPointToLayerPoint([0, 0]);
    const newPos = map
      .project(topLeftLatLng, e.zoom)
      .subtract(map.project(e.center, e.zoom))
      .add(map.getSize().divideBy(2))
      .add(layerTopLeft)
      .round();

    L.DomUtil.setTransform(this._canvas, newPos, scale);
  }

  private _takeSnapshot(): void {
    if (!this._canvas) return;

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

    snap.style.transform = canvas.style.transform;
    snap.style.transformOrigin = canvas.style.transformOrigin;
    snap.style.opacity = '1';
    snap.style.transition = '';

    if (canvas.parentNode) {
      canvas.after(snap);
    }
  }

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

  private _redraw(): void {
    if (!this._map || !this._renderer || !this._canvas) return;

    const map = this._map;
    const size = map.getSize();
    if (size.x === 0 || size.y === 0) return;
    const renderer = this._renderer;
    const r = renderer.radius + renderer.blur;
    const cellSize = Math.max(1, Math.floor(renderer.radius / 2));
    const maxZoom = this._options.maxZoom ?? map.getMaxZoom();
    const zoom = map.getZoom();

    // At maxZoom intensity is full, at lower zooms it tapers exponentially
    const v = 1 / Math.pow(2, Math.max(0, Math.min(maxZoom - zoom, 12)));

    const bounds = map.getBounds();
    const padLat = (r / size.y) * (bounds.getNorth() - bounds.getSouth());
    const padLng = (r / size.x) * (bounds.getEast() - bounds.getWest());
    const paddedBounds = L.latLngBounds(
      [bounds.getSouth() - padLat, bounds.getWest() - padLng],
      [bounds.getNorth() + padLat, bounds.getEast() + padLng],
    );

    // Compute auto-max across ALL points (not just visible) — this is the
    // core fix for the intensity/zoom scaling bug in Leaflet.heat.
    let autoMax = 0;
    if (this._options.max === undefined) {
      for (const p of this._latlngs) {
        const scaled = this._getIntensity(p) * v;
        if (scaled > autoMax) autoMax = scaled;
      }
    }
    const effectiveMax = this._options.max ?? Math.max(autoMax, 1e-10);

    const topLeft = map.containerPointToLayerPoint([0, 0]);

    // Grid-cluster visible points. Grid keys use layer-space coordinates
    // (stable across pans) to avoid flickering when cells shift on pan.
    const grid: Record<string, [number, number, number, number]> = {};
    const pixelPoints: HeatPoint[] = [];

    for (const p of this._latlngs) {
      const latlng = this._toLatLng(p);
      if (!paddedBounds.contains(latlng)) continue;

      const lp = map.latLngToLayerPoint(latlng);
      const x = lp.x - topLeft.x;
      const y = lp.y - topLeft.y;
      const intensity = this._getIntensity(p) * v;

      const gx = Math.floor(lp.x / cellSize);
      const gy = Math.floor(lp.y / cellSize);
      const key = `${gx}:${gy}`;

      const cell = grid[key];
      if (cell) {
        cell[0] += x * intensity;
        cell[1] += y * intensity;
        cell[2] += intensity;
        cell[3]++;
      } else {
        grid[key] = [x * intensity, y * intensity, intensity, 1];
      }
    }

    for (const key in grid) {
      const cell = grid[key];
      const totalIntensity = cell[2];
      if (totalIntensity === 0) continue;

      pixelPoints.push([
        cell[0] / totalIntensity,
        cell[1] / totalIntensity,
        totalIntensity / effectiveMax,
      ]);
    }

    renderer.draw(pixelPoints);
  }

  private _getIntensity(p: HeatLatLng): number {
    if (p instanceof L.LatLng) {
      return (p as L.LatLng & { alt?: number }).alt ?? 1.0;
    }
    if (Array.isArray(p) && p.length >= 3) {
      return (p as [number, number, number])[2];
    }
    return 1.0;
  }

  private _toLatLng(p: HeatLatLng): L.LatLng {
    if (p instanceof L.LatLng) return p;
    return L.latLng(p[0], p[1]);
  }
}
