// background.js
import APIHandler from './api-handler.js';
import CryptoUtils from './crypto-utils.js';

const ALARM_NAME = 'priceCheck';
const DEFAULT_INTERVAL = 10; // seconds
const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';
const NOTIFICATION_COOLDOWN_MS = 60000;

// In-memory cache for decrypted keys (lost on service worker restart)
let decryptedKeysCache = {};
let currentPassword = null;
let creatingOffscreen = null;

// Default tokens configuration
const DEFAULT_TOKENS = [
    { symbol: 'BTCUSDT', apiSource: 'binance', alertPrice1: null, alertPrice2: null, lastPrice: null },
    { symbol: 'ETHUSDT', apiSource: 'binance', alertPrice1: null, alertPrice2: null, lastPrice: null },
    { symbol: 'SOLUSDT', apiSource: 'binance', alertPrice1: null, alertPrice2: null, lastPrice: null },
    { symbol: 'PAXGUSDT', apiSource: 'binance', alertPrice1: null, alertPrice2: null, lastPrice: null }
];

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
    ashare: {
        type: 'ashare',
        name: 'A股 (沪深)',
        enabled: true,
        baseUrl: 'https://qt.gtimg.cn'
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

// ==================== Initialization ====================

chrome.runtime.onInstalled.addListener(() => {
    setupAlarm();
    initializeData();
});

chrome.runtime.onStartup.addListener(() => {
    setupAlarm();
    ensureDefaultData();
});

chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ windowId: tab.windowId });
});

// ==================== Event Listeners ====================

chrome.runtime.onMessage.addListener((message) => {
    const handlers = {
        'UPDATE_SETTINGS': handleUpdate,
        'UPDATE_TOKENS': handleUpdate,
        'PLAY_TEST_SOUND': playSound,
        'PASSWORD_SET': handlePasswordSet,
        'RESET_ALL_DATA': handleResetData,
        'INIT_DEFAULT_DATA': ensureDefaultData
    };
    
    const handler = handlers[message.type];
    if (handler) handler(message);
});

chrome.notifications.onClicked.addListener((notificationId) => {
    if (notificationId !== 'unlock-required') return;
    
    chrome.windows.getCurrent().then((window) => {
        chrome.sidePanel.open({ windowId: window.id });
        chrome.notifications.clear(notificationId);
    });
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) checkPrices();
});

// ==================== Message Handlers ====================

function handleUpdate() {
    setupAlarm();
    checkPrices();
}

function handlePasswordSet(message) {
    if (message.password) currentPassword = message.password;
    
    chrome.notifications.clear('unlock-required');
    decryptedKeysCache = {}; // Force re-decryption with new password
    checkPrices();
}

function handleResetData() {
    currentPassword = null;
    decryptedKeysCache = {};
    chrome.notifications.clear('unlock-required');
}

// ==================== Data Initialization ====================

async function initializeData() {
    const result = await chrome.storage.local.get(['tokens', 'apiConfigs', 'apiKey', 'secretKey']);
    const updates = {};
    let needsUpdate = false;

    // Initialize API configs
    const apiResult = initializeApiConfigs(result);
    if (apiResult.needsUpdate) {
        updates.apiConfigs = apiResult.configs;
        needsUpdate = true;
    }

    // Migrate old API keys if present
    if ((result.apiKey || result.secretKey) && !result.apiConfigs) {
        updates.apiConfigs.binance.apiKey = result.apiKey || '';
        updates.apiConfigs.binance.secretKey = result.secretKey || '';
        chrome.storage.local.remove(['apiKey', 'secretKey']);
    }

    // Initialize tokens
    const tokenResult = initializeTokens(result.tokens);
    if (tokenResult.needsUpdate) {
        updates.tokens = tokenResult.tokens;
        needsUpdate = true;
    }

    if (needsUpdate) {
        await chrome.storage.local.set(updates);
    }
    checkPrices();
}

function initializeApiConfigs(result) {
    if (!result.apiConfigs) {
        return { configs: DEFAULT_API_CONFIGS, needsUpdate: true };
    }

    const mergedConfigs = { ...result.apiConfigs };
    let configsUpdated = false;

    for (const [apiId, defaultConfig] of Object.entries(DEFAULT_API_CONFIGS)) {
        if (!mergedConfigs[apiId]) {
            mergedConfigs[apiId] = defaultConfig;
            configsUpdated = true;
            console.log(`[Init] Added new API config: ${apiId}`);
        }
    }

    return { configs: mergedConfigs, needsUpdate: configsUpdated };
}

