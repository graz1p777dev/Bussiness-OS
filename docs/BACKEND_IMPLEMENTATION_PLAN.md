# Backend Business OS: исходники и порядок подключения

Дата: 10 октября 2026. Статус: подготовка по запросу пользователя «после готовности страниц запустить backend-агента и использовать код нашего серверного проекта».

Этот документ фиксирует прочитанные исходники и предлагаемую реализацию. Backend Business OS ещё не реализован. До передачи проверенных frontend-контрактов разрешена подготовка; здесь не выполнялись SSH, запросы к рабочей БД, миграции, deploy или запуск старых серверов. Значения секретов не читались. Общий объём остаётся в `BACKEND_PLAN.md` и `docs/BACKEND_HANDOFF.md`; этот план уточняет повторное использование существующего кода и первый рабочий срез.

## 1. Найденные источники

Пути ниже абсолютные. Версии — из локальных package manifests, а не утверждение об установленном production runtime.

| Обозначение | Путь | Что подтверждено чтением |
| --- | --- | --- |
| CRM | `/Users/alihantorebekov/Desktop/Projects/DemiResults/demi-results-crm` | Next.js 16.2.9, React 19.2.4, TypeScript, Zod, `@supabase/ssr` и `supabase-js`. Server Actions, Postgres migrations, серверные identity/RBAC, сотрудники и консультации |
| CRM clone | `/Users/alihantorebekov/Desktop/Projects/DemiResults/DemiResultsCRM` | Та же семья Next.js/Supabase. Локальные actions отличаются: например, consultations напрямую используют admin после проверки session. Не выбирать эту реализацию вместо более строгого `CRM/src/lib/authz.ts` |
| Inventory | `/Users/alihantorebekov/Desktop/Projects/DemiResults/Demireusltsn8nbotcopy/inventory` | Next.js 16.2.9 + Supabase/Postgres. Складские документы, движения/остатки, товары, кассы/смены и магазин |
| Inventory VPS snapshot | `/tmp/business-os-vps-audit-20261006` | Ранее сохранённые выбранные исходники `/srv/alihan/Demireusltsn8nbotcopy/inventory`, включая `src/app/cashier/actions.ts` и миграцию продажи с `consultation_id` |
| CRM VPS snapshot | `/tmp/business-os-vps-audit-20261007-crm` | Ранее сохранённые 16 файлов `/srv/alihan/DemiResultsCRM`: messenger, attendance, vacations, partners; `source-sha256.json` содержит контрольные суммы этого набора |
| POS | `/Users/alihantorebekov/Desktop/Projects/DemiResults/demiresults-pos/backend` | Django 5.2.16, DRF 3.17.1, SimpleJWT, PostgreSQL driver, OpenAPI. Есть REST API, `transaction.atomic`, блокировки строк и тесты продаж/возвратов |
| SmileKit | `/Users/alihantorebekov/Desktop/Projects/SmileKit/SmilekitCore` | Next.js/Supabase CRM: сделки, этапы, события, заказы, карточка клиента и интеграции сообщений. Полезный источник логики, но отдельная предметная база |
| Site | `/Users/alihantorebekov/Desktop/Projects/DemiResults/DemiResults Sait` | Next.js/Supabase; `supabase/migrations/20260901131058_shop_orders_crm_inventory.sql` — дополнительный источник связи магазина, CRM и inventory для следующего этапа |

Ранее аудит зафиксировал VPS HEAD CRM `9f9ebabe87c7f3e5883069b9e4a7d041065f9f0b` и botcopy `960485f4fb5257b8e10f67199850942ad6c32a8c`. Это свидетельство аудита 6–7 октября, не проверка текущего состояния VPS. Snapshot частичный, его нельзя применять как полный набор миграций.

Локальные HEAD на момент чтения: CRM `901549f8f0ca87b0b56fd784a44cb615b008af30`; CRM clone `510a1a38704fb89d8c0bf64a0049f077b2ae3146`; botcopy `cfc657ee76cd16f313b088f2092548d97571956d`; POS `22bd751fb138968e76a8e65845b0b41f38192ad8`; SmileKit `d69a04be85066ab0db1cf3041a5f7157a940f4c5`. По `git status --porcelain --untracked-files=no` tracked-изменений в этих пяти checkout не было. Совпадение deploy с ними не установлено.

