import { ENDSTONE_MASK } from './endstoneMask'

export interface Scene {
  dispose(): void
}

type V3 = readonly [number, number, number]
type Edge = readonly [V3, V3]
const ZERO: V3 = [0, 0, 0]

/** Shape ids. Sections: Home cube, Plugins bipyramid, About astroid, FAQ clouds (no shape), closing E. */
const CUBE = 0, BIPYRAMID = 1, ASTROID = 2, LETTER_E = 3
const SECTION_SHAPES: ReadonlyArray<number | null> = [CUBE, BIPYRAMID, ASTROID, null, LETTER_E]
const SECTION_IDS = ['plugins', 'about', 'faq'] as const

interface Dot {
  t: V3[] // unit-space target per shape id
  u: number; v: number; sz: number // scatter target (u,v over the viewport, depth in px)
  x: number; y: number; z: number
  vx: number; vy: number; vz: number
  k: number; c: number // spring stiffness, damping
  amp: number; w: number; ph: number; ph2: number // idle drift
  type: 0 | 1 | 2 | 3 // 0 orbit, 1 bob, 2 lissajous, 3 depth sway
  delay: number // 0..1, when this dot leaves/arrives during a transition
  inertia: number // how strongly scroll velocity throws this dot
  sv: number // size variation
  sx: number; sy: number // last screen position (for the pointer)
}

const DOT_VS = `#version 300 es
in vec4 a; in float b; uniform vec2 u_res; out float v_a; out float v_d;
void main(){ vec2 c = a.xy / u_res * 2.0 - 1.0; gl_Position = vec4(c.x, -c.y, 0.0, 1.0); gl_PointSize = a.z; v_a = a.w; v_d = b; }`
// Each dot is a glowing sprite: crisp bright core + soft halo. Far dots lean violet, near dots stay white.
const DOT_FS = `#version 300 es
precision mediump float; in float v_a; in float v_d; out vec4 o;
void main(){
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float core = smoothstep(0.34, 0.12, r);
  float glow = exp(-r * r * 4.5) * 0.6;
  float i = clamp((core + glow) * v_a, 0.0, 1.0) * step(r, 1.0);
  vec3 col = mix(mix(vec3(0.70, 0.60, 1.0), vec3(1.0), v_d), vec3(1.0), core);
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
  float shape = n1 * 0.65 + n2 * 0.35;
  float shapeLo = n2 * 0.65 + n1 * 0.35;
  float eHi = mix(-0.45, 1.75, u_in);  // top edge rises from below the screen (enter)
  float eLo = mix(-1.0, 2.3, u_out);   // bottom edge then rises past the top (exit)
  float d = min(eHi + (shape - 0.5) * 0.9 - uv.y, uv.y - (eLo + (shapeLo - 0.5) * 0.9));
  float a = smoothstep(0.0, 0.16, d);
  vec3 col = mix(vec3(0.78, 0.78, 0.83), vec3(0.93, 0.93, 0.94), smoothstep(0.2, 0.8, shape));
  col = mix(col, vec3(0.90), smoothstep(0.1, 0.5, d));
  col += (h(gl_FragCoord.xy * 0.37) - 0.5) * 0.02;
  o = vec4(col * a, a);
}`

const F = 1400 // focal length (px)
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const rand = (a: number, b: number) => a + Math.random() * (b - a)
const smooth = (t: number) => t * t * (3 - 2 * t)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const s = gl.createShader(type)
  if (!s) return null
  gl.shaderSource(s, src)
  gl.compileShader(s)
  return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null
}

function program(gl: WebGL2RenderingContext, vsSrc: string, fsSrc: string): WebGLProgram | null {
  const vs = compile(gl, gl.VERTEX_SHADER, vsSrc)
  const fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc)
  const p = gl.createProgram()
  if (!vs || !fs || !p) return null
  gl.attachShader(p, vs)
  gl.attachShader(p, fs)
  gl.linkProgram(p)
  return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null
}

/* ---------- shapes (unit space, max extent 1) ---------- */

