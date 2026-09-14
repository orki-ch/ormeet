import { api } from './api.js'
import { laden, sync, recht } from './stores/sync.js'
import { sitzungenStore } from './stores/sitzungen.js'
import Login from './views/Login.js'
import GremiumListe from './views/GremiumListe.js'
import GremiumDetail from './views/GremiumDetail.js'
import VorprotokollEditor from './views/VorprotokollEditor.js'
import ProtokollEditor from './views/ProtokollEditor.js'
import ThemenbereichSummary from './views/ThemenbereichSummary.js'
import ProtokollAnsicht from './views/ProtokollAnsicht.js'
import TerminfindungSeite from './views/TerminfindungSeite.js'
import PersonSeite from './views/PersonSeite.js'
import Hilfe from './views/Hilfe.js'
import Einstellungen from './views/Einstellungen.js'
import Datenschutz from './views/Datenschutz.js'

// Hash-History: läuft auf jedem Webserver ohne Rewrite-Regeln
const router = VueRouter.createRouter({
  history: VueRouter.createWebHashHistory(),
  routes: [
    { path: '/login', component: Login },
    { path: '/hilfe', component: Hilfe },
    { path: '/datenschutz', component: Datenschutz },
    { path: '/', component: GremiumListe },
    { path: '/meine', component: PersonSeite },
    { path: '/einstellungen', component: Einstellungen },
    { path: '/gremium/:gremiumId', component: GremiumDetail, props: true },
    { path: '/gremium/:gremiumId/themenbereich/:themenbereichId', component: ThemenbereichSummary, props: true },
    { path: '/sitzung/:sitzungId/vorprotokoll', component: VorprotokollEditor, props: true },
    { path: '/sitzung/:sitzungId/protokoll', component: ProtokollEditor, props: true },
    { path: '/sitzung/:sitzungId/terminfindung', component: TerminfindungSeite, props: true },
    // Links: Gremium-Zugang / zentraler Personen-Link
    { path: '/zugang/:zugangsKey', name: 'zugang', component: GremiumListe },
    // Freigabe-Link: Bearbeitung eines einzelnen Vorprotokolls (allgemein oder Gast)
    { path: '/freigabe/:freigabeLinkKey', name: 'freigabe', component: VorprotokollEditor, props: true },
    // Verfolger-Link: Live-Ansicht eines Protokolls (nur lesen)
    { path: '/verfolgen/:verfolgerKey', name: 'verfolgen', component: ProtokollAnsicht, props: true },
    // Übersichts-Link eines Themenbereichs (nur lesen)
    { path: '/themenbereich/:freigabeKey', name: 'themenbereich', component: ThemenbereichSummary, props: true },
  ],
})

// Daten mit dem gespeicherten Token laden (einmalig); bei ungültigem Token Token verwerfen
async function angemeldet() {
  if (sync.zugriff) return true
  if (!api.token) return false
  try {
    await laden()
    return true
  } catch {
    api.setToken('')
    return false
  }
}

// Link-Route: passt der aktuelle Zugang nicht, mit dem Link-Key als Token laden
async function mitLinkAnmelden(key, passt) {
  if (!(await angemeldet()) || !passt()) {
    api.setToken(key)
    sync.zugriff = null
    await angemeldet()
  }
  return true
}

router.beforeEach(async (to) => {
  if (['/login', '/hilfe', '/datenschutz'].includes(to.path)) return true

  if (to.name === 'zugang') {
    api.setToken(to.params.zugangsKey)
    sync.zugriff = null
    if (!(await angemeldet())) return '/login'
    if (to.query.weiter?.startsWith('/')) return to.query.weiter // z. B. aus dem Kalender direkt ins Vorprotokoll
    return sync.zugriff.rolle === 'person' ? '/meine' : `/gremium/${sync.zugriff.gremiumId}`
  }
  if (to.name === 'freigabe') {
    const key = to.params.freigabeLinkKey
    return mitLinkAnmelden(key, () => sitzungenStore.vorprotokollByKey(key) || sitzungenStore.vorprotokollByPersonKey(key))
  }
  if (to.name === 'verfolgen') {
    return mitLinkAnmelden(to.params.verfolgerKey, () => sitzungenStore.protokollByVerfolgerKey(to.params.verfolgerKey))
  }
  if (to.name === 'themenbereich') {
    return mitLinkAnmelden(to.params.freigabeKey, () => sync.zugriff?.themenbereichId)
  }

  if (!(await angemeldet())) return '/login'
  const zugriff = sync.zugriff
  const sitzungsPfad = to.path.startsWith('/sitzung/')

  // Ohne festen Termin gibt es kein Protokoll
  if (sitzungsPfad && to.path.endsWith('/protokoll')) {
    const sitzung = sitzungenStore.sitzungById(to.params.sitzungId)
    if (sitzung && !sitzung.datum) return `/sitzung/${sitzung.id}/vorprotokoll`
  }

  if (zugriff.rolle === 'verfolger') return `/verfolgen/${api.token}`
  if (zugriff.rolle === 'themenbereich') return `/themenbereich/${api.token}`
  if (zugriff.rolle === 'freigabe') {
    // Vorprotokoll-Link: zusätzlich die Terminfindung der zugehörigen Sitzung
    const vp = sitzungenStore.vorprotokollById(zugriff.vorprotokollId)
    if (to.path === `/sitzung/${vp?.sitzungId}/terminfindung`) return true
    return `/freigabe/${api.token}`
  }
  if (zugriff.rolle === 'person') {
    if (to.path === '/meine' || to.path.includes('/themenbereich/')) return true
    if (!sitzungsPfad) return '/meine'
    // Persönlicher Link darf kein Protokoll eröffnen
    if (to.path.endsWith('/protokoll') && !sitzungenStore.protokollVonSitzung(to.params.sitzungId)) return `/sitzung/${to.params.sitzungId}/vorprotokoll`
    return true
  }

  if (to.path === '/einstellungen' && zugriff.rolle !== 'admin') return '/'

  // Gremium-Zugang: Rechte auf Sitzungen beachten
  if (zugriff.rolle === 'gremium' && sitzungsPfad) {
    const gremiumPfad = `/gremium/${zugriff.gremiumId}`
    if (recht('sitzungen') === 'keine') return gremiumPfad
    if (recht('sitzungen') === 'lesen' && to.path.endsWith('/protokoll')) {
      const protokoll = sitzungenStore.protokollVonSitzung(to.params.sitzungId)
      return protokoll ? `/verfolgen/${protokoll.verfolgerKey}` : gremiumPfad
    }
  }
  return true
})

export default router
