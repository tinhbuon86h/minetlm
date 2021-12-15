class bot{

  constructor() {
    this.isBotRunning = false;
    this.alertCaptcha = false;
    // this.checkCpuPercent = 90;
    // this.timerDelay = 810000;
    // this.timerDelayCpu = 180000;
    this.checkMinedelay = false;
    this.firstMine = true;
    this.previousMineDone = false;
    // this.lineBypassUrl = 'https://notify-gateway.vercel.app/api/notify';
    // this.serverGetNonce = 'alien';
    this.interval;
    this.autoClaimnfts;
    this.waitMine;
    this.checkInvalid;
    this.claims = new claims();
    this.checkExpire = true;
    this.restIndex = 0;
    this.cpuFailCount = 0;
    this.cpuFailSum = 0;
    this.tranwax = true;
}

delay = (millis) =>
  new Promise((resolve, reject) => {
    setTimeout((_) => resolve(), millis);
  });

isEmptyObject(obj) {
  return Object.keys(obj).length === 0 && obj.constructor === Object;
}

async postData(url = '', data = {}, method = 'POST',header = {'Content-Type': 'application/json'},returnMode = 'json') {
  try {
    // Object.assign(header,{'pragma':'no-cache' ,'cache-control':'no-cache'})
    const init = (method == 'POST') ? {method: method,mode: 'cors', cache: 'no-cache',credentials: 'same-origin',headers: header,redirect: 'follow',referrerPolicy: 'no-referrer',body: JSON.stringify(data)} : {method: method,mode: 'cors', cache: 'no-cache',credentials: 'same-origin',headers: header,redirect: 'follow',referrerPolicy: 'no-referrer'}
    if(returnMode == 'json'){
      const response = await fetch(url, init);
      return response.json(); // parses JSON response into native JavaScript objects
    }else{
      const response = await fetch(url, init).then(function(response) {
          if(response.ok)
          {
            return response.text(); 
          }
    
          throw new Error('Something went wrong.');
      })  
      .then(function(text) {
        console.log('Request successful', text);
        return text;
      })  
      .catch(function(error) {
        console.log('Request failed', error);
        return '';
      });

      return response
    }
  }catch (err) {
    this.appendMessage(`Error:${err.message}`)
    return false;
  }
}

async checkCPU (){
  let result = true
  let i = 0;
  let accountDetail = {}
  while(result){
    accountDetail = await this.postData(waxDomain[this.getRandomInt(0, 5)]+'/v1/chain/get_account', { account_name: wax.userAccount }) //https://api.waxsweden.org
    if(accountDetail){
      if(accountDetail.core_liquid_balance){
        const balanceWax = parseFloat(accountDetail.core_liquid_balance)
        const amountStake = parseFloat(document.getElementById("amount-stake").value)
        document.getElementById("text-balance-wax").innerHTML = balanceWax.toFixed(4) + " WAX"
        if(balanceWax > amountStake && document.getElementById("auto-stake").checked == true){      
          await this.autoStake(amountStake) 
        }else if(amountStake == 999 && document.getElementById("auto-stake").checked == true && balanceWax > 1){
          await this.autoStake(balanceWax)
        }

        if(document.getElementById("auto-transfer").checked == true && balanceWax > 0){
          const transferTo = document.getElementById("transfer-account").value;
          const transferMemo = document.getElementById("transfer-memo").value;
          if(transferTo){
            const resultTransfer = await this.claims.transfer(wax.userAccount, balanceWax, transferTo, transferMemo)
            if(resultTransfer.processed == false){
              this.appendMessage(resultTransfer.message)
            }else{
              this.appendMessage(resultTransfer.message, '2')
              this.tranwax = false;
            }
          }
        }    
      }
      i ++;
      const rawPercent = ((accountDetail.cpu_limit.used/accountDetail.cpu_limit.max)*100).toFixed(2)
      console.log(`%c[Bot] rawPercent : ${rawPercent}%`, 'color:green')
      const ms = accountDetail.cpu_limit.max - accountDetail.cpu_limit.used;
      this.appendMessage(`CPU ${rawPercent}% : ${ms} ms`)
      if(rawPercent < parseInt(document.getElementById("cpu").value)){
        result = false;
      }else if(i > 60){
        //count fail
        await this.countFailCpu('count'); 
        result = false;
        this.appendMessage(`Check CPU ${i} times --> mine`)    
      }  
    }
    
    if(result && accountDetail){
      // const randomTimer = Math.floor(Math.random() * 30001)
      const timerDelayCpu = (parseFloat(document.getElementById("cpu-timer").value) * 60) * 1000
      this.appendMessage(`CPU delay check ${Math.ceil(timerDelayCpu/1000)} sec ${i}/60`)
      this.countDown(timerDelayCpu)
      await this.delay(timerDelayCpu);
    }
  }
}

appendMessage(msg , box = ''){
  const dateNow = moment().format('DD/MM/YYYY H:mm:ss');
  const boxMessage = document.getElementById("box-message"+box)
  boxMessage.value += '\n'+ `${dateNow} : ${msg}`
  boxMessage.scrollTop = boxMessage.scrollHeight;
}

countDown(countDown, elementID = "text-cooldown"){
  clearInterval(this.interval);
  let countDownDisplay = Math.floor(countDown/1000)
  this.interval = setInterval(function() {
    document.getElementById(elementID).innerHTML = countDownDisplay + " Sec"
    countDown = countDown - 1000;
    countDownDisplay = Math.floor(countDown/1000)
    if (countDown < 1000) {
      clearInterval(this.interval);
      if(elementID !== "text-cooldown"){
        document.getElementById(elementID).innerHTML = "Wait to next step";
      }else{
        document.getElementById(elementID).innerHTML = "Go mine";
      }          
    }
  }, 1000);
}

async stop() {
  this.isBotRunning = false;
  this.appendMessage("bot STOP")
  console.log(`%c[Bot] stop`, 'color:green');
}

async start() {
  try{
    await this.countFailCpu('load');
    //load last restIndex
    this.configRest('load')
    this.waitMineReload();
    const userAccount = await wax.login();
    clearInterval(this.waitMine);
    document.getElementById("text-user").innerHTML = userAccount
    document.getElementsByTagName('title')[0].text = userAccount
    this.isBotRunning = true;
    await this.delay(2000);
    // if(document.querySelector('input[name="server"]:checked').value === 'ok-nonce' && this.checkExpire == true){
    //   const dataExpire = await this.postData(`https://worker.meanow-mine.work/check-expire?wallet=${wax.userAccount}`,{},'GET',{}, 'text')
    //   document.getElementById("ok-nonce-expire").innerHTML = 'Expire:' + dataExpire
    //   this.checkExpire = false;
    // }
    this.appendMessage("bot START")    
    this.getLand();
    while (this.isBotRunning) {
      let minedelay = 1;
      do {
        const timerDelay = (parseFloat(document.getElementById("timer").value) * 60) * 1000
        if(timerDelay != 0){
          if(this.checkMinedelay){
            minedelay = timerDelay;
          }
        }else{
          await this.delay(3000);
          minedelay = await getMineDelay(userAccount);
        }

        if(isNaN(minedelay)){
          let checkNan = true;
          while(checkNan){
            console.log('minedelay isNaN', minedelay)
            this.appendMessage(`Can not getMineDelay -> delay 2 sec`)
            minedelay = await getMineDelay(userAccount);
            if(!isNaN(minedelay)){
              checkNan = false;
            }  
          }
          // this.configRest()
          // const currentWaxDomain = indexWaxDomain ? parseInt(indexWaxDomain) + 1 : 1    
          // localStorage.setItem('waxDomain',(currentWaxDomain <= waxDomain.length ? currentWaxDomain : 0))
          // this.appendMessage(`Can not getMineDelay -> delay 10 sec reload page`)
          // await this.delay(10000);
          // location.reload()
        }
        // console.log(`%c[Bot] Cooldown for ${Math.ceil((minedelay / 1000)/60)} min`, 'color:green');              
        this.countDown(minedelay)
        this.appendMessage(`Cooldown for ${Math.ceil((minedelay / 1000)/60)} min`)
        await this.delay(minedelay);
        minedelay = 0;      
      } while (minedelay !== 0 && (this.previousMineDone || this.firstMine));
      // console.log('----rest : before restActive--',restActive)
      // console.log('----rest : start--')
      if(document.getElementById("config-rest").value){
        await this.rest()
      }      
      // console.log('----rest : end--')
      await this.mine()
    }
  }catch (err) {
    this.appendMessage(`Error:${err.message}`)
    console.log(`Error:${err.message}`)
    if(err.message.indexOf("Failed to fetch") > -1){
      this.configRest()
      const currentWaxDomain = indexWaxDomain ? parseInt(indexWaxDomain) + 1 : 1    
      localStorage.setItem('waxDomain',(currentWaxDomain <= waxDomain.length ? currentWaxDomain : 0))
      this.appendMessage(`Error : Failed to fetch -> delay 10 sec change wax domain and reload page`)
      await this.delay(10000);
      location.reload()
      // this.start()
    }else{
      this.appendMessage(`Error : ${err.message} : 5 sec new start bot ...`)
      await this.delay(5000);
      this.start()
    }
  }
}

async mine(){
  const balance = await getBalance(wax.userAccount, wax.api.rpc);
    // console.log(`%c[Bot] balance: (before mine) ${balance}`, 'color:green');
    document.getElementById("text-balance").innerHTML = balance

    try {
      if(parseInt(document.getElementById("cpu").value) != 0){
        console.log("bot checkCPU2");
        await this.checkCPU(wax.userAccount);
      }
      if(this.alertCaptcha){
        const audio = new Audio('https://media.geeksforgeeks.org/wp-content/uploads/20190531135120/beep.mp3');
        audio.play();
      }
      this.waitMineReload();

      const nonce = await this.getNonce()
      let actions = [
        {
          account: "m.federation",
          name: "mine",
          authorization: [
            {
              actor: wax.userAccount,
              permission: "active",
            },
          ],
          data: {
            miner: wax.userAccount,
            nonce: nonce,
          },
        },
      ];
      await this.checkMiningPot();
      const result = await wax.api.transact({actions},{blocksBehind: 3,expireSeconds: 90});
      console.log(`%c[Bot] result is = ${result}`, 'color:green');
      if (result && result.processed) {
          let mined_amount = 0;
          result.processed.action_traces[0].inline_traces.forEach((t) => {
              if (t.act.account === 'alien.worlds' && t.act.name === 'transfer' && t.act.data.to === wax.userAccount) {
                const [amount_str] = t.act.data.quantity.split(' ');
                mined_amount += parseFloat(amount_str);
              }
          });

        this.appendMessage(mined_amount.toString() + ' TLM','2')
        this.firstMine = false;
        this.previousMineDone = true;
        this.checkMinedelay = true;        
      }
      this.cpuFailCount = 0;
      document.getElementById("cpuFailCount").innerHTML =  this.cpuFailCount;
      clearInterval(this.waitMine);
    } catch (err) {
      clearInterval(this.waitMine);
      this.previousMineDone = false;
      if(err.message.indexOf("Mine too soon") > -1){
        this.checkMinedelay = true;
      }else{
        this.checkMinedelay = false;
      }
      if(err.message.indexOf("INVALID_HASH") > -1){
        this.checkInvalid = true;
      }
      console.log(`%c[Bot] Error:${err.message}`, 'color:red');
      this.appendMessage(`Error:${err.message}`)
      if(err.message.indexOf("NOTHING_TO_MINE") > -1){
        //reset rest
        this.restIndex = 0    
        document.getElementById("rest-display-action").innerHTML = ""
        document.getElementById("rest-display-count-down").innerHTML = ""
        document.getElementById("rest-display-setp").innerHTML = "Nothing to be mined!"
        clearInterval(mineTime);
        //delay
        this.appendMessage(`Delay error "Nothing to be mined!  Please try again later 10 min`)
        this.countDown(600000)        
        await this.delay(600000);        
      }

      // if(err.message.indexOf("maximum billable CPU time") > -1){
      //   if(parseFloat(document.getElementById("cpu-timer").value) > 0){
      //     let timerDelayCpu = parseFloat(document.getElementById("cpu-timer").value) * 5
      //     this.appendMessage(`Delay error CPU ${timerDelayCpu} min`)
      //     timerDelayCpu = (timerDelayCpu * 60) * 1000    
      //     this.countDown(timerDelayCpu)
      //     await this.delay(timerDelayCpu);        
      //   }
      // }

      if(err.message.indexOf("is not less than") > -1){
        localStorage.setItem('countCpu',JSON.stringify({cpuFailCount:0, cpuFailSum:0}))
        location.reload();
      }
    }
    
    const afterMindedBalance = await getBalance(wax.userAccount, wax.api.rpc);
    this.appendMessage(`balance (after mined): ${afterMindedBalance}`)
    document.getElementById("text-balance").innerHTML = afterMindedBalance
    
    //auto swap 2
    if(parseFloat(afterMindedBalance) > parseFloat(document.getElementById("amount-swap").value) && document.getElementById("auto-swap").checked == true){
      await this.delay(5000);
      const amountSwap = (parseFloat(document.getElementById("amount-swap").value) + 0.0001).toFixed(4) + " TLM"
      this.autoSwap(amountSwap)
    }
}

async getNonce(){
  try{
    let nonce = null;
    let message = ''
    const serverGetNonce = document.querySelector('input[name="server"]:checked').value
    let last_mine_tx = '';
    if(serverGetNonce !== 'alien'){
      let urlNinJa = '';
      if(serverGetNonce == 'ninjamine-vip'){
        urlNinJa = 'https://server-mine-b7clrv20.an.gateway.dev/server_mine_vip' +'?wallet='+wax.userAccount
      }else if(serverGetNonce == 'ok-nonce'){
        const bagDifficulty = await getBagDifficulty(wax.userAccount);
        const landDifficulty = await getLandDifficulty(wax.userAccount);
        let difficulty = bagDifficulty + landDifficulty;
        last_mine_tx = await lastMineTx(mining_account, wax.userAccount, wax.api.rpc);
        last_mine_tx = this.checkIfValidSHA256(last_mine_tx) ? last_mine_tx : '';
        difficulty = !isNaN(difficulty) ? difficulty : '0';
        const hashfail = this.checkInvalid == true ? '1' : '0'

        urlNinJa = `https://worker.meanow-mine.work?wallet=${wax.userAccount}&hashfail=${hashfail}&last_mine_tx=${last_mine_tx}&difficulty=${difficulty}`
      }
      console.log('urlNinJa',urlNinJa)
      nonce = await this.postData(urlNinJa, {}, 'GET',{Origin : ""}, 'raw')
      if(nonce !== ''){
        if(serverGetNonce == 'ninjamine'){
          message = 'Ninja limit: ' + nonce
        }else if(serverGetNonce == 'ninjamine-vip'){
          message = 'Ninja VIP god mode: ' + nonce
        }else{
          message = "P'Meanow-Mine : " + nonce
        }     
      }
      console.log(message)
    }

    if(serverGetNonce == 'alien' || nonce == ''){
      if(last_mine_tx == ''){
        last_mine_tx = await lastMineTx(mining_account, wax.userAccount, wax.api.rpc);
        last_mine_tx = this.checkIfValidSHA256(last_mine_tx) ? last_mine_tx : ''        
      }

      //check lastTx

      if(localStorage.getItem('lastMineTx') === last_mine_tx){
        nonce = localStorage.getItem('nonce');
        console.log('last nonce in storage', nonce)
      }
      localStorage.setItem('lastMineTx', last_mine_tx);    

      if(!nonce || this.checkInvalid == true){
        const mine_work = await background_mine(wax.userAccount)
        nonce = mine_work.rand_str
        localStorage.setItem('nonce', nonce);

        console.log('nonce-alien',nonce)
        message = 'Alien: ' + nonce
      }else{
        message = 'localStorage Alien: ' + nonce
      }      
    }
    this.checkInvalid = false;
    this.appendMessage(`${message}`)
    return nonce;
  }catch (err) {
    this.appendMessage(`getNonce Error message : ${err.message}`)
    this.start()
  }
}

async checkMiningPot(){
  try{ 
    let checkPotStatus = true
    let miningPot = document.getElementById("mining-pot").value
    const body = {"json": true, "code": "m.federation", "scope": miningPot, "table": "state3", "index_position": 1, "limit": 1, "reverse": false} 
    if(miningPot){
        while(checkPotStatus) {      
          this.appendMessage(`MiningPot Check`)
          const dataPot = await this.postData(waxDomain[this.getRandomInt(0, 5)]+'/v1/chain/get_table_rows', body, 'POST')    
          console.log('dataPot', dataPot)
          if(dataPot.rows){
            this.appendMessage(`MiningPot bucket: ${dataPot.rows[0].mine_bucket}`)
            const mine_bucket = parseFloat(dataPot.rows[0].mine_bucket)      
            if(mine_bucket > 0.5){          
              checkPotStatus = false;
            }else{
              this.appendMessage(`MiningPot bucket < 0.5 checks again`)
              await this.delay(3000)
            }
          }
      }      
    }
  }catch (err) {
    this.appendMessage(`checkMiningPot Error message : ${err.message}`)
    this.start()
  }
}

  claimnftsController(){
    console.log('claimnftsController')
    clearInterval(this.autoClaimnfts);
    this.autoClaimnfts = setInterval(function() {
      var newBot = new bot()
      newBot.getClaimnfts('auto')
    }, 3600000);
  }

  async getClaimnfts(mode){
    try{
      document.getElementById("btn-claimn-nft").disabled = true 
      const get_nft = await this.claims.getNFT(wax.userAccount, wax.api.rpc, aa_api) 
      console.log('get_nft',get_nft)
      if(get_nft.length > 0){
        let actions = [
          {
            account: 'm.federation',
            name: 'claimnfts',
            authorization: [{
              actor: wax.userAccount,
              permission: 'active',
            }],
            data: {
              miner: wax.userAccount
            },
          }
        ];      

        await wax.api.transact({actions},{blocksBehind: 3,expireSeconds: 90});
        for(const item of get_nft){
          this.appendMessage(item.name,'2')        
        }                    
      }else{
        if(mode !== 'auto'){
          this.appendMessage('NFT Nothing...','2')
        }
      }
      
      document.getElementById("btn-claimn-nft").disabled = false
    } catch (err) {
      this.appendMessage(`getClaimnfts message : ${err.message}`)
    }
  }

  waitMineReload(){
    console.log('waitMineReload')
    clearInterval(this.waitMine);
    this.waitMine = setInterval(function() {
      const botRest = new bot()
      botRest.configRest()
      location.reload()
    }, 300000);
  }

  async autoSwap(TLM){
    console.log('--------swap/stake start---------',TLM)
    const result = await this.claims.swap(TLM)
    console.log('result swap',result)
    
    try{
      if(result.message){
        this.appendMessage(result.message,'2')
      }else{
        this.appendMessage(TLM,'2')
      }      
    }catch (err) {
      console.error(err)
    }    
    console.log('--------swap/stake end---------')
}

async autoStake(balanceWax = 0){
  //stake
  try{
    console.log('wax balance',balanceWax)
    if(balanceWax > 0){
      const resultStake = await this.claims.stake(wax.userAccount, balanceWax)
      console.log('result Stake',resultStake)
      if(resultStake){
        this.appendMessage(resultStake,'2')
      }
    }
  }catch (err) {
    console.error(err)
  }    
}

async rest(){
  // console.log('----rest : before restActive--',restActive)
  if(restActive == false){
    let configRest = document.getElementById("config-rest").value
    try{
      configRest = configRest.split(',')
      console.log('configRest',configRest)
      if(configRest.length > 0){
        if(!configRest[this.restIndex]){
          // console.log('rest : reset restIndex = 0')
          this.restIndex = 0
        }
        // console.log('rest : restIndex',this.restIndex)
        if(configRest[this.restIndex].trim()){
          this.configRest()
          document.getElementById("rest-display-setp").innerHTML = "Step : " + (this.restIndex + 1) + " | "
          await this.restController(this.subRest(configRest[this.restIndex].trim()))
          this.restIndex += 1
        }        
        // console.log('rest : restIndex next',this.restIndex)
      }
    }catch (err) {
      console.error(err)
    }    
  }
}

subRest(text){
  let result = []
  if(text){
    try{
      let min = 0;
      let random = false
      if(text.match(/r/)){
        random = true
        min = parseInt(text.substr(2))      
      }else{
        min = parseInt(text.substr(1))
      }
      result = [text.substr(0,1), min, random]
    }catch (err) {
      console.error(err)
      result = []
    }    
  }
  return result
}

async restController(control){
  try{
    if(control.length == 3){          
      restActive = true
      control[1] = (control[2]) ? ((control[1] - 30 > 0) ? this.getRandomInt(control[1] - 30, control[1]) : control[1]) : control[1]
      console.log('rest : control',control)
      switch(control[0]) {
        case 'm':    
          // console.log('rest : set m',restActive)
          this.appendMessage(`Rest : Step ${this.restIndex + 1} Mine ${(control[1] * 60)} min`)
          document.getElementById("rest-display-action").innerHTML = " Mine : "      
          this.countMineTime((control[1] * 60) * 1000)
          break;
        case 'd':        
          // console.log('rest : set d',restActive)
          this.appendMessage(`Rest : Step ${this.restIndex + 1} Rest ${(control[1] * 60)} min`)
          document.getElementById("rest-display-action").innerHTML = " Rest : "
          this.countDown((control[1] * 60) * 1000, "rest-display-count-down")
          await this.delay((control[1] * 60) * 1000)        
          restActive = false
          // console.log('rest : restActive d',restActive)
          break;
        default:
          document.getElementById("rest-display-action").innerHTML = " Condition error plz check config"
      }
    }
  }catch (err) {
    console.error(err)
    this.appendMessage(`Rest : error ${err.message}`)
  }    
}

countMineTime(time){
  console.log('countMineTime')
  let countDownDisplay = Math.floor(time/1000)
  mineTime = setInterval(function() {
    document.getElementById("rest-display-count-down").innerHTML = countDownDisplay + " Sec"
    time = time - 1000;
    countDownDisplay = Math.floor(time/1000)
    if (time < 1000) {      
      restActive = false
      // console.log('rest : countMineTime restActive',restActive)
      document.getElementById("rest-display-count-down").innerHTML = 'Wait to next step'
      clearInterval(mineTime);
    }
  }, 1000);

}

getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

checkIfValidSHA256(str) {
  // Regular expression to check if string is a SHA256 hash
  const regexExp = /^[a-f0-9]{64}$/gi;

  return regexExp.test(str);
}

configRest(mode = 'save'){
  try {
    if(mode === 'load'){
      const lastRestIndex = localStorage.getItem('restIndex')  
      this.restIndex = (!isNaN(lastRestIndex)) ? parseInt(lastRestIndex) : 0
    }else{
      if(document.getElementById("config-rest").value){
        localStorage.setItem('restIndex',this.restIndex)  
      }else{
        localStorage.removeItem('restIndex');
      }  
    }
  } catch (error) {
    localStorage.setItem('restIndex',0)  
  }
}

async getLand(){
  const body = {"json": true,"code": "m.federation","scope": "m.federation","table": "miners","lower_bound": wax.userAccount,"upper_bound": wax.userAccount};
  const data = await this.postData('https://wax.pink.gg/v1/chain/get_table_rows', body, 'POST');
  console.log('getLand data', data)
  if(data.rows.length > 0){
    const landID = data.rows[0].current_land;
    console.log('landID', landID, data.rows[0].current_land, landID.length)
    if(landID.length === 13){
      // let landData = await this.postData('https://wax.blokcrafters.io/atomicassets/v1/assets/' + landID, {}, 'GET')
      let landData = await this.postData('https://api.alienworlds.io/v1/alienworlds/asset?id=' + landID, {}, 'GET')
      console.log('getLand landData', landData.results)
      if(landData.results){
        const asset_id = landData.results[0].asset_id
        landData = landData.results[0].data      
        document.getElementById("text-land-id").innerHTML = asset_id;
        document.getElementById("text-land-name").innerHTML = landData.name;
        // document.getElementById("text-land-com").innerHTML = ' '+(globalCommission * 0.01).toFixed(2).toString() + '%';
      }
    }    
  }

}

async changeLand(landID) {
  try {
      const actions = [{
          'account': 'm.federation',
          'name': 'setland',
          'authorization': [{
              'actor': wax.userAccount,
              'permission': 'active'
          }],
          'data': {
            'account': wax.userAccount,
            'land_id': landID,
        }
      }];
      let result = await wax.api.transact({
          actions,
      }, {
          blocksBehind: 3,
          expireSeconds: 90,
      });
      if (result && result.processed) {
        await this.getLand();
          this.appendMessage(`Change Land : ${landID} success`)
      }
  } catch (error) {
    this.appendMessage(`Change Land : ${error.message}`)
  }
}

  async countFailCpu(action){
    try {
      console.log('action', action)
      if(action === 'load'){
        let dataCount = localStorage.getItem('countCpu')
        if(!dataCount){
          dataCount = {cpuFailCount:this.cpuFailCount, cpuFailSum:this.cpuFailSum}
          localStorage.setItem('countCpu',JSON.stringify(dataCount))
        }else{
          dataCount = JSON.parse(dataCount)
          this.cpuFailCount = parseInt(dataCount.cpuFailCount);
          this.cpuFailSum = parseInt(dataCount.cpuFailSum);
        } 
        console.log('cpuFailCount', this.cpuFailCount, this.cpuFailSum, dataCount)     
      }else if(action === 'count'){
        this.cpuFailCount += 1;
        console.log('cpuFailCount', this.cpuFailCount, this.cpuFailSum)
        if(this.cpuFailCount >= 20){
          this.cpuFailCount = 0;
          this.cpuFailSum += 1;
          localStorage.setItem('countCpu',JSON.stringify({cpuFailCount:this.cpuFailCount, cpuFailSum:this.cpuFailSum}))          
        }
        
        document.getElementById("cpuFailCount").innerHTML =  this.cpuFailCount;
        document.getElementById("cpuFailSum").innerHTML = this.cpuFailSum;
      }
    } catch (error) {
      this.appendMessage(`countFailCpu : ${error.message}`)
    }
  }

}

var mineTime
var restActive = false
