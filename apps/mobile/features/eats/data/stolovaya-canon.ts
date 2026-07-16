/**
 * The canon — twelve dishes of the post-Soviet table.
 *
 * A deliberately bounded corpus (PRD §12 phase 2, scoped small): every
 * ingredient name is chosen to resolve on Instacart search, quantities are
 * recipe-determined for four servings, and pantry staples are flagged so
 * salt-and-oil never pad the cart. Origins are credited on every card —
 * plov is Uzbek, borscht is Ukrainian — homage to the food, not the state.
 *
 * Tone rules (do not weaken): punch at bureaucracy and aesthetics, never at
 * hardship or people. Notes are a loving babushka, not a cartoon.
 */

export type CanonCategory = 'soup' | 'main' | 'breakfast' | 'salad';

export interface CanonIngredient {
  /** Clean product name suitable for Instacart store search. */
  name: string;
  quantity?: number;
  unit?: string;
  /** Assumed on-hand (salt, oil, spices) — excluded from the cart by default. */
  pantry?: boolean;
}

export interface CanonRecipe {
  id: string;
  /** Spec-sheet number, e.g. "ГОСТ 01-26". Pastiche, not a real standard. */
  gost: string;
  name: string;
  cyrillic: string;
  origin: string;
  category: CanonCategory;
  serves: number;
  /** One line of story — the museum-plaque register. */
  story: string;
  /** One line from the babushka — warm, dry, brief. */
  note: string;
  ingredients: CanonIngredient[];
}

