import {
    close,
    addTick,
    migrate,
    lastTick,
    clearBuys,
    lastBuy,
    addBuy,
} from "./database.js"

import { kraken } from './src/kraken.js'

const broker = kraken()

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

var got_bitcoin_price = 0
async function get_bitcoin_price() {
    const data = await broker.getPrice("BTC", "EUR")
    if( data != null ) {
        addTick(data.result.XXBTZEUR)
        return data.result.XXBTZEUR.c[0];
    }
    return 0
}

async function get_wallet_funds() {
    limits.apiCounter += 2
    const response = await broker.getBalance()
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
    const response = await broker.addOrder({
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
            let bought = await lastBuy()
            console.log(`Bought ${moment(bought.bought_at).fromNow()}: ${bought.amount} BTC @ ${Math.round(bought.price,2)} EUR`)
            let buyingAt = await whenToBuy()
            if( buyingAt > Date.now() ) {
                let m = moment(buyingAt)
                console.log(`Buy ${m.fromNow()} | ${m.format("DD/MM/YY HH:mm")}`)
            } else {
                console.log(`Buying now`)
                await buyNow()
                walletFunds = await get_wallet_funds()
            }
        }
        console.log(`Current Bitcoin price: ${currentPrice}`);
    }
})()
