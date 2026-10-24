import { useEffect, useRef } from 'react'
import { createScene } from '../webgl/scene'

/** Fixed full-viewport WebGL canvas behind the Home page. Renders nothing if WebGL2 is unavailable. */
export default function DotField() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current
    const scene = cv ? createScene(cv) : null
    return () => scene?.dispose()
  }, [])
  return <canvas className="dots" ref={ref} aria-hidden="true" />
}
