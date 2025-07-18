import { getCursorAtInfo, type CursorAtInfo } from '@ng-helper/shared/lib/cursorAt';
import { SPACE, type Cursor } from '@ng-helper/shared/lib/html';
import { isComponentTagName } from '@ng-helper/shared/lib/ngUtils';
import {
    CompletionList,
    languages,
    type CancellationToken,
    type CompletionContext,
    type CompletionItem,
    type Position,
    type TextDocument,
} from 'vscode';

import { checkCancellation, createCancellationTokenSource, withTimeoutAndMeasure } from '../../asyncUtils';
import type { NgContext } from '../../ngContext';
import { buildCursor } from '../../utils';

import { builtinDirectiveNameCompletion } from './builtin';
import { componentNameCompletion, resolveComponentName } from './componentName';
import { componentOrDirectiveAttrCompletion } from './componentOrDirectiveAttr';
import { customDirectiveNameCompletion, resolveDirectiveName } from './customDirectiveName';
import { templateOrAttrValueCompletion } from './type';
import type { NgHelperCompletionItem } from './utils';

interface BaseCompletionParam {
    document: TextDocument;
    cancelToken: CancellationToken;
    ngContext: NgContext;
    completionContext: CompletionContext;
}

interface CompletionParam extends BaseCompletionParam {
    document: TextDocument;
    position: Position;
}

export interface CompletionParamObj<T extends CursorAtInfo | undefined = undefined> extends BaseCompletionParam {
    cursorAtInfo: T;
    cursor: Cursor;
}

export const triggerChars = [SPACE, '<', '.'];

export function registerCompletion(ngContext: NgContext) {
    ngContext.vscodeContext.subscriptions.push(
        languages.registerCompletionItemProvider(
            'html',
            {
                async provideCompletionItems(document, position, token, completionContext) {
                    if (!ngContext.isNgProjectDocument(document)) {
                        return;
                    }

                    const cancelTokenSource = createCancellationTokenSource(token);
                    return await withTimeoutAndMeasure(
                        'provideCompletion',
                        () =>
                            completion({
                                document,
                                position,
                                cancelToken: cancelTokenSource.token,
                                ngContext,
                                completionContext,
                            }),
                        { cancelTokenSource },
                    );
                },
                async resolveCompletionItem(item, token) {
                    if (!('ngHelperInfo' in item)) {
                        return item;
                    }

                    const cancelTokenSource = createCancellationTokenSource(token);

                    return await withTimeoutAndMeasure(
                        'resolveCompletionItem',
                        () => resolveCompletionItem(ngContext, item as NgHelperCompletionItem, cancelTokenSource.token),
                        { cancelTokenSource },
                    );
                },
            },
            ...triggerChars, // 除了注册的这几个字符外，word char 也会触发，具体看API的介绍。
        ),
    );
}

async function completion({ document, position, cancelToken, ngContext, completionContext }: CompletionParam) {
    const cursor = buildCursor(document, position, false);
    const cursorAtInfo = getCursorAtInfo(document.getText(), cursor, {
        filePath: document.uri.toString(),
        version: document.version,
    });

    checkCancellation(cancelToken);

    const obj = {
        document,
        cursor,
        cancelToken,
        ngContext,
        completionContext,
    } as CompletionParamObj<CursorAtInfo | undefined>;
    switch (cursorAtInfo.type) {
        case 'endTag':
        case 'tagName':
            // do nothing
            break;
        case 'text':
            return await componentNameCompletion({ ...obj, cursorAtInfo });
        case 'attrValue':
        case 'template':
            return await templateOrAttrValueCompletion({ ...obj, cursorAtInfo, position });

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
            const builtinList = builtinDirectiveNameCompletion(args) ?? [];
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

async function resolveCompletionItem(
    ngContext: NgContext,
    ngItem: NgHelperCompletionItem,
    cancelToken: CancellationToken,
): Promise<CompletionItem> {
    switch (ngItem.ngHelperInfo.type) {
        case 'componentName':
            return await resolveComponentName(ngContext, ngItem, cancelToken);
        case 'directiveName':
            return await resolveDirectiveName(ngContext, ngItem, cancelToken);
        default:
            return ngItem;
    }
}
