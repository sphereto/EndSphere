import { useEffect } from 'react'

/** Fades in every `.rv` element as it enters the viewport. Re-runs when `key` changes (page switch). */
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
