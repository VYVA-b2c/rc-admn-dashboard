# Benutzerhandbuch - VYVA x Red Cross Konsole

Version: 2026-06-20
Aktualisiert: 20. Juni 2026
URL: https://rcadmin.vyva.life/manuals/VYVA_Admin_Console_User_Manual_DE.pdf

## 1. Zweck und Umfang der Konsole
Die VYVA x Red Cross Konsole ist ein operativer Arbeitsbereich für Betreuung, Nachverfolgung, Risikosignale, Medikationsroutinen, Kampagnen und Versorgungsabdeckung älterer Klientinnen und Klienten.
Dieses Handbuch richtet sich an Administratoren, Koordinatoren, Operatoren und autorisiertes professionelles Personal. Es beschreibt, wie die aktuelle Konsole genutzt wird, welche Daten jede Ansicht liefern soll und welche Aktionen eine externe Integration benötigen.
Die Konsole folgt dem Prinzip der minimal notwendigen Information: Erfassen Sie nur Daten, die für Koordination, Sicherheit und Betreuung wirklich gebraucht werden.
- Clients sind die betreuten Personen.
- Team members sind interne Benutzerkonten für die Konsole.
- Emergency contacts sind Angehörige, Nachbarn oder informelle Betreuungspersonen.
- Red Cross staff ist professionelles Personal der Organisation.

## 2. Anmeldung
Die sichtbare Anmeldung erfolgt ausschließlich per E-Mail. Admins geben ihre E-Mail-Adresse ein und erhalten einen sicheren Magic Link.
Google- und Microsoft-OAuth bleiben ausgeblendet, bis diese Anbieter bewusst aktiviert werden. Supabase Auth dient nur als Identitätsschicht für den E-Mail-Link; Replit verwaltet Organisationen, Rollen, Teams und operative Daten.
Nach dem Login ordnet das System die E-Mail einer Rolle und Organisation zu. Unbekannte E-Mails erhalten keinen Konsolenzugriff.
1. Öffnen Sie die veröffentlichte Konsolen-URL.
2. Geben Sie Ihre Admin-E-Mail-Adresse ein.
3. Öffnen Sie den neuesten Magic Link aus Ihrem Postfach.
4. Prüfen Sie nach dem Login die aktive Organisation.

![Anmeldung per E-Mail und Magic Link.](../current/screenshots-from-english/screenshot-01.png)
*Anmeldung per E-Mail und Magic Link.*

![Magic-Link-E-Mail mit sicherem Zugang zur Konsole.](../current/screenshots-from-english/screenshot-02.png)
*Magic-Link-E-Mail mit sicherem Zugang zur Konsole.*

## 3. Rollen und Berechtigungen
Berechtigungen werden aus der authentifizierten E-Mail und den Backend-Profilen abgeleitet. Die Oberfläche soll die echte Rolle anzeigen, zum Beispiel Super admin, Admin, Coordinator oder Operator.
Superadmins werden nicht in der UI erstellt. Sie werden über Backend-Kontrollen wie VYVA_PLATFORM_ADMIN_EMAILS oder Profileinstellungen vergeben.
| Rolle | Hauptumfang | Hinweis |
| --- | --- | --- |
| Super admin | Kann Organisationen wechseln und Organisationsadmins erstellen. | Nicht über die normale UI verwaltet. |
| Admin | Verwaltet Clients, Team, Kampagnen, Kontakte, Zeitpläne und Einstellungen der Organisation. | Kann Teammitglieder anlegen. |
| Coordinator / Operator | Bearbeitet Queues, Profile und zugewiesene Aufgaben. | Sensible Aktionen können eingeschränkt sein. |
| Primär zugewiesenes Red Cross staff | Kann bestimmte Care-Plan-Daten bearbeiten, wenn Zustimmung vorliegt. | Nicht dasselbe wie Emergency contact. |

