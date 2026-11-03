import { gremienStore } from '../stores/gremien.js'
import { sitzungenStore } from '../stores/sitzungen.js'
import { personIdIm } from '../utils/rechte.js'
import Modal from './Modal.js'

// Neue Sitzung eintragen (Gremium-Seite oder persönliche Übersicht). Die eintragende Person wird festgehalten:
// sie bearbeitet die Terminfindung und darf die Sitzung wieder löschen, solange es kein Protokoll gibt.
export default {
  name: 'SitzungDialog',
  components: { Modal },
  props: {
    gremiumId: { type: String, required: true },
  },
  emits: ['schliessen'],
  template: `
    <Modal titel="Neue Sitzung" @schliessen="$emit('schliessen')">
      <form id="formular-sitzung" class="stack" @submit.prevent="erfassen">
        <div class="row" style="gap: 0.5rem 1.5rem">
          <label class="check small"><input v-model="neu.terminfindung" type="radio" :value="false" /> Termin steht fest</label>
          <label class="check small"><input v-model="neu.terminfindung" type="radio" :value="true" /> Termin per Abstimmung finden</label>
        </div>
        <div v-if="!neu.terminfindung" class="grid-2">
          <div><span class="label">Datum</span><input v-model="neu.datum" class="input" type="date" required autofocus /></div>
          <div><span class="label">Zeit</span><input v-model="neu.zeit" class="input" type="time" /></div>
        </div>
        <p v-else class="small muted">Nach dem Erfassen legst du Terminvorschläge an; die Beteiligten stimmen über ihre Links ab. Das Vorprotokoll kann trotzdem schon vorbereitet werden.</p>
        <div><span class="label">Ort</span><input v-model.trim="neu.ort" class="input" /></div>
        <div>
          <span class="label">Vorprotokoll-Vorlage</span>
          <select v-model="neu.vorlageId" class="input">
            <option value="">Leeres Vorprotokoll</option>
            <option v-for="v in gremium.vorlagen" :key="v.id" :value="v.id">{{ v.name }}</option>
          </select>
        </div>
      </form>
      <template #fuss>
        <div class="row">
          <button type="button" class="btn" @click="$emit('schliessen')">Abbrechen</button>
          <button form="formular-sitzung" class="btn btn-primary">{{ neu.terminfindung ? 'Weiter zur Terminfindung' : 'Sitzung erfassen' }}</button>
        </div>
      </template>
    </Modal>
  `,
  data() {
    return { neu: { datum: '', zeit: '', ort: '', vorlageId: '', terminfindung: false } }
  },
  computed: {
    gremium() {
      return gremienStore.byId(this.gremiumId)
    },
  },
  methods: {
    erfassen() {
      const sitzung = sitzungenStore.erstelleSitzung(this.gremiumId, { ...this.neu, erstelltVon: personIdIm(this.gremiumId) })
      this.$emit('schliessen')
      if (this.neu.terminfindung) this.$router.push('/sitzung/' + sitzung.id + '/terminfindung')
    },
  },
}
