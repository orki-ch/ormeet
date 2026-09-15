import { BEREICHE, ROLLEN_TYPEN, gremienStore, neuerZugang } from '../stores/gremien.js'
import { sitzungenStore } from '../stores/sitzungen.js'
import { sync, recht, gremiumLoeschen } from '../stores/sync.js'
import { rolleIm } from '../utils/rechte.js'
import { bearbeitenMixin } from '../utils/bearbeiten.js'
import { neuerKey } from '../utils/keys.js'
import { SITZUNG_STATUS, SITZUNG_STATUS_KLASSE, formatDatum, sitzungStatus } from '../utils/labels.js'
import GremiumSuche from '../components/GremiumSuche.js'
import MenuDropdown from '../components/MenuDropdown.js'
import Modal from '../components/Modal.js'
import PersonenInput from '../components/PersonenInput.js'
import ThemenbereichLinks from '../components/ThemenbereichLinks.js'
import TraktandenListe from '../components/TraktandenListe.js'

const TABS = { ...BEREICHE, teilen: 'Teilen' }
const RECHTE = { keine: 'Nicht sichtbar', lesen: 'Nur lesen', bearbeiten: 'Bearbeiten' }

export default {
  name: 'GremiumDetail',
  components: { GremiumSuche, MenuDropdown, Modal, PersonenInput, ThemenbereichLinks, TraktandenListe },
  mixins: [bearbeitenMixin],
  props: {
    gremiumId: { type: String, required: true },
  },
  template: `
    <div v-if="gremium" class="stack-lg">
      <header class="page-header" style="margin-bottom: 0">
        <router-link v-if="sync.zugriff?.rolle !== 'gremium'" to="/" class="rueck">← Alle Gremien</router-link>
        <div class="row-nowrap top between">
          <div class="grow" style="max-width: 40rem">
            <input v-model.trim="gremium.name" class="input-inline title" :disabled="!darf('einstellungen')" />
            <input v-model.trim="gremium.beschreibung" class="input-inline muted mt-1" placeholder="Beschreibung" :disabled="!darf('einstellungen')" />
          </div>
          <MenuDropdown v-if="istAdmin">
            <button class="menu-item menu-item-danger" @click="loeschen">Gremium löschen</button>
          </MenuDropdown>
        </div>

        <nav class="tabs">
          <button v-for="(label, id) in sichtbareTabs" :key="id" class="tab" :class="{ aktiv: tab === id }" @click="tab = id">{{ label }}</button>
        </nav>
      </header>

      <!-- Tab: Sitzungen -->
      <GremiumSuche v-if="tab === 'sitzungen'" :gremium-id="gremiumId" />
      <fieldset v-if="tab === 'sitzungen'" :disabled="!darf('sitzungen')" class="card">
        <div class="card-head">
          <h2 class="card-title">Sitzungen</h2>
          <button v-if="darf('sitzungen')" class="btn btn-primary" @click="sitzungDialog = true">+ Sitzung</button>
        </div>
        <p v-if="!sitzungen.length" class="muted small">Noch keine Sitzungen erfasst.</p>
        <div v-else class="zeilen" style="--spalten: auto 2fr auto 1fr">
          <div v-for="s in sitzungen" :key="s.id" class="zeile">
            <span class="nowrap"><strong :class="{ 'text-warn': !s.datum }">{{ formatDatum(s.datum) }}</strong><span class="leise"> {{ s.zeit }}</span></span>
            <span>{{ s.titel }}<span v-if="s.ort" class="leise"> · {{ s.ort }}</span></span>
            <span><span class="badge" :class="SITZUNG_STATUS_KLASSE[sitzungStatus(s)]">{{ SITZUNG_STATUS[sitzungStatus(s)] }}</span><span v-if="s.genehmigt" class="badge gruen" style="margin-left: 0.25rem" title="Protokoll genehmigt">✓</span></span>
            <div class="aktionen">
              <router-link v-if="s.terminfindung?.status === 'offen'" :to="'/sitzung/' + s.id + '/terminfindung'" class="btn btn-ghost">Terminfindung</router-link>
              <router-link :to="'/sitzung/' + s.id + '/vorprotokoll'" class="btn btn-ghost">Vorprotokoll</router-link>
              <router-link v-if="s.datum && (s.status === 'laufend' || s.status === 'abgeschlossen')" :to="'/sitzung/' + s.id + '/protokoll'" class="btn btn-ghost">Protokoll</router-link>
              <MenuDropdown v-if="darf('sitzungen')">
                <button class="menu-item menu-item-danger" @click="sitzungLoeschen(s)">Sitzung löschen</button>
              </MenuDropdown>
            </div>
          </div>
        </div>
      </fieldset>
      <ThemenbereichLinks v-if="tab === 'sitzungen'" :gremium="gremium" />

      <!-- Tab: Mitglieder & Rollen -->
      <fieldset v-if="tab === 'mitglieder'" :disabled="!darf('mitglieder')" class="grid-2-1">
        <section class="card">
          <div class="card-head">
            <h2 class="card-title">Mitglieder</h2>
            <button v-if="darf('mitglieder')" class="btn" @click="mitgliedBearbeiten()">+ Mitglied</button>
          </div>
          <p v-if="!gremium.mitglieder.length" class="muted small">Noch keine Mitglieder.</p>
          <div class="liste">
            <div v-for="m in gremium.mitglieder" :key="m.id" class="liste-zeile small" :class="{ klick: darf('mitglieder') }" @click="darf('mitglieder') && mitgliedBearbeiten(m)">
              <span class="grow"><strong>{{ m.name }}</strong><span v-if="m.email" class="leise"> · {{ m.email }}</span></span>
              <span class="muted">{{ rolleName(m.rolleId) }}</span>
              <span class="small nowrap" :class="m.hatStimmrecht ? 'text-ok' : 'leise'">{{ m.hatStimmrecht ? '✓ Stimmrecht' : 'ohne Stimmrecht' }}</span>
            </div>
          </div>
        </section>

        <section class="card">
          <h2 class="card-title">Rollen</h2>
          <div class="liste">
            <div v-for="r in gremium.rollen" :key="r.id">
              <div v-if="aktiv === r.id" class="block-soft stack-sm" style="margin: 0.25rem 0">
                <div class="row">
                  <input v-model.trim="r.name" class="input grow" />
                  <button v-if="!r.typ" class="btn btn-danger btn-icon" @click="rolleEntfernen(r)">✕</button>
                  <button class="btn" @click="aktiv = null">Fertig</button>
                </div>
                <p v-if="r.typ" class="leise small">Feste Rolle «{{ ROLLEN_TYPEN[r.typ] }}»: wird bei neuen Sitzungen automatisch eingesetzt und hat dort vollen Zugriff. Kann umbenannt, aber nicht gelöscht werden.</p>
                <label class="check small"><input v-model="r.sollAnwesend" type="checkbox" /> An Sitzungen erwartet</label>
                <p class="leise small">Nicht erwartete Rollen sind standardmässig nicht als anwesend markiert und erscheinen nicht bei den Entschuldigten.</p>
              </div>
              <div v-else class="liste-zeile small" :class="{ klick: darf('mitglieder') }" @click="darf('mitglieder') && (aktiv = r.id)">
                <span class="grow">{{ r.name }}</span>
                <span v-if="r.typ" class="badge brand">{{ ROLLEN_TYPEN[r.typ] }}</span>
                <span v-if="r.sollAnwesend === false" class="leise">nicht erwartet</span>
              </div>
            </div>
          </div>
          <form v-if="darf('mitglieder')" class="row mt-2" @submit.prevent="rolleHinzufuegen">
            <input v-model.trim="neueRolle" class="input grow" placeholder="Neue Rolle …" required />
            <button class="btn btn-icon">+</button>
          </form>
        </section>
      </fieldset>

      <!-- Tab: Protokoll-Einstellungen -->
      <fieldset v-if="tab === 'einstellungen'" :disabled="!darf('einstellungen')" class="stack-lg">
        <section class="card">
          <h2 class="card-title">Themenbereiche</h2>
          <p class="hint">Ordnen Traktanden und Einträge thematisch; pro Themenbereich gibt es eine historische Übersicht.</p>
          <div class="liste">
            <div v-for="tb in gremium.themenbereiche" :key="tb.id">
              <div v-if="aktiv === tb.id" class="row" style="margin: 0.25rem 0">
                <input v-model="tb.farbe" type="color" class="farbe" />
                <input v-model.trim="tb.name" class="input grow" />
                <button class="btn btn-danger btn-icon" @click="entfernen(gremium.themenbereiche, tb); aktiv = null">✕</button>
                <button class="btn" @click="aktiv = null">Fertig</button>
              </div>
              <div v-else class="liste-zeile small" :class="{ klick: darf('einstellungen') }" @click="darf('einstellungen') && (aktiv = tb.id)">
                <span class="farbpunkt" :style="{ backgroundColor: tb.farbe }"></span>
                <span class="grow">{{ tb.name }}</span>
                <router-link :to="'/gremium/' + gremium.id + '/themenbereich/' + tb.id" class="btn btn-ghost" @click.stop>Übersicht</router-link>
              </div>
            </div>
          </div>
          <form v-if="darf('einstellungen')" class="row mt-2" @submit.prevent="themenbereichHinzufuegen">
            <input v-model="neuerThemenbereich.farbe" type="color" class="farbe" />
            <input v-model.trim="neuerThemenbereich.name" class="input grow" placeholder="Neuer Themenbereich …" required />
            <button class="btn btn-icon">+</button>
          </form>
        </section>

        <section class="card">
          <h2 class="card-title">Vorprotokoll-Vorlagen</h2>
          <p class="hint">Beim Erfassen einer Sitzung wählbar. Kopfdaten und Traktanden werden ins Vorprotokoll übernommen.</p>

          <details v-for="v in gremium.vorlagen" :key="v.id" class="vorlage">
            <summary>{{ v.name }} <span class="sub">{{ v.traktanden.length }} Traktanden</span></summary>
            <div class="inhalt stack">
              <div class="grid-2">
                <div><span class="label">Name der Vorlage</span><input v-model.trim="v.name" class="input" /></div>
                <div><span class="label">Titel / Sitzungsgrund</span><input v-model.trim="v.titel" class="input" /></div>
                <div><span class="label">Sitzungsleitung</span><PersonenInput v-model="v.sitzungsleitung" :personen="personen" placeholder="Name eingeben oder wählen (leer = Präsidium)" /></div>
                <div><span class="label">Protokollführung</span><PersonenInput v-model="v.protokollfuehrung" :personen="personen" placeholder="Name eingeben oder wählen (leer = Aktuariat)" /></div>
                <div class="span-alle"><span class="label">Spezielles / Bemerkungen</span><input v-model.trim="v.bemerkungen" class="input" /></div>
              </div>
              <h3>Traktanden</h3>
              <TraktandenListe :traktanden="v.traktanden" :themenbereiche="gremium.themenbereiche" :personen="personen" :bearbeiter-auswahl="bearbeiterAuswahl" :nur-lesen="!darf('einstellungen')" />

              <div v-if="darf('einstellungen') && sitzungenOhneProtokoll.length" class="block-soft stack-sm">
                <h3 style="margin: 0">Auf bestehende Sitzungen anwenden</h3>
                <p class="small muted">Hat sich die Vorlage geändert, kannst du sie auf Sitzungen übertragen, die noch kein Protokoll haben. Kopfdaten und Traktanden des Vorprotokolls werden dabei durch die Vorlage ersetzt; automatisch übernommene Pendenzen und vertagte Anträge bleiben.</p>
                <div class="row" style="gap: 0.25rem 1.5rem">
                  <label v-for="s in sitzungenOhneProtokoll" :key="s.id" class="check small">
                    <input v-model="anwendenAuf[v.id]" type="checkbox" :value="s.id" /> {{ formatDatum(s.datum) }}<span class="leise"> {{ s.titel }}{{ s.vorlageId === v.id ? ' · mit dieser Vorlage erfasst' : '' }}</span>
                  </label>
                </div>
                <div class="row">
                  <button class="btn btn-ghost" @click="alleWaehlen(v)">{{ anwendenAuf[v.id].length === sitzungenOhneProtokoll.length ? 'Keine' : 'Alle' }} wählen</button>
                  <button class="btn btn-primary" :disabled="!anwendenAuf[v.id].length" @click="vorlageAnwenden(v)">Vorlage auf {{ anwendenAuf[v.id].length }} {{ anwendenAuf[v.id].length === 1 ? 'Sitzung' : 'Sitzungen' }} anwenden</button>
                  <span v-if="angewendet === v.id" class="small text-ok">Angewendet ✓</span>
                </div>
              </div>

              <div v-if="darf('einstellungen')"><button class="btn btn-danger" @click="entfernen(gremium.vorlagen, v)">Vorlage löschen</button></div>
            </div>
          </details>

          <form v-if="darf('einstellungen')" class="row mt-2" @submit.prevent="vorlageHinzufuegen">
            <input v-model.trim="neueVorlage" class="input grow" placeholder="Name der neuen Vorlage (z. B. OK-Sitzung) …" required />
            <button class="btn">+ Vorlage</button>
          </form>
        </section>

        <section class="card">
          <h2 class="card-title">Fusstext</h2>
          <p class="hint">Erscheint am Ende jedes Protokolls.</p>
          <textarea v-model.trim="gremium.fusstext" class="input" rows="2"></textarea>
        </section>
      </fieldset>

      <!-- Tab: Teilen (nur Superadmin) -->
      <section v-if="tab === 'teilen'" class="card">
        <h2 class="card-title">Gremium teilen</h2>
        <p class="hint">Jeder Link hat eigene Rechte pro Bereich. Wer ihn öffnet, sieht nur die freigegebenen Bereiche und kann nur dort ändern, wo «Bearbeiten» gesetzt ist.</p>

        <div v-for="z in gremium.zugaenge" :key="z.id" class="block-soft stack-sm mb-2">
          <div class="row">
            <input v-model.trim="z.name" class="input grow" placeholder="Bezeichnung (z. B. Aktuariat)" />
            <button class="btn" @click="linkKopieren(z)">{{ kopiert === z.id ? 'Kopiert ✓' : 'Link kopieren' }}</button>
            <MenuDropdown>
              <button class="menu-item" @click="linkErneuern(z)">Link erneuern</button>
              <button class="menu-item menu-item-danger" @click="entfernen(gremium.zugaenge, z)">Link löschen</button>
            </MenuDropdown>
          </div>
          <code class="leise small truncate">{{ zugangsLink(z) }}</code>
          <div class="grid-3">
            <div v-for="(label, bereich) in BEREICHE" :key="bereich">
              <span class="label">{{ label }}</span>
              <select v-model="z.rechte[bereich]" class="input">
                <option v-for="(text, wert) in RECHTE" :key="wert" :value="wert">{{ text }}</option>
              </select>
            </div>
          </div>
        </div>
        <p v-if="!gremium.zugaenge.length" class="muted small mb-2">Noch keine Links.</p>

        <form class="row" @submit.prevent="zugangHinzufuegen">
          <input v-model.trim="neuerZugangName" class="input grow" placeholder="Bezeichnung des neuen Links (z. B. Aktuariat, Vorstand) …" required />
          <button class="btn btn-primary">+ Link</button>
        </form>
      </section>

      <!-- Dialog: Mitglied -->
      <Modal v-if="mitglied" :titel="mitglied.id ? 'Mitglied bearbeiten' : 'Neues Mitglied'" @schliessen="mitglied = null">
        <form class="stack" @submit.prevent="mitgliedSpeichern">
          <div><span class="label">Name</span><input v-model.trim="mitglied.name" class="input" required autofocus /></div>
          <div><span class="label">E-Mail</span><input v-model.trim="mitglied.email" class="input" type="email" /></div>
          <div>
            <span class="label">Rolle</span>
            <select v-model="mitglied.rolleId" class="input">
              <option v-for="r in gremium.rollen" :key="r.id" :value="r.id">{{ r.name }}</option>
            </select>
          </div>
          <label class="check"><input v-model="mitglied.hatStimmrecht" type="checkbox" /> Stimmberechtigt</label>
          <div v-if="istSuperadmin" class="block-soft stack-sm">
            <span class="label" style="margin: 0">Konto</span>
            <select v-model="mitglied.benutzerId" class="input">
              <option :value="null">Kein Konto verknüpft</option>
              <option v-for="k in sync.konten" :key="k.id" :value="k.id">{{ k.name }} · {{ k.email }}</option>
            </select>
            <p class="small muted">Mit einem Konto sieht die Person dieses Gremium in ihrer Übersicht – zusätzlich zum persönlichen Link.</p>
          </div>
          <p v-else-if="mitglied.benutzerId" class="small muted">Mit einem Konto verknüpft ({{ kontoName(mitglied.benutzerId) }}).</p>
          <div v-if="mitglied.id && mitglied.zugangsKey" class="block-soft stack-sm">
            <span class="label" style="margin: 0">Persönlicher Link</span>
            <p class="small muted">Zeigt dieser Person ihre Sitzungen, Terminfindungen und Pendenzen; bearbeiten kann sie, was ihr zugewiesen ist – als Sitzungsleitung / Protokollführung alles.</p>
            <div class="row">
              <button type="button" class="btn" @click="mitgliedLinkKopieren">{{ kopiert === mitglied.id ? 'Kopiert ✓' : 'Link kopieren' }}</button>
              <button type="button" class="btn btn-ghost" @click="mitgliedLinkErneuern">Erneuern</button>
            </div>
          </div>
          <div class="row">
            <button v-if="mitglied.id" type="button" class="btn btn-danger" @click="mitgliedEntfernen">Entfernen</button>
            <button type="button" class="btn ml-auto" @click="mitglied = null">Abbrechen</button>
            <button class="btn btn-primary">Speichern</button>
          </div>
        </form>
      </Modal>

      <!-- Dialog: Sitzung -->
      <Modal v-if="sitzungDialog" titel="Neue Sitzung" @schliessen="sitzungDialog = false">
        <form class="stack" @submit.prevent="sitzungHinzufuegen">
          <div class="row" style="gap: 0.5rem 1.5rem">
            <label class="check small"><input v-model="neueSitzung.terminfindung" type="radio" :value="false" /> Termin steht fest</label>
            <label class="check small"><input v-model="neueSitzung.terminfindung" type="radio" :value="true" /> Termin per Abstimmung finden</label>
          </div>
          <div v-if="!neueSitzung.terminfindung" class="grid-2">
            <div><span class="label">Datum</span><input v-model="neueSitzung.datum" class="input" type="date" required autofocus /></div>
            <div><span class="label">Zeit</span><input v-model="neueSitzung.zeit" class="input" type="time" /></div>
          </div>
          <p v-else class="small muted">Nach dem Erfassen legst du Terminvorschläge an; die Beteiligten stimmen über ihre Links ab. Das Vorprotokoll kann trotzdem schon vorbereitet werden.</p>
          <div><span class="label">Ort</span><input v-model.trim="neueSitzung.ort" class="input" /></div>
          <div>
            <span class="label">Vorprotokoll-Vorlage</span>
            <select v-model="neueSitzung.vorlageId" class="input">
              <option value="">Leeres Vorprotokoll</option>
              <option v-for="v in gremium.vorlagen" :key="v.id" :value="v.id">{{ v.name }}</option>
            </select>
          </div>
          <div class="row" style="justify-content: flex-end">
            <button type="button" class="btn" @click="sitzungDialog = false">Abbrechen</button>
            <button class="btn btn-primary">{{ neueSitzung.terminfindung ? 'Weiter zur Terminfindung' : 'Sitzung erfassen' }}</button>
          </div>
        </form>
      </Modal>
    </div>
  `,
  data() {
    return {
      tab: '',
      TABS,
      BEREICHE,
      RECHTE,
      neuerZugangName: '',
      kopiert: '',
      mitglied: null, // Arbeitskopie im Dialog
      sitzungDialog: false,
      neueRolle: '',
      neuerThemenbereich: { name: '', farbe: '#b4c410' },
      neueVorlage: '',
      anwendenAuf: {}, // pro Vorlage: gewählte Sitzungs-IDs
      angewendet: '',
      neueSitzung: { datum: '', zeit: '', ort: '', vorlageId: '', terminfindung: false },
      ROLLEN_TYPEN,
      SITZUNG_STATUS,
      SITZUNG_STATUS_KLASSE,
      sync,
    }
  },
  computed: {
    gremium() {
      return gremienStore.byId(this.gremiumId)
    },
    sitzungen() {
      return sitzungenStore.sitzungenVonGremium(this.gremiumId)
    },
    sitzungenOhneProtokoll() {
      return sitzungenStore.sitzungenOhneProtokoll(this.gremiumId)
    },
    personen() {
      return gremienStore.personen(this.gremiumId)
    },
    bearbeiterAuswahl() {
      return gremienStore.bearbeiterAuswahl(this.gremiumId)
    },
    // Superadmin oder Eigentümer (Konto, das dieses Gremium angelegt hat)
    istAdmin() {
      return rolleIm(this.gremiumId) === 'admin'
    },
    istSuperadmin() {
      return sync.zugriff?.rolle === 'admin'
    },
    sichtbareTabs() {
      const tabs = {}
      for (const [id, label] of Object.entries(TABS)) {
        if (id === 'teilen' ? this.istAdmin : recht(id, this.gremiumId) !== 'keine') tabs[id] = label
      }
      return tabs
    },
  },
  watch: {
    // Auswahl «auf Sitzungen anwenden» pro Vorlage als Liste bereithalten
    'gremium.vorlagen': {
      immediate: true,
      handler(vorlagen) {
        vorlagen?.forEach((v) => (this.anwendenAuf[v.id] ??= []))
      },
    },
  },
  created() {
    this.tab = Object.keys(this.sichtbareTabs)[0] || ''
  },
  methods: {
    formatDatum,
    sitzungStatus,
    entfernen(liste, element) {
      liste.splice(liste.indexOf(element), 1)
    },
    rolleName(rolleId) {
      return gremienStore.rolleName(this.gremiumId, rolleId)
    },
    darf(bereich) {
      return recht(bereich, this.gremiumId) === 'bearbeiten'
    },
    kontoName(benutzerId) {
      return sync.konten.find((k) => k.id === benutzerId)?.name || 'Konto'
    },
    zugangsLink(zugang) {
      return location.href.split('#')[0] + '#/zugang/' + zugang.key
    },
    linkKopieren(zugang) {
      navigator.clipboard.writeText(this.zugangsLink(zugang))
      this.kopiert = zugang.id
      setTimeout(() => (this.kopiert = ''), 2000)
    },
    linkErneuern(zugang) {
      if (confirm('Link erneuern? Der bisherige Link wird sofort ungültig.')) zugang.key = neuerKey()
    },
    zugangHinzufuegen() {
      this.gremium.zugaenge.push(neuerZugang(this.neuerZugangName))
      this.neuerZugangName = ''
    },
    mitgliedBearbeiten(m) {
      this.mitglied = m ? { ...m } : { id: null, name: '', email: '', rolleId: this.gremium.rollen[0]?.id || '', hatStimmrecht: true, benutzerId: null }
    },
    mitgliedLinkKopieren() {
      navigator.clipboard.writeText(location.href.split('#')[0] + '#/zugang/' + this.mitglied.zugangsKey)
      this.kopiert = this.mitglied.id
      setTimeout(() => (this.kopiert = ''), 2000)
    },
    mitgliedLinkErneuern() {
      if (confirm('Persönlichen Link erneuern? Der bisherige Link wird sofort ungültig.')) this.mitglied.zugangsKey = neuerKey()
    },
    mitgliedSpeichern() {
      const liste = this.gremium.mitglieder
      const index = liste.findIndex((m) => m.id === this.mitglied.id)
      if (index >= 0) liste[index] = this.mitglied
      else liste.push({ ...this.mitglied, id: crypto.randomUUID(), zugangsKey: neuerKey() })
      this.mitglied = null
    },
    mitgliedEntfernen() {
      this.gremium.mitglieder = this.gremium.mitglieder.filter((m) => m.id !== this.mitglied.id)
      this.mitglied = null
    },
    rolleHinzufuegen() {
      this.gremium.rollen.push({ id: crypto.randomUUID(), name: this.neueRolle, typ: null, sollAnwesend: true })
      this.neueRolle = ''
    },
    rolleEntfernen(rolle) {
      this.gremium.mitglieder.forEach((m) => {
        if (m.rolleId === rolle.id) m.rolleId = null
      })
      this.entfernen(this.gremium.rollen, rolle)
      this.aktiv = null
    },
    themenbereichHinzufuegen() {
      gremienStore.fuegeThemenbereichHinzu(this.gremiumId, this.neuerThemenbereich.name, this.neuerThemenbereich.farbe)
      this.neuerThemenbereich.name = ''
    },
    vorlageHinzufuegen() {
      this.gremium.vorlagen.push({
        id: crypto.randomUUID(),
        name: this.neueVorlage,
        titel: '',
        sitzungsleitung: '',
        protokollfuehrung: '',
        bemerkungen: '',
        traktanden: [],
      })
      this.neueVorlage = ''
    },
    alleWaehlen(vorlage) {
      const alle = this.sitzungenOhneProtokoll.map((s) => s.id)
      this.anwendenAuf[vorlage.id] = this.anwendenAuf[vorlage.id].length === alle.length ? [] : alle
    },
    vorlageAnwenden(vorlage) {
      const ids = this.anwendenAuf[vorlage.id]
      if (!confirm(`Vorlage «${vorlage.name}» auf ${ids.length} ${ids.length === 1 ? 'Sitzung' : 'Sitzungen'} anwenden? Bestehende Traktanden dieser Vorprotokolle werden ersetzt.`)) return
      ids.forEach((id) => sitzungenStore.wendeVorlageAn(id, vorlage.id))
      this.anwendenAuf[vorlage.id] = []
      this.angewendet = vorlage.id
      setTimeout(() => (this.angewendet = ''), 3000)
    },
    sitzungHinzufuegen() {
      const sitzung = sitzungenStore.erstelleSitzung(this.gremiumId, this.neueSitzung)
      const terminfindung = this.neueSitzung.terminfindung
      this.neueSitzung = { datum: '', zeit: '', ort: '', vorlageId: this.neueSitzung.vorlageId, terminfindung: false }
      this.sitzungDialog = false
      if (terminfindung) this.$router.push('/sitzung/' + sitzung.id + '/terminfindung')
    },
    sitzungLoeschen(sitzung) {
      if (sitzung.genehmigt) {
        alert('Das Protokoll dieser Sitzung wurde an der Sitzung vom ' + formatDatum(sitzung.genehmigt.datum) + ' genehmigt. Es kann erst gelöscht werden, wenn jene Sitzung gelöscht wird.')
        return
      }
      if (confirm('Sitzung vom ' + formatDatum(sitzung.datum) + ' inkl. Protokoll löschen?')) {
        sitzungenStore.loescheSitzung(sitzung.id)
      }
    },
    async loeschen() {
      if (!confirm('Gremium «' + this.gremium.name + '» inkl. aller Sitzungen unwiderruflich löschen?')) return
      await gremiumLoeschen(this.gremiumId)
      sitzungenStore.loescheSitzungenVonGremium(this.gremiumId)
      gremienStore.loesche(this.gremiumId)
      if (sync.zugriff.rolle === 'benutzer') sync.zugriff.gremien = sync.zugriff.gremien.filter((g) => g.gremiumId !== this.gremiumId)
      this.$router.push('/')
    },
  },
}
