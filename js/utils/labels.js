// Typen der Einträge im Protokoll
export const TYP_LABELS = { information: 'Information', antrag: 'Antrag', pendenz: 'Pendenz' }
// Typen, die man im Protokoll bei einem Eintrag noch wählen kann: Anträge entstehen nur im Vorprotokoll
export const EINTRAG_TYP_WAHL = { information: 'Information', pendenz: 'Pendenz' }
// Typen eines Traktandums / Unterpunkts: antrag = der Punkt ist selbst der Antrag, antraege = jeder Unterpunkt ist ein Antrag
export const PUNKT_TYP = { information: 'Information', antrag: 'Antrag', antraege: 'Anträge', pendenz: 'Pendenz' }

export const ANTRAG_STATUS = { offen: 'Offen', angenommen: 'Angenommen', abgelehnt: 'Abgelehnt', vertagt: 'Vertagt', sistiert: 'Sistiert' }

// Abstimmungsergebnis eines Antrags: «5 Ja · 2 Nein · 1 Enthaltung» – nur bei angenommen / abgelehnt
export function stimmenText(eintrag) {
  const st = eintrag.stimmen
  if (!st || !['angenommen', 'abgelehnt'].includes(eintrag.antragStatus)) return ''
  const teile = [
    st.ja != null && st.ja !== '' && `${st.ja} Ja`,
    st.nein != null && st.nein !== '' && `${st.nein} Nein`,
    st.enthaltung != null && st.enthaltung !== '' && `${st.enthaltung} ${st.enthaltung === 1 ? 'Enthaltung' : 'Enthaltungen'}`,
  ].filter(Boolean)
  return teile.join(' · ')
}

export const PENDENZ_STATUS = { offen: 'Offen', in_bearbeitung: 'In Bearbeitung', erfuellt: 'Erfüllt' }
export const PENDENZ_STATUS_KLASSE = { offen: 'rot', in_bearbeitung: 'gelb', erfuellt: 'gruen' }

export const SITZUNG_STATUS = { terminfindung: 'In Planung', geplant: 'Geplant', vorprotokoll: 'Vorprotokoll', laufend: 'Laufend', abgeschlossen: 'Abgeschlossen' }
export const SITZUNG_STATUS_KLASSE = { terminfindung: 'violett', geplant: 'grau', vorprotokoll: 'blau', laufend: 'gelb', abgeschlossen: 'gruen' }
export const STIMME = { ja: '✓', vielleicht: '?', nein: '✕' }

// Solange die Terminfindung offen ist, gilt die Sitzung als «in Planung» – unabhängig vom gespeicherten Status
export function sitzungStatus(sitzung) {
  return sitzung.terminfindung?.status === 'offen' ? 'terminfindung' : sitzung.status
}
export const TYP_BADGE = { information: 'blau', antrag: 'violett', antraege: 'violett', pendenz: 'rot' }

// Auswahl für den Typ eines Traktandums / Unterpunkts im Vorprotokoll: leer = frei, sonst gilt der Typ für alles darunter
export const TRAKTANDUM_TYP = {
  '': 'Typ frei',
  information: 'Information',
  antrag: 'Antrag – dieser Punkt ist der Antrag',
  antraege: 'Anträge – jeder Unterpunkt ist ein Antrag',
  pendenz: 'Pendenz',
}

// Minuten -> «20 Min.» / «1 h 15 Min.»
export function formatDauer(minuten) {
  if (!minuten) return ''
  const h = Math.floor(minuten / 60)
  const m = minuten % 60
  if (!h) return `${m} Min.`
  return m ? `${h} h ${m} Min.` : `${h} h`
}

// ISO-Datum (YYYY-MM-DD) -> DD.MM.YYYY, ohne Zeitzonen-Effekte
export function formatDatum(iso) {
  if (!iso) return 'Termin offen'
  const [jahr, monat, tag] = iso.split('-')
  return `${tag}.${monat}.${jahr}`
}
