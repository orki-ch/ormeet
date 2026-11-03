import { api } from '../api.js'

// Schaltflächen «Mit … anmelden» für die eingerichteten SSO-Anbieter. Die Anmeldung beim Anbieter läuft in einem Popup;
// danach öffnet dieses Fenster den eigenen Zugang bzw. die gewünschte Seite (js/sso-zurueck.js). Lässt der Browser kein
// Popup zu, geht es wie bisher im selben Fenster zum Anbieter und zurück. Mit «konto» (Mein Konto) wird der Anbieter mit
// dem angemeldeten Konto verknüpft (signierter Code aus sso_verknuepfen_code). Anbieter ohne eigene Daten (Orki) melden
// verknüpfte Konten an; registrieren lässt sich damit nur über einen persönlichen Link (Name und E-Mail aus Ormeet).
export default {
  name: 'SsoButtons',
  props: {
    verknuepfen: { type: String, default: '' }, // persönlicher Link, der mit dem Konto verknüpft werden soll
    text: { type: String, default: 'anmelden' },
    konto: { type: Boolean, default: false }, // auf «Mein Konto»: Anbieter mit dem angemeldeten Konto verknüpfen
  },
  template: `
    <div v-if="Object.keys(anbieter).length" class="sso stack-sm">
      <p class="leise small center">oder</p>
      <a v-for="(name, id) in anbieter" :key="id" :href="link(id)" class="btn btn-block" @click="popupOeffnen($event, id)">Mit {{ name }} {{ text }}</a>
      <p v-if="fehler" class="small text-err center">{{ fehler }}</p>
      <p v-if="popupOffen" class="leise small center">Die Anmeldung läuft in einem eigenen Fenster. <a href="#" @click.prevent="popupZeigen">Fenster zeigen</a></p>
    </div>
  `,
  data() {
    return { anbieter: {}, popup: null, popupOffen: false, pruefen: null, fehler: '' }
  },
  async created() {
    const antwort = await api.anfrage('sso_anbieter').catch(() => ({ anbieter: {} }))
    this.anbieter = antwort.anbieter
    window.addEventListener('message', this.angemeldet)
  },
  unmounted() {
    window.removeEventListener('message', this.angemeldet)
    clearInterval(this.pruefen)
  },
  methods: {
    link(id, popup = false, code = '') {
      const p = new URLSearchParams({ aktion: 'sso_start', anbieter: id, verknuepfen: this.verknuepfen, weiter: this.verknuepfen ? '' : this.$route.query.weiter || '' })
      if (code) p.set('konto', code)
      if (popup) p.set('popup', '1')
      return 'api.php?' + p
    },
    async popupOeffnen(event, id) {
      const breite = 520
      const hoehe = 700
      const links = Math.max(0, window.screenX + (window.outerWidth - breite) / 2)
      const oben = Math.max(0, window.screenY + (window.outerHeight - hoehe) / 2)
      this.fehler = ''
      // Das Popup sofort öffnen (sonst blockiert es der Browser); beim Verknüpfen erst danach den Code holen
      const popup = window.open(this.konto ? 'about:blank' : this.link(id, true), 'ormeet-sso', `popup=yes,width=${breite},height=${hoehe},left=${links},top=${oben}`)
      if (!popup && !this.konto) return // Popup blockiert: der Link führt im selben Fenster zum Anbieter
      event.preventDefault()
      if (this.konto) {
        let code = ''
        try {
          code = (await api.anfrage('sso_verknuepfen_code', '', {})).code
        } catch (fehler) {
          popup?.close()
          this.fehler = fehler.message
          return
        }
        if (!popup) {
          location.href = this.link(id, false, code)
          return
        }
        popup.location.href = this.link(id, true, code)
      }
      this.popup = popup
      this.popupOffen = true
      clearInterval(this.pruefen)
      this.pruefen = setInterval(() => {
        if (!this.popup || this.popup.closed) {
          this.popupOffen = false
          clearInterval(this.pruefen)
        }
      }, 500)
    },
    popupZeigen() {
      this.popup?.focus()
    },
    // Rückmeldung aus dem Popup: Zugang bzw. Fehlermeldung in diesem Fenster öffnen (nur von derselben Adresse)
    angemeldet(event) {
      if (event.origin !== location.origin || typeof event.data?.ormeetSso !== 'string') return
      const ziel = new URL(event.data.ormeetSso, location.href)
      if (ziel.origin !== location.origin) return
      this.popupOffen = false
      const nurAnker = ziel.pathname === location.pathname && ziel.search === location.search
      location.replace(ziel.href)
      if (nurAnker) location.reload() // nur der #-Teil ändert sich: neu laden, damit der neue Zugang gilt
    },
  },
}
