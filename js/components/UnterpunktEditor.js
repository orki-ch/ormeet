import PersonenInput from './PersonenInput.js'
import { TRAKTANDUM_TYP } from '../utils/labels.js'
import { MAX_TIEFE, neuesUntertraktandum } from '../utils/traktanden.js'

// Bearbeitung der Unterpunkte (alle Ebenen) direkt im übergebenen Array. Pro Unterpunkt eine Zeile mit Titel und Typ;
// Notiz, Personen, Rechte und weitere Unterpunkte liegen hinter «⋯» (offen, sobald etwas eingetragen ist).
// fest: einzelner Unterpunkt einer Person – kein Verschieben, kein Löschen.
export default {
  name: 'UnterpunktEditor',
  components: { PersonenInput },
  props: {
    liste: { type: Array, required: true },
    nummer: { type: String, required: true }, // Nummer des Elements darüber
    start: { type: Number, default: 0 }, // Index des ersten Eintrags in der ganzen Liste (einzelner Unterpunkt)
    tiefe: { type: Number, default: 2 }, // Ebene der Einträge in `liste` (Traktandum = 1)
    elternTyp: { type: String, default: '' },
    personen: { type: Array, required: true },
    bearbeiterAuswahl: { type: Array, required: true },
    nurPerson: { type: Object, default: null },
    fest: { type: Boolean, default: false },
  },
  template: `
    <div v-for="(u, j) in liste" :key="u.id" class="sub stack-sm">
      <div class="row">
        <span class="nr mono small leise">{{ nr(j) }}</span>
        <input v-model.trim="u.titel" class="input grow" placeholder="Unterpunkt" />
        <select v-if="!elternTyp" v-model="u.typ" class="input w-sm" title="Typ der Einträge im Protokoll">
          <option v-for="(label, wert) in TRAKTANDUM_TYP" :key="wert" :value="wert">{{ label }}</option>
        </select>
        <button type="button" class="btn btn-ghost btn-icon" :class="{ aktiv: offen(u) }" title="Notiz, Personen, Rechte, Unterpunkte" @click="auf[u.id] = !offen(u)">⋯</button>
        <span v-if="!fest" class="row-nowrap">
          <button type="button" class="btn btn-ghost btn-icon" :disabled="j === 0" title="Nach oben" @click="verschieben(j, -1)">↑</button>
          <button type="button" class="btn btn-ghost btn-icon" :disabled="j === liste.length - 1" title="Nach unten" @click="verschieben(j, 1)">↓</button>
          <button type="button" class="btn btn-ghost btn-icon text-err" title="Löschen" @click="liste.splice(j, 1)">✕</button>
        </span>
      </div>
      <template v-if="offen(u)">
        <textarea v-model.trim="u.notiz" v-wachsen class="input" rows="1" placeholder="Notiz (optional)"></textarea>
        <div class="grid-2">
          <PersonenInput v-model="u.verantwortliche" :personen="personen" placeholder="Verantwortlich (sonst wie darüber)" :nur-eigene="nurPerson?.id" />
          <PersonenInput v-model="u.bearbeiter" :personen="bearbeiterAuswahl" placeholder="Dürfen zusätzlich bearbeiten" nur-liste :disabled="!!nurPerson" />
        </div>
      </template>
      <UnterpunktEditor v-if="u.untertraktanden.length" :liste="u.untertraktanden" :nummer="nr(j)" :tiefe="tiefe + 1" :eltern-typ="elternTyp || u.typ" :personen="personen" :bearbeiter-auswahl="bearbeiterAuswahl" :nur-person="nurPerson" />
      <div v-if="(offen(u) || u.untertraktanden.length) && tiefe < MAX_TIEFE"><button type="button" class="btn btn-ghost" @click="u.untertraktanden.push(neuesUntertraktandum(''))">+ Unterpunkt zu {{ nr(j) }}</button></div>
    </div>
  `,
  data() {
    return { auf: {}, TRAKTANDUM_TYP, MAX_TIEFE }
  },
  methods: {
    neuesUntertraktandum,
    nr(j) {
      return `${this.nummer}.${this.start + j + 1}`
    },
    // Offen, wenn bewusst aufgeklappt oder wenn schon etwas drinsteht
    offen(u) {
      return this.auf[u.id] ?? Boolean(u.notiz || u.verantwortliche.length || u.bearbeiter.length)
    },
    verschieben(j, richtung) {
      const k = j + richtung
      ;[this.liste[j], this.liste[k]] = [this.liste[k], this.liste[j]]
    },
  },
}
