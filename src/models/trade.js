import moment from 'moment'

import {database} from "../../database.js"
import {kraken} from "../kraken.js"

async function setup() {
    const query = `
        SELECT * from buys WHERE cost is 0 ORDER BY bought_at ASC;
    `
    const trades = await database.all(query);
    if( trades.length == 0 ) {
        // console.log("trade:", await database.get("SELECT * from buys ORDER BY bought_at DESC"))
        return
    }
    const first = trades[0]
    const last = trades[trades.length - 1]
    let firstDate = moment(first.bought_at).subtract(1, 'hours')
    let lastDate = moment(last.bought_at).add(1,'hours')
    const res = await kraken.getTradesHistory(firstDate.unix(), lastDate.unix())
    const data = res.data
    if( data.result == null ) {
        return
    }
    if( data.result.count == null || data.result.count == 0 ) {
        return
    }
    const krakenTrades = data.result.trades
    for( let krakenTrade of Object.values(krakenTrades) ) {
        const totalCost = (parseFloat(krakenTrade.cost) + parseFloat(krakenTrade.fee)).toFixed(5)
        const updateQuery = `
        UPDATE buys
        SET total_cost = ${totalCost},
            confirmed = true,
            cost = ${krakenTrade.cost},
            fee = ${krakenTrade.fee}
        WHERE txid = "${krakenTrade.ordertxid}"
        `
        await database.exec(updateQuery)
    }
}

await setup();
