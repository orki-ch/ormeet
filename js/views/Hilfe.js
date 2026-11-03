import ProzessKarte from '../components/ProzessKarte.js'

// Dokumentation / Hilfe in einfacher Sprache; ?zu=<kapitel> springt direkt zum Kapitel (z. B. vom (?)-Knopf der Zugriffe)
export default {
  name: 'Hilfe',
  components: { ProzessKarte },
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
          <li><strong>Einladen und verteilen</strong> – mit <em>Einladung senden</em> erhält jede Person ihren Link per E-Mail und sagt zu oder ab; per Freigabe-Link ergänzen Mitglieder ihre Punkte selbst.</li>
          <li><strong>Sitzung starten</strong> – mit <em>Sitzung starten</em> entsteht das Protokoll; darin erfasst du zu jedem Traktandum Informationen, Anträge und Pendenzen.</li>
          <li><strong>Abschliessen & PDF</strong> – Sitzung abschliessen, Protokoll als PDF exportieren.</li>
        </ol>
      </section>

      <section id="zugaenge" class="card stack-sm">
        <h2 class="card-title">2. Wer hat Zugriff?</h2>
        <p class="muted">Ormeet funktioniert mit Passwort und Links – ein Konto braucht niemand. Wer einen Link hat, hat den dazugehörigen Zugriff – gib Links deshalb nur an die richtigen Personen weiter. Wer mag, legt sich über seinen persönlichen Link zusätzlich ein Konto an (Kapitel 3).</p>
        <div class="zeilen" style="--spalten: 10rem 1fr">
          <div class="zeile oben"><strong>Superadmin</strong><span>Meldet sich mit dem Passwort an. Sieht alle Gremien, kann sie anlegen, löschen und teilen und verwaltet unter <em>Benutzer & Links</em> alle Konten und Links. Verknüpft er dort mit <em>Das bin ich</em> sein eigenes Konto, erscheint oben das Symbol <em>Meine Übersicht</em>: Es zeigt genau, woran dieses Konto beteiligt ist – unabhängig vom Superadmin-Zugriff. Unter <em>Einstellungen</em> richtet er den E-Mail-Versand und den Cronjob für die täglichen Sammelmails ein.</span></div>
          <div class="zeile oben"><strong>Konto</strong><span>Anmeldung mit E-Mail und Passwort oder über einen Anbieter (Sublevia, Orki). Ein Konto bündelt alle persönlichen Links einer Person: In der Übersicht wechselt sie zwischen ihren Gremien, jedes mit eigenem Kalender-Abo. Erlaubt es der Superadmin, kann sie eigene Gremien bzw. Kurzsitzungen ohne Gremium anlegen und verwaltet diese vollständig – andere Gremien sieht sie weiterhin nur, wo sie als Mitglied hinterlegt ist. Sitzungen und Kurzsitzungen eintragen darf, wessen Rolle das Recht «Sitzungen eintragen» hat (die Vorlagen Sitzungsleitung und Aktuariat haben «Alles») – über den persönlichen Link wie mit Konto; weiteren Mitgliedern geben dieses Recht der Superadmin (unter <em>Benutzer & Links</em>), der Eigentümer des Gremiums (im Mitglieder-Dialog) oder wer es über die Rolle hat (in der Übersicht). Eigene Sitzungen ohne Protokoll lassen sich wieder löschen.</span></div>
          <div class="zeile oben"><strong>Gremium-Link</strong><span>Wird im Gremium unter <em>Teilen</em> erstellt. Pro Link legst du fest, welche Bereiche sichtbar sind und ob sie bearbeitet werden dürfen – z. B. «Aktuariat» mit vollem Zugriff auf Sitzungen.</span></div>
          <div class="zeile oben"><strong>Persönlicher Link</strong><span>Jedes Mitglied hat einen zentralen Link (im Mitglieder-Dialog). Er zeigt eine eigene Übersicht mit Sitzungen, Terminfindungen und Pendenzen sowie einen <em>Kalender-Abo-Link</em> (Sitzungen, eigene Pendenzen, provisorische Termine mit Ja/Vielleicht – jeweils mit Link zum Vorprotokoll). Bearbeiten kann die Person, was ihr bei Traktanden zugewiesen ist – im Vorprotokoll und im Protokoll. Hat sie eine Aufgabe – Sitzungsleitung oder Protokollführung, zentral hinterlegt oder in einer Sitzung als Vertretung –, hat sie dort vollen Zugriff bis zur Genehmigung. Ist der Link mit einem Konto verknüpft, öffnet er nur noch nach der Anmeldung mit diesem Konto (das gilt auch für Links von Gästen); das Kalender-Abo funktioniert weiter.</span></div>
          <div class="zeile oben"><strong>Freigabe-Link</strong><span>Gehört zu einem Vorprotokoll. Der <em>allgemeine</em> Link erlaubt standardmässig, alle Traktanden zu ändern und zu verschieben und Unterpunkte hinzuzufügen und zu löschen; die Leitung stellt seine Rechte in der Zugriffsübersicht ein wie bei anderen Links. Gäste erhalten einen eigenen Link mit denselben Regeln wie beim persönlichen Link, beschränkt auf dieses Vorprotokoll.</span></div>
          <div class="zeile oben"><strong>Weitere allgemeine Links</strong><span>Pro Dokument (Terminfindung, Vorprotokoll, Protokoll) beliebig viele, mit eigenem Namen und Rechten: nur lesen, alles bearbeiten oder einzelne Rechte. Zu finden in der Zugriffsübersicht der Sitzung. Wer einen allgemeinen Link öffnet, gibt zuerst Vor- und Nachnamen und E-Mail an und erhält damit einen eigenen Link (die Adresse wechselt sofort; sie öffnet die Sitzung auch auf einem anderen Gerät). Diese <em>weitere Person</em> hat die Rechte des allgemeinen Links und kann sich danach mit einem Klick ein Konto anlegen. Ist die E-Mail schon erfasst, entsteht keine neue Person: Ormeet bietet an, den bestehenden Link an diese Adresse zu senden (höchstens einmal pro Viertelstunde, ohne zu verraten, ob es die Adresse gibt). Gibt es jemanden mit gleichem Namen, erhalten die Verwaltenden einen Vorschlag zum Zusammenführen. Allgemeine Links lassen sich mit einem Passwort schützen und ablaufen lassen (an einem Datum oder wenn das Protokoll genehmigt ist); eigene Links, die darüber entstanden sind, laufen mit ab.</span></div>
          <div class="zeile oben"><strong>Übersichts-Link</strong><span>Teilt die historische Übersicht eines Themenbereichs (nur lesen). Zu finden im ⋯-Menü der Übersicht.</span></div>
          <div class="zeile oben"><strong>Verfolger-Link</strong><span>Gehört zu einem Protokoll. Zuschauer sehen live, was protokolliert wird – ohne etwas ändern zu können.</span></div>
        </div>
        <p class="muted">Das Menü oben rechts (drei Striche) zeigt, wie du angemeldet bist und ob alles gespeichert ist; dort findest du je nach Zugang <em>Mein Konto</em>, <em>Benutzer & Links</em>, <em>Einstellungen</em> und <em>Abmelden</em>, womit du den aktuellen Zugang verlässt. Ein Link kann jederzeit erneuert werden; der alte wird damit ungültig.</p>
        <p class="muted"><strong>Zugriffe verwalten:</strong> Wer hat Zugriff, und worüber? Die Zugriffsübersicht zeigt alle Personen mit ihrem Weg (persönlicher Link, Konto, eigener Link über einen allgemeinen Link) und wann sie zuletzt da waren, dazu alle Links. Für eine Sitzung öffnen Sitzungsleitung und Protokollführung sie im ⋯-Menü von Terminfindung, Vorprotokoll oder Protokoll (<em>Zugriffe verwalten</em>); Eigentümer und Superadmin finden sie fürs ganze Gremium im Reiter <em>Zugriffe</em> bzw. unter <em>Benutzer & Links</em>. Sitzungsleitung und Protokollführung sperren Personen für ihre Sitzung in zwei Stufen – <em>nur lesen</em> (sieht alles, ändert nichts) oder <em>ganz sperren</em> (sieht die Sitzung nicht) – oder entfernen sie daraus, erneuern Links und versehen sie mit Passwort und Ablauf; Eigentümer und Superadmin sperren Zugänge zudem fürs ganze Gremium oder entfernen Mitglieder. Eine weitere Person nehmen Superadmin, Eigentümer und Gremium-Links mit «Mitglieder bearbeiten» über ⋯ › <em>Als Mitglied aufnehmen …</em> mit einer Rolle ins Gremium auf; Konto, Stimmen und Link gehen mit. E-Mail-Adressen von Gästen und weiteren Personen sehen nur, wer die Sitzung verwaltet – jede Person ihre eigene.</p>
        <h3 class="mt-2">Ablauf: Rechte in einer Sitzung</h3>
        <ProzessKarte karte="rechte" />
        <h3 class="mt-2">Ablauf: Persönlichen Link öffnen</h3>
        <ProzessKarte karte="link" />
        <h3 class="mt-2">Ablauf: Allgemeiner Link</h3>
        <ProzessKarte karte="allg" />
      
      </section>

      <section id="konto" class="card stack-sm">
        <h2 class="card-title">3. Konto und Benachrichtigungen</h2>
        <ul>
          <li><strong>Konto erstellen:</strong> Öffne deinen persönlichen Link. In der Karte <em>Eigenes Konto</em> gibst du E-Mail und Passwort ein – oder du wählst <em>Mit Sublevia / Orki registrieren</em>. Der Link wird mit dem Konto verknüpft. Hast du schon ein Konto, wähle <em>Ich habe schon ein Konto</em>: So kommt ein weiteres Gremium zu deinem Konto dazu. Auch wenn du angemeldet bist und einen persönlichen Link öffnest, fragt Ormeet, ob es ihn mit deinem Konto verknüpfen soll.</li>
          <li><strong>Anmelden mit Orki:</strong> Orki übernimmt nur die Anmeldung – Name und E-Mail bleiben die deines Ormeet-Kontos, von Orki kommen keine Daten. Entweder verknüpfst du Orki unter <em>Mein Konto</em> mit deinem bestehenden Konto (<em>Mit Orki verknüpfen</em>), oder du registrierst dich über deinen persönlichen Link mit <em>Mit Orki registrieren</em>: Dann entsteht ein Konto mit deinem Namen und deiner E-Mail aus Ormeet, ohne eigenes Passwort – du meldest dich nur über Orki an. Danach genügt auf der Anmeldeseite <em>Mit Orki anmelden</em>. Die Anmeldung läuft in einem eigenen Fenster; danach öffnet Ormeet die Seite, die du aufrufen wolltest.</li>
          <li><strong>Konto über einen allgemeinen Link:</strong> Nach dem Eintragen mit Name und E-Mail lädt die Karte <em>Eigenes Konto</em> dazu ein; es fehlt nur noch ein Passwort (oder ein Klick auf einen Anbieter). Hast du schon ein Konto, meldest du dich dort an.</li>
          <li><strong>Passwort vergessen:</strong> Auf der Anmeldeseite <em>Passwort vergessen?</em> wählen und die E-Mail des Kontos eingeben. Du erhältst einen Link, der eine Stunde gilt; damit legst du ein neues Passwort fest, und andere Geräte werden abgemeldet.</li>
          <li><strong>Anmelden:</strong> Auf der Anmeldeseite mit E-Mail und Passwort oder über einen Anbieter. Der Superadmin kann dich unter <em>Benutzer & Links</em> zusätzlich weiteren Gremien zuordnen.</li>
          <li><strong>Gremium wechseln:</strong> Oben rechts in deiner Übersicht wählst du das Gremium. Jedes hat seine eigene Übersicht und einen eigenen Kalender-Abo-Link. <em>Meine Gremien</em> (Haus-Symbol) zeigt alle auf einen Blick.</li>
          <li><strong>Mein Konto</strong> (im Menü oben rechts): Name und Passwort ändern, Anbieter verknüpfen, E-Mails ein- und ausschalten, andere Geräte abmelden.</li>
          <li><strong>E-Mails:</strong> Hat der Superadmin den Cronjob eingerichtet, erhältst du mit Konto höchstens eine Sammelmail pro Tag mit allem Neuen aus der Glocke – nur wenn es etwas gibt. Die erste Mail enthält gleich das Wichtige (bevorstehende Sitzungen, fehlende Stimmen, Pendenzen, zugewiesene Traktanden); Älteres gilt als bekannt. Jede Mail hat einen Link zum Abbestellen.</li>
          <li><strong>Abmelden auf einem Link:</strong> Weil du nur mit dem Link wieder hineinkommst, fragt Ormeet nach und bietet <em>Link kopieren</em> an. In <em>Ansehen als …</em> beendet <em>Abmelden</em> nur die Ansicht.</li>
          <li><strong>Glocke:</strong> Die Benachrichtigungen zeigen, was dich betrifft – offene Terminfindungen ohne deine Stimme, festgelegte Termine, bevorstehende Sitzungen (wie viele Tage vorher, stellt das Gremium unter <em>Protokoll-Einstellungen › Erinnerung</em> ein; Standard drei), dir zugewiesene Traktanden und Pendenzen, Fristen, abgeschlossene Protokolle, neue Kommentare. Ein Klick führt direkt an die passende Stelle; du siehst dort genau das, was dein Zugang erlaubt. Gelesene Einträge merkt sich dein Browser.</li>
        </ul>
      </section>

      <section id="gremium" class="card stack-sm">
        <h2 class="card-title">4. Gremium einrichten</h2>
        <ol>
          <li>Auf der Startseite Name und Beschreibung eingeben, <em>Gremium anlegen</em> klicken.</li>
          <li>Tab <strong>Mitglieder & Rollen</strong>: Mit <em>+ Mitglied</em> Personen erfassen (Name, E-Mail, Rolle, Stimmrecht). Ein Klick auf eine Person öffnet sie zum Bearbeiten.</li>
          <li><strong>Rollen</strong> frei benennen. Bei jeder Rolle legst du fest, ob sie <em>an Sitzungen erwartet</em> wird und was sie darf – mit einem Hauptschalter: <em>Lesen</em> (nur ansehen), <em>Eigene</em> (zugewiesene Traktanden und Einträge), <em>Individuell</em> (Einzelrechte über ⋯: Vorprotokoll, Protokoll und Sitzung – Sitzungen eintragen, Sitzung starten und abschliessen, Änderungsanträge entscheiden, Einladungen senden, Zugriffe verwalten) oder <em>Alles</em> (wirklich alles). Die Rechte gelten in allen Sitzungen des Gremiums, über den persönlichen Link wie mit Konto. Neue Gremien haben die Rollen <em>Sitzungsleitung</em> und <em>Aktuariat</em> (Standard «Alles», nicht löschbar) und <em>Mitglied</em> (Standard «Eigene»).</li>
          <li><strong>Aufgaben</strong> (über den Rollen): Sitzungsleitung und Protokollführung sind keine Rollen, sondern Aufgaben. Wer hier steht, übernimmt die Aufgabe automatisch in jeder neuen Sitzung und hat in allen Sitzungen des Gremiums sämtliche Bearbeitungsrechte – Vor- und Protokoll, Start und Abschluss, Entscheide zu Änderungsanträgen – bis das Protokoll genehmigt ist. In der Mitgliederliste steht die Aufgabe neben der Rolle.</li>
          <li>Tab <strong>Protokoll-Einstellungen</strong>: <em>Themenbereiche</em> (mit Farbe) ordnen Traktanden und Einträge thematisch. <em>Vorlagen</em> enthalten Kopfdaten und eine fertige Traktandenliste für wiederkehrende Sitzungen. Ändert sich eine Vorlage später, wählst du in der Vorlage unter <em>Auf bestehende Sitzungen anwenden</em> die Sitzungen ohne Protokoll aus und überträgst sie mit einem Klick – bestehende Traktanden dieser Vorprotokolle werden ersetzt, übernommene Pendenzen und vertagte Anträge bleiben. Der <em>Fusstext</em> steht am Ende jedes Protokoll-PDFs.</li>
          <li>Tab <strong>Teilen</strong> (Superadmin und Eigentümer): Links mit Rechten für andere Personen erstellen. Superadmin und Eigentümer können im Mitglieder-Dialog zudem ein Konto mit dem Mitglied verknüpfen oder es wieder lösen (Eigentümer aus den Konten ihrer Gremien); Name und E-Mail kommen dann vom Konto.</li>
        </ol>
      </section>

      <section id="sitzung" class="card stack-sm">
        <h2 class="card-title">5. Sitzung erfassen und Vorprotokoll vorbereiten</h2>
        <ol>
          <li>Tab <strong>Sitzungen</strong> → <em>+ Sitzung</em>: Datum, Zeit, Ort und Vorlage wählen – oder <em>Termin per Abstimmung finden</em> (siehe Kapitel 7).</li>
          <li><em>Vorprotokoll</em> öffnen. Kopfdaten (Titel, Leitung, Protokollführung, Bemerkungen) per Klick bearbeiten. Ist für eine Aufgabe niemand anwesend, erscheint ein Hinweis: Wer die Sitzung eingetragen hat oder Zugriffe verwaltet, trägt eine <em>Vertretung</em> ein – spätestens im Fenster <em>Sitzung starten</em>, wo sie aus den Anwesenden gewählt wird. Die Vertretung hat in dieser Sitzung alle Rechte einer Aufgabe.</li>
          <li>Anwesenheit anhaken, Gäste hinzufügen.</li>
          <li><strong>Einladung senden</strong> (oben im Vorprotokoll): Wähle <em>Einladung</em> (Termin und Link) oder <em>Vorprotokoll</em> (Termin, Traktanden und Link), hake die Empfänger an (erwartete Mitglieder und Gäste mit E-Mail) und schreib bei Bedarf eine eigene Nachricht. Jede Person erhält ihren persönlichen Link, einen Kalendereintrag, <em>Zusagen</em> / <em>Absagen</em> und einen Link zum Abbestellen. Ohne Antwort gilt die Einladung als angenommen. Wer absagt, gibt einen Grund an und wird aus der Anwesenheit ausgetragen; den Grund sehen nur Sitzungsleitung und Protokollführung (Symbol neben dem Namen). Die Antwort lässt sich bis zum Sitzungsstart ändern. Nach <em>Termin festlegen</em> in der Terminfindung fragt Ormeet, ob die Einladung gleich verschickt werden soll.</li>
          <li>Traktanden: Klick auf ein Traktandum öffnet die Bearbeitung direkt im Element – Titel und Notiz tippst du an Ort und Stelle. Darunter drei Pillen: <em>Themenbereich</em>, <em>Personen</em> (verantwortlich, wer zusätzlich bearbeiten darf) und <em>Einstellungen</em> (Typ der Einträge, geplante Dauer). Verschieben und Löschen findest du im ⋮-Menü, <em>Fertig</em> oder Escape schliesst.</li>
          <li><strong>Unterpunkte</strong> (2.1, 2.2 …): gleich aufgebaut – Titel und Notiz direkt, Pillen <em>Personen</em> und <em>Einstellungen</em>, im ⋯-Menü Verschieben und Löschen, darunter der Knopf <em>+ Unterpunkt zu 2.1</em> – so entstehen Unterpunkte von Unterpunkten (2.1.1). Ohne eigene Angaben gilt für einen Unterpunkt, was beim Punkt darüber steht.</li>
          <li><strong>Typ der Einträge:</strong> Legst du bei einem Traktandum oder Unterpunkt «Information» oder «Pendenz» fest, sind im Protokoll alle Einträge darunter automatisch von diesem Typ (nicht änderbar). Ohne Typ wählt man ihn bei jedem Eintrag.</li>
          <li><strong>Anträge erfassen:</strong> Anträge werden im Vorprotokoll formuliert, im Protokoll wird nur noch abgestimmt. Dafür gibt es zwei Typen: <em>Antrag – dieser Punkt ist der Antrag</em> (der Titel ist sein Titel, die Notiz der Antragstext; solche Punkte haben keine Unterpunkte) und <em>Anträge – jeder Unterpunkt ist ein Antrag</em> (das Traktandum ist die Liste, jeder Unterpunkt darunter ein eigener Antrag). Beim Start der Sitzung stehen sie im Protokoll als offene Anträge bereit; dort können keine Anträge mehr hinzugefügt oder umformuliert werden.</li>
          <li><strong>Geplante Dauer:</strong> Pro Traktandum kannst du Minuten eintragen; unten steht die Summe. Im Protokoll ist die Planung fix, dort trägst du nur noch die tatsächliche Dauer ein (nur bei Traktanden mit geplanter Dauer) – so siehst du, wo Sitzungen aus dem Ruder laufen.</li>
          <li>Offene Pendenzen und vertagte Anträge aus früheren Sitzungen werden automatisch übernommen (gelb markiert): Gibt es im neuen Vorprotokoll den Punkt, unter dem sie zuletzt standen (gleiche Titel, z. B. aus derselben Vorlage), erscheinen sie dort als Unterpunkt – sonst als eigenes Traktandum am Ende. Über ⋯ → <em>Vorprotokoll neu aufsetzen</em> löschst du das Vorprotokoll und legst es wie beim Anlegen der Sitzung neu an (Vorlage, Anwesenheit); Pendenzen und vertagte Anträge werden dabei wieder an ihrem bisherigen Ort eingefügt.</li>
          <li><strong>Rechte und Links</strong> verwaltest du in der <strong>Zugriffsübersicht</strong> der Sitzung (⋯-Menü › <em>Zugriffe verwalten</em>). Pro Person stehen dort zwei Pillen-Schalter für Vorprotokoll und Protokoll: <em>Lesen</em> (nur ansehen), <em>Eigene</em> (zugewiesene Traktanden bearbeiten) oder <em>Alles</em> (ganzes Dokument). Vorbelegt ist der Standard der Rolle; die Leitung und die Protokollführung einer Sitzung haben dort immer «Alles». In der Anwesenheit stehen hinten bei jeder Person und jedem Gast ein Knopf zum Kopieren des Links und einer für ihre Rechte.</li>
          <li><strong>Rechte-Fenster:</strong> Über ⋯ › <em>Individuelle Rechte einstellen</em> oder den Knopf in der Anwesenheit öffnet sich ein Fenster mit «Lesen, Eigene, Individuell, Alles» pro Dokument und <em>Auf Rollenstandard zurücksetzen</em>. Bei <em>Individuell</em> wählst du mit <em>Regeln</em>, was die Person lesen oder bearbeiten darf: einen Themenbereich, alles, wo eine bestimmte Person hinterlegt ist (verantwortlich, als Bearbeiter eingetragen oder mit zugewiesener Pendenz), oder einzelne Traktanden und Unterpunkte. Regeln zählen zusammen, Bearbeiten schliesst Lesen ein. Wer Regeln hat, sieht nur, was sie abdecken – Kopfdaten, Anwesenheit und Gäste bleiben sichtbar, die Nummern bleiben die originalen. Dazu kommen wahlweise die eigenen Traktanden und Pendenzen sowie einzelne Rechte (im Vorprotokoll: Traktanden bearbeiten, ändern und verschieben, hinzufügen, Anwesenheit, Gäste; im Protokoll: Informationen, Pendenzen, Antragsbeschlüsse).</li>
          <li><strong>Allgemeine Links</strong> legst du ebenfalls in der Zugriffsübersicht an – beliebig viele pro Dokument, je mit Name und Stufe <em>Lesen</em>, <em>Eigene</em> (nur Vorprotokoll), <em>Alles</em> oder <em>Individuell</em>. Der allgemeine Freigabe-Link des Vorprotokolls steht standardmässig auf <em>Eigene</em>: alle Traktanden ändern und verschieben, Unterpunkte hinzufügen und löschen.</li>
          <li><strong>Ansehen als …</strong> (⋯ bei einer Person) öffnet in einem neuen Tab die App so, wie die Person sie sieht – nur lesen, während zwei Stunden. Wer nur eine Sitzung verwaltet, sieht dort nur diese Sitzung.</li>
        </ol>
        <h3 class="mt-2">Ablauf: Einladung</h3>
        <ProzessKarte karte="einladung" />
      
      </section>

      <section id="protokoll" class="card stack-sm">
        <h2 class="card-title">6. Sitzung protokollieren</h2>
        <ol>
          <li>Im Vorprotokoll <em>Sitzung starten</em> klicken. Bis dahin zeigt die Protokoll-Seite eine Vorschau der Traktanden; erst mit <em>Sitzung starten</em> (mit Rückfrage) entsteht das Protokoll. Anwesenheit und Gäste werden übernommen (abgesagte Gäste nicht) und können angepasst werden; im Vorprotokoll erfasste Anträge stehen als offene Anträge bereit.</li>
          <li><strong>Traktandenliste steht fest:</strong> Sobald das Protokoll existiert, ist das Vorprotokoll abgeschlossen und nicht mehr bearbeitbar; im Protokoll kommen nur noch Einträge und Zusatztraktanden dazu. Muss die Traktandenliste doch geändert werden, entfernst du das Protokoll über ⋯ → <em>Protokoll entfernen</em> (alle Einträge gehen verloren) – dann ist das Vorprotokoll wieder bearbeitbar.</li>
          <li>Bei jedem Traktandum oder Unterpunkt <em>+ Eintrag</em>: Der neue Eintrag öffnet sich direkt – Titel und Inhalt tippst du im Eintrag selbst, Typ (Information, Pendenz), Themenbereich und bei Pendenzen Status, Person und Frist sind Pillen darunter. Ist der Typ beim Traktandum vorgegeben, entfällt die Wahl.</li>
          <li><strong>Anträge entscheiden:</strong> Die im Vorprotokoll formulierten Anträge stehen im Protokoll bereit – Klick öffnet nur den Beschluss (Offen, Angenommen, Abgelehnt, Vertagt, Sistiert). Bei angenommenen oder abgelehnten Anträgen kannst du die Stimmen (Ja, Nein, Enthaltungen) eintragen; der Beschluss <em>Vertagt</em> bringt den Antrag als neuen, offenen Antrag ins nächste Vorprotokoll. Unter dem Beschluss hältst du in einer <em>Notiz</em> fest, was zur Beratung und zum Entscheid wichtig ist; der Antragstext selbst bleibt, wie er im Vorprotokoll stand. Neue Anträge gibt es im Protokoll nicht – sie gehören ins Vorprotokoll.</li>
          <li><strong>Zusatztraktanden:</strong> Kommt an der Sitzung ein Geschäft dazu, das nicht im Vorprotokoll steht, klickst du auf die kleine Pille <em>+ Zusatztraktandum</em> im Zwischenraum unter einem Traktandum; das Zusatztraktandum steht dann direkt danach. Es trägt keine Nummer, sondern die Bezeichnung «Zusatztraktandum», und kann an jeder Stelle im Ablauf stehen (Pille <em>Nach …</em>). Im Feld <em>Weshalb kam dieses Traktandum an der Sitzung hinzu?</em> hältst du fest, warum vom Vorprotokoll abgewichen wird; in der Ansicht öffnet sich dieser Text erst auf Klick, im PDF steht er klein unter dem Titel. Einträge erfasst du darin wie bei jedem Traktandum.</li>
          <li><strong>Letztes Protokoll genehmigen:</strong> Die Karte oberhalb der Traktanden zeigt das Protokoll der vorherigen Sitzung. <em>Protokoll genehmigen</em> friert es ein – niemand kann es mehr ändern, nur der Stand seiner Pendenzen wird weiter nachgeführt. Aufheben lässt sich das nur, indem die Sitzung gelöscht wird, an der genehmigt wurde.</li>
          <li>Ein Klick auf einen Eintrag öffnet ihn zum Bearbeiten; er bleibt offen, bis du <em>Fertig</em> klickst oder im selben Traktandum einen anderen Eintrag öffnest.</li>
          <li>Übertragene Pendenzen zeigen den Stand aus der früheren Sitzung; Status, Person und Frist änderst du direkt dort – die Änderung gilt überall.</li>
          <li>Gespeichert wird automatisch (Anzeige oben rechts). <kbd>Ctrl+S</kbd> speichert sofort.</li>
          <li>Über ⋯ den <em>Verfolger-Link</em> kopieren, wenn Personen live mitlesen sollen.</li>
          <li><strong>Nächster Sitzungstermin:</strong> Mit dem Schalter wählst du <em>Offen lassen</em>, <em>Bestehend</em> (eine schon erfasste Sitzung), <em>Neu</em> (Datum, Zeit, Ort, Vorlage) oder <em>Abstimmung</em> (Termin per Terminfindung suchen). Darunter erscheint nur, was dafür nötig ist; der Termin erscheint im Protokoll und hat schon sein eigenes Vorprotokoll.</li>
          <li><em>Sitzung abschliessen</em>. Bei Bedarf kann sie über ⋯ wieder geöffnet werden. Starten, abschliessen und wieder öffnen darf, wer eine Aufgabe in der Sitzung hat, das Recht «Sitzung starten und abschliessen» oder das Protokoll ganz bearbeiten darf.</li>
          <li><strong>Änderungsanträge:</strong> Ist eine Sitzung abgeschlossen, können alle Mitglieder mit Konto, die an der Sitzung erwartet waren oder dabei waren, sowie anwesende Gäste und weitere Personen (über ihren Link, im Vorprotokoll <em>Zum Protokoll →</em>) zu jedem Punkt eine Änderung beantragen: Traktandum, Unterpunkt oder Eintrag anklicken, im kleinen Fenster beschreiben, was geändert werden soll, und absenden. Solange der Antrag offen ist, lässt er sich noch anpassen oder zurückziehen.</li>
          <li>Die Sitzungsleitung und die Protokollführung erhalten eine Benachrichtigung; ein Klick führt direkt an die betroffene Stelle. Oben im Protokoll stehen alle Änderungsanträge, offene sind rot markiert – auch an der Stelle selbst. Die Protokollführung passt das Protokoll direkt an und entscheidet mit <em>Übernommen</em> oder <em>Abgelehnt</em> (entscheiden dürfen alle mit einer Aufgabe, dem Recht «Änderungsanträge entscheiden» oder wer die Sitzungen verwaltet), auf Wunsch mit einer kurzen Antwort; die antragstellende Person erfährt den Entscheid.</li>
          <li>Sobald das Protokoll genehmigt ist, sind keine Änderungsanträge und keine Änderungen mehr möglich – auch nicht für die Protokollführung. Kurzsitzungen haben keine Änderungsanträge.</li>
        </ol>
        <h3 class="mt-2">Ablauf: Sitzungsverlauf</h3>
        <ProzessKarte karte="verlauf" />
        <h3 class="mt-2">Ablauf: Gleichzeitig speichern</h3>
        <ProzessKarte karte="gleich" />
      
      </section>

      <section id="kurzsitzungen" class="card stack-sm">
        <h2 class="card-title">7. Kurzsitzungen</h2>
        <ul>
          <li><strong>Wozu:</strong> Für kurze, spontane Besprechungen, die einfach festgehalten werden sollen. Eine Kurzsitzung steht immer für sich: Sie hat kein Vorprotokoll, keinen nächsten Termin, keine Genehmigung, und offene Pendenzen oder vertagte Anträge werden nirgends hin übernommen.</li>
          <li><strong>Ohne Gremium:</strong> Auf der Startseite unter <em>Kurzsitzungen</em> auf <em>+ Kurzsitzung</em> klicken. Das dürfen die Verwaltung (Superadmin) und Konten, denen sie das erlaubt hat. Teilnehmende lädst du im Protokoll mit Name und E-Mail ein; jede Person erhält einen persönlichen Link. Hat sie ein Konto mit derselben E-Mail, erscheint die Kurzsitzung zudem in ihrer Übersicht.</li>
          <li><strong>Mit Gremium:</strong> Im Gremium im Reiter <em>Kurzsitzungen</em>. Die Teilnehmenden wählst du aus den Mitgliedern; Gäste kommen wie gewohnt dazu und erhalten einen eigenen Link. Mitglieder sehen die Kurzsitzung in ihrer Übersicht, wenn sie teilnehmen.</li>
          <li><strong>Termin:</strong> Standardmässig findet die Kurzsitzung heute zur nächsten vollen Viertelstunde statt – so beginnt das Protokoll sofort. Alternativ suchst du den Termin per Abstimmung; die Teilnehmenden stimmen dann wie bei einer normalen Sitzung ab.</li>
          <li><strong>Protokollieren:</strong> Mit <em>+ Traktandum</em> erfasst du die Traktanden fortlaufend während der Besprechung. Darunter kommen Einträge wie in jedem Protokoll; Anträge entstehen hier direkt samt Beschluss, Abstimmung und Notiz. Leitung und Protokollführung ist, wer die Kurzsitzung angelegt hat. Wer was darf, legst du pro Person in der Zugriffsübersicht (⋯ › <em>Zugriffe verwalten</em>) oder mit dem Rechte-Knopf bei den Teilnehmenden fest.</li>
        </ul>
      </section>

      <section id="terminfindung" class="card stack-sm">
        <h2 class="card-title">8. Termin finden</h2>
        <ol>
          <li>Beim Erfassen der Sitzung <em>Termin per Abstimmung finden</em> wählen. Die Sitzung erscheint mit Status «In Planung» und «Termin offen».</li>
          <li>Auf der Terminfindungs-Seite Vorschläge erfassen: Tage im Mini-Kalender anklicken (nochmals klicken entfernt sie) oder ein Datum von Hand mit «+» hinzufügen. Jeder Vorschlag hat in der Liste ein eigenes Datum-Zeit-Feld und optional «Bis». Die Zeit rechts gilt für neue Vorschläge; angekreuzte Vorschläge übernehmen sie mit «Auf ausgewählte übertragen». Einstellungen: nur eine Option mit «Ja», verdeckte Abstimmung, nachträgliches Ändern erlauben.</li>
          <li>Alle Beteiligten sehen die Abstimmung in ihrer Übersicht bzw. im Vorprotokoll und tragen per Klick ✓ Ja, ? Vielleicht oder ✕ Nein ein. Die Spalte mit den meisten Ja-Stimmen ist hervorgehoben; unten kann kommentiert werden.</li>
          <li>Bearbeiten darf die Terminfindung, wer die Sitzung eingetragen hat (bei älteren Sitzungen die Sitzungsleitung), sowie Superadmin und Eigentümer. Unter <em>Bearbeitung freigeben an</em> gibt die eintragende Person die Bearbeitung an Rollen oder Personen weiter.</li>
          <li>Bearbeitende können Stimmen für weitere Personen eintragen und das Ergebnis als CSV exportieren.</li>
          <li><strong>Personen entfernen:</strong> Mit ✕ in der Zeile entfernen Bearbeitende eine Person aus der Terminfindung – oder die Person sich selbst. Sie ist damit für diese Sitzung entschuldigt und steht unter <em>Entschuldigt</em>; ↺ nimmt sie wieder auf.</li>
          <li><strong>Weitere Personen verknüpfen:</strong> Wer über einen allgemeinen Link ein Konto angelegt hat, erscheint unter <em>Weitere Personen mit Konto</em>. Sitzungsleitung, Protokollführung, wer Sitzungen eintragen oder Zugriffe verwalten darf, und der Superadmin verknüpfen sie dort mit einem Mitglied (auch einem entfernten): Stimmen und Kommentare gehen auf das Mitglied über, und es ist wieder dabei.</li>
          <li><em>Wählen</em> unter einer Spalte legt den Termin fest – Datum und Zeit werden in die Sitzung übernommen. Das Vorprotokoll kann schon vorher vorbereitet werden; ein Protokoll gibt es erst, wenn der Termin feststeht.</li>
        </ol>
      </section>

      <section id="pendenzen" class="card stack-sm">
        <h2 class="card-title">9. Pendenzen und Themenbereiche</h2>
        <ul>
          <li>Eine Pendenz hat Status (offen, in Bearbeitung, erfüllt), eine zugewiesene Person und eine Frist – ein Datum oder <em>bis zur nächsten Sitzung</em>. Dann gilt der Termin der nächsten Sitzung als Frist, sobald er feststeht.</li>
          <li>Solange sie nicht erfüllt ist, wird sie in jedes neue Vorprotokoll des Gremiums übernommen.</li>
          <li>Im Tab <em>Sitzungen</em> (und in der persönlichen Übersicht) öffnet die Karte <em>Themenbereiche</em> die Historie aller Informationen, Anträge und Pendenzen aus allen Protokollen – mit Filter nach Status. <em>Ohne Themenbereich</em> sammelt alles, was keinem Thema zugeordnet ist.</li>
          <li><strong>Suche:</strong> Das Suchfeld über den Sitzungen findet Sitzungen, Traktanden, Informationen, Anträge (auch Beschlüsse) und Pendenzen – immer nur das, worauf dein Zugang Zugriff hat. Ein Klick auf den Treffer öffnet die Sitzung und springt direkt zur Stelle.</li>
        </ul>
      </section>

      <section id="pdf" class="card stack-sm">
        <h2 class="card-title">10. PDF exportieren</h2>
        <p>Im Vorprotokoll und im Protokoll über ⋯ → <em>PDF exportieren</em>. Das PDF enthält dieselben Angaben wie die Ansicht: Kopfdaten, Anwesenheitstabelle, den Stand des letzten Protokolls, Traktanden und Zusatztraktanden mit Einträgen (bei Anträgen Beschluss, Abstimmung und Notiz), die Pendenzenliste, den nächsten Termin und den Fusstext des Gremiums. Nur die Darstellung ist fürs Papier angepasst.</p>
      </section>

      <section id="bedienung" class="card stack-sm">
        <h2 class="card-title">11. Bedienprinzip</h2>
        <ul>
          <li><strong>Klick = bearbeiten.</strong> Listen zeigen eine ruhige Vorschau. Ein Klick öffnet genau dieses Element. Es bleibt offen, bis du <em>Fertig</em> klickst, Escape drückst oder ein anderes Element öffnest.</li>
          <li><strong>Farbiger Rahmen = darfst du bearbeiten.</strong> Im Vorprotokoll wie im Protokoll zeigt der Rahmen, welche Bereiche du ändern kannst.</li>
          <li><strong>⋯ / ⋮ Menüs</strong> enthalten seltene Aktionen wie Löschen, Verschieben, Links und PDF.</li>
          <li><strong>Speichern passiert automatisch</strong>, wenige Sekunden nach jeder Änderung. Bei einem Fehler erscheint oben ein roter Hinweis; es wird automatisch erneut versucht.</li>
          <li><strong>Mehrere Personen gleichzeitig:</strong> Änderungen anderer erscheinen innert einer halben Minute. Speichern zwei Personen gleichzeitig, bleiben die Änderungen beider erhalten (pro Feld, Traktandum, Eintrag und Anwesenheit). Haben beide dieselbe Stelle geändert, gilt die neuere Änderung, und ein Hinweis zeigt, welche Stelle betroffen war.</li>
        </ul>
      </section>

      <section id="fragen" class="card stack-sm">
        <h2 class="card-title">12. Häufige Fragen</h2>
        <dl>
          <div><dt>Ich habe einen Link weitergegeben, der nicht mehr gültig sein soll.</dt><dd>Gremium-Links im Gremium unter <em>Teilen</em>, alle anderen in der Zugriffsübersicht der Sitzung erneuern – der alte funktioniert dann nicht mehr.</dd></div>
          <div><dt>Warum sehe ich ein Traktandum nur grau?</dt><dd>Über deinen Link darfst du es nicht bearbeiten. Die verantwortliche Person oder die Protokollführung kann dich unter «Dürfen zusätzlich bearbeiten» eintragen – einzeln, per Rolle oder Gruppe.</dd></div>
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
        { id: 'kurzsitzungen', titel: 'Kurzsitzungen' },
        { id: 'terminfindung', titel: 'Termin finden' },
        { id: 'pendenzen', titel: 'Pendenzen und Themenbereiche' },
        { id: 'pdf', titel: 'PDF exportieren' },
        { id: 'bedienung', titel: 'Bedienprinzip' },
        { id: 'fragen', titel: 'Häufige Fragen' },
      ],
    }
  },
  mounted() {
    if (this.$route.query.zu) setTimeout(() => this.springe(this.$route.query.zu), 150)
  },
  watch: {
    '$route.query.zu'(zu) {
      if (zu) this.springe(zu)
    },
  },
  methods: {
    springe(id) {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    },
  },
}
