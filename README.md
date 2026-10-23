# EndSphere

A free storefront for Endstone plugins: browse and preview them, then download the latest release straight from GitHub.

Built with React, TypeScript (strict) and Vite. The WebGL scene in `src/webgl/scene.ts` is a stub (TODO) and is not rendered yet.

## Getting started

### Prerequisites

Node.js 20 or newer and npm.

### Installation

```bash
npm ci
```

## Usage

```bash
npm run dev      # start the dev server
npm run build    # type-check and build to dist/
npm run preview  # serve the production build
```

Plugin data lives in `src/data/plugins.ts` (currently placeholders). Pages use real paths: `/EndSphere/` (Home; About and FAQ are sections the menu scrolls to) and `/EndSphere/browse/`. The build emits a real `browse/index.html` and a `404.html` fallback, so deep links work on GitHub Pages. The base path defaults to `/EndSphere/`; set `BASE_PATH` to change it (`/` for a `<user>.github.io` repo).

## Development

```bash
npm run lint && npm run build
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to propose changes.

## License

Released under the MIT license. See [LICENSE](LICENSE).

## Releases

Versions follow [Semantic Versioning](https://semver.org/) and every change is recorded in [CHANGELOG.md](CHANGELOG.md). To release: move the `Unreleased` notes under a new version heading, bump `version` in `package.json`, commit, then `git tag vX.Y.Z && git push --tags`. The Release workflow publishes a GitHub Release using that changelog section, and the Deploy workflow publishes the site to GitHub Pages.
