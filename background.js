console.log(555)
chrome.scripting.executeScript({
    target: {tabId: tab.id},
    files: ['inject.js']
});