# 第三方资料与授权说明

本项目包含第三方词表、释义和发音资料。以下说明用于记录来源；各项资料仍分别受其来源项目或权利人的许可约束。应用代码的许可不覆盖这些第三方资料。

## 内置词表

### NGSL 高频词

- 词表来源： [New General Service List 官网](https://www.newgeneralservicelist.com/)。
- 词条释义及音标查询：主要通过 [ECDICT](https://github.com/skywind3000/ECDICT) 查询。
- 部分音标补充： [open-dict-data/ipa-dict](https://github.com/open-dict-data/ipa-dict)、[Britfone](https://github.com/JoseLlarena/Britfone) 和少量 [English Wiktionary](https://en.wiktionary.org/)。
- 处理及许可记录： [`public/data/NOTICE-ECDICT.md`](public/data/NOTICE-ECDICT.md)、[`public/data/NOTICE-IPA.md`](public/data/NOTICE-IPA.md)、[`public/data/NOTICE-WIKTIONARY.md`](public/data/NOTICE-WIKTIONARY.md)，以及同目录中的 `ECDICT-LICENSE.txt`、`IPA-DICT-LICENSE.txt`、`BRITFONE-LICENSE.txt`。

### 高考英语 3500、四级、六级、雅思词汇真经

这些词表及其释义、音标来源于 [lilinji/English](https://github.com/lilinji/English)。本项目对内容做了整理并转换为应用使用的数据格式。请在使用或再次分发这些词表前，查阅上游项目当时适用的授权说明及相关具体词表说明，并遵守其要求。

## Logo

应用 Logo 由项目维护者提供；维护者确认已获得公开使用授权。该确认不构成对 Logo 的独立再授权。需要单独复用 Logo 时，请遵循其原始授权条件。

## Free Dictionary API

缺少释义时，应用可请求 [Free Dictionary API](https://dictionaryapi.dev/)。这是运行时的可选网络服务，不随本仓库复制其服务端内容；使用该服务时还应遵循其当前服务条款。

## 上游资料变更

第三方项目可能更新内容、许可或链接。本文件记录本项目整理词库时使用的来源；如与上游最新许可或特定数据文件说明不一致，应以适用于该资料的上游授权条件为准。
