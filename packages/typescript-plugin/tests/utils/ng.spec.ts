import type { DirectiveInfo, NgTypeInfo, Property } from '@ng-helper/shared/lib/plugin';
import type ts from 'typescript';

import { PluginContext } from '../../src/type';
import {
    isAttributeDirective,
    isDtsFile,
    isElementDirective,
    removeBindingControlChars,
    getBindingName,
    isOptionalBinding,
    isEventBinding,
    isStringBinding,
    getBindingType,
    getBindingTypeInfo,
    isAngularModuleNode,
    isAngularComponentRegisterNode,
    isAngularDirectiveRegisterNode,
    isAngularControllerRegisterNode,
    isAngularServiceRegisterNode,
    isAngularFilterRegisterNode,
    isAngularFactoryRegisterNode,
    isAngularProviderRegisterNode,
    isAngularRunNode,
    isAngularConfigNode,
    getAngularDefineFunctionExpression,
    isAngularConstantRegisterNode,
} from '../../src/utils/ng';
import { prepareTestContext } from '../helper';

describe('isAttributeDirective()', () => {
    it.each([
        ['A', true],
        ['AE', true],
        ['E', false],
        ['', false],
    ])('should return %s for directives with "%s" in restrict', (restrict, expected) => {
        const directiveInfo = buildDirectiveInfo(restrict);
        expect(isAttributeDirective(directiveInfo)).toBe(expected);
    });
});

describe('isDtsFile()', () => {
    it.each([
        ['file.d.ts', true],
        ['file.ts', false],
        ['file.js', false],
        ['file.d.ts.map', false],
        ['file.d.tsx', false],
        ['file.ts.d.ts', true],
        ['path/to/file.d.ts', true],
        ['path/to/file.ts', false],
    ])('should return %s for filename "%s"', (fileName, expected) => {
        expect(isDtsFile(fileName)).toBe(expected);
    });
});

describe('isElementDirective()', () => {
    it.each([
        ['E', true],
        ['EA', true],
        ['A', false],
        ['C', false],
        ['', false],
    ])('should return %s for directives with "%s" in restrict', (restrict, expected) => {
        const directiveInfo = buildDirectiveInfo(restrict);
        expect(isElementDirective(directiveInfo)).toBe(expected);
    });
});

describe('removeBindingControlChars()', () => {
    it.each([
        ['@binding', 'binding'],
        ['=binding', 'binding'],
        ['<binding', 'binding'],
        ['&binding', 'binding'],
        ['<?binding', 'binding'],
        ['normalBinding', 'normalBinding'],
    ])('should return "%s" for input "%s"', (input, expected) => {
        expect(removeBindingControlChars(input)).toBe(expected);
    });
});

describe('getBindingName()', () => {
    it.each([
        [createProperty('prop', '@binding'), 'binding'],
        [createProperty('prop', '=value'), 'value'],
        [createProperty('prop', '<'), 'prop'],
        [createProperty('onClick', '&'), 'onClick'],
    ])('should return "%s" for input %j', (input, expected) => {
        expect(getBindingName(input)).toBe(expected);
    });
});

describe('isOptionalBinding()', () => {
    it.each([
        ['<?binding', true],
        ['=?value', true],
        ['=?', true],
        ['@binding', false],
        ['=value', false],
        ['&onClick', false],
    ])('should return %s for input "%s"', (input, expected) => {
        expect(isOptionalBinding(input)).toBe(expected);
    });
});

describe('isEventBinding()', () => {
    it.each([
        ['&onClick', true],
        ['&', true],
        ['@binding', false],
        ['=value', false],
        ['<?binding', false],
    ])('should return %s for input "%s"', (input, expected) => {
        expect(isEventBinding(input)).toBe(expected);
    });
});

describe('isStringBinding()', () => {
    it.each([
        ['@binding', true],
        ['@', true],
        ['&onClick', false],
        ['=value', false],
        ['<?binding', false],
    ])('should return %s for input "%s"', (input, expected) => {
        expect(isStringBinding(input)).toBe(expected);
    });
});

