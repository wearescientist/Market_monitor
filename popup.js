import CryptoUtils from './crypto-utils.js';

document.addEventListener('DOMContentLoaded', () => {
  // ==================== DOM Element References ====================
  const elements = {
    tokenList: document.getElementById('token-list'),
    addTokenBtn: document.getElementById('add-token'),
    symbolInput: document.getElementById('token-symbol'),
    apiSelector: document.getElementById('api-selector'),
    settingsBtn: document.getElementById('settings-btn'),
    settingsPanel: document.getElementById('settings-panel'),
    refreshInterval: document.getElementById('refresh-interval'),
    refreshBtn: document.getElementById('refresh-btn'),
    testSoundBtn: document.getElementById('test-sound-btn'),
    saveIntervalBtn: document.getElementById('save-interval-btn'),
    // API Management
    apiProviderList: document.getElementById('api-provider-list'),
    apiConfigSection: document.getElementById('api-config-section'),
    apiConfigTitle: document.getElementById('api-config-title'),
    apiName: document.getElementById('api-name'),
    apiUrl: document.getElementById('api-url'),
    configApiKey: document.getElementById('config-api-key'),
    configSecretKey: document.getElementById('config-secret-key'),
    configPassphrase: document.getElementById('config-passphrase'),
    saveApiConfig: document.getElementById('save-api-config'),
    // Password protection
    passwordSection: document.getElementById('password-section'),
    masterPassword: document.getElementById('master-password'),
    confirmPassword: document.getElementById('confirm-password'),
    passwordLabel: document.getElementById('password-label'),
    unlockBtn: document.getElementById('unlock-btn'),
    setPasswordBtn: document.getElementById('set-password-btn'),
    forgotPasswordBtn: document.getElementById('forgot-password-btn'),
    resetConfirm: document.getElementById('reset-confirm'),
    confirmResetBtn: document.getElementById('confirm-reset-btn'),
    cancelResetBtn: document.getElementById('cancel-reset-btn'),
    passwordStatus: document.getElementById('password-status'),
  };

  // ==================== State ====================
  const state = {
    previousPrices: {},
    currentApiId: null,
    editingTokenSymbol: null,
    masterPassword: null,
    isFirstTimeSetup: false,
  };

  // ==================== Constants ====================
  const PREDEFINED_APIS = ['binance', 'binanceFutures', 'coingecko', 'coinmarketcap'];
  const MIN_PASSWORD_LENGTH = 6;
  const MIN_REFRESH_INTERVAL = 5;
  const DEFAULT_FONT_SIZE = '0.6rem';
  const FONT_SIZE_MAP = [
    { digits: 7, size: '0.48rem' },
    { digits: 6, size: '0.52rem' },
    { digits: 5, size: '0.56rem' },
  ];

  // ==================== Initialization ====================
  checkPasswordStatus();
  setupEventListeners();

  // ==================== Event Listener Setup ====================
  function setupEventListeners() {
    // Main actions
    elements.addTokenBtn.addEventListener('click', addToken);
    elements.settingsBtn.addEventListener('click', () => elements.settingsPanel.classList.toggle('hidden'));
    elements.symbolInput.addEventListener('keypress', (e) => e.key === 'Enter' && addToken());

    // API & Settings
    elements.saveApiConfig?.addEventListener('click', saveAPIConfig);
    elements.refreshBtn?.addEventListener('click', handleRefresh);
    elements.saveIntervalBtn?.addEventListener('click', saveIntervalSettings);
    elements.testSoundBtn?.addEventListener('click', playTestSound);

    // Password protection
    elements.setPasswordBtn?.addEventListener('click', setMasterPassword);
    elements.unlockBtn?.addEventListener('click', unlockWithPassword);
    elements.forgotPasswordBtn?.addEventListener('click', showForgotPassword);
    elements.confirmResetBtn?.addEventListener('click', resetAllData);
    elements.cancelResetBtn?.addEventListener('click', hideForgotPassword);

    // Password input handlers
    elements.masterPassword?.addEventListener('keypress', handlePasswordKeypress);
    elements.confirmPassword?.addEventListener('keypress', (e) => e.key === 'Enter' && setMasterPassword());

    // Background message listener
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'PRICES_UPDATED') loadTokens();
    });
  }

  // ==================== Password Protection ====================
  async function checkPasswordStatus() {
    const result = await chrome.storage.local.get(['hasCompletedSetup']);
    state.isFirstTimeSetup = !result.hasCompletedSetup;
    state.isFirstTimeSetup ? showPasswordSetup() : showPasswordUnlock();
  }

  function showPasswordSetup() {
    togglePasswordUI({
      label: 'Set Master Password',
      status: `Welcome! Set a password to protect your data. Minimum ${MIN_PASSWORD_LENGTH} characters.`,
      showUnlock: false,
      showSetPassword: true,
      showForgot: false,
      showConfirm: true,
    });
    elements.masterPassword.value = '';
    elements.confirmPassword.value = '';
    elements.masterPassword.focus();
  }

  function showPasswordUnlock() {
    togglePasswordUI({
      label: 'Enter Password',
      status: 'Enter your master password to access your data.',
      showUnlock: true,
      showSetPassword: false,
      showForgot: true,
      showConfirm: false,
    });
    elements.masterPassword.value = '';
    elements.masterPassword.focus();
  }

  function togglePasswordUI(config) {
    elements.passwordSection.classList.remove('hidden');
    elements.apiProviderList.classList.add('hidden');
    elements.apiConfigSection.classList.add('hidden');
    
    elements.passwordLabel.textContent = config.label;
    elements.passwordStatus.textContent = config.status;
    
    elements.unlockBtn.classList.toggle('hidden', !config.showUnlock);
    elements.setPasswordBtn.classList.toggle('hidden', !config.showSetPassword);
    elements.forgotPasswordBtn.classList.toggle('hidden', !config.showForgot);
    elements.confirmPassword.classList.toggle('hidden', !config.showConfirm);
    elements.resetConfirm.classList.add('hidden');
  }

  function hidePasswordPrompt() {
    elements.passwordSection.classList.add('hidden');
    elements.apiProviderList.classList.remove('hidden');
  }

  function handlePasswordKeypress(e) {
    if (e.key !== 'Enter') return;
    state.isFirstTimeSetup ? elements.confirmPassword.focus() : unlockWithPassword();
  }

  async function setMasterPassword() {
    const password = elements.masterPassword.value;
    const confirmPass = elements.confirmPassword.value;

    if (!isValidPassword(password)) {
      alert(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    if (password !== confirmPass) {
      alert('Passwords do not match');
      return;
    }

    try {
      await createPasswordVerifier(password);
      state.masterPassword = password;
      clearPasswordInputs();
      hidePasswordPrompt();
      await initializeApp();
      chrome.runtime.sendMessage({ type: 'PASSWORD_SET', password });
    } catch (error) {
      console.error('Failed to set password:', error);
      alert('Failed to set password. Please try again.');
    }
  }

  function isValidPassword(password) {
    return password && password.length >= MIN_PASSWORD_LENGTH;
  }

  async function createPasswordVerifier(password) {
    const verifier = await CryptoUtils.encrypt('password_correct', password);
    await chrome.storage.local.set({ hasCompletedSetup: true, passwordVerifier: verifier });
  }

  function clearPasswordInputs() {
    elements.masterPassword.value = '';
    elements.confirmPassword.value = '';
  }

  async function unlockWithPassword() {
    const password = elements.masterPassword.value;
    if (!password) {
      alert('Please enter your password');
      return;
    }

    try {
      const isValid = await verifyPassword(password);
      if (!isValid) {
        alert('Wrong password');
        return;
      }

      state.masterPassword = password;
      elements.masterPassword.value = '';
      hidePasswordPrompt();
      await initializeApp();
      chrome.runtime.sendMessage({ type: 'PASSWORD_SET', password });
    } catch (error) {
      handleUnlockError(error);
    }
  }

  async function verifyPassword(password) {
    const result = await chrome.storage.local.get(['passwordVerifier', 'apiConfigs']);
    
    // Try verifier first
    if (result.passwordVerifier) {
      const decrypted = await CryptoUtils.decrypt(result.passwordVerifier, password);
      return decrypted === 'password_correct';
    }

    // Fallback: try decrypting API keys
    return canDecryptAnyApiKey(result.apiConfigs || {}, password);
  }

  async function canDecryptAnyApiKey(apiConfigs, password) {
    for (const config of Object.values(apiConfigs)) {
      if (!config.apiKeyEncrypted) continue;
      try {
        await CryptoUtils.decrypt(config.apiKeyEncrypted, password);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  function handleUnlockError(error) {
    if (error.message === 'Wrong password') {
      alert('Wrong password');
    } else {
      console.error('Unlock error:', error);
      alert('Failed to unlock: ' + error.message);
    }
  }

  function showForgotPassword() {
    elements.resetConfirm.classList.remove('hidden');
  }

  function hideForgotPassword() {
    elements.resetConfirm.classList.add('hidden');
  }

  async function resetAllData() {
    await chrome.storage.local.clear();
    await chrome.storage.session.clear();
    state.masterPassword = null;
    hideForgotPassword();
    state.isFirstTimeSetup = true;
    showPasswordSetup();
    chrome.runtime.sendMessage({ type: 'RESET_ALL_DATA' });
    alert('All data has been reset. Please set a new password.');
  }

  async function initializeApp() {
    await loadTokens();
    await loadSettings();
    await loadAPIProviders();
  }

  // ==================== API Management ====================
  async function loadAPIProviders() {
    const result = await chrome.storage.local.get(['apiConfigs']);
    let configs = result.apiConfigs;
    
    if (!configs || Object.keys(configs).length === 0) {
      configs = await initializeDefaultAPIConfigs();
    }
    
    renderAPIProviders(configs);
    populateAPISelector(configs);
  }

  async function initializeDefaultAPIConfigs() {
    console.log('[Popup] No API configs found, requesting initialization');
    chrome.runtime.sendMessage({ type: 'INIT_DEFAULT_DATA' });
    await new Promise(resolve => setTimeout(resolve, 500));
    const retry = await chrome.storage.local.get(['apiConfigs']);
    return retry.apiConfigs || {};
  }

  function renderAPIProviders(apiConfigs) {
    elements.apiProviderList.innerHTML = '';
    
    PREDEFINED_APIS.forEach(apiId => {
      if (!apiConfigs[apiId]) return;
      const item = createAPIProviderItem(apiId, apiConfigs[apiId]);
      elements.apiProviderList.appendChild(item);
    });
  }

  function createAPIProviderItem(apiId, config) {
    const div = document.createElement('div');
    div.className = 'api-provider-item';
    
    const isConfigured = config.enabled && (config.apiKey || isNoKeyRequired(apiId));
    if (isConfigured) div.classList.add('configured');

    div.innerHTML = `
      <span class="provider-name">${config.name || apiId}</span>
      <span class="provider-status">${isConfigured ? '✓' : ''}</span>
    `;
    div.addEventListener('click', (e) => showAPIConfig(apiId, config, e));
    return div;
  }

  function isNoKeyRequired(apiId) {
    return apiId === 'binance' || apiId === 'binanceFutures';
  }

  async function showAPIConfig(apiId, config, event) {
    state.currentApiId = apiId;
    elements.apiConfigSection.classList.remove('hidden');
    elements.apiConfigTitle.textContent = `Configure ${config.name || apiId}`;
    elements.apiName.value = config.name || '';
    elements.apiUrl.value = config.baseUrl || '';
    elements.apiUrl.readOnly = PREDEFINED_APIS.includes(apiId);

    const { apiKey, secretKey } = await decryptAPIKeys(config);
    elements.configApiKey.value = apiKey;
    elements.configSecretKey.value = secretKey;

    // Hide Bitget-specific fields
    document.querySelectorAll('.bitget-only').forEach(f => f.classList.remove('visible'));

    // Highlight selected
    document.querySelectorAll('.api-provider-item').forEach(i => i.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
  }

  async function decryptAPIKeys(config) {
    if (!state.masterPassword) {
      return {
        apiKey: config.apiKeyEncrypted ? '[Locked - enter password]' : config.apiKey || '',
        secretKey: config.secretKeyEncrypted ? '[Locked - enter password]' : config.secretKey || '',
      };
    }

    return {
      apiKey: await decryptKey(config.apiKeyEncrypted, state.masterPassword, 'API key'),
      secretKey: await decryptKey(config.secretKeyEncrypted, state.masterPassword, 'secret key'),
    };
  }

  async function decryptKey(encryptedKey, password, keyType) {
    if (!encryptedKey) return '';
    try {
      return await CryptoUtils.decrypt(encryptedKey, password);
    } catch (error) {
      console.error(`Failed to decrypt ${keyType}:`, error);
      return '[Encrypted - wrong password]';
    }
  }

  async function saveAPIConfig() {
    if (!state.currentApiId) return;

    const result = await chrome.storage.local.get(['apiConfigs']);
    const configs = result.apiConfigs || {};
    
    if (!configs[state.currentApiId]) configs[state.currentApiId] = {};

    const apiKey = elements.configApiKey.value.trim();
    const secretKey = elements.configSecretKey.value.trim();

    await encryptAndStoreKeys(configs[state.currentApiId], apiKey, secretKey);
    
    configs[state.currentApiId].baseUrl = elements.apiUrl.value.trim();
    if (state.currentApiId === 'bitget') {
      configs[state.currentApiId].passphrase = elements.configPassphrase.value.trim();
    }

    configs[state.currentApiId].enabled = isAPIEnabled(configs[state.currentApiId], state.currentApiId);

    await chrome.storage.local.set({ apiConfigs: configs });
    chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS' });
    loadAPIProviders();
    elements.apiConfigSection.classList.add('hidden');
  }

  async function encryptAndStoreKeys(config, apiKey, secretKey) {
    if (state.masterPassword && apiKey) {
      config.apiKeyEncrypted = await CryptoUtils.encrypt(apiKey, state.masterPassword);
      config.apiKey = '';
    } else if (apiKey) {
      if (!confirm('No master password set. API key will be stored unencrypted. Continue?')) return;
      config.apiKey = apiKey;
      config.apiKeyEncrypted = null;
    } else {
      config.apiKey = '';
      config.apiKeyEncrypted = null;
    }

    if (state.masterPassword && secretKey) {
      config.secretKeyEncrypted = await CryptoUtils.encrypt(secretKey, state.masterPassword);
      config.secretKey = '';
    } else {
      config.secretKey = secretKey;
      config.secretKeyEncrypted = null;
    }
  }

  function isAPIEnabled(config, apiId) {
    const hasKey = !!(config.apiKeyEncrypted || config.apiKey || isNoKeyRequired(apiId));
    return hasKey;
  }

  function populateAPISelector(apiConfigs) {
    elements.apiSelector.innerHTML = '<option value="">Select API</option>';

    chrome.storage.local.get(['lastUsedApi'], (result) => {
      Object.entries(apiConfigs).forEach(([apiId, config]) => {
        if (!config.enabled) return;
        const option = document.createElement('option');
        option.value = apiId;
        option.textContent = config.name;
        elements.apiSelector.appendChild(option);
      });

      const lastUsed = result.lastUsedApi;
      if (lastUsed && apiConfigs[lastUsed]?.enabled) {
        elements.apiSelector.value = lastUsed;
      }
    });
  }

  // ==================== Token Management ====================
  async function loadTokens() {
    const result = await chrome.storage.local.get(['tokens']);
    let tokens = result.tokens;
    
    if (!tokens || tokens.length === 0) {
      tokens = await initializeDefaultTokens();
    }
    
    renderTokens(tokens);
  }

  async function initializeDefaultTokens() {
    console.log('[Popup] No tokens found, requesting initialization');
    chrome.runtime.sendMessage({ type: 'INIT_DEFAULT_DATA' });
    await new Promise(resolve => setTimeout(resolve, 500));
    const retry = await chrome.storage.local.get(['tokens']);
    return retry.tokens || [];
  }

  function saveTokens(tokens) {
    chrome.storage.local.set({ tokens }, () => {
      renderTokens(tokens);
      chrome.runtime.sendMessage({ type: 'UPDATE_TOKENS' });
    });
  }

  async function loadSettings() {
    const result = await chrome.storage.local.get(['refreshInterval']);
    elements.refreshInterval.value = result.refreshInterval || 10;
  }

  function saveIntervalSettings() {
    const interval = parseInt(elements.refreshInterval.value, 10);
    if (interval < MIN_REFRESH_INTERVAL) {
      alert(`Minimum refresh interval is ${MIN_REFRESH_INTERVAL} seconds`);
      return;
    }
    chrome.storage.local.set({ refreshInterval: interval }, () => {
      showSaveFeedback(elements.saveIntervalBtn);
      chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS' });
    });
  }

  function showSaveFeedback(button) {
    const originalText = button.textContent;
    button.textContent = 'Saved!';
    setTimeout(() => button.textContent = originalText, 1500);
  }

  function addToken() {
    const symbol = elements.symbolInput.value.trim().toUpperCase();
    const apiSource = elements.apiSelector.value;

    if (!symbol) return alert('Please enter a symbol');
    if (!apiSource) return alert('Please select an API provider');

    chrome.storage.local.get(['tokens'], (result) => {
      const tokens = result.tokens || [];
      const exists = tokens.some(t => t.symbol === symbol && t.apiSource === apiSource);
      if (exists) return alert('Token already monitored from this API');

      tokens.push({ symbol, apiSource, alertPrice1: null, alertPrice2: null, lastPrice: null });
      saveTokens(tokens);
      elements.symbolInput.value = '';
      chrome.storage.local.set({ lastUsedApi: apiSource });
    });
  }

  function removeToken(symbol) {
    chrome.storage.local.get(['tokens'], (result) => {
      const tokens = result.tokens || [];
      const newTokens = tokens.filter(t => t.symbol !== symbol);
      delete state.previousPrices[symbol];
      saveTokens(newTokens);
    });
  }

  function updateTokenAlert(symbol, alertNum, newPrice) {
    chrome.storage.local.get(['tokens'], (result) => {
      const tokens = result.tokens || [];
      const token = tokens.find(t => t.symbol === symbol);
      if (!token) return;
      
      token[`alertPrice${alertNum}`] = isNaN(newPrice) ? null : newPrice;
      saveTokens(tokens);
    });
  }

  // ==================== Token Rendering ====================
  function renderTokens(tokens) {
    const existingItems = getExistingTokenItems();

    tokens.forEach(token => {
      const li = existingItems[token.symbol] || createTokenItem(token);
      updateTokenItem(li, token);
      delete existingItems[token.symbol];
    });

    // Remove deleted tokens
    Object.values(existingItems).forEach(li => li.remove());
  }

  function getExistingTokenItems() {
    const items = {};
    document.querySelectorAll('.token-item').forEach(item => {
      items[item.dataset.symbol] = item;
    });
    return items;
  }

  function createTokenItem(token) {
    const li = document.createElement('li');
    li.className = 'token-item';
    li.dataset.symbol = token.symbol;
    li.innerHTML = `
      <div class="token-info">
        <span class="token-symbol"></span>
        <span class="token-alert">
          <div class="alert-row">${createAlertRowHTML(1)}</div>
          <div class="alert-row">${createAlertRowHTML(2)}</div>
        </span>
      </div>
      <div class="token-price">
        <div class="token-chart"></div>
        <span class="price-value"></span>
        <span class="change-percent"></span>
      </div>
      <button class="delete-btn" aria-label="Remove">${getDeleteIconSVG()}</button>
    `;

    setupTokenEventListeners(li, token);
    elements.tokenList.appendChild(li);
    return li;
  }

  function createAlertRowHTML(alertNum) {
    return `
      <span class="alert-display alert-display-${alertNum}">--</span>
      <input type="number" class="alert-input alert-input-${alertNum}" placeholder="Alert" step="any">
      <span class="alert-percent alert-percent-${alertNum}"></span>
    `;
  }

  function getDeleteIconSVG() {
    return `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;
  }

  function setupTokenEventListeners(li, token) {
    li.querySelector('.delete-btn').addEventListener('click', () => removeToken(token.symbol));

    [1, 2].forEach(alertNum => {
      setupAlertInput(li, token, alertNum);
    });
  }

  function setupAlertInput(li, token, alertNum) {
    const input = li.querySelector(`.alert-input-${alertNum}`);
    const display = li.querySelector(`.alert-display-${alertNum}`);
    const row = li.querySelector(`.alert-row:nth-child(${alertNum})`);

    input.dataset.symbol = token.symbol;
    input.dataset.alertNum = alertNum;

    input.addEventListener('focus', () => {
      state.editingTokenSymbol = token.symbol;
      toggleAlertInputMode(input, display, true);
      adjustInputFontSize(input);
    });

    input.addEventListener('input', () => adjustInputFontSize(input));

    input.addEventListener('blur', () => {
      setTimeout(() => {
        state.editingTokenSymbol = null;
        saveAlertPrice(token.symbol, alertNum, input.value);
        toggleAlertInputMode(input, display, false);
      }, 100);
    });

    input.addEventListener('keypress', (e) => e.key === 'Enter' && input.blur());

    row.addEventListener('click', (e) => {
      if (e.target === input) return;
      toggleAlertInputMode(input, display, true);
      input.focus();
    });
  }

  function toggleAlertInputMode(input, display, isEditing) {
    input.style.display = isEditing ? 'inline-flex' : 'none';
    display.style.display = isEditing ? 'none' : 'inline-flex';
  }

  function saveAlertPrice(symbol, alertNum, value) {
    const price = parseFloat(value);
    if (!isNaN(price) && price > 0) {
      updateTokenAlert(symbol, alertNum, price);
    } else if (value === '') {
      updateTokenAlert(symbol, alertNum, null);
    }
  }

  function updateTokenItem(li, token) {
    updateSymbolDisplay(li, token);
    [1, 2].forEach(num => updateAlertDisplay(li, token, num));
    updatePriceDisplay(li, token);
    updateChangeDisplay(li, token);
    updateSparkline(li, token);
    updatePreviousPrice(token);
  }

  function updateSymbolDisplay(li, token) {
    const symbolSpan = li.querySelector('.token-symbol');
    const displayText = token.stockName ? `${token.stockName}[${token.symbol}]` : token.symbol;
    
    if (symbolSpan.textContent === displayText) return;

    symbolSpan.textContent = displayText;
    symbolSpan.dataset.symbol = token.symbol;
    symbolSpan.dataset.length = getLengthClass(displayText);
  }

  function getLengthClass(text) {
    const len = text.length;
    if (len > 12) return 'extreme';
    if (len > 9) return 'very-long';
    if (len > 6) return 'long';
    if (len > 4) return 'medium';
    return 'normal';
  }

  function updateAlertDisplay(li, token, alertNum) {
    const input = li.querySelector(`.alert-input-${alertNum}`);
    const display = li.querySelector(`.alert-display-${alertNum}`);
    const alertPrice = token[`alertPrice${alertNum}`];
    const currentPrice = token.lastPrice ? parseFloat(token.lastPrice) : null;

    // Skip if user is editing
    if (document.activeElement === input) return;

    input.value = alertPrice || '';
    toggleAlertInputMode(input, display, false);

    if (alertPrice) {
      display.textContent = `$${alertPrice}`;
      display.style.fontSize = calculateFontSize(alertPrice.toString());
    } else {
      display.textContent = '--';
      display.style.fontSize = DEFAULT_FONT_SIZE;
    }

    updateAlertPercent(li, token, alertNum, alertPrice, currentPrice);
  }

  function calculateFontSize(priceStr) {
    const digitCount = priceStr.replace('.', '').length;
    for (const { digits, size } of FONT_SIZE_MAP) {
      if (digitCount >= digits) return size;
    }
    return DEFAULT_FONT_SIZE;
  }

  function updateAlertPercent(li, token, alertNum, alertPrice, currentPrice) {
    const row = li.querySelector(`.alert-row:nth-child(${alertNum})`);
    let percentSpan = row.querySelector(`.alert-percent-${alertNum}`);

    if (!alertPrice || !currentPrice) {
      showAlertHint(percentSpan, row, alertNum);
      return;
    }

    const diff = ((alertPrice - currentPrice) / currentPrice) * 100;
    const percentText = `${diff > 0 ? '+' : ''}${diff.toFixed(0)}%`;
    const percentClass = diff > 0 ? 'text-green' : 'text-red';

    if (!percentSpan) {
      percentSpan = document.createElement('span');
      percentSpan.className = `alert-percent alert-percent-${alertNum}`;
      row.appendChild(percentSpan);
    }

    percentSpan.textContent = percentText;
    percentSpan.className = `alert-percent alert-percent-${alertNum} ${percentClass}`;
    percentSpan.style.display = 'inline';
  }

  function showAlertHint(percentSpan, row, alertNum) {
    if (!percentSpan) {
      percentSpan = document.createElement('span');
      percentSpan.className = `alert-percent alert-percent-${alertNum}`;
      row.appendChild(percentSpan);
    }
    percentSpan.textContent = '🚨';
    percentSpan.className = `alert-percent alert-percent-${alertNum}`;
    percentSpan.style.display = 'inline';
  }

  function updatePriceDisplay(li, token) {
    const priceSpan = li.querySelector('.price-value');
    const currentPrice = token.lastPrice ? parseFloat(token.lastPrice) : null;
    const currencySymbol = token.apiSource === 'ashare' ? '¥' : '$';
    const priceDisplay = currentPrice ? formatPrice(currentPrice, currencySymbol) : 'Loading...';

    if (!currentPrice || priceSpan.textContent === priceDisplay) return;

    const oldPrice = extractPriceNumber(priceSpan.textContent);
    
    if (oldPrice && Math.abs(currentPrice - oldPrice) > 0) {
      animatePriceChange(priceSpan, oldPrice, currentPrice, currencySymbol);
    } else {
      priceSpan.textContent = priceDisplay;
    }

    applyPriceFlashAnimation(priceSpan, currentPrice, token.symbol);
  }

  function extractPriceNumber(priceText) {
    if (!priceText || (!priceText.startsWith('$') && !priceText.startsWith('¥'))) return null;
    return parseFloat(priceText.replace(/[$¥,]/g, ''));
  }

  function animatePriceChange(element, oldPrice, newPrice, currencySymbol) {
    element.classList.add('price-rolling');
    animateNumberChange(element, oldPrice, newPrice, 600, currencySymbol);
    setTimeout(() => element.classList.remove('price-rolling'), 600);
  }

  function applyPriceFlashAnimation(priceSpan, currentPrice, symbol) {
    const prevPrice = state.previousPrices[symbol];
    if (!prevPrice) return;

    let animationClass = '';
    if (currentPrice > prevPrice) animationClass = 'price-up';
    else if (currentPrice < prevPrice) animationClass = 'price-down';

    if (!animationClass) return;

    priceSpan.className = `price-value ${animationClass}`;
    setTimeout(() => {
      if (priceSpan.className.includes(animationClass)) {
        priceSpan.className = 'price-value';
      }
    }, 3000);
  }

  function updateChangeDisplay(li, token) {
    const changeSpan = li.querySelector('.change-percent');
    const changePercent = token.priceChangePercent ? parseFloat(token.priceChangePercent) : 0;
    
    const arrow = changePercent >= 0 ? '▲' : '▼';
    const changeDisplay = token.priceChangePercent 
      ? `${arrow} ${Math.abs(changePercent).toFixed(2)}%` 
      : '';
    const changeClass = changePercent >= 0 ? 'text-green' : 'text-red';

    if (changeSpan.textContent !== changeDisplay) {
      changeSpan.textContent = changeDisplay;
      changeSpan.className = `change-percent ${changeClass}`;
    }
  }

  function updateSparkline(li, token) {
    const chartDiv = li.querySelector('.token-chart');
    if (!token.history || token.history.length <= 1) return;

    const changePercent = token.priceChangePercent ? parseFloat(token.priceChangePercent) : 0;
    const color = changePercent >= 0 ? '#10b981' : '#ef4444';
    chartDiv.innerHTML = generateSparkline(token.history, color);
  }

  function updatePreviousPrice(token) {
    if (token.lastPrice) {
      state.previousPrices[token.symbol] = parseFloat(token.lastPrice);
    }
  }

  // ==================== Utilities ====================
  function formatPrice(price, currencySymbol = '$') {
    if (price === null || price === undefined || isNaN(price)) return 'Loading...';

    const absPrice = Math.abs(price);
    if (absPrice >= 1000) return `${currencySymbol}${price.toFixed(2)}`;

    const integerDigits = absPrice < 1 ? 1 : Math.floor(Math.log10(Math.floor(absPrice))) + 1;
    const decimalPlaces = Math.max(2, 6 - integerDigits);
    return `${currencySymbol}${price.toFixed(decimalPlaces)}`;
  }

  function animateNumberChange(element, oldValue, newValue, duration = 800, currencySymbol = '$') {
    if (oldValue === newValue) return;

    const startTime = performance.now();
    const difference = newValue - oldValue;

    function updateNumber(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const currentValue = oldValue + (difference * easeProgress);
      
      element.textContent = formatPrice(currentValue, currencySymbol);

      if (progress < 1) {
        requestAnimationFrame(updateNumber);
      } else {
        element.textContent = formatPrice(newValue, currencySymbol);
      }
    }

    requestAnimationFrame(updateNumber);
  }

  function adjustInputFontSize(input) {
    const value = input.value;
    if (!value) {
      input.style.fontSize = DEFAULT_FONT_SIZE;
      return;
    }
    input.style.fontSize = calculateFontSize(value);
  }

  function generateSparkline(data, color) {
    if (!data || data.length < 2) return '';

    const width = 300;
    const height = 100;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max === min ? 1 : max - min;

    const points = data.map((val, index) => {
      const x = (index / (data.length - 1)) * width;
      const normalizedY = max === min ? 0.5 : (val - min) / range;
      const y = height - (normalizedY * height);
      return `${x},${y}`;
    }).join(' ');

    const areaPoints = `${points} ${width},${height} 0,${height}`;
    const gradientId = `grad-${color.replace('#', '')}`;

    return `
      <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        <defs>
          <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:${color};stop-opacity:0.2" />
            <stop offset="100%" style="stop-color:${color};stop-opacity:0" />
          </linearGradient>
        </defs>
        <path d="M ${points}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke" />
        <path d="M ${areaPoints}" fill="url(#${gradientId})" stroke="none" />
      </svg>
    `;
  }

  // ==================== Action Handlers ====================
  function handleRefresh() {
    elements.refreshBtn.style.transition = 'transform 0.5s';
    elements.refreshBtn.style.transform = 'rotate(360deg)';
    setTimeout(() => elements.refreshBtn.style.transform = '', 500);
    chrome.runtime.sendMessage({ type: 'UPDATE_TOKENS' });
  }

  function playTestSound() {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Test Alert',
      message: 'This is a test alert notification.',
      priority: 2
    });
    chrome.runtime.sendMessage({ type: 'PLAY_TEST_SOUND' });
  }
});
