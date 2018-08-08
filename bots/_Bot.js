var Bots = [];

var Bot = class {
	constructor() {
		Bots.push(this);
	}
	init({config, db, logger, i18n, fbase}) {
		this.config = config;
		this.db = db;
		this.logger = logger;
		this.i18n = i18n;
		this.fbase = fbase;
		return Promise.resolve(this);
	}
	start() {
		return Promise.resolve(this);
	}
	ready() {
		return Promise.resolve(this);
	}
	getBot(name) {
		var condition = new RegExp('^' + name + '$', 'i');
		var bot = Bots.find(function (b) { return condition.test(b.name) });
		return Promise.resolve(bot);
	}
};

module.exports = Bot;