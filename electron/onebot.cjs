const {EventEmitter}=require('node:events');
const WebSocket=require('ws');
const {randomUUID}=require('node:crypto');
function localWs(value){const u=new URL(value);if(!['ws:','wss:'].includes(u.protocol)||!['127.0.0.1','localhost','[::1]'].includes(u.hostname)||u.username||u.password||u.search||u.hash)throw new Error('桥接地址必须为本机 WebSocket 地址，不要把 Token 放进地址');return u.toString();}
class OneBot extends EventEmitter {
 constructor(){super();this.pending=new Map();this.stopped=true;this.attempt=0;this.state={status:'disconnected',label:'QQ 未连接'};}
 status(status,label,extra={}){this.state={status,label,...extra};this.emit('status',this.state);}
 connect(url,token){this.disconnect();this.url=localWs(url);this.token=token;this.stopped=false;this.since=Date.now();this.open();}
 open(){if(this.stopped)return;this.status('connecting','正在连接本地 QQ 桥接');const socket=this.socket=new WebSocket(this.url,{headers:this.token?{Authorization:'Bearer '+this.token}:{},handshakeTimeout:8000,maxPayload:4*1024*1024});
 socket.on('open',async()=>{this.attempt=0;socket.alive=true;this.heartbeat=setInterval(()=>{if(!socket.alive){socket.terminate();return;}socket.alive=false;socket.ping();},20000);try{const login=await this.call('get_login_info');const groups=await this.call('get_group_list');if(socket!==this.socket||this.stopped)return;this.status('connected','QQ 已连接',{account:String(login.user_id),nickname:login.nickname});this.emit('groups',Array.isArray(groups)?groups:[]);}catch(e){this.status('error','QQ 授权或群列表读取失败：'+e.message);socket.close();}});
 socket.on('pong',()=>socket.alive=true);
 socket.on('message',raw=>{let event;try{event=JSON.parse(raw.toString());}catch{return;}if(event.echo&&this.pending.has(event.echo)){const p=this.pending.get(event.echo);clearTimeout(p.timer);this.pending.delete(event.echo);event.status==='ok'&&event.retcode===0?p.resolve(event.data):p.reject(new Error('接口返回 '+event.retcode));return;}
 if(event.post_type==='message'&&event.message_type==='group'&&Number(event.time)*1000>=Math.floor(this.since/1000)*1000)this.emit('message',event);
 if(event.post_type==='notice'&&event.notice_type==='group_upload'&&Number(event.time)*1000>=Math.floor(this.since/1000)*1000)this.emit('message',{...event,message_type:'group',message_id:'upload:'+event.group_id+':'+event.file?.id+':'+event.time,message:[{type:'file',data:event.file||{}}]});});
 socket.on('error',()=>this.status('error','无法连接 QQ 桥接，请检查服务、端口和 Token'));
 socket.on('close',()=>{clearInterval(this.heartbeat);for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error('QQ 连接已断开'));}this.pending.clear();if(!this.stopped){const delay=Math.min(30000,1000*2**this.attempt++);this.status('reconnecting',`QQ 连接断开，${delay/1000} 秒后重试`);this.timer=setTimeout(()=>this.open(),delay);}});
 }
 call(action,params={}){return new Promise((resolve,reject)=>{if(!this.socket||this.socket.readyState!==WebSocket.OPEN)return reject(new Error('QQ 尚未连接'));const echo=randomUUID();const timer=setTimeout(()=>{this.pending.delete(echo);reject(new Error('QQ 接口超时'));},8000);this.pending.set(echo,{resolve,reject,timer});this.socket.send(JSON.stringify({action,params,echo}));});}
 disconnect(){this.stopped=true;clearTimeout(this.timer);clearInterval(this.heartbeat);if(this.socket){this.socket.removeAllListeners();this.socket.on('error',()=>{});this.socket.terminate();this.socket=null;}for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error('QQ 连接已关闭'));}this.pending.clear();this.status('disconnected','QQ 未连接');}
}
module.exports={OneBot,localWs};
