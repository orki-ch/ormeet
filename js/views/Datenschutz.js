// Datenschutzerklärung nach Schweizer Datenschutzgesetz (DSG); erkennt Domain und Installationsort automatisch
export default {
  name: 'Datenschutz',
  template: `
    <div class="doc stack-lg">
      <header class="page-header" style="margin-bottom: 0">
        <p class="kicker">Rechtliches</p>
        <h1 class="title">Datenschutzerklärung</h1>
        <p class="muted mt-1">für die Ormeet-Installation unter <strong>{{ adresse }}</strong> · Stand {{ datum }}</p>
      </header>

      <section class="card">
        <h2 class="card-title">1. Verantwortliche Stelle</h2>
        <p>Verantwortlich für die Bearbeitung von Personendaten in dieser Anwendung ist die Betreiberin bzw. der Betreiber der Website <strong>{{ domain }}</strong>, auf der Ormeet installiert ist.</p>
        <p v-if="kontakt">Kontakt: {{ kontakt }}</p>
        <p v-else class="muted">Kontaktangaben finden Sie im Impressum von {{ domain }}.</p>
        <p>Grundlage dieser Erklärung ist das Schweizer Bundesgesetz über den Datenschutz (DSG, SR 235.1) in der seit 1. September 2023 geltenden Fassung.</p>
      </section>

      <section class="card">
        <h2 class="card-title">2. Welche Daten bearbeitet werden</h2>
        <p>Ormeet ist ein Werkzeug zur Führung von Sitzungsprotokollen. Dabei werden folgende Personendaten erfasst und gespeichert:</p>
        <ul>
          <li><strong>Mitglieder eines Gremiums:</strong> Name, E-Mail-Adresse (optional), Rolle, Stimmrecht.</li>
          <li><strong>Gäste einer Sitzung:</strong> Name und Organisation.</li>
          <li><strong>Sitzungsinhalte:</strong> Anwesenheit, Traktanden, Informationen, Anträge und Beschlüsse, Pendenzen mit zugewiesener Person und Frist, freie Notizen.</li>
          <li><strong>Zugangsdaten:</strong> zufällig erzeugte Link-Schlüssel für Gremien, Vorprotokolle und Protokolle.</li>
        </ul>
        <p>Die Anwendung selbst setzt keine Cookies und verwendet keine Analyse- oder Tracking-Dienste. Alle Programmbibliotheken werden von {{ domain }} geladen; es werden keine Inhalte von Drittanbietern eingebunden.</p>
        <p>Der Webserver von {{ domain }} kann aus technischen Gründen Zugriffsprotokolle (z. B. IP-Adresse, Zeitpunkt, aufgerufene Adresse) führen. Dafür gelten die Bestimmungen des jeweiligen Hosting-Anbieters.</p>
      </section>

      <section class="card">
        <h2 class="card-title">3. Zweck und Rechtsgrundlage</h2>
        <p>Die Daten werden ausschliesslich zur Vorbereitung, Durchführung und Dokumentation von Sitzungen des jeweiligen Gremiums bearbeitet (Art. 6 DSG: Rechtmässigkeit, Verhältnismässigkeit, Zweckbindung). Die Erfassung von Mitgliedern und Gästen erfolgt durch das Gremium selbst im Rahmen seiner Tätigkeit; die betroffenen Personen sind in der Regel Mitglieder oder Gäste dieses Gremiums.</p>
      </section>

      <section class="card">
        <h2 class="card-title">4. Speicherort und Sicherheit</h2>
        <p>Alle Daten werden auf dem Server gespeichert, auf dem diese Installation läuft: <code>{{ speicherort }}</code>. Es findet keine Übermittlung an andere Server oder ins Ausland durch die Anwendung statt.</p>
        <p v-if="verschluesselt">Die Verbindung zwischen Ihrem Browser und {{ domain }} ist verschlüsselt (HTTPS).</p>
        <p v-else class="text-err">Hinweis: Diese Installation wird derzeit ohne HTTPS aufgerufen. Daten werden unverschlüsselt übertragen. Die Betreiberin sollte eine verschlüsselte Verbindung einrichten.</p>
        <p>Der Zugriff ist durch ein Passwort (Superadmin) sowie durch geheime, zufällig erzeugte Links geschützt. Wer einen Link kennt, erhält den dazugehörigen Zugriff. Die Betreiberin trifft angemessene technische und organisatorische Massnahmen zur Datensicherheit (Art. 8 DSG); Links sollten nur an berechtigte Personen weitergegeben und bei Bedarf erneuert werden.</p>
      </section>

      <section class="card">
        <h2 class="card-title">5. Speicherung in Ihrem Browser</h2>
        <p>Ihr Browser speichert lokal (localStorage) lediglich den Zugangsschlüssel, mit dem Sie angemeldet sind, damit Sie beim nächsten Aufruf nicht erneut anmelden müssen. Mit <em>Abmelden</em> wird dieser Eintrag gelöscht. Es werden keine weiteren Daten lokal abgelegt.</p>
      </section>

      <section class="card">
        <h2 class="card-title">6. Weitergabe an Dritte</h2>
        <p>Die Anwendung gibt keine Daten an Dritte weiter. Der Zugang zu Sitzungsinhalten erfolgt ausschliesslich über die von Berechtigten weitergegebenen Links (Gremium-, Freigabe- und Verfolger-Links) sowie über exportierte PDF-Dokumente. Für deren Weitergabe ist das jeweilige Gremium verantwortlich.</p>
      </section>

      <section class="card">
        <h2 class="card-title">7. Aufbewahrung und Löschung</h2>
        <p>Die Daten bleiben gespeichert, solange das Gremium sie für seine Tätigkeit benötigt. Der Superadmin kann einzelne Sitzungen oder ganze Gremien jederzeit unwiderruflich löschen. Mitglieder und Gäste können vom Gremium entfernt werden; in bereits erstellten Protokollen bleiben Namen als Teil des Sitzungsprotokolls erhalten.</p>
      </section>

      <section class="card">
        <h2 class="card-title">8. Ihre Rechte</h2>
        <p>Nach dem DSG haben Sie insbesondere das Recht auf Auskunft über die zu Ihrer Person bearbeiteten Daten (Art. 25 DSG), auf Berichtigung unrichtiger Daten (Art. 32 DSG), auf Löschung sowie auf Herausgabe oder Übertragung Ihrer Daten (Art. 28 DSG). Wenden Sie sich dafür an die verantwortliche Stelle (Ziffer 1). Bei Streitigkeiten können Sie sich an den Eidgenössischen Datenschutz- und Öffentlichkeitsbeauftragten (EDÖB) wenden.</p>
      </section>

      <section class="card">
        <h2 class="card-title">9. Änderungen</h2>
        <p>Diese Erklärung kann angepasst werden, wenn sich die Anwendung oder die rechtlichen Vorgaben ändern. Es gilt jeweils die hier veröffentlichte Fassung.</p>
      </section>
    </div>
  `,
  computed: {
    domain() {
      return location.hostname
    },
    adresse() {
      return location.origin + location.pathname
    },
    speicherort() {
      return location.origin + location.pathname.replace(/[^/]*$/, '') + 'data/'
    },
    verschluesselt() {
      return location.protocol === 'https:' || location.hostname === 'localhost'
    },
    kontakt() {
      return window.ORMEET_KONTAKT || ''
    },
    datum() {
      return new Date().toLocaleDateString('de-CH', { month: 'long', year: 'numeric' })
    },
  },
}
