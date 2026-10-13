import { gremienStore } from '../stores/gremien.js'
import { sync } from '../stores/sync.js'
import { neuerKey } from '../utils/keys.js'
import InfoKnopf from './InfoKnopf.js'

// Teilnehmende einer Kurzsitzung. Mit Gremium: Mitglieder frei an- und abwählen. Ohne Gremium (Behälter):
// die Eingeladenen sind seine Mitglieder – mit E-Mail und persönlichem Link, neue lassen sich direkt einladen.
// Die Auswahl steht in ziel[feld] (Protokoll: anwesende, vorher im versteckten Vorprotokoll: anwesendeMitgliederIds).
export default {
  name: 'KurzTeilnehmende',
  components: { InfoKnopf },
  props: {
    gremium: { type: Object, required: true },
    ziel: { type: Object, required: true },
    feld: { type: String, required: true },
    voll: { type: Boolean, default: false },
    personId: { type: String, default: null }, // eigene Teilnahme bleibt änderbar
    linksSichtbar: { type: Boolean, default: false },
  },
  template: `
    <div v-if="!gremium.kurz" class="row" style="gap: 0.25rem 1.5rem">
      <label v-for="m in gremium.mitglieder" :key="m.id" class="check" :class="{ aus: !darf(m) }">
        <input v-model="ziel[feld]" type="checkbox" :value="m.id" :disabled="!darf(m)" /> {{ m.name }}
      </label>
    </div>
    <div v-else class="stack-sm">
      <div class="liste">
        <div v-for="m in gremium.mitglieder" :key="m.id" class="liste-zeile">
          <label class="check grow" :class="{ aus: !darf(m) }">
            <input v-model="ziel[feld]" type="checkbox" :value="m.id" :disabled="!darf(m)" />
            <span>{{ m.name }}<span v-if="m.email" class="leise small"> · {{ m.email }}</span></span>
          </label>
          <button v-if="linksSichtbar && m.zugangsKey" type="button" class="btn btn-ghost" @click="kopieren(m)">{{ kopiert === m.id ? 'Kopiert ✓' : 'Link kopieren' }}</button>
          <button v-if="voll && linksSichtbar" type="button" class="btn btn-danger btn-icon" title="Ausladen" @click="entfernen(m)">✕</button>
        </div>
      </div>
      <form v-if="voll && linksSichtbar" class="row" @submit.prevent="einladen">
        <input v-model.trim="neu.name" class="input grow" placeholder="Name" required />
        <input v-model.trim="neu.email" class="input grow" type="email" placeholder="E-Mail (optional)" />
        <button class="btn btn-primary">Einladen</button>
        <InfoKnopf rechts text="Jede eingeladene Person erhält einen persönlichen Link. Gibt es ein Konto mit derselben E-Mail, erscheint die Kurzsitzung zudem in dessen Übersicht." />
      </form>
      <!-- Passende Konten als Vorschlag: ein Klick lädt die Person direkt ein -->
      <div v-if="vorschlaege.length" class="vorschlaege">
        <button v-for="k in vorschlaege" :key="k.email" type="button" class="vorschlag" @click="kontoEinladen(k)">
          <strong>{{ k.name }}</strong><span class="leise small">&nbsp;· {{ k.email }}</span>
        </button>
      </div>
    </div>
  `,
  data() {
    return { neu: { name: '', email: '' }, kopiert: '' }
  },
  computed: {
    // Konten als Vorschlag: der Superadmin kennt alle, sonst nur Konten aus gemeinsamen Gremien / Kurzsitzungen
    bekannteKonten() {
      if (sync.zugriff?.rolle === 'admin') return sync.konten.map(({ name, email }) => ({ name, email }))
      const konten = gremienStore.state.gremien.flatMap((g) => g.mitglieder.filter((m) => m.benutzerId && m.email).map(({ name, email }) => ({ name, email })))
      return [...new Map(konten.map((k) => [k.email.toLowerCase(), k])).values()]
    },
    vorschlaege() {
      const suche = (this.neu.name + ' ' + this.neu.email).trim().toLowerCase()
      if (!suche) return []
      const eingeladen = new Set(this.gremium.mitglieder.map((m) => (m.email || '').toLowerCase()))
      return this.bekannteKonten
        .filter((k) => !eingeladen.has(k.email.toLowerCase()) && suche.split(/\s+/).every((w) => (k.name + ' ' + k.email).toLowerCase().includes(w)))
        .slice(0, 6)
    },
  },
  methods: {
    kontoEinladen(konto) {
      this.neu = { name: konto.name, email: konto.email }
      this.einladen()
    },
    darf(m) {
      return this.voll || m.id === this.personId
    },
    einladen() {
      const mitglied = { id: crypto.randomUUID(), ...this.neu, rolleId: this.gremium.rollen.find((r) => !r.typ)?.id || null, hatStimmrecht: true, benutzerId: null, zugangsKey: neuerKey() }
      this.gremium.mitglieder.push(mitglied)
      this.ziel[this.feld].push(mitglied.id)
      this.neu = { name: '', email: '' }
    },
    entfernen(m) {
      if (!confirm(`${m.name} ausladen? Der persönliche Link wird damit ungültig.`)) return
      this.gremium.mitglieder = this.gremium.mitglieder.filter((x) => x.id !== m.id)
      this.ziel[this.feld] = this.ziel[this.feld].filter((id) => id !== m.id)
    },
    kopieren(m) {
      navigator.clipboard.writeText(location.href.split('#')[0] + '#/zugang/' + m.zugangsKey)
      this.kopiert = m.id
      setTimeout(() => (this.kopiert = ''), 2000)
    },
  },
}
