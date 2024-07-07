/* eslint-disable */
const fs = require("fs-extra")
const path = require("path")

const { program } = require("commander")

// 该文件用于处理打包时，typescript-plugin 依赖的问题

program.option('--clean');
program.parse();
const options = program.opts();
const clean = !!options.clean;
main();

async function main() {
    const nodeModules = path.resolve(__dirname, '../node_modules');
    const dependencyDir = path.join(nodeModules, '@ng-helper');
    
    const srcPluginDir = path.resolve(__dirname, '../../typescript-plugin');
    const targetPluginDir = path.join(dependencyDir, 'typescript-plugin');

    await fs.remove(dependencyDir);

    if (!clean) {
        await fs.mkdir(dependencyDir);

        await fs.copy(srcPluginDir, targetPluginDir);

        await fs.remove(path.join(targetPluginDir, 'node_modules'));
    }
}
