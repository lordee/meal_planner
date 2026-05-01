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
    # Note: In a real setup, host would come from config_flow
    host = "http://localhost:3001"
    async_add_entities([
        MealPlannerTodaySensor(host),
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

                    # Get today's day name
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
            _LOGGER.error("Error updating meal sensor: %s", err)

class MealPlannerShoppingListSensor(SensorEntity):
    """Sensor that displays the total number of items to buy."""
    
    _attr_name = "Meal Planner Shopping List"
    _attr_unique_id = "meal_planner_shopping"
    _attr_icon = "mdi:shopping"

    def __init__(self, host: str):
        self._host = host
        self._attr_native_value = 0

    async def async_update(self) -> None:
        """Fetch ingredients to count items."""
        try:
            # We'd ideally have a direct shopping list endpoint, 
            # but for now we calculate items from active weeks
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self._host}/api/meals") as response:
                    weeks = await response.json()
                    # (Simplified counting logic for the sensor)
                    items = 0
                    for w in [w for w in weeks if not w.get("archived")]:
                        for d in w["days"]:
                            for m in d["meals"]:
                                if m.get("ingredients"):
                                    items += len(m["ingredients"].split('\n'))
                    self._attr_native_value = items
        except Exception as err:
            _LOGGER.error("Error updating shopping sensor: %s", err)
