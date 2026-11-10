import { AUFGABEN, BEREICHE, GREMIUMSRECHTE, ROLLEN_STUFEN, ROLLEN_TYPEN, SITZUNGSRECHTE, gremienStore, neuerZugang } from '../stores/gremien.js'
import { sitzungenStore } from '../stores/sitzungen.js'
import { sync, recht, gremiumLoeschen } from '../stores/sync.js'
import { EINZELRECHTE, FREIGABE_STUFEN, personIdIm, rolleIm } from '../utils/rechte.js'
import { bearbeitenMixin } from '../utils/bearbeiten.js'
import { neuerKey } from '../utils/keys.js'
import { SITZUNG_STATUS, SITZUNG_STATUS_KLASSE, formatDatum, sitzungStatus } from '../utils/labels.js'
import GremiumSuche from '../components/GremiumSuche.js'
import KurzsitzungDialog from '../components/KurzsitzungDialog.js'
import KurzsitzungenListe from '../components/KurzsitzungenListe.js'
import SitzungDialog from '../components/SitzungDialog.js'
import MenuDropdown from '../components/MenuDropdown.js'
import ZugriffeListe from '../components/ZugriffeListe.js'
import Modal from '../components/Modal.js'
import PersonenInput from '../components/PersonenInput.js'
import RechteSchalter from '../components/RechteSchalter.js'
import ThemenbereichLinks from '../components/ThemenbereichLinks.js'
import TraktandenListe from '../components/TraktandenListe.js'
import InfoKnopf from '../components/InfoKnopf.js'
import PersonSeite from './PersonSeite.js'
import MehrfachAuswahl from '../components/MehrfachAuswahl.js'
import { bestaetigen, hinweis } from '../utils/dialog.js'

// Einzelrechte einer Rolle («Individuell»), gruppiert für das ⋯-Menü des Rechte-Schalters
const ROLLEN_EINZELRECHTE = {
  Vorprotokoll: Object.fromEntries(Object.entries(EINZELRECHTE.vorprotokoll).map(([k, v]) => ['vorprotokoll:' + k, v])),
  Protokoll: Object.fromEntries(Object.entries(EINZELRECHTE.protokoll).map(([k, v]) => ['protokoll:' + k, v])),
  Sitzung: Object.fromEntries(Object.entries(SITZUNGSRECHTE).map(([k, v]) => ['sitzung:' + k, v])),
  Gremium: Object.fromEntries(Object.entries(GREMIUMSRECHTE).map(([k, v]) => ['gremium:' + k, v])),
}

const STUFEN_INFO = [
  { titel: 'Lesen', text: 'Nur ansehen.' },
  { titel: 'Eigene', text: 'Zugewiesene Traktanden und Einträge bearbeiten, die eigene Anwesenheit setzen.' },
  { titel: 'Individuell', text: 'Einzelrechte über ⋯ ein- und ausschalten: Vorprotokoll, Protokoll, Sitzung (eintragen, starten und abschliessen, Anträge entscheiden, Einladungen senden, Zugriffe verwalten) und Gremium (Reiter Kurzsitzungen, Mitglieder & Rollen, Protokoll-Einstellungen, Teilen).' },
  { titel: 'Alles', text: 'Wirklich alles: ganze Dokumente, alle Sitzungsrechte und alle Reiter der Gremium-Seite.' },
  { titel: 'Gilt für', text: 'Alle Mitglieder mit dieser Rolle in allen Sitzungen des Gremiums. Wer in einer Sitzung eine Aufgabe hat, hat dort ohnehin alles.' },
]

const AUFGABEN_INFO = [
  { titel: 'Sitzungsleitung, Protokollführung', text: 'Wer hier steht, übernimmt die Aufgabe automatisch in jeder neuen Sitzung und hat in allen Sitzungen des Gremiums sämtliche Bearbeitungsrechte: Vor- und Protokoll, Sitzung starten und abschliessen, Änderungsanträge entscheiden – bis das Protokoll genehmigt ist.' },
  { titel: 'Vertretung', text: 'Ist niemand mit der Aufgabe anwesend, bestimmt die Person, die die Sitzung eingetragen hat, oder wer Zugriffe verwaltet, eine Vertretung in den Kopfdaten. Spätestens beim Start der Sitzung muss sie feststehen.' },
]

