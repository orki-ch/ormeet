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
        <p class="hint" style="margin: 0">Vor einem Update empfiehlt sich eine Sicherung des Ordners <code>data/</code>. Nach der Installation lädt die Seite neu.</p>
      </section>
    </div>
  `,
  data() {
    return { updateStand, laeuft: false, schritt: '', ergebnis: null, quelle: 'GitHub (orki-ch/ormeet)' }
  },
  created() {
    this.pruefen()
  },
  methods: {
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
