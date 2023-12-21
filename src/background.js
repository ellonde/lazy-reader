SENTENCE_DELAY = 500 // ms


function createContextMenuItem() {

    chrome.contextMenus.create({
        id: "lazyReaderContextMenu",
        title: "Read it to me!",
        contexts: ["selection"],
    }, () => {
        if (chrome.runtime.lastError) {
            console.error(`Error: ${chrome.runtime.lastError.message}`);
        }
    });
    chrome.contextMenus.create({
        id: "lazyReaderFullContextMenu",
        title: "Read everything to me!",
    }, () => {
        if (chrome.runtime.lastError) {
            console.error(`Error: ${chrome.runtime.lastError.message}`);
        }
    });
}

chrome.runtime.onInstalled.addListener((details) => {
    chrome.contextMenus.removeAll(() => {
        createContextMenuItem();
    });
    if (details.reason === "install") {
        chrome.tabs.create({ url: "src/onboarding.html" });
    } else if (details.reason === "update") {
        chrome.tabs.create({ url: "src/onboarding.html" });
    }
});

chrome.runtime.onStartup.addListener(() => {
    console.log(`onStartup()`);
});


chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "lazyReaderContextMenu") {
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: getSelectedText
        }, (results) => {
            if (results && results.length > 0) {
                const selectedText = results[0].result;
                ReadText(selectedText, tab.id);
            }
        });
    }
    if (info.menuItemId === "lazyReaderFullContextMenu") {
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: getFullText
        }, (results) => {
            if (results && results.length > 0) {
                const fullText = results[0].result;
                chrome.tabs.sendMessage(tab.id, { action: "confirmReading", textLength: fullText.length }, (response) => {
                    if (response.confirm) {
                        ReadText(fullText, tab.id);
                    }
                })
            }
        });
    }
});


function ReadText(text, tabId) {
    const chunks = text.split(/\. |:/).filter(sentence => sentence.trim().length > 0);
    processChunks(chunks, 0, tabId);
}

function getSelectedText() {
    return window.getSelection().toString();
}

function getFullText() {
    const documentClone = document.cloneNode(true);
    const article = new Readability(documentClone).parse();

    if (!article) {
        console.log('No article found');
        return null
    }
    return article.title + ". " + article.textContent;
}

function cleanTextWithRegex(text) {
    // Example: Remove all characters except alphanumeric and basic punctuation
    return text.replace(/[^a-zA-ZæøåÆØÅ0-9 .,?!]/g, '');
}


function arrayBufferToBase64(arrayBuffer) {
    let binaryString = '';
    const bytes = new Uint8Array(arrayBuffer);
    const len = bytes.byteLength;

    for (let i = 0; i < len; i++) {
        binaryString += String.fromCharCode(bytes[i]);
    }

    return btoa(binaryString);
}

// Function to set the extension icon
function setExtensionProcessing(action, tabId) {
    const path = action === "speaking" ? 'speaking.png' : action === "processing" ? 'processing.png': 'app-icon.png'
 
    chrome.action.setIcon({
        path: {
            "16": path,
            "19": path,
            "32": path,
            "38": path
        },
        tabId: tabId
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error setting icon:', chrome.runtime.lastError);
      }
      console.log("set icon")
    });
  }
  

async function processChunk(chunk) {
    config = await getConfig();
    
    const apiKey = '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'; // Store this securely
    const url = 'https://api.openai.com/v1/audio/speech';
    const text = cleanTextWithRegex(chunk);
    const data = {
        model: config.model,
        input: text,
        voice: config.speaker,
        speed: config.speed,
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            console.log("Error processing chunk", response.error, response.statsus, response.textContent)
            console.log("Skipping chunk", chunk);
            return "";
        }
        setUsage(text.length);
        const arrayBuffer = await response.arrayBuffer();
        const base64String = arrayBufferToBase64(arrayBuffer);
        return base64String;  // Return the result to be used by the caller
    } catch (error) {
        console.error('Error:', error);
        throw error;  // Re-throw the error to be caught by the caller
    }
}

function setUsage(tokensUsed) {
    getUsage().then((usage) => {
        const newUsage = usage + tokensUsed;
        console.log("setting usage in bg:", usage, newUsage);
        chrome.storage.sync.set({ 'usage': newUsage });    
    });
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

function getConfig() {
    return new Promise((resolve, reject) => {
        // Use Promise.all to wait for all storage data to be fetched
        Promise.all([
            getStorageData('speed', 1.0),
            getStorageData('apiKey'),
            getStorageData('speaker', 'onyx'),
            getStorageData('model', 'standard')
        ]).then(values => {
            // Construct the data object from the resolved promises
            const data = {
                speed: values[0],
                apiKey: values[1],
                speaker: values[2],
                model: values[3] === 'hd' ? 'tts-1-hd' : 'tts-1'
            };
            resolve(data);
        }).catch(error => {
            reject(error);
        });
    });
}

// Helper function to fetch data from storage and return a promise
function getStorageData(key, defaultValue = null) {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get(key, function (result) {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else if (result[key] !== undefined) {
                resolve(result[key]);
            } else if (defaultValue !== null) {
                resolve(defaultValue);
            } else {
                reject(`No value found for ${key}`);
            }
        });
    });
}

// Register to be called from onboarding script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "tryIt") {
        ReadText('You can use me for reading an entire page by right clicking and selecting Read everything to me! You can also select parts by marking it and right clicking. You can change the settings of my speed, voice and model in the extension. You can also see approximately how much you have spent.', sender.tab.id);
    } else if (message.action === "setIcon") {
        setExtensionProcessing(message.state, sender.tab.id);
    }
});

function processChunks(chunks, index, tabId) {
    if (index >= chunks.length) return; // Stop when all chunks are processed
    if (index === 0) {
        setExtensionProcessing("processing", tabId);
    } else {
        setExtensionProcessing("processing", tabId);
    }
    // Process the chunk (e.g., send to an API to get audio data)
    // For demonstration, let's assume we call a function `processChunk(chunk)`
    processChunk(chunks[index])
        .then(audioData => {
            chrome.tabs.sendMessage(tabId, { action: "audioData", data: audioData });
            setTimeout(() => processChunks(chunks, index + 1, tabId), SENTENCE_DELAY);
        })
        .catch(error => {
            console.error('Error processing chunk:', error);
            // Decide how to handle the error. Skip this chunk, or stop processing, etc.
        });
}