## 2. Что брать из исходников

В этой таблице относительный путь раскрывается от обозначенного выше абсолютного корня. Названия функций — существующие; REST-маршруты в следующем разделе — предлагаемые.

| Область | Конкретный источник | Повторное использование и необходимая адаптация |
| --- | --- | --- |
| Проверенная identity | CRM `src/lib/identity.ts`: `getAuthUser`, `getSelfEmployee`, `getPermissionsForRole`; `src/lib/authz.ts`: `getActor`, `can`, `getScope`, `inScope` | Взять проверку пользователя сервером, deny по отсутствующему/неоднозначному праву, область own/team/all. Добавить workspace и новые действия Business OS. Не переносить безусловный owner bypass: в frontend owner имеет явный список actions, включая отдельное production |
| Роли | CRM `src/actions/access-control.ts`: `savePermissionsForRole`, `createRoleWithPermissions`; `supabase/migrations/002_roles_permissions.sql`, `025_custom_roles.sql`, `047_role_reference_integrity.sql` | Взять связи role/permission и атомарное создание роли. Маппинг новой матрицы `pages + actions + pageActions` обязателен; старые can_view/create/edit/delete не покрывают finance, inventory, export, ai, manageTeam, password, production |
| Сотрудники | CRM `src/actions/employees.ts`: `getEmployees`, `createEmployee`, `updateEmployee`, `archiveEmployee`, `restoreEmployee`, `upsertEmployeeKpi`; `004_employees.sql`, `006_kpi_templates_employee_kpi.sql`, `009_salaries.sql`, `088_sick_and_dismissal.sql` | Взять минимизацию полей и scope чтения, архивирование и историю. Новый профиль дополнить department/KPI/contract/duties/hiringPurpose/mainObjective. Зарплата и payScheme отдаются только с серверным правом. Статус блокировки должен отзывать доступ к API и сессиям |
| Клиент | SmileKit `src/actions/customers.ts`: `getCustomerCard`, `saveCustomerProfile`; `supabase/migrations/20260817150000_customers.sql` | Взять поля name/note/tags и агрегацию карточки. Старый PK=phone и поиск по суффиксу телефона не подходят: новый PK постоянный customerId. Старые policies `USING (TRUE)` для authenticated не переносить; добавить workspace и доступ к связанным сущностям |
| CRM | SmileKit `src/actions/deals.ts`: `createDeal`, `updateDeal`, `moveDeal`, `deleteDeal`, `getDealsData`; `036_deals.sql`, `037_deal_stages_brand_color.sql`, `039_deal_stage_description_and_non_standard.sql` | Взять схемы валидации, FK этапа/ответственного, append-only deal_events. Добавить pipeline, customer FK, version и текущие frontend customFields. Получение всех сделок постранично — источник поведения, API должен давать pagination, а не выгружать всю базу |
| Заказы | SmileKit `src/actions/orders.ts`, `src/lib/orders/ingest.ts`, `038_orders.sql` | Взять нормализацию входящего заказа и назначение ответственного. Не считать total_amount подтверждённой оплатой; paid/refunded вычислять по операциям. Не смешивать заказ магазина и кассовый чек |
| Каталог и склад | Inventory `src/app/inventory/products/actions.ts`, `src/app/inventory/stock-movement/actions.ts`; `20260705123746_inventory_schema.sql`, `20260705123747_inventory_document_posting.sql`, `20260711110000_inventory_product_details.sql` | Взять товары, склады, document/items/movements, номера и детализацию товара. Проведение/отмена требуют серверной транзакции и проверки права inventory. Проверить итоговую цепочку migrations и конкурентный остаток, не только pre-check в action |
| Касса на VPS | Inventory VPS snapshot `src/app/cashier/actions.ts`: `checkoutSale`; `supabase/migrations/20260801080000_inventory_consultation_sales.sql`: `inventory_checkout_sale` | Уже есть Zod, UUID request, серверная цена, запрет повторяющихся позиций, документ sale и связь consultation. Добавить новый customer FK, coupon/payment/shift и права Business OS. Существующая функция не принимает split payments и couponId; не объявлять её готовым соответствием frontend |
| Транзакционная продажа | POS `apps/sales/services.py`: `complete_sale`, `refund_sale`; `models.py`, `serializers.py`, `views.py`, `urls.py` | Взять алгоритм atomic/row locks, Decimal, snapshot цены/себестоимости, split payments, остаток, частичный возврат и audit. При TypeScript/Postgres реализации перенести эти инварианты и тесты, не запускать второй независимый write-контур продаж |
| Кассовые смены | Inventory `src/app/inventory/cash-shifts/actions.ts`; `20260707140000_inventory_cash_registers_shifts.sql`; POS `apps/shifts/*` | Касса/склад/сотрудник по FK, проверка открытой смены, ожидаемые/фактические наличные. Строка cashier из frontend становится snapshot, cashierId — основной связью |
| Записи | CRM `src/actions/consultations.ts`: create/update/rebook/delete + audit RPC; `039_consultation_audit_log.sql`, `041_consultation_scope_enforcement.sql`, `057_failclosed_identity_and_consultations_scope.sql`, `061_consultation_source_and_partners.sql` | Взять scope, историю и атомарную перезапись. Новый `Appointment` шире консультации: kind, duration, clientId, dealId, employeeId; нужны новые статусы и запрет одновременных записей на сотрудника. Старые hardcoded owner-only удаления не выдавать за новую матрицу прав |
| Командные диалоги / рабочее время | CRM VPS snapshot `src/actions/messenger.ts`, `attendance.ts`, `attendance-explanations.ts`, `vacations.ts` | Источник для следующих модулей: membership, сообщения/реакции/read state, task from message, attendance RPC. Сначала сверить с frontend `staff-messenger.ts` и контрактом агента attendance |

