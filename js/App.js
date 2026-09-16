import { sync, abmelden } from './stores/sync.js'
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
            <template v-if="sync.zugriff">
              <span v-if="!['verfolger', 'themenbereich'].includes(sync.zugriff.rolle)" class="status" :class="statusKlasse" :data-tip="statusText"></span>
              <span class="rolle">{{ rolleText }}</span>
            </template>
            <router-link v-if="sync.zugriff && !['verfolger', 'themenbereich', 'freigabe'].includes(sync.zugriff.rolle)" :to="startPfad" class="icon-btn" :data-tip="startPfad.startsWith('/meine') ? 'Meine Übersicht' : 'Gremien'">
              <svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>
            </router-link>
            <Benachrichtigungen v-if="sync.zugriff && !['verfolger', 'themenbereich', 'freigabe'].includes(sync.zugriff.rolle)" />
            <router-link v-if="sync.zugriff?.rolle === 'admin'" to="/benutzer" class="icon-btn" data-tip="Benutzer & Links">
              <svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.5a5 5 0 0 1 6 5"/></svg>
            </router-link>
            <router-link v-if="sync.zugriff?.rolle === 'benutzer'" to="/konto" class="icon-btn" data-tip="Mein Konto">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20.5a8 8 0 0 1 16 0"/></svg>
            </router-link>
            <router-link v-if="sync.zugriff?.rolle === 'admin'" to="/einstellungen" class="icon-btn" :class="{ hinweis: updateStand.verfuegbar }" :data-tip="updateStand.verfuegbar ? 'Update verfügbar' : 'Einstellungen'">
              <svg viewBox="0 0 24 24"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
            </router-link>
            <router-link to="/hilfe" class="icon-btn hilfe" data-tip="Hilfe & Dokumentation">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7"/><circle cx="12" cy="17" r=".6" fill="currentColor"/></svg>
            </router-link>
            <button v-if="sync.zugriff" class="icon-btn" data-tip="Abmelden" @click="abmelden">
              <svg viewBox="0 0 24 24"><path d="M10 4H5v16h5"/><path d="M14 8l4 4-4 4"/><path d="M18 12H9"/></svg>
            </button>
          </nav>
        </div>
      </header>
      <main class="page">
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
    return { sync, ROLLEN, updateStand, domain: location.hostname }
  },
  watch: {
    // Nach der Anmeldung als Superadmin einmal täglich auf Updates prüfen
    'sync.zugriff.rolle': { immediate: true, handler: () => updatePruefen() },
  },
  computed: {
    startPfad() {
      return startPfad()
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
  methods: { abmelden },
}
