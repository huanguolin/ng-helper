import os from 'os';

import { SPACE } from '@ng-helper/shared/lib/html';
import { Position, Range, TextDocument } from 'vscode';

const NG_TPL_REG = /\btemplate\s*:\s*(['"`])[\s\S]*?(?!\\)(\1)/g;

export function resolveVirtualDocText(document: TextDocument, position?: Position): string | undefined {
    const text = document.getText();

    const ranges: Range[] = [];

    let match: RegExpExecArray | null;
    NG_TPL_REG.lastIndex = 0;
    while ((match = NG_TPL_REG.exec(text)) !== null) {
        const index = match.index;
        const matchStr = match[0];
        const strBegin = index + matchStr.indexOf(match[1]) + 1;
        const strEnd = index + matchStr.lastIndexOf(match[1]);
        ranges.push(new Range(document.positionAt(strBegin), document.positionAt(strEnd)));
    }

    // fix #18
    if (position) {
        const inRange = ranges.find((r) => r.contains(position));
        if (!inRange) {
            return;
        }
    }

    if (ranges.length) {
        return getVirtualDocText(document, ranges);
    }
}

function getVirtualDocText(document: TextDocument, ranges: Range[]): string {
    const text = document.getText();
    let content = text
        .split(os.EOL)
        .map((line) => SPACE.repeat(line.length))
        .join(os.EOL);

    for (const range of ranges) {
        const start = document.offsetAt(range.start);
        const end = document.offsetAt(range.end);
        const targetContent = text.slice(start, end);
        content = content.slice(0, start) + targetContent + content.slice(end);
    }
    return content;
}
