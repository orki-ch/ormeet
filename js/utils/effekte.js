// Mikro-Interaktionen nach dem aeweb-Designsystem, einmal für die ganze App (Ereignisse am Dokument):
// Lichtschein folgt dem Zeiger auf Buttons, Welle ab der Klickstelle, Reiterleisten scrollen mit dem Mausrad quer
// und holen den angeklickten Reiter ganz ins Bild. Bei «Bewegung reduzieren» entfällt die Welle.
const ruhig = matchMedia('(prefers-reduced-motion: reduce)')

document.addEventListener(
  'pointermove',
  (event) => {
    const knopf = event.target.closest?.('.btn')
    if (!knopf) return
    const rahmen = knopf.getBoundingClientRect()
    knopf.style.setProperty('--mx', event.clientX - rahmen.left + 'px')
    knopf.style.setProperty('--my', event.clientY - rahmen.top + 'px')
  },
  { passive: true },
)

document.addEventListener('pointerdown', (event) => {
  const knopf = event.target.closest?.('.btn, .icon-btn')
  if (!knopf || knopf.matches(':disabled') || ruhig.matches) return
  const rahmen = knopf.getBoundingClientRect()
  // Runde Symbol-Knöpfe schneiden nicht ab (ihr Tooltip ragt hinaus): Welle mittig und genau so gross wie der Knopf
  const rund = knopf.classList.contains('icon-btn')
  const welle = document.createElement('span')
  welle.className = 'welle'
  welle.style.setProperty('--rx', (rund ? rahmen.width / 2 : event.clientX - rahmen.left) + 'px')
  welle.style.setProperty('--ry', (rund ? rahmen.height / 2 : event.clientY - rahmen.top) + 'px')
  welle.style.setProperty('--rs', (rund ? rahmen.width : Math.hypot(rahmen.width, rahmen.height) * 2) + 'px')
  knopf.appendChild(welle)
  welle.addEventListener('animationend', () => welle.remove())
})

document.addEventListener(
  'wheel',
  (event) => {
    const leiste = event.target.closest?.('.tabs')
    if (!leiste || leiste.scrollWidth <= leiste.clientWidth || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
    event.preventDefault()
    leiste.scrollLeft += event.deltaY
  },
  { passive: false },
)

document.addEventListener('click', (event) => {
  event.target.closest?.('.tabs .tab')?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
})
