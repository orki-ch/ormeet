import { ANTRAG_STATUS, PENDENZ_STATUS, PUNKT_TYP, TYP_LABELS, formatDatum, formatDauer, stimmenText } from '../utils/labels.js'
import { allePunkte, dauerSumme, istAntragPunkt, kindTyp, personenText } from '../utils/traktanden.js'

const STYLES = {
  titel: { fontSize: 18, bold: true, margin: [0, 0, 0, 2] },
  untertitel: { fontSize: 12, color: '#555555', margin: [0, 0, 0, 12] },
  h2: { fontSize: 13, bold: true, margin: [0, 14, 0, 6] },
  h3: { fontSize: 11, bold: true, margin: [0, 10, 0, 2] },
  h4: { fontSize: 10, bold: true, margin: [10, 6, 0, 2] },
  klein: { fontSize: 9, color: '#555555' },
  notiz: { fontSize: 9, color: '#555555', italics: true, margin: [10, 0, 0, 2] },
  tabellenKopf: { bold: true, fillColor: '#eeeeee' },
}

function terminText(sitzung) {
  return `${formatDatum(sitzung.datum)}, ${sitzung.zeit || ''} · ${sitzung.ort || ''}`
}

function tabelle(kopf, zeilen, breiten) {
  return {
    table: { headerRows: 1, widths: breiten, body: [kopf.map((text) => ({ text, style: 'tabellenKopf' })), ...zeilen] },
    layout: 'lightHorizontalLines',
    margin: [0, 0, 0, 8],
  }
}

function kopfdaten(art, gremium, sitzung) {
  const zeilen = [
    ['Datum', formatDatum(sitzung.datum)],
    ['Zeit', sitzung.zeit || '–'],
    ['Ort', sitzung.ort || '–'],
    ['Sitzungsleitung', personenText(sitzung.sitzungsleitung) || '–'],
    ['Protokollführung', personenText(sitzung.protokollfuehrung) || '–'],
  ]
  if (sitzung.bemerkungen) zeilen.push(['Spezielles', sitzung.bemerkungen])
  if (art === 'Protokoll' && sitzung.genehmigt) zeilen.push(['Genehmigt', `an der Sitzung vom ${formatDatum(sitzung.genehmigt.datum)}`])
  return [
    { text: `${art} – ${gremium.name}`, style: 'titel' },
    { text: sitzung.titel || ' ', style: 'untertitel' },
    { table: { widths: ['auto', '*'], body: zeilen.map(([k, v]) => [{ text: k, bold: true }, v]) }, layout: 'noBorders' },
  ]
}

function anwesenheiten(anwesend, abwesend, gaeste, rolleName) {
  const bloecke = [
    { text: 'Anwesend', style: 'h2' },
    tabelle(
      ['Name', 'Rolle', 'Stimmrecht'],
      anwesend.map((m) => [m.name, rolleName(m.rolleId), m.hatStimmrecht ? 'stimmberechtigt' : 'ohne Stimmrecht']),
      ['*', '*', 'auto'],
    ),
    { text: `Entschuldigt / abwesend: ${abwesend.map((m) => m.name).join(', ') || '–'}` },
  ]
  if (gaeste.length) {
    bloecke.push({ text: `Gäste: ${gaeste.map((g) => (g.organisation ? `${g.name} (${g.organisation})` : g.name)).join(', ')}`, margin: [0, 2, 0, 0] })
  }
  return bloecke
}

function pendenzenTabelle(pendenzen) {
  return tabelle(
    ['Pendenz', 'Wer', 'Bis wann', 'Status', 'Aus Sitzung'],
    pendenzen.map(({ eintrag, sitzung }) => [
      { stack: [eintrag.titel, ...(eintrag.inhalt ? [{ text: eintrag.inhalt, style: 'klein' }] : [])] },
      eintrag.zugewiesenAnName || '–',
      formatDatum(eintrag.faelligBis),
      PENDENZ_STATUS[eintrag.pendenzStatus],
      formatDatum(sitzung.datum),
    ]),
    ['*', 'auto', 'auto', 'auto', 'auto'],
  )
}

function naechsterTerminBlock(termin) {
  if (!termin) return []
  return [{ text: 'Nächster Sitzungstermin', style: 'h2' }, { text: terminText(termin) }]
}

function fusstextBlock(gremium) {
  return gremium.fusstext ? [{ text: gremium.fusstext, style: 'klein', margin: [0, 24, 0, 0] }] : []
}

