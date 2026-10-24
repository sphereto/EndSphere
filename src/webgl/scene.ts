import { ENDSTONE_MASK } from './endstoneMask'

export interface Scene {
  dispose(): void
}

interface Dot {
  // cube target (unit coords, -1..1) and scatter target (u,v in 0..1 over the viewport, depth in px)
  cx: number; cy: number; cz: number
  u: number; v: number; sz: number
  // state (px, relative to the canvas centre)
  x: number; y: number; z: number
  vx: number; vy: number; vz: number
  // personality
  k: number // spring stiffness
  c: number // damping
  amp: number // idle drift amplitude (px)
  w: number // drift speed (rad/s)
  ph: number
  ph2: number
  type: 0 | 1 | 2 | 3 // 0 orbit, 1 bob, 2 lissajous, 3 depth sway
  delay: number // 0..1, when this dot leaves/returns during scroll
  inertia: number // how strongly scroll velocity throws this dot
  sx: number; sy: number // last screen position (for the pointer)
}

const VS = `#version 300 es
in vec4 a; uniform vec2 u_res; out float v_a;
void main(){ vec2 c = a.xy / u_res * 2.0 - 1.0; gl_Position = vec4(c.x, -c.y, 0.0, 1.0); gl_PointSize = a.z; v_a = a.w; }`
const FS = `#version 300 es
precision mediump float; in float v_a; out vec4 o;
void main(){ float r = length(gl_PointCoord - 0.5); float m = smoothstep(0.5, 0.38, r) * v_a; o = vec4(vec3(m), m); }`

const F = 1400 // focal length (px)
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const rand = (a: number, b: number) => a + Math.random() * (b - a)

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const s = gl.createShader(type)
  if (!s) return null
  gl.shaderSource(s, src)
  gl.compileShader(s)
  return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null
}

function buildDots(n: number): Dot[] {
  const V: Array<[number, number, number]> = []
  for (let i = 0; i < 8; i++) V.push([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1])
  const edges: Array<[[number, number, number], [number, number, number]]> = []
  for (let a = 0; a < 8; a++)
    for (let b = a + 1; b < 8; b++) {
      const va = V[a], vb = V[b]
      if (!va || !vb) continue
      const diff = (va[0] !== vb[0] ? 1 : 0) + (va[1] !== vb[1] ? 1 : 0) + (va[2] !== vb[2] ? 1 : 0)
      if (diff === 1) edges.push([va, vb])
    }
  const cells: Array<[number, number]> = []
  ENDSTONE_MASK.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) if (row.charAt(i) === '1') cells.push([i, j])
  })
  const perEdge = Math.ceil(n / 12)
  const dots: Dot[] = []
  for (let i = 0; i < n; i++) {
    const e = edges[i % 12]
    if (!e) continue
    const t = (Math.floor(i / 12) + Math.random() * 0.7) / perEdge
    const [a, b] = e
    const cell = cells[Math.floor(Math.random() * cells.length)] ?? [16, 16]
    dots.push({
      cx: a[0] + (b[0] - a[0]) * t, cy: a[1] + (b[1] - a[1]) * t, cz: a[2] + (b[2] - a[2]) * t,
      u: (cell[0] + Math.random()) / 32, v: (cell[1] + Math.random()) / 32, sz: rand(-220, 220),
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
      k: rand(16, 40), c: rand(4, 8), amp: rand(1.5, 7), w: rand(0.4, 1.4),
      ph: rand(0, 6.283), ph2: rand(0, 6.283), type: (i % 4) as 0 | 1 | 2 | 3,
      delay: Math.random(), inertia: rand(0.2, 1), sx: 0, sy: 0,
    })
  }
  return dots
}

