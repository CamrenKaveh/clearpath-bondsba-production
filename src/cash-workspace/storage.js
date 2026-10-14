import { validatePlan } from './model.js';

// An unreadable previous copy must never silently block or be discarded by a save.
export function savePlan(storage, key, plan, confirmReplacement) {
  validatePlan(plan);
  const serialized = JSON.stringify(plan);
  const old = storage.getItem(key);
  let previous = null;
  if (old !== null) {
    try {
      previous = validatePlan(JSON.parse(old));
    } catch {
      if (!confirmReplacement()) return { saved: false, previous: null };
    }
  }
  storage.setItem(key, serialized);
  return { saved: true, previous };
}
