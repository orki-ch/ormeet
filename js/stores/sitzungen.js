import { gremienStore } from './gremien.js'
import { neuerKey } from '../utils/keys.js'
import { kopiereTraktandum, neuesTraktandum } from '../utils/traktanden.js'

const state = Vue.reactive({ sitzungen: [], vorprotokolle: [], protokolle: [] })

// Terminfindung (Nuudel-artig) für eine Sitzung, deren Termin noch offen ist
export function neueTerminfindung() {
  return {
    status: 'offen', // offen | abgeschlossen
    optionen: [], // [{ id, datum, von, bis }]
    stimmen: [], // [{ personId, name, wahl: [{ optionId, wert: 'ja' | 'nein' | 'vielleicht' }] }]
    kommentare: [], // [{ id, personId, name, text, zeit }]
    einzelwahl: false, // nur eine Option mit «Ja»
    verdeckt: false, // Ergebnisse nur für Bearbeiter sichtbar
    bearbeitbar: true, // Teilnehmende dürfen ihre Stimme später ändern
    gewaehlteOptionId: null,
  }
}

export const sitzungenStore = {
  state,

  sitzungById(id) {
    return state.sitzungen.find((s) => s.id === id)
  },

  // Sitzungen ohne festen Termin (Terminfindung) zuletzt
  sitzungenVonGremium(gremiumId) {
    return state.sitzungen.filter((s) => s.gremiumId === gremiumId).sort((a, b) => (a.datum || '9999').localeCompare(b.datum || '9999'))
  },

  vorprotokollById(id) {
    return state.vorprotokolle.find((v) => v.id === id)
  },

  vorprotokollVonSitzung(sitzungId) {
    return state.vorprotokolle.find((v) => v.sitzungId === sitzungId)
  },

  vorprotokollByKey(key) {
    return state.vorprotokolle.find((v) => v.freigabeLinkKey === key)
  },

  vorprotokollByPersonKey(key) {
    return state.vorprotokolle.find((v) => Object.values(v.personenKeys).includes(key))
  },

  protokollById(id) {
    return state.protokolle.find((p) => p.id === id)
  },

  protokollVonSitzung(sitzungId) {
    return state.protokolle.find((p) => p.sitzungId === sitzungId)
  },

  protokollByVerfolgerKey(key) {
    return state.protokolle.find((p) => p.verfolgerKey === key)
  },

  // Alle Protokoll-Einträge eines Gremiums, jeweils mit der zugehörigen Sitzung
  eintraegeVonGremium(gremiumId) {
    return state.protokolle.flatMap((protokoll) => {
      const sitzung = sitzungenStore.sitzungById(protokoll.sitzungId)
      if (sitzung?.gremiumId !== gremiumId) return []
      return protokoll.eintraege.map((eintrag) => ({ eintrag, sitzung }))
    })
  },

  // Einzelner Eintrag (z. B. eine übertragene Pendenz) inkl. Herkunfts-Sitzung
  eintragById(id) {
    for (const protokoll of state.protokolle) {
      const eintrag = protokoll.eintraege.find((e) => e.id === id)
      if (eintrag) return { eintrag, sitzung: sitzungenStore.sitzungById(protokoll.sitzungId) }
    }
  },

  // Offene / in Bearbeitung befindliche Pendenzen aus Sitzungen vor dem angegebenen Datum
  offenePendenzen(gremiumId, vorDatum) {
    return sitzungenStore
      .eintraegeVonGremium(gremiumId)
      .filter(({ eintrag, sitzung }) => eintrag.typ === 'pendenz' && eintrag.pendenzStatus !== 'erfuellt' && sitzung.datum && sitzung.datum < vorDatum)
  },

  erstelleSitzung(gremiumId, { datum, zeit, ort, vorlageId, terminfindung = false }) {
    const vorlage = gremienStore.byId(gremiumId).vorlagen.find((v) => v.id === vorlageId)
    const kopie = (liste) => (liste || []).map((p) => ({ ...p }))
    const sitzung = {
      id: crypto.randomUUID(),
      gremiumId,
      datum: terminfindung ? '' : datum,
      zeit: terminfindung ? '' : zeit,
      ort,
      vorlageId: vorlage?.id || null,
      titel: vorlage?.titel || '',
      // Vorgabe: Mitglieder mit fester Rolle (Präsidium / Aktuariat), sofern die Vorlage nichts vorgibt
      sitzungsleitung: vorlage?.sitzungsleitung?.length ? kopie(vorlage.sitzungsleitung) : gremienStore.mitgliederMitRollentyp(gremiumId, 'praesidium'),
      protokollfuehrung: vorlage?.protokollfuehrung?.length ? kopie(vorlage.protokollfuehrung) : gremienStore.mitgliederMitRollentyp(gremiumId, 'aktuariat'),
      bemerkungen: vorlage?.bemerkungen || '',
      naechsterTerminId: null,
      terminfindung: terminfindung ? neueTerminfindung() : null,
      status: terminfindung ? 'terminfindung' : 'geplant',
    }
    state.sitzungen.push(sitzung)
    return sitzung
  },

  // Terminfindung abschliessen: gewählte Option wird zum Sitzungstermin
  terminFestlegen(sitzungId, optionId) {
    const sitzung = sitzungenStore.sitzungById(sitzungId)
    const option = sitzung.terminfindung.optionen.find((o) => o.id === optionId)
    sitzung.datum = option.datum
    sitzung.zeit = option.von
    sitzung.terminfindung.status = 'abgeschlossen'
    sitzung.terminfindung.gewaehlteOptionId = optionId
    sitzung.status = sitzungenStore.protokollVonSitzung(sitzungId) ? 'laufend' : sitzungenStore.vorprotokollVonSitzung(sitzungId) ? 'vorprotokoll' : 'geplant'
  },

  loescheSitzung(id) {
    state.sitzungen = state.sitzungen.filter((s) => s.id !== id)
    state.vorprotokolle = state.vorprotokolle.filter((v) => v.sitzungId !== id)
    state.protokolle = state.protokolle.filter((p) => p.sitzungId !== id)
    state.sitzungen.forEach((s) => {
      if (s.naechsterTerminId === id) s.naechsterTerminId = null
    })
  },

  loescheSitzungenVonGremium(gremiumId) {
    sitzungenStore.sitzungenVonGremium(gremiumId).forEach((s) => sitzungenStore.loescheSitzung(s.id))
  },

  erstelleVorprotokoll(sitzungId) {
    const sitzung = sitzungenStore.sitzungById(sitzungId)
    const gremium = gremienStore.byId(sitzung.gremiumId)
    const vorlage = gremium.vorlagen.find((v) => v.id === sitzung.vorlageId)
    const vorprotokoll = {
      id: crypto.randomUUID(),
      sitzungId,
      freigabeLinkKey: neuerKey(),
      personenKeys: {}, // persönliche Freigabe-Links für Gäste: { [gastId]: key }
      gaeste: [],
      anwesendeMitgliederIds: gremienStore.erwarteteMitglieder(gremium.id).map((m) => m.id),
      traktanden: (vorlage?.traktanden || []).map(kopiereTraktandum),
    }
    state.vorprotokolle.push(vorprotokoll)
    if (sitzung.status === 'geplant') sitzung.status = 'vorprotokoll'
    sitzungenStore.uebernimmPendenzen(vorprotokoll.id)
    return vorprotokoll
  },

  // Übernimmt noch nicht enthaltene offene Pendenzen früherer Sitzungen als Traktanden (idempotent)
  uebernimmPendenzen(vorprotokollId) {
    const vorprotokoll = sitzungenStore.vorprotokollById(vorprotokollId)
    const sitzung = sitzungenStore.sitzungById(vorprotokoll.sitzungId)
    if (!sitzung.datum) return // Termin noch offen: erst nach der Terminfindung
    const vorhandene = new Set(vorprotokoll.traktanden.map((t) => t.pendenzId))

    sitzungenStore.offenePendenzen(sitzung.gremiumId, sitzung.datum).forEach(({ eintrag }) => {
      if (vorhandene.has(eintrag.id)) return
      vorprotokoll.traktanden.push(
        neuesTraktandum({
          titel: `Pendenz: ${eintrag.titel}`,
          themenbereichId: eintrag.themenbereichId,
          verantwortliche: eintrag.zugewiesenAnName ? [{ id: eintrag.zugewiesenAn || null, name: eintrag.zugewiesenAnName }] : [],
          reihenfolge: vorprotokoll.traktanden.length + 1,
          istAutomatischUebernommen: true,
          pendenzId: eintrag.id,
        }),
      )
    })
  },

  starteProtokoll(sitzungId) {
    const sitzung = sitzungenStore.sitzungById(sitzungId)
    const vorprotokoll = sitzungenStore.vorprotokollVonSitzung(sitzungId)
    const erwarteteIds = gremienStore.erwarteteMitglieder(sitzung.gremiumId).map((m) => m.id)
    const protokoll = {
      id: crypto.randomUUID(),
      sitzungId,
      datum: sitzung.datum,
      ort: sitzung.ort,
      anwesende: [...vorprotokoll.anwesendeMitgliederIds],
      abwesende: erwarteteIds.filter((id) => !vorprotokoll.anwesendeMitgliederIds.includes(id)),
      gaeste: vorprotokoll.gaeste.map((g) => ({ ...g })),
      eintraege: [],
      verfolgerKey: neuerKey(), // Live-Ansicht (nur lesen)
    }
    state.protokolle.push(protokoll)
    sitzung.status = 'laufend'
    return protokoll
  },

  speichereProtokoll(protokoll) {
    const index = state.protokolle.findIndex((p) => p.id === protokoll.id)
    state.protokolle[index] = JSON.parse(JSON.stringify(protokoll))
  },
}
