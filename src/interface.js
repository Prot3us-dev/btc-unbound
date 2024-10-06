import blessed from 'blessed'
import contrib from 'blessed-contrib'
import moment from 'moment';

// var screen = blessed.screen()
//     , line = contrib.line(
//         { style:
//             { line: "yellow"
//                 , text: "green"
//                 , baseline: "black"}
//             , xLabelPadding: 3
//             , xPadding: 5
//             , label: 'Title'})
//     , data = {
//         x: ['t1', 't2', 't3', 't4'],
//         y: [5, 1, 7, 5]
//     }
// screen.append(line) //must append before setting data
// line.setData([data])

class Interface {
    constructor() {
        this.balanceBoxConfig = {
            top: 'center',
            width: 60,
            height: 8,
            tags: true,
            border: {
                type: 'line',
            },
            style: {
                fg: 'white',
                bg: 'black',
                border: {
                    fg: '#f0f0f0',
                    bg: 'black',
                },
            },
            hover: {
                bg: 'green',
            },
            content: '',
        }
        this.statusBoxConfig = {
            ...this.balanceBoxConfig,
            top: 'top',
            left: 33,
            width: '100%-18',
            height: 4,
        }
        this.screen = blessed.screen({
            dockBorders: true,
            //autoPadding: true,
        })
        this.statusBox = blessed.text(this.statusBoxConfig)
        this.screen.append(this.statusBox);
        this.nextBuyGauge = contrib.gauge({
            label: 'Progress',
            stroke: 'green',
            fill: 'red',
            bottom: 0,
            left: 'left',
            width: "100%",
            height: 7,
            xPadding: 0,
            yPadding: 0,
            xLabelPadding: 0,
            yLabelPadding: 0,
            border: {
                type: 'line',
            },
            style: {
                fg: 'white',
                bg: 'black',
                border: {
                    fg: '#f0f0f0',
                    bg: 'black',
                },
            },
        })
        this.screen.append(this.nextBuyGauge)
        this.nextBuyGauge.setPercent(50)
    }

    renderStatus(content) {
        this.statusBox.setContent(content)
        // this.screen.render()
    }

    renderBalanceBox() {
        let content = this.apiCounter
        if( this.lastBuy ) {
            content += `\n${this.lastBuy}`
        }
        if( this.buyAtContent ) {
            content += `\n${this.buyAtContent}`
        }
        if( this.price ) {
            content += `\n${this.price}`
        }
        const lines = content.split(/\r\n|\r|\n/).length
        const height = lines + 2
        if( this.balanceBox == null || this.balanceBox.height != height ) {
            this.createBalanceBox(height)
        }
        this.balanceBox.setContent(content)
        // this.screen.render()
    }

    addAPICounter(counter) {
        this.apiCounter = `API Counter: ${counter}`
        this.renderBalanceBox()
    }

    addBuyAt(buyAt) {
        this.buyAtContent = `Buy `
        this.buyAtContent += `${buyAt.fromNow()}{\|}${buyAt.format("DD/MM/YY HH:mm")}`
        this.renderBalanceBox()
        if( this.lastBuyAt != null ) {
            let now = moment().valueOf() - this.lastBuyAt
            let limit = buyAt.valueOf() - this.lastBuyAt
            let percent = (now / limit) * 100
            this.nextBuyGauge.setPercent(percent)
            this.renderStatus(percent.toString())
        }
    }

    addLastBuy(bought) {
        this.lastBuyAt = bought.bought_at
        this.lastBuy = bought
        this.lastBuy = 'Bought '
        this.lastBuy += `${moment(bought.bought_at).fromNow()}: `
        this.lastBuy += `{\|}{bold}${bought.amount}{\/} BTC @ `
        this.lastBuy += `{bold}${Math.round(bought.total_cost / bought.amount,2)}{\/} `
        this.lastBuy += `EUR`
        this.renderBalanceBox()
    }

    addPrice(price) {
        if( this.priceBox == null ) {
            this.priceBox = this.addTextBox({
                width: 18,
                height: 5,
                top: 'top',
                right: '0',
                label: {
                    text: "{black-bg}{#ffaa00-fg}BTC Price{/}",
                },
            })
        }
        let priceTxt = `Buy:{\|}${parseFloat(price.a[0]).toFixed(2)}`
        priceTxt +=  `\nLast:{\|}{bold}${parseFloat(price.c[0]).toFixed(2)}{\/}`
        priceTxt +=  `\nSell:{\|}${parseFloat(price.b[0]).toFixed(2)}`
        this.priceBox.setContent(priceTxt)
        // this.screen.render()
    }

