export function kraken() {
    const api_key = process.env.KRAKEN_API_KEY
    const api_secret = process.env.KRAKEN_API_SECRET
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

    const pairs = {
        BTCEUR: 'XBTEUR'
    }

    return {
        async getPrice(crypto, fiat) {
            return await makePublicRequest(`Ticker?pair=${pairs[crypto+fiat]}`)
        },
    }

}
