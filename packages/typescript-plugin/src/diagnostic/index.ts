import type ts from 'typescript';

import { PluginContext } from '../type';

export function getTsInjectionDiagnostics(ctx: PluginContext): ts.Diagnostic[] {
    return [];
}
