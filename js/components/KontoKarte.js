import { api } from '../api.js'
import { sync, laden } from '../stores/sync.js'
import { sitzungenStore } from '../stores/sitzungen.js'
import SsoButtons from './SsoButtons.js'
import InfoKnopf from './InfoKnopf.js'

const NAMEN_KEY = 'ormeet-namen'

// Namen, unter denen in diesem Browser ohne Konto abgestimmt oder kommentiert wurde (gehen beim Konto-Anlegen über)
export function nameMerken(name) {
  try {
    const namen = JSON.parse(localStorage.getItem(NAMEN_KEY) || '[]')
    if (name && !namen.includes(name)) localStorage.setItem(NAMEN_KEY, JSON.stringify([...namen, name]))
  } catch {}
}

export function gemerkteNamen() {
  try {
    return JSON.parse(localStorage.getItem(NAMEN_KEY) || '[]')
  } catch {
    return []
  }
}

export function namenVergessen() {
  localStorage.removeItem(NAMEN_KEY)
}

// Eigenes Konto für eine Person, die sich über einen allgemeinen Link eingetragen hat: Name und E-Mail stehen schon
// fest, es fehlt nur das Passwort (oder ein Klick auf einen Anbieter). Ohne Eintrag (älterer Link): das Konto kommt als
// weitere Person zu dieser Sitzung; Stimmen und Kommentare unter einem gemerkten Namen gehen auf das Konto über.
export default {
  name: 'KontoKarte',
  components: { InfoKnopf, SsoButtons },
  template: `
    <section class="card konto mb-2">
      <h2 class="card-title">Eigenes Konto <InfoKnopf titel="Eigenes Konto" :text="'Ein Konto braucht es nicht – dein Link genügt. Mit einem Konto meldest du dich überall gleich an und siehst diese Sitzung jederzeit wieder.' + (gast ? ' Dein Name und deine E-Mail sind schon eingetragen, es fehlt nur ein Passwort.' : '')" /></h2>
      <button v-if="!offen" class="btn btn-primary" @click="oeffnen">Konto erstellen oder anmelden</button>
      <template v-if="offen">
        <div class="row" style="gap: 0.5rem 1.5rem">
          <label class="check small"><input v-model="modus" type="radio" value="neu" /> Konto erstellen</label>
          <label class="check small"><input v-model="modus" type="radio" value="bestehend" /> Ich habe schon ein Konto</label>
        </div>
        <form class="stack" style="max-width: 24rem" @submit.prevent="senden">
          <input v-if="modus === 'neu'" v-model.trim="form.name" class="input" placeholder="Name" required :readonly="!!gast" />
          <input v-model.trim="form.email" class="input" type="email" placeholder="E-Mail" required autocomplete="username" :readonly="!!gast && modus === 'neu'" />
          <input v-model="form.passwort" class="input" type="password" :placeholder="modus === 'neu' ? 'Passwort (mindestens 8 Zeichen)' : 'Passwort'" required :autocomplete="modus === 'neu' ? 'new-password' : 'current-password'" />
          <p v-if="fehler" class="small text-err">{{ fehler }}</p>
          <button class="btn btn-primary" :disabled="laeuft">{{ modus === 'neu' ? 'Konto erstellen' : 'Anmelden' }}</button>
          <SsoButtons :verknuepfen="api.token" :text="modus === 'neu' ? 'registrieren' : 'anmelden'" />
        </form>
      </template>
    </section>
  `,
  data() {
    return { api, offen: false, modus: 'neu', form: { name: '', email: '', passwort: '' }, fehler: '', laeuft: false }
  },
  computed: {
    // Über den allgemeinen Link eingetragene Person (eigener Link)
    gast() {
      const zugriff = sync.zugriff
      if (zugriff?.rolle !== 'freigabe' || !zugriff.personId) return null
      return sitzungenStore.vorprotokollById(zugriff.vorprotokollId)?.gaeste.find((g) => g.id === zugriff.personId) || null
    },
  },
  methods: {
    // Eingetragene Angaben übernehmen, sonst den Namen, unter dem hier schon abgestimmt oder kommentiert wurde
    oeffnen() {
      this.form.name ||= this.gast?.name || gemerkteNamen()[0] || ''
      this.form.email ||= this.gast?.email || ''
      this.offen = true
    },
    async senden() {
      this.laeuft = true
      this.fehler = ''
      // Danach mit dem Konto auf derselben Seite weiter (Freigabe-Link: das Vorprotokoll seiner Sitzung)
      const vp = sitzungenStore.vorprotokollById(sync.zugriff?.vorprotokollId)
      const seite = this.$route.params.seite || 'vorprotokoll' // Freigabe-Link: /freigabe/<key>/<seite>
      const ziel = this.$route.path.startsWith('/sitzung/') ? this.$route.path : vp ? `/sitzung/${vp.sitzungId}/${seite}` : '/'
      try {
        const daten = await api.anfrage(this.modus === 'neu' ? 'registrieren' : 'anmelden', '', { ...this.form, namen: gemerkteNamen() })
        namenVergessen()
        api.setToken(daten.token)
        sync.zugriff = null
        await laden()
        this.$router.push(ziel)
      } catch (fehler) {
        this.fehler = fehler.message
      }
      this.laeuft = false
    },
  },
}
