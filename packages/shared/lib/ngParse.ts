import { ngParse as OriginalNgParse } from '@ng-helper/ng-parser';
import { type NgAttrName, type ProgramResult, type Programs } from '@ng-helper/ng-parser/src/types';

import { LRUCache } from './lruCache';

const cache = new LRUCache<string, Programs>(100);

export function ngParse<T extends NgAttrName>(ngExprStr: string, attrName?: T): ProgramResult<T> {
    const cacheKey = `${ngExprStr}-${attrName ?? ''}`;
    let program = cache.get(cacheKey);
    if (!program) {
        program = OriginalNgParse(ngExprStr, attrName);
        cache.put(cacheKey, program);
    }

    return program as ProgramResult<T>;
}
