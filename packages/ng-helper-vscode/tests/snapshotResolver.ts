// snapshotResolver.js
import * as path from 'path';

console.log('===> snapshotResolver', __dirname);

export default {
    resolveSnapshotPath: (testPath: string, snapshotExtension: string) => {
        console.log('===> resolveSnapshotPath', testPath, snapshotExtension);
        return resolveSnapshotPath(testPath, snapshotExtension);
    },
    resolveTestPath: (snapshotPath: string, snapshotExtension: string) => {
        console.log('===> resolveTestPath', snapshotPath, snapshotExtension);
        return resolveTestPath(snapshotPath, snapshotExtension);
    },
    snapshotExtension: '.snap', // Optional, default is '.snap'
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
    const testTsDir = snapshotDir.replace('/__snapshots__', '');
    const arr = testTsDir.split(path.sep);
    const testsDirIndex = arr.findIndex((item) => item === 'tests');
    if (testsDirIndex === -1) {
        throw new Error('tests dir not found');
    }
    arr.splice(testsDirIndex + 1, 0, 'dist');
    const testJsDir = path.join(...arr);

    const testFileName = path.basename(snapshotPath).replace(snapshotExtension, '');
    return path.join(testJsDir, testFileName);
}
