// Einfacher Dialog (Escape oder Klick auf den Hintergrund schliesst)
export default {
  name: 'Modal',
  props: {
    titel: { type: String, required: true },
  },
  emits: ['schliessen'],
  template: `
    <div class="modal-backdrop" @click.self="$emit('schliessen')">
      <div class="modal">
        <h2 class="card-title">{{ titel }}</h2>
        <slot />
      </div>
    </div>
  `,
  mounted() {
    document.addEventListener('keydown', this.taste)
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.taste)
  },
  methods: {
    taste(event) {
      if (event.key === 'Escape') this.$emit('schliessen')
    },
  },
}
