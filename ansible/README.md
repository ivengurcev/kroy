# Kroy Nginx на VPS

Ansible-шаблоны запускают один отдельный экземпляр установленного системного
Nginx от пользователя приложения. Системный Nginx остаётся владельцем HTTPS и
проксирует домены Oysite на `127.0.0.1:8080`.

Перед применением задайте `kroy_root`, `kroy_user`, при необходимости
`kroy_group`, и `kroy_domains` в inventory или через `-e`. Playbook идемпотентно
создаёт системную группу, пользователя без интерактивного shell, рабочий
каталог и runtime-каталоги с правильным владельцем. Существующий пользователь
и каталоги не пересоздаются и не удаляются.

Nginx, PostgreSQL и Node.js должны быть установлены заранее; playbook их не
устанавливает и не обновляет. Исходный код Kroy должен быть размещён в
`kroy_root` до запуска systemd-сервиса.

Playbook не перезаписывает основной `nginx.conf`; он добавляет отдельный файл в
`conf.d` и systemd unit Kroy.
TLS-сертификаты намеренно не настраиваются.

Локально нужны Ansible с коллекцией `ansible.posix`, SSH-доступ и `rsync`.
На VPS нужны `rsync`, Node.js, Yarn/Corepack, PostgreSQL и установленный Nginx;
playbook их не устанавливает. Для передачи с корректным владельцем удалённый
пользователь должен иметь существующее право Ansible `become`/`sudo` для
`rsync`; отдельный sudoers или привилегированный помощник Kroy не добавляется.

Сначала выполните bootstrap:

```bash
ansible-playbook -i inventory ansible/kroy-bootstrap.yml \
  -e kroy_root=/srv/kroy \
  -e kroy_user=kroy
```

Затем deploy из локального checkout Kroy:

```bash
ansible-playbook -i inventory ansible/kroy-deploy.yml \
  -e kroy_root=/srv/kroy \
  -e kroy_user=kroy \
  -e 'kroy_domains=["example.oysite.ru"]'
```

Deploy передаёт исходники через rsync, включая содержимое `vyaz/`, но исключает
`.git`, `.env`, `dist`, локальные зависимости, кеши, логи и `ansible/`. `--delete`
не используется: `.env`, опубликованные релизы, загрузки и прочие серверные
данные сохраняются. Устаревшие исходники намеренно не удаляются автоматически.

После первого применения проверьте сервис:

```bash
systemctl status kroy-nginx
systemctl is-enabled kroy-nginx
```
