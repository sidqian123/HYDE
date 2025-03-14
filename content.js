// Beauty product page detection patterns
const BEAUTY_PATTERNS = {
    urls: [
        /sephora\.com/i,
        /ulta\.com/i,
        /maccosmetics\.com/i,
        /fentybeauty\.com/i,
        /glossier\.com/i,
        /cultbeauty\.com/i,
        /lookfantastic\.com/i,
        /boots\.com/i,
        /yesstyle\.com/i,
        /skinstore\.com/i
    ],
    keywords: [
        'beauty', 'cosmetic', 'makeup', 'skincare', 'foundation',
        'lipstick', 'mascara', 'serum', 'moisturizer', 'cleanser'
    ]
};

// Enhanced ingredient section identifiers
const INGREDIENT_IDENTIFIERS = {
    headers: [
        'ingredients:', 
        'ingredients list:', 
        'composition:', 
        'what\'s in it:', 
        'full ingredients list:',
        'contains:',
        'made with:',
        'formulated with:',
        'key ingredients:',
        'active ingredients:'
    ],
    containers: [
        '[data-ingredients]',
        '[class*="ingredient"]',
        '[class*="Ingredient"]',
        '[id*="ingredient"]',
        '[id*="Ingredient"]',
        '.product-ingredients',
        '.ingredients-list',
        '#ingredients',
        '[data-component="IngredientList"]',
        '.product-composition'
    ]
};

// Check if current page is a beauty product page
function isBeautyProductPage() {
    const url = window.location.href;
    const pageText = document.body.innerText.toLowerCase();
    
    // Check URL patterns
    if (BEAUTY_PATTERNS.urls.some(pattern => pattern.test(url))) {
        return true;
    }

    // Check for beauty-related keywords in the page
    const keywordCount = BEAUTY_PATTERNS.keywords.reduce((count, keyword) => {
        return count + (pageText.includes(keyword.toLowerCase()) ? 1 : 0);
    }, 0);

    return keywordCount >= 2; // If at least 2 beauty-related keywords are found
}

// Extract text from element while preserving some formatting
function extractFormattedText(element) {
    let text = '';
    const childNodes = element.childNodes;

    for (let node of childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
            text += node.textContent.trim() + ' ';
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === 'BR' || node.tagName === 'P' || node.tagName === 'DIV') {
                text += '\n';
            }
            text += extractFormattedText(node);
        }
    }

    return text.trim();
}

// Find all potential ingredient sections
function findIngredientSections() {
    let sections = [];

    // Method 1: Search by common selectors
    INGREDIENT_IDENTIFIERS.containers.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
            const text = extractFormattedText(element);
            if (text) sections.push(text);
        });
    });

    // Method 2: Search by headers in text content
    const allElements = document.getElementsByTagName('*');
    for (let element of allElements) {
        const text = extractFormattedText(element);
        if (INGREDIENT_IDENTIFIERS.headers.some(header => 
            text.toLowerCase().includes(header.toLowerCase())
        )) {
            sections.push(text);
        }
    }

    // Method 3: Search in structured data
    const structuredData = document.querySelectorAll('script[type="application/ld+json"]');
    structuredData.forEach(script => {
        try {
            const data = JSON.parse(script.textContent);
            console.log(data);
            if (data.ingredients || data.recipeIngredient) {
                sections.push(JSON.stringify(data.ingredients || data.recipeIngredient));
            }
        } catch (e) {
            console.debug('Error parsing structured data:', e);
        }
    });

    return sections;
}

// Clean and normalize ingredient text
function cleanIngredientText(text) {
    return text
        .replace(/([a-z])([A-Z])/g, '$1, $2') // Split camelCase
        .replace(/\([^)]*\)/g, '') // Remove parentheses and their contents
        .replace(/\d+%/g, '') // Remove percentages
        .replace(/\s+/g, ' ') // Normalize whitespace
        .replace(/[^\w\s,.-]/g, '') // Remove special characters except comma, period, hyphen
        .replace(/may contain.*$/i, '') // Remove "may contain" section
        .trim();
}

// Extract and process ingredients
function extractIngredients() {
    const sections = findIngredientSections();
    let allIngredients = new Set();

    sections.forEach(section => {
        const cleanedText = cleanIngredientText(section);
        const ingredients = cleanedText
            .split(/[,.]/)
            .map(i => i.trim().toLowerCase())
            .filter(i => i.length > 1); // Remove single characters

        ingredients.forEach(ingredient => allIngredients.add(ingredient));
    });

    return Array.from(allIngredients).join(', ');
}

// Initialize and set up observers
function initialize() {
    if (isBeautyProductPage()) {
        // Create a MutationObserver to watch for dynamic content changes
        const observer = new MutationObserver(debounce(() => {
            const ingredients = extractIngredients();
            if (ingredients) {
                chrome.runtime.sendMessage({ 
                    type: "INGREDIENTS_FOUND", 
                    data: ingredients 
                });
            }
        }, 1000));

        // Start observing
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Initial scan
        const ingredients = extractIngredients();
        if (ingredients) {
            chrome.runtime.sendMessage({ 
                type: "INGREDIENTS_FOUND", 
                data: ingredients 
            });
        }
    }
}

