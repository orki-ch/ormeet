import { sync, recht } from '../stores/sync.js'
import { gremienStore } from '../stores/gremien.js'

// Wirksame Rolle im Gremium: ein Konto ist dort Eigentümer (-> 'admin') oder verknüpftes Mitglied (-> 'person')
export function rolleIm(gremiumId) {
  const zugriff = sync.zugriff
  if (!zugriff) return null
  if (zugriff.rolle !== 'benutzer') return zugriff.rolle
  const g = zugriff.gremien.find((g) => g.gremiumId === gremiumId)
  return g ? (g.rolle === 'eigentuemer' ? 'admin' : 'person') : null
}

// ID der eigenen Person (Mitglied / Gast) in diesem Gremium
export function personIdIm(gremiumId) {
  const zugriff = sync.zugriff
  if (!zugriff) return null
  if (zugriff.rolle !== 'benutzer') return zugriff.personId || null
  return zugriff.gremien.find((g) => g.gremiumId === gremiumId)?.personId || null
}

// Mitglied / Gast hinter dem aktuellen Zugang (persönlicher Link, Gast-Link, Konto)
export function aktuellePerson(gremiumId, gaeste = []) {
  const id = personIdIm(gremiumId)
  return id ? gremienStore.person(gremiumId, gaeste, id) : null
}

// Startseite des Zugangs für ein Gremium: persönliche Übersicht oder Gremium-Seite
export function zurueckZu(gremiumId) {
  const rolle = rolleIm(gremiumId)
  if (rolle === 'person') return { pfad: sync.zugriff.rolle === 'benutzer' ? `/meine/${gremiumId}` : '/meine', text: 'Meine Übersicht' }
  if (rolle === 'admin' || rolle === 'gremium') return { pfad: `/gremium/${gremiumId}`, text: gremienStore.byId(gremiumId)?.name || 'Gremium' }
  return { pfad: '', text: '' }
}

// Sitzungsleitung oder Protokollführung dieser Sitzung -> voller Zugriff auf Vor- und Protokoll
export function istLeitung(sitzung, personId) {
  return [...sitzung.sitzungsleitung, ...sitzung.protokollfuehrung].some((p) => p.id === personId)
}

// Darf das ganze Dokument (Vorprotokoll / Protokoll / Terminfindung) einer Sitzung bearbeitet werden?
export function vollzugriff(sitzung, dokument = 'protokoll') {
  const rolle = rolleIm(sitzung.gremiumId)
  if (!rolle) return false
  if (rolle === 'admin') return true
  if (rolle === 'gremium') return recht('sitzungen', sitzung.gremiumId) === 'bearbeiten'
  const personId = personIdIm(sitzung.gremiumId)
  if (personId) return istLeitung(sitzung, personId)
  if (rolle === 'freigabe') return dokument === 'vorprotokoll' // allgemeiner Freigabe-Link
  return false
}
