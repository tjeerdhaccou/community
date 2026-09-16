// Alle teksten van buuur.nl (landing + startformulier) op één plek.
//
// Bewust los van de componenten: dit is de inhoud die later vanuit het CMS op
// platformniveau bewerkt moet kunnen worden. Houd de structuur plat en
// serialiseerbaar (geen JSX, geen functies), dan is de stap naar een tabel
// straks alleen nog "lees dit object uit de database in plaats van uit dit
// bestand".
//
// Iconen zijn Font Awesome-klassen, kleuren verwijzen naar bubbel-tinten uit
// landing.css (coral, green, amber, peri, pink, indigo, peach, teal, navy).

export const HERO = {
  eyebrow: 'Voor ontwikkelaars, procesbegeleiders en bewonersinitiatieven',
  title: 'Eerst de buren, dan de woningen.',
  lead:
    'Buuur is de plek waar een woonproject en zijn toekomstige bewoners elkaar vinden. ' +
    'Nieuws, gesprekken, documenten en ledenwerving in één omgeving die van jouw project is, ' +
    'met jouw naam en jouw kleur.',
  primary: 'Plan een demo',
  secondary: 'Kijk rond in het demoproject',
  note: 'Inloggen zonder wachtwoord. Eigen adres per project, zoals jouwproject.buuur.nl.',
}

export const DOELGROEPEN = {
  eyebrow: 'Voor wie',
  title: 'Drie soorten makers, één omgeving.',
  intro:
    'Een ontwikkelaar, een procesbegeleider en een bewonersgroep hebben hetzelfde probleem ' +
    'in een andere jas: de mensen zijn er, de plek ontbreekt. Kies je rol.',
  painLabel: 'Herken je dit',
  items: [
    {
      key: 'ontwikkelaar',
      tab: 'Projectontwikkelaar',
      pain:
        'Je verkoopt gemeenschap, maar tussen tekening en oplevering zien je kopers elkaar nooit. ' +
        'Wie afhaakt, merk je pas bij de notaris.',
      painSub: 'Geïnteresseerden in Excel, kopers in de mail, de gemeente vraagt om bewijs van participatie.',
      title: 'Een wachtlijst die zich al buurt voelt.',
      body:
        'Zet je project op Buuur zodra de eerste schets er is. Geïnteresseerden melden zich aan via ' +
        'je eigen pagina, leren elkaar kennen op het prikbord en volgen elke fase op de roadmap. ' +
        'Kopers die elkaar kennen haken minder af. En je laat de gemeente zien dat participatie ' +
        'meer is dan één avond in het buurthuis.',
      points: [
        'Van geïnteresseerde tot koper in één ledenlijst, met fase en rol per persoon',
        'Nieuws, events en documenten per project, in jouw huisstijl op jouw domein',
        'Betrokkenheid zwart op wit: wie kwam, wie las, wie reageerde',
      ],
      cta: 'Plan een demo',
      ctaTo: '/start?segment=professional',
      ctaNote: 'Je betaalt per woning, niet per gebruiker.',
    },
    {
      key: 'procesbegeleider',
      tab: 'Procesbegeleider',
      pain:
        'Vijf projecten, vijf WhatsApp-groepen, vijf Drive-mappen. En in elk overleg dezelfde vraag: ' +
        'waar staan we eigenlijk?',
      painSub: 'Documenten die je voor de derde keer opvraagt. Besluiten die in een appgroep verdwijnen.',
      title: 'Al je projecten onder één login.',
      body:
        'Elke groep krijgt een eigen omgeving met eigen leden, kleur en pagina. Jij ziet ze allemaal ' +
        'in één organisatiedashboard. Documentverzoeken hebben een deadline en een beoordeling, fases ' +
        'staan vast op de roadmap en besluiten blijven vindbaar. Zo kan een groep door, ook op de ' +
        'avond dat jij er niet bij bent.',
      points: [
        'Organisatiedashboard met alle leden, updates en events van al je projecten',
        'Documentverzoeken met deadline, goedkeuring en ondertekenen',
        'Werkgroepen en commissies met eigen documenten en gesprekken',
      ],
      cta: 'Plan een demo',
      ctaTo: '/start?segment=professional',
      ctaNote: 'Ook als je maar één traject begeleidt.',
    },
    {
      key: 'initiatief',
      tab: 'Bewonersinitiatief',
      pain:
        'Jullie zijn met twaalf, hebben een naam en een droom. De notulen staan in drie inboxen en ' +
        'niemand weet meer wie er nu echt meedoet.',
      painSub: 'Een website laten bouwen kost geld dat jullie nog niet hebben.',
      title: 'Een thuis voor je initiatief, vanaf dag één.',
      body:
        'Met buuur light zet je in een middag een projectomgeving neer: prikbord, agenda, documenten ' +
        'en een eigen pagina waarmee je nieuwe leden vindt. Geen websitebouwer, geen wachtwoorden, ' +
        'geen IT. Het groeit met jullie mee, van de eerste borrel tot de sleuteloverdracht.',
      points: [
        'Eigen naam, kleur en adres, bijvoorbeeld vlinderhaven.buuur.nl',
        'Pagina bouwer plus aanmeldformulier voor nieuwe leden, zonder code',
        'Roadmap die iedereen laat zien waar jullie staan',
      ],
      cta: 'Start met buuur light',
      ctaTo: '/start?segment=bewoner',
      ctaNote: 'Ook verkrijgbaar via CrowdBuilding.',
    },
  ],
}

