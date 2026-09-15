import { ANTRAG_STATUS, PENDENZ_STATUS, TYP_LABELS, formatDatum, formatDauer, stimmenText } from '../utils/labels.js'
import { dauerSumme, personenText } from '../utils/traktanden.js'

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
  const zusatz = [TYP_LABELS[traktandum.typ], themenbereichName(traktandum.themenbereichId), personenText(traktandum.verantwortliche), dauer].filter(Boolean).join(' · ')
  if (zusatz) teile.push({ text: `   ${zusatz}`, style: 'klein', bold: false })
  return teile
}

// Unterpunkt-Zeile: Nummer, Titel, optional Typ und Verantwortliche
function unterpunktText(nummer, t, u) {
  const zusatz = [!t.typ && TYP_LABELS[u.typ], personenText(u.verantwortliche)].filter(Boolean).join(' · ')
  return [`${nummer} ${u.titel}`, ...(zusatz ? [{ text: `   ${zusatz}`, style: 'klein', bold: false }] : [])]
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
        { text: [{ text: t.titel, bold: true }, ...(t.typ ? [{ text: `   ${TYP_LABELS[t.typ]}`, style: 'klein' }] : [])] },
        ...(t.notiz ? [{ text: t.notiz, style: 'klein' }] : []),
        ...t.untertraktanden.flatMap((u, j) => [
          { text: unterpunktText(`${i + 1}.${j + 1}`, t, u), margin: [10, 2, 0, 0] },
          ...(u.notiz ? [{ text: u.notiz, style: 'klein', margin: [10, 0, 0, 0] }] : []),
        ]),
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
    if (t.notiz) bloecke.push({ text: t.notiz, style: 'notiz' })
    const uebertragen = uebertragenePendenzen.find((p) => p.eintrag.id === t.pendenzId)
    if (uebertragen) bloecke.push(eintragBlock(uebertragen.eintrag, 'Übertragene Pendenz'))
    bloecke.push(...eintraegeVon(t.id))
    t.untertraktanden.forEach((u, j) => {
      bloecke.push({ text: unterpunktText(`${i + 1}.${j + 1}`, t, u), style: 'h4' })
      if (u.notiz) bloecke.push({ text: u.notiz, style: 'notiz', margin: [20, 0, 0, 2] })
      bloecke.push(...eintraegeVon(u.id).map((b) => ({ ...b, margin: [20, 0, 0, 6] })))
    })
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
