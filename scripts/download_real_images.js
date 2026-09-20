// scripts/download_real_images.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const CATEGORIES = {
  'electronics': 'photo-1498049794561-7780e7231661',
  'laptops': 'photo-1517336714731-489689fd1ca8',
  'smartphones': 'photo-1511707171634-5f897ff02aa9',
  'accessories': 'photo-1527443224154-c4a3942d3acf',
  'gaming': 'photo-1542751371-adc38448a05e',
  'home-appliances': 'photo-1556911220-e15b29be8c8f',
  'fashion': 'photo-1445205170230-053b83016050'
};

const PRODUCTS = {
  // Electronics
  'aurora-55-4k-smart-tv': 'photo-1593359677879-a4bb92f829d1',
  'nimbus-anc-headphones': 'photo-1505740420928-5e560c06d30e',
  'pulse-bluetooth-speaker': 'photo-1545454675-3531b543be5d',
  'zenith-smart-watch': 'photo-1523275335684-37898b6baf30',
  'orbit-action-camera': 'photo-1526170375885-4d8ecf77b99f',
  'lumen-mirrorless-camera': 'photo-1516035069371-29a1b244cc32',

  // Laptops
  'stratos-ultrabook-14': 'photo-1496181133206-80ce9b88a853',
  'titan-gaming-laptop-15': 'photo-1603302576837-37561b2e2302',
  'vector-business-13': 'photo-1588872657578-7efd1f1555ed',
  'flex-2in1-convertible': 'photo-1541807084-5c52b6b3adef',
  'creator-pro-16': 'photo-1525547719571-a2d4ac8945e2',
  'breeze-chromebook-11': 'photo-1498050108023-c5249f4df085',

  // Smartphones
  'apex-pro-max': 'photo-1592750475338-74b7b21085ab',
  'nova-neo-5g': 'photo-1565849904461-04a58ad377e0',
  'pulse-lite-4g': 'photo-1580910051074-3eb694886505',
  'fold-x-flip': 'photo-1585060544812-6b45742d762f',
  'terra-rugged-5g': 'photo-1533228876829-65c94e7b5025',

  // Accessories
  'clack-mechanical-keyboard': 'photo-1587829741301-dc798b83add3',
  'glide-wireless-mouse': 'photo-1615663245857-ac93bb7c39e7',
  'port-usbc-hub-9in1': 'photo-1625842268584-8f3296236761',
  'vault-portable-ssd-1tb': 'photo-1597872200969-2b65d56bd16b',
  'core-ram-16gb-ddr5': 'photo-1562976540-1502c2145186',
  'volt-65w-gan-charger': 'photo-1583863788434-e58a36330cf0',
  'shield-laptop-sleeve-14': 'photo-1544816155-12df9643f363',
  'focus-1080p-webcam': 'photo-1588508065123-287b28e013da',
  'vista-27-4k-monitor': 'photo-1527443224154-c4a3942d3acf',
  'amp-power-bank-20000': 'photo-1609091839311-d5365f9ff1c5',

  // Gaming
  'strike-gaming-mouse': 'photo-1527864550417-7fd91fc51a46',
  'echo-gaming-headset': 'photo-1599669454699-248893623440',
  'throne-gaming-chair': 'photo-1598550476439-6847785fcea6',
  'axis-controller-pro': 'photo-1600080972464-8e5f35f63d08',
  'expanse-rgb-mousepad': 'photo-1616440347437-b1c73416efc2',
  'velocity-144hz-monitor': 'photo-1547082299-de196ea013d6',

  // Home Appliances
  'pure-air-purifier': 'photo-1585771724684-38269d6639fd',
  'sweep-robot-vacuum': 'photo-1558317374-067fb5f30001',
  'warm-microwave-28l': 'photo-1585659722983-3a675dabf23d',
  'brew-espresso-machine': 'photo-1517668808822-9ebb02f2a0e6',
  'rapid-electric-kettle': 'photo-1576092768241-dec231879fc3',
  'chill-refrigerator-340l': 'photo-1584992236310-6edddc08acff',

  // Fashion
  'trail-running-shoes': 'photo-1542291026-7eec264c27ff',
  'rugged-denim-jacket': 'photo-1576995853123-5a10305d93c0',
  'daily-cotton-tshirt': 'photo-1521572267360-ee0c2909d518',
  'metro-leather-backpack': 'photo-1548036328-c9fa89d128fa',
  'horizon-sunglasses': 'photo-1511499767150-a48a237f0083',
  'classic-analog-watch': 'photo-1524805444758-089113d48a6d',

  // Fallback Placeholder
  'placeholder': 'photo-1560343090-f0409e92791a'
};

const HERO = {
  'hero': 'photo-1441986300917-64674bd600d8'
};

function getUnsplashUrl(id, width = 800, height = 800) {
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&h=${height}&q=80`;
}

async function downloadFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buffer);
  return buffer;
}

function createSvgWrapper(base64Jpeg, width = 800, height = 800) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <image href="data:image/jpeg;base64,${base64Jpeg}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" />
</svg>
`;
}

async function run() {
  console.log('Starting download of real images...');
  const productsDir = path.join(rootDir, 'frontend', 'public', 'images', 'products');
  const categoriesDir = path.join(rootDir, 'frontend', 'public', 'images', 'categories');
  const imagesDir = path.join(rootDir, 'frontend', 'public', 'images');

  fs.mkdirSync(productsDir, { recursive: true });
  fs.mkdirSync(categoriesDir, { recursive: true });

  // 1. Categories
  for (const [slug, photoId] of Object.entries(CATEGORIES)) {
    console.log(`Downloading category [${slug}]...`);
    const jpgPath = path.join(categoriesDir, `${slug}.jpg`);
    const svgPath = path.join(categoriesDir, `${slug}.svg`);
    const url = getUnsplashUrl(photoId, 600, 600);
    const buffer = await downloadFile(url, jpgPath);
    const svgContent = createSvgWrapper(buffer.toString('base64'), 600, 600);
    fs.writeFileSync(svgPath, svgContent);
    console.log(`  -> Saved ${slug}.jpg & ${slug}.svg`);
  }

  // 2. Products
  for (const [slug, photoId] of Object.entries(PRODUCTS)) {
    console.log(`Downloading product [${slug}]...`);
    const jpgPath = path.join(productsDir, `${slug}.jpg`);
    const svgPath = path.join(productsDir, `${slug}.svg`);
    const url = getUnsplashUrl(photoId, 800, 800);
    const buffer = await downloadFile(url, jpgPath);
    const svgContent = createSvgWrapper(buffer.toString('base64'), 800, 800);
    fs.writeFileSync(svgPath, svgContent);
    console.log(`  -> Saved ${slug}.jpg & ${slug}.svg`);
  }

  // 3. Hero banner (1200x520)
  for (const [slug, photoId] of Object.entries(HERO)) {
    console.log(`Downloading hero [${slug}]...`);
    const jpgPath = path.join(imagesDir, `${slug}.jpg`);
    const svgPath = path.join(imagesDir, `${slug}.svg`);
    const url = getUnsplashUrl(photoId, 1200, 520);
    const buffer = await downloadFile(url, jpgPath);
    const svgContent = createSvgWrapper(buffer.toString('base64'), 1200, 520);
    fs.writeFileSync(svgPath, svgContent);
    console.log(`  -> Saved ${slug}.jpg & ${slug}.svg`);
  }

  console.log('All real images downloaded and converted successfully!');
}

run().catch((err) => {
  console.error('Error downloading images:', err);
  process.exit(1);
});
