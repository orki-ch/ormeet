import { api } from '../api.js'
import { updateStand, updatePruefen } from '../stores/updates.js'

// Superadmin: Version, Update-Prüfung und Installation
export default {
  name: 'Einstellungen',
  template: `
    <div class="stack-lg">
      <header class="page-header" style="margin-bottom: 0">
        <p class="kicker">Superadmin</p>
        <h1 class="title">Einstellungen</h1>
      </header>

      <section class="card stack">
        <div class="card-head">
          <h2 class="card-title">Version & Updates</h2>
          <button class="btn" :disabled="laeuft" @click="pruefen">Auf Updates prüfen</button>
        </div>
        <div class="grid-3 small">
          <div><span class="label">Installierte Version</span>{{ updateStand.lokal || '–' }}</div>
          <div><span class="label">Aktuelle Version</span>{{ updateStand.aktuell || '–' }}</div>
          <div><span class="label">Zuletzt geprüft</span>{{ updateStand.geprueftUm || 'noch nie' }}</div>
        </div>
        <p v-if="updateStand.fehler" class="small text-err">{{ updateStand.fehler }}</p>
        <div v-if="updateStand.verfuegbar" class="banner">
          <div class="grow"><strong>Update auf Version {{ updateStand.aktuell }} verfügbar.</strong>
            <span class="muted small">Die Dateien werden von {{ quelle }} geladen und ersetzt; Daten, Passwort und Kontaktangabe bleiben erhalten.</span></div>
          <button class="btn btn-primary" :disabled="laeuft" @click="installieren">Update installieren</button>
        </div>
        <p v-else-if="updateStand.aktuell && !updateStand.fehler" class="small text-ok">Ormeet ist auf dem neusten Stand.</p>
        <p v-if="laeuft" class="small muted">{{ schritt }}</p>
        <details v-if="ergebnis" class="aufklapp">
          <summary>Installation abgeschlossen <span class="sub">{{ ergebnis.dateien.length }} Dateien</span></summary>
          <ul class="inhalt small muted" style="padding-left: 1.2rem"><li v-for="d in ergebnis.dateien" :key="d">{{ d }}</li></ul>
        </details>
        <p class="hint" style="margin: 0">Vor einem Update empfiehlt sich eine Sicherung des Ordners <code>data/</code> und der Datei <code>schluessel.php</code>. Nach der Installation lädt die Seite neu.</p>
      </section>

      <form v-if="sso" class="card stack" @submit.prevent="ssoSpeichern">
        <div class="card-head">
          <h2 class="card-title">Anmeldung über Anbieter (SSO)</h2>
          <button class="btn btn-primary" :disabled="laeuft">Speichern</button>
        </div>
        <p class="hint">Personen mit Konto können sich über Sublevia oder Orki anmelden und registrieren. Dazu beim Anbieter eine Anwendung mit dieser Rückruf-Adresse anlegen und Client-ID und Client-Secret hier eintragen. Leer lassen, wenn nicht gewünscht.</p>
        <div class="row"><span class="label" style="margin: 0">Rückruf-Adresse (Redirect URI)</span><code class="input grow truncate" style="line-height: 1.5">{{ sso.callback }}</code></div>
        <div v-for="(name, id) in sso.anbieter" :key="id" class="block-soft stack-sm">
          <strong>{{ name }}</strong>
          <div class="grid-3">
            <div><span class="label">Server-URL</span><input v-model.trim="sso.sso[id].url" class="input" :placeholder="id === 'sublevia' ? 'https://orki-auth.sublevia.ch' : 'https://meine-organisation.orki.ch'" /></div>
            <div><span class="label">Client-ID</span><input v-model.trim="sso.sso[id].clientId" class="input" /></div>
            <div><span class="label">Client-Secret</span><input v-model.trim="sso.sso[id].clientSecret" class="input" type="password" autocomplete="off" /></div>
          </div>
        </div>
        <p v-if="ssoMeldung" class="small" :class="ssoFehler ? 'text-err' : 'text-ok'">{{ ssoMeldung }}</p>
      </form>
    </div>
  `,
  data() {
    return { updateStand, laeuft: false, schritt: '', ergebnis: null, quelle: 'GitHub (orki-ch/ormeet)', sso: null, ssoMeldung: '', ssoFehler: false }
  },
  async created() {
    this.pruefen()
    const sso = await api.anfrage('einstellungen_lesen')
    for (const id of Object.keys(sso.anbieter)) sso.sso[id] = { url: '', clientId: '', clientSecret: '', ...sso.sso[id] }
    this.sso = sso
  },
  methods: {
    async ssoSpeichern() {
      this.ssoMeldung = ''
      try {
        await api.anfrage('einstellungen_speichern', '', { sso: this.sso.sso })
        this.ssoFehler = false
        this.ssoMeldung = 'Gespeichert.'
      } catch (fehler) {
        this.ssoFehler = true
        this.ssoMeldung = fehler.message
      }
    },
    async pruefen() {
      this.laeuft = true
      this.schritt = 'Prüfe auf Updates …'
      await updatePruefen(true)
      this.laeuft = false
    },
    async installieren() {
      if (!confirm(`Update auf Version ${updateStand.aktuell} jetzt installieren?`)) return
      this.laeuft = true
      this.schritt = 'Lade Paket und ersetze Dateien …'
      try {
        this.ergebnis = await api.anfrage('update_installieren')
        updateStand.lokal = this.ergebnis.version
        updateStand.verfuegbar = false
        this.schritt = 'Fertig – Seite wird neu geladen …'
        setTimeout(() => location.reload(), 2500)
      } catch (fehler) {
        updateStand.fehler = fehler.message
        this.laeuft = false
      }
    },
  },
}
