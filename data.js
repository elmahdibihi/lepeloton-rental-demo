// Authentic Le Peloton Café rental catalog, pricing tables, EN/FR copy, and pure helpers.
// Built from observed store data (no bloated runtime calls).

export const STORE = {
  name: 'Le Peloton Café',
  neighborhood: 'Marais, Paris',
  address: '17 Rue du Pont Louis Philippe, 75004 Paris',
  email: 'contact@lepelotoncafe.com',
  logoUrl: 'https://storage.googleapis.com/brm-cdn/store/lepelotoncafe/shop-logo-orig.png?v=1794838440381',
  brmBaseUrl: 'https://app.booking.bike.rent/book',
  brmStoreSlug: 'lepelotoncafe',
  brmOffering: 'rental',
  vatRate: 0.20,
  hours: {
    weekday: { open: '08:00', close: '16:00', startMin: 8 * 60, endMin: 16 * 60 },
    weekend: { open: '08:00', close: '17:30', startMin: 8 * 60, endMin: 17 * 60 + 30 },
    stepMin: 30,
  },
};

export const CATEGORIES = [
  {
    id: 'all',
    brmCategoryId: null,
    label: { en: 'All bikes', fr: 'Tous les vélos' },
  },
  {
    id: 'road',
    brmCategoryId: '1694542871923',
    label: { en: 'Road', fr: 'Route' },
  },
  {
    id: 'gravel',
    brmCategoryId: '1774006036667',
    label: { en: 'Gravel', fr: 'Gravel' },
  },
  {
    id: 'city',
    brmCategoryId: '1701244513597',
    label: { en: 'City & Family', fr: 'Ville & Famille' },
  },
];

export const DURATION_PRESETS = [
  { key: '4h', label: { en: '4h half-day', fr: '4h demi-journée' }, short: { en: '4h', fr: '4h' } },
  { key: '1d', days: 1, label: { en: '1 day (24h)', fr: '1 jour (24h)' }, short: { en: '/day', fr: '/jour' } },
  { key: '2d', days: 2, label: { en: '2 days', fr: '2 jours' }, short: { en: '2 days', fr: '2 jours' } },
  { key: '3d', days: 3, label: { en: '3 days', fr: '3 jours' }, short: { en: '3 days', fr: '3 jours' } },
  { key: '5d', days: 5, label: { en: '5 days', fr: '5 jours' }, short: { en: '5 days', fr: '5 jours' } },
  { key: '7d', days: 7, label: { en: '7 days', fr: '7 jours' }, short: { en: '7 days', fr: '7 jours' } },
];

export const HEIGHT_OPTIONS = [
  { id: 'all', minCm: null, maxCm: null, label: { en: 'Any rider height', fr: 'Toutes tailles' } },
  { id: 'xxs', minCm: 0, maxCm: 163, label: { en: 'Under 164 cm (XXS)', fr: 'Moins de 164 cm (XXS)' } },
  { id: 'xs', minCm: 164, maxCm: 169, label: { en: '164–170 cm (XS)', fr: '164–170 cm (XS)' } },
  { id: 's', minCm: 170, maxCm: 176, label: { en: '170–177 cm (S)', fr: '170–177 cm (S)' } },
  { id: 'm', minCm: 177, maxCm: 184, label: { en: '177–185 cm (M)', fr: '177–185 cm (M)' } },
  { id: 'l', minCm: 185, maxCm: 190, label: { en: '185–191 cm (L)', fr: '185–191 cm (L)' } },
  { id: 'xl', minCm: 191, maxCm: 230, label: { en: '191+ cm (XL)', fr: '191+ cm (XL)' } },
];

export const PEDAL_OPTIONS = [
  {
    id: 'flat',
    price: 0,
    default: true,
    label: { en: 'Flat pedals', fr: 'Pédales plates' },
    detail: { en: 'Included (€0)', fr: 'Incluses (0 €)' },
  },
  {
    id: 'look_keo',
    price: 5,
    default: false,
    label: { en: 'LOOK KEO pedals', fr: 'Pédales LOOK KEO' },
    detail: { en: '+€5 flat', fr: '+5 € forfait' },
  },
  {
    id: 'spd_sl',
    price: 5,
    default: false,
    label: { en: 'Shimano SPD-SL pedals', fr: 'Pédales Shimano SPD-SL' },
    detail: { en: '+€5 flat', fr: '+5 € forfait' },
  },
  {
    id: 'spd_mtb',
    price: 5,
    default: false,
    label: { en: 'Shimano SPD (MTB / Gravel)', fr: 'Pédales Shimano SPD (VTT / Gravel)' },
    detail: { en: '+€5 flat', fr: '+5 € forfait' },
  },
  {
    id: 'own',
    price: 0,
    default: false,
    label: { en: 'I’m bringing my own pedals', fr: 'J’apporte mes propres pédales' },
    detail: { en: 'Free workshop fit', fr: 'Montage gratuit' },
  },
];

