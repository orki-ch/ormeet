import { neuerKey } from '../utils/keys.js'
import { GRUPPEN } from '../utils/traktanden.js'

const state = Vue.reactive({ gremien: [] })

export const BEREICHE = { sitzungen: 'Sitzungen', mitglieder: 'Mitglieder & Rollen', einstellungen: 'Protokoll-Einstellungen' }

// Vorlage-Rollen (nicht löschbar, Standard «Alles»): Sitzungsleitung (früher Präsidium) und Aktuariat
export const ROLLEN_TYPEN = { praesidium: 'Sitzungsleitung', aktuariat: 'Aktuariat' }

// Aufgaben pro Sitzung: zentral bei Mitgliedern hinterlegt (gremium.aufgaben), pro Sitzung auch als Vertretung
export const AUFGABEN = { sitzungsleitung: 'Sitzungsleitung', protokollfuehrung: 'Protokollführung' }

// Rollenrechte: ein Hauptschalter; «Individuell» schaltet Einzelrechte frei (bereich:recht)
export const ROLLEN_STUFEN = { lesen: 'Lesen', eigene: 'Eigene', alles: 'Alles' }
// Gremiumsrechte einer Rolle: Reiter der Gremium-Seite (den Reiter «Zugriffe» öffnet das Sitzungsrecht «Zugriffe verwalten»)
export const GREMIUMSRECHTE = {
  kurzsitzungen: 'Kurzsitzungen',
  mitglieder: 'Mitglieder & Rollen',
  einstellungen: 'Protokoll-Einstellungen',
  teilen: 'Teilen',
}

export const SITZUNGSRECHTE = {
  eintragen: 'Sitzungen eintragen',
  starten: 'Sitzung starten und abschliessen',
  antraege: 'Änderungsanträge entscheiden',
  einladungen: 'Einladungen senden',
  zugriffe: 'Zugriffe verwalten (alle Sitzungen, Reiter «Zugriffe»)',
}

export function neuerZugang(name) {
  return { id: crypto.randomUUID(), key: neuerKey(), name, rechte: { sitzungen: 'bearbeiten', mitglieder: 'lesen', einstellungen: 'lesen' }, ablauf: '' }
}

