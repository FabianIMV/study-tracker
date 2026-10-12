# Contributing

Thanks for helping out! Issues and pull requests are welcome.

## Development

No build step and no dependencies. You only need Node.js 18 or newer.

```bash
git clone https://github.com/FabianIMV/study-tracker.git
cd study-tracker
npm test
```

## Guidelines

- Keep the library dependency-free and loadable with a plain `<script>` tag (ES5, UMD).
- Add or update tests in `test/` for any behavior change.
- Never break existing saved data. If the stored format changes, bump `SCHEMA` in
  `study-tracker.js` and convert old data inside `migrate()`.
- Add a line under `## [Unreleased]` in `CHANGELOG.md`.

## Releasing (maintainers)

1. Update `version` in `package.json` **and** in `study-tracker.js` (a test checks they match).
2. Move the `Unreleased` notes in `CHANGELOG.md` under the new version.
3. Commit, then tag and push: `git tag v0.2.0 && git push origin v0.2.0`.
   The `Release` workflow publishes to npm with provenance via Trusted Publishing.
