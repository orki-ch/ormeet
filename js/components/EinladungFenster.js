import { api } from '../api.js'
import { gremienStore } from '../stores/gremien.js'
import { sitzungenStore } from '../stores/sitzungen.js'
import { sync, speichern, zugriffsDaten } from '../stores/sync.js'
import { formatDatum } from '../utils/labels.js'
import { einladungVon } from '../utils/einladungen.js'
import { hinweis } from '../utils/dialog.js'
import Modal from './Modal.js'

const ART_TEXT = { einladung: 'Einladung', vorprotokoll: 'Vorprotokoll' }

// Einladung oder Vorprotokoll per E-Mail an erwartete Mitglieder und Gäste der Sitzung. Der Server mailt jeder Person
// ihren persönlichen Link (die Leitung sieht ihn nicht), Zusagen / Absagen, einen Kalendereintrag und das Abbestellen.
export default {
  name: 'EinladungFenster',
  components: { Modal },
  props: {
    sitzungId: { type: String, required: true },
  },
  emits: ['schliessen'],
  template: `
    <Modal titel="Einladung senden" @schliessen="$emit('schliessen')">
      <form id="formular-einladung" class="stack" @submit.prevent="senden">
        <div class="row" style="gap: 0.5rem 1.5rem">
          <label class="check small"><input v-model="art" type="radio" value="einladung" /> Einladung <span class="leise">(Termin und Link)</span></label>
          <label class="check small"><input v-model="art" type="radio" value="vorprotokoll" /> Vorprotokoll <span class="leise">(Termin, Traktanden und Link)</span></label>
        </div>
        <div>
          <span class="label">Empfängerinnen und Empfänger</span>
          <div class="liste">
            <label v-for="p in personen" :key="p.id" class="check small liste-zeile" :class="{ aus: p.gesperrt }">
              <input v-model="auswahl" type="checkbox" :value="p.id" :disabled="p.gesperrt" />
              <span class="grow">{{ p.name }}<span class="leise"> · {{ p.art }}</span></span>
              <span class="leise" :class="{ 'text-err': p.abgesagt, 'text-ok': p.zugesagt }">{{ p.status }}</span>
            </label>
          </div>
          <p v-if="!personen.length" class="muted small">Keine erwarteten Mitglieder und keine Gäste.</p>
        </div>
        <div><span class="label">Eigene Nachricht (optional)</span><textarea v-model.trim="nachricht" class="input" rows="3" maxlength="4000"></textarea></div>
        <p class="hint">Ohne Antwort gilt die Einladung als angenommen. Wer absagt, gibt einen Grund an und wird aus der Anwesenheit ausgetragen. Den Grund sehen nur Sitzungsleitung und Protokollführung.</p>
      </form>
      <template #fuss>
        <div class="row">
          <button type="button" class="btn" @click="$emit('schliessen')">Abbrechen</button>
          <button form="formular-einladung" class="btn btn-primary ml-auto" :disabled="laeuft || !auswahl.length">{{ laeuft ? 'Wird gesendet …' : ART_TEXT[art] + ' senden (' + auswahl.length + ')' }}</button>
        </div>
      </template>
    </Modal>
  `,
  data() {
    return { art: 'einladung', auswahl: [], nachricht: '', laeuft: false, ART_TEXT }
  },
  computed: {
    sitzung() {
      return sitzungenStore.sitzungById(this.sitzungId)
    },
    vorprotokoll() {
      return sitzungenStore.vorprotokollVonSitzung(this.sitzungId)
    },
    personen() {
      const gremiumId = this.sitzung.gremiumId
      const aus = zugriffsDaten[gremiumId]?.einladungenAus || []
      const mitglieder = gremienStore.erwarteteMitglieder(gremiumId).map((m) => ({ ...m, art: 'Mitglied' }))
      const gaeste = (this.vorprotokoll?.gaeste || []).map((g) => ({ ...g, art: 'Gast' }))
      return [...mitglieder, ...gaeste].map((p) => {
        const e = einladungVon(gremiumId, this.sitzungId, p.id)
        const zuletzt = [...(e?.gesendet || [])].reverse()
        const gleicheArt = zuletzt.find((g) => g.art === this.art)
        let status = ''
        if (!p.email) status = 'keine E-Mail-Adresse'
        else if (aus.includes(p.email.toLowerCase())) status = 'hat Einladungen abbestellt'
        else if (e?.antwort === 'abgesagt') status = 'abgesagt: ' + (e.grund || 'ohne Grund')
        else if (e?.antwort === 'zugesagt') status = 'zugesagt'
        else if (zuletzt.length) status = ART_TEXT[zuletzt[0].art] + ' am ' + formatDatum(zuletzt[0].am.slice(0, 10))
        return {
          id: p.id,
          name: p.name,
          art: p.art,
          status,
          gesperrt: !p.email || aus.includes(p.email.toLowerCase()),
          schonGesendet: !!gleicheArt,
          abgesagt: e?.antwort === 'abgesagt',
          zugesagt: e?.antwort === 'zugesagt',
        }
      })
    },
  },
  watch: {
    // Vorauswahl: alle mit E-Mail, die diese Art noch nicht erhalten und nicht abgesagt haben
    art: {
      immediate: true,
      handler() {
        this.auswahl = this.personen.filter((p) => !p.gesperrt && !p.schonGesendet && !p.abgesagt).map((p) => p.id)
      },
    },
  },
  methods: {
    // Ungespeicherte Änderungen (z. B. ein eben festgelegter Termin) zuerst auf den Server bringen
    async allesSpeichern() {
      for (let i = 0; i < 50 && (sync.status === 'speichert' || sync.ausstehend); i++) {
        await speichern()
        if (sync.status === 'speichert') await new Promise((weiter) => setTimeout(weiter, 100))
      }
      await speichern()
    },
    async senden() {
      this.laeuft = true
      try {
        await this.allesSpeichern()
        const gremiumId = this.sitzung.gremiumId
        const antwort = await api.anfrage('einladung_senden', gremiumId, { sitzungId: this.sitzungId, art: this.art, personIds: this.auswahl, nachricht: this.nachricht })
        const daten = (zugriffsDaten[gremiumId] ??= { nutzung: {}, geschuetzt: [], einladungen: {}, einladungenAus: [] })
        daten.einladungen = { ...daten.einladungen, [this.sitzungId]: antwort.einladungen }
        const probleme = antwort.fehler.map((f) => `${f.name}: ${f.grund}`).join('\n')
        await hinweis((antwort.gesendet === 1 ? '1 E-Mail verschickt.' : `${antwort.gesendet} E-Mails verschickt.`) + (probleme ? '\n\nNicht verschickt:\n' + probleme : ''), ART_TEXT[this.art] + ' senden')
        this.$emit('schliessen')
      } catch (fehler) {
        await hinweis(fehler.message, 'Nicht verschickt')
      } finally {
        this.laeuft = false
      }
    },
  },
}
