export const STORE = {
  name: 'Le Peloton Café',
  neighborhood: 'Le Marais, Paris',
  street: '17 Rue du Pont Louis-Philippe',
  address: '17 Rue du Pont Louis-Philippe, 75004 Paris',
  email: 'contact@lepelotoncafe.com',
  logoLightUrl: './assets/img/peloton-neon.png',
  logoDarkUrl: './assets/img/peloton-wordmark.png',
  heroImage: './assets/img/hero-rides.jpg',
  clubhouseDetailImage: './assets/img/shifter-detail.jpg',
  clubhouseFamilyImage: './assets/img/story-family.jpg',
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

export const STORY_CHAPTERS = [
  {
    id: 'espresso',
    time: { en: 'Since 2015 · Our story', fr: 'Depuis 2015 · Notre histoire' },
    title: {
      en: 'Born from ten years of Bike About Tours.',
      fr: 'Né de dix ans avec Bike About Tours.',
    },
    body: {
      en: 'Christian Osburn & Paul Barron opened Le Peloton Café in 2015 to bring coffee, cycling, and community to central Paris—serving Paris roasters Belleville, Ambicion, Plural, and Coutume in a dog-friendly Marais hub.',
      fr: 'Après dix ans de visites avec Bike About Tours, Christian Osburn et Paul Barron ont ouvert Le Peloton Café en 2015—avec les torréfacteurs parisiens Belleville, Ambicion, Plural et Coutume dans un café chaleureux et dog-friendly.',
    },
    image: './assets/img/story-coffee.jpg',
    alt: {
      en: 'Barista pulling espresso inside Le Peloton Café',
      fr: 'Barista préparant un espresso au Peloton Café',
    },
  },
  {
    id: 'cobbles',
    time: { en: 'Bike rentals · Road & Gravel', fr: 'Locations · Route & Gravel' },
    title: {
      en: 'From Paris cobbles to surrounding climbs.',
      fr: 'Des pavés parisiens aux côtes alentour.',
    },
    body: {
      en: 'Ridley Fenix carbon, Eddy Merckx 105, Canyon Endurace, and 42 mm Kanzo gravel bikes for exploring the Paris region. All road rentals come with flat pedals, with Shimano SPD-SL, SPD, and LOOK KEO available.',
      fr: 'Ridley Fenix carbone, Eddy Merckx 105, Canyon Endurace et gravel Kanzo 42 mm pour explorer la région parisienne. Pédales plates incluses, ou montage Shimano SPD-SL, SPD et LOOK KEO.',
    },
    image: './assets/img/story-cobbles.jpg',
    alt: {
      en: 'Road cyclist on Marais cobblestones outside Le Peloton Café',
      fr: 'Cycliste sur les pavés du Marais devant Le Peloton Café',
    },
  },
  {
    id: 'club',
    time: { en: 'Cycling Club · 40–100 km', fr: 'Cycling Club · 40–100 km' },
    title: {
      en: 'Weekly group rides for every pace.',
      fr: 'Sorties hebdomadaires pour chaque allure.',
    },
    body: {
      en: 'Join Le Peloton’s international riding community across Mild (18–21 km/h), Medium (22–25 km/h), and Spicy (26–29 km/h) road and gravel rides—or book a private guided ride on a fitted Ridley Fenix.',
      fr: 'Rejoignez la communauté internationale du Peloton sur nos sorties Mild (18–21 km/h), Medium (22–25 km/h) et Spicy (26–29 km/h), ou réservez une sortie guidée privée sur Ridley Fenix.',
    },
    image: './assets/img/story-ridley.jpg',
    alt: {
      en: 'Ridley Fenix SL Disc road bike on open tarmac',
      fr: 'Ridley Fenix SL Disc sur la route',
    },
  },
  {
    id: 'tours',
    time: { en: 'Bike About Tours · City & Family', fr: 'Bike About Tours · Ville & Famille' },
    title: {
      en: 'Charming streets, bike lanes, and long riversides.',
      fr: 'Rues pavées, pistes cyclables et berges de Seine.',
    },
    body: {
      en: 'In partnership with our sister company Bike About Tours, explore Paris at a leisurely pace on a 3-speed city bike or Yuba Kombi family longtail—or join small-group Hidden Paris, Monuments, and Versailles tours.',
      fr: 'En partenariat avec Bike About Tours, découvrez Paris tranquillement en vélo de ville 3 vitesses ou longtail famille Yuba Kombi—ou rejoignez nos visites guidées Paris Insolite, Monuments et Versailles.',
    },
    image: './assets/img/story-city.jpg',
    alt: {
      en: 'Cyclist with coffee cup and yellow city bike outside Le Peloton Café',
      fr: 'Cycliste avec café et vélo de ville jaune devant Le Peloton Café',
    },
  },
];

export const CATEGORIES = [
  { id: 'all', brmCategoryId: null, label: { en: 'All', fr: 'Tous' } },
  { id: 'road', brmCategoryId: '1694542871923', label: { en: 'Road', fr: 'Route' } },
  { id: 'gravel', brmCategoryId: '1774006036667', label: { en: 'Gravel', fr: 'Gravel' } },
  { id: 'city', brmCategoryId: '1701244513597', label: { en: 'City & Family', fr: 'Ville & Famille' } },
];

export const DURATION_PRESETS = [
  { key: '4h', label: { en: '4h', fr: '4h' }, short: { en: 'for 4h', fr: 'pour 4h' } },
  { key: '1d', days: 1, label: { en: '1 day', fr: '1 jour' }, short: { en: '/day', fr: '/jour' } },
  { key: '2d', days: 2, label: { en: '2 days', fr: '2 jours' }, short: { en: '2 days', fr: '2 jours' } },
  { key: '3d', days: 3, label: { en: '3 days', fr: '3 jours' }, short: { en: '3 days', fr: '3 jours' } },
  { key: '5d', days: 5, label: { en: '5 days', fr: '5 jours' }, short: { en: '5 days', fr: '5 jours' } },
  { key: '7d', days: 7, label: { en: '7 days', fr: '7 jours' }, short: { en: '7 days', fr: '7 jours' } },
];

export const HEIGHT_OPTIONS = [
  { id: 'all', minCm: null, maxCm: null, short: { en: 'Any', fr: 'Toutes' }, label: { en: 'Any height', fr: 'Toutes tailles' } },
  { id: 'xxs', minCm: 0, maxCm: 163, short: { en: '<164', fr: '<164' }, label: { en: 'Under 164 cm (XXS)', fr: 'Moins de 164 cm (XXS)' } },
  { id: 'xs', minCm: 164, maxCm: 169, short: { en: '164–170', fr: '164–170' }, label: { en: '164–170 cm (XS)', fr: '164–170 cm (XS)' } },
  { id: 's', minCm: 170, maxCm: 176, short: { en: '170–177', fr: '170–177' }, label: { en: '170–177 cm (S)', fr: '170–177 cm (S)' } },
  { id: 'm', minCm: 177, maxCm: 184, short: { en: '177–185', fr: '177–185' }, label: { en: '177–185 cm (M)', fr: '177–185 cm (M)' } },
  { id: 'l', minCm: 185, maxCm: 190, short: { en: '185–191', fr: '185–191' }, label: { en: '185–191 cm (L)', fr: '185–191 cm (L)' } },
  { id: 'xl', minCm: 191, maxCm: 230, short: { en: '191+ cm', fr: '191+ cm' }, label: { en: '191+ cm (XL)', fr: '191+ cm (XL)' } },
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
    label: { en: 'LOOK KEO', fr: 'LOOK KEO' },
    detail: { en: '+€5', fr: '+5 €' },
  },
  {
    id: 'spd_sl',
    price: 5,
    default: false,
    label: { en: 'Shimano SPD-SL', fr: 'Shimano SPD-SL' },
    detail: { en: '+€5', fr: '+5 €' },
  },
  {
    id: 'spd_mtb',
    price: 5,
    default: false,
    label: { en: 'Shimano SPD', fr: 'Shimano SPD' },
    detail: { en: '+€5', fr: '+5 €' },
  },
  {
    id: 'own',
    price: 0,
    default: false,
    label: { en: 'My own pedals', fr: 'Mes propres pédales' },
    detail: { en: 'Fitted free', fr: 'Montage offert' },
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
      en: 'Handlebar phone cradle for Paris streets and GPS routes.',
      fr: 'Support guidon universel pour suivre vos traces GPS.',
    },
  },
  {
    id: 'garmin_mount',
    price: 5,
    categories: ['road', 'gravel'],
    excludeBikeIds: [],
    label: { en: 'Garmin mount', fr: 'Support GPS Garmin' },
    description: {
      en: 'Out-front quarter-turn mount fitted to your stem.',
      fr: 'Support déporté quart de tour fixé sur la potence.',
    },
  },
  {
    id: 'baby_seat',
    price: 10,
    categories: ['city'],
    onlyBikeIds: ['6274019981524992'],
    needsNote: true,
    label: { en: 'Child seat (4 mo – 4 yrs)', fr: 'Siège enfant (4 mois – 4 ans)' },
    description: {
      en: 'Rear carrier child seat installed on the Parisian City Bike.',
      fr: 'Siège arrière installé sur votre vélo de ville.',
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
      en: 'Responsive, comfortable carbon performance road bike built to glide over Paris cobblestones and tackle climbs with confidence.',
      fr: 'Vélo de route carbone réactif et confortable, conçu pour glisser sur les pavés parisiens et aborder les ascensions avec assurance.',
    },
    image: 'https://storage.googleapis.com/brm-cdn/store/lepelotoncafe/pf-5474683819393024.png?v=1794833914245',
    badge: null,
    summaryLine: {
      en: 'Ultegra 2×11 · 11–34T · 1,140 g frame (M) · Helmet & repair kit',
      fr: 'Ultegra 2×11 · 11–34T · Cadre 1 140 g (M) · Casque & kit',
    },
    specs: {
      en: [
        'Frameset weight (size M): 1,140 g',
        'Shimano Ultegra 2×11-speed · 11–34T cassette',
        'Flat-mount hydraulic disc brakes',
        '2 bottle cages · Helmet, spare tube, pump & tyre lever',
      ],
      fr: [
        'Poids du cadre (taille M) : 1 140 g',
        'Groupe Shimano Ultegra 2×11 vitesses · 11–34T',
        'Freins à disque hydrauliques flat-mount',
        '2 porte-bidons · Casque, chambre à air, pompe et démonte-pneu',
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
      en: '7E7 carbon road · Shimano 105 2×12',
      fr: 'Route carbone 7E7 · Shimano 105 2×12',
    },
    description: {
      en: 'Lightweight 7E7 carbon chassis paired with 12-speed Shimano 105 shifting, curved seat stays, and 28 mm Vittoria rubber.',
      fr: 'Cadre carbone 7E7 équipé en Shimano 105 12 vitesses, haubans confort et pneus Vittoria Rubino 28 mm.',
    },
    image: 'https://storage.googleapis.com/brm-cdn/store/lepelotoncafe/pf-5225922316206080.png?v=1795009883798',
    badge: { en: 'New fleet', fr: 'Nouveau' },
    summaryLine: {
      en: 'Shimano 105 2×12 · 28 mm tyres · Hydraulic disc · Helmet & kit',
      fr: 'Shimano 105 2×12 · Pneus 28 mm · Disques · Casque & kit',
    },
    specs: {
      en: [
        '7E7 carbon frameset · Vittoria Rubino Pro IV 700×28c',
        'Shimano 105 2×12-speed · 11–34T cassette',
        'Shimano hydraulic disc brakes',
        '2 bottle cages · Helmet, spare tube, pump & tyre lever',
      ],
      fr: [
        'Cadre carbone 7E7 · Pneus Vittoria Rubino Pro IV 700×28c',
        'Groupe Shimano 105 2×12 vitesses · 11–34T',
        'Freins à disque hydrauliques Shimano',
        '2 porte-bidons · Casque, chambre à air, pompe et démonte-pneu',
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
      en: 'Tall-rider endurance · Shimano Tiagra 2×10',
      fr: 'Endurance grand format · Shimano Tiagra 2×10',
    },
    description: {
      en: 'Relaxed endurance cockpit with a light aluminium frame and carbon fork, calibrated specifically for tall riders above 191 cm.',
      fr: 'Poste de pilotage confortable en aluminium léger et fourche carbone, préparé en taille XL pour les cyclistes dès 191 cm.',
    },
    image: 'https://storage.googleapis.com/brm-cdn/store/lepelotoncafe/pf-5659947097391104.png?v=1795008735672',
    badge: { en: 'XL · 191+ cm', fr: 'XL · 191+ cm' },
    summaryLine: {
      en: 'Tiagra 2×10 · Carbon fork · XL frame · Helmet & kit',
      fr: 'Tiagra 2×10 · Fourche carbone · Cadre XL · Casque & kit',
    },
    specs: {
      en: [
        'Size XL endurance frame (rider height 191+ cm)',
        'Aluminium chassis with carbon fork',
        'Shimano Tiagra 2×10-speed · 11–34T · Hydraulic discs',
        '2 bottle cages · Helmet, spare tube, pump & tyre lever',
      ],
      fr: [
        'Cadre endurance XL (cycliste 191 cm et plus)',
        'Châssis aluminium avec fourche carbone',
        'Groupe Shimano Tiagra 2×10 · 11–34T · Disques hydrauliques',
        '2 porte-bidons · Casque, chambre à air, pompe et démonte-pneu',
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
      en: '42 mm mixed terrain · Cobbles to forest tracks',
      fr: 'Gravel 42 mm · Pavés et sentiers forestiers',
    },
    description: {
      en: 'Agile gravel geometry with 42 mm tyres built for a wide variety of terrains, from Paris cobbles to forest trails in the area.',
      fr: 'Géométrie gravel agile avec pneus de 42 mm adaptée à tous les terrains, des pavés parisiens aux sentiers forestiers alentour.',
    },
    image: 'https://storage.googleapis.com/brm-cdn/store/lepelotoncafe/pf-5515992322015232.png?v=1794835718497',
    badge: null,
    summaryLine: {
      en: '6061-T6 alloy + carbon fork · 42 mm tyres · Helmet & kit',
      fr: 'Alu 6061-T6 + fourche carbone · Pneus 42 mm · Casque & kit',
    },
    specs: {
      en: [
        '6061-T6 aluminium frame with carbon gravel fork',
        '42 mm mixed-terrain tyres · Hydraulic disc brakes',
        '2 bottle cages · Helmet, spare tube, pump & tyre lever',
      ],
      fr: [
        'Cadre aluminium 6061-T6 avec fourche gravel carbone',
        'Pneus larges 42 mm · Freins à disque hydrauliques',
        '2 porte-bidons · Casque, chambre à air, pompe et démonte-pneu',
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
      en: '3-speed upright cruiser · Basket, helmet & lock',
      fr: 'Vélo de ville 3 vitesses · Panier, casque & antivol',
    },
    description: {
      en: 'Easy step-through city geometry with an internal 3-speed hub and front basket—tailored for Marais lanes and car-free Seine banks.',
      fr: 'Cadre ouvert confortable avec moyeu 3 vitesses et panier avant pour flâner dans le Marais et sur les berges de Seine.',
    },
    image: 'https://storage.googleapis.com/brm-cdn/store/lepelotoncafe/pf-6274019981524992.png?v=1795007166721',
    badge: null,
    summaryLine: {
      en: '3-speed hub · Front basket · Baby-seat ready · Helmet & lock',
      fr: 'Moyeu 3 vitesses · Panier avant · Compatible siège bébé · Antivol',
    },
    specs: {
      en: [
        'Low-maintenance 3-speed internal hub & front basket',
        'Supports optional rear child seat (+€10)',
        'Helmet and lock included',
      ],
      fr: [
        'Moyeu 3 vitesses et panier avant pratique',
        'Compatible siège bébé arrière en option (+10 €)',
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
    name: 'Yuba Kombi Longtail',
    tagline: {
      en: 'Family cargo bike · 1–3 passengers (200 kg max)',
      fr: 'Cargo longtail famille · 1 à 3 passagers (200 kg max)',
    },
    description: {
      en: 'Nimble non-electric Yuba Kombi cargo frame with 24" wheels and a low standover height for riding Paris together.',
      fr: 'Longtail musculaire Yuba Kombi maniable à roues 24" et enjambement bas pour rouler dans Paris à plusieurs.',
    },
    image: 'https://storage.googleapis.com/brm-cdn/store/lepelotoncafe/pf-4706998982541312.png?v=1795006590381',
    badge: { en: 'Family cargo', fr: 'Cargo famille' },
    summaryLine: {
      en: '1–3 riders · 200 kg limit · 24" wheels · Helmet & lock',
      fr: '1–3 passagers · Max 200 kg · Roues 24" · Casque & antivol',
    },
    specs: {
      en: [
        'Yuba Kombi non-electric longtail cargo frame',
        'Carries 1–3 passengers up to 200 kg total',
        'Low mount height · Helmet & heavy lock included',
      ],
      fr: [
        'Cargo longtail musculaire Yuba Kombi',
        'Capacité 1 à 3 passagers (200 kg max)',
        'Enjambement bas · Casque et antivol inclus',
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
      en: 'Ages ~8–12 · 3-speed · Helmet & lock',
      fr: 'Env. 8–12 ans · 3 vitesses · Casque & antivol',
    },
    description: {
      en: 'Light 24-inch junior bike with intuitive 3-speed shifting for family loops along the Seine.',
      fr: 'Vélo enfant 24 pouces léger à 3 vitesses pour les sorties en famille le long des quais.',
    },
    image: 'https://storage.googleapis.com/brm-cdn/store/lepelotoncafe/pf-5936229393629184.png?v=1795007427156',
    badge: { en: 'Ages 8–12', fr: '8–12 ans' },
    summaryLine: {
      en: '24" wheels · 125–150 cm · Helmet & lock',
      fr: 'Roues 24" · 125–150 cm · Casque & antivol',
    },
    specs: {
      en: [
        '24" wheels · recommended height 125–150 cm (~8–12 yrs)',
        'Simple 3-speed hub shifter',
        'Helmet and lock included',
      ],
      fr: [
        'Roues 24" · taille 125–150 cm (env. 8–12 ans)',
        'Transmission 3 vitesses simple',
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
      en: 'Ages ~5–8 · 3-speed · Helmet & lock',
      fr: 'Env. 5–8 ans · 3 vitesses · Casque & antivol',
    },
    description: {
      en: 'Stable 20-inch bike scaled for younger riders discovering Paris beside parents.',
      fr: 'Vélo enfant 20 pouces maniable et stable pour accompagner les parents à travers Paris.',
    },
    image: 'https://storage.googleapis.com/brm-cdn/store/lepelotoncafe/pf-6733408932724736.png?v=1701253622934',
    badge: { en: 'Ages 5–8', fr: '5–8 ans' },
    summaryLine: {
      en: '20" wheels · 105–125 cm · Helmet & lock',
      fr: 'Roues 20" · 105–125 cm · Casque & antivol',
    },
    specs: {
      en: [
        '20" wheels · recommended height 105–125 cm (~5–8 yrs)',
        'Simple 3-speed shifter',
        'Helmet and lock included',
      ],
      fr: [
        'Roues 20" · taille 105–125 cm (env. 5–8 ans)',
        'Transmission 3 vitesses facile',
        'Casque et antivol inclus',
      ],
    },
    sizes: [
      { code: '20"', label: '20"', stock: 5, minCm: 105, maxCm: 125, heightLabel: '105–125 cm' },
    ],
    rates: { h4: 20, tiers: { 1: 35 }, extraDay: 15 },
  },
];

export const I18N = {
  en: {
    navStory: 'Our story',
    navFleet: 'Fleet',
    navClubhouse: 'Clubhouse',
    bagLabel: 'Bag',
    heroKicker: '17 Rue du Pont Louis-Philippe · Le Marais',
    heroTitle: 'Coffee, community,\nand cycling in Paris.',
    heroSub: 'Carbon road, gravel, city, and family bike rentals from the heart of the Marais—backed by our specialty coffee café, Cycling Club, and sister company Bike About Tours.',
    heroCtaPrimary: 'Explore the fleet',
    heroCtaSecondary: 'Our story',
    fleetTitle: 'Choose your ride',
    fleetMeta: 'Helmet & repair kit included · 20% French VAT incl.',
    pickupDate: 'Pickup',
    pickupTime: 'Time',
    duration: 'Duration',
    customDays: 'Custom',
    daysUnit: 'd',
    returnLabel: 'Return',
    heightLabel: 'Rider height',
    filterNoSize: 'No matching size in stock',
    halfDayUnit: 'for 4h',
    perDayUnit: '/day',
    inStock: (n) => `${n} ready`,
    noneLeft: 'Reserved in bag',
    configureBtn: 'Select & fit',
    soldOutBtn: 'All in bag',
    specsTitle: 'Spec & kit',
    sizeLabel: 'Frame size',
    pedalsLabel: 'Pedal setup for this bike',
    pedalsCityNote: 'Includes flat pedals.',
    extrasLabel: 'Accessories',
    childAgePlaceholder: 'Child age (e.g. 2.5 years)',
    riderNameLabel: 'Rider name (optional)',
    riderNamePlaceholder: 'Alex',
    modalTotal: 'Bike total',
    modalAdd: 'Add to bag',
    dockAction: 'Open bag',
    dockCount: (n) => `${n} bike${n > 1 ? 's' : ''}`,
    bagTitle: 'Rental bag',
    bagEmpty: 'Your bag is empty. Select a bike from the fleet above to fit size and pedals.',
    bagPickup: 'Pickup',
    bagReturn: 'Return',
    bagRemove: 'Remove',
    bagVat: (vat, net) => `Incl. 20% VAT (€${vat.toFixed(2)}) · €${net.toFixed(2)} net`,
    bagIdNote: 'Valid photo ID required at pickup · 17 Rue du Pont Louis-Philippe, 75004 Paris.',
    handoffBtn: 'Pay on BRM (Stripe)',
    guestBtn: 'Continue as guest',
    backToBagBtn: 'Back',
    firstName: 'First name',
    lastName: 'Last name',
    email: 'Email',
    phone: 'Phone (optional)',
    terms: 'I will bring a valid photo ID for pickup at Le Peloton Café.',
    confirmBtn: 'Request reservation',
    confirmedBadge: 'Reservation prepared',
    confirmedTitle: 'Ready for your pickup window',
    confirmedBody: 'Complete online payment on BRM now to lock workshop bike prep and pedals.',
    editBagBtn: 'Edit bag',
    clubhouseEyebrow: 'Coffee · Community · Cycling',
    clubhouseTitle: 'Life in Paris is better together.',
    clubhouseBody: 'In the heart of the Marais, our café brings together cyclists back from morning rides, neighbourhood regulars, and travellers—just three doors down from Le Peloton Studio (l’Échappée).',
    clubhouseHoursTitle: 'Opening & rental hours',
    clubhouseHoursBody: 'Café: Mon–Fri 08:00–16:30 · Weekends 08:00–18:00 (rental pickups until 16:00 / 17:30)',
    clubhouseAddressTitle: 'Address',
    clubhousePortalLink: 'Open live BRM portal',
    close: 'Close',
  },
  fr: {
    navStory: 'Notre histoire',
    navFleet: 'La flotte',
    navClubhouse: 'Le café',
    bagLabel: 'Panier',
    heroKicker: '17 Rue du Pont Louis-Philippe · Le Marais',
    heroTitle: 'Café, communauté\net vélo à Paris.',
    heroSub: 'Location de vélos route, gravel, ville et famille au cœur du Marais—au départ de notre café de spécialité, du Cycling Club et de Bike About Tours.',
    heroCtaPrimary: 'Voir les vélos',
    heroCtaSecondary: 'Notre histoire',
    fleetTitle: 'Choisissez votre vélo',
    fleetMeta: 'Casque et kit réparation inclus · TVA 20 % incl.',
    pickupDate: 'Départ',
    pickupTime: 'Heure',
    duration: 'Durée',
    customDays: 'Libre',
    daysUnit: 'j',
    returnLabel: 'Retour',
    heightLabel: 'Taille cycliste',
    filterNoSize: 'Taille indisponible',
    halfDayUnit: 'pour 4h',
    perDayUnit: '/jour',
    inStock: (n) => `${n} dispo${n > 1 ? 's' : ''}`,
    noneLeft: 'Dans votre panier',
    configureBtn: 'Configurer',
    soldOutBtn: 'Stock réservé',
    specsTitle: 'Équipement',
    sizeLabel: 'Taille du cadre',
    pedalsLabel: 'Pédales pour ce vélo',
    pedalsCityNote: 'Pédales plates incluses.',
    extrasLabel: 'Accessoires',
    childAgePlaceholder: 'Âge de l’enfant (ex. 2 ans)',
    riderNameLabel: 'Prénom du cycliste (optionnel)',
    riderNamePlaceholder: 'Alex',
    modalTotal: 'Total vélo',
    modalAdd: 'Ajouter au panier',
    dockAction: 'Voir le panier',
    dockCount: (n) => `${n} vélo${n > 1 ? 's' : ''}`,
    bagTitle: 'Panier location',
    bagEmpty: 'Votre panier est vide. Sélectionnez un vélo ci-dessus pour choisir la taille et les pédales.',
    bagPickup: 'Retrait',
    bagReturn: 'Retour',
    bagVat: (vat, net) => `Dont 20 % TVA (${vat.toFixed(2)} €) · ${net.toFixed(2)} € HT`,
    bagIdNote: 'Pièce d’identité demandée au retrait · 17 Rue du Pont Louis-Philippe, 75004 Paris.',
    handoffBtn: 'Régler sur BRM (Stripe)',
    guestBtn: 'Coordonnées invité',
    backToBagBtn: 'Retour',
    firstName: 'Prénom',
    lastName: 'Nom',
    email: 'E-mail',
    phone: 'Téléphone (optionnel)',
    terms: 'J’apporterai une pièce d’identité valide au Peloton Café.',
    confirmBtn: 'Préparer la réservation',
    confirmedBadge: 'Réservation prête',
    confirmedTitle: 'Prêt pour votre créneau de retrait',
    confirmedBody: 'Finalisez le règlement en ligne sur BRM pour bloquer la préparation atelier et vos pédales.',
    editBagBtn: 'Modifier le panier',
    clubhouseEyebrow: 'Café · Communauté · Vélo',
    clubhouseTitle: 'Paris se vit mieux en peloton.',
    clubhouseBody: 'Au cœur du Marais, notre café réunit cyclistes de retour de sortie, habitués du quartier et voyageurs—à trois portes du Peloton Studio (l’Échappée).',
    clubhouseHoursTitle: 'Horaires du café & retraits',
    clubhouseHoursBody: 'Café : Lun–Ven 08:00–16:30 · Week-end 08:00–18:00 (retraits jusqu’à 16:00 / 17:30)',
    clubhouseAddressTitle: 'Adresse',
    clubhousePortalLink: 'Boutique BRM en ligne',
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
