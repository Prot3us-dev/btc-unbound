import ui from './src/interface.js'
import {Trade} from './src/models/trade.js'
import {
    close,
    addTick,
    lastTick,
    clearBuys,
    addBuy,
} from "./database.js"
import { kraken } from './src/kraken.js'

const broker = kraken

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

let deposit = 30 // eur
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
    try {
        const data = await broker.getPrice("BTC", "EUR")
        addTick(data.result.XXBTZEUR)
        currentPrice = data.result.XXBTZEUR.c[0]
        return data.result.XXBTZEUR
    } catch {
        return currentPrice
    }
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
    // console.log("Closing");
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

async function amountToBuy() {
    let bought = await Trade.lastTrade()
    if( bought == null ) {
        return minimumBTCBuy
    }
    let buyEachMilli = eurosPerMillis / (currentPrice * 1.0026)
    let millisPassed = Date.now() - bought.bought_at
    let buyNow = buyEachMilli * millisPassed
    // console.log(`CAN BUY ${buyNow.toFixed(8)}`)
    return buyNow.toFixed(8)
}

async function whenToBuy() {
    let bought = await Trade.lastTrade()
    //let buy = {id: 1, bought_at: Date.now(), price: 50000.00000, amount: 0.0001}
    if( bought == null ) {
        return Date.now()
    }
    let buyNow = await amountToBuy()
    let buyEachMilli = eurosPerMillis / (currentPrice * 1.0026)
    if( buyNow < minimumBTCBuy ) {
        const missing = minimumBTCBuy - buyNow
        const missingMillis = missing / buyEachMilli
        const buyAt = Date.now() + missingMillis
        return buyAt
    }
    return Date.now()
}

async function buyNow() {
    if( whenToBuy() > Date.now() ) {
        return false
    }
    let volume = await amountToBuy()
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
    // console.log(response.data.result)
    addBuy(currentPrice * 1.0026, volume, response.data.result.txid[0])
    // const trade = new Trade({
    //     amount: volume,
    //     price: currentPrice * 1.0026,
    //     txid: response.data.result.txid[0],
    // })
    // await trade.save()
}

// let trade = await Trade.fetchOrder("OGAOZA-FLAJU-HNB4CZ")

let trades = await Trade.all()
for( let trade of trades ) {
    ui.addTrade(trade)
}

walletFunds = await get_wallet_funds()
ui.addWalletFunds(walletFunds)
while(true) {
    await sleep(1000)
    apiDecay()
    ui.addAPICounter(limits.apiCounter)
    let price = await get_bitcoin_price()
    ui.addPrice(price)
    if( getBalance() ) {
        let bought = await Trade.lastTrade()
        ui.addLastBuy(bought)
        let buyingAt = await whenToBuy()
        if( buyingAt > Date.now() ) {
            let m = moment(buyingAt)
            ui.addBuyAt(m)
        } else {
            await buyNow()
            walletFunds = await get_wallet_funds()
            ui.addWalletFunds(walletFunds)
        }
    }
}
