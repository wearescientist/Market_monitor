# Assets Monitor / 资产监控器

> Monitor crypto, stocks, and A-shares prices with real-time alerts
> 
> 监控加密货币、股票和 A 股价格，支持实时价格警报

[English](#english) | [中文](#中文)

---

<a name="english"></a>
## 🇺🇸 English

### Features

- **Multi-Exchange Support**: Binance, Binance Futures, CoinGecko, CoinMarketCap, A-Shares (China stocks)
- **Real-time Price Alerts**: Set up to 2 alert prices per asset
- **Price Charts**: 24-hour sparkline visualization
- **Sound Notifications**: Audio alerts when price targets are hit
- **Password Protection**: Encrypt API keys with master password (AES-GCM + PBKDF2)
- **Privacy First**: All data stored locally, no server upload

### Installation

1. Download the latest release from GitHub
2. Unzip the file
3. Open Chrome/Edge and go to `chrome://extensions/`
4. Enable "Developer mode" (top right)
5. Click "Load unpacked" and select the unzipped folder

### Usage

#### First Time Setup
1. Open the extension from the toolbar
2. Set a master password to protect your data
3. The default watchlist includes BTC, ETH, SOL, and PAXG

#### Adding Assets
1. Select an API provider (e.g., Binance)
2. Enter the symbol (e.g., BTCUSDT)
3. Click "Add"

#### Setting Price Alerts
1. Click on the alert row under each asset
2. Enter your target price
3. The percentage difference from current price will be shown

#### API Configuration (Optional)
1. Click the settings (gear) icon
2. Select an API provider
3. Enter your API key (encrypted with your master password)

> Note: Public APIs like Binance work without API keys. Private APIs like CoinMarketCap require an API key.

### Security

- **Encryption**: All API keys are encrypted using Web Crypto API (PBKDF2 + AES-GCM)
- **Master Password**: Required to unlock the extension each session
- **Local Storage**: All data stays on your device
- **Forgot Password**: You can reset all data if you forget your password (irreversible)

### Privacy Policy

- No personal data is collected
- No data is sent to external servers (except price queries to exchange APIs)
- API keys are encrypted and never exposed in plain text

---

<a name="中文"></a>
## 🇨🇳 中文

### 功能特性

- **多交易所支持**：币安、币安合约、CoinGecko、CoinMarketCap、A 股（沪深）
- **实时价格警报**：每个资产可设置 2 个警报价格
- **价格走势图**：24 小时 Sparkline 可视化
- **声音提醒**：价格达到目标时播放提醒音
- **密码保护**：使用主密码加密 API 密钥（AES-GCM + PBKDF2）
- **隐私优先**：所有数据本地存储，不上传服务器

### 安装方法

1. 从 GitHub 下载最新版本
2. 解压文件
3. 打开 Chrome/Edge 浏览器，访问 `chrome://extensions/`
4. 开启右上角"开发者模式"
5. 点击"加载已解压的扩展程序"，选择解压后的文件夹

### 使用说明

#### 首次设置
1. 从工具栏打开扩展程序
2. 设置主密码以保护您的数据
3. 默认监控列表包含 BTC、ETH、SOL 和 PAXG

#### 添加资产
1. 选择 API 提供商（如币安）
2. 输入交易对代码（如 BTCUSDT）
3. 点击"添加"

#### 设置价格警报
1. 点击资产下方的警报行
2. 输入目标价格
3. 会显示与当前价格的百分比差异

#### 配置 API（可选）
1. 点击设置（齿轮）图标
2. 选择 API 提供商
3. 输入 API 密钥（将使用主密码加密）

> 注意：币安等公共 API 无需 API 密钥即可使用。CoinMarketCap 等私有 API 需要 API 密钥。

### 安全性

- **加密技术**：使用 Web Crypto API 加密所有 API 密钥（PBKDF2 + AES-GCM）
- **主密码**：每次使用扩展程序时需要输入密码解锁
- **本地存储**：所有数据保存在您的设备上
- **忘记密码**：如忘记密码可选择重置所有数据（不可恢复）

### 隐私政策

- 不收集任何个人数据
- 除向交易所 API 查询价格外，不向外部服务器发送数据
- API 密钥经过加密，绝不会以明文形式暴露

---

## 🔧 Tech Stack / 技术栈

- **Manifest V3**: Chrome Extension latest standard
- **Web Crypto API**: PBKDF2 + AES-GCM encryption
- **Offscreen API**: Audio playback in service worker context
- **Side Panel API**: Native Chrome side panel integration

---

## 📝 Changelog / 更新日志

See [CHANGELOG.md](./CHANGELOG.md) for version history.

查看 [CHANGELOG.md](./CHANGELOG.md) 了解版本历史。

---

## 📄 License / 许可证

MIT License - feel free to use and modify!

MIT 许可证 - 自由使用和修改！
