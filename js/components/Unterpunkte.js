import MenuDropdown from './MenuDropdown.js'
import PersonenInput from './PersonenInput.js'
import { TRAKTANDUM_TYP, TYP_BADGE, TYP_LABELS } from '../utils/labels.js'
import { MAX_TIEFE, istAntragPunkt, neuesUntertraktandum, personenText } from '../utils/traktanden.js'

// Unterpunkte eines Traktandums als Baum über alle Ebenen (1.1, 1.1.1). Anzeige und Bearbeitung im selben Layout:
// im Bearbeitungsmodus (bearbeiten = ganzer Baum, aktivId = ein einzelner Unterpunkt) werden Titel und Notiz
// direkt im Element getippt; Person, Typ und Rechte liegen in einem Pillen-Menü, Verschieben / Löschen / Unterpunkt anlegen im ⋯-Menü.
// pruefen(u): darf die Person diesen Unterpunkt selbst bearbeiten; geerbt: das Element darüber ist schon bearbeitbar.
// Selbst bearbeitbare Unterpunkte unter einem gesperrten Element erhalten die Rahmen-Klasse `klasse`.
// Slot default { u, nr, typ, darf }: Inhalte unter dem Unterpunkt (Einträge im Protokoll).
// imProtokoll: die Notiz eines Antrag-Punkts entfällt dort – sie ist beim Start zum Antrag geworden.
export default {
  name: 'Unterpunkte',
  components: { MenuDropdown, PersonenInput },
  props: {
    liste: { type: Array, required: true },
    nummer: { type: String, required: true }, // Nummer des Elements darüber, z. B. «2» oder «2.1»
    tiefe: { type: Number, default: 2 }, // Ebene der Einträge in `liste` (Traktandum = 1)
    elternTyp: { type: String, default: '' }, // von oben vorgegebener Typ der Einträge
    geerbt: { type: Boolean, default: false },
    pruefen: { type: Function, default: null },
    aktivId: { type: String, default: null },
    klasse: { type: String, default: 'bearbeitbar' },
    bearbeiten: { type: Boolean, default: false },
    personen: { type: Array, default: () => [] },
    bearbeiterAuswahl: { type: Array, default: () => [] },
    nurPerson: { type: Object, default: null },
    imProtokoll: { type: Boolean, default: false },
  },
  emits: ['klick', 'fertig'],
  template: `
    <div v-for="(u, j) in liste" :id="u.id" :key="u.id" class="sub" :class="[typKlasse(u), { [klasse]: !geerbt && darf(u) && !imEdit(u), editing: einzeln(u) }]" @click.stop="!imEdit(u) && $emit('klick', u, darf(u))">
      <div class="sub-kopf">
        <span class="nr">{{ nr(j) }}</span>
        <template v-if="imEdit(u)">
          <input v-model.trim="u.titel" class="nahtlos h3 grow" placeholder="Unterpunkt" />
          <span class="werkzeuge">
            <MenuDropdown :text="'Personen: ' + (personenText(u.verantwortliche) || 'wie darüber')" panel>
              <label class="stack-xs"><span class="label">Verantwortlich</span><PersonenInput v-model="u.verantwortliche" :personen="personen" placeholder="Sonst wie darüber" :nur-eigene="nurPerson?.id" /></label>
              <label v-if="!nurPerson" class="stack-xs"><span class="label">Dürfen zusätzlich bearbeiten</span><PersonenInput v-model="u.bearbeiter" :personen="bearbeiterAuswahl" placeholder="Personen, Rollen oder Gruppen" nur-liste /></label>
            </MenuDropdown>
            <!-- Nur ein Feld: direkt als Auswahl im Pillen-Look -->
            <select v-if="!elternTyp" v-model="u.typ" class="btn-pille" title="Typ der Einträge – gilt im Protokoll für alles unter diesem Unterpunkt">
              <option v-for="(label, wert) in TRAKTANDUM_TYP" :key="wert" :value="wert">{{ label }}</option>
            </select>
            <MenuDropdown>
              <button v-if="!einzeln(u)" class="menu-item" :disabled="j === 0" @click="verschieben(j, -1)">↑ Nach oben</button>
              <button v-if="!einzeln(u)" class="menu-item" :disabled="j === liste.length - 1" @click="verschieben(j, 1)">↓ Nach unten</button>
              <button v-if="tiefe < MAX_TIEFE" class="menu-item" @click="u.untertraktanden.push(neuesUntertraktandum(''))">+ Unterpunkt zu {{ nr(j) }}</button>
              <button v-if="!einzeln(u)" class="menu-item menu-item-danger" @click="liste.splice(j, 1)">Unterpunkt löschen</button>
            </MenuDropdown>
          </span>
        </template>
        <template v-else>
          <h3>{{ u.titel }}</h3>
          <span v-if="!elternTyp && u.typ" class="badge" :class="TYP_BADGE[u.typ]">{{ TYP_LABELS[u.typ] }}</span>
          <span v-if="u.verantwortliche.length" class="ml-auto leise small">{{ personenText(u.verantwortliche) }}</span>
        </template>
      </div>
      <textarea v-if="imEdit(u)" v-model.trim="u.notiz" v-wachsen class="nahtlos notiz" rows="1" :placeholder="istAntragPunkt(u, elternTyp) ? 'Antragstext …' : 'Notiz …'"></textarea>
      <p v-else-if="u.notiz && !(imProtokoll && istAntragPunkt(u, elternTyp))" class="notiz pre">{{ u.notiz }}</p>
      <slot :u="u" :nr="nr(j)" :typ="elternTyp || u.typ" :darf="darf(u)"></slot>
      <Unterpunkte v-if="u.untertraktanden?.length" :liste="u.untertraktanden" :nummer="nr(j)" :tiefe="tiefe + 1" :eltern-typ="elternTyp || u.typ" :geerbt="darf(u)" :pruefen="pruefen" :aktiv-id="aktivId" :klasse="klasse" :bearbeiten="imEdit(u)" :personen="personen" :bearbeiter-auswahl="bearbeiterAuswahl" :nur-person="nurPerson" :im-protokoll="imProtokoll" @klick="(k, d) => $emit('klick', k, d)" @fertig="$emit('fertig')">
        <template v-for="(_, name) in $slots" #[name]="scope"><slot :name="name" v-bind="scope"></slot></template>
      </Unterpunkte>
      <div v-if="einzeln(u)" class="row mt-1"><button class="btn ml-auto" @click.stop="$emit('fertig')">Fertig</button></div>
    </div>
  `,
  data() {
    return { TRAKTANDUM_TYP, TYP_BADGE, TYP_LABELS, MAX_TIEFE }
  },
  methods: {
    personenText,
    neuesUntertraktandum,
    istAntragPunkt,
    nr(j) {
      return `${this.nummer}.${j + 1}`
    },
    darf(u) {
      return this.geerbt || (this.pruefen ? this.pruefen(u) : false)
    },
    imEdit(u) {
      return this.bearbeiten || this.aktivId === u.id
    },
    // Einzeln bearbeiteter Unterpunkt (Person mit Rechten nur darauf): kein Verschieben, kein Löschen, eigener «Fertig»
    einzeln(u) {
      return !this.bearbeiten && this.aktivId === u.id
    },
    typKlasse(u) {
      const typ = this.elternTyp || u.typ
      return typ ? 'typ-' + typ : ''
    },
    verschieben(j, richtung) {
      const k = j + richtung
      ;[this.liste[j], this.liste[k]] = [this.liste[k], this.liste[j]]
    },
  },
}
