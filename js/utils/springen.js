// Nach dem Öffnen einer Seite zu einem Element springen (z. B. Treffer aus der Suche) und es kurz hervorheben
export function springeZu(id) {
  if (!id) return
  // Kurz warten, bis der Router seine eigene Scroll-Position gesetzt hat
  setTimeout(() => {
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ block: 'center' })
    el.classList.add('hervorgehoben')
    setTimeout(() => el.classList.remove('hervorgehoben'), 3000)
  }, 150)
}
