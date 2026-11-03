// Frist einer Pendenz: ein Datum oder «bis zur nächsten Sitzung» (faelligBis = 'naechste'; das Datum folgt dann aus dem
// Termin der nächsten Sitzung). v-model = faelligBis
export default {
  name: 'FristFeld',
  props: {
    modelValue: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
  },
  emits: ['update:modelValue'],
  template: `
    <select :value="naechste ? 'naechste' : 'datum'" class="input klein w-md" title="Bis wann" :disabled="disabled" @change="$emit('update:modelValue', $event.target.value === 'naechste' ? 'naechste' : '')">
      <option value="datum">Bis Datum</option>
      <option value="naechste">Bis zur nächsten Sitzung</option>
    </select>
    <input v-if="!naechste" :value="modelValue" type="date" class="input klein w-sm" title="Bis wann" :disabled="disabled" @input="$emit('update:modelValue', $event.target.value)" />
  `,
  computed: {
    naechste() {
      return this.modelValue === 'naechste'
    },
  },
}
