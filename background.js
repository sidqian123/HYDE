let modelSession = null;

// Enhanced ingredient database with more specific variations and categories
const ingredientDatabase = {
    "octyldodecanol": {
        variations: ["octyl dodecanol", "2-octyldodecanol"],
        safeVariations: ["hydrogenated octyldodecanol"], // ingredients that contain the word but are different
        category: "emollient"
    }
    // Add more ingredients as needed
};

let userAllergens = [];

// Load allergens from storage
chrome.storage.local.get(["allergens"], function (result) {
    if (result.allergens) {
        userAllergens = result.allergens;
    }
});

// Compute cosine similarity
function cosineSimilarity(vecA, vecB) {
    let dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    let magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    let magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return dotProduct / (magnitudeA * magnitudeB);
}

// Simplified embedding function for demo purposes
// In a real implementation, you'd need to implement proper tokenization and inference
async function getEmbedding(text) {
    // Temporary simplified embedding generation
    // This is a placeholder that returns a random 4D vector
    return Array(4).fill(0).map(() => Math.random() * 2 - 1);
}

// Find similar ingredients
async function findSimilarIngredients(ingredient) {
    let inputEmbedding = await getEmbedding(ingredient);
    let bestMatch = null;
    let highestScore = 0;

    for (let [name, embedding] of Object.entries(ingredientDatabase)) {
        let similarity = cosineSimilarity(inputEmbedding, embedding);
        if (similarity > highestScore) {
            highestScore = similarity;
            bestMatch = name;
        }
    }

    return highestScore > 0.75 ? bestMatch : null;
}

// Improved matching function
function isIngredientMatch(ingredient, allergen) {
    ingredient = ingredient.toLowerCase().trim();
    allergen = allergen.toLowerCase().trim();
    
    // Exact match check
    if (ingredient === allergen) return true;
    
    // Check database
    if (ingredientDatabase[allergen]) {
        // Check variations
        if (ingredientDatabase[allergen].variations.includes(ingredient)) return true;
        
        // Check if it's not a safe variation
        if (ingredientDatabase[allergen].safeVariations?.some(safe => 
            ingredient === safe.toLowerCase()
        )) return false;
    }
    
    // Word boundary check to prevent partial word matches
    const wordBoundaryPattern = new RegExp(`\\b${allergen}\\b`, 'i');
    return wordBoundaryPattern.test(ingredient);
}

// Process extracted ingredients with improved matching
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.type === "INGREDIENTS_FOUND") {
        console.log("Received ingredients:", message.data);
        
        let extractedIngredients = message.data
            .split(/[,.]/)
            .map(i => i.trim().toLowerCase())
            .filter(i => i.length > 1);
            
        console.log("Processed ingredients:", extractedIngredients);
        console.log("Current allergens:", userAllergens);

        let flagged = [];
        let processed = new Set();

        for (let ingredient of extractedIngredients) {
            if (processed.has(ingredient)) continue;
            processed.add(ingredient);

            // Check for matches
            for (let allergen of userAllergens) {
                allergen = allergen.toLowerCase().trim();
                ingredient = ingredient.toLowerCase().trim();
                
                console.log(`Comparing - Ingredient: "${ingredient}" with Allergen: "${allergen}"`);
                
                // Direct match or contains
                if (ingredient === allergen || ingredient.includes(allergen)) {
                    console.log("Match found!");
                    flagged.push(ingredient);
                    break;
                }
            }
        }

        console.log("Flagged ingredients:", flagged);

        // Save results for popup
        chrome.storage.local.set({ 
            "lastCheck": { 
                extractedIngredients: Array.from(processed), 
                flagged 
            } 
        });

        if (flagged.length > 0) {
            chrome.notifications.create({
                type: "basic",
                iconUrl: "icon.png",
                title: "Allergen Alert!",
                message: `Potential allergen detected: ${flagged.join(", ")}`
            });
        }
    }
});
