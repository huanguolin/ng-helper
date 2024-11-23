import {
    getCursorAtInfo,
    type CursorAtAttrNameInfo,
    type CursorAtAttrValueInfo,
    type CursorAtTagNameInfo,
    type CursorAtTemplateInfo,
} from '@ng-helper/shared/lib/cursorAt';
import { NgHoverInfo, type NgCtrlInfo, type NgElementHoverInfo } from '@ng-helper/shared/lib/plugin';
import { camelCase } from 'change-case';
import { ExtensionContext, Hover, languages, MarkdownString, TextDocument, Position, CancellationToken } from 'vscode';

import { timeCost } from '../../debug';
import {
    getComponentNameOrAttrNameHoverApi,
    getComponentTypeHoverApi,
    getControllerTypeHoverApi,
    getDirectiveHoverApi,
    getFilterNameHoverApi,
} from '../../service/api';
import { buildCursor } from '../../utils';
import {
    checkServiceAndGetScriptFilePath,
    getControllerNameInfo,
    isBuiltinFilter,
    isComponentHtml,
    isComponentTagName,
    isHoverValidIdentifierChar,
    isNgBuiltinDirective,
    toNgElementHoverInfo,
    type BuiltinFilterNames,
} from '../utils';

import { onTypeHover } from './utils';

export function registerHover(context: ExtensionContext, port: number): void {
    context.subscriptions.push(
        languages.registerHoverProvider('html', {
            async provideHover(document: TextDocument, position: Position, token: CancellationToken) {
                return timeCost('provideHover', async () => {
                    const cursorAtInfo = getCursorAtInfo(document.getText(), buildCursor(document, position));
                    switch (cursorAtInfo.type) {
                        case 'endTag':
                        case 'startTag':
                        case 'text':
                            // do nothing
                            return;
                        case 'attrName':
                            if (isNgBuiltinDirective(cursorAtInfo.cursorAtAttrName)) {
                                return handleBuiltinDirective(cursorAtInfo.cursorAtAttrName);
                            }
                            return handleTagNameOrAttrName(cursorAtInfo, document, port, token);
                        case 'tagName':
                            return handleTagNameOrAttrName(cursorAtInfo, document, port, token);
                        case 'attrValue':
                        case 'template':
                            return handleTemplateOrAttrValue(document, position, port, token, cursorAtInfo);
                    }
                });
            },
        }),
    );
}

async function handleTagNameOrAttrName(
    cursorAtInfo: CursorAtTagNameInfo | CursorAtAttrNameInfo,
    document: TextDocument,
    port: number,
    token: CancellationToken,
): Promise<Hover | undefined> {
    if (isComponentTagName(cursorAtInfo.tagName) || cursorAtInfo.attrNames.length) {
        const scriptFilePath = await checkServiceAndGetScriptFilePath(document, port);
        if (!scriptFilePath) {
            return;
        }
        const fn = isComponentTagName(cursorAtInfo.tagName) ? getComponentHover : getDirectiveHover;
        return await fn(scriptFilePath, toNgElementHoverInfo(cursorAtInfo), port, token);
    }
    return undefined;
}

function handleBuiltinDirective(cursorAtAttrName: string): Hover | undefined {
    const ngAttrName = camelCase(cursorAtAttrName);
    return buildHoverResult({
        formattedTypeString: `(directive) ${ngAttrName}`,
        document: `Angular.js built-in directive, see [document](https://docs.angularjs.org/api/ng/directive/${ngAttrName}).`,
    });
}

async function handleTemplateOrAttrValue(
    document: TextDocument,
    position: Position,
    port: number,
    token: CancellationToken,
    cursorAtInfo: CursorAtAttrValueInfo | CursorAtTemplateInfo,
): Promise<Hover | undefined> {
    if (!isHoverValidIdentifierChar(document, position)) {
        return;
    }
    if (isComponentHtml(document)) {
        return handleComponentType(document, cursorAtInfo, port, token);
    }
    const ctrlInfo = getControllerNameInfo(cursorAtInfo.context);
    if (ctrlInfo && ctrlInfo.controllerAs) {
        return handleControllerType(ctrlInfo, document, cursorAtInfo, port, token);
    }
}

async function getComponentHover(
    scriptFilePath: string,
    hoverInfo: NgElementHoverInfo,
    port: number,
    token: CancellationToken,
): Promise<Hover | undefined> {
    hoverInfo.attrNames = []; // component query currently doesn't need all attribute names
    const res = await getComponentNameOrAttrNameHoverApi({
        port,
        vscodeCancelToken: token,
        info: { fileName: scriptFilePath, hoverInfo: hoverInfo },
    });
    return buildHoverResult(res);
}

async function getDirectiveHover(
    scriptFilePath: string,
    hoverInfo: NgElementHoverInfo,
    port: number,
    token: CancellationToken,
): Promise<Hover | undefined> {
    const cursorAtAttrName = hoverInfo.name;
    const res = await getDirectiveHoverApi({
        port,
        vscodeCancelToken: token,
        info: { fileName: scriptFilePath, attrNames: hoverInfo.attrNames, cursorAtAttrName },
    });
    return buildHoverResult(res);
}

