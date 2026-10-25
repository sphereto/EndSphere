import { boot, setBoot } from '../boot'
import { ENDSTONE_MASK } from './endstoneMask'
import { createNebula } from './nebula'

export interface Scene {
  dispose(): void
}

type V3 = readonly [number, number, number]
interface Seg { a: V3; b: V3; t0: number }
type Edge = readonly [V3, V3]
const ZERO: V3 = [0, 0, 0]

/** Shape ids. Sections: Home cube, Plugins bipyramid, About astroid, FAQ clouds (no shape), closing E. */
const CUBE = 0, BIPYRAMID = 1, ASTROID = 2, LETTER_E = 3
const SECTION_SHAPES: ReadonlyArray<number | null> = [CUBE, BIPYRAMID, ASTROID, null, LETTER_E]
const SECTION_IDS = ['plugins', 'about', 'faq'] as const

interface Dot {
  seg: Array<Seg | null> // edge assignment per shape id (null for the astroid)
  au: number; av: number // astroid surface parameters
  sp: number // travel speed along edges (signed: traffic runs both ways)
  s: number; yy: number // spiral parameters for the intro
  u: number; v: number; sz: number // scatter target (endstone pattern)
  x: number; y: number; z: number
  vx: number; vy: number; vz: number
  k: number; c: number // spring, damping
  rim: number // 0 = core of the shape, 1 = outer fuzz (violet)
  w: number; ph: number; ph2: number
  delay: number; inertia: number; sv: number
  core: boolean // true = thick glowing line dot, false = fine complementary dot around it
  o0: number; o1: number; o2: number // offset from the line (unit space) for complementary dots
  sx: number; sy: number // last screen position
}
interface Star { x: number; y: number; z: number }

const DOT_VS = `#version 300 es
in vec4 a; in float b; in float c; uniform vec2 u_res; out float v_a; out float v_d; out float v_r;
void main(){ vec2 p = a.xy / u_res * 2.0 - 1.0; gl_Position = vec4(p.x, -p.y, 0.0, 1.0); gl_PointSize = a.z; v_a = a.w; v_d = b; v_r = c; }`
// Glowing sprite: bright core, soft halo, violet rim on outer particles, fine grain. Additive, so dense areas become fuzzy clouds.
const DOT_FS = `#version 300 es
precision mediump float; in float v_a; in float v_d; in float v_r; out vec4 o; uniform float u_co, u_gl, u_k;
void main(){
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float core = smoothstep(u_co, u_co * 0.35, r);
  float glow = exp(-r * r * u_k) * u_gl;
  float g = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  float i = clamp((core + glow) * v_a * (0.9 + 0.2 * g), 0.0, 1.0) * step(r, 1.0);
  vec3 col = mix(vec3(0.86, 0.86, 0.94), vec3(0.62, 0.40, 1.0), v_r * 0.9);
  col = mix(col * vec3(0.8, 0.72, 1.0), col, v_d);
  col = mix(col, vec3(1.0), core * 0.45 * (1.0 - v_r));
  o = vec4(col * i, i);
}`

const CLOUD_VS = `#version 300 es
void main(){ vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`
const CLOUD_FS = `#version 300 es
precision highp float; out vec4 o; uniform vec2 u_res; uniform float u_t, u_in, u_out;
float h(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + 1.0), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for(int i = 0; i < 5; i++){ s += a * n(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }
void main(){
  vec2 uv = gl_FragCoord.xy / u_res; float asp = u_res.x / u_res.y;
  vec2 p = vec2(uv.x * asp, uv.y) * 2.2; float t = u_t * 0.04;
  float n1 = fbm(p + vec2(t, 0.0)); float n2 = fbm(p * 2.1 - vec2(0.0, t * 1.3) + n1);
  float shape = n1 * 0.65 + n2 * 0.35, shapeLo = n2 * 0.65 + n1 * 0.35;
  float eHi = mix(-0.45, 1.75, u_in);  // top edge rises from below the screen (enter)
  float eLo = mix(-1.0, 2.3, u_out);   // bottom edge then rises past the top (exit)
  float d = min(eHi + (shape - 0.5) * 0.9 - uv.y, uv.y - (eLo + (shapeLo - 0.5) * 0.9));
  float a = smoothstep(0.0, 0.16, d);
  float lift = smoothstep(0.2, 0.95, u_in) * (1.0 - smoothstep(0.05, 0.7, u_out));
  vec3 col = mix(vec3(0.78, 0.78, 0.83), vec3(0.93, 0.93, 0.94), smoothstep(0.2, 0.8, shape));
  col = mix(col, vec3(0.86), smoothstep(0.1, 0.5, d));
  col = mix(vec3(0.40, 0.36, 0.52), col, lift); // a thin cloud is a dim violet-grey and only brightens as it covers
  col += (h(gl_FragCoord.xy * 0.37) - 0.5) * 0.02;
  o = vec4(col * a, a);
}`

