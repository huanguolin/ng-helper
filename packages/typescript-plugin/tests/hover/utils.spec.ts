import { beautifyTypeString } from '../../src/hover/utils';

describe('beautifyTypeString()', () => {
    it('should beautify a simple type string', () => {
        const typeString = 'string';
        const expected = 'string';
        const result = beautifyTypeString(typeString);
        expect(result).toBe(expected);
    });

    it('should beautify a complex type string with indentation', () => {
        const typeString = 'type A = { prop1: string; prop2: number; }';
        const expected = `type A = {
    prop1: string;
    prop2: number;
}`;
        const result = beautifyTypeString(typeString);
        expect(result).toBe(expected);
    });

    it('should beautify a type string with nested objects', () => {
        const typeString = 'type A = { prop1: { nestedProp1: string; nestedProp2: number; }; }';
        const expected = `type A = {
    prop1: {
        nestedProp1: string;
        nestedProp2: number;
    };
}`;
        const result = beautifyTypeString(typeString);
        expect(result).toBe(expected);
    });
});
