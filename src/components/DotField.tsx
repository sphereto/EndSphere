import { useEffect, useRef, useState } from 'react'
import { createScene } from '../webgl/scene'

/** Fixed full-viewport WebGL canvas behind the Home page. Renders nothing if WebGL2 is unavailable. */
export default function DotField() {
  const ref = useRef<HTMLCanvasElement>(null)
  const [gen, setGen] = useState(0) // bump to mount a fresh canvas after the GPU context is lost
  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const scene = createScene(cv)
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
  return <canvas className="dots" key={gen} ref={ref} aria-hidden="true" />
}
