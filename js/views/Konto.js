import { api } from '../api.js'
import { sync, laden } from '../stores/sync.js'
import SsoButtons from '../components/SsoButtons.js'
import InfoKnopf from '../components/InfoKnopf.js'
import { MITTEILUNGS_GRUPPEN } from '../stores/benachrichtigungen.js'

// Eigenes Konto: Name, Passwort, SSO-Verknüpfungen, Geräte
export default {
  name: 'Konto',
  components: { InfoKnopf, SsoButtons },
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
          <h2 class="card-title">{{ konto.hatPasswort ? 'Passwort ändern' : 'Passwort festlegen' }} <InfoKnopf v-if="!konto.hatPasswort" titel="Passwort festlegen" text="Du meldest dich bisher nur über einen Anbieter an. Mit einem Passwort geht es auch direkt mit deiner E-Mail." /></h2>
          <input v-if="konto.hatPasswort" v-model="passwortAlt" class="input" type="password" placeholder="Bisheriges Passwort" required autocomplete="current-password" />
          <input v-model="passwortNeu" class="input" type="password" placeholder="Neues Passwort (mindestens 8 Zeichen)" required autocomplete="new-password" />
          <div><button class="btn btn-primary" :disabled="laeuft">Passwort speichern</button></div>
        </form>
      </div>

      <section class="card stack">
        <h2 class="card-title">Anmeldung über Anbieter <InfoKnopf titel="Anbieter" text="Zum Verknüpfen meldest du dich einmal beim Anbieter an; danach kannst du dich auch damit bei diesem Konto anmelden. Ormeet übernimmt vom Anbieter keine Daten – Name und E-Mail bleiben die deines Kontos." /></h2>
        <p v-if="konto.sso.length" class="small">Verknüpft: <span v-for="a in konto.sso" :key="a" class="badge brand" style="margin-right: 0.4rem">{{ a }} <a href="#" class="leise" @click.prevent="speichern({ ssoLoesen: a })">✕</a></span></p>
        <p v-else class="muted small">Noch kein Anbieter verknüpft.</p>
        <SsoButtons text="verknüpfen" konto />
      </section>

      <section class="card stack">
        <h2 class="card-title">Mitteilungen <InfoKnopf titel="Mitteilungen" :text="'Gibt es Neues – eine Sitzung steht bevor, deine Stimme fehlt, eine Pendenz ist fällig –, erhältst du eine Sammelmail an ' + konto.email + ' im gewählten Rhythmus. Pro Art stellst du ein, ob sie per E-Mail kommt; mit der Glocke daneben blendest du sie auch in Ormeet (Glocke oben rechts) aus.'" /></h2>
        <label class="check small"><input type="checkbox" :checked="!konto.mailsAus" :disabled="laeuft" @change="speichern({ mailsAus: !$event.target.checked })" /> Mitteilungen per E-Mail erhalten</label>
        <div v-if="!konto.mailsAus" class="row">
          <span class="label">Rhythmus</span>
          <select v-model="mitteilungen.rhythmus" class="input klein w-md" :disabled="laeuft" @change="mitteilungenSpeichern">
            <option value="sofort">Sofort</option>
            <option value="taeglich">Täglich</option>
            <option value="woechentlich">Wöchentlich</option>
          </select>
          <select v-if="mitteilungen.rhythmus === 'woechentlich'" v-model.number="mitteilungen.wochentag" class="input klein w-sm" :disabled="laeuft" @change="mitteilungenSpeichern">
            <option v-for="(tag, i) in WOCHENTAGE" :key="i" :value="i + 1">am {{ tag }}</option>
          </select>
        </div>
        <div class="liste">
          <div v-for="(gruppe, key) in MITTEILUNGS_GRUPPEN" :key="key" class="liste-zeile">
            <div class="grow">
              <strong class="small">{{ gruppe.name }}</strong>
              <div class="leise small">{{ gruppe.beschreibung }}</div>
            </div>
            <label class="check small" :class="{ aus: konto.mailsAus }"><input type="checkbox" :checked="!konto.mailsAus && !mitteilungen.mailAus.includes(key)" :disabled="laeuft || konto.mailsAus" @change="umschalten('mailAus', key)" /> E-Mail</label>
            <button type="button" class="glocke-knopf" :class="{ aus: mitteilungen.glockeAus.includes(key) }" :disabled="laeuft" :aria-pressed="!mitteilungen.glockeAus.includes(key)" :aria-label="glockeText(key)" :data-tip="glockeText(key)" @click="umschalten('glockeAus', key)">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15z"/><path d="M10 21a2 2 0 0 0 4 0"/><path v-if="mitteilungen.glockeAus.includes(key)" d="M4 3l16 18"/></svg>
            </button>
          </div>
        </div>
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
    return { MITTEILUNGS_GRUPPEN, WOCHENTAGE: ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'], name: (sync.zugriff.rolle === 'admin' ? sync.zugriff.konto : sync.zugriff).name, passwortAlt: '', passwortNeu: '', laeuft: false, meldung: '', fehler: false }
  },
  computed: {
    // Konto-Anmeldung: der Zugriff selbst; Superadmin mit verknüpftem Konto: dieses Konto
    konto() {
      return sync.zugriff.rolle === 'admin' ? sync.zugriff.konto : sync.zugriff
    },
    // Rhythmus und ausgeschaltete Gruppen (E-Mail / Glocke); ältere Server liefern noch nichts
    mitteilungen() {
      return this.konto.mitteilungen
    },
  },
  created() {
    this.konto.mitteilungen ??= { rhythmus: 'taeglich', wochentag: 1, mailAus: [], glockeAus: [] }
  },
  methods: {
    async speichern(daten) {
      this.laeuft = true
      this.meldung = ''
      try {
        const antwort = await api.anfrage('konto_aendern', '', daten)
        Object.assign(this.konto, antwort.benutzer)
        this.fehler = false
        this.meldung = 'Gespeichert.'
      } catch (fehler) {
        this.fehler = true
        this.meldung = fehler.message
      }
      this.laeuft = false
    },
    mitteilungenSpeichern() {
      return this.speichern({ mitteilungen: this.mitteilungen })
    },
    umschalten(feld, gruppe) {
      const liste = this.mitteilungen[feld]
      this.mitteilungen[feld] = liste.includes(gruppe) ? liste.filter((g) => g !== gruppe) : [...liste, gruppe]
      return this.mitteilungenSpeichern()
    },
    glockeText(gruppe) {
      const name = MITTEILUNGS_GRUPPEN[gruppe].name
      return this.mitteilungen.glockeAus.includes(gruppe) ? `${name}: in der Glocke ausgeblendet – Klick blendet ein` : `${name}: in der Glocke sichtbar – Klick blendet aus`
    },
    async passwortAendern() {
      await this.speichern({ passwortAlt: this.passwortAlt, passwortNeu: this.passwortNeu })
      if (!this.fehler) this.passwortAlt = this.passwortNeu = ''
    },
  },
}
