import { join, resolve } from 'path';

export const PACKAGE_ROOT = resolve(__dirname, '..');
export const PROJECT_PATH = join(PACKAGE_ROOT, 'tests', 'fixtures');

// .vscode
export const VSCODE_DIR = join(PROJECT_PATH, '.vscode');
export const NG_HELPER_CONFIG_PATH = join(VSCODE_DIR, 'ng-helper.json');

// app
export const APP_DIR = join(PROJECT_PATH, 'app');

// components
export const APP_COMPONENTS_DIR = join(APP_DIR, 'components');

// pages
export const APP_PAGES_DIR = join(APP_DIR, 'pages');
