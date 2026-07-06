export default function AlgemeneVoorwaarden() {
  const sectionStyle = { marginBottom: 28 }

  return (
    <div className="login-page" style={{ alignItems: 'flex-start', overflow: 'auto' }}>
      <div className="cl-card cl-card--elevated legal-document" style={{ maxWidth: 720, margin: '40px auto', padding: '32px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <h1 style={{ margin: 0 }}>Algemene Voorwaarden</h1>
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

        {/* 1. Definities */}
        <section style={sectionStyle}>
          <h2>1. Definities</h2>
          <ul>
            <li><strong>Platform:</strong> de Buuur community-applicatie, bereikbaar via buuur.nl en bijbehorende subdomeinen.</li>
            <li><strong>CrowdBuilding:</strong> CrowdBuilding B.V., KvK 81149301, gevestigd te Asterweg 20C-2, 1031 HN Amsterdam, aanbieder van het Platform.</li>
            <li><strong>Organisatie:</strong> de rechtspersoon die een abonnement afneemt op het Platform voor het beheren van een of meerdere community's.</li>
            <li><strong>Gebruiker:</strong> een natuurlijk persoon die een account aanmaakt op het Platform, al dan niet als lid van een project.</li>
            <li><strong>Project:</strong> een community-omgeving binnen het Platform, aangemaakt door of namens een Organisatie.</li>
            <li><strong>Dienst:</strong> het geheel aan functionaliteiten dat CrowdBuilding via het Platform aanbiedt.</li>
            <li><strong>Content:</strong> alle gegevens, berichten, documenten, afbeeldingen en overige informatie die via het Platform worden geplaatst.</li>
          </ul>
        </section>

        {/* 2. Toepasselijkheid */}
        <section style={sectionStyle}>
          <h2>2. Toepasselijkheid</h2>
          <p>
            Deze algemene voorwaarden zijn van toepassing op elk gebruik van het Platform,
            zowel door Organisaties als door Gebruikers. Door het Platform te gebruiken,
            ga je akkoord met deze voorwaarden.
          </p>
          <p>
            De relatie tussen CrowdBuilding en een Organisatie wordt daarnaast beheerst door
            een separate dienstverleningsovereenkomst en verwerkersovereenkomst.
          </p>
        </section>

        {/* 3. Account en toegang */}
        <section style={sectionStyle}>
          <h2>3. Account en toegang</h2>
          <ol style={{ paddingLeft: 20 }}>
            <li>Om het Platform te gebruiken heb je een account nodig. Je kunt je registreren met een e-mailadres of via Google OAuth.</li>
            <li>Je bent verantwoordelijk voor het vertrouwelijk houden van je inloggegevens en voor alle activiteiten onder je account.</li>
            <li>Je garandeert dat de informatie die je verstrekt bij registratie juist en volledig is.</li>
            <li>CrowdBuilding kan accounts opschorten of verwijderen bij schending van deze voorwaarden, na redelijke waarschuwing.</li>
          </ol>
        </section>

        {/* 4. Gebruik van het Platform */}
        <section style={sectionStyle}>
          <h2>4. Gebruik van het Platform</h2>
          <p>Bij het gebruik van het Platform ga je ermee akkoord dat je:</p>
          <ol style={{ paddingLeft: 20 }}>
            <li>Het Platform niet gebruikt voor onwettige doeleinden of in strijd met deze voorwaarden.</li>
            <li>Geen Content plaatst die beledigend, discriminerend, bedreigend, misleidend of inbreuk makend op rechten van derden is.</li>
            <li>De werking van het Platform niet verstoort, manipuleert of overbelast.</li>
            <li>Geen geautomatiseerde systemen (bots, scrapers) gebruikt zonder uitdrukkelijke toestemming.</li>
            <li>De privacy van andere Gebruikers respecteert en hun gegevens niet buiten het Platform gebruikt.</li>
          </ol>
        </section>

        {/* 5. Content en intellectueel eigendom */}
        <section style={sectionStyle}>
          <h2>5. Content en intellectueel eigendom</h2>
          <ol style={{ paddingLeft: 20 }}>
            <li>
              <strong>Jouw Content:</strong> je behoudt alle rechten op Content die je plaatst.
              Door Content te plaatsen verleen je CrowdBuilding een beperkte licentie om deze
              Content te verwerken, op te slaan en weer te geven binnen het Platform, voor
              zover noodzakelijk voor de werking van de Dienst.
            </li>
            <li>
              <strong>Organisatie-Content:</strong> Content die binnen een project wordt geplaatst,
              valt onder het beheer van de betreffende Organisatie. De Organisatie kan
              moderatieregels hanteren.
            </li>
            <li>
              <strong>Platform:</strong> het Platform zelf (code, ontwerp, naam, logo) is eigendom
              van CrowdBuilding en wordt beschermd door intellectuele eigendomsrechten.
            </li>
          </ol>
        </section>

        {/* 6. Data-eigendom (B2B) */}
        <section style={sectionStyle}>
          <h2>6. Data-eigendom</h2>
          <p>
            Alle persoonsgegevens en Content die een Organisatie via het Platform laat
            verwerken, blijven te allen tijde eigendom van de Organisatie. CrowdBuilding
            verkrijgt geen eigendomsrechten of licentierechten op deze gegevens, anders
            dan noodzakelijk voor het leveren van de Dienst.
          </p>
          <p>
            De Organisatie heeft te allen tijde recht op een volledige export van haar
            gegevens in een gestructureerd, gangbaar en machineleesbaar formaat (CSV/JSON).
          </p>
        </section>

        {/* 7. Beschikbaarheid en onderhoud */}
        <section style={sectionStyle}>
          <h2>7. Beschikbaarheid en onderhoud</h2>
          <ol style={{ paddingLeft: 20 }}>
            <li>CrowdBuilding streeft naar een beschikbaarheid van 99,5% op jaarbasis, exclusief gepland onderhoud.</li>
            <li>Gepland onderhoud wordt, waar mogelijk, minimaal 24 uur van tevoren aangekondigd.</li>
            <li>CrowdBuilding is niet aansprakelijk voor tijdelijke onbeschikbaarheid door overmacht, onderhoud of storingen bij derden.</li>
          </ol>
        </section>

        {/* 8. Privacy en gegevensverwerking */}
        <section style={sectionStyle}>
          <h2>8. Privacy en gegevensverwerking</h2>
          <ol style={{ paddingLeft: 20 }}>
            <li>
              CrowdBuilding verwerkt persoonsgegevens conform de Algemene Verordening
              Gegevensbescherming (AVG) en de Uitvoeringswet AVG.
            </li>
            <li>
              De verwerking van persoonsgegevens door CrowdBuilding namens een Organisatie
              wordt geregeld in een separate verwerkersovereenkomst (Art. 28 AVG).
            </li>
            <li>
              Zie onze <a href="/privacy">privacyverklaring</a> voor uitgebreide informatie.
            </li>
          </ol>
        </section>

        {/* 9. Aansprakelijkheid */}
        <section style={sectionStyle}>
          <h2>9. Aansprakelijkheid</h2>
          <ol style={{ paddingLeft: 20 }}>
            <li>
              CrowdBuilding is uitsluitend aansprakelijk voor directe schade die het gevolg
              is van een aantoonbare toerekenbare tekortkoming in de nakoming van haar
              verplichtingen.
            </li>
            <li>
              De totale aansprakelijkheid van CrowdBuilding is beperkt tot het bedrag dat
              de Organisatie in de 12 maanden voorafgaand aan de schadeveroorzakende
              gebeurtenis aan CrowdBuilding heeft betaald.
            </li>
            <li>
              CrowdBuilding is niet aansprakelijk voor indirecte schade, waaronder
              gevolgschade, gederfde winst, gemiste besparingen of schade door
              bedrijfsstagnatie.
            </li>
            <li>
              CrowdBuilding is niet aansprakelijk voor Content die door Gebruikers of
              Organisaties op het Platform wordt geplaatst.
            </li>
          </ol>
        </section>

        {/* 10. Opschorting en beeindiging */}
        <section style={sectionStyle}>
          <h2>10. Opschorting en beëindiging</h2>
          <ol style={{ paddingLeft: 20 }}>
            <li>
              <strong>Door de Gebruiker:</strong> je kunt je account op elk moment verwijderen via
              je profielinstellingen of door een verzoek te sturen aan{' '}
              <a href="mailto:support@crowdbuilding.com">support@crowdbuilding.com</a>.
            </li>
            <li>
              <strong>Door de Organisatie:</strong> een Organisatie kan het abonnement opzeggen
              met inachtneming van een opzegtermijn van 30 dagen.
            </li>
            <li>
              <strong>Na beëindiging:</strong> de Organisatie heeft 30 dagen om alle gegevens
              te exporteren. Na deze periode worden alle gegevens van de Organisatie en
              haar leden definitief verwijderd, met uitzondering van gegevens die wij
              wettelijk verplicht zijn te bewaren.
            </li>
            <li>
              <strong>Door CrowdBuilding:</strong> wij kunnen een account of abonnement
              opschorten of beëindigen bij ernstige of herhaalde schending van deze
              voorwaarden, na redelijke inspanning om het probleem eerst op te lossen.
            </li>
          </ol>
        </section>

        {/* 11. Wijzigingen */}
        <section style={sectionStyle}>
          <h2>11. Wijzigingen</h2>
          <p>
            CrowdBuilding kan deze voorwaarden van tijd tot tijd wijzigen. Bij substantiële
            wijzigingen worden Organisaties en Gebruikers minimaal 30 dagen van tevoren
            geïnformeerd. Voortgezet gebruik na inwerkingtreding geldt als acceptatie.
            Bij bezwaar kan de Organisatie het abonnement opzeggen.
          </p>
        </section>

        {/* 12. Overige bepalingen */}
        <section style={sectionStyle}>
          <h2>12. Overige bepalingen</h2>
          <ol style={{ paddingLeft: 20 }}>
            <li>Op deze voorwaarden is Nederlands recht van toepassing.</li>
            <li>Geschillen worden voorgelegd aan de bevoegde rechter te Amsterdam.</li>
            <li>
              Indien een bepaling van deze voorwaarden nietig of vernietigbaar blijkt,
              tast dit de geldigheid van de overige bepalingen niet aan.
            </li>
            <li>
              CrowdBuilding mag rechten en verplichtingen uit deze overeenkomst overdragen
              aan een derde, mits dit geen nadelige gevolgen heeft voor de Dienst.
            </li>
          </ol>
        </section>

        {/* 13. Contact */}
        <section>
          <h2>13. Contact</h2>
          <p>
            Vragen over deze voorwaarden? Neem contact met ons op:<br />
            E-mail: <a href="mailto:info@crowdbuilding.com">info@crowdbuilding.com</a><br />
            Adres: Asterweg 20C-2, 1031 HN Amsterdam
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
