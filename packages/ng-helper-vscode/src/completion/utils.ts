import { isInStartTagAnd, canCompletionNgDirective } from '@ng-helper/shared/lib/html';
import { TextDocument } from 'vscode';

export function isComponentHtml(document: TextDocument) {
    return document.fileName.endsWith('.component.html');
}

export function isInStartTagAndCanCompletionNgDirective(textBeforeCursor: string): boolean {
    return isInStartTagAnd(textBeforeCursor, canCompletionNgDirective);
}
