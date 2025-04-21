import { normalize } from 'node:path';

import { cursorAt } from '@ng-helper/shared/lib/cursorAt';
import type { Cursor } from '@ng-helper/shared/lib/html';
import { window, workspace, Uri, FileType, TextDocument, type Position } from 'vscode';

export async function triggerTsServerByProject(filePath: string) {
    let scriptFilePath = filePath;

    if (!scriptFilePath.endsWith('.ts') && !scriptFilePath.endsWith('.js')) {
        scriptFilePath = (await getOneScriptFile(filePath)) ?? '';
    }

    if (!(await isFileExistsOnWorkspace(Uri.file(scriptFilePath)))) {
        const path = await getOneScriptFile(filePath);
        if (!path) {
            return;
        }
        scriptFilePath = path;
    }

    const selection = await window.showWarningMessage(
        "To access features like auto-completion, you need to open a TypeScript/JavaScript file at least once per project. Otherwise, the relevant information won't be available. Click 'OK' and we will automatically open one for you.",
        'OK',
    );
    if (selection === 'OK') {
        // 目前只能通过打开 ts/js 文档来确保，tsserver 真正运行起来，这样插件才能跑起来。
        const document = await workspace.openTextDocument(Uri.file(scriptFilePath));
        await window.showTextDocument(document);
    }

    async function getOneScriptFile(filePath: string): Promise<string | undefined> {
        const files = await getScriptFiles(filePath, { limit: 1 });
        return files[0];
    }
}

export async function isFileExistsOnWorkspace(fileUri: Uri): Promise<boolean> {
    try {
        // 文件不存在会 throw error
        // 为什么不用 node.js 的 fs 方法？因为它们没有考虑 remote file 等情况。
        await workspace.fs.stat(fileUri);
        return true;
    } catch {
        return false;
    }
}

export async function getScriptFiles(
    filePath: string,
    options?: {
        fallbackCnt?: number;
        limit?: number;
    },
): Promise<string[]> {
    return await getFiles(filePath, { suffix: ['.ts', '.js'], ...options });
}

export async function getFiles(
    filePath: string,
    options?: {
        suffix?: string[];
        predicate?: (filePath: string) => boolean;
        excludePaths?: string[];
        fallbackCnt?: number;
        limit?: number;
    },
): Promise<string[]> {
    const dir = getParentDir(filePath);
    const rootDir = normalizePath(getWorkspacePath()?.fsPath ?? '');

    if (!dir.startsWith(rootDir)) {
        return [];
    }

    const fallbackCnt = options?.fallbackCnt ?? 3;
    const files = await listFiles(dir, {
        suffix: options?.suffix,
        predicate: options?.predicate,
        limit: options?.limit,
        recursive: true,
    });
    if (files.length) {
        return files;
    } else {
        return fallbackCnt > 0 ? getFiles(dir, { ...options, excludePaths: [dir], fallbackCnt: fallbackCnt - 1 }) : [];
    }
}

export async function listFiles(
    dirPath: string,
    options: {
        suffix?: string[];
        predicate?: (filePath: string) => boolean;
        excludePaths?: string[];
        limit?: number;
        recursive?: boolean;
    },
): Promise<string[]> {
    const result: string[] = [];

    // 避免遍历 node_modules
    if (dirPath.includes('node_modules')) {
        return result;
    }

    let files: [string, FileType][] = [];
    try {
        files = await workspace.fs.readDirectory(Uri.file(dirPath));
    } catch (error) {
        console.error('listFiles() error:', error);
        return result;
    }

    const subDirNames: string[] = [];
    const excludePaths = options.excludePaths?.map((path) => normalizePath(path)) ?? [];
    for (const [name, fileType] of files) {
        if (options.limit && result.length >= options.limit) {
            break;
        }

        if (fileType === FileType.File) {
            if (options.suffix && !options.suffix.some((suffix) => name.endsWith(suffix))) {
                continue;
            }

            const filePath = `${dirPath}/${name}`;
            if (options.predicate && !options.predicate(filePath)) {
                continue;
            }

            result.push(filePath);
        } else if (options.recursive && fileType === FileType.Directory) {
            if (options.excludePaths && excludePaths.some((path) => `${dirPath}/${name}`.startsWith(path))) {
                continue;
            }
            subDirNames.push(name);
        }
    }

    if (options.recursive && subDirNames.length) {
        for (const subDirName of subDirNames) {
            const subFiles = await listFiles(`${dirPath}/${subDirName}`, options);
            result.push(...subFiles);
            if (options.limit && result.length >= options.limit) {
                result.splice(options.limit, result.length - options.limit);
                break;
            }
        }
    }

    return result;
}

export function getParentDir(filePath: string): string {
    const path = normalizePath(filePath);
    const pathArr = path.split('/');
    pathArr.pop();
    return pathArr.join('/');
}

export function getWorkspacePath(): Uri | undefined {
    const workspaceFolders = workspace.workspaceFolders;
    if (!workspaceFolders) {
        return;
    }

    return workspaceFolders[0].uri;
}

export function normalizeFileExt(ext: string): string {
    if (ext.startsWith('.')) {
        return ext.slice(1);
    }
    return ext;
}

export function normalizePath(filePath: string): string {
    filePath = normalize(filePath);
    return filePath.replace(/\\/g, '/');
}

export function uniq<T>(arr: T[]): T[] {
    return Array.from(new Set(arr));
}

export function intersect<T>(arr1: T[], arr2: T[]): T[] {
    return arr1.filter((x) => arr2.includes(x));
}

export function buildCursor(document: TextDocument, position: Position, isHover = true): Cursor {
    return cursorAt(document.offsetAt(position), isHover);
}
