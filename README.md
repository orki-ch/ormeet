# Ormeet – Sitzungsprotokolle

Vue 3 (Options API) · Vue Router · eigenes CSS (`css/ormeet.css`) · pdfmake · PHP-Backend (JSON-Dateien)
Kein Build-Schritt: alle Bibliotheken liegen lokal in `lib/`.

## Deployment

1. Ganzen Ordner (`index.php`, `index.html`, `api.php`, `cron.php`, `version.md`, `changelog.md`, `js/`, `css/`, `lib/`) auf den Webserver kopieren
   (PHP 7.4+ mit `openssl`).
2. In `api.php` das `ADMIN_PASSWORT` ändern; optional in `index.php` `ORMEET_KONTAKT` mit einer Kontaktangabe für die
   Datenschutzerklärung füllen (ältere Installationen: `window.ORMEET_KONTAKT` in `index.html` gilt weiter).
3. `index.php` aufrufen (`index.html` leitet nur dorthin weiter) – `api.php` legt den Ordner `data/` (inkl. `.htaccess`)
   und die Schlüsseldatei `schluessel.php` beim ersten Aufruf selbst an; beides muss für PHP beschreibbar sein.
4. Optional: unter Einstellungen den E-Mail-Versand (Absender, SMTP oder `mail()`) und den Cronjob einrichten
   (`cron.php` stündlich per `php` oder per Adresse `cron.php?schluessel=…`; die Angaben zeigt *Cronjob einrichten*).

**Cache nach Version:** `index.php` hängt die installierte Version (`version.md`) als `?v=` an `css/`, `lib/` und
`js/main.js` und liefert eine Import Map, die jedes Modul unter `js/` auf seine versionierte Adresse abbildet – so
sind auch die gegenseitigen `import`-Pfade versioniert. `index.php` selbst geht mit `Cache-Control: no-cache` raus.
Nach einem Update holt jeder Browser damit zwingend die neuen Dateien. `api.php` sendet `X-Ormeet-Version`; weicht
sie von der geladenen Version (`<meta name="ormeet-version">`) ab, zeigt `App.js` einen Banner «Neu laden» (`appStand`
in `js/api.js`).

## Sicherheit

- **Verschlüsselte Ablage:** Jede Datei in `data/` ist mit AES-256-GCM verschlüsselt (Kennung `ORMEET1:` + Base64 von
  IV, Tag, Chiffrat). Der Schlüssel liegt in `schluessel.php` (kein Web-Output, nicht im Repo, wird vom Updater nie
  überschrieben). Unverschlüsselte Dateien (alter Datenbestand, eingespielte Sicherung) werden beim ersten Lesen
  verschlüsselt. Sicherung = `data/` **und** `schluessel.php`.
- **Superadmin-Token:** Das Passwort wird nur beim Anmelden geschickt und gegen einen Token getauscht
  (`data/superadmin.json`, max. 10 Geräte); «Abmelden» löscht ihn serverseitig. Fehlversuche (Superadmin und Konto)
  werden pro Adresse gezählt: nach 10 in 15 Minuten ist die Anmeldung gesperrt (`data/anmeldeversuche.json`).
- **CSRF:** Auth läuft ausschliesslich über den Header `X-Token` (keine Cookies) – fremde Seiten können ihn nicht setzen.
  SSO-`state` ist HMAC-signiert und zusätzlich an ein Cookie (`ormeet_sso`, SameSite=Lax) gebunden.
- **CSP** als Header aus `index.php` (`script-src 'self' 'unsafe-eval' 'nonce-…'` – Vue kompiliert Templates zur
  Laufzeit; keine Inline-Scripts ausser der Import Map mit Nonce).
- **Kalender-Abo** eines Kontos verwendet den persönlichen Link des Mitglieds, nie den Konto-Token.
- Gremium-Links erhalten Schlüssel nur für Bereiche, die sie bearbeiten dürfen (`bereinigen()`).

Das Routing läuft über `#/…`, es sind keine Server-Regeln nötig.

## Updates

