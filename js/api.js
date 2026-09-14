const TOKEN_KEY = 'ormeet-token'

export const api = {
  get token() {
    return localStorage.getItem(TOKEN_KEY) || ''
  },

  setToken(token) {
    localStorage.setItem(TOKEN_KEY, token)
  },

  async anfrage(aktion, gremiumId = '', body = null) {
    const antwort = await fetch(`api.php?aktion=${aktion}&gremium=${gremiumId}`, {
      method: body ? 'POST' : 'GET',
      headers: { 'X-Token': api.token, 'Content-Type': 'application/json' },
      body: body && JSON.stringify(body),
    })
    const daten = await antwort.json().catch(() => ({}))
    if (!antwort.ok) {
      const fehler = new Error(daten.fehler || `Serverfehler ${antwort.status}`)
      fehler.status = antwort.status
      throw fehler
    }
    return daten
  },
}
