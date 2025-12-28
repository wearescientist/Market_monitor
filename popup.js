document.addEventListener('DOMContentLoaded', () => {
  const tokenList = document.getElementById('token-list');
  const addTokenBtn = document.getElementById('add-token');
  const symbolInput = document.getElementById('token-symbol');
  // Alert price input removed - alerts are now set directly on token items
  const apiSelectorInput = document.getElementById('api-selector');
  const settingsBtn = document.getElementById('settings-btn');
  const settingsPanel = document.getElementById('settings-panel');
  const refreshIntervalInput = document.getElementById('refresh-interval');
  const refreshBtn = document.getElementById('refresh-btn');
  const testSoundBtn = document.getElementById('test-sound-btn');

  // API Management elements
  const apiProviderList = document.getElementById('api-provider-list');
  const apiConfigSection = document.getElementById('api-config-section');
  const apiConfigTitle = document.getElementById('api-config-title');
  const apiNameInput = document.getElementById('api-name');
  const apiUrlInput = document.getElementById('api-url');
  const configApiKeyInput = document.getElementById('config-api-key');
  const configSecretKeyInput = document.getElementById('config-secret-key');
  const configPassphraseInput = document.getElementById('config-passphrase');
  const saveApiConfigBtn = document.getElementById('save-api-config');

  // Store previous prices to determine flash direction
  let previousPrices = {};
  let currentApiId = null; // Track which API is being configured
  let editingTokenSymbol = null; // Track which token's alert is being edited

  // Load saved data
  loadTokens();
  loadSettings();
  loadAPIProviders();

  // Event Listeners
  addTokenBtn.addEventListener('click', addToken);
  settingsBtn.addEventListener('click', () => settingsPanel.classList.toggle('hidden'));

  if (saveApiConfigBtn) {
    saveApiConfigBtn.addEventListener('click', saveAPIConfig);
  }

  if (testSoundBtn) {
    testSoundBtn.addEventListener('click', () => {
      // Trigger a test notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Test Alert',
        message: 'This is a test alert notification.',
        priority: 2
      });
      // Play sound via background
      chrome.runtime.sendMessage({ type: 'PLAY_TEST_SOUND' });
    });
  }


  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      // Rotate icon for feedback
      refreshBtn.style.transition = 'transform 0.5s';
      refreshBtn.style.transform = 'rotate(360deg)';
      setTimeout(() => { refreshBtn.style.transform = ''; }, 500);

      // Request update
      chrome.runtime.sendMessage({ type: 'UPDATE_TOKENS' });
    });
  }

  const saveIntervalBtn = document.getElementById('save-interval-btn');
  if (saveIntervalBtn) {
    saveIntervalBtn.addEventListener('click', () => {
      const interval = parseInt(refreshIntervalInput.value, 10);
      if (interval < 5) {
        alert('Minimum refresh interval is 5 seconds');
        return;
      }
      chrome.storage.local.set({ refreshInterval: interval }, () => {
        // Visual feedback
        const originalText = saveIntervalBtn.textContent;
        saveIntervalBtn.textContent = 'Saved!';
        setTimeout(() => {
          saveIntervalBtn.textContent = originalText;
        }, 1500);
        // Notify background to update alarm
        chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS' });
      });
    });
  }

  // Also allow Enter key to add token
  symbolInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addToken();
  });

  function loadAPIProviders() {
    chrome.storage.local.get(['apiConfigs'], (result) => {
      const apiConfigs = result.apiConfigs || {};
      renderAPIProviders(apiConfigs);
      populateAPISelector(apiConfigs);
    });
  }

  function renderAPIProviders(apiConfigs) {
    apiProviderList.innerHTML = '';

    // Render Binance
    if (apiConfigs.binance) {
      const item = createAPIProviderItem('binance', apiConfigs.binance);
      apiProviderList.appendChild(item);
    }

    // Render Binance Futures
    if (apiConfigs.binanceFutures) {
      const item = createAPIProviderItem('binanceFutures', apiConfigs.binanceFutures);
      apiProviderList.appendChild(item);
    }

    // Render CoinGecko
    if (apiConfigs.coingecko) {
      const item = createAPIProviderItem('coingecko', apiConfigs.coingecko);
      apiProviderList.appendChild(item);
    }

    // Render CoinMarketCap
    if (apiConfigs.coinmarketcap) {
      const item = createAPIProviderItem('coinmarketcap', apiConfigs.coinmarketcap);
      apiProviderList.appendChild(item);
    }

    // TODO: Add custom API support
  }

  function createAPIProviderItem(apiId, apiConfig) {
    const div = document.createElement('div');
    div.className = 'api-provider-item';
    if (apiConfig.enabled && (apiConfig.apiKey || apiId === 'binance' || apiId === 'binanceFutures')) {
      div.classList.add('configured');
    }

    const nameSpan = document.createElement('span');
    nameSpan.className = 'provider-name';
    nameSpan.textContent = apiConfig.name || apiId;

    const statusSpan = document.createElement('span');
    statusSpan.className = 'provider-status';
    if (apiConfig.enabled && (apiConfig.apiKey || apiId === 'binance' || apiId === 'binanceFutures')) {
      statusSpan.textContent = '✓';
    }

    div.appendChild(nameSpan);
    div.appendChild(statusSpan);

    div.addEventListener('click', (event) => {
      showAPIConfig(apiId, apiConfig, event);
    });

    return div;
  }

  function showAPIConfig(apiId, apiConfig, event) {
    currentApiId = apiId;
    apiConfigSection.classList.remove('hidden');
    apiConfigTitle.textContent = `Configure ${apiConfig.name || apiId}`;

    apiNameInput.value = apiConfig.name || '';
    apiUrlInput.value = apiConfig.baseUrl || '';
    apiUrlInput.readOnly = (apiId === 'binance' || apiId === 'binanceFutures' || apiId === 'coingecko' || apiId === 'coinmarketcap');

    configApiKeyInput.value = apiConfig.apiKey || '';
    configSecretKeyInput.value = apiConfig.secretKey || '';

    // Hide Bitget-specific fields (no longer used)
    const bitgetFields = document.querySelectorAll('.bitget-only');
    bitgetFields.forEach(field => field.classList.remove('visible'));

    // Highlight selected provider
    document.querySelectorAll('.api-provider-item').forEach(item => {
      item.classList.remove('selected');
    });
    event.currentTarget.classList.add('selected');
  }

  function saveAPIConfig() {
    if (!currentApiId) return;

    chrome.storage.local.get(['apiConfigs'], (result) => {
      const apiConfigs = result.apiConfigs || {};

      if (!apiConfigs[currentApiId]) {
        apiConfigs[currentApiId] = {};
      }

      apiConfigs[currentApiId].apiKey = configApiKeyInput.value.trim();
      apiConfigs[currentApiId].secretKey = configSecretKeyInput.value.trim();
      apiConfigs[currentApiId].baseUrl = apiUrlInput.value.trim();

      if (currentApiId === 'bitget') {
        apiConfigs[currentApiId].passphrase = configPassphraseInput.value.trim();
      }

      // Enable if API key is provided (or if it's Binance/Binance Futures which works without key)
      apiConfigs[currentApiId].enabled = !!(apiConfigs[currentApiId].apiKey || currentApiId === 'binance' || currentApiId === 'binanceFutures');

      chrome.storage.local.set({ apiConfigs }, () => {
        loadAPIProviders();
        apiConfigSection.classList.add('hidden');
        chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS' });
      });
    });
  }

  function populateAPISelector(apiConfigs) {
    apiSelectorInput.innerHTML = '<option value="">Select API</option>';

    chrome.storage.local.get(['lastUsedApi'], (result) => {
      const lastUsedApi = result.lastUsedApi || '';

      Object.keys(apiConfigs).forEach(apiId => {
        const config = apiConfigs[apiId];
        if (config.enabled) {
          const option = document.createElement('option');
          option.value = apiId;
          option.textContent = config.name;
          apiSelectorInput.appendChild(option);
        }
      });

      // Restore last used API if available
      if (lastUsedApi && apiConfigs[lastUsedApi] && apiConfigs[lastUsedApi].enabled) {
        apiSelectorInput.value = lastUsedApi;
      }
    });
  }

  function loadTokens() {
    chrome.storage.local.get(['tokens'], (result) => {
      const tokens = result.tokens || [];
      renderTokens(tokens);
    });
  }

  function saveTokens(tokens) {
    chrome.storage.local.set({ tokens }, () => {
      renderTokens(tokens);
      chrome.runtime.sendMessage({ type: 'UPDATE_TOKENS' });
    });
  }

  function loadSettings() {
    chrome.storage.local.get(['refreshInterval'], (result) => {
      refreshIntervalInput.value = result.refreshInterval || 10;
    });
  }

  function saveSettings() {
    const interval = parseInt(refreshIntervalInput.value, 10);
    const apiKey = apiKeyInput.value.trim();
    const secretKey = secretKeyInput.value.trim();

    if (interval < 5) {
      alert('Minimum refresh interval is 5 seconds');
      return;
    }
    chrome.storage.local.set({
      refreshInterval: interval,
      apiKey: apiKey,
      secretKey: secretKey
    }, () => {
      settingsPanel.classList.add('hidden');
      chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS' });
    });
  }

  function addToken() {
    const symbol = symbolInput.value.trim().toUpperCase();
    const apiSource = apiSelectorInput.value;

    if (!symbol) {
      alert('Please enter a symbol');
      return;
    }

    if (!apiSource) {
      alert('Please select an API provider');
      return;
    }

    chrome.storage.local.get(['tokens'], (result) => {
      const tokens = result.tokens || [];
      // Check if already exists
      if (tokens.find(t => t.symbol === symbol && t.apiSource === apiSource)) {
        alert('Token already monitored from this API');
        return;
      }

      tokens.push({
        symbol,
        apiSource,
        alertPrice1: null,
        alertPrice2: null,
        lastPrice: null
      });

      saveTokens(tokens);
      symbolInput.value = '';
      // Keep the API selection (don't reset)
      // apiSelectorInput.value = '';

      // Remember the last used API
      chrome.storage.local.set({ lastUsedApi: apiSource });
    });
  }

  function removeToken(symbol) {
    chrome.storage.local.get(['tokens'], (result) => {
      const tokens = result.tokens || [];
      const newTokens = tokens.filter(t => t.symbol !== symbol);
      // Remove from previousPrices so if re-added it doesn't flash weirdly
      delete previousPrices[symbol];
      saveTokens(newTokens);
    });
  }

  function updateTokenAlert(symbol, alertNum, newAlertPrice) {
    chrome.storage.local.get(['tokens'], (result) => {
      const tokens = result.tokens || [];
      const tokenIndex = tokens.findIndex(t => t.symbol === symbol);
      if (tokenIndex !== -1) {
        const field = `alertPrice${alertNum}`;
        tokens[tokenIndex][field] = isNaN(newAlertPrice) ? null : newAlertPrice;
        saveTokens(tokens);
      }
    });
  }

  // Smart price formatting: at least 6 significant digits for small prices
  function formatPrice(price, currencySymbol = '$') {
    if (price === null || price === undefined || isNaN(price)) {
      return 'Loading...';
    }

    const absPrice = Math.abs(price);

    // For prices >= 10000, use 2 decimal places (e.g., 85764.34)
    if (absPrice >= 10000) {
      return `${currencySymbol}${price.toFixed(2)}`;
    }

    // For prices >= 1000, also use 2 decimal places (e.g., 1234.56)
    if (absPrice >= 1000) {
      return `${currencySymbol}${price.toFixed(2)}`;
    }

    // For smaller prices, show at least 6 significant digits
    // Count integer digits (digits before decimal point)
    const integerPart = Math.floor(absPrice);
    const integerDigits = integerPart === 0 ? 1 : Math.floor(Math.log10(integerPart)) + 1;

    // Calculate how many decimal places needed for 6 total digits
    const decimalPlaces = Math.max(2, 6 - integerDigits);

    return `${currencySymbol}${price.toFixed(decimalPlaces)}`;
  }

  // Animate number change with rolling effect
  function animateNumberChange(element, oldValue, newValue, duration = 800, currencySymbol = '$') {
    if (oldValue === newValue) return;

    const startTime = performance.now();
    const difference = newValue - oldValue;

    function updateNumber(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out)
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

  // Helper function to adjust input font size based on value length
  function adjustInputFontSize(inputElement) {
    const value = inputElement.value;
    if (!value) {
      inputElement.style.fontSize = '0.6rem';
      return;
    }

    const digitCount = value.replace('.', '').length;
    let fontSize = '0.6rem';
    if (digitCount >= 7) fontSize = '0.48rem';
    else if (digitCount >= 6) fontSize = '0.52rem';
    else if (digitCount >= 5) fontSize = '0.56rem';

    inputElement.style.fontSize = fontSize;
  }

  function renderTokens(tokens) {
    // 1. Identify which tokens are currently in the list
    const existingItems = {};
    document.querySelectorAll('.token-item').forEach(item => {
      existingItems[item.getAttribute('data-symbol')] = item;
    });

    // 2. Create or Update tokens
    tokens.forEach(token => {
      let li = existingItems[token.symbol];
      const isNew = !li;

      if (isNew) {
        li = document.createElement('li');
        li.className = 'token-item';
        li.setAttribute('data-symbol', token.symbol);
        // Create initial structure with two alert rows - using unified dashed box design
        li.innerHTML = `
          <div class="token-info">
            <span class="token-symbol"></span>
            <span class="token-alert">
              <div class="alert-row">
                <span class="alert-display alert-display-1">--</span>
                <input type="number" class="alert-input alert-input-1" placeholder="Alert" step="any">
                <span class="alert-percent alert-percent-1"></span>
              </div>
              <div class="alert-row">
                <span class="alert-display alert-display-2">--</span>
                <input type="number" class="alert-input alert-input-2" placeholder="Alert" step="any">
                <span class="alert-percent alert-percent-2"></span>
              </div>
            </span>
          </div>
          <div class="token-price">
            <div class="token-chart"></div>
            <span class="price-value"></span>
            <span class="change-percent"></span>
          </div>
          <button class="delete-btn" aria-label="Remove">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        `;

        // Add Event Listeners for new items
        li.querySelector('.delete-btn').addEventListener('click', () => removeToken(token.symbol));

        // Setup event listeners for first alert input
        const alertInput1 = li.querySelector('.alert-input-1');
        const alertDisplay1 = li.querySelector('.alert-display-1');
        alertInput1.setAttribute('data-symbol', token.symbol);
        alertInput1.setAttribute('data-alert-num', '1');

        alertInput1.addEventListener('focus', () => {
          editingTokenSymbol = token.symbol;
          alertInput1.style.display = 'inline-flex';
          alertDisplay1.style.display = 'none';
          adjustInputFontSize(alertInput1);
        });

        alertInput1.addEventListener('input', () => {
          adjustInputFontSize(alertInput1);
        });

        alertInput1.addEventListener('blur', () => {
          setTimeout(() => {
            editingTokenSymbol = null;
            const newPrice = parseFloat(alertInput1.value);
            if (!isNaN(newPrice) && newPrice > 0) {
              updateTokenAlert(token.symbol, 1, newPrice);
            } else if (alertInput1.value === '') {
              updateTokenAlert(token.symbol, 1, null);
            }
            alertInput1.style.display = 'none';
            alertDisplay1.style.display = 'inline-block';
          }, 100);
        });

        alertInput1.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') alertInput1.blur();
        });

        // Click on the entire alert-row to trigger input mode
        const alertRow1 = li.querySelector('.alert-row:nth-child(1)');
        alertRow1.addEventListener('click', (e) => {
          // Don't trigger if clicking on the input itself
          if (e.target === alertInput1) return;
          alertInput1.style.display = 'inline-flex';
          alertDisplay1.style.display = 'none';
          alertInput1.focus();
        });

        // Setup event listeners for second alert input
        const alertInput2 = li.querySelector('.alert-input-2');
        const alertDisplay2 = li.querySelector('.alert-display-2');
        alertInput2.setAttribute('data-symbol', token.symbol);
        alertInput2.setAttribute('data-alert-num', '2');

        alertInput2.addEventListener('focus', () => {
          editingTokenSymbol = token.symbol;
          alertInput2.style.display = 'inline-flex';
          alertDisplay2.style.display = 'none';
          adjustInputFontSize(alertInput2);
        });

        alertInput2.addEventListener('input', () => {
          adjustInputFontSize(alertInput2);
        });

        alertInput2.addEventListener('blur', () => {
          setTimeout(() => {
            editingTokenSymbol = null;
            const newPrice = parseFloat(alertInput2.value);
            if (!isNaN(newPrice) && newPrice > 0) {
              updateTokenAlert(token.symbol, 2, newPrice);
            } else if (alertInput2.value === '') {
              updateTokenAlert(token.symbol, 2, null);
            }
            alertInput2.style.display = 'none';
            alertDisplay2.style.display = 'inline-block';
          }, 100);
        });

        alertInput2.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') alertInput2.blur();
        });

        // Click on the entire alert-row to trigger input mode
        const alertRow2 = li.querySelector('.alert-row:nth-child(2)');
        alertRow2.addEventListener('click', (e) => {
          // Don't trigger if clicking on the input itself
          if (e.target === alertInput2) return;
          alertInput2.style.display = 'inline-flex';
          alertDisplay2.style.display = 'none';
          alertInput2.focus();
        });

        tokenList.appendChild(li);
      }

      // --- Update Content ---

      // 1. Symbol & Length Class (with stock name for A-share)
      const symbolSpan = li.querySelector('.token-symbol');
      // Build display text: show stock name with code for A-share (e.g., "贵州茅台[600519]")
      const displayText = token.stockName
        ? `${token.stockName}[${token.symbol}]`
        : token.symbol;

      if (symbolSpan.textContent !== displayText) {
        symbolSpan.textContent = displayText;
        // Store original symbol as data attribute for reference
        symbolSpan.setAttribute('data-symbol', token.symbol);

        let lengthClass = 'normal';
        const len = displayText.length;
        if (len > 12) lengthClass = 'extreme';
        else if (len > 9) lengthClass = 'very-long';
        else if (len > 6) lengthClass = 'long';
        else if (len > 4) lengthClass = 'medium';
        symbolSpan.setAttribute('data-length', lengthClass);
      }

      // 2. Alert Input & Display for both prices
      const alertInput1 = li.querySelector('.alert-input-1');
      const alertDisplay1 = li.querySelector('.alert-display-1');
      const alertInput2 = li.querySelector('.alert-input-2');
      const alertDisplay2 = li.querySelector('.alert-display-2');

      // Update first alert price
      if (document.activeElement !== alertInput1) {
        const newValue1 = token.alertPrice1 || '';
        if (alertInput1.value != newValue1) {
          alertInput1.value = newValue1;
        }

        // Always hide input by default, show display
        alertInput1.style.display = 'none';
        alertDisplay1.style.display = 'inline-flex';

        // Update display with formatted value or "--" for empty
        if (token.alertPrice1) {
          const priceStr = token.alertPrice1.toString();
          const digitCount = priceStr.replace('.', '').length;

          let fontSize = '0.6rem';
          if (digitCount >= 7) fontSize = '0.48rem';
          else if (digitCount >= 6) fontSize = '0.52rem';
          else if (digitCount >= 5) fontSize = '0.56rem';

          alertDisplay1.textContent = `$${token.alertPrice1}`;
          alertDisplay1.style.fontSize = fontSize;
        } else {
          alertDisplay1.textContent = '--';
          alertDisplay1.style.fontSize = '0.6rem';
        }
      }

      // Update second alert price
      if (document.activeElement !== alertInput2) {
        const newValue2 = token.alertPrice2 || '';
        if (alertInput2.value != newValue2) {
          alertInput2.value = newValue2;
        }

        // Always hide input by default, show display
        alertInput2.style.display = 'none';
        alertDisplay2.style.display = 'inline-flex';

        // Update display with formatted value or "--" for empty
        if (token.alertPrice2) {
          const priceStr = token.alertPrice2.toString();
          const digitCount = priceStr.replace('.', '').length;

          let fontSize = '0.6rem';
          if (digitCount >= 7) fontSize = '0.48rem';
          else if (digitCount >= 6) fontSize = '0.52rem';
          else if (digitCount >= 5) fontSize = '0.56rem';

          alertDisplay2.textContent = `$${token.alertPrice2}`;
          alertDisplay2.style.fontSize = fontSize;
        } else {
          alertDisplay2.textContent = '--';
          alertDisplay2.style.fontSize = '0.6rem';
        }
      }

      // 3. Alert Percentage for first price (no more icons)
      const currentPrice = token.lastPrice ? parseFloat(token.lastPrice) : null;
      const alertRow1 = li.querySelector('.alert-row:nth-child(1)');
      let percentSpan1 = alertRow1.querySelector('.alert-percent-1');

      let percentDiff1 = '';
      let percentClass1 = '';
      if (token.alertPrice1 && currentPrice) {
        const diff = ((token.alertPrice1 - currentPrice) / currentPrice) * 100;
        const sign = diff > 0 ? '+' : '';
        percentDiff1 = `${sign}${diff.toFixed(0)}%`;
        percentClass1 = diff > 0 ? 'text-green' : 'text-red';
      }

      // Show percentage if alert price exists, otherwise show 🚨 hint
      if (percentDiff1) {
        if (!percentSpan1) {
          percentSpan1 = document.createElement('span');
          percentSpan1.className = 'alert-percent alert-percent-1';
          alertRow1.appendChild(percentSpan1);
        }

        if (percentSpan1.textContent !== percentDiff1) {
          percentSpan1.textContent = percentDiff1;
          percentSpan1.className = `alert-percent alert-percent-1 ${percentClass1}`;
        }
        percentSpan1.style.display = 'inline';
      } else {
        // No alert price set - show 🚨 as hint
        if (!percentSpan1) {
          percentSpan1 = document.createElement('span');
          percentSpan1.className = 'alert-percent alert-percent-1';
          alertRow1.appendChild(percentSpan1);
        }
        percentSpan1.textContent = '🚨';
        percentSpan1.className = 'alert-percent alert-percent-1';
        percentSpan1.style.display = 'inline';
      }

      // 4. Alert Percentage for second price (no more icons)
      const alertRow2 = li.querySelector('.alert-row:nth-child(2)');
      let percentSpan2 = alertRow2.querySelector('.alert-percent-2');

      let percentDiff2 = '';
      let percentClass2 = '';
      if (token.alertPrice2 && currentPrice) {
        const diff = ((token.alertPrice2 - currentPrice) / currentPrice) * 100;
        const sign = diff > 0 ? '+' : '';
        percentDiff2 = `${sign}${diff.toFixed(0)}%`;
        percentClass2 = diff > 0 ? 'text-green' : 'text-red';
      }

      // Show percentage if alert price exists, otherwise show 🚨 hint
      if (percentDiff2) {
        if (!percentSpan2) {
          percentSpan2 = document.createElement('span');
          percentSpan2.className = 'alert-percent alert-percent-2';
          alertRow2.appendChild(percentSpan2);
        }

        if (percentSpan2.textContent !== percentDiff2) {
          percentSpan2.textContent = percentDiff2;
          percentSpan2.className = `alert-percent alert-percent-2 ${percentClass2}`;
        }
        percentSpan2.style.display = 'inline';
      } else {
        // No alert price set - show 🚨 as hint
        if (!percentSpan2) {
          percentSpan2 = document.createElement('span');
          percentSpan2.className = 'alert-percent alert-percent-2';
          alertRow2.appendChild(percentSpan2);
        }
        percentSpan2.textContent = '🚨';
        percentSpan2.className = 'alert-percent alert-percent-2';
        percentSpan2.style.display = 'inline';
      }

      // 5. Price Display & Animation
      const priceSpan = li.querySelector('.price-value');
      // Determine currency symbol based on API source
      const currencySymbol = token.apiSource === 'ashare' ? '¥' : '$';
      const priceDisplay = currentPrice ? formatPrice(currentPrice, currencySymbol) : 'Loading...';

      if (currentPrice && priceSpan.textContent !== priceDisplay) {
        const oldPriceText = priceSpan.textContent;

        // Extract old price number (handle both $ and ¥)
        const oldPrice = (oldPriceText.startsWith('$') || oldPriceText.startsWith('¥'))
          ? parseFloat(oldPriceText.replace(/[$¥,]/g, ''))
          : null;

        // Animate the number rolling if we have a valid old price
        if (oldPrice && !isNaN(oldPrice) && Math.abs(currentPrice - oldPrice) > 0) {
          // Add rolling class for visual cue
          priceSpan.classList.add('price-rolling');

          animateNumberChange(priceSpan, oldPrice, currentPrice, 600, currencySymbol);

          // Remove rolling class after animation
          setTimeout(() => {
            priceSpan.classList.remove('price-rolling');
          }, 600);
        } else {
          priceSpan.textContent = priceDisplay;
        }

        // Handle color flash animation
        let animationClass = '';
        if (currentPrice && previousPrices[token.symbol]) {
          if (currentPrice > previousPrices[token.symbol]) {
            animationClass = 'price-up';
          } else if (currentPrice < previousPrices[token.symbol]) {
            animationClass = 'price-down';
          }
        }
        if (animationClass) {
          priceSpan.className = `price-value ${animationClass}`;
          setTimeout(() => {
            if (priceSpan.className.includes(animationClass)) {
              priceSpan.className = 'price-value';
            }
          }, 3000);
        } else if (!priceSpan.classList.contains('price-rolling')) {
          priceSpan.className = 'price-value';
        }
      }

      // 5. Change Percent
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

      // 6. Sparkline
      const chartDiv = li.querySelector('.token-chart');
      if (token.history && token.history.length > 1) {
        const color = changePercent >= 0 ? '#10b981' : '#ef4444';
        // Only regenerate if data changed (optimization)
        // For simplicity, we regenerate if history length changed or last price changed
        // Or just regenerate every time since it's cheap enough for SVG string
        chartDiv.innerHTML = generateSparkline(token.history, color);
      }

      // Update previous price store
      if (currentPrice) {
        previousPrices[token.symbol] = currentPrice;
      }

      // Remove from existingItems map to track what needs to be deleted
      delete existingItems[token.symbol];
    });

    // 3. Remove tokens that are no longer in the list
    Object.values(existingItems).forEach(li => li.remove());
  }

  function generateSparkline(data, color) {
    if (!data || data.length < 2) return '';

    const width = 300;
    const height = 100;
    const min = Math.min(...data);
    const max = Math.max(...data);
    let range = max - min;

    // Handle flat line (no price change)
    if (range === 0) {
      range = 1; // Avoid division by zero
    }

    // Normalize data to points
    const points = data.map((val, index) => {
      const x = (index / (data.length - 1)) * width;
      // If range was 0, center the line
      const normalizedY = max === min ? 0.5 : (val - min) / range;
      const y = height - (normalizedY * height); // Invert Y for SVG
      return `${x},${y}`;
    }).join(' ');

    // Create area path (close the loop at the bottom)
    const areaPoints = `${points} ${width},${height} 0,${height}`;

    return `
      <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        <defs>
          <linearGradient id="grad-${color.replace('#', '')}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:${color};stop-opacity:0.2" />
            <stop offset="100%" style="stop-color:${color};stop-opacity:0" />
          </linearGradient>
        </defs>
        <path d="M ${points}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke" />
        <path d="M ${areaPoints}" fill="url(#grad-${color.replace('#', '')})" stroke="none" />
      </svg>
    `;
  }

  // Listen for price updates from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'PRICES_UPDATED') {
      loadTokens();
    }
  });
});
