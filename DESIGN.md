---
version: "alpha"
name: "MacroLens Trading Navigator"
description: "Signal-first macro dashboard visual identity with dual light/dark themes."
colors:
  light-bg-canvas: "#F4F1EA"
  light-bg-surface: "#FBF8F2"
  light-bg-sidebar: "#11161B"
  light-border-subtle: "#CEC8BC"
  light-border-strong: "#9D9688"
  light-text-primary: "#1A1C1E"
  light-text-secondary: "#5E646B"
  light-text-inverse: "#F5F4F1"
  dark-bg-canvas: "#080D14"
  dark-bg-surface: "#0E141D"
  dark-bg-sidebar: "#070B11"
  dark-border-subtle: "#2A3341"
  dark-border-strong: "#3A4657"
  dark-text-primary: "#E8EDF5"
  dark-text-secondary: "#9AA6B8"
  dark-text-inverse: "#0D1219"
  accent-positive: "#57A66A"
  accent-positive-soft: "#2E6D44"
  accent-negative: "#C65A67"
  accent-negative-soft: "#7B3340"
  accent-warning: "#C5A34F"
  accent-info: "#5B8FD8"
  accent-neutral: "#7A8493"
typography:
  h1:
    fontFamily: "IBM Plex Sans"
    fontSize: 2rem
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: 0.01em
  h2:
    fontFamily: "IBM Plex Sans"
    fontSize: 1.25rem
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: 0.01em
  panel-title:
    fontFamily: "IBM Plex Mono"
    fontSize: 0.875rem
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: 0.06em
  body-md:
    fontFamily: "IBM Plex Sans"
    fontSize: 0.9375rem
    fontWeight: 400
    lineHeight: 1.45
  body-sm:
    fontFamily: "IBM Plex Sans"
    fontSize: 0.8125rem
    fontWeight: 400
    lineHeight: 1.4
  metric-lg:
    fontFamily: "IBM Plex Mono"
    fontSize: 2rem
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: 0.01em
  label-caps:
    fontFamily: "IBM Plex Mono"
    fontSize: 0.6875rem
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: 0.08em
rounded:
  xs: 4px
  sm: 6px
  md: 10px
  lg: 14px
spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
components:
  app-shell-1920x1080:
    width: 1920px
    height: 1080px
    backgroundColor: "{colors.light-bg-canvas}"
  sidebar-light:
    backgroundColor: "{colors.light-bg-sidebar}"
    textColor: "{colors.light-text-inverse}"
    rounded: "{rounded.md}"
    width: 280px
  sidebar-dark:
    backgroundColor: "{colors.dark-bg-sidebar}"
    textColor: "{colors.dark-text-primary}"
    rounded: "{rounded.md}"
    width: 280px
  panel-light:
    backgroundColor: "{colors.light-bg-surface}"
    textColor: "{colors.light-text-primary}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md}"
  panel-dark:
    backgroundColor: "{colors.dark-bg-surface}"
    textColor: "{colors.dark-text-primary}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md}"
  card-border-light:
    backgroundColor: "{colors.light-bg-surface}"
    textColor: "{colors.light-text-primary}"
    rounded: "{rounded.sm}"
    padding: "{spacing.sm}"
  card-border-dark:
    backgroundColor: "{colors.dark-bg-surface}"
    textColor: "{colors.dark-text-primary}"
    rounded: "{rounded.sm}"
    padding: "{spacing.sm}"
  button-primary-light:
    backgroundColor: "{colors.accent-info}"
    textColor: "{colors.light-text-inverse}"
    rounded: "{rounded.xs}"
    padding: 10px
    typography: "{typography.body-sm}"
  button-primary-dark:
    backgroundColor: "{colors.accent-info}"
    textColor: "{colors.dark-text-inverse}"
    rounded: "{rounded.xs}"
    padding: 10px
    typography: "{typography.body-sm}"
  badge-positive:
    backgroundColor: "{colors.accent-positive-soft}"
    textColor: "{colors.light-text-inverse}"
    rounded: "{rounded.xs}"
    padding: 6px
  badge-negative:
    backgroundColor: "{colors.accent-negative-soft}"
    textColor: "{colors.light-text-inverse}"
    rounded: "{rounded.xs}"
    padding: 6px
  badge-warning:
    backgroundColor: "{colors.accent-warning}"
    textColor: "{colors.light-text-primary}"
    rounded: "{rounded.xs}"
    padding: 6px
  chart-line-positive:
    backgroundColor: "{colors.accent-positive}"
    height: 2px
  chart-line-negative:
    backgroundColor: "{colors.accent-negative}"
    height: 2px
  chart-line-neutral:
    backgroundColor: "{colors.accent-neutral}"
    height: 2px