export const STAPPEN = {
  eyebrow: 'Zo werkt het',
  title: 'Van eerste schets tot sleutel, in drie stappen.',
  items: [
    {
      bubble: 'indigo',
      title: 'Maak je projectomgeving',
      body: 'Naam, logo, kleur en een eigen adres zoals jouwproject.buuur.nl. Zet aan wat je project nodig heeft.',
    },
    {
      bubble: 'coral',
      title: 'Nodig je mensen uit',
      body: 'Team, bewoners en geïnteresseerden loggen in met een code per mail. Iedereen krijgt een rol en een fase.',
    },
    {
      bubble: 'green',
      title: 'Werk samen tot de sleutel',
      body: 'Nieuws, events, documenten en de roadmap groeien mee met het project. Je publieke pagina ook, automatisch.',
    },
  ],
}

export const MODULES = {
  eyebrow: 'Wat erin zit',
  title: 'Negen onderdelen, één zijbalk.',
  intro: 'Zet aan wat je project nu nodig heeft. De rest blijft uit tot het zover is.',
  items: [
    { icon: 'fa-solid fa-bullhorn', bubble: 'coral', title: 'Projectnieuws', body: 'Updates van het team, voor leden of voor iedereen. Verschijnen ook op je publieke pagina.' },
    { icon: 'fa-solid fa-thumbtack', bubble: 'green', title: 'Prikbord', body: 'Vragen, ideeën en kennismaken. Per project of per werkgroep, met foto\'s en tags.' },
    { icon: 'fa-solid fa-calendar-check', bubble: 'amber', title: 'Events', body: 'Informatieavonden en ontwerpsessies, met aanmelden en een herinnering vooraf.' },
    { icon: 'fa-solid fa-comments', bubble: 'green', title: 'Chat', body: 'Eén op één of in een themagroep, zoals Bouwcommissie of Duurzaamheid. Weg uit WhatsApp.' },
    { icon: 'fa-solid fa-road', bubble: 'peri', title: 'Roadmap', body: 'De fases van schets tot bouw, zichtbaar voor iedereen. Nooit meer de vraag waar we staan.' },
    { icon: 'fa-solid fa-folder-open', bubble: 'pink', title: 'Projectdossier', body: 'Ontwerpen, notulen en rapporten, met rechten per groep. Versies blijven bewaard.' },
    { icon: 'fa-solid fa-file-shield', bubble: 'navy', title: 'Mijn dossier', body: 'Per lid: eigen bestanden en verzoeken om te uploaden of te ondertekenen, met deadline.' },
    { icon: 'fa-solid fa-users', bubble: 'peach', title: 'Leden', body: 'Ledenlijst en ledenwerving in één. Van geïnteresseerde tot bewoner, met rol en fase.' },
    { icon: 'fa-solid fa-wand-magic-sparkles', bubble: 'teal', title: 'Pagina bouwer', body: 'Je publieke projectpagina uit blokken, in je eigen huisstijl. Klaar in een middag.' },
  ],
}

export const QUOTE = {
  text:
    'Met buuur staan onze toekomstige bewoners al vanaf de eerste schets met elkaar in contact. ' +
    'Dat scheelt ons bergen mailwerk, en je voelt de buurt ontstaan nog vóór er een steen ligt.',
  caption: 'In gebruik bij de eerste woonprojecten.',
  name: 'Jasper Ewals',
  org: 'CommonCity',
  initials: 'JE',
}

