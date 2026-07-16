/**
 * The starter catalog — onboarding's first stock.
 *
 * Thirty curated dishes across six cuisines. Picking them seeds real shelf
 * recipes (source_platform 'starter', dedupe key mcpeels://starter/<id>), so
 * the first kitchen a user opens rides the exact same genesis rails as the
 * kitchens they later earn by sending links. No AI pass, no network: the
 * catalog is the extraction.
 *
 * Content rules: ingredient names resolve on Instacart search, pantry
 * staples are flagged so they never pad a cart, quantities serve the stated
 * table, and origins keep their names. The trio's canons live on in here —
 * La Milpa's cards and the Bureau's ГОСТ dishes are starter stock now.
 */

import { and, eq, inArray } from 'drizzle-orm';
import { getDb, schema } from '../db/client.js';
import type { Recipe, RecipeIngredient } from '../db/schema.js';
import { validationError } from './errors.js';
import { getHouseholdContext } from './households.js';

export const STARTER_SOURCE_PREFIX = 'mcpeels://starter/';

export interface StarterDish {
  id: string;
  title: string;
  /** Native-script or traditional secondary name; never invented. */
  sub: string | null;
  description: string;
  cuisine: string;
  dishType: string;
  serves: number;
  minutes: number;
  /** Chile scale 0-3; null when heat is not the point. */
  heat: number | null;
  ingredients: RecipeIngredient[];
  steps: string[];
}

