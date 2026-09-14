// Mehrere Personen als Chips; Eingabe frei oder aus der Vorschlagsliste (Mitglieder + Gäste).
// v-model = [{ id, name }]. nurListe: nur hinterlegte Personen zulassen.
// nurEigene: die Person darf nur sich selbst hinzufügen / entfernen (persönlicher Freigabe-Link).
export default {
  name: 'PersonenInput',
  props: {
    modelValue: { type: Array, required: true },
    personen: { type: Array, required: true },
    placeholder: { type: String, default: '' },
    nurListe: { type: Boolean, default: false },
    nurEigene: { type: String, default: null },
    disabled: { type: Boolean, default: false },
  },
  emits: ['update:modelValue'],
  template: `
    <div class="input chips-feld" :class="{ 'ist-disabled': disabled }">
      <span v-for="(p, i) in modelValue" :key="i" class="chip" :class="{ 'ohne-x': !entfernbar(p) }">
        {{ p.name }}
        <button v-if="entfernbar(p)" type="button" class="chip-x" @click="entfernen(i)">✕</button>
      </span>
      <input
        v-if="!disabled && (!nurEigene || !enthaelt(nurEigene))"
        v-model.trim="eingabe"
        :list="listId"
        :placeholder="modelValue.length ? '' : placeholder"
        @change="uebernehmen"
        @keydown.enter.prevent="uebernehmen"
        @blur="uebernehmen"
      />
      <span v-else-if="!modelValue.length" class="leise small">–</span>
      <datalist :id="listId">
        <option v-for="p in auswahl" :key="p.id" :value="p.name"></option>
      </datalist>
    </div>
  `,
  data() {
    return { eingabe: '', listId: 'personen-' + crypto.randomUUID() }
  },
  computed: {
    auswahl() {
      return this.personen.filter((p) => !this.enthaelt(p.id) && (!this.nurEigene || p.id === this.nurEigene))
    },
  },
  methods: {
    enthaelt(id) {
      return this.modelValue.some((p) => p.id === id)
    },
    entfernbar(p) {
      return !this.disabled && (!this.nurEigene || p.id === this.nurEigene)
    },
    entfernen(i) {
      this.$emit('update:modelValue', this.modelValue.filter((_, j) => j !== i))
    },
    uebernehmen() {
      const name = this.eingabe
      if (!name) return
      const treffer = this.personen.find((p) => p.name === name)
      if ((this.nurListe && !treffer) || (this.nurEigene && treffer?.id !== this.nurEigene)) return
      if (!this.modelValue.some((p) => p.name === name)) {
        this.$emit('update:modelValue', [...this.modelValue, { id: treffer?.id || null, name }])
      }
      this.eingabe = ''
    },
  },
}