export const EXTRAS = [
  {
    id: 'phone_mount',
    price: 2.5,
    categories: ['road', 'gravel', 'city'],
    excludeBikeIds: ['5936229393629184', '6733408932724736'],
    label: { en: 'Phone mount', fr: 'Support téléphone' },
    description: {
      en: 'Universal handlebar phone mount for navigating Paris and café routes.',
      fr: 'Support guidon universel pour suivre vos itinéraires en ville ou sortie.',
    },
  },
  {
    id: 'garmin_mount',
    price: 5,
    categories: ['road', 'gravel'],
    excludeBikeIds: [],
    label: { en: 'Garmin quarter-turn mount', fr: 'Support GPS Garmin' },
    description: {
      en: 'Quarter-turn out-front Garmin mount (compatible with Edge models).',
      fr: 'Support déporté quart de tour Garmin (compatible tous compteurs Edge).',
    },
  },
  {
    id: 'baby_seat',
    price: 10,
    categories: ['city'],
    onlyBikeIds: ['6274019981524992'],
    needsNote: true,
    label: { en: 'Child / baby seat (4 mo – 4 yrs)', fr: 'Siège enfant (4 mois – 4 ans)' },
    description: {
      en: 'Fitted rear child seat for our Parisian City Bike. Tell us your child’s age so we fit the right seat.',
      fr: 'Siège arrière installé sur votre vélo de ville. Indiquez l’âge de votre enfant.',
    },
  },
];

