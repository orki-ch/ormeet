import { neuerKey } from '../utils/keys.js'
import { neuerZugang } from './gremien.js'

// Ältere Datenbestände um später hinzugekommene Felder ergänzen. Liefert true, wenn etwas ergänzt wurde.
export function ergaenzeFelder(bundle) {
  const vorher = JSON.stringify(bundle)
  const gremium = bundle.gremium

  gremium.zugaenge ??= []
  if (gremium.zugangsKey) {
    // Früherer Einzel-Zugangslink -> Teilen-Link mit Vollzugriff
    gremium.zugaenge.push({ ...neuerZugang('Vollzugriff'), key: gremium.zugangsKey, rechte: { sitzungen: 'bearbeiten', mitglieder: 'bearbeiten', einstellungen: 'bearbeiten' } })
    delete gremium.zugangsKey
  }
  gremium.fusstext ??= ''
  gremium.vorlagen ??= []

  // Feste Rollen: Präsidium (Sitzungsleitung) und Aktuariat (Protokollführung)
  gremium.rollen.forEach((r) => {
    r.sollAnwesend ??= true
    r.typ ??= r.name === 'Präsidium' ? 'praesidium' : r.name === 'Aktuariat' ? 'aktuariat' : null
  })
  for (const [typ, name] of [['praesidium', 'Präsidium'], ['aktuariat', 'Aktuariat']]) {
    if (!gremium.rollen.some((r) => r.typ === typ)) gremium.rollen.push({ id: crypto.randomUUID(), name, typ, sollAnwesend: true })
  }

  gremium.mitglieder.forEach((m) => (m.zugangsKey ??= neuerKey())) // zentraler persönlicher Link
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
    s.terminfindung ??= null
    if (s.terminfindung) {
      s.terminfindung.optionen ??= []
      s.terminfindung.stimmen ??= []
      s.terminfindung.kommentare ??= []
    }
  })

  bundle.vorprotokolle.forEach((v) => {
    if (!v.personenKeys || Array.isArray(v.personenKeys)) v.personenKeys = {} // PHP liefert ein leeres Objekt als []
    v.gaeste.forEach(gast)
    v.traktanden.forEach((t) => traktandum(t, [...gremium.mitglieder, ...v.gaeste]))
  })

  bundle.protokolle.forEach((p) => {
    p.verfolgerKey ??= neuerKey()
    p.gaeste.forEach(gast)
    p.eintraege.forEach((e) => {
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
  t.pendenzId ??= null
  t.untertraktanden ??= []
  t.untertraktanden.forEach((u) => {
    u.notiz ??= ''
    u.verantwortliche ??= []
    u.bearbeiter ??= []
  })
}

function gast(g) {
  g.id ??= crypto.randomUUID()
}
