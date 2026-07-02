# Agape aplikacija - tehnička i funkcionalna dokumentacija

## 1. Svrha sustava

Agape je sustav za rad sa skladišnim artiklima, partnerima, predlošcima otpremnica, evidencijama otpreme i knjiženjem dokumenata u naslijeđeni Oracle AGAPE sustav.

Glavni cilj aplikacije je omogućiti brz i kontroliran rad na mobilnom uređaju:

- pregled trenutnog stanja po odabranom skladištu,
- izrada i održavanje predložaka otpreme,
- kreiranje evidencija po partnerima,
- dodavanje artikala iz predložaka, ručnih stavki i skenirane papirnate otpremnice,
- validacija količina prije knjiženja,
- knjiženje dokumenata kroz backend koji poštuje postojeća Oracle pravila.

Sustav je podijeljen na:

- mobilnu Expo aplikaciju (`agape-mobile`),
- Quarkus backend (`agape-api`),
- Python servis za analizu papirnate otpremnice (`dispatch-slip-analyzer`),
- infrastrukturu za bazu i servise (`infra`),
- naslijeđenu Oracle bazu i poslovnu logiku.

## 2. Visoka arhitektura

### 2.1. Mobilna aplikacija

Mobilna aplikacija je korisničko sučelje za operativni rad. Ona ne knjiži direktno u Oracle i ne poziva Python analyzer direktno.

Odgovornosti mobilne aplikacije:

- autentikacija korisnika,
- odabir skladišta,
- prikaz stanja i evidencija,
- rad s predlošcima,
- kreiranje i uređivanje session/evidencija,
- fotografiranje ili učitavanje slike papirnate otpremnice,
- prikaz rezultata analize i ručna korekcija,
- slanje finalnih, korisnički potvrđenih podataka backendu.

### 2.2. Quarkus backend

Backend je izvor istine za sigurnost, validaciju i povezivanje s poslovnim pravilima.

Odgovornosti backend-a:

- JWT autentikacija i autorizacija,
- provjera vlasništva nad session/evidencijama,
- dohvat partnera, artikala, dokumenata i skladišta,
- validacija količina i dostupnosti,
- mapiranje skeniranih šifri artikala na stvarne artikle,
- spajanje skeniranih stavki u session entry,
- priprema zahtjeva za knjiženje,
- pozivanje Oracle procedura i provjera rezultata knjiženja.

### 2.3. Python analyzer

Python servis analizira sliku papirnate otpremnice i vraća strukturirane podatke.

Odgovornosti Python servisa:

- dekodiranje slike,
- normalizacija papira i mreže,
- OCR partnera i datuma,
- očitanje količina iz poznatog rasporeda papirnate otpremnice,
- povrat rezultata, pouzdanosti, upozorenja i metrika kvalitete slike.

Python servis ne smije:

- pisati u bazu,
- donositi finalne poslovne odluke,
- spremati scan povijest,
- knjižiti dokumente.

### 2.4. Oracle naslijeđeni sustav

Oracle baza i PL/SQL procedure predstavljaju naslijeđeni poslovni sustav. Backend treba koristiti Oracle konfiguraciju i procedure gdje god je to dio postojećeg AGAPE ponašanja.

Posebno važno:

- `DOKUMENT_ID` se mora rješavati iz konfiguracije skladišta i tipa dokumenta,
- odabrano skladište iz mobilne aplikacije mora se poštovati do kraja toka,
- procedure koje ovise o session/package kontekstu moraju se pozivati na istoj konekciji,
- uspjeh knjiženja ne znači samo da procedura nije bacila grešku; mora se provjeriti stanje u Oracle tablicama.

## 3. Glavni moduli backend-a

### 3.1. `hr.agape.user`

Upravlja korisnicima, autentikacijom, JWT tokenima i korisničkim postavkama.

Tipične odgovornosti:

- registracija,
- prijava,
- dohvat trenutnog korisnika,
- promjena zadanog skladišta,
- provjera korisničkog identiteta preko `AuthUtil`.

