pragma solidity ^0.4.24;

interface Token {
    function totalSupply() constant external returns (uint256 ts);
    function balanceOf(address _owner) constant external returns (uint256 balance);
    function transfer(address _to, uint256 _value) external returns (bool success);
    function transferFrom(address _from, address _to, uint256 _value) external returns (bool success);
    function approve(address _spender, uint256 _value) external returns (bool success);
    function allowance(address _owner, address _spender) constant external returns (uint256 remaining);
    
    event Transfer(address indexed _from, address indexed _to, uint256 _value);
    event Approval(address indexed _owner, address indexed _spender, uint256 _value);
}

interface transferRecipient {
    function receiveTransfer(address _from, uint256 _value, bytes _extraData) external;
}

contract SafeMath {
    function safeAdd(uint x, uint y)
        internal
        pure
    returns(uint) {
        uint256 z = x + y;
        require((z >= x) && (z >= y));
        return z;
    }

    function safeSub(uint x, uint y)
        internal
        pure
    returns(uint) {
        require(x >= y);
        uint256 z = x - y;
        return z;
    }

    function safeMul(uint x, uint y)
        internal
        pure
    returns(uint) {
        uint z = x * y;
        require((x == 0) || (z / x == y));
        return z;
    }
    
    function safeDiv(uint x, uint y)
        internal
        pure
    returns(uint) {
        require(y > 0);
        return x / y;
    }

    function random(uint N, uint salt)
        internal
        view
    returns(uint) {
        bytes32 hash = keccak256(abi.encodePacked(block.number, msg.sender, salt));
        return uint(hash) % N;
    }
}

contract Authorization {
    mapping(address => bool) internal authbook;
    address[] public operators;
    address public owner;
    bool public powerStatus = true;

    constructor ()
        public
        payable
    {
        owner = msg.sender;
        assignOperator(msg.sender);
    }
    modifier onlyOwner
    {
        assert(msg.sender == owner);
        _;
    }
    modifier onlyOperator
    {
        assert(checkOperator(msg.sender));
        _;
    }
    
    modifier onlyActive
    {
        assert(powerStatus);
        _;
    }
    function powerSwitch(
        bool onOff_
    )
        public
        onlyOperator
    {
        powerStatus = onOff_;
    }
    function transferOwnership(address newOwner_)
        onlyOwner
        public
    {
        owner = newOwner_;
    }
    
    function assignOperator(address user_)
        public
        onlyOwner
    {
        if(user_ != address(0) && !authbook[user_]) {
            authbook[user_] = true;
            operators.push(user_);
        }
    }
    
    function dismissOperator(address user_)
        public
        onlyOwner
    {
        delete authbook[user_];
        for(uint i = 0; i < operators.length; i++) {
            if(operators[i] == user_) {
                operators[i] = operators[operators.length - 1];
                operators.length -= 1;
            }
        }
    }

    function checkOperator(address user_)
        public
        view
    returns(bool) {
        return authbook[user_];
    }
}