function fit(points: V3[], n: number): V3[] {
  for (let i = points.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const a = points[i], b = points[j]
    if (a && b) { points[i] = b; points[j] = a }
  }
  while (points.length < n) points.push(points[Math.floor(Math.random() * points.length)] ?? ZERO)
  return points.slice(0, n)
}

/** Dots spread along edges, proportional to edge length. */
function edgeDots(edges: Edge[], n: number): V3[] {
  const lens = edges.map(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]))
  const total = lens.reduce((s, l) => s + l, 0)
  const out: V3[] = []
  edges.forEach(([a, b], i) => {
    const cnt = Math.max(1, Math.round((n * (lens[i] ?? 0)) / total))
    for (let k = 0; k < cnt; k++) {
      const t = (k + 0.5 + (Math.random() - 0.5) * 0.5) / cnt
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t])
    }
  })
  return fit(out, n)
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
    if (!a || !b) continue
    edges.push([a, b], [top, a], [bottom, a])
  }
  return edges
}

/** Extruded block letter E (outline front and back plus the connecting edges). */
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

/** Astroidal ellipsoid surface: x^(2/3) + y^(2/3) + z^(2/3) = 1. */
function astroidDots(n: number): V3[] {
  const out: V3[] = []
  for (let i = 0; i < n; i++) {
    const u = rand(0, Math.PI * 2), v = rand(-Math.PI / 2, Math.PI / 2)
    const cv = Math.cos(v) ** 3
    out.push([Math.cos(u) ** 3 * cv, Math.sin(v) ** 3, Math.sin(u) ** 3 * cv])
  }
  return out
}

function buildDots(n: number): Dot[] {
  const cells: Array<[number, number]> = []
  const on = (i: number, j: number) => ENDSTONE_MASK[j]?.charAt(i) === '1'
  ENDSTONE_MASK.forEach((row, j) => {
    // erode the patches by one cell so the cracks between them read as empty
    for (let i = 0; i < row.length; i++) if (on(i, j) && on(i - 1, j) && on(i + 1, j) && on(i, j - 1) && on(i, j + 1)) cells.push([i, j])
  })
  if (cells.length < 80) ENDSTONE_MASK.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (on(i, j)) cells.push([i, j]) })
  const shapes = [edgeDots(cubeEdges(), n), edgeDots(bipyramidEdges(), n), astroidDots(n), edgeDots(letterEEdges(), n)]
  const dots: Dot[] = []
  for (let i = 0; i < n; i++) {
    const cell = cells[Math.floor(Math.random() * cells.length)] ?? [16, 16]
    dots.push({
      t: shapes.map((s) => s[i] ?? ZERO),
      u: (cell[0] + Math.random()) / 32, v: (cell[1] + Math.random()) / 32, sz: rand(-220, 220),
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
      k: rand(16, 40), c: rand(4, 8), amp: rand(1.5, 7), w: rand(0.4, 1.4),
      ph: rand(0, 6.283), ph2: rand(0, 6.283), type: (i % 4) as 0 | 1 | 2 | 3,
      delay: Math.random(), inertia: rand(0.2, 1), sv: rand(0.8, 1.25), sx: 0, sy: 0,
    })
  }
  return dots
}

/* ---------- orientation ---------- */

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
function rotate(p: V3, r: Rot): void {
  const x1 = p[0] * r.ca + p[2] * r.sa, z1 = -p[0] * r.sa + p[2] * r.ca
  tmp[0] = x1
  tmp[1] = p[1] * r.cb - z1 * r.sb
  tmp[2] = p[1] * r.sb + z1 * r.cb
}

/** Section progress: i + 0..1 while scrolling from section i's top to the next one's. 0 hero, 1 plugins, 2 about, 3 FAQ, 4 closing. */
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
const mix = (a: V3, b: V3, t: number) => `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`
const CSS_VARS = ['--cov', '--top', '--page', '--ink', '--ink-mut', '--ink-ln', '--hdr', '--cl-ink', '--cl-dim', '--cl-inv', '--halo']
const BRIGHT = [1, 0.8, 0.8, 1] // cube and E at full strength, mid-section shapes quieter
const QUIET = '.hero h1, .sub, .hd2 h2, .hd2 p, .row, .ab > div, .cta, .close h2, .close .btn'
const PAGE_DARK: V3 = [10, 10, 11], PAGE_LIGHT: V3 = [230, 230, 232]