Существующие реальные REST-маршруты есть в Django POS: `/api/auth/`, `/api/products/`, `/api/inventory/`, `/api/shifts/open/`, `/api/shifts/current/`, `/api/shifts/{id}/close/`, `/api/sales/complete/`, `/api/sales/{id}/refund/`, `/api/reports/`, `/api/schema/`. Next.js функции выше являются Server Actions, а не готовыми REST endpoints Business OS.

## 3. Решение для первого среза

Рекомендация: один TypeScript API-слой и одна PostgreSQL предметная база, с повторным использованием Supabase identity/Postgres-моделей из CRM. Это даёт больше прямого повторного использования, чем замена всего проекта на Django. Конкретный host/серверный entrypoint определить при передаче frontend; установленный Vinext/Cloudflare scaffold не доказывает совместимость всех старых Next Server Actions. Не копировать `next/cache` и cookies-зависимости в предметные сервисы. Django POS использовать как источник проверяемой транзакционной логики; решение о другом runtime менять явно, до написания двух API.

Первый рабочий срез: **server identity/RBAC → Customers + CRM → клиент в POS**. Он должен позволить войти сотрудником, создать/найти клиента в POS, увидеть того же клиента в CRM, создать и переместить связанную сделку, перезагрузить приложение и получить сохранённые данные из локальной тестовой БД. Подтверждение продажи подключается следующим срезом после каталога и смен; до него локальная демонстрационная касса явно остаётся локальной.

Серверные модули для первого среза: `identity`, `authorization`, `customers`, `crm`, `audit`. Предлагаемая граница кода после handoff: отдельные server services/repositories, API DTO со схемами валидации и frontend adapter через имеющийся `lib/os/http.ts`. Расположение entrypoint согласовать с фактическим runtime; сам `requestJSON<T>` сейчас только fetch helper и не проверяет структуру ответа.

### Точные источники frontend-контрактов

