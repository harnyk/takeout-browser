const esbuild = require('esbuild');

esbuild
    .build({
        entryPoints: ['process.ts'],
        bundle: true,
        platform: 'node',
        target: 'node14',
        outfile: 'dist/cli.js',
    })
    .catch(() => process.exit(1));
