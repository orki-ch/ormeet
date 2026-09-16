import { TYP_BADGE, TYP_LABELS } from '../utils/labels.js'
import { personenText } from '../utils/traktanden.js'

// Unterpunkte eines Traktandums als Baum über alle Ebenen (1.1, 1.1.1), nur Anzeige.
// pruefen(u): darf die Person diesen Unterpunkt selbst bearbeiten; geerbt: das Element darüber ist schon bearbeitbar.
// Selbst bearbeitbare Unterpunkte unter einem gesperrten Element erhalten die Rahmen-Klasse `klasse`.
// Slots: default { u, nr, typ, darf } für Inhalte unter dem Unterpunkt (Einträge im Protokoll),
// editor { u, nummer, index, liste } ersetzt den Unterpunkt mit der ID aktivId (Bearbeitung im Vorprotokoll).
export default {
  name: 'Unterpunkte',
  props: {
    liste: { type: Array, required: true },
    nummer: { type: String, required: true }, // Nummer des Elements darüber, z. B. «2» oder «2.1»
    elternTyp: { type: String, default: '' }, // von oben vorgegebener Typ der Einträge
    geerbt: { type: Boolean, default: false },
    pruefen: { type: Function, default: null },
    aktivId: { type: String, default: null },
    klasse: { type: String, default: 'bearbeitbar' },
  },
  emits: ['klick'],
  template: `
    <template v-for="(u, j) in liste" :key="u.id">
      <slot v-if="aktivId === u.id" name="editor" :u="u" :nummer="nummer" :index="j" :liste="liste"></slot>
      <div v-else :id="u.id" class="sub" :class="{ [klasse]: !geerbt && darf(u) }" @click.stop="$emit('klick', u, darf(u))">
        <div class="sub-kopf">
          <span class="nr">{{ nummer }}.{{ j + 1 }}</span>
          <h3>{{ u.titel }}</h3>
          <span v-if="!elternTyp && u.typ" class="badge" :class="TYP_BADGE[u.typ]">{{ TYP_LABELS[u.typ] }}</span>
          <span v-if="u.verantwortliche.length" class="ml-auto leise small">{{ personenText(u.verantwortliche) }}</span>
        </div>
        <p v-if="u.notiz" class="notiz pre">{{ u.notiz }}</p>
        <slot :u="u" :nr="nummer + '.' + (j + 1)" :typ="elternTyp || u.typ" :darf="darf(u)"></slot>
        <Unterpunkte v-if="u.untertraktanden?.length" :liste="u.untertraktanden" :nummer="nummer + '.' + (j + 1)" :eltern-typ="elternTyp || u.typ" :geerbt="darf(u)" :pruefen="pruefen" :aktiv-id="aktivId" :klasse="klasse" @klick="(k, d) => $emit('klick', k, d)">
          <template v-for="(_, name) in $slots" #[name]="scope"><slot :name="name" v-bind="scope"></slot></template>
        </Unterpunkte>
      </div>
    </template>
  `,
  data() {
    return { TYP_BADGE, TYP_LABELS }
  },
  methods: {
    personenText,
    darf(u) {
      return this.geerbt || (this.pruefen ? this.pruefen(u) : false)
    },
  },
}
