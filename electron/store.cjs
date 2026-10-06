const fs = require('node:fs');
const path = require('node:path');
const defaults = () => ({version:1,messages:[],tasks:[],groups:[],rules:[],feedback:[],settings:{wsUrl:'ws://127.0.0.1:3001',apiBase:'https://api.openai.com/v1',model:'',cloudEnabled:false,selectedGroups:[],profile:'',reminders:true,floatingEnabled:true,floatingCollapsed:false,floatingPosition:null},secrets:{}});
class Store {
  constructor(file){this.file=file;this.data=defaults();if(file && fs.existsSync(file)){try{const saved=JSON.parse(fs.readFileSync(file,'utf8'));if(saved.version!==1)throw new Error('数据版本不兼容');this.data={...defaults(),...saved,settings:{...defaults().settings,...saved.settings}};}catch(e){throw new Error('本地数据无法读取，请备份文件后检查；不会覆盖原数据。'+e.message);}}}
  save(){if(!this.file)return;fs.mkdirSync(path.dirname(this.file),{recursive:true});const temp=this.file+'.tmp';fs.writeFileSync(temp,JSON.stringify(this.data,null,2),'utf8');fs.renameSync(temp,this.file);}
}
module.exports={Store,defaults};
