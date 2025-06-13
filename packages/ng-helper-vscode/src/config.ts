import type { InjectionCheckMode } from '@ng-helper/shared/lib/plugin';
import { Uri, window, workspace } from 'vscode';
import z from 'zod';

import { EXT_CONF_PATH } from './constants';
import { getWorkspacePath, isFileExistsOnWorkspace, normalizeFileExt, normalizePath } from './utils';

const ALLOW_SCRIPT_FILE_EXTS = ['js', 'ts', '.js', '.ts'] as const;
const ALLOW_INJECTION_CHECK_MODE = [
    'strict_equal',
    'ignore_case_word_match',
    'count_match',
    'off',
] as const satisfies InjectionCheckMode[];

const NgHelperUserConfigScheme = z.object({
    /**
     * like 'less', 'scss', 'css' etc, default is 'css';
     */
    componentStyleFileExt: z.string().optional(),
    /**
     * 'js' or 'ts', default is 'js';
     */
    componentScriptFileExt: z.enum(ALLOW_SCRIPT_FILE_EXTS).optional(),
    injectionCheckMode: z.enum(ALLOW_INJECTION_CHECK_MODE).optional(),
    /**
     * AngularJS projects configuration with their paths (optional)
     * Key: project name, Value: project path
     */
    angularJsProjects: z.record(z.string(), z.string()).optional(),
    /**
     * TypeScript projects configuration with their paths (optional)
     * Key: project name, Value: project path
     */
    typescriptProjects: z.record(z.string(), z.string()).optional(),
    /**
     * Mapping between TypeScript and AngularJS projects (optional)
     * Key: TypeScript project name, Value: Array of AngularJS project names
     * If not provided, the extension will auto mapping.
     */
    projectMapping: z.record(z.string(), z.array(z.string())).optional(),
});

export type NgHelperUserConfig = z.infer<typeof NgHelperUserConfigScheme>;

type ProjectInfo = {
    name: string;
    /**
     * 相对于 vscode workdir 的路径，且已经 normalized.
     */
    relativePath: string;
    /**
     * 绝对路劲，已经 normalized.
     */
    absolutePath: string;
};

/**
 * 与 rust 不同，这里 ok 和 error 可以同时存在。
 */
type Result<T, E = string> = {
    ok?: T;
    error?: E;
};

export class NgHelperConfig {
    private _ngProjects?: ProjectInfo[];
    private _tsProjects?: ProjectInfo[];
    constructor(
        public userConfig: NgHelperUserConfig,
        public port: number,
    ) {}

    private buildProjects(config: Record<string, string>): ProjectInfo[] {
        return Array.from(Object.entries(config)).map(([name, path]) => ({
            name,
            relativePath: path,
            absolutePath: path, // TODO
        }));
    }
}

export async function readUserConfig(): Promise<NgHelperUserConfig> {
    const uri = getUserConfigFileUri()!;
    const uint8Array = await workspace.fs.readFile(uri);
    const jsonText = new TextDecoder().decode(uint8Array);

    const { ok: config, error } = await parseAndValidateUserConfig(jsonText);
    if (error) {
        // 不等待，避免阻塞插件启动进程
        void showUserConfigErrors(error);
    }

    return config!;
}

export function getUserConfigFileUri(): Uri | undefined {
    const rootWorkspaceUri = getWorkspacePath();
    if (!rootWorkspaceUri) {
        return;
    }
    return Uri.joinPath(rootWorkspaceUri, EXT_CONF_PATH);
}

export async function showUserConfigErrors(error: string | undefined) {
    if (!error) {
        return;
    }

    const selection = await window.showWarningMessage(
        `The ng-helper configuration is invalid, please check the error: ${error}.`,
        'OK',
    );
    if (selection === 'OK') {
        // 打开配置文件。
        const document = await workspace.openTextDocument(getUserConfigFileUri()!);
        await window.showTextDocument(document);
    }
}

async function parseAndValidateUserConfig(jsonText: string): Promise<Result<NgHelperUserConfig>> {
    // 解析和标准化基本配置
    const baseConfigResult = parseBaseConfig(jsonText);
    if (baseConfigResult.error) {
        return baseConfigResult;
    }
    let config = baseConfigResult.ok!;

    // 验证项目结构的基本逻辑
    const structureValidationResult = validateProjectsStructure(config);
    if (structureValidationResult.error) {
        return structureValidationResult;
    }
    config = structureValidationResult.ok!;

    // 验证 AngularJS 项目配置
    if (config.angularJsProjects) {
        const angularJsResult = await validateAngularJsProjects(config);
        if (angularJsResult.error) {
            return angularJsResult;
        }
        config = angularJsResult.ok!;
    }

    // 验证 TypeScript 项目配置
    if (config.typescriptProjects) {
        const typescriptResult = await validateTypescriptProjects(config);
        if (typescriptResult.error) {
            return typescriptResult;
        }
        config = typescriptResult.ok!;
    }

    // 验证项目映射配置
    if (config.projectMapping) {
        const mappingResult = validateProjectMapping(config);
        if (mappingResult.error) {
            return mappingResult;
        }
        config = mappingResult.ok!;
    }

    return { ok: config };
}

