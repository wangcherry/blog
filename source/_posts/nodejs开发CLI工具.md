---
title: nodejs开发CLI工具
date: 2019-09-25 09:34:34
categories:
    - 前端
tags: 
    - node
    - cli
---

在没有@vue/cli、create-react-app、@angular/cli这样子的脚手架时你是否遇到过一个文件一个文件的去拷贝老项目的配置文件？在开始使用脚手架后是否发现当前的脚手架不能完全贴合实际的业务场景？最近，我们组由angular框架转换成react框架，开发了一套完整的cli工具。写下这篇文章作为一个记录，希望大家看到后都能实现一个属于自己的脚手架工具。

CLI（command-line interface，命令行界面）是指可在用户提示符下键入可执行指令的界面，它通常不支持鼠标，用户通过键盘输入指令，计算机接收到指令后，予以执行。

## 准备工作
主要分为以下几步：
- 新建一个项目并初始化package.json
- 开发前准备
- 获取参数

### 新建一个项目并初始化package.json
```base
    mkdir cli & cd cli
    npm init
```

在package.json里配置命令，bin项用来指定各个内部命令对应的可执行文件的位置。这里 **sr** 就是我的命令了
```json
  "bin": {
    "sr": "./bin/index.js"
  }
```

### 开发前准备
在bin文件夹下创建一个index.js

./bin/index.js
```js
#!/usr/bin/env node

console.log('my cli！');
```
将命令链接到全局：
```base
    npm link
```
执行命令后，my-cli会根据package.json上的配置，**sr** 命令被链接到全局。[更多npm link知识](https://docs.npmjs.com/cli/link)

{% asset_img npm-link.png This is an image %}

这时在任何目录执行 **sr** 将会看到：

{% asset_img sr.png This is an image %}

到这里就可以开始开发 cli 了，./bin/index.js 的更改会实时同步到全局命令的。

### 获取参数
有了命令，那么具体子命令怎么执行呢？例如我输入 **sr info** 时希望能打印当前环境信息。效果如下：

{% asset_img info.png This is an image %}

首先，我们需要获取参数，因为知道是 info 命令，才能执行打印环境信息操作。那么怎么获取命令行参数呢？下面介绍用原始方法和使用模块获取命令行参数：

#### 原始方法获取命令参数
命令行参数可以用系统变量 process.argv 获取。（打印当前环境信息用 [envinfo](https://www.npmjs.com/package/envinfo)）

./bin/index.js
```js
#!/usr/bin/env node

const envinfo = require('envinfo');

if(process.argv[2] === 'info' ) {
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
}else {
    console.log('my cli！')
}
```

#### 使用模块commander获取命令参数
[commander](https://www.npmjs.com/package/commander)这个模块是node.js命令行界面的完整解决方案，不仅有着强大的参数解析功能，还提供了用户命令行输入，是cli开发的一个很好选择。

./bin/index.js
```js
#!/usr/bin/env node

const envinfo = require('envinfo');
const program = require('commander');


program
  .version(require('../package').version)
  .usage('<command> [options]');

program
  .command('info')
  .description('Print debugging information about your environment')
  .option('-s, --show-not-found', 'show not found package')
  .action((cmd) => {
    const options = cleanArgs(cmd);
    console.log(options)
    envinfo
      .run(
        {
          System: ['OS', 'CPU'],
          Binaries: ['Node', 'Yarn', 'npm'],
          Browsers: ['Chrome', 'Edge', 'Firefox', 'Safari'],
          npmPackages: ['envinfo'],
          npmGlobalPackages: ['@sharkr/cli', 'xxx'],
        },
        {
          showNotFound: options.showNotFound,
          duplicates: true,
          fullTree: true,
        }
      )
      .then(console.log);
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
```
- command：子命令
- description：命令描述
- option：配置项
- action：命令对应要执行的方法
- cleanArgs 函数将 option 处理成键值对，方便使用
- program.parse(process.argv) 解析命令参数

## init命令
经过上面的准备工作，cli 已经可以获取命令和参数了，那么接下来就可以开始写命令对应的操作了。作为项目的脚手架，第一步当然是初始化一个项目。分为以下两步完成：
- 准备模板
- 编写init命令

### 准备模板
我们的模板都放在 gitlab 维护，init 时从 gitlab clone，这么做主要是考虑到我们模板比较多，且前期模板不稳定，避免模板更新时需要频繁更新 cli。多个模板可以通过配置项来选择。

### 编写init命令
以下是省去很多校验和兼容处理的一个init命令
```js
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
      // 虚构的git模板地址
      templateGit = `git@github.com:sharkr/react-template/${
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
      // 虚构的git模板地址
      templateGit = `git@github.com:sharkr/react-template/${type}.git`;
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
```
执行 **sr init my-app**

{% asset_img init.gif This is an image %}

init 命令提供一个配置项 type 设置需要拉取的模板类型，我们可以执行 **sr init my-app** 初始化项目，没设置 type 时需要选择模板类型。执行 **sr init my-app -t full** 时直接拉取full模板。
在实际开发中，可以根据模板的用途做更多的特性选择和处理。

## 小结：
在命令行工具的开发过程中，使用commander、inquirer和chalk等一些npm插件，可以很好的完成命令行工具的开发，并且可以达到很棒的效果，感兴趣的话，赶快试试吧，做一款自己的命令行工具。