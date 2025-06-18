import { isHtmlTagName } from './html';

export function isComponentTagName(name: string): boolean {
    return name.includes('-') || !isHtmlTagName(name);
}

export function isNgBuiltinDirective(attrName: string): boolean {
    return attrName.startsWith('ng-');
}

export function isNgUserCustomAttr(attrName: string): boolean {
    return (
        !isNgBuiltinDirective(attrName) &&
        attrName.includes('-') &&
        !attrName.startsWith('data-') &&
        attrName !== 'accept-charset'
    );
}
