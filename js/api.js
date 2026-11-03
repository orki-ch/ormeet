const TOKEN_KEY = 'ormeet-token'
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
    return localStorage.getItem(TOKEN_KEY) || ''
  },

  setToken(token) {
    localStorage.setItem(TOKEN_KEY, token)
  },

  // Nach richtig eingegebenem Passwort: dieser Link bleibt auf dem Gerät freigeschaltet
  freischalten(code) {
    localStorage.setItem(FREISCHALTUNG_KEY, JSON.stringify({ ...freischaltungen(), [api.token]: code }))
  },

  async anfrage(aktion, gremiumId = '', body = null) {
    const antwort = await fetch(`api.php?aktion=${aktion}&gremium=${gremiumId}`, {
      method: body ? 'POST' : 'GET',
      headers: { 'X-Token': api.token, 'X-Freischaltung': freischaltungen()[api.token] || '', 'Content-Type': 'application/json' },
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