async function handleComponentType(
    document: TextDocument,
    cursorAtInfo: CursorAtAttrValueInfo | CursorAtTemplateInfo,
    port: number,
    vscodeCancelToken: CancellationToken,
): Promise<Hover | undefined> {
    const info = await onTypeHover({
        document,
        cursorAtInfo,
        port,
        onHoverFilterName: (filterName, scriptFilePath) =>
            handleFilterName({
                port,
                vscodeCancelToken,
                filterName,
                scriptFilePath,
            }),
        onHoverType: (scriptFilePath, contextString, cursorAt) =>
            getComponentTypeHoverApi({
                port,
                vscodeCancelToken,
                info: { fileName: scriptFilePath, contextString, cursorAt },
            }),
    });
    return buildHoverResult(info);
}

async function handleFilterName({
    filterName,
    scriptFilePath,
    port,
    vscodeCancelToken,
}: {
    filterName: string;
    scriptFilePath?: string;
    port: number;
    vscodeCancelToken: CancellationToken;
}): Promise<NgHoverInfo | undefined> {
    if (isBuiltinFilter(filterName)) {
        return genBuiltinFilterHoverInfo(filterName);
    } else if (scriptFilePath) {
        return await getFilterNameHoverApi({
            port,
            vscodeCancelToken,
            info: { fileName: scriptFilePath, contextString: filterName, cursorAt: 0 },
        });
    }
}

async function handleControllerType(
    ctrlInfo: NgCtrlInfo,
    document: TextDocument,
    cursorAtInfo: CursorAtAttrValueInfo | CursorAtTemplateInfo,
    port: number,
    vscodeCancelToken: CancellationToken,
): Promise<Hover | undefined> {
    const info = await onTypeHover({
        document,
        cursorAtInfo,
        port,
        onHoverFilterName: (filterName, scriptFilePath) =>
            handleFilterName({
                port,
                vscodeCancelToken,
                filterName,
                scriptFilePath,
            }),
        onHoverType: (scriptFilePath, contextString, cursorAt) =>
            getControllerTypeHoverApi({
                port,
                vscodeCancelToken: vscodeCancelToken,
                info: { fileName: scriptFilePath, contextString, cursorAt, ...ctrlInfo },
            }),
    });
    return buildHoverResult(info);
}

function buildHoverResult(res: NgHoverInfo | undefined): Hover | undefined {
    if (!res) {
        return;
    }
    const markdownStr = new MarkdownString();
    markdownStr.appendCodeblock(res.formattedTypeString, 'typescript');
    if (res.document) {
        markdownStr.appendMarkdown(res.document);
    }
    return new Hover(markdownStr);
}

