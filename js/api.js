const TOKEN_KEY = 'ormeet-token'
const SUPERADMIN_ANSICHT_KEY = 'ormeet-superadmin-ansicht' // «aus»: Konto des Superadmins nur als gewöhnliches Konto (pro Gerät)

// Schalter «Superadmin-Ansicht» im Menü: nur bei der Anmeldung mit dem Konto, das mit dem Superadmin verknüpft ist
export const superadminAnsicht = {
  get aus() {
    try {
      return localStorage.getItem(SUPERADMIN_ANSICHT_KEY) === 'aus'
    } catch {
      return false
    }
  },
  setzen(an) {
    try {
      if (an) localStorage.removeItem(SUPERADMIN_ANSICHT_KEY)
      else localStorage.setItem(SUPERADMIN_ANSICHT_KEY, 'aus')
    } catch {
      // ohne Speicher bleibt die Superadmin-Ansicht an
    }
  },
}
const ANSICHT_KEY = 'ormeet-ansicht' // «Ansehen als …»: Ansicht-Schlüssel nur in diesem Tab (sessionStorage)
const FREISCHALTUNG_KEY = 'ormeet-freischaltungen' // passwortgeschützte Links: { [token]: Freischaltung } für dieses Gerät

function freischaltungen() {
  try {
    return JSON.parse(localStorage.getItem(FREISCHALTUNG_KEY) || '{}')
  } catch {
    return {}
  }
}

// Version, mit der diese Seite geladen wurde (index.php trägt sie ein), und ob der Server inzwischen eine neuere hat.
// index.php versioniert alle Dateien – ein Neuladen holt dann garantiert den neuen Stand.
export const appStand = Vue.reactive({
  version: document.querySelector('meta[name="ormeet-version"]')?.content || '',
  neueVersion: '',
})

export const api = {
  get token() {
    return sessionStorage.getItem(ANSICHT_KEY) || localStorage.getItem(TOKEN_KEY) || ''
  },

  // In der Ansicht als andere Person bleibt die eigene Anmeldung (localStorage) unberührt
  setToken(token) {
    if (sessionStorage.getItem(ANSICHT_KEY)) sessionStorage.setItem(ANSICHT_KEY, token)
    else localStorage.setItem(TOKEN_KEY, token)
  },

  ansichtStarten(token) {
    sessionStorage.setItem(ANSICHT_KEY, token)
  },

  ansichtBeenden() {
    sessionStorage.removeItem(ANSICHT_KEY)
  },

  // Nach richtig eingegebenem Passwort: dieser Link bleibt auf dem Gerät freigeschaltet
  freischalten(code) {
    localStorage.setItem(FREISCHALTUNG_KEY, JSON.stringify({ ...freischaltungen(), [api.token]: code }))
  },

  async anfrage(aktion, gremiumId = '', body = null) {
    const antwort = await fetch(`api.php?aktion=${aktion}&gremium=${gremiumId}`, {
      method: body ? 'POST' : 'GET',
      headers: { 'X-Token': api.token, 'X-Freischaltung': freischaltungen()[api.token] || '', 'X-Superadmin-Ansicht': superadminAnsicht.aus ? 'aus' : '', 'Content-Type': 'application/json' },
      body: body && JSON.stringify(body),
    })
    const serverVersion = antwort.headers.get('X-Ormeet-Version')
    if (serverVersion && appStand.version && serverVersion !== appStand.version) appStand.neueVersion = serverVersion
    const daten = await antwort.json().catch(() => ({}))
    if (!antwort.ok) {
      const fehler = new Error(daten.fehler || `Serverfehler ${antwort.status}`)
      fehler.status = antwort.status
      fehler.gesperrt = daten.gesperrt ? { grund: daten.gesperrt, name: daten.name || '' } : null // Link mit Passwort, abgelaufen, gesperrt
      throw fehler
    }
    return daten
  },
}
