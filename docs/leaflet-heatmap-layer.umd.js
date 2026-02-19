"use strict";
var LeafletHeatmapLayer = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // leaflet-global:leaflet
  var require_leaflet = __commonJS({
    "leaflet-global:leaflet"(exports, module) {
      module.exports = L;
    }
  });

  // src/index.ts
  var index_exports = {};
  __export(index_exports, {
    HeatLayer: () => HeatLayer,
    HeatRenderer: () => HeatRenderer,
    heatLayer: () => heatLayer
  });
  var import_leaflet = __toESM(require_leaflet());

  // src/HeatLayer.ts
  var L2 = __toESM(require_leaflet());

  // src/HeatRenderer.ts
  var DEFAULT_GRADIENT = {
    0.4: "blue",
    0.6: "cyan",
    0.7: "lime",
    0.8: "yellow",
    1: "red"
  };
  var HeatRenderer = class {
    constructor(canvas, options) {
      /** Pre-rendered blurred circle used as stamp for each point. */
      this._circle = null;
      /** 256-entry RGBA palette derived from the gradient. */
      this._palette = null;
      this._canvas = canvas;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not get 2d context from canvas");
      this._ctx = ctx;
      this._radius = options?.radius ?? 25;
      this._blur = options?.blur ?? 15;
      this._minOpacity = options?.minOpacity ?? 0.05;
      this._gradient = options?.gradient ?? DEFAULT_GRADIENT;
    }
    /** Update renderer options. Invalidates cached circle/palette as needed. */
    setOptions(options) {
      if (options.radius !== void 0 || options.blur !== void 0) {
        this._radius = options.radius ?? this._radius;
        this._blur = options.blur ?? this._blur;
        this._circle = null;
      }
      if (options.gradient !== void 0) {
        this._gradient = options.gradient;
        this._palette = null;
      }
      if (options.minOpacity !== void 0) {
        this._minOpacity = options.minOpacity;
      }
    }
    get radius() {
      return this._radius;
    }
    get blur() {
      return this._blur;
    }
    /**
     * Resize the canvas to the given dimensions.
     * This clears the canvas content.
     */
    resize(width, height) {
      this._canvas.width = width;
      this._canvas.height = height;
    }
    /**
     * Clear the canvas.
     */
    clear() {
      this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    }
    /**
     * Draw the heatmap from an array of pixel-space points.
     *
     * @param points Array of [x, y, intensity] tuples. Intensity should be
     *   pre-normalized to the range 0–1 (the caller handles max computation).
     */
    draw(points) {
      if (points.length === 0) {
        this.clear();
        return;
      }
      const circle = this._getCircle();
      const fullRadius = this._radius + this._blur;
      this.clear();
      for (const [x, y, intensity] of points) {
        this._ctx.globalAlpha = Math.max(intensity, this._minOpacity);
        this._ctx.drawImage(circle, x - fullRadius, y - fullRadius);
      }
      this._colorize();
    }
    /**
     * Get (or create) the pre-rendered blurred circle stamp.
     * This is an offscreen canvas containing a single radial-gradient circle.
     */
    _getCircle() {
      if (this._circle) return this._circle;
      const r = this._radius;
      const blur = this._blur;
      const fullRadius = r + blur;
      const diameter = fullRadius * 2;
      const circle = document.createElement("canvas");
      circle.width = diameter;
      circle.height = diameter;
      const ctx = circle.getContext("2d");
      ctx.shadowOffsetX = diameter;
      ctx.shadowOffsetY = diameter;
      ctx.shadowBlur = blur;
      ctx.shadowColor = "black";
      ctx.beginPath();
      ctx.arc(fullRadius - diameter, fullRadius - diameter, r, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.fill();
      this._circle = circle;
      return circle;
    }
    /**
     * Get (or create) the 256-entry RGBA color palette from the gradient.
     */
    _getPalette() {
      if (this._palette) return this._palette;
      const paletteCanvas = document.createElement("canvas");
      paletteCanvas.width = 256;
      paletteCanvas.height = 1;
      const ctx = paletteCanvas.getContext("2d");
      const grad = ctx.createLinearGradient(0, 0, 256, 0);
      for (const [stop, color] of Object.entries(this._gradient)) {
        grad.addColorStop(Number(stop), color);
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 1);
      this._palette = ctx.getImageData(0, 0, 256, 1).data;
      return this._palette;
    }
    /**
     * Colorize the current canvas content.
     * Reads the alpha channel of each pixel (which encodes heat intensity from
     * the greyscale stamp pass), and replaces it with the corresponding color
     * from the gradient palette.
     */
    _colorize() {
      const w = this._canvas.width;
      const h = this._canvas.height;
      if (w === 0 || h === 0) return;
      const imageData = this._ctx.getImageData(0, 0, w, h);
      const pixels = imageData.data;
      const palette = this._getPalette();
      for (let i = 0, len = pixels.length; i < len; i += 4) {
        const alpha = pixels[i + 3];
        if (alpha === 0) continue;
        const paletteOffset = alpha * 4;
        pixels[i] = palette[paletteOffset];
        pixels[i + 1] = palette[paletteOffset + 1];
        pixels[i + 2] = palette[paletteOffset + 2];
      }
      this._ctx.putImageData(imageData, 0, 0);
    }
  };

  // src/HeatLayer.ts
  var HeatLayer = class extends L2.Layer {
    constructor(latlngs, options) {
      super(options);
      this._canvas = null;
      this._renderer = null;
      this._frame = null;
      // Zoom crossfade state
      this._snapshotCanvas = null;
      this._zooming = false;
      this._crossfadeTimer = null;
      this._latlngs = latlngs;
      this._options = {
        radius: 25,
        blur: 15,
        minOpacity: 0.05,
        ...options
      };
    }
    // ---- Leaflet Layer lifecycle ----
    onAdd(map) {
      this._map = map;
      if (!this._canvas) {
        this._createCanvas();
      }
      const pane = this.getPane();
      if (pane && this._canvas) {
        pane.appendChild(this._canvas);
      }
      map.on("moveend", this._onMoveEnd, this);
      map.on("zoomstart", this._onZoomStart, this);
      map.on("zoomanim", this._onZoomAnim, this);
      this._onMoveEnd();
      return this;
    }
    onRemove(map) {
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
      map.off("moveend", this._onMoveEnd, this);
      map.off("zoomstart", this._onZoomStart, this);
      map.off("zoomanim", this._onZoomAnim, this);
      return this;
    }
    // ---- Public API ----
    /** Replace all data points and redraw. */
    setLatLngs(latlngs) {
      this._latlngs = latlngs;
      return this.redraw();
    }
    /** Add a single data point and redraw. */
    addLatLng(latlng) {
      this._latlngs.push(latlng);
      return this.redraw();
    }
    /** Update options and redraw. */
    setOptions(options) {
      Object.assign(this._options, options);
      if (this._renderer) {
        this._renderer.setOptions({
          radius: this._options.radius,
          blur: this._options.blur,
          minOpacity: this._options.minOpacity,
          gradient: this._options.gradient
        });
      }
      return this.redraw();
    }
    /** Return a LatLngBounds covering all data points. */
    getBounds() {
      const latlngs = this._latlngs.map((p) => this._toLatLng(p));
      return L2.latLngBounds(latlngs);
    }
    /** Schedule a redraw on the next animation frame. */
    redraw() {
      if (this._map && this._frame === null) {
        this._frame = requestAnimationFrame(() => {
          this._frame = null;
          this._redraw();
        });
      }
      return this;
    }
    // ---- Internal ----
    _createCanvas() {
      this._canvas = document.createElement("canvas");
      this._canvas.style.position = "absolute";
      this._canvas.style.pointerEvents = "none";
      this._canvas.style.willChange = "transform";
      this._renderer = new HeatRenderer(this._canvas, {
        radius: this._options.radius,
        blur: this._options.blur,
        minOpacity: this._options.minOpacity,
        gradient: this._options.gradient
      });
    }
    /** Track zoom start so moveend knows whether to crossfade. */
    _onZoomStart() {
      this._zooming = true;
    }
    /** Handle moveend: reposition canvas and redraw. */
    _onMoveEnd() {
      if (!this._map || !this._canvas) return;
      const wasZooming = this._zooming;
      this._zooming = false;
      const duration = this._options.zoomCrossfadeDuration ?? 250;
      if (wasZooming && duration > 0) {
        this._takeSnapshot();
      }
      const size = this._map.getSize();
      const topLeft = this._map.containerPointToLayerPoint([0, 0]);
      L2.DomUtil.setPosition(this._canvas, topLeft);
      this._renderer.resize(size.x, size.y);
      this._redraw();
      if (wasZooming && duration > 0) {
        this._startCrossfade(duration);
      }
    }
    /** Handle zoomanim: apply CSS transform for smooth zoom transitions. */
    _onZoomAnim(e) {
      if (!this._map || !this._canvas) return;
      const scale = this._map.getZoomScale(e.zoom);
      const offset = this._map.getSize().multiplyBy(0.5).subtract(
        this._map.project(e.center, e.zoom).subtract(this._map.getPixelOrigin())
      );
      L2.DomUtil.setTransform(this._canvas, offset, scale);
    }
    /** Copy the current canvas content + CSS transform to a snapshot canvas for crossfade. */
    _takeSnapshot() {
      if (!this._canvas) return;
      this._clearCrossfade();
      const canvas = this._canvas;
      if (!this._snapshotCanvas) {
        this._snapshotCanvas = document.createElement("canvas");
        this._snapshotCanvas.style.position = "absolute";
        this._snapshotCanvas.style.pointerEvents = "none";
      }
      const snap = this._snapshotCanvas;
      snap.width = canvas.width;
      snap.height = canvas.height;
      snap.getContext("2d").drawImage(canvas, 0, 0);
      snap.style.transform = canvas.style.transform;
      snap.style.transformOrigin = canvas.style.transformOrigin;
      snap.style.opacity = "1";
      snap.style.transition = "";
      if (canvas.parentNode) {
        canvas.after(snap);
      }
    }
    /** Fade the snapshot canvas to transparent over the given duration. */
    _startCrossfade(duration) {
      const snap = this._snapshotCanvas;
      if (!snap) return;
      snap.style.transition = `opacity ${duration}ms ease-out`;
      snap.offsetHeight;
      snap.style.opacity = "0";
      this._crossfadeTimer = window.setTimeout(() => {
        this._crossfadeTimer = null;
        if (snap) {
          snap.style.transition = "";
        }
      }, duration);
    }
    /** Cancel any in-progress crossfade. */
    _clearCrossfade() {
      if (this._crossfadeTimer !== null) {
        clearTimeout(this._crossfadeTimer);
        this._crossfadeTimer = null;
      }
      if (this._snapshotCanvas) {
        this._snapshotCanvas.style.transition = "";
        this._snapshotCanvas.style.opacity = "0";
      }
    }
    /**
     * Core redraw logic:
     * 1. Project all points to pixel space
     * 2. Compute auto-max intensity (the key fix)
     * 3. Grid-cluster points for performance
     * 4. Normalize intensities and delegate to HeatRenderer
     */
    _redraw() {
      if (!this._map || !this._renderer || !this._canvas) return;
      const map = this._map;
      const size = map.getSize();
      if (size.x === 0 || size.y === 0) return;
      const renderer = this._renderer;
      const r = renderer.radius + renderer.blur;
      const cellSize = Math.max(1, Math.floor(renderer.radius / 2));
      const maxZoom = this._options.maxZoom ?? map.getMaxZoom();
      const zoom = map.getZoom();
      const v = 1 / Math.pow(2, Math.max(0, Math.min(maxZoom - zoom, 12)));
      const bounds = map.getBounds();
      const padLat = r / size.y * (bounds.getNorth() - bounds.getSouth());
      const padLng = r / size.x * (bounds.getEast() - bounds.getWest());
      const paddedBounds = L2.latLngBounds(
        [bounds.getSouth() - padLat, bounds.getWest() - padLng],
        [bounds.getNorth() + padLat, bounds.getEast() + padLng]
      );
      let autoMax = 0;
      if (this._options.max === void 0) {
        for (const p of this._latlngs) {
          const intensity = this._getIntensity(p);
          const scaled = intensity * v;
          if (scaled > autoMax) autoMax = scaled;
        }
      }
      const effectiveMax = this._options.max ?? Math.max(autoMax, 1e-10);
      const paneOffset = map.containerPointToLayerPoint([0, 0]);
      const gridOffsetX = (paneOffset.x % cellSize + cellSize) % cellSize;
      const gridOffsetY = (paneOffset.y % cellSize + cellSize) % cellSize;
      const grid = {};
      const pixelPoints = [];
      for (const p of this._latlngs) {
        const latlng = this._toLatLng(p);
        if (!paddedBounds.contains(latlng)) continue;
        const point = map.latLngToContainerPoint(latlng);
        const x = point.x;
        const y = point.y;
        const intensity = this._getIntensity(p) * v;
        const gx = Math.floor((x - gridOffsetX) / cellSize);
        const gy = Math.floor((y - gridOffsetY) / cellSize);
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
          // weighted avg x
          cell[1] / totalIntensity,
          // weighted avg y
          totalIntensity / effectiveMax
          // normalized intensity (0-1)
        ]);
      }
      renderer.draw(pixelPoints);
    }
    /** Extract intensity from a point. Defaults to 1.0. */
    _getIntensity(p) {
      if (p instanceof L2.LatLng) {
        return p.alt ?? 1;
      }
      if (Array.isArray(p) && p.length >= 3) {
        return p[2];
      }
      return 1;
    }
    /** Convert any input point format to L.LatLng. */
    _toLatLng(p) {
      if (p instanceof L2.LatLng) return p;
      return L2.latLng(p[0], p[1]);
    }
  };

  // src/index.ts
  function heatLayer(latlngs, options) {
    return new HeatLayer(latlngs, options);
  }
  var _L = import_leaflet.default;
  _L.heatLayer = heatLayer;
  return __toCommonJS(index_exports);
})();
//# sourceMappingURL=leaflet-heatmap-layer.umd.js.map
