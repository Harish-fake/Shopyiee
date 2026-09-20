/**
 * Generates the storefront artwork.
 *
 * The catalogue uses vector illustrations rather than photographs so that the
 * project stays self-contained, works offline and carries no third-party image
 * licensing.  Each product gets a gradient tile with a device glyph.
 *
 *   node scripts/generate-images.mjs
 *
 * Output:
 *   frontend/public/images/products/*.svg
 *   frontend/public/images/categories/*.svg
 *   frontend/public/images/logo.svg
 *   frontend/public/images/hero.svg
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(here, '..', 'frontend', 'public', 'images');

const PALETTES = [
  ['#6366f1', '#8b5cf6'],
  ['#0ea5e9', '#2563eb'],
  ['#f43f5e', '#ec4899'],
  ['#10b981', '#059669'],
  ['#f59e0b', '#ea580c'],
  ['#8b5cf6', '#d946ef'],
  ['#14b8a6', '#0d9488'],
  ['#ef4444', '#b91c1c'],
  ['#3b82f6', '#1d4ed8'],
  ['#a855f7', '#7c3aed'],
  ['#06b6d4', '#0891b2'],
  ['#84cc16', '#4d7c0f'],
  ['#f97316', '#c2410c'],
  ['#64748b', '#334155'],
];

/* -------------------------------------------------------------------------- */
/* Glyphs - drawn inside a 100 x 100 box, centred on (50, 50)                  */
/* -------------------------------------------------------------------------- */