## 4. Aktive Organisation
Die aktive Organisation bestimmt, welche Daten in der Konsole angezeigt werden. Beim Wechsel zwischen Red Cross Zamora und Red Cross Leipzig müssen Clients, Kampagnen, Check-ins, Brain Coach, Medikation, Risiko, Kontakte, Personal, Reports und Karte neu geladen werden.
Red Cross Zamora nutzt standardmäßig Spanisch, Spanien und Europe/Madrid. Red Cross Leipzig nutzt Deutsch, Deutschland und Europe/Berlin.
Die Zuordnung ist strikt: spanische Nummern und Adressen gehören zu Zamora; deutsche Nummern und Adressen gehören zu Leipzig. Es darf kein generischer Fallback Clients in die falsche Organisation verschieben.

## 5. Allgemeine Navigation
Die Seitenleiste gruppiert die Arbeit in Main, Follow-up und Management. Die wichtigsten Bereiche sind Today, Clients, Risk, Sensors, Check-ins, Medication, Brain Coach, Campaigns, Care Providers, Reports, Team access und Settings.
Der Kopfbereich zeigt Konsole, aktive Organisation, Systemstatus und den angemeldeten Benutzer. Bei Superadmins erscheint zusätzlich der Organisationswechsel.
| Bereich | Zweck |
| --- | --- |
| Today | Tägliche operative Übersicht mit Kennzahlen und Karte. |
| Clients | Client-Queue und Pflegeprofile. |
| Risk | Priorisierte Fälle nach Risiko, Nichtantwort, Medikation oder fehlender Abdeckung. |
| Sensors | Vorbereiteter Bereich für Gerätedaten. |
| Check-ins | Routine-Check-up-Anrufe und Status. |
| Brain Coach | Kognitive Routinen und Aktivitätsberichte. |
| Campaigns | VYVA-Anrufkampagnen. |

![Seitennavigation mit operativen Bereichen.](../current/screenshots-from-english/screenshot-03.png)
*Seitennavigation mit operativen Bereichen.*

## 6. Today Dashboard
Today fasst den operativen Zustand der aktiven Organisation zusammen. Kennzahlen müssen eine klare Berechnungslogik und einen eindeutigen Zeitraum haben.
Die Karte steht oben und behält das Leaflet-Verhalten bei: stabile Größe, korrektes Resize, Tiles, Clustering und passende Zentrierung für das Land der aktiven Organisation.
Check-ins werden wöchentlich bewertet: erledigte Check-ins im Verhältnis zu erwarteten Check-ins dieser Woche.
- Active clients: aktive Clients in der Organisation.
- Urgent: Fälle mit sofortigem Handlungsbedarf.
- Review: Fälle für heutige Operator-Prüfung.
- Check-ins: wöchentliche Erfüllung.
- Medication: offene oder unbestätigte Medikationssignale.

![Today Dashboard mit Kennzahlen, Filtern und Karte.](../current/screenshots-from-english/screenshot-04.png)
*Today Dashboard mit Kennzahlen, Filtern und Karte.*

## 7. Clients
Clients ist die Hauptliste betreuter Personen. Sie können nach Name, Telefon, Stadt oder Kontakt suchen und nach Dringlichkeit, Review, No response, Medication, Check-ins oder Unassigned filtern.
Die Aktionen Add client, Import clients und API intake gehören zur Client-Erstellung. Teamkonten werden nicht hier erstellt.
1. Add client für einzelne neue Clients.
2. Import clients für CSV-Upload.
3. API intake für Clients, die bereits im Onboarding-Backend existieren.
4. Eine Zeile öffnen, um Profil und Care coverage zu prüfen.

![Client-Liste mit Suche, Filtern und Care coverage.](../current/screenshots-from-english/screenshot-05.png)
*Client-Liste mit Suche, Filtern und Care coverage.*

