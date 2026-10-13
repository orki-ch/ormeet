import { gremienStore } from '../stores/gremien.js'
import { sitzungenStore } from '../stores/sitzungen.js'
import { gremiumLoeschen } from '../stores/sync.js'
import { uebersichtsKonto } from '../utils/rechte.js'
import { SITZUNG_STATUS, SITZUNG_STATUS_KLASSE, formatDatum, sitzungStatus } from '../utils/labels.js'
import MenuDropdown from './MenuDropdown.js'

// Zeilen einer Liste von Kurzsitzungen; Löschen entfernt bei Kurzsitzungen ohne Gremium auch ihren Behälter
export default {
  name: 'KurzsitzungenListe',
  components: { MenuDropdown },
  props: {
    sitzungen: { type: Array, required: true },
    darfLoeschen: { type: Function, default: () => false },
  },
  template: `
    <p v-if="!sitzungen.length" class="muted small">Noch keine Kurzsitzungen.</p>
    <div v-else class="zeilen" style="--spalten: auto 2fr auto 1fr">
      <div v-for="s in sitzungen" :key="s.id" class="zeile">
        <span class="nowrap"><strong :class="{ 'text-warn': !s.datum }">{{ formatDatum(s.datum) }}</strong><span class="leise">&nbsp;{{ s.zeit }}</span></span>
        <span>{{ s.titel || 'Kurzsitzung' }}<span v-if="s.ort" class="leise"> · {{ s.ort }}</span></span>
        <span><span class="badge" :class="SITZUNG_STATUS_KLASSE[sitzungStatus(s)]">{{ SITZUNG_STATUS[sitzungStatus(s)] }}</span></span>
        <div class="aktionen">
          <router-link v-if="s.terminfindung?.status === 'offen'" :to="'/sitzung/' + s.id + '/terminfindung'" class="btn btn-ghost">Terminfindung</router-link>
          <router-link v-if="s.datum" :to="'/sitzung/' + s.id + '/protokoll'" class="btn btn-ghost">Protokoll</router-link>
          <MenuDropdown v-if="darfLoeschen(s)">
            <button class="menu-item menu-item-danger" @click="loeschen(s)">Kurzsitzung löschen</button>
          </MenuDropdown>
        </div>
      </div>
    </div>
  `,
  data() {
    return { SITZUNG_STATUS, SITZUNG_STATUS_KLASSE }
  },
  methods: {
    formatDatum,
    sitzungStatus,
    async loeschen(s) {
      if (!confirm(`Kurzsitzung «${s.titel || 'Kurzsitzung'}» inkl. Protokoll unwiderruflich löschen?`)) return
      const gremium = gremienStore.byId(s.gremiumId)
      if (!gremium.kurz) return sitzungenStore.loescheSitzung(s.id)
      await gremiumLoeschen(gremium.id)
      sitzungenStore.loescheSitzungenVonGremium(gremium.id)
      gremienStore.loesche(gremium.id)
      const konto = uebersichtsKonto()
      if (konto) konto.gremien = konto.gremien.filter((g) => g.gremiumId !== gremium.id)
    },
  },
}
