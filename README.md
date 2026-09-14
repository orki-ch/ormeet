# Ormeet – Sitzungsprotokolle

Vue 3 (Options API) · Vue Router · eigenes CSS (`css/ormeet.css`) · pdfmake · PHP-Backend (JSON-Dateien)
Kein Build-Schritt: alle Bibliotheken liegen lokal in `lib/`.

## Deployment

1. Ganzen Ordner (`index.html`, `api.php`, `js/`, `lib/`) auf den Webserver kopieren (PHP 7.4+).
2. In `api.php` das `ADMIN_PASSWORT` ändern; optional in `index.html` `window.ORMEET_KONTAKT`
   mit einer Kontaktangabe für die Datenschutzerklärung füllen.
3. `index.html` aufrufen – `api.php` legt den Ordner `data/` (inkl. `.htaccess`) beim ersten Aufruf
   selbst an; das Verzeichnis muss für PHP beschreibbar sein.

Das Routing läuft über `#/…`, es sind keine Server-Regeln nötig.

## Updates

Ormeet prüft beim Anmelden des Superadmins einmal täglich `api.github.com/repos/orki-ch/ormeet/releases/latest`
(Konstante `GITHUB_REPO` in `api.php`). Ist die dortige Version neuer, erscheint ein Hinweis am Einstellungs-Symbol;
«Update installieren» lädt das automatisch erzeugte Quellcode-ZIP des Releases (mit PHP-`zip`) oder holt ersatzweise
jede Datei einzeln über die GitHub-API. `data/`, das Passwort und `window.ORMEET_KONTAKT` bleiben dabei erhalten.

Release veröffentlichen: `version.md` erhöhen, committen/pushen, auf GitHub unter **Releases** ein Release mit
Tag = Versionsnummer anlegen. Ein Commit ohne Release löst kein Update aus. Details: `webseite/README.md`.

## Zugriff & Rechte

| Rolle           | Wie                                              | Darf                                                |
|-----------------|--------------------------------------------------|-----------------------------------------------------|
| Superadmin      | Passwort auf der Login-Seite                     | alles, inkl. Gremien anlegen/löschen und teilen     |
| Gremium-Link    | Tab «Teilen» im Gremium, beliebig viele Links    | pro Link einstellbar: Sitzungen / Mitglieder & Rollen / Protokoll-Einstellungen je nicht sichtbar, nur lesen oder bearbeiten |
| Freigabe-Link   | Allgemeiner Link im Vorprotokoll                 | Anwesenheit, Gäste und Traktanden dieses Vorprotokolls |
| Persönlicher Link | Link pro Mitglied / Gast im Vorprotokoll       | Traktanden / Unterpunkte, bei denen die Person verantwortlich oder als Bearbeiter eingetragen ist, plus eigene Anwesenheit |
| Verfolger-Link  | «⋯» im Protokoll                                 | Live-Ansicht des Protokolls, nur lesen (aktualisiert alle 5 s) |

Jeder Link kann jederzeit erneuert werden (alter Link wird ungültig). Ein früherer Einzel-Zugangslink wird
beim ersten Laden in einen Link «Vollzugriff» überführt.
Das Token wird im Browser gespeichert; «Abmelden» löscht es.

## Struktur

