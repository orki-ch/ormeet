import { gremienStore } from '../stores/gremien.js'
import { sitzungenStore } from '../stores/sitzungen.js'
import { sync, recht } from '../stores/sync.js'
import { EINZELRECHTE, aktuellePerson, darfAenderungStellen, darfAufgabenBestimmen, darfEinladen, darfStarten, darfEigene, eigeneKennung, einzelrecht, istIndividuell, linksSichtbar, verwaltetSitzung, vollzugriff, rolleIm, zurueckZu, zuschnittSicht } from '../utils/rechte.js'
import { neuerKey } from '../utils/keys.js'
import { formatDatum } from '../utils/labels.js'
import { springeZu } from '../utils/springen.js'
import GaesteListe from '../components/GaesteListe.js'
import MenuDropdown from '../components/MenuDropdown.js'
import PdfExportButton from '../components/PdfExportButton.js'
import RechteFenster from '../components/RechteFenster.js'
import EinladungFenster from '../components/EinladungFenster.js'
import { einladungSymbol, hatAbgesagt } from '../utils/einladungen.js'
import SitzungKopfdaten from '../components/SitzungKopfdaten.js'
import TraktandenListe from '../components/TraktandenListe.js'
import { bestaetigen } from '../utils/dialog.js'

export default {
  name: 'VorprotokollEditor',
  components: { EinladungFenster, GaesteListe, MenuDropdown, PdfExportButton, RechteFenster, SitzungKopfdaten, TraktandenListe },
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
            <p v-else-if="individuell" class="muted small mt-1">Bearbeiten kannst du hier: {{ einzelrechteText || 'nichts – nur ansehen' }}.</p>
            <p v-else-if="istLink && !voll" class="muted small mt-1">Dieses Vorprotokoll ist über diesen Link nur zum Lesen freigegeben.</p>
            <p v-else-if="person && !voll && !eigene" class="muted small mt-1">Dieses Vorprotokoll ist für dich nur zum Lesen freigegeben.</p>
            <p v-else-if="person && !voll" class="muted small mt-1">Bearbeitbar sind die dir zugewiesenen Traktanden (farbiger Rahmen) und deine Anwesenheit.</p>
            <p v-else-if="person && voll" class="muted small mt-1">Als Sitzungsleitung / Protokollführung hast du vollen Zugriff auf dieses Vorprotokoll.</p>
          </div>
          <div class="actions">
            <button v-if="einladenMoeglich" type="button" class="btn" @click="einladungOffen = true">Einladung senden</button>
            <router-link v-if="(darfProtokoll || darfStarten(sitzung)) && sitzung.datum" :to="'/sitzung/' + sitzung.id + '/protokoll'" class="btn btn-primary">
              {{ sitzung.status === 'vorprotokoll' ? 'Sitzung starten →' : 'Zum Protokoll →' }}
            </router-link>
            <router-link v-else-if="aenderungMoeglich" :to="'/sitzung/' + sitzung.id + '/protokoll'" class="btn btn-primary">Zum Protokoll →</router-link>
            <MenuDropdown>
              <PdfExportButton typ="vorprotokoll" :sitzung-id="sitzung.id" class="menu-item" />
              <button v-if="linksSichtbar" class="menu-item" @click="kopieren(vorprotokoll.freigabeLinkKey)">Allgemeinen Freigabe-Link kopieren</button>
              <router-link v-if="zugriffeVerwalten" :to="'/sitzung/' + sitzung.id + '/zugriffe'" class="menu-item">Zugriffe verwalten</router-link>
              <button v-if="voll && !gesperrt" class="menu-item menu-item-danger" @click="zuruecksetzen">Vorprotokoll neu aufsetzen</button>
            </MenuDropdown>
          </div>
        </div>
      </header>

      <EinladungFenster v-if="einladungOffen" :sitzung-id="sitzung.id" @schliessen="einladungOffen = false" />

      <div v-if="sitzung.terminfindung?.status === 'offen'" class="banner">
        <div class="grow"><strong>Der Termin wird noch gefunden.</strong> <span class="muted small">Das Vorprotokoll kann bereits vorbereitet werden; das Protokoll erst, wenn der Termin feststeht.</span></div>
        <router-link :to="'/sitzung/' + sitzung.id + '/terminfindung'" class="btn btn-primary">Zur Terminfindung</router-link>
      </div>

      <SitzungKopfdaten :sitzung="sitzung" :personen="personen" :nur-lesen="!voll" :aufgaben-bestimmen="!gesperrt && darfAufgabenBestimmen(sitzung)" :anwesend="voll || darfAufgabenBestimmen(sitzung) ? anwesendeIds : null" />

      <div class="grid-2" style="gap: 2rem">
        <section class="card">
          <h2 class="card-title">Anwesenheit</h2>
          <p v-if="!gremium.mitglieder.length" class="muted small">Keine Mitglieder erfasst.</p>
          <div class="stack-sm">
            <label v-for="m in gremium.mitglieder" :key="m.id" class="check" :class="{ aus: !darfAnwesenheit(m) }">
              <input v-model="vorprotokoll.anwesendeMitgliederIds" type="checkbox" :value="m.id" :disabled="!darfAnwesenheit(m) || hatAbgesagt(gremium.id, sitzung.id, m.id)" />
              <span class="grow">{{ m.name }}<span v-if="einladungSymbol(gremium.id, sitzung.id, m.id)" class="einladung-symbol" :class="einladungSymbol(gremium.id, sitzung.id, m.id).klasse" :title="einladungSymbol(gremium.id, sitzung.id, m.id).titel" :aria-label="einladungSymbol(gremium.id, sitzung.id, m.id).titel" role="img"></span></span>
              <span class="leise small">{{ rolleName(m.rolleId) }}{{ m.hatStimmrecht ? '' : ' · ohne Stimmrecht' }}</span>
              <button v-if="personenLink(m.id)" type="button" class="btn btn-ghost btn-icon rechte-knopf" :title="kopiert === m.id ? 'Kopiert ✓' : 'Link von ' + m.name + ' kopieren'" @click.prevent="linkKopieren(m.id)"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg></button>
              <button v-if="rechteSetzen" type="button" class="btn btn-ghost btn-icon rechte-knopf" :class="{ gesetzt: hatIndividuell(m.id) }" :title="'Individuelle Rechte von ' + m.name" @click.prevent="rechteFuer = m.id"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10"/><path d="M18 7h2"/><circle cx="16" cy="7" r="2"/><path d="M4 17h4"/><path d="M12 17h8"/><circle cx="10" cy="17" r="2"/></svg></button>
            </label>
          </div>
        </section>

        <section class="card">
          <h2 class="card-title">Gäste</h2>
          <GaesteListe :gaeste="vorprotokoll.gaeste" :nur-lesen="!voll && !darfEinzeln('gaeste')" :rechte="rechteSetzen ? (gast) => (rechteFuer = gast.id) : null" :individuell="hatIndividuell" :link-kopieren="(gast) => personenLink(gast.id) && linkKopieren(gast.id)" :hat-link="(gast) => !!personenLink(gast.id)" :status="(gast) => einladungSymbol(gremium.id, sitzung.id, gast.id)" />
        </section>
      </div>

      <div>
        <p v-if="!nurLesen && eigene" class="muted small mb-2">Traktanden mit farbigem Rahmen kannst du anklicken und bearbeiten.</p>
        <TraktandenListe v-if="individuell" :traktanden="vorprotokoll.traktanden" :themenbereiche="gremium.themenbereiche" :personen="personen" :bearbeiter-auswahl="bearbeiterAuswahl"
          :nur-lesen="!zuschnitt && !darfEinzeln('traktandenBearbeiten') && !darfEinzeln('traktandenAendern') && !darfEinzeln('traktandenHinzufuegen')" :ohne-hinzufuegen="!darfEinzeln('traktandenHinzufuegen')"
          :ohne-loeschen="!zuschnitt && darfEinzeln('traktandenAendern') && !darfEinzeln('traktandenBearbeiten')"
          :darf-punkt="zuschnitt ? (t) => zuschnitt.punkt(t) || selbstHinzugefuegt(t) : darfEinzeln('traktandenBearbeiten') || darfEinzeln('traktandenAendern') ? null : selbstHinzugefuegt" :darf-unterpunkt="zuschnitt ? zuschnitt.punkt : null" :neu-von="kennung" />
        <TraktandenListe v-else :traktanden="vorprotokoll.traktanden" :themenbereiche="gremium.themenbereiche" :personen="personen" :bearbeiter-auswahl="bearbeiterAuswahl" :nur-person="voll ? null : person" :nur-lesen="nurLesen || !eigene" />
      </div>


      <RechteFenster v-if="rechteFuer" :sitzung="sitzung" :person-id="rechteFuer" @schliessen="rechteFuer = ''" />
    </div>

    <p v-else class="muted">Zu diesem Link wurde kein Vorprotokoll gefunden.</p>
  `,
  data() {
    return { kopiert: '', rechteFuer: '', einladungOffen: false }
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
    voll() {
      return !this.gesperrt && vollzugriff(this.sitzung, 'vorprotokoll')
    },
    // Einzelrechte («Individuell») über einen zusätzlichen Link oder eine persönliche Freigabe
    individuell() {
      return !this.gesperrt && istIndividuell(this.sitzung, 'vorprotokoll')
    },
    istLink() {
      return sync.zugriff?.rolle === 'link'
    },
    kennung() {
      return eigeneKennung(this.gremium.id) || ''
    },
    einzelrechteText() {
      return Object.entries(EINZELRECHTE.vorprotokoll).filter(([recht]) => this.darfEinzeln(recht)).map(([, label]) => label).join(', ')
    },
    // Eigene Traktanden bearbeiten (false bei Freigabe «Lesen»)
    eigene() {
      return !this.gesperrt && darfEigene(this.sitzung, 'vorprotokoll')
    },
    darfProtokoll() {
      return vollzugriff(this.sitzung, 'protokoll')
    },
    // Anwesende (Mitglieder und Gäste, ohne Absagen) für den Hinweis zu fehlenden Aufgaben
    anwesendeIds() {
      return [...this.vorprotokoll.anwesendeMitgliederIds, ...this.vorprotokoll.gaeste.filter((g) => !hatAbgesagt(this.gremium.id, this.sitzung.id, g.id)).map((g) => g.id)]
    },
    // Abgeschlossenes Protokoll, zu dem die Person Änderungen beantragen darf (z. B. anwesender Gast)
    aenderungMoeglich() {
      const protokoll = sitzungenStore.protokollVonSitzung(this.sitzung.id)
      return !!protokoll && darfAenderungStellen(this.sitzung, protokoll)
    },
    // Gremium-Zugang mit Leserecht auf Sitzungen
    nurLesen() {
      return rolleIm(this.gremium.id) === 'gremium' && recht('sitzungen', this.gremium.id) !== 'bearbeiten'
    },
    // Links (Schlüssel): Admin / Gremium-Zugang sowie Sitzungsleitung und Protokollführung dieser Sitzung
    linksSichtbar() {
      return linksSichtbar(this.sitzung) && !this.nurLesen
    },
    // Einladung per E-Mail: wer die Sitzung verwaltet, sobald der Termin feststeht und bis die Sitzung beginnt
    einladenMoeglich() {
      return darfEinladen(this.sitzung) && !!this.sitzung.datum && !this.gesperrt && !this.sitzung.kurz
    },
    zugriffeVerwalten() {
      return verwaltetSitzung(this.sitzung)
    },
    // Individuelle Rechte setzen darf, wer die Freigaben des Vorprotokolls setzt (Zugriffsübersicht, Rechte-Fenster)
    rechteSetzen() {
      return this.voll && !this.nurLesen && !this.istLink
    },
    // Eigene Regeln (individuelle Rechte): welche Traktanden bearbeitbar sind
    zuschnitt() {
      return this.gesperrt ? null : zuschnittSicht(this.sitzung)
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
    einladungSymbol,
    hatAbgesagt,
    darfAufgabenBestimmen,
    darfStarten,
    sitzungenStoreDarfAnlegen() {
      return vollzugriff(sitzungenStore.sitzungById(this.sitzungId), 'vorprotokoll')
    },
    darfAnwesenheit(m) {
      return this.voll || this.darfEinzeln('anwesenheit') || (this.eigene && this.person && m.id === this.person.id)
    },
    // Persönlicher Link einer Person (Mitglied: zentraler Link, Gast: Gast-Link), sofern der eigene Zugang ihn sieht
    personenLink(personId) {
      const m = this.gremium.mitglieder.find((x) => x.id === personId)
      const key = m ? m.zugangsKey : this.vorprotokoll.personenKeys?.[personId]
      return key ? location.href.split('#')[0] + (m ? '#/zugang/' : '#/freigabe/') + key : ''
    },
    linkKopieren(personId) {
      navigator.clipboard.writeText(this.personenLink(personId))
      this.kopiert = personId
      setTimeout(() => (this.kopiert = ''), 2000)
    },
    hatIndividuell(personId) {
      return Array.isArray(this.sitzung.freigaben?.vorprotokoll?.[personId]) || !!this.sitzung.zuschnitt?.[personId]
    },
    darfEinzeln(recht) {
      return !this.gesperrt && einzelrecht(this.sitzung, 'vorprotokoll', recht)
    },
    selbstHinzugefuegt(t) {
      return !!this.kennung && t.hinzugefuegtVon === this.kennung
    },
    rolleName(rolleId) {
      return gremienStore.rolleName(this.gremium.id, rolleId)
    },
    link(key) {
      return location.href.split('#')[0] + '#/freigabe/' + key
    },
    // Vorprotokoll löschen und wie beim Anlegen der Sitzung neu aufsetzen (Vorlage, Anwesenheit, Pendenzen / Anträge an ihrem Ort)
    async zuruecksetzen() {
      if (!(await bestaetigen('Dieses Vorprotokoll löschen und neu aufsetzen? Traktanden, Anwesenheit und Gäste werden wie beim Anlegen der Sitzung neu erstellt; offene Pendenzen und vertagte Anträge werden dabei wieder an ihrem bisherigen Ort eingefügt.', { gefahr: true }))) return
      sitzungenStore.setzeVorprotokollZurueck(this.sitzung.id)
    },
    kopieren(key) {
      navigator.clipboard.writeText(this.link(key))
      this.kopiert = key
      setTimeout(() => (this.kopiert = ''), 2000)
    },
  },
}