/** WebGL2 dot field: a wireframe cube of dots that scatters into the endstone pattern as you scroll. */
export function createScene(canvas: HTMLCanvasElement): Scene | null {
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, premultipliedAlpha: true })
  if (!gl) return null
  const vs = compile(gl, gl.VERTEX_SHADER, VS)
  const fs = compile(gl, gl.FRAGMENT_SHADER, FS)
  const prog = gl.createProgram()
  const buf = gl.createBuffer()
  if (!vs || !fs || !prog || !buf) return null
  gl.attachShader(prog, vs)
  gl.attachShader(prog, fs)
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null
  gl.useProgram(prog)
  const uRes = gl.getUniformLocation(prog, 'u_res')
  const loc = gl.getAttribLocation(prog, 'a')
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const dots = buildDots(innerWidth < 720 ? 600 : 1000)
  const out = new Float32Array(dots.length * 4)
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, out.byteLength, gl.DYNAMIC_DRAW)
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 0, 0)
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

  let w = 1, h = 1, D = 1, raf = 0, last = 0, lastScroll = scrollY
  let mx = 0, my = 0, tmx = 0, tmy = 0, px = -9999, py = -9999, touching = false

  const resize = () => {
    D = Math.min(devicePixelRatio || 1, 2)
    w = canvas.clientWidth
    h = canvas.clientHeight
    canvas.width = Math.round(w * D)
    canvas.height = Math.round(h * D)
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.uniform2f(uRes, canvas.width, canvas.height)
  }

  const step = (dt: number, t: number, snap: boolean) => {
    const wide = w >= 720
    const half = Math.min(w, h) * (wide ? 0.17 : 0.21)
    const ccx = wide ? w * 0.2 : 0
    const ccy = wide ? -h * 0.02 : -h * 0.14
    const p = clamp(scrollY / (h * 0.7), 0, 1)
    const dScroll = scrollY - lastScroll
    lastScroll = scrollY
    const ay = t * 0.22 + mx * 0.7, ax = 0.5 + my * 0.4
    const ca = Math.cos(ay), sa = Math.sin(ay), cb = Math.cos(ax), sb = Math.sin(ax)
    const R = touching ? 90 : 120
    let o = 0
    for (const d of dots) {
      const q = clamp(p * 1.5 - d.delay * 0.5, 0, 1)
      const e = q * q * (3 - 2 * q)
      // cube target, rotated
      const x1 = d.cx * ca + d.cz * sa, z1 = -d.cx * sa + d.cz * ca
      const y1 = d.cy * cb - z1 * sb, z2 = d.cy * sb + z1 * cb
      const a = d.amp * (1 + e * 1.6), s = Math.sin(t * d.w + d.ph), co = Math.cos(t * d.w + d.ph)
      let dx = 0, dy = 0, dz = 0
      if (d.type === 0) { dx = co * a; dy = s * a }
      else if (d.type === 1) { dy = s * a }
      else if (d.type === 2) { dx = s * a; dy = Math.sin(2 * t * d.w + d.ph2) * a * 0.7; dz = co * a }
      else { dx = s * a * 0.5; dz = s * a * 2 }
      const tx = (ccx + x1 * half) * (1 - e) + (d.u - 0.5) * w * e + dx
      const ty = (ccy + y1 * half) * (1 - e) + (d.v - 0.5) * h * e + dy
      const tz = z2 * half * (1 - e) + d.sz * e + dz
      if (snap) {
        d.x = tx; d.y = ty; d.z = tz
      } else {
        let fx = (tx - d.x) * d.k, fy = (ty - d.y) * d.k
        const rx = d.sx - px, ry = d.sy - py, r2 = rx * rx + ry * ry
        if (r2 < R * R) {
          const r = Math.sqrt(r2) || 1, f = 1 - r / R
          fx += (rx / r) * f * f * 9000
          fy += (ry / r) * f * f * 9000
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
      out[o++] = d.sx * D
      out[o++] = d.sy * D
      out[o++] = clamp(1.7 * persp, 1, 3.4) * D
      out[o++] = (0.25 + depth * 0.75) * (1 - 0.35 * e)
    }
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, out)
    gl.drawArrays(gl.POINTS, 0, dots.length)
  }

  const frame = (ms: number) => {
    const dt = Math.min((ms - last) / 1000 || 0.016, 1 / 15)
    last = ms
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

  resize()
  for (const d of dots) {
    d.x = (d.u - 0.5) * w; d.y = (d.v - 0.5) * h; d.z = d.sz // start scattered, then assemble the cube
  }
  addEventListener('resize', onResize)
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
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    },
  }
}
