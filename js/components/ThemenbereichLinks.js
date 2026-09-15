// Schnellzugriff auf die historischen Übersichten der Themenbereiche eines Gremiums – inkl. «Ohne Themenbereich»
// für alles, was keinem Themenbereich zugeordnet ist.
export default {
  name: 'ThemenbereichLinks',
  props: {
    gremium: { type: Object, required: true },
  },
  template: `
    <section class="card">
      <h2 class="card-title">Themenbereiche</h2>
      <p class="hint">Jede Übersicht sammelt alle Informationen, Anträge und Pendenzen aus allen Protokollen zu diesem Thema.</p>
      <div class="row">
        <router-link v-for="tb in gremium.themenbereiche" :key="tb.id" :to="'/gremium/' + gremium.id + '/themenbereich/' + tb.id" class="btn">
          <span class="farbpunkt" :style="{ backgroundColor: tb.farbe }"></span> {{ tb.name }}
        </router-link>
        <router-link :to="'/gremium/' + gremium.id + '/themenbereich/ohne'" class="btn btn-ghost">
          <span class="farbpunkt" style="background-color: var(--text-leise)"></span> Ohne Themenbereich
        </router-link>
      </div>
    </section>
  `,
}
