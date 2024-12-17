import { SyntaxKind } from '../types';
import type { IdentifierToken, INodeVisitor, Location, NgParseError } from '../types';

import { Node } from './node';

interface NgControllerConfig {
    controllerName: IdentifierToken;
    as?: IdentifierToken;
}

export class NgControllerProgram extends Node<NgControllerProgram> {
    readonly source: string;
    readonly errors: NgParseError[];
    readonly config?: NgControllerConfig;

    constructor(source: string, errors: NgParseError[], config?: NgControllerConfig) {
        if (config) {
            super(SyntaxKind.Program, ...([config.controllerName, config.as].filter(Boolean) as Location[]));
        } else {
            super(SyntaxKind.Program, { start: 0, end: 1 });
        }
        this.source = source;
        this.errors = errors;
        this.config = config;
    }

    accept<R>(visitor: INodeVisitor<R, NgControllerProgram>): R {
        return visitor.visitProgram(this);
    }
}
