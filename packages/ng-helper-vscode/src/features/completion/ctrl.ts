import {
    isContainsNgFilter,
    getTextInTemplate,
    getBeforeCursorText,
    Cursor,
    getTheAttrWhileCursorAtValue,
    getHtmlTagAt,
} from '@ng-helper/shared/lib/html';
import { languages, TextDocument, Position, CompletionItem, CompletionList, CancellationToken } from 'vscode';

import { timeCost } from '../../debug';
import { getComponentControllerAsApi } from '../../service/api';
import { checkNgHelperServerRunning } from '../../utils';
import { getControllerNameInfoFromHtml, getCorrespondingTsFileName, isComponentHtml, isComponentTagName, isNgDirectiveAttr } from '../utils';

export function ctrl(port: number) {
    return languages.registerCompletionItemProvider('html', {
        async provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken, context) {
            // 避免在 inline template 中扰乱 data binding 的 completion
            if (context.triggerCharacter) {
                return;
            }

            if (isComponentHtml(document)) {
                return timeCost('provideComponentCtrlCompletion', async () => {
                    try {
                        return await provideComponentCtrlCompletion({ document, position, port, vscodeCancelToken: token });
                    } catch (error) {
                        console.error('provideComponentCtrlCompletion() error:', error);
                        return undefined;
                    }
                });
            }

            const ctrlInfo = getControllerNameInfoFromHtml(document);
            if (ctrlInfo && ctrlInfo.controllerAs) {
                return new CompletionList([new CompletionItem(ctrlInfo.controllerAs)], false);
            }
        },
    });
}

async function provideComponentCtrlCompletion({
    document,
    position,
    port,
    vscodeCancelToken,
}: {
    document: TextDocument;
    position: Position;
    port: number;
    vscodeCancelToken: CancellationToken;
}) {
    const docText = document.getText();
    const cursor: Cursor = { at: document.offsetAt(position), isHover: false };

    // 模版 {{}} 中
    const tplText = getTextInTemplate(docText, cursor);
    if (tplText) {
        const prefix = getBeforeCursorText(tplText);
        if (prefix && !isContainsNgFilter(prefix)) {
            return await getComponentControllerAsCompletion(document, port, vscodeCancelToken);
        }
    }

    // 组件属性值中 或者 ng-* 属性值中
    const tag = getHtmlTagAt(docText, cursor);
    if (tag) {
        const attr = getTheAttrWhileCursorAtValue(tag, cursor);
        if (attr && (isComponentTagName(tag.tagName) || isNgDirectiveAttr(attr.name.text))) {
            return await getComponentControllerAsCompletion(document, port, vscodeCancelToken);
        }
    }
}

async function getComponentControllerAsCompletion(document: TextDocument, port: number, vscodeCancelToken: CancellationToken) {
    const tsFilePath = (await getCorrespondingTsFileName(document))!;

    if (!(await checkNgHelperServerRunning(tsFilePath, port))) {
        return;
    }

    const res = await getComponentControllerAsApi({ port, info: { fileName: tsFilePath }, vscodeCancelToken });
    if (res) {
        return new CompletionList([new CompletionItem(res)], false);
    }
}
