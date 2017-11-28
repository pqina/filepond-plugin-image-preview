/*
 * FilePondPluginImagePreview 1.0.0
 * Licensed under MIT, https://opensource.org/licenses/MIT
 * Please visit https://pqina.nl/filepond for details.
 */
const isPreviewableImage=e=>/^image/.test(e.type)&&!/svg/.test(e.type),transforms={1:()=>[1,0,0,1,0,0],2:e=>[-1,0,0,1,e,0],3:(e,t)=>[-1,0,0,-1,e,t],4:(e,t)=>[1,0,0,-1,0,t],5:[0,1,1,0,0,0],6:(e,t)=>[0,1,-1,0,t,0],7:(e,t)=>[0,-1,-1,0,t,e],8:e=>[0,-1,1,0,0,e]},fixImageOrientation=(e,t,a,i)=>{-1!==i&&e.transform(...transforms[i](t,a))},createPreviewImage=(e,t,a,i)=>{i>=5&&i<=8&&([t,a]=[a,t]);const r=document.createElement("canvas"),n=r.getContext("2d");return i>=5&&i<=8?(r.width=a,r.height=t):(r.width=t,r.height=a),n.save(),fixImageOrientation(n,t,a,i),n.drawImage(e,0,0,t,a),n.restore(),e.close&&e.close(),r},createImagePresenterView=e=>e.utils.createView({name:"image-preview",tag:"canvas",create:({root:e,props:t})=>{e.element.width=0,e.element.height=0},write:e.utils.createRoute({DID_LOAD_PREVIEW_IMAGE:({root:e,props:t,action:a})=>{e.element.width=a.width,e.element.height=a.height;e.element.getContext("2d").drawImage(createPreviewImage(a.data,e.element.width,e.element.height,a.orientation),0,0),setTimeout(()=>{e.dispatch("DID_DRAW_PREVIEW_IMAGE",{id:t.id})},250)}}),mixins:{styles:["scaleX","scaleY","opacity"],animations:{scaleX:{type:"spring",stiffness:.5,damping:.45,mass:10},scaleY:{type:"spring",stiffness:.5,damping:.45,mass:10},opacity:{type:"tween",duration:750}}}}),overlayTemplate=document.createElement("canvas"),overlayTemplateError=document.createElement("canvas"),overlayTemplateSuccess=document.createElement("canvas"),drawTemplate=(e,t,a)=>{e.width=500,e.height=200;const i=e.getContext("2d"),r=i.createRadialGradient(250,310,100,250,310,300);r.addColorStop(.5,"rgba("+t.join(",")+")"),r.addColorStop(1,"rgba("+a.join(",")+")"),i.save(),i.translate(-125,0),i.scale(1.5,1),i.fillStyle=r,i.fillRect(0,0,500,200),i.restore()},applyTemplate=(e,t)=>{t.width=e.width,t.height=e.height;t.getContext("2d").drawImage(e,0,0)};drawTemplate(overlayTemplate,[40,40,40,0],[40,40,40,.85]),drawTemplate(overlayTemplateError,[196,78,71,0],[196,78,71,1]),drawTemplate(overlayTemplateSuccess,[54,151,99,0],[54,151,99,1]);const createImageOverlayView=e=>e.utils.createView({name:"image-overlay",tag:"div",create:({root:e,props:t})=>{e.ref.overlayShadow=document.createElement("canvas"),e.appendChild(e.ref.overlayShadow),applyTemplate(overlayTemplate,e.ref.overlayShadow),e.ref.overlayError=document.createElement("canvas"),e.appendChild(e.ref.overlayError),applyTemplate(overlayTemplateError,e.ref.overlayError),e.ref.overlaySuccess=document.createElement("canvas"),e.appendChild(e.ref.overlaySuccess),applyTemplate(overlayTemplateSuccess,e.ref.overlaySuccess)},mixins:{styles:["opacity"],animations:{opacity:{type:"tween",duration:500}}}}),getImageSize=(e,t)=>{const a=new Image;a.onload=(()=>{t(a.naturalWidth,a.naturalHeight)}),a.src=e},fitToBounds=(e,t,a,i)=>{const r=Math.min(a/e,i/t);return{width:Math.round(e*r),height:Math.round(t*r)}},getImageScaledSize=(e,t,a,i)=>{getImageSize(e,(e,r)=>{const n=fitToBounds(e,r,t,a);i(n.width,n.height)})},BitmapWorker=function(){self.onmessage=(t=>{e(t.data.message,e=>{self.postMessage({id:t.data.id,message:e})})});const e=(e,t)=>{const{file:a,resizeWidth:i,resizeHeight:r}=e,n=new FileReader;n.onload=(()=>{const e=new Blob([new Uint8Array(n.result)],{type:a.type});createImageBitmap(e).catch(e=>{t(null)}).then(e=>{t(e)})}),n.readAsArrayBuffer(a)}},Marker={JPEG:65496,APP1:65505,EXIF:1165519206,TIFF:18761,Orientation:274,Unknown:65280},getUint16=(e,t,a=!1)=>e.getUint16(t,a),getUint32=(e,t,a=!1)=>e.getUint32(t,a),getImageOrientation=(e,t)=>{const a=new FileReader;a.onload=function(e){const a=new DataView(e.target.result);if(getUint16(a,0)!==Marker.JPEG)return void t(-1);const i=a.byteLength;let r=2;for(;r<i;){const e=getUint16(a,r);if(r+=2,e===Marker.APP1){if(getUint32(a,r+=2)!==Marker.EXIF)break;const e=getUint16(a,r+=6)===Marker.TIFF;r+=getUint32(a,r+4,e);const i=getUint16(a,r,e);r+=2;for(let n=0;n<i;n++)if(getUint16(a,r+12*n,e)===Marker.Orientation)return void t(getUint16(a,r+12*n+8,e))}else{if((e&Marker.Unknown)!==Marker.Unknown)break;r+=getUint16(a,r)}}t(-1)},a.readAsArrayBuffer(e.slice(0,65536))},createImagePreviewView=e=>{return e.utils.createView({name:"image-preview-wrapper",create:({root:t,props:a,dispatch:i})=>{const{utils:r,views:n}=e,{createView:o,createWorker:s,loadImage:l}=r,{id:c}=a,d=createImagePresenterView(e);t.ref.image=t.appendChildView(t.createChildView(d,{id:a.id,scaleX:1.25,scaleY:1.25,opacity:0}));const p=createImageOverlayView(e);t.ref.overlay=t.appendChildView(t.createChildView(p,{opacity:0}));const m=t.query("GET_ITEM",c),g=(e,t,a,i)=>{l(e.fileURL).then(e=>{const r=document.createElement("canvas");r.width=t,r.height=a,r.getContext("2d").drawImage(e,0,0,t,a),h(r,t,a,i)})},h=(e,a,i,r)=>{t.dispatch("DID_LOAD_PREVIEW_IMAGE",{id:c,data:e,width:a,height:i,orientation:r})};getImageOrientation(m.file,e=>{getImageScaledSize(m.fileURL,700,700,(a,i)=>{e>=5&&e<=8&&([a,i]=[i,a]),t.dispatch("DID_CALCULATE_PREVIEW_IMAGE_SIZE",{id:c,width:a,height:i}),"createImageBitmap"in window?s(BitmapWorker).post({file:m.file,resizeWidth:a,resizeHeight:i},t=>{t?h(t,a,i,e):g(m,a,i,e)}):g(m,a,i,e)})})},write:e.utils.createRoute({DID_CALCULATE_PREVIEW_IMAGE_SIZE:({root:e,props:t,action:a})=>{const i=e.rect.element.width/a.width;t.height=a.height*i},DID_LOAD_PREVIEW_IMAGE:({root:e,props:t})=>{const{overlay:a}=e.ref;a.opacity=1},DID_DRAW_PREVIEW_IMAGE:({root:e,props:t})=>{const{image:a}=e.ref;a.scaleX=1,a.scaleY=1,a.opacity=1}}),mixins:{apis:["height"],animations:{height:"spring"}}})};var plugin$1=e=>{const{addFilter:t,utils:a}=e,{Type:i,createRoute:r}=a,n=createImagePreviewView(e);t("SET_DEFAULT_OPTIONS",e=>Object.assign(e,{allowImagePreview:[!0,i.BOOLEAN],maxPreviewFileSize:[null,i.INT]})),t("CREATE_VIEW",t=>{const{is:a,view:i,query:o}=t;if(!a("file")||!o("GET_ALLOW_IMAGE_PREVIEW"))return;const s=r({DID_LOAD_ITEM:({root:t,props:a,actions:r})=>{const{id:s}=a,l=o("GET_ITEM",s);if(!l)return;const c=l.file;if(!isPreviewableImage(c))return;const d="createImageBitmap"in(window||{}),p=o("GET_MAX_PREVIEW_FILE_SIZE");if(!d&&p&&c.size>p)return;const{panel:m}=e.views;t.ref.panel=i.appendChildView(i.createChildView(m)),t.ref.panel.element.classList.add("filepond--panel-item"),t.ref.imagePreview=i.appendChildView(i.createChildView(n,{id:s,height:10}))}});i.registerWriter(({root:e,props:t,actions:a})=>{s({root:e,props:t,actions:a}),e.ref.panel&&(e.ref.panel.height=e.ref.imagePreview.height)})})};document&&document.dispatchEvent(new CustomEvent("FilePond:pluginloaded",{detail:plugin$1}));export default plugin$1;