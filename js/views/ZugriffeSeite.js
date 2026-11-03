import { gremienStore } from '../stores/gremien.js'
import { sitzungenStore } from '../stores/sitzungen.js'
import { verwaltetSitzung } from '../utils/rechte.js'
import { formatDatum } from '../utils/labels.js'
import ZugriffeListe from '../components/ZugriffeListe.js'

// Zugriffsübersicht einer Sitzung: wer Zugriff hat und worüber, Links verwalten
export default {
  name: 'ZugriffeSeite',
  components: { ZugriffeListe },
  props: {
    sitzungId: { type: String, required: true },
  },
  template: `
    <div v-if="sitzung && darf" class="stack-lg">
      <header class="page-header" style="margin-bottom: 0">
        <router-link :to="zurueck" class="rueck">← {{ sitzung.titel || 'Sitzung' }}</router-link>
        <p class="kicker">Zugriffe · {{ gremium.kurz ? 'Kurzsitzung' : gremium.name }}{{ sitzung.datum ? ' · ' + formatDatum(sitzung.datum) : '' }}</p>
        <h1 class="title">Wer hat Zugriff?</h1>
      </header>
      <section class="card">
        <p class="hint">Alle Personen und Links dieser Sitzung, mit dem Weg, über den sie hineinkommen, und wann sie zuletzt da waren. Über ⋯ sperrst du Personen für diese Sitzung, erneuerst Links oder versiehst sie mit Passwort und Ablauf.</p>
        <ZugriffeListe :gremium-id="gremium.id" :sitzung-id="sitzung.id" />
      </section>
    </div>
    <p v-else class="muted">Die Zugriffe einer Sitzung sehen nur Sitzungsleitung, Protokollführung, Eigentümer und Superadmin.</p>
  `,
  computed: {
    sitzung() {
      return sitzungenStore.sitzungById(this.sitzungId)
    },
    gremium() {
      return gremienStore.byId(this.sitzung.gremiumId)
    },
    darf() {
      return verwaltetSitzung(this.sitzung)
    },
    zurueck() {
      const s = this.sitzung
      if (s.terminfindung?.status === 'offen' || !s.datum) return `/sitzung/${s.id}/terminfindung`
      return `/sitzung/${s.id}/${sitzungenStore.protokollVonSitzung(s.id) || s.kurz ? 'protokoll' : 'vorprotokoll'}`
    },
  },
  methods: {
    formatDatum,
  },
}
