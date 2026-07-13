# Сайт RMRP Law Helper

Многостраничный лендинг в папке `site/`.

## Страницы

| Файл | Содержание |
|------|------------|
| `index.html` | Главная, hero, обзор, галерея |
| `features.html` | Подробное описание всех модулей |
| `download.html` | Скачивание и установка |
| `faq.html` | Частые вопросы |

## Локальный просмотр

```bash
npx --yes serve site -l 3456
```

Откройте http://localhost:3456

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
