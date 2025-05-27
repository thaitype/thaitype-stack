// zbuild v0.0.1
import esbuild from 'esbuild';
import chokidar from 'chokidar';
import path from 'node:path';


export interface ZBuildOptions {
  esbuildOptions: esbuild.BuildOptions;
  cwd?: string;
  mode?: 'dev' | 'prod';
  verbose?: boolean;
  watchDirectories?: string[];
}

const defaultOptions: esbuild.BuildOptions = {
  bundle: true,
  platform: 'node',
  sourcemap: true,
  minify: true,
  format: 'cjs',
  target: ['node22'],
};

export async function watch(options: ZBuildOptions, buildCallback: () => Promise<void>) {
  if (!options.watchDirectories || options.watchDirectories.length === 0) {
    throw new Error('No directories specified to watch.');
  }
  const watchPaths = options.watchDirectories.map(dir => path.join(options.cwd ?? '', dir));
  console.log(`Watching directories: ${watchPaths.join(', ')}`);
  const watcher = chokidar.watch(watchPaths);

  watcher.on('change', path => {
    console.log(`📄 File changed: ${path}`);
    buildCallback()
      .then(
        () => console.log('Build completed successfully.')
      ).catch(err => {
      console.error('Error during build:', err);
    });
  });

}

export async function build(option: ZBuildOptions){
  const { verbose, cwd = process.cwd() } = option;

  // Build configuration
  const config: esbuild.BuildOptions = {
    ...defaultOptions,
    ...option.esbuildOptions,
  };

  if (verbose) {
    console.log('ZBuild Configuration:', JSON.stringify(config, null, 2));
  }

  await esbuild.build({
    ...config,
  });
}

export async function zbuild(option: ZBuildOptions) {
  const { mode = 'prod' } = option;
  if (mode === 'dev') {
    const watchDirectories = option.watchDirectories || ['src'];
    await watch({
      ...option,
      watchDirectories,
    }, () => build(option));
  }
  else {
    await build(option);
  }
}

zbuild({
  esbuildOptions: {
    outdir: 'functions/dist',
    entryPoints: ['server/main.ts'],
    external: ['@azure/functions-core'],
  },
  mode: 'dev',
  watchDirectories: ['server', 'src'],
});