<?php
// ---------------------------------------------------------------
// Ormeet API – speichert die Daten pro Gremium als JSON-Datei in data/
//
// Zugriff über den Header X-Token:
//   Superadmin-Passwort      -> alle Gremien, anlegen/löschen
//   zugaenge[].key           -> Gremium-Zugang mit Rechten pro Bereich (sitzungen / mitglieder / einstellungen: keine|lesen|bearbeiten)
//   mitglieder[].zugangsKey  -> zentraler persönlicher Link eines Mitglieds: Rechte gemäss Traktanden-Zuweisungen;
//                               als Sitzungsleitung / Protokollführung einer Sitzung voller Zugriff auf deren Dokumente
//   freigabeLinkKey          -> ganzes Vorprotokoll bearbeiten
//   personenKeys[gastId]     -> Gast: wie persönlicher Link, beschränkt auf dieses Vorprotokoll
//   verfolgerKey             -> Live-Ansicht eines Protokolls (nur lesen)
//   themenbereiche[].freigabeKey -> Übersicht eines Themenbereichs (nur lesen)
// ---------------------------------------------------------------

const ADMIN_PASSWORT = 'bitte-aendern';   // <- unbedingt ändern!
const DATEN_ORDNER = __DIR__ . '/data';
const GITHUB_REPO = 'orki-ch/ormeet'; // Herkunft für automatische Updates (GitHub-Releases)
const VOLLE_RECHTE = ['sitzungen' => 'bearbeiten', 'mitglieder' => 'bearbeiten', 'einstellungen' => 'bearbeiten'];

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

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

// Leere personenKeys als Objekt ({}) statt Array ([]) ausgeben
function normalisiere(array $bundle) {
  foreach ($bundle['vorprotokolle'] as &$vp) {
    if (empty($vp['personenKeys'])) $vp['personenKeys'] = new stdClass();
  }
  return $bundle;
}

function lesen($datei) {
  $bundle = json_decode(file_get_contents($datei), true);
  return $bundle ? normalisiere($bundle) : null;
}

function alleBundles() {
  $bundles = [];
  foreach (glob(DATEN_ORDNER . '/*.json') as $datei) {
    $bundle = lesen($datei);
    if ($bundle) $bundles[] = $bundle;
  }
  return $bundles;
}

function indexById(array $liste) {
  $index = [];
  foreach ($liste as $eintrag) $index[$eintrag['id']] = $eintrag;
  return $index;
}

// Änderungen (ganze Datensätze + gelöschte IDs) in ein Bundle einarbeiten
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

// Vorprotokoll: nur berechtigte Traktanden / Unterpunkte (Reihenfolge bleibt) und eigene Anwesenheit übernehmen
function vorprotokollMerge(array $alt, array $neu, array $person) {
  $personId = $person['id'];
  $neuById = indexById($neu['traktanden'] ?? []);
  $altIds = [];
  $traktanden = [];
  foreach ($alt['traktanden'] as $t) {
    $altIds[$t['id']] = true;
    $n = $neuById[$t['id']] ?? null;
    if (istBerechtigt($t, $person)) {
      if ($n) $traktanden[] = $n; // ganzes Traktandum (inkl. Löschen)
      continue;
    }
    // Fremdes Traktandum: nur Unterpunkte mit eigener Berechtigung übernehmen
    $neuSubs = indexById($n['untertraktanden'] ?? []);
    $subs = [];
    $subIds = [];
    foreach ($t['untertraktanden'] as $u) {
      $subIds[$u['id']] = true;
      if (!istBerechtigt($u, $person)) { $subs[] = $u; continue; }
      if (isset($neuSubs[$u['id']])) $subs[] = $neuSubs[$u['id']];
    }
    foreach ($neuSubs as $u) if (!isset($subIds[$u['id']]) && istBerechtigt($u, $person)) $subs[] = $u;
    $t['untertraktanden'] = $subs;
    $traktanden[] = $t;
  }
  foreach ($neu['traktanden'] ?? [] as $t) {
    if (!isset($altIds[$t['id']]) && istBerechtigt($t, $person)) $traktanden[] = $t;
  }
  $alt['traktanden'] = $traktanden;

  $anwesend = array_values(array_diff($alt['anwesendeMitgliederIds'], [$personId]));
  if (in_array($personId, $neu['anwesendeMitgliederIds'] ?? [], true)) $anwesend[] = $personId;
  $alt['anwesendeMitgliederIds'] = $anwesend;
  return $alt;
}

