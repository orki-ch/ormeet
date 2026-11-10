import { AUFGABEN, gremienStore } from '../stores/gremien.js'
import { sitzungenStore } from '../stores/sitzungen.js'
import { sync, speichern as serverSpeichern } from '../stores/sync.js'
import { EINZELRECHTE, aktuellePerson, darfAenderungEntscheiden, darfAenderungStellen, darfAufgabenBestimmen, darfEigene, darfStarten, einzelrecht, istGenehmigt, istIndividuell, linksSichtbar, verwaltetSitzung, vollzugriff, rolleIm, zurueckZu, zuschnittSicht } from '../utils/rechte.js'
import { allePunkte, dauerSumme, istAntragPunkt, istBerechtigt, kindTyp, personenText, wirksamerTyp } from '../utils/traktanden.js'
import { PENDENZ_STATUS, SITZUNG_STATUS, SITZUNG_STATUS_KLASSE, PUNKT_TYP, TYP_BADGE, formatDatum, formatDauer, sitzungStatus } from '../utils/labels.js'
import { springeZu } from '../utils/springen.js'
import EintragListe from '../components/EintragListe.js'
import GaesteListe from '../components/GaesteListe.js'
import MenuDropdown from '../components/MenuDropdown.js'
import PdfExportButton from '../components/PdfExportButton.js'
import PendenzUebertragen from '../components/PendenzUebertragen.js'
import RechteFenster from '../components/RechteFenster.js'
import SitzungKopfdaten from '../components/SitzungKopfdaten.js'
import Unterpunkte from '../components/Unterpunkte.js'
import Zusatztraktanden from '../components/Zusatztraktanden.js'
import KurzTeilnehmende from '../components/KurzTeilnehmende.js'
import Aenderungsantraege from '../components/Aenderungsantraege.js'
import Modal from '../components/Modal.js'
import { neuerKey } from '../utils/keys.js'
import { neuesTraktandum } from '../utils/traktanden.js'
import { bestaetigen, hinweis } from '../utils/dialog.js'
import { hatAbgesagt } from '../utils/einladungen.js'
import { gleich, zusammenfuehren } from '../utils/zusammenfuehren.js'

