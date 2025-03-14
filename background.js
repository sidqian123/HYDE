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

// Listen for extension icon clicks
chrome.action.onClicked.addListener(async (tab) => {
    try {
        // Check if we can inject the content script
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
        });
        
        // Send message after ensuring content script is loaded
        await chrome.tabs.sendMessage(tab.id, { action: "togglePopup" });
    } catch (error) {
        console.error('Error:', error);
    }
});

// Rest of your background code for handling allergens
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.type === "INGREDIENTS_FOUND") {
        console.log("Received ingredients:", message.data);
        
        // Get current allergens
        const { allergens = [] } = await chrome.storage.local.get(['allergens']);
        
        let extractedIngredients = message.data
            .split(/[,.]/)
            .map(i => i.trim().toLowerCase())
            .filter(i => i.length > 1);
            
        console.log("Processed ingredients:", extractedIngredients);
        console.log("Current allergens:", allergens);

        let flagged = [];
        let processed = new Set();

        for (let ingredient of extractedIngredients) {
            if (processed.has(ingredient)) continue;
            processed.add(ingredient);

            // Check for matches
            for (let allergen of allergens) {
                if (ingredient.includes(allergen.toLowerCase())) {
                    console.log(`Match found: ${ingredient} contains ${allergen}`);
                    flagged.push(ingredient);
                    break;
                }
            }
        }

        // Save results
        await chrome.storage.local.set({
            lastCheck: {
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
