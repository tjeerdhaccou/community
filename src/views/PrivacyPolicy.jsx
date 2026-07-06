export default function PrivacyPolicy() {
  const sectionStyle = { marginBottom: 28 }
  const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: 15 }
  const thStyle = { textAlign: 'left', padding: '8px 8px 8px 0', borderBottom: '1px solid var(--border-default)' }
  const tdStyle = { padding: '8px 8px 8px 0', borderBottom: '1px solid var(--border-default)', verticalAlign: 'top' }
  const td2Style = { padding: 8, borderBottom: '1px solid var(--border-default)', verticalAlign: 'top' }

  return (
    <div className="login-page" style={{ alignItems: 'flex-start', overflow: 'auto' }}>
      <div className="cl-card cl-card--elevated legal-document" style={{ maxWidth: 720, margin: '40px auto', padding: '32px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <h1 style={{ margin: 0 }}>Privacyverklaring</h1>
          <button
            className="cl-btn cl-btn--ghost hide-on-print"
            onClick={() => window.print()}
            title="Download als PDF"
            style={{ flexShrink: 0, marginLeft: 16 }}
          >
            <i className="fa-solid fa-file-pdf" /> Download PDF
          </button>
        </div>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 14, marginBottom: 24 }}>
          Laatst bijgewerkt: 9 juni 2026
        </p>

        {/* 1. Inleiding */}
        <section style={sectionStyle}>
          <h2>1. Inleiding</h2>
          <p>
            Buuur is een community platform voor woonprojecten, beheerd door{' '}
            <strong>CrowdBuilding B.V.</strong> (KvK: 81149301, hierna "CrowdBuilding", "wij" of "ons").
            Via dit platform faciliteren wij community's voor organisaties en hun leden.
          </p>
          <p>
            Deze privacyverklaring legt uit welke persoonsgegevens wij verwerken, waarom,
            op welke grondslag en welke rechten je hebt. We raden je aan deze verklaring
            zorgvuldig te lezen.
          </p>
          <p>
            Contactgegevens voor privacyvragen:<br />
            E-mail: <a href="mailto:privacy@crowdbuilding.com">privacy@crowdbuilding.com</a><br />
            Adres: Asterweg 20C-2, 1031 HN Amsterdam
          </p>
        </section>

        {/* 2. Rolverdeling */}
        <section style={sectionStyle}>
          <h2>2. Wie is verantwoordelijk voor je gegevens?</h2>
          <p>
            Buuur werkt met een <strong>verwerker/verwerkingsverantwoordelijke-model</strong>:
          </p>
          <ul>
            <li>
              <strong>De organisatie</strong> (bijv. een wooncooperatie of projectontwikkelaar) die het
              platform gebruikt, is de <em>verwerkingsverantwoordelijke</em>. Zij bepalen welke
              gegevens worden verzameld en waarvoor.
            </li>
            <li>
              <strong>CrowdBuilding</strong> is de <em>verwerker</em>. Wij verwerken persoonsgegevens
              uitsluitend in opdracht van de organisatie, op basis van een verwerkersovereenkomst.
            </li>
          </ul>
          <p>
            Voor onze eigen bedrijfsvoering (klantrelatiebeheer, facturatie, platformbeveiliging) is
            CrowdBuilding zelf verwerkingsverantwoordelijke.
          </p>
          <p>
            Heb je vragen over hoe jouw gegevens worden gebruikt binnen een specifiek project?
            Neem dan contact op met de betreffende organisatie. Voor vragen over het platform
            zelf kun je bij ons terecht.
          </p>
        </section>

        {/* 3. Welke gegevens */}
        <section style={sectionStyle}>
          <h2>3. Welke gegevens verwerken wij?</h2>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Categorie</th>
                <th style={{ ...thStyle, padding: 8 }}>Gegevens</th>
                <th style={{ ...thStyle, padding: 8 }}>Bron</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdStyle}><strong>Accountgegevens</strong></td>
                <td style={td2Style}>Naam, e-mailadres, profielfoto</td>
                <td style={td2Style}>Jijzelf (registratie of Google-account)</td>
              </tr>
              <tr>
                <td style={tdStyle}><strong>Profielgegevens</strong></td>
                <td style={td2Style}>Telefoonnummer, adres, bio, woonvoorkeuren</td>
                <td style={td2Style}>Jijzelf (optioneel ingevuld)</td>
              </tr>
              <tr>
                <td style={tdStyle}><strong>Lidmaatschappen</strong></td>
                <td style={td2Style}>Projecten, rollen, intake-antwoorden</td>
                <td style={td2Style}>Jijzelf en de organisatie</td>
              </tr>
              <tr>
                <td style={tdStyle}><strong>Inhoud</strong></td>
                <td style={td2Style}>Berichten, reacties, updates, documenten, foto's</td>
                <td style={td2Style}>Jijzelf</td>
              </tr>
              <tr>
                <td style={tdStyle}><strong>Evenementen</strong></td>
                <td style={td2Style}>Aanmeldingen, aanwezigheid</td>
                <td style={td2Style}>Jijzelf</td>
              </tr>
              <tr>
                <td style={tdStyle}><strong>Technische gegevens</strong></td>
                <td style={td2Style}>IP-adres, browsertype, foutmeldingen</td>
                <td style={td2Style}>Automatisch (beveiliging en foutopsporing)</td>
              </tr>
              <tr>
                <td style={tdStyle}><strong>Voorkeuren</strong></td>
                <td style={td2Style}>Thema-instelling, notificatievoorkeuren</td>
                <td style={td2Style}>Jijzelf (opgeslagen in browser)</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* 4. Doeleinden en grondslagen */}
        <section style={sectionStyle}>
          <h2>4. Waarvoor en op welke grondslag?</h2>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Doel</th>
                <th style={{ ...thStyle, padding: 8 }}>Grondslag (AVG)</th>
                <th style={{ ...thStyle, padding: 8 }}>Toelichting</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdStyle}>Inloggen en authenticatie</td>
                <td style={td2Style}>Uitvoering overeenkomst (Art. 6-1b)</td>
                <td style={td2Style}>Nodig om de dienst te leveren</td>
              </tr>
              <tr>
                <td style={tdStyle}>Community-functies (berichten, events, documenten)</td>
                <td style={td2Style}>Uitvoering overeenkomst (Art. 6-1b)</td>
                <td style={td2Style}>Kernfunctionaliteit van het platform</td>
              </tr>
              <tr>
                <td style={tdStyle}>Intake en ledenwerving</td>
                <td style={td2Style}>Uitvoering overeenkomst (Art. 6-1b)</td>
                <td style={td2Style}>Op verzoek van de organisatie</td>
              </tr>
              <tr>
                <td style={tdStyle}>Google OAuth inlog</td>
                <td style={td2Style}>Toestemming (Art. 6-1a)</td>
                <td style={td2Style}>Je kiest hier actief voor</td>
              </tr>
              <tr>
                <td style={tdStyle}>Profielfoto uploaden</td>
                <td style={td2Style}>Toestemming (Art. 6-1a)</td>
                <td style={td2Style}>Optioneel, je kiest hier zelf voor</td>
              </tr>
              <tr>
                <td style={tdStyle}>Foutmonitoring (Sentry)</td>
                <td style={td2Style}>Gerechtvaardigd belang (Art. 6-1f)</td>
                <td style={td2Style}>Beveiliging en stabiliteit van het platform</td>
              </tr>
              <tr>
                <td style={tdStyle}>E-mailnotificaties</td>
                <td style={td2Style}>Gerechtvaardigd belang (Art. 6-1f)</td>
                <td style={td2Style}>Je kunt je altijd uitschrijven</td>
              </tr>
              <tr>
                <td style={tdStyle}>Facturatie aan organisaties</td>
                <td style={td2Style}>Wettelijke verplichting (Art. 6-1c)</td>
                <td style={td2Style}>Fiscale bewaarplicht</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* 5. Ontvangers */}
        <section style={sectionStyle}>
          <h2>5. Met wie delen wij je gegevens?</h2>
          <p>
            Wij delen je persoonsgegevens alleen met partijen die noodzakelijk zijn voor
            de werking van het platform. Met elk van deze partijen zijn passende
            verwerkersovereenkomsten gesloten.
          </p>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Partij</th>
                <th style={{ ...thStyle, padding: 8 }}>Dienst</th>
                <th style={{ ...thStyle, padding: 8 }}>Locatie</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdStyle}><strong>Supabase Inc.</strong></td>
                <td style={td2Style}>Database, authenticatie, bestandsopslag</td>
                <td style={td2Style}>Frankfurt, Duitsland (EU)</td>
              </tr>
              <tr>
                <td style={tdStyle}><strong>Vercel Inc.</strong></td>
                <td style={td2Style}>Hosting en serverfuncties</td>
                <td style={td2Style}>EU / VS (met SCC's)</td>
              </tr>
              <tr>
                <td style={tdStyle}><strong>Google LLC</strong></td>
                <td style={td2Style}>OAuth-authenticatie (alleen bij Google-inlog)</td>
                <td style={td2Style}>VS (met SCC's)</td>
              </tr>
              <tr>
                <td style={tdStyle}><strong>Sentry (Functional Software)</strong></td>
                <td style={td2Style}>Foutmonitoring</td>
                <td style={td2Style}>VS (met SCC's)</td>
              </tr>
              <tr>
                <td style={tdStyle}><strong>TransIP B.V.</strong></td>
                <td style={td2Style}>DNS-beheer</td>
                <td style={td2Style}>Nederland</td>
              </tr>
            </tbody>
          </table>
          <p style={{ marginTop: 8, fontSize: 14, color: 'var(--text-secondary)' }}>
            SCC's = Standard Contractual Clauses, het mechanisme dat de Europese Commissie
            goedkeurt voor doorgifte van persoonsgegevens naar landen buiten de EU.
          </p>
          <p>Wij verkopen je gegevens nooit aan derden.</p>
        </section>

        {/* 6. Bewaartermijnen */}
        <section style={sectionStyle}>
          <h2>6. Hoe lang bewaren wij je gegevens?</h2>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Gegevens</th>
                <th style={{ ...thStyle, padding: 8 }}>Bewaartermijn</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdStyle}>Actief account en profiel</td>
                <td style={td2Style}>Zolang je account actief is</td>
              </tr>
              <tr>
                <td style={tdStyle}>Na verwijdering account</td>
                <td style={td2Style}>Binnen 30 dagen definitief verwijderd</td>
              </tr>
              <tr>
                <td style={tdStyle}>Intake-gegevens (geen account)</td>
                <td style={td2Style}>24 maanden na laatste activiteit</td>
              </tr>
              <tr>
                <td style={tdStyle}>Foutlogs (Sentry)</td>
                <td style={td2Style}>90 dagen</td>
              </tr>
              <tr>
                <td style={tdStyle}>Authenticatielogs</td>
                <td style={td2Style}>6 maanden</td>
              </tr>
              <tr>
                <td style={tdStyle}>Facturatiegegevens</td>
                <td style={td2Style}>7 jaar (wettelijke verplichting)</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* 7. Rechten */}
        <section style={sectionStyle}>
          <h2>7. Jouw rechten</h2>
          <p>Op grond van de AVG heb je de volgende rechten:</p>
          <ul>
            <li><strong>Inzage</strong> (Art. 15) — opvragen welke gegevens wij van je hebben</li>
            <li><strong>Rectificatie</strong> (Art. 16) — onjuiste gegevens laten corrigeren (je kunt dit ook zelf doen via je profiel)</li>
            <li><strong>Verwijdering</strong> (Art. 17) — je account en gegevens laten verwijderen</li>
            <li><strong>Beperking</strong> (Art. 18) — verwerking tijdelijk laten stopzetten</li>
            <li><strong>Dataportabiliteit</strong> (Art. 20) — je gegevens ontvangen in een machineleesbaar formaat (JSON/CSV)</li>
            <li><strong>Bezwaar</strong> (Art. 21) — bezwaar maken tegen verwerking op basis van gerechtvaardigd belang</li>
            <li><strong>Intrekking toestemming</strong> — waar verwerking op toestemming is gebaseerd, kun je deze altijd intrekken</li>
          </ul>
          <p>
            <strong>Voor gegevens binnen een project:</strong> neem contact op met de organisatie
            die het project beheert — zij zijn de verwerkingsverantwoordelijke.
          </p>
          <p>
            <strong>Voor platformgegevens:</strong> stuur een e-mail naar{' '}
            <a href="mailto:privacy@crowdbuilding.com">privacy@crowdbuilding.com</a>.
            Wij reageren uiterlijk binnen 30 dagen.
          </p>
        </section>

        {/* 8. Cookies */}
        <section style={sectionStyle}>
          <h2>8. Cookies en lokale opslag</h2>
          <p>Wij gebruiken <strong>geen tracking cookies</strong> en geen analytische cookies. Wel gebruiken wij:</p>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Type</th>
                <th style={{ ...thStyle, padding: 8 }}>Doel</th>
                <th style={{ ...thStyle, padding: 8 }}>Toestemming nodig?</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdStyle}>Sessiecookie (Supabase auth)</td>
                <td style={td2Style}>Ingelogd blijven</td>
                <td style={td2Style}>Nee (strikt noodzakelijk)</td>
              </tr>
              <tr>
                <td style={tdStyle}>Cross-subdomain cookie (.buuur.nl)</td>
                <td style={td2Style}>Sessie overdragen tussen subdomeinen</td>
                <td style={td2Style}>Nee (strikt noodzakelijk)</td>
              </tr>
              <tr>
                <td style={tdStyle}>localStorage (thema, voorkeuren)</td>
                <td style={td2Style}>Functionele voorkeuren opslaan</td>
                <td style={td2Style}>Nee (functioneel)</td>
              </tr>
            </tbody>
          </table>
          <p>
            Aangezien al onze cookies en lokale opslag strikt noodzakelijk of functioneel zijn,
            is hiervoor geen voorafgaande toestemming vereist onder de Telecommunicatiewet (Art. 11.7a).
          </p>
        </section>

        {/* 9. Beveiliging */}
        <section style={sectionStyle}>
          <h2>9. Beveiliging</h2>
          <p>
            Wij nemen passende technische en organisatorische maatregelen om je
            persoonsgegevens te beschermen:
          </p>
          <ul>
            <li>Versleutelde verbindingen (HTTPS/TLS) op alle communicatie</li>
            <li>Row-Level Security (RLS) op databaseniveau — je ziet alleen je eigen data</li>
            <li>Rolgebaseerde toegangscontrole met hiërarchische rechten</li>
            <li>Data opgeslagen in de EU (Supabase Frankfurt)</li>
            <li>Tweefactorauthenticatie beschikbaar via Google OAuth</li>
            <li>Regelmatige evaluatie van beveiligingsmaatregelen</li>
          </ul>
        </section>

        {/* 10. Doorgifte buiten EU */}
        <section style={sectionStyle}>
          <h2>10. Doorgifte buiten de EU</h2>
          <p>
            Je persoonsgegevens worden primair opgeslagen in de EU (Supabase, Frankfurt).
            Sommige dienstverleners (Vercel, Sentry, Google) kunnen gegevens verwerken in de
            Verenigde Staten. In die gevallen zijn passende waarborgen getroffen via:
          </p>
          <ul>
            <li>Standard Contractual Clauses (SCC's) goedgekeurd door de Europese Commissie</li>
            <li>Het EU-US Data Privacy Framework (waar van toepassing)</li>
          </ul>
        </section>

        {/* 11. Datalekken */}
        <section style={sectionStyle}>
          <h2>11. Datalekken</h2>
          <p>
            In het onwaarschijnlijke geval van een datalek dat een risico vormt voor je rechten
            en vrijheden, informeren wij de betreffende organisatie onverwijld. De organisatie
            meldt het datalek indien nodig bij de Autoriteit Persoonsgegevens en informeert
            betrokkenen. Bij datalekken die betrekking hebben op platformgegevens waarvoor
            CrowdBuilding zelf verantwoordelijk is, melden wij dit rechtstreeks bij de AP
            binnen 72 uur.
          </p>
        </section>

        {/* 12. Klachten */}
        <section style={sectionStyle}>
          <h2>12. Klachten</h2>
          <p>
            Heb je een klacht over hoe wij met je gegevens omgaan? Neem dan eerst contact
            met ons op via{' '}
            <a href="mailto:privacy@crowdbuilding.com">privacy@crowdbuilding.com</a>.
            Wij doen ons best om je klacht naar tevredenheid op te lossen.
          </p>
          <p>
            Je hebt ook altijd het recht om een klacht in te dienen bij de{' '}
            <a href="https://autoriteitpersoonsgegevens.nl" target="_blank" rel="noopener noreferrer">
              Autoriteit Persoonsgegevens
            </a>.
          </p>
        </section>

        {/* 13. Wijzigingen */}
        <section>
          <h2>13. Wijzigingen</h2>
          <p>
            Wij kunnen deze privacyverklaring van tijd tot tijd aanpassen. De meest recente
            versie is altijd beschikbaar op deze pagina. Bij belangrijke wijzigingen
            informeren wij je via het platform of per e-mail.
          </p>
        </section>

        <div className="hide-on-print" style={{ marginTop: 32, textAlign: 'center' }}>
          <a href="/login" className="cl-btn cl-btn--primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
            <i className="fa-solid fa-arrow-left" /> Terug naar inloggen
          </a>
        </div>
      </div>
    </div>
  )
}
