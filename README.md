# Meal Planner Home Assistant Add-on

A simple meal planner with AI-powered ingredient formatting using Google Gemini.

## Installation

1. Add this repository to your Home Assistant Add-on Store.
2. Install the "Meal Planner" add-on.
3. Configure your `gemini_api_key` in the add-on configuration if you want to use the AI formatting features.
4. Start the add-on.
5. Open the Web UI (defaults to port 3001).

## Configuration

- `gemini_api_key`: (Optional) Your Google Gemini API key.

## Data Storage

When running as a Home Assistant add-on, all data (meal plans, recipes, and uploaded images) is stored in the `/data` partition, ensuring it persists across updates.
