import { api } from '../api.js'

// Schaltflächen «Mit … anmelden» für die eingerichteten SSO-Anbieter
export default {
  name: 'SsoButtons',
  props: {
    verknuepfen: { type: String, default: '' }, // persönlicher Link, der mit dem Konto verknüpft werden soll
    text: { type: String, default: 'anmelden' },
  },
  template: `
    <div v-if="Object.keys(anbieter).length" class="sso stack-sm">
      <p class="leise small center">oder</p>
      <a v-for="(name, id) in anbieter" :key="id" :href="link(id)" class="btn btn-block">Mit {{ name }} {{ text }}</a>
    </div>
  `,
  data() {
    return { anbieter: {} }
  },
  async created() {
    this.anbieter = (await api.anfrage('sso_anbieter').catch(() => ({ anbieter: {} }))).anbieter
  },
  methods: {
    link(id) {
      const p = new URLSearchParams({ aktion: 'sso_start', anbieter: id, verknuepfen: this.verknuepfen, weiter: this.verknuepfen ? '' : this.$route.query.weiter || '' })
      return 'api.php?' + p
    },
  },
}
