import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// A designed invitation, assembled from original photographic files. Only the
// surrounding artwork is drawn. Photos have no crops, masks, filters or edits.
const directory = fileURLToPath(new URL('../public/images/obavijesti/prikupljanje-spar-ktc-24-listopada-2026/', import.meta.url));
const sources = ['prilog-ktc-par.png', 'prilog-ktc-volonteri.png', 'prilog-spar-volonteri-1.png', 'prilog-spar-volonteri-2.png'];
const photos = await Promise.all(sources.map(async name => {
  const bytes = await readFile(`${directory}izvorne/${name}`);
  // librsvg cannot decode embedded WebP on every platform. PNG is a lossless
  // transport of the same source pixels, without photographic adjustments.
  if (name.endsWith('webp')) {
    const png = await sharp(bytes).png().toBuffer();
    return `data:image/png;base64,${png.toString('base64')}`;
  }
  return `data:image/${name.endsWith('png') ? 'png' : 'jpeg'};base64,${bytes.toString('base64')}`;
}));
// Same brand palette as src/styles/global.css (--studio-*).
const navy = '#17233f';
const orange = '#ef4e32';
const cream = '#fff3e4';
const gold = '#ffd166';
const logoBytes = await readFile(fileURLToPath(new URL('../public/images/logo.jpg', import.meta.url)));
const logo = `data:image/jpeg;base64,${logoBytes.toString('base64')}`;
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;');
const text = (x, y, value, size, fill = navy, options = '') => `<text x="${x}" y="${y}" font-family="Space Grotesk, DejaVu Sans, sans-serif" font-size="${size}" font-weight="700" fill="${fill}" ${options}>${esc(value)}</text>`;
const center = 'text-anchor="middle"';
const end = 'text-anchor="end"';
const heart = (x, y, scale = 1, color = orange) => `<path d="M0 9 C-12 -10 -32 5 -21 20 L0 39 L23 17 C32 0 9 -9 0 9Z" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" transform="translate(${x} ${y}) scale(${scale})"/>`;

function polaroid(source, x, y, width, rotation) {
  const photoWidth = width - 20;
  const photoHeight = photoWidth * 4 / 3;
  const height = photoHeight + 30;
  return `<g transform="rotate(${rotation} ${x + width / 2} ${y + height / 2})">
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="5" fill="#fff" filter="url(#paper-shadow)"/>
    <image href="${photos[source]}" x="${x + 10}" y="${y + 10}" width="${photoWidth}" height="${photoHeight}" preserveAspectRatio="xMidYMid meet"/>
    <rect x="${x + width / 2 - 37}" y="${y - 7}" width="74" height="14" fill="${gold}" opacity=".7" transform="rotate(-3 ${x + width / 2} ${y})"/>
  </g>`;
}

const calendar = (x, y, scale = 1) => `<g transform="translate(${x} ${y}) scale(${scale})" stroke="${cream}" stroke-width="3" fill="none" stroke-linecap="round"><rect width="31" height="29" rx="5"/><path d="M0 9H31 M8 -4V4 M23 -4V4 M8 16H10 M20 16H22 M8 23H10 M20 23H22"/></g>`;
function dateBand(x, y, width, height, size) {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${height * .27}" fill="${orange}"/>
    ${calendar(x + 24, y + height / 2 - 15)}
    ${text(x + 78, y + height / 2 + size * .36, 'Subota, 24. 10. 2026.', size, cream)}
    <path d="M${x + width * .66} ${y + 22}v${height - 44}" stroke="${cream}" opacity=".5"/>
    ${text(x + width - 28, y + height / 2 + size * .36, '10:00 – 19:00', size, cream, end)}`;
}
function locations(x, y, size) {
  // Event venues, not a roster assigning pictured volunteers to shifts/shops.
  return `${text(x, y - size * 1.25, 'NA DVIJE LOKACIJE U VARAŽDINU', size * .5, orange, `${center} letter-spacing="2"`)}
    ${text(x, y, 'SPAR Banfica  +  KTC Varaždin', size, navy, center)}`;
}
function badge(x, y, radius) {
  return `<g transform="rotate(9 ${x} ${y})"><circle cx="${x}" cy="${y}" r="${radius}" fill="${gold}"/>
    <circle cx="${x}" cy="${y}" r="${radius - 8}" fill="none" stroke="${orange}" stroke-width="2" stroke-dasharray="3 6"/>
    ${text(x, y + radius * .14, '2', radius * .85, orange, center)}
    ${text(x, y + radius * .48, 'LOKACIJE', radius * .2, navy, `${center} letter-spacing="1"`)}
  </g>`;
}
function brand(x, y) {
  return `<image href="${logo}" x="${x}" y="${y - 34}" width="48" height="48"/>
    ${text(x + 63, y, 'ŠOCKA', 23, navy, 'letter-spacing="2"')}${text(x + 204, y, 'DOBRO JE POMAGATI.', 15, orange, 'letter-spacing="1.2"')}`;
}
function document(width, height, body) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}">
    <defs><filter id="paper-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="8" stdDeviation="9" flood-color="#7d4727" flood-opacity=".16"/></filter></defs>
    <rect width="100%" height="100%" fill="${cream}"/>
    <ellipse cx="${width * 1.08}" cy="${height * .7}" rx="${width * .8}" ry="${height * .48}" fill="#ffe3b5"/>
    <circle cx="${width * .96}" cy="${height * .8}" r="${width * .24}" fill="${gold}" opacity=".22"/>
    ${body}
  </svg>`);
}
async function save(name, width, height, body, webp = false) {
  const svg = document(width, height, body);
  // Every photo is embedded from its original file (WebP decoded to PNG), with a meet
  // transform that preserves the full image. Shadows affect paper frames only.
  const png = await sharp(svg).png().toBuffer();
  await sharp(png).toFile(`${directory}${name}.png`);
  if (webp) await sharp(png).webp({ lossless: true }).toFile(`${directory}${name}.webp`);
  console.log(`Saved ${name}: ${width} × ${height}, four original photos; no AI image processing`);
}