### 3.2. `hr.agape.partner`

Upravlja partnerima.

Odgovornosti:

- dohvat partnera po ID-u,
- pretraga partnera po nazivu,
- pretraga partnera po broju partnera,
- korištenje partnera u evidencijama i knjiženju.

Kod skeniranja papirnate otpremnice partner se može riješiti:

- po ručno odabranom partneru,
- po broju partnera prepoznatom s papira,
- po fallback pravilu gdje se za broj manji od 1000 može pokušati i broj + 1000,
- po tekstualnim kandidatima ako broj nije siguran.

### 3.3. `hr.agape.item`

Upravlja artiklima.

Odgovornosti:

- dohvat artikala po skladištu,
- pretraga artikala,
- mapiranje šifre artikla s papirnate otpremnice na stvarni artikl,
- dohvat metapodataka artikla za prikaz na frontendu.

Važno pravilo: artikli se u scan toku mapiraju po šifri artikla iz otpremnice, a ne po proizvoljnom ID-u koji korisnik ručno upisuje.

### 3.4. `hr.agape.stock`

Upravlja prikazom skladišnog stanja.

Odgovornosti:

- prikaz ukupnog stanja,
- prikaz artikala s najviše zalihe,
- prikaz artikala koji su na nuli ili ispod minimalne količine,
- prikaz podataka po trenutno odabranom skladištu.

Mobilna početna stranica treba prikazivati stanje za trenutno odabrano skladište, a ne globalni zbir koji može zbuniti korisnika.

### 3.5. `hr.agape.template`

Upravlja predlošcima i session/evidencijama.

Glavni pojmovi:

- predložak: konfigurirani skup dokumenata i artikala,
- dokument predloška: dio predloška koji se kasnije može pretvoriti u Oracle dokument,
- session/evidencija: operativna radna grupa za jednu otpremu ili jedan radni dan,
- session entry: unos po partneru unutar evidencije.

Session entry može sadržavati:

- `templateId`,
- `docPatches`,
- `extraItems`,
- napomenu,
- datum dokumenta,
- način rada `DRAFT` ili `FINAL`.

### 3.6. `hr.agape.dispatch`

Upravlja validacijom i knjiženjem otpreme.

Odgovornosti:

- validacija dostupnih količina,
- izračun utjecaja na skladište,
- priprema booking requesta,
- pozivanje Oracle integracije,
- vraćanje rezultata knjiženja mobilnoj aplikaciji.

### 3.7. `hr.agape.dispatch.scan`

Upravlja skeniranjem papirnate otpremnice.

Tok:

1. Mobilna aplikacija šalje sliku backendu.
2. Backend provjerava korisnika i session.
3. Backend šalje sliku Python analyzeru.
4. Python vraća partnera, datum, količine, pouzdanosti i upozorenja.
5. Backend mapira partnera i artikle.
6. Frontend prikazuje uređivi preview.
7. Korisnik ispravlja podatke.
8. Backend validira finalne podatke.
9. Backend sprema potvrđene stavke u session entry.

Scan rezultat nije trajna povijest. U bazu se sprema samo finalno potvrđeni session entry.

## 4. Mobilna aplikacija - segmenti

### 4.1. Autentikacija

Ekrani:

- `app/(auth)/index.tsx`
- `app/(auth)/register.tsx`

Odgovornosti:

- prijava korisnika,
- registracija,
- spremanje tokena,
- preusmjeravanje u glavnu aplikaciju.

### 4.2. Početna stranica

Ekran:

- `app/(tabs)/home.tsx`

Odgovornosti:

- prikaz stanja odabranog skladišta,
- prikaz artikala s najviše zalihe,
- prikaz artikala kojima treba dopuna,
- prikaz artikala bez zalihe,
- osvježavanje podataka.

Podaci moraju biti vezani uz skladište/godinu koje je korisnik odabrao u postavkama ili na samom ekranu. U legacy Oracle sustavu `SKLADISTE_ID` nije samo fizičko skladište: koristi se i kao radna godina/katalog artikala. Zato isti papirnati kod artikla može biti vezan uz drugi interni `ARTIKL_ID` u drugom skladištu/godini.

