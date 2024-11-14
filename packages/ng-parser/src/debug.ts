/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { AnyFunction } from './types';

export class Debug {
    static assert(expression: unknown, message?: string, stackCrawlMark?: AnyFunction) {
        if (!expression) {
            message = message ? `False expression: ${message}` : 'False expression.';
            Debug.fail(message, stackCrawlMark || Debug.assert);
        }
    }

    static assertEqual<T>(a: T, b: T, msg?: string, msg2?: string, stackCrawlMark?: AnyFunction): void {
        if (a !== b) {
            const message = msg ? (msg2 ? `${msg} ${msg2}` : msg) : '';
            Debug.fail(`Expected ${a} === ${b}. ${message}`, stackCrawlMark || Debug.assertEqual);
        }
    }

    static fail(message?: string, stackCrawlMark?: AnyFunction): never {
        // eslint-disable-next-line no-debugger
        debugger;
        const e = new Error(message ? `Debug Failure. ${message}` : 'Debug Failure.');
        if ((Error as any).captureStackTrace) {
            (Error as any).captureStackTrace(e, stackCrawlMark || Debug.fail);
        }
        throw e;
    }
}
