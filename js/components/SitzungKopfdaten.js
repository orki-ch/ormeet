import { bearbeitenMixin } from '../utils/bearbeiten.js'
import { formatDatum } from '../utils/labels.js'
import { personenText } from '../utils/traktanden.js'
import PersonenInput from './PersonenInput.js'

// Kopfdaten einer Sitzung: kompakte Vorschau, Klick öffnet die Bearbeitung (ausser bei nurLesen)
export default {
  name: 'SitzungKopfdaten',
  components: { PersonenInput },
  mixins: [bearbeitenMixin],
  props: {
    sitzung: { type: Object, required: true },
    personen: { type: Array, default: () => [] },
    nurLesen: { type: Boolean, default: false },
  },
  template: `
    <section v-if="aktiv" class="card editing stack">
      <div>
        <span class="label">Titel / Sitzungsgrund</span>
        <input v-model.trim="sitzung.titel" class="input" placeholder="z. B. OK-Sitzung" />
      </div>
      <div class="grid-3">
        <div><span class="label">Datum</span><input v-model="sitzung.datum" type="date" class="input" :disabled="terminOffen" /></div>
        <div><span class="label">Zeit</span><input v-model="sitzung.zeit" type="time" class="input" :disabled="terminOffen" /></div>
        <div><span class="label">Ort</span><input v-model.trim="sitzung.ort" class="input" /></div>
      </div>
      <p v-if="terminOffen" class="small muted">Der Termin wird über die Terminfindung festgelegt.</p>
      <div class="grid-2">
        <div><span class="label">Sitzungsleitung</span><PersonenInput v-model="sitzung.sitzungsleitung" :personen="personen" placeholder="Person(en)" /></div>
        <div><span class="label">Protokollführung</span><PersonenInput v-model="sitzung.protokollfuehrung" :personen="personen" placeholder="Person(en)" /></div>
      </div>
      <p class="small muted">Sitzungsleitung und Protokollführung haben vollen Zugriff auf Vorprotokoll und Protokoll dieser Sitzung.</p>
      <div><span class="label">Spezielles / Bemerkungen</span><input v-model.trim="sitzung.bemerkungen" class="input" /></div>
      <div class="right"><button class="btn" @click="aktiv = null">Fertig</button></div>
    </section>

    <section v-else class="card" :class="{ editierbar: !nurLesen }" @click="!nurLesen && (aktiv = 'kopf')">
      <div class="grid-3 small">
        <div><span class="label">Datum & Zeit</span>{{ formatDatum(sitzung.datum) }}<span v-if="sitzung.zeit">, {{ sitzung.zeit }}</span></div>
        <div><span class="label">Ort</span>{{ sitzung.ort || '–' }}</div>
        <div><span class="label">Sitzungsleitung</span>{{ personenText(sitzung.sitzungsleitung) || '–' }}</div>
        <div><span class="label">Protokollführung</span>{{ personenText(sitzung.protokollfuehrung) || '–' }}</div>
        <div class="span-alle"><span class="label">Spezielles / Bemerkungen</span>{{ sitzung.bemerkungen || '–' }}</div>
      </div>
    </section>
  `,
  computed: {
    terminOffen() {
      return this.sitzung.terminfindung?.status === 'offen'
    },
  },
  methods: { formatDatum, personenText },
}
