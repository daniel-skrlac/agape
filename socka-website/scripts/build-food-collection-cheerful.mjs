import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// The user-supplied previous poster supplies only the decorative background.
// All four volunteer photographs are embedded from their original attachments,
// displayed whole and never generated, retouched, recoloured or face-edited.
const root = fileURLToPath(new URL('../', import.meta.url));
const output = `${root}public/images/obavijesti/prikupljanje-spar-ktc-24-listopada-2026/`;
const reference = `${root}public/images/obavijesti/prikupljanje-namirnica-spar-banfica-2026-detail.webp`;
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
function photo(index, x, y, width) {
  const height = width * 4 / 3;
  return `<rect x="${x - 7}" y="${y - 7}" width="${width + 14}" height="${height + 14}" rx="14" fill="#fff" filter="url(#shadow)"/>
    <image href="${photos[index]}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"/>`;
}
function storefront(index, x, y, width) {
  const height = width * 2 / 3;
  const title = index === 0 ? 'KTC Supermarket' : 'SPAR Banfica';
  return `<rect x="${x - 7}" y="${y - 7}" width="${width + 14}" height="${height + 49}" rx="14" fill="#fff4df" filter="url(#shadow)"/>
    <image href="${storefronts[index]}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"/>
    ${text(x + width / 2, y + height + 27, title, Math.min(22, width * .092), ink, 700, 'middle')}`;
}
// This covers every letter of the reference's previous event announcement.
const panel = '<path d="M0 80C135 22 238 94 399 134C586 180 685 223 666 373C655 461 588 535 615 663C638 768 694 875 666 1040C650 1141 557 1167 392 1174C235 1194 175 1152 130 1107C83 1061 42 1046 0 1064Z" fill="' + cream + '"/>';

async function render({ name, width, height, body, note, story = false, webp = true }) {
  // Non-square exports use the text-free half so the previous event's copy
  // cannot leak through a different crop of the decorative reference.
  let background = sharp(reference);
  if (story || width !== height) background = background.extract({ left: 600, top: 0, width: 600, height: 1200 });
  const backgroundPng = await background.resize(width, height, { fit: 'cover', position: 'right' }).png().toBuffer();
  const topDecoration = width !== height && !story
    ? await sharp(reference).extract({ left: 0, top: 0, width: 1200, height: 150 }).png().toBuffer()
    : null;
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><filter id="shadow" x="-25%" y="-25%" width="150%" height="150%"><feDropShadow dx="0" dy="5" stdDeviation="7" flood-color="#50220d" flood-opacity=".16"/></filter></defs>
    <image href="data:image/png;base64,${backgroundPng.toString('base64')}" width="${width}" height="${height}"/>
    ${topDecoration ? `<image href="data:image/png;base64,${topDecoration.toString('base64')}" width="${width}" height="150"/>` : ''}
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
  console.log(`Saved ${name}: ${width} × ${height}; original photos, user reference design, no new AI generation`);
}

await render({
  name: 'instagram-objava-ktc-spar', width: 1200, height: 1200,
  body: [
    panel,
    text(48, 107, 'SOCKA · VARAŽDIN', 20, orange),
    text(44, 247, 'Prikupljanje', 86), text(44, 339, 'namirnica', 100, orange),
    icon('calendar', 83, 438), text(146, 449, 'Subota, 24. 10. 2026.', 31),
    icon('clock', 83, 538), text(146, 551, '10:00 – 19:00', 37),
    icon('pin', 83, 645), text(146, 637, 'SPAR Banfica', 33), text(146, 682, 'KTC Supermarket', 33),
    text(146, 719, 'Dvije lokacije u Varaždinu', 20, ink, 500),
    '<path d="M48 757H566" stroke="#f6dbc3" stroke-width="3"/>',
    text(48, 811, 'Prikupljamo namirnice', 29, ink, 500),
    text(48, 854, 'za Socijalnu samoposlugu', 29, ink, 500),
    text(48, 897, 'Kruh sv. Antuna.', 29, ink, 500),
    storefront(0, 654, 76, 254), storefront(1, 926, 76, 254),
    photo(0, 654, 355, 254), photo(2, 926, 355, 254),
    photo(1, 654, 728, 254), photo(3, 926, 728, 254),
    heart(562, 990, 1.1),
    '<path d="M86 1142Q280 1129 477 1140" fill="none" stroke="#f46822" stroke-width="5" stroke-linecap="round"/>',
    text(48, 1166, 'socka.hr', 25, orange)
  ].join(''),
  note: { x: 63, y: 948, width: 465, height: 155 }
});

await render({
  name: 'kartica-ktc-spar', width: 1200, height: 750,
  body: [
    `<g transform="scale(1 .625)">${panel}</g>`,
    `<path d="M0 600H600Q675 610 652 700L628 750H0Z" fill="${cream}"/>`,
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
    photo(0, 670, 55, 244), photo(2, 936, 55, 244),
    photo(1, 670, 400, 244), photo(3, 936, 400, 244),
    heart(537, 637, .85), text(520, 738, 'socka.hr', 19, orange)
  ].join(''),
  note: { x: 56, y: 602, width: 400, height: 95 }
});

await render({
  name: 'instagram-story-ktc-spar', width: 1080, height: 1920, story: true, webp: false,
  body: [
    `<path d="M0 0H1080V751C934 851 778 795 662 842C461 945 207 944 0 846Z" fill="${cream}"/>`,
    '<circle cx="1115" cy="34" r="210" fill="#ffe3b5" opacity=".6"/>',
    `<g opacity=".38">${heart(910, 325, 1.6)}</g>`,
    `<path d="M0 1735C295 1676 725 1746 1080 1718V1920H0Z" fill="${cream}"/>`,
    text(65, 115, 'SOCKA · VARAŽDIN', 23, orange),
    text(60, 240, 'Prikupljanje', 91), text(60, 350, 'namirnica', 110, orange),
    icon('calendar', 99, 433, 37), text(168, 446, 'Subota, 24. 10. 2026.', 37),
    icon('clock', 99, 533, 37), text(168, 548, '10:00 – 19:00', 41),
    icon('pin', 99, 650, 37), text(168, 628, 'SPAR Banfica', 38), text(168, 674, 'KTC Supermarket', 38),
    text(168, 717, 'Dvije lokacije u Varaždinu', 26, ink, 500),
    text(65, 770, 'Za Socijalnu samoposlugu Kruh sv. Antuna', 29, ink, 500),
    storefront(0, 746, 86, 260), storefront(1, 746, 339, 260),
    photo(0, 120, 811, 340), photo(2, 620, 811, 340),
    photo(1, 120, 1290, 340), photo(3, 620, 1290, 340),
    heart(926, 1800, 1.1), text(875, 1890, 'socka.hr', 27, orange)
  ].join(''),
  note: { x: 88, y: 1760, width: 650, height: 127 }
});
