
function createContextMenuItem() {

    chrome.contextMenus.create({
        id: "lazyReaderContextMenu",
        title: "Read it to me!",
        contexts: ["selection"],
    }, () => {
        if (chrome.runtime.lastError) {
            console.error(`Error: ${chrome.runtime.lastError.message}`);
        } else {
            console.log("Context menu item created successfully");
        }
    });
    chrome.contextMenus.create({
        id: "lazyReaderFullContextMenu",
        title: "Read everything to me!",
    }, () => {
        if (chrome.runtime.lastError) {
            console.error(`Error: ${chrome.runtime.lastError.message}`);
        } else {
            console.log("Context menu item created successfully");
        }
    });
}

chrome.runtime.onInstalled.addListener((details) => {
    chrome.contextMenus.removeAll(() => {
        createContextMenuItem();
    });
    if (details.reason === "install") {
        console.log("Extension installed, opening onboarding page");
        chrome.tabs.create({ url: "onboarding.html" });
    } else if (details.reason === "update") {
        console.log("Extension updated");
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
                console.log('Selected text:', selectedText);
                const chunks = selectedText.split(/\. |:/).filter(sentence => sentence.trim().length > 0);
                processChunks(chunks, 0, tab.id);
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
                        const chunks = fullText.split(/\.|:/).filter(sentence => sentence.trim().length > 0);
                        // processChunks(chunks, 0, tab.id);

                        console.log("Running with speed: ",);
                    }
                })
            }
        });
    }
});


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

async function processChunk(chunk) {
    config = await getConfig();
    const apiKey = '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'; // Store this securely
    const url = 'https://api.openai.com/v1/audio/speech';
    const text = cleanTextWithRegex(chunk);
    const data = {
        model: getModelType(),
        input: text,
        voice: getSpeaker(),
        speed: getSpeed()
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
    const currentUsage = getUsage();
    usage = currentUsage + tokensUsed;
    chrome.storage.sync.set({ 'usage': usage }, function () {
        console.log('Saved usage: ' + usage);
    });
}

function getUsage() {
    console.log('Getting usage');
    chrome.storage.sync.get('usage', function (data) {
        if (data.usage) {
            return data.usage;
        } else {
            return 0;
        }
    });
}

function getConfig() {
    return new Promise((resolve, reject) => {
        console.log('Getting speed');
        data = {};
        chrome.storage.sync.get('speed', function (data) {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else if (data.speed) {
                data['speed'] = data.speed;
            } else {
                data['speed'] = 1.0;
            }
        });
        chrome.storage.sync.get('apiKey', function (data) {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else if (data.apiKey) {
                data['apiKey'] = data.apiKey;
            } else {
                reject("No API key found");
            }
        });
        chrome.storage.sync.get('speaker', function (data) {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else if (data.speaker) {
                data['speaker'] = data.speaker;
            } else {
                data['speaker'] = "onyx";
            }
        });
        chrome.storage.sync.get('speaker', function (data) {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else if (data.speaker) {
                if (data.model === 'standard') {
                    data['model'] = "tts-1";
                } else if (data.model === 'hd') {
                    data['model'] = "tts-1-hd";
                }
            } else {
                data['speaker'] = "onyx";
            }
        });
        resolve(data);
    });
}

function getSpeed() {
    return new Promise((resolve, reject) => {
        console.log('Getting speed');
        chrome.storage.sync.get('speed', function (data) {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else if (data.speed) {
                resolve(data.speed);
            } else {
                resolve(1.0);
            }
        });
    });
}

function getSpeaker() {
    chrome.storage.sync.get('speaker', function (data) {
        if (data.speaker) {
            return data.speaker;
        } else {
            return "onyx";
        }
    });
}

async function getModelType() {
    const modelType = await chrome.storage.sync.get('model', function (data) {
        if (data.model) {
            if (data.model === 'standard') {
                return "tts-1";
            } else if (data.model === 'hd') {
                return "tts-1-hd";
            }
        } else {
            return "tts-1";
        }
    });
}


function processChunks(chunks, index, tabId) {
    if (index >= chunks.length) return; // Stop when all chunks are processed

    // Process the chunk (e.g., send to an API to get audio data)
    // For demonstration, let's assume we call a function `processChunk(chunk)`
    processChunk(chunks[index])
        .then(audioData => {
            chrome.tabs.sendMessage(tabId, { type: "audioData", data: audioData });
            setTimeout(() => processChunks(chunks, index + 1, tabId), 1000);
        })
        .catch(error => {
            console.error('Error processing chunk:', error);
            // Decide how to handle the error. Skip this chunk, or stop processing, etc.
        });
}
