# Datalekprotocol Buuur Platform

**CrowdBuilding B.V.**
Laatst bijgewerkt: 9 juni 2026

---

## 1. Doel

Dit protocol beschrijft de procedure die CrowdBuilding volgt bij het ontdekken, beoordelen, beheersen en melden van datalekken (inbreuken in verband met persoonsgegevens). Het protocol is gebaseerd op de vereisten van de AVG (artikelen 33 en 34) en de richtlijnen van de Autoriteit Persoonsgegevens.

---

## 2. Definities

- **Datalek**: een inbreuk op de beveiliging die per ongeluk of op onrechtmatige wijze leidt tot de vernietiging, het verlies, de wijziging of de ongeoorloofde verstrekking van, of de ongeoorloofde toegang tot, doorgezonden, opgeslagen of anderszins verwerkte persoonsgegevens (Art. 4 lid 12 AVG).
- **Incidentcoördinator**: de persoon binnen CrowdBuilding die verantwoordelijk is voor de afhandeling van datalekken. Op dit moment: Tjeerd Haccou, oprichter/directeur.

---

## 3. Stap 1: Detectie en melding intern

### Hoe wordt een datalek ontdekt?
- Meldingen van medewerkers
- Alerts van monitoringsystemen (Sentry, Supabase logs)
- Meldingen van gebruikers of organisaties
- Meldingen van sub-verwerkers (Supabase, Vercel, Sentry)
- Eigen waarneming (ongebruikelijke activiteit)

### Actie
Iedere medewerker die een (vermoedelijk) datalek constateert, meldt dit **onmiddellijk** aan de incidentcoördinator via:
- E-mail: privacy@crowdbuilding.com
- Of telefonisch: 06-46113735

De melding bevat minimaal:
- Datum en tijdstip van ontdekking
- Beschrijving van wat er is gebeurd
- Welke gegevens mogelijk zijn getroffen
- Hoe het lek is ontdekt

---

## 4. Stap 2: Beoordeling

De incidentcoördinator beoordeelt het incident binnen **4 uur** na melding:

### Classificatie

| Niveau | Beschrijving | Voorbeeld |
|--------|-------------|-----------|
| **Hoog** | Gevoelige persoonsgegevens van meerdere betrokkenen gelekt/gecompromitteerd | Database-inbreuk, ongeautoriseerde toegang tot ledendata |
| **Midden** | Beperkte persoonsgegevens van enkele betrokkenen gelekt | E-mail naar verkeerde ontvanger, zichtbare persoonsgegevens door RLS-fout |
| **Laag** | Minimale impact, geen gevoelige gegevens, snel hersteld | Kortstondige zichtbaarheid van niet-gevoelige gegevens |

### Beoordelingsvragen
1. Welke persoonsgegevens zijn betrokken?
2. Hoeveel betrokkenen zijn getroffen?
3. Is het lek nog gaande of al gestopt?
4. Wat zijn de mogelijke gevolgen voor betrokkenen?
5. Welke organisatie(s) zijn betrokken?

---

## 5. Stap 3: Beheersing

### Onmiddellijke maatregelen (binnen 1 uur na beoordeling)
- Lek dichten (patch, configuratiewijziging, toegang intrekken)
- Getroffen accounts of systemen isoleren indien nodig
- Bewijsmateriaal veiligstellen (logs, screenshots)

### Herstelmaatregelen
- Wachtwoord-resets forceren indien credentials gecompromitteerd
- RLS-policies controleren en corrigeren
- Sessies invalideren indien nodig
- Back-ups raadplegen voor gegevensherstel

---

## 6. Stap 4: Melding aan organisatie (verwerkingsverantwoordelijke)

### Wanneer?
**Zonder onredelijke vertraging en waar mogelijk binnen 24 uur** na ontdekking van het datalek, conform de verwerkersovereenkomst.

### Aan wie?
De contactpersoon van de betrokken organisatie(s), zoals vastgelegd in de dienstverleningsovereenkomst.

### Inhoud melding
De melding bevat minimaal (Art. 33 lid 3 AVG):
1. De aard van het datalek, inclusief (indien mogelijk):
   - Categorieën en geschat aantal betrokkenen
   - Categorieën en geschat aantal persoonsgegevensrecords
2. Naam en contactgegevens van de incidentcoördinator
3. Waarschijnlijke gevolgen van het datalek
4. Genomen en voorgestelde maatregelen om het lek te verhelpen en gevolgen te beperken

