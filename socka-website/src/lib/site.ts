export type SocialNetwork = 'facebookPage' | 'facebookGroup' | 'instagram' | 'tiktok' | 'whatsapp';

export interface SocialLink {
  id: SocialNetwork;
  label: string;
  shortLabel: string;
  url: string;
  verified: boolean;
  description: string;
}

export interface ContactDetail {
  label: string;
  value: string;
  href?: string;
  verified: boolean;
  verificationNote: string;
}

export const site = {
  name: 'Socijalna samoposluga "Kruh sv. Antuna" Varaždin',
  shortName: 'Kruh sv. Antuna',
  organizationType: 'Volonterski projekt',
  location: 'Varaždin',
  locale: 'hr_HR',
  baseUrl: import.meta.env.PUBLIC_SITE_URL || 'http://localhost:4321',
  logo: '/images/logo.jpg',
  defaultImage: '/images/og/socka-share.png',
  affiliation: {
    name: 'Franjevački svjetovni red sv. Ivana Krstitelja Varaždin',
    shortName: 'Franjevački svjetovni red',
    logo: '/images/identity/ofs-logo.webp'
  },
  humanitarianStatus: {
    label: 'Stalni prikupljač humanitarne pomoći',
    logo: '/images/identity/stalni-prikupljatelj.svg'
  },
  description:
    'Socijalna samoposluga "Kruh sv. Antuna" Varaždin povezuje donatore, volontere i susjede kako bi osnovne namirnice postale konkretna podrška obiteljima u potrebi.',
  contactGuidance:
    'Želite donirati, volontirati ili pokrenuti akciju? Javite se i zajedno ćemo dogovoriti najkorisniji sljedeći korak.',
  address: {
    street: 'Josipa Kozarca 26D',
    postalCode: '42000',
    city: 'Varaždin',
    country: 'HR',
    display: 'Josipa Kozarca 26D, 42000 Varaždin',
    verified: true,
    verificationNote: 'Potvrđeno u materijalima dostavljenima 13. travnja 2026.'
  },
  mapPlaceName: 'Socijalna samoposluga "Kruh sv. Antuna"',
  coordinates: {
    lat: 46.3002279,
    lng: 16.3415806
  },
  phone: {
    display: '+385 99 213 9616',
    href: '+385992139616',
    verified: true,
    verificationNote: 'Potvrđeno u materijalima dostavljenima 13. travnja 2026.'
  },
  email: {
    display: 'socijalna.samoposluga.vz@gmail.com',
    href: 'socijalna.samoposluga.vz@gmail.com',
    verified: true,
    verificationNote: 'Potvrđeno u materijalima dostavljenima 13. travnja 2026.'
  },
  mapLinks: {
    google:
      'https://maps.app.goo.gl/7Jnj5wx8cVRa5veY7?g_st=aw',
    openStreetMap:
      'https://www.openstreetmap.org/search?query=Josipa%20Kozarca%2026D%2C%2042000%20Vara%C5%BEdin',
    embed:
      'https://www.google.com/maps?q=Socijalna%20samoposluga%20%22Kruh%20sv.%20Antuna%22%2C%20Josipa%20Kozarca%2026D%2C%2042000%20Vara%C5%BEdin&ll=46.3002279%2C16.3415806&z=17&output=embed'
  }
} as const;

export const navigation = [
  { label: 'Početna', href: '/' },
  { label: 'Obavijesti', href: '/obavijesti/' },
  { label: 'O nama', href: '/o-nama/' },
  { label: 'Kako pomoći', href: '/kako-pomoci/' },
  { label: 'Volonteri', href: '/volonteri/' },
  { label: 'Doniraj', href: '/doniraj/' },
  { label: 'Kontakt', href: '/kontakt/' }
] as const;

export const footerNavigation = [
  ...navigation,
  { label: 'Politika privatnosti', href: '/politika-privatnosti/' },
  { label: 'Izjava o pristupačnosti', href: '/izjava-o-pristupacnosti/' }
] as const;

