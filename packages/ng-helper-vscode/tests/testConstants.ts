import { join, resolve } from 'path';

// extension relation info
export const EXTENSION_ID = 'huanguolin.ng-helper';
export const COMMAND_ID = 'ng-helper.createComponent';

// 注意这个路径要按照编译后的文件位置来写，编译后文件在 tests/dist 目录下。
export const PROJECT_PATH = resolve(__dirname, '..', 'fixtures');

// .vscode
export const VSCODE_DIR = join(PROJECT_PATH, '.vscode');
export const NG_HELPER_CONFIG_PATH = join(VSCODE_DIR, 'ng-helper.json');

// app
export const APP_DIR = join(PROJECT_PATH, 'app');

// components
export const APP_COMPONENTS_DIR = join(APP_DIR, 'components');

// pages
export const APP_PAGES_DIR = join(APP_DIR, 'pages');
