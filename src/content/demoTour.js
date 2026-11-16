// Teksten van de rondleiding in het demoproject.
//
// Net als content/landing.js: plat en serialiseerbaar, zodat dit later vanuit
// het CMS bewerkt kan worden.
//
// De rondleiding is bedoeld voor professionals die Buuur beoordelen
// (ontwikkelaars, procesbegeleiders, corporaties). Daarom zakelijk van toon:
// genummerde stappen, geen spelelementen.
//
// Een stap bestaat uit:
//   path    route binnen het project, zonder basePath ('' = dashboard)
//   target  CSS-selector van het element dat de spotlight krijgt; een klik
//           erop rondt de stap ook af
//   title   korte naam van de stap
//   brief   wat de stap laat zien, op de kaart vóór je op de pagina bent
//   pro     wat het de professional oplevert
//   go      knop op de briefingkaart
//   tip     het ballonnetje bij de spotlight

export const TOUR_WELCOME = {
  kicker: 'Demoproject',
  title: 'Zo werkt Buuur',
  body:
    'Dit is een voorbeeldproject met 40 huishoudens. In negen stappen zie je hoe ' +
    'leden en projectteam hier samenwerken, van planning tot besluitvorming.',
  duration: 'Ongeveer 5 minuten',
  primary: 'Start de rondleiding',
  secondary: 'Zelf rondkijken',
}

export const TOUR_MISSIONS = [
  {
    id: 'dashboard',
    icon: 'fa-solid fa-house',
    path: '',
    target: '.dash-stats, .dash-card', // statistieken zijn op mobiel verborgen
    title: 'Overzicht voor elk lid',
    brief:
      'Wie inlogt, ziet meteen hoe het project ervoor staat: de fase, het eerstvolgende ' +
      'event en het laatste nieuws.',
    pro: 'Leden hoeven niet meer te mailen om te vragen hoe het ervoor staat.',
    go: 'Toon het overzicht',
    tip: 'Dit is het startscherm van een lid. Alles wat het projectteam publiceert, komt hier samen.',
  },
  {
    id: 'roadmap',
    icon: 'fa-solid fa-road',
    path: 'roadmap',
    target: '[data-tour="roadmap-active"]',
    title: 'Planning en fases',
    brief: 'De roadmap laat zien in welke fase het project zit, van initiatief tot oplevering.',
    pro: 'Iedereen kent de planning, ook wie later instapt.',
    go: 'Naar de roadmap',
    tip: 'Hier zit het project nu, met wat al af is en wat nog komt. Klik op de fase voor de details.',
  },
  {
    id: 'updates',
    icon: 'fa-solid fa-bullhorn',
    path: 'updates',
    target: '.updates-list .update-card',
    title: 'Projectnieuws',
    brief: 'Het projectteam deelt de voortgang met alle leden tegelijk, met foto\'s en reacties.',
    pro: 'Eén bericht vervangt de rondmail en de losse nieuwsbrief.',
    go: 'Naar het nieuws',
    tip: 'Een update van het projectteam. Leden lezen en reageren hier.',
  },
  {
    id: 'events',
    icon: 'fa-solid fa-calendar-check',
    path: 'events',
    target: '[data-tour="event-card"]',
    title: 'Agenda en aanmeldingen',
    brief:
      'Informatieavonden, ledenvergaderingen en bijeenkomsten van werkgroepen staan in ' +
      'de agenda. Leden melden zich direct aan.',
    pro: 'Je weet vooraf wie er komt.',
    go: 'Naar de agenda',
    tip: 'Open een event en bekijk wie er al komt.',
  },
  {
    id: 'besluiten',
    icon: 'fa-solid fa-check-to-slot',
    path: 'besluiten',
    target: '.proposal-card',
    title: 'Samen besluiten',
    brief:
      'Voorstellen, vragen en stemmen op één plek, met een vaste termijn en vooraf ' +
      'afgesproken regels.',
    pro: 'Elk besluit is vastgelegd, met de uitkomst en de opkomst.',
    go: 'Naar de besluiten',
    tip: 'Open een voorstel voor de toelichting, de vragen van leden en de stand.',
  },
  {
    id: 'dossier',
    icon: 'fa-solid fa-folder-open',
    path: 'documenten',
    target: '[data-tour="doc-tab-dossier"]',
    title: 'Projectdossier',
    brief: 'Ontwerpen, begroting en statuten: het projectdossier bewaart alles op één plek.',
    pro: 'Geen bijlagen meer die je voor de derde keer moet sturen.',
    go: 'Naar het dossier',
    tip: 'Open het projectdossier. Daar staan onder meer de begroting en de statuten.',
  },
  {
    id: 'mijn-dossier',
    icon: 'fa-solid fa-id-card',
    path: 'mijn-dossier',
    target: '.seg-tabs',
    title: 'Persoonlijk dossier',
    brief:
      'Elk lid heeft een eigen dossier: verzoeken van het projectteam, documenten om te ' +
      'tekenen en eigen stukken.',
    pro: 'Aanleveren en ondertekenen gebeurt in de app, niet per mail.',
    go: 'Naar mijn dossier',
    tip: 'Verzoeken, Tekenen en Documenten: alles wat dit lid van het projectteam krijgt, staat hier.',
  },
  {
    id: 'chat',
    icon: 'fa-solid fa-comments',
    path: 'chat',
    target: '[data-tour="chat-group"]',
    title: 'Werkgroepen en commissies',
    brief: 'Werkgroepen en commissies overleggen in de app, en het gesprek blijft bij het project.',
    pro: 'Geen losse appgroepen waar nieuwe leden niet in zitten.',
    go: 'Naar de chat',
    tip: 'Open een groepsgesprek en lees mee.',
  },
  {
    id: 'hulp',
    icon: 'fa-solid fa-headset',
    path: '',
    target: '.sc-fab',
    title: 'Vragen aan het projectteam',
    brief: 'Leden stellen hun vraag via de hulpknop. Het projectteam antwoordt vanuit het beheer.',
    pro: 'Alle vragen komen binnen in één inbox, per project.',
    go: 'Toon de hulpknop',
    tip: 'Open de chat. In de demo blijft wat je typt op je eigen scherm.',
  },
]

export const TOUR_FINISH = {
  kicker: 'Rondleiding afgerond',
  title: 'Eén plek voor het hele project',
  body:
    'Je zag het overzicht en de planning, het nieuws en de agenda, de besluitvorming, ' +
    'het project- en persoonlijk dossier, de werkgroepen en de vragen aan het projectteam. ' +
    'Benieuwd hoe dit werkt voor jouw project?',
  primary: 'Plan een demo',
  primaryPath: '/start?segment=professional',
  secondary: 'Start met buuur light',
  secondaryPath: '/start?segment=bewoner',
  tertiary: 'Verder rondkijken',
}

export const TOUR_UI = {
  label: 'Rondleiding',
  lastDone: 'Laatste stap afgerond',
  next: 'Volgende stap',
  finish: 'Afronden',
  skip: 'Overslaan',
  close: 'Sluiten',
  resume: 'Verder met de rondleiding',
  restart: 'Opnieuw beginnen',
  stop: 'Stoppen',
  fallback: 'Kijk rustig rond op deze pagina.',
}