function parseBaseConfig(jsonText: string): Result<NgHelperUserConfig> {
    const defaultConfig = getDefaultConfig();

    let config: NgHelperUserConfig;
    try {
        const userConfig = NgHelperUserConfigScheme.parse(JSON.parse(jsonText || '{}'));
        config = Object.assign(defaultConfig, userConfig);
    } catch (err) {
        return {
            ok: defaultConfig,
            error: `Parse user config failed: ${err instanceof Error ? err.message : `${err as string}`}`,
        };
    }

    // 标准化文件扩展名
    if (config.componentStyleFileExt) {
        config.componentStyleFileExt = normalizeFileExt(config.componentStyleFileExt);
    }
    if (config.componentScriptFileExt) {
        config.componentScriptFileExt = normalizeFileExt(config.componentScriptFileExt) as 'js' | 'ts';
    }

    return { ok: config };
}

function validateProjectsStructure(config: NgHelperUserConfig): Result<NgHelperUserConfig> {
    const isRecordEmpty = (record?: Record<string, unknown>) => !record || !Array.from(Object.keys(record)).length;
    const isNgProjectEmpty = isRecordEmpty(config.angularJsProjects);
    const isTsProjectEmpty = isRecordEmpty(config.typescriptProjects);
    const isMappingEmpty = isRecordEmpty(config.projectMapping);
    const needNgProject = !isTsProjectEmpty || !isMappingEmpty;

    if (needNgProject && isNgProjectEmpty) {
        config.angularJsProjects = undefined;
        config.typescriptProjects = undefined;
        config.projectMapping = undefined;
        return {
            ok: config,
            error: 'If "projectMapping" or "typescriptProjects" is set, then "angularJsProjects" is required',
        };
    }

    if ((isMappingEmpty && !isTsProjectEmpty) || (!isMappingEmpty && isTsProjectEmpty)) {
        config.typescriptProjects = undefined;
        config.projectMapping = undefined;
        return {
            ok: config,
            error: 'Cannot set "projectMapping" or "typescriptProjects" without the other',
        };
    }

    return { ok: config };
}

async function validateAngularJsProjects(config: NgHelperUserConfig): Promise<Result<NgHelperUserConfig>> {
    const workdir = getWorkspacePath()!.fsPath;
    const normalizeProjectPath = (p: string) => normalizePath(workdir + '/' + p);

    const clearAndPackResult = (error: string) => {
        const clearedConfig = { ...config };
        clearedConfig.angularJsProjects = undefined;
        clearedConfig.typescriptProjects = undefined;
        clearedConfig.projectMapping = undefined;
        return {
            ok: clearedConfig,
            error,
        };
    };

    for (const [name, path] of Object.entries(config.angularJsProjects!)) {
        let p = normalizePath(path);
        if (!p.startsWith('/')) {
            p = normalizeProjectPath(p);
        }
        if (!p.startsWith(workdir)) {
            return clearAndPackResult(`The AngularJS project (name: ${name}) path is out of vscode workspace`);
        }
        if (!(await isFileExistsOnWorkspace(Uri.file(p)))) {
            return clearAndPackResult(`The AngularJS project (name: ${name}) path does not exist: ${path}`);
        }
        config.angularJsProjects![name] = p;
    }

    const error = findOverlapPaths(config.angularJsProjects!);
    if (error) {
        return clearAndPackResult('In "angularJsProjects", ' + error);
    }

    return { ok: config };
}

async function validateTypescriptProjects(config: NgHelperUserConfig): Promise<Result<NgHelperUserConfig>> {
    const workdir = getWorkspacePath()!.fsPath;
    const normalizeProjectPath = (p: string) => normalizePath(workdir + '/' + p);

    const clearAndPackResult = (error: string) => {
        const clearedConfig = { ...config };
        clearedConfig.typescriptProjects = undefined;
        clearedConfig.projectMapping = undefined;
        return {
            ok: clearedConfig,
            error,
        };
    };

    for (const [name, path] of Object.entries(config.typescriptProjects!)) {
        let p = normalizePath(path);
        if (!p.startsWith('/')) {
            p = normalizeProjectPath(p);
        }
        if (!p.startsWith(workdir)) {
            return clearAndPackResult(`The TypeScript project (name: ${name}) path is out of vscode workspace`);
        }
        if (!(await isFileExistsOnWorkspace(Uri.file(p)))) {
            return clearAndPackResult(`The TypeScript project (name: ${name}) path does not exist: ${path}`);
        }
        config.typescriptProjects![name] = p;
    }

    const error = findOverlapPaths(config.typescriptProjects!);
    if (error) {
        return clearAndPackResult('In "typescriptProjects", ' + error);
    }

    return { ok: config };
}

