# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- WebGL2 dot field on Home: about 1,000 white dots (600 on phones) forming a wireframe cube. Each dot has its own drift, spring and scroll inertia; the pointer pushes dots away and they return, with mouse parallax.
- Scrolling scatters the dots into the endstone texture pattern (patches dense, cracks empty) and they reform into the cube when you scroll back up.
- Reduced-motion fallback (still frame) and graceful skip without WebGL2.

### Changed
- Browse now lives at a real path (`/EndSphere/browse/`) instead of a `#hash`; the build pre-renders it with its own page title.
- Smaller hero title and subtitle; the logo is plain "EndSphere".
- The hero is now just the title and subtitle, bottom-left.

### Fixed
- Tap targets under 44px (logo, footer, version and Download links).
- Hover colours sticking on touch screens; added visible keyboard focus.
- Layout shift when the menu locks scrolling; the menu now fades and no longer scrolls the page behind it.
- Extra scroll height from safe-area padding on iOS; safe areas now handled per element, including landscape.
- A–Z strip wrapping into five rows on phones; it scrolls sideways instead.

### Removed
- The earlier 2D dotted-sphere hero animation.

## [0.1.0] - 2026-10-23

### Added
- Single-page site (Home, About, FAQ) and a separate Browse page, built with React, strict TypeScript and Vite.
- Dotted-sphere hero (2D canvas) with a stubbed WebGL scene in `src/webgl/scene.ts`.
- Browse page with search, language filters and an A–Z index (placeholder plugin data).
- Burger menu, weak scroll snapping and a footer that slides over the pinned closing screen.
- Repo standards: README, MIT license, CI, Dependabot, issue and PR templates, CONTRIBUTING, SECURITY, CODEOWNERS.

[Unreleased]: https://github.com/sphereto/endsphere/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/sphereto/endsphere/releases/tag/v0.1.0