Ormeet prüft beim Anmelden des Superadmins einmal täglich `api.github.com/repos/orki-ch/ormeet/releases/latest`
(Konstante `GITHUB_REPO` in `api.php`). Ist die dortige Version neuer, erscheint ein Hinweis am Einstellungs-Symbol;
«Update installieren» lädt das automatisch erzeugte Quellcode-ZIP des Releases (mit PHP-`zip`) oder holt ersatzweise
jede Datei einzeln über die GitHub-API. `data/`, `schluessel.php`, das Passwort und `window.ORMEET_KONTAKT` bleiben dabei erhalten.

Release veröffentlichen: `version.md` erhöhen, `changelog.md` um die neue Version ergänzen (einfache Sprache, ohne
Technik), committen/pushen, auf GitHub unter **Releases** ein Release mit Tag = Versionsnummer und demselben Text als
Beschreibung anlegen. Die Einstellungen zeigen den Änderungsverlauf aus `changelog.md` und für eine noch nicht
installierte Version die Release-Beschreibung (`update_pruefen` liefert sie als `neuerungen`). Ein Commit ohne Release löst kein Update aus. Details: `webseite/README.md`.

## Zugriff & Rechte

| Rolle           | Wie                                              | Darf                                                |
|-----------------|--------------------------------------------------|-----------------------------------------------------|
| Superadmin      | Passwort auf der Login-Seite                     | alles, inkl. Gremien anlegen/löschen und teilen, Konten & Links verwalten (`/benutzer`), SSO-Einstellungen. Mit einem Konto verknüpft (`superadmin.json` → `benutzerId`, Aktion `superadmin_konto`): `zugriff.konto` und persönliche Übersicht `/uebersicht` dieses Kontos |
| Konto           | E-Mail/Passwort oder SSO (Sublevia, Orki); entsteht über einen persönlichen Link | pro Gremium: Eigentümer (selbst angelegt, wie Superadmin nur dort) oder verknüpftes Mitglied (wie persönlicher Link); Gremium-Wechsel im Dashboard, Kalender-Link pro Gremium |
| Gremium-Link    | Tab «Teilen» im Gremium, beliebig viele Links    | pro Link einstellbar: Sitzungen / Mitglieder & Rollen / Protokoll-Einstellungen je nicht sichtbar, nur lesen oder bearbeiten |
| Freigabe-Link   | Allgemeiner Link im Vorprotokoll                 | Anwesenheit, Gäste und Traktanden dieses Vorprotokolls. Wer ihn öffnet, trägt sich zuerst ein (siehe *Allgemeine Links*) |
| Zusätzlicher Link | `sitzung.links[]` (`#/link/<key>`, Rolle `link`), beliebig viele pro Dokument `terminfindung` / `vorprotokoll` / `protokoll` | `stufe` `lesen` / `alles` / `individuell` mit `rechte` (siehe `EINZELRECHTE` in `api.php` und `js/utils/rechte.js`). Nur sein Dokument; Sitzung starten, abschliessen oder Kopfdaten ändern nie (`linkRechteAnwenden`). Schlüssel sehen Admin, Gremium-Zugänge mit Bearbeitungsrecht und die Leitung der Sitzung |
| Persönlicher Link | Link pro Mitglied / Gast im Vorprotokoll       | Traktanden / Unterpunkte, bei denen die Person verantwortlich oder als Bearbeiter eingetragen ist, plus eigene Anwesenheit. Pro Dokument überschreibbar durch `sitzung.freigaben[vorprotokoll\|protokoll][personId]` = `lesen` / `eigene` / `alles` oder eine Liste von Einzelrechten («Individuell», `vorprotokollEinzelrechte` / `protokollEinzelrechte`) (Teilen-Karte). Sitzungsleitung und Protokollführung (Standard `alles`) dürfen zudem Vorprotokoll und Protokoll neu anlegen (Sitzung starten) und das Protokoll entfernen (`personRechteAnwenden`) |
| Verfolger-Link  | «⋯» im Protokoll                                 | Live-Ansicht des Protokolls, nur lesen (aktualisiert alle 5 s) |

