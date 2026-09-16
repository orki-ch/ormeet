// Gemeinsame Struktur für Traktanden in Vorlagen und Vorprotokollen.
// verantwortliche / bearbeiter: [{ id, name }] – id ist null bei frei eingegebenen Namen.
export function neuesTraktandum(daten) {
  return {
    id: crypto.randomUUID(),
    titel: '',
    themenbereichId: '',
    verantwortliche: [],
    bearbeiter: [], // dürfen zusätzlich bearbeiten (persönlicher Freigabe-Link)
    notiz: '',
    typ: '', // '' (frei) | information | antrag | pendenz – gilt für alle Einträge und Unterpunkte darunter
    dauer: null, // geplante Dauer in Minuten
    reihenfolge: 0,
    istAutomatischUebernommen: false,
    pendenzId: null, // übertragene Pendenz (wird am Original nachgeführt)
    antragId: null, // vertagter Antrag (wird im neuen Protokoll als neuer Antrag entschieden)
    untertraktanden: [], // erben Themenbereich und Bearbeitungsrechte des Traktandums
    ...daten,
  }
}

// Unterpunkte können selbst Unterpunkte haben (1.1.1); tiefer als drei Ebenen geht es nicht
export const MAX_TIEFE = 3

export function neuesUntertraktandum(titel) {
  return { id: crypto.randomUUID(), titel, notiz: '', typ: '', verantwortliche: [], bearbeiter: [], untertraktanden: [] }
}

// Alle Unterpunkte eines Traktandums über alle Ebenen (ohne das Traktandum selbst)
export function alleUnterpunkte(eintrag) {
  return (eintrag.untertraktanden || []).flatMap((u) => [u, ...alleUnterpunkte(u)])
}

// Darf die Person das Traktandum oder einen seiner Unterpunkte bearbeiten?
export function istIrgendwoBerechtigt(traktandum, person) {
  return istBerechtigt(traktandum, person) || alleUnterpunkte(traktandum).some((u) => istBerechtigt(u, person))
}

// Wirksamer Typ: der erste gesetzte Typ von oben nach unten (Traktandum vor Unterpunkt)
export function wirksamerTyp(traktandum, untertraktandum = null) {
  return traktandum.typ || untertraktandum?.typ || ''
}

// Summe der geplanten Dauern in Minuten
export function dauerSumme(traktanden) {
  return traktanden.reduce((summe, t) => summe + (Number(t.dauer) || 0), 0)
}

// Kopie mit neuen IDs (Vorlage -> Vorprotokoll)
export function kopiereTraktandum(traktandum, index) {
  return {
    ...traktandum,
    id: crypto.randomUUID(),
    reihenfolge: index + 1,
    istAutomatischUebernommen: false,
    pendenzId: null,
    antragId: null,
    verantwortliche: traktandum.verantwortliche.map((p) => ({ ...p })),
    bearbeiter: traktandum.bearbeiter.map((p) => ({ ...p })),
    untertraktanden: traktandum.untertraktanden.map(kopiereUnterpunkt),
  }
}

function kopiereUnterpunkt(u) {
  return {
    ...u,
    id: crypto.randomUUID(),
    verantwortliche: u.verantwortliche.map((p) => ({ ...p })),
    bearbeiter: u.bearbeiter.map((p) => ({ ...p })),
    untertraktanden: (u.untertraktanden || []).map(kopiereUnterpunkt),
  }
}

export function personenText(liste) {
  return liste.map((p) => p.name).join(', ')
}

// Auswahl für «Dürfen zusätzlich bearbeiten»: Personen, Rollen und Gruppen (IDs mit Präfix rolle: / gruppe:)
export const GRUPPEN = [
  { id: 'gruppe:alle', name: 'Alle' },
  { id: 'gruppe:stimmberechtigt', name: 'Stimmberechtigte' },
  { id: 'gruppe:ohne_stimmrecht', name: 'Ohne Stimmrecht' },
]

// Darf die Person (Mitglied oder Gast: { id, rolleId?, hatStimmrecht? }) diesen Eintrag bearbeiten?
export function istBerechtigt(eintrag, person) {
  if (!person) return false
  if (eintrag.verantwortliche.some((p) => p.id === person.id)) return true
  return eintrag.bearbeiter.some(
    ({ id }) =>
      id === person.id ||
      id === 'gruppe:alle' ||
      id === `rolle:${person.rolleId}` ||
      (id === 'gruppe:stimmberechtigt' && person.hatStimmrecht === true) ||
      (id === 'gruppe:ohne_stimmrecht' && person.hatStimmrecht === false),
  )
}
