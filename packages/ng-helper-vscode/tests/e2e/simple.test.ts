import * as assert from 'assert';

import { suite, test, suiteTeardown } from 'mocha';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
    suiteTeardown(() => {
        void vscode.window.showInformationMessage('All tests done!');
    });

    test('Sample test', () => {
        assert.strictEqual(-1, [1, 2, 3].indexOf(5));
        assert.strictEqual(-1, [1, 2, 3].indexOf(0));
    });
});
