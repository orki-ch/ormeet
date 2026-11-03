<?php
// ---------------------------------------------------------------
// Ormeet API – speichert die Daten pro Gremium als JSON-Datei in data/ (verschlüsselt, Schlüssel in schluessel.php)
//
// Zugriff über den Header X-Token:
//   superadmin.anmeldungen[] -> Superadmin (Token nach Anmeldung mit dem Passwort): alle Gremien, anlegen/löschen, Konten verwalten
//   benutzer[].anmeldungen[] -> Konto (E-Mail/Passwort oder SSO): pro Gremium Eigentümer (wie Superadmin, nur dort)
//                               oder Mitglied (wie persönlicher Link); Daten in data/benutzer.json
//   zugaenge[].key           -> Gremium-Zugang mit Rechten pro Bereich (sitzungen / mitglieder / einstellungen: keine|lesen|bearbeiten)
//   mitglieder[].zugangsKey  -> zentraler persönlicher Link eines Mitglieds: Rechte gemäss Traktanden-Zuweisungen;
//                               als Sitzungsleitung / Protokollführung einer Sitzung voller Zugriff auf deren Dokumente;
//                               sitzungen[].freigaben[vorprotokoll|protokoll][personId] = lesen|eigene|alles überschreibt das
//   freigabeLinkKey          -> ganzes Vorprotokoll bearbeiten
//   personenKeys[gastId]     -> Gast: wie persönlicher Link, beschränkt auf dieses Vorprotokoll
//   verfolgerKey             -> Live-Ansicht eines Protokolls (nur lesen)
//   themenbereiche[].freigabeKey -> Übersicht eines Themenbereichs (nur lesen)
// ---------------------------------------------------------------

const ADMIN_PASSWORT = 'bitte-aendern';   // <- unbedingt ändern!
const DATEN_ORDNER = __DIR__ . '/data';
const SCHLUESSEL_DATEI = __DIR__ . '/schluessel.php'; // Schlüssel für die verschlüsselte Ablage; wird beim ersten Aufruf erzeugt
const BENUTZER_DATEI = DATEN_ORDNER . '/benutzer.json';
const SUPERADMIN_DATEI = DATEN_ORDNER . '/superadmin.json'; // Anmeldungen (Tokens) des Superadmins
const VERSUCHE_DATEI = DATEN_ORDNER . '/anmeldeversuche.json'; // Fehlversuche pro Adresse (Schutz gegen Passwort-Raten)
const EINSTELLUNGEN_DATEI = DATEN_ORDNER . '/einstellungen.json';
// SSO-Anbieter (OpenID Connect): Server-URL, Client-ID und Client-Secret werden in den Einstellungen gepflegt (data/einstellungen.json)
const SSO_ANBIETER = [
  'sublevia' => ['name' => 'Sublevia', 'authorize' => '/application/o/authorize/', 'token' => '/application/o/token/', 'userinfo' => '/application/o/userinfo/'],
  // Orki liefert meist keine E-Mail: Orki übernimmt nur die Anmeldung (Konto unter «Mein Konto» verknüpft oder über den
  // persönlichen Link registriert), Name und E-Mail kommen immer aus Ormeet
  'orki' => ['name' => 'Orki', 'authorize' => '/_/call/oidc/authorize', 'token' => '/_/call/oidc/token', 'userinfo' => '/_/call/oidc/userinfo', 'nurVerknuepft' => true],
];
const GITHUB_REPO = 'orki-ch/ormeet'; // Herkunft für automatische Updates (GitHub-Releases)
const VOLLE_RECHTE = ['sitzungen' => 'bearbeiten', 'mitglieder' => 'bearbeiten', 'einstellungen' => 'bearbeiten'];
// Einzelrechte («Individuell») pro Dokument für zusätzliche allgemeine Links und Personen
const EINZELRECHTE = [
  'terminfindung' => ['abstimmen', 'kommentieren'],
  'vorprotokoll' => ['traktandenBearbeiten', 'traktandenAendern', 'traktandenHinzufuegen', 'anwesenheit', 'gaeste'],
  'protokoll' => ['information', 'pendenz', 'antrag'],
];

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Ormeet-Version: ' . lokaleVersion()); // der Client erkennt daran, wenn er nach einem Update noch mit alten Dateien läuft
header('X-Content-Type-Options: nosniff');

if (!is_dir(DATEN_ORDNER)) {
  mkdir(DATEN_ORDNER, 0750, true);
  file_put_contents(DATEN_ORDNER . '/.htaccess', "Require all denied\n");
}

function antwort($daten, $status = 200) {
  http_response_code($status);
  echo json_encode($daten, JSON_UNESCAPED_UNICODE);
  exit;
}

function dateiVon($gremiumId) {
  if (!preg_match('/^[0-9a-f-]{36}$/', $gremiumId)) antwort(['fehler' => 'Ungültige Gremium-ID'], 400);
  return DATEN_ORDNER . "/$gremiumId.json";
}

// --- Verschlüsselte Ablage ---------------------------------------
// Alle Dateien in data/ liegen mit AES-256-GCM verschlüsselt (Kennung + Base64 von IV, Tag, Chiffrat).
// Der Schlüssel liegt getrennt in schluessel.php im Ormeet-Ordner: Wer nur data/ in die Hände bekommt, kann nichts lesen.
const KENNUNG = 'ORMEET1:';

// Schlüssel laden; beim ersten Aufruf erzeugen und den bestehenden Datenbestand verschlüsseln
function schluessel() {
  static $key = null;
  if ($key !== null) return $key;
  if (!function_exists('openssl_encrypt')) antwort(['fehler' => 'Die PHP-Erweiterung openssl fehlt – sie wird für die verschlüsselte Ablage benötigt'], 500);
  $sperre = fopen(DATEN_ORDNER . '/.sperre', 'c'); // nur ein Aufruf darf den Schlüssel anlegen
  flock($sperre, LOCK_EX);
  if (!file_exists(SCHLUESSEL_DATEI)) {
    $hex = bin2hex(random_bytes(32));
    $inhalt = "<?php\n// Ormeet: Schlüssel für die verschlüsselte Datenablage in data/. Ohne diese Datei sind die Daten nicht lesbar –\n"
      . "// zusammen mit data/ sichern, beim Umzug mitnehmen, nie weitergeben.\nreturn '$hex';\n";
    if (file_put_contents(SCHLUESSEL_DATEI, $inhalt, LOCK_EX) === false) {
      antwort(['fehler' => 'Die Schlüsseldatei schluessel.php konnte nicht angelegt werden – der Ormeet-Ordner muss für PHP beschreibbar sein'], 500);
    }
    $key = hex2bin($hex);
    foreach (glob(DATEN_ORDNER . '/*.json') as $datei) dateiLesen($datei); // vorhandene Daten sofort verschlüsseln
  }
  flock($sperre, LOCK_UN);
  fclose($sperre);
  $key = hex2bin(include SCHLUESSEL_DATEI);
  return $key;
}

function verschluesseln($text) {
  $iv = random_bytes(12);
  $chiffrat = openssl_encrypt($text, 'aes-256-gcm', schluessel(), OPENSSL_RAW_DATA, $iv, $tag);
  return KENNUNG . base64_encode($iv . $tag . $chiffrat);
}

function entschluesseln($roh) {
  if (strpos($roh, KENNUNG) !== 0) return $roh; // unverschlüsselt (älterer Datenbestand)
  $bin = base64_decode(substr($roh, strlen(KENNUNG)));
  $text = openssl_decrypt(substr($bin, 28), 'aes-256-gcm', schluessel(), OPENSSL_RAW_DATA, substr($bin, 0, 12), substr($bin, 12, 16));
  if ($text === false) antwort(['fehler' => 'Die Daten lassen sich nicht entschlüsseln – gehört schluessel.php zu diesem Ordner data/?'], 500);
  return $text;
}

// Datei lesen und entschlüsseln; unverschlüsselte Dateien (älterer Datenbestand, eingespielte Sicherung) sofort verschlüsseln
function dateiLesen($datei) {
  if (!file_exists($datei)) return '';
  $roh = file_get_contents($datei);
  if (strpos($roh, KENNUNG) === 0) return entschluesseln($roh);
  $handle = fopen($datei, 'c+');
  flock($handle, LOCK_EX);
  $roh = stream_get_contents($handle);
  if (strpos($roh, KENNUNG) !== 0) {
    ftruncate($handle, 0);
    rewind($handle);
    fwrite($handle, verschluesseln($roh));
  }
  flock($handle, LOCK_UN);
  fclose($handle);
  return entschluesseln($roh);
}

function dateiSchreiben($datei, $text) {
  file_put_contents($datei, verschluesseln($text), LOCK_EX);
}

schluessel();

// Leere personenKeys als Objekt ({}) statt Array ([]) ausgeben
function normalisiere(array $bundle) {
  aufgabenMerken($bundle);
  if (isset($bundle['gremium']['rollen'])) foreach ($bundle['gremium']['rollen'] as &$r) {
    if (array_key_exists('rechte', $r) && empty($r['rechte'])) $r['rechte'] = new stdClass();
  }
  unset($r);
  if (isset($bundle['sitzungen'])) foreach ($bundle['sitzungen'] as &$s) {
    if (array_key_exists('zuschnitt', $s) && empty($s['zuschnitt'])) $s['zuschnitt'] = new stdClass();
  }
  unset($s);
  foreach ($bundle['vorprotokolle'] as &$vp) {
    if (empty($vp['personenKeys'])) $vp['personenKeys'] = new stdClass();
    if (array_key_exists('aliasKeys', $vp) && empty($vp['aliasKeys'])) $vp['aliasKeys'] = new stdClass();
  }
  return $bundle;
}

function lesen($datei) {
  $bundle = json_decode(dateiLesen($datei), true);
  if ($bundle) kontoAngabenUebernehmen($bundle);
  return $bundle ? normalisiere($bundle) : null;
}

// Mit einem Konto verknüpfte Mitglieder und Gäste: Name und E-Mail kommen immer vom Konto (auch nach einer Änderung im Konto).
// Gäste im Protokoll zählen nur mit dem Konto ihres Eintrags im Vorprotokoll (dort setzt es nur der Server, gastFelderBewahren).
function kontoAngabenUebernehmen(array &$daten, array $gastKonten = []) {
  static $konten = null;
  $konten ??= array_column(benutzerLesen(), null, 'id');
  $setzen = function (array &$p, $benutzerId) use ($konten) {
    $k = $konten[$benutzerId ?? ''] ?? null;
    if (!$k) return;
    if (($k['name'] ?? '') !== '') $p['name'] = $k['name'];
    if (($k['email'] ?? '') !== '') $p['email'] = $k['email'];
  };
  // foreach mit Referenz braucht die Liste selbst (bei «?? []» würde eine Kopie geändert)
  if (isset($daten['gremium']['mitglieder'])) foreach ($daten['gremium']['mitglieder'] as &$m) $setzen($m, $m['benutzerId'] ?? null);
  unset($m);
  if (isset($daten['vorprotokolle'])) foreach ($daten['vorprotokolle'] as &$vp) {
    if (isset($vp['gaeste'])) foreach ($vp['gaeste'] as &$g) {
      if (!empty($g['benutzerId'])) $gastKonten[$g['id']] = $g['benutzerId'];
      $setzen($g, $g['benutzerId'] ?? null);
    }
    unset($g);
  }
  unset($vp);
  if (isset($daten['protokolle'])) foreach ($daten['protokolle'] as &$pr) {
    if (isset($pr['gaeste'])) foreach ($pr['gaeste'] as &$g) $setzen($g, $gastKonten[$g['id'] ?? ''] ?? null);
    unset($g);
  }
  unset($pr);
}

function alleBundles() {
  $bundles = [];
  foreach (glob(DATEN_ORDNER . '/*.json') as $datei) {
    if (!preg_match('/[0-9a-f-]{36}\.json$/', $datei)) continue; // benutzer.json, einstellungen.json
    $bundle = lesen($datei);
    if ($bundle) $bundles[] = $bundle;
  }
  return $bundles;
}

// --- Konten, Einstellungen -----------------------------------------
function jsonLesen($datei, array $standard) {
  $daten = file_exists($datei) ? json_decode(dateiLesen($datei), true) : null;
  return is_array($daten) ? $daten + $standard : $standard;
}

function jsonSchreiben($datei, array $daten) {
  dateiSchreiben($datei, json_encode($daten, JSON_UNESCAPED_UNICODE));
}

function benutzerLesen() {
  return jsonLesen(BENUTZER_DATEI, ['benutzer' => []])['benutzer'];
}

function benutzerSchreiben(array $benutzer) {
  jsonSchreiben(BENUTZER_DATEI, ['benutzer' => array_values($benutzer)]);
}

function benutzerById(array $benutzer, $id) {
  foreach ($benutzer as $i => $b) if ($b['id'] === $id) return $i;
  return null;
}

function benutzerByEmail(array $benutzer, $email) {
  foreach ($benutzer as $i => $b) if (strcasecmp($b['email'], $email) === 0) return $i;
  return null;
}

function neuerBenutzer($name, $email) {
  return ['id' => uuid(), 'name' => $name, 'email' => $email, 'passwortHash' => '', 'sso' => [], 'darfGremienAnlegen' => false, 'darfKurzsitzungenAnlegen' => false,
          'erstelltAm' => date('c'), 'letzteAnmeldung' => '', 'anmeldungen' => []];
}

function uuid() {
  $b = random_bytes(16);
  $b[6] = chr((ord($b[6]) & 0x0f) | 0x40);
  $b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
  return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4));
}

// Neue Anmeldung (Token) für ein Konto; liefert den Token
function anmeldungAnlegen(array &$b) {
  $token = bin2hex(random_bytes(24));
  $b['anmeldungen'][] = ['token' => $token, 'seit' => date('c')];
  $b['anmeldungen'] = array_slice($b['anmeldungen'], -10); // höchstens 10 Geräte
  $b['letzteAnmeldung'] = date('c');
  return $token;
}

// Superadmin: Anmeldungen (Tokens) statt Passwort im Browser – Abmelden macht den Token serverseitig ungültig
function superadminLesen() {
  return jsonLesen(SUPERADMIN_DATEI, ['anmeldungen' => []]);
}

// Ist der Superadmin mit einem Konto verknüpft (Benutzer > Konten), bekommt er dessen persönliche Übersicht (konto)
function superadminZugriff($token) {
  $superadmin = superadminLesen();
  foreach ($superadmin['anmeldungen'] as $a) {
    if (!hash_equals($a['token'], $token)) continue;
    $benutzer = benutzerLesen();
    $i = benutzerById($benutzer, $superadmin['benutzerId'] ?? '');
    if ($i === null) return ['rolle' => 'admin'];
    $b = $benutzer[$i];
    return ['rolle' => 'admin', 'konto' => benutzerOeffentlich($b) + ['benutzerId' => $b['id'], 'gremien' => benutzerGremien($b['id'], $b['email'])]];
  }
  return null;
}

// Passwort-Raten bremsen: höchstens 10 Fehlversuche pro Adresse in 15 Minuten
function anmeldeSperrePruefen() {
  $versuche = jsonLesen(VERSUCHE_DATEI, [])[$_SERVER['REMOTE_ADDR'] ?? ''] ?? [];
  if (count(array_filter($versuche, fn($t) => $t > time() - 900)) >= 10) antwort(['fehler' => 'Zu viele Fehlversuche – bitte in 15 Minuten erneut versuchen'], 429);
}

function fehlversuch($text) {
  versuchMerken();
  usleep(300000);
  antwort(['fehler' => $text], 401);
}

// Versuch zählen (Fehlanmeldung, angeforderter Link zum Zurücksetzen)
function versuchMerken() {
  $alle = [];
  foreach (jsonLesen(VERSUCHE_DATEI, []) as $adresse => $zeiten) {
    $zeiten = array_values(array_filter($zeiten, fn($t) => $t > time() - 900));
    if ($zeiten) $alle[$adresse] = $zeiten;
  }
  $alle[$_SERVER['REMOTE_ADDR'] ?? ''][] = time();
  jsonSchreiben(VERSUCHE_DATEI, $alle);
}

// Konto ohne Geheimnisse (für Superadmin und Kontoinhaber)
function benutzerOeffentlich(array $b) {
  return ['id' => $b['id'], 'name' => $b['name'], 'email' => $b['email'], 'darfGremienAnlegen' => $b['darfGremienAnlegen'],
          'darfKurzsitzungenAnlegen' => !empty($b['darfKurzsitzungenAnlegen']), 'hatPasswort' => $b['passwortHash'] !== '',
          'sso' => array_keys($b['sso']), 'erstelltAm' => $b['erstelltAm'], 'letzteAnmeldung' => $b['letzteAnmeldung'], 'geraete' => count($b['anmeldungen']), 'mailsAus' => !empty($b['mailsAus'])];
}

function einstellungenLesen() {
  return jsonLesen(EINSTELLUNGEN_DATEI, ['sso' => [], 'mail' => []]);
}

// --- E-Mail (Passwort vergessen) ------------------------------------
// Über den in den Einstellungen hinterlegten SMTP-Server, sonst über die Mailfunktion von PHP (mail()).
const MAIL_STANDARD = ['absender' => '', 'absenderName' => 'Ormeet', 'host' => '', 'port' => 587, 'sicherheit' => 'tls', 'benutzer' => '', 'passwort' => ''];

function mailEinstellungen() {
  return (einstellungenLesen()['mail'] ?? []) + MAIL_STANDARD;
}

function mailKopf($text) {
  return '=?UTF-8?B?' . base64_encode($text) . '?=';
}

