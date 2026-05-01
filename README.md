# Meal Planner Integration for Home Assistant

This integration allows you to view and manage your meal plans directly in Home Assistant.

## Features
- View today's planned meals.
- See the current week's menu.
- Track shopping list items.
- Support for multiple active weeks.

## Installation
1. Install via HACS (Custom Repository).
2. Restart Home Assistant.
3. Add the "Meal Planner" integration via the UI.

## Sensors
- `sensor.meal_planner_today`: Today's meals.
- `sensor.meal_planner_current_week`: Full schedule for the current week.
- `sensor.meal_planner_all_weeks`: Data for all active weeks.
- `sensor.meal_planner_shopping_list`: Count of items in your shopping list.

## Usage
Check [HA_DASHBOARD_EXAMPLES.md](HA_DASHBOARD_EXAMPLES.md) for card configurations.