const Strings = {
  appName: "Socijalna samoposluga",

  home: {
    hero: {
      eyebrow: "Pregled",
      title: (name: string) => `Pozdrav, ${name}`,
      subtitle: "Brzi pregled stanja skladišta i prioriteta.",
      subtitleLoading: "Učitavam najnovije podatke skladišta…",
    },
    meta: {
      totalQty: "Ukupna količina",
      updatedAt: "Zadnje osvježenje",
    },
    metrics: {
      totalItems: "Artikli",
      missing: "Nedostaje",
      needsFill: "Za dopunu",
      reserved: "Rezervirano",
    },
    sections: {
      missingTitle: "Nedostaje",
      missingSub: "Bez zalihe ili nula",
      needsFillTitle: "Za dopunu",
      needsFillSub: "Ispod minimalne zalihe",
      mostTitle: "Najviše na stanju",
      mostSub: "Stabilna dostupnost",
    },
    rowHints: {
      missing: "Preporuka: nabava / donacije",
      needsFill: "Preporuka: dopuna",
      most: "Stanje dovoljno",
    },
    labels: {
      code: "Šifra",
      pcs: "kom",
    },
    insight: {
      title: "Sažetak",
      loading: "Analiziram prioritete…",
      allGood: "Nema kritičnih stavki. Možete se fokusirati na redovne aktivnosti.",
      priority: (n: string) => `Imate ${n} prioritetnih stavki. Preporuka: fokus na dopunu i nabavu.`,
    },
    empty: {
      loading: "Učitavam stavke…",
      bySegment: {
        missing: "Trenutno nema artikala koji nedostaju.",
        needsFill: "Trenutno nema artikala ispod minimalne zalihe.",
        most: "Nema dovoljno podataka za prikaz.",
      },
    },
    fallbackName: "korisniče",
    warehouse: {
      label: "Skladište",
      modalTitle: "Odaberi skladište",
      changeHint: "Promijeni",
      loading: "Učitavanje…",
      empty: "Nema dostupnih skladišta.",
      none: "Nije odabrano",
      item: (id: number) => `Skladište ${id}`,
    }
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
      usernameTaken: "Korisničko ime je zauzeto. Odaberite drugo.",
    },
  },
};

export default Strings;
