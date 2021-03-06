---
title: 为什么我更偏好 CLI？
date: 2021/06/18
description: Do not go gentle into that Graphical UI.
tag: tooling
author: 陈易生
---

# 为什么我更偏好 CLI？

![interstellar](/images/cli-gt-gui/interstellar.jpg)

> Do not go gentle into that good night. -- The poem from Interstellar, originally by Dylan Thomas.

你的系统有一套 API，现在你想搭建 UI 与系统进行交互，你有两个选择：在终端使用的 [CLI](https://en.wikipedia.org/wiki/Command-line_interface)，和在浏览器或桌面使用的 [GUI](https://en.wikipedia.org/wiki/Graphical_user_interface)。你更偏好哪个？

这取决于系统的类型。对于面向完全非技术人员的系统，GUI 可能更适合；但对于只面向工程师的系统、还处在早期的系统、或是基于成熟开源软件封装形成的系统，CLI 是个更好的选择，因为 CLI 相比 GUI 有几大优势。

## 更容易自动化

CLI 可以很容易地在各种脚本中被调用，例如在 CI 中执行 `git clone` 把代码下载下来，用 `make test` 跑个测试，等等。此外，CLI 还可以很方便地和已有的 CLI 组合，发挥更大的作用，比如把 CLI 的输出 `cat` 出来然后 `grep`。

GUI 完全没有这个能力。用户要想自动化，只能直接去调 API 了。

## 更高的使用门槛

CLI 更高的使用门槛带来的是：

- 更少的非理想用户。不愿意看文档学习如何配环境、跑示例命令的用户，不会是你系统的理想用户，不妨通过 CLI 这一关把他们筛除掉。
- 更少的常识性问题。通过筛选的用户，在看文档的过程中，自然会对系统的基本概念有初步了解，在使用中更少问可以用 RTFM（READ THE F\*\*\*ING MANUAL!）回答的问题。
- 更少的无意义建议。只有通过筛选的用户才有资格提意见，有效避免了没头没脑的指手画脚。

举个例子。我在 Tubi 的时候，要想上线一个 [A/B 实验](https://code.tubitv.com/experimentation-at-tubi-82f35afe2732)，需要把一个实验配置仓库从 GitHub 上 clone 下来，去里面增加一个配置文件，提交 pull request，等待管理员 merge，通过 CI 才能被部署。我问 CTO 马老师，为什么不弄一个 GUI，这不是很简单吗？马老师说，我就是不想让这个事情变得那么简单，我想让大家都耐着性子看完文档，了解 A/B 实验的概念和公司内的最佳实践，最后才在有监督的情况下，提交实验请求。

## 更快的迭代

为什么 CLI 比 GUI 的迭代更快？因为 CLI 可以完全由搭建系统的后端工程师进行开发，而 GUI 的开发还需涉及产品经理、设计师和前端工程师。在大多数公司，产品经理、设计师、前端工程师和后端工程师这 4 个角色会由 >= 3 个高度异构的人来承担，引入很高的沟通成本。

## 更少的抽象

CLI 相比 GUI，在 API 的基础上引入了更少的抽象。更少的抽象带来的是：

- 更容易探索的接口实现。我在使用 `git add` 的过程中，想要了解一下它的实现。我可以大胆猜测 Git 的代码中要么有个名为 `add` 的函数定义，要么有个名为 `add` 的文件。果不其然，我很容易就找到了 [add.c](https://github.com/git/git/blob/master/builtin/add.c)，开始读源码。如果我使用的是 Git 的 GUI，我很难意识到 `add` 这个普通的英文单词居然是个专有操作的名字，除非 GUI 给了明确的提示，也自然更难顺着名字往下猜它的源码了。
- 更容易访问的文档。使用 `--help` 后缀来探索 CLI 的使用文档已经成了惯例，但 GUI 的使用文档只能通过高超的 UI/UX 设计来隐性展现，或者单独部署一个文档网站。
- 更容易搜索的报错信息。CLI 大可一股脑地把 API 的报错信息原封不动地返回，反正用户在终端的注意力本身就只被这个 CLI 所完全占有。而 GUI 需要考虑到用户的视觉习惯，往往不能直接在用户界面上展现出完整的错误栈。因此，我们可以很容易在网上搜索 CLI 的报错信息，而问 GUI 上的报错信息往往要截图、查网络，更难一些。

## 总结

在了解 CLI 的优势后，我们一起回顾文章开头提到的几类更适合 CLI 的系统。

- 只面向工程师的系统。~~因为工程师不需要 GUI。~~
- 还处在早期的系统。因为早期系统的需求和 API 可能会频繁变化，GUI 因此也常常变化，结果就是协作的多方都被高昂的沟通成本弄得很累。
- 基于成熟开源软件封装形成的系统。因为成熟开源软件往往自带经过考验的 GUI，性能和维护都有保障，就没必要自己开发了。系统与系统间 GUI 的一致性不是一个很重要的因素。

Do not go gentle into that Graphical UI.

---
