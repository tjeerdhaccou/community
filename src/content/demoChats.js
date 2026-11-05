// Voorbeeld-privégesprekken voor de klik-demo. Elke demobezoeker is een nieuw
// anoniem account, dus echte DM's met de bezoeker kunnen niet in de database
// klaarstaan. De app toont deze gesprekken alleen in een demo-project, met de
// demo-personen (naam + foto) uit dat project. Antwoorden blijft lokaal.
//
// ago = minuten geleden; 'them' is de demo-persoon, 'me' de bezoeker.

const H = 60
const D = 24 * H

export const DEMO_DM_SCRIPTS = [
  {
    unread: 1,
    messages: [
      { from: 'them', ago: 3 * H + 20, text: 'Hoi! Jij woont straks naast ons toch, kavel 7?' },
      { from: 'me', ago: 3 * H + 5, text: 'Klopt! Leuk dat je even een bericht stuurt.' },
      { from: 'them', ago: 25, text: 'We twijfelen over de kozijnen: hout of aluminium. Wat hebben jullie gekozen? Misschien kunnen we samen bij de leverancier langs.' },
    ],
  },
  {
    unread: 2,
    messages: [
      { from: 'them', ago: 1 * D + 2 * H, text: 'Zag je de vraag over de fietsenstalling op het prikbord?' },
      { from: 'me', ago: 1 * D + H, text: 'Ja, ik denk dat we beter een overdekte stalling met laadpunten kunnen voorstellen.' },
      { from: 'them', ago: 70, text: 'Eens. Zullen we samen een voorstel schrijven voor de bouwcommissie?' },
      { from: 'them', ago: 68, text: 'Ik heb al een paar voorbeelden verzameld, stuur ik je vanavond.' },
    ],
  },
  {
    unread: 0,
    messages: [
      { from: 'them', ago: 2 * D + 5 * H, text: 'Kan ik je gereedschapskist lenen voor zaterdag? Ik ga de schutting in de tijdelijke tuin opknappen.' },
      { from: 'me', ago: 2 * D + 4 * H, text: 'Natuurlijk, ik zet hem morgen bij je neer.' },
      { from: 'them', ago: 2 * D + 4 * H - 10, text: 'Top, dank je! Koffie staat klaar 😊' },
    ],
  },
  {
    unread: 0,
    messages: [
      { from: 'me', ago: 3 * D + 3 * H, text: 'Ik kan donderdag niet bij de ALV zijn. Mag ik jou een volmacht geven?' },
      { from: 'them', ago: 3 * D + 2 * H, text: 'Ja hoor. Vul het formulier in het projectdossier in, dan neem ik je stem mee.' },
      { from: 'me', ago: 3 * D + H, text: 'Gedaan, dank je wel!' },
    ],
  },
  {
    unread: 0,
    messages: [
      { from: 'them', ago: 5 * D + 6 * H, text: 'Weet jij al hoeveel zonnepanelen er op jullie dak passen?' },
      { from: 'me', ago: 5 * D + 5 * H, text: 'Volgens het DO twaalf. De installateur rekent het nog door.' },
      { from: 'them', ago: 5 * D + 4 * H, text: 'Bij ons ook twaalf. Misschien kunnen we samen inkopen, dat scheelt.' },
    ],
  },
  {
    unread: 0,
    messages: [
      { from: 'them', ago: 8 * D, text: 'Welkom bij het project! Als je vragen hebt over de planning, vraag gerust.' },
      { from: 'me', ago: 8 * D - 2 * H, text: 'Dank je! Wanneer is de volgende informatieavond?' },
      { from: 'them', ago: 8 * D - 3 * H, text: 'Volgende week dinsdag, in het buurthuis. Ik zie je daar!' },
    ],
  },
]
