// Gäste als Chips; «+ Gast» öffnet ein kleines Formular. Bearbeitet das übergebene Array direkt.
// rechte(gast): Knopf «Individuelle Rechte» hinten am Chip (individuell(id): schon gesetzt).
export default {
  name: 'GaesteListe',
  props: {
    gaeste: { type: Array, required: true },
    nurLesen: { type: Boolean, default: false },
    rechte: { type: Function, default: null },
    individuell: { type: Function, default: () => false },
    linkKopieren: { type: Function, default: null }, // Knopf «Link kopieren» hinten am Chip (hatLink(gast): Link vorhanden)
    hatLink: { type: Function, default: () => false },
    status: { type: Function, default: () => null }, // Einladung per E-Mail: { klasse, titel } für das Symbol nach dem Namen
  },
  template: `
    <div class="chips">
      <span v-for="(gast, i) in gaeste" :key="gast.id" class="chip" :class="{ 'ohne-x': nurLesen }">
        {{ gast.name }}<span v-if="gast.organisation" class="leise">&nbsp;· {{ gast.organisation }}</span>
        <span v-if="status(gast)" class="einladung-symbol" :class="status(gast).klasse" :title="status(gast).titel" :aria-label="status(gast).titel" role="img"></span>
        <button v-if="linkKopieren && hatLink(gast)" type="button" class="chip-x rechte-knopf" :title="'Link von ' + gast.name + ' kopieren'" @click="linkKopieren(gast)"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg></button>
        <button v-if="rechte && gast.name" type="button" class="chip-x rechte-knopf" :class="{ gesetzt: individuell(gast.id) }" :title="'Individuelle Rechte von ' + gast.name" @click="rechte(gast)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10"/><path d="M18 7h2"/><circle cx="16" cy="7" r="2"/><path d="M4 17h4"/><path d="M12 17h8"/><circle cx="10" cy="17" r="2"/></svg></button>
        <button v-if="!nurLesen" class="chip-x" title="Entfernen" @click="gaeste.splice(i, 1)">✕</button>
      </span>
      <span v-if="!gaeste.length && nurLesen" class="muted small">Keine Gäste.</span>
      <form v-if="offen" class="row" @submit.prevent="hinzufuegen">
        <input ref="name" v-model.trim="neu.name" class="input w-sm" placeholder="Name" required />
        <input v-model.trim="neu.organisation" class="input w-sm" placeholder="Organisation" />
        <button class="btn btn-primary btn-icon">+</button>
        <button type="button" class="btn btn-ghost btn-icon" @click="offen = false">✕</button>
      </form>
      <button v-else-if="!nurLesen" class="btn btn-ghost" @click="oeffnen">+ Gast</button>
    </div>
  `,
  data() {
    return { offen: false, neu: { name: '', organisation: '' } }
  },
  methods: {
    oeffnen() {
      this.offen = true
      this.$nextTick(() => this.$refs.name.focus())
    },
    hinzufuegen() {
      this.gaeste.push({ id: crypto.randomUUID(), ...this.neu })
      this.neu = { name: '', organisation: '' }
    },
  },
}
