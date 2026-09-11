import { useEffect } from 'react'

/**
 * Pagina-scroll vergrendelen zolang een sheet/modal/schermvullend gesprek open
 * is. iOS negeert `overflow: hidden` op body deels (rubber-banding, scroll-
 * chaining naar de pagina), daarom de `position: fixed`-techniek met behoud
 * van de scrollpositie. Ref-counted: meerdere lagen mogen tegelijk vergrendelen.
 */
let locks = 0
let savedScrollY = 0

export function lockBodyScroll() {
  if (typeof document === 'undefined') return () => {}
  if (locks === 0) {
    savedScrollY = window.scrollY || 0
    const b = document.body.style
    b.position = 'fixed'
    b.top = `-${savedScrollY}px`
    b.left = '0'
    b.right = '0'
    b.width = '100%'
    b.overflow = 'hidden'
    document.documentElement.classList.add('scroll-locked')
  }
  locks++
  let released = false
  return () => {
    if (released) return
    released = true
    locks = Math.max(0, locks - 1)
    if (locks === 0) {
      const b = document.body.style
      b.position = ''
      b.top = ''
      b.left = ''
      b.right = ''
      b.width = ''
      b.overflow = ''
      document.documentElement.classList.remove('scroll-locked')
      window.scrollTo(0, savedScrollY)
    }
  }
}

/** Hook-variant: vergrendelt zolang `active` waar is. */
export function useBodyScrollLock(active = true) {
  useEffect(() => {
    if (!active) return
    return lockBodyScroll()
  }, [active])
}

/** Smal scherm (mobiel)? Eén plek voor de grens die ook Chat.css gebruikt. */
export function isNarrowScreen() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(max-width: 768px)').matches
}
