import { api } from './api.js'
import { laden, sync, recht } from './stores/sync.js'
import { sitzungenStore } from './stores/sitzungen.js'
import { rolleIm } from './utils/rechte.js'
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
import Benutzer from './views/Benutzer.js'
import Konto from './views/Konto.js'
import Datenschutz from './views/Datenschutz.js'

// Hash-History: läuft auf jedem Webserver ohne Rewrite-Regeln
const router = VueRouter.createRouter({
  history: VueRouter.createWebHashHistory(),
  routes: [
    { path: '/login', component: Login },
    { path: '/hilfe', component: Hilfe },
    { path: '/datenschutz', component: Datenschutz },
    { path: '/', component: GremiumListe },
    { path: '/meine/:gremiumId?', component: PersonSeite, props: true },
    { path: '/konto', component: Konto },
    { path: '/einstellungen', component: Einstellungen },
    { path: '/benutzer', component: Benutzer },
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
    const key = to.params.zugangsKey
    // Angemeldetes Konto öffnet einen persönlichen Link (16 Zeichen; Konto-Tokens sind länger): Mitglied mit dem Konto verknüpfen
    if (key.length === 16 && api.token && api.token !== key && (await angemeldet()) && sync.zugriff.rolle === 'benutzer') {
      // Eigener, schon verknüpfter Link (z. B. aus dem Kalender-Abo): direkt weiter
      const eigenes = sync.zugriff.gremien.find((g) => g.zugangsKey === key)
      if (eigenes) return to.query.weiter?.startsWith('/') ? to.query.weiter : `/meine/${eigenes.gremiumId}`
      if (confirm(`Du bist mit dem Konto ${sync.zugriff.email} angemeldet. Persönlichen Link mit diesem Konto verknüpfen? «Abbrechen» öffnet den Link ohne Konto.`)) {
        const verknuepft = await api.anfrage('verknuepfen', '', { key }).catch(() => null)
        if (verknuepft) {
          sync.zugriff = null
          await angemeldet()
          return `/meine/${verknuepft.gremiumId}`
        }
      }
    }
    api.setToken(key)
    sync.zugriff = null
    if (!(await angemeldet())) return '/login'
    if (to.query.weiter?.startsWith('/')) return to.query.weiter // z. B. aus dem Kalender direkt ins Vorprotokoll
    return startPfad()
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
  const sitzung = sitzungsPfad ? sitzungenStore.sitzungById(to.params.sitzungId) : null

  // Ohne festen Termin gibt es kein Protokoll
  if (sitzung && to.path.endsWith('/protokoll') && !sitzung.datum) return `/sitzung/${sitzung.id}/vorprotokoll`

  if (zugriff.rolle === 'verfolger') return `/verfolgen/${api.token}`
  if (zugriff.rolle === 'themenbereich') return `/themenbereich/${api.token}`
  if (zugriff.rolle === 'freigabe') {
    // Vorprotokoll-Link: zusätzlich die Terminfindung der zugehörigen Sitzung
    const vp = sitzungenStore.vorprotokollById(zugriff.vorprotokollId)
    if (to.path === `/sitzung/${vp?.sitzungId}/terminfindung`) return true
    return `/freigabe/${api.token}`
  }
  if (['/einstellungen', '/benutzer'].includes(to.path) && zugriff.rolle !== 'admin') return startPfad()
  if (to.path === '/konto') return zugriff.rolle === 'benutzer' ? true : startPfad()

  // Wirksame Rolle im betroffenen Gremium (Konto: je Gremium Eigentümer oder Mitglied)
  const gremiumId = sitzung?.gremiumId || to.params.gremiumId || zugriff.gremiumId
  const rolle = rolleIm(gremiumId)
  if (zugriff.rolle === 'person' && to.path === '/meine') return true
  if (zugriff.rolle === 'benutzer' && (to.path === '/' || to.path.startsWith('/meine'))) return to.params.gremiumId && rolle !== 'person' ? '/' : true
  if (rolle === 'person') {
    if (to.path.includes('/themenbereich/')) return true
    if (!sitzungsPfad) return startPfad()
    // Persönlicher Zugang darf kein Protokoll eröffnen
    if (to.path.endsWith('/protokoll') && !sitzungenStore.protokollVonSitzung(to.params.sitzungId)) return `/sitzung/${to.params.sitzungId}/vorprotokoll`
    return true
  }
  if (!rolle) return startPfad()

  // Gremium-Zugang: Rechte auf Sitzungen beachten
  if (rolle === 'gremium' && sitzungsPfad) {
    const gremiumPfad = `/gremium/${zugriff.gremiumId}`
    if (recht('sitzungen', gremiumId) === 'keine') return gremiumPfad
    if (recht('sitzungen', gremiumId) === 'lesen' && to.path.endsWith('/protokoll')) {
      const protokoll = sitzungenStore.protokollVonSitzung(to.params.sitzungId)
      return protokoll ? `/verfolgen/${protokoll.verfolgerKey}` : gremiumPfad
    }
  }
  return true
})

// Einstieg je nach Zugang
export function startPfad() {
  const zugriff = sync.zugriff
  if (!zugriff) return '/login'
  if (zugriff.rolle === 'person') return '/meine'
  if (zugriff.rolle === 'benutzer') {
    const mitglied = zugriff.gremien.filter((g) => g.rolle === 'mitglied')
    if (mitglied.length === zugriff.gremien.length && mitglied.length === 1 && !zugriff.darfGremienAnlegen) return `/meine/${mitglied[0].gremiumId}`
    return '/'
  }
  if (zugriff.rolle === 'gremium') return `/gremium/${zugriff.gremiumId}`
  return '/'
}

export default router
