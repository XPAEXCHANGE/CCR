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
    mapping(address => address) public agentBooks;
    address public owner;
    address public operator;
    address public robot;
    address public bank;
    bool public powerStatus = true;
    bool public forceOff = false;
    
    constructor ()
        public
    {
        owner = msg.sender;
        operator = msg.sender;
        robot = msg.sender;
        bank = msg.sender;
    }
    
    modifier onlyOwner
    {
        assert(msg.sender == owner);
        _;
    }
    
    modifier onlyOperator
    {
        assert(msg.sender == operator || msg.sender == owner);
        _;
    }

    modifier onlyRobot
    {
        assert(msg.sender == operator || msg.sender == owner || msg.sender == robot);
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
        if(forceOff) {
            powerStatus = false;
        } else {
            powerStatus = onOff_;
        }
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
        operator = user_;
        agentBooks[bank] = user_;
    }
    
    function assignRobot(address user_)
        public
        onlyOperator
    {
        robot = user_;
    }

    function assignBank(address bank_)
        public
        onlyOwner
    {
        bank = bank_;
    }
    
    function assignAgent(
        address agent_
    )
        public
    {
        agentBooks[msg.sender] = agent_;
    }
    
    function isRepresentor(
        address representor_
    )
        public
        view
    returns(bool) {
        return agentBooks[representor_] == msg.sender;
    }
    
    function getUser(
        address representor_
    )
        internal
        view
    returns(address) {
        return isRepresentor(representor_) ? representor_ : msg.sender;
    }
}

contract PublicBank is SafeMath, Authorization {

    struct allowanceTransfer {
        uint256 amount;
        uint256 timestamp;
    }
    
    mapping (address => allowanceTransfer) public allowedAmount;
    address[] public depositeToken;

    address ethaddress = address(1); 

    event wDeposit(address _user, address _token, uint256 _amount);
    event wTransfer(address _user, address _token, uint256 _amount, bytes32 _txhash);
    event wApprove(address _token, address _amount, uint256 _timestamp);

    function deposit (
        address _token
    )
        public 
        onlyActive 
        payable 
    {
        if(msg.value > 0){
            emit wDeposit(msg.sender, ethaddress, msg.value);
        }
        uint256 _amount = Token(_token).allowance(msg.sender, this);
        if(_amount > 0 && Token(_token).transferFrom(msg.sender, this, _amount) ){
            emit wDeposit(msg.sender, _token, _amount);
        }
        bool tokenRepeat = false;
        for(uint256 i = 0; i < depositeToken.length; i++) {
            if(depositeToken[i] == _token){
                tokenRepeat = true;
                break;
            }
        }
        if(!tokenRepeat){
            depositeToken.push(_token);
        }
    }
    
    function getDepositAmount (
        address _token
    )
        public 
        view 
    returns (uint256) {
        return Token(_token).balanceOf(this);
    }

    function transfer (
        address _token, 
        address _user,
        uint256 _amount,
        bytes32 _txhash
    )
        public 
        onlyRobot  
    {
        if(
            getDepositAmount(_token) >= _amount &&
            allowedAmount[_token].amount >= _amount &&
            allowedAmount[_token].timestamp <= block.timestamp &&
            allowedAmount[_token].timestamp != 0
        ) {
            allowedAmount[_token].amount = safeSub(allowedAmount[_token].amount, _amount);
            if(_token == address(1)){
                require(_user.send(_amount));
            } else {
                require(Token(_token).transfer(_user, _amount));
            }
            emit wTransfer(_user, _token, _amount, _txhash);
        }
    }

    function approve (
        address _token, 
        uint256 _amount,
        uint256 _timestamp
    )
        public 
        onlyOperator  
        payable 
    {
        allowedAmount[_token].amount = _amount;
        allowedAmount[_token].timestamp = _timestamp;
    }
}
