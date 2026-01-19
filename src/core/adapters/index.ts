/**
 * Core Adapters Module
 * Re-exports adapter types and registry functions
 */

export type {
  SiteAdapter,
  AnnotatableImage,
  ButtonInjectionConfig,
} from './types';

export {
  siteAdapters,
  getAllMatches,
  getAdapterForUrl,
} from './registry';
