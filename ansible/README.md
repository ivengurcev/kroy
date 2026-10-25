# Kroy Nginx на VPS

Ansible-шаблоны запускают один отдельный экземпляр установленного системного
Nginx от пользователя приложения. Системный Nginx остаётся владельцем HTTPS и
проксирует домены Oysite на `127.0.0.1:8080`.

Перед применением задайте `kroy_root`, `kroy_user`, при необходимости
`kroy_group`, и `kroy_domains` в inventory или через `-e`. Playbook идемпотентно
создаёт системную группу, пользователя без интерактивного shell, рабочий
каталог и runtime-каталоги с правильным владельцем. Пользователь SSH-подключения
добавляется в группу Kroy, а каталоги получают setgid и права `2770`, поэтому
переданные им файлы наследуют группу `kroy` и доступны сборщику `kroy`.
Существующий пользователь и каталоги не пересоздаются и не удаляются.

Nginx, PostgreSQL и Node.js должны быть установлены заранее; playbook их не
устанавливает и не обновляет. Исходный код Kroy должен быть размещён в
`kroy_root` до запуска systemd-сервиса.

Playbook не перезаписывает основной `nginx.conf`; он добавляет отдельный файл в
`conf.d` и systemd unit Kroy.
TLS-сертификаты намеренно не настраиваются.

Локально нужны Ansible с коллекциями `ansible.posix` и `community.postgresql`,
SSH-доступ и `rsync`. Установите коллекции:

```bash
ansible-galaxy collection install -r ansible/requirements.yml
```

На VPS также должен быть доступен Python-модуль PostgreSQL для Ansible
(`psycopg2` или `psycopg`).
Пользователь берётся из настроек Ansible, inventory или `~/.ssh/config`.
После bootstrap переподключитесь по SSH, чтобы обновилось членство в
группе. На VPS нужны `rsync`, Node.js, Yarn/Corepack, PostgreSQL и установленный Nginx;
playbook их не устанавливает. Отдельный sudoers или привилегированный помощник
Kroy не добавляется.

Сначала выполните bootstrap:

```bash
ansible-playbook -i inventory ansible/kroy-bootstrap.yml \
  -e kroy_root=/srv/kroy \
  -e kroy_user=kroy
```

Для provision PostgreSQL и `.env`, а затем deploy из локального checkout Kroy,
используйте одну команду:

```bash
ansible-playbook -i inventory ansible/kroy-deploy.yml \
  -e kroy_root=/srv/kroy \
  -e kroy_user=kroy \
  -e 'kroy_domains=["example.oysite.ru"]'
```

Provision создаёт роль PostgreSQL `kroy` с `LOGIN`, базу `kroy` и файл
`/srv/kroy/.env` с правами `0600`. Пароль базы и `AUTH_SECRET` генерируются
только при первом запуске. Существующий `.env` не перезаписывается; если роль
базы отсутствует, она восстанавливается с паролем из этого файла.

Deploy передаёт исходники через rsync напрямую от пользователя SSH-подключения, включая содержимое
`vyaz/`, но исключает `.git` (в том числе внутри субмодулей), `.env`, `dist`,
локальные зависимости, кеши, логи и `ansible/`. `--delete` и `--chown` не
используются: `.env`, опубликованные релизы, загрузки и прочие серверные данные
сохраняются. Устаревшие исходники намеренно не удаляются автоматически.

После первого применения проверьте сервис:

```bash
systemctl status kroy-nginx
systemctl is-enabled kroy-nginx
```