describe('getBindingType()', () => {
    it.each([
        ['&onClick', true, '<expression>'],
        ['&onClick', false, '(...args: any[]) => any'],
        ['@binding', true, 'string'],
        ['@binding', false, 'string'],
        ['=value', true, 'any'],
        ['=value', false, 'any'],
        ['<value', true, 'any'],
        ['<value', false, 'any'],
    ])(
        'should return "%s" for input "%s" when perspectivesOnUsing is %s',
        (bindingConfig, perspectivesOnUsing, expected) => {
            expect(getBindingType(bindingConfig, perspectivesOnUsing)).toBe(expected);
        },
    );
});

describe('getBindingTypeInfo()', () => {
    it.each([
        [
            { name: 'input', value: '<inputValue' },
            true,
            {
                kind: 'property',
                name: 'inputValue',
                typeString: 'any',
                document: 'bindings config: "<inputValue"',
                optional: false,
                isFunction: false,
            } as NgTypeInfo,
        ],
        [
            { name: 'input', value: '<inputValue' },
            false,
            {
                kind: 'property',
                name: 'input',
                typeString: 'any',
                document: 'bindings config: "<inputValue"',
                optional: false,
                isFunction: false,
            } as NgTypeInfo,
        ],
        [
            { name: 'output', value: '&onOutput' },
            true,
            {
                kind: 'property',
                name: 'onOutput',
                typeString: '<expression>',
                document: 'bindings config: "&onOutput"',
                optional: false,
                isFunction: true,
                paramNames: [],
            } as NgTypeInfo,
        ],
        [
            { name: 'output', value: '&onOutput' },
            false,
            {
                kind: 'property',
                name: 'output',
                typeString: '(...args: any[]) => any',
                document: 'bindings config: "&onOutput"',
                optional: false,
                isFunction: true,
                paramNames: [],
            } as NgTypeInfo,
        ],
        [
            { name: 'text', value: '@text' },
            true,
            {
                kind: 'property',
                name: 'text',
                typeString: 'string',
                document: 'bindings config: "@text"',
                optional: false,
                isFunction: false,
            } as NgTypeInfo,
        ],
        [
            { name: 'optionalInput', value: '<?inputValue' },
            true,
            {
                kind: 'property',
                name: 'inputValue',
                typeString: 'any',
                document: 'bindings config: "<?inputValue"',
                optional: true,
                isFunction: false,
            } as NgTypeInfo,
        ],
    ])(
        'should return correct NgTypeInfo for binding %j when perspectivesOnUsing is %s',
        (bindingData: { name: string; value: string }, perspectivesOnUsing: boolean, expected: NgTypeInfo) => {
            const binding = createProperty(bindingData.name, bindingData.value);
            const result = getBindingTypeInfo(binding, perspectivesOnUsing);
            expect(result).toEqual(expected);
        },
    );
});

describe('isAngularModuleNode()', () => {
    const ctx = prepareTestContext(`
        angular.module("myModule");
        angular.module("myModule", ["dep1", "dep2"]);
        angular.module("myModule", ["dep1", "dep2"], function() {});
        angular.service("myService", function() {});
        angular.module("myModule", ["xyz"]).service("myService", function() {});
        someOtherFunction("myModule");
        let x = "abc";
        angular.module(x);
    `);

    it.each([
        ['angular.module("myModule")', true],
        ['angular.module("myModule", ["dep1", "dep2"])', true],
        ['angular.module("myModule", ["dep1", "dep2"], function() {})', true],
        ['angular.service("myService", function() {})', false],
        ['angular.module("myModule", ["xyz"])', true],
        ['someOtherFunction("myModule")', false],
        ['angular.module(x)', true],
    ])('should return %s for %s', (expression, expected) => {
        const node = findNode(ctx, expression);
        expect(isAngularModuleNode(ctx, node)).toBe(expected);
    });
});

