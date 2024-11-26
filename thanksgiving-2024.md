# Thanksgiving 2024

## Recipes (#llm #per-child)

Consider the recipe below.

Convert this into a structured markdown with title (###), ingredients (####), and steps (####), thoroughly representing the recipe and its detailed ingredients + instructions. Example for formatting purposes:

    ### Peanut Butter Cookies

    #### Ingredients
    - 1 cup peanut butter
    - 1 cup sugar
    - 1 large egg

    #### Steps
    1. Preheat oven to 350°F. Mix all ingredients in a bowl until smooth.
    2. Roll dough into 1-inch balls and place on baking sheet. Press down with a fork to make criss-cross pattern.
    3. Bake for 10 minutes until edges are lightly golden.

Recipe...

### Wild Rice Soup (#fetch)
https://cooking.nytimes.com/recipes/1021942-pressure-cooker-mushroom-and-wild-rice-soup

### Turkey and Root Veg Panzanella (#fetch)
https://www.foodnetwork.com/recipes/alton-brown/butterflied-dry-brined-roasted-turkey-with-roasted-root-vegetable-panzanella-recipe-2125794

### Sage Biscuits (#fetch)
https://www.pbs.org/food/recipes/delicata-squash-and-sage-biscuits

### Green Beans (#fetch)
https://cooking.nytimes.com/recipes/146-green-beans-with-ginger-and-garlic

### Apple Tart (#fetch)
https://cooking.nytimes.com/recipes/1025924-tahini-apple-tart

### Pumpkin Bundts (#fetch)
https://cooking.nytimes.com/recipes/1018933-pumpkin-bundt-cake-with-maple-brown-butter-glaze

### Cranberry Sauce (#fetch)
https://cooking.nytimes.com/recipes/1018928-cranberry-sauce

### Herbed Gravy (#llm)
A classic turkey gravy with fresh herbs like thyme, sage, and rosemary.

### Broccoli Rabe (#llm)
Simple sautéed broccoli rabe with garlic and a touch of red pepper flakes.

## Dishes to Prepare
Wild Rice Soup, Green Beans, Broccoli Rabe, Cranberry Sauce, Turkey, Herbed Gravy, Root Veg Panzanella, Sage Biscuits, Apple Tart, Pumpkin Bundts

## Prep Plan (#llm)

Here is a series of recipes we are going to make for Thanksgiving:
{{Recipes}}

Now we'll create a prep schedule starting Sunday night through mealtime Thursday, emphasizing make-ahead where it improves or doesn't detract from quality -- while also consolidating prep steps smartly.

Now output a table where the rows are days (Sunday night, Monday, Tuesday, Wednesday, Thursday), and include a separate column for each of the following dishes: {{Dishes to Prepare}}. This way we can see what prep steps should happen at which cell (time x dish).

Notes:
  * Focus Sunday on Turkey prep only.
  * Baked goods should be baked fresh on Thanksgiving unless they strictly benefit form make-ahead.

## Shopping List (#llm)

Here is a set of formatted recipes:
{{Recipes}}

Now prepare a combined shopping list based on the formatted recipes you provided. Organize by grocery department (###) and group duplicate ingredients across recipes. For each ingredient, list the total quantity. Below each total, listing the contributing dishes and the subquantities these dishes require, for reference. Use markdown and check boxes (☐) for all top-level ingredients so the list is easy to use.

Output the complete list without pausing for review; I've set your output token limit high to accommodate.
