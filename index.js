/**
 * Created by yx on 17-3-17.
 * 2018-02-28 add TV(include customer mode) & S20c control
 */
const https     = require('https');
const http      = require("http");
const urlencode = require('urlencode');
const crypto    = require('crypto');
const _         = require('underscore');
const Q         = require('q');
var Event       = require('events');
var util        = require('util');

const api_DeviceContrl    = "/api/control";
const api_DeviceList      = "/api/getDeviceListNoScene";
const api_DeviceStatusAll = "/api/deviceStatusAll";
const api_KKIRDeviceList  = "/api/getKKIRDeviceList";

const api_token_Acirmodel   = "/acirmodel";
const api_token_Acircode    = "/acir";
const api_token_GetIrIDList = "/remotes";
const api_token_GetIrCode   = "/getIRS";

const param_order_ircontrol = "ir control";
const param_order_on        = "on";
const param_order_off       = "off";

const exten_api_GetContentByUIds = "/orvibo/getContentByUIds";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var HKOrvibo = function(options) {
    this.options = options;
    this.options.irDeviceType = options.irDeviceType || 5;
    this.UIds = [];
    Event.EventEmitter.call(this);
};

util.inherits(HKOrvibo,Event.EventEmitter);

HKOrvibo.prototype.init = function () {
    this.addRoutine(function () {

        var deferred = Q.defer();

        this.readDataTimeoutHandle = setTimeout(function () {
            console.log('Orvibo read timeout');
            this.readDataTimeoutHandle = null;
            deferred.resolve('Orvibo read timeout');
        }.bind(this),30000);

        Q().then(function() {
            return this.getDeviceStatusByUIds();
        }.bind(this)).then(function (result) {
            // console.log('result:%s',JSON.stringify(result));
            if(result&&result.result==true && result.object){
                _.each(result.object,function (devInfo,uid) {
                    var dev = JSON.parse(devInfo[0].func);
                    var devOnline = devInfo[0].status || {};

                    if(_.isEmpty(devOnline))
                    {

                        devOnline = {"infoType":107};
                    }
                    else {
                        devOnline = JSON.parse(devOnline);
                    }

                    // console.log('dev:',dev,uid,dev.uid);
                    if(dev.uid){
                        // dev.online = true;// for test only
                        // console.log('dev:',dev,uid);
                        // 107 online , 108 offline
                        if(parseInt(devOnline.infoType) == 107){
                            this.emit('online',dev);
                        }else {
                            this.emit('offline',uid);
                        }
                    }
                }.bind(this));
            }
            clearTimeout(this.readDataTimeoutHandle);
            this.readDataTimeoutHandle = null;
            deferred.resolve('true');
        }.bind(this)).catch(function(err) {
            //
            clearTimeout(this.readDataTimeoutHandle);
            this.readDataTimeoutHandle = null;
            console.error(err.message);
            deferred.resolve('Orvibo read error');
        }.bind(this));

        return deferred.promise;
    }.bind(this) ,this.options.interval || 60000);
};

HKOrvibo.prototype.getDeviceList = function () {

    var userName = this.options.userName;
    var password = this.options.password;
    var appkey   = this.options.appkey;
    var appId    = this.options.appId;


    var apiuri    = api_DeviceList;
    var timestamp = this.getTimestamp();
    var md5pwd    = crypto.createHash('md5').update(password).digest('hex').toString().toUpperCase();
    var sn        = this.randomString();//"46GtEQy4wxwRBRk7dNPGpWmMNxQcaam4";//randomString();
    var url       = urlencode(apiuri);
    var params    = {appId:appId,password:md5pwd, userName:userName, sn:sn,time:timestamp,url:url};
    var postdata  = this.createOvriboAPISignature(apiuri,appkey,params);

    return this.httpsRequstPost(this.options.host,apiuri,postdata);
};

