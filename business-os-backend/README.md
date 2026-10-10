# Business OS backend — CRM и транзакционный POS

Реализовано: настоящие Django-сессии, CSRF, серверные права workspace/page/action, общий UUID-реестр клиентов для CRM и POS, сделки, этапы, каталог, склады, остатки, кассы и смены, атомарные продажи/возвраты, персональные купоны, аудит, проверка версии и pagination. Frontend пока не подключён. Это отдельный локальный сервис; существующие серверные проекты и production не менялись.

## Запуск

Python 3.12+; проверено на 3.14.7. Команды выполняются из `business-os-backend`:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
.venv/bin/python manage.py migrate
.venv/bin/python manage.py bootstrap --name 'Мой бизнес' --email 'owner@example.test' --owner-name 'Владелец'
.venv/bin/python manage.py runserver 127.0.0.1:5185 --noreload
```

`bootstrap` дважды запросит пароль через скрытый ввод, проверит его и выведет workspace UUID. Пароля по умолчанию нет. Он создаёт только владельца, пять явных ролей и две воронки с этапами; клиентов, сделок и продаж не добавляет. Повторный bootstrap с тем же email завершается ошибкой без перезаписи аккаунта. Роль `owner` имеет явные права текущего среза, без production; имя роли само по себе ничего не разрешает.

Создать тестируемого кассира локально (письмо не отправляется):

```sh
.venv/bin/python manage.py add_member --workspace '<workspace UUID>' --role cashier --email 'cashier@example.test' --name 'Кассир'
```

SQLite, серверные сессии и случайный signing key находятся в `.state/`. Папка и `.venv` исключены из Git; ключ создаётся с mode `0600`, содержимое не выводится. `.env.example` описывает необязательные overrides: значения нужно передать в environment, файл автоматически не загружается. Для изолированной PostgreSQL-БД установить `requirements-postgres.txt` и задать `BOS_DATABASE_URL` до `migrate`. К рабочей БД этот срез не подключать.

## API и авторизация браузера

Префикс: `http://127.0.0.1:5185/api/os/v1`. Маршруты без завершающего `/`. Использовать тот же hostname (`127.0.0.1` либо `localhost`) у UI и API: cookies имеют `SameSite=Strict`. Разрешены только указанные `BOS_ALLOWED_ORIGINS`; credentials не работают с wildcard origins. Cookie сессии — HttpOnly. Cookie CSRF также HttpOnly; токен UI получает в JSON.

1. `GET /auth/csrf` с `credentials:'include'` → `{csrfToken}`.
2. `POST /auth/login` с JSON `{email,password}`, заголовком `X-CSRFToken` и `credentials:'include'` → `{csrfToken,workspaces}`. Вход ротирует CSRF; использовать новый токен из ответа.
3. Последующие запросы: cookies, `X-Workspace-Id` выбранного workspace и `X-CSRFToken` для POST/PATCH/DELETE. При единственном активном workspace заголовок выбора необязателен. Чужой ID не даёт доступ.
4. `POST /auth/logout` с CSRF завершает серверную сессию. Старую cookie повторно использовать нельзя.

Небольшой пример handshake (секреты из формы, не хранить их в localStorage):

```ts
const base = 'http://127.0.0.1:5185/api/os/v1';
const {csrfToken} = await fetch(base + '/auth/csrf', {credentials:'include'}).then(r => r.json());
const response = await fetch(base + '/auth/login', {
  method:'POST', credentials:'include',
  headers:{'Content-Type':'application/json', 'X-CSRFToken':csrfToken},
  body:JSON.stringify({email, password}),
});
if (!response.ok) throw new Error('Вход не выполнен');
const session = await response.json(); // session.csrfToken + session.workspaces, без bearer token
```

Все предметные запросы проверяют активного пользователя, активное членство, принадлежность роли workspace, доступ к странице и действие. `pageActions[page]` заменяет глобальные actions, включая пустой override. Изменение роли применяется на следующем запросе. Блокировка пользователя или членства через сохранение модели ротирует session version; повторная активация не восстанавливает старую cookie. Изменение password автоматически меняет session hash. Прямой SQL/bulk update статуса обходит model save — такой административный путь здесь не предоставлен и перед будущим admin API должен быть исключён.

Login ограничен десятью попытками за минуту с одного `REMOTE_ADDR`; счётчик в БД. Для будущего proxy/multi-instance требуется отдельная политика IP/rate limiting. При нескольких memberships выбор workspace обязателен; новое членство требует повторного входа. Сервер не доверяет frontend preview, `employeeId` автора, значениям прав или workspace из тела запроса.

