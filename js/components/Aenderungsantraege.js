import { springeZu } from '../utils/springen.js'
import InfoKnopf from './InfoKnopf.js'

const STATUS = { offen: 'Offen', uebernommen: 'Übernommen', abgelehnt: 'Abgelehnt' }
const STATUS_KLASSE = { offen: 'gelb', uebernommen: 'gruen', abgelehnt: 'rot' }

// Änderungsanträge eines abgeschlossenen Protokolls: die Protokollführung entscheidet (übernommen / abgelehnt, mit
// Antwort), die Sitzungsleitung sieht alle, die antragstellende Person ihre eigenen – offene darf sie ändern oder
// zurückziehen. Bearbeitet direkt das gespeicherte Protokoll im Store (nicht die Arbeitskopie des Editors).
export default {
  name: 'Aenderungsantraege',
  components: { InfoKnopf },
  props: {
    liste: { type: Array, required: true }, // sichtbare Anträge
    alle: { type: Array, required: true }, // protokoll.aenderungsantraege (zum Zurückziehen)
    sichtAlle: { type: Boolean, default: false },
    darfEntscheiden: { type: Boolean, default: false },
    darfStellen: { type: Boolean, default: false },
    personId: { type: String, default: null },
    entscheiderName: { type: String, default: '' },
  },
  template: `
    <section id="aenderungen" class="card stack-sm">
      <div class="card-head">
        <h2 class="card-title">{{ sichtAlle ? 'Änderungsanträge' : 'Meine Änderungsanträge' }}<span v-if="offene" class="aenderung-marke" style="margin-left: 0.5rem">{{ offene }} offen</span></h2>
        <InfoKnopf v-if="darfStellen" rechts text="Klicke im Protokoll auf einen Punkt – ein Traktandum, einen Unterpunkt oder einen Eintrag –, um eine Änderung zu beantragen." />
      </div>
      <p v-if="!liste.length" class="muted small">Noch keine Änderungsanträge.</p>
      <div v-for="a in liste" :key="a.id" class="aenderung">
        <div class="row between">
          <span class="small"><a href="#" @click.prevent="springeZu(a.zielId)">{{ a.zielText }}</a><span class="leise">&nbsp;· {{ a.name }} · {{ zeitText(a.zeit) }}</span></span>
          <span :class="a.status === 'offen' ? 'aenderung-marke' : ['badge', STATUS_KLASSE[a.status]]">{{ STATUS[a.status] }}</span>
        </div>
        <textarea v-if="bearbeitet === a.id" v-model.trim="a.text" v-wachsen class="input mt-1" rows="2"></textarea>
        <p v-else class="pre mt-1">{{ a.text }}</p>
        <p v-if="a.status !== 'offen' && a.antwort" class="small muted pre mt-1"><strong>Antwort{{ a.entschiedenVon ? ' von ' + a.entschiedenVon : '' }}:</strong> {{ a.antwort }}</p>
        <div v-if="a.status === 'offen' && darfEntscheiden" class="row mt-1">
          <input v-model.trim="a.antwort" class="input grow" placeholder="Antwort (optional)" />
          <button type="button" class="btn btn-primary" @click="entscheiden(a, 'uebernommen')">Übernommen</button>
          <button type="button" class="btn btn-danger" @click="entscheiden(a, 'abgelehnt')">Abgelehnt</button>
        </div>
        <div v-else-if="a.status === 'offen' && a.personId === personId" class="row mt-1">
          <button type="button" class="btn btn-ghost" @click="bearbeitet = bearbeitet === a.id ? null : a.id">{{ bearbeitet === a.id ? 'Fertig' : 'Ändern' }}</button>
          <button type="button" class="btn btn-danger" @click="zurueckziehen(a)">Zurückziehen</button>
        </div>
      </div>
    </section>
  `,
  data() {
    return { bearbeitet: null, STATUS, STATUS_KLASSE }
  },
  computed: {
    offene() {
      return this.liste.filter((a) => a.status === 'offen').length
    },
  },
  methods: {
    springeZu,
    zeitText(iso) {
      return new Date(iso).toLocaleString('de-CH', { dateStyle: 'short', timeStyle: 'short' })
    },
    entscheiden(antrag, status) {
      antrag.status = status
      antrag.entschiedenVon = this.entscheiderName
    },
    zurueckziehen(antrag) {
      if (!confirm('Änderungsantrag zurückziehen?')) return
      this.alle.splice(this.alle.indexOf(antrag), 1)
    },
  },
}