HKOrvibo.prototype.getDeviceStatusByUIds = function () {

    var apiuri = exten_api_GetContentByUIds;
    var postdata = "";
    var uids   = "";
    var token  = "";
    var iv = "";
    var timestamp = this.getTimestamp();

    var data = this.options.houseId + "_" + this.getTimestamp();
    var key = this.options.key;
    var token = this.encryption(data,key,iv);

    if(this.UIds.length > 0){
       _.each(_.uniq(this.UIds),function (item) {
            uids = uids + item + ',';
        });
        uids = uids.substring(0, uids.lastIndexOf(','));
        var uri  = apiuri+"?uIds="+uids;

        return this.httpRequstPost(this.options.extenHost,uri,postdata,token);
    }
    else{
        return Q.resolve("");
    }
};

HKOrvibo.prototype.getDeviceStatus = function () {

    var userName = this.options.userName;
    var password = this.options.password;
    var appkey   = this.options.appkey;
    var appId    = this.options.appId;

    var apiuri    = api_DeviceStatusAll;
    var timestamp = this.getTimestamp();
    var md5pwd    = crypto.createHash('md5').update(password).digest('hex').toString().toUpperCase();
    var sn        = this.randomString();
    var url       = urlencode(apiuri);
    var params    = {appId:appId,password:md5pwd,userName:userName,sn:sn,time:timestamp,url:url};
    var postdata  = this.createOvriboAPISignature(apiuri,appkey,params);

    return this.httpsRequstPost(this.options.host,apiuri,postdata);
};

HKOrvibo.prototype.getKKIRDeviceList = function (uid,deviceId) {

    var userName = this.options.userName;
    var password = this.options.password;
    var appkey   = this.options.appkey;
    var appId    = this.options.appId;

    var apiuri    = api_KKIRDeviceList;
    var timestamp = this.getTimestamp();
    var md5pwd    = crypto.createHash('md5').update(password).digest('hex').toString().toUpperCase();
    var sn        = this.randomString();
    var url       = urlencode(apiuri);
    var uid       = uid;//"5ccf7f20875d";
    var deviceId  = deviceId;//"c39f7c25f5704ad991246c610210eb66";
    var params    = {appId:appId,password:md5pwd,userName:userName,sn:sn,time:timestamp,url:url,uid:uid,deviceId:deviceId,};
    var postdata  = this.createOvriboAPISignature(apiuri,appkey,params);

    return this.httpsRequstPost(this.options.host,apiuri,postdata);
};

HKOrvibo.prototype.getAcIRMode = function (rid) {
    var token = this.options.token;

    var result = {status:1,msg:"request failed"};
    var timestamp = this.getTimestamp();
    var nonce     = "1234";
    var sign      = this.createOvriboTokenSignature(token,timestamp,nonce);

    var getACIRMode = api_token_Acirmodel+"?rid="+rid+"&signature="+sign+"&timestamp="+timestamp+"&nonce="+nonce;

    return this.httpsRequstGet(this.options.host,getACIRMode).then((res)=>{
        if(res&&res.type!=undefined){
            if(res.status==0){
                result = {type:res.type,status:0,msg:""};
                return Q.resolve(result);
            }else {
                return Q.reject({type:-1,status:res.status,msg:res.msg});
            }
        }else {
            return Q.reject({type:-1,status:1,msg:"request failed"});
        }
    })

};

HKOrvibo.prototype.getIRIDList = function (did,bid) {
    var token = this.options.token;

    var result = {status:1,msg:"request failed"};
    var timestamp = this.getTimestamp();
    var nonce     = "1234";
    var sign      = this.createOvriboTokenSignature(token,timestamp,nonce);

    var strGetIRIDList = api_token_GetIrIDList+"?did="+did+"&bid="+bid+"&signature="+sign+"&timestamp="+timestamp+"&nonce="+nonce;

    return this.httpsRequstGet(this.options.host,strGetIRIDList).then((res)=>{
        if(res&&res.rids!=undefined){
            if(res.status==0){
                result = {rids:res.rids,status:0,msg:""};
                return Q.resolve(result);
            }else {
                return Q.reject({rids:"",status:res.status,msg:res.msg});
            }
        }else {
            return Q.reject({rids:"",status:1,msg:"request failed"});
        }
    })

};