// Nachricht senden; liefert null oder eine Fehlermeldung. anhang: ['name', 'typ', 'inhalt'] (z. B. Kalendereintrag)
function mailSenden($an, $betreff, $text, $anhang = null) {
  $m = mailEinstellungen();
  $von = $m['absender'] !== '' ? $m['absender'] : 'ormeet@' . preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST'] ?? 'localhost');
  $text = str_replace(["\r\n", "\n"], ["\n", "\r\n"], $text);
  $art = ['Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: 8bit'];
  if ($anhang) {
    $grenze = 'ormeet-' . bin2hex(random_bytes(8));
    $text = "--$grenze\r\n" . implode("\r\n", $art) . "\r\n\r\n$text\r\n"
      . "--$grenze\r\nContent-Type: {$anhang['typ']}; charset=UTF-8; name=\"{$anhang['name']}\"\r\nContent-Transfer-Encoding: base64\r\n"
      . "Content-Disposition: attachment; filename=\"{$anhang['name']}\"\r\n\r\n" . chunk_split(base64_encode($anhang['inhalt'])) . "--$grenze--\r\n";
    $art = ["Content-Type: multipart/mixed; boundary=\"$grenze\""];
  }
  $kopf = array_merge(['From: ' . mailKopf($m['absenderName'] ?: 'Ormeet') . " <$von>", 'MIME-Version: 1.0'], $art,
           ['Date: ' . date('r'), 'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . substr(strrchr($von, '@'), 1) . '>']);
  if ($m['host'] === '') {
    return @mail($an, mailKopf($betreff), $text, implode("\r\n", $kopf), '-f' . $von) ? null : 'Die Mailfunktion des Servers hat die Nachricht nicht angenommen';
  }
  $nachricht = implode("\r\n", array_merge(["To: <$an>", 'Subject: ' . mailKopf($betreff)], $kopf)) . "\r\n\r\n" . $text;
  return smtpSenden($m, $von, $an, $nachricht);
}

// Schlanker SMTP-Versand: STARTTLS (tls) oder SSL von Beginn an (ssl), Anmeldung mit AUTH LOGIN
function smtpSenden(array $m, $von, $an, $nachricht) {
  $adresse = ($m['sicherheit'] === 'ssl' ? 'ssl://' : 'tcp://') . $m['host'] . ':' . ((int) $m['port'] ?: 587);
  $s = @stream_socket_client($adresse, $nummer, $meldung, 15);
  if (!$s) return "Keine Verbindung zum SMTP-Server ($meldung)";
  stream_set_timeout($s, 15);
  $befehl = function ($zeile, array $codes) use ($s) {
    if ($zeile !== null) fwrite($s, $zeile . "\r\n");
    $antwort = '';
    while (($teil = fgets($s, 1024)) !== false) {
      $antwort .= $teil;
      if (strlen($teil) < 4 || $teil[3] === ' ') break;
    }
    if (!in_array((int) substr($antwort, 0, 3), $codes, true)) throw new RuntimeException('SMTP: ' . trim($antwort ?: 'keine Antwort'));
  };
  try {
    $befehl(null, [220]);
    $name = gethostname() ?: 'localhost';
    $befehl("EHLO $name", [250]);
    if ($m['sicherheit'] === 'tls') {
      $befehl('STARTTLS', [220]);
      if (!stream_socket_enable_crypto($s, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) throw new RuntimeException('SMTP: TLS konnte nicht aufgebaut werden');
      $befehl("EHLO $name", [250]);
    }
    if ($m['benutzer'] !== '') {
      $befehl('AUTH LOGIN', [334]);
      $befehl(base64_encode($m['benutzer']), [334]);
      $befehl(base64_encode($m['passwort']), [235]);
    }
    $befehl("MAIL FROM:<$von>", [250]);
    $befehl("RCPT TO:<$an>", [250, 251]);
    $befehl('DATA', [354]);
    $befehl(preg_replace('/^\./m', '..', $nachricht) . "\r\n.", [250]);
    fwrite($s, "QUIT\r\n");
  } catch (RuntimeException $e) {
    fclose($s);
    return $e->getMessage();
  }
  fclose($s);
  return null;
}

// Aktive SSO-Anbieter (URL und Client-ID gesetzt)
function ssoAktiv() {
  $aktiv = [];
  foreach (SSO_ANBIETER as $id => $anbieter) {
    $konfig = einstellungenLesen()['sso'][$id] ?? [];
    if (!empty($konfig['url']) && !empty($konfig['clientId'])) $aktiv[$id] = $anbieter + $konfig;
  }
  return $aktiv;
}

// Gremien eines Kontos: eigene (Eigentümer) und solche, in denen ein Mitglied mit dem Konto verknüpft ist.
// Kurzsitzungen ohne Gremium: Eingeladene mit derselben E-Mail wie das Konto gelten als verknüpft.
function benutzerGremien($benutzerId, $email = '') {
  $liste = [];
  foreach (alleBundles() as $bundle) {
    $g = $bundle['gremium'];
    if (($g['eigentuemerId'] ?? null) === $benutzerId) {
      $liste[] = ['gremiumId' => $g['id'], 'name' => $g['name'], 'rolle' => 'eigentuemer', 'kurz' => !empty($g['kurz'])];
      continue;
    }
    $mitglied = false;
    foreach ($g['mitglieder'] as $m) {
      $perEmail = !empty($g['kurz']) && $email !== '' && strcasecmp(trim($m['email'] ?? ''), $email) === 0;
      if ((($m['benutzerId'] ?? null) === $benutzerId || $perEmail) && empty($m['gesperrt'])) { // gesperrt: weder Link noch Konto
        // zugangsKey: persönlicher Link des Mitglieds – dient dem Konto als Kalender-Abo (statt des Konto-Tokens)
        $liste[] = ['gremiumId' => $g['id'], 'name' => $g['name'], 'rolle' => 'mitglied', 'personId' => $m['id'], 'personName' => $m['name'], 'zugangsKey' => $m['zugangsKey'] ?? '', 'kurz' => !empty($g['kurz'])];
        $mitglied = true;
        break;
      }
    }
    // «Weitere Person»: über einen allgemeinen Link mit Konto dazugekommen – Gast genau einer Sitzung (die neuste zählt)
    if ($mitglied) continue;
    foreach (array_reverse($bundle['vorprotokolle']) as $vp) {
      foreach ($vp['gaeste'] as $gast) {
        if (($gast['benutzerId'] ?? null) !== $benutzerId) continue;
        $sitzung = sitzungVon($bundle, $vp['sitzungId']);
        if ($sitzung && fuerSitzungGesperrt($sitzung, $gast['id'])) continue;
        $liste[] = ['gremiumId' => $g['id'], 'name' => $g['name'], 'rolle' => 'gast', 'personId' => $gast['id'], 'personName' => $gast['name'],
                    'vorprotokollId' => $vp['id'], 'sitzungId' => $vp['sitzungId'], 'kurz' => !empty($g['kurz'])];
        continue 3;
      }
    }
  }
  return $liste;
}

// Konto -> Zugriff wie Superadmin (Eigentümer) bzw. persönlicher Link (Mitglied) für ein bestimmtes Gremium
function effektiverZugriff(array $zugriff, $gremiumId) {
  if ($zugriff['rolle'] !== 'benutzer') return $zugriff;
  foreach ($zugriff['gremien'] as $g) {
    if ($g['gremiumId'] !== $gremiumId) continue;
    if ($g['rolle'] === 'eigentuemer') return ['rolle' => 'admin', 'gremiumId' => $gremiumId, 'benutzerId' => $zugriff['benutzerId'], 'eigentuemer' => true];
    if ($g['rolle'] === 'gast') return ['rolle' => 'freigabe', 'gremiumId' => $gremiumId, 'vorprotokollId' => $g['vorprotokollId'], 'personId' => $g['personId'], 'personName' => $g['personName'], 'benutzerId' => $zugriff['benutzerId']];
    return ['rolle' => 'person', 'gremiumId' => $gremiumId, 'personId' => $g['personId'], 'personName' => $g['personName'], 'benutzerId' => $zugriff['benutzerId'], 'konto' => true];
  }
  return ['rolle' => 'keine', 'gremiumId' => $gremiumId];
}

// Konten, die ein Eigentümer mit Mitgliedern verknüpfen darf: er selbst und alle Konten aus seinen eigenen Gremien
// (Mitglieder und Gäste) – nur Name und E-Mail, keine Liste aller Ormeet-Konten
function eigentuemerKonten($konto) {
  if (!$konto) return [];
  $ids = [];
  foreach ($konto['gremien'] as $g) {
    if ($g['rolle'] !== 'eigentuemer' || !($b = lesen(dateiVon($g['gremiumId'])))) continue;
    $ids[$konto['benutzerId']] = true;
    foreach ($b['gremium']['mitglieder'] as $m) if (!empty($m['benutzerId'])) $ids[$m['benutzerId']] = true;
    foreach ($b['vorprotokolle'] as $vp) foreach ($vp['gaeste'] as $gast) if (!empty($gast['benutzerId'])) $ids[$gast['benutzerId']] = true;
  }
  $liste = [];
  foreach (benutzerLesen() as $b) if (isset($ids[$b['id']])) $liste[] = ['id' => $b['id'], 'name' => $b['name'], 'email' => $b['email']];
  return $liste;
}

// Mitglied eines Gremiums mit einem Konto verknüpfen (Datei mit Sperre bearbeiten)
// Mitglied mit einem Konto verknüpfen ($benutzerId null: lösen). Ein Konto gehört pro Gremium zu einem Mitglied, ein Mitglied
// zu einem Konto: Ist eines davon schon anders vergeben, bleibt alles, wie es ist (false) – nichts wird stillschweigend
// verschoben, sonst übernähme das Konto Name und E-Mail eines fremden Eintrags.
function mitgliedVerknuepfen($gremiumId, $personId, $benutzerId) {
  $ok = true;
  $datei = dateiVon($gremiumId);
  $handle = fopen($datei, 'c+');
  flock($handle, LOCK_EX);
  $bundle = json_decode(entschluesseln(stream_get_contents($handle)), true);
  if ($bundle) {
    foreach ($bundle['gremium']['mitglieder'] as $m) {
      if ($benutzerId === null) continue;
      $eigenes = $m['id'] === $personId;
      if (!$eigenes && ($m['benutzerId'] ?? null) === $benutzerId) $ok = false; // Konto gehört schon zu einem anderen Mitglied
      if ($eigenes && !empty($m['benutzerId']) && $m['benutzerId'] !== $benutzerId) $ok = false; // Mitglied hat schon ein anderes Konto
    }
    if ($ok) {
      foreach ($bundle['gremium']['mitglieder'] as &$m) if ($m['id'] === $personId) $m['benutzerId'] = $benutzerId;
      unset($m);
      ftruncate($handle, 0);
      rewind($handle);
      fwrite($handle, verschluesseln(json_encode($bundle, JSON_UNESCAPED_UNICODE)));
    }
  }
  flock($handle, LOCK_UN);
  fclose($handle);
  return $ok;
}

function istHttps() {
  return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
}

function basisUrl() {
  return (istHttps() ? 'https' : 'http') . '://' . $_SERVER['HTTP_HOST'] . rtrim(dirname($_SERVER['SCRIPT_NAME']), '/\\') . '/';
}

function indexById(array $liste) {
  $index = [];
  foreach ($liste as $eintrag) $index[$eintrag['id']] = $eintrag;
  return $index;
}

// --- Gleichzeitiges Bearbeiten: Drei-Wege-Zusammenführung ----------------
// basis: Stand, auf dem die Änderung beruht; meins: gesendeter Stand; ihres: aktueller Stand auf dem Server.
// Übernommen wird nur, was sich gegenüber der Basis geändert hat – pro Feld, pro Listeneintrag (mit id) und bei
// einfachen Listen (z. B. Anwesende) pro Wert. Haben beide dasselbe verschieden geändert, gilt die neuere Änderung
// (meins); der Pfad landet in $konflikte (für den Hinweis an die Person, die gespeichert hat).
const FEHLT = "\0fehlt";

if (!function_exists('array_is_list')) { // erst ab PHP 8.1
  function array_is_list(array $liste) {
    return $liste === [] || array_keys($liste) === range(0, count($liste) - 1);
  }
}

function zfAssoc($wert) {
  return is_array($wert) && $wert !== [] && !array_is_list($wert);
}

function zfIdListe($wert) {
  return is_array($wert) && $wert !== [] && array_is_list($wert) && is_array($wert[0]) && isset($wert[0]['id']);
}

function zfIds(array $liste) {
  return array_map(fn($e) => $e['id'], $liste);
}

function zusammenfuehren($basis, $meins, $ihres, array $pfad, array &$konflikte) {
  if ($meins === $ihres) return $meins;
  if ($meins === $basis) return $ihres;
  if ($ihres === $basis) return $meins;
  if ($meins === FEHLT || $ihres === FEHLT) { // eine Seite hat gelöscht, die andere geändert: meine (neuere) Änderung gilt
    $konflikte[] = $pfad;
    return $meins;
  }
  $alle = [$basis, $meins, $ihres];
  if (array_filter($alle, 'zfAssoc') && !array_filter($alle, fn($w) => $w !== FEHLT && $w !== null && !is_array($w))) {
    $b = is_array($basis) ? $basis : [];
    $m = is_array($meins) ? $meins : [];
    $t = is_array($ihres) ? $ihres : [];
    $ergebnis = [];
    foreach (array_unique(array_merge(array_keys($m), array_keys($t), array_keys($b))) as $feld) {
      $wert = zusammenfuehren(array_key_exists($feld, $b) ? $b[$feld] : FEHLT, array_key_exists($feld, $m) ? $m[$feld] : FEHLT,
        array_key_exists($feld, $t) ? $t[$feld] : FEHLT, array_merge($pfad, [$feld]), $konflikte);
      if ($wert !== FEHLT) $ergebnis[$feld] = $wert;
    }
    return $ergebnis;
  }
  if (array_filter($alle, 'zfIdListe') && !array_filter($alle, fn($w) => $w !== FEHLT && $w !== null && !(is_array($w) && ($w === [] || zfIdListe($w))))) {
    $b = is_array($basis) ? indexById($basis) : [];
    $m = is_array($meins) ? indexById($meins) : [];
    $t = is_array($ihres) ? indexById($ihres) : [];
    // Reihenfolge: hat nur die andere Seite umsortiert, gilt ihre, sonst meine; Neues der anderen Seite nach seinem Vorgänger
    $gemeinsam = fn($ids) => array_values(array_filter($ids, fn($id) => isset($m[$id]) && isset($b[$id])));
    $reihe = $gemeinsam(array_keys($m)) === $gemeinsam(array_keys($b)) ? array_keys($t) : array_keys($m);
    $andere = $reihe === array_keys($t) ? array_keys($m) : array_keys($t);
    $vorher = null;
    foreach ($andere as $id) {
      if (!in_array($id, $reihe, true)) {
        $stelle = $vorher === null ? false : array_search($vorher, $reihe, true);
        $pos = $vorher === null ? 0 : ($stelle === false ? count($reihe) : $stelle + 1);
        array_splice($reihe, $pos, 0, [$id]);
      }
      $vorher = $id;
    }
    $ergebnis = [];
    foreach ($reihe as $id) {
      $eintrag = $m[$id] ?? $t[$id];
      $wert = zusammenfuehren($b[$id] ?? FEHLT, $m[$id] ?? FEHLT, $t[$id] ?? FEHLT,
        array_merge($pfad, ['«' . ($eintrag['titel'] ?? $eintrag['name'] ?? $eintrag['text'] ?? 'Eintrag') . '»']), $konflikte);
      if ($wert !== FEHLT) $ergebnis[] = $wert;
    }
    return $ergebnis;
  }
  if (!array_filter($alle, fn($w) => is_array($w) && $w !== [] && !array_is_list($w)) && !array_filter($alle, fn($w) => $w !== FEHLT && $w !== null && !is_array($w))) {
    // Liste einfacher Werte (Anwesende, IDs): Hinzufügen und Entfernen beider Seiten
    $b = is_array($basis) ? $basis : [];
    $m = is_array($meins) ? $meins : [];
    $t = is_array($ihres) ? $ihres : [];
    $ergebnis = array_values(array_filter($t, fn($w) => in_array($w, $m, true) || !in_array($w, $b, true)));
    foreach ($m as $w) if (!in_array($w, $b, true) && !in_array($w, $ergebnis, true)) $ergebnis[] = $w;
    return $ergebnis;
  }
  $konflikte[] = $pfad; // beide haben denselben Wert verschieden geändert: meine (neuere) Änderung gilt
  return $meins;
}

// Gesendete Datensätze mit ihrer Basis (aenderungen.basis) und dem Serverstand zusammenführen; liefert Hinweise
function gleichzeitigeAenderungen(array $bundle, array &$aenderungen) {
  $basis = $aenderungen['basis'] ?? [];
  unset($aenderungen['basis']);
  $hinweise = [];
  $titel = fn($sitzungId) => ($s = sitzungVon($bundle, $sitzungId)) ? ($s['titel'] ?: 'Sitzung') . ($s['datum'] ? ' vom ' . datumText($s['datum']) : '') : 'Sitzung';
  $felder = ['titel' => 'Titel', 'inhalt' => 'Text', 'notiz' => 'Notiz', 'beschreibung' => 'Beschreibung', 'datum' => 'Datum', 'zeit' => 'Zeit',
             'ort' => 'Ort', 'name' => 'Name', 'status' => 'Status', 'anwesende' => 'Anwesenheit', 'anwesendeMitgliederIds' => 'Anwesenheit'];
  $melden = function (array $konflikte, $ort) use (&$hinweise, $felder) {
    foreach ($konflikte as $pfad) {
      // Nur benannte Einträge («…») und das betroffene Feld zeigen
      $teile = array_values(array_filter($pfad, fn($teil, $i) => strpos((string) $teil, '«') === 0 || ($i === count($pfad) - 1 && isset($felder[$teil])), ARRAY_FILTER_USE_BOTH));
      $teile = array_map(fn($teil) => $felder[$teil] ?? $teil, $teile);
      $hinweise[] = $ort . ($teile ? ': ' . implode(' › ', $teile) : '');
    }
  };
  foreach (['sitzungen' => 'Sitzung', 'vorprotokolle' => 'Vorprotokoll', 'protokolle' => 'Protokoll'] as $typ => $art) {
    $server = indexById($bundle[$typ] ?? []);
    foreach ($aenderungen[$typ] ?? [] as $k => $neu) {
      $alt = $server[$neu['id'] ?? ''] ?? null;
      $b = $basis[$typ][$neu['id'] ?? ''] ?? null;
      if (!$alt || !is_array($b) || $alt === $neu) continue;
      $konflikte = [];
      $aenderungen[$typ][$k] = zusammenfuehren($b, $neu, $alt, [], $konflikte);
      if ($aenderungen[$typ][$k] != $neu) $GLOBALS['zusammengefuehrt'] = true;
      $melden($konflikte, $art . ' «' . $titel($typ === 'sitzungen' ? $neu['id'] : ($neu['sitzungId'] ?? '')) . '»');
    }
  }
  if (isset($aenderungen['gremium'], $basis['gremium']) && is_array($basis['gremium']) && $bundle['gremium']) {
    $konflikte = [];
    $gesendet = $aenderungen['gremium'];
    $aenderungen['gremium'] = zusammenfuehren($basis['gremium'], $gesendet, $bundle['gremium'], [], $konflikte);
    if ($aenderungen['gremium'] != $gesendet) $GLOBALS['zusammengefuehrt'] = true;
    $melden($konflikte, 'Gremium «' . $bundle['gremium']['name'] . '»');
  }
  return array_values(array_unique($hinweise));
}

// Änderungen (ganze Datensätze + gelöschte IDs) in ein Bundle einarbeiten
// Genehmigte Protokolle sind eingefroren: Sitzung, Vorprotokoll und Protokoll bleiben, wie sie sind, und lassen sich
// nicht löschen – ausser Status / Person / Frist der Pendenzen (werden von späteren Sitzungen nachgeführt).
// Die Sperre gilt, solange die genehmigende Sitzung existiert; wird sie (in dieser Anfrage) gelöscht, ist alles wieder frei.
function genehmigungSchuetzen(array $bundle, array $aenderungen) {
  $geloeschteSitzungen = array_flip($aenderungen['geloescht']['sitzungen'] ?? []);
  $gesperrt = []; // sitzungId => alte Sitzung
  foreach ($bundle['sitzungen'] as $s) {
    $in = $s['genehmigt']['sitzungId'] ?? null;
    if (!$in || isset($geloeschteSitzungen[$in])) continue;
    foreach ($bundle['sitzungen'] as $g) if ($g['id'] === $in) $gesperrt[$s['id']] = $s;
  }
  if (!$gesperrt) return $aenderungen;

  $aenderungen['geloescht']['sitzungen'] = array_values(array_filter($aenderungen['geloescht']['sitzungen'] ?? [], fn($id) => !isset($gesperrt[$id])));
  $liste = [];
  foreach ($aenderungen['sitzungen'] ?? [] as $neu) $liste[] = $gesperrt[$neu['id']] ?? $neu;
  $aenderungen['sitzungen'] = $liste;

  foreach (['vorprotokolle', 'protokolle'] as $typ) {
    $alt = indexById($bundle[$typ]);
    $gesperrteIds = [];
    foreach ($alt as $id => $dokument) if (isset($gesperrt[$dokument['sitzungId']])) $gesperrteIds[$id] = true;
    $aenderungen['geloescht'][$typ] = array_values(array_filter($aenderungen['geloescht'][$typ] ?? [], fn($id) => !isset($gesperrteIds[$id])));
    $liste = [];
    foreach ($aenderungen[$typ] ?? [] as $neu) {
      if (!isset($gesperrteIds[$neu['id']])) { $liste[] = $neu; continue; }
      $liste[] = $typ === 'protokolle' ? pendenzenNachfuehren($alt[$neu['id']], $neu) : $alt[$neu['id']];
    }
    $aenderungen[$typ] = $liste;
  }
  return $aenderungen;
}

// Eingefrorenes Protokoll: nur Status, Person und Frist bestehender Pendenzen übernehmen
function pendenzenNachfuehren(array $alt, array $neu) {
  $neuById = indexById($neu['eintraege'] ?? []);
  foreach ($alt['eintraege'] as &$e) {
    if ($e['typ'] !== 'pendenz' || !isset($neuById[$e['id']])) continue;
    foreach (['pendenzStatus', 'zugewiesenAn', 'zugewiesenAnName', 'faelligBis'] as $feld) {
      if (array_key_exists($feld, $neuById[$e['id']])) $e[$feld] = $neuById[$e['id']][$feld];
    }
  }
  unset($e);
  return $alt;
}

function einarbeiten(array $bundle, array $aenderungen) {
  if (isset($aenderungen['gremium'])) $bundle['gremium'] = $aenderungen['gremium'];
  foreach (['sitzungen', 'vorprotokolle', 'protokolle'] as $typ) {
    $geloescht = array_flip($aenderungen['geloescht'][$typ] ?? []);
    $liste = [];
    foreach ($bundle[$typ] ?? [] as $eintrag) {
      if (!isset($geloescht[$eintrag['id']])) $liste[$eintrag['id']] = $eintrag;
    }
    foreach ($aenderungen[$typ] ?? [] as $eintrag) $liste[$eintrag['id']] = $eintrag;
    $bundle[$typ] = array_values($liste);
  }
  return normalisiere($bundle);
}

// Mitglied oder Gast zu einer ID
function personDaten(array $bundle, $personId) {
  foreach ($bundle['gremium']['mitglieder'] as $m) if ($m['id'] === $personId) return $m;
  foreach ($bundle['vorprotokolle'] as $vp) foreach ($vp['gaeste'] as $g) if (($g['id'] ?? '') === $personId) return $g;
  return ['id' => $personId, 'name' => ''];
}

// Darf die Person diesen Eintrag (Traktandum / Unterpunkt) bearbeiten?
// Verantwortlich, oder als Bearbeiter eingetragen: direkt, über die Rolle (rolle:<id>) oder eine Gruppe (gruppe:...)
function istBerechtigt(array $eintrag, array $person) {
  foreach ($eintrag['verantwortliche'] ?? [] as $p) if (($p['id'] ?? null) === $person['id']) return true;
  $stimmrecht = $person['hatStimmrecht'] ?? null;
  foreach ($eintrag['bearbeiter'] ?? [] as $p) {
    $id = $p['id'] ?? null;
    if ($id === $person['id'] || $id === 'gruppe:alle') return true;
    if ($id === 'rolle:' . ($person['rolleId'] ?? '')) return true;
    if ($id === 'gruppe:stimmberechtigt' && $stimmrecht === true) return true;
    if ($id === 'gruppe:ohne_stimmrecht' && $stimmrecht === false) return true;
  }
  return false;
}

// Aufgaben Sitzungsleitung / Protokollführung: in der Sitzung eingetragen (auch als Vertretung) oder im Gremium zentral
// hinterlegt (gremium.aufgaben, gilt für alle Sitzungen des Gremiums) – voller Zugriff auf Vorprotokoll und Protokoll,
// Start, Abschluss und Entscheide bis zur Genehmigung
function istLeitung(array $sitzung, $personId) {
  if (!$personId) return false;
  foreach (array_merge($sitzung['sitzungsleitung'] ?? [], $sitzung['protokollfuehrung'] ?? []) as $p) {
    if (($p['id'] ?? null) === $personId) return true;
  }
  return in_array($personId, $GLOBALS['ormeetAufgaben'][$sitzung['gremiumId'] ?? ''] ?? [], true);
}

// Zentral hinterlegte Aufgaben eines Gremiums merken (für istLeitung)
function aufgabenMerken(array $bundle) {
  if (empty($bundle['gremium']['id'])) return;
  $a = $bundle['gremium']['aufgaben'] ?? [];
  $GLOBALS['ormeetAufgaben'][$bundle['gremium']['id']] = array_values(array_merge($a['sitzungsleitung'] ?? [], $a['protokollfuehrung'] ?? []));
}

// Freigabestufe einer Person für ein Dokument (vorprotokoll / protokoll): in der Sitzung gesetzte Freigabe,
// sonst Standard – Leitung «alles», alle anderen «eigene» (zugewiesene Traktanden). «lesen» sperrt alles.
// Über einen allgemeinen Link eingetragene Personen erhalten ohne gesetzte Freigabe die Rechte ihres Links (linkGastFreigabe).
// Ohne gesetzte Freigabe: die Standardstufe der Rolle (Leitung der Sitzung: alles)
function freigabeRoh(array $sitzung, string $dokument, $personId) {
  if ($personId && in_array($personId, $sitzung['nurLesen'] ?? [], true)) return 'lesen'; // für diese Sitzung auf «nur lesen» gesperrt
  $stufe = $sitzung['freigaben'][$dokument][$personId] ?? null;
  $info = $GLOBALS['linkGaeste'][$personId] ?? null;
  if ($stufe === null && $info) return linkGastFreigabe($info, $dokument);
  if ($stufe === null && in_array($dokument, ['vorprotokoll', 'protokoll'], true) && !istLeitung($sitzung, $personId) && isset($GLOBALS['ormeetGremium'])) {
    $standard = rolleRechte($GLOBALS['ormeetGremium'], $personId)[$dokument];
    if ($standard !== 'eigene') return $standard;
  }
  return $stufe;
}

function freigabeStufe(array $sitzung, string $dokument, $personId) {
  if (!empty($sitzung['kurz'])) $dokument = 'protokoll'; // Kurzsitzung: nur ein Dokument, Traktanden liegen im versteckten Vorprotokoll
  $stufe = freigabeRoh($sitzung, $dokument, $personId);
  if (is_array($stufe)) return 'individuell'; // Liste von Einzelrechten (siehe einzelrechte)
  if (in_array($stufe, ['lesen', 'eigene', 'alles'], true)) return $stufe;
  return istLeitung($sitzung, $personId) ? 'alles' : 'eigene';
}

// Einzelrechte («Individuell») einer Person auf ein Dokument
function einzelrechte(array $sitzung, string $dokument, $personId) {
  if (!empty($sitzung['kurz'])) $dokument = 'protokoll';
  $rechte = freigabeRoh($sitzung, $dokument, $personId) ?? [];
  return is_array($rechte) ? $rechte : [];
}

// Einzelrechte aufs Vorprotokoll: Traktanden bearbeiten (inkl. Unterpunkte, Reihenfolge, Löschen) und / oder neue
// hinzufügen – selbst hinzugefügte (hinzugefuegtVon) bleiben bearbeitbar –, Anwesenheit und Gäste
function vorprotokollEinzelrechte(array $alt, array $neu, array $rechte, $kennung) {
  $bearbeiten = in_array('traktandenBearbeiten', $rechte, true);
  $aendern = in_array('traktandenAendern', $rechte, true);
  $hinzufuegen = in_array('traktandenHinzufuegen', $rechte, true);
  $altIds = array_flip(array_column($alt['traktanden'], 'id'));
  $neuById = indexById($neu['traktanden'] ?? []);
  $liste = [];
  if ($aendern && !$bearbeiten) {
    // Ändern und verschieben (Unterpunkte frei): Haupttraktanden weder löschen noch – ohne Recht – hinzufügen
    $gesehen = [];
    foreach ($neu['traktanden'] ?? [] as $t) {
      if (isset($altIds[$t['id']])) { $liste[] = $t; $gesehen[$t['id']] = true; }
      elseif ($hinzufuegen) $liste[] = ['hinzugefuegtVon' => $kennung] + $t;
    }
    foreach ($alt['traktanden'] as $t) if (!isset($gesehen[$t['id']])) $liste[] = $t;
  } elseif ($bearbeiten) {
    foreach ($neu['traktanden'] ?? [] as $t) {
      if (isset($altIds[$t['id']])) $liste[] = $t;
      elseif ($hinzufuegen) $liste[] = ['hinzugefuegtVon' => $kennung] + $t;
    }
  } else {
    foreach ($alt['traktanden'] as $t) {
      $eigen = $hinzufuegen && ($t['hinzugefuegtVon'] ?? null) === $kennung && isset($neuById[$t['id']]);
      $liste[] = $eigen ? ['hinzugefuegtVon' => $kennung] + $neuById[$t['id']] : $t;
    }
    if ($hinzufuegen) foreach ($neu['traktanden'] ?? [] as $t) if (!isset($altIds[$t['id']])) $liste[] = ['hinzugefuegtVon' => $kennung] + $t;
  }
  $alt['traktanden'] = $liste;
  if (in_array('anwesenheit', $rechte, true)) $alt['anwesendeMitgliederIds'] = $neu['anwesendeMitgliederIds'] ?? $alt['anwesendeMitgliederIds'];
  if (in_array('gaeste', $rechte, true)) $alt['gaeste'] = $neu['gaeste'] ?? $alt['gaeste'];
  return $alt;
}

// Einzelrechte aufs Protokoll: Einträge der freigegebenen Typen (information / pendenz / antrag) übernehmen;
// Anträge entstehen im Vorprotokoll – hier nur Beschluss und Stimmen, kein Hinzufügen oder Löschen
function protokollEinzelrechte(array $alt, array $neu, array $rechte) {
  $darf = fn($e) => in_array($e['typ'] ?? '', $rechte, true);
  $neuById = indexById($neu['eintraege'] ?? []);
  $altIds = [];
  $eintraege = [];
  foreach ($alt['eintraege'] as $e) {
    $altIds[$e['id']] = true;
    $n = $neuById[$e['id']] ?? null;
    if (!$darf($e)) $eintraege[] = $e;
    elseif ($n && $darf($n)) $eintraege[] = $n;
    elseif ($e['typ'] === 'antrag') $eintraege[] = $e;
  }
  foreach ($neu['eintraege'] ?? [] as $e) if (!isset($altIds[$e['id']]) && $darf($e) && $e['typ'] !== 'antrag') $eintraege[] = $e;
  $alt['eintraege'] = $eintraege;
  return $alt;
}

// --- Individuelle Rechte: Zuschnitt auf Themenbereiche, Personen und Traktanden --------------------------
// sitzung.zuschnitt[personId] bzw. link.zuschnitt = { regeln: [{ modus: lesen|bearbeiten, art: themenbereich|person|
// traktandum, id }], eigene: bool } gilt für Vorprotokoll und Protokoll, sobald dort «Individuell» gesetzt ist.
// Regeln zählen zusammen; bearbeiten schliesst lesen ein. Wer Regeln hat, sieht nur, was sie abdecken (Kopfdaten,
// Anwesenheit und Gäste bleiben). Unterpunkte erben von oben; Themenbereiche stehen am Haupttraktandum oder am Eintrag;
// «Person» = verantwortlich, als Bearbeiter eingetragen (direkt, Rolle, Gruppe) oder Pendenz zugewiesen.
function zuschnittVon(array $bundle, array $sitzung, $personId, $link = null) {
  $z = $link ? ($link['zuschnitt'] ?? null) : (((array) ($sitzung['zuschnitt'] ?? []))[$personId] ?? null); // leer als {} (stdClass)
  if (!$z && !$link && isset($GLOBALS['linkGaeste'][$personId])) {
    // Über einen Link eingetragene Person ohne eigenen Zuschnitt: der ihres Links
    foreach ($bundle['vorprotokolle'] as $vp) {
      if ($vp['sitzungId'] !== $sitzung['id']) continue;
      foreach ($vp['gaeste'] as $g) {
        if ($g['id'] !== $personId) continue;
        $herkunft = ($g['ueberLink'] ?? '') === 'freigabe' ? freigabeLinkObjekt($vp) : null;
        foreach ($sitzung['links'] ?? [] as $l) if (($g['ueberLink'] ?? '') === $l['id']) $herkunft = $l;
        if ($herkunft && $herkunft['stufe'] === 'individuell') $z = $herkunft['zuschnitt'] ?? null;
      }
    }
  }
  return $z && !empty($z['regeln']) ? $z : null;
}

// Was der Zuschnitt sichtbar und bearbeitbar macht: Traktanden (alle Ebenen, auch Zusatztraktanden) und Einträge
function zuschnittSicht(array $bundle, array $vp, $protokoll, array $zuschnitt, $selbst, array $typRechte = []) {
  $regeln = $zuschnitt['regeln'];
  $personen = [];
  foreach ($regeln as $r) if ($r['art'] === 'person') $personen[$r['id']] = personDaten($bundle, $r['id']);
  $passt = function (array $r, array $k, $tb) use ($personen) {
    if ($r['art'] === 'themenbereich') return $tb !== '' && $tb === $r['id'];
    if ($r['art'] === 'traktandum') return ($k['id'] ?? '') === $r['id'];
    return isset($personen[$r['id']]) && istBerechtigt($k, $personen[$r['id']]);
  };
  $hat = function ($modus, array $k, $tb) use ($regeln, $passt) {
    foreach ($regeln as $r) if (($modus === 'lesen' || $r['modus'] === 'bearbeiten') && $passt($r, $k, $tb)) return true;
    return false;
  };
  $sicht = ['lesen' => [], 'bearbeiten' => [], 'kopf' => [], 'eltern' => []];
  $gehe = function (array $liste, $tbOben, $erbtL, $erbtB, $eltern) use (&$gehe, &$sicht, $hat, $zuschnitt, $selbst) {
    foreach ($liste as $k) {
      $id = $k['id'] ?? '';
      $tb = $tbOben !== null ? $tbOben : (string) ($k['themenbereichId'] ?? '');
      $b = $erbtB || $hat('bearbeiten', $k, $tb) || (!empty($zuschnitt['eigene']) && $selbst && istBerechtigt($k, $selbst));
      $l = $b || $erbtL || $hat('lesen', $k, $tb);
      $sicht['eltern'][$id] = $eltern;
      if ($b) $sicht['bearbeiten'][$id] = true;
      if ($l) $sicht['lesen'][$id] = true;
      $gehe($k['untertraktanden'] ?? [], $tb, $l, $b, $id);
    }
  };
  $gehe($vp['traktanden'], null, false, false, null);
  if ($protokoll) $gehe($protokoll['zusatztraktanden'] ?? [], null, false, false, null);

  $pendenzVon = function ($modus, array $e) use ($regeln, $zuschnitt, $selbst) {
    if (($e['typ'] ?? '') !== 'pendenz') return false;
    if (!empty($zuschnitt['eigene']) && $selbst && ($e['zugewiesenAn'] ?? null) === $selbst['id']) return true; // eigene Pendenzen
    foreach ($regeln as $r) if ($r['art'] === 'person' && ($modus === 'lesen' || $r['modus'] === 'bearbeiten') && ($e['zugewiesenAn'] ?? null) === $r['id']) return true;
    return false;
  };
  $tbEintrag = function ($modus, array $e) use ($regeln) {
    foreach ($regeln as $r) if ($r['art'] === 'themenbereich' && ($modus === 'lesen' || $r['modus'] === 'bearbeiten') && ($e['themenbereichId'] ?? '') === $r['id']) return true;
    return false;
  };
  $sicht['eintragLesen'] = fn(array $e) => isset($sicht['lesen'][$e['traktandumId'] ?? '']) || $tbEintrag('lesen', $e) || $pendenzVon('lesen', $e);
  $sicht['eintragBearbeiten'] = fn(array $e) => isset($sicht['bearbeiten'][$e['traktandumId'] ?? '']) || $tbEintrag('bearbeiten', $e) || $pendenzVon('bearbeiten', $e)
    || (in_array($e['typ'] ?? '', $typRechte, true) && $sicht['eintragLesen']($e));
  // Über sichtbaren Punkten und Einträgen steht ihr Pfad als Kopf (nur Titel)
  $kopf = function ($id) use (&$sicht) {
    for ($p = $sicht['eltern'][$id] ?? null; $p !== null; $p = $sicht['eltern'][$p] ?? null) if (!isset($sicht['lesen'][$p])) $sicht['kopf'][$p] = true;
  };
  foreach (array_keys($sicht['lesen']) as $id) $kopf($id);
  foreach ($protokoll['eintraege'] ?? [] as $e) {
    $t = $e['traktandumId'] ?? '';
    if ($sicht['eintragLesen']($e) && !isset($sicht['lesen'][$t])) { $sicht['kopf'][$t] = true; $kopf($t); }
  }
  return $sicht;
}

// Ausliefern: nicht sichtbare Punkte weglassen (Originalnummer in _nr), Kopf-Punkte nur mit Titel, Einträge filtern
function zuschnittListe(array $liste, array $sicht, $nummer = '') {
  $aus = [];
  foreach ($liste as $i => $k) {
    $id = $k['id'] ?? '';
    $nr = $nummer === '' ? (string) ($i + 1) : "$nummer." . ($i + 1);
    if (!isset($sicht['lesen'][$id]) && !isset($sicht['kopf'][$id])) continue;
    if (!isset($sicht['lesen'][$id])) $k['notiz'] = '';
    $k['_nr'] = $nr;
    $k['untertraktanden'] = zuschnittListe($k['untertraktanden'] ?? [], $sicht, $nr);
    $aus[] = $k;
  }
  return $aus;
}

function ohneNummern(array $liste) {
  foreach ($liste as &$k) {
    unset($k['_nr']);
    $k['untertraktanden'] = ohneNummern($k['untertraktanden'] ?? []);
  }
  return $liste;
}

// Speichern: bearbeitbare Punkte ganz übernehmen (inkl. Löschen, Unterpunkte), übrige behalten und darin weiter prüfen;
// neue Haupttraktanden nur mit dem Einzelrecht «Traktanden hinzufügen»
function zuschnittMergeListe(array $altListe, array $neuListe, array $sicht, $neueErlaubt, $kennung) {
  $neuById = indexById($neuListe);
  $altIds = [];
  $liste = [];
  foreach ($altListe as $t) {
    $altIds[$t['id']] = true;
    $n = $neuById[$t['id']] ?? null;
    if (isset($sicht['bearbeiten'][$t['id']]) || ($neueErlaubt && ($t['hinzugefuegtVon'] ?? null) === $kennung)) {
      if ($n) $liste[] = ohneNummern([$n])[0];
      continue;
    }
    $t['untertraktanden'] = zuschnittMergeListe($t['untertraktanden'] ?? [], $n['untertraktanden'] ?? [], $sicht, false, $kennung);
    $liste[] = $t;
  }
  if ($neueErlaubt) foreach ($neuListe as $t) if (!isset($altIds[$t['id']])) $liste[] = ['hinzugefuegtVon' => $kennung] + ohneNummern([$t])[0];
  return $liste;
}

function zuschnittVorprotokoll(array $alt, array $neu, array $sicht, array $rechte, $kennung) {
  $alt['traktanden'] = zuschnittMergeListe($alt['traktanden'], $neu['traktanden'] ?? [], $sicht, in_array('traktandenHinzufuegen', $rechte, true), $kennung);
  if (in_array('anwesenheit', $rechte, true)) $alt['anwesendeMitgliederIds'] = $neu['anwesendeMitgliederIds'] ?? $alt['anwesendeMitgliederIds'];
  if (in_array('gaeste', $rechte, true)) $alt['gaeste'] = $neu['gaeste'] ?? $alt['gaeste'];
  return $alt;
}

// Protokoll: nur bearbeitbare Einträge übernehmen (Anträge: nur Beschluss und Stimmen, nicht neu), Dauer bearbeitbarer Punkte
function zuschnittProtokoll(array $alt, array $neu, array $sicht) {
  $darf = $sicht['eintragBearbeiten'];
  $neuById = indexById($neu['eintraege'] ?? []);
  $altIds = [];
  $eintraege = [];
  foreach ($alt['eintraege'] as $e) {
    $altIds[$e['id']] = true;
    $n = $neuById[$e['id']] ?? null;
    if (!$darf($e)) $eintraege[] = $e;
    elseif ($n && $darf($n)) $eintraege[] = $n;
    elseif ($e['typ'] === 'antrag') $eintraege[] = $e;
  }
  foreach ($neu['eintraege'] ?? [] as $e) if (!isset($altIds[$e['id']]) && $darf($e) && $e['typ'] !== 'antrag') $eintraege[] = $e;
  $alt['eintraege'] = $eintraege;
  $alt['zusatztraktanden'] = zuschnittMergeListe($alt['zusatztraktanden'] ?? [], $neu['zusatztraktanden'] ?? [], $sicht, false, '');
  $dauern = is_array($alt['dauern'] ?? null) ? $alt['dauern'] : [];
  foreach (array_keys($sicht['bearbeiten']) as $id) {
    if (isset($neu['dauern'][$id])) $dauern[$id] = $neu['dauern'][$id];
    else unset($dauern[$id]);
  }
  $alt['dauern'] = $dauern;
  return $alt;
}

// Ausgeliefertes Bundle für einen Zugang mit Zuschnitt: Vorprotokoll und Protokoll jeder betroffenen Sitzung kürzen
function zuschnittAnwenden(array $bundle, array $zugriff) {
  linkGaesteMerken($bundle);
  $personId = $zugriff['personId'] ?? null;
  $selbst = $personId ? personDaten($bundle, $personId) : null;
  foreach ($bundle['sitzungen'] as $s) {
    $link = null;
    if (($zugriff['rolle'] ?? '') === 'link' || (($zugriff['rolle'] ?? '') === 'freigabe' && !$personId)) {
      if ($s['id'] !== ($zugriff['sitzungId'] ?? '') || ($zugriff['stufe'] ?? '') !== 'individuell') continue;
      $link = linkVonZugriff($bundle, $s, $zugriff);
      if (!$link) continue;
    } elseif (!$personId) continue;
    $z = zuschnittVon($bundle, $s, $personId, $link);
    if (!$z) continue;
    $vpIndex = null;
    foreach ($bundle['vorprotokolle'] as $i => $vp) if ($vp['sitzungId'] === $s['id']) $vpIndex = $i;
    if ($vpIndex === null) continue;
    $pIndex = null;
    foreach ($bundle['protokolle'] as $i => $p) if ($p['sitzungId'] === $s['id']) $pIndex = $i;
    $protokoll = $pIndex !== null ? $bundle['protokolle'][$pIndex] : null;
    $rechte = $link ? ($link['rechte'] ?? []) : einzelrechte($s, 'protokoll', $personId);
    $individuell = $link || freigabeStufe($s, 'vorprotokoll', $personId) === 'individuell' || freigabeStufe($s, 'protokoll', $personId) === 'individuell';
    if (!$individuell) continue;
    $sicht = zuschnittSicht($bundle, $bundle['vorprotokolle'][$vpIndex], $protokoll, $z, $selbst, $rechte);
    $bundle['vorprotokolle'][$vpIndex]['traktanden'] = zuschnittListe($bundle['vorprotokolle'][$vpIndex]['traktanden'], $sicht);
    if ($pIndex !== null) {
      $p = &$bundle['protokolle'][$pIndex];
      $p['eintraege'] = array_values(array_filter($p['eintraege'], $sicht['eintragLesen']));
      $p['zusatztraktanden'] = zuschnittListe($p['zusatztraktanden'] ?? [], $sicht);
      $sichtbar = $sicht['lesen'] + $sicht['kopf'];
      $p['aenderungsantraege'] = array_values(array_filter($p['aenderungsantraege'] ?? [], fn($a) => isset($sichtbar[$a['zielId'] ?? '']) || in_array($a['zielId'] ?? '', array_column($p['eintraege'], 'id'), true)));
      unset($p);
    }
  }
  return $bundle;
}

// Rechte einer Rolle (rolle.rechte = { stufe, einzel }): ein Hauptschalter Lesen / Eigene / Individuell / Alles.
// «Alles» heisst alles; «Individuell» schaltet Einzelrechte frei: vorprotokoll:… und protokoll:… (wie EINZELRECHTE) sowie
// sitzung:eintragen | starten | antraege | einladungen | zugriffe. Ohne Angabe: Vorlagen Sitzungsleitung / Aktuariat «Alles»,
// sonst «Eigene». Ältere Form (vorprotokoll / protokoll / eintragen / zugriffe einzeln) wird weiter gelesen.
const SITZUNGSRECHTE = ['eintragen', 'starten', 'antraege', 'einladungen', 'zugriffe'];

function rechteAusRolle($rolle) {
  $rechte = (array) ($rolle['rechte'] ?? []);
  $ergebnis = ['vorprotokoll' => 'eigene', 'protokoll' => 'eigene'] + array_fill_keys(SITZUNGSRECHTE, false);
  $alles = ['vorprotokoll' => 'alles', 'protokoll' => 'alles'] + array_fill_keys(SITZUNGSRECHTE, true);
  $vorlage = in_array($rolle['typ'] ?? null, ['praesidium', 'aktuariat'], true);
  if (!isset($rechte['stufe']) && array_intersect(['vorprotokoll', 'protokoll', 'eintragen', 'zugriffe'], array_keys(array_filter($rechte, fn($w) => $w !== null)))) {
    $ergebnis = $vorlage ? $alles : $ergebnis; // ältere Form: einzeln gesetzte Felder über dem Standard der Vorlage
    foreach (['vorprotokoll', 'protokoll', 'eintragen', 'zugriffe'] as $feld) if (isset($rechte[$feld])) $ergebnis[$feld] = $rechte[$feld];
    return $ergebnis;
  }
  $stufe = $rechte['stufe'] ?? ($vorlage ? 'alles' : 'eigene');
  if ($stufe === 'alles') return $alles;
  if ($stufe !== 'individuell') return array_merge($ergebnis, ['vorprotokoll' => $stufe, 'protokoll' => $stufe]);
  $einzel = (array) ($rechte['einzel'] ?? []);
  $teil = fn($bereich) => array_values(array_map(fn($e) => substr($e, strlen($bereich) + 1), array_filter($einzel, fn($e) => strpos($e, $bereich . ':') === 0)));
  $ergebnis['vorprotokoll'] = $teil('vorprotokoll');
  $ergebnis['protokoll'] = $teil('protokoll');
  foreach (SITZUNGSRECHTE as $recht) $ergebnis[$recht] = in_array($recht, $teil('sitzung'), true);
  return $ergebnis;
}

function rolleRechte(array $gremium, $personId) {
  foreach ($gremium['mitglieder'] as $m) {
    if ($m['id'] !== $personId) continue;
    foreach ($gremium['rollen'] as $r) if ($r['id'] === ($m['rolleId'] ?? null)) return rechteAusRolle($r);
  }
  return ['vorprotokoll' => 'eigene', 'protokoll' => 'eigene'] + array_fill_keys(SITZUNGSRECHTE, false);
}

// Sitzungsrecht einer Person (eintragen / starten / antraege / einladungen / zugriffe) über ihre Rolle
function sitzungsrecht(array $gremium, $personId, $recht) {
  return !empty(rolleRechte($gremium, $personId)[$recht]);
}

// Darf Sitzungen eintragen bzw. das Recht vergeben (Rolle) – über persönlichen Link wie über Konto
function hatFesteRolle(array $gremium, array $mitglied) {
  return !empty(rolleRechte($gremium, $mitglied['id'] ?? '')['eintragen']);
}

// Wird die Rolle dieses Mitglieds an Sitzungen erwartet?
function istErwartet(array $gremium, $personId) {
  foreach ($gremium['mitglieder'] as $m) {
    if ($m['id'] !== $personId) continue;
    foreach ($gremium['rollen'] as $r) if ($r['id'] === ($m['rolleId'] ?? null)) return ($r['sollAnwesend'] ?? true) !== false;
    return true;
  }
  return false;
}

// Person, die die Sitzung eingetragen hat; ältere Sitzungen ohne Angabe: die Sitzungsleitung
function istErsteller(array $sitzung, $personId) {
  if (!$personId) return false;
  if (!empty($sitzung['erstelltVon'])) return $sitzung['erstelltVon'] === $personId;
  foreach ($sitzung['sitzungsleitung'] ?? [] as $p) if (($p['id'] ?? null) === $personId) return true;
  return false;
}

// Terminfindung bearbeiten: erstellende Person und wem sie die Bearbeitung freigegeben hat (Person oder Rolle)
function darfTerminfindung(array $sitzung, array $person) {
  if (istErsteller($sitzung, $person['id'])) return true;
  foreach ($sitzung['terminfindung']['freigabe'] ?? [] as $id) {
    if ($id === $person['id'] || $id === 'rolle:' . ($person['rolleId'] ?? '')) return true;
  }
  return false;
}

// Terminfindung einer Person: Berechtigte übernehmen sie ganz (inkl. Termin festlegen), freigeben darf nur die
// erstellende Person; alle anderen nur eigene Stimme, eigene Kommentare und die eigene Abmeldung
function terminfindungMerge(array $alt, array $neu, array $sitzung, array $person) {
  if (darfTerminfindung($alt, $person)) {
    foreach (['terminfindung', 'datum', 'zeit', 'status'] as $feld) if (array_key_exists($feld, $neu)) $sitzung[$feld] = $neu[$feld];
    if (!istErsteller($alt, $person['id'])) $sitzung['terminfindung']['freigabe'] = $alt['terminfindung']['freigabe'] ?? [];
    return $sitzung;
  }
  $sitzung['terminfindung'] = sitzungMerge($alt, $neu, $person)['terminfindung'];
  return $sitzung;
}

// Aus der Terminfindung entfernte Personen sind entschuldigt: im Vorprotokoll (solange es kein Protokoll gibt) nicht
// anwesend; wer wieder aufgenommen wird und an Sitzungen erwartet ist, gilt wieder als anwesend
// Abgesagt (Einladung per E-Mail, mit Grund): bis zum Sitzungsbeginn nicht in der Anwesenheit – auch wenn ein älterer
// Stand des Vorprotokolls gespeichert wird. Ändern kann das nur die Person selbst über den Link in ihrer Einladung.
function absagenDurchsetzen(array $bundle, array $aenderungen) {
  $hatProtokoll = array_flip(array_column($bundle['protokolle'], 'sitzungId'));
  foreach ($aenderungen['vorprotokolle'] ?? [] as $k => $vp) {
    if (isset($hatProtokoll[$vp['sitzungId'] ?? ''])) continue;
    $abgesagt = array_keys(array_filter($bundle['einladungen'][$vp['sitzungId'] ?? ''] ?? [], fn($e) => ($e['antwort'] ?? '') === 'abgesagt'));
    if ($abgesagt) $aenderungen['vorprotokolle'][$k]['anwesendeMitgliederIds'] = array_values(array_diff($vp['anwesendeMitgliederIds'] ?? [], $abgesagt));
  }
  return $aenderungen;
}

function abmeldungenUebertragen(array $bundle, array $aenderungen) {
  $altSitzungen = indexById($bundle['sitzungen']);
  $hatProtokoll = array_flip(array_column($bundle['protokolle'], 'sitzungId'));
  $vorprotokolle = indexById($bundle['vorprotokolle']);
  foreach ($aenderungen['vorprotokolle'] ?? [] as $vp) $vorprotokolle[$vp['id']] = $vp;
  foreach ($aenderungen['sitzungen'] ?? [] as $s) {
    $alt = $altSitzungen[$s['id']]['terminfindung']['entfernt'] ?? [];
    $neu = $s['terminfindung']['entfernt'] ?? [];
    $weg = array_diff($neu, $alt);
    $zurueck = array_diff($alt, $neu);
    if ((!$weg && !$zurueck) || isset($hatProtokoll[$s['id']])) continue;
    foreach ($vorprotokolle as $vp) {
      if ($vp['sitzungId'] !== $s['id']) continue;
      $anwesend = array_values(array_diff($vp['anwesendeMitgliederIds'], $weg));
      foreach ($zurueck as $personId) if (istErwartet($bundle['gremium'], $personId) && !in_array($personId, $anwesend, true)) $anwesend[] = $personId;
      $vp['anwesendeMitgliederIds'] = $anwesend;
      $aenderungen['vorprotokolle'] = array_values(array_filter($aenderungen['vorprotokolle'] ?? [], fn($v) => $v['id'] !== $vp['id']));
      $aenderungen['vorprotokolle'][] = $vp;
    }
  }
  return $aenderungen;
}

// Traktanden / Unterpunkte (alle Ebenen): berechtigte Einträge ganz übernehmen (inkl. Löschen und neue), fremde behalten
// und darin nur die Unterpunkte mit eigener Berechtigung übernehmen; die Reihenfolge der fremden bleibt
function traktandenMerge(array $altListe, array $neuListe, array $person) {
  $neuById = indexById($neuListe);
  $altIds = [];
  $liste = [];
  foreach ($altListe as $t) {
    $altIds[$t['id']] = true;
    $n = $neuById[$t['id']] ?? null;
    if (istBerechtigt($t, $person)) {
      if ($n) $liste[] = $n;
      continue;
    }
    $t['untertraktanden'] = traktandenMerge($t['untertraktanden'] ?? [], $n['untertraktanden'] ?? [], $person);
    $liste[] = $t;
  }
  foreach ($neuListe as $t) if (!isset($altIds[$t['id']]) && istBerechtigt($t, $person)) $liste[] = $t;
  return $liste;
}

// Vorprotokoll: nur berechtigte Traktanden / Unterpunkte und eigene Anwesenheit übernehmen
function vorprotokollMerge(array $alt, array $neu, array $person) {
  $personId = $person['id'];
  $alt['traktanden'] = traktandenMerge($alt['traktanden'], $neu['traktanden'] ?? [], $person);

  $anwesend = array_values(array_diff($alt['anwesendeMitgliederIds'], [$personId]));
  if (in_array($personId, $neu['anwesendeMitgliederIds'] ?? [], true)) $anwesend[] = $personId;
  $alt['anwesendeMitgliederIds'] = $anwesend;
  return $alt;
}

// IDs der Traktanden / Unterpunkte (alle Ebenen), die die Person bearbeiten darf; Unterpunkte erben das Recht von oben
function erlaubteSammeln(array $liste, array $person, bool $geerbt, array &$erlaubt) {
  foreach ($liste as $t) {
    $darf = $geerbt || istBerechtigt($t, $person);
    if ($darf) $erlaubt[$t['id']] = true;
    erlaubteSammeln($t['untertraktanden'] ?? [], $person, $darf, $erlaubt);
  }
}

// Übernommene Pendenzen (pendenzId) aller berechtigten Traktanden und Unterpunkte (Rechte werden nach unten vererbt)
function pendenzIdsSammeln(array $liste, array $person, bool $geerbt, array &$ids) {
  foreach ($liste as $t) {
    $darf = $geerbt || istBerechtigt($t, $person);
    if ($darf && !empty($t['pendenzId'])) $ids[$t['pendenzId']] = true;
    pendenzIdsSammeln($t['untertraktanden'] ?? [], $person, $darf, $ids);
  }
}

// Protokoll: nur Einträge zu berechtigten Traktanden, übertragene Pendenzen berechtigter Traktanden und eigene Anwesenheit
function protokollMerge(array $alt, array $neu, array $person, array $bundle) {
  $personId = $person['id'];
  $erlaubt = [];
  $pendenzIds = [];
  foreach ($bundle['vorprotokolle'] as $vp) {
    $sitzung = null;
    foreach ($bundle['sitzungen'] as $s) if ($s['id'] === $vp['sitzungId']) $sitzung = $s;
    $stufe = $sitzung ? freigabeStufe($sitzung, 'protokoll', $personId) : 'eigene';
    if ($stufe === 'lesen') continue; // Freigabe «Lesen»: keine Einträge, keine übertragenen Pendenzen
    $voll = $stufe === 'alles';
    pendenzIdsSammeln($vp['traktanden'], $person, $voll, $pendenzIds);
    if ($vp['sitzungId'] === $alt['sitzungId']) erlaubteSammeln($vp['traktanden'], $person, $voll, $erlaubt);
  }
  $darf = fn($e) => isset($erlaubt[$e['traktandumId']]) || isset($pendenzIds[$e['id']]);

  $neuById = indexById($neu['eintraege'] ?? []);
  $altIds = [];
  $eintraege = [];
  foreach ($alt['eintraege'] as $e) {
    $altIds[$e['id']] = true;
    if (!$darf($e)) {
      // Eigene Pendenz: nur der Status darf geändert werden
      if ($e['typ'] === 'pendenz' && ($e['zugewiesenAn'] ?? null) === $personId && isset($neuById[$e['id']]['pendenzStatus'])) {
        $e['pendenzStatus'] = $neuById[$e['id']]['pendenzStatus'];
      }
      $eintraege[] = $e;
      continue;
    }
    if (isset($neuById[$e['id']]) && $darf($neuById[$e['id']])) $eintraege[] = $neuById[$e['id']];
  }
  foreach ($neu['eintraege'] ?? [] as $e) if (!isset($altIds[$e['id']]) && $darf($e)) $eintraege[] = $e;
  $alt['eintraege'] = $eintraege;

  // Tatsächliche Dauer: nur bei berechtigten Traktanden
  $dauern = is_array($alt['dauern'] ?? null) ? $alt['dauern'] : [];
  foreach ($erlaubt as $id => $_) {
    if (isset($neu['dauern'][$id])) $dauern[$id] = $neu['dauern'][$id];
    else unset($dauern[$id]);
  }
  $alt['dauern'] = $dauern;

  $anwesend = array_values(array_diff($alt['anwesende'], [$personId]));
  if (in_array($personId, $neu['anwesende'] ?? [], true)) $anwesend[] = $personId;
  $alt['anwesende'] = $anwesend;
  $alt['abwesende'] = array_values(array_diff($alt['abwesende'], [$personId]));
  if (!in_array($personId, $anwesend, true) && in_array($personId, $neu['abwesende'] ?? [], true)) $alt['abwesende'][] = $personId;
  return $alt;
}

// Sitzung (Terminfindung): nur eigene Stimme und eigene Kommentare übernehmen
function sitzungMerge(array $alt, array $neu, array $person) {
  $personId = $person['id'];
  if (empty($alt['terminfindung']) || empty($neu['terminfindung'])) return $alt;
  $tf = $alt['terminfindung'];
  // Über einen Link eingetragen: abstimmen / kommentieren nur, wenn der Link es erlaubt
  $rechte = freigabeRoh($alt, 'terminfindung', $personId);
  $darf = fn($recht) => $rechte === null || (is_array($rechte) && in_array($recht, $rechte, true));
  if ($darf('abstimmen')) {
    $stimmen = array_values(array_filter($tf['stimmen'], fn($s) => ($s['personId'] ?? null) !== $personId));
    foreach ($neu['terminfindung']['stimmen'] as $s) if (($s['personId'] ?? null) === $personId) $stimmen[] = $s;
    $tf['stimmen'] = $stimmen;
  }
  $vorhanden = array_flip(array_column($tf['kommentare'], 'id'));
  foreach ($darf('kommentieren') ? $neu['terminfindung']['kommentare'] : [] as $k) {
    if (!isset($vorhanden[$k['id']]) && ($k['personId'] ?? null) === $personId) $tf['kommentare'][] = $k;
  }
  // Sich selbst aus der Terminfindung entfernen (entschuldigt) oder wieder aufnehmen
  $entfernt = array_values(array_diff($tf['entfernt'] ?? [], [$personId]));
  if (in_array($personId, $neu['terminfindung']['entfernt'] ?? [], true)) $entfernt[] = $personId;
  $tf['entfernt'] = $entfernt;
  $alt['terminfindung'] = $tf;
  return $alt;
}

// Allgemeiner Freigabe-Link (ohne Identität): nur namentliche Stimmen und Kommentare der Terminfindung übernehmen
function sitzungMergeAnonym(array $alt, array $neu, bool $abstimmen = true, bool $kommentieren = true) {
  if (empty($alt['terminfindung']) || empty($neu['terminfindung']) || $alt['terminfindung']['status'] !== 'offen') return $alt;
  $tf = $alt['terminfindung'];
  if ($abstimmen) {
    $stimmen = array_values(array_filter($tf['stimmen'], fn($s) => !empty($s['personId'])));
    foreach ($neu['terminfindung']['stimmen'] as $s) if (empty($s['personId'])) $stimmen[] = $s;
    $tf['stimmen'] = $stimmen;
  }
  $vorhanden = array_flip(array_column($tf['kommentare'], 'id'));
  foreach ($kommentieren ? $neu['terminfindung']['kommentare'] : [] as $k) {
    if (!isset($vorhanden[$k['id']]) && empty($k['personId'])) $tf['kommentare'][] = $k;
  }
  $alt['terminfindung'] = $tf;
  return $alt;
}

// Einzelrechte einer Link-Stufe: alles = alle, eigene = Traktanden ändern und verschieben (Vorprotokoll), individuell = gewählte
function linkStufenRechte($stufe, array $rechte, $dokument) {
  if ($stufe === 'alles') return EINZELRECHTE[$dokument];
  if ($stufe === 'eigene') return $dokument === 'vorprotokoll' ? ['traktandenAendern'] : [];
  if ($stufe === 'individuell') return array_values(array_intersect($rechte, EINZELRECHTE[$dokument]));
  return [];
}

// Allgemeiner Freigabe-Link des Vorprotokolls als Link (Stufe wie bei weiteren Links; Standard «eigene»)
function freigabeLinkObjekt(array $vp) {
  return ['id' => 'freigabe', 'name' => 'Allgemeiner Link', 'dokument' => 'vorprotokoll', 'stufe' => $vp['freigabeLinkStufe'] ?? 'eigene',
          'rechte' => $vp['freigabeLinkRechte'] ?? [], 'zuschnitt' => $vp['freigabeLinkZuschnitt'] ?? null, 'ablauf' => $vp['freigabeLinkAblauf'] ?? ''];
}

// Link hinter einem Link-Zugriff (zusätzlicher Link der Sitzung oder Freigabe-Link)
function linkVonZugriff(array $bundle, array $sitzung, array $zugriff) {
  if (($zugriff['linkId'] ?? '') === 'freigabe') {
    $vp = vorprotokollVon($bundle, $sitzung['id']);
    return $vp ? freigabeLinkObjekt($vp) : null;
  }
  foreach ($sitzung['links'] ?? [] as $l) if ($l['id'] === ($zugriff['linkId'] ?? '')) return $l;
  return null;
}

// Zusätzlicher allgemeiner Link: nur sein Dokument dieser Sitzung – mit «Alles» ganz, mit «Eigene» / «Individuell» nach
// Einzelrechten, mit «Lesen» gar nicht
function linkRechteAnwenden(array $bundle, array $aenderungen, array $zugriff) {
  $dokument = $zugriff['dokument'];
  $rechte = linkStufenRechte($zugriff['stufe'], $zugriff['rechte'] ?? [], $dokument);
  $ergebnis = ['sitzungen' => [], 'vorprotokolle' => [], 'protokolle' => []];
  $alt = indexById($bundle['sitzungen'])[$zugriff['sitzungId']] ?? null;
  if (!$alt || !$rechte) return $ergebnis;
  if ($dokument === 'terminfindung') {
    foreach ($aenderungen['sitzungen'] ?? [] as $neu) {
      if ($neu['id'] === $alt['id']) $ergebnis['sitzungen'][] = sitzungMergeAnonym($alt, $neu, in_array('abstimmen', $rechte, true), in_array('kommentieren', $rechte, true));
    }
    return $ergebnis;
  }
  $typ = $dokument === 'vorprotokoll' ? 'vorprotokolle' : 'protokolle';
  $altDokumente = indexById($bundle[$typ]);
  foreach ($aenderungen[$typ] ?? [] as $neu) {
    $altDok = $altDokumente[$neu['id']] ?? null;
    if (!$altDok || $altDok['sitzungId'] !== $alt['id']) continue;
    $link = linkVonZugriff($bundle, $alt, $zugriff);
    $z = $zugriff['stufe'] === 'individuell' && $link ? zuschnittVon($bundle, $alt, null, $link) : null;
    if ($zugriff['stufe'] === 'alles') $dok = $neu;
    elseif ($z && $typ === 'vorprotokolle') $dok = zuschnittVorprotokoll($altDok, $neu, zuschnittSicht($bundle, $altDok, protokollVon($bundle, $alt['id']), $z, null), $rechte, 'link:' . $zugriff['linkId']);
    elseif ($z && ($vp = vorprotokollVon($bundle, $alt['id']))) $dok = zuschnittProtokoll($altDok, $neu, zuschnittSicht($bundle, $vp, $altDok, $z, null, $rechte));
    elseif ($typ === 'vorprotokolle') $dok = vorprotokollEinzelrechte($altDok, $neu, $rechte, 'link:' . $zugriff['linkId']);
    else $dok = protokollEinzelrechte($altDok, $neu, $rechte);
    $ergebnis[$typ][] = schluesselBewahren($altDok, $dok);
  }
  return $ergebnis;
}

// Gremium-Zugang: nur Änderungen in Bereichen mit Bearbeitungsrecht übernehmen
function gremiumRechteAnwenden(array $bundle, array $aenderungen, array $rechte) {
  if (($rechte['sitzungen'] ?? 'keine') !== 'bearbeiten') {
    unset($aenderungen['sitzungen'], $aenderungen['vorprotokolle'], $aenderungen['protokolle'], $aenderungen['geloescht']);
  }
  if (isset($aenderungen['gremium']) && $bundle['gremium']) {
    $gremium = $bundle['gremium'];
    $neu = $aenderungen['gremium'];
    if (($rechte['mitglieder'] ?? '') === 'bearbeiten') {
      foreach (['mitglieder', 'rollen', 'aufgaben'] as $feld) $gremium[$feld] = $neu[$feld] ?? $gremium[$feld] ?? null;
    }
    if (($rechte['einstellungen'] ?? '') === 'bearbeiten') {
      foreach (['name', 'beschreibung', 'fusstext', 'themenbereiche', 'vorlagen', 'erinnerungTage'] as $feld) $gremium[$feld] = $neu[$feld] ?? $gremium[$feld] ?? null;
    }
    $aenderungen['gremium'] = $gremium; // zugaenge bleiben immer unverändert
  }
  return $aenderungen;
}

// Schlüssel bleiben serverseitig erhalten (Zugänge ohne Admin-Rechte erhalten sie nicht und würden sie sonst löschen)
function schluesselBewahren(array $alt, array $neu) {
  foreach (['freigabeLinkKey', 'freigabeLinkAblauf', 'freigabeLinkStufe', 'freigabeLinkRechte', 'freigabeLinkZuschnitt', 'personenKeys', 'aliasKeys', 'verfolgerKey'] as $feld) {
    if (array_key_exists($feld, $alt)) $neu[$feld] = $alt[$feld];
    else unset($neu[$feld]);
  }
  return $neu;
}

// Herkunft, Konto und Vorschlag zum Zusammenführen von Gästen setzt nur der Server (Eintragen, Zusammenführen)
function gastFelderBewahren(array $bundle, array $aenderungen) {
  $alt = indexById($bundle['vorprotokolle']);
  foreach ($aenderungen['vorprotokolle'] ?? [] as $k => $vp) {
    $altGaeste = indexById($alt[$vp['id']]['gaeste'] ?? []);
    foreach ($vp['gaeste'] ?? [] as $i => $g) {
      $vorher = $altGaeste[$g['id'] ?? ''] ?? [];
      foreach (['ueberLink', 'vorschlag', 'weiterePerson', 'benutzerId'] as $feld) {
        if (array_key_exists($feld, $vorher)) $aenderungen['vorprotokolle'][$k]['gaeste'][$i][$feld] = $vorher[$feld];
        else unset($aenderungen['vorprotokolle'][$k]['gaeste'][$i][$feld]);
      }
    }
  }
  return gastEmailsBewahren($bundle, $aenderungen);
}

// E-Mails von Gästen und weiteren Personen sehen nur Verwaltende (Sitzungen bearbeiten) und die Leitung der
// Sitzung, sonst jede Person nur ihre eigene. Verborgene Adressen sind leer und mit emailVerborgen markiert.
function gastEmailsVerbergen(array $bundle, $personId) {
  $leitung = [];
  foreach ($bundle['sitzungen'] as $s) if ($personId !== null && istLeitung($s, $personId)) $leitung[$s['id']] = true;
  foreach (['vorprotokolle', 'protokolle'] as $typ) {
    foreach ($bundle[$typ] as $k => $dok) {
      if (isset($leitung[$dok['sitzungId']])) continue;
      foreach ($dok['gaeste'] ?? [] as $i => $g) {
        if (($g['email'] ?? '') === '' || ($g['id'] ?? null) === $personId) continue;
        $bundle[$typ][$k]['gaeste'][$i]['email'] = '';
        $bundle[$typ][$k]['gaeste'][$i]['emailVerborgen'] = true;
      }
    }
  }
  return $bundle;
}

// Beim Speichern: verborgene (leer zurückgeschickte) E-Mails bleiben erhalten; die Markierung wird nie gespeichert
function gastEmailsBewahren(array $bundle, array $aenderungen) {
  $vpEmails = []; // Rückfall für neue Protokolle: Gäste stammen aus dem Vorprotokoll
  foreach ($bundle['vorprotokolle'] as $vp) foreach ($vp['gaeste'] as $g) $vpEmails[$g['id']] = $g['email'] ?? '';
  foreach (['vorprotokolle', 'protokolle'] as $typ) {
    $alt = indexById($bundle[$typ]);
    foreach ($aenderungen[$typ] ?? [] as $k => $dok) {
      $altGaeste = indexById($alt[$dok['id'] ?? '']['gaeste'] ?? []);
      foreach ($dok['gaeste'] ?? [] as $i => $g) {
        if (!empty($g['emailVerborgen']) && ($g['email'] ?? '') === '') $aenderungen[$typ][$k]['gaeste'][$i]['email'] = $altGaeste[$g['id'] ?? '']['email'] ?? $vpEmails[$g['id'] ?? ''] ?? '';
        unset($aenderungen[$typ][$k]['gaeste'][$i]['emailVerborgen']);
      }
    }
  }
  return $aenderungen;
}

// Persönliche Zugänge (Mitglied / Gast): Dokumente je nach Berechtigung mergen. Das Gremium ändert sich nur, wenn
// Mitglieder, deren Rolle Sitzungen eintragen darf, das Recht «Sitzungen eintragen» an andere Mitglieder vergeben.
function personRechteAnwenden(array $bundle, array $aenderungen, array $zugriff) {
  $person = personDaten($bundle, $zugriff['personId']);
  $nurVorprotokollId = $zugriff['vorprotokollId'] ?? null; // Gast-Link: nur dieses Vorprotokoll
  $geloeschteProtokolle = $aenderungen['geloescht']['protokolle'] ?? []; // Löschungen, die eine Person darf (siehe unten)
  $geloeschteSitzungen = $aenderungen['geloescht']['sitzungen'] ?? [];
  $gremiumNeu = $aenderungen['gremium'] ?? null;
  unset($aenderungen['gremium'], $aenderungen['geloescht']);
  $sitzungen = indexById($bundle['sitzungen']);

  // Recht «Sitzungen eintragen»: über die Rolle oder einzeln zugeteilt (persönlicher Link wie Konto)
  $mitglied = null;
  foreach ($bundle['gremium']['mitglieder'] as $m) if ($m['id'] === ($zugriff['personId'] ?? null) && !$nurVorprotokollId) $mitglied = $m;
  $festeRolle = $mitglied && hatFesteRolle($bundle['gremium'], $mitglied);
  $darfEintragen = $festeRolle || !empty($mitglied['darfSitzungenEintragen']);
  if ($festeRolle && $gremiumNeu) {
    $neuMitglieder = indexById($gremiumNeu['mitglieder'] ?? []);
    $gremium = $bundle['gremium'];
    foreach ($gremium['mitglieder'] as &$m) {
      if (isset($neuMitglieder[$m['id']])) $m['darfSitzungenEintragen'] = !empty($neuMitglieder[$m['id']]['darfSitzungenEintragen']);
    }
    unset($m);
    $aenderungen['gremium'] = $gremium;
  }

  $gastSitzungId = null; // Gast-Link: nur die eigene Sitzung
  foreach ($bundle['vorprotokolle'] as $vp) if ($vp['id'] === $nurVorprotokollId) $gastSitzungId = $vp['sitzungId'];

  // Sitzungen zuerst: neu eingetragene stehen danach für Vorprotokoll und Protokoll bereit
  $liste = [];
  foreach ($aenderungen['sitzungen'] ?? [] as $neu) {
    if (!isset($sitzungen[$neu['id']])) {
      if ($darfEintragen && ($neu['erstelltVon'] ?? null) === $person['id']) {
        $neu['links'] = []; // Links (mit Schlüsseln) legt nur an, wer Links sieht
        $neu['gesperrt'] = [];
        $liste[] = $neu;
        $sitzungen[$neu['id']] = $neu;
      }
      continue;
    }
    $alt = $sitzungen[$neu['id']];
    if (($gastSitzungId && $alt['id'] !== $gastSitzungId) || fuerSitzungGesperrt($alt, $person['id'])) continue;
    // Leitung oder Freigabe «alles» auf einem Dokument darf die Sitzung (Kopfdaten, Freigaben) ändern
    $leitung = istLeitung($alt, $person['id']);
    $voll = $leitung || freigabeStufe($alt, 'vorprotokoll', $person['id']) === 'alles' || freigabeStufe($alt, 'protokoll', $person['id']) === 'alles';
    $sitzung = $voll ? $neu : sitzungMerge($alt, $neu, $person);
    if (!empty($alt['terminfindung'])) $sitzung = terminfindungMerge($alt, $neu, $sitzung, $person);
    // Links und Sperren der Sitzung verwalten Sitzungsleitung und Protokollführung (die Leitung selbst ist nie gesperrt)
    if (!$leitung) {
      $sitzung['links'] = $alt['links'] ?? [];
      $sitzung['gesperrt'] = $alt['gesperrt'] ?? [];
    } else {
      $fuehrung = array_column(array_merge($sitzung['sitzungsleitung'] ?? [], $sitzung['protokollfuehrung'] ?? []), 'id');
      $sitzung['gesperrt'] = array_values(array_diff($sitzung['gesperrt'] ?? [], $fuehrung));
    }
    $sitzung['erstelltVon'] = $alt['erstelltVon'] ?? null;
    // Starten / abschliessen (Status): Aufgabe in der Sitzung, Recht «Starten und abschliessen» oder Protokoll «Alles»
    $darfStarten = $leitung || sitzungsrecht($bundle['gremium'], $person['id'], 'starten') || freigabeStufe($alt, 'protokoll', $person['id']) === 'alles';
    $sitzung['status'] = $darfStarten ? ($neu['status'] ?? $sitzung['status']) : ($alt['status'] ?? $sitzung['status']);
    // Wer die Aufgaben übernimmt (auch als Vertretung): wer die Sitzung eingetragen hat oder Zugriffe verwaltet
    $ersteller = !empty($alt['erstelltVon']) ? $alt['erstelltVon'] === $person['id'] : in_array($person['id'], array_column($alt['sitzungsleitung'] ?? [], 'id'), true); // ältere Sitzungen: die Leitung
    $darfAufgaben = $ersteller || sitzungsrecht($bundle['gremium'], $person['id'], 'zugriffe');
    if (!$darfAufgaben) foreach (['sitzungsleitung', 'protokollfuehrung'] as $feld) $sitzung[$feld] = $alt[$feld] ?? [];
    // Letztes Protokoll genehmigen: wer das Protokoll der genehmigenden Sitzung ganz bearbeiten darf
    $in = $neu['genehmigt']['sitzungId'] ?? null;
    if (!$voll && $in && empty($alt['genehmigt']) && isset($sitzungen[$in]) && freigabeStufe($sitzungen[$in], 'protokoll', $person['id']) === 'alles') {
      $sitzung['genehmigt'] = $neu['genehmigt'];
    }
    $liste[] = $sitzung;
  }
  $aenderungen['sitzungen'] = $liste;

  // Wer ein Dokument einer Sitzung ganz bearbeiten darf (Sitzungsleitung, Protokollführung, Freigabe «alles»),
  // darf es auch neu anlegen (Sitzung starten) und das Protokoll wieder entfernen – sofern es noch keines gibt
  $darfAlles = fn($sitzungId, $dokument) => isset($sitzungen[$sitzungId]) && (!$gastSitzungId || $sitzungId === $gastSitzungId)
    && freigabeStufe($sitzungen[$sitzungId], $dokument, $person['id']) === 'alles';
  $neuAnlegen = function ($typ, $neu) use ($bundle, $darfAlles, $sitzungen, $person, $gastSitzungId) {
    foreach ($bundle[$typ] as $vorhanden) if ($vorhanden['sitzungId'] === ($neu['sitzungId'] ?? null)) return false;
    $sitzung = $sitzungen[$neu['sitzungId'] ?? ''] ?? null;
    // Protokoll anlegen = Sitzung starten: auch mit dem Recht «Starten und abschliessen» bzw. als Aufgabe
    if ($typ === 'protokolle' && $sitzung && (!$gastSitzungId || $sitzung['id'] === $gastSitzungId)
      && (istLeitung($sitzung, $person['id']) || sitzungsrecht($bundle['gremium'], $person['id'], 'starten'))) return true;
    return $darfAlles($neu['sitzungId'] ?? '', $typ === 'protokolle' ? 'protokoll' : 'vorprotokoll');
  };

  $vorprotokolle = [];
  $altVorprotokolle = indexById($bundle['vorprotokolle']);
  foreach ($aenderungen['vorprotokolle'] ?? [] as $neu) {
    if ($nurVorprotokollId && $neu['id'] !== $nurVorprotokollId) continue;
    $alt = $altVorprotokolle[$neu['id']] ?? null;
    if (!$alt) {
      if ($neuAnlegen('vorprotokolle', $neu)) $vorprotokolle[] = $neu;
      continue;
    }
    $sitzung = $sitzungen[$alt['sitzungId']] ?? null;
    if ($sitzung && fuerSitzungGesperrt($sitzung, $person['id'])) continue;
    $stufe = $sitzung ? freigabeStufe($sitzung, 'vorprotokoll', $person['id']) : 'eigene';
    if ($stufe === 'lesen') { $vorprotokolle[] = $alt; continue; }
    if ($stufe === 'individuell') {
      $rechte = einzelrechte($sitzung, 'vorprotokoll', $person['id']);
      $z = zuschnittVon($bundle, $sitzung, $person['id']);
      $dok = $z ? zuschnittVorprotokoll($alt, $neu, zuschnittSicht($bundle, $alt, protokollVon($bundle, $alt['sitzungId']), $z, $person), $rechte, $person['id'])
                : vorprotokollEinzelrechte($alt, $neu, $rechte, $person['id']);
      $vorprotokolle[] = schluesselBewahren($alt, $dok);
      continue;
    }
    $dok = $stufe === 'alles' ? $neu : vorprotokollMerge($alt, $neu, $person);
    // Links der eigenen Sitzung (allgemein, Gäste) verwalten Sitzungsleitung und Protokollführung
    $vorprotokolle[] = $sitzung && istLeitung($sitzung, $person['id']) && $stufe === 'alles' ? $dok : schluesselBewahren($alt, $dok);
  }
  $aenderungen['vorprotokolle'] = $vorprotokolle;

  $protokolle = [];
  $altProtokolle = indexById($bundle['protokolle']);
  foreach ($aenderungen['protokolle'] ?? [] as $neu) {
    $alt = $altProtokolle[$neu['id']] ?? null;
    if (!$alt) {
      if ($neuAnlegen('protokolle', $neu)) $protokolle[] = $neu;
      continue;
    }
    if ($nurVorprotokollId && $alt['sitzungId'] !== $gastSitzungId) continue;
    $sitzung = $sitzungen[$alt['sitzungId']] ?? null;
    if ($sitzung && fuerSitzungGesperrt($sitzung, $person['id'])) continue;
    $stufe = $sitzung ? freigabeStufe($sitzung, 'protokoll', $person['id']) : 'eigene';
    if ($stufe === 'individuell') {
      $rechte = einzelrechte($sitzung, 'protokoll', $person['id']);
      $z = zuschnittVon($bundle, $sitzung, $person['id']);
      $vp = vorprotokollVon($bundle, $alt['sitzungId']);
      $dok = $z && $vp ? zuschnittProtokoll($alt, $neu, zuschnittSicht($bundle, $vp, $alt, $z, $person, $rechte)) : protokollEinzelrechte($alt, $neu, $rechte);
      $protokolle[] = schluesselBewahren($alt, $dok);
      continue;
    }
    $dok = $stufe === 'alles' ? $neu : protokollMerge($alt, $neu, $person, $bundle);
    $protokolle[] = $sitzung && istLeitung($sitzung, $person['id']) && $stufe === 'alles' ? $dok : schluesselBewahren($alt, $dok);
  }
  $aenderungen['protokolle'] = $protokolle;

  // Eigene Sitzungen ohne Protokoll darf wieder löschen, wer Sitzungen eintragen darf (mit dem Vorprotokoll)
  $hatProtokoll = array_flip(array_column($bundle['protokolle'], 'sitzungId'));
  $sitzungenWeg = array_values(array_filter($geloeschteSitzungen, fn($id) => $darfEintragen && isset($sitzungen[$id])
    && ($sitzungen[$id]['erstelltVon'] ?? null) === $person['id'] && !isset($hatProtokoll[$id])));
  $aenderungen['geloescht'] = [
    'protokolle' => array_values(array_filter($geloeschteProtokolle, fn($id) => isset($altProtokolle[$id]) && $darfAlles($altProtokolle[$id]['sitzungId'], 'protokoll'))),
    'sitzungen' => $sitzungenWeg,
    'vorprotokolle' => array_values(array_column(array_filter($bundle['vorprotokolle'], fn($vp) => in_array($vp['sitzungId'], $sitzungenWeg, true)), 'id')),
  ];
  return $aenderungen;
}

// --- Änderungsanträge zu abgeschlossenen Protokollen ------------------------------
// Stellen dürfen Mitglieder mit verknüpftem Konto, die an der Sitzung erwartet waren oder anwesend waren – solange die
// Sitzung abgeschlossen und das Protokoll nicht genehmigt ist (Kurzsitzungen nie). Entscheiden (übernommen / abgelehnt)
// darf die Protokollführung bzw. wer das Gremium verwaltet; die Sitzungsleitung sieht sie nur.
function darfAenderungStellen(array $bundle, array $sitzung, array $protokoll, $personId) {
  if (!$personId || !empty($sitzung['kurz']) || !empty($sitzung['genehmigt']) || ($sitzung['status'] ?? '') !== 'abgeschlossen') return false;
  if (in_array($personId, array_column($protokoll['gaeste'] ?? [], 'id'), true)) return true; // anwesender Gast oder weitere Person
  foreach ($bundle['gremium']['mitglieder'] as $m) {
    if ($m['id'] !== $personId) continue;
    if (empty($m['benutzerId'])) return false;
    $erwartet = true;
    foreach ($bundle['gremium']['rollen'] as $r) if ($r['id'] === ($m['rolleId'] ?? null)) $erwartet = ($r['sollAnwesend'] ?? true) !== false;
    return $erwartet || in_array($personId, $protokoll['anwesende'] ?? [], true);
  }
  return false;
}

// Bisherige und neue Änderungsanträge zusammenführen: Eigene offene Anträge darf die Person ändern und zurückziehen,
// neue nur stellen, wenn sie berechtigt ist; Entscheide nur, wer entscheiden darf. Alles andere bleibt, wie es war –
// so gehen auch keine Anträge verloren, die jemand anderes inzwischen gestellt hat.
function aenderungsantraegeMerge(array $altListe, array $neuListe, $personId, bool $entscheiden, bool $stellen) {
  $neuById = indexById($neuListe);
  $liste = [];
  foreach ($altListe as $a) {
    $n = $neuById[$a['id']] ?? null;
    unset($neuById[$a['id']]);
    $eigen = $personId && $a['personId'] === $personId && $a['status'] === 'offen';
    if (!$n) {
      if (!$eigen) $liste[] = $a; // zurückziehen kann nur, wer ihn gestellt hat
      continue;
    }
    if ($eigen) $a['text'] = (string) ($n['text'] ?? $a['text']);
    if ($entscheiden && in_array($n['status'] ?? '', ['offen', 'uebernommen', 'abgelehnt'], true)) {
      foreach (['status', 'antwort', 'entschiedenVon'] as $feld) $a[$feld] = $n[$feld] ?? $a[$feld] ?? '';
    }
    $liste[] = $a;
  }
  foreach ($neuById as $n) {
    if ($stellen && ($n['personId'] ?? null) === $personId && ($n['status'] ?? '') === 'offen') $liste[] = $n;
  }
  return $liste;
}

// Für jedes gespeicherte Protokoll die zulässige Liste der Änderungsanträge (vor den übrigen Rechteprüfungen ermittelt)
function aenderungsantraegeBerechnen(array $bundle, array $aenderungen, array $zugriff) {
  $sitzungen = indexById($bundle['sitzungen']);
  $altProtokolle = indexById($bundle['protokolle']);
  $personId = $zugriff['personId'] ?? null;
  $ergebnis = [];
  foreach ($aenderungen['protokolle'] ?? [] as $neu) {
    $alt = $altProtokolle[$neu['id']] ?? null;
    $sitzung = $sitzungen[($alt ?? $neu)['sitzungId']] ?? null;
    if (!$sitzung) continue;
    $protokollfuehrung = array_column($sitzung['protokollfuehrung'] ?? [], 'id');
    $entscheiden = in_array($zugriff['rolle'], ['admin', 'gremium'], true) || ($personId && in_array($personId, $protokollfuehrung, true))
      || istLeitung($sitzung, $personId) || ($personId && sitzungsrecht($bundle['gremium'], $personId, 'antraege'));
    $stellen = darfAenderungStellen($bundle, $sitzung, $alt ?? $neu, $personId);
    $ergebnis[$neu['id']] = aenderungsantraegeMerge($alt['aenderungsantraege'] ?? [], $neu['aenderungsantraege'] ?? [], $personId, $entscheiden, $stellen);
  }
  return $ergebnis;
}

// Geheime Schlüssel leeren, die der Zugang nicht sehen darf (leer statt entfernt, damit der Client keine neuen erzeugt)
// Gremium-Zugang: Links nur zu Bereichen, die er bearbeiten darf – Verfolger- und Übersichts-Links (nur lesen) schon ab «lesen»
// Passwörter allgemeiner Links (linkSchutz) gehen nie hinaus – nur, welche Links eines haben (geschuetzt).
// Sitzungsleitung / Protokollführung sehen die Links ihrer Sitzungen; wer für eine Sitzung gesperrt ist, sieht sie nicht.
// Einladungen mit Antworten und Absagegründen sowie Abbestellungen sehen nur, wer die jeweilige Sitzung verwaltet
function einladungenFiltern(array $bundle, array $zugriff) {
  $behalten = [];
  foreach ($bundle['einladungen'] ?? [] as $sitzungId => $liste) {
    $s = sitzungVon($bundle, $sitzungId);
    if ($s && verwaltetSitzung($zugriff, $s, $bundle['gremium'])) $behalten[$sitzungId] = $liste;
  }
  $bundle['einladungen'] = $behalten ?: new stdClass();
  $verwaltet = $behalten || verwaltetSitzung($zugriff, null, $bundle['gremium']);
  if (!$verwaltet) foreach ($bundle['sitzungen'] as $s) $verwaltet = $verwaltet || verwaltetSitzung($zugriff, $s, $bundle['gremium']);
  $bundle['einladungenAus'] = $verwaltet ? ($bundle['einladungenAus'] ?? []) : [];
  return $bundle;
}

function bereinigen(array $bundle, array $zugriff) {
  $bundle['geschuetzt'] = array_keys($bundle['linkSchutz'] ?? []);
  unset($bundle['linkSchutz'], $bundle['ansichten'], $bundle['linkZugesandt']); // Passwörter, Ansicht-Schlüssel und Versandsperren gehen nie hinaus
  $rolle = $zugriff['rolle'];
  if ($rolle === 'admin') return $bundle;
  $bundle = einladungenFiltern($bundle, $zugriff);
  $original = $bundle;
  $bundle['gremium']['zugaenge'] = [];
  $rechte = $rolle === 'gremium' ? $zugriff['rechte'] : [];
  $sitzungen = $rechte['sitzungen'] ?? 'keine';
  if (($rechte['mitglieder'] ?? '') !== 'bearbeiten') foreach ($bundle['gremium']['mitglieder'] as &$m) $m['zugangsKey'] = '';
  if ($sitzungen === 'keine') foreach ($bundle['gremium']['themenbereiche'] as &$tb) $tb['freigabeKey'] = '';
  if ($sitzungen !== 'bearbeiten') foreach ($bundle['vorprotokolle'] as &$vp) { $vp['freigabeLinkKey'] = ''; $vp['personenKeys'] = new stdClass(); $vp['aliasKeys'] = new stdClass(); }
  if ($sitzungen !== 'bearbeiten') foreach ($bundle['sitzungen'] as &$s) foreach ($s['links'] ?? [] as $i => $l) $s['links'][$i]['key'] = '';
  unset($s);
  if ($sitzungen === 'keine') foreach ($bundle['protokolle'] as &$p) $p['verfolgerKey'] = '';
  unset($m, $tb, $vp, $p);
  if ($rolle === 'person') $bundle = personSicht($bundle, $original, $zugriff['personId']);
  elseif ($sitzungen !== 'bearbeiten') unset($bundle['nutzung']);
  if ($sitzungen === 'bearbeiten') return $bundle;
  $bundle = gastEmailsVerbergen($bundle, $zugriff['personId'] ?? null);
  // Individuelle Rechte mit Regeln: nur die abgedeckten Traktanden und Einträge
  if (in_array($rolle, ['person', 'freigabe', 'link'], true)) $bundle = zuschnittAnwenden($bundle, $zugriff);
  // Verdeckte Terminfindung: nur die eigene Stimme sichtbar
  foreach ($bundle['sitzungen'] as &$s) {
    if (!empty($s['terminfindung']['verdeckt'])) {
      $eigene = $zugriff['personId'] ?? null;
      $s['terminfindung']['stimmen'] = array_values(array_filter($s['terminfindung']['stimmen'], fn($st) => ($st['personId'] ?? null) === $eigene));
    }
  }
  return $bundle;
}

// Persönlicher Zugang: Links der selbst geleiteten Sitzungen zurück, gesperrte Sitzungen weg; «zuletzt genutzt» nur
// für die Zugriffsübersicht der Leitung (Mitglieder sowie Gäste und Links der geleiteten Sitzungen)
function personSicht(array $bundle, array $original, $personId) {
  $geleitet = [];
  $weg = [];
  $alleVerwalten = !empty(rolleRechte($bundle['gremium'], $personId)['zugriffe']);
  foreach ($bundle['sitzungen'] as $i => $s) {
    if (istLeitung($s, $personId) || $alleVerwalten) {
      $geleitet[$s['id']] = true;
      $bundle['sitzungen'][$i]['links'] = $original['sitzungen'][$i]['links'] ?? [];
    } elseif (fuerSitzungGesperrt($s, $personId)) $weg[$s['id']] = true;
  }
  foreach (['vorprotokolle', 'protokolle'] as $typ) {
    foreach ($bundle[$typ] as $i => $dok) {
      if (isset($geleitet[$dok['sitzungId']])) $bundle[$typ][$i] = $original[$typ][$i];
    }
    $bundle[$typ] = array_values(array_filter($bundle[$typ], fn($dok) => !isset($weg[$dok['sitzungId']])));
  }
  $bundle['sitzungen'] = array_values(array_filter($bundle['sitzungen'], fn($s) => !isset($weg[$s['id']])));

  $nutzung = [];
  if ($geleitet) {
    $refs = [];
    foreach ($bundle['gremium']['mitglieder'] as $m) $refs['person:' . $m['id']] = $refs['konto:' . $m['id']] = true;
    foreach ($bundle['sitzungen'] as $s) {
      if (!isset($geleitet[$s['id']])) continue;
      foreach ($s['links'] ?? [] as $l) $refs['link:' . $l['id']] = true;
    }
    foreach ($bundle['vorprotokolle'] as $vp) {
      if (!isset($geleitet[$vp['sitzungId']])) continue;
      $refs['freigabe:' . $vp['id']] = true;
      foreach ($vp['gaeste'] as $g) $refs['person:' . $g['id']] = $refs['konto:' . $g['id']] = true;
    }
    foreach ($bundle['protokolle'] as $p) if (isset($geleitet[$p['sitzungId']])) $refs['verfolger:' . $p['id']] = true;
    $nutzung = array_intersect_key($bundle['nutzung'] ?? [], $refs);
  }
  $bundle['nutzung'] = (object) $nutzung;
  return $bundle;
}

// Zugänge zu einer einzelnen Sitzung: aus den Protokollen anderer Sitzungen nur Pendenzen und vertagte bzw. neu
// behandelte Anträge (für den Übertrag ins Vorprotokoll)
function protokolleFuerUebertrag(array $bundle, $sitzungId) {
  foreach ($bundle['protokolle'] as &$protokoll) {
    if ($protokoll['sitzungId'] === $sitzungId) continue;
    $protokoll['eintraege'] = array_values(array_filter($protokoll['eintraege'], fn($e) => $e['typ'] === 'pendenz' || ($e['typ'] === 'antrag' && (($e['antragStatus'] ?? '') === 'vertagt' || !empty($e['vorherigerAntragId'])))));
  }
  unset($protokoll);
  return $bundle;
}

// --- Token und Aktion ----------------------------------------------
$token = $_SERVER['HTTP_X_TOKEN'] ?? '';
if ($token === '' && ($_GET['aktion'] ?? '') === 'ical') $token = $_GET['token'] ?? ''; // Kalender-Abo: Token als Parameter
$aktion = $_GET['aktion'] ?? '';
$eingabe = ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' ? json_decode(file_get_contents('php://input'), true) : null;

// --- Schutz allgemeiner Links: Passwort, Ablauf, Sperre -------------------------
// Passwörter liegen gehasht in bundle.linkSchutz[ref] und gehen nie an den Client; der Ablauf steht beim Link selbst
// ('' | JJJJ-MM-TT = gilt bis Ende dieses Tages | 'genehmigt' = bis das Protokoll der Sitzung genehmigt ist).
// Wer das Passwort einmal eingegeben hat, erhält eine Freischaltung (an Link und Passwort gebunden) für dieses Gerät.
function abgelaufen($ablauf, $sitzung = null) {
  if (!$ablauf) return false;
  if ($ablauf === 'genehmigt') return !empty($sitzung['genehmigt']);
  return $ablauf < date('Y-m-d');
}

function freischaltung($token, $hash) {
  return hash_hmac('sha256', $token . '|' . $hash, schluessel());
}

function gesperrt($grund, array $zusatz = []) {
  return ['rolle' => 'gesperrt', 'grund' => $grund] + $zusatz;
}

// Allgemeiner Link: abgelaufen oder (noch) nicht mit dem Passwort freigeschaltet?
function linkSchutz(array $bundle, array $zugriff, $token, $ref, $ablauf, $sitzung, $name) {
  if (abgelaufen($ablauf, $sitzung)) return gesperrt('abgelaufen');
  $hash = $bundle['linkSchutz'][$ref] ?? '';
  if ($hash !== '' && !hash_equals(freischaltung($token, $hash), $_SERVER['HTTP_X_FREISCHALTUNG'] ?? '')) {
    return gesperrt('passwort', ['gremiumId' => $bundle['gremium']['id'], 'ref' => $ref, 'name' => $name]);
  }
  return $zugriff + ['ref' => $ref];
}

function vorprotokollVon(array $bundle, $sitzungId) {
  foreach ($bundle['vorprotokolle'] as $vp) if ($vp['sitzungId'] === $sitzungId) return $vp;
  return null;
}

function protokollVon(array $bundle, $sitzungId) {
  foreach ($bundle['protokolle'] as $p) if ($p['sitzungId'] === $sitzungId) return $p;
  return null;
}

function sitzungVon(array $bundle, $sitzungId) {
  foreach ($bundle['sitzungen'] as $s) if ($s['id'] === $sitzungId) return $s;
  return null;
}

// Über einen allgemeinen Link eingetragene Person (ueberLink: Link-ID oder 'freigabe'): Dokument, Stufe, Rechte und
// Ablauf ihres Links. Gelöschter Link: nur noch lesen (mit Konto) bzw. kein Zugriff mehr (Link).
function herkunftsLink(array $bundle, array $vp, array $gast) {
  $sitzung = sitzungVon($bundle, $vp['sitzungId']);
  if ($gast['ueberLink'] === 'freigabe') return freigabeLinkObjekt($vp) + ['sitzung' => $sitzung, 'terminfindung' => true, 'gibt' => true];
  foreach ($sitzung['links'] ?? [] as $l) {
    if ($l['id'] === $gast['ueberLink']) return ['dokument' => $l['dokument'], 'stufe' => $l['stufe'], 'rechte' => $l['rechte'] ?? [], 'ablauf' => $l['ablauf'] ?? '', 'sitzung' => $sitzung, 'gibt' => true];
  }
  return ['dokument' => '', 'stufe' => 'lesen', 'rechte' => [], 'ablauf' => '', 'sitzung' => $sitzung, 'gibt' => false];
}

// Freigabe einer solchen Person auf ein Dokument: auf dem Dokument ihres Links dessen Rechte («Alles» = alle
// Einzelrechte – Sitzung starten oder abschliessen kann ein Link nie), auf allen anderen nur lesen
function linkGastFreigabe(array $info, $dokument) {
  if ($dokument === $info['dokument']) return $info['stufe'] === 'lesen' ? 'lesen' : linkStufenRechte($info['stufe'], $info['rechte'] ?? [], $dokument);
  if ($dokument === 'terminfindung' && !empty($info['terminfindung'])) return EINZELRECHTE['terminfindung'];
  return 'lesen';
}

// Alle über Links eingetragenen Personen eines Gremiums: { gastId: herkunftsLink } (für freigabeStufe)
function linkGaesteMerken(array $bundle) {
  $GLOBALS['ormeetGremium'] = $bundle['gremium']; // für die Standardrechte der Rollen (freigabeRoh)
  aufgabenMerken($bundle);
  $GLOBALS['linkGaeste'] = [];
  foreach ($bundle['vorprotokolle'] as $vp) {
    foreach ($vp['gaeste'] as $g) if (!empty($g['ueberLink'])) $GLOBALS['linkGaeste'][$g['id']] = herkunftsLink($bundle, $vp, $g);
  }
}

// Für eine Sitzung gesperrt (Sitzungsleitung / Protokollführung): sieht die Sitzung nicht mehr
function fuerSitzungGesperrt(array $sitzung, $personId) {
  return $personId && in_array($personId, $sitzung['gesperrt'] ?? [], true);
}

// Gast-Link (persönlicher Link eines Gasts oder eine ihm zugeordnete frühere Adresse)
function gastZugriff(array $bundle, array $vp, array $gast, $ref) {
  $sitzung = sitzungVon($bundle, $vp['sitzungId']);
  if ($sitzung && fuerSitzungGesperrt($sitzung, $gast['id'])) return gesperrt('gesperrt');
  $dokument = 'vorprotokoll';
  if (!empty($gast['ueberLink'])) {
    $info = herkunftsLink($bundle, $vp, $gast);
    if (!$info['gibt'] || abgelaufen($info['ablauf'], $sitzung)) return gesperrt('abgelaufen'); // läuft mit dem allgemeinen Link ab
    $dokument = $info['dokument'];
  }
  return ['rolle' => 'freigabe', 'gremiumId' => $bundle['gremium']['id'], 'vorprotokollId' => $vp['id'], 'sitzungId' => $vp['sitzungId'], 'dokument' => $dokument,
          'personId' => $gast['id'], 'personName' => $gast['name'], 'weiterePerson' => !empty($gast['weiterePerson']), 'ref' => $ref];
}

// Persönlicher Link einer Person mit verknüpftem Konto (Mitglied oder Gast): öffnet nur noch über die Anmeldung mit dem
// Konto. Ausnahme: das Kalender-Abo, das den persönlichen Link als Schlüssel nutzt.
function kontoPflicht(array $person) {
  if (empty($person['benutzerId']) || ($GLOBALS['aktion'] ?? '') === 'ical') return null;
  $benutzer = benutzerLesen();
  $i = benutzerById($benutzer, $person['benutzerId']);
  return $i === null ? null : gesperrt('konto', ['name' => $benutzer[$i]['name']]);
}

function mitgliedZugriff(array $bundle, array $m, $ref) {
  if (!empty($m['gesperrt'])) return gesperrt('gesperrt');
  return ['rolle' => 'person', 'gremiumId' => $bundle['gremium']['id'], 'personId' => $m['id'], 'personName' => $m['name'], 'personEmail' => $m['email'] ?? '', 'benutzerId' => $m['benutzerId'] ?? null, 'ref' => $ref];
}

// Zugriff für einen Link-Token (Gremium-Zugang, persönlicher Link, Freigabe, Verfolger, Übersicht); ref benennt den
// Zugang für die Zugriffsübersicht (zuletzt genutzt)
function linkZugriff($token) {
  foreach (alleBundles() as $bundle) {
    $gremiumId = $bundle['gremium']['id'];
    // «Ansehen als …»: befristete Ansicht aus Sicht einer Person, nur lesen
    foreach ($bundle['ansichten'] ?? [] as $a) {
      if (!hash_equals($a['token'], $token) || $a['bis'] < time()) continue;
      $z = null;
      foreach ($bundle['gremium']['mitglieder'] as $m) if ($m['id'] === $a['personId']) $z = mitgliedZugriff($bundle, $m, '');
      foreach ($bundle['vorprotokolle'] as $vp) foreach ($vp['gaeste'] as $g) if ($g['id'] === $a['personId']) $z = gastZugriff($bundle, $vp, $g, '');
      if (!$z || $z['rolle'] === 'gesperrt') return $z;
      unset($z['ref']);
      return $z + ['ansicht' => true, 'nurSitzung' => $a['sitzungId'], 'ansichtName' => personDaten($bundle, $a['personId'])['name']];
    }
    foreach ($bundle['gremium']['zugaenge'] ?? [] as $zugang) {
      if (hash_equals($zugang['key'], $token)) {
        return linkSchutz($bundle, ['rolle' => 'gremium', 'gremiumId' => $gremiumId, 'rechte' => $zugang['rechte'], 'zugangName' => $zugang['name']], $token, 'zugang:' . $zugang['id'], $zugang['ablauf'] ?? '', null, $zugang['name']);
      }
    }
    if (hash_equals($bundle['gremium']['zugangsKey'] ?? '', $token)) {
      return ['rolle' => 'gremium', 'gremiumId' => $gremiumId, 'zugangName' => 'Vollzugriff', 'rechte' => VOLLE_RECHTE];
    }
    foreach ($bundle['gremium']['mitglieder'] as $m) {
      if (hash_equals($m['zugangsKey'] ?? '', $token)) return kontoPflicht($m) ?? mitgliedZugriff($bundle, $m, 'person:' . $m['id']);
    }
    foreach ($bundle['gremium']['themenbereiche'] as $tb) {
      if (hash_equals($tb['freigabeKey'] ?? '', $token)) return ['rolle' => 'themenbereich', 'gremiumId' => $gremiumId, 'themenbereichId' => $tb['id'], 'ref' => 'themenbereich:' . $tb['id']];
    }
    foreach ($bundle['protokolle'] as $protokoll) {
      if (hash_equals($protokoll['verfolgerKey'] ?? '', $token)) return ['rolle' => 'verfolger', 'gremiumId' => $gremiumId, 'protokollId' => $protokoll['id'], 'ref' => 'verfolger:' . $protokoll['id']];
    }
    foreach ($bundle['sitzungen'] as $s) {
      foreach ($s['links'] ?? [] as $l) {
        if ($l['key'] !== '' && hash_equals($l['key'], $token)) {
          $zugriff = ['rolle' => 'link', 'gremiumId' => $gremiumId, 'sitzungId' => $s['id'], 'linkId' => $l['id'], 'linkName' => $l['name'],
                      'dokument' => $l['dokument'], 'stufe' => $l['stufe'], 'rechte' => array_values(array_intersect($l['rechte'] ?? [], EINZELRECHTE[$l['dokument']] ?? []))];
          return linkSchutz($bundle, $zugriff, $token, 'link:' . $l['id'], $l['ablauf'] ?? '', $s, $l['name']);
        }
      }
    }
    foreach ($bundle['vorprotokolle'] as $vorprotokoll) {
      if (hash_equals($vorprotokoll['freigabeLinkKey'], $token)) {
        $link = freigabeLinkObjekt($vorprotokoll);
        $zugriff = ['rolle' => 'freigabe', 'gremiumId' => $gremiumId, 'vorprotokollId' => $vorprotokoll['id'], 'sitzungId' => $vorprotokoll['sitzungId'],
                    'linkId' => 'freigabe', 'dokument' => 'vorprotokoll', 'stufe' => $link['stufe'], 'rechte' => $link['rechte']];
        return linkSchutz($bundle, $zugriff, $token, 'freigabe:' . $vorprotokoll['id'], $vorprotokoll['freigabeLinkAblauf'] ?? '', sitzungVon($bundle, $vorprotokoll['sitzungId']), 'Allgemeiner Link');
      }
      $gaeste = indexById($vorprotokoll['gaeste']);
      foreach ($vorprotokoll['personenKeys'] ?? [] as $personId => $key) {
        if (hash_equals($key, $token)) return kontoPflicht($gaeste[$personId] ?? []) ?? gastZugriff($bundle, $vorprotokoll, $gaeste[$personId] ?? personDaten($bundle, $personId), 'person:' . $personId);
      }
      // Frühere Adresse einer zusammengeführten Person: öffnet als die Person, mit der sie zusammengeführt wurde
      foreach ($vorprotokoll['aliasKeys'] ?? [] as $key => $personId) {
        if (!hash_equals((string) $key, $token)) continue;
        if (isset($gaeste[$personId])) return kontoPflicht($gaeste[$personId]) ?? gastZugriff($bundle, $vorprotokoll, $gaeste[$personId], 'person:' . $personId);
        foreach ($bundle['gremium']['mitglieder'] as $m) if ($m['id'] === $personId) return kontoPflicht($m) ?? mitgliedZugriff($bundle, $m, 'person:' . $personId);
      }
    }
  }
  return null;
}

// Zugriff für einen Konto-Token
function kontoZugriff($token, array $benutzer) {
  foreach ($benutzer as $b) {
    foreach ($b['anmeldungen'] as $a) {
      if (hash_equals($a['token'], $token)) {
        return ['rolle' => 'benutzer', 'benutzerId' => $b['id'], 'name' => $b['name'], 'email' => $b['email'], 'darfGremienAnlegen' => $b['darfGremienAnlegen'],
                'darfKurzsitzungenAnlegen' => !empty($b['darfKurzsitzungenAnlegen']),
                'hatPasswort' => $b['passwortHash'] !== '', 'sso' => array_keys($b['sso']), 'mailsAus' => !empty($b['mailsAus']), 'gremien' => benutzerGremien($b['id'], $b['email'])];
      }
    }
  }
  return null;
}

$zugriff = null;
if ($token !== '') $zugriff = superadminZugriff($token) ?? kontoZugriff($token, benutzerLesen()) ?? linkZugriff($token);

// Ansicht als eine Person: nur laden
if ($zugriff && !empty($zugriff['ansicht']) && $aktion !== 'laden') antwort(['fehler' => 'In der Ansicht als andere Person lässt sich nichts ändern'], 403);

// Gesperrter Link (Passwort fehlt, abgelaufen, Zugang gesperrt): nur das Passwort eingeben; Anmelden bleibt möglich
if ($zugriff && $zugriff['rolle'] === 'gesperrt' && !in_array($aktion, ['sso_anbieter', 'anmelden', 'sso_start', 'sso_callback', 'passwort_vergessen', 'passwort_zuruecksetzen', 'cron', 'abbestellen', 'einladung_info', 'einladung_antworten', 'einladung_abbestellen'], true)) {
  if ($aktion === 'link_entsperren' && $zugriff['grund'] === 'passwort') {
    anmeldeSperrePruefen();
    $hash = lesen(dateiVon($zugriff['gremiumId']))['linkSchutz'][$zugriff['ref']] ?? '';
    if ($hash === '' || !password_verify((string) ($eingabe['passwort'] ?? ''), $hash)) fehlversuch('Das Passwort stimmt nicht');
    antwort(['freischaltung' => freischaltung($token, $hash)]);
  }
  $texte = ['passwort' => 'Dieser Link ist mit einem Passwort geschützt', 'abgelaufen' => 'Dieser Link ist abgelaufen', 'gesperrt' => 'Dieser Zugang ist gesperrt',
            'konto' => 'Dieser Link gehört zu einem Konto – bitte anmelden'];
  antwort(['fehler' => $texte[$zugriff['grund']], 'gesperrt' => $zugriff['grund'], 'name' => $zugriff['name'] ?? ''], 403);
}

// --- Konto: Anmelden, Registrieren, SSO (ohne gültigen Token erreichbar) ---------------
function tokenAntwort(array $benutzer, $i) {
  $token = anmeldungAnlegen($benutzer[$i]);
  benutzerSchreiben($benutzer);
  antwort(['token' => $token]);
}

// Persönlicher Link als Token: dieses Mitglied mit dem Konto verknüpfen
// Allgemeiner Link (Freigabe ohne Person oder zusätzlicher Link): das Konto kommt als «weitere Person» zur Sitzung
// Über einen allgemeinen Link eingetragene Person (eigener Gast-Link): das Konto wird ihr zugeordnet
function linkVerknuepfen($zugriff, $benutzerId, $name = '', $email = '', array $namen = []) {
  if ($zugriff && $zugriff['rolle'] === 'person') mitgliedVerknuepfen($zugriff['gremiumId'], $zugriff['personId'], $benutzerId);
  if ($zugriff && ($zugriff['rolle'] === 'link' || ($zugriff['rolle'] === 'freigabe' && !isset($zugriff['personId'])))) {
    weiterePersonAnlegen($zugriff, $benutzerId, $name, $email, $namen);
  }
  if ($zugriff && $zugriff['rolle'] === 'freigabe' && isset($zugriff['personId']) && !empty($zugriff['weiterePerson'])) {
    bundleAendern($zugriff['gremiumId'], function (array &$bundle) use ($zugriff, $benutzerId) {
      foreach ($bundle['vorprotokolle'] as &$vp) {
        foreach ($vp['gaeste'] as &$g) if ($g['id'] === $zugriff['personId'] && empty($g['benutzerId'])) $g['benutzerId'] = $benutzerId;
      }
    });
  }
}

// Vorprotokoll einer Sitzung (Index); fehlt es noch, entsteht ein leeres
function vorprotokollFuer(array &$bundle, $sitzungId) {
  foreach ($bundle['vorprotokolle'] as $i => $vp) if ($vp['sitzungId'] === $sitzungId) return $i;
  $erwartete = array_values(array_filter(array_column($bundle['gremium']['mitglieder'], 'id'), fn($id) => istErwartet($bundle['gremium'], $id)));
  $bundle['vorprotokolle'][] = ['id' => uuid(), 'sitzungId' => $sitzungId, 'freigabeLinkKey' => bin2hex(random_bytes(8)), 'personenKeys' => [],
                                'gaeste' => [], 'anwesendeMitgliederIds' => $erwartete, 'traktanden' => []];
  return count($bundle['vorprotokolle']) - 1;
}

// Namentliche Stimmen und Kommentare ohne Person (in diesem Browser unter $namen abgegeben) gehen auf die Person über
function namenUebertragen(array &$bundle, $sitzungId, $personId, $name, array $namen) {
  foreach ($bundle['sitzungen'] as &$s) {
    if ($s['id'] !== $sitzungId || empty($s['terminfindung'])) continue;
    foreach ($s['terminfindung']['stimmen'] as &$st) if (empty($st['personId']) && in_array($st['name'], $namen, true)) { $st['personId'] = $personId; $st['name'] = $name; }
    unset($st);
    foreach ($s['terminfindung']['kommentare'] as &$k) if (empty($k['personId']) && in_array($k['name'], $namen, true)) $k['personId'] = $personId;
    unset($k);
  }
}

// Gleicher Name oder gleiche E-Mail wie ein Mitglied oder ein Gast der Sitzung? (Gross-/Kleinschreibung und Leerzeichen zählen nicht)
function doppelteSuchen(array $bundle, array $vp, $name, $email) {
  $klein = fn($text) => function_exists('mb_strtolower') ? mb_strtolower($text, 'UTF-8') : strtolower($text); // mbstring fehlt auf manchen Hostings
  $gleich = fn($a, $b) => $a !== '' && $klein(preg_replace('/\s+/u', ' ', trim($a))) === $klein(preg_replace('/\s+/u', ' ', trim($b)));
  $personen = array_merge($bundle['gremium']['mitglieder'], $vp['gaeste']);
  foreach (['email', 'name'] as $grund) {
    foreach ($personen as $p) {
      if ($gleich($grund === 'email' ? $email : $name, (string) ($p[$grund] ?? ''))) return ['personId' => $p['id'], 'grund' => $grund, 'status' => 'offen'];
    }
  }
  return null;
}

// Gremium-Datei mit Sperre lesen, ändern und schreiben
function bundleAendern($gremiumId, callable $aendern) {
  $handle = fopen(dateiVon($gremiumId), 'c+');
  flock($handle, LOCK_EX);
  $bundle = json_decode(entschluesseln(stream_get_contents($handle)), true);
  if ($bundle) {
    kontoAngabenUebernehmen($bundle);
    aufgabenMerken($bundle);
  }
  $ergebnis = $bundle ? $aendern($bundle) : null;
  if ($bundle) {
    ftruncate($handle, 0);
    rewind($handle);
    fwrite($handle, verschluesseln(json_encode(normalisiere($bundle), JSON_UNESCAPED_UNICODE)));
  }
  flock($handle, LOCK_UN);
  fclose($handle);
  return $ergebnis;
}

// Konto über einen allgemeinen Link: als Gast der Sitzung eintragen (gekennzeichnet als weitere Person, mit Konto).
// Fehlt das Vorprotokoll noch, entsteht ein leeres. Namentliche Stimmen und Kommentare, die in diesem Browser ohne
// Konto abgegeben wurden ($namen), gehen auf die neue Person über. Ist das Konto schon Mitglied, ändert sich nichts.
function weiterePersonAnlegen(array $zugriff, $benutzerId, $name, $email, array $namen) {
  bundleAendern($zugriff['gremiumId'], function (array &$bundle) use ($zugriff, $benutzerId, $name, $email, $namen) {
    foreach ($bundle['gremium']['mitglieder'] as $m) if (($m['benutzerId'] ?? null) === $benutzerId) return;
    $sitzungId = $zugriff['sitzungId'] ?? null;
    $vpIndex = vorprotokollFuer($bundle, $sitzungId);
    $vp = &$bundle['vorprotokolle'][$vpIndex];
    foreach ($vp['gaeste'] as $gast) if (($gast['benutzerId'] ?? null) === $benutzerId) return;
    $gastId = uuid();
    $vp['gaeste'][] = ['id' => $gastId, 'name' => $name, 'organisation' => '', 'email' => $email, 'benutzerId' => $benutzerId, 'weiterePerson' => true,
                       'ueberLink' => $zugriff['rolle'] === 'link' ? $zugriff['linkId'] : 'freigabe'];
    $vp['personenKeys'] = (array) ($vp['personenKeys'] ?? []);
    $vp['personenKeys'][$gastId] = bin2hex(random_bytes(8));
    unset($vp);
    namenUebertragen($bundle, $sitzungId, $gastId, $name, $namen);
  });
}

if ($aktion === 'sso_anbieter') {
  antwort(['anbieter' => array_map(fn($a) => $a['name'], ssoAktiv())]);
}

if ($aktion === 'anmelden') {
  anmeldeSperrePruefen();
  $email = trim((string) ($eingabe['email'] ?? ''));
  $passwort = (string) ($eingabe['passwort'] ?? '');
  if ($email === '') {
    // Superadmin: Passwort gegen einen Token tauschen
    if (!hash_equals(ADMIN_PASSWORT, $passwort)) fehlversuch('Das Passwort stimmt nicht');
    $superadmin = superadminLesen();
    $neuerToken = anmeldungAnlegen($superadmin);
    jsonSchreiben(SUPERADMIN_DATEI, $superadmin);
    antwort(['token' => $neuerToken]);
  }
  $benutzer = benutzerLesen();
  $i = benutzerByEmail($benutzer, $email);
  if ($i === null || $benutzer[$i]['passwortHash'] === '' || !password_verify($passwort, $benutzer[$i]['passwortHash'])) fehlversuch('E-Mail oder Passwort stimmt nicht');
  linkVerknuepfen($zugriff, $benutzer[$i]['id'], $benutzer[$i]['name'], $benutzer[$i]['email'], array_map('strval', (array) ($eingabe['namen'] ?? [])));
  tokenAntwort($benutzer, $i);
}

if ($aktion === 'registrieren') {
  // Nur über einen persönlichen oder allgemeinen Link (oder durch den Superadmin) – so gehört jedes Konto zu einer Sitzung
  $allgemein = $zugriff && ($zugriff['rolle'] === 'link' || ($zugriff['rolle'] === 'freigabe' && (!isset($zugriff['personId']) || !empty($zugriff['weiterePerson']))));
  if (!$zugriff || (!$allgemein && !in_array($zugriff['rolle'], ['person', 'admin'], true))) antwort(['fehler' => 'Ein Konto kann nur über einen persönlichen oder allgemeinen Link erstellt werden'], 403);
  $email = trim($eingabe['email'] ?? '');
  $name = trim($eingabe['name'] ?? '');
  $passwort = $eingabe['passwort'] ?? '';
  if (!filter_var($email, FILTER_VALIDATE_EMAIL)) antwort(['fehler' => 'Bitte eine gültige E-Mail-Adresse angeben'], 400);
  if ($name === '') antwort(['fehler' => 'Bitte einen Namen angeben'], 400);
  if (strlen($passwort) < 8) antwort(['fehler' => 'Das Passwort braucht mindestens 8 Zeichen'], 400);
  $benutzer = benutzerLesen();
  if (benutzerByEmail($benutzer, $email) !== null) antwort(['fehler' => 'Mit dieser E-Mail gibt es schon ein Konto – bitte anmelden'], 409);
  $neu = neuerBenutzer($name, $email);
  $neu['passwortHash'] = password_hash($passwort, PASSWORD_DEFAULT);
  $benutzer[] = $neu;
  linkVerknuepfen($zugriff, $neu['id'], $name, $email, array_map('strval', (array) ($eingabe['namen'] ?? [])));
  if ($zugriff['rolle'] === 'admin') {
    benutzerSchreiben($benutzer);
    antwort(['ok' => true, 'benutzer' => benutzerOeffentlich($neu)]);
  }
  tokenAntwort($benutzer, count($benutzer) - 1);
}

// Passwort vergessen: Link zum Zurücksetzen per E-Mail (gilt eine Stunde, nur einmal). Die Antwort ist immer dieselbe –
// so lässt sich nicht herausfinden, ob es zu einer E-Mail ein Konto gibt. Gespeichert wird nur ein Hash des Links.
if ($aktion === 'passwort_vergessen') {
  anmeldeSperrePruefen();
  versuchMerken();
  $email = trim((string) ($eingabe['email'] ?? ''));
  $benutzer = benutzerLesen();
  $i = filter_var($email, FILTER_VALIDATE_EMAIL) ? benutzerByEmail($benutzer, $email) : null;
  if ($i !== null) {
    $code = bin2hex(random_bytes(24));
    $benutzer[$i]['passwortReset'] = ['hash' => hash('sha256', $code), 'bis' => time() + 3600];
    benutzerSchreiben($benutzer);
    $text = "Hallo {$benutzer[$i]['name']}

Für dein Ormeet-Konto wurde ein neues Passwort angefordert. Über diesen Link legst du es fest (gültig während einer Stunde):

"
      . basisUrl() . "#/passwort/$code

Hast du nichts angefordert, kannst du diese Nachricht ignorieren – dein Passwort bleibt, wie es ist.

Ormeet";
    $fehler = mailSenden($benutzer[$i]['email'], 'Ormeet: neues Passwort festlegen', $text);
    if ($fehler) error_log('Ormeet Passwort vergessen: ' . $fehler);
  }
  antwort(['ok' => true]);
}

// Neues Passwort über den Link aus der E-Mail: alle Geräte werden abgemeldet, dieses angemeldet
if ($aktion === 'passwort_zuruecksetzen') {
  anmeldeSperrePruefen();
  $hash = hash('sha256', (string) ($eingabe['code'] ?? ''));
  $passwort = (string) ($eingabe['passwort'] ?? '');
  $benutzer = benutzerLesen();
  $i = null;
  foreach ($benutzer as $k => $b) if (isset($b['passwortReset']) && hash_equals($b['passwortReset']['hash'], $hash) && $b['passwortReset']['bis'] >= time()) $i = $k;
  if ($i === null) fehlversuch('Dieser Link ist abgelaufen oder wurde schon verwendet – bitte einen neuen anfordern');
  if (strlen($passwort) < 8) antwort(['fehler' => 'Das Passwort braucht mindestens 8 Zeichen'], 400);
  $benutzer[$i]['passwortHash'] = password_hash($passwort, PASSWORD_DEFAULT);
  unset($benutzer[$i]['passwortReset']);
  $benutzer[$i]['anmeldungen'] = [];
  tokenAntwort($benutzer, $i);
}

// --- Automatische E-Mails (Cronjob) -----------------------------------
// Ein Cronjob ruft api.php?aktion=cron&schluessel=… regelmässig auf (z. B. stündlich). Ab der eingestellten Stunde
// erhält jedes Konto höchstens eine Sammelmail pro Tag mit den Mitteilungen, die es noch nicht per E-Mail bekommen hat
// (wie die Glocke in Ormeet) – nur wenn es etwas Neues gibt. Beim ersten Lauf gilt der bisherige Stand als bekannt.
const CRON_DATEI = DATEN_ORDNER . '/cron.json';   // letzter Lauf, Anzahl Mails, Fehler
const MAILS_DATEI = DATEN_ORDNER . '/mails.json'; // pro Konto: schon gemeldete Mitteilungen und Tag der letzten Mail

function zuerichHeute($offset = 0) {
  return (new DateTimeImmutable('now', new DateTimeZone('Europe/Zurich')))->modify("$offset day")->format('Y-m-d');
}

function tageBis($datum) {
  return (int) round((strtotime($datum) - strtotime(zuerichHeute())) / 86400);
}

function inTagenText($d) {
  return $d === 0 ? 'heute' : ($d === 1 ? 'morgen' : "in $d Tagen");
}

function datumText($iso) {
  return $iso ? date('j.n.Y', strtotime($iso)) : '';
}

function sitzungText(array $s) {
  return '«' . ($s['titel'] ?: 'Sitzung') . '»' . (!empty($s['datum']) ? ' vom ' . datumText($s['datum']) : '');
}

// Alle Punkte und Unterpunkte (für zugewiesene Traktanden)
function allePunkteListe(array $liste) {
  $alle = [];
  foreach ($liste as $t) {
    $alle[] = $t;
    $alle = array_merge($alle, allePunkteListe($t['untertraktanden'] ?? []));
  }
  return $alle;
}

// Mitteilungen eines Kontos in einem Gremium (wie die Glocke in Ormeet): [id => [text, pfad]]
function kontoMitteilungen(array $bundle, array $g) {
  $liste = [];
  $melde = function ($id, $text, $pfad) use (&$liste) { $liste[$id] = [$text, $pfad]; };
  $gremium = $bundle['gremium'];
  $verwaltet = $g['rolle'] === 'eigentuemer';
  $personId = $g['personId'] ?? null;
  $person = $personId ? personDaten($bundle, $personId) : null;
  $erwartet = $person && $g['rolle'] === 'mitglied' && istErwartet($gremium, $personId);
  $festeRolle = $person && $g['rolle'] === 'mitglied' && (hatFesteRolle($gremium, $person) || !empty(rolleRechte($gremium, $personId)['zugriffe']));
  $tage = max(0, (int) ($gremium['erinnerungTage'] ?? 3));
  $vorprotokolle = [];
  foreach ($bundle['vorprotokolle'] as $vp) $vorprotokolle[$vp['sitzungId']] = $vp;
  $protokolle = [];
  foreach ($bundle['protokolle'] as $p) $protokolle[$p['sitzungId']] = $p;

  foreach ($bundle['sitzungen'] as $s) {
    if ($g['rolle'] === 'gast' && $s['id'] !== $g['sitzungId']) continue;
    if (fuerSitzungGesperrt($s, $personId)) continue;
    $vp = $vorprotokolle[$s['id']] ?? null;
    $p = $protokolle[$s['id']] ?? null;
    $leitung = $person && istLeitung($s, $personId);
    if (!empty($s['kurz']) && !$verwaltet && !$leitung) {
      $teilnehmende = $p['anwesende'] ?? $vp['anwesendeMitgliederIds'] ?? [];
      if (!in_array($personId, $teilnehmende, true)) continue;
    }
    $name = sitzungText($s);
    $tf = $s['terminfindung'] ?? null;
    $beteiligt = $tf && $person && in_array($personId, array_column($tf['stimmen'], 'personId'), true);
    $entfernt = $tf && in_array($personId, $tf['entfernt'] ?? [], true);
    $basis = '/sitzung/' . $s['id'];

    if ($tf && $tf['status'] === 'offen') {
      if ($person && !$beteiligt && !$entfernt) $melde("abstimmen:{$s['id']}", "Terminfindung $name: deine Stimme fehlt noch", "$basis/terminfindung");
      if ($verwaltet || $leitung) {
        $alle = array_filter(array_column($gremium['mitglieder'], 'id'), fn($id) => istErwartet($gremium, $id));
        $gestimmt = array_column($tf['stimmen'], 'personId');
        if ($alle && !array_diff($alle, $gestimmt)) $melde("abgestimmt:{$s['id']}:" . count($tf['stimmen']), "Terminfindung $name: alle haben abgestimmt – Termin festlegen", "$basis/terminfindung");
      }
      if ($verwaltet || $leitung || $beteiligt) {
        foreach ($tf['kommentare'] as $k) if (($k['personId'] ?? null) !== $personId) $melde("kommentar:{$k['id']}", ($k['name'] ?: 'Jemand') . " hat die Terminfindung $name kommentiert", "$basis/terminfindung");
      }
    }
    if ($tf && $tf['status'] === 'abgeschlossen' && !empty($s['datum']) && ($beteiligt || $erwartet)) {
      $melde("termin:{$s['id']}:{$s['datum']}", "Termin festgelegt: $name" . (!empty($s['zeit']) ? ', ' . $s['zeit'] : ''), "$basis/vorprotokoll");
    }
    if (($s['status'] ?? '') === 'abgeschlossen') {
      if ($p && ($erwartet || $leitung || in_array($personId, $p['anwesende'] ?? [], true))) $melde("protokoll:{$p['id']}", "Das Protokoll $name ist abgeschlossen", "$basis/protokoll");
    } else {
      if (!empty($s['datum']) && ($verwaltet || $erwartet || $leitung) && !$entfernt) {
        $d = tageBis($s['datum']);
        if ($d >= 0 && $d <= $tage) $melde("bald:{$s['id']}:{$s['datum']}", "Sitzung $name findet " . inTagenText($d) . ' statt' . (!empty($s['zeit']) ? ' (' . $s['zeit'] . ')' : ''), $basis . ($p ? '/protokoll' : '/vorprotokoll'));
      }
      if ($leitung) $melde("leitung:{$s['id']}", "Du bist Sitzungsleitung / Protokollführung der Sitzung $name", "$basis/vorprotokoll");
      if ($person && $vp && !$leitung) {
        foreach ($vp['traktanden'] as $t) {
          $haupt = istBerechtigt($t, $person);
          if ($haupt) $melde("traktandum:{$t['id']}", "Traktandum «{$t['titel']}» ist dir zugewiesen ($name)", "$basis/vorprotokoll");
          foreach (allePunkteListe($t['untertraktanden'] ?? []) as $u) {
            if (!$haupt && istBerechtigt($u, $person)) $melde("traktandum:{$u['id']}", "Unterpunkt «{$u['titel']}» ist dir zugewiesen ($name)", "$basis/vorprotokoll");
          }
        }
      }
    }
    if ($p && $person && empty($s['genehmigt'])) {
      $fuehrt = in_array($personId, array_column(array_merge($s['sitzungsleitung'] ?? [], $s['protokollfuehrung'] ?? []), 'id'), true);
      foreach ($p['aenderungsantraege'] ?? [] as $a) {
        $ziel = "$basis/protokoll?zu=" . ($a['zielId'] ?? '');
        if ($fuehrt && $a['status'] === 'offen') $melde("aenderung:{$a['id']}", "{$a['name']} beantragt eine Änderung zu «{$a['zielText']}» ($name)", $ziel);
        if (($a['personId'] ?? null) === $personId && $a['status'] !== 'offen') $melde("aenderung:{$a['id']}:{$a['status']}", "Dein Änderungsantrag zu «{$a['zielText']}» wurde " . ($a['status'] === 'uebernommen' ? 'übernommen' : 'abgelehnt'), $ziel);
      }
    }
    if ($p && $person) {
      foreach ($p['eintraege'] as $e) {
        if ($e['typ'] !== 'pendenz' || ($e['zugewiesenAn'] ?? null) !== $personId || ($e['pendenzStatus'] ?? '') === 'erfuellt') continue;
        $melde("pendenz:{$e['id']}", "Neue Pendenz für dich: «{$e['titel']}»", "$basis/protokoll");
        $frist = fristDatum($bundle, $e, $s['id']);
        if ($frist === '') continue;
        $d = tageBis($frist);
        if ($d < 0) $melde("ueberfaellig:{$e['id']}:$frist", "Pendenz «{$e['titel']}» ist seit " . datumText($frist) . ' überfällig', "$basis/protokoll");
        elseif ($d <= 7) $melde("faellig:{$e['id']}:$frist", "Pendenz «{$e['titel']}» ist " . inTagenText($d) . ' fällig', "$basis/protokoll");
      }
    }
    if ($vp && ($verwaltet || $leitung || $festeRolle)) {
      foreach ($vp['gaeste'] as $gast) {
        if (($gast['vorschlag']['status'] ?? '') === 'offen') $melde("vorschlag:{$gast['id']}", "«{$gast['name']}» hat sich bei $name eingetragen – vielleicht dieselbe Person wie eine bereits erfasste. Bitte prüfen.", ($verwaltet || $leitung) ? "$basis/zugriffe" : "$basis/terminfindung");
      }
    }
  }
  return $liste;
}

// Abbestellen ohne Anmeldung: Link mit Konto-ID und Signatur
function abbestellSignatur($benutzerId) {
  return substr(hash_hmac('sha256', 'abbestellen|' . $benutzerId, schluessel()), 0, 32);
}

// Ein Cron-Lauf: Sammelmails an alle Konten, die heute noch keine erhalten haben (ab der eingestellten Stunde)
function cronLauf() {
  $e = einstellungenLesen();
  $basis = $e['basisUrl'] ?? (PHP_SAPI === 'cli' ? '' : basisUrl()); // auf der Kommandozeile ist die Adresse nur aus den Einstellungen bekannt
  $jetzt = new DateTimeImmutable('now', new DateTimeZone('Europe/Zurich'));
  $heute = $jetzt->format('Y-m-d');
  $status = ['letzterLauf' => $jetzt->format('c'), 'mails' => 0, 'fehler' => ''];
  if ((int) $jetzt->format('G') < (int) ($e['mailStunde'] ?? 7)) {
    jsonSchreiben(CRON_DATEI, $status + ['hinweis' => 'Vor der Versandzeit – noch nichts verschickt']);
    return $status;
  }
  $mails = jsonLesen(MAILS_DATEI, []);
  $bundles = [];
  foreach (alleBundles() as $b) $bundles[$b['gremium']['id']] = $b;
  foreach (benutzerLesen() as $b) {
    $stand = $mails[$b['id']] ?? null;
    if (!empty($b['mailsAus']) || ($stand['tag'] ?? '') === $heute) continue;
    $neu = [];
    foreach (benutzerGremien($b['id'], $b['email']) as $g) {
      $bundle = $bundles[$g['gremiumId']] ?? null;
      if (!$bundle) continue;
      linkGaesteMerken($bundle);
      foreach (kontoMitteilungen($bundle, $g) as $id => $m) $neu[$g['gremiumId'] . '|' . $id] = [$g['name'], $m[0], $m[1]];
    }
    $erster = $stand === null;
    if ($erster) { // erster Lauf (auch für neue Konten): nur Wichtiges gleich verschicken, Älteres gilt als bekannt
      $wichtig = fn($k) => preg_match('/\|(bald|abstimmen|pendenz|traktandum):/', $k);
      $stand = ['gesendet' => array_values(array_filter(array_keys($neu), fn($k) => !$wichtig($k))), 'tag' => ''];
      $mails[$b['id']] = $stand;
    }
    $bekannt = array_flip($stand['gesendet']);
    $offen = array_diff_key($neu, $bekannt);
    if (!$offen) continue;
    $text = "Hallo {$b['name']}\n\n" . ($erster ? 'Das steht in Ormeet für dich an:' : 'Das ist neu in Ormeet:') . "\n";
    $gruppe = null;
    foreach ($offen as [$gremiumName, $mitteilung, $pfad]) {
      if ($gremiumName !== $gruppe) $text .= "\n" . ($gruppe = $gremiumName) . "\n";
      $text .= "- $mitteilung\n  $basis#$pfad\n";
    }
    $text .= "\nE-Mails von Ormeet abbestellen: {$basis}api.php?aktion=abbestellen&k={$b['id']}." . abbestellSignatur($b['id']) . "\n";
    $fehler = mailSenden($b['email'], 'Ormeet: ' . count($offen) . (count($offen) === 1 ? ' neue Mitteilung' : ' neue Mitteilungen'), $text);
    if ($fehler) { $status['fehler'] = $fehler; continue; }
    $status['mails']++;
    $mails[$b['id']] = ['gesendet' => array_slice(array_keys($neu + array_flip($stand['gesendet'])), -3000), 'tag' => $heute];
  }
  jsonSchreiben(MAILS_DATEI, $mails);
  jsonSchreiben(CRON_DATEI, $status);
  return $status;
}

// cron.php: auf der Kommandozeile ohne, per Adresse mit Schlüssel; Ausgabe als Text fürs Protokoll des Hosters
if ($aktion === 'cron' && defined('ORMEET_CRON')) {
  header('Content-Type: text/plain; charset=utf-8');
  $e = einstellungenLesen();
  if (PHP_SAPI !== 'cli' && (empty($e['cronSchluessel']) || !hash_equals($e['cronSchluessel'], (string) ($_GET['schluessel'] ?? '')))) {
    http_response_code(403);
    exit("forbidden\n");
  }
  @set_time_limit(300);
  $lauf = cronLauf();
  echo 'Ormeet Cron – ' . str_replace('T', ' ', substr($lauf['letzterLauf'], 0, 19)) . "\n  Mails      {$lauf['mails']}\n";
  if (!empty($lauf['hinweis'])) echo "  Hinweis    {$lauf['hinweis']}\n";
  if ($lauf['fehler'] !== '') echo "  Fehler     {$lauf['fehler']}\n";
  exit(0);
}

// Angaben für den Cronjob (Einstellungen): ganze Zeile, Einzelfelder für Hosting-Oberflächen, Adresse ohne Shell-Zugang
function phpPfad() {
  $bin = PHP_BINARY;
  if ($bin && !preg_match('/fpm|cgi|apache|httpd|litespeed|lsphp/i', basename($bin))) return $bin;
  return is_file(PHP_BINDIR . '/php') ? PHP_BINDIR . '/php' : 'php';
}

function cronAngaben(array $e) {
  $lauf = jsonLesen(CRON_DATEI, []) ?: null;
  $alter = $lauf ? time() - strtotime($lauf['letzterLauf']) : null;
  $skript = __DIR__ . '/cron.php';
  $befehl = phpPfad() . ' ' . $skript;
  $intervall = '0 * * * *';
  $adresse = basisUrl() . 'cron.php';
  return [
    'zustand' => $lauf === null ? 'fehlt' : ($alter <= 2 * 3600 ? 'aktiv' : 'gestoppt'),
    'lauf' => $lauf,
    'warnungen' => array_values(array_filter([
      is_file($skript) ? '' : 'Die Datei cron.php fehlt im Ormeet-Ordner. Bitte die aktuelle Version installieren.',
      mailEinstellungen()['absender'] === '' ? 'Es ist noch keine Absender-Adresse eingetragen (E-Mail-Versand). Ohne landen Mails eher im Spam.' : '',
    ])),
    'zeile' => "$intervall $befehl >/dev/null 2>&1",
    'intervall' => $intervall,
    'befehl' => $befehl,
    'skript' => $skript,
    'url' => $adresse . '?schluessel=' . $e['cronSchluessel'],
    'adresse' => $adresse,
    'argumente' => 'schluessel=' . $e['cronSchluessel'],
  ];
}

if ($aktion === 'abbestellen') {
  [$id, $signatur] = array_pad(explode('.', (string) ($_GET['k'] ?? ''), 2), 2, '');
  $benutzer = benutzerLesen();
  $i = benutzerById($benutzer, $id);
  $ok = $i !== null && hash_equals(abbestellSignatur($id), $signatur);
  if ($ok) {
    $benutzer[$i]['mailsAus'] = true;
    benutzerSchreiben($benutzer);
  }
  header('Content-Type: text/html; charset=utf-8');
  echo '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Ormeet</title>'
    . '<body style="font-family: system-ui, sans-serif; max-width: 32rem; margin: 3rem auto; padding: 0 1rem; line-height: 1.5">'
    . ($ok ? '<h1>Abbestellt</h1><p>Du erhältst keine E-Mails mit Mitteilungen von Ormeet mehr. Unter «Mein Konto» kannst du sie jederzeit wieder einschalten.</p>'
           : '<h1>Link ungültig</h1><p>Dieser Link zum Abbestellen stimmt nicht. Unter «Mein Konto» kannst du die E-Mails ausschalten.</p>')
    . '</body>';
  exit;
}

// --- Einladungen per E-Mail ----------------------------------------
// bundle.einladungen[sitzungId][personId] = { gesendet: [{ art, am }], antwort: '' | zugesagt | abgesagt, grund, antwortAm }
// bundle.einladungenAus = [E-Mail-Adressen, klein], die keine Einladungen dieses Gremiums mehr wollen.
// Beides setzt nur der Server; ausgeliefert wird es nur an Verwaltende (bereinigen). Ohne Antwort gilt eine Einladung
// als angenommen; eine Absage (nur mit Grund) trägt ein Mitglied aus der Anwesenheit aus – bis die Sitzung beginnt.
// Höchstens $n Zeichen (UTF-8, ohne mbstring – fehlt auf manchen Hostings)
function textKuerzen($text, $n) {
  return preg_match('/^.{0,' . (int) $n . '}/su', $text, $treffer) ? $treffer[0] : substr($text, 0, $n);
}

function einladungCode($gremiumId, $sitzungId, $personId) {
  $signatur = substr(hash_hmac('sha256', "einladung|$gremiumId|$sitzungId|$personId", schluessel()), 0, 32);
  return "$gremiumId.$sitzungId.$personId.$signatur";
}

// Code aus der Mail prüfen -> [gremiumId, sitzungId, personId] oder Abbruch
function einladungAusCode($code) {
  $teile = explode('.', (string) $code);
  if (count($teile) !== 4 || !preg_match('/^[0-9a-f-]{36}$/', $teile[0]) || !hash_equals(einladungCode($teile[0], $teile[1], $teile[2]), (string) $code)) {
    antwort(['fehler' => 'Dieser Link ist ungültig.'], 404);
  }
  return array_slice($teile, 0, 3);
}

function einladungTermin(array $s) {
  $tage = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  return $tage[(int) date('w', strtotime($s['datum']))] . ', ' . datumText($s['datum']) . (!empty($s['zeit']) ? ', ' . $s['zeit'] . ' Uhr' : '');
}

// Persönlicher Link: Mitglied über seinen zentralen Link, Gast über seinen Gast-Link
function einladungLink(array $bundle, array $vp, $personId, $basis) {
  foreach ($bundle['gremium']['mitglieder'] as $m) if ($m['id'] === $personId) return !empty($m['zugangsKey']) ? $basis . '#/zugang/' . $m['zugangsKey'] : '';
  $key = ((array) ($vp['personenKeys'] ?? []))[$personId] ?? '';
  return $key !== '' ? $basis . '#/freigabe/' . $key : '';
}

if ($aktion === 'einladung_info') {
  [$gid, $sid, $pid] = einladungAusCode($eingabe['code'] ?? $_GET['code'] ?? '');
  $bundle = lesen(dateiVon($gid));
  $s = $bundle ? sitzungVon($bundle, $sid) : null;
  $person = $bundle ? personDaten($bundle, $pid) : ['name' => ''];
  if (!$s || $person['name'] === '') antwort(['fehler' => 'Diese Sitzung gibt es nicht mehr.'], 404);
  $e = $bundle['einladungen'][$sid][$pid] ?? [];
  antwort([
    'gremium' => $bundle['gremium']['name'], 'titel' => $s['titel'] ?: 'Sitzung', 'termin' => $s['datum'] ? einladungTermin($s) : '', 'ort' => $s['ort'] ?? '',
    'name' => $person['name'], 'antwort' => $e['antwort'] ?? '', 'grund' => $e['grund'] ?? '',
    'offen' => !protokollVon($bundle, $sid), 'abgemeldet' => in_array(strtolower($person['email'] ?? ''), $bundle['einladungenAus'] ?? [], true),
  ]);
}

if ($aktion === 'einladung_antworten') {
  [$gid, $sid, $pid] = einladungAusCode($eingabe['code'] ?? '');
  $neu = (string) ($eingabe['antwort'] ?? '');
  $grund = trim((string) ($eingabe['grund'] ?? ''));
  if (!in_array($neu, ['zugesagt', 'abgesagt'], true)) antwort(['fehler' => 'Ungültige Antwort'], 400);
  if ($neu === 'abgesagt' && $grund === '') antwort(['fehler' => 'Bitte gib einen Grund für die Absage an.'], 400);
  $fehler = bundleAendern($gid, function (array &$bundle) use ($sid, $pid, $neu, $grund) {
    if (!sitzungVon($bundle, $sid) || personDaten($bundle, $pid)['name'] === '') return 'Diese Sitzung gibt es nicht mehr.';
    if (protokollVon($bundle, $sid)) return 'Die Sitzung hat schon begonnen – die Antwort lässt sich nicht mehr ändern.';
    $vorher = $bundle['einladungen'][$sid][$pid]['antwort'] ?? '';
    $bundle['einladungen'][$sid][$pid] = array_merge($bundle['einladungen'][$sid][$pid] ?? ['gesendet' => []],
      ['antwort' => $neu, 'grund' => $neu === 'abgesagt' ? textKuerzen($grund, 500) : '', 'antwortAm' => date('c')]);
    foreach ($bundle['vorprotokolle'] as &$vp) {
      if ($vp['sitzungId'] !== $sid) continue;
      $ids = array_values(array_diff($vp['anwesendeMitgliederIds'], [$pid]));
      // Absage trägt aus; eine zurückgenommene Absage trägt ein erwartetes Mitglied wieder ein
      if ($neu === 'zugesagt' && (in_array($pid, $vp['anwesendeMitgliederIds'], true) || ($vorher === 'abgesagt' && istErwartet($bundle['gremium'], $pid)))) $ids[] = $pid;
      $vp['anwesendeMitgliederIds'] = $ids;
    }
    unset($vp);
    return null;
  });
  if ($fehler) antwort(['fehler' => $fehler], 409);
  antwort(['ok' => true]);
}

if ($aktion === 'einladung_abbestellen') {
  [$gid, , $pid] = einladungAusCode($eingabe['code'] ?? '');
  bundleAendern($gid, function (array &$bundle) use ($pid) {
    $email = strtolower(trim(personDaten($bundle, $pid)['email'] ?? ''));
    if ($email !== '') $bundle['einladungenAus'] = array_values(array_unique(array_merge($bundle['einladungenAus'] ?? [], [$email])));
  });
  antwort(['ok' => true]);
}

// SSO: Weiterleitung zum Anbieter; Zustand signiert im state-Parameter (kein Sitzungsspeicher nötig)
function ssoSignatur($daten) {
  return hash_hmac('sha256', $daten, hash('sha256', ADMIN_PASSWORT . '|sso'));
}

// Kurzlebiger Code, mit dem «Mein Konto» einen Anbieter mit genau diesem Konto verknüpft (sso_verknuepfen_code)
function ssoKontoCode($benutzerId) {
  $daten = base64_encode(json_encode(['b' => $benutzerId, 'z' => time()]));
  return $daten . '.' . ssoSignatur('konto|' . $daten);
}

function ssoKontoAusCode($code) {
  [$daten, $signatur] = array_pad(explode('.', (string) $code, 2), 2, '');
  if ($daten === '' || !hash_equals(ssoSignatur('konto|' . $daten), $signatur)) return null;
  $d = json_decode(base64_decode($daten), true);
  return is_array($d) && time() - ($d['z'] ?? 0) <= 600 ? ($d['b'] ?? null) : null;
}

function ssoCookie($wert) {
  setcookie('ormeet_sso', $wert, ['expires' => $wert === '' ? 1 : time() + 600, 'path' => rtrim(dirname($_SERVER['SCRIPT_NAME']), '/\\') . '/', 'secure' => istHttps(), 'httponly' => true, 'samesite' => 'Lax']);
}

if ($aktion === 'sso_start') {
  $id = $_GET['anbieter'] ?? '';
  $anbieter = ssoAktiv()[$id] ?? null;
  if (!$anbieter) antwort(['fehler' => 'Dieser Anbieter ist nicht eingerichtet'], 400);
  $nonce = bin2hex(random_bytes(16));
  ssoCookie($nonce); // bindet den Rücksprung an diesen Browser (kein Unterschieben fremder Anmeldungen)
  $daten = base64_encode(json_encode(['anbieter' => $id, 'verknuepfen' => $_GET['verknuepfen'] ?? '', 'weiter' => $_GET['weiter'] ?? '',
                                      'konto' => $_GET['konto'] ?? '', 'popup' => !empty($_GET['popup']), 'zeit' => time(), 'nonce' => $nonce]));
  $state = $daten . '.' . ssoSignatur($daten);
  $url = rtrim($anbieter['url'], '/') . $anbieter['authorize'] . '?' . http_build_query([
    'response_type' => 'code', 'client_id' => $anbieter['clientId'], 'redirect_uri' => basisUrl() . 'api.php?aktion=sso_callback',
    'scope' => 'openid email profile', 'state' => $state,
  ]);
  header('Location: ' . $url, true, 302);
  exit;
}

// Ende der Anmeldung beim Anbieter: im Popup (sso_start mit popup=1) übernimmt das Fenster, das es geöffnet hat, die
// Adresse und das Popup schliesst sich (js/sso-zurueck.js); sonst wie bisher per Weiterleitung
function ssoZiel($ziel, $popup) {
  if (!$popup) {
    header('Location: ' . $ziel, true, 302);
    return;
  }
  header('Content-Type: text/html; charset=utf-8');
  $ziel = htmlspecialchars($ziel, ENT_QUOTES);
  $skript = htmlspecialchars(basisUrl() . 'js/sso-zurueck.js?v=' . rawurlencode(lokaleVersion()), ENT_QUOTES);
  echo "<!doctype html><html lang=\"de\"><head><meta charset=\"utf-8\"><title>Ormeet</title></head><body data-ziel=\"$ziel\">"
    . "<p style=\"font-family: sans-serif\">Anmeldung abgeschlossen. <a href=\"$ziel\">Weiter zu Ormeet</a></p><script src=\"$skript\"></script></body></html>";
}

if ($aktion === 'sso_callback') {
  [$daten, $signatur] = array_pad(explode('.', $_GET['state'] ?? '', 2), 2, '');
  $state = json_decode(base64_decode($daten), true);
  $popup = is_array($state) && !empty($state['popup']);
  $fehlerSeite = fn($text) => ssoZiel(basisUrl() . '#/login?fehler=' . rawurlencode($text), $popup);
  if (!$state || !hash_equals(ssoSignatur($daten), $signatur) || time() - $state['zeit'] > 600) { $fehlerSeite('Die Anmeldung ist abgelaufen – bitte erneut versuchen'); exit; }
  if (!hash_equals($state['nonce'], $_COOKIE['ormeet_sso'] ?? '')) { $fehlerSeite('Die Anmeldung wurde in einem anderen Browser begonnen – bitte erneut versuchen'); exit; }
  ssoCookie('');
  $anbieter = ssoAktiv()[$state['anbieter']] ?? null;
  if (!$anbieter || empty($_GET['code'])) { $fehlerSeite('Anmeldung beim Anbieter fehlgeschlagen'); exit; }
  $basis = rtrim($anbieter['url'], '/');
  $tokenDaten = json_decode(holen($basis . $anbieter['token'], [
    'grant_type' => 'authorization_code', 'code' => $_GET['code'], 'redirect_uri' => basisUrl() . 'api.php?aktion=sso_callback',
    'client_id' => $anbieter['clientId'], 'client_secret' => $anbieter['clientSecret'] ?? '',
  ]) ?? '', true);
  $info = empty($tokenDaten['access_token']) ? null : json_decode(holen($basis . $anbieter['userinfo'], null, ['Authorization: Bearer ' . $tokenDaten['access_token']]) ?? '', true);
  $nurVerknuepft = !empty($anbieter['nurVerknuepft']);
  if (empty($info['sub']) || (!$nurVerknuepft && empty($info['email']))) { $fehlerSeite('Der Anbieter hat keine Benutzerdaten geliefert'); exit; }

  $benutzer = benutzerLesen();
  $i = null;
  foreach ($benutzer as $k => $b) if (($b['sso'][$state['anbieter']] ?? null) === $info['sub']) $i = $k;
  // Verknüpfen aus «Mein Konto»: die Anmeldung beim Anbieter gehört ab jetzt zu genau diesem Konto
  if (($state['konto'] ?? '') !== '') {
    $kontoId = ssoKontoAusCode($state['konto']);
    $ziel = $kontoId ? benutzerById($benutzer, $kontoId) : null;
    if ($ziel === null) { $fehlerSeite('Das Verknüpfen ist abgelaufen – bitte unter «Mein Konto» erneut versuchen'); exit; }
    if ($i !== null && $i !== $ziel) { $fehlerSeite("Diese Anmeldung bei {$anbieter['name']} ist schon mit einem anderen Ormeet-Konto verknüpft"); exit; }
    $i = $ziel;
    $benutzer[$i]['sso'][$state['anbieter']] = $info['sub'];
    benutzerSchreiben($benutzer);
    ssoZiel(basisUrl() . '#/konto', $popup); // bisherige Anmeldung bleibt (Konto oder Superadmin mit verknüpftem Konto)
    exit;
  }
  // Anbieter ohne eigene Daten (Orki): Ein noch nicht verknüpftes Konto entsteht nur beim Registrieren über einen
  // persönlichen Link – Name und E-Mail kommen dann von dieser Person in Ormeet, ein Passwort gibt es nicht (Anmeldung
  // nur über den Anbieter). Ohne Link oder wenn die E-Mail schon zu einem Konto gehört: keine Übernahme, sondern Hinweis.
  if ($i === null && $nurVerknuepft) {
    $person = null;
    $z = $state['verknuepfen'] !== '' ? linkZugriff($state['verknuepfen']) : null;
    if ($z && isset($z['personId'], $z['gremiumId']) && in_array($z['rolle'], ['person', 'freigabe'], true)) {
      $bundle = lesen(dateiVon($z['gremiumId']));
      $person = $bundle ? personDaten($bundle, $z['personId']) : null;
    }
    if (!$person || trim($person['name'] ?? '') === '') {
      $fehlerSeite("Mit dieser Anmeldung bei {$anbieter['name']} ist kein Ormeet-Konto verknüpft. Melde dich mit E-Mail und Passwort an und verknüpfe {$anbieter['name']} unter «Mein Konto» – oder registriere dich über deinen persönlichen Link.");
      exit;
    }
    $email = trim($person['email'] ?? '');
    if ($email !== '' && benutzerByEmail($benutzer, $email) !== null) {
      $fehlerSeite("Zu {$email} gibt es schon ein Ormeet-Konto. Melde dich damit an und verknüpfe {$anbieter['name']} unter «Mein Konto».");
      exit;
    }
    $benutzer[] = neuerBenutzer(trim($person['name']), $email);
    $i = count($benutzer) - 1;
  }
  if ($i === null) $i = benutzerByEmail($benutzer, $info['email']); // gleiche E-Mail: bestehendes Konto verknüpfen
  if ($i === null) {
    $name = trim($info['name'] ?? trim(($info['given_name'] ?? '') . ' ' . ($info['family_name'] ?? ''))) ?: ($info['preferred_username'] ?? $info['email']);
    $benutzer[] = neuerBenutzer($name, $info['email']);
    $i = count($benutzer) - 1;
  }
  $benutzer[$i]['sso'][$state['anbieter']] = $info['sub'];
  if ($state['verknuepfen'] !== '') linkVerknuepfen(linkZugriff($state['verknuepfen']), $benutzer[$i]['id'], $benutzer[$i]['name'], $benutzer[$i]['email']);
  $neuerToken = anmeldungAnlegen($benutzer[$i]);
  benutzerSchreiben($benutzer);
  $weiter = $state['weiter'] !== '' && $state['weiter'][0] === '/' ? '?weiter=' . rawurlencode($state['weiter']) : '';
  ssoZiel(basisUrl() . '#/zugang/' . $neuerToken . $weiter, $popup);
  exit;
}

if (!$zugriff) antwort(['fehler' => 'Passwort oder Link ungültig'], 401);

// Code fürs Verknüpfen eines Anbieters mit dem angemeldeten Konto («Mein Konto»)
if ($aktion === 'sso_verknuepfen_code') {
  $benutzerId = $zugriff['rolle'] === 'benutzer' ? $zugriff['benutzerId'] : ($zugriff['konto']['benutzerId'] ?? null);
  if (!$benutzerId) antwort(['fehler' => 'Verknüpfen geht nur, wenn du mit deinem Konto angemeldet bist'], 403);
  antwort(['code' => ssoKontoCode($benutzerId)]);
}

$gremiumId = $_GET['gremium'] ?? '';
$konto = $zugriff['rolle'] === 'benutzer' ? $zugriff : null; // Konto: für das angefragte Gremium gilt die dortige Rolle
if ($konto && $gremiumId !== '') $zugriff = effektiverZugriff($konto, $gremiumId);
$rolle = $zugriff['rolle'];
$istAdmin = $rolle === 'admin';
$istSuperadmin = $istAdmin && !$konto;
$eigenes = $istSuperadmin || ($zugriff['gremiumId'] ?? null) === $gremiumId;

// --- Kalender-Abo (iCal) für persönliche Zugänge -----------------
// Frist einer Pendenz als Datum: «bis zur nächsten Sitzung» (naechste) = Termin der nächsten Sitzung – der im Protokoll
// festgelegte nächste Termin, sonst die nächste mit späterem Datum; leer, solange keiner feststeht
function fristDatum(array $bundle, array $eintrag, $sitzungId) {
  if (($eintrag['faelligBis'] ?? '') !== 'naechste') return $eintrag['faelligBis'] ?? '';
  $sitzungen = indexById($bundle['sitzungen']);
  $sitzung = $sitzungen[$sitzungId] ?? null;
  if (empty($sitzung['datum'])) return '';
  $festgelegt = $sitzungen[$sitzung['naechsterTerminId'] ?? ''] ?? null;
  if (!empty($festgelegt['datum'])) return $festgelegt['datum'];
  $naechste = '';
  foreach ($bundle['sitzungen'] as $s) {
    if (empty($s['kurz']) && !empty($s['datum']) && $s['datum'] > $sitzung['datum'] && ($naechste === '' || $s['datum'] < $naechste)) $naechste = $s['datum'];
  }
  return $naechste;
}

function icalText($wert) {
  return str_replace(["\\", ";", ",", "\n"], ["\\\\", "\;", "\,", "\\n"], $wert);
}

function icalZeile($zeile) {
  // Zeilen über 75 Bytes falten (RFC 5545)
  $out = '';
  while (strlen($zeile) > 75) {
    $n = 75;
    while ($n > 1 && (ord($zeile[$n]) & 0xC0) === 0x80) $n--; // kein UTF-8-Zeichen zerschneiden
    $out .= substr($zeile, 0, $n) . "\r\n ";
    $zeile = substr($zeile, $n);
  }
  return $out . $zeile . "\r\n";
}

function icalEvent($uid, $datum, $von, $bis, $titel, $beschreibung, $ort, $status) {
  $d = str_replace('-', '', $datum);
  $z = [ 'BEGIN:VEVENT', 'UID:' . $uid . '@ormeet', 'DTSTAMP:' . gmdate('Ymd\THis\Z'), 'SUMMARY:' . icalText($titel), 'STATUS:' . $status ];
  if ($von) {
    $start = $d . 'T' . str_replace(':', '', $von) . '00';
    $ende = $bis ? $d . 'T' . str_replace(':', '', $bis) . '00' : date('Ymd\THi00', strtotime("$datum $von") + 2 * 3600);
    $z[] = 'DTSTART;TZID=Europe/Zurich:' . $start;
    $z[] = 'DTEND;TZID=Europe/Zurich:' . $ende;
  } else {
    $z[] = 'DTSTART;VALUE=DATE:' . $d;
    $z[] = 'DTEND;VALUE=DATE:' . date('Ymd', strtotime($datum) + 86400);
  }
  if ($ort) $z[] = 'LOCATION:' . icalText($ort);
  $z[] = 'DESCRIPTION:' . icalText($beschreibung);
  $z[] = 'END:VEVENT';
  return implode('', array_map('icalZeile', $z));
}

if ($aktion === 'ical') {
  if ($rolle !== 'person') antwort(['fehler' => 'Kalender-Abo nur für persönliche Zugänge'], 403);
  $bundle = lesen(dateiVon($zugriff['gremiumId']));
  $personId = $zugriff['personId'];
  $basis = basisUrl();
  $link = fn($pfad) => $basis . '#/zugang/' . $token . '?weiter=' . rawurlencode($pfad); // öffnet direkt über den persönlichen Link bzw. das Konto
  $gremiumName = $bundle['gremium']['name'];
  $events = '';

  foreach ($bundle['sitzungen'] as $s) {
    $titel = ($s['titel'] ?: 'Sitzung') . ' – ' . $gremiumName;
    $vp = empty($s['kurz']) ? "Vorprotokoll: " . $link('/sitzung/' . $s['id'] . '/vorprotokoll') : 'Kurzsitzung'; // Kurzsitzungen haben nur ein Protokoll
    if ($s['datum']) {
      $events .= icalEvent('sitzung-' . $s['id'], $s['datum'], $s['zeit'] ?: null, null, $titel, $vp . "\nProtokoll: " . $link('/sitzung/' . $s['id'] . '/protokoll'), $s['ort'], 'CONFIRMED');
    } elseif (!empty($s['terminfindung']) && $s['terminfindung']['status'] === 'offen') {
      // Provisorische Termine: Vorschläge, bei denen die Person mit Ja oder Vielleicht gestimmt hat
      foreach ($s['terminfindung']['stimmen'] as $st) {
        if (($st['personId'] ?? null) !== $personId) continue;
        foreach ($st['wahl'] as $w) {
          if (!in_array($w['wert'], ['ja', 'vielleicht'], true)) continue;
          foreach ($s['terminfindung']['optionen'] as $o) {
            if ($o['id'] !== $w['optionId']) continue;
            $label = $w['wert'] === 'ja' ? 'zugesagt' : 'vielleicht';
            $events .= icalEvent('option-' . $o['id'], $o['datum'], $o['von'], $o['bis'] ?: null, "Provisorisch ($label): $titel",
              "Terminfindung: " . $link('/sitzung/' . $s['id'] . '/terminfindung') . "\n" . $vp, $s['ort'], 'TENTATIVE');
          }
        }
      }
    }
  }
  foreach ($bundle['protokolle'] as $p) {
    foreach ($p['eintraege'] as $e) {
      $frist = fristDatum($bundle, $e, $p['sitzungId']);
      if ($e['typ'] !== 'pendenz' || ($e['zugewiesenAn'] ?? null) !== $personId || $e['pendenzStatus'] === 'erfuellt' || $frist === '') continue;
      $events .= icalEvent('pendenz-' . $e['id'], $frist, null, null, 'Pendenz: ' . $e['titel'],
        ($e['inhalt'] ? $e['inhalt'] . "\n" : '') . "Protokoll: " . $link('/sitzung/' . $p['sitzungId'] . '/protokoll'), '', 'CONFIRMED');
    }
  }

  header('Content-Type: text/calendar; charset=utf-8');
  header('Content-Disposition: inline; filename="ormeet.ics"');
  echo "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Ormeet//Sitzungsprotokolle//DE\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n"
    . icalZeile('X-WR-CALNAME:' . icalText("Ormeet – $gremiumName")) . "X-WR-TIMEZONE:Europe/Zurich\r\n" . $events . "END:VCALENDAR\r\n";
  exit;
}

// --- Laden ------------------------------------------------------
// Zuletzt genutzt (nur das Datum, ohne Adresse oder Gerät) pro Zugang – höchstens ein Schreibvorgang pro Tag
function nutzungMerken(array $bundle, $ref) {
  if (!$ref || ($bundle['nutzung'][$ref] ?? '') === date('Y-m-d')) return;
  bundleAendern($bundle['gremium']['id'], function (array &$b) use ($ref) {
    $b['nutzung'] = (array) ($b['nutzung'] ?? []);
    $b['nutzung'][$ref] = date('Y-m-d');
  });
}

if ($aktion === 'laden') {
  if ($konto) {
    // Konto: alle eigenen Gremien, je nach dortiger Rolle bereinigt
    $bundles = [];
    foreach ($konto['gremien'] as $g) {
      $bundle = lesen(dateiVon($g['gremiumId']));
      if (!$bundle) continue;
      nutzungMerken($bundle, 'konto:' . ($g['personId'] ?? 'eigentuemer'));
      $bundle = bereinigen($bundle, effektiverZugriff($konto, $g['gremiumId']));
      if ($g['rolle'] === 'gast') $bundle = protokolleFuerUebertrag($bundle, $g['sitzungId']);
      $bundles[] = $bundle;
    }
    $antwort = ['zugriff' => $konto, 'gremien' => $bundles];
    $auswahl = eigentuemerKonten($konto);
    if ($auswahl) $antwort['konten'] = $auswahl;
    antwort($antwort);
  }
  if ($istAdmin) $bundles = array_map(fn($b) => bereinigen($b, $zugriff), alleBundles());
  else {
    $roh = lesen(dateiVon($zugriff['gremiumId']));
    nutzungMerken($roh, $zugriff['ref'] ?? '');
    $bundles = [bereinigen($roh, $zugriff)];
  }
  if ($rolle === 'gremium' && ($zugriff['rechte']['sitzungen'] ?? 'keine') === 'keine') {
    $bundles[0]['sitzungen'] = [];
    $bundles[0]['vorprotokolle'] = [];
    $bundles[0]['protokolle'] = [];
  }
  if ($rolle === 'freigabe') {
    // Vorprotokoll-Link: aus den Protokollen nur Pendenzen und vertagte / neu behandelte Anträge mitgeben (für den Übertrag) –
    // ausser dem Protokoll der eigenen Kurzsitzung, das der Gast ganz sieht, und dem abgeschlossenen Protokoll der eigenen
    // Sitzung für anwesende Gäste bis zur Genehmigung (Änderungsanträge)
    $eigeneSitzungId = null;
    foreach ($bundles[0]['vorprotokolle'] as $vp) if ($vp['id'] === $zugriff['vorprotokollId']) $eigeneSitzungId = $vp['sitzungId'];
    $kurz = [];
    foreach ($bundles[0]['sitzungen'] as $s) if (!empty($s['kurz'])) $kurz[$s['id']] = true;
    foreach ($bundles[0]['protokolle'] as &$protokoll) {
      if ($protokoll['sitzungId'] === $eigeneSitzungId && (isset($kurz[$eigeneSitzungId]) || ($zugriff['dokument'] ?? '') === 'protokoll')) continue;
      $eigeneSitzung = $protokoll['sitzungId'] === $eigeneSitzungId ? sitzungVon($bundles[0], $eigeneSitzungId) : null;
      if ($eigeneSitzung && darfAenderungStellen($bundles[0], $eigeneSitzung, $protokoll, $zugriff['personId'] ?? null)) continue;
      $protokoll['eintraege'] = array_values(array_filter($protokoll['eintraege'], fn($e) => $e['typ'] === 'pendenz' || ($e['typ'] === 'antrag' && (($e['antragStatus'] ?? '') === 'vertagt' || !empty($e['vorherigerAntragId'])))));
    }
  }
  if (!empty($zugriff['nurSitzung'])) {
    // Ansicht durch die Leitung einer Sitzung: nur diese Sitzung
    $nur = $zugriff['nurSitzung'];
    $bundles[0]['sitzungen'] = array_values(array_filter($bundles[0]['sitzungen'], fn($x) => $x['id'] === $nur));
    foreach (['vorprotokolle', 'protokolle'] as $typ) $bundles[0][$typ] = array_values(array_filter($bundles[0][$typ], fn($x) => $x['sitzungId'] === $nur));
  }
  if ($rolle === 'link') {
    // Zusätzlicher allgemeiner Link: aus Protokollen anderer Sitzungen nur Pendenzen und vertagte Anträge (für den Übertrag)
    $bundles[0] = protokolleFuerUebertrag($bundles[0], $zugriff['sitzungId']);
  }
  if ($rolle === 'themenbereich') {
    // Übersichts-Link: nur Einträge dieses Themenbereichs, keine Vorprotokolle
    $bundles[0]['vorprotokolle'] = [];
    foreach ($bundles[0]['protokolle'] as &$protokoll) {
      $protokoll['eintraege'] = array_values(array_filter($protokoll['eintraege'], fn($e) => $e['themenbereichId'] === $zugriff['themenbereichId']));
    }
  }
  $antwort = ['zugriff' => $zugriff, 'gremien' => $bundles];
  if ($istSuperadmin) $antwort['konten'] = array_map('benutzerOeffentlich', benutzerLesen());
  antwort($antwort);
}

// --- Speichern --------------------------------------------------
if ($aktion === 'speichern') {
  $aenderungen = $eingabe;
  if (!is_array($aenderungen)) antwort(['fehler' => 'Ungültige Daten'], 400);
  if (isset($aenderungen['gremium']) && $aenderungen['gremium']['id'] !== $gremiumId) antwort(['fehler' => 'Gremium-ID stimmt nicht'], 400);

  $datei = dateiVon($gremiumId);
  $neu = !file_exists($datei);
  $neueKurzsitzung = !empty($aenderungen['gremium']['kurz']); // Kurzsitzung ohne Gremium: eigener, versteckter Behälter
  if ($neu && $konto && !empty($konto[$neueKurzsitzung ? 'darfKurzsitzungenAnlegen' : 'darfGremienAnlegen']) && isset($aenderungen['gremium'])) {
    // Konto mit Freigabe legt ein eigenes Gremium bzw. eine Kurzsitzung ohne Gremium an
    $zugriff = ['rolle' => 'admin', 'gremiumId' => $gremiumId, 'eigentuemer' => true];
    $rolle = 'admin';
    $istAdmin = true;
    $eigenes = true;
  }
  if (!$eigenes || in_array($rolle, ['verfolger', 'themenbereich', 'keine'], true)) antwort(['fehler' => 'Kein Zugriff auf dieses Gremium'], 403);
  if ($neu && (!$istAdmin || !isset($aenderungen['gremium']))) antwort(['fehler' => 'Gremium nicht gefunden'], 404);

  $handle = fopen($datei, 'c+');
  flock($handle, LOCK_EX);
  $bundle = $neu ? null : json_decode(entschluesseln(stream_get_contents($handle)), true);
  $bundle = $bundle ?: ['gremium' => null, 'sitzungen' => [], 'vorprotokolle' => [], 'protokolle' => []];
  $gleichzeitig = gleichzeitigeAenderungen($bundle, $aenderungen); // Änderungen anderer seit dem geladenen Stand bleiben erhalten

  if (isset($aenderungen['gremium'])) {
    // Eigentümer und Konto-Verknüpfungen setzt nur der Superadmin; ein Eigentümer behält sein eigenes Gremium
    // Kurzsitzung des Superadmins: gehört dem mit ihm verknüpften Konto (erscheint so in seiner Übersicht)
    if ($neu) $aenderungen['gremium']['eigentuemerId'] = $konto['benutzerId'] ?? ($neueKurzsitzung ? ($zugriff['konto']['benutzerId'] ?? null) : null);
    elseif (!$istSuperadmin) {
      $aenderungen['gremium']['eigentuemerId'] = $bundle['gremium']['eigentuemerId'] ?? null;
      $alteKonten = array_column($bundle['gremium']['mitglieder'], 'benutzerId', 'id');
      // Eigentümer: Konto lösen oder eines aus seinen Gremien verknüpfen; alle anderen ändern keine Verknüpfung
      $erlaubt = !empty($zugriff['eigentuemer']) ? array_column(eigentuemerKonten($konto), 'id', 'id') : [];
      foreach ($aenderungen['gremium']['mitglieder'] as &$m) {
        $gewuenscht = $m['benutzerId'] ?? null;
        $m['benutzerId'] = $alteKonten[$m['id']] ?? null;
        if ($erlaubt && ($gewuenscht === null || isset($erlaubt[$gewuenscht]))) $m['benutzerId'] = $gewuenscht;
      }
      unset($m);
    }
    // Ob ein Gremium eine Kurzsitzung ohne Gremium ist, steht beim Anlegen fest
    $aenderungen['gremium']['kurz'] = $neu ? $neueKurzsitzung : !empty($bundle['gremium']['kurz']);
  }
  foreach (array_keys($aenderungen['sitzungen'] ?? []) as $k) $aenderungen['sitzungen'][$k]['gremiumId'] = $gremiumId; // eine Sitzung bleibt in ihrem Gremium
  linkGaesteMerken($bundle); // Rechte der über Links eingetragenen Personen
  $antraege = aenderungsantraegeBerechnen($bundle, $aenderungen, $zugriff);
  if ($rolle === 'gremium') $aenderungen = gremiumRechteAnwenden($bundle, $aenderungen, $zugriff['rechte']);
  if ($rolle === 'person' || ($rolle === 'freigabe' && isset($zugriff['personId']))) $aenderungen = personRechteAnwenden($bundle, $aenderungen, $zugriff);
  if ($rolle === 'freigabe' && !isset($zugriff['personId'])) {
    // Allgemeiner Freigabe-Link: nur dieses Vorprotokoll, nach der Stufe des Links (wie weitere Links)
    $erlaubt = linkRechteAnwenden($bundle, $aenderungen, $zugriff)['vorprotokolle'];
    $sitzungen = [];
    foreach ($aenderungen['sitzungen'] ?? [] as $neuS) {
      foreach ($bundle['sitzungen'] as $altS) {
        if ($altS['id'] !== $neuS['id']) continue;
        foreach ($bundle['vorprotokolle'] as $vp) {
          if ($vp['id'] === $zugriff['vorprotokollId'] && $vp['sitzungId'] === $altS['id']) $sitzungen[] = sitzungMergeAnonym($altS, $neuS);
        }
      }
    }
    $aenderungen = ['vorprotokolle' => $erlaubt, 'sitzungen' => $sitzungen];
  }

  if ($rolle === 'link') $aenderungen = linkRechteAnwenden($bundle, $aenderungen, $zugriff);
  $aenderungen = gastFelderBewahren($bundle, $aenderungen);
  // Mit Konto verknüpft: Name und E-Mail kommen vom Konto, nicht aus der Eingabe
  $gastKonten = [];
  foreach ($bundle['vorprotokolle'] as $vp) foreach ($vp['gaeste'] as $g) if (!empty($g['benutzerId'])) $gastKonten[$g['id']] = $g['benutzerId'];
  kontoAngabenUebernehmen($aenderungen, $gastKonten);
  $aenderungen = abmeldungenUebertragen($bundle, $aenderungen);
  $aenderungen = absagenDurchsetzen($bundle, $aenderungen);

  foreach ($aenderungen['protokolle'] ?? [] as $k => $p) {
    if (isset($antraege[$p['id']])) $aenderungen['protokolle'][$k]['aenderungsantraege'] = $antraege[$p['id']];
  }
  $aenderungen = genehmigungSchuetzen($bundle, $aenderungen);
  $bundle = einarbeiten($bundle, $aenderungen);
  ftruncate($handle, 0);
  rewind($handle);
  fwrite($handle, verschluesseln(json_encode($bundle, JSON_UNESCAPED_UNICODE)));
  flock($handle, LOCK_UN);
  fclose($handle);
  antwort(['ok' => true, 'gleichzeitig' => $gleichzeitig, 'zusammengefuehrt' => !empty($GLOBALS['zusammengefuehrt'])]);
}

// --- Updates (nur Superadmin) -----------------------------------
// HTTP-Abruf (GET, oder POST mit Formulardaten); zuerst über Streams, ersatzweise über curl
function holen($url, array $post = null, array $header = []) {
  $http = ['timeout' => 20, 'user_agent' => 'Ormeet', 'follow_location' => 1, 'ignore_errors' => true];
  if ($post !== null) {
    $http += ['method' => 'POST', 'content' => http_build_query($post)];
    $header[] = 'Content-Type: application/x-www-form-urlencoded';
  }
  if ($header) $http['header'] = implode("\r\n", $header);
  $inhalt = @file_get_contents($url, false, stream_context_create(['http' => $http, 'ssl' => ['verify_peer' => true]]));
  if ($inhalt === false && function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20, CURLOPT_FOLLOWLOCATION => true, CURLOPT_USERAGENT => 'Ormeet', CURLOPT_HTTPHEADER => $header]);
    if ($post !== null) curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => http_build_query($post)]);
    $inhalt = curl_exec($ch);
    curl_close($ch);
  }
  return $inhalt === false ? null : $inhalt;
}

