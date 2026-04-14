import { describe, expect, test } from 'bun:test';
import type { DetectedProvider } from '../types';
import { getCatchAllInstructions } from './catch-all-instructions.js';

const ALL_PROVIDERS: DetectedProvider[] = [
  'google-workspace',
  'microsoft-365',
  'fastmail',
  'protonmail',
  'zoho',
  'icloud',
  'mimecast',
  'barracuda',
];

describe('getCatchAllInstructions', () => {
  test('returns instructions for each known provider', () => {
    for (const provider of ALL_PROVIDERS) {
      const result = getCatchAllInstructions(provider);
      expect(result.providerName).toBeTruthy();
    }
  });

  test('returns generic instructions for null provider', () => {
    const result = getCatchAllInstructions(null);
    expect(result.providerName).toBe('Your Email Provider');
    expect(result.steps.length).toBeGreaterThan(0);
  });

  test('providers with catch-all support have non-empty steps', () => {
    const supportedProviders: DetectedProvider[] = [
      'google-workspace',
      'microsoft-365',
      'fastmail',
      'protonmail',
      'zoho',
    ];
    for (const provider of supportedProviders) {
      const result = getCatchAllInstructions(provider);
      expect(result.steps.length).toBeGreaterThan(0);
    }
  });

  test('iCloud has empty steps and a warning note', () => {
    const result = getCatchAllInstructions('icloud');
    expect(result.steps).toEqual([]);
    expect(result.notes).toContain('does not support catch-all');
  });

  test('security gateways explain underlying provider needed', () => {
    for (const gateway of ['mimecast', 'barracuda'] as DetectedProvider[]) {
      const result = getCatchAllInstructions(gateway);
      expect(result.steps.length).toBeGreaterThan(0);
      expect(result.notes).toContain('actual email provider');
    }
  });

  test('adminUrl is a valid URL string or null', () => {
    for (const provider of ALL_PROVIDERS) {
      const result = getCatchAllInstructions(provider);
      if (result.adminUrl !== null) {
        expect(result.adminUrl).toMatch(/^https:\/\//);
      }
    }
  });

  test('providers with admin panels have adminUrl set', () => {
    const withAdmin: DetectedProvider[] = [
      'google-workspace',
      'microsoft-365',
      'fastmail',
      'protonmail',
      'zoho',
    ];
    for (const provider of withAdmin) {
      const result = getCatchAllInstructions(provider);
      expect(result.adminUrl).not.toBeNull();
    }
  });

  test('generic instructions have no adminUrl', () => {
    const result = getCatchAllInstructions(null);
    expect(result.adminUrl).toBeNull();
  });
});
