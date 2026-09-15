import { gremienStore } from '../stores/gremien.js'
import { sitzungenStore } from '../stores/sitzungen.js'
import { sync, recht } from '../stores/sync.js'
import { neuerKey } from '../utils/keys.js'
import { rolleIm, zurueckZu } from '../utils/rechte.js'
import MenuDropdown from '../components/MenuDropdown.js'
import { ANTRAG_STATUS, PENDENZ_STATUS, PENDENZ_STATUS_KLASSE, formatDatum } from '../utils/labels.js'

export default {
  name: 'ThemenbereichSummary',
  components: { MenuDropdown },
  props: {
    gremiumId: { type: String, default: '' },
    themenbereichId: { type: String, default: '' },
    freigabeKey: { type: String, default: '' }, // Übersichts-Link
  },
  template: `
    <div v-if="themenbereich" class="stack-lg">
      <header class="page-header" style="margin-bottom: 0">
        <router-link v-if="zurueck" :to="zurueck" class="rueck">← {{ zurueckText }}</router-link>
        <div class="kopf">
          <div>
            <p class="kicker">Themenbereich · {{ gremium.name }} · Historische Übersicht aus {{ anzahlSitzungen }} Sitzungen</p>
            <h1 class="title row"><span class="farbpunkt gross" :style="{ backgroundColor: themenbereich.farbe }"></span>{{ themenbereich.name }}</h1>
            <p v-if="kopiert" class="small text-ok mt-1">Übersichts-Link kopiert – wer ihn öffnet, sieht diese Übersicht (nur lesen).</p>
          </div>
          <MenuDropdown v-if="darfTeilen">
            <button class="menu-item" @click="linkKopieren">Übersichts-Link kopieren</button>
            <button class="menu-item" @click="linkErneuern">Übersichts-Link erneuern</button>
          </MenuDropdown>
        </div>
      </header>

      <section class="card">
        <div class="card-head">
          <h2 class="card-title">Pendenzen</h2>
          <div class="row">
            <button v-for="(label, status) in filterOptionen" :key="status" class="btn" :class="{ 'btn-primary': statusFilter === status }" @click="statusFilter = status">
              {{ label }} <span style="opacity: 0.6">{{ anzahl(status) }}</span>
            </button>
          </div>
        </div>
        <div v-if="pendenzen.length" class="zeilen" style="--spalten: auto 1fr 1.5fr auto auto auto">
          <div class="zeile kopf"><span>Sitzung</span><span>Titel</span><span>Inhalt</span><span>Zugewiesen an</span><span>Bis wann</span><span>Status</span></div>
          <div v-for="{ eintrag, sitzung } in pendenzen" :key="eintrag.id" class="zeile oben">
            <span class="nowrap">{{ formatDatum(sitzung.datum) }}</span>
            <strong>{{ eintrag.titel }}</strong>
            <span class="muted">{{ eintrag.inhalt }}</span>
            <span>{{ eintrag.zugewiesenAnName || '–' }}</span>
            <span class="nowrap">{{ eintrag.faelligBis ? formatDatum(eintrag.faelligBis) : '–' }}</span>
            <span><span class="badge" :class="PENDENZ_STATUS_KLASSE[eintrag.pendenzStatus]">{{ PENDENZ_STATUS[eintrag.pendenzStatus] }}</span></span>
          </div>
        </div>
        <p v-else class="muted small">Keine Pendenzen.</p>
      </section>

      <section class="card">
        <h2 class="card-title">Anträge</h2>
        <div v-if="antraege.length" class="zeilen" style="--spalten: auto 1fr 1.5fr auto">
          <div class="zeile kopf"><span>Sitzung</span><span>Titel</span><span>Inhalt</span><span>Beschluss</span></div>
          <div v-for="{ eintrag, sitzung } in antraege" :key="eintrag.id" class="zeile oben">
            <span class="nowrap">{{ formatDatum(sitzung.datum) }}</span>
            <strong>{{ eintrag.titel }}</strong>
            <span class="muted">{{ eintrag.inhalt }}</span>
            <span>{{ ANTRAG_STATUS[eintrag.antragStatus] }}</span>
          </div>
        </div>
        <p v-else class="muted small">Keine Anträge.</p>
      </section>

      <section class="card">
        <h2 class="card-title">Informationen</h2>
        <div v-if="informationen.length" class="zeilen" style="--spalten: auto 1fr 1.5fr">
          <div class="zeile kopf"><span>Sitzung</span><span>Titel</span><span>Inhalt</span></div>
          <div v-for="{ eintrag, sitzung } in informationen" :key="eintrag.id" class="zeile oben">
            <span class="nowrap">{{ formatDatum(sitzung.datum) }}</span>
            <strong>{{ eintrag.titel }}</strong>
            <span class="muted">{{ eintrag.inhalt }}</span>
          </div>
        </div>
        <p v-else class="muted small">Keine Informationen.</p>
      </section>
    </div>
  `,
  data() {
    return {
      statusFilter: 'alle',
      kopiert: false,
      filterOptionen: { alle: 'Alle', ...PENDENZ_STATUS },
      ANTRAG_STATUS,
      PENDENZ_STATUS,
      PENDENZ_STATUS_KLASSE,
    }
  },
  computed: {
    // Über den Übersichts-Link kommen Gremium und Themenbereich aus dem Zugang
    ids() {
      if (this.freigabeKey) return { gremiumId: sync.zugriff?.gremiumId, themenbereichId: sync.zugriff?.themenbereichId }
      return { gremiumId: this.gremiumId, themenbereichId: this.themenbereichId }
    },
    gremium() {
      return gremienStore.byId(this.ids.gremiumId)
    },
    themenbereich() {
      return this.gremium?.themenbereiche.find((tb) => tb.id === this.ids.themenbereichId)
    },
    darfTeilen() {
      const rolle = rolleIm(this.gremium.id)
      return rolle === 'admin' || (rolle === 'gremium' && recht('einstellungen', this.gremium.id) === 'bearbeiten')
    },
    zurueck() {
      return zurueckZu(this.gremium.id).pfad
    },
    zurueckText() {
      return zurueckZu(this.gremium.id).text
    },
    // Alle Einträge dieses Themenbereichs über sämtliche Protokolle, neueste Sitzung zuerst
    eintraege() {
      return sitzungenStore
        .eintraegeVonGremium(this.ids.gremiumId)
        .filter(({ eintrag }) => eintrag.themenbereichId === this.ids.themenbereichId)
        .sort((a, b) => b.sitzung.datum.localeCompare(a.sitzung.datum))
    },
    allePendenzen() {
      return this.eintraege.filter(({ eintrag }) => eintrag.typ === 'pendenz')
    },
    pendenzen() {
      if (this.statusFilter === 'alle') return this.allePendenzen
      return this.allePendenzen.filter(({ eintrag }) => eintrag.pendenzStatus === this.statusFilter)
    },
    antraege() {
      return this.eintraege.filter(({ eintrag }) => eintrag.typ === 'antrag')
    },
    informationen() {
      return this.eintraege.filter(({ eintrag }) => eintrag.typ === 'information')
    },
    anzahlSitzungen() {
      return new Set(this.eintraege.map(({ sitzung }) => sitzung.id)).size
    },
  },
  methods: {
    formatDatum,
    linkKopieren() {
      navigator.clipboard.writeText(location.href.split('#')[0] + '#/themenbereich/' + this.themenbereich.freigabeKey)
      this.kopiert = true
      setTimeout(() => (this.kopiert = false), 3000)
    },
    linkErneuern() {
      if (confirm('Übersichts-Link erneuern? Der bisherige Link wird sofort ungültig.')) this.themenbereich.freigabeKey = neuerKey()
    },
    anzahl(status) {
      if (status === 'alle') return this.allePendenzen.length
      return this.allePendenzen.filter(({ eintrag }) => eintrag.pendenzStatus === status).length
    },
  },
}
