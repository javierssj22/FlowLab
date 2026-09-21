// No localStorage, cookies, accounts or persistent handles. Authority stays with the selected file.
export class ProjectFileStore {
  constructor(){this.handle=null;this.baseline=null;this.queue=Promise.resolve();}
  async open(picker=globalThis.showOpenFilePicker){
    if(!picker)throw Error('Usa Abrir JSON en este navegador.');
    const [handle]=await picker({types:[{description:'Proyecto FlowLab',accept:{'application/json':['.json']}}],multiple:false});
    const text=await (await handle.getFile()).text();return {text,accept:()=>{this.handle=handle;this.baseline=text;}};
  }
  async save(text,name,picker=globalThis.showSaveFilePicker){
    // Picker must run from the click, before waiting on queued disk work.
    if(!this.handle){if(!picker)throw Error('FILE_PICKER_UNAVAILABLE');this.handle=await picker({suggestedName:name,types:[{description:'Proyecto FlowLab',accept:{'application/json':['.json']}}]});this.baseline=await (await this.handle.getFile()).text();}
    const handle=this.handle;
    const job=this.queue.catch(()=>{}).then(async()=>{
      if(handle!==this.handle)throw Error('El archivo activo cambió.');
      const writer=await handle.createWritable({mode:'exclusive'});
      try{const existing=await (await handle.getFile()).text();if(existing!==this.baseline)throw Error('Conflicto: otro proceso modificó el archivo. Abre la versión actual o guarda una copia.');await writer.write(text);await writer.close();if(handle===this.handle)this.baseline=text;}catch(e){try{await writer.abort();}catch{}throw e;}
    });this.queue=job;return job;
  }
  detach(){this.handle=null;this.baseline=null;}
}
