// Mixin für Listen mit Vorschau-/Bearbeitungsmodus:
// `aktiv` hält die ID des Elements, das gerade bearbeitet wird. Es schliesst erst, wenn ein anderes
// Element geöffnet, «Fertig» geklickt oder Escape gedrückt wird.
export const bearbeitenMixin = {
  data() {
    return { aktiv: null }
  },
  mounted() {
    document.addEventListener('keydown', this.escape)
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.escape)
  },
  methods: {
    escape(event) {
      if (event.key === 'Escape') this.aktiv = null
    },
  },
}
