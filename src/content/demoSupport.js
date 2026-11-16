// Voorbeeldgesprek voor de hulpknop (support-chat) in de klik-demo. De
// demobezoeker heeft geen echt gesprek met support, en schrijven naar de
// database mag in de demo niet. Daarom laat de knop dit gesprek zien en blijft
// alles wat de bezoeker typt lokaal, op zijn eigen scherm.
//
// Net als demoTour.js en demoChats.js: plat en serialiseerbaar, zodat dit later
// vanuit het CMS bewerkt kan worden.
//
// ago = minuten geleden; 'me' is de bezoeker, 'support' het projectteam.

const H = 60
const D = 24 * H

export const DEMO_SUPPORT = {
  note: 'Voorbeeld: zo stellen leden hun vraag aan het projectteam. In de demo blijft alles op je eigen scherm.',
  unread: 1,
  messages: [
    { from: 'me', ago: 1 * D + 3 * H, text: 'Hoi! Mijn partner wil ook graag meelezen in het project. Hoe regelen we dat?' },
    { from: 'support', ago: 1 * D + 2 * H, text: 'Leuk dat jullie er samen in zitten! Stuur ons het e-mailadres van je partner, dan zetten we een uitnodiging klaar.' },
  ],
  // Automatisch antwoord op wat de bezoeker zelf typt.
  firstReply:
    'Dank je voor je bericht! In de demo komt het nergens aan. In je eigen project leest ' +
    'het projectteam je vraag in het beheer en antwoordt hier. Heb je de app dan dicht, ' +
    'dan krijg je een mail.',
  nextReply: 'In de demo blijft dit op je scherm. In je eigen project komt het bij het projectteam aan.',
}
