const path=require('node:path');
const {bucket}=require('./engine.cjs');
function importantTasks(tasks,now=new Date()){
 const active=tasks.filter(t=>!t.completedAt&&!t.review);
 const rank=t=>bucket(t,now)==='expired'?0:bucket(t,now)==='today'?1:2;
 const important=active.filter(t=>['expired','today'].includes(bucket(t,now))||t.priority==='high').sort((a,b)=>rank(a)-rank(b)||(Date.parse(a.deadline)||Infinity)-(Date.parse(b.deadline)||Infinity)||a.title.localeCompare(b.title,'zh-CN'));
 return {total:important.length,expired:active.filter(t=>bucket(t,now)==='expired').length,today:active.filter(t=>bucket(t,now)==='today').length,review:tasks.filter(t=>!t.completedAt&&t.review).length,tasks:important.slice(0,4).map(t=>({id:t.id,title:t.title,action:t.action,deadline:t.deadline,group:t.group,priority:t.priority,bucket:bucket(t,now)}))};
}
function clampPosition(position,area,width,height){return {x:Math.round(Math.max(area.x,Math.min(Number.isFinite(position?.x)?position.x:area.x+area.width-width-22,area.x+Math.max(0,area.width-width)))),y:Math.round(Math.max(area.y,Math.min(Number.isFinite(position?.y)?position.y:area.y+60,area.y+Math.max(0,area.height-height))))};}
class Floating {
 constructor({BrowserWindow,screen,store,getEngine,getConnection,onChange,onOpen}){Object.assign(this,{BrowserWindow,screen,store,getEngine,getConnection,onChange,onOpen});this.mode='real';this.window=null;this.timer=null;}
 snapshot(){return {...importantTasks(this.getEngine(this.mode).store.data.tasks),mode:this.mode,collapsed:!!this.store.data.settings.floatingCollapsed,connection:this.getConnection(),errors:this.getEngine(this.mode).store.data.messages.filter(m=>m.status==='error').length};}
 refresh(){if(this.window&&!this.window.isDestroyed())this.window.webContents.send('shixu:change');}
 position(height){const saved=this.store.data.settings.floatingPosition;const area=saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y)?this.screen.getDisplayNearestPoint({x:Math.round(saved.x),y:Math.round(saved.y)}).workArea:this.screen.getPrimaryDisplay().workArea;return clampPosition(saved,area,348,height);}
 show(mode=this.mode){this.mode=mode==='demo'?'demo':'real';if(this.window&&!this.window.isDestroyed()){this.window.showInactive();this.refresh();return;}const height=this.store.data.settings.floatingCollapsed?68:518;const pos=this.position(height);const win=this.window=new this.BrowserWindow({width:348,height,...pos,frame:false,transparent:true,backgroundColor:'#00000000',resizable:false,maximizable:false,minimizable:false,alwaysOnTop:true,skipTaskbar:true,show:false,title:'拾序 · 重要信息悬浮窗',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());win.on('page-title-updated',e=>e.preventDefault());win.once('ready-to-show',()=>win.showInactive());win.on('move',()=>{clearTimeout(this.timer);this.timer=setTimeout(()=>{if(win.isDestroyed())return;const [x,y]=win.getPosition();this.store.data.settings.floatingPosition={x,y};this.store.save();},250);});win.on('closed',()=>{clearTimeout(this.timer);if(this.window===win)this.window=null;});
 if(process.env.SHIXU_DEV==='1')win.loadURL('http://127.0.0.1:5173/#floating');else win.loadFile(path.join(__dirname,'../dist/index.html'),{hash:'floating'});
 }
 setMode(mode){this.mode=mode==='demo'?'demo':'real';this.refresh();}
 collapse(value){this.store.data.settings.floatingCollapsed=!!value;const win=this.window;if(win&&!win.isDestroyed()){const height=value?68:518;const [x,y]=win.getPosition();this.store.data.settings.floatingPosition={x,y};const pos=this.position(height);win.setBounds({...pos,width:348,height});}this.store.save();this.onChange();}
 enable(value,mode){this.store.data.settings.floatingEnabled=!!value;if(value)this.show(mode);else this.destroy();this.store.save();this.onChange();}
 open(id,view='tasks'){const engine=this.getEngine(this.mode);if(id&&!engine.store.data.tasks.some(t=>t.id===id))throw new Error('任务已不存在');this.onOpen({mode:this.mode,id,view});}
 complete(id){const t=this.getEngine(this.mode).store.data.tasks.find(t=>t.id===id);if(!t||t.review||t.completedAt)throw new Error('任务已完成或需要先确认');this.getEngine(this.mode).task('complete',id);}
 destroy(){clearTimeout(this.timer);const win=this.window;this.window=null;if(win&&!win.isDestroyed())win.destroy();}
}
module.exports={importantTasks,clampPosition,Floating};
