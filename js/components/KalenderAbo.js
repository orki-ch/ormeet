import { api } from '../api.js'
import InfoKnopf from './InfoKnopf.js'

// Kalender-Abo zentral: mit Konto ein eigener Abo-Schlüssel für alle Gremien und Kurzsitzungen (api.php kalender_link),
// über einen persönlichen Link dessen Gremium (der Link selbst ist der Schlüssel)
export default {
  name: 'KalenderAbo',
  components: { InfoKnopf },
  props: {
    konto: { type: Boolean, default: false },
    gremiumId: { type: String, default: '' }, // persönlicher Link: sein Gremium
  },
  template: `
    <section class="card">
      <h2 class="card-title">Kalender-Abo <InfoKnopf titel="Kalender-Abo" :text="info" /></h2>
      <p v-if="fehler" class="small text-err">{{ fehler }}</p>
      <div v-else-if="link" class="row">
        <code class="input grow truncate" style="line-height: 1.5">{{ link }}</code>
        <button class="btn" @click="kopieren">{{ kopiert ? 'Kopiert ✓' : 'Link kopieren' }}</button>
        <a :href="link.replace(/^https?:/, 'webcal:')" class="btn btn-primary">Abonnieren</a>
      </div>
    </section>
  `,
  data() {
    return { link: '', fehler: '', kopiert: false }
  },
  computed: {
    info() {
      return (this.konto ? 'Ein Abo für alle Gremien und Kurzsitzungen, in denen du dabei bist. ' : '')
        + 'Abonniere diesen Link in deinem Kalender (Apple, Google, Outlook …): Sitzungstermine, deine Pendenzen mit Frist und provisorische Termine aus Abstimmungen, bei denen du «Ja» oder «Vielleicht» gewählt hast. Jeder Termin enthält den Link zur Sitzung.'
    },
  },
  async created() {
    if (!this.konto) {
      this.link = location.origin + location.pathname.replace(/[^/]*$/, '') + 'api.php?aktion=ical&token=' + api.token + '&gremium=' + this.gremiumId
      return
    }
    try {
      this.link = (await api.anfrage('kalender_link', '', {})).link
    } catch (fehler) {
      this.fehler = fehler.message
    }
  },
  methods: {
    kopieren() {
      navigator.clipboard.writeText(this.link)
      this.kopiert = true
      setTimeout(() => (this.kopiert = false), 2000)
    },
  },
}
