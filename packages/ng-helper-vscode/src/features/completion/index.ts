import { getCursorAtInfo, type CursorAtInfo } from '@ng-helper/shared/lib/cursorAt';
import { SPACE, type Cursor } from '@ng-helper/shared/lib/html';
import {
    ExtensionContext,
    languages,
    type CancellationToken,
    type CompletionContext,
    type Position,
    type TextDocument,
} from 'vscode';

import { buildCursor } from '../../utils';

import { componentAttr, componentAttrCompletion } from './componentAttr';
import { componentName, componentNameCompletion } from './componentName';
import { ctrl } from './ctrl';
import { customDirective } from './customDirective';
import { ngDirective } from './ngDirective';
import { type } from './type';

export function registerCompletion(context: ExtensionContext, port: number) {
    context.subscriptions.push(
        type(port),
        ctrl(port),
        ngDirective(port),
        ...customDirective(port),
        componentName(port),
        componentAttr(port),
    );
}

export type CompletionParamObj<T extends CursorAtInfo | undefined = undefined> = {
    document: TextDocument;
    cursorAtInfo: T;
    cursor: Cursor;
    vscodeCancelToken: CancellationToken;
    context: CompletionContext;
    port: number;
};

export function registerCompletion2(context: ExtensionContext, port: number) {
    const provideCompletionItems = (
        document: TextDocument,
        position: Position,
        token: CancellationToken,
        context: CompletionContext,
    ) => {
        return completion({ document, position, token, context, port });
    };

    context.subscriptions.push(
        languages.registerCompletionItemProvider('html', { provideCompletionItems }),
        languages.registerCompletionItemProvider('html', { provideCompletionItems }, SPACE, '<'),
    );
}

export async function completion({
    document,
    position,
    token,
    context,
    port,
}: {
    document: TextDocument;
    position: Position;
    token: CancellationToken;
    context: CompletionContext;
    port: number;
}) {
    const cursor = buildCursor(document, position, false);
    const cursorAtInfo = getCursorAtInfo(document.getText(), cursor);

    const obj = { document, cursor, port, vscodeCancelToken: token, context };
    switch (cursorAtInfo.type) {
        case 'endTag':
        case 'tagName':
        case 'attrName':
            // do nothing
            break;
        case 'text':
            return await componentNameCompletion({ ...obj, cursorAtInfo });
        case 'startTag':
            // TODO custom directive
            return await componentAttrCompletion({ ...obj, cursorAtInfo });
        case 'attrValue':
        case 'template':
            // TODO: completion ctrl/type/filter
            break;
    }
}