const GLYPHS = {
  laptop: `
    <rect x="18" y="26" width="64" height="42" rx="3"/>
    <rect x="23" y="31" width="54" height="32" rx="2" fill-opacity="0.35"/>
    <path d="M10 70h80l-5 8H15z"/>`,

  phone: `
    <rect x="32" y="14" width="36" height="72" rx="7"/>
    <rect x="37" y="21" width="26" height="52" rx="2" fill-opacity="0.35"/>
    <circle cx="50" cy="79" r="3" fill-opacity="0.5"/>
    <rect x="45" y="17" width="10" height="2.5" rx="1.25" fill-opacity="0.5"/>`,

  keyboard: `
    <rect x="8" y="32" width="84" height="36" rx="5"/>
    <g fill-opacity="0.35">
      <rect x="14" y="38" width="9" height="8" rx="1.5"/><rect x="26" y="38" width="9" height="8" rx="1.5"/>
      <rect x="38" y="38" width="9" height="8" rx="1.5"/><rect x="50" y="38" width="9" height="8" rx="1.5"/>
      <rect x="62" y="38" width="9" height="8" rx="1.5"/><rect x="74" y="38" width="12" height="8" rx="1.5"/>
      <rect x="14" y="50" width="12" height="8" rx="1.5"/><rect x="29" y="50" width="42" height="8" rx="1.5"/>
      <rect x="74" y="50" width="12" height="8" rx="1.5"/>
    </g>`,

  mouse: `
    <rect x="33" y="16" width="34" height="58" rx="17"/>
    <rect x="47" y="24" width="6" height="14" rx="3" fill-opacity="0.4"/>
    <path d="M33 42h34" stroke-width="2" stroke-opacity="0.4"/>`,

  monitor: `
    <rect x="8" y="18" width="84" height="52" rx="4"/>
    <rect x="14" y="24" width="72" height="40" rx="2" fill-opacity="0.35"/>
    <rect x="42" y="70" width="16" height="10" fill-opacity="0.6"/>
    <rect x="30" y="80" width="40" height="5" rx="2.5"/>`,

  headphones: `
    <path d="M20 58V46a30 30 0 0 1 60 0v12" fill="none" stroke-width="8" stroke-linecap="round"/>
    <rect x="12" y="52" width="16" height="30" rx="7"/>
    <rect x="72" y="52" width="16" height="30" rx="7"/>`,

  camera: `
    <rect x="10" y="28" width="80" height="48" rx="7"/>
    <rect x="34" y="20" width="22" height="10" rx="3"/>
    <circle cx="50" cy="52" r="16" fill-opacity="0.35"/>
    <circle cx="50" cy="52" r="8"/>
    <circle cx="78" cy="38" r="3" fill-opacity="0.6"/>`,

  drive: `
    <rect x="16" y="30" width="68" height="40" rx="5"/>
    <rect x="24" y="40" width="52" height="8" rx="2" fill-opacity="0.35"/>
    <rect x="24" y="53" width="34" height="8" rx="2" fill-opacity="0.35"/>
    <circle cx="74" cy="57" r="3.5" fill-opacity="0.6"/>`,

  watch: `
    <rect x="30" y="30" width="40" height="40" rx="10"/>
    <rect x="36" y="36" width="28" height="28" rx="6" fill-opacity="0.35"/>
    <path d="M40 30V16h20v14M40 70v14h20V70" fill-opacity="0.7"/>`,

  speaker: `
    <rect x="28" y="12" width="44" height="76" rx="10"/>
    <circle cx="50" cy="36" r="11" fill-opacity="0.4"/>
    <circle cx="50" cy="66" r="7" fill-opacity="0.4"/>
    <circle cx="50" cy="36" r="4"/>`,

  tv: `
    <rect x="6" y="18" width="88" height="54" rx="5"/>
    <rect x="12" y="24" width="76" height="42" rx="2" fill-opacity="0.35"/>
    <path d="M36 84h28l4-8H32z"/>`,

  appliance: `
    <rect x="16" y="10" width="68" height="80" rx="7"/>
    <rect x="24" y="20" width="52" height="26" rx="3" fill-opacity="0.35"/>
    <circle cx="50" cy="64" r="13" fill-opacity="0.35"/>
    <circle cx="50" cy="64" r="5"/>
    <rect x="72" y="30" width="4" height="16" rx="2" fill-opacity="0.6"/>`,

  chair: `
    <path d="M26 16h48v40H26z" rx="6"/>
    <rect x="20" y="58" width="60" height="12" rx="5"/>
    <path d="M32 70v18M68 70v18" stroke-width="6" stroke-linecap="round" fill="none"/>
    <circle cx="32" cy="90" r="4"/><circle cx="68" cy="90" r="4"/>`,

  controller: `
    <path d="M22 34h56c8 0 14 8 12 18l-4 22c-2 8-12 9-16 2l-5-8H35l-5 8c-4 7-14 6-16-2l-4-22c-2-10 4-18 12-18z"/>
    <circle cx="34" cy="48" r="6" fill-opacity="0.35"/>
    <circle cx="66" cy="44" r="4" fill-opacity="0.5"/>
    <circle cx="74" cy="54" r="4" fill-opacity="0.5"/>`,

  mousepad: `
    <rect x="6" y="26" width="88" height="48" rx="7"/>
    <rect x="14" y="34" width="72" height="32" rx="4" fill-opacity="0.3"/>
    <circle cx="50" cy="50" r="7"/>`,

  webcam: `
    <circle cx="50" cy="42" r="24"/>
    <circle cx="50" cy="42" r="13" fill-opacity="0.35"/>
    <circle cx="50" cy="42" r="5"/>
    <rect x="42" y="64" width="16" height="12" rx="3"/>
    <rect x="28" y="76" width="44" height="7" rx="3.5"/>`,

  shoe: `
    <path d="M12 62c0-10 8-16 18-18l14-3 10 8 16 3c10 2 16 6 16 12v8H12z"/>
    <path d="M30 44l6 10M42 41l6 10M54 40l6 10" stroke-width="2.5" stroke-opacity="0.4" fill="none"/>`,

  jacket: `
    <path d="M34 16h32l16 10-8 16-8-4v46H34V38l-8 4-8-16z"/>
    <path d="M50 16v68" stroke-width="2.5" stroke-opacity="0.4"/>`,

  tshirt: `
    <path d="M32 16h36l18 12-9 15-7-4v45H30V39l-7 4-9-15z"/>
    <path d="M38 16a12 12 0 0 0 24 0" fill-opacity="0.3"/>`,

  backpack: `
    <rect x="22" y="26" width="56" height="62" rx="12"/>
    <path d="M34 26v-4a16 16 0 0 1 32 0v4" fill="none" stroke-width="6"/>
    <rect x="34" y="46" width="32" height="20" rx="5" fill-opacity="0.35"/>`,

  sunglasses: `
    <path d="M8 34h34a8 8 0 0 1 8 8 12 12 0 0 1-24 0 8 8 0 0 1-8-8z"/>
    <path d="M92 34H58a8 8 0 0 0-8 8 12 12 0 0 0 24 0 8 8 0 0 0 8-8z"/>
    <path d="M50 42h-8" stroke-width="5" stroke-linecap="round"/>`,

  watchAnalog: `
    <circle cx="50" cy="50" r="26"/>
    <circle cx="50" cy="50" r="20" fill-opacity="0.3"/>
    <path d="M50 32v18l11 7" fill="none" stroke-width="3" stroke-linecap="round"/>
    <path d="M40 24V12h20v12M40 76v12h20V76" fill-opacity="0.7"/>`,

  speakerSmall: `
    <rect x="34" y="14" width="32" height="72" rx="14"/>
    <rect x="42" y="24" width="16" height="16" rx="8" fill-opacity="0.35"/>
    <rect x="42" y="46" width="16" height="16" rx="8" fill-opacity="0.35"/>`,

  purifier: `
    <rect x="24" y="10" width="52" height="80" rx="12"/>
    <circle cx="50" cy="46" r="18" fill-opacity="0.3"/>
    <circle cx="50" cy="46" r="9"/>
    <path d="M36 76h28" stroke-width="4" stroke-linecap="round" stroke-opacity="0.5"/>`,

  vacuum: `
    <circle cx="50" cy="56" r="30"/>
    <circle cx="50" cy="56" r="20" fill-opacity="0.3"/>
    <rect x="40" y="14" width="20" height="14" rx="5"/>
    <circle cx="50" cy="56" r="6"/>`,

  kettle: `
    <path d="M26 34h44v42a8 8 0 0 1-8 8H34a8 8 0 0 1-8-8z"/>
    <path d="M70 44h8a8 8 0 0 1 0 16h-8" fill="none" stroke-width="6"/>
    <rect x="30" y="24" width="36" height="8" rx="4"/>`,

  sunglassesFashion: `
    <path d="M12 34h32a6 6 0 0 1 6 6 11 11 0 0 1-22 0 6 6 0 0 1-6-6z"/>
    <path d="M88 34H56a6 6 0 0 0-6 6 11 11 0 0 0 22 0 6 6 0 0 0 6-6z"/>
    <path d="M50 40h-6" stroke-width="5" stroke-linecap="round"/>`,
};