HKOrvibo.prototype.getIRCode = function (rids,countryCode) {
    var token = this.options.token;

    var result = {status:1,msg:"request failed"};
    var timestamp = this.getTimestamp();
    var nonce     = "1234";
    var sign      = this.createOvriboTokenSignature(token,timestamp,nonce);

    var strGetIrCode = api_token_GetIrCode+"?rids="+rids+"&countryCode="+countryCode+"&signature="+sign+"&timestamp="+timestamp+"&nonce="+nonce;

    return this.httpsRequstGet(this.options.host,strGetIrCode).then((res)=>{
        if(res&&res.status==0){
            result = {irDataList:res.irDataList,status:0,msg:""};
            return Q.resolve(result);
        }else {
            return Q.reject({type:-1,status:1,msg:"request failed"});
        }
    })

};

HKOrvibo.prototype.getAcIRCode = function (rid,power,mode,temperature,speed,direct,fid) {
    var token = this.options.token;
    var host  = this.options.host;

    var result = {status:1,msg:"request failed"};
    var timestamp = this.getTimestamp();
    var nonce     = "1234";
    var fidcode   = (fid==undefined)?0:fid;
    var sign      = this.createOvriboTokenSignature(token,timestamp,nonce);

    var getACIRCode = api_token_Acircode+"?rid="+rid+"&power="+power+"&mode="+mode+"&temp="+temperature+"&speed="+speed+"&direct="+direct+"&fid="+fidcode+"&signature="+sign+"&timestamp="+timestamp+"&nonce="+nonce;

    return this.httpsRequstGet(this.options.host,getACIRCode).then((res)=>{
        if(res&&res.status!=undefined){
            if(res.status==0){
                result = {fre:res.fre,patten:res.pattern.toString(),status:0,msg:""};
                return Q.resolve(result);
            }else {
                return Q.reject({status:res.status,msg:res.msg});
            }
        }else{
            return Q.reject({status:1,msg:"request failed"});
        }
    })
};

HKOrvibo.prototype.deviceControl = function (uid,deviceId,irFre,irCode) {
    if(!irFre || !irCode){
        return Q.resolve({status:1,msg:""});
    }

    var userName = this.options.userName;
    var password = this.options.password;
    var appkey   = this.options.appkey;
    var appId    = this.options.appId;

    var apiuri    = api_DeviceContrl;
    var timestamp = this.getTimestamp();//"1489653262943";//this.getTimestamp();
    var md5pwd    = crypto.createHash('md5').update(password).digest('hex').toString().toUpperCase();
    var sn        = this.randomString();//"46GtEQy4wxwRBRk7dNPGpWmMNxQcaam4";//randomString();
    var url       = urlencode(apiuri);
    var uid       = uid;//"5ccf7f20875d";
    var deviceId  = deviceId;//"c39f7c25f5704ad991246c610210eb66";
    var order     = param_order_ircontrol;
    var value1    = "0";
    var value2    = "0";
    var value3    = "0";
    var value4    = "0";
    var delayTime = "0";
    var type      = "2";
    var id        = "";
    var freq      = irFre;

    var pluseData = irCode;
    var pluseNum  = pluseData.split(",").length;
    var pluseNum  = pluseNum.toString();

    var params = {appId:appId,password:md5pwd, userName:userName, sn:sn,time:timestamp,url:url,uid:uid,deviceId:deviceId,
        order:order,value1:value1,value2:value2,value3:value3,value4:value4,delayTime:delayTime,type:type,
        id:id,freq:freq,pluseNum:pluseNum,pluseData:pluseData};

    var postdata = this.createOvriboAPISignature(apiuri,appkey,params);

    // console.log("postdata:",postdata);
    return this.httpsRequstPost(this.options.host,apiuri,postdata);

};

