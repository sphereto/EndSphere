export interface Scene {
  dispose(): void
}

/**
 * STUB — WebGL hero scene.
 * TODO: acquire a WebGL2 context on `canvas`, compile the shader program (dotted sphere + orbit ring),
 * run the render loop, and return { dispose }. Returning null makes <HeroScene> use the 2D fallback.
 * Note: a canvas can hold only one context type, so only call getContext('webgl2') here once this is real.
 */
export function createScene(_canvas: HTMLCanvasElement): Scene | null {
  return null
}
