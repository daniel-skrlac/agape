import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// Layout only: photographs are resized proportionally and pasted whole.
// No generation, cropping, masks, filters, face processing or colour changes.
const directory = fileURLToPath(new URL('../public/images/obavijesti/prikupljanje-spar-ktc-24-listopada-2026/', import.meta.url));
const files = ['ktc-par.jpeg', 'ktc-volonteri.jpeg', 'spar-volonteri-1.webp', 'spar-volonteri-2.webp'];
const ink = '#443429';
const rust = '#b9552e';
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
const label = (x, y, text, size = 28, options = '') => `<text x="${x}" y="${y}" fill="${ink}" font-family="DejaVu Sans, sans-serif" font-size="${size}" ${options}>${escape(text)}</text>`;
const title = (x, y, text, size = 74) => `<text x="${x}" y="${y}" fill="${ink}" font-family="DejaVu Serif, serif" font-size="${size}" letter-spacing="-2">${escape(text)}</text>`;
const rule = (x, y, width) => `<path d="M${x} ${y}h${width}" stroke="${rust}" stroke-width="2"/>`;
const centered = 'text-anchor="middle"';

async function build({ width, height, name, svg, positions, webp = false }) {
  const photos = await Promise.all(positions.map(async ({ source, left, top, maxWidth, maxHeight }) => {
    const input = await sharp(`${directory}izvorne/${files[source]}`)
      .rotate()
      .resize(maxWidth, maxHeight, { fit: 'inside' })
      .png()
      .toBuffer();
    const metadata = await sharp(input).metadata();
    return {
      input,
      left: left + Math.floor((maxWidth - metadata.width) / 2),
      top: top + Math.floor((maxHeight - metadata.height) / 2),
      width: metadata.width,
      height: metadata.height
    };
  }));
  const background = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="#fbf4e9"/>${svg}</svg>`);
  const png = await sharp(background).composite(photos.map(({ input, left, top }) => ({ input, left, top }))).png().toBuffer();

  // Verify the final photo regions are exactly the resized originals, pixel for
  // pixel. Text and decoration cannot overlap or alter a photograph unnoticed.
  for (const photo of photos) {
    const reference = await sharp(photo.input).ensureAlpha().raw().toBuffer();
    const pasted = await sharp(png).extract({ left: photo.left, top: photo.top, width: photo.width, height: photo.height }).ensureAlpha().raw().toBuffer();
    assert.ok(reference.equals(pasted), `Photograph altered in ${name}`);
  }

  await sharp(png).toFile(`${directory}${name}.png`);
  if (webp) await sharp(png).webp({ lossless: true }).toFile(`${directory}${name}.webp`);
  console.log(`PASS ${name}: ${width} × ${height}; all four photo regions match the resized originals exactly`);
}

await build({
  width: 1080, height: 1080, name: 'instagram-objava-originali', webp: true,
  svg: [
    label(60, 66, 'SOCKA · VARAŽDIN', 21, 'letter-spacing="3"'),
    title(60, 169, 'Prikupljanje', 79), title(60, 257, 'namirnica', 79),
    label(62, 310, 'Mala gesta. Velika pomoć.', 27),
    '<rect x="60" y="345" width="960" height="88" rx="8" fill="#f2dfc9"/>',
    label(86, 400, 'SUBOTA, 24. 10. 2026.', 30, 'font-weight="bold"'),
    label(993, 400, '10:00 – 19:00', 30, 'text-anchor="end" font-weight="bold"'),
    label(298, 493, 'KTC Varaždin', 27, `${centered} font-weight="bold"`),
    label(782, 493, 'SPAR Banfica', 27, `${centered} font-weight="bold"`),
    rule(60, 510, 474), rule(550, 510, 470),
    '<text x="540" y="920" text-anchor="middle" fill="#b9552e" font-family="DejaVu Serif, serif" font-size="38" font-style="italic">Daruj malo, pomozi puno.</text>',
    label(540, 979, 'Socijalna samoposluga Kruh sv. Antuna', 24, centered),
    label(540, 1025, 'socka.hr', 25, `${centered} font-weight="bold"`)
  ].join(''),
  positions: [
    { source: 0, left: 60, top: 530, maxWidth: 230, maxHeight: 307 },
    { source: 1, left: 304, top: 530, maxWidth: 230, maxHeight: 307 },
    { source: 2, left: 550, top: 530, maxWidth: 230, maxHeight: 307 },
    { source: 3, left: 794, top: 530, maxWidth: 226, maxHeight: 307 }
  ]
});

await build({
  width: 1200, height: 750, name: 'kartica-originali', webp: true,
  svg: [
    label(42, 45, 'SOCIJALNA SAMOPOSLUGA · VARAŽDIN', 17, 'letter-spacing="2"'),
    title(42, 122, 'Prikupljanje namirnica', 59),
    label(44, 179, 'Subota, 24. 10. 2026.', 29, 'font-weight="bold"'),
    label(1157, 179, '10:00 – 19:00', 29, 'text-anchor="end" font-weight="bold"'),
    rule(44, 206, 1112),
    label(311, 253, 'KTC Varaždin', 25, `${centered} font-weight="bold"`),
    label(887, 253, 'SPAR Banfica', 25, `${centered} font-weight="bold"`),
    '<text x="44" y="708" fill="#b9552e" font-family="DejaVu Serif, serif" font-size="31" font-style="italic">Daruj malo, pomozi puno.</text>',
    label(1156, 708, 'socka.hr', 25, 'text-anchor="end" font-weight="bold"')
  ].join(''),
  positions: [
    { source: 0, left: 44, top: 278, maxWidth: 264, maxHeight: 352 },
    { source: 1, left: 322, top: 278, maxWidth: 264, maxHeight: 352 },
    { source: 2, left: 608, top: 278, maxWidth: 264, maxHeight: 352 },
    { source: 3, left: 886, top: 278, maxWidth: 270, maxHeight: 352 }
  ]
});

await build({
  width: 1080, height: 1920, name: 'instagram-story-originali',
  svg: [
    label(540, 180, 'SOCKA · VARAŽDIN', 23, `${centered} letter-spacing="3"`),
    title(100, 283, 'Prikupljanje', 80), title(100, 372, 'namirnica', 80),
    label(102, 431, 'Subota, 24. 10. 2026. · 10:00 – 19:00', 29, 'font-weight="bold"'),
    label(288, 513, 'KTC Varaždin', 29, `${centered} font-weight="bold"`),
    label(793, 513, 'SPAR Banfica', 29, `${centered} font-weight="bold"`),
    rule(100, 533, 375), rule(605, 533, 375),
    '<text x="540" y="1670" text-anchor="middle" fill="#b9552e" font-family="DejaVu Serif, serif" font-size="40" font-style="italic">Daruj malo, pomozi puno.</text>',
    label(540, 1724, 'Socijalna samoposluga Kruh sv. Antuna', 24, centered),
    label(540, 1770, 'socka.hr', 27, `${centered} font-weight="bold"`)
  ].join(''),
  positions: [
    { source: 0, left: 100, top: 553, maxWidth: 375, maxHeight: 500 },
    { source: 1, left: 100, top: 1069, maxWidth: 375, maxHeight: 500 },
    { source: 2, left: 605, top: 553, maxWidth: 375, maxHeight: 500 },
    { source: 3, left: 605, top: 1069, maxWidth: 375, maxHeight: 500 }
  ]
});