export const socialLinks: SocialLink[] = [
  {
    id: 'facebookPage',
    label: 'Službena Facebook stranica',
    shortLabel: 'Službena stranica',
    url: 'https://www.facebook.com/p/Socijalna-samoposluga-Kruh-sv-Antuna-Vara%C5%BEdin-100064545832081/',
    verified: true,
    description: 'Objave, fotografije i pozivi zajednici.'
  },
  {
    id: 'facebookGroup',
    label: 'Facebook grupa',
    shortLabel: 'Facebook grupa',
    url: 'https://www.facebook.com/groups/743086419040582/',
    verified: true,
    description: 'Mjesto za dijeljenje akcija i podrške.'
  },
  {
    id: 'instagram',
    label: 'Instagram',
    shortLabel: 'Instagram',
    url: 'https://www.instagram.com/socijalna_samoposluga_varazdin',
    verified: true,
    description: 'Trenuci s akcija i volonterskog rada.'
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    shortLabel: 'TikTok',
    url: 'https://www.tiktok.com/@socijalna.samopos',
    verified: true,
    description: 'Kratki video zapisi i pozivi na uključivanje.'
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp grupa',
    shortLabel: 'WhatsApp',
    url: '',
    verified: false,
    description: 'Podržano u konfiguraciji, ali skriveno dok se ne potvrdi pozivnica.'
  }
];

export const publishedSocialLinks = socialLinks.filter((link) => link.url && link.verified);

export const contactDetails: ContactDetail[] = [
  {
    label: 'Adresa',
    value: site.address.display,
    href: site.mapLinks.google,
    verified: site.address.verified,
    verificationNote: site.address.verificationNote
  },
  {
    label: 'Telefon',
    value: site.phone.display,
    href: `tel:${site.phone.href}`,
    verified: site.phone.verified,
    verificationNote: site.phone.verificationNote
  },
  {
    label: 'E-pošta',
    value: site.email.display,
    href: `mailto:${site.email.href}`,
    verified: site.email.verified,
    verificationNote: site.email.verificationNote
  }
];

export const donationCategories = [
  'brašno',
  'šećer',
  'ulje',
  'trajno mlijeko',
  'tjestenina',
  'riža, palenta ili griz',
  'konzervirano povrće i grahorice',
  'pasirana rajčica i gotova jela',
  'higijenske potrepštine',
  'sredstva za čišćenje i pranje',
  'dječja hrana',
  'pelene i vlažne maramice'
] as const;

export const donationGroups = [
  {
    title: 'Osnovne namirnice',
    icon: 'basket',
    items: ['brašno', 'šećer', 'ulje', 'trajno mlijeko', 'tjestenina', 'riža, palenta ili griz']
  },
  {
    title: 'Trajna hrana',
    icon: 'pantry',
    items: ['konzervirano povrće i grahorice', 'pasirana rajčica i gotova jela']
  },
  {
    title: 'Higijena i dom',
    icon: 'spark',
    items: ['higijenske potrepštine', 'sredstva za čišćenje i pranje']
  },
  {
    title: 'Proizvodi za djecu',
    icon: 'care',
    items: ['dječja hrana', 'pelene i vlažne maramice']
  }
] as const;

