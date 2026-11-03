import { sync, recht } from '../stores/sync.js'
import { gremienStore } from '../stores/gremien.js'
import { sitzungenStore } from '../stores/sitzungen.js'

// Wirksame Rolle im Gremium: ein Konto ist dort Eigentümer (-> 'admin') oder verknüpftes Mitglied (-> 'person')
export function rolleIm(gremiumId) {
  const zugriff = sync.zugriff
  if (!zugriff) return null
  if (zugriff.rolle !== 'benutzer') return zugriff.rolle
  const g = zugriff.gremien.find((g) => g.gremiumId === gremiumId)
  if (!g) return null
  if (g.rolle === 'gast') return 'freigabe' // weitere Person: Gast genau einer Sitzung
  return g.rolle === 'eigentuemer' ? 'admin' : 'person'
}

// Konto, dessen persönliche Übersicht gezeigt wird: das angemeldete Konto oder das mit dem Superadmin verknüpfte
export function uebersichtsKonto() {
  const zugriff = sync.zugriff
  return zugriff?.rolle === 'benutzer' ? zugriff : zugriff?.konto || null
}

// ID der eigenen Person (Mitglied / Gast) in diesem Gremium
export function personIdIm(gremiumId) {
  const zugriff = sync.zugriff
  if (!zugriff) return null
  if (zugriff.rolle !== 'benutzer') return zugriff.personId || null
  return zugriff.gremien.find((g) => g.gremiumId === gremiumId)?.personId || null
}

// Mitglied / Gast hinter dem aktuellen Zugang (persönlicher Link, Gast-Link, Konto)
export function aktuellePerson(gremiumId, gaeste = []) {
  const id = personIdIm(gremiumId)
  return id ? gremienStore.person(gremiumId, gaeste, id) : null
}

// Startseite des Zugangs für ein Gremium: persönliche Übersicht oder Gremium-Seite
export function zurueckZu(gremiumId) {
  const rolle = rolleIm(gremiumId)
  // Kurzsitzung ohne Gremium: zurück zur Übersicht (Eingeladene mit Link haben keine)
  if (gremienStore.byId(gremiumId)?.kurz) return ['admin', 'benutzer'].includes(sync.zugriff?.rolle) ? { pfad: '/', text: 'Übersicht' } : { pfad: '', text: '' }
  if (rolle === 'person') return { pfad: sync.zugriff.rolle === 'benutzer' ? `/meine/${gremiumId}` : '/meine', text: 'Meine Übersicht' }
  if (rolle === 'admin' || rolle === 'gremium') return { pfad: `/gremium/${gremiumId}`, text: gremienStore.byId(gremiumId)?.name || 'Gremium' }
  return { pfad: '', text: '' }
}

// Sitzungsleitung oder Protokollführung dieser Sitzung -> voller Zugriff auf Vor- und Protokoll
export function istLeitung(sitzung, personId) {
  return [...sitzung.sitzungsleitung, ...sitzung.protokollfuehrung].some((p) => p.id === personId)
}

// Freigabestufen pro Person und Dokument (Vorprotokoll / Protokoll):
// lesen = nur ansehen · eigene = zugewiesene Traktanden bearbeiten · alles = ganzes Dokument bearbeiten
export const FREIGABE_STUFEN = { lesen: 'Lesen', eigene: 'Eigene', alles: 'Alles' }

// Einzelrechte («Individuell») pro Dokument – für Personen in der Teilen-Karte und zusätzliche allgemeine Links
export const EINZELRECHTE = {
  terminfindung: { abstimmen: 'Abstimmen', kommentieren: 'Kommentieren' },
  vorprotokoll: { traktandenBearbeiten: 'Traktanden bearbeiten', traktandenHinzufuegen: 'Traktanden hinzufügen', anwesenheit: 'Anwesenheit', gaeste: 'Gäste' },
  protokoll: { information: 'Informationen', pendenz: 'Pendenzen', antrag: 'Antragsbeschlüsse' },
}

