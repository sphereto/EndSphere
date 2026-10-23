import { useEffect, useState } from 'react'
import Browse from './components/Browse'
import Header from './components/Header'
import Home from './components/Home'
import { useHash, useReveal } from './hooks'

export default function App() {
  const hash = useHash()
  const browse = hash === '#browse'
  const [menu, setMenu] = useState(false)

  useEffect(() => {
    setMenu(false)
    document.title = browse ? 'Browse — EndSphere' : 'EndSphere — Free Endstone plugins'
    const el = !browse && hash.length > 1 ? document.getElementById(hash.slice(1)) : null
    if (el) el.scrollIntoView()
    else scrollTo(0, 0)
  }, [hash, browse])

  useEffect(() => {
    document.body.style.overflow = menu ? 'hidden' : ''
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false)
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [menu])

  useReveal(browse)

  return (
    <>
      <Header open={menu} onToggle={() => setMenu((m) => !m)} />
      {browse ? <Browse /> : <Home />}
    </>
  )
}
