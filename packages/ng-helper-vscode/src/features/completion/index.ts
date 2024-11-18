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

import { componentAttr, componentOrDirectiveAttrCompletion } from './componentAttr';
import { componentName, componentNameCompletion } from './componentName';
import { ctrl } from './ctrl';
import { customDirective } from './customDirective';
import { ngDirective } from './ngDirective';
import { templateOrAttrValueCompletion, type } from './type';

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

interface BaseCompletionParam {
    document: TextDocument;
    vscodeCancelToken: CancellationToken;
    context: CompletionContext;
    noRegisterTriggerChar: boolean;
    port: number;
}

interface CompletionParam extends BaseCompletionParam {
    document: TextDocument;
    position: Position;
}

export interface CompletionParamObj<T extends CursorAtInfo | undefined = undefined> extends BaseCompletionParam {
    cursorAtInfo: T;
    cursor: Cursor;
}

export function registerCompletion2(context: ExtensionContext, port: number) {
    context.subscriptions.push(
        languages.registerCompletionItemProvider('html', {
            provideCompletionItems(document, position, vscodeCancelToken, context) {
                return completion({
                    noRegisterTriggerChar: true,
                    document,
                    position,
                    vscodeCancelToken,
                    context,
                    port,
                });
            },
        }),
        languages.registerCompletionItemProvider(
            'html',
            {
                provideCompletionItems(document, position, vscodeCancelToken, context) {
                    return completion({
                        noRegisterTriggerChar: false,
                        document,
                        position,
                        vscodeCancelToken,
                        context,
                        port,
                    });
                },
            },
            SPACE,
            '<',
            '.',
        ),
    );
}

export async function completion({
    document,
    position,
    vscodeCancelToken,
    context,
    port,
    noRegisterTriggerChar,
}: CompletionParam) {
    const cursor = buildCursor(document, position, false);
    const cursorAtInfo = getCursorAtInfo(document.getText(), cursor);

    const obj = { document, cursor, port, vscodeCancelToken, context, noRegisterTriggerChar };
    switch (cursorAtInfo.type) {
        case 'endTag':
        case 'tagName':
        case 'attrName':
            // do nothing
            break;
        case 'text':
            return await componentNameCompletion({ ...obj, cursorAtInfo });
        case 'startTag':
            return await componentOrDirectiveAttrCompletion({ ...obj, cursorAtInfo });
        case 'attrValue':
        case 'template':
            return await templateOrAttrValueCompletion({ ...obj, cursorAtInfo });
    }
}
