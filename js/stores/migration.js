import { neuerKey } from '../utils/keys.js'
import { neuerZugang } from './gremien.js'

// Ältere Datenbestände um später hinzugekommene Felder ergänzen. Liefert true, wenn etwas ergänzt wurde.
export function ergaenzeFelder(bundle) {
  const vorher = JSON.stringify(bundle)
  const gremium = bundle.gremium

  gremium.zugaenge ??= []
  gremium.zugaenge.forEach((z) => (z.ablauf ??= '')) // '' | JJJJ-MM-TT (gilt bis Ende dieses Tages)
  if (gremium.zugangsKey) {
    // Früherer Einzel-Zugangslink -> Teilen-Link mit Vollzugriff
    gremium.zugaenge.push({ ...neuerZugang('Vollzugriff'), key: gremium.zugangsKey, rechte: { sitzungen: 'bearbeiten', mitglieder: 'bearbeiten', einstellungen: 'bearbeiten' } })
    delete gremium.zugangsKey
  }
  gremium.fusstext ??= ''
  gremium.erinnerungTage ??= 3 // Erinnerung «Sitzung steht bevor» so viele Tage vorher (Glocke und E-Mail, seit 1.5.03)
  gremium.vorlagen ??= []
  gremium.eigentuemerId ??= null // Konto, das dieses Gremium selbst angelegt hat
  gremium.kurz ??= false // versteckter Behälter einer Kurzsitzung ohne Gremium (seit 1.5.01)

  // Feste Rollen: Präsidium (Sitzungsleitung) und Aktuariat (Protokollführung)
  gremium.rollen.forEach((r) => {
    r.sollAnwesend ??= true
    if (!r.rechte || Array.isArray(r.rechte)) r.rechte = {} // Rechte der Rolle (leer: Vorlage, siehe gremienStore.rolleRechte)
    r.typ ??= r.name === 'Präsidium' ? 'praesidium' : r.name === 'Aktuariat' ? 'aktuariat' : null
  })
  for (const [typ, name] of [['praesidium', 'Präsidium'], ['aktuariat', 'Aktuariat']]) {
    if (!gremium.rollen.some((r) => r.typ === typ)) gremium.rollen.push({ id: crypto.randomUUID(), name, typ, sollAnwesend: true })
  }

  gremium.mitglieder.forEach((m) => {
    m.zugangsKey ??= neuerKey() // zentraler persönlicher Link
    m.benutzerId ??= null // verknüpftes Konto
    m.darfSitzungenEintragen ??= false // Konto darf in diesem Gremium Sitzungen eintragen (Präsidium / Aktuariat immer)
    m.gesperrt ??= false // Zugang gesperrt: weder persönlicher Link noch Konto (seit 1.5.03)
  })
  gremium.themenbereiche.forEach((tb) => (tb.freigabeKey ??= neuerKey())) // Übersicht teilen

  const personen = gremium.mitglieder
  gremium.vorlagen.forEach((v) => {
    v.titel ??= ''
    v.sitzungsleitung = personenListe(v.sitzungsleitung, personen)
    v.protokollfuehrung = personenListe(v.protokollfuehrung, personen)
    v.bemerkungen ??= ''
    v.traktanden ??= []
    v.traktanden.forEach((t) => traktandum(t, personen))
  })

  bundle.sitzungen.forEach((s) => {
    s.titel ??= ''
    s.sitzungsleitung = personenListe(s.sitzungsleitung, personen)
    s.protokollfuehrung = personenListe(s.protokollfuehrung, personen)
    s.bemerkungen ??= ''
    s.vorlageId ??= null
    s.genehmigt ??= null
    s.kurz ??= false // Kurzsitzung: Einmalsitzung ohne Vorprotokoll und ohne Ablauf (seit 1.5.01)
    // Freigaben pro Dokument: { [personId]: lesen | eigene | alles }; PHP liefert leere Objekte als []
    if (!s.freigaben || Array.isArray(s.freigaben)) s.freigaben = {}
    for (const dokument of ['vorprotokoll', 'protokoll']) {
      if (!s.freigaben[dokument] || Array.isArray(s.freigaben[dokument])) s.freigaben[dokument] = {}
    }
    s.erstelltVon ??= null // Person, die die Sitzung eingetragen hat (leer: gilt als von der Sitzungsleitung)
    s.links ??= [] // zusätzliche allgemeine Links pro Dokument mit eigenen Rechten
    s.links.forEach((l) => (l.ablauf ??= '')) // '' | JJJJ-MM-TT | genehmigt (bis das Protokoll genehmigt ist)
    s.gesperrt ??= [] // für diese Sitzung gesperrte Personen: sehen die Sitzung nicht mehr
    s.nurLesen ??= [] // für diese Sitzung auf «nur lesen» gesetzte Personen: sehen alles, ändern nichts (seit 1.5.04)
    if (!s.zuschnitt || Array.isArray(s.zuschnitt)) s.zuschnitt = {} // individuelle Rechte mit Regeln: { [personId]: { regeln, eigene } }
    s.terminfindung ??= null
    if (s.terminfindung) {
      s.terminfindung.optionen ??= []
      s.terminfindung.stimmen ??= []
      s.terminfindung.kommentare ??= []
      s.terminfindung.freigabe ??= [] // Rollen (rolle:<id>) und Personen, die die Terminfindung zusätzlich bearbeiten
      s.terminfindung.entfernt ??= [] // aus der Terminfindung entfernte Personen: für diese Sitzung entschuldigt
    }
  })

  bundle.vorprotokolle.forEach((v) => {
    if (!v.personenKeys || Array.isArray(v.personenKeys)) v.personenKeys = {} // PHP liefert ein leeres Objekt als []
    if (!v.aliasKeys || Array.isArray(v.aliasKeys)) v.aliasKeys = {} // frühere Links zusammengeführter Personen: { [key]: personId }
    v.freigabeLinkAblauf ??= '' // Ablauf des allgemeinen Freigabe-Links (wie bei den zusätzlichen Links)
    v.freigabeLinkStufe ??= 'eigene' // Rechte des Freigabe-Links wie bei weiteren Links; bestehende werden auf den Standard «eigene» umgestellt
    v.freigabeLinkRechte ??= []
    v.freigabeLinkZuschnitt ??= null
    v.gaeste.forEach(gast)
    v.traktanden.forEach((t) => traktandum(t, [...gremium.mitglieder, ...v.gaeste]))
  })

  bundle.protokolle.forEach((p) => {
    p.verfolgerKey ??= neuerKey()
    p.zusatztraktanden ??= [] // im Protokoll hinzugekommene Haupttraktanden (seit 1.4.13)
    p.aenderungsantraege ??= [] // Änderungsanträge nach Abschluss der Sitzung (seit 1.5.02)
    if (!p.dauern || Array.isArray(p.dauern)) p.dauern = {} // tatsächliche Dauer pro Traktandum: { [traktandumId]: Minuten }; PHP liefert leer als []
    p.gaeste.forEach(gast)
    p.eintraege.forEach((e) => {
      if (e.typ === 'antrag') {
        e.stimmen ??= { ja: null, nein: null, enthaltung: null }
        e.vorherigerAntragId ??= null // Antrag, der an einer früheren Sitzung vertagt wurde
        e.notiz ??= '' // Notiz zu Beratung und Beschluss (seit 1.4.13)
      }
      if (e.typ !== 'pendenz') return
      e.zugewiesenAnName ??= gremium.mitglieder.find((m) => m.id === e.zugewiesenAn)?.name || ''
      e.faelligBis ??= ''
    })
  })

  return JSON.stringify(bundle) !== vorher
}

