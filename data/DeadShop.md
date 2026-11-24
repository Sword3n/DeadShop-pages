---
tags: [deadshop, project-map, vault, structure]
aliases: [Карта DeadShop, Структура DeadShop, DeadShop — карта проекта]
created: 2026-11-24
updated: 2026-11-24
project: DeadShop
status: живой проект
---

# DeadShop — карта проекта

> [!info] Что это
> Рабочая карта магазина Deadlock: где что лежит, чем оно сделано, откуда взяты
> данные и звуки, когда что менялось и как части проекта связаны между собой.
> Файл лежит рядом с базой предметов (`data/`), потому что всё начинается с неё.

**Адрес в мире:** <https://sword3n.github.io/DeadShop-pages/> · репозиторий публикации `Sword3n/DeadShop-pages` · исходники приватно: `Sword3n/DeadShop-site`
**Текущая версия приложения:** 0.38.5 → готовится **0.39.0** (парирование, кристалл Регенератора, кейсы с гарантом, [[data/DeadShop]] обновляется на каждый релиз)

---

## 1. Что это за сайт

DeadShop — это Duolingo-подобный тренажёр **предметов магазина Deadlock**: 156 предметов, 64 урока, 3 трека. Ученик отвечает на вопросы о карточке предмета (цена, слот, ветка статов, поведение), копит **души** (внутренняя валюта) и открывает **кейсы** с иконками героев.

- Работает **без сборки и без зависимостей**: только стандартная библиотека Python и чистый JS.
- Работает **офлайн**: по `file://` и по `http://` в локальной сети.
- Данные лежат в `window.DS` — приложение не ходит в сеть за контентом.
- Публикуется только через **GitHub Pages** (серверной части в публичном виде нет).

---

## 2. Карта репозитория

```
DeadShop-site/
├── index.html          ← страница-оболочка, разметка всех экранов (1212 строк)
├── app.js              ← всё приложение: состояние, экраны, уроки, кейсы, звук (7697)
├── app.css             ← вся вёрстка и все анимации (2769)
├── core.js             ← ядро: хранилище, профиль, шифрование, маршрутизация
├── auth.js             ← вход, коды активации, подарок владельца
├── api.js              ← разговор с сервером (аккаунты, гранты, таблица лидеров)
├── sw.js               ← service worker: офлайн-оболочка, кэш «deadshop-v53»
├── manifest.webmanifest, robots.txt, 404.html
│
├── data/               ← ★ БАЗА ПРЕДМЕТОВ И КОНТЕНТ ★ (здесь лежит эта карта)
│   ├── data.js             ← 1.7 МБ: все 156 предметов + вопросы (генерируется)
│   ├── items_facts.json    ← 2.1 МБ: сырые факты о предметах из игры
│   ├── cases.js            ← 5 кейсов (Shiv, Vindicta, Viscous, Abrams, Dynamo)
│   ├── heroes.js, config.js, stat_icons.js, stat_branches.js
│   ├── shop_stats.js/json  ← снимок статов магазина для диффа патчей
│   ├── updates.js/json     ← лента «что нового»
│   ├── counter_quiz.js/json, counter_answers.js
│   └── raw/                ← сырое из игры (снимки, модели, вики, патчи)
│
├── assets/             ← картинки, иконки, звуки
│   ├── heroes/ (35 героев), icons/ (иконки предметов), stat/ (иконки статов)
│   ├── owl.svg, mascot-owl.svg, flame.svg, soul-urn-render*.png
│   ├── parry-symbol.png|webp|128.png, parry-star.png, parry-colors.css  ← НОВОЕ
│   ├── rejuvenator-crystal.svg|png|webp                                 ← НОВОЕ
│   └── sfx/  lesson-done.m4a · parry.mp3 · rejuvenator-shatter.mp3
│              rejuvenator-drop.mp3 · case-break.mp3 · case-open.mp3
│
├── tools/              ← 55 инструментов (см. §5)
├── _*.js               ← тест-сценарии браузера (движок: tools/run_tests.py)
├── dist/               ← сборочная папка (её и кладёт на Pages)
├── functions/api/shop.js← заготовка серверной функции под API магазина
├── AUDIT.md            ← журнал аудитов и дефектов
├── CHANGELOG.md, README.md, LAUNCH.md, MONETIZATION.md, FRIENDS.md
└── DeadShop-server.zip ← пакет серверной части для машины владельца
```

