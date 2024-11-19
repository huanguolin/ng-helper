/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import * as path from 'path';

import { glob } from 'glob';
import * as Mocha from 'mocha';

export function run(): Promise<void> {
    // Create the mocha test
    const mocha = new Mocha({
        ui: 'bdd',
        color: true,
        timeout: 30_000,
    });

    const testsRoot = path.resolve(__dirname);

    return new Promise((c, e) => {
        glob('e2e/**/**.test.js', { cwd: testsRoot })
            .then((files: string[]) => {
                // Add files to the test suite
                files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));

                try {
                    // Run the mocha test
                    mocha.run((failures) => {
                        if (failures > 0) {
                            e(new Error(`${failures} tests failed.`));
                        } else {
                            c();
                        }
                    });
                } catch (err) {
                    e(err);
                }
            })
            .catch((err) => {
                return e(err);
            });
    });
}
