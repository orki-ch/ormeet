import { gremienStore } from '../stores/gremien.js'
import { sitzungenStore } from '../stores/sitzungen.js'
import { abgleichen } from '../stores/sync.js'
import { personenText } from '../utils/traktanden.js'
import { ANTRAG_STATUS, PENDENZ_STATUS, TYP_BADGE, TYP_LABELS, formatDatum, formatDauer, stimmenText } from '../utils/labels.js'
import SitzungKopfdaten from '../components/SitzungKopfdaten.js'

// Live-Ansicht eines Protokolls über den Verfolger-Link (nur lesen, aktualisiert sich automatisch)
export default {
  name: 'ProtokollAnsicht',
  components: { SitzungKopfdaten },
  props: {
    verfolgerKey: { type: String, required: true },
  },
  template: `
    <div v-if="protokoll" class="stack-lg">
      <header class="page-header kopf" style="margin-bottom: 0">
        <div>
          <p class="kicker">Protokoll · {{ gremium.name }} · {{ formatDatum(sitzung.datum) }}</p>
          <h1 class="title">{{ sitzung.titel || 'Sitzung' }}</h1>
        </div>
        <p class="live">Live-Ansicht · aktualisiert {{ aktualisiertUm }}</p>
      </header>

      <SitzungKopfdaten :sitzung="sitzung" nur-lesen />

      <section class="card small stack-sm">
        <h2 class="card-title">Anwesenheit</h2>
        <p><span class="muted">Anwesend:</span> {{ namen(protokoll.anwesende) }}</p>
        <p><span class="muted">Abwesend / entschuldigt:</span> {{ namen(protokoll.abwesende) }}</p>
        <p v-if="protokoll.gaeste.length"><span class="muted">Gäste:</span> {{ protokoll.gaeste.map((g) => g.name).join(', ') }}</p>
      </section>

      <section v-for="(t, i) in traktanden" :key="t.id" class="card">
        <div class="traktandum-kopf">
          <span class="nr">{{ i + 1 }}.</span>
          <h2>{{ t.titel }}</h2>
          <span v-if="t.typ" class="badge" :class="TYP_BADGE[t.typ]">{{ TYP_LABELS[t.typ] }}</span>
          <span v-if="t.verantwortliche.length" class="muted small">{{ personenText(t.verantwortliche) }}</span>
          <span v-if="t.dauer || protokoll.dauern?.[t.id]" class="leise small nowrap">{{ dauerText(t) }}</span>
        </div>
        <p v-if="t.notiz" class="notiz pre eingerueckt">{{ t.notiz }}</p>
        <div class="eingerueckt mt-2 stack-sm">
          <div v-if="uebertragene[t.pendenzId]" class="pendenz-uebertragen">
            <span class="badge gelb" style="margin-right: 0.25rem">Übertragene Pendenz</span>
            <strong>{{ uebertragene[t.pendenzId].titel }}</strong>
            <span class="muted">· {{ PENDENZ_STATUS[uebertragene[t.pendenzId].pendenzStatus] }} · {{ uebertragene[t.pendenzId].zugewiesenAnName || '–' }}</span>
          </div>
          <div v-for="e in eintraegeVon(t.id)" :key="e.id" class="eintrag" :class="'typ-' + e.typ">
            <div class="eintrag-zeile">
              <span class="badge" :class="TYP_BADGE[e.typ]">{{ TYP_LABELS[e.typ] }}</span>
              <span class="titel">{{ e.titel }}</span>
              <span class="leise">{{ meta(e) }}</span>
            </div>
            <p v-if="e.inhalt" class="notiz pre">{{ e.inhalt }}</p>
          </div>
          <div v-for="(u, j) in t.untertraktanden" :key="u.id" class="sub">
            <div class="sub-kopf">
              <span class="nr">{{ i + 1 }}.{{ j + 1 }}</span>
              <h3>{{ u.titel }}</h3>
              <span v-if="!t.typ && u.typ" class="badge" :class="TYP_BADGE[u.typ]">{{ TYP_LABELS[u.typ] }}</span>
            </div>
            <p v-if="u.notiz" class="notiz pre">{{ u.notiz }}</p>
            <div v-for="e in eintraegeVon(u.id)" :key="e.id" class="eintrag" :class="'typ-' + e.typ">
              <div class="eintrag-zeile">
                <span class="badge" :class="TYP_BADGE[e.typ]">{{ TYP_LABELS[e.typ] }}</span>
                <span class="titel">{{ e.titel }}</span>
                <span class="leise">{{ meta(e) }}</span>
              </div>
              <p v-if="e.inhalt" class="notiz pre">{{ e.inhalt }}</p>
            </div>
          </div>
        </div>
      </section>

      <section v-if="naechsterTermin" class="card small">
        <h2 class="card-title">Nächster Sitzungstermin</h2>
        {{ formatDatum(naechsterTermin.datum) }}, {{ naechsterTermin.zeit }} · {{ naechsterTermin.ort }}
      </section>
    </div>

    <p v-else class="muted">Zu diesem Link wurde kein Protokoll gefunden.</p>
  `,
  data() {
    return { aktualisiertUm: '', timer: null, TYP_LABELS, TYP_BADGE, PENDENZ_STATUS }
  },
  computed: {
    protokoll() {
      return sitzungenStore.protokollByVerfolgerKey(this.verfolgerKey)
    },
    sitzung() {
      return sitzungenStore.sitzungById(this.protokoll.sitzungId)
    },
    gremium() {
      return gremienStore.byId(this.sitzung.gremiumId)
    },
    traktanden() {
      return sitzungenStore.vorprotokollVonSitzung(this.sitzung.id)?.traktanden || []
    },
    uebertragene() {
      const map = {}
      this.traktanden.filter((t) => t.pendenzId).forEach((t) => {
        const treffer = sitzungenStore.eintragById(t.pendenzId)
        if (treffer) map[t.pendenzId] = treffer.eintrag
      })
      return map
    },
    naechsterTermin() {
      return sitzungenStore.sitzungById(this.sitzung.naechsterTerminId)
    },
  },
  created() {
    this.aktualisieren()
    this.timer = setInterval(this.aktualisieren, 5000)
  },
  beforeUnmount() {
    clearInterval(this.timer)
  },
  methods: {
    formatDatum,
    personenText,
    async aktualisieren() {
      await abgleichen()
      this.aktualisiertUm = new Date().toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    },
    namen(ids) {
      return ids.map((id) => gremienStore.mitgliedName(this.gremium.id, id)).join(', ') || '–'
    },
    dauerText(t) {
      const ist = this.protokoll.dauern?.[t.id]
      if (!t.dauer) return ''
      return ['geplant ' + formatDauer(t.dauer), ist && 'tatsächlich ' + formatDauer(ist)].filter(Boolean).join(' · ')
    },
    eintraegeVon(traktandumId) {
      return this.protokoll.eintraege.filter((e) => e.traktandumId === traktandumId)
    },
    meta(e) {
      if (e.typ === 'antrag') return [ANTRAG_STATUS[e.antragStatus], stimmenText(e)].filter(Boolean).join(' · ')
      if (e.typ === 'pendenz') return [PENDENZ_STATUS[e.pendenzStatus], e.zugewiesenAnName, e.faelligBis && 'bis ' + formatDatum(e.faelligBis)].filter(Boolean).join(' · ')
      return ''
    },
  },
}