export const supportWays = [
  {
    title: 'Doniraj proizvode',
    icon: 'bag',
    text: 'Najkorisnije su trajne namirnice i higijenske potrepštine u zatvorenoj ambalaži.',
    detail: 'Prije dolaska provjerite aktualne potrebe ili dogovorite termin predaje.',
    actionLabel: 'Dogovorite predaju',
    actionHref: '/kontakt/',
    relatedGroups: ['Osnovne namirnice', 'Trajna hrana', 'Higijena i dom', 'Proizvodi za djecu']
  },
  {
    title: 'Volontiraj',
    icon: 'hands',
    text: 'Volonteri pomažu u prostoru samoposluge, na akcijama i kod pripreme donacija.',
    detail: 'Javite kada možete doći i zajedno ćemo odabrati zadatak koji vam odgovara.',
    actionLabel: 'Pridružite se volontiranju',
    actionHref: '/volonteri/',
    relatedGroups: ['Osnovne namirnice', 'Trajna hrana']
  },
  {
    title: 'Pokreni akciju',
    icon: 'spark',
    text: 'Škola, tvrtka, udruga, župa ili grupa prijatelja mogu zajedno prikupiti više.',
    detail: 'Dogovorite proizvode, rok i način predaje prije nego akcija krene.',
    actionLabel: 'Pokrenite akciju',
    actionHref: '/kontakt/',
    relatedGroups: ['Osnovne namirnice', 'Higijena i dom']
  },
  {
    title: 'Uključi zajednicu',
    icon: 'people',
    text: 'Podijelite provjeren poziv, pozovite ljude oko sebe i usmjerite ih na kontakt.',
    detail: 'Najviše pomažu jasne informacije: što se prikuplja, do kada i gdje se predaje.',
    actionLabel: 'Podijelite službeni kontakt',
    actionHref: '/kontakt/#drustvene-mreze',
    relatedGroups: ['Trajna hrana', 'Proizvodi za djecu']
  },
  {
    title: 'Uključi školu ili tvrtku',
    icon: 'building',
    text: 'Organizirana skupina lakše prikupi proizvode i potakne druge da se uključe.',
    detail: 'Javite se prije početka kako bismo preporučili najpotrebnije proizvode.',
    actionLabel: 'Dogovorite zajedničku akciju',
    actionHref: '/kontakt/',
    relatedGroups: ['Osnovne namirnice', 'Higijena i dom', 'Proizvodi za djecu']
  },
  {
    title: 'Dogovori predaju',
    icon: 'pin',
    text: 'Kratki poziv ili e-pošta pomažu da donacija stigne u dobar trenutak.',
    detail: 'Tako volonteri mogu pripremiti prostor i odmah usmjeriti proizvode dalje.',
    actionLabel: 'Kontaktirajte nas',
    actionHref: '/kontakt/',
    relatedGroups: ['Osnovne namirnice', 'Trajna hrana']
  }
] as const;

export const currentSupportInfo = {
  urgentAppeals: [] as string[],
  currentNeededProducts: [] as string[],
  collectionInstructions: [] as string[]
};

export const historyTimeline = [
  {
    year: '2013.',
    title: 'Ideja postaje mjesto pomoći',
    text: 'Volonteri i Franjevački svjetovni red pokreću prostor u kojem donirana hrana i higijenske potrepštine dobivaju jasan put do ljudi kojima trebaju.'
  },
  {
    year: '2014. - 2020.',
    title: 'Zajednica puni police',
    text: 'Škole, župe, tvrtke, udruge i građani uključuju se kroz akcije prikupljanja. Sve više ljudi prepoznaje da redovita mala pomoć može puno značiti.'
  },
  {
    year: '2021. - 2023.',
    title: 'Deset godina ustrajnosti',
    text: 'Samoposluga ulazi u drugo desetljeće rada s tisućama podijeljenih paketa i volonterima koji dokazuju da mala, redovita pomoć mijenja svakodnevicu.'
  },
  {
    year: '2024. - 2025.',
    title: 'Novi zamah',
    text: 'Najnoviji pregled pokazuje rast broja paketa i vrijednosti pomoći. Zajednica i dalje odgovara onda kada je podrška najpotrebnija.'
  },
  {
    year: 'Danas',
    title: 'Daruj malo, pomozi puno',
    text: 'Svaka donacija, sat volontiranja i dobro organizirana akcija pretvaraju se u konkretnu podršku za susjede u Varaždinu.'
  }
] as const;

export const historicalImpact = [
  {
    value: '29.492',
    label: 'paketa pomoći',
    note: 'ukupno od 2013. do kraja 2025.'
  },
  {
    value: '31.295',
    label: 'volonterskih sati',
    note: 'vrijeme darovano zajednici'
  },
  {
    value: '614.000',
    unit: '€',
    label: 'vrijednosti pomoći',
    note: 'procijenjena vrijednost podijeljenih paketa'
  },
  {
    value: '2025.',
    label: 'najnoviji obrađeni pregled',
    note: '2.988 paketa i 1.453 volonterska sata u toj godini'
  }
] as const;

