# Publishing leaflet-heatmap-layer to npm

A step-by-step guide for publishing this package.

---

## 1. One-time npm account setup

### Create an npm account

1. Go to https://www.npmjs.com/signup
2. Pick a username, enter your email, set a password
3. Verify your email (check inbox)

### Enable 2FA (strongly recommended)

npm now requires or strongly encourages 2FA for publishing.

1. Log in at npmjs.com → **Account** → **Two Factor Authentication**
2. Enable it using an authenticator app (Google Authenticator, Authy, etc.)

### Log in from your terminal

```bash
npm login
```

It will open a browser or prompt for your username, password, and 2FA code.
To verify you're logged in:

```bash
npm whoami
```

---

## 2. Check the package name is available

```bash
npm search leaflet-heatmap-layer
```

Or just visit `https://www.npmjs.com/package/leaflet-heatmap-layer` in a browser.
If the name is taken, you have two options:

- **Pick a different name** — edit `"name"` in `package.json`
- **Use a scoped name** — e.g. `@koljam/leaflet-heatmap-layer` (scoped packages are
  private by default on npm, so you'd publish with `npm publish --access public`)

---

## 3. Pre-publish checklist

Before every publish, make sure:

- [ ] Tests pass: `npm test`
- [ ] Build succeeds: `npm run build`
- [ ] `version` in `package.json` is correct (see section 5 for bumping)
- [ ] CHANGELOG.md is updated (optional but good practice)
- [ ] Everything is committed to git

### Dry run — see what would be published

```bash
npm pack --dry-run
```

This lists every file that will be included in the tarball. Verify it matches
what you expect (should be `dist/` files + `README.md` + `package.json`).

You can also create the actual tarball to inspect:

```bash
npm pack
```

This creates a `.tgz` file you can open to double-check contents.

---

## 4. First publish

```bash
npm publish
```

That's it. The `prepublishOnly` script in package.json automatically runs
`npm run build` before publishing, so dist/ will be fresh.

If using a scoped package name (`@koljam/...`):

```bash
npm publish --access public
```

After publishing, your package will be live at:
`https://www.npmjs.com/package/leaflet-heatmap-layer`

---

## 5. Publishing updates (new versions)

npm uses semantic versioning (semver): `MAJOR.MINOR.PATCH`

- **Patch** (1.0.0 → 1.0.1): bug fixes, no API changes
- **Minor** (1.0.0 → 1.1.0): new features, backwards compatible
- **Major** (1.0.0 → 2.0.0): breaking changes

### Bump the version

```bash
# Pick ONE of these:
npm version patch   # 1.0.0 → 1.0.1
npm version minor   # 1.0.0 → 1.1.0
npm version major   # 1.0.0 → 2.0.0
```

`npm version` does three things automatically:
1. Updates `version` in `package.json` (and `package-lock.json`)
2. Creates a git commit with the message `v1.0.1` (or whatever version)
3. Creates a git tag `v1.0.1`

### Then publish

```bash
npm publish
git push && git push --tags
```

### Full release workflow (copy-paste)

```bash
npm test                    # make sure everything works
npm version patch           # or minor/major
npm publish                 # build runs automatically, then publishes
git push && git push --tags # push the version commit + tag to GitHub
```

---

## 6. Optional: GitHub release

After pushing the tag, you can create a GitHub Release for it:

```bash
gh release create v1.0.1 --title "v1.0.1" --notes "Bug fixes and improvements"
```

Or do it manually on GitHub → Releases → Draft a new release → pick the tag.

---

## 7. Useful commands reference

| Command | What it does |
|---|---|
| `npm whoami` | Check which npm account you're logged into |
| `npm pack --dry-run` | Preview what files get published |
| `npm info leaflet-heatmap-layer` | See your published package metadata |
| `npm deprecate leaflet-heatmap-layer@"<1.0.1" "Use >=1.0.1"` | Deprecate old versions |
| `npm unpublish leaflet-heatmap-layer@1.0.0` | Remove a specific version (within 72h) |
| `npm owner ls leaflet-heatmap-layer` | See who has publish access |

---

## 8. Troubleshooting

**"You must be logged in to publish"**
→ Run `npm login` again.

**"Package name too similar to existing"**
→ npm blocks names that are confusingly similar. Use a scoped name: `@koljam/leaflet-heatmap-layer`

**"Cannot publish over previously published version"**
→ You forgot to bump the version. Run `npm version patch` (or minor/major) first.

**"This package requires 2FA"**
→ Pass your OTP: `npm publish --otp=123456`

**Accidentally published something wrong?**
→ You have 72 hours to unpublish: `npm unpublish leaflet-heatmap-layer@1.0.0`
→ After 72h, you can only deprecate, not remove.
