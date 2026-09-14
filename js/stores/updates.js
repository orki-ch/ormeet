import { api } from '../api.js'
import { sync } from './sync.js'

// Update-Stand für den Superadmin; automatische Prüfung höchstens einmal pro Tag, Ergebnis bleibt im Browser gemerkt
const MERKER = 'ormeet-update'
const gemerkt = (() => {
  try {
    return JSON.parse(localStorage.getItem(MERKER)) || {}
  } catch {
    return {}
  }
})()
export const updateStand = Vue.reactive({ lokal: '', aktuell: '', verfuegbar: false, geprueftUm: '', geprueftAm: 0, fehler: '', ...gemerkt })

export async function updatePruefen(erzwingen = false) {
  if (sync.zugriff?.rolle !== 'admin') return
  if (!erzwingen && Date.now() - updateStand.geprueftAm < 24 * 3600 * 1000) return
  try {
    const stand = await api.anfrage('update_pruefen')
    Object.assign(updateStand, stand, {
      fehler: '',
      geprueftAm: Date.now(),
      geprueftUm: new Date().toLocaleString('de-CH', { dateStyle: 'short', timeStyle: 'short' }),
    })
    localStorage.setItem(MERKER, JSON.stringify(updateStand))
  } catch (fehler) {
    updateStand.fehler = fehler.message
  }
}
