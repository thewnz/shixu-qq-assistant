const {app,BrowserWindow,ipcMain,safeStorage,dialog,shell,Notification,session,clipboard,screen}=require('electron');
const path=require('node:path');
const fs=require('node:fs');
const {Store}=require('./store.cjs');
const {Engine,report}=require('./engine.cjs');
const {OneBot,localWs}=require('./onebot.cjs');
const {apiUrl}=require('./parser.cjs');
const {demo}=require('./demo.cjs');
const {Floating}=require('./floating.cjs');
const {BridgeManager}=require('./bridge-manager.cjs');
app.setName('shixu-qq-assistant');
if(!process.env.SHIXU_TEST_DATA_DIR&&!app.requestSingleInstanceLock())app.quit();
app.on('second-instance',()=>{if(window&&!window.isDestroyed()){if(window.isMinimized())window.restore();window.show();window.focus();}});
let window,store,real,sample,bridge,reminderTimer,floating,bridgeManager,bridgeRuntime=null;
const changed=()=>{if(window&&!window.isDestroyed())window.webContents.send('shixu:change');floating?.refresh();};
function decrypt(name){const value=store.data.secrets[name];return value?safeStorage.decryptString(Buffer.from(value,'base64')):'';}
function secret(name,value){if(typeof value!=='string')return;if(!value){delete store.data.secrets[name];return;}if(!safeStorage.isEncryptionAvailable())throw new Error('Windows 密钥加密不可用，无法保存密钥');store.data.secrets[name]=safeStorage.encryptString(value).toString('base64');}
function notify(title,body){if(store.data.settings.reminders&&Notification.isSupported()){const n=new Notification({title,body});n.on('click',()=>{window.show();window.focus();});n.show();}}
function remind(){if(!store.data.settings.reminders)return;const now=Date.now();let modified=false;for(const t of store.data.tasks){if(t.completedAt||t.review||t.reminded||!t.deadline)continue;const due=Date.parse(t.deadline);if(due-now<=24*3600000){notify(due<now?'任务已逾期':'任务即将到期',t.title+' · '+t.group);t.reminded=true;modified=true;}}if(modified)real.changed();}
function cleanExport(engine){return{version:1,exportedAt:new Date().toISOString(),...engine.snapshot()};}
app.whenReady().then(()=>{try{
 const root=process.env.SHIXU_TEST_DATA_DIR||app.getPath('userData');store=new Store(path.join(root,'data.json'));const locator=path.join(__dirname,'../.local-data/bridge-location.json');if(!process.env.SHIXU_TEST_DATA_DIR&&fs.existsSync(locator)){bridgeRuntime=JSON.parse(fs.readFileSync(locator,'utf8')).runtime;const configPath=path.join(bridgeRuntime,'config/onebot11.json');if(fs.existsSync(configPath)&&!store.data.secrets.token){const config=JSON.parse(fs.readFileSync(configPath,'utf8'));const endpoint=config.network?.websocketServers?.find(s=>s.enable&&s.host==='127.0.0.1');if(endpoint){store.data.settings.wsUrl='ws://127.0.0.1:'+endpoint.port;secret('token',endpoint.token);store.save();}}}bridgeManager=new BridgeManager({root:path.join(root,'bridge'),archive:app.isPackaged?path.join(process.resourcesPath,'bridge/NapCat.Shell.zip'):path.join(__dirname,'../build/resources/NapCat.Shell.zip'),externalRuntime:bridgeRuntime,onChange:changed,onPrepared:cfg=>{bridgeRuntime=cfg.runtime;store.data.settings.wsUrl=cfg.url;secret('token',cfg.token);store.save();changed();}});bridgeManager.detect().catch(()=>{});real=new Engine(store,{key:()=>decrypt('apiKey'),notify});sample=demo();real.change=changed;sample.change=changed;bridge=new OneBot();bridge.on('status',changed);bridge.on('groups',groups=>{store.data.groups=groups.map(g=>({id:String(g.group_id),name:g.group_name||'QQ群 '+g.group_id}));real.changed();});bridge.on('message',e=>{real.ingest(e);});
 window=new BrowserWindow({width:1440,height:940,minWidth:1000,minHeight:700,title:'拾序 · 群消息待办助手',backgroundColor:'#f7f8fa',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 session.defaultSession.setPermissionRequestHandler((_w,_p,callback)=>callback(false));window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',e=>e.preventDefault());
 if(process.env.SHIXU_DEV==='1')window.loadURL('http://127.0.0.1:5173');else window.loadFile(path.join(__dirname,'../dist/index.html'));
 floating=new Floating({BrowserWindow,screen,store,getEngine:mode=>mode==='demo'?sample:real,getConnection:()=>bridge.state,onChange:changed,onOpen:payload=>{if(window.isMinimized())window.restore();window.show();window.focus();window.webContents.send('shixu:open',payload);}});
 window.on('closed',()=>{floating.destroy();app.quit();});
 ipcMain.handle('shixu:call',async(event,action,p={})=>{const isMain=event.sender===window.webContents;const isFloating=floating.window&&!floating.window.isDestroyed()&&event.sender===floating.window.webContents;if((!isMain&&!isFloating)||event.senderFrame!==event.sender.mainFrame)throw new Error('无效请求来源');if(isFloating&&!['floatingSnapshot','floatingCollapse','floatingClose','floatingOpenTask','floatingComplete'].includes(action))throw new Error('悬浮窗无权执行此操作');const engine=p.mode==='demo'?sample:real;
 switch(action){
 case 'snapshot':return{...engine.snapshot(),settings:{...engine.snapshot().settings,floatingEnabled:store.data.settings.floatingEnabled},connection:bridge.state,mode:p.mode==='demo'?'demo':'real',hasApiKey:!!store.data.secrets.apiKey,hasToken:!!store.data.secrets.token,hasLocalBridge:!!bridgeRuntime,bridgeSetup:bridgeManager.info()};
 case 'floatingSnapshot':return floating.snapshot();
 case 'floatingSetMode':floating.setMode(p.mode);return true;
 case 'floatingShow':floating.enable(true,p.mode);return true;
 case 'floatingPreferences':floating.enable(!!p.enabled,p.mode);return true;
 case 'floatingClose':floating.enable(false);return true;
 case 'floatingCollapse':floating.collapse(!!p.collapsed);return true;
 case 'floatingOpenTask':floating.open(p.id,['tasks','review','messages'].includes(p.view)?p.view:'tasks');return true;
 case 'floatingComplete':floating.complete(p.id);return true;
 case 'task':engine.task(p.action,p.id,p.patch);return true;
 case 'message':engine.messageAction(p.action,p.id,p.patch);return true;
 case 'retry':return engine.retry(p.id);
 case 'removeRule':engine.removeRule(p.id);return true;
 case 'resetDemo':sample=demo();sample.change=changed;changed();return true;
 case 'report':return report(engine.snapshot(),p.period);
 case 'settings':{if(p.mode==='demo')throw new Error('请退出演示模式后配置真实连接');const patch=p.settings||{};const next={...store.data.settings};for(const field of ['wsUrl','apiBase','model','cloudEnabled','selectedGroups','profile','reminders'])if(field in patch)next[field]=patch[field];localWs(next.wsUrl);apiUrl(next.apiBase);if(!Array.isArray(next.selectedGroups))throw new Error('群选择格式错误');next.selectedGroups=next.selectedGroups.map(String);next.model=String(next.model||'').trim();next.profile=String(next.profile||'').slice(0,1000);next.cloudEnabled=!!next.cloudEnabled;next.reminders=!!next.reminders;if(next.cloudEnabled&&!(p.apiKey||store.data.secrets.apiKey))throw new Error('请先填写 API 密钥');if(next.cloudEnabled&&!next.model)throw new Error('请填写模型名称');secret('apiKey',p.apiKey);secret('token',p.token);store.data.settings=next;real.changed();return true;}
 case 'connect':if(p.mode==='demo')throw new Error('请先退出演示模式');bridge.connect(store.data.settings.wsUrl,decrypt('token'));return true;
 case 'disconnect':bridge.disconnect();return true;
 case 'testAI':{const s=store.data.settings;if(!s.model||!decrypt('apiKey'))throw new Error('请先保存模型和 API 密钥');const {extract}=require('./parser.cjs');await extract({text:'通知：明日校内食堂正常营业。',group:'连通性测试',sender:'测试',sentAt:new Date().toISOString()},s,decrypt('apiKey'));return true;}
 case 'openGroup':if(!/^\d{5,20}$/.test(String(p.groupId)))throw new Error('演示群无法跳转 QQ');await shell.openExternal('mqqwpa://im/chat?chat_type=group&uin='+p.groupId+'&version=1');return true;
 case 'openAttachment':{const m=engine.store.data.messages.find(m=>m.id===p.messageId);const a=m?.attachments[p.index];if(!a?.url)throw new Error('该附件无可用链接，请回到 QQ 查看');const u=new URL(a.url);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw new Error('附件链接无效');await shell.openExternal(u.toString());return true;}
 case 'openDocs':await shell.openExternal('https://napneko.github.io/guide/boot/Shell');return true;
 case 'bridgeStart':await bridgeManager.start();return true;
 case 'bridgePrepare':await bridgeManager.prepare();return true;
 case 'bridgeSelectQQ':{const r=await dialog.showOpenDialog(window,{title:'选择已安装的 QQ.exe',properties:['openFile'],filters:[{name:'QQ 程序',extensions:['exe']}]});if(!r.canceled)bridgeManager.selectQQ(r.filePaths[0]);return !r.canceled;}
 case 'bridgeDownloadQQ':await shell.openExternal('https://im.qq.com/pcqq/');return true;
 case 'openBridgeLogin':await shell.openExternal(bridgeManager.loginUrl());return true;
 case 'copyBridgeToken':clipboard.writeText(bridgeManager.webToken());return true;
 case 'export':{const result=await dialog.showSaveDialog(window,{defaultPath:'拾序数据备份.json',filters:[{name:'JSON',extensions:['json']}]});if(!result.canceled){fs.writeFileSync(result.filePath,JSON.stringify(cleanExport(engine),null,2),'utf8');return true;}return false;}
 default:throw new Error('不支持的操作');}
 });if(store.data.settings.floatingEnabled)floating.show();reminderTimer=setInterval(()=>{remind();floating.refresh();},60000);
 }catch(e){dialog.showErrorBox('拾序启动失败',e.message);app.quit();}});
app.on('window-all-closed',()=>app.quit());app.on('before-quit',()=>{floating?.destroy();bridge?.disconnect();clearInterval(reminderTimer);});