const F = 1400 // focal length (px)
const STRIDE = 6 // floats per sprite: x, y, size, alpha, depth, rim
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const rand = (a: number, b: number) => a + Math.random() * (b - a)
const smooth = (t: number) => t * t * (3 - 2 * t)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const tri = (x: number) => Math.abs((((x % 2) + 2) % 2) - 1) // ping-pong 0..1..0

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const s = gl.createShader(type)
  if (!s) return null
  gl.shaderSource(s, src)
  gl.compileShader(s)
  return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null
}
function program(gl: WebGL2RenderingContext, vsSrc: string, fsSrc: string): WebGLProgram | null {
  const vs = compile(gl, gl.VERTEX_SHADER, vsSrc), fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc), p = gl.createProgram()
  if (!vs || !fs || !p) return null
  gl.attachShader(p, vs)
  gl.attachShader(p, fs)
  gl.linkProgram(p)
  return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null
}

/* ---------- shapes (unit space, max extent 1) ---------- */

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const x = a[i], y = a[j]
    if (x !== undefined && y !== undefined) { a[i] = y; a[j] = x }
  }
  return a
}

/** Assign n dots to edges in proportion to edge length. */
function assign(edges: Edge[], n: number): Seg[] {
  const lens = edges.map(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]))
  const total = lens.reduce((s, l) => s + l, 0)
  const out: Seg[] = []
  edges.forEach(([a, b], i) => {
    const cnt = Math.max(1, Math.round((n * (lens[i] ?? 0)) / total))
    for (let k = 0; k < cnt; k++) out.push({ a, b, t0: (k + 0.5 + (Math.random() - 0.5) * 0.5) / cnt })
  })
  shuffle(out)
  while (out.length < n) out.push(out[Math.floor(Math.random() * out.length)] ?? { a: ZERO, b: ZERO, t0: 0 })
  return out.slice(0, n)
}

function cubeEdges(): Edge[] {
  const V: V3[] = []
  for (let i = 0; i < 8; i++) V.push([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1])
  const edges: Edge[] = []
  for (let a = 0; a < 8; a++)
    for (let b = a + 1; b < 8; b++) {
      const va = V[a], vb = V[b]
      if (!va || !vb) continue
      if ((va[0] !== vb[0] ? 1 : 0) + (va[1] !== vb[1] ? 1 : 0) + (va[2] !== vb[2] ? 1 : 0) === 1) edges.push([va, vb])
    }
  return edges
}

/** Elongated square bipyramid (elongated octahedron): two slim square pyramids base to base. */
function bipyramidEdges(): Edge[] {
  const r = 0.4
  const top: V3 = [0, 1, 0], bottom: V3 = [0, -1, 0]
  const c: V3[] = [[r, 0, r], [r, 0, -r], [-r, 0, -r], [-r, 0, r]]
  const edges: Edge[] = []
  for (let i = 0; i < 4; i++) {
    const a = c[i], b = c[(i + 1) % 4]
    if (a && b) edges.push([a, b], [top, a], [bottom, a])
  }
  return edges
}

/** Extruded block letter E: front and back outline plus the connecting edges. */
function letterEEdges(): Edge[] {
  const a = 0.24, s = 0.28, h = 1.4, m0 = (h - a) / 2, m1 = (h + a) / 2
  const pts: Array<readonly [number, number]> = [[0, 0], [1, 0], [1, a], [s, a], [s, m0], [0.85, m0], [0.85, m1], [s, m1], [s, h - a], [1, h - a], [1, h], [0, h]]
  const k = 2 / h, d = 0.16 * k
  const P = (i: number, z: number): V3 => {
    const p = pts[i % pts.length] ?? [0, 0]
    return [(p[0] - 0.5) * k, (p[1] - h / 2) * k, z]
  }
  const edges: Edge[] = []
  for (let i = 0; i < pts.length; i++) edges.push([P(i, d), P(i + 1, d)], [P(i, -d), P(i + 1, -d)], [P(i, d), P(i, -d)])
  return edges
}

