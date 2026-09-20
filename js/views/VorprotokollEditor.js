import { gremienStore } from '../stores/gremien.js'
import { sitzungenStore } from '../stores/sitzungen.js'
import { sync, recht } from '../stores/sync.js'
import { aktuellePerson, darfEigene, vollzugriff, rolleIm, zurueckZu } from '../utils/rechte.js'
import { neuerKey } from '../utils/keys.js'
import { formatDatum } from '../utils/labels.js'
import { springeZu } from '../utils/springen.js'
import GaesteListe from '../components/GaesteListe.js'
import MenuDropdown from '../components/MenuDropdown.js'
import PdfExportButton from '../components/PdfExportButton.js'
import SitzungKopfdaten from '../components/SitzungKopfdaten.js'
import TeilenKarte from '../components/TeilenKarte.js'
import TraktandenListe from '../components/TraktandenListe.js'

export default {
  name: 'VorprotokollEditor',
  components: { GaesteListe, MenuDropdown, PdfExportButton, SitzungKopfdaten, TeilenKarte, TraktandenListe },
  props: {
    sitzungId: { type: String, default: '' },
    freigabeLinkKey: { type: String, default: '' },
  },
  template: `
    <div v-if="vorprotokoll" class="stack-lg">
      <header class="page-header" style="margin-bottom: 0">
        <router-link v-if="zurueck" :to="zurueck" class="rueck">← {{ zurueckText }}</router-link>
        <div class="kopf">
          <div>
            <p class="kicker">Vorprotokoll · {{ gremium.name }} · {{ formatDatum(sitzung.datum) }}</p>
            <h1 class="title">{{ sitzung.titel || 'Sitzung' }}</h1>
            <p v-if="sitzung.genehmigt" class="small text-ok mt-1">Das Protokoll dieser Sitzung wurde am {{ formatDatum(sitzung.genehmigt.datum) }} genehmigt – Vorprotokoll und Protokoll können nicht mehr bearbeitet werden.</p>
            <p v-else-if="gesperrt" class="muted small mt-1">Zu dieser Sitzung gibt es bereits ein Protokoll – das Vorprotokoll ist damit abgeschlossen und kann nicht mehr bearbeitet werden.<span v-if="darfProtokoll"> Änderungen sind erst wieder möglich, wenn das Protokoll entfernt wird (im Protokoll über ⋯).</span></p>
            <p v-else-if="person && !voll && !eigene" class="muted small mt-1">Dieses Vorprotokoll ist für dich nur zum Lesen freigegeben.</p>
            <p v-else-if="person && !voll" class="muted small mt-1">Bearbeitbar sind die dir zugewiesenen Traktanden (farbiger Rahmen) und deine Anwesenheit.</p>
            <p v-else-if="person && voll" class="muted small mt-1">Als Sitzungsleitung / Protokollführung hast du vollen Zugriff auf dieses Vorprotokoll.</p>
          </div>
          <div class="actions">
            <router-link v-if="darfProtokoll && sitzung.datum" :to="'/sitzung/' + sitzung.id + '/protokoll'" class="btn btn-primary">
              {{ sitzung.status === 'vorprotokoll' ? 'Sitzung starten →' : 'Zum Protokoll →' }}
            </router-link>
            <MenuDropdown>
              <PdfExportButton typ="vorprotokoll" :sitzung-id="sitzung.id" class="menu-item" />
              <button v-if="linksSichtbar" class="menu-item" @click="kopieren(vorprotokoll.freigabeLinkKey)">Allgemeinen Freigabe-Link kopieren</button>
              <button v-if="voll && !gesperrt && vorherigeMitVorprotokoll" class="menu-item menu-item-danger" @click="vonVorherigerZusammenstellen">Vorprotokoll neu von vorheriger Sitzung zusammenstellen</button>
            </MenuDropdown>
          </div>
        </div>
      </header>

      <div v-if="sitzung.terminfindung?.status === 'offen'" class="banner">
        <div class="grow"><strong>Der Termin wird noch gefunden.</strong> <span class="muted small">Das Vorprotokoll kann bereits vorbereitet werden; das Protokoll erst, wenn der Termin feststeht.</span></div>
        <router-link :to="'/sitzung/' + sitzung.id + '/terminfindung'" class="btn btn-primary">Zur Terminfindung</router-link>
      </div>

      <SitzungKopfdaten :sitzung="sitzung" :personen="personen" :nur-lesen="!voll" />

      <div class="grid-2" style="gap: 2rem">
        <section class="card">
          <h2 class="card-title">Anwesenheit</h2>
          <p v-if="!gremium.mitglieder.length" class="muted small">Keine Mitglieder erfasst.</p>
          <div class="stack-sm">
            <label v-for="m in gremium.mitglieder" :key="m.id" class="check" :class="{ aus: !darfAnwesenheit(m) }">
              <input v-model="vorprotokoll.anwesendeMitgliederIds" type="checkbox" :value="m.id" :disabled="!darfAnwesenheit(m)" />
              <span class="grow">{{ m.name }}</span>
              <span class="leise small">{{ rolleName(m.rolleId) }}{{ m.hatStimmrecht ? '' : ' · ohne Stimmrecht' }}</span>
            </label>
          </div>
        </section>

        <section class="card">
          <h2 class="card-title">Gäste</h2>
          <GaesteListe :gaeste="vorprotokoll.gaeste" :nur-lesen="!voll" />
        </section>
      </div>

      <div>
        <p v-if="!nurLesen && eigene" class="muted small mb-2">Traktanden mit farbigem Rahmen kannst du anklicken und bearbeiten.</p>
        <TraktandenListe :traktanden="vorprotokoll.traktanden" :themenbereiche="gremium.themenbereiche" :personen="personen" :bearbeiter-auswahl="bearbeiterAuswahl" :nur-person="voll ? null : person" :nur-lesen="nurLesen || !eigene" />
      </div>

      <TeilenKarte :sitzung="sitzung" dokument="vorprotokoll" :vorprotokoll="vorprotokoll" :darf-setzen="voll && !nurLesen" :links-sichtbar="linksSichtbar" />

    </div>

    <p v-else class="muted">Zu diesem Link wurde kein Vorprotokoll gefunden.</p>
  `,
  data() {
    return { kopiert: '' }
  },
  computed: {
    vorprotokoll() {
      if (!this.freigabeLinkKey) return sitzungenStore.vorprotokollVonSitzung(this.sitzungId)
      return (
        sitzungenStore.vorprotokollByKey(this.freigabeLinkKey) ||
        sitzungenStore.vorprotokollByPersonKey(this.freigabeLinkKey) ||
        sitzungenStore.vorprotokollById(sync.zugriff?.vorprotokollId)
      )
    },
    sitzung() {
      return sitzungenStore.sitzungById(this.vorprotokoll.sitzungId)
    },
    gremium() {
      return gremienStore.byId(this.sitzung.gremiumId)
    },
    person() {
      return aktuellePerson(this.gremium.id, this.vorprotokoll.gaeste)
    },
    // Sobald ein Protokoll existiert, steht das Vorprotokoll fest (formell: die Traktandenliste ist verschickt und die
    // Sitzung hat begonnen) – bearbeitbar wird es erst wieder, wenn das Protokoll entfernt wird
    gesperrt() {
      return !!sitzungenStore.protokollVonSitzung(this.sitzung.id)
    },
    vorherigeMitVorprotokoll() {
      const vorherige = sitzungenStore.vorherigeSitzung(this.sitzung.id)
      return vorherige ? sitzungenStore.vorprotokollVonSitzung(vorherige.id) : null
    },
    voll() {
      return !this.gesperrt && vollzugriff(this.sitzung, 'vorprotokoll')
    },
    // Eigene Traktanden bearbeiten (false bei Freigabe «Lesen»)
    eigene() {
      return !this.gesperrt && darfEigene(this.sitzung, 'vorprotokoll')
    },
    darfProtokoll() {
      return vollzugriff(this.sitzung, 'protokoll')
    },
    // Gremium-Zugang mit Leserecht auf Sitzungen
    nurLesen() {
      return rolleIm(this.gremium.id) === 'gremium' && recht('sitzungen', this.gremium.id) !== 'bearbeiten'
    },
    // Links (Schlüssel) sind nur für Admin / Gremium-Zugang sichtbar
    linksSichtbar() {
      return ['admin', 'gremium'].includes(rolleIm(this.gremium.id)) && !this.nurLesen
    },
    zurueck() {
      return zurueckZu(this.gremium.id).pfad
    },
    zurueckText() {
      return zurueckZu(this.gremium.id).text
    },
    personen() {
      return gremienStore.personen(this.gremium.id, this.vorprotokoll.gaeste)
    },
    bearbeiterAuswahl() {
      return gremienStore.bearbeiterAuswahl(this.gremium.id, this.vorprotokoll.gaeste)
    },
  },
  watch: {
    // Für jeden Gast einen persönlichen Link bereithalten (Mitglieder haben ihren zentralen Link)
    'vorprotokoll.gaeste': {
      immediate: true,
      deep: true,
      handler(gaeste) {
        if (!gaeste || !this.linksSichtbar) return // Vorprotokoll wird erst in created() angelegt
        gaeste.forEach((g) => {
          if (!this.vorprotokoll.personenKeys[g.id]) this.vorprotokoll.personenKeys[g.id] = neuerKey()
        })
      },
    },
  },
  mounted() {
    springeZu(this.$route.query.zu) // Treffer aus der Suche
  },
  created() {
    if (this.sitzungId && this.sitzungenStoreDarfAnlegen()) sitzungenStore.bereinigeProtokollOhneTermin(this.sitzungId)
    if (!this.vorprotokoll && this.sitzungId && this.sitzungenStoreDarfAnlegen()) sitzungenStore.erstelleVorprotokoll(this.sitzungId)
    // Bei jedem Öffnen neu hinzugekommene offene Pendenzen nachziehen
    if (this.vorprotokoll && this.voll) sitzungenStore.uebernimmPendenzen(this.vorprotokoll.id)
  },
  methods: {
    formatDatum,
    sitzungenStoreDarfAnlegen() {
      return vollzugriff(sitzungenStore.sitzungById(this.sitzungId), 'vorprotokoll')
    },
    darfAnwesenheit(m) {
      return this.voll || (this.eigene && this.person && m.id === this.person.id)
    },
    rolleName(rolleId) {
      return gremienStore.rolleName(this.gremium.id, rolleId)
    },
    link(key) {
      return location.href.split('#')[0] + '#/freigabe/' + key
    },
    // Ganzes Vorprotokoll von der letzten Sitzung neu aufbauen; Pendenzen und vertagte Anträge landen an ihrem bisherigen Ort
    vonVorherigerZusammenstellen() {
      const vorherige = sitzungenStore.vorherigeSitzung(this.sitzung.id)
      if (!confirm(`Dieses Vorprotokoll löschen und neu von der Sitzung vom ${formatDatum(vorherige.datum)} zusammenstellen? Kopfdaten, Anwesenheit, Gäste und alle Traktanden werden ersetzt; offene Pendenzen und vertagte Anträge werden an ihrem bisherigen Ort eingefügt.`)) return
      sitzungenStore.neuVonVorheriger(this.sitzung.id)
    },
    kopieren(key) {
      navigator.clipboard.writeText(this.link(key))
      this.kopiert = key
      setTimeout(() => (this.kopiert = ''), 2000)
    },
  },
}
