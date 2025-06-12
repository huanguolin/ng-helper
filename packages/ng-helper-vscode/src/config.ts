import type { InjectionCheckMode } from '@ng-helper/shared/lib/plugin';
import { Uri, workspace } from 'vscode';

import { EXT_CONF_PATH } from './constants';
import { getWorkspacePath, normalizeFileExt } from './utils';

export interface NgHelperUserConfig {
    /**
     * like 'less', 'scss', 'css' etc, default is 'css';
     */
    componentStyleFileExt: string;
    /**
     * 'js' or 'ts', default is 'js';
     */
    componentScriptFileExt: string;
    injectionCheckMode: InjectionCheckMode;
    /**
     * AngularJS projects configuration with their paths (optional)
     * Key: project name, Value: project path
     */
    angularJsProjects?: Record<string, string>;
    /**
     * TypeScript projects configuration with their paths (optional)
     * Key: project name, Value: project path
     */
    typescriptProjects?: Record<string, string>;
    /**
     * Mapping between TypeScript and AngularJS projects (optional)
     * Key: TypeScript project name, Value: Array of AngularJS project names
     * If not provided, the extension will auto mapping.
     */
    projectMapping?: Record<string, string[]>;
}

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

    let config = getDefaultConfig();
    const userConfig = JSON.parse(jsonText || '{}') as NgHelperUserConfig;
    config = Object.assign(config, userConfig);

    // TODO：校验 config，如果有问题提醒用户

    return normalizeConfig(config);
}

export function getNgHelperUserConfigUri(): Uri | undefined {
    const rootWorkspaceUri = getWorkspacePath();
    if (!rootWorkspaceUri) {
        return;
    }
    return Uri.joinPath(rootWorkspaceUri, EXT_CONF_PATH);
}

function getDefaultConfig(): NgHelperUserConfig {
    return {
        componentStyleFileExt: 'css',
        componentScriptFileExt: 'js',
        injectionCheckMode: 'count_match',
    };
}

function normalizeConfig(config: NgHelperUserConfig): NgHelperUserConfig {
    return {
        componentStyleFileExt: normalizeFileExt(config.componentStyleFileExt),
        componentScriptFileExt: normalizeFileExt(config.componentScriptFileExt),
        injectionCheckMode: config.injectionCheckMode,
        angularJsProjects: config.angularJsProjects,
        typescriptProjects: config.typescriptProjects,
        projectMapping: config.projectMapping,
    };
}
