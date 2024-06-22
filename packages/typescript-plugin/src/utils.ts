export function isNgHelperTsPluginCmd(obj: any): boolean {
    if (!obj
        || typeof obj !== 'object'
        || !obj.triggerCharacter
        || typeof obj.triggerCharacter !== 'object') {
        return false;
    }

    const o = obj as Record<string, string>;
    return o.id === '@ng-helper/typescript-plugin';
}

