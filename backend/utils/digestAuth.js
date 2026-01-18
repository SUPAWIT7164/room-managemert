const crypto = require('crypto');
const axios = require('axios');

/**
 * Digest Authentication helper for HTTP requests
 */
class DigestAuth {
    constructor(username, password) {
        this.username = username;
        this.password = password;
        this.nonce = null;
        this.realm = null;
        this.qop = null;
        this.opaque = null;
        this.nc = 0;
        this.cnonce = null;
    }

    generateCNonce() {
        return crypto.randomBytes(16).toString('hex');
    }

    md5(str) {
        return crypto.createHash('md5').update(str).digest('hex');
    }

    parseDigestChallenge(wwwAuthenticate) {
        const parts = wwwAuthenticate.replace(/Digest /i, '').split(',');
        const params = {};
        
        parts.forEach(part => {
            part = part.trim();
            // Handle quoted values (may contain spaces, parentheses, etc.)
            const quotedMatch = part.match(/(\w+)="([^"]+)"/);
            if (quotedMatch) {
                params[quotedMatch[1]] = quotedMatch[2];
            } else {
                // Handle unquoted values
                const unquotedMatch = part.match(/(\w+)=([^,\s]+)/);
                if (unquotedMatch) {
                    params[unquotedMatch[1]] = unquotedMatch[2];
                }
            }
        });

        return params;
    }

    generateDigestAuthHeader(method, uri, body = '') {
        this.nc++;
        this.cnonce = this.generateCNonce();

        const ha1Input = `${this.username}:${this.realm}:${this.password}`;
        const ha1 = this.md5(ha1Input);
        const ha2Input = `${method}:${uri}`;
        const ha2 = this.md5(ha2Input);
        
        let responseInput;
        let response;
        if (this.qop) {
            responseInput = `${ha1}:${this.nonce}:${String(this.nc).padStart(8, '0')}:${this.cnonce}:${this.qop}:${ha2}`;
            response = this.md5(responseInput);
        } else {
            responseInput = `${ha1}:${this.nonce}:${ha2}`;
            response = this.md5(responseInput);
        }

        // Debug logging (without password)
        console.log(`[DigestAuth] HA1 input: ${this.username}:${this.realm}:***`);
        console.log(`[DigestAuth] HA1: ${ha1}`);
        console.log(`[DigestAuth] HA2 input: ${method}:${uri}`);
        console.log(`[DigestAuth] HA2: ${ha2}`);
        console.log(`[DigestAuth] Response: ${response}`);

        const authParams = [
            `username="${this.username}"`,
            `realm="${this.realm}"`,
            `nonce="${this.nonce}"`,
            `uri="${uri}"`,
            `response="${response}"`
        ];

        if (this.qop) {
            authParams.push(`qop=${this.qop}`);
            authParams.push(`nc=${String(this.nc).padStart(8, '0')}`);
            authParams.push(`cnonce="${this.cnonce}"`);
        }

        if (this.opaque) {
            authParams.push(`opaque="${this.opaque}"`);
        }

        return `Digest ${authParams.join(', ')}`;
    }

    async request(method, url, options = {}) {
        try {
            // First request to get challenge
            const firstResponse = await axios({
                method,
                url,
                ...options,
                validateStatus: (status) => status === 401 || status === 200
            });

            // If already authenticated, return response
            if (firstResponse.status === 200) {
                return firstResponse;
            }

            // Parse digest challenge
            const wwwAuthenticate = firstResponse.headers['www-authenticate'] || firstResponse.headers['WWW-Authenticate'];
            if (!wwwAuthenticate || !wwwAuthenticate.toLowerCase().startsWith('digest')) {
                throw new Error('Server does not support Digest Authentication');
            }

            console.log(`[DigestAuth] Challenge: ${wwwAuthenticate}`);
            const challenge = this.parseDigestChallenge(wwwAuthenticate);
            console.log(`[DigestAuth] Parsed challenge:`, challenge);
            
            this.realm = challenge.realm;
            this.nonce = challenge.nonce;
            this.qop = challenge.qop;
            this.opaque = challenge.opaque;

            // Generate URI from URL
            const urlObj = new URL(url);
            const uri = urlObj.pathname + (urlObj.search || '');
            console.log(`[DigestAuth] URI: ${uri}`);

            // Generate Authorization header
            const authHeader = this.generateDigestAuthHeader(method, uri);
            console.log(`[DigestAuth] Authorization header: ${authHeader.substring(0, 100)}...`);

            // Retry request with digest auth
            const response = await axios({
                method,
                url,
                headers: {
                    ...options.headers,
                    'Authorization': authHeader
                },
                ...options
            });

            console.log(`[DigestAuth] Response status: ${response.status}`);
            return response;
        } catch (error) {
            console.error(`[DigestAuth] Error:`, error.message);
            if (error.response) {
                console.error(`[DigestAuth] Response status: ${error.response.status}`);
                console.error(`[DigestAuth] Response headers:`, error.response.headers);
            }
            throw error;
        }
    }
}

module.exports = DigestAuth;