function traktandumTitel(nummer, traktandum, themenbereichName, dauerIst = null) {
  const teile = [`${nummer} ${traktandum.titel}`]
  const dauer = traktandum.dauer ? [`geplant ${formatDauer(traktandum.dauer)}`, dauerIst && `tatsächlich ${formatDauer(dauerIst)}`].filter(Boolean).join(', ') : ''
  const zusatz = [PUNKT_TYP[traktandum.typ], themenbereichName(traktandum.themenbereichId), personenText(traktandum.verantwortliche), dauer].filter(Boolean).join(' · ')
  if (zusatz) teile.push({ text: `   ${zusatz}`, style: 'klein', bold: false })
  return teile
}

// Unterpunkt-Zeile: Nummer, Titel, optional Typ und Verantwortliche
function unterpunktText(nummer, elternTyp, u) {
  const zusatz = [!elternTyp && PUNKT_TYP[u.typ], personenText(u.verantwortliche)].filter(Boolean).join(' · ')
  return [`${nummer} ${u.titel}`, ...(zusatz ? [{ text: `   ${zusatz}`, style: 'klein', bold: false }] : [])]
}

// Unterpunkte über alle Ebenen: pro Unterpunkt Titelzeile, Notiz und (Protokoll) Einträge, je Ebene weiter eingerückt.
// Im Protokoll entfällt die Notiz eines Antrag-Punkts – sie ist beim Start zum Antrag geworden.
// uebertragen(punkt): Block einer übernommenen Pendenz (Protokoll), sonst null.
function unterpunktBloecke(liste, nummer, elternTyp, tiefe, eintraege = null, uebertragen = () => null) {
  return liste.flatMap((u, j) => {
    const nr = `${nummer}.${j + 1}`
    const einzug = 10 * tiefe
    const typ = elternTyp || u.typ
    const notiz = u.notiz && !(eintraege && istAntragPunkt(u, elternTyp))
    const pendenz = uebertragen(u)
    return [
      eintraege ? { text: unterpunktText(nr, elternTyp, u), style: 'h4', margin: [einzug, 6, 0, 2] } : { text: unterpunktText(nr, elternTyp, u), margin: [einzug, 2, 0, 0] },
      ...(notiz ? [{ text: u.notiz, style: eintraege ? 'notiz' : 'klein', margin: [einzug + (eintraege ? 10 : 0), 0, 0, 2] }] : []),
      ...(pendenz ? [{ ...pendenz, margin: [einzug + 10, 0, 0, 6] }] : []),
      ...(eintraege ? eintraege(u.id).map((b) => ({ ...b, margin: [einzug + 10, 0, 0, 6] })) : []),
      ...unterpunktBloecke(u.untertraktanden || [], nr, kindTyp(typ), tiefe + 1, eintraege, uebertragen),
    ]
  })
}

function eintragBlock(eintrag, label = TYP_LABELS[eintrag.typ]) {
  let status = ''
  if (eintrag.typ === 'antrag') status = [`Beschluss: ${ANTRAG_STATUS[eintrag.antragStatus]}`, stimmenText(eintrag)].filter(Boolean).join(' · ')
  if (eintrag.typ === 'pendenz') {
    status = [PENDENZ_STATUS[eintrag.pendenzStatus], eintrag.zugewiesenAnName, eintrag.faelligBis && `bis ${formatDatum(eintrag.faelligBis)}`]
      .filter(Boolean)
      .join(' · ')
  }
  return {
    margin: [10, 0, 0, 6],
    stack: [
      { text: [{ text: `${label}: `, bold: true }, eintrag.titel] },
      ...(eintrag.inhalt ? [{ text: eintrag.inhalt }] : []),
      ...(status ? [{ text: status, style: 'klein' }] : []),
    ],
  }
}

function dokument(fusszeile, content) {
  return {
    pageMargins: [40, 40, 40, 50],
    defaultStyle: { fontSize: 10 },
    styles: STYLES,
    footer: (seite, total) => ({ text: `${fusszeile} · Seite ${seite}/${total}`, style: 'klein', alignment: 'center' }),
    content,
  }
}

