/**
 * babel config for esbuild, and jest run '*.spec.ts' files
 */

// eslint-disable-next-line no-undef
module.exports = {
    presets: [['@babel/preset-env', { targets: { node: 'current' } }], '@babel/preset-typescript'],
};
