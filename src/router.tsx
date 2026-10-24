import { useSyncExternalStore, type MouseEvent, type ReactNode } from 'react'

export type Route = 'home' | 'browse' | 'notfound'

/** e.g. "/EndSphere/" (from vite `base`). */
export const BASE = import.meta.env.BASE_URL

const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
addEventListener('popstate', emit)
const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

const getRoute = (): Route => {
  const path = location.pathname.startsWith(BASE) ? location.pathname.slice(BASE.length) : location.pathname.slice(1)
  const clean = path.replace(/\/+$/, '')
  return clean === '' || clean === 'index.html' ? 'home' : clean === 'browse' ? 'browse' : 'notfound'
}

export const useRoute = (): Route => useSyncExternalStore(subscribe, getRoute)

const behavior = (): ScrollBehavior => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth')

export const scrollToSection = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: behavior() })

let pendingSection: string | null = null
export const takePendingSection = (): string | null => {
  const s = pendingSection
  pendingSection = null
  return s
}

/** Navigate between pages (real paths). Sections on Home scroll without changing the URL. */
export function go(to: Route, section?: string) {
  if (to === getRoute()) {
    if (section) scrollToSection(section)
    else scrollTo({ top: 0, behavior: behavior() })
    return
  }
  pendingSection = section ?? null
  history.pushState(null, '', to === 'browse' ? `${BASE}browse/` : BASE)
  emit()
}

interface LinkProps {
  to: Route
  section?: string
  className?: string
  children: ReactNode
}

export function NavLink({ to, section, className, children }: LinkProps) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    go(to, section)
  }
  return (
    <a href={to === 'browse' ? `${BASE}browse/` : BASE} className={className} onClick={onClick}>
      {children}
    </a>
  )
}