function initializeTokens(tokens) {
    if (!tokens || tokens.length === 0) {
        return { tokens: DEFAULT_TOKENS, needsUpdate: true };
    }

    const updatedTokens = tokens.map(migrateToken);
    const hasChanges = JSON.stringify(updatedTokens) !== JSON.stringify(tokens);
    
    return { tokens: updatedTokens, needsUpdate: hasChanges };
}

function migrateToken(token) {
    const migrated = {
        ...token,
        apiSource: token.apiSource || 'binance'
    };

    // Migrate old alertPrice to dual alerts
    if (token.alertPrice !== undefined && token.alertPrice1 === undefined) {
        migrated.alertPrice1 = token.alertPrice;
        migrated.alertPrice2 = null;
        delete migrated.alertPrice;
    }

    // Ensure both alert fields exist
    migrated.alertPrice1 = migrated.alertPrice1 ?? null;
    migrated.alertPrice2 = migrated.alertPrice2 ?? null;

    return migrated;
}

function ensureDefaultData() {
    chrome.storage.local.get(['tokens', 'apiConfigs'], (result) => {
        const updates = {};
        let needsUpdate = false;

        if (!result.apiConfigs) {
            updates.apiConfigs = DEFAULT_API_CONFIGS;
            needsUpdate = true;
        }

        if (!result.tokens || result.tokens.length === 0) {
            updates.tokens = DEFAULT_TOKENS;
            needsUpdate = true;
        }

        if (needsUpdate) {
            chrome.storage.local.set(updates);
        }
    });
}

// ==================== Alarm Setup ====================

function setupAlarm() {
    chrome.storage.local.get(['refreshInterval'], (result) => {
        const intervalSeconds = result.refreshInterval || DEFAULT_INTERVAL;
        chrome.alarms.create(ALARM_NAME, {
            periodInMinutes: intervalSeconds / 60
        });
    });
}

// ==================== Sound Playback ====================

async function setupOffscreenDocument(path) {
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [chrome.runtime.getURL(path)]
    });

    if (existingContexts.length > 0) return;

    if (creatingOffscreen) {
        await creatingOffscreen;
        return;
    }

    creatingOffscreen = chrome.offscreen.createDocument({
        url: path,
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'Notification sounds for price alerts',
    });
    
    await creatingOffscreen;
    creatingOffscreen = null;
}

async function playSound() {
    await setupOffscreenDocument(OFFSCREEN_DOCUMENT_PATH);
    chrome.runtime.sendMessage({
        type: 'PLAY_SOUND',
        source: 'sounds/alert.wav'
    });
}

// ==================== Encryption & API Config ====================

async function getDecryptedApiConfig(apiConfig, apiId) {
    // Return cached if available
    if (decryptedKeysCache[apiId]) {
        return {
            ...apiConfig,
            apiKey: decryptedKeysCache[apiId].apiKey,
            secretKey: decryptedKeysCache[apiId].secretKey
        };
    }
    
    // No encryption needed
    const hasEncrypted = apiConfig.apiKeyEncrypted || apiConfig.secretKeyEncrypted;
    if (!hasEncrypted) return apiConfig;
    
    // Encrypted but no password
    if (!currentPassword) {
        sendUnlockNotification();
        throw new Error('API keys encrypted - user unlock required');
    }
    
    // Decrypt keys
    try {
        const decrypted = await decryptApiConfig(apiConfig);
        decryptedKeysCache[apiId] = {
            apiKey: decrypted.apiKey,
            secretKey: decrypted.secretKey
        };
        return decrypted;
    } catch (error) {
        handleDecryptionError(error);
    }
}

async function decryptApiConfig(apiConfig) {
    const decrypted = { ...apiConfig };
    
    if (apiConfig.apiKeyEncrypted) {
        decrypted.apiKey = await CryptoUtils.decrypt(apiConfig.apiKeyEncrypted, currentPassword);
    }
    if (apiConfig.secretKeyEncrypted) {
        decrypted.secretKey = await CryptoUtils.decrypt(apiConfig.secretKeyEncrypted, currentPassword);
    }
    
    return decrypted;
}

function handleDecryptionError(error) {
    console.error('Failed to decrypt API keys:', error);
    currentPassword = null;
    decryptedKeysCache = {};
    sendUnlockNotification();
    throw new Error('Failed to decrypt API keys - wrong password?');
}