function lokaleVersion() {
  return file_exists(__DIR__ . '/version.md') ? trim(file_get_contents(__DIR__ . '/version.md')) : '0.0.0';
}

if ($aktion === 'update_pruefen' || $aktion === 'update_installieren') {
  if (!$istSuperadmin) antwort(['fehler' => 'Nur der Superadmin kann Updates verwalten'], 403);
  $lokal = lokaleVersion();
  $releaseText = holen('https://api.github.com/repos/' . GITHUB_REPO . '/releases/latest');
  if ($releaseText === null) antwort(['fehler' => 'GitHub ist nicht erreichbar'], 502);
  $release = json_decode($releaseText, true);
  $tag = $release['tag_name'] ?? '';
  $aktuell = ltrim($tag, 'v');
  if (!preg_match('/^\d+\.\d+\.\d+$/', $aktuell)) antwort(['fehler' => 'Ungültige Versionsangabe bei GitHub'], 502);
  $verfuegbar = version_compare($aktuell, $lokal, '>');

  if ($aktion === 'update_pruefen') antwort(['lokal' => $lokal, 'aktuell' => $aktuell, 'verfuegbar' => $verfuegbar, 'neuerungen' => $release['body'] ?? '']);

  if (!$verfuegbar) antwort(['fehler' => 'Es ist bereits die aktuelle Version installiert'], 400);

  // Eigene Einstellungen bewahren
  $altesApi = file_get_contents(__DIR__ . '/api.php');
  $altesIndex = file_exists(__DIR__ . '/index.php') ? file_get_contents(__DIR__ . '/index.php') : '';
  $passwort = preg_match("/const ADMIN_PASSWORT = '([^']*)'/", $altesApi, $m) ? $m[1] : null;
  $kontakt = preg_match("/const ORMEET_KONTAKT = '([^']*)'/", $altesIndex, $m) ? $m[1] : null;

  $schreiben = function ($name, $inhalt) use ($passwort, $kontakt) {
    if ($name === '' || substr($name, -1) === '/' || strpos($name, 'data/') === 0 || strpos($name, '..') !== false || $name === 'schluessel.php') return null;
    if ($name === 'api.php' && $passwort !== null) {
      $inhalt = preg_replace_callback("/const ADMIN_PASSWORT = '[^']*'/", fn() => "const ADMIN_PASSWORT = '" . addcslashes($passwort, "'\\") . "'", $inhalt, 1);
    }
    if ($name === 'index.php' && $kontakt !== null) {
      $inhalt = preg_replace_callback("/const ORMEET_KONTAKT = '[^']*'/", fn() => "const ORMEET_KONTAKT = '" . addcslashes($kontakt, "'\\") . "'", $inhalt, 1);
    }
    $ziel = __DIR__ . '/' . $name;
    if (!is_dir(dirname($ziel))) mkdir(dirname($ziel), 0755, true);
    return file_put_contents($ziel, $inhalt) === false ? "Fehler: $name konnte nicht geschrieben werden" : $name;
  };

  $protokoll = [];
  $zipFertig = false;
  if (class_exists('ZipArchive')) {
    // Variante 1: Quellcode-ZIP des Releases, direkt ohne Umleitung (Umleitungen scheitern auf vielen Hostings)
    $zipDaten = holen('https://codeload.github.com/' . GITHUB_REPO . '/zip/refs/tags/' . rawurlencode($tag));
    if ($zipDaten !== null && substr($zipDaten, 0, 2) === 'PK') {
      $zipDatei = DATEN_ORDNER . '/update.zip';
      file_put_contents($zipDatei, $zipDaten);
      $zip = new ZipArchive();
      if ($zip->open($zipDatei) === true) {
        for ($i = 0; $i < $zip->numFiles; $i++) {
          $pfad = $zip->getNameIndex($i);
          // GitHub verpackt alles in einen Wurzelordner (z. B. ormeet-1.0.2/) – den entfernen wir
          $schraegstrich = strpos($pfad, '/');
          $ohneWurzel = $schraegstrich === false ? '' : substr($pfad, $schraegstrich + 1);
          $ergebnis = $schreiben($ohneWurzel, $zip->getFromIndex($i));
          if ($ergebnis !== null) $protokoll[] = $ergebnis;
        }
        $zip->close();
        $zipFertig = true;
      }
      unlink($zipDatei);
    }
  }
  if (!$zipFertig) {
    // Variante 2: Einzeldateien über die GitHub-API (ohne zip-Erweiterung oder wenn das ZIP nicht geladen werden konnte)
    $baum = json_decode(holen('https://api.github.com/repos/' . GITHUB_REPO . '/git/trees/' . rawurlencode($tag) . '?recursive=1') ?? '', true);
    if (!is_array($baum['tree'] ?? null)) antwort(['fehler' => 'Dateiliste konnte nicht von GitHub geladen werden'], 502);
    foreach ($baum['tree'] as $eintrag) {
      if (($eintrag['type'] ?? '') !== 'blob') continue;
      $name = $eintrag['path'];
      $url = 'https://raw.githubusercontent.com/' . GITHUB_REPO . '/' . rawurlencode($tag) . '/' . implode('/', array_map('rawurlencode', explode('/', $name)));
      $inhalt = holen($url);
      if ($inhalt === null) { $protokoll[] = "Fehler: $name konnte nicht geladen werden"; continue; }
      $ergebnis = $schreiben($name, $inhalt);
      if ($ergebnis !== null) $protokoll[] = $ergebnis;
    }
  }
  $fehler = array_values(array_filter($protokoll, fn($z) => strpos($z, 'Fehler:') === 0));
  if ($fehler) antwort(['fehler' => implode('; ', $fehler), 'dateien' => $protokoll], 500);
  file_put_contents(__DIR__ . '/version.md', $aktuell . "\n");
  antwort(['ok' => true, 'version' => $aktuell, 'dateien' => $protokoll]);
}