## 8. Clients erstellen oder importieren
Das Client-Formular ist als Care Profile Intake aufgebaut: Person und Kontakt, medizinisches Mindestprofil, Medikation, Zustimmung, Emergency contact und Follow-up-Routinen.
Telefonnummern müssen im internationalen Format mit + und Ländercode erfasst werden. Das unterstützt Routing, Organisationserkennung und spätere Anrufintegration.
CSV-Importe müssen dieselben Regeln für minimale notwendige Daten beachten. Emergency contacts aus CSV oder Onboarding bleiben persönliche Kontakte und werden nicht zu Red Cross staff.

![Care Profile Intake für neue Clients.](../current/screenshots-from-english/screenshot-06.png)
*Care Profile Intake für neue Clients.*

## 9. Client-Profil
Das Client-Profil ist die zentrale Arbeitsansicht. Es zeigt Name, Stadt, Status, Telefon, Sprache, Adresse, Zustimmung, letzten Kontakt und Care coverage.
Die Karte Medication and check-ins zeigt Medikamente, Zeiten, Frequenz und Routinen. View adherence öffnet den wöchentlichen Medikationskalender des Clients.
Call now, Send WhatsApp und Contact care provider dürfen keine Aktion vortäuschen. Wenn kein Gateway verbunden ist, muss die UI erklären, dass eine Gateway-Verbindung erforderlich ist.

![Client-Profil mit Status, Aktionen und Care Cards.](../current/screenshots-from-english/screenshot-07.png)
*Client-Profil mit Status, Aktionen und Care Cards.*

![Medikation, Check-ins und Brain Coach im Client-Profil.](../current/screenshots-from-english/screenshot-08.png)
*Medikation, Check-ins und Brain Coach im Client-Profil.*

## 10. Emergency contacts
Emergency contacts sind nicht-professionelle Unterstützungspersonen: Familie, Nachbarn, informelle Betreuung oder persönliche Notfallkontakte.
Diese Kontakte werden während Onboarding, eingehenden Gesprächen oder im Admin-Intake erfasst. Die Seite darf kein Red Cross staff enthalten.
Ein Client kann mehrere Emergency contacts haben, und ein Kontakt kann mehreren Clients zugeordnet sein.

![Emergency contacts aus Onboarding oder Intake.](../current/screenshots-from-english/screenshot-09.png)
*Emergency contacts aus Onboarding oder Intake.*

## 11. Red Cross staff
Red Cross staff ist professionelles Personal der aktiven Organisation. Es wird getrennt von Emergency contacts verwaltet.
Beim Zuweisen von Personal wird eine professionelle Rolle ausgewählt, nicht eine familiäre Beziehung. Beispiele sind Field coordinator, Primary operator, Medication support, Social worker oder Supervisor.

![Professionelles Red Cross staff getrennt von persönlichen Kontakten.](../current/screenshots-from-english/screenshot-10.png)
*Professionelles Red Cross staff getrennt von persönlichen Kontakten.*

## 12. Check-ins
Check-ins ist nur für Check-up-Anrufe. Brain Coach Sessions werden auf der separaten Brain Coach Seite geführt.
Jede Zeile zeigt Client, Telefon, Typ, Status, letzten Check-in, Frequenz, bevorzugte Uhrzeit und Aktionen.
Wenn die geplante Uhrzeit vorbei ist und kein erfolgreicher Verlauf existiert, muss die Zeile Missed today anzeigen. Erfolgreiche Anrufe werden als Confirmed oder Completed angezeigt. Eskalationen werden als Escalated markiert.
| Status | Bedeutung |
| --- | --- |
| Active | Routine ist aktiviert. |
| Missed | Geplanter Anruf ist ohne Bestätigung verstrichen. |
| Confirmed / Completed | Anruf wurde erfolgreich abgeschlossen. |
| Escalated | Notfall- oder Eskalationsprotokoll wurde ausgelöst. |
| Cancelled | Routine oder geplanter Anruf wurde beendet. |

