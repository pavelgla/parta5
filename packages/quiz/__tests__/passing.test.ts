import { describe, it, expect } from 'vitest';
import { isPassed, scorePercent } from '../src/passing';

describe('scorePercent', () => {
  it('rounds to the nearest percent', () => {
    expect(scorePercent(7, 10)).toBe(70);
    expect(scorePercent(1, 3)).toBe(33);
    expect(scorePercent(2, 3)).toBe(67);
  });

  it('returns 0 for a zero maximum instead of dividing by zero', () => {
    expect(scorePercent(0, 0)).toBe(0);
  });
});

describe('isPassed', () => {
  it('returns null when the quiz has no threshold', () => {
    expect(isPassed(5, 10, null)).toBeNull();
  });

  it('treats passingScore as a percentage, not an absolute score', () => {
    // Regression: a 10-point quiz with a 60% threshold must be passable.
    // Comparing score >= passingScore (7 >= 60) would report a failure here.
    expect(isPassed(7, 10, 60)).toBe(true);
    expect(isPassed(5, 10, 60)).toBe(false);
  });

  it('passes exactly on the threshold', () => {
    expect(isPassed(6, 10, 60)).toBe(true);
  });

  it('handles a 100% threshold', () => {
    expect(isPassed(10, 10, 100)).toBe(true);
    expect(isPassed(9, 10, 100)).toBe(false);
  });

  it('passes anything when the threshold is 0', () => {
    expect(isPassed(0, 10, 0)).toBe(true);
  });
});
