function getApiKey() {
    chrome.storage.sync.get('apiKey', function(data) {
        if (data.apiKey) {
            return data.apiKey;
        } else {
            return null;
        }
    });
}

document.addEventListener('DOMContentLoaded', function () {
    console.log("DomContentLoaded")
    elementSetup('speed-dropdown', 'speed');
    elementSetup('speaker-dropdown', 'speaker');
    getUsage().then((usage) => {
        const usageElement = document.getElementById("usage");
        usageElement.innerText = "$" + ((usage / 1000) * 0.015).toFixed(3) + " used";
    });
});

function elementSetup(elementId, storageKey) {
    const element = document.getElementById(elementId);
    
    chrome.storage.sync.get([storageKey], function(result) {
        if (result[storageKey]) {
            element.value = result[storageKey];
        }
    });
    element.addEventListener('change', function() {
        let storageObj = {};
        storageObj[storageKey] = element.value; // Using computed property names
        chrome.storage.sync.set(storageObj, function() {
            console.log(storageKey + ' saved: ' + element.value);
        });
    });
    // element.addEventListener('change', function() {
    //     chrome.storage.sync.set({storageKey: element.value}, function() {
    //         console.log(storageKey + ' saved: ' + element.value);
    //     });
    // });
}

function getUsage() {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get('usage', function(data) {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else if (data.usage) {
                resolve(data.usage);
            } else {
                resolve(0);
            }
        });
    });
}


