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
  'orki' => ['name' => 'Orki', 'authorize' => '/_/call/oidc/authorize', 'token' => '/_/call/oidc/token', 'userinfo' => '/_/call/oidc/userinfo'],
];
const GITHUB_REPO = 'orki-ch/ormeet'; // Herkunft für automatische Updates (GitHub-Releases)
const VOLLE_RECHTE = ['sitzungen' => 'bearbeiten', 'mitglieder' => 'bearbeiten', 'einstellungen' => 'bearbeiten'];

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
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
  foreach ($bundle['vorprotokolle'] as &$vp) {
    if (empty($vp['personenKeys'])) $vp['personenKeys'] = new stdClass();
  }
  return $bundle;
}

function lesen($datei) {
  $bundle = json_decode(dateiLesen($datei), true);
  return $bundle ? normalisiere($bundle) : null;
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
  return ['id' => uuid(), 'name' => $name, 'email' => $email, 'passwortHash' => '', 'sso' => [], 'darfGremienAnlegen' => false,
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

function superadminZugriff($token) {
  foreach (superadminLesen()['anmeldungen'] as $a) if (hash_equals($a['token'], $token)) return ['rolle' => 'admin'];
  return null;
}

// Passwort-Raten bremsen: höchstens 10 Fehlversuche pro Adresse in 15 Minuten
function anmeldeSperrePruefen() {
  $versuche = jsonLesen(VERSUCHE_DATEI, [])[$_SERVER['REMOTE_ADDR'] ?? ''] ?? [];
  if (count(array_filter($versuche, fn($t) => $t > time() - 900)) >= 10) antwort(['fehler' => 'Zu viele Fehlversuche – bitte in 15 Minuten erneut versuchen'], 429);
}

function fehlversuch($text) {
  $alle = [];
  foreach (jsonLesen(VERSUCHE_DATEI, []) as $adresse => $zeiten) {
    $zeiten = array_values(array_filter($zeiten, fn($t) => $t > time() - 900));
    if ($zeiten) $alle[$adresse] = $zeiten;
  }
  $alle[$_SERVER['REMOTE_ADDR'] ?? ''][] = time();
  jsonSchreiben(VERSUCHE_DATEI, $alle);
  usleep(300000);
  antwort(['fehler' => $text], 401);
}

// Konto ohne Geheimnisse (für Superadmin und Kontoinhaber)
function benutzerOeffentlich(array $b) {
  return ['id' => $b['id'], 'name' => $b['name'], 'email' => $b['email'], 'darfGremienAnlegen' => $b['darfGremienAnlegen'], 'hatPasswort' => $b['passwortHash'] !== '',
          'sso' => array_keys($b['sso']), 'erstelltAm' => $b['erstelltAm'], 'letzteAnmeldung' => $b['letzteAnmeldung'], 'geraete' => count($b['anmeldungen'])];
}

function einstellungenLesen() {
  return jsonLesen(EINSTELLUNGEN_DATEI, ['sso' => []]);
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

// Gremien eines Kontos: eigene (Eigentümer) und solche, in denen ein Mitglied mit dem Konto verknüpft ist
function benutzerGremien($benutzerId) {
  $liste = [];
  foreach (alleBundles() as $bundle) {
    $g = $bundle['gremium'];
    if (($g['eigentuemerId'] ?? null) === $benutzerId) {
      $liste[] = ['gremiumId' => $g['id'], 'name' => $g['name'], 'rolle' => 'eigentuemer'];
      continue;
    }
    foreach ($g['mitglieder'] as $m) {
      if (($m['benutzerId'] ?? null) === $benutzerId) {
        // zugangsKey: persönlicher Link des Mitglieds – dient dem Konto als Kalender-Abo (statt des Konto-Tokens)
        $liste[] = ['gremiumId' => $g['id'], 'name' => $g['name'], 'rolle' => 'mitglied', 'personId' => $m['id'], 'personName' => $m['name'], 'zugangsKey' => $m['zugangsKey'] ?? ''];
        break;
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
    return ['rolle' => 'person', 'gremiumId' => $gremiumId, 'personId' => $g['personId'], 'personName' => $g['personName'], 'benutzerId' => $zugriff['benutzerId']];
  }
  return ['rolle' => 'keine', 'gremiumId' => $gremiumId];
}

// Mitglied eines Gremiums mit einem Konto verknüpfen (Datei mit Sperre bearbeiten)
function mitgliedVerknuepfen($gremiumId, $personId, $benutzerId) {
  $datei = dateiVon($gremiumId);
  $handle = fopen($datei, 'c+');
  flock($handle, LOCK_EX);
  $bundle = json_decode(entschluesseln(stream_get_contents($handle)), true);
  if ($bundle) {
    foreach ($bundle['gremium']['mitglieder'] as &$m) {
      if ($m['id'] === $personId) $m['benutzerId'] = $benutzerId;
      elseif (($m['benutzerId'] ?? null) === $benutzerId) $m['benutzerId'] = null; // ein Konto pro Gremium nur einmal
    }
    ftruncate($handle, 0);
    rewind($handle);
    fwrite($handle, verschluesseln(json_encode($bundle, JSON_UNESCAPED_UNICODE)));
  }
  flock($handle, LOCK_UN);
  fclose($handle);
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

// Sitzungsleitung / Protokollführung einer Sitzung: voller Zugriff auf deren Dokumente
function istLeitung(array $sitzung, $personId) {
  foreach (array_merge($sitzung['sitzungsleitung'] ?? [], $sitzung['protokollfuehrung'] ?? []) as $p) {
    if (($p['id'] ?? null) === $personId) return true;
  }
  return false;
}

// Freigabestufe einer Person für ein Dokument (vorprotokoll / protokoll): in der Sitzung gesetzte Freigabe,
// sonst Standard – Leitung «alles», alle anderen «eigene» (zugewiesene Traktanden). «lesen» sperrt alles.
function freigabeStufe(array $sitzung, string $dokument, $personId) {
  $stufe = $sitzung['freigaben'][$dokument][$personId] ?? null;
  if (in_array($stufe, ['lesen', 'eigene', 'alles'], true)) return $stufe;
  return istLeitung($sitzung, $personId) ? 'alles' : 'eigene';
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
    foreach ($vp['traktanden'] as $t) {
      if (($voll || istBerechtigt($t, $person)) && !empty($t['pendenzId'])) $pendenzIds[$t['pendenzId']] = true;
    }
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
  $stimmen = array_values(array_filter($tf['stimmen'], fn($s) => ($s['personId'] ?? null) !== $personId));
  foreach ($neu['terminfindung']['stimmen'] as $s) if (($s['personId'] ?? null) === $personId) $stimmen[] = $s;
  $tf['stimmen'] = $stimmen;
  $vorhanden = array_flip(array_column($tf['kommentare'], 'id'));
  foreach ($neu['terminfindung']['kommentare'] as $k) {
    if (!isset($vorhanden[$k['id']]) && ($k['personId'] ?? null) === $personId) $tf['kommentare'][] = $k;
  }
  $alt['terminfindung'] = $tf;
  return $alt;
}

// Allgemeiner Freigabe-Link (ohne Identität): nur namentliche Stimmen und Kommentare der Terminfindung übernehmen
function sitzungMergeAnonym(array $alt, array $neu) {
  if (empty($alt['terminfindung']) || empty($neu['terminfindung']) || $alt['terminfindung']['status'] !== 'offen') return $alt;
  $tf = $alt['terminfindung'];
  $stimmen = array_values(array_filter($tf['stimmen'], fn($s) => !empty($s['personId'])));
  foreach ($neu['terminfindung']['stimmen'] as $s) if (empty($s['personId'])) $stimmen[] = $s;
  $tf['stimmen'] = $stimmen;
  $vorhanden = array_flip(array_column($tf['kommentare'], 'id'));
  foreach ($neu['terminfindung']['kommentare'] as $k) {
    if (!isset($vorhanden[$k['id']]) && empty($k['personId'])) $tf['kommentare'][] = $k;
  }
  $alt['terminfindung'] = $tf;
  return $alt;
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
      foreach (['mitglieder', 'rollen'] as $feld) $gremium[$feld] = $neu[$feld] ?? $gremium[$feld];
    }
    if (($rechte['einstellungen'] ?? '') === 'bearbeiten') {
      foreach (['name', 'beschreibung', 'fusstext', 'themenbereiche', 'vorlagen'] as $feld) $gremium[$feld] = $neu[$feld] ?? $gremium[$feld];
    }
    $aenderungen['gremium'] = $gremium; // zugaenge bleiben immer unverändert
  }
  return $aenderungen;
}

// Schlüssel bleiben serverseitig erhalten (Zugänge ohne Admin-Rechte erhalten sie nicht und würden sie sonst löschen)
function schluesselBewahren(array $alt, array $neu) {
  foreach (['freigabeLinkKey', 'personenKeys', 'verfolgerKey'] as $feld) {
    if (array_key_exists($feld, $alt)) $neu[$feld] = $alt[$feld];
  }
  return $neu;
}

// Persönliche Zugänge (Mitglied / Gast): Dokumente je nach Berechtigung mergen, Gremium nie ändern
function personRechteAnwenden(array $bundle, array $aenderungen, array $zugriff) {
  $person = personDaten($bundle, $zugriff['personId']);
  $nurVorprotokollId = $zugriff['vorprotokollId'] ?? null; // Gast-Link: nur dieses Vorprotokoll
  unset($aenderungen['gremium'], $aenderungen['geloescht']);
  $sitzungen = indexById($bundle['sitzungen']);

  $vorprotokolle = [];
  foreach ($aenderungen['vorprotokolle'] ?? [] as $neu) {
    if ($nurVorprotokollId && $neu['id'] !== $nurVorprotokollId) continue;
    foreach ($bundle['vorprotokolle'] as $alt) {
      if ($alt['id'] !== $neu['id']) continue;
      $stufe = isset($sitzungen[$alt['sitzungId']]) ? freigabeStufe($sitzungen[$alt['sitzungId']], 'vorprotokoll', $person['id']) : 'eigene';
      if ($stufe === 'lesen') { $vorprotokolle[] = $alt; continue; }
      $vorprotokolle[] = schluesselBewahren($alt, $stufe === 'alles' ? $neu : vorprotokollMerge($alt, $neu, $person));
    }
  }
  $aenderungen['vorprotokolle'] = $vorprotokolle;

  $gastSitzungId = null; // Gast-Link: nur das Protokoll der eigenen Sitzung
  foreach ($bundle['vorprotokolle'] as $vp) if ($vp['id'] === $nurVorprotokollId) $gastSitzungId = $vp['sitzungId'];
  $protokolle = [];
  foreach ($aenderungen['protokolle'] ?? [] as $neu) {
    foreach ($bundle['protokolle'] as $alt) {
      if ($alt['id'] !== $neu['id'] || ($nurVorprotokollId && $alt['sitzungId'] !== $gastSitzungId)) continue;
      $stufe = isset($sitzungen[$alt['sitzungId']]) ? freigabeStufe($sitzungen[$alt['sitzungId']], 'protokoll', $person['id']) : 'eigene';
      $protokolle[] = schluesselBewahren($alt, $stufe === 'alles' ? $neu : protokollMerge($alt, $neu, $person, $bundle));
    }
  }
  $aenderungen['protokolle'] = $protokolle;

  $liste = [];
  foreach ($aenderungen['sitzungen'] ?? [] as $neu) {
    if (!isset($sitzungen[$neu['id']])) continue;
    $alt = $sitzungen[$neu['id']];
    if ($nurVorprotokollId) {
      $gehoert = false;
      foreach ($bundle['vorprotokolle'] as $vp) if ($vp['id'] === $nurVorprotokollId && $vp['sitzungId'] === $alt['id']) $gehoert = true;
      if (!$gehoert) continue;
    }
    // Leitung oder Freigabe «alles» auf einem Dokument darf die Sitzung (Kopfdaten, Freigaben) ändern
    $voll = istLeitung($alt, $person['id']) || freigabeStufe($alt, 'vorprotokoll', $person['id']) === 'alles' || freigabeStufe($alt, 'protokoll', $person['id']) === 'alles';
    $sitzung = $voll ? $neu : sitzungMerge($alt, $neu, $person);
    // Letztes Protokoll genehmigen: wer das Protokoll der genehmigenden Sitzung ganz bearbeiten darf
    $in = $neu['genehmigt']['sitzungId'] ?? null;
    if (!$voll && $in && empty($alt['genehmigt']) && isset($sitzungen[$in]) && freigabeStufe($sitzungen[$in], 'protokoll', $person['id']) === 'alles') {
      $sitzung['genehmigt'] = $neu['genehmigt'];
    }
    $liste[] = $sitzung;
  }
  $aenderungen['sitzungen'] = $liste;
  return $aenderungen;
}

// Geheime Schlüssel leeren, die der Zugang nicht sehen darf (leer statt entfernt, damit der Client keine neuen erzeugt)
// Gremium-Zugang: Links nur zu Bereichen, die er bearbeiten darf – Verfolger- und Übersichts-Links (nur lesen) schon ab «lesen»
function bereinigen(array $bundle, array $zugriff) {
  $rolle = $zugriff['rolle'];
  if ($rolle === 'admin') return $bundle;
  $bundle['gremium']['zugaenge'] = [];
  $rechte = $rolle === 'gremium' ? $zugriff['rechte'] : [];
  $sitzungen = $rechte['sitzungen'] ?? 'keine';
  if (($rechte['mitglieder'] ?? '') !== 'bearbeiten') foreach ($bundle['gremium']['mitglieder'] as &$m) $m['zugangsKey'] = '';
  if ($sitzungen === 'keine') foreach ($bundle['gremium']['themenbereiche'] as &$tb) $tb['freigabeKey'] = '';
  if ($sitzungen !== 'bearbeiten') foreach ($bundle['vorprotokolle'] as &$vp) { $vp['freigabeLinkKey'] = ''; $vp['personenKeys'] = new stdClass(); }
  if ($sitzungen === 'keine') foreach ($bundle['protokolle'] as &$p) $p['verfolgerKey'] = '';
  unset($m, $tb, $vp, $p);
  if ($sitzungen === 'bearbeiten') return $bundle;
  // Verdeckte Terminfindung: nur die eigene Stimme sichtbar
  foreach ($bundle['sitzungen'] as &$s) {
    if (!empty($s['terminfindung']['verdeckt'])) {
      $eigene = $zugriff['personId'] ?? null;
      $s['terminfindung']['stimmen'] = array_values(array_filter($s['terminfindung']['stimmen'], fn($st) => ($st['personId'] ?? null) === $eigene));
    }
  }
  return $bundle;
}

// --- Token und Aktion ----------------------------------------------
$token = $_SERVER['HTTP_X_TOKEN'] ?? '';
if ($token === '' && ($_GET['aktion'] ?? '') === 'ical') $token = $_GET['token'] ?? ''; // Kalender-Abo: Token als Parameter
$aktion = $_GET['aktion'] ?? '';
$eingabe = $_SERVER['REQUEST_METHOD'] === 'POST' ? json_decode(file_get_contents('php://input'), true) : null;

// Zugriff für einen Link-Token (Gremium-Zugang, persönlicher Link, Freigabe, Verfolger, Übersicht)
function linkZugriff($token) {
  foreach (alleBundles() as $bundle) {
    $gremiumId = $bundle['gremium']['id'];
    foreach ($bundle['gremium']['zugaenge'] ?? [] as $zugang) {
      if (hash_equals($zugang['key'], $token)) return ['rolle' => 'gremium', 'gremiumId' => $gremiumId, 'rechte' => $zugang['rechte'], 'zugangName' => $zugang['name']];
    }
    if (hash_equals($bundle['gremium']['zugangsKey'] ?? '', $token)) {
      return ['rolle' => 'gremium', 'gremiumId' => $gremiumId, 'zugangName' => 'Vollzugriff', 'rechte' => VOLLE_RECHTE];
    }
    foreach ($bundle['gremium']['mitglieder'] as $m) {
      if (hash_equals($m['zugangsKey'] ?? '', $token)) {
        return ['rolle' => 'person', 'gremiumId' => $gremiumId, 'personId' => $m['id'], 'personName' => $m['name'], 'personEmail' => $m['email'] ?? '', 'benutzerId' => $m['benutzerId'] ?? null];
      }
    }
    foreach ($bundle['gremium']['themenbereiche'] as $tb) {
      if (hash_equals($tb['freigabeKey'] ?? '', $token)) return ['rolle' => 'themenbereich', 'gremiumId' => $gremiumId, 'themenbereichId' => $tb['id']];
    }
    foreach ($bundle['protokolle'] as $protokoll) {
      if (hash_equals($protokoll['verfolgerKey'] ?? '', $token)) return ['rolle' => 'verfolger', 'gremiumId' => $gremiumId, 'protokollId' => $protokoll['id']];
    }
    foreach ($bundle['vorprotokolle'] as $vorprotokoll) {
      if (hash_equals($vorprotokoll['freigabeLinkKey'], $token)) return ['rolle' => 'freigabe', 'gremiumId' => $gremiumId, 'vorprotokollId' => $vorprotokoll['id']];
      foreach ($vorprotokoll['personenKeys'] ?? [] as $personId => $key) {
        if (hash_equals($key, $token)) {
          return ['rolle' => 'freigabe', 'gremiumId' => $gremiumId, 'vorprotokollId' => $vorprotokoll['id'],
                  'personId' => $personId, 'personName' => personDaten($bundle, $personId)['name']];
        }
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
                'hatPasswort' => $b['passwortHash'] !== '', 'sso' => array_keys($b['sso']), 'gremien' => benutzerGremien($b['id'])];
      }
    }
  }
  return null;
}

$zugriff = null;
if ($token !== '') $zugriff = superadminZugriff($token) ?? kontoZugriff($token, benutzerLesen()) ?? linkZugriff($token);

// --- Konto: Anmelden, Registrieren, SSO (ohne gültigen Token erreichbar) ---------------
function tokenAntwort(array $benutzer, $i) {
  $token = anmeldungAnlegen($benutzer[$i]);
  benutzerSchreiben($benutzer);
  antwort(['token' => $token]);
}

// Persönlicher Link als Token: dieses Mitglied mit dem Konto verknüpfen
function linkVerknuepfen($zugriff, $benutzerId) {
  if ($zugriff && $zugriff['rolle'] === 'person') mitgliedVerknuepfen($zugriff['gremiumId'], $zugriff['personId'], $benutzerId);
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
  linkVerknuepfen($zugriff, $benutzer[$i]['id']);
  tokenAntwort($benutzer, $i);
}

if ($aktion === 'registrieren') {
  // Nur über einen persönlichen Link (oder durch den Superadmin) – so gehört jedes Konto zu einer bekannten Person
  if (!$zugriff || !in_array($zugriff['rolle'], ['person', 'admin'], true)) antwort(['fehler' => 'Ein Konto kann nur über einen persönlichen Link erstellt werden'], 403);
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
  linkVerknuepfen($zugriff, $neu['id']);
  if ($zugriff['rolle'] === 'admin') {
    benutzerSchreiben($benutzer);
    antwort(['ok' => true, 'benutzer' => benutzerOeffentlich($neu)]);
  }
  tokenAntwort($benutzer, count($benutzer) - 1);
}

// SSO: Weiterleitung zum Anbieter; Zustand signiert im state-Parameter (kein Sitzungsspeicher nötig)
function ssoSignatur($daten) {
  return hash_hmac('sha256', $daten, hash('sha256', ADMIN_PASSWORT . '|sso'));
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
  $daten = base64_encode(json_encode(['anbieter' => $id, 'verknuepfen' => $_GET['verknuepfen'] ?? '', 'weiter' => $_GET['weiter'] ?? '', 'zeit' => time(), 'nonce' => $nonce]));
  $state = $daten . '.' . ssoSignatur($daten);
  $url = rtrim($anbieter['url'], '/') . $anbieter['authorize'] . '?' . http_build_query([
    'response_type' => 'code', 'client_id' => $anbieter['clientId'], 'redirect_uri' => basisUrl() . 'api.php?aktion=sso_callback',
    'scope' => 'openid email profile', 'state' => $state,
  ]);
  header('Location: ' . $url, true, 302);
  exit;
}

if ($aktion === 'sso_callback') {
  $fehlerSeite = fn($text) => header('Location: ' . basisUrl() . '#/login?fehler=' . rawurlencode($text), true, 302);
  [$daten, $signatur] = array_pad(explode('.', $_GET['state'] ?? '', 2), 2, '');
  $state = json_decode(base64_decode($daten), true);
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
  if (empty($info['sub']) || empty($info['email'])) { $fehlerSeite('Der Anbieter hat keine Benutzerdaten geliefert'); exit; }

  $benutzer = benutzerLesen();
  $i = null;
  foreach ($benutzer as $k => $b) if (($b['sso'][$state['anbieter']] ?? null) === $info['sub']) $i = $k;
  if ($i === null) $i = benutzerByEmail($benutzer, $info['email']); // gleiche E-Mail: bestehendes Konto verknüpfen
  if ($i === null) {
    $name = trim($info['name'] ?? trim(($info['given_name'] ?? '') . ' ' . ($info['family_name'] ?? ''))) ?: ($info['preferred_username'] ?? $info['email']);
    $benutzer[] = neuerBenutzer($name, $info['email']);
    $i = count($benutzer) - 1;
  }
  $benutzer[$i]['sso'][$state['anbieter']] = $info['sub'];
  if ($state['verknuepfen'] !== '') linkVerknuepfen(linkZugriff($state['verknuepfen']), $benutzer[$i]['id']);
  $neuerToken = anmeldungAnlegen($benutzer[$i]);
  benutzerSchreiben($benutzer);
  $weiter = $state['weiter'] !== '' && $state['weiter'][0] === '/' ? '?weiter=' . rawurlencode($state['weiter']) : '';
  header('Location: ' . basisUrl() . '#/zugang/' . $neuerToken . $weiter, true, 302);
  exit;
}

if (!$zugriff) antwort(['fehler' => 'Passwort oder Link ungültig'], 401);

$gremiumId = $_GET['gremium'] ?? '';
$konto = $zugriff['rolle'] === 'benutzer' ? $zugriff : null; // Konto: für das angefragte Gremium gilt die dortige Rolle
if ($konto && $gremiumId !== '') $zugriff = effektiverZugriff($konto, $gremiumId);
$rolle = $zugriff['rolle'];
$istAdmin = $rolle === 'admin';
$istSuperadmin = $istAdmin && !$konto;
$eigenes = $istSuperadmin || ($zugriff['gremiumId'] ?? null) === $gremiumId;

// --- Kalender-Abo (iCal) für persönliche Zugänge -----------------
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
    $vp = "Vorprotokoll: " . $link('/sitzung/' . $s['id'] . '/vorprotokoll');
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
      if ($e['typ'] !== 'pendenz' || ($e['zugewiesenAn'] ?? null) !== $personId || $e['pendenzStatus'] === 'erfuellt' || empty($e['faelligBis'])) continue;
      $events .= icalEvent('pendenz-' . $e['id'], $e['faelligBis'], null, null, 'Pendenz: ' . $e['titel'],
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
if ($aktion === 'laden') {
  if ($konto) {
    // Konto: alle eigenen Gremien, je nach dortiger Rolle bereinigt
    $bundles = [];
    foreach ($konto['gremien'] as $g) {
      $bundle = lesen(dateiVon($g['gremiumId']));
      if ($bundle) $bundles[] = bereinigen($bundle, effektiverZugriff($konto, $g['gremiumId']));
    }
    antwort(['zugriff' => $konto, 'gremien' => $bundles]);
  }
  $bundles = $istAdmin ? alleBundles() : [bereinigen(lesen(dateiVon($zugriff['gremiumId'])), $zugriff)];
  if ($rolle === 'gremium' && ($zugriff['rechte']['sitzungen'] ?? 'keine') === 'keine') {
    $bundles[0]['sitzungen'] = [];
    $bundles[0]['vorprotokolle'] = [];
    $bundles[0]['protokolle'] = [];
  }
  if ($rolle === 'freigabe') {
    // Vorprotokoll-Link: aus den Protokollen nur Pendenzen und vertagte / neu behandelte Anträge mitgeben (für den Übertrag)
    foreach ($bundles[0]['protokolle'] as &$protokoll) {
      $protokoll['eintraege'] = array_values(array_filter($protokoll['eintraege'], fn($e) => $e['typ'] === 'pendenz' || ($e['typ'] === 'antrag' && (($e['antragStatus'] ?? '') === 'vertagt' || !empty($e['vorherigerAntragId'])))));
    }
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
  if ($neu && $konto && !empty($konto['darfGremienAnlegen']) && isset($aenderungen['gremium'])) {
    // Konto mit Freigabe legt ein eigenes Gremium an
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

  if (isset($aenderungen['gremium'])) {
    // Eigentümer und Konto-Verknüpfungen setzt nur der Superadmin; ein Eigentümer behält sein eigenes Gremium
    if ($neu) $aenderungen['gremium']['eigentuemerId'] = $konto['benutzerId'] ?? null;
    elseif (!$istSuperadmin) {
      $aenderungen['gremium']['eigentuemerId'] = $bundle['gremium']['eigentuemerId'] ?? null;
      $alteKonten = array_column($bundle['gremium']['mitglieder'], 'benutzerId', 'id');
      foreach ($aenderungen['gremium']['mitglieder'] as &$m) $m['benutzerId'] = $alteKonten[$m['id']] ?? null;
      unset($m);
    }
  }
  foreach (array_keys($aenderungen['sitzungen'] ?? []) as $k) $aenderungen['sitzungen'][$k]['gremiumId'] = $gremiumId; // eine Sitzung bleibt in ihrem Gremium
  if ($rolle === 'gremium') $aenderungen = gremiumRechteAnwenden($bundle, $aenderungen, $zugriff['rechte']);
  if ($rolle === 'person' || ($rolle === 'freigabe' && isset($zugriff['personId']))) $aenderungen = personRechteAnwenden($bundle, $aenderungen, $zugriff);
  if ($rolle === 'freigabe' && !isset($zugriff['personId'])) {
    // Allgemeiner Freigabe-Link: nur dieses Vorprotokoll
    $erlaubt = [];
    foreach ($aenderungen['vorprotokolle'] ?? [] as $neuVp) {
      if ($neuVp['id'] !== $zugriff['vorprotokollId']) continue;
      foreach ($bundle['vorprotokolle'] as $altVp) if ($altVp['id'] === $neuVp['id']) $erlaubt[] = schluesselBewahren($altVp, $neuVp);
    }
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

  $aenderungen = genehmigungSchuetzen($bundle, $aenderungen);
  $bundle = einarbeiten($bundle, $aenderungen);
  ftruncate($handle, 0);
  rewind($handle);
  fwrite($handle, verschluesseln(json_encode($bundle, JSON_UNESCAPED_UNICODE)));
  flock($handle, LOCK_UN);
  fclose($handle);
  antwort(['ok' => true]);
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

  if ($aktion === 'update_pruefen') antwort(['lokal' => $lokal, 'aktuell' => $aktuell, 'verfuegbar' => $verfuegbar]);

  if (!$verfuegbar) antwort(['fehler' => 'Es ist bereits die aktuelle Version installiert'], 400);

  // Eigene Einstellungen bewahren
  $altesApi = file_get_contents(__DIR__ . '/api.php');
  $altesIndex = file_exists(__DIR__ . '/index.html') ? file_get_contents(__DIR__ . '/index.html') : '';
  $passwort = preg_match("/const ADMIN_PASSWORT = '([^']*)'/", $altesApi, $m) ? $m[1] : null;
  $kontakt = preg_match("/window\.ORMEET_KONTAKT = '([^']*)'/", $altesIndex, $m) ? $m[1] : null;

  $schreiben = function ($name, $inhalt) use ($passwort, $kontakt) {
    if ($name === '' || substr($name, -1) === '/' || strpos($name, 'data/') === 0 || strpos($name, '..') !== false || $name === 'schluessel.php') return null;
    if ($name === 'api.php' && $passwort !== null) {
      $inhalt = preg_replace_callback("/const ADMIN_PASSWORT = '[^']*'/", fn() => "const ADMIN_PASSWORT = '" . addcslashes($passwort, "'\\") . "'", $inhalt, 1);
    }
    if ($name === 'index.html' && $kontakt !== null) {
      $inhalt = preg_replace_callback("/window\.ORMEET_KONTAKT = '[^']*'/", fn() => "window.ORMEET_KONTAKT = '" . addcslashes($kontakt, "'\\") . "'", $inhalt, 1);
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
  if (!$konto) antwort(['fehler' => 'Kein Konto angemeldet'], 403);
  $benutzer = benutzerLesen();
  $i = benutzerById($benutzer, $konto['benutzerId']);
  $b = &$benutzer[$i];
  if (isset($eingabe['name']) && trim($eingabe['name']) !== '') $b['name'] = trim($eingabe['name']);
  if (isset($eingabe['passwortNeu'])) {
    if ($b['passwortHash'] !== '' && !password_verify($eingabe['passwortAlt'] ?? '', $b['passwortHash'])) antwort(['fehler' => 'Das bisherige Passwort stimmt nicht'], 400);
    if (strlen($eingabe['passwortNeu']) < 8) antwort(['fehler' => 'Das Passwort braucht mindestens 8 Zeichen'], 400);
    $b['passwortHash'] = password_hash($eingabe['passwortNeu'], PASSWORD_DEFAULT);
  }
  if (!empty($eingabe['alleAbmelden'])) $b['anmeldungen'] = array_values(array_filter($b['anmeldungen'], fn($a) => hash_equals($a['token'], $token)));
  if (!empty($eingabe['ssoLoesen']) && ($b['passwortHash'] !== '' || count($b['sso']) > 1)) unset($b['sso'][$eingabe['ssoLoesen']]);
  unset($b);
  benutzerSchreiben($benutzer);
  antwort(['ok' => true, 'benutzer' => benutzerOeffentlich($benutzer[$i])]);
}

// Angemeldetes Konto mit dem Mitglied hinter einem persönlichen Link verknüpfen
if ($aktion === 'verknuepfen') {
  if (!$konto) antwort(['fehler' => 'Kein Konto angemeldet'], 403);
  $link = linkZugriff($eingabe['key'] ?? '');
  if (!$link || $link['rolle'] !== 'person') antwort(['fehler' => 'Das ist kein persönlicher Link'], 400);
  mitgliedVerknuepfen($link['gremiumId'], $link['personId'], $konto['benutzerId']);
  antwort(['ok' => true, 'gremiumId' => $link['gremiumId']]);
}

// --- Benutzerverwaltung und Einstellungen (nur Superadmin) --------
if (in_array($aktion, ['benutzer_aendern', 'benutzer_loeschen', 'einstellungen_lesen', 'einstellungen_speichern'], true) && !$istSuperadmin) {
  antwort(['fehler' => 'Nur der Superadmin kann Konten und Einstellungen verwalten'], 403);
}

if ($aktion === 'benutzer_aendern') {
  $benutzer = benutzerLesen();
  $i = benutzerById($benutzer, $eingabe['id'] ?? '');
  if ($i === null) antwort(['fehler' => 'Konto nicht gefunden'], 404);
  $b = &$benutzer[$i];
  if (isset($eingabe['darfGremienAnlegen'])) $b['darfGremienAnlegen'] = (bool) $eingabe['darfGremienAnlegen'];
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
  $e['sso'] = (object) $e['sso']; // leer als {} statt []
  antwort($e + ['callback' => basisUrl() . 'api.php?aktion=sso_callback', 'anbieter' => array_map(fn($a) => $a['name'], SSO_ANBIETER)]);
}

if ($aktion === 'einstellungen_speichern') {
  $sso = [];
  foreach (SSO_ANBIETER as $id => $anbieter) {
    $k = $eingabe['sso'][$id] ?? [];
    $sso[$id] = ['url' => trim($k['url'] ?? ''), 'clientId' => trim($k['clientId'] ?? ''), 'clientSecret' => trim($k['clientSecret'] ?? '')];
  }
  jsonSchreiben(EINSTELLUNGEN_DATEI, ['sso' => $sso]);
  antwort(['ok' => true]);
}

antwort(['fehler' => 'Unbekannte Aktion'], 400);
