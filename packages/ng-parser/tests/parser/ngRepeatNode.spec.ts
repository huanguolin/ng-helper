import { NgRepeatProgram } from '../../src/parser/ngRepeatNode';
import { Identifier } from '../../src/parser/node';
import { Token } from '../../src/scanner/token';
import { SyntaxKind, TokenKind, type IdentifierToken } from '../../src/types';
import { visitor } from '../testUtils';

describe('NgRepeatProgram', () => {
    it('should correctly initialize with config', () => {
        const itemValue = createIdentifierToken('item');
        const items = new Identifier(createIdentifierToken('array'));
        const config = {
            mode: 'array',
            itemValue,
            items,
        } as const;

        const program = new NgRepeatProgram('item in array', [], config);

        expect(program.source).toBe('item in array');
        expect(program.errors).toHaveLength(0);
        expect(program.config).toBeDefined();
        expect(program.config?.itemValue).toBe(itemValue);
        expect(program.config?.items).toBe(items);
        expect(program.kind).toBe(SyntaxKind.Program);
    });

    it('should correctly initialize with full config', () => {
        const itemKey = createIdentifierToken('key');
        const itemValue = createIdentifierToken('value');
        const items = new Identifier(createIdentifierToken('obj'));
        const as = createIdentifierToken('alias');
        const trackBy = new Identifier(createIdentifierToken('trackFn'));

        const config = {
            mode: 'object',
            itemKey,
            itemValue,
            items,
            as,
            trackBy,
        } as const;

        const program = new NgRepeatProgram('(key, value) in obj as alias track by trackFn', [], config);

        expect(program.source).toBe('(key, value) in obj as alias track by trackFn');
        expect(program.errors).toHaveLength(0);
        expect(program.config).toBeDefined();
        expect(program.config?.itemKey).toBe(itemKey);
        expect(program.config?.itemValue).toBe(itemValue);
        expect(program.config?.items).toBe(items);
        expect(program.config?.as).toBe(as);
        expect(program.config?.trackBy).toBe(trackBy);
    });

    it('should correctly initialize without config', () => {
        const program = new NgRepeatProgram('', []);

        expect(program.source).toBe('');
        expect(program.errors).toHaveLength(0);
        expect(program.config).toBeUndefined();
        expect(program.kind).toBe(SyntaxKind.Program);
    });

    it('should accept visitor', () => {
        const program = new NgRepeatProgram('', []);
        const result = program.accept(visitor);
        expect(result).toBe(program);
    });
});

function createIdentifierToken(value: string): IdentifierToken {
    return new Token({
        kind: TokenKind.Identifier,
        value,
        start: 0,
        end: value.length,
    }) as IdentifierToken;
}
