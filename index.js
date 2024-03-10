import {
    close,
    addTick,
    migrate,
    lastTick,
    clearBuys,
    lastBuy,
    addBuy,
} from "./database.js"

import moment from 'moment';

const baseAPI = "https://api.kraken.com/0/"
const publicAPI = `${baseAPI}public/`
const privateAPI = `${baseAPI}private/`

const publicRateLimit = 1050 // 1 seg
const counterDecreasePerSecond = 0.5

var limits = {
    apiCounter: 0,
    maxApiCounter: 20,
    apiCounterDecay: 0.5,
}

let deposit = 15.5 // eur
let depositSchedule = 7 * 24 * 60 * 60 * 1000 // 7 days
let eurosPerMillis = deposit / depositSchedule
let minimumBTCBuy = 0.0001
let currentPrice = 0

var walletFunds = {}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms)
    })
}

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
        return null; // Indicate error or handle differently
    }
}

import crypto from "crypto"
function createAuthenticationSignature(endpoint, nonce, apiPostBodyData) {
    const apiPost = nonce + apiPostBodyData;
    const secret = Buffer.from(process.env.KRAKEN_API_SECRET, "base64");
    const sha256 = crypto.createHash("sha256");
    const hash256 = sha256.update(apiPost).digest("binary");
    const hmac512 = crypto.createHmac("sha512", secret);
    const signatureString = hmac512
        .update('/0/private/' + endpoint + hash256, "binary")
        .digest("base64");
    return signatureString;
};

import axios from "axios"
async function makePrivateRequest(endpoint, params = {}) {
    const nonce = Date.now().toString()
    let apiPostBodyData = "nonce=" + nonce
    for(let param in params) {
        let value = params[param]
        apiPostBodyData += `&${param}=${value}`
    }
    const url = `${privateAPI}${endpoint}`;
    const signature = createAuthenticationSignature(endpoint, nonce, apiPostBodyData)

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

var got_bitcoin_price = 0
async function get_bitcoin_price() {
    const data = await makePublicRequest("Ticker?pair=XBTEUR")
    got_bitcoin_price = Date.now()
    if( data != null ) {
        addTick(data.result.XXBTZEUR)
        return data.result.XXBTZEUR.c[0];
    }
    return 0
}

async function get_wallet_funds() {
    limits.apiCounter += 2
    const response = await makePrivateRequest("Balance")
    if( response.error ) {
        console.log(error)
        return null
    }
    return response.data.result
}

process.on('SIGINT', function() {
    close()
    console.log("Closing");
    process.exit();
});

function apiDecay() {
    limits.apiCounter -= limits.apiCounterDecay
    if( limits.apiCounter < 0 ) {
        limits.apiCounter = 0
    }
}

function getBalance(asset) {
    switch(asset) {
        case "BTC":
            return walletFunds.XXBT
        case "ETC":
            return walletFunds.XETC
        default:
            return walletFunds.ZEUR
    }
}

function amountToBuy() {
    let buyEachSecond = eurosPerMillis * 1000 * 1.0026 / currentPrice 
    if( buyEachSecond < minimumBTCBuy ) {
        buyEachSecond = minimumBTCBuy
    }
    return buyEachSecond
}

async function whenToBuy() {
    let buy = await lastBuy()
    //let buy = {id: 1, bought_at: Date.now(), price: 50000.00000, amount: 0.0001}
    if( buy == null ) {
        return Date.now()
    }
    let buyInEur = buy.amount * buy.price
    return buy.bought_at + buyInEur / eurosPerMillis
}

async function buyNow() {
    if( whenToBuy > Date.now() ) {
        return false
    }
    let volume = amountToBuy()
    const response = await makePrivateRequest("AddOrder", {
        ordertype: "market",
        type: "buy",
        volume,
        pair: "XBTEUR",
    })
    if( response.error ) {
        console.log(error)
        return null
    }
    console.log(response.data.result)
    addBuy(currentPrice * 1.0026, volume, response.data.result.txid[0])
}

(async function() {
    walletFunds = await get_wallet_funds()
    console.log(walletFunds)
    while(true) {
        console.log("============")
        await sleep(1000)
        apiDecay()
        console.log(`API Counter: ${limits.apiCounter}`)
        currentPrice = await get_bitcoin_price()
        let balance = getBalance()
        if( balance ) {
            console.log(`Balance: ${balance} EUR`)
            // let takerBalance = balance / 1.0026
            // let makerBalance = balance / 1.0016
            let bought = await lastBuy()
            console.log(`Bought ${moment(bought.bought_at).fromNow()}: ${bought.amount} BTC @ ${Math.round(bought.price,2)} EUR`)
            let buyingAt = await whenToBuy()
            if( buyingAt > Date.now() ) {
                console.log(`Buy ${moment(buyingAt).fromNow()}`)
            } else {
                console.log(`Buying now`)
                await buyNow()
                walletFunds = await get_wallet_funds()
            }
        }
        // calc buying speed btc/minute
        console.log(`Current Bitcoin price: ${currentPrice}`);
    }
})()
