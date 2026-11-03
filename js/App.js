import { sync, abmelden } from './stores/sync.js'
import { api, appStand } from './api.js'
import { bestaetigen } from './utils/dialog.js'
import { updateStand, updatePruefen } from './stores/updates.js'
import { startPfad } from './router.js'
import Benachrichtigungen from './components/Benachrichtigungen.js'
import KontoKarte from './components/KontoKarte.js'
import EintragDialog from './components/EintragDialog.js'
import { sitzungenStore } from './stores/sitzungen.js'

// Adresse, unter der ein Link-Zugang wieder geöffnet wird (Konto und Superadmin melden sich neu an)
const LINK_PFADE = { gremium: 'zugang', person: 'zugang', freigabe: 'freigabe', link: 'link', verfolger: 'verfolgen', themenbereich: 'themenbereich' }

const ROLLEN = { admin: 'Superadmin', gremium: 'Gremium-Zugang', person: 'Persönlicher Zugang', benutzer: 'Konto', freigabe: 'Freigabe-Link', link: 'Allgemeiner Link', verfolger: 'Live-Ansicht', themenbereich: 'Übersicht' }

export default {
  name: 'App',
  components: { Benachrichtigungen, EintragDialog, KontoKarte },
  template: `
    <div class="app">
      <header class="topbar">
        <div class="topbar-inner">
          <router-link :to="startPfad" class="brand"><img src="omeet_logo.svg" alt="Ormeet" /></router-link>
          <nav class="topbar-nav">
            <router-link v-if="sync.zugriff && !['verfolger', 'themenbereich', 'freigabe', 'link'].includes(sync.zugriff.rolle)" :to="startPfad" class="icon-btn" :data-tip="startPfad.startsWith('/meine') ? 'Meine Übersicht' : 'Gremien'">
              <svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>
            </router-link>
            <!-- Superadmin mit verknüpftem Konto: persönliche Übersicht dieses Kontos -->
            <router-link v-if="sync.zugriff?.rolle === 'admin' && sync.zugriff.konto" to="/uebersicht" class="icon-btn" data-tip="Meine Übersicht">
              <svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></svg>
            </router-link>
            <Benachrichtigungen v-if="sync.zugriff && !['verfolger', 'themenbereich', 'freigabe', 'link'].includes(sync.zugriff.rolle)" />
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
                <router-link v-if="sync.zugriff.rolle === 'benutzer' || (sync.zugriff.rolle === 'admin' && sync.zugriff.konto)" to="/konto" class="menu-item">Mein Konto</router-link>
                <router-link v-if="istAdmin" to="/benutzer" class="menu-item">Benutzer & Links</router-link>
                <router-link v-if="istAdmin" to="/einstellungen" class="menu-item">Einstellungen <span v-if="updateStand.verfuegbar" class="badge gelb">Update verfügbar</span></router-link>
                <button type="button" class="menu-item" @click="abmeldenFragen">Abmelden</button>
              </div>
            </div>
          </nav>
        </div>
      </header>
      <main class="page">
        <!-- «Ansehen als …»: dieser Tab zeigt die App aus Sicht einer anderen Person -->
        <div v-if="sync.zugriff?.ansicht" class="banner mb-2">
          <div class="grow"><strong>Ansicht als {{ sync.zugriff.ansichtName }}</strong> – nur lesen; Änderungen werden nicht gespeichert.</div>
          <button class="btn" @click="ansichtSchliessen">Ansicht schliessen</button>
        </div>
        <!-- Nach einem Update läuft dieser Tab noch mit alten Dateien – Neuladen holt die neue Version -->
        <div v-if="appStand.neueVersion" class="banner mb-2">
          <div class="grow"><strong>Ormeet wurde auf Version {{ appStand.neueVersion }} aktualisiert.</strong> Bitte die Seite neu laden, damit alles zusammenpasst.</div>
          <button class="btn btn-primary" @click="neuLaden">Neu laden</button>
        </div>
        <!-- Allgemeiner Link: zuerst Name und E-Mail (eigener Link), danach mit einem Klick zum eigenen Konto einladen -->
        <EintragDialog v-if="allgemeinerLink" />
        <KontoKarte v-if="kontoEinladen" />
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
    // Allgemeiner Link ohne feste Person (Freigabe-Link des Vorprotokolls oder zusätzlicher Link)
    allgemeinerLink() {
      const zugriff = sync.zugriff
      return zugriff?.rolle === 'link' || (zugriff?.rolle === 'freigabe' && !zugriff.personId)
    },
    // Über einen allgemeinen Link eingetragen, noch ohne Konto
    kontoEinladen() {
      const zugriff = sync.zugriff
      if (zugriff?.rolle !== 'freigabe' || !zugriff.weiterePerson) return false
      const gast = sitzungenStore.vorprotokollById(zugriff.vorprotokollId)?.gaeste.find((g) => g.id === zugriff.personId)
      return !!gast && !gast.benutzerId
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
    // Über einen Link angemeldet: zurück geht es nur mit dem Link – vorher fragen und Kopieren anbieten
    async abmeldenFragen() {
      this.menuOffen = false
      if (sync.zugriff?.ansicht) return this.ansichtSchliessen() // «Ansehen als …»: nur die Ansicht beenden, nicht abmelden
      const pfad = LINK_PFADE[sync.zugriff?.rolle]
      if (pfad) {
        const link = location.href.split('#')[0] + '#/' + pfad + '/' + api.token
        const text = 'Du verlässt diesen Link. Wieder hinein kommst du nur mit dem Link, zum Beispiel aus deiner E-Mail.'
        const kopieren = { text: 'Link kopieren', fertigText: 'Kopiert ✓', aktion: () => navigator.clipboard.writeText(link) }
        if (!(await bestaetigen(text, { titel: 'Abmelden', ja: 'Abmelden', extra: kopieren }))) return
      }
      abmelden()
    },
    menuSchliessen(event) {
      if (!this.$refs.menu?.contains(event.target)) this.menuOffen = false
    },
    // index.php ist nicht gecacht und verweist auf die versionierten Dateien
    neuLaden() {
      location.reload()
    },
    ansichtSchliessen() {
      api.ansichtBeenden()
      window.close()
      location.hash = '#/'
      location.reload()
    },
  },
}
