import { sync, recht } from '../stores/sync.js'
import { gremienStore } from '../stores/gremien.js'
import { sitzungenStore } from '../stores/sitzungen.js'
import { istBerechtigt } from './traktanden.js'

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
  const gremien = zugriff.rolle === 'benutzer' ? zugriff.gremien : zugriff.rolle === 'admin' ? zugriff.konto?.gremien : null // Superadmin: sein verknüpftes Konto
  if (!gremien) return zugriff.personId || null
  return gremien.find((g) => g.gremiumId === gremiumId)?.personId || null
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
  if (rolle === 'person') return { pfad: `/gremium/${gremiumId}`, text: 'Meine Übersicht' }
  if (rolle === 'admin' || rolle === 'gremium') return { pfad: `/gremium/${gremiumId}`, text: gremienStore.byId(gremiumId)?.name || 'Gremium' }
  return { pfad: '', text: '' }
}

// Aufgabe Sitzungsleitung oder Protokollführung: in der Sitzung eingetragen (auch als Vertretung) oder im Gremium zentral
// hinterlegt -> voller Zugriff auf Vor- und Protokoll, Start, Abschluss und Entscheide bis zur Genehmigung
export function istLeitung(sitzung, personId) {
  if (!personId) return false
  if ([...sitzung.sitzungsleitung, ...sitzung.protokollfuehrung].some((p) => p.id === personId)) return true
  const aufgaben = gremienStore.byId(sitzung.gremiumId)?.aufgaben
  return !!aufgaben && [...(aufgaben.sitzungsleitung || []), ...(aufgaben.protokollfuehrung || [])].includes(personId)
}

// Sitzungsrecht der eigenen Rolle (eintragen / starten / antraege / einladungen / zugriffe)
function eigenesSitzungsrecht(gremiumId, recht) {
  const personId = personIdIm(gremiumId)
  return !!personId && !!gremienStore.rechteVon(gremiumId, personId)[recht]
}

// Verwaltende (Superadmin / Eigentümer, Gremium-Zugang mit Bearbeitungsrecht auf Sitzungen)
function verwaltend(gremiumId) {
  const rolle = rolleIm(gremiumId)
  return rolle === 'admin' || (rolle === 'gremium' && recht('sitzungen', gremiumId) === 'bearbeiten')
}

// Sitzung starten und abschliessen: Aufgabe in der Sitzung, Recht «Starten und abschliessen» oder Protokoll «Alles»
export function darfStarten(sitzung) {
  if (istGenehmigt(sitzung)) return false
  return verwaltend(sitzung.gremiumId) || istLeitung(sitzung, personIdIm(sitzung.gremiumId)) || eigenesSitzungsrecht(sitzung.gremiumId, 'starten') || vollzugriff(sitzung, 'protokoll')
}

// Einladungen per E-Mail senden
export function darfEinladen(sitzung) {
  if (sync.zugriff?.ansicht) return false
  return verwaltend(sitzung.gremiumId) || istLeitung(sitzung, personIdIm(sitzung.gremiumId)) || eigenesSitzungsrecht(sitzung.gremiumId, 'einladungen')
}

// Aufgaben einer Sitzung bestimmen (auch Vertretung): wer die Sitzung eingetragen hat und wer Zugriffe verwaltet
export function darfAufgabenBestimmen(sitzung) {
  if (istGenehmigt(sitzung)) return false
  return verwaltend(sitzung.gremiumId) || istErsteller(sitzung, personIdIm(sitzung.gremiumId)) || eigenesSitzungsrecht(sitzung.gremiumId, 'zugriffe')
}

// Freigabestufen pro Person und Dokument (Vorprotokoll / Protokoll):
// lesen = nur ansehen · eigene = zugewiesene Traktanden bearbeiten · alles = ganzes Dokument bearbeiten
export const FREIGABE_STUFEN = { lesen: 'Lesen', eigene: 'Eigene', alles: 'Alles' }

