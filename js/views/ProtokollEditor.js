import { gremienStore } from '../stores/gremien.js'
import { sitzungenStore } from '../stores/sitzungen.js'
import { sync, speichern as serverSpeichern } from '../stores/sync.js'
import { aktuellePerson, vollzugriff, rolleIm, zurueckZu } from '../utils/rechte.js'
import { istBerechtigt, neuesTraktandum, personenText } from '../utils/traktanden.js'
import { PENDENZ_STATUS, SITZUNG_STATUS, SITZUNG_STATUS_KLASSE, formatDatum, sitzungStatus } from '../utils/labels.js'
import EintragListe from '../components/EintragListe.js'
import GaesteListe from '../components/GaesteListe.js'
import MenuDropdown from '../components/MenuDropdown.js'
import PdfExportButton from '../components/PdfExportButton.js'
import PersonInput from '../components/PersonInput.js'
import SitzungKopfdaten from '../components/SitzungKopfdaten.js'

export default {
  name: 'ProtokollEditor',
  components: { EintragListe, GaesteListe, MenuDropdown, PdfExportButton, PersonInput, SitzungKopfdaten },
  props: {
    sitzungId: { type: String, required: true },
  },
  template: `
    <div v-if="protokoll" class="stack-lg">
      <header class="page-header" style="margin-bottom: 0">
        <router-link :to="zurueck" class="rueck">← {{ zurueckText }}</router-link>
        <div class="kopf">
          <div>
            <p class="kicker">
              Protokoll · {{ formatDatum(sitzung.datum) }}
              <span class="badge" :class="SITZUNG_STATUS_KLASSE[sitzungStatus(sitzung)]" style="margin-left: 0.25rem">{{ SITZUNG_STATUS[sitzungStatus(sitzung)] }}</span>
            </p>
            <h1 class="title">{{ sitzung.titel || 'Sitzung' }}</h1>
            <p v-if="linkKopiert" class="small text-ok mt-1">Verfolger-Link kopiert – wer ihn öffnet, sieht das Protokoll live (nur lesen).</p>
            <p v-else-if="person && !voll" class="muted small mt-1">Bereiche mit farbigem Rahmen kannst du bearbeiten; alles andere ist nur lesbar.</p>
          </div>
          <div class="actions">
            <span class="small" :class="speicherKlasse" title="Ctrl+S speichert sofort">● {{ speicherText }}</span>
            <button v-if="voll && sitzung.status !== 'abgeschlossen'" class="btn btn-primary" @click="abschliessen">Sitzung abschliessen</button>
            <MenuDropdown>
              <button class="menu-item" @click="speichern">Jetzt speichern <span class="leise">Ctrl+S</span></button>
              <PdfExportButton typ="protokoll" :sitzung-id="sitzungId" class="menu-item" />
              <button v-if="linksSichtbar" class="menu-item" @click="verfolgerLinkKopieren">Verfolger-Link kopieren</button>
              <button class="menu-item" @click="$router.push('/sitzung/' + sitzungId + '/vorprotokoll')">Zum Vorprotokoll</button>
              <button v-if="voll && sitzung.status === 'abgeschlossen'" class="menu-item" @click="sitzung.status = 'laufend'">Sitzung wieder öffnen</button>
            </MenuDropdown>
          </div>
        </div>
      </header>

      <SitzungKopfdaten :sitzung="sitzung" :personen="personen" :nur-lesen="!voll" />

      <section class="card" :class="{ bearbeitbar: voll || person }">
        <h2 class="card-title">Anwesenheit</h2>
        <div class="row" style="gap: 0.25rem 1.5rem">
          <label v-for="m in gremium.mitglieder" :key="m.id" class="check" :class="{ aus: !darfAnwesenheit(m) }">
            <input v-model="protokoll.anwesende" type="checkbox" :value="m.id" :disabled="!darfAnwesenheit(m)" /> {{ m.name }}
          </label>
        </div>
        <p class="muted small mt-2">Abwesend / entschuldigt: {{ namen(abwesende) }}</p>
        <div class="row mt-3">
          <strong class="small">Gäste</strong>
          <GaesteListe :gaeste="protokoll.gaeste" :nur-lesen="!voll" />
        </div>
      </section>

      <!-- Traktanden mit Einträgen -->
      <section v-for="(t, i) in traktanden" :key="t.id" class="card" :class="{ bearbeitbar: darfTraktandum(t) }">
        <div class="traktandum-kopf">
          <span class="nr">{{ i + 1 }}.</span>
          <h2>{{ t.titel }}</h2>
          <span v-if="t.verantwortliche.length" class="muted small">{{ personenText(t.verantwortliche) }}</span>
          <span class="badge" :style="themenbereichStil(t.themenbereichId)">{{ themenbereichName(t.themenbereichId) }}</span>
        </div>
        <p v-if="t.notiz" class="notiz eingerueckt">{{ t.notiz }}</p>

        <div class="eingerueckt mt-2 stack-sm">
          <!-- Übertragene Pendenz aus früherer Sitzung (Status wird am Original aktualisiert) -->
          <div v-if="uebertragene[t.pendenzId]" class="pendenz-uebertragen stack-sm">
            <p>
              <span class="badge gelb" style="margin-right: 0.25rem">Übertragene Pendenz</span>
              <strong>{{ uebertragene[t.pendenzId].eintrag.titel }}</strong>
              <span class="muted">(aus Sitzung vom {{ formatDatum(uebertragene[t.pendenzId].sitzung.datum) }})</span>
            </p>
            <p v-if="uebertragene[t.pendenzId].eintrag.inhalt" class="muted">{{ uebertragene[t.pendenzId].eintrag.inhalt }}</p>
            <div class="row">
              <select v-model="uebertragene[t.pendenzId].eintrag.pendenzStatus" class="input w-sm" :disabled="!darfTraktandum(t)">
                <option v-for="(label, wert) in PENDENZ_STATUS" :key="wert" :value="wert">{{ label }}</option>
              </select>
              <PersonInput v-model="uebertragene[t.pendenzId].eintrag.zugewiesenAnName" v-model:person-id="uebertragene[t.pendenzId].eintrag.zugewiesenAn" :personen="personen" class="w-md" placeholder="Zugewiesen an" :disabled="!darfTraktandum(t)" />
              <input v-model="uebertragene[t.pendenzId].eintrag.faelligBis" type="date" class="input w-sm" title="Bis wann" :disabled="!darfTraktandum(t)" />
            </div>
          </div>

          <EintragListe :traktandum-id="t.id" :themenbereich-id="t.themenbereichId" :eintraege="protokoll.eintraege" :gremium="gremium" :personen="personen" :nur-lesen="!darfTraktandum(t)" :person-id="person?.id" />

          <div v-for="(u, j) in t.untertraktanden" :key="u.id" class="sub" :class="{ bearbeitbar: darfSub(t, u) && !darfTraktandum(t) }" :style="darfSub(t, u) && !darfTraktandum(t) ? 'padding: 0.5rem 0.75rem 0.5rem 1rem' : ''">
            <div class="sub-kopf">
              <span class="nr">{{ i + 1 }}.{{ j + 1 }}</span>
              <h3>{{ u.titel }}</h3>
              <span v-if="u.notiz" class="muted small">– {{ u.notiz }}</span>
              <span v-if="u.verantwortliche.length" class="ml-auto leise small">{{ personenText(u.verantwortliche) }}</span>
            </div>
            <div class="mt-1">
              <EintragListe :traktandum-id="u.id" :themenbereich-id="t.themenbereichId" :eintraege="protokoll.eintraege" :gremium="gremium" :personen="personen" :nur-lesen="!darfSub(t, u)" :person-id="person?.id" />
            </div>
          </div>
        </div>
      </section>

      <form v-if="voll || person" class="row" @submit.prevent="traktandumHinzufuegen">
        <input v-model.trim="neuesTraktandum" class="input grow" :placeholder="voll ? 'Weiteres Traktandum (z. B. Varia) …' : 'Eigenes Traktandum hinzufügen …'" required />
        <button class="btn">Hinzufügen</button>
      </form>

      <!-- Nächster Termin -->
      <section class="card" :class="{ bearbeitbar: voll }">
        <h2 class="card-title">Nächster Sitzungstermin</h2>
        <p v-if="naechsterTermin" class="row small">
          <strong>{{ formatDatum(naechsterTermin.datum) }}<span v-if="naechsterTermin.zeit">, {{ naechsterTermin.zeit }}</span> · {{ naechsterTermin.ort }}</strong>
          <router-link v-if="naechsterTermin.terminfindung?.status === 'offen'" :to="'/sitzung/' + naechsterTermin.id + '/terminfindung'">Terminfindung</router-link>
          <router-link :to="'/sitzung/' + naechsterTermin.id + '/vorprotokoll'">Vorprotokoll öffnen</router-link>
          <button v-if="voll" class="btn btn-ghost" @click="sitzung.naechsterTerminId = null">Ändern</button>
        </p>
        <p v-else-if="!voll" class="muted small">Noch nicht festgelegt.</p>
        <div v-else class="row">
          <select v-if="spaetereSitzungen.length" v-model="sitzung.naechsterTerminId" class="input w-lg">
            <option :value="null">Bestehenden Termin wählen …</option>
            <option v-for="s in spaetereSitzungen" :key="s.id" :value="s.id">{{ formatDatum(s.datum) }} {{ s.zeit }}</option>
          </select>
          <form class="row" @submit.prevent="terminErfassen">
            <label class="check small"><input v-model="neuerTermin.terminfindung" type="checkbox" /> Termin per Abstimmung finden</label>
            <template v-if="!neuerTermin.terminfindung">
              <input v-model="neuerTermin.datum" type="date" class="input w-sm" required />
              <input v-model="neuerTermin.zeit" type="time" class="input w-sm" />
            </template>
            <input v-model.trim="neuerTermin.ort" class="input w-md" placeholder="Ort" />
            <select v-model="neuerTermin.vorlageId" class="input w-md">
              <option value="">Leeres Vorprotokoll</option>
              <option v-for="v in gremium.vorlagen" :key="v.id" :value="v.id">Vorlage: {{ v.name }}</option>
            </select>
            <button class="btn btn-primary">Termin erfassen</button>
          </form>
        </div>
      </section>
    </div>
    <p v-else class="muted">Zu dieser Sitzung gibt es noch kein Protokoll.</p>
  `,
  data() {
    return {
      protokoll: null, // lokale Arbeitskopie, wird per Auto-Save in den Store geschrieben
      gespeichert: true,
      gespeichertUm: '',
      speicherTimer: null,
      neuesTraktandum: '',
      linkKopiert: false,
      neuerTermin: { datum: '', zeit: '', ort: '', vorlageId: '', terminfindung: false },
      SITZUNG_STATUS,
      SITZUNG_STATUS_KLASSE,
      PENDENZ_STATUS,
    }
  },
  computed: {
    sitzung() {
      return sitzungenStore.sitzungById(this.sitzungId)
    },
    gremium() {
      return gremienStore.byId(this.sitzung.gremiumId)
    },
    traktanden() {
      return sitzungenStore.vorprotokollVonSitzung(this.sitzungId)?.traktanden || []
    },
    person() {
      return aktuellePerson(this.gremium.id, this.protokoll?.gaeste || [])
    },
    voll() {
      return vollzugriff(this.sitzung, 'protokoll')
    },
    linksSichtbar() {
      return ['admin', 'gremium'].includes(rolleIm(this.gremium.id))
    },
    zurueck() {
      return zurueckZu(this.gremium.id).pfad
    },
    zurueckText() {
      return zurueckZu(this.gremium.id).text
    },
    personen() {
      return gremienStore.personen(this.gremium.id, this.protokoll.gaeste)
    },
    abwesende() {
      return gremienStore.erwarteteMitglieder(this.gremium.id).filter((m) => !this.protokoll.anwesende.includes(m.id)).map((m) => m.id)
    },
    uebertragene() {
      const map = {}
      this.traktanden
        .filter((t) => t.pendenzId)
        .forEach((t) => {
          const treffer = sitzungenStore.eintragById(t.pendenzId)
          if (treffer) map[t.pendenzId] = treffer
        })
      return map
    },
    naechsterTermin() {
      return sitzungenStore.sitzungById(this.sitzung.naechsterTerminId)
    },
    spaetereSitzungen() {
      return sitzungenStore.sitzungenVonGremium(this.gremium.id).filter((s) => s.id !== this.sitzung.id && (!s.datum || s.datum > this.sitzung.datum))
    },
    speicherText() {
      if (!this.gespeichert) return 'Ungespeicherte Änderungen'
      if (sync.status === 'fehler') return 'Fehler: ' + sync.fehler
      if (sync.ausstehend || sync.status === 'speichert') return 'Speichert …'
      return 'Gespeichert ' + this.gespeichertUm
    },
    speicherKlasse() {
      if (sync.status === 'fehler') return 'text-err'
      return this.gespeichert && !sync.ausstehend && sync.status === 'gespeichert' ? 'text-ok' : 'text-warn'
    },
  },
  watch: {
    protokoll: {
      deep: true,
      handler(neu, alt) {
        if (!alt) return // erstes Laden der Arbeitskopie
        this.gespeichert = false
        clearTimeout(this.speicherTimer)
        this.speicherTimer = setTimeout(this.speichern, 1500)
      },
    },
  },
  created() {
    if (this.voll && this.sitzung.datum) {
      if (!sitzungenStore.vorprotokollVonSitzung(this.sitzungId)) sitzungenStore.erstelleVorprotokoll(this.sitzungId)
      if (!sitzungenStore.protokollVonSitzung(this.sitzungId)) sitzungenStore.starteProtokoll(this.sitzungId)
    }
    const protokoll = sitzungenStore.protokollVonSitzung(this.sitzungId)
    if (protokoll) this.protokoll = JSON.parse(JSON.stringify(protokoll))
    this.gespeichertUm = this.uhrzeit()
  },
  mounted() {
    window.addEventListener('keydown', this.tastendruck)
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this.tastendruck)
    if (!this.gespeichert) this.speichern()
  },
  methods: {
    formatDatum,
    personenText,
    sitzungStatus,
    darfTraktandum(t) {
      return this.voll || (this.person && istBerechtigt(t, this.person))
    },
    darfSub(t, u) {
      return this.darfTraktandum(t) || (this.person && istBerechtigt(u, this.person))
    },
    darfAnwesenheit(m) {
      return this.voll || (this.person && m.id === this.person.id)
    },
    uhrzeit() {
      return new Date().toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })
    },
    tastendruck(event) {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault()
        this.speichern()
      }
    },
    speichern() {
      clearTimeout(this.speicherTimer)
      sitzungenStore.speichereProtokoll({ ...this.protokoll, abwesende: this.abwesende })
      this.gespeichert = true
      this.gespeichertUm = this.uhrzeit()
      serverSpeichern()
    },
    // Live-Ansicht (nur lesen) für Zuschauer
    verfolgerLinkKopieren() {
      navigator.clipboard.writeText(location.href.split('#')[0] + '#/verfolgen/' + this.protokoll.verfolgerKey)
      this.linkKopiert = true
      setTimeout(() => (this.linkKopiert = false), 3000)
    },
    abschliessen() {
      this.sitzung.status = 'abgeschlossen'
      this.speichern()
    },
    namen(ids) {
      return ids.map((id) => gremienStore.mitgliedName(this.gremium.id, id)).join(', ') || '–'
    },
    themenbereichName(id) {
      return this.gremium.themenbereiche.find((tb) => tb.id === id)?.name || 'Ohne Themenbereich'
    },
    themenbereichStil(id) {
      const tb = this.gremium.themenbereiche.find((tb) => tb.id === id)
      return tb ? { backgroundColor: tb.farbe + '1f', color: tb.farbe } : {}
    },
    // Ohne vollen Zugriff wird das neue Traktandum der eigenen Person zugewiesen (nur dann darf sie es anlegen)
    traktandumHinzufuegen() {
      const verantwortliche = this.voll ? [] : [{ id: this.person.id, name: this.person.name }]
      this.traktanden.push(neuesTraktandum({ titel: this.neuesTraktandum, reihenfolge: this.traktanden.length + 1, verantwortliche }))
      this.neuesTraktandum = ''
    },
    terminErfassen() {
      const termin = sitzungenStore.erstelleSitzung(this.gremium.id, this.neuerTermin)
      this.sitzung.naechsterTerminId = termin.id
      this.neuerTermin = { datum: '', zeit: '', ort: '', vorlageId: '', terminfindung: false }
    },
  },
}
