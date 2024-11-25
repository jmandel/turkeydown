# Thanksgiving 2024
## Recipes

### Wild Rice Soup (#fetch)
https://cooking.nytimes.com/recipes/1021942-pressure-cooker-mushroom-and-wild-rice-soup

### Broccoli Rabe (#llm)
Simple sautéed broccoli rabe with garlic and a touch of red pepper flakes.

## Dishes to Prepare
Wild rice soup, Broccoli Rabe

## Formatted Recipes (#llm)

Here is a recipe for reference:
{{Recipes#foreach}}

Convert this into a simple structured markdown with title (#), ingredients (##), and steps (##). Example:

    # Peanut Butter Cookies

    ## Ingredients
    - 1 cup peanut butter
    - 1 cup sugar
    - 1 large egg

    ## Steps
    1. Preheat oven to 350°F. Mix all ingredients in a bowl until smooth.
    2. Roll dough into 1-inch balls and place on baking sheet. Press down with a fork to make criss-cross pattern.
    3. Bake for 10 minutes until edges are lightly golden.

## Prep Plan (#llm)

Here is a series of recipes we are going to make for Thanksgiving:
{{Formatted Recipes}}

Now we'll create a prep schedule starting Sunday night through mealtime Thursday, emphasizing make-ahead where it improves or doesn't detract from quality -- while also consolidating prep steps smartly.

Now output a table where the rows are days (Sunday night, Monday, Tuesday, Wednesday, Thursday), and include a separate column for each of the following dishes: {{Dishes to Prepare}}. This way we can see what prep steps should happen at which cell (time x dish).

Notes:
  * Focus Sunday on Turkey prep only.
  * Baked goods should be baked fresh on Thanksgiving unless they strictly benefit form make-ahead.