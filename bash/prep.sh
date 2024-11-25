#!/bin/bash

set -e  # Exit immediately if a command fails

# --- Input Handling and URL Resolution ---

target_dishes_string="$1"
if [ -z "$target_dishes_string" ]; then
  echo "Usage: $0 '<Dish 1, Dish 2, Dish 3>' [folder with recipes]"
  exit 1
fi

target_dishes=$(echo "$target_dishes_string" | tr ',' '\n' | xargs)  # Split comma-separated string into array

folder="${2:-.}"  # Default to current folder if not provided
urls_file="$folder/urls.csv"
existing_txt_files=("$folder"/*.txt)

echo "./prep.sh \"$target_dishes_string\" \"$folder\"" > "$folder/invocation.sh"
# Function to extract recipe data from HTML

extract_recipe_data() {
  local url="$1"
  local html_content
  local json_data
  local recipe_data
  local text_data

  html_content=$(curl -s "$url"   -H 'sec-ch-ua-platform: "Linux"'   -H 'sec-fetch-dest: document'   -H 'sec-fetch-mode: navigate'   -H 'sec-fetch-site: none'   -H 'sec-fetch-user: ?1'   -H 'upgrade-insecure-requests: 1'   -H 'user-agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36')

  # Extract plain text using Pandoc
  text_data=$(echo "$html_content" | pandoc -f html -t plain)

  # Attempt to extract JSON-LD
  json_data=$(echo "$html_content" | pup 'script[type="application/ld+json"] text{}' | jq -r . 2>/dev/null)

  if [ -n "$json_data" ] && jq -e . >/dev/null 2>&1 <<<"$json_data"; then
    recipe_data=$(echo "$json_data" | jq -r '. | if type=="array" then .[0] else . end')
    echo "Extracted JSON-LD from: $url"
    echo -e "JSON-LD Data:\n$recipe_data\n\nExtracted Text:\n$text_data"
  else
    echo "Extracted text from (no JSON-LD found): $url"
    echo "$text_data"
  fi
}

if [ -f "$urls_file" ]; then
  while IFS= read -r url; do
    filename=$(echo "$url" | sed 's/[^a-zA-Z0-9]/_/g').txt
    filepath="$folder/$filename"

    # Check if the file already exists and contains the source URL
    if ! [[ " ${existing_txt_files[@]} " =~ " $filepath " ]] || ! grep -q "Source: $url" "$filepath"; then
      echo "Fetching and processing: $url"
      recipe_content=$(extract_recipe_data "$url")
      echo "$recipe_content" > "$filepath"
      echo "Source: $url" >> "$filepath"
      existing_txt_files+=("$filepath") # Add newly created file to the array
    else
      echo "Skipping $url (already processed): $filepath"
    fi
  done < "$urls_file"
fi

# Collect recipe content from all .txt files, including those generated
all_recipes=""
for file in "${existing_txt_files[@]}"; do
    if [[ "$file" == *.txt ]]; then
        all_recipes+=$'\n'"$file":$'\n'
        all_recipes+=$(cat "$file")
        all_recipes+=$'\n'
    fi
done

# --- Recipe Sketching ---

recipe_sketches=$(llm -m claude-3-5-sonnet-latest  <<EOF
Here are some recipes for reference:
$all_recipes

Our eventual goal is to create a prep schedule starting Sunday night through mealtime Thursday, emphasizing make ahead where it improves or doesn't detract from quality -- while also consolidating prep steps smartly. We're going to make: $target_dishes_string.

Begin by outputting a recipe sketch for each dish, focusing on the steps / sequencing / comopnents involved. When a recipe is supplied, you should use it as the basis of your sketch. If no recipe is supplied, begin with the recipe sketch so that we understand the overall process. Output all sketches wihthout pausing for confirmation or review; I've set character limits to ensure you won't run out. Separate sketches by ---
EOF
)

echo "## Recipe Sketches" > "$folder/prep.md"
echo "$recipe_sketches" >> "$folder/prep.md"

# --- Prep Schedule Table ---

prep_schedule=$(llm -m claude-3-5-sonnet-latest <<EOF
Here are some recipes for reference:
$all_recipes

Here is a collection of recipe sketches:
$recipe_sketches


Now we'll create a prep schedule starting Sunday night through mealtime Thursday, emphasizing make-ahead where it improves or doesn't detract from quality -- while also consolidating prep steps smartly.

Now output a table where the rows are days (Sunday night, Monday, Tuesday, Wednesday, Thursday), and include a separte column for each dish in: "$target_dishes_string". This way we can see what prep steps should happen at which cell (time x dish).

Notes:
  * Focus Sunday on Turkey prep only.
  * Baked goods should be baked fresh on Thanksgiving unless they strictly benefit form make-ahead.
EOF
)

echo "## Prep Schedule" >> "$folder/prep.md"
echo "$prep_schedule" >> "$folder/prep.md"

# --- Formatted Recipes ---

formatted_recipes=$(llm -m claude-3-5-sonnet-latest <<EOF
Here are some recipes for reference:
$all_recipes

Here are recipe sketches:
$recipe_sketches

Now we are going to consolidate. Output each recipe markdown with title, detailed ingredients including quantities, and prep steps written clearly. Output all recipes without waiting for confirmation or pausing for for review, just use your judgment and output all recipes. I have set the character limit to ensure your output will fit, so do not stop prematurely. Separate each recipe with a line of "---". The output recipes should be for: "$target_dishes_string"
EOF
)

echo "$formatted_recipes" > "$folder/allrecipes.md"

# --- Shopping List ---

shopping_list=$(llm -m claude-3-5-sonnet-latest <<EOF
Here are the formatted recipes:
$formatted_recipes

Now prepare a combined shopping list based on the formatted recipes you provided. Organize by grocery department and all duplicate ingredients combined to create totals, but listing the dishes and subquantities where they're used in parens. Use markdown and check boxes (☐) for a list that's easy to print/use.
EOF
)

echo "$shopping_list" > "$folder/shoppinglist.md"

echo "Thanksgiving prep files generated: prep.md, allrecipes.md, shoppinglist.md"
