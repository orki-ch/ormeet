import { api } from './api.js'
import { laden, sync, recht } from './stores/sync.js'
import { sitzungenStore } from './stores/sitzungen.js'
import { gremienStore } from './stores/gremien.js'
import { darfAenderungStellen, darfStarten, rolleIm, vollzugriff } from './utils/rechte.js'
import { bestaetigen } from './utils/dialog.js'
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
import LinkGesperrt from './views/LinkGesperrt.js'
import FreigabeSeite from './views/FreigabeSeite.js'
import ZugriffeSeite from './views/ZugriffeSeite.js'
import PasswortNeu from './views/PasswortNeu.js'
import EinladungAntwort from './views/EinladungAntwort.js'

// Hash-History: läuft auf jedem Webserver ohne Rewrite-Regeln
const router = VueRouter.createRouter({
  history: VueRouter.createWebHashHistory(),
  routes: [
    { path: '/login', component: Login },
    { path: '/hilfe', component: Hilfe },
    { path: '/datenschutz', component: Datenschutz },
    // Link mit Passwort, abgelaufen oder gesperrt
    { path: '/gesperrt', component: LinkGesperrt },
    // «Ansehen als …»: Ansicht aus Sicht einer Person in diesem Tab (nur lesen)
    { path: '/ansicht/:ansichtToken', name: 'ansicht', component: GremiumListe },
    // Passwort vergessen: Link aus der E-Mail
    { path: '/passwort/:code', component: PasswortNeu, props: true },
    { path: '/einladung/:code', component: EinladungAntwort, props: true }, // Antwort auf eine Einladung per E-Mail (ohne Anmeldung)
    { path: '/', component: GremiumListe },
    { path: '/meine/:gremiumId?', component: PersonSeite, props: true },
    // Persönliche Übersicht des Superadmins (über das mit ihm verknüpfte Konto)
    { path: '/uebersicht', component: GremiumListe, props: { persoenlich: true } },
    { path: '/konto', component: Konto },
    { path: '/einstellungen', component: Einstellungen },
    { path: '/benutzer', component: Benutzer },
    { path: '/gremium/:gremiumId', component: GremiumDetail, props: true },
    { path: '/gremium/:gremiumId/themenbereich/:themenbereichId', component: ThemenbereichSummary, props: true },
    { path: '/sitzung/:sitzungId/vorprotokoll', component: VorprotokollEditor, props: true },
    { path: '/sitzung/:sitzungId/protokoll', component: ProtokollEditor, props: true },
    { path: '/sitzung/:sitzungId/terminfindung', component: TerminfindungSeite, props: true },
    // Zugriffsübersicht einer Sitzung (Sitzungsleitung, Protokollführung, Eigentümer, Superadmin)
    { path: '/sitzung/:sitzungId/zugriffe', component: ZugriffeSeite, props: true },
    // Links: Gremium-Zugang / zentraler Personen-Link
    { path: '/zugang/:zugangsKey', name: 'zugang', component: GremiumListe },
    // Freigabe-Link: Bearbeitung eines einzelnen Vorprotokolls (allgemein oder Gast); Gäste behalten ihren Link in der
    // Adresse auch auf Terminfindung und Protokoll (seite), damit er sich kopieren und auf einem anderen Gerät öffnen lässt
    { path: '/freigabe/:freigabeLinkKey/:seite?', name: 'freigabe', component: FreigabeSeite, props: true },
    // Zusätzlicher allgemeiner Link: ein Dokument einer Sitzung mit den Rechten des Links
    { path: '/link/:linkKey', name: 'link', component: GremiumListe },
    // Verfolger-Link: Live-Ansicht eines Protokolls (nur lesen)
    { path: '/verfolgen/:verfolgerKey', name: 'verfolgen', component: ProtokollAnsicht, props: true },
    // Übersichts-Link eines Themenbereichs (nur lesen)
    { path: '/themenbereich/:freigabeKey', name: 'themenbereich', component: ThemenbereichSummary, props: true },
  ],
})

