const path = require('path');
const fs = require('fs');
const dvalue = require('dvalue');
const Parent = require(path.join(__dirname, '_Bot.js'));
const ecRequest = require('ecrequest');
const firebase = require('firebase');

let db
let logger;
let tokenList = [];
let pairList = [];
let parseAddress;
let nonce;
const FILTER_LIFETIME = 3600 * 1000;

const random = (i, f) => {
	ind = parseInt(i) || 0;
	fix = parseInt(f) || 3
	return (Math.random().toFixed(fix) * Math.pow(10, ind));
};
const randomGrowth = () => {
	return random(0, 4) / 4 * Math.pow(-1, Math.random() > 0.5);
}
const randomTimestamp = () => {
	return new Date().getTime() - Math.ceil(Math.random() * 86400000);
};
const parseHexData = (hex) => {
	return hex.substr(2).match(/[0-9a-f]{64}/g);
};
const hexStringToNumber = (hex) => {
	return parseInt(`0x${ hex }`);
};
const hexStringToAddress = (hex) => {
	return `0x${hex.substr(-40)}`;
};
const hexStringToPrettyString = (hex) => {
	return hex.replace(/\b(0+)/gi,"") == '' ? '0' : hex.replace(/\b(0+)/gi,"");
}
const numberToHexString = (num) => {
	const length = 64;
	let rs = num >= 0 ? num.toString(16) : '0';
	if(rs.length < length) {
		rs = new Array(length - rs.length).fill(0).join('') + rs;
	}
	return rs;
};
const fillZero = (str) => {
	let rs = str;
    if (str.length < 64)
    {
        rs = new Array(64 - str.length).fill(0).join('') + rs;
    }
    return rs;
};
const hexStringRemove0x = str => str.slice(2,str.length);
const removeFrontZero = str => str.replace(/\b(0+)/gi,"");
const getNonce = {
    jsonrpc: '2.0',
    method: 'eth_getTransactionCount',
    id: 7
};
 
