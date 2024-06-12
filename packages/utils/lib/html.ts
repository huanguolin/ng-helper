
export const ASCII_SPACE = '\u0020';

export function isInStartTagAndCanCompletion(textBeforeCursor: string) {
    const lastStartTagStart = textBeforeCursor.lastIndexOf('<');
    const lastEndTagStart = textBeforeCursor.lastIndexOf('</');
    // |
    // |<>
    // </|
    if (lastStartTagStart < 0
        || lastEndTagStart >= lastStartTagStart) {
        return false;
    }

    // > or />
    const lastStartTagEnd = textBeforeCursor.lastIndexOf('>');
    // >|
    // />|
    if (lastStartTagEnd > lastStartTagStart) {
        return false;
    }

    /**
     * ><|
     * /><|
     * <|
     */
    const tagTextBeforeCursor = textBeforeCursor.slice(lastStartTagStart);
    return canCompletionInStartTag(tagTextBeforeCursor);
}

export function canCompletionInStartTag(tagTextBeforeCursor: string): boolean {
    // input example: '<div class="a b" title="abc'
    const chArr = Array.from(tagTextBeforeCursor);
    const lastCh = chArr[chArr.length - 1];

    if (lastCh === '<') {
        return false;
    }

    if (lastCh !== ASCII_SPACE && lastCh !== '"') {
        return false;
    }

    const quotePaired = chArr.filter(c => c === '"').length % 2 == 0;
    return quotePaired;
}