```
index.html                    Lädt lib/-Bibliotheken, css/ormeet.css, startet js/main.js
api.php                       Backend: laden / speichern / löschen, eine JSON-Datei pro Gremium in data/
lib/                          Vue, Vue Router, pdfmake (lokal, ohne CDN)
js/
  main.js, App.js             App-Bootstrap, Rahmen mit Speicherstatus und Abmelden
  router.js                   Routen + Zugriffsprüfung (Login, Zugangs-/Freigabe-Links)
  api.js                      HTTP-Client (Token im Header X-Token)
  stores/
    gremien.js                Gremien, Rollen, Themenbereiche, Mitglieder, Vorlagen
    sitzungen.js              Sitzungen, Vorprotokolle, Protokolle, Pendenzen-Übertrag
    sync.js                   Abgleich mit dem Server (nur geänderte Datensätze, alle 30 s Abholen)
    migration.js              Ergänzt ältere Datenbestände um neue Felder
  views/
    Login.js                  Superadmin-Login
    GremiumListe.js           Dashboard aller Gremien
    GremiumDetail.js          Gremium pflegen: Mitglieder, Rollen, Themenbereiche, Vorlagen, Sitzungen
    VorprotokollEditor.js     Kopfdaten, Anwesenheit, Gäste, Traktanden, Freigabe-Link
    ProtokollEditor.js        Live-Protokoll mit Auto-Save / Ctrl+S, nächster Termin
    ThemenbereichSummary.js   Historische Aggregation pro Themenbereich
    ProtokollAnsicht.js       Live-Ansicht über den Verfolger-Link (nur lesen)
    Hilfe.js                  Dokumentation in einfacher Sprache
    Datenschutz.js            Datenschutzerklärung nach DSG (erkennt Domain / Speicherort automatisch)
  components/
    TraktandenListe.js        Traktanden mit Unterpunkten (zwei Ebenen), Person, Notiz
    EintragListe.js           Einträge (Information / Antrag / Pendenz) pro Traktandum
    SitzungKopfdaten.js       Titel, Datum, Zeit, Ort, Leitung, Protokollführung, Bemerkungen
    PersonInput.js            Einzelperson (Pendenz-Zuweisung): freie Eingabe oder Auswahl
    PersonenInput.js          Mehrere Personen als Chips (Verantwortliche, Bearbeiter)
    GaesteListe.js            Gäste als Chips mit Kurzformular
    MenuDropdown.js           «⋯»-Menü für seltene Aktionen
    Modal.js                  Dialog (Mitglied bearbeiten, Sitzung erfassen)
    PdfExportButton.js        PDF-Export (Vorprotokoll / Protokoll)
    ThemenbereichSelect.js    Auswahl eines Themenbereichs
  pdf/dokumente.js            pdfmake-Dokumentdefinitionen
  utils/                      Labels/Datumsformat, Zufalls-Keys, Traktanden-Struktur, Vorschau-/Bearbeiten-Mixin
```

## Workflow

1. Gremium anlegen → Rollen (inkl. «an Sitzungen erwartet»), Mitglieder (mit Stimmrecht), Themenbereiche, Fusstext pflegen.
   Mitglieder nicht erwarteter Rollen sind standardmässig nicht anwesend und zählen nicht als entschuldigt.
2. Vorlage(n) erstellen: Titel, Sitzungsleitung, Protokollführung, Traktanden mit Unterpunkten.
3. Sitzung erfassen (mit oder ohne Vorlage) → «Vorprotokoll» öffnen. Offene / in Bearbeitung
   befindliche Pendenzen früherer Sitzungen werden automatisch als Traktanden angehängt.
4. Freigabe-Links verschicken: der allgemeine Link für das ganze Vorprotokoll, die persönlichen
   Links für einzelne Personen (sie sehen alles, bearbeiten aber nur ihre Traktanden und Anwesenheit).
   Pro Traktandum und Unterpunkt gibt es «Verantwortlich» (frei oder aus der Liste, mehrere möglich) und
   «Dürfen zusätzlich bearbeiten» (Personen, Rollen oder die Gruppen Alle / Stimmberechtigte / Ohne Stimmrecht).
   Ein Unterpunkt ohne eigene Einträge erbt die Rechte des Traktandums.
   Wer berechtigt ist, sieht seine Traktanden mit blauem Rahmen und kann sich selbst als verantwortlich eintragen.
5. «Sitzung starten» → Live-Protokoll. Pro Traktandum oder Unterpunkt Einträge erfassen.
   Unterpunkte erben den Themenbereich des Traktandums. Übertragene Pendenzen werden direkt am
   Original aktualisiert, damit sie überall denselben Stand haben.
6. Nächsten Termin (mit Vorlage) erfassen, Sitzung abschliessen, PDF exportieren.

## Bedienprinzip

Listen (Traktanden, Einträge, Rollen, Themenbereiche, Kopfdaten) zeigen eine ruhige Vorschau.
Ein Klick öffnet genau dieses Element zur Bearbeitung; Klick daneben, «Fertig» oder Escape schliesst es.
Seltene Aktionen (Löschen, Verschieben, Links, PDF) liegen in «⋯»/«⋮»-Menüs; Mitglieder und neue Sitzungen werden im Dialog erfasst.
Die Gremium-Seite ist in die Tabs Sitzungen / Mitglieder & Rollen / Protokoll-Einstellungen / Teilen gegliedert.
Oben rechts «Hilfe», im Footer «Datenschutz».

## Hinweise

- Gleichzeitiges Bearbeiten: Änderungen werden pro Datensatz (Gremium, Sitzung, Vorprotokoll,
  Protokoll) übertragen. Zwei Personen können parallel an verschiedenen Dingen arbeiten; bearbeiten
  beide denselben Datensatz, gewinnt die zuletzt gespeicherte Version.
- `data/` wird per `.htaccess` gegen direkten Zugriff geschützt (Apache). Bei nginx muss der Ordner
  separat gesperrt werden.
