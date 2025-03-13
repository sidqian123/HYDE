function extractIngredients() {
    let pageText = document.body.innerText.toLowerCase();
    let ingredientKeywords = [
        "ingredients:", 
        "ingredients list:", 
        "composition:", 
        "contains:",
        "made with:",
        "what's inside",
        "what's in it"
    ];

    // First try to find ingredient sections
    let ingredientSection = "";
    let lines = pageText.split("\n").map(line => line.trim());
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        if (ingredientKeywords.some(keyword => line.includes(keyword.toLowerCase()))) {
            // Collect the next few lines that might contain ingredients
            let nextLines = lines.slice(i, i + 15).join(" ");
            ingredientSection += " " + nextLines;
        }
    }

    // If no section found, try broader search
    if (!ingredientSection) {
        // Look for common ingredient patterns
        let patterns = [
            /ingredients:?\s*([^.]+)/i,
            /contains:?\s*([^.]+)/i,
            /made with:?\s*([^.]+)/i
        ];

        for (let pattern of patterns) {
            let match = pageText.match(pattern);
            if (match && match[1]) {
                ingredientSection += " " + match[1];
            }
        }
    }

    // Clean up the ingredients text
    if (ingredientSection) {
        // Remove common non-ingredient text
        ingredientSection = ingredientSection
            .replace(/([a-z])([A-Z])/g, '$1, $2') // Split camelCase
            .replace(/\([^)]*\)/g, '') // Remove parentheses and their contents
            .replace(/\d+%/g, '') // Remove percentages
            .replace(/\s+/g, ' ') // Normalize whitespace
            .replace(/[^\w\s,.-]/g, ''); // Remove special characters except comma, period, hyphen

        // Split into individual ingredients
        let ingredients = ingredientSection
            .split(/[,.]/)
            .map(i => i.trim())
            .filter(i => i.length > 1) // Remove single characters
            .filter((item, index, self) => self.indexOf(item) === index); // Remove duplicates

        return ingredients.join(", ");
    }
    
    return "";
}

// Send extracted ingredients to background.js
function extractIngredientsAndSend() {
    let ingredients = extractIngredients();
    chrome.runtime.sendMessage({ type: "INGREDIENTS_FOUND", data: ingredients });
}

// Listen for messages from popup.js and trigger ingredient extraction
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "RESCAN_PAGE") {
        extractIngredientsAndSend();
    }
});
