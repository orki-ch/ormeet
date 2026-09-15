import { api } from '../api.js'
import { sync } from '../stores/sync.js'
import { gremienStore } from '../stores/gremien.js'
import { sitzungenStore } from '../stores/sitzungen.js'
import { neuerKey } from '../utils/keys.js'
import { formatDatum } from '../utils/labels.js'
import MenuDropdown from '../components/MenuDropdown.js'
import Modal from '../components/Modal.js'

const RECHTE_KURZ = { keine: '–', lesen: 'lesen', bearbeiten: 'bearbeiten' }

// Superadmin: Konten (mit Gremien-Zuordnung) und alle Links der Installation
export default {
  name: 'Benutzer',
  components: { MenuDropdown, Modal },
  template: `
    <div class="stack-lg">
      <header class="page-header" style="margin-bottom: 0">
        <p class="kicker">Superadmin</p>
        <h1 class="title">Benutzer & Links</h1>
        <nav class="tabs">
          <button class="tab" :class="{ aktiv: tab === 'konten' }" @click="tab = 'konten'">Konten</button>
          <button class="tab" :class="{ aktiv: tab === 'links' }" @click="tab = 'links'">Links</button>
        </nav>
      </header>

      <!-- Tab: Konten -->
      <template v-if="tab === 'konten'">
        <section class="card">
          <div class="card-head">
            <h2 class="card-title">Konten</h2>
            <button class="btn" @click="neuesKonto = { name: '', email: '', passwort: '' }">+ Konto</button>
          </div>
          <p class="hint">Konten entstehen meist selbst: Wer einen persönlichen Link hat, kann sich darin ein Konto anlegen (E-Mail/Passwort oder Anbieter). Hier ordnest du Konten weiteren Gremien zu und erlaubst das Anlegen eigener Gremien.</p>
          <p v-if="!sync.konten.length" class="muted small">Noch keine Konten.</p>
          <div v-else class="liste">
            <div v-for="k in sync.konten" :key="k.id" class="block-soft stack-sm">
              <div class="row">
                <span class="grow"><strong>{{ k.name }}</strong><span class="leise"> · {{ k.email }}</span>
                  <span v-for="a in k.sso" :key="a" class="badge brand" style="margin-left: 0.4rem">{{ a }}</span></span>
                <span class="leise small nowrap">seit {{ formatDatum(k.erstelltAm.slice(0, 10)) }}<template v-if="k.letzteAnmeldung"> · zuletzt {{ formatDatum(k.letzteAnmeldung.slice(0, 10)) }}</template></span>
                <MenuDropdown>
                  <button class="menu-item" @click="passwortSetzen(k)">Passwort setzen</button>
                  <button class="menu-item" @click="aendern(k, { alleAbmelden: true })">Alle Geräte abmelden</button>
                  <button class="menu-item menu-item-danger" @click="loeschen(k)">Konto löschen</button>
                </MenuDropdown>
              </div>
              <label class="check small"><input type="checkbox" :checked="k.darfGremienAnlegen" @change="aendern(k, { darfGremienAnlegen: $event.target.checked })" /> Darf eigene Gremien anlegen (verwaltet diese dann vollständig)</label>
              <div class="chips">
                <span v-for="z in zuordnungen(k.id)" :key="z.gremium.id" class="chip">
                  {{ z.gremium.name }} <span class="leise">· {{ z.eigentuemer ? 'Eigentümer' : z.mitglied.name }}</span>
                  <button v-if="!z.eigentuemer" type="button" class="chip-x" title="Aus dem Gremium lösen" @click="loesen(z)">✕</button>
                </span>
                <button class="btn btn-ghost" @click="zuordnen = { konto: k, gremiumId: '', mitgliedId: 'neu' }">+ Gremium</button>
              </div>
            </div>
          </div>
        </section>
      </template>

      <!-- Tab: Links -->
      <template v-else>
        <section class="card">
          <div class="card-head">
            <h2 class="card-title">Alle Links</h2>
            <select v-model="gremiumFilter" class="input w-md">
              <option value="">Alle Gremien</option>
              <option v-for="g in gremien" :key="g.id" :value="g.id">{{ g.name }}</option>
            </select>
          </div>
          <p class="hint">«Erneuern» macht den bisherigen Link sofort ungültig und erzeugt einen neuen.</p>
          <div class="zeilen" style="--spalten: auto 1fr auto">
            <div v-for="l in links" :key="l.key" class="zeile">
              <span><span class="badge" :class="l.klasse">{{ l.typ }}</span></span>
              <span><strong>{{ l.name }}</strong><span v-if="l.info" class="leise"> · {{ l.info }}</span><br /><code class="leise small">{{ url(l) }}</code></span>
              <div class="aktionen">
                <button class="btn btn-ghost" @click="kopieren(l)">{{ kopiert === l.key ? 'Kopiert ✓' : 'Kopieren' }}</button>
                <button class="btn btn-ghost" @click="erneuern(l)">Erneuern</button>
              </div>
            </div>
          </div>
          <p v-if="!links.length" class="muted small">Keine Links vorhanden.</p>
        </section>
      </template>

      <!-- Dialog: Konto einem Gremium zuordnen -->
      <Modal v-if="zuordnen" :titel="'Gremium für ' + zuordnen.konto.name" @schliessen="zuordnen = null">
        <form class="stack" @submit.prevent="zuordnungSpeichern">
          <div>
            <span class="label">Gremium</span>
            <select v-model="zuordnen.gremiumId" class="input" required>
              <option v-for="g in gremien" :key="g.id" :value="g.id">{{ g.name }}</option>
            </select>
          </div>
          <div v-if="zuordnen.gremiumId">
            <span class="label">Als Mitglied</span>
            <select v-model="zuordnen.mitgliedId" class="input">
              <option value="neu">Neues Mitglied «{{ zuordnen.konto.name }}» anlegen</option>
              <option v-for="m in freieMitglieder(zuordnen.gremiumId)" :key="m.id" :value="m.id">Bestehendes Mitglied: {{ m.name }}</option>
            </select>
          </div>
          <div class="row" style="justify-content: flex-end">
            <button type="button" class="btn" @click="zuordnen = null">Abbrechen</button>
            <button class="btn btn-primary">Zuordnen</button>
          </div>
        </form>
      </Modal>

      <!-- Dialog: neues Konto -->
      <Modal v-if="neuesKonto" titel="Neues Konto" @schliessen="neuesKonto = null">
        <form class="stack" @submit.prevent="kontoAnlegen">
          <div><span class="label">Name</span><input v-model.trim="neuesKonto.name" class="input" required autofocus /></div>
          <div><span class="label">E-Mail</span><input v-model.trim="neuesKonto.email" class="input" type="email" required /></div>
          <div><span class="label">Passwort</span><input v-model="neuesKonto.passwort" class="input" type="password" minlength="8" required /></div>
          <p v-if="fehler" class="small text-err">{{ fehler }}</p>
          <div class="row" style="justify-content: flex-end">
            <button type="button" class="btn" @click="neuesKonto = null">Abbrechen</button>
            <button class="btn btn-primary">Konto anlegen</button>
          </div>
        </form>
      </Modal>
    </div>
  `,
  data() {
    return { sync, tab: 'konten', gremiumFilter: '', kopiert: '', zuordnen: null, neuesKonto: null, fehler: '' }
  },
  computed: {
    gremien() {
      return gremienStore.state.gremien
    },
    // Alle Links der (gefilterten) Gremien
    links() {
      const liste = []
      for (const g of this.gremien) {
        if (this.gremiumFilter && g.id !== this.gremiumFilter) continue
        const rechte = (z) => Object.values(z.rechte).map((r) => RECHTE_KURZ[r]).join(' / ')
        g.zugaenge.forEach((z) => liste.push({ typ: 'Gremium', klasse: 'blau', name: z.name, info: `${g.name} · ${rechte(z)}`, pfad: '/zugang/', key: z.key, setze: (k) => (z.key = k) }))
        g.mitglieder.forEach((m) => liste.push({ typ: 'Persönlich', klasse: 'brand', name: m.name, info: g.name + (m.benutzerId ? ' · mit Konto' : ''), pfad: '/zugang/', key: m.zugangsKey, setze: (k) => (m.zugangsKey = k) }))
        g.themenbereiche.forEach((tb) => liste.push({ typ: 'Übersicht', klasse: 'violett', name: tb.name, info: g.name, pfad: '/themenbereich/', key: tb.freigabeKey, setze: (k) => (tb.freigabeKey = k) }))
        for (const s of sitzungenStore.sitzungenVonGremium(g.id)) {
          const name = `${s.titel || 'Sitzung'} ${formatDatum(s.datum)}`
          const vp = sitzungenStore.vorprotokollVonSitzung(s.id)
          if (vp) {
            liste.push({ typ: 'Freigabe', klasse: 'gelb', name, info: g.name, pfad: '/freigabe/', key: vp.freigabeLinkKey, setze: (k) => (vp.freigabeLinkKey = k) })
            vp.gaeste.forEach((gast) => {
              if (vp.personenKeys[gast.id]) liste.push({ typ: 'Gast', klasse: 'gelb', name: gast.name, info: `${g.name} · ${name}`, pfad: '/freigabe/', key: vp.personenKeys[gast.id], setze: (k) => (vp.personenKeys[gast.id] = k) })
            })
          }
          const p = sitzungenStore.protokollVonSitzung(s.id)
          if (p) liste.push({ typ: 'Live-Ansicht', klasse: 'gruen', name, info: g.name, pfad: '/verfolgen/', key: p.verfolgerKey, setze: (k) => (p.verfolgerKey = k) })
        }
      }
      return liste
    },
  },
  methods: {
    formatDatum,
    // Gremien, in denen ein Konto Eigentümer oder verknüpftes Mitglied ist
    zuordnungen(benutzerId) {
      const liste = []
      for (const gremium of this.gremien) {
        if (gremium.eigentuemerId === benutzerId) liste.push({ gremium, eigentuemer: true })
        const mitglied = gremium.mitglieder.find((m) => m.benutzerId === benutzerId)
        if (mitglied) liste.push({ gremium, mitglied })
      }
      return liste
    },
    freieMitglieder(gremiumId) {
      return gremienStore.byId(gremiumId).mitglieder.filter((m) => !m.benutzerId)
    },
    zuordnungSpeichern() {
      const { konto, gremiumId, mitgliedId } = this.zuordnen
      const gremium = gremienStore.byId(gremiumId)
      gremium.mitglieder.forEach((m) => {
        if (m.benutzerId === konto.id) m.benutzerId = null
      })
      if (mitgliedId === 'neu') {
        gremium.mitglieder.push({ id: crypto.randomUUID(), name: konto.name, email: konto.email, rolleId: gremium.rollen.find((r) => !r.typ)?.id || gremium.rollen[0]?.id || '', hatStimmrecht: true, zugangsKey: neuerKey(), benutzerId: konto.id })
      } else {
        gremium.mitglieder.find((m) => m.id === mitgliedId).benutzerId = konto.id
      }
      this.zuordnen = null
    },
    loesen(z) {
      if (confirm(`${z.mitglied.name} bleibt Mitglied von «${z.gremium.name}», das Konto sieht das Gremium aber nicht mehr. Lösen?`)) z.mitglied.benutzerId = null
    },
    async aendern(k, daten) {
      try {
        const antwort = await api.anfrage('benutzer_aendern', '', { id: k.id, ...daten })
        Object.assign(k, antwort.benutzer)
      } catch (fehler) {
        alert(fehler.message)
      }
    },
    passwortSetzen(k) {
      const passwort = prompt(`Neues Passwort für ${k.name} (mindestens 8 Zeichen):`)
      if (passwort) this.aendern(k, { passwortNeu: passwort })
    },
    async loeschen(k) {
      if (!confirm(`Konto von ${k.name} löschen? Mitglieder und persönliche Links bleiben bestehen; eigene Gremien gehen an dich über.`)) return
      try {
        await api.anfrage('benutzer_loeschen', '', { id: k.id })
        sync.konten = sync.konten.filter((x) => x.id !== k.id)
        for (const g of this.gremien) {
          if (g.eigentuemerId === k.id) g.eigentuemerId = null
          g.mitglieder.forEach((m) => {
            if (m.benutzerId === k.id) m.benutzerId = null
          })
        }
      } catch (fehler) {
        alert(fehler.message)
      }
    },
    async kontoAnlegen() {
      this.fehler = ''
      try {
        const antwort = await api.anfrage('registrieren', '', this.neuesKonto)
        sync.konten.push(antwort.benutzer)
        this.neuesKonto = null
      } catch (fehler) {
        this.fehler = fehler.message
      }
    },
    url(l) {
      return location.href.split('#')[0] + '#' + l.pfad + l.key
    },
    kopieren(l) {
      navigator.clipboard.writeText(this.url(l))
      this.kopiert = l.key
      setTimeout(() => (this.kopiert = ''), 2000)
    },
    erneuern(l) {
      if (confirm(`Link «${l.name}» erneuern? Der bisherige Link wird sofort ungültig.`)) l.setze(neuerKey())
    },
  },
}
