const path = require('path');
const fs = require('fs');
const dvalue = require('dvalue');
const firebase = require('firebase');
const bn = require('bn');
const jssha3 = require('js-sha3');
const Parent = require(path.join(__dirname, '_Bot.js'));
const ecRequest = require('ecrequest');
const keythereum = require('keythereum');
const Tx = require('ethereumjs-tx');

let db
let logger;
let fd;
let number = 1;

let orderBooks = [];
let priceBooks = [];
let operatorBooks = [];
let offsetBooks = [];
let fromUser = "0x7c2fca6e95ffbf842b91daa1c77bfb5327f5c85d";
let toUser = "";
let value = "";
let privateKey = "";

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
const hexSafeSub = (x,y) => {
	var x = new bn(x,16);
	var y = new bn(y,16);
	return x.sub(y).toString(16);
}
const hexSafeAdd = (x,y) => {
	var x = new bn(x,16);
	var y = new bn(y,16);
	return x.add(y).toString(16);
}
const hexSafeMule = (x,y) => {
	var x = new bn(x,16);
	var y = new bn(y,16);
	return x.mul(y).toString(16);
}
const hexSafeDiv = (x,y) => {
	var x = new bn(x,16);
	var y = new bn(y,16);
	return x.div(y).toString(16);
}
const hexGte = (x,y) => {
	var x = new bn(x,16);
	var y = new bn(y,16);
	return x.gte(y);
}
const hexGt = (x,y) => {
	var x = new bn(x,16);
	var y = new bn(y,16);
	return x.gt(y);
}
const hexLte = (x,y) => {
	var x = new bn(x,16);
	var y = new bn(y,16);
	return x.lte(y);
}
const hexLt = (x,y) => {
	var x = new bn(x,16);
	var y = new bn(y,16);
	return x.lt(y);
}
const hexEq = (x,y) => {
	var x = new bn(x,16);
	var y = new bn(y,16);
	return x.eq(y);
}
const numberToHexString = (num) => {
	const length = 64;
	let rs = num >= 0 ? num.toString(16) : '0';
	if(rs.length < length) {
		rs = new Array(length - rs.length).fill(0).join('') + rs;
	}
	return rs;
};
const fillzero = (str) => {
	let rs = str;
    if (str.length < 64)
    {
        rs = new Array(64 - str.length).fill(0).join('') + rs;
    }
    return rs;
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
            fd = this.fbase.fd;
			// do something
			return Promise.resolve(v);
		});
	}
	start() {
		return super.start().then(v => {
			// do something
			return Promise.resolve(v);
		});
	}
	ready() {
		return super.ready().then(v => {
			// do something
			return Promise.resolve(v);
		});
    }
    
    ETHRPC({ body }) {
		const rpc = this.config.main.production ? this.config.main.env.production.side : this.config.main.env.test.side;
		const opt = {
			protocol: rpc.protocol,
			port: rpc.port,
			hostname: rpc.hostname,
			path: '/',
			headers: { 'content-type': 'application/json' },
			data: body
        };
        console.log(body);
		return ecRequest.post(opt).then((rs) => {
            console.log(JSON.parse(rs.data));
			return Promise.resolve(JSON.parse(rs.data));
		});
    }
    
	depositePublicChain({ no, user, fromToken, fromAmount, timestamp, nonce }) {
		return db.collection('depositeBooks').insert({ no, user, fromToken, fromAmount, timestamp, nonce })
			.then(() => {
				return db.collection('operatorBooks').insert({ no, user, fromToken, fromAmount, timestamp, nonce, type: "deposite" });
			})
			.then(() => {
				return fd.ref("depositeBooks").once("value");
			})
			.then((snap) => {
				let snaplength = snap.val() ? snap.val().length : 0;
				return fd.ref().child("depositeBooks/"+snaplength).set({ no, user, fromToken, fromAmount, timestamp, nonce });
			})
			.then(()=>{
				return Promise.resolve(fd.ref("operatorBooks").once("value"));
			})
			.then((v) => {
				let oplength = v.val() ? v.val().length : 0;
				return fd.ref().child("operatorBooks/"+oplength).set({ no, user, fromToken, fromAmount, timestamp, nonce, type: "deposite" });
            })
            .then((v) => {
                return this.issueConsumption({ user, fromToken, fromAmount, nonce });
            })
			.catch((err) => {
				logger.info("depositePublicChain err:" + err.message + " txhash:" + no);
				throw err;
			});
	}

    issueConsumption({ user, fromToken, fromAmount, nonce }){
        
        let fromTokenObj = this.config.contract.MainBasicToken.find(function(element) {
            return element.address == fromToken;
        })
        let issueTokenObj = this.config.contract.SideBasicToken.find(function(element) {
            return element.token == fromTokenObj.token;
        })

        const getGasPrice = {
            jsonrpc: '2.0',
            method: 'eth_gasPrice',
            params: [],
            id: 7
        };

        let nuser = user.substr(2,user.length);
        const getEstimateGas = {
            "jsonrpc":"2.0",
            "method":"eth_estimateGas",
            "params":[{
                "from":this.config.key.user,
                "to":issueTokenObj.address,
                "value":"0x0",
                "data":"0x"+jssha3.keccak256('issue(address,uint256)').substr(0, 8)+fillzero(user.substr(2,user.length))+fillzero(fromAmount)
            }],
            "id": 7
        };
        const sendRawTransaction = {
            "jsonrpc":"2.0",
            "method":"eth_sendRawTransaction",
            "params":[],
            "id": 7
        };

        //let nonce = "",
        let gasPrice = "",
            estimateGas = "";
        return this.ETHRPC({ body: getGasPrice })
        .then(({result}) => {
            gasPrice = result;
            return this.ETHRPC({ body: getEstimateGas })
        }).then(({ result }) => {
            estimateGas = result;
            if(privateKey == ""){
                privateKey = keythereum.recover(this.config.key.pwd, this.config.key.keystore);
            }
            var rawTx = {
                nonce: nonce,//由eth_getTransactionCount获取。参数为交易发送方地址
                to: issueTokenObj.address,
                gasPrice: gasPrice,
                gasLimit: estimateGas,
                value: "0x0", 
                data: "0x"+jssha3.keccak256('issue(address,uint256)').substr(0, 8)+fillzero(user.substr(2,user.length))+fillzero(fromAmount)
            }
            var tx = new Tx(rawTx);
            tx.sign(privateKey);
            var serializedTx = tx.serialize();
            var rawparam = serializedTx.toString('hex');
            sendRawTransaction.params[0] = "0x"+rawparam;
            console.log(sendRawTransaction);
            return this.ETHRPC({ body: sendRawTransaction });
        }).then(({ result }) => {
            console.log(result);
            return Promise.resolve();
        }).catch((err) => {
            console.log('fail', err);
        });
    
    }
};

module.exports = Bot;