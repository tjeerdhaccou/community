# Data Protection Impact Assessment (DPIA)

**Buuur Community Platform**
**CrowdBuilding B.V.**
Laatst bijgewerkt: 9 juni 2026

---

## 1. Inleiding

### 1.1 Aanleiding
Deze DPIA wordt uitgevoerd conform artikel 35 AVG vanwege de grootschalige verwerking van persoonsgegevens via het Buuur community platform. Het platform verwerkt gegevens van leden van woongemeenschappen en woonprojecten, inclusief woonvoorkeuren en huishoudsamenstelling, wat als gevoelige profielinformatie kan worden beschouwd.

### 1.2 Reikwijdte
Deze DPIA betreft alle verwerkingen van persoonsgegevens via het Buuur platform, zowel in de rol van verwerker (namens organisaties) als in de rol van verwerkingsverantwoordelijke (eigen bedrijfsvoering).

### 1.3 Verantwoordelijke
- **Uitvoerder DPIA**: Tjeerd Haccou
- **Datum eerste uitvoering**: 9 juni 2026
- **Datum volgende review**: 9 juni 2027

---

## 2. Beschrijving van de verwerking

### 2.1 Wat is het Buuur platform?
Buuur is een multi-tenant SaaS community platform voor woonprojecten. Organisaties (woningcorporaties, projectontwikkelaars, wooncooperaties) gebruiken het platform om:
- Leden te werven via intake-formulieren
- Een online community te beheren (berichten, updates, documenten)
- Evenementen te organiseren
- Het bouwproces te communiceren (roadmap, faseringen)

### 2.2 Welke persoonsgegevens worden verwerkt?

| Categorie | Gegevens | Bijzonder? |
|-----------|----------|-----------|
| Identificatie | Naam, e-mail, profielfoto | Nee |
| Contact | Telefoonnummer, adres | Nee |
| Profiel | Bio, woonvoorkeuren, huishoudgrootte | Nee* |
| Lidmaatschap | Projecten, rollen, intake-antwoorden | Nee |
| Communicatie | Berichten, reacties, uploads | Nee |
| Evenementen | Aanmeldingen, aanwezigheid | Nee |
| Technisch | IP-adres, browsertype, foutlogs | Nee |

*Woonvoorkeuren en huishoudsamenstelling zijn geen bijzondere categorieën in de zin van Art. 9 AVG, maar kunnen wel gevoelig zijn (financiële positie, gezinssamenstelling).

### 2.3 Categorieën betrokkenen
- **Leden**: actieve deelnemers aan een woonproject (honderden per project)
- **Aspirant-leden**: personen in het intake-traject
- **Geïnteresseerden**: personen die een intake-formulier invullen
- **Professionals**: adviseurs en externe betrokkenen
- **Organisatiemedewerkers**: admins en moderators

### 2.4 Verwerkingsgronden

| Verwerking | Grondslag |
|------------|-----------|
| Accountbeheer en authenticatie | Overeenkomst (Art. 6-1b) |
| Community-functies | Overeenkomst (Art. 6-1b) |
| Google OAuth | Toestemming (Art. 6-1a) |
| Profielfoto | Toestemming (Art. 6-1a) |
| Foutmonitoring | Gerechtvaardigd belang (Art. 6-1f) |
| E-mailnotificaties | Gerechtvaardigd belang (Art. 6-1f) |
| Facturatie | Wettelijke verplichting (Art. 6-1c) |

### 2.5 Datastromen

```
Gebruiker (browser)
    │
    ├── HTTPS/TLS ──→ Vercel (hosting, EU/VS)
    │                    │
    │                    ├──→ Supabase (database, Frankfurt EU)
    │                    │      ├── Auth (sessies, tokens)
    │                    │      ├── Database (alle ledendata)
    │                    │      └── Storage (bestanden, foto's)
    │                    │
    │                    ├──→ Sentry (foutmonitoring, VS)
    │                    │
    │                    └──→ TransIP (DNS, NL)
    │
    └── Google OAuth ──→ Google (authenticatie, VS)
```

---

## 3. Noodzaak en proportionaliteit

### 3.1 Is de verwerking noodzakelijk?
**Ja.** De verwerkte gegevens zijn noodzakelijk voor:
- **Identificatiegegevens**: nodig voor authenticatie en herkenning binnen de community
- **Contactgegevens**: nodig voor communicatie over het woonproject
- **Woonvoorkeuren/intake**: nodig voor de matchmaking en selectie door de organisatie
- **Community-content**: de kernfunctie van het platform

### 3.2 Is de verwerking proportioneel?
**Ja.** Maatregelen voor dataminimalisatie:
- Telefoonnummer en adres zijn optioneel
- Profielfoto is optioneel
- Woonvoorkeuren worden alleen gevraagd in de intake (door de organisatie)
- Technische logs worden geminimaliseerd (90 dagen Sentry, 6 maanden auth logs)
- Gebruikers kunnen hun account verwijderen

### 3.3 Alternatieven overwogen

| Alternatief | Overwogen? | Besluit |
|-------------|-----------|---------|
| Geen profielfoto | Ja | Optioneel gemaakt — gebruiker kiest zelf |
| Pseudonimisering van berichten | Ja | Niet passend — community vereist herkenning |
| Lokale opslag i.p.v. cloud | Ja | Niet haalbaar — multi-device toegang vereist |
| EU-only hosting | Ja | Database (Supabase) al in EU; hosting en monitoring hebben VS-component met SCC's |

---

