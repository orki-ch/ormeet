// Personenfeld: freie Eingabe oder Auswahl aus den hinterlegten Personen (Mitglieder + Gäste).
// v-model = Name (Text), v-model:person-id = ID, falls der Name einer hinterlegten Person entspricht.
export default {
  name: 'PersonInput',
  inheritAttrs: false,
  props: {
    modelValue: { type: String, default: '' },
    personId: { type: String, default: null },
    personen: { type: Array, required: true }, // [{ id, name }]
  },
  emits: ['update:modelValue', 'update:personId'],
  template: `
    <input :list="listId" :value="modelValue" class="input" v-bind="$attrs" @input="eingabe($event.target.value)" />
    <datalist :id="listId">
      <option v-for="p in personen" :key="p.id" :value="p.name"></option>
    </datalist>
  `,
  data() {
    return { listId: 'personen-' + crypto.randomUUID() }
  },
  methods: {
    eingabe(name) {
      name = name.trim()
      this.$emit('update:modelValue', name)
      this.$emit('update:personId', this.personen.find((p) => p.name === name)?.id || null)
    },
  },
}