export const STARTER_CATALOG: StarterDish[] = [
  // --- Sichuan & Chongqing ---------------------------------------------------
  {
    id: 'xiaomian',
    title: 'Chongqing xiaomian',
    sub: '重庆小面',
    description: 'The alley noodle — chili oil, numbing tingle, ten-minute ritual.',
    cuisine: 'sichuan-chongqing',
    dishType: 'main',
    serves: 2,
    minutes: 20,
    heat: 3,
    ingredients: [
      { name: 'fresh alkaline wheat noodles', quantity: 1, unit: 'lb' },
      { name: 'chili crisp', quantity: 1, unit: 'jar' },
      { name: 'baby bok choy', quantity: 1, unit: 'lb' },
      { name: 'green onions', quantity: 1, unit: 'bunch' },
      { name: 'roasted peanuts', quantity: 1, unit: 'each' },
      { name: 'sichuan peppercorns', pantry: true },
      { name: 'soy sauce', pantry: true },
    ],
    steps: [
      'Build the sauce in the bowl: chili crisp, ground peppercorns, soy, a ladle of noodle water.',
      'Boil the noodles with the bok choy riding on top.',
      'Everything into the bowl; peanuts and scallions over.',
    ],
  },
  {
    id: 'laziji',
    title: 'Chongqing chicken',
    sub: '辣子鸡',
    description: 'Crisp chicken hiding in a mountain of toasted chiles — dig for treasure.',
    cuisine: 'sichuan-chongqing',
    dishType: 'main',
    serves: 4,
    minutes: 45,
    heat: 3,
    ingredients: [
      { name: 'boneless chicken thighs', quantity: 1.5, unit: 'lb' },
      { name: 'dried red chiles', quantity: 4, unit: 'oz' },
      { name: 'garlic', quantity: 1, unit: 'head' },
      { name: 'fresh ginger', quantity: 1, unit: 'each' },
      { name: 'sichuan peppercorns', pantry: true },
      { name: 'cornstarch', pantry: true },
    ],
    steps: [
      'Cube, marinate, and double-fry the chicken until deeply crisp.',
      'Toast the chiles and peppercorns — the kitchen should make you cough a little.',
      'Toss hard, thirty seconds, out.',
    ],
  },
  {
    id: 'mapo-tofu',
    title: 'Mapo tofu',
    sub: '麻婆豆腐',
    description: 'Silken tofu in the bubbling red — doubanjiang doing the talking.',
    cuisine: 'sichuan-chongqing',
    dishType: 'main',
    serves: 4,
    minutes: 30,
    heat: 2,
    ingredients: [
      { name: 'silken tofu', quantity: 2, unit: 'each' },
      { name: 'ground pork', quantity: 0.5, unit: 'lb' },
      { name: 'doubanjiang', quantity: 1, unit: 'jar' },
      { name: 'green onions', quantity: 1, unit: 'bunch' },
      { name: 'jasmine rice', quantity: 2, unit: 'lb' },
      { name: 'sichuan peppercorns', pantry: true },
      { name: 'cornstarch', pantry: true },
    ],
    steps: [
      'Fry the pork hard, then the doubanjiang until the oil runs red.',
      'Tofu in, barely stirred — spoon, never spatula.',
      'Thicken, then ground peppercorns over everything. Rice underneath.',
    ],
  },
  {
    id: 'dandan',
    title: 'Dan dan noodles',
    sub: '担担面',
    description: 'Sesame, chili oil, and pork crumble carried on a shoulder pole.',
    cuisine: 'sichuan-chongqing',
    dishType: 'main',
    serves: 2,
    minutes: 25,
    heat: 2,
    ingredients: [
      { name: 'fresh wheat noodles', quantity: 1, unit: 'lb' },
      { name: 'ground pork', quantity: 0.5, unit: 'lb' },
      { name: 'tahini', quantity: 1, unit: 'jar' },
      { name: 'chili crisp', quantity: 1, unit: 'jar' },
      { name: 'green onions', quantity: 1, unit: 'bunch' },
      { name: 'soy sauce', pantry: true },
    ],
    steps: [
      'Crisp the pork crumble dry in a hot wok.',
      'Sauce in the bowl: tahini, chili crisp, soy, splash of noodle water.',
      'Noodles in, pork over, toss at the table.',
    ],
  },
  {
    id: 'shuizhu-beef',
    title: 'Water-boiled beef',
    sub: '水煮牛肉',
    description: 'Velvet beef under a red broth, finished with oil poured screaming hot.',
    cuisine: 'sichuan-chongqing',
    dishType: 'main',
    serves: 4,
    minutes: 40,
    heat: 3,
    ingredients: [
      { name: 'beef sirloin', quantity: 1.5, unit: 'lb' },
      { name: 'napa cabbage', quantity: 1, unit: 'each' },
      { name: 'doubanjiang', quantity: 1, unit: 'jar' },
      { name: 'dried red chiles', quantity: 2, unit: 'oz' },
      { name: 'garlic', quantity: 1, unit: 'head' },
      { name: 'sichuan peppercorns', pantry: true },
      { name: 'cornstarch', pantry: true },
    ],
    steps: [
      'Slice the beef thin and velvet it in cornstarch.',
      'Fry doubanjiang, add broth, poach the beef over wilted cabbage.',
      'Raw garlic and chiles on top; pour smoking oil over and stand back.',
    ],
  },

  // --- Indian ------------------------------------------------------------------
  {
    id: 'butter-chicken',
    title: 'Butter chicken',
    sub: 'murgh makhani',
    description: 'The gateway gravy — charred thighs in tomato silk.',
    cuisine: 'indian',
    dishType: 'main',
    serves: 4,
    minutes: 60,
    heat: 1,
    ingredients: [
      { name: 'boneless chicken thighs', quantity: 2, unit: 'lb' },
      { name: 'plain whole milk yogurt', quantity: 1, unit: 'each' },
      { name: 'crushed tomatoes', quantity: 28, unit: 'oz' },
      { name: 'heavy cream', quantity: 1, unit: 'each' },
      { name: 'butter', quantity: 1, unit: 'each' },
      { name: 'basmati rice', quantity: 2, unit: 'lb' },
      { name: 'garam masala', pantry: true },
    ],
    steps: [
      'Marinate the chicken in yogurt and spices; char it hard under the broiler.',
      'Simmer tomatoes, butter, and cream into silk.',
      'Marry them. Rice underneath. Silence at the table.',
    ],
  },
  {
    id: 'tikka-masala',
    title: 'Chicken tikka masala',
    sub: null,
    description: 'The other gateway gravy — smokier char, deeper spice.',
    cuisine: 'indian',
    dishType: 'main',
    serves: 4,
    minutes: 60,
    heat: 2,
    ingredients: [
      { name: 'boneless chicken thighs', quantity: 2, unit: 'lb' },
      { name: 'plain whole milk yogurt', quantity: 1, unit: 'each' },
      { name: 'crushed tomatoes', quantity: 28, unit: 'oz' },
      { name: 'heavy cream', quantity: 1, unit: 'each' },
      { name: 'fresh ginger', quantity: 1, unit: 'each' },
      { name: 'garlic', quantity: 1, unit: 'head' },
      { name: 'basmati rice', quantity: 2, unit: 'lb' },
      { name: 'garam masala', pantry: true },
    ],
    steps: [
      'Yogurt-marinate, skewer-char, set aside.',
      'Fry ginger-garlic, spices, tomatoes; cream at the end.',
      'Chicken back in for the last simmer only.',
    ],
  },
  {
    id: 'chana-masala',
    title: 'Chana masala',
    sub: null,
    description: 'Chickpeas in a dark, sour-edged gravy — pantry food with a punch.',
    cuisine: 'indian',
    dishType: 'main',
    serves: 4,
    minutes: 35,
    heat: 2,
    ingredients: [
      { name: 'canned chickpeas', quantity: 2, unit: 'can' },
      { name: 'yellow onions', quantity: 2, unit: 'each' },
      { name: 'roma tomatoes', quantity: 1, unit: 'lb' },
      { name: 'fresh ginger', quantity: 1, unit: 'each' },
      { name: 'garlic', quantity: 1, unit: 'head' },
      { name: 'basmati rice', quantity: 2, unit: 'lb' },
      { name: 'garam masala', pantry: true },
      { name: 'ground cumin', pantry: true },
    ],
    steps: [
      'Brown the onions properly — this is where the gravy comes from.',
      'Ginger, garlic, spices, tomatoes; cook until the oil separates.',
      'Chickpeas in with a splash of their liquid; simmer until it thickens.',
    ],
  },
  {
    id: 'saag-paneer',
    title: 'Saag paneer',
    sub: null,
    description: 'Green velvet with cheese that squeaks — the vegetable dish that converts.',
    cuisine: 'indian',
    dishType: 'main',
    serves: 4,
    minutes: 40,
    heat: 1,
    ingredients: [
      { name: 'paneer', quantity: 1, unit: 'lb' },
      { name: 'fresh spinach', quantity: 2, unit: 'lb' },
      { name: 'yellow onions', quantity: 1, unit: 'each' },
      { name: 'fresh ginger', quantity: 1, unit: 'each' },
      { name: 'garlic', quantity: 1, unit: 'head' },
      { name: 'heavy cream', quantity: 1, unit: 'each' },
      { name: 'garam masala', pantry: true },
    ],
    steps: [
      'Sear the paneer cubes golden; set aside.',
      'Wilt and blitz the spinach with the fried aromatics.',
      'Everything back together with cream; low heat, five minutes.',
    ],
  },
  {
    id: 'dal-tadka',
    title: 'Dal tadka',
    sub: null,
    description: 'Yellow lentils finished with a sizzling pour of spiced ghee.',
    cuisine: 'indian',
    dishType: 'main',
    serves: 4,
    minutes: 40,
    heat: 1,
    ingredients: [
      { name: 'red lentils', quantity: 1, unit: 'lb' },
      { name: 'yellow onions', quantity: 1, unit: 'each' },
      { name: 'roma tomatoes', quantity: 1, unit: 'lb' },
      { name: 'ghee', quantity: 1, unit: 'jar' },
      { name: 'garlic', quantity: 1, unit: 'head' },
      { name: 'basmati rice', quantity: 2, unit: 'lb' },
      { name: 'cumin seeds', pantry: true },
      { name: 'ground turmeric', pantry: true },
    ],
    steps: [
      'Simmer the lentils with turmeric until they collapse.',
      'The tadka: cumin, garlic, and chile bloomed in hot ghee.',
      'Pour it over the dal at the table — the sizzle is the doorbell.',
    ],
  },

  // --- Italian ------------------------------------------------------------------
  {
    id: 'cacio-e-pepe',
    title: 'Cacio e pepe',
    sub: null,
    description: 'Three ingredients, one emulsion, zero forgiveness.',
    cuisine: 'italian',
    dishType: 'main',
    serves: 2,
    minutes: 20,
    heat: null,
    ingredients: [
      { name: 'spaghetti', quantity: 1, unit: 'lb' },
      { name: 'pecorino romano', quantity: 8, unit: 'oz' },
      { name: 'black peppercorns', pantry: true },
    ],
    steps: [
      'Toast cracked pepper dry; add a ladle of starchy pasta water.',
      'Pasta in a minute early; finish it in the pan.',
      'Off heat, cheese in stages, tossing like you mean it.',
    ],
  },
  {
    id: 'weeknight-ragu',
    title: 'Weeknight ragù',
    sub: null,
    description: 'The Sunday sauce, compressed into a Tuesday.',
    cuisine: 'italian',
    dishType: 'main',
    serves: 4,
    minutes: 50,
    heat: null,
    ingredients: [
      { name: 'ground beef', quantity: 1, unit: 'lb' },
      { name: 'crushed tomatoes', quantity: 28, unit: 'oz' },
      { name: 'rigatoni', quantity: 1, unit: 'lb' },
      { name: 'yellow onions', quantity: 1, unit: 'each' },
      { name: 'carrots', quantity: 1, unit: 'lb' },
      { name: 'parmesan', quantity: 1, unit: 'each' },
      { name: 'dried oregano', pantry: true },
    ],
    steps: [
      'Brown the beef in a wide pan and do not rush it.',
      'Soffritto in the fat, tomatoes over, forty quiet minutes.',
      'Finish the rigatoni in the sauce with a knob of butter.',
    ],
  },
  {
    id: 'italian-hoagie',
    title: 'Italian hoagie',
    sub: null,
    description: 'Salami, capicola, provolone — dressed in oil, vinegar, and oregano.',
    cuisine: 'italian',
    dishType: 'main',
    serves: 4,
    minutes: 15,
    heat: null,
    ingredients: [
      { name: 'french bread', quantity: 2, unit: 'each' },
      { name: 'genoa salami', quantity: 0.5, unit: 'lb' },
      { name: 'capicola', quantity: 0.5, unit: 'lb' },
      { name: 'sliced provolone', quantity: 0.5, unit: 'lb' },
      { name: 'shredded lettuce', quantity: 1, unit: 'each' },
      { name: 'roma tomatoes', quantity: 1, unit: 'lb' },
      { name: 'red onions', quantity: 1, unit: 'each' },
      { name: 'red wine vinegar', pantry: true },
      { name: 'dried oregano', pantry: true },
    ],
    steps: [
      'Split the bread; layer meats and cheese with intent.',
      'Lettuce, tomato, onion; oil and vinegar until it glistens.',
      'Oregano like you mean it. Press gently. Six minutes, freaky fresh.',
    ],
  },
  {
    id: 'carbonara',
    title: 'Carbonara',
    sub: null,
    description: 'Eggs, cheese, cured pork, and nerve — no cream, ever.',
    cuisine: 'italian',
    dishType: 'main',
    serves: 2,
    minutes: 25,
    heat: null,
    ingredients: [
      { name: 'spaghetti', quantity: 1, unit: 'lb' },
      { name: 'pancetta', quantity: 0.5, unit: 'lb' },
      { name: 'pecorino romano', quantity: 8, unit: 'oz' },
      { name: 'large eggs', quantity: 1, unit: 'dozen' },
      { name: 'black peppercorns', pantry: true },
    ],
    steps: [
      'Render the pancetta slow until glassy.',
      'Whisk yolks and pecorino into a paste.',
      'Everything together OFF the heat — the pasta cooks the egg, the flame scrambles it.',
    ],
  },
  {
    id: 'chicken-parm',
    title: 'Chicken parm',
    sub: null,
    description: 'Crisp cutlets under marinara and a molten mozzarella roof.',
    cuisine: 'italian',
    dishType: 'main',
    serves: 4,
    minutes: 50,
    heat: null,
    ingredients: [
      { name: 'chicken cutlets', quantity: 1.5, unit: 'lb' },
      { name: 'panko breadcrumbs', quantity: 1, unit: 'each' },
      { name: 'large eggs', quantity: 1, unit: 'dozen' },
      { name: 'marinara sauce', quantity: 1, unit: 'jar' },
      { name: 'mozzarella', quantity: 1, unit: 'lb' },
      { name: 'parmesan', quantity: 1, unit: 'each' },
      { name: 'spaghetti', quantity: 1, unit: 'lb' },
    ],
    steps: [
      'Bread the cutlets: flour, egg, panko-parm. Fry golden.',
      'Sauce and mozzarella on top; broil until it bubbles and spots.',
      'Serve over spaghetti tossed in the same marinara.',
    ],
  },

  // --- American comfort -----------------------------------------------------------
  {
    id: 'breakfast-sandwich',
    title: 'Breakfast sandwich, golden-arches style',
    sub: null,
    description: 'The round egg, the griddled muffin, the cheese at the exact melt point.',
    cuisine: 'american-comfort',
    dishType: 'breakfast',
    serves: 4,
    minutes: 15,
    heat: null,
    ingredients: [
      { name: 'english muffins', quantity: 1, unit: 'pack' },
      { name: 'large eggs', quantity: 1, unit: 'dozen' },
      { name: 'canadian bacon', quantity: 1, unit: 'pack' },
      { name: 'american cheese slices', quantity: 1, unit: 'pack' },
      { name: 'butter', quantity: 1, unit: 'each' },
    ],
    steps: [
      'Griddle the muffins in butter — this is the whole secret.',
      'Cook the eggs in a ring (a mason jar lid works) until just set.',
      'Stack: muffin, cheese, egg, bacon, muffin. Wrap in paper for the full effect.',
    ],
  },
  {
    id: 'smash-burger',
    title: 'Smash burger',
    sub: null,
    description: 'Thin patties smashed hard, edges like lace, cheese folded in the steam.',
    cuisine: 'american-comfort',
    dishType: 'main',
    serves: 4,
    minutes: 25,
    heat: null,
    ingredients: [
      { name: 'ground beef 80/20', quantity: 1.5, unit: 'lb' },
      { name: 'american cheese slices', quantity: 1, unit: 'pack' },
      { name: 'sesame hamburger buns', quantity: 1, unit: 'pack' },
      { name: 'white onions', quantity: 1, unit: 'each' },
      { name: 'dill pickles', quantity: 1, unit: 'jar' },
      { name: 'mayonnaise', quantity: 1, unit: 'each' },
      { name: 'yellow mustard', pantry: true },
    ],
    steps: [
      'Loose balls of beef onto a screaming griddle; smash flat and walk away.',
      'Flip once the edges go dark lace; cheese on immediately.',
      'Steamed bun, sauce, pickles, onion. Eat over the sink like an adult.',
    ],
  },
  {
    id: 'crispy-chicken-sandwich',
    title: 'Crispy chicken sandwich',
    sub: null,
    description: 'Buttermilk-brined thigh, shattering crust, pickles doing the talking.',
    cuisine: 'american-comfort',
    dishType: 'main',
    serves: 4,
    minutes: 45,
    heat: 1,
    ingredients: [
      { name: 'boneless chicken thighs', quantity: 2, unit: 'lb' },
      { name: 'buttermilk', quantity: 1, unit: 'each' },
      { name: 'all-purpose flour', quantity: 2, unit: 'lb' },
      { name: 'brioche buns', quantity: 1, unit: 'pack' },
      { name: 'dill pickles', quantity: 1, unit: 'jar' },
      { name: 'mayonnaise', quantity: 1, unit: 'each' },
      { name: 'cayenne pepper', pantry: true },
    ],
    steps: [
      'Brine the thighs in buttermilk — hours, not minutes.',
      'Dredge in seasoned flour with some brine dribbled in for craggy bits.',
      'Fry to deep gold; mayo, pickles, nothing else.',
    ],
  },
  {
    id: 'mac-and-cheese',
    title: 'Baked mac & cheese',
    sub: null,
    description: 'Custardy inside, burnished top — the casserole that ends arguments.',
    cuisine: 'american-comfort',
    dishType: 'side',
    serves: 4,
    minutes: 50,
    heat: null,
    ingredients: [
      { name: 'elbow macaroni', quantity: 1, unit: 'lb' },
      { name: 'sharp cheddar', quantity: 1, unit: 'lb' },
      { name: 'whole milk', quantity: 0.5, unit: 'gallon' },
      { name: 'butter', quantity: 1, unit: 'each' },
      { name: 'panko breadcrumbs', quantity: 1, unit: 'each' },
      { name: 'all-purpose flour', pantry: true },
      { name: 'ground mustard', pantry: true },
    ],
    steps: [
      'Roux, then milk, then cheese off the heat — sauce that coats a spoon.',
      'Fold in pasta a minute undercooked.',
      'Buttered panko over; bake until the corners go deep brown.',
    ],
  },
  {
    id: 'hash-browns',
    title: 'Diner hash browns',
    sub: null,
    description: 'Shredded, squeezed dry, and pressed into a golden plank.',
    cuisine: 'american-comfort',
    dishType: 'side',
    serves: 4,
    minutes: 30,
    heat: null,
    ingredients: [
      { name: 'russet potatoes', quantity: 3, unit: 'lb' },
      { name: 'butter', quantity: 1, unit: 'each' },
      { name: 'yellow onions', quantity: 1, unit: 'each' },
    ],
    steps: [
      'Shred, rinse, and squeeze the potatoes truly dry — a towel and force.',
      'Press into a buttered skillet and do not touch it.',
      'Flip once, salt at the end, serve with the crisp side up.',
    ],
  },

  // --- Mexican (La Milpa's cards, dealt into the starter deck) ---------------------
  {
    id: 'tacos-al-pastor',
    title: 'Tacos al pastor',
    sub: 'el taco',
    description: 'Achiote-marinated pork with charred pineapple on warm corn tortillas.',
    cuisine: 'mexican',
    dishType: 'main',
    serves: 4,
    minutes: 50,
    heat: 2,
    ingredients: [
      { name: 'pork shoulder', quantity: 2, unit: 'lb' },
      { name: 'pineapple', quantity: 1, unit: 'each' },
      { name: 'corn tortillas', quantity: 1, unit: 'each' },
      { name: 'achiote paste', quantity: 1, unit: 'each' },
      { name: 'guajillo chiles', quantity: 1, unit: 'each' },
      { name: 'white onions', quantity: 1, unit: 'each' },
      { name: 'fresh cilantro', quantity: 1, unit: 'bunch' },
      { name: 'limes', quantity: 3, unit: 'each' },
    ],
    steps: [
      'Blend achiote and chiles into a marinade; give the pork hours in it.',
      'Sear hard with the pineapple until both char at the edges.',
      'Chop, pile on doubled tortillas, onion-cilantro-lime over.',
    ],
  },
  {
    id: 'birria',
    title: 'Birria de res',
    sub: 'la birria',
    description: 'Slow-braised beef in guajillo broth — tacos for dipping, consomé for the soul.',
    cuisine: 'mexican',
    dishType: 'main',
    serves: 4,
    minutes: 180,
    heat: 2,
    ingredients: [
      { name: 'beef chuck', quantity: 3, unit: 'lb' },
      { name: 'guajillo chiles', quantity: 1, unit: 'each' },
      { name: 'corn tortillas', quantity: 1, unit: 'each' },
      { name: 'oaxaca cheese', quantity: 1, unit: 'lb' },
      { name: 'white onions', quantity: 1, unit: 'each' },
      { name: 'fresh cilantro', quantity: 1, unit: 'bunch' },
      { name: 'limes', quantity: 2, unit: 'each' },
      { name: 'bay leaves', pantry: true },
      { name: 'cumin seeds', pantry: true },
    ],
    steps: [
      'Toast and blend the chiles into the braising broth.',
      'Three hours low until the beef gives up entirely.',
      'Dip tortillas in the fat, gridle with cheese and beef, consomé on the side.',
    ],
  },
  {
    id: 'chilaquiles',
    title: 'Chilaquiles rojos',
    sub: 'los chilaquiles',
    description: 'Chips simmered in chipotle-tomato salsa, crowned with a fried egg.',
    cuisine: 'mexican',
    dishType: 'breakfast',
    serves: 4,
    minutes: 25,
    heat: 2,
    ingredients: [
      { name: 'tortilla chips', quantity: 1, unit: 'each' },
      { name: 'roma tomatoes', quantity: 1.5, unit: 'lb' },
      { name: 'chipotle peppers in adobo', quantity: 1, unit: 'each' },
      { name: 'queso fresco', quantity: 1, unit: 'each' },
      { name: 'mexican crema', quantity: 1, unit: 'each' },
      { name: 'large eggs', quantity: 1, unit: 'dozen' },
      { name: 'white onions', quantity: 1, unit: 'each' },
    ],
    steps: [
      'Blend and simmer the salsa until it darkens a shade.',
      'Chips in, folded once — soft edges are the point.',
      'Fried egg on top, crema and queso fresco over everything.',
    ],
  },
  {
    id: 'guacamole',
    title: 'Guacamole y totopos',
    sub: 'el guacamole',
    description: 'Hand-mashed avocado with tomato, jalapeño, cilantro, and warm chips.',
    cuisine: 'mexican',
    dishType: 'snack',
    serves: 4,
    minutes: 15,
    heat: 1,
    ingredients: [
      { name: 'avocados', quantity: 4, unit: 'each' },
      { name: 'roma tomatoes', quantity: 1, unit: 'lb' },
      { name: 'white onions', quantity: 1, unit: 'each' },
      { name: 'jalapeno peppers', quantity: 2, unit: 'each' },
      { name: 'fresh cilantro', quantity: 1, unit: 'bunch' },
      { name: 'limes', quantity: 3, unit: 'each' },
      { name: 'tortilla chips', quantity: 1, unit: 'each' },
    ],
    steps: [
      'A fork, not a blender — guacamole should remember being an avocado.',
      'Fold in tomato, onion, jalapeño, cilantro.',
      'More lime than feels right, salt until it sings.',
    ],
  },
  {
    id: 'enchiladas-suizas',
    title: 'Enchiladas suizas',
    sub: 'las enchiladas',
    description: 'Chicken enchiladas under creamy tomatillo salsa and melted jack.',
    cuisine: 'mexican',
    dishType: 'main',
    serves: 4,
    minutes: 45,
    heat: 1,
    ingredients: [
      { name: 'corn tortillas', quantity: 1, unit: 'each' },
      { name: 'chicken breast', quantity: 1.5, unit: 'lb' },
      { name: 'tomatillos', quantity: 1.5, unit: 'lb' },
      { name: 'heavy cream', quantity: 1, unit: 'each' },
      { name: 'monterey jack cheese', quantity: 1, unit: 'lb' },
      { name: 'white onions', quantity: 1, unit: 'each' },
      { name: 'serrano peppers', quantity: 2, unit: 'each' },
    ],
    steps: [
      'Char and blend the tomatillos with serrano and cream.',
      'Fry each tortilla ten seconds first, or the sauce dissolves your work.',
      'Roll, sauce, cheese, broil until spotted.',
    ],
  },

  // --- Post-Soviet (the Bureau's canon, reissued as starter stock) -----------------
  {
    id: 'borscht',
    title: 'Borscht',
    sub: 'борщ',
    description: 'Ukraine’s soup, UNESCO-listed — and every family’s version is the correct one.',
    cuisine: 'post-soviet',
    dishType: 'soup',
    serves: 4,
    minutes: 75,
    heat: null,
    ingredients: [
      { name: 'beets', quantity: 2, unit: 'lb' },
      { name: 'green cabbage', quantity: 1, unit: 'each' },
      { name: 'yukon gold potatoes', quantity: 2, unit: 'lb' },
      { name: 'carrots', quantity: 1, unit: 'lb' },
      { name: 'yellow onions', quantity: 1, unit: 'each' },
      { name: 'beef chuck', quantity: 1.5, unit: 'lb' },
      { name: 'tomato paste', quantity: 1, unit: 'each' },
      { name: 'fresh dill', quantity: 1, unit: 'bunch' },
      { name: 'sour cream', quantity: 1, unit: 'each' },
      { name: 'bay leaves', pantry: true },
    ],
    steps: [
      'Simmer the beef to a broth while the beets roast.',
      'Everything into the pot in order of stubbornness.',
      'Smetana on the side. Always. This is not negotiable.',
    ],
  },
  {
    id: 'plov',
    title: 'Plov',
    sub: 'плов',
    description: 'The wedding dish of Central Asia — a thousand weddings, one pot.',
    cuisine: 'post-soviet',
    dishType: 'main',
    serves: 4,
    minutes: 90,
    heat: null,
    ingredients: [
      { name: 'lamb shoulder', quantity: 2, unit: 'lb' },
      { name: 'medium grain rice', quantity: 2, unit: 'lb' },
      { name: 'carrots', quantity: 2, unit: 'lb' },
      { name: 'yellow onions', quantity: 2, unit: 'each' },
      { name: 'garlic', quantity: 2, unit: 'head' },
      { name: 'cumin seeds', pantry: true },
    ],
    steps: [
      'Brown the lamb hard in a heavy pot.',
      'Carrots cut to matchsticks, never grated; onions under them.',
      'Rice on top, whole garlic heads buried, do not stir again.',
    ],
  },
  {
    id: 'syrniki',
    title: 'Syrniki',
    sub: 'сырники',
    description: 'Farmer’s-cheese pancakes — the smell of Sunday morning in a thousand kitchens.',
    cuisine: 'post-soviet',
    dishType: 'breakfast',
    serves: 4,
    minutes: 30,
    heat: null,
    ingredients: [
      { name: 'farmer cheese', quantity: 2, unit: 'lb' },
      { name: 'large eggs', quantity: 1, unit: 'dozen' },
      { name: 'all-purpose flour', quantity: 2, unit: 'lb' },
      { name: 'sour cream', quantity: 1, unit: 'each' },
      { name: 'strawberry preserves', quantity: 1, unit: 'each' },
      { name: 'sugar', pantry: true },
    ],
    steps: [
      'Mix cheese, egg, and just enough flour to hold.',
      'Form pucks; dust; fry gentle gold in butter.',
      'Sour cream and preserves — for the child, and, fine, for you.',
    ],
  },
  {
    id: 'khachapuri',
    title: 'Khachapuri',
    sub: 'ხაჭაპური',
    description: 'Georgia’s cheese boat, with the egg riding like a sun.',
    cuisine: 'post-soviet',
    dishType: 'main',
    serves: 4,
    minutes: 75,
    heat: null,
    ingredients: [
      { name: 'all-purpose flour', quantity: 2, unit: 'lb' },
      { name: 'active dry yeast', quantity: 1, unit: 'each' },
      { name: 'whole milk', quantity: 0.5, unit: 'gallon' },
      { name: 'large eggs', quantity: 1, unit: 'dozen' },
      { name: 'mozzarella', quantity: 1, unit: 'lb' },
      { name: 'feta cheese', quantity: 1, unit: 'each' },
      { name: 'butter', quantity: 1, unit: 'each' },
    ],
    steps: [
      'A soft dough, an hour to rise.',
      'Shape the boat, fill with both cheeses, bake until bronzed.',
      'Egg into the crater for the last two minutes; butter, stir at the table.',
    ],
  },
  {
    id: 'pelmeni',
    title: 'Pelmeni',
    sub: 'пельмени',
    description: 'Made by the hundred and frozen by the sack — Siberian meal prep, centuries early.',
    cuisine: 'post-soviet',
    dishType: 'main',
    serves: 4,
    minutes: 60,
    heat: null,
    ingredients: [
      { name: 'all-purpose flour', quantity: 2, unit: 'lb' },
      { name: 'large eggs', quantity: 1, unit: 'dozen' },
      { name: 'ground beef', quantity: 1, unit: 'lb' },
      { name: 'ground pork', quantity: 1, unit: 'lb' },
      { name: 'yellow onions', quantity: 1, unit: 'each' },
      { name: 'sour cream', quantity: 1, unit: 'each' },
      { name: 'black peppercorns', pantry: true },
    ],
    steps: [
      'Tight dough, rested; both meats and grated onion for the filling.',
      'Roll, cut, fill, pinch — enlist help, this is company work.',
      'Boil until they float plus two minutes; butter or sour cream, never neither.',
    ],
  },
];