// --- Gremium löschen --------------------------------------------
if ($aktion === 'loeschen') {
  if (!$istAdmin) antwort(['fehler' => 'Nur der Superadmin oder der Eigentümer kann Gremien löschen'], 403);
  $datei = dateiVon($gremiumId);
  if (file_exists($datei)) unlink($datei);
  antwort(['ok' => true]);
}

// --- Konto des angemeldeten Benutzers ------------------------------
if ($aktion === 'abmelden') {
  if ($istSuperadmin) {
    $superadmin = superadminLesen();
    $superadmin['anmeldungen'] = array_values(array_filter($superadmin['anmeldungen'], fn($a) => !hash_equals($a['token'], $token)));
    jsonSchreiben(SUPERADMIN_DATEI, $superadmin);
  }
  if ($konto) {
    $benutzer = benutzerLesen();
    $i = benutzerById($benutzer, $konto['benutzerId']);
    $benutzer[$i]['anmeldungen'] = array_values(array_filter($benutzer[$i]['anmeldungen'], fn($a) => !hash_equals($a['token'], $token)));
    benutzerSchreiben($benutzer);
  }
  antwort(['ok' => true]);
}

if ($aktion === 'konto_aendern') {
  $eigenesKonto = $konto ?? ($istSuperadmin ? ($zugriff['konto'] ?? null) : null); // Superadmin: das mit ihm verknüpfte Konto
  if (!$eigenesKonto) antwort(['fehler' => 'Kein Konto angemeldet'], 403);
  $benutzer = benutzerLesen();
  $i = benutzerById($benutzer, $eigenesKonto['benutzerId']);
  if ($i === null) antwort(['fehler' => 'Konto nicht gefunden'], 404);
  $b = &$benutzer[$i];
  if (isset($eingabe['name']) && trim($eingabe['name']) !== '') $b['name'] = trim($eingabe['name']);
  if (isset($eingabe['passwortNeu'])) {
    if ($b['passwortHash'] !== '' && !password_verify($eingabe['passwortAlt'] ?? '', $b['passwortHash'])) antwort(['fehler' => 'Das bisherige Passwort stimmt nicht'], 400);
    if (strlen($eingabe['passwortNeu']) < 8) antwort(['fehler' => 'Das Passwort braucht mindestens 8 Zeichen'], 400);
    $b['passwortHash'] = password_hash($eingabe['passwortNeu'], PASSWORD_DEFAULT);
  }
  if (!empty($eingabe['alleAbmelden'])) $b['anmeldungen'] = array_values(array_filter($b['anmeldungen'], fn($a) => hash_equals($a['token'], $token)));
  if (isset($eingabe['mailsAus'])) $b['mailsAus'] = (bool) $eingabe['mailsAus'];
  if (!empty($eingabe['ssoLoesen']) && ($b['passwortHash'] !== '' || count($b['sso']) > 1)) unset($b['sso'][$eingabe['ssoLoesen']]);
  unset($b);
  benutzerSchreiben($benutzer);
  antwort(['ok' => true, 'benutzer' => benutzerOeffentlich($benutzer[$i])]);
}

