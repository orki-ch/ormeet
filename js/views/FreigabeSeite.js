import { sitzungenStore } from '../stores/sitzungen.js'
import { sync } from '../stores/sync.js'
import VorprotokollEditor from './VorprotokollEditor.js'
import TerminfindungSeite from './TerminfindungSeite.js'
import ProtokollEditor from './ProtokollEditor.js'

// Freigabe-Link (allgemein oder Gast): Vorprotokoll, oder mit seite die Terminfindung bzw. das Protokoll derselben
// Sitzung – der Link bleibt dabei in der Adresse
export default {
  name: 'FreigabeSeite',
  components: { ProtokollEditor, TerminfindungSeite, VorprotokollEditor },
  props: {
    freigabeLinkKey: { type: String, required: true },
    seite: { type: String, default: '' },
  },
  template: `
    <TerminfindungSeite v-if="seite === 'terminfindung' && sitzungId" :key="'tf' + sitzungId" :sitzung-id="sitzungId" />
    <ProtokollEditor v-else-if="seite === 'protokoll' && sitzungId" :key="'p' + sitzungId" :sitzung-id="sitzungId" />
    <VorprotokollEditor v-else :freigabe-link-key="freigabeLinkKey" />
  `,
  computed: {
    sitzungId() {
      const key = this.freigabeLinkKey
      const vp = sitzungenStore.vorprotokollByKey(key) || sitzungenStore.vorprotokollByPersonKey(key) || sitzungenStore.vorprotokollById(sync.zugriff?.vorprotokollId)
      return vp?.sitzungId || sync.zugriff?.sitzungId || ''
    },
  },
}