// Daten mit dem gespeicherten Token laden (einmalig); bei ungültigem Token Token verwerfen.
// Link mit Passwort, abgelaufen oder gesperrt: Token behalten, Grund merken (-> /gesperrt)
async function angemeldet() {
  if (sync.zugriff) return true
  if (!api.token) return false
  try {
    await laden()
    return true
  } catch (fehler) {
    if (fehler.gesperrt) sync.gesperrt = fehler.gesperrt
    else api.setToken('')
    return false
  }
}

// Gesperrter Link: nach dem Passwort zurück an dieses Ziel
function gesperrtPfad(to) {
  sync.gesperrt.ziel = to.fullPath
  return '/gesperrt'
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
  if (['/login', '/hilfe', '/datenschutz'].includes(to.path) || to.path.startsWith('/passwort/') || to.path.startsWith('/einladung/')) return true
  if (to.path === '/gesperrt') return sync.gesperrt ? true : '/'

  if (to.name === 'zugang') {
    const key = to.params.zugangsKey
    // Angemeldetes Konto öffnet einen persönlichen Link (16 Zeichen; Konto-Tokens sind länger): Mitglied mit dem Konto verknüpfen
    if (key.length === 16 && api.token && api.token !== key && (await angemeldet()) && sync.zugriff.rolle === 'benutzer') {
      // Eigener, schon verknüpfter Link (z. B. aus dem Kalender-Abo): direkt weiter
      const eigenes = sync.zugriff.gremien.find((g) => g.zugangsKey === key)
      if (eigenes) return to.query.weiter?.startsWith('/') ? to.query.weiter : `/meine/${eigenes.gremiumId}`
      if (await bestaetigen(`Du bist mit dem Konto ${sync.zugriff.email} angemeldet. Persönlichen Link mit diesem Konto verknüpfen?`, { titel: 'Link verknüpfen', ja: 'Verknüpfen', nein: 'Ohne Konto öffnen' })) {
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
    if (!(await angemeldet())) return sync.gesperrt ? gesperrtPfad(to) : '/login'
    if (to.query.weiter?.startsWith('/')) return to.query.weiter // z. B. aus dem Kalender direkt ins Vorprotokoll
    return startPfad()
  }
  if (to.name === 'ansicht') {
    api.ansichtStarten(to.params.ansichtToken)
    sync.zugriff = null
    if (!(await angemeldet())) return sync.gesperrt ? gesperrtPfad(to) : '/login'
    const nur = sitzungenStore.sitzungById(sync.zugriff.nurSitzung)
    if (sync.zugriff.rolle === 'person' && nur) return nur.kurz ? kurzPfad(nur) : `/sitzung/${nur.id}/${sitzungenStore.protokollVonSitzung(nur.id) ? 'protokoll' : 'vorprotokoll'}`
    return sync.zugriff.rolle === 'freigabe' ? freigabePfad(freigabeSeiten()[0]) : startPfad()
  }
  if (to.name === 'freigabe') {
    const key = to.params.freigabeLinkKey
    await mitLinkAnmelden(key, () => sitzungenStore.vorprotokollByKey(key) || sitzungenStore.vorprotokollByPersonKey(key))
    if (sync.gesperrt) return gesperrtPfad(to)
    if (sync.zugriff?.rolle === 'person') return startPfad() // frühere Adresse einer mit einem Mitglied zusammengeführten Person
    if (sync.zugriff?.rolle !== 'freigabe') return to.params.seite ? `/freigabe/${key}` : true // z. B. Superadmin mit dem Link
    // Gast: nur die Seiten seiner Sitzung, die sein Link öffnet
    const seiten = freigabeSeiten()
    return seiten.includes(to.params.seite || 'vorprotokoll') || freigabePfad(seiten[0])
  }
  if (to.name === 'link') {
    await mitLinkAnmelden(to.params.linkKey, () => sync.zugriff?.rolle === 'link' && api.token === to.params.linkKey)
    return sync.gesperrt ? gesperrtPfad(to) : linkPfad()
  }
  if (to.name === 'verfolgen') {
    return mitLinkAnmelden(to.params.verfolgerKey, () => sitzungenStore.protokollByVerfolgerKey(to.params.verfolgerKey))
  }
  if (to.name === 'themenbereich') {
    return mitLinkAnmelden(to.params.freigabeKey, () => sync.zugriff?.themenbereichId)
  }

  if (!(await angemeldet())) return sync.gesperrt ? gesperrtPfad(to) : to.path === '/' ? '/login' : { path: '/login', query: { weiter: to.fullPath } }
  const zugriff = sync.zugriff
  const sitzungsPfad = to.path.startsWith('/sitzung/')
  const sitzung = sitzungsPfad ? sitzungenStore.sitzungById(to.params.sitzungId) : null

  // Kurzsitzungen haben kein Vorprotokoll
  if (sitzung?.kurz && to.path.endsWith('/vorprotokoll')) return kurzPfad(sitzung)
  // Ohne festen Termin gibt es kein Protokoll
  if (sitzung && to.path.endsWith('/protokoll') && !sitzung.datum) return sitzung.kurz ? kurzPfad(sitzung) : `/sitzung/${sitzung.id}/vorprotokoll`

  if (zugriff.rolle === 'verfolger') return `/verfolgen/${api.token}`
  if (zugriff.rolle === 'themenbereich') return `/themenbereich/${api.token}`
  if (zugriff.rolle === 'link') return to.path === linkPfad() || linkPfad()
  if (zugriff.rolle === 'freigabe') {
    // Freigabe-Link: Seiten der eigenen Sitzung, immer mit dem Link in der Adresse
    const seiten = freigabeSeiten()
    const seite = to.path.split('/')[3]
    return freigabePfad(sitzungsPfad && to.params.sitzungId === freigabeSitzung()?.id && seiten.includes(seite) ? seite : seiten[0])
  }
  if (['/einstellungen', '/benutzer', '/uebersicht'].includes(to.path) && zugriff.rolle !== 'admin') return startPfad()
  if (to.path === '/uebersicht' && !zugriff.konto) return '/'
  if (to.path === '/konto') return zugriff.rolle === 'benutzer' || (zugriff.rolle === 'admin' && zugriff.konto) ? true : startPfad()

  // Wirksame Rolle im betroffenen Gremium (Konto: je Gremium Eigentümer oder Mitglied)
  const gremiumId = sitzung?.gremiumId || to.params.gremiumId || zugriff.gremiumId
  const rolle = rolleIm(gremiumId)
  if (zugriff.rolle === 'person' && to.path === '/meine') return gremienStore.byId(zugriff.gremiumId)?.kurz ? startPfad() : true
  if (zugriff.rolle === 'benutzer' && (to.path === '/' || to.path.startsWith('/meine'))) return to.params.gremiumId && rolle !== 'person' ? '/' : true
  // Konto als weitere Person (Gast einer Sitzung): nur diese Sitzung
  if (zugriff.rolle === 'benutzer' && rolle === 'freigabe') {
    const gast = zugriff.gremien.find((g) => g.gremiumId === gremiumId)
    return (sitzungsPfad && to.params.sitzungId === gast.sitzungId) || gastPfad(gast)
  }
  if (rolle === 'person') {
    if (to.path.includes('/themenbereich/')) return true
    if (!sitzungsPfad) return startPfad()
    // Ein Protokoll eröffnen (Sitzung starten) darf nur, wer es ganz bearbeiten darf: Sitzungsleitung, Protokollführung, Freigabe «Alles»
    if (to.path.endsWith('/protokoll') && !sitzungenStore.protokollVonSitzung(to.params.sitzungId) && !(sitzung && (vollzugriff(sitzung, 'protokoll') || darfStarten(sitzung)))) return `/sitzung/${to.params.sitzungId}/vorprotokoll`
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
  if (zugriff.rolle === 'person') {
    // Eingeladene einer Kurzsitzung ohne Gremium: direkt zur Kurzsitzung
    const kurz = gremienStore.byId(zugriff.gremiumId)?.kurz && sitzungenStore.kurzsitzungen(zugriff.gremiumId)[0]
    return kurz ? kurzPfad(kurz) : '/meine'
  }
  if (zugriff.rolle === 'benutzer') {
    // Nur als weitere Person bei einer Sitzung dabei: direkt dorthin
    if (zugriff.gremien.length && zugriff.gremien.every((g) => g.rolle === 'gast')) return gastPfad(zugriff.gremien[0])
    const gremien = zugriff.gremien.filter((g) => !g.kurz && g.rolle !== 'gast')
    const mitglied = gremien.filter((g) => g.rolle === 'mitglied')
    const nurEines = mitglied.length === gremien.length && mitglied.length === 1 && gremien.length === zugriff.gremien.length
    if (nurEines && !zugriff.darfGremienAnlegen && !zugriff.darfKurzsitzungenAnlegen) return `/meine/${mitglied[0].gremiumId}`
    return '/'
  }
  if (zugriff.rolle === 'gremium') return `/gremium/${zugriff.gremiumId}`
  if (zugriff.rolle === 'link') return linkPfad()
  return '/'
}

// Sitzung des Freigabe-Links
function freigabeSitzung() {
  const vp = sitzungenStore.vorprotokollById(sync.zugriff?.vorprotokollId)
  return sitzungenStore.sitzungById(sync.zugriff?.sitzungId || vp?.sitzungId)
}

// Seiten, die ein Freigabe-Link öffnet (die erste ist der Einstieg): Vorprotokoll und Terminfindung; über einen
// Link eingetragene Personen nur das Dokument ihres Links; Kurzsitzungen Terminfindung bzw. Protokoll
export function freigabeSeiten() {
  const sitzung = freigabeSitzung()
  if (!sitzung) return ['vorprotokoll']
  if (sitzung.kurz) {
    const kurz = kurzPfad(sitzung).split('/').pop()
    return sitzung.datum ? [kurz, ...['terminfindung', 'protokoll'].filter((s) => s !== kurz && (s !== 'terminfindung' || sitzung.terminfindung))] : [kurz]
  }
  const dokument = sync.zugriff.dokument || 'vorprotokoll'
  if (dokument === 'terminfindung') return sitzung.terminfindung ? ['terminfindung'] : ['vorprotokoll']
  if (dokument === 'protokoll') return ['protokoll']
  const seiten = sitzung.terminfindung ? ['vorprotokoll', 'terminfindung'] : ['vorprotokoll']
  // Anwesender Gast: das abgeschlossene Protokoll bis zur Genehmigung (Änderungsanträge)
  const protokoll = sitzungenStore.protokollVonSitzung(sitzung.id)
  if (protokoll && darfAenderungStellen(sitzung, protokoll)) seiten.unshift('protokoll') // öffnet zuerst das Protokoll
  return seiten
}

export function freigabePfad(seite) {
  return `/freigabe/${api.token}${seite && seite !== 'vorprotokoll' ? '/' + seite : ''}`
}

// Weitere Person: ihre Sitzung – Terminfindung, solange sie läuft, sonst Vorprotokoll bzw. Protokoll (Kurzsitzung)
export function gastPfad(gast) {
  const sitzung = sitzungenStore.sitzungById(gast.sitzungId)
  if (!sitzung) return '/konto'
  if (sitzung.kurz) return kurzPfad(sitzung)
  return `/sitzung/${sitzung.id}/${sitzung.terminfindung?.status === 'offen' ? 'terminfindung' : 'vorprotokoll'}`
}

// Zusätzlicher allgemeiner Link: sein Dokument (Kurzsitzung: Terminfindung bzw. Protokoll)
function linkPfad() {
  const zugriff = sync.zugriff
  if (zugriff?.rolle !== 'link') return '/login'
  const sitzung = sitzungenStore.sitzungById(zugriff.sitzungId)
  if (sitzung?.kurz && zugriff.dokument === 'vorprotokoll') return kurzPfad(sitzung)
  return `/sitzung/${zugriff.sitzungId}/${zugriff.dokument}`
}

// Kurzsitzung öffnen: solange der Termin gesucht wird die Terminfindung, sonst das Protokoll
export function kurzPfad(sitzung) {
  return `/sitzung/${sitzung.id}/${sitzung.terminfindung?.status === 'offen' || !sitzung.datum ? 'terminfindung' : 'protokoll'}`
}

export default router
