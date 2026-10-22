import { afterEach, describe, expect, it, vi } from 'vitest';
import { newId } from '../../engine/id';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('newId', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('genera UUID v4 distintos', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newId()));
    expect(ids.size).toBe(1000);
    for (const id of ids) expect(id).toMatch(UUID_V4);
  });

  it('funciona sin crypto.randomUUID (página no segura, p. ej. celular por la red local)', () => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });
    expect(newId()).toMatch(UUID_V4);
    expect(newId()).not.toBe(newId());
  });
});
