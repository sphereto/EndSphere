import { useEffect, useRef, useState } from 'react'
import { boot, setBoot } from '../boot'

const MIN_MS = 1600, MAX_MS = 4000
const TAGLINE = 'EndSphere. Plugins for your Endstone server.'

/** Text-only loading screen. When everything is ready the text fades and two flat halves slide apart like a stage curtain. */
export default function Loader({ needsScene }: { needsScene: boolean }) {
  const [stage, setStage] = useState<'wait' | 'text' | 'slide' | 'gone'>('wait')
  const needs = useRef(needsScene)

  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const timers: number[] = []
    let fontsOk = false, started = false
    const t0 = performance.now()
    document.fonts.ready.then(() => { fontsOk = true })
    const open = () => {
      if (started) return
      started = true
      setStage('text')
      timers.push(window.setTimeout(() => {
        setStage('slide')
        setBoot({ phase: 'opening', openedAt: performance.now() }) // the dot swarm starts building now
        timers.push(window.setTimeout(() => setBoot({ phase: 'live' }), reduced ? 150 : 600)) // unlock at halfway
        timers.push(window.setTimeout(() => setStage('gone'), reduced ? 400 : 1300))
      }, reduced ? 0 : 450))
    }
    const poll = window.setInterval(() => {
      const el = performance.now() - t0
      if ((fontsOk && (boot.sceneReady || !needs.current) && el >= MIN_MS) || el >= MAX_MS) {
        window.clearInterval(poll)
        open()
      }
    }, 60)
    return () => { window.clearInterval(poll); timers.forEach(window.clearTimeout) }
  }, [])

  if (stage === 'gone') return null
  return (
    <div className={`ld ${stage}`} role="status" aria-label="Loading">
      <div className="ld-l" />
      <div className="ld-r" />
      <p className="ld-t">{TAGLINE}</p>
    </div>
  )
}
