import { type TextDocument, Range, Uri, type CancellationToken } from 'vscode';

import type { TsService } from '../../service/tsService';
import { isFileExistsOnWorkspace } from '../../utils';

import type { MyLink } from '.';

/**
 * 匹配单双引号字符串。
 * (\\.|(?!\\1).) 分为两个部分：
 * 1. \\. 匹配被转义的任意字符。
 * 2. (?!\\1). 匹配一个非引号字符，用于确保匹配的字符串不包含引号。
 */
const URL_REGEX_STR = `(['"])(\\.|(?!\\1).)*?\\1`;
const CONTROLLER_NAME_REGEX_STR = `controller\\s*:\\s*${URL_REGEX_STR}`;
const MATCH_URL = new RegExp(URL_REGEX_STR);
const MATCH_ALL_CONTROLLER_NAME_URL = new RegExp(CONTROLLER_NAME_REGEX_STR, 'g');

export function findControllerNameLink(text: string, document: TextDocument): MyLink[] {
    const links: MyLink[] = [];
    MATCH_ALL_CONTROLLER_NAME_URL.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = MATCH_ALL_CONTROLLER_NAME_URL.exec(text)) !== null) {
        const matchStr = match[0];
        const controllerName = matchStr.match(MATCH_URL)![0].slice(1, -1);
        const startPos = document.positionAt(match.index + matchStr.indexOf(controllerName));
        const endPos = document.positionAt(match.index + matchStr.length - 1);
        const range = new Range(startPos, endPos);
        links.push({
            type: 'controllerName',
            fileName: document.fileName,
            url: controllerName,
            range,
            tooltip: 'Go to controller file',
        });
    }
    return links;
}

export async function resolveControllerNameLink(
    link: MyLink,
    token: CancellationToken,
    tsService: TsService,
): Promise<MyLink | undefined> {
    const result = await tsService.getControllerNameDefinitionApi({
        cancelToken: token,
        params: { fileName: link.fileName, controllerName: link.url },
    });

    if (result && (await isFileExistsOnWorkspace(Uri.file(result.filePath)))) {
        link.target = Uri.file(result.filePath);
        return link;
    }
}