describe('isAngularComponentRegisterNode()', () => {
    const ctx = prepareTestContext(`
        let config = {};
        let config2 = {};
        angular.module('myModule').component('myComponent', {});
        angular.module('myModule').component('a', {}).component('b', {});
        angular.module('myModule').directive('myDirective', function() {});
        angular.module('myModule').factory('myFactory', function() {});
        angular.module('myModule').component({ myComponent: { template: '<div>Hello</div>' } });
    `);

    it.each([
        ["angular.module('myModule').component('myComponent', {})", true],
        ["angular.module('myModule').component('a', {}).component('b', {})", true],
        ["angular.module('myModule').directive('myDirective', function() {})", false],
        ["angular.module('myModule').factory('myFactory', function() {})", false],
        ["angular.module('myModule').component({ myComponent: { template: '<div>Hello</div>' } })", false],
    ])('should return %s for %s', (expression, expected) => {
        const node = findNode(ctx, expression);
        expect(isAngularComponentRegisterNode(ctx, node)).toBe(expected);
    });
});

describe('isAngularDirectiveRegisterNode()', () => {
    const ctx = prepareTestContext(`
        angular.module('myModule').directive('myDirective', function() {});
        angular.module('myModule').directive('myDirective', ['dep1', 'dep2', function(dep1, dep2) {}]);
        angular.module('myModule').component('myComponent', {});
        angular.module('myModule').factory('myFactory', function() {});
        angular.module('myModule').directive({ myDirective: function() {} });
    `);

    it.each([
        ["angular.module('myModule').directive('myDirective', function() {})", true],
        ["angular.module('myModule').directive('myDirective', ['dep1', 'dep2', function(dep1, dep2) {}])", true],
        ["angular.module('myModule').component('myComponent', {})", false],
        ["angular.module('myModule').factory('myFactory', function() {})", false],
        ["angular.module('myModule').directive({ myDirective: function() {} })", false],
    ])('should return %s for %s', (expression, expected) => {
        const node = findNode(ctx, expression);
        expect(isAngularDirectiveRegisterNode(ctx, node)).toBe(expected);
    });
});

describe('isAngularControllerRegisterNode()', () => {
    const ctx = prepareTestContext(`
        angular.module('myModule').controller('MyController', function() {});
        angular.module('myModule').controller('MyController', ['$scope', function($scope) {}]);
        angular.module('myModule').component('myComponent', {});
        angular.module('myModule').service('myService', function() {});
        angular.module('myModule').controller({ MyController: function() {} });
    `);

    it.each([
        ["angular.module('myModule').controller('MyController', function() {})", true],
        ["angular.module('myModule').controller('MyController', ['$scope', function($scope) {}])", true],
        ["angular.module('myModule').component('myComponent', {})", false],
        ["angular.module('myModule').service('myService', function() {})", false],
        ["angular.module('myModule').controller({ MyController: function() {} })", false],
    ])('should return %s for %s', (expression, expected) => {
        const node = findNode(ctx, expression);
        expect(isAngularControllerRegisterNode(ctx, node)).toBe(expected);
    });
});

describe('isAngularServiceRegisterNode()', () => {
    const ctx = prepareTestContext(`
        angular.module('myModule').service('MyService', function() {});
        angular.module('myModule').service('MyService', ['dep1', function(dep1) {}]);
        angular.module('myModule').component('myComponent', {});
        angular.module('myModule').factory('myFactory', function() {});
        angular.module('myModule').service({ MyService: function() {} });
    `);

    it.each([
        ["angular.module('myModule').service('MyService', function() {})", true],
        ["angular.module('myModule').service('MyService', ['dep1', function(dep1) {}])", true],
        ["angular.module('myModule').component('myComponent', {})", false],
        ["angular.module('myModule').factory('myFactory', function() {})", false],
        ["angular.module('myModule').service({ MyService: function() {} })", false],
    ])('should return %s for %s', (expression, expected) => {
        const node = findNode(ctx, expression);
        expect(isAngularServiceRegisterNode(ctx, node)).toBe(expected);
    });
});