// IDs der Traktanden / Unterpunkte, die die Person in diesem Vorprotokoll bearbeiten darf
function erlaubteTraktanden(array $vorprotokoll, array $person) {
  $erlaubt = [];
  foreach ($vorprotokoll['traktanden'] as $t) {
    $haupt = istBerechtigt($t, $person);
    if ($haupt) $erlaubt[$t['id']] = true;
    foreach ($t['untertraktanden'] ?? [] as $u) if ($haupt || istBerechtigt($u, $person)) $erlaubt[$u['id']] = true;
  }
  return $erlaubt;
}

// Protokoll: nur Einträge zu berechtigten Traktanden, übertragene Pendenzen berechtigter Traktanden und eigene Anwesenheit
function protokollMerge(array $alt, array $neu, array $person, array $bundle) {
  $personId = $person['id'];
  $erlaubt = [];
  $pendenzIds = [];
  foreach ($bundle['vorprotokolle'] as $vp) {
    $sitzung = null;
    foreach ($bundle['sitzungen'] as $s) if ($s['id'] === $vp['sitzungId']) $sitzung = $s;
    $voll = $sitzung && istLeitung($sitzung, $personId);
    foreach ($vp['traktanden'] as $t) {
      $haupt = $voll || istBerechtigt($t, $person);
      if ($haupt && !empty($t['pendenzId'])) $pendenzIds[$t['pendenzId']] = true;
      if ($vp['sitzungId'] !== $alt['sitzungId']) continue;
      if ($haupt) $erlaubt[$t['id']] = true;
      foreach ($t['untertraktanden'] ?? [] as $u) if ($haupt || istBerechtigt($u, $person)) $erlaubt[$u['id']] = true;
    }
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
      $voll = isset($sitzungen[$alt['sitzungId']]) && istLeitung($sitzungen[$alt['sitzungId']], $person['id']);
      $vorprotokolle[] = schluesselBewahren($alt, $voll ? $neu : vorprotokollMerge($alt, $neu, $person));
    }
  }
  $aenderungen['vorprotokolle'] = $vorprotokolle;

  $protokolle = [];
  foreach ($aenderungen['protokolle'] ?? [] as $neu) {
    foreach ($bundle['protokolle'] as $alt) {
      if ($alt['id'] !== $neu['id']) continue;
      $voll = isset($sitzungen[$alt['sitzungId']]) && istLeitung($sitzungen[$alt['sitzungId']], $person['id']);
      $protokolle[] = schluesselBewahren($alt, $voll ? $neu : protokollMerge($alt, $neu, $person, $bundle));
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
    $liste[] = istLeitung($alt, $person['id']) ? $neu : sitzungMerge($alt, $neu, $person);
  }
  $aenderungen['sitzungen'] = $liste;
  return $aenderungen;
}

// Geheime Schlüssel entfernen, die der Zugang nicht sehen darf
function bereinigen(array $bundle, array $zugriff) {
  $rolle = $zugriff['rolle'];
  if ($rolle === 'admin') return $bundle;
  unset($bundle['gremium']['zugaenge']);
  $bundle['gremium']['zugaenge'] = [];
  if ($rolle === 'gremium') return $bundle; // Gremium-Zugang darf Freigabe-, Personen- und Übersichts-Links verteilen
  foreach ($bundle['gremium']['mitglieder'] as &$m) unset($m['zugangsKey']);
  foreach ($bundle['gremium']['themenbereiche'] as &$tb) unset($tb['freigabeKey']);
  foreach ($bundle['vorprotokolle'] as &$vp) { unset($vp['freigabeLinkKey']); $vp['personenKeys'] = new stdClass(); }
  foreach ($bundle['protokolle'] as &$p) unset($p['verfolgerKey']);
  // Verdeckte Terminfindung: nur die eigene Stimme sichtbar
  foreach ($bundle['sitzungen'] as &$s) {
    if (!empty($s['terminfindung']['verdeckt'])) {
      $eigene = $zugriff['personId'] ?? null;
      $s['terminfindung']['stimmen'] = array_values(array_filter($s['terminfindung']['stimmen'], fn($st) => ($st['personId'] ?? null) === $eigene));
    }
  }
  return $bundle;
}

