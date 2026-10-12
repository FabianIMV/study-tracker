# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-10-12

### Added

- `StudyTracker.create({ appId })`: stores sessions and answers in `localStorage`
  under `study-tracker:<appId>`, with an in-memory fallback when storage is unavailable.
- Answers are saved the moment they are recorded; multiple tabs do not overwrite each other.
- Stats: `periodStats`, `mastery`, `progress`, `questionStats`, `getSessions`, `getAnswers`.
- `exportData` / `importData` (merge or replace) with a versioned data format (`schema: 1`).
- `StudyTrackerView.render`: ready-made progress screen with weekly/monthly charts,
  per-topic table, session history and export/import buttons.
- ESM entry point (`import StudyTracker from '@fabianimv/study-tracker'`) and
  CommonJS/UMD builds usable from a `<script>` tag or a CDN.

[Unreleased]: https://github.com/FabianIMV/study-tracker/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/FabianIMV/study-tracker/releases/tag/v0.1.0
