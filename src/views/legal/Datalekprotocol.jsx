import LegalDocumentPage from './LegalDocumentPage'

export default function Datalekprotocol() {
  const s = { marginBottom: 24 }
  const tbl = { width: '100%', borderCollapse: 'collapse', fontSize: 14, marginBottom: 12 }
  const th = { textAlign: 'left', padding: '6px 8px 6px 0', borderBottom: '1px solid var(--border-default)', fontWeight: 600 }
  const td = { padding: '6px 8px 6px 0', borderBottom: '1px solid var(--border-default)', verticalAlign: 'top' }
  const td2 = { padding: '6px 8px', borderBottom: '1px solid var(--border-default)', verticalAlign: 'top' }

  return (
    <LegalDocumentPage title="Datalekprotocol" updatedDate="9 juni 2026">

      <section style={s}>
        <h2>1. Doel</h2>
        <p>Dit protocol beschrijft de procedure bij het ontdekken, beoordelen, beheersen en melden van datalekken. Gebaseerd op de AVG (artikelen 33 en 34) en richtlijnen van de Autoriteit Persoonsgegevens.</p>
      </section>

      <section style={s}>
        <h2>2. Incidentcoördinator</h2>
        <p>
          <strong>Tjeerd Haccou</strong>, oprichter/directeur<br />
          E-mail: <a href="mailto:privacy@crowdbuilding.com">privacy@crowdbuilding.com</a><br />
          Telefoon: 06-46113735
        </p>
      </section>

      <section style={s}>
        <h2>3. Stap 1: Detectie en interne melding</h2>
        <p><strong>Hoe wordt een datalek ontdekt?</strong></p>
        <ul>
          <li>Meldingen van medewerkers</li>
          <li>Alerts van monitoringsystemen (Sentry, Supabase logs)</li>
          <li>Meldingen van gebruikers of organisaties</li>
          <li>Meldingen van sub-verwerkers</li>
        </ul>
        <p>Iedere medewerker die een (vermoedelijk) datalek constateert, meldt dit <strong>onmiddellijk</strong> aan de incidentcoördinator.</p>
      </section>

      <section style={s}>
        <h2>4. Stap 2: Beoordeling (binnen 4 uur)</h2>
        <table style={tbl}>
          <thead>
            <tr><th style={th}>Niveau</th><th style={{...th, padding: '6px 8px'}}>Beschrijving</th><th style={{...th, padding: '6px 8px'}}>Voorbeeld</th></tr>
          </thead>
          <tbody>
            <tr>
              <td style={{...td, color: 'var(--accent-red)', fontWeight: 600}}>Hoog</td>
              <td style={td2}>Gevoelige gegevens van meerdere betrokkenen</td>
              <td style={td2}>Database-inbreuk, ongeautoriseerde toegang</td>
            </tr>
            <tr>
              <td style={{...td, color: 'var(--accent-orange)', fontWeight: 600}}>Midden</td>
              <td style={td2}>Beperkte gegevens van enkele betrokkenen</td>
              <td style={td2}>E-mail naar verkeerd adres, RLS-fout</td>
            </tr>
            <tr>
              <td style={{...td, color: 'var(--accent-green)', fontWeight: 600}}>Laag</td>
              <td style={td2}>Minimale impact, snel hersteld</td>
              <td style={td2}>Kortstondige zichtbaarheid niet-gevoelige data</td>
            </tr>
          </tbody>
        </table>
        <p><strong>Beoordelingsvragen:</strong></p>
        <ol>
          <li>Welke persoonsgegevens zijn betrokken?</li>
          <li>Hoeveel betrokkenen zijn getroffen?</li>
          <li>Is het lek nog gaande of al gestopt?</li>
          <li>Wat zijn de mogelijke gevolgen?</li>
          <li>Welke organisatie(s) zijn betrokken?</li>
        </ol>
      </section>

      <section style={s}>
        <h2>5. Stap 3: Beheersing</h2>
        <p><strong>Onmiddellijke maatregelen (binnen 1 uur na beoordeling):</strong></p>
        <ul>
          <li>Lek dichten (patch, configuratiewijziging, toegang intrekken)</li>
          <li>Getroffen accounts of systemen isoleren</li>
          <li>Bewijsmateriaal veiligstellen (logs, screenshots)</li>
        </ul>
        <p><strong>Herstelmaatregelen:</strong></p>
        <ul>
          <li>Wachtwoord-resets forceren indien nodig</li>
          <li>RLS-policies controleren en corrigeren</li>
          <li>Sessies invalideren</li>
          <li>Back-ups raadplegen voor gegevensherstel</li>
        </ul>
      </section>

      <section style={s}>
        <h2>6. Stap 4: Melding aan organisatie</h2>
        <p><strong>Wanneer:</strong> zonder onredelijke vertraging, waar mogelijk <strong>binnen 24 uur</strong>.</p>
        <p><strong>Inhoud melding (Art. 33 lid 3 AVG):</strong></p>
        <ol>
          <li>Aard van het datalek (categorieën en geschat aantal betrokkenen)</li>
          <li>Naam en contactgegevens incidentcoördinator</li>
          <li>Waarschijnlijke gevolgen</li>
          <li>Genomen en voorgestelde maatregelen</li>
        </ol>
      </section>

      <section style={s}>
        <h2>7. Stap 5: Melding aan AP</h2>
        <p>Voor verwerkingen waarvoor CrowdBuilding zelf verwerkingsverantwoordelijke is:</p>
        <ul>
          <li><strong>Wanneer:</strong> binnen 72 uur na ontdekking</li>
          <li><strong>Hoe:</strong> via <a href="https://datalekken.autoriteitpersoonsgegevens.nl" target="_blank" rel="noopener noreferrer">meldformulier AP</a></li>
          <li><strong>Niet melden als:</strong> gegevens waren versleuteld, onmiddellijk hersteld zonder derden-toegang, alleen niet-gevoelige gegevens</li>
        </ul>
        <p style={{ fontWeight: 600 }}>Bij twijfel: altijd melden.</p>
      </section>

      <section style={s}>
        <h2>8. Stap 6: Informeren betrokkenen</h2>
        <p>Wanneer er een <strong>hoog risico</strong> is voor rechten en vrijheden (Art. 34 AVG):</p>
        <ul>
          <li><strong>Ledendata:</strong> door de organisatie, met ondersteuning van CrowdBuilding</li>
          <li><strong>Platformdata:</strong> door CrowdBuilding zelf</li>
          <li>Via e-mail en/of platformmelding, in begrijpelijke taal</li>
        </ul>
      </section>

      <section style={s}>
        <h2>9. Stap 7: Registratie en evaluatie</h2>
        <p>Elk datalek wordt geregistreerd met (Art. 33 lid 5):</p>
        <ul>
          <li>Datum/tijdstip ontdekking</li>
          <li>Beschrijving incident</li>
          <li>Categorieën en aantallen betrokkenen</li>
          <li>Gevolgen en genomen maatregelen</li>
          <li>Meldingen aan organisatie, AP en betrokkenen</li>
        </ul>
        <p><strong>Na afhandeling:</strong> root cause analysis, evaluatie respons, structurele maatregelen.</p>
      </section>

      <section style={s}>
        <h2>10. Verantwoordelijkheden</h2>
        <table style={tbl}>
          <thead>
            <tr><th style={th}>Rol</th><th style={{...th, padding: '6px 8px'}}>Verantwoordelijkheid</th></tr>
          </thead>
          <tbody>
            <tr><td style={td}><strong>Incidentcoördinator</strong></td><td style={td2}>Coördinatie, communicatie, registratie</td></tr>
            <tr><td style={td}><strong>Ontwikkelaar(s)</strong></td><td style={td2}>Technische analyse, beheersing, herstel</td></tr>
            <tr><td style={td}><strong>Directie</strong></td><td style={td2}>Besluitvorming melding AP, communicatie naar organisaties</td></tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>11. Contactgegevens</h2>
        <ul>
          <li><strong>Incidentcoördinator:</strong> Tjeerd Haccou, <a href="mailto:privacy@crowdbuilding.com">privacy@crowdbuilding.com</a>, 06-46113735</li>
          <li><strong>Autoriteit Persoonsgegevens:</strong> <a href="https://autoriteitpersoonsgegevens.nl" target="_blank" rel="noopener noreferrer">autoriteitpersoonsgegevens.nl</a>, 0900-3282535</li>
        </ul>
      </section>
    </LegalDocumentPage>
  )
}
