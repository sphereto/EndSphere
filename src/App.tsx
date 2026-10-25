import { useEffect, useRef, useState } from 'react'
import Browse from './components/Browse'
import Header from './components/Header'
import Home from './components/Home'
import NotFound from './components/NotFound'
import Loader from './components/Loader'
import { useBootPhase } from './boot'
import { useReveal } from './hooks'
import { scrollToSection, takePendingSection, useRoute } from './router'

export default function App() {
  const route = useRoute()
  const [menu, setMenu] = useState(false)
  const first = useRef(true)
  const phase = useBootPhase()
  const needsScene = useRef(route === 'home')

  useEffect(() => {
    setMenu(false)
    document.title = route === 'browse' ? 'Browse — EndSphere' : route === 'notfound' ? 'Not found — EndSphere' : 'EndSphere — Free Endstone plugins'
    if (first.current) {
      first.current = false // keep the browser's own scroll restoration on load/refresh
      return
    }
    const section = takePendingSection()
    if (section) requestAnimationFrame(() => scrollToSection(section))
    else scrollTo(0, 0)
  }, [route])

  useEffect(() => {
    document.body.style.overflow = menu ? 'hidden' : ''
    document.body.classList.toggle('menu-open', menu)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false)
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [menu])

  useEffect(() => {
    document.documentElement.classList.toggle('booting', phase !== 'live')
  }, [phase])

  useReveal(route)

  return (
    <>
      <div inert={phase !== 'live'}>
        <Header open={menu} onToggle={() => setMenu((m) => !m)} onClose={() => setMenu(false)} />
        {route === 'browse' ? <Browse /> : route === 'notfound' ? <NotFound /> : <Home />}
      </div>
      <Loader needsScene={needsScene.current} />
    </>
  )
}