### 4.3. Postavke

Ekran:

- `app/(tabs)/settings.tsx`

Odgovornosti:

- promjena defaultnog skladišta,
- prikaz korisničkih postavki,
- odjava.

Defaultno skladište/godina koristi se pri kreiranju novih evidencija. Promjena postavke ne mijenja već kreirane evidencije, jer svaka evidencija čuva svoj `warehouseId`.

### 4.4. Predlošci

Ekrani:

- `app/(tabs)/templates/index.tsx`
- `app/(tabs)/templates/folder/[folderId].tsx`
- `app/(tabs)/templates/template/[id].tsx`
- `app/(tabs)/templates/template/[id]/documents.tsx`
- `app/(tabs)/templates/template/[id]/dispatch.tsx`

Odgovornosti:

- organizacija predložaka po mapama,
- kreiranje i uređivanje predložaka,
- dodavanje dokumenata i artikala u predložak,
- otprema iz predloška prema jednom ili više partnera.

Validacija iz predloška koristi isti koncept kao session validacija:

- za jednog partnera prikazuje se detaljna validacija,
- za više partnera prikazuje se ekran `Validacija prije knjiženja`,
- korisnik može kliknuti partnera i vidjeti detalje,
- finalna akcija kreira otpremnice za odabrane partnere.

### 4.5. Evidencije/session

Ekrani:

- `app/(tabs)/sessions/index.tsx`
- `app/(tabs)/sessions/[id]/index.tsx`
- `app/(tabs)/sessions/[id]/partner.tsx`
- `app/(tabs)/sessions/[id]/entry.tsx`
- `app/(tabs)/sessions/[id]/template.tsx`
- `app/(tabs)/sessions/[id]/items.tsx`
- `app/(tabs)/sessions/[id]/scan.tsx`

Session je radna evidencija koja se sastoji od partner entryja.

Korisnik može:

- dodati partnera,
- otvoriti partner entry,
- dodati predložak,
- dodati ručne stavke,
- skenirati papirnatu otpremnicu,
- validirati cijelu evidenciju,
- knjižiti evidenciju.

### 4.6. Partner entry

Partner entry je jedan unos za jednog partnera unutar sessiona.

Može sadržavati:

- stavke iz predloška,
- dodatne stavke van dokumenta,
- stavke dobivene skeniranjem,
- napomenu,
- datum,
- status draft/final.

Za istog partnera u istoj evidenciji postoji jedan aktivni unos. Ako se za istog partnera ponovno spremi skenirana otpremnica, nova potvrđena verzija zamjenjuje prethodne scan podatke za tog partnera. Time se izbjegava slučajno dupliranje kada korisnik isti papir skenira dvaput.

### 4.7. Skeniranje papirnate otpremnice

Ekran:

- `app/(tabs)/sessions/[id]/scan.tsx`

Odgovornosti:

- fotografiranje otpremnice,
- učitavanje slike iz galerije ili datoteka,
- lokalno čuvanje nedovršenog scan drafta,
- slanje slike backendu,
- prikaz analize,
- ručna korekcija partnera, datuma, artikala i količina,
- spremanje potvrđenih stavki u session entry.

Frontend ne radi OCR i ne poziva Python direktno.

## 5. Scan tok detaljno

### 5.1. Slanje slike

Mobilna aplikacija šalje multipart request na:

`POST /api/v1/dispatch-booking-sessions/{id}/entries/scan/parse`

Parametri:

- `file`,
- opcionalno `partnerId`,
- opcionalno `templateId`,
- opcionalno `documentDate`,
- opcionalno `note`.

### 5.2. Analiza slike

Backend šalje sliku Python analyzeru.

Python vraća:

- `partnerNumber`,
- `partnerText`,
- `documentDate`,
- `quantities`,
- pouzdanosti,
- upozorenja,
- metrike kvalitete slike.

### 5.3. Mapiranje na backendu

Backend:

