import { gremienStore } from '../stores/gremien.js'
import { bearbeitenMixin } from '../utils/bearbeiten.js'
import { ANTRAG_STATUS, PENDENZ_STATUS, TYP_BADGE, TYP_LABELS, formatDatum, stimmenText } from '../utils/labels.js'
import ThemenbereichSelect from './ThemenbereichSelect.js'
import PersonInput from './PersonInput.js'
import MenuDropdown from './MenuDropdown.js'

// Einträge (Information / Antrag / Pendenz) eines Traktandums oder Unterpunkts.
// Klick öffnet die Bearbeitung im selben Layout; Typ-Badge und Farbe nur, wenn der Typ nicht von oben vorgegeben ist.
export default {
  name: 'EintragListe',
  components: { MenuDropdown, PersonInput, ThemenbereichSelect },
  mixins: [bearbeitenMixin],
  props: {
    traktandumId: { type: String, required: true },
    themenbereichId: { type: String, default: '' }, // Vorgabe für neue Einträge
    eintraege: { type: Array, required: true }, // alle Einträge des Protokolls (wird direkt bearbeitet)
    gremium: { type: Object, required: true },
    personen: { type: Array, required: true },
    nurLesen: { type: Boolean, default: false },
    personId: { type: String, default: null }, // eigene Pendenzen bleiben im Status änderbar
    typ: { type: String, default: '' }, // vom Traktandum vorgegebener Typ: alle Einträge sind dann von diesem Typ
  },
  template: `
    <div>
      <!-- Vorschau und Bearbeitung im selben Layout: Titel und Inhalt werden direkt im Eintrag getippt -->
      <div v-for="e in eigene" :id="e.id" :key="e.id" class="eintrag" :class="[typ ? '' : 'typ-' + e.typ, { editing: aktiv === e.id, klickbar: aktiv !== e.id && !nurLesen }]" @click.capture="aktiv !== e.id && !nurLesen && oeffnen(e)">
        <div class="eintrag-zeile">
          <template v-if="aktiv === e.id">
            <select v-if="!typ" v-model="e.typ" class="btn-pille" title="Typ" @change="typGeaendert(e)">
              <option v-for="(label, wert) in TYP_LABELS" :key="wert" :value="wert">{{ label }}</option>
            </select>
            <input v-model.trim="e.titel" class="nahtlos titel grow" placeholder="Titel" />
            <span class="werkzeuge">
              <ThemenbereichSelect v-model="e.themenbereichId" :themenbereiche="gremium.themenbereiche" class="btn-pille" />
              <MenuDropdown>
                <button class="menu-item" @click="neuerThemenbereichOffen = !neuerThemenbereichOffen">Neuen Themenbereich anlegen</button>
                <button class="menu-item menu-item-danger" @click="eintraege.splice(eintraege.indexOf(e), 1); aktiv = null">Eintrag löschen</button>
              </MenuDropdown>
            </span>
          </template>
          <template v-else>
            <span v-if="!typ" class="badge" :class="TYP_BADGE[e.typ]">{{ TYP_LABELS[e.typ] }}</span>
            <span class="titel" :class="{ leer: !e.titel }">{{ e.titel || 'Ohne Titel' }}</span>
            <span class="leise">{{ meta(e) }}</span>
            <select v-if="nurLesen && eigenePendenz(e)" v-model="e.pendenzStatus" class="input klein w-sm" title="Status deiner Pendenz" @click.stop>
              <option v-for="(label, wert) in PENDENZ_STATUS" :key="wert" :value="wert">{{ label }}</option>
            </select>
          </template>
        </div>
        <form v-if="aktiv === e.id && neuerThemenbereichOffen" class="row mt-1" @submit.prevent="themenbereichErstellen(e)">
          <input v-model="neuerThemenbereich.farbe" type="color" class="farbe" />
          <input v-model.trim="neuerThemenbereich.name" class="input grow" placeholder="Name des neuen Themenbereichs" required />
          <button class="btn btn-primary">Anlegen</button>
        </form>
        <textarea v-if="aktiv === e.id" v-model.trim="e.inhalt" v-wachsen class="nahtlos notiz" rows="1" placeholder="Inhalt / Beschreibung …"></textarea>
        <p v-else-if="e.inhalt" class="notiz pre">{{ e.inhalt }}</p>
        <div v-if="aktiv === e.id" class="row mt-1">
          <template v-if="e.typ === 'antrag'">
            <select v-model="e.antragStatus" class="btn-pille" title="Beschluss – Vertagt: kommt als neuer Antrag ins nächste Vorprotokoll">
              <option v-for="(label, wert) in ANTRAG_STATUS" :key="wert" :value="wert">{{ label }}</option>
            </select>
            <span v-if="mitStimmen(e)" class="stimmen">
              <span class="dauer" title="Ja-Stimmen"><input v-model.number="e.stimmen.ja" type="number" min="0" class="input" placeholder="–" /> Ja</span>
              <span class="dauer" title="Nein-Stimmen"><input v-model.number="e.stimmen.nein" type="number" min="0" class="input" placeholder="–" /> Nein</span>
              <span class="dauer" title="Enthaltungen"><input v-model.number="e.stimmen.enthaltung" type="number" min="0" class="input" placeholder="–" /> Enth.</span>
            </span>
          </template>
          <template v-if="e.typ === 'pendenz'">
            <select v-model="e.pendenzStatus" class="btn-pille" title="Status">
              <option v-for="(label, wert) in PENDENZ_STATUS" :key="wert" :value="wert">{{ label }}</option>
            </select>
            <PersonInput v-model="e.zugewiesenAnName" v-model:person-id="e.zugewiesenAn" :personen="personen" class="w-md klein" placeholder="Zugewiesen an" />
            <input v-model="e.faelligBis" type="date" class="input klein w-sm" title="Bis wann" />
          </template>
          <button class="btn ml-auto" @click="schliessen">Fertig</button>
        </div>
      </div>

      <button v-if="!nurLesen" class="btn btn-ghost" style="margin-left: -0.65rem" @click="hinzufuegen">+ {{ typ ? TYP_LABELS[typ] : 'Eintrag' }}</button>
    </div>
  `,
  data() {
    return {
      neuerThemenbereichOffen: false,
      neuerThemenbereich: { name: '', farbe: '#b4c410' },
      TYP_LABELS,
      TYP_BADGE,
      ANTRAG_STATUS,
      PENDENZ_STATUS,
    }
  },
  computed: {
    eigene() {
      return this.eintraege.filter((e) => e.traktandumId === this.traktandumId)
    },
  },
  methods: {
    eigenePendenz(e) {
      return e.typ === 'pendenz' && this.personId && e.zugewiesenAn === this.personId
    },
    // Stimmen gibt es nur bei einem Entscheid
    mitStimmen(e) {
      return e.antragStatus === 'angenommen' || e.antragStatus === 'abgelehnt'
    },
    meta(e) {
      if (e.typ === 'antrag') return [ANTRAG_STATUS[e.antragStatus], stimmenText(e)].filter(Boolean).join(' · ')
      if (e.typ === 'pendenz') {
        return [PENDENZ_STATUS[e.pendenzStatus], e.zugewiesenAnName, e.faelligBis && 'bis ' + formatDatum(e.faelligBis)].filter(Boolean).join(' · ')
      }
      return ''
    },
    // Vorgegebener Typ gilt auch für ältere Einträge, sobald sie bearbeitet werden
    oeffnen(e) {
      if (this.typ && e.typ !== this.typ) {
        e.typ = this.typ
        this.typGeaendert(e)
      }
      this.aktiv = e.id
      this.$nextTick(() => document.getElementById(e.id)?.querySelector('.nahtlos')?.focus())
    },
    // Fertig / Escape: leere Einträge verschwinden wieder
    schliessen() {
      const e = this.eintraege.find((x) => x.id === this.aktiv)
      if (e && !e.titel && !e.inhalt) this.eintraege.splice(this.eintraege.indexOf(e), 1)
      this.aktiv = null
      this.neuerThemenbereichOffen = false
    },
    escape(event) {
      if (event.key === 'Escape' && this.aktiv) this.schliessen()
    },
    // Neuer Eintrag entsteht direkt im Bearbeitungsmodus
    hinzufuegen() {
      const eintrag = { id: crypto.randomUUID(), traktandumId: this.traktandumId, themenbereichId: this.themenbereichId, typ: this.typ || 'information', titel: '', inhalt: '' }
      this.typGeaendert(eintrag)
      this.eintraege.push(eintrag)
      this.oeffnen(eintrag)
    },
    // Statusfelder passend zum Typ sicherstellen
    typGeaendert(eintrag) {
      if (eintrag.typ === 'antrag') {
        eintrag.antragStatus ||= 'offen'
        eintrag.stimmen ||= { ja: null, nein: null, enthaltung: null }
        eintrag.vorherigerAntragId ??= null
      }
      if (eintrag.typ === 'pendenz' && !eintrag.pendenzStatus) {
        Object.assign(eintrag, { pendenzStatus: 'offen', zugewiesenAn: null, zugewiesenAnName: '', faelligBis: '' })
      }
    },
    themenbereichErstellen(eintrag) {
      const tb = gremienStore.fuegeThemenbereichHinzu(this.gremium.id, this.neuerThemenbereich.name, this.neuerThemenbereich.farbe)
      eintrag.themenbereichId = tb.id
      this.neuerThemenbereich.name = ''
      this.neuerThemenbereichOffen = false
    },
  },
}