export const CANON: CanonRecipe[] = [
  {
    id: 'plov',
    gost: 'ГОСТ 01-26',
    name: 'Plov',
    cyrillic: 'плов',
    origin: 'Uzbek',
    category: 'main',
    serves: 4,
    story: 'The wedding dish of Central Asia — a thousand weddings, one pot.',
    note: 'Carrots cut to matchsticks, never grated. You will have seconds.',
    ingredients: [
      { name: 'lamb shoulder', quantity: 2, unit: 'lb' },
      { name: 'medium grain rice', quantity: 2, unit: 'lb' },
      { name: 'carrots', quantity: 2, unit: 'lb' },
      { name: 'yellow onions', quantity: 2, unit: 'each' },
      { name: 'garlic', quantity: 2, unit: 'head' },
      { name: 'cumin seeds', pantry: true },
      { name: 'sunflower oil', pantry: true },
    ],
  },
  {
    id: 'borscht',
    gost: 'ГОСТ 02-26',
    name: 'Borscht',
    cyrillic: 'борщ',
    origin: 'Ukrainian',
    category: 'soup',
    serves: 4,
    story: 'Ukraine’s soup, UNESCO-listed — and every family’s version is the correct one.',
    note: 'Smetana on the side. Always. This is not negotiable.',
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
  },
  {
    id: 'pelmeni',
    gost: 'ГОСТ 03-26',
    name: 'Pelmeni',
    cyrillic: 'пельмени',
    origin: 'Siberian',
    category: 'main',
    serves: 4,
    story: 'Made by the hundred and frozen by the sack — Siberian meal prep, centuries early.',
    note: 'Double the batch, freeze half. This is not a suggestion.',
    ingredients: [
      { name: 'all-purpose flour', quantity: 2, unit: 'lb' },
      { name: 'large eggs', quantity: 1, unit: 'dozen' },
      { name: 'ground beef', quantity: 1, unit: 'lb' },
      { name: 'ground pork', quantity: 1, unit: 'lb' },
      { name: 'yellow onions', quantity: 1, unit: 'each' },
      { name: 'sour cream', quantity: 1, unit: 'each' },
      { name: 'black peppercorns', pantry: true },
    ],
  },
  {
    id: 'syrniki',
    gost: 'ГОСТ 04-26',
    name: 'Syrniki',
    cyrillic: 'сырники',
    origin: 'Pan-Soviet table',
    category: 'breakfast',
    serves: 4,
    story: 'Farmer’s-cheese pancakes — the smell of Sunday morning in a thousand kitchens.',
    note: 'For the child. And, fine, for you.',
    ingredients: [
      { name: 'farmer cheese', quantity: 2, unit: 'lb' },
      { name: 'large eggs', quantity: 1, unit: 'dozen' },
      { name: 'all-purpose flour', quantity: 2, unit: 'lb' },
      { name: 'raisins', quantity: 1, unit: 'each' },
      { name: 'sour cream', quantity: 1, unit: 'each' },
      { name: 'strawberry preserves', quantity: 1, unit: 'each' },
      { name: 'sugar', pantry: true },
    ],
  },
  {
    id: 'olivier',
    gost: 'ГОСТ 05-26',
    name: 'Olivier salad',
    cyrillic: 'оливье',
    origin: 'The New Year table',
    category: 'salad',
    serves: 4,
    story: 'No New Year is legally recognized without it.',
    note: 'Cube everything the same size. Grandmother is watching.',
    ingredients: [
      { name: 'yukon gold potatoes', quantity: 2, unit: 'lb' },
      { name: 'carrots', quantity: 1, unit: 'lb' },
      { name: 'large eggs', quantity: 1, unit: 'dozen' },
      { name: 'dill pickles', quantity: 1, unit: 'each' },
      { name: 'frozen peas', quantity: 1, unit: 'each' },
      { name: 'ham steak', quantity: 1, unit: 'lb' },
      { name: 'mayonnaise', quantity: 1, unit: 'each' },
      { name: 'fresh dill', quantity: 1, unit: 'bunch' },
    ],
  },
  {
    id: 'vinaigrette',
    gost: 'ГОСТ 06-26',
    name: 'Vinaigrette salad',
    cyrillic: 'винегрет',
    origin: 'Pan-Soviet table',
    category: 'salad',
    serves: 4,
    story: 'The beet salad that outlived an empire.',
    note: 'Dress it only at the table, or the beets annex everything.',
    ingredients: [
      { name: 'beets', quantity: 1.5, unit: 'lb' },
      { name: 'yukon gold potatoes', quantity: 1.5, unit: 'lb' },
      { name: 'carrots', quantity: 1, unit: 'lb' },
      { name: 'sauerkraut', quantity: 1, unit: 'each' },
      { name: 'dill pickles', quantity: 1, unit: 'each' },
      { name: 'frozen peas', quantity: 1, unit: 'each' },
      { name: 'yellow onions', quantity: 1, unit: 'each' },
      { name: 'sunflower oil', quantity: 1, unit: 'each' },
    ],
  },
  {
    id: 'golubtsy',
    gost: 'ГОСТ 07-26',
    name: 'Golubtsy',
    cyrillic: 'голубцы',
    origin: 'Ukrainian and beyond',
    category: 'main',
    serves: 4,
    story: 'Cabbage rolls — the whole garden, wrapped and delivered.',
    note: 'The cabbage must surrender before it can be rolled. Boil it longer.',
    ingredients: [
      { name: 'green cabbage', quantity: 1, unit: 'each' },
      { name: 'ground beef', quantity: 1.5, unit: 'lb' },
      { name: 'medium grain rice', quantity: 1, unit: 'lb' },
      { name: 'yellow onions', quantity: 1, unit: 'each' },
      { name: 'carrots', quantity: 1, unit: 'lb' },
      { name: 'tomato paste', quantity: 1, unit: 'each' },
      { name: 'sour cream', quantity: 1, unit: 'each' },
    ],
  },
  {
    id: 'grechka',
    gost: 'ГОСТ 08-26',
    name: 'Grechka with mushrooms',
    cyrillic: 'гречка с грибами',
    origin: 'Pan-Soviet table',
    category: 'main',
    serves: 4,
    story: 'Buckwheat — the grain that raised generations.',
    note: 'Toast the groats first. Always toast the groats.',
    ingredients: [
      { name: 'buckwheat groats', quantity: 1, unit: 'each' },
      { name: 'cremini mushrooms', quantity: 1, unit: 'lb' },
      { name: 'yellow onions', quantity: 2, unit: 'each' },
      { name: 'butter', quantity: 1, unit: 'each' },
      { name: 'fresh dill', quantity: 1, unit: 'bunch' },
    ],
  },
  {
    id: 'blini',
    gost: 'ГОСТ 09-26',
    name: 'Blini',
    cyrillic: 'блины',
    origin: 'Russian, by way of Maslenitsa',
    category: 'breakfast',
    serves: 4,
    story: 'Thin as sunlight, eaten by the stack — butter week’s reason to exist.',
    note: 'The first blin is always lumpy. Proverbially. Eat the evidence.',
    ingredients: [
      { name: 'all-purpose flour', quantity: 2, unit: 'lb' },
      { name: 'whole milk', quantity: 0.5, unit: 'gallon' },
      { name: 'large eggs', quantity: 1, unit: 'dozen' },
      { name: 'butter', quantity: 1, unit: 'each' },
      { name: 'sour cream', quantity: 1, unit: 'each' },
      { name: 'strawberry preserves', quantity: 1, unit: 'each' },
    ],
  },
  {
    id: 'okroshka',
    gost: 'ГОСТ 10-26',
    name: 'Okroshka',
    cyrillic: 'окрошка',
    origin: 'Russian',
    category: 'soup',
    serves: 4,
    story: 'Cold kefir soup, for weeks when the kitchen refuses to be heated.',
    note: 'Yes, the soup is cold. Trust the process.',
    ingredients: [
      { name: 'plain kefir', quantity: 1, unit: 'each' },
      { name: 'persian cucumbers', quantity: 1, unit: 'lb' },
      { name: 'radishes', quantity: 1, unit: 'bunch' },
      { name: 'yukon gold potatoes', quantity: 1, unit: 'lb' },
      { name: 'large eggs', quantity: 1, unit: 'dozen' },
      { name: 'green onions', quantity: 1, unit: 'bunch' },
      { name: 'fresh dill', quantity: 1, unit: 'bunch' },
      { name: 'ham steak', quantity: 0.5, unit: 'lb' },
    ],
  },
  {
    id: 'kotleti',
    gost: 'ГОСТ 11-26',
    name: 'Kotleti with mash',
    cyrillic: 'котлеты с пюре',
    origin: 'The canteen classic',
    category: 'main',
    serves: 4,
    story: 'Weeknight cutlets — the sound of dinner in every stairwell.',
    note: 'Soak the bread in milk. This is the secret. Now it is yours.',
    ingredients: [
      { name: 'ground beef', quantity: 1, unit: 'lb' },
      { name: 'ground pork', quantity: 1, unit: 'lb' },
      { name: 'white sandwich bread', quantity: 1, unit: 'each' },
      { name: 'whole milk', quantity: 0.5, unit: 'gallon' },
      { name: 'yellow onions', quantity: 1, unit: 'each' },
      { name: 'yukon gold potatoes', quantity: 3, unit: 'lb' },
      { name: 'butter', quantity: 1, unit: 'each' },
    ],
  },
  {
    id: 'khachapuri',
    gost: 'ГОСТ 12-26',
    name: 'Khachapuri',
    cyrillic: 'хачапури',
    origin: 'Georgian (Adjaruli)',
    category: 'main',
    serves: 4,
    story: 'Georgia’s cheese boat, with the egg riding like a sun.',
    note: 'The bread is a boat. The cheese is the sea. Do not overthink the harbor.',
    ingredients: [
      { name: 'all-purpose flour', quantity: 2, unit: 'lb' },
      { name: 'active dry yeast', quantity: 1, unit: 'each' },
      { name: 'whole milk', quantity: 0.5, unit: 'gallon' },
      { name: 'large eggs', quantity: 1, unit: 'dozen' },
      { name: 'mozzarella', quantity: 1, unit: 'lb' },
      { name: 'feta cheese', quantity: 1, unit: 'each' },
      { name: 'butter', quantity: 1, unit: 'each' },
    ],
  },
];
