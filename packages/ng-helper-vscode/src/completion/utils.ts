import { isInStartTagAnd, canCompletionNgDirective } from '@ng-helper/shared/lib/html';
import { TextDocument } from 'vscode';

export function isComponentHtml(document: TextDocument) {
    return document.fileName.endsWith('.component.html');
}

export function isInStartTagAndCanCompletionNgDirective(textBeforeCursor: string): boolean {
    return isInStartTagAnd(textBeforeCursor, canCompletionNgDirective);
}

export function isNgDirectiveAttr(attrName: string): boolean {
    return attrName.startsWith('ng-');
}

export function isComponentTag(tagName: string): boolean {
    return tagName.includes('-');
}
