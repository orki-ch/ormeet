import { gremienStore } from './gremien.js'
import { sitzungenStore } from './sitzungen.js'
import { sync } from './sync.js'
import { updateStand } from './updates.js'
import { rolleIm, personIdIm, istLeitung } from '../utils/rechte.js'
import { alleUnterpunkte, istBerechtigt } from '../utils/traktanden.js'
import { formatDatum } from '../utils/labels.js'

// Benachrichtigungen werden aus den geladenen Daten abgeleitet (kein Serverzustand nötig);
// jede hat eine ID, die sich mit dem Zustand ändert – gelesene IDs merkt sich der Browser.
const GELESEN_KEY = 'ormeet-gelesen'
export const gelesen = Vue.reactive({ ids: JSON.parse(localStorage.getItem(GELESEN_KEY) || '[]') })

function merken() {
  gelesen.ids = gelesen.ids.slice(-500)
  localStorage.setItem(GELESEN_KEY, JSON.stringify(gelesen.ids))
}

export function alsGelesen(ids) {
  gelesen.ids = [...new Set([...gelesen.ids, ...ids])]
  merken()
}

function heuteIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function tageBis(iso) {
  return Math.round((new Date(iso) - new Date(heuteIso())) / 86400000)
}

function inTagen(d) {
  return d === 0 ? 'heute' : d === 1 ? 'morgen' : `in ${d} Tagen`
}

function sitzungName(s) {
  return `«${s.titel || 'Sitzung'}»${s.datum ? ' vom ' + formatDatum(s.datum) : ''}`
}

