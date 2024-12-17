import { NgControllerProgram } from '../../src/parser/ngControllerNode';
import { NgRepeatProgram } from '../../src/parser/ngRepeatNode';
import { Token } from '../../src/scanner/token';
import { SyntaxKind, TokenKind, type IdentifierToken } from '../../src/types';
import { visitor } from '../testUtils';

describe('NgControllerProgram', () => {
    it('should correctly initialize with full config', () => {
        const controllerName = createIdentifierToken('XController');
        const as = createIdentifierToken('alias');
        const config = {
            controllerName,
            as,
        };

        const program = new NgControllerProgram('XController as alias', [], config);

        expect(program.source).toBe('XController as alias');
        expect(program.errors).toHaveLength(0);
        expect(program.config).toBeDefined();
        expect(program.config?.controllerName).toBe(controllerName);
        expect(program.config?.as).toBe(as);
        expect(program.kind).toBe(SyntaxKind.Program);
    });

    it('should correctly initialize without partial config', () => {
        const controllerName = createIdentifierToken('XController');
        const config = { controllerName };

        const program = new NgControllerProgram('XController', [], config);

        expect(program.source).toBe('XController');
        expect(program.errors).toHaveLength(0);
        expect(program.config).toBeDefined();
        expect(program.config?.controllerName).toBe(controllerName);
        expect(program.kind).toBe(SyntaxKind.Program);
    });

    it('should correctly initialize without config', () => {
        const program = new NgRepeatProgram('', []);

        expect(program.source).toBe('');
        expect(program.errors).toHaveLength(0);
        expect(program.config).toBeUndefined();
        expect(program.kind).toBe(SyntaxKind.Program);
    });

    it('should accept visitor', () => {
        const program = new NgControllerProgram('', []);
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
