// Gäste als Chips; «+ Gast» öffnet ein kleines Formular. Bearbeitet das übergebene Array direkt.
export default {
  name: 'GaesteListe',
  props: {
    gaeste: { type: Array, required: true },
    nurLesen: { type: Boolean, default: false },
  },
  template: `
    <div class="chips">
      <span v-for="(gast, i) in gaeste" :key="gast.id" class="chip" :class="{ 'ohne-x': nurLesen }">
        {{ gast.name }}<span v-if="gast.organisation" class="leise">&nbsp;· {{ gast.organisation }}</span>
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
