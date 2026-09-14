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
    reihenfolge: 0,
    istAutomatischUebernommen: false,
    pendenzId: null,
    untertraktanden: [], // erben Themenbereich und Bearbeitungsrechte des Traktandums
    ...daten,
  }
}

export function neuesUntertraktandum(titel) {
  return { id: crypto.randomUUID(), titel, notiz: '', verantwortliche: [], bearbeiter: [] }
}

// Kopie mit neuen IDs (Vorlage -> Vorprotokoll)
export function kopiereTraktandum(traktandum, index) {
  return {
    ...traktandum,
    id: crypto.randomUUID(),
    reihenfolge: index + 1,
    istAutomatischUebernommen: false,
    pendenzId: null,
    verantwortliche: traktandum.verantwortliche.map((p) => ({ ...p })),
    bearbeiter: traktandum.bearbeiter.map((p) => ({ ...p })),
    untertraktanden: traktandum.untertraktanden.map((u) => ({
      ...u,
      id: crypto.randomUUID(),
      verantwortliche: u.verantwortliche.map((p) => ({ ...p })),
      bearbeiter: u.bearbeiter.map((p) => ({ ...p })),
    })),
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
