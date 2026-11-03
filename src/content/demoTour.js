// Teksten van de rondleiding in het demoproject (fase 1: alleen kijken).
//
// Net als content/landing.js: plat en serialiseerbaar, zodat dit later vanuit
// het CMS bewerkt kan worden.
//
// Een opdracht ("missie") bestaat uit:
//   path    route binnen het project, zonder basePath ('' = dashboard)
//   target  CSS-selector van het element dat de spotlight krijgt; de bezoeker
//           verdient de sleutel door erop te klikken
//   brief   wat er op de briefingkaart staat, vóór je op de pagina bent
//   tip     het ballonnetje bij de spotlight
//   pro     extra regel voor wie meekijkt als ontwikkelaar of procesbegeleider
//           (komt in fase 3; nu nog niet getoond)

export const TOUR_WELCOME = {
  kicker: 'Welkom in het Demoproject',
  title: 'Verzamel je sleutelbos',
  body:
    'Hier bouwen 40 huishoudens samen aan hun buurt, en jij bent net lid geworden. ' +
    'Vier korte opdrachten, vier sleutels. Daarna weet je hoe Buuur werkt.',
  duration: 'Een paar minuten',
  primary: 'Start de rondleiding',
  secondary: 'Zelf rondkijken',
}

export const TOUR_MISSIONS = [
  {
    id: 'roadmap',
    icon: 'fa-solid fa-road',
    bubble: 'periwinkle',
    path: 'roadmap',
    target: '[data-tour="roadmap-active"]',
    title: 'Waar staan we?',
    brief:
      'Elk project heeft een roadmap, van eerste schets tot sleutel. ' +
      'Zo ziet iedereen in één oogopslag in welke fase het project zit.',
    go: 'Naar de roadmap',
    tip: 'Hier zit het project nu, met wat er al af is en wat er nog komt. Klik op de fase voor je eerste sleutel.',
  },
  {
    id: 'events',
    icon: 'fa-solid fa-calendar-check',
    bubble: 'amber',
    path: 'events',
    target: '[data-tour="event-card"]',
    title: 'Kies een avond',
    brief:
      'Informatieavonden, bouwvergaderingen en een kookavond met de buren: ' +
      'alles staat in de agenda, met aanmelden erbij.',
    go: 'Naar de agenda',
    tip: 'Open een event en kijk wie er al komt.',
  },
  {
    id: 'dossier',
    icon: 'fa-solid fa-folder-open',
    bubble: 'pink',
    path: 'documenten',
    target: '[data-tour="doc-tab-dossier"]',
    title: 'Vind de begroting',
    brief:
      'Ontwerpen, begroting, statuten: het projectdossier bewaart alles op één plek. ' +
      'Geen mailbijlagen meer die je voor de derde keer opvraagt.',
    go: 'Naar het dossier',
    tip: 'Open het projectdossier. Daar staan de begroting en de statuten.',
  },
  {
    id: 'chat',
    icon: 'fa-solid fa-comments',
    bubble: 'green',
    path: 'chat',
    target: '[data-tour="chat-group"]',
    title: 'Lees mee met de bouwcommissie',
    brief:
      'Geen losse appgroepen meer. Werkgroepen en commissies praten hier, ' +
      'en alles blijft bij het project.',
    go: 'Naar de chat',
    tip: 'Open een groepsgesprek en lees mee.',
  },
]

export const TOUR_FINISH = {
  kicker: 'Sleutelbos compleet',
  title: 'Je hebt de sleutel.',
  body:
    'Je zag waar het project staat, vond een event, opende het dossier en las mee met de ' +
    'bouwcommissie. Zo werken jouw bewoners straks samen, vanaf de eerste schets.',
  primary: 'Plan een demo',
  primaryPath: '/start?segment=professional',
  secondary: 'Start met buuur light',
  secondaryPath: '/start?segment=bewoner',
  tertiary: 'Verder rondkijken',
}

export const TOUR_UI = {
  keyring: 'Rondleiding',
  earned: 'Sleutel binnen!',
  next: 'Volgende',
  skip: 'Overslaan',
  close: 'Sluiten',
  resume: 'Verder met de rondleiding',
  restart: 'Opnieuw beginnen',
  stop: 'Stoppen',
  fallback: 'Kijk rustig rond op deze pagina.',
}
