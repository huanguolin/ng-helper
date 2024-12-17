import { SyntaxKind } from '../types';
import type { IdentifierToken, INodeVisitor, Location, NgParseError } from '../types';

import type { Expression } from './node';
import { Node } from './node';

interface NgRepeatConfig {
    itemKey?: IdentifierToken;
    itemValue: IdentifierToken;
    /**
     * array or object
     */
    items: Expression;
    as?: IdentifierToken;
    trackBy?: Expression;
}

export class NgRepeatProgram extends Node<NgRepeatProgram> {
    readonly source: string;
    readonly errors: NgParseError[];
    readonly config?: NgRepeatConfig;

    constructor(source: string, errors: NgParseError[], config?: NgRepeatConfig) {
        if (config) {
            super(
                SyntaxKind.Program,
                ...([config.itemKey, config.itemValue, config.items, config.as, config.trackBy].filter(
                    Boolean,
                ) as Location[]),
            );
        } else {
            super(SyntaxKind.Program, { start: 0, end: 1 });
        }
        this.source = source;
        this.errors = errors;
        this.config = config;
    }

    accept<R>(visitor: INodeVisitor<R, NgRepeatProgram>): R {
        return visitor.visitProgram(this);
    }
}
