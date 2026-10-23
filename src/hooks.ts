import { useEffect, useSyncExternalStore } from 'react'

const subscribe = (cb: () => void) => {
  addEventListener('hashchange', cb)
  return () => removeEventListener('hashchange', cb)
}

/** Current location.hash (e.g. "#browse"). Hash routing keeps GitHub Pages happy with no 404 fallback. */
export const useHash = (): string => useSyncExternalStore(subscribe, () => location.hash)

/** Fades in every `.rv` element as it enters the viewport. Re-runs when `key` changes (route switch). */
export function useReveal(key: unknown): void {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            io.unobserve(e.target)
          }
        }),
      { threshold: 0.15 },
    )
    document.querySelectorAll('.rv').forEach((n) => io.observe(n))
    return () => io.disconnect()
  }, [key])
}