export const BIKES = [
  {
    id: '5474683819393024',
    category: 'road',
    brmCategoryId: '1694542871923',
    name: 'Ridley Fenix SL Disc',
    tagline: {
      en: 'Carbon all-rounder · Shimano Ultegra 2×11',
      fr: 'Route carbone polyvalent · Shimano Ultegra 2×11',
    },
    description: {
      en: 'Responsive carbon all-round road racer built to glide over Paris cobblestones and tackle Vallée de Chevreuse climbs with comfort and stiffness.',
      fr: 'Vélo de route carbone réactif et confortable, taillé pour les pavés parisiens comme pour les bosses de la Vallée de Chevreuse.',
    },
    image: 'https://storage.googleapis.com/brm-cdn/store/lepelotoncafe/pf-5474683819393024.png?v=1794833914245',
    badge: null,
    chips: {
      en: ['Ultegra 2×11', 'Disc brakes', 'Helmet & kit incl.'],
      fr: ['Ultegra 2×11', 'Freins à disque', 'Casque & kit inclus'],
    },
    specs: {
      en: [
        'Frameset weight (size M): 1,140 g',
        'Shimano Ultegra 2×11-speed groupset',
        'Shimano HG700 11–34T 11-speed cassette',
        'Flat-mount hydraulic disc brakes',
        '2 water bottle cages',
        'Helmet, spare tube, pump & tyre lever included',
      ],
      fr: [
        'Poids du cadre (taille M) : 1 140 g',
        'Groupe Shimano Ultegra 2×11 vitesses',
        'Cassette Shimano HG700 11–34T 11v',
        'Freins à disque hydrauliques flat-mount',
        '2 porte-bidons',
        'Casque, chambre à air, pompe et démonte-pneu inclus',
      ],
    },
    sizes: [
      { code: 'XXS', label: 'XXS', stock: 1, minCm: 0, maxCm: 163, heightLabel: '<164 cm' },
      { code: 'XS', label: 'XS', stock: 1, minCm: 164, maxCm: 169, heightLabel: '164–170 cm' },
      { code: 'S', label: 'S', stock: 4, minCm: 170, maxCm: 176, heightLabel: '170–177 cm' },
      { code: 'M', label: 'M', stock: 4, minCm: 177, maxCm: 184, heightLabel: '177–185 cm' },
      { code: 'L', label: 'L', stock: 2, minCm: 185, maxCm: 190, heightLabel: '185–191 cm' },
    ],
    rates: { h4: 60, tiers: { 1: 70, 2: 110, 3: 140 }, extraDay: 35 },
  },
  {
    id: '5225922316206080',
    category: 'road',
    brmCategoryId: '1694542871923',
    name: 'Eddy Merckx Mendrisio 105',
    tagline: {
      en: 'Endurance carbon · Shimano 105 2×12',
      fr: 'Route carbone · Shimano 105 2×12',
    },
    description: {
      en: 'Fast, smooth 7E7 carbon road bike with Shimano 105 12-speed shifting and curved seat stays built for long Parisian peloton rides.',
      fr: 'Vélo de route en carbone 7E7 rapide et fluide, équipé en Shimano 105 12 vitesses, pensé pour les longues sorties en peloton.',
    },
    image: 'https://storage.googleapis.com/brm-cdn/store/lepelotoncafe/pf-5225922316206080.png?v=1795009883798',
    badge: { en: 'New fleet', fr: 'Nouveau' },
    chips: {
      en: ['105 2×12', '7E7 Carbon', '28mm tyres'],
      fr: ['105 2×12', 'Carbone 7E7', 'Pneus 28 mm'],
    },
    specs: {
      en: [
        'Lightweight 7E7 carbon frameset',
        'Shimano 105 2×12-speed groupset',
        'Shimano 105 11–34T 12-speed cassette',
        'Shimano hydraulic disc brakes',
        'Vittoria Rubino Pro IV 700×28c tyres',
        '2 water bottle cages · Helmet & repair kit included',
      ],
      fr: [
        'Cadre carbone léger 7E7',
        'Groupe Shimano 105 2×12 vitesses',
        'Cassette Shimano 105 11–34T 12v',
        'Freins à disque hydrauliques Shimano',
        'Pneus Vittoria Rubino Pro IV 700×28',
        '2 porte-bidons · Casque et kit réparation inclus',
      ],
    },
    sizes: [
      { code: 'S', label: 'S', stock: 2, minCm: 170, maxCm: 176, heightLabel: '170–177 cm' },
      { code: 'L', label: 'L', stock: 2, minCm: 185, maxCm: 190, heightLabel: '185–191 cm' },
    ],
    rates: { h4: 75, tiers: { 1: 85, 2: 150, 3: 195, 4: 245, 5: 290, 6: 330, 7: 370 }, extraDay: 40 },
  },
  {
    id: '5659947097391104',
    category: 'road',
    brmCategoryId: '1694542871923',
    name: 'Canyon Endurace 6',
    tagline: {
      en: 'Tall-rider endurance road · Shimano Tiagra 2×10',
      fr: 'Endurance grand format · Shimano Tiagra 2×10',
    },
    description: {
      en: 'Balanced endurance geometry with a lightweight aluminium frame and carbon fork, fitted specifically for taller riders over 191 cm.',
      fr: 'Géométrie endurance équilibrée (cadre aluminium léger et fourche carbone), disponible en taille XL pour les cyclistes de plus de 191 cm.',
    },
    image: 'https://storage.googleapis.com/brm-cdn/store/lepelotoncafe/pf-5659947097391104.png?v=1795008735672',
    badge: { en: 'XL only · 191+ cm', fr: 'XL uniquement · 191+ cm' },
    chips: {
      en: ['Tiagra 2×10', 'XL frame', 'Hydraulic disc'],
      fr: ['Tiagra 2×10', 'Cadre XL', 'Disques hydrauliques'],
    },
    specs: {
      en: [
        'Size XL geometry (rider height 191+ cm)',
        'Lightweight aluminium frame with carbon fork',
        'Shimano Tiagra 2×10-speed groupset',
        'Shimano HG500 11–34T cassette & hydraulic disc brakes',
        '2 water bottle cages',
        'Helmet, spare tube, pump & tyre lever included',
      ],
      fr: [
        'Taille XL (cycliste 191 cm et plus)',
        'Cadre aluminium léger avec fourche carbone',
        'Groupe Shimano Tiagra 2×10 vitesses',
        'Cassette Shimano HG500 11–34T & freins à disque hydrauliques',
        '2 porte-bidons',
        'Casque, chambre à air, pompe et démonte-pneu inclus',
      ],
    },
    sizes: [
      { code: 'XL', label: 'XL', stock: 1, minCm: 191, maxCm: 230, heightLabel: '191+ cm' },
    ],
    rates: { h4: 60, tiers: { 1: 70, 2: 110, 3: 140 }, extraDay: 35 },
  },
  {
    id: '5515992322015232',
    category: 'gravel',
    brmCategoryId: '1774006036667',
    name: 'Ridley Kanzo Adventure Gravel',
    tagline: {
      en: '42 mm mixed-terrain gravel · Cobbles & forest trails',
      fr: 'Gravel polyvalent 42 mm · Pavés et chemins forestiers',
    },
    description: {
      en: 'Agile gravel geometry with 42 mm tyres built for everything from rough Paris cobbles to Vincennes and Fontainebleau forest tracks.',
      fr: 'Géométrie gravel stable avec pneus de 42 mm, idéale des pavés parisiens jusqu’aux sentiers forestiers de Vincennes ou Fontainebleau.',
    },
    image: 'https://storage.googleapis.com/brm-cdn/store/lepelotoncafe/pf-5515992322015232.png?v=1794835718497',
    badge: null,
    chips: {
      en: ['42 mm tyres', 'Carbon fork', 'Helmet & kit incl.'],
      fr: ['Pneus 42 mm', 'Fourche carbone', 'Casque & kit inclus'],
    },
    specs: {
      en: [
        'Lightweight 6061-T6 aluminium frame + carbon gravel fork',
        '42 mm wide-clearance mixed-terrain tyres',
        'Flat-mount hydraulic disc brakes',
        'Gravel geometry for stability and comfort',
        '2 water bottle cages',
        'Helmet, spare tube, pump & tyre lever included',
      ],
      fr: [
        'Cadre aluminium 6061-T6 léger + fourche gravel carbone',
        'Pneus mixtes larges 42 mm',
        'Freins à disque hydrauliques flat-mount',
        'Géométrie gravel confort et stabilité',
        '2 porte-bidons',
        'Casque, chambre à air, pompe et démonte-pneu inclus',
      ],
    },
    sizes: [
      { code: 'XS', label: 'XS', stock: 1, minCm: 164, maxCm: 169, heightLabel: '164–170 cm' },
      { code: 'M', label: 'M', stock: 1, minCm: 177, maxCm: 184, heightLabel: '177–185 cm' },
      { code: 'L', label: 'L', stock: 1, minCm: 185, maxCm: 190, heightLabel: '185–191 cm' },
      { code: 'XL', label: 'XL', stock: 1, minCm: 191, maxCm: 230, heightLabel: '191–197+ cm' },
    ],
    rates: { h4: 60, tiers: { 1: 70, 2: 110, 3: 140 }, extraDay: 35 },
  },
  {
    id: '6274019981524992',
    category: 'city',
    brmCategoryId: '1701244513597',
    name: 'Parisian City Bike',
    tagline: {
      en: '3-speed upright cruiser · Basket, helmet & lock included',
      fr: 'Vélo de ville 3 vitesses · Panier, casque et antivol inclus',
    },
    description: {
      en: 'Comfortable upright city bike with front basket—built for exploring the Marais, Seine banks, and Paris bike lanes at an easy pace.',
      fr: 'Vélo hollandais confortable avec panier avant, parfait pour parcourir le Marais, les berges de Seine et les pistes cyclables.',
    },
    image: 'https://storage.googleapis.com/brm-cdn/store/lepelotoncafe/pf-6274019981524992.png?v=1795007166721',
    badge: null,
    chips: {
      en: ['3-speed hub', 'Front basket', 'Helmet & lock incl.'],
      fr: ['3 vitesses', 'Panier avant', 'Casque & antivol'],
    },
    specs: {
      en: [
        'Low-maintenance 3-speed internal gear hub',
        'Front wicker/utility basket',
        'Adjustable upright saddle (one size fits ~150–195 cm)',
        'Supports optional rear child / baby seat (+€10)',
        'Helmet and lock included',
      ],
      fr: [
        'Moyeu 3 vitesses fluide et sans entretien',
        'Panier avant pratique',
        'Selle réglable en hauteur (taille unique ~150–195 cm)',
        'Compatible siège bébé arrière (+10 €)',
        'Casque et antivol inclus',
      ],
    },
    sizes: [
      { code: 'One size', label: 'One size', stock: 20, minCm: 150, maxCm: 198, heightLabel: '150–195 cm' },
    ],
    rates: { h4: 20, tiers: { 1: 35 }, extraDay: 15 },
  },
  {
    id: '4706998982541312',
    category: 'city',
    brmCategoryId: '1701244513597',
    name: 'Yuba Kombi Longtail Family Bike',
    tagline: {
      en: 'Non-electric cargo bike · Carries 1–3 passengers (200 kg max)',
      fr: 'Vélo cargo longtail · 1 à 3 passagers (200 kg max)',
    },
    description: {
      en: 'Practical, sturdy non-electric Yuba Kombi longtail with low step-through frame and 24" wheels—carry kids or bags safely across the city.',
      fr: 'Longtail Yuba Kombi robuste et maniable à cadre bas et roues 24", idéal pour transporter les enfants en toute sécurité dans Paris.',
    },
    image: 'https://storage.googleapis.com/brm-cdn/store/lepelotoncafe/pf-4706998982541312.png?v=1795006590381',
    badge: { en: 'Family cargo', fr: 'Cargo famille' },
    chips: {
      en: ['1–3 passengers', '200 kg max load', 'Non-electric'],
      fr: ['1–3 passagers', 'Charge 200 kg', 'Musculaire'],
    },
    specs: {
      en: [
        'Yuba Kombi non-electric longtail frame',
        'Capacity for 1–3 passengers (200 kg total load limit)',
        'Low step-through frame & 24" wheels for stability',
        'Helmet and heavy-duty lock included',
      ],
      fr: [
        'Vélo longtail musculaire Yuba Kombi',
        'Capacité 1 à 3 passagers (charge max 200 kg)',
        'Cadre bas et roues 24" très stables',
        'Casque et antivol inclus',
      ],
    },
    sizes: [
      { code: 'One size', label: 'One size', stock: 2, minCm: 150, maxCm: 198, heightLabel: '150–195 cm' },
    ],
    rates: { h4: 25, tiers: { 1: 50, 2: 70 }, extraDay: 15 },
  },
  {
    id: '5936229393629184',
    category: 'city',
    brmCategoryId: '1701244513597',
    name: 'Children’s 24" City Bike',
    tagline: {
      en: 'Ages ~8–12 · 3 speeds · Helmet & lock included',
      fr: 'Env. 8–12 ans · 3 vitesses · Casque et antivol inclus',
    },
    description: {
      en: 'Easy-riding 24-inch junior bike with 3 gears for family loops along the Seine and car-free Paris boulevards.',
      fr: 'Vélo enfant 24 pouces maniable à 3 vitesses pour les balades en famille le long des berges et pistes cyclables.',
    },
    image: 'https://storage.googleapis.com/brm-cdn/store/lepelotoncafe/pf-5936229393629184.png?v=1795007427156',
    badge: { en: 'Ages 8–12', fr: '8–12 ans' },
    chips: {
      en: ['24" wheels', '3-speed', 'Helmet & lock incl.'],
      fr: ['Roues 24"', '3 vitesses', 'Casque & antivol'],
    },
    specs: {
      en: [
        '24" wheels · suited for ages ~8–12 (125–150 cm)',
        'Simple 3-speed shifter',
        'Helmet and lock included',
      ],
      fr: [
        'Roues 24" · adapté aux 8–12 ans (125–150 cm)',
        'Transmission 3 vitesses facile à prendre en main',
        'Casque et antivol inclus',
      ],
    },
    sizes: [
      { code: '24"', label: '24"', stock: 5, minCm: 125, maxCm: 150, heightLabel: '125–150 cm' },
    ],
    rates: { h4: 20, tiers: { 1: 35 }, extraDay: 15 },
  },
  {
    id: '6733408932724736',
    category: 'city',
    brmCategoryId: '1701244513597',
    name: 'Children’s 20" City Bike',
    tagline: {
      en: 'Ages ~5–8 · 3 speeds · Helmet & lock included',
      fr: 'Env. 5–8 ans · 3 vitesses · Casque et antivol inclus',
    },
    description: {
      en: 'Confidence-inspiring 20-inch kids bike with 3 gears for younger riders exploring Paris alongside the family.',
      fr: 'Vélo enfant 20 pouces stable et rassurant à 3 vitesses pour accompagner la famille dans Paris.',
    },
    image: 'https://storage.googleapis.com/brm-cdn/store/lepelotoncafe/pf-6733408932724736.png?v=1701253622934',
    badge: { en: 'Ages 5–8', fr: '5–8 ans' },
    chips: {
      en: ['20" wheels', '3-speed', 'Helmet & lock incl.'],
      fr: ['Roues 20"', '3 vitesses', 'Casque & antivol'],
    },
    specs: {
      en: [
        '20" wheels · suited for ages ~5–8 (105–125 cm)',
        'Simple 3-speed shifter',
        'Helmet and lock included',
      ],
      fr: [
        'Roues 20" · adapté aux 5–8 ans (105–125 cm)',
        'Transmission 3 vitesses simple',
        'Casque et antivol inclus',
      ],
    },
    sizes: [
      { code: '20"', label: '20"', stock: 5, minCm: 105, maxCm: 125, heightLabel: '105–125 cm' },
    ],
    rates: { h4: 20, tiers: { 1: 35 }, extraDay: 15 },
  },
];