---

## 3. Поток данных: от игры к вопросам

```
игра Deadlock (патчи)
        │
        ▼
data/raw/items-client-<patch>-<date>.json.gz      ← снимок клиента игры
        │  tools/shopdiff.py  (сравнить два снимка)
        ▼
data/raw/items_merged.json → items_merged-patched.json
        │  tools/apply_patch.py  (наложить ручной патч поверх)
        ▼
data/items_facts.json                              ← «факты» о каждом предмете
        │  tools/gen_data.py  (детерминированно, байт-в-байт)
        ▼
data/data.js  →  window.DS.ITEMS / .LESSONS       ← предметы, уроки, вопросы
        │
        ▼
app.js (экраны, уроки, проверка ответов) → index.html/app.css
        │
        ▼
tools/make_dist.py → dist/ → tools/publish_pages.py → GitHub Pages
```

**Вершина истины по числам** — игровые файлы (`abilities.vdata`, `heroes.vdata`, снимок `items-client`). Вики — слой поверх, а не источник: `tools/sync_merge.py` правит так, чтобы вики подчинялась файлам игры. Проверка: `tools/test_data_rules.py` (35 проверок) и `tools/audit_questions.py` (2308 вопросов).

---

## 4. Источники: откуда берутся ассеты

| Что | Откуда | Ссылка / путь | Дата |
|---|---|---|---|
| Иконка парирования (звезда Spellbreaker) | CDN вики Deadlock | `https://cdn.deadlock.wiki/Spellbreaker.png` → [[assets/parry-star.png]] | 2026-11-23 |
| Цвета парирования | сняты с той же иконки | [[assets/parry-colors.css]] (`--parry-gold #FFD94E`, `--parry-impact #EA5B47`) | 2026-11-23 |
| Рендер кристалла Регенератора | CDN вики | `https://cdn.deadlock.wiki/Rejuvenator_crystal.png` (958×1440) | 2026-11-23 |
| Иконка Регенератора | CDN вики | `https://cdn.deadlock.wiki/Rejuvenator.png` (164×164) | 2026-11-23 |
| **Звук парирования** | сам Deadlock | `sounds/player/melee/shared/melee_parry_success.vsnd_c` + `sounds/mods/armor/spellbreaker/spellbreaker_proc.vsnd_c` | 2026-11-23 |
| **Звук разбивания кристалла** | сам Deadlock | `sounds/gameplay/rejuv_shatter.vsnd_c` (событие `Rejuv.Pickup`) | 2026-11-23 |
| **Звук появления кристалла** | сам Deadlock | `sounds/gameplay/rejuv/rejuv_respawn_start_01.vsnd_c` (`Rejuv.Rebirth.Start`) | 2026-11-23 |
| **Звук вскрытия кейса** | сам Deadlock | `sounds/world/breakables/tough_crate/tough_crate_break_01.vsnd_c` | 2026-11-23 |
| **Звук выигрыша** | сам Deadlock | `sounds/world/urn/soul_urn_cashin_complete_01.vsnd_c` | 2026-11-23 |
| Иконки героев | CDN вики / рендеры игры | `assets/heroes/*.png` | 2026-10-27 → 2026-11-19 |
| Иконки предметов | рендеры игры | `assets/icons/`, сборка — [[tools/build_item_icons.py]] | 2026-11 |
| Иконки статов | страницы вики героев | `assets/stat/`, [[tools/build_stat_icons.py]], [[tools/stat_icons_map.py]] | 2026-10-30 |
| Урны и души | рендеры игры | [[tools/build_urn_assets.py]] | 2026-10-27 |

> [!tip] Как достаются игровые звуки
> Инструмент [[tools/fetch_game_sound.py]] знает каталог всех 93 075 звуков игры
> (Deadlock Forge) и умеет вытащить нужный кусок по «шарду» — одним range-запросом,
> без скачивания игровых пакетов. Дальше [[tools/build_sfx.py]] режет нужный
> кусок, смешивает слои и нормализует громкость.

---

## 5. Инструменты (tools/)

