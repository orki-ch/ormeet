import { sync, recht } from '../stores/sync.js'
import { gremienStore } from '../stores/gremien.js'

// Mitglied / Gast hinter dem aktuellen Zugang (persönlicher Link, Gast-Link)
export function aktuellePerson(gremiumId, gaeste = []) {
  const id = sync.zugriff?.personId
  return id ? gremienStore.person(gremiumId, gaeste, id) : null
}

// Sitzungsleitung oder Protokollführung dieser Sitzung -> voller Zugriff auf Vor- und Protokoll
export function istLeitung(sitzung, personId) {
  return [...sitzung.sitzungsleitung, ...sitzung.protokollfuehrung].some((p) => p.id === personId)
}

// Darf das ganze Dokument (Vorprotokoll / Protokoll / Terminfindung) einer Sitzung bearbeitet werden?
export function vollzugriff(sitzung, dokument = 'protokoll') {
  const zugriff = sync.zugriff
  if (!zugriff) return false
  if (zugriff.rolle === 'admin') return true
  if (zugriff.rolle === 'gremium') return recht('sitzungen') === 'bearbeiten'
  if (zugriff.personId) return istLeitung(sitzung, zugriff.personId)
  if (zugriff.rolle === 'freigabe') return dokument === 'vorprotokoll' // allgemeiner Freigabe-Link
  return false
}