// Allgemeiner Link: Wer ihn öffnet, trägt sich mit Vor- und Nachnamen und E-Mail ein und erhält einen eigenen Link
// (Gast der Sitzung, als «weitere Person» gekennzeichnet, mit den Rechten des allgemeinen Links). Gleicher Name oder
// gleiche E-Mail wie ein Mitglied oder ein Gast der Sitzung: Vorschlag zum Zusammenführen an die Verwaltenden.
if ($aktion === 'link_eintragen') {
  if ($rolle !== 'link' && !($rolle === 'freigabe' && !isset($zugriff['personId']))) antwort(['fehler' => 'Eintragen geht nur über einen allgemeinen Link'], 403);
  $vorname = trim((string) ($eingabe['vorname'] ?? ''));
  $nachname = trim((string) ($eingabe['nachname'] ?? ''));
  $email = trim((string) ($eingabe['email'] ?? ''));
  if ($vorname === '' || $nachname === '') antwort(['fehler' => 'Bitte Vor- und Nachnamen angeben'], 400);
  if (!filter_var($email, FILTER_VALIDATE_EMAIL)) antwort(['fehler' => 'Bitte eine gültige E-Mail-Adresse angeben'], 400);
  $namen = array_map('strval', (array) ($eingabe['namen'] ?? []));
  $key = bundleAendern($zugriff['gremiumId'], function (array &$bundle) use ($zugriff, $rolle, $vorname, $nachname, $email, $namen) {
    $vpIndex = vorprotokollFuer($bundle, $zugriff['sitzungId']);
    if (personMitEmail($bundle, $bundle['vorprotokolle'][$vpIndex], $email)) return null; // schon erfasst: keine doppelte Person
    $vp = &$bundle['vorprotokolle'][$vpIndex];
    $gastId = uuid();
    $name = "$vorname $nachname";
    $gast = ['id' => $gastId, 'name' => $name, 'vorname' => $vorname, 'nachname' => $nachname, 'organisation' => '', 'email' => $email, 'benutzerId' => null,
             'weiterePerson' => true, 'ueberLink' => $rolle === 'link' ? $zugriff['linkId'] : 'freigabe', 'eingetragen' => date('Y-m-d')];
    $vorschlag = doppelteSuchen($bundle, $vp, $name, $email);
    if ($vorschlag) $gast['vorschlag'] = $vorschlag;
    $vp['gaeste'][] = $gast;
    $vp['personenKeys'] = (array) ($vp['personenKeys'] ?? []);
    $key = bin2hex(random_bytes(8));
    $vp['personenKeys'][$gastId] = $key;
    unset($vp);
    namenUebertragen($bundle, $zugriff['sitzungId'], $gastId, $name, $namen);
    return $key;
  });
  if (!$key) antwort(['fehler' => 'Mit dieser E-Mail-Adresse bist du schon erfasst. Deinen persönlichen Link kannst du dir per E-Mail schicken lassen.', 'schonErfasst' => true], 409);
  antwort(['key' => $key]);
}

