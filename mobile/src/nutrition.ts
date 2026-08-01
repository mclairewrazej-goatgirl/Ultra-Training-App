import { NutritionItem } from './types';

export function nutrPerHour(
  entries: { itemId: string; servings: number }[] | undefined,
  items: NutritionItem[],
  durMins: number,
  elapsedMins?: number,
): { carbs: number; hydration: number; sodium: number } | null {
  if (!entries || entries.length === 0) return null;
  const hrs = (elapsedMins || durMins) / 60;
  if (hrs <= 0) return null;
  let carbs = 0, hydration = 0, sodium = 0;
  for (const ne of entries) {
    const item = items.find(n => n.id === ne.itemId);
    if (!item) continue;
    carbs     += (Number(item.carbsPerServing)     || 0) * ne.servings;
    hydration += (Number(item.hydrationPerServing)  || 0) * ne.servings;
    sodium    += (Number(item.sodiumPerServing)     || 0) * ne.servings;
  }
  if (!carbs && !hydration && !sodium) return null;
  return { carbs: Math.round(carbs / hrs), hydration: Math.round(hydration / hrs), sodium: Math.round(sodium / hrs) };
}
