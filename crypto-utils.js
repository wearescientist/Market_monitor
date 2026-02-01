// Crypto Utils - Simple encryption for API keys using user password
// Uses Web Crypto API with PBKDF2 + AES-GCM

class CryptoUtils {
    // Reliable Base64 encoding for Uint8Array
    static arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    // Reliable Base64 decoding to Uint8Array
    static base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    static async deriveKey(password, salt) {
        const encoder = new TextEncoder();
        const passwordData = encoder.encode(password);
        
        // Import password as key material
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            passwordData,
            'PBKDF2',
            false,
            ['deriveKey']
        );
        
        // Derive AES-GCM key using PBKDF2
        return await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }
    
    static async encrypt(text, password) {
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(text);
            
            // Generate random salt and IV
            const salt = crypto.getRandomValues(new Uint8Array(16));
            const iv = crypto.getRandomValues(new Uint8Array(12));
            
            // Derive key
            const key = await this.deriveKey(password, salt);
            
            // Encrypt
            const encrypted = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                data
            );
            
            // Combine salt + iv + ciphertext for storage
            const result = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
            result.set(salt, 0);
            result.set(iv, salt.length);
            result.set(new Uint8Array(encrypted), salt.length + iv.length);
            
            // Return as base64 string using reliable encoder
            return this.arrayBufferToBase64(result);
        } catch (error) {
            console.error('Encryption failed:', error);
            throw new Error('Failed to encrypt data');
        }
    }
    
    static async decrypt(encryptedBase64, password) {
        try {
            // Decode base64 using reliable decoder
            const encryptedData = this.base64ToArrayBuffer(encryptedBase64);
            
            // Verify minimum length (salt + iv = 28 bytes)
            if (encryptedData.length < 28) {
                throw new Error('Invalid encrypted data length');
            }
            
            // Extract salt, iv, and ciphertext
            const salt = encryptedData.slice(0, 16);
            const iv = encryptedData.slice(16, 28);
            const ciphertext = encryptedData.slice(28);
            
            // Derive key
            const key = await this.deriveKey(password, salt);
            
            // Decrypt
            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                ciphertext
            );
            
            const decoder = new TextDecoder();
            return decoder.decode(decrypted);
        } catch (error) {
            // Don't log error for wrong password (expected case)
            if (error.name === 'OperationError' || error.name === 'DataError') {
                throw new Error('Wrong password');
            }
            console.error('Decryption failed:', error);
            throw new Error('Failed to decrypt data');
        }
    }
}

// Export for ES6 modules
export default CryptoUtils;
