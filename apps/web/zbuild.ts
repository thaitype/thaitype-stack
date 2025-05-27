// zbuild v0.0.1
import esbuild from 'esbuild';
import chokidar from 'chokidar';
import path from 'node:path';
import fs from 'fs/promises';
import z from 'zod';
import { execa } from 'execa';

export interface ZBuildOptions {
  esbuildOptions: esbuild.BuildOptions;
  cwd?: string;
  mode?: 'watch' | 'build';
  verbose?: boolean;
  targetDir?: string;
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

export async function build(option: ZBuildOptions) {
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
  const { mode = 'build' } = option;

  await handleExternalDependencies(option);

  if (mode === 'watch') {
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


export const zBuildConfigSchema = z.object({
  dependencies: z.record(z.string()).optional(),
  devDependencies: z.record(z.string()).optional(),
  zbuild: z.object({
    externalDependencies: z.record(z.string(), z.union([z.literal('external'), z.literal('install')])).optional(),
  }).optional(),
});


interface ExternalDependency {
  name: string;
  version: string;
}

function parseExternalDependencies(pkgData: unknown): ExternalDependency[] {
  const parsed = zBuildConfigSchema.parse(pkgData);

  const dependencies = {
    ...(parsed.dependencies ?? {}),
    ...(parsed.devDependencies ?? {}),
  };

  const externalDeps = parsed.zbuild?.externalDependencies ?? {};
  const installDeps: ExternalDependency[] = [];

  for (const [pkg, mode] of Object.entries(externalDeps)) {
    if (mode === 'install') {
      const version = dependencies[pkg];
      if (!version) {
        throw new Error(`📦 Missing version for package "${pkg}" in dependencies or devDependencies.`);
      }
      installDeps.push({ name: pkg, version });
    }
  }

  return installDeps;
}

async function writePackageJson({
  cwd,
  targetDir,
  outfile,
  outdir,
  verbose,
}: {
  cwd: string;
  targetDir: string;
  outfile?: string;
  outdir?: string;
  verbose?: boolean;
}) {
  const outputPath = outfile
    ? outfile
    : outdir
      ? path.join(outdir, 'main.js') // 👈 assume entry is main.js
      : null;

  if (!outputPath) {
    throw new Error(`Missing "outfile" or "outdir" in esbuildOptions`);
  }

  const mainRelative = path.relative(targetDir, outputPath);
  const newPkg = { main: mainRelative };
  const newPkgPath = path.join(cwd, targetDir, 'package.json');
  await fs.writeFile(newPkgPath, JSON.stringify(newPkg, null, 2));

  if (verbose) {
    console.log(`📝 Created package.json at ${newPkgPath}`);
  }
}

async function installPackages({
  deps,
  cwd,
  targetDir,
  verbose,
}: {
  deps: ExternalDependency[];
  cwd: string;
  targetDir: string;
  verbose?: boolean;
}) {
  if (deps.length === 0) {
    if (verbose) console.log('📦 No runtime dependencies to install.');
    return;
  }

  console.log(`📦 Installing runtime dependencies...`);
  for (const { name, version } of deps) {
    const full = `${name}@${version}`;
    console.log(`➡️  Installing ${full} in ${targetDir}`);
    try {
      await execa('npm', ['install', full], {
        cwd: path.resolve(cwd, targetDir),
        stdio: verbose ? 'inherit' : 'pipe',
      });
      console.log(`✅ Installed ${full}`);
    } catch (err) {
      console.error(`❌ Failed to install ${full}:`, err);
      throw err;
    }
  }
}

export async function handleExternalDependencies(option: ZBuildOptions) {
  const cwd = option.cwd ?? process.cwd();
  const targetDir = option.targetDir;
  if (!targetDir) return;

  const pkgJsonPath = path.join(cwd, 'package.json');
  const rawPkg = await fs.readFile(pkgJsonPath, 'utf-8');
  const pkgData = JSON.parse(rawPkg);

  const installDeps = parseExternalDependencies(pkgData);

  await writePackageJson({
    cwd,
    targetDir,
    outfile: option.esbuildOptions.outfile,
    outdir: option.esbuildOptions.outdir,
    verbose: option.verbose,
  });

  await installPackages({
    deps: installDeps,
    cwd,
    targetDir,
    verbose: option.verbose,
  });
}

const mode = (process.argv[2] || 'watch') as 'watch' | 'build';
if (mode !== 'watch' && mode !== 'build') {
  throw new Error('Invalid mode. Use "watch" or "build".');
}

zbuild({
  esbuildOptions: {
    entryPoints: ['server/main.ts'],
    outfile: 'functions/dist/main.js',
    external: ['@azure/functions-core'],
  },
  mode,
  targetDir: 'functions', // here is where npm install apply and the new root package.json
  watchDirectories: ['server', 'src'],
});