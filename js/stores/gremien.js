import { neuerKey } from '../utils/keys.js'
import { GRUPPEN } from '../utils/traktanden.js'

const state = Vue.reactive({ gremien: [] })

export const BEREICHE = { sitzungen: 'Sitzungen', mitglieder: 'Mitglieder & Rollen', einstellungen: 'Protokoll-Einstellungen' }

// Feste Rollen: Sitzungsleitung (Präsidium) und Protokollführung (Aktuariat) – nicht löschbar
export const ROLLEN_TYPEN = { praesidium: 'Sitzungsleitung', aktuariat: 'Protokollführung' }

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

  // Rechte einer Rolle (rolle.rechte, siehe api.php rolleRechte): Standardstufe pro Dokument, Sitzungsführung (Vorschlag
  // als Sitzungsleitung / Protokollführung), Sitzungen eintragen, Zugriffe verwalten. Vorlage: Präsidium / Aktuariat
  rolleRechte(rolle) {
    const standard = { vorprotokoll: 'eigene', protokoll: 'eigene', fuehrung: '', eintragen: false, zugriffe: false }
    const vorlage = rolle?.typ === 'praesidium' ? { fuehrung: 'sitzungsleitung', eintragen: true } : rolle?.typ === 'aktuariat' ? { fuehrung: 'protokollfuehrung', eintragen: true } : {}
    const gesetzt = Object.fromEntries(Object.entries(rolle?.rechte || {}).filter(([, wert]) => wert !== null && wert !== undefined))
    return { ...standard, ...vorlage, ...gesetzt }
  },

  // Rechte der Rolle eines Mitglieds (Gäste: Standard)
  rechteVon(gremiumId, personId) {
    const gremium = gremienStore.byId(gremiumId)
    const mitglied = gremium?.mitglieder.find((m) => m.id === personId)
    return gremienStore.rolleRechte(mitglied && gremium.rollen.find((r) => r.id === mitglied.rolleId))
  },

  // Mitglieder, deren Rolle die Sitzung führt (sitzungsleitung / protokollfuehrung; frühere Namen praesidium / aktuariat),
  // als Personenliste – Vorschlag für neue Sitzungen
  mitgliederMitRollentyp(gremiumId, typ) {
    const fuehrung = { praesidium: 'sitzungsleitung', aktuariat: 'protokollfuehrung' }[typ] || typ
    const gremium = gremienStore.byId(gremiumId)
    const rolleIds = gremium.rollen.filter((r) => gremienStore.rolleRechte(r).fuehrung === fuehrung).map((r) => r.id)
    return gremium.mitglieder.filter((m) => rolleIds.includes(m.rolleId)).map(({ id, name }) => ({ id, name }))
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
        { id: crypto.randomUUID(), name: 'Präsidium', typ: 'praesidium', sollAnwesend: true, rechte: {} },
        { id: crypto.randomUUID(), name: 'Aktuariat', typ: 'aktuariat', sollAnwesend: true, rechte: {} },
        { id: crypto.randomUUID(), name: 'Mitglied', typ: null, sollAnwesend: true, rechte: {} },
      ],
      mitglieder: [],
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
