# Kroy Nginx на VPS

Ansible-шаблоны запускают один отдельный экземпляр установленного системного
Nginx от пользователя приложения. Системный Nginx остаётся владельцем HTTPS и
проксирует домены Oysite на `127.0.0.1:8080`.

Перед применением задайте `kroy_root`, `kroy_user` и `kroy_domains` в inventory
или через `-e`. Playbook не устанавливает Nginx и не перезаписывает основной
`nginx.conf`; он добавляет отдельный файл в `conf.d` и systemd unit Kroy.
TLS-сертификаты намеренно не настраиваются.

```bash
ansible-playbook -i inventory ansible/kroy-nginx.yml \
  -e kroy_root=/srv/kroy \
  -e kroy_user=kroy \
  -e 'kroy_domains=["example.oysite.ru"]'
```
