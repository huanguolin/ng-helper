import { basename, normalize, parse } from 'node:path';

import { cursorAt } from '@ng-helper/shared/lib/cursorAt';
import type { Cursor } from '@ng-helper/shared/lib/html';
import { window, workspace, Uri, FileType, TextDocument, type Position } from 'vscode';

import { logger } from './logger';

export async function triggerTsServerByProject(filePath: string): Promise<boolean> {
    let scriptFilePath = filePath;

    if (!scriptFilePath.endsWith('.ts') && !scriptFilePath.endsWith('.js')) {
        scriptFilePath = (await getOneScriptFile(filePath)) ?? '';
    }

    if (!(await isFileExistsOnWorkspace(Uri.file(scriptFilePath)))) {
        const path = await getOneScriptFile(filePath);
        if (!path) {
            return false;
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
        return true;
    }

    return false;

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
        /**
         * 这里要使用深度优先搜索（DFS）。为什么？
         * 举一个实际 bug:
         * cloud/client/xxx-biz 目录是某个业务的代码，如果切换的一个以前的分支，这个目录不存在，
         * 编辑器中还显示的是 cloud/client/xxx-biz/y.html, 虽然这个文件已经被删除了。
         * 但是在关掉该文件前，还是可以去做触发 ng-helper 查询 tsserver 信息的操作(如：hover ctrl)。
         * 由于默认是广度优先搜索（BFS），会先去查找 cloud/client/xxx-biz/y.ts 文件，
         * 由于文件不存在，会向父文件夹继续查找，这样很容易找到并返回项目下的一些工具配置文件(比如 .eslintrc.js)。
         * 而这些文件并没有在 tsconfig.json 的项目配置范围内，那么最终得到的 projectRoot 会是
         * vscode 打开的 ${workspace} 目录(即根目录)。
         * 这样导致后续的任何文件都能归集到该项目下，导致 html 文件触发的 ng-helper 查询 tsserver 信息操作,
         * 无法产生 'noContext' 状态, 从而无法调用 triggerTsServerByProject，使得 ng-helper 处于半瘫痪状态。
         */
        DFS: true,
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
        /**
         * 是否使用深度优先搜索, 如果开启，则默认 recursive 为 true。
         */
        DFS?: boolean;
    },
): Promise<string[]> {
    if (options.DFS) {
        // DFS 开启时，recursive 默认是 true
        options.recursive = true;
    }

    const result: string[] = [];

    // 避免遍历 node_modules
    if (dirPath.includes('node_modules')) {
        return result;
    }

    let files: [string, FileType][] = [];
    try {
        files = await workspace.fs.readDirectory(Uri.file(dirPath));
    } catch (error) {
        logger.logError('listFiles() error:', error);
        return result;
    }

    const excludePaths = options.excludePaths?.map((path) => normalizePath(path)) ?? [];

    const subDirNames: string[] = [];
    // DFS，则先找符合条件的子文件夹
    if (options.DFS) {
        const dirs = files.filter(
            ([name, type]) =>
                type === FileType.Directory && !excludePaths.some((path) => `${dirPath}/${name}`.startsWith(path)),
        );
        subDirNames.push(...dirs.map(([name]) => name));
    }

    // 如果没有子目录（这里包含了 DFS 找不到目录和非 DFS 初始 subDirNames 就是为空），就优先处理当前目录下的文件
    if (!subDirNames.length) {
        for (const [name, fileType] of files) {
            if (options.limit && result.length >= options.limit) {
                break;
            }

            if (fileType === FileType.File && (!options.DFS || !subDirNames.length)) {
                if (options.suffix && !options.suffix.some((suffix) => name.endsWith(suffix))) {
                    continue;
                }

                const filePath = `${dirPath}/${name}`;
                if (options.predicate && !options.predicate(filePath)) {
                    continue;
                }

                result.push(filePath);
            } else if (options.recursive && fileType === FileType.Directory) {
                if (excludePaths.some((path) => `${dirPath}/${name}`.startsWith(path))) {
                    continue;
                }
                subDirNames.push(name);
            }
        }
    }

    // 记住：DFS 开启时，recursive 默认是 true
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
    filePath = filePath.replace(/\\/g, '/');
    if (filePath.endsWith('/')) {
        return filePath.slice(0, -1);
    }
    return filePath;
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

export function time(): string {
    const date = new Date();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${hours}:${minutes}:${seconds}`;
}

export function getLastFolderName(p: string): string {
    const normalizedPath = normalize(p); // 标准化，比如去掉多余的斜杠
    const parsed = parse(normalizedPath);

    if (parsed.ext) {
        // 如果有扩展名，说明是文件，返回上一级文件夹
        return basename(parsed.dir);
    } else {
        // 如果是文件夹，直接返回最后一段
        return basename(normalizedPath);
    }
}

export function getFileName(filePath: string): string {
    const normalizedPath = normalize(filePath); // 标准化，比如去掉多余的斜杠
    return basename(normalizedPath);
}

export function findMissingElements(sourceArr: string[], targetArr: string[]): string[] {
    return targetArr.filter((item) => !sourceArr.includes(item));
}
