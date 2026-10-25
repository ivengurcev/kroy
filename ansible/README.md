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

```bash
ansible-playbook -i inventory ansible/kroy-nginx.yml \
  -e kroy_root=/srv/kroy \
  -e kroy_user=kroy \
  -e 'kroy_domains=["example.oysite.ru"]'
```

После первого применения проверьте сервис:

```bash
systemctl status kroy-nginx
systemctl is-enabled kroy-nginx
```
