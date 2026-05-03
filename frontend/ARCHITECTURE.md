# Frontend Architecture Guide

## 1) Цель документа

Этот документ фиксирует обязательные правила для миграции фронтенда к production-ready состоянию без потери текущей функциональности и визуала.

Базовый принцип: **refactor by extraction, not rewrite**.  
Сначала декомпозиция и стандартизация, затем расширение функциональности.

---

## 2) Целевая архитектура

### 2.1 Слои

- `app/*` — только routing/layout/page orchestration.
- `features/*` — бизнес-экраны и доменная логика по модулям.
- `components/*` — reusable UI-блоки без доменной привязки.
- `lib/*` — API client, utility functions, shared hooks.
- `types/*` — общие типы контракта с backend.

### 2.2 Предлагаемая структура

```text
src/
  app/
    (routes only)
  features/
    dashboard/
      components/
      hooks/
      utils/
      constants/
      types.ts
      index.ts
    recession-monitor/
    macro-sentiment/
    fed-policy/
    yield-curve/
    inflation/
    analysis/
    forecast-lab/
    calendar-alerts/
    reports/
  components/
    ui/
    layout/
    charts/
  lib/
    api.ts
    query/
    utils.ts
  types/
    index.ts
```

---

## 3) Обязательные engineering rules

### 3.1 Размер и ответственность модулей

- `page.tsx` / screen container: до ~300 строк.
- feature component: до ~200 строк.
- helper module: до ~150 строк.
- один файл = одна основная ответственность.

Если файл стабильно растет выше лимита, декомпозиция обязательна.

### 3.2 UI vs logic separation

- UI-компоненты не содержат networking/business calculations.
- Данные и вычисления — в `features/*/hooks` и `features/*/utils`.
- `page.tsx` не должен вручную собирать всю data-пайплайн логику.

### 3.3 Data access (React Query standard)

- Все HTTP-вызовы только через `src/lib/api.ts`.
- Во feature-слое использовать typed hooks:
  - `useXxxQuery`
  - `useXxxMutation`
- Query keys хранить рядом с feature-модулем (`queryKeys.ts`), а не строками по всему проекту.
- Для каждого запроса обязательно заданы:
  - `queryKey`
  - `queryFn`
  - понятная стратегия `staleTime`
  - корректный `enabled` для зависимых запросов.

### 3.4 Theme and design tokens

- Источник правды для темы: единые design tokens.
- Запрещено дублировать палитры в нескольких местах без shared abstraction.
- Inline-стили допустимы только там, где нельзя выразить через tokenized class/style helper.

### 3.5 Модуль Next shell (`/next`, `components/next-dashboard`)

Единая точка для каркаса и визуала маршрутов под `/next`:

- **`nextDashboardConfig.ts`** — палитры, `nextDashboardCssVars` (CSS variables на корень shell), `nextDashboardCssTokenColors` (на экране обычно импортируют как `C`), `NEXT_DASHBOARD_NAV_ITEMS`.
- **`nextPanelSurface.ts` / `NextPanel.tsx`** — оформление панелей/карточек; новые страницы используют только эти хелперы, без произвольных border/background.
- **`nextShellTheme.tsx`** — `NextShellThemeProvider` (монтируется в `app/next/layout.tsx`), `useNextShellTheme()` возвращает `shellThemeVars`, `toggleTheme`, `colors` (те же семантические токены, что и `nextDashboardCssTokenColors`).
- **`index.ts`** — публичный barrel: импорты вида `@/components/next-dashboard`.

Новая страница в новом shell: страница под `/next` уже внутри провайдера → `useNextShellTheme()` + `NextDashboardShell` + стили панелей из `nextPanelSurface` / `NextPanel`.

### 3.6 Type safety

- `any` запрещен.
- Типы API-контрактов определяются в `src/types/index.ts`.
- Runtime fallback обязателен для nullable-полей backend.

---

## 4) Definition of Done для каждого migrated section

Раздел считается перенесенным только если выполнено все:

1. **Feature parity**
   - Совпадают ключевые данные, подписи, состояния, интерактив.
2. **State parity**
   - Обработаны `loading`, `error`, `empty`, `stale`.
3. **Theme parity**
   - Проверены `dark` и `light`.
4. **Navigation parity**
   - Корректные route transitions и active states в sidebar.
5. **Quality gates**
   - `npm run lint`
   - `npm run build`
   - TypeScript без ошибок.
6. **Smoke checklist**
   - Ручная проверка критичных пользовательских сценариев.

---

## 5) План декомпозиции `NextDashboardScreen`

Порядок фиксирован, чтобы не терять реализацию:

1. Вынести shell:
   - sidebar
   - shell header/footer controls
   - theme toggle / collapse behavior
2. Вынести data-layer:
   - `useDashboardData` (queries + normalization)
   - `useDashboardViewState` (local UI state)
3. Вынести dashboard sections:
   - `NavigatorPanel`
   - `CrossAssetPanel`
   - `ActiveRegimePanel`
   - `RecessionPanel`
   - `FedPolicyPanel`
   - `YieldCurvePanel`
   - `RecommendationSnapshotPanel`
4. Вынести helpers:
   - форматтеры
   - color mappers
   - tilt/signal normalizers
5. После extraction включить route-level reuse:
   - общая оболочка для `/next/*`
   - отдельные feature pages вместо placeholder-mode в одном монолите.

---

## 6) Anti-patterns (запрещено)

- Огромный screen-компонент, который одновременно:
  - делает networking
  - содержит layout shell
  - рисует все секции
  - хранит всю утилитарную логику
- Повтор query keys строками по файлам.
- Дублирование palette/theme объектов в разных feature-файлах.
- Перекрестные импорты feature-модулей друг в друга без shared слоя.

---

## 7) Migration strategy

- Идем по одному разделу.
- Каждый шаг — небольшой и ревьюабельный.
- Сначала extraction без изменения поведения.
- Затем точечная чистка и улучшения.
- Старые роуты держим через безопасные redirect-переходы до полного parity.

Это гарантирует, что можно сделать код архитектурно чистым и не потерять текущую реализацию.
