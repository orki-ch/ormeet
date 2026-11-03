import { api } from '../api.js'
import { sync } from '../stores/sync.js'

// Link mit Passwort (einmal pro Gerät eingeben), abgelaufener oder gesperrter Zugang, mit einem Konto verknüpfter Link (nur mit Anmeldung)
export default {
  name: 'LinkGesperrt',
  template: `
    <form v-if="sync.gesperrt?.grund === 'passwort'" class="card login stack" @submit.prevent="entsperren">
      <div>
        <h1>Passwort</h1>
        <p class="muted small mt-1">Der Link «{{ sync.gesperrt.name }}» ist mit einem Passwort geschützt. Du erhältst es von der Person, die dir den Link geschickt hat. Auf diesem Gerät musst du es nur einmal eingeben.</p>
      </div>
      <input v-model="passwort" type="password" class="input" placeholder="Passwort" required autofocus autocomplete="off" />
      <p v-if="fehler" class="small text-err">{{ fehler }}</p>
      <button class="btn btn-primary btn-block" :disabled="laeuft">Öffnen</button>
    </form>
    <section v-else-if="sync.gesperrt?.grund === 'konto'" class="card login stack">
      <h1>Bitte anmelden</h1>
      <p class="muted small">Dieser Link gehört zum Konto von {{ sync.gesperrt.name }}. Er öffnet die Sitzungen nur noch nach der Anmeldung mit diesem Konto – so siehst du alle deine Gremien an einem Ort.</p>
      <router-link to="/login" class="btn btn-primary btn-block">Anmelden</router-link>
    </section>
    <section v-else class="card login stack">
      <h1>{{ sync.gesperrt?.grund === 'abgelaufen' ? 'Link abgelaufen' : 'Zugang gesperrt' }}</h1>
      <p class="muted small">{{ sync.gesperrt?.grund === 'abgelaufen' ? 'Dieser Link gilt nicht mehr.' : 'Dieser Zugang wurde gesperrt.' }} Wende dich an die Person, die dir den Link geschickt hat. Hast du ein Konto, kannst du dich damit anmelden.</p>
      <router-link to="/login" class="btn btn-block">Mit Konto anmelden</router-link>
    </section>
  `,
  data() {
    return { sync, passwort: '', fehler: '', laeuft: false }
  },
  methods: {
    async entsperren() {
      this.laeuft = true
      this.fehler = ''
      try {
        const { freischaltung } = await api.anfrage('link_entsperren', '', { passwort: this.passwort })
        api.freischalten(freischaltung)
        const ziel = sync.gesperrt.ziel || '/'
        sync.gesperrt = null
        sync.zugriff = null
        this.$router.replace(ziel)
      } catch (fehler) {
        this.fehler = fehler.message
      }
      this.laeuft = false
    },
  },
}
