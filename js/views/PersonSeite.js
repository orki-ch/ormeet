import { gremienStore } from '../stores/gremien.js'
import { sitzungenStore } from '../stores/sitzungen.js'
import { sync, laden } from '../stores/sync.js'
import { api } from '../api.js'
import { istLeitung, personIdIm } from '../utils/rechte.js'
import GremiumSuche from '../components/GremiumSuche.js'
import SsoButtons from '../components/SsoButtons.js'
import ThemenbereichLinks from '../components/ThemenbereichLinks.js'
import { istBerechtigt } from '../utils/traktanden.js'
import { PENDENZ_STATUS, PENDENZ_STATUS_KLASSE, SITZUNG_STATUS, SITZUNG_STATUS_KLASSE, formatDatum, sitzungStatus } from '../utils/labels.js'

const AKTIV_KEY = 'ormeet-aktives-gremium'

// Persönliche Übersicht über den zentralen Link eines Mitglieds oder ein Konto (mit Gremium-Wechsel)
export default {
  name: 'PersonSeite',
  components: { GremiumSuche, SsoButtons, ThemenbereichLinks },
  props: {
    gremiumId: { type: String, default: '' },
  },
  template: `
    <div v-if="person" class="stack-lg">
      <header class="page-header" style="margin-bottom: 0">
        <div class="row between top">
          <div>
            <p class="kicker">{{ gremium.name }} · {{ rolleName }}</p>
            <h1 class="title">Hallo {{ person.name }}</h1>
          </div>
          <label v-if="konto && konto.gremien.length > 1" class="wechsel">
            <span class="label">Gremium</span>
            <select class="input" :value="gremium.id" @change="wechseln($event.target.value)">
              <option v-for="g in konto.gremien" :key="g.gremiumId" :value="g.gremiumId">{{ g.name }}{{ g.rolle === 'eigentuemer' ? ' (verwalten)' : '' }}</option>
            </select>
          </label>
        </div>
        <p class="muted small mt-1">Deine Sitzungen, Terminfindungen und Pendenzen. Bearbeiten kannst du, was dir zugewiesen ist – als Sitzungsleitung oder Protokollführung das ganze Dokument.</p>
      </header>

      <section v-if="!konto" class="card konto">
        <h2 class="card-title">Eigenes Konto</h2>
        <template v-if="sync.zugriff.benutzerId">
          <p class="hint">Dieser Link ist mit einem Konto verknüpft. Mit dem Konto siehst du alle deine Gremien an einem Ort.</p>
          <router-link to="/login" class="btn">Mit Konto anmelden</router-link>
        </template>
        <template v-else>
          <p class="hint">Ein Konto braucht es nicht – dein Link genügt. Mit einem Konto kannst du dich aber mit E-Mail und Passwort anmelden und alle Gremien, in denen du mitarbeitest, an einem Ort sehen.</p>
          <div class="row" style="gap: 0.5rem 1.5rem">
            <label class="check small"><input v-model="kontoModus" type="radio" value="neu" /> Konto erstellen</label>
            <label class="check small"><input v-model="kontoModus" type="radio" value="bestehend" /> Ich habe schon ein Konto</label>
          </div>
          <form class="stack" style="max-width: 24rem" @submit.prevent="kontoSenden">
            <input v-if="kontoModus === 'neu'" v-model.trim="kontoForm.name" class="input" placeholder="Name" required />
            <input v-model.trim="kontoForm.email" class="input" type="email" placeholder="E-Mail" required autocomplete="username" />
            <input v-model="kontoForm.passwort" class="input" type="password" :placeholder="kontoModus === 'neu' ? 'Passwort (mindestens 8 Zeichen)' : 'Passwort'" required :autocomplete="kontoModus === 'neu' ? 'new-password' : 'current-password'" />
            <p v-if="kontoFehler" class="small text-err">{{ kontoFehler }}</p>
            <button class="btn btn-primary" :disabled="kontoLaeuft">{{ kontoModus === 'neu' ? 'Konto erstellen und verknüpfen' : 'Anmelden und verknüpfen' }}</button>
            <SsoButtons :verknuepfen="api.token" :text="kontoModus === 'neu' ? 'registrieren' : 'anmelden'" />
          </form>
        </template>
      </section>

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

      <GremiumSuche :gremium-id="gremium.id" />

      <section class="card">
        <h2 class="card-title">Sitzungen</h2>
        <p v-if="!sitzungen.length" class="muted small">Noch keine Sitzungen.</p>
        <div v-else class="zeilen" style="--spalten: auto 2fr auto 1fr">
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

      <ThemenbereichLinks :gremium="gremium" />
    </div>
    <p v-else class="muted">{{ konto ? 'Du bist in keinem Gremium als Mitglied hinterlegt.' : 'Dieser Zugang ist keinem Mitglied zugeordnet.' }}</p>
  `,
  data() {
    const email = sync.zugriff.personEmail || ''
    return {
      sync,
      api,
      kalenderKopiert: false,
      kontoModus: 'neu',
      kontoForm: { name: sync.zugriff.personName || '', email, passwort: '' },
      kontoFehler: '',
      kontoLaeuft: false,
      SITZUNG_STATUS,
      SITZUNG_STATUS_KLASSE,
      PENDENZ_STATUS,
      PENDENZ_STATUS_KLASSE,
    }
  },
  computed: {
    konto() {
      return sync.zugriff?.rolle === 'benutzer' ? sync.zugriff : null
    },
    // Konto: gewünschtes, zuletzt gewähltes oder erstes Gremium mit Mitgliedschaft
    aktivesGremiumId() {
      if (!this.konto) return sync.zugriff?.gremiumId
      const mitglied = this.konto.gremien.filter((g) => g.rolle === 'mitglied').map((g) => g.gremiumId)
      const gewuenscht = this.gremiumId || localStorage.getItem(AKTIV_KEY)
      return mitglied.includes(gewuenscht) ? gewuenscht : mitglied[0]
    },
    kalenderLink() {
      const gremium = this.konto ? '&gremium=' + this.gremium.id : ''
      return location.origin + location.pathname.replace(/[^/]*$/, '') + 'api.php?aktion=ical&token=' + api.token + gremium
    },
    gremium() {
      return gremienStore.byId(this.aktivesGremiumId)
    },
    person() {
      return this.gremium?.mitglieder.find((m) => m.id === personIdIm(this.gremium.id))
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
  watch: {
    aktivesGremiumId: {
      immediate: true,
      handler(id) {
        if (this.konto && id) localStorage.setItem(AKTIV_KEY, id)
      },
    },
  },
  methods: {
    formatDatum,
    sitzungStatus,
    istLeitung,
    wechseln(gremiumId) {
      const g = this.konto.gremien.find((g) => g.gremiumId === gremiumId)
      this.$router.push(g.rolle === 'eigentuemer' ? '/gremium/' + gremiumId : '/meine/' + gremiumId)
    },
    // Konto über den persönlichen Link erstellen bzw. bestehendes Konto anmelden – der Link wird mit dem Konto verknüpft
    async kontoSenden() {
      this.kontoLaeuft = true
      this.kontoFehler = ''
      const gremiumId = this.gremium.id
      try {
        const daten = await api.anfrage(this.kontoModus === 'neu' ? 'registrieren' : 'anmelden', '', this.kontoForm)
        api.setToken(daten.token)
        sync.zugriff = null
        await laden()
        this.$router.push('/meine/' + gremiumId)
      } catch (fehler) {
        this.kontoFehler = fehler.message
      }
      this.kontoLaeuft = false
    },
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