// Mitglied des Gremiums oder Gast dieser Sitzung mit dieser E-Mail-Adresse (Gross-/Kleinschreibung egal)
function personMitEmail(array $bundle, array $vp, $email) {
  foreach (array_merge($bundle['gremium']['mitglieder'], $vp['gaeste']) as $p) {
    if ($email !== '' && strcasecmp(trim($p['email'] ?? ''), trim($email)) === 0) return $p;
  }
  return null;
}

// Schon erfasst (allgemeiner Link): den persönlichen Link an die hinterlegte Adresse schicken. Die Antwort ist immer
// gleich (verrät nicht, ob es die Adresse gibt); höchstens eine Mail pro Adresse und Viertelstunde.
if ($aktion === 'link_zusenden') {
  if ($rolle !== 'link' && !($rolle === 'freigabe' && !isset($zugriff['personId']))) antwort(['fehler' => 'Nur über einen allgemeinen Link'], 403);
  $email = strtolower(trim((string) ($eingabe['email'] ?? '')));
  $basis = basisUrl();
  $mail = bundleAendern($zugriff['gremiumId'], function (array &$bundle) use ($zugriff, $email, $basis) {
    $vp = $bundle['vorprotokolle'][vorprotokollFuer($bundle, $zugriff['sitzungId'])];
    $p = personMitEmail($bundle, $vp, $email);
    if (!$p || !empty($p['gesperrt']) || fuerSitzungGesperrt(sitzungVon($bundle, $zugriff['sitzungId']) ?? [], $p['id'])) return null;
    if (($bundle['linkZugesandt'][$email] ?? 0) > time() - 900) return null;
    $link = einladungLink($bundle, $vp, $p['id'], $basis);
    if ($link === '') return null;
    $bundle['linkZugesandt'] = array_filter($bundle['linkZugesandt'] ?? [], fn($zeit) => $zeit > time() - 900);
    $bundle['linkZugesandt'][$email] = time();
    $s = sitzungVon($bundle, $zugriff['sitzungId']);
    return [$p['email'], "Hallo {$p['name']}\n\nHier ist dein persönlicher Link für «{$bundle['gremium']['name']}»:\n$link\n\n"
      . 'Du hast ihn über den allgemeinen Link der Sitzung «' . ($s['titel'] ?? '' ?: 'Sitzung') . "» angefordert. Warst du das nicht, kannst du diese E-Mail ignorieren.\n"];
  });
  if ($mail) mailSenden($mail[0], 'Ormeet: dein persönlicher Link', $mail[1]);
  antwort(['ok' => true]);
}

