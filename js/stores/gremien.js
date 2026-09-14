import { neuerKey } from '../utils/keys.js'
import { GRUPPEN } from '../utils/traktanden.js'

const state = Vue.reactive({ gremien: [] })

export const BEREICHE = { sitzungen: 'Sitzungen', mitglieder: 'Mitglieder & Rollen', einstellungen: 'Protokoll-Einstellungen' }

// Feste Rollen: Sitzungsleitung (Präsidium) und Protokollführung (Aktuariat) – nicht löschbar
export const ROLLEN_TYPEN = { praesidium: 'Sitzungsleitung', aktuariat: 'Protokollführung' }

export function neuerZugang(name) {
  return { id: crypto.randomUUID(), key: neuerKey(), name, rechte: { sitzungen: 'bearbeiten', mitglieder: 'lesen', einstellungen: 'lesen' } }
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

  // Mitglieder mit einer festen Rolle (praesidium / aktuariat) als Personenliste
  mitgliederMitRollentyp(gremiumId, typ) {
    const gremium = gremienStore.byId(gremiumId)
    const rolleIds = gremium.rollen.filter((r) => r.typ === typ).map((r) => r.id)
    return gremium.mitglieder.filter((m) => rolleIds.includes(m.rolleId)).map(({ id, name }) => ({ id, name }))
  },

  // Mitglieder, deren Rolle an Sitzungen erwartet wird (Grundlage für Anwesenheit / Entschuldigte)
  erwarteteMitglieder(gremiumId) {
    const gremium = gremienStore.byId(gremiumId)
    return gremium.mitglieder.filter((m) => gremium.rollen.find((r) => r.id === m.rolleId)?.sollAnwesend !== false)
  },

  rolleName(gremiumId, rolleId) {
    return gremienStore.byId(gremiumId)?.rollen.find((r) => r.id === rolleId)?.name || ''
  },

  erstelle(name, beschreibung) {
    const gremium = {
      id: crypto.randomUUID(),
      name,
      beschreibung,
      zugaenge: [], // Teilen-Links mit Rechten pro Bereich
      fusstext:
        'Rückmeldungen, Korrekturen und Ergänzungen zum Protokoll können innert 30 Tagen an die Protokollführung erfolgen. Danach gilt das Protokoll als angenommen.',
      themenbereiche: [],
      rollen: [
        { id: crypto.randomUUID(), name: 'Präsidium', typ: 'praesidium', sollAnwesend: true },
        { id: crypto.randomUUID(), name: 'Aktuariat', typ: 'aktuariat', sollAnwesend: true },
        { id: crypto.randomUUID(), name: 'Mitglied', typ: null, sollAnwesend: true },
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
