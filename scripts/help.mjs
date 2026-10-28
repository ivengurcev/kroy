console.log(`Kroy — команды проекта

Разработка
  yarn dev                           Запустить PostgreSQL, Kroy и Nginx в Compose
  yarn dev:bg                        Запустить Compose в фоне
  yarn dev:down                      Остановить Compose без удаления данных
  yarn dev:logs                      Следить за логами Compose
  yarn dev:status                    Показать состояние сервисов
  yarn dev:restart app               Перезапустить только app, nginx или db
  yarn dev:rebuild app               Пересобрать только app, nginx или db
  yarn vyaz:build                    Собрать административное приложение Vyaz (production)
  yarn vyaz:serve                    Запустить Vyaz на порту 3000 (production)
  yarn parts:generate                Обновить реестр запчастей из JSDoc

База данных
  yarn db                            Применить миграции PostgreSQL через dbmate
  yarn db:migrate                    Применить ожидающие миграции
  yarn db:status                     Показать состояние миграций
  yarn db:rollback                   Откатить последнюю миграцию (с подтверждением)
  yarn db:seed                       Заполнить локальную базу тестовыми данными (с подтверждением)

Сайты
  yarn site:create vet vet.example.test "Семейный ветеринар"
                                     Создать сайт, домен и главную страницу
  yarn site:list                     Показать все сайты
  yarn site:info demo                Показать сведения о сайте
  yarn site:domain:add demo second-demo.localhost
                                     Добавить домен сайту
  yarn site:domain:remove demo second-demo.localhost
                                     Удалить домен сайта

Публикация
  yarn site:build demo               Подготовить статическую версию сайта
  yarn site:publish demo             Собрать и опубликовать новую версию
  yarn site:releases demo            Показать сохранённые релизы сайта
  yarn site:rollback demo <release-id>
                                     Переключить сайт на сохранённый релиз
  yarn preview                       Проверить и перезагрузить Nginx Kroy
  yarn preview:reload                Перезагрузить Nginx Kroy
  yarn preview:validate              Проверить nginx.conf экземпляра Kroy

Удалённое управление (нужен KROY_REMOTE_HOST)
  yarn remote <script> [...args]     Выполнить скрипт Kroy на VPS
  yarn deploy app                    Развернуть приложение на VPS через Ansible
  yarn deploy site <slug>            Собрать и опубликовать сайт на VPS

Быстрые сценарии
  Изменил запчасть                   yarn vyaz:build; для сайта: yarn site:build <slug>
  Хочу открыть редактор              yarn dev → http://demo.localhost:8080/admin
  Хочу посмотреть публичный сайт     docker compose -f infra/compose.yaml exec app yarn site:publish <slug>
  Хочу опубликовать изменения        yarn deploy site <slug>
  Хочу выполнить команду на VPS      yarn remote <script> [...args]
  Хочу откатить релиз                yarn site:releases <slug> → yarn site:rollback <slug> <release-id>

Полная документация: README.md`);
