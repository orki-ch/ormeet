import { api } from '../api.js'
import { gremienStore } from './gremien.js'
import { sitzungenStore } from './sitzungen.js'
import { ergaenzeFelder } from './migration.js'
import { hinweis } from '../utils/dialog.js'

const { reactive, watch } = Vue
const TYPEN = ['gremien', 'sitzungen', 'vorprotokolle', 'protokolle']

// Sichtbarer Zustand für Navigation und Editoren; konten: alle Konten (nur Superadmin);
// gesperrt: der Link braucht ein Passwort, ist abgelaufen oder gesperrt ({ grund, name, ziel })
export const sync = reactive({ zugriff: null, konten: [], ausstehend: false, status: 'gespeichert', fehler: '', gesperrt: null })

// Angaben pro Gremium für die Zugriffsübersicht (nicht gespeichert): zuletzt genutzt { [ref]: Datum }, Links mit Passwort [ref]
export const zugriffsDaten = reactive({})

// Zuletzt mit dem Server abgeglichener Stand pro Datensatz: { [typ]: { [id]: { gremiumId, json } } }
let zuletzt = leererStand()
let timer = null
let laeuft = false
let nochmals = false

function leererStand() {
  return { gremien: {}, sitzungen: {}, vorprotokolle: {}, protokolle: {} }
}

function liste(typ) {
  return typ === 'gremien' ? gremienStore.state.gremien : sitzungenStore.state[typ]
}

function gremiumIdVon(typ, eintrag) {
  if (typ === 'gremien') return eintrag.id
  if (typ === 'sitzungen') return eintrag.gremiumId
  return sitzungenStore.sitzungById(eintrag.sitzungId)?.gremiumId
}

// Server-Stand in die Stores übernehmen; lokal geänderte, noch nicht gespeicherte Datensätze haben Vorrang
function uebernehmen(bundles) {
  const migriert = new Set(bundles.filter(ergaenzeFelder).map((b) => b.gremium.id))
  for (const b of bundles) {
    zugriffsDaten[b.gremium.id] = {
      nutzung: Array.isArray(b.nutzung) ? {} : b.nutzung || {},
      geschuetzt: b.geschuetzt || [],
      einladungen: Array.isArray(b.einladungen) ? {} : b.einladungen || {}, // nur für Verwaltende: { sitzungId: { personId: { gesendet, antwort, grund } } }
      einladungenAus: b.einladungenAus || [],
    }
  }

  for (const typ of TYPEN) {
    const lokal = liste(typ)
    const vomServer = bundles.flatMap((b) => (typ === 'gremien' ? [b.gremium] : b[typ]).map((eintrag) => ({ eintrag, gremiumId: b.gremium.id })))
    const serverIds = new Set(vomServer.map(({ eintrag }) => eintrag.id))

    for (const { eintrag, gremiumId } of vomServer) {
      const json = JSON.stringify(eintrag)
      const alt = zuletzt[typ][eintrag.id]
      if (alt?.json === json) continue
      const i = lokal.findIndex((e) => e.id === eintrag.id)
      if (i < 0 && alt) continue // lokal gelöscht, Löschung noch nicht gespeichert
      if (i >= 0 && JSON.stringify(lokal[i]) !== alt?.json) continue // lokal geändert, noch nicht gespeichert
      if (i >= 0) lokal[i] = eintrag
      else lokal.push(eintrag)
      zuletzt[typ][eintrag.id] = { gremiumId, json }
    }

    for (const id of Object.keys(zuletzt[typ])) {
      if (serverIds.has(id)) continue
      const i = lokal.findIndex((e) => e.id === id)
      if (i >= 0 && JSON.stringify(lokal[i]) === zuletzt[typ][id].json) lokal.splice(i, 1)
      delete zuletzt[typ][id]
    }
  }

  // Ergänzte Datenbestände einmalig vollständig zurückschreiben
  for (const typ of TYPEN) {
    for (const [id, stand] of Object.entries(zuletzt[typ])) if (migriert.has(stand.gremiumId)) delete zuletzt[typ][id]
  }
}

