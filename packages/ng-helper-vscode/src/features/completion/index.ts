import { getCursorAtInfo, type CursorAtInfo } from '@ng-helper/shared/lib/cursorAt';
import { SPACE, type Cursor } from '@ng-helper/shared/lib/html';
import {
    CompletionList,
    ExtensionContext,
    languages,
    type CancellationToken,
    type CompletionContext,
    type Position,
    type TextDocument,
} from 'vscode';

import { buildCursor } from '../../utils';
import { isComponentTagName } from '../utils';

import { builtInDirectiveNameCompletion } from './builtinDirectiveName';
import { componentNameCompletion } from './componentName';
import { componentOrDirectiveAttrCompletion } from './componentOrDirectiveAttr';
import { customDirectiveNameCompletion } from './customDirectiveName';
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
        case 'attrValue':
        case 'template':
            return await templateOrAttrValueCompletion({ ...obj, cursorAtInfo });

        // 指令名字补全触发条件: 输入字符。
        // 组件和指令属性补全触发条件: 输入空格或者输入字符。
        //
        // 输入字符后，在非 hover 模式下，光标被认为在这个字符上，
        // type 为 'attrName' 。
        // 而输入空格后，type 是 'startTag'.
        //
        // 要注意到, 在输入时光标不可能跑到属性最后一个字符前去，所以这里没有非法的情况。
        //
        // 另外，不希望组件上，输入字符时补全指令，会被误以为补全的是组件的属性。
        // 此种情况下要用指令的情况较为罕见，所以不支持。
        //
        // 综上所述，
        // 1. 'startTag' 时一定为 component/directive attr 补全。
        // 2. 'attrName' 时，有两种情况：
        //   a. tagName 是组件，则可以补全 ng-*, 或者 component attr.
        //   b. tagName 不是组件，则可以补全 ng-*, 或者 directive name.
        case 'startTag':
            return await componentOrDirectiveAttrCompletion({ ...obj, cursorAtInfo });
        case 'attrName': {
            const args = { ...obj, cursorAtInfo };
            const builtinList = builtInDirectiveNameCompletion(args) ?? [];
            if (isComponentTagName(cursorAtInfo.tagName)) {
                const list = (await componentOrDirectiveAttrCompletion(args)) ?? [];
                return new CompletionList(builtinList.concat(list), false);
            } else {
                const list = (await customDirectiveNameCompletion(args)) ?? [];
                return new CompletionList(builtinList.concat(list), false);
            }
        }
    }
}
