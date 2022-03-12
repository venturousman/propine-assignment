const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse");
const axios = require("axios");

function loadData() {
  const csvFilePath = path.resolve(__dirname, "data/transactions.csv");

  const headers = ["timestamp", "transaction_type", "token", "amount"];

  const fileContent = fs.readFileSync(csvFilePath, { encoding: "utf-8" });

  return new Promise((resolve, reject) => {
    parse(
      fileContent,
      {
        delimiter: ",",
        columns: headers,
        fromLine: 2,
        cast: (columnValue, context) => {
          if (context.column === "timestamp") {
            return parseInt(columnValue, 10);
          }
          if (context.column === "amount") {
            return parseFloat(columnValue);
          }

          return columnValue;
        },
      },
      (error, result) => {
        if (error) {
          console.error(error);
          reject(error);
        }

        // console.log("Result", result);
        resolve(result);
      }
    );
  });
}

async function exchange(token) {
  try {
    const { data } = await axios.get(
      `https://min-api.cryptocompare.com/data/price?fsym=${token}&tsyms=USD`
    );
    // console.log(data);
    return data;
  } catch (error) {
    console.log("exchange error", error);
  }
  return null;
}

async function main() {
  const wallet = {};

  // load transaction data from csv file
  let transactions = await loadData();
  //   console.log("Transactions", transactions);

  // order by timestamp ascending
  transactions = transactions.sort((a, b) => {
    if (a.timestamp < b.timestamp) return -1;
    if (a.timestamp > b.timestamp) return 1;
    return 0;
  });
  //   console.log("Transactions", transactions);

  // add deposits and substract withdrawals
  //   let count = 0;
  transactions.forEach((transaction) => {
    const { timestamp, transaction_type, token, amount } = transaction;
    if (transaction_type === "DEPOSIT") {
      const newAmount = wallet[token] ? wallet[token] + amount : amount;
      wallet[token] = newAmount;
    } else if (transaction_type === "WITHDRAWAL") {
      if (wallet[token]) {
        wallet[token] = wallet[token] - Math.min(amount, wallet[token]);
      }
    }
    // count++;
    // if (count === 10) console.log("Wallet", wallet);
  });

  //   console.log("Wallet", wallet);

  // in USD
  const result = {};
  for (const token in wallet) {
    // console.log(`${token}: ${wallet[token]}`);
    const exchangeData = await exchange(token);
    if (exchangeData) {
      const rate = exchangeData.USD || 1;
      result[token] = rate * wallet[token];
    }
  }

  console.log("Result", result);
}

main();
