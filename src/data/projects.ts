// ---------------------------------------------------------------------------
// NUUKE case studies.
//
// Brand facts, imagery, colours and TikTok videos come from each brand's own
// public website and social accounts (see brands.json). Campaign names,
// strategy copy, scripts and results below are PLACEHOLDER mock-ups written
// for layout review. Replace them with real NUUKE work, and make sure you have
// permission to show each brand, before this site goes live.
// ---------------------------------------------------------------------------
import brandData from './brands.json';

export type Category = 'paid-ads' | 'ugc' | 'content' | 'branding' | 'influencer';

export const CATEGORIES: { id: Category | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'paid-ads', label: 'Paid Ads' },
  { id: 'ugc', label: 'UGC' },
  { id: 'content', label: 'Content Creation' },
  { id: 'branding', label: 'Branding' },
  { id: 'influencer', label: 'Influencer' },
];

export const categoryLabel = (c: Category) => CATEGORIES.find((x) => x.id === c)!.label;

export type ModelKind =
  | 'bottle'
  | 'tin'
  | 'pouch'
  | 'box'
  | 'can'
  | 'jar'
  | 'tube'
  | 'compact'
  | 'rug'
  | 'blanket'
  | 'oven'
  | 'stack'
  | 'backpack'
  | 'wallet'
  | 'band';

export interface Kpi {
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  label: string;
}

export interface BrandImage {
  url: string;
  kind: 'lifestyle' | 'product';
  alt: string;
}

export interface BrandVideo {
  id: string;
  url: string;
  author: string;
  title: string;
}

export interface Project {
  slug: string;
  client: string;
  title: string;
  /** Short line shown under the tile on the Projects grid. */
  description: string;
  categories: Category[];
  year: number;
  services: string[];
  platforms: string[];
  /** Everyday noun for what the brand sells, used in scripts ("olive oil"). */
  noun: string;
  model: ModelKind;
  website: string;
  tagline: string;
  products: string[];
  colors: { hex: string; name: string }[];
  fonts: string[];
  logo?: string;
  cover: string;
  images: BrandImage[];
  videos: BrandVideo[];
  kpis: Kpi[];
  summary: string;
  challenge: string;
  approach: string;
}

interface BrandJson {
  slug: string;
  name?: string;
  website?: string;
  tagline?: string;
  products?: string[];
  tiktokVideos?: BrandVideo[];
  images?: BrandImage[];
  logo?: string | { url: string };
  colors?: { hex: string; name: string }[];
  fonts?: string[];
}

type Written = Omit<
  Project,
  'website' | 'tagline' | 'products' | 'colors' | 'fonts' | 'logo' | 'cover' | 'images' | 'videos'
> & { colors: string[]; fallbackImages: string[] };

const U = (id: string, w = 1600) => `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`;