const CATALOG_BY_ID = new Map(STARTER_CATALOG.map((dish) => [dish.id, dish]));

export function starterById(id: string): StarterDish | null {
  return CATALOG_BY_ID.get(id) ?? null;
}

export function starterSourceUrl(id: string): string {
  return `${STARTER_SOURCE_PREFIX}${id}`;
}

// Seeding ----------------------------------------------------------------------

export interface SeedStartersInput {
  userId: string;
  /** Optional when the user has a single household (the default case). */
  householdId?: string;
  starterIds: string[];
}

export interface SeedStartersResult {
  /** Every requested starter as a shelf recipe, in catalog order. */
  recipes: Recipe[];
  /** How many were already on the shelf (repeat onboarding, double-taps). */
  alreadySaved: number;
}

/** Seed picked starters onto the household shelf as real recipes. Idempotent:
 * the (household_id, source_url) unique index makes re-picks harmless. */
export async function seedStarters(input: SeedStartersInput): Promise<SeedStartersResult> {
  const ctx = await getHouseholdContext(input.userId, input.householdId);

  const ids = [...new Set(input.starterIds)];
  const unknown = ids.filter((id) => !CATALOG_BY_ID.has(id));
  if (unknown.length > 0) {
    throw validationError(`Unknown starter dish(es): ${unknown.join(', ')}`);
  }
  if (ids.length === 0) {
    throw validationError('Pick at least one starter dish.');
  }

  const dishes = ids.map((id) => CATALOG_BY_ID.get(id)!);
  const inserted = await getDb()
    .insert(schema.recipes)
    .values(
      dishes.map((dish) => ({
        householdId: ctx.household.id,
        addedByUserId: input.userId,
        sourceUrl: starterSourceUrl(dish.id),
        sourcePlatform: 'starter',
        creator: null,
        title: dish.title,
        sub: dish.sub,
        description: dish.description,
        cuisine: dish.cuisine,
        dishType: dish.dishType,
        serves: dish.serves,
        minutes: dish.minutes,
        heat: dish.heat,
        ingredients: dish.ingredients,
        steps: dish.steps,
        provenance: 'transcribed' as const,
        confidence: 'high',
        notes: [],
      })),
    )
    .onConflictDoNothing()
    .returning();

  // Return the full requested set (fresh + pre-existing), in catalog order.
  const rows = await getDb()
    .select()
    .from(schema.recipes)
    .where(
      and(
        eq(schema.recipes.householdId, ctx.household.id),
        inArray(
          schema.recipes.sourceUrl,
          ids.map((id) => starterSourceUrl(id)),
        ),
      ),
    );
  const order = new Map(ids.map((id, index) => [starterSourceUrl(id), index]));
  rows.sort((a, b) => (order.get(a.sourceUrl) ?? 0) - (order.get(b.sourceUrl) ?? 0));

  return { recipes: rows, alreadySaved: rows.length - inserted.length };
}
