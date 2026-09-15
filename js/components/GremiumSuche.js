import { gremienStore } from '../stores/gremien.js'
import { sitzungenStore } from '../stores/sitzungen.js'
import { ANTRAG_STATUS, PENDENZ_STATUS, TYP_BADGE, TYP_LABELS, formatDatum, stimmenText } from '../utils/labels.js'

// Suche über alles, was der aktuelle Zugang von diesem Gremium geladen hat: Sitzungen, Traktanden / Unterpunkte
// (Vorprotokolle) und Einträge (Informationen, Anträge, Pendenzen) aus den Protokollen. Was der Zugang nicht sehen
// darf, hat der Server gar nicht geliefert – die Suche zeigt also nur, worauf die Person Zugriff hat.
export default {
  name: 'GremiumSuche',
  props: {
    gremiumId: { type: String, required: true },
  },
  template: `
    <section class="card suche">
      <input v-model.trim="begriff" type="search" class="input" placeholder="Suchen: Anträge, Beschlüsse, Pendenzen, Informationen, Traktanden, Sitzungen …" />
      <template v-if="begriff.length >= 2">
        <p v-if="!treffer.length" class="muted small mt-2">Nichts gefunden zu «{{ begriff }}».</p>
        <div v-else class="zeilen mt-2" style="--spalten: auto auto 1fr auto">
          <router-link v-for="t in treffer" :key="t.id" :to="t.pfad" class="zeile treffer">
            <span class="nowrap muted">{{ formatDatum(t.sitzung.datum) }}</span>
            <span><span class="badge" :class="t.badge">{{ t.art }}</span></span>
            <span><strong>{{ t.titel }}</strong><span v-if="t.text" class="muted"> – {{ t.text }}</span></span>
            <span class="nowrap leise small">{{ t.meta }}</span>
          </router-link>
        </div>
        <p v-if="treffer.length >= MAX" class="leise small mt-2">Nur die ersten {{ MAX }} Treffer – Suchbegriff eingrenzen.</p>
      </template>
    </section>
  `,
  data() {
    return { begriff: '', MAX: 50 }
  },
  computed: {
    gremium() {
      return gremienStore.byId(this.gremiumId)
    },
    // Neueste Sitzung zuerst
    sitzungen() {
      return [...sitzungenStore.sitzungenVonGremium(this.gremiumId)].sort((a, b) => (b.datum || '9999').localeCompare(a.datum || '9999'))
    },
    treffer() {
      const woerter = this.begriff.toLowerCase().split(/\s+/).filter(Boolean)
      const passt = (...texte) => {
        const text = texte.filter(Boolean).join(' ').toLowerCase()
        return woerter.every((w) => text.includes(w))
      }
      const treffer = []
      for (const sitzung of this.sitzungen) {
        if (treffer.length >= this.MAX) break
        const datum = formatDatum(sitzung.datum)
        if (passt(sitzung.titel, sitzung.ort, datum, sitzung.bemerkungen)) {
          treffer.push({ id: sitzung.id, sitzung, art: 'Sitzung', badge: 'grau', titel: sitzung.titel || 'Sitzung', text: sitzung.ort, meta: datum, pfad: this.sitzungPfad(sitzung) })
        }
        const vorprotokoll = sitzungenStore.vorprotokollVonSitzung(sitzung.id)
        vorprotokoll?.traktanden.forEach((t, i) => {
          if (passt(t.titel, t.notiz)) treffer.push({ id: t.id, sitzung, art: 'Traktandum', badge: 'brand', titel: `${i + 1}. ${t.titel}`, text: t.notiz, meta: this.themenbereich(t.themenbereichId), pfad: this.sitzungPfad(sitzung) })
          t.untertraktanden.forEach((u, j) => {
            if (passt(u.titel, u.notiz)) treffer.push({ id: u.id, sitzung, art: 'Unterpunkt', badge: 'brand', titel: `${i + 1}.${j + 1} ${u.titel}`, text: u.notiz, meta: `Traktandum ${t.titel}`, pfad: this.sitzungPfad(sitzung) })
          })
        })
        const protokoll = sitzungenStore.protokollVonSitzung(sitzung.id)
        protokoll?.eintraege.forEach((e) => {
          if (!passt(e.titel, e.inhalt, e.zugewiesenAnName, TYP_LABELS[e.typ], this.status(e))) return
          treffer.push({ id: e.id, sitzung, art: TYP_LABELS[e.typ], badge: TYP_BADGE[e.typ], titel: e.titel, text: e.inhalt, meta: this.status(e), pfad: '/sitzung/' + sitzung.id + '/protokoll' })
        })
      }
      return treffer.slice(0, this.MAX)
    },
  },
  methods: {
    formatDatum,
    sitzungPfad(sitzung) {
      const protokoll = sitzung.datum && sitzungenStore.protokollVonSitzung(sitzung.id)
      return '/sitzung/' + sitzung.id + (protokoll ? '/protokoll' : '/vorprotokoll')
    },
    themenbereich(id) {
      return this.gremium.themenbereiche.find((tb) => tb.id === id)?.name || ''
    },
    status(e) {
      if (e.typ === 'antrag') return ['Beschluss: ' + (ANTRAG_STATUS[e.antragStatus] || ''), stimmenText(e)].filter(Boolean).join(' · ')
      if (e.typ === 'pendenz') return [PENDENZ_STATUS[e.pendenzStatus], e.zugewiesenAnName, e.faelligBis && 'bis ' + formatDatum(e.faelligBis)].filter(Boolean).join(' · ')
      return ''
    },
  },
}
