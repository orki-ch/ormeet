// Dialoge wie in Orki (jquery-confirm, $.confirm / $.alert) als Promise: bestätigen, Hinweis, Eingabe.
// Abbrechen steht links, der bestätigende Knopf ganz rechts.
// Texte werden escaped (sie enthalten oft Namen); Zeilenumbrüche werden zu <br>.
const STANDARD = {
  theme: 'light',
  useBootstrap: false,
  boxWidth: 'min(28rem, calc(100vw - 2rem))',
  animation: 'scale',
  closeAnimation: 'scale',
  animationSpeed: 200,
  backgroundDismiss: false,
  draggable: false,
}

function html(text) {
  return String(text).replace(/[&<>"']/g, (z) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[z]).replace(/\n/g, '<br>')
}

// Ja / Abbrechen -> true / false; gefahr: roter Knopf (Löschen, Entfernen)
export function bestaetigen(nachricht, { titel = 'Bitte bestätigen', ja = 'Ja', nein = 'Abbrechen', gefahr = false } = {}) {
  return new Promise((fertig) => {
    $.confirm({
      ...STANDARD,
      title: html(titel),
      content: html(nachricht),
      escapeKey: 'abbrechen',
      buttons: {
        abbrechen: { text: html(nein), action: () => fertig(false) },
        ok: { text: html(ja), btnClass: gefahr ? 'btn-red' : 'btn-blue', keys: ['enter'], action: () => fertig(true) },
      },
    })
  })
}

// Hinweis mit OK (z. B. Fehlermeldungen)
export function hinweis(nachricht, titel = 'Hinweis') {
  return new Promise((fertig) => {
    $.alert({
      ...STANDARD,
      title: html(titel),
      content: html(nachricht),
      escapeKey: 'ok',
      buttons: { ok: { text: 'OK', btnClass: 'btn-blue', keys: ['enter'], action: () => fertig() } },
    })
  })
}

// Eingabefeld -> Text, oder null bei Abbrechen
export function eingabe(nachricht, { titel = 'Eingabe', typ = 'text', platzhalter = '', ja = 'Speichern' } = {}) {
  return new Promise((fertig) => {
    $.confirm({
      ...STANDARD,
      title: html(titel),
      content: `<p>${html(nachricht)}</p><input class="input dialog-eingabe" type="${typ === 'password' ? 'password' : 'text'}" placeholder="${html(platzhalter)}" autocomplete="off">`,
      escapeKey: 'abbrechen',
      onContentReady() {
        const feld = this.$content.find('.dialog-eingabe')
        feld.trigger('focus')
        feld.on('keydown', (e) => e.key === 'Enter' && this.$$ok.trigger('click'))
      },
      buttons: {
        abbrechen: { text: 'Abbrechen', action: () => fertig(null) },
        ok: { text: html(ja), btnClass: 'btn-blue', action() { fertig(this.$content.find('.dialog-eingabe').val()) } },
      },
    })
  })
}
