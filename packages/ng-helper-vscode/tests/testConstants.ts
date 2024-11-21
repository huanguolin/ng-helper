import { join, resolve } from 'path';

// ---- my extension relation info ----
export const MY_EXTENSION_ID = 'huanguolin.ng-helper';
export const CREATE_COMPONENT_COMMAND = 'ng-helper.createComponent';

// ---- system command ----
// see https://code.visualstudio.com/api/references/commands
export const COMPLETION_COMMAND = 'vscode.executeCompletionItemProvider';
export const HOVER_COMMAND = 'vscode.executeHoverProvider';
export const DEFINITION_COMMAND = 'vscode.executeDefinitionProvider';

// ---- project path ----
// 注意这个路径要按照编译后的文件位置来写，编译后文件在 tests/dist 目录下。
export const PROJECT_PATH = resolve(__dirname, '..', 'fixtures');

// ---- .vscode ----
export const VSCODE_DIR = join(PROJECT_PATH, '.vscode');
export const NG_HELPER_CONFIG_PATH = join(VSCODE_DIR, 'ng-helper.json');

// ---- app ----
export const APP_DIR = join(PROJECT_PATH, 'app');

// ---- components ----
export const APP_COMPONENTS_DIR = join(APP_DIR, 'components');
// bar-foo
export const BAR_FOO_DIR = join(APP_COMPONENTS_DIR, 'bar-foo');
export const BAR_FOO_COMPONENT_TS_PATH = join(BAR_FOO_DIR, 'bar-foo.component.ts');
export const BAR_FOO_COMPONENT_HTML_PATH = join(BAR_FOO_DIR, 'bar-foo.component.html');
// baz-qux
export const BAZ_QUX_DIR = join(APP_COMPONENTS_DIR, 'baz-qux');
export const BAZ_QUX_COMPONENT_JS_PATH = join(BAZ_QUX_DIR, 'baz-qux.component.js');
export const BAZ_QUX_COMPONENT_HTML_PATH = join(BAZ_QUX_DIR, 'baz-qux.component.html');
// drag-source
export const DRAG_SOURCE_DIR = join(APP_COMPONENTS_DIR, 'drag-source');
export const DRAG_SOURCE_COMPONENT_TS_PATH = join(DRAG_SOURCE_DIR, 'drag-source.component.ts');

// ---- directives ----
export const APP_DIRECTIVES_DIR = join(APP_DIR, 'directives');
export const BEST_XYZ_DIRECTIVE_JS_PATH = join(APP_DIRECTIVES_DIR, 'best-xyz.directive.js');
// ---- pages ----
export const APP_PAGES_DIR = join(APP_DIR, 'pages');
// p1
export const APP_PAGES_P1_DIR = join(APP_PAGES_DIR, 'p1');
export const APP_PAGES_P1_HTML_PATH = join(APP_PAGES_P1_DIR, 'p1.html');
// p2
export const APP_PAGES_P2_DIR = join(APP_PAGES_DIR, 'p2');
export const APP_PAGES_P2_HTML_PATH = join(APP_PAGES_P2_DIR, 'p2.html');
