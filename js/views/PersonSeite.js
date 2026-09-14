import { gremienStore } from '../stores/gremien.js'
import { sitzungenStore } from '../stores/sitzungen.js'
import { sync } from '../stores/sync.js'
import { api } from '../api.js'
import { istLeitung } from '../utils/rechte.js'
import { istBerechtigt } from '../utils/traktanden.js'
import { PENDENZ_STATUS, PENDENZ_STATUS_KLASSE, SITZUNG_STATUS, SITZUNG_STATUS_KLASSE, formatDatum, sitzungStatus } from '../utils/labels.js'

// Persönliche Übersicht über den zentralen Link eines Mitglieds
export default {
  name: 'PersonSeite',
  template: `
    <div v-if="person" class="stack-lg">
      <header class="page-header" style="margin-bottom: 0">
        <p class="kicker">{{ gremium.name }} · {{ rolleName }}</p>
        <h1 class="title">Hallo {{ person.name }}</h1>
        <p class="muted small mt-1">Deine Sitzungen, Terminfindungen und Pendenzen. Bearbeiten kannst du, was dir zugewiesen ist – als Sitzungsleitung oder Protokollführung das ganze Dokument.</p>
      </header>

      <section v-if="terminfindungen.length" class="card">
        <h2 class="card-title">Offene Terminfindungen</h2>
        <div class="liste">
          <div v-for="s in terminfindungen" :key="s.id" class="liste-zeile">
            <div class="grow"><strong>{{ s.titel || 'Sitzung' }}</strong><span v-if="s.ort" class="muted small"> · {{ s.ort }}</span>
              <p class="small" :class="abgestimmt(s) ? 'text-ok' : 'text-warn'">{{ abgestimmt(s) ? 'Du hast abgestimmt' : 'Deine Stimme fehlt noch' }}</p></div>
            <router-link :to="'/sitzung/' + s.id + '/terminfindung'" class="btn btn-primary">Abstimmen</router-link>
          </div>
        </div>
      </section>

      <section class="card">
        <h2 class="card-title">Sitzungen</h2>
        <p v-if="!sitzungen.length" class="muted small">Noch keine Sitzungen.</p>
        <div v-else class="zeilen" style="--spalten: auto 1fr auto auto">
          <div v-for="s in sitzungen" :key="s.id" class="zeile">
            <span class="nowrap"><strong>{{ formatDatum(s.datum) }}</strong><span class="leise"> {{ s.zeit }}</span></span>
            <span>{{ s.titel }}<span v-if="s.ort" class="leise"> · {{ s.ort }}</span>
              <span v-if="istLeitung(s, person.id)" class="badge brand" style="margin-left: 0.4rem">Leitung / Protokoll</span>
              <span v-else-if="anzahlZugewiesen(s)" class="badge grau" style="margin-left: 0.4rem">{{ anzahlZugewiesen(s) }} Traktanden</span></span>
            <span><span class="badge" :class="SITZUNG_STATUS_KLASSE[sitzungStatus(s)]">{{ SITZUNG_STATUS[sitzungStatus(s)] }}</span></span>
            <div class="aktionen">
              <router-link v-if="s.terminfindung?.status === 'offen'" :to="'/sitzung/' + s.id + '/terminfindung'" class="btn btn-ghost">Terminfindung</router-link>
              <router-link v-if="vorprotokollVon(s)" :to="'/sitzung/' + s.id + '/vorprotokoll'" class="btn btn-ghost">Vorprotokoll</router-link>
              <router-link v-if="s.datum && protokollVon(s)" :to="'/sitzung/' + s.id + '/protokoll'" class="btn btn-ghost">Protokoll</router-link>
            </div>
          </div>
        </div>
      </section>

      <section class="card">
        <h2 class="card-title">Meine Pendenzen</h2>
        <p v-if="!pendenzen.length" class="muted small">Keine offenen Pendenzen.</p>
        <div v-else class="zeilen" style="--spalten: 1fr auto auto auto">
          <div v-for="{ eintrag, sitzung } in pendenzen" :key="eintrag.id" class="zeile">
            <span><strong>{{ eintrag.titel }}</strong><p v-if="eintrag.inhalt" class="muted">{{ eintrag.inhalt }}</p></span>
            <span class="nowrap muted">aus Sitzung {{ formatDatum(sitzung.datum) }}</span>
            <span class="nowrap">{{ eintrag.faelligBis ? 'bis ' + formatDatum(eintrag.faelligBis) : '' }}</span>
            <select v-model="eintrag.pendenzStatus" class="input w-sm" :title="'Status: ' + PENDENZ_STATUS[eintrag.pendenzStatus]">
              <option v-for="(label, wert) in PENDENZ_STATUS" :key="wert" :value="wert">{{ label }}</option>
            </select>
          </div>
        </div>
        <p v-if="pendenzen.length" class="muted small mt-2">Den Status kannst du hier direkt ändern; erfüllte Pendenzen verschwinden bei der nächsten Sitzung aus dem Übertrag.</p>
      </section>

      <section class="card">
        <h2 class="card-title">Kalender-Abo</h2>
        <p class="hint">Abonniere diesen Link in deinem Kalender (Apple, Google, Outlook …): Sitzungstermine, deine Pendenzen mit Frist und provisorische Termine aus Abstimmungen, bei denen du «Ja» oder «Vielleicht» gewählt hast. Jeder Termin enthält den Link zum Vorprotokoll.</p>
        <div class="row">
          <code class="input grow truncate" style="line-height: 1.5">{{ kalenderLink }}</code>
          <button class="btn" @click="kalenderKopieren">{{ kalenderKopiert ? 'Kopiert ✓' : 'Link kopieren' }}</button>
          <a :href="kalenderLink.replace(/^https?:/, 'webcal:')" class="btn btn-primary">Abonnieren</a>
        </div>
      </section>

      <section v-if="gremium.themenbereiche.length" class="card">
        <h2 class="card-title">Themenbereiche</h2>
        <div class="row">
          <router-link v-for="tb in gremium.themenbereiche" :key="tb.id" :to="'/gremium/' + gremium.id + '/themenbereich/' + tb.id" class="btn">
            <span class="farbpunkt" :style="{ backgroundColor: tb.farbe }"></span> {{ tb.name }}
          </router-link>
        </div>
      </section>
    </div>
    <p v-else class="muted">Dieser Zugang ist keinem Mitglied zugeordnet.</p>
  `,
  data() {
    return { kalenderKopiert: false, SITZUNG_STATUS, SITZUNG_STATUS_KLASSE, PENDENZ_STATUS, PENDENZ_STATUS_KLASSE }
  },
  computed: {
    kalenderLink() {
      return location.origin + location.pathname.replace(/[^/]*$/, '') + 'api.php?aktion=ical&token=' + api.token
    },
    gremium() {
      return gremienStore.byId(sync.zugriff.gremiumId)
    },
    person() {
      return this.gremium?.mitglieder.find((m) => m.id === sync.zugriff.personId)
    },
    rolleName() {
      return gremienStore.rolleName(this.gremium.id, this.person.rolleId)
    },
    sitzungen() {
      return sitzungenStore.sitzungenVonGremium(this.gremium.id)
    },
    terminfindungen() {
      return this.sitzungen.filter((s) => s.terminfindung?.status === 'offen')
    },
    pendenzen() {
      return sitzungenStore
        .eintraegeVonGremium(this.gremium.id)
        .filter(({ eintrag }) => eintrag.typ === 'pendenz' && eintrag.zugewiesenAn === this.person.id)
        .sort((a, b) => (a.eintrag.pendenzStatus === 'erfuellt') - (b.eintrag.pendenzStatus === 'erfuellt') || (b.sitzung.datum || '').localeCompare(a.sitzung.datum || ''))
    },
  },
  methods: {
    formatDatum,
    sitzungStatus,
    istLeitung,
    kalenderKopieren() {
      navigator.clipboard.writeText(this.kalenderLink)
      this.kalenderKopiert = true
      setTimeout(() => (this.kalenderKopiert = false), 2000)
    },
    vorprotokollVon(s) {
      return sitzungenStore.vorprotokollVonSitzung(s.id)
    },
    protokollVon(s) {
      return sitzungenStore.protokollVonSitzung(s.id)
    },
    abgestimmt(s) {
      return s.terminfindung.stimmen.some((st) => st.personId === this.person.id)
    },
    anzahlZugewiesen(s) {
      const vp = this.vorprotokollVon(s)
      if (!vp) return 0
      return vp.traktanden.filter((t) => istBerechtigt(t, this.person) || t.untertraktanden.some((u) => istBerechtigt(u, this.person))).length
    },
  },
}
