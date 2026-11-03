import { api } from '../api.js'
import { laden } from '../stores/sync.js'
import { startPfad } from '../router.js'
import SsoButtons from '../components/SsoButtons.js'

export default {
  name: 'Login',
  components: { SsoButtons },
  template: `
    <form v-if="vergessen" class="card login stack" @submit.prevent="linkAnfordern">
      <div>
        <h1>Passwort vergessen</h1>
        <p class="muted small mt-1">Gib die E-Mail deines Kontos ein. Du erhältst einen Link, mit dem du ein neues Passwort festlegst.</p>
      </div>
      <template v-if="!gesendet">
        <input v-model.trim="email" type="email" class="input" placeholder="E-Mail" required autofocus autocomplete="username" />
        <p v-if="fehler" class="small text-err">{{ fehler }}</p>
        <button class="btn btn-primary btn-block" :disabled="laeuft">Link senden</button>
      </template>
      <p v-else class="small text-ok">Falls es ein Konto mit dieser E-Mail gibt, ist ein Link unterwegs. Er gilt eine Stunde. Schau auch im Spam-Ordner nach.</p>
      <p class="small center"><a href="#" class="leise" @click.prevent="vergessen = false; gesendet = false; fehler = ''">Zurück zur Anmeldung</a></p>
    </form>
    <form v-else class="card login stack" @submit.prevent="anmelden">
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
      <p v-if="!superadmin" class="small"><a href="#" class="leise" @click.prevent="vergessen = true; fehler = ''">Passwort vergessen?</a></p>
      <SsoButtons v-if="!superadmin" />
      <p class="small center"><a href="#" class="leise" @click.prevent="superadmin = !superadmin; fehler = ''">{{ superadmin ? 'Mit Konto anmelden' : 'Als Superadmin anmelden' }}</a></p>
    </form>
  `,
  data() {
    return { email: '', passwort: '', fehler: this.$route.query.fehler || '', laeuft: false, superadmin: false, vergessen: false, gesendet: false }
  },
  methods: {
    async linkAnfordern() {
      this.laeuft = true
      this.fehler = ''
      try {
        await api.anfrage('passwort_vergessen', '', { email: this.email })
        this.gesendet = true
      } catch (fehler) {
        this.fehler = fehler.message
      }
      this.laeuft = false
    },
    async anmelden() {
      this.laeuft = true
      this.fehler = ''
      try {
        // Superadmin (ohne E-Mail) und Konto erhalten einen Token; das Passwort bleibt nicht im Browser
        const daten = this.superadmin ? { passwort: this.passwort } : { email: this.email, passwort: this.passwort }
        api.setToken((await api.anfrage('anmelden', '', daten)).token)
        await laden()
        this.$router.push(this.$route.query.weiter?.startsWith('/') ? this.$route.query.weiter : startPfad()) // z. B. Link aus einer E-Mail
      } catch (fehler) {
        api.setToken('')
        this.fehler = fehler.message
      }
      this.laeuft = false
    },
  },
}
