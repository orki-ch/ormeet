import MenuDropdown from './MenuDropdown.js'
import { bestaetigen } from '../utils/dialog.js'

// Stufen-Schalter (z. B. Lesen / Eigene / Alles) mit Einzelrechten im ⋯-Menü. Sind Einzelrechte gesetzt, steht statt des
// Schalters die gleich aussehende Pille «Individuell»; ein Klick darauf setzt nach Rückfrage auf den Standard zurück.
// Weitere Menüpunkte (z. B. Link kopieren) kommen über den Slot ins ⋯-Menü.
export default {
  name: 'RechteSchalter',
  components: { MenuDropdown },
  props: {
    stufe: { type: String, required: true }, // eine der stufen oder 'individuell'
    stufen: { type: Object, required: true },
    rechte: { type: Array, default: () => [] }, // gewählte Einzelrechte (nur bei 'individuell')
    einzelrechte: { type: Object, required: true },
    gesetzt: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
  },
  emits: ['stufe', 'rechte', 'zuruecksetzen'],
  template: `
    <span class="rechte-steuerung" @click.stop>
      <span v-if="stufe === 'individuell'" class="schalter gesetzt" :title="'Einzelrechte: ' + (rechteText || 'keine')">
        <button type="button" class="aktiv" :disabled="disabled" @click="zuruecksetzen">Individuell</button>
      </span>
      <span v-else class="schalter" :class="{ gesetzt }">
        <button v-for="(label, s) in stufen" :key="s" type="button" :class="{ aktiv: stufe === s }" :disabled="disabled" @click="$emit('stufe', s)">{{ label }}</button>
      </span>
      <MenuDropdown v-if="!disabled || $slots.default" panel>
        <template v-if="!disabled">
          <span class="label">Einzelrechte</span>
          <label v-for="(label, recht) in einzelrechte" :key="recht" class="check small">
            <input type="checkbox" :checked="stufe === 'individuell' && rechte.includes(recht)" @change="umschalten(recht, $event.target.checked)" /> {{ label }}
          </label>
        </template>
        <slot />
      </MenuDropdown>
    </span>
  `,
  computed: {
    rechteText() {
      return this.rechte.map((r) => this.einzelrechte[r]).filter(Boolean).join(', ')
    },
  },
  methods: {
    umschalten(recht, an) {
      const liste = (this.stufe === 'individuell' ? this.rechte : []).filter((r) => r !== recht)
      if (an) liste.push(recht)
      this.$emit('rechte', liste)
    },
    async zuruecksetzen() {
      if (await bestaetigen('Einzelrechte entfernen und auf den Standard zurücksetzen?', { gefahr: true })) this.$emit('zuruecksetzen')
    },
  },
}
