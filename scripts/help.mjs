console.log(`Kroy — команды проекта

Разработка
  yarn vyaz:build                    Собрать административное приложение Vyaz
  yarn vyaz:serve                    Запустить Vyaz на порту 3000
  yarn parts:generate                Обновить реестр запчастей из JSDoc

База данных
  yarn db                            Применить миграции PostgreSQL через dbmate
  yarn db:migrate                    Применить ожидающие миграции
  yarn db:status                     Показать состояние миграций
  yarn db:rollback                   Откатить последнюю миграцию
  yarn db:seed                       Заполнить локальную базу тестовыми данными

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
  yarn site:deploy demo             Собрать и опубликовать сайт на VPS
  yarn site:build demo               Подготовить статическую версию сайта
  yarn site:publish demo             Опубликовать подготовленную версию
  yarn site:releases demo            Показать сохранённые релизы сайта
  yarn site:rollback demo <release-id>
                                     Переключить сайт на сохранённый релиз
  yarn preview                       Проверить и перезагрузить Nginx Kroy
  yarn preview:reload                Перезагрузить Nginx Kroy
  yarn preview:validate              Проверить nginx.conf экземпляра Kroy

Быстрые сценарии
  Изменил запчасть                   yarn vyaz:build; для сайта: yarn site:build <slug>
  Хочу открыть редактор              yarn db → yarn vyaz:build → yarn vyaz:serve
  Хочу посмотреть публичный сайт     yarn preview → yarn site:build <slug> → yarn site:publish <slug>
  Хочу опубликовать изменения        yarn site:deploy <slug>
  Хочу откатить релиз                yarn site:releases <slug> → yarn site:rollback <slug> <release-id>

Полная документация: README.md`);
