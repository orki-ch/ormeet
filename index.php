<?php
// Ormeet – Startseite. Hängt die installierte Version (version.md) an alle Skript- und Stil-Adressen: Nach einem
// Update laden die Browser garantiert die neuen Dateien, statt alte aus dem Cache zu nehmen. Für die ES-Module in js/
// geschieht das über eine Import Map, damit auch die gegenseitigen Importe (import … from './x.js') versioniert sind.
$version = file_exists(__DIR__ . '/version.md') ? trim(file_get_contents(__DIR__ . '/version.md')) : '0.0.0';
$v = rawurlencode($version);
$nonce = base64_encode(random_bytes(16)); // erlaubt genau diese eine Import Map (Inline-Skripte bleiben sonst gesperrt)

// Kontaktangabe für die Datenschutzerklärung (optional, zwischen die Anführungszeichen schreiben); bleibt bei Updates erhalten
const ORMEET_KONTAKT = '';
// Ältere Installationen (bis 1.4.07) hatten die Angabe in index.html – sie gilt weiter, solange hier nichts steht
$alte = file_exists(__DIR__ . '/index.html') && preg_match("/window\.ORMEET_KONTAKT = '([^']*)'/", file_get_contents(__DIR__ . '/index.html'), $m) ? $m[1] : '';
$kontakt = ORMEET_KONTAKT !== '' ? ORMEET_KONTAKT : $alte;

// Alle Module unter js/ versioniert: Schlüssel ist die aufgelöste Adresse, Wert dieselbe mit ?v=
$basis = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/\\') . '/';
$module = [];
$dateien = new RecursiveIteratorIterator(new RecursiveDirectoryIterator(__DIR__ . '/js', FilesystemIterator::SKIP_DOTS));
foreach ($dateien as $datei) {
  if ($datei->getExtension() !== 'js') continue;
  $pfad = str_replace('\\', '/', substr($datei->getPathname(), strlen(__DIR__) + 1));
  $module[$basis . $pfad] = $basis . $pfad . '?v=' . $v;
}
ksort($module);
$importMap = json_encode(['imports' => $module], JSON_UNESCAPED_SLASHES);

// Schutz vor eingeschleustem Code: Skripte, Stile und Verbindungen nur von dieser Installation
header("Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-eval' 'nonce-$nonce'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'");
header('Referrer-Policy: same-origin');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-cache'); // diese Seite immer beim Server nachfragen – sie verweist auf die versionierten Dateien
header('Content-Type: text/html; charset=utf-8');
?>
<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="ormeet-version" content="<?= htmlspecialchars($version) ?>" />
    <title>Ormeet – Sitzungsprotokolle</title>

    <meta name="ormeet-kontakt" content="<?= htmlspecialchars($kontakt) ?>" />
    <link rel="stylesheet" href="css/ormeet.css?v=<?= $v ?>">

    <script src="lib/vue.global.prod.js?v=<?= $v ?>"></script>
    <script src="lib/vue-router.global.prod.js?v=<?= $v ?>"></script>
    <script src="lib/pdfmake.min.js?v=<?= $v ?>"></script>
    <script src="lib/vfs_fonts.js?v=<?= $v ?>"></script>
    <script type="importmap" nonce="<?= $nonce ?>"><?= $importMap ?></script>
  </head>
  <body>
    <div id="app">
      <p style="padding: 2rem; font-family: sans-serif; color: #5a655d">
        Ormeet wird geladen … Bleibt diese Meldung stehen, blockiert der Browser JavaScript
        oder ist zu alt (benötigt Chrome/Edge 92+, Firefox 108+, Safari 16.4+).
      </p>
    </div>
    <script type="module" src="js/main.js?v=<?= $v ?>"></script>
  </body>
</html>