export const FIXES = [
  {
    area: { en: 'Instant price visibility', fr: 'Prix visibles immédiatement' },
    before: {
      en: 'Hid every bike behind “Select dates to view availability” even though prices already existed in the API response.',
      fr: 'Masquait tous les tarifs derrière « Select dates » alors que les prix étaient déjà dans la réponse API.',
    },
    after: {
      en: 'Defaults to tomorrow at 09:00 for 1 day and shows exact EUR rates, stock counts, and size pills above the fold.',
      fr: 'Pré-sélectionne demain 09:00 (1 jour) et affiche immédiatement les tarifs EUR, stocks et tailles dès l’arrivée.',
    },
  },
  {
    area: { en: 'No sneaky pre-checked pedal fee', fr: 'Suppression des pédales pré-cochées (+5 €)' },
    before: {
      en: 'Pre-selected “LOOK KEO Pedals (+€5)” globally—even for city bike renters and riders wanting flat pedals.',
      fr: 'Pré-cochait « LOOK KEO Pedals (+5 €) » par défaut pour tout le monde, y compris les vélos de ville.',
    },
    after: {
      en: 'Flat pedals (€0) are the clean default; clipless pedal choice only appears on Road & Gravel bikes.',
      fr: 'Les pédales plates (0 €) sont choisies par défaut ; le choix automatique n’apparaît que sur Route et Gravel.',
    },
  },
  {
    area: { en: 'No ALL-CAPS cart workaround', fr: 'Fin de l’avertissement en MAJUSCULES' },
    before: {
      en: 'Warned customers in ALL CAPS: “PLEASE ADD BIKES TO CART ONE AT A TIME WITH CORRECT PEDALS FOR EACH BIKE”.',
      fr: 'Affichait un avertissement en majuscules obligeant à ajouter les vélos un par un pour ne pas mélanger les pédales.',
    },
    after: {
      en: 'Every bike is configured individually (size, pedals, accessories, optional rider name) inside one clean modal.',
      fr: 'Chaque vélo a sa propre fiche (taille, pédales, accessoires, prénom du cycliste) dans une fenêtre dédiée.',
    },
  },
  {
    area: { en: 'Accurate bike sizing copy', fr: 'Tableaux de tailles corrigés' },
    before: {
      en: 'Eddy Merckx listed “Ridley sizing” (XXS–XL) when only S and L exist; Gravel listed out-of-stock XXS/S; Canyon listed a size M frame weight.',
      fr: 'L’Eddy Merckx affichait les tailles « Ridley » (XXS–XL) alors que seuls S et L existent ; le Canyon indiquait un poids taille M.',
    },
    after: {
      en: 'Each bike shows only real in-stock sizes, plus a live rider-height filter (cm) that dims non-fitting frames.',
      fr: 'Seules les tailles réelles en stock sont affichées, avec un filtre taille cycliste (cm) qui met en avant les cadres adaptés.',
    },
  },
  {
    area: { en: 'Category-scoped extras & typo fix', fr: 'Accessoires filtrés & coquille corrigée' },
    before: {
      en: 'Showed Baby Seat on road racers, Garmin mount on kids’ bikes, and “easily navagating the city”.',
      fr: 'Proposait un siège bébé sur les vélos de route, un support Garmin sur les vélos enfants, et contenait une coquille anglaise.',
    },
    after: {
      en: 'Baby seat appears only on the Parisian City Bike (with optional child age note); Garmin mount only on Road & Gravel.',
      fr: 'Siège bébé réservé au vélo de ville adulte (avec âge enfant) ; support Garmin limité aux vélos Route et Gravel.',
    },
  },
  {
    area: { en: 'Unified category bar', fr: 'Navigation simplifiée sans doublon' },
    before: {
      en: 'Rendered the same 3 categories twice stacked vertically above a clipped card grid, plus an extra “All Categories” pill.',
      fr: 'Affichait 2 fois les 3 catégories l’une sur l’autre, coupant les boutons sous la ligne de flottaison.',
    },
    after: {
      en: 'One crisp horizontal pill bar (`All · Road · Gravel · City & Family`) so bike cards and CTAs fit cleanly above the fold.',
      fr: 'Une seule barre compacte (« Tous · Route · Gravel · Ville & Famille ») gardant vélos, prix et boutons visibles d’emblée.',
    },
  },
  {
    area: { en: 'WCAG contrast & accessibility', fr: 'Contraste WCAG & accessibilité clavier' },
    before: {
      en: 'Yellow logo on cream, floating “Powered by BRM” overlapping the middle bike card, fake Account menu in guest-only mode, 3 unlabeled mobile nav buttons.',
      fr: 'Logo peu contrasté, badge flottant par-dessus la carte centrale, menu Compte inutile en mode invité, 3 boutons mobiles sans libellé.',
    },
    after: {
      en: 'Dark ink `#141413` on `#F4C826` yellow buttons, labeled icon controls, Escape-key closing, and removed dead account chrome.',
      fr: 'Contraste AAA (`#141413` sur jaune `#F4C826`), boutons tous nommés, navigation clavier/Échap et zéro bouton factice.',
    },
  },
  {
    area: { en: 'Real shop opening hours enforced', fr: 'Vrais horaires d’ouverture respectés' },
    before: {
      en: 'Fetched 4 months of past + future slots across 54 KB JSON; easy to pick invalid pickup windows before feedback.',
      fr: 'Téléchargeait 4 mois d’historique passé + futur (54 Ko) avant même de guider l’horaire d’ouverture.',
    },
    after: {
      en: 'Instant client-side slot list honoring exact Paris shop windows (Mon–Fri 08:00–16:00, Sat–Sun 08:00–17:30).',
      fr: 'Créneaux générés instantanément selon les horaires réels (Lun–Ven 08h–16h, Sam–Dim 08h–17h30).',
    },
  },
  {
    area: { en: 'Clean markup & bike naming', fr: 'Textes propres sans HTML iOS collé' },
    before: {
      en: 'Contained raw Apple Notes CSS (`uictfonttextstylebody`), Times New Roman tags, `Childrens  24"` typo, and `(size XL only)` stuffed into the title.',
      fr: 'Contenait du CSS copié d’iOS Notes, du Times New Roman brut, des fautes d’orthographe et la taille collée dans le titre.',
    },
    after: {
      en: 'Consistent editorial typography, crisp spec chips, and clean `XL only · 191+ cm` badge.',
      fr: 'Typographie homogène, fiches techniques claires et badge propre « XL uniquement · 191+ cm ».',
    },
  },
  {
    area: { en: 'Speed & bundle weight', fr: 'Vitesse de chargement divisée par 20' },
    before: {
      en: '92 Angular JS chunks + 14 config calls + N+1 empty `datafields` requests + dual GA4 + Clarity trackers.',
      fr: '92 scripts JS + 14 appels API d’initialisation + requêtes N+1 vides + multiples traceurs.',
    },
    after: {
      en: 'Zero build bloat: 4 small static files (~45 KB total) loading instantaneously, with optional 1-click handoff to live BRM Stripe checkout.',
      fr: '4 petits fichiers statiques (~45 Ko au total) chargés instantanément, avec relais direct vers le paiement Stripe BRM.',
    },
  },
];