### Сборка и публикация
| Инструмент | Что делает |
|---|---|
| [[tools/release.py]] | **Релиз целиком**: версии → тесты → сборка → публикация → живая проверка → пакет сервера → коммит → push |
| [[tools/make_dist.py]] | собрать `dist/` — то, что реально лежит на интернете |
| [[tools/publish_pages.py]] | выложить `dist/` в публичный репозиторий Pages |
| [[tools/serve.py]] | локальный сервер (нужен для тестов и съёмки) |
| [[tools/shot.py]], [[tools/make_shots.py]] | снимки экранов приложения |
| [[tools/record_video.js]], [[tools/make_video.py]], [[tools/frames_to_gif.py]] | видео и гифки |
| [[tools/make_icon.py]], [[tools/make_og.py]], [[tools/make_qr.py]], [[tools/icon_sheet.py]], [[tools/render_svg.py]] | графика |

### Данные
| Инструмент | Что делает |
|---|---|
| [[tools/gen_data.py]] | собрать `data/data.js` из базы предметов (детерминированно) |
| [[tools/curriculum.py]] | сгенерировать полную программу уроков |
| [[tools/update_shop.py]] | поднять сайт до текущего патча игры одной командой |
| [[tools/apply_patch.py]], [[tools/fetch_update.py]], [[tools/shopdiff.py]], [[tools/sync_merge.py]], [[tools/verify_patch.py]] | работа с патчами игры |
| [[tools/check_data_fresh.py]] | «данные ещё правдивы?» |
| [[tools/make_updates.py]] | лента «что нового» |
| [[tools/build_counter_quiz.py]] | вопросы библиотеки для владельца |

### Ассеты
| Инструмент | Что делает |
|---|---|
| [[tools/fetch_game_sound.py]] | **достать звук из игры** по имени в каталоге |
| [[tools/build_sfx.py]] | **смешать игровые звуки** в `assets/sfx/*.mp3` |
| [[tools/build_parry_assets.py]] | **иконка парирования и звезда** из CDN вики + `parry-colors.css` |
| [[tools/build_game_icons.py]] | иконки душ и Регенератора из рендеров игры |
| [[tools/build_item_icons.py]], [[tools/alpha_icons.py]] | иконки предметов под экран |
| [[tools/build_urn_assets.py]] | урна и души |
| [[tools/build_stat_icons.py]] | иконки статов |

### Сервер и почта
| Инструмент | Что делает |
|---|---|
| [[tools/dsserver.py]] | серверная часть: аккаунты, отчёты, таблица лидеров |
| [[tools/dscrypto.py]] | криптография сервера, без зависимостей |
| [[tools/dsmail.py]] | письма сервера |
| [[tools/souls_grant.py]] | выдать души всем аккаунтам сервера |
| [[tools/make_server_package.py]] | собрать `DeadShop-server.zip` для машины владельца |
| [[tools/deploy_linux.py]] | развернуть сборку на Linux-сервере |

