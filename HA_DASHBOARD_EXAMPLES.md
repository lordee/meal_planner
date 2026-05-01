# Home Assistant Dashboard Examples

After installing the Meal Planner integration via HACS and adding it to your Integrations, you will have several sensors available. Here is how to display your meal plans on your dashboard.

## 1. Weekly Overview (Markdown Card)
This card shows the current week's plan day-by-day.

```yaml
type: markdown
title: 🍴 This Week's Menu
content: >
  **Monday**: {{ state_attr('sensor.meal_planner_current_week', 'Monday') }}

  **Tuesday**: {{ state_attr('sensor.meal_planner_current_week', 'Tuesday') }}

  **Wednesday**: {{ state_attr('sensor.meal_planner_current_week', 'Wednesday') }}

  **Thursday**: {{ state_attr('sensor.meal_planner_current_week', 'Thursday') }}

  **Friday**: {{ state_attr('sensor.meal_planner_current_week', 'Friday') }}

  **Saturday**: {{ state_attr('sensor.meal_planner_current_week', 'Saturday') }}

  **Sunday**: {{ state_attr('sensor.meal_planner_current_week', 'Sunday') }}
```

## 2. Today's Specials (Entity Card)
A simple glance at what's for dinner tonight.

```yaml
type: entity
entity: sensor.meal_planner_today
name: Tonight's Dinner
icon: mdi:silverware-fork-knife
```

## 3. Advanced: Multi-Week List (Markdown Card)
If you have multiple weeks planned, this will loop through all of them.

```yaml
type: markdown
title: 🗓️ Future Meal Plans
content: >
  {% for week in state_attr('sensor.meal_planner_all_weeks', 'weeks') %}
  ### {{ week.name }}
  {% for day in week.days %}
  **{{ day.day }}**: 
  {% if day.meals | length > 0 %}
    {{ day.meals | map(attribute='name') | join(', ') }}
  {% else %}
    *Nothing planned*
  {% endif %}
  {% endfor %}
  ---
  {% endfor %}
```

## 4. Shopping List Summary
```yaml
type: entity
entity: sensor.meal_planner_shopping_list
name: Items to Buy
```