const Bot = class extends Parent {
	constructor() {
		super();
		this.name = path.parse(__filename).base.replace(/.js$/, '');
	}
	init(config) {
		return super.init(config).then(v => {
			logger = this.logger;
            db = this.db;
            getNonce.params = [this.config.key.user,"pending"];
			// do something
			return Promise.resolve(v);
		});
	}
	start() {
		return super.start().then(v => {
            return this.sideETHRPC({ body: getNonce })
                .then(({result}) => {
                    nonce = result;
                    return Promise.resolve(v);
                })
		});
	}
	ready() {
		return super.ready().then(v => {
			return this.initialBlockNumber()
				.then(() => this.fetchExchangeLog())
				.catch((e) => {logger.info("initialBlockNumber error: ",e)})
		}).catch(e => console.trace(e));
	}

	apiETHRPC({ body }) {
		return this.ETHRPC({ body }).then((_pure) => {
			const rs = { _pure };
			return Promise.resolve(rs);
		});
    }
    
	mainETHRPC({ body }) {
		const rpc = this.config.main.production ? this.config.main.env.production.main : this.config.main.env.test.main;
		const opt = {
			protocol: rpc.protocol,
			port: rpc.port,
			hostname: rpc.hostname,
			path: '/',
			headers: { 'content-type': 'application/json' },
			data: body
        };
		return ecRequest.post(opt).then((rs) => {
			return Promise.resolve(JSON.parse(rs.data));
		});
    }
    
    sideETHRPC({ body }) {
		const rpc = this.config.main.production ? this.config.main.env.production.side : this.config.main.env.test.side;
		const opt = {
			protocol: rpc.protocol,
			port: rpc.port,
			hostname: rpc.hostname,
			path: '/',
			headers: { 'content-type': 'application/json' },
			data: body
        };
		return ecRequest.post(opt).then((rs) => {
			return Promise.resolve(JSON.parse(rs.data));
		});
	}

	initialBlockNumber() {
		return db.collection('blockNumber').count()
			.then((v) => {
				if(v > 0) {
					return Promise.resolve();
				} else {
					const getBlockNumber = {
						"jsonrpc":"2.0",
						"method":"eth_blockNumber",
						"params":[],
						"id": dvalue.randomID()
					};
					console.log("getBlockNumber", getBlockNumber);
					return this.mainETHRPC({ body: getBlockNumber })
					.then(({ result }) => {
						if(result != undefined){
							return db.collection('blockNumber').insert({ fromBlock: result , decFromBlock: parseInt(result)});
						} else {
							return Promise.reject("get block number undefined");
						}
					})
				}
			}).catch((e) => {throw e})
	}

	fetchExchangeLog() {
		const getBlockNumber = {
			"jsonrpc":"2.0",
			"method":"eth_blockNumber",
			"params":[],
			"id": dvalue.randomID()
		};
		this.mainETHRPC({ body: getBlockNumber })
			.then(({ result }) => {
				if(!result) { return Promise.reject()};

				let toBlock = parseInt(result);
				return db.collection('blockNumber').find({}).sort({ decFromBlock: -1 }).limit(1).toArray()
					.then((v) => {
						let fromBlock = parseInt(v[0].fromBlock)+1;
						let fetchBlock = [];
						while(fromBlock <= toBlock){
							fetchBlock.push(fromBlock);
							if(fromBlock === toBlock){
								db.collection('blockNumber').insert({ fromBlock: `0x${fromBlock.toString(16)}`, decFromBlock: fromBlock}, () => {});
							}
							fromBlock++;
						}
						fetchBlock.push(0);
						return fetchBlock.reduce((prev,curr) => {
							return prev.then(() => {
								if(curr === 0){
									return Promise.reject("scan over");
								}else{
									return this.recursiveCheckBlockLog(`0x${curr.toString(16)}`, 0);
								}	
							})
						},Promise.resolve());
					}) 
					.catch((e) => {throw e})
			})
			.catch((e)=>{
				logger.info("fetchExchangeLog catch: " + e);
				setTimeout(() => {
					this.fetchExchangeLog();
				}, 15000);
			});
	}

	recursiveCheckBlockLog( blockNumber, retryNumber ){
		return this.checkBlockLog(blockNumber)
			.then(() => {
				return Promise.resolve();
			},(err)=>{
				logger.info("retry fetch block:"+blockNumber+" err:"+err);
				return new Promise((resolve, reject)=>{
					setTimeout(() =>{
						if(retryNumber == 5){
							// let maillist = this.config.notifymail.list.reduce((pre, cur) => pre + ";" + cur);
							// super.getBot('Mailer').then(bot => {
							// 	bot.send({ 
							// 			"email": maillist,
							// 			"subject":"fetch block " + blockNumber + " error " + retryNumber + " times",
							// 			"content":"fetch block " + blockNumber + " error " + retryNumber + " times </br> " + 
							// 					  "time: " + new Date() + " (" + new Date().getTime() + ") </br> " + 
							// 					  "env: " + this.config.db.user + " </br> " + 
							// 					  "msg: " + err
							// 		}).catch(e => console.trace(e));
							// })
						}
						this.recursiveCheckBlockLog( blockNumber, ++retryNumber ).then(resolve, reject);
					}, 5000);
				});
			})
	}

	checkBlockLog( blockNumber ){
		logger.info("fetch block:"+blockNumber);
		const getBlockByNumber = {
			"jsonrpc":"2.0",
			"method":"eth_getBlockByNumber",
			"params":[
				blockNumber,true
			],
			"id": 73
		};
		const getTransactionReceipt = {
			jsonrpc: '2.0',
			method: 'eth_getTransactionReceipt',
			params: [],
			id: 7
		};

		return this.mainETHRPC({ body: getBlockByNumber })
			.then(({result}) => {
				if(!result) { return Promise.reject()};
				//logger.info("gate1:",new Date());
				if(result.transactions && result.transactions.length > 0){
					let blockTimestamp = parseInt(result.timestamp)*1000;
					return result.transactions.reduce((prev,curr) => {
						return prev.then(() => {
							if(curr.to != undefined && curr.to == this.config.contract.PublicBank){
								getTransactionReceipt.params[0] = curr.hash;
								return this.mainETHRPC({ body: getTransactionReceipt })
									.then(({ result }) => {
										if(result.logs != undefined && result.logs.length > 0){
											return this.parseEvents({ result: result.logs, blockTimestamp });
										}else{
											return Promise.resolve();
										}
									})
							}else{
								return Promise.resolve();
							}				
						})
					},Promise.resolve());
				} else {
					return Promise.resolve();
				}
			}).catch((e) => {
				return Promise.reject(e);
			});
	}

	parseEvents({ result, blockTimestamp }) {
		if(!result) { return Promise.resolve(); }
		return super.getBot('Interact').then((bot) => {
			let offsetLog;
			return result.reduce((prev, curr) => {
				return prev.then((rs) => {
					let log;
					switch(curr.topics[0]) {
						case '0xb2aad65fdc37d54780e802430dc344d6ff77badc86034e6fc911778c19425fe6':
							log = this.parseDepositePublicChain(curr);
                            log.timestamp = blockTimestamp;
                            log.nonce = nonce;
							logger.info("eDepositePublicChain:"+JSON.stringify(log));
							return bot.depositePublicChain(log);
							break;
					}
				});
			}, Promise.resolve());
		});
	}

	parseDepositePublicChain({ data, logIndex, transactionHash }) {
		const arr = parseHexData(data); //fromToken_, toToken_, price_, user, amount_
		const currToken = tokenList.find((v) => { return v.address == hexStringToAddress(arr[0]); }) || {};
		const currDecimal = currToken.decimal || 18;
		const deposite = {
			no: logIndex+transactionHash,
			user: hexStringToAddress(arr[0]),
			fromToken: hexStringToAddress(arr[1]),
			fromAmount: hexStringToPrettyString(arr[2]),
			timestamp: new Date().getTime()
		};
		return deposite;
	}

};

module.exports = Bot;