Jeder Link kann jederzeit erneuert werden (alter Link wird ungültig). Ein früherer Einzel-Zugangslink wird
beim ersten Laden in einen Link «Vollzugriff» überführt.
Das Token wird im Browser gespeichert; «Abmelden» löscht es.

### Konten

Konten liegen in `data/benutzer.json` (Passwort-Hash, SSO-Subjects, Anmelde-Tokens, `darfGremienAnlegen`).
Verknüpfung: `mitglieder[].benutzerId`; selbst angelegte Gremien tragen `gremium.eigentuemerId`. Der Server
löst pro Anfrage die wirksame Rolle für das angefragte Gremium auf (`effektiverZugriff`), der Client über
`rolleIm(gremiumId)` in `js/utils/rechte.js`. Konten entstehen nur über einen persönlichen Link (oder durch den
Superadmin); Registrierung von der Login-Seite gibt es nur per SSO.

SSO ist ein generischer OpenID-Connect-Client (Authorization Code). Anbieter: Sublevia (Authentik-Pfade) und
Orki (`/_/call/oidc/...`, siehe orki-Repo). Konfiguration in `data/einstellungen.json`, gepflegt unter
Einstellungen; Rückruf-Adresse `api.php?aktion=sso_callback`. Der `state` ist HMAC-signiert (kein Sitzungsspeicher).

### Sitzungen eintragen

Präsidium und Aktuariat mit verknüpftem Konto (`zugriff.konto`, nicht über den persönlichen Link) dürfen in ihrem Gremium
Sitzungen und Kurzsitzungen eintragen, andere Konten mit `mitglied.darfSitzungenEintragen` (vergeben durch Superadmin unter
Benutzer & Links, Eigentümer im Mitglieder-Dialog oder Präsidium / Aktuariat in der persönlichen Übersicht). Neue Sitzungen
tragen `erstelltVon`; ihre Ersteller dürfen sie ohne Protokoll wieder löschen (`personRechteAnwenden`).

### Terminfindung

Bearbeiten (Vorschläge, Einstellungen, Termin festlegen) dürfen Superadmin / Eigentümer, Gremium-Zugänge mit
Bearbeitungsrecht, die Person `sitzung.erstelltVon` (ohne Angabe: die Sitzungsleitung) und `terminfindung.freigabe`
(Personen-IDs oder `rolle:<id>`); freigeben darf nur die erstellende Person (`terminfindungMerge`). `terminfindung.entfernt`:
entfernte Personen sind für diese Sitzung entschuldigt – `abmeldungenUebertragen` nimmt sie aus der Anwesenheit des
Vorprotokolls (bzw. wieder auf); jede Person darf sich selbst entfernen oder wieder aufnehmen.

Konto über einen allgemeinen Link (Freigabe-Link ohne Person oder zusätzlicher Link): `registrieren` / `anmelden` / SSO
legen die Person als Gast der Sitzung an (`weiterePerson: true`, `benutzerId`; fehlt das Vorprotokoll, entsteht ein leeres).
Namentliche Stimmen und Kommentare aus diesem Browser (`localStorage` `ormeet-namen`) gehen auf sie über. Das Konto erhält
über `benutzerGremien` die Rolle `gast` (wirksam wie ein Gast-Link). `weitere_person_verknuepfen` führt sie mit einem
Mitglied zusammen (Superadmin / Eigentümer, Gremium-Zugang mit Bearbeitungsrecht, Leitung / Protokollführung, Präsidium /
Aktuariat).

Pendenzen: `faelligBis` ist ein Datum oder `naechste` (bis zur nächsten Sitzung = `naechsterTerminId`, sonst die nächste
Sitzung mit späterem Datum; `fristDatum` / `fristText` in `js/stores/sitzungen.js`, `fristDatum` in `api.php`).

### Änderungsanträge