// --- Zugriff anhand des Tokens bestimmen ------------------------
$token = $_SERVER['HTTP_X_TOKEN'] ?? '';
if ($token === '' && ($_GET['aktion'] ?? '') === 'ical') $token = $_GET['token'] ?? ''; // Kalender-Abo: Token als Parameter
$zugriff = null;
if ($token !== '' && hash_equals(ADMIN_PASSWORT, $token)) {
  $zugriff = ['rolle' => 'admin'];
} elseif ($token !== '') {
  foreach (alleBundles() as $bundle) {
    $gremiumId = $bundle['gremium']['id'];
    foreach ($bundle['gremium']['zugaenge'] ?? [] as $zugang) {
      if (hash_equals($zugang['key'], $token)) {
        $zugriff = ['rolle' => 'gremium', 'gremiumId' => $gremiumId, 'rechte' => $zugang['rechte'], 'zugangName' => $zugang['name']];
        break 2;
      }
    }
    if (hash_equals($bundle['gremium']['zugangsKey'] ?? '', $token)) {
      $zugriff = ['rolle' => 'gremium', 'gremiumId' => $gremiumId, 'zugangName' => 'Vollzugriff', 'rechte' => VOLLE_RECHTE];
      break;
    }
    foreach ($bundle['gremium']['mitglieder'] as $m) {
      if (hash_equals($m['zugangsKey'] ?? '', $token)) {
        $zugriff = ['rolle' => 'person', 'gremiumId' => $gremiumId, 'personId' => $m['id'], 'personName' => $m['name']];
        break 2;
      }
    }
    foreach ($bundle['gremium']['themenbereiche'] as $tb) {
      if (hash_equals($tb['freigabeKey'] ?? '', $token)) {
        $zugriff = ['rolle' => 'themenbereich', 'gremiumId' => $gremiumId, 'themenbereichId' => $tb['id']];
        break 2;
      }
    }
    foreach ($bundle['protokolle'] as $protokoll) {
      if (hash_equals($protokoll['verfolgerKey'] ?? '', $token)) {
        $zugriff = ['rolle' => 'verfolger', 'gremiumId' => $gremiumId, 'protokollId' => $protokoll['id']];
        break 2;
      }
    }
    foreach ($bundle['vorprotokolle'] as $vorprotokoll) {
      if (hash_equals($vorprotokoll['freigabeLinkKey'], $token)) {
        $zugriff = ['rolle' => 'freigabe', 'gremiumId' => $gremiumId, 'vorprotokollId' => $vorprotokoll['id']];
        break 2;
      }
      foreach ($vorprotokoll['personenKeys'] ?? [] as $personId => $key) {
        if (hash_equals($key, $token)) {
          $zugriff = ['rolle' => 'freigabe', 'gremiumId' => $gremiumId, 'vorprotokollId' => $vorprotokoll['id'],
                      'personId' => $personId, 'personName' => personDaten($bundle, $personId)['name']];
          break 3;
        }
      }
    }
  }
}
if (!$zugriff) antwort(['fehler' => 'Passwort oder Link ungültig'], 401);

