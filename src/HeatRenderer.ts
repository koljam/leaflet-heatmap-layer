/**
 * HeatRenderer — a pure canvas heatmap renderer with no Leaflet dependency.
 *
 * Draws a heatmap onto an HTMLCanvasElement given pixel-space data points.
 * Handles gradient generation, blurred-circle stamping, and final colorization.
 */

export interface HeatRendererOptions {
  /** Radius of each heat point in pixels. */
  radius: number;
  /** Additional blur applied to each point in pixels. */
  blur: number;
  /** Minimum opacity of the heatmap output (0–1). */
  minOpacity: number;
  /** Color gradient stops, keyed by position (0–1). */
  gradient: Record<number, string>;
}

/** A pixel-space data point: [x, y, intensity]. */
export type HeatPoint = [number, number, number];

const DEFAULT_GRADIENT: Record<number, string> = {
  0.4: 'blue',
  0.6: 'cyan',
  0.7: 'lime',
  0.8: 'yellow',
  1.0: 'red',
};

export class HeatRenderer {
  private _canvas: HTMLCanvasElement;
  private _ctx: CanvasRenderingContext2D;

  /** Pre-rendered blurred circle used as stamp for each point. */
  private _circle: HTMLCanvasElement | null = null;
  /** 256-entry RGBA palette derived from the gradient. */
  private _palette: Uint8ClampedArray | null = null;

  private _radius: number;
  private _blur: number;
  private _minOpacity: number;
  private _gradient: Record<number, string>;

  constructor(canvas: HTMLCanvasElement, options?: Partial<HeatRendererOptions>) {
    this._canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2d context from canvas');
    this._ctx = ctx;

    this._radius = options?.radius ?? 25;
    this._blur = options?.blur ?? 15;
    this._minOpacity = options?.minOpacity ?? 0.05;
    this._gradient = options?.gradient ?? DEFAULT_GRADIENT;
  }

  /** Update renderer options. Invalidates cached circle/palette as needed. */
  setOptions(options: Partial<HeatRendererOptions>): void {
    if (options.radius !== undefined || options.blur !== undefined) {
      this._radius = options.radius ?? this._radius;
      this._blur = options.blur ?? this._blur;
      this._circle = null; // invalidate cached circle
    }
    if (options.gradient !== undefined) {
      this._gradient = options.gradient;
      this._palette = null; // invalidate cached palette
    }
    if (options.minOpacity !== undefined) {
      this._minOpacity = options.minOpacity;
    }
  }

  get radius(): number {
    return this._radius;
  }

  get blur(): number {
    return this._blur;
  }

  /**
   * Resize the canvas to the given dimensions.
   * This clears the canvas content.
   */
  resize(width: number, height: number): void {
    this._canvas.width = width;
    this._canvas.height = height;
  }

  /**
   * Clear the canvas.
   */
  clear(): void {
    this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
  }

  /**
   * Draw the heatmap from an array of pixel-space points.
   *
   * @param points Array of [x, y, intensity] tuples. Intensity should be
   *   pre-normalized to the range 0–1 (the caller handles max computation).
   */
  draw(points: HeatPoint[]): void {
    if (points.length === 0) {
      this.clear();
      return;
    }

    const circle = this._getCircle();
    const fullRadius = this._radius + this._blur;

    // --- Pass 1: stamp blurred circles in greyscale (alpha channel) ---
    this.clear();

    for (const [x, y, intensity] of points) {
      this._ctx.globalAlpha = Math.max(intensity, this._minOpacity);
      this._ctx.drawImage(circle, x - fullRadius, y - fullRadius);
    }

    // --- Pass 2: colorize using the gradient palette ---
    this._colorize();
  }

  /**
   * Get (or create) the pre-rendered blurred circle stamp.
   * This is an offscreen canvas containing a single radial-gradient circle.
   */
  private _getCircle(): HTMLCanvasElement {
    if (this._circle) return this._circle;

    const r = this._radius;
    const blur = this._blur;
    const fullRadius = r + blur;
    const diameter = fullRadius * 2;

    const circle = document.createElement('canvas');
    circle.width = diameter;
    circle.height = diameter;
    const ctx = circle.getContext('2d')!;

    // Draw a soft radial gradient from opaque center to transparent edge
    ctx.shadowOffsetX = diameter;
    ctx.shadowOffsetY = diameter;
    ctx.shadowBlur = blur;
    ctx.shadowColor = 'black';

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
  private _getPalette(): Uint8ClampedArray {
    if (this._palette) return this._palette;

    // Draw the gradient onto a 1×256 canvas and read back pixel data
    const paletteCanvas = document.createElement('canvas');
    paletteCanvas.width = 256;
    paletteCanvas.height = 1;
    const ctx = paletteCanvas.getContext('2d')!;

    const grad = ctx.createLinearGradient(0, 0, 256, 0);
    for (const [stop, color] of Object.entries(this._gradient)) {
      grad.addColorStop(Number(stop), color);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 1);

    this._palette = ctx.getImageData(0, 0, 256, 1).data as unknown as Uint8ClampedArray;
    return this._palette;
  }

  /**
   * Colorize the current canvas content.
   * Reads the alpha channel of each pixel (which encodes heat intensity from
   * the greyscale stamp pass), and replaces it with the corresponding color
   * from the gradient palette.
   */
  private _colorize(): void {
    const w = this._canvas.width;
    const h = this._canvas.height;
    if (w === 0 || h === 0) return;

    const imageData = this._ctx.getImageData(0, 0, w, h);
    const pixels = imageData.data;
    const palette = this._getPalette();

    for (let i = 0, len = pixels.length; i < len; i += 4) {
      // The alpha value (0–255) from the greyscale pass indexes into the palette
      const alpha = pixels[i + 3];
      if (alpha === 0) continue;

      const paletteOffset = alpha * 4;
      pixels[i] = palette[paletteOffset];       // R
      pixels[i + 1] = palette[paletteOffset + 1]; // G
      pixels[i + 2] = palette[paletteOffset + 2]; // B
      // Keep original alpha — it encodes the soft intensity falloff from the
      // blurred circle stamp. Replacing it with palette alpha (typically 255
      // for solid gradient colors) would make every pixel fully opaque.
    }

    this._ctx.putImageData(imageData, 0, 0);
  }
}