### Проверки
`[[tools/run_tests.py]]` — все проверки разом; [[tools/run_one.py]] — одна сцена;
`[[tools/test_data_rules.py]]`, [[tools/test_dsserver.py]], [[tools/test_fetch_update.py]],
`[[tools/test_mailserver.py]]`, [[tools/test_tooling.py]]`, [[tools/test_serviceworker.js]],
[[tools/audit_questions.py]], [[tools/verify_question_fixes.py]].

---

## 6. Тесты

```bash
cd ~/Documents/DeadShop-site
python3 tools/run_tests.py            # всё разом — перед релизом обязательно
python3 tools/run_one.py _moments.js moments-out   # один сценарий
python3 tools/serve.py 8977 --root "$PWD" --bind 127.0.0.1
```

Сценарии живут в корне как `_*.js` и зарегистрированы в [[tools/run_tests.py]].

| Файл | Что проверяет |
|---|---|
| `_moments.js` | **новое**: парирование, кристалл, дубликаты, гарант кейсов, игровые звуки (26 проверок) |
| `_retention.js` | **новое**: стрик (любой урок), щиты (заработок и покупка), вехи, «следующий шаг», welcome back, полоса вехи на экране результата (38 проверок) |
| `_economy.js` | экономика душ (урок 60, идеальный 100, день 60, экзамен 60) |
| `_vault.js` | кейсы и коллекция |
| `_gift.js` | подарок 300 душ |
| `_partial.js` | частичный ответ «partly» |
| `_heads.js` | шапка карточки и подсказки |
| `_owl.js` | фоновых сов нет: ни в разметке, ни в стилях, ни на экране вопроса (сова результата осталась) |
| `_units.js`, `_tracks.js`, `_tour.js`, `_motion.js` | уроки, треки, тур, меньше движения |
| `_bugs.js`, `_audit10.js`, `_fix17.js`, `_flowtest.js`, `_featuretest.js`, `_soultest.js` | общие сценарии |
| `_servertest.js` | серверная часть |

---

## 7. Хронология релизов

| Версия | Дата | Что вошло |
|---|---|---|
| 0.36.0 | 2026-11-19 | инверсная диагностика совы, видео кристалла и парирования, лимит 20 вопросов в день, CSP и безопасность |
| 0.37.0 | 2026-11-19 | стая из 5 сов, хранилище кейсов, серверный подарок `grant_souls` |
| 0.38.0 | 2026-11-19 | правило частичного ответа, шапка карточки прячет только часть, окно подсказки |
| 0.38.1 | 2026-11-19 | плитка «partly» на экране итогов |
| 0.38.2 | 2026-11-19 | стая под шапкой урока, локальный подарок 300 душ |
| 0.38.3 | 2026-11-19 | подарок в ленте «что нового» |
| 0.38.4 | 2026-11-19 | релиз без оставшегося мусорного файла |
| 0.38.5 | 2026-11-19 | новая экономика душ (урок ≥ 60 без Регенератора) |
| **0.39.0** | **2026-11-24** | **парирование с символом и звуком игры · кристалл Регенератора · кейсы: дубликаты → души, гарант на 20 шкаст, анимация CS2 в стилистике Deadlock** |
| 0.39.1 | 2026-11-24 | шард Регенератора крупнее и честнее по цвету; тот же шард на экране лимита; текст про экономику душ приведён в порядок («шестьдесят», а не «два») |
| **0.40.0** | **2026-11-24** | **фоновая стая сов убрана из урока: разметка, стили и код — всё; сова результата и знак магазина остались** |
| **0.41.0** | **2026-11-24** | **раунд удержания: стрик держится любым законченным уроком · щиты (каждые 7 дней + покупка за 200 душ) · 10 вех с полкой в профиле и полосой на экране результата · блок «следующий шаг» · «Welcome back» без упрёка** |

Правила релиза: `APP_VERSION` в [[app.js]] и `ds-version` в [[index.html]] должны совпадать,
кэш [[sw.js]] переименовывается (`deadshop-v57` для 0.41.0), `tools/release.py` проверяет это сам.

---

## 8. Три новых момента (0.39.0)

### Парирование (момент дневного лимита)
- Разметка: `#parry-fx` → `.parry-veil`, `.parry-core` (`.parry-halo`, `.parry-burst`, `.parry-wave×2`, `.parry-star`, `.parry-sparks×12`), `.parry-word` «PARRY».
- Символ и цвета — из игры: [[assets/parry-star.png]] (золотая звезда Spellbreaker) и [[assets/parry-colors.css]].
- Звук — из игры: `assets/sfx/parry.mp3` = `melee_parry_success` + `spellbreaker_proc`.
- Код: `showLimitScreen()` в [[app.js]] (кликер по лимиту → анимация → модалка через 1250 мс), `sfxParry()`.
- В режиме «меньше движения» остаётся статичная звезда с кольцом и словом.

### Кристалл Регенератора
- Разметка: `#crystal-fx` → `.crystal-pool`, `.crystal-stage` (`.crystal-halo`, `.crystal-img`, `.crystal-shards×12`), `.crystal-word`.
- Шард нарисован по игровому рендеру: [[assets/rejuvenator-crystal.svg]] (цвета взяты пипеткой из рендера игры: ядро `#75F15B`, камень `#2E311E`). Тот же шард стоит на экране дневного лимита.
- Звуки — из игры: `assets/sfx/rejuvenator-drop.mp3` (падение) и `assets/sfx/rejuvenator-shatter.mp3` (разбивание).
- Код: `crystalAppear()` — падение 0–0.7 с, висение, разбивание на 1.9 с, гаснет на 3.1 с.