Nach Abschluss einer Sitzung (bis zur Genehmigung, nie bei Kurzsitzungen) stehen sie in `protokoll.aenderungsantraege`
(`zielId` = Traktandum, Unterpunkt oder Eintrag). Stellen dürfen Mitglieder mit verknüpftem Konto, die erwartet oder
anwesend waren; entscheiden die Protokollführung, Admin und Gremium-Zugänge mit Bearbeitungsrecht. Der Server führt die
Liste bei jedem Speichern zusammen (`aenderungsantraegeMerge`): fremde Anträge gehen nie verloren, Text und Zurückziehen
nur durch die antragstellende Person, Entscheide nur durch Berechtigte. Im Editor werden sie direkt im Store bearbeitet,
nicht in der Arbeitskopie des Protokolls.

### Kurzsitzungen

Einmalsitzungen ohne Vorprotokoll, ohne nächsten Termin und ohne Genehmigung: `sitzung.kurz = true`. Ein verstecktes
Vorprotokoll hält Teilnehmende (`anwesendeMitgliederIds`), Gäste mit `personenKeys` und die im Protokoll fortlaufend
erfassten Traktanden; Freigaben gelten dort wie fürs Protokoll (`freigabeStufe`). `sitzungenVonGremium` liefert sie nicht
(nicht im Ablauf), `kurzsitzungen(gremiumId)` schon; Pendenzen und vertagte Anträge werden nicht übertragen.
Ohne Gremium liegt jede Kurzsitzung in einem eigenen Behälter (`gremium.kurz = true`, eine Datei in `data/`): die
Eingeladenen sind seine Mitglieder (persönlicher Link); ein Konto mit derselben E-Mail gilt als verknüpft
(`benutzerGremien`). Anlegen dürfen Superadmin und Konten mit `darfKurzsitzungenAnlegen`.

Benachrichtigungen (`js/stores/benachrichtigungen.js`) werden clientseitig aus den geladenen Daten abgeleitet;
gelesene IDs liegen in `localStorage`. Für die Sammelmails leitet `kontoMitteilungen` in `api.php` dieselben IDs serverseitig ab.

### Allgemeine Links, Schutz und Zugriffe

- **Eintragen:** Ein allgemeiner Link (Rolle `link` oder `freigabe` ohne Person) zeigt `EintragDialog` (nicht schliessbar).
  `link_eintragen` legt einen Gast im Vorprotokoll an (`weiterePerson`, `ueberLink` = Link-ID bzw. `freigabe`, eigener
  `personenKeys`-Eintrag) und gibt dessen Schlüssel zurück; der Browser wechselt auf `#/freigabe/<key>[/seite]` und merkt
  sich die Zuordnung (`localStorage` `ormeet-eingetragen`). Rechte: ohne gesetzte Freigabe die des Links (`freigabeRoh` /
  `linkGastFreigabe`, Server über `linkGaesteMerken`); sein Link läuft mit dem allgemeinen ab (`gastZugriff`).
- **Doppelt:** gleicher Name oder gleiche E-Mail wie ein Mitglied oder Gast der Sitzung -> `gast.vorschlag`
  (`doppelteSuchen`). Annehmen über `weitere_person_verknuepfen` (Ziel Mitglied oder Gast; der bisherige Schlüssel öffnet
  danach als Ziel: `vorprotokoll.aliasKeys`), ablehnen über `vorschlag_ablehnen`.
- **Schutz:** Passwort-Hashes in `bundle.linkSchutz[ref]` (`link:<id>`, `freigabe:<vpId>`, `zugang:<id>`; Aktion
  `link_passwort`), nie zum Client (nur `geschuetzt`). Freischaltung pro Gerät: `link_entsperren` liefert eine HMAC, die
  der Client als `X-Freischaltung` mitsendet. Ablauf im Link (`ablauf`, `freigabeLinkAblauf`): Datum oder `genehmigt`.
  Gesperrte Zugänge antworten mit `gesperrt` = `passwort` / `abgelaufen` / `gesperrt` (Seite `#/gesperrt`).
