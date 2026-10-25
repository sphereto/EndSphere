/** Low-resolution violet nebula: soft clouds that expand toward the viewer, steered and swirled by the pointer. */
const VS = `#version 300 es
void main(){ vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`
const FS = `#version 300 es
precision highp float; out vec4 o;
uniform vec2 u_res, u_vp, u_mouse; uniform float u_fl, u_swirl, u_hue;
float h(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + 1.0), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for(int i = 0; i < 4; i++){ s += a * n(p); p = p * 2.02 + vec2(1.7, 9.2); a *= 0.5; } return s; }
void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  vec2 m = (u_mouse - 0.5 * u_res) / u_res.y;
  vec2 d = uv - m; float r2 = dot(d, d);
  float ang = u_swirl * 2.2 * exp(-r2 * 9.0);
  uv = m + mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * d; // clouds swirl around the cursor
  uv -= u_vp;                                                  // the vanishing point follows the cursor
  vec3 colA = mix(vec3(0.30, 0.16, 0.70), vec3(0.60, 0.20, 0.62), u_hue);
  vec3 col = mix(vec3(0.028, 0.018, 0.070), vec3(0.060, 0.034, 0.150), smoothstep(-0.6, 0.7, uv.y + 0.2));
  for(int i = 0; i < 3; i++){
    float ph = fract(u_fl + float(i) / 3.0);
    float zoom = exp(ph * 2.2);                                // 1 -> 9: the cloud grows as it comes toward you
    float dens = smoothstep(0.38, 0.85, fbm(uv / zoom * 2.4 + float(i) * 7.3));
    float fade = sin(3.14159 * ph) * smoothstep(0.02, 0.35, length(uv));
    col += mix(colA, vec3(0.85, 0.65, 1.0), dens * dens) * dens * fade * 0.33;
  }
  col += colA * 0.05 * fbm(uv * 1.3 + u_fl * 0.2);
  col += colA * 0.22 * exp(-r2 * 14.0) * (0.3 + u_swirl);     // soft glow where the cursor is
  col *= 1.0 - 0.38 * smoothstep(0.5, 1.2, length(uv + u_vp));
  o = vec4(col, 1.0);
}`

export interface Nebula {
  draw(p: { fl: number; vpx: number; vpy: number; mx: number; my: number; swirl: number; hue: number }): void
  resize(): void
  dispose(): void
}

export function createNebula(canvas: HTMLCanvasElement, scale: number): Nebula | null {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false })
  if (!gl) return null
  const mk = (t: number, s: string) => {
    const sh = gl.createShader(t)
    if (!sh) return null
    gl.shaderSource(sh, s)
    gl.compileShader(sh)
    return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null
  }
  const vs = mk(gl.VERTEX_SHADER, VS), fs = mk(gl.FRAGMENT_SHADER, FS), prog = gl.createProgram()
  if (!vs || !fs || !prog) return null
  gl.attachShader(prog, vs)
  gl.attachShader(prog, fs)
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null
  gl.useProgram(prog)
  const U = (n: string) => gl.getUniformLocation(prog, n)
  const uRes = U('u_res'), uVp = U('u_vp'), uMouse = U('u_mouse'), uFl = U('u_fl'), uSw = U('u_swirl'), uHue = U('u_hue')
  const vao = gl.createVertexArray()
  gl.bindVertexArray(vao)
  let W = 1, H = 1
  const resize = () => {
    W = Math.max(2, Math.round(canvas.clientWidth * scale))
    H = Math.max(2, Math.round(canvas.clientHeight * scale))
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; gl.viewport(0, 0, W, H) }
  }
  resize()
  return {
    resize,
    draw(p) {
      gl.uniform2f(uRes, W, H)
      gl.uniform2f(uVp, p.vpx, p.vpy)
      gl.uniform2f(uMouse, p.mx * W, (1 - p.my) * H)
      gl.uniform1f(uFl, p.fl)
      gl.uniform1f(uSw, p.swirl)
      gl.uniform1f(uHue, p.hue)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    },
    dispose() { gl.getExtension('WEBGL_lose_context')?.loseContext() },
  }
}