### Фоновая стая (убрана в 0.40.0)
- Было: `#think-bg` → `#think-flock` (4 малые совы) + `#think-owl` (большая, 5 настроений) + `.think-glow`; ~90 строк CSS-анимаций; JS `setupOwls()`, `owlTop()`, `owlMood()`, `OWL_MOODS`, `OWL_SMALL`.
- Стало: ничего. Во время урока фон — это сам вопрос.
- Осталось: сова результата (`assets/owl.svg`, класс `.result-owl`) и знак магазина в шапке/профиле.
- Проверка: [[_owl.js]] — стаи нет ни в разметке, ни в стилях, ни на экране; сова результата на месте.

### Кейсы
- Дубликат → души: `data/cases.js` → `dupSouls` (25 базовых + 5 за ступень редкости: common 30, uncommon 35, rare 40, very rare 45, legendary 50, contraband 55).
- Гарант: `pity: 20` — после 20 кейсов одного вида без самого редкого предмета следующий выдаёт самый редкий принудительно. Счётчик `S.casePity[id]` живёт в профиле.
- Анимация: `.case-stage` с классами `rattle` → `charge` → `burst` → `reveal` (+`top` для самого редкого): тряска, сгущение света, разрыв, столб света, кольцо, искры, вспышка, выход предмета.
- Звуки — из игры: `assets/sfx/case-break.mp3` (разрыв) и `assets/sfx/case-open.mp3` (выигрыш, вместе с аккордом редкости).

---

## 8.1 Раунд удержания (0.41.0)

Владелец попросил «сделать сайт привлекательнее и повысить шанс, что пользователь останется».
Исследование (блог Duolingo, uxmag, arxiv 2411.12083 / 2512.08551) дало четыре правила, и все четыре
перенесены в код:

| Правило из исследования | Что сделано в магазине |
|---|---|
| стрик не должен зависеть от дневной цели (+40 % недельных стриков, +3,3 % D14 retention) | `streakUpdate(day)` — стрик держит **любой законченный урок**, а не «50 % правильных» |
| способ починить стрик возвращает уходящих (+18 %) | щиты: каждый 7-й день подряд — 1 щит (макс. 3), щит тратится автоматически; при слишком большом разрыве щиты **сохраняются** |
| путь назад должен быть без давления (pressure/enticing/trapping — вредны) | покупка щита за 200 душ (`buyShield`), «Welcome back — N days away», подсказка чипа «streak is alive» |
| «собирательство» и мгновенная обратная связь = длинные сессии | 10 вех (`MILESTONES`), полка в профиле (`#ms-grid`), полоса на экране результата (`#result-ms`) |
| кнопка с обещанием лучше, чем «Continue» | блок «следующий шаг» на главной (`#home-next`) с глаголом действия |

- Состояние: `S.shields`, `S.shieldDay`, `S.milestones` (в [[app.js]]).
- Код: `streakUpdate`, `shieldsHave`, `buyShield`, `renderShieldBuy`, `MILESTONES`, `milestoneState`,
  `checkMilestones`, `renderResultMilestones`, `nextStep`/`renderNextStep`, `detectAway`/`renderWelcome`.
- Разметка: [[index.html]] → `#home-welcome`, `#home-next` (+`#home-next-t`, `#home-next-s`), `#set-shields`,
  `#buy-shield`, `#ms-grid`, `#ms-note`, `#result-ms`.
- Проверка: [[_retention.js]] — 38 проверок; в реестре дефектов это раунд 19 в [[AUDIT.md]].

---

## 9. Серверная часть

- Код: [[tools/dsserver.py]], [[tools/dscrypto.py]], [[tools/dsmail.py]]; пакет — `DeadShop-server.zip`.
- API магазина **мёртв** — публикация только через GitHub Pages.
- Подарок владельца существует в двух видах: **серверный** (`grant_souls`/`grant_id`, кнопка в столе владельца, [[tools/souls_grant.py]]) и **локальный** (300 душ в профиле браузера, флаг `S.giftTaken`).
- Ключ владельца и SMTP — только в localStorage или в файлах с правами 0600. Секретов в репозитории нет.
- VPS/домен/Boosty/почта — в зоне владельца.

---

## 10. Связи между частями

