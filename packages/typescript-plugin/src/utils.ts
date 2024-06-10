export function isNgHelperTsPluginCmd(obj: unknown): boolean {
    if (typeof obj !== 'object') {
        return false;
    }

    const o = obj as Record<string, string>;
    return o.id === '@ng-helper/typescript-plugin';
}