// Standard ohne gesetzte Freigabe: Leitung alles, alle anderen ihre eigenen Traktanden
export function standardStufe(sitzung, personId) {
  return istLeitung(sitzung, personId) ? 'alles' : 'eigene'
}

// Über einen allgemeinen Link eingetragene Person (Gast mit ueberLink): ihr Link – ein zusätzlicher Link der Sitzung
// oder der allgemeine Freigabe-Link (Vorprotokoll «Alles», Terminfindung). Gelöschter Link: nur noch lesen.
function herkunftsLink(sitzung, personId) {
  const gast = sitzungenStore.vorprotokollVonSitzung(sitzung.id)?.gaeste.find((g) => g.id === personId)
  if (!gast?.ueberLink) return null
  if (gast.ueberLink === 'freigabe') return { dokument: 'vorprotokoll', stufe: 'alles', rechte: [], terminfindung: true }
  return (sitzung.links || []).find((l) => l.id === gast.ueberLink) || { dokument: '', stufe: 'lesen', rechte: [] }
}

// Rechte daraus: auf dem Dokument des Links dessen Rechte («Alles» = alle Einzelrechte), sonst nur lesen
function linkGastFreigabe(info, dokument) {
  if (dokument === info.dokument) {
    if (info.stufe === 'alles') return Object.keys(EINZELRECHTE[dokument])
    if (info.stufe === 'individuell') return info.rechte.filter((r) => EINZELRECHTE[dokument][r])
    return 'lesen'
  }
  if (dokument === 'terminfindung' && info.terminfindung) return Object.keys(EINZELRECHTE.terminfindung)
  return 'lesen'
}

// Gesetzte Freigabe (Stufe oder Liste von Einzelrechten); ohne: die Rechte des Links, über den die Person kam
export function freigabeRoh(sitzung, dokument, personId) {
  const stufe = sitzung.freigaben?.[dokument]?.[personId]
  if (stufe !== undefined) return stufe
  const info = herkunftsLink(sitzung, personId)
  return info ? linkGastFreigabe(info, dokument) : undefined
}

// Wirksame Stufe: in der Sitzung gesetzte Freigabe überschreibt den Standard
export function freigabeStufe(sitzung, dokument, personId) {
  if (sitzung.kurz) dokument = 'protokoll' // Kurzsitzung: nur ein Dokument, Traktanden liegen im versteckten Vorprotokoll
  const stufe = freigabeRoh(sitzung, dokument, personId)
  if (Array.isArray(stufe)) return 'individuell' // Liste von Einzelrechten
  return FREIGABE_STUFEN[stufe] ? stufe : standardStufe(sitzung, personId)
}

// Terminfindung: abstimmen / kommentieren – über einen Link eingetragene Personen nur, wenn ihr Link es erlaubt
export function tfRecht(sitzung, name) {
  const personId = personIdIm(sitzung.gremiumId)
  const rechte = personId ? freigabeRoh(sitzung, 'terminfindung', personId) : undefined
  return rechte === undefined || (Array.isArray(rechte) && rechte.includes(name))
}

// Kennung für selbst hinzugefügte Traktanden (Einzelrecht «Traktanden hinzufügen»): Person oder Link
export function eigeneKennung(gremiumId) {
  return sync.zugriff?.rolle === 'link' ? 'link:' + sync.zugriff.linkId : personIdIm(gremiumId)
}

// Gilt für den eigenen Zugang auf diesem Dokument «Individuell» (Einzelrechte)?
export function istIndividuell(sitzung, dokument) {
  const zugriff = sync.zugriff
  // Zusätzlicher allgemeiner Link: auch «Alles» läuft über die Einzelrechte (alle) – Sitzung starten, abschliessen oder
  // Kopfdaten ändern kann ein Link nie
  if (zugriff?.rolle === 'link') return zugriff.sitzungId === sitzung.id && zugriff.dokument === dokument && zugriff.stufe !== 'lesen'
  const personId = personIdIm(sitzung.gremiumId)
  return !!personId && dokument !== 'terminfindung' && freigabeStufe(sitzung, dokument, personId) === 'individuell'
}

