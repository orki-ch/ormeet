import { sync, abmelden } from './stores/sync.js'
import { appStand } from './api.js'
import { updateStand, updatePruefen } from './stores/updates.js'
import { startPfad } from './router.js'
import Benachrichtigungen from './components/Benachrichtigungen.js'

const ROLLEN = { admin: 'Superadmin', gremium: 'Gremium-Zugang', person: 'Persönlicher Zugang', benutzer: 'Konto', freigabe: 'Freigabe-Link', verfolger: 'Live-Ansicht', themenbereich: 'Übersicht' }

export default {
  name: 'App',
  components: { Benachrichtigungen },
  template: `
    <div class="app">
      <header class="topbar">
        <div class="topbar-inner">
          <router-link :to="startPfad" class="brand"><img src="omeet_logo.svg" alt="Ormeet" /></router-link>
          <nav class="topbar-nav">
            <router-link v-if="sync.zugriff && !['verfolger', 'themenbereich', 'freigabe'].includes(sync.zugriff.rolle)" :to="startPfad" class="icon-btn" :data-tip="startPfad.startsWith('/meine') ? 'Meine Übersicht' : 'Gremien'">
              <svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>
            </router-link>
            <!-- Superadmin mit verknüpftem Konto: persönliche Übersicht dieses Kontos -->
            <router-link v-if="sync.zugriff?.rolle === 'admin' && sync.zugriff.konto" to="/uebersicht" class="icon-btn" data-tip="Meine Übersicht">
              <svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></svg>
            </router-link>
            <Benachrichtigungen v-if="sync.zugriff && !['verfolger', 'themenbereich', 'freigabe'].includes(sync.zugriff.rolle)" />
            <router-link to="/hilfe" class="icon-btn hilfe" data-tip="Hilfe & Dokumentation">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7"/><circle cx="12" cy="17" r=".6" fill="currentColor"/></svg>
            </router-link>
            <!-- Hauptmenü: Rolle und Speicherzustand als Kopf, seltene Ziele und Abmelden; ändert sich der Speicherzustand,
                 zuckt das Symbol kurz -->
            <div v-if="sync.zugriff" ref="menu" class="dropdown hauptmenu">
              <button type="button" class="icon-btn" :class="{ hinweis: updateStand.verfuegbar && istAdmin, puls }" data-tip="Menü" aria-label="Menü" @click="menuOffen = !menuOffen">
                <svg viewBox="0 0 24 24"><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></svg>
                <span v-if="speichert" class="status-punkt" :class="statusKlasse"></span>
              </button>
              <div v-if="menuOffen" class="dropdown-menu" @click="menuOffen = false">
                <div class="menu-kopf">
                  <strong>{{ rolleText }}</strong>
                  <span v-if="speichert" class="small" :class="'text-' + statusKlasse">● {{ statusText }}</span>
                </div>
                <router-link v-if="sync.zugriff.rolle === 'benutzer'" to="/konto" class="menu-item">Mein Konto</router-link>
                <router-link v-if="istAdmin" to="/benutzer" class="menu-item">Benutzer & Links</router-link>
                <router-link v-if="istAdmin" to="/einstellungen" class="menu-item">Einstellungen <span v-if="updateStand.verfuegbar" class="badge gelb">Update verfügbar</span></router-link>
                <button type="button" class="menu-item" @click="abmelden">Abmelden</button>
              </div>
            </div>
          </nav>
        </div>
      </header>
      <main class="page">
        <!-- Nach einem Update läuft dieser Tab noch mit alten Dateien – Neuladen holt die neue Version -->
        <div v-if="appStand.neueVersion" class="banner mb-2">
          <div class="grow"><strong>Ormeet wurde auf Version {{ appStand.neueVersion }} aktualisiert.</strong> Bitte die Seite neu laden, damit alles zusammenpasst.</div>
          <button class="btn btn-primary" @click="neuLaden">Neu laden</button>
        </div>
        <router-view />
      </main>
      <footer class="footer">
        <span>Ormeet · Sitzungsprotokolle</span>
        <router-link to="/datenschutz">Datenschutz</router-link>
        <router-link to="/hilfe">Hilfe & Dokumentation</router-link>
        <span class="ml-auto">{{ domain }}</span>
      </footer>
    </div>
  `,
  data() {
    return { sync, ROLLEN, updateStand, appStand, domain: location.hostname, menuOffen: false, puls: false }
  },
  mounted() {
    // Menü schliesst bei Klicks daneben (Capture-Phase wie MenuDropdown)
    document.addEventListener('click', this.menuSchliessen, true)
  },
  beforeUnmount() {
    document.removeEventListener('click', this.menuSchliessen, true)
  },
  watch: {
    // Speicherzustand geändert: Menü-Symbol kurz animieren
    statusKlasse() {
      this.puls = false
      this.$nextTick(() => (this.puls = true))
      clearTimeout(this.pulsTimer)
      this.pulsTimer = setTimeout(() => (this.puls = false), 700)
    },
    // Nach der Anmeldung als Superadmin einmal täglich auf Updates prüfen
    'sync.zugriff.rolle': { immediate: true, handler: () => updatePruefen() },
  },
  computed: {
    startPfad() {
      return startPfad()
    },
    istAdmin() {
      return sync.zugriff?.rolle === 'admin'
    },
    // Reine Lese-Zugänge speichern nie
    speichert() {
      return !['verfolger', 'themenbereich'].includes(sync.zugriff?.rolle)
    },
    rolleText() {
      if (sync.zugriff.rolle === 'benutzer') return sync.zugriff.name
      if (sync.zugriff.personName) return sync.zugriff.personName
      if (sync.zugriff.zugangName) return `Zugang: ${sync.zugriff.zugangName}`
      return ROLLEN[sync.zugriff.rolle]
    },
    statusText() {
      if (sync.status === 'fehler') return `Fehler beim Speichern: ${sync.fehler}`
      if (sync.ausstehend || sync.status === 'speichert') return 'Speichert …'
      return 'Gespeichert'
    },
    statusKlasse() {
      if (sync.status === 'fehler') return 'err'
      if (sync.ausstehend || sync.status === 'speichert') return 'warn'
      return 'ok'
    },
  },
  methods: {
    abmelden,
    menuSchliessen(event) {
      if (!this.$refs.menu?.contains(event.target)) this.menuOffen = false
    },
    // index.php ist nicht gecacht und verweist auf die versionierten Dateien
    neuLaden() {
      location.reload()
    },
  },
}