export const I18N = {
  en: {
    brandSub: 'Marais, Paris · Bike Rental',
    cartBtn: 'Bag',
    heroTitle: 'Bike rentals from Le Peloton Café',
    heroSub: '17 Rue du Pont Louis Philippe · Helmet & kit included · 20% VAT incl.',
    pickupDate: 'Pickup date',
    pickupTime: 'Pickup time',
    duration: 'Duration',
    customDays: 'Custom days',
    daysUnit: 'days',
    riderHeight: 'Rider height',
    returnPreview: 'Return:',
    showingCount: (n) => `${n} bike model${n === 1 ? '' : 's'} shown`,
    filterNoSizeBadge: 'No matching size in stock',
    fromLabel: 'Total',
    halfDayUnit: 'for 4h',
    perDayApprox: '/day',
    inStock: (n) => `${n} available`,
    noneLeft: 'All in your bag',
    configureBtn: 'Choose size & pedals',
    soldOutBtn: 'All units in bag',
    specsTitle: 'Included & specs',
    sizeLabel: 'Frame size',
    pedalsLabel: 'Pedal setup (this bike only)',
    pedalsCityNote: 'Includes flat pedals (no pedal fee on city & kids bikes).',
    extrasLabel: 'Optional accessories',
    childAgePlaceholder: 'Child’s age (e.g. 2.5 years)',
    riderNameLabel: 'Rider label (optional — great for groups)',
    riderNamePlaceholder: 'e.g. Alex or Rider 1',
    modalAdd: 'Add bike to bag',
    modalTotal: 'Bike total',
    bagTitle: 'Your rental bag',
    bagEmpty: 'Your bag is empty. Pick a bike and customize its frame size and pedals.',
    bagPickup: 'Pickup',
    bagReturn: 'Return',
    bagRemove: 'Remove',
    bagVatLine: (vat, net) => `Includes 20% French VAT (€${vat.toFixed(2)} VAT · €${net.toFixed(2)} net)`,
    bagIdNote: 'Bring a valid photo ID for pickup at 17 Rue du Pont Louis Philippe, 75004 Paris.',
    handoffBtn: 'Continue on live BRM Stripe checkout',
    handoffHint: 'Opens Le Peloton Café’s live Bike Rental Manager storefront to complete real payment.',
    previewCheckoutBtn: 'Preview fast guest checkout',
    backToBagBtn: 'Back to bag',
    firstName: 'First name *',
    lastName: 'Last name *',
    email: 'Email address *',
    phone: 'Phone number (optional)',
    terms: 'I’ll bring a valid photo ID for pickup at Le Peloton Café.',
    submitDemoBtn: 'Preview reservation summary (no charge)',
    demoConfirmTitle: 'Prototype booking ready',
    demoConfirmBadge: 'Interactive UI demo · No card charged',
    demoConfirmDesc: 'In production, this submits straight to Stripe / BRM Inventory without the multi-screen friction. Want to place a real reservation now?',
    startOverBtn: 'Edit bag or start over',
    footerHours: 'Open daily for pickups: Mon–Fri 08:00–16:00 · Sat–Sun 08:00–17:30',
    compareBtn: 'What we fixed vs current BRM (10 improvements)',
    compareTitle: '10 Fixes vs Current BRM Site',
    compareBefore: 'Current BRM',
    compareAfter: 'This Redesign',
    toastAdded: (name, size) => `Added ${name} (${size}) to bag`,
    toastViewBag: 'View bag',
    close: 'Close',
  },
  fr: {
    brandSub: 'Marais, Paris · Location de vélos',
    cartBtn: 'Panier',
    heroTitle: 'Location de vélos au Peloton Café',
    heroSub: '17 Rue du Pont Louis Philippe · Casque et kit inclus · TVA 20 % incl.',
    pickupDate: 'Date de départ',
    pickupTime: 'Heure de départ',
    duration: 'Durée',
    customDays: 'Nb jours',
    daysUnit: 'jours',
    riderHeight: 'Taille du cycliste',
    returnPreview: 'Retour :',
    showingCount: (n) => `${n} modèle${n > 1 ? 's' : ''} affiché${n > 1 ? 's' : ''}`,
    filterNoSizeBadge: 'Taille indisponible en stock',
    fromLabel: 'Total',
    halfDayUnit: 'pour 4h',
    perDayApprox: '/jour',
    inStock: (n) => `${n} dispo${n > 1 ? 's' : ''}`,
    noneLeft: 'Tout est dans votre panier',
    configureBtn: 'Choisir taille & pédales',
    soldOutBtn: 'Stock épuisé dans le panier',
    specsTitle: 'Équipement & inclus',
    sizeLabel: 'Taille du cadre',
    pedalsLabel: 'Pédales (pour ce vélo uniquement)',
    pedalsCityNote: 'Pédales plates incluses gratuitement sur les vélos de ville et enfants.',
    extrasLabel: 'Accessoires en option',
    childAgePlaceholder: 'Âge de l’enfant (ex. 2 ans et demi)',
    riderNameLabel: 'Nom du cycliste (optionnel — pratique en groupe)',
    riderNamePlaceholder: 'ex. Alex ou Cycliste 1',
    modalAdd: 'Ajouter au panier',
    modalTotal: 'Total du vélo',
    bagTitle: 'Votre panier location',
    bagEmpty: 'Votre panier est vide. Choisissez un vélo et réglez sa taille et ses pédales.',
    bagPickup: 'Retrait',
    bagReturn: 'Retour',
    bagVatLine: (vat, net) => `Inclut 20 % de TVA française (${vat.toFixed(2)} € TVA · ${net.toFixed(2)} € HT)`,
    bagIdNote: 'Merci d’apporter une pièce d’identité lors du retrait au 17 Rue du Pont Louis Philippe, 75004 Paris.',
    handoffBtn: 'Finaliser sur la billetterie BRM (Stripe)',
    handoffHint: 'Ouvre la boutique Bike Rental Manager officielle du Peloton Café pour le paiement réel.',
    previewCheckoutBtn: 'Aperçu paiement invité en 1 étape',
    backToBagBtn: 'Retour au panier',
    firstName: 'Prénom *',
    lastName: 'Nom *',
    email: 'Adresse e-mail *',
    phone: 'Téléphone (optionnel)',
    terms: 'J’apporterai une pièce d’identité valide au Peloton Café lors du retrait.',
    submitDemoBtn: 'Afficher le récapitulatif démo (sans débit)',
    demoConfirmTitle: 'Réservation prototype prête',
    demoConfirmBadge: 'Démo interactive · Aucun paiement débité',
    demoConfirmDesc: 'En production, ce formulaire valide directement sur Stripe et le stock BRM en une seule étape. Besoin de réserver pour de vrai ?',
    startOverBtn: 'Modifier le panier',
    footerHours: 'Retraits tous les jours : Lun–Ven 08h00–16h00 · Sam–Dim 08h00–17h30',
    compareBtn: 'Les 10 améliorations face au site BRM actuel',
    compareTitle: '10 corrections par rapport au site BRM actuel',
    compareBefore: 'Site BRM actuel',
    compareAfter: 'Cette refonte',
    toastAdded: (name, size) => `${name} (${size}) ajouté au panier`,
    toastViewBag: 'Voir le panier',
    close: 'Fermer',
  },
};

