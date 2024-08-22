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
            left: 'center',
            width: 45,
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
            left: 'left',
            width: '100%',
            height: 3,
        }
        this.screen = blessed.screen()
        this.statusBox = blessed.text(this.statusBoxConfig)
        this.screen.append(this.statusBox);
    }

    renderStatus(content) {
        this.statusBox.setContent(content)
        this.screen.render()
    }

    renderBalanceBox() {
        let content = this.apiCounter
        if( this.walletFunds ) {
            content += `\n${this.walletFunds}`
        }
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
        this.screen.render()
    }

    addAPICounter(counter) {
        this.apiCounter = `API Counter: ${counter}`
        this.renderBalanceBox()
    }

    addBuyAt(buyAt) {
        this.buyAtContent = `Buy `
        this.buyAtContent += `${buyAt.fromNow()}{\|}${buyAt.format("DD/MM/YY HH:mm")}`
        this.renderBalanceBox()
    }

    addLastBuy(bought) {
        this.lastBuy = bought
        this.lastBuy = 'Bought '
        this.lastBuy += `${moment(bought.bought_at).fromNow()}: `
        this.lastBuy += `{bold}${bought.amount}{\/} BTC @ `
        this.lastBuy += `{bold}${Math.round(bought.total_cost / bought.amount,2)}{\/} `
        this.lastBuy += `EUR`
        this.renderBalanceBox()
    }

    addPrice(price) {
        this.price =    `Bitcoin buy price:{\|}${price.a[0]}`
        this.price += `\nLast Bitcoin price:{\|}{bold}${price.c[0]}{\/}`
        this.price += `\nBitcoin sell price:{\|}${price.b[0]}`
        this.renderStatus(JSON.stringify(Object.keys(price)))
        this.renderBalanceBox()
    }

    addWalletFunds(walletFunds) {
        this.walletFunds = `BTC: {bold}${walletFunds.XXBT}{\/}`
        this.walletFunds += `\nEUR: {bold}${walletFunds.ZEUR}{\/}`
        this.renderBalanceBox()
    }

    createBalanceBox(lines) {
        if( this.balanceBox != null ) {
            this.balanceBox.detach()
        }
        this.balanceBox = blessed.text({
            ...this.balanceBoxConfig,
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