await save('instagram-objava-socka', 1080, 1080, [
  brand(60, 61),
  text(55, 164, 'Prikupljanje', 87, navy, 'letter-spacing="-3"'),
  text(55, 259, 'namirnica', 103, orange, 'letter-spacing="-4"'),
  text(60, 306, 'Tvoja mala gesta nekome znači mnogo.', 25),
  badge(928, 191, 81),
  dateBand(60, 343, 960, 95, 30),
  locations(540, 508, 32),
  polaroid(0, 58, 550, 226, -5), polaroid(1, 301, 550, 226, 3),
  polaroid(2, 560, 550, 226, -3), polaroid(3, 802, 550, 226, 5),
  `<path d="M0 956Q260 910 540 954T1080 934V1080H0Z" fill="${orange}"/>`,
  text(58, 1002, 'Daruj malo, pomozi puno!', 46, cream), heart(995, 967, 1.1, cream),
  text(60, 1051, 'Socijalna samoposluga Kruh sv. Antuna', 20),
  text(1020, 1051, 'socka.hr', 25, navy, end)
].join(''), true);

await save('kartica-socka', 1200, 750, [
  brand(43, 49),
  text(40, 127, 'Prikupljanje', 58, navy, 'letter-spacing="-2"'),
  text(365, 127, 'namirnica', 58, orange, 'letter-spacing="-2"'),
  badge(1092, 98, 57),
  dateBand(43, 170, 1114, 74, 29),
  locations(600, 305, 29),
  polaroid(0, 57, 331, 232, -4), polaroid(1, 321, 331, 232, 3),
  polaroid(2, 641, 331, 232, -3), polaroid(3, 905, 331, 232, 4),
  `<path d="M0 696Q350 657 620 692T1200 676V750H0Z" fill="${orange}"/>`,
  text(43, 731, 'Daruj malo, pomozi puno!', 32, cream),
  text(1155, 731, 'socka.hr', 27, navy, end)
].join(''), true);

await save('instagram-story-socka', 1080, 1920, [
  brand(75, 177),
  text(70, 292, 'Prikupljanje', 91, navy, 'letter-spacing="-3"'),
  text(70, 395, 'namirnica', 108, orange, 'letter-spacing="-4"'),
  text(75, 448, 'Tvoja mala gesta nekome znači mnogo.', 25),
  badge(935, 315, 75),
  dateBand(75, 493, 930, 100, 29),
  locations(540, 677, 33),
  polaroid(0, 115, 720, 338, -4), polaroid(2, 625, 720, 338, 3),
  polaroid(1, 115, 1225, 338, 3), polaroid(3, 625, 1225, 338, -4),
  `<path d="M0 1755Q270 1700 540 1748T1080 1725V1920H0Z" fill="${orange}"/>`,
  text(70, 1806, 'Daruj malo, pomozi puno!', 43, cream), heart(997, 1766, .9, cream),
  text(75, 1864, 'Socijalna samoposluga Kruh sv. Antuna', 21),
  text(1005, 1902, 'socka.hr', 25, navy, end)
].join(''));
