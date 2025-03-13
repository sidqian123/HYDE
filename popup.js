document.addEventListener("DOMContentLoaded", function () {
    let allergenInput = document.getElementById("allergenList");
    let saveButton = document.getElementById("saveAllergens");
    let resultContainer = document.getElementById("results");
    let refreshButton = document.getElementById("refreshScan");
    let manualInput = document.getElementById("manualIngredients");
    let checkManualButton = document.getElementById("checkManual");

    // Load saved allergens
    chrome.storage.local.get(["allergens"], function (result) {
        if (result.allergens) {
            allergenInput.value = result.allergens.join(", ");
        }
    });

    // Save new allergens and trigger a rescan
    saveButton.addEventListener("click", function () {
        let allergens = allergenInput.value.split(",").map(a => a.trim().toLowerCase());
        chrome.storage.local.set({ "allergens": allergens }, function () {
            triggerPageScan();
        });
    });

    // Refresh button handler
    refreshButton.addEventListener("click", function() {
        triggerPageScan();
    });

    // Manual check button handler
    checkManualButton.addEventListener("click", function() {
        let ingredients = manualInput.value;
        if (ingredients) {
            chrome.runtime.sendMessage({ 
                type: "INGREDIENTS_FOUND", 
                data: ingredients 
            });
            // Wait a bit for processing to complete
            setTimeout(updateResults, 500);
        }
    });

    function triggerPageScan() {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs.length === 0 || !tabs[0].id) return;

            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                files: ["content.js"]
            }, () => {
                if (chrome.runtime.lastError) {
                    console.error(chrome.runtime.lastError.message);
                } else {
                    chrome.tabs.sendMessage(tabs[0].id, { type: "RESCAN_PAGE" });
                    // Wait a bit for processing to complete
                    setTimeout(updateResults, 500);
                }
            });
        });
    }

    function updateResults() {
        chrome.storage.local.get(["lastCheck"], function (data) {
            if (data.lastCheck) {
                let { extractedIngredients, flagged } = data.lastCheck;
                let resultHtml = "<h3>Detected Ingredients:</h3><ul>";

                extractedIngredients.forEach(ingredient => {
                    if (flagged.includes(ingredient)) {
                        resultHtml += `<li style="color: red; font-weight: bold;">${ingredient} (⚠ Allergen!)</li>`;
                    } else {
                        resultHtml += `<li>${ingredient}</li>`;
                    }
                });

                resultHtml += "</ul>";

                if (flagged.length === 0) {
                    resultHtml += "<p style='color: green;'>✅ No allergens detected.</p>";
                }

                resultContainer.innerHTML = resultHtml;
            } else {
                resultContainer.innerHTML = "<p>No scan yet.</p>";
            }
        });
    }

    // Initial results load
    updateResults();
});