describe('isAngularFilterRegisterNode()', () => {
    const ctx = prepareTestContext(`
        angular.module('myModule').filter('myFilter', function() {});
        angular.module('myModule').filter('myFilter', ['dep1', function(dep1) {}]);
        angular.module('myModule').component('myComponent', {});
        angular.module('myModule').service('myService', function() {});
        angular.module('myModule').filter({ myFilter: function() {} });
    `);

    it.each([
        ["angular.module('myModule').filter('myFilter', function() {})", true],
        ["angular.module('myModule').filter('myFilter', ['dep1', function(dep1) {}])", true],
        ["angular.module('myModule').component('myComponent', {})", false],
        ["angular.module('myModule').service('myService', function() {})", false],
        ["angular.module('myModule').filter({ myFilter: function() {} })", false],
    ])('should return %s for %s', (expression, expected) => {
        const node = findNode(ctx, expression);
        expect(isAngularFilterRegisterNode(ctx, node)).toBe(expected);
    });
});

describe('isAngularFactoryRegisterNode()', () => {
    const ctx = prepareTestContext(`
        angular.module('myModule').factory('myFactory', function() {});
        angular.module('myModule').factory('myFactory', ['dep1', function(dep1) {}]);
        angular.module('myModule').component('myComponent', {});
        angular.module('myModule').service('myService', function() {});
        angular.module('myModule').factory({ myFactory: function() {} });
    `);

    it.each([
        ["angular.module('myModule').factory('myFactory', function() {})", true],
        ["angular.module('myModule').factory('myFactory', ['dep1', function(dep1) {}])", true],
        ["angular.module('myModule').component('myComponent', {})", false],
        ["angular.module('myModule').service('myService', function() {})", false],
        ["angular.module('myModule').factory({ myFactory: function() {} })", false],
    ])('should return %s for %s', (expression, expected) => {
        const node = findNode(ctx, expression);
        expect(isAngularFactoryRegisterNode(ctx, node)).toBe(expected);
    });
});

describe('isAngularProviderRegisterNode()', () => {
    const ctx = prepareTestContext(`
        angular.module('myModule').provider('myProvider', function() {});
        angular.module('myModule').provider('myProvider', ['dep1', function(dep1) {}]);
        angular.module('myModule').component('myComponent', {});
        angular.module('myModule').service('myService', function() {});
        angular.module('myModule').provider({ myProvider: function() {} });
    `);

    it.each([
        ["angular.module('myModule').provider('myProvider', function() {})", true],
        ["angular.module('myModule').provider('myProvider', ['dep1', function(dep1) {}])", true],
        ["angular.module('myModule').component('myComponent', {})", false],
        ["angular.module('myModule').service('myService', function() {})", false],
        ["angular.module('myModule').provider({ myProvider: function() {} })", false],
    ])('should return %s for %s', (expression, expected) => {
        const node = findNode(ctx, expression);
        expect(isAngularProviderRegisterNode(ctx, node)).toBe(expected);
    });
});

describe('isAngularConstantRegisterNode()', () => {
    const ctx = prepareTestContext(`
        angular.module('myModule').constant('pi', 3.1415926);
        angular.module('myModule').constant({ pi: 3.1415926});
    `);

    it.each([
        ["angular.module('myModule').constant('pi', 3.1415926)", true],
        ["angular.module('myModule').constant({ pi: 3.1415926})", false],
    ])('should return %s for %s', (expression, expected) => {
        const node = findNode(ctx, expression);
        expect(isAngularConstantRegisterNode(ctx, node)).toBe(expected);
    });
});

describe('isAngularRunNode()', () => {
    const ctx = prepareTestContext(`
        angular.module('myModule').run(function() {});
        angular.module('myModule').run(['dep1', 'dep2', function(dep1, dep2) {}]);
        angular.module('myModule').config(function() {});
        angular.module('myModule').component('myComponent', {});
        angular.module('myModule').run({});
    `);

    it.each([
        ["angular.module('myModule').run(function() {})", true],
        ["angular.module('myModule').run(['dep1', 'dep2', function(dep1, dep2) {}])", true],
        ["angular.module('myModule').config(function() {})", false],
        ["angular.module('myModule').component('myComponent', {})", false],
        ["angular.module('myModule').run({})", false],
    ])('should return %s for %s', (expression, expected) => {
        const node = findNode(ctx, expression);
        expect(isAngularRunNode(ctx, node)).toBe(expected);
    });
});