| Маршрут | Действие и ограничения |
| --- | --- |
| `GET /health` | Только `{status:'ok',mode:'local'}`, без данных БД |
| `GET /me` | employeeId (= membership UUID), workspaceId, имя/email/роль, эффективная матрица текущих страниц; без зарплаты |
| `GET /customers?q=&limit=&cursor=` | Чтение страницы customers либо CRM; полная доступная контактная карточка |
| `POST /customers` | Создание по customers.create либо crm.create |
| `GET/PATCH/DELETE /customers/{id}` | PATCH требует edit + version; DELETE требует remove + version, мягкое удаление. Клиент со сделками или продажами сохраняется и возвращает 409 |
| `GET /pos/customers?q=&limit=&cursor=` | Право просмотра POS; минимальный picker `{id,name,phone}` |
| `POST /pos/customers` | Право pos.create; только name/phone, тот же реестр клиентов. Не даёт CRM edit |
| `GET /pipelines` | crm read; `{items:[{id,name,stages:[id,name,color,sortOrder]}]}` |
| `GET /deals?q=&customerId=&limit=&cursor=` | crm read; customerId фильтр, проверка workspace |
| `POST /deals` | crm.create; существующие customer/pipeline/stage и необязательный активный employee в том же workspace |
| `GET/PATCH/DELETE /deals/{id}` | Read/edit/remove CRM; write требует version; DELETE мягкий, клиент и история остаются |
| `POST /deals/{id}/move` | crm.edit; `{stageId,version}`; этап только текущей воронки; событие аудита в той же транзакции |
| `GET /deals/{id}/events` | Последние 100 событий доступной активной сделки; CRM read |

Полные DTO — в [contracts.ts](./contracts.ts). У ответов списков customers/deals `{items,nextCursor}`; limit 1–100, default 50. Курсор подписан, привязан к workspace/list/filter, действует сутки. Входные неизвестные поля отклоняются с 400; конфликт версии или телефона — 409, отсутствующий/чужой объект — 404, отсутствие сессии/прав — 403, неправильный пароль — 401, login limit — 429. CSRF ошибки Django могут возвращать HTML 403; frontend обязан проверять HTTP status до JSON.

Пример body создания сделки:

```json
{"title":"Подбор ухода","customerId":"<customer UUID>","pipelineId":"<pipeline UUID>","stageId":"<stage UUID>","amount":"1250.50","currency":"KGS","note":"Уточнить доставку"}
```

Телефон нормализуется в цифры и не является ID; пустой телефон допустим. Совпадение непустого полного номера внутри workspace возвращает conflict, а не объединяет людей. Одинаковые имена и одинаковые номера в разных workspace разрешены. Контакт хранится один раз; несколько deals ссылаются на один customer. У сделки отдельные title/note/customFields. Деньги возвращаются decimal-строками. UUID старых фикстур не угадываются по имени/телефону.

Изменение записи и audit атомарны. Версия проверяется также условием UPDATE, чтобы stale write не затёр чужие поля. Связь с customer блокируется внутри транзакции при создании/изменении сделки. На SQLite это рабочий локальный режим, но доказательство конкурентного поведения PostgreSQL не подменяется SQLite тестом.

## Проверки

```sh
.venv/bin/python manage.py check
.venv/bin/python manage.py makemigrations --check --dry-run
.venv/bin/python -m pytest -q
.venv/bin/ruff check .
```

API-тесты используют настоящие password hashes и session login, с включённой CSRF-проверкой. Покрыты блокировка/повторная активация, logout, разграничение workspace, page override кассира, минимальная выдача POS, UUID и phone conflict, общие клиенты нескольких deals, недоступные связи, optimistic conflict, атомарный rollback при ошибке audit и signed pagination. Test fixtures существуют только в отдельной тестовой БД, не в `.state` приложения.

## Повторное использование

- `core/models.py:UserManager` адаптирован из `/Users/alihantorebekov/Desktop/Projects/DemiResults/demiresults-pos/backend/apps/users/models.py`; используются его Django/DRF framework и реальные password primitives. Старые hardcoded HasRole/JWT endpoint не копировались, поскольку новая матрица требует workspace и pageActions.
- `core/access.py` переносит deny-by-default подход `demi-results-crm/src/lib/authz.ts` и точную семантику `businnes-os-fixes/lib/os/team.ts`. Actor всегда получается сервером.
- Структура customer/deal/stage/audit адаптирована по `SmilekitCore/src/actions/customers.ts`, `deals.ts`, миграциям `036_deals.sql` и `20260817150000_customers.sql`. Телефонный PK и permissive authenticated policies заменены UUID/workspace-проверкой.
- `core/pos_services.py` адаптирует atomic/Decimal/row-lock/snapshot/refund инварианты из `demiresults-pos/backend/apps/sales/services.py`, складские движения из `apps/inventory` и смены/оплаты из `apps/shifts`/`apps/payments`. Добавлены workspace RBAC, серверный actor, обязательные request UUID + hash, версии остатков/чеков/смен и накопительное округление возвратов. В кассовом балансе учитываются только наличные возвраты текущей смены.