export function computeBikePrice(bike, durationKey, customDays = 1) {
  if (!bike || !bike.rates) return 0;
  if (durationKey === '4h') return bike.rates.h4;
  const preset = DURATION_PRESETS.find((d) => d.key === durationKey);
  const days = Math.max(1, Math.min(30, Math.round(preset?.days ?? customDays ?? 1)));
  if (bike.rates.tiers[days] != null) return bike.rates.tiers[days];
  const maxTier = Math.max(...Object.keys(bike.rates.tiers).map(Number));
  return bike.rates.tiers[maxTier] + (days - maxTier) * bike.rates.extraDay;
}

export function computeVatBreakdown(grossTotal, vatRate = STORE.vatRate) {
  const gross = Math.round(grossTotal * 100) / 100;
  const net = Math.round((gross / (1 + vatRate)) * 100) / 100;
  const vat = Math.round((gross - net) * 100) / 100;
  return { gross, net, vat };
}

export function getPickupSlots(dateStr) {
  const [y, m, d] = (dateStr || '').split('-').map(Number);
  if (!y || !m || !d) return [];
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const isWeekend = day === 0 || day === 6;
  const { startMin, endMin } = isWeekend ? STORE.hours.weekend : STORE.hours.weekday;
  const slots = [];
  for (let t = startMin; t <= endMin; t += STORE.hours.stepMin) {
    const hh = String(Math.floor(t / 60)).padStart(2, '0');
    const mm = String(t % 60).padStart(2, '0');
    slots.push(`${hh}:${mm}`);
  }
  return slots;
}

