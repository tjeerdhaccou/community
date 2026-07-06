import LegalDocumentPage from './LegalDocumentPage'

export default function Verwerkingsregister() {
  const s = { marginBottom: 24 }
  const tbl = { width: '100%', borderCollapse: 'collapse', fontSize: 14, marginBottom: 12 }
  const th = { textAlign: 'left', padding: '6px 8px 6px 0', borderBottom: '1px solid var(--border-default)', fontWeight: 600 }
  const td = { padding: '6px 8px 6px 0', borderBottom: '1px solid var(--border-default)', verticalAlign: 'top' }
  const td2 = { padding: '6px 8px', borderBottom: '1px solid var(--border-default)', verticalAlign: 'top' }

  return (
    <LegalDocumentPage title="Verwerkingsregister" updatedDate="9 juni 2026">
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
        Op grond van artikel 30 AVG — CrowdBuilding B.V., KvK 81149301, Asterweg 20C-2, 1031 HN Amsterdam
      </p>

      {/* Deel A */}
      <section style={s}>
        <h2>Deel A: Als verwerkingsverantwoordelijke</h2>

        <h3>A1. Klantrelatiebeheer</h3>
        <table style={tbl}>
          <tbody>
            <tr><td style={td}><strong>Doel</strong></td><td style={td2}>Beheer van klantrelaties met organisaties</td></tr>
            <tr><td style={td}><strong>Grondslag</strong></td><td style={td2}>Uitvoering overeenkomst (Art. 6-1b)</td></tr>
            <tr><td style={td}><strong>Betrokkenen</strong></td><td style={td2}>Contactpersonen van organisaties</td></tr>
            <tr><td style={td}><strong>Gegevens</strong></td><td style={td2}>Naam, e-mail, telefoon, functie, organisatie</td></tr>
            <tr><td style={td}><strong>Bewaartermijn</strong></td><td style={td2}>Duur klantrelatie + 2 jaar</td></tr>
            <tr><td style={td}><strong>Doorgifte buiten EU</strong></td><td style={td2}>Nee</td></tr>
          </tbody>
        </table>

        <h3>A2. Facturatie en boekhouding</h3>
        <table style={tbl}>
          <tbody>
            <tr><td style={td}><strong>Doel</strong></td><td style={td2}>Facturatie en wettelijke boekhoudverplichting</td></tr>
            <tr><td style={td}><strong>Grondslag</strong></td><td style={td2}>Wettelijke verplichting (Art. 6-1c)</td></tr>
            <tr><td style={td}><strong>Betrokkenen</strong></td><td style={td2}>Contactpersonen en tekenbevoegden</td></tr>
            <tr><td style={td}><strong>Gegevens</strong></td><td style={td2}>Naam, bedrijfsnaam, adres, KvK, btw, factuurbedragen</td></tr>
            <tr><td style={td}><strong>Bewaartermijn</strong></td><td style={td2}>7 jaar (fiscale bewaarplicht)</td></tr>
            <tr><td style={td}><strong>Doorgifte buiten EU</strong></td><td style={td2}>Nee</td></tr>
          </tbody>
        </table>

        <h3>A3. Platformbeveiliging en foutmonitoring</h3>
        <table style={tbl}>
          <tbody>
            <tr><td style={td}><strong>Doel</strong></td><td style={td2}>Veiligheid en beschikbaarheid van het Platform</td></tr>
            <tr><td style={td}><strong>Grondslag</strong></td><td style={td2}>Gerechtvaardigd belang (Art. 6-1f)</td></tr>
            <tr><td style={td}><strong>Betrokkenen</strong></td><td style={td2}>Alle platformgebruikers</td></tr>
            <tr><td style={td}><strong>Gegevens</strong></td><td style={td2}>IP-adres, browsertype, foutmeldingen (geminimaliseerd)</td></tr>
            <tr><td style={td}><strong>Bewaartermijn</strong></td><td style={td2}>90 dagen (Sentry), 6 maanden (auth logs)</td></tr>
            <tr><td style={td}><strong>Doorgifte buiten EU</strong></td><td style={td2}>Ja (Sentry, VS) — SCC's</td></tr>
          </tbody>
        </table>
      </section>

      {/* Deel B */}
      <section style={s}>
        <h2>Deel B: Als verwerker (per organisatie)</h2>

        <h3>B1. Ledenregistratie en profielbeheer</h3>
        <table style={tbl}>
          <tbody>
            <tr><td style={td}><strong>Betrokkenen</strong></td><td style={td2}>Leden, aspirant-leden, geïnteresseerden, professionals</td></tr>
            <tr><td style={td}><strong>Gegevens</strong></td><td style={td2}>Naam, e-mail, telefoon, adres, foto, bio, woonvoorkeuren</td></tr>
            <tr><td style={td}><strong>Doorgifte buiten EU</strong></td><td style={td2}>Ja (Vercel hosting, Google OAuth) — SCC's</td></tr>
          </tbody>
        </table>

        <h3>B2. Community-communicatie</h3>
        <table style={tbl}>
          <tbody>
            <tr><td style={td}><strong>Betrokkenen</strong></td><td style={td2}>Leden met account</td></tr>
            <tr><td style={td}><strong>Gegevens</strong></td><td style={td2}>Berichten, reacties, updates, foto's</td></tr>
            <tr><td style={td}><strong>Doorgifte buiten EU</strong></td><td style={td2}>Nee (Supabase EU)</td></tr>
          </tbody>
        </table>

        <h3>B3. Evenementenbeheer</h3>
        <table style={tbl}>
          <tbody>
            <tr><td style={td}><strong>Betrokkenen</strong></td><td style={td2}>Leden met account</td></tr>
            <tr><td style={td}><strong>Gegevens</strong></td><td style={td2}>Aanmeldingen, aanwezigheid</td></tr>
            <tr><td style={td}><strong>Doorgifte buiten EU</strong></td><td style={td2}>Nee</td></tr>
          </tbody>
        </table>

        <h3>B4. Documentbeheer</h3>
        <table style={tbl}>
          <tbody>
            <tr><td style={td}><strong>Betrokkenen</strong></td><td style={td2}>Leden met account</td></tr>
            <tr><td style={td}><strong>Gegevens</strong></td><td style={td2}>Documenten, bestanden, uploadgegevens</td></tr>
            <tr><td style={td}><strong>Doorgifte buiten EU</strong></td><td style={td2}>Nee (Supabase Storage EU)</td></tr>
          </tbody>
        </table>

        <h3>B5. Intake en ledenwerving</h3>
        <table style={tbl}>
          <tbody>
            <tr><td style={td}><strong>Betrokkenen</strong></td><td style={td2}>Geïnteresseerden, aspirant-leden</td></tr>
            <tr><td style={td}><strong>Gegevens</strong></td><td style={td2}>Naam, e-mail, telefoon, intake-antwoorden, woonvoorkeuren</td></tr>
            <tr><td style={td}><strong>Doorgifte buiten EU</strong></td><td style={td2}>Nee</td></tr>
          </tbody>
        </table>

        <h3>B6. E-mailnotificaties</h3>
        <table style={tbl}>
          <tbody>
            <tr><td style={td}><strong>Betrokkenen</strong></td><td style={td2}>Leden met account</td></tr>
            <tr><td style={td}><strong>Gegevens</strong></td><td style={td2}>E-mailadres, voornaam, notificatietype</td></tr>
            <tr><td style={td}><strong>Doorgifte buiten EU</strong></td><td style={td2}>Afhankelijk van e-maildienst</td></tr>
          </tbody>
        </table>
      </section>

      {/* Deel C */}
      <section style={s}>
        <h2>Deel C: Sub-verwerkers</h2>
        <table style={tbl}>
          <thead>
            <tr>
              <th style={th}>Sub-verwerker</th>
              <th style={{...th, padding: '6px 8px'}}>Dienst</th>
              <th style={{...th, padding: '6px 8px'}}>Locatie</th>
              <th style={{...th, padding: '6px 8px'}}>DPA</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style={td}>Supabase Inc.</td><td style={td2}>Database, auth, storage</td><td style={td2}>Frankfurt (EU)</td><td style={td2}>Ja</td></tr>
            <tr><td style={td}>Vercel Inc.</td><td style={td2}>Hosting</td><td style={td2}>EU / VS</td><td style={td2}>Ja (SCC's)</td></tr>
            <tr><td style={td}>Google LLC</td><td style={td2}>OAuth</td><td style={td2}>VS</td><td style={td2}>Ja (SCC's)</td></tr>
            <tr><td style={td}>Sentry</td><td style={td2}>Foutmonitoring</td><td style={td2}>VS</td><td style={td2}>Ja (SCC's)</td></tr>
            <tr><td style={td}>TransIP B.V.</td><td style={td2}>DNS</td><td style={td2}>NL</td><td style={td2}>Ja</td></tr>
          </tbody>
        </table>
      </section>

      {/* Deel D */}
      <section>
        <h2>Deel D: Beveiligingsmaatregelen (Art. 32)</h2>
        <ul>
          <li>Versleuteling in rust (AES-256) en bij transport (TLS 1.2+)</li>
          <li>Row-Level Security op alle tabellen</li>
          <li>Rolgebaseerde toegangscontrole (7 niveaus)</li>
          <li>Gegevensopslag primair in EU (Supabase Frankfurt)</li>
          <li>Dagelijkse back-ups met point-in-time recovery</li>
          <li>Foutmonitoring met geminimaliseerde PII</li>
          <li>Geheimhoudingsverplichtingen medewerkers</li>
        </ul>
      </section>
    </LegalDocumentPage>
  )
}
