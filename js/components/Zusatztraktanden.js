import EintragListe from './EintragListe.js'
import MenuDropdown from './MenuDropdown.js'

// Zusatztraktanden: Haupttraktanden, die erst an der Sitzung dazukamen (bewusste Abweichung vom Vorprotokoll).
// Sie tragen keine Nummer, sondern die Bezeichnung «Zusatztraktandum», und stehen nach dem Traktandum `nachId`
// (null = vor dem ersten). Die Begründung öffnet sich erst auf Klick. Bearbeitung im selben Layout wie überall;
// welches Zusatztraktandum offen ist, hält der Editor (aktivId), damit ein neues direkt offen erscheint.
export default {
  name: 'Zusatztraktanden',
  components: { EintragListe, MenuDropdown },
  props: {
    protokoll: { type: Object, required: true }, // wird direkt bearbeitet
    nachId: { type: String, default: null },
    traktanden: { type: Array, required: true }, // Traktanden des Vorprotokolls (Auswahl der Position)
    gremium: { type: Object, required: true },
    personen: { type: Array, required: true },
    voll: { type: Boolean, default: false },
    aktivId: { type: String, default: null },
  },
  emits: ['aktiv'],
  template: `
    <section v-for="z in liste" :id="z.id" :key="z.id" class="card" :class="{ bearbeitbar: voll }">
      <div :class="{ 'zusatz-kopf': voll && aktivId !== z.id }" @click="voll && aktivId !== z.id && $emit('aktiv', z.id)">
        <div class="traktandum-kopf">
          <span class="badge gelb">Zusatztraktandum</span>
          <template v-if="aktivId === z.id">
            <input v-model.trim="z.titel" class="nahtlos h2 grow" placeholder="Titel des Zusatztraktandums" />
            <span class="werkzeuge">
              <select v-model="z.nachId" class="btn-pille" title="Stelle im Ablauf">
                <option :value="null">Am Anfang</option>
                <option v-for="(t, i) in traktanden" :key="t.id" :value="t.id">Nach {{ i + 1 }}. {{ t.titel }}</option>
              </select>
              <MenuDropdown>
                <button class="menu-item menu-item-danger" @click="loeschen(z)">Zusatztraktandum löschen</button>
              </MenuDropdown>
            </span>
          </template>
          <h2 v-else :class="{ leer: !z.titel }">{{ z.titel || 'Ohne Titel' }}</h2>
        </div>
        <div class="eingerueckt mt-1">
          <label v-if="aktivId === z.id" class="stack-sm">
            <span class="label">Weshalb kam dieses Traktandum an der Sitzung hinzu?</span>
            <textarea v-model.trim="z.begruendung" v-wachsen class="input" rows="2" placeholder="Grund für die Abweichung vom Vorprotokoll"></textarea>
          </label>
          <details v-else class="aufklapp klein" @click.stop>
            <summary>Weshalb hinzugefügt<span v-if="!z.begruendung" class="text-warn">&nbsp;· noch keine Begründung</span></summary>
            <p v-if="z.begruendung" class="notiz pre mt-1">{{ z.begruendung }}</p>
          </details>
        </div>
      </div>
      <div class="eingerueckt mt-2">
        <EintragListe :traktandum-id="z.id" :eintraege="protokoll.eintraege" :gremium="gremium" :personen="personen" :nur-lesen="!voll" />
      </div>
      <div v-if="aktivId === z.id" class="row mt-1">
        <button class="btn ml-auto" @click="schliessen(z)">Fertig</button>
      </div>
    </section>
  `,
  computed: {
    liste() {
      return this.protokoll.zusatztraktanden.filter((z) => z.nachId === this.nachId)
    },
  },
  methods: {
    loeschen(z) {
      const eintraege = this.protokoll.eintraege.filter((e) => e.traktandumId === z.id)
      if (eintraege.length && !confirm(`Zusatztraktandum «${z.titel || 'Ohne Titel'}» mit ${eintraege.length} Einträgen löschen?`)) return
      this.protokoll.eintraege = this.protokoll.eintraege.filter((e) => e.traktandumId !== z.id)
      this.protokoll.zusatztraktanden.splice(this.protokoll.zusatztraktanden.indexOf(z), 1)
      this.$emit('aktiv', null)
    },
    // Fertig: ein ganz leeres Zusatztraktandum verschwindet wieder
    schliessen(z) {
      const leer = !z.titel && !z.begruendung && !this.protokoll.eintraege.some((e) => e.traktandumId === z.id)
      if (leer) this.protokoll.zusatztraktanden.splice(this.protokoll.zusatztraktanden.indexOf(z), 1)
      this.$emit('aktiv', null)
    },
  },
}
