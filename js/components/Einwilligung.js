// Einwilligung beim Erfassen eigener Angaben (allgemeiner Link, Konto erstellen): Pflicht-Häkchen mit Hinweis auf den
// Zweck und die Datenschutzerklärung. Der Server verlangt sie (einwilligung: true) und speichert das Datum.
export default {
  name: 'Einwilligung',
  props: {
    modelValue: { type: Boolean, default: false },
    zweck: { type: String, default: 'in diesem Gremium und an dieser Sitzung' },
  },
  emits: ['update:modelValue'],
  template: `
    <label class="check small einwilligung">
      <input type="checkbox" :checked="modelValue" required @change="$emit('update:modelValue', $event.target.checked)" />
      <span>Ich bin einverstanden, dass meine Angaben (Name und, falls angegeben, E-Mail) für die Zusammenarbeit {{ zweck }} verwendet werden – nur in Ormeet für Sitzungen, Protokolle und die gemeinsame Terminfindung. Sie werden nicht an Dritte weitergegeben. <a href="#/datenschutz" target="_blank" rel="noopener">Datenschutzerklärung</a></span>
    </label>
  `,
}
