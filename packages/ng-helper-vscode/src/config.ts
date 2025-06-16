import type { InjectionCheckMode } from '@ng-helper/shared/lib/plugin';
import { Uri, window, workspace } from 'vscode';
import z from 'zod';

import { EXT_CONF_PATH } from './constants';
import { getFileName, getWorkspacePath, isFileExistsOnWorkspace, normalizeFileExt, normalizePath } from './utils';

const ALLOW_SCRIPT_FILE_EXTS = ['js', 'ts', '.js', '.ts'] as const;
const ALLOW_INJECTION_CHECK_MODE = [
    'strict_equal',
    'ignore_case_word_match',
    'count_match',
    'off',
] as const satisfies InjectionCheckMode[];

const NgProjectScheme = z.object({
    /**
     * 名字。
     */
    name: z.string(),
    /**
     * AngularJS 工程的路径，它限定了 NgHelper 的工作范围。
     * 此路径下的 html/js/ts 是让 NgHelper 工作的文件。
     */
    path: z.string(),
    /**
     * AngularJS 工程依赖的 TypeScript 工程路径（一般它的目录有 tsconfig.json 文件）。
     * 如果没有使用 TypeScript, 就不用配置该项目。
     * 使用了 TypeScript 就必须配置，即使路径和 AngularJS 工程一样也要配置。
     *
     * 注意：
     * TypeScript 工程路径可以包含 AngularJS 工程，但 AngularJS 工程不能包含 TypeScript 工程。
     * 两个一样是可以的。
     */
    dependOnTsProjectPath: z.string().optional(),
});

const NgHelperUserConfigScheme = z.object({
    /**
     * Like 'less', 'scss', 'css', etc. Default is 'css'.
     */
    componentStyleFileExt: z.string().optional(),
    /**
     * 'js' or 'ts'. Default is 'js'.
     */
    componentScriptFileExt: z.enum(ALLOW_SCRIPT_FILE_EXTS).optional(),
    /**
     * Default is 'count_match'.
     */
    injectionCheckMode: z.enum(ALLOW_INJECTION_CHECK_MODE).optional(),
    /**
     * 没有配置的话，会自动判断，但有的情况会匹配错误。
     */
    ngProjects: z.array(NgProjectScheme).optional(),
});

export type NgProjectConfig = z.infer<typeof NgProjectScheme>;
export type NgHelperUserConfig = z.infer<typeof NgHelperUserConfigScheme>;

type Result<T> = {
    ok: T;
    error?: string;
};

export class NgHelperConfig {
    constructor(
        public userConfig: NgHelperUserConfig,
        public port: number,
    ) {}

    get hasProjectConfig(): boolean {
        return !!this.userConfig.ngProjects;
    }

    getNgProject(absolutePilePath: string): NgProjectConfig | undefined {
        return this.userConfig.ngProjects?.find((c) => absolutePilePath.startsWith(c.path));
    }

    getNgProjectByTsProjectPath(absolutePilePath: string): NgProjectConfig | undefined {
        return this.userConfig.ngProjects?.find((c) => c.dependOnTsProjectPath === absolutePilePath);
    }

    isNgProjectFile(absolutePilePath: string): boolean {
        const fileName = getFileName(absolutePilePath);

        // 文件名以点开头的文件，往往是配置文件（如: .eslintrc.js），排除掉
        if (fileName.startsWith('.')) {
            return false;
        }

        // 该插件只关心 html/js/ts 文件
        if (!fileName.endsWith('.html') && !fileName.endsWith('.js') && !fileName.endsWith('.ts')) {
            return false;
        }

        if (!this.hasProjectConfig) {
            return true;
        }

        return !!this.getNgProject(absolutePilePath);
    }
}

export async function readUserConfig(): Promise<NgHelperUserConfig> {
    const uri = getUserConfigFileUri()!;
    const uint8Array = await workspace.fs.readFile(uri);
    const jsonText = new TextDecoder().decode(uint8Array);

    const { ok: config, error } = await parseUserConfig(jsonText);
    if (error) {
        // 不等待，避免阻塞插件启动进程
        void showUserConfigErrors(error);
    }

    return config;
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
        `The ng-helper configuration is invalid. Please check the error: ${error}`,
        'OK',
    );
    if (selection === 'OK') {
        // 打开配置文件。
        const document = await workspace.openTextDocument(getUserConfigFileUri()!);
        await window.showTextDocument(document);
    }
}

