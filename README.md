# turkeydown

A specialized markdown processor for planning complex meals like Thanksgiving dinner. Process recipes from multiple sources, generate AI-assisted prep schedules, and create consolidated shopping lists - all driven by a simple markdown format.

## Features

- 📝 Process structured markdown with nested sections and dependencies
- 🔗 Fetch and parse recipes from cooking websites
- 🤖 Process content with AI (Claude 3.5 Sonnet)
- 📊 Smart handling of repeated tasks with `#per-child` and `{{variable#per}}`
- 📁 Organized output with debug info
- 🔄 Template variable substitution

## Installation

```bash
# Clone the repository
git clone https://github.com/jmandel/turkeydown
cd turkeydown

# Install dependencies
bun install
```

Requirements:
- Bun runtime
- `llm` CLI tool configured with Claude access

## Usage

Create a markdown file with sections marked for different types of processing:

```markdown
# Thanksgiving 2024

## Recipes (#llm #per-child)

Consider the recipe below. Convert it into sructured markdown with title (###), ingredients (####), 
and steps (####).

### Wild Rice Soup (#fetch)
https://cooking.nytimes.com/recipes/1021942-pressure-cooker-mushroom-and-wild-rice-soup

### Turkey Roulade (#llm)
Fussy but delicious breast meat rolls, stuffed with dark meat sausage, skin-wrapped and oven roasted.

## Prep Plan (#llm)
Here are our recipes:
{{Recipes}}

Create a prep schedule starting Sunday through Thursday...

## Shopping List (#llm)
Based on these formatted recipes:
{{Recipes}}

Create a consolidated shopping list organized by department...
```

Process the file:
```bash
bun run src/index.ts input.md
```

## Special Processing Directives

### Resolution Types
- `#fetch`: Fetches and parses content from URLs
- `#llm`: Processes content using AI
- `#passthrough`: Keeps content as-is (default)

### Processing Modifiers
- `#per-child`: Processes each child section separately
  - Useful for applying the same transformation to multiple recipes
- `{{variable#per}}`: References each item in a section separately
  - Allows iteration over items in a section

## Example: Recipe Processing

```markdown
## Recipes (#llm #per-child)
Format each recipe below into a consistent structure...

### Wild Rice Soup (#fetch)
https://cooking.nytimes.com/recipes/wild-rice-soup

### Green Beans (#fetch)
https://cooking.nytimes.com/recipes/green-beans
```

The `#per-child` directive tells the processor to:
1. Process each child section (Wild Rice Soup, Green Beans)
2. Apply the parent section's LLM prompt to each one
3. Combine the results

## Output Structure

```
output/
  thanksgiving-2024/
    debug/
      section-processing-details.json
    recipes.md
    prep-plan.md
    shopping-list.md
```

## Template Variables

- Basic: `{{Section Name}}` - Includes entire section content
- Per-item: `{{Section Name#per}}` - References each item in a section separately
- Dependencies are automatically resolved in the correct order

## License

MIT

## Contributing

Contributions welcome! Please feel free to submit a Pull Request.