// Einzelrechte («Individuell») pro Dokument – für Personen in der Teilen-Karte und zusätzliche allgemeine Links
export const EINZELRECHTE = {
  terminfindung: { abstimmen: 'Abstimmen', kommentieren: 'Kommentieren' },
  vorprotokoll: { traktandenBearbeiten: 'Traktanden bearbeiten', traktandenAendern: 'Traktanden ändern und verschieben', traktandenHinzufuegen: 'Traktanden hinzufügen', anwesenheit: 'Anwesenheit', gaeste: 'Gäste' },
  protokoll: { information: 'Informationen', pendenz: 'Pendenzen', antrag: 'Antragsbeschlüsse' },
}

// Standard ohne gesetzte Freigabe: Leitung alles, alle anderen ihre eigenen Traktanden
// Standard ohne gesetzte Freigabe: Leitung der Sitzung alles, sonst die Standardstufe der Rolle (Gäste: eigene)
export function standardStufe(sitzung, personId, dokument = 'vorprotokoll') {
  if (istLeitung(sitzung, personId)) return 'alles'
  const stufe = gremienStore.rechteVon(sitzung.gremiumId, personId)[sitzung.kurz ? 'protokoll' : dokument]
  return Array.isArray(stufe) ? 'individuell' : stufe || 'eigene'
}

// Über einen allgemeinen Link eingetragene Person (Gast mit ueberLink): ihr Link – ein zusätzlicher Link der Sitzung
// oder der allgemeine Freigabe-Link (Vorprotokoll «Alles», Terminfindung). Gelöschter Link: nur noch lesen.
function herkunftsLink(sitzung, personId) {
  const gast = sitzungenStore.vorprotokollVonSitzung(sitzung.id)?.gaeste.find((g) => g.id === personId)
  if (!gast?.ueberLink) return null
  if (gast.ueberLink === 'freigabe') return { ...freigabeLinkObjekt(sitzungenStore.vorprotokollVonSitzung(sitzung.id)), terminfindung: true }
  return (sitzung.links || []).find((l) => l.id === gast.ueberLink) || { dokument: '', stufe: 'lesen', rechte: [] }
}

// Rechte daraus: auf dem Dokument des Links dessen Rechte («Alles» = alle Einzelrechte), sonst nur lesen
function linkGastFreigabe(info, dokument) {
  if (dokument === info.dokument) return info.stufe === 'lesen' ? 'lesen' : linkStufenRechte(info.stufe, info.rechte, dokument)
  if (dokument === 'terminfindung' && info.terminfindung) return Object.keys(EINZELRECHTE.terminfindung)
  return 'lesen'
}

// Gesetzte Freigabe (Stufe oder Liste von Einzelrechten); ohne: die Rechte des Links, über den die Person kam
export function freigabeRoh(sitzung, dokument, personId) {
  if (personId && sitzung.nurLesen?.includes(personId)) return 'lesen' // für diese Sitzung auf «nur lesen» gesperrt
  const stufe = sitzung.freigaben?.[dokument]?.[personId]
  if (stufe !== undefined) return stufe
  const info = herkunftsLink(sitzung, personId)
  if (info) return linkGastFreigabe(info, dokument)
  // Standardstufe der Rolle (nicht für die Leitung der Sitzung)
  if (['vorprotokoll', 'protokoll'].includes(dokument) && !istLeitung(sitzung, personId)) {
    const standard = gremienStore.rechteVon(sitzung.gremiumId, personId)[dokument]
    if (standard !== 'eigene') return standard
  }
  return undefined
}

// Wirksame Stufe: in der Sitzung gesetzte Freigabe überschreibt den Standard
export function freigabeStufe(sitzung, dokument, personId) {
  if (sitzung.kurz) dokument = 'protokoll' // Kurzsitzung: nur ein Dokument, Traktanden liegen im versteckten Vorprotokoll
  const stufe = freigabeRoh(sitzung, dokument, personId)
  if (Array.isArray(stufe)) return 'individuell' // Liste von Einzelrechten
  return FREIGABE_STUFEN[stufe] ? stufe : standardStufe(sitzung, personId, dokument)
}

// Terminfindung: abstimmen / kommentieren – über einen Link eingetragene Personen nur, wenn ihr Link es erlaubt
export function tfRecht(sitzung, name) {
  const personId = personIdIm(sitzung.gremiumId)
  const rechte = personId ? freigabeRoh(sitzung, 'terminfindung', personId) : undefined
  return rechte === undefined || (Array.isArray(rechte) && rechte.includes(name))
}

