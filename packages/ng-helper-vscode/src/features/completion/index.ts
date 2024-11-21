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

import { componentNameCompletion } from './componentName';
import { componentOrDirectiveAttrCompletion } from './componentOrDirectiveAttr';
import { directiveNameCompletion } from './directiveName';
import { templateOrAttrValueCompletion } from './type';

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

export function registerCompletion(context: ExtensionContext, port: number) {
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
            // do nothing
            break;
        case 'text':
            return await componentNameCompletion({ ...obj, cursorAtInfo });
        case 'attrName':
            // 指令名字自动补全，必须输入至少一个字符才能触发。
            // 输入这个字符后，在非 hover 模式下，光标被认为在这个字符上，
            // 所以就进入了 'attrName' 分支。
            return await directiveNameCompletion({ ...obj, cursorAtInfo });
        case 'startTag':
            return await componentOrDirectiveAttrCompletion({ ...obj, cursorAtInfo });
        case 'attrValue':
        case 'template':
            return await templateOrAttrValueCompletion({ ...obj, cursorAtInfo });
    }
}
