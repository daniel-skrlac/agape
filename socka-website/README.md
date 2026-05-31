# Socka Website

Astro web stranica za Socijalnu samoposlugu "Kruh sv. Antuna" Varaždin.

## Pokretanje

```bash
npm install
npm run dev
```

Ako si prije obrisao `socka-website` folder dok je terminal bio unutra, prvo izađi u parent folder:

```bash
cd ~/Desktop/agape/agape
cd socka-website
npm install
npm run dev
```

## Uređivanje osnovnih podataka

Glavni podaci, kontakt i društvene mreže su u:

```text
src/lib/site.ts
```

## Dodavanje obavijesti

Obavijesti su Markdown datoteke u:

```text
src/content/obavijesti/
```

Svaka obavijest mora imati `image`, `title`, `description`, `pubDate` i `draft: false`.

Template je ovdje:

```text
templates/obavijest-template.md
```

## Slike za obavijesti

Slike se mogu staviti u:

```text
public/images/obavijesti/
```

U obavijesti se zatim referenciraju kao:

```yaml
image: "/images/obavijesti/naziv-slike.jpg"
```
