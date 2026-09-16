import { api } from '../api.js'
import { laden } from '../stores/sync.js'
import { startPfad } from '../router.js'
import SsoButtons from '../components/SsoButtons.js'

export default {
  name: 'Login',
  components: { SsoButtons },
  template: `
    <form class="card login stack" @submit.prevent="anmelden">
      <div>
        <h1>Anmelden</h1>
        <p v-if="superadmin" class="muted small mt-1">Superadmin-Passwort eingeben.</p>
        <p v-else class="muted small mt-1">Mit deinem Konto anmelden. Ohne Konto verwendest du einfach den Link, den du erhalten hast.</p>
      </div>
      <template v-if="superadmin">
        <input v-model="passwort" type="password" class="input" placeholder="Passwort" required autofocus />
      </template>
      <template v-else>
        <input v-model.trim="email" type="email" class="input" placeholder="E-Mail" required autofocus autocomplete="username" />
        <input v-model="passwort" type="password" class="input" placeholder="Passwort" required autocomplete="current-password" />
      </template>
      <p v-if="fehler" class="small text-err">{{ fehler }}</p>
      <button class="btn btn-primary btn-block" :disabled="laeuft">Anmelden</button>
      <SsoButtons v-if="!superadmin" />
      <p class="small center"><a href="#" class="leise" @click.prevent="superadmin = !superadmin; fehler = ''">{{ superadmin ? 'Mit Konto anmelden' : 'Als Superadmin anmelden' }}</a></p>
    </form>
  `,
  data() {
    return { email: '', passwort: '', fehler: this.$route.query.fehler || '', laeuft: false, superadmin: false }
  },
  methods: {
    async anmelden() {
      this.laeuft = true
      this.fehler = ''
      try {
        // Superadmin (ohne E-Mail) und Konto erhalten einen Token; das Passwort bleibt nicht im Browser
        const daten = this.superadmin ? { passwort: this.passwort } : { email: this.email, passwort: this.passwort }
        api.setToken((await api.anfrage('anmelden', '', daten)).token)
        await laden()
        this.$router.push(startPfad())
      } catch (fehler) {
        api.setToken('')
        this.fehler = fehler.message
      }
      this.laeuft = false
    },
  },
}