describe('isAngularConfigNode()', () => {
    const ctx = prepareTestContext(`
        angular.module('myModule').config(function() {});
        angular.module('myModule').config(['dep1', 'dep2', function(dep1, dep2) {}]);
        angular.module('myModule').run(function() {});
        angular.module('myModule').component('myComponent', {});
        angular.module('myModule').config({});
    `);

    it.each([
        ["angular.module('myModule').config(function() {})", true],
        ["angular.module('myModule').config(['dep1', 'dep2', function(dep1, dep2) {}])", true],
        ["angular.module('myModule').run(function() {})", false],
        ["angular.module('myModule').component('myComponent', {})", false],
        ["angular.module('myModule').config({})", false],
    ])('should return %s for %s', (expression, expected) => {
        const node = findNode(ctx, expression);
        expect(isAngularConfigNode(ctx, node)).toBe(expected);
    });
});

describe('getAngularDefineFunctionExpression()', () => {
    const ctx = prepareTestContext(`
        angular.module('myModule').directive('myDirective', function() { return {}; });
        angular.module('myModule').directive('myDirective', ['dep1', 'dep2', function(dep1, dep2) { return {}; }]);
        angular.module('myModule').directive('myDirective', () => { return {}; });
        angular.module('myModule').directive('myDirective', ['dep1', 'dep2', (dep1, dep2) => { return {}; }]);
        angular.module('myModule').directive('myDirective', {});
    `);

    it('should return function expression for simple function', () => {
        const node = findNode(ctx, 'function() { return {}; }');
        const result = getAngularDefineFunctionExpression(ctx, node as ts.Expression);
        expect(result).toBeDefined();
        expect(ctx.ts.isFunctionExpression(result!)).toBe(true);
    });

    it('should return function expression for array notation', () => {
        const node = findNode(ctx, "['dep1', 'dep2', function(dep1, dep2) { return {}; }]");
        const result = getAngularDefineFunctionExpression(ctx, node as ts.Expression);
        expect(result).toBeDefined();
        expect(ctx.ts.isFunctionExpression(result!)).toBe(true);
    });

    it('should return undefined for arrow function', () => {
        const node = findNode(ctx, '() => { return {}; }');
        const result = getAngularDefineFunctionExpression(ctx, node as ts.Expression);
        expect(result).toBeUndefined();
    });

    it('should return undefined for array notation with arrow function', () => {
        const node = findNode(ctx, "['dep1', 'dep2', (dep1, dep2) => { return {}; }]");
        const result = getAngularDefineFunctionExpression(ctx, node as ts.Expression);
        expect(result).toBeUndefined();
    });

    it('should return undefined for object literal', () => {
        const node = findNode(ctx, '{}');
        const result = getAngularDefineFunctionExpression(ctx, node as ts.Expression);
        expect(result).toBeUndefined();
    });
});

function createProperty(name: string, value: string): Property {
    return {
        name,
        value,
        location: { start: 0, end: 0 },
    };
}

function buildDirectiveInfo(restrict: string): DirectiveInfo {
    return {
        name: '',
        restrict,
        filePath: '',
        location: { start: 0, end: 0 },
        scope: [],
    };
}

function findNode(ctx: PluginContext, text: string): ts.Node {
    let foundNode: ts.Node | undefined;

    function visit(node: ts.Node) {
        if (node.getText() === text) {
            foundNode = node;
            return;
        }
        ctx.ts.forEachChild(node, visit);
    }

    ctx.ts.forEachChild(ctx.sourceFile, visit);

    if (!foundNode) {
        throw new Error(`Node with text "${text}" not found`);
    }

    return foundNode;
}
