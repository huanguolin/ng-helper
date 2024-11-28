import { Debug } from '../src/debug';

describe('Debug', () => {
    describe('assert()', () => {
        it('should not throw when expression is true', () => {
            expect(() => Debug.assert(true)).not.toThrow();
        });

        it('should throw when expression is false', () => {
            expect(() => Debug.assert(false)).toThrow('Debug Failure. False expression.');
        });

        it('should throw with custom message when expression is false', () => {
            expect(() => Debug.assert(false, 'Custom message')).toThrow(
                'Debug Failure. False expression: Custom message',
            );
        });
    });

    describe('assertEqual()', () => {
        it('should not throw when values are equal', () => {
            expect(() => Debug.assertEqual(1, 1)).not.toThrow();
            expect(() => Debug.assertEqual('test', 'test')).not.toThrow();
        });

        it('should throw when values are not equal', () => {
            expect(() => Debug.assertEqual(1, 2)).toThrow('Debug Failure. Expected 1 === 2. ');
        });

        it('should throw with custom message when values are not equal', () => {
            expect(() => Debug.assertEqual(1, 2, 'Numbers', 'should be equal')).toThrow(
                'Debug Failure. Expected 1 === 2. Numbers should be equal',
            );
        });
    });

    describe('fail()', () => {
        it('should throw error with default message', () => {
            expect(() => Debug.fail()).toThrow('Debug Failure.');
        });

        it('should throw error with custom message', () => {
            expect(() => Debug.fail('Custom failure')).toThrow('Debug Failure. Custom failure');
        });
    });
});
