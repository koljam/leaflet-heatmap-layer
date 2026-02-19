# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2024-01-01

### Added
- Initial release as a clean-room rewrite of Leaflet.heat
- `HeatLayer` — Leaflet layer class with full map lifecycle support
- `HeatRenderer` — standalone canvas renderer with no Leaflet dependency
- `L.heatLayer()` factory function for API compatibility with Leaflet.heat
- Auto-max intensity computation across all data points per redraw (fixes Leaflet.heat#78)
- Grid-clustering optimization for large datasets
- TypeScript declarations
- ES module, CommonJS, and UMD builds
- Proper `requestAnimationFrame` cleanup on layer removal
- Consistent pane handling between `onAdd` and `onRemove`