HKOrvibo.prototype.orviboDeviceControl = function (uid,deviceId,value) {
    if(value == undefined){
        return Q.resolve({status:1,msg:""});
    }

    var userName = this.options.userName;
    var password = this.options.password;
    var appkey   = this.options.appkey;
    var appId    = this.options.appId;

    var apiuri    = api_DeviceContrl;
    var timestamp = this.getTimestamp();//"1489653262943";//this.getTimestamp();
    var md5pwd    = crypto.createHash('md5').update(password).digest('hex').toString().toUpperCase();
    var sn        = this.randomString();//"46GtEQy4wxwRBRk7dNPGpWmMNxQcaam4";//randomString();
    var url       = urlencode(apiuri);
    var uid       = uid;//"5ccf7f20875d";
    var deviceId  = deviceId;//"c39f7c25f5704ad991246c610210eb66";
    var order     = param_order_on;
    var value1    = "0";
    if(!value){
        order  = param_order_off;
        value1 = "1";
    }


    var value2    = "0";
    var value3    = "0";
    var value4    = "0";
    var delayTime = "0";
    // var type      = "0";
    // var id        = "";
    // var freq      = "0";
    //
    // var pluseData = "";
    // var pluseNum  = "0";

    // var params = {appId:appId,password:md5pwd, userName:userName, sn:sn,time:timestamp,url:url,uid:uid,deviceId:deviceId,
    //     order:order,value1:value1,value2:value2,value3:value3,value4:value4,delayTime:delayTime,type:type,
    //     id:id,freq:freq,pluseNum:pluseNum,pluseData:pluseData};

    var params = {appId:appId,password:md5pwd, userName:userName, sn:sn,time:timestamp,url:url,uid:uid,deviceId:deviceId,
        order:order,value1:value1,value2:value2,value3:value3,value4:value4,delayTime:delayTime};

    var postdata = this.createOvriboAPISignature(apiuri,appkey,params);

    // console.log("sn:",sn,uid);
    return this.httpsRequstPost(this.options.host,apiuri,postdata);

};

HKOrvibo.prototype.SetUIds = function (uids) {
    // console.log("SetUIds:",JSON.stringify(uids));
    this.UIds = uids;
};

HKOrvibo.prototype.getTimestamp = function () {
    var datenow = new Date();
    return datenow.getTime().toString();
};

/**
 * httpsRequstGet
 */
HKOrvibo.prototype.httpsRequstGet = function (host,uri) {

    return new Promise((resolve, reject) => {
        var options = {
            hostname: host,
            port: 443,
            path: uri,
            method: 'GET'
        };
        var str = '';
        var req = https.request(options, (res) => {
            res.setEncoding("utf-8");
            res.on('data', (d) => {
                str+=d;
            });
            res.on('end',()=>{
                var returnStr = '';
                try{
                    returnStr = JSON.parse(str);
                }catch(e){

                }

                resolve(returnStr);
            })
        });
        req.end();
        req.on('error', (e) => {
            reject(e);
        });
    })

};

/**
 * httpsRequstPost
 */
HKOrvibo.prototype.httpsRequstPost = function (host,uri,postdata) {
    return new Promise((resolve, reject) => {
        var options = {
            hostname: host,
            port: 443,
            path: uri,
            method: 'POST'
        };
        var str = '';
        var req = https.request(options, (res) => {
            res.setEncoding("utf-8");
            res.on('data', (d) => {
                str+=d;
            });
            res.on('end',()=>{
                var returnStr = '';
                try{
                    returnStr = JSON.parse(str);
                }catch(e){

                }
                resolve(returnStr);
            })
        });
        req.write(postdata);
        req.end();
        req.on('error', (e) => {
            reject(e);
        });
    })
};

/**
 *
 */

HKOrvibo.prototype.httpRequstPost = function(host,uri,postdata,token) {
    return new Promise((resolve, reject) => {
        var options = {
            hostname: host,
            port: 80,
            path: uri,
            method: 'POST',
            headers:{
                'token':token
            }
        };
        // console.log('options:%s',JSON.stringify(options));
        var str = '';
        var req = http.request(options, (res) => {
            res.setEncoding("utf-8");
            res.on('data', (d) => {
                str+=d;
            });
            res.on('end',()=>{
                var returnStr = '';
                try{
                    if(res.statusCode == 200){
                        // console.log('statusCode:%s,str:%s',res.statusCode,str);
                        if(str.length > 0){
                            returnStr = JSON.parse(str);
                        }

                        resolve(returnStr);
                    }else {
                        console.error(str);
                        resolve('');
                    }

                }catch(e){
                    resolve('');
                }

            })
        });
        req.write(postdata);
        req.end();
        req.on('error', (e) => {
            resolve('');
        });
    })
};

