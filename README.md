# 猛猛背单词

一个给自己用、也希望能帮到其他英语学习者的单词听写工具。

开发者：爆汁白桃儿 + Codex

应用提供计划听写、词本浏览、错词统计和学习记录。它在本机运行，不需要注册账号；学习进度保存在本机，可以导出备份文件。

## 功能

- 从内置词本中选择词汇，或用测试词本体验流程。
- 设置每天学习的份数，生成个人听写计划。
- 听音输入单词；每题有固定作答时间，到时自动提交，空答案计为错误。
- 查看每日听写结果、单词释义、自己的输入和正确答案。
- 在错词本查看累计错误次数和历史作答记录。
- 浏览内置词本与单词详情。
- 导出、恢复学习数据备份。

错词会按计划进入后续复习；未完成任务会顺延。具体安排由应用根据词本和份数自动计算。

## 内置词本与资料来源

- **NGSL 高频词**：词表来自 [New General Service List 官网](https://www.newgeneralservicelist.com/)。英汉释义和音标通过 [ECDICT](https://github.com/skywind3000/ECDICT) 查询补充，英美音标数据还使用 [ipa-dict](https://github.com/open-dict-data/ipa-dict)、[Britfone](https://github.com/JoseLlarena/Britfone) 和少量 [Wiktionary](https://en.wiktionary.org/) 条目。详细说明和对应许可见 [`public/data/`](public/data/) 中的来源说明与许可证文件。
- **高考英语 3500、四级词汇、六级词汇、雅思词汇真经**：词表及其释义、音标来源于 [lilinji/English](https://github.com/lilinji/English) 项目。原始项目对其资料的授权和使用说明请以该项目当前页面及具体词表说明为准；本项目在 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) 中保留来源记录。
- **测试词本**：用于快速体验听写流程的 10 个测试单词。
- **产品 Logo**：由维护者提供，并确认已获公开使用授权。

第三方词库、音标数据和 Logo 有各自的来源及权利条件，不会因为本项目的代码许可而自动改变。请查看 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) 和词库目录中的原始许可文件。

## 运行

需要 macOS 和 Node.js 18 或更新版本，不需要安装 npm 依赖。

1. 下载或克隆仓库。
2. 双击 `run.command`。
3. 如果已安装 Google Chrome，会尝试以独立窗口打开；否则使用系统默认浏览器。

也可以在终端中进入项目目录并运行：

```sh
node server.mjs
```

然后访问 <http://127.0.0.1:38917>。

## 学习数据与备份

学习进度默认保存在：

```text
~/Library/Application Support/WordLoop/study.json
```

数据保存在本机，不依赖浏览器缓存，因此清理浏览器数据不会清除学习进度。换电脑前请在应用的“备份与同步”页面导出 JSON 文件，再在另一台电脑上恢复。开发时可通过 `WORDLOOP_DATA_DIR` 环境变量指定数据目录。

## 网络与离线使用

听写、词本浏览和本地学习记录可以离线使用。缺少释义时，查词补全功能会请求 [Free Dictionary API](https://dictionaryapi.dev/)，因此该功能需要网络连接。

## 许可

应用代码许可请见 [`LICENSE`](LICENSE)：允许非商业目的使用，但不授予修改、创作衍生作品或再分发应用代码的权利。因此本项目是公开可查看的个人作品，不属于标准意义上的开源软件。第三方词库、音标资料、Logo 等内容适用各自的授权条件，详见 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。本项目不承诺持续维护或提供技术支持。

## 项目信息建议

- 仓库名称：`mengmeng-word-practice`
- 仓库简介：`本地运行的英语单词听写练习工具，支持词本浏览、错词记录和学习进度查看。`
- GitHub Topics：`vocabulary`、`english-learning`、`dictation`、`macos`、`study-tool`

---

Made by **爆汁白桃儿 + Codex**.
