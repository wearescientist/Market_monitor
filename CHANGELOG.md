# Changelog - Assets Monitor

## [1.2.0] - 2026-02-01

### 🔒 Security
- **新增密码保护机制**：使用主密码加密所有 API Key
  - 基于 Web Crypto API (PBKDF2 + AES-GCM) 实现
  - 密码验证器模式防止时序攻击
  - 密码仅保存在内存中，浏览器重启后需重新输入
- **新增"忘记密码"功能**：可选择重置所有数据（包括 API Key 和监控列表）
- **修复权限问题**：移除过于宽泛的 `https://*/*` 主机权限

### 🛠️ Improvements
- **代码简化** (`popup.js`)
  - 函数拆分：将超长函数拆分为小于 50 行的小函数
  - 减少嵌套：使用早返回模式替代深层嵌套
  - 提取常量：消除魔法数字，提高可读性
  - 代码复用：合并重复的警报输入逻辑
  
- **代码简化** (`background.js`)
  - 函数职责分离：`checkPrices()` 拆分为 6 个小函数
  - 处理器映射：消息监听使用映射表替代长 if-else 链
  - 提取常量：默认数据统一从常量获取
  
- **错误处理优化**
  - 更精确的加密错误识别（区分"密码错误"和系统错误）
  - 修复 Base64 编解码问题（逐字节处理避免编码损坏）

### 🐛 Bug Fixes
- 修复密码设置后数据无法显示的问题
- 修复 Service Worker 语法错误
- 修复重复发送 UPDATE_SETTINGS 消息的问题
- 修复错误密码也能进入的问题（新增密码验证器）

### 📁 New Files
- `crypto-utils.js` - 加密工具类，提供加密/解密功能
- `AGENTS.md` - AI 助手规则配置

### 📝 Known Issues
- Chrome Alarms API 最小周期为 1 分钟，低于 60 秒的刷新间隔在正式版扩展中可能不准确

---

## [1.1.0] - Previous Version

### Features
- 多 API 支持（Binance、Binance Futures、CoinGecko、CoinMarketCap、A股）
- 价格警报功能（支持双价格点）
- 价格走势图（Sparkline）
- 声音提醒（使用 Offscreen Document）
- Side Panel 界面
