import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// The original volunteer photographs form the background collage themselves.
// Only layout, resizing and framing crops are applied: no generated pixels,
// photographic filters, retouching, recolouring or face editing.
const root = fileURLToPath(new URL('../', import.meta.url));
const output = `${root}public/images/obavijesti/prikupljanje-spar-ktc-24-listopada-2026/`;
const handwritingFont = `${root}assets/fonts/Caveat.ttf`;
const sources = ['prilog-ktc-par.png', 'prilog-ktc-volonteri.png', 'prilog-spar-volonteri-1.png', 'prilog-spar-volonteri-2.png'];
const photos = await Promise.all(sources.map(async source => `data:image/png;base64,${(await readFile(`${output}izvorne/${source}`)).toString('base64')}`));
const storefronts = await Promise.all(['prilog-ktc-supermarket.png', 'prilog-spar-ulaz.png'].map(async source => `data:image/png;base64,${(await readFile(`${output}izvorne/${source}`)).toString('base64')}`));
const orange = '#f46822';
const ink = '#10131a';
const cream = '#fff8eb';
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
const text = (x, y, value, size, color = ink, weight = 700, anchor = 'start') => `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${color}" font-family="Space Grotesk, DejaVu Sans, sans-serif" font-weight="${weight}" font-size="${size}">${escape(value)}</text>`;
const heart = (x, y, scale = 1) => `<path d="M0 9C-12-13-31 2-22 21L0 43L25 16C33-4 10-12 0 9Z" fill="none" stroke="${orange}" stroke-width="4" stroke-linecap="round" transform="translate(${x} ${y}) scale(${scale})"/>`;
function icon(kind, x, y, radius = 34) {
  const paths = {
    calendar: '<rect x="-15" y="-13" width="30" height="28" rx="3"/><path d="M-15-5H15M-8-18V-9M8-18V-9M-8 2H-5M4 2H7M-8 9H-5M4 9H7"/>',
    clock: '<circle r="17"/><path d="M0-12V1L10 7"/>',
    pin: '<path d="M0 19S-14 4-14-5a14 14 0 0 1 28 0C14 4 0 19 0 19Z"/><circle cy="-5" r="4"/>'
  };
  return `<circle cx="${x}" cy="${y}" r="${radius}" fill="${orange}"/><g transform="translate(${x} ${y})" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">${paths[kind]}</g>`;
}
function photoTile(index, x, y, width, height) {
  return `<svg x="${x}" y="${y}" width="${width}" height="${height}" overflow="hidden">
    <image href="${photos[index]}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/>
  </svg>`;
}
function collage(x, y, width, height) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  // SPAR on the left, KTC on the right. Faces stay clear of the text panel;
  // the photos fill their tiles rather than floating in separate picture frames.
  return [
    photoTile(2, x, y, halfWidth, halfHeight),
    photoTile(0, x + halfWidth, y, halfWidth, halfHeight),
    photoTile(3, x, y + halfHeight, halfWidth, halfHeight),
    photoTile(1, x + halfWidth, y + halfHeight, halfWidth, halfHeight),
    `<path d="M${x + halfWidth} ${y}V${y + height}M${x} ${y + halfHeight}H${x + width}" stroke="${cream}" stroke-width="4"/>`
  ].join('');
}
function storefront(index, x, y, width) {
  const height = width * 2 / 3;
  const title = index === 0 ? 'KTC Supermarket' : 'SPAR Banfica';
  return `<rect x="${x - 7}" y="${y - 7}" width="${width + 14}" height="${height + 49}" rx="14" fill="#fff4df" filter="url(#shadow)"/>
    <image href="${storefronts[index]}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"/>
    ${text(x + width / 2, y + height + 27, title, Math.min(22, width * .092), ink, 700, 'middle')}`;
}
// The cream information panel meets the edge-to-edge photo collage directly.
const panel = `<path d="M0 0H564C570 117 596 223 583 342C566 475 550 570 561 696C571 829 591 965 574 1089Q565 1160 546 1200H0Z" fill="${cream}"/>`;

