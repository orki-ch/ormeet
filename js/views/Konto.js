import { api } from '../api.js'
import { sync, laden } from '../stores/sync.js'
import SsoButtons from '../components/SsoButtons.js'

// Eigenes Konto: Name, Passwort, SSO-Verknüpfungen, Geräte
export default {
  name: 'Konto',
  components: { SsoButtons },
  template: `
    <div class="stack-lg">
      <header class="page-header" style="margin-bottom: 0">
        <p class="kicker">{{ konto.email }}</p>
        <h1 class="title">Mein Konto</h1>
      </header>

      <div class="grid-2">
        <form class="card stack" @submit.prevent="speichern({ name })">
          <h2 class="card-title">Name</h2>
          <input v-model.trim="name" class="input" required />
          <div><button class="btn btn-primary" :disabled="laeuft">Speichern</button></div>
        </form>

        <form class="card stack" @submit.prevent="passwortAendern">
          <h2 class="card-title">{{ konto.hatPasswort ? 'Passwort ändern' : 'Passwort festlegen' }}</h2>
          <p v-if="!konto.hatPasswort" class="hint">Du meldest dich bisher nur über einen Anbieter an. Mit einem Passwort geht es auch direkt mit deiner E-Mail.</p>
          <input v-if="konto.hatPasswort" v-model="passwortAlt" class="input" type="password" placeholder="Bisheriges Passwort" required autocomplete="current-password" />
          <input v-model="passwortNeu" class="input" type="password" placeholder="Neues Passwort (mindestens 8 Zeichen)" required autocomplete="new-password" />
          <div><button class="btn btn-primary" :disabled="laeuft">Passwort speichern</button></div>
        </form>
      </div>

      <section class="card stack">
        <h2 class="card-title">Anmeldung über Anbieter</h2>
        <p v-if="konto.sso.length" class="small">Verknüpft: <span v-for="a in konto.sso" :key="a" class="badge brand" style="margin-right: 0.4rem">{{ a }} <a href="#" class="leise" @click.prevent="speichern({ ssoLoesen: a })">✕</a></span></p>
        <p v-else class="muted small">Noch kein Anbieter verknüpft.</p>
        <p class="hint">Die E-Mail beim Anbieter muss mit der E-Mail deines Kontos übereinstimmen, sonst entsteht ein zweites Konto.</p>
        <SsoButtons text="verknüpfen" />
      </section>

      <section class="card stack">
        <h2 class="card-title">Geräte</h2>
        <p class="small muted">Du bist auf {{ konto.geraete || 1 }} Gerät(en) angemeldet. Alle anderen Anmeldungen kannst du hier beenden.</p>
        <div><button class="btn" :disabled="laeuft" @click="speichern({ alleAbmelden: true })">Andere Geräte abmelden</button></div>
      </section>

      <p v-if="meldung" class="small" :class="fehler ? 'text-err' : 'text-ok'">{{ meldung }}</p>
    </div>
  `,
  data() {
    return { name: sync.zugriff.name, passwortAlt: '', passwortNeu: '', laeuft: false, meldung: '', fehler: false }
  },
  computed: {
    konto() {
      return sync.zugriff
    },
  },
  methods: {
    async speichern(daten) {
      this.laeuft = true
      this.meldung = ''
      try {
        const antwort = await api.anfrage('konto_aendern', '', daten)
        Object.assign(sync.zugriff, antwort.benutzer)
        this.fehler = false
        this.meldung = 'Gespeichert.'
      } catch (fehler) {
        this.fehler = true
        this.meldung = fehler.message
      }
      this.laeuft = false
    },
    async passwortAendern() {
      await this.speichern({ passwortAlt: this.passwortAlt, passwortNeu: this.passwortNeu })
      if (!this.fehler) this.passwortAlt = this.passwortNeu = ''
    },
  },
}