function buildDots(nCore: number, nSat: number): Dot[] {
  const n = nCore + nSat
  const cells: Array<[number, number]> = []
  const on = (i: number, j: number) => ENDSTONE_MASK[j]?.charAt(i) === '1'
  ENDSTONE_MASK.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) if (on(i, j) && on(i - 1, j) && on(i + 1, j) && on(i, j - 1) && on(i, j + 1)) cells.push([i, j])
  })
  if (cells.length < 80) ENDSTONE_MASK.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (on(i, j)) cells.push([i, j]) })
  const cube = assign(cubeEdges(), n), bip = assign(bipyramidEdges(), n), letter = assign(letterEEdges(), n)
  const dots: Dot[] = []
  for (let i = 0; i < n; i++) {
    const cell = cells[Math.floor(Math.random() * cells.length)] ?? [16, 16]
    const core = i < nCore
    const rim = core ? Math.random() ** 2 * 0.5 : 0.5 + Math.random() * 0.5
    const az = rand(0, 6.283), pol = Math.acos(rand(-1, 1)), rad = core ? 0 : rand(0.045, 0.13)
    dots.push({
      seg: [cube[i] ?? null, bip[i] ?? null, null, letter[i] ?? null],
      au: rand(0, Math.PI * 2), av: rand(-Math.PI / 2, Math.PI / 2),
      sp: (Math.random() < 0.5 ? -1 : 1) * rand(0.03, 0.1),
      s: i / n, yy: Math.random(),
      u: (cell[0] + Math.random()) / 32, v: (cell[1] + Math.random()) / 32, sz: rand(-220, 220),
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
      k: rand(10, 26), c: rand(3.5, 6.5), rim, w: rand(0.4, 1.4), ph: rand(0, 6.283), ph2: rand(0, 6.283),
      delay: Math.random(), inertia: rand(0.2, 1), sv: core ? rand(0.9, 1.15) : rand(0.8, 1.3),
      core, o0: Math.sin(pol) * Math.cos(az) * rad, o1: Math.sin(pol) * Math.sin(az) * rad, o2: Math.cos(pol) * rad, sx: 0, sy: 0,
    })
  }
  return dots // core dots first, complementary dots after
}

/* ---------- orientation and shape position ---------- */

interface Rot { ca: number; sa: number; cb: number; sb: number }

/** Cube and bipyramid spin slowly; astroid and E never spin, they only tilt toward the pointer. */
function rotFor(shape: number | null, t: number, mx: number, my: number): Rot {
  let ay = 0, ax = 0
  if (shape === CUBE) { ay = t * 0.22 + mx * 0.7; ax = 0.5 + my * 0.4 }
  else if (shape === BIPYRAMID) { ay = t * 0.22 + mx * 0.7; ax = 0.3 + my * 0.4 }
  else if (shape === ASTROID) { ay = -mx * 1.1; ax = 0.3 + my * 0.9 }
  else if (shape === LETTER_E) { ay = -mx * 1.1; ax = my * 0.9 }
  return { ca: Math.cos(ay), sa: Math.sin(ay), cb: Math.cos(ax), sb: Math.sin(ax) }
}

const tmp: [number, number, number] = [0, 0, 0]
let pulseT = 0
function rotate(x: number, y: number, z: number, r: Rot): void {
  const x1 = x * r.ca + z * r.sa, z1 = -x * r.sa + z * r.ca
  tmp[0] = x1
  tmp[1] = y * r.cb - z1 * r.sb
  tmp[2] = y * r.sb + z1 * r.cb
}

/** Where a dot sits on a shape right now. Dots travel along edges (ping-pong) and churn around the astroid. */
function shapePos(d: Dot, shape: number, time: number, r: Rot): void {
  if (shape === ASTROID) {
    const u = d.au + time * d.sp * 1.5, cv = Math.cos(d.av) ** 3
    pulseT = (d.au / 6.283 + time * 0.05) % 1
    rotate(Math.cos(u) ** 3 * cv, Math.sin(d.av) ** 3, Math.sin(u) ** 3 * cv, r)
    return
  }
  const g = d.seg[shape]
  if (!g) { rotate(0, 0, 0, r); return }
  const t = tri(g.t0 + time * d.sp)
  pulseT = t
  rotate(g.a[0] + (g.b[0] - g.a[0]) * t, g.a[1] + (g.b[1] - g.a[1]) * t, g.a[2] + (g.b[2] - g.a[2]) * t, r)
}

/** Section progress: i + 0..1 from section i's top to the next. 0 hero, 1 plugins, 2 about, 3 FAQ, 4 closing. */
function sectionPos(els: ReadonlyArray<HTMLElement | null>): number {
  const [plugins, about, faq] = els
  if (!plugins || !about || !faq) return 0
  const y = Math.max(0, scrollY)
  const tops = [0, plugins.getBoundingClientRect().top + scrollY, about.getBoundingClientRect().top + scrollY, faq.getBoundingClientRect().top + scrollY, faq.getBoundingClientRect().bottom + scrollY]
  for (let i = 0; i < 4; i++) {
    const a = tops[i] ?? 0, b = tops[i + 1] ?? a + 1
    if (y < b) return i + clamp((y - a) / Math.max(1, b - a), 0, 1)
  }
  return 4
}