// Kennung für selbst hinzugefügte Traktanden (Einzelrecht «Traktanden hinzufügen»): Person oder Link
// Allgemeiner Link ohne Person: zusätzlicher Link oder der allgemeine Freigabe-Link (linkId «freigabe»)
function istLinkZugriff(zugriff = sync.zugriff) {
  return zugriff?.rolle === 'link' || (zugriff?.rolle === 'freigabe' && !zugriff.personId && !!zugriff.linkId)
}

// Einzelrechte einer Link-Stufe: alles = alle, eigene = Traktanden ändern und verschieben (Vorprotokoll), individuell = gewählte
export function linkStufenRechte(stufe, rechte, dokument) {
  if (stufe === 'alles') return Object.keys(EINZELRECHTE[dokument])
  if (stufe === 'eigene') return dokument === 'vorprotokoll' ? ['traktandenAendern'] : []
  if (stufe === 'individuell') return (rechte || []).filter((r) => EINZELRECHTE[dokument][r])
  return []
}

export function eigeneKennung(gremiumId) {
  return istLinkZugriff() ? 'link:' + sync.zugriff.linkId : personIdIm(gremiumId)
}

// Gilt für den eigenen Zugang auf diesem Dokument «Individuell» (Einzelrechte)?
export function istIndividuell(sitzung, dokument) {
  const zugriff = sync.zugriff
  // Zusätzlicher allgemeiner Link: auch «Alles» läuft über die Einzelrechte (alle) – Sitzung starten, abschliessen oder
  // Kopfdaten ändern kann ein Link nie
  if (istLinkZugriff(zugriff)) return zugriff.sitzungId === sitzung.id && zugriff.dokument === dokument && zugriff.stufe !== 'lesen'
  const personId = personIdIm(sitzung.gremiumId)
  return !!personId && dokument !== 'terminfindung' && freigabeStufe(sitzung, dokument, personId) === 'individuell'
}

