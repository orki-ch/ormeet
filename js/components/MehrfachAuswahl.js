import { bestaetigen } from '../utils/dialog.js'
// Mehrfachauswahl als Pillen: gewählte Werte als Chips mit ✕ (Entfernen nach Rückfrage), weitere über die Auswahl dahinter.
// v-model = [wert, …]; optionen = [{ wert, label }]
export default {
  name: 'MehrfachAuswahl',
  props: {
    modelValue: { type: Array, required: true },
    optionen: { type: Array, required: true },
    placeholder: { type: String, default: '+ hinzufügen …' },
    disabled: { type: Boolean, default: false },
  },
  emits: ['update:modelValue'],
  template: `
    <div class="input chips-feld mehrfach" :class="{ 'ist-disabled': disabled }">
      <span v-for="wert in modelValue" :key="wert" class="chip" :class="{ 'ohne-x': disabled }">
        {{ label(wert) }}
        <button v-if="!disabled" type="button" class="chip-x" title="Entfernen" @click="entfernen(wert)">✕</button>
      </span>
      <select v-if="!disabled && frei.length" class="nahtlos" @change="hinzufuegen($event)">
        <option value="">{{ placeholder }}</option>
        <option v-for="o in frei" :key="o.wert" :value="o.wert">{{ o.label }}</option>
      </select>
      <span v-else-if="!modelValue.length" class="leise small">–</span>
    </div>
  `,
  computed: {
    frei() {
      return this.optionen.filter((o) => !this.modelValue.includes(o.wert))
    },
  },
  methods: {
    label(wert) {
      return this.optionen.find((o) => o.wert === wert)?.label || wert
    },
    hinzufuegen(event) {
      const wert = event.target.value
      event.target.value = ''
      if (wert) this.$emit('update:modelValue', [...this.modelValue, wert])
    },
    async entfernen(wert) {
      if (await bestaetigen(`«${this.label(wert)}» entfernen?`, { gefahr: true })) this.$emit('update:modelValue', this.modelValue.filter((w) => w !== wert))
    },
  },
}
