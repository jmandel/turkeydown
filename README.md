# Markdown Recipe Processor

A powerful markdown processor that can fetch recipes from URLs, process them with AI, and generate organized meal prep plans. The processor handles nested sections, dependencies between sections, and can automatically fetch and parse recipe data from popular cooking websites.

## Features

- 📝 Process structured markdown documents with nested sections
- 🔗 Automatically fetch and parse recipe data from URLs
- 🤖 Process sections using AI (Claude 3.5 Sonnet)
- 📊 Generate dependency-aware processing of sections
- 📁 Debug output showing processing steps
- 🔄 Template variable substitution

## Installation

# Clone the repository
git clone [repository-url]
cd [repository-name]

# Install dependencies
bun install
```

Requirements:
- Bun runtime
- Pandoc (for text extraction)
- LLM CLI tool configured with Claude access

## Usage

Create a markdown file with sections marked for different types of processing:

```
# My Recipe Plan

## Wild Rice Soup (#fetch)
https://cooking.nytimes.com/recipes/1021942-pressure-cooker-mushroom-and-wild-rice-soup

## Prep Schedule (#llm)
Here are our recipes:
{{Wild Rice Soup}}

Create a prep schedule for the above recipes.
```

Process the file:
```
bun run src/index.ts input.md
```

## Example: Meal Prep Planning

The processor is particularly useful for meal prep planning. Here's a typical workflow:

1. Create a markdown file with sections for:
   - Recipe URLs (#fetch)
   - Recipe formatting (#llm)
   - Prep schedule generation (#llm)
   - Shopping list compilation (#llm)

2. Use template variables to pass data between sections:
   ```
   # Recipes
   
   ## Wild Rice Soup (#fetch)
   https://cooking.nytimes.com/recipes/wild-rice-soup
   
   ## Formatted Recipes (#llm)
   Here are the recipes to format:
   {{Wild Rice Soup}}
   
   ## Shopping List (#llm)
   Based on these recipes:
   {{Formatted Recipes}}
   
   Create a consolidated shopping list.
   ```

3. The processor will:
   - Fetch recipe data from URLs
   - Use AI to format recipes consistently
   - Generate a shopping list
   - Create prep schedules
   - Output each section to separate files

## Output Structure

```
output/
  inputfile/
    debug/
      section-name-input.json  # Debug info for each section
    section-name.md           # Processed output for each section
```

## Processing Types

- `#fetch`: Fetches and parses content from URLs
- `#llm`: Processes content using AI
- `#passthrough`: Keeps content as-is (default)

## Template Variables

Use `{{Section Name}}` to reference content from other sections. The processor will automatically handle dependencies and process sections in the correct order.

## License

[License Type]