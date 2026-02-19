import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { installCanvasMock } from './canvas-mock';
import { HeatRenderer, type HeatPoint } from '../src/HeatRenderer';

beforeAll(() => {
  installCanvasMock();
});

describe('HeatRenderer', () => {
  let canvas: HTMLCanvasElement;
  let renderer: HeatRenderer;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    renderer = new HeatRenderer(canvas);
  });

  it('creates a renderer with default options', () => {
    expect(renderer.radius).toBe(25);
    expect(renderer.blur).toBe(15);
  });

  it('creates a renderer with custom options', () => {
    const r = new HeatRenderer(canvas, { radius: 30, blur: 10, minOpacity: 0.1, gradient: { 0: 'blue', 1: 'red' } });
    expect(r.radius).toBe(30);
    expect(r.blur).toBe(10);
  });

  it('resizes the canvas', () => {
    renderer.resize(400, 300);
    expect(canvas.width).toBe(400);
    expect(canvas.height).toBe(300);
  });

  it('clears without error', () => {
    expect(() => renderer.clear()).not.toThrow();
  });

  it('draws without error with empty points', () => {
    expect(() => renderer.draw([])).not.toThrow();
  });

  it('draws points without throwing', () => {
    const points: HeatPoint[] = [
      [100, 100, 1.0],
      [50, 50, 0.5],
      [150, 150, 0.3],
    ];
    expect(() => renderer.draw(points)).not.toThrow();
  });

  it('setOptions updates radius and blur', () => {
    renderer.setOptions({ radius: 50, blur: 20 });
    expect(renderer.radius).toBe(50);
    expect(renderer.blur).toBe(20);
  });

  it('setOptions updates only specified properties', () => {
    renderer.setOptions({ radius: 40 });
    expect(renderer.radius).toBe(40);
    expect(renderer.blur).toBe(15); // unchanged
  });
});