- **Sperren:** `mitglied.gesperrt` (ganzes Gremium, auch Konto), `sitzung.gesperrt[]` (nur diese Sitzung; die Leitung nie).
- **Zuletzt genutzt:** `bundle.nutzung[ref]` = Datum (höchstens ein Schreibvorgang pro Zugang und Tag, `nutzungMerken`).
- **Übersicht:** `ZugriffeListe` pro Sitzung (`#/sitzung/<id>/zugriffe`), pro Gremium (Reiter *Zugriffe*) und gesamt
  (Benutzer & Links). Sitzungsleitung / Protokollführung sehen die Links ihrer Sitzungen (`personSicht`).

### E-Mails

`mailSenden` nutzt den SMTP-Server aus den Einstellungen (`smtpSenden`: STARTTLS / SSL, AUTH LOGIN), sonst `mail()`.
*Passwort vergessen* (`passwort_vergessen` / `passwort_zuruecksetzen`): Link `#/passwort/<code>`, eine Stunde gültig,
gespeichert nur als Hash. `cron.php` (stündlich) verschickt ab `mailStunde` einmal am Tag pro Konto eine Sammelmail mit
den noch nicht gemeldeten Mitteilungen (`data/mails.json`, erster Lauf merkt sich nur den Stand; Status in
`data/cron.json`). Abbestellen: signierter Link (`abbestellen`) oder *Mein Konto* (`mailsAus`). Erinnerung «Sitzung steht
bevor»: `gremium.erinnerungTage` (Standard 3).

Dialoge (`js/utils/dialog.js`): `$.confirm` / `$.alert` aus jquery-confirm (wie in Orki; jQuery und Plugin in `lib/`).

## Struktur