// Wer eine Sitzung verwaltet: Superadmin / Eigentümer, Gremium-Zugang mit Bearbeitungsrecht, Sitzungsleitung und Protokollführung
// … sowie Mitglieder, deren Rolle «Zugriffe verwalten» hat (alle Sitzungen des Gremiums)
function verwaltetSitzung(array $zugriff, $sitzung, $gremium = null) {
  if ($zugriff['rolle'] === 'admin') return true;
  if ($zugriff['rolle'] === 'gremium') return ($zugriff['rechte']['sitzungen'] ?? '') === 'bearbeiten';
  if ($zugriff['rolle'] !== 'person') return false;
  if ($gremium && !empty(rolleRechte($gremium, $zugriff['personId'] ?? '')['zugriffe'])) return true;
  return $sitzung && istLeitung($sitzung, $zugriff['personId'] ?? '');
}

// «Ansehen als …»: befristete Ansicht (zwei Stunden, nur lesen) aus Sicht einer Person. Wer das ganze Gremium verwaltet
// (Superadmin, Eigentümer, Gremium-Zugang mit Bearbeitungsrecht, Rolle «Zugriffe verwalten»), sieht alles, was die Person
// sieht; wer nur eine Sitzung verwaltet (Leitung, Protokollführung), nur diese Sitzung.
if ($aktion === 'ansicht_starten') {
  if (!$eigenes) antwort(['fehler' => 'Kein Zugriff auf dieses Gremium'], 403);
  $personId = (string) ($eingabe['personId'] ?? '');
  $sitzungId = (string) ($eingabe['sitzungId'] ?? '');
  $ergebnis = bundleAendern($gremiumId, function (array &$bundle) use ($zugriff, $personId, $sitzungId) {
    $gremiumweit = verwaltetSitzung($zugriff, null, $bundle['gremium']);
    $sitzung = $sitzungId !== '' ? sitzungVon($bundle, $sitzungId) : null;
    if (!$gremiumweit && !($sitzung && verwaltetSitzung($zugriff, $sitzung, $bundle['gremium']))) return ['fehler' => 'Ansehen als … dürfen nur, wer die Zugriffe verwaltet'];
    if (personDaten($bundle, $personId)['name'] === '') return ['fehler' => 'Person nicht gefunden'];
    $token = 'ansicht' . bin2hex(random_bytes(20));
    $bundle['ansichten'] = array_values(array_filter($bundle['ansichten'] ?? [], fn($a) => $a['bis'] >= time()));
    $bundle['ansichten'][] = ['token' => $token, 'personId' => $personId, 'sitzungId' => $gremiumweit ? null : $sitzungId, 'bis' => time() + 7200];
    return ['token' => $token];
  });
  if (!empty($ergebnis['fehler'])) antwort($ergebnis, 403);
  antwort($ergebnis);
}

