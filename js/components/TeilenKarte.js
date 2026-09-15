import { gremienStore } from '../stores/gremien.js'
import { FREIGABE_STUFEN, freigabeStufe, istLeitung, rolleIm, standardStufe } from '../utils/rechte.js'
import { istBerechtigt } from '../utils/traktanden.js'

// Teilen-Karte eines Vorprotokolls / Protokolls: wer hat welchen Zugriff, Freigabestufe pro Person setzen,
// Links kopieren. Die Stufen sind mit den geltenden Rechten vorbelegt (Leitung «Alles», sonst «Eigene»);
// eine gesetzte Stufe gilt nur für dieses Dokument und überschreibt die übrigen Rechte.
export default {
  name: 'TeilenKarte',
  props: {
    sitzung: { type: Object, required: true },
    dokument: { type: String, required: true }, // vorprotokoll | protokoll
    vorprotokoll: { type: Object, required: true },
    protokoll: { type: Object, default: null }, // für Gäste-Liste und Verfolger-Link des Protokolls
    darfSetzen: { type: Boolean, default: false }, // Stufen ändern (voller Zugriff auf das Dokument)
    linksSichtbar: { type: Boolean, default: false },
  },
  template: `
    <section class="card teilen">
      <div class="card-head">
        <h2 class="card-title">{{ dokument === 'vorprotokoll' ? 'Vorprotokoll' : 'Protokoll' }} teilen</h2>
        <span class="zaehler"><span class="punkt"></span>{{ zeilen.length }} {{ linksSichtbar ? 'Links' : 'Personen' }}</span>
      </div>
      <p v-if="istPerson" class="hint">Du siehst dieses Dokument über deinen persönlichen Link. {{ darfSetzen ? 'Als Leitung kannst du hier festlegen, wer was darf.' : 'Einstellen musst du hier nichts – die Übersicht zeigt, wer was darf.' }}</p>
      <p v-else class="hint">Lesen = nur ansehen · Eigene = zugewiesene Traktanden bearbeiten · Alles = das ganze Dokument bearbeiten. {{ linksSichtbar ? 'Klick auf eine Zeile zeigt den passenden Link.' : '' }}</p>

      <div class="teilen-liste">
        <div v-for="z in zeilen" :key="z.id" class="teilen-zeile" :class="{ gewaehlt: linksSichtbar && gewaehlt === z.id, klick: linksSichtbar && z.link }" @click="linksSichtbar && z.link && (gewaehlt = z.id)">
          <span class="avatar" :class="{ hell: !z.personId }">{{ z.initialen }}</span>
          <span class="text">
            <strong>{{ z.name }}</strong>
            <span class="leise small">{{ z.beschreibung }}</span>
          </span>
          <span v-if="z.personId" class="schalter" :class="{ gesetzt: z.gesetzt }" :title="z.gesetzt ? 'Für dieses Dokument gesetzt (weicht vom Standard ab)' : 'Standard'">
            <button v-for="(label, stufe) in FREIGABE_STUFEN" :key="stufe" type="button" :class="{ aktiv: z.stufe === stufe }" :disabled="!darfSetzen" @click.stop="setzen(z, stufe)">{{ label }}</button>
          </span>
          <span v-else class="schalter fix"><button type="button" class="aktiv" disabled>{{ z.fix }}</button></span>
        </div>
      </div>

      <div v-if="linksSichtbar && aktiverLink" class="linkleiste">
        <span class="text"><span class="leise small">Link für {{ aktiveZeile.name }}</span><code>{{ aktiverLink }}</code></span>
        <button type="button" class="btn btn-ghost" @click="kopieren">{{ kopiert ? 'Kopiert ✓' : 'Kopieren' }}</button>
      </div>

      <div v-if="darfSetzen && abweichungen" class="row mt-2">
        <button type="button" class="btn" @click="zuruecksetzen">Auf Standardfreigabe zurücksetzen</button>
        <span class="leise small">{{ abweichungen }} {{ abweichungen === 1 ? 'Abweichung' : 'Abweichungen' }} vom Standard</span>
      </div>
    </section>
  `,
  data() {
    return { gewaehlt: '', kopiert: false, FREIGABE_STUFEN }
  },
  computed: {
    gremium() {
      return gremienStore.byId(this.sitzung.gremiumId)
    },
    istPerson() {
      return rolleIm(this.sitzung.gremiumId) === 'person'
    },
    freigaben() {
      return this.sitzung.freigaben?.[this.dokument] || {}
    },
    abweichungen() {
      return Object.keys(this.freigaben).filter((id) => this.freigaben[id] !== standardStufe(this.sitzung, id)).length
    },
    gaeste() {
      return (this.dokument === 'protokoll' && this.protokoll?.gaeste) || this.vorprotokoll.gaeste
    },
    basis() {
      return location.href.split('#')[0]
    },
    zeilen() {
      const leitung = [...this.sitzung.sitzungsleitung, ...this.sitzung.protokollfuehrung].map((p) => p.id)
      const mitglieder = [...this.gremium.mitglieder].sort((a, b) => leitung.includes(b.id) - leitung.includes(a.id))
      const zeilen = mitglieder.map((m) => this.zeile(m, gremienStore.rolleName(this.gremium.id, m.rolleId), m.zugangsKey ? this.basis + '#/zugang/' + m.zugangsKey : ''))
      this.gaeste.filter((g) => g.name).forEach((g) => {
        const key = this.vorprotokoll.personenKeys?.[g.id]
        zeilen.push(this.zeile(g, g.organisation ? 'Gast · ' + g.organisation : 'Gast', key ? this.basis + '#/freigabe/' + key : ''))
      })
      if (this.dokument === 'vorprotokoll') {
        zeilen.push({ id: 'allgemein', name: 'Allgemeiner Link', beschreibung: 'Ganzes Vorprotokoll bearbeiten, ohne persönliche Zuordnung', initialen: '∞', fix: 'Alles', link: this.vorprotokoll.freigabeLinkKey ? this.basis + '#/freigabe/' + this.vorprotokoll.freigabeLinkKey : '' })
      } else {
        zeilen.push({ id: 'verfolger', name: 'Verfolger-Link', beschreibung: 'Nur mitlesen, während der Sitzung', initialen: '∞', fix: 'Lesen', link: this.protokoll?.verfolgerKey ? this.basis + '#/verfolgen/' + this.protokoll.verfolgerKey : '' })
      }
      return zeilen
    },
    aktiveZeile() {
      return this.zeilen.find((z) => z.id === this.gewaehlt) || this.zeilen.find((z) => z.link)
    },
    aktiverLink() {
      return this.aktiveZeile?.link || ''
    },
  },
  methods: {
    zeile(person, rolle, link) {
      const leitung = istLeitung(this.sitzung, person.id)
      const funktion = this.sitzung.sitzungsleitung.some((p) => p.id === person.id) ? 'Sitzungsleitung' : this.sitzung.protokollfuehrung.some((p) => p.id === person.id) ? 'Protokollführung' : ''
      const nummern = this.vorprotokoll.traktanden
        .map((t, i) => (istBerechtigt(t, person) || t.untertraktanden.some((u) => istBerechtigt(u, person)) ? i + 1 : 0))
        .filter(Boolean)
      const zuweisung = leitung ? funktion : nummern.length ? this.traktandenText(nummern) : 'kein Traktandum zugewiesen'
      const stufe = freigabeStufe(this.sitzung, this.dokument, person.id)
      return {
        id: person.id,
        personId: person.id,
        name: person.name,
        beschreibung: [rolle, zuweisung].filter(Boolean).join(' · '),
        initialen: this.initialen(person.name),
        stufe,
        gesetzt: stufe !== standardStufe(this.sitzung, person.id),
        link,
      }
    },
    traktandenText(nummern) {
      const wort = nummern.length === 1 ? 'Traktandum ' : 'Traktanden '
      if (nummern.length === 1) return wort + nummern[0]
      return wort + nummern.slice(0, -1).join(', ') + ' und ' + nummern[nummern.length - 1]
    },
    initialen(name) {
      return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((teil) => teil[0].toUpperCase())
        .join('')
    },
    setzen(zeile, stufe) {
      this.sitzung.freigaben ??= { vorprotokoll: {}, protokoll: {} }
      this.sitzung.freigaben[this.dokument] ??= {}
      if (stufe === standardStufe(this.sitzung, zeile.personId)) delete this.sitzung.freigaben[this.dokument][zeile.personId]
      else this.sitzung.freigaben[this.dokument][zeile.personId] = stufe
    },
    zuruecksetzen() {
      this.sitzung.freigaben[this.dokument] = {}
    },
    kopieren() {
      navigator.clipboard.writeText(this.aktiverLink)
      this.kopiert = true
      setTimeout(() => (this.kopiert = false), 2000)
    },
  },
}