Исходники проектов не менялись. Предварительный план рекомендовал TypeScript; для runnable первого среза выбран уже существующий Django стек, чтобы не писать собственную authentication и не зависеть от отсутствующих Docker/Postgres для локального запуска. Дальнейшие модели остаются в одном сервере/БД.

## Что ещё нужно для полного backend

1. Подключить frontend адаптер к DTO/session flow после согласования. `Entity.customerId` ← Customer.id; owner/status labels разрешать через employee/stage IDs; не переключать все localStorage записи автоматически. Сделать dry-run legacy import с явной id map.
2. Соединить готовые POS endpoints с frontend по DTO ниже. Не импортировать localStorage как доверенные оплаты или остатки. Утвердить импорт начальных остатков, касс и исторических чеков с отдельным аудитом. Каталог этого среза поддерживает обычные/весовые товары и услуги; комплекты, серийный/маркированный учёт, резервы, фискализация и налоговые расчёты ещё не реализованы.
3. Для production требуется PostgreSQL. Выполнить включённые PostgreSQL concurrency tests на отдельной БД, затем добавить нагрузочную проверку stock adjustment/refund/close и retry policy для operational deadlock/timeout. SQLite не обеспечивает используемые row locks; он предназначен только для локальной последовательной работы, а не нескольких касс.
4. Team UI/admin, role editing, scopes own/team/all, password reset, назначения агентов, appointments и личные отчёты пока не реализованы. В этом срезе POS имеет own/all scope (см. ниже); CRM пока ограничен workspace/page/action, без назначения team scope.
5. Customer activity aggregate, общая финансовая отчётность, files, channels, outbox/workers и внешние интеграции — следующие модули. Никаких внешних сообщений или платежей этот сервер не отправляет.
6. Production отдельно: HTTPS/secure cookies, secret manager, PostgreSQL backups, deploy runtime, admin audit/revocation, shared abuse controls, logs/metrics и проверка tenant/FK invariants. `runserver` и настройки loopback предназначены для локальной работы.

