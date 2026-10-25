import { useEffect, useRef, useState } from 'react'
import { createScene } from '../webgl/scene'

/** Fixed full-viewport WebGL layers behind the Home page: a low-res nebula canvas and the particle/cloud canvas. */
export default function DotField() {
  const dots = useRef<HTMLCanvasElement>(null)
  const nebula = useRef<HTMLCanvasElement>(null)
  const [gen, setGen] = useState(0) // bump to mount fresh canvases after the GPU context is lost
  useEffect(() => {
    const cv = dots.current, nb = nebula.current
    if (!cv || !nb) return
    const scene = createScene(cv, nb)
    const onLost = (e: Event) => {
      e.preventDefault()
      setGen((g) => g + 1)
    }
    cv.addEventListener('webglcontextlost', onLost)
    return () => {
      cv.removeEventListener('webglcontextlost', onLost)
      scene?.dispose()
    }
  }, [gen])
  return (
    <div key={gen} aria-hidden="true">
      <canvas className="nebula" ref={nebula} />
      <canvas className="dots" ref={dots} />
    </div>
  )
}
