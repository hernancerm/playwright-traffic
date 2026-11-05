# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-11-05

### Added

- `-v, --version` prints the version.
- `-t, --title=<title>` runs the test with that exact title instead of the one at a line.
- `init` makes the current folder a Playwright project: `package.json`, `@playwright/test`,
  `@types/node`, a `playwright.config.ts` and a `tsconfig.json`, skipping what is already there.
- With no `playwright.config.ts` above the file, the error suggests `playwright-traffic init`.
- An agent skill, installed with `npx skills add hernancerm/playwright-traffic`.

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

[Unreleased]: https://github.com/hernancerm/playwright-traffic/compare/0.2.0...HEAD
[0.2.0]: https://github.com/hernancerm/playwright-traffic/compare/0.1.0...0.2.0
[0.1.0]: https://github.com/hernancerm/playwright-traffic/releases/tag/0.1.0
