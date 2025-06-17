import type { Location as NgLocation } from '@ng-helper/ng-parser/src/types';

import type { DocumentFragment } from './html';

export interface NgDiagnostic extends NgLocation {
    message: string;
}

export interface NgComponentOrDirectiveAttrInfo {
    name: string;
    type: 'component' | 'directive';
    stringAttrs: string[];
    nonStringAttrs: string[];
}

export function getNgDiagnostic(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    htmlAst: DocumentFragment,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    componentOrDirectiveAttrInfos: NgComponentOrDirectiveAttrInfo[],
): NgDiagnostic[] {
    const diagnostics: NgDiagnostic[] = [];

    // TODO: 诊断

    return diagnostics;
}
