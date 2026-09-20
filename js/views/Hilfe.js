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
        <p class="muted">Ormeet funktioniert mit Passwort und Links – ein Konto braucht niemand. Wer einen Link hat, hat den dazugehörigen Zugriff – gib Links deshalb nur an die richtigen Personen weiter. Wer mag, legt sich über seinen persönlichen Link zusätzlich ein Konto an (Kapitel 3).</p>
        <div class="zeilen" style="--spalten: 10rem 1fr">
          <div class="zeile oben"><strong>Superadmin</strong><span>Meldet sich mit dem Passwort an. Sieht alle Gremien, kann sie anlegen, löschen und teilen und verwaltet unter <em>Benutzer & Links</em> alle Konten und Links.</span></div>
          <div class="zeile oben"><strong>Konto</strong><span>Anmeldung mit E-Mail und Passwort oder über einen Anbieter (Sublevia, Orki). Ein Konto bündelt alle persönlichen Links einer Person: In der Übersicht wechselt sie zwischen ihren Gremien, jedes mit eigenem Kalender-Abo. Erlaubt es der Superadmin, kann sie eigene Gremien anlegen und verwaltet diese vollständig – andere Gremien sieht sie weiterhin nur, wo sie als Mitglied hinterlegt ist.</span></div>
          <div class="zeile oben"><strong>Gremium-Link</strong><span>Wird im Gremium unter <em>Teilen</em> erstellt. Pro Link legst du fest, welche Bereiche sichtbar sind und ob sie bearbeitet werden dürfen – z. B. «Aktuariat» mit vollem Zugriff auf Sitzungen.</span></div>
          <div class="zeile oben"><strong>Persönlicher Link</strong><span>Jedes Mitglied hat einen zentralen Link (im Mitglieder-Dialog). Er zeigt eine eigene Übersicht mit Sitzungen, Terminfindungen und Pendenzen sowie einen <em>Kalender-Abo-Link</em> (Sitzungen, eigene Pendenzen, provisorische Termine mit Ja/Vielleicht – jeweils mit Link zum Vorprotokoll). Bearbeiten kann die Person, was ihr bei Traktanden zugewiesen ist – im Vorprotokoll und im Protokoll. Ist sie bei einer Sitzung als Sitzungsleitung oder Protokollführung eingetragen, hat sie dort vollen Zugriff.</span></div>
          <div class="zeile oben"><strong>Freigabe-Link</strong><span>Gehört zu einem Vorprotokoll. Der <em>allgemeine</em> Link erlaubt das Bearbeiten des ganzen Vorprotokolls. Gäste erhalten einen eigenen Link mit denselben Regeln wie beim persönlichen Link, beschränkt auf dieses Vorprotokoll.</span></div>
          <div class="zeile oben"><strong>Übersichts-Link</strong><span>Teilt die historische Übersicht eines Themenbereichs (nur lesen). Zu finden im ⋯-Menü der Übersicht.</span></div>
          <div class="zeile oben"><strong>Verfolger-Link</strong><span>Gehört zu einem Protokoll. Zuschauer sehen live, was protokolliert wird – ohne etwas ändern zu können.</span></div>
        </div>
        <p class="muted">Mit <em>Abmelden</em> oben rechts verlässt du den aktuellen Zugang. Ein Link kann jederzeit erneuert werden; der alte wird damit ungültig.</p>
      </section>

      <section id="konto" class="card stack-sm">
        <h2 class="card-title">3. Konto und Benachrichtigungen</h2>
        <ul>
          <li><strong>Konto erstellen:</strong> Öffne deinen persönlichen Link. In der Karte <em>Eigenes Konto</em> gibst du E-Mail und Passwort ein – oder du wählst <em>Mit Sublevia / Orki registrieren</em>. Der Link wird mit dem Konto verknüpft. Hast du schon ein Konto, wähle <em>Ich habe schon ein Konto</em>: So kommt ein weiteres Gremium zu deinem Konto dazu. Auch wenn du angemeldet bist und einen persönlichen Link öffnest, fragt Ormeet, ob es ihn mit deinem Konto verknüpfen soll.</li>
          <li><strong>Anmelden:</strong> Auf der Anmeldeseite mit E-Mail und Passwort oder über einen Anbieter. Der Superadmin kann dich unter <em>Benutzer & Links</em> zusätzlich weiteren Gremien zuordnen.</li>
          <li><strong>Gremium wechseln:</strong> Oben rechts in deiner Übersicht wählst du das Gremium. Jedes hat seine eigene Übersicht und einen eigenen Kalender-Abo-Link. <em>Meine Gremien</em> (Haus-Symbol) zeigt alle auf einen Blick.</li>
          <li><strong>Mein Konto</strong> (Personen-Symbol): Name und Passwort ändern, Anbieter verknüpfen, andere Geräte abmelden.</li>
          <li><strong>Glocke:</strong> Die Benachrichtigungen zeigen, was dich betrifft – offene Terminfindungen ohne deine Stimme, festgelegte Termine, Sitzungen in den nächsten sieben Tagen, dir zugewiesene Traktanden und Pendenzen, Fristen, abgeschlossene Protokolle, neue Kommentare. Ein Klick führt direkt an die passende Stelle; du siehst dort genau das, was dein Zugang erlaubt. Gelesene Einträge merkt sich dein Browser.</li>
        </ul>
      </section>

      <section id="gremium" class="card stack-sm">
        <h2 class="card-title">4. Gremium einrichten</h2>
        <ol>
          <li>Auf der Startseite Name und Beschreibung eingeben, <em>Gremium anlegen</em> klicken.</li>
          <li>Tab <strong>Mitglieder & Rollen</strong>: Mit <em>+ Mitglied</em> Personen erfassen (Name, E-Mail, Rolle, Stimmrecht). Ein Klick auf eine Person öffnet sie zum Bearbeiten.</li>
          <li>Rollen frei benennen. <em>Präsidium</em> (Sitzungsleitung) und <em>Aktuariat</em> (Protokollführung) sind feste Rollen: sie werden bei neuen Sitzungen automatisch als Leitung bzw. Protokollführung eingesetzt und können nicht gelöscht werden. Bei jeder Rolle kannst du festlegen, ob sie <em>an Sitzungen erwartet</em> wird.</li>
          <li>Tab <strong>Protokoll-Einstellungen</strong>: <em>Themenbereiche</em> (mit Farbe) ordnen Traktanden und Einträge thematisch. <em>Vorlagen</em> enthalten Kopfdaten und eine fertige Traktandenliste für wiederkehrende Sitzungen. Ändert sich eine Vorlage später, wählst du in der Vorlage unter <em>Auf bestehende Sitzungen anwenden</em> die Sitzungen ohne Protokoll aus und überträgst sie mit einem Klick – bestehende Traktanden dieser Vorprotokolle werden ersetzt, übernommene Pendenzen und vertagte Anträge bleiben. Der <em>Fusstext</em> steht am Ende jedes Protokoll-PDFs.</li>
          <li>Tab <strong>Teilen</strong> (Superadmin und Eigentümer): Links mit Rechten für andere Personen erstellen. Der Superadmin kann im Mitglieder-Dialog zudem ein Konto mit dem Mitglied verknüpfen.</li>
        </ol>
      </section>

      <section id="sitzung" class="card stack-sm">
        <h2 class="card-title">5. Sitzung erfassen und Vorprotokoll vorbereiten</h2>
        <ol>
          <li>Tab <strong>Sitzungen</strong> → <em>+ Sitzung</em>: Datum, Zeit, Ort und Vorlage wählen – oder <em>Termin per Abstimmung finden</em> (siehe Kapitel 7).</li>
          <li><em>Vorprotokoll</em> öffnen. Kopfdaten (Titel, Leitung, Protokollführung, Bemerkungen) per Klick bearbeiten.</li>
          <li>Anwesenheit anhaken, Gäste hinzufügen.</li>
          <li>Traktanden: Klick auf ein Traktandum öffnet die Bearbeitung direkt im Element – Titel und Notiz tippst du an Ort und Stelle. Darunter drei Pillen: <em>Themenbereich</em>, <em>Personen</em> (verantwortlich, wer zusätzlich bearbeiten darf) und <em>Einstellungen</em> (Typ der Einträge, geplante Dauer). Verschieben und Löschen findest du im ⋮-Menü, <em>Fertig</em> oder Escape schliesst.</li>
          <li><strong>Unterpunkte</strong> (2.1, 2.2 …): gleich aufgebaut – Titel und Notiz direkt, Pillen <em>Personen</em> und <em>Einstellungen</em>, im ⋯-Menü Verschieben, Löschen und <em>+ Unterpunkt zu 2.1</em> – so entstehen Unterpunkte von Unterpunkten (2.1.1). Ohne eigene Angaben gilt für einen Unterpunkt, was beim Punkt darüber steht.</li>
          <li><strong>Typ der Einträge:</strong> Legst du bei einem Traktandum oder Unterpunkt «Information» oder «Pendenz» fest, sind im Protokoll alle Einträge darunter automatisch von diesem Typ (nicht änderbar). Ohne Typ wählt man ihn bei jedem Eintrag.</li>
          <li><strong>Anträge erfassen:</strong> Anträge werden im Vorprotokoll formuliert, im Protokoll wird nur noch abgestimmt. Dafür gibt es zwei Typen: <em>Antrag – dieser Punkt ist der Antrag</em> (der Titel ist sein Titel, die Notiz der Antragstext; solche Punkte haben keine Unterpunkte) und <em>Anträge – jeder Unterpunkt ist ein Antrag</em> (das Traktandum ist die Liste, jeder Unterpunkt darunter ein eigener Antrag). Beim Start der Sitzung stehen sie im Protokoll als offene Anträge bereit; dort können keine Anträge mehr hinzugefügt oder umformuliert werden.</li>
          <li><strong>Geplante Dauer:</strong> Pro Traktandum kannst du Minuten eintragen; unten steht die Summe. Im Protokoll ist die Planung fix, dort trägst du nur noch die tatsächliche Dauer ein (nur bei Traktanden mit geplanter Dauer) – so siehst du, wo Sitzungen aus dem Ruder laufen.</li>
          <li>Offene Pendenzen und vertagte Anträge aus früheren Sitzungen werden automatisch übernommen (gelb markiert): Gibt es im neuen Vorprotokoll den Punkt, unter dem sie zuletzt standen (gleiche Titel, z. B. aus derselben Vorlage), erscheinen sie dort als Unterpunkt – sonst als eigenes Traktandum am Ende.</li>
          <li>Die Karte <strong>Vorprotokoll teilen</strong> zeigt, wer welchen Zugriff hat, und den passenden Link pro Person (Klick auf die Zeile). Pro Person kannst du die Stufe setzen: <em>Lesen</em> (nur ansehen), <em>Eigene</em> (zugewiesene Traktanden bearbeiten) oder <em>Alles</em> (ganzes Dokument). Vorbelegt ist der Standard – Leitung «Alles», alle anderen «Eigene»; <em>Auf Standardfreigabe zurücksetzen</em> löscht die Abweichungen. Das Gleiche gibt es im Protokoll (dort mit dem Verfolger-Link).</li>
        </ol>
      </section>

      <section id="protokoll" class="card stack-sm">
        <h2 class="card-title">6. Sitzung protokollieren</h2>
        <ol>
          <li>Im Vorprotokoll <em>Sitzung starten</em> klicken. Anwesenheit und Gäste werden übernommen und können angepasst werden; im Vorprotokoll erfasste Anträge stehen als offene Anträge bereit.</li>
          <li><strong>Traktandenliste steht fest:</strong> Sobald das Protokoll existiert, ist das Vorprotokoll abgeschlossen und nicht mehr bearbeitbar; im Protokoll lassen sich keine neuen Traktanden anlegen, nur Einträge. Muss die Traktandenliste doch geändert werden, entfernst du das Protokoll über ⋯ → <em>Protokoll entfernen</em> (alle Einträge gehen verloren) – dann ist das Vorprotokoll wieder bearbeitbar.</li>
          <li>Bei jedem Traktandum oder Unterpunkt <em>+ Eintrag</em>: Der neue Eintrag öffnet sich direkt – Titel und Inhalt tippst du im Eintrag selbst, Typ (Information, Pendenz), Themenbereich und bei Pendenzen Status, Person und Frist sind Pillen darunter. Ist der Typ beim Traktandum vorgegeben, entfällt die Wahl.</li>
          <li><strong>Anträge entscheiden:</strong> Die im Vorprotokoll formulierten Anträge stehen im Protokoll bereit – Klick öffnet nur den Beschluss (Offen, Angenommen, Abgelehnt, Vertagt, Sistiert). Bei angenommenen oder abgelehnten Anträgen kannst du die Stimmen (Ja, Nein, Enthaltungen) eintragen; der Beschluss <em>Vertagt</em> bringt den Antrag als neuen, offenen Antrag ins nächste Vorprotokoll. Neue Anträge gibt es im Protokoll nicht – sie gehören ins Vorprotokoll.</li>
          <li><strong>Letztes Protokoll genehmigen:</strong> Die Karte oberhalb der Traktanden zeigt das Protokoll der vorherigen Sitzung. <em>Protokoll genehmigen</em> friert es ein – niemand kann es mehr ändern, nur der Stand seiner Pendenzen wird weiter nachgeführt. Aufheben lässt sich das nur, indem die Sitzung gelöscht wird, an der genehmigt wurde.</li>
          <li>Ein Klick auf einen Eintrag öffnet ihn zum Bearbeiten; er bleibt offen, bis du <em>Fertig</em> klickst oder im selben Traktandum einen anderen Eintrag öffnest.</li>
          <li>Übertragene Pendenzen zeigen den Stand aus der früheren Sitzung; Status, Person und Frist änderst du direkt dort – die Änderung gilt überall.</li>
          <li>Gespeichert wird automatisch (Anzeige oben rechts). <kbd>Ctrl+S</kbd> speichert sofort.</li>
          <li>Über ⋯ den <em>Verfolger-Link</em> kopieren, wenn Personen live mitlesen sollen.</li>
          <li><strong>Nächster Sitzungstermin:</strong> Mit dem Schalter wählst du <em>Offen lassen</em>, <em>Bestehend</em> (eine schon erfasste Sitzung), <em>Neu</em> (Datum, Zeit, Ort, Vorlage) oder <em>Abstimmung</em> (Termin per Terminfindung suchen). Darunter erscheint nur, was dafür nötig ist; der Termin erscheint im Protokoll und hat schon sein eigenes Vorprotokoll.</li>
          <li><em>Sitzung abschliessen</em>. Bei Bedarf kann sie über ⋯ wieder geöffnet werden.</li>
        </ol>
      </section>

      <section id="terminfindung" class="card stack-sm">
        <h2 class="card-title">7. Termin finden</h2>
        <ol>
          <li>Beim Erfassen der Sitzung <em>Termin per Abstimmung finden</em> wählen. Die Sitzung erscheint mit Status «In Planung» und «Termin offen».</li>
          <li>Auf der Terminfindungs-Seite Vorschläge erfassen: Tage im Mini-Kalender anklicken (nochmals klicken entfernt sie) oder ein Datum von Hand mit «+» hinzufügen. Jeder Vorschlag hat in der Liste ein eigenes Datum-Zeit-Feld und optional «Bis». Die Zeit rechts gilt für neue Vorschläge; angekreuzte Vorschläge übernehmen sie mit «Auf ausgewählte übertragen». Einstellungen: nur eine Option mit «Ja», verdeckte Abstimmung, nachträgliches Ändern erlauben.</li>
          <li>Alle Beteiligten sehen die Abstimmung in ihrer Übersicht bzw. im Vorprotokoll und tragen per Klick ✓ Ja, ? Vielleicht oder ✕ Nein ein. Die Spalte mit den meisten Ja-Stimmen ist hervorgehoben; unten kann kommentiert werden.</li>
          <li>Bearbeitende können Stimmen für weitere Personen eintragen und das Ergebnis als CSV exportieren.</li>
          <li><em>Wählen</em> unter einer Spalte legt den Termin fest – Datum und Zeit werden in die Sitzung übernommen. Das Vorprotokoll kann schon vorher vorbereitet werden; ein Protokoll gibt es erst, wenn der Termin feststeht.</li>
        </ol>
      </section>

      <section id="pendenzen" class="card stack-sm">
        <h2 class="card-title">8. Pendenzen und Themenbereiche</h2>
        <ul>
          <li>Eine Pendenz hat Status (offen, in Bearbeitung, erfüllt), eine zugewiesene Person und eine Frist.</li>
          <li>Solange sie nicht erfüllt ist, wird sie in jedes neue Vorprotokoll des Gremiums übernommen.</li>
          <li>Im Tab <em>Sitzungen</em> (und in der persönlichen Übersicht) öffnet die Karte <em>Themenbereiche</em> die Historie aller Informationen, Anträge und Pendenzen aus allen Protokollen – mit Filter nach Status. <em>Ohne Themenbereich</em> sammelt alles, was keinem Thema zugeordnet ist.</li>
          <li><strong>Suche:</strong> Das Suchfeld über den Sitzungen findet Sitzungen, Traktanden, Informationen, Anträge (auch Beschlüsse) und Pendenzen – immer nur das, worauf dein Zugang Zugriff hat. Ein Klick auf den Treffer öffnet die Sitzung und springt direkt zur Stelle.</li>
        </ul>
      </section>

      <section id="pdf" class="card stack-sm">
        <h2 class="card-title">9. PDF exportieren</h2>
        <p>Im Vorprotokoll und im Protokoll über ⋯ → <em>PDF exportieren</em>. Das PDF enthält Kopfdaten, Anwesenheitstabelle, Traktanden mit Einträgen, die Pendenzenliste, den nächsten Termin und den Fusstext des Gremiums.</p>
      </section>

      <section id="bedienung" class="card stack-sm">
        <h2 class="card-title">10. Bedienprinzip</h2>
        <ul>
          <li><strong>Klick = bearbeiten.</strong> Listen zeigen eine ruhige Vorschau. Ein Klick öffnet genau dieses Element. Es bleibt offen, bis du <em>Fertig</em> klickst, Escape drückst oder ein anderes Element öffnest.</li>
          <li><strong>Farbiger Rahmen = darfst du bearbeiten.</strong> Im Vorprotokoll wie im Protokoll zeigt der Rahmen, welche Bereiche du ändern kannst.</li>
          <li><strong>⋯ / ⋮ Menüs</strong> enthalten seltene Aktionen wie Löschen, Verschieben, Links und PDF.</li>
          <li><strong>Speichern passiert automatisch</strong>, wenige Sekunden nach jeder Änderung. Bei einem Fehler erscheint oben ein roter Hinweis; es wird automatisch erneut versucht.</li>
          <li><strong>Mehrere Personen gleichzeitig:</strong> Änderungen anderer erscheinen innert einer halben Minute. Bearbeiten zwei Personen genau denselben Eintrag, zählt die zuletzt gespeicherte Version.</li>
        </ul>
      </section>

      <section id="fragen" class="card stack-sm">
        <h2 class="card-title">11. Häufige Fragen</h2>
        <dl>
          <div><dt>Ich habe einen Link weitergegeben, der nicht mehr gültig sein soll.</dt><dd>Im Gremium unter <em>Teilen</em> (bzw. bei Freigabe-Links im Vorprotokoll) den Link erneuern – der alte funktioniert dann nicht mehr.</dd></div>
          <div><dt>Warum sehe ich ein Traktandum nur grau?</dt><dd>Über deinen Link darfst du es nicht bearbeiten. Die verantwortliche Person oder das Aktuariat kann dich unter «Dürfen zusätzlich bearbeiten» eintragen – einzeln, per Rolle oder Gruppe.</dd></div>
          <div><dt>Wo liegen die Daten?</dt><dd>Auf dem Server, auf dem Ormeet installiert ist. Details stehen auf der Datenschutzseite im Fussbereich.</dd></div>
          <div><dt>Kann ich ein Protokoll nachträglich ändern?</dt><dd>Ja – über ⋯ <em>Sitzung wieder öffnen</em>.</dd></div>
          <div><dt>Wie richte ich die Anmeldung über Sublevia oder Orki ein?</dt><dd>Als Superadmin unter <em>Einstellungen</em> → <em>Anmeldung über Anbieter</em>: Beim Anbieter eine Anwendung mit der angezeigten Rückruf-Adresse anlegen, Server-URL, Client-ID und Client-Secret eintragen. Danach erscheinen die Schaltflächen auf der Anmeldeseite und in der Konto-Karte.</dd></div>
        </dl>
      </section>
    </div>
  `,
  data() {
    return {
      kapitel: [
        { id: 'ueberblick', titel: 'Der Ablauf in Kürze' },
        { id: 'zugaenge', titel: 'Wer hat Zugriff?' },
        { id: 'konto', titel: 'Konto und Benachrichtigungen' },
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
