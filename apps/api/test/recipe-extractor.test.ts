import { describe, expect, it } from 'vitest';
import { sanitizeExtractedRecipe } from '../src/ai/recipe-extractor.js';

const GOOD_OUTPUT = {
  is_recipe: true,
  not_recipe_reason: null,
  title: 'Chongqing chicken',
  sub: '辣子鸡',
  description: 'Crisp chicken buried in toasted chiles.',
  cuisine: 'sichuan-chongqing',
  dish_type: 'main',
  serves: 4,
  minutes: 45,
  heat: 3,
  ingredients: [
    { name: 'boneless chicken thighs', quantity: 1.5, unit: 'lb', pantry: false },
    { name: 'dried red chiles', quantity: 4, unit: 'oz', pantry: false },
    { name: 'sichuan peppercorns', quantity: null, unit: null, pantry: true },
  ],
  steps: ['Cube and marinate the chicken.', 'Fry until deeply crisp.'],
  provenance: 'transcribed',
  confidence: 'high',
  creator: 'mala.queen',
  notes: [],
};

describe('sanitizeExtractedRecipe', () => {
  it('passes a well-formed recipe through unchanged', () => {
    const recipe = sanitizeExtractedRecipe(GOOD_OUTPUT);
    expect(recipe.isRecipe).toBe(true);
    expect(recipe.title).toBe('Chongqing chicken');
    expect(recipe.cuisine).toBe('sichuan-chongqing');
    expect(recipe.heat).toBe(3);
    expect(recipe.ingredients).toEqual([
      { name: 'boneless chicken thighs', quantity: 1.5, unit: 'lb' },
      { name: 'dried red chiles', quantity: 4, unit: 'oz' },
      { name: 'sichuan peppercorns', pantry: true },
    ]);
    expect(recipe.provenance).toBe('transcribed');
  });

  it('clamps unknown enums and wild numbers to safe fallbacks', () => {
    const recipe = sanitizeExtractedRecipe({
      ...GOOD_OUTPUT,
      cuisine: 'klingon',
      dish_type: 'spaceship',
      serves: -3,
      minutes: 99999,
      heat: 11,
      confidence: 'certain',
      provenance: 'divined',
    });
    expect(recipe.cuisine).toBe('other');
    expect(recipe.dishType).toBe('main');
    expect(recipe.serves).toBe(1);
    expect(recipe.minutes).toBe(2880);
    expect(recipe.heat).toBe(3);
    expect(recipe.confidence).toBe('low');
    expect(recipe.provenance).toBe('reconstructed');
  });

  it('drops malformed ingredients and says so in notes', () => {
    const recipe = sanitizeExtractedRecipe({
      ...GOOD_OUTPUT,
      ingredients: [
        { name: 'chicken thighs', quantity: 1, unit: 'lb', pantry: false },
        { name: '', quantity: 1, unit: 'lb', pantry: false },
        'garbage',
        { quantity: 2 },
      ],
    });
    expect(recipe.ingredients).toHaveLength(1);
    expect(recipe.notes.join(' ')).toContain('Dropped 3 malformed ingredient');
  });

  it('normalizes junk quantities to unsized rather than inventing', () => {
    const recipe = sanitizeExtractedRecipe({
      ...GOOD_OUTPUT,
      ingredients: [{ name: 'noodles', quantity: -2, unit: '  ', pantry: false }],
    });
    expect(recipe.ingredients[0]).toEqual({ name: 'noodles' });
  });

  it('handles the not-a-recipe verdict', () => {
    const recipe = sanitizeExtractedRecipe({
      ...GOOD_OUTPUT,
      is_recipe: false,
      not_recipe_reason: 'This is a video of a cat.',
      title: '',
      ingredients: [],
    });
    expect(recipe.isRecipe).toBe(false);
    expect(recipe.notRecipeReason).toBe('This is a video of a cat.');
  });

  it('survives complete garbage input', () => {
    const recipe = sanitizeExtractedRecipe('not even an object');
    expect(recipe.isRecipe).toBe(true);
    expect(recipe.title).toBe('Untitled dish');
    expect(recipe.ingredients).toEqual([]);
    expect(recipe.serves).toBe(4);
  });

  it('null heat stays null', () => {
    expect(sanitizeExtractedRecipe({ ...GOOD_OUTPUT, heat: null }).heat).toBeNull();
  });
});