export const PLANS = {
  eyebrow: 'Light & pro',
  title: 'Eén platform, twee manieren om in te stappen.',
  intro: 'Zelfde onderdelen, andere schaal. Pro is voor wie er zijn werk van maakt, light voor de groep die zelf begint.',
  items: [
    {
      key: 'pro',
      featured: true,
      tag: 'Voor ontwikkelaars en procesbegeleiders',
      tagTint: 'accent',
      name: 'buuur pro',
      sub: 'Voor wie woningen ontwikkelt of groepen begeleidt',
      body:
        'Een eigen omgeving per project, met organisatiedashboard, ledenwerving op maat en ' +
        'documentverzoeken. Je betaalt per woning, dus de prijs groeit mee met je project.',
      points: [
        'Eigen omgeving per project, met eigen huisstijl en domein',
        'Organisatiedashboard over al je projecten',
        'Ledenwerving, documentverzoeken en dossiers per lid',
      ],
      cta: 'Plan een demo',
      ctaTo: '/start?segment=professional',
    },
    {
      key: 'light',
      featured: false,
      tag: 'Voor één initiatief',
      tagTint: 'green',
      name: 'buuur light',
      sub: 'Voor wooncoöperaties, CPO-groepen en bewonersgroepen',
      body:
        'Eén projectomgeving voor jullie groep, om te groeien van los idee naar hechte club. ' +
        'Ook verkrijgbaar via CrowdBuilding.',
      points: [
        'Prikbord, events, documenten en roadmap',
        'Eigen pagina met aanmeldformulier voor nieuwe leden',
        'Eigen adres op buuur.nl',
      ],
      cta: 'Start met buuur light',
      ctaTo: '/start?segment=bewoner',
    },
  ],
}

export const SLOT = {
  title: 'Kijk eerst zelf rond.',
  body:
    'Het demoproject staat open. Loop door het dashboard, de chat en de roadmap alsof je al lid bent. ' +
    'Daarna praten we verder over jouw project.',
  primary: 'Naar het demoproject',
  secondary: 'Plan een demo',
}

export const FOOTER = {
  tagline: 'Eerst de buren, dan de woningen. Een initiatief van CrowdBuilding, Amsterdam.',
}

// Startformulier (/start). De keys 'bewoner' en 'professional' zijn de
// waarden in de kolom leads.segment en staan in links, dus die blijven.
export const START = {
  chooseTitle: 'Waar kunnen we je mee helpen?',
  chooseIntro: 'Kies wat het best bij je past, dan stellen we de juiste vragen.',
  back: 'Andere keuze',
  segments: {
    professional: {
      icon: 'fa-solid fa-building',
      bubble: 'indigo',
      title: 'Ik ontwikkel of begeleid woonprojecten',
      desc: 'Je bent projectontwikkelaar of procesbegeleider en wilt in contact staan met je toekomstige bewoners.',
      formTitle: 'Vertel ons over je project',
      formIntro: 'Laat je gegevens achter, dan plannen we een kennismaking en laten we zien wat buuur pro voor jouw project doet.',
      roles: ['Projectontwikkelaar', 'Procesbegeleider', 'Anders'],
      messageLabel: 'Vertel iets over je project',
    },
    bewoner: {
      icon: 'fa-solid fa-people-roof',
      bubble: 'green',
      title: 'Ik wil hier samen wonen',
      desc: 'Je bent toekomstig bewoner, zoekt een woonproject of bent onderdeel van een bewonersgroep.',
      formTitle: 'Vertel ons over je woonwens',
      formIntro: 'Laat je gegevens achter. We nemen contact op zodra buuur light voor jullie klaarstaat, of eerder als er een project bij je past.',
      situations: [
        'Ik oriënteer me nog',
        'Ik zoek een bestaand woonproject',
        'Ik ben onderdeel van een bewonersgroep',
        'Ons initiatief zoekt een platform',
      ],
      messageLabel: 'Vertel iets over je woonwens',
    },
  },
  successTitle: 'Gelukt!',
  // {naam} wordt vervangen door de voornaam uit het formulier.
  successBody: 'Bedankt {naam}, we hebben je bericht ontvangen en nemen snel contact met je op.',
  successCta: 'Terug naar de homepage',
  error: 'Er ging iets mis bij het versturen. Probeer het opnieuw of mail ons op hallo@buuur.nl.',
}