// Einladung oder Vorprotokoll per E-Mail an ausgewählte Mitglieder und Gäste (wer die Sitzung verwaltet). Jede Person
// erhält ihren persönlichen Link, Zusagen / Absagen, einen Kalendereintrag und den Link zum Abbestellen.
if ($aktion === 'einladung_senden') {
  if (!$eigenes) antwort(['fehler' => 'Kein Zugriff auf dieses Gremium'], 403);
  $sitzungId = (string) ($eingabe['sitzungId'] ?? '');
  $art = ($eingabe['art'] ?? '') === 'vorprotokoll' ? 'vorprotokoll' : 'einladung';
  $nachricht = trim(textKuerzen((string) ($eingabe['nachricht'] ?? ''), 4000));
  $personIds = array_values(array_unique(array_map('strval', (array) ($eingabe['personIds'] ?? []))));
  $bundle = lesen(dateiVon($gremiumId));
  $s = $bundle ? sitzungVon($bundle, $sitzungId) : null;
  $vp = $bundle ? vorprotokollVon($bundle, $sitzungId) : null;
  if (!$s || !$vp) antwort(['fehler' => 'Sitzung nicht gefunden'], 404);
  $darfEinladen = in_array($rolle, ['admin'], true) || ($rolle === 'gremium' && ($zugriff['rechte']['sitzungen'] ?? '') === 'bearbeiten')
    || ($rolle === 'person' && (istLeitung($s, $zugriff['personId']) || sitzungsrecht($bundle['gremium'], $zugriff['personId'], 'einladungen')));
  if (!$darfEinladen) antwort(['fehler' => 'Einladungen senden darf, wer die Sitzung leitet oder protokolliert oder das Recht «Einladungen senden» hat'], 403);
  if (empty($s['datum'])) antwort(['fehler' => 'Die Sitzung hat noch keinen Termin.'], 400);
  if (protokollVon($bundle, $sitzungId)) antwort(['fehler' => 'Die Sitzung hat schon begonnen.'], 409);

  $basis = basisUrl();
  $gremiumName = $bundle['gremium']['name'];
  $titel = $s['titel'] ?: 'Sitzung';
  $aus = $bundle['einladungenAus'] ?? [];
  $traktanden = '';
  foreach (array_values($vp['traktanden']) as $i => $t) $traktanden .= ($i + 1) . '. ' . ($t['titel'] ?: 'Ohne Titel') . "\n";
  $ics = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Ormeet//Sitzungsprotokolle//DE\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n"
    . icalEvent('sitzung-' . $s['id'], $s['datum'], ($s['zeit'] ?? '') ?: null, null, "$titel – $gremiumName", '', $s['ort'] ?? '', 'CONFIRMED') . "END:VCALENDAR\r\n";

  $gesendet = [];
  $fehler = [];
  foreach ($personIds as $pid) {
    $p = personDaten($bundle, $pid);
    $email = trim($p['email'] ?? '');
    if ($p['name'] === '') continue;
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) { $fehler[] = ['name' => $p['name'], 'grund' => 'keine E-Mail-Adresse']; continue; }
    if (in_array(strtolower($email), $aus, true)) { $fehler[] = ['name' => $p['name'], 'grund' => 'hat Einladungen abbestellt']; continue; }
    $link = einladungLink($bundle, $vp, $pid, $basis);
    if ($link === '') { $fehler[] = ['name' => $p['name'], 'grund' => 'kein persönlicher Link']; continue; }
    $antwortLink = $basis . '#/einladung/' . einladungCode($gremiumId, $sitzungId, $pid);
    $text = "Hallo {$p['name']}\n\n"
      . ($art === 'vorprotokoll' ? "Hier ist das Vorprotokoll der Sitzung «{$titel}» ({$gremiumName}).\n\n" : "Du bist zur Sitzung «{$titel}» ({$gremiumName}) eingeladen.\n\n")
      . 'Termin: ' . einladungTermin($s) . "\n" . (!empty($s['ort']) ? "Ort: {$s['ort']}\n" : '')
      . ($nachricht !== '' ? "\n$nachricht\n" : '')
      . ($art === 'vorprotokoll' && $traktanden !== '' ? "\nTraktanden:\n$traktanden" : '')
      . "\nZur Sitzung (dein persönlicher Link):\n$link\n"
      . "\nZusagen: $antwortLink?antwort=zusagen\nAbsagen: $antwortLink?antwort=absagen\n"
      . "Ohne Antwort gilt die Einladung als angenommen.\n"
      . "\nKeine Einladungen von «{$gremiumName}» mehr erhalten: $antwortLink?abbestellen=1\n";
    $betreff = ($art === 'vorprotokoll' ? 'Vorprotokoll' : 'Einladung') . ": $titel – " . datumText($s['datum']);
    $mailFehler = mailSenden($email, $betreff, $text, ['name' => 'sitzung.ics', 'typ' => 'text/calendar', 'inhalt' => $ics]);
    if ($mailFehler) { $fehler[] = ['name' => $p['name'], 'grund' => $mailFehler]; continue; }
    $gesendet[] = $pid;
  }
  $einladungen = bundleAendern($gremiumId, function (array &$bundle) use ($sitzungId, $gesendet, $art) {
    foreach ($gesendet as $pid) {
      $bundle['einladungen'][$sitzungId][$pid] ??= ['gesendet' => [], 'antwort' => '', 'grund' => ''];
      $bundle['einladungen'][$sitzungId][$pid]['gesendet'][] = ['art' => $art, 'am' => date('c')];
    }
    return $bundle['einladungen'][$sitzungId] ?? [];
  });
  antwort(['gesendet' => count($gesendet), 'fehler' => $fehler, 'einladungen' => $einladungen ?: new stdClass()]);
}

// Passwort eines allgemeinen Links setzen oder entfernen (ref: link:<id> | freigabe:<vorprotokollId> | zugang:<id>)
if ($aktion === 'link_passwort') {
  if (!$eigenes) antwort(['fehler' => 'Kein Zugriff auf dieses Gremium'], 403);
  $ref = (string) ($eingabe['ref'] ?? '');
  $passwort = (string) ($eingabe['passwort'] ?? '');
  if ($passwort !== '' && strlen($passwort) < 4) antwort(['fehler' => 'Das Passwort braucht mindestens 4 Zeichen'], 400);
  $fehler = bundleAendern($gremiumId, function (array &$bundle) use ($zugriff, $ref, $passwort) {
    [$art, $id] = array_pad(explode(':', $ref, 2), 2, '');
    $sitzung = null;
    if ($art === 'zugang') {
      if (!in_array($id, array_column($bundle['gremium']['zugaenge'] ?? [], 'id'), true)) return 'Link nicht gefunden';
      if ($zugriff['rolle'] !== 'admin') return 'Gremium-Links schützen nur Eigentümer und Superadmin';
    } else {
      foreach ($bundle['sitzungen'] as $s) foreach ($s['links'] ?? [] as $l) if ($art === 'link' && $l['id'] === $id) $sitzung = $s;
      foreach ($bundle['vorprotokolle'] as $vp) if ($art === 'freigabe' && $vp['id'] === $id) $sitzung = sitzungVon($bundle, $vp['sitzungId']);
      if (!$sitzung) return 'Link nicht gefunden';
      if (!verwaltetSitzung($zugriff, $sitzung, $bundle['gremium'])) return 'Links schützen nur Sitzungsleitung, Protokollführung, Eigentümer und Superadmin';
    }
    if ($passwort === '') unset($bundle['linkSchutz'][$ref]);
    else $bundle['linkSchutz'][$ref] = password_hash($passwort, PASSWORD_DEFAULT);
    return null;
  });
  if ($fehler) antwort(['fehler' => $fehler], 403);
  antwort(['ok' => true]);
}

// «Weitere Person» (über einen allgemeinen Link dazugekommen) mit einem Mitglied oder einem anderen Gast der Sitzung
// zusammenführen: Stimmen und Kommentare gehen über, die Person ist wieder in der Terminfindung dabei, ein Konto wird
// übernommen, sofern das Ziel noch keines hat, und ihr bisheriger Link öffnet künftig als das Ziel (aliasKeys).
// vorschlag_ablehnen: Vorschlag zum Zusammenführen verwerfen. Dürfen: Superadmin / Eigentümer, Gremium-Zugang mit
// Bearbeitungsrecht auf Sitzungen, Sitzungsleitung und Protokollführung der Sitzung sowie Präsidium / Aktuariat.
// weitere_person_aufnehmen: die weitere Person wird Mitglied des Gremiums (Rolle frei wählbar) und mit dem neuen Mitglied
// zusammengeführt – nur wer die Mitglieder verwaltet (Superadmin, Eigentümer, Gremium-Zugang «Mitglieder bearbeiten»).
if ($aktion === 'weitere_person_verknuepfen' || $aktion === 'vorschlag_ablehnen' || $aktion === 'weitere_person_aufnehmen') {
  $gastId = (string) ($eingabe['gastId'] ?? '');
  $zielId = (string) ($eingabe['zielId'] ?? $eingabe['mitgliedId'] ?? '');
  $rolleId = (string) ($eingabe['rolleId'] ?? '');
  $fehler = bundleAendern($gremiumId, function (array &$bundle) use ($zugriff, $rolle, $aktion, $gastId, &$zielId, $rolleId) {
    $vpIndex = null;
    $gast = null;
    foreach ($bundle['vorprotokolle'] as $i => $vp) foreach ($vp['gaeste'] as $g) if ($g['id'] === $gastId && !empty($g['weiterePerson'])) { $vpIndex = $i; $gast = $g; }
    if ($vpIndex === null) return 'Diese Person wurde nicht gefunden';
    $vp = $bundle['vorprotokolle'][$vpIndex];
    $sitzungId = $vp['sitzungId'];
    $sitzungIndex = null;
    foreach ($bundle['sitzungen'] as $i => $s) if ($s['id'] === $sitzungId) $sitzungIndex = $i;
    $ich = personDaten($bundle, $zugriff['personId'] ?? '');
    $darf = $rolle === 'admin' || ($rolle === 'gremium' && ($zugriff['rechte']['sitzungen'] ?? '') === 'bearbeiten')
      || ($rolle === 'person' && (($sitzungIndex !== null && istLeitung($bundle['sitzungen'][$sitzungIndex], $ich['id'])) || hatFesteRolle($bundle['gremium'], $ich) || !empty(rolleRechte($bundle['gremium'], $ich['id'])['zugriffe'])));
    if ($aktion === 'weitere_person_aufnehmen') {
      if ($rolle !== 'admin' && !($rolle === 'gremium' && ($zugriff['rechte']['mitglieder'] ?? '') === 'bearbeiten')) return 'Mitglieder aufnehmen darf nur, wer die Mitglieder verwaltet';
      if (!in_array($rolleId, array_column($bundle['gremium']['rollen'], 'id'), true)) return 'Bitte eine Rolle wählen';
      $zielId = uuid();
      $bundle['gremium']['mitglieder'][] = ['id' => $zielId, 'name' => $gast['name'], 'email' => $gast['email'] ?? '', 'rolleId' => $rolleId, 'hatStimmrecht' => true,
                                            'zugangsKey' => bin2hex(random_bytes(8)), 'benutzerId' => null];
      $darf = true;
    }
    if (!$darf) return 'Zusammenführen dürfen nur Sitzungsleitung, Protokollführung, wer Sitzungen eintragen oder Zugriffe verwalten darf, Eigentümer und Superadmin';

    if ($aktion === 'vorschlag_ablehnen') {
      foreach ($bundle['vorprotokolle'][$vpIndex]['gaeste'] as &$g) if ($g['id'] === $gastId && isset($g['vorschlag'])) $g['vorschlag']['status'] = 'abgelehnt';
      return null;
    }

    $mitglied = null;
    foreach ($bundle['gremium']['mitglieder'] as $i => $m) if ($m['id'] === $zielId) $mitglied = $i;
    $zielGast = null;
    foreach ($vp['gaeste'] as $i => $g) if ($g['id'] === $zielId && $zielId !== $gastId) $zielGast = $i;
    if ($mitglied === null && $zielGast === null) return 'Person nicht gefunden';
    $konten = array_merge(array_column($bundle['gremium']['mitglieder'], 'benutzerId'), array_column($vp['gaeste'], 'benutzerId'));
    $kontoFrei = !empty($gast['benutzerId']) && count(array_keys($konten, $gast['benutzerId'], true)) === 1; // nur bei dieser Person
    if ($mitglied !== null) {
      if (empty($bundle['gremium']['mitglieder'][$mitglied]['benutzerId']) && $kontoFrei) $bundle['gremium']['mitglieder'][$mitglied]['benutzerId'] = $gast['benutzerId'];
      $name = $bundle['gremium']['mitglieder'][$mitglied]['name'];
    } else {
      if (empty($vp['gaeste'][$zielGast]['benutzerId']) && $kontoFrei) $vp['gaeste'][$zielGast]['benutzerId'] = $gast['benutzerId'];
      $name = $vp['gaeste'][$zielGast]['name'];
    }

    if ($sitzungIndex !== null) {
      $s = $bundle['sitzungen'][$sitzungIndex];
      if (!empty($s['terminfindung'])) {
        $tf = $s['terminfindung'];
        $hatStimme = in_array($zielId, array_column($tf['stimmen'], 'personId'), true);
        $stimmen = [];
        foreach ($tf['stimmen'] as $st) {
          if (($st['personId'] ?? null) === $gastId) {
            if ($hatStimme) continue; // das Ziel hat schon selbst abgestimmt
            $st['personId'] = $zielId;
            $st['name'] = $name;
          }
          $stimmen[] = $st;
        }
        $tf['stimmen'] = $stimmen;
        foreach ($tf['kommentare'] as $k => $kommentar) if (($kommentar['personId'] ?? null) === $gastId) $tf['kommentare'][$k]['personId'] = $zielId;
        $tf['entfernt'] = array_values(array_diff($tf['entfernt'] ?? [], [$zielId, $gastId]));
        $s['terminfindung'] = $tf;
      }
      foreach ($s['freigaben'] ?? [] as $dokument => $liste) if (is_array($liste)) unset($s['freigaben'][$dokument][$gastId]);
      $s['gesperrt'] = array_values(array_diff($s['gesperrt'] ?? [], [$gastId]));
      $s['nurLesen'] = array_values(array_diff($s['nurLesen'] ?? [], [$gastId]));
      $bundle['sitzungen'][$sitzungIndex] = $s;
    }

    // Bisheriger Link der Person öffnet künftig als das Ziel
    $keys = (array) $vp['personenKeys'];
    $alias = (array) ($vp['aliasKeys'] ?? []);
    foreach ($alias as $key => $personId) if ($personId === $gastId) $alias[$key] = $zielId;
    if (!empty($keys[$gastId])) $alias[$keys[$gastId]] = $zielId;
    unset($keys[$gastId]);
    $vp['personenKeys'] = $keys;
    $vp['aliasKeys'] = $alias;
    $vp['gaeste'] = array_values(array_filter($vp['gaeste'], fn($g) => $g['id'] !== $gastId));
    foreach ($vp['gaeste'] as &$g) if (($g['vorschlag']['personId'] ?? null) === $gastId) unset($g['vorschlag']);
    unset($g);
    $hatProtokoll = in_array($sitzungId, array_column($bundle['protokolle'], 'sitzungId'), true);
    if ($mitglied !== null && !$hatProtokoll && istErwartet($bundle['gremium'], $zielId) && !in_array($zielId, $vp['anwesendeMitgliederIds'], true)) $vp['anwesendeMitgliederIds'][] = $zielId;
    $bundle['vorprotokolle'][$vpIndex] = $vp;
    return null;
  });
  if ($fehler) antwort(['fehler' => $fehler], 403);
  antwort(['ok' => true]);
}

// Angemeldetes Konto mit dem Mitglied hinter einem persönlichen Link verknüpfen
if ($aktion === 'verknuepfen') {
  if (!$konto) antwort(['fehler' => 'Kein Konto angemeldet'], 403);
  $link = linkZugriff($eingabe['key'] ?? '');
  if (!$link || $link['rolle'] !== 'person') antwort(['fehler' => 'Das ist kein persönlicher Link'], 400);
  if (!mitgliedVerknuepfen($link['gremiumId'], $link['personId'], $konto['benutzerId'])) {
    antwort(['fehler' => 'Dein Konto ist in diesem Gremium schon mit einem anderen Mitglied verknüpft, oder dieses Mitglied hat schon ein anderes Konto.'], 409);
  }
  antwort(['ok' => true, 'gremiumId' => $link['gremiumId']]);
}

// --- Benutzerverwaltung und Einstellungen (nur Superadmin) --------
if (in_array($aktion, ['benutzer_aendern', 'benutzer_loeschen', 'einstellungen_lesen', 'einstellungen_speichern', 'mail_testen', 'cron_jetzt', 'superadmin_konto'], true) && !$istSuperadmin) {
  antwort(['fehler' => 'Nur der Superadmin kann Konten und Einstellungen verwalten'], 403);
}

if ($aktion === 'benutzer_aendern') {
  $benutzer = benutzerLesen();
  $i = benutzerById($benutzer, $eingabe['id'] ?? '');
  if ($i === null) antwort(['fehler' => 'Konto nicht gefunden'], 404);
  $b = &$benutzer[$i];
  if (isset($eingabe['darfGremienAnlegen'])) $b['darfGremienAnlegen'] = (bool) $eingabe['darfGremienAnlegen'];
  if (isset($eingabe['darfKurzsitzungenAnlegen'])) $b['darfKurzsitzungenAnlegen'] = (bool) $eingabe['darfKurzsitzungenAnlegen'];
  if (isset($eingabe['name']) && trim($eingabe['name']) !== '') $b['name'] = trim($eingabe['name']);
  if (isset($eingabe['passwortNeu'])) {
    if (strlen($eingabe['passwortNeu']) < 8) antwort(['fehler' => 'Das Passwort braucht mindestens 8 Zeichen'], 400);
    $b['passwortHash'] = password_hash($eingabe['passwortNeu'], PASSWORD_DEFAULT);
  }
  if (!empty($eingabe['alleAbmelden'])) $b['anmeldungen'] = [];
  unset($b);
  benutzerSchreiben($benutzer);
  antwort(['ok' => true, 'benutzer' => benutzerOeffentlich($benutzer[$i])]);
}

// Superadmin mit einem Konto verknüpfen (oder lösen): er sieht dann dessen persönliche Übersicht
if ($aktion === 'superadmin_konto') {
  $id = $eingabe['benutzerId'] ?? null;
  if ($id !== null && benutzerById(benutzerLesen(), $id) === null) antwort(['fehler' => 'Konto nicht gefunden'], 404);
  $superadmin = superadminLesen();
  $superadmin['benutzerId'] = $id;
  jsonSchreiben(SUPERADMIN_DATEI, $superadmin);
  antwort(['ok' => true]);
}

if ($aktion === 'benutzer_loeschen') {
  $benutzer = benutzerLesen();
  $i = benutzerById($benutzer, $eingabe['id'] ?? '');
  if ($i === null) antwort(['fehler' => 'Konto nicht gefunden'], 404);
  $id = $benutzer[$i]['id'];
  array_splice($benutzer, $i, 1);
  benutzerSchreiben($benutzer);
  // Verknüpfungen lösen; eigene Gremien gehen an den Superadmin über
  foreach (benutzerGremien($id) as $g) {
    if ($g['rolle'] === 'mitglied') mitgliedVerknuepfen($g['gremiumId'], $g['personId'], null);
    else {
      $bundle = lesen(dateiVon($g['gremiumId']));
      $bundle['gremium']['eigentuemerId'] = null;
      dateiSchreiben(dateiVon($g['gremiumId']), json_encode($bundle, JSON_UNESCAPED_UNICODE));
    }
  }
  antwort(['ok' => true]);
}

if ($aktion === 'einstellungen_lesen') {
  $e = einstellungenLesen();
  // Cron: Schlüssel beim ersten Öffnen erzeugen; Adresse merken (der Cronjob kennt sie nicht selbst)
  if (empty($e['cronSchluessel']) || ($e['basisUrl'] ?? '') !== basisUrl()) {
    $e['cronSchluessel'] = ($e['cronSchluessel'] ?? '') ?: bin2hex(random_bytes(16));
    $e['basisUrl'] = basisUrl();
    jsonSchreiben(EINSTELLUNGEN_DATEI, $e);
  }
  $e['sso'] = (object) $e['sso']; // leer als {} statt []
  $e['mail'] = mailEinstellungen();
  $e['mailStunde'] = (int) ($e['mailStunde'] ?? 7);
  $e['cron'] = cronAngaben($e);
  unset($e['cronSchluessel']);
  antwort($e + ['callback' => basisUrl() . 'api.php?aktion=sso_callback', 'anbieter' => array_map(fn($a) => $a['name'], SSO_ANBIETER)]);
}

if ($aktion === 'einstellungen_speichern') {
  $e = einstellungenLesen();
  if (isset($eingabe['sso'])) {
    $e['sso'] = [];
    foreach (SSO_ANBIETER as $id => $anbieter) {
      $k = $eingabe['sso'][$id] ?? [];
      $e['sso'][$id] = ['url' => trim($k['url'] ?? ''), 'clientId' => trim($k['clientId'] ?? ''), 'clientSecret' => trim($k['clientSecret'] ?? '')];
    }
  }
  if (isset($eingabe['mailStunde'])) $e['mailStunde'] = max(0, min(23, (int) $eingabe['mailStunde']));
  if (isset($eingabe['mail'])) {
    $m = $eingabe['mail'];
    $e['mail'] = ['absender' => trim((string) ($m['absender'] ?? '')), 'absenderName' => trim((string) ($m['absenderName'] ?? '')), 'host' => trim((string) ($m['host'] ?? '')),
                  'port' => (int) ($m['port'] ?? 587), 'sicherheit' => in_array($m['sicherheit'] ?? '', ['tls', 'ssl', ''], true) ? $m['sicherheit'] : 'tls',
                  'benutzer' => trim((string) ($m['benutzer'] ?? '')), 'passwort' => (string) ($m['passwort'] ?? '')];
  }
  jsonSchreiben(EINSTELLUNGEN_DATEI, $e);
  antwort(['ok' => true]);
}

// Cron von Hand auslösen (Superadmin): sendet die fälligen Sammelmails sofort
if ($aktion === 'cron_jetzt') antwort(['ok' => true] + cronLauf());

// Test-Nachricht mit den gespeicherten Einstellungen
if ($aktion === 'mail_testen') {
  $an = trim((string) ($eingabe['an'] ?? ''));
  if (!filter_var($an, FILTER_VALIDATE_EMAIL)) antwort(['fehler' => 'Bitte eine gültige E-Mail-Adresse angeben'], 400);
  $fehler = mailSenden($an, 'Ormeet: Test-Nachricht', "Diese Nachricht bestätigt, dass Ormeet E-Mails versenden kann.

Ormeet");
  if ($fehler) antwort(['fehler' => $fehler], 502);
  antwort(['ok' => true]);
}

antwort(['fehler' => 'Unbekannte Aktion'], 400);
