import { api } from '../api.js'
import { sync, laden } from '../stores/sync.js'
import { gremienStore } from '../stores/gremien.js'
import { neuerKey } from '../utils/keys.js'
import { formatDatum } from '../utils/labels.js'
import MenuDropdown from '../components/MenuDropdown.js'
import Modal from '../components/Modal.js'
import MehrfachAuswahl from '../components/MehrfachAuswahl.js'
import ZugriffeListe from '../components/ZugriffeListe.js'
import { bestaetigen, eingabe, hinweis } from '../utils/dialog.js'
import InfoKnopf from '../components/InfoKnopf.js'


// Superadmin: Konten (mit Gremien-Zuordnung) und alle Zugriffe der Installation
export default {
  name: 'Benutzer',
  components: { InfoKnopf, MehrfachAuswahl, MenuDropdown, Modal, ZugriffeListe },
  template: `
    <div class="stack-lg">
      <header class="page-header" style="margin-bottom: 0">
        <p class="kicker">Superadmin</p>
        <h1 class="title">Benutzer & Links</h1>
        <nav class="tabs">
          <button class="tab" :class="{ aktiv: tab === 'konten' }" @click="tab = 'konten'">Konten</button>
          <button class="tab" :class="{ aktiv: tab === 'zugriffe' }" @click="tab = 'zugriffe'">Zugriffe</button>
        </nav>
      </header>

      <!-- Tab: Konten -->
      <template v-if="tab === 'konten'">
        <section class="card">
          <div class="card-head">
            <h2 class="card-title">Konten <InfoKnopf titel="Konten" text="Konten entstehen meist selbst: Wer einen persönlichen Link hat, kann sich darin ein Konto anlegen (E-Mail/Passwort oder Anbieter). Hier ordnest du Konten weiteren Gremien zu und vergibst Rechte." /></h2>
            <button class="btn" @click="neuesKonto = { name: '', email: '', passwort: '' }">+ Konto</button>
          </div>
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
              <MehrfachAuswahl :model-value="rechteVon(k)" :optionen="rechteOptionen(k)" placeholder="+ Recht vergeben …" @update:model-value="rechteSetzen(k, $event)" />
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

      <!-- Tab: Zugriffe: pro Gremium wer Zugriff hat und worüber, alle Links -->
      <template v-else>
        <section class="card">
          <div class="card-head">
            <h2 class="card-title">Zugriffe <InfoKnopf titel="Zugriffe" text="Pro Gremium die Mitglieder mit ihren Zugängen, die Gremium-Links und pro Sitzung die Gäste und allgemeinen Links. «Erneuern» macht den bisherigen Link sofort ungültig." /> <router-link to="/hilfe?zu=zugaenge" class="hilfe-knopf" title="Hilfe: Zugriffe mit Ablaufgrafiken" aria-label="Hilfe zu den Zugriffen">?</router-link></h2>
            <select v-model="gremiumFilter" class="input w-md">
              <option value="">Alle Gremien</option>
              <option v-for="g in gremien" :key="g.id" :value="g.id">{{ g.name }}</option>
            </select>
          </div>
          <details v-for="g in gefilterteGremien" :key="g.id" class="vorlage" :open="!!gremiumFilter">
            <summary>{{ g.kurz ? 'Kurzsitzung' : g.name }} <span class="sub">{{ g.mitglieder.length }} {{ g.mitglieder.length === 1 ? 'Person' : 'Personen' }}</span></summary>
            <div class="inhalt"><ZugriffeListe :gremium-id="g.id" /></div>
          </details>
          <p v-if="!gremien.length" class="muted small">Noch keine Gremien.</p>
        </section>
      </template>

      <!-- Dialog: Konto einem Gremium zuordnen -->
      <Modal v-if="zuordnen" :titel="'Gremium für ' + zuordnen.konto.name" @schliessen="zuordnen = null">
        <form id="formular-zuordnen" class="stack" @submit.prevent="zuordnungSpeichern">
          <div>
            <span class="label">Gremium</span>
            <select v-model="zuordnen.gremiumId" class="input" required>
              <option v-for="g in gremien.filter((g) => !g.kurz)" :key="g.id" :value="g.id">{{ g.name }}</option>
            </select>
          </div>
          <div v-if="zuordnen.gremiumId">
            <span class="label">Als Mitglied</span>
            <select v-model="zuordnen.mitgliedId" class="input">
              <option value="neu">Neues Mitglied «{{ zuordnen.konto.name }}» anlegen</option>
              <option v-for="m in freieMitglieder(zuordnen.gremiumId)" :key="m.id" :value="m.id">Bestehendes Mitglied: {{ m.name }}</option>
            </select>
          </div>
        </form>
        <template #fuss>
          <div class="row">
            <button type="button" class="btn" @click="zuordnen = null">Abbrechen</button>
            <button form="formular-zuordnen" class="btn btn-primary">Zuordnen</button>
          </div>
        </template>
      </Modal>

      <!-- Dialog: neues Konto -->
      <Modal v-if="neuesKonto" titel="Neues Konto" @schliessen="neuesKonto = null">
        <form id="formular-konto" class="stack" @submit.prevent="kontoAnlegen">
          <div><span class="label">Name</span><input v-model.trim="neuesKonto.name" class="input" required autofocus /></div>
          <div><span class="label">E-Mail</span><input v-model.trim="neuesKonto.email" class="input" type="email" required /></div>
          <div><span class="label">Passwort</span><input v-model="neuesKonto.passwort" class="input" type="password" minlength="8" required /></div>
          <p v-if="fehler" class="small text-err">{{ fehler }}</p>
        </form>
        <template #fuss>
          <div class="row">
            <button type="button" class="btn" @click="neuesKonto = null">Abbrechen</button>
            <button form="formular-konto" class="btn btn-primary">Konto anlegen</button>
          </div>
        </template>
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
    gefilterteGremien() {
      return this.gremien.filter((g) => !this.gremiumFilter || g.id === this.gremiumFilter)
    },
  },
  methods: {
    formatDatum,
    // Rechte eines Kontos als Pillen: Gremien / Kurzsitzungen anlegen, Superadmin-Konto und «Sitzungen eintragen» pro Gremium
    rechteOptionen(k) {
      const optionen = [
        { wert: 'gremien', label: 'Eigene Gremien anlegen' },
        { wert: 'kurzsitzungen', label: 'Kurzsitzungen ohne Gremium anlegen' },
        { wert: 'superadmin', label: 'Das bin ich (Superadmin)' },
      ]
      return optionen
    },
    rechteVon(k) {
      const werte = []
      if (k.darfGremienAnlegen) werte.push('gremien')
      if (k.darfKurzsitzungenAnlegen) werte.push('kurzsitzungen')
      if (this.sync.zugriff.konto?.benutzerId === k.id) werte.push('superadmin')
      return werte
    },
    rechteSetzen(k, werte) {
      const hat = (wert) => werte.includes(wert)
      if (hat('gremien') !== !!k.darfGremienAnlegen) this.aendern(k, { darfGremienAnlegen: hat('gremien') })
      if (hat('kurzsitzungen') !== !!k.darfKurzsitzungenAnlegen) this.aendern(k, { darfKurzsitzungenAnlegen: hat('kurzsitzungen') })
      if (hat('superadmin') !== (this.sync.zugriff.konto?.benutzerId === k.id)) this.superadminVerknuepfen(hat('superadmin') ? k.id : null)
    },
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
    async loesen(z) {
      if (await bestaetigen(`${z.mitglied.name} bleibt Mitglied von «${z.gremium.name}», das Konto sieht das Gremium aber nicht mehr. Lösen?`)) z.mitglied.benutzerId = null
    },
    // Superadmin mit einem Konto verknüpfen (nur eines): danach erscheint «Meine Übersicht» in der Kopfleiste
    async superadminVerknuepfen(benutzerId) {
      try {
        await api.anfrage('superadmin_konto', '', { benutzerId })
        await laden()
      } catch (fehler) {
        hinweis(fehler.message)
      }
    },
    async aendern(k, daten) {
      try {
        const antwort = await api.anfrage('benutzer_aendern', '', { id: k.id, ...daten })
        Object.assign(k, antwort.benutzer)
      } catch (fehler) {
        hinweis(fehler.message)
      }
    },
    async passwortSetzen(k) {
      const passwort = await eingabe(`Neues Passwort für ${k.name} (mindestens 8 Zeichen):`, { titel: 'Passwort setzen', typ: 'password' })
      if (passwort) this.aendern(k, { passwortNeu: passwort })
    },
    async loeschen(k) {
      if (!(await bestaetigen(`Konto von ${k.name} löschen? Mitglieder und persönliche Links bleiben bestehen; eigene Gremien gehen an dich über.`, { gefahr: true }))) return
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
        hinweis(fehler.message)
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
  },
}
