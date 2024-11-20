// snapshotResolver.js
import * as path from 'path';

// see https://jestjs.io/docs/configuration#snapshotresolver-string
export default {
    resolveSnapshotPath: (testPath: string, snapshotExtension: string) => {
        return resolveSnapshotPath(testPath, snapshotExtension);
    },
    resolveTestPath: (snapshotPath: string, snapshotExtension: string) => {
        return resolveTestPath(snapshotPath, snapshotExtension);
    },
    testPathForConsistencyCheck: 'tests/dist/e2e/hover.test.js',
};

// 编译后的代码放在 tests/dist 目录下，所以默认情况下,
// snapshot 文件也放在 tests/dist/ 对应测试文件所在问价夹的 __snapshots__ 目录下.
// 但是我们需要放到测试的 ts 文件所在的目录下.
function resolveSnapshotPath(testPath: string, snapshotExtension: string) {
    const testJsDir = path.dirname(testPath);
    // tests/dist/e2e/ -> tests/e2e/
    const testTsDir = testJsDir.replace('dist', '');

    const snapshotDir = path.join(testTsDir, '__snapshots__');

    const testFileName = path.basename(testPath);
    return path.join(snapshotDir, `${testFileName}${snapshotExtension}`);
}

// 反过来, 从 snapshot 文件路径中找到对应的测试文件路径
function resolveTestPath(snapshotPath: string, snapshotExtension: string) {
    const snapshotDir = path.dirname(snapshotPath);

    // tests/e2e/__snapshots__/ -> tests/dist/e2e/
    const inArr = snapshotDir.split(path.sep);
    const outArr: string[] = [];
    for (const item of inArr) {
        if (item === '__snapshots__') {
            continue;
        }
        outArr.push(item);
        if (item === 'tests') {
            outArr.push('dist');
        }
    }
    const testJsDir = path.join(...outArr);

    const testFileName = path.basename(snapshotPath).replace(snapshotExtension, '');
    return path.join(testJsDir, testFileName);
}
