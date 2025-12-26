// background.js
import APIHandler from './api-handler.js';

const ALARM_NAME = 'priceCheck';
const DEFAULT_INTERVAL = 10; // seconds
const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';

// Default API configurations
const DEFAULT_API_CONFIGS = {
    binance: {
        type: 'binance',
        name: 'Binance',
        enabled: true,
        apiKey: '',
        secretKey: '',
        baseUrl: 'https://api.binance.com/api/v3'
    },
    binanceFutures: {
        type: 'binanceFutures',
        name: 'Binance Futures',
        enabled: true,
        apiKey: '',
        secretKey: '',
        baseUrl: 'https://fapi.binance.com/fapi/v1'
    },
    coingecko: {
        type: 'coingecko',
        name: 'CoinGecko',
        enabled: false,
        apiKey: '',
        baseUrl: 'https://api.coingecko.com/api/v3'
    },
    coinmarketcap: {
        type: 'coinmarketcap',
        name: 'CoinMarketCap',
        enabled: false,
        apiKey: '',
        baseUrl: 'https://pro-api.coinmarketcap.com/v1'
    }
};

// Initialize
chrome.runtime.onInstalled.addListener(() => {
    setupAlarm();

    // Set default tokens and API configs if none exist
    chrome.storage.local.get(['tokens', 'apiConfigs', 'apiKey', 'secretKey'], (result) => {
        let needsUpdate = false;
        const updates = {};

        // Migrate old API keys to new structure if they exist
        if (!result.apiConfigs) {
            updates.apiConfigs = DEFAULT_API_CONFIGS;

            // Migrate existing Binance keys if present
            if (result.apiKey || result.secretKey) {
                updates.apiConfigs.binance.apiKey = result.apiKey || '';
                updates.apiConfigs.binance.secretKey = result.secretKey || '';
            }
            needsUpdate = true;
        }

        // Set default tokens with API source
        if (!result.tokens || result.tokens.length === 0) {
            updates.tokens = [
                { symbol: 'BTCUSDT', apiSource: 'binance', alertPrice: null, lastPrice: null },
                { symbol: 'ETHUSDT', apiSource: 'binance', alertPrice: null, lastPrice: null },
                { symbol: 'SOLUSDT', apiSource: 'binance', alertPrice: null, lastPrice: null },
                { symbol: 'PAXGUSDT', apiSource: 'binance', alertPrice: null, lastPrice: null }
            ];
            needsUpdate = true;
        } else {
            // Ensure existing tokens have apiSource field and migrate alertPrice to dual alerts
            const updatedTokens = result.tokens.map(token => {
                const migrated = {
                    ...token,
                    apiSource: token.apiSource || 'binance' // Default to binance
                };

                // Migrate old alertPrice to alertPrice1 if it exists
                if (token.alertPrice !== undefined && token.alertPrice1 === undefined) {
                    migrated.alertPrice1 = token.alertPrice;
                    migrated.alertPrice2 = null;
                    delete migrated.alertPrice; // Remove old field
                } else {
                    // Ensure both fields exist
                    migrated.alertPrice1 = token.alertPrice1 !== undefined ? token.alertPrice1 : null;
                    migrated.alertPrice2 = token.alertPrice2 !== undefined ? token.alertPrice2 : null;
                }

                return migrated;
            });
            // Only update if there was a change
            if (JSON.stringify(updatedTokens) !== JSON.stringify(result.tokens)) {
                updates.tokens = updatedTokens;
                needsUpdate = true;
            }
        }

        if (needsUpdate) {
            chrome.storage.local.set(updates, () => {
                checkPrices(); // Fetch immediately after setting defaults
            });
        } else {
            checkPrices();
        }
    });
});

chrome.runtime.onStartup.addListener(() => {
    setupAlarm();
    checkPrices();
});

// Open sidebar when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ windowId: tab.windowId });
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'UPDATE_SETTINGS' || message.type === 'UPDATE_TOKENS') {
        setupAlarm();
        checkPrices(); // Check immediately on update
    } else if (message.type === 'PLAY_TEST_SOUND') {
        playSound();
    }
});

// Listen for alarm
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
        checkPrices();
    }
});

