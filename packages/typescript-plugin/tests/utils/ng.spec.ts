import type { NgTypeInfo } from '@ng-helper/shared/lib/plugin';

import { DirectiveInfo, type Property } from '../../src/ngHelperServer/ngCache';
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
} from '../../src/utils/ng';

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
    ])('should return "%s" for input "%s" when perspectivesOnUsing is %s', (bindingConfig, perspectivesOnUsing, expected) => {
        expect(getBindingType(bindingConfig, perspectivesOnUsing)).toBe(expected);
    });
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
                document: 'bindings config: "input"',
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
                document: 'bindings config: "input"',
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
                document: 'bindings config: "output"',
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
                document: 'bindings config: "output"',
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
                document: 'bindings config: "text"',
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
                document: 'bindings config: "optionalInput"',
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