// Recht des angemeldeten Zugangs auf einen Bereich eines Gremiums: 'keine' | 'lesen' | 'bearbeiten'.
// Bereiche: sitzungen, kurzsitzungen, mitglieder, einstellungen, teilen, zugriffe (Reiter der Gremium-Seite).
// Mitglieder (persönlicher Link oder Konto) erhalten die Reiter über die Gremiumsrechte ihrer Rolle; die Sitzungen
// sehen sie dann zum Lesen, eintragen geht wie bisher über das Recht «Sitzungen eintragen».
export function recht(bereich, gremiumId) {
  const zugriff = sync.zugriff
  if (!zugriff) return 'keine'
  if (zugriff.rolle === 'admin') return 'bearbeiten'
  if (zugriff.rolle === 'gremium') {
    if (bereich === 'kurzsitzungen') return zugriff.rechte?.sitzungen || 'keine'
    return ['teilen', 'zugriffe'].includes(bereich) ? 'keine' : zugriff.rechte?.[bereich] || 'keine'
  }
  if (zugriff.rolle === 'benutzer' && zugriff.gremien.some((g) => g.gremiumId === gremiumId && g.rolle === 'eigentuemer')) return 'bearbeiten'
  const personId = zugriff.rolle === 'person' ? zugriff.personId : zugriff.rolle === 'benutzer' ? zugriff.gremien.find((g) => g.gremiumId === gremiumId && g.rolle === 'mitglied')?.personId : null
  if (!personId || (zugriff.rolle === 'person' && zugriff.gremiumId !== gremiumId)) return 'keine'
  const rechte = gremienStore.rechteVon(gremiumId, personId)
  if (bereich === 'zugriffe') return rechte.zugriffe ? 'bearbeiten' : 'keine'
  if (bereich === 'sitzungen') return rechte.gremium.length || rechte.zugriffe ? 'lesen' : 'keine'
  return rechte.gremium.includes(bereich) ? 'bearbeiten' : 'keine'
}


export async function laden() {
  const daten = await api.anfrage('laden')
  sync.zugriff = daten.zugriff
  sync.gesperrt = null
  sync.konten = daten.konten || []
  uebernehmen(daten.gremien)
  speichern()
}

// Lokale Änderungen ermitteln und pro Gremium an den Server schicken
export async function speichern() {
  clearTimeout(timer)
  // Reine Lese-Zugänge und die Ansicht als andere Person schreiben nie
  if (['verfolger', 'themenbereich'].includes(sync.zugriff?.rolle) || sync.zugriff?.ansicht) {
    sync.ausstehend = false
    return
  }
  if (laeuft) {
    nochmals = true
    return
  }

  const aenderungen = {}
  const fuer = (gremiumId) =>
    (aenderungen[gremiumId] ??= { sitzungen: [], vorprotokolle: [], protokolle: [], geloescht: { sitzungen: [], vorprotokolle: [], protokolle: [] }, basis: { sitzungen: {}, vorprotokolle: {}, protokolle: {} } })
  const neuerStand = leererStand() // wird nach erfolgreichem Speichern übernommen (null = gelöscht)

  for (const typ of TYPEN) {
    const vorhanden = new Set()
    for (const eintrag of liste(typ)) {
      vorhanden.add(eintrag.id)
      const gremiumId = gremiumIdVon(typ, eintrag)
      if (!gremiumId) continue
      const json = JSON.stringify(eintrag)
      if (zuletzt[typ][eintrag.id]?.json === json) continue
      if (typ === 'gremien') fuer(gremiumId).gremium = eintrag
      else fuer(gremiumId)[typ].push(eintrag)
      // Stand, auf dem die Änderung beruht: der Server führt damit Änderungen anderer zusammen, statt sie zu überschreiben
      const basis = zuletzt[typ][eintrag.id]?.json
      if (basis && typ === 'gremien') fuer(gremiumId).basis.gremium = JSON.parse(basis)
      else if (basis) fuer(gremiumId).basis[typ][eintrag.id] = JSON.parse(basis)
      neuerStand[typ][eintrag.id] = { gremiumId, json }
    }
    for (const [id, { gremiumId }] of Object.entries(zuletzt[typ])) {
      if (vorhanden.has(id)) continue
      if (typ !== 'gremien') fuer(gremiumId).geloescht[typ].push(id) // Gremien werden explizit über gremiumLoeschen entfernt
      neuerStand[typ][id] = null
    }
  }

  if (!Object.keys(aenderungen).length) {
    sync.ausstehend = false
    return
  }

  laeuft = true
  sync.status = 'speichert'
  try {
    const gleichzeitig = []
    let zusammengefuehrt = false
    for (const [gremiumId, daten] of Object.entries(aenderungen)) {
      const antwort = await api.anfrage('speichern', gremiumId, daten)
      gleichzeitig.push(...(antwort.gleichzeitig || []))
      zusammengefuehrt ||= !!antwort.zusammengefuehrt
    }
    if (zusammengefuehrt) setTimeout(abgleichen, 0) // zusammengeführten Stand gleich holen
    if (gleichzeitig.length) {
      hinweis('Jemand hat gleichzeitig dieselben Stellen geändert. Gespeichert ist deine Änderung:\n\n' + gleichzeitig.map((h) => '– ' + h).join('\n'), 'Gleichzeitig bearbeitet')
    }
    for (const typ of TYPEN) {
      for (const [id, stand] of Object.entries(neuerStand[typ])) {
        if (stand) zuletzt[typ][id] = stand
        else delete zuletzt[typ][id]
      }
    }
    sync.status = 'gespeichert'
    sync.fehler = ''
    sync.ausstehend = nochmals
  } catch (fehler) {
    if (fehler.status === 401) return abmelden()
    sync.status = 'fehler'
    sync.fehler = fehler.message
    timer = setTimeout(speichern, 10000) // später erneut versuchen
  } finally {
    laeuft = false
  }
  if (nochmals) {
    nochmals = false
    speichern()
  }
}

