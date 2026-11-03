import { bearbeitenMixin } from '../utils/bearbeiten.js'
import { formatDatum } from '../utils/labels.js'
import { personenText } from '../utils/traktanden.js'
import PersonenInput from './PersonenInput.js'
import InfoKnopf from './InfoKnopf.js'

// Kopfdaten einer Sitzung: kompakte Vorschau, Klick öffnet die Bearbeitung (ausser bei nurLesen). Die Aufgaben
// (Sitzungsleitung, Protokollführung, auch als Vertretung) bestimmt nur, wer darf (aufgabenBestimmen). Mit anwesend
// (IDs) erscheint ein Hinweis, wenn für eine Aufgabe niemand anwesend ist.
export default {
  name: 'SitzungKopfdaten',
  components: { InfoKnopf, PersonenInput },
  mixins: [bearbeitenMixin],
  props: {
    sitzung: { type: Object, required: true },
    personen: { type: Array, default: () => [] },
    nurLesen: { type: Boolean, default: false },
    aufgabenBestimmen: { type: Boolean, default: false },
    anwesend: { type: Array, default: null },
  },
  template: `
    <div v-if="fehlend.length" class="banner">
      <div class="grow"><strong>Niemand mit der Aufgabe {{ fehlend.join(' bzw. ') }} ist anwesend.</strong> <span class="muted small">{{ aufgabenBestimmen ? 'Bitte in den Kopfdaten eine Vertretung bestimmen – spätestens beim Start der Sitzung.' : 'Die Vertretung bestimmt, wer die Sitzung eingetragen hat oder Zugriffe verwaltet.' }}</span></div>
    </div>
    <section v-if="aktiv" class="card editing stack">
      <fieldset :disabled="nurLesen" class="stack">
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
      </fieldset>
      <fieldset :disabled="!aufgabenBestimmen" class="grid-2">
        <div><span class="label">Sitzungsleitung <InfoKnopf :titel="'Aufgabe Sitzungsleitung'" :punkte="AUFGABE_INFO" /></span><PersonenInput v-model="sitzung.sitzungsleitung" :personen="personen" placeholder="Person(en)" /></div>
        <div><span class="label">Protokollführung <InfoKnopf rechts :titel="'Aufgabe Protokollführung'" :punkte="AUFGABE_INFO" /></span><PersonenInput v-model="sitzung.protokollfuehrung" :personen="personen" placeholder="Person(en)" /></div>
      </fieldset>
      <fieldset :disabled="nurLesen">
        <span class="label">Spezielles / Bemerkungen</span><input v-model.trim="sitzung.bemerkungen" class="input" />
      </fieldset>
      <div class="right"><button class="btn" @click="aktiv = null">Fertig</button></div>
    </section>

    <section v-else class="card" :class="{ editierbar: bearbeitbar }" @click="bearbeitbar && (aktiv = 'kopf')">
      <div class="grid-3 small">
        <div><span class="label">Datum & Zeit</span>{{ formatDatum(sitzung.datum) }}<span v-if="sitzung.zeit">, {{ sitzung.zeit }}</span></div>
        <div><span class="label">Ort</span>{{ sitzung.ort || '–' }}</div>
        <div><span class="label">Sitzungsleitung</span>{{ personenText(sitzung.sitzungsleitung) || '–' }}</div>
        <div><span class="label">Protokollführung</span>{{ personenText(sitzung.protokollfuehrung) || '–' }}</div>
        <div class="span-alle"><span class="label">Spezielles / Bemerkungen</span>{{ sitzung.bemerkungen || '–' }}</div>
      </div>
    </section>
  `,
  data() {
    return {
      AUFGABE_INFO: [
        { titel: 'Rechte', text: 'Wer eine Aufgabe in dieser Sitzung hat, hat hier sämtliche Bearbeitungsrechte: Vor- und Protokoll, Start und Abschluss, Entscheide zu Änderungsanträgen – bis zur Genehmigung.' },
        { titel: 'Vorschlag', text: 'Übernommen aus den Aufgaben unter Mitglieder & Rollen. Fehlt jemand, hier eine Vertretung eintragen.' },
      ],
    }
  },
  computed: {
    bearbeitbar() {
      return !this.nurLesen || this.aufgabenBestimmen
    },
    // Aufgaben, für die niemand anwesend ist (nur mit Anwesenheitsliste)
    fehlend() {
      if (!this.anwesend || this.sitzung.kurz) return []
      const leer = (liste) => !liste.some((p) => this.anwesend.includes(p.id))
      return [leer(this.sitzung.sitzungsleitung) && 'Sitzungsleitung', leer(this.sitzung.protokollfuehrung) && 'Protokollführung'].filter(Boolean)
    },
    terminOffen() {
      return this.sitzung.terminfindung?.status === 'offen'
    },
  },
  methods: { formatDatum, personenText },
}
