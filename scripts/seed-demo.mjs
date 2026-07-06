/**
 * Seed script: populate CommonCity Demoproject with realistic mock data.
 *
 * Run: SUPABASE_URL=https://xxx.supabase.co \
 *      SUPABASE_SERVICE_ROLE_KEY=*** \
 *      node scripts/seed-demo.mjs
 *
 * The service-role key bypasses RLS — never hardcode or commit it.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    'Missing env vars. Run with:\n' +
    '  SUPABASE_URL=https://<ref>.supabase.co \\\n' +
    '  SUPABASE_SERVICE_ROLE_KEY=<service_role_key> \\\n' +
    '  node scripts/seed-demo.mjs'
  );
  process.exit(1);
}

const PROJECT_ID = '00000000-0000-4000-b000-000000000001';
const ORG_ID = '00000000-0000-4000-a000-000000000001';

const headers = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

async function api(path, method = 'GET', body) {
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${SUPABASE_URL}${path}`, opts);
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`${method} ${path}: ${r.status} ${text}`);
  }
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}

async function rpc(fn, params) {
  return api(`/rest/v1/rpc/${fn}`, 'POST', params);
}

async function upsert(table, rows) {
  return api(`/rest/v1/${table}`, 'POST', rows);
}

async function del(table, filter) {
  return api(`/rest/v1/${table}?${filter}`, 'DELETE');
}

// ─── Dutch names ────────────────────────────────────────────────
const PEOPLE = [
  { name: 'Sophie van der Berg', gender: 'f', idx: 1 },
  { name: 'Daan de Vries', gender: 'm', idx: 2 },
  { name: 'Emma Jansen', gender: 'f', idx: 3 },
  { name: 'Liam Bakker', gender: 'm', idx: 4 },
  { name: 'Julia Visser', gender: 'f', idx: 5 },
  { name: 'Sem Smit', gender: 'm', idx: 6 },
  { name: 'Tessa Meijer', gender: 'f', idx: 7 },
  { name: 'Noah de Graaf', gender: 'm', idx: 8 },
  { name: 'Fleur Mulder', gender: 'f', idx: 9 },
  { name: 'Lucas Bos', gender: 'm', idx: 10 },
  { name: 'Lotte de Jong', gender: 'f', idx: 11 },
  { name: 'Finn Hendriks', gender: 'm', idx: 12 },
  { name: 'Noor Dekker', gender: 'f', idx: 13 },
  { name: 'Jesse Dijkstra', gender: 'm', idx: 14 },
  { name: 'Iris van Dijk', gender: 'f', idx: 15 },
  { name: 'Mees Vermeer', gender: 'm', idx: 16 },
  { name: 'Eva Kok', gender: 'f', idx: 17 },
  { name: 'Ruben Peters', gender: 'm', idx: 18 },
  { name: 'Saar van Leeuwen', gender: 'f', idx: 19 },
  { name: 'Thomas Willems', gender: 'm', idx: 20 },
  { name: 'Mila Hoekstra', gender: 'f', idx: 21 },
  { name: 'Thijs Brouwer', gender: 'm', idx: 22 },
  { name: 'Lisa de Wit', gender: 'f', idx: 23 },
  { name: 'Bram van den Broek', gender: 'm', idx: 24 },
  { name: 'Anna Schouten', gender: 'f', idx: 25 },
  { name: 'Max Koning', gender: 'm', idx: 26 },
  { name: 'Rosa van der Linden', gender: 'f', idx: 27 },
  { name: 'Stijn Boer', gender: 'm', idx: 28 },
  { name: 'Fenna de Haan', gender: 'f', idx: 29 },
  { name: 'Milan Vos', gender: 'm', idx: 30 },
  { name: 'Vera Molenaar', gender: 'f', idx: 31 },
  { name: 'Jasper van Beek', gender: 'm', idx: 32 },
  { name: 'Bo Kuiper', gender: 'f', idx: 33 },
  { name: 'Lars de Boer', gender: 'm', idx: 34 },
  { name: 'Isa Scholten', gender: 'f', idx: 35 },
  { name: 'Luuk van Dam', gender: 'm', idx: 36 },
  { name: 'Nina Verhoeven', gender: 'f', idx: 37 },
  { name: 'Joep Janssen', gender: 'm', idx: 38 },
  { name: 'Yara Hermans', gender: 'f', idx: 39 },
  { name: 'Cas Peeters', gender: 'm', idx: 40 },
];

function avatarUrl(person) {
  const folder = person.gender === 'f' ? 'women' : 'men';
  return `https://randomuser.me/api/portraits/${folder}/${person.idx}.jpg`;
}

// ─── Stock images (Unsplash) ────────────────────────────────────
const STOCK = {
  community: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&h=500&fit=crop',
  architecture: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&h=500&fit=crop',
  workshop: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=500&fit=crop',
  garden: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&h=500&fit=crop',
  meeting: 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=800&h=500&fit=crop',
  construction: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&h=500&fit=crop',
  celebration: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=800&h=500&fit=crop',
  sustainability: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=800&h=500&fit=crop',
  kitchen: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=500&fit=crop',
  yoga: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&h=500&fit=crop',
  bbq: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&h=500&fit=crop',
  amsterdam: 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=800&h=500&fit=crop',
  building_model: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800&h=500&fit=crop',
  coworking: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=500&fit=crop',
  bicycle: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&h=500&fit=crop',
  solar: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800&h=500&fit=crop',
  kids: 'https://images.unsplash.com/photo-1472162072942-cd5147eb3902?w=800&h=500&fit=crop',
  dinner: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=500&fit=crop',
  park: 'https://images.unsplash.com/photo-1519331379826-f10be5486c6f?w=800&h=500&fit=crop',
  design: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800&h=500&fit=crop',
};

// ─── Helper: date offsets ───────────────────────────────────────
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}
function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}
function hoursOn(daysOffset, hour) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

// ════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════
async function main() {
  console.log('🧹 Cleaning old demo data...');

  // Delete existing demo content for this project (not real users)
  try { await del('post_reactions', `post_id=in.(select id from posts where project_id=eq.${PROJECT_ID})`); } catch {}
  try { await del('post_likes', `post_id=in.(select id from posts where project_id=eq.${PROJECT_ID})`); } catch {}
  try { await del('comments', `post_id=in.(select id from posts where project_id=eq.${PROJECT_ID})`); } catch {}
  try { await del('post_follows', `post_id=in.(select id from posts where project_id=eq.${PROJECT_ID})`); } catch {}
  try { await del('poll_votes', `option_id=in.(select id from poll_options where post_id=in.(select id from posts where project_id=eq.${PROJECT_ID}))`); } catch {}
  try { await del('poll_options', `post_id=in.(select id from posts where project_id=eq.${PROJECT_ID})`); } catch {}
  try { await del('posts', `project_id=eq.${PROJECT_ID}`); } catch {}
  try { await del('event_rsvps', `meeting_id=in.(select id from meetings where project_id=eq.${PROJECT_ID})`); } catch {}
  try { await del('decisions', `meeting_id=in.(select id from meetings where project_id=eq.${PROJECT_ID})`); } catch {}
  try { await del('meetings', `project_id=eq.${PROJECT_ID}`); } catch {}
  try { await del('update_reactions', `update_id=in.(select id from updates where project_id=eq.${PROJECT_ID})`); } catch {}
  try { await del('update_comments', `update_id=in.(select id from updates where project_id=eq.${PROJECT_ID})`); } catch {}
  try { await del('update_attachments', `update_id=in.(select id from updates where project_id=eq.${PROJECT_ID})`); } catch {}
  try { await del('updates', `project_id=eq.${PROJECT_ID}`); } catch {}
  try { await del('workgroup_members', `workgroup_id=in.(select id from workgroups where project_id=eq.${PROJECT_ID})`); } catch {}
  try { await del('workgroups', `project_id=eq.${PROJECT_ID}`); } catch {}
  try { await del('documents', `project_id=eq.${PROJECT_ID}`); } catch {}

  console.log('✅ Old data cleaned');

  // ─── Create auth users ──────────────────────────────────────
  console.log('👥 Creating 40 demo users...');
  const userIds = [];

  for (const person of PEOPLE) {
    const email = `demo-${person.name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z.]/g, '')}@demo.buuur.nl`;

    // Check if user already exists
    let existingUser;
    try {
      const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1`, {
        headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
      });
    } catch {}

    // Create user via auth admin API
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password: 'DemoUser2026!',
          email_confirm: true,
          user_metadata: { full_name: person.name },
        }),
      });
      const data = await res.json();
      if (data.id) {
        userIds.push({ id: data.id, ...person, email });
        process.stdout.write('.');
      } else if (data.msg?.includes('already been registered') || data.message?.includes('already been registered')) {
        // Find existing user by email
        const searchRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id`, {
          headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
        });
        const existing = await searchRes.json();
        if (existing.length > 0) {
          userIds.push({ id: existing[0].id, ...person, email });
          process.stdout.write('~');
        }
      } else {
        console.error('\nFailed to create user:', person.name, data);
      }
    } catch (err) {
      console.error('\nError creating user:', person.name, err.message);
    }
  }
  console.log(`\n✅ ${userIds.length} users ready`);

  // ─── Create/update profiles ─────────────────────────────────
  console.log('📝 Setting up profiles...');

  const cities = ['Amsterdam', 'Utrecht', 'Haarlem', 'Leiden', 'Den Haag', 'Amstelveen', 'Zaandam', 'Almere', 'Hilversum', 'Amersfoort'];
  const occupations = ['Ontwerper', 'Onderwijzer', 'Projectmanager', 'Marketing specialist', 'Developer', 'Verpleegkundige', 'Architect', 'Journalist', 'Consultant', 'Onderzoeker', 'Beleidsmedewerker', 'Kunstenaar', 'Musicus', 'Chef-kok', 'Psycholoog'];
  const housingTypes = ['appartement', 'eengezinswoning', 'studio', 'kamer', 'tussenwoning'];
  const housingPrefs = ['appartement', 'maisonnette', 'benedenwoning', 'bovenwoning'];

  for (let i = 0; i < userIds.length; i++) {
    const u = userIds[i];
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${u.id}`, {
        method: 'PATCH',
        headers: {
          ...headers,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          full_name: u.name,
          email: u.email,
          avatar_url: avatarUrl(u),
          city: cities[i % cities.length],
          occupation: occupations[i % occupations.length],
          current_housing_type: housingTypes[i % housingTypes.length],
          housing_preference: housingPrefs[i % housingPrefs.length],
          phone: `06-${String(12345678 + i * 111).substring(0, 8)}`,
          motivation: [
            'Ik geloof in samen wonen en samen leven. De gemeenschapszin trekt mij enorm aan.',
            'Op zoek naar een fijne, betrokken woongemeenschap waar je echt je buren kent.',
            'Het concept van collectief wonen spreekt me aan — delen waar het kan, privacy waar het moet.',
            'Ik wil graag bijdragen aan een duurzaam en sociaal woonproject.',
            'Als alleenstaande ouder zoek ik een plek waar mijn kinderen veilig kunnen opgroeien.',
            'Het idee van gedeelde ruimtes en samen koken vind ik geweldig.',
            'Ik ben al jaren op zoek naar een betaalbare woning in Amsterdam.',
            'De mix van koop en huur en de diversiteit van de bewoners trekt mij aan.',
          ][i % 8],
        }),
      });
    } catch (err) {
      console.error('Profile update failed:', u.name, err.message);
    }
  }
  console.log('✅ Profiles updated');

  // ─── Delete old memberships for demo users, keep real ones ──
  for (const u of userIds) {
    try {
      await del('memberships', `profile_id=eq.${u.id}&project_id=eq.${PROJECT_ID}`);
    } catch {}
  }

  // ─── Create memberships ─────────────────────────────────────
  console.log('🏠 Creating memberships...');

  // Role distribution: 2 admin, 3 moderator, 25 member, 5 aspirant, 3 guest, 2 professional
  const roleMap = [
    ...Array(2).fill('admin'),
    ...Array(3).fill('moderator'),
    ...Array(25).fill('member'),
    ...Array(5).fill('aspirant'),
    ...Array(3).fill('guest'),
    ...Array(2).fill('professional'),
  ];
  const funnelMap = {
    admin: 'koper',
    moderator: 'koper',
    member: null, // varied
    aspirant: 'orienterend',
    guest: 'nieuw',
    professional: 'nieuw',
  };
  const memberFunnels = ['orienterend', 'aspirant_koper', 'koper', 'koper', 'bewoner'];

  const memberships = userIds.map((u, i) => {
    const role = roleMap[i] || 'member';
    let funnel = funnelMap[role];
    if (role === 'member') funnel = memberFunnels[i % memberFunnels.length];
    return {
      profile_id: u.id,
      project_id: PROJECT_ID,
      role,
      funnel_stage: funnel,
      joined_at: daysAgo(180 - i * 4),
    };
  });

  await upsert('memberships', memberships);
  console.log('✅ Memberships created');

  // ─── Workgroups ─────────────────────────────────────────────
  console.log('👷 Creating workgroups...');

  const workgroups = [
    { id: 'a0000000-0000-4000-c000-000000000001', project_id: PROJECT_ID, name: 'Bouwcommissie', description: 'Volgt het bouwproces en adviseert over technische keuzes', type: 'commissie', icon: 'building', sort_order: 1 },
    { id: 'a0000000-0000-4000-c000-000000000002', project_id: PROJECT_ID, name: 'Duurzaamheid', description: 'Adviseert over energielabel, isolatie, zonnepanelen en circulair bouwen', type: 'commissie', icon: 'leaf', sort_order: 2 },
    { id: 'a0000000-0000-4000-c000-000000000003', project_id: PROJECT_ID, name: 'Gemeenschapsruimte', description: 'Inrichting en programmering van de gedeelde ruimtes', type: 'commissie', icon: 'users', sort_order: 3 },
    { id: 'a0000000-0000-4000-c000-000000000004', project_id: PROJECT_ID, name: 'Communicatie', description: 'Nieuwsbrief, social media en ledenwerving', type: 'commissie', icon: 'megaphone', sort_order: 4 },
    { id: 'a0000000-0000-4000-c000-000000000005', project_id: PROJECT_ID, name: 'Kopers', description: 'Alle koopgeïnteresseerden', type: 'doelgroep', icon: 'home', sort_order: 5 },
  ];
  await upsert('workgroups', workgroups);

  // Add members to workgroups
  const wgMembers = [];
  // First 8 members in Bouwcommissie
  for (let i = 0; i < 8 && i < userIds.length; i++) {
    wgMembers.push({ profile_id: userIds[i].id, workgroup_id: workgroups[0].id });
  }
  // 6 in Duurzaamheid
  for (let i = 5; i < 11 && i < userIds.length; i++) {
    wgMembers.push({ profile_id: userIds[i].id, workgroup_id: workgroups[1].id });
  }
  // 7 in Gemeenschapsruimte
  for (let i = 10; i < 17 && i < userIds.length; i++) {
    wgMembers.push({ profile_id: userIds[i].id, workgroup_id: workgroups[2].id });
  }
  // 5 in Communicatie
  for (let i = 2; i < 7 && i < userIds.length; i++) {
    wgMembers.push({ profile_id: userIds[i].id, workgroup_id: workgroups[3].id });
  }
  // 15 in Kopers
  for (let i = 0; i < 15 && i < userIds.length; i++) {
    wgMembers.push({ profile_id: userIds[i].id, workgroup_id: workgroups[4].id });
  }
  await upsert('workgroup_members', wgMembers);
  console.log('✅ Workgroups created');

  // ─── Updates (nieuws) ───────────────────────────────────────
  console.log('📰 Creating updates...');

  const updates = [
    {
      project_id: PROJECT_ID,
      author_id: userIds[0].id,
      title: 'Ontwerp gepresenteerd aan de gemeente!',
      body: 'Gisteravond hebben we het voorlopig ontwerp (VO) gepresenteerd aan de welstandscommissie van gemeente Amsterdam. De reacties waren overwegend positief! Vooral het groene binnenhof en de gedeelde daktuin vielen in de smaak.\n\nDe commissie had nog enkele suggesties over de gevelindeling aan de waterkant. Space&Matter gaat deze verwerken in de volgende iteratie. We verwachten het definitief ontwerp (DO) over 6 weken te kunnen presenteren aan alle leden.',
      tag: 'Mijlpaal',
      image_url: STOCK.building_model,
      is_public: true,
      created_at: daysAgo(3),
    },
    {
      project_id: PROJECT_ID,
      author_id: userIds[2].id,
      title: 'Terugblik ALV juni — alle besluiten op een rij',
      body: 'Afgelopen zaterdag hielden we onze halfjaarlijkse Algemene Ledenvergadering. Met 34 van de 40 leden aanwezig was het quorum ruim gehaald.\n\n**Besluiten:**\n- Het huishoudelijk reglement is unaniem aangenomen\n- Budget voor gemeenschapsruimte inrichting: €45.000\n- Werkgroep Duurzaamheid krijgt mandaat voor keuze warmtepomp\n- Volgende ALV: december 2026\n\nDe notulen zijn te vinden in het documentenarchief. Bedankt voor jullie betrokkenheid!',
      tag: 'Verslag',
      image_url: STOCK.meeting,
      is_public: false,
      created_at: daysAgo(8),
    },
    {
      project_id: PROJECT_ID,
      author_id: userIds[1].id,
      title: 'Zonnepanelen: collectieve inkoop bespaart 30%',
      body: 'Goed nieuws uit de werkgroep Duurzaamheid! Door collectief zonnepanelen in te kopen voor het hele complex besparen we circa 30% ten opzichte van individuele installatie. \n\nWe hebben offertes van drie leveranciers vergeleken en een voorkeur uitgesproken voor SolarNL, die ook ervaring heeft met CPO-projecten. In de volgende ledenvergadering leggen we het definitieve voorstel voor.',
      tag: 'Besluit',
      image_url: STOCK.solar,
      is_public: false,
      created_at: daysAgo(15),
    },
    {
      project_id: PROJECT_ID,
      author_id: userIds[0].id,
      title: 'Nieuwsbrief #12 is verstuurd',
      body: 'De nieuwsbrief van juni is verstuurd naar alle geïnteresseerden en leden. Onderwerpen dit keer:\n\n- Stand van zaken ontwerp\n- Interview met architect Marloes van Space&Matter\n- Aanmeldingen nieuwe leden\n- Save the date: zomerborrel 19 juli\n\nNiet ontvangen? Check je spamfolder of mail ons op info@demoproject.nl.',
      tag: 'Update',
      image_url: null,
      is_public: true,
      created_at: daysAgo(20),
    },
    {
      project_id: PROJECT_ID,
      author_id: userIds[4].id,
      title: 'Gemeenschapsruimte: eerste schetsen!',
      body: 'De werkgroep Gemeenschapsruimte heeft de eerste schetsen opgeleverd voor de indeling van onze 120m² gedeelde ruimte op de begane grond. Het voorstel bevat:\n\n- Een grote open keuken met kookeiland\n- Flexibele zithoek/vergaderruimte\n- Wasruimte met 4 machines\n- Gereedschapsbibliotheek\n- Kleine logeerkamer voor gasten\n\nKom naar de inloopavond op 25 juni om de plannen te bekijken en feedback te geven!',
      tag: 'Update',
      image_url: STOCK.coworking,
      is_public: false,
      created_at: daysAgo(25),
    },
    {
      project_id: PROJECT_ID,
      author_id: userIds[3].id,
      title: 'Bouwvergunning ingediend!',
      body: 'Een grote mijlpaal: vandaag is de omgevingsvergunning officieel ingediend bij de gemeente Amsterdam! 🎉\n\nHet behandeltraject duurt naar verwachting 8-12 weken. In de tussentijd gaan we door met het uitwerken van het bestek en de materiaalkeuzelijst.\n\nWe houden jullie op de hoogte van de voortgang.',
      tag: 'Mijlpaal',
      image_url: STOCK.architecture,
      is_public: true,
      created_at: daysAgo(35),
    },
    {
      project_id: PROJECT_ID,
      author_id: userIds[6].id,
      title: 'Welkom nieuwe leden — maart/april',
      body: 'We verwelkomen 6 nieuwe leden die de afgelopen twee maanden zijn toegetreden tot de vereniging:\n\n- Rosa & partner (bovenwoning, koop)\n- Milan (studio, koop)\n- Vera & Jasper (maisonnette, koop)\n- Bo (appartement, huur)\n\nWelkom! We kijken uit naar jullie bijdrage aan de gemeenschap. De eerstvolgende kennismakingsavond is op 15 juli.',
      tag: 'Update',
      image_url: STOCK.community,
      is_public: false,
      created_at: daysAgo(45),
    },
    {
      project_id: PROJECT_ID,
      author_id: userIds[1].id,
      title: 'Daktuin concept: stemming resultaten',
      body: 'De stemming over het daktuinconcept is afgerond. Met 28 stemmen is gekozen voor concept B: "Eetbare Oase" — een combinatie van moestuinbakken, fruitbomen en een gezellig terras.\n\nDe landschapsarchitect gaat dit nu uitwerken in het definitief ontwerp. De geschatte kosten voor de aanleg bedragen €35.000, wat binnen het eerder vastgestelde budget past.',
      tag: 'Besluit',
      image_url: STOCK.garden,
      is_public: false,
      created_at: daysAgo(55),
    },
  ];

  const createdUpdates = await upsert('updates', updates);
  console.log('✅ Updates created');

  // Add reactions and comments to updates
  const updateReactions = [];
  const updateComments = [];
  for (let ui = 0; ui < createdUpdates.length; ui++) {
    const upd = createdUpdates[ui];
    const emojis = ['❤️', '👍', '🎉', '🏠', '💪'];
    // 5-15 reactions per update
    const numReactions = 5 + (ui * 3) % 11;
    for (let r = 0; r < numReactions && r < userIds.length; r++) {
      updateReactions.push({
        update_id: upd.id,
        profile_id: userIds[(r + ui * 3) % userIds.length].id,
        emoji: emojis[r % emojis.length],
        created_at: daysAgo(Math.max(0, parseInt(upd.created_at) || 3) - 1),
      });
    }
  }
  try { await upsert('update_reactions', updateReactions); } catch (e) { console.log('  (some reaction dupes skipped)'); }

  // Comments on first few updates
  const updateCommentData = [
    { update_idx: 0, author_idx: 5, text: 'Super goed nieuws! Spannend dat het VO er nu ligt.' },
    { update_idx: 0, author_idx: 12, text: 'Weet iemand wanneer we het aangepaste ontwerp kunnen zien?' },
    { update_idx: 0, author_idx: 0, text: 'Over ongeveer 6 weken verwachten we het DO te presenteren. We plannen een speciale avond daarvoor!' },
    { update_idx: 1, author_idx: 8, text: 'Fijn dat het reglement erdoor is. Duidelijkheid voor iedereen.' },
    { update_idx: 1, author_idx: 15, text: 'Sterk dat er zoveel leden aanwezig waren!' },
    { update_idx: 2, author_idx: 20, text: '30% besparing is echt significant. Goed werk van de werkgroep!' },
    { update_idx: 4, author_idx: 18, text: 'Een logeerkamer, wat een goed idee! Kunnen we daar ook een slaapbank neerzetten?' },
    { update_idx: 5, author_idx: 10, text: '🎉🎉🎉 Wat een mijlpaal!' },
    { update_idx: 5, author_idx: 22, text: 'Heel spannend! Fingers crossed voor een snelle vergunning.' },
  ];

  for (const c of updateCommentData) {
    updateComments.push({
      update_id: createdUpdates[c.update_idx].id,
      author_id: userIds[c.author_idx].id,
      text: c.text,
      created_at: daysAgo(Math.max(0, 2)),
    });
  }
  await upsert('update_comments', updateComments);
  console.log('✅ Update reactions & comments added');

  // ─── Prikbord posts ─────────────────────────────────────────
  console.log('📌 Creating prikbord posts...');

  const posts = [
    {
      project_id: PROJECT_ID,
      author_id: userIds[8].id,
      text: 'Ik heb een vraag over de parkeerplaatsen. Hoeveel plekken zijn er per woning? En is er ruimte voor deelautoparkeren? Ik heb zelf geen auto maar zou het fijn vinden als er een deelauto beschikbaar is.',
      tag: 'Vraag',
      image_url: null,
      is_pinned: false,
      post_type: 'post',
      audience: 'members',
      created_at: daysAgo(1),
    },
    {
      project_id: PROJECT_ID,
      author_id: userIds[3].id,
      text: 'Wat als we een gedeelde gereedschapsbibliotheek opzetten? Niet iedereen hoeft een eigen boormachine, decoupeerzaag en stoomcleaner te hebben. We kunnen een kast in de berging inrichten waar je spullen kunt lenen. Ik heb al een hoop gereedschap dat ik wil delen!',
      tag: 'Idee',
      image_url: null,
      is_pinned: false,
      post_type: 'post',
      audience: 'members',
      created_at: daysAgo(2),
    },
    {
      project_id: PROJECT_ID,
      author_id: userIds[15].id,
      text: 'Even voorstellen! Ik ben Mees, 34 jaar, en woon momenteel in een appartement in de Pijp. Ik werk als grafisch ontwerper en ben een enorme koffieliefhebber ☕. Ik kijk er enorm naar uit om straks in een gemeenschap te wonen waar je spontaan bij de buren kunt aankloppen. Tot bij de volgende bijeenkomst!',
      tag: 'Even voorstellen',
      image_url: null,
      is_pinned: false,
      post_type: 'post',
      audience: 'members',
      created_at: daysAgo(3),
    },
    {
      project_id: PROJECT_ID,
      author_id: userIds[0].id,
      text: '📰 Ons project is vandaag in Het Parool verschenen! Een mooi artikel over collectief wonen in Amsterdam. De journalist was erg enthousiast over ons concept. Link in de comments.',
      tag: 'In de media',
      image_url: STOCK.amsterdam,
      is_pinned: true,
      post_type: 'post',
      audience: 'members',
      created_at: daysAgo(5),
    },
    {
      project_id: PROJECT_ID,
      author_id: userIds[10].id,
      text: 'Wie heeft er zin om mee te doen met een hardloopgroepje? Ik loop 3x per week een rondje door het Vondelpark en zou het leuk vinden om straks met buren te lopen. Tempo maakt niet uit, gezelligheid staat voorop! 🏃‍♀️',
      tag: 'Sociaal',
      image_url: null,
      is_pinned: false,
      post_type: 'post',
      audience: 'members',
      created_at: daysAgo(7),
    },
    {
      project_id: PROJECT_ID,
      author_id: userIds[6].id,
      text: 'Idee: laten we een maandelijks "kookavond" organiseren in de gemeenschapsruimte zodra die klaar is. Elke maand kookt een ander huishouden voor de groep. Zo leer je je buren kennen en hoef je niet elke avond zelf te koken 😄',
      tag: 'Idee',
      image_url: STOCK.dinner,
      is_pinned: false,
      post_type: 'post',
      audience: 'members',
      created_at: daysAgo(10),
    },
    {
      project_id: PROJECT_ID,
      author_id: userIds[20].id,
      text: 'Heeft iemand ervaring met collectieve energie-inkoop? Ik las dat je als VvE samen een energiecontract kunt afsluiten met flinke korting. Misschien iets voor de werkgroep Duurzaamheid om uit te zoeken?',
      tag: 'Vraag',
      image_url: null,
      is_pinned: false,
      post_type: 'post',
      audience: 'members',
      created_at: daysAgo(12),
    },
    {
      project_id: PROJECT_ID,
      author_id: userIds[4].id,
      text: 'De eerste schetsen van de gemeenschapsruimte zijn binnen! Ik ben zo enthousiast over de open keuken met kookeiland. Kom alsjeblieft naar de inloopavond om mee te denken over de indeling. Elke stem telt!',
      tag: 'Idee',
      image_url: STOCK.kitchen,
      is_pinned: false,
      post_type: 'post',
      audience: 'members',
      created_at: daysAgo(14),
    },
    {
      project_id: PROJECT_ID,
      author_id: userIds[25].id,
      text: 'Hoi allemaal! Max hier, met mijn partner net aangemeld. We wonen nu in Utrecht maar hebben altijd al in Amsterdam willen wonen. Het concept van samen bouwen en samen wonen trekt ons enorm aan. We kijken uit naar de kennismakingsavond!',
      tag: 'Even voorstellen',
      image_url: null,
      is_pinned: false,
      post_type: 'post',
      audience: 'members',
      created_at: daysAgo(16),
    },
    {
      project_id: PROJECT_ID,
      author_id: userIds[13].id,
      text: 'Vraagje over de fietsenstalling: komt er ook ruimte voor bakfietsen en e-bikes met oplaadpunten? Met twee kinderen is een bakfiets echt onmisbaar in Amsterdam.',
      tag: 'Vraag',
      image_url: STOCK.bicycle,
      is_pinned: false,
      post_type: 'post',
      audience: 'members',
      created_at: daysAgo(18),
    },
    {
      project_id: PROJECT_ID,
      author_id: userIds[2].id,
      text: 'Zaterdag 12 juli organiseren we een informele zomerborrel in het Flevopark! Neem je eigen drankje en een kleedje mee. Kinderen en huisdieren welkom. We verzamelen bij de grote eik naast de speeltuin om 15:00. Tot dan! 🌞🍻',
      tag: 'Sociaal',
      image_url: STOCK.park,
      is_pinned: false,
      post_type: 'post',
      audience: 'members',
      created_at: daysAgo(20),
    },
    {
      project_id: PROJECT_ID,
      author_id: userIds[1].id,
      text: 'Wat als we een "welkomspakket" maken voor nieuwe leden? Een mapje met alle praktische info, contactgegevens werkgroepen, huisregels en misschien een klein cadeautje. Zo voelen nieuwe leden zich meteen thuis!',
      tag: 'Idee',
      image_url: null,
      is_pinned: false,
      post_type: 'post',
      audience: 'members',
      created_at: daysAgo(22),
    },
  ];

  const createdPosts = await upsert('posts', posts);
  console.log('✅ Posts created');

  // Add comments on posts
  const postComments = [
    { post_idx: 0, author_idx: 1, text: 'Er komen 0.5 parkeerplekken per woning, dus gedeeld parkeren is het idee. Een deelauto past daar perfect bij!' },
    { post_idx: 0, author_idx: 14, text: 'Ik zou ook graag een deelauto zien. Misschien via MyWheels of Greenwheels?' },
    { post_idx: 0, author_idx: 0, text: 'We zijn in gesprek met MyWheels voor een vaste plek. Updates volgen!' },
    { post_idx: 1, author_idx: 7, text: 'Top idee! Ik heb een Kärcher hogedrukreiniger die iedereen mag lenen.' },
    { post_idx: 1, author_idx: 19, text: 'In mijn vorige wooncomplex hadden we dit ook. Werkt prima met een simpel uitleensysteem via een gedeelde app.' },
    { post_idx: 2, author_idx: 6, text: 'Welkom Mees! Ik ben ook een koffieliefhebber. We moeten snel een keer afspreken ☕' },
    { post_idx: 3, author_idx: 12, text: 'Geweldig! Wie heeft de link naar het artikel?' },
    { post_idx: 3, author_idx: 0, text: 'https://parool.nl/amsterdam/collectief-wonen — hier is ie!' },
    { post_idx: 4, author_idx: 22, text: 'Ik doe mee! Loop nu 2x per week, zou graag vaker willen.' },
    { post_idx: 4, author_idx: 30, text: 'Leuk! Ik ben een beginner maar wil het graag proberen.' },
    { post_idx: 5, author_idx: 11, text: 'Ja! Dit deden we in mijn studentenhuis ook. Was altijd super gezellig.' },
    { post_idx: 5, author_idx: 28, text: 'Ik kan Indonesisch koken, wie wil proeven? 😄' },
    { post_idx: 5, author_idx: 35, text: 'Geweldig idee. Kunnen we ook een kookclub oprichten?' },
    { post_idx: 6, author_idx: 1, text: 'Goede suggestie! Ik neem het mee naar de volgende vergadering van de werkgroep.' },
    { post_idx: 9, author_idx: 0, text: 'Ja, er komen extra brede plekken voor bakfietsen en oplaadpunten voor e-bikes. Staat in het PvE!' },
    { post_idx: 10, author_idx: 16, text: 'Leuk! Wij komen met de kids. Tot zaterdag!' },
    { post_idx: 10, author_idx: 24, text: 'Ik neem brownies mee 🍫' },
    { post_idx: 11, author_idx: 9, text: 'Mooi idee! Ik wil wel helpen met het ontwerpen van het mapje.' },
  ];

  const comments = postComments.map(c => ({
    post_id: createdPosts[c.post_idx].id,
    author_id: userIds[c.author_idx].id,
    text: c.text,
    created_at: daysAgo(Math.max(0, 1)),
  }));
  await upsert('comments', comments);

  // Add reactions to posts
  const postReactions = [];
  const emojis = ['❤️', '👍', '🎉', '😄', '💡'];
  for (let pi = 0; pi < createdPosts.length; pi++) {
    const numReactions = 3 + (pi * 5) % 15;
    for (let r = 0; r < numReactions && r < userIds.length; r++) {
      postReactions.push({
        post_id: createdPosts[pi].id,
        profile_id: userIds[(r + pi * 7) % userIds.length].id,
        emoji: emojis[(r + pi) % emojis.length],
      });
    }
  }
  try { await upsert('post_reactions', postReactions); } catch (e) { console.log('  (some reaction dupes skipped)'); }

  // Post likes
  const postLikes = [];
  for (let pi = 0; pi < createdPosts.length; pi++) {
    const numLikes = 5 + (pi * 3) % 20;
    for (let l = 0; l < numLikes && l < userIds.length; l++) {
      postLikes.push({
        post_id: createdPosts[pi].id,
        profile_id: userIds[(l + pi * 5) % userIds.length].id,
      });
    }
  }
  try { await upsert('post_likes', postLikes); } catch (e) { console.log('  (some like dupes skipped)'); }

  console.log('✅ Post comments, reactions & likes added');

  // ─── Events / Meetings ──────────────────────────────────────
  console.log('📅 Creating events...');

  const meetings = [
    {
      project_id: PROJECT_ID,
      title: 'Zomerborrel in het Flevopark',
      description: 'Informele borrel voor alle leden en geïnteresseerden. Neem je eigen drankje mee en geniet van het mooie weer! Kinderen en huisdieren welkom.',
      date: hoursOn(5, 15),
      location: 'Flevopark, bij de grote eik naast de speeltuin',
      max_attendees: 60,
      duration_hours: 3,
      event_type: 'uitje',
      visibility: 'members',
      image_url: STOCK.bbq,
      status: 'upcoming',
    },
    {
      project_id: PROJECT_ID,
      title: 'Inloopavond gemeenschapsruimte',
      description: 'Bekijk de eerste schetsen van de gemeenschapsruimte en geef je feedback. De werkgroep presenteert drie opties voor de indeling. Er is koffie en cake!',
      date: hoursOn(12, 19),
      location: 'Pakhuis de Zwijger, Piet Heinkade 179',
      max_attendees: 40,
      duration_hours: 2,
      event_type: 'workshop',
      visibility: 'members',
      image_url: STOCK.coworking,
      status: 'upcoming',
    },
    {
      project_id: PROJECT_ID,
      title: 'Kennismakingsavond nieuwe leden',
      description: 'Welkom aan alle nieuwe en geïnteresseerde leden! We vertellen over het project, de voortgang en hoe je je kunt aansluiten. Daarna is er een informeel gedeelte met drankjes.',
      date: hoursOn(20, 19),
      location: 'Grand Café de Tropen, Linnaeusstraat 2',
      max_attendees: 30,
      duration_hours: 2,
      event_type: 'kennismaking',
      visibility: 'public',
      image_url: STOCK.community,
      status: 'upcoming',
    },
    {
      project_id: PROJECT_ID,
      title: 'Workshop: Duurzaam wonen in de praktijk',
      description: 'Gastspreker Hans Vermeulen (TU Delft) vertelt over de nieuwste ontwikkelingen in duurzaam bouwen. Onderwerpen: warmtepompen, isolatie, zonnepanelen en energieopslag.',
      date: hoursOn(28, 14),
      location: 'Online (Zoom link volgt)',
      online_url: 'https://zoom.us/j/123456789',
      max_attendees: 50,
      duration_hours: 2,
      event_type: 'workshop',
      visibility: 'members',
      image_url: STOCK.sustainability,
      status: 'upcoming',
    },
    {
      project_id: PROJECT_ID,
      title: 'ALV — najaarsvergadering',
      description: 'Halfjaarlijkse Algemene Ledenvergadering. Agendapunten: financieel overzicht, voortgang bouw, bestuursverkiezing, en rondvraag. Stukken worden 2 weken vooraf gedeeld.',
      date: hoursOn(45, 10),
      location: 'Pakhuis de Zwijger, zaal 4',
      max_attendees: 50,
      duration_hours: 3,
      event_type: 'alv',
      visibility: 'members',
      image_url: STOCK.meeting,
      status: 'upcoming',
    },
    // Past events
    {
      project_id: PROJECT_ID,
      title: 'Bouwvergadering #8',
      description: 'Maandelijkse bouwvergadering met de aannemer. Besproken: funderingsplan, planning staalconstructie, keuze gevelbekleding.',
      date: hoursOn(-10, 14),
      location: 'Kantoor Bouwbedrijf de Nijs, Cruquiusweg 111',
      duration_hours: 2,
      event_type: 'bouwvergadering',
      visibility: 'members',
      image_url: STOCK.construction,
      status: 'done',
      notes: 'Fundering start september. Gevelbekleding: hout (accoya) in combinatie met stucwerk. Staalconstructie aanbesteding loopt.',
    },
    {
      project_id: PROJECT_ID,
      title: 'ALV juni — halfjaarsvergadering',
      description: 'Halfjaarlijkse ALV met goedkeuring huishoudelijk reglement en budget gemeenschapsruimte.',
      date: hoursOn(-20, 10),
      location: 'Pakhuis de Zwijger, zaal 4',
      duration_hours: 3,
      event_type: 'alv',
      visibility: 'members',
      image_url: STOCK.meeting,
      status: 'done',
      notes: 'Huishoudelijk reglement unaniem aangenomen. Budget gemeenschapsruimte vastgesteld op €45.000.',
    },
    {
      project_id: PROJECT_ID,
      title: 'Workshop bij Space&Matter',
      description: 'Atelierbezoek bij architect Space&Matter. Maquette bekeken en feedback gegeven op de plattegronden.',
      date: hoursOn(-35, 14),
      location: 'Space&Matter, NDSM-werf',
      duration_hours: 3,
      event_type: 'workshop',
      visibility: 'members',
      image_url: STOCK.design,
      status: 'done',
      notes: 'Positieve reacties op het ontwerp. Aandachtspunten: meer bergruimte, bredere gangen voor rolstoelen.',
    },
    {
      project_id: PROJECT_ID,
      title: 'Yoga in het park',
      description: 'Gratis yogales voor alle leden door onze eigen instructrice Noor. Breng je eigen matje mee!',
      date: hoursOn(-40, 9),
      location: 'Flevopark, grote grasveld',
      duration_hours: 1,
      event_type: 'uitje',
      visibility: 'members',
      image_url: STOCK.yoga,
      status: 'done',
    },
    {
      project_id: PROJECT_ID,
      title: 'Buurtborrel met omwonenden Centrumeiland',
      description: 'Kennismaking met onze toekomstige buren op Centrumeiland. Samen met twee andere CPO-projecten organiseren we een informele borrel.',
      date: hoursOn(-55, 17),
      location: 'Strandpaviljoen Blijburg',
      duration_hours: 2,
      event_type: 'uitje',
      visibility: 'public',
      image_url: STOCK.celebration,
      status: 'done',
    },
  ];

  const createdMeetings = await upsert('meetings', meetings);
  console.log('✅ Events created');

  // Add RSVPs to events
  const rsvps = [];
  for (let mi = 0; mi < createdMeetings.length; mi++) {
    const m = createdMeetings[mi];
    const numAttendees = 8 + (mi * 7) % 25;
    for (let a = 0; a < numAttendees && a < userIds.length; a++) {
      const statuses = ['going', 'going', 'going', 'maybe', 'not_going'];
      rsvps.push({
        meeting_id: m.id,
        profile_id: userIds[(a + mi * 3) % userIds.length].id,
        status: statuses[a % statuses.length],
      });
    }
  }
  try { await upsert('event_rsvps', rsvps); } catch (e) { console.log('  (some RSVP dupes skipped)'); }

  // Add decisions to past events
  const decisions = [
    { meeting_id: createdMeetings[5].id, text: 'Fundering: start september 2026' },
    { meeting_id: createdMeetings[5].id, text: 'Gevelbekleding: accoya hout + stucwerk' },
    { meeting_id: createdMeetings[6].id, text: 'Huishoudelijk reglement aangenomen' },
    { meeting_id: createdMeetings[6].id, text: 'Budget gemeenschapsruimte: €45.000' },
    { meeting_id: createdMeetings[6].id, text: 'Werkgroep Duurzaamheid krijgt mandaat warmtepomp' },
    { meeting_id: createdMeetings[7].id, text: 'Meer bergruimte in ontwerp opnemen' },
    { meeting_id: createdMeetings[7].id, text: 'Gangen verbreden voor toegankelijkheid' },
  ];
  await upsert('decisions', decisions);
  console.log('✅ RSVPs & decisions added');

  // ─── Enable all features on the project ─────────────────────
  console.log('⚙️ Updating project settings...');
  await fetch(`${SUPABASE_URL}/rest/v1/projects?id=eq.${PROJECT_ID}`, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({
      features: {
        team: true,
        board: true,
        events: true,
        members: true,
        roadmap: true,
        updates: true,
        documents: true,
        ledenwerving: true,
        page_builder: true,
      },
    }),
  });
  console.log('✅ Project features enabled');

  // ─── Summary ────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════');
  console.log('🎉 Demo data seeded successfully!');
  console.log(`   👥 ${userIds.length} members`);
  console.log(`   📌 ${createdPosts.length} prikbord posts`);
  console.log(`   📅 ${createdMeetings.length} events`);
  console.log(`   📰 ${createdUpdates.length} updates`);
  console.log(`   👷 ${workgroups.length} workgroups`);
  console.log('════════════════════════════════════════');
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
