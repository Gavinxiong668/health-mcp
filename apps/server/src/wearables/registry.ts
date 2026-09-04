import type { Ctx } from '../services/types.js';
import { createOuraProvider } from './providers/oura/index.js';
import { createWhoopProvider } from './providers/whoop/index.js';
import { createZeppProvider } from './providers/zepp/index.js';
import type { WearableProvider, WearableProviderId } from './types.js';

let registry: Map<WearableProviderId, WearableProvider> | null = null;

export const initRegistry = (ctx: Ctx): void => {
  registry = new Map();
  const whoop = createWhoopProvider({
    clientId: ctx.config.whoopClientId,
    clientSecret: ctx.config.whoopClientSecret,
    logger: ctx.logger,
  });
  if (whoop) registry.set(whoop.id, whoop);
  const oura = createOuraProvider({
    clientId: ctx.config.ouraClientId,
    clientSecret: ctx.config.ouraClientSecret,
    logger: ctx.logger,
  });
  if (oura) registry.set(oura.id, oura);
  const zepp = createZeppProvider({
    clientId: ctx.config.zeppClientId,
    clientSecret: ctx.config.zeppClientSecret,
    logger: ctx.logger,
  });
  if (zepp) registry.set(zepp.id, zepp);
};

export const getProvider = (id: WearableProviderId): WearableProvider | null => {
  if (!registry) throw new Error('wearable registry not initialized');
  return registry.get(id) ?? null;
};

export const listProviders = (): WearableProvider[] => {
  if (!registry) throw new Error('wearable registry not initialized');
  return [...registry.values()];
};
