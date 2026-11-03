<?php
// ---------------------------------------------------------------
// Ormeet-Cronjob: verschickt die täglichen Sammelmails mit den Mitteilungen an alle Konten. Beim Hoster stündlich eintragen:
//   php /pfad/zu/ormeet/cron.php
// Ohne Shell-Zugang per Adresse mit Schlüssel (cron.php?schluessel=…) – die genauen Angaben zeigt der Superadmin
// unter Einstellungen › Automatische E-Mails.
// ---------------------------------------------------------------

define('ORMEET_CRON', true);
$_GET['aktion'] = 'cron';
require __DIR__ . '/api.php';
