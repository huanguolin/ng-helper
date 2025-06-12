import type { InjectionCheckMode } from '@ng-helper/shared/lib/plugin';
import { Uri, workspace } from 'vscode';
import z from 'zod';

import { EXT_CONF_PATH } from './constants';
import { getWorkspacePath, isFileExistsOnWorkspace, normalizeFileExt, normalizePath } from './utils';

const ALLOW_SCRIPT_FILE_EXTS = ['js', 'ts'] as const;
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
    // TODO: componentScriptFileExt, injectionCheckMode 可以先定义为 string, 后续
    // 使用严格模式检查，不是要求的值取默认值，并报错。
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

export async function readNgHelperUserConfig(): Promise<NgHelperUserConfig> {
    const uri = getNgHelperUserConfigUri()!;
    const uint8Array = await workspace.fs.readFile(uri);
    const jsonText = new TextDecoder().decode(uint8Array);

    // TODO: error handle
    const { ok: config } = await parseAndValidateUserConfig(jsonText);

    return config!;
}

export function getNgHelperUserConfigUri(): Uri | undefined {
    const rootWorkspaceUri = getWorkspacePath();
    if (!rootWorkspaceUri) {
        return;
    }
    return Uri.joinPath(rootWorkspaceUri, EXT_CONF_PATH);
}

async function parseAndValidateUserConfig(jsonText: string): Promise<Result<NgHelperUserConfig, string[]>> {
    const defaultConfig = getDefaultConfig();

    let config: NgHelperUserConfig;
    try {
        const userConfig = NgHelperUserConfigScheme.parse(jsonText || '{}');
        config = Object.assign(defaultConfig, userConfig);
    } catch (err) {
        return {
            ok: defaultConfig,
            error: [err instanceof Error ? err.message : `${err as string}`],
        };
    }

    if (config.componentStyleFileExt) {
        config.componentStyleFileExt = normalizeFileExt(config.componentStyleFileExt);
    }
    if (config.componentScriptFileExt) {
        config.componentScriptFileExt = normalizeFileExt(config.componentScriptFileExt) as 'js' | 'ts';
    }

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
            error: ['If set "projectMapping" or "typescriptProjects", then "angularJsProjects" is required.'],
        };
    }

    // 从这以后的错误，尽量容忍
    const errors: string[] = [];
    if ((isMappingEmpty && !isTsProjectEmpty) || (!isMappingEmpty && isTsProjectEmpty)) {
        config.typescriptProjects = undefined;
        config.projectMapping = undefined;
        errors.push('Can not set "projectMapping" or "typescriptProjects" without each other.');
    }

    const workdir = getWorkspacePath()!.fsPath;
    const normalizeProjectPath = (p: string) => normalizePath(p + '/' + workdir);

    if (config.angularJsProjects) {
        const clearAndPackResult = (error: string) => {
            config.angularJsProjects = undefined;
            config.typescriptProjects = undefined;
            config.projectMapping = undefined;
            return {
                ok: config,
                error: [...errors, error],
            };
        };

        for (const [name, path] of Object.entries(config.angularJsProjects)) {
            let p = normalizePath(path);
            if (!p.startsWith('/')) {
                p = normalizeProjectPath(p);
            }
            if (!(await isFileExistsOnWorkspace(Uri.file(p)))) {
                return clearAndPackResult(`The angularJs project (name: ${name}) path not exists: ${path}`);
            }
            config.angularJsProjects[name] = p;
        }

        const error = findOverlapPaths(config.angularJsProjects);
        if (error) {
            return clearAndPackResult(error);
        }
    }

    if (config.typescriptProjects) {
        const clearAndPackResult = (error: string) => {
            config.typescriptProjects = undefined;
            config.projectMapping = undefined;
            return {
                ok: config,
                error: [...errors, error],
            };
        };

        for (const [name, path] of Object.entries(config.typescriptProjects)) {
            let p = normalizePath(path);
            if (!p.startsWith('/')) {
                p = normalizeProjectPath(p);
            }
            if (!(await isFileExistsOnWorkspace(Uri.file(p)))) {
                return clearAndPackResult(`The typescript project (name: ${name}) path not exists: ${path}`);
            }
            config.typescriptProjects[name] = p;
        }

        const error = findOverlapPaths(config.typescriptProjects);
        if (error) {
            return clearAndPackResult(error);
        }
    }

    if (config.projectMapping) {
        const localErrors: string[] = [];
        const ngProjectNames = Array.from(Object.keys(config.angularJsProjects!));
        const tsProjectNames = Array.from(Object.keys(config.typescriptProjects!));
        const ngProjectNamesFromMapping = Array.from(Object.values(config.projectMapping)).flat();
        const tsProjectNamesFromMapping = Array.from(Object.keys(config.projectMapping));

        // 名字不存在
        const notConfigNgProjectNames = findMissingElements(ngProjectNames, ngProjectNamesFromMapping);
        const notConfigTsProjectNames = findMissingElements(tsProjectNames, tsProjectNamesFromMapping);
        if (notConfigNgProjectNames.length) {
            localErrors.push(
                `AngularJs project names: ${notConfigNgProjectNames.join(',')}, they are config in "angularJsProjects".`,
            );
        }
        if (notConfigTsProjectNames.length) {
            localErrors.push(
                `Typescript project names: ${notConfigTsProjectNames.join(',')}, they are config in "typescriptProjects".`,
            );
        }

        // 名字重复使用(注意：ts 的名字在 mapping 中做 key, 不可能重复)
        const duplicateUsedNgProjectNames = findDuplicateStrings(ngProjectNamesFromMapping);
        if (duplicateUsedNgProjectNames.length) {
            localErrors.push(
                `Duplicate used angularJs project names: ${notConfigTsProjectNames.join(',')} in "typescriptProjects".`,
            );
        }

        // ts project name 必须都用上，否则配置它没有意义
        const notUsedTsProjectNames = findMissingElements(tsProjectNamesFromMapping, tsProjectNames);
        if (notUsedTsProjectNames.length) {
            localErrors.push(`Not used typescript project names: ${notConfigTsProjectNames.join(',')}.`);
        }

        if (localErrors.length) {
            config.projectMapping = undefined;
            return {
                ok: config,
                error: [...errors, ...localErrors],
            };
        }
    }

    return { ok: config, error: errors };
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
                return `the path of project '${n1}' overlaps the project '${n2}'`;
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