contract StandardToken is SafeMath, Authorization {
    mapping(address => uint256) balances;
    mapping(address => mapping (address => uint256)) allowed;
    uint256 public totalSupply;
    string public symbol = "";
    string public name = "";

    event Transfer(address indexed _from, address indexed _to, uint256 _value);
    event Approval(address indexed _owner, address indexed _spender, uint256 _value);
    event Issue(address indexed _to, uint256 indexed _value);
    event Burn(address indexed _from, uint256 indexed _value);

    constructor (
        string _symbol,
        string _name
    ) public payable {
        symbol = _symbol;
        name = _name;
    }

    /* Send coins */
    function transfer(
        address to_,
        uint256 amount_
    )
        public
    returns(bool success) {
        if(balances[msg.sender] >= amount_ && amount_ > 0) {
            balances[msg.sender] = safeSub(balances[msg.sender], amount_);
            balances[to_] = safeAdd(balances[to_], amount_);
            emit Transfer(msg.sender, to_, amount_);
            return true;
        } else {
            return false;
        }
    }

    /* A contract attempts to get the coins */
    function transferFrom(
        address from_,
        address to_,
        uint256 amount_
    ) public returns(bool success) {
        if(balances[from_] >= amount_ && allowed[from_][msg.sender] >= amount_ && amount_ > 0) {
            balances[to_] = safeAdd(balances[to_], amount_);
            balances[from_] = safeSub(balances[from_], amount_);
            allowed[from_][msg.sender] = safeSub(allowed[from_][msg.sender], amount_);
            emit Transfer(from_, to_, amount_);
            return true;
        } else {
            return false;
        }
    }

    function balanceOf(
        address _owner
    )
        constant
        public
    returns (uint256 balance) {
        return balances[_owner];
    }

    /* Allow another contract to spend some tokens in your behalf */
    function approve(
        address _spender,
        uint256 _value
    )
        public
    returns (bool success) {
        assert((_value == 0) || (allowed[msg.sender][_spender] == 0));
        allowed[msg.sender][_spender] = _value;
        emit Approval(msg.sender, _spender, _value);
        return true;
    }

    /* Send coins and call receiveTransfer*/
    function transferAndCall(address _to, uint256 _value, bytes _extraData) public returns (bool success) {
        if(transfer(_to,  _value)) {
            transferRecipient(_to).receiveTransfer(msg.sender, _value, _extraData);
            return true;
        }
    }

    function allowance(address _owner, address _spender) constant public returns (uint256 remaining) {
        return allowed[_owner][_spender];
    }

    function getSymbol(
    )
        public
        view
    returns(bytes32) {
        return keccak256(abi.encodePacked(symbol));
    }

    function issue(
        address user_,
        uint256 amount_
    )
        public 
        onlyOperator 
    returns(bool success) {
        if(amount_ > 0 && user_ != address(0)) {
            totalSupply = safeAdd(totalSupply, amount_);
            balances[user_] = safeAdd(balances[user_], amount_);
            emit Issue(user_, amount_);
            emit Transfer(this, user_, amount_);
            return true;
        }
    }

    function burn(
        uint256 amount_
    )
        public 
    returns(bool success) {
        if(amount_ > 0 && balances[msg.sender] >= amount_) {
            balances[msg.sender] = safeSub(balances[msg.sender], amount_);
            totalSupply = safeSub(totalSupply, amount_);
            emit Burn(msg.sender, amount_);
            emit Transfer(msg.sender, this, amount_);
            return true;
        }
    }
}

contract PrivateBank is Authorization {

    enum tokenType {asset, consumption}
    address[] public tokenlist;
    mapping(address => bool) public assetbook;
    mapping(address => bool) public consumptionbook;

    event IssueAssetToConsumption(address _from, address _to, address _user);
    event TransferConsumptionToAsset(address _from, address _to, address _user, bytes32 _detail);

    function createToken (
        string _symbol,
        string _name,
        tokenType _type
    )
        public 
        onlyOperator 
    returns(address) {
        bool tokenRepeat = false;
        address newToken;
        for(uint256 i = 0; i < tokenlist.length; i++) {
            if(StandardToken(tokenlist[i]).getSymbol() == keccak256(abi.encodePacked(_symbol))){
                tokenRepeat = true;
                newToken = tokenlist[i];
                break;
            }
        }
        if(!tokenRepeat){
            newToken = new StandardToken(_symbol, _name);
            StandardToken(newToken).assignOperator(msg.sender);
            tokenlist.push(newToken);
            if(uint(tokenType.asset) == uint(_type)) {
                assetbook[newToken] = true;
            } else {
                consumptionbook[newToken] = true;
            }
        }
        return newToken;
    }

    function assignTokenOperator(address _user)
        public 
        onlyOperator 
    {
        if(_user != address(0)) {
            for(uint256 i = 0; i < tokenlist.length; i++) {
                StandardToken(tokenlist[i]).assignOperator(_user);
            }
        }
    }
    
    function dismissTokenOperator(address _user)
        public 
        onlyOperator 
    {
        if(_user != address(0)) {
            for(uint256 i = 0; i < tokenlist.length; i++) {
                StandardToken(tokenlist[i]).dismissOperator(_user);
            }
        }
    }

    function issueAssetToConsumption(
        address _from,
        address _to,
        address _user
    )
        public
    {
        assert(consumptionbook[_from]);
        assert(assetbook[_to]);
        uint256 _amount = StandardToken(_from).allowance(msg.sender, this);
        if(StandardToken(_from).transferFrom(msg.sender, this, _amount)){
            IssueAssetToConsumption(_from, _to, _user);
            StandardToken(_to).issue(_user, _amount);
        }
    }

    function transferConsumptionToAsset(
        address _from,
        address _to,
        address _user,
        bytes32 _detail
    )
        public
    {
        
        assert(assetbook[_from]);
        assert(consumptionbook[_to]);
        uint256 _amount = StandardToken(_from).allowance(msg.sender, this);
        assert(StandardToken(_to).balanceOf(this) >= _amount);
        if(StandardToken(_from).transferFrom(msg.sender, this, _amount)){
            TransferConsumptionToAsset(_from, _to, _user, _detail);
            StandardToken(_to).transfer(_user, _amount);
        }
    }
}
