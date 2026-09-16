// «⋯»-Menü für seltene Aktionen (Inhalt: Buttons mit class="menu-item"); schliesst bei jedem Klick darin.
// Mit `text` wird der Auslöser eine schlanke Pille, mit `panel` bleibt das Menü offen (Formularfelder darin).
export default {
  name: 'MenuDropdown',
  props: {
    icon: { type: String, default: '⋯' },
    text: { type: String, default: '' },
    panel: { type: Boolean, default: false },
  },
  template: `
    <div ref="root" class="dropdown">
      <button v-if="text" type="button" class="btn-pille" :class="{ offen }" @click="offen = !offen">{{ text }} <span class="pfeil">▾</span></button>
      <button v-else type="button" class="btn btn-ghost btn-icon" title="Weitere Aktionen" @click="offen = !offen">{{ icon }}</button>
      <div v-if="offen" class="dropdown-menu" :class="{ panel }" @click="panel || (offen = false)">
        <slot />
      </div>
    </div>
  `,
  data() {
    return { offen: false }
  },
  mounted() {
    // Capture-Phase: schliesst auch bei Klicks in Elementen, die die Weitergabe stoppen (z. B. Unterpunkte)
    document.addEventListener('click', this.schliessen, true)
  },
  beforeUnmount() {
    document.removeEventListener('click', this.schliessen, true)
  },
  methods: {
    schliessen(event) {
      if (!this.$refs.root.contains(event.target)) this.offen = false
    },
  },
}
