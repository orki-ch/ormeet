import ThemenbereichSelect from './ThemenbereichSelect.js'
import PersonenInput from './PersonenInput.js'
import MenuDropdown from './MenuDropdown.js'
import { bearbeitenMixin } from '../utils/bearbeiten.js'
import { TRAKTANDUM_TYP, TYP_BADGE, TYP_LABELS, formatDauer } from '../utils/labels.js'
import { dauerSumme, istBerechtigt, neuesTraktandum, neuesUntertraktandum, personenText, wirksamerTyp } from '../utils/traktanden.js'

// Traktandenliste (zwei Ebenen) im Karten-Layout des Protokolls, direkt im übergebenen Array bearbeitet.
// Bearbeitbare Karten / Unterpunkte tragen einen Rahmen in der Ormeet-Farbe; Klick öffnet die Bearbeitung.
// nurPerson (persönlicher Freigabe-Link): bearbeitbar sind Traktanden, bei denen die Person verantwortlich oder
// als Bearbeiter eingetragen ist (direkt, über ihre Rolle oder eine Gruppe); Unterpunkte erben das vom Traktandum.
// Typ (Information / Antrag / Pendenz) und geplante Dauer werden hier festgelegt; im Protokoll sind sie fix.
export default {
  name: 'TraktandenListe',
  components: { MenuDropdown, PersonenInput, ThemenbereichSelect },
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
          <div class="eingerueckt grid-2">
            <div><span class="label">Verantwortlich</span><PersonenInput v-model="t.verantwortliche" :personen="personen" placeholder="Name eingeben oder wählen" :nur-eigene="nurPerson?.id" /></div>
            <div><span class="label">Dürfen zusätzlich bearbeiten</span><PersonenInput v-model="t.bearbeiter" :personen="bearbeiterAuswahl" placeholder="Personen, Rollen oder Gruppen" nur-liste :disabled="!!nurPerson" /></div>
          </div>
          <div class="eingerueckt row">
            <div>
              <span class="label">Typ der Einträge</span>
              <select v-model="t.typ" class="input w-md" title="Gilt im Protokoll für alle Einträge und Unterpunkte dieses Traktandums">
                <option v-for="(label, wert) in TRAKTANDUM_TYP" :key="wert" :value="wert">{{ label }}</option>
              </select>
            </div>
            <div>
              <span class="label">Geplante Dauer</span>
              <span class="dauer"><input v-model.number="t.dauer" type="number" min="0" step="5" class="input" placeholder="–" @change="dauerBereinigen(t)" /> Min.</span>
            </div>
          </div>
          <div class="eingerueckt stack">
            <textarea v-model.trim="t.notiz" v-wachsen class="input" rows="1" placeholder="Notiz / Beschreibung (mehrzeilig)"></textarea>
            <div v-for="(u, j) in t.untertraktanden" :key="u.id" class="sub stack-sm">
              <div class="row">
                <span class="nr mono small leise">{{ i + 1 }}.{{ j + 1 }}</span>
                <input v-model.trim="u.titel" class="input grow" placeholder="Unterpunkt" />
                <select v-if="!t.typ" v-model="u.typ" class="input w-sm" title="Typ der Einträge dieses Unterpunkts">
                  <option v-for="(label, wert) in TRAKTANDUM_TYP" :key="wert" :value="wert">{{ label }}</option>
                </select>
                <span class="row-nowrap">
                  <button class="btn btn-ghost btn-icon" :disabled="j === 0" @click="verschieben(t.untertraktanden, j, -1)">↑</button>
                  <button class="btn btn-ghost btn-icon" :disabled="j === t.untertraktanden.length - 1" @click="verschieben(t.untertraktanden, j, 1)">↓</button>
                  <button class="btn btn-danger btn-icon" @click="t.untertraktanden.splice(j, 1)">✕</button>
                </span>
              </div>
              <textarea v-model.trim="u.notiz" v-wachsen class="input" rows="1" placeholder="Notiz (mehrzeilig)"></textarea>
              <div class="grid-2">
                <PersonenInput v-model="u.verantwortliche" :personen="personen" placeholder="Verantwortlich (sonst wie Traktandum)" :nur-eigene="nurPerson?.id" />
                <PersonenInput v-model="u.bearbeiter" :personen="bearbeiterAuswahl" placeholder="Dürfen zusätzlich bearbeiten" nur-liste :disabled="!!nurPerson" />
              </div>
            </div>
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
            <template v-for="(u, j) in t.untertraktanden" :key="u.id">
              <!-- Bearbeitung nur dieses Unterpunkts (Person mit Rechten auf dem Unterpunkt) -->
              <div v-if="aktiv === u.id" class="sub editing stack-sm" style="padding: 0.75rem 0.75rem 0.75rem 1rem" @click.stop>
                <div class="row">
                  <span class="nr mono small leise">{{ i + 1 }}.{{ j + 1 }}</span>
                  <input v-model.trim="u.titel" class="input grow" placeholder="Unterpunkt" />
                  <select v-if="!t.typ" v-model="u.typ" class="input w-sm" title="Typ der Einträge dieses Unterpunkts">
                    <option v-for="(label, wert) in TRAKTANDUM_TYP" :key="wert" :value="wert">{{ label }}</option>
                  </select>
                </div>
                <textarea v-model.trim="u.notiz" v-wachsen class="input" rows="1" placeholder="Notiz (mehrzeilig)"></textarea>
                <div class="row">
                  <PersonenInput v-model="u.verantwortliche" :personen="personen" placeholder="Verantwortlich" :nur-eigene="nurPerson?.id" class="grow" />
                  <button class="btn" @click="aktiv = null">Fertig</button>
                </div>
              </div>
              <div v-else :id="u.id" class="sub" :class="{ editierbar: subEditierbar(t, u) && !hauptEditierbar(t) }" :style="subEditierbar(t, u) && !hauptEditierbar(t) ? 'padding: 0.5rem 0.75rem 0.5rem 1rem' : ''" @click.stop="subKlick(t, u)">
                <div class="sub-kopf">
                  <span class="nr">{{ i + 1 }}.{{ j + 1 }}</span>
                  <h3>{{ u.titel }}</h3>
                  <span v-if="!t.typ && u.typ" class="badge" :class="TYP_BADGE[u.typ]">{{ TYP_LABELS[u.typ] }}</span>
                  <span v-if="u.verantwortliche.length" class="ml-auto leise small">{{ personenText(u.verantwortliche) }}</span>
                </div>
                <p v-if="u.notiz" class="notiz pre">{{ u.notiz }}</p>
              </div>
            </template>
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
    wirksamerTyp,
    hauptEditierbar(t) {
      if (this.nurLesen) return false
      return !this.nurPerson || istBerechtigt(t, this.nurPerson)
    },
    // Unterpunkt allein bearbeitbar: nur wenn das Traktandum selbst gesperrt ist
    subEditierbar(t, u) {
      if (this.nurLesen) return false
      return this.hauptEditierbar(t) || istBerechtigt(u, this.nurPerson)
    },
    subKlick(t, u) {
      if (this.hauptEditierbar(t)) this.aktiv = t.id
      else if (istBerechtigt(u, this.nurPerson)) this.aktiv = u.id
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