// Utility function to debounce observer callbacks
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Listen for manual scan requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "RESCAN_PAGE") {
        const ingredients = extractIngredients();
        if (ingredients) {
            chrome.runtime.sendMessage({ 
                type: "INGREDIENTS_FOUND", 
                data: ingredients 
            });
        }
    }
});

// Initialize when the page loads
initialize();

// Initialize popup state
let popup = null;
let isDragging = false;
let currentX;
let currentY;
let initialX;
let initialY;
let xOffset = 0;
let yOffset = 0;

// Listen for extension icon click
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Message received:", request);
    if (request.action === "togglePopup") {
        if (!popup) {
            createPopup();
        } else {
            removePopup();
        }
    }
});

// Create popup immediately when extension loads
createPopup();

function createPopup() {
    console.log("Creating popup");
    // Create popup container
    popup = document.createElement('div');
    popup.className = 'beauty-guard-popup';
    
    // Add your existing popup HTML content
    popup.innerHTML = `
        <div class="container">
            <div class="header">
                <button class="close-button">×</button>
                <h1>Beauty Guard</h1>
                <div class="animation-circle" id="scanningCircle"></div>
            </div>

            <div class="section">
                <h2>Your Allergens</h2>
                <div class="input-wrapper">
                    <input type="text" id="allergenInput" placeholder="Type to add allergen...">
                    <div id="autocompleteList" class="autocomplete-items"></div>
                </div>
                <button id="addAllergen" class="gradient-button">Add</button>
                <div class="allergen-tags" id="allergenTags"></div>
            </div>

            <div class="section">
                <h2>Scan Results</h2>
                <button id="refreshScan" class="gradient-button">Refresh Scan</button>
                <div class="results-container">
                    <div class="ingredients-wheel" id="ingredientsWheel"></div>
                    <div class="alert-container" id="alertContainer"></div>
                </div>
            </div>
        </div>
    `;

    // Add drag functionality
    popup.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    // Add to page
    document.body.appendChild(popup);
    
    // Initialize popup functionality
    initializePopup();

    // Add close button event listener after creating the popup
    popup.querySelector('.close-button').addEventListener('click', removePopup);
}

function dragStart(e) {
    if (e.target === popup) {
        isDragging = true;
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;
        popup.classList.add('dragging');
    }
}

function drag(e) {
    if (isDragging) {
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
        xOffset = currentX;
        yOffset = currentY;
        setTranslate(currentX, currentY, popup);
    }
}

function dragEnd(e) {
    isDragging = false;
    popup.classList.remove('dragging');
}

function setTranslate(xPos, yPos, el) {
    el.style.transform = `translate(${xPos}px, ${yPos}px)`;
}

function removePopup() {
    if (popup) {
        document.body.removeChild(popup);
        popup = null;
    }
}