/* -------------------------------------------------------------------------- */
/* Product -> glyph mapping                                                    */
/* -------------------------------------------------------------------------- */

const PRODUCTS = {
  'aurora-55-4k-smart-tv': 'tv',
  'nimbus-anc-headphones': 'headphones',
  'pulse-bluetooth-speaker': 'speaker',
  'zenith-smart-watch': 'watch',
  'orbit-action-camera': 'camera',
  'lumen-mirrorless-camera': 'camera',

  'stratos-ultrabook-14': 'laptop',
  'titan-gaming-laptop-15': 'laptop',
  'vector-business-13': 'laptop',
  'flex-2in1-convertible': 'laptop',
  'creator-pro-16': 'laptop',
  'breeze-chromebook-11': 'laptop',

  'apex-pro-max': 'phone',
  'nova-neo-5g': 'phone',
  'pulse-lite-4g': 'phone',
  'fold-x-flip': 'phone',
  'terra-rugged-5g': 'phone',

  'clack-mechanical-keyboard': 'keyboard',
  'glide-wireless-mouse': 'mouse',
  'port-usbc-hub-9in1': 'drive',
  'vault-portable-ssd-1tb': 'drive',
  'core-ram-16gb-ddr5': 'drive',
  'volt-65w-gan-charger': 'drive',
  'shield-laptop-sleeve-14': 'backpack',
  'focus-1080p-webcam': 'webcam',
  'vista-27-4k-monitor': 'monitor',
  'amp-power-bank-20000': 'drive',

  'strike-gaming-mouse': 'mouse',
  'echo-gaming-headset': 'headphones',
  'throne-gaming-chair': 'chair',
  'axis-controller-pro': 'controller',
  'expanse-rgb-mousepad': 'mousepad',
  'velocity-144hz-monitor': 'monitor',

  'pure-air-purifier': 'purifier',
  'sweep-robot-vacuum': 'vacuum',
  'warm-microwave-28l': 'appliance',
  'brew-espresso-machine': 'appliance',
  'rapid-electric-kettle': 'kettle',
  'chill-refrigerator-340l': 'appliance',

  'trail-running-shoes': 'shoe',
  'rugged-denim-jacket': 'jacket',
  'daily-cotton-tshirt': 'tshirt',
  'metro-leather-backpack': 'backpack',
  'horizon-sunglasses': 'sunglasses',
  'classic-analog-watch': 'watchAnalog',
};

