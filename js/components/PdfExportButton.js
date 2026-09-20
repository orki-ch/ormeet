import { gremienStore } from '../stores/gremien.js'
import { sitzungenStore } from '../stores/sitzungen.js'
import { protokollDokument, vorprotokollDokument } from '../pdf/dokumente.js'
import { allePunkte } from '../utils/traktanden.js'

export default {
  name: 'PdfExportButton',
  props: {
    typ: { type: String, required: true }, // 'vorprotokoll' | 'protokoll'
    sitzungId: { type: String, required: true },
  },
  template: `<button @click="exportieren">PDF exportieren</button>`, // Klasse kommt vom Aufrufer (btn oder menu-item)
  methods: {
    exportieren() {
      const sitzung = sitzungenStore.sitzungById(this.sitzungId)
      const gremium = gremienStore.byId(sitzung.gremiumId)
      const vorprotokoll = sitzungenStore.vorprotokollVonSitzung(this.sitzungId)

      const daten = {
        gremium,
        sitzung,
        vorprotokoll,
        erwartete: gremienStore.erwarteteMitglieder(gremium.id),
        protokoll: sitzungenStore.protokollVonSitzung(this.sitzungId),
        uebertragenePendenzen: allePunkte(vorprotokoll.traktanden)
          .filter((t) => t.pendenzId)
          .map((t) => sitzungenStore.eintragById(t.pendenzId))
          .filter(Boolean),
        naechsterTermin: sitzungenStore.sitzungById(sitzung.naechsterTerminId),
        themenbereichName: (id) => gremium.themenbereiche.find((tb) => tb.id === id)?.name || '',
        rolleName: (id) => gremienStore.rolleName(gremium.id, id),
      }

      const dokument = this.typ === 'protokoll' ? protokollDokument(daten) : vorprotokollDokument(daten)
      pdfMake.createPdf(dokument).download(`${this.typ}-${gremium.name}-${sitzung.datum}.pdf`)
    },
  },
}
