# Businnes OS

Русский frontend prototype AI-native Business Operating System. React 19, TypeScript, Vinext (Next.js-compatible App Router), Tailwind CSS, Lucide, Recharts, XYFlow.

## Запуск

```sh
pnpm install
pnpm dev
```

## Проверка и сборка

```sh
pnpm exec tsc --noEmit
pnpm build
```

## Архитектура

- app/[[...slug]]/page.tsx: все маршруты workspace
- features/LifeOS.tsx: shell, CRM, диалоги, AI Center, настройки и AI Setup
- features/BusinessModules.tsx: календарь, сотрудники, база знаний, финансы, маркетинг и автоматизации
- features/Builder.tsx: интерактивный XYFlow workflow editor
- features/Dashboard.tsx: аналитика и графики
- components/os/ui.tsx: общие drawer, modal, metric, badge и поиск
- lib/os/data.ts: типы и демоданные
- lib/os/storage.ts: локальная persistence

Всё, включая AI, интеграции, сообщения, индексацию и workflow, работает как frontend simulation. Внешние запросы не выполняются. Изменения хранятся в localStorage данного браузера. Переключатель workspace меняет выбранное название, но не создаёт изоляцию данных. Настоящие API, авторизация, серверные права и исполнение агентов требуют backend.

Проверено: TypeScript и production build. Браузерные клики и responsive screenshots не проверены: обязательный control-browser для Sites недоступен в текущей среде.
