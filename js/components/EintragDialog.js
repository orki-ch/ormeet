import { api } from '../api.js'
import { sync } from '../stores/sync.js'
import { gemerkteNamen, namenVergessen } from './KontoKarte.js'
import Modal from './Modal.js'
import Einwilligung from './Einwilligung.js'

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
  components: { Einwilligung, Modal },
  template: `
    <Modal v-if="bereit" titel="Wer bist du?">
      <form id="formular-eintrag" class="stack" @submit.prevent="senden">
        <p class="hint">Bitte trage deinen Namen ein, damit deine Angaben dir zugeordnet sind. Danach erhältst du einen eigenen Link: Er öffnet diese Sitzung auch auf einem anderen Gerät mit deinen Angaben.</p>
        <div class="grid-2">
          <div><span class="label">Vorname</span><input v-model.trim="form.vorname" class="input" required autocomplete="given-name" autofocus /></div>
          <div><span class="label">Nachname</span><input v-model.trim="form.nachname" class="input" required autocomplete="family-name" /></div>
        </div>
        <div>
          <span class="label">E-Mail (optional)</span>
          <input v-model.trim="form.email" class="input" type="email" autocomplete="email" />
          <p class="small leise mt-1">Mit E-Mail erhältst du Einladungen und Aktualisierungen zu dieser Sitzung automatisch – abbestellen kannst du sie jederzeit, mit einem Konto auch einzeln einstellen. Ohne E-Mail bewahre deinen eigenen Link gut auf.</p>
        </div>
        <p class="small muted">Deine Angaben werden bei dieser Sitzung gespeichert und sind für die Personen sichtbar, die sie verwalten.</p>
        <Einwilligung v-model="form.einwilligung" />
        <p v-if="fehler" class="small" :class="schonErfasst ? 'muted' : 'text-err'">{{ fehler }}</p>
        <p v-if="zugesandt" class="small text-ok">Ist diese Adresse bei uns erfasst, ist dein persönlicher Link unterwegs. Schau in dein Postfach (auch im Spam-Ordner).</p>
      </form>
      <template #fuss>
        <div v-if="schonErfasst" class="row">
          <button type="button" class="btn" @click="schonErfasst = false">Zurück</button>
          <button type="button" class="btn btn-primary ml-auto" :disabled="laeuft || zugesandt" @click="linkZusenden">Link per E-Mail senden</button>
        </div>
        <div v-else class="row">
          <button form="formular-eintrag" class="btn btn-primary" :disabled="laeuft">Weiter</button>
        </div>
      </template>
    </Modal>
  `,
  data() {
    return { bereit: false, form: { vorname: '', nachname: '', email: '', einwilligung: false }, fehler: '', laeuft: false, schonErfasst: false, zugesandt: false }
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
        this.schonErfasst = fehler.status === 409 // schon als Mitglied oder Gast erfasst: Link per E-Mail statt doppelt eintragen
        this.zugesandt = false
      }
      this.laeuft = false
    },
    async linkZusenden() {
      this.laeuft = true
      try {
        await api.anfrage('link_zusenden', sync.zugriff.gremiumId, { email: this.form.email })
        this.fehler = ''
        this.zugesandt = true
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
