// Direktive v-wachsen: Textfeld wächst mit seinem Inhalt (Ergänzung zu field-sizing für ältere Browser)
function anpassen(el) {
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}

export const wachsen = {
  mounted(el) {
    if (CSS.supports('field-sizing', 'content')) return
    el.style.overflowY = 'hidden'
    anpassen(el)
    el.addEventListener('input', () => anpassen(el))
  },
  updated(el) {
    if (!CSS.supports('field-sizing', 'content')) anpassen(el)
  },
}
