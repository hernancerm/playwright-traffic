# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `-v, --version` prints the version.

### Changed

- The help has Usage and Options headings and lists `-h, --help`.
- Running without `<file.ts>:<line>` prints the help to stderr instead of stdout.

## [0.1.0] - 2026-10-29

### Added

- `playwright-traffic <file.ts>:<line>` runs the nearest test at or above the line, in the first
  Playwright project, and prints the requests it sends.
- `--format=json` (default) prints one JSON object.
- `--format=markdown+vim-folds` prints markdown with details in Vim fold markers: method, status,
  path, time and size in each heading, the query string one param per line, and a curl command
  that sends the same request.

[Unreleased]: https://github.com/hernancerm/playwright-traffic/compare/0.1.0...HEAD
[0.1.0]: https://github.com/hernancerm/playwright-traffic/releases/tag/0.1.0