function validateProjectMapping(config: NgHelperUserConfig): Result<NgHelperUserConfig> {
    const localErrors: string[] = [];

    const ngProjectNames = Array.from(Object.keys(config.angularJsProjects!));
    const tsProjectNames = Array.from(Object.keys(config.typescriptProjects!));
    const ngProjectNamesFromMapping = Array.from(Object.values(config.projectMapping!)).flat();
    const tsProjectNamesFromMapping = Array.from(Object.keys(config.projectMapping!));

    // 检查名字不存在的情况
    const notConfigNgProjectNames = findMissingElements(ngProjectNames, ngProjectNamesFromMapping);
    const notConfigTsProjectNames = findMissingElements(tsProjectNames, tsProjectNamesFromMapping);
    if (notConfigNgProjectNames.length) {
        const namesStr = notConfigNgProjectNames.map((n) => `"${n}"`).join(',');
        localErrors.push(`AngularJS project names: ${namesStr}, they are not configured in "angularJsProjects"`);
    }
    if (notConfigTsProjectNames.length) {
        const namesStr = notConfigTsProjectNames.map((n) => `"${n}"`).join(',');
        localErrors.push(`TypeScript project names: ${namesStr}, they are not configured in "typescriptProjects"`);
    }

    // 检查名字重复使用的情况(注意：ts 的名字在 mapping 中做 key, 不可能重复)
    const duplicateUsedNgProjectNames = findDuplicateStrings(ngProjectNamesFromMapping);
    if (duplicateUsedNgProjectNames.length) {
        const namesStr = duplicateUsedNgProjectNames.map((n) => `"${n}"`).join(',');
        localErrors.push(`Duplicate AngularJS project names: ${namesStr} are not allowed in "projectMapping"`);
    }

    // ts project name 必须都用上，否则配置它没有意义
    const notUsedTsProjectNames = findMissingElements(tsProjectNamesFromMapping, tsProjectNames);
    if (notUsedTsProjectNames.length) {
        const namesStr = notUsedTsProjectNames.map((n) => `"${n}"`).join(',');
        localErrors.push(`Unused TypeScript project names: ${namesStr} are not allowed in "projectMapping"`);
    }

    if (localErrors.length) {
        const clearedConfig = { ...config };
        clearedConfig.projectMapping = undefined;
        return {
            ok: clearedConfig,
            error: localErrors.join(';'),
        };
    }

    return { ok: config };
}

function findMissingElements(sourceArr: string[], targetArr: string[]): string[] {
    return targetArr.filter((item) => !sourceArr.includes(item));
}

function findDuplicateStrings(arr: string[]): string[] {
    const countMap = new Map<string, number>();

    // 统计每个字符串出现的次数
    for (const item of arr) {
        countMap.set(item, (countMap.get(item) || 0) + 1);
    }

    // 过滤出现次数大于1的字符串
    return Array.from(countMap.entries())
        .filter(([_, count]) => count > 1)
        .map(([str]) => str);
}

function findOverlapPaths(projectConfig: Record<string, string>): string | undefined {
    const names: string[] = [];
    const paths: string[] = [];
    for (const [name, path] of Object.entries(projectConfig)) {
        names.push(name);
        paths.push(path);
    }

    for (let i = 0; i < paths.length - 1; i++) {
        for (let j = i + 1; j < paths.length; j++) {
            const p1 = paths[i];
            const p2 = paths[j];
            if (isPathOverlap(p1, p2)) {
                const n1 = names[i];
                const n2 = names[j];
                return `the path of project "${n1}" overlaps the project "${n2}"`;
            }
        }
    }
    return undefined;
}

function isPathOverlap(p1: string, p2: string): boolean {
    const len1 = p1.length;
    const len2 = p2.length;
    if (len1 === len2) {
        return p1 === p2;
    } else if (len1 > len2) {
        return p1.startsWith(p2);
    } else {
        return p2.startsWith(p1);
    }
}

function getDefaultConfig(): NgHelperUserConfig {
    return {
        componentStyleFileExt: 'css',
        componentScriptFileExt: 'js',
        injectionCheckMode: 'count_match',
    };
}