```
index.php                     Startseite: lädt lib/, css/ormeet.css und js/main.js versioniert (?v=, Import Map), CSP-Header
index.html                    Leitet nur nach index.php weiter (js/weiter.js), hält #/route
api.php                       Backend: laden / speichern / löschen, eine JSON-Datei pro Gremium in data/
lib/                          Vue, Vue Router, pdfmake, jQuery + jquery-confirm (lokal, ohne CDN)
cron.php                      Cronjob: tägliche Sammelmails (Kommandozeile oder Adresse mit Schlüssel)
js/
  main.js, App.js             App-Bootstrap, Rahmen mit Speicherstatus und Abmelden
  router.js                   Routen + Zugriffsprüfung (Login, Zugangs-/Freigabe-Links)
  api.js                      HTTP-Client (Token im Header X-Token)
  stores/
    gremien.js                Gremien, Rollen, Themenbereiche, Mitglieder, Vorlagen
    sitzungen.js              Sitzungen, Vorprotokolle, Protokolle, Pendenzen-Übertrag
    sync.js                   Abgleich mit dem Server (nur geänderte Datensätze, alle 30 s Abholen)
    migration.js              Ergänzt ältere Datenbestände um neue Felder
    updates.js                Update-Prüfung (GitHub-Releases)
    benachrichtigungen.js     Benachrichtigungen aus den Daten ableiten, Gelesen-Status
  views/
    Login.js                  Anmeldung: Konto (E-Mail/Passwort, SSO) oder Superadmin-Passwort
    Konto.js                  Eigenes Konto: Name, Passwort, Anbieter, Geräte
    Benutzer.js               Superadmin: Konten (Gremien-Zuordnung, Rechte) und alle Zugriffe
    ZugriffeSeite.js          Zugriffsübersicht einer Sitzung
    FreigabeSeite.js          Freigabe-Link: Vorprotokoll, Terminfindung oder Protokoll (Link bleibt in der Adresse)
    LinkGesperrt.js           Link mit Passwort, abgelaufen oder gesperrt
    PasswortNeu.js            Neues Passwort über den Link aus der E-Mail
    GremiumListe.js           Dashboard aller Gremien
    GremiumDetail.js          Gremium pflegen: Suche, Sitzungen, Themenbereiche, Mitglieder, Rollen, Vorlagen
    VorprotokollEditor.js     Kopfdaten, Anwesenheit, Gäste, Traktanden, Freigabe-Link
    ProtokollEditor.js        Live-Protokoll mit Auto-Save / Ctrl+S, nächster Termin
    ThemenbereichSummary.js   Historische Aggregation pro Themenbereich (ID «ohne»: ohne Themenbereich)
    ProtokollAnsicht.js       Live-Ansicht über den Verfolger-Link (nur lesen)
    PersonSeite.js            Persönliche Übersicht (persönlicher Link / Konto mit Gremium-Wechsel, Konto anlegen)
    TerminfindungSeite.js     Terminfindung (Abstimmung)
    Einstellungen.js          Superadmin: Updates, SSO-Anbieter, E-Mail-Versand, Cronjob
    Hilfe.js                  Dokumentation in einfacher Sprache
    Datenschutz.js            Datenschutzerklärung nach DSG (erkennt Domain / Speicherort automatisch)
  components/
    TraktandenListe.js        Traktanden mit Unterpunkten (bis drei Ebenen), Person, Notiz, Typ, geplante Dauer
    Unterpunkte.js            Unterpunkt-Baum (rekursiv): Anzeige und Inline-Bearbeitung im selben Layout, Slot für Einträge
    EintragListe.js           Einträge (Information / Antrag / Pendenz) pro Traktandum, Typ ggf. vorgegeben
    TeilenKarte.js            Wer hat welchen Zugriff auf Vorprotokoll / Protokoll, Freigabestufen, Links
    GremiumSuche.js           Suche über Sitzungen, Traktanden und Einträge eines Gremiums
    ThemenbereichLinks.js     Schnellzugriff auf die Themenbereich-Übersichten inkl. «Ohne Themenbereich»
    SitzungKopfdaten.js       Titel, Datum, Zeit, Ort, Leitung, Protokollführung, Bemerkungen
    PersonInput.js            Einzelperson (Pendenz-Zuweisung): freie Eingabe oder Auswahl
    PersonenInput.js          Mehrere Personen als Chips (Verantwortliche, Bearbeiter)
    GaesteListe.js            Gäste als Chips mit Kurzformular
    MiniKalender.js           Monatskalender zum Anklicken von Tagen (Terminfindung)
    MenuDropdown.js           «⋯»-Menü für seltene Aktionen; mit `text` eine Pille, mit `panel` ein Formular, das offen bleibt
    Benachrichtigungen.js     Glocke mit Benachrichtigungen in der Kopfleiste
    SsoButtons.js             «Mit … anmelden»-Schaltflächen der eingerichteten Anbieter
    Modal.js                  Dialog im Aussehen der Bestätigungen (Slot «fuss» für die Knöpfe), schliesst nur über Knöpfe
    PdfExportButton.js        PDF-Export (Vorprotokoll / Protokoll)
    Zusatztraktanden.js       Im Protokoll hinzugekommene Haupttraktanden (protokoll.zusatztraktanden, ohne Nummer, mit Begründung)
    KurzsitzungDialog.js      Neue Kurzsitzung (mit/ohne Gremium), Termin standardmässig heute zur nächsten Viertelstunde
    KurzsitzungenListe.js     Zeilen einer Kurzsitzungs-Liste (Übersicht, Gremium-Reiter, persönliche Übersicht)
    KurzTeilnehmende.js       Teilnehmende einer Kurzsitzung wählen bzw. einladen (Behälter: Name, E-Mail, Link)
    InfoKnopf.js              Hinweis als (i)-Knopf oder graue Pille, Text als Tooltip
    MehrfachAuswahl.js        Mehrfachauswahl als Pillen mit ✕ (Rückfrage), z. B. Konto-Rechte, Freigabe der Terminfindung
    RechteSchalter.js         Stufen-Schalter mit Einzelrechten im ⋯-Menü (Pille «Individuell»)
    LinkZeilen.js             Zusätzliche allgemeine Links eines Dokuments (sitzung.links)
    KontoKarte.js             Konto anlegen / anmelden für eingetragene Personen (weitere Person)
    EintragDialog.js          Allgemeiner Link: Vor-, Nachname und E-Mail (nicht schliessbar), danach eigener Link
    ZugriffeListe.js          Wer hat Zugriff und worüber, zuletzt genutzt; sperren, entfernen, zusammenführen, Links
    LinkSchutzDialog.js       Passwort und Ablauf eines allgemeinen Links
    SitzungDialog.js          Neue Sitzung (Gremium-Seite und persönliche Übersicht), setzt erstelltVon
    FristFeld.js              Frist einer Pendenz: Datum oder «bis zur nächsten Sitzung»
    Aenderungsantraege.js     Liste der Änderungsanträge eines Protokolls (entscheiden, ändern, zurückziehen)
    ThemenbereichSelect.js    Auswahl eines Themenbereichs
  pdf/dokumente.js            pdfmake-Dokumentdefinitionen
  utils/                      Labels/Datumsformat, Zufalls-Keys, Traktanden-Struktur, Rechte, Vorschau-/Bearbeiten-Mixin, v-wachsen (Textfeld wächst mit),
                              effekte.js (Mikro-Interaktionen nach aeweb-Designsystem: Lichtschein, Klick-Welle, Reiter seitlich scrollen)
changelog.md                  Änderungsverlauf für die Einstellungen (pro Version «## x.y.z» und Punkte «- …»)
```

