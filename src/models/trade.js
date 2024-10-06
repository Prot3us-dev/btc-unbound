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

export class Trade {
    constructor({id, amount, bought_at, confirmed, cost, fee, price, total_cost, txid}) {
        this.id = id
        this.txid = txid
        this.amount = amount
        this.bought_at = bought_at
        this.confirmed = confirmed
        this.cost = cost
        this.fee = fee
        this.price = price
        this.total_cost = total_cost
    }

    static async all() {
        const query = "SELECT * from buys ORDER BY bought_at ASC";
        const rows = await database.all(query)
        let trades = []
        for(let row of rows) {
            trades.push(new Trade(row))
        }
        return trades
    }

    static async txid(txid) {
        const query = `
        SELECT * from buys WHERE txid = ?;
        `
        const trade = await database.get(query, txid)
        if( trade == null ) {
            return null
        }
        return new Trade(trade)
    }

    static async fetchOrder(txid) {
        let trade = await Trade.txid(txid)
        const res = await kraken.queryOrdersInfo([txid])
        const data = res.data.result[txid]
        if( data == null ) {
            return null
        }
        if( trade == null ) {
            trade = new Trade({
                amount: data.vol,
                bought_at: data.closetm * 1000,
                confirmed: data.status == "closed",
                cost: data.cost,
                fee: data.fee,
                price: data.price,
                txid: txid,
            })
        } else {
            trade.amount = data.vol
            trade.bought_at = data.closetm * 1000
            trade.confirmed = data.status == "closed"
            trade.cost = data.cost
            trade.fee = data.fee
            trade.price = data.price
            trade.txid = txid
        }
        trade.save()
        return trade
    }

    static async lastTrade() {
        const query = `
        SELECT * from buys ORDER BY bought_at DESC LIMIT 1
        `
        let trade = await database.get(query)
        if( trade == null ) {
            const res = await kraken.getTradesHistory(null, null)
            const data = res.data
            if( data.result == null ) {
                return null
            }
            if( data.result.count == null || data.result.count == 0 ) {
                return null
            }
            const trades = data.result.trades
            for( let trade of Object.values(trades) ) {
                const totalCost = (parseFloat(trade.cost) + parseFloat(trade.fee)).toFixed(5)
                let query = `
                INSERT INTO buys
                (bought_at, price, amount, txid, confirmed, total_cost, cost, fee)
                VALUES(?, ?, ?, ?, ?, ?, ?, ?)
                `
                // INSERT INTO buys
                // SET total_cost = ${totalCost},
                    // confirmed = true,
                    // cost = ${trade.cost},
                    // fee = ${kraketrade.fee}
                // WHERE txid = "${kraketrade.ordertxid}"
                await database.get(
                    query,
                    parseInt(trade.time * 1000), // bought_at
                    trade.price, // price
                    trade.vol, // amount
                    trade.ordertxid, // txid
                    true, // confirmed
                    totalCost, // total_cost
                    trade.cost, // cost
                    trade.fee, // fee
                )
            }
            process.exit();
        }
        return trade
    }

    async create() {
        if( this.id != null ) {
            return this.save()
        }
        let query = `
        INSERT INTO buys
        (amount, bought_at, confirmed, cost, fee, price, total_cost, txid)
        VALUES(:amount, :bought_at, :confirmed, :cost, :fee, :price, :total_cost, :txid)
        `
        return await database.get(query, {
            ':amount': this.amount,
            ':bought_at': this.bought_at,
            ':confirmed': this.confirmed,
            ':cost': this.cost,
            ':fee': this.fee,
            ':price': this.price,
            ':total_cost': this.totalCost(),
            ':txid': this.txid,
        })
    }

    async databaseUpdate() {
        if( this.txid == null ) {
            return false
        }
        const query = `
        SELECT * from buys WHERE txid = ?;
        `
        const trade = await database.get(query, this.txid)
        if( trade == null ) {
            return false
        }
        this.id = trade.id
        this.amount = trade.amount
        this.bought_at = trade.bought_at
        this.confirmed = trade.confirmed
        this.cost = trade.cost
        this.fee = trade.fee
        this.price = trade.price
        this.total_cost = trade.total_cost
        this.txid = trade.txid
        return true
    }

    async save() {
        if( this.id == null ) {
            return this.create()
        }
        let query = `
        UPDATE buys
        SET amount = :amount,
            bought_at = :bought_at,
            confirmed = :confirmed,
            cost = :cost,
            fee = :fee,
            price = :price,
            total_cost = :total_cost,
            txid = :txid
        WHERE id = :id
        `
        return await database.get(query, {
            ':amount': this.amount,
            ':bought_at': this.bought_at,
            ':confirmed': this.confirmed,
            ':cost': this.cost,
            ':fee': this.fee,
            ':price': this.price,
            ':total_cost': this.totalCost(),
            ':txid': this.txid,
            ':id': this.id,
        })
    }

    async delete() {
        let query = "DELETE FROM buys WHERE id=?"
        return await database.get(query, this.id)
    }

    totalCost() {
        return (parseFloat(this.cost) + parseFloat(this.fee)).toFixed(5)
    }

    toString() {
        let price = Math.round(this.price * 1000) / 1000
        return `${moment(this.bought_at).format("DD/MM/YYYY HH:ss")}:${this.id}:${this.txid} Price: ${price} ${this.cost} + ${this.fee} = ${this.totalCost()}: ${this.amount}`
    
    }
}

await setup()
