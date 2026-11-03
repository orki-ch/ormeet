import { api } from '../api.js'
import { laden, sync } from '../stores/sync.js'
import { startPfad } from '../router.js'

// Passwort vergessen: neues Passwort über den Link aus der E-Mail festlegen; danach ist man angemeldet
export default {
  name: 'PasswortNeu',
  props: {
    code: { type: String, required: true },
  },
  template: `
    <form class="card login stack" @submit.prevent="speichern">
      <div>
        <h1>Neues Passwort</h1>
        <p class="muted small mt-1">Lege ein neues Passwort für dein Konto fest. Andere Geräte werden dabei abgemeldet.</p>
      </div>
      <input v-model="passwort" type="password" class="input" placeholder="Neues Passwort (mindestens 8 Zeichen)" minlength="8" required autofocus autocomplete="new-password" />
      <input v-model="wiederholung" type="password" class="input" placeholder="Passwort wiederholen" required autocomplete="new-password" />
      <p v-if="fehler" class="small text-err">{{ fehler }}</p>
      <button class="btn btn-primary btn-block" :disabled="laeuft">Speichern und anmelden</button>
      <p class="small center"><router-link to="/login" class="leise">Zur Anmeldung</router-link></p>
    </form>
  `,
  data() {
    return { passwort: '', wiederholung: '', fehler: '', laeuft: false }
  },
  methods: {
    async speichern() {
      if (this.passwort !== this.wiederholung) {
        this.fehler = 'Die beiden Passwörter stimmen nicht überein'
        return
      }
      this.laeuft = true
      this.fehler = ''
      try {
        const { token } = await api.anfrage('passwort_zuruecksetzen', '', { code: this.code, passwort: this.passwort })
        api.setToken(token)
        sync.zugriff = null
        await laden()
        this.$router.replace(startPfad())
      } catch (fehler) {
        this.fehler = fehler.message
      }
      this.laeuft = false
    },
  },
}
