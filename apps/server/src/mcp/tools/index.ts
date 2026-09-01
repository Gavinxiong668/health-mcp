import type { AnyToolDef } from '../tool-registry.js';
import { biomarkerTools } from './biomarkers.js';
import { bloodPressureTools } from './blood-pressure.js';
import { correlateTools } from './correlate.js';
import { diaryTools } from './diary.js';
import { buildDiscoverTool, pingTool } from './discover.js';
import { dialysisTools } from './dialysis.js';
import { fluidOutputTools } from './fluid-output.js';
import { foodTools } from './food.js';
import { logTools } from './logs.js';
import { mealTools } from './meals.js';
import { medicationTools } from './medications.js';
import { painTools } from './pain.js';
import { recipeTools } from './recipes.js';
import { rememberedTools } from './remembered.js';
import { summaryTools } from './summaries.js';
import { wearableTools } from './wearables.js';

export const buildAllTools = (): AnyToolDef[] => {
  const tools: AnyToolDef[] = [
    pingTool,
    ...foodTools,
    ...mealTools,
    ...logTools,
    ...summaryTools,
    ...correlateTools,
    ...recipeTools,
    ...rememberedTools,
    ...biomarkerTools,
    ...wearableTools,
    ...bloodPressureTools,
    ...dialysisTools,
    ...painTools,
    ...medicationTools,
    ...diaryTools,
    ...fluidOutputTools,
  ];
  tools.push(buildDiscoverTool(() => tools));
  return tools;
};
