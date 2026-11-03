// Ende der Anmeldung über einen Anbieter im Popup (api.php ssoZiel): Das Fenster, das das Popup geöffnet hat, öffnet die
// Zieladresse (eigener Zugang, gewünschte Seite oder Fehlermeldung), und das Popup schliesst sich. Ohne öffnendes
// Fenster (z. B. Popup als Tab geöffnet) geht es hier weiter.
;(function () {
  const ziel = document.body.dataset.ziel
  try {
    if (window.opener && window.opener.location.origin === location.origin) {
      window.opener.postMessage({ ormeetSso: ziel }, location.origin)
      window.close()
      return
    }
  } catch (fehler) {
    // Öffnendes Fenster auf einer anderen Seite: hier weiter
  }
  location.replace(ziel)
})()
