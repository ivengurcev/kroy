# SEO и Open Graph

## Хранение и API

Миграция `202611130001_add_seo.sql` добавляет непустые JSONB-объекты
`sites.seo` и `pages.seo` с default `{}`. Контент блоков не меняется.

Сайт (`PATCH /api/site/seo`, полная замена; чтение `GET /api/site/settings`):

```json
{
  "name": "Клиника",
  "titleTemplate": "{page} — {site}",
  "description": "Помогаем животным",
  "imageId": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  "primaryDomain": "clinic.example.org",
  "indexable": true
}
```

Страница (`seo` в существующем `PATCH /api/pages/:pageId`):

```json
{ "title": "О клинике", "description": "Наша команда", "imageId": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "indexing": "deny" }
```

Все ключи необязательны; пустые строки/null текстовых полей и изображения
удаляют переопределение. `indexing` — `inherit` (или отсутствие), `allow`, `deny`.
`indexable` при наличии — boolean. Сервер ограничивает длины текстов, проверяет
переменные шаблона, принадлежность изображения и домена текущему сайту.
У detail-шаблона сохранение `seo` запрещено.

## Разрешение и публикация

- Название сайта для SEO по умолчанию — существующее `sites.name`.
- Обычная страница, включая главную и любой список: собственный title целиком
  заменяет автоматический; иначе применяется шаблон `{page} — {site}`.
- Description и OG-изображение: собственное значение страницы, затем значение сайта.
  Наследуемые значения в `pages.seo` не сохраняются.
- Детальный материал: title, summary, cover из записи, тип `article`;
  отсутствующие summary/cover наследуются от сайта. Список не получает метаданные карточек.
- `indexable: false` сайта сильнее `indexing: allow` страницы. Итоговый запрет —
  `noindex, follow`; остальные страницы — `index, follow`.
- Пустые description/изображения не порождают пустых meta-тегов. Без изображения
  Twitter использует `summary`, с изображением — `summary_large_image`.
- Основной домен выбирается из привязанных публичных hostname. Без явного выбора
  используется первый подходящий домен в алфавитном порядке. Удалённый явно выбранный
  домен блокирует сборку с ошибкой до исправления настройки. IP, localhost и локальные
  суффиксы не используются. Если подходящих доменов нет, нужен публичный домен.
- Публичные SEO URL всегда HTTPS. Настройка не выпускает сертификат и не меняет DNS.
- Изображения страницы/сайта копируются в `assets/seo/`, обложки материалов —
  в `assets/materials/`. Абсолютные OG URL включают версию релиза; публикация заменяет
  маркер релиза в HTML и JS обычным механизмом версионирования.
- `shared/seo.mjs` создаёт `page.meta`; SSR и SPA используют одну готовую модель
  и один список тегов. SPA заменяет только теги с `data-kroy-seo`, не накапливая их.
- SEO сайта и страниц входит в существующий fingerprint; сохранение требует новой
  публикации, успешная публикация снимает индикатор обычным сравнением отпечатков.

В корне релиза — `robots.txt` и `sitemap.xml`. Nginx отдаёт их как `text/plain`
и `application/xml`. Sitemap строится по действительно отрендеренным публичным
страницам: без удалённых, черновиков, шаблонов маршрутов, служебных URL и noindex.
Фиктивный `lastmod` не добавляется. Robots разрешает обход публичного HTML даже
при общем noindex, чтобы робот мог его прочитать; sitemap в этом случае пуст.
Robots и noindex не гарантируют мгновенного удаления URL из выдачи.

## Примеры head

Страница `/about`, без переопределений (показаны управляемые SEO-теги):

```html
<title>О нас — Клиника</title>
<link data-kroy-seo="" rel="canonical" href="https://clinic.example.org/about"/>
<meta data-kroy-seo="" name="description" content="Помогаем животным"/>
<meta data-kroy-seo="" name="robots" content="index, follow"/>
<meta data-kroy-seo="" property="og:title" content="О нас — Клиника"/>
<meta data-kroy-seo="" property="og:description" content="Помогаем животным"/>
<meta data-kroy-seo="" property="og:image" content="https://clinic.example.org/_kroy/releases/20261113000000000/assets/seo/site.webp"/>
<meta data-kroy-seo="" property="og:url" content="https://clinic.example.org/about"/>
<meta data-kroy-seo="" property="og:type" content="website"/>
<meta data-kroy-seo="" property="og:site_name" content="Клиника"/>
<meta data-kroy-seo="" name="twitter:card" content="summary_large_image"/>
<meta data-kroy-seo="" name="twitter:title" content="О нас — Клиника"/>
<meta data-kroy-seo="" name="twitter:description" content="Помогаем животным"/>
<meta data-kroy-seo="" name="twitter:image" content="https://clinic.example.org/_kroy/releases/20261113000000000/assets/seo/site.webp"/>
```

Материал `/news/new` со своей обложкой:

```html
<title>Новый материал</title>
<link data-kroy-seo="" rel="canonical" href="https://clinic.example.org/news/new"/>
<meta data-kroy-seo="" name="description" content="Краткое описание"/>
<meta data-kroy-seo="" name="robots" content="index, follow"/>
<meta data-kroy-seo="" property="og:title" content="Новый материал"/>
<meta data-kroy-seo="" property="og:description" content="Краткое описание"/>
<meta data-kroy-seo="" property="og:image" content="https://clinic.example.org/_kroy/releases/20261113000000000/assets/materials/cover.webp"/>
<meta data-kroy-seo="" property="og:url" content="https://clinic.example.org/news/new"/>
<meta data-kroy-seo="" property="og:type" content="article"/>
<meta data-kroy-seo="" property="og:site_name" content="Клиника"/>
<meta data-kroy-seo="" name="twitter:card" content="summary_large_image"/>
<meta data-kroy-seo="" name="twitter:title" content="Новый материал"/>
<meta data-kroy-seo="" name="twitter:description" content="Краткое описание"/>
<meta data-kroy-seo="" name="twitter:image" content="https://clinic.example.org/_kroy/releases/20261113000000000/assets/materials/cover.webp"/>
```

## Ограничения

У каталога и отзывов нет детальных публичных маршрутов — они не создаются ради SEO.
Редиректы дополнительных доменов, автоматизация DNS/TLS, история адресов материалов,
`lastmod` и расширенная товарная разметка не добавлены. Изображения выбираются загрузкой
через существующий ImageField; отдельной библиотеки ранее загруженных файлов нет.
Предпросмотр не является проверкой опубликованного SEO: проверять исходный HTML релиза.

## Проверки

Профильные unit-тесты (без браузера, реальные SSR head и модель SPA; API/БД
изолированы mock-объектами):

```sh
node --test shared/seo.test.mjs build/site/seoHead.test.mjs server/api/seo.test.mjs server/api/sitePublicationState.test.mjs
```

Перед эксплуатацией применить миграции обычным `bun run db:migrate` в нужной среде,
настроить основной домен и опубликовать сайт. Вручную проверить `/admin/seo`, вкладку
SEO главной/обычной страницы/списка, индикатор публикации, исходный HTML детали
материала, `/robots.txt`, `/sitemap.xml` и переходы Back/Forward. Интерфейс проверить
на ширинах 320, 375, 768, 1024 px и десктопе.
