# 发布清单（PUBLISHING）

> 本文件不随 npm 包发布（不在 `files` 里），只是操作记录。

## 0. 当前状态

| 项 | 值 |
|---|---|
| 包名 | `dsh-inline-visualizer` |
| 版本 | `2.0.0` |
| npm 占用 | 2026-10-31 查询：**404，可用** |
| 自测 | `npm test` → 197 / 197 |
| 打包 | 21 个文件（含 `test/` 与 `assets/`） |
| 目标宿主 | DSH `0.2.1-rc.5` |

## 1. 前置条件（缺一项就发不出去）

1. **GitHub 仓库已存在**，且**创建满 24 小时**（awesome 列表的 CI 会查；PR 前几分钟才建的仓库必被拒）。
2. 仓库加 topic **`dsh-plugin`**。
3. `package.json` 的 `repository` 字段必须指回该仓库 —— npm 包与列表条目靠它关联，写错就等于没发。
4. 图标用 `assets/icon-180.png`（**PNG**，180×180，透明底）。列表只收 GitHub 托管的**位图**，SVG 会被拒。

## 2. npm 发布

```sh
npm login
npm view dsh-inline-visualizer version    # 期望 404 E404，确认名字仍空着
npm test                                  # 197/197
npm pack --dry-run                        # 核对 21 个文件（test/ 与 assets/ 随包发布）
npm publish --access public
npm view dsh-inline-visualizer version    # 回显 2.0.0
```

- **名字被抢注时**：改 scoped（`@<你的昵称>/dsh-inline-visualizer`），并**同步三处**：`package.json.name`、`cordis.patch.yml` 的 `name:`、`client.js` 的 `load({ id })`。改完 `npm test` 的 `B1`/`D11` 会立刻报错兜住。
- **回滚**：发布 72 小时内可 `npm unpublish dsh-inline-visualizer@2.0.0 --force`；超过 72 小时只能发新版本覆盖。
- 发版前别忘 `version` 递增（`npm version patch|minor`）。

## 3. 本地实装验收（发布前必须做一次）

```sh
dsh plugin --profile desktop add /绝对路径/dsh-inline-visualizer
```

重启 DSH 后，让模型画一张流程图，逐条确认：

- [ ] 卡片出现在**对话里**，不是文件夹里
- [ ] 正文里没有 SVG 源码（红线：产物不进上下文）
- [ ] 「查看代码 / 下载」两个按钮可用
- [ ] 切换到深色主题后再画一张，配色跟着变
- [ ] 故意传一段坏 SVG，出现错误卡片而不是空白

## 4. 上架 awesome-dsh-plugin

仓库：[awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)

**一个 PR 只加一个文件**：`data/plugins/tonebean__dsh-inline-visualizer.yml`

```yaml
url: https://github.com/tonebean/dsh-inline-visualizer
name: tonebean/dsh-inline-visualizer
category: ui
description:
  en: Inline visualizer for DSH — the model loads a design contract first, then renders an SVG or a sandboxed HTML card in place inside the conversation, with light/dark tokens and a source/download toggle.
  zh: 对话内联可视化：模型先按需加载设计契约，再把 SVG 或沙箱 HTML 卡片就地渲染在对话里，支持深浅色令牌与源码/下载切换。
icon: https://raw.githubusercontent.com/tonebean/dsh-inline-visualizer/main/assets/icon-180.png
```

规矩（来自 `contributing.md`）：

| 规则 | 说明 |
|---|---|
| 只加条目文件 | **不要手改 README**，那两个 README 由脚本生成；手改必冲突 |
| `description` 必须属实 | 会被拿去对着源码核；不带营销词、不带最高级 |
| 含 `: ` 的值要加引号 | YAML 里冒号+空格会被解析成嵌套键 |
| 分类 | 选 `ui`（同类参照：`dsh-genui`、`dsh-visualize`、`dsh-visual`） |
| 一个 PR ≤ 3 条 | 我们只提 1 条 |
| 仓库要真能用 | 已声明 `dsh.bundle`，符合 |

可选增强：
- `screenshots.json`（1–8 张，放在仓库根，路径相对该文件）——市场详情页会展示。
- 预构建 tarball 挂 GitHub Release（不发 npm 时的备选）。

## 5. 提交后

