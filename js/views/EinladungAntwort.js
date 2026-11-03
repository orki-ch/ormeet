import { api } from '../api.js'

// Antwort auf eine Einladung per E-Mail (ohne Anmeldung, über den signierten Link): zusagen, absagen mit Grund
// oder keine Einladungen dieses Gremiums mehr erhalten. Ändern geht, bis die Sitzung beginnt.
export default {
  name: 'EinladungAntwort',
  props: {
    code: { type: String, required: true },
  },
  template: `
    <div class="card login stack">
      <p v-if="laedt" class="muted small">Wird geladen …</p>
      <template v-else-if="info">
        <div>
          <p class="kicker">{{ info.gremium }}</p>
          <h1>{{ info.titel }}</h1>
          <p class="small mt-1">{{ info.termin }}<span v-if="info.ort"> · {{ info.ort }}</span></p>
        </div>
        <template v-if="abbestellt">
          <p class="small">Du erhältst von «{{ info.gremium }}» keine Einladungen per E-Mail mehr.</p>
        </template>
        <template v-else>
          <p class="small">Hallo {{ info.name }} – <strong>{{ statusText }}</strong></p>
          <template v-if="info.offen">
            <form v-if="modus === 'absagen'" class="stack" @submit.prevent="antworten('abgesagt')">
              <div><span class="label">Grund der Absage</span><textarea v-model.trim="grund" class="input" rows="3" maxlength="500" required autofocus></textarea></div>
              <p class="hint">Den Grund sehen nur Sitzungsleitung und Protokollführung.</p>
              <div class="row">
                <button type="button" class="btn" @click="modus = ''">Abbrechen</button>
                <button class="btn btn-primary ml-auto" :disabled="laeuft || !grund">Absagen</button>
              </div>
            </form>
            <div v-else class="row">
              <button v-if="info.antwort !== 'abgesagt'" type="button" class="btn" @click="modus = 'absagen'">Absagen</button>
              <button v-if="info.antwort !== 'zugesagt'" type="button" class="btn btn-primary ml-auto" :disabled="laeuft" @click="antworten('zugesagt')">Zusagen</button>
            </div>
          </template>
          <p v-else class="muted small">Die Sitzung hat schon begonnen – die Antwort lässt sich nicht mehr ändern.</p>
          <p class="center"><button type="button" class="btn btn-ghost" :disabled="laeuft" @click="abbestellen">Keine Einladungen mehr erhalten</button></p>
        </template>
      </template>
      <p v-if="fehler" class="small text-err">{{ fehler }}</p>
    </div>
  `,
  data() {
    return { info: null, laedt: true, laeuft: false, fehler: '', modus: '', grund: '', abbestellt: false }
  },
  computed: {
    statusText() {
      if (this.info.antwort === 'abgesagt') return `du hast abgesagt (${this.info.grund}).`
      if (this.info.antwort === 'zugesagt') return 'du hast zugesagt.'
      return 'ohne Antwort gilt die Einladung als angenommen.'
    },
  },
  async created() {
    try {
      this.info = await api.anfrage('einladung_info', '', { code: this.code })
      if (this.$route.query.antwort === 'absagen' && this.info.offen) this.modus = 'absagen'
      else if (this.$route.query.antwort === 'zusagen' && this.info.offen && this.info.antwort !== 'zugesagt') await this.antworten('zugesagt')
      else if (this.$route.query.abbestellen && !this.info.abgemeldet) await this.abbestellen()
    } catch (fehler) {
      this.fehler = fehler.message
    } finally {
      this.laedt = false
    }
  },
  methods: {
    async antworten(antwort) {
      this.laeuft = true
      this.fehler = ''
      try {
        await api.anfrage('einladung_antworten', '', { code: this.code, antwort, grund: antwort === 'abgesagt' ? this.grund : '' })
        Object.assign(this.info, { antwort, grund: antwort === 'abgesagt' ? this.grund : '' })
        this.modus = ''
      } catch (fehler) {
        this.fehler = fehler.message
      } finally {
        this.laeuft = false
      }
    },
    async abbestellen() {
      this.laeuft = true
      try {
        await api.anfrage('einladung_abbestellen', '', { code: this.code })
        this.abbestellt = true
      } catch (fehler) {
        this.fehler = fehler.message
      } finally {
        this.laeuft = false
      }
    },
  },
}
