console.log(`Kroy — команды проекта

Разработка
  bun run dev                        Запустить PostgreSQL, Kroy и Nginx в Compose
  bun run dev:bg                     Запустить Compose в фоне
  bun run dev:down                   Остановить Compose без удаления данных
  bun run dev:logs                   Следить за логами Compose
  bun run dev:status                 Показать состояние сервисов
  bun run dev:run <script> [...args] Выполнить скрипт внутри app
  bun run dev:restart app            Перезапустить только app, nginx или db
  bun run dev:rebuild app            Пересобрать только app, nginx или db
  bun run vyaz:build                 Собрать административное приложение Vyaz (production)
  bun run vyaz:serve                 Запустить Vyaz на порту 3000 (production)
  bun run parts:generate             Обновить реестр запчастей из JSDoc

База данных
  bun run db                         Применить миграции PostgreSQL через dbmate
  bun run db:migrate                 Применить ожидающие миграции
  bun run db:status                  Показать состояние миграций
  bun run db:rollback                Откатить последнюю миграцию (с подтверждением)
  bun run db:seed                    Заполнить локальную базу тестовыми данными (с подтверждением)

Сайты
  bun run site:create vet vet.example.test "Семейный ветеринар"
                                     Создать сайт, домен и главную страницу
  bun run site:list                  Показать все сайты
  bun run site:info demo             Показать сведения о сайте
  bun run site:domain:add demo second-demo.localhost
                                     Добавить домен сайту
  bun run site:domain:remove demo second-demo.localhost
                                     Удалить домен сайта

Публикация
  bun run site:build demo            Подготовить статическую версию сайта
  bun run site:publish demo          Собрать и опубликовать новую версию
  bun run site:releases demo         Показать сохранённые релизы сайта
  bun run site:rollback demo <release-id>
                                     Переключить сайт на сохранённый релиз
  bun run preview                    Проверить и перезагрузить Nginx Kroy
  bun run preview:reload             Перезагрузить Nginx Kroy
  bun run preview:validate           Проверить nginx.conf экземпляра Kroy

Удалённое управление (нужен KROY_REMOTE_HOST)
  bun run remote <script> [...args]  Выполнить скрипт Kroy на VPS
  bun run deploy app                 Развернуть приложение на VPS через Ansible
  bun run deploy site <slug>         Собрать и опубликовать сайт на VPS

Быстрые сценарии
  Изменил запчасть                   bun run vyaz:build; для сайта: bun run site:build <slug>
  Хочу открыть редактор              bun run dev → http://demo.localhost:8080/admin
  Хочу посмотреть публичный сайт     docker compose -f infra/compose.yaml exec app bun run site:publish <slug>
  Хочу опубликовать изменения        bun run deploy site <slug>
  Хочу выполнить команду на VPS      bun run remote <script> [...args]
  Хочу откатить релиз                bun run site:releases <slug> → bun run site:rollback <slug> <release-id>

Полная документация: README.md`);
