
document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('apiKeyForm').addEventListener('submit', setAPIKey);
    document.getElementById('tryItBtn').addEventListener('click', (e) => {
        chrome.runtime.sendMessage({ action: "tryIt" });
    });
});

function setAPIKey(e) {
    e.preventDefault();
    var apiKeyElement = document.getElementById('apiKey');
    chrome.storage.sync.set({ 'apiKey': apiKey.value }, function() {
        const responseDiv = document.getElementById("response")
        responseDiv.style.visibility = "visible"
        apiKeyElement.value = ""
    });
}