- CI 依次查：条目数 → `dsh.bundle` → 仓库年龄 → `awesome-lint`/站点构建。
- 被打回会打 `held: author` 标签：**在同一分支 push 修复 + 留一条评论**，别反复推送。
- 合并后站点与 dsh-market 自动收录，通常一天内生效。

## 6. 一个 semver 陷阱（本包已按此选范围）

npm 的预发布规则：`0.2.2-rc.1` 这类版本，只有当范围里**存在一个同 `major.minor.patch` 且带预发布标签**的比较符时才会被匹配。

本包写的是：

```json
"engines": { "dsh": ">=0.2.1-rc.5 <0.3.0" },
"peerDependencies": { "@deepseek-ai/dsh-tools": ">=0.2.1-rc.5 <0.3.0" }
```

覆盖：`0.2.1-rc.5`…`0.2.1-rc.N`、`0.2.1`、`0.2.2`（稳定版）。
**不覆盖**：`0.2.2-rc.1`、`0.2.3-rc.1` 这类“下一个 patch 的预发布”。

→ 当宿主升到 `0.2.2-rc.x` 这一线时，**必须**把范围改成 `>=0.2.2-rc.1 <0.3.0`（或加 `||` 分支），否则用户会看到 `incompatible-version`。这条要写进升级检查清单。

## 7. 当前的阻塞项（只有账号能做）

2026-10-31 实测：

| 检查 | 结果 | 影响 |
|---|---|---|
| `npm whoami` | `ENEEDAUTH`（未登录） | 发不了 npm |
| `GET /repos/tonebean/dsh-inline-visualizer` | **404（仓库不存在）** | 推不了代码、提不了 PR、`repository` 字段指向空 |
| `git` | 2.40.0 ✅ | — |
| `gh` CLI | 未安装 | 提 PR 需走网页或装 gh |

## 8. 提 PR 的具体命令（无 gh CLI）

先把条目文件推到你的仓库（它已经在 `market/tonebean__dsh-inline-visualizer.yml`）：

```sh
# 1) fork & clone 列表仓库
git clone https://github.com/<你的GitHub>/awesome-dsh-plugin.git
cd awesome-dsh-plugin
git checkout -b add-tonebean-dsh-inline-visualizer

# 2) 只放这一个文件（文件名必须 owner__repo.yml）
cp /path/to/dsh-inline-visualizer/market/tonebean__dsh-inline-visualizer.yml \
   data/plugins/tonebean__dsh-inline-visualizer.yml

git add data/plugins/tonebean__dsh-inline-visualizer.yml
git commit -m "Add tonebean/dsh-inline-visualizer"
git push origin add-tonebean-dsh-inline-visualizer
```

然后在 GitHub 网页上打开 PR（不要动那两个 README，它们是生成的）。

装 `gh` 的话可以一条命令：

```sh
gh pr create --repo awesome-dsh-plugin/awesome-dsh-plugin \
  --title "Add tonebean/dsh-inline-visualizer" \
  --body "Adds dsh-inline-visualizer (category: ui). Repo declares dsh.bundle; npm: dsh-inline-visualizer."
```

## 9. 一次跑完的发布脚本（你登录后执行）

```sh
cd dsh-inline-visualizer
npm test && npm pack --dry-run          # 197/197（Part C 开启时 205/205），核对文件清单
npm login                                # 浏览器授权
npm publish --access public
npm view dsh-inline-visualizer version   # 应回显 2.0.0

git init && git add -A
git commit -m "feat: dsh-inline-visualizer 2.0.0"
git branch -M main
git remote add origin https://github.com/tonebean/dsh-inline-visualizer.git
git push -u origin main
git tag v2.0.0 && git push --tags
```

⚠️ 顺序建议：**先建仓库并推代码，再 `npm publish`**。因为 npm 包的 `repository` 字段要能点开——先发 npm 后建仓库，市场页面上会出现一个暂时 404 的链接。

## 10. npm 包内容（本次改为含测试）

`files` 现在包含：`index.js`、`client.js`、`cordis.patch.yml`、`guidelines/`、`locale/`、`icon.svg`、`README.md`、`LICENSE`、`CHANGELOG.md`、`test/`、`assets/`。

- `test/` 进包的好处：装上后可以直接 `npm test` 复现。
- `assets/` 进包是为了让图标在任何安装形态下都能被引用。
- `PUBLISHING.md` 与 `market/` **不进包**（只进 Git）。

