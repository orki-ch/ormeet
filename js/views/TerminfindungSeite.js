import { gremienStore } from '../stores/gremien.js'
import { sitzungenStore } from '../stores/sitzungen.js'
import { sync, laden, recht } from '../stores/sync.js'
import { api } from '../api.js'
import { nameMerken } from '../components/KontoKarte.js'
import { aktuellePerson, darfTerminfindung, darfTerminfindungFreigeben, einzelrecht, istLeitung, linksSichtbar, personIdIm, rolleIm, tfRecht, verwaltetSitzung, zurueckZu } from '../utils/rechte.js'
import { STIMME, formatDatum } from '../utils/labels.js'
import MenuDropdown from '../components/MenuDropdown.js'
import MiniKalender from '../components/MiniKalender.js'
import KurzTeilnehmende from '../components/KurzTeilnehmende.js'
import MehrfachAuswahl from '../components/MehrfachAuswahl.js'
import EinladungFenster from '../components/EinladungFenster.js'
import { bestaetigen, hinweis } from '../utils/dialog.js'

const WERTE = ['ja', 'vielleicht', 'nein']

// Terminfindung (Nuudel-artig): Optionen, Abstimmungsmatrix mit Summenzeile, Kommentare, Termin festlegen
export default {
  name: 'TerminfindungSeite',
  components: { EinladungFenster, KurzTeilnehmende, MehrfachAuswahl, MenuDropdown, MiniKalender },
  props: {
    sitzungId: { type: String, required: true },
  },
  template: `
    <div v-if="tf" class="stack-lg">
      <EinladungFenster v-if="einladungOffen" :sitzung-id="sitzungId" @schliessen="einladungOffen = false" />
      <header class="page-header" style="margin-bottom: 0">
        <router-link v-if="zurueck" :to="zurueck" class="rueck">← {{ zurueckText }}</router-link>
        <div class="kopf">
          <div>
            <p class="kicker">Terminfindung · {{ gremium.kurz ? 'Kurzsitzung' : gremium.name }} <span v-if="sitzung.ort">· {{ sitzung.ort }}</span></p>
            <h1 class="title">{{ sitzung.titel || 'Sitzung' }}</h1>
            <p v-if="tf.status === 'abgeschlossen'" class="small text-ok mt-1">Termin festgelegt: <strong>{{ formatDatum(sitzung.datum) }}, {{ sitzung.zeit }}</strong></p>
            <p v-else-if="ich" class="small muted mt-1">Du stimmst ab als <strong>{{ ich.name }}</strong>.</p>
            <p v-else-if="anonym" class="small muted mt-1">Trage unten deinen Namen ein und klicke die Termine an, die dir passen.</p>
          </div>
          <div class="actions">
            <router-link v-if="!sitzung.kurz && sync.zugriff?.rolle !== 'link' && !nurLinkDokument" :to="'/sitzung/' + sitzung.id + '/vorprotokoll'" class="btn">Vorprotokoll</router-link>
            <router-link v-else-if="sitzung.datum && !nurLinkDokument" :to="'/sitzung/' + sitzung.id + '/protokoll'" class="btn btn-primary">Zum Protokoll</router-link>
            <MenuDropdown v-if="voll || zugriffeVerwalten">
              <router-link v-if="zugriffeVerwalten" :to="'/sitzung/' + sitzung.id + '/zugriffe'" class="menu-item">Zugriffe verwalten</router-link>
              <button v-if="voll" class="menu-item" @click="csvExport">Ergebnis als CSV exportieren</button>
              <button v-if="voll && tf.status === 'abgeschlossen'" class="menu-item" :disabled="protokollMitEintraegen" :title="protokollMitEintraegen ? 'Das Protokoll dieser Sitzung enthält bereits Einträge – zuerst das Protokoll entfernen' : ''" @click="wiederOeffnen">Terminfindung wieder öffnen</button>
            </MenuDropdown>
          </div>
        </div>
      </header>

      <!-- Kurzsitzung: wer teilnimmt, stimmt ab (ohne Gremium hier einladen) -->
      <section v-if="sitzung.kurz && vorprotokoll && !protokoll" class="card" :class="{ bearbeitbar: voll }">
        <h2 class="card-title">Teilnehmende</h2>
        <KurzTeilnehmende :gremium="gremium" :ziel="vorprotokoll" feld="anwesendeMitgliederIds" :voll="voll" :links-sichtbar="linksSichtbar" />
      </section>

      <!-- Optionen & Einstellungen (Bearbeiter) -->
      <section v-if="voll && tf.status === 'offen'" class="card stack">
        <div>
          <h2 class="card-title">Terminvorschläge</h2>
          <p class="hint">Tage im Kalender anklicken (nochmals klicken entfernt sie). Jeder Vorschlag lässt sich in der Liste einzeln anpassen; die Zeit rechts gilt für neue Vorschläge und lässt sich auf die angekreuzten übertragen.</p>
          <div class="grid-3 termin-erfassung">
            <!-- Links: Kalender und manuelles Datum -->
            <div class="stack-sm">
              <MiniKalender :markiert="tf.optionen.map((o) => o.datum)" @wahl="tagUmschalten" />
              <form class="row" @submit.prevent="tagHinzufuegen(neu.datum)">
                <input v-model="neu.datum" type="date" class="input grow" required />
                <button class="btn btn-icon" title="Datum hinzufügen">+</button>
              </form>
            </div>
            <!-- Mitte: gewählte Termine, je direkt anpassbar -->
            <div class="stack-sm">
              <p v-if="!tf.optionen.length" class="muted small">Noch keine Vorschläge – links einen Tag wählen.</p>
              <div v-else class="row-nowrap small termin-titel">
                <input type="checkbox" :checked="alleGewaehlt" title="Alle auswählen" @change="alleWaehlen($event.target.checked)" />
                <span class="label grow">Start: Datum und Uhrzeit</span>
                <span class="label w-sm">Bis (optional)</span>
                <span class="btn btn-icon leer"></span>
              </div>
              <label v-for="(o, i) in tf.optionen" :key="o.id" class="row-nowrap small">
                <input v-model="gewaehlt" type="checkbox" :value="o.id" />
                <input :value="o.datum + 'T' + (o.von || '00:00')" type="datetime-local" class="input klein grow" title="Datum und Beginn" @change="zeitSetzen(o, $event.target.value)" />
                <input v-model="o.bis" type="time" class="input klein w-sm" title="Bis (optional)" @change="sortieren" />
                <button type="button" class="btn btn-ghost btn-icon text-err" title="Entfernen" @click="optionEntfernen(i)">✕</button>
              </label>
            </div>
            <!-- Rechts: Zeitvorgabe -->
            <div class="stack-sm">
              <label class="stack-xs"><span class="label">Von</span><input v-model="neu.von" type="time" class="input" /></label>
              <label class="stack-xs"><span class="label">Bis (optional)</span><input v-model="neu.bis" type="time" class="input" /></label>
              <button type="button" class="btn" :disabled="!gewaehlt.length" @click="zeitUebertragen">Auf ausgewählte übertragen</button>
            </div>
          </div>
        </div>
        <div v-if="darfFreigeben" class="stack-xs">
          <span class="label">Bearbeitung freigeben an</span>
          <MehrfachAuswahl v-model="tf.freigabe" :optionen="freigabeOptionen" placeholder="+ Rolle oder Person …" />
        </div>
        <div class="row" style="gap: 0.5rem 1.5rem">
          <label class="check small"><input v-model="tf.einzelwahl" type="checkbox" /> Nur eine Option mit «Ja» wählbar</label>
          <label class="check small"><input v-model="tf.verdeckt" type="checkbox" /> Verdeckt (Teilnehmende sehen nur die eigene Stimme)</label>
          <label class="check small"><input v-model="tf.bearbeitbar" type="checkbox" /> Teilnehmende dürfen ihre Stimme später ändern</label>
        </div>
      </section>

      <!-- Abstimmung -->
      <section class="card">
        <h2 class="card-title">Abstimmung</h2>
        <p v-if="!tf.optionen.length" class="muted small">Noch keine Terminvorschläge.</p>
        <div v-else class="matrix-wrap">
          <table class="matrix">
            <thead>
              <tr>
                <th></th>
                <th v-for="o in tf.optionen" :key="o.id" :class="{ best: besteIds.has(o.id), gewaehlt: o.id === tf.gewaehlteOptionId }">
                  <div class="datum">{{ formatDatum(o.datum) }}</div>
                  <div class="zeit">{{ o.von }}<span v-if="o.bis"> – {{ o.bis }}</span></div>
                </th>
                <th v-if="spalteAktion"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="z in zeilen" :key="z.key" :class="{ eigene: z.eigene }">
                <td class="name">{{ z.name }}<span v-if="z.eigene" class="leise"> (du)</span></td>
                <td v-for="o in tf.optionen" :key="o.id" :class="{ best: besteIds.has(o.id) }">
                  <button class="stimme" :class="z.wahl[o.id] || 'leer'" :disabled="!darfStimmen(z)" :title="z.wahl[o.id] || '–'" @click="stimmen(z, o.id)">{{ STIMME[z.wahl[o.id]] || '' }}</button>
                </td>
                <td v-if="spalteAktion" class="right">
                  <button v-if="z.personId && darfEntfernen(z) && tf.status === 'offen'" class="btn btn-ghost btn-icon" :title="z.eigene ? 'Ich kann nicht teilnehmen – entschuldigen' : 'Aus der Terminfindung entfernen (entschuldigt)'" @click="entfernen(z)">✕</button>
                  <button v-else-if="!z.personId && voll" class="btn btn-danger btn-icon" title="Zeile löschen" @click="zeileLoeschen(z)">✕</button>
                </td>
              </tr>
              <tr v-if="neueZeileErlaubt" class="neu">
                <td class="name"><input v-model.trim="neuerName" class="input" :placeholder="voll ? 'Weitere Person …' : 'Dein Name …'" /></td>
                <td v-for="o in tf.optionen" :key="o.id"><button class="stimme leer" :disabled="!neuerName" title="Stimme für diese Person eintragen" @click="stimmenNeu(o.id)"></button></td>
                <td v-if="spalteAktion"></td>
              </tr>
            </tbody>
            <tfoot v-if="ergebnisSichtbar">
              <tr>
                <td class="name muted">Ja / Vielleicht</td>
                <td v-for="o in tf.optionen" :key="o.id" :class="{ best: besteIds.has(o.id) }">
                  <strong>{{ summe(o.id).ja }}</strong><span class="leise"> / {{ summe(o.id).vielleicht }}</span>
                </td>
                <td v-if="spalteAktion"></td>
              </tr>
              <tr v-if="voll && tf.status === 'offen'">
                <td></td>
                <td v-for="o in tf.optionen" :key="o.id"><button class="btn btn-ghost" @click="festlegen(o)">Wählen</button></td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div v-if="entfernte.length" class="row mt-2 small">
          <span class="muted">Entschuldigt:</span>
          <span v-for="p in entfernte" :key="p.id" class="chip" :class="{ 'ohne-x': !darfEntfernen(p) }">
            {{ p.name }}
            <button v-if="darfEntfernen(p) && tf.status === 'offen'" type="button" class="chip-x" title="Wieder aufnehmen" @click="aufnehmen(p)">↺</button>
          </span>
        </div>
        <!-- Über einen allgemeinen Link mit Konto dazugekommen: Leitung / Aktuariat / Superadmin verknüpfen sie mit einem Mitglied -->
        <div v-if="weiterePersonen.length && darfVerknuepfen" class="stack-sm mt-2">
          <span class="label">Weitere Personen mit Konto</span>
          <div v-for="p in weiterePersonen" :key="p.id" class="row small">
            <span class="grow"><strong>{{ p.name }}</strong><span class="leise"> · {{ p.email }}</span></span>
            <select class="input klein w-lg" @change="verknuepfen(p, $event)">
              <option value="">Mit Mitglied verknüpfen …</option>
              <option v-for="m in gremium.mitglieder" :key="m.id" :value="m.id">{{ m.name }}{{ tf.entfernt.includes(m.id) ? ' (entfernt)' : '' }}</option>
            </select>
          </div>
        </div>
        <p v-if="tf.verdeckt && !voll" class="muted small mt-2">Verdeckte Abstimmung: du siehst nur deine eigene Stimme.</p>
        <p v-else-if="tf.optionen.length" class="muted small mt-2">Klick wechselt zwischen ✓ Ja, ? Vielleicht und ✕ Nein. Die Spalte mit den meisten Ja-Stimmen ist hervorgehoben.</p>
      </section>

      <!-- Kommentare -->
      <section class="card">
        <h2 class="card-title">Kommentare</h2>
        <div class="liste">
          <div v-for="k in tf.kommentare" :key="k.id" class="liste-zeile small top">
            <div class="grow"><strong>{{ k.name }}</strong> <span class="leise">{{ k.zeit }}</span><p class="pre mt-1">{{ k.text }}</p></div>
            <button v-if="voll" class="btn btn-danger btn-icon" @click="tf.kommentare.splice(tf.kommentare.indexOf(k), 1)">✕</button>
          </div>
        </div>
        <p v-if="!tf.kommentare.length" class="muted small">Noch keine Kommentare.</p>
        <form v-if="(ich && tfRecht(sitzung, 'kommentieren')) || voll || (anonym && darfAnonym('kommentieren'))" class="row mt-2" @submit.prevent="kommentieren">
          <input v-if="!ich" v-model.trim="neuerName" class="input w-md" placeholder="Name" required />
          <input v-model.trim="neuerKommentar" class="input grow" placeholder="Kommentar …" required />
          <button class="btn">Senden</button>
        </form>
      </section>
    </div>
    <p v-else class="muted">Zu dieser Sitzung gibt es keine Terminfindung.</p>
  `,
  data() {
    return { sync, neu: { datum: '', von: '19:00', bis: '' }, gewaehlt: [], neuerName: '', neuerKommentar: '', STIMME, einladungOffen: false }
  },
  computed: {
    alleGewaehlt() {
      return this.tf.optionen.length > 0 && this.tf.optionen.every((o) => this.gewaehlt.includes(o.id))
    },
    sitzung() {
      return sitzungenStore.sitzungById(this.sitzungId)
    },
    tf() {
      return this.sitzung?.terminfindung
    },
    // Ein Protokoll mit Einträgen hängt am Termin: die Terminfindung lässt sich dann nicht mehr öffnen
    protokollMitEintraegen() {
      return (sitzungenStore.protokollVonSitzung(this.sitzungId)?.eintraege.length || 0) > 0
    },
    gremium() {
      return gremienStore.byId(this.sitzung.gremiumId)
    },
    // Bearbeiten: wer die Sitzung eingetragen hat und wem die Bearbeitung freigegeben ist (sowie Superadmin / Eigentümer)
    voll() {
      return darfTerminfindung(this.sitzung)
    },
    darfFreigeben() {
      return darfTerminfindungFreigeben(this.sitzung)
    },
    freigabeOptionen() {
      const rollen = this.gremium.rollen.map((r) => ({ wert: 'rolle:' + r.id, label: 'Rolle: ' + r.name }))
      return [...rollen, ...this.gremium.mitglieder.map((m) => ({ wert: m.id, label: m.name }))]
    },
    // Entfernte (entschuldigte) Personen
    entfernte() {
      const gaeste = this.vorprotokoll?.gaeste || []
      return (this.tf.entfernt || []).map((id) => gremienStore.person(this.gremium.id, gaeste, id)).filter(Boolean)
    },
    weiterePersonen() {
      return (this.vorprotokoll?.gaeste || []).filter((g) => g.weiterePerson)
    },
    // Weitere Personen verknüpfen: Superadmin / Eigentümer, Gremium-Zugang mit Bearbeitungsrecht, Leitung und Protokollführung, Präsidium / Aktuariat
    darfVerknuepfen() {
      const rolle = rolleIm(this.gremium.id)
      if (rolle === 'admin') return true
      if (rolle === 'gremium') return recht('sitzungen', this.gremium.id) === 'bearbeiten'
      const personId = personIdIm(this.gremium.id)
      const mitglied = this.gremium.mitglieder.find((m) => m.id === personId)
      return rolle === 'person' && (istLeitung(this.sitzung, personId) || gremienStore.hatFesteRolle(this.gremium.id, mitglied))
    },
    spalteAktion() {
      return this.voll || (!!this.ich && this.tf.status === 'offen')
    },
    vorprotokoll() {
      return sitzungenStore.vorprotokollVonSitzung(this.sitzungId)
    },
    protokoll() {
      return sitzungenStore.protokollVonSitzung(this.sitzungId)
    },
    linksSichtbar() {
      return linksSichtbar(this.sitzung)
    },
    zugriffeVerwalten() {
      return verwaltetSitzung(this.sitzung)
    },
    // Abstimmende Person (Mitglied oder Gast hinter dem Zugang)
    ich() {
      const gaeste = sitzungenStore.vorprotokollVonSitzung(this.sitzungId)?.gaeste || []
      return aktuellePerson(this.gremium.id, gaeste)
    },
    // Über einen Terminfindungs-Link eingetragen: nur diese Seite
    nurLinkDokument() {
      return sync.zugriff?.rolle === 'freigabe' && !!sync.zugriff.dokument && sync.zugriff.dokument !== 'vorprotokoll'
    },
        // Allgemeiner Freigabe-Link oder zusätzlicher Link: keine feste Identität, Eintrag mit Namen
    anonym() {
      return (sync.zugriff?.rolle === 'freigabe' && !sync.zugriff.personId) || sync.zugriff?.rolle === 'link'
    },
    ergebnisSichtbar() {
      return this.voll || !this.tf.verdeckt
    },
    neueZeileErlaubt() {
      return (this.voll || (this.anonym && this.darfAnonym('abstimmen'))) && this.tf.status === 'offen'
    },
    // Zeilen: alle Mitglieder (auch nicht erwartete Rollen), Gäste, bereits abgegebene Stimmen (auch freie Namen);
    // die eigene Person steht immer in der Liste
    zeilen() {
      const gaeste = sitzungenStore.vorprotokollVonSitzung(this.sitzungId)?.gaeste || []
      // Kurzsitzung eines Gremiums: nur die Teilnehmenden
      const teilnehmende = this.sitzung.kurz && !this.gremium.kurz ? sitzungenStore.teilnehmende(this.sitzung) : null
      const entfernt = this.tf.entfernt || []
      const personen = [...this.gremium.mitglieder.filter((m) => !teilnehmende || teilnehmende.includes(m.id)), ...gaeste].filter((p) => !entfernt.includes(p.id))
      if (this.ich && !entfernt.includes(this.ich.id) && !personen.some((p) => p.id === this.ich.id)) personen.push(this.ich)
      const stimmeVon = (personId, name) => this.tf.stimmen.find((s) => (personId ? s.personId === personId : s.name === name))
      const zeile = (personId, name) => {
        const stimme = stimmeVon(personId, name)
        const wahl = Object.fromEntries((stimme?.wahl || []).map((w) => [w.optionId, w.wert]))
        return { key: personId || 'name:' + name, personId, name, wahl, stimme, eigene: !!this.ich && personId === this.ich.id }
      }
      const liste = this.ergebnisSichtbar ? personen.map((p) => zeile(p.id, p.name)) : this.ich && !entfernt.includes(this.ich.id) ? [zeile(this.ich.id, this.ich.name)] : []
      // eigene Zeile zuoberst
      liste.sort((a, b) => (b.eigene ? 1 : 0) - (a.eigene ? 1 : 0))
      const vorhanden = new Set(liste.map((z) => z.key))
      this.tf.stimmen.forEach((s) => {
        const key = s.personId || 'name:' + s.name
        if (!vorhanden.has(key) && !entfernt.includes(s.personId) && (this.ergebnisSichtbar || key === this.ich?.id)) liste.push(zeile(s.personId, s.name))
      })
      return liste
    },
    besteIds() {
      if (!this.ergebnisSichtbar || !this.tf.optionen.length) return new Set()
      const max = Math.max(...this.tf.optionen.map((o) => this.summe(o.id).ja))
      return new Set(max > 0 ? this.tf.optionen.filter((o) => this.summe(o.id).ja === max).map((o) => o.id) : [])
    },
    zurueck() {
      if (sync.zugriff?.rolle === 'link') return ''
      if (sync.zugriff?.rolle === 'freigabe') return this.sitzung.kurz || this.nurLinkDokument ? '' : `/sitzung/${this.sitzungId}/vorprotokoll`
      return zurueckZu(this.gremium.id).pfad
    },
    zurueckText() {
      return sync.zugriff?.rolle === 'freigabe' ? 'Vorprotokoll' : zurueckZu(this.gremium.id).text
    },
  },
  methods: {
    formatDatum,
    tfRecht,
    summe(optionId) {
      const werte = this.tf.stimmen.flatMap((s) => s.wahl.filter((w) => w.optionId === optionId).map((w) => w.wert))
      return { ja: werte.filter((w) => w === 'ja').length, vielleicht: werte.filter((w) => w === 'vielleicht').length }
    },
    darfStimmen(zeile) {
      if (this.tf.status !== 'offen') return false
      if (this.voll) return true
      if (this.anonym) return !zeile.personId && this.tf.bearbeitbar && this.darfAnonym('abstimmen') // namentliche Zeilen (keine Mitglieder / Gäste mit Link)
      return zeile.eigene && (this.tf.bearbeitbar || !zeile.stimme) && tfRecht(this.sitzung, 'abstimmen')
    },
    // Ohne Identität: allgemeiner Freigabe-Link darf abstimmen und kommentieren, ein zusätzlicher Link nach seinen Rechten
    darfAnonym(recht) {
      return sync.zugriff?.rolle !== 'link' || einzelrecht(this.sitzung, 'terminfindung', recht)
    },
    // Entfernen / wieder aufnehmen: wer die Terminfindung bearbeitet, und jede Person für sich selbst
    darfEntfernen(person) {
      return this.voll || (!!this.ich && (person.personId || person.id) === this.ich.id)
    },
    async entfernen(zeile) {
      const text = zeile.eigene ? 'Du wirst aus der Terminfindung entfernt und bist für diese Sitzung entschuldigt.' : `${zeile.name} wird aus der Terminfindung entfernt und ist für diese Sitzung entschuldigt.`
      if (!(await bestaetigen(text + ' Fortfahren?'))) return
      this.tf.entfernt.push(zeile.personId)
      if (this.vorprotokoll && !this.protokoll) this.vorprotokoll.anwesendeMitgliederIds = this.vorprotokoll.anwesendeMitgliederIds.filter((id) => id !== zeile.personId)
    },
    aufnehmen(person) {
      this.tf.entfernt = this.tf.entfernt.filter((id) => id !== person.id)
      const erwartet = gremienStore.erwarteteMitglieder(this.gremium.id).some((m) => m.id === person.id)
      if (erwartet && this.vorprotokoll && !this.protokoll && !this.vorprotokoll.anwesendeMitgliederIds.includes(person.id)) this.vorprotokoll.anwesendeMitgliederIds.push(person.id)
    },
    async verknuepfen(person, event) {
      const mitglied = this.gremium.mitglieder.find((m) => m.id === event.target.value)
      event.target.value = ''
      if (!mitglied || !(await bestaetigen(`${person.name} mit ${mitglied.name} verknüpfen? Stimmen und Kommentare gehen auf ${mitglied.name} über, und ${mitglied.name} ist wieder dabei.`))) return
      try {
        await api.anfrage('weitere_person_verknuepfen', this.gremium.id, { gastId: person.id, mitgliedId: mitglied.id })
        await laden()
      } catch (fehler) {
        hinweis(fehler.message)
      }
    },
    // Kalender-Klick: Tag hinzufügen, bei erneutem Klick alle Vorschläge dieses Tages entfernen
    tagUmschalten(datum) {
      const vorhanden = this.tf.optionen.map((o, i) => (o.datum === datum ? i : -1)).filter((i) => i >= 0)
      if (!vorhanden.length) return this.tagHinzufuegen(datum)
      vorhanden.reverse().forEach((i) => this.optionEntfernen(i))
    },
    // Neuer Vorschlag übernimmt die Zeitvorgabe rechts
    tagHinzufuegen(datum) {
      if (!datum) return
      this.tf.optionen.push({ id: crypto.randomUUID(), datum, von: this.neu.von, bis: this.neu.bis })
      this.sortieren()
    },
    zeitSetzen(option, wert) {
      const [datum, von] = wert.split('T')
      if (!datum) return
      option.datum = datum
      option.von = von || ''
      this.sortieren()
    },
    zeitUebertragen() {
      this.tf.optionen.filter((o) => this.gewaehlt.includes(o.id)).forEach((o) => Object.assign(o, { von: this.neu.von, bis: this.neu.bis }))
      this.sortieren()
    },
    sortieren() {
      this.tf.optionen.sort((a, b) => (a.datum + a.von).localeCompare(b.datum + b.von))
    },
    alleWaehlen(ja) {
      this.gewaehlt = ja ? this.tf.optionen.map((o) => o.id) : []
    },
    optionEntfernen(i) {
      const id = this.tf.optionen[i].id
      this.tf.optionen.splice(i, 1)
      this.gewaehlt = this.gewaehlt.filter((g) => g !== id)
      this.tf.stimmen.forEach((s) => (s.wahl = s.wahl.filter((w) => w.optionId !== id)))
    },
    // Klick: leer -> ja -> vielleicht -> nein -> ja …
    stimmen(zeile, optionId) {
      let stimme = zeile.stimme
      if (!stimme) {
        stimme = { personId: zeile.personId || null, name: zeile.name, wahl: [] }
        this.tf.stimmen.push(stimme)
      }
      const aktuell = stimme.wahl.find((w) => w.optionId === optionId)
      const naechster = WERTE[(WERTE.indexOf(aktuell?.wert) + 1) % WERTE.length]
      if (aktuell) aktuell.wert = naechster
      else stimme.wahl.push({ optionId, wert: naechster })
      if (this.tf.einzelwahl && naechster === 'ja') {
        stimme.wahl.forEach((w) => { if (w.optionId !== optionId && w.wert === 'ja') w.wert = 'nein' })
      }
    },
    // Bearbeiter: Stimme für eine weitere Person (freier Name) eintragen
    stimmenNeu(optionId) {
      const name = this.neuerName
      if (this.anonym) nameMerken(name) // geht beim Anlegen eines Kontos auf dieses über
      const zeile = this.zeilen.find((z) => !z.personId && z.name === name) || { personId: null, name, stimme: null }
      this.stimmen(zeile, optionId)
      this.neuerName = ''
    },
    zeileLoeschen(zeile) {
      if (zeile.stimme) this.tf.stimmen.splice(this.tf.stimmen.indexOf(zeile.stimme), 1)
    },
    kommentieren() {
      if (!this.ich) nameMerken(this.neuerName)
      this.tf.kommentare.push({
        id: crypto.randomUUID(),
        personId: this.ich?.id || null,
        name: this.ich?.name || this.neuerName,
        text: this.neuerKommentar,
        zeit: new Date().toLocaleString('de-CH', { dateStyle: 'short', timeStyle: 'short' }),
      })
      this.neuerKommentar = ''
    },
    async festlegen(option) {
      if (!(await bestaetigen(`${formatDatum(option.datum)}, ${option.von} als Sitzungstermin festlegen?`))) return
      sitzungenStore.terminFestlegen(this.sitzungId, option.id)
      // Wer die Sitzung verwaltet, kann gleich per E-Mail einladen (Kurzsitzungen ohne Vorprotokoll nicht)
      if (this.sitzung.kurz || !verwaltetSitzung(this.sitzung) || sync.zugriff?.ansicht) return
      if (!(await bestaetigen('Einladung jetzt per E-Mail senden?', { titel: 'Termin festgelegt', ja: 'Einladung senden', nein: 'Später' }))) return
      if (!sitzungenStore.vorprotokollVonSitzung(this.sitzungId)) sitzungenStore.erstelleVorprotokoll(this.sitzungId)
      this.einladungOffen = true
    },
    // Ein bereits gestartetes, noch leeres Protokoll geht mit dem Termin weg – sonst bliebe das Vorprotokoll gesperrt
    wiederOeffnen() {
      if (this.protokollMitEintraegen) return
      if (sitzungenStore.protokollVonSitzung(this.sitzungId)) sitzungenStore.loescheProtokoll(this.sitzungId)
      this.tf.status = 'offen'
      this.tf.gewaehlteOptionId = null
      this.sitzung.datum = ''
      this.sitzung.zeit = ''
      this.sitzung.status = 'terminfindung'
    },
    csvExport() {
      const kopf = ['Name', ...this.tf.optionen.map((o) => `${formatDatum(o.datum)} ${o.von}${o.bis ? '-' + o.bis : ''}`)]
      const zeilen = this.zeilen.map((z) => [z.name, ...this.tf.optionen.map((o) => z.wahl[o.id] || '')])
      const csv = [kopf, ...zeilen].map((z) => z.map((f) => `"${String(f).replaceAll('"', '""')}"`).join(';')).join('\n')
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
      a.download = `terminfindung-${this.sitzung.titel || 'sitzung'}.csv`
      a.click()
    },
  },
}
