import ThemenbereichSelect from './ThemenbereichSelect.js'
import PersonenInput from './PersonenInput.js'
import MenuDropdown from './MenuDropdown.js'
import Unterpunkte from './Unterpunkte.js'
import { bearbeitenMixin } from '../utils/bearbeiten.js'
import { TRAKTANDUM_TYP, TYP_BADGE, TYP_LABELS, formatDauer } from '../utils/labels.js'
import { dauerSumme, istAntragPunkt, istBerechtigt, neuesTraktandum, neuesUntertraktandum, personenText } from '../utils/traktanden.js'

// Traktandenliste mit Unterpunkten (bis drei Ebenen) im Karten-Layout des Protokolls, direkt im übergebenen Array bearbeitet.
// Bearbeitbare Karten / Unterpunkte tragen einen Rahmen in der Ormeet-Farbe; Klick öffnet die Bearbeitung im selben Layout:
// Titel und Notiz werden direkt im Element getippt, die Bedienelemente erscheinen nur am aktiven Element.
// nurPerson (persönlicher Freigabe-Link): bearbeitbar sind Traktanden, bei denen die Person verantwortlich oder
// als Bearbeiter eingetragen ist (direkt, über ihre Rolle oder eine Gruppe); Unterpunkte erben das von oben.
// Typ (Information / Antrag / Pendenz) und geplante Dauer werden hier festgelegt; im Protokoll sind sie fix.
// Ein Punkt vom Typ Antrag (ohne Unterpunkte) ist selbst der Antrag: Titel und Notiz werden im Protokoll zum offenen Antrag.
export default {
  name: 'TraktandenListe',
  components: { MenuDropdown, PersonenInput, ThemenbereichSelect, Unterpunkte },
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
      <!-- Klick öffnet die Bearbeitung (Capture-Phase, damit «Fertig» im Innern die Karte nicht gleich wieder öffnet) -->
      <section v-for="(t, i) in traktanden" :id="t.id" :key="t.id" class="card" :class="{ editierbar: hauptEditierbar(t) && aktiv !== t.id, editing: aktiv === t.id }" @click.capture="hauptEditierbar(t) && aktiv !== t.id && (aktiv = t.id)">
        <div class="traktandum-kopf">
          <span class="nr">{{ i + 1 }}.</span>
          <!-- Bearbeitung: Titel direkt im Element, Bedienelemente daneben -->
          <template v-if="aktiv === t.id">
            <input v-model.trim="t.titel" class="nahtlos h2 grow" placeholder="Traktandum" />
            <span class="werkzeuge">
              <!-- Schlanke Pillen: Themenbereich (direkt als Auswahl), Personen (Verantwortlich, Rechte), Einstellungen (Typ, Dauer) -->
              <ThemenbereichSelect v-model="t.themenbereichId" :themenbereiche="themenbereiche" class="btn-pille" />
              <MenuDropdown :text="'Personen: ' + (personenText(t.verantwortliche) || '–')" panel>
                <label class="stack-xs"><span class="label">Verantwortlich</span><PersonenInput v-model="t.verantwortliche" :personen="personen" placeholder="Name eingeben oder wählen" :nur-eigene="nurPerson?.id" /></label>
                <label v-if="!nurPerson" class="stack-xs"><span class="label">Dürfen zusätzlich bearbeiten</span><PersonenInput v-model="t.bearbeiter" :personen="bearbeiterAuswahl" placeholder="Personen, Rollen oder Gruppen" nur-liste /></label>
              </MenuDropdown>
              <MenuDropdown :text="'Einstellungen: ' + ([TYP_LABELS[t.typ], formatDauer(t.dauer)].filter(Boolean).join(' · ') || '–')" panel>
                <label class="stack-xs"><span class="label">Typ der Einträge</span>
                  <select v-model="t.typ" class="input" title="Gilt im Protokoll für alles unter diesem Traktandum – bei «Antrag» werden Titel und Notiz dort zum offenen Antrag">
                    <option v-for="(label, wert) in TRAKTANDUM_TYP" :key="wert" :value="wert">{{ label }}</option>
                  </select>
                </label>
                <label class="stack-xs"><span class="label">Geplante Dauer</span><span class="dauer"><input v-model.number="t.dauer" type="number" min="0" step="5" class="input" placeholder="–" @change="dauerBereinigen(t)" /> Min.</span></label>
              </MenuDropdown>
              <MenuDropdown v-if="!nurPerson" icon="⋮">
                <button class="menu-item" :disabled="i === 0" @click="verschieben(traktanden, i, -1)">↑ Nach oben</button>
                <button class="menu-item" :disabled="i === traktanden.length - 1" @click="verschieben(traktanden, i, 1)">↓ Nach unten</button>
                <button class="menu-item menu-item-danger" @click="traktanden.splice(i, 1); nummerieren(); aktiv = null">Traktandum löschen</button>
              </MenuDropdown>
            </span>
          </template>
          <template v-else>
            <h2 :class="{ leer: !t.titel }">{{ t.titel || 'Ohne Titel' }}</h2>
            <span v-if="t.istAutomatischUebernommen" class="badge gelb">{{ t.antragId ? 'Vertagter Antrag' : 'Pendenz' }}</span>
            <span v-if="t.typ" class="badge" :class="TYP_BADGE[t.typ]">{{ TYP_LABELS[t.typ] }}</span>
            <span v-if="t.verantwortliche.length" class="muted small">{{ personenText(t.verantwortliche) }}</span>
            <span v-if="themenbereich(t.themenbereichId)" class="badge" :style="themenbereichStil(t.themenbereichId)">{{ themenbereich(t.themenbereichId).name }}</span>
            <span v-if="t.dauer" class="leise small nowrap" title="Geplante Dauer">{{ formatDauer(t.dauer) }}</span>
          </template>
        </div>
        <div v-if="aktiv === t.id" class="eingerueckt"><textarea v-model.trim="t.notiz" v-wachsen class="nahtlos notiz" rows="1" :placeholder="istAntragPunkt(t) ? 'Antragstext …' : 'Notiz …'"></textarea></div>
        <p v-else-if="t.notiz" class="notiz pre eingerueckt">{{ t.notiz }}</p>
        <div v-if="t.untertraktanden.length" class="eingerueckt">
          <Unterpunkte :liste="t.untertraktanden" :nummer="String(i + 1)" :eltern-typ="t.typ" :geerbt="hauptEditierbar(t)" :pruefen="pruefen" :aktiv-id="aktiv" klasse="editierbar" :bearbeiten="aktiv === t.id" :personen="personen" :bearbeiter-auswahl="bearbeiterAuswahl" :nur-person="nurPerson" @klick="(u, darf) => subKlick(t, u, darf)" @fertig="aktiv = null" />
        </div>
        <div v-if="aktiv === t.id" class="eingerueckt row mt-2">
          <button class="btn btn-ghost" @click="t.untertraktanden.push(neuesUntertraktandum(''))">+ Unterpunkt</button>
          <button class="btn ml-auto" @click="aktiv = null">Fertig</button>
        </div>
      </section>

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
    istAntragPunkt,
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
