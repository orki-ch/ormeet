// Gleichzeitiges Bearbeiten: Drei-Wege-Zusammenführung wie auf dem Server (api.php, zusammenfuehren).
// basis: Stand, auf dem meine Änderung beruht; meins: mein Stand; ihres: der inzwischen neuere Stand.
// Übernommen wird nur, was sich gegenüber der Basis geändert hat – pro Feld, pro Listeneintrag (mit id) und bei
// einfachen Listen pro Wert. Haben beide dasselbe verschieden geändert, gilt meins; der Pfad landet in konflikte.
export const FEHLT = Symbol('fehlt')

export function gleich(a, b) {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null || Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a)
  if (ka.length !== Object.keys(b).length) return false
  return ka.every((k) => Object.hasOwn(b, k) && gleich(a[k], b[k]))
}

const istObjekt = (w) => typeof w === 'object' && w !== null && !Array.isArray(w) && Object.keys(w).length > 0
const istIdListe = (w) => Array.isArray(w) && w.length > 0 && typeof w[0] === 'object' && w[0] !== null && 'id' in w[0]
const leerOderFehlt = (w) => w === FEHLT || w === null || w === undefined
const nachId = (liste) => new Map((Array.isArray(liste) ? liste : []).map((e) => [e.id, e]))

export function zusammenfuehren(basis, meins, ihres, pfad = [], konflikte = []) {
  if (gleich(meins, ihres)) return meins
  if (gleich(meins, basis)) return ihres
  if (gleich(ihres, basis)) return meins
  if (meins === FEHLT || ihres === FEHLT) {
    konflikte.push(pfad)
    return meins
  }
  const alle = [basis, meins, ihres]
  const leeresObjekt = (w) => leerOderFehlt(w) || istObjekt(w) || (typeof w === 'object' && Object.keys(w).length === 0)
  if (alle.some(istObjekt) && alle.every(leeresObjekt)) {
    const b = istObjekt(basis) ? basis : {}
    const m = istObjekt(meins) ? meins : {}
    const t = istObjekt(ihres) ? ihres : {}
    const ergebnis = {}
    for (const feld of new Set([...Object.keys(m), ...Object.keys(t), ...Object.keys(b)])) {
      const wert = zusammenfuehren(feld in b ? b[feld] : FEHLT, feld in m ? m[feld] : FEHLT, feld in t ? t[feld] : FEHLT, [...pfad, feld], konflikte)
      if (wert !== FEHLT) ergebnis[feld] = wert
    }
    return ergebnis
  }
  if (alle.some(istIdListe) && alle.every((w) => leerOderFehlt(w) || (Array.isArray(w) && (w.length === 0 || istIdListe(w))))) {
    const b = nachId(basis)
    const m = nachId(meins)
    const t = nachId(ihres)
    // Reihenfolge: hat nur die andere Seite umsortiert, gilt ihre, sonst meine; Neues der anderen Seite nach seinem Vorgänger
    const gemeinsam = (ids) => ids.filter((id) => m.has(id) && b.has(id))
    const nurIhreSortiert = gleich(gemeinsam([...m.keys()]), gemeinsam([...b.keys()]))
    const reihe = nurIhreSortiert ? [...t.keys()] : [...m.keys()]
    let vorher = null
    for (const id of nurIhreSortiert ? m.keys() : t.keys()) {
      if (!reihe.includes(id)) {
        const stelle = vorher === null ? -1 : reihe.indexOf(vorher)
        reihe.splice(vorher === null ? 0 : stelle < 0 ? reihe.length : stelle + 1, 0, id)
      }
      vorher = id
    }
    const ergebnis = []
    for (const id of reihe) {
      const eintrag = m.get(id) || t.get(id)
      const name = '«' + (eintrag.titel || eintrag.name || eintrag.text || 'Eintrag') + '»'
      const wert = zusammenfuehren(b.has(id) ? b.get(id) : FEHLT, m.has(id) ? m.get(id) : FEHLT, t.has(id) ? t.get(id) : FEHLT, [...pfad, name], konflikte)
      if (wert !== FEHLT) ergebnis.push(wert)
    }
    return ergebnis
  }
  if (alle.every((w) => leerOderFehlt(w) || Array.isArray(w))) {
    // Liste einfacher Werte (Anwesende, IDs): Hinzufügen und Entfernen beider Seiten
    const b = Array.isArray(basis) ? basis : []
    const m = Array.isArray(meins) ? meins : []
    const t = Array.isArray(ihres) ? ihres : []
    const enthalten = (liste, w) => liste.some((x) => gleich(x, w))
    const ergebnis = t.filter((w) => enthalten(m, w) || !enthalten(b, w))
    for (const w of m) if (!enthalten(b, w) && !enthalten(ergebnis, w)) ergebnis.push(w)
    return ergebnis
  }
  konflikte.push(pfad) // beide haben denselben Wert verschieden geändert: meine (neuere) Änderung gilt
  return meins
}
