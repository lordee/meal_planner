"""Support for Meal Planner sensors."""
from __future__ import annotations
import aiohttp
import logging
from datetime import datetime

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

_LOGGER = logging.getLogger(__name__)

async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the sensor platform."""
    # Note: Host would ideally come from config_flow/entry.data
    host = "http://localhost:3001"
    async_add_entities([
        MealPlannerTodaySensor(host),
        MealPlannerCurrentWeekSensor(host),
        MealPlannerAllWeeksSensor(host),
        MealPlannerShoppingListSensor(host)
    ], True)

class MealPlannerTodaySensor(SensorEntity):
    """Sensor that displays today's planned meals."""
    
    _attr_name = "Meal Planner Today"
    _attr_unique_id = "meal_planner_today"
    _attr_icon = "mdi:silverware-fork-knife"

    def __init__(self, host: str):
        self._host = host
        self._attr_native_value = "No meals"
        self._attr_extra_state_attributes = {}

    async def async_update(self) -> None:
        """Fetch data from the API."""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self._host}/api/meals") as response:
                    weeks = await response.json()
                    active_weeks = [w for w in weeks if not w.get("archived")]
                    if not active_weeks:
                        self._attr_native_value = "No active week"
                        return

                    today = datetime.now().strftime("%A")
                    current_week = active_weeks[0]
                    day_plan = next((d for d in current_week["days"] if d["day"] == today), None)
                    
                    if day_plan and day_plan["meals"]:
                        meal_names = [m["name"] for m in day_plan["meals"]]
                        self._attr_native_value = ", ".join(meal_names)
                        self._attr_extra_state_attributes = {"meals": day_plan["meals"]}
                    else:
                        self._attr_native_value = "Nothing planned"
        except Exception as err:
            _LOGGER.error("Error updating today sensor: %s", err)

class MealPlannerCurrentWeekSensor(SensorEntity):
    """Sensor for the entire current week."""
    
    _attr_name = "Meal Planner Current Week"
    _attr_unique_id = "meal_planner_current_week"
    _attr_icon = "mdi:calendar-week"

    def __init__(self, host: str):
        self._host = host
        self._attr_native_value = "No week"
        self._attr_extra_state_attributes = {}

    async def async_update(self) -> None:
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self._host}/api/meals") as response:
                    weeks = await response.json()
                    active_weeks = [w for w in weeks if not w.get("archived")]
                    if not active_weeks:
                        self._attr_native_value = "None"
                        return

                    week = active_weeks[0]
                    self._attr_native_value = week["name"]
                    
                    attrs = {}
                    for day in week["days"]:
                        meals = [m["name"] for m in day["meals"]]
                        attrs[day["day"]] = ", ".join(meals) if meals else "Nothing"
                        attrs[f"{day['day']}_detailed"] = day["meals"]
                    
                    self._attr_extra_state_attributes = attrs
        except Exception as err:
            _LOGGER.error("Error updating current week sensor: %s", err)

class MealPlannerAllWeeksSensor(SensorEntity):
    """Sensor that exposes all active weeks as structured data."""
    
    _attr_name = "Meal Planner All Weeks"
    _attr_unique_id = "meal_planner_all_weeks"
    _attr_icon = "mdi:calendar-multiple"

    def __init__(self, host: str):
        self._host = host
        self._attr_native_value = 0
        self._attr_extra_state_attributes = {}

    async def async_update(self) -> None:
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self._host}/api/meals") as response:
                    weeks = await response.json()
                    active_weeks = [w for w in weeks if not w.get("archived")]
                    self._attr_native_value = len(active_weeks)
                    self._attr_extra_state_attributes = {"weeks": active_weeks}
        except Exception as err:
            _LOGGER.error("Error updating all weeks sensor: %s", err)

class MealPlannerShoppingListSensor(SensorEntity):
    """Sensor that counts total unique shopping items."""
    
    _attr_name = "Meal Planner Shopping List"
    _attr_unique_id = "meal_planner_shopping"
    _attr_icon = "mdi:shopping"

    def __init__(self, host: str):
        self._host = host
        self._attr_native_value = 0
        self._attr_extra_state_attributes = {}

    async def async_update(self) -> None:
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self._host}/api/meals") as response:
                    weeks = await response.json()
                    active_weeks = [w for w in weeks if not w.get("archived")]
                    
                    ingredients_set = set()
                    detailed_list = []
                    
                    for w in active_weeks:
                        for d in w["days"]:
                            for m in d["meals"]:
                                if m.get("ingredients"):
                                    for line in m["ingredients"].split('\n'):
                                        parts = line.split('|')
                                        name = parts[-1].strip().lower() if len(parts) >= 3 else line.strip().lower()
                                        if name:
                                            ingredients_set.add(name)
                                            detailed_list.append(line.strip())
                    
                    self._attr_native_value = len(ingredients_set)
                    self._attr_extra_state_attributes = {
                        "total_unique_items": len(ingredients_set),
                        "raw_list": detailed_list
                    }
        except Exception as err:
            _LOGGER.error("Error updating shopping sensor: %s", err)
