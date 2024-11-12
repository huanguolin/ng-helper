import { resolveLocation } from '../../src/parser/utils';
import type { Location } from '../../src/types';

describe('resolveLocation()', () => {
    it('should resolve location from single node', () => {
        const loc: Location = { start: 0, end: 5 };
        const result = resolveLocation(loc);
        expect(result).toEqual({ start: 0, end: 5 });
    });

    it('should resolve location from multiple nodes', () => {
        const loc1: Location = { start: 0, end: 5 };
        const loc2: Location = { start: 3, end: 8 };
        const loc3: Location = { start: 1, end: 6 };

        const result = resolveLocation(loc1, loc2, loc3);
        expect(result).toEqual({ start: 0, end: 8 });
    });

    it('should handle negative values', () => {
        const loc1: Location = { start: -1, end: 5 };
        const loc2: Location = { start: 3, end: -1 };
        const loc3: Location = { start: 1, end: 6 };

        const result = resolveLocation(loc1, loc2, loc3);
        expect(result).toEqual({ start: 1, end: 6 });
    });

    it('should throw error for empty input', () => {
        expect(() => resolveLocation()).toThrow('No nodes provided');
    });
});
