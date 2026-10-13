// Hinweis, der nur bei Bedarf erscheint: kleiner runder (i)-Knopf oder graue Pille mit Text (label);
// der Hinweis zeigt sich als Tooltip beim Zeigen oder nach einem Klick (Fokus), auch auf dem Handy.
export default {
  name: 'InfoKnopf',
  props: {
    text: { type: String, required: true },
    label: { type: String, default: '' }, // z. B. «Technischer Hinweis» – sonst nur das (i)
    rechts: { type: Boolean, default: false }, // Tooltip am rechten Rand ausrichten
  },
  template: `
    <span class="info-knopf" :class="{ pille: label, rechts }" tabindex="0" :aria-label="label || 'Hinweis'" @click.stop>
      <span class="info-i" aria-hidden="true">i</span><span v-if="label">{{ label }}</span>
      <span class="info-text" role="tooltip">{{ text }}</span>
    </span>
  `,
}
