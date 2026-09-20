import PersonInput from './PersonInput.js'
import { PENDENZ_STATUS, formatDatum } from '../utils/labels.js'

// Übertragene Pendenz aus einer früheren Sitzung im Protokoll: Status, Person und Frist werden direkt am Original
// nachgeführt – der Block steht beim Traktandum oder Unterpunkt, der die Pendenz übernommen hat (pendenzId).
export default {
  name: 'PendenzUebertragen',
  components: { PersonInput },
  props: {
    eintrag: { type: Object, required: true }, // Original-Eintrag (wird direkt bearbeitet)
    sitzung: { type: Object, required: true }, // Herkunfts-Sitzung
    personen: { type: Array, required: true },
    darf: { type: Boolean, default: false },
  },
  template: `
    <div class="pendenz-uebertragen stack-sm">
      <p>
        <span class="badge gelb" style="margin-right: 0.25rem">Übertragene Pendenz</span>
        <strong>{{ eintrag.titel }}</strong>
        <span class="muted">(aus Sitzung vom {{ formatDatum(sitzung.datum) }})</span>
      </p>
      <p v-if="eintrag.inhalt" class="muted">{{ eintrag.inhalt }}</p>
      <div class="row">
        <select v-model="eintrag.pendenzStatus" class="btn-pille" title="Status" :disabled="!darf">
          <option v-for="(label, wert) in PENDENZ_STATUS" :key="wert" :value="wert">{{ label }}</option>
        </select>
        <PersonInput v-model="eintrag.zugewiesenAnName" v-model:person-id="eintrag.zugewiesenAn" :personen="personen" class="w-md klein" placeholder="Zugewiesen an" :disabled="!darf" />
        <input v-model="eintrag.faelligBis" type="date" class="input klein w-sm" title="Bis wann" :disabled="!darf" />
      </div>
    </div>
  `,
  data() {
    return { PENDENZ_STATUS }
  },
  methods: { formatDatum },
}
