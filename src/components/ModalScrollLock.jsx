import { useEffect } from 'react'
import { lockBodyScroll } from '../lib/scrollLock'

/**
 * Eén centrale regel voor álle modals: zodra er een `.modal-overlay` in de DOM
 * staat, staat de pagina eronder vast (geen doorscrollen van de achtergrond op
 * iOS) en krijgt <html> de klasse `modal-open` (CSS verbergt dan op mobiel de
 * onderbalk en de support-bubbel). Werkt voor bestaande én toekomstige modals
 * zonder dat ze zelf iets hoeven te doen. ConfirmModal telt bewust niet mee als
 * "schermvullend" (zie CSS), maar vergrendelt wél de achtergrond.
 */
export default function ModalScrollLock() {
  useEffect(() => {
    let unlock = null
    const root = document.documentElement
    function sync() {
      const open = !!document.querySelector('.modal-overlay')
      if (open && !unlock) { unlock = lockBodyScroll(); root.classList.add('modal-open') }
      else if (!open && unlock) { unlock(); unlock = null; root.classList.remove('modal-open') }
    }
    const obs = new MutationObserver(sync)
    obs.observe(document.body, { childList: true, subtree: true })
    sync()
    return () => { obs.disconnect(); if (unlock) unlock(); root.classList.remove('modal-open') }
  }, [])
  return null
}
