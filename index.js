import express from 'express';
import axios from 'axios';
import bodyParser from 'body-parser'

const app = express();
const port = 3000;

app.use(express.json());
app.use(bodyParser.json());

const getOrderbook = async (base_currency, quote_currency) => {
    let orderbook;

    try {
        orderbook = await axios.get('https://ftx.com/api/markets/'+ base_currency + '/' + quote_currency + '/orderbook?depth=100');
    } catch {
        try {
            orderbook = await axios.get('https://ftx.com/api/markets/'+ quote_currency + '/' + base_currency + '/orderbook?depth=100');

            const bids = orderbook.data.result.bids.map(([ price, amount]) => [ 1/price, 1/amount]);
            const asks = orderbook.data.result.asks.map(([ price, amount]) => [ 1/price, 1/amount]);
            orderbook.data.result.bids = asks;
            orderbook.data.result.asks = bids;

        } catch {
            throw new Error('No such market ' + base_currency + '/' + quote_currency);
        }
    }
        
    return orderbook;
}

const getResult = (amount, quote_currency, operations) => {
    const amountNumber = parseFloat(amount);
    let left = amountNumber;
    let total = 0;
    for (const [price , size] of operations) {
        if (left > size) {
            total += price * size;
            left -= size;
        } else {
            total += price * left;
            left = 0;
            break;
        }
    }

    if (left != 0) {
        throw new Error('Amount is too much')
    } 
    
    return {
        total: total.toString(),
        price: (total / amountNumber).toString(),
        currency: quote_currency
    }
}

app.post('/quote', async (req, res) => {
    try {
        const { action, base_currency, quote_currency, amount } = req.body;
        
        if (action != 'buy' && action != 'sell') {
            throw new Error('Please specify action as buy or sell');
        }

        if (!base_currency || !quote_currency) {
            throw new Error('Missing currency');
        }

        if (!amount) {
            throw new Error('Specify amount');
        }

        const orderbook = await getOrderbook(base_currency, quote_currency);

        if (action == 'buy') {
            const result = getResult(amount, quote_currency, orderbook.data.result.asks);
            res.send(JSON.stringify(result));
        } else if (action == 'sell') {
            const result = getResult(amount, quote_currency, orderbook.data.result.bids);
            res.send(JSON.stringify(result));
        }
        
    } catch (error){
        res.send(JSON.stringify(error.message))
    }
});


app.listen(port, () => {
  console.log(`FTX orderbook app listening at http://localhost:${port}`);
});