// ==================== Notifications ====================

let lastUnlockNotificationTime = 0;

function sendUnlockNotification() {
    const now = Date.now();
    if (now - lastUnlockNotificationTime < NOTIFICATION_COOLDOWN_MS) return;
    
    lastUnlockNotificationTime = now;
    
    chrome.notifications.create('unlock-required', {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Assets Monitor - Unlock Required',
        message: 'Please open the extension and enter your password to fetch prices.',
        priority: 1,
        requireInteraction: true
    });
}

function sendNotification(symbol, price, alertPrice, alertNum) {
    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Price Alert!',
        message: `${symbol} has reached ${price} (Alert ${alertNum}: ${alertPrice})`,
        priority: 2
    });
}

// ==================== Price Checking ====================

async function checkPrices() {
    const data = await chrome.storage.local.get(['tokens', 'apiConfigs']);
    const tokens = data.tokens || [];
    const apiConfigs = data.apiConfigs || {};

    if (tokens.length === 0) return;

    const result = await fetchAllPrices(tokens, apiConfigs);
    
    if (result.pricesChanged) {
        await chrome.storage.local.set({ tokens: result.updatedTokens });
        notifyPopup();
    }
}

async function fetchAllPrices(tokens, apiConfigs) {
    const updatedTokens = [];
    let pricesChanged = false;
    let unlockRequired = false;

    for (const token of tokens) {
        const result = await fetchTokenPrice(token, apiConfigs);
        
        if (result.unlockRequired) unlockRequired = true;
        if (result.updated) pricesChanged = true;
        
        updatedTokens.push(result.token);
    }

    return { updatedTokens, pricesChanged, unlockRequired };
}

async function fetchTokenPrice(token, apiConfigs) {
    const apiSource = token.apiSource || 'binance';
    const rawConfig = apiConfigs[apiSource];

    if (!rawConfig) {
        console.error(`API config not found for ${apiSource}`);
        return { token, updated: false, unlockRequired: false };
    }

    if (!rawConfig.enabled) {
        console.warn(`API ${apiSource} is disabled for ${token.symbol}`);
        return { token, updated: false, unlockRequired: false };
    }

    try {
        const apiConfig = await getDecryptedApiConfig(rawConfig, apiSource);
        const priceData = await fetchPriceWithSymbol(apiConfig, token.symbol, apiSource);
        
        checkPriceAlerts(token, priceData.currentPrice);
        
        return {
            token: createUpdatedToken(token, priceData),
            updated: true,
            unlockRequired: false
        };
    } catch (error) {
        if (error.message.includes('unlock required')) {
            return { token, updated: false, unlockRequired: true };
        }
        console.error(`Error fetching ${token.symbol} from ${apiSource}:`, error);
        return { token, updated: false, unlockRequired: false };
    }
}

function fetchPriceWithSymbol(apiConfig, symbol, apiSource) {
    const normalizedSymbol = normalizeSymbol(symbol, apiSource);
    return APIHandler.fetchPrice(apiConfig, normalizedSymbol);
}

function normalizeSymbol(symbol, apiSource) {
    if (apiSource === 'ashare') return symbol;
    if (symbol.endsWith('USDT') || symbol.endsWith('BTC') || symbol.endsWith('ETH')) return symbol;
    return symbol + 'USDT';
}

function checkPriceAlerts(token, currentPrice) {
    if (!token.lastPrice) return;
    
    checkSingleAlert(token, currentPrice, token.alertPrice1, 1);
    checkSingleAlert(token, currentPrice, token.alertPrice2, 2);
}

function checkSingleAlert(token, currentPrice, alertPrice, alertNum) {
    if (!alertPrice) return;
    
    const crossedUp = token.lastPrice < alertPrice && currentPrice >= alertPrice;
    const crossedDown = token.lastPrice > alertPrice && currentPrice <= alertPrice;
    
    if (!crossedUp && !crossedDown) return;
    
    sendNotification(token.symbol, currentPrice, alertPrice, alertNum);
    playSound();
}

function createUpdatedToken(token, priceData) {
    return {
        ...token,
        lastPrice: priceData.currentPrice,
        priceChangePercent: priceData.priceChangePercent,
        history: priceData.history,
        stockName: priceData.stockName || token.stockName
    };
}

function notifyPopup() {
    chrome.runtime.sendMessage({ type: 'PRICES_UPDATED' }).catch(() => {
        // Popup might be closed, ignore error
    });
}
