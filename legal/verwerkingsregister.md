# Verwerkingsregister CrowdBuilding B.V.

**Op grond van artikel 30 AVG**
Laatst bijgewerkt: 9 juni 2026

---

## Gegevens organisatie

| | |
|---|---|
| **Naam** | CrowdBuilding B.V. |
| **KvK-nummer** | 81149301 |
| **Adres** | Asterweg 20C-2, 1031 HN Amsterdam |
| **Contactpersoon privacy** | Tjeerd Haccou |
| **E-mail** | privacy@crowdbuilding.com |

---

## Deel A: Verwerkingen als verwerkingsverantwoordelijke (Art. 30 lid 1)

### A1. Klantrelatiebeheer

| | |
|---|---|
| **Doel** | Beheer van klantrelaties met organisaties die het Platform gebruiken |
| **Grondslag** | Uitvoering overeenkomst (Art. 6-1b) |
| **Categorieën betrokkenen** | Contactpersonen van organisaties |
| **Categorieën gegevens** | Naam, e-mail, telefoonnummer, functie, organisatie |
| **Ontvangers** | Intern (directie, sales) |
| **Bewaartermijn** | Duur van de klantrelatie + 2 jaar |
| **Doorgifte buiten EU** | Nee |
| **Beveiligingsmaatregelen** | Toegangsbeperking, versleuteling |

### A2. Facturatie en boekhouding

| | |
|---|---|
| **Doel** | Facturatie aan organisaties en wettelijke boekhoudverplichting |
| **Grondslag** | Wettelijke verplichting (Art. 6-1c) |
| **Categorieën betrokkenen** | Contactpersonen en tekenbevoegden van organisaties |
| **Categorieën gegevens** | Naam, bedrijfsnaam, adres, KvK-nummer, btw-nummer, factuurbedragen |
| **Ontvangers** | Boekhouder/accountant, Belastingdienst (indien gevorderd) |
| **Bewaartermijn** | 7 jaar (fiscale bewaarplicht) |
| **Doorgifte buiten EU** | Nee |
| **Beveiligingsmaatregelen** | Toegangsbeperking, beveiligde opslag |

### A3. Platformbeveiliging en foutmonitoring

| | |
|---|---|
| **Doel** | Waarborgen van de veiligheid en beschikbaarheid van het Platform |
| **Grondslag** | Gerechtvaardigd belang (Art. 6-1f) |
| **Categorieën betrokkenen** | Alle platformgebruikers |
| **Categorieën gegevens** | IP-adres, browsertype, foutmeldingen, stack traces (geminimaliseerd) |
| **Ontvangers** | Sentry (sub-verwerker, foutmonitoring) |
| **Bewaartermijn** | 90 dagen (Sentry), 6 maanden (auth logs) |
| **Doorgifte buiten EU** | Ja (Sentry, VS) — SCC's van toepassing |
| **Beveiligingsmaatregelen** | Minimalisatie PII in logs, versleuteling, SCC's |

### A4. Website en communicatie

| | |
|---|---|
| **Doel** | Communicatie met potentiële klanten en geïnteresseerden |
| **Grondslag** | Gerechtvaardigd belang (Art. 6-1f) / Toestemming (Art. 6-1a) |
| **Categorieën betrokkenen** | Websitebezoekers, contactformulier-invullers |
| **Categorieën gegevens** | Naam, e-mail, bericht |
| **Ontvangers** | Intern |
| **Bewaartermijn** | 12 maanden na laatste contact |
| **Doorgifte buiten EU** | Nee |
| **Beveiligingsmaatregelen** | Versleuteling, toegangsbeperking |

---

## Deel B: Verwerkingen als verwerker (Art. 30 lid 2)

### B1. Community platform (Buuur) — per organisatie

| | |
|---|---|
| **Naam verwerkingsverantwoordelijke** | Zie klantenlijst (per organisatie) |
| **Contactgegevens verwerkingsverantwoordelijke** | Zie klantadministratie |
| **Categorieën verwerkingen** | |

#### B1.1 Ledenregistratie en profielbeheer