export const futureGoals = [
  {
    label: 'Prostor',
    title: 'Pronaći bolji i pristupačniji prostor za samoposlugu.',
    text:
      'Trenutni prostor je skučen, ima stepenice i nije građen za ovakav način rada. Starijim korisnicima i osobama slabije pokretljivosti dolazak je težak, a zimi stepenice dodatno traže oprez. Cilj je prostor u kojem se donacije mogu lakše zaprimati, sortirati i podijeliti dostojanstveno.',
    image: '/images/future-goals/pristupacniji-prostor.webp',
    alt: 'Ulaz sa stepenicama kao prikaz potrebe za pristupačnijim prostorom',
    note: 'Sigurniji ulaz, više mjesta za rad i lakši dolazak korisnika.'
  },
  {
    label: 'Prijevoz',
    title: 'Nabaviti vozilo za brži prijevoz hrane i donacija.',
    text:
      'Bijeli Caddy ili manji kombi omogućio bi učinkovitije preuzimanje hrane, prijevoz većih donacija i bržu reakciju kada se pojavi prilika za pomoć. Time bi volonteri manje ovisili o osobnim automobilima, a proizvodi bi lakše dolazili do samoposluge i korisnika.',
    image: '/images/future-goals/prijevoz-donacija.webp',
    alt: 'Volonter istovaruje donacije iz bijelog kombija',
    note: 'Više preuzimanja, manje logističkih prepreka.'
  },
  {
    label: 'Digitalizacija',
    title: 'Modernizirati rad kroz Agape aplikaciju.',
    text:
      'U razvoju je Agape aplikacija koja će olakšati knjiženje donacija, evidenciju paketa i praćenje korisnika. Cilj je da administracija bude jednostavnija, preglednija i sigurnija, kako bi više vremena ostalo za ljude. U razvoj se mogu uključiti i oni koji žele pomoći znanjem.',
    image: '/images/future-goals/agape-aplikacija.webp',
    alt: 'Prikaz Agape aplikacije na mobitelu',
    note: 'Jednostavnije praćenje rada i manje ručnog posla.',
    actionLabel: 'Pogledaj Agape projekt',
    actionHref: 'https://github.com/daniel-skrlac/agape'
  },
  {
    label: 'Terenska pomoć',
    title: 'Pomagati ljudima u domu i oko kuće.',
    text:
      'Plan je razvijati podršku osobama kojima nije dovoljna samo podjela paketa: posjetiti ih, razgovarati, praviti društvo, pomoći oko kuće, obojiti zid, popraviti sitne kvarove ili nabaviti osnovne dijelove kako bi životni prostor bio sigurniji i topliji.',
    image: '/images/future-goals/pomoc-u-domu.webp',
    alt: 'Volonteri pomažu starijoj osobi u domu',
    note: 'Pomoć koja ne staje na pragu samoposluge.'
  },
  {
    label: 'Mladi',
    title: 'Radionice i prezentacije po školama.',
    text:
      'Želimo češće dolaziti među mlade, pokazati im kako volontiranje izgleda u praksi i otvoriti prostor za njihove ideje. Radionice, prezentacije i školske akcije mogu potaknuti novu generaciju ljudi koja razumije da se velika promjena često gradi malim, redovitim djelima.',
    image: '/images/future-goals/radionice-mladi.webp',
    alt: 'Radionica s mladima i prezentacijom o volontiranju',
    note: 'Više mladih koji znaju kako se uključiti.'
  }
] as const;

export const galleryImages = [
  {
    src: '/images/recent/volonterke-u-samoposluzi.webp',
    alt: 'Dvije volonterke u prostoru socijalne samoposluge okružene prikupljenim namirnicama',
    caption: 'Volonteri pretvaraju donacije u spremne pakete'
  },
  {
    src: '/images/recent/volonter-s-namirnicama.webp',
    alt: 'Volonter u prostoru socijalne samoposluge uz kutije s prehrambenim proizvodima',
    caption: 'Svaka polica počinje nečijom odlukom da pomogne'
  },
  {
    src: '/images/community/pripremljene-donacije.webp',
    alt: 'Pripremljene kutije s namirnicama i higijenskim potrepštinama u prostoru samoposluge',
    caption: 'Paketi se pripremaju pažljivo i odgovorno'
  }
] as const;

export function absoluteUrl(path = '/') {
  return new URL(path, site.baseUrl).toString();
}
