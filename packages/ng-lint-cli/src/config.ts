import fs from 'fs';
import path from 'path';

import { NgHelperUserConfigScheme, type NgProjectConfig } from '@ng-helper/shared/lib/userConfig';

const configPathRelateProject = path.join('.vscode', 'ng-helper.json');

// 这里简单考虑，不做过多的校验
export function getProjectsConfig(projectPath: string): NgProjectConfig[] {
    try {
        const jsonText = fs.readFileSync(path.join(projectPath, configPathRelateProject), 'utf-8');
        const config = NgHelperUserConfigScheme.parse(JSON.parse(jsonText || '{}'));
        return config.ngProjects ?? [];
    } catch (error) {
        console.error(`Failed to read config: ${error instanceof Error ? error.message : `${error as string}`}`);
    }
    return [];
}
