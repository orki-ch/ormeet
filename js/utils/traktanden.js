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
    typ: '', // '' (frei) | information | antrag (Punkt ist selbst der Antrag) | antraege (jeder Unterpunkt ist ein Antrag) | pendenz
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

export function neuesUntertraktandum(titel, daten = {}) {
  return { id: crypto.randomUUID(), titel, notiz: '', typ: '', verantwortliche: [], bearbeiter: [], istAutomatischUebernommen: false, pendenzId: null, antragId: null, untertraktanden: [], ...daten }
}

// Alle Unterpunkte eines Traktandums über alle Ebenen (ohne das Traktandum selbst)
export function alleUnterpunkte(eintrag) {
  return (eintrag.untertraktanden || []).flatMap((u) => [u, ...alleUnterpunkte(u)])
}

// Alle Punkte einer Traktandenliste (Traktanden und Unterpunkte aller Ebenen)
export function allePunkte(traktanden) {
  return traktanden.flatMap((t) => [t, ...alleUnterpunkte(t)])
}

// Titel von der Wurzel bis zum Punkt mit dieser ID, z. B. ['Jugendarbeit', 'Lager'] – null, wenn es ihn nicht gibt
export function titelPfad(traktanden, punktId) {
  const suche = (liste, pfad) => {
    for (const p of liste) {
      const eigener = [...pfad, p.titel.trim()]
      if (p.id === punktId) return eigener
      const treffer = suche(p.untertraktanden || [], eigener)
      if (treffer) return treffer
    }
    return null
  }
  return suche(traktanden, [])
}

// Punkt mit demselben Titelpfad in einer anderen Traktandenliste (gleiche Struktur, z. B. aus derselben Vorlage).
// Automatisch übernommene Punkte zählen nicht als Ziel. Liefert { punkt, liste, index, tiefe } oder null.
export function punktMitPfad(traktanden, pfad) {
  let liste = traktanden
  let treffer = null
  for (const [tiefe, titel] of pfad.entries()) {
    const index = liste.findIndex((p) => p.titel.trim() === titel && !p.istAutomatischUebernommen)
    if (index < 0) return null
    treffer = { punkt: liste[index], liste, index, tiefe: tiefe + 1 }
    liste = treffer.punkt.untertraktanden || []
  }
  return treffer
}

// Übernommenen Punkt (Pendenz, vertagter Antrag) dort einfügen, wo er zuletzt stand: als Unterpunkt des Zielpunkts,
// auf der untersten Ebene als Nachbar dahinter
export function unterPunktEinfuegen(ziel, punkt) {
  if (ziel.tiefe < MAX_TIEFE) (ziel.punkt.untertraktanden ??= []).push(punkt)
  else ziel.liste.splice(ziel.index + 1, 0, punkt)
}

// Darf die Person das Traktandum oder einen seiner Unterpunkte bearbeiten?
export function istIrgendwoBerechtigt(traktandum, person) {
  return istBerechtigt(traktandum, person) || alleUnterpunkte(traktandum).some((u) => istBerechtigt(u, person))
}

// Wirksamer Typ: der erste gesetzte Typ von oben nach unten (Traktandum vor Unterpunkt)
export function wirksamerTyp(traktandum, untertraktandum = null) {
  return traktandum.typ || untertraktandum?.typ || ''
}

// Typ, den die Unterpunkte eines Punkts von ihm erben: unter «Anträge» ist jeder Unterpunkt ein Antrag
export function kindTyp(typ) {
  return typ === 'antraege' ? 'antrag' : typ
}

// Ein Punkt vom Typ Antrag ist selbst der Antrag: Titel und Notiz aus dem Vorprotokoll werden beim Start des
// Protokolls zum offenen Antrag (die Notiz erscheint dort nicht mehr separat). Solche Punkte haben keine Unterpunkte.
export function istAntragPunkt(punkt, elternTyp = '') {
  return (elternTyp || punkt.typ) === 'antrag'
}

// Alle Punkte eines Traktandums (es selbst und alle Unterpunkte) mit dem von oben geerbten Typ
export function punkteMitElternTyp(punkt, elternTyp = '') {
  const typ = kindTyp(elternTyp || punkt.typ)
  return [{ punkt, elternTyp }, ...(punkt.untertraktanden || []).flatMap((u) => punkteMitElternTyp(u, typ))]
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
    istAutomatischUebernommen: false,
    pendenzId: null,
    antragId: null,
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