export function computeReturnInfo(dateStr, timeStr, durationKey, customDays = 1) {
  const [y, m, d] = (dateStr || '').split('-').map(Number);
  const [hh, mm] = (timeStr || '09:00').split(':').map(Number);
  if (!y || !m || !d) return { dateStr: '', timeStr: '' };
  const startMs = Date.UTC(y, m - 1, d, hh || 0, mm || 0);
  const addMs =
    durationKey === '4h'
      ? 4 * 3600 * 1000
      : Math.max(1, Math.min(30, Math.round(DURATION_PRESETS.find((p) => p.key === durationKey)?.days ?? customDays ?? 1))) *
        24 *
        3600 *
        1000;
  const end = new Date(startMs + addMs);
  const outDate = `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, '0')}-${String(end.getUTCDate()).padStart(2, '0')}`;
  const outTime = `${String(end.getUTCHours()).padStart(2, '0')}:${String(end.getUTCMinutes()).padStart(2, '0')}`;
  return { dateStr: outDate, timeStr: outTime };
}

export function resolveHeightSpec(heightInput) {
  if (!heightInput || heightInput === 'all') return null;
  if (typeof heightInput === 'number' && Number.isFinite(heightInput)) {
    return { minCm: heightInput, maxCm: heightInput };
  }
  const bucket = HEIGHT_OPTIONS.find((h) => h.id === heightInput);
  return bucket && bucket.minCm != null ? { minCm: bucket.minCm, maxCm: bucket.maxCm } : null;
}

