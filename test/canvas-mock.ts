/**
 * Minimal CanvasRenderingContext2D mock for jsdom testing.
 * jsdom doesn't implement canvas natively, so we provide stubs
 * for the methods used by HeatRenderer.
 */

class MockImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
  }
}

class MockCanvasGradient {
  stops: Array<{ offset: number; color: string }> = [];
  addColorStop(offset: number, color: string): void {
    this.stops.push({ offset, color });
  }
}

class MockCanvasRenderingContext2D {
  canvas: HTMLCanvasElement;
  globalAlpha = 1;
  fillStyle: string | MockCanvasGradient = '#000000';
  shadowOffsetX = 0;
  shadowOffsetY = 0;
  shadowBlur = 0;
  shadowColor = 'transparent';

  private _imageData: MockImageData | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  clearRect(_x: number, _y: number, _w: number, _h: number): void {
    this._imageData = null;
  }

  fillRect(_x: number, _y: number, _w: number, _h: number): void {}

  drawImage(_image: any, _dx: number, _dy: number): void {}

  beginPath(): void {}
  closePath(): void {}
  fill(): void {}

  arc(
    _x: number,
    _y: number,
    _radius: number,
    _startAngle: number,
    _endAngle: number,
    _counterclockwise?: boolean,
  ): void {}

  createLinearGradient(
    _x0: number,
    _y0: number,
    _x1: number,
    _y1: number,
  ): MockCanvasGradient {
    return new MockCanvasGradient();
  }

  getImageData(x: number, y: number, w: number, h: number): MockImageData {
    return new MockImageData(w, h);
  }

  putImageData(_imageData: MockImageData, _dx: number, _dy: number): void {}
}

// Patch HTMLCanvasElement.prototype.getContext to return our mock
const originalGetContext = HTMLCanvasElement.prototype.getContext;

export function installCanvasMock(): void {
  (HTMLCanvasElement.prototype as any).getContext = function (
    contextType: string,
  ) {
    if (contextType === '2d') {
      return new MockCanvasRenderingContext2D(this);
    }
    return originalGetContext.call(this, contextType);
  };
}

export function uninstallCanvasMock(): void {
  HTMLCanvasElement.prototype.getContext = originalGetContext;
}