// Einzelrecht auf ein Dokument: zusätzlicher allgemeiner Link («Alles» oder gewählte Einzelrechte) oder Person mit «Individuell»
export function einzelrecht(sitzung, dokument, name) {
  if (istGenehmigt(sitzung)) return false
  const zugriff = sync.zugriff
  if (istLinkZugriff(zugriff)) {
    if (zugriff.sitzungId !== sitzung.id || zugriff.dokument !== dokument) return false
    return linkStufenRechte(zugriff.stufe, zugriff.rechte, dokument).includes(name)
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
  if (istGenehmigt(sitzung) || istLinkZugriff() || istIndividuell(sitzung, dokument)) return false
  const personId = personIdIm(sitzung.gremiumId)
  return !personId || freigabeStufe(sitzung, dokument, personId) !== 'lesen'
}

// Änderungsanträge nach Abschluss einer Sitzung (bis zur Genehmigung, nie bei Kurzsitzungen). Stellen darf ein Mitglied
// mit verknüpftem Konto, das an der Sitzung erwartet oder anwesend war, sowie ein anwesender Gast (Gast-Link oder Konto) –
// sofern es das Protokoll nicht selbst ganz bearbeitet.
export function aenderungenOffen(sitzung) {
  return !sitzung.kurz && sitzung.status === 'abgeschlossen' && !istGenehmigt(sitzung)
}

export function darfAenderungStellen(sitzung, protokoll) {
  const personId = personIdIm(sitzung.gremiumId)
  if (aenderungenOffen(sitzung) && personId && protokoll.gaeste?.some((g) => g.id === personId) && !vollzugriff(sitzung, 'protokoll')) return true
  const person = gremienStore.byId(sitzung.gremiumId)?.mitglieder.find((m) => m.id === personId)
  if (!aenderungenOffen(sitzung) || !person?.benutzerId || vollzugriff(sitzung, 'protokoll')) return false
  return gremienStore.erwarteteMitglieder(sitzung.gremiumId).some((m) => m.id === person.id) || protokoll.anwesende.includes(person.id)
}

// Entscheiden (übernommen / abgelehnt): Aufgaben der Sitzung, Recht «Änderungsanträge entscheiden» und Verwaltende
export function darfAenderungEntscheiden(sitzung) {
  if (!aenderungenOffen(sitzung)) return false
  return verwaltend(sitzung.gremiumId) || istLeitung(sitzung, personIdIm(sitzung.gremiumId)) || eigenesSitzungsrecht(sitzung.gremiumId, 'antraege')
}

// Darf das ganze Dokument (Vorprotokoll / Protokoll / Terminfindung) einer Sitzung bearbeitet werden?
export function vollzugriff(sitzung, dokument = 'protokoll') {
  const rolle = rolleIm(sitzung.gremiumId)
  if (!rolle || istGenehmigt(sitzung)) return false
  if (rolle === 'admin') return true
  if (rolle === 'gremium') return recht('sitzungen', sitzung.gremiumId) === 'bearbeiten'
  const personId = personIdIm(sitzung.gremiumId)
  if (personId) return freigabeStufe(sitzung, dokument, personId) === 'alles'
  if (rolle === 'freigabe') return dokument === 'vorprotokoll' && sync.zugriff.stufe === 'alles' // allgemeiner Freigabe-Link mit «Alles»
  return false
}

// Eigenes Mitglied (persönlicher Link oder Konto)
function eigenesMitglied(gremiumId) {
  if (!['person', 'benutzer'].includes(sync.zugriff?.rolle)) return null
  return gremienStore.byId(gremiumId)?.mitglieder.find((m) => m.id === personIdIm(gremiumId)) || null
}

// Neue Sitzungen eintragen: wer Sitzungen verwaltet, Rollen mit diesem Recht und Mitglieder mit zugeteiltem Recht
export function darfSitzungenEintragen(gremiumId) {
  if (recht('sitzungen', gremiumId) === 'bearbeiten') return true
  const mitglied = eigenesMitglied(gremiumId)
  return !!mitglied && gremienStore.hatFesteRolle(gremiumId, mitglied) // nur über die Rolle (Recht «Sitzungen eintragen»)
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
  const personId = personIdIm(sitzung.gremiumId)
  return rolle === 'person' && (istLeitung(sitzung, personId) || gremienStore.rechteVon(sitzung.gremiumId, personId).zugriffe)
}

// Links einer Sitzung sehen und kopieren (Gremium-Zugänge ohne Bearbeitungsrecht erhalten leere Links)
export function linksSichtbar(sitzung) {
  return ['admin', 'gremium'].includes(rolleIm(sitzung.gremiumId)) || verwaltetSitzung(sitzung)
}

// Individuelle Rechte mit Regeln (Zuschnitt, siehe api.php zuschnittSicht): { regeln: [{ modus, art, id }], eigene }.
// Personen: sitzung.zuschnitt[personId], sonst der Zuschnitt des Links, über den sie kamen; Links: link.zuschnitt.
export function zuschnittVon(sitzung, personId = null, link = null) {
  let z = link ? link.zuschnitt : sitzung.zuschnitt?.[personId]
  if (!z && !link && personId) {
    const vp = sitzungenStore.vorprotokollVonSitzung(sitzung.id)
    const gast = vp?.gaeste.find((g) => g.id === personId)
    const herkunft = gast?.ueberLink === 'freigabe' ? freigabeLinkObjekt(vp) : (sitzung.links || []).find((l) => l.id === gast?.ueberLink)
    if (herkunft?.stufe === 'individuell') z = herkunft.zuschnitt
  }
  return z?.regeln?.length ? z : null
}

// Zuschnitt des eigenen Zugangs auf dieser Sitzung (nur mit «Individuell»)
export function eigenerZuschnitt(sitzung) {
  const zugriff = sync.zugriff
  if (istLinkZugriff(zugriff)) {
    if (zugriff.sitzungId !== sitzung.id || zugriff.stufe !== 'individuell') return null
    return zuschnittVon(sitzung, null, linkVonZugriff(sitzung))
  }
  const personId = personIdIm(sitzung.gremiumId)
  if (!personId || !['vorprotokoll', 'protokoll'].some((d) => freigabeStufe(sitzung, d, personId) === 'individuell')) return null
  return zuschnittVon(sitzung, personId)
}

// Was der eigene Zuschnitt bearbeiten lässt (die Daten kommen schon gekürzt vom Server): Punkte (alle Ebenen) und Einträge
export function zuschnittSicht(sitzung) {
  const z = eigenerZuschnitt(sitzung)
  if (!z) return null
  const vp = sitzungenStore.vorprotokollVonSitzung(sitzung.id)
  const protokoll = sitzungenStore.protokollVonSitzung(sitzung.id)
  const gremiumId = sitzung.gremiumId
  const selbst = z.eigene ? aktuellePerson(gremiumId, vp?.gaeste || []) : null
  const person = (id) => gremienStore.person(gremiumId, vp?.gaeste || [], id)
  const passt = (r, k, tb) => (r.art === 'themenbereich' ? !!tb && tb === r.id : r.art === 'traktandum' ? k.id === r.id : !!person(r.id) && istBerechtigt(k, person(r.id)))
  const hat = (modus, k, tb) => z.regeln.some((r) => (modus === 'lesen' || r.modus === 'bearbeiten') && passt(r, k, tb))
  const bearbeiten = new Set()
  const gehe = (liste, tbOben, erbt) => {
    for (const k of liste || []) {
      const tb = k.themenbereichId || tbOben || '' // eigener Themenbereich, sonst wie darüber
      const b = erbt || hat('bearbeiten', k, tb) || (!!selbst && istBerechtigt(k, selbst))
      if (b) bearbeiten.add(k.id)
      gehe(k.untertraktanden, tb, b)
    }
  }
  gehe(vp?.traktanden, null, false)
  gehe(protokoll?.zusatztraktanden, null, false)
  const typRechte = (link) => link ? link.rechte || [] : sitzung.freigaben?.protokoll?.[personIdIm(gremiumId)] || []
  const rechte = istLinkZugriff() ? typRechte(linkVonZugriff(sitzung)) : typRechte(null)
  const darfRegel = (art, wert) => z.regeln.some((r) => r.modus === 'bearbeiten' && r.art === art && r.id === wert)
  // Einträge: im bearbeitbaren Punkt, mit bearbeitbarem Themenbereich, Pendenz einer bearbeitbaren Person oder freigegebener Typ
  const eintrag = (e) => bearbeiten.has(e.traktandumId) || darfRegel('themenbereich', e.themenbereichId) || (e.typ === 'pendenz' && (darfRegel('person', e.zugewiesenAn) || (!!selbst && e.zugewiesenAn === selbst.id))) || (Array.isArray(rechte) && rechte.includes(e.typ))
  // Bearbeiten-Regeln auf Themenbereich oder Person können Einträge auch in sonst gesperrten Punkten öffnen
  const eintragsRegeln = z.regeln.some((r) => r.modus === 'bearbeiten' && r.art !== 'traktandum')
  return { bearbeiten, punkt: (k) => bearbeiten.has(k.id), eintrag, eintragsRegeln }
}

// Link hinter dem eigenen Link-Zugriff (zusätzlicher Link oder Freigabe-Link)
function linkVonZugriff(sitzung) {
  if (sync.zugriff?.linkId === 'freigabe') return freigabeLinkObjekt(sitzungenStore.vorprotokollVonSitzung(sitzung.id))
  return (sitzung.links || []).find((l) => l.id === sync.zugriff?.linkId)
}

// Allgemeiner Freigabe-Link des Vorprotokolls als Link-Objekt (Stufe wie bei weiteren Links; Standard «eigene»).
// Getter / Setter schreiben direkt ins Vorprotokoll – so lässt er sich wie ein Link bearbeiten (RechteFenster, Zugriffe).
export function freigabeLinkObjekt(vp) {
  return {
    id: 'freigabe',
    name: 'Allgemeiner Link',
    dokument: 'vorprotokoll',
    get stufe() { return vp?.freigabeLinkStufe || 'eigene' },
    set stufe(wert) { vp.freigabeLinkStufe = wert },
    get rechte() { return vp?.freigabeLinkRechte || [] },
    set rechte(wert) { vp.freigabeLinkRechte = wert },
    get zuschnitt() { return vp?.freigabeLinkZuschnitt || null },
    set zuschnitt(wert) { vp.freigabeLinkZuschnitt = wert },
  }
}