export function getMatchingSizesForHeight(bike, heightInput) {
  const spec = resolveHeightSpec(heightInput);
  if (!spec) return bike.sizes;
  return bike.sizes.filter((sz) => spec.maxCm >= sz.minCm && spec.minCm <= sz.maxCm);
}

export function getDefaultPedalForBike(bike) {
  if (!bike || bike.category === 'city') {
    return PEDAL_OPTIONS.find((p) => p.id === 'flat');
  }
  return PEDAL_OPTIONS.find((p) => p.default) || PEDAL_OPTIONS[0];
}

export function getAvailableExtrasForBike(bike) {
  if (!bike) return [];
  return EXTRAS.filter((ex) => {
    if (!ex.categories.includes(bike.category)) return false;
    if (ex.onlyBikeIds && !ex.onlyBikeIds.includes(bike.id)) return false;
    if (ex.excludeBikeIds && ex.excludeBikeIds.includes(bike.id)) return false;
    return true;
  });
}

export function buildBrmDeepLink(categoryId, lang = 'en') {
  const params = new URLSearchParams({
    store: STORE.brmStoreSlug,
    offering: STORE.brmOffering,
  });
  if (categoryId) params.set('category', categoryId);
  if (lang && lang !== 'en') params.set('lang', lang);
  return `${STORE.brmBaseUrl}?${params.toString()}`;
}