async function render({ name, width, height, backdrop, body, note, webp = true }) {
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <filter id="shadow" x="-25%" y="-25%" width="150%" height="150%"><feDropShadow dx="0" dy="5" stdDeviation="7" flood-color="#50220d" flood-opacity=".16"/></filter>
    </defs>
    <rect width="${width}" height="${height}" fill="${cream}"/>
    ${backdrop}
    ${body}
  </svg>`);
  const lettering = await sharp({ text: {
    text: 'Dobri ljudi,\nhvala vam od srca!',
    font: 'Caveat Bold 68', fontfile: handwritingFont, rgba: true, spacing: 0
  } }).png().toBuffer();
  // Only the handwritten lettering is coloured/rotated; never a source photo.
  const letteringInfo = await sharp(lettering).metadata();
  const coloured = await sharp({ create: { width: letteringInfo.width, height: letteringInfo.height, channels: 4, background: orange } })
    .composite([{ input: lettering, blend: 'dest-in' }]).png().toBuffer();
  const notePng = await sharp(coloured).resize(note.width, note.height, { fit: 'inside' }).rotate(-5, { background: '#00000000' }).png().toBuffer();
  const png = await sharp(svg).composite([{ input: notePng, left: note.x, top: note.y }]).png().toBuffer();
  await sharp(png).toFile(`${output}${name}.png`);
  if (webp) await sharp(png).webp({ lossless: true }).toFile(`${output}${name}.webp`);
  console.log(`Saved ${name}: ${width} × ${height}; original-photo background collage, no AI image processing`);
}

await render({
  name: 'instagram-objava-volonteri-kolaz', width: 1200, height: 1200,
  backdrop: collage(550, 0, 650, 1200),
  body: [
    panel,
    text(48, 58, 'SOCKA · VARAŽDIN', 20, orange),
    text(44, 166, 'Prikupljanje', 77), text(44, 255, 'namirnica', 91, orange),
    icon('calendar', 83, 342), text(146, 353, 'Subota, 24. 10. 2026.', 31),
    icon('clock', 83, 438), text(146, 451, '10:00 – 19:00', 37),
    icon('pin', 83, 563), text(146, 551, 'SPAR Banfica', 33), text(146, 597, 'KTC Supermarket', 33),
    text(146, 634, 'Dvije lokacije u Varaždinu', 20, ink, 500),
    '<path d="M48 674H514" stroke="#f6dbc3" stroke-width="3"/>',
    text(48, 720, 'Za Socijalnu samoposlugu', 27, ink, 500),
    text(48, 760, 'Kruh sv. Antuna.', 27, ink, 500),
    storefront(0, 55, 805, 210), storefront(1, 307, 805, 210),
    heart(515, 1030, .8),
    '<path d="M63 1140Q266 1128 465 1140" fill="none" stroke="#f46822" stroke-width="4" stroke-linecap="round"/>',
    text(48, 1166, 'socka.hr', 25, orange)
  ].join(''),
  note: { x: 50, y: 998, width: 430, height: 105 }
});

await render({
  name: 'kartica-volonteri-kolaz', width: 1200, height: 750,
  backdrop: collage(550, 0, 650, 750),
  body: [
    `<g transform="scale(1 .625)">${panel}</g>`,
    text(42, 48, 'SOCKA · VARAŽDIN', 17, orange),
    text(40, 127, 'Prikupljanje', 62), text(40, 201, 'namirnica', 74, orange),
    icon('calendar', 70, 272, 28), text(122, 282, 'Subota, 24. 10. 2026.', 27),
    icon('clock', 70, 350, 28), text(122, 362, '10:00 – 19:00', 32),
    icon('pin', 70, 434, 28), text(122, 428, 'SPAR Banfica', 29), text(122, 466, 'KTC Supermarket', 29),
    text(122, 495, 'Dvije lokacije u Varaždinu', 18, ink, 500),
    '<path d="M42 521H552" stroke="#f6dbc3" stroke-width="2"/>',
    text(42, 557, 'Za Socijalnu samoposlugu', 24, ink, 500),
    text(42, 592, 'Kruh sv. Antuna.', 24, ink, 500),
    storefront(0, 452, 24, 150), storefront(1, 452, 194, 150),
    heart(537, 637, .85), text(452, 738, 'socka.hr', 19, orange)
  ].join(''),
  note: { x: 56, y: 602, width: 400, height: 95 }
});

await render({
  name: 'instagram-story-volonteri-kolaz', width: 1080, height: 1920, webp: false,
  backdrop: collage(0, 810, 1080, 990),
  body: [
    '<circle cx="1115" cy="34" r="210" fill="#ffe3b5" opacity=".6"/>',
    `<g opacity=".38">${heart(910, 325, 1.6)}</g>`,
    text(65, 115, 'SOCKA · VARAŽDIN', 23, orange),
    text(60, 240, 'Prikupljanje', 91), text(60, 350, 'namirnica', 110, orange),
    icon('calendar', 99, 433, 37), text(168, 446, 'Subota, 24. 10. 2026.', 37),
    icon('clock', 99, 533, 37), text(168, 548, '10:00 – 19:00', 41),
    icon('pin', 99, 650, 37), text(168, 628, 'SPAR Banfica', 38), text(168, 674, 'KTC Supermarket', 38),
    text(168, 717, 'Dvije lokacije u Varaždinu', 26, ink, 500),
    text(65, 770, 'Za Socijalnu samoposlugu Kruh sv. Antuna', 29, ink, 500),
    storefront(0, 746, 86, 260), storefront(1, 746, 339, 260),
    heart(926, 1840, .8), text(875, 1890, 'socka.hr', 27, orange)
  ].join(''),
  note: { x: 65, y: 1810, width: 650, height: 95 }
});
