import { useSyncExternalStore } from 'react'

/** loading: curtain closed, nothing responds. opening: curtain sliding. live: everything interactive. */
export type Phase = 'loading' | 'opening' | 'live'

export const boot = { phase: 'loading' as Phase, sceneReady: false, openedAt: 0 }

const subs = new Set<() => void>()
export const setBoot = (p: Partial<typeof boot>) => {
  Object.assign(boot, p)
  subs.forEach((f) => f())
}
const subscribe = (cb: () => void) => {
  subs.add(cb)
  return () => subs.delete(cb)
}
export const useBootPhase = (): Phase => useSyncExternalStore(subscribe, () => boot.phase)
export const useSceneReady = (): boolean => useSyncExternalStore(subscribe, () => boot.sceneReady)
