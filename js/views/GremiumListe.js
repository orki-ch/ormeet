import { gremienStore } from '../stores/gremien.js'
import { sitzungenStore } from '../stores/sitzungen.js'
import { sync } from '../stores/sync.js'

export default {
  name: 'GremiumListe',
  template: `
    <div class="stack-lg">
      <header class="page-header" style="margin-bottom: 0">
        <h1 class="title">Gremien</h1>
      </header>

      <form v-if="istAdmin" class="card row" @submit.prevent="erstellen">
        <input v-model.trim="name" class="input grow" placeholder="Name (z. B. OK Camp)" required />
        <input v-model.trim="beschreibung" class="input grow" placeholder="Beschreibung" />
        <button class="btn btn-primary">Gremium anlegen</button>
      </form>

      <p v-if="!gremien.length" class="muted">Noch keine Gremien vorhanden.</p>

      <div class="grid-karten">
        <router-link v-for="g in gremien" :key="g.id" :to="'/gremium/' + g.id" class="card karte-link">
          <h2>{{ g.name }}</h2>
          <p class="muted small mt-1">{{ g.beschreibung }}</p>
          <p class="leise small mt-2">{{ g.mitglieder.length }} Mitglieder · {{ anzahlSitzungen(g.id) }} Sitzungen</p>
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
    istAdmin() {
      return sync.zugriff?.rolle === 'admin'
    },
  },
  methods: {
    anzahlSitzungen(gremiumId) {
      return sitzungenStore.sitzungenVonGremium(gremiumId).length
    },
    erstellen() {
      const gremium = gremienStore.erstelle(this.name, this.beschreibung)
      this.$router.push('/gremium/' + gremium.id)
    },
  },
}