// Initialize popup functionality
function initializePopup() {
    const elements = {
        allergenInput: document.getElementById("allergenInput"),
        addButton: document.getElementById("addAllergen"),
        refreshButton: document.getElementById("refreshScan"),
        allergenTags: document.getElementById("allergenTags"),
        alertContainer: document.getElementById("alertContainer"),
        autocompleteList: document.getElementById("autocompleteList")
    };

    // Common ingredient database for autocomplete
    const commonIngredients = {
        "Dimethicone": ["dimethicone", "dimethylpolysiloxane"],
        "Octyldodecanol": ["octyl dodecanol", "2-octyldodecanol", "2 octyl dodecanol"],
        "Titanium Dioxide": ["titanium dioxide", "ti02", "titanium oxide"],
        "Glycerin": ["glycerin", "glycerine", "glycerol"],
        "Phenoxyethanol": ["phenoxyethanol"],
        "Tocopherol": ["tocopherol", "vitamin e"],
        "Niacinamide": ["niacinamide", "vitamin b3", "nicotinamide"],
        "Hyaluronic Acid": ["hyaluronic acid", "sodium hyaluronate"],
        "Salicylic Acid": ["salicylic acid", "beta hydroxy acid", "bha"],
        "Retinol": ["retinol", "vitamin a", "retinyl palmitate"],
        "Parabens": ["methylparaben", "propylparaben", "butylparaben", "ethylparaben"],
        "Fragrance": ["fragrance", "parfum", "perfume", "aroma"],
        "Sodium Lauryl Sulfate": ["sls", "sodium lauryl sulfate", "sodium dodecyl sulfate"],
        "Propylene Glycol": ["propylene glycol", "1,2-propanediol"],
        "Benzyl Alcohol": ["benzyl alcohol"],
        "Methylisothiazolinone": ["methylisothiazolinone", "mi", "methylisothiazoline"]
    };

    let currentAllergens = new Set();

    // Load saved allergens
    chrome.storage.local.get(["allergens"], function (result) {
        if (result.allergens) {
            currentAllergens = new Set(result.allergens);
            updateAllergenTags();
        }
    });

    // Autocomplete functionality
    elements.allergenInput.addEventListener("input", function() {
        const value = this.value.toLowerCase().trim();
        console.log("Search value:", value);
        
        elements.autocompleteList.innerHTML = "";
        elements.autocompleteList.style.display = "none";

        if (value.length < 1) return;

        // Search through main ingredients and their variations
        const matches = Object.entries(commonIngredients).filter(([main, variations]) => {
            const mainMatch = main.toLowerCase().includes(value);
            const variationMatch = variations.some(v => v.toLowerCase().includes(value));
            return mainMatch || variationMatch;
        });

        console.log("Found matches:", matches);

        if (matches.length > 0) {
            elements.autocompleteList.style.display = "block";
            matches.forEach(([main, variations]) => {
                const div = document.createElement("div");
                div.className = "autocomplete-item";
                
                let displayText = main;
                const matchIndex = main.toLowerCase().indexOf(value);
                if (matchIndex !== -1) {
                    const beforeMatch = main.slice(0, matchIndex);
                    const matchedPart = main.slice(matchIndex, matchIndex + value.length);
                    const afterMatch = main.slice(matchIndex + value.length);
                    displayText = `${beforeMatch}<strong>${matchedPart}</strong>${afterMatch}`;
                }
                
                div.innerHTML = displayText;
                
                div.addEventListener("click", () => {
                    elements.allergenInput.value = main;
                    elements.autocompleteList.style.display = "none";
                });
                
                div.title = `Also known as: ${variations.join(", ")}`;
                elements.autocompleteList.appendChild(div);
            });
        }
    });

    // Update allergen tags display
    function updateAllergenTags() {
        elements.allergenTags.innerHTML = "";
        currentAllergens.forEach(allergen => {
            const tag = document.createElement("div");
            tag.className = "tag";
            tag.innerHTML = `
                ${allergen}
                <span class="remove-tag">×</span>
            `;
            
            tag.querySelector('.remove-tag').addEventListener('click', (e) => {
                e.stopPropagation();
                currentAllergens.delete(allergen);
                updateAllergenTags();
                saveAllergensAndScan();
            });
            
            elements.allergenTags.appendChild(tag);
        });
    }

    // Save allergens and trigger scan
    function saveAllergensAndScan() {
        chrome.storage.local.set({ 
            "allergens": Array.from(currentAllergens) 
        }, () => {
            // Extract ingredients from the page
            const ingredients = extractIngredients();
            if (ingredients) {
                // Update the UI with scan results
                updateScanResults(ingredients);
            }
        });
    }

    // Update scan results in the UI
    function updateScanResults(ingredients) {
        const ingredientsList = ingredients.split(',').map(i => i.trim().toLowerCase());
        const matches = Array.from(currentAllergens).filter(allergen => 
            ingredientsList.some(ingredient => ingredient.includes(allergen.toLowerCase()))
        );

        elements.alertContainer.innerHTML = "";
        
        if (matches.length > 0) {
            const alert = document.createElement('div');
            alert.className = 'alert danger';
            alert.innerHTML = `
                <span class="alert-icon">⚠️</span>
                <span>Found ${matches.length} potential allergen${matches.length > 1 ? 's' : ''}: ${matches.join(", ")}</span>
            `;
            elements.alertContainer.appendChild(alert);
        } else {
            const alert = document.createElement('div');
            alert.className = 'alert success';
            alert.innerHTML = `
                <span class="alert-icon">✅</span>
                <span>No allergens detected in this product</span>
            `;
            elements.alertContainer.appendChild(alert);
        }
    }

    // Add new allergen
    function addNewAllergen() {
        const value = elements.allergenInput.value.trim();
        if (value) {
            currentAllergens.add(value.toLowerCase());
            elements.allergenInput.value = "";
            updateAllergenTags();
            saveAllergensAndScan();
        }
    }

    // Event listeners
    elements.addButton.addEventListener("click", addNewAllergen);
    elements.allergenInput.addEventListener("keypress", function(e) {
        if (e.key === "Enter") {
            addNewAllergen();
        }
    });
    elements.refreshButton.addEventListener("click", () => {
        const ingredients = extractIngredients();
        if (ingredients) {
            updateScanResults(ingredients);
        }
    });

    // Close autocomplete on click outside
    document.addEventListener("click", function(e) {
        if (!elements.allergenInput.contains(e.target) && 
            !elements.autocompleteList.contains(e.target)) {
            elements.autocompleteList.style.display = "none";
        }
    });
}

// Create popup when the script loads
console.log("Content script loaded");
