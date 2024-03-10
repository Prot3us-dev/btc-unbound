import sqlite3 from "sqlite3"
import { open } from "sqlite"

const DB_PATH = "./data.db"

var db = null

const migrations = [
    // 0
    `
    create table migrations (
        id integer primary key not null,
        migration_index integer not null
    );
    `,
    // 1
    `
    create table buys (
        id integer primary key not null,
        bought_at integer not null,
        price decimal(10,5) not null,
        amount decimal(10,5) not null
    );
    `,
    // 2
    `
    alter table buys
    ADD txid VARCHAR(50);
    `,
]

export async function openDB() {
    if( db != null ) {
        await migrate()
        return db
    }
    db = await open ({
        filename: DB_PATH,
        driver: sqlite3.Database
    })
    return openDB()
}

await openDB()

// let db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE, (err) => {
//     if( err && err.code == "SQLITE_CANTOPEN" ) {
//         createDatabase()
//         return
//     } else if( err ) {
//         console.log(err)
//         exit(1)
//     }
// })

function createDatabase() {
    var newdb = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
            console.log("Getting error " + err);
            exit(1);
        }
        createTables(newdb);
    });
}

function createTables(newdb) {
    console.log('CREATING DATABASE TABLES')
    newdb.exec(`
        create table ticker (
            id integer primary key not null,
            ask_price decimal(10,5) not null,
            ask_whole_lot_volume integer not null,
            ask_lot_volume decimal(5,3) not null,
            bid_price decimal(10,5) not null,
            bid_whole_lot_volume integer not null,
            bid_lot_volume decimal(5,3) not null,
            close_price decimal(10,5) not null,
            close_lot_volume decimal(5,8) not null,
            volume_value_today decimal(8,8) not null,
            volume_value_last_24 decimal(8,8) not null,
            volume_weighted_avg_value_today decimal(8,8) not null,
            volume_weighted_avg_value_last_24 decimal(8,8) not null,
            trades_today integer not null,
            trades_last_24 integer not null,
            high_price_today decimal(10,5) not null,
            high_price_last_24 decimal(10,5) not null,
            open_price_today decimal(10,5) not null,
            open_price_last_24 decimal(10,5) not null,
            timestamp integer not null
        );
    `);
}

export async function migrate() {
    console.log('MIGRATIONS')
    const migration_query = `SELECT * FROM sqlite_schema WHERE type='table' AND name='migrations'`
    const result = await db.get(migration_query)
    let migrationIndex = 0
    if( result != null ) {
        let  lastMigrationQuery = `SELECT * FROM migrations ORDER BY id DESC LIMIT 1`
        let lastMigration = await db.get(lastMigrationQuery)
        migrationIndex = lastMigration.migration_index + 1
    }
    for(let i = migrationIndex; i < migrations.length; i++) {
        let query = migrations[i]
        console.log(`MIGRATING ${i}: ${query}`)
        await db.run(query)
        let insertMigration = `INSERT INTO migrations (migration_index) VALUES (?)`
        await db.run(insertMigration, i)
    }
}

export async function addTick(tick) {
    const stmt = await db.prepare(
        `
        INSERT INTO ticker (
            ask_price,
            ask_whole_lot_volume,
            ask_lot_volume,
            bid_price,
            bid_whole_lot_volume,
            bid_lot_volume,
            close_price,
            close_lot_volume,
            volume_value_today,
            volume_value_last_24,
            volume_weighted_avg_value_today,
            volume_weighted_avg_value_last_24,
            trades_today,
            trades_last_24,
            high_price_today,
            high_price_last_24,
            open_price_today,
            open_price_last_24,
            timestamp
        ) 
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?);
        `
    )
    stmt.run(
        tick.a[0],
        tick.a[1],
        tick.a[2],
        tick.b[0],
        tick.b[1],
        tick.b[2],
        tick.c[0],
        tick.c[1],
        tick.v[0],
        tick.v[1],
        tick.p[0],
        tick.p[1],
        tick.t[0],
        tick.t[1],
        tick.h[0],
        tick.h[1],
        tick.o[0],
        tick.o[1],
        Date.now()
    )
    stmt.finalize()
}

export async function lastTick() {
    return await db.get('SELECT * from ticker ORDER BY id DESC LIMIT 1')
}

export async function lastBuy() {
    return await db.get('SELECT * from buys ORDER BY id DESC LIMIT 1')
}

export async function clearBuys() {
    return await db.run('DELETE FROM buys WHERE true')
}

export async function addBuy(price, amount, txid) {
    //let buy = {id: 1, bought_at: Date.now(), price: 50000.00000, amount: 0.0001}
    return await db.get('INSERT INTO buys (bought_at, price, amount, txid) VALUES(?,?,?,?)', Date.now(), price, amount,txid)
}

export function close() {
    db.close()
}

