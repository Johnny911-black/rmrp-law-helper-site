# Сайт RMRP Law Helper

Многостраничный лендинг в папке `site/`.

## Страницы

| Файл | Содержание |
|------|------------|
| `index.html` | Главная, hero, обзор, галерея |
| `features.html` | Подробное описание всех модулей |
| `laws.html` | Законы и правила: поиск, вкладки, полный текст |
| `download.html` | Скачивание и установка |
| `updates.html` | Обновления приложения |
| `faq.html` | Частые вопросы |

## Локальный просмотр

```bash
npx --yes serve site -l 3456
```

Откройте http://localhost:3456  
Раздел законов: http://localhost:3456/laws.html

## Данные для раздела «Законы»

Корпус копируется в `site/data/` из локальной папки `data/` (после парсинга форума).

Структура **разбита на подпапки** (лимит GitHub: не больше 100 файлов за одну загрузку через веб):

| Папка | Содержимое | ~файлов |
|-------|------------|---------|
| `site/data/core/` | Реестры, manifest, meta, `all_articles` / `all_rules` | &lt; 15 |
| `site/data/laws/` | Кэши и индексы законов (`*_articles.json`, `*_index.json`) | &lt; 70 |
| `site/data/rules/` | Кэши и индексы правил (`*_rules.json`, `*_index.json`) | &lt; 60 |

На GitHub загружайте по очереди: `site/data/core`, затем `site/data/laws`, затем `site/data/rules`.

```bash
# Только парсинг (без сборки exe)
npm run parse:all

# Скопировать уже спарсенные данные на сайт
npm run site:data

# Пересобрать умный поиск (синонимы) для сайта
npm run site:search

# Парсинг + копия на сайт + поиск (без сборки exe)
npm run site:publish
```

Умный поиск на сайте те же синонимы, что в приложении (`убил` → `убийство`, `dm` → deathmatch и т.д.).
При `npm run build` / `build:setup` / `build:portable` в конце автоматически вызывается `site:data` — актуальный кэш из `data/` попадает в `site/data/`.

В репозиторий коммитятся файлы `site/data/{core,laws,rules}/` (публичный срез для GitHub Pages). Корневой `data/` по-прежнему в `.gitignore`.

## Перед публикацией

Отредактируйте `config.js` — укажите `githubUser` и `githubRepo`.

## Скриншоты

Папка `images/` — реальные скриншоты приложения. Можно заменить своими:

- `screenshot-app.png` — hero
- `screenshot-binder.png` — биндер
- `screenshot-laws.png` — карты
- `screenshot-article.png` — экспорт workspace
- `screenshot-settings.png` — настройки

## Деплой

GitHub Actions: `.github/workflows/deploy-pages.yml`  
Инструкция: [docs/GITHUB_PAGES_SETUP.md](../docs/GITHUB_PAGES_SETUP.md)