const mdNewLine = '  \n';
const builtinFilterConfig: Record<BuiltinFilterNames, { declare: string; mdLines: string[] }> = {
    currency: {
        declare: 'currency(input: number, symbol?: string, fractionSize?: number): string',
        mdLines: [
            'Formats a number as a currency (ie $1,234.56). When no currency symbol is provided, default symbol for current locale is used.',
            mdNewLine,
            '*@param* `input` Input to filter.',
            '*@param* `symbol` Currency symbol or identifier to be displayed.',
            '*@param* `fractionSize` Number of decimal places to round the amount to, defaults to default max fraction size for current locale.',
        ],
    },
    date: {
        declare: 'date(input: Date|number|string, format?: string, timezone?: string): string',
        mdLines: [
            'Formats date to a string based on the requested format.',
            mdNewLine,
            '* `short`: equivalent to `M/d/yy h:mm a` for en_US locale (e.g. `9/3/10 12:05 PM`)',
            '* `fullDate`: equivalent to `EEEE, MMMM d, y` for en_US locale (e.g. `Friday, September 3, 2010`)',
            '* `longDate`: equivalent to `MMMM d, y` for en_US locale (e.g. `September 3, 2010`)',
            '* `mediumDate`: equivalent to `MMM d, y` for en_US locale (e.g. `Sep 3, 2010`)',
            '* `shortDate`: equivalent to `M/d/yy` for en_US locale (e.g. `9/3/10`)',
            '* `mediumTime`: equivalent to `h:mm:ss a` for en_US locale (e.g. `12:05:08 PM`)',
            '* `shortTime`: equivalent to `h:mm a` for en_US locale (e.g. `12:05 PM`)',
            '[see more](https://docs.angularjs.org/api/ng/filter/date).',
            mdNewLine,
            mdNewLine,
            '*@param* `input` Input to filter. Date to format either as Date object, milliseconds (`string` or `number`) or various ISO 8601 datetime string formats (e.g. `yyyy-MM-ddTHH:mm:ss.sssZ` and its shorter versions like `yyyy-MM-ddTHH:mmZ`, `yyyy-MM-dd` or `yyyyMMddTHHmmssZ`). If no timezone is specified in the string input, the time is considered to be in the local timezone.',
            '*@param* `format` Formatting rules (see Description). If not specified, `mediumDate` is used.',
            '*@param* `timezone` Timezone to be used for formatting. It understands UTC/GMT and the continental US time zone abbreviations, but for general use, use a time zone offset, for example, `+0430` (4 hours, 30 minutes east of the Greenwich meridian) If not specified, the timezone of the browser will be used.',
        ],
    },
    filter: {
        declare:
            'filter(input: Array, expression: string|Object|function, comparator?: true|false|(actual, expected) => boolean, anyPropertyKey?: string): Array',
        mdLines: [
            'Selects a subset of items from array and returns it as a new array.',
            mdNewLine,
            '*@param* `input` The source array. `Note: If the array contains objects that reference themselves, filtering is not possible.`',
            '*@param* `expression` The predicate to be used for selecting items from array([see more](https://docs.angularjs.org/api/ng/filter/filter)).',
            '*@param* `comparator` Comparator which is used in determining if values retrieved using expression (when it is not a function) should be considered a match based on the expected value (from the filter expression) and actual value (from the object in the array)([see more](https://docs.angularjs.org/api/ng/filter/filter)).',
            '*@param* `anyPropertyKey` The special property name that matches against any property. By default $.',
        ],
    },
    json: {
        declare: 'json(input: any, spacing?: number): string',
        mdLines: [
            'Allows you to convert a JavaScript object into JSON string.',
            'This filter is mostly useful for debugging. When using the double curly notation the binding is automatically converted to JSON.',
            mdNewLine,
            '*@param* `input` Any JavaScript object (including arrays and primitive types) to filter.',
            '*@param* `spacing` The number of spaces to use per indentation, defaults to 2.',
        ],
    },
    limitTo: {
        declare:
            'limitTo(input: Array|ArrayLike|string|number, limit: string|number, begin?: string|number): Array|string',
        mdLines: [
            'Creates a new array or string containing only a specified number of elements. The elements are taken from either the beginning or the end of the source array, string or number, as specified by the value and sign (positive or negative) of `limit`. Other array-like objects are also supported (e.g. array subclasses, NodeLists, jqLite/jQuery collections etc). If a number is used as input, it is converted to a string.',
            mdNewLine,
            '*@param* `input` Array/array-like, string or number to be limited.',
            '*@param* `limit` The length of the returned array or string([see more](https://docs.angularjs.org/api/ng/filter/limitTo)).',
            '*@param* `begin` Index at which to begin limitation. As a negative index, `begin` indicates an offset from the end of `input`. Defaults to `0`.',
        ],
    },
    lowercase: {
        declare: 'lowercase(input: string): string',
        mdLines: ['Converts string to lowercase.', mdNewLine, '*@param* `input` Input string.'],
    },
    uppercase: {
        declare: 'uppercase(input: string): string',
        mdLines: ['Converts string to uppercase.', mdNewLine, '*@param* `input` Input string.'],
    },
    number: {
        declare: 'number(input: number|string, fractionSize?: string|number): string',
        mdLines: [
            'Formats a number as text.',
            'If the input is null or undefined, it will just be returned. If the input is infinite (Infinity or -Infinity), the Infinity symbol `∞` or `-∞` is returned, respectively. If the input is not a number an empty string is returned.',
            mdNewLine,
            '*@param* `input` Number to format.',
            "*@param* `fractionSize` Number of decimal places to round the number to. If this is not provided then the fraction size is computed from the current locale's number formatting pattern. In the case of the default locale, it will be 3.",
        ],
    },
    orderBy: {
        declare:
            'orderBy(input: Array, expression: string|function|Array, reverse?: boolean, comparator?: function): Array',
        mdLines: [
            'Orders an array by an expression([see more](https://docs.angularjs.org/api/ng/filter/orderBy)).',
            mdNewLine,
            '*@param* `input` The collection (array or array-like object) to sort.',
            '*@param* `expression` A predicate (or list of predicates) to be used by the comparator to determine the order of elements([see more](https://docs.angularjs.org/api/ng/filter/orderBy)).',
            '*@param* `reverse` If `true`, reverse the sorting order.',
            '*@param* `comparator` The comparator function used to determine the relative order of value pairs. If omitted, the built-in comparator will be used.',
        ],
    },
    translate: {
        declare:
            'translate(input: string, interpolateParams?: Object, interpolationId?: string, forceLanguage?: string, sanitizeStrategy?: string): string',
        mdLines: [
            'Translates a given token into the selected language.',
            mdNewLine,
            '*@param* `input` A translation id to be translated.',
            '*@param* `interpolateParams` An object hash for dynamic value interpolation.',
            '*@param* `interpolationId` The id of the interpolation algorithm to use.',
            '*@param* `forceLanguage` Ignore the current language and force a language-specific translation.',
            '*@param* `sanitizeStrategy` Specify a policy to clean up translated content to prevent cross-site scripting attacks.',
        ],
    },
};
function genBuiltinFilterHoverInfo(filterName: string): NgHoverInfo {
    const { declare, mdLines } = builtinFilterConfig[filterName as BuiltinFilterNames];
    return {
        formattedTypeString: `(filter [builtin]) ${declare}`,
        document: mdLines.join(mdNewLine + mdNewLine),
    };
}
