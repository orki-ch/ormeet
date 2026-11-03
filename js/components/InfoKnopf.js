// Hinweis, der nur bei Bedarf erscheint: kleiner runder (i)-Knopf oder graue Pille mit Text (label);
// der Hinweis zeigt sich als Tooltip beim Zeigen oder nach einem Klick (Fokus), auch auf dem Handy.
// Inhalt: titel (fett), text und / oder punkte = [{ titel, text }] als kleine Liste mit Zwischentiteln.
export default {
  name: 'InfoKnopf',
  props: {
    text: { type: String, default: '' },
    titel: { type: String, default: '' },
    punkte: { type: Array, default: () => [] },
    label: { type: String, default: '' }, // z. B. «Technischer Hinweis» – sonst nur das (i)
    rechts: { type: Boolean, default: false }, // Tooltip am rechten Rand ausrichten
  },
  template: `
    <span class="info-knopf" :class="{ pille: label, rechts }" tabindex="0" :aria-label="label || titel || 'Hinweis'" @click.stop.prevent>
      <span class="info-i" aria-hidden="true">i</span><span v-if="label">{{ label }}</span>
      <span class="info-text" role="tooltip">
        <strong v-if="titel" class="info-titel">{{ titel }}</strong>
        <span v-if="text" class="info-absatz">{{ text }}</span>
        <span v-for="p in punkte" :key="p.titel" class="info-punkt"><strong>{{ p.titel }}</strong> {{ p.text }}</span>
      </span>
    </span>
  `,
}
