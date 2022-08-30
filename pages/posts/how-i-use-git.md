---
title: 我如何使用 Git
date: 2021/07/06
description: Git 命令这么多，你用哪几个？
tag: tooling
author: 陈易生
---

# 我如何使用 Git

## 前言

核心概念：commit 和 snapshot。

commit 是代码变动的最小单位。

snapshot 由 commit 构成。

栈的数据结构。

git add ?

git commit 在当前 snaphost 创建 commit

git commit --amend 修改当前 snapshot 的最新一个 commit

git reset --hard 删除当前 snapshot 的最近 N 个 commit，且不保留代码变动

git reset --soft 删除当前 snapshot 的最近 N 个 commit，但保留代码变动

git cherry-pick 把其它 snapshot 的最新一个 commit push 到当前 snapshot 的栈顶

git checkout 跳转到另一 snapshot

git checkout --branch fork 一份当前的 snapshot，赋予一个新名字
