import type { CursorAtAttrNameInfo } from '@ng-helper/shared/lib/cursorAt';
import { CompletionItem, SnippetString } from 'vscode';

import type { BuiltinFilterNames } from '../utils';

import type { CompletionParamObj } from '.';

interface BuiltinConfig {
    name: string;
    description?: string;
    snippet?: string;
}

interface BuiltinFilerConfig extends BuiltinConfig {
    name: BuiltinFilterNames;
}

const defaultNgConfigExpr: BuiltinConfig = {
    name: '',
    snippet: `\${0:expression}`,
};
const defaultNgConfigStr: BuiltinConfig = {
    name: '',
    snippet: `\${0:string}`,
};

export function builtinDirectiveNameCompletion({
    context,
    noRegisterTriggerChar,
}: CompletionParamObj<CursorAtAttrNameInfo>): CompletionItem[] | undefined {
    // 只走没有设置触发字符的那个分支。
    if (noRegisterTriggerChar && typeof context.triggerCharacter === 'undefined') {
        return getNgDirectiveConfigList()
            .map(([name, configs]) =>
                configs.length > 0
                    ? configs.map((c) => directiveConfigToCompletionItem(name, c))
                    : [directiveConfigToCompletionItem(name, defaultNgConfigExpr)],
            )
            .flat()
            .map((item, index) => {
                item.sortText = index.toString().padStart(3, '0');
                return item;
            });
    }
}

function directiveConfigToCompletionItem(name: string, config: BuiltinConfig): CompletionItem {
    const item = new CompletionItem(`${name} ${config.name}`);
    if (config.snippet) {
        item.insertText = new SnippetString(`${name}="${config.snippet}"`);
    }
    item.detail = config.description;
    return item;
}

function getNgDirectiveConfigList(): Array<[string, BuiltinConfig[]]> {
    // 这里依据我们使用的频率排序的
    return [
        ['ng-click', []],
        ['ng-if', []],
        ['ng-model', []],
        [
            'ng-class',
            [
                {
                    name: 'map',
                    snippet: `{'\${1:class-name}': \${0:expression}}`,
                },
                {
                    name: 'array',
                    snippet: `[\${0:classNameVar}]`,
                },
                {
                    name: '',
                    snippet: `\${0:classNamesVar}`,
                },
            ],
        ],
        ['ng-disabled', []],
        ['ng-show', []],
        [
            'ng-repeat',
            [
                {
                    name: 'array',
                    snippet: `\${0:item} in \${1:items} track by \${2:\\$index}`,
                },
                {
                    name: 'object',
                    snippet: `(\${2:key}, \${0:value}) in \${1:myObject}`,
                },
            ],
        ],
        ['ng-init', []],
        ['ng-controller', []],
        [
            'ng-options',
            [
                {
                    name: '',
                    snippet: `\${3:item.name} for \${2:item} in \${1:items} track by \${0:item.id}`,
                },
            ],
        ],
        ['ng-change', []],
        [
            'ng-pattern',
            [
                {
                    name: '',
                    snippet: `/\${0}/`,
                },
            ],
        ],
        ['ng-bind', []],
        ['ng-required', []],
        ['ng-maxlength', []],
        ['ng-hide', []],
        ['ng-style', []],
        ['ng-dblclick', []],
        ['ng-submit', []],
        ['ng-src', [defaultNgConfigStr]],
        ['ng-href', [defaultNgConfigStr]],
        ['ng-checked', []],
        ['ng-include', [defaultNgConfigStr]],
        ['ng-cloak', [{ name: '' }]],
        ['ng-transclude', [defaultNgConfigStr]],
        ['ng-app', [{ name: '', snippet: 'angular.Module' }]],
        ['ng-value', [defaultNgConfigStr]],
        ['ng-blur', []],
        ['ng-keypress', []],
        ['ng-selected', []],
        ['ng-readonly', []],
        ['ng-keydown', []],
        ['ng-form', [defaultNgConfigStr]],
        ['ng-mouseover', []],
        ['ng-mouseleave', []],
        ['ng-mouseenter', []],
    ];
}

export function builtinFilterNameCompletion(): CompletionItem[] {
    return getBuiltinFilterConfigList().map(filterConfigToCompletionItem);
}

function filterConfigToCompletionItem(config: BuiltinConfig): CompletionItem {
    const item = new CompletionItem(`${config.name}`);
    if (config.name) {
        item.insertText = new SnippetString(config.snippet);
    }
    item.detail = config.description;
    return item;
}

function getBuiltinFilterConfigList(): BuiltinFilerConfig[] {
    return [
        { name: 'currency', description: 'Formats a number as a currency (ie $1,234.56).' },
        { name: 'date', description: 'Formats date to a string based on the requested format.' },
        {
            name: 'filter',
            description: 'Selects a subset of items from array and returns it as a new array.',
            snippet: 'filter :${0:expression}',
        },
        { name: 'json', description: 'Convert a JavaScript object into JSON string.' },
        {
            name: 'limitTo',
            description: 'Creates a new array or string containing only a specified number of elements. ',
            snippet: 'limitTo :${0:limit}',
        },
        { name: 'lowercase', description: 'Converts string to lowercase.' },
        { name: 'uppercase', description: 'Converts string to uppercase.' },
        { name: 'orderBy', description: 'Orders an array by an expression.', snippet: 'orderBy :${0:expression}' },
        { name: 'number', description: 'Formats a number as text.' },
        { name: 'translate', description: 'Translates a given token into the selected language.' },
    ];
}
