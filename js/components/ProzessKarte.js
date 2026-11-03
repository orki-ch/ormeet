import { PROZESSE } from '../utils/prozesse.js'

// Prozesskarte mit Schwimmbahnen (Daten in utils/prozesse.js): Bahnen als Spalten, Rauten für Entscheide; ein Klick auf
// einen Knoten zeigt darunter die Details. Breite fest 680 Einheiten (SVG skaliert mit).
const BREITE = 680
const RAND = 40
const OBEN = 70
const ZEILE = 80
const BOX = { b: 164, h: 46 }
const RAUTE = { b: 168, h: 62 }

export default {
  name: 'ProzessKarte',
  props: {
    karte: { type: String, required: true }, // Schlüssel in PROZESSE
  },
  template: `
    <figure class="prozess-karte">
      <div class="prozess-legende small leise">
        <span><i class="person"></i>Person handelt</span>
        <span><i class="system"></i>Ormeet prüft / tut</span>
        <span><i class="stopp"></i>Endet hier</span>
        <span><i class="ende"></i>Start / Ergebnis</span>
        <span>◇ Entscheid · Knoten anklicken für Details</span>
      </div>
      <div class="prozess-flaeche">
        <svg :viewBox="'0 0 ' + BREITE + ' ' + hoehe" role="img" :aria-label="p.titel">
          <defs><marker :id="'pfeil-' + karte" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></marker></defs>
          <g v-for="(bahn, i) in p.lanes" :key="'b' + i">
            <rect class="bahn-kopf" :x="RAND + i * bahnBreite + 4" y="20" :width="bahnBreite - 8" height="32" rx="6" />
            <text class="bahn-text" :x="mitte(i)" y="36">{{ bahn[0] }}</text>
            <line v-if="i" class="bahn-linie" :x1="RAND + i * bahnBreite" y1="58" :x2="RAND + i * bahnBreite" :y2="hoehe - 6" />
          </g>
          <g v-for="(k, i) in kanten" :key="'k' + i">
            <path class="kante" :d="k.d" :marker-end="'url(#pfeil-' + karte + ')'" />
            <text v-if="k.label" class="kante-text" :x="k.lx" :y="k.ly" :text-anchor="k.anchor">{{ k.label }}</text>
          </g>
          <g v-for="k in knoten" :key="k.id" class="knoten" :class="[k.klasse, { gewaehlt: gewaehlt === k.id }]" tabindex="0" role="button" :aria-label="k.titel" @click="gewaehlt = k.id" @keydown.enter="gewaehlt = k.id">
            <polygon v-if="k.art === 'dec'" :points="k.punkte" />
            <rect v-else :x="k.x - BOX.b / 2" :y="k.y - BOX.h / 2" :width="BOX.b" :height="BOX.h" :rx="k.art === 'task' ? 6 : 22" />
            <text v-if="k.art === 'dec' || !k.unter" class="knoten-titel" :class="{ klein: k.art === 'dec' }" :x="k.x" :y="k.y">{{ k.titel }}</text>
            <template v-else>
              <text class="knoten-titel" :x="k.x" :y="k.y - 8">{{ k.titel }}</text>
              <text class="knoten-unter" :x="k.x" :y="k.y + 10">{{ k.unter }}</text>
            </template>
          </g>
        </svg>
      </div>
      <figcaption class="prozess-detail small">
        <template v-if="gewaehlt"><strong>{{ p.n[gewaehlt][3] }}</strong> – {{ p.n[gewaehlt][5] }}</template>
        <span v-else class="leise">Knoten anklicken für Details.</span>
      </figcaption>
    </figure>
  `,
  data() {
    return { gewaehlt: null, BREITE, RAND, BOX }
  },
  computed: {
    p() {
      return PROZESSE[this.karte]
    },
    bahnBreite() {
      return (BREITE - 2 * RAND) / this.p.lanes.length
    },
    hoehe() {
      return OBEN + (Math.max(...Object.values(this.p.n).map((n) => n[1])) + 1) * ZEILE + 10
    },
    knoten() {
      return Object.entries(this.p.n).map(([id, [bahn, zeile, art, titel, unter]]) => {
        const x = this.mitte(bahn)
        const y = this.zeileMitte(zeile)
        const klasse = art === 'stop' ? 'stopp' : art === 'start' || art === 'end' ? 'ende' : this.p.lanes[bahn][1] === 's' ? 'system' : 'person'
        const punkte = `${x},${y - RAUTE.h / 2} ${x + RAUTE.b / 2},${y} ${x},${y + RAUTE.h / 2} ${x - RAUTE.b / 2},${y}`
        return { id, art, titel, unter, x, y, klasse, punkte }
      })
    },
    kanten() {
      return this.p.e.map(([von, nach, label, verlauf]) => {
        const a = this.rand(this.p.n[von])
        const b = this.rand(this.p.n[nach])
        const gleicheZeile = this.p.n[von][1] === this.p.n[nach][1]
        const links = b.x < a.x
        if (verlauf === 1) {
          const sx = links ? a.links : a.rechts
          const d = gleicheZeile ? `M${sx} ${a.y} L${links ? b.rechts + 2 : b.links - 2} ${b.y}` : `M${sx} ${a.y} L${b.x} ${a.y} L${b.x} ${b.oben - 2}`
          return { d, label, lx: (sx + (links ? b.rechts : b.links)) / 2, ly: a.y - 8, anchor: 'middle' }
        }
        if (verlauf === 2) return { d: `M${a.x} ${a.unten} L${a.x} ${b.y} L${links ? b.rechts + 2 : b.links - 2} ${b.y}`, label }
        if (a.x === b.x) return { d: `M${a.x} ${a.unten} L${a.x} ${b.oben - 2}`, label, lx: a.x + 8, ly: a.unten + 14, anchor: 'start' }
        const m = a.unten + 14
        return { d: `M${a.x} ${a.unten} L${a.x} ${m} L${b.x} ${m} L${b.x} ${b.oben - 2}`, label, lx: a.x + 8, ly: a.unten + 10, anchor: 'start' }
      })
    },
  },
  methods: {
    mitte(bahn) {
      return RAND + bahn * this.bahnBreite + this.bahnBreite / 2
    },
    zeileMitte(zeile) {
      return OBEN + zeile * ZEILE + 34
    },
    rand([bahn, zeile, art]) {
      const x = this.mitte(bahn)
      const y = this.zeileMitte(zeile)
      const masse = art === 'dec' ? RAUTE : BOX
      return { x, y, oben: y - masse.h / 2, unten: y + masse.h / 2, links: x - masse.b / 2, rechts: x + masse.b / 2 }
    },
  },
}