const INK_ON: V3 = [242, 241, 238], INK_OFF: V3 = [17, 17, 22]
const MUT_ON: V3 = [201, 200, 196], MUT_OFF: V3 = [70, 70, 78]
const LN_ON: V3 = [35, 35, 38], LN_OFF: V3 = [190, 190, 196]
const PAGE_DARK: V3 = [8, 6, 18], PAGE_LIGHT: V3 = [219, 219, 224]
const mix = (a: V3, b: V3, t: number) => `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`
const CSS_VARS = ['--cov', '--top', '--page', '--ink', '--ink-mut', '--ink-ln', '--hdr', '--cl-ink', '--cl-dim', '--cl-inv', '--halo', '--fin', '--fout']
const BRIGHT = [1, 0.85, 0.85, 1] // cube and E at full strength
const HUES = [0, 0.15, 0.55, 0.3, 0.1] // nebula tint per section
const QUIET = '.hero h1, .sub, .hd2 h2, .hd2 p, .row, .ab > div, .cta, .close h2, .close .btn'

/** WebGL2 scene: nebula + star dust flying toward you, a particle swarm that builds a shape per section, procedural clouds over the FAQ. */
export function createScene(canvas: HTMLCanvasElement, nebulaCanvas: HTMLCanvasElement): Scene | null {
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, premultipliedAlpha: true })
  if (!gl) return null
  const dotProg = program(gl, DOT_VS, DOT_FS), cloudProg = program(gl, CLOUD_VS, CLOUD_FS)
  const dotBuf = gl.createBuffer(), starBuf = gl.createBuffer(), dotVao = gl.createVertexArray(), starVao = gl.createVertexArray(), cloudVao = gl.createVertexArray()
  if (!dotProg || !cloudProg || !dotBuf || !starBuf || !dotVao || !starVao || !cloudVao) return null

  const small = innerWidth < 720
  const nebula = createNebula(nebulaCanvas, small ? 0.4 : 0.5)
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const fresh = boot.phase === 'loading' // first load: hold a spiral behind the curtain, then build the cube
  const nCore = small ? 800 : 1800, nSat = small ? 900 : 2200
  const dots = buildDots(nCore, nSat)
  const stars: Star[] = Array.from({ length: small ? 700 : 1400 }, () => ({ x: rand(-1.2, 1.2), y: rand(-1.2, 1.2), z: rand(0.08, 1) }))
  const dotOut = new Float32Array(dots.length * STRIDE)
  const starOut = new Float32Array(stars.length * 3 * STRIDE)
  const els = SECTION_IDS.map((id) => document.getElementById(id))
  const root = document.documentElement
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  const quiet = Array.from(document.querySelectorAll<HTMLElement>(QUIET))

  const uDotRes = gl.getUniformLocation(dotProg, 'u_res')
  const uCo = gl.getUniformLocation(dotProg, 'u_co'), uGl = gl.getUniformLocation(dotProg, 'u_gl'), uK = gl.getUniformLocation(dotProg, 'u_k')
  const uCloudRes = gl.getUniformLocation(cloudProg, 'u_res'), uCloudT = gl.getUniformLocation(cloudProg, 'u_t')
  const uCloudIn = gl.getUniformLocation(cloudProg, 'u_in'), uCloudOut = gl.getUniformLocation(cloudProg, 'u_out')
  const layout = (vao: WebGLVertexArrayObject, buf: WebGLBuffer, bytes: number) => {
    gl.bindVertexArray(vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, bytes, gl.DYNAMIC_DRAW)
    ;(['a', 'b', 'c'] as const).forEach((name, i) => {
      const loc = gl.getAttribLocation(dotProg, name)
      gl.enableVertexAttribArray(loc)
      gl.vertexAttribPointer(loc, i === 0 ? 4 : 1, gl.FLOAT, false, STRIDE * 4, i === 0 ? 0 : 12 + i * 4)
    })
  }
  layout(dotVao, dotBuf, dotOut.byteLength)
  layout(starVao, starBuf, starOut.byteLength)
  gl.bindVertexArray(null)
  gl.enable(gl.BLEND)

  let aCore = nCore, aSat = nSat, accDt = 0, frames = 0, w = 0, h = 0, D = 1, raf = 0, last = 0, lastScroll = scrollY, lastKey = ''
  let mx = 0, my = 0, tmx = 0, tmy = 0, px = -9999, py = -9999, touching = false
  let uIn = 0, uOut = 0, flight = 0, boost = 0, tNow = 0
  let shock: { x: number; y: number; t: number } | null = null
  const live = () => boot.phase === 'live'

  const resize = () => {
    const nd = Math.min(devicePixelRatio || 1, innerWidth < 720 ? 1.75 : 2)
    const nw = canvas.clientWidth, nh = canvas.clientHeight
    nebula?.resize()
    if (nw === w && nh === h && nd === D) return
    D = nd; w = nw; h = nh
    canvas.width = Math.round(w * D)
    canvas.height = Math.round(h * D)
    gl.viewport(0, 0, canvas.width, canvas.height)
  }

  // uIn: cloud rising in (0..1). uOut: cloud leaving through the top (0..1).
  const publish = (inn: number, out: number) => {
    const key = inn.toFixed(3) + out.toFixed(3)
    if (key === lastKey) return
    lastKey = key
    const cov = inn * (1 - out)
    const faqK = smooth(clamp((inn - 0.45) / 0.2, 0, 1)) * (1 - smooth(clamp((out - 0.75) / 0.15, 0, 1)))
    const topK = smooth(clamp((inn - 0.82) / 0.14, 0, 1)) * (1 - smooth(clamp((out - 0.82) / 0.14, 0, 1)))
    const clK = smooth(clamp((inn - 0.9) / 0.1, 0, 1)) * (1 - smooth(clamp((out - 0.35) / 0.2, 0, 1)))
    const set = (k: string, v: string) => root.style.setProperty(k, v)
    set('--cov', cov.toFixed(3)); set('--top', topK.toFixed(3))
    set('--page', mix(PAGE_DARK, PAGE_LIGHT, cov)) // keeps the scrollbar gutter in step with the cloud
    set('--ink', mix(INK_ON, INK_OFF, faqK)); set('--ink-mut', mix(MUT_ON, MUT_OFF, faqK)); set('--ink-ln', mix(LN_ON, LN_OFF, faqK))
    set('--hdr', mix(INK_ON, INK_OFF, topK)) // header sits at the top: covered last, uncovered last
    set('--cl-ink', mix(INK_ON, INK_OFF, clK)); set('--cl-dim', mix([74, 74, 80], [140, 140, 150], clK)); set('--cl-inv', mix([10, 10, 11], [242, 241, 238], clK))
    set('--halo', `rgba(10,10,11,${(0.85 * clamp(1 - cov * 2.2, 0, 1)).toFixed(2)})`)
    set('--fin', inn.toFixed(3)); set('--fout', out.toFixed(3)) // FAQ text slides in/out with the cloud
    meta?.setAttribute('content', mix(PAGE_DARK, PAGE_LIGHT, topK))
  }

  const step = (dt: number, t: number, snap: boolean) => {
    tNow = t
    const f = sectionPos(els)
    const i = Math.min(4, Math.floor(f)), frac = i >= 4 ? 0 : f - i
    const shapeA = SECTION_SHAPES[i] ?? null
    const shapeB = i >= 4 ? null : (SECTION_SHAPES[i + 1] ?? null)
    const hasNext = i < 4

    // cloud progress follows the scroll position with a speed limit, so a hard flick still takes about two seconds
    const tIn = smooth(clamp((f - 2.3) / 0.7, 0, 1)), tOut = smooth(clamp((f - 3.55) / 0.45, 0, 1))
    if (snap) { uIn = tIn; uOut = tOut }
    else {
      const inT = uOut > 0.02 ? 1 : tIn
      uIn += clamp((inT - uIn) * (1 - Math.exp(-dt * 1.6)), -dt * 0.5, dt * 0.5)
      const outT = uIn > 0.98 ? tOut : 0
      uOut += clamp((outT - uOut) * (1 - Math.exp(-dt * 1.6)), -dt * 0.5, dt * 0.5)
    }
    publish(uIn, uOut)

    const wide = w >= 720
    const half = Math.min(w, h) * (wide ? 0.24 : 0.28)
    const toSection = clamp(f, 0, 1)
    const ccx = wide ? w * 0.2 : 0
    const ccy = (wide ? -h * 0.02 : -h * 0.14) * (1 - toSection)
    const dim = wide ? 1 : 1 - 0.2 * toSection
    const floor = wide ? 0.32 : 0.45 // dot brightness left behind text
    const dScroll = scrollY - lastScroll
    lastScroll = scrollY
    const vel = dt > 0 ? Math.abs(dScroll) / dt : 0
    boost += (clamp(vel / 1800, 0, 1) - boost) * (1 - Math.exp(-dt * 3))
    flight += dt * (0.035 + boost * 0.3)
    const rotA = rotFor(shapeA, t, mx, my), rotB = rotFor(shapeB, t, mx, my), rotC = rotFor(CUBE, t, mx, my)
    const intro = reduced || !fresh ? 1 : boot.phase === 'loading' ? 0 : clamp((performance.now() - boot.openedAt) / 2500, 0, 1)
    const R = touching ? 90 : 120
    const age = shock ? t - shock.t : 9
    const zones: Array<[number, number, number, number]> = []
    for (const el of quiet) {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.bottom > -40 && r.top < h + 40) zones.push([r.left, r.top, r.right, r.bottom])
    }
    const vpx = mx * w * 0.16, vpy = my * h * 0.16

    /* nebula + star dust */
    if (!(uIn >= 0.999 && uOut <= 0.001)) {
      nebula?.draw({ fl: flight, vpx: (mx * w * 0.3) / h, vpy: -my * 0.3, mx: px > -9000 ? px / w : 0.5 + mx, my: px > -9000 ? py / h : 0.5 + my, swirl: (px > -9000 ? 0.7 : 0) + (age < 1.3 ? (1 - age / 1.3) * 1.4 : 0), hue: lerp(HUES[i] ?? 0, HUES[Math.min(4, i + 1)] ?? 0, frac) })
    }
    let so = 0
    const S = Math.min(w, h) * 0.38
    for (const s of stars) {
      s.z -= dt * (0.04 + boost * 0.5)
      let sx = w / 2 + vpx + (s.x * S) / s.z, sy = h / 2 + vpy + (s.y * S) / s.z
      if (s.z < 0.04 || sx < -w * 0.1 || sx > w * 1.1 || sy < -h * 0.1 || sy > h * 1.1) {
        s.x = rand(-1.2, 1.2); s.y = rand(-1.2, 1.2); s.z = rand(0.7, 1)
        sx = w / 2 + vpx + (s.x * S) / s.z; sy = h / 2 + vpy + (s.y * S) / s.z
      }
      if (px > -9000) { // stars bend around the cursor
        const dx = sx - px, dy = sy - py, rr = Math.hypot(dx, dy)
        if (rr < 280) { const an = 0.55 * Math.exp(-(rr * rr) / 16000), c = Math.cos(an), sn = Math.sin(an); sx = px + dx * c - dy * sn; sy = py + dx * sn + dy * c }
      }
      const near = 1 - s.z
      const alpha = Math.min(1, near ** 1.3 * 0.9 + 0.05) * (0.8 + 0.2 * Math.sin(t * 2 + s.x * 40))
      const size = (1.1 + near * 2.4) * 3.1 * D
      const trails = boost > 0.25 ? 3 : 1
      const ex = sx - (w / 2 + vpx), ey = sy - (h / 2 + vpy), el = Math.hypot(ex, ey) || 1
      for (let k = 0; k < trails; k++) {
        const back = k * boost * 26 * (0.3 + near)
        starOut[so++] = (sx - (ex / el) * back) * D; starOut[so++] = (sy - (ey / el) * back) * D
        starOut[so++] = size * (1 - k * 0.2); starOut[so++] = alpha * (1 - k * 0.38); starOut[so++] = near; starOut[so++] = 0
      }
    }
    const starCount = so / STRIDE

    /* particle swarm */
    let o = 0
    const flowA = (wS: number) => 0.3 + 0.8 * wS + 1.2 * 4 * wS * (1 - wS)
    const cr = Math.cos(t * 0.025), sr = Math.sin(t * 0.025)
    const total = aCore + aSat
    for (let di = 0; di < total; di++) {
      const d = dots[di < aCore ? di : nCore + (di - aCore)] // thick line dots first, then complementary dots
      if (!d) continue
      const outQ = hasNext ? smooth(clamp((frac - d.delay * 0.2) / 0.3, 0, 1)) : 0
      const inQ = hasNext ? smooth(clamp((frac - 0.5 - d.delay * 0.2) / 0.3, 0, 1)) : 0
      const wA = shapeA === null ? 0 : 1 - outQ, wB = shapeB === null ? 0 : inQ, wS = 1 - wA - wB
      let tx = 0, ty = 0, tz = 0, pulse = 0
      if (wA > 0 && shapeA !== null) {
        shapePos(d, shapeA, t, rotA)
        tx += (ccx + tmp[0] * half) * wA; ty += (ccy + tmp[1] * half) * wA; tz += tmp[2] * half * wA
        pulse += (0.78 + 0.22 * Math.sin(6.283 * (pulseT * 2 - t * 0.5))) * wA
      }
      if (wB > 0 && shapeB !== null) {
        shapePos(d, shapeB, t, rotB)
        tx += (ccx + tmp[0] * half) * wB; ty += (ccy + tmp[1] * half) * wB; tz += tmp[2] * half * wB
        pulse += (0.78 + 0.22 * Math.sin(6.283 * (pulseT * 2 - t * 0.5))) * wB
      }
      if (wS > 0) { // dispersed state: the endstone pattern drifting as slow swirling clouds
        const ux = (d.u - 0.5) * w, uy = (d.v - 0.5) * h
        tx += (ux * cr - uy * sr) * wS; ty += (ux * sr + uy * cr) * wS; tz += d.sz * wS
        pulse += wS * 0.9
      }
      const shaped = 1 - wS // complementary dots sit in a shell around the line
      tx += d.o0 * half * shaped; ty += d.o1 * half * shaped; tz += d.o2 * half * shaped
      // the swarm breathes: orbit radius grows with the outer fuzz; the core line stays crisper
      const amp = (d.core ? 1.5 + d.rim * 6 : 2 + d.rim * 10) * (0.45 + wS * 1.1)
      tx += Math.cos(t * d.w + d.ph) * amp; ty += Math.sin(t * d.w + d.ph2) * amp
      if (intro < 1) { // opening build: a spinning 3D spiral that tightens into the cube
        const q = smooth(clamp((intro - d.delay * 0.3) / 0.7, 0, 1))
        if (q < 1) {
          const rr = (0.3 + 1.9 * d.s) * (1 - 0.6 * intro), th = d.s * 10 + t * (1.1 + 2.4 * intro)
          rotate(Math.cos(th) * rr, (d.yy - 0.5) * 0.9 * (1 - d.s * 0.4), Math.sin(th) * rr, rotC)
          tx = tx * q + (ccx + tmp[0] * half) * (1 - q); ty = ty * q + (ccy + tmp[1] * half) * (1 - q); tz = tz * q + tmp[2] * half * (1 - q)
        }
      }
      if (snap) {
        d.x = tx; d.y = ty; d.z = tz
      } else {
        let fx = (tx - d.x) * d.k, fy = (ty - d.y) * d.k
        const rx = d.sx - px, ry = d.sy - py, r2 = rx * rx + ry * ry
        if (r2 < R * R) { // the cursor parts the swarm and curves it around
          const r = Math.sqrt(r2) || 1, g = 1 - r / R
          fx += (rx / r) * g * g * 9000 - (ry / r) * g * g * 3500
          fy += (ry / r) * g * g * 9000 + (rx / r) * g * g * 3500
        }
        const fl = flowA(wS) * 220 // shared curl flow: the whole swarm moves with the same currents
        const a1 = d.x * 0.006 + t * 0.31, b1 = d.y * 0.006 - t * 0.23, c1 = d.z * 0.006 + t * 0.19, a2 = d.x * 0.0045 + t * 0.27
        fx += -Math.sin(a1) * Math.sin(b1) * fl
        fy += -(Math.cos(a1) * Math.cos(b1) - 0.75 * Math.sin(c1) * Math.sin(a2)) * fl
        d.vx += fx * dt + dScroll * d.inertia * Math.sin(d.ph) * 2
        d.vy += fy * dt - dScroll * d.inertia * 6
        d.vz += (tz - d.z) * d.k * dt + 0.5 * Math.cos(c1) * Math.cos(a2) * fl * dt
        if (age < 1.3) { // click / tap shockwave
          const sdx = d.sx - (shock?.x ?? 0), sdy = d.sy - (shock?.y ?? 0), dist = Math.hypot(sdx, sdy) || 1
          const g = Math.exp(-(((dist - age * 820) / 55) ** 2)) * (1 - age / 1.3)
          d.vx += (sdx / dist) * g * 1600 * dt; d.vy += (sdy / dist) * g * 1600 * dt
        }
        const damp = Math.exp(-d.c * dt)
        d.vx *= damp; d.vy *= damp; d.vz *= damp
        d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt
      }
      const persp = F / (F + d.z)
      d.sx = w / 2 + (d.x - mx * 45) * persp
      d.sy = h / 2 + (d.y - my * 30) * persp
      const depth = clamp(1 - (d.z + 250) / 500, 0, 1)
      let quietF = 1
      for (const z of zones) {
        const ex = Math.max(z[0] - d.sx, 0, d.sx - z[2]), ey = Math.max(z[1] - d.sy, 0, d.sy - z[3])
        quietF = Math.min(quietF, 1 - (1 - clamp(Math.hypot(ex, ey) / 28, 0, 1)) * (1 - floor))
      }
      const bright = wA * (BRIGHT[shapeA ?? 0] ?? 1) + wB * (BRIGHT[shapeB ?? 0] ?? 1) + wS * 0.55
      dotOut[o++] = d.sx * D
      dotOut[o++] = d.sy * D
      dotOut[o++] = (d.core ? (4.6 / 0.3) * persp * d.sv : (1.8 / 0.34) * persp * d.sv) * D
      dotOut[o++] = (d.core ? 0.9 * (0.35 + 0.65 * depth) : 0.75 * (0.3 + 0.7 * depth)) * bright * dim * quietF * pulse * (0.9 + 0.1 * Math.sin(t * d.w * 2 + d.ph2)) * (intro < 1 ? 0.6 + 0.4 * intro : 1)
      dotOut[o++] = depth
      dotOut[o++] = d.rim
    }

    if (uIn >= 0.999 && uOut <= 0.001) {
      gl.clearColor(0.86, 0.86, 0.88, 1) // fully inside the cloud
      gl.clear(gl.COLOR_BUFFER_BIT)
      return
    }
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(dotProg)
    gl.uniform2f(uDotRes, canvas.width, canvas.height)
    gl.blendFunc(gl.ONE, gl.ONE) // glows add up, so dense areas turn into soft clouds
    gl.uniform1f(uCo, 0.34); gl.uniform1f(uGl, 0.6); gl.uniform1f(uK, 4.5) // fine style: stars and complementary dots
    gl.bindVertexArray(starVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, starBuf)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, starOut)
    gl.drawArrays(gl.POINTS, 0, starCount)
    gl.bindVertexArray(dotVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, dotBuf)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, dotOut)
    gl.drawArrays(gl.POINTS, aCore, aSat)
    gl.uniform1f(uCo, 0.3); gl.uniform1f(uGl, 0.9); gl.uniform1f(uK, 3.2) // chunky glow style: the thick line
    gl.drawArrays(gl.POINTS, 0, aCore)
    if (uIn > 0.002 && uOut < 0.998) {
      gl.useProgram(cloudProg) // the cloud is drawn over the swarm, so it swallows it
      gl.uniform2f(uCloudRes, canvas.width, canvas.height)
      gl.uniform1f(uCloudT, t)
      gl.uniform1f(uCloudIn, uIn)
      gl.uniform1f(uCloudOut, uOut)
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
      gl.bindVertexArray(cloudVao)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
  }

  const frame = (ms: number) => {
    const dt = Math.min((ms - last) / 1000 || 0.016, 1 / 15)
    last = ms
    mx += (tmx - mx) * (1 - Math.exp(-4 * dt))
    my += (tmy - my) * (1 - Math.exp(-4 * dt))
    step(dt, ms / 1000, false)
    if (++frames === 24 && !boot.sceneReady) setBoot({ sceneReady: true })
    if (frames > 60) { // after warm-up, shed particles if the device can't keep up
      accDt += dt
      if (frames % 90 === 0) {
        if (accDt / 90 > 1 / 38) { // slow device: shed the complementary dots first, then thin the line
          if (aSat > nSat * 0.2) aSat = Math.floor(aSat * 0.7)
          else if (aCore > nCore * 0.6) aCore = Math.floor(aCore * 0.85)
        }
        accDt = 0
      }
    }
    raf = requestAnimationFrame(frame)
  }
  const still = () => {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(() => { step(0, 0, true); if (!boot.sceneReady) setBoot({ sceneReady: true }) })
  }

  const onMove = (e: PointerEvent) => {
    if (!live()) return // nothing responds until the curtain is halfway open
    px = e.clientX; py = e.clientY
    tmx = e.clientX / innerWidth - 0.5; tmy = e.clientY / innerHeight - 0.5
    touching = e.pointerType === 'touch'
  }
  const onDown = (e: PointerEvent) => {
    onMove(e)
    if (live()) shock = { x: e.clientX, y: e.clientY, t: tNow }
  }
  const onLeave = () => { px = py = -9999; tmx = tmy = 0 }
  const onResize = () => { resize(); if (reduced) still() }
  const onVisible = () => { last = performance.now() }

  resize()
  for (const d of dots) { // start inside the spiral on first load, otherwise scattered
    if (fresh) {
      const rr = (0.3 + 1.9 * d.s) * 0.9, th = d.s * 10
      d.x = Math.cos(th) * rr * w * 0.2; d.z = Math.sin(th) * rr * w * 0.2; d.y = (d.yy - 0.5) * h * 0.2
    } else {
      d.x = (d.u - 0.5) * w; d.y = (d.v - 0.5) * h; d.z = d.sz
    }
  }
  addEventListener('resize', onResize)
  document.addEventListener('visibilitychange', onVisible)
  if (reduced) {
    addEventListener('scroll', still, { passive: true })
    still()
  } else {
    addEventListener('pointermove', onMove)
    addEventListener('pointerdown', onDown)
    addEventListener('pointerup', onLeave)
    addEventListener('pointercancel', onLeave)
    document.addEventListener('mouseleave', onLeave)
    raf = requestAnimationFrame(frame)
  }
  return {
    dispose() {
      cancelAnimationFrame(raf)
      removeEventListener('resize', onResize)
      removeEventListener('scroll', still)
      removeEventListener('pointermove', onMove)
      removeEventListener('pointerdown', onDown)
      removeEventListener('pointerup', onLeave)
      removeEventListener('pointercancel', onLeave)
      document.removeEventListener('mouseleave', onLeave)
      document.removeEventListener('visibilitychange', onVisible)
      meta?.setAttribute('content', '#0a0a0b')
      CSS_VARS.forEach((v) => root.style.removeProperty(v))
      nebula?.dispose()
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    },
  }
}
