// «⋯»-Menü für seltene Aktionen. Inhalt: Buttons mit class="menu-item".
export default {
  name: 'MenuDropdown',
  props: {
    icon: { type: String, default: '⋯' },
  },
  template: `
    <div ref="root" class="dropdown">
      <button class="btn btn-ghost btn-icon" title="Weitere Aktionen" @click="offen = !offen">{{ icon }}</button>
      <div v-if="offen" class="dropdown-menu" @click="offen = false">
        <slot />
      </div>
    </div>
  `,
  data() {
    return { offen: false }
  },
  mounted() {
    document.addEventListener('click', this.schliessen)
  },
  beforeUnmount() {
    document.removeEventListener('click', this.schliessen)
  },
  methods: {
    schliessen(event) {
      if (!this.$refs.root.contains(event.target)) this.offen = false
    },
  },
}