// Einzelrecht auf ein Dokument: zusätzlicher allgemeiner Link («Alles» oder gewählte Einzelrechte) oder Person mit «Individuell»
export function einzelrecht(sitzung, dokument, name) {
  if (istGenehmigt(sitzung)) return false
  const zugriff = sync.zugriff
  if (zugriff?.rolle === 'link') {
    if (zugriff.sitzungId !== sitzung.id || zugriff.dokument !== dokument) return false
    return zugriff.stufe === 'alles' || (zugriff.stufe === 'individuell' && zugriff.rechte.includes(name))
  }
  if (!istIndividuell(sitzung, dokument)) return false
  const personId = personIdIm(sitzung.gremiumId)
  const rechte = freigabeRoh(sitzung, sitzung.kurz ? 'protokoll' : dokument, personId)
  return Array.isArray(rechte) && rechte.includes(name)
}

// Genehmigtes Protokoll: Vorprotokoll und Protokoll dieser Sitzung sind für alle eingefroren
export function istGenehmigt(sitzung) {
  return !!sitzung.genehmigt
}

// Darf die eigene Person (Mitglied / Gast) ihre zugewiesenen Traktanden in diesem Dokument bearbeiten? (false bei Freigabe «Lesen»)
export function darfEigene(sitzung, dokument) {
  if (istGenehmigt(sitzung) || sync.zugriff?.rolle === 'link' || istIndividuell(sitzung, dokument)) return false
  const personId = personIdIm(sitzung.gremiumId)
  return !personId || freigabeStufe(sitzung, dokument, personId) !== 'lesen'
}

// Änderungsanträge nach Abschluss einer Sitzung (bis zur Genehmigung, nie bei Kurzsitzungen). Stellen darf ein Mitglied
// mit verknüpftem Konto, das an der Sitzung erwartet oder anwesend war – sofern es das Protokoll nicht selbst ganz bearbeitet.
export function aenderungenOffen(sitzung) {
  return !sitzung.kurz && sitzung.status === 'abgeschlossen' && !istGenehmigt(sitzung)
}

export function darfAenderungStellen(sitzung, protokoll) {
  const person = gremienStore.byId(sitzung.gremiumId)?.mitglieder.find((m) => m.id === personIdIm(sitzung.gremiumId))
  if (!aenderungenOffen(sitzung) || !person?.benutzerId || vollzugriff(sitzung, 'protokoll')) return false
  return gremienStore.erwarteteMitglieder(sitzung.gremiumId).some((m) => m.id === person.id) || protokoll.anwesende.includes(person.id)
}

// Entscheiden (übernommen / abgelehnt) darf die Protokollführung bzw. wer das Gremium verwaltet
export function darfAenderungEntscheiden(sitzung) {
  if (!aenderungenOffen(sitzung)) return false
  const rolle = rolleIm(sitzung.gremiumId)
  if (rolle === 'admin') return true
  if (rolle === 'gremium') return recht('sitzungen', sitzung.gremiumId) === 'bearbeiten'
  return sitzung.protokollfuehrung.some((p) => p.id === personIdIm(sitzung.gremiumId))
}

// Darf das ganze Dokument (Vorprotokoll / Protokoll / Terminfindung) einer Sitzung bearbeitet werden?
export function vollzugriff(sitzung, dokument = 'protokoll') {
  const rolle = rolleIm(sitzung.gremiumId)
  if (!rolle || istGenehmigt(sitzung)) return false
  if (rolle === 'admin') return true
  if (rolle === 'gremium') return recht('sitzungen', sitzung.gremiumId) === 'bearbeiten'
  const personId = personIdIm(sitzung.gremiumId)
  if (personId) return freigabeStufe(sitzung, dokument, personId) === 'alles'
  if (rolle === 'freigabe') return dokument === 'vorprotokoll' // allgemeiner Freigabe-Link
  return false
}

