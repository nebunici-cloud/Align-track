import { describe, it, expect } from 'vitest';
import { computeBand, getAllowedOutMinutes } from './compliance';
import {
  computeBand as apiComputeBand,
  getAllowedOutMinutes as apiGetAllowedOutMinutes,
} from '../../api/_lib/widgetStatus';

/**
 * api/_lib/widgetStatus.ts deliberately carries its own copy of the
 * compliance model rather than importing this one: Vercel never ships the
 * src/ tree into the lambda, so a runtime import from src/ compiles clean
 * and then fails in production with ERR_MODULE_NOT_FOUND on every request.
 *
 * That duplication is the safe choice for deployment, but it can silently
 * drift - which would put the web app and the widget back to disagreeing
 * about whether a day went well. These tests make drift a build failure
 * instead of a bug someone notices weeks later on a widget.
 */
describe('compliance model parity between src/ and api/', () => {
  it('agrees on the out-time budget for every realistic wear goal', () => {
    for (let targetHours = 0; targetHours <= 24; targetHours += 0.5) {
      expect(apiGetAllowedOutMinutes(targetHours)).toBe(getAllowedOutMinutes(targetHours));
    }
  });

  it('agrees on the band across the full range of out-time', () => {
    for (const targetHours of [20, 21, 21.5, 22, 23]) {
      const allowed = getAllowedOutMinutes(targetHours);
      for (let outMinutes = 0; outMinutes <= allowed + 60; outMinutes++) {
        expect(apiComputeBand(outMinutes, allowed)).toBe(computeBand(outMinutes, allowed));
      }
    }
  });

  it('agrees at the exact band boundaries', () => {
    const allowed = getAllowedOutMinutes(22);
    for (const outMinutes of [allowed - 31, allowed - 30, allowed - 1, allowed, allowed + 1]) {
      expect(apiComputeBand(outMinutes, allowed)).toBe(computeBand(outMinutes, allowed));
    }
  });

  it('agrees when there is no budget at all', () => {
    expect(apiComputeBand(0, 0)).toBe(computeBand(0, 0));
  });
});