// Alle Benachrichtigungen für den aktuellen Zugang: { id, text, ziel, gremium }
export function benachrichtigungen() {
  const zugriff = sync.zugriff
  if (!zugriff || ['verfolger', 'themenbereich', 'freigabe'].includes(zugriff.rolle)) return []
  const liste = []
  const melde = (id, text, ziel, gremium) => liste.push({ id, text, ziel, gremium: gremium?.name || '' })

  for (const g of gremienStore.state.gremien) {
    const rolle = rolleIm(g.id)
    if (!rolle) continue
    const verwaltet = rolle === 'admin' || rolle === 'gremium'
    const personId = personIdIm(g.id)
    const person = personId ? gremienStore.person(g.id, [], personId) : null
    const erwartet = person && gremienStore.erwarteteMitglieder(g.id).some((m) => m.id === personId)

    for (const s of sitzungenStore.sitzungenVonGremium(g.id)) {
      const leitung = person && istLeitung(s, personId)
      const tf = s.terminfindung
      const vp = sitzungenStore.vorprotokollVonSitzung(s.id)
      const p = sitzungenStore.protokollVonSitzung(s.id)
      const beteiligt = tf && person && tf.stimmen.some((st) => st.personId === personId)

      if (tf?.status === 'offen') {
        if (person && !beteiligt) melde(`abstimmen:${s.id}`, `Terminfindung ${sitzungName(s)}: deine Stimme fehlt noch`, `/sitzung/${s.id}/terminfindung`, g)
        if (verwaltet || leitung) {
          const alle = gremienStore.erwarteteMitglieder(g.id)
          if (alle.length && alle.every((m) => tf.stimmen.some((st) => st.personId === m.id))) {
            melde(`abgestimmt:${s.id}:${tf.stimmen.length}`, `Terminfindung ${sitzungName(s)}: alle haben abgestimmt – Termin festlegen`, `/sitzung/${s.id}/terminfindung`, g)
          }
        }
        if (verwaltet || leitung || beteiligt) {
          for (const k of tf.kommentare) {
            if (k.personId !== personId) melde(`kommentar:${k.id}`, `${k.name || 'Jemand'} hat die Terminfindung ${sitzungName(s)} kommentiert`, `/sitzung/${s.id}/terminfindung`, g)
          }
        }
      }
      if (tf?.status === 'abgeschlossen' && s.datum && (beteiligt || erwartet)) {
        melde(`termin:${s.id}:${s.datum}`, `Termin festgelegt: ${sitzungName(s)}${s.zeit ? ', ' + s.zeit : ''}`, `/sitzung/${s.id}/vorprotokoll`, g)
      }
      if (s.status === 'abgeschlossen') {
        if (p && (erwartet || leitung || p.anwesende.includes(personId))) melde(`protokoll:${p.id}`, `Das Protokoll ${sitzungName(s)} ist abgeschlossen`, `/sitzung/${s.id}/protokoll`, g)
      } else {
        if (s.datum && (verwaltet || erwartet || leitung)) {
          const d = tageBis(s.datum)
          if (d >= 0 && d <= 7) melde(`bald:${s.id}:${s.datum}`, `Sitzung ${sitzungName(s)} findet ${inTagen(d)} statt`, `/sitzung/${s.id}/${p ? 'protokoll' : 'vorprotokoll'}`, g)
        }
        if (leitung) melde(`leitung:${s.id}`, `Du bist Sitzungsleitung / Protokollführung der Sitzung ${sitzungName(s)}`, `/sitzung/${s.id}/vorprotokoll`, g)
        if (person && vp && !leitung) {
          for (const t of vp.traktanden) {
            const haupt = istBerechtigt(t, person)
            if (haupt) melde(`traktandum:${t.id}`, `Traktandum «${t.titel}» ist dir zugewiesen (${sitzungName(s)})`, `/sitzung/${s.id}/vorprotokoll`, g)
            for (const u of alleUnterpunkte(t)) {
              if (!haupt && istBerechtigt(u, person)) melde(`traktandum:${u.id}`, `Unterpunkt «${u.titel}» ist dir zugewiesen (${sitzungName(s)})`, `/sitzung/${s.id}/vorprotokoll`, g)
            }
          }
        }
      }
      if (p && person) {
        for (const e of p.eintraege) {
          if (e.typ !== 'pendenz' || e.zugewiesenAn !== personId || e.pendenzStatus === 'erfuellt') continue
          melde(`pendenz:${e.id}`, `Neue Pendenz für dich: «${e.titel}»`, `/sitzung/${s.id}/protokoll`, g)
          if (!e.faelligBis) continue
          const d = tageBis(e.faelligBis)
          if (d < 0) melde(`ueberfaellig:${e.id}:${e.faelligBis}`, `Pendenz «${e.titel}» ist seit ${formatDatum(e.faelligBis)} überfällig`, `/sitzung/${s.id}/protokoll`, g)
          else if (d <= 7) melde(`faellig:${e.id}:${e.faelligBis}`, `Pendenz «${e.titel}» ist ${inTagen(d)} fällig`, `/sitzung/${s.id}/protokoll`, g)
        }
      }
    }
  }

  if (zugriff.rolle === 'benutzer') {
    for (const g of zugriff.gremien) {
      const ziel = g.rolle === 'eigentuemer' ? `/gremium/${g.gremiumId}` : `/meine/${g.gremiumId}`
      melde(`gremium:${g.gremiumId}`, `Du hast Zugang zum Gremium «${g.name}»${g.rolle === 'eigentuemer' ? ' (verwalten)' : ''}`, ziel)
    }
  }
  if (zugriff.rolle === 'admin') {
    for (const k of sync.konten) melde(`konto:${k.id}`, `Neues Konto: ${k.name} (${k.email})`, '/benutzer')
    if (updateStand.verfuegbar) melde(`update:${updateStand.aktuell}`, `Update auf Version ${updateStand.aktuell} verfügbar`, '/einstellungen')
  }

  const ungelesen = (n) => !gelesen.ids.includes(n.id)
  return liste.map((n) => ({ ...n, neu: ungelesen(n) })).sort((a, b) => b.neu - a.neu)
}
