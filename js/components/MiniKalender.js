// Mini-Kalender: ein Monat, Klick auf einen Tag meldet das Datum (JJJJ-MM-TT); markierte Tage sind hervorgehoben.
const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

function iso(jahr, monat, tag) {
  return `${jahr}-${String(monat + 1).padStart(2, '0')}-${String(tag).padStart(2, '0')}`
}

export default {
  name: 'MiniKalender',
  props: {
    markiert: { type: Array, default: () => [] }, // Daten im Format JJJJ-MM-TT
  },
  emits: ['wahl'],
  template: `
    <div class="minikalender">
      <div class="kopf">
        <button type="button" class="btn btn-ghost btn-icon" title="Vorheriger Monat" @click="blaettern(-1)">‹</button>
        <strong>{{ monatsName }}</strong>
        <button type="button" class="btn btn-ghost btn-icon" title="Nächster Monat" @click="blaettern(1)">›</button>
      </div>
      <div class="tage">
        <span v-for="w in WOCHENTAGE" :key="w" class="wochentag">{{ w }}</span>
        <button v-for="t in tage" :key="t.datum" type="button" class="tag" :class="{ leer: !t.imMonat, markiert: markiert.includes(t.datum), heute: t.datum === heute }" @click="$emit('wahl', t.datum)">{{ t.tag }}</button>
      </div>
    </div>
  `,
  data() {
    const jetzt = new Date()
    return { jahr: jetzt.getFullYear(), monat: jetzt.getMonth(), heute: iso(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate()), WOCHENTAGE }
  },
  computed: {
    monatsName() {
      return new Date(this.jahr, this.monat, 1).toLocaleDateString('de-CH', { month: 'long', year: 'numeric' })
    },
    // 6 Wochen ab Montag der ersten Woche, damit das Raster nicht springt
    tage() {
      const erster = new Date(this.jahr, this.monat, 1)
      const start = new Date(erster)
      start.setDate(1 - ((erster.getDay() + 6) % 7))
      return Array.from({ length: 42 }, (_, i) => {
        const d = new Date(start)
        d.setDate(start.getDate() + i)
        return { tag: d.getDate(), datum: iso(d.getFullYear(), d.getMonth(), d.getDate()), imMonat: d.getMonth() === this.monat }
      })
    },
  },
  methods: {
    blaettern(richtung) {
      const d = new Date(this.jahr, this.monat + richtung, 1)
      this.jahr = d.getFullYear()
      this.monat = d.getMonth()
    },
  },
}
