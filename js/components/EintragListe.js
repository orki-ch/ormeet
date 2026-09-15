import { gremienStore } from '../stores/gremien.js'
import { bearbeitenMixin } from '../utils/bearbeiten.js'
import { ANTRAG_STATUS, PENDENZ_STATUS, TYP_BADGE, TYP_LABELS, formatDatum, stimmenText } from '../utils/labels.js'
import ThemenbereichSelect from './ThemenbereichSelect.js'
import PersonInput from './PersonInput.js'

// Einträge (Information / Antrag / Pendenz) eines Traktandums oder Unterpunkts.
// Vorschau als formatierte Zeilen; Klick öffnet die Bearbeitung eines Eintrags.
export default {
  name: 'EintragListe',
  components: { PersonInput, ThemenbereichSelect },
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
      <div v-for="e in eigene" :key="e.id" class="eintrag" :class="'typ-' + e.typ">
        <!-- Bearbeitung -->
        <div v-if="aktiv === e.id" class="block-soft editing stack-sm">
          <div class="row">
            <span v-if="typ" class="badge" :class="TYP_BADGE[typ]" title="Typ ist im Vorprotokoll festgelegt">{{ TYP_LABELS[typ] }}</span>
            <select v-else v-model="e.typ" class="input w-sm" @change="typGeaendert(e)">
              <option v-for="(label, wert) in TYP_LABELS" :key="wert" :value="wert">{{ label }}</option>
            </select>
            <input v-model.trim="e.titel" class="input grow" placeholder="Titel" />
            <ThemenbereichSelect v-model="e.themenbereichId" :themenbereiche="gremium.themenbereiche" class="w-md" />
            <button class="btn btn-ghost btn-icon" title="Neuen Themenbereich anlegen" @click="neuerThemenbereichOffen = !neuerThemenbereichOffen">+</button>
          </div>
          <form v-if="neuerThemenbereichOffen" class="row" @submit.prevent="themenbereichErstellen(e)">
            <input v-model="neuerThemenbereich.farbe" type="color" class="farbe" />
            <input v-model.trim="neuerThemenbereich.name" class="input grow" placeholder="Name des neuen Themenbereichs" required />
            <button class="btn btn-primary">Anlegen</button>
          </form>
          <textarea v-model.trim="e.inhalt" v-wachsen class="input" rows="2" placeholder="Inhalt / Beschreibung (mehrzeilig)"></textarea>
          <div class="row">
            <template v-if="e.typ === 'antrag'">
              <select v-model="e.antragStatus" class="input w-sm" title="Vertagt: kommt als neuer Antrag ins nächste Vorprotokoll">
                <option v-for="(label, wert) in ANTRAG_STATUS" :key="wert" :value="wert">{{ label }}</option>
              </select>
              <span class="stimmen">
                <span class="dauer" title="Ja-Stimmen"><input v-model.number="e.stimmen.ja" type="number" min="0" class="input" placeholder="–" /> Ja</span>
                <span class="dauer" title="Nein-Stimmen"><input v-model.number="e.stimmen.nein" type="number" min="0" class="input" placeholder="–" /> Nein</span>
                <span class="dauer" title="Enthaltungen"><input v-model.number="e.stimmen.enthaltung" type="number" min="0" class="input" placeholder="–" /> Enth.</span>
              </span>
            </template>
            <template v-if="e.typ === 'pendenz'">
              <select v-model="e.pendenzStatus" class="input w-sm">
                <option v-for="(label, wert) in PENDENZ_STATUS" :key="wert" :value="wert">{{ label }}</option>
              </select>
              <PersonInput v-model="e.zugewiesenAnName" v-model:person-id="e.zugewiesenAn" :personen="personen" class="w-md" placeholder="Zugewiesen an" />
              <input v-model="e.faelligBis" type="date" class="input w-sm" title="Bis wann" />
            </template>
            <span class="ml-auto row-nowrap">
              <button class="btn btn-danger" @click="eintraege.splice(eintraege.indexOf(e), 1); aktiv = null">Löschen</button>
              <button class="btn" @click="aktiv = null">Fertig</button>
            </span>
          </div>
        </div>

        <!-- Vorschau -->
        <div v-else :class="nurLesen ? '' : 'vorschau'" @click="!nurLesen && oeffnen(e)">
          <div class="eintrag-zeile">
            <span class="badge" :class="TYP_BADGE[e.typ]">{{ TYP_LABELS[e.typ] }}</span>
            <span class="titel" :class="{ leer: !e.titel }">{{ e.titel || 'Ohne Titel' }}</span>
            <span class="leise">{{ meta(e) }}</span>
            <select v-if="nurLesen && eigenePendenz(e)" v-model="e.pendenzStatus" class="input w-sm" style="min-height: 2rem; padding-top: 0.2rem; padding-bottom: 0.2rem" title="Status deiner Pendenz" @click.stop>
              <option v-for="(label, wert) in PENDENZ_STATUS" :key="wert" :value="wert">{{ label }}</option>
            </select>
          </div>
          <p v-if="e.inhalt" class="notiz pre">{{ e.inhalt }}</p>
        </div>
      </div>

      <form v-if="formularOffen && !nurLesen" class="row mt-1" @submit.prevent="hinzufuegen">
        <span v-if="typ" class="badge" :class="TYP_BADGE[typ]">{{ TYP_LABELS[typ] }}</span>
        <select v-else v-model="neu.typ" class="input w-sm">
          <option v-for="(label, wert) in TYP_LABELS" :key="wert" :value="wert">{{ label }}</option>
        </select>
        <input ref="titel" v-model.trim="neu.titel" class="input grow" placeholder="Titel … (Enter)" required />
        <button class="btn btn-primary btn-icon">+</button>
        <button type="button" class="btn btn-ghost btn-icon" @click="formularOffen = false">✕</button>
      </form>
      <button v-else-if="!nurLesen" class="btn btn-ghost" style="margin-left: -0.65rem" @click="formularOeffnen">+ {{ typ ? TYP_LABELS[typ] : 'Eintrag' }}</button>
    </div>
  `,
  data() {
    return {
      formularOffen: false,
      neu: { typ: 'information', titel: '' },
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
    },
    formularOeffnen() {
      this.formularOffen = true
      this.$nextTick(() => this.$refs.titel.focus())
    },
    hinzufuegen() {
      const eintrag = {
        id: crypto.randomUUID(),
        traktandumId: this.traktandumId,
        themenbereichId: this.themenbereichId,
        typ: this.typ || this.neu.typ,
        titel: this.neu.titel,
        inhalt: '',
      }
      this.typGeaendert(eintrag)
      this.eintraege.push(eintrag)
      this.neu.titel = ''
      // Anträge und Pendenzen brauchen meist noch Status / Person: direkt öffnen
      if (eintrag.typ !== 'information') this.aktiv = eintrag.id
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