---

# MacroLens Design System

## Overview

MacroLens Trading Navigator uses a signal-dense, editorial dashboard style. The interface emphasizes fast scanning of macro state, cross-asset confirmation, and regime shifts. Visual rhythm is strict and grid-driven: high information density with controlled contrast and clear visual hierarchy.

Two appearance modes are first-class citizens:

- **Light mode** for daylight desk usage, reporting, and screenshots.
- **Dark mode** for terminal-style focus, long sessions, and chart-first monitoring.

Both modes preserve identical structure, hierarchy, and semantic status colors.

## Colors

The palette is neutral-first with semantic accents:

- **Canvas and surface neutrals** define reading comfort and panel separation.
- **Positive/negative accents** communicate directional market interpretation.
- **Info and warning accents** support policy events, volatility flags, and neutral watch states.

Status colors are semantic and stable across both themes:

- `accent-positive` always means constructive or improving conditions.
- `accent-negative` always means deteriorating or risk-off conditions.
- `accent-warning` indicates caution, compressed confidence, or transitional states.
- `accent-info` is interactive/active UI emphasis (selected controls, key CTA).

## Typography

The type system pairs a geometric sans with a technical mono cadence:

- Sans (`IBM Plex Sans`) for readable body and narrative labels.
- Mono (`IBM Plex Mono`) for scores, compact headers, axis labels, and tabular values.

Guidelines:

- Use `h1` only for page-level title rows.
- Use `panel-title` for panel headings and compact section labels.
- Use `metric-lg` only for key KPIs (probability, cycle score, policy score).
- Use `label-caps` for micro labels, ticker badges, and compact legends.

## Layout

Target composition is fixed to **1920x1080** (`components.app-shell-1920x1080`).

Primary layout rules:

- Left sidebar width stays fixed at `280px`.
- Main content uses a strict 12-column dashboard grid.
- Default inter-panel gap is `spacing.md`.
- Panel internal padding is `spacing.md` for primary cards and `spacing.sm` for dense rows.
- Keep critical KPI row within the top 35% of viewport height for immediate scanability.

## Elevation & Depth

Depth is minimal and mostly border-based:

- Light mode uses quiet neutral borders (`light-border-subtle` / `light-border-strong`).
- Dark mode uses low-luminance border contrast (`dark-border-subtle` / `dark-border-strong`).
- Heavy shadows are avoided; separation comes from tone shifts and thin strokes.

## Shapes

Rounded geometry is modest and consistent:

- Navigation and panels use `rounded.sm` to `rounded.md`.
- Compact controls (chips, badges) use `rounded.xs`.
- Avoid fully pill-shaped controls unless they represent explicit state chips.

## Components

Core mappings:

- `sidebar-light` / `sidebar-dark` define left navigation identity.
- `panel-light` / `panel-dark` define all major dashboard containers.
- `card-border-light` / `card-border-dark` define dense metric and table blocks.
- `button-primary-light` / `button-primary-dark` define action emphasis.
- `badge-positive`, `badge-negative`, `badge-warning` define status chips.
- `chart-line-positive`, `chart-line-negative`, `chart-line-neutral` define line semantics in sparkline and micro chart contexts.

Usage:

- Prefer mode-specific container components first, then semantic accents for meaning.
- Never repurpose positive/negative colors for decorative-only purposes.
- Keep chart line thickness stable (`2px`) to avoid false importance encoding.

## Do's and Don'ts

- **Do** keep light and dark mode semantically identical.
- **Do** reserve strongest contrast for key scores and active regime labels.
- **Do** keep panel titles short and scannable in uppercase mono style.
- **Do** use semantic badges for direction rather than arbitrary color picks.

- **Don't** mix mode tokens in a single rendered surface.
- **Don't** use warning color as a default accent.
- **Don't** add deep drop shadows that break the flat editorial character.
- **Don't** exceed 1080p layout bounds for primary desktop composition.