- provjerava session i korisnika,
- mapira partnera,
- mapira šifre artikala na stvarne artikle,
- ako postoji template, pokušava mapirati stavke na dokument predloška,
- linije s `documentId` sprema u `docPatches`,
- linije bez `documentId` sprema u `extraItems`.

### 5.4. Ručna korekcija

Korisnik mora moći ispraviti:

- partnera,
- datum,
- količinu,
- artikl,
- neprepoznate ili nepouzdane stavke.

### 5.5. Spremanje

Spremanje skena ide na:

`PUT /api/v1/dispatch-booking-sessions/{id}/entries/scan`

Backend prije spremanja provjerava korisnika, session i osnovnu dostupnost predloška. Ako isti partner već ima entry, potvrđeni scan zamjenjuje postojeće scan podatke za tog partnera.

## 6. Validacija

Validacija provjerava utjecaj planirane otpreme na skladište.

Pojmovi:

- trenutno stanje: količina artikla u odabranom skladištu,
- planirana količina: količina koju korisnik želi otpremiti,
- efektivno dostupno: dostupna količina nakon uzimanja u obzir već planiranih stavki,
- minus: situacija u kojoj planirana otprema prelazi dostupno stanje.

Validacija se koristi:

- prije knjiženja sessiona,
- prije kreiranja otpremnice iz predloška,
- kod provjere pojedinačnog dokumenta.

## 7. Knjiženje

Knjiženje sessiona:

1. Backend dohvaća sve session entryje.
2. Za svaki entry priprema zahtjev za Oracle.
3. Rješava dokumente i artikle.
4. Poziva poslovnu logiku.
5. Provjerava rezultat.
6. Vraća uspjeh ili greške po partneru.

Nakon uspješnog knjiženja session više nije editable.

## 8. Pravila za skladišta

Odabrano skladište mora se poštovati u svim tokovima:

- početna stranica,
- pretraga artikala,
- validacija,
- skeniranje,
- knjiženje.

Ako skladište nema pozitivno stanje, aplikacija ne smije prikazivati artikle kao dostupne samo zato što postoje u drugom skladištu.

## 9. Pravila za tekstove na mobilnom frontendu

Mobilni UI treba koristiti hrvatske izraze.

Primjeri poželjnih izraza:

- papirnata otpremnica,
- skeniraj otpremnicu,
- učitaj datoteku,
- validacija prije knjiženja,
- partner,
- skladište,
- stavke,
- količina,
- pouzdanost.

Engleski izrazi ne smiju se prikazivati korisniku ako postoji jasan hrvatski izraz.

## 10. Deployment i pokretanje

Tipičan redoslijed:

1. Pokrenuti bazu i infrastrukturu iz `infra`.
2. Pokrenuti Python analyzer.
3. Pokrenuti Quarkus backend.
4. Pokrenuti Expo mobilnu aplikaciju.

Važne provjere:

- backend health endpoint,
- analyzer health endpoint,
- Oracle dostupnost,
- validan JWT,
- ispravan analyzer URL,
- ispravan odabir skladišta.

## 11. Testiranje prije isporuke

Minimalne provjere:

- backend build: `cd agape-api && mvn -DskipTests clean package`,
- frontend typecheck: `cd agape-mobile && npx tsc --noEmit`,
- Python compile: `cd dispatch-slip-analyzer && python -m py_compile app/*.py`,
- direktan analyzer test s primjerom slike,
- ručni tok skeniranja u mobilnoj aplikaciji,
- validacija više partnera,
- knjiženje sessiona,
- provjera Oracle zapisa nakon knjiženja.

## 12. Održavanje

Kod promjena treba paziti:

- frontend ne smije pozivati Python direktno,
- scan rezultat se ne sprema kao zasebna OCR povijest,
- backend mora ostati izvor istine za validaciju,
- Oracle konfiguracija se ne smije hardkodirati,
- promjene DTO-a moraju se uskladiti s generiranim TypeScript tipovima,
- korisnički UI tekstovi trebaju ostati na hrvatskom.
