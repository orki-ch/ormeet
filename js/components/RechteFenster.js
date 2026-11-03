import { gremienStore } from '../stores/gremien.js'
import { sitzungenStore } from '../stores/sitzungen.js'
import { EINZELRECHTE, freigabeRoh, freigabeStufe, standardStufe } from '../utils/rechte.js'
import { bestaetigen } from '../utils/dialog.js'
import Modal from './Modal.js'
import InfoKnopf from './InfoKnopf.js'

const MODI = { lesen: 'Lesen', bearbeiten: 'Bearbeiten' }
const ARTEN = { themenbereich: 'Themenbereich', person: 'Person', traktandum: 'Traktandum' }
const DOKUMENT = { terminfindung: 'Terminfindung', vorprotokoll: 'Vorprotokoll', protokoll: 'Protokoll' }

// Rechte einer Person (oder eines allgemeinen Links) auf Vorprotokoll und Protokoll einer Sitzung: pro Dokument die Stufe
// Lesen / Eigene / Individuell / Alles; bei «Individuell» Regeln (Lesen / Bearbeiten für einen Themenbereich, wo eine Person
// hinterlegt ist, oder ein Traktandum / Unterpunkt) und Einzelrechte. Mit Regeln sieht die Person nur, was sie abdecken
// (siehe api.php zuschnittSicht). Gespeichert in sitzung.freigaben[dokument][personId] und sitzung.zuschnitt[personId]
// bzw. link.stufe / link.rechte / link.zuschnitt. «Auf Rollenstandard zurücksetzen» entfernt alles Gesetzte.
export default {
  name: 'RechteFenster',
  components: { InfoKnopf, Modal },
  props: {
    sitzung: { type: Object, required: true },
    personId: { type: String, default: '' },
    link: { type: Object, default: null }, // allgemeiner Link (Vorprotokoll oder Protokoll), auch der Freigabe-Link
  },
  emits: ['schliessen'],
  template: `
    <Modal :titel="'Rechte – ' + name" @schliessen="$emit('schliessen')">
      <div class="stack rechte-fenster">
        <div class="stack-sm">
          <div v-for="dokument in dokumente" :key="dokument" class="row rolle-recht">
            <span class="grow">{{ sitzung.kurz && !link ? 'Protokoll' : DOKUMENT[dokument] }} <InfoKnopf v-if="dokument === dokumente[0]" titel="Stufen" :punkte="stufenInfo" /></span>
            <span class="schalter" :class="{ gesetzt: gesetzt(dokument) }">
              <button v-for="(label, s) in stufenFuer(dokument)" :key="s" type="button" :class="{ aktiv: stufe[dokument] === s }" @click="stufe[dokument] = s">{{ label }}</button>
            </span>
          </div>
        </div>

        <template v-if="individuell">
          <div v-if="regelnMoeglich" class="stack-sm">
            <span class="label">Regeln <InfoKnopf titel="Regeln" :punkte="regelnInfo" /></span>
            <div v-for="(r, i) in regeln" :key="i" class="regel">
              <select v-model="r.modus" class="input klein" aria-label="Recht">
                <option v-for="(label, wert) in MODI" :key="wert" :value="wert">{{ label }}</option>
              </select>
              <select v-model="r.art" class="input klein" aria-label="Art" @change="r.id = ''">
                <option v-for="(label, wert) in ARTEN" :key="wert" :value="wert">{{ label }}</option>
              </select>
              <select v-model="r.id" class="input klein" aria-label="Auswahl">
                <option value="" disabled>{{ r.art === 'themenbereich' ? 'Themenbereich wählen …' : r.art === 'person' ? 'Person wählen …' : 'Traktandum wählen …' }}</option>
                <option v-for="o in auswahl(r.art)" :key="o.id" :value="o.id">{{ o.label }}</option>
              </select>
              <button type="button" class="btn btn-ghost btn-icon" title="Regel entfernen" @click="regeln.splice(i, 1)">✕</button>
            </div>
            <p v-if="!regeln.length" class="muted small">Keine Regeln: {{ link ? 'Der Link sieht' : 'Die Person sieht' }} das ganze Dokument.</p>
            <div><button type="button" class="btn btn-ghost" @click="regeln.push({ modus: 'bearbeiten', art: 'themenbereich', id: '' })">+ Regel</button></div>
            <label v-if="!link" class="check small"><input v-model="eigene" type="checkbox" /> Eigenes bearbeiten: Traktanden, wo {{ name }} verantwortlich oder eingetragen ist, und eigene Pendenzen</label>
          </div>

          <div v-for="dokument in dokumente.filter((d) => stufe[d] === 'individuell')" :key="dokument" class="stack-sm">
            <span class="label">Einzelne Rechte · {{ sitzung.kurz && !link ? 'Protokoll' : DOKUMENT[dokument] }}</span>
            <label v-for="(label, recht) in einzelrechte(dokument)" :key="recht" class="check small">
              <input v-model="rechte[dokument]" type="checkbox" :value="recht" /> {{ label }}
            </label>
          </div>
        </template>
      </div>
      <template #fuss>
        <div class="row">
          <button type="button" class="btn btn-ghost" @click="zuruecksetzen">{{ link ? 'Auf Standard zurücksetzen' : 'Auf Rollenstandard zurücksetzen' }}</button>
          <button type="button" class="btn ml-auto" @click="$emit('schliessen')">Abbrechen</button>
          <button type="button" class="btn btn-primary" @click="speichern">Speichern</button>
        </div>
      </template>
    </Modal>
  `,
  data() {
    const z = this.link ? this.link.zuschnitt : this.sitzung.zuschnitt?.[this.personId]
    const dokumente = this.link ? [this.link.dokument] : this.sitzung.kurz ? ['protokoll'] : ['vorprotokoll', 'protokoll']
    const stufe = {}
    const rechte = { terminfindung: [], vorprotokoll: [], protokoll: [] }
    for (const dokument of dokumente) {
      if (this.link) {
        stufe[dokument] = this.link.stufe
        rechte[dokument] = this.link.stufe === 'individuell' ? [...(this.link.rechte || [])] : []
      } else {
        stufe[dokument] = freigabeStufe(this.sitzung, dokument, this.personId)
        const roh = freigabeRoh(this.sitzung, dokument, this.personId)
        rechte[dokument] = Array.isArray(roh) ? [...roh] : []
      }
    }
    return {
      MODI,
      ARTEN,
      DOKUMENT,
      dokumente,
      stufe,
      rechte,
      regeln: (z?.regeln || []).map((r) => ({ ...r })),
      eigene: z ? !!z.eigene : true,
    }
  },
  computed: {
    // (i) zu den Stufen und zu den Regeln
    stufenInfo() {
      return [
        { titel: 'Lesen', text: 'Nur ansehen.' },
        { titel: 'Eigene', text: this.link ? 'Alle Traktanden ändern und verschieben, Unterpunkte hinzufügen und löschen.' : 'Zugewiesene Traktanden und Einträge bearbeiten.' },
        { titel: 'Individuell', text: 'Regeln und einzelne Rechte.' },
        { titel: 'Alles', text: 'Das ganze Dokument.' },
      ]
    },
    regelnInfo() {
      const wer = this.link ? 'sieht, wer den Link öffnet,' : 'sieht die Person'
      const gilt = this.link ? DOKUMENT[this.link.dokument] : this.sitzung.kurz ? 'das Protokoll' : 'Vorprotokoll und Protokoll'
      return [
        { titel: 'Geltung', text: `Gilt für ${gilt} dieser Sitzung. Mit Regeln ${wer} nur, was sie abdecken; Kopfdaten, Anwesenheit und Gäste bleiben sichtbar. Unterpunkte gehören zu ihrem Traktandum.` },
        { titel: 'Person', text: 'Wo sie verantwortlich oder zum Bearbeiten eingetragen ist, im Protokoll auch ihre Pendenzen.' },
      ]
    },
    gremium() {
      return gremienStore.byId(this.sitzung.gremiumId)
    },
    vorprotokoll() {
      return sitzungenStore.vorprotokollVonSitzung(this.sitzung.id)
    },
    name() {
      if (this.link) return this.link.name || 'Link'
      return gremienStore.person(this.gremium.id, this.vorprotokoll?.gaeste || [], this.personId)?.name || 'Person'
    },
    individuell() {
      return this.dokumente.some((d) => this.stufe[d] === 'individuell')
    },
    // Regeln gelten für Vorprotokoll und Protokoll, nicht für die Terminfindung
    regelnMoeglich() {
      return !this.link || this.link.dokument !== 'terminfindung'
    },
  },
  methods: {
    // Stufen: Personen Lesen / Eigene / Individuell / Alles; Links «Eigene» nur im Vorprotokoll
    stufenFuer(dokument) {
      const stufen = { lesen: 'Lesen', eigene: 'Eigene', individuell: 'Individuell', alles: 'Alles' }
      if (this.link && dokument !== 'vorprotokoll') delete stufen.eigene
      return stufen
    },
    standard(dokument) {
      if (this.link) return this.link.id === 'freigabe' ? 'eigene' : 'lesen'
      return standardStufe(this.sitzung, this.personId, dokument)
    },
    gesetzt(dokument) {
      return this.stufe[dokument] !== this.standard(dokument)
    },
    // Einzelrechte eines Dokuments; «alle Traktanden bearbeiten / ändern» nur ohne Regeln (sonst gelten die Regeln)
    einzelrechte(dokument) {
      const liste = { ...EINZELRECHTE[dokument] }
      if (this.regeln.length) {
        delete liste.traktandenBearbeiten
        delete liste.traktandenAendern
      }
      if (this.sitzung.kurz && !this.link) Object.assign(liste, EINZELRECHTE.vorprotokoll)
      return liste
    },
    auswahl(art) {
      if (art === 'themenbereich') return this.gremium.themenbereiche.map((tb) => ({ id: tb.id, label: tb.name }))
      if (art === 'person') return [...this.gremium.mitglieder, ...(this.vorprotokoll?.gaeste || [])].filter((p) => p.name).map((p) => ({ id: p.id, label: p.name }))
      const liste = []
      const gehe = (punkte, nummer) => punkte.forEach((t, i) => {
        const nr = nummer ? `${nummer}.${i + 1}` : `${i + 1}`
        liste.push({ id: t.id, label: `${nr} ${t.titel || 'Ohne Titel'}` })
        gehe(t.untertraktanden || [], nr)
      })
      gehe(this.vorprotokoll?.traktanden || [], '')
      return liste
    },
    speichern() {
      const regeln = this.regeln.filter((r) => r.id)
      const zuschnitt = this.individuell && this.regelnMoeglich && regeln.length ? { regeln, eigene: !this.link && this.eigene } : null
      if (this.link) {
        const dokument = this.link.dokument
        this.link.stufe = this.stufe[dokument]
        this.link.rechte = this.stufe[dokument] === 'individuell' ? this.rechte[dokument].filter((r) => EINZELRECHTE[dokument][r]) : []
        this.link.zuschnitt = zuschnitt
      } else {
        const s = this.sitzung
        s.freigaben ??= {}
        s.zuschnitt ??= {}
        for (const dokument of this.dokumente) {
          s.freigaben[dokument] ??= {}
          const wert = this.stufe[dokument] === 'individuell' ? [...this.rechte[dokument]] : this.stufe[dokument]
          // Gleich wie der Standard (Rolle bzw. Leitung): nichts speichern, damit spätere Änderungen an der Rolle gelten
          if (wert === this.standard(dokument)) delete s.freigaben[dokument][this.personId]
          else s.freigaben[dokument][this.personId] = wert
        }
        if (zuschnitt) s.zuschnitt[this.personId] = zuschnitt
        else delete s.zuschnitt[this.personId]
      }
      this.$emit('schliessen')
    },
    async zuruecksetzen() {
      const ziel = this.link ? 'den Standard' : 'den Standard der Rolle'
      if (!(await bestaetigen(`Gesetzte Rechte von ${this.name} entfernen und auf ${ziel} zurücksetzen?`, { gefahr: true }))) return
      if (this.link) {
        this.link.stufe = this.standard(this.link.dokument)
        this.link.rechte = []
        this.link.zuschnitt = null
      } else {
        for (const dokument of ['vorprotokoll', 'protokoll']) delete this.sitzung.freigaben?.[dokument]?.[this.personId]
        delete this.sitzung.zuschnitt?.[this.personId]
      }
      this.$emit('schliessen')
    },
  },
}
