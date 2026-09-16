# Ormeet – Sitzungen planen, vorbereiten und live protokollieren

Ormeet ist eine schlanke Web-App für Gremien, die sich regelmässig treffen und dabei etwas beschliessen:
Vereinsvorstände, Organisationskomitees, Kommissionen, Stiftungsräte, Genossenschaften, Kirchgemeinden,
Elternräte, Projektteams.

Sie findet den Termin, bereitet die Traktanden gemeinsam mit allen Beteiligten vor und protokolliert die
Sitzung, während sie läuft. Ohne Benutzerkonten: Jede Person bekommt einen Link und sieht genau das, was sie
sehen und bearbeiten darf.

**Website:** [ormeet.ch](https://ormeet.ch) · **Anleitung:** [ormeet.ch/dokumentation.html](https://ormeet.ch/dokumentation.html)

## Was Ormeet kann

- **Termin finden** – Terminvorschläge, Abstimmung mit Ja / Vielleicht / Nein, Summenzeile, Kommentare. Der gewählte Termin wird direkt zur Sitzung.
- **Vorprotokoll & Protokoll** – Traktanden mit Unterpunkten, Vorlagen für wiederkehrende Sitzungen, Verantwortliche, Notizen. Während der Sitzung werden Informationen, Anträge mit Beschluss und Aufgaben (Pendenzen) mit Person und Frist erfasst – automatisch gespeichert, live mitlesbar.
- **Aufgaben, die nicht verloren gehen** – Offene Pendenzen erscheinen automatisch im nächsten Vorprotokoll, bis sie erledigt sind. Zuständige Personen ändern den Stand selbst.
- **Zugang per Link statt Konto** – Ein Passwort für die Verwaltung, Links für alle anderen: für ein ganzes Gremium mit Rechten pro Bereich, persönlich pro Mitglied, für Gäste zu einer einzelnen Sitzung, zum Mitlesen. Links lassen sich jederzeit ersetzen. Die Rechte setzt der Server durch.
- **Themenbereiche** – Alles, was je zu einem Thema besprochen wurde, auf einen Blick; per Link teilbar.
- **Kalender** – Sitzungen, eigene Aufgaben und mögliche Termine erscheinen im eigenen Kalender (Apple, Google, Outlook …).
- **PDF** – Vorprotokoll und Protokoll als sauber strukturiertes PDF.
- **Updates per Klick** – Ormeet meldet neue Versionen und installiert sie in den Einstellungen; Daten und Passwort bleiben unberührt.

## Installation

Ormeet braucht nur ein Webhosting oder einen eigenen Server mit **PHP 7.4 oder neuer**. Kein Build, keine Datenbank.

1. Das aktuelle Paket herunterladen: [Releases](https://github.com/orki-ch/ormeet/releases/latest) → bei «Assets» auf **Source code (zip)** klicken.
2. Entpacken und den Inhalt in einen Ordner auf dem Hosting laden, z. B. `ormeet/`.
3. In `api.php` ganz oben das Passwort ersetzen:
   ```php
   const ADMIN_PASSWORT = 'mein-sicheres-passwort';
   ```
4. Optional in `index.html` eintragen, wer für die Installation verantwortlich ist (erscheint in der Datenschutzerklärung der App):
   ```html
   <script>window.ORMEET_KONTAKT = 'Verein XY, info@example.ch'</script>
   ```
5. Die Adresse im Browser aufrufen und mit dem Passwort anmelden. Ormeet legt den Ordner `data/` für alle Daten selbst an, schützt ihn vor fremdem Zugriff und speichert alles verschlüsselt; der Schlüssel liegt getrennt davon in `schluessel.php`. Sicherung = `data/` **und** `schluessel.php`.

Die ausführliche Anleitung mit Bedienung, Rechten, Sicherung und Umzug: [ormeet.ch/dokumentation.html](https://ormeet.ch/dokumentation.html)

## Updates

Ormeet prüft einmal täglich, ob hier ein neues Release vorliegt. Die Verwaltung sieht dann einen Hinweis am
Zahnrad-Symbol und installiert das Update per Klick. `data/`, `schluessel.php`, Passwort und Kontaktangabe bleiben erhalten.

## Hilfe & Support

Für die eigene Installation gibt es **keinen Support** – die [Anleitung](https://ormeet.ch/dokumentation.html)
ist die Selbsthilfe. Wer sich um nichts kümmern möchte, nutzt
[Ormeet als Service](https://ormeet.ch/support.html): Betrieb, Sicherungen, Updates und Hilfe inklusive,
gehostet in der Schweiz.

## Technik

Vue 3 (Options API) ohne Build-Schritt, alle Bibliotheken liegen lokal in `lib/`. Backend `api.php` mit einer
JSON-Datei pro Gremium in `data/` (AES-256 verschlüsselt). Läuft per FTP-Upload auf jedem PHP-Hosting (PHP 7.4+ mit `openssl`).

## Lizenz

MIT – siehe [LICENSE](LICENSE). Ein Projekt von [Orki](https://orki.ch).