// Früherer Freitext (z. B. «André und Demian») -> Personenliste; bekannte Namen werden verknüpft
function personenListe(wert, personen) {
  if (Array.isArray(wert)) return wert
  if (!wert) return []
  return wert
    .split(/\s*(?:,|\/|&| und )\s*/)
    .filter(Boolean)
    .map((name) => ({ id: personen.find((p) => p.name === name)?.id || null, name }))
}

function traktandum(t, personen) {
  if (!t.verantwortliche) {
    // Frühere Einzelperson (Name + optionale ID) in die Personenliste überführen
    const name = t.verantwortlich || ''
    const id = t.verantwortlichId || personen.find((p) => p.name === name)?.id || null
    t.verantwortliche = name ? [{ id, name }] : []
    delete t.verantwortlich
    delete t.verantwortlichId
  }
  t.bearbeiter ??= []
  t.notiz ??= ''
  t.typ ??= ''
  t.dauer ??= null
  t.pendenzId ??= null
  t.antragId ??= null
  unterpunkte(t)
}

// Unterpunkte auf allen Ebenen (Unterpunkte von Unterpunkten seit 1.3).
// Bis 1.4 war ein Antrag-Punkt mit Unterpunkten stillschweigend eine Antragsliste – seither ist das der eigene Typ «antraege».
function unterpunkte(eintrag, elternTyp = '') {
  eintrag.untertraktanden ??= []
  if (!elternTyp && eintrag.typ === 'antrag' && eintrag.untertraktanden.length) eintrag.typ = 'antraege'
  const typ = elternTyp || eintrag.typ
  eintrag.untertraktanden.forEach((u) => {
    u.notiz ??= ''
    u.typ ??= ''
    u.verantwortliche ??= []
    u.bearbeiter ??= []
    u.istAutomatischUebernommen ??= false // übernommene Pendenzen / vertagte Anträge auch als Unterpunkt (seit 1.4.09)
    u.pendenzId ??= null
    u.antragId ??= null
    unterpunkte(u, typ === 'antraege' ? 'antrag' : typ)
  })
}

function gast(g) {
  g.id ??= crypto.randomUUID()
}