## Workflow

1. Gremium anlegen → Rollen (inkl. «an Sitzungen erwartet»), Mitglieder (mit Stimmrecht), Themenbereiche, Fusstext pflegen.
   Mitglieder nicht erwarteter Rollen sind standardmässig nicht anwesend und zählen nicht als entschuldigt.
2. Vorlage(n) erstellen: Titel, Sitzungsleitung, Protokollführung, Traktanden mit Unterpunkten. Eine geänderte Vorlage
   lässt sich nachträglich auf gewählte Sitzungen ohne Protokoll anwenden (`wendeVorlageAn`: Kopfdaten und Traktanden
   werden ersetzt, automatisch übernommene Traktanden bleiben).
3. Sitzung erfassen (mit oder ohne Vorlage) → «Vorprotokoll» öffnen. Offene / in Bearbeitung
   befindliche Pendenzen und vertagte Anträge früherer Sitzungen werden automatisch übernommen (`uebernimmPendenzen`):
   steht im neuen Vorprotokoll ein Punkt mit demselben Titelpfad wie der, unter dem der Eintrag damals lag
   (`titelPfad` / `punktMitPfad`), kommt er dort als Unterpunkt hinein (`pendenzId` / `antragId` auch auf Unterpunkten,
   auf Ebene 3 als Nachbar), sonst als eigenes Traktandum ans Ende. Früher angehängte Haupttraktanden werden beim
   Öffnen nachträglich verschoben, sobald der Ort existiert. `setzeVorprotokollZurueck` (⋯-Menü) löscht das Vorprotokoll und
   legt es per `erstelleVorprotokoll` neu an (Vorlage, Anwesenheit, Übernahme); der allgemeine Freigabe-Link bleibt.
4. Freigabe-Links verschicken: der allgemeine Link für das ganze Vorprotokoll, die persönlichen
   Links für einzelne Personen (sie sehen alles, bearbeiten aber nur ihre Traktanden und Anwesenheit).
   Pro Traktandum und Unterpunkt gibt es «Verantwortlich» (frei oder aus der Liste, mehrere möglich) und
   «Dürfen zusätzlich bearbeiten» (Personen, Rollen oder die Gruppen Alle / Stimmberechtigte / Ohne Stimmrecht).
   Unterpunkte können selbst Unterpunkte haben (`untertraktanden`, rekursiv, `MAX_TIEFE` = 3 Ebenen: 2.1.1); Rechte und
   Typ erben sie vom Element darüber (`traktandenMerge` / `erlaubteSammeln` in `api.php` arbeiten rekursiv).
   Wer berechtigt ist, sieht seine Traktanden mit blauem Rahmen und kann sich selbst als verantwortlich eintragen.
   Pro Traktandum optional `typ` (information / antrag / antraege / pendenz – gilt für alles darunter, `kindTyp`) und
   `dauer` (geplante Minuten); Unterpunkte ohne Traktandum-Typ können einen eigenen Typ haben.
   Anträge entstehen nur im Vorprotokoll: Ein Punkt vom Typ `antrag` ist selbst der Antrag (`istAntragPunkt`, keine
   Unterpunkte möglich); bei `antraege` ist jeder Unterpunkt ein Antrag. `starteProtokoll` legt dafür per
   `uebernimmAntraege` einen offenen Antrag (Titel, Notiz als Inhalt) im Protokoll an; die Notiz wird im Protokoll
   nicht mehr separat gezeigt. Im Protokoll gibt es für Anträge nur Beschluss und Stimmen – kein Hinzufügen, Ändern
   oder Löschen (`EintragListe`, Typwahl `EINTRAG_TYP_WAHL`). Ältere Antrag-Punkte mit Unterpunkten werden beim Laden
   zu `antraege` (`migration.js`).