export async function gremiumLoeschen(gremiumId) {
  await api.anfrage('loeschen', gremiumId)
  for (const typ of TYPEN) {
    for (const [id, stand] of Object.entries(zuletzt[typ])) if (stand.gremiumId === gremiumId) delete zuletzt[typ][id]
  }
}

export function abmelden() {
  clearTimeout(timer)
  if (['benutzer', 'admin'].includes(sync.zugriff?.rolle)) api.anfrage('abmelden', '', {}).catch(() => {}) // Anmeldung auf dem Server löschen
  api.setToken('')
  sync.zugriff = null
  sync.status = 'gespeichert'
  sync.fehler = ''
  sync.ausstehend = false
  zuletzt = leererStand()
  for (const id of Object.keys(zugriffsDaten)) delete zugriffsDaten[id]
  gremienStore.state.gremien = []
  for (const typ of ['sitzungen', 'vorprotokolle', 'protokolle']) sitzungenStore.state[typ] = []
  location.hash = '#/login'
}

// Änderungen anderer Benutzer regelmässig abholen
export async function abgleichen() {
  if (!sync.zugriff || laeuft || sync.ausstehend || document.hidden) return
  try {
    const daten = await api.anfrage('laden')
    sync.zugriff = daten.zugriff // Gremien und Rechte eines Kontos können sich ändern
    sync.konten = daten.konten || []
    uebernehmen(daten.gremien)
    speichern()
  } catch (fehler) {
    if (fehler.status === 401) abmelden()
    if (fehler.gesperrt) {
      // Link inzwischen abgelaufen oder gesperrt
      sync.gesperrt = fehler.gesperrt
      location.hash = '#/gesperrt'
    }
  }
}
setInterval(abgleichen, 30000)
document.addEventListener('visibilitychange', abgleichen)

// Jede Änderung an den Stores gesammelt (1 s) an den Server schicken
watch(
  [gremienStore.state, sitzungenStore.state],
  () => {
    sync.ausstehend = true
    clearTimeout(timer)
    timer = setTimeout(speichern, 1000)
  },
  { deep: true, flush: 'sync' },
)

window.addEventListener('beforeunload', (event) => {
  if (sync.ausstehend || sync.status !== 'gespeichert') event.preventDefault()
})