export function vorprotokollDokument({ gremium, sitzung, vorprotokoll, erwartete, uebertragenePendenzen, naechsterTermin, themenbereichName, rolleName }) {
  const anwesend = gremium.mitglieder.filter((m) => vorprotokoll.anwesendeMitgliederIds.includes(m.id))
  const abwesend = erwartete.filter((m) => !vorprotokoll.anwesendeMitgliederIds.includes(m.id))

  const mitDauer = vorprotokoll.traktanden.some((t) => t.dauer)
  const traktandenZeilen = vorprotokoll.traktanden.map((t, i) => [
    `${i + 1}`,
    {
      stack: [
        { text: [{ text: t.titel, bold: true }, ...(t.typ ? [{ text: `   ${PUNKT_TYP[t.typ]}`, style: 'klein' }] : [])] },
        ...(t.notiz ? [{ text: t.notiz, style: 'klein' }] : []),
        ...unterpunktBloecke(t.untertraktanden, `${i + 1}`, kindTyp(t.typ), 1),
      ],
    },
    themenbereichName(t.themenbereichId),
    personenText(t.verantwortliche),
    ...(mitDauer ? [formatDauer(t.dauer) || '–'] : []),
  ])

  return dokument(`Vorprotokoll ${gremium.name}`, [
    ...kopfdaten('Vorprotokoll', gremium, sitzung),
    ...anwesenheiten(anwesend, abwesend, vorprotokoll.gaeste, rolleName),
    { text: 'Traktanden', style: 'h2' },
    tabelle(['Nr', 'Traktandum', 'Themenbereich', 'Person', ...(mitDauer ? ['Dauer'] : [])], traktandenZeilen, ['auto', '*', 'auto', 'auto', ...(mitDauer ? ['auto'] : [])]),
    ...(mitDauer ? [{ text: `Geplante Dauer insgesamt: ${formatDauer(dauerSumme(vorprotokoll.traktanden))}`, style: 'klein', margin: [0, 0, 0, 8] }] : []),
    ...(uebertragenePendenzen.length
      ? [{ text: 'Offene Pendenzen aus früheren Sitzungen', style: 'h2' }, pendenzenTabelle(uebertragenePendenzen)]
      : []),
    ...naechsterTerminBlock(naechsterTermin),
    ...fusstextBlock(gremium),
  ])
}

export function protokollDokument({ gremium, sitzung, vorprotokoll, protokoll, uebertragenePendenzen, naechsterTermin, themenbereichName, rolleName }) {
  const mitglieder = (ids) => gremium.mitglieder.filter((m) => ids.includes(m.id))
  const eintraegeVon = (traktandumId) => protokoll.eintraege.filter((e) => e.traktandumId === traktandumId).map((e) => eintragBlock(e))

  const dauern = protokoll.dauern || {}
  const traktandenBloecke = vorprotokoll.traktanden.flatMap((t, i) => {
    const bloecke = [{ text: traktandumTitel(`${i + 1}.`, t, themenbereichName, dauern[t.id]), style: 'h3' }]
    if (t.notiz && !istAntragPunkt(t)) bloecke.push({ text: t.notiz, style: 'notiz' })
    const uebertragen = (punkt) => {
      const treffer = punkt.pendenzId && uebertragenePendenzen.find((p) => p.eintrag.id === punkt.pendenzId)
      return treffer ? eintragBlock(treffer.eintrag, 'Übertragene Pendenz') : null
    }
    const pendenz = uebertragen(t)
    if (pendenz) bloecke.push(pendenz)
    bloecke.push(...eintraegeVon(t.id))
    bloecke.push(...unterpunktBloecke(t.untertraktanden, `${i + 1}`, kindTyp(t.typ), 1, eintraegeVon, uebertragen))
    return bloecke
  })

  const geplant = dauerSumme(vorprotokoll.traktanden)
  const tatsaechlich = vorprotokoll.traktanden.reduce((summe, t) => summe + (Number(dauern[t.id]) || 0), 0)
  const dauerBlock = geplant ? [{ text: `Dauer insgesamt: geplant ${formatDauer(geplant) || '–'} · tatsächlich ${formatDauer(tatsaechlich) || '–'}`, style: 'klein', margin: [0, 6, 0, 0] }] : []

  const allePendenzen = [
    ...uebertragenePendenzen,
    ...protokoll.eintraege.filter((e) => e.typ === 'pendenz').map((eintrag) => ({ eintrag, sitzung })),
  ]

  return dokument(`Protokoll ${gremium.name}`, [
    ...kopfdaten('Protokoll', gremium, sitzung),
    ...anwesenheiten(mitglieder(protokoll.anwesende), mitglieder(protokoll.abwesende), protokoll.gaeste, rolleName),
    { text: 'Traktanden', style: 'h2' },
    ...traktandenBloecke,
    ...dauerBlock,
    ...(allePendenzen.length ? [{ text: 'Pendenzenliste', style: 'h2' }, pendenzenTabelle(allePendenzen)] : []),
    ...naechsterTerminBlock(naechsterTermin),
    ...fusstextBlock(gremium),
  ])
}
