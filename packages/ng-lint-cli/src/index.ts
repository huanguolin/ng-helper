import fs from 'fs';
import path, { normalize } from 'path';

import { getNgDiagnosticResult, type NgDiagnostic } from '@ng-helper/shared/lib/ngDiagnostic';
import type { NgAllComponentsExpressionAttrsResponse } from '@ng-helper/shared/lib/plugin';
import { type NgProjectConfig } from '@ng-helper/shared/lib/userConfig';

import { getProjectsConfig } from './config';
import { getExportedExpressionAttrsData } from './exportData';

interface ErrorFile {
    filePath: string;
    errorCount: number;
}

interface ProjectResult {
    projectName: string;
    errorFiles: ErrorFile[];
    totalErrors: number;
}

const defaultProjectPath = process.cwd();

main();

function main() {
    const workRootPath = process.argv[2] || defaultProjectPath;
    const projects = getProjectsConfig(workRootPath);

    if (projects.length === 0) {
        console.log('没有配置任何 Angular 项目');
        return;
    }

    const exportedExpressionAttrsData = getExportedExpressionAttrsData(
        path.join(workRootPath, 'ng-expression-attrs.json'),
    );

    const projectResults = processAllProjects(projects, workRootPath, exportedExpressionAttrsData);
    const totalDiagnostics = calculateTotalDiagnostics(projectResults);

    outputSummary(projectResults, totalDiagnostics);

    if (totalDiagnostics > 0) {
        process.exit(1);
    }
}

function processAllProjects(
    projects: NgProjectConfig[],
    workRootPath: string,
    exportedExpressionAttrsData?: NgAllComponentsExpressionAttrsResponse,
): ProjectResult[] {
    const results: ProjectResult[] = [];

    for (const project of projects) {
        console.log(`\n正在检查项目: ${project.name} (${project.path})`);
        const result = processProject(project, workRootPath, exportedExpressionAttrsData);
        results.push(result);
    }

    return results;
}

function processProject(
    project: NgProjectConfig,
    workRootPath: string,
    exportedExpressionAttrsData: NgAllComponentsExpressionAttrsResponse = {},
): ProjectResult {
    const errorFiles: ErrorFile[] = [];
    let totalErrors = 0;

    try {
        const projectAbsolutePath = getProjectAbsolutePath(project.path, workRootPath);
        const htmlFiles = getHtmlFiles(projectAbsolutePath);

        if (htmlFiles.length === 0) {
            console.log('  未找到 HTML 文件');
            return { projectName: project.name, errorFiles, totalErrors };
        }

        console.log(`  找到 ${htmlFiles.length} 个 HTML 文件`);

        const exprAttrNamesMap = exportedExpressionAttrsData[projectAbsolutePath];
        for (const htmlFile of htmlFiles) {
            const fileResult = processHtmlFile(htmlFile, project, workRootPath, exprAttrNamesMap);
            if (fileResult) {
                errorFiles.push(fileResult);
                totalErrors += fileResult.errorCount;
            }
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`  项目 ${project.name} 处理失败: ${errorMessage}`);
    }

    return { projectName: project.name, errorFiles, totalErrors };
}

function processHtmlFile(
    htmlFile: string,
    project: NgProjectConfig,
    workRootPath: string,
    exprAttrNamesMap?: Record<string, string[]>,
): ErrorFile | null {
    const relativePath = path.relative(project.path, htmlFile);

    try {
        const htmlContent = fs.readFileSync(htmlFile, 'utf-8');
        const additionalInfo = exprAttrNamesMap
            ? {
                  componentExpressionAttrMap: exprAttrNamesMap,
                  directiveExpressionAttrMap: exprAttrNamesMap,
              }
            : undefined;
        const diagnostics = getNgDiagnosticResult(htmlContent, { additionalInfo });

        if (diagnostics.length > 0) {
            console.log(`\n  ${relativePath}:`);
            outputDiagnostics(diagnostics, htmlContent);

            const workRelativePath = path.relative(workRootPath, htmlFile);
            return {
                filePath: workRelativePath,
                errorCount: diagnostics.length,
            };
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`    处理文件失败 ${relativePath}: ${errorMessage}`);
    }

    return null;
}

function getProjectAbsolutePath(projectPath: string, workRootPath: string): string {
    const normalizedProjectPath = normalizePath(projectPath);
    return normalizedProjectPath.startsWith('/')
        ? normalizedProjectPath
        : normalizePath(path.join(workRootPath, normalizedProjectPath));
}

function calculateTotalDiagnostics(projectResults: ProjectResult[]): number {
    return projectResults.reduce((total, result) => total + result.totalErrors, 0);
}

function outputSummary(projectResults: ProjectResult[], totalDiagnostics: number) {
    const totalErrorFiles = projectResults.reduce((sum, result) => sum + result.errorFiles.length, 0);

    console.log(`\n检查完成，共发现 ${totalDiagnostics} 个问题`);

    if (totalErrorFiles > 0) {
        outputErrorFilesList(projectResults, totalDiagnostics, totalErrorFiles);
    }
}

function outputErrorFilesList(projectResults: ProjectResult[], totalDiagnostics: number, totalErrorFiles: number) {
    console.log(`\n共${totalDiagnostics}个错误, ${totalErrorFiles}个文件:`);
    console.log('='.repeat(50));

    for (const result of projectResults) {
        if (result.errorFiles.length > 0) {
            outputProjectErrorSummary(result);
        }
    }

    console.log('='.repeat(50));
}

function outputProjectErrorSummary(result: ProjectResult) {
    console.log(`${result.projectName}(共${result.totalErrors}个错误, ${result.errorFiles.length}个文件):`);

    result.errorFiles.forEach((errorFile) => {
        console.log(`${errorFile.filePath} (${errorFile.errorCount}个错误)`);
    });
}

function getHtmlFiles(dirPath: string): string[] {
    const htmlFiles: string[] = [];

    function traverse(currentPath: string) {
        try {
            const items = fs.readdirSync(currentPath);

            for (const item of items) {
                if (shouldSkipItem(item)) {
                    continue;
                }

                const fullPath = path.join(currentPath, item);
                const stat = fs.statSync(fullPath);

                if (stat.isDirectory()) {
                    traverse(fullPath);
                } else if (isHtmlFile(item)) {
                    htmlFiles.push(fullPath);
                }
            }
        } catch (error) {
            console.warn(`无法访问目录: ${currentPath}`);
        }
    }

    traverse(dirPath);
    return htmlFiles;
}

function shouldSkipItem(item: string): boolean {
    return item === 'node_modules';
}

function isHtmlFile(fileName: string): boolean {
    return path.extname(fileName) === '.html';
}

function outputDiagnostics(diagnostics: NgDiagnostic[], htmlContent: string) {
    const lines = htmlContent.split('\n');

    for (const diagnostic of diagnostics) {
        outputSingleDiagnostic(diagnostic, lines, htmlContent);
    }
}

function outputSingleDiagnostic(diagnostic: NgDiagnostic, lines: string[], htmlContent: string) {
    const location = getLocationFromOffset(diagnostic.start, htmlContent);
    const line = lines[location.line - 1] || '';

    console.log(`    第 ${location.line} 行，第 ${location.column} 列: ${diagnostic.message}`);
    console.log(`      ${line.trim()}`);
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