![Check-in-Routinen mit Status und bevorzugter Uhrzeit.](../current/screenshots-from-english/screenshot-11.png)
*Check-in-Routinen mit Status und bevorzugter Uhrzeit.*

## 13. Brain Coach
Brain Coach zeigt kognitive Routinen und Aktivitätsberichte. Die Tabelle zeigt aktive und inaktive Routinen mit Frequenz und bevorzugter Uhrzeit.
Das Report-Icon öffnet den Brain Coach Aktivitätsbericht, nicht das allgemeine Client-Profil. Der Bericht zeigt Durchschnittswert, abgeschlossene Sessions, Fragen, Streak und Details für 7, 30 oder 90 Tage.
Die Profil-Timeline soll die letzte echte Session anzeigen, nicht nur die aktive Einstellung.

![Brain Coach Sessions und Aktivitätsberichte.](../current/screenshots-from-english/screenshot-12.png)
*Brain Coach Sessions und Aktivitätsberichte.*

## 14. Medikation und Adhärenz
Medication zeigt Medikationssignale und führt zur wöchentlichen Adhärenz pro Client. Medikamente stehen in Zeilen, Wochentage in Spalten.
Der Medikationsdialog umfasst Name, Dosierung, Zweck, Zeiten, Frequenz und ob Erinnerungen aktiv sind.
Vergangene Dosen ohne Eintrag werden als Unconfirmed angezeigt; künftige geplante Dosen bleiben Upcoming.

![Wöchentlicher Medikationskalender mit Status pro Dosis.](../current/screenshots-from-english/screenshot-13.png)
*Wöchentlicher Medikationskalender mit Status pro Dosis.*

## 15. Risk
Risk priorisiert operative Arbeit. Die Karten Urgent, Review, No response, Medication und Unassigned müssen erklärbar sein.
Jede Karte sollte eine Hilfe anzeigen, die beschreibt, wie die Zahl berechnet wird. Die Queue aktualisiert sich aus realen Signalen: verpasste Check-ins, unbestätigte Medikation, fehlende Abdeckung, Eskalationen und aktuelle Ereignisse.

![Risk Queue mit erklärbaren Kennzahlen.](../current/screenshots-from-english/screenshot-14.png)
*Risk Queue mit erklärbaren Kennzahlen.*

## 16. Sensors
Sensors ersetzt die alte Bezeichnung Alerts. Bis der Sensor-Backend-Anschluss fertig ist, zeigt die Seite einen klaren leeren Zustand.
Die Konsole darf keine Sensordaten erfinden. Später können Geräte, Batterie, Verbindung, Alerts und Events ergänzt werden.

## 17. VYVA Call Campaigns
Campaigns ist ein Anruf-first-Arbeitsbereich für VYVA-Kampagnen. Der Ablauf ist: Vorlage wählen, Zielgruppe definieren, Skript schreiben oder generieren, Empfänger prüfen und speichern, planen oder in die Queue stellen.
Vorlagen sind General announcement, Heatwave alert, Vaccination reminder, Scam safety alert, Service update und Create your own.
AI assist kann aus wenigen Worten ein erstes Skript erzeugen. Das Skript bleibt immer editierbar und wird nicht ohne Admin-Bestätigung in die Queue gestellt.

![VYVA Call Campaigns mit Vorlagen und Status.](../current/screenshots-from-english/screenshot-15.png)
*VYVA Call Campaigns mit Vorlagen und Status.*

## 18. Intelligente Kampagnen-Zielgruppen
Das Targeting ist regelbasiert. Admins können geografisch, nach Risiko, Gesundheitsbedingung, Versorgungslücke oder zugewiesenem Personal filtern.
Telefonnummer und Zustimmung sind Pflicht-Schutzregeln für VYVA-Anrufkampagnen. Die Vorschau zeigt berechtigte und übersprungene Clients mit Gründen.
- Where: Organisation, Land, Stadt oder benannter Bereich.
- Who: Risiko-Level und Gesundheitsbedingungen.
- Support coverage: alle, unassigned oder einem Provider zugewiesen.
- Safeguards: Zustimmung und Telefonnummer bleiben standardmäßig erforderlich.

