import { gremienStore } from '../stores/gremien.js'
import { sitzungenStore } from '../stores/sitzungen.js'
import { sync } from '../stores/sync.js'
import { rolleIm } from '../utils/rechte.js'
import KurzsitzungDialog from '../components/KurzsitzungDialog.js'
import KurzsitzungenListe from '../components/KurzsitzungenListe.js'

// Übersicht: Gremien und darunter die Kurzsitzungen ohne Gremium. persoenlich: Übersicht des Superadmins über das mit
// ihm verknüpfte Konto – genau wie ein Konto sie sieht (sein Superadmin-Zugriff spielt dort keine Rolle).
export default {
  name: 'GremiumListe',
  components: { KurzsitzungDialog, KurzsitzungenListe },
  props: {
    persoenlich: { type: Boolean, default: false },
  },
  template: `
    <div class="stack-lg">
      <header class="page-header" style="margin-bottom: 0">
        <h1 class="title">{{ konto ? 'Meine Gremien' : 'Gremien' }}</h1>
        <p v-if="konto" class="muted small mt-1">Gremien, in denen du Mitglied bist, öffnen deine persönliche Übersicht; selbst angelegte Gremien verwaltest du vollständig.</p>
      </header>

      <form v-if="darfAnlegen" class="card row" @submit.prevent="erstellen">
        <input v-model.trim="name" class="input grow" placeholder="Name (z. B. OK Camp)" required />
        <input v-model.trim="beschreibung" class="input grow" placeholder="Beschreibung" />
        <button class="btn btn-primary">Gremium anlegen</button>
      </form>

      <p v-if="!gremien.length && !(konto && kurzsitzungen.length)" class="muted">{{ konto ? 'Du bist noch in keinem Gremium hinterlegt. Öffne den persönlichen Link, den du erhalten hast, um ihn mit deinem Konto zu verknüpfen.' : 'Noch keine Gremien vorhanden.' }}</p>

      <div class="grid-karten">
        <router-link v-for="g in gremien" :key="g.id" :to="ziel(g)" class="card karte-link">
          <h2>{{ g.name }}</h2>
          <p class="muted small mt-1">{{ g.beschreibung }}</p>
          <p class="leise small mt-2">{{ g.mitglieder.length }} Mitglieder · {{ anzahlSitzungen(g.id) }} Sitzungen<span v-if="konto"> · {{ eintrag(g.id)?.rolle === 'eigentuemer' ? 'verwalten' : 'Mitglied' }}</span></p>
        </router-link>
      </div>

      <template v-if="kurzsitzungen.length || darfKurzAnlegen">
        <header class="page-header row between" style="margin: 1rem 0 0">
          <h1 class="title">Kurzsitzungen</h1>
          <button v-if="darfKurzAnlegen" class="btn btn-primary" @click="dialog = true">+ Kurzsitzung</button>
        </header>
        <section class="card">
          <KurzsitzungenListe :sitzungen="kurzsitzungen" :darf-loeschen="darfLoeschen" />
        </section>
      </template>

      <KurzsitzungDialog v-if="dialog" @schliessen="dialog = false" />
    </div>
  `,
  data() {
    return { name: '', beschreibung: '', dialog: false }
  },
  computed: {
    // Konto, dessen Übersicht gezeigt wird (eigenes Konto bzw. das mit dem Superadmin verknüpfte)
    konto() {
      return this.persoenlich ? sync.zugriff?.konto : sync.zugriff?.rolle === 'benutzer' ? sync.zugriff : null
    },
    gremien() {
      const ids = this.konto && new Set(this.konto.gremien.map((g) => g.gremiumId))
      return gremienStore.state.gremien.filter((g) => !g.kurz && (!ids || ids.has(g.id)))
    },
    // Kurzsitzungen ohne Gremium (ihr Behälter ist ein verstecktes Gremium)
    kurzsitzungen() {
      const ids = this.konto && new Set(this.konto.gremien.map((g) => g.gremiumId))
      return sitzungenStore.kurzsitzungen().filter((s) => gremienStore.byId(s.gremiumId)?.kurz && (!ids || ids.has(s.gremiumId)))
    },
    darfAnlegen() {
      return !this.persoenlich && (sync.zugriff?.rolle === 'admin' || !!this.konto?.darfGremienAnlegen)
    },
    darfKurzAnlegen() {
      return sync.zugriff?.rolle === 'admin' || !!this.konto?.darfKurzsitzungenAnlegen
    },
  },
  methods: {
    anzahlSitzungen(gremiumId) {
      return sitzungenStore.sitzungenVonGremium(gremiumId).length
    },
    eintrag(gremiumId) {
      return this.konto?.gremien.find((g) => g.gremiumId === gremiumId)
    },
    ziel(gremium) {
      if (this.persoenlich) return this.eintrag(gremium.id)?.rolle === 'mitglied' ? '/meine/' + gremium.id : '/gremium/' + gremium.id
      return rolleIm(gremium.id) === 'person' ? '/meine/' + gremium.id : '/gremium/' + gremium.id
    },
    // Löschen darf, wer die Kurzsitzung verwaltet (Superadmin, Eigentümer); in der persönlichen Übersicht nur das Konto
    darfLoeschen(s) {
      return this.persoenlich ? this.eintrag(s.gremiumId)?.rolle === 'eigentuemer' : rolleIm(s.gremiumId) === 'admin'
    },
    erstellen() {
      const gremium = gremienStore.erstelle(this.name, this.beschreibung)
      if (this.konto) {
        // Bis zum nächsten Abgleich gilt das Konto lokal als Eigentümer
        gremium.eigentuemerId = this.konto.benutzerId
        this.konto.gremien.push({ gremiumId: gremium.id, name: gremium.name, rolle: 'eigentuemer' })
      }
      this.$router.push('/gremium/' + gremium.id)
    },
  },
}
