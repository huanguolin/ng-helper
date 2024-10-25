import { type TextDocument, Range, Uri, type CancellationToken } from 'vscode';

import { getControllerNameDefinitionApi } from '../../service/api';
import { isFileExistsOnWorkspace } from '../../utils';

import type { MyLink } from '.';

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
        links.push({ type: 'controllerName', fileName: document.fileName, url: controllerName, range, tooltip: 'Go to controller file' });
    }
    return links;
}

export async function resolveControllerNameLink(link: MyLink, token: CancellationToken, port: number): Promise<MyLink | undefined> {
    const result = await getControllerNameDefinitionApi({
        port,
        vscodeCancelToken: token,
        info: { fileName: link.fileName, controllerName: link.url },
    });

    if (result && (await isFileExistsOnWorkspace(Uri.file(result.filePath)))) {
        link.target = Uri.file(result.filePath);
        return link;
    }
}