// Kurzsitzungen: eigener Reiter neben den Sitzungen, mit denselben Rechten wie die Sitzungen
// Mitglieder (auch Superadmin und Eigentümer, die Mitglied sind) sehen zuerst ihre «Übersicht», alle anderen «Sitzungen»;
// danach die Verwaltungsreiter je nach Rechten (recht() in sync.js)
const TABS = { uebersicht: 'Übersicht', sitzungen: BEREICHE.sitzungen, kurzsitzungen: 'Kurzsitzungen', ...BEREICHE, teilen: 'Teilen', zugriffe: 'Zugriffe' }
const RECHTE = { keine: 'Nicht sichtbar', lesen: 'Nur lesen', bearbeiten: 'Bearbeiten' }

export default {
  name: 'GremiumDetail',
  components: { GremiumSuche, InfoKnopf, MehrfachAuswahl, KurzsitzungDialog, KurzsitzungenListe, MenuDropdown, Modal, PersonSeite, PersonenInput, RechteSchalter, SitzungDialog, ThemenbereichLinks, TraktandenListe, ZugriffeListe },
  mixins: [bearbeitenMixin],
  props: {
    gremiumId: { type: String, required: true },
  },
  template: `
    <div v-if="gremium" class="stack-lg">
      <header class="page-header" style="margin-bottom: 0">
        <router-link v-if="!['gremium', 'person'].includes(sync.zugriff?.rolle)" to="/" class="rueck">← Alle Gremien</router-link>
        <div class="row-nowrap top between">
          <div class="grow" style="max-width: 40rem">
            <input v-model.trim="gremium.name" class="input-inline title" :disabled="!darf('einstellungen')" />
            <input v-if="darf('einstellungen') || gremium.beschreibung" v-model.trim="gremium.beschreibung" class="input-inline muted mt-1" placeholder="Beschreibung" :disabled="!darf('einstellungen')" />
          </div>
          <MenuDropdown v-if="istAdmin">
            <button class="menu-item menu-item-danger" @click="loeschen">Gremium löschen</button>
          </MenuDropdown>
        </div>

        <nav v-if="Object.keys(sichtbareTabs).length > 1" class="tabs">
          <button v-for="(label, id) in sichtbareTabs" :key="id" class="tab" :class="{ aktiv: tab === id }" @click="tab = id">{{ label }}</button>
        </nav>
      </header>

      <!-- Tab: Sitzungen -->
      <PersonSeite v-if="tab === 'uebersicht'" :gremium-id="gremiumId" eingebettet />

      <GremiumSuche v-if="tab === 'sitzungen'" :gremium-id="gremiumId" />
      <fieldset v-if="tab === 'sitzungen'" :disabled="!darf('sitzungen')" class="card">
        <div class="card-head">
          <h2 class="card-title">Sitzungen</h2>
          <button v-if="darf('sitzungen')" class="btn btn-primary" @click="sitzungDialog = true">+ Sitzung</button>
        </div>
        <p v-if="!sitzungen.length" class="muted small">Noch keine Sitzungen erfasst.</p>
        <div v-else class="zeilen" style="--spalten: auto 2fr auto 1fr">
          <div v-for="s in sitzungen" :key="s.id" class="zeile">
            <span class="nowrap"><strong :class="{ 'text-warn': !s.datum }">{{ formatDatum(s.datum) }}</strong><span class="leise">&nbsp;{{ s.zeit }}</span></span>
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

      <!-- Tab: Kurzsitzungen (Einmalsitzungen ohne Vorprotokoll, nicht im üblichen Ablauf) -->
      <section v-if="tab === 'kurzsitzungen'" class="card">
        <div class="card-head">
          <h2 class="card-title">Kurzsitzungen</h2>
          <button v-if="darf('kurzsitzungen')" class="btn btn-primary" @click="kurzDialog = true">+ Kurzsitzung</button>
        </div>
        <KurzsitzungenListe :sitzungen="kurzsitzungen" :darf-loeschen="(s) => darf('sitzungen') || (darf('kurzsitzungen') && s.erstelltVon === eigenePersonId)" />
      </section>
      <KurzsitzungDialog v-if="kurzDialog" :gremium-id="gremiumId" @schliessen="kurzDialog = false" />

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
              <span class="muted">{{ rolleName(m.rolleId) }}<span v-if="aufgabenVon(m.id)" class="badge brand" style="margin-left: 0.4rem">{{ aufgabenVon(m.id) }}</span></span>
              <span class="small nowrap" :class="m.hatStimmrecht ? 'text-ok' : 'leise'">{{ m.hatStimmrecht ? '✓ Stimmrecht' : 'ohne Stimmrecht' }}</span>
            </div>
          </div>
        </section>

        <div class="stack-lg">
        <section class="card">
          <div class="card-head">
            <h2 class="card-title">Aufgaben</h2>
            <InfoKnopf rechts titel="Aufgaben in jeder Sitzung" :punkte="AUFGABEN_INFO" />
          </div>
          <div class="stack-sm">
            <div v-for="(label, aufgabe) in AUFGABEN" :key="aufgabe">
              <span class="label">{{ label }}</span>
              <MehrfachAuswahl :model-value="gremium.aufgaben?.[aufgabe] || []" :optionen="mitgliedOptionen" :disabled="!darf('mitglieder')" placeholder="+ Mitglied wählen …" @update:model-value="aufgabeSetzen(aufgabe, $event)" />
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
                <label class="check small"><input v-model="r.sollAnwesend" type="checkbox" /> An Sitzungen erwartet
                  <InfoKnopf titel="An Sitzungen erwartet" text="Nicht erwartete Rollen (z. B. regelmässige Gäste) sind standardmässig nicht als anwesend markiert und erscheinen nicht bei den Entschuldigten." /></label>
                <!-- Rechte der Rolle: ein Hauptschalter, «Individuell» über ⋯ -->
                <div class="row small rolle-recht">
                  <span class="grow">Rechte <InfoKnopf titel="Rechte der Rolle" :punkte="STUFEN_INFO" /></span>
                  <RechteSchalter :stufe="gremienStore.rolleStufe(r)" :stufen="ROLLEN_STUFEN" :rechte="r.rechte?.einzel || []" :einzelrechte="ROLLEN_EINZELRECHTE" :gesetzt="!!r.rechte?.stufe"
                    @stufe="rolleSetzen(r, { stufe: $event })" @rechte="rolleSetzen(r, { stufe: 'individuell', einzel: $event })" @zuruecksetzen="rolleSetzen(r, null)" />
                </div>
                <p v-if="r.typ" class="leise small">Vorlage «{{ ROLLEN_TYPEN[r.typ] }}» <InfoKnopf text="Kann umbenannt und angepasst, aber nicht gelöscht werden. Standard: «Alles»." /></p>
              </div>
              <div v-else class="liste-zeile small" :class="{ klick: darf('mitglieder') }" @click="darf('mitglieder') && (aktiv = r.id)">
                <span class="grow">{{ r.name }}</span>
                <span class="leise">{{ ROLLEN_STUFEN[gremienStore.rolleStufe(r)] || 'Individuell' }}</span>
                <span v-if="r.typ" class="badge brand">Vorlage</span>
                <span v-if="r.sollAnwesend === false" class="leise">nicht erwartet</span>
              </div>
            </div>
          </div>
          <form v-if="darf('mitglieder')" class="row mt-2" @submit.prevent="rolleHinzufuegen">
            <input v-model.trim="neueRolle" class="input grow" placeholder="Neue Rolle …" required />
            <button class="btn btn-icon">+</button>
          </form>
        </section>
        </div>
      </fieldset>

      <!-- Tab: Protokoll-Einstellungen -->
      <fieldset v-if="tab === 'einstellungen'" :disabled="!darf('einstellungen')" class="stack-lg">
        <section class="card">
          <h2 class="card-title">Themenbereiche <InfoKnopf titel="Themenbereiche" text="Ordnen Traktanden und Einträge thematisch; pro Themenbereich gibt es eine historische Übersicht." /></h2>
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
          <h2 class="card-title">Vorprotokoll-Vorlagen <InfoKnopf titel="Vorprotokoll-Vorlagen" text="Beim Erfassen einer Sitzung wählbar. Kopfdaten und Traktanden werden ins Vorprotokoll übernommen." /></h2>

          <details v-for="v in gremium.vorlagen" :key="v.id" class="vorlage">
            <summary>{{ v.name }} <span class="sub">{{ v.traktanden.length }} Traktanden</span></summary>
            <div class="inhalt stack">
              <div class="grid-2">
                <div><span class="label">Name der Vorlage</span><input v-model.trim="v.name" class="input" /></div>
                <div><span class="label">Titel / Sitzungsgrund</span><input v-model.trim="v.titel" class="input" /></div>
                <div><span class="label">Sitzungsleitung</span><PersonenInput v-model="v.sitzungsleitung" :personen="personen" placeholder="Name eingeben oder wählen (leer = Aufgabe Sitzungsleitung)" /></div>
                <div><span class="label">Protokollführung</span><PersonenInput v-model="v.protokollfuehrung" :personen="personen" placeholder="Name eingeben oder wählen (leer = Aufgabe Protokollführung)" /></div>
                <div class="span-alle"><span class="label">Spezielles / Bemerkungen</span><input v-model.trim="v.bemerkungen" class="input" /></div>
              </div>
              <h3>Traktanden</h3>
              <TraktandenListe :traktanden="v.traktanden" :themenbereiche="gremium.themenbereiche" :personen="personen" :bearbeiter-auswahl="bearbeiterAuswahl" :nur-lesen="!darf('einstellungen')" />

              <div v-if="darf('einstellungen') && sitzungenOhneProtokoll.length" class="block-soft stack-sm">
                <h3 style="margin: 0">Auf bestehende Sitzungen anwenden <InfoKnopf titel="Auf bestehende Sitzungen anwenden" text="Hat sich die Vorlage geändert, kannst du sie auf Sitzungen übertragen, die noch kein Protokoll haben. Kopfdaten und Traktanden des Vorprotokolls werden dabei durch die Vorlage ersetzt; automatisch übernommene Pendenzen und vertagte Anträge bleiben." /></h3>
                <div class="row" style="gap: 0.25rem 1.5rem">
                  <label v-for="s in sitzungenOhneProtokoll" :key="s.id" class="check small">
                    <input v-model="anwendenAuf[v.id]" type="checkbox" :value="s.id" /> {{ formatDatum(s.datum) }}<span class="leise">&nbsp;{{ s.titel }}{{ s.vorlageId === v.id ? ' · mit dieser Vorlage erfasst' : '' }}</span>
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
          <h2 class="card-title">Erinnerung <InfoKnopf titel="Erinnerung" text="So viele Tage vor einer Sitzung erinnert Ormeet die Beteiligten – in der Glocke und, falls eingerichtet, per E-Mail." /></h2>
          <label class="row small"><input v-model.number="gremium.erinnerungTage" class="input w-sm" type="number" min="0" max="60" /> Tage vorher</label>
        </section>

        <section class="card">
          <h2 class="card-title">Fusstext <InfoKnopf titel="Fusstext" text="Erscheint am Ende jedes Protokolls." /></h2>
          <textarea v-model.trim="gremium.fusstext" class="input" rows="2"></textarea>
        </section>
      </fieldset>

      <!-- Tab: Teilen (Superadmin, Eigentümer, Rollen mit dem Gremiumsrecht «Teilen») -->
      <section v-if="tab === 'teilen'" class="card">
        <h2 class="card-title">Gremium teilen <InfoKnopf titel="Gremium teilen" text="Jeder Link hat eigene Rechte pro Bereich. Wer ihn öffnet, sieht nur die freigegebenen Bereiche und kann nur dort ändern, wo «Bearbeiten» gesetzt ist." /></h2>

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

      <!-- Tab: Zugriffe (Eigentümer, Superadmin, Rollen mit «Zugriffe verwalten»): wer Zugriff hat und worüber -->
      <section v-if="tab === 'zugriffe'" class="card">
        <h2 class="card-title">Wer hat Zugriff? <InfoKnopf titel="Wer hat Zugriff?" text="Mitglieder mit ihren Zugängen, die Gremium-Links und pro Sitzung die Gäste und allgemeinen Links. Über ⋯ sperrst du Zugänge, erneuerst Links oder versiehst allgemeine Links mit Passwort und Ablauf." /> <router-link to="/hilfe?zu=zugaenge" class="hilfe-knopf" title="Hilfe: Zugriffe mit Ablaufgrafiken" aria-label="Hilfe zu den Zugriffen">?</router-link></h2>
        <ZugriffeListe :gremium-id="gremiumId" />
      </section>

      <!-- Dialog: Mitglied -->
      <Modal v-if="mitglied" :titel="mitglied.id ? 'Mitglied bearbeiten' : 'Neues Mitglied'" @schliessen="mitglied = null">
        <form id="formular-mitglied" class="stack" @submit.prevent="mitgliedSpeichern">
          <div><span class="label">Name</span><input v-model.trim="mitglied.name" class="input" required autofocus :disabled="!!mitglied.benutzerId" :title="mitglied.benutzerId ? 'Kommt vom verknüpften Konto' : null" /></div>
          <div><span class="label">E-Mail</span><input v-model.trim="mitglied.email" class="input" type="email" :disabled="!!mitglied.benutzerId" :title="mitglied.benutzerId ? 'Kommt vom verknüpften Konto' : null" /></div>
          <p v-if="mitglied.benutzerId" class="small muted">Name und E-Mail kommen vom verknüpften Konto. Den Namen ändert die Person selbst unter «Mein Konto».</p>
          <div>
            <span class="label">Rolle</span>
            <select v-model="mitglied.rolleId" class="input">
              <option v-for="r in gremium.rollen" :key="r.id" :value="r.id">{{ r.name }}</option>
            </select>
          </div>
          <label class="check"><input v-model="mitglied.hatStimmrecht" type="checkbox" /> Stimmberechtigt</label>
          <div v-if="kontenVerwalten" class="block-soft stack-sm">
            <span class="label" style="margin: 0">Konto <InfoKnopf titel="Konto" text="Mit einem Konto sieht die Person dieses Gremium in ihrer Übersicht – zusätzlich zum persönlichen Link. Name und E-Mail kommen dann vom Konto. Ein verknüpfter persönlicher Link öffnet nur noch nach der Anmeldung." /></span>
            <select v-model="mitglied.benutzerId" class="input" @change="kontoGewaehlt">
              <option :value="null">Kein Konto verknüpft</option>
              <option v-for="k in kontoAuswahl" :key="k.id" :value="k.id">{{ k.name }} · {{ k.email }}</option>
            </select>
          </div>
          <p v-else-if="mitglied.benutzerId" class="small muted">Mit einem Konto verknüpft ({{ kontoName(mitglied.benutzerId) }}).</p>
          <div v-if="mitglied.id && mitglied.zugangsKey" class="block-soft stack-sm">
            <span class="label" style="margin: 0">Persönlicher Link <InfoKnopf titel="Persönlicher Link" text="Zeigt dieser Person ihre Sitzungen, Terminfindungen und Pendenzen. Bearbeiten kann sie, was ihre Rolle erlaubt – mit einer Aufgabe (Sitzungsleitung, Protokollführung) alles." /></span>
            <div class="row">
              <button type="button" class="btn" @click="mitgliedLinkKopieren">{{ kopiert === mitglied.id ? 'Kopiert ✓' : 'Link kopieren' }}</button>
              <button type="button" class="btn btn-ghost" @click="mitgliedLinkErneuern">Erneuern</button>
            </div>
          </div>
        </form>
        <template #fuss>
          <div class="row">
            <button v-if="mitglied.id" type="button" class="btn btn-danger" @click="mitgliedEntfernen">Entfernen</button>
            <button type="button" class="btn ml-auto" @click="mitglied = null">Abbrechen</button>
            <button form="formular-mitglied" class="btn btn-primary">Speichern</button>
          </div>
        </template>
      </Modal>

      <!-- Dialog: Sitzung -->
      <SitzungDialog v-if="sitzungDialog" :gremium-id="gremiumId" @schliessen="sitzungDialog = false" />
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
      kurzDialog: false,
      neueRolle: '',
      neuerThemenbereich: { name: '', farbe: '#b4c410' },
      neueVorlage: '',
      anwendenAuf: {}, // pro Vorlage: gewählte Sitzungs-IDs
      angewendet: '',
      ROLLEN_TYPEN,
      ROLLEN_STUFEN,
      ROLLEN_EINZELRECHTE,
      STUFEN_INFO,
      AUFGABEN,
      AUFGABEN_INFO,
      FREIGABE_STUFEN,
      EINZELRECHTE,
      SITZUNG_STATUS,
      SITZUNG_STATUS_KLASSE,
      sync,
      gremienStore,
    }
  },
  computed: {
    gremium() {
      return gremienStore.byId(this.gremiumId)
    },
    sitzungen() {
      return sitzungenStore.sitzungenVonGremium(this.gremiumId)
    },
    kurzsitzungen() {
      return sitzungenStore.kurzsitzungen(this.gremiumId)
    },
    sitzungenOhneProtokoll() {
      return sitzungenStore.sitzungenOhneProtokoll(this.gremiumId)
    },
    personen() {
      return gremienStore.personen(this.gremiumId)
    },
    mitgliedOptionen() {
      return this.gremium.mitglieder.map((m) => ({ wert: m.id, label: m.name }))
    },
    bearbeiterAuswahl() {
      return gremienStore.bearbeiterAuswahl(this.gremiumId)
    },
    // Superadmin oder Eigentümer (Konto, das dieses Gremium angelegt hat)
    istAdmin() {
      return rolleIm(this.gremiumId) === 'admin'
    },
    // Eigenes Mitglied (persönlicher Link / Konto): eigene Kurzsitzungen löschen
    eigenePersonId() {
      return personIdIm(this.gremiumId)
    },
    istSuperadmin() {
      return sync.zugriff?.rolle === 'admin'
    },
    // Konto verknüpfen / lösen: Superadmin (alle Konten) und Eigentümer (Konten aus seinen Gremien)
    kontenVerwalten() {
      return this.istSuperadmin || (sync.zugriff?.rolle === 'benutzer' && this.istAdmin)
    },
    // Konto mit der E-Mail des Mitglieds zuoberst
    kontoAuswahl() {
      const email = (this.mitglied?.email || '').toLowerCase()
      return [...sync.konten].sort((a, b) => (b.email.toLowerCase() === email) - (a.email.toLowerCase() === email))
    },
    sichtbareTabs() {
      const tabs = {}
      for (const [id, label] of Object.entries(TABS)) {
        if (id === 'uebersicht' ? !!this.eigenePersonId : id === 'sitzungen' ? !this.eigenePersonId && recht(id, this.gremiumId) !== 'keine' : recht(id, this.gremiumId) !== 'keine') tabs[id] = label
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
    async linkErneuern(zugang) {
      if (await bestaetigen('Link erneuern? Der bisherige Link wird sofort ungültig.')) zugang.key = neuerKey()
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
    async mitgliedLinkErneuern() {
      if (await bestaetigen('Persönlichen Link erneuern? Der bisherige Link wird sofort ungültig.')) this.mitglied.zugangsKey = neuerKey()
    },
    // Neu verknüpftes Konto: Name und E-Mail übernehmen (der Server tut es beim Speichern ebenfalls)
    kontoGewaehlt() {
      const konto = sync.konten.find((k) => k.id === this.mitglied.benutzerId)
      if (konto) Object.assign(this.mitglied, { name: konto.name, email: konto.email })
    },
    async mitgliedSpeichern() {
      const liste = this.gremium.mitglieder
      const index = liste.findIndex((m) => m.id === this.mitglied.id)
      if (index >= 0 && liste[index].benutzerId && !this.mitglied.benutzerId) {
        if (!(await bestaetigen(`Konto von «${this.mitglied.name}» lösen? Die Person sieht dieses Gremium dann nicht mehr in ihrer Übersicht; ihr persönlicher Link bleibt gültig.`, { titel: 'Konto lösen', ja: 'Lösen' }))) return
      }
      if (index >= 0) liste[index] = this.mitglied
      else liste.push({ ...this.mitglied, id: crypto.randomUUID(), zugangsKey: neuerKey() })
      this.mitglied = null
    },
    mitgliedEntfernen() {
      this.gremium.mitglieder = this.gremium.mitglieder.filter((m) => m.id !== this.mitglied.id)
      this.mitglied = null
    },
    // Rechte der Rolle setzen: { stufe } bzw. { stufe: 'individuell', einzel }; null = zurück auf den Standard
    rolleSetzen(r, rechte) {
      r.rechte = rechte || {}
    },
    // Zentral hinterlegte Aufgaben (Mitglied-IDs)
    aufgabeSetzen(aufgabe, ids) {
      this.gremium.aufgaben ??= { sitzungsleitung: [], protokollfuehrung: [] }
      this.gremium.aufgaben[aufgabe] = ids
    },
    aufgabenVon(personId) {
      return Object.entries(AUFGABEN).filter(([a]) => this.gremium.aufgaben?.[a]?.includes(personId)).map(([, label]) => label).join(' · ')
    },
    rolleHinzufuegen() {
      this.gremium.rollen.push({ id: crypto.randomUUID(), name: this.neueRolle, typ: null, sollAnwesend: true, rechte: {} })
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
    async vorlageAnwenden(vorlage) {
      const ids = this.anwendenAuf[vorlage.id]
      if (!(await bestaetigen(`Vorlage «${vorlage.name}» auf ${ids.length} ${ids.length === 1 ? 'Sitzung' : 'Sitzungen'} anwenden? Bestehende Traktanden dieser Vorprotokolle werden ersetzt.`))) return
      ids.forEach((id) => sitzungenStore.wendeVorlageAn(id, vorlage.id))
      this.anwendenAuf[vorlage.id] = []
      this.angewendet = vorlage.id
      setTimeout(() => (this.angewendet = ''), 3000)
    },
    async sitzungLoeschen(sitzung) {
      if (sitzung.genehmigt) {
        hinweis('Das Protokoll dieser Sitzung wurde an der Sitzung vom ' + formatDatum(sitzung.genehmigt.datum) + ' genehmigt. Es kann erst gelöscht werden, wenn jene Sitzung gelöscht wird.')
        return
      }
      if (await bestaetigen('Sitzung vom ' + formatDatum(sitzung.datum) + ' inkl. Protokoll löschen?', { gefahr: true })) {
        sitzungenStore.loescheSitzung(sitzung.id)
      }
    },
    async loeschen() {
      if (!(await bestaetigen('Gremium «' + this.gremium.name + '» inkl. aller Sitzungen unwiderruflich löschen?', { gefahr: true }))) return
      await gremiumLoeschen(this.gremiumId)
      sitzungenStore.loescheSitzungenVonGremium(this.gremiumId)
      gremienStore.loesche(this.gremiumId)
      if (sync.zugriff.rolle === 'benutzer') sync.zugriff.gremien = sync.zugriff.gremien.filter((g) => g.gremiumId !== this.gremiumId)
      this.$router.push('/')
    },
  },
}
