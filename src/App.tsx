import { useEffect, useRef, useState } from 'react'
import Browse from './components/Browse'
import Header from './components/Header'
import Home from './components/Home'
import { useReveal } from './hooks'
import { scrollToSection, takePendingSection, useRoute } from './router'

export default function App() {
  const route = useRoute()
  const [menu, setMenu] = useState(false)
  const first = useRef(true)

  useEffect(() => {
    setMenu(false)
    document.title = route === 'browse' ? 'Browse — EndSphere' : 'EndSphere — Free Endstone plugins'
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

  useReveal(route)

  return (
    <>
      <Header open={menu} onToggle={() => setMenu((m) => !m)} onClose={() => setMenu(false)} />
      {route === 'browse' ? <Browse /> : <Home />}
    </>
  )
}