    addTrade(trade) {
        if( this.tradeBox == null ) {
            this.tradeBox = contrib.log({
                ...this.balanceBoxConfig,
                width: '100%-17',
                height: 20,
                top: 3,
                right: 17,
                label: {
                    text: "{black-bg}{#ffaa00-fg}Trades:{/}",
                },
            })
            this.screen.append(this.tradeBox)
        }
        this.tradeBox.log(trade.toString())
        // this.screen.render()
    }

    addWalletFunds(walletFunds) {
        const boxConfig = {
            width: 12,
            height: 3,
            top: 'top',
            left: '0',
            align: 'center',
            label: "{black-bg}{#ffaa00-fg}BTC{/}",
        }
        if( this.walletBtcBox == null ) {
            this.walletBtcBox = this.addTextBox(boxConfig)
        }
        if( this.walletEurBox == null ) {
            this.walletEurBox = this.addTextBox({
                ...boxConfig,
                left: 11,
                label: "{black-bg}{#ffaa00-fg}SATS{/}",
            })
        }
        if( this.walletSatBox == null ) {
            this.walletSatBox = this.addTextBox({
                ...boxConfig,
                left: 22,
                label: "{black-bg}{#ffaa00-fg}EUR{/}",
            })
        }
        let sats = (walletFunds.XXBT * 100000000).toString()
        sats = sats.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        const btc = parseFloat(walletFunds.XXBT).toFixed(8)
        this.walletBtcBox.setContent(
            `{bold}${btc}{\/}\n`
        )
        this.walletEurBox.setContent(
            `{bold}${sats}{\/}\n`
        )
        this.walletSatBox.setContent(
            `{bold}${walletFunds.ZEUR}{\/}\n`
        )
        // this.screen.render()
    }

    addTextBox(config, replace = null) {
        let textBox = blessed.text({
            ...this.balanceBoxConfig,
            ...config,
        })
        if( replace != null ) {
            replace.detach()
        }
        this.screen.append(textBox)
        return textBox
    }

    createBalanceBox(lines) {
        if( this.balanceBox != null ) {
            this.balanceBox.detach()
        }
        this.balanceBox = blessed.text({
            ...this.balanceBoxConfig,
            left: 'center',
            height: lines,
        })
        this.screen.append(this.balanceBox);
    }

}

const iterface = new Interface("ok")
export default iterface

// var log = contrib.log({
//     fg: "white",
//     label: 'Server Log',
//     height: "20%",
//     tags: true,
//     border: {type: "line", fg: "cyan"}
// })
// screen.append(log)
// 
// var table = contrib.table({
//     keys: true,
//     fg: 'white',
//     selectedFg: 'white',
//     selectedBg: 'blue',
//     interactive: true,
//     label: 'Active Processes',
//     width: '100%',
//     height: '30%',
//     border: {type: "line", fg: "cyan"},
//     columnSpacing: 10,//in chars
//     columnWidth: [16, 12, 12] /*in chars*/
// })
// //allow control the table with the keyboard
// table.focus()
// let tableHeaders = ['col1', 'col2', 'col3']
// table.setData({
//     headers: tableHeaders,
//     data: [ [1, 2, 3], [4, 5, 6] ]
// })
// screen.append(table)
// 
// setInterval(function() {
//   log.log(new Date().toISOString() + " \x1B[1mBold\x1B[0m, \x1B[3mItalic\x1B[0m, \x1B[4mUnderline\x1B[0m, \x1B[9mStrikethrough\x1B[0m, \x1B[31mRed font\x1B[0m")}, 500)
// 
// let i = 1;
// setInterval(function() {
//     table.setData({
//         headers: tableHeaders,
//         data: [[i, i+1, i+2], [i+10, i+20, i+30]],
//     })
//     i++
// }, 1000)
// 
// screen.key(['escape', 'q', 'C-c'], function(ch, key) {
//     return process.exit(0);
// });
// 
// screen.render()
