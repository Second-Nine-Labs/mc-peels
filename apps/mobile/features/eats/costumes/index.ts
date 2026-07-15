/**
 * The costume rack — every kitchen's costume, keyed by restaurant id.
 * The chassis (KitchenScreen) and the home's feature hero both dress from
 * here. A future Shelf-generated kitchen registers the same way.
 */

import type { KitchenCostume } from '../costume';
import { GREENHOUSE_COSTUME } from './greenhouse';
import { LA_MILPA_COSTUME } from './lamilpa';
import { STOLOVAYA_COSTUME } from './stolovaya';

export const KITCHEN_COSTUMES: Record<string, KitchenCostume> = {
  'stolovaya-7': STOLOVAYA_COSTUME,
  greenhouse: GREENHOUSE_COSTUME,
  'la-milpa': LA_MILPA_COSTUME,
};
