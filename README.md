# EndSphere

A free storefront for Endstone plugins: browse and preview them, then download the latest release straight from GitHub.

Built with React, TypeScript (strict) and Vite. The hero uses a 2D-canvas dotted sphere; the WebGL scene in `src/webgl/scene.ts` is a stub (TODO).

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

Plugin data lives in `src/data/plugins.ts` (currently placeholders). Routing is hash-based (`#browse`), so the built site works on GitHub Pages without extra config; set `BASE_PATH=/<repo>/` when building for a project page.

## Development

```bash
npm run lint && npm run build
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to propose changes.
