import { useEffect, useRef } from 'react'
import { createScene } from '../webgl/scene'
import { startDotSphere } from '../webgl/dotSphere2d'

export default function HeroScene() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const scene = createScene(cv) // stub: returns null until the WebGL scene is written
    return scene ? () => scene.dispose() : startDotSphere(cv)
  }, [])
  return <canvas id="cv" ref={ref} aria-hidden="true" />
}
