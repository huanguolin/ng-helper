import { ExtensionContext } from 'vscode';

import type { TsService } from '../../service/tsService';

import { searchUseOfComponentOrDirective } from './useOfComponentOrDirective';

export function registerCodeLens(context: ExtensionContext, tsService: TsService) {
    context.subscriptions.push(searchUseOfComponentOrDirective(tsService));
}
