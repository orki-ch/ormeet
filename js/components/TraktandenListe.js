import ThemenbereichSelect from './ThemenbereichSelect.js'
import PersonenInput from './PersonenInput.js'
import MenuDropdown from './MenuDropdown.js'
import Unterpunkte from './Unterpunkte.js'
import UnterpunktEditor from './UnterpunktEditor.js'
import { bearbeitenMixin } from '../utils/bearbeiten.js'
import { TRAKTANDUM_TYP, TYP_BADGE, TYP_LABELS, formatDauer } from '../utils/labels.js'
import { dauerSumme, istBerechtigt, neuesTraktandum, neuesUntertraktandum, personenText } from '../utils/traktanden.js'

// Traktandenliste mit Unterpunkten (bis drei Ebenen) im Karten-Layout des Protokolls, direkt im übergebenen Array bearbeitet.
// Bearbeitbare Karten / Unterpunkte tragen einen Rahmen in der Ormeet-Farbe; Klick öffnet die Bearbeitung.
// nurPerson (persönlicher Freigabe-Link): bearbeitbar sind Traktanden, bei denen die Person verantwortlich oder
// als Bearbeiter eingetragen ist (direkt, über ihre Rolle oder eine Gruppe); Unterpunkte erben das von oben.
// Typ (Information / Antrag / Pendenz) und geplante Dauer werden hier festgelegt; im Protokoll sind sie fix.
export default {
  name: 'TraktandenListe',
  components: { MenuDropdown, PersonenInput, ThemenbereichSelect, Unterpunkte, UnterpunktEditor },
  mixins: [bearbeitenMixin],
  props: {
    traktanden: { type: Array, required: true },
    themenbereiche: { type: Array, required: true },
    personen: { type: Array, required: true },
    bearbeiterAuswahl: { type: Array, required: true }, // Personen + Rollen + Gruppen
    nurPerson: { type: Object, default: null }, // Mitglied / Gast hinter einem persönlichen Link
    nurLesen: { type: Boolean, default: false },
  },
  template: `
    <div class="stack">
      <template v-for="(t, i) in traktanden" :key="t.id">
        <!-- Bearbeitung des ganzen Traktandums -->
        <section v-if="aktiv === t.id" class="card editing stack">
          <div class="traktandum-kopf">
            <span class="nr">{{ i + 1 }}.</span>
            <input v-model.trim="t.titel" class="input grow" style="font-size: var(--fs-h2); font-weight: 500" placeholder="Traktandum" />
            <ThemenbereichSelect v-model="t.themenbereichId" :themenbereiche="themenbereiche" class="w-md" />
            <MenuDropdown v-if="!nurPerson" icon="⋮">
              <button class="menu-item" :disabled="i === 0" @click="verschieben(traktanden, i, -1)">↑ Nach oben</button>
              <button class="menu-item" :disabled="i === traktanden.length - 1" @click="verschieben(traktanden, i, 1)">↓ Nach unten</button>
              <button class="menu-item menu-item-danger" @click="traktanden.splice(i, 1); nummerieren(); aktiv = null">Traktandum löschen</button>
            </MenuDropdown>
          </div>
          <div class="eingerueckt stack-sm">
            <div class="row">
              <PersonenInput v-model="t.verantwortliche" :personen="personen" class="grow" placeholder="Verantwortlich" :nur-eigene="nurPerson?.id" />
              <select v-model="t.typ" class="input w-sm" title="Typ der Einträge im Protokoll – gilt für alles unter diesem Traktandum">
                <option v-for="(label, wert) in TRAKTANDUM_TYP" :key="wert" :value="wert">{{ label }}</option>
              </select>
              <span class="dauer" title="Geplante Dauer"><input v-model.number="t.dauer" type="number" min="0" step="5" class="input" placeholder="Dauer" @change="dauerBereinigen(t)" /> Min.</span>
            </div>
            <textarea v-model.trim="t.notiz" v-wachsen class="input" rows="1" placeholder="Notiz (optional)"></textarea>
            <details v-if="!nurPerson" class="aufklapp klein" :open="t.bearbeiter.length > 0">
              <summary>Wer darf zusätzlich bearbeiten</summary>
              <PersonenInput v-model="t.bearbeiter" :personen="bearbeiterAuswahl" class="mt-1" placeholder="Personen, Rollen oder Gruppen" nur-liste />
            </details>
            <UnterpunktEditor v-if="t.untertraktanden.length" :liste="t.untertraktanden" :nummer="String(i + 1)" :eltern-typ="t.typ" :personen="personen" :bearbeiter-auswahl="bearbeiterAuswahl" :nur-person="nurPerson" />
            <div class="row">
              <button class="btn btn-ghost" @click="t.untertraktanden.push(neuesUntertraktandum(''))">+ Unterpunkt</button>
              <button class="btn ml-auto" @click="aktiv = null">Fertig</button>
            </div>
          </div>
        </section>

        <!-- Vorschau (Karte wie im Protokoll) -->
        <section v-else :id="t.id" class="card" :class="{ editierbar: hauptEditierbar(t) }" @click="hauptEditierbar(t) && (aktiv = t.id)">
          <div class="traktandum-kopf">
            <span class="nr">{{ i + 1 }}.</span>
            <h2 :class="{ leer: !t.titel }">{{ t.titel || 'Ohne Titel' }}</h2>
            <span v-if="t.istAutomatischUebernommen" class="badge gelb">{{ t.antragId ? 'Vertagter Antrag' : 'Pendenz' }}</span>
            <span v-if="t.typ" class="badge" :class="TYP_BADGE[t.typ]">{{ TYP_LABELS[t.typ] }}</span>
            <span v-if="t.verantwortliche.length" class="muted small">{{ personenText(t.verantwortliche) }}</span>
            <span v-if="themenbereich(t.themenbereichId)" class="badge" :style="themenbereichStil(t.themenbereichId)">{{ themenbereich(t.themenbereichId).name }}</span>
            <span v-if="t.dauer" class="leise small nowrap" title="Geplante Dauer">{{ formatDauer(t.dauer) }}</span>
          </div>
          <p v-if="t.notiz" class="notiz pre eingerueckt">{{ t.notiz }}</p>
          <div v-if="t.untertraktanden.length" class="eingerueckt">
            <Unterpunkte :liste="t.untertraktanden" :nummer="String(i + 1)" :eltern-typ="t.typ" :geerbt="hauptEditierbar(t)" :pruefen="pruefen" :aktiv-id="aktiv" klasse="editierbar" @klick="(u, darf) => subKlick(t, u, darf)">
              <!-- Bearbeitung nur dieses Unterpunkts (Person mit Rechten auf dem Unterpunkt) -->
              <template #editor="{ u, nummer, index }">
                <div class="sub editing stack-sm" style="padding: 0.75rem 0.75rem 0.75rem 1rem" @click.stop>
                  <UnterpunktEditor :liste="[u]" :nummer="nummer" :start="index" :tiefe="nummer.split('.').length + 1" :eltern-typ="elternTypVon(t, u)" :personen="personen" :bearbeiter-auswahl="bearbeiterAuswahl" :nur-person="nurPerson" fest />
                  <div class="row"><button class="btn ml-auto" @click="aktiv = null">Fertig</button></div>
                </div>
              </template>
            </Unterpunkte>
          </div>
        </section>
      </template>

      <p v-if="gesamtDauer" class="muted small">Geplante Dauer insgesamt: {{ formatDauer(gesamtDauer) }}</p>

      <form v-if="!nurLesen" class="row" @submit.prevent="hinzufuegen">
        <input v-model.trim="neu" class="input grow" placeholder="Neues Traktandum …" required />
        <button class="btn">Hinzufügen</button>
      </form>
    </div>
  `,
  data() {
    return { neu: '', TRAKTANDUM_TYP, TYP_BADGE, TYP_LABELS }
  },
  computed: {
    gesamtDauer() {
      return dauerSumme(this.traktanden)
    },
  },
  methods: {
    neuesUntertraktandum,
    personenText,
    formatDauer,
    hauptEditierbar(t) {
      if (this.nurLesen) return false
      return !this.nurPerson || istBerechtigt(t, this.nurPerson)
    },
    // Unterpunkt allein bearbeitbar (Person mit Rechten darauf), wenn das Element darüber gesperrt ist
    pruefen(u) {
      return !this.nurLesen && !!this.nurPerson && istBerechtigt(u, this.nurPerson)
    },
    subKlick(t, u, darf) {
      if (this.hauptEditierbar(t)) this.aktiv = t.id
      else if (darf) this.aktiv = u.id
    },
    // Vorgegebener Typ für einen einzeln bearbeiteten Unterpunkt: Traktandum oder ein Unterpunkt darüber
    elternTypVon(t, u) {
      if (t.typ) return t.typ
      const pfad = (liste) => {
        for (const k of liste) {
          if (k === u) return []
          const rest = pfad(k.untertraktanden)
          if (rest) return [k, ...rest]
        }
        return null
      }
      return (pfad(t.untertraktanden) || []).find((k) => k.typ)?.typ || ''
    },
    themenbereich(id) {
      return this.themenbereiche.find((tb) => tb.id === id)
    },
    themenbereichStil(id) {
      const tb = this.themenbereich(id)
      return { backgroundColor: tb.farbe + '1f', color: tb.farbe }
    },
    // Leeres oder ungültiges Feld -> keine Dauer
    dauerBereinigen(t) {
      t.dauer = Number.isFinite(t.dauer) && t.dauer > 0 ? Math.round(t.dauer) : null
    },
    hinzufuegen() {
      const person = this.nurPerson
      const traktandum = neuesTraktandum({
        titel: this.neu,
        reihenfolge: this.traktanden.length + 1,
        verantwortliche: person ? [{ id: person.id, name: person.name }] : [],
      })
      this.traktanden.push(traktandum)
      this.neu = ''
      this.aktiv = traktandum.id
    },
    verschieben(liste, i, richtung) {
      const j = i + richtung
      ;[liste[i], liste[j]] = [liste[j], liste[i]]
      this.nummerieren()
    },
    nummerieren() {
      this.traktanden.forEach((t, i) => (t.reihenfolge = i + 1))
    },
  },
}
