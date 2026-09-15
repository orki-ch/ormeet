import { benachrichtigungen, alsGelesen } from '../stores/benachrichtigungen.js'

// Glocke in der Kopfleiste: Liste der Benachrichtigungen, Klick führt an den passenden Ort
export default {
  name: 'Benachrichtigungen',
  template: `
    <div ref="root" class="dropdown glocke">
      <button class="icon-btn" :class="{ hinweis: anzahlNeu }" :data-tip="anzahlNeu ? anzahlNeu + ' neu' : 'Benachrichtigungen'" @click="offen = !offen">
        <svg viewBox="0 0 24 24"><path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15z"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>
        <span v-if="anzahlNeu" class="zaehler">{{ anzahlNeu }}</span>
      </button>
      <div v-if="offen" class="dropdown-menu liste-menu">
        <div class="kopf">
          <strong>Benachrichtigungen</strong>
          <button v-if="anzahlNeu" class="btn btn-ghost" @click="alleGelesen">Alle gelesen</button>
        </div>
        <p v-if="!liste.length" class="muted small" style="padding: 0.5rem 0.85rem">Nichts Neues – alles erledigt.</p>
        <button v-for="n in liste" :key="n.id" class="menu-item meldung" :class="{ neu: n.neu }" @click="oeffnen(n)">
          <span class="punkt"></span>
          <span class="grow">{{ n.text }}<span v-if="n.gremium" class="leise small"> · {{ n.gremium }}</span></span>
        </button>
      </div>
    </div>
  `,
  data() {
    return { offen: false }
  },
  computed: {
    liste() {
      return benachrichtigungen().slice(0, 40)
    },
    anzahlNeu() {
      return this.liste.filter((n) => n.neu).length
    },
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
    oeffnen(n) {
      alsGelesen([n.id])
      this.offen = false
      this.$router.push(n.ziel)
    },
    alleGelesen() {
      alsGelesen(this.liste.map((n) => n.id))
    },
  },
}