| Контракт | Файл в `/Users/alihantorebekov/Downloads/businnes-os-fixes` | Хранилище сейчас |
| --- | --- | --- |
| Customer/Deal, стабильный customerId | `lib/os/customers.ts`, `lib/os/data.ts`, `features/Customer360.tsx` | `life-deals`; пока Customer — проекция Entity, группировка только по явному customerId, fallback deal.id |
| Этапы/воронки | `lib/os/stage-config.ts` | `life-stage-config-v3`; sales/repeat, этапы имеют id/name/color, сделки пока хранят текст status/pipeline |
| POS Sale/Shift/Product | `lib/os/inventory-model.ts`, `features/operations/POS.tsx` | `life-inventory-v2` |
| Купоны | `lib/os/customer-relations.ts` | `life-customer-coupons-v1`; reusable, percent/fixed, заменяют ручную скидку |
| Профиль/матрица прав | `lib/os/team.ts`, `features/TeamManagement.tsx` | `life-team-employees-v3`, `life-team-roles-v3` |
| Запись клиента | `lib/os/appointments.ts`, `lib/os/calendar.ts`, `features/AppointmentsWorkspace.tsx` | `life-consultations-v2` |
| Собственный отчёт | `lib/os/employee-reports.ts`, `features/EmployeeReports.tsx` | `life-employee-reports-v1`, исходные `life-messages`/tasks/inventory |

Контракты повторно снять перед реализацией: frontend продолжает дорабатываться. Сохранять исходные demo store до явного импорта, не выполнять тихую загрузку фикстур в сервер.

### Предлагаемые API и DTO

Все следующие маршруты новые; они пока не существуют. Префикс `/api/os/v1`. Workspace/actor определяются проверенной сессией и членством, не доверенным `employeeId` из body. Для write запросов — валидированный DTO, audit, версия изменяемой записи; конфликт версий даёт 409. Для повторяемых команд — idempotency key с проверкой совпадения payload.

| API | Запрос / ответ | Правило |
| --- | --- | --- |
| `GET /me` | employeeId, workspaceId, profile без лишних полей, effective permissions | Возвращать только активное членство; owner/preview из localStorage не являются авторизацией |
| `GET /customers?q=&cursor=` | `{items:[{id,name,phone,username,city,note,tags,customFields,createdAt,updatedAt,version}],nextCursor}` | Фильтр workspace; поиск по имени/нормализованному полному телефону; разрешённый POS picker получает минимальные поля |
| `POST /customers` | `{name,phone?,username?,city?,note?,tags?,customFields?}` → Customer | При вызове из POS достаточно соответствующего серверного права POS create в пределах утверждённого контракта, без выдачи CRM edit. Телефон не является PK; совпадение предлагает выбрать существующего клиента |
| `GET/PATCH /customers/{id}` | PATCH только контактные поля и version | Одна запись customer для всех связанных сделок. Нельзя переименовать клиента другого workspace; snapshot старого чека не изменяется |
| `GET /customers/{id}/activity` | Раздельные секции deals/sales/appointments/tasks/dialogs с cursor | Каждая секция по своему праву; отсутствие finance/sales read не раскрывает суммы через карточку клиента |
| `GET /pipelines` | pipelines и stages `{id,pipelineId,name,color,sortOrder}` | Миграция текстовых status → stageId только по явной таблице соответствия |
| `GET/POST /deals`, `GET/PATCH /deals/{id}` | `{customerId,pipelineId,stageId,amount,currency,employeeId?,agentId?,note,customFields,version}` | Customer/stage/employee принадлежат workspace; контракт суммы отделить от перегруженного Entity.value |
| `POST /deals/{id}/move` | `{stageId,version}` → Deal + stage event | Изменение и audit в одной транзакции; этап должен принадлежать текущей воронке |
| `DELETE /deals/{id}` | version → archived result | Мягкое удаление сохраняет клиента, историю и ссылки чеков |
| `POST /sales/complete` — второй срез | `{requestId,shiftId,items:[{productId,quantity,freePrice?}],discountAmount?,couponId?,customerId?,payments:[{method,amount}]}` → Sale + receipt | Сначала server POS finance + открытая смена + доступ к клиенту; сервер определяет цену и snapshot клиента. freePrice допустим только для соответствующего товара и права |
| `POST /sales/{id}/refunds` — второй срез | `{requestId,items:[{saleItemId,quantity}],reason}` → Refund + Sale | Повторяемая транзакция, количество не больше невозвращённого, деньги по snapshot оплаченной позиции |
| `POST /shifts`, `POST /shifts/{id}/close` — второй срез | registerId/openingCash; actualCash/version | cashierId из сессии, запрет конкурирующей открытой смены, expectedCash считается сервером |
| `GET/POST/PATCH /appointments` — третий срез | `{customerId,employeeId?,dealId?,date,time,duration,kind,status,note,version}` | DTO адаптирует frontend clientId → customerId. Проверка дат, длительности 5–480 минут, актуального сотрудника и пересечения интервалов в транзакции |
| `GET/PATCH /employees`, `GET/PUT /roles` — третий срез | Профиль и role permissions без клиентской authority | Управление по manageTeam, salary/payScheme — отдельная проекция. Не расширять сохранённые custom роли автоматически |
| `GET/POST/PATCH /employee-reports` — третий срез | date/shiftId/results/comment/version; metrics рассчитывает сервер | Запись только своего отчёта; руководитель видит выбранного сотрудника по праву, не подменяет автора |

