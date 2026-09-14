import { api } from '../api.js'
import { laden } from '../stores/sync.js'

export default {
  name: 'Login',
  template: `
    <form class="card login stack" @submit.prevent="anmelden">
      <div>
        <h1>Anmelden</h1>
        <p class="muted small mt-1">Superadmin-Passwort eingeben. Gremien-Mitglieder verwenden den Zugangs-Link, den sie erhalten haben.</p>
      </div>
      <input v-model="passwort" type="password" class="input" placeholder="Passwort" required autofocus />
      <p v-if="fehler" class="small text-err">{{ fehler }}</p>
      <button class="btn btn-primary btn-block" :disabled="laeuft">Anmelden</button>
    </form>
  `,
  data() {
    return { passwort: '', fehler: '', laeuft: false }
  },
  methods: {
    async anmelden() {
      this.laeuft = true
      this.fehler = ''
      api.setToken(this.passwort)
      try {
        await laden()
        this.$router.push('/')
      } catch (fehler) {
        api.setToken('')
        this.fehler = fehler.message
      }
      this.laeuft = false
    },
  },
}