export default {
  name: 'ProtokollEditor',
  components: { EintragListe, GaesteListe, MenuDropdown, Modal, PdfExportButton, PendenzUebertragen, RechteFenster, SitzungKopfdaten, Unterpunkte, Zusatztraktanden, KurzTeilnehmende, Aenderungsantraege },
  props: {
    sitzungId: { type: String, required: true },
  },
  template: `
    <div v-if="protokoll" class="stack-lg" :class="{ 'aenderung-modus': darfStellen }">
      <header class="page-header" style="margin-bottom: 0">
        <router-link v-if="zurueck" :to="zurueck" class="rueck">← {{ zurueckText }}</router-link>
        <div class="kopf">
          <div>
            <p class="kicker">
              {{ kurz ? 'Kurzsitzung' : 'Protokoll' }} · {{ formatDatum(sitzung.datum) }}
              <span class="badge" :class="SITZUNG_STATUS_KLASSE[sitzungStatus(sitzung)]" style="margin-left: 0.25rem">{{ SITZUNG_STATUS[sitzungStatus(sitzung)] }}</span>
            </p>
            <h1 class="title">{{ sitzung.titel || 'Sitzung' }}</h1>
            <p v-if="linkKopiert" class="small text-ok mt-1">Verfolger-Link kopiert – wer ihn öffnet, sieht das Protokoll live (nur lesen).</p>
            <p v-else-if="genehmigt" class="small text-ok mt-1">Genehmigt an der Sitzung vom {{ formatDatum(sitzung.genehmigt.datum) }} – dieses Protokoll kann nicht mehr bearbeitet werden.</p>
            <p v-else-if="darfStellen" class="muted small mt-1">Abgeschlossen – eine Änderung beantragst du per Klick auf den betreffenden Punkt.</p>
            <p v-else-if="person && !voll && !eigene" class="muted small mt-1">Dieses Protokoll ist für dich nur zum Lesen freigegeben.</p>
            <p v-else-if="person && !voll" class="muted small mt-1">Bereiche mit farbigem Rahmen kannst du bearbeiten; alles andere ist nur lesbar.</p>
          </div>
          <div class="actions">
            <span class="small" :class="speicherKlasse" title="Ctrl+S speichert sofort">● {{ speicherText }}</span>
            <button v-if="darfStarten(sitzung) && sitzung.status !== 'abgeschlossen'" class="btn btn-primary" @click="abschliessen">{{ kurz ? 'Kurzsitzung abschliessen' : 'Sitzung abschliessen' }}</button>
            <MenuDropdown>
              <button class="menu-item" @click="speichern">Jetzt speichern <span class="leise">Ctrl+S</span></button>
              <PdfExportButton typ="protokoll" :sitzung-id="sitzungId" class="menu-item" @click.capture="speichern" />
              <button v-if="linksSichtbar" class="menu-item" @click="verfolgerLinkKopieren">Verfolger-Link kopieren</button>
              <router-link v-if="zugriffeVerwalten" :to="'/sitzung/' + sitzungId + '/zugriffe'" class="menu-item">Zugriffe verwalten</router-link>
              <button v-if="!kurz" class="menu-item" @click="$router.push('/sitzung/' + sitzungId + '/vorprotokoll')">Zum Vorprotokoll</button>
              <button v-if="darfStarten(sitzung) && sitzung.status === 'abgeschlossen'" class="menu-item" @click="sitzung.status = 'laufend'">{{ kurz ? 'Kurzsitzung' : 'Sitzung' }} wieder öffnen</button>
              <button v-if="darfEntfernen && !kurz" class="menu-item menu-item-danger" @click="entfernen">Protokoll entfernen</button>
              <span v-if="genehmigt" class="menu-item leise">Genehmigt – nur lesbar</span>
            </MenuDropdown>
          </div>
        </div>
      </header>

      <!-- Änderungsanträge nach Abschluss: Leitung sieht alle, wer beantragt hat, die eigenen -->
      <Aenderungsantraege v-if="darfStellen || antraegeSichtbar.length" :liste="antraegeSichtbar" :alle="gespeichertesProtokoll.aenderungsantraege" :sicht-alle="siehtAlleAntraege" :darf-entscheiden="darfEntscheiden" :darf-stellen="darfStellen" :person-id="person?.id || null" :entscheider-name="person?.name || 'Verwaltung'" />

      <SitzungKopfdaten :sitzung="sitzung" :personen="personen" :nur-lesen="!voll" :aufgaben-bestimmen="!genehmigt && darfAufgabenBestimmen(sitzung)" />

      <section v-if="kurz" class="card" :class="{ bearbeitbar: voll || person }">
        <h2 class="card-title">Teilnehmende</h2>
        <KurzTeilnehmende :gremium="gremium" :ziel="protokoll" feld="anwesende" :voll="voll" :person-id="eigene ? person?.id : null" :links-sichtbar="linksSichtbar" />
        <div class="row mt-3">
          <strong class="small">Gäste</strong>
          <GaesteListe :gaeste="protokoll.gaeste" :nur-lesen="!voll" :rechte="rechteSetzen ? (gast) => (rechteFuer = gast.id) : null" :individuell="hatIndividuell" :link-kopieren="(gast) => personenLink(gast.id) && linkKopieren(gast.id)" :hat-link="(gast) => !!personenLink(gast.id)" />
        </div>
      </section>
      <section v-else class="card" :class="{ bearbeitbar: voll || person }">
        <h2 class="card-title">Anwesenheit</h2>
        <div class="row" style="gap: 0.25rem 1.5rem">
          <label v-for="m in gremium.mitglieder" :key="m.id" class="check" :class="{ aus: !darfAnwesenheit(m) }">
            <input v-model="protokoll.anwesende" type="checkbox" :value="m.id" :disabled="!darfAnwesenheit(m)" /> {{ m.name }}
            <button v-if="personenLink(m.id)" type="button" class="btn btn-ghost btn-icon rechte-knopf" :title="kopiert === m.id ? 'Kopiert ✓' : 'Link von ' + m.name + ' kopieren'" @click.prevent="linkKopieren(m.id)"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg></button>
            <button v-if="rechteSetzen" type="button" class="btn btn-ghost btn-icon rechte-knopf" :class="{ gesetzt: hatIndividuell(m.id) }" :title="'Individuelle Rechte von ' + m.name" @click.prevent="rechteFuer = m.id"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10"/><path d="M18 7h2"/><circle cx="16" cy="7" r="2"/><path d="M4 17h4"/><path d="M12 17h8"/><circle cx="10" cy="17" r="2"/></svg></button>
          </label>
        </div>
        <p class="muted small mt-2">Abwesend / entschuldigt: {{ namen(abwesende) }}</p>
        <div class="row mt-3">
          <strong class="small">Gäste</strong>
          <GaesteListe :gaeste="protokoll.gaeste" :nur-lesen="!voll" :rechte="rechteSetzen ? (gast) => (rechteFuer = gast.id) : null" :individuell="hatIndividuell" :link-kopieren="(gast) => personenLink(gast.id) && linkKopieren(gast.id)" :hat-link="(gast) => !!personenLink(gast.id)" />
        </div>
      </section>

      <!-- Letztes Protokoll genehmigen -->
      <section v-if="vorherige" class="card" :class="{ bearbeitbar: voll && !vorherige.genehmigt }">
        <h2 class="card-title">Letztes Protokoll</h2>
        <div class="row">
          <span class="grow small">
            <strong>{{ vorherige.titel || 'Sitzung' }}</strong> vom {{ formatDatum(vorherige.datum) }}
            <span v-if="vorherige.genehmigt" class="badge gruen" style="margin-left: 0.4rem">Genehmigt</span>
            <span v-if="vorherige.genehmigt" class="muted"> an der Sitzung vom {{ formatDatum(vorherige.genehmigt.datum) }}</span>
          </span>
          <router-link :to="'/sitzung/' + vorherige.id + '/protokoll'" class="btn btn-ghost">Protokoll öffnen</router-link>
          <button v-if="voll && !vorherige.genehmigt" class="btn btn-primary" @click="genehmigen">Protokoll genehmigen</button>
        </div>
        <p v-if="!vorherige.genehmigt" class="muted small mt-2">Genehmigt heisst: Das Protokoll wird eingefroren und kann von niemandem mehr geändert werden – nur der Stand der Pendenzen wird weiter nachgeführt. Aufheben lässt sich das nur, indem diese Sitzung gelöscht wird.</p>
      </section>

      <!-- Traktanden mit Einträgen; Zusatztraktanden (an der Sitzung hinzugekommen) stehen an ihrer Stelle im Ablauf -->
      <Zusatztraktanden v-if="!kurz" v-bind="zusatz" :nach-id="null" @aktiv="(id) => (zusatzAktiv = id)" />
      <template v-for="(t, i) in traktanden" :key="t.id">
        <section :id="t.id" class="card mit-pille" :class="{ bearbeitbar: darfTraktandum(t) }">
          <!-- Kurzsitzung: Haupttraktanden entstehen hier; Klick auf den Titel öffnet ihn zum Bearbeiten -->
          <div class="traktandum-kopf" :class="{ 'zusatz-kopf': kurz && voll && kurzAktiv !== t.id }" @click="kopfKlick(t, i, $event)">
            <span class="nr">{{ t._nr || i + 1 }}.</span>
            <template v-if="kurz && kurzAktiv === t.id">
              <input v-model.trim="t.titel" class="nahtlos h2 grow" placeholder="Traktandum" />
              <span class="werkzeuge">
                <MenuDropdown>
                  <button class="menu-item" :disabled="i === 0" @click="kurzVerschieben(i, -1)">↑ Nach oben</button>
                  <button class="menu-item" :disabled="i === traktanden.length - 1" @click="kurzVerschieben(i, 1)">↓ Nach unten</button>
                  <button class="menu-item menu-item-danger" @click="kurzLoeschen(t)">Traktandum löschen</button>
                </MenuDropdown>
              </span>
            </template>
            <h2 v-else :class="{ leer: !t.titel }">{{ t.titel || 'Ohne Titel' }}</h2>
            <span v-if="antraegeAn(t.id)" class="aenderung-marke" title="Offene Änderungsanträge zu diesem Punkt">✎ {{ antraegeAn(t.id) }}</span>
            <span v-if="t.typ" class="badge" :class="TYP_BADGE[t.typ]">{{ PUNKT_TYP[t.typ] }}</span>
            <span v-if="t.verantwortliche.length" class="muted small">{{ personenText(t.verantwortliche) }}</span>
            <span v-if="t.themenbereichId" class="badge" :style="themenbereichStil(t.themenbereichId)">{{ themenbereichName(t.themenbereichId) }}</span>
          </div>
          <p v-if="t.notiz && !istAntragPunkt(t)" class="notiz pre eingerueckt">{{ t.notiz }}</p>

          <div class="eingerueckt mt-2 stack-sm">
            <!-- Übertragene Pendenz aus früherer Sitzung (Status wird am Original aktualisiert) -->
            <PendenzUebertragen v-if="uebertragene[t.pendenzId]" :eintrag="uebertragene[t.pendenzId].eintrag" :sitzung="uebertragene[t.pendenzId].sitzung" :personen="personen" :darf="darfTraktandum(t)" />

            <!-- Vertagter Antrag aus früherer Sitzung: wird hier als neuer Antrag entschieden -->
            <p v-if="uebertrageneAntraege[t.antragId]" class="pendenz-uebertragen">
              <span class="badge violett" style="margin-right: 0.25rem">Vertagt</span>
              an der Sitzung vom {{ formatDatum(uebertrageneAntraege[t.antragId].sitzung.datum) }} – unten als neuer Antrag entscheiden.
            </p>

            <!-- Eine Antragsliste hat selbst keine Einträge: die Anträge sind ihre Unterpunkte -->
            <EintragListe v-if="t.typ !== 'antraege'" :traktandum-id="t.id" :themenbereich-id="t.themenbereichId" :eintraege="protokoll.eintraege" :gremium="gremium" :personen="personen" :nur-lesen="!darfTraktandum(t)" :person-id="person?.id" :typ="wirksamerTyp(t)" :antraege-frei="kurz" :erlaubte-typen="typenFuer(t)" :darf-eintrag="zuschnitt?.eintrag" />

            <Unterpunkte :liste="t.untertraktanden" :nummer="t._nr || String(i + 1)" :eltern-typ="kindTyp(t.typ)" :geerbt="darfTraktandum(t)" :pruefen="darfEigenen" :themenbereiche="gremium.themenbereiche" :themenbereich-oben="t.themenbereichId" im-protokoll>
              <template #default="{ u, typ, darf, tb }">
                <!-- Übernommene Pendenzen und vertagte Anträge stehen seit 1.4.09 dort, wo sie zuletzt waren – auch als Unterpunkt -->
                <PendenzUebertragen v-if="uebertragene[u.pendenzId]" class="mt-1" :eintrag="uebertragene[u.pendenzId].eintrag" :sitzung="uebertragene[u.pendenzId].sitzung" :personen="personen" :darf="darf" />
                <p v-if="uebertrageneAntraege[u.antragId]" class="pendenz-uebertragen mt-1">
                  <span class="badge violett" style="margin-right: 0.25rem">Vertagt</span>
                  an der Sitzung vom {{ formatDatum(uebertrageneAntraege[u.antragId].sitzung.datum) }} – unten als neuer Antrag entscheiden.
                </p>
                <div v-if="typ !== 'antraege'" class="mt-1">
                  <EintragListe :traktandum-id="u.id" :themenbereich-id="tb" :eintraege="protokoll.eintraege" :gremium="gremium" :personen="personen" :nur-lesen="!darf && !zuschnitt" :person-id="person?.id" :typ="typ" :erlaubte-typen="typenFuer(u)" :darf-eintrag="zuschnitt?.eintrag" />
                </div>
              </template>
            </Unterpunkte>
          </div>
          <!-- Zeit unten rechts an der Karte -->
          <div v-if="t.dauer" class="dauer-zeile small">
            <span class="leise nowrap" title="Geplante Dauer (im Vorprotokoll festgelegt)">geplant {{ formatDauer(t.dauer) }}</span>
            <span class="dauer nowrap" title="Tatsächliche Dauer in Minuten">tatsächlich <input v-model.number="protokoll.dauern[t.id]" type="number" min="0" step="5" class="input" placeholder="–" :disabled="!darfDauer(t)" @change="dauerBereinigen(t.id)" /> Min.</span>
          </div>
          <div v-if="kurz && kurzAktiv === t.id" class="row mt-1">
            <button class="btn ml-auto" @click="kurzSchliessen(t)">Fertig</button>
          </div>
          <!-- Neues Zusatztraktandum direkt nach diesem Traktandum: dezente Pille im Zwischenraum zur nächsten Karte -->
          <button v-if="voll && !kurz" type="button" class="zusatz-pille" @click="zusatzHinzufuegen(t.id)">+ Zusatztraktandum</button>
        </section>
        <Zusatztraktanden v-if="!kurz" v-bind="zusatz" :nach-id="t.id" @aktiv="(id) => (zusatzAktiv = id)" />
      </template>
      <div v-if="kurz && voll">
        <button class="btn btn-ghost" @click="kurzHinzufuegen">+ Traktandum</button>
      </div>

      <p v-if="geplanteDauer" class="muted small">
        Dauer insgesamt: geplant {{ formatDauer(geplanteDauer) || '–' }} · tatsächlich {{ formatDauer(tatsaechlicheDauer) || '–' }}
        <span v-if="geplanteDauer && tatsaechlicheDauer" :class="tatsaechlicheDauer > geplanteDauer ? 'text-warn' : 'text-ok'">({{ tatsaechlicheDauer > geplanteDauer ? '+' : '' }}{{ tatsaechlicheDauer - geplanteDauer }} Min.)</span>
      </p>

      <!-- Nächster Termin (Kurzsitzungen stehen für sich: kein nächster Termin) -->
      <section v-if="!kurz" class="card" :class="{ bearbeitbar: voll }">
        <h2 class="card-title">Nächster Sitzungstermin</h2>
        <p v-if="naechsterTermin" class="row small">
          <strong>{{ formatDatum(naechsterTermin.datum) }}<span v-if="naechsterTermin.zeit">, {{ naechsterTermin.zeit }}</span> · {{ naechsterTermin.ort }}</strong>
          <router-link v-if="naechsterTermin.terminfindung?.status === 'offen'" :to="'/sitzung/' + naechsterTermin.id + '/terminfindung'">Terminfindung</router-link>
          <router-link :to="'/sitzung/' + naechsterTermin.id + '/vorprotokoll'">Vorprotokoll öffnen</router-link>
          <button v-if="voll" class="btn btn-ghost" @click="sitzung.naechsterTerminId = null">Ändern</button>
        </p>
        <p v-else-if="!voll" class="muted small">Noch nicht festgelegt.</p>
        <div v-else class="stack-sm">
          <!-- Pillen-Schalter: je nach Wahl erscheint darunter nur das nötige Formular -->
          <span class="schalter umbruch">
            <button v-for="(label, modus) in TERMIN_MODI" :key="modus" type="button" :class="{ aktiv: terminModus === modus }" @click="terminModus = modus">{{ label }}</button>
          </span>
          <div v-if="terminModus === 'bestehend'" class="row">
            <select v-if="spaetereSitzungen.length" v-model="sitzung.naechsterTerminId" class="input w-lg">
              <option :value="null">Termin wählen …</option>
              <option v-for="s in spaetereSitzungen" :key="s.id" :value="s.id">{{ formatDatum(s.datum) }} {{ s.zeit }}</option>
            </select>
            <span v-else class="muted small">Es gibt noch keine spätere Sitzung – neuen Termin erfassen oder per Abstimmung finden.</span>
          </div>
          <form v-else-if="terminModus !== 'offen'" class="row" @submit.prevent="terminErfassen">
            <template v-if="terminModus === 'neu'">
              <input v-model="neuerTermin.datum" type="date" class="input w-sm" required />
              <input v-model="neuerTermin.zeit" type="time" class="input w-sm" />
            </template>
            <input v-model.trim="neuerTermin.ort" class="input w-md" placeholder="Ort" />
            <select v-model="neuerTermin.vorlageId" class="input w-md">
              <option value="">Leeres Vorprotokoll</option>
              <option v-for="v in gremium.vorlagen" :key="v.id" :value="v.id">Vorlage: {{ v.name }}</option>
            </select>
            <button class="btn btn-primary">{{ terminModus === 'neu' ? 'Termin erfassen' : 'Abstimmung starten' }}</button>
          </form>
        </div>
      </section>

      <!-- Änderungsantrag zu einem angeklickten Punkt (nach Abschluss der Sitzung) -->
      <div v-if="antragZiel" class="antrag-popover" :style="{ top: antragZiel.top + 'px', left: antragZiel.left + 'px' }">
        <span class="label">Änderungsantrag zu «{{ antragZiel.zielText }}»</span>
        <textarea ref="antragFeld" v-model.trim="antragText" v-wachsen class="input" rows="3" placeholder="Was soll geändert werden?"></textarea>
        <div class="row mt-1">
          <button type="button" class="btn" @click="antragZiel = null">Abbrechen</button>
          <button type="button" class="btn btn-primary ml-auto" :disabled="!antragText" @click="antragSenden">Absenden</button>
        </div>
      </div>

      <RechteFenster v-if="rechteFuer" :sitzung="sitzung" :person-id="rechteFuer" @schliessen="rechteFuer = ''" />
    </div>
    <!-- Noch nicht gestartet: Vorschau der Traktanden, das Protokoll entsteht erst mit «Sitzung starten» -->
    <div v-else-if="startbereit" class="stack-lg">
      <header class="page-header" style="margin-bottom: 0">
        <router-link v-if="zurueck" :to="zurueck" class="rueck">← {{ zurueckText }}</router-link>
        <div class="kopf">
          <div>
            <p class="kicker">Vorschau · {{ formatDatum(sitzung.datum) }}</p>
            <h1 class="title">{{ sitzung.titel || 'Sitzung' }}</h1>
            <p class="muted small mt-1">Die Sitzung ist noch nicht gestartet. Mit «Sitzung starten» entsteht das Protokoll – das Vorprotokoll kann danach nicht mehr bearbeitet werden.</p>
          </div>
          <div class="actions">
            <router-link :to="'/sitzung/' + sitzungId + '/vorprotokoll'" class="btn btn-ghost">Zum Vorprotokoll</router-link>
            <button class="btn btn-primary" @click="sitzungStarten">Sitzung starten</button>
          </div>
        </div>
      </header>
      <section class="card">
        <h2 class="card-title">Traktanden</h2>
        <div v-if="traktanden.length" class="liste">
          <div v-for="(t, i) in traktanden" :key="t.id" class="liste-zeile">
            <strong class="grow">{{ i + 1 }}. {{ t.titel || 'Ohne Titel' }}</strong>
            <span v-if="t.verantwortliche.length" class="muted small">{{ personenText(t.verantwortliche) }}</span>
            <span v-if="t.dauer" class="leise small">{{ formatDauer(t.dauer) }}</span>
          </div>
        </div>
        <p v-else class="muted small">Das Vorprotokoll hat noch keine Traktanden.</p>
      </section>

      <!-- Start ohne anwesende Person mit Aufgabe: Vertretung aus den Anwesenden bestimmen -->
      <Modal v-if="startFenster" titel="Sitzung starten" @schliessen="startFenster = null">
        <form id="formular-start" class="stack" @submit.prevent="startMitVertretung">
          <p class="hint">Für {{ Object.keys(startFenster).map((a) => AUFGABEN[a]).join(' und ') }} ist niemand anwesend. Bitte aus den Anwesenden eine Vertretung bestimmen. Sie hat in dieser Sitzung sämtliche Bearbeitungsrechte bis zur Genehmigung.</p>
          <div v-for="(wert, aufgabe) in startFenster" :key="aufgabe">
            <span class="label">{{ AUFGABEN[aufgabe] }}</span>
            <select v-model="startFenster[aufgabe]" class="input" required>
              <option value="" disabled>Person wählen …</option>
              <option v-for="p in anwesendePersonen" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </div>
        </form>
        <template #fuss>
          <div class="row">
            <button type="button" class="btn" @click="startFenster = null">Abbrechen</button>
            <button form="formular-start" class="btn btn-primary ml-auto">Sitzung starten</button>
          </div>
        </template>
      </Modal>
    </div>
    <p v-else class="muted">Zu dieser Sitzung gibt es noch kein Protokoll.</p>
  `,
  // Unterpunkte und Einträge öffnen beim Anklicken einen Änderungsantrag und zeigen ihre Anzahl
  provide() {
    return {
      aenderung: {
        aktiv: () => this.darfStellen,
        oeffnen: (zielId, zielText, event) => this.antragOeffnen(zielId, zielText, event),
        anzahl: (zielId) => this.antraegeAn(zielId),
      },
    }
  },
  data() {
    return {
      protokoll: null, // lokale Arbeitskopie, wird per Auto-Save in den Store geschrieben
      startFenster: null, // Vertretung beim Start: { aufgabe: personId }
      AUFGABEN,
      basis: null, // Stand im Store, auf dem die Arbeitskopie beruht (für das Zusammenführen mit Änderungen anderer)
      uebernimmt: false, // Arbeitskopie wird gerade aus dem Store übernommen (kein Auto-Save)
      rechteFuer: '', // Fenster «Individuelle Rechte» für diese Person
      kopiert: '', // eben kopierter persönlicher Link
      gespeichert: true,
      gespeichertUm: '',
      speicherTimer: null,
      linkKopiert: false,
      zusatzAktiv: null, // ID des Zusatztraktandums in Bearbeitung
      kurzAktiv: null, // Kurzsitzung: ID des Traktandums, dessen Titel bearbeitet wird
      antragZiel: null, // Änderungsantrag in Arbeit: { zielId, zielText, top, left }
      antragText: '',
      neuerTermin: { datum: '', zeit: '', ort: '', vorlageId: '' },
      terminModus: 'offen', // offen | bestehend | neu | abstimmung
      TERMIN_MODI: { offen: 'Offen lassen', bestehend: 'Bestehend', neu: 'Neu', abstimmung: 'Abstimmung' },
      SITZUNG_STATUS,
      SITZUNG_STATUS_KLASSE,
      PENDENZ_STATUS,
      TYP_BADGE,
      PUNKT_TYP,
    }
  },
  computed: {
    geplanteDauer() {
      return dauerSumme(this.traktanden)
    },
    tatsaechlicheDauer() {
      return this.traktanden.reduce((summe, t) => summe + (Number(this.protokoll.dauern[t.id]) || 0), 0)
    },
    sitzung() {
      return sitzungenStore.sitzungById(this.sitzungId)
    },
    kurz() {
      return !!this.sitzung.kurz
    },
    // Gespeicherter Stand im Store: Änderungsanträge werden dort bearbeitet (die Arbeitskopie trägt sie nicht)
    gespeichertesProtokoll() {
      return sitzungenStore.protokollVonSitzung(this.sitzungId)
    },
    darfStellen() {
      return darfAenderungStellen(this.sitzung, this.gespeichertesProtokoll)
    },
    darfEntscheiden() {
      return darfAenderungEntscheiden(this.sitzung)
    },
    // Alle Anträge sehen Protokollführung, Verwaltung und Sitzungsleitung; sonst nur die eigenen
    siehtAlleAntraege() {
      return this.darfEntscheiden || this.sitzung.sitzungsleitung.some((p) => p.id === this.person?.id)
    },
    antraegeSichtbar() {
      if (istGenehmigt(this.sitzung)) return []
      const alle = this.gespeichertesProtokoll?.aenderungsantraege || []
      return this.siehtAlleAntraege ? alle : alle.filter((a) => a.personId === this.person?.id)
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
    // Vollzugriff, aber noch kein Protokoll: Vorschau mit «Sitzung starten»
    startbereit() {
      return (this.voll || darfStarten(this.sitzung)) && !!this.sitzung.datum && !this.kurz && !this.protokoll
    },
    // Anwesende laut Vorprotokoll (Mitglieder und Gäste ohne Absage) – für die Vertretung beim Start
    anwesendePersonen() {
      const vp = this.vorprotokollDokument
      if (!vp) return []
      const mitglieder = this.gremium.mitglieder.filter((m) => vp.anwesendeMitgliederIds.includes(m.id))
      const gaeste = vp.gaeste.filter((g) => g.name && !hatAbgesagt(this.sitzung.gremiumId, this.sitzungId, g.id))
      return [...mitglieder, ...gaeste].map(({ id, name }) => ({ id, name }))
    },
    genehmigt() {
      return istGenehmigt(this.sitzung)
    },
    vorherige() {
      return sitzungenStore.vorherigeSitzung(this.sitzungId)
    },
    // Eigene Traktanden bearbeiten (false bei Freigabe «Lesen»)
    eigene() {
      return darfEigene(this.sitzung, 'protokoll')
    },
    // Einzelrechte (zusätzlicher Link oder Freigabe «Individuell»): Einträge nur der freigegebenen Typen, überall
    // Eigene Regeln (individuelle Rechte): bearbeitbare Punkte und Einträge
    zuschnitt() {
      return this.genehmigt ? null : zuschnittSicht(this.sitzung)
    },
    rechteSetzen() {
      return this.voll && sync.zugriff?.rolle !== 'link'
    },
    erlaubteTypen() {
      if (!istIndividuell(this.sitzung, 'protokoll')) return null
      return Object.keys(EINZELRECHTE.protokoll).filter((typ) => einzelrecht(this.sitzung, 'protokoll', typ))
    },
    vorprotokollDokument() {
      return sitzungenStore.vorprotokollVonSitzung(this.sitzungId)
    },
    linksSichtbar() {
      return linksSichtbar(this.sitzung)
    },
    zugriffeVerwalten() {
      return verwaltetSitzung(this.sitzung)
    },
    // Löschen nimmt der Server nur von Admin / Gremium-Zugang an
    darfEntfernen() {
      return this.voll
    },
    // Gemeinsame Angaben für alle Stellen, an denen Zusatztraktanden stehen können
    zusatz() {
      return { protokoll: this.protokoll, traktanden: this.traktanden, gremium: this.gremium, personen: this.personen, voll: this.voll, aktivId: this.zusatzAktiv }
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
      if (this.kurz) return [] // Kurzsitzung: es gibt nur Teilnehmende, niemand gilt als entschuldigt
      return gremienStore.erwarteteMitglieder(this.gremium.id).filter((m) => !this.protokoll.anwesende.includes(m.id)).map((m) => m.id)
    },
    uebertragene() {
      const map = {}
      allePunkte(this.traktanden)
        .filter((t) => t.pendenzId)
        .forEach((t) => {
          const treffer = sitzungenStore.eintragById(t.pendenzId)
          if (treffer) map[t.pendenzId] = treffer
        })
      return map
    },
    uebertrageneAntraege() {
      const map = {}
      allePunkte(this.traktanden)
        .filter((t) => t.antragId)
        .forEach((t) => {
          const treffer = sitzungenStore.eintragById(t.antragId)
          if (treffer) map[t.antragId] = treffer
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
    // Klick auf eine Benachrichtigung, während das Protokoll schon offen ist
    '$route.query.zu'(zu) {
      springeZu(zu)
    },
    protokoll: {
      deep: true,
      handler(neu, alt) {
        if (!alt || this.uebernimmt) return // erstes Laden der Arbeitskopie bzw. Stand von anderen übernommen
        this.gespeichert = false
        clearTimeout(this.speicherTimer)
        this.speicherTimer = setTimeout(this.speichern, 1500)
      },
    },
  },
  // Neuer Stand im Store (Änderungen anderer): ohne eigene ungespeicherte Änderungen gleich anzeigen
  beforeMount() {
    this.$watch(
      () => this.gespeichertesProtokoll,
      (neu) => {
        if (!neu || !this.protokoll || !this.gespeichert || gleich(neu, this.basis)) return
        this.arbeitskopie(neu)
      },
      { deep: true },
    )
  },
  created() {
    if (this.voll && this.sitzung.datum) {
      if (!sitzungenStore.vorprotokollVonSitzung(this.sitzungId)) sitzungenStore.erstelleVorprotokoll(this.sitzungId)
      // Kurzsitzung: nur ein Dokument, kein Vorprotokoll zu sperren – das Protokoll entsteht sofort
      if (this.kurz && !sitzungenStore.protokollVonSitzung(this.sitzungId)) sitzungenStore.starteProtokoll(this.sitzungId)
    }
    const protokoll = sitzungenStore.protokollVonSitzung(this.sitzungId)
    if (protokoll && this.voll) sitzungenStore.ergaenzeAntraege(protokoll.id) // später übernommene vertagte Anträge nachziehen
    if (protokoll) this.arbeitskopie(protokoll)
    this.gespeichertUm = this.uhrzeit()
  },
  mounted() {
    window.addEventListener('keydown', this.tastendruck)
    springeZu(this.$route.query.zu) // Treffer aus der Suche
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this.tastendruck)
    if (!this.gespeichert) this.speichern()
  },
  methods: {
    formatDatum,
    darfStarten,
    darfAufgabenBestimmen,
    formatDauer,
    personenText,
    sitzungStatus,
    wirksamerTyp,
    istAntragPunkt,
    kindTyp,
    // Leeres oder ungültiges Feld -> keine Dauer
    dauerBereinigen(traktandumId) {
      const wert = this.protokoll.dauern[traktandumId]
      if (Number.isFinite(wert) && wert > 0) this.protokoll.dauern[traktandumId] = Math.round(wert)
      else delete this.protokoll.dauern[traktandumId]
    },
    darfTraktandum(t) {
      if (this.zuschnitt) return this.zuschnitt.punkt(t) || (this.erlaubteTypen?.length ?? 0) > 0 || this.zuschnitt.eintragsRegeln
      if (this.erlaubteTypen) return this.erlaubteTypen.length > 0
      return this.voll || (this.eigene && this.person && istBerechtigt(t, this.person))
    },
    // Unterpunkt, auf dem die Person selbst berechtigt ist (Rechte von oben erbt der Baum)
    darfEigenen(u) {
      if (this.zuschnitt) return this.zuschnitt.punkt(u) || this.zuschnitt.eintragsRegeln
      return Boolean(this.eigene && this.person && istBerechtigt(u, this.person))
    },
    // Eintragstypen pro Punkt: mit Regeln im bearbeitbaren Punkt alle, sonst die freigegebenen
    typenFuer(t) {
      if (this.zuschnitt) return this.zuschnitt.punkt(t) ? null : this.erlaubteTypen || []
      return this.erlaubteTypen
    },
    darfDauer(t) {
      return this.zuschnitt ? this.zuschnitt.punkt(t) : this.darfTraktandum(t) && !this.erlaubteTypen
    },
    // Persönlicher Link einer Person (Mitglied: zentraler Link, Gast: Gast-Link), sofern der eigene Zugang ihn sieht
    personenLink(personId) {
      const m = this.gremium.mitglieder.find((x) => x.id === personId)
      const key = m ? m.zugangsKey : this.vorprotokollDokument?.personenKeys?.[personId]
      return key ? location.href.split('#')[0] + (m ? '#/zugang/' : '#/freigabe/') + key : ''
    },
    linkKopieren(personId) {
      navigator.clipboard.writeText(this.personenLink(personId))
      this.kopiert = personId
      setTimeout(() => (this.kopiert = ''), 2000)
    },
    hatIndividuell(personId) {
      return Array.isArray(this.sitzung.freigaben?.protokoll?.[personId]) || !!this.sitzung.zuschnitt?.[personId]
    },
    darfAnwesenheit(m) {
      return this.voll || (this.eigene && this.person && m.id === this.person.id)
    },
    uhrzeit() {
      return new Date().toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })
    },
    tastendruck(event) {
      if (event.key === 'Escape') {
        this.zusatzAktiv = null
        this.antragZiel = null
        if (this.kurzAktiv) this.kurzSchliessen(this.traktanden.find((t) => t.id === this.kurzAktiv))
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault()
        if (this.protokoll) this.speichern()
      }
    },
    // Arbeitskopie (und ihre Basis) aus dem Store übernehmen, ohne dabei ein Speichern auszulösen
    arbeitskopie(stand) {
      this.uebernimmt = true
      this.protokoll = JSON.parse(JSON.stringify(stand))
      this.basis = JSON.parse(JSON.stringify(stand))
      this.$nextTick(() => (this.uebernimmt = false))
    },
    speichern() {
      clearTimeout(this.speicherTimer)
      // Hat inzwischen jemand anderes gespeichert: dessen Änderungen mit den eigenen zusammenführen
      const aktuell = this.gespeichertesProtokoll
      if (this.basis && aktuell && !gleich(aktuell, this.basis)) {
        const konflikte = []
        const ohneAntraege = (p) => ({ ...p, aenderungsantraege: [] })
        const zusammen = zusammenfuehren(ohneAntraege(this.basis), ohneAntraege(this.protokoll), ohneAntraege(aktuell), [], konflikte)
        this.uebernimmt = true
        this.protokoll = zusammen
        this.$nextTick(() => (this.uebernimmt = false))
        if (konflikte.length) hinweis('Jemand hat gleichzeitig dieselben Stellen im Protokoll geändert. Gespeichert ist deine Änderung.', 'Gleichzeitig bearbeitet')
      }
      if (this.kurz) {
        // Kurzsitzung: Teilnehmende und Gäste (mit persönlichem Link) auch im versteckten Vorprotokoll führen
        const vp = this.vorprotokollDokument
        vp.anwesendeMitgliederIds = [...this.protokoll.anwesende]
        vp.gaeste = this.protokoll.gaeste.map((g) => ({ ...g }))
        if (this.linksSichtbar) vp.gaeste.forEach((g) => (vp.personenKeys[g.id] ||= neuerKey()))
      }
      // Änderungsanträge bleiben, wie sie im Store stehen (sie werden dort direkt bearbeitet)
      sitzungenStore.speichereProtokoll({ ...this.protokoll, abwesende: this.abwesende, aenderungsantraege: this.gespeichertesProtokoll.aenderungsantraege })
      this.basis = JSON.parse(JSON.stringify(this.gespeichertesProtokoll))
      this.gespeichert = true
      this.gespeichertUm = this.uhrzeit()
      serverSpeichern()
    },
    // Neues Zusatztraktandum direkt nach dem Traktandum nachId (vor schon vorhandenen an dieser Stelle), gleich in Bearbeitung
    zusatzHinzufuegen(nachId) {
      const zusatz = { id: crypto.randomUUID(), titel: '', begruendung: '', nachId }
      const liste = this.protokoll.zusatztraktanden
      const index = liste.findIndex((z) => z.nachId === nachId)
      liste.splice(index < 0 ? liste.length : index, 0, zusatz)
      this.zusatzAktiv = zusatz.id
      this.$nextTick(() => document.getElementById(zusatz.id)?.querySelector('.nahtlos')?.focus())
    },
    // Klick auf den Kopf eines Traktandums: Kurzsitzung bearbeitet den Titel, nach Abschluss ein Änderungsantrag
    kopfKlick(t, i, event) {
      if (this.kurz && this.voll && this.kurzAktiv !== t.id) return this.kurzOeffnen(t)
      if (this.darfStellen) this.antragOeffnen(t.id, `${t._nr || i + 1}. ${t.titel}`, event)
    },
    // Offene Änderungsanträge an dieser Stelle (erledigte werden nicht mehr markiert)
    antraegeAn(zielId) {
      return this.antraegeSichtbar.filter((a) => a.zielId === zielId && a.status === 'offen').length
    },
    // Kleines Fenster mit Textfeld direkt beim angeklickten Punkt
    antragOeffnen(zielId, zielText, event) {
      const rahmen = event.currentTarget.getBoundingClientRect()
      const breite = Math.min(384, innerWidth - 32)
      this.antragZiel = { zielId, zielText, top: rahmen.bottom + scrollY + 6, left: Math.max(16, Math.min(rahmen.left + scrollX, innerWidth - breite - 16)) }
      this.antragText = ''
      this.$nextTick(() => this.$refs.antragFeld?.focus())
    },
    antragSenden() {
      this.gespeichertesProtokoll.aenderungsantraege.push({
        id: crypto.randomUUID(),
        zielId: this.antragZiel.zielId,
        zielText: this.antragZiel.zielText,
        personId: this.person.id,
        name: this.person.name,
        text: this.antragText,
        zeit: new Date().toISOString(),
        status: 'offen',
        antwort: '',
        entschiedenVon: '',
      })
      this.antragZiel = null
    },
    // Kurzsitzung: Haupttraktanden fortlaufend während der Sitzung erfassen (ohne Begründung)
    kurzHinzufuegen() {
      const traktandum = neuesTraktandum({ reihenfolge: this.traktanden.length + 1 })
      this.vorprotokollDokument.traktanden.push(traktandum)
      this.kurzOeffnen(traktandum)
    },
    kurzOeffnen(t) {
      this.kurzAktiv = t.id
      this.$nextTick(() => document.getElementById(t.id)?.querySelector('.nahtlos')?.focus())
    },
    // Fertig: ein leeres Traktandum ohne Einträge verschwindet wieder
    kurzSchliessen(t) {
      this.kurzAktiv = null
      if (t && !t.titel && !this.protokoll.eintraege.some((e) => e.traktandumId === t.id)) this.kurzEntfernen(t)
    },
    async kurzLoeschen(t) {
      const anzahl = this.protokoll.eintraege.filter((e) => e.traktandumId === t.id).length
      if (anzahl && !(await bestaetigen(`Traktandum «${t.titel || 'Ohne Titel'}» mit ${anzahl} Einträgen löschen?`, { gefahr: true }))) return
      this.kurzEntfernen(t)
      this.kurzAktiv = null
    },
    kurzEntfernen(t) {
      const liste = this.vorprotokollDokument.traktanden
      liste.splice(liste.indexOf(t), 1)
      liste.forEach((x, i) => (x.reihenfolge = i + 1))
      this.protokoll.eintraege = this.protokoll.eintraege.filter((e) => e.traktandumId !== t.id)
    },
    kurzVerschieben(i, richtung) {
      const liste = this.vorprotokollDokument.traktanden
      ;[liste[i], liste[i + richtung]] = [liste[i + richtung], liste[i]]
      liste.forEach((x, j) => (x.reihenfolge = j + 1))
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
    // Bewusster Start: legt das Protokoll an und schliesst damit das Vorprotokoll ab
    async sitzungStarten() {
      const ids = this.anwesendePersonen.map((p) => p.id)
      const fehlt = Object.keys(AUFGABEN).filter((a) => !this.sitzung[a].some((p) => ids.includes(p.id)))
      if (fehlt.length) {
        if (!darfAufgabenBestimmen(this.sitzung)) {
          hinweis(`Für ${fehlt.map((a) => AUFGABEN[a]).join(' und ')} ist niemand anwesend. Die Vertretung bestimmt, wer die Sitzung eingetragen hat oder Zugriffe verwaltet.`, 'Vertretung fehlt')
          return
        }
        this.startFenster = Object.fromEntries(fehlt.map((a) => [a, '']))
        return
      }
      if (!(await bestaetigen('Sitzung jetzt starten? Das Protokoll wird angelegt – das Vorprotokoll kann danach nicht mehr bearbeitet werden.', { titel: 'Sitzung starten', ja: 'Starten' }))) return
      this.protokollAnlegen()
    },
    // Vertretung eintragen und starten (das Fenster ersetzt die Rückfrage)
    startMitVertretung() {
      for (const [aufgabe, id] of Object.entries(this.startFenster)) {
        const person = this.anwesendePersonen.find((p) => p.id === id)
        if (person && !this.sitzung[aufgabe].some((p) => p.id === id)) this.sitzung[aufgabe].push({ ...person })
      }
      this.startFenster = null
      this.protokollAnlegen()
    },
    protokollAnlegen() {
      const vorhanden = sitzungenStore.protokollVonSitzung(this.sitzungId)
      const protokoll = vorhanden || sitzungenStore.starteProtokoll(this.sitzungId)
      // Gäste, die auf die Einladung abgesagt haben, kommen nicht ins Protokoll
      if (!vorhanden) protokoll.gaeste = protokoll.gaeste.filter((g) => !hatAbgesagt(this.sitzung.gremiumId, this.sitzungId, g.id))
      this.arbeitskopie(protokoll)
      this.speichern()
    },
    // Formell korrekter Weg zurück: erst das Protokoll entfernen, dann ist das Vorprotokoll wieder bearbeitbar
    async entfernen() {
      if (!(await bestaetigen('Protokoll dieser Sitzung entfernen? Alle Einträge gehen verloren; das Vorprotokoll kann danach wieder bearbeitet werden.', { gefahr: true }))) return
      clearTimeout(this.speicherTimer)
      this.gespeichert = true // sonst würde beforeUnmount das gelöschte Protokoll erneut speichern
      sitzungenStore.loescheProtokoll(this.sitzungId)
      serverSpeichern()
      this.$router.push('/sitzung/' + this.sitzungId + '/vorprotokoll')
    },
    async genehmigen() {
      if (!(await bestaetigen('Protokoll vom ' + formatDatum(this.vorherige.datum) + ' genehmigen? Es kann danach von niemandem mehr geändert werden.'))) return
      sitzungenStore.genehmigen(this.vorherige.id, this.sitzungId)
      serverSpeichern()
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
    terminErfassen() {
      const termin = sitzungenStore.erstelleSitzung(this.gremium.id, { ...this.neuerTermin, terminfindung: this.terminModus === 'abstimmung' })
      this.sitzung.naechsterTerminId = termin.id
      this.neuerTermin = { datum: '', zeit: '', ort: '', vorlageId: '' }
      this.terminModus = 'offen'
    },
  },
}
