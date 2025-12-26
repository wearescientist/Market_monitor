// API Handler - Abstraction layer for different exchange APIs

class APIHandler {
    /**
     * Fetch price data from the specified API
     * @param {Object} apiConfig - API configuration object
     * @param {string} symbol - Trading pair symbol (e.g., BTCUSDT)
     * @returns {Promise<Object>} Price data object
     */
    static async fetchPrice(apiConfig, symbol) {
        if (!apiConfig || !apiConfig.enabled) {
            throw new Error('API not configured or not enabled');
        }

        switch (apiConfig.type) {
            case 'binance':
                return await this.fetchBinance(apiConfig, symbol);
            case 'binanceFutures':
                return await this.fetchBinanceFutures(apiConfig, symbol);
            case 'coingecko':
                return await this.fetchCoinGecko(apiConfig, symbol);
            case 'coinmarketcap':
                return await this.fetchCoinMarketCap(apiConfig, symbol);
            case 'custom':
                return await this.fetchCustom(apiConfig, symbol);
            default:
                throw new Error(`Unknown API type: ${apiConfig.type}`);
        }
    }

    /**
     * Fetch price from Binance API
     */
    static async fetchBinance(config, symbol) {
        const headers = {};
        if (config.apiKey) {
            headers['X-MBX-APIKEY'] = config.apiKey;
        }

        // Fetch 24hr ticker
        const tickerUrl = `${config.baseUrl}/ticker/24hr?symbol=${symbol}`;
        const tickerResponse = await fetch(tickerUrl, { headers });

        if (!tickerResponse.ok) {
            throw new Error(`Binance API error: ${tickerResponse.statusText}`);
        }

        const tickerData = await tickerResponse.json();
        const currentPrice = parseFloat(tickerData.lastPrice);
        const priceChangePercent = parseFloat(tickerData.priceChangePercent);

        // Fetch K-line data
        let history = [];
        try {
            const klineUrl = `${config.baseUrl}/klines?symbol=${symbol}&interval=1h&limit=24`;
            const klineResponse = await fetch(klineUrl);

            if (klineResponse.ok) {
                const klineData = await klineResponse.json();
                history = klineData.map(k => parseFloat(k[4])); // Close price
            }
        } catch (e) {
            console.error('Error fetching Binance klines:', e);
        }

        return {
            currentPrice,
            priceChangePercent,
            history
        };
    }

    /**
     * Fetch price from Binance Futures API
     */
    static async fetchBinanceFutures(config, symbol) {
        const headers = {};
        if (config.apiKey) {
            headers['X-MBX-APIKEY'] = config.apiKey;
        }

        // Fetch 24hr ticker from Futures API
        const tickerUrl = `${config.baseUrl}/ticker/24hr?symbol=${symbol}`;
        const tickerResponse = await fetch(tickerUrl, { headers });

        if (!tickerResponse.ok) {
            throw new Error(`Binance Futures API error: ${tickerResponse.statusText}`);
        }

        const tickerData = await tickerResponse.json();
        const currentPrice = parseFloat(tickerData.lastPrice);
        const priceChangePercent = parseFloat(tickerData.priceChangePercent);

        // Fetch K-line data from Futures API
        let history = [];
        try {
            const klineUrl = `${config.baseUrl}/klines?symbol=${symbol}&interval=1h&limit=24`;
            const klineResponse = await fetch(klineUrl);

            if (klineResponse.ok) {
                const klineData = await klineResponse.json();
                history = klineData.map(k => parseFloat(k[4])); // Close price
            }
        } catch (e) {
            console.error('Error fetching Binance Futures klines:', e);
        }

        return {
            currentPrice,
            priceChangePercent,
            history
        };
    }