async function setupOffscreenDocument(path) {
    // Check if an offscreen document already exists
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [chrome.runtime.getURL(path)]
    });

    if (existingContexts.length > 0) {
        return;
    }

    // Create an offscreen document
    if (creating) {
        await creating;
    } else {
        creating = chrome.offscreen.createDocument({
            url: path,
            reasons: ['AUDIO_PLAYBACK'],
            justification: 'Notification sounds for price alerts',
        });
        await creating;
        creating = null;
    }
}

let creating; // Global promise to avoid race conditions

async function playSound() {
    await setupOffscreenDocument(OFFSCREEN_DOCUMENT_PATH);
    chrome.runtime.sendMessage({
        type: 'PLAY_SOUND',
        source: 'sounds/alert.wav'
    });
}

function setupAlarm() {
    chrome.storage.local.get(['refreshInterval'], (result) => {
        const intervalSeconds = result.refreshInterval || DEFAULT_INTERVAL;
        // Alarms API uses minutes, but for short intervals we might need to use a different approach 
        // or just accept that chrome.alarms has a minimum of 1 minute for released extensions.
        // However, for unpacked extensions, it can go lower.
        // Let's try to use the periodInMinutes.

        chrome.alarms.create(ALARM_NAME, {
            periodInMinutes: intervalSeconds / 60
        });
    });
}

async function checkPrices() {
    const data = await chrome.storage.local.get(['tokens', 'apiConfigs']);
    const tokens = data.tokens || [];
    const apiConfigs = data.apiConfigs || {};

    if (tokens.length === 0) return;

    const updatedTokens = [];
    let pricesChanged = false;

    for (const token of tokens) {
        try {
            // Get the API configuration for this token
            const apiSource = token.apiSource || 'binance';
            const apiConfig = apiConfigs[apiSource];

            if (!apiConfig) {
                console.error(`API config not found for ${apiSource}`);
                updatedTokens.push(token);
                continue;
            }

            if (!apiConfig.enabled) {
                console.warn(`API ${apiSource} is disabled for ${token.symbol}`);
                updatedTokens.push(token);
                continue;
            }

            // Normalize symbol (add USDT if needed)
            let symbol = token.symbol;
            if (!symbol.endsWith('USDT') && !symbol.endsWith('BTC') && !symbol.endsWith('ETH')) {
                symbol += 'USDT';
            }

            // Fetch price data using API handler
            const priceData = await APIHandler.fetchPrice(apiConfig, symbol);

            const currentPrice = priceData.currentPrice;
            const priceChangePercent = priceData.priceChangePercent;
            const history = priceData.history;

            // Check for alert on first price
            if (token.alertPrice1 && token.lastPrice) {
                if ((token.lastPrice < token.alertPrice1 && currentPrice >= token.alertPrice1) ||
                    (token.lastPrice > token.alertPrice1 && currentPrice <= token.alertPrice1)) {
                    sendNotification(token.symbol, currentPrice, token.alertPrice1, 1);
                    playSound(); // Play sound on alert
                }
            }

            // Check for alert on second price
            if (token.alertPrice2 && token.lastPrice) {
                if ((token.lastPrice < token.alertPrice2 && currentPrice >= token.alertPrice2) ||
                    (token.lastPrice > token.alertPrice2 && currentPrice <= token.alertPrice2)) {
                    sendNotification(token.symbol, currentPrice, token.alertPrice2, 2);
                    playSound(); // Play sound on alert
                }
            }

            updatedTokens.push({
                ...token,
                lastPrice: currentPrice,
                priceChangePercent: priceChangePercent,
                history: history // Store K-line data for sparkline rendering
            });
            pricesChanged = true;

        } catch (error) {
            console.error(`Error fetching ${token.symbol} from ${token.apiSource}:`, error);
            updatedTokens.push(token); // Keep old data
        }
    }

    if (pricesChanged) {
        chrome.storage.local.set({ tokens: updatedTokens }, () => {
            // Notify popup if open
            chrome.runtime.sendMessage({ type: 'PRICES_UPDATED' }).catch(() => {
                // Popup might be closed, ignore error
            });
        });
    }
}

function sendNotification(symbol, price, alertPrice, alertNum) {
    const options = {
        type: 'basic',
        iconUrl: 'icons/icon128.png', // Make sure this exists
        title: 'Price Alert!',
        message: `${symbol} has reached ${price} (Alert ${alertNum}: ${alertPrice})`,
        priority: 2
    };

    chrome.notifications.create(options);
}
