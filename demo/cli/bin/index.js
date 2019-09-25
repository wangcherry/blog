#!/usr/bin/env node

const envinfo = require('envinfo');
const program = require('commander');
const inquirer = require('inquirer');
const fse = require('fs-extra');
const execSync = require('child_process').execSync;
const spawn = require('cross-spawn');
const path = require('path');

program
  .version(require('../package').version)
  .usage('<command> [options]');

program
  .command('info')
  .description('Print debugging information about your environment')
  .action(() => {
    envinfo
      .run(
        {
          System: ['OS', 'CPU'],
          Binaries: ['Node', 'Yarn', 'npm'],
          Browsers: ['Chrome', 'Edge', 'Firefox', 'Safari'],
          npmPackages: ['envinfo'],
          npmGlobalPackages: ['@sharkr/cli'],
        },
        {
          showNotFound: true,
          duplicates: true,
          fullTree: true,
        }
      )
      .then(console.log);
  });

program
  .command('init <app-name>')
  .description('Init a new react project')
  .option('-t, --type <type>', 'Set template type')
  .option('-y, --useYarn', 'Use yarn install (default use npm)')
  .action(async (appName, cmd) => {
    const options = cleanArgs(cmd);
    // 获取代码前可以进行一些特性对话
    let templateGit;
    if (options.type) {
      templateGit = `git@git.yx.netease.com:sharkr/react-template/${
        options.type
      }.git`;
    } else {
      const { type } = await inquirer.prompt([
        {
          name: 'type',
          type: 'list',
          message: `Select template type:`,
          choices: [
            { name: 'full, include server & web', value: 'full' },
            { name: 'web, only web template', value: 'web' },
            { name: 'npm, include server & web for package', value: 'npm' }
          ],
          default: 'full',
        },
      ]);
      templateGit = `git@git.yx.netease.com:sharkr/react-template/${type}.git`;
    }
    // clone代码
    execSync(`git clone ${templateGit} ${appName}`, { stdio: 'ignore' });
    const appPath = path.resolve(appName);
    process.chdir(appPath);
    fse.removeSync(path.join(appPath, '.git'));

    // 这里可以对模板做一下处理

    // 根据配置项install
    if(options.useYarn) {
      spawn('yarn', ['install'], { stdio: 'inherit' });
    }else {
      spawn('npm', ['install'], { stdio: 'inherit' });
    }
  });

program.parse(process.argv);

function camelize(str) {
  return str.replace(/-(\w)/g, (_, c) => (c ? c.toUpperCase() : ''));
}
function cleanArgs(cmd) {
  const args = {};
  cmd.options.forEach(o => {
    const key = camelize(o.long.replace(/^--/, ''));
    if (typeof cmd[key] !== 'function' && typeof cmd[key] !== 'undefined') {
      args[key] = cmd[key];
    }
  });
  return args;
}