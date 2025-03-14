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