const written: Written[] = [
  {
    slug: 'graza',
    client: 'Graza',
    title: 'Squeeze The Day',
    description: 'Creator-led UGC engine for the Drizzle & Sizzle squeeze bottles',
    categories: ['ugc', 'paid-ads', 'content'],
    year: 2026,
    services: ['UGC production', 'Creator scripting', 'Spark Ads', 'Performance creative'],
    platforms: ['TikTok', 'Instagram Reels', 'Meta Ads'],
    noun: 'olive oil',
    model: 'bottle',
    colors: ['#2f5d3a', '#cfe07a', '#f4efe2'],
    fallbackImages: ['photo-1474979266404-7eaacbcd87c5', 'photo-1506368249639-73a05d6f6488'],
    kpis: [
      { value: 42, suffix: 'M', label: 'Organic views' },
      { value: 3.8, suffix: 'x', decimals: 1, label: 'ROAS on Spark Ads' },
      { value: 160, label: 'Creator videos shipped' },
    ],
    summary: 'A squeeze-first content system that made cooking with olive oil feel like a trend, not a chore.',
    challenge: 'Olive oil is a crowded, glass-bottle category. Graza’s squeeze bottle is the hook, but it only lands when people see it in real kitchens, in real hands.',
    approach: 'We cast home cooks and food creators, scripted around the “squeeze moment”, and ran the top performers as Spark Ads within 48 hours of posting. Winning hooks were re-cut weekly into new variants.',
  },
  {
    slug: 'fishwife',
    client: 'Fishwife',
    title: 'Tinned Fish Summer',
    description: 'Brand world, content studio and creator seeding for premium tinned fish',
    categories: ['branding', 'content', 'influencer'],
    year: 2026,
    services: ['Brand world', 'Art direction', 'Content production', 'Creator seeding'],
    platforms: ['Instagram', 'TikTok', 'Pinterest'],
    noun: 'tinned fish',
    model: 'tin',
    colors: ['#f2c6d2', '#1f3d7a', '#f6efe1', '#e8573f'],
    fallbackImages: ['photo-1534482421-64566f976cfa', 'photo-1519708227418-c8fd9a32b7a2'],
    kpis: [
      { value: 18, suffix: 'M', label: 'Impressions' },
      { value: 240, label: 'Creators seeded' },
      { value: 36, suffix: '%', label: 'Lift in branded search' },
    ],
    summary: 'We turned the tin into a table centrepiece: art-directed spreads, collectible visuals and a creator program built around the “tin date”.',
    challenge: 'Tinned fish was having a moment, but most content looked the same. Fishwife needed a visual language as distinctive as its illustrated tins.',
    approach: 'We built a brand world from the packaging illustrations, shot a library of “tin spread” content, and seeded boxes to 240 food and lifestyle creators with a simple brief: make it a moment.',
  },
  {
    slug: 'omsom',
    client: 'Omsom',
    title: 'Starter Pack',
    description: 'Short-form recipe content and UGC for bold Asian sauce starters',
    categories: ['ugc', 'content', 'paid-ads'],
    year: 2025,
    services: ['Recipe content', 'UGC production', 'Paid social'],
    platforms: ['TikTok', 'Instagram Reels'],
    noun: 'sauce starter',
    model: 'pouch',
    colors: ['#f9423a', '#ffd23f', '#111111', '#f4efe9'],
    fallbackImages: ['photo-1512058564366-18510be2db19', 'photo-1569718212165-3a8278d5f624'],
    kpis: [
      { value: 22, suffix: 'M', label: 'Recipe video views' },
      { value: 41, suffix: '%', label: 'Lower cost per purchase' },
      { value: 96, label: 'Recipes filmed' },
    ],
    summary: 'Fifteen-minute dinners filmed in fifteen seconds: a recipe-first content engine for Omsom’s starters.',
    challenge: 'Shoppers loved the flavours once they tried them, but the product is hard to explain in a thumbnail.',
    approach: 'We led every video with the finished dish, then reverse-engineered the recipe in three cuts. Creators cooked in their own kitchens, and the best edits became always-on ads.',
  },
  {
    slug: 'magic-spoon',
    client: 'Magic Spoon',
    title: 'Cereal, Rebuilt',
    description: 'Performance ads and UGC for high-protein cereal',
    categories: ['paid-ads', 'ugc'],
    year: 2025,
    services: ['Performance creative', 'UGC production', 'Creative testing'],
    platforms: ['Meta Ads', 'TikTok', 'YouTube Shorts'],
    noun: 'cereal',
    model: 'box',
    colors: ['#6d5bd0', '#ffb3c7', '#ffe066', '#7fd1ae'],
    fallbackImages: ['photo-1521483451569-e33803c0330c', 'photo-1517686469429-8bdb88b9f907'],
    kpis: [
      { value: 4.2, suffix: 'x', decimals: 1, label: 'ROAS' },
      { value: 380, label: 'Ad variants tested' },
      { value: 29, suffix: '%', label: 'Lower CAC' },
    ],
    summary: 'A testing machine for nostalgic cereal with grown-up macros.',
    challenge: 'The promise (childhood cereal, high protein, low sugar) is three messages. Ads that tried to say all three said nothing.',
    approach: 'We split the message into three hook families, produced 380 variants with creators and motion templates, and let the data pick the winners every week.',
  },
  {
    slug: 'chamberlain-coffee',
    client: 'Chamberlain Coffee',
    title: 'Morning Chaos Club',
    description: 'Creator community and content for a creator-founded coffee brand',
    categories: ['influencer', 'content', 'ugc'],
    year: 2026,
    services: ['Creator program', 'Content production', 'Community'],
    platforms: ['TikTok', 'Instagram', 'YouTube Shorts'],
    noun: 'coffee',
    model: 'can',
    colors: ['#f7d6e0', '#1d1d1b', '#f3e9dc', '#9ec5a8'],
    fallbackImages: ['photo-1509042239860-f550ce710b93', 'photo-1461023058943-07fcbe16d735'],
    kpis: [
      { value: 31, suffix: 'M', label: 'Views' },
      { value: 150, label: 'Creators in the club' },
      { value: 24, suffix: '%', label: 'Repeat purchase lift' },
    ],
    summary: 'A creator club built around the messy, honest morning routine the brand was founded on.',
    challenge: 'The founder’s voice is the brand. Scaling content without diluting that voice was the brief.',
    approach: 'We recruited 150 creators whose mornings genuinely look like the brand’s, gave them a loose monthly theme and let them make it theirs. We only amplified what felt native.',
  },
  {
    slug: 'kopari',
    client: 'Kopari',
    title: 'Melt Moments',
    description: 'UGC and paid social for coconut-based body care',
    categories: ['ugc', 'paid-ads'],
    year: 2025,
    services: ['UGC production', 'Paid social', 'Creative testing'],
    platforms: ['TikTok', 'Instagram Reels', 'Meta Ads'],
    noun: 'body care',
    model: 'jar',
    colors: ['#f2a7b8', '#ffffff', '#1c3f5e', '#f7d9a8'],
    fallbackImages: ['photo-1570194065650-d99fb4bedf0a', 'photo-1556228578-8c89e6adf883'],
    kpis: [
      { value: 3.1, suffix: 'x', decimals: 1, label: 'ROAS' },
      { value: 210, label: 'UGC assets' },
      { value: 38, suffix: '%', label: 'Lower CPA' },
    ],
    summary: 'Texture shots, real routines and one simple claim: it melts.',
    challenge: 'Body care is bought on feel. You can’t feel a video, so the content had to make texture visible.',
    approach: 'Macro texture shots opened every ad, followed by creator routines in real bathrooms. We tested hooks in batches of 20 and scaled the winners.',
  },
  {
    slug: 'tower-28',
    client: 'Tower 28',
    title: 'SOS Skin Stories',
    description: 'Creator stories and UGC for sensitive-skin beauty',
    categories: ['ugc', 'influencer', 'content'],
    year: 2026,
    services: ['Creator partnerships', 'UGC production', 'Content strategy'],
    platforms: ['TikTok', 'Instagram'],
    noun: 'skincare',
    model: 'tube',
    colors: ['#f5b1c4', '#b8e3dc', '#fff4d6', '#1d1d1d'],
    fallbackImages: ['photo-1596462502278-27bfdc403348', 'photo-1512496015851-a90fb38ba796'],
    kpis: [
      { value: 27, suffix: 'M', label: 'Views' },
      { value: 88, suffix: '%', label: 'Positive sentiment' },
      { value: 120, label: 'Skin stories filmed' },
    ],
    summary: 'Real people with real sensitive skin, telling the story in their own words.',
    challenge: 'Sensitive-skin claims are easy to make and hard to believe.',
    approach: 'We cast creators with eczema, rosacea and reactive skin, filmed honest before/after routines, and built an always-on story format audiences could trust.',
  },
  {
    slug: 'saie',
    client: 'Saie',
    title: 'Glow, Unfiltered',
    description: 'Visual identity refresh and content for clean everyday makeup',
    categories: ['branding', 'content', 'ugc'],
    year: 2025,
    services: ['Visual identity', 'Art direction', 'Content production'],
    platforms: ['Instagram', 'TikTok'],
    noun: 'makeup',
    model: 'compact',
    colors: ['#f4e3d7', '#c98f6f', '#2b2b2b', '#fbf7f2'],
    fallbackImages: ['photo-1522335789203-aabd1fc54bc9', 'photo-1515688594390-b649af70d282'],
    kpis: [
      { value: 14, suffix: 'M', label: 'Impressions' },
      { value: 2.6, suffix: 'x', decimals: 1, label: 'Engagement rate lift' },
      { value: 64, label: 'Content kits shipped' },
    ],
    summary: 'A softer, dewier visual system for social, built to feel like your camera roll.',
    challenge: 'The brand looked polished on its site but got lost in a feed full of glossy beauty ads.',
    approach: 'We built a social identity (type, grids, colour and motion rules), then shot content kits in natural light that creators could remix.',
  },
  {
    slug: 'dieux-skin',
    client: 'Dieux',
    title: 'Angel Rituals',
    description: 'Brand system, docs and content for ingredient-first skincare',
    categories: ['branding', 'content', 'ugc'],
    year: 2026,
    services: ['Brand system', 'Packaging content', 'Content production'],
    platforms: ['Instagram', 'TikTok'],
    noun: 'skincare',
    model: 'jar',
    colors: ['#e9e4f2', '#1f1f1f', '#f6f2ea', '#b7a7d6'],
    fallbackImages: ['photo-1556228720-195a672e8a03', 'photo-1570172619644-dfd03ed5d881'],
    kpis: [
      { value: 11, suffix: 'M', label: 'Impressions' },
      { value: 3.4, suffix: 'x', decimals: 1, label: 'Save rate lift' },
      { value: 48, label: 'Ingredient explainers' },
    ],
    summary: 'Science-literate skincare, made beautiful: an ingredient-first content system with a clear visual rulebook.',
    challenge: 'Ingredient content is usually either clinical or cute. Dieux wanted smart and good-looking.',
    approach: 'We designed an ingredient explainer system (layouts, iconography and colour coding per active) and filmed rituals that show the formula working.',
  },
  {
    slug: 'ruggable',
    client: 'Ruggable',
    title: 'The Spill Test',
    description: 'UGC and paid social proving washable rugs actually wash',
    categories: ['ugc', 'paid-ads'],
    year: 2025,
    services: ['UGC production', 'Performance creative', 'Paid social'],
    platforms: ['TikTok', 'Meta Ads', 'Pinterest'],
    noun: 'rug',
    model: 'rug',
    colors: ['#2b4a3f', '#e9dcc6', '#c96f4a', '#f7f3ec'],
    fallbackImages: ['photo-1600166898405-da9535204843', 'photo-1586023492125-27b2c045efd7'],
    kpis: [
      { value: 36, suffix: 'M', label: 'Views' },
      { value: 3.3, suffix: 'x', decimals: 1, label: 'ROAS' },
      { value: 32, suffix: '%', label: 'Lower CPA' },
    ],
    summary: 'Coffee, wine, muddy paws. Then the washing machine.',
    challenge: 'Everybody says their rug is easy to clean. Ruggable had to show it.',
    approach: 'We built one repeatable format, the spill test, and filmed it with pet owners, parents and renters. Each version ended at the washing machine.',
  },
  {
    slug: 'bearaby',
    client: 'Bearaby',
    title: 'Nap Better',
    description: 'Calm content, creator partnerships and paid social for weighted blankets',
    categories: ['content', 'influencer', 'paid-ads'],
    year: 2025,
    services: ['Content production', 'Creator partnerships', 'Paid social'],
    platforms: ['Instagram', 'TikTok', 'Meta Ads'],
    noun: 'weighted blanket',
    model: 'blanket',
    colors: ['#c9b8a6', '#6f7d6a', '#efe8df', '#2f2f2f'],
    fallbackImages: ['photo-1522771739844-6a9f6d5f14af', 'photo-1540518614846-7eded433c457'],
    kpis: [
      { value: 19, suffix: 'M', label: 'Impressions' },
      { value: 2.9, suffix: 'x', decimals: 1, label: 'ROAS' },
      { value: 70, label: 'Sleep creators' },
    ],
    summary: 'The slowest content on the feed, on purpose.',
    challenge: 'Everything on social is loud. Selling calm needed the opposite energy.',
    approach: 'We shot long, quiet, ASMR-adjacent content and partnered with sleep and wellness creators, then ran it at night when people were winding down.',
  },
  {
    slug: 'ooni',
    client: 'Ooni',
    title: 'Pizza Night, Anywhere',
    description: 'UGC, content and creator program for portable pizza ovens',
    categories: ['ugc', 'content', 'influencer'],
    year: 2026,
    services: ['UGC production', 'Recipe content', 'Creator program'],
    platforms: ['TikTok', 'Instagram Reels', 'YouTube Shorts'],
    noun: 'pizza oven',
    model: 'oven',
    colors: ['#1d1d1b', '#f4f1ea', '#e4572e', '#ffc857'],
    fallbackImages: ['photo-1513104890138-7c749659a591', 'photo-1565299624946-b28f40a0ae38'],
    kpis: [
      { value: 51, suffix: 'M', label: 'Views' },
      { value: 300, label: 'Pizza nights filmed' },
      { value: 27, suffix: '%', label: 'Lift in branded search' },
    ],
    summary: 'Sixty-second pizza, filmed in backyards, balconies and campsites.',
    challenge: 'Pizza ovens are a considered purchase. People needed to picture it in their life, not a showroom.',
    approach: 'We built a creator program of home pizza makers, standardised a “first pie” format, and turned the best into paid assets for peak BBQ season.',
  },
  {
    slug: 'parachute',
    client: 'Parachute',
    title: 'Slow Mornings',
    description: 'Art direction, content and paid social for luxury bedding and bath',
    categories: ['branding', 'content', 'paid-ads'],
    year: 2025,
    services: ['Art direction', 'Content production', 'Paid social'],
    platforms: ['Instagram', 'Pinterest', 'Meta Ads'],
    noun: 'bedding',
    model: 'stack',
    colors: ['#efe7dc', '#b9a58c', '#6b6457', '#ffffff'],
    fallbackImages: ['photo-1505693416388-ac5ce068fe85', 'photo-1522771739844-6a9f6d5f14af'],
    kpis: [
      { value: 16, suffix: 'M', label: 'Impressions' },
      { value: 3.0, suffix: 'x', decimals: 1, label: 'ROAS' },
      { value: 45, suffix: '%', label: 'Save rate lift' },
    ],
    summary: 'A slow-living visual system for social: linen, light and lived-in rooms.',
    challenge: 'Premium bedding looks the same in every catalogue. The brand wanted to sell a feeling.',
    approach: 'We wrote an art direction rulebook (light, texture, colour, framing) and shot seasonal content in real homes, then built paid variations around each room.',
  },
  {
    slug: 'naadam',
    client: 'Naadam',
    title: 'The Sweater Test',
    description: 'Performance ads and UGC for affordable cashmere',
    categories: ['paid-ads', 'ugc'],
    year: 2026,
    services: ['Performance creative', 'UGC production', 'Creative testing'],
    platforms: ['Meta Ads', 'TikTok', 'Instagram'],
    noun: 'cashmere sweater',
    model: 'stack',
    colors: ['#d9c7b0', '#2d2d2d', '#f3eee7', '#8c7a66'],
    fallbackImages: ['photo-1576566588028-4147f3842f27', 'photo-1434389677669-e08b4cac3105'],
    kpis: [
      { value: 3.6, suffix: 'x', decimals: 1, label: 'ROAS' },
      { value: 260, label: 'Ad variants' },
      { value: 35, suffix: '%', label: 'Lower CAC' },
    ],
    summary: 'Real people comparing a $75 cashmere sweater to ones that cost five times more.',
    challenge: 'At that price, people assume the quality isn’t there.',
    approach: 'We built a blind comparison format with creators and stylists, then turned the reactions into a library of hooks for paid.',
  },
  {
    slug: 'cotopaxi',
    client: 'Cotopaxi',
    title: 'Del Día Drops',
    description: 'Brand content, creator trips and visual system for outdoor gear',
    categories: ['content', 'influencer', 'branding'],
    year: 2025,
    services: ['Content production', 'Creator trips', 'Visual system'],
    platforms: ['Instagram', 'TikTok', 'YouTube'],
    noun: 'backpack',
    model: 'backpack',
    colors: ['#e5533d', '#f2b134', '#2a9d8f', '#264653', '#f4a261'],
    fallbackImages: ['photo-1501555088652-021faa106b9b', 'photo-1551632811-561732d1e306'],
    kpis: [
      { value: 24, suffix: 'M', label: 'Impressions' },
      { value: 12, label: 'Creator trips' },
      { value: 2.8, suffix: 'x', decimals: 1, label: 'Engagement lift' },
    ],
    summary: 'Every bag is one of a kind, so every drop got its own story.',
    challenge: 'Colourful, one-off products need content that moves as fast as the drops do.',
    approach: 'We took creators on trips, built a colour-led visual system for drops, and turned each release into a short series.',
  },
  {
    slug: 'ridge',
    client: 'Ridge',
    title: 'Pocket Check',
    description: 'Performance ads and UGC for minimalist metal wallets',
    categories: ['paid-ads', 'ugc'],
    year: 2026,
    services: ['Performance creative', 'UGC production', 'YouTube pre-roll'],
    platforms: ['Meta Ads', 'TikTok', 'YouTube'],
    noun: 'wallet',
    model: 'wallet',
    colors: ['#1a1a1a', '#8a8f98', '#c9a66b', '#f2f2f2'],
    fallbackImages: ['photo-1627123424574-724758594e93', 'photo-1606503825008-909a67e63c3d'],
    kpis: [
      { value: 4.4, suffix: 'x', decimals: 1, label: 'ROAS' },
      { value: 500, label: 'Hooks tested' },
      { value: 30, suffix: '%', label: 'Lower CPA' },
    ],
    summary: 'The bulky wallet vs. the Ridge, in every pocket on the internet.',
    challenge: 'Wallet ads are a saturated format. Every angle has been tried.',
    approach: 'We ran a hook factory: 500 openers, 20 creators and weekly kill/scale decisions, with the best hooks rotated into YouTube and Meta.',
  },
  {
    slug: 'vuori',
    client: 'Vuori',
    title: 'Everyday Motion',
    description: 'Lifestyle content, athlete-creators and paid social for activewear',
    categories: ['content', 'influencer', 'paid-ads'],
    year: 2025,
    services: ['Content production', 'Creator partnerships', 'Paid social'],
    platforms: ['Instagram', 'TikTok', 'Meta Ads'],
    noun: 'activewear',
    model: 'stack',
    colors: ['#2f3a45', '#c7d3d8', '#f4efe7', '#8a9a8b'],
    fallbackImages: ['photo-1518611012118-696072aa579a', 'photo-1506629082955-511b1aa562c8'],
    kpis: [
      { value: 28, suffix: 'M', label: 'Impressions' },
      { value: 3.2, suffix: 'x', decimals: 1, label: 'ROAS' },
      { value: 60, label: 'Athlete-creators' },
    ],
    summary: 'From the morning surf to the afternoon meeting: content for clothes you don’t change out of.',
    challenge: 'Activewear content is either gym-hard or catalogue-soft. Vuori sits in between.',
    approach: 'We followed athlete-creators through full days, shot the transitions, and cut them into paid and organic series.',
  },
  {
    slug: 'peak-design',
    client: 'Peak Design',
    title: 'Carry Better',
    description: 'Product content, UGC and paid for camera bags and travel gear',
    categories: ['content', 'ugc', 'paid-ads'],
    year: 2026,
    services: ['Product content', 'UGC production', 'Paid social'],
    platforms: ['YouTube', 'Instagram', 'TikTok'],
    noun: 'camera bag',
    model: 'backpack',
    colors: ['#2e2e2e', '#9aa0a6', '#d9d4c7', '#e3572b'],
    fallbackImages: ['photo-1516035069371-29a1b244cc32', 'photo-1553062407-98eeb64c6a62'],
    kpis: [
      { value: 20, suffix: 'M', label: 'Views' },
      { value: 3.5, suffix: 'x', decimals: 1, label: 'ROAS' },
      { value: 140, label: 'Feature demos' },
    ],
    summary: 'Every clip, zip and divider, shown by the photographers who use them.',
    challenge: 'The bags are packed with clever details that don’t show in a still photo.',
    approach: 'We filmed feature demos with working photographers and turned each detail into its own short, then sequenced them in paid.',
  },
  {
    slug: 'nomatic',
    client: 'Nomatic',
    title: 'Pack With Me',
    description: 'UGC and creator travel content for travel bags',
    categories: ['ugc', 'influencer', 'content'],
    year: 2025,
    services: ['UGC production', 'Creator partnerships', 'Content production'],
    platforms: ['TikTok', 'YouTube Shorts', 'Instagram'],
    noun: 'travel bag',
    model: 'backpack',
    colors: ['#111111', '#4b4b4b', '#e8e6e1', '#c0392b'],
    fallbackImages: ['photo-1553062407-98eeb64c6a62', 'photo-1488646953014-85cb44e25828'],
    kpis: [
      { value: 26, suffix: 'M', label: 'Views' },
      { value: 110, label: 'Pack-with-me videos' },
      { value: 25, suffix: '%', label: 'Conversion lift' },
    ],
    summary: 'The internet’s favourite travel format, owned by one bag.',
    challenge: 'Travel bags are judged on capacity and organisation, which is hard to see from the outside.',
    approach: 'We built a pack-with-me format with frequent-flyer creators, filmed top-down, and ended every video at the overhead bin.',
  },
  {
    slug: 'whoop',
    client: 'WHOOP',
    title: 'Recovery Receipts',
    description: 'Athlete-creator program and paid social for a recovery wearable',
    categories: ['influencer', 'paid-ads', 'content'],
    year: 2026,
    services: ['Creator program', 'Performance creative', 'Data storytelling'],
    platforms: ['Instagram', 'TikTok', 'YouTube'],
    noun: 'wearable',
    model: 'band',
    colors: ['#000000', '#ffffff', '#00f19f', '#ff5f5f'],
    fallbackImages: ['photo-1571019613454-1cb2f99b2d8b', 'photo-1517836357463-d25dfeac3438'],
    kpis: [
      { value: 33, suffix: 'M', label: 'Views' },
      { value: 3.9, suffix: 'x', decimals: 1, label: 'ROAS' },
      { value: 90, label: 'Athlete-creators' },
    ],
    summary: 'Creators showed their data: sleep, strain and recovery, straight from the app.',
    challenge: 'Wearable ads talk about features. People care about what the numbers say about them.',
    approach: 'We gave athlete-creators a format built around their own recovery scores and turned the most surprising “receipts” into paid social.',
  },
];

