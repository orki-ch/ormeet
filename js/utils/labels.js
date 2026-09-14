export const TYP_LABELS = { information: 'Information', antrag: 'Antrag', pendenz: 'Pendenz' }

export const ANTRAG_STATUS = { offen: 'Offen', angenommen: 'Angenommen', abgelehnt: 'Abgelehnt', sistiert: 'Sistiert' }

export const PENDENZ_STATUS = { offen: 'Offen', in_bearbeitung: 'In Bearbeitung', erfuellt: 'Erfüllt' }
export const PENDENZ_STATUS_KLASSE = { offen: 'rot', in_bearbeitung: 'gelb', erfuellt: 'gruen' }

export const SITZUNG_STATUS = { terminfindung: 'In Planung', geplant: 'Geplant', vorprotokoll: 'Vorprotokoll', laufend: 'Laufend', abgeschlossen: 'Abgeschlossen' }
export const SITZUNG_STATUS_KLASSE = { terminfindung: 'violett', geplant: 'grau', vorprotokoll: 'blau', laufend: 'gelb', abgeschlossen: 'gruen' }
export const STIMME = { ja: '✓', vielleicht: '?', nein: '✕' }

// Solange die Terminfindung offen ist, gilt die Sitzung als «in Planung» – unabhängig vom gespeicherten Status
export function sitzungStatus(sitzung) {
  return sitzung.terminfindung?.status === 'offen' ? 'terminfindung' : sitzung.status
}
export const TYP_BADGE = { information: 'blau', antrag: 'violett', pendenz: 'rot' }

// ISO-Datum (YYYY-MM-DD) -> DD.MM.YYYY, ohne Zeitzonen-Effekte
export function formatDatum(iso) {
  if (!iso) return 'Termin offen'
  const [jahr, monat, tag] = iso.split('-')
  return `${tag}.${monat}.${jahr}`
}
