// Dokumentation / Hilfe in einfacher Sprache
export default {
  name: 'Hilfe',
  template: `
    <div class="doc stack-lg">
      <header class="page-header" style="margin-bottom: 0">
        <p class="kicker">Dokumentation</p>
        <h1 class="title">So funktioniert Ormeet</h1>
        <p class="muted mt-1">Ormeet hilft dir, Sitzungen vorzubereiten, live zu protokollieren und Pendenzen im Blick zu behalten. Alles läuft im Browser, gespeichert wird automatisch.</p>
      </header>

      <nav class="card">
        <h2 class="card-title">Inhalt</h2>
        <ol class="inhalt-liste">
          <li v-for="(k, i) in kapitel" :key="k.id"><a :href="'#/hilfe#' + k.id" @click.prevent="springe(k.id)">{{ i + 1 }}. {{ k.titel }}</a></li>
        </ol>
      </nav>

      <section id="ueberblick" class="card stack-sm">
        <h2 class="card-title">1. Der Ablauf in Kürze</h2>
        <ol>
          <li><strong>Gremium anlegen</strong> – z. B. «OK Camp». Dort pflegst du Mitglieder, Rollen und Einstellungen.</li>
          <li><strong>Sitzung erfassen</strong> – Datum, Zeit, Ort, optional mit einer Vorlage.</li>
          <li><strong>Vorprotokoll vorbereiten</strong> – Traktanden, Anwesenheit, Gäste. Offene Pendenzen früherer Sitzungen kommen automatisch dazu.</li>
          <li><strong>Vorprotokoll verteilen</strong> – per Freigabe-Link können Mitglieder ihre Punkte selbst ergänzen.</li>
          <li><strong>Sitzung starten</strong> – im Protokoll erfasst du zu jedem Traktandum Informationen, Anträge und Pendenzen.</li>
          <li><strong>Abschliessen & PDF</strong> – Sitzung abschliessen, Protokoll als PDF exportieren.</li>
        </ol>
      </section>

      <section id="zugaenge" class="card stack-sm">
        <h2 class="card-title">2. Wer hat Zugriff?</h2>
        <p class="muted">Ormeet kennt kein Login pro Person, sondern Passwort und Links. Wer einen Link hat, hat den dazugehörigen Zugriff – gib Links deshalb nur an die richtigen Personen weiter.</p>
        <div class="zeilen" style="--spalten: 10rem 1fr">
          <div class="zeile oben"><strong>Superadmin</strong><span>Meldet sich mit dem Passwort an. Sieht alle Gremien, kann sie anlegen, löschen und teilen.</span></div>
          <div class="zeile oben"><strong>Gremium-Link</strong><span>Wird im Gremium unter <em>Teilen</em> erstellt. Pro Link legst du fest, welche Bereiche sichtbar sind und ob sie bearbeitet werden dürfen – z. B. «Aktuariat» mit vollem Zugriff auf Sitzungen.</span></div>
          <div class="zeile oben"><strong>Persönlicher Link</strong><span>Jedes Mitglied hat einen zentralen Link (im Mitglieder-Dialog). Er zeigt eine eigene Übersicht mit Sitzungen, Terminfindungen und Pendenzen sowie einen <em>Kalender-Abo-Link</em> (Sitzungen, eigene Pendenzen, provisorische Termine mit Ja/Vielleicht – jeweils mit Link zum Vorprotokoll). Bearbeiten kann die Person, was ihr bei Traktanden zugewiesen ist – im Vorprotokoll und im Protokoll. Ist sie bei einer Sitzung als Sitzungsleitung oder Protokollführung eingetragen, hat sie dort vollen Zugriff.</span></div>
          <div class="zeile oben"><strong>Freigabe-Link</strong><span>Gehört zu einem Vorprotokoll. Der <em>allgemeine</em> Link erlaubt das Bearbeiten des ganzen Vorprotokolls. Gäste erhalten einen eigenen Link mit denselben Regeln wie beim persönlichen Link, beschränkt auf dieses Vorprotokoll.</span></div>
          <div class="zeile oben"><strong>Übersichts-Link</strong><span>Teilt die historische Übersicht eines Themenbereichs (nur lesen). Zu finden im ⋯-Menü der Übersicht.</span></div>
          <div class="zeile oben"><strong>Verfolger-Link</strong><span>Gehört zu einem Protokoll. Zuschauer sehen live, was protokolliert wird – ohne etwas ändern zu können.</span></div>
        </div>
        <p class="muted">Mit <em>Abmelden</em> oben rechts verlässt du den aktuellen Zugang. Ein Link kann jederzeit erneuert werden; der alte wird damit ungültig.</p>
      </section>

      <section id="gremium" class="card stack-sm">
        <h2 class="card-title">3. Gremium einrichten</h2>
        <ol>
          <li>Auf der Startseite Name und Beschreibung eingeben, <em>Gremium anlegen</em> klicken.</li>
          <li>Tab <strong>Mitglieder & Rollen</strong>: Mit <em>+ Mitglied</em> Personen erfassen (Name, E-Mail, Rolle, Stimmrecht). Ein Klick auf eine Person öffnet sie zum Bearbeiten.</li>
          <li>Rollen frei benennen. <em>Präsidium</em> (Sitzungsleitung) und <em>Aktuariat</em> (Protokollführung) sind feste Rollen: sie werden bei neuen Sitzungen automatisch als Leitung bzw. Protokollführung eingesetzt und können nicht gelöscht werden. Bei jeder Rolle kannst du festlegen, ob sie <em>an Sitzungen erwartet</em> wird.</li>
          <li>Tab <strong>Protokoll-Einstellungen</strong>: <em>Themenbereiche</em> (mit Farbe) ordnen Traktanden und Einträge thematisch. <em>Vorlagen</em> enthalten Kopfdaten und eine fertige Traktandenliste für wiederkehrende Sitzungen. Der <em>Fusstext</em> steht am Ende jedes Protokoll-PDFs.</li>
          <li>Tab <strong>Teilen</strong> (nur Superadmin): Links mit Rechten für andere Personen erstellen.</li>
        </ol>
      </section>

      <section id="sitzung" class="card stack-sm">
        <h2 class="card-title">4. Sitzung erfassen und Vorprotokoll vorbereiten</h2>
        <ol>
          <li>Tab <strong>Sitzungen</strong> → <em>+ Sitzung</em>: Datum, Zeit, Ort und Vorlage wählen – oder <em>Termin per Abstimmung finden</em> (siehe Kapitel 6).</li>
          <li><em>Vorprotokoll</em> öffnen. Kopfdaten (Titel, Leitung, Protokollführung, Bemerkungen) per Klick bearbeiten.</li>
          <li>Anwesenheit anhaken, Gäste hinzufügen.</li>
          <li>Traktanden: Klick auf ein Traktandum öffnet die Bearbeitung – Titel, Themenbereich, Notiz, Unterpunkte (2.1, 2.2 …), verantwortliche Personen und wer zusätzlich bearbeiten darf. Verschieben und Löschen findest du im ⋮-Menü.</li>
          <li>Offene Pendenzen aus früheren Sitzungen werden automatisch als Traktanden angehängt (gelb markiert «Pendenz»).</li>
          <li>Unter <em>Freigabe-Links</em> die Links kopieren und verteilen. Empfänger erkennen ihre bearbeitbaren Traktanden am blauen Rahmen.</li>
        </ol>
      </section>

      <section id="protokoll" class="card stack-sm">
        <h2 class="card-title">5. Sitzung protokollieren</h2>
        <ol>
          <li>Im Vorprotokoll <em>Sitzung starten</em> klicken. Anwesenheit und Gäste werden übernommen und können angepasst werden.</li>
          <li>Bei jedem Traktandum oder Unterpunkt <em>+ Eintrag</em>: Typ wählen (Information, Antrag, Pendenz), Titel eingeben, Enter. Anträge und Pendenzen öffnen sich direkt, um Beschluss bzw. Status, Person und Frist zu setzen.</li>
          <li>Ein Klick auf einen Eintrag öffnet ihn zum Bearbeiten; er bleibt offen, bis du <em>Fertig</em> klickst oder im selben Traktandum einen anderen Eintrag öffnest.</li>
          <li>Übertragene Pendenzen zeigen den Stand aus der früheren Sitzung; Status, Person und Frist änderst du direkt dort – die Änderung gilt überall.</li>
          <li>Gespeichert wird automatisch (Anzeige oben rechts). <kbd>Ctrl+S</kbd> speichert sofort.</li>
          <li>Unten den nächsten Sitzungstermin erfassen – er erscheint im Protokoll und hat schon sein eigenes Vorprotokoll.</li>
          <li>Über ⋯ den <em>Verfolger-Link</em> kopieren, wenn Personen live mitlesen sollen.</li>
          <li><em>Sitzung abschliessen</em>. Bei Bedarf kann sie über ⋯ wieder geöffnet werden.</li>
        </ol>
      </section>

      <section id="terminfindung" class="card stack-sm">
        <h2 class="card-title">6. Termin finden</h2>
        <ol>
          <li>Beim Erfassen der Sitzung <em>Termin per Abstimmung finden</em> wählen. Die Sitzung erscheint mit Status «In Planung» und «Termin offen».</li>
          <li>Auf der Terminfindungs-Seite Vorschläge erfassen: Tag, Von, optional Bis. Einstellungen: nur eine Option mit «Ja», verdeckte Abstimmung, nachträgliches Ändern erlauben.</li>
          <li>Alle Beteiligten sehen die Abstimmung in ihrer Übersicht bzw. im Vorprotokoll und tragen per Klick ✓ Ja, ? Vielleicht oder ✕ Nein ein. Die Spalte mit den meisten Ja-Stimmen ist hervorgehoben; unten kann kommentiert werden.</li>
          <li>Bearbeitende können Stimmen für weitere Personen eintragen und das Ergebnis als CSV exportieren.</li>
          <li><em>Wählen</em> unter einer Spalte legt den Termin fest – Datum und Zeit werden in die Sitzung übernommen. Das Vorprotokoll kann schon vorher vorbereitet werden; ein Protokoll gibt es erst, wenn der Termin feststeht.</li>
        </ol>
      </section>

      <section id="pendenzen" class="card stack-sm">
        <h2 class="card-title">7. Pendenzen und Themenbereiche</h2>
        <ul>
          <li>Eine Pendenz hat Status (offen, in Bearbeitung, erfüllt), eine zugewiesene Person und eine Frist.</li>
          <li>Solange sie nicht erfüllt ist, wird sie in jedes neue Vorprotokoll des Gremiums übernommen.</li>
          <li>Im Tab <em>Protokoll-Einstellungen</em> öffnet <em>Übersicht</em> bei einem Themenbereich die Historie aller Informationen, Anträge und Pendenzen aus allen Protokollen – mit Filter nach Status.</li>
        </ul>
      </section>

      <section id="pdf" class="card stack-sm">
        <h2 class="card-title">8. PDF exportieren</h2>
        <p>Im Vorprotokoll und im Protokoll über ⋯ → <em>PDF exportieren</em>. Das PDF enthält Kopfdaten, Anwesenheitstabelle, Traktanden mit Einträgen, die Pendenzenliste, den nächsten Termin und den Fusstext des Gremiums.</p>
      </section>

      <section id="bedienung" class="card stack-sm">
        <h2 class="card-title">9. Bedienprinzip</h2>
        <ul>
          <li><strong>Klick = bearbeiten.</strong> Listen zeigen eine ruhige Vorschau. Ein Klick öffnet genau dieses Element. Es bleibt offen, bis du <em>Fertig</em> klickst, Escape drückst oder ein anderes Element öffnest.</li>
          <li><strong>Farbiger Rahmen = darfst du bearbeiten.</strong> Im Vorprotokoll wie im Protokoll zeigt der Rahmen, welche Bereiche du ändern kannst.</li>
          <li><strong>⋯ / ⋮ Menüs</strong> enthalten seltene Aktionen wie Löschen, Verschieben, Links und PDF.</li>
          <li><strong>Speichern passiert automatisch</strong>, wenige Sekunden nach jeder Änderung. Bei einem Fehler erscheint oben ein roter Hinweis; es wird automatisch erneut versucht.</li>
          <li><strong>Mehrere Personen gleichzeitig:</strong> Änderungen anderer erscheinen innert einer halben Minute. Bearbeiten zwei Personen genau denselben Eintrag, zählt die zuletzt gespeicherte Version.</li>
        </ul>
      </section>

      <section id="fragen" class="card stack-sm">
        <h2 class="card-title">10. Häufige Fragen</h2>
        <dl>
          <div><dt>Ich habe einen Link weitergegeben, der nicht mehr gültig sein soll.</dt><dd>Im Gremium unter <em>Teilen</em> (bzw. bei Freigabe-Links im Vorprotokoll) den Link erneuern – der alte funktioniert dann nicht mehr.</dd></div>
          <div><dt>Warum sehe ich ein Traktandum nur grau?</dt><dd>Über deinen Link darfst du es nicht bearbeiten. Die verantwortliche Person oder das Aktuariat kann dich unter «Dürfen zusätzlich bearbeiten» eintragen – einzeln, per Rolle oder Gruppe.</dd></div>
          <div><dt>Wo liegen die Daten?</dt><dd>Auf dem Server, auf dem Ormeet installiert ist. Details stehen auf der Datenschutzseite im Fussbereich.</dd></div>
          <div><dt>Kann ich ein Protokoll nachträglich ändern?</dt><dd>Ja – über ⋯ <em>Sitzung wieder öffnen</em>.</dd></div>
        </dl>
      </section>
    </div>
  `,
  data() {
    return {
      kapitel: [
        { id: 'ueberblick', titel: 'Der Ablauf in Kürze' },
        { id: 'zugaenge', titel: 'Wer hat Zugriff?' },
        { id: 'gremium', titel: 'Gremium einrichten' },
        { id: 'sitzung', titel: 'Sitzung erfassen und Vorprotokoll' },
        { id: 'protokoll', titel: 'Sitzung protokollieren' },
        { id: 'terminfindung', titel: 'Termin finden' },
        { id: 'pendenzen', titel: 'Pendenzen und Themenbereiche' },
        { id: 'pdf', titel: 'PDF exportieren' },
        { id: 'bedienung', titel: 'Bedienprinzip' },
        { id: 'fragen', titel: 'Häufige Fragen' },
      ],
    }
  },
  methods: {
    springe(id) {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    },
  },
}
