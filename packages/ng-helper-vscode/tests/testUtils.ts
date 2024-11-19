/* eslint-disable */

import { URI } from 'vscode-uri';

export function convertPathToFileUrl(filePath: string): string {
    return URI.file(filePath).toString();
}

export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
