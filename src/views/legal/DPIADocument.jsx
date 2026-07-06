import LegalDocumentPage from './LegalDocumentPage'

export default function DPIADocument() {
  const s = { marginBottom: 24 }
  const tbl = { width: '100%', borderCollapse: 'collapse', fontSize: 14, marginBottom: 12 }
  const th = { textAlign: 'left', padding: '6px 8px 6px 0', borderBottom: '1px solid var(--border-default)', fontWeight: 600 }
  const td = { padding: '6px 8px 6px 0', borderBottom: '1px solid var(--border-default)', verticalAlign: 'top' }
  const td2 = { padding: '6px 8px', borderBottom: '1px solid var(--border-default)', verticalAlign: 'top' }

  return (
    <LegalDocumentPage title="Data Protection Impact Assessment" updatedDate="9 juni 2026">
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
        Buuur Community Platform — CrowdBuilding B.V.
      </p>

      <section style={s}>
        <h2>1. Inleiding</h2>
        <p>
          Deze DPIA wordt uitgevoerd conform artikel 35 AVG vanwege de grootschalige verwerking van
          persoonsgegevens via het Buuur community platform. Het platform verwerkt gegevens van leden van
          woongemeenschappen, inclusief woonvoorkeuren en huishoudsamenstelling.
        </p>
        <table style={tbl}>
          <tbody>
            <tr><td style={td}><strong>Uitvoerder</strong></td><td style={td2}>Tjeerd Haccou</td></tr>
            <tr><td style={td}><strong>Datum</strong></td><td style={td2}>9 juni 2026</td></tr>
            <tr><td style={td}><strong>Volgende review</strong></td><td style={td2}>9 juni 2027</td></tr>
          </tbody>
        </table>
      </section>

      <section style={s}>
        <h2>2. Beschrijving van de verwerking</h2>
        <h3>2.1 Persoonsgegevens</h3>
        <table style={tbl}>
          <thead><tr><th style={th}>Categorie</th><th style={{...th, padding: '6px 8px'}}>Gegevens</th></tr></thead>
          <tbody>
            <tr><td style={td}>Identificatie</td><td style={td2}>Naam, e-mail, profielfoto</td></tr>
            <tr><td style={td}>Contact</td><td style={td2}>Telefoonnummer, adres</td></tr>
            <tr><td style={td}>Profiel</td><td style={td2}>Bio, woonvoorkeuren, huishoudgrootte</td></tr>
            <tr><td style={td}>Lidmaatschap</td><td style={td2}>Projecten, rollen, intake-antwoorden</td></tr>
            <tr><td style={td}>Communicatie</td><td style={td2}>Berichten, reacties, uploads</td></tr>
            <tr><td style={td}>Technisch</td><td style={td2}>IP-adres, browsertype, foutlogs</td></tr>
          </tbody>
        </table>

        <h3>2.2 Betrokkenen</h3>
        <ul>
          <li><strong>Leden:</strong> actieve deelnemers (honderden per project)</li>
          <li><strong>Aspirant-leden:</strong> in het intake-traject</li>
          <li><strong>Geïnteresseerden:</strong> intake-formulier invullers</li>
          <li><strong>Professionals:</strong> adviseurs en externe betrokkenen</li>
        </ul>

        <h3>2.3 Datastromen</h3>
        <div style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 8, fontSize: 13, fontFamily: 'monospace', whiteSpace: 'pre-line', marginBottom: 12 }}>
{`Gebruiker (browser)
  ├── HTTPS/TLS ──→ Vercel (hosting, EU/VS)
  │                    ├──→ Supabase (database, Frankfurt EU)
  │                    │      ├── Auth (sessies, tokens)
  │                    │      ├── Database (alle ledendata)
  │                    │      └── Storage (bestanden, foto's)
  │                    ├──→ Sentry (foutmonitoring, VS)
  │                    └──→ TransIP (DNS, NL)
  └── Google OAuth ──→ Google (authenticatie, VS)`}
        </div>
      </section>

      <section style={s}>
        <h2>3. Noodzaak en proportionaliteit</h2>
        <p>De verwerkte gegevens zijn noodzakelijk voor de kernfunctionaliteit:</p>
        <ul>
          <li><strong>Identificatiegegevens:</strong> authenticatie en herkenning</li>
          <li><strong>Contactgegevens:</strong> communicatie (optioneel)</li>
          <li><strong>Woonvoorkeuren/intake:</strong> matchmaking door organisatie</li>
          <li><strong>Community-content:</strong> kernfunctie platform</li>
        </ul>
        <p><strong>Dataminimalisatie:</strong> telefoonnummer, adres en profielfoto zijn optioneel. Technische logs worden geminimaliseerd (90 dagen Sentry, 6 maanden auth logs).</p>
      </section>

      <section style={s}>
        <h2>4. Risicobeoordeling</h2>
        <table style={tbl}>
          <thead>
            <tr>
              <th style={th}>#</th>
              <th style={{...th, padding: '6px 8px'}}>Risico</th>
              <th style={{...th, padding: '6px 8px'}}>Kans</th>
              <th style={{...th, padding: '6px 8px'}}>Impact</th>
              <th style={{...th, padding: '6px 8px'}}>Maatregel</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={td}>R1</td>
              <td style={td2}>Ongeautoriseerde toegang door RLS-fout</td>
              <td style={td2}>Laag</td>
              <td style={td2}>Hoog</td>
              <td style={td2}>RLS-policies per tabel, rolhiërarchie, testen</td>
            </tr>
            <tr>
              <td style={td}>R2</td>
              <td style={td2}>Datalek bij sub-verwerker</td>
              <td style={td2}>Laag</td>
              <td style={td2}>Hoog</td>
              <td style={td2}>DPA's, security monitoring</td>
            </tr>
            <tr>
              <td style={td}>R3</td>
              <td style={td2}>Gestolen sessietokens</td>
              <td style={td2}>Midden</td>
              <td style={td2}>Midden</td>
              <td style={td2}>Sessie-expiratie, HTTPS-only, token-rotatie</td>
            </tr>
            <tr>
              <td style={td}>R4</td>
              <td style={td2}>Admin-account compromittering</td>
              <td style={td2}>Laag</td>
              <td style={td2}>Hoog</td>
              <td style={td2}>Rolgebaseerde toegang, audit logging</td>
            </tr>
            <tr>
              <td style={td}>R5</td>
              <td style={td2}>Verkeerde RLS-policy</td>
              <td style={td2}>Laag</td>
              <td style={td2}>Hoog</td>
              <td style={td2}>Deny-by-default, code review</td>
            </tr>
            <tr>
              <td style={td}>R6</td>
              <td style={td2}>Doorgifte VS zonder waarborgen</td>
              <td style={td2}>Laag</td>
              <td style={td2}>Midden</td>
              <td style={td2}>SCC's met alle VS-partijen</td>
            </tr>
            <tr>
              <td style={td}>R7</td>
              <td style={td2}>Dataverlies door storing Supabase</td>
              <td style={td2}>Laag</td>
              <td style={td2}>Hoog</td>
              <td style={td2}>Dagelijkse back-ups, point-in-time recovery</td>
            </tr>
            <tr>
              <td style={td}>R8</td>
              <td style={td2}>Misbruik ledendata door organisatie</td>
              <td style={td2}>Midden</td>
              <td style={td2}>Midden</td>
              <td style={td2}>Verwerkersovereenkomst, doelbinding</td>
            </tr>
            <tr>
              <td style={td}>R9</td>
              <td style={td2}>Betrokkenen kunnen rechten niet uitoefenen</td>
              <td style={td2}>Laag</td>
              <td style={td2}>Midden</td>
              <td style={td2}>Self-service profiel/verwijdering, exportfunctie</td>
            </tr>
            <tr>
              <td style={td}>R10</td>
              <td style={td2}>PII in foutlogs (Sentry)</td>
              <td style={td2}>Midden</td>
              <td style={td2}>Laag</td>
              <td style={td2}>Data scrubbing, minimale PII</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section style={s}>
        <h2>5. Maatregelen</h2>
        <h3>Geïmplementeerd</h3>
        <ul>
          <li>Row-Level Security op alle tabellen</li>
          <li>HTTPS/TLS op alle communicatie</li>
          <li>Rolhiërarchie (7 niveaus) met permission checks</li>
          <li>JWT-tokens met sessie-expiratie (Supabase Auth)</li>
          <li>Bestandsvalidatie en compressie bij upload</li>
          <li>EU-opslag (Supabase Frankfurt)</li>
          <li>Dagelijkse back-ups met point-in-time recovery</li>
          <li>Verwerkersovereenkomsten met sub-verwerkers</li>
          <li>Datalekprotocol</li>
          <li>Privacyverklaring op buuur.nl</li>
        </ul>

        <h3>Nog te implementeren</h3>
        <table style={tbl}>
          <thead>
            <tr>
              <th style={th}>Maatregel</th>
              <th style={{...th, padding: '6px 8px'}}>Prioriteit</th>
              <th style={{...th, padding: '6px 8px'}}>Deadline</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style={td}>Data-exportfunctie per organisatie</td><td style={td2}>Hoog</td><td style={td2}>Q3 2026</td></tr>
            <tr><td style={td}>Individuele data-export per lid</td><td style={td2}>Hoog</td><td style={td2}>Q3 2026</td></tr>
            <tr><td style={td}>Account-verwijderfunctie (self-service)</td><td style={td2}>Hoog</td><td style={td2}>Q3 2026</td></tr>
            <tr><td style={td}>Sentry data scrubbing review</td><td style={td2}>Midden</td><td style={td2}>Q3 2026</td></tr>
            <tr><td style={td}>Periodieke RLS-audit</td><td style={td2}>Midden</td><td style={td2}>Per kwartaal</td></tr>
          </tbody>
        </table>
      </section>

      <section style={s}>
        <h2>6. Conclusie</h2>
        <p>
          Na implementatie van alle maatregelen wordt het restrisico als <strong>acceptabel</strong> beoordeeld.
          Er zijn geen verwerkingen geïdentificeerd die voorafgaande raadpleging van de Autoriteit
          Persoonsgegevens vereisen (Art. 36 AVG).
        </p>
      </section>

      <section>
        <h2>7. Goedkeuring</h2>
        <table style={tbl}>
          <tbody>
            <tr><td style={td}><strong>Opgesteld door</strong></td><td style={td2}>Tjeerd Haccou</td></tr>
            <tr><td style={td}><strong>Goedgekeurd door</strong></td><td style={td2}>Tjeerd Haccou</td></tr>
            <tr><td style={td}><strong>Datum</strong></td><td style={td2}>9 juni 2026</td></tr>
            <tr><td style={td}><strong>Volgende review</strong></td><td style={td2}>9 juni 2027</td></tr>
          </tbody>
        </table>
      </section>
    </LegalDocumentPage>
  )
}
