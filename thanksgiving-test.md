# Thanksgiving 2024

## Recipes (#llm #per-child)

Convert this into a simple structured markdown with title (###), ingredients (####), and steps (####), thoroughly representing the recipe and its detailed ingredients + instructions. Example for formatting purposes:

    ### Peanut Butter Cookies

    #### Ingredients
    - 1 cup peanut butter
    - 1 cup sugar
    - 1 large egg

    #### Steps
    1. Preheat oven to 350°F. Mix all ingredients in a bowl until smooth.
    2. Roll dough into 1-inch balls and place on baking sheet. Press down with a fork to make criss-cross pattern.
    3. Bake for 10 minutes until edges are lightly golden.

### Wild Rice Soup  (#fetch)
https://cooking.nytimes.com/recipes/1021942-pressure-cooker-mushroom-and-wild-rice-soup

### Broccoli Rabe  (#llm)
Simple sautéed broccoli rabe with garlic and a touch of red pepper flakes.

### Turkey with herbed stuffing (#llm)

spatchcoked bird; Herbed stuffing to serve along thanksgiving turkey

## Dishes to Prepare
Wild rice soup, Broccoli Rabe, Turkey, Stuffing


## Total Timing (#llm)

Add up the total active time required, and output "___ Minutes Active Time" (nothing else)

### Single Recipe Timing (#llm)

Ouptut "{minutes: number}" with estimated total active time for the following recipe: {{Recipes#per}}. No additional preamble or commentary, just the JSON.

## Prep Plan  (#llm)

Here is a series of recipes we are going to make for Thanksgiving:
{{Recipes}}

Now we'll create a prep schedule starting Sunday night through mealtime Thursday, emphasizing make-ahead where it improves or doesn't detract from quality -- while also consolidating prep steps smartly.

Now output a table where the rows are days (Sunday night, Monday, Tuesday, Wednesday, Thursday), and include a separate column for each of the following dishes: {{Dishes to Prepare}}. This way we can see what prep steps should happen at which cell (time x dish).

Notes:
  * Focus Sunday on Turkey prep only.
  * Baked goods should be baked fresh on Thanksgiving unless they strictly benefit form make-ahead.

## Shopping List  (#llm)

Here are all the recipes we're making:
{{Recipes}}

Please create a consolidated shopping list organized by department (Produce, Meat/Seafood, Dairy, Pantry, etc.). Combine quantities where possible and round up to standard package sizes. Include any basic pantry items that the recipes might assume we have (salt, pepper, oil, etc.).