## 4. Risicobeoordeling

### 4.1 Geïdentificeerde risico's

| # | Risico | Kans | Impact | Score | Maatregel |
|---|--------|------|--------|-------|-----------|
| R1 | Ongeautoriseerde toegang tot ledendata door RLS-fout | Laag | Hoog | Midden | RLS-policies per tabel, rolhiërarchie, testen bij wijzigingen |
| R2 | Datalek door kwetsbaarheid in sub-verwerker (Supabase/Vercel) | Laag | Hoog | Midden | DPA's met sub-verwerkers, monitoring van security advisories |
| R3 | Ongeoorloofde toegang door gestolen sessietokens | Midden | Midden | Midden | Sessie-expiratie, HTTPS-only cookies, token-rotatie |
| R4 | Bulk data-exfiltratrie door admin-account compromittering | Laag | Hoog | Midden | Rolgebaseerde toegang, audit logging, beperkte admin-API |
| R5 | Onbedoelde openbaarmaking via verkeerde RLS-policy | Laag | Hoog | Midden | Principe van deny-by-default, code review bij schema-wijzigingen |
| R6 | Doorgifte naar VS zonder adequate waarborgen | Laag | Midden | Laag | SCC's met Vercel, Sentry, Google; monitoring adequaatheidsbesluiten |
| R7 | Verlies van data door storing bij Supabase | Laag | Hoog | Midden | Dagelijkse back-ups, point-in-time recovery |
| R8 | Organisatie gebruikt ledendata voor ongeoorloofd doel | Midden | Midden | Midden | Verwerkersovereenkomst, duidelijke doelbinding |
| R9 | Betrokkenen kunnen rechten niet uitoefenen | Laag | Midden | Laag | Self-service profiel/verwijdering, exportfunctie, contactgegevens in privacyverklaring |
| R10 | Persoonsgegevens in foutlogs (Sentry) | Midden | Laag | Laag | Data scrubbing configuratie, minimale PII in logs |

### 4.2 Risicomatrix

```
Impact ↑
  Hoog    │  R6     │ R1,R2,R4,R5,R7 │         │
  Midden  │         │  R3,R8          │         │
  Laag    │  R9     │  R10            │         │
          └─────────┴─────────────────┴─────────┘
            Laag      Midden            Hoog    → Kans
```

---

## 5. Maatregelen

### 5.1 Technische maatregelen (reeds geïmplementeerd)

| Maatregel | Beschrijving | Adresseert risico |
|-----------|-------------|-------------------|
| Row-Level Security | Elke query gefilterd op gebruiker/project/rol | R1, R5 |
| HTTPS/TLS | Alle communicatie versleuteld | R3 |
| Rolhiërarchie | 7 niveaus (interested → admin) met permission checks | R1, R4 |
| Supabase Auth | JWT-tokens, sessie-expiratie, OAuth 2.0 | R3 |
| Bestandsvalidatie | Type-controle en groottebeperking bij upload | R1 |
| EU-opslag | Database en storage in Frankfurt | R6 |
| Back-ups | Dagelijks, point-in-time recovery | R7 |

### 5.2 Organisatorische maatregelen (reeds geïmplementeerd)

| Maatregel | Beschrijving | Adresseert risico |
|-----------|-------------|-------------------|
| Verwerkersovereenkomsten | Met alle sub-verwerkers | R2, R6 |
| Geheimhouding | Medewerkers gebonden aan geheimhouding | R4 |
| Datalekprotocol | Procedure voor detectie, beoordeling, melding | R1-R10 |
| Privacyverklaring | Transparantie naar betrokkenen | R9 |

### 5.3 Aanvullende maatregelen (nog te implementeren)

| Maatregel | Prioriteit | Deadline | Adresseert risico |
|-----------|-----------|----------|-------------------|
| Data-exportfunctie per organisatie | Hoog | Q3 2026 | R9 |
| Individuele data-export per lid | Hoog | Q3 2026 | R9 |
| Account-verwijderfunctie (self-service) | Hoog | Q3 2026 | R9 |
| Sentry data scrubbing review | Midden | Q3 2026 | R10 |
| Periodieke RLS-audit | Midden | Doorlopend (per kwartaal) | R1, R5 |
| Security headers review | Laag | Q4 2026 | R3 |

---

## 6. Conclusie

### 6.1 Restrisico
Na implementatie van alle genoemde maatregelen wordt het restrisico als **acceptabel** beoordeeld. Er zijn geen verwerkingen geïdentificeerd die een hoog restrisico opleveren dat voorafgaande raadpleging van de Autoriteit Persoonsgegevens vereist (Art. 36 AVG).

### 6.2 Voorwaarden
Dit oordeel is geldig mits:
- Alle aanvullende maatregelen worden geïmplementeerd binnen de gestelde deadlines
- Sub-verwerkers hun DPA-verplichtingen nakomen
- Het verwerkingsregister actueel wordt gehouden
- Deze DPIA jaarlijks wordt gereviewd

---

## 7. Goedkeuring

| | |
|---|---|
| **Opgesteld door** | Tjeerd Haccou |
| **Datum** | 9 juni 2026 |
| **Goedgekeurd door** | Tjeerd Haccou |
| **Datum goedkeuring** | 9 juni 2026 |
| **Volgende review** | 9 juni 2027 |

---

## 8. Revisiegeschiedenis

| Datum | Versie | Wijziging |
|-------|--------|-----------|
| 9 juni 2026 | 1.0 | Initiële DPIA |