$aktion = $_GET['aktion'] ?? '';
$gremiumId = $_GET['gremium'] ?? '';
$rolle = $zugriff['rolle'];
$istAdmin = $rolle === 'admin';
$eigenes = $istAdmin || $zugriff['gremiumId'] === $gremiumId;

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
  $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
  $basis = ($https ? 'https' : 'http') . '://' . $_SERVER['HTTP_HOST'] . rtrim(dirname($_SERVER['SCRIPT_NAME']), '/\\') . '/';
  $link = fn($pfad) => $basis . '#/zugang/' . $token . '?weiter=' . rawurlencode($pfad); // öffnet direkt über den persönlichen Link
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
  $bundles = $istAdmin ? alleBundles() : [bereinigen(lesen(dateiVon($zugriff['gremiumId'])), $zugriff)];
  if ($rolle === 'gremium' && ($zugriff['rechte']['sitzungen'] ?? 'keine') === 'keine') {
    $bundles[0]['sitzungen'] = [];
    $bundles[0]['vorprotokolle'] = [];
    $bundles[0]['protokolle'] = [];
  }
  if ($rolle === 'freigabe') {
    // Vorprotokoll-Link: aus den Protokollen nur die Pendenzen mitgeben (für den Übertrag)
    foreach ($bundles[0]['protokolle'] as &$protokoll) {
      $protokoll['eintraege'] = array_values(array_filter($protokoll['eintraege'], fn($e) => $e['typ'] === 'pendenz'));
    }
  }
  if ($rolle === 'themenbereich') {
    // Übersichts-Link: nur Einträge dieses Themenbereichs, keine Vorprotokolle
    $bundles[0]['vorprotokolle'] = [];
    foreach ($bundles[0]['protokolle'] as &$protokoll) {
      $protokoll['eintraege'] = array_values(array_filter($protokoll['eintraege'], fn($e) => $e['themenbereichId'] === $zugriff['themenbereichId']));
    }
  }
  antwort(['zugriff' => $zugriff, 'gremien' => $bundles]);
}

// --- Speichern --------------------------------------------------
if ($aktion === 'speichern') {
  if (!$eigenes || in_array($rolle, ['verfolger', 'themenbereich'], true)) antwort(['fehler' => 'Kein Zugriff auf dieses Gremium'], 403);
  $aenderungen = json_decode(file_get_contents('php://input'), true);
  if (!is_array($aenderungen)) antwort(['fehler' => 'Ungültige Daten'], 400);
  if (isset($aenderungen['gremium']) && $aenderungen['gremium']['id'] !== $gremiumId) antwort(['fehler' => 'Gremium-ID stimmt nicht'], 400);

  $datei = dateiVon($gremiumId);
  $neu = !file_exists($datei);
  if ($neu && (!$istAdmin || !isset($aenderungen['gremium']))) antwort(['fehler' => 'Gremium nicht gefunden'], 404);

  $handle = fopen($datei, 'c+');
  flock($handle, LOCK_EX);
  $bundle = $neu ? null : json_decode(stream_get_contents($handle), true);
  $bundle = $bundle ?: ['gremium' => null, 'sitzungen' => [], 'vorprotokolle' => [], 'protokolle' => []];

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

  $bundle = einarbeiten($bundle, $aenderungen);
  ftruncate($handle, 0);
  rewind($handle);
  fwrite($handle, json_encode($bundle, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
  flock($handle, LOCK_UN);
  fclose($handle);
  antwort(['ok' => true]);
}

// --- Updates (nur Superadmin) -----------------------------------
function holen($url) {
  $kontext = stream_context_create(['http' => ['timeout' => 20, 'user_agent' => 'Ormeet-Update', 'follow_location' => 1], 'ssl' => ['verify_peer' => true]]);
  $inhalt = @file_get_contents($url, false, $kontext);
  if ($inhalt === false && function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20, CURLOPT_FOLLOWLOCATION => true, CURLOPT_USERAGENT => 'Ormeet-Update']);
    $inhalt = curl_exec($ch);
    curl_close($ch);
  }
  return $inhalt === false ? null : $inhalt;
}

function lokaleVersion() {
  return file_exists(__DIR__ . '/version.md') ? trim(file_get_contents(__DIR__ . '/version.md')) : '0.0.0';
}

if ($aktion === 'update_pruefen' || $aktion === 'update_installieren') {
  if (!$istAdmin) antwort(['fehler' => 'Nur der Superadmin kann Updates verwalten'], 403);
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
    if ($name === '' || substr($name, -1) === '/' || strpos($name, 'data/') === 0 || strpos($name, '..') !== false) return null;
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
  if (!$istAdmin) antwort(['fehler' => 'Nur der Superadmin kann Gremien löschen'], 403);
  $datei = dateiVon($gremiumId);
  if (file_exists($datei)) unlink($datei);
  antwort(['ok' => true]);
}

antwort(['fehler' => 'Unbekannte Aktion'], 400);
