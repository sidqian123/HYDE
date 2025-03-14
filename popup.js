document.addEventListener("DOMContentLoaded", function () {
    // Common ingredient database for autocomplete
    const commonIngredients = {
        "Dimethicone": "A silicone-based ingredient used for smoothing",
        "Octyldodecanol": "An emollient that helps soften skin",
        "Octyl Dodecanol": "Alternative name for Octyldodecanol",
        "2-Octyldodecanol": "Chemical name for Octyldodecanol",
        "Titanium Dioxide": "A natural mineral used as a sunscreen and colorant",
        "Glycerin": "A humectant that helps retain moisture",
        "Phenoxyethanol": "A preservative commonly used in cosmetics",
        "Tocopherol": "Vitamin E, an antioxidant",
        "Niacinamide": "Vitamin B3, helps with skin barrier function",
        "Hyaluronic Acid": "A powerful moisturizing ingredient",
        "Salicylic Acid": "A BHA exfoliant for acne-prone skin",
        "Retinol": "Vitamin A derivative for anti-aging",
        "Sodium Lauryl Sulfate": "A cleansing and foaming agent",
        "SLS": "Abbreviation for Sodium Lauryl Sulfate",
        "Parabens": "A family of preservatives",
        "Methylparaben": "A type of paraben preservative",
        "Propylparaben": "A type of paraben preservative",
        "Butylparaben": "A type of paraben preservative",
        "Fragrance": "Scent additives",
        "Parfum": "Alternative name for Fragrance",
        "Benzyl Alcohol": "A preservative and fragrance ingredient",
        "Propylene Glycol": "A moisture-carrying substance",
        "Cetyl Alcohol": "A fatty alcohol used as an emollient",
        "Stearyl Alcohol": "A fatty alcohol used as an emollient",
        "Lanolin": "A waxy substance derived from sheep's wool",
        "Mineral Oil": "A petroleum-based moisturizing agent",
        "Petrolatum": "Another name for petroleum jelly",
        "Isopropyl Myristate": "An emollient that can clog pores",
        "Benzophenone": "A sunscreen ingredient",
        "Oxybenzone": "A chemical sunscreen filter",
        "Methylisothiazolinone": "A preservative that can cause irritation",
        "MI/MCI": "Abbreviation for Methylisothiazolinone/Methylchloroisothiazolinone"
    };

    const elements = {
        allergenInput: document.getElementById("allergenInput"),
        allergenTags: document.getElementById("allergenTags"),
        addButton: document.getElementById("addAllergen"),
        refreshButton: document.getElementById("refreshScan"),
        alertContainer: document.getElementById("alertContainer"),
        autocompleteList: document.getElementById("autocompleteList"),
        scanningCircle: document.getElementById("scanningCircle")
    };

    let currentAllergens = new Set();

    // Load saved allergens
    chrome.storage.local.get(["allergens"], function (result) {
        if (result.allergens) {
            currentAllergens = new Set(result.allergens);
            updateAllergenTags();
        }
    });

    // Allergen tag management
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

    // Autocomplete functionality
    function setupAutocomplete() {
        elements.allergenInput.addEventListener("input", function() {
            const value = this.value.toLowerCase().trim();
            elements.autocompleteList.innerHTML = "";
            elements.autocompleteList.style.display = "none";

            if (value.length < 1) return;

            const matches = Object.keys(commonIngredients).filter(ingredient => {
                const ingredientLower = ingredient.toLowerCase();
                return ingredientLower.includes(value) || 
                       ingredientLower.split(/[\s-]/).some(word => word.startsWith(value));
            });

            if (matches.length > 0) {
                elements.autocompleteList.style.display = "block";
                matches.forEach(match => {
                    const div = document.createElement("div");
                    const matchIndex = match.toLowerCase().indexOf(value);
                    const beforeMatch = match.slice(0, matchIndex);
                    const matchedPart = match.slice(matchIndex, matchIndex + value.length);
                    const afterMatch = match.slice(matchIndex + value.length);
                    
                    div.innerHTML = `${beforeMatch}<strong>${matchedPart}</strong>${afterMatch}`;
                    
                    div.addEventListener("click", () => {
                        elements.allergenInput.value = match;
                        elements.autocompleteList.style.display = "none";
                    });
                    div.title = commonIngredients[match];
                    elements.autocompleteList.appendChild(div);
                });
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

    // Add new allergen function
    function addNewAllergen() {
        const value = elements.allergenInput.value.trim();
        if (value) {
            currentAllergens.add(value.toLowerCase());
            elements.allergenInput.value = "";
            updateAllergenTags();
            saveAllergensAndScan();
        }
    }

    // Save allergens and trigger scan
    function saveAllergensAndScan() {
        chrome.storage.local.set({ 
            "allergens": Array.from(currentAllergens) 
        }, triggerPageScan);
    }

    // Update alerts display
    function updateAlerts(data) {
        elements.alertContainer.innerHTML = "";
        
        if (!data || !data.lastCheck) {
            showAlert("No ingredients scanned yet", "info");
            return;
        }

        const { flagged } = data.lastCheck;
        
        if (flagged.length > 0) {
            showAlert(`Found ${flagged.length} potential allergen${flagged.length > 1 ? 's' : ''}: ${flagged.join(", ")}`, "danger");
        } else {
            showAlert("No allergens detected in this product", "success");
        }
    }

    function showAlert(message, type) {
        const alert = document.createElement("div");
        alert.className = `alert ${type}`;
        alert.innerHTML = `
            <span class="alert-icon">${type === "danger" ? "⚠️" : "✅"}</span>
            <span>${message}</span>
        `;
        elements.alertContainer.appendChild(alert);
    }

    // Trigger page scan
    function triggerPageScan() {
        elements.scanningCircle.style.animation = "none";
        setTimeout(() => elements.scanningCircle.style.animation = "pulse 2s infinite", 10);

        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (!tabs[0]?.id) return;

            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                files: ["content.js"]
            }, () => {
                if (chrome.runtime.lastError) {
                    showAlert("Unable to scan this page", "danger");
                } else {
                    chrome.tabs.sendMessage(tabs[0].id, { type: "RESCAN_PAGE" });
                    setTimeout(() => {
                        chrome.storage.local.get(["lastCheck"], function(data) {
                            updateAlerts(data);
                        });
                    }, 500);
                }
            });
        });
    }

    // Event listeners
    elements.addButton.addEventListener("click", addNewAllergen);
    elements.allergenInput.addEventListener("keypress", function(e) {
        if (e.key === "Enter") {
            addNewAllergen();
        }
    });
    elements.refreshButton.addEventListener("click", triggerPageScan);

    // Initialize
    setupAutocomplete();
    
    // Initial results load
    chrome.storage.local.get(["lastCheck"], function(data) {
        updateAlerts(data);
    });
});


