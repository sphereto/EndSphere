type Pt = readonly [number, number, number, boolean]

/** 2D-canvas fallback: dotted sphere with a violet orbit ring. Returns a disposer. */
export function startDotSphere(cv: HTMLCanvasElement): () => void {
  const cx = cv.getContext('2d')
  if (!cx) return () => {}
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const pts: Pt[] = []
  const N = 1100
  for (let i = 0; i < N; i++) {
    const y = 1 - (2 * (i + 0.5)) / N
    const r = Math.sqrt(1 - y * y)
    const t = i * 2.39996
    pts.push([Math.cos(t) * r, y, Math.sin(t) * r, false])
  }
  for (let i = 0; i < 160; i++) {
    const a = (i / 160) * Math.PI * 2
    pts.push([Math.cos(a) * 1.45, (Math.random() - 0.5) * 0.02, Math.sin(a) * 1.45, true])
  }
  const stars = Array.from({ length: 140 }, () => [Math.random(), Math.random(), Math.random()] as const)
  let W = 0, H = 0, D = 1, mx = 0, my = 0, tx = 0, ty = 0, raf = 0

  const size = () => {
    D = Math.min(devicePixelRatio || 1, 2)
    W = cv.width = cv.clientWidth * D
    H = cv.height = cv.clientHeight * D
  }
  const move = (e: PointerEvent) => {
    tx = e.clientX / innerWidth - 0.5
    ty = e.clientY / innerHeight - 0.5
  }
  const frame = (t: number) => {
    mx += (tx - mx) * 0.05
    my += (ty - my) * 0.05
    cx.clearRect(0, 0, W, H)
    cx.fillStyle = 'rgba(255,255,255,.35)'
    for (const [sx, sy, ss] of stars) cx.fillRect(sx * W, sy * H, ss * 1.6 * D, ss * 1.6 * D)
    const wide = W / D > 720
    const ox = W * (wide ? 0.7 : 0.5), oy = H * (wide ? 0.5 : 0.3), R = Math.min(W, H) * (wide ? 0.3 : 0.26)
    const ay = t * 0.00014 + mx * 0.8, ax = 0.45 + my * 0.5
    const ca = Math.cos(ay), sa = Math.sin(ay), cb = Math.cos(ax), sb = Math.sin(ax)
    for (const [px, py, pz, ring] of pts) {
      const x = px * ca + pz * sa, z = -px * sa + pz * ca
      const yy = py * cb - z * sb, zz = py * sb + z * cb
      const d = (zz + 1.5) / 3, s = (0.5 + d * 1.4) * D
      cx.fillStyle = ring ? `rgba(166,107,255,${0.25 + d * 0.75})` : `rgba(255,255,255,${0.1 + d * 0.8})`
      cx.fillRect(ox + x * R, oy + yy * R, s, s)
    }
    if (!reduced) raf = requestAnimationFrame(frame)
  }

  size()
  addEventListener('resize', size)
  addEventListener('pointermove', move)
  raf = requestAnimationFrame(frame)
  return () => {
    cancelAnimationFrame(raf)
    removeEventListener('resize', size)
    removeEventListener('pointermove', move)
  }
}
