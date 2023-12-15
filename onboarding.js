document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('apiKeyForm').addEventListener('submit', setAPIKey);
});

function setAPIKey(e) {
    e.preventDefault();
    console.log('Saved API Key: ' + apiKey);
    var apiKey = document.getElementById('apiKey').value;
    chrome.storage.sync.set({ 'apiKey': apiKey }, function() {
        console.log('Saved API Key: ' + apiKey);
    });
}

