---
title: barrel文件引起循环依赖
date: 2019-04-08 14:07:48
categories:
    - 前端
tags: 
    - typescript
---

在给QDC项目升级时，碰到这样一个报错。server没问题，build时报错

{% asset_img 1.jpg This is an image %}

没有报具体错误，按照报错翻译应该是“遇到未定义的provider，通常意味着有一个循环依赖，可能是由于使用“barrel” index.ts 文件引起的”。
于是我检查项目中的 provider 使用没有问题，检查了各个模块之间的依赖也没有问题，注意到项目中写了很多index.ts文件，咋一看没有什么问题，比较难发现，但是仔细看index的引用发现barrel使用时有些坑需要注意。

### Barrel
先介绍一下Barrel，barrel是将多个模块的导出汇总到一个模块的一种方法。barrel本身是一个模块文件，可以重新导出其他模块的选定导出。

例如有三个模块
```ts
// heroes/hero.component.ts
export class HeroComponent {}
// heroes/hero.model.ts
export class Hero {}
// heroes/hero.service.ts
export class HeroService {}

// index.ts
export * from './hero.model.ts';   // re-export all of its exports
export * from './hero.service.ts'; // re-export all of its exports
export { HeroComponent } from './hero.component.ts'; // re-export the named thing

// used barrel
import { Hero, HeroService } from '../heroes'; // index is implied

// without barrel
export { Hero } from '../heroes/hero.model.ts';
export { HeroService } from '../heroes/hero.service.ts';
```

### Barrel的坑
在导入同一个模块中的文件时使用barrel可以让文件看起来更清爽，但是在使用时需要注意，因为使用不当可能会引起循环依赖。在这个DQC这个项目中，依赖了@datapi/dscomponent这个包，包在本地打包没问题，但是发成npm包被项目引用后，项目打包就报上面的错误。我简化下，还原报错原因。

目录结构：
|---service
|---|---a.service.ts
|---|---b.service.ts
|---|---index.ts
|---table
|---|---...
|---|---table.module.ts

例如如下使用
```ts
// a.service.ts
export class AService { }

// index.ts
export * from './a.service.ts';
export * from './b.service.ts';

// table.module.ts
import { AService } from '../service';
@NgModule({
    ...
    providers: [AService]
})
export class TableModule { }
```
`import { AService } from '../service';` 改为 `import { AService } from '../service/a.service.ts';` 后问题得到解决

### angular风格指南
angular团队已经不推荐barrel这种写法，在风格指南已经删除相关写法。

所以删除项目中的barrel，改为具体文件导入。

#### 参考文章
[Angular DI Error - EXCEPTION: Can't resolve all parameters](https://stackoverflow.com/questions/37997824/angular-di-error-exception-cant-resolve-all-parameters#comment80108487_37997824)
[Barrel and Circular dependency](https://github.com/angular/angular-cli/issues/7369)