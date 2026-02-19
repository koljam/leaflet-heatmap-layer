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

  private _circle: HTMLCanvasElement | null = null;
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

  setOptions(options: Partial<HeatRendererOptions>): void {
    if (options.radius !== undefined || options.blur !== undefined) {
      this._radius = options.radius ?? this._radius;
      this._blur = options.blur ?? this._blur;
      this._circle = null;
    }
    if (options.gradient !== undefined) {
      this._gradient = options.gradient;
      this._palette = null;
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

  resize(width: number, height: number): void {
    this._canvas.width = width;
    this._canvas.height = height;
  }

  clear(): void {
    this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
  }

  /** Draw the heatmap. Intensity values should be pre-normalized to 0–1. */
  draw(points: HeatPoint[]): void {
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

  private _getPalette(): Uint8ClampedArray {
    if (this._palette) return this._palette;

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

    this._palette = ctx.getImageData(0, 0, 256, 1).data;
    return this._palette;
  }

  /** Map alpha channel (greyscale intensity) to gradient colors. */
  private _colorize(): void {
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
      // Keep original alpha to preserve the soft falloff from the blurred stamp
    }

    this._ctx.putImageData(imageData, 0, 0);
  }
}
