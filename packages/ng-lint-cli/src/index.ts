import fs from 'fs';
import path, { normalize } from 'path';

import { getNgDiagnosticResult, type NgDiagnostic } from '@ng-helper/shared/lib/ngDiagnostic';

import { getProjectsConfig } from './config';

const defaultProjectPath = process.cwd();

main();

function main() {
    // 读取配置
    const workRootPath = process.argv[2] || defaultProjectPath;
    const projects = getProjectsConfig(workRootPath);

    if (projects.length === 0) {
        console.log('没有配置任何 Angular 项目');
        return;
    }

    let totalDiagnostics = 0;

    // 依照项目配置，读取 ngProject 目录下的 html 文件
    for (const project of projects) {
        console.log(`\n正在检查项目: ${project.name} (${project.path})`);

        try {
            // 获取项目目录下的所有 HTML 文件
            const projectPath = normalizePath(project.path);
            const projectAbsolutePath = projectPath.startsWith('/')
                ? projectPath
                : normalizePath(path.join(workRootPath, projectPath));
            const htmlFiles = getHtmlFiles(projectAbsolutePath);

            if (htmlFiles.length === 0) {
                console.log('  未找到 HTML 文件');
                continue;
            }

            console.log(`  找到 ${htmlFiles.length} 个 HTML 文件`);

            // 诊断 html 文件
            for (const htmlFile of htmlFiles) {
                const relativePath = path.relative(project.path, htmlFile);

                try {
                    const htmlContent = fs.readFileSync(htmlFile, 'utf-8');
                    const diagnostics = getNgDiagnosticResult(htmlContent);

                    if (diagnostics.length > 0) {
                        console.log(`\n  ${relativePath}:`);
                        outputDiagnostics(diagnostics, htmlContent);
                        totalDiagnostics += diagnostics.length;
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    console.error(`    读取文件失败 ${relativePath}: ${errorMessage}`);
                }
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`  项目 ${project.name} 处理失败: ${errorMessage}`);
        }
    }

    // 输出诊断结果摘要
    console.log(`\n检查完成，共发现 ${totalDiagnostics} 个问题`);

    if (totalDiagnostics > 0) {
        process.exit(1);
    }
}

function getHtmlFiles(dirPath: string): string[] {
    const htmlFiles: string[] = [];

    function traverse(currentPath: string) {
        try {
            const items = fs.readdirSync(currentPath);

            for (const item of items) {
                // 跳过 node_modules 目录
                if (item === 'node_modules') {
                    continue;
                }

                const fullPath = path.join(currentPath, item);
                const stat = fs.statSync(fullPath);

                if (stat.isDirectory()) {
                    traverse(fullPath);
                } else if (stat.isFile() && path.extname(item) === '.html') {
                    htmlFiles.push(fullPath);
                }
            }
        } catch (error) {
            // 忽略无法访问的目录
            console.warn(`无法访问目录: ${currentPath}`);
        }
    }

    traverse(dirPath);
    return htmlFiles;
}

function outputDiagnostics(diagnostics: NgDiagnostic[], htmlContent: string) {
    const lines = htmlContent.split('\n');

    for (const diagnostic of diagnostics) {
        const location = getLocationFromOffset(diagnostic.start, htmlContent);
        const line = lines[location.line - 1] || '';

        console.log(`    第 ${location.line} 行，第 ${location.column} 列: ${diagnostic.message}`);
        console.log(`      ${line.trim()}`);

        // 添加指示错误位置的标记
        const spaces = ' '.repeat(6 + location.column - 1);
        const length = Math.max(1, diagnostic.end - diagnostic.start);
        const marker = '^'.repeat(length);
        console.log(`      ${spaces}${marker}`);
    }
}

function getLocationFromOffset(offset: number, text: string): { line: number; column: number } {
    const lines = text.substring(0, offset).split('\n');
    return {
        line: lines.length,
        column: lines[lines.length - 1].length + 1,
    };
}

function normalizePath(filePath: string): string {
    filePath = normalize(filePath);
    filePath = filePath.replace(/\\/g, '/');
    if (filePath.endsWith('/')) {
        return filePath.slice(0, -1);
    }
    return filePath;
}
