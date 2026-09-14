import { gremienStore } from '../stores/gremien.js'
import { sitzungenStore } from '../stores/sitzungen.js'
import { sync, recht } from '../stores/sync.js'
import { aktuellePerson, vollzugriff } from '../utils/rechte.js'
import { neuerKey } from '../utils/keys.js'
import { formatDatum } from '../utils/labels.js'
import GaesteListe from '../components/GaesteListe.js'
import MenuDropdown from '../components/MenuDropdown.js'
import PdfExportButton from '../components/PdfExportButton.js'
import SitzungKopfdaten from '../components/SitzungKopfdaten.js'
import TraktandenListe from '../components/TraktandenListe.js'

export default {
  name: 'VorprotokollEditor',
  components: { GaesteListe, MenuDropdown, PdfExportButton, SitzungKopfdaten, TraktandenListe },
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
            <p v-if="person && !voll" class="muted small mt-1">Bearbeitbar sind die dir zugewiesenen Traktanden (farbiger Rahmen) und deine Anwesenheit.</p>
            <p v-else-if="person && voll" class="muted small mt-1">Als Sitzungsleitung / Protokollführung hast du vollen Zugriff auf dieses Vorprotokoll.</p>
          </div>
          <div class="actions">
            <router-link v-if="darfProtokoll && sitzung.datum" :to="'/sitzung/' + sitzung.id + '/protokoll'" class="btn btn-primary">
              {{ sitzung.status === 'vorprotokoll' ? 'Sitzung starten →' : 'Zum Protokoll →' }}
            </router-link>
            <MenuDropdown>
              <PdfExportButton typ="vorprotokoll" :sitzung-id="sitzung.id" class="menu-item" />
              <button v-if="linksSichtbar" class="menu-item" @click="kopieren(vorprotokoll.freigabeLinkKey)">Allgemeinen Freigabe-Link kopieren</button>
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
        <p v-if="!nurLesen" class="muted small mb-2">Traktanden mit farbigem Rahmen kannst du anklicken und bearbeiten.</p>
        <TraktandenListe :traktanden="vorprotokoll.traktanden" :themenbereiche="gremium.themenbereiche" :personen="personen" :bearbeiter-auswahl="bearbeiterAuswahl" :nur-person="voll ? null : person" :nur-lesen="nurLesen" />
      </div>

      <details v-if="linksSichtbar" class="card aufklapp">
        <summary>Freigabe-Links <span class="sub">für Gäste und Externe</span></summary>
        <div class="inhalt">
          <p class="muted small mb-2">
            Mitglieder verwenden ihren persönlichen Link (Tab «Mitglieder & Rollen»). Gäste erhalten hier einen Link, mit dem sie ihre zugewiesenen
            Traktanden und die Terminfindung bearbeiten können. Der allgemeine Link erlaubt die Bearbeitung des ganzen Vorprotokolls.
          </p>
          <div class="zeilen" style="--spalten: auto 1fr auto">
            <div class="zeile">
              <strong>Allgemeiner Link</strong>
              <code class="leise truncate">{{ link(vorprotokoll.freigabeLinkKey) }}</code>
              <div class="aktionen"><button class="btn" @click="kopieren(vorprotokoll.freigabeLinkKey)">{{ kopiert === vorprotokoll.freigabeLinkKey ? 'Kopiert ✓' : 'Kopieren' }}</button></div>
            </div>
            <div v-for="g in vorprotokoll.gaeste.filter((g) => g.name)" :key="g.id" class="zeile">
              <span>{{ g.name }} <span class="leise">Gast</span></span>
              <code class="leise truncate">{{ link(vorprotokoll.personenKeys[g.id]) }}</code>
              <div class="aktionen"><button class="btn" @click="kopieren(vorprotokoll.personenKeys[g.id])">{{ kopiert === vorprotokoll.personenKeys[g.id] ? 'Kopiert ✓' : 'Kopieren' }}</button></div>
            </div>
          </div>
        </div>
      </details>
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
    voll() {
      return vollzugriff(this.sitzung, 'vorprotokoll')
    },
    darfProtokoll() {
      return vollzugriff(this.sitzung, 'protokoll')
    },
    // Gremium-Zugang mit Leserecht auf Sitzungen
    nurLesen() {
      return sync.zugriff?.rolle === 'gremium' && recht('sitzungen') !== 'bearbeiten'
    },
    // Links (Schlüssel) sind nur für Admin / Gremium-Zugang sichtbar
    linksSichtbar() {
      return ['admin', 'gremium'].includes(sync.zugriff?.rolle) && !this.nurLesen
    },
    zurueck() {
      const rolle = sync.zugriff?.rolle
      if (rolle === 'person') return '/meine'
      if (rolle === 'admin' || rolle === 'gremium') return '/gremium/' + this.gremium.id
      return ''
    },
    zurueckText() {
      return sync.zugriff?.rolle === 'person' ? 'Meine Übersicht' : this.gremium.name
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
        if (!this.linksSichtbar) return
        gaeste.forEach((g) => {
          if (!this.vorprotokoll.personenKeys[g.id]) this.vorprotokoll.personenKeys[g.id] = neuerKey()
        })
      },
    },
  },
  created() {
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
      return this.voll || (this.person && m.id === this.person.id)
    },
    rolleName(rolleId) {
      return gremienStore.rolleName(this.gremium.id, rolleId)
    },
    link(key) {
      return location.href.split('#')[0] + '#/freigabe/' + key
    },
    kopieren(key) {
      navigator.clipboard.writeText(this.link(key))
      this.kopiert = key
      setTimeout(() => (this.kopiert = ''), 2000)
    },
  },
}