    /**
   * Fetch price from CoinGecko API
   */
    static async fetchCoinGecko(config, symbol) {
        // CoinGecko uses coin IDs, not trading pairs
        // Convert BTCUSDT -> bitcoin, ETHUSDT -> ethereum, etc.
        const coinMap = {
            // Cryptocurrencies
            'BTCUSDT': 'bitcoin',
            'ETHUSDT': 'ethereum',
            'SOLUSDT': 'solana',
            'PAXGUSDT': 'pax-gold',
            'BNBUSDT': 'binancecoin',
            'DOGEUSDT': 'dogecoin',
            'XRPUSDT': 'ripple',
            'ADAUSDT': 'cardano',
            'MATICUSDT': 'matic-network',
            'DOTUSDT': 'polkadot',
            'AVAXUSDT': 'avalanche-2',
            'LINKUSDT': 'chainlink',
            'UNIUSDT': 'uniswap',
            'LTCUSDT': 'litecoin',
            'ATOMUSDT': 'cosmos',
            'HYPEUSDT': 'hyperliquid',
            'HYPE': 'hyperliquid',
            // RWA - xStock Tokenized Assets
            'TSLAUSDT': 'tesla-xstock',
            'TESLAAPPS': 'tesla-xstock',
            'GOOGLUSDT': 'alphabet-xstock',
            'GOOGLEUSDT': 'alphabet-xstock',
            'NVDAUSDT': 'nvidia-xstock',
            'NVIDIAUSDT': 'nvidia-xstock',
            'AAPLUSDT': 'apple-xstock',
            'APPLEUSDT': 'apple-xstock',
            'MSFTUSDT': 'microsoft-xstock',
            'MICROSOFTUSDT': 'microsoft-xstock',
            'AMZNUSDT': 'amazon-xstock',
            'AMAZONUSDT': 'amazon-xstock',
            'METAUSDT': 'meta-xstock',
            'NFLXUSDT': 'netflix-xstock',
            'NETFLIXUSDT': 'netflix-xstock',
            'COINUSDT': 'coinbase-xstock',
            'COINBASEUSDT': 'coinbase-xstock',
            // Fuzzy search aliases (stock tickers without USDT)
            'TSLA': 'tesla-xstock',
            'GOOGL': 'alphabet-xstock',
            'GOOG': 'alphabet-xstock',
            'NVDA': 'nvidia-xstock',
            'AAPL': 'apple-xstock',
            'MSFT': 'microsoft-xstock',
            'AMZN': 'amazon-xstock',
            'META': 'meta-xstock',
            'NFLX': 'netflix-xstock',
            'COIN': 'coinbase-xstock'
        };

        // Try direct mapping first, then with USDT suffix, then lowercase
        let coinId = coinMap[symbol] ||
            coinMap[symbol + 'USDT'] ||
            coinMap[symbol.toUpperCase()];

        // If still not found, try removing USDT and lowercase
        if (!coinId) {
            coinId = symbol.replace('USDT', '').toLowerCase();
        }

        const headers = {
            'Accept': 'application/json'
        };

        if (config.apiKey) {
            headers['x-cg-demo-api-key'] = config.apiKey;
        }

        // Fetch current price and 24h change
        const priceUrl = `${config.baseUrl}/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`;
        const priceResponse = await fetch(priceUrl, { headers });

        if (!priceResponse.ok) {
            throw new Error(`CoinGecko API error: ${priceResponse.statusText}`);
        }

        const priceData = await priceResponse.json();

        if (!priceData[coinId]) {
            throw new Error(`CoinGecko: Coin ${coinId} not found`);
        }

        const currentPrice = priceData[coinId].usd;
        const priceChangePercent = priceData[coinId].usd_24h_change || 0;

        // Fetch market chart for history (last 24 hours)
        let history = [];
        try {
            const chartUrl = `${config.baseUrl}/coins/${coinId}/market_chart?vs_currency=usd&days=1&interval=hourly`;
            console.log(`[CoinGecko] Fetching chart for ${coinId}: ${chartUrl}`);
            const chartResponse = await fetch(chartUrl, { headers });

            console.log(`[CoinGecko] Chart response status: ${chartResponse.status}`);

            if (chartResponse.ok) {
                const chartData = await chartResponse.json();
                console.log(`[CoinGecko] Chart data received:`, chartData);

                if (chartData.prices && chartData.prices.length > 0) {
                    history = chartData.prices.slice(-24).map(p => p[1]); // Get last 24 prices
                    console.log(`[CoinGecko] Extracted ${history.length} price points`);
                } else {
                    console.warn(`[CoinGecko] No prices in chart data for ${coinId}`);
                }
            } else {
                const errorText = await chartResponse.text();
                console.error(`[CoinGecko] Chart fetch failed (${chartResponse.status}):`, errorText);
            }
        } catch (e) {
            console.error(`[CoinGecko] Error fetching chart for ${coinId}:`, e);
        }

        return {
            currentPrice,
            priceChangePercent,
            history
        };
    }

