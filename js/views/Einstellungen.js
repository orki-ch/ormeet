import { api, appStand } from '../api.js'
import { updateStand, updatePruefen } from '../stores/updates.js'
import InfoKnopf from '../components/InfoKnopf.js'
import Modal from '../components/Modal.js'
import { bestaetigen, hinweis } from '../utils/dialog.js'

// Zustand des Cronjobs (lief er in den letzten zwei Stunden?)
const ZUSTAND = {
  aktiv: { text: 'Läuft', lang: 'Der Cronjob läuft.', klasse: 'gruen' },
  gestoppt: { text: 'Gestoppt', lang: 'Der Cronjob läuft nicht mehr.', klasse: 'rot' },
  fehlt: { text: 'Nicht eingerichtet', lang: 'Der Cronjob ist noch nicht eingerichtet.', klasse: 'gelb' },
}

// Aufzählungspunkte («- …») eines Änderungstexts
function punkte(text) {
  return text.split('\n').filter((zeile) => zeile.startsWith('- ')).map((zeile) => zeile.slice(2).trim())
}

// Superadmin: Version, Update-Prüfung und Installation, Anmeldung über Anbieter, E-Mail-Versand
export default {
  name: 'Einstellungen',
  components: { InfoKnopf, Modal },
  template: `
    <div class="stack-lg">
      <header class="page-header" style="margin-bottom: 0">
        <p class="kicker">Superadmin</p>
        <h1 class="title">Einstellungen</h1>
      </header>

      <section class="card stack">
        <div class="card-head">
          <h2 class="card-title">Version & Updates</h2>
          <button class="btn" :disabled="laeuft" @click="pruefen">Auf Updates prüfen</button>
        </div>
        <div class="grid-3 small">
          <div><span class="label">Installierte Version</span>{{ updateStand.lokal || '–' }}</div>
          <div><span class="label">Aktuelle Version</span>{{ updateStand.aktuell || '–' }}</div>
          <div><span class="label">Zuletzt geprüft</span>{{ updateStand.geprueftUm || 'noch nie' }}</div>
        </div>
        <p v-if="updateStand.fehler" class="small text-err">{{ updateStand.fehler }}</p>
        <div v-if="updateStand.verfuegbar" class="banner">
          <div class="grow"><strong>Update auf Version {{ updateStand.aktuell }} verfügbar.</strong>
            <span class="muted small">Die Programmdateien werden ersetzt; Daten, Passwort und Kontaktangabe bleiben erhalten.</span></div>
          <button class="btn btn-primary" :disabled="laeuft" @click="installieren">Update installieren</button>
        </div>
        <p v-else-if="updateStand.aktuell && !updateStand.fehler" class="small text-ok">Ormeet ist auf dem neusten Stand.</p>
        <p v-if="laeuft" class="small muted">{{ schritt }}</p>
        <details v-if="ergebnis" class="aufklapp">
          <summary>Installation abgeschlossen <span class="sub">{{ ergebnis.dateien.length }} Dateien</span></summary>
          <ul class="inhalt small muted" style="padding-left: 1.2rem"><li v-for="d in ergebnis.dateien" :key="d">{{ d }}</li></ul>
        </details>
        <details v-if="verlauf.length || neuerungen.length" class="aufklapp klein">
          <summary>Änderungsverlauf</summary>
          <div class="inhalt stack small">
            <div v-if="updateStand.verfuegbar && neuerungen.length">
              <strong>Version {{ updateStand.aktuell }}</strong> <span class="badge brand">noch nicht installiert</span>
              <ul class="aenderungen"><li v-for="punkt in neuerungen" :key="punkt">{{ punkt }}</li></ul>
            </div>
            <div v-for="v in verlauf" :key="v.version">
              <strong>Version {{ v.version }}</strong>
              <ul class="aenderungen"><li v-for="punkt in v.punkte" :key="punkt">{{ punkt }}</li></ul>
            </div>
          </div>
        </details>
        <div><InfoKnopf label="Technischer Hinweis" text="Vor einem Update empfiehlt sich eine Sicherung des Ordners data/ und der Datei schluessel.php. Nach der Installation lädt die Seite neu." /></div>
      </section>

      <form v-if="sso" class="card stack" @submit.prevent="ssoSpeichern">
        <div class="card-head">
          <h2 class="card-title">Anmeldung über Anbieter (SSO) <InfoKnopf titel="Anmeldung über Anbieter" text="Personen mit Konto können sich über Sublevia oder Orki anmelden und registrieren. Dazu beim Anbieter eine Anwendung mit dieser Rückruf-Adresse anlegen und Client-ID und Client-Secret hier eintragen. Leer lassen, wenn nicht gewünscht." /></h2>
          <button class="btn btn-primary" :disabled="laeuft">Speichern</button>
        </div>
        <div class="row"><span class="label" style="margin: 0">Rückruf-Adresse (Redirect URI)</span><code class="input grow truncate" style="line-height: 1.5">{{ sso.callback }}</code></div>
        <div v-for="(name, id) in sso.anbieter" :key="id" class="block-soft stack-sm">
          <strong>{{ name }}</strong>
          <div class="grid-3">
            <div><span class="label">Server-URL</span><input v-model.trim="sso.sso[id].url" class="input" :placeholder="id === 'sublevia' ? 'https://orki-auth.sublevia.ch' : 'https://meine-organisation.orki.ch'" /></div>
            <div><span class="label">Client-ID</span><input v-model.trim="sso.sso[id].clientId" class="input" /></div>
            <div><span class="label">Client-Secret</span><input v-model.trim="sso.sso[id].clientSecret" class="input" type="password" autocomplete="off" /></div>
          </div>
        </div>
        <p v-if="ssoMeldung" class="small" :class="ssoFehler ? 'text-err' : 'text-ok'">{{ ssoMeldung }}</p>
      </form>

      <form v-if="sso" class="card stack" @submit.prevent="mailSpeichern">
        <div class="card-head">
          <h2 class="card-title">E-Mail-Versand <InfoKnopf titel="E-Mail-Versand" text="Ormeet verschickt E-Mails für «Passwort vergessen», Einladungen und Sammelmails. Mit einem SMTP-Server kommen sie zuverlässiger an; ohne SMTP-Server versendet Ormeet über die Mailfunktion des Hostings." /></h2>
          <button class="btn btn-primary" :disabled="laeuft">Speichern</button>
        </div>
        <div class="grid-2">
          <div><span class="label">Absender-Adresse</span><input v-model.trim="sso.mail.absender" class="input" type="email" placeholder="z. B. ormeet@meine-organisation.ch" /></div>
          <div><span class="label">Absender-Name</span><input v-model.trim="sso.mail.absenderName" class="input" placeholder="Ormeet" /></div>
        </div>
        <div class="block-soft stack-sm">
          <strong>SMTP-Server (optional)</strong>
          <div class="grid-3">
            <div><span class="label">Server</span><input v-model.trim="sso.mail.host" class="input" placeholder="smtp.meine-organisation.ch" /></div>
            <div><span class="label">Port</span><input v-model.number="sso.mail.port" class="input" type="number" min="1" /></div>
            <div>
              <span class="label">Verschlüsselung</span>
              <select v-model="sso.mail.sicherheit" class="input">
                <option value="tls">STARTTLS (meist Port 587)</option>
                <option value="ssl">SSL/TLS (meist Port 465)</option>
                <option value="">Keine</option>
              </select>
            </div>
            <div><span class="label">Benutzer</span><input v-model.trim="sso.mail.benutzer" class="input" autocomplete="off" /></div>
            <div><span class="label">Passwort</span><input v-model="sso.mail.passwort" class="input" type="password" autocomplete="new-password" /></div>
          </div>
        </div>
        <div class="row">
          <input v-model.trim="testAn" class="input w-lg" type="email" placeholder="Test-Nachricht an …" />
          <button type="button" class="btn" :disabled="laeuft || !testAn" @click="mailTesten">Test senden</button>
        </div>
        <p v-if="mailMeldung" class="small" :class="mailFehler ? 'text-err' : 'text-ok'">{{ mailMeldung }}</p>
      </form>

      <section v-if="sso" class="card stack">
        <div class="card-head">
          <h2 class="card-title">Automatische E-Mails (Cronjob) <InfoKnopf titel="Automatische E-Mails" text="Konten erhalten höchstens eine Sammelmail pro Tag mit ihren Mitteilungen aus Ormeet – nur wenn es Neues gibt: eine Sitzung steht bevor, die eigene Stimme fehlt, Pendenzen und alles Weitere aus der Glocke. Die erste Mail an ein Konto enthält nur Wichtiges: bevorstehende Sitzungen, fehlende Stimmen, Pendenzen und zugewiesene Traktanden. Dafür braucht es einen Cronjob beim Hoster, der Ormeet stündlich aufruft." /></h2>
          <span class="badge" :class="ZUSTAND[cron.zustand].klasse">{{ ZUSTAND[cron.zustand].text }}</span>
        </div>
        <div class="grid-3 small">
          <div><span class="label">Letzter Lauf</span>{{ cron.lauf?.letzterLauf ? new Date(cron.lauf.letzterLauf).toLocaleString('de-CH') : 'noch nie' }}</div>
          <div><span class="label">Verschickt</span>{{ cron.lauf ? cron.lauf.mails + ' Mails' : '–' }}<span v-if="cron.lauf?.hinweis" class="leise"> · {{ cron.lauf.hinweis }}</span></div>
          <div>
            <span class="label">Versand ab</span>
            <select v-model.number="sso.mailStunde" class="input klein w-sm" @change="speichernStunde">
              <option v-for="h in 24" :key="h" :value="h - 1">{{ h - 1 }} Uhr</option>
            </select>
          </div>
        </div>
        <p v-if="cron.lauf?.fehler" class="small text-err">Fehler beim letzten Versand: {{ cron.lauf.fehler }}</p>
        <div class="row">
          <button type="button" class="btn btn-primary" @click="cronOffen = true">Cronjob einrichten</button>
          <button type="button" class="btn" :disabled="laeuft" @click="cronJetzt">Jetzt ausführen</button>
          <span class="leise small">Der erste Lauf merkt sich nur den bisherigen Stand; gemailt wird, was danach neu dazukommt.</span>
        </div>
      </section>

      <Modal v-if="cronOffen" titel="Ormeet-Cronjob" @schliessen="cronOffen = false">
        <div class="stack cron">
          <p class="small">Ein Cronjob beim Hoster ruft Ormeet stündlich auf. Ab der eingestellten Stunde verschickt Ormeet dann einmal am Tag die Sammelmails.</p>
          <p><span class="badge" :class="ZUSTAND[cron.zustand].klasse">{{ ZUSTAND[cron.zustand].lang }}</span><span v-if="cron.lauf?.letzterLauf" class="leise small"> Letzter Lauf: {{ new Date(cron.lauf.letzterLauf).toLocaleString('de-CH') }}</span></p>
          <p v-for="w in cron.warnungen" :key="w" class="banner small">{{ w }}</p>

          <div class="cron-abschnitt">
            <h3 class="label">Cron-Zeile <InfoKnopf text="Diese Zeile unverändert beim Hoster eintragen (z. B. mit crontab -e). Sie startet den Ormeet-Cronjob jede Stunde." /></h3>
            <div class="cron-code"><code>{{ cron.zeile }}</code><button type="button" class="btn" @click="kopieren('zeile', cron.zeile)">{{ kopiert === 'zeile' ? 'Kopiert ✓' : 'Kopieren' }}</button></div>
          </div>

          <div class="cron-abschnitt">
            <h3 class="label">Einzelne Felder <InfoKnopf text="Viele Hosting-Oberflächen fragen Intervall und Befehl getrennt ab. Dann diese Werte einzeln übernehmen statt der ganzen Zeile." /></h3>
            <div v-for="f in felder" :key="f.id" class="cron-feld">
              <span class="small"><strong>{{ f.label }}</strong></span>
              <code :class="{ leer: !f.wert }">{{ f.wert || 'leer lassen' }}</code>
              <button v-if="f.wert" type="button" class="btn" @click="kopieren(f.id, f.wert)">{{ kopiert === f.id ? 'Kopiert ✓' : 'Kopieren' }}</button>
              <span v-else></span>
            </div>
          </div>

          <div class="cron-abschnitt">
            <h3 class="label">Ohne Shell-Zugang: per Adresse <InfoKnopf text="Bietet der Hoster nur einen Cronjob per Adresse an (URL abrufen), diese Adresse verwenden. Der Schlüssel darf nicht weitergegeben werden." /></h3>
            <div class="cron-code"><code>{{ cron.url }}</code><button type="button" class="btn" @click="kopieren('url', cron.url)">{{ kopiert === 'url' ? 'Kopiert ✓' : 'Kopieren' }}</button></div>
            <div class="cron-feld">
              <span class="small"><strong>Adresse</strong></span>
              <code>{{ cron.adresse }}</code>
              <button type="button" class="btn" @click="kopieren('adresse', cron.adresse)">{{ kopiert === 'adresse' ? 'Kopiert ✓' : 'Kopieren' }}</button>
            </div>
            <div class="cron-feld">
              <span class="small"><strong>Argumente</strong></span>
              <code>{{ cron.argumente }}</code>
              <button type="button" class="btn" @click="kopieren('argumente', cron.argumente)">{{ kopiert === 'argumente' ? 'Kopiert ✓' : 'Kopieren' }}</button>
            </div>
          </div>

          <div class="cron-abschnitt">
            <h3 class="label">Wo trage ich das ein?</h3>
            <ul class="small" style="padding-left: 1.2rem">
              <li><strong>cPanel</strong> – Erweitert › Cron Jobs, gemeinsame Einstellung «stündlich» wählen, dann den Befehl (ohne den Zeitteil vorne) einfügen.</li>
              <li><strong>Plesk</strong> – Websites & Domains › Geplante Aufgaben › Aufgabe hinzufügen. Beim Typ «PHP-Skript ausführen» den Skriptpfad eintragen und die Argumente leer lassen; beim Typ «URL abrufen» die Adresse mit Schlüssel verwenden. Ausführung: stündlich.</li>
              <li><strong>SSH</strong> – crontab -e öffnen, die Cron-Zeile ans Ende setzen, speichern.</li>
              <li><strong>Schweizer Hoster</strong> – Bei Hostpoint, cyon, Infomaniak und Metanet steht der Punkt im Kundenbereich unter «Cronjobs» oder «Geplante Aufgaben». Ohne Shell-Zugang die Variante mit der Adresse nehmen.</li>
            </ul>
          </div>

        </div>
        <template #fuss>
          <div class="row">
            <button type="button" class="btn" :disabled="pruefend" @click="cronPruefen">{{ pruefend ? 'Wird geprüft …' : 'Erneut prüfen' }}</button>
            <button type="button" class="btn btn-primary" @click="cronOffen = false">Schliessen</button>
          </div>
        </template>

      </Modal>
    </div>
  `,
  data() {
    return { updateStand, verlauf: [], laeuft: false, schritt: '', ergebnis: null, sso: null, ssoMeldung: '', ssoFehler: false, testAn: '', mailMeldung: '', mailFehler: false, kopiert: '', cronOffen: false, pruefend: false, ZUSTAND }
  },
  computed: {
    cron() {
      return this.sso.cron
    },
    felder() {
      return [
        { id: 'intervall', label: 'Intervall', wert: this.cron.intervall },
        { id: 'befehl', label: 'Befehl', wert: this.cron.befehl },
        { id: 'skript', label: 'Nur Skriptpfad', wert: this.cron.skript },
        { id: 'leer', label: 'Argumente', wert: '' },
      ]
    },
    // Neuerungen der verfügbaren Version (Text des Releases)
    async neuerungen() {
      return punkte(updateStand.neuerungen || '')
    },
  },
  async created() {
    this.pruefen()
    this.verlaufLaden()
    const sso = await api.anfrage('einstellungen_lesen')
    for (const id of Object.keys(sso.anbieter)) sso.sso[id] = { url: '', clientId: '', clientSecret: '', ...sso.sso[id] }
    this.sso = sso
  },
  methods: {
    // Änderungsverlauf der installierten Version (changelog.md: «## 1.4.13» leitet eine Version ein)
    async verlaufLaden() {
      const antwort = await fetch('changelog.md?v=' + encodeURIComponent(appStand.version)).catch(() => null)
      if (!antwort?.ok) return
      const text = await antwort.text()
      this.verlauf = text.split(/^## /m).slice(1).map((teil) => ({ version: teil.split('\n')[0].trim(), punkte: punkte(teil) }))
    },
    async ssoSpeichern() {
      this.ssoMeldung = ''
      try {
        await api.anfrage('einstellungen_speichern', '', { sso: this.sso.sso })
        this.ssoFehler = false
        this.ssoMeldung = 'Gespeichert.'
      } catch (fehler) {
        this.ssoFehler = true
        this.ssoMeldung = fehler.message
      }
    },
    kopieren(was, text) {
      navigator.clipboard.writeText(text)
      this.kopiert = was
      setTimeout(() => (this.kopiert = ''), 2500)
    },
    // Status neu laden (läuft der Cronjob inzwischen?)
    async cronPruefen() {
      this.pruefend = true
      this.sso.cron = (await api.anfrage('einstellungen_lesen').catch(() => this.sso)).cron
      this.pruefend = false
    },
    async speichernStunde() {
      await api.anfrage('einstellungen_speichern', '', { mailStunde: this.sso.mailStunde }).catch((fehler) => hinweis(fehler.message))
    },
    async cronJetzt() {
      this.laeuft = true
      try {
        const lauf = await api.anfrage('cron_jetzt')
        await this.cronPruefen()
        if (lauf.fehler) hinweis('Fehler beim Versand: ' + lauf.fehler)
      } catch (fehler) {
        hinweis(fehler.message)
      }
      this.laeuft = false
    },
    async mailSpeichern() {
      this.mailMeldung = ''
      try {
        await api.anfrage('einstellungen_speichern', '', { mail: this.sso.mail })
        this.mailFehler = false
        this.mailMeldung = 'Gespeichert.'
      } catch (fehler) {
        this.mailFehler = true
        this.mailMeldung = fehler.message
      }
    },
    // Speichert zuerst, damit der Test die eingegebenen Werte verwendet
    async mailTesten() {
      this.laeuft = true
      await this.mailSpeichern()
      try {
        await api.anfrage('mail_testen', '', { an: this.testAn })
        this.mailFehler = false
        this.mailMeldung = 'Test-Nachricht verschickt.'
      } catch (fehler) {
        this.mailFehler = true
        this.mailMeldung = fehler.message
      }
      this.laeuft = false
    },
    async pruefen() {
      this.laeuft = true
      this.schritt = 'Prüfe auf Updates …'
      await updatePruefen(true)
      this.laeuft = false
    },
    async installieren() {
      if (!(await bestaetigen(`Update auf Version ${updateStand.aktuell} jetzt installieren?`))) return
      this.laeuft = true
      this.schritt = 'Lade Paket und ersetze Dateien …'
      try {
        this.ergebnis = await api.anfrage('update_installieren')
        updateStand.lokal = this.ergebnis.version
        updateStand.verfuegbar = false
        this.schritt = 'Fertig – Seite wird neu geladen …'
        setTimeout(() => location.reload(), 2500)
      } catch (fehler) {
        updateStand.fehler = fehler.message
        this.laeuft = false
      }
    },
  },
}
