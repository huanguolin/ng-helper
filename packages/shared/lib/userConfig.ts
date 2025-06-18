import { z } from 'zod';

import type { InjectionCheckMode } from './plugin';

const ALLOW_SCRIPT_FILE_EXTS = ['js', 'ts', '.js', '.ts'] as const;
const ALLOW_INJECTION_CHECK_MODE = [
    'strict_equal',
    'ignore_case_word_match',
    'count_match',
    'off',
] as const satisfies InjectionCheckMode[];

export const NgProjectScheme = z.object({
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

export const NgHelperUserConfigScheme = z.object({
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
