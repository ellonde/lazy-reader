// In content.js
let audioQueue = [];
let isAudioPlaying = false;


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "audioData") {
        const audioData = request.data;
        if (audioData.length === 0) {
            return;
        }
        audioQueue.push(request.data);
        if (!isAudioPlaying) {
            playNextInQueue();
        }
    }
    else if (request.action === "confirmReading") {
        const cost = ((request.textLength / 1000) * 0.015).toFixed(3);
        const confirmed = confirm(`Text is ${request.textLength} characters long and will cost around $${cost}. Still wants to listen?`);
        sendResponse({ confirm: confirmed });
    }
});


function playNextInQueue() {
    
    if (audioQueue.length === 0) {
        isAudioPlaying = false;
        return;
    }
    if (isAudioPlaying) {
        return;
    }

    isAudioPlaying = true;
    const audioData = audioQueue.shift();
    let arrayBuffer = Uint8Array.from(atob(audioData), c => c.charCodeAt(0));
    const blob = new Blob([arrayBuffer], {type: 'audio/mpeg'});

    const url = URL.createObjectURL(blob);
    let audio = new Audio(url);
    audio.onended = () => {
        isAudioPlaying = false;
        setTimeout(() => {
            playNextInQueue();
        }, 500); 
    };
    audio.play();
}


console.log("Content script loaded");