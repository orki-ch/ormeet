import { api } from '../api.js'
import { sync } from '../stores/sync.js'
import { gemerkteNamen, namenVergessen } from './KontoKarte.js'
import Modal from './Modal.js'

const EINGETRAGEN_KEY = 'ormeet-eingetragen' // allgemeiner Link -> eigener Link, unter dem man sich in diesem Browser eingetragen hat

function eingetragen() {
  try {
    return JSON.parse(localStorage.getItem(EINGETRAGEN_KEY) || '{}')
  } catch {
    return {}
  }
}

// Allgemeiner Link: Wer ihn öffnet, gibt zuerst Vor- und Nachnamen und E-Mail an (lässt sich nicht schliessen) und
// erhält einen eigenen Link – die Adresse wechselt sofort, er öffnet die Sitzung auch auf einem anderen Gerät mit diesen Angaben.
// Ein Konto entsteht erst, wenn die Person es danach mit einem Klick anlegt.
export default {
  name: 'EintragDialog',
  components: { Modal },
  template: `
    <Modal v-if="bereit" titel="Wer bist du?">
      <form id="formular-eintrag" class="stack" @submit.prevent="senden">
        <p class="hint">Bitte trage deinen Namen und deine E-Mail-Adresse ein, damit deine Angaben dir zugeordnet sind. Danach erhältst du einen eigenen Link: Er öffnet diese Sitzung auch auf einem anderen Gerät mit deinen Angaben.</p>
        <div class="grid-2">
          <div><span class="label">Vorname</span><input v-model.trim="form.vorname" class="input" required autocomplete="given-name" autofocus /></div>
          <div><span class="label">Nachname</span><input v-model.trim="form.nachname" class="input" required autocomplete="family-name" /></div>
        </div>
        <div><span class="label">E-Mail</span><input v-model.trim="form.email" class="input" type="email" required autocomplete="email" /></div>
        <p class="small muted">Name und E-Mail werden bei dieser Sitzung gespeichert und sind für die Personen sichtbar, die sie verwalten. Mehr dazu im <a href="#/datenschutz" target="_blank" rel="noopener">Datenschutz</a>.</p>
        <p v-if="fehler" class="small text-err">{{ fehler }}</p>
      </form>
      <template #fuss>
        <div class="row">
          <button form="formular-eintrag" class="btn btn-primary" :disabled="laeuft">Weiter</button>
        </div>
      </template>
    </Modal>
  `,
  data() {
    return { bereit: false, form: { vorname: '', nachname: '', email: '' }, fehler: '', laeuft: false }
  },
  async mounted() {
    // In diesem Browser schon eingetragen: direkt mit dem eigenen Link weiter, sofern er noch gilt
    const key = eingetragen()[api.token]
    const gueltig = key && (await fetch('api.php?aktion=laden', { headers: { 'X-Token': key } }).then((r) => r.ok).catch(() => false))
    if (gueltig) return this.weiter(key)
    this.bereit = true
  },
  methods: {
    async senden() {
      this.laeuft = true
      this.fehler = ''
      try {
        const { key } = await api.anfrage('link_eintragen', sync.zugriff.gremiumId, { ...this.form, namen: gemerkteNamen() })
        localStorage.setItem(EINGETRAGEN_KEY, JSON.stringify({ ...eingetragen(), [api.token]: key }))
        namenVergessen()
        this.weiter(key)
      } catch (fehler) {
        this.fehler = fehler.message
      }
      this.laeuft = false
    },
    weiter(key) {
      api.setToken(key)
      sync.zugriff = null
      this.$router.replace('/freigabe/' + key)
    },
  },
}