async function parseUserConfig(jsonText: string): Promise<Result<NgHelperUserConfig>> {
    const defaultConfig = getDefaultConfig();

    let config: NgHelperUserConfig;
    try {
        const userConfig = NgHelperUserConfigScheme.parse(JSON.parse(jsonText || '{}'));
        config = Object.assign(defaultConfig, userConfig);
    } catch (err) {
        return {
            ok: defaultConfig,
            error: `Failed to parse user config: ${err instanceof Error ? err.message : `${err as string}`}`,
        };
    }

    // 标准化文件扩展名
    if (config.componentStyleFileExt) {
        config.componentStyleFileExt = normalizeFileExt(config.componentStyleFileExt);
    }
    if (config.componentScriptFileExt) {
        config.componentScriptFileExt = normalizeFileExt(config.componentScriptFileExt) as 'js' | 'ts';
    }

    const errors: string[] = [];
    if (config.ngProjects) {
        const { ok, error } = await validateAndNormalizeNgProjects(config.ngProjects);
        config.ngProjects = ok;
        if (error) {
            errors.push(error);
        }
    }

    return { ok: config, error: errors.join(';') };
}

async function validateAndNormalizeNgProjects(
    ngProjects: NgProjectConfig[],
): Promise<Result<NgProjectConfig[] | undefined>> {
    const errors: string[] = [];

    const duplicatedName = findDuplicated(ngProjects.map((c) => c.name));
    if (duplicatedName) {
        errors.push(`Duplicate project name: "${duplicatedName}"`);
    }

    const newNgProjects: NgProjectConfig[] = [];
    const newNgProjectIndexList: number[] = [];
    for (let i = 0; i < ngProjects.length; i++) {
        const ngProject = ngProjects[i];
        const { ok: newNgProject, error } = await validateAndNormalizeNgProject(ngProject);
        if (error) {
            errors.push(error);
        }
        if (newNgProject) {
            newNgProjects.push(newNgProject);
            newNgProjectIndexList.push(i);
        }
    }

    const ngProjectOverlap = findOverlapPaths(newNgProjects.map((c) => c.path));
    if (ngProjectOverlap) {
        const [i, j] = ngProjectOverlap;
        const p1 = ngProjects[i];
        const p2 = ngProjects[j];
        errors.push(`The AngularJS project "${p1.name}" path overlaps with the AngularJS project "${p2.name}" path`);
    }

    const tsProjectOverlap = findOverlapPaths(newNgProjects.map((c) => c.dependOnTsProjectPath!));
    if (tsProjectOverlap) {
        const [i, j] = tsProjectOverlap;
        const p1 = ngProjects[i];
        const p2 = ngProjects[j];
        errors.push(`The TypeScript project "${p1.name}" path overlaps with the TypeScript project "${p2.name}" path`);
    }

    // 这个有错误，一整个都不能使用了，直接退回自动匹配
    return { ok: errors.length ? undefined : newNgProjects, error: errors.join(';') };
}

async function validateAndNormalizeNgProject(ngProject: NgProjectConfig): Promise<Result<NgProjectConfig | undefined>> {
    const workspaceDir = getWorkspacePath()!.fsPath;
    const normalizeProjectPath = (p: string) =>
        p.startsWith('/') ? normalizePath(p) : normalizePath(workspaceDir + '/' + p);

    const config = { ...ngProject };

    // normalize path
    config.path = normalizeProjectPath(config.path);

    // exists or not
    if (!(await isFileExistsOnWorkspace(Uri.file(config.path)))) {
        // 注意：报错使用的信息要用用户输入的原始信息
        return { ok: undefined, error: `The AngularJS project path does not exist: ${ngProject.path}` };
    }

    if (!config.dependOnTsProjectPath) {
        // 没有配置则默认取 vscode workspace 文件夹。
        config.dependOnTsProjectPath = workspaceDir;
    } else {
        config.dependOnTsProjectPath = normalizeProjectPath(config.dependOnTsProjectPath);

        if (!(await isFileExistsOnWorkspace(Uri.file(config.dependOnTsProjectPath)))) {
            // 注意：报错使用的信息要用用户输入的原始信息
            return {
                ok: undefined,
                error: `The TypeScript project path does not exist: ${ngProject.dependOnTsProjectPath}`,
            };
        }

        // TypeScript 工程路径可以包含 AngularJS 工程，但 AngularJS 工程不能包含 TypeScript 工程。
        // 两个一样是可以的。
        if (config.dependOnTsProjectPath !== config.path && config.dependOnTsProjectPath.startsWith(config.path)) {
            // 注意：报错使用的信息要用用户输入的原始信息
            return {
                ok: undefined,
                error: `The AngularJS project path (${ngProject.path}) cannot contain the TypeScript project path (${ngProject.dependOnTsProjectPath})`,
            };
        }
    }

    return { ok: config };
}

function findDuplicated(list: string[]): string | undefined {
    const set = new Set<string>();
    for (const e of list) {
        if (set.has(e)) {
            return e;
        } else {
            set.add(e);
        }
    }
    return undefined;
}

function findOverlapPaths(paths: string[]): [number, number] | undefined {
    for (let i = 0; i < paths.length - 1; i++) {
        for (let j = i + 1; j < paths.length; j++) {
            const p1 = paths[i];
            const p2 = paths[j];
            if (isPathOverlap(p1, p2)) {
                return [i, j];
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