const CATEGORIES = {
  electronics: ['tv', 0],
  laptops: ['laptop', 1],
  smartphones: ['phone', 2],
  accessories: ['keyboard', 4],
  gaming: ['controller', 5],
  'home-appliances': ['appliance', 3],
  fashion: ['jacket', 6],
};

/* -------------------------------------------------------------------------- */

function hash(value) {
  let total = 0;
  for (let i = 0; i < value.length; i += 1) total = (total * 31 + value.charCodeAt(i)) % 100000;
  return total;
}

function tile(slug, glyphKey, paletteIndex, size = 800) {
  const [from, to] = PALETTES[paletteIndex % PALETTES.length];
  const glyph = GLYPHS[glyphKey] ?? GLYPHS.drive;
  const rotation = (hash(slug) % 7) - 3;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${slug}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.3" cy="0.2" r="0.9">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)"/>
  <rect width="${size}" height="${size}" fill="url(#glow)"/>
  <circle cx="${size * 0.82}" cy="${size * 0.2}" r="${size * 0.22}" fill="#ffffff" opacity="0.07"/>
  <circle cx="${size * 0.16}" cy="${size * 0.86}" r="${size * 0.3}" fill="#000000" opacity="0.05"/>
  <g transform="translate(${size / 2} ${size / 2}) rotate(${rotation}) scale(${size / 190}) translate(-50 -50)">
    <g fill="#ffffff" stroke="#ffffff" stroke-width="0" opacity="0.95">
      <g transform="translate(0 3)" opacity="0.18" fill="#000000">
        <g transform="scale(1)">${glyph}</g>
      </g>
      <g>${glyph}</g>
    </g>
  </g>
</svg>
`;
}

function write(relativePath, contents) {
  const target = resolve(publicDir, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents, 'utf8');
}

mkdirSync(resolve(publicDir, 'products'), { recursive: true });
mkdirSync(resolve(publicDir, 'categories'), { recursive: true });

let productCount = 0;
for (const [slug, glyph] of Object.entries(PRODUCTS)) {
  write(`products/${slug}.svg`, tile(slug, glyph, hash(slug)));
  productCount += 1;
}

let categoryCount = 0;
for (const [slug, [glyph, paletteIndex]] of Object.entries(CATEGORIES)) {
  write(`categories/${slug}.svg`, tile(slug, glyph, paletteIndex, 600));
  categoryCount += 1;
}

/* Logo ---------------------------------------------------------------------- */

write(
  'logo.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="ShopSphere">
  <defs>
    <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#2563eb"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="16" fill="url(#lg)"/>
  <path d="M18 22h4l4.5 20a3 3 0 0 0 3 2.4h14.6a3 3 0 0 0 2.9-2.3L49 27H24"
        fill="none" stroke="#ffffff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="28" cy="50" r="3.2" fill="#ffffff"/>
  <circle cx="42" cy="50" r="3.2" fill="#ffffff"/>
</svg>
`
);

/* Hero banner --------------------------------------------------------------- */

write(
  'hero.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 520" width="1200" height="520" role="img" aria-label="Season sale">
  <defs>
    <linearGradient id="hero" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#312e81"/>
      <stop offset="55%" stop-color="#4338ca"/>
      <stop offset="100%" stop-color="#0ea5e9"/>
    </linearGradient>
    <radialGradient id="hg" cx="0.75" cy="0.25" r="0.8">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="520" fill="url(#hero)"/>
  <rect width="1200" height="520" fill="url(#hg)"/>
  <circle cx="960" cy="130" r="170" fill="#ffffff" opacity="0.08"/>
  <circle cx="1080" cy="400" r="220" fill="#ffffff" opacity="0.06"/>
  <circle cx="150" cy="430" r="150" fill="#000000" opacity="0.07"/>
  <g fill="#ffffff" opacity="0.16" transform="translate(830 150) scale(2.6)">
    <g>${GLYPHS.laptop}</g>
  </g>
</svg>
`
);

process.stdout.write(
  `Generated ${productCount} product images, ${categoryCount} category images, logo.svg and hero.svg\n`
);
