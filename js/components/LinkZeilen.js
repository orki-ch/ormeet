import { neuerKey } from '../utils/keys.js'
import { EINZELRECHTE } from '../utils/rechte.js'
import RechteSchalter from './RechteSchalter.js'
import { bestaetigen } from '../utils/dialog.js'

const STUFEN = { lesen: 'Lesen', alles: 'Alles' }

// Zusätzliche allgemeine Links eines Dokuments (Terminfindung / Vorprotokoll / Protokoll), beliebig viele.
// Pro Link: nur lesen, alles bearbeiten oder Einzelrechte; kopieren, erneuern, löschen. Liegen in sitzung.links.
export default {
  name: 'LinkZeilen',
  components: { RechteSchalter },
  props: {
    sitzung: { type: Object, required: true },
    dokument: { type: String, required: true },
  },
  template: `
    <div class="teilen link-zeilen">
      <div class="teilen-liste">
        <div v-for="l in links" :key="l.id" class="teilen-zeile">
          <span class="avatar hell">∞</span>
          <span class="text">
            <input v-model.trim="l.name" class="nahtlos titel" placeholder="Bezeichnung" />
            <span class="leise small">Allgemeiner Link · {{ beschreibung(l) }}</span>
          </span>
          <RechteSchalter :stufe="l.stufe" :stufen="STUFEN" :rechte="l.rechte" :einzelrechte="EINZELRECHTE[dokument]" @stufe="setzen(l, $event, [])" @rechte="setzen(l, 'individuell', $event)" @zuruecksetzen="setzen(l, 'lesen', [])">
            <button type="button" class="menu-item" @click="kopieren(l)">{{ kopiert === l.id ? 'Kopiert ✓' : 'Link kopieren' }}</button>
            <button type="button" class="menu-item" @click="erneuern(l)">Link erneuern</button>
            <button type="button" class="menu-item menu-item-danger" @click="loeschen(l)">Link löschen</button>
          </RechteSchalter>
        </div>
      </div>
      <form class="row mt-2" @submit.prevent="hinzufuegen">
        <input v-model.trim="neuerName" class="input grow" placeholder="Bezeichnung für einen weiteren allgemeinen Link …" required />
        <button class="btn">+ Link</button>
      </form>
    </div>
  `,
  data() {
    return { neuerName: '', kopiert: '', STUFEN, EINZELRECHTE }
  },
  computed: {
    links() {
      return (this.sitzung.links || []).filter((l) => l.dokument === this.dokument)
    },
  },
  methods: {
    beschreibung(l) {
      if (l.stufe === 'alles') return 'darf alles bearbeiten'
      if (l.stufe === 'lesen') return 'nur ansehen'
      return l.rechte.map((r) => EINZELRECHTE[this.dokument][r]).join(', ') || 'nur ansehen'
    },
    setzen(l, stufe, rechte) {
      l.stufe = stufe
      l.rechte = rechte
    },
    hinzufuegen() {
      this.sitzung.links ??= []
      this.sitzung.links.push({ id: crypto.randomUUID(), key: neuerKey(), name: this.neuerName, dokument: this.dokument, stufe: 'lesen', rechte: [], ablauf: '' })
      this.neuerName = ''
    },
    url(l) {
      return location.href.split('#')[0] + '#/link/' + l.key
    },
    kopieren(l) {
      navigator.clipboard.writeText(this.url(l))
      this.kopiert = l.id
      setTimeout(() => (this.kopiert = ''), 2000)
    },
    async erneuern(l) {
      if (await bestaetigen(`Link «${l.name}» erneuern? Der bisherige Link wird sofort ungültig.`)) l.key = neuerKey()
    },
    async loeschen(l) {
      if (await bestaetigen(`Link «${l.name}» löschen? Wer ihn hat, kommt danach nicht mehr hinein.`, { gefahr: true })) this.sitzung.links = this.sitzung.links.filter((x) => x.id !== l.id)
    },
  },
}
