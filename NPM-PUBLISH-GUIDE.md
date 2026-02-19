# Publishing leaflet-heatmap-layer to npm

## Pre-publish checklist

- [ ] Tests pass: `npm test`
- [ ] Build succeeds: `npm run build`
- [ ] `version` in `package.json` is correct
- [ ] CHANGELOG.md is updated

Preview what gets published:

```bash
npm pack --dry-run
```

---

## Release workflow

```bash
npm test                    # make sure everything works
npm version patch           # or minor/major
npm publish                 # build runs automatically via prepublishOnly
git push && git push --tags # push version commit + tag to GitHub
```

### Version bumps (semver)

- `npm version patch` — bug fixes (1.0.0 → 1.0.1)
- `npm version minor` — new features, backwards compatible (1.0.0 → 1.1.0)
- `npm version major` — breaking changes (1.0.0 → 2.0.0)

`npm version` automatically updates `package.json`, creates a git commit, and tags it.

---

## GitHub release

```bash
gh release create v1.0.1 --title "v1.0.1" --notes "Bug fixes and improvements"
```

---

## Useful commands

| Command | What it does |
|---|---|
| `npm whoami` | Check logged-in npm account |
| `npm pack --dry-run` | Preview published files |
| `npm info leaflet-heatmap-layer` | See published package metadata |
| `npm deprecate leaflet-heatmap-layer@"<1.0.1" "Use >=1.0.1"` | Deprecate old versions |
| `npm unpublish leaflet-heatmap-layer@1.0.0` | Remove a version (within 72h) |
