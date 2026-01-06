const Strings = {
  appName: "Socijalna samoposluga",

  home: {
    title: "Dobrodošli 👋",
    subtitle:
      "Brzi pregled skladišta i ključnih stavki. Povucite prema dolje za osvježavanje.",

    status: {
      loading: "Osvježavam podatke…",
      ready: "Podaci su ažurni",
      offline: "Trenutno nema veze — prikazujem zadnje podatke",
    },

    totals: {
      totalItemsTitle: "Ukupno artikala",
      totalItemsSub: "Aktivni artikli u sustavu",
      missingTitle: "Nedostaje",
      missingSub: "Artikli bez zalihe",
      needsFillTitle: "Za dopunu",
      needsFillSub: "Ispod minimalne zalihe",
      reservedTitle: "Rezervirano",
      reservedSub: "Trenutno rezervirane zalihe",
      totalStockQty: "Ukupna količina",
      updatedAt: "Ažurirano",
    },

    sections: {
      needsFillTitle: "Za dopunu",
      needsFillSub: "Artikli ispod minimalne zalihe (prioritet).",
      missingTitle: "Nedostaje",
      missingSub: "Artikli bez zalihe ili s nulom.",
      mostTitle: "Najviše na stanju",
      mostSub: "Artikli s najvećom trenutnom zalihom.",
    },

    rowHints: {
      needsFill: "prioritet za dopunu",
      missing: "potrebno nabaviti / donacije",
      most: "stabilna zaliha",
    },

    empty: {
      needsFill: "Sve izgleda dobro — nema artikala ispod minimalne zalihe.",
      missing: "Super — trenutno nema artikala koji potpuno nedostaju.",
      most: "Nema dovoljno podataka za prikaz.",
      loading: "Učitavam stavke…",
    },
  },

  auth: {
    usernameLabel: "Korisničko ime:",
    usernamePlaceholder: "Unesite korisničko ime",
    passwordLabel: "Lozinka:",
    passwordPlaceholder: "Unesite svoju lozinku",
    fullNameLabel: "Ime i prezime:",
    fullNamePlaceholder: "Unesite ime i prezime",

    loginTitle: "Prijava",
    loginButton: "Prijava",
    loginToRegisterQuestion: "Nemate korisnički račun?",
    loginToRegisterLink: "Registrirajte se.",

    registerTitle: "Registracija",
    registerButton: "Registracija",
    registerToLoginQuestion: "Već imate korisnički račun?",
    registerToLoginLink: "Prijavite se.",
    fillerQuote: "Najbolji način za pronaći sebe je izgubiti se služeći drugima.",
    fillerAuthor: "Mahatma Gandhi",
    loginHint: "Unesite podatke za pristup aplikaciji.",
    validation: {
      usernameRequired: "Unesite korisničko ime.",
      passwordRequired: "Unesite lozinku.",
      fullNameRequired: "Unesite ime i prezime.",
      usernameMin: "Korisničko ime mora imati barem 3 znaka.",
      passwordMin: "Lozinka mora imati barem 6 znakova.",
    },
    errors: {
      generic: "Nešto je pošlo po zlu. Pokušajte ponovno.",
      invalidCredentials: "Neispravno korisničko ime ili lozinka.",
      network: "Nema internetske veze s poslužiteljem. Provjerite internet i pokušajte ponovno.",
    },
  },
};

export default Strings;
