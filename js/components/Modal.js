// Dialog im Aussehen der Bestätigungen ($.confirm): Titel im Rahmen, weisse Karte 3px vom Rand, Knöpfe darunter
// (Slot «fuss», rechts). Schliesst nur über die eigenen Knöpfe – nicht über den Hintergrund und nicht per Tastatur.
// Liegen die Knöpfe ausserhalb des Formulars, verbindet sie form="<id>" mit ihm.
export default {
  name: 'Modal',
  props: {
    titel: { type: String, required: true },
  },
  emits: ['schliessen'],
  template: `
    <div class="modal-backdrop">
      <div class="modal" role="dialog" aria-modal="true" :aria-label="titel">
        <h2 class="modal-titel">{{ titel }}</h2>
        <div class="modal-inhalt"><slot /></div>
        <div v-if="$slots.fuss" class="modal-fuss"><slot name="fuss" /></div>
      </div>
    </div>
  `,
}