Для frontend адаптера поля `Customer.id` и `customerId` временно могут указывать на один серверный ID, чтобы не ломать Customer360/POS. На сервере достаточно единственного первичного id. `Sale.customerName/customerPhone/couponCode` — неизменные snapshot, а `customerId/couponId` — связи. У текущего Sale нет dealId: не заявлять прямую связь со сделкой до согласования этого дополнительного поля.

## 4. Миграция идентификаторов и правил

1. Новые таблицы: workspaces/memberships, customers, customer_contacts, pipelines/stages/deals, audit_events; затем sales/items/payments/refunds/shifts и appointments. Взять нужные колонки из источников, не накатывать несвязанные бизнес-миграции целиком. Каждая бизнес-таблица и её FK сохраняет workspace-границу.
2. Legacy import отдельной командой dry-run → отчёт → применение. Для `life-deals` ключ клиента = `customerId || deal.id`; несколько сделок объединяются только при уже одинаковом ключе. Карта `(source,sourceId) → targetId` сохраняется и повторный импорт идемпотентен. Буквенные demo IDs (`D1024`, `SKU-100`, `owner-user`) нельзя отправлять в старые UUID/int поля без этой карты.
3. SmileKit customers с phone PK мигрировать через выделенный ID. Совпадение последних девяти цифр даёт кандидата на сопоставление, никогда автоматическое слияние. Клиент без телефона разрешён текущим POS; нормализация не должна менять его identity.
4. Нынешние customer поля в нескольких Entity превращаются в одну customer запись и DTO-проекцию. Сохранение контакта обновляет customer, а не все deal rows. Сохранить note/tags/customFields и историю. Отделить заметку клиента от заметки сделки в DTO.
5. Текстовые owner/employee/cashier использовать только как legacy snapshot. Назначения и отчёты строить по employeeId/cashierId; неоднозначные имена оставить неразрешёнными в import report, не угадывать.
6. Деньги — decimal или minor units + currency, количество — отдельная точность для весового товара. Купон проверяется по клиенту, active и expiresAt сервером в момент продажи, заменяет manual discount. Поддержать итог 0: текущий Django serializer требует положительные payments и напрямую этот случай не покрывает.
7. Проверка наличия до вставки недостаточна для конкурентной кассы. Транзакция блокирует остатки в стабильном порядке, валидирует stock, пишет sale/items/payments/movements/audit целиком. Проверить итоговые inventory triggers: найденный `inventory_apply_stock_change` прибавляет delta через upsert, сам по себе не доказывает запрет отрицательного остатка.
8. RBAC переносится из проверенного server actor: доступ к странице обязателен; если у роли есть pageActions[page], применяется этот override, иначе global actions. Права POS finance не дают чтение общего finance dashboard. Статус blocked/terminated запрещает все операции независимо от ранее выданной cookie.

## 5. Последовательность и критерии завершения