```
[[index.html]] ── подключает ──▶ [[app.js]] ──▶ [[core.js]] → localStorage
                      │             │  ├─▶ [[auth.js]] → [[api.js]] → сервер
                      │             │  └─▶ [[data/data.js]] (window.DS)
                      │             │
[[app.css]] ──────────┘             ├─▶ [[assets/sfx/*]]  (звук через <audio>)
                                    ├─▶ [[assets/parry-star.png]], [[assets/rejuvenator-crystal.svg]]
                                    └─▶ [[sw.js]] (офлайн, кэш deadshop-v57)

[[tools/release.py]] → тесты → [[tools/make_dist.py]] → dist/ → [[tools/publish_pages.py]] → Pages
[[tools/gen_data.py]] ← data/raw/ ← [[tools/apply_patch.py]] ← снимки игры
[[tools/build_sfx.py]] ← [[tools/fetch_game_sound.py]] ← каталог Deadlock Forge
[[tools/build_parry_assets.py]] ← CDN вики (cdn.deadlock.wiki)
```

- **Состояние** живёт в `S` ([[app.js]]), сохраняется целиком через `save()` в localStorage; ключ `storageKey()` зависит от трека/профиля.
- **window.DS** — только чтение данных для отладочных сценариев; [[app.js]] сам их не меняет.
- **API для тестов** — `window.DS_TEST`: `souls`, `awardSouls`, `openCase`, `drawFromCase`, `casePity*`, `crystalAppear`, `showLimitScreen`, `state()`, `save()`, `show()` и другое.

---

## 11. Правила проекта (нарушать нельзя)

1. Без сборки, без зависимостей, офлайн; работа по `file://` и по LAN `http://`.
2. UI приложения — **английский**; отчёты владельцу — **русский**.
3. Перед публикацией — **полный прогон** `python3 tools/run_tests.py` (ALL GREEN).
4. Источник истины по числам — **игровые файлы**, не вики.
5. Никаких секретов в репозитории.
6. **Временные скрипты нельзя оставлять в корне во время `tools/release.py`** — они попадают в коммит и роняют тестовый прогон. Удалять через `mavis-trash`.
7. Версия (`APP_VERSION` + `ds-version`) и кэш service worker меняются **вместе** с релизом.
8. Каждое изменение поведения закрывается тестом; дефекты пишутся в [[AUDIT.md]].

---

## 12. Шпаргалка: куда что менять

| Хочу | Файл |
|---|---|
| Новый вопрос или урок | [[tools/curriculum.py]] → [[tools/gen_data.py]] → `data/data.js` |
| Правила урока, ответы, частичный ответ | [[app.js]] (`grade`, `SOUL_RULES`) |
| Экран, разметка | [[index.html]] + [[app.css]] |
| Звук | `assets/sfx/` + `sfxFile()` в [[app.js]]; источник — [[tools/fetch_game_sound.py]] |
| Кейсы, дубликаты, гарант | [[data/cases.js]] + `openCase()` в [[app.js]] |
| Экономика душ | `SOUL_RULES` и `awardSouls()` в [[app.js]] |
| Стрик, щиты, вехи, следующий шаг | [[app.js]] (`streakUpdate`, `buyShield`, `MILESTONES`, `nextStep`) |
| Публикация | [[tools/release.py]] (сам всё делает) |
| Сервер | [[tools/dsserver.py]] + `DeadShop-server.zip` |

---

## 13. Известные грабли

- **Headless Chrome просит «меньше движения»** — в нём все анимации схлопываются. Чтобы снять кадр анимации, в сценарии съёмки надо выключить правило `@media (prefers-reduced-motion: reduce)` (или снять класс `reduce-motion`).
- **Звук в headless Chrome вешает `--virtual-time-budget`** — снимок делается без проигрывания звука (заглушить `window.Audio`).
- **Wiki закрыт Cloudflare**: `curl` и в-app Browser не проходят. CDN `cdn.deadlock.wiki` открывается, но **только с браузерным User-Agent**.
- **API магазина мёртв**, публикация только через GitHub Pages; `publish_pages.py` иногда падает на push — просто повторить.
- `rm` в окружении заблокирован — удалять через `/Users/alexandr/.minimax/bin/mavis-trash -- "<путь>"`.
- `ffmpeg` нет в PATH; статическая копия лежит в `imageio_ffmpeg` — [[tools/build_sfx.py]] ищет её сама.

---

## Связанные заметки

- [[AUDIT.md]] — журнал аудитов и дефектов
- [[CHANGELOG.md]] — история изменений
- [[README.md]] — как запустить и как устроено
- [[LAUNCH.md]] — план запуска и публикации
- [[MONETIZATION.md]] — подписка, подарок, цены
