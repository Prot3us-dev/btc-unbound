import axios from "axios"
import crypto from "crypto"

export function kraken() {
    const baseAPI = "https://api.kraken.com/0/"
    const publicAPI = `${baseAPI}public/`
    const privateAPI = `${baseAPI}private/`

    const publicRateLimit = 1050 // 1 seg
    const counterDecreasePerSecond = 0.5

    async function makePublicRequest(endpoint) {
        const url = `${publicAPI}${endpoint}`;
        try {
            const response = await fetch(url);
            if( !response.ok ) {
                throw new Error(`API request failed with status ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error("Error fetching Bitcoin price:", error);
            return null;
        }
    }

    async function makePrivateRequest(endpoint, params = {}) {
        const nonce = Date.now().toString()
        let apiPostBodyData = "nonce=" + nonce
        for(let param in params) {
            let value = params[param]
            apiPostBodyData += `&${param}=${value}`
        }
        const url = `${privateAPI}${endpoint}`;
        const apiPost = nonce + apiPostBodyData;
        const secret = Buffer.from(process.env.KRAKEN_API_SECRET, "base64");
        const sha256 = crypto.createHash("sha256");
        const hash256 = sha256.update(apiPost).digest("binary");
        const hmac512 = crypto.createHmac("sha512", secret);
        const signature = hmac512
            .update('/0/private/' + endpoint + hash256, "binary")
            .digest("base64");

        try {
            const options = {
                headers: {
                    "API-Key": process.env.KRAKEN_API_KEY,
                    "API-Sign": signature,
                }
            }
            let data = await axios.post(url, apiPostBodyData, options)
            // if( !response.ok ) {
            //     throw new Error(`API request failed with status ${response.status}`);
            // }
            return data
        } catch (error) {
            console.error("Error fetching Bitcoin price:", error);
            return null; // Indicate error or handle differently
        }
    }

    const pairs = {
        BTCEUR: 'XBTEUR'
    }

    return {
        // Public
        async getPrice(crypto, fiat) {
            return await makePublicRequest(`Ticker?pair=${pairs[crypto+fiat]}`)
        },
        // Private
        async addOrder(params) {
            return await makePrivateRequest("AddOrder", {
                ordertype: "market",
                type: "buy",
                volume,
                pair: "XBTEUR",
            })
        },
        async getBalance() {
            return await makePrivateRequest("Balance")
        }
    }

}