| Этап | Конкретная работа | Проверяемый результат |
| --- | --- | --- |
| 0. Передача frontend | Root передаёт проверенные Customer/CRM/POS/Team/Appointment DTO, permission matrix и smoke evidence; фиксируются рабочая ветка/снимок, runtime и локальная тестовая БД | Нет изменений production и неясного двойного источника данных; demo режим сохраняется до переключения модуля |
| 1. Общий клиент + CRM | Создать identity/authorization adapter из CRM, минимальные schema/repositories/API выше; подключить Customer360/CRM и POS customer picker/create к общему API | Клиент, созданный кассиром, виден в CRM; несколько сделок ссылаются на него; контакт меняется один раз; reload и второй браузер видят серверную запись |
| 2. Каталог + кассовая транзакция | Перенести catalog/stock/shift models; реализовать complete/refund по инвариантам POS и inventory, snapshots/coupons/idempotency; заменить inventory write adapter целиком | Продажа → остаток → платёж → клиент → чек; возврат → остаток/остаток платежа; все изменения атомарны, никакой оплаты из текста/AI |
| 3. Team + appointments + own reports | Профили/роли, блокировка/увольнение, appointments history/conflicts; серверные метрики личного отчёта | Оператор не читает чужую зарплату, кассир не правит CRM, два клиента не занимают один слот, отчёт нельзя отправить за другого |
| 4. Остальные готовые модули | Tasks/files/messenger/attendance; затем workflows/agent approvals/notifications/outbox и интеграции из общего handoff | Каждая готовая страница переводится на свой серверный контракт и проверяется; доставка наружу только при настроенном провайдере и соответствующей авторизации |

Обязательные тесты первого среза: отсутствие сессии; неизвестная/заблокированная роль; denied page и page override; чужой workspace по прямому ID; создание клиента из POS с ограниченными правами; одинаковое имя/телефон без скрытого merge; общий customer для нескольких сделок; stage из другой pipeline; version conflict; отсутствие salary и sales totals в ограниченных ответах. E2E: POS → новый клиент → CRM → новая сделка → смена этапа → reload.

Второй срез переносит сценарии из POS `apps/sales/tests/test_sales.py`: server price, недостаточный stock, повтор requestId, split payment, запрет без смены, partial refund, close shift, запрет cashier product create, две конкурентные продажи последней единицы. Тест конкуренции запускать на PostgreSQL, не считать SQLite доказательством row locking. Дополнить: другой payload с тем же ключом, повтор возврата, coupon expired/foreign customer, 100% скидка, услуга без stock, weighted quantity и snapshot после изменения имени/цены.

Миграции сначала проверяются на пустой локальной БД и обезличенной тестовой legacy fixture. Чтение исходников не подтверждает применённые migrations или безопасность старых policies; перед серверной реализацией сверить полную цепочку и защиту RPC с выбранной версией БД. Для Supabase новые grants/RLS и function execute проверяются отдельно. Актуальные [рекомендации по защите API](https://supabase.com/docs/guides/api/securing-your-api) — источник проверки перед реализацией; [changelog](https://supabase.com/changelog) проверен при discovery, обновление runtime в эту работу не входило.

## 6. Передача root

Предлагаемый первый backend-модуль: **локальный Customers/CRM API с server identity/RBAC и подключением клиента POS**. После его проверки — **POS complete/refund/shift на той же базе**, без отдельного несовместимого клиентского реестра.

Для TASKS (root добавляет сам):

- [x] Найти и сопоставить исходники серверных CRM/inventory/POS; подготовить конкретные API и этапы в этом документе.
- [ ] После приёмки frontend зафиксировать contracts/permissions и поднять локальную тестовую backend-среду.
- [ ] Реализовать server identity/RBAC + customers/deals и подключить общий клиент CRM/POS.
- [ ] Реализовать транзакционные POS sale/refund/shift с customer FK, coupon и snapshots; пройти concurrency/idempotency tests.
- [ ] Подключить team/appointments/own reports, затем остальные страницы по `docs/BACKEND_HANDOFF.md`.

До handoff frontend backend-реализация остаётся следующей стадией. Само существование этого документа не означает, что сервер запущен или production готов.