### Template meldingsmail

```
Onderwerp: Melding datalek Buuur Platform - [datum]

Geachte [naam contactpersoon],

Wij informeren u over een beveiligingsincident dat betrekking heeft op
persoonsgegevens die via het Buuur Platform worden verwerkt.

BESCHRIJVING INCIDENT
- Datum ontdekking: [datum/tijd]
- Aard van het incident: [beschrijving]
- Status: [lopend / opgelost]

BETROKKEN GEGEVENS
- Type gegevens: [categorieën]
- Geschat aantal betrokkenen: [aantal]

GEVOLGEN
- [beschrijving mogelijke gevolgen]

GENOMEN MAATREGELEN
- [lijst maatregelen]

AANBEVOLEN VERVOLGSTAPPEN
- [advies aan de organisatie, bijv. melding bij AP, informeren betrokkenen]

Voor vragen kunt u contact opnemen met:
[naam], [e-mail], [telefoon]

Met vriendelijke groet,
CrowdBuilding B.V.
```

---

## 7. Stap 5: Melding aan AP (indien CrowdBuilding verwerkingsverantwoordelijke is)

Voor verwerkingen waarvoor CrowdBuilding zelf verwerkingsverantwoordelijke is (eigen klantdata, facturatie):

### Wanneer melden bij de AP?
Binnen **72 uur** na ontdekking, tenzij het niet waarschijnlijk is dat het datalek een risico inhoudt voor de rechten en vrijheden van betrokkenen.

### Hoe?
Via het meldformulier van de Autoriteit Persoonsgegevens: https://datalekken.autoriteitpersoonsgegevens.nl

### Wanneer NIET melden?
Als het datalek waarschijnlijk geen risico oplevert, bijvoorbeeld:
- Gegevens waren versleuteld en de sleutel is niet gecompromitteerd
- Onmiddellijk hersteld zonder dat derden toegang hebben gehad
- Alleen niet-gevoelige gegevens van zeer beperkt aantal betrokkenen

**Bij twijfel: altijd melden.**

---

## 8. Stap 6: Informeren betrokkenen

### Wanneer?
Wanneer het datalek waarschijnlijk een **hoog risico** inhoudt voor de rechten en vrijheden van betrokkenen (Art. 34 AVG).

### Door wie?
- Voor ledendata: door de **organisatie** (verwerkingsverantwoordelijke), met ondersteuning van CrowdBuilding
- Voor platformdata: door **CrowdBuilding** zelf

### Hoe?
- Via e-mail aan de betrokken personen
- Via een melding in het Platform (indien mogelijk)
- In begrijpelijke taal, met concrete adviezen

---

## 9. Stap 7: Registratie en evaluatie

### Datalekregister
Elk datalek wordt geregistreerd in het datalekregister (Art. 33 lid 5 AVG), met:
- Datum en tijdstip van ontdekking
- Beschrijving van het incident
- Categorieën betrokkenen en gegevens
- Geschat aantal betrokkenen
- Gevolgen
- Genomen maatregelen
- Datum en wijze van melding aan organisatie
- Datum en wijze van melding aan AP (indien van toepassing)
- Datum en wijze van informeren betrokkenen (indien van toepassing)

### Evaluatie
Na afhandeling van elk datalek:
1. Root cause analysis: wat ging er mis?
2. Was de respons adequaat en tijdig?
3. Welke structurele maatregelen zijn nodig om herhaling te voorkomen?
4. Moeten beveiligingsmaatregelen worden aangepast?
5. Moet het datalekprotocol worden bijgewerkt?

---

## 10. Verantwoordelijkheden

| Rol | Verantwoordelijkheid |
|-----|---------------------|
| **Incidentcoördinator** | Coördinatie afhandeling, communicatie, registratie |
| **Ontwikkelaar(s)** | Technische analyse, beheersing, herstel |
| **Directie** | Besluitvorming over melding aan AP, communicatie naar organisaties |

---

## 11. Contactgegevens

- **Incidentcoördinator**: Tjeerd Haccou, privacy@crowdbuilding.com, 06-46113735
- **Autoriteit Persoonsgegevens**: https://autoriteitpersoonsgegevens.nl, 0900-3282535
- **Meldformulier AP**: https://datalekken.autoriteitpersoonsgegevens.nl

---

## 12. Revisiegeschiedenis

| Datum | Versie | Wijziging |
|-------|--------|-----------|
| 9 juni 2026 | 1.0 | Initiële versie |
