import { gremienStore } from '../stores/gremien.js'
import { sitzungenStore } from '../stores/sitzungen.js'
import { sync } from '../stores/sync.js'
import { rolleIm } from '../utils/rechte.js'

export default {
  name: 'GremiumListe',
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

      <p v-if="!gremien.length" class="muted">{{ konto ? 'Du bist noch in keinem Gremium hinterlegt. Öffne den persönlichen Link, den du erhalten hast, um ihn mit deinem Konto zu verknüpfen.' : 'Noch keine Gremien vorhanden.' }}</p>

      <div class="grid-karten">
        <router-link v-for="g in gremien" :key="g.id" :to="ziel(g)" class="card karte-link">
          <h2>{{ g.name }}</h2>
          <p class="muted small mt-1">{{ g.beschreibung }}</p>
          <p class="leise small mt-2">{{ g.mitglieder.length }} Mitglieder · {{ anzahlSitzungen(g.id) }} Sitzungen<span v-if="konto"> · {{ rolleIm(g.id) === 'admin' ? 'verwalten' : 'Mitglied' }}</span></p>
        </router-link>
      </div>
    </div>
  `,
  data() {
    return { name: '', beschreibung: '' }
  },
  computed: {
    gremien() {
      return gremienStore.state.gremien
    },
    konto() {
      return sync.zugriff?.rolle === 'benutzer' ? sync.zugriff : null
    },
    darfAnlegen() {
      return sync.zugriff?.rolle === 'admin' || !!this.konto?.darfGremienAnlegen
    },
  },
  methods: {
    rolleIm,
    anzahlSitzungen(gremiumId) {
      return sitzungenStore.sitzungenVonGremium(gremiumId).length
    },
    ziel(gremium) {
      return rolleIm(gremium.id) === 'person' ? '/meine/' + gremium.id : '/gremium/' + gremium.id
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
