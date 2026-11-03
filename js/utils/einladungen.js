import { zugriffsDaten } from '../stores/sync.js'
import { formatDatum } from './labels.js'

// Einladungen per E-Mail (nur für Verwaltende geladen): Stand einer Person für eine Sitzung
export function einladungVon(gremiumId, sitzungId, personId) {
  return zugriffsDaten[gremiumId]?.einladungen?.[sitzungId]?.[personId] || null
}

export function hatAbgesagt(gremiumId, sitzungId, personId) {
  return einladungVon(gremiumId, sitzungId, personId)?.antwort === 'abgesagt'
}

// Symbol neben dem Namen: eingeladen (ohne Antwort = angenommen), zugesagt, abgesagt (Grund im Titel) – null ohne Einladung
export function einladungSymbol(gremiumId, sitzungId, personId) {
  const e = einladungVon(gremiumId, sitzungId, personId)
  if (!e) return null
  if (e.antwort === 'abgesagt') return { klasse: 'abgesagt', titel: 'Abgesagt: ' + (e.grund || 'ohne Grund') }
  if (e.antwort === 'zugesagt') return { klasse: 'zugesagt', titel: 'Zugesagt' }
  const zuletzt = e.gesendet?.[e.gesendet.length - 1]
  return { klasse: 'eingeladen', titel: 'Eingeladen' + (zuletzt ? ' am ' + formatDatum(zuletzt.am.slice(0, 10)) : '') + ' – ohne Antwort (gilt als angenommen)' }
}
