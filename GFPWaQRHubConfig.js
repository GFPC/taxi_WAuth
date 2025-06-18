// Конфигурация
const API_URL = 'http://localhost:8010'; // URL вашего сервера
const API_KEY = '123'; // API ключ из .env файла
const BOT_NAME = 'Taxi MultiConfig Bot config='; // Имя вашего бота
const BOT_DESCRIPTION = 'Optional bot description'; // Описание бота

function getWAQRHubConfig(config_name, bot_phone) {
    return {
        API_URL,
        API_KEY,
        BOT_NAME: BOT_NAME + config_name,
        BOT_DESCRIPTION: BOT_DESCRIPTION + 'CONFIG=' + config_name + ';PHONE=' + bot_phone,
    };
}

// API Configuration
const API_CONFIG = {
    BASE_URL: 'http://localhost:8010/api',
    ENDPOINTS: {
        STATUS: '/status',
        REGISTER: '/whatsapp/register',
        CHECK_REGISTER: '/whatsapp/check_register',
        UPDATE_QR: '/whatsapp/update_qr',
        UPDATE_AUTH_STATE: '/whatsapp/update_auth_state',
        NOTIFY: '/whatsapp/notify'
    }
};

// Main Client Class
class GFPWAQRClient {
    constructor(baseUrl = API_CONFIG.BASE_URL) {
        this.baseUrl = baseUrl;
    }

    /**
     * Make HTTP request to API
     */
    async makeRequest(endpoint, method = 'GET', body) {
        const url = `${this.baseUrl}${endpoint}`;

        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        try {
            const response = await fetch(url, options);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`API request failed for ${endpoint}:`, error);
            throw error;
        }
    }

    /**
     * Check API health status
     */
    async checkHealth() {
        return this.makeRequest(API_CONFIG.ENDPOINTS.STATUS);
    }

    /**
     * Check if WhatsApp bot is registered
     */
    async checkRegistration(botId) {
        const request = { bot_id: botId };
        return this.makeRequest(
            API_CONFIG.ENDPOINTS.CHECK_REGISTER,
            'POST',
            request
        );
    }

    /**
     * Register new WhatsApp bot
     */
    async registerBot(botData) {
        const request = { bot: botData };
        return this.makeRequest(
            API_CONFIG.ENDPOINTS.REGISTER,
            'POST',
            request
        );
    }

    /**
     * Update QR code for bot
     */
    async updateQR(botId, qrData) {
        const request = {
            bot_id: botId,
            qr_data: qrData
        };
        return this.makeRequest(
            API_CONFIG.ENDPOINTS.UPDATE_QR,
            'POST',
            request
        );
    }

    /**
     * Update authentication state
     */
    async updateAuthState(botId, state) {
        const request = {
            bot_id: botId,
            state: state
        };
        return this.makeRequest(
            API_CONFIG.ENDPOINTS.UPDATE_AUTH_STATE,
            'POST',
            request
        );
    }

    /**
     * Complete bot initialization flow
     */
    async initializeBot(botData) {
        try {
            console.log('🔍 Checking bot registration...');

            // Check if bot is already registered
            const checkResponse = await this.checkRegistration(botData.id);

            if (checkResponse.success) {
                console.log('✅ Bot is already registered');
                return true;
            }

            console.log('📝 Registering new bot...');

            // Register the bot
            const registerResponse = await this.registerBot(botData);

            if (registerResponse.success) {
                console.log('✅ Bot registered successfully');
                return true;
            } else {
                console.error('❌ Failed to register bot:', registerResponse.message);
                return false;
            }
        } catch (error) {
            console.error('❌ Bot initialization failed:', error);
            return false;
        }
    }

    /**
     * Send QR code to Telegram users
     */
    async sendQRCode(botId, qrData) {
        try {
            console.log('📱 Sending QR code to Telegram users...');

            const response = await this.updateQR(botId, qrData);

            if (response.success) {
                console.log('✅ QR code sent successfully');
                return true;
            } else {
                console.error('❌ Failed to send QR code:', response.message);
                return false;
            }
        } catch (error) {
            console.error('❌ QR code sending failed:', error);
            return false;
        }
    }

    /**
     * Update bot authentication status
     */
    async setAuthenticated(botId, isAuthenticated) {
        try {
            const state = isAuthenticated ? 'authed' : 'not_authed';
            console.log(`🔐 Updating auth state to: ${state}`);

            const response = await this.updateAuthState(botId, state);

            if (response.success) {
                console.log('✅ Auth state updated successfully');
                return true;
            } else {
                console.error('❌ Failed to update auth state:', response.message);
                return false;
            }
        } catch (error) {
            console.error('❌ Auth state update failed:', error);
            return false;
        }
    }

    async sendCustomNotification(botId, message, senderName = 'WhatsApp Bot') {
        const request = {
            bot_id: botId,
            message: message,
            sender_name: senderName
        };

        return this.makeRequest(
            API_CONFIG.ENDPOINTS.NOTIFY,
            'POST',
            request
        );
    }
}

// Usage Examples
function createWhatsAppBotClient(baseUrl) {
    return new GFPWAQRClient(baseUrl);
}

// Export functions
module.exports = {
    getWAQRHubConfig,
    createWhatsAppBotClient,
    GFPWAQRClient
};