5. «Sitzung starten» → Live-Protokoll. Sobald ein Protokoll existiert, ist das Vorprotokoll gesperrt (Client:
   `gesperrt` im VorprotokollEditor, `uebernimmPendenzen` zieht nichts mehr nach) und im Protokoll gibt es keine neuen
   Traktanden – die Traktandenliste steht fest. `loescheProtokoll` («Protokoll entfernen», nur Admin / Gremium-Zugang)
   setzt die Sitzung auf `vorprotokoll` zurück. Pro Traktandum oder Unterpunkt Einträge erfassen; tatsächliche Dauer in
   `protokoll.dauern[traktandumId]`. Unterpunkte erben den Themenbereich des Traktandums. Übertragene Pendenzen
   werden direkt am Original aktualisiert, damit sie überall denselben Stand haben. Vertagte Anträge (`antragStatus`
   `vertagt`) kommen als Traktandum (`antragId`) ins nächste Vorprotokoll und werden dort als neuer Antrag
   (`vorherigerAntragId`) entschieden; Anträge tragen `stimmen` (ja / nein / enthaltung).
   «Letztes Protokoll genehmigen» setzt `sitzung.genehmigt = { sitzungId, datum }` an der vorherigen Sitzung:
   deren Vorprotokoll / Protokoll ist danach für alle eingefroren (Client `vollzugriff`, Server `genehmigungSchuetzen`),
   nur Status / Person / Frist der Pendenzen werden nachgeführt. Wird die genehmigende Sitzung gelöscht, fällt die Sperre.
6. Nächsten Termin (mit Vorlage) erfassen, Sitzung abschliessen, PDF exportieren.

## Bedienprinzip

Listen (Traktanden, Einträge, Rollen, Themenbereiche, Kopfdaten) zeigen eine ruhige Vorschau.
Ein Klick öffnet genau dieses Element zur Bearbeitung **im selben Layout**: Titel und Notizen werden nahtlos im Element
getippt (`.nahtlos`), Einstellungen liegen in Pillen (`MenuDropdown` mit `text`/`panel` bzw. `select.btn-pille`);
«Fertig» oder Escape schliesst. Der Karten-Klick läuft in der Capture-Phase, damit «Fertig» die Karte nicht gleich wieder öffnet.
Seltene Aktionen (Löschen, Verschieben, Links, PDF) liegen in «⋯»/«⋮»-Menüs; Mitglieder und neue Sitzungen werden im Dialog erfasst.
Die Gremium-Seite ist in die Tabs Sitzungen / Mitglieder & Rollen / Protokoll-Einstellungen / Teilen gegliedert.
Oben rechts «Hilfe», im Footer «Datenschutz».

## Hinweise

- Gleichzeitiges Bearbeiten: Änderungen werden pro Datensatz (Gremium, Sitzung, Vorprotokoll,
  Protokoll) übertragen. Zwei Personen können parallel an verschiedenen Dingen arbeiten; bearbeiten
  beide denselben Datensatz, gewinnt die zuletzt gespeicherte Version.
- `data/` wird per `.htaccess` gegen direkten Zugriff geschützt (Apache). Bei nginx muss der Ordner
  separat gesperrt werden. Die Dateien sind zusätzlich verschlüsselt (siehe Sicherheit).
- `data/` enthält neben den Gremien: `benutzer.json`, `superadmin.json`, `einstellungen.json`, `anmeldeversuche.json`.