// Mitglied hinter dem angemeldeten Konto (nicht über den persönlichen Link)
function kontoMitglied(gremiumId) {
  if (sync.zugriff?.rolle !== 'benutzer') return null
  return gremienStore.byId(gremiumId)?.mitglieder.find((m) => m.id === personIdIm(gremiumId) && m.benutzerId) || null
}

// Neue Sitzungen eintragen: wer Sitzungen verwaltet, Präsidium / Aktuariat mit Konto und Konten mit zugeteiltem Recht
export function darfSitzungenEintragen(gremiumId) {
  if (recht('sitzungen', gremiumId) === 'bearbeiten') return true
  const mitglied = kontoMitglied(gremiumId)
  return !!mitglied && (gremienStore.hatFesteRolle(gremiumId, mitglied) || !!mitglied.darfSitzungenEintragen)
}

// Das Recht «Sitzungen eintragen» an andere Konten vergeben: Präsidium / Aktuariat mit Konto (Admin im Gremium selbst)
export function darfEintragenVergeben(gremiumId) {
  const mitglied = kontoMitglied(gremiumId)
  return !!mitglied && gremienStore.hatFesteRolle(gremiumId, mitglied)
}

// Person, die die Sitzung eingetragen hat; ältere Sitzungen ohne Angabe: die Sitzungsleitung
export function istErsteller(sitzung, personId) {
  if (!personId) return false
  return sitzung.erstelltVon ? sitzung.erstelltVon === personId : sitzung.sitzungsleitung.some((p) => p.id === personId)
}

// Terminfindung bearbeiten: Superadmin / Eigentümer, Gremium-Zugang mit Bearbeitungsrecht, die erstellende Person und
// wem sie die Bearbeitung freigegeben hat (Rollen oder Personen)
export function darfTerminfindung(sitzung) {
  if (darfTerminfindungFreigeben(sitzung)) return true
  if (rolleIm(sitzung.gremiumId) === 'gremium') return recht('sitzungen', sitzung.gremiumId) === 'bearbeiten'
  const personId = personIdIm(sitzung.gremiumId)
  if (!personId) return false
  const rolleId = gremienStore.byId(sitzung.gremiumId)?.mitglieder.find((m) => m.id === personId)?.rolleId
  return (sitzung.terminfindung?.freigabe || []).some((id) => id === personId || id === 'rolle:' + rolleId)
}

// Bearbeitung der Terminfindung freigeben: nur die erstellende Person (und Superadmin / Eigentümer)
export function darfTerminfindungFreigeben(sitzung) {
  if (rolleIm(sitzung.gremiumId) === 'admin') return true
  return istErsteller(sitzung, personIdIm(sitzung.gremiumId))
}

// Sitzung verwalten (Zugriffe, Links, Sperren): Superadmin / Eigentümer, Gremium-Zugang mit Bearbeitungsrecht auf
// Sitzungen, Sitzungsleitung und Protokollführung
export function verwaltetSitzung(sitzung) {
  const rolle = rolleIm(sitzung.gremiumId)
  if (rolle === 'admin') return true
  if (rolle === 'gremium') return recht('sitzungen', sitzung.gremiumId) === 'bearbeiten'
  return rolle === 'person' && istLeitung(sitzung, personIdIm(sitzung.gremiumId))
}

// Links einer Sitzung sehen und kopieren (Gremium-Zugänge ohne Bearbeitungsrecht erhalten leere Links)
export function linksSichtbar(sitzung) {
  return ['admin', 'gremium'].includes(rolleIm(sitzung.gremiumId)) || verwaltetSitzung(sitzung)
}