| | |
|---|---|
| **Categorieën betrokkenen** | Leden, aspirant-leden, geïnteresseerden, professionals |
| **Categorieën gegevens** | Naam, e-mail, telefoon, adres, profielfoto, bio, woonvoorkeuren |
| **Doorgifte buiten EU** | Ja (Vercel hosting VS, Google OAuth VS) — SCC's |
| **Beveiligingsmaatregelen** | RLS, rolgebaseerde toegang, versleuteling |

#### B1.2 Community-communicatie

| | |
|---|---|
| **Categorieën betrokkenen** | Leden met account |
| **Categorieën gegevens** | Berichten, reacties, updates, foto's |
| **Doorgifte buiten EU** | Nee (opslag Supabase EU) |
| **Beveiligingsmaatregelen** | RLS, toegangscontrole per project |

#### B1.3 Evenementenbeheer

| | |
|---|---|
| **Categorieën betrokkenen** | Leden met account |
| **Categorieën gegevens** | Evenementnaam, aanmeldingen, aanwezigheid |
| **Doorgifte buiten EU** | Nee |
| **Beveiligingsmaatregelen** | RLS, projectniveau toegangscontrole |

#### B1.4 Documentbeheer

| | |
|---|---|
| **Categorieën betrokkenen** | Leden met account |
| **Categorieën gegevens** | Documentnamen, bestanden, uploadgegevens |
| **Doorgifte buiten EU** | Nee (Supabase Storage EU) |
| **Beveiligingsmaatregelen** | RLS, bestandsvalidatie, Storage buckets per type |

#### B1.5 Intake en ledenwerving

| | |
|---|---|
| **Categorieën betrokkenen** | Geïnteresseerden, aspirant-leden |
| **Categorieën gegevens** | Naam, e-mail, telefoon, intake-antwoorden, woonvoorkeuren, huishoudgegevens |
| **Doorgifte buiten EU** | Nee |
| **Beveiligingsmaatregelen** | RLS, alleen zichtbaar voor admins/moderators |

#### B1.6 E-mailnotificaties

| | |
|---|---|
| **Categorieën betrokkenen** | Leden met account |
| **Categorieën gegevens** | E-mailadres, voornaam, notificatietype |
| **Doorgifte buiten EU** | Afhankelijk van e-maildienst |
| **Beveiligingsmaatregelen** | Uitschrijfmogelijkheid, minimale gegevens |

---

## Deel C: Overzicht sub-verwerkers

| Sub-verwerker | Dienst | Locatie | DPA | Waarborg doorgifte |
|---------------|--------|---------|-----|-------------------|
| Supabase Inc. | Database, auth, storage | Frankfurt, DE | Ja | N.v.t. (EU) |
| Vercel Inc. | Hosting | EU / VS | Ja | SCC's + DPF |
| Google LLC | OAuth | VS | Ja | SCC's + DPF |
| Functional Software (Sentry) | Foutmonitoring | VS | Ja | SCC's |
| TransIP B.V. | DNS | NL | Ja | N.v.t. (EU) |

---

## Deel D: Technische en organisatorische beveiligingsmaatregelen (Art. 32 AVG)

Zie Bijlage A van de Verwerkersovereenkomst voor een gedetailleerd overzicht.

Samenvatting:
- Versleuteling in rust en bij transport
- Row-Level Security op alle tabellen
- Rolgebaseerde toegangscontrole (7 niveaus)
- Gegevensopslag primair in EU
- Dagelijkse back-ups met point-in-time recovery
- Foutmonitoring met geminimaliseerde PII
- Geheimhoudingsverplichtingen medewerkers

---

## Revisiegeschiedenis

| Datum | Versie | Wijziging |
|-------|--------|-----------|
| 9 juni 2026 | 1.0 | Initiële versie |

---

## Klantenlijst (Deel B — verwerkingsverantwoordelijken)

| Organisatie | Contactpersoon | E-mail | Verwerkersovereenkomst getekend |
|-------------|---------------|--------|-------------------------------|
| Common City Development | [naam] | [e-mail] | [ ] |
| | | | |

*Deze lijst wordt bijgewerkt bij elke nieuwe organisatie die het Platform gaat gebruiken.*