![Regelbasierte Zielgruppenauswahl für Kampagnen.](../current/screenshots-from-english/screenshot-16.png)
*Regelbasierte Zielgruppenauswahl für Kampagnen.*

## 19. Team access
Team access erstellt interne Konsolenkonten für Admins, Koordinatoren und Operatoren. Es erstellt keine Clients.
Superadmin-Berechtigungen werden nicht über diese Seite vergeben. Superadmins bleiben backendverwaltet.

![Team access für interne Konsolenkonten.](../current/screenshots-from-english/screenshot-17.png)
*Team access für interne Konsolenkonten.*

## 20. Einstellungen und Sprache
Settings zeigt aktive Organisation, Standardland, Standardsprache und Zeitzone. Admins können Organisationswerte pflegen, sofern sie die Berechtigung haben.
Die Konsolensprache kann Englisch, Deutsch oder Spanisch sein. Neue Care Profiles übernehmen zunächst die Organisationssprache, können aber angepasst werden.

![Organisation, Sprache und Zeitzone in Settings.](../current/screenshots-from-english/screenshot-18.png)
*Organisation, Sprache und Zeitzone in Settings.*

## 21. Reports
Reports fasst operative Kennzahlen nach Organisation zusammen. Zahlen müssen sich beim Organisationswechsel ändern und dürfen nicht aus einer anderen Organisation gecacht werden.
Reports helfen bei Review, Follow-up, Kampagnenstatus, Brain Coach Verlauf und Versorgungslücken.

![Reports für operative Kennzahlen.](../current/screenshots-from-english/screenshot-19.png)
*Reports für operative Kennzahlen.*

## 22. Client-Aktivität
Die Activity timeline zeigt echte Ereignisse: Onboarding, letzte Check-up-Anrufe, letzte Brain Coach Session, Medikationsaktionen, Care coverage Änderungen und Zustimmung.
Einstellungen wie 'Brain Coach active' oder 'Medication plan has items' sind weniger hilfreich als die letzte reale Aktion. Die Timeline soll deshalb Ereignisse statt bloßer Konfigurationen priorisieren.

![Activity timeline mit echten Client-Ereignissen.](../current/screenshots-from-english/screenshot-20.png)
*Activity timeline mit echten Client-Ereignissen.*

## 23. Datenschutz und minimale Daten
Die Konsole sollte nur Daten erfassen, die für Betreuung und Koordination erforderlich sind. Vermeiden Sie vollständige medizinische Historien, Versicherungsdaten oder unnötige Diagnosedetails.
Toasts, Logs und Fehlermeldungen dürfen keine Namen, Telefonnummern, Diagnosen, Medikamente oder Freitexte mit sensiblen Angaben enthalten.

## 24. Externe Gateways und Integrationen
Einige Aktionen benötigen externe Gateways: ausgehende Telefonie, WhatsApp, VYVA Voice Connector und zukünftige Sensoren.
Solange ein Gateway nicht verbunden ist, muss die UI das klar sagen und darf keine erfolgreiche Aktion vortäuschen.

## 25. Fehlerbehebung
Wenn der Magic Link nicht ankommt, prüfen Sie Provider-Credits, verifizierte Domain und Absenderkonfiguration.
Wenn eine Seite leer bleibt, sollte die Seite einen Fehlerzustand anzeigen. Prüfen Sie die letzte Veröffentlichung und laden Sie die Seite neu.
Wenn Daten beim Organisationswechsel gleich bleiben, prüfen Sie, ob der Endpoint die aktive Organisation erhält und ob Query-Caches organisationsspezifisch invalidiert werden.