    /**
   * Fetch price from CoinMarketCap API
   */
    static async fetchCoinMarketCap(config, symbol) {
        // CoinMarketCap requires API key
        if (!config.apiKey) {
            throw new Error('CoinMarketCap requires an API key');
        }

        // Expanded symbol mapping for CMC
        const symbolMap = {
            // Cryptocurrencies
            'BTCUSDT': 'BTC',
            'ETHUSDT': 'ETH',
            'SOLUSDT': 'SOL',
            'PAXGUSDT': 'PAXG',
            'BNBUSDT': 'BNB',
            'DOGEUSDT': 'DOGE',
            'XRPUSDT': 'XRP',
            'ADAUSDT': 'ADA',
            'MATICUSDT': 'MATIC',
            'DOTUSDT': 'DOT',
            'AVAXUSDT': 'AVAX',
            'LINKUSDT': 'LINK',
            'UNIUSDT': 'UNI',
            'LTCUSDT': 'LTC',
            'ATOMUSDT': 'ATOM',
            // RWA - Tokenized Stocks
            'TSLAUSDT': 'TSLA',
            'GOOGLUSDT': 'GOOGL',
            'NVDAUSDT': 'NVDA',
            'AAPLUSDT': 'AAPL',
            'MSFTUSDT': 'MSFT',
            'AMZNUSDT': 'AMZN',
            'METAUSDT': 'META',
            'NFLXUSDT': 'NFLX',
            'COINUSDT': 'COIN',
            // RWA - ETFs
            'QQQUSDT': 'QQQ',
            'SPYUSDT': 'SPY',
            'VTIUSDT': 'VTI',
            'IWIUSDT': 'IWI'
        };

        const cmcSymbol = symbolMap[symbol] || symbol.replace('USDT', '');

        const headers = {
            'X-CMC_PRO_API_KEY': config.apiKey,
            'Accept': 'application/json'
        };

        // Fetch latest quote
        const quoteUrl = `${config.baseUrl}/cryptocurrency/quotes/latest?symbol=${cmcSymbol}&convert=USD`;
        const quoteResponse = await fetch(quoteUrl, { headers });

        if (!quoteResponse.ok) {
            const errorText = await quoteResponse.text();
            throw new Error(`CoinMarketCap API error (${quoteResponse.status}): ${errorText}`);
        }

        const quoteData = await quoteResponse.json();

        // Check for API-level errors
        if (quoteData.status && quoteData.status.error_code !== 0) {
            throw new Error(`CoinMarketCap: ${quoteData.status.error_message}`);
        }

        if (!quoteData.data || !quoteData.data[cmcSymbol]) {
            throw new Error(`CoinMarketCap: Symbol ${cmcSymbol} not found`);
        }

        const coinData = quoteData.data[cmcSymbol];
        const currentPrice = coinData.quote.USD.price;
        const priceChangePercent = coinData.quote.USD.percent_change_24h || 0;

        // Note: CMC historical data requires premium plan
        // For now, we'll return empty history
        let history = [];

        return {
            currentPrice,
            priceChangePercent,
            history
        };
    }

    /**
     * Fetch price from Custom API
     * Expected format: { price: number, change24h: number, history: number[] }
     */
    static async fetchCustom(config, symbol) {
        const headers = {
            'Content-Type': 'application/json'
        };

        if (config.apiKey) {
            headers['Authorization'] = `Bearer ${config.apiKey}`;
        }

        const url = `${config.baseUrl}?symbol=${symbol}`;
        const response = await fetch(url, { headers });

        if (!response.ok) {
            throw new Error(`Custom API error: ${response.statusText}`);
        }

        const data = await response.json();

        // Flexible parsing - try different common formats
        const currentPrice = parseFloat(data.price || data.lastPrice || data.last || 0);
        const priceChangePercent = parseFloat(data.change24h || data.priceChangePercent || data.changePercent || 0);
        const history = data.history || data.kline || data.candles || [];

        if (!currentPrice) {
            throw new Error('Custom API: Could not parse price from response');
        }

        return {
            currentPrice,
            priceChangePercent,
            history: Array.isArray(history) ? history : []
        };
    }
}

// Export for ES6 modules
export default APIHandler;
