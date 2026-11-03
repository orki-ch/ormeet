import { api } from '../api.js'
import { zugriffsDaten } from '../stores/sync.js'
import { formatDatum } from '../utils/labels.js'
import Modal from './Modal.js'
import { bestaetigen } from '../utils/dialog.js'
import InfoKnopf from './InfoKnopf.js'

// Datum in Tagen ab heute (Ortszeit) als JJJJ-MM-TT
function inTagen(tage) {
  const d = new Date(Date.now() + tage * 86400000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function gestern() {
  return inTagen(-1)
}

// Ablauf als Text: «läuft nie ab», «gilt bis 31.12.2026», «abgelaufen seit …», «bis das Protokoll genehmigt ist»
export function ablaufText(ablauf, sitzung = null) {
  if (!ablauf) return ''
  if (ablauf === 'genehmigt') return sitzung?.genehmigt ? 'abgelaufen (Protokoll genehmigt)' : 'gilt, bis das Protokoll genehmigt ist'
  return ablauf < inTagen(0) ? 'abgelaufen' : 'gilt bis ' + formatDatum(ablauf)
}

// Passwort und Ablauf eines allgemeinen Links. Das Passwort geht direkt an den Server (nur gehasht gespeichert),
// der Ablauf steht beim Link selbst (ziel[feld]).
export default {
  name: 'LinkSchutzDialog',
  components: { InfoKnopf, Modal },
  props: {
    titel: { type: String, required: true },
    gremiumId: { type: String, required: true },
    schutzRef: { type: String, required: true }, // link:<id> | freigabe:<vorprotokollId> | zugang:<id>
    ziel: { type: Object, required: true },
    feld: { type: String, default: 'ablauf' },
    sitzung: { type: Object, default: null }, // mit Sitzung: Ablauf «bis das Protokoll genehmigt ist» wählbar
  },
  emits: ['schliessen'],
  template: `
    <Modal :titel="titel" @schliessen="$emit('schliessen')">
      <div class="stack">
        <div class="stack-sm">
          <span class="label">Ablauf</span>
          <div class="row">
            <select v-model="modus" class="input w-lg">
              <option value="">Läuft nicht ab</option>
              <option value="datum">Gilt bis zu einem Datum</option>
              <option v-if="sitzung" value="genehmigt">Gilt, bis das Protokoll genehmigt ist</option>
            </select>
            <input v-if="modus === 'datum'" v-model="ziel[feld]" type="date" class="input w-md" />
          </div>
          <div class="row small">
            <span v-if="ziel[feld]" class="muted grow">{{ ablaufText(ziel[feld], sitzung) }}</span>
            <button type="button" class="btn btn-ghost" @click="ziel[feld] = gestern()">Jetzt ablaufen lassen</button>
          </div>
        </div>
        <form class="stack-sm" @submit.prevent="passwortSetzen(passwort)">
          <span class="label">Passwort <InfoKnopf titel="Passwort" :text="geschuetzt ? 'Der Link ist mit einem Passwort geschützt. Wer ihn öffnet, gibt es einmal pro Gerät ein.' : 'Ohne Passwort öffnet jede Person mit dem Link die Sitzung.'" /></span>
          <div class="row">
            <input v-model="passwort" type="password" class="input grow" :placeholder="geschuetzt ? 'Neues Passwort …' : 'Passwort (mindestens 4 Zeichen) …'" minlength="4" required autocomplete="new-password" />
            <button class="btn" :disabled="laeuft">{{ geschuetzt ? 'Ändern' : 'Setzen' }}</button>
          </div>
          <p v-if="fehler" class="small text-err">{{ fehler }}</p>
          <div v-if="geschuetzt"><button type="button" class="btn btn-ghost text-err" :disabled="laeuft" @click="passwortSetzen('')">Passwort entfernen</button></div>
        </form>
      </div>
      <template #fuss>
        <div class="row">
          <button type="button" class="btn btn-primary" @click="$emit('schliessen')">Fertig</button>
        </div>
      </template>
    </Modal>
  `,
  data() {
    return { passwort: '', fehler: '', laeuft: false }
  },
  computed: {
    geschuetzt() {
      return (zugriffsDaten[this.gremiumId]?.geschuetzt || []).includes(this.schutzRef)
    },
    modus: {
      get() {
        const wert = this.ziel[this.feld]
        return !wert ? '' : wert === 'genehmigt' ? 'genehmigt' : 'datum'
      },
      set(modus) {
        this.ziel[this.feld] = modus === 'genehmigt' ? 'genehmigt' : modus === 'datum' ? inTagen(30) : ''
      },
    },
  },
  methods: {
    ablaufText,
    gestern,
    async passwortSetzen(passwort) {
      if (!passwort && !(await bestaetigen('Passwort entfernen? Danach öffnet jede Person mit dem Link die Sitzung.', { gefahr: true }))) return
      this.laeuft = true
      this.fehler = ''
      try {
        await api.anfrage('link_passwort', this.gremiumId, { ref: this.schutzRef, passwort })
        const daten = (zugriffsDaten[this.gremiumId] ??= { nutzung: {}, geschuetzt: [] })
        daten.geschuetzt = passwort ? [...new Set([...daten.geschuetzt, this.schutzRef])] : daten.geschuetzt.filter((r) => r !== this.schutzRef)
        this.passwort = ''
      } catch (fehler) {
        this.fehler = fehler.message
      }
      this.laeuft = false
    },
  },
}