/** WebGL2 dot field: shapes per section, scatter between them, procedural clouds over the FAQ. */
export function createScene(canvas: HTMLCanvasElement): Scene | null {
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, premultipliedAlpha: true })
  if (!gl) return null
  const dotProg = program(gl, DOT_VS, DOT_FS)
  const cloudProg = program(gl, CLOUD_VS, CLOUD_FS)
  const buf = gl.createBuffer()
  const dotVao = gl.createVertexArray()
  const cloudVao = gl.createVertexArray()
  if (!dotProg || !cloudProg || !buf || !dotVao || !cloudVao) return null

  const dotRes = gl.getUniformLocation(dotProg, 'u_res')
  const cloudRes = gl.getUniformLocation(cloudProg, 'u_res')
  const cloudT = gl.getUniformLocation(cloudProg, 'u_t')
  const cloudIn = gl.getUniformLocation(cloudProg, 'u_in')
  const cloudOut = gl.getUniformLocation(cloudProg, 'u_out')
  const loc = gl.getAttribLocation(dotProg, 'a')
  const locB = gl.getAttribLocation(dotProg, 'b')
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const dots = buildDots(innerWidth < 720 ? 600 : 1000)
  const out = new Float32Array(dots.length * 5)
  const els = SECTION_IDS.map((id) => document.getElementById(id))
  const root = document.documentElement
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  const quiet = Array.from(document.querySelectorAll<HTMLElement>(QUIET))
  const minActive = Math.floor(dots.length * 0.4)

  gl.bindVertexArray(dotVao)
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, out.byteLength, gl.DYNAMIC_DRAW)
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 20, 0)
  gl.enableVertexAttribArray(locB)
  gl.vertexAttribPointer(locB, 1, gl.FLOAT, false, 20, 16)
  gl.bindVertexArray(null)
  gl.enable(gl.BLEND)

  let active = dots.length, accDt = 0, frames = 0
  let w = 0, h = 1, D = 1, raf = 0, last = 0, lastScroll = scrollY, lastKey = ''
  let mx = 0, my = 0, tmx = 0, tmy = 0, px = -9999, py = -9999, touching = false

  const resize = () => {
    const nd = Math.min(devicePixelRatio || 1, innerWidth < 720 ? 1.75 : 2)
    const nw = canvas.clientWidth, nh = canvas.clientHeight
    if (nw === w && nh === h && nd === D) return
    D = nd; w = nw; h = nh
    canvas.width = Math.round(w * D)
    canvas.height = Math.round(h * D)
    gl.viewport(0, 0, canvas.width, canvas.height)
  }

  // uIn: cloud rising in (0..1). uOut: cloud leaving through the top (0..1).
  const publish = (uIn: number, uOut: number) => {
    const key = uIn.toFixed(3) + uOut.toFixed(3)
    if (key === lastKey) return
    lastKey = key
    const cov = uIn * (1 - uOut)
    const faqK = smooth(clamp((uIn - 0.45) / 0.2, 0, 1)) * (1 - smooth(clamp((uOut - 0.75) / 0.15, 0, 1)))
    const topK = smooth(clamp((uIn - 0.82) / 0.14, 0, 1)) * (1 - smooth(clamp((uOut - 0.82) / 0.14, 0, 1)))
    const clK = smooth(clamp((uIn - 0.9) / 0.1, 0, 1)) * (1 - smooth(clamp((uOut - 0.35) / 0.2, 0, 1)))
    const page = mix(PAGE_DARK, PAGE_LIGHT, cov)
    root.style.setProperty('--cov', cov.toFixed(3))
    root.style.setProperty('--top', topK.toFixed(3))
    root.style.setProperty('--page', page) // keeps the scrollbar gutter in step with the cloud
    root.style.setProperty('--ink', mix(INK_ON, INK_OFF, faqK))
    root.style.setProperty('--ink-mut', mix(MUT_ON, MUT_OFF, faqK))
    root.style.setProperty('--ink-ln', mix(LN_ON, LN_OFF, faqK))
    root.style.setProperty('--hdr', mix(INK_ON, INK_OFF, topK)) // header sits at the top, which the cloud covers last and leaves last
    root.style.setProperty('--cl-ink', mix(INK_ON, INK_OFF, clK))
    root.style.setProperty('--cl-dim', mix([74, 74, 80], [140, 140, 150], clK))
    root.style.setProperty('--cl-inv', mix([10, 10, 11], [242, 241, 238], clK))
    root.style.setProperty('--halo', `rgba(10,10,11,${(0.85 * clamp(1 - cov * 2.2, 0, 1)).toFixed(2)})`)
    meta?.setAttribute('content', mix(PAGE_DARK, PAGE_LIGHT, topK))
  }

  const step = (dt: number, t: number, snap: boolean) => {
    const f = sectionPos(els)
    const i = Math.min(4, Math.floor(f)), frac = i >= 4 ? 0 : f - i
    const shapeA = SECTION_SHAPES[i] ?? null
    const shapeB = i >= 4 ? null : (SECTION_SHAPES[i + 1] ?? null)
    const hasNext = i < 4
    const uIn = smooth(clamp((f - 2.3) / 0.7, 0, 1))
    const uOut = smooth(clamp((f - 3.55) / 0.45, 0, 1))
    publish(uIn, uOut)

    const wide = w >= 720
    const half = Math.min(w, h) * (wide ? 0.24 : 0.3)
    const toSection = clamp(f, 0, 1)
    const ccx = wide ? w * 0.2 : 0
    const ccy = (wide ? -h * 0.02 : -h * 0.14) * (1 - toSection)
    const dim = wide ? 1 : 1 - 0.2 * toSection
    const floor = wide ? 0.14 : 0.28 // dot brightness left behind text
    const dScroll = scrollY - lastScroll
    lastScroll = scrollY
    const rotA = rotFor(shapeA, t, mx, my), rotB = rotFor(shapeB, t, mx, my)
    const R = touching ? 90 : 120
    const zones: Array<[number, number, number, number]> = []
    for (const el of quiet) {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.bottom > -40 && r.top < h + 40) zones.push([r.left, r.top, r.right, r.bottom])
    }
    let o = 0
    for (let di = 0; di < active; di++) {
      const d = dots[di]
      if (!d) continue
      const outQ = hasNext ? smooth(clamp((frac - d.delay * 0.2) / 0.3, 0, 1)) : 0
      const inQ = hasNext ? smooth(clamp((frac - 0.5 - d.delay * 0.2) / 0.3, 0, 1)) : 0
      const wA = shapeA === null ? 0 : 1 - outQ
      const wB = shapeB === null ? 0 : inQ
      const wS = 1 - wA - wB
      let tx = 0, ty = 0, tz = 0
      if (wA > 0 && shapeA !== null) {
        rotate(d.t[shapeA] ?? ZERO, rotA)
        tx += (ccx + tmp[0] * half) * wA; ty += (ccy + tmp[1] * half) * wA; tz += tmp[2] * half * wA
      }
      if (wB > 0 && shapeB !== null) {
        rotate(d.t[shapeB] ?? ZERO, rotB)
        tx += (ccx + tmp[0] * half) * wB; ty += (ccy + tmp[1] * half) * wB; tz += tmp[2] * half * wB
      }
      tx += (d.u - 0.5) * w * wS; ty += (d.v - 0.5) * h * wS; tz += d.sz * wS
      const a = d.amp * (0.35 + wS * 1.25), s = Math.sin(t * d.w + d.ph), co = Math.cos(t * d.w + d.ph)
      if (d.type === 0) { tx += co * a; ty += s * a }
      else if (d.type === 1) { ty += s * a }
      else if (d.type === 2) { tx += s * a; ty += Math.sin(2 * t * d.w + d.ph2) * a * 0.7; tz += co * a }
      else { tx += s * a * 0.5; tz += s * a * 2 }
      if (snap) {
        d.x = tx; d.y = ty; d.z = tz
      } else {
        let fx = (tx - d.x) * d.k, fy = (ty - d.y) * d.k
        const rx = d.sx - px, ry = d.sy - py, r2 = rx * rx + ry * ry
        if (r2 < R * R) {
          const r = Math.sqrt(r2) || 1, g = 1 - r / R
          fx += (rx / r) * g * g * 9000
          fy += (ry / r) * g * g * 9000
        }
        d.vx += fx * dt + dScroll * d.inertia * Math.sin(d.ph) * 2
        d.vy += fy * dt - dScroll * d.inertia * 6
        d.vz += (tz - d.z) * d.k * dt
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
        quietF = Math.min(quietF, 1 - (1 - clamp(Math.hypot(ex, ey) / 36, 0, 1)) * (1 - floor))
      }
      const bright = wA * (BRIGHT[shapeA ?? 0] ?? 1) + wB * (BRIGHT[shapeB ?? 0] ?? 1) + wS * 0.55
      const twinkle = 0.88 + 0.12 * Math.sin(t * d.w * 2 + d.ph2)
      out[o++] = d.sx * D
      out[o++] = d.sy * D
      out[o++] = clamp(2.3 * persp * d.sv, 1.5, 5) * 3.1 * D
      out[o++] = (0.3 + depth * 0.7) * bright * dim * quietF * twinkle
      out[o++] = depth
    }
    if (uIn >= 0.999 && uOut <= 0.001) {
      gl.clearColor(0.9, 0.9, 0.91, 1) // fully inside the cloud
      gl.clear(gl.COLOR_BUFFER_BIT)
      return
    }
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(dotProg)
    gl.uniform2f(dotRes, canvas.width, canvas.height)
    gl.bindVertexArray(dotVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, out)
    gl.blendFunc(gl.ONE, gl.ONE) // glows add up
    gl.drawArrays(gl.POINTS, 0, active)
    if (uIn > 0.002 && uOut < 0.998) {
      gl.useProgram(cloudProg) // the cloud is drawn over the dots, so it swallows them
      gl.uniform2f(cloudRes, canvas.width, canvas.height)
      gl.uniform1f(cloudT, t)
      gl.uniform1f(cloudIn, uIn)
      gl.uniform1f(cloudOut, uOut)
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
      gl.bindVertexArray(cloudVao)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
  }

  const frame = (ms: number) => {
    const dt = Math.min((ms - last) / 1000 || 0.016, 1 / 15)
    last = ms
    if (++frames > 30) { // after warm-up, shed dots if the device can't keep up
      accDt += dt
      if (frames % 90 === 0) {
        if (accDt / 90 > 1 / 38 && active > minActive) active = Math.max(minActive, Math.floor(active * 0.75))
        accDt = 0
      }
    }
    mx += (tmx - mx) * (1 - Math.exp(-4 * dt))
    my += (tmy - my) * (1 - Math.exp(-4 * dt))
    step(dt, ms / 1000, false)
    raf = requestAnimationFrame(frame)
  }
  const still = () => {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(() => step(0, 0, true))
  }

  const onMove = (e: PointerEvent) => {
    px = e.clientX; py = e.clientY
    tmx = e.clientX / innerWidth - 0.5; tmy = e.clientY / innerHeight - 0.5
    touching = e.pointerType === 'touch'
  }
  const onLeave = () => { px = py = -9999; tmx = tmy = 0 }
  const onResize = () => { resize(); if (reduced) still() }
  const onVisible = () => { last = performance.now() }

  resize()
  for (const d of dots) {
    d.x = (d.u - 0.5) * w; d.y = (d.v - 0.5) * h; d.z = d.sz // start scattered, then assemble
  }
  addEventListener('resize', onResize)
  document.addEventListener('visibilitychange', onVisible)
  if (reduced) {
    addEventListener('scroll', still, { passive: true })
    still()
  } else {
    addEventListener('pointermove', onMove)
    addEventListener('pointerdown', onMove)
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
      removeEventListener('pointerdown', onMove)
      removeEventListener('pointerup', onLeave)
      removeEventListener('pointercancel', onLeave)
      document.removeEventListener('mouseleave', onLeave)
      document.removeEventListener('visibilitychange', onVisible)
      meta?.setAttribute('content', '#0a0a0b')
      CSS_VARS.forEach((v) => root.style.removeProperty(v))
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    },
  }
}
