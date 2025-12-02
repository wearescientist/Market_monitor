// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'PLAY_SOUND') {
        playAudio(message.source);
    }
});

async function playAudio(source) {
    try {
        const audio = new Audio(source);
        await audio.play();
    } catch (error) {
        console.error('Error playing audio:', error);
    }
}