export const gremienStore = {
  state,

  byId(id) {
    return state.gremien.find((g) => g.id === id)
  },

  mitgliedName(gremiumId, mitgliedId) {
    return gremienStore.byId(gremiumId)?.mitglieder.find((m) => m.id === mitgliedId)?.name || '–'
  },

  // Mitglieder (+ optionale Gäste) als Auswahlliste für Personenfelder
  personen(gremiumId, gaeste = []) {
    const mitglieder = gremienStore.byId(gremiumId)?.mitglieder || []
    return [...mitglieder, ...gaeste].filter((p) => p.name).map(({ id, name }) => ({ id, name }))
  },

  // Personen + Rollen + Gruppen für «Dürfen zusätzlich bearbeiten»
  bearbeiterAuswahl(gremiumId, gaeste = []) {
    const rollen = (gremienStore.byId(gremiumId)?.rollen || []).map((r) => ({ id: `rolle:${r.id}`, name: `Rolle: ${r.name}` }))
    return [...gremienStore.personen(gremiumId, gaeste), ...rollen, ...GRUPPEN]
  },

  // Mitglied oder Gast zu einer ID (für Berechtigungsprüfung)
  person(gremiumId, gaeste, personId) {
    const gremium = gremienStore.byId(gremiumId)
    return gremium?.mitglieder.find((m) => m.id === personId) || gaeste.find((g) => g.id === personId) || null
  },

  // Hauptschalter einer Rolle (rolle.rechte = { stufe, einzel }): lesen | eigene | individuell | alles
  // Ohne Angabe: Vorlagen «Alles», sonst «Eigene» (wie api.php rechteAusRolle)
  rolleStufe(rolle) {
    return rolle?.rechte?.stufe || (['praesidium', 'aktuariat'].includes(rolle?.typ) ? 'alles' : 'eigene')
  },

  // Rechte einer Rolle (siehe api.php rechteAusRolle): Stufe bzw. Einzelrechte pro Dokument, Sitzungs- und Gremiumsrechte
  rolleRechte(rolle) {
    const keine = Object.fromEntries(Object.keys(SITZUNGSRECHTE).map((k) => [k, false]))
    const stufe = gremienStore.rolleStufe(rolle)
    if (stufe === 'alles') return { vorprotokoll: 'alles', protokoll: 'alles', gremium: Object.keys(GREMIUMSRECHTE), ...Object.fromEntries(Object.keys(SITZUNGSRECHTE).map((k) => [k, true])) }
    if (stufe !== 'individuell') return { vorprotokoll: stufe, protokoll: stufe, gremium: [], ...keine }
    const einzel = rolle.rechte.einzel || []
    const teil = (bereich) => einzel.filter((e) => e.startsWith(bereich + ':')).map((e) => e.slice(bereich.length + 1))
    return {
      vorprotokoll: teil('vorprotokoll'),
      protokoll: teil('protokoll'),
      gremium: teil('gremium').filter((r) => GREMIUMSRECHTE[r]),
      ...Object.fromEntries(Object.keys(SITZUNGSRECHTE).map((k) => [k, teil('sitzung').includes(k)])),
    }
  },

  // Mitglieder mit einer zentral hinterlegten Aufgabe (sitzungsleitung / protokollfuehrung) als Personenliste
  aufgabenPersonen(gremiumId, aufgabe) {
    const gremium = gremienStore.byId(gremiumId)
    const ids = gremium?.aufgaben?.[aufgabe] || []
    return gremium ? gremium.mitglieder.filter((m) => ids.includes(m.id)).map(({ id, name }) => ({ id, name })) : []
  },

  // Rechte der Rolle eines Mitglieds (Gäste: Standard)
  rechteVon(gremiumId, personId) {
    const gremium = gremienStore.byId(gremiumId)
    const mitglied = gremium?.mitglieder.find((m) => m.id === personId)
    return gremienStore.rolleRechte(mitglied && gremium.rollen.find((r) => r.id === mitglied.rolleId))
  },

  // Darf die Rolle des Mitglieds Sitzungen eintragen (und das Recht anderen geben)?
  hatFesteRolle(gremiumId, mitglied) {
    return !!mitglied && gremienStore.rechteVon(gremiumId, mitglied.id).eintragen
  },

  // Mitglieder, deren Rolle an Sitzungen erwartet wird (Grundlage für Anwesenheit / Entschuldigte)
  erwarteteMitglieder(gremiumId) {
    const gremium = gremienStore.byId(gremiumId)
    return gremium.mitglieder.filter((m) => gremium.rollen.find((r) => r.id === m.rolleId)?.sollAnwesend !== false)
  },

  rolleName(gremiumId, rolleId) {
    return gremienStore.byId(gremiumId)?.rollen.find((r) => r.id === rolleId)?.name || ''
  },

  // kurz: versteckter Behälter einer Kurzsitzung ohne Gremium (Teilnehmende sind seine Mitglieder)
  erstelle(name, beschreibung, kurz = false) {
    const gremium = {
      id: crypto.randomUUID(),
      name,
      beschreibung,
      kurz,
      eigentuemerId: null, // setzt der Server, wenn ein Konto das Gremium anlegt
      zugaenge: [], // Teilen-Links mit Rechten pro Bereich
      fusstext:
        'Rückmeldungen, Korrekturen und Ergänzungen zum Protokoll können innert 30 Tagen an die Protokollführung erfolgen. Danach gilt das Protokoll als angenommen.',
      themenbereiche: [],
      erinnerungTage: 3, // Erinnerung «Sitzung steht bevor» (Glocke, E-Mail)
      rollen: [
        { id: crypto.randomUUID(), name: 'Sitzungsleitung', typ: 'praesidium', sollAnwesend: true, rechte: {} },
        { id: crypto.randomUUID(), name: 'Aktuariat', typ: 'aktuariat', sollAnwesend: true, rechte: {} },
        { id: crypto.randomUUID(), name: 'Mitglied', typ: null, sollAnwesend: true, rechte: {} },
      ],
      mitglieder: [],
      aufgaben: { sitzungsleitung: [], protokollfuehrung: [] }, // zentral hinterlegte Aufgaben (Mitglied-IDs)
      vorlagen: [],
    }
    state.gremien.push(gremium)
    return gremium
  },

  loesche(id) {
    state.gremien = state.gremien.filter((g) => g.id !== id)
  },

  fuegeThemenbereichHinzu(gremiumId, name, farbe) {
    const themenbereich = { id: crypto.randomUUID(), name, farbe, freigabeKey: neuerKey() }
    gremienStore.byId(gremiumId).themenbereiche.push(themenbereich)
    return themenbereich
  },
}
