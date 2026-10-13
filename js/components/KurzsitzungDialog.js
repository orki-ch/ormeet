import { gremienStore } from '../stores/gremien.js'
import { sitzungenStore } from '../stores/sitzungen.js'
import { personIdIm, uebersichtsKonto } from '../utils/rechte.js'
import { neuerKey } from '../utils/keys.js'
import Modal from './Modal.js'

// Nächste volle Viertelstunde ab jetzt: { datum: 'YYYY-MM-DD', zeit: 'HH:MM' } (für spontane Besprechungen)
function naechsteViertelstunde() {
  const d = new Date()
  d.setSeconds(0, 0)
  d.setMinutes(Math.floor(d.getMinutes() / 15) * 15 + 15)
  const zwei = (n) => String(n).padStart(2, '0')
  return { datum: `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`, zeit: `${zwei(d.getHours())}:${zwei(d.getMinutes())}` }
}

// Neue Kurzsitzung: mit Gremium (gremiumId) oder ohne – dann entsteht ein eigener, versteckter Behälter,
// dessen Mitglieder die Eingeladenen sind. Leitung und Protokollführung ist die anlegende Person.
export default {
  name: 'KurzsitzungDialog',
  components: { Modal },
  props: {
    gremiumId: { type: String, default: '' },
  },
  emits: ['schliessen'],
  template: `
    <Modal titel="Neue Kurzsitzung" @schliessen="$emit('schliessen')">
      <form class="stack" @submit.prevent="erstellen">
        <div><span class="label">Titel</span><input v-model.trim="titel" class="input" placeholder="Worum geht es?" required autofocus /></div>
        <div class="row" style="gap: 0.5rem 1.5rem">
          <label class="check small"><input v-model="terminfindung" type="radio" :value="false" /> Jetzt bzw. Termin steht fest</label>
          <label class="check small"><input v-model="terminfindung" type="radio" :value="true" /> Termin per Abstimmung finden</label>
        </div>
        <div v-if="!terminfindung" class="grid-2">
          <div><span class="label">Datum</span><input v-model="datum" class="input" type="date" required /></div>
          <div><span class="label">Zeit</span><input v-model="zeit" class="input" type="time" /></div>
        </div>
        <div><span class="label">Ort</span><input v-model.trim="ort" class="input" /></div>
        <div v-if="gremium && gremium.mitglieder.length">
          <span class="label">Teilnehmende</span>
          <div class="row" style="gap: 0.25rem 1.5rem">
            <label v-for="m in gremium.mitglieder" :key="m.id" class="check small"><input v-model="teilnehmende" type="checkbox" :value="m.id" /> {{ m.name }}</label>
          </div>
        </div>
        <div class="row">
          <button type="button" class="btn" @click="$emit('schliessen')">Abbrechen</button>
          <button class="btn btn-primary ml-auto">{{ terminfindung ? 'Zur Terminfindung' : 'Kurzsitzung starten' }}</button>
        </div>
      </form>
    </Modal>
  `,
  data() {
    const jetzt = naechsteViertelstunde()
    return { titel: '', terminfindung: false, datum: jetzt.datum, zeit: jetzt.zeit, ort: '', teilnehmende: [] }
  },
  computed: {
    gremium() {
      return this.gremiumId ? gremienStore.byId(this.gremiumId) : null
    },
    // Die anlegende Person: Mitglied des Gremiums oder das eigene Konto
    ich() {
      const konto = uebersichtsKonto()
      if (this.gremium) {
        const id = personIdIm(this.gremium.id) || konto?.gremien.find((g) => g.gremiumId === this.gremium.id)?.personId
        const mitglied = this.gremium.mitglieder.find((m) => m.id === id)
        if (mitglied) return { id: mitglied.id, name: mitglied.name }
      }
      return konto ? { id: null, name: konto.name, email: konto.email } : null
    },
  },
  created() {
    if (this.ich?.id) this.teilnehmende = [this.ich.id]
  },
  methods: {
    erstellen() {
      const gremium = this.gremium || this.behaelter()
      const leitung = this.ich ? [{ id: this.ich.id, name: this.ich.name }] : []
      if (!this.gremium && this.ich) {
        // Ohne Gremium: die anlegende Person ist die erste Teilnehmende
        const mitglied = { id: crypto.randomUUID(), name: this.ich.name, email: this.ich.email || '', rolleId: gremium.rollen.find((r) => !r.typ)?.id || null, hatStimmrecht: true, benutzerId: null, zugangsKey: neuerKey() }
        gremium.mitglieder.push(mitglied)
        leitung[0].id = mitglied.id
        this.teilnehmende = [mitglied.id]
      }
      const sitzung = sitzungenStore.erstelleKurzsitzung(gremium.id, {
        titel: this.titel,
        datum: this.datum,
        zeit: this.zeit,
        ort: this.ort,
        terminfindung: this.terminfindung,
        teilnehmende: this.teilnehmende,
        leitung,
      })
      this.$emit('schliessen')
      this.$router.push('/sitzung/' + sitzung.id + (this.terminfindung ? '/terminfindung' : '/protokoll'))
    },
    // Versteckter Behälter einer Kurzsitzung ohne Gremium; gehört dem eigenen Konto
    behaelter() {
      const gremium = gremienStore.erstelle(this.titel, '', true)
      gremium.fusstext = ''
      const konto = uebersichtsKonto()
      if (konto) {
        // Bis zum nächsten Abgleich gilt das Konto lokal als Eigentümer
        gremium.eigentuemerId = konto.benutzerId
        konto.gremien.push({ gremiumId: gremium.id, name: gremium.name, rolle: 'eigentuemer', kurz: true })
      }
      return gremium
    },
  },
}