const brands = new Map((brandData as BrandJson[]).map((b) => [b.slug, b]));

export const PROJECTS: Project[] = written.map((w) => {
  const b = brands.get(w.slug) ?? ({ slug: w.slug } as BrandJson);
  const { fallbackImages, colors, ...rest } = w;
  const images: BrandImage[] =
    b.images && b.images.length
      ? b.images
      : fallbackImages.map((id) => ({ url: U(id), kind: 'lifestyle' as const, alt: `${w.client}` }));
  const cover = (images.find((i) => i.kind === 'lifestyle') ?? images[0]).url;
  const logo = typeof b.logo === 'string' ? b.logo : b.logo?.url;
  return {
    ...rest,
    website: b.website ?? '',
    tagline: b.tagline ?? w.description,
    products: b.products?.length ? b.products : [w.client],
    colors: b.colors?.length ? b.colors : colors.map((hex, i) => ({ hex, name: `Brand ${i + 1}` })),
    fonts: b.fonts ?? [],
    logo,
    cover,
    images,
    videos: b.tiktokVideos ?? [],
  };
});

export const getProject = (slug: string) => PROJECTS.find((p) => p.slug === slug);

export const categoryCount = (id: Category | 'all') =>
  id === 'all' ? PROJECTS.length : PROJECTS.filter((p) => p.categories.includes(id)).length;

/** Portrait frames for the World page, drawn from every brand's imagery. */
export const WORLD_MEDIA = PROJECTS.flatMap((p) => p.images.slice(0, 4).map((i) => ({ url: i.url, project: p })));
