import { api } from '../api.js'
import { laden, recht, sync, zugriffsDaten } from '../stores/sync.js'
import { gremienStore } from '../stores/gremien.js'
import { sitzungenStore } from '../stores/sitzungen.js'
import { EINZELRECHTE, FREIGABE_STUFEN, freigabeLinkObjekt, freigabeStufe, istLeitung, rolleIm, standardStufe, verwaltetSitzung } from '../utils/rechte.js'
import { neuerKey } from '../utils/keys.js'
import { formatDatum } from '../utils/labels.js'
import LinkSchutzDialog, { ablaufText } from './LinkSchutzDialog.js'
import MenuDropdown from './MenuDropdown.js'
import Modal from './Modal.js'
import RechteFenster from './RechteFenster.js'
import { bestaetigen, hinweis } from '../utils/dialog.js'

const DOKUMENTE = { terminfindung: 'Terminfindung', vorprotokoll: 'Vorprotokoll', protokoll: 'Protokoll' }
const RECHTE_KURZ = { keine: '–', lesen: 'lesen', bearbeiten: 'bearbeiten' }

// Zugriffsübersicht: wer Zugriff hat und worüber (persönlicher Link, Konto, Gast-Link, allgemeiner Link), zuletzt
// genutzt, und die verteilten Links. Mit sitzungId für eine Sitzung (Sitzungsleitung, Protokollführung, Eigentümer,
// Superadmin), sonst fürs ganze Gremium (Eigentümer, Superadmin) mit allen Sitzungen darunter.
// Mitglieder sperren oder entfernen Eigentümer und Superadmin fürs ganze Gremium; die Leitung einer Sitzung nur für diese.
export default {
  name: 'ZugriffeListe',
  components: { LinkSchutzDialog, MenuDropdown, Modal, RechteFenster },
  props: {
    gremiumId: { type: String, required: true },
    sitzungId: { type: String, default: '' },
    nurSitzung: { type: Boolean, default: false }, // innerhalb der Gremium-Übersicht: ohne Mitglieder
  },
  template: `
    <div class="teilen zugriffe stack">
      <div v-if="vorschlaege.length" class="banner stack-sm">
        <strong>Möglicherweise doppelt eingetragen</strong>
        <div v-for="v in vorschlaege" :key="v.gast.id" class="row small">
          <span class="grow">«{{ v.gast.name }}» ({{ v.gast.email }}) hat sich {{ herkunftText(v.gast) }} eingetragen – {{ v.gast.vorschlag.grund === 'email' ? 'gleiche E-Mail' : 'gleicher Name' }} wie «{{ v.ziel.name }}»{{ v.ziel.email ? ' (' + v.ziel.email + ')' : '' }}. Ist das dieselbe Person?</span>
          <button type="button" class="btn btn-primary" @click="zusammenfuehren(v.gast, v.ziel)">Zusammenführen</button>
          <button type="button" class="btn" @click="ablehnen(v.gast)">Nicht dieselbe</button>
        </div>
      </div>

      <div v-if="personen.length">
        <h3 class="label">{{ sitzung ? 'Personen' : 'Mitglieder' }}</h3>
        <div class="teilen-liste">
          <div v-for="p in personen" :key="p.id" class="teilen-zeile">
            <span class="avatar" :class="{ hell: p.gast }">{{ initialen(p.name) }}</span>
            <span class="text">
              <strong>{{ p.name }} <span v-for="s in p.status" :key="s.text" class="badge" :class="s.klasse">{{ s.text }}</span></strong>
              <span class="leise small">{{ p.beschreibung }}</span>
              <span class="leise small">{{ p.wege.join(' · ') || 'kein Zugang' }}<template v-if="p.zuletzt"> · zuletzt {{ formatDatum(p.zuletzt) }}</template></span>
            </span>
            <span class="zugriff-stufen">
              <span v-for="st in p.stufen" :key="st.dokument" class="zugriff-stufe">
                <span class="leise small">{{ st.label }}</span>
                <span class="schalter" :class="{ gesetzt: st.gesetzt }">
                  <button v-if="st.wert === 'individuell'" type="button" class="aktiv" :disabled="!verwaltet" title="Individuelle Rechte einstellen" @click="rechteFuer = p.id">Individuell</button>
                  <template v-else><button v-for="(label, s) in FREIGABE_STUFEN" :key="s" type="button" :class="{ aktiv: st.wert === s }" :disabled="!verwaltet" @click="stufeSetzen(p.id, st.dokument, s)">{{ label }}</button></template>
                </span>
              </span>
            </span>
            <MenuDropdown v-if="p.aktionen.length">
              <button v-for="a in p.aktionen" :key="a.text" type="button" class="menu-item" :class="{ 'menu-item-danger': a.gefahr }" @click="a.tun()">{{ a.text }}</button>
            </MenuDropdown>
            <span v-else></span>
          </div>
        </div>
      </div>
      <p v-else-if="nurSitzung" class="muted small">Keine Gäste.</p>

      <div v-if="links.length">
        <h3 class="label">Links</h3>
        <div class="teilen-liste">
          <div v-for="l in links" :key="l.id" class="teilen-zeile">
            <span class="avatar hell">∞</span>
            <span class="text">
              <strong><input v-if="l.umbenennen && verwaltet" v-model.trim="l.umbenennen.name" class="nahtlos titel" placeholder="Bezeichnung" /><template v-else>{{ l.name }}</template> <span v-if="l.passwort" class="badge blau">Passwort</span> <span v-if="l.ablauf" class="badge" :class="l.ablauf.startsWith('abgelaufen') ? 'rot' : 'grau'">{{ l.ablauf }}</span></strong>
              <span class="leise small">{{ l.beschreibung }}<template v-if="l.zuletzt"> · zuletzt {{ formatDatum(l.zuletzt) }}</template></span>
            </span>
            <span class="zugriff-stufen">
              <span v-if="l.stufen" class="schalter" :class="{ gesetzt: l.stufen.gesetzt }">
                <button v-if="l.stufen.link.stufe === 'individuell'" type="button" class="aktiv" :disabled="!verwaltet" title="Individuelle Rechte einstellen" @click="individuellOeffnen(l.stufen)">Individuell</button>
                <template v-else><button v-for="(label, s) in l.stufen.wahl" :key="s" type="button" :class="{ aktiv: l.stufen.link.stufe === s }" :disabled="!verwaltet" @click="linkStufe(l.stufen.link, s)">{{ label }}</button></template>
              </span>
            </span>
            <MenuDropdown v-if="l.aktionen.length">
              <button v-for="a in l.aktionen" :key="a.text" type="button" class="menu-item" :class="{ 'menu-item-danger': a.gefahr }" @click="a.tun()">{{ a.text }}</button>
            </MenuDropdown>
            <span v-else></span>
          </div>
        </div>
      </div>
      <!-- Weitere allgemeine Links der Sitzung, je für ein Dokument -->
      <form v-if="sitzung && verwaltet" class="row" @submit.prevent="linkHinzufuegen">
        <input v-model.trim="neuerLink.name" class="input grow" placeholder="Bezeichnung für einen weiteren allgemeinen Link …" required />
        <select v-model="neuerLink.dokument" class="input w-md" aria-label="Dokument">
          <option v-for="(label, d) in linkDokumente" :key="d" :value="d">{{ label }}</option>
        </select>
        <button class="btn">+ Link</button>
      </form>
      <p v-if="kopiert" class="small text-ok">Link kopiert ✓</p>

      <template v-if="!sitzung">
        <h3 class="label">Sitzungen</h3>
        <details v-for="s in sitzungen" :key="s.id" class="vorlage">
          <summary>{{ sitzungName(s) }} <span class="sub">{{ sitzungZaehler(s) }}</span></summary>
          <div class="inhalt"><ZugriffeListe :gremium-id="gremiumId" :sitzung-id="s.id" nur-sitzung /></div>
        </details>
        <p v-if="!sitzungen.length" class="muted small">Noch keine Sitzungen.</p>
      </template>

      <RechteFenster v-if="rechteFuer" :sitzung="sitzung" :person-id="rechteFuer" @schliessen="rechteFuer = ''" />
      <RechteFenster v-if="rechteLink" :sitzung="sitzung" :link="rechteLink" @schliessen="rechteLink = null" />
      <LinkSchutzDialog v-if="schutz" v-bind="schutz" :gremium-id="gremiumId" @schliessen="schutz = null" />

      <Modal v-if="fusion" :titel="fusion.gast.name + ' zusammenführen'" @schliessen="fusion = null">
        <form id="formular-fusion" class="stack" @submit.prevent="zusammenfuehren(fusion.gast, fusion.ziel)">
          <p class="hint">Stimmen und Kommentare gehen auf die gewählte Person über, und der Link von {{ fusion.gast.name }} öffnet künftig als diese Person.</p>
          <select v-model="fusion.ziel" class="input" required>
            <option :value="null" disabled>Person wählen …</option>
            <option v-for="z in fusionsZiele(fusion.gast)" :key="z.id" :value="z">{{ z.name }}{{ z.email ? ' · ' + z.email : '' }}</option>
          </select>
        </form>
        <template #fuss>
          <div class="row">
            <button type="button" class="btn" @click="fusion = null">Abbrechen</button>
            <button form="formular-fusion" class="btn btn-primary" :disabled="!fusion.ziel">Zusammenführen</button>
          </div>
        </template>

      </Modal>

      <Modal v-if="aufnahme" :titel="aufnahme.gast.name + ' als Mitglied aufnehmen'" @schliessen="aufnahme = null">
        <form id="formular-aufnahme" class="stack" @submit.prevent="aufnehmen">
          <p class="hint">{{ aufnahme.gast.name }} wird Mitglied von «{{ gremium.name }}» und sieht damit alle Sitzungen, die diese Rolle sieht. Konto, Stimmen und Kommentare gehen auf das neue Mitglied über; der bisherige Link öffnet künftig als dieses Mitglied.</p>
          <div>
            <span class="label">Rolle</span>
            <select v-model="aufnahme.rolleId" class="input" required>
              <option v-for="r in gremium.rollen" :key="r.id" :value="r.id">{{ r.name }}</option>
            </select>
          </div>
        </form>
        <template #fuss>
          <div class="row">
            <button type="button" class="btn" @click="aufnahme = null">Abbrechen</button>
            <button form="formular-aufnahme" class="btn btn-primary ml-auto" :disabled="!aufnahme.rolleId || laeuftAufnahme">Als Mitglied aufnehmen</button>
          </div>
        </template>
      </Modal>
    </div>
  `,
  data() {
    return { aufnahme: null, laeuftAufnahme: false, schutz: null, fusion: null, kopiert: false, rechteFuer: '', rechteLink: null, neuerLink: { name: '', dokument: '' }, FREIGABE_STUFEN }
  },
  computed: {
    gremium() {
      return gremienStore.byId(this.gremiumId)
    },
    sitzung() {
      return this.sitzungId ? sitzungenStore.sitzungById(this.sitzungId) : null
    },
    vorprotokoll() {
      return this.sitzungId ? sitzungenStore.vorprotokollVonSitzung(this.sitzungId) : null
    },
    protokoll() {
      return this.sitzungId ? sitzungenStore.protokollVonSitzung(this.sitzungId) : null
    },
    nutzung() {
      return zugriffsDaten[this.gremiumId]?.nutzung || {}
    },
    // Dokumente, für die sich weitere Links anlegen lassen
    linkDokumente() {
      const s = this.sitzung
      const liste = {}
      if (s?.terminfindung) liste.terminfindung = 'Terminfindung'
      if (s && !s.kurz) liste.vorprotokoll = 'Vorprotokoll'
      liste.protokoll = 'Protokoll'
      return liste
    },
    // Eigentümer und Superadmin: Mitglieder fürs ganze Gremium, Gremium-Links
    admin() {
      return rolleIm(this.gremiumId) === 'admin'
    },
    // Weitere Personen als Mitglied aufnehmen: Superadmin, Eigentümer, Gremium-Zugang mit «Mitglieder bearbeiten»
    mitgliederVerwalten() {
      return this.admin || (rolleIm(this.gremiumId) === 'gremium' && recht('mitglieder', this.gremiumId) === 'bearbeiten')
    },
    verwaltet() {
      return this.sitzung ? verwaltetSitzung(this.sitzung) : this.admin
    },
    sitzungen() {
      return [...sitzungenStore.sitzungenVonGremium(this.gremiumId), ...sitzungenStore.kurzsitzungen(this.gremiumId)].sort((a, b) => (b.datum || '9').localeCompare(a.datum || '9'))
    },
    gaeste() {
      return this.vorprotokoll?.gaeste.filter((g) => g.name) || []
    },
    vorschlaege() {
      return this.gaeste
        .filter((g) => g.vorschlag?.status === 'offen')
        .map((gast) => ({ gast, ziel: this.person(gast.vorschlag.personId) }))
        .filter((v) => v.ziel && v.ziel.id !== v.gast.id)
    },
    personen() {
      const liste = []
      if (!this.nurSitzung) {
        let mitglieder = this.gremium.mitglieder
        // Kurzsitzung eines Gremiums: nur wer teilnimmt oder leitet
        if (this.sitzung?.kurz && !this.gremium.kurz) {
          const dabei = [...sitzungenStore.teilnehmende(this.sitzung), ...this.sitzung.sitzungsleitung.map((p) => p.id), ...this.sitzung.protokollfuehrung.map((p) => p.id)]
          mitglieder = mitglieder.filter((m) => dabei.includes(m.id))
        }
        mitglieder.forEach((m) => liste.push(this.mitgliedZeile(m)))
        const eigentuemer = !this.sitzung && this.gremium.eigentuemerId && sync.konten.find((k) => k.id === this.gremium.eigentuemerId)
        if (eigentuemer) liste.unshift({ id: 'eigentuemer', name: eigentuemer.name, beschreibung: 'Eigentümer · verwaltet das Gremium', wege: ['Konto'], status: [], zuletzt: this.nutzung['konto:eigentuemer'], aktionen: [] })
      }
      this.gaeste.forEach((g) => liste.push(this.gastZeile(g)))
      return liste
    },
    links() {
      const liste = []
      if (!this.sitzung) {
        if (!this.admin) return liste
        for (const z of this.gremium.zugaenge) {
          const rechte = Object.values(z.rechte).map((r) => RECHTE_KURZ[r]).join(' / ')
          liste.push(this.linkZeile({ id: z.id, name: z.name || 'Gremium-Link', beschreibung: `Gremium-Link · Sitzungen / Mitglieder / Einstellungen: ${rechte}`, pfad: '/zugang/', ziel: z, feld: 'key', schutzRef: 'zugang:' + z.id, ablaufZiel: z, ablaufFeld: 'ablauf', loeschen: () => this.gremium.zugaenge.splice(this.gremium.zugaenge.indexOf(z), 1) }))
        }
        for (const tb of this.gremium.themenbereiche) {
          liste.push(this.linkZeile({ id: tb.id, name: 'Übersicht ' + tb.name, beschreibung: 'Themenbereich · nur lesen', pfad: '/themenbereich/', ziel: tb, feld: 'freigabeKey', nutzungRef: 'themenbereich:' + tb.id }))
        }
        return liste
      }
      const vp = this.vorprotokoll
      if (vp && !this.sitzung.kurz) {
        const anzahl = this.gaeste.filter((g) => g.ueberLink === 'freigabe').length
        const link = freigabeLinkObjekt(vp)
        liste.push(this.linkZeile({ id: 'freigabe', name: 'Allgemeiner Link', beschreibung: 'Vorprotokoll · ' + this.linkText(link) + this.eingetragenText(anzahl), pfad: '/freigabe/', ziel: vp, feld: 'freigabeLinkKey', schutzRef: 'freigabe:' + vp.id, ablaufZiel: vp, ablaufFeld: 'freigabeLinkAblauf', stufen: this.linkStufen(link, 'eigene'), rechteLink: link }))
      }
      for (const l of this.sitzung.links || []) {
        const anzahl = this.gaeste.filter((g) => g.ueberLink === l.id).length
        liste.push(this.linkZeile({ id: l.id, name: l.name || 'Link', beschreibung: `${DOKUMENTE[l.dokument]} · ${this.linkText(l)}` + this.eingetragenText(anzahl), pfad: '/link/', ziel: l, feld: 'key', schutzRef: 'link:' + l.id, ablaufZiel: l, ablaufFeld: 'ablauf', rechteLink: l, stufen: this.linkStufen(l, 'lesen'), umbenennen: l, loeschen: () => (this.sitzung.links = this.sitzung.links.filter((x) => x.id !== l.id)) }))
      }
      if (this.protokoll) {
        liste.push(this.linkZeile({ id: 'verfolger', name: 'Live-Ansicht', beschreibung: 'Protokoll · nur mitlesen', pfad: '/verfolgen/', ziel: this.protokoll, feld: 'verfolgerKey', nutzungRef: 'verfolger:' + this.protokoll.id }))
      }
      return liste
    },
  },
  methods: {
    formatDatum,
    initialen(name) {
      return name.split(/\s+/).filter(Boolean).slice(0, 2).map((teil) => teil[0].toUpperCase()).join('')
    },
    person(id) {
      return this.gremium.mitglieder.find((m) => m.id === id) || this.gaeste.find((g) => g.id === id) || null
    },
    zuletzt(...refs) {
      return refs.map((r) => this.nutzung[r] || '').sort().pop() || ''
    },
    eingetragenText(anzahl) {
      return anzahl ? ` · ${anzahl} ${anzahl === 1 ? 'Person' : 'Personen'} eingetragen` : ''
    },
    sitzungName(s) {
      return `${s.titel || (s.kurz ? 'Kurzsitzung' : 'Sitzung')}${s.datum ? ' · ' + formatDatum(s.datum) : ' · Termin offen'}`
    },
    sitzungZaehler(s) {
      const gaeste = sitzungenStore.vorprotokollVonSitzung(s.id)?.gaeste.filter((g) => g.name).length || 0
      const links = (s.links || []).length + (s.kurz ? 0 : 1)
      return `${gaeste} ${gaeste === 1 ? 'Gast' : 'Gäste'} · ${links} ${links === 1 ? 'Link' : 'Links'}`
    },
    // Über welchen Link eine Person kam
    herkunftText(gast) {
      if (gast.ueberLink === 'freigabe') return 'über den allgemeinen Link'
      const link = (this.sitzung?.links || []).find((l) => l.id === gast.ueberLink)
      return link ? `über «${link.name}»` : 'über einen gelöschten Link'
    },
    aliasse(id) {
      return Object.values(this.vorprotokoll?.aliasKeys || {}).filter((p) => p === id).length
    },
    url(pfad, key) {
      return location.href.split('#')[0] + '#' + pfad + key
    },
    kopieren(pfad, key) {
      navigator.clipboard.writeText(this.url(pfad, key))
      this.kopiert = true
      setTimeout(() => (this.kopiert = false), 2000)
    },
    mitgliedZeile(m) {
      const s = this.sitzung
      const leitung = s && istLeitung(s, m.id)
      const funktion = s?.sitzungsleitung.some((p) => p.id === m.id) ? 'Sitzungsleitung' : s?.protokollfuehrung.some((p) => p.id === m.id) ? 'Protokollführung' : ''
      const wege = ['Persönlicher Link']
      if (m.benutzerId) wege.push('Konto')
      if (this.aliasse(m.id)) wege.push('frühere Adresse als Gast')
      const status = []
      if (m.gesperrt) status.push({ text: 'Gesperrt', klasse: 'rot' })
      if (s?.gesperrt?.includes(m.id)) status.push({ text: 'Für diese Sitzung gesperrt', klasse: 'rot' })
      if (s?.nurLesen?.includes(m.id)) status.push({ text: 'Für diese Sitzung nur lesen', klasse: 'gelb' })
      if (s?.terminfindung?.entfernt?.includes(m.id)) status.push({ text: 'Entschuldigt', klasse: 'grau' })
      const aktionen = []
      if (s && this.verwaltet) aktionen.push({ text: 'Individuelle Rechte einstellen …', tun: () => (this.rechteFuer = m.id) })
      if (this.verwaltet) aktionen.push({ text: 'Ansehen als …', tun: () => this.ansehenAls(m) })
      if (s && this.verwaltet && !leitung) {
        aktionen.push(...this.sperrAktionen(m, 'Für diese Sitzung '))
        const gesperrt = s.gesperrt?.includes(m.id)
        if (!gesperrt || !s.terminfindung?.entfernt?.includes(m.id)) aktionen.push({ text: 'Aus dieser Sitzung entfernen', gefahr: true, tun: () => this.ausSitzungEntfernen(m) })
      }
      if (this.admin) {
        if (m.zugangsKey) aktionen.push({ text: 'Persönlichen Link kopieren', tun: () => this.kopieren('/zugang/', m.zugangsKey) })
        aktionen.push({ text: 'Persönlichen Link erneuern', tun: () => this.erneuern(m.name, m, 'zugangsKey') })
        aktionen.push({ text: m.gesperrt ? 'Zugang entsperren' : 'Zugang sperren (ganzes Gremium)', tun: () => this.zugangSperren(m) })
        if (m.benutzerId && sync.zugriff?.rolle === 'admin') aktionen.push({ text: 'Konto lösen', tun: () => this.kontoLoesen(m) })
        aktionen.push({ text: 'Aus dem Gremium entfernen', gefahr: true, tun: () => this.ausGremiumEntfernen(m) })
      }
      return {
        id: m.id,
        name: m.name,
        beschreibung: [this.gremium.kurz ? 'Eingeladen' : gremienStore.rolleName(this.gremiumId, m.rolleId), funktion].filter(Boolean).join(' · '),
        wege,
        status,
        zuletzt: this.zuletzt('person:' + m.id, 'konto:' + m.id),
        stufen: s ? this.stufenVon(m.id) : [],
        aktionen,
      }
    },
    gastZeile(g) {
      const s = this.sitzung
      const key = this.vorprotokoll.personenKeys?.[g.id]
      const wege = []
      if (key !== undefined) wege.push('Eigener Link')
      if (g.benutzerId) wege.push('Konto')
      if (this.aliasse(g.id)) wege.push('frühere Adresse')
      const status = []
      if (s.gesperrt?.includes(g.id)) status.push({ text: 'Gesperrt', klasse: 'rot' })
      if (s.nurLesen?.includes(g.id)) status.push({ text: 'Nur lesen', klasse: 'gelb' })
      if (g.vorschlag?.status === 'offen') status.push({ text: 'Doppelt?', klasse: 'gelb' })
      const aktionen = []
      if (this.verwaltet) {
        if (key) aktionen.push({ text: 'Link kopieren', tun: () => this.kopieren('/freigabe/', key) })
        if (key !== undefined) aktionen.push({ text: 'Link erneuern', tun: () => this.erneuern(g.name, this.vorprotokoll.personenKeys, g.id) })
        aktionen.push(...this.sperrAktionen(g, ''))
        aktionen.push({ text: 'Individuelle Rechte einstellen …', tun: () => (this.rechteFuer = g.id) })
        aktionen.push({ text: 'Ansehen als …', tun: () => this.ansehenAls(g) })
        if (g.weiterePerson) aktionen.push({ text: 'Mit Person zusammenführen …', tun: () => (this.fusion = { gast: g, ziel: null }) })
        aktionen.push({ text: 'Aus der Sitzung entfernen', gefahr: true, tun: () => this.gastEntfernen(g) })
      }
      if (g.weiterePerson && this.mitgliederVerwalten) aktionen.push({ text: 'Als Mitglied aufnehmen …', tun: () => this.aufnahmeStarten(g) })
      const art = g.weiterePerson ? 'Weitere Person ' + this.herkunftText(g) : 'Gast'
      return {
        id: g.id,
        gast: true,
        name: g.name,
        beschreibung: [art, g.organisation, g.email].filter(Boolean).join(' · '),
        wege,
        status,
        zuletzt: this.zuletzt('person:' + g.id, 'konto:' + g.id),
        stufen: this.stufenVon(g.id),
        aktionen,
      }
    },
    // Link-Zeile mit Kopieren, Erneuern, Passwort und Ablauf (allgemeine Links), Löschen
    linkZeile({ id, name, beschreibung, pfad, ziel, feld, schutzRef, nutzungRef, ablaufZiel, ablaufFeld, rechteLink, stufen, umbenennen, loeschen }) {
      const aktionen = []
      const darf = this.verwaltet
      if (darf && rechteLink) aktionen.push({ text: 'Individuelle Rechte einstellen …', tun: () => (this.rechteLink = rechteLink) })
      if (darf && ziel[feld]) aktionen.push({ text: 'Link kopieren', tun: () => this.kopieren(pfad, ziel[feld]) })
      if (darf) aktionen.push({ text: 'Link erneuern', tun: () => this.erneuern(name, ziel, feld) })
      if (darf && schutzRef) aktionen.push({ text: 'Passwort und Ablauf …', tun: () => (this.schutz = { titel: name, schutzRef, ziel: ablaufZiel, feld: ablaufFeld, sitzung: this.sitzung }) })
      if (darf && loeschen) aktionen.push({ text: 'Link löschen', gefahr: true, tun: async () => await bestaetigen(`Link «${name}» löschen? Wer ihn hat, kommt danach nicht mehr hinein – auch wer sich darüber eingetragen hat und kein Konto hat.`, { gefahr: true }) && loeschen() })
      return {
        id,
        name,
        beschreibung,
        passwort: !!schutzRef && (zugriffsDaten[this.gremiumId]?.geschuetzt || []).includes(schutzRef),
        ablauf: ablaufZiel ? ablaufText(ablaufZiel[ablaufFeld], this.sitzung) : '',
        stufen,
        umbenennen,
        zuletzt: this.zuletzt(schutzRef || nutzungRef),
        aktionen,
      }
    },
    // Stufen einer Person pro Dokument (Kurzsitzung: nur Protokoll); gesetzt = weicht vom Standard der Rolle ab
    stufenVon(personId) {
      const dokumente = this.sitzung.kurz ? ['protokoll'] : ['vorprotokoll', 'protokoll']
      return dokumente.map((dokument) => {
        const wert = freigabeStufe(this.sitzung, dokument, personId)
        return { dokument, label: DOKUMENTE[dokument], wert, gesetzt: wert !== standardStufe(this.sitzung, personId, dokument) }
      })
    },
    stufeSetzen(personId, dokument, stufe) {
      const s = this.sitzung
      s.freigaben ??= {}
      s.freigaben[dokument] ??= {}
      if (stufe === standardStufe(s, personId, dokument)) delete s.freigaben[dokument][personId]
      else s.freigaben[dokument][personId] = stufe
    },
    // Stufen eines Links: Lesen / (Vorprotokoll: Eigene) / Alles; Individuell über das Fenster
    linkStufen(link, standard) {
      const wahl = link.dokument === 'vorprotokoll' ? { lesen: 'Lesen', eigene: 'Eigene', alles: 'Alles' } : { lesen: 'Lesen', alles: 'Alles' }
      return { link, wahl, gesetzt: link.stufe !== standard }
    },
    linkText(link) {
      if (link.stufe === 'alles') return 'Alles'
      if (link.stufe === 'lesen') return 'Lesen'
      if (link.stufe === 'eigene') return 'Eigene (Traktanden ändern und verschieben)'
      return ((link.rechte || []).map((r) => EINZELRECHTE[link.dokument][r]).join(', ') || 'Lesen') + (link.zuschnitt?.regeln?.length ? ' · mit Regeln' : '')
    },
    linkStufe(link, stufe) {
      link.stufe = stufe
      link.rechte = []
      link.zuschnitt = null
    },
    individuellOeffnen(stufen) {
      this.rechteLink = stufen.link
    },
    // «Ansehen als …»: neuer Tab mit der App aus Sicht der Person (nur lesen, zwei Stunden)
    async ansehenAls(person) {
      const fenster = window.open('', '_blank') // sofort öffnen, sonst blockiert der Browser das Fenster
      try {
        const { token } = await api.anfrage('ansicht_starten', this.gremiumId, { personId: person.id, sitzungId: this.sitzungId })
        fenster.location.href = location.href.split('#')[0] + '#/ansicht/' + token
      } catch (fehler) {
        fenster?.close()
        hinweis(fehler.message)
      }
    },
    linkHinzufuegen() {
      const s = this.sitzung
      s.links ??= []
      s.links.push({ id: crypto.randomUUID(), key: neuerKey(), name: this.neuerLink.name, dokument: this.neuerLink.dokument || Object.keys(this.linkDokumente)[0], stufe: 'lesen', rechte: [], ablauf: '' })
      this.neuerLink.name = ''
    },
    async erneuern(name, ziel, feld) {
      if (await bestaetigen(`Link von «${name}» erneuern? Der bisherige Link wird sofort ungültig.`)) ziel[feld] = neuerKey()
    },
    // Für diese Sitzung in zwei Stufen: «nur lesen» (sieht alles, ändert nichts) oder ganz sperren (sieht die Sitzung nicht)
    sperrAktionen(person, praefix) {
      const s = this.sitzung
      const gesperrt = s.gesperrt?.includes(person.id)
      const nurLesen = s.nurLesen?.includes(person.id)
      const gross = (text) => (praefix ? praefix + text : text.charAt(0).toUpperCase() + text.slice(1))
      if (gesperrt) return [{ text: gross('entsperren'), tun: () => this.sitzungSperren(person, '') }]
      return [
        nurLesen ? { text: gross('«nur lesen» aufheben'), tun: () => this.sitzungSperren(person, '') } : { text: gross('nur lesen'), tun: () => this.sitzungSperren(person, 'lesen') },
        { text: gross('ganz sperren'), tun: () => this.sitzungSperren(person, 'ganz') },
      ]
    },
    // stufe: 'lesen' | 'ganz' | '' (aufheben); die Person bleibt auf der Liste
    async sitzungSperren(person, stufe) {
      const s = this.sitzung
      if (stufe === 'ganz' && !(await bestaetigen(`${person.name} für diese Sitzung ganz sperren? ${person.name} sieht die Sitzung danach nicht mehr – auch das Protokoll nicht.`, { titel: 'Ganz sperren', ja: 'Sperren', gefahr: true }))) return
      if (stufe === 'lesen' && !(await bestaetigen(`${person.name} für diese Sitzung auf «nur lesen» setzen? ${person.name} sieht Vorprotokoll und Protokoll, kann aber nichts mehr ändern.`, { titel: 'Nur lesen', ja: 'Nur lesen' }))) return
      const ohne = (liste) => (liste || []).filter((id) => id !== person.id)
      s.gesperrt = stufe === 'ganz' ? [...ohne(s.gesperrt), person.id] : ohne(s.gesperrt)
      s.nurLesen = stufe === 'lesen' ? [...ohne(s.nurLesen), person.id] : ohne(s.nurLesen)
    },
    // Aus dieser Sitzung entfernen: entschuldigt (wie ✕ in der Terminfindung) und gesperrt
    async ausSitzungEntfernen(m) {
      if (!(await bestaetigen(`${m.name} aus dieser Sitzung entfernen? ${m.name} ist entschuldigt und sieht die Sitzung nicht mehr.`, { gefahr: true }))) return
      const s = this.sitzung
      s.gesperrt = [...new Set([...(s.gesperrt || []), m.id])]
      if (s.terminfindung && !s.terminfindung.entfernt.includes(m.id)) s.terminfindung.entfernt.push(m.id)
      if (this.vorprotokoll && !this.protokoll) this.vorprotokoll.anwesendeMitgliederIds = this.vorprotokoll.anwesendeMitgliederIds.filter((id) => id !== m.id)
    },
    async gastEntfernen(g) {
      if (!(await bestaetigen(`${g.name} aus der Sitzung entfernen? Der Link von ${g.name} wird ungültig.`, { gefahr: true }))) return
      const vp = this.vorprotokoll
      vp.gaeste = vp.gaeste.filter((x) => x.id !== g.id)
      delete vp.personenKeys[g.id]
      for (const [key, id] of Object.entries(vp.aliasKeys || {})) if (id === g.id) delete vp.aliasKeys[key]
    },
    async zugangSperren(m) {
      if (!m.gesperrt && !(await bestaetigen(`Zugang von ${m.name} sperren? Weder der persönliche Link noch das Konto öffnen das Gremium danach. ${m.name} bleibt Mitglied.`, { gefahr: true }))) return
      m.gesperrt = !m.gesperrt
    },
    async kontoLoesen(m) {
      if (await bestaetigen(`${m.name} bleibt Mitglied, das Konto sieht das Gremium aber nicht mehr. Lösen?`)) m.benutzerId = null
    },
    async ausGremiumEntfernen(m) {
      if (await bestaetigen(`${m.name} aus dem Gremium «${this.gremium.name}» entfernen? Persönlicher Link und Konto-Verknüpfung fallen weg.`, { gefahr: true })) this.gremium.mitglieder = this.gremium.mitglieder.filter((x) => x.id !== m.id)
    },
    fusionsZiele(gast) {
      return [...this.gremium.mitglieder, ...this.gaeste.filter((g) => g.id !== gast.id)]
    },
    async zusammenfuehren(gast, ziel) {
      if (!ziel || !(await bestaetigen(`${gast.name} mit ${ziel.name} zusammenführen? Stimmen und Kommentare gehen auf ${ziel.name} über, und der Link von ${gast.name} öffnet künftig als ${ziel.name}.`))) return
      try {
        await api.anfrage('weitere_person_verknuepfen', this.gremiumId, { gastId: gast.id, zielId: ziel.id })
        this.fusion = null
        await laden()
      } catch (fehler) {
        hinweis(fehler.message)
      }
    },
    aufnahmeStarten(gast) {
      const standard = this.gremium.rollen.find((r) => r.name === 'Mitglied') || this.gremium.rollen.find((r) => !r.typ) || this.gremium.rollen[0]
      this.aufnahme = { gast, rolleId: standard?.id || '' }
    },
    async aufnehmen() {
      this.laeuftAufnahme = true
      try {
        await api.anfrage('weitere_person_aufnehmen', this.gremiumId, { gastId: this.aufnahme.gast.id, rolleId: this.aufnahme.rolleId })
        this.aufnahme = null
        await laden()
      } catch (fehler) {
        hinweis(fehler.message)
      }
      this.laeuftAufnahme = false
    },
    async ablehnen(gast) {
      try {
        await api.anfrage('vorschlag_ablehnen', this.gremiumId, { gastId: gast.id })
        await laden()
      } catch (fehler) {
        hinweis(fehler.message)
      }
    },
  },
}