Для framework-проверок использованы [Django authentication](https://docs.djangoproject.com/en/5.2/topics/auth/default/) и [DRF SessionAuthentication/CSRF](https://www.django-rest-framework.org/api-guide/authentication/#sessionauthentication).


## POS: API и правила проведения

Все запросы используют тот же session/CSRF/workspace handshake. UUID автора, название клиента, остаток, стоимость закупки и итог чека клиент не задаёт. Все суммы — decimal strings с 2 знаками, количества с 3. Снимок цены, названия/артикула товара, признака складского учёта и имени/телефона клиента фиксируется при продаже. Чек сохраняет стабильный Customer.id; изменение карточки клиента не переписывает чек.

| Маршрут | Права и контракт |
| --- | --- |
| `GET/POST /products`, `GET/PATCH/DELETE /products/{id}` | inventory read/create/edit/remove. PATCH/DELETE требуют version. Выдаются cost и price. Товар с остатком не архивируется; type/weighted после движения остатков или продаж не меняются |
| `GET /pos/products` | pos read; каталог без закупочной себестоимости |
| `GET/POST /warehouses`, `GET/PATCH/DELETE /warehouses/{id}` | Чтение inventory либо POS; запись inventory create/edit/remove + version. Открытая смена или ненулевой остаток запрещает архивирование склада |
| `GET/POST /registers`, `GET/PATCH/DELETE /registers/{id}` | Чтение inventory либо POS; запись inventory create/edit/remove + version. Касса связана со складом того же workspace; при открытой смене её склад не меняется |
| `GET /stocks?warehouseId=&productId=` | inventory либо POS read; `{id,productId,warehouseId,quantity,version}` |
| `GET/POST /stock-movements` | GET inventory read, фильтр productId; POST inventory.inventory. requestId + stockVersion обязательны. Для ещё не созданного остатка stockVersion=0. receipt/write_off положительны; correction задаёт абсолютный итог, включая 0 |
| `GET/POST /shifts` | GET POS read (scope ниже); POST pos.finance, `{registerId,openingCash?}`. Кассир из сессии; не более одной открытой смены на сотрудника и кассу |
| `GET /shifts/current` | POS read; `{shift:Shift|null}`, всегда собственная смена |
| `POST /shifts/{id}/close` | pos.finance; только собственная открытая смена, `{version,actualCash}`. Версия смены меняется после каждой продажи/возврата |
| `GET /sales?customerId=&shiftId=`, `GET /sales/{id}` | POS read (scope ниже), nested immutable items/payments и история refunds |
| `POST /sales/complete` | pos.finance; SaleComplete DTO. Только собственная открытая смена. Цена каталога на сервере; freePrice допустима лишь для isFreePrice=true |
| `POST /sales/{id}/refunds` | pos.finance; RefundInput DTO. version — актуальная версия **чека**. Только собственная открытая смена; чужой чек дополнительно требует pos.manageTeam |
| `GET/POST /coupons`, `GET/PATCH /coupons/{id}` | GET customers/CRM read; POST/PATCH customers.edit либо crm.edit. PATCH version. Купон нельзя переназначить другому клиенту; выключение через active=false |
| `GET /pos/customers/{id}/coupons` | POS read; активные купоны выбранного клиента. Истечение окончательно проверяется при продаже |

Чеки и смены по умолчанию доступны только своему cashier membership. `pos.manageTeam` явно разрешает чтение чеков/смен workspace и возврат чужого чека; имя owner не является обходом. Закрывать смену другого сотрудника нельзя. Право finance без страницы POS ничего не разрешает. Право inventory не разрешает проведение оплаты. Себестоимость не включается в POS picker и чеки.

Продажа и возврат не редактируются/удаляются; исправление — новый возврат. Для sale/refund/stock adjustment требуется UUID requestId. Повтор того же нормализованного body тем же actor возвращает прежний объект и HTTP 200; первое проведение — 201. Повтор с другим body либо actor — 409, без повторного списания. Идемпотентность сохраняется после закрытия смены. Для открытия смены отдельный requestId не предусмотрен: повтор возвращает 409, текущее состояние доступно через /shifts/current.

Позиции одного товара нужно объединить; duplicate product/payment method отвергаются. Оплаты cash/card/qr могут быть разделены, но сумма обязана точно совпадать с серверным итогом. Для нулевого итога передаётся payments=[]. Это запись способа расчёта: API не вызывает эквайринг, перевод или фискальную кассу.

Купон **многоразовый** и персональный; он заменяет ручную скидку, ограничен суммой чека и действует включительно до expiresAt по workspace.time_zone. Процент (0,100], fixed >0. Пустую frontend дату преобразовать в null. Ручная скидка не может превышать subtotal. При изменении серверной цены или купона несовпадение оплаты вернёт 400; UI должен обновить расчёт и запросить подтверждение кассира.

Возврат записывает paymentMethod (по умолчанию cash), причину и saleItemId/quantity. Сумма вычисляется сервером из исходной стоимости позиции после скидки, накопительно округляется до копейки, поэтому последний возврат закрывает точный остаток. Возвращённое количество не может превысить продажу. Товар возвращается на склад исходного чека, даже если текущая смена на другом складе; услуга склад не меняет. Наличные уменьшают баланс текущей смены; card/qr возврат наличные не уменьшает. Возврат через платёжного провайдера не выполняется.

В одной транзакции фиксируются sale/refund, items, payment, stock/version, movement, shift/version и audit. На PostgreSQL блокируются shift, product (по UUID), stock, customer/coupon и sale при возврате. Уникальные ограничения requestId и открытой смены, неотрицательный stock и границы возврата дополнительно закреплены в БД. Soft archive сохраняет исторические FK. Денежная арифметика выполняется Decimal; SQLite не служит проверкой числового и конкурентного поведения production PostgreSQL.

Пример проведения (подставить UUID из API):

```json
{"requestId":"<новый UUID>","shiftId":"<своя смена>","customerId":"<клиент>","couponId":null,"discountAmount":"0.00","items":[{"productId":"<товар>","quantity":"2.000"}],"payments":[{"method":"cash","amount":"15.00"},{"method":"card","amount":"5.00"}]}
```

Для PostgreSQL-проверки установить requirements-postgres.txt, направить BOS_DATABASE_URL на **изолированную тестовую БД** с разрешённым созданием pytest test database и выполнить `.venv/bin/pytest -q tests/test_pos_concurrency.py`. Эти два теста запускают отдельные соединения/потоки: две кассы продают последнюю единицу; один requestId приходит одновременно дважды. На текущем SQLite они пропускаются явно; их успешный запуск на PostgreSQL ещё не подтверждён.

Проверено локально 10 октября 2026: 38 tests passed, 2 PostgreSQL-only tests skipped; Django check, отсутствие незаписанных migrations, Ruff, pip dependency check. Отдельный HTTP smoke на временной SQLite-БД прошёл цепочку session+CSRF → catalog → stock → shift → customer/coupon → sale → повтор requestId → refund. Временный сервер остановлен, фикстуры не попали в рабочую `.state`. Это подтверждает локальный API, но не production concurrency.
