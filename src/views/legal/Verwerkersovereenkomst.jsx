import LegalDocumentPage from './LegalDocumentPage'

export default function Verwerkersovereenkomst() {
  const s = { marginBottom: 24 }
  const tbl = { width: '100%', borderCollapse: 'collapse', fontSize: 14, marginBottom: 12 }
  const th = { textAlign: 'left', padding: '6px 8px 6px 0', borderBottom: '1px solid var(--border-default)', fontWeight: 600 }
  const td = { padding: '6px 8px 6px 0', borderBottom: '1px solid var(--border-default)', verticalAlign: 'top' }
  const td2 = { padding: '6px 8px', borderBottom: '1px solid var(--border-default)', verticalAlign: 'top' }

  return (
    <LegalDocumentPage title="Verwerkersovereenkomst" updatedDate="9 juni 2026">
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
        Op grond van artikel 28 Algemene Verordening Gegevensbescherming (AVG)
      </p>

      <section style={s}>
        <h2>Partijen</h2>
        <ol>
          <li><strong>[Naam Organisatie]</strong>, gevestigd te [adres], KvK-nummer [nummer], hierna: "Verwerkingsverantwoordelijke";</li>
          <li><strong>CrowdBuilding B.V.</strong>, gevestigd te Asterweg 20C-2, 1031 HN Amsterdam, KvK-nummer 81149301, hierna: "Verwerker";</li>
        </ol>
      </section>

      <section style={s}>
        <h2>1. Definities</h2>
        <table style={tbl}>
          <tbody>
            <tr><td style={td}><strong>AVG</strong></td><td style={td2}>Algemene Verordening Gegevensbescherming (Verordening (EU) 2016/679)</td></tr>
            <tr><td style={td}><strong>Persoonsgegevens</strong></td><td style={td2}>Alle informatie over een geïdentificeerde of identificeerbare natuurlijke persoon</td></tr>
            <tr><td style={td}><strong>Verwerking</strong></td><td style={td2}>Elke bewerking van Persoonsgegevens (verzamelen, opslaan, wijzigen, raadplegen, gebruiken, verstrekken, wissen)</td></tr>
            <tr><td style={td}><strong>Betrokkene</strong></td><td style={td2}>De natuurlijke persoon op wie de Persoonsgegevens betrekking hebben</td></tr>
            <tr><td style={td}><strong>Datalek</strong></td><td style={td2}>Een inbreuk in verband met persoonsgegevens als bedoeld in artikel 4 lid 12 AVG</td></tr>
            <tr><td style={td}><strong>Sub-verwerker</strong></td><td style={td2}>Een derde die door de Verwerker wordt ingeschakeld voor de verwerking</td></tr>
            <tr><td style={td}><strong>Platform</strong></td><td style={td2}>De Buuur community-applicatie</td></tr>
          </tbody>
        </table>
      </section>

      <section style={s}>
        <h2>2. Onderwerp en duur</h2>
        <p>Deze Verwerkersovereenkomst regelt de verwerking van Persoonsgegevens door Verwerker ten behoeve van Verwerkingsverantwoordelijke in het kader van het gebruik van het Platform.</p>
        <p>De overeenkomst treedt in werking op de datum van ondertekening en blijft van kracht zolang Verwerker Persoonsgegevens verwerkt. Bij beëindiging van de dienstverleningsovereenkomst eindigt ook deze Verwerkersovereenkomst, met inachtneming van artikel 12.</p>
      </section>

      <section style={s}>
        <h2>3. Aard en doel van de verwerking</h2>
        <p>Verwerker verwerkt Persoonsgegevens uitsluitend voor:</p>
        <ul>
          <li>Het hosten en beschikbaar stellen van het community platform</li>
          <li>Authenticatie en toegangsbeheer</li>
          <li>Opslaan en weergeven van ledenprofielen, berichten, documenten en evenementen</li>
          <li>Verwerken van intake-formulieren en lidmaatschapsaanvragen</li>
          <li>Verzenden van notificaties namens de Verwerkingsverantwoordelijke</li>
          <li>Het maken van back-ups ter bescherming tegen dataverlies</li>
          <li>Het waarborgen van de veiligheid van het Platform</li>
        </ul>
      </section>

      <section style={s}>
        <h2>4. Soort Persoonsgegevens</h2>
        <table style={tbl}>
          <thead>
            <tr><th style={th}>Categorie</th><th style={{...th, padding: '6px 8px'}}>Voorbeelden</th></tr>
          </thead>
          <tbody>
            <tr><td style={td}>Identificatiegegevens</td><td style={td2}>Naam, e-mailadres, profielfoto</td></tr>
            <tr><td style={td}>Contactgegevens</td><td style={td2}>Telefoonnummer, adres</td></tr>
            <tr><td style={td}>Profielgegevens</td><td style={td2}>Bio, woonvoorkeuren, huishoudgrootte</td></tr>
            <tr><td style={td}>Lidmaatschapsgegevens</td><td style={td2}>Projectdeelname, rollen, intake-antwoorden</td></tr>
            <tr><td style={td}>Communicatiegegevens</td><td style={td2}>Berichten, reacties, updates</td></tr>
            <tr><td style={td}>Evenementgegevens</td><td style={td2}>Aanmeldingen, aanwezigheid</td></tr>
            <tr><td style={td}>Documentgegevens</td><td style={td2}>Geüploade bestanden en afbeeldingen</td></tr>
            <tr><td style={td}>Technische gegevens</td><td style={td2}>IP-adres, browsertype (alleen beveiliging)</td></tr>
          </tbody>
        </table>
      </section>

      <section style={s}>
        <h2>5. Categorieën Betrokkenen</h2>
        <ul>
          <li>Leden en aspirant-leden van projecten</li>
          <li>Geïnteresseerden die een intake-formulier invullen</li>
          <li>Professionals en adviseurs</li>
          <li>Medewerkers en bestuurders van de Verwerkingsverantwoordelijke</li>
        </ul>
      </section>

      <section style={s}>
        <h2>6. Verplichtingen van de Verwerker</h2>
        <h3>6.1 Instructies</h3>
        <p>Verwerker verwerkt Persoonsgegevens uitsluitend op basis van schriftelijke instructies van de Verwerkingsverantwoordelijke (Art. 28 lid 3a AVG).</p>
        <h3>6.2 Geheimhouding</h3>
        <p>Verwerker waarborgt dat alle gemachtigde personen zich tot geheimhouding hebben verplicht (Art. 28 lid 3b AVG).</p>
        <h3>6.3 Beveiliging (Art. 32 AVG)</h3>
        <ul>
          <li>Versleuteling bij transport (TLS/HTTPS) en in rust</li>
          <li>Row-Level Security (RLS) op databaseniveau</li>
          <li>Rolgebaseerde toegangscontrole</li>
          <li>Gegevensopslag binnen de EU (Supabase, Frankfurt)</li>
          <li>Regelmatige evaluatie van beveiligingsmaatregelen</li>
          <li>Toegangslogging en monitoring</li>
          <li>Geautomatiseerde back-ups</li>
        </ul>
      </section>

      <section style={s}>
        <h2>7. Sub-verwerkers</h2>
        <p>Verwerkingsverantwoordelijke verleent Verwerker algemene schriftelijke toestemming om sub-verwerkers in te schakelen (Art. 28 lid 2 AVG).</p>
        <table style={tbl}>
          <thead>
            <tr>
              <th style={th}>Sub-verwerker</th>
              <th style={{...th, padding: '6px 8px'}}>Dienst</th>
              <th style={{...th, padding: '6px 8px'}}>Locatie</th>
              <th style={{...th, padding: '6px 8px'}}>Waarborg</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style={td}>Supabase Inc.</td><td style={td2}>Database, auth, storage</td><td style={td2}>Frankfurt (EU)</td><td style={td2}>N.v.t.</td></tr>
            <tr><td style={td}>Vercel Inc.</td><td style={td2}>Hosting</td><td style={td2}>EU / VS</td><td style={td2}>SCC's + DPF</td></tr>
            <tr><td style={td}>Google LLC</td><td style={td2}>OAuth</td><td style={td2}>VS</td><td style={td2}>SCC's + DPF</td></tr>
            <tr><td style={td}>Functional Software (Sentry)</td><td style={td2}>Foutmonitoring</td><td style={td2}>VS</td><td style={td2}>SCC's</td></tr>
            <tr><td style={td}>TransIP B.V.</td><td style={td2}>DNS</td><td style={td2}>NL</td><td style={td2}>N.v.t.</td></tr>
          </tbody>
        </table>
        <p>Verwerker informeert Verwerkingsverantwoordelijke 30 dagen vooraf bij wijzigingen. Verwerkingsverantwoordelijke kan bezwaar maken.</p>
      </section>

      <section style={s}>
        <h2>8. Doorgifte buiten de EU/EER</h2>
        <p>Doorgifte vindt uitsluitend plaats met Standard Contractual Clauses (SCC's) of een adequaatheidsbesluit. Voor huidige sub-verwerkers buiten de EU zijn SCC's en/of het EU-US Data Privacy Framework van toepassing.</p>
      </section>

      <section style={s}>
        <h2>9. Bijstand bij rechten van Betrokkenen</h2>
        <p>Verwerker verleent bijstand bij verzoeken van Betrokkenen (Art. 15-22 AVG) en stelt het Platform zo in dat Verwerkingsverantwoordelijke profielen kan inzien, exporteren en leden kan verwijderen. Directe verzoeken aan Verwerker worden onverwijld doorgestuurd.</p>
      </section>

      <section style={s}>
        <h2>10. Datalekken</h2>
        <p>Verwerker meldt elk Datalek aan Verwerkingsverantwoordelijke <strong>zonder onredelijke vertraging en waar mogelijk binnen 24 uur</strong>, met vermelding van:</p>
        <ul>
          <li>Aard van het Datalek, categorieën en geschat aantal Betrokkenen</li>
          <li>Naam en contactgegevens aanspreekpunt</li>
          <li>Waarschijnlijke gevolgen</li>
          <li>Genomen en voorgestelde maatregelen</li>
        </ul>
      </section>

      <section style={s}>
        <h2>11. DPIA</h2>
        <p>Verwerker verleent bijstand bij het uitvoeren van een Data Protection Impact Assessment (Art. 35-36 AVG).</p>
      </section>

      <section style={s}>
        <h2>12. Teruggave en verwijdering na beëindiging</h2>
        <ul>
          <li><strong>Export:</strong> 30 dagen om alle Persoonsgegevens te exporteren (CSV/JSON)</li>
          <li><strong>Verwijdering:</strong> binnen 30 dagen na exportperiode definitief verwijderd</li>
          <li><strong>Bevestiging:</strong> schriftelijke bevestiging van verwijdering</li>
          <li><strong>Back-ups:</strong> uiterlijk 90 dagen na beëindiging verwijderd</li>
        </ul>
      </section>

      <section style={s}>
        <h2>13. Audit</h2>
        <p>Verwerker stelt alle informatie ter beschikking voor audits (Art. 28 lid 3h AVG). Audits na 30 dagen kennisgeving, tijdens kantooruren, op kosten Verwerkingsverantwoordelijke. Als alternatief kan een onafhankelijke audit (SOC 2 Type II) worden aangeboden.</p>
      </section>

      <section style={s}>
        <h2>14. Aansprakelijkheid</h2>
        <p>Onderworpen aan de beperkingen in de dienstverleningsovereenkomst en algemene voorwaarden.</p>
      </section>

      <section style={s}>
        <h2>15. Toepasselijk recht</h2>
        <p>Nederlands recht. Geschillen: bevoegde rechter te Amsterdam.</p>
      </section>

      <section style={s}>
        <h2>Ondertekening</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 16 }}>
          <div style={{ padding: 16, border: '1px dashed var(--border-default)', borderRadius: 8 }}>
            <strong>Verwerkingsverantwoordelijke:</strong>
            <p style={{ marginTop: 12, lineHeight: 2.2, color: 'var(--text-tertiary)' }}>
              Naam: ___________________<br />
              Functie: ___________________<br />
              Datum: ___________________<br />
              Handtekening: ___________________
            </p>
          </div>
          <div style={{ padding: 16, border: '1px dashed var(--border-default)', borderRadius: 8 }}>
            <strong>Verwerker (CrowdBuilding B.V.):</strong>
            <p style={{ marginTop: 12, lineHeight: 2.2, color: 'var(--text-tertiary)' }}>
              Naam: ___________________<br />
              Functie: ___________________<br />
              Datum: ___________________<br />
              Handtekening: ___________________
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2>Bijlage A: Beveiligingsmaatregelen</h2>
        <h3>Netwerkbeveiliging</h3>
        <ul><li>HTTPS/TLS op alle communicatie</li><li>DDoS-bescherming via Vercel</li></ul>
        <h3>Toegangscontrole</h3>
        <ul><li>Row-Level Security op alle tabellen</li><li>Rolgebaseerde toegangscontrole (7 niveaus)</li><li>OAuth 2.0 / e-mail authenticatie via Supabase Auth</li></ul>
        <h3>Gegevensbeveiliging</h3>
        <ul><li>Opslag in EU (Supabase Frankfurt)</li><li>Versleuteling in rust (AES-256) en bij transport (TLS 1.2+)</li><li>Bestandsvalidatie en afbeeldingscompressie bij upload</li></ul>
        <h3>Monitoring en back-up</h3>
        <ul><li>Foutmonitoring via Sentry (minimale PII)</li><li>Dagelijkse back-ups met point-in-time recovery (90 dagen retentie)</li></ul>
        <h3>Organisatorisch</h3>
        <ul><li>Geheimhoudingsverplichtingen medewerkers</li><li>Toegang beperkt tot strict noodzakelijke medewerkers</li></ul>
      </section>
    </LegalDocumentPage>
  )
}