/**
 * randomString
 */
HKOrvibo.prototype.randomString = function(len) {
    len = len || 32;
    var $chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678';    /****默认去掉了容易混淆的字符oOLl,9gq,Vv,Uu,I1****/
    var maxPos = $chars.length;
    var pwd = '';
    for (i = 0; i < len; i++) {
        pwd += $chars.charAt(Math.floor(Math.random() * maxPos));
    }
    return pwd;
};

/**
 * createOvriboTokenSignature
 */
HKOrvibo.prototype.createOvriboTokenSignature = function (token,timestamp,nonce) {
    var dict = [token,timestamp,nonce];
    dict.sort();
    var args = "";

    _.each(dict,function (key) {
        args = args +key;
    });
    //console.log(JSON.stringify(args));
    var sig = crypto.createHash('sha1').update(args).digest('hex').toString().toUpperCase();

    // console.log(sig);
    return sig;
};

/**
 * createOvriboAPISignature
 */

HKOrvibo.prototype.createOvriboAPISignature= function (uri,appkey,params) {
    var url = urlencode(uri);
    var dict = Object.keys(params).sort();

    //var args = "";
    var getArgs = "";
    _.each(dict,function (key) {
        if(key != 'url'){
            getArgs = getArgs + '&' + key+'=' + params[key];
        }

    })
    //args = args.substr(1);
    getArgs = getArgs.substr(1);
    var source = 'POST&'+url+'&'+urlencode(getArgs);

    source  = source.replace(/\%20/g, "+");
    var app_secret = appkey+'&';
    var sig = crypto.createHmac('sha1', app_secret).update(source).digest().toString('base64');


    const result = getArgs+'&sig='+sig;
    // console.log(result);
    return result;
};

/**
 * aes加密
 * @param data 待加密内容
 * @param key 必须为 16位私钥
 * @returns {string}
 */
HKOrvibo.prototype.encryption = function (data, key, iv) {
    iv = iv || "";
    var clearEncoding = 'utf8';
    var cipherEncoding = 'base64';
    var cipherChunks = [];
    var cipher = crypto.createCipheriv('aes-128-ecb', key, iv);
    cipher.setAutoPadding(true);
    cipherChunks.push(cipher.update(data, clearEncoding, cipherEncoding));
    cipherChunks.push(cipher.final(cipherEncoding));
    return cipherChunks.join('');
};

/**
 * aes解密
 * @param data 待解密内容
 * @param key 必须为 16位私钥
 * @returns {string}
 */
HKOrvibo.prototype.decryption = function (data, key, iv) {
    if (!data) {
        return "";
    }
    iv = iv || "";
    var clearEncoding = 'utf8';
    var cipherEncoding = 'base64';
    var cipherChunks = [];
    var decipher = crypto.createDecipheriv('aes-128-ecb', key, iv);
    decipher.setAutoPadding(true);
    cipherChunks.push(decipher.update(data, cipherEncoding, clearEncoding));
    cipherChunks.push(decipher.final(clearEncoding));
    return cipherChunks.join('');
};

HKOrvibo.prototype.addRoutine = function(Routine,timeout){
    var eventName = 'finished-'+Math.random().toFixed(10);

    var self = this;
    var runner ;
    function doRoutine (){
        return Q().then(function(){
            return Routine();
        }).delay(timeout || 10000).catch(function(e){
            console.error('error in read:',e ," and stack:",e.stack);
        }).finally(function(){
            process.nextTick(function(){self.emit(eventName);});
        })
    }

    this.on(eventName,function(){
        runner = doRoutine();
    });
    runner = doRoutine();

};

module.exports = HKOrvibo;
