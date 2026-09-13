(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))n(s);new MutationObserver(s=>{for(const r of s)if(r.type==="childList")for(const o of r.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&n(o)}).observe(document,{childList:!0,subtree:!0});function t(s){const r={};return s.integrity&&(r.integrity=s.integrity),s.referrerPolicy&&(r.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?r.credentials="include":s.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function n(s){if(s.ep)return;s.ep=!0;const r=t(s);fetch(s.href,r)}})();const oc="modulepreload",lc=function(i){return"/surf-game/"+i},Ya={},dl=function(e,t,n){let s=Promise.resolve();if(t&&t.length>0){let c=function(h){return Promise.all(h.map(u=>Promise.resolve(u).then(f=>({status:"fulfilled",value:f}),f=>({status:"rejected",reason:f}))))};var o=c;document.getElementsByTagName("link");const a=document.querySelector("meta[property=csp-nonce]"),l=a?.nonce||a?.getAttribute("nonce");s=c(t.map(h=>{if(h=lc(h),h in Ya)return;Ya[h]=!0;const u=h.endsWith(".css"),f=u?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${h}"]${f}`))return;const p=document.createElement("link");if(p.rel=u?"stylesheet":oc,u||(p.as="script"),p.crossOrigin="",p.href=h,l&&p.setAttribute("nonce",l),document.head.appendChild(p),u)return new Promise((_,v)=>{p.addEventListener("load",_),p.addEventListener("error",()=>v(new Error(`Unable to preload CSS for ${h}`)))})}))}function r(a){const l=new Event("vite:preloadError",{cancelable:!0});if(l.payload=a,window.dispatchEvent(l),!l.defaultPrevented)throw a}return s.then(a=>{for(const l of a||[])l.status==="rejected"&&r(l.reason);return e().catch(r)})};const Ea="180",cc=0,$a=1,hc=2,fl=1,uc=2,dn=3,Un=0,wt=1,Ht=2,Dn=0,vi=1,Ka=2,Za=3,ja=4,dc=5,qn=100,fc=101,pc=102,mc=103,gc=104,_c=200,vc=201,xc=202,Mc=203,Ur=204,Ir=205,Sc=206,Ec=207,yc=208,Tc=209,bc=210,wc=211,Ac=212,Rc=213,Cc=214,Fr=0,Nr=1,Or=2,Zn=3,Br=4,zr=5,Ns=6,kr=7,pl=0,Pc=1,Dc=2,Ln=0,Lc=1,Uc=2,Ic=3,Fc=4,Nc=5,Oc=6,Bc=7,ml=300,Ei=301,yi=302,Hr=303,Gr=304,Xs=306,Vr=1e3,$n=1001,Wr=1002,ht=1003,zc=1004,is=1005,tn=1006,Zs=1007,Kn=1008,mn=1009,gl=1010,_l=1011,Xi=1012,ya=1013,jn=1014,fn=1015,ji=1016,Ta=1017,ba=1018,qi=1020,vl=35902,xl=35899,Ml=1021,Sl=1022,Gt=1023,Yi=1026,$i=1027,El=1028,wa=1029,yl=1030,Aa=1031,Ra=1033,Cs=33776,Ps=33777,Ds=33778,Ls=33779,Xr=35840,qr=35841,Yr=35842,$r=35843,Kr=36196,Zr=37492,jr=37496,Jr=37808,Qr=37809,ea=37810,ta=37811,na=37812,ia=37813,sa=37814,ra=37815,aa=37816,oa=37817,la=37818,ca=37819,ha=37820,ua=37821,da=36492,fa=36494,pa=36495,ma=36283,ga=36284,_a=36285,va=36286,kc=3200,Hc=3201,Gc=0,Vc=1,Rn="",zt="srgb",Jn="srgb-linear",Os="linear",Je="srgb",ei=7680,Ja=519,Wc=512,Xc=513,qc=514,Tl=515,Yc=516,$c=517,Kc=518,Zc=519,Qa=35044,xi=35048,eo="300 es",nn=2e3,Bs=2001;class Ai{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});const n=this._listeners;n[e]===void 0&&(n[e]=[]),n[e].indexOf(t)===-1&&n[e].push(t)}hasEventListener(e,t){const n=this._listeners;return n===void 0?!1:n[e]!==void 0&&n[e].indexOf(t)!==-1}removeEventListener(e,t){const n=this._listeners;if(n===void 0)return;const s=n[e];if(s!==void 0){const r=s.indexOf(t);r!==-1&&s.splice(r,1)}}dispatchEvent(e){const t=this._listeners;if(t===void 0)return;const n=t[e.type];if(n!==void 0){e.target=this;const s=n.slice(0);for(let r=0,o=s.length;r<o;r++)s[r].call(this,e);e.target=null}}}const xt=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];let to=1234567;const Gi=Math.PI/180,Ki=180/Math.PI;function Ri(){const i=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(xt[i&255]+xt[i>>8&255]+xt[i>>16&255]+xt[i>>24&255]+"-"+xt[e&255]+xt[e>>8&255]+"-"+xt[e>>16&15|64]+xt[e>>24&255]+"-"+xt[t&63|128]+xt[t>>8&255]+"-"+xt[t>>16&255]+xt[t>>24&255]+xt[n&255]+xt[n>>8&255]+xt[n>>16&255]+xt[n>>24&255]).toLowerCase()}function He(i,e,t){return Math.max(e,Math.min(t,i))}function Ca(i,e){return(i%e+e)%e}function jc(i,e,t,n,s){return n+(i-e)*(s-n)/(t-e)}function Jc(i,e,t){return i!==e?(t-i)/(e-i):0}function Vi(i,e,t){return(1-t)*i+t*e}function Qc(i,e,t,n){return Vi(i,e,1-Math.exp(-t*n))}function eh(i,e=1){return e-Math.abs(Ca(i,e*2)-e)}function th(i,e,t){return i<=e?0:i>=t?1:(i=(i-e)/(t-e),i*i*(3-2*i))}function nh(i,e,t){return i<=e?0:i>=t?1:(i=(i-e)/(t-e),i*i*i*(i*(i*6-15)+10))}function ih(i,e){return i+Math.floor(Math.random()*(e-i+1))}function sh(i,e){return i+Math.random()*(e-i)}function rh(i){return i*(.5-Math.random())}function ah(i){i!==void 0&&(to=i);let e=to+=1831565813;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}function oh(i){return i*Gi}function lh(i){return i*Ki}function ch(i){return(i&i-1)===0&&i!==0}function hh(i){return Math.pow(2,Math.ceil(Math.log(i)/Math.LN2))}function uh(i){return Math.pow(2,Math.floor(Math.log(i)/Math.LN2))}function dh(i,e,t,n,s){const r=Math.cos,o=Math.sin,a=r(t/2),l=o(t/2),c=r((e+n)/2),h=o((e+n)/2),u=r((e-n)/2),f=o((e-n)/2),p=r((n-e)/2),_=o((n-e)/2);switch(s){case"XYX":i.set(a*h,l*u,l*f,a*c);break;case"YZY":i.set(l*f,a*h,l*u,a*c);break;case"ZXZ":i.set(l*u,l*f,a*h,a*c);break;case"XZX":i.set(a*h,l*_,l*p,a*c);break;case"YXY":i.set(l*p,a*h,l*_,a*c);break;case"ZYZ":i.set(l*_,l*p,a*h,a*c);break;default:console.warn("THREE.MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+s)}}function mi(i,e){switch(e.constructor){case Float32Array:return i;case Uint32Array:return i/4294967295;case Uint16Array:return i/65535;case Uint8Array:return i/255;case Int32Array:return Math.max(i/2147483647,-1);case Int16Array:return Math.max(i/32767,-1);case Int8Array:return Math.max(i/127,-1);default:throw new Error("Invalid component type.")}}function yt(i,e){switch(e.constructor){case Float32Array:return i;case Uint32Array:return Math.round(i*4294967295);case Uint16Array:return Math.round(i*65535);case Uint8Array:return Math.round(i*255);case Int32Array:return Math.round(i*2147483647);case Int16Array:return Math.round(i*32767);case Int8Array:return Math.round(i*127);default:throw new Error("Invalid component type.")}}const Kt={DEG2RAD:Gi,RAD2DEG:Ki,generateUUID:Ri,clamp:He,euclideanModulo:Ca,mapLinear:jc,inverseLerp:Jc,lerp:Vi,damp:Qc,pingpong:eh,smoothstep:th,smootherstep:nh,randInt:ih,randFloat:sh,randFloatSpread:rh,seededRandom:ah,degToRad:oh,radToDeg:lh,isPowerOfTwo:ch,ceilPowerOfTwo:hh,floorPowerOfTwo:uh,setQuaternionFromProperEuler:dh,normalize:yt,denormalize:mi};class $e{constructor(e=0,t=0){$e.prototype.isVector2=!0,this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){const t=this.x,n=this.y,s=e.elements;return this.x=s[0]*t+s[3]*n+s[6],this.y=s[1]*t+s[4]*n+s[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=He(this.x,e.x,t.x),this.y=He(this.y,e.y,t.y),this}clampScalar(e,t){return this.x=He(this.x,e,t),this.y=He(this.y,e,t),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar(He(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const n=this.dot(e)/t;return Math.acos(He(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,n=this.y-e.y;return t*t+n*n}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){const n=Math.cos(t),s=Math.sin(t),r=this.x-e.x,o=this.y-e.y;return this.x=r*n-o*s+e.x,this.y=r*s+o*n+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}}class Ci{constructor(e=0,t=0,n=0,s=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=n,this._w=s}static slerpFlat(e,t,n,s,r,o,a){let l=n[s+0],c=n[s+1],h=n[s+2],u=n[s+3];const f=r[o+0],p=r[o+1],_=r[o+2],v=r[o+3];if(a===0){e[t+0]=l,e[t+1]=c,e[t+2]=h,e[t+3]=u;return}if(a===1){e[t+0]=f,e[t+1]=p,e[t+2]=_,e[t+3]=v;return}if(u!==v||l!==f||c!==p||h!==_){let m=1-a;const d=l*f+c*p+h*_+u*v,w=d>=0?1:-1,T=1-d*d;if(T>Number.EPSILON){const C=Math.sqrt(T),R=Math.atan2(C,d*w);m=Math.sin(m*R)/C,a=Math.sin(a*R)/C}const M=a*w;if(l=l*m+f*M,c=c*m+p*M,h=h*m+_*M,u=u*m+v*M,m===1-a){const C=1/Math.sqrt(l*l+c*c+h*h+u*u);l*=C,c*=C,h*=C,u*=C}}e[t]=l,e[t+1]=c,e[t+2]=h,e[t+3]=u}static multiplyQuaternionsFlat(e,t,n,s,r,o){const a=n[s],l=n[s+1],c=n[s+2],h=n[s+3],u=r[o],f=r[o+1],p=r[o+2],_=r[o+3];return e[t]=a*_+h*u+l*p-c*f,e[t+1]=l*_+h*f+c*u-a*p,e[t+2]=c*_+h*p+a*f-l*u,e[t+3]=h*_-a*u-l*f-c*p,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,n,s){return this._x=e,this._y=t,this._z=n,this._w=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){const n=e._x,s=e._y,r=e._z,o=e._order,a=Math.cos,l=Math.sin,c=a(n/2),h=a(s/2),u=a(r/2),f=l(n/2),p=l(s/2),_=l(r/2);switch(o){case"XYZ":this._x=f*h*u+c*p*_,this._y=c*p*u-f*h*_,this._z=c*h*_+f*p*u,this._w=c*h*u-f*p*_;break;case"YXZ":this._x=f*h*u+c*p*_,this._y=c*p*u-f*h*_,this._z=c*h*_-f*p*u,this._w=c*h*u+f*p*_;break;case"ZXY":this._x=f*h*u-c*p*_,this._y=c*p*u+f*h*_,this._z=c*h*_+f*p*u,this._w=c*h*u-f*p*_;break;case"ZYX":this._x=f*h*u-c*p*_,this._y=c*p*u+f*h*_,this._z=c*h*_-f*p*u,this._w=c*h*u+f*p*_;break;case"YZX":this._x=f*h*u+c*p*_,this._y=c*p*u+f*h*_,this._z=c*h*_-f*p*u,this._w=c*h*u-f*p*_;break;case"XZY":this._x=f*h*u-c*p*_,this._y=c*p*u-f*h*_,this._z=c*h*_+f*p*u,this._w=c*h*u+f*p*_;break;default:console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: "+o)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){const n=t/2,s=Math.sin(n);return this._x=e.x*s,this._y=e.y*s,this._z=e.z*s,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(e){const t=e.elements,n=t[0],s=t[4],r=t[8],o=t[1],a=t[5],l=t[9],c=t[2],h=t[6],u=t[10],f=n+a+u;if(f>0){const p=.5/Math.sqrt(f+1);this._w=.25/p,this._x=(h-l)*p,this._y=(r-c)*p,this._z=(o-s)*p}else if(n>a&&n>u){const p=2*Math.sqrt(1+n-a-u);this._w=(h-l)/p,this._x=.25*p,this._y=(s+o)/p,this._z=(r+c)/p}else if(a>u){const p=2*Math.sqrt(1+a-n-u);this._w=(r-c)/p,this._x=(s+o)/p,this._y=.25*p,this._z=(l+h)/p}else{const p=2*Math.sqrt(1+u-n-a);this._w=(o-s)/p,this._x=(r+c)/p,this._y=(l+h)/p,this._z=.25*p}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let n=e.dot(t)+1;return n<1e-8?(n=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=n):(this._x=0,this._y=-e.z,this._z=e.y,this._w=n)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=n),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(He(this.dot(e),-1,1)))}rotateTowards(e,t){const n=this.angleTo(e);if(n===0)return this;const s=Math.min(1,t/n);return this.slerp(e,s),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){const n=e._x,s=e._y,r=e._z,o=e._w,a=t._x,l=t._y,c=t._z,h=t._w;return this._x=n*h+o*a+s*c-r*l,this._y=s*h+o*l+r*a-n*c,this._z=r*h+o*c+n*l-s*a,this._w=o*h-n*a-s*l-r*c,this._onChangeCallback(),this}slerp(e,t){if(t===0)return this;if(t===1)return this.copy(e);const n=this._x,s=this._y,r=this._z,o=this._w;let a=o*e._w+n*e._x+s*e._y+r*e._z;if(a<0?(this._w=-e._w,this._x=-e._x,this._y=-e._y,this._z=-e._z,a=-a):this.copy(e),a>=1)return this._w=o,this._x=n,this._y=s,this._z=r,this;const l=1-a*a;if(l<=Number.EPSILON){const p=1-t;return this._w=p*o+t*this._w,this._x=p*n+t*this._x,this._y=p*s+t*this._y,this._z=p*r+t*this._z,this.normalize(),this}const c=Math.sqrt(l),h=Math.atan2(c,a),u=Math.sin((1-t)*h)/c,f=Math.sin(t*h)/c;return this._w=o*u+this._w*f,this._x=n*u+this._x*f,this._y=s*u+this._y*f,this._z=r*u+this._z*f,this._onChangeCallback(),this}slerpQuaternions(e,t,n){return this.copy(e).slerp(t,n)}random(){const e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),n=Math.random(),s=Math.sqrt(1-n),r=Math.sqrt(n);return this.set(s*Math.sin(e),s*Math.cos(e),r*Math.sin(t),r*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}class F{constructor(e=0,t=0,n=0){F.prototype.isVector3=!0,this.x=e,this.y=t,this.z=n}set(e,t,n){return n===void 0&&(n=this.z),this.x=e,this.y=t,this.z=n,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(no.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(no.setFromAxisAngle(e,t))}applyMatrix3(e){const t=this.x,n=this.y,s=this.z,r=e.elements;return this.x=r[0]*t+r[3]*n+r[6]*s,this.y=r[1]*t+r[4]*n+r[7]*s,this.z=r[2]*t+r[5]*n+r[8]*s,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){const t=this.x,n=this.y,s=this.z,r=e.elements,o=1/(r[3]*t+r[7]*n+r[11]*s+r[15]);return this.x=(r[0]*t+r[4]*n+r[8]*s+r[12])*o,this.y=(r[1]*t+r[5]*n+r[9]*s+r[13])*o,this.z=(r[2]*t+r[6]*n+r[10]*s+r[14])*o,this}applyQuaternion(e){const t=this.x,n=this.y,s=this.z,r=e.x,o=e.y,a=e.z,l=e.w,c=2*(o*s-a*n),h=2*(a*t-r*s),u=2*(r*n-o*t);return this.x=t+l*c+o*u-a*h,this.y=n+l*h+a*c-r*u,this.z=s+l*u+r*h-o*c,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){const t=this.x,n=this.y,s=this.z,r=e.elements;return this.x=r[0]*t+r[4]*n+r[8]*s,this.y=r[1]*t+r[5]*n+r[9]*s,this.z=r[2]*t+r[6]*n+r[10]*s,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=He(this.x,e.x,t.x),this.y=He(this.y,e.y,t.y),this.z=He(this.z,e.z,t.z),this}clampScalar(e,t){return this.x=He(this.x,e,t),this.y=He(this.y,e,t),this.z=He(this.z,e,t),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar(He(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){const n=e.x,s=e.y,r=e.z,o=t.x,a=t.y,l=t.z;return this.x=s*l-r*a,this.y=r*o-n*l,this.z=n*a-s*o,this}projectOnVector(e){const t=e.lengthSq();if(t===0)return this.set(0,0,0);const n=e.dot(this)/t;return this.copy(e).multiplyScalar(n)}projectOnPlane(e){return js.copy(this).projectOnVector(e),this.sub(js)}reflect(e){return this.sub(js.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const n=this.dot(e)/t;return Math.acos(He(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,n=this.y-e.y,s=this.z-e.z;return t*t+n*n+s*s}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,n){const s=Math.sin(t)*e;return this.x=s*Math.sin(n),this.y=Math.cos(t)*e,this.z=s*Math.cos(n),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,n){return this.x=e*Math.sin(t),this.y=n,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){const t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){const t=this.setFromMatrixColumn(e,0).length(),n=this.setFromMatrixColumn(e,1).length(),s=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=n,this.z=s,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){const e=Math.random()*Math.PI*2,t=Math.random()*2-1,n=Math.sqrt(1-t*t);return this.x=n*Math.cos(e),this.y=t,this.z=n*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}}const js=new F,no=new Ci;class Fe{constructor(e,t,n,s,r,o,a,l,c){Fe.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,n,s,r,o,a,l,c)}set(e,t,n,s,r,o,a,l,c){const h=this.elements;return h[0]=e,h[1]=s,h[2]=a,h[3]=t,h[4]=r,h[5]=l,h[6]=n,h[7]=o,h[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){const t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],this}extractBasis(e,t,n){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(e){const t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const n=e.elements,s=t.elements,r=this.elements,o=n[0],a=n[3],l=n[6],c=n[1],h=n[4],u=n[7],f=n[2],p=n[5],_=n[8],v=s[0],m=s[3],d=s[6],w=s[1],T=s[4],M=s[7],C=s[2],R=s[5],P=s[8];return r[0]=o*v+a*w+l*C,r[3]=o*m+a*T+l*R,r[6]=o*d+a*M+l*P,r[1]=c*v+h*w+u*C,r[4]=c*m+h*T+u*R,r[7]=c*d+h*M+u*P,r[2]=f*v+p*w+_*C,r[5]=f*m+p*T+_*R,r[8]=f*d+p*M+_*P,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){const e=this.elements,t=e[0],n=e[1],s=e[2],r=e[3],o=e[4],a=e[5],l=e[6],c=e[7],h=e[8];return t*o*h-t*a*c-n*r*h+n*a*l+s*r*c-s*o*l}invert(){const e=this.elements,t=e[0],n=e[1],s=e[2],r=e[3],o=e[4],a=e[5],l=e[6],c=e[7],h=e[8],u=h*o-a*c,f=a*l-h*r,p=c*r-o*l,_=t*u+n*f+s*p;if(_===0)return this.set(0,0,0,0,0,0,0,0,0);const v=1/_;return e[0]=u*v,e[1]=(s*c-h*n)*v,e[2]=(a*n-s*o)*v,e[3]=f*v,e[4]=(h*t-s*l)*v,e[5]=(s*r-a*t)*v,e[6]=p*v,e[7]=(n*l-c*t)*v,e[8]=(o*t-n*r)*v,this}transpose(){let e;const t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){const t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,n,s,r,o,a){const l=Math.cos(r),c=Math.sin(r);return this.set(n*l,n*c,-n*(l*o+c*a)+o+e,-s*c,s*l,-s*(-c*o+l*a)+a+t,0,0,1),this}scale(e,t){return this.premultiply(Js.makeScale(e,t)),this}rotate(e){return this.premultiply(Js.makeRotation(-e)),this}translate(e,t){return this.premultiply(Js.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,n,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){const t=this.elements,n=e.elements;for(let s=0;s<9;s++)if(t[s]!==n[s])return!1;return!0}fromArray(e,t=0){for(let n=0;n<9;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){const n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e}clone(){return new this.constructor().fromArray(this.elements)}}const Js=new Fe;function bl(i){for(let e=i.length-1;e>=0;--e)if(i[e]>=65535)return!0;return!1}function zs(i){return document.createElementNS("http://www.w3.org/1999/xhtml",i)}function fh(){const i=zs("canvas");return i.style.display="block",i}const io={};function Zi(i){i in io||(io[i]=!0,console.warn(i))}function ph(i,e,t){return new Promise(function(n,s){function r(){switch(i.clientWaitSync(e,i.SYNC_FLUSH_COMMANDS_BIT,0)){case i.WAIT_FAILED:s();break;case i.TIMEOUT_EXPIRED:setTimeout(r,t);break;default:n()}}setTimeout(r,t)})}const so=new Fe().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),ro=new Fe().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function mh(){const i={enabled:!0,workingColorSpace:Jn,spaces:{},convert:function(s,r,o){return this.enabled===!1||r===o||!r||!o||(this.spaces[r].transfer===Je&&(s.r=pn(s.r),s.g=pn(s.g),s.b=pn(s.b)),this.spaces[r].primaries!==this.spaces[o].primaries&&(s.applyMatrix3(this.spaces[r].toXYZ),s.applyMatrix3(this.spaces[o].fromXYZ)),this.spaces[o].transfer===Je&&(s.r=Mi(s.r),s.g=Mi(s.g),s.b=Mi(s.b))),s},workingToColorSpace:function(s,r){return this.convert(s,this.workingColorSpace,r)},colorSpaceToWorking:function(s,r){return this.convert(s,r,this.workingColorSpace)},getPrimaries:function(s){return this.spaces[s].primaries},getTransfer:function(s){return s===Rn?Os:this.spaces[s].transfer},getToneMappingMode:function(s){return this.spaces[s].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(s,r=this.workingColorSpace){return s.fromArray(this.spaces[r].luminanceCoefficients)},define:function(s){Object.assign(this.spaces,s)},_getMatrix:function(s,r,o){return s.copy(this.spaces[r].toXYZ).multiply(this.spaces[o].fromXYZ)},_getDrawingBufferColorSpace:function(s){return this.spaces[s].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(s=this.workingColorSpace){return this.spaces[s].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(s,r){return Zi("THREE.ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),i.workingToColorSpace(s,r)},toWorkingColorSpace:function(s,r){return Zi("THREE.ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),i.colorSpaceToWorking(s,r)}},e=[.64,.33,.3,.6,.15,.06],t=[.2126,.7152,.0722],n=[.3127,.329];return i.define({[Jn]:{primaries:e,whitePoint:n,transfer:Os,toXYZ:so,fromXYZ:ro,luminanceCoefficients:t,workingColorSpaceConfig:{unpackColorSpace:zt},outputColorSpaceConfig:{drawingBufferColorSpace:zt}},[zt]:{primaries:e,whitePoint:n,transfer:Je,toXYZ:so,fromXYZ:ro,luminanceCoefficients:t,outputColorSpaceConfig:{drawingBufferColorSpace:zt}}}),i}const Ve=mh();function pn(i){return i<.04045?i*.0773993808:Math.pow(i*.9478672986+.0521327014,2.4)}function Mi(i){return i<.0031308?i*12.92:1.055*Math.pow(i,.41666)-.055}let ti;class gh{static getDataURL(e,t="image/png"){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let n;if(e instanceof HTMLCanvasElement)n=e;else{ti===void 0&&(ti=zs("canvas")),ti.width=e.width,ti.height=e.height;const s=ti.getContext("2d");e instanceof ImageData?s.putImageData(e,0,0):s.drawImage(e,0,0,e.width,e.height),n=ti}return n.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){const t=zs("canvas");t.width=e.width,t.height=e.height;const n=t.getContext("2d");n.drawImage(e,0,0,e.width,e.height);const s=n.getImageData(0,0,e.width,e.height),r=s.data;for(let o=0;o<r.length;o++)r[o]=pn(r[o]/255)*255;return n.putImageData(s,0,0),t}else if(e.data){const t=e.data.slice(0);for(let n=0;n<t.length;n++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[n]=Math.floor(pn(t[n]/255)*255):t[n]=pn(t[n]);return{data:t,width:e.width,height:e.height}}else return console.warn("THREE.ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}}let _h=0;class Pa{constructor(e=null){this.isSource=!0,Object.defineProperty(this,"id",{value:_h++}),this.uuid=Ri(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){const t=this.data;return typeof HTMLVideoElement<"u"&&t instanceof HTMLVideoElement?e.set(t.videoWidth,t.videoHeight,0):t instanceof VideoFrame?e.set(t.displayHeight,t.displayWidth,0):t!==null?e.set(t.width,t.height,t.depth||0):e.set(0,0,0),e}set needsUpdate(e){e===!0&&this.version++}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];const n={uuid:this.uuid,url:""},s=this.data;if(s!==null){let r;if(Array.isArray(s)){r=[];for(let o=0,a=s.length;o<a;o++)s[o].isDataTexture?r.push(Qs(s[o].image)):r.push(Qs(s[o]))}else r=Qs(s);n.url=r}return t||(e.images[this.uuid]=n),n}}function Qs(i){return typeof HTMLImageElement<"u"&&i instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&i instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&i instanceof ImageBitmap?gh.getDataURL(i):i.data?{data:Array.from(i.data),width:i.width,height:i.height,type:i.data.constructor.name}:(console.warn("THREE.Texture: Unable to serialize Texture."),{})}let vh=0;const er=new F;class vt extends Ai{constructor(e=vt.DEFAULT_IMAGE,t=vt.DEFAULT_MAPPING,n=$n,s=$n,r=tn,o=Kn,a=Gt,l=mn,c=vt.DEFAULT_ANISOTROPY,h=Rn){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:vh++}),this.uuid=Ri(),this.name="",this.source=new Pa(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=n,this.wrapT=s,this.magFilter=r,this.minFilter=o,this.anisotropy=c,this.format=a,this.internalFormat=null,this.type=l,this.offset=new $e(0,0),this.repeat=new $e(1,1),this.center=new $e(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Fe,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(e&&e.depth&&e.depth>1),this.pmremVersion=0}get width(){return this.source.getSize(er).x}get height(){return this.source.getSize(er).y}get depth(){return this.source.getSize(er).z}get image(){return this.source.data}set image(e=null){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(const t in e){const n=e[t];if(n===void 0){console.warn(`THREE.Texture.setValues(): parameter '${t}' has value of undefined.`);continue}const s=this[t];if(s===void 0){console.warn(`THREE.Texture.setValues(): property '${t}' does not exist.`);continue}s&&n&&s.isVector2&&n.isVector2||s&&n&&s.isVector3&&n.isVector3||s&&n&&s.isMatrix3&&n.isMatrix3?s.copy(n):this[t]=n}}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];const n={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),t||(e.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==ml)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case Vr:e.x=e.x-Math.floor(e.x);break;case $n:e.x=e.x<0?0:1;break;case Wr:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case Vr:e.y=e.y-Math.floor(e.y);break;case $n:e.y=e.y<0?0:1;break;case Wr:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}}vt.DEFAULT_IMAGE=null;vt.DEFAULT_MAPPING=ml;vt.DEFAULT_ANISOTROPY=1;class ct{constructor(e=0,t=0,n=0,s=1){ct.prototype.isVector4=!0,this.x=e,this.y=t,this.z=n,this.w=s}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,n,s){return this.x=e,this.y=t,this.z=n,this.w=s,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){const t=this.x,n=this.y,s=this.z,r=this.w,o=e.elements;return this.x=o[0]*t+o[4]*n+o[8]*s+o[12]*r,this.y=o[1]*t+o[5]*n+o[9]*s+o[13]*r,this.z=o[2]*t+o[6]*n+o[10]*s+o[14]*r,this.w=o[3]*t+o[7]*n+o[11]*s+o[15]*r,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);const t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,n,s,r;const l=e.elements,c=l[0],h=l[4],u=l[8],f=l[1],p=l[5],_=l[9],v=l[2],m=l[6],d=l[10];if(Math.abs(h-f)<.01&&Math.abs(u-v)<.01&&Math.abs(_-m)<.01){if(Math.abs(h+f)<.1&&Math.abs(u+v)<.1&&Math.abs(_+m)<.1&&Math.abs(c+p+d-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;const T=(c+1)/2,M=(p+1)/2,C=(d+1)/2,R=(h+f)/4,P=(u+v)/4,N=(_+m)/4;return T>M&&T>C?T<.01?(n=0,s=.707106781,r=.707106781):(n=Math.sqrt(T),s=R/n,r=P/n):M>C?M<.01?(n=.707106781,s=0,r=.707106781):(s=Math.sqrt(M),n=R/s,r=N/s):C<.01?(n=.707106781,s=.707106781,r=0):(r=Math.sqrt(C),n=P/r,s=N/r),this.set(n,s,r,t),this}let w=Math.sqrt((m-_)*(m-_)+(u-v)*(u-v)+(f-h)*(f-h));return Math.abs(w)<.001&&(w=1),this.x=(m-_)/w,this.y=(u-v)/w,this.z=(f-h)/w,this.w=Math.acos((c+p+d-1)/2),this}setFromMatrixPosition(e){const t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=He(this.x,e.x,t.x),this.y=He(this.y,e.y,t.y),this.z=He(this.z,e.z,t.z),this.w=He(this.w,e.w,t.w),this}clampScalar(e,t){return this.x=He(this.x,e,t),this.y=He(this.y,e,t),this.z=He(this.z,e,t),this.w=He(this.w,e,t),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar(He(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this.w=e.w+(t.w-e.w)*n,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}}class xh extends Ai{constructor(e=1,t=1,n={}){super(),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:tn,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1},n),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=n.depth,this.scissor=new ct(0,0,e,t),this.scissorTest=!1,this.viewport=new ct(0,0,e,t);const s={width:e,height:t,depth:n.depth},r=new vt(s);this.textures=[];const o=n.count;for(let a=0;a<o;a++)this.textures[a]=r.clone(),this.textures[a].isRenderTargetTexture=!0,this.textures[a].renderTarget=this;this._setTextureOptions(n),this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this._depthTexture=null,this.depthTexture=n.depthTexture,this.samples=n.samples,this.multiview=n.multiview}_setTextureOptions(e={}){const t={minFilter:tn,generateMipmaps:!1,flipY:!1,internalFormat:null};e.mapping!==void 0&&(t.mapping=e.mapping),e.wrapS!==void 0&&(t.wrapS=e.wrapS),e.wrapT!==void 0&&(t.wrapT=e.wrapT),e.wrapR!==void 0&&(t.wrapR=e.wrapR),e.magFilter!==void 0&&(t.magFilter=e.magFilter),e.minFilter!==void 0&&(t.minFilter=e.minFilter),e.format!==void 0&&(t.format=e.format),e.type!==void 0&&(t.type=e.type),e.anisotropy!==void 0&&(t.anisotropy=e.anisotropy),e.colorSpace!==void 0&&(t.colorSpace=e.colorSpace),e.flipY!==void 0&&(t.flipY=e.flipY),e.generateMipmaps!==void 0&&(t.generateMipmaps=e.generateMipmaps),e.internalFormat!==void 0&&(t.internalFormat=e.internalFormat);for(let n=0;n<this.textures.length;n++)this.textures[n].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){this._depthTexture!==null&&(this._depthTexture.renderTarget=null),e!==null&&(e.renderTarget=this),this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,n=1){if(this.width!==e||this.height!==t||this.depth!==n){this.width=e,this.height=t,this.depth=n;for(let s=0,r=this.textures.length;s<r;s++)this.textures[s].image.width=e,this.textures[s].image.height=t,this.textures[s].image.depth=n,this.textures[s].isArrayTexture=this.textures[s].image.depth>1;this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,n=e.textures.length;t<n;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;const s=Object.assign({},e.textures[t].image);this.textures[t].source=new Pa(s)}return this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,e.depthTexture!==null&&(this.depthTexture=e.depthTexture.clone()),this.samples=e.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}}class In extends xh{constructor(e=1,t=1,n={}){super(e,t,n),this.isWebGLRenderTarget=!0}}class wl extends vt{constructor(e=null,t=1,n=1,s=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:n,depth:s},this.magFilter=ht,this.minFilter=ht,this.wrapR=$n,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}}class Mh extends vt{constructor(e=null,t=1,n=1,s=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:n,depth:s},this.magFilter=ht,this.minFilter=ht,this.wrapR=$n,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class Ji{constructor(e=new F(1/0,1/0,1/0),t=new F(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t+=3)this.expandByPoint(Xt.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,n=e.count;t<n;t++)this.expandByPoint(Xt.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){const n=Xt.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);const n=e.geometry;if(n!==void 0){const r=n.getAttribute("position");if(t===!0&&r!==void 0&&e.isInstancedMesh!==!0)for(let o=0,a=r.count;o<a;o++)e.isMesh===!0?e.getVertexPosition(o,Xt):Xt.fromBufferAttribute(r,o),Xt.applyMatrix4(e.matrixWorld),this.expandByPoint(Xt);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),ss.copy(e.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),ss.copy(n.boundingBox)),ss.applyMatrix4(e.matrixWorld),this.union(ss)}const s=e.children;for(let r=0,o=s.length;r<o;r++)this.expandByObject(s[r],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,Xt),Xt.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,n;return e.normal.x>0?(t=e.normal.x*this.min.x,n=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,n=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,n+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,n+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,n+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,n+=e.normal.z*this.min.z),t<=-e.constant&&n>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(Ui),rs.subVectors(this.max,Ui),ni.subVectors(e.a,Ui),ii.subVectors(e.b,Ui),si.subVectors(e.c,Ui),_n.subVectors(ii,ni),vn.subVectors(si,ii),Bn.subVectors(ni,si);let t=[0,-_n.z,_n.y,0,-vn.z,vn.y,0,-Bn.z,Bn.y,_n.z,0,-_n.x,vn.z,0,-vn.x,Bn.z,0,-Bn.x,-_n.y,_n.x,0,-vn.y,vn.x,0,-Bn.y,Bn.x,0];return!tr(t,ni,ii,si,rs)||(t=[1,0,0,0,1,0,0,0,1],!tr(t,ni,ii,si,rs))?!1:(as.crossVectors(_n,vn),t=[as.x,as.y,as.z],tr(t,ni,ii,si,rs))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,Xt).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(Xt).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(on[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),on[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),on[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),on[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),on[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),on[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),on[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),on[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(on),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}}const on=[new F,new F,new F,new F,new F,new F,new F,new F],Xt=new F,ss=new Ji,ni=new F,ii=new F,si=new F,_n=new F,vn=new F,Bn=new F,Ui=new F,rs=new F,as=new F,zn=new F;function tr(i,e,t,n,s){for(let r=0,o=i.length-3;r<=o;r+=3){zn.fromArray(i,r);const a=s.x*Math.abs(zn.x)+s.y*Math.abs(zn.y)+s.z*Math.abs(zn.z),l=e.dot(zn),c=t.dot(zn),h=n.dot(zn);if(Math.max(-Math.max(l,c,h),Math.min(l,c,h))>a)return!1}return!0}const Sh=new Ji,Ii=new F,nr=new F;class Qi{constructor(e=new F,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){const n=this.center;t!==void 0?n.copy(t):Sh.setFromPoints(e).getCenter(n);let s=0;for(let r=0,o=e.length;r<o;r++)s=Math.max(s,n.distanceToSquared(e[r]));return this.radius=Math.sqrt(s),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){const t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){const n=this.center.distanceToSquared(e);return t.copy(e),n>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;Ii.subVectors(e,this.center);const t=Ii.lengthSq();if(t>this.radius*this.radius){const n=Math.sqrt(t),s=(n-this.radius)*.5;this.center.addScaledVector(Ii,s/n),this.radius+=s}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(nr.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(Ii.copy(e.center).add(nr)),this.expandByPoint(Ii.copy(e.center).sub(nr))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}}const ln=new F,ir=new F,os=new F,xn=new F,sr=new F,ls=new F,rr=new F;class Da{constructor(e=new F,t=new F(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,ln)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);const n=t.dot(this.direction);return n<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){const t=ln.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(ln.copy(this.origin).addScaledVector(this.direction,t),ln.distanceToSquared(e))}distanceSqToSegment(e,t,n,s){ir.copy(e).add(t).multiplyScalar(.5),os.copy(t).sub(e).normalize(),xn.copy(this.origin).sub(ir);const r=e.distanceTo(t)*.5,o=-this.direction.dot(os),a=xn.dot(this.direction),l=-xn.dot(os),c=xn.lengthSq(),h=Math.abs(1-o*o);let u,f,p,_;if(h>0)if(u=o*l-a,f=o*a-l,_=r*h,u>=0)if(f>=-_)if(f<=_){const v=1/h;u*=v,f*=v,p=u*(u+o*f+2*a)+f*(o*u+f+2*l)+c}else f=r,u=Math.max(0,-(o*f+a)),p=-u*u+f*(f+2*l)+c;else f=-r,u=Math.max(0,-(o*f+a)),p=-u*u+f*(f+2*l)+c;else f<=-_?(u=Math.max(0,-(-o*r+a)),f=u>0?-r:Math.min(Math.max(-r,-l),r),p=-u*u+f*(f+2*l)+c):f<=_?(u=0,f=Math.min(Math.max(-r,-l),r),p=f*(f+2*l)+c):(u=Math.max(0,-(o*r+a)),f=u>0?r:Math.min(Math.max(-r,-l),r),p=-u*u+f*(f+2*l)+c);else f=o>0?-r:r,u=Math.max(0,-(o*f+a)),p=-u*u+f*(f+2*l)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,u),s&&s.copy(ir).addScaledVector(os,f),p}intersectSphere(e,t){ln.subVectors(e.center,this.origin);const n=ln.dot(this.direction),s=ln.dot(ln)-n*n,r=e.radius*e.radius;if(s>r)return null;const o=Math.sqrt(r-s),a=n-o,l=n+o;return l<0?null:a<0?this.at(l,t):this.at(a,t)}intersectsSphere(e){return e.radius<0?!1:this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){const t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;const n=-(this.origin.dot(e.normal)+e.constant)/t;return n>=0?n:null}intersectPlane(e,t){const n=this.distanceToPlane(e);return n===null?null:this.at(n,t)}intersectsPlane(e){const t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let n,s,r,o,a,l;const c=1/this.direction.x,h=1/this.direction.y,u=1/this.direction.z,f=this.origin;return c>=0?(n=(e.min.x-f.x)*c,s=(e.max.x-f.x)*c):(n=(e.max.x-f.x)*c,s=(e.min.x-f.x)*c),h>=0?(r=(e.min.y-f.y)*h,o=(e.max.y-f.y)*h):(r=(e.max.y-f.y)*h,o=(e.min.y-f.y)*h),n>o||r>s||((r>n||isNaN(n))&&(n=r),(o<s||isNaN(s))&&(s=o),u>=0?(a=(e.min.z-f.z)*u,l=(e.max.z-f.z)*u):(a=(e.max.z-f.z)*u,l=(e.min.z-f.z)*u),n>l||a>s)||((a>n||n!==n)&&(n=a),(l<s||s!==s)&&(s=l),s<0)?null:this.at(n>=0?n:s,t)}intersectsBox(e){return this.intersectBox(e,ln)!==null}intersectTriangle(e,t,n,s,r){sr.subVectors(t,e),ls.subVectors(n,e),rr.crossVectors(sr,ls);let o=this.direction.dot(rr),a;if(o>0){if(s)return null;a=1}else if(o<0)a=-1,o=-o;else return null;xn.subVectors(this.origin,e);const l=a*this.direction.dot(ls.crossVectors(xn,ls));if(l<0)return null;const c=a*this.direction.dot(sr.cross(xn));if(c<0||l+c>o)return null;const h=-a*xn.dot(rr);return h<0?null:this.at(h/o,r)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class ut{constructor(e,t,n,s,r,o,a,l,c,h,u,f,p,_,v,m){ut.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,n,s,r,o,a,l,c,h,u,f,p,_,v,m)}set(e,t,n,s,r,o,a,l,c,h,u,f,p,_,v,m){const d=this.elements;return d[0]=e,d[4]=t,d[8]=n,d[12]=s,d[1]=r,d[5]=o,d[9]=a,d[13]=l,d[2]=c,d[6]=h,d[10]=u,d[14]=f,d[3]=p,d[7]=_,d[11]=v,d[15]=m,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new ut().fromArray(this.elements)}copy(e){const t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],this}copyPosition(e){const t=this.elements,n=e.elements;return t[12]=n[12],t[13]=n[13],t[14]=n[14],this}setFromMatrix3(e){const t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,n){return e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this}makeBasis(e,t,n){return this.set(e.x,t.x,n.x,0,e.y,t.y,n.y,0,e.z,t.z,n.z,0,0,0,0,1),this}extractRotation(e){const t=this.elements,n=e.elements,s=1/ri.setFromMatrixColumn(e,0).length(),r=1/ri.setFromMatrixColumn(e,1).length(),o=1/ri.setFromMatrixColumn(e,2).length();return t[0]=n[0]*s,t[1]=n[1]*s,t[2]=n[2]*s,t[3]=0,t[4]=n[4]*r,t[5]=n[5]*r,t[6]=n[6]*r,t[7]=0,t[8]=n[8]*o,t[9]=n[9]*o,t[10]=n[10]*o,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){const t=this.elements,n=e.x,s=e.y,r=e.z,o=Math.cos(n),a=Math.sin(n),l=Math.cos(s),c=Math.sin(s),h=Math.cos(r),u=Math.sin(r);if(e.order==="XYZ"){const f=o*h,p=o*u,_=a*h,v=a*u;t[0]=l*h,t[4]=-l*u,t[8]=c,t[1]=p+_*c,t[5]=f-v*c,t[9]=-a*l,t[2]=v-f*c,t[6]=_+p*c,t[10]=o*l}else if(e.order==="YXZ"){const f=l*h,p=l*u,_=c*h,v=c*u;t[0]=f+v*a,t[4]=_*a-p,t[8]=o*c,t[1]=o*u,t[5]=o*h,t[9]=-a,t[2]=p*a-_,t[6]=v+f*a,t[10]=o*l}else if(e.order==="ZXY"){const f=l*h,p=l*u,_=c*h,v=c*u;t[0]=f-v*a,t[4]=-o*u,t[8]=_+p*a,t[1]=p+_*a,t[5]=o*h,t[9]=v-f*a,t[2]=-o*c,t[6]=a,t[10]=o*l}else if(e.order==="ZYX"){const f=o*h,p=o*u,_=a*h,v=a*u;t[0]=l*h,t[4]=_*c-p,t[8]=f*c+v,t[1]=l*u,t[5]=v*c+f,t[9]=p*c-_,t[2]=-c,t[6]=a*l,t[10]=o*l}else if(e.order==="YZX"){const f=o*l,p=o*c,_=a*l,v=a*c;t[0]=l*h,t[4]=v-f*u,t[8]=_*u+p,t[1]=u,t[5]=o*h,t[9]=-a*h,t[2]=-c*h,t[6]=p*u+_,t[10]=f-v*u}else if(e.order==="XZY"){const f=o*l,p=o*c,_=a*l,v=a*c;t[0]=l*h,t[4]=-u,t[8]=c*h,t[1]=f*u+v,t[5]=o*h,t[9]=p*u-_,t[2]=_*u-p,t[6]=a*h,t[10]=v*u+f}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(Eh,e,yh)}lookAt(e,t,n){const s=this.elements;return Lt.subVectors(e,t),Lt.lengthSq()===0&&(Lt.z=1),Lt.normalize(),Mn.crossVectors(n,Lt),Mn.lengthSq()===0&&(Math.abs(n.z)===1?Lt.x+=1e-4:Lt.z+=1e-4,Lt.normalize(),Mn.crossVectors(n,Lt)),Mn.normalize(),cs.crossVectors(Lt,Mn),s[0]=Mn.x,s[4]=cs.x,s[8]=Lt.x,s[1]=Mn.y,s[5]=cs.y,s[9]=Lt.y,s[2]=Mn.z,s[6]=cs.z,s[10]=Lt.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const n=e.elements,s=t.elements,r=this.elements,o=n[0],a=n[4],l=n[8],c=n[12],h=n[1],u=n[5],f=n[9],p=n[13],_=n[2],v=n[6],m=n[10],d=n[14],w=n[3],T=n[7],M=n[11],C=n[15],R=s[0],P=s[4],N=s[8],E=s[12],S=s[1],L=s[5],k=s[9],X=s[13],Z=s[2],Y=s[6],G=s[10],A=s[14],W=s[3],ie=s[7],ue=s[11],xe=s[15];return r[0]=o*R+a*S+l*Z+c*W,r[4]=o*P+a*L+l*Y+c*ie,r[8]=o*N+a*k+l*G+c*ue,r[12]=o*E+a*X+l*A+c*xe,r[1]=h*R+u*S+f*Z+p*W,r[5]=h*P+u*L+f*Y+p*ie,r[9]=h*N+u*k+f*G+p*ue,r[13]=h*E+u*X+f*A+p*xe,r[2]=_*R+v*S+m*Z+d*W,r[6]=_*P+v*L+m*Y+d*ie,r[10]=_*N+v*k+m*G+d*ue,r[14]=_*E+v*X+m*A+d*xe,r[3]=w*R+T*S+M*Z+C*W,r[7]=w*P+T*L+M*Y+C*ie,r[11]=w*N+T*k+M*G+C*ue,r[15]=w*E+T*X+M*A+C*xe,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){const e=this.elements,t=e[0],n=e[4],s=e[8],r=e[12],o=e[1],a=e[5],l=e[9],c=e[13],h=e[2],u=e[6],f=e[10],p=e[14],_=e[3],v=e[7],m=e[11],d=e[15];return _*(+r*l*u-s*c*u-r*a*f+n*c*f+s*a*p-n*l*p)+v*(+t*l*p-t*c*f+r*o*f-s*o*p+s*c*h-r*l*h)+m*(+t*c*u-t*a*p-r*o*u+n*o*p+r*a*h-n*c*h)+d*(-s*a*h-t*l*u+t*a*f+s*o*u-n*o*f+n*l*h)}transpose(){const e=this.elements;let t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,n){const s=this.elements;return e.isVector3?(s[12]=e.x,s[13]=e.y,s[14]=e.z):(s[12]=e,s[13]=t,s[14]=n),this}invert(){const e=this.elements,t=e[0],n=e[1],s=e[2],r=e[3],o=e[4],a=e[5],l=e[6],c=e[7],h=e[8],u=e[9],f=e[10],p=e[11],_=e[12],v=e[13],m=e[14],d=e[15],w=u*m*c-v*f*c+v*l*p-a*m*p-u*l*d+a*f*d,T=_*f*c-h*m*c-_*l*p+o*m*p+h*l*d-o*f*d,M=h*v*c-_*u*c+_*a*p-o*v*p-h*a*d+o*u*d,C=_*u*l-h*v*l-_*a*f+o*v*f+h*a*m-o*u*m,R=t*w+n*T+s*M+r*C;if(R===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);const P=1/R;return e[0]=w*P,e[1]=(v*f*r-u*m*r-v*s*p+n*m*p+u*s*d-n*f*d)*P,e[2]=(a*m*r-v*l*r+v*s*c-n*m*c-a*s*d+n*l*d)*P,e[3]=(u*l*r-a*f*r-u*s*c+n*f*c+a*s*p-n*l*p)*P,e[4]=T*P,e[5]=(h*m*r-_*f*r+_*s*p-t*m*p-h*s*d+t*f*d)*P,e[6]=(_*l*r-o*m*r-_*s*c+t*m*c+o*s*d-t*l*d)*P,e[7]=(o*f*r-h*l*r+h*s*c-t*f*c-o*s*p+t*l*p)*P,e[8]=M*P,e[9]=(_*u*r-h*v*r-_*n*p+t*v*p+h*n*d-t*u*d)*P,e[10]=(o*v*r-_*a*r+_*n*c-t*v*c-o*n*d+t*a*d)*P,e[11]=(h*a*r-o*u*r-h*n*c+t*u*c+o*n*p-t*a*p)*P,e[12]=C*P,e[13]=(h*v*s-_*u*s+_*n*f-t*v*f-h*n*m+t*u*m)*P,e[14]=(_*a*s-o*v*s-_*n*l+t*v*l+o*n*m-t*a*m)*P,e[15]=(o*u*s-h*a*s+h*n*l-t*u*l-o*n*f+t*a*f)*P,this}scale(e){const t=this.elements,n=e.x,s=e.y,r=e.z;return t[0]*=n,t[4]*=s,t[8]*=r,t[1]*=n,t[5]*=s,t[9]*=r,t[2]*=n,t[6]*=s,t[10]*=r,t[3]*=n,t[7]*=s,t[11]*=r,this}getMaxScaleOnAxis(){const e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],n=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],s=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,n,s))}makeTranslation(e,t,n){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,n,0,0,0,1),this}makeRotationX(e){const t=Math.cos(e),n=Math.sin(e);return this.set(1,0,0,0,0,t,-n,0,0,n,t,0,0,0,0,1),this}makeRotationY(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,0,n,0,0,1,0,0,-n,0,t,0,0,0,0,1),this}makeRotationZ(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,0,n,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){const n=Math.cos(t),s=Math.sin(t),r=1-n,o=e.x,a=e.y,l=e.z,c=r*o,h=r*a;return this.set(c*o+n,c*a-s*l,c*l+s*a,0,c*a+s*l,h*a+n,h*l-s*o,0,c*l-s*a,h*l+s*o,r*l*l+n,0,0,0,0,1),this}makeScale(e,t,n){return this.set(e,0,0,0,0,t,0,0,0,0,n,0,0,0,0,1),this}makeShear(e,t,n,s,r,o){return this.set(1,n,r,0,e,1,o,0,t,s,1,0,0,0,0,1),this}compose(e,t,n){const s=this.elements,r=t._x,o=t._y,a=t._z,l=t._w,c=r+r,h=o+o,u=a+a,f=r*c,p=r*h,_=r*u,v=o*h,m=o*u,d=a*u,w=l*c,T=l*h,M=l*u,C=n.x,R=n.y,P=n.z;return s[0]=(1-(v+d))*C,s[1]=(p+M)*C,s[2]=(_-T)*C,s[3]=0,s[4]=(p-M)*R,s[5]=(1-(f+d))*R,s[6]=(m+w)*R,s[7]=0,s[8]=(_+T)*P,s[9]=(m-w)*P,s[10]=(1-(f+v))*P,s[11]=0,s[12]=e.x,s[13]=e.y,s[14]=e.z,s[15]=1,this}decompose(e,t,n){const s=this.elements;let r=ri.set(s[0],s[1],s[2]).length();const o=ri.set(s[4],s[5],s[6]).length(),a=ri.set(s[8],s[9],s[10]).length();this.determinant()<0&&(r=-r),e.x=s[12],e.y=s[13],e.z=s[14],qt.copy(this);const c=1/r,h=1/o,u=1/a;return qt.elements[0]*=c,qt.elements[1]*=c,qt.elements[2]*=c,qt.elements[4]*=h,qt.elements[5]*=h,qt.elements[6]*=h,qt.elements[8]*=u,qt.elements[9]*=u,qt.elements[10]*=u,t.setFromRotationMatrix(qt),n.x=r,n.y=o,n.z=a,this}makePerspective(e,t,n,s,r,o,a=nn,l=!1){const c=this.elements,h=2*r/(t-e),u=2*r/(n-s),f=(t+e)/(t-e),p=(n+s)/(n-s);let _,v;if(l)_=r/(o-r),v=o*r/(o-r);else if(a===nn)_=-(o+r)/(o-r),v=-2*o*r/(o-r);else if(a===Bs)_=-o/(o-r),v=-o*r/(o-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+a);return c[0]=h,c[4]=0,c[8]=f,c[12]=0,c[1]=0,c[5]=u,c[9]=p,c[13]=0,c[2]=0,c[6]=0,c[10]=_,c[14]=v,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(e,t,n,s,r,o,a=nn,l=!1){const c=this.elements,h=2/(t-e),u=2/(n-s),f=-(t+e)/(t-e),p=-(n+s)/(n-s);let _,v;if(l)_=1/(o-r),v=o/(o-r);else if(a===nn)_=-2/(o-r),v=-(o+r)/(o-r);else if(a===Bs)_=-1/(o-r),v=-r/(o-r);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+a);return c[0]=h,c[4]=0,c[8]=0,c[12]=f,c[1]=0,c[5]=u,c[9]=0,c[13]=p,c[2]=0,c[6]=0,c[10]=_,c[14]=v,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(e){const t=this.elements,n=e.elements;for(let s=0;s<16;s++)if(t[s]!==n[s])return!1;return!0}fromArray(e,t=0){for(let n=0;n<16;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){const n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e[t+9]=n[9],e[t+10]=n[10],e[t+11]=n[11],e[t+12]=n[12],e[t+13]=n[13],e[t+14]=n[14],e[t+15]=n[15],e}}const ri=new F,qt=new ut,Eh=new F(0,0,0),yh=new F(1,1,1),Mn=new F,cs=new F,Lt=new F,ao=new ut,oo=new Ci;class gn{constructor(e=0,t=0,n=0,s=gn.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=n,this._order=s}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,n,s=this._order){return this._x=e,this._y=t,this._z=n,this._order=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,n=!0){const s=e.elements,r=s[0],o=s[4],a=s[8],l=s[1],c=s[5],h=s[9],u=s[2],f=s[6],p=s[10];switch(t){case"XYZ":this._y=Math.asin(He(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(-h,p),this._z=Math.atan2(-o,r)):(this._x=Math.atan2(f,c),this._z=0);break;case"YXZ":this._x=Math.asin(-He(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(a,p),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-u,r),this._z=0);break;case"ZXY":this._x=Math.asin(He(f,-1,1)),Math.abs(f)<.9999999?(this._y=Math.atan2(-u,p),this._z=Math.atan2(-o,c)):(this._y=0,this._z=Math.atan2(l,r));break;case"ZYX":this._y=Math.asin(-He(u,-1,1)),Math.abs(u)<.9999999?(this._x=Math.atan2(f,p),this._z=Math.atan2(l,r)):(this._x=0,this._z=Math.atan2(-o,c));break;case"YZX":this._z=Math.asin(He(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-h,c),this._y=Math.atan2(-u,r)):(this._x=0,this._y=Math.atan2(a,p));break;case"XZY":this._z=Math.asin(-He(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(f,c),this._y=Math.atan2(a,r)):(this._x=Math.atan2(-h,p),this._y=0);break;default:console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,n===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,n){return ao.makeRotationFromQuaternion(e),this.setFromRotationMatrix(ao,t,n)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return oo.setFromEuler(this),this.setFromQuaternion(oo,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}gn.DEFAULT_ORDER="XYZ";class Al{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}}let Th=0;const lo=new F,ai=new Ci,cn=new ut,hs=new F,Fi=new F,bh=new F,wh=new Ci,co=new F(1,0,0),ho=new F(0,1,0),uo=new F(0,0,1),fo={type:"added"},Ah={type:"removed"},oi={type:"childadded",child:null},ar={type:"childremoved",child:null};class At extends Ai{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Th++}),this.uuid=Ri(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=At.DEFAULT_UP.clone();const e=new F,t=new gn,n=new Ci,s=new F(1,1,1);function r(){n.setFromEuler(t,!1)}function o(){t.setFromQuaternion(n,void 0,!1)}t._onChange(r),n._onChange(o),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:s},modelViewMatrix:{value:new ut},normalMatrix:{value:new Fe}}),this.matrix=new ut,this.matrixWorld=new ut,this.matrixAutoUpdate=At.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=At.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new Al,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.userData={}}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return ai.setFromAxisAngle(e,t),this.quaternion.multiply(ai),this}rotateOnWorldAxis(e,t){return ai.setFromAxisAngle(e,t),this.quaternion.premultiply(ai),this}rotateX(e){return this.rotateOnAxis(co,e)}rotateY(e){return this.rotateOnAxis(ho,e)}rotateZ(e){return this.rotateOnAxis(uo,e)}translateOnAxis(e,t){return lo.copy(e).applyQuaternion(this.quaternion),this.position.add(lo.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(co,e)}translateY(e){return this.translateOnAxis(ho,e)}translateZ(e){return this.translateOnAxis(uo,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(cn.copy(this.matrixWorld).invert())}lookAt(e,t,n){e.isVector3?hs.copy(e):hs.set(e,t,n);const s=this.parent;this.updateWorldMatrix(!0,!1),Fi.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?cn.lookAt(Fi,hs,this.up):cn.lookAt(hs,Fi,this.up),this.quaternion.setFromRotationMatrix(cn),s&&(cn.extractRotation(s.matrixWorld),ai.setFromRotationMatrix(cn),this.quaternion.premultiply(ai.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(console.error("THREE.Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(fo),oi.child=e,this.dispatchEvent(oi),oi.child=null):console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}const t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(Ah),ar.child=e,this.dispatchEvent(ar),ar.child=null),this}removeFromParent(){const e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),cn.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),cn.multiply(e.parent.matrixWorld)),e.applyMatrix4(cn),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(fo),oi.child=e,this.dispatchEvent(oi),oi.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let n=0,s=this.children.length;n<s;n++){const o=this.children[n].getObjectByProperty(e,t);if(o!==void 0)return o}}getObjectsByProperty(e,t,n=[]){this[e]===t&&n.push(this);const s=this.children;for(let r=0,o=s.length;r<o;r++)s[r].getObjectsByProperty(e,t,n);return n}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Fi,e,bh),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Fi,wh,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);const t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}traverse(e){e(this);const t=this.children;for(let n=0,s=t.length;n<s;n++)t[n].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);const t=this.children;for(let n=0,s=t.length;n<s;n++)t[n].traverseVisible(e)}traverseAncestors(e){const t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);const t=this.children;for(let n=0,s=t.length;n<s;n++)t[n].updateMatrixWorld(e)}updateWorldMatrix(e,t){const n=this.parent;if(e===!0&&n!==null&&n.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),t===!0){const s=this.children;for(let r=0,o=s.length;r<o;r++)s[r].updateWorldMatrix(!1,!0)}}toJSON(e){const t=e===void 0||typeof e=="string",n={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});const s={};s.uuid=this.uuid,s.type=this.type,this.name!==""&&(s.name=this.name),this.castShadow===!0&&(s.castShadow=!0),this.receiveShadow===!0&&(s.receiveShadow=!0),this.visible===!1&&(s.visible=!1),this.frustumCulled===!1&&(s.frustumCulled=!1),this.renderOrder!==0&&(s.renderOrder=this.renderOrder),Object.keys(this.userData).length>0&&(s.userData=this.userData),s.layers=this.layers.mask,s.matrix=this.matrix.toArray(),s.up=this.up.toArray(),this.matrixAutoUpdate===!1&&(s.matrixAutoUpdate=!1),this.isInstancedMesh&&(s.type="InstancedMesh",s.count=this.count,s.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(s.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(s.type="BatchedMesh",s.perObjectFrustumCulled=this.perObjectFrustumCulled,s.sortObjects=this.sortObjects,s.drawRanges=this._drawRanges,s.reservedRanges=this._reservedRanges,s.geometryInfo=this._geometryInfo.map(a=>({...a,boundingBox:a.boundingBox?a.boundingBox.toJSON():void 0,boundingSphere:a.boundingSphere?a.boundingSphere.toJSON():void 0})),s.instanceInfo=this._instanceInfo.map(a=>({...a})),s.availableInstanceIds=this._availableInstanceIds.slice(),s.availableGeometryIds=this._availableGeometryIds.slice(),s.nextIndexStart=this._nextIndexStart,s.nextVertexStart=this._nextVertexStart,s.geometryCount=this._geometryCount,s.maxInstanceCount=this._maxInstanceCount,s.maxVertexCount=this._maxVertexCount,s.maxIndexCount=this._maxIndexCount,s.geometryInitialized=this._geometryInitialized,s.matricesTexture=this._matricesTexture.toJSON(e),s.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null&&(s.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(s.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(s.boundingBox=this.boundingBox.toJSON()));function r(a,l){return a[l.uuid]===void 0&&(a[l.uuid]=l.toJSON(e)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?s.background=this.background.toJSON():this.background.isTexture&&(s.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(s.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){s.geometry=r(e.geometries,this.geometry);const a=this.geometry.parameters;if(a!==void 0&&a.shapes!==void 0){const l=a.shapes;if(Array.isArray(l))for(let c=0,h=l.length;c<h;c++){const u=l[c];r(e.shapes,u)}else r(e.shapes,l)}}if(this.isSkinnedMesh&&(s.bindMode=this.bindMode,s.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(e.skeletons,this.skeleton),s.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){const a=[];for(let l=0,c=this.material.length;l<c;l++)a.push(r(e.materials,this.material[l]));s.material=a}else s.material=r(e.materials,this.material);if(this.children.length>0){s.children=[];for(let a=0;a<this.children.length;a++)s.children.push(this.children[a].toJSON(e).object)}if(this.animations.length>0){s.animations=[];for(let a=0;a<this.animations.length;a++){const l=this.animations[a];s.animations.push(r(e.animations,l))}}if(t){const a=o(e.geometries),l=o(e.materials),c=o(e.textures),h=o(e.images),u=o(e.shapes),f=o(e.skeletons),p=o(e.animations),_=o(e.nodes);a.length>0&&(n.geometries=a),l.length>0&&(n.materials=l),c.length>0&&(n.textures=c),h.length>0&&(n.images=h),u.length>0&&(n.shapes=u),f.length>0&&(n.skeletons=f),p.length>0&&(n.animations=p),_.length>0&&(n.nodes=_)}return n.object=s,n;function o(a){const l=[];for(const c in a){const h=a[c];delete h.metadata,l.push(h)}return l}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let n=0;n<e.children.length;n++){const s=e.children[n];this.add(s.clone())}return this}}At.DEFAULT_UP=new F(0,1,0);At.DEFAULT_MATRIX_AUTO_UPDATE=!0;At.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;const Yt=new F,hn=new F,or=new F,un=new F,li=new F,ci=new F,po=new F,lr=new F,cr=new F,hr=new F,ur=new ct,dr=new ct,fr=new ct;class jt{constructor(e=new F,t=new F,n=new F){this.a=e,this.b=t,this.c=n}static getNormal(e,t,n,s){s.subVectors(n,t),Yt.subVectors(e,t),s.cross(Yt);const r=s.lengthSq();return r>0?s.multiplyScalar(1/Math.sqrt(r)):s.set(0,0,0)}static getBarycoord(e,t,n,s,r){Yt.subVectors(s,t),hn.subVectors(n,t),or.subVectors(e,t);const o=Yt.dot(Yt),a=Yt.dot(hn),l=Yt.dot(or),c=hn.dot(hn),h=hn.dot(or),u=o*c-a*a;if(u===0)return r.set(0,0,0),null;const f=1/u,p=(c*l-a*h)*f,_=(o*h-a*l)*f;return r.set(1-p-_,_,p)}static containsPoint(e,t,n,s){return this.getBarycoord(e,t,n,s,un)===null?!1:un.x>=0&&un.y>=0&&un.x+un.y<=1}static getInterpolation(e,t,n,s,r,o,a,l){return this.getBarycoord(e,t,n,s,un)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(r,un.x),l.addScaledVector(o,un.y),l.addScaledVector(a,un.z),l)}static getInterpolatedAttribute(e,t,n,s,r,o){return ur.setScalar(0),dr.setScalar(0),fr.setScalar(0),ur.fromBufferAttribute(e,t),dr.fromBufferAttribute(e,n),fr.fromBufferAttribute(e,s),o.setScalar(0),o.addScaledVector(ur,r.x),o.addScaledVector(dr,r.y),o.addScaledVector(fr,r.z),o}static isFrontFacing(e,t,n,s){return Yt.subVectors(n,t),hn.subVectors(e,t),Yt.cross(hn).dot(s)<0}set(e,t,n){return this.a.copy(e),this.b.copy(t),this.c.copy(n),this}setFromPointsAndIndices(e,t,n,s){return this.a.copy(e[t]),this.b.copy(e[n]),this.c.copy(e[s]),this}setFromAttributeAndIndices(e,t,n,s){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,n),this.c.fromBufferAttribute(e,s),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return Yt.subVectors(this.c,this.b),hn.subVectors(this.a,this.b),Yt.cross(hn).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return jt.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return jt.getBarycoord(e,this.a,this.b,this.c,t)}getInterpolation(e,t,n,s,r){return jt.getInterpolation(e,this.a,this.b,this.c,t,n,s,r)}containsPoint(e){return jt.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return jt.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){const n=this.a,s=this.b,r=this.c;let o,a;li.subVectors(s,n),ci.subVectors(r,n),lr.subVectors(e,n);const l=li.dot(lr),c=ci.dot(lr);if(l<=0&&c<=0)return t.copy(n);cr.subVectors(e,s);const h=li.dot(cr),u=ci.dot(cr);if(h>=0&&u<=h)return t.copy(s);const f=l*u-h*c;if(f<=0&&l>=0&&h<=0)return o=l/(l-h),t.copy(n).addScaledVector(li,o);hr.subVectors(e,r);const p=li.dot(hr),_=ci.dot(hr);if(_>=0&&p<=_)return t.copy(r);const v=p*c-l*_;if(v<=0&&c>=0&&_<=0)return a=c/(c-_),t.copy(n).addScaledVector(ci,a);const m=h*_-p*u;if(m<=0&&u-h>=0&&p-_>=0)return po.subVectors(r,s),a=(u-h)/(u-h+(p-_)),t.copy(s).addScaledVector(po,a);const d=1/(m+v+f);return o=v*d,a=f*d,t.copy(n).addScaledVector(li,o).addScaledVector(ci,a)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}}const Rl={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},Sn={h:0,s:0,l:0},us={h:0,s:0,l:0};function pr(i,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?i+(e-i)*6*t:t<1/2?e:t<2/3?i+(e-i)*6*(2/3-t):i}class ze{constructor(e,t,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,n)}set(e,t,n){if(t===void 0&&n===void 0){const s=e;s&&s.isColor?this.copy(s):typeof s=="number"?this.setHex(s):typeof s=="string"&&this.setStyle(s)}else this.setRGB(e,t,n);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=zt){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,Ve.colorSpaceToWorking(this,t),this}setRGB(e,t,n,s=Ve.workingColorSpace){return this.r=e,this.g=t,this.b=n,Ve.colorSpaceToWorking(this,s),this}setHSL(e,t,n,s=Ve.workingColorSpace){if(e=Ca(e,1),t=He(t,0,1),n=He(n,0,1),t===0)this.r=this.g=this.b=n;else{const r=n<=.5?n*(1+t):n+t-n*t,o=2*n-r;this.r=pr(o,r,e+1/3),this.g=pr(o,r,e),this.b=pr(o,r,e-1/3)}return Ve.colorSpaceToWorking(this,s),this}setStyle(e,t=zt){function n(r){r!==void 0&&parseFloat(r)<1&&console.warn("THREE.Color: Alpha component of "+e+" will be ignored.")}let s;if(s=/^(\w+)\(([^\)]*)\)/.exec(e)){let r;const o=s[1],a=s[2];switch(o){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,t);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,t);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,t);break;default:console.warn("THREE.Color: Unknown color model "+e)}}else if(s=/^\#([A-Fa-f\d]+)$/.exec(e)){const r=s[1],o=r.length;if(o===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,t);if(o===6)return this.setHex(parseInt(r,16),t);console.warn("THREE.Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=zt){const n=Rl[e.toLowerCase()];return n!==void 0?this.setHex(n,t):console.warn("THREE.Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=pn(e.r),this.g=pn(e.g),this.b=pn(e.b),this}copyLinearToSRGB(e){return this.r=Mi(e.r),this.g=Mi(e.g),this.b=Mi(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=zt){return Ve.workingToColorSpace(Mt.copy(this),e),Math.round(He(Mt.r*255,0,255))*65536+Math.round(He(Mt.g*255,0,255))*256+Math.round(He(Mt.b*255,0,255))}getHexString(e=zt){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=Ve.workingColorSpace){Ve.workingToColorSpace(Mt.copy(this),t);const n=Mt.r,s=Mt.g,r=Mt.b,o=Math.max(n,s,r),a=Math.min(n,s,r);let l,c;const h=(a+o)/2;if(a===o)l=0,c=0;else{const u=o-a;switch(c=h<=.5?u/(o+a):u/(2-o-a),o){case n:l=(s-r)/u+(s<r?6:0);break;case s:l=(r-n)/u+2;break;case r:l=(n-s)/u+4;break}l/=6}return e.h=l,e.s=c,e.l=h,e}getRGB(e,t=Ve.workingColorSpace){return Ve.workingToColorSpace(Mt.copy(this),t),e.r=Mt.r,e.g=Mt.g,e.b=Mt.b,e}getStyle(e=zt){Ve.workingToColorSpace(Mt.copy(this),e);const t=Mt.r,n=Mt.g,s=Mt.b;return e!==zt?`color(${e} ${t.toFixed(3)} ${n.toFixed(3)} ${s.toFixed(3)})`:`rgb(${Math.round(t*255)},${Math.round(n*255)},${Math.round(s*255)})`}offsetHSL(e,t,n){return this.getHSL(Sn),this.setHSL(Sn.h+e,Sn.s+t,Sn.l+n)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,n){return this.r=e.r+(t.r-e.r)*n,this.g=e.g+(t.g-e.g)*n,this.b=e.b+(t.b-e.b)*n,this}lerpHSL(e,t){this.getHSL(Sn),e.getHSL(us);const n=Vi(Sn.h,us.h,t),s=Vi(Sn.s,us.s,t),r=Vi(Sn.l,us.l,t);return this.setHSL(n,s,r),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){const t=this.r,n=this.g,s=this.b,r=e.elements;return this.r=r[0]*t+r[3]*n+r[6]*s,this.g=r[1]*t+r[4]*n+r[7]*s,this.b=r[2]*t+r[5]*n+r[8]*s,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}const Mt=new ze;ze.NAMES=Rl;let Rh=0;class Pi extends Ai{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Rh++}),this.uuid=Ri(),this.name="",this.type="Material",this.blending=vi,this.side=Un,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=Ur,this.blendDst=Ir,this.blendEquation=qn,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new ze(0,0,0),this.blendAlpha=0,this.depthFunc=Zn,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=Ja,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=ei,this.stencilZFail=ei,this.stencilZPass=ei,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(const t in e){const n=e[t];if(n===void 0){console.warn(`THREE.Material: parameter '${t}' has value of undefined.`);continue}const s=this[t];if(s===void 0){console.warn(`THREE.Material: '${t}' is not a property of THREE.${this.type}.`);continue}s&&s.isColor?s.set(n):s&&s.isVector3&&n&&n.isVector3?s.copy(n):this[t]=n}}toJSON(e){const t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});const n={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,this.name!==""&&(n.name=this.name),this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(n.sheenColorMap=this.sheenColorMap.toJSON(e).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(n.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(e).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(e).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(e).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(e).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(e).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.shadowSide!==null&&(n.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),this.blending!==vi&&(n.blending=this.blending),this.side!==Un&&(n.side=this.side),this.vertexColors===!0&&(n.vertexColors=!0),this.opacity<1&&(n.opacity=this.opacity),this.transparent===!0&&(n.transparent=!0),this.blendSrc!==Ur&&(n.blendSrc=this.blendSrc),this.blendDst!==Ir&&(n.blendDst=this.blendDst),this.blendEquation!==qn&&(n.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(n.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(n.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(n.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(n.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(n.blendAlpha=this.blendAlpha),this.depthFunc!==Zn&&(n.depthFunc=this.depthFunc),this.depthTest===!1&&(n.depthTest=this.depthTest),this.depthWrite===!1&&(n.depthWrite=this.depthWrite),this.colorWrite===!1&&(n.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(n.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==Ja&&(n.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(n.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(n.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==ei&&(n.stencilFail=this.stencilFail),this.stencilZFail!==ei&&(n.stencilZFail=this.stencilZFail),this.stencilZPass!==ei&&(n.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(n.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(n.rotation=this.rotation),this.polygonOffset===!0&&(n.polygonOffset=!0),this.polygonOffsetFactor!==0&&(n.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(n.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(n.linewidth=this.linewidth),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.dithering===!0&&(n.dithering=!0),this.alphaTest>0&&(n.alphaTest=this.alphaTest),this.alphaHash===!0&&(n.alphaHash=!0),this.alphaToCoverage===!0&&(n.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(n.premultipliedAlpha=!0),this.forceSinglePass===!0&&(n.forceSinglePass=!0),this.wireframe===!0&&(n.wireframe=!0),this.wireframeLinewidth>1&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(n.flatShading=!0),this.visible===!1&&(n.visible=!1),this.toneMapped===!1&&(n.toneMapped=!1),this.fog===!1&&(n.fog=!1),Object.keys(this.userData).length>0&&(n.userData=this.userData);function s(r){const o=[];for(const a in r){const l=r[a];delete l.metadata,o.push(l)}return o}if(t){const r=s(e.textures),o=s(e.images);r.length>0&&(n.textures=r),o.length>0&&(n.images=o)}return n}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;const t=e.clippingPlanes;let n=null;if(t!==null){const s=t.length;n=new Array(s);for(let r=0;r!==s;++r)n[r]=t[r].clone()}return this.clippingPlanes=n,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}}class La extends Pi{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new ze(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new gn,this.combine=pl,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}}const dt=new F,ds=new $e;let Ch=0;class gt{constructor(e,t,n=!1){if(Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:Ch++}),this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=n,this.usage=Qa,this.updateRanges=[],this.gpuType=fn,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,n){e*=this.itemSize,n*=t.itemSize;for(let s=0,r=this.itemSize;s<r;s++)this.array[e+s]=t.array[n+s];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,n=this.count;t<n;t++)ds.fromBufferAttribute(this,t),ds.applyMatrix3(e),this.setXY(t,ds.x,ds.y);else if(this.itemSize===3)for(let t=0,n=this.count;t<n;t++)dt.fromBufferAttribute(this,t),dt.applyMatrix3(e),this.setXYZ(t,dt.x,dt.y,dt.z);return this}applyMatrix4(e){for(let t=0,n=this.count;t<n;t++)dt.fromBufferAttribute(this,t),dt.applyMatrix4(e),this.setXYZ(t,dt.x,dt.y,dt.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)dt.fromBufferAttribute(this,t),dt.applyNormalMatrix(e),this.setXYZ(t,dt.x,dt.y,dt.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)dt.fromBufferAttribute(this,t),dt.transformDirection(e),this.setXYZ(t,dt.x,dt.y,dt.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let n=this.array[e*this.itemSize+t];return this.normalized&&(n=mi(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=yt(n,this.array)),this.array[e*this.itemSize+t]=n,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=mi(t,this.array)),t}setX(e,t){return this.normalized&&(t=yt(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=mi(t,this.array)),t}setY(e,t){return this.normalized&&(t=yt(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=mi(t,this.array)),t}setZ(e,t){return this.normalized&&(t=yt(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=mi(t,this.array)),t}setW(e,t){return this.normalized&&(t=yt(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,n){return e*=this.itemSize,this.normalized&&(t=yt(t,this.array),n=yt(n,this.array)),this.array[e+0]=t,this.array[e+1]=n,this}setXYZ(e,t,n,s){return e*=this.itemSize,this.normalized&&(t=yt(t,this.array),n=yt(n,this.array),s=yt(s,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=s,this}setXYZW(e,t,n,s,r){return e*=this.itemSize,this.normalized&&(t=yt(t,this.array),n=yt(n,this.array),s=yt(s,this.array),r=yt(r,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=s,this.array[e+3]=r,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){const e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(e.name=this.name),this.usage!==Qa&&(e.usage=this.usage),e}}class Cl extends gt{constructor(e,t,n){super(new Uint16Array(e),t,n)}}class Pl extends gt{constructor(e,t,n){super(new Uint32Array(e),t,n)}}class Vt extends gt{constructor(e,t,n){super(new Float32Array(e),t,n)}}let Ph=0;const Ot=new ut,mr=new At,hi=new F,Ut=new Ji,Ni=new Ji,mt=new F;class It extends Ai{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:Ph++}),this.uuid=Ri(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(bl(e)?Pl:Cl)(e,1):this.index=e,this}setIndirect(e){return this.indirect=e,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,n=0){this.groups.push({start:e,count:t,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){const t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);const n=this.attributes.normal;if(n!==void 0){const r=new Fe().getNormalMatrix(e);n.applyNormalMatrix(r),n.needsUpdate=!0}const s=this.attributes.tangent;return s!==void 0&&(s.transformDirection(e),s.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(e){return Ot.makeRotationFromQuaternion(e),this.applyMatrix4(Ot),this}rotateX(e){return Ot.makeRotationX(e),this.applyMatrix4(Ot),this}rotateY(e){return Ot.makeRotationY(e),this.applyMatrix4(Ot),this}rotateZ(e){return Ot.makeRotationZ(e),this.applyMatrix4(Ot),this}translate(e,t,n){return Ot.makeTranslation(e,t,n),this.applyMatrix4(Ot),this}scale(e,t,n){return Ot.makeScale(e,t,n),this.applyMatrix4(Ot),this}lookAt(e){return mr.lookAt(e),mr.updateMatrix(),this.applyMatrix4(mr.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(hi).negate(),this.translate(hi.x,hi.y,hi.z),this}setFromPoints(e){const t=this.getAttribute("position");if(t===void 0){const n=[];for(let s=0,r=e.length;s<r;s++){const o=e[s];n.push(o.x,o.y,o.z||0)}this.setAttribute("position",new Vt(n,3))}else{const n=Math.min(e.length,t.count);for(let s=0;s<n;s++){const r=e[s];t.setXYZ(s,r.x,r.y,r.z||0)}e.length>t.count&&console.warn("THREE.BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new Ji);const e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new F(-1/0,-1/0,-1/0),new F(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let n=0,s=t.length;n<s;n++){const r=t[n];Ut.setFromBufferAttribute(r),this.morphTargetsRelative?(mt.addVectors(this.boundingBox.min,Ut.min),this.boundingBox.expandByPoint(mt),mt.addVectors(this.boundingBox.max,Ut.max),this.boundingBox.expandByPoint(mt)):(this.boundingBox.expandByPoint(Ut.min),this.boundingBox.expandByPoint(Ut.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new Qi);const e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new F,1/0);return}if(e){const n=this.boundingSphere.center;if(Ut.setFromBufferAttribute(e),t)for(let r=0,o=t.length;r<o;r++){const a=t[r];Ni.setFromBufferAttribute(a),this.morphTargetsRelative?(mt.addVectors(Ut.min,Ni.min),Ut.expandByPoint(mt),mt.addVectors(Ut.max,Ni.max),Ut.expandByPoint(mt)):(Ut.expandByPoint(Ni.min),Ut.expandByPoint(Ni.max))}Ut.getCenter(n);let s=0;for(let r=0,o=e.count;r<o;r++)mt.fromBufferAttribute(e,r),s=Math.max(s,n.distanceToSquared(mt));if(t)for(let r=0,o=t.length;r<o;r++){const a=t[r],l=this.morphTargetsRelative;for(let c=0,h=a.count;c<h;c++)mt.fromBufferAttribute(a,c),l&&(hi.fromBufferAttribute(e,c),mt.add(hi)),s=Math.max(s,n.distanceToSquared(mt))}this.boundingSphere.radius=Math.sqrt(s),isNaN(this.boundingSphere.radius)&&console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){const e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}const n=t.position,s=t.normal,r=t.uv;this.hasAttribute("tangent")===!1&&this.setAttribute("tangent",new gt(new Float32Array(4*n.count),4));const o=this.getAttribute("tangent"),a=[],l=[];for(let N=0;N<n.count;N++)a[N]=new F,l[N]=new F;const c=new F,h=new F,u=new F,f=new $e,p=new $e,_=new $e,v=new F,m=new F;function d(N,E,S){c.fromBufferAttribute(n,N),h.fromBufferAttribute(n,E),u.fromBufferAttribute(n,S),f.fromBufferAttribute(r,N),p.fromBufferAttribute(r,E),_.fromBufferAttribute(r,S),h.sub(c),u.sub(c),p.sub(f),_.sub(f);const L=1/(p.x*_.y-_.x*p.y);isFinite(L)&&(v.copy(h).multiplyScalar(_.y).addScaledVector(u,-p.y).multiplyScalar(L),m.copy(u).multiplyScalar(p.x).addScaledVector(h,-_.x).multiplyScalar(L),a[N].add(v),a[E].add(v),a[S].add(v),l[N].add(m),l[E].add(m),l[S].add(m))}let w=this.groups;w.length===0&&(w=[{start:0,count:e.count}]);for(let N=0,E=w.length;N<E;++N){const S=w[N],L=S.start,k=S.count;for(let X=L,Z=L+k;X<Z;X+=3)d(e.getX(X+0),e.getX(X+1),e.getX(X+2))}const T=new F,M=new F,C=new F,R=new F;function P(N){C.fromBufferAttribute(s,N),R.copy(C);const E=a[N];T.copy(E),T.sub(C.multiplyScalar(C.dot(E))).normalize(),M.crossVectors(R,E);const L=M.dot(l[N])<0?-1:1;o.setXYZW(N,T.x,T.y,T.z,L)}for(let N=0,E=w.length;N<E;++N){const S=w[N],L=S.start,k=S.count;for(let X=L,Z=L+k;X<Z;X+=3)P(e.getX(X+0)),P(e.getX(X+1)),P(e.getX(X+2))}}computeVertexNormals(){const e=this.index,t=this.getAttribute("position");if(t!==void 0){let n=this.getAttribute("normal");if(n===void 0)n=new gt(new Float32Array(t.count*3),3),this.setAttribute("normal",n);else for(let f=0,p=n.count;f<p;f++)n.setXYZ(f,0,0,0);const s=new F,r=new F,o=new F,a=new F,l=new F,c=new F,h=new F,u=new F;if(e)for(let f=0,p=e.count;f<p;f+=3){const _=e.getX(f+0),v=e.getX(f+1),m=e.getX(f+2);s.fromBufferAttribute(t,_),r.fromBufferAttribute(t,v),o.fromBufferAttribute(t,m),h.subVectors(o,r),u.subVectors(s,r),h.cross(u),a.fromBufferAttribute(n,_),l.fromBufferAttribute(n,v),c.fromBufferAttribute(n,m),a.add(h),l.add(h),c.add(h),n.setXYZ(_,a.x,a.y,a.z),n.setXYZ(v,l.x,l.y,l.z),n.setXYZ(m,c.x,c.y,c.z)}else for(let f=0,p=t.count;f<p;f+=3)s.fromBufferAttribute(t,f+0),r.fromBufferAttribute(t,f+1),o.fromBufferAttribute(t,f+2),h.subVectors(o,r),u.subVectors(s,r),h.cross(u),n.setXYZ(f+0,h.x,h.y,h.z),n.setXYZ(f+1,h.x,h.y,h.z),n.setXYZ(f+2,h.x,h.y,h.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){const e=this.attributes.normal;for(let t=0,n=e.count;t<n;t++)mt.fromBufferAttribute(e,t),mt.normalize(),e.setXYZ(t,mt.x,mt.y,mt.z)}toNonIndexed(){function e(a,l){const c=a.array,h=a.itemSize,u=a.normalized,f=new c.constructor(l.length*h);let p=0,_=0;for(let v=0,m=l.length;v<m;v++){a.isInterleavedBufferAttribute?p=l[v]*a.data.stride+a.offset:p=l[v]*h;for(let d=0;d<h;d++)f[_++]=c[p++]}return new gt(f,h,u)}if(this.index===null)return console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;const t=new It,n=this.index.array,s=this.attributes;for(const a in s){const l=s[a],c=e(l,n);t.setAttribute(a,c)}const r=this.morphAttributes;for(const a in r){const l=[],c=r[a];for(let h=0,u=c.length;h<u;h++){const f=c[h],p=e(f,n);l.push(p)}t.morphAttributes[a]=l}t.morphTargetsRelative=this.morphTargetsRelative;const o=this.groups;for(let a=0,l=o.length;a<l;a++){const c=o[a];t.addGroup(c.start,c.count,c.materialIndex)}return t}toJSON(){const e={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.type,this.name!==""&&(e.name=this.name),Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0){const l=this.parameters;for(const c in l)l[c]!==void 0&&(e[c]=l[c]);return e}e.data={attributes:{}};const t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});const n=this.attributes;for(const l in n){const c=n[l];e.data.attributes[l]=c.toJSON(e.data)}const s={};let r=!1;for(const l in this.morphAttributes){const c=this.morphAttributes[l],h=[];for(let u=0,f=c.length;u<f;u++){const p=c[u];h.push(p.toJSON(e.data))}h.length>0&&(s[l]=h,r=!0)}r&&(e.data.morphAttributes=s,e.data.morphTargetsRelative=this.morphTargetsRelative);const o=this.groups;o.length>0&&(e.data.groups=JSON.parse(JSON.stringify(o)));const a=this.boundingSphere;return a!==null&&(e.data.boundingSphere=a.toJSON()),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;const t={};this.name=e.name;const n=e.index;n!==null&&this.setIndex(n.clone());const s=e.attributes;for(const c in s){const h=s[c];this.setAttribute(c,h.clone(t))}const r=e.morphAttributes;for(const c in r){const h=[],u=r[c];for(let f=0,p=u.length;f<p;f++)h.push(u[f].clone(t));this.morphAttributes[c]=h}this.morphTargetsRelative=e.morphTargetsRelative;const o=e.groups;for(let c=0,h=o.length;c<h;c++){const u=o[c];this.addGroup(u.start,u.count,u.materialIndex)}const a=e.boundingBox;a!==null&&(this.boundingBox=a.clone());const l=e.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}}const mo=new ut,kn=new Da,fs=new Qi,go=new F,ps=new F,ms=new F,gs=new F,gr=new F,_s=new F,_o=new F,vs=new F;class bt extends At{constructor(e=new It,t=new La){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){const t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){const s=t[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,o=s.length;r<o;r++){const a=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=r}}}}getVertexPosition(e,t){const n=this.geometry,s=n.attributes.position,r=n.morphAttributes.position,o=n.morphTargetsRelative;t.fromBufferAttribute(s,e);const a=this.morphTargetInfluences;if(r&&a){_s.set(0,0,0);for(let l=0,c=r.length;l<c;l++){const h=a[l],u=r[l];h!==0&&(gr.fromBufferAttribute(u,e),o?_s.addScaledVector(gr,h):_s.addScaledVector(gr.sub(t),h))}t.add(_s)}return t}raycast(e,t){const n=this.geometry,s=this.material,r=this.matrixWorld;s!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),fs.copy(n.boundingSphere),fs.applyMatrix4(r),kn.copy(e.ray).recast(e.near),!(fs.containsPoint(kn.origin)===!1&&(kn.intersectSphere(fs,go)===null||kn.origin.distanceToSquared(go)>(e.far-e.near)**2))&&(mo.copy(r).invert(),kn.copy(e.ray).applyMatrix4(mo),!(n.boundingBox!==null&&kn.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(e,t,kn)))}_computeIntersections(e,t,n){let s;const r=this.geometry,o=this.material,a=r.index,l=r.attributes.position,c=r.attributes.uv,h=r.attributes.uv1,u=r.attributes.normal,f=r.groups,p=r.drawRange;if(a!==null)if(Array.isArray(o))for(let _=0,v=f.length;_<v;_++){const m=f[_],d=o[m.materialIndex],w=Math.max(m.start,p.start),T=Math.min(a.count,Math.min(m.start+m.count,p.start+p.count));for(let M=w,C=T;M<C;M+=3){const R=a.getX(M),P=a.getX(M+1),N=a.getX(M+2);s=xs(this,d,e,n,c,h,u,R,P,N),s&&(s.faceIndex=Math.floor(M/3),s.face.materialIndex=m.materialIndex,t.push(s))}}else{const _=Math.max(0,p.start),v=Math.min(a.count,p.start+p.count);for(let m=_,d=v;m<d;m+=3){const w=a.getX(m),T=a.getX(m+1),M=a.getX(m+2);s=xs(this,o,e,n,c,h,u,w,T,M),s&&(s.faceIndex=Math.floor(m/3),t.push(s))}}else if(l!==void 0)if(Array.isArray(o))for(let _=0,v=f.length;_<v;_++){const m=f[_],d=o[m.materialIndex],w=Math.max(m.start,p.start),T=Math.min(l.count,Math.min(m.start+m.count,p.start+p.count));for(let M=w,C=T;M<C;M+=3){const R=M,P=M+1,N=M+2;s=xs(this,d,e,n,c,h,u,R,P,N),s&&(s.faceIndex=Math.floor(M/3),s.face.materialIndex=m.materialIndex,t.push(s))}}else{const _=Math.max(0,p.start),v=Math.min(l.count,p.start+p.count);for(let m=_,d=v;m<d;m+=3){const w=m,T=m+1,M=m+2;s=xs(this,o,e,n,c,h,u,w,T,M),s&&(s.faceIndex=Math.floor(m/3),t.push(s))}}}}function Dh(i,e,t,n,s,r,o,a){let l;if(e.side===wt?l=n.intersectTriangle(o,r,s,!0,a):l=n.intersectTriangle(s,r,o,e.side===Un,a),l===null)return null;vs.copy(a),vs.applyMatrix4(i.matrixWorld);const c=t.ray.origin.distanceTo(vs);return c<t.near||c>t.far?null:{distance:c,point:vs.clone(),object:i}}function xs(i,e,t,n,s,r,o,a,l,c){i.getVertexPosition(a,ps),i.getVertexPosition(l,ms),i.getVertexPosition(c,gs);const h=Dh(i,e,t,n,ps,ms,gs,_o);if(h){const u=new F;jt.getBarycoord(_o,ps,ms,gs,u),s&&(h.uv=jt.getInterpolatedAttribute(s,a,l,c,u,new $e)),r&&(h.uv1=jt.getInterpolatedAttribute(r,a,l,c,u,new $e)),o&&(h.normal=jt.getInterpolatedAttribute(o,a,l,c,u,new F),h.normal.dot(n.direction)>0&&h.normal.multiplyScalar(-1));const f={a,b:l,c,normal:new F,materialIndex:0};jt.getNormal(ps,ms,gs,f.normal),h.face=f,h.barycoord=u}return h}class es extends It{constructor(e=1,t=1,n=1,s=1,r=1,o=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:n,widthSegments:s,heightSegments:r,depthSegments:o};const a=this;s=Math.floor(s),r=Math.floor(r),o=Math.floor(o);const l=[],c=[],h=[],u=[];let f=0,p=0;_("z","y","x",-1,-1,n,t,e,o,r,0),_("z","y","x",1,-1,n,t,-e,o,r,1),_("x","z","y",1,1,e,n,t,s,o,2),_("x","z","y",1,-1,e,n,-t,s,o,3),_("x","y","z",1,-1,e,t,n,s,r,4),_("x","y","z",-1,-1,e,t,-n,s,r,5),this.setIndex(l),this.setAttribute("position",new Vt(c,3)),this.setAttribute("normal",new Vt(h,3)),this.setAttribute("uv",new Vt(u,2));function _(v,m,d,w,T,M,C,R,P,N,E){const S=M/P,L=C/N,k=M/2,X=C/2,Z=R/2,Y=P+1,G=N+1;let A=0,W=0;const ie=new F;for(let ue=0;ue<G;ue++){const xe=ue*L-X;for(let Ne=0;Ne<Y;Ne++){const Ke=Ne*S-k;ie[v]=Ke*w,ie[m]=xe*T,ie[d]=Z,c.push(ie.x,ie.y,ie.z),ie[v]=0,ie[m]=0,ie[d]=R>0?1:-1,h.push(ie.x,ie.y,ie.z),u.push(Ne/P),u.push(1-ue/N),A+=1}}for(let ue=0;ue<N;ue++)for(let xe=0;xe<P;xe++){const Ne=f+xe+Y*ue,Ke=f+xe+Y*(ue+1),Qe=f+(xe+1)+Y*(ue+1),Ge=f+(xe+1)+Y*ue;l.push(Ne,Ke,Ge),l.push(Ke,Qe,Ge),W+=6}a.addGroup(p,W,E),p+=W,f+=A}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new es(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}}function Ti(i){const e={};for(const t in i){e[t]={};for(const n in i[t]){const s=i[t][n];s&&(s.isColor||s.isMatrix3||s.isMatrix4||s.isVector2||s.isVector3||s.isVector4||s.isTexture||s.isQuaternion)?s.isRenderTargetTexture?(console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][n]=null):e[t][n]=s.clone():Array.isArray(s)?e[t][n]=s.slice():e[t][n]=s}}return e}function Tt(i){const e={};for(let t=0;t<i.length;t++){const n=Ti(i[t]);for(const s in n)e[s]=n[s]}return e}function Lh(i){const e=[];for(let t=0;t<i.length;t++)e.push(i[t].clone());return e}function Dl(i){const e=i.getRenderTarget();return e===null?i.outputColorSpace:e.isXRRenderTarget===!0?e.texture.colorSpace:Ve.workingColorSpace}const Uh={clone:Ti,merge:Tt};var Ih=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,Fh=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class Ct extends Pi{constructor(e){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=Ih,this.fragmentShader=Fh,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=Ti(e.uniforms),this.uniformsGroups=Lh(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this}toJSON(e){const t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(const s in this.uniforms){const o=this.uniforms[s].value;o&&o.isTexture?t.uniforms[s]={type:"t",value:o.toJSON(e).uuid}:o&&o.isColor?t.uniforms[s]={type:"c",value:o.getHex()}:o&&o.isVector2?t.uniforms[s]={type:"v2",value:o.toArray()}:o&&o.isVector3?t.uniforms[s]={type:"v3",value:o.toArray()}:o&&o.isVector4?t.uniforms[s]={type:"v4",value:o.toArray()}:o&&o.isMatrix3?t.uniforms[s]={type:"m3",value:o.toArray()}:o&&o.isMatrix4?t.uniforms[s]={type:"m4",value:o.toArray()}:t.uniforms[s]={value:o}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;const n={};for(const s in this.extensions)this.extensions[s]===!0&&(n[s]=!0);return Object.keys(n).length>0&&(t.extensions=n),t}}class Ll extends At{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new ut,this.projectionMatrix=new ut,this.projectionMatrixInverse=new ut,this.coordinateSystem=nn,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix(e,t){super.updateWorldMatrix(e,t),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}}const En=new F,vo=new $e,xo=new $e;class kt extends Ll{constructor(e=50,t=1,n=.1,s=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=n,this.far=s,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){const t=.5*this.getFilmHeight()/e;this.fov=Ki*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){const e=Math.tan(Gi*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return Ki*2*Math.atan(Math.tan(Gi*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,n){En.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(En.x,En.y).multiplyScalar(-e/En.z),En.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(En.x,En.y).multiplyScalar(-e/En.z)}getViewSize(e,t){return this.getViewBounds(e,vo,xo),t.subVectors(xo,vo)}setViewOffset(e,t,n,s,r,o){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=this.near;let t=e*Math.tan(Gi*.5*this.fov)/this.zoom,n=2*t,s=this.aspect*n,r=-.5*s;const o=this.view;if(this.view!==null&&this.view.enabled){const l=o.fullWidth,c=o.fullHeight;r+=o.offsetX*s/l,t-=o.offsetY*n/c,s*=o.width/l,n*=o.height/c}const a=this.filmOffset;a!==0&&(r+=e*a/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+s,t,t-n,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}}const ui=-90,di=1;class Nh extends At{constructor(e,t,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;const s=new kt(ui,di,e,t);s.layers=this.layers,this.add(s);const r=new kt(ui,di,e,t);r.layers=this.layers,this.add(r);const o=new kt(ui,di,e,t);o.layers=this.layers,this.add(o);const a=new kt(ui,di,e,t);a.layers=this.layers,this.add(a);const l=new kt(ui,di,e,t);l.layers=this.layers,this.add(l);const c=new kt(ui,di,e,t);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){const e=this.coordinateSystem,t=this.children.concat(),[n,s,r,o,a,l]=t;for(const c of t)this.remove(c);if(e===nn)n.up.set(0,1,0),n.lookAt(1,0,0),s.up.set(0,1,0),s.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),o.up.set(0,0,1),o.lookAt(0,-1,0),a.up.set(0,1,0),a.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(e===Bs)n.up.set(0,-1,0),n.lookAt(-1,0,0),s.up.set(0,-1,0),s.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),o.up.set(0,0,-1),o.lookAt(0,-1,0),a.up.set(0,-1,0),a.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(const c of t)this.add(c),c.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();const{renderTarget:n,activeMipmapLevel:s}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());const[r,o,a,l,c,h]=this.children,u=e.getRenderTarget(),f=e.getActiveCubeFace(),p=e.getActiveMipmapLevel(),_=e.xr.enabled;e.xr.enabled=!1;const v=n.texture.generateMipmaps;n.texture.generateMipmaps=!1,e.setRenderTarget(n,0,s),e.render(t,r),e.setRenderTarget(n,1,s),e.render(t,o),e.setRenderTarget(n,2,s),e.render(t,a),e.setRenderTarget(n,3,s),e.render(t,l),e.setRenderTarget(n,4,s),e.render(t,c),n.texture.generateMipmaps=v,e.setRenderTarget(n,5,s),e.render(t,h),e.setRenderTarget(u,f,p),e.xr.enabled=_,n.texture.needsPMREMUpdate=!0}}class Ul extends vt{constructor(e=[],t=Ei,n,s,r,o,a,l,c,h){super(e,t,n,s,r,o,a,l,c,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}}class Oh extends In{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;const n={width:e,height:e,depth:1},s=[n,n,n,n,n,n];this.texture=new Ul(s),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;const n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},s=new es(5,5,5),r=new Ct({name:"CubemapFromEquirect",uniforms:Ti(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:wt,blending:Dn});r.uniforms.tEquirect.value=t;const o=new bt(s,r),a=t.minFilter;return t.minFilter===Kn&&(t.minFilter=tn),new Nh(1,10,this).update(e,o),t.minFilter=a,o.geometry.dispose(),o.material.dispose(),this}clear(e,t=!0,n=!0,s=!0){const r=e.getRenderTarget();for(let o=0;o<6;o++)e.setRenderTarget(this,o),e.clear(t,n,s);e.setRenderTarget(r)}}class zi extends At{constructor(){super(),this.isGroup=!0,this.type="Group"}}const Bh={type:"move"};class _r{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new zi,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new zi,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new F,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new F),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new zi,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new F,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new F),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){const t=this._hand;if(t)for(const n of e.hand.values())this._getHandJoint(t,n)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,n){let s=null,r=null,o=null;const a=this._targetRay,l=this._grip,c=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(c&&e.hand){o=!0;for(const v of e.hand.values()){const m=t.getJointPose(v,n),d=this._getHandJoint(c,v);m!==null&&(d.matrix.fromArray(m.transform.matrix),d.matrix.decompose(d.position,d.rotation,d.scale),d.matrixWorldNeedsUpdate=!0,d.jointRadius=m.radius),d.visible=m!==null}const h=c.joints["index-finger-tip"],u=c.joints["thumb-tip"],f=h.position.distanceTo(u.position),p=.02,_=.005;c.inputState.pinching&&f>p+_?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!c.inputState.pinching&&f<=p-_&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else l!==null&&e.gripSpace&&(r=t.getPose(e.gripSpace,n),r!==null&&(l.matrix.fromArray(r.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,r.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(r.linearVelocity)):l.hasLinearVelocity=!1,r.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(r.angularVelocity)):l.hasAngularVelocity=!1));a!==null&&(s=t.getPose(e.targetRaySpace,n),s===null&&r!==null&&(s=r),s!==null&&(a.matrix.fromArray(s.transform.matrix),a.matrix.decompose(a.position,a.rotation,a.scale),a.matrixWorldNeedsUpdate=!0,s.linearVelocity?(a.hasLinearVelocity=!0,a.linearVelocity.copy(s.linearVelocity)):a.hasLinearVelocity=!1,s.angularVelocity?(a.hasAngularVelocity=!0,a.angularVelocity.copy(s.angularVelocity)):a.hasAngularVelocity=!1,this.dispatchEvent(Bh)))}return a!==null&&(a.visible=s!==null),l!==null&&(l.visible=r!==null),c!==null&&(c.visible=o!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){const n=new zi;n.matrixAutoUpdate=!1,n.visible=!1,e.joints[t.jointName]=n,e.add(n)}return e.joints[t.jointName]}}class Ua extends At{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new gn,this.environmentIntensity=1,this.environmentRotation=new gn,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){const t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(t.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(t.object.backgroundIntensity=this.backgroundIntensity),t.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(t.object.environmentIntensity=this.environmentIntensity),t.object.environmentRotation=this.environmentRotation.toArray(),t}}class zh extends vt{constructor(e=null,t=1,n=1,s,r,o,a,l,c=ht,h=ht,u,f){super(null,o,a,l,c,h,s,r,u,f),this.isDataTexture=!0,this.image={data:e,width:t,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}const vr=new F,kh=new F,Hh=new Fe;class Wn{constructor(e=new F(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,n,s){return this.normal.set(e,t,n),this.constant=s,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,n){const s=vr.subVectors(n,t).cross(kh.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(s,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){const e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t){const n=e.delta(vr),s=this.normal.dot(n);if(s===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;const r=-(e.start.dot(this.normal)+this.constant)/s;return r<0||r>1?null:t.copy(e.start).addScaledVector(n,r)}intersectsLine(e){const t=this.distanceToPoint(e.start),n=this.distanceToPoint(e.end);return t<0&&n>0||n<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){const n=t||Hh.getNormalMatrix(e),s=this.coplanarPoint(vr).applyMatrix4(e),r=this.normal.applyMatrix3(n).normalize();return this.constant=-s.dot(r),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}}const Hn=new Qi,Gh=new $e(.5,.5),Ms=new F;class Il{constructor(e=new Wn,t=new Wn,n=new Wn,s=new Wn,r=new Wn,o=new Wn){this.planes=[e,t,n,s,r,o]}set(e,t,n,s,r,o){const a=this.planes;return a[0].copy(e),a[1].copy(t),a[2].copy(n),a[3].copy(s),a[4].copy(r),a[5].copy(o),this}copy(e){const t=this.planes;for(let n=0;n<6;n++)t[n].copy(e.planes[n]);return this}setFromProjectionMatrix(e,t=nn,n=!1){const s=this.planes,r=e.elements,o=r[0],a=r[1],l=r[2],c=r[3],h=r[4],u=r[5],f=r[6],p=r[7],_=r[8],v=r[9],m=r[10],d=r[11],w=r[12],T=r[13],M=r[14],C=r[15];if(s[0].setComponents(c-o,p-h,d-_,C-w).normalize(),s[1].setComponents(c+o,p+h,d+_,C+w).normalize(),s[2].setComponents(c+a,p+u,d+v,C+T).normalize(),s[3].setComponents(c-a,p-u,d-v,C-T).normalize(),n)s[4].setComponents(l,f,m,M).normalize(),s[5].setComponents(c-l,p-f,d-m,C-M).normalize();else if(s[4].setComponents(c-l,p-f,d-m,C-M).normalize(),t===nn)s[5].setComponents(c+l,p+f,d+m,C+M).normalize();else if(t===Bs)s[5].setComponents(l,f,m,M).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),Hn.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{const t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),Hn.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(Hn)}intersectsSprite(e){Hn.center.set(0,0,0);const t=Gh.distanceTo(e.center);return Hn.radius=.7071067811865476+t,Hn.applyMatrix4(e.matrixWorld),this.intersectsSphere(Hn)}intersectsSphere(e){const t=this.planes,n=e.center,s=-e.radius;for(let r=0;r<6;r++)if(t[r].distanceToPoint(n)<s)return!1;return!0}intersectsBox(e){const t=this.planes;for(let n=0;n<6;n++){const s=t[n];if(Ms.x=s.normal.x>0?e.max.x:e.min.x,Ms.y=s.normal.y>0?e.max.y:e.min.y,Ms.z=s.normal.z>0?e.max.z:e.min.z,s.distanceToPoint(Ms)<0)return!1}return!0}containsPoint(e){const t=this.planes;for(let n=0;n<6;n++)if(t[n].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}class Fl extends Pi{constructor(e){super(),this.isLineBasicMaterial=!0,this.type="LineBasicMaterial",this.color=new ze(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.linewidth=e.linewidth,this.linecap=e.linecap,this.linejoin=e.linejoin,this.fog=e.fog,this}}const ks=new F,Hs=new F,Mo=new ut,Oi=new Da,Ss=new Qi,xr=new F,So=new F;class Vh extends At{constructor(e=new It,t=new Fl){super(),this.isLine=!0,this.type="Line",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}computeLineDistances(){const e=this.geometry;if(e.index===null){const t=e.attributes.position,n=[0];for(let s=1,r=t.count;s<r;s++)ks.fromBufferAttribute(t,s-1),Hs.fromBufferAttribute(t,s),n[s]=n[s-1],n[s]+=ks.distanceTo(Hs);e.setAttribute("lineDistance",new Vt(n,1))}else console.warn("THREE.Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}raycast(e,t){const n=this.geometry,s=this.matrixWorld,r=e.params.Line.threshold,o=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Ss.copy(n.boundingSphere),Ss.applyMatrix4(s),Ss.radius+=r,e.ray.intersectsSphere(Ss)===!1)return;Mo.copy(s).invert(),Oi.copy(e.ray).applyMatrix4(Mo);const a=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=a*a,c=this.isLineSegments?2:1,h=n.index,f=n.attributes.position;if(h!==null){const p=Math.max(0,o.start),_=Math.min(h.count,o.start+o.count);for(let v=p,m=_-1;v<m;v+=c){const d=h.getX(v),w=h.getX(v+1),T=Es(this,e,Oi,l,d,w,v);T&&t.push(T)}if(this.isLineLoop){const v=h.getX(_-1),m=h.getX(p),d=Es(this,e,Oi,l,v,m,_-1);d&&t.push(d)}}else{const p=Math.max(0,o.start),_=Math.min(f.count,o.start+o.count);for(let v=p,m=_-1;v<m;v+=c){const d=Es(this,e,Oi,l,v,v+1,v);d&&t.push(d)}if(this.isLineLoop){const v=Es(this,e,Oi,l,_-1,p,_-1);v&&t.push(v)}}}updateMorphTargets(){const t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){const s=t[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,o=s.length;r<o;r++){const a=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=r}}}}}function Es(i,e,t,n,s,r,o){const a=i.geometry.attributes.position;if(ks.fromBufferAttribute(a,s),Hs.fromBufferAttribute(a,r),t.distanceSqToSegment(ks,Hs,xr,So)>n)return;xr.applyMatrix4(i.matrixWorld);const c=e.ray.origin.distanceTo(xr);if(!(c<e.near||c>e.far))return{distance:c,point:So.clone().applyMatrix4(i.matrixWorld),index:o,face:null,faceIndex:null,barycoord:null,object:i}}const Eo=new F,yo=new F;class Wh extends Vh{constructor(e,t){super(e,t),this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){const e=this.geometry;if(e.index===null){const t=e.attributes.position,n=[];for(let s=0,r=t.count;s<r;s+=2)Eo.fromBufferAttribute(t,s),yo.fromBufferAttribute(t,s+1),n[s]=s===0?0:n[s-1],n[s+1]=n[s]+Eo.distanceTo(yo);e.setAttribute("lineDistance",new Vt(n,1))}else console.warn("THREE.LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}}class Xh extends Pi{constructor(e){super(),this.isPointsMaterial=!0,this.type="PointsMaterial",this.color=new ze(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.size=e.size,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}}const To=new ut,xa=new Da,ys=new Qi,Ts=new F;class qh extends At{constructor(e=new It,t=new Xh){super(),this.isPoints=!0,this.type="Points",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}raycast(e,t){const n=this.geometry,s=this.matrixWorld,r=e.params.Points.threshold,o=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),ys.copy(n.boundingSphere),ys.applyMatrix4(s),ys.radius+=r,e.ray.intersectsSphere(ys)===!1)return;To.copy(s).invert(),xa.copy(e.ray).applyMatrix4(To);const a=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=a*a,c=n.index,u=n.attributes.position;if(c!==null){const f=Math.max(0,o.start),p=Math.min(c.count,o.start+o.count);for(let _=f,v=p;_<v;_++){const m=c.getX(_);Ts.fromBufferAttribute(u,m),bo(Ts,m,l,s,e,t,this)}}else{const f=Math.max(0,o.start),p=Math.min(u.count,o.start+o.count);for(let _=f,v=p;_<v;_++)Ts.fromBufferAttribute(u,_),bo(Ts,_,l,s,e,t,this)}}updateMorphTargets(){const t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){const s=t[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,o=s.length;r<o;r++){const a=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=r}}}}}function bo(i,e,t,n,s,r,o){const a=xa.distanceSqToPoint(i);if(a<t){const l=new F;xa.closestPointToPoint(i,l),l.applyMatrix4(n);const c=s.ray.origin.distanceTo(l);if(c<s.near||c>s.far)return;r.push({distance:c,distanceToRay:Math.sqrt(a),point:l,index:e,face:null,faceIndex:null,barycoord:null,object:o})}}class Yh extends vt{constructor(e,t,n,s,r,o,a,l,c){super(e,t,n,s,r,o,a,l,c),this.isCanvasTexture=!0,this.needsUpdate=!0}}class Nl extends vt{constructor(e,t,n=jn,s,r,o,a=ht,l=ht,c,h=Yi,u=1){if(h!==Yi&&h!==$i)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");const f={width:e,height:t,depth:u};super(f,s,r,o,a,l,h,n,c),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new Pa(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){const t=super.toJSON(e);return this.compareFunction!==null&&(t.compareFunction=this.compareFunction),t}}class Ol extends vt{constructor(e=null){super(),this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}}class Fn extends It{constructor(e=1,t=1,n=1,s=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:n,heightSegments:s};const r=e/2,o=t/2,a=Math.floor(n),l=Math.floor(s),c=a+1,h=l+1,u=e/a,f=t/l,p=[],_=[],v=[],m=[];for(let d=0;d<h;d++){const w=d*f-o;for(let T=0;T<c;T++){const M=T*u-r;_.push(M,-w,0),v.push(0,0,1),m.push(T/a),m.push(1-d/l)}}for(let d=0;d<l;d++)for(let w=0;w<a;w++){const T=w+c*d,M=w+c*(d+1),C=w+1+c*(d+1),R=w+1+c*d;p.push(T,M,R),p.push(M,C,R)}this.setIndex(p),this.setAttribute("position",new Vt(_,3)),this.setAttribute("normal",new Vt(v,3)),this.setAttribute("uv",new Vt(m,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Fn(e.width,e.height,e.widthSegments,e.heightSegments)}}class Ia extends It{constructor(e=1,t=32,n=16,s=0,r=Math.PI*2,o=0,a=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:e,widthSegments:t,heightSegments:n,phiStart:s,phiLength:r,thetaStart:o,thetaLength:a},t=Math.max(3,Math.floor(t)),n=Math.max(2,Math.floor(n));const l=Math.min(o+a,Math.PI);let c=0;const h=[],u=new F,f=new F,p=[],_=[],v=[],m=[];for(let d=0;d<=n;d++){const w=[],T=d/n;let M=0;d===0&&o===0?M=.5/t:d===n&&l===Math.PI&&(M=-.5/t);for(let C=0;C<=t;C++){const R=C/t;u.x=-e*Math.cos(s+R*r)*Math.sin(o+T*a),u.y=e*Math.cos(o+T*a),u.z=e*Math.sin(s+R*r)*Math.sin(o+T*a),_.push(u.x,u.y,u.z),f.copy(u).normalize(),v.push(f.x,f.y,f.z),m.push(R+M,1-T),w.push(c++)}h.push(w)}for(let d=0;d<n;d++)for(let w=0;w<t;w++){const T=h[d][w+1],M=h[d][w],C=h[d+1][w],R=h[d+1][w+1];(d!==0||o>0)&&p.push(T,M,R),(d!==n-1||l<Math.PI)&&p.push(M,C,R)}this.setIndex(p),this.setAttribute("position",new Vt(_,3)),this.setAttribute("normal",new Vt(v,3)),this.setAttribute("uv",new Vt(m,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Ia(e.radius,e.widthSegments,e.heightSegments,e.phiStart,e.phiLength,e.thetaStart,e.thetaLength)}}class $h extends Pi{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=kc,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}}class Kh extends Pi{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}}class Fa extends Ll{constructor(e=-1,t=1,n=1,s=-1,r=.1,o=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=n,this.bottom=s,this.near=r,this.far=o,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,n,s,r,o){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,s=(this.top+this.bottom)/2;let r=n-e,o=n+e,a=s+t,l=s-t;if(this.view!==null&&this.view.enabled){const c=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=c*this.view.offsetX,o=r+c*this.view.width,a-=h*this.view.offsetY,l=a-h*this.view.height}this.projectionMatrix.makeOrthographic(r,o,a,l,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}}class Zh extends kt{constructor(e=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e}}function wo(i,e,t,n){const s=jh(n);switch(t){case Ml:return i*e;case El:return i*e/s.components*s.byteLength;case wa:return i*e/s.components*s.byteLength;case yl:return i*e*2/s.components*s.byteLength;case Aa:return i*e*2/s.components*s.byteLength;case Sl:return i*e*3/s.components*s.byteLength;case Gt:return i*e*4/s.components*s.byteLength;case Ra:return i*e*4/s.components*s.byteLength;case Cs:case Ps:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*8;case Ds:case Ls:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case qr:case $r:return Math.max(i,16)*Math.max(e,8)/4;case Xr:case Yr:return Math.max(i,8)*Math.max(e,8)/2;case Kr:case Zr:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*8;case jr:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case Jr:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case Qr:return Math.floor((i+4)/5)*Math.floor((e+3)/4)*16;case ea:return Math.floor((i+4)/5)*Math.floor((e+4)/5)*16;case ta:return Math.floor((i+5)/6)*Math.floor((e+4)/5)*16;case na:return Math.floor((i+5)/6)*Math.floor((e+5)/6)*16;case ia:return Math.floor((i+7)/8)*Math.floor((e+4)/5)*16;case sa:return Math.floor((i+7)/8)*Math.floor((e+5)/6)*16;case ra:return Math.floor((i+7)/8)*Math.floor((e+7)/8)*16;case aa:return Math.floor((i+9)/10)*Math.floor((e+4)/5)*16;case oa:return Math.floor((i+9)/10)*Math.floor((e+5)/6)*16;case la:return Math.floor((i+9)/10)*Math.floor((e+7)/8)*16;case ca:return Math.floor((i+9)/10)*Math.floor((e+9)/10)*16;case ha:return Math.floor((i+11)/12)*Math.floor((e+9)/10)*16;case ua:return Math.floor((i+11)/12)*Math.floor((e+11)/12)*16;case da:case fa:case pa:return Math.ceil(i/4)*Math.ceil(e/4)*16;case ma:case ga:return Math.ceil(i/4)*Math.ceil(e/4)*8;case _a:case va:return Math.ceil(i/4)*Math.ceil(e/4)*16}throw new Error(`Unable to determine texture byte length for ${t} format.`)}function jh(i){switch(i){case mn:case gl:return{byteLength:1,components:1};case Xi:case _l:case ji:return{byteLength:2,components:1};case Ta:case ba:return{byteLength:2,components:4};case jn:case ya:case fn:return{byteLength:4,components:1};case vl:case xl:return{byteLength:4,components:3}}throw new Error(`Unknown texture type ${i}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:Ea}}));typeof window<"u"&&(window.__THREE__?console.warn("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=Ea);function Bl(){let i=null,e=!1,t=null,n=null;function s(r,o){t(r,o),n=i.requestAnimationFrame(s)}return{start:function(){e!==!0&&t!==null&&(n=i.requestAnimationFrame(s),e=!0)},stop:function(){i.cancelAnimationFrame(n),e=!1},setAnimationLoop:function(r){t=r},setContext:function(r){i=r}}}function Jh(i){const e=new WeakMap;function t(a,l){const c=a.array,h=a.usage,u=c.byteLength,f=i.createBuffer();i.bindBuffer(l,f),i.bufferData(l,c,h),a.onUploadCallback();let p;if(c instanceof Float32Array)p=i.FLOAT;else if(typeof Float16Array<"u"&&c instanceof Float16Array)p=i.HALF_FLOAT;else if(c instanceof Uint16Array)a.isFloat16BufferAttribute?p=i.HALF_FLOAT:p=i.UNSIGNED_SHORT;else if(c instanceof Int16Array)p=i.SHORT;else if(c instanceof Uint32Array)p=i.UNSIGNED_INT;else if(c instanceof Int32Array)p=i.INT;else if(c instanceof Int8Array)p=i.BYTE;else if(c instanceof Uint8Array)p=i.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)p=i.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:f,type:p,bytesPerElement:c.BYTES_PER_ELEMENT,version:a.version,size:u}}function n(a,l,c){const h=l.array,u=l.updateRanges;if(i.bindBuffer(c,a),u.length===0)i.bufferSubData(c,0,h);else{u.sort((p,_)=>p.start-_.start);let f=0;for(let p=1;p<u.length;p++){const _=u[f],v=u[p];v.start<=_.start+_.count+1?_.count=Math.max(_.count,v.start+v.count-_.start):(++f,u[f]=v)}u.length=f+1;for(let p=0,_=u.length;p<_;p++){const v=u[p];i.bufferSubData(c,v.start*h.BYTES_PER_ELEMENT,h,v.start,v.count)}l.clearUpdateRanges()}l.onUploadCallback()}function s(a){return a.isInterleavedBufferAttribute&&(a=a.data),e.get(a)}function r(a){a.isInterleavedBufferAttribute&&(a=a.data);const l=e.get(a);l&&(i.deleteBuffer(l.buffer),e.delete(a))}function o(a,l){if(a.isInterleavedBufferAttribute&&(a=a.data),a.isGLBufferAttribute){const h=e.get(a);(!h||h.version<a.version)&&e.set(a,{buffer:a.buffer,type:a.type,bytesPerElement:a.elementSize,version:a.version});return}const c=e.get(a);if(c===void 0)e.set(a,t(a,l));else if(c.version<a.version){if(c.size!==a.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");n(c.buffer,a,l),c.version=a.version}}return{get:s,remove:r,update:o}}var Qh=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,eu=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,tu=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,nu=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,iu=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,su=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,ru=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,au=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,ou=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec3 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 ).rgb;
	}
#endif`,lu=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,cu=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,hu=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,uu=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,du=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,fu=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,pu=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,mu=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,gu=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,_u=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,vu=`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,xu=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,Mu=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec3 vColor;
#endif`,Su=`#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif
#ifdef USE_BATCHING_COLOR
	vec3 batchingColor = getBatchingColor( getIndirectIndex( gl_DrawID ) );
	vColor.xyz *= batchingColor.xyz;
#endif`,Eu=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
mat3 transposeMat3( const in mat3 m ) {
	mat3 tmp;
	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
	return tmp;
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,yu=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,Tu=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,bu=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,wu=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,Au=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,Ru=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,Cu="gl_FragColor = linearToOutputTexel( gl_FragColor );",Pu=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,Du=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
	#else
		vec4 envColor = vec4( 0.0 );
	#endif
	#ifdef ENVMAP_BLENDING_MULTIPLY
		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_MIX )
		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_ADD )
		outgoingLight += envColor.xyz * specularStrength * reflectivity;
	#endif
#endif`,Lu=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,Uu=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,Iu=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,Fu=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,Nu=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,Ou=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,Bu=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,zu=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,ku=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,Hu=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,Gu=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,Vu=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,Wu=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif`,Xu=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,qu=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,Yu=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,$u=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,Ku=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,Zu=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = mix( min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.07, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,ju=`struct PhysicalMaterial {
	vec3 diffuseColor;
	float roughness;
	vec3 specularColor;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		float v = 0.5 / ( gv + gl );
		return saturate(v);
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColor;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float a = roughness < 0.25 ? -339.2 * r2 + 161.4 * roughness - 25.9 : -8.48 * r2 + 14.3 * roughness - 9.95;
	float b = roughness < 0.25 ? 44.0 * r2 - 23.7 * roughness + 3.26 : 1.97 * r2 - 3.27 * roughness + 0.72;
	float DG = exp( a * dotNV + b ) + ( roughness < 0.25 ? 0.0 : 0.1 * ( roughness - 0.25 ) );
	return saturate( DG * RECIPROCAL_PI );
}
vec2 DFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
	vec4 r = roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
	vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;
	return fab;
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
	#endif
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnel, material.roughness, singleScattering, multiScattering );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering );
	#endif
	vec3 totalScattering = singleScattering + multiScattering;
	vec3 diffuse = material.diffuseColor * ( 1.0 - max( max( totalScattering.r, totalScattering.g ), totalScattering.b ) );
	reflectedLight.indirectSpecular += radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,Ju=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnel = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,Qu=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
		iblIrradiance += getIBLIrradiance( geometryNormal );
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,ed=`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,td=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,nd=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,id=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,sd=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,rd=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,ad=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,od=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,ld=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,cd=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,hd=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,ud=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,dd=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,fd=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,pd=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,md=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,gd=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,_d=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,vd=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,xd=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Md=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,Sd=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,Ed=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,yd=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,Td=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,bd=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,wd=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,Ad=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return depth * ( near - far ) - near;
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return ( near * far ) / ( ( far - near ) * depth - far );
}`,Rd=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,Cd=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,Pd=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,Dd=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,Ld=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,Ud=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,Id=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
		float depth = unpackRGBAToDepth( texture2D( depths, uv ) );
		#ifdef USE_REVERSED_DEPTH_BUFFER
			return step( depth, compare );
		#else
			return step( compare, depth );
		#endif
	}
	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {
		return unpackRGBATo2Half( texture2D( shadow, uv ) );
	}
	float VSMShadow( sampler2D shadow, vec2 uv, float compare ) {
		float occlusion = 1.0;
		vec2 distribution = texture2DDistribution( shadow, uv );
		#ifdef USE_REVERSED_DEPTH_BUFFER
			float hard_shadow = step( distribution.x, compare );
		#else
			float hard_shadow = step( compare, distribution.x );
		#endif
		if ( hard_shadow != 1.0 ) {
			float distance = compare - distribution.x;
			float variance = max( 0.00000, distribution.y * distribution.y );
			float softness_probability = variance / (variance + distance * distance );			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 );			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );
		}
		return occlusion;
	}
	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		float shadow = 1.0;
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
		if ( frustumTest ) {
		#if defined( SHADOWMAP_TYPE_PCF )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx0 = - texelSize.x * shadowRadius;
			float dy0 = - texelSize.y * shadowRadius;
			float dx1 = + texelSize.x * shadowRadius;
			float dy1 = + texelSize.y * shadowRadius;
			float dx2 = dx0 / 2.0;
			float dy2 = dy0 / 2.0;
			float dx3 = dx1 / 2.0;
			float dy3 = dy1 / 2.0;
			shadow = (
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
			) * ( 1.0 / 17.0 );
		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx = texelSize.x;
			float dy = texelSize.y;
			vec2 uv = shadowCoord.xy;
			vec2 f = fract( uv * shadowMapSize + 0.5 );
			uv -= f * texelSize;
			shadow = (
				texture2DCompare( shadowMap, uv, shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),
						  f.x ),
					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),
						  f.x ),
					 f.y )
			) * ( 1.0 / 9.0 );
		#elif defined( SHADOWMAP_TYPE_VSM )
			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );
		#else
			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );
		#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	vec2 cubeToUV( vec3 v, float texelSizeY ) {
		vec3 absV = abs( v );
		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
		absV *= scaleToCube;
		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );
		vec2 planar = v.xy;
		float almostATexel = 1.5 * texelSizeY;
		float almostOne = 1.0 - almostATexel;
		if ( absV.z >= almostOne ) {
			if ( v.z > 0.0 )
				planar.x = 4.0 - v.x;
		} else if ( absV.x >= almostOne ) {
			float signX = sign( v.x );
			planar.x = v.z * signX + 2.0 * signX;
		} else if ( absV.y >= almostOne ) {
			float signY = sign( v.y );
			planar.x = v.x + 2.0 * signY + 2.0;
			planar.y = v.z * signY - 2.0;
		}
		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );
	}
	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		
		float lightToPositionLength = length( lightToPosition );
		if ( lightToPositionLength - shadowCameraFar <= 0.0 && lightToPositionLength - shadowCameraNear >= 0.0 ) {
			float dp = ( lightToPositionLength - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );
			#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )
				vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;
				shadow = (
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )
				) * ( 1.0 / 9.0 );
			#else
				shadow = texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );
			#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
#endif`,Fd=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,Nd=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,Od=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,Bd=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,zd=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,kd=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,Hd=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,Gd=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,Vd=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,Wd=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,Xd=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,qd=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,Yd=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,$d=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Kd=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Zd=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,jd=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`;const Jd=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,Qd=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,ef=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,tf=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,nf=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,sf=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,rf=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,af=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,of=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,lf=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = packDepthToRGBA( dist );
}`,cf=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,hf=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,uf=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,df=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,ff=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,pf=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,mf=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,gf=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,_f=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,vf=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,xf=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,Mf=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <packing>
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( packNormalToRGB( normal ), diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,Sf=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Ef=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,yf=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,Tf=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
		float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );
		outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecularDirect + sheenSpecularIndirect;
	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,bf=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,wf=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Af=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,Rf=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Cf=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Pf=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Df=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Lf=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Oe={alphahash_fragment:Qh,alphahash_pars_fragment:eu,alphamap_fragment:tu,alphamap_pars_fragment:nu,alphatest_fragment:iu,alphatest_pars_fragment:su,aomap_fragment:ru,aomap_pars_fragment:au,batching_pars_vertex:ou,batching_vertex:lu,begin_vertex:cu,beginnormal_vertex:hu,bsdfs:uu,iridescence_fragment:du,bumpmap_pars_fragment:fu,clipping_planes_fragment:pu,clipping_planes_pars_fragment:mu,clipping_planes_pars_vertex:gu,clipping_planes_vertex:_u,color_fragment:vu,color_pars_fragment:xu,color_pars_vertex:Mu,color_vertex:Su,common:Eu,cube_uv_reflection_fragment:yu,defaultnormal_vertex:Tu,displacementmap_pars_vertex:bu,displacementmap_vertex:wu,emissivemap_fragment:Au,emissivemap_pars_fragment:Ru,colorspace_fragment:Cu,colorspace_pars_fragment:Pu,envmap_fragment:Du,envmap_common_pars_fragment:Lu,envmap_pars_fragment:Uu,envmap_pars_vertex:Iu,envmap_physical_pars_fragment:Xu,envmap_vertex:Fu,fog_vertex:Nu,fog_pars_vertex:Ou,fog_fragment:Bu,fog_pars_fragment:zu,gradientmap_pars_fragment:ku,lightmap_pars_fragment:Hu,lights_lambert_fragment:Gu,lights_lambert_pars_fragment:Vu,lights_pars_begin:Wu,lights_toon_fragment:qu,lights_toon_pars_fragment:Yu,lights_phong_fragment:$u,lights_phong_pars_fragment:Ku,lights_physical_fragment:Zu,lights_physical_pars_fragment:ju,lights_fragment_begin:Ju,lights_fragment_maps:Qu,lights_fragment_end:ed,logdepthbuf_fragment:td,logdepthbuf_pars_fragment:nd,logdepthbuf_pars_vertex:id,logdepthbuf_vertex:sd,map_fragment:rd,map_pars_fragment:ad,map_particle_fragment:od,map_particle_pars_fragment:ld,metalnessmap_fragment:cd,metalnessmap_pars_fragment:hd,morphinstance_vertex:ud,morphcolor_vertex:dd,morphnormal_vertex:fd,morphtarget_pars_vertex:pd,morphtarget_vertex:md,normal_fragment_begin:gd,normal_fragment_maps:_d,normal_pars_fragment:vd,normal_pars_vertex:xd,normal_vertex:Md,normalmap_pars_fragment:Sd,clearcoat_normal_fragment_begin:Ed,clearcoat_normal_fragment_maps:yd,clearcoat_pars_fragment:Td,iridescence_pars_fragment:bd,opaque_fragment:wd,packing:Ad,premultiplied_alpha_fragment:Rd,project_vertex:Cd,dithering_fragment:Pd,dithering_pars_fragment:Dd,roughnessmap_fragment:Ld,roughnessmap_pars_fragment:Ud,shadowmap_pars_fragment:Id,shadowmap_pars_vertex:Fd,shadowmap_vertex:Nd,shadowmask_pars_fragment:Od,skinbase_vertex:Bd,skinning_pars_vertex:zd,skinning_vertex:kd,skinnormal_vertex:Hd,specularmap_fragment:Gd,specularmap_pars_fragment:Vd,tonemapping_fragment:Wd,tonemapping_pars_fragment:Xd,transmission_fragment:qd,transmission_pars_fragment:Yd,uv_pars_fragment:$d,uv_pars_vertex:Kd,uv_vertex:Zd,worldpos_vertex:jd,background_vert:Jd,background_frag:Qd,backgroundCube_vert:ef,backgroundCube_frag:tf,cube_vert:nf,cube_frag:sf,depth_vert:rf,depth_frag:af,distanceRGBA_vert:of,distanceRGBA_frag:lf,equirect_vert:cf,equirect_frag:hf,linedashed_vert:uf,linedashed_frag:df,meshbasic_vert:ff,meshbasic_frag:pf,meshlambert_vert:mf,meshlambert_frag:gf,meshmatcap_vert:_f,meshmatcap_frag:vf,meshnormal_vert:xf,meshnormal_frag:Mf,meshphong_vert:Sf,meshphong_frag:Ef,meshphysical_vert:yf,meshphysical_frag:Tf,meshtoon_vert:bf,meshtoon_frag:wf,points_vert:Af,points_frag:Rf,shadow_vert:Cf,shadow_frag:Pf,sprite_vert:Df,sprite_frag:Lf},ae={common:{diffuse:{value:new ze(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Fe},alphaMap:{value:null},alphaMapTransform:{value:new Fe},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Fe}},envmap:{envMap:{value:null},envMapRotation:{value:new Fe},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Fe}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Fe}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Fe},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Fe},normalScale:{value:new $e(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Fe},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Fe}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Fe}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Fe}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new ze(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotShadowMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new ze(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Fe},alphaTest:{value:0},uvTransform:{value:new Fe}},sprite:{diffuse:{value:new ze(16777215)},opacity:{value:1},center:{value:new $e(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Fe},alphaMap:{value:null},alphaMapTransform:{value:new Fe},alphaTest:{value:0}}},Qt={basic:{uniforms:Tt([ae.common,ae.specularmap,ae.envmap,ae.aomap,ae.lightmap,ae.fog]),vertexShader:Oe.meshbasic_vert,fragmentShader:Oe.meshbasic_frag},lambert:{uniforms:Tt([ae.common,ae.specularmap,ae.envmap,ae.aomap,ae.lightmap,ae.emissivemap,ae.bumpmap,ae.normalmap,ae.displacementmap,ae.fog,ae.lights,{emissive:{value:new ze(0)}}]),vertexShader:Oe.meshlambert_vert,fragmentShader:Oe.meshlambert_frag},phong:{uniforms:Tt([ae.common,ae.specularmap,ae.envmap,ae.aomap,ae.lightmap,ae.emissivemap,ae.bumpmap,ae.normalmap,ae.displacementmap,ae.fog,ae.lights,{emissive:{value:new ze(0)},specular:{value:new ze(1118481)},shininess:{value:30}}]),vertexShader:Oe.meshphong_vert,fragmentShader:Oe.meshphong_frag},standard:{uniforms:Tt([ae.common,ae.envmap,ae.aomap,ae.lightmap,ae.emissivemap,ae.bumpmap,ae.normalmap,ae.displacementmap,ae.roughnessmap,ae.metalnessmap,ae.fog,ae.lights,{emissive:{value:new ze(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Oe.meshphysical_vert,fragmentShader:Oe.meshphysical_frag},toon:{uniforms:Tt([ae.common,ae.aomap,ae.lightmap,ae.emissivemap,ae.bumpmap,ae.normalmap,ae.displacementmap,ae.gradientmap,ae.fog,ae.lights,{emissive:{value:new ze(0)}}]),vertexShader:Oe.meshtoon_vert,fragmentShader:Oe.meshtoon_frag},matcap:{uniforms:Tt([ae.common,ae.bumpmap,ae.normalmap,ae.displacementmap,ae.fog,{matcap:{value:null}}]),vertexShader:Oe.meshmatcap_vert,fragmentShader:Oe.meshmatcap_frag},points:{uniforms:Tt([ae.points,ae.fog]),vertexShader:Oe.points_vert,fragmentShader:Oe.points_frag},dashed:{uniforms:Tt([ae.common,ae.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Oe.linedashed_vert,fragmentShader:Oe.linedashed_frag},depth:{uniforms:Tt([ae.common,ae.displacementmap]),vertexShader:Oe.depth_vert,fragmentShader:Oe.depth_frag},normal:{uniforms:Tt([ae.common,ae.bumpmap,ae.normalmap,ae.displacementmap,{opacity:{value:1}}]),vertexShader:Oe.meshnormal_vert,fragmentShader:Oe.meshnormal_frag},sprite:{uniforms:Tt([ae.sprite,ae.fog]),vertexShader:Oe.sprite_vert,fragmentShader:Oe.sprite_frag},background:{uniforms:{uvTransform:{value:new Fe},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Oe.background_vert,fragmentShader:Oe.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Fe}},vertexShader:Oe.backgroundCube_vert,fragmentShader:Oe.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Oe.cube_vert,fragmentShader:Oe.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Oe.equirect_vert,fragmentShader:Oe.equirect_frag},distanceRGBA:{uniforms:Tt([ae.common,ae.displacementmap,{referencePosition:{value:new F},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Oe.distanceRGBA_vert,fragmentShader:Oe.distanceRGBA_frag},shadow:{uniforms:Tt([ae.lights,ae.fog,{color:{value:new ze(0)},opacity:{value:1}}]),vertexShader:Oe.shadow_vert,fragmentShader:Oe.shadow_frag}};Qt.physical={uniforms:Tt([Qt.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Fe},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Fe},clearcoatNormalScale:{value:new $e(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Fe},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Fe},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Fe},sheen:{value:0},sheenColor:{value:new ze(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Fe},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Fe},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Fe},transmissionSamplerSize:{value:new $e},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Fe},attenuationDistance:{value:0},attenuationColor:{value:new ze(0)},specularColor:{value:new ze(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Fe},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Fe},anisotropyVector:{value:new $e},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Fe}}]),vertexShader:Oe.meshphysical_vert,fragmentShader:Oe.meshphysical_frag};const bs={r:0,b:0,g:0},Gn=new gn,Uf=new ut;function If(i,e,t,n,s,r,o){const a=new ze(0);let l=r===!0?0:1,c,h,u=null,f=0,p=null;function _(T){let M=T.isScene===!0?T.background:null;return M&&M.isTexture&&(M=(T.backgroundBlurriness>0?t:e).get(M)),M}function v(T){let M=!1;const C=_(T);C===null?d(a,l):C&&C.isColor&&(d(C,1),M=!0);const R=i.xr.getEnvironmentBlendMode();R==="additive"?n.buffers.color.setClear(0,0,0,1,o):R==="alpha-blend"&&n.buffers.color.setClear(0,0,0,0,o),(i.autoClear||M)&&(n.buffers.depth.setTest(!0),n.buffers.depth.setMask(!0),n.buffers.color.setMask(!0),i.clear(i.autoClearColor,i.autoClearDepth,i.autoClearStencil))}function m(T,M){const C=_(M);C&&(C.isCubeTexture||C.mapping===Xs)?(h===void 0&&(h=new bt(new es(1,1,1),new Ct({name:"BackgroundCubeMaterial",uniforms:Ti(Qt.backgroundCube.uniforms),vertexShader:Qt.backgroundCube.vertexShader,fragmentShader:Qt.backgroundCube.fragmentShader,side:wt,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),h.geometry.deleteAttribute("normal"),h.geometry.deleteAttribute("uv"),h.onBeforeRender=function(R,P,N){this.matrixWorld.copyPosition(N.matrixWorld)},Object.defineProperty(h.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),s.update(h)),Gn.copy(M.backgroundRotation),Gn.x*=-1,Gn.y*=-1,Gn.z*=-1,C.isCubeTexture&&C.isRenderTargetTexture===!1&&(Gn.y*=-1,Gn.z*=-1),h.material.uniforms.envMap.value=C,h.material.uniforms.flipEnvMap.value=C.isCubeTexture&&C.isRenderTargetTexture===!1?-1:1,h.material.uniforms.backgroundBlurriness.value=M.backgroundBlurriness,h.material.uniforms.backgroundIntensity.value=M.backgroundIntensity,h.material.uniforms.backgroundRotation.value.setFromMatrix4(Uf.makeRotationFromEuler(Gn)),h.material.toneMapped=Ve.getTransfer(C.colorSpace)!==Je,(u!==C||f!==C.version||p!==i.toneMapping)&&(h.material.needsUpdate=!0,u=C,f=C.version,p=i.toneMapping),h.layers.enableAll(),T.unshift(h,h.geometry,h.material,0,0,null)):C&&C.isTexture&&(c===void 0&&(c=new bt(new Fn(2,2),new Ct({name:"BackgroundMaterial",uniforms:Ti(Qt.background.uniforms),vertexShader:Qt.background.vertexShader,fragmentShader:Qt.background.fragmentShader,side:Un,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),Object.defineProperty(c.material,"map",{get:function(){return this.uniforms.t2D.value}}),s.update(c)),c.material.uniforms.t2D.value=C,c.material.uniforms.backgroundIntensity.value=M.backgroundIntensity,c.material.toneMapped=Ve.getTransfer(C.colorSpace)!==Je,C.matrixAutoUpdate===!0&&C.updateMatrix(),c.material.uniforms.uvTransform.value.copy(C.matrix),(u!==C||f!==C.version||p!==i.toneMapping)&&(c.material.needsUpdate=!0,u=C,f=C.version,p=i.toneMapping),c.layers.enableAll(),T.unshift(c,c.geometry,c.material,0,0,null))}function d(T,M){T.getRGB(bs,Dl(i)),n.buffers.color.setClear(bs.r,bs.g,bs.b,M,o)}function w(){h!==void 0&&(h.geometry.dispose(),h.material.dispose(),h=void 0),c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0)}return{getClearColor:function(){return a},setClearColor:function(T,M=1){a.set(T),l=M,d(a,l)},getClearAlpha:function(){return l},setClearAlpha:function(T){l=T,d(a,l)},render:v,addToRenderList:m,dispose:w}}function Ff(i,e){const t=i.getParameter(i.MAX_VERTEX_ATTRIBS),n={},s=f(null);let r=s,o=!1;function a(S,L,k,X,Z){let Y=!1;const G=u(X,k,L);r!==G&&(r=G,c(r.object)),Y=p(S,X,k,Z),Y&&_(S,X,k,Z),Z!==null&&e.update(Z,i.ELEMENT_ARRAY_BUFFER),(Y||o)&&(o=!1,M(S,L,k,X),Z!==null&&i.bindBuffer(i.ELEMENT_ARRAY_BUFFER,e.get(Z).buffer))}function l(){return i.createVertexArray()}function c(S){return i.bindVertexArray(S)}function h(S){return i.deleteVertexArray(S)}function u(S,L,k){const X=k.wireframe===!0;let Z=n[S.id];Z===void 0&&(Z={},n[S.id]=Z);let Y=Z[L.id];Y===void 0&&(Y={},Z[L.id]=Y);let G=Y[X];return G===void 0&&(G=f(l()),Y[X]=G),G}function f(S){const L=[],k=[],X=[];for(let Z=0;Z<t;Z++)L[Z]=0,k[Z]=0,X[Z]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:L,enabledAttributes:k,attributeDivisors:X,object:S,attributes:{},index:null}}function p(S,L,k,X){const Z=r.attributes,Y=L.attributes;let G=0;const A=k.getAttributes();for(const W in A)if(A[W].location>=0){const ue=Z[W];let xe=Y[W];if(xe===void 0&&(W==="instanceMatrix"&&S.instanceMatrix&&(xe=S.instanceMatrix),W==="instanceColor"&&S.instanceColor&&(xe=S.instanceColor)),ue===void 0||ue.attribute!==xe||xe&&ue.data!==xe.data)return!0;G++}return r.attributesNum!==G||r.index!==X}function _(S,L,k,X){const Z={},Y=L.attributes;let G=0;const A=k.getAttributes();for(const W in A)if(A[W].location>=0){let ue=Y[W];ue===void 0&&(W==="instanceMatrix"&&S.instanceMatrix&&(ue=S.instanceMatrix),W==="instanceColor"&&S.instanceColor&&(ue=S.instanceColor));const xe={};xe.attribute=ue,ue&&ue.data&&(xe.data=ue.data),Z[W]=xe,G++}r.attributes=Z,r.attributesNum=G,r.index=X}function v(){const S=r.newAttributes;for(let L=0,k=S.length;L<k;L++)S[L]=0}function m(S){d(S,0)}function d(S,L){const k=r.newAttributes,X=r.enabledAttributes,Z=r.attributeDivisors;k[S]=1,X[S]===0&&(i.enableVertexAttribArray(S),X[S]=1),Z[S]!==L&&(i.vertexAttribDivisor(S,L),Z[S]=L)}function w(){const S=r.newAttributes,L=r.enabledAttributes;for(let k=0,X=L.length;k<X;k++)L[k]!==S[k]&&(i.disableVertexAttribArray(k),L[k]=0)}function T(S,L,k,X,Z,Y,G){G===!0?i.vertexAttribIPointer(S,L,k,Z,Y):i.vertexAttribPointer(S,L,k,X,Z,Y)}function M(S,L,k,X){v();const Z=X.attributes,Y=k.getAttributes(),G=L.defaultAttributeValues;for(const A in Y){const W=Y[A];if(W.location>=0){let ie=Z[A];if(ie===void 0&&(A==="instanceMatrix"&&S.instanceMatrix&&(ie=S.instanceMatrix),A==="instanceColor"&&S.instanceColor&&(ie=S.instanceColor)),ie!==void 0){const ue=ie.normalized,xe=ie.itemSize,Ne=e.get(ie);if(Ne===void 0)continue;const Ke=Ne.buffer,Qe=Ne.type,Ge=Ne.bytesPerElement,$=Qe===i.INT||Qe===i.UNSIGNED_INT||ie.gpuType===ya;if(ie.isInterleavedBufferAttribute){const j=ie.data,de=j.stride,he=ie.offset;if(j.isInstancedInterleavedBuffer){for(let ge=0;ge<W.locationSize;ge++)d(W.location+ge,j.meshPerAttribute);S.isInstancedMesh!==!0&&X._maxInstanceCount===void 0&&(X._maxInstanceCount=j.meshPerAttribute*j.count)}else for(let ge=0;ge<W.locationSize;ge++)m(W.location+ge);i.bindBuffer(i.ARRAY_BUFFER,Ke);for(let ge=0;ge<W.locationSize;ge++)T(W.location+ge,xe/W.locationSize,Qe,ue,de*Ge,(he+xe/W.locationSize*ge)*Ge,$)}else{if(ie.isInstancedBufferAttribute){for(let j=0;j<W.locationSize;j++)d(W.location+j,ie.meshPerAttribute);S.isInstancedMesh!==!0&&X._maxInstanceCount===void 0&&(X._maxInstanceCount=ie.meshPerAttribute*ie.count)}else for(let j=0;j<W.locationSize;j++)m(W.location+j);i.bindBuffer(i.ARRAY_BUFFER,Ke);for(let j=0;j<W.locationSize;j++)T(W.location+j,xe/W.locationSize,Qe,ue,xe*Ge,xe/W.locationSize*j*Ge,$)}}else if(G!==void 0){const ue=G[A];if(ue!==void 0)switch(ue.length){case 2:i.vertexAttrib2fv(W.location,ue);break;case 3:i.vertexAttrib3fv(W.location,ue);break;case 4:i.vertexAttrib4fv(W.location,ue);break;default:i.vertexAttrib1fv(W.location,ue)}}}}w()}function C(){N();for(const S in n){const L=n[S];for(const k in L){const X=L[k];for(const Z in X)h(X[Z].object),delete X[Z];delete L[k]}delete n[S]}}function R(S){if(n[S.id]===void 0)return;const L=n[S.id];for(const k in L){const X=L[k];for(const Z in X)h(X[Z].object),delete X[Z];delete L[k]}delete n[S.id]}function P(S){for(const L in n){const k=n[L];if(k[S.id]===void 0)continue;const X=k[S.id];for(const Z in X)h(X[Z].object),delete X[Z];delete k[S.id]}}function N(){E(),o=!0,r!==s&&(r=s,c(r.object))}function E(){s.geometry=null,s.program=null,s.wireframe=!1}return{setup:a,reset:N,resetDefaultState:E,dispose:C,releaseStatesOfGeometry:R,releaseStatesOfProgram:P,initAttributes:v,enableAttribute:m,disableUnusedAttributes:w}}function Nf(i,e,t){let n;function s(c){n=c}function r(c,h){i.drawArrays(n,c,h),t.update(h,n,1)}function o(c,h,u){u!==0&&(i.drawArraysInstanced(n,c,h,u),t.update(h,n,u))}function a(c,h,u){if(u===0)return;e.get("WEBGL_multi_draw").multiDrawArraysWEBGL(n,c,0,h,0,u);let p=0;for(let _=0;_<u;_++)p+=h[_];t.update(p,n,1)}function l(c,h,u,f){if(u===0)return;const p=e.get("WEBGL_multi_draw");if(p===null)for(let _=0;_<c.length;_++)o(c[_],h[_],f[_]);else{p.multiDrawArraysInstancedWEBGL(n,c,0,h,0,f,0,u);let _=0;for(let v=0;v<u;v++)_+=h[v]*f[v];t.update(_,n,1)}}this.setMode=s,this.render=r,this.renderInstances=o,this.renderMultiDraw=a,this.renderMultiDrawInstances=l}function Of(i,e,t,n){let s;function r(){if(s!==void 0)return s;if(e.has("EXT_texture_filter_anisotropic")===!0){const P=e.get("EXT_texture_filter_anisotropic");s=i.getParameter(P.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else s=0;return s}function o(P){return!(P!==Gt&&n.convert(P)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_FORMAT))}function a(P){const N=P===ji&&(e.has("EXT_color_buffer_half_float")||e.has("EXT_color_buffer_float"));return!(P!==mn&&n.convert(P)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_TYPE)&&P!==fn&&!N)}function l(P){if(P==="highp"){if(i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.HIGH_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.HIGH_FLOAT).precision>0)return"highp";P="mediump"}return P==="mediump"&&i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.MEDIUM_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=t.precision!==void 0?t.precision:"highp";const h=l(c);h!==c&&(console.warn("THREE.WebGLRenderer:",c,"not supported, using",h,"instead."),c=h);const u=t.logarithmicDepthBuffer===!0,f=t.reversedDepthBuffer===!0&&e.has("EXT_clip_control"),p=i.getParameter(i.MAX_TEXTURE_IMAGE_UNITS),_=i.getParameter(i.MAX_VERTEX_TEXTURE_IMAGE_UNITS),v=i.getParameter(i.MAX_TEXTURE_SIZE),m=i.getParameter(i.MAX_CUBE_MAP_TEXTURE_SIZE),d=i.getParameter(i.MAX_VERTEX_ATTRIBS),w=i.getParameter(i.MAX_VERTEX_UNIFORM_VECTORS),T=i.getParameter(i.MAX_VARYING_VECTORS),M=i.getParameter(i.MAX_FRAGMENT_UNIFORM_VECTORS),C=_>0,R=i.getParameter(i.MAX_SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:r,getMaxPrecision:l,textureFormatReadable:o,textureTypeReadable:a,precision:c,logarithmicDepthBuffer:u,reversedDepthBuffer:f,maxTextures:p,maxVertexTextures:_,maxTextureSize:v,maxCubemapSize:m,maxAttributes:d,maxVertexUniforms:w,maxVaryings:T,maxFragmentUniforms:M,vertexTextures:C,maxSamples:R}}function Bf(i){const e=this;let t=null,n=0,s=!1,r=!1;const o=new Wn,a=new Fe,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(u,f){const p=u.length!==0||f||n!==0||s;return s=f,n=u.length,p},this.beginShadows=function(){r=!0,h(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(u,f){t=h(u,f,0)},this.setState=function(u,f,p){const _=u.clippingPlanes,v=u.clipIntersection,m=u.clipShadows,d=i.get(u);if(!s||_===null||_.length===0||r&&!m)r?h(null):c();else{const w=r?0:n,T=w*4;let M=d.clippingState||null;l.value=M,M=h(_,f,T,p);for(let C=0;C!==T;++C)M[C]=t[C];d.clippingState=M,this.numIntersection=v?this.numPlanes:0,this.numPlanes+=w}};function c(){l.value!==t&&(l.value=t,l.needsUpdate=n>0),e.numPlanes=n,e.numIntersection=0}function h(u,f,p,_){const v=u!==null?u.length:0;let m=null;if(v!==0){if(m=l.value,_!==!0||m===null){const d=p+v*4,w=f.matrixWorldInverse;a.getNormalMatrix(w),(m===null||m.length<d)&&(m=new Float32Array(d));for(let T=0,M=p;T!==v;++T,M+=4)o.copy(u[T]).applyMatrix4(w,a),o.normal.toArray(m,M),m[M+3]=o.constant}l.value=m,l.needsUpdate=!0}return e.numPlanes=v,e.numIntersection=0,m}}function zf(i){let e=new WeakMap;function t(o,a){return a===Hr?o.mapping=Ei:a===Gr&&(o.mapping=yi),o}function n(o){if(o&&o.isTexture){const a=o.mapping;if(a===Hr||a===Gr)if(e.has(o)){const l=e.get(o).texture;return t(l,o.mapping)}else{const l=o.image;if(l&&l.height>0){const c=new Oh(l.height);return c.fromEquirectangularTexture(i,o),e.set(o,c),o.addEventListener("dispose",s),t(c.texture,o.mapping)}else return null}}return o}function s(o){const a=o.target;a.removeEventListener("dispose",s);const l=e.get(a);l!==void 0&&(e.delete(a),l.dispose())}function r(){e=new WeakMap}return{get:n,dispose:r}}const _i=4,Ao=[.125,.215,.35,.446,.526,.582],Yn=20,Mr=new Fa,Ro=new ze;let Sr=null,Er=0,yr=0,Tr=!1;const Xn=(1+Math.sqrt(5))/2,fi=1/Xn,Co=[new F(-Xn,fi,0),new F(Xn,fi,0),new F(-fi,0,Xn),new F(fi,0,Xn),new F(0,Xn,-fi),new F(0,Xn,fi),new F(-1,1,-1),new F(1,1,-1),new F(-1,1,1),new F(1,1,1)],kf=new F;class Po{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._lodPlanes=[],this._sizeLods=[],this._sigmas=[],this._blurMaterial=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._compileMaterial(this._blurMaterial)}fromScene(e,t=0,n=.1,s=100,r={}){const{size:o=256,position:a=kf}=r;Sr=this._renderer.getRenderTarget(),Er=this._renderer.getActiveCubeFace(),yr=this._renderer.getActiveMipmapLevel(),Tr=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(o);const l=this._allocateTargets();return l.depthBuffer=!0,this._sceneToCubeUV(e,n,s,l,a),t>0&&this._blur(l,0,0,t),this._applyPMREM(l),this._cleanup(l),l}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Uo(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Lo(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose()}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodPlanes.length;e++)this._lodPlanes[e].dispose()}_cleanup(e){this._renderer.setRenderTarget(Sr,Er,yr),this._renderer.xr.enabled=Tr,e.scissorTest=!1,ws(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===Ei||e.mapping===yi?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),Sr=this._renderer.getRenderTarget(),Er=this._renderer.getActiveCubeFace(),yr=this._renderer.getActiveMipmapLevel(),Tr=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;const n=t||this._allocateTargets();return this._textureToCubeUV(e,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){const e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,n={magFilter:tn,minFilter:tn,generateMipmaps:!1,type:ji,format:Gt,colorSpace:Jn,depthBuffer:!1},s=Do(e,t,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=Do(e,t,n);const{_lodMax:r}=this;({sizeLods:this._sizeLods,lodPlanes:this._lodPlanes,sigmas:this._sigmas}=Hf(r)),this._blurMaterial=Gf(r,e,t)}return s}_compileMaterial(e){const t=new bt(this._lodPlanes[0],e);this._renderer.compile(t,Mr)}_sceneToCubeUV(e,t,n,s,r){const l=new kt(90,1,t,n),c=[1,-1,1,1,1,1],h=[1,1,1,-1,-1,-1],u=this._renderer,f=u.autoClear,p=u.toneMapping;u.getClearColor(Ro),u.toneMapping=Ln,u.autoClear=!1,u.state.buffers.depth.getReversed()&&(u.setRenderTarget(s),u.clearDepth(),u.setRenderTarget(null));const v=new La({name:"PMREM.Background",side:wt,depthWrite:!1,depthTest:!1}),m=new bt(new es,v);let d=!1;const w=e.background;w?w.isColor&&(v.color.copy(w),e.background=null,d=!0):(v.color.copy(Ro),d=!0);for(let T=0;T<6;T++){const M=T%3;M===0?(l.up.set(0,c[T],0),l.position.set(r.x,r.y,r.z),l.lookAt(r.x+h[T],r.y,r.z)):M===1?(l.up.set(0,0,c[T]),l.position.set(r.x,r.y,r.z),l.lookAt(r.x,r.y+h[T],r.z)):(l.up.set(0,c[T],0),l.position.set(r.x,r.y,r.z),l.lookAt(r.x,r.y,r.z+h[T]));const C=this._cubeSize;ws(s,M*C,T>2?C:0,C,C),u.setRenderTarget(s),d&&u.render(m,l),u.render(e,l)}m.geometry.dispose(),m.material.dispose(),u.toneMapping=p,u.autoClear=f,e.background=w}_textureToCubeUV(e,t){const n=this._renderer,s=e.mapping===Ei||e.mapping===yi;s?(this._cubemapMaterial===null&&(this._cubemapMaterial=Uo()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Lo());const r=s?this._cubemapMaterial:this._equirectMaterial,o=new bt(this._lodPlanes[0],r),a=r.uniforms;a.envMap.value=e;const l=this._cubeSize;ws(t,0,0,3*l,2*l),n.setRenderTarget(t),n.render(o,Mr)}_applyPMREM(e){const t=this._renderer,n=t.autoClear;t.autoClear=!1;const s=this._lodPlanes.length;for(let r=1;r<s;r++){const o=Math.sqrt(this._sigmas[r]*this._sigmas[r]-this._sigmas[r-1]*this._sigmas[r-1]),a=Co[(s-r-1)%Co.length];this._blur(e,r-1,r,o,a)}t.autoClear=n}_blur(e,t,n,s,r){const o=this._pingPongRenderTarget;this._halfBlur(e,o,t,n,s,"latitudinal",r),this._halfBlur(o,e,n,n,s,"longitudinal",r)}_halfBlur(e,t,n,s,r,o,a){const l=this._renderer,c=this._blurMaterial;o!=="latitudinal"&&o!=="longitudinal"&&console.error("blur direction must be either latitudinal or longitudinal!");const h=3,u=new bt(this._lodPlanes[s],c),f=c.uniforms,p=this._sizeLods[n]-1,_=isFinite(r)?Math.PI/(2*p):2*Math.PI/(2*Yn-1),v=r/_,m=isFinite(r)?1+Math.floor(h*v):Yn;m>Yn&&console.warn(`sigmaRadians, ${r}, is too large and will clip, as it requested ${m} samples when the maximum is set to ${Yn}`);const d=[];let w=0;for(let P=0;P<Yn;++P){const N=P/v,E=Math.exp(-N*N/2);d.push(E),P===0?w+=E:P<m&&(w+=2*E)}for(let P=0;P<d.length;P++)d[P]=d[P]/w;f.envMap.value=e.texture,f.samples.value=m,f.weights.value=d,f.latitudinal.value=o==="latitudinal",a&&(f.poleAxis.value=a);const{_lodMax:T}=this;f.dTheta.value=_,f.mipInt.value=T-n;const M=this._sizeLods[s],C=3*M*(s>T-_i?s-T+_i:0),R=4*(this._cubeSize-M);ws(t,C,R,3*M,2*M),l.setRenderTarget(t),l.render(u,Mr)}}function Hf(i){const e=[],t=[],n=[];let s=i;const r=i-_i+1+Ao.length;for(let o=0;o<r;o++){const a=Math.pow(2,s);t.push(a);let l=1/a;o>i-_i?l=Ao[o-i+_i-1]:o===0&&(l=0),n.push(l);const c=1/(a-2),h=-c,u=1+c,f=[h,h,u,h,u,u,h,h,u,u,h,u],p=6,_=6,v=3,m=2,d=1,w=new Float32Array(v*_*p),T=new Float32Array(m*_*p),M=new Float32Array(d*_*p);for(let R=0;R<p;R++){const P=R%3*2/3-1,N=R>2?0:-1,E=[P,N,0,P+2/3,N,0,P+2/3,N+1,0,P,N,0,P+2/3,N+1,0,P,N+1,0];w.set(E,v*_*R),T.set(f,m*_*R);const S=[R,R,R,R,R,R];M.set(S,d*_*R)}const C=new It;C.setAttribute("position",new gt(w,v)),C.setAttribute("uv",new gt(T,m)),C.setAttribute("faceIndex",new gt(M,d)),e.push(C),s>_i&&s--}return{lodPlanes:e,sizeLods:t,sigmas:n}}function Do(i,e,t){const n=new In(i,e,t);return n.texture.mapping=Xs,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function ws(i,e,t,n,s){i.viewport.set(e,t,n,s),i.scissor.set(e,t,n,s)}function Gf(i,e,t){const n=new Float32Array(Yn),s=new F(0,1,0);return new Ct({name:"SphericalGaussianBlur",defines:{n:Yn,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:n},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:s}},vertexShader:Na(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:Dn,depthTest:!1,depthWrite:!1})}function Lo(){return new Ct({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:Na(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:Dn,depthTest:!1,depthWrite:!1})}function Uo(){return new Ct({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:Na(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:Dn,depthTest:!1,depthWrite:!1})}function Na(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}function Vf(i){let e=new WeakMap,t=null;function n(a){if(a&&a.isTexture){const l=a.mapping,c=l===Hr||l===Gr,h=l===Ei||l===yi;if(c||h){let u=e.get(a);const f=u!==void 0?u.texture.pmremVersion:0;if(a.isRenderTargetTexture&&a.pmremVersion!==f)return t===null&&(t=new Po(i)),u=c?t.fromEquirectangular(a,u):t.fromCubemap(a,u),u.texture.pmremVersion=a.pmremVersion,e.set(a,u),u.texture;if(u!==void 0)return u.texture;{const p=a.image;return c&&p&&p.height>0||h&&p&&s(p)?(t===null&&(t=new Po(i)),u=c?t.fromEquirectangular(a):t.fromCubemap(a),u.texture.pmremVersion=a.pmremVersion,e.set(a,u),a.addEventListener("dispose",r),u.texture):null}}}return a}function s(a){let l=0;const c=6;for(let h=0;h<c;h++)a[h]!==void 0&&l++;return l===c}function r(a){const l=a.target;l.removeEventListener("dispose",r);const c=e.get(l);c!==void 0&&(e.delete(l),c.dispose())}function o(){e=new WeakMap,t!==null&&(t.dispose(),t=null)}return{get:n,dispose:o}}function Wf(i){const e={};function t(n){if(e[n]!==void 0)return e[n];let s;switch(n){case"WEBGL_depth_texture":s=i.getExtension("WEBGL_depth_texture")||i.getExtension("MOZ_WEBGL_depth_texture")||i.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":s=i.getExtension("EXT_texture_filter_anisotropic")||i.getExtension("MOZ_EXT_texture_filter_anisotropic")||i.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":s=i.getExtension("WEBGL_compressed_texture_s3tc")||i.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||i.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":s=i.getExtension("WEBGL_compressed_texture_pvrtc")||i.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:s=i.getExtension(n)}return e[n]=s,s}return{has:function(n){return t(n)!==null},init:function(){t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance"),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture"),t("WEBGL_render_shared_exponent")},get:function(n){const s=t(n);return s===null&&Zi("THREE.WebGLRenderer: "+n+" extension not supported."),s}}}function Xf(i,e,t,n){const s={},r=new WeakMap;function o(u){const f=u.target;f.index!==null&&e.remove(f.index);for(const _ in f.attributes)e.remove(f.attributes[_]);f.removeEventListener("dispose",o),delete s[f.id];const p=r.get(f);p&&(e.remove(p),r.delete(f)),n.releaseStatesOfGeometry(f),f.isInstancedBufferGeometry===!0&&delete f._maxInstanceCount,t.memory.geometries--}function a(u,f){return s[f.id]===!0||(f.addEventListener("dispose",o),s[f.id]=!0,t.memory.geometries++),f}function l(u){const f=u.attributes;for(const p in f)e.update(f[p],i.ARRAY_BUFFER)}function c(u){const f=[],p=u.index,_=u.attributes.position;let v=0;if(p!==null){const w=p.array;v=p.version;for(let T=0,M=w.length;T<M;T+=3){const C=w[T+0],R=w[T+1],P=w[T+2];f.push(C,R,R,P,P,C)}}else if(_!==void 0){const w=_.array;v=_.version;for(let T=0,M=w.length/3-1;T<M;T+=3){const C=T+0,R=T+1,P=T+2;f.push(C,R,R,P,P,C)}}else return;const m=new(bl(f)?Pl:Cl)(f,1);m.version=v;const d=r.get(u);d&&e.remove(d),r.set(u,m)}function h(u){const f=r.get(u);if(f){const p=u.index;p!==null&&f.version<p.version&&c(u)}else c(u);return r.get(u)}return{get:a,update:l,getWireframeAttribute:h}}function qf(i,e,t){let n;function s(f){n=f}let r,o;function a(f){r=f.type,o=f.bytesPerElement}function l(f,p){i.drawElements(n,p,r,f*o),t.update(p,n,1)}function c(f,p,_){_!==0&&(i.drawElementsInstanced(n,p,r,f*o,_),t.update(p,n,_))}function h(f,p,_){if(_===0)return;e.get("WEBGL_multi_draw").multiDrawElementsWEBGL(n,p,0,r,f,0,_);let m=0;for(let d=0;d<_;d++)m+=p[d];t.update(m,n,1)}function u(f,p,_,v){if(_===0)return;const m=e.get("WEBGL_multi_draw");if(m===null)for(let d=0;d<f.length;d++)c(f[d]/o,p[d],v[d]);else{m.multiDrawElementsInstancedWEBGL(n,p,0,r,f,0,v,0,_);let d=0;for(let w=0;w<_;w++)d+=p[w]*v[w];t.update(d,n,1)}}this.setMode=s,this.setIndex=a,this.render=l,this.renderInstances=c,this.renderMultiDraw=h,this.renderMultiDrawInstances=u}function Yf(i){const e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function n(r,o,a){switch(t.calls++,o){case i.TRIANGLES:t.triangles+=a*(r/3);break;case i.LINES:t.lines+=a*(r/2);break;case i.LINE_STRIP:t.lines+=a*(r-1);break;case i.LINE_LOOP:t.lines+=a*r;break;case i.POINTS:t.points+=a*r;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",o);break}}function s(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:s,update:n}}function $f(i,e,t){const n=new WeakMap,s=new ct;function r(o,a,l){const c=o.morphTargetInfluences,h=a.morphAttributes.position||a.morphAttributes.normal||a.morphAttributes.color,u=h!==void 0?h.length:0;let f=n.get(a);if(f===void 0||f.count!==u){let S=function(){N.dispose(),n.delete(a),a.removeEventListener("dispose",S)};var p=S;f!==void 0&&f.texture.dispose();const _=a.morphAttributes.position!==void 0,v=a.morphAttributes.normal!==void 0,m=a.morphAttributes.color!==void 0,d=a.morphAttributes.position||[],w=a.morphAttributes.normal||[],T=a.morphAttributes.color||[];let M=0;_===!0&&(M=1),v===!0&&(M=2),m===!0&&(M=3);let C=a.attributes.position.count*M,R=1;C>e.maxTextureSize&&(R=Math.ceil(C/e.maxTextureSize),C=e.maxTextureSize);const P=new Float32Array(C*R*4*u),N=new wl(P,C,R,u);N.type=fn,N.needsUpdate=!0;const E=M*4;for(let L=0;L<u;L++){const k=d[L],X=w[L],Z=T[L],Y=C*R*4*L;for(let G=0;G<k.count;G++){const A=G*E;_===!0&&(s.fromBufferAttribute(k,G),P[Y+A+0]=s.x,P[Y+A+1]=s.y,P[Y+A+2]=s.z,P[Y+A+3]=0),v===!0&&(s.fromBufferAttribute(X,G),P[Y+A+4]=s.x,P[Y+A+5]=s.y,P[Y+A+6]=s.z,P[Y+A+7]=0),m===!0&&(s.fromBufferAttribute(Z,G),P[Y+A+8]=s.x,P[Y+A+9]=s.y,P[Y+A+10]=s.z,P[Y+A+11]=Z.itemSize===4?s.w:1)}}f={count:u,texture:N,size:new $e(C,R)},n.set(a,f),a.addEventListener("dispose",S)}if(o.isInstancedMesh===!0&&o.morphTexture!==null)l.getUniforms().setValue(i,"morphTexture",o.morphTexture,t);else{let _=0;for(let m=0;m<c.length;m++)_+=c[m];const v=a.morphTargetsRelative?1:1-_;l.getUniforms().setValue(i,"morphTargetBaseInfluence",v),l.getUniforms().setValue(i,"morphTargetInfluences",c)}l.getUniforms().setValue(i,"morphTargetsTexture",f.texture,t),l.getUniforms().setValue(i,"morphTargetsTextureSize",f.size)}return{update:r}}function Kf(i,e,t,n){let s=new WeakMap;function r(l){const c=n.render.frame,h=l.geometry,u=e.get(l,h);if(s.get(u)!==c&&(e.update(u),s.set(u,c)),l.isInstancedMesh&&(l.hasEventListener("dispose",a)===!1&&l.addEventListener("dispose",a),s.get(l)!==c&&(t.update(l.instanceMatrix,i.ARRAY_BUFFER),l.instanceColor!==null&&t.update(l.instanceColor,i.ARRAY_BUFFER),s.set(l,c))),l.isSkinnedMesh){const f=l.skeleton;s.get(f)!==c&&(f.update(),s.set(f,c))}return u}function o(){s=new WeakMap}function a(l){const c=l.target;c.removeEventListener("dispose",a),t.remove(c.instanceMatrix),c.instanceColor!==null&&t.remove(c.instanceColor)}return{update:r,dispose:o}}const zl=new vt,Io=new Nl(1,1),kl=new wl,Hl=new Mh,Gl=new Ul,Fo=[],No=[],Oo=new Float32Array(16),Bo=new Float32Array(9),zo=new Float32Array(4);function Di(i,e,t){const n=i[0];if(n<=0||n>0)return i;const s=e*t;let r=Fo[s];if(r===void 0&&(r=new Float32Array(s),Fo[s]=r),e!==0){n.toArray(r,0);for(let o=1,a=0;o!==e;++o)a+=t,i[o].toArray(r,a)}return r}function ft(i,e){if(i.length!==e.length)return!1;for(let t=0,n=i.length;t<n;t++)if(i[t]!==e[t])return!1;return!0}function pt(i,e){for(let t=0,n=e.length;t<n;t++)i[t]=e[t]}function qs(i,e){let t=No[e];t===void 0&&(t=new Int32Array(e),No[e]=t);for(let n=0;n!==e;++n)t[n]=i.allocateTextureUnit();return t}function Zf(i,e){const t=this.cache;t[0]!==e&&(i.uniform1f(this.addr,e),t[0]=e)}function jf(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(ft(t,e))return;i.uniform2fv(this.addr,e),pt(t,e)}}function Jf(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(i.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(ft(t,e))return;i.uniform3fv(this.addr,e),pt(t,e)}}function Qf(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(ft(t,e))return;i.uniform4fv(this.addr,e),pt(t,e)}}function ep(i,e){const t=this.cache,n=e.elements;if(n===void 0){if(ft(t,e))return;i.uniformMatrix2fv(this.addr,!1,e),pt(t,e)}else{if(ft(t,n))return;zo.set(n),i.uniformMatrix2fv(this.addr,!1,zo),pt(t,n)}}function tp(i,e){const t=this.cache,n=e.elements;if(n===void 0){if(ft(t,e))return;i.uniformMatrix3fv(this.addr,!1,e),pt(t,e)}else{if(ft(t,n))return;Bo.set(n),i.uniformMatrix3fv(this.addr,!1,Bo),pt(t,n)}}function np(i,e){const t=this.cache,n=e.elements;if(n===void 0){if(ft(t,e))return;i.uniformMatrix4fv(this.addr,!1,e),pt(t,e)}else{if(ft(t,n))return;Oo.set(n),i.uniformMatrix4fv(this.addr,!1,Oo),pt(t,n)}}function ip(i,e){const t=this.cache;t[0]!==e&&(i.uniform1i(this.addr,e),t[0]=e)}function sp(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(ft(t,e))return;i.uniform2iv(this.addr,e),pt(t,e)}}function rp(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(ft(t,e))return;i.uniform3iv(this.addr,e),pt(t,e)}}function ap(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(ft(t,e))return;i.uniform4iv(this.addr,e),pt(t,e)}}function op(i,e){const t=this.cache;t[0]!==e&&(i.uniform1ui(this.addr,e),t[0]=e)}function lp(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(ft(t,e))return;i.uniform2uiv(this.addr,e),pt(t,e)}}function cp(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(ft(t,e))return;i.uniform3uiv(this.addr,e),pt(t,e)}}function hp(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(ft(t,e))return;i.uniform4uiv(this.addr,e),pt(t,e)}}function up(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s);let r;this.type===i.SAMPLER_2D_SHADOW?(Io.compareFunction=Tl,r=Io):r=zl,t.setTexture2D(e||r,s)}function dp(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),t.setTexture3D(e||Hl,s)}function fp(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),t.setTextureCube(e||Gl,s)}function pp(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),t.setTexture2DArray(e||kl,s)}function mp(i){switch(i){case 5126:return Zf;case 35664:return jf;case 35665:return Jf;case 35666:return Qf;case 35674:return ep;case 35675:return tp;case 35676:return np;case 5124:case 35670:return ip;case 35667:case 35671:return sp;case 35668:case 35672:return rp;case 35669:case 35673:return ap;case 5125:return op;case 36294:return lp;case 36295:return cp;case 36296:return hp;case 35678:case 36198:case 36298:case 36306:case 35682:return up;case 35679:case 36299:case 36307:return dp;case 35680:case 36300:case 36308:case 36293:return fp;case 36289:case 36303:case 36311:case 36292:return pp}}function gp(i,e){i.uniform1fv(this.addr,e)}function _p(i,e){const t=Di(e,this.size,2);i.uniform2fv(this.addr,t)}function vp(i,e){const t=Di(e,this.size,3);i.uniform3fv(this.addr,t)}function xp(i,e){const t=Di(e,this.size,4);i.uniform4fv(this.addr,t)}function Mp(i,e){const t=Di(e,this.size,4);i.uniformMatrix2fv(this.addr,!1,t)}function Sp(i,e){const t=Di(e,this.size,9);i.uniformMatrix3fv(this.addr,!1,t)}function Ep(i,e){const t=Di(e,this.size,16);i.uniformMatrix4fv(this.addr,!1,t)}function yp(i,e){i.uniform1iv(this.addr,e)}function Tp(i,e){i.uniform2iv(this.addr,e)}function bp(i,e){i.uniform3iv(this.addr,e)}function wp(i,e){i.uniform4iv(this.addr,e)}function Ap(i,e){i.uniform1uiv(this.addr,e)}function Rp(i,e){i.uniform2uiv(this.addr,e)}function Cp(i,e){i.uniform3uiv(this.addr,e)}function Pp(i,e){i.uniform4uiv(this.addr,e)}function Dp(i,e,t){const n=this.cache,s=e.length,r=qs(t,s);ft(n,r)||(i.uniform1iv(this.addr,r),pt(n,r));for(let o=0;o!==s;++o)t.setTexture2D(e[o]||zl,r[o])}function Lp(i,e,t){const n=this.cache,s=e.length,r=qs(t,s);ft(n,r)||(i.uniform1iv(this.addr,r),pt(n,r));for(let o=0;o!==s;++o)t.setTexture3D(e[o]||Hl,r[o])}function Up(i,e,t){const n=this.cache,s=e.length,r=qs(t,s);ft(n,r)||(i.uniform1iv(this.addr,r),pt(n,r));for(let o=0;o!==s;++o)t.setTextureCube(e[o]||Gl,r[o])}function Ip(i,e,t){const n=this.cache,s=e.length,r=qs(t,s);ft(n,r)||(i.uniform1iv(this.addr,r),pt(n,r));for(let o=0;o!==s;++o)t.setTexture2DArray(e[o]||kl,r[o])}function Fp(i){switch(i){case 5126:return gp;case 35664:return _p;case 35665:return vp;case 35666:return xp;case 35674:return Mp;case 35675:return Sp;case 35676:return Ep;case 5124:case 35670:return yp;case 35667:case 35671:return Tp;case 35668:case 35672:return bp;case 35669:case 35673:return wp;case 5125:return Ap;case 36294:return Rp;case 36295:return Cp;case 36296:return Pp;case 35678:case 36198:case 36298:case 36306:case 35682:return Dp;case 35679:case 36299:case 36307:return Lp;case 35680:case 36300:case 36308:case 36293:return Up;case 36289:case 36303:case 36311:case 36292:return Ip}}class Np{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.setValue=mp(t.type)}}class Op{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=Fp(t.type)}}class Bp{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,n){const s=this.seq;for(let r=0,o=s.length;r!==o;++r){const a=s[r];a.setValue(e,t[a.id],n)}}}const br=/(\w+)(\])?(\[|\.)?/g;function ko(i,e){i.seq.push(e),i.map[e.id]=e}function zp(i,e,t){const n=i.name,s=n.length;for(br.lastIndex=0;;){const r=br.exec(n),o=br.lastIndex;let a=r[1];const l=r[2]==="]",c=r[3];if(l&&(a=a|0),c===void 0||c==="["&&o+2===s){ko(t,c===void 0?new Np(a,i,e):new Op(a,i,e));break}else{let u=t.map[a];u===void 0&&(u=new Bp(a),ko(t,u)),t=u}}}class Us{constructor(e,t){this.seq=[],this.map={};const n=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let s=0;s<n;++s){const r=e.getActiveUniform(t,s),o=e.getUniformLocation(t,r.name);zp(r,o,this)}}setValue(e,t,n,s){const r=this.map[t];r!==void 0&&r.setValue(e,n,s)}setOptional(e,t,n){const s=t[n];s!==void 0&&this.setValue(e,n,s)}static upload(e,t,n,s){for(let r=0,o=t.length;r!==o;++r){const a=t[r],l=n[a.id];l.needsUpdate!==!1&&a.setValue(e,l.value,s)}}static seqWithValue(e,t){const n=[];for(let s=0,r=e.length;s!==r;++s){const o=e[s];o.id in t&&n.push(o)}return n}}function Ho(i,e,t){const n=i.createShader(e);return i.shaderSource(n,t),i.compileShader(n),n}const kp=37297;let Hp=0;function Gp(i,e){const t=i.split(`
`),n=[],s=Math.max(e-6,0),r=Math.min(e+6,t.length);for(let o=s;o<r;o++){const a=o+1;n.push(`${a===e?">":" "} ${a}: ${t[o]}`)}return n.join(`
`)}const Go=new Fe;function Vp(i){Ve._getMatrix(Go,Ve.workingColorSpace,i);const e=`mat3( ${Go.elements.map(t=>t.toFixed(4))} )`;switch(Ve.getTransfer(i)){case Os:return[e,"LinearTransferOETF"];case Je:return[e,"sRGBTransferOETF"];default:return console.warn("THREE.WebGLProgram: Unsupported color space: ",i),[e,"LinearTransferOETF"]}}function Vo(i,e,t){const n=i.getShaderParameter(e,i.COMPILE_STATUS),r=(i.getShaderInfoLog(e)||"").trim();if(n&&r==="")return"";const o=/ERROR: 0:(\d+)/.exec(r);if(o){const a=parseInt(o[1]);return t.toUpperCase()+`

`+r+`

`+Gp(i.getShaderSource(e),a)}else return r}function Wp(i,e){const t=Vp(e);return[`vec4 ${i}( vec4 value ) {`,`	return ${t[1]}( vec4( value.rgb * ${t[0]}, value.a ) );`,"}"].join(`
`)}function Xp(i,e){let t;switch(e){case Lc:t="Linear";break;case Uc:t="Reinhard";break;case Ic:t="Cineon";break;case Fc:t="ACESFilmic";break;case Oc:t="AgX";break;case Bc:t="Neutral";break;case Nc:t="Custom";break;default:console.warn("THREE.WebGLProgram: Unsupported toneMapping:",e),t="Linear"}return"vec3 "+i+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}const As=new F;function qp(){Ve.getLuminanceCoefficients(As);const i=As.x.toFixed(4),e=As.y.toFixed(4),t=As.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${i}, ${e}, ${t} );`,"	return dot( weights, rgb );","}"].join(`
`)}function Yp(i){return[i.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",i.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(ki).join(`
`)}function $p(i){const e=[];for(const t in i){const n=i[t];n!==!1&&e.push("#define "+t+" "+n)}return e.join(`
`)}function Kp(i,e){const t={},n=i.getProgramParameter(e,i.ACTIVE_ATTRIBUTES);for(let s=0;s<n;s++){const r=i.getActiveAttrib(e,s),o=r.name;let a=1;r.type===i.FLOAT_MAT2&&(a=2),r.type===i.FLOAT_MAT3&&(a=3),r.type===i.FLOAT_MAT4&&(a=4),t[o]={type:r.type,location:i.getAttribLocation(e,o),locationSize:a}}return t}function ki(i){return i!==""}function Wo(i,e){const t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return i.replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function Xo(i,e){return i.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}const Zp=/^[ \t]*#include +<([\w\d./]+)>/gm;function Ma(i){return i.replace(Zp,Jp)}const jp=new Map;function Jp(i,e){let t=Oe[e];if(t===void 0){const n=jp.get(e);if(n!==void 0)t=Oe[n],console.warn('THREE.WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',e,n);else throw new Error("Can not resolve #include <"+e+">")}return Ma(t)}const Qp=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function qo(i){return i.replace(Qp,em)}function em(i,e,t,n){let s="";for(let r=parseInt(e);r<parseInt(t);r++)s+=n.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return s}function Yo(i){let e=`precision ${i.precision} float;
	precision ${i.precision} int;
	precision ${i.precision} sampler2D;
	precision ${i.precision} samplerCube;
	precision ${i.precision} sampler3D;
	precision ${i.precision} sampler2DArray;
	precision ${i.precision} sampler2DShadow;
	precision ${i.precision} samplerCubeShadow;
	precision ${i.precision} sampler2DArrayShadow;
	precision ${i.precision} isampler2D;
	precision ${i.precision} isampler3D;
	precision ${i.precision} isamplerCube;
	precision ${i.precision} isampler2DArray;
	precision ${i.precision} usampler2D;
	precision ${i.precision} usampler3D;
	precision ${i.precision} usamplerCube;
	precision ${i.precision} usampler2DArray;
	`;return i.precision==="highp"?e+=`
#define HIGH_PRECISION`:i.precision==="mediump"?e+=`
#define MEDIUM_PRECISION`:i.precision==="lowp"&&(e+=`
#define LOW_PRECISION`),e}function tm(i){let e="SHADOWMAP_TYPE_BASIC";return i.shadowMapType===fl?e="SHADOWMAP_TYPE_PCF":i.shadowMapType===uc?e="SHADOWMAP_TYPE_PCF_SOFT":i.shadowMapType===dn&&(e="SHADOWMAP_TYPE_VSM"),e}function nm(i){let e="ENVMAP_TYPE_CUBE";if(i.envMap)switch(i.envMapMode){case Ei:case yi:e="ENVMAP_TYPE_CUBE";break;case Xs:e="ENVMAP_TYPE_CUBE_UV";break}return e}function im(i){let e="ENVMAP_MODE_REFLECTION";return i.envMap&&i.envMapMode===yi&&(e="ENVMAP_MODE_REFRACTION"),e}function sm(i){let e="ENVMAP_BLENDING_NONE";if(i.envMap)switch(i.combine){case pl:e="ENVMAP_BLENDING_MULTIPLY";break;case Pc:e="ENVMAP_BLENDING_MIX";break;case Dc:e="ENVMAP_BLENDING_ADD";break}return e}function rm(i){const e=i.envMapCubeUVHeight;if(e===null)return null;const t=Math.log2(e)-2,n=1/e;return{texelWidth:1/(3*Math.max(Math.pow(2,t),112)),texelHeight:n,maxMip:t}}function am(i,e,t,n){const s=i.getContext(),r=t.defines;let o=t.vertexShader,a=t.fragmentShader;const l=tm(t),c=nm(t),h=im(t),u=sm(t),f=rm(t),p=Yp(t),_=$p(r),v=s.createProgram();let m,d,w=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(m=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,_].filter(ki).join(`
`),m.length>0&&(m+=`
`),d=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,_].filter(ki).join(`
`),d.length>0&&(d+=`
`)):(m=[Yo(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,_,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.batchingColor?"#define USE_BATCHING_COLOR":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.instancingMorph?"#define USE_INSTANCING_MORPH":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+h:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(ki).join(`
`),d=[Yo(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,_,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+c:"",t.envMap?"#define "+h:"",t.envMap?"#define "+u:"",f?"#define CUBEUV_TEXEL_WIDTH "+f.texelWidth:"",f?"#define CUBEUV_TEXEL_HEIGHT "+f.texelHeight:"",f?"#define CUBEUV_MAX_MIP "+f.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.dispersion?"#define USE_DISPERSION":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor||t.batchingColor?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==Ln?"#define TONE_MAPPING":"",t.toneMapping!==Ln?Oe.tonemapping_pars_fragment:"",t.toneMapping!==Ln?Xp("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",Oe.colorspace_pars_fragment,Wp("linearToOutputTexel",t.outputColorSpace),qp(),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(ki).join(`
`)),o=Ma(o),o=Wo(o,t),o=Xo(o,t),a=Ma(a),a=Wo(a,t),a=Xo(a,t),o=qo(o),a=qo(a),t.isRawShaderMaterial!==!0&&(w=`#version 300 es
`,m=[p,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+m,d=["#define varying in",t.glslVersion===eo?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===eo?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+d);const T=w+m+o,M=w+d+a,C=Ho(s,s.VERTEX_SHADER,T),R=Ho(s,s.FRAGMENT_SHADER,M);s.attachShader(v,C),s.attachShader(v,R),t.index0AttributeName!==void 0?s.bindAttribLocation(v,0,t.index0AttributeName):t.morphTargets===!0&&s.bindAttribLocation(v,0,"position"),s.linkProgram(v);function P(L){if(i.debug.checkShaderErrors){const k=s.getProgramInfoLog(v)||"",X=s.getShaderInfoLog(C)||"",Z=s.getShaderInfoLog(R)||"",Y=k.trim(),G=X.trim(),A=Z.trim();let W=!0,ie=!0;if(s.getProgramParameter(v,s.LINK_STATUS)===!1)if(W=!1,typeof i.debug.onShaderError=="function")i.debug.onShaderError(s,v,C,R);else{const ue=Vo(s,C,"vertex"),xe=Vo(s,R,"fragment");console.error("THREE.WebGLProgram: Shader Error "+s.getError()+" - VALIDATE_STATUS "+s.getProgramParameter(v,s.VALIDATE_STATUS)+`

Material Name: `+L.name+`
Material Type: `+L.type+`

Program Info Log: `+Y+`
`+ue+`
`+xe)}else Y!==""?console.warn("THREE.WebGLProgram: Program Info Log:",Y):(G===""||A==="")&&(ie=!1);ie&&(L.diagnostics={runnable:W,programLog:Y,vertexShader:{log:G,prefix:m},fragmentShader:{log:A,prefix:d}})}s.deleteShader(C),s.deleteShader(R),N=new Us(s,v),E=Kp(s,v)}let N;this.getUniforms=function(){return N===void 0&&P(this),N};let E;this.getAttributes=function(){return E===void 0&&P(this),E};let S=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return S===!1&&(S=s.getProgramParameter(v,kp)),S},this.destroy=function(){n.releaseStatesOfProgram(this),s.deleteProgram(v),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=Hp++,this.cacheKey=e,this.usedTimes=1,this.program=v,this.vertexShader=C,this.fragmentShader=R,this}let om=0;class lm{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e){const t=e.vertexShader,n=e.fragmentShader,s=this._getShaderStage(t),r=this._getShaderStage(n),o=this._getShaderCacheForMaterial(e);return o.has(s)===!1&&(o.add(s),s.usedTimes++),o.has(r)===!1&&(o.add(r),r.usedTimes++),this}remove(e){const t=this.materialCache.get(e);for(const n of t)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(e),this}getVertexShaderID(e){return this._getShaderStage(e.vertexShader).id}getFragmentShaderID(e){return this._getShaderStage(e.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){const t=this.materialCache;let n=t.get(e);return n===void 0&&(n=new Set,t.set(e,n)),n}_getShaderStage(e){const t=this.shaderCache;let n=t.get(e);return n===void 0&&(n=new cm(e),t.set(e,n)),n}}class cm{constructor(e){this.id=om++,this.code=e,this.usedTimes=0}}function hm(i,e,t,n,s,r,o){const a=new Al,l=new lm,c=new Set,h=[],u=s.logarithmicDepthBuffer,f=s.vertexTextures;let p=s.precision;const _={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function v(E){return c.add(E),E===0?"uv":`uv${E}`}function m(E,S,L,k,X){const Z=k.fog,Y=X.geometry,G=E.isMeshStandardMaterial?k.environment:null,A=(E.isMeshStandardMaterial?t:e).get(E.envMap||G),W=A&&A.mapping===Xs?A.image.height:null,ie=_[E.type];E.precision!==null&&(p=s.getMaxPrecision(E.precision),p!==E.precision&&console.warn("THREE.WebGLProgram.getParameters:",E.precision,"not supported, using",p,"instead."));const ue=Y.morphAttributes.position||Y.morphAttributes.normal||Y.morphAttributes.color,xe=ue!==void 0?ue.length:0;let Ne=0;Y.morphAttributes.position!==void 0&&(Ne=1),Y.morphAttributes.normal!==void 0&&(Ne=2),Y.morphAttributes.color!==void 0&&(Ne=3);let Ke,Qe,Ge,$;if(ie){const Ye=Qt[ie];Ke=Ye.vertexShader,Qe=Ye.fragmentShader}else Ke=E.vertexShader,Qe=E.fragmentShader,l.update(E),Ge=l.getVertexShaderID(E),$=l.getFragmentShaderID(E);const j=i.getRenderTarget(),de=i.state.buffers.depth.getReversed(),he=X.isInstancedMesh===!0,ge=X.isBatchedMesh===!0,Be=!!E.map,lt=!!E.matcap,b=!!A,Ze=!!E.aoMap,De=!!E.lightMap,be=!!E.bumpMap,pe=!!E.normalMap,qe=!!E.displacementMap,_e=!!E.emissiveMap,Ue=!!E.metalnessMap,at=!!E.roughnessMap,nt=E.anisotropy>0,y=E.clearcoat>0,g=E.dispersion>0,O=E.iridescence>0,q=E.sheen>0,B=E.transmission>0,V=nt&&!!E.anisotropyMap,le=y&&!!E.clearcoatMap,ne=y&&!!E.clearcoatNormalMap,Me=y&&!!E.clearcoatRoughnessMap,Ee=O&&!!E.iridescenceMap,J=O&&!!E.iridescenceThicknessMap,oe=q&&!!E.sheenColorMap,we=q&&!!E.sheenRoughnessMap,ve=!!E.specularMap,re=!!E.specularColorMap,Te=!!E.specularIntensityMap,D=B&&!!E.transmissionMap,te=B&&!!E.thicknessMap,se=!!E.gradientMap,me=!!E.alphaMap,Q=E.alphaTest>0,K=!!E.alphaHash,ye=!!E.extensions;let Le=Ln;E.toneMapped&&(j===null||j.isXRRenderTarget===!0)&&(Le=i.toneMapping);const tt={shaderID:ie,shaderType:E.type,shaderName:E.name,vertexShader:Ke,fragmentShader:Qe,defines:E.defines,customVertexShaderID:Ge,customFragmentShaderID:$,isRawShaderMaterial:E.isRawShaderMaterial===!0,glslVersion:E.glslVersion,precision:p,batching:ge,batchingColor:ge&&X._colorsTexture!==null,instancing:he,instancingColor:he&&X.instanceColor!==null,instancingMorph:he&&X.morphTexture!==null,supportsVertexTextures:f,outputColorSpace:j===null?i.outputColorSpace:j.isXRRenderTarget===!0?j.texture.colorSpace:Jn,alphaToCoverage:!!E.alphaToCoverage,map:Be,matcap:lt,envMap:b,envMapMode:b&&A.mapping,envMapCubeUVHeight:W,aoMap:Ze,lightMap:De,bumpMap:be,normalMap:pe,displacementMap:f&&qe,emissiveMap:_e,normalMapObjectSpace:pe&&E.normalMapType===Vc,normalMapTangentSpace:pe&&E.normalMapType===Gc,metalnessMap:Ue,roughnessMap:at,anisotropy:nt,anisotropyMap:V,clearcoat:y,clearcoatMap:le,clearcoatNormalMap:ne,clearcoatRoughnessMap:Me,dispersion:g,iridescence:O,iridescenceMap:Ee,iridescenceThicknessMap:J,sheen:q,sheenColorMap:oe,sheenRoughnessMap:we,specularMap:ve,specularColorMap:re,specularIntensityMap:Te,transmission:B,transmissionMap:D,thicknessMap:te,gradientMap:se,opaque:E.transparent===!1&&E.blending===vi&&E.alphaToCoverage===!1,alphaMap:me,alphaTest:Q,alphaHash:K,combine:E.combine,mapUv:Be&&v(E.map.channel),aoMapUv:Ze&&v(E.aoMap.channel),lightMapUv:De&&v(E.lightMap.channel),bumpMapUv:be&&v(E.bumpMap.channel),normalMapUv:pe&&v(E.normalMap.channel),displacementMapUv:qe&&v(E.displacementMap.channel),emissiveMapUv:_e&&v(E.emissiveMap.channel),metalnessMapUv:Ue&&v(E.metalnessMap.channel),roughnessMapUv:at&&v(E.roughnessMap.channel),anisotropyMapUv:V&&v(E.anisotropyMap.channel),clearcoatMapUv:le&&v(E.clearcoatMap.channel),clearcoatNormalMapUv:ne&&v(E.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:Me&&v(E.clearcoatRoughnessMap.channel),iridescenceMapUv:Ee&&v(E.iridescenceMap.channel),iridescenceThicknessMapUv:J&&v(E.iridescenceThicknessMap.channel),sheenColorMapUv:oe&&v(E.sheenColorMap.channel),sheenRoughnessMapUv:we&&v(E.sheenRoughnessMap.channel),specularMapUv:ve&&v(E.specularMap.channel),specularColorMapUv:re&&v(E.specularColorMap.channel),specularIntensityMapUv:Te&&v(E.specularIntensityMap.channel),transmissionMapUv:D&&v(E.transmissionMap.channel),thicknessMapUv:te&&v(E.thicknessMap.channel),alphaMapUv:me&&v(E.alphaMap.channel),vertexTangents:!!Y.attributes.tangent&&(pe||nt),vertexColors:E.vertexColors,vertexAlphas:E.vertexColors===!0&&!!Y.attributes.color&&Y.attributes.color.itemSize===4,pointsUvs:X.isPoints===!0&&!!Y.attributes.uv&&(Be||me),fog:!!Z,useFog:E.fog===!0,fogExp2:!!Z&&Z.isFogExp2,flatShading:E.flatShading===!0&&E.wireframe===!1,sizeAttenuation:E.sizeAttenuation===!0,logarithmicDepthBuffer:u,reversedDepthBuffer:de,skinning:X.isSkinnedMesh===!0,morphTargets:Y.morphAttributes.position!==void 0,morphNormals:Y.morphAttributes.normal!==void 0,morphColors:Y.morphAttributes.color!==void 0,morphTargetsCount:xe,morphTextureStride:Ne,numDirLights:S.directional.length,numPointLights:S.point.length,numSpotLights:S.spot.length,numSpotLightMaps:S.spotLightMap.length,numRectAreaLights:S.rectArea.length,numHemiLights:S.hemi.length,numDirLightShadows:S.directionalShadowMap.length,numPointLightShadows:S.pointShadowMap.length,numSpotLightShadows:S.spotShadowMap.length,numSpotLightShadowsWithMaps:S.numSpotLightShadowsWithMaps,numLightProbes:S.numLightProbes,numClippingPlanes:o.numPlanes,numClipIntersection:o.numIntersection,dithering:E.dithering,shadowMapEnabled:i.shadowMap.enabled&&L.length>0,shadowMapType:i.shadowMap.type,toneMapping:Le,decodeVideoTexture:Be&&E.map.isVideoTexture===!0&&Ve.getTransfer(E.map.colorSpace)===Je,decodeVideoTextureEmissive:_e&&E.emissiveMap.isVideoTexture===!0&&Ve.getTransfer(E.emissiveMap.colorSpace)===Je,premultipliedAlpha:E.premultipliedAlpha,doubleSided:E.side===Ht,flipSided:E.side===wt,useDepthPacking:E.depthPacking>=0,depthPacking:E.depthPacking||0,index0AttributeName:E.index0AttributeName,extensionClipCullDistance:ye&&E.extensions.clipCullDistance===!0&&n.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(ye&&E.extensions.multiDraw===!0||ge)&&n.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:n.has("KHR_parallel_shader_compile"),customProgramCacheKey:E.customProgramCacheKey()};return tt.vertexUv1s=c.has(1),tt.vertexUv2s=c.has(2),tt.vertexUv3s=c.has(3),c.clear(),tt}function d(E){const S=[];if(E.shaderID?S.push(E.shaderID):(S.push(E.customVertexShaderID),S.push(E.customFragmentShaderID)),E.defines!==void 0)for(const L in E.defines)S.push(L),S.push(E.defines[L]);return E.isRawShaderMaterial===!1&&(w(S,E),T(S,E),S.push(i.outputColorSpace)),S.push(E.customProgramCacheKey),S.join()}function w(E,S){E.push(S.precision),E.push(S.outputColorSpace),E.push(S.envMapMode),E.push(S.envMapCubeUVHeight),E.push(S.mapUv),E.push(S.alphaMapUv),E.push(S.lightMapUv),E.push(S.aoMapUv),E.push(S.bumpMapUv),E.push(S.normalMapUv),E.push(S.displacementMapUv),E.push(S.emissiveMapUv),E.push(S.metalnessMapUv),E.push(S.roughnessMapUv),E.push(S.anisotropyMapUv),E.push(S.clearcoatMapUv),E.push(S.clearcoatNormalMapUv),E.push(S.clearcoatRoughnessMapUv),E.push(S.iridescenceMapUv),E.push(S.iridescenceThicknessMapUv),E.push(S.sheenColorMapUv),E.push(S.sheenRoughnessMapUv),E.push(S.specularMapUv),E.push(S.specularColorMapUv),E.push(S.specularIntensityMapUv),E.push(S.transmissionMapUv),E.push(S.thicknessMapUv),E.push(S.combine),E.push(S.fogExp2),E.push(S.sizeAttenuation),E.push(S.morphTargetsCount),E.push(S.morphAttributeCount),E.push(S.numDirLights),E.push(S.numPointLights),E.push(S.numSpotLights),E.push(S.numSpotLightMaps),E.push(S.numHemiLights),E.push(S.numRectAreaLights),E.push(S.numDirLightShadows),E.push(S.numPointLightShadows),E.push(S.numSpotLightShadows),E.push(S.numSpotLightShadowsWithMaps),E.push(S.numLightProbes),E.push(S.shadowMapType),E.push(S.toneMapping),E.push(S.numClippingPlanes),E.push(S.numClipIntersection),E.push(S.depthPacking)}function T(E,S){a.disableAll(),S.supportsVertexTextures&&a.enable(0),S.instancing&&a.enable(1),S.instancingColor&&a.enable(2),S.instancingMorph&&a.enable(3),S.matcap&&a.enable(4),S.envMap&&a.enable(5),S.normalMapObjectSpace&&a.enable(6),S.normalMapTangentSpace&&a.enable(7),S.clearcoat&&a.enable(8),S.iridescence&&a.enable(9),S.alphaTest&&a.enable(10),S.vertexColors&&a.enable(11),S.vertexAlphas&&a.enable(12),S.vertexUv1s&&a.enable(13),S.vertexUv2s&&a.enable(14),S.vertexUv3s&&a.enable(15),S.vertexTangents&&a.enable(16),S.anisotropy&&a.enable(17),S.alphaHash&&a.enable(18),S.batching&&a.enable(19),S.dispersion&&a.enable(20),S.batchingColor&&a.enable(21),S.gradientMap&&a.enable(22),E.push(a.mask),a.disableAll(),S.fog&&a.enable(0),S.useFog&&a.enable(1),S.flatShading&&a.enable(2),S.logarithmicDepthBuffer&&a.enable(3),S.reversedDepthBuffer&&a.enable(4),S.skinning&&a.enable(5),S.morphTargets&&a.enable(6),S.morphNormals&&a.enable(7),S.morphColors&&a.enable(8),S.premultipliedAlpha&&a.enable(9),S.shadowMapEnabled&&a.enable(10),S.doubleSided&&a.enable(11),S.flipSided&&a.enable(12),S.useDepthPacking&&a.enable(13),S.dithering&&a.enable(14),S.transmission&&a.enable(15),S.sheen&&a.enable(16),S.opaque&&a.enable(17),S.pointsUvs&&a.enable(18),S.decodeVideoTexture&&a.enable(19),S.decodeVideoTextureEmissive&&a.enable(20),S.alphaToCoverage&&a.enable(21),E.push(a.mask)}function M(E){const S=_[E.type];let L;if(S){const k=Qt[S];L=Uh.clone(k.uniforms)}else L=E.uniforms;return L}function C(E,S){let L;for(let k=0,X=h.length;k<X;k++){const Z=h[k];if(Z.cacheKey===S){L=Z,++L.usedTimes;break}}return L===void 0&&(L=new am(i,S,E,r),h.push(L)),L}function R(E){if(--E.usedTimes===0){const S=h.indexOf(E);h[S]=h[h.length-1],h.pop(),E.destroy()}}function P(E){l.remove(E)}function N(){l.dispose()}return{getParameters:m,getProgramCacheKey:d,getUniforms:M,acquireProgram:C,releaseProgram:R,releaseShaderCache:P,programs:h,dispose:N}}function um(){let i=new WeakMap;function e(o){return i.has(o)}function t(o){let a=i.get(o);return a===void 0&&(a={},i.set(o,a)),a}function n(o){i.delete(o)}function s(o,a,l){i.get(o)[a]=l}function r(){i=new WeakMap}return{has:e,get:t,remove:n,update:s,dispose:r}}function dm(i,e){return i.groupOrder!==e.groupOrder?i.groupOrder-e.groupOrder:i.renderOrder!==e.renderOrder?i.renderOrder-e.renderOrder:i.material.id!==e.material.id?i.material.id-e.material.id:i.z!==e.z?i.z-e.z:i.id-e.id}function $o(i,e){return i.groupOrder!==e.groupOrder?i.groupOrder-e.groupOrder:i.renderOrder!==e.renderOrder?i.renderOrder-e.renderOrder:i.z!==e.z?e.z-i.z:i.id-e.id}function Ko(){const i=[];let e=0;const t=[],n=[],s=[];function r(){e=0,t.length=0,n.length=0,s.length=0}function o(u,f,p,_,v,m){let d=i[e];return d===void 0?(d={id:u.id,object:u,geometry:f,material:p,groupOrder:_,renderOrder:u.renderOrder,z:v,group:m},i[e]=d):(d.id=u.id,d.object=u,d.geometry=f,d.material=p,d.groupOrder=_,d.renderOrder=u.renderOrder,d.z=v,d.group=m),e++,d}function a(u,f,p,_,v,m){const d=o(u,f,p,_,v,m);p.transmission>0?n.push(d):p.transparent===!0?s.push(d):t.push(d)}function l(u,f,p,_,v,m){const d=o(u,f,p,_,v,m);p.transmission>0?n.unshift(d):p.transparent===!0?s.unshift(d):t.unshift(d)}function c(u,f){t.length>1&&t.sort(u||dm),n.length>1&&n.sort(f||$o),s.length>1&&s.sort(f||$o)}function h(){for(let u=e,f=i.length;u<f;u++){const p=i[u];if(p.id===null)break;p.id=null,p.object=null,p.geometry=null,p.material=null,p.group=null}}return{opaque:t,transmissive:n,transparent:s,init:r,push:a,unshift:l,finish:h,sort:c}}function fm(){let i=new WeakMap;function e(n,s){const r=i.get(n);let o;return r===void 0?(o=new Ko,i.set(n,[o])):s>=r.length?(o=new Ko,r.push(o)):o=r[s],o}function t(){i=new WeakMap}return{get:e,dispose:t}}function pm(){const i={};return{get:function(e){if(i[e.id]!==void 0)return i[e.id];let t;switch(e.type){case"DirectionalLight":t={direction:new F,color:new ze};break;case"SpotLight":t={position:new F,direction:new F,color:new ze,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new F,color:new ze,distance:0,decay:0};break;case"HemisphereLight":t={direction:new F,skyColor:new ze,groundColor:new ze};break;case"RectAreaLight":t={color:new ze,position:new F,halfWidth:new F,halfHeight:new F};break}return i[e.id]=t,t}}}function mm(){const i={};return{get:function(e){if(i[e.id]!==void 0)return i[e.id];let t;switch(e.type){case"DirectionalLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new $e};break;case"SpotLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new $e};break;case"PointLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new $e,shadowCameraNear:1,shadowCameraFar:1e3};break}return i[e.id]=t,t}}}let gm=0;function _m(i,e){return(e.castShadow?2:0)-(i.castShadow?2:0)+(e.map?1:0)-(i.map?1:0)}function vm(i){const e=new pm,t=mm(),n={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)n.probe.push(new F);const s=new F,r=new ut,o=new ut;function a(c){let h=0,u=0,f=0;for(let E=0;E<9;E++)n.probe[E].set(0,0,0);let p=0,_=0,v=0,m=0,d=0,w=0,T=0,M=0,C=0,R=0,P=0;c.sort(_m);for(let E=0,S=c.length;E<S;E++){const L=c[E],k=L.color,X=L.intensity,Z=L.distance,Y=L.shadow&&L.shadow.map?L.shadow.map.texture:null;if(L.isAmbientLight)h+=k.r*X,u+=k.g*X,f+=k.b*X;else if(L.isLightProbe){for(let G=0;G<9;G++)n.probe[G].addScaledVector(L.sh.coefficients[G],X);P++}else if(L.isDirectionalLight){const G=e.get(L);if(G.color.copy(L.color).multiplyScalar(L.intensity),L.castShadow){const A=L.shadow,W=t.get(L);W.shadowIntensity=A.intensity,W.shadowBias=A.bias,W.shadowNormalBias=A.normalBias,W.shadowRadius=A.radius,W.shadowMapSize=A.mapSize,n.directionalShadow[p]=W,n.directionalShadowMap[p]=Y,n.directionalShadowMatrix[p]=L.shadow.matrix,w++}n.directional[p]=G,p++}else if(L.isSpotLight){const G=e.get(L);G.position.setFromMatrixPosition(L.matrixWorld),G.color.copy(k).multiplyScalar(X),G.distance=Z,G.coneCos=Math.cos(L.angle),G.penumbraCos=Math.cos(L.angle*(1-L.penumbra)),G.decay=L.decay,n.spot[v]=G;const A=L.shadow;if(L.map&&(n.spotLightMap[C]=L.map,C++,A.updateMatrices(L),L.castShadow&&R++),n.spotLightMatrix[v]=A.matrix,L.castShadow){const W=t.get(L);W.shadowIntensity=A.intensity,W.shadowBias=A.bias,W.shadowNormalBias=A.normalBias,W.shadowRadius=A.radius,W.shadowMapSize=A.mapSize,n.spotShadow[v]=W,n.spotShadowMap[v]=Y,M++}v++}else if(L.isRectAreaLight){const G=e.get(L);G.color.copy(k).multiplyScalar(X),G.halfWidth.set(L.width*.5,0,0),G.halfHeight.set(0,L.height*.5,0),n.rectArea[m]=G,m++}else if(L.isPointLight){const G=e.get(L);if(G.color.copy(L.color).multiplyScalar(L.intensity),G.distance=L.distance,G.decay=L.decay,L.castShadow){const A=L.shadow,W=t.get(L);W.shadowIntensity=A.intensity,W.shadowBias=A.bias,W.shadowNormalBias=A.normalBias,W.shadowRadius=A.radius,W.shadowMapSize=A.mapSize,W.shadowCameraNear=A.camera.near,W.shadowCameraFar=A.camera.far,n.pointShadow[_]=W,n.pointShadowMap[_]=Y,n.pointShadowMatrix[_]=L.shadow.matrix,T++}n.point[_]=G,_++}else if(L.isHemisphereLight){const G=e.get(L);G.skyColor.copy(L.color).multiplyScalar(X),G.groundColor.copy(L.groundColor).multiplyScalar(X),n.hemi[d]=G,d++}}m>0&&(i.has("OES_texture_float_linear")===!0?(n.rectAreaLTC1=ae.LTC_FLOAT_1,n.rectAreaLTC2=ae.LTC_FLOAT_2):(n.rectAreaLTC1=ae.LTC_HALF_1,n.rectAreaLTC2=ae.LTC_HALF_2)),n.ambient[0]=h,n.ambient[1]=u,n.ambient[2]=f;const N=n.hash;(N.directionalLength!==p||N.pointLength!==_||N.spotLength!==v||N.rectAreaLength!==m||N.hemiLength!==d||N.numDirectionalShadows!==w||N.numPointShadows!==T||N.numSpotShadows!==M||N.numSpotMaps!==C||N.numLightProbes!==P)&&(n.directional.length=p,n.spot.length=v,n.rectArea.length=m,n.point.length=_,n.hemi.length=d,n.directionalShadow.length=w,n.directionalShadowMap.length=w,n.pointShadow.length=T,n.pointShadowMap.length=T,n.spotShadow.length=M,n.spotShadowMap.length=M,n.directionalShadowMatrix.length=w,n.pointShadowMatrix.length=T,n.spotLightMatrix.length=M+C-R,n.spotLightMap.length=C,n.numSpotLightShadowsWithMaps=R,n.numLightProbes=P,N.directionalLength=p,N.pointLength=_,N.spotLength=v,N.rectAreaLength=m,N.hemiLength=d,N.numDirectionalShadows=w,N.numPointShadows=T,N.numSpotShadows=M,N.numSpotMaps=C,N.numLightProbes=P,n.version=gm++)}function l(c,h){let u=0,f=0,p=0,_=0,v=0;const m=h.matrixWorldInverse;for(let d=0,w=c.length;d<w;d++){const T=c[d];if(T.isDirectionalLight){const M=n.directional[u];M.direction.setFromMatrixPosition(T.matrixWorld),s.setFromMatrixPosition(T.target.matrixWorld),M.direction.sub(s),M.direction.transformDirection(m),u++}else if(T.isSpotLight){const M=n.spot[p];M.position.setFromMatrixPosition(T.matrixWorld),M.position.applyMatrix4(m),M.direction.setFromMatrixPosition(T.matrixWorld),s.setFromMatrixPosition(T.target.matrixWorld),M.direction.sub(s),M.direction.transformDirection(m),p++}else if(T.isRectAreaLight){const M=n.rectArea[_];M.position.setFromMatrixPosition(T.matrixWorld),M.position.applyMatrix4(m),o.identity(),r.copy(T.matrixWorld),r.premultiply(m),o.extractRotation(r),M.halfWidth.set(T.width*.5,0,0),M.halfHeight.set(0,T.height*.5,0),M.halfWidth.applyMatrix4(o),M.halfHeight.applyMatrix4(o),_++}else if(T.isPointLight){const M=n.point[f];M.position.setFromMatrixPosition(T.matrixWorld),M.position.applyMatrix4(m),f++}else if(T.isHemisphereLight){const M=n.hemi[v];M.direction.setFromMatrixPosition(T.matrixWorld),M.direction.transformDirection(m),v++}}}return{setup:a,setupView:l,state:n}}function Zo(i){const e=new vm(i),t=[],n=[];function s(h){c.camera=h,t.length=0,n.length=0}function r(h){t.push(h)}function o(h){n.push(h)}function a(){e.setup(t)}function l(h){e.setupView(t,h)}const c={lightsArray:t,shadowsArray:n,camera:null,lights:e,transmissionRenderTarget:{}};return{init:s,state:c,setupLights:a,setupLightsView:l,pushLight:r,pushShadow:o}}function xm(i){let e=new WeakMap;function t(s,r=0){const o=e.get(s);let a;return o===void 0?(a=new Zo(i),e.set(s,[a])):r>=o.length?(a=new Zo(i),o.push(a)):a=o[r],a}function n(){e=new WeakMap}return{get:t,dispose:n}}const Mm=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,Sm=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
#include <packing>
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = unpackRGBATo2Half( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ) );
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = unpackRGBAToDepth( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ) );
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( squared_mean - mean * mean );
	gl_FragColor = pack2HalfToRGBA( vec2( mean, std_dev ) );
}`;function Em(i,e,t){let n=new Il;const s=new $e,r=new $e,o=new ct,a=new $h({depthPacking:Hc}),l=new Kh,c={},h=t.maxTextureSize,u={[Un]:wt,[wt]:Un,[Ht]:Ht},f=new Ct({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new $e},radius:{value:4}},vertexShader:Mm,fragmentShader:Sm}),p=f.clone();p.defines.HORIZONTAL_PASS=1;const _=new It;_.setAttribute("position",new gt(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const v=new bt(_,f),m=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=fl;let d=this.type;this.render=function(R,P,N){if(m.enabled===!1||m.autoUpdate===!1&&m.needsUpdate===!1||R.length===0)return;const E=i.getRenderTarget(),S=i.getActiveCubeFace(),L=i.getActiveMipmapLevel(),k=i.state;k.setBlending(Dn),k.buffers.depth.getReversed()===!0?k.buffers.color.setClear(0,0,0,0):k.buffers.color.setClear(1,1,1,1),k.buffers.depth.setTest(!0),k.setScissorTest(!1);const X=d!==dn&&this.type===dn,Z=d===dn&&this.type!==dn;for(let Y=0,G=R.length;Y<G;Y++){const A=R[Y],W=A.shadow;if(W===void 0){console.warn("THREE.WebGLShadowMap:",A,"has no shadow.");continue}if(W.autoUpdate===!1&&W.needsUpdate===!1)continue;s.copy(W.mapSize);const ie=W.getFrameExtents();if(s.multiply(ie),r.copy(W.mapSize),(s.x>h||s.y>h)&&(s.x>h&&(r.x=Math.floor(h/ie.x),s.x=r.x*ie.x,W.mapSize.x=r.x),s.y>h&&(r.y=Math.floor(h/ie.y),s.y=r.y*ie.y,W.mapSize.y=r.y)),W.map===null||X===!0||Z===!0){const xe=this.type!==dn?{minFilter:ht,magFilter:ht}:{};W.map!==null&&W.map.dispose(),W.map=new In(s.x,s.y,xe),W.map.texture.name=A.name+".shadowMap",W.camera.updateProjectionMatrix()}i.setRenderTarget(W.map),i.clear();const ue=W.getViewportCount();for(let xe=0;xe<ue;xe++){const Ne=W.getViewport(xe);o.set(r.x*Ne.x,r.y*Ne.y,r.x*Ne.z,r.y*Ne.w),k.viewport(o),W.updateMatrices(A,xe),n=W.getFrustum(),M(P,N,W.camera,A,this.type)}W.isPointLightShadow!==!0&&this.type===dn&&w(W,N),W.needsUpdate=!1}d=this.type,m.needsUpdate=!1,i.setRenderTarget(E,S,L)};function w(R,P){const N=e.update(v);f.defines.VSM_SAMPLES!==R.blurSamples&&(f.defines.VSM_SAMPLES=R.blurSamples,p.defines.VSM_SAMPLES=R.blurSamples,f.needsUpdate=!0,p.needsUpdate=!0),R.mapPass===null&&(R.mapPass=new In(s.x,s.y)),f.uniforms.shadow_pass.value=R.map.texture,f.uniforms.resolution.value=R.mapSize,f.uniforms.radius.value=R.radius,i.setRenderTarget(R.mapPass),i.clear(),i.renderBufferDirect(P,null,N,f,v,null),p.uniforms.shadow_pass.value=R.mapPass.texture,p.uniforms.resolution.value=R.mapSize,p.uniforms.radius.value=R.radius,i.setRenderTarget(R.map),i.clear(),i.renderBufferDirect(P,null,N,p,v,null)}function T(R,P,N,E){let S=null;const L=N.isPointLight===!0?R.customDistanceMaterial:R.customDepthMaterial;if(L!==void 0)S=L;else if(S=N.isPointLight===!0?l:a,i.localClippingEnabled&&P.clipShadows===!0&&Array.isArray(P.clippingPlanes)&&P.clippingPlanes.length!==0||P.displacementMap&&P.displacementScale!==0||P.alphaMap&&P.alphaTest>0||P.map&&P.alphaTest>0||P.alphaToCoverage===!0){const k=S.uuid,X=P.uuid;let Z=c[k];Z===void 0&&(Z={},c[k]=Z);let Y=Z[X];Y===void 0&&(Y=S.clone(),Z[X]=Y,P.addEventListener("dispose",C)),S=Y}if(S.visible=P.visible,S.wireframe=P.wireframe,E===dn?S.side=P.shadowSide!==null?P.shadowSide:P.side:S.side=P.shadowSide!==null?P.shadowSide:u[P.side],S.alphaMap=P.alphaMap,S.alphaTest=P.alphaToCoverage===!0?.5:P.alphaTest,S.map=P.map,S.clipShadows=P.clipShadows,S.clippingPlanes=P.clippingPlanes,S.clipIntersection=P.clipIntersection,S.displacementMap=P.displacementMap,S.displacementScale=P.displacementScale,S.displacementBias=P.displacementBias,S.wireframeLinewidth=P.wireframeLinewidth,S.linewidth=P.linewidth,N.isPointLight===!0&&S.isMeshDistanceMaterial===!0){const k=i.properties.get(S);k.light=N}return S}function M(R,P,N,E,S){if(R.visible===!1)return;if(R.layers.test(P.layers)&&(R.isMesh||R.isLine||R.isPoints)&&(R.castShadow||R.receiveShadow&&S===dn)&&(!R.frustumCulled||n.intersectsObject(R))){R.modelViewMatrix.multiplyMatrices(N.matrixWorldInverse,R.matrixWorld);const X=e.update(R),Z=R.material;if(Array.isArray(Z)){const Y=X.groups;for(let G=0,A=Y.length;G<A;G++){const W=Y[G],ie=Z[W.materialIndex];if(ie&&ie.visible){const ue=T(R,ie,E,S);R.onBeforeShadow(i,R,P,N,X,ue,W),i.renderBufferDirect(N,null,X,ue,R,W),R.onAfterShadow(i,R,P,N,X,ue,W)}}}else if(Z.visible){const Y=T(R,Z,E,S);R.onBeforeShadow(i,R,P,N,X,Y,null),i.renderBufferDirect(N,null,X,Y,R,null),R.onAfterShadow(i,R,P,N,X,Y,null)}}const k=R.children;for(let X=0,Z=k.length;X<Z;X++)M(k[X],P,N,E,S)}function C(R){R.target.removeEventListener("dispose",C);for(const N in c){const E=c[N],S=R.target.uuid;S in E&&(E[S].dispose(),delete E[S])}}}const ym={[Fr]:Nr,[Or]:Ns,[Br]:kr,[Zn]:zr,[Nr]:Fr,[Ns]:Or,[kr]:Br,[zr]:Zn};function Tm(i,e){function t(){let D=!1;const te=new ct;let se=null;const me=new ct(0,0,0,0);return{setMask:function(Q){se!==Q&&!D&&(i.colorMask(Q,Q,Q,Q),se=Q)},setLocked:function(Q){D=Q},setClear:function(Q,K,ye,Le,tt){tt===!0&&(Q*=Le,K*=Le,ye*=Le),te.set(Q,K,ye,Le),me.equals(te)===!1&&(i.clearColor(Q,K,ye,Le),me.copy(te))},reset:function(){D=!1,se=null,me.set(-1,0,0,0)}}}function n(){let D=!1,te=!1,se=null,me=null,Q=null;return{setReversed:function(K){if(te!==K){const ye=e.get("EXT_clip_control");K?ye.clipControlEXT(ye.LOWER_LEFT_EXT,ye.ZERO_TO_ONE_EXT):ye.clipControlEXT(ye.LOWER_LEFT_EXT,ye.NEGATIVE_ONE_TO_ONE_EXT),te=K;const Le=Q;Q=null,this.setClear(Le)}},getReversed:function(){return te},setTest:function(K){K?j(i.DEPTH_TEST):de(i.DEPTH_TEST)},setMask:function(K){se!==K&&!D&&(i.depthMask(K),se=K)},setFunc:function(K){if(te&&(K=ym[K]),me!==K){switch(K){case Fr:i.depthFunc(i.NEVER);break;case Nr:i.depthFunc(i.ALWAYS);break;case Or:i.depthFunc(i.LESS);break;case Zn:i.depthFunc(i.LEQUAL);break;case Br:i.depthFunc(i.EQUAL);break;case zr:i.depthFunc(i.GEQUAL);break;case Ns:i.depthFunc(i.GREATER);break;case kr:i.depthFunc(i.NOTEQUAL);break;default:i.depthFunc(i.LEQUAL)}me=K}},setLocked:function(K){D=K},setClear:function(K){Q!==K&&(te&&(K=1-K),i.clearDepth(K),Q=K)},reset:function(){D=!1,se=null,me=null,Q=null,te=!1}}}function s(){let D=!1,te=null,se=null,me=null,Q=null,K=null,ye=null,Le=null,tt=null;return{setTest:function(Ye){D||(Ye?j(i.STENCIL_TEST):de(i.STENCIL_TEST))},setMask:function(Ye){te!==Ye&&!D&&(i.stencilMask(Ye),te=Ye)},setFunc:function(Ye,an,Jt){(se!==Ye||me!==an||Q!==Jt)&&(i.stencilFunc(Ye,an,Jt),se=Ye,me=an,Q=Jt)},setOp:function(Ye,an,Jt){(K!==Ye||ye!==an||Le!==Jt)&&(i.stencilOp(Ye,an,Jt),K=Ye,ye=an,Le=Jt)},setLocked:function(Ye){D=Ye},setClear:function(Ye){tt!==Ye&&(i.clearStencil(Ye),tt=Ye)},reset:function(){D=!1,te=null,se=null,me=null,Q=null,K=null,ye=null,Le=null,tt=null}}}const r=new t,o=new n,a=new s,l=new WeakMap,c=new WeakMap;let h={},u={},f=new WeakMap,p=[],_=null,v=!1,m=null,d=null,w=null,T=null,M=null,C=null,R=null,P=new ze(0,0,0),N=0,E=!1,S=null,L=null,k=null,X=null,Z=null;const Y=i.getParameter(i.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let G=!1,A=0;const W=i.getParameter(i.VERSION);W.indexOf("WebGL")!==-1?(A=parseFloat(/^WebGL (\d)/.exec(W)[1]),G=A>=1):W.indexOf("OpenGL ES")!==-1&&(A=parseFloat(/^OpenGL ES (\d)/.exec(W)[1]),G=A>=2);let ie=null,ue={};const xe=i.getParameter(i.SCISSOR_BOX),Ne=i.getParameter(i.VIEWPORT),Ke=new ct().fromArray(xe),Qe=new ct().fromArray(Ne);function Ge(D,te,se,me){const Q=new Uint8Array(4),K=i.createTexture();i.bindTexture(D,K),i.texParameteri(D,i.TEXTURE_MIN_FILTER,i.NEAREST),i.texParameteri(D,i.TEXTURE_MAG_FILTER,i.NEAREST);for(let ye=0;ye<se;ye++)D===i.TEXTURE_3D||D===i.TEXTURE_2D_ARRAY?i.texImage3D(te,0,i.RGBA,1,1,me,0,i.RGBA,i.UNSIGNED_BYTE,Q):i.texImage2D(te+ye,0,i.RGBA,1,1,0,i.RGBA,i.UNSIGNED_BYTE,Q);return K}const $={};$[i.TEXTURE_2D]=Ge(i.TEXTURE_2D,i.TEXTURE_2D,1),$[i.TEXTURE_CUBE_MAP]=Ge(i.TEXTURE_CUBE_MAP,i.TEXTURE_CUBE_MAP_POSITIVE_X,6),$[i.TEXTURE_2D_ARRAY]=Ge(i.TEXTURE_2D_ARRAY,i.TEXTURE_2D_ARRAY,1,1),$[i.TEXTURE_3D]=Ge(i.TEXTURE_3D,i.TEXTURE_3D,1,1),r.setClear(0,0,0,1),o.setClear(1),a.setClear(0),j(i.DEPTH_TEST),o.setFunc(Zn),be(!1),pe($a),j(i.CULL_FACE),Ze(Dn);function j(D){h[D]!==!0&&(i.enable(D),h[D]=!0)}function de(D){h[D]!==!1&&(i.disable(D),h[D]=!1)}function he(D,te){return u[D]!==te?(i.bindFramebuffer(D,te),u[D]=te,D===i.DRAW_FRAMEBUFFER&&(u[i.FRAMEBUFFER]=te),D===i.FRAMEBUFFER&&(u[i.DRAW_FRAMEBUFFER]=te),!0):!1}function ge(D,te){let se=p,me=!1;if(D){se=f.get(te),se===void 0&&(se=[],f.set(te,se));const Q=D.textures;if(se.length!==Q.length||se[0]!==i.COLOR_ATTACHMENT0){for(let K=0,ye=Q.length;K<ye;K++)se[K]=i.COLOR_ATTACHMENT0+K;se.length=Q.length,me=!0}}else se[0]!==i.BACK&&(se[0]=i.BACK,me=!0);me&&i.drawBuffers(se)}function Be(D){return _!==D?(i.useProgram(D),_=D,!0):!1}const lt={[qn]:i.FUNC_ADD,[fc]:i.FUNC_SUBTRACT,[pc]:i.FUNC_REVERSE_SUBTRACT};lt[mc]=i.MIN,lt[gc]=i.MAX;const b={[_c]:i.ZERO,[vc]:i.ONE,[xc]:i.SRC_COLOR,[Ur]:i.SRC_ALPHA,[bc]:i.SRC_ALPHA_SATURATE,[yc]:i.DST_COLOR,[Sc]:i.DST_ALPHA,[Mc]:i.ONE_MINUS_SRC_COLOR,[Ir]:i.ONE_MINUS_SRC_ALPHA,[Tc]:i.ONE_MINUS_DST_COLOR,[Ec]:i.ONE_MINUS_DST_ALPHA,[wc]:i.CONSTANT_COLOR,[Ac]:i.ONE_MINUS_CONSTANT_COLOR,[Rc]:i.CONSTANT_ALPHA,[Cc]:i.ONE_MINUS_CONSTANT_ALPHA};function Ze(D,te,se,me,Q,K,ye,Le,tt,Ye){if(D===Dn){v===!0&&(de(i.BLEND),v=!1);return}if(v===!1&&(j(i.BLEND),v=!0),D!==dc){if(D!==m||Ye!==E){if((d!==qn||M!==qn)&&(i.blendEquation(i.FUNC_ADD),d=qn,M=qn),Ye)switch(D){case vi:i.blendFuncSeparate(i.ONE,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case Ka:i.blendFunc(i.ONE,i.ONE);break;case Za:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case ja:i.blendFuncSeparate(i.DST_COLOR,i.ONE_MINUS_SRC_ALPHA,i.ZERO,i.ONE);break;default:console.error("THREE.WebGLState: Invalid blending: ",D);break}else switch(D){case vi:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case Ka:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE,i.ONE,i.ONE);break;case Za:console.error("THREE.WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case ja:console.error("THREE.WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:console.error("THREE.WebGLState: Invalid blending: ",D);break}w=null,T=null,C=null,R=null,P.set(0,0,0),N=0,m=D,E=Ye}return}Q=Q||te,K=K||se,ye=ye||me,(te!==d||Q!==M)&&(i.blendEquationSeparate(lt[te],lt[Q]),d=te,M=Q),(se!==w||me!==T||K!==C||ye!==R)&&(i.blendFuncSeparate(b[se],b[me],b[K],b[ye]),w=se,T=me,C=K,R=ye),(Le.equals(P)===!1||tt!==N)&&(i.blendColor(Le.r,Le.g,Le.b,tt),P.copy(Le),N=tt),m=D,E=!1}function De(D,te){D.side===Ht?de(i.CULL_FACE):j(i.CULL_FACE);let se=D.side===wt;te&&(se=!se),be(se),D.blending===vi&&D.transparent===!1?Ze(Dn):Ze(D.blending,D.blendEquation,D.blendSrc,D.blendDst,D.blendEquationAlpha,D.blendSrcAlpha,D.blendDstAlpha,D.blendColor,D.blendAlpha,D.premultipliedAlpha),o.setFunc(D.depthFunc),o.setTest(D.depthTest),o.setMask(D.depthWrite),r.setMask(D.colorWrite);const me=D.stencilWrite;a.setTest(me),me&&(a.setMask(D.stencilWriteMask),a.setFunc(D.stencilFunc,D.stencilRef,D.stencilFuncMask),a.setOp(D.stencilFail,D.stencilZFail,D.stencilZPass)),_e(D.polygonOffset,D.polygonOffsetFactor,D.polygonOffsetUnits),D.alphaToCoverage===!0?j(i.SAMPLE_ALPHA_TO_COVERAGE):de(i.SAMPLE_ALPHA_TO_COVERAGE)}function be(D){S!==D&&(D?i.frontFace(i.CW):i.frontFace(i.CCW),S=D)}function pe(D){D!==cc?(j(i.CULL_FACE),D!==L&&(D===$a?i.cullFace(i.BACK):D===hc?i.cullFace(i.FRONT):i.cullFace(i.FRONT_AND_BACK))):de(i.CULL_FACE),L=D}function qe(D){D!==k&&(G&&i.lineWidth(D),k=D)}function _e(D,te,se){D?(j(i.POLYGON_OFFSET_FILL),(X!==te||Z!==se)&&(i.polygonOffset(te,se),X=te,Z=se)):de(i.POLYGON_OFFSET_FILL)}function Ue(D){D?j(i.SCISSOR_TEST):de(i.SCISSOR_TEST)}function at(D){D===void 0&&(D=i.TEXTURE0+Y-1),ie!==D&&(i.activeTexture(D),ie=D)}function nt(D,te,se){se===void 0&&(ie===null?se=i.TEXTURE0+Y-1:se=ie);let me=ue[se];me===void 0&&(me={type:void 0,texture:void 0},ue[se]=me),(me.type!==D||me.texture!==te)&&(ie!==se&&(i.activeTexture(se),ie=se),i.bindTexture(D,te||$[D]),me.type=D,me.texture=te)}function y(){const D=ue[ie];D!==void 0&&D.type!==void 0&&(i.bindTexture(D.type,null),D.type=void 0,D.texture=void 0)}function g(){try{i.compressedTexImage2D(...arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function O(){try{i.compressedTexImage3D(...arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function q(){try{i.texSubImage2D(...arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function B(){try{i.texSubImage3D(...arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function V(){try{i.compressedTexSubImage2D(...arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function le(){try{i.compressedTexSubImage3D(...arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function ne(){try{i.texStorage2D(...arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function Me(){try{i.texStorage3D(...arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function Ee(){try{i.texImage2D(...arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function J(){try{i.texImage3D(...arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function oe(D){Ke.equals(D)===!1&&(i.scissor(D.x,D.y,D.z,D.w),Ke.copy(D))}function we(D){Qe.equals(D)===!1&&(i.viewport(D.x,D.y,D.z,D.w),Qe.copy(D))}function ve(D,te){let se=c.get(te);se===void 0&&(se=new WeakMap,c.set(te,se));let me=se.get(D);me===void 0&&(me=i.getUniformBlockIndex(te,D.name),se.set(D,me))}function re(D,te){const me=c.get(te).get(D);l.get(te)!==me&&(i.uniformBlockBinding(te,me,D.__bindingPointIndex),l.set(te,me))}function Te(){i.disable(i.BLEND),i.disable(i.CULL_FACE),i.disable(i.DEPTH_TEST),i.disable(i.POLYGON_OFFSET_FILL),i.disable(i.SCISSOR_TEST),i.disable(i.STENCIL_TEST),i.disable(i.SAMPLE_ALPHA_TO_COVERAGE),i.blendEquation(i.FUNC_ADD),i.blendFunc(i.ONE,i.ZERO),i.blendFuncSeparate(i.ONE,i.ZERO,i.ONE,i.ZERO),i.blendColor(0,0,0,0),i.colorMask(!0,!0,!0,!0),i.clearColor(0,0,0,0),i.depthMask(!0),i.depthFunc(i.LESS),o.setReversed(!1),i.clearDepth(1),i.stencilMask(4294967295),i.stencilFunc(i.ALWAYS,0,4294967295),i.stencilOp(i.KEEP,i.KEEP,i.KEEP),i.clearStencil(0),i.cullFace(i.BACK),i.frontFace(i.CCW),i.polygonOffset(0,0),i.activeTexture(i.TEXTURE0),i.bindFramebuffer(i.FRAMEBUFFER,null),i.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),i.bindFramebuffer(i.READ_FRAMEBUFFER,null),i.useProgram(null),i.lineWidth(1),i.scissor(0,0,i.canvas.width,i.canvas.height),i.viewport(0,0,i.canvas.width,i.canvas.height),h={},ie=null,ue={},u={},f=new WeakMap,p=[],_=null,v=!1,m=null,d=null,w=null,T=null,M=null,C=null,R=null,P=new ze(0,0,0),N=0,E=!1,S=null,L=null,k=null,X=null,Z=null,Ke.set(0,0,i.canvas.width,i.canvas.height),Qe.set(0,0,i.canvas.width,i.canvas.height),r.reset(),o.reset(),a.reset()}return{buffers:{color:r,depth:o,stencil:a},enable:j,disable:de,bindFramebuffer:he,drawBuffers:ge,useProgram:Be,setBlending:Ze,setMaterial:De,setFlipSided:be,setCullFace:pe,setLineWidth:qe,setPolygonOffset:_e,setScissorTest:Ue,activeTexture:at,bindTexture:nt,unbindTexture:y,compressedTexImage2D:g,compressedTexImage3D:O,texImage2D:Ee,texImage3D:J,updateUBOMapping:ve,uniformBlockBinding:re,texStorage2D:ne,texStorage3D:Me,texSubImage2D:q,texSubImage3D:B,compressedTexSubImage2D:V,compressedTexSubImage3D:le,scissor:oe,viewport:we,reset:Te}}function bm(i,e,t,n,s,r,o){const a=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new $e,h=new WeakMap;let u;const f=new WeakMap;let p=!1;try{p=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function _(y,g){return p?new OffscreenCanvas(y,g):zs("canvas")}function v(y,g,O){let q=1;const B=nt(y);if((B.width>O||B.height>O)&&(q=O/Math.max(B.width,B.height)),q<1)if(typeof HTMLImageElement<"u"&&y instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&y instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&y instanceof ImageBitmap||typeof VideoFrame<"u"&&y instanceof VideoFrame){const V=Math.floor(q*B.width),le=Math.floor(q*B.height);u===void 0&&(u=_(V,le));const ne=g?_(V,le):u;return ne.width=V,ne.height=le,ne.getContext("2d").drawImage(y,0,0,V,le),console.warn("THREE.WebGLRenderer: Texture has been resized from ("+B.width+"x"+B.height+") to ("+V+"x"+le+")."),ne}else return"data"in y&&console.warn("THREE.WebGLRenderer: Image in DataTexture is too big ("+B.width+"x"+B.height+")."),y;return y}function m(y){return y.generateMipmaps}function d(y){i.generateMipmap(y)}function w(y){return y.isWebGLCubeRenderTarget?i.TEXTURE_CUBE_MAP:y.isWebGL3DRenderTarget?i.TEXTURE_3D:y.isWebGLArrayRenderTarget||y.isCompressedArrayTexture?i.TEXTURE_2D_ARRAY:i.TEXTURE_2D}function T(y,g,O,q,B=!1){if(y!==null){if(i[y]!==void 0)return i[y];console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '"+y+"'")}let V=g;if(g===i.RED&&(O===i.FLOAT&&(V=i.R32F),O===i.HALF_FLOAT&&(V=i.R16F),O===i.UNSIGNED_BYTE&&(V=i.R8)),g===i.RED_INTEGER&&(O===i.UNSIGNED_BYTE&&(V=i.R8UI),O===i.UNSIGNED_SHORT&&(V=i.R16UI),O===i.UNSIGNED_INT&&(V=i.R32UI),O===i.BYTE&&(V=i.R8I),O===i.SHORT&&(V=i.R16I),O===i.INT&&(V=i.R32I)),g===i.RG&&(O===i.FLOAT&&(V=i.RG32F),O===i.HALF_FLOAT&&(V=i.RG16F),O===i.UNSIGNED_BYTE&&(V=i.RG8)),g===i.RG_INTEGER&&(O===i.UNSIGNED_BYTE&&(V=i.RG8UI),O===i.UNSIGNED_SHORT&&(V=i.RG16UI),O===i.UNSIGNED_INT&&(V=i.RG32UI),O===i.BYTE&&(V=i.RG8I),O===i.SHORT&&(V=i.RG16I),O===i.INT&&(V=i.RG32I)),g===i.RGB_INTEGER&&(O===i.UNSIGNED_BYTE&&(V=i.RGB8UI),O===i.UNSIGNED_SHORT&&(V=i.RGB16UI),O===i.UNSIGNED_INT&&(V=i.RGB32UI),O===i.BYTE&&(V=i.RGB8I),O===i.SHORT&&(V=i.RGB16I),O===i.INT&&(V=i.RGB32I)),g===i.RGBA_INTEGER&&(O===i.UNSIGNED_BYTE&&(V=i.RGBA8UI),O===i.UNSIGNED_SHORT&&(V=i.RGBA16UI),O===i.UNSIGNED_INT&&(V=i.RGBA32UI),O===i.BYTE&&(V=i.RGBA8I),O===i.SHORT&&(V=i.RGBA16I),O===i.INT&&(V=i.RGBA32I)),g===i.RGB&&(O===i.UNSIGNED_INT_5_9_9_9_REV&&(V=i.RGB9_E5),O===i.UNSIGNED_INT_10F_11F_11F_REV&&(V=i.R11F_G11F_B10F)),g===i.RGBA){const le=B?Os:Ve.getTransfer(q);O===i.FLOAT&&(V=i.RGBA32F),O===i.HALF_FLOAT&&(V=i.RGBA16F),O===i.UNSIGNED_BYTE&&(V=le===Je?i.SRGB8_ALPHA8:i.RGBA8),O===i.UNSIGNED_SHORT_4_4_4_4&&(V=i.RGBA4),O===i.UNSIGNED_SHORT_5_5_5_1&&(V=i.RGB5_A1)}return(V===i.R16F||V===i.R32F||V===i.RG16F||V===i.RG32F||V===i.RGBA16F||V===i.RGBA32F)&&e.get("EXT_color_buffer_float"),V}function M(y,g){let O;return y?g===null||g===jn||g===qi?O=i.DEPTH24_STENCIL8:g===fn?O=i.DEPTH32F_STENCIL8:g===Xi&&(O=i.DEPTH24_STENCIL8,console.warn("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):g===null||g===jn||g===qi?O=i.DEPTH_COMPONENT24:g===fn?O=i.DEPTH_COMPONENT32F:g===Xi&&(O=i.DEPTH_COMPONENT16),O}function C(y,g){return m(y)===!0||y.isFramebufferTexture&&y.minFilter!==ht&&y.minFilter!==tn?Math.log2(Math.max(g.width,g.height))+1:y.mipmaps!==void 0&&y.mipmaps.length>0?y.mipmaps.length:y.isCompressedTexture&&Array.isArray(y.image)?g.mipmaps.length:1}function R(y){const g=y.target;g.removeEventListener("dispose",R),N(g),g.isVideoTexture&&h.delete(g)}function P(y){const g=y.target;g.removeEventListener("dispose",P),S(g)}function N(y){const g=n.get(y);if(g.__webglInit===void 0)return;const O=y.source,q=f.get(O);if(q){const B=q[g.__cacheKey];B.usedTimes--,B.usedTimes===0&&E(y),Object.keys(q).length===0&&f.delete(O)}n.remove(y)}function E(y){const g=n.get(y);i.deleteTexture(g.__webglTexture);const O=y.source,q=f.get(O);delete q[g.__cacheKey],o.memory.textures--}function S(y){const g=n.get(y);if(y.depthTexture&&(y.depthTexture.dispose(),n.remove(y.depthTexture)),y.isWebGLCubeRenderTarget)for(let q=0;q<6;q++){if(Array.isArray(g.__webglFramebuffer[q]))for(let B=0;B<g.__webglFramebuffer[q].length;B++)i.deleteFramebuffer(g.__webglFramebuffer[q][B]);else i.deleteFramebuffer(g.__webglFramebuffer[q]);g.__webglDepthbuffer&&i.deleteRenderbuffer(g.__webglDepthbuffer[q])}else{if(Array.isArray(g.__webglFramebuffer))for(let q=0;q<g.__webglFramebuffer.length;q++)i.deleteFramebuffer(g.__webglFramebuffer[q]);else i.deleteFramebuffer(g.__webglFramebuffer);if(g.__webglDepthbuffer&&i.deleteRenderbuffer(g.__webglDepthbuffer),g.__webglMultisampledFramebuffer&&i.deleteFramebuffer(g.__webglMultisampledFramebuffer),g.__webglColorRenderbuffer)for(let q=0;q<g.__webglColorRenderbuffer.length;q++)g.__webglColorRenderbuffer[q]&&i.deleteRenderbuffer(g.__webglColorRenderbuffer[q]);g.__webglDepthRenderbuffer&&i.deleteRenderbuffer(g.__webglDepthRenderbuffer)}const O=y.textures;for(let q=0,B=O.length;q<B;q++){const V=n.get(O[q]);V.__webglTexture&&(i.deleteTexture(V.__webglTexture),o.memory.textures--),n.remove(O[q])}n.remove(y)}let L=0;function k(){L=0}function X(){const y=L;return y>=s.maxTextures&&console.warn("THREE.WebGLTextures: Trying to use "+y+" texture units while this GPU supports only "+s.maxTextures),L+=1,y}function Z(y){const g=[];return g.push(y.wrapS),g.push(y.wrapT),g.push(y.wrapR||0),g.push(y.magFilter),g.push(y.minFilter),g.push(y.anisotropy),g.push(y.internalFormat),g.push(y.format),g.push(y.type),g.push(y.generateMipmaps),g.push(y.premultiplyAlpha),g.push(y.flipY),g.push(y.unpackAlignment),g.push(y.colorSpace),g.join()}function Y(y,g){const O=n.get(y);if(y.isVideoTexture&&Ue(y),y.isRenderTargetTexture===!1&&y.isExternalTexture!==!0&&y.version>0&&O.__version!==y.version){const q=y.image;if(q===null)console.warn("THREE.WebGLRenderer: Texture marked for update but no image data found.");else if(q.complete===!1)console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete");else{$(O,y,g);return}}else y.isExternalTexture&&(O.__webglTexture=y.sourceTexture?y.sourceTexture:null);t.bindTexture(i.TEXTURE_2D,O.__webglTexture,i.TEXTURE0+g)}function G(y,g){const O=n.get(y);if(y.isRenderTargetTexture===!1&&y.version>0&&O.__version!==y.version){$(O,y,g);return}t.bindTexture(i.TEXTURE_2D_ARRAY,O.__webglTexture,i.TEXTURE0+g)}function A(y,g){const O=n.get(y);if(y.isRenderTargetTexture===!1&&y.version>0&&O.__version!==y.version){$(O,y,g);return}t.bindTexture(i.TEXTURE_3D,O.__webglTexture,i.TEXTURE0+g)}function W(y,g){const O=n.get(y);if(y.version>0&&O.__version!==y.version){j(O,y,g);return}t.bindTexture(i.TEXTURE_CUBE_MAP,O.__webglTexture,i.TEXTURE0+g)}const ie={[Vr]:i.REPEAT,[$n]:i.CLAMP_TO_EDGE,[Wr]:i.MIRRORED_REPEAT},ue={[ht]:i.NEAREST,[zc]:i.NEAREST_MIPMAP_NEAREST,[is]:i.NEAREST_MIPMAP_LINEAR,[tn]:i.LINEAR,[Zs]:i.LINEAR_MIPMAP_NEAREST,[Kn]:i.LINEAR_MIPMAP_LINEAR},xe={[Wc]:i.NEVER,[Zc]:i.ALWAYS,[Xc]:i.LESS,[Tl]:i.LEQUAL,[qc]:i.EQUAL,[Kc]:i.GEQUAL,[Yc]:i.GREATER,[$c]:i.NOTEQUAL};function Ne(y,g){if(g.type===fn&&e.has("OES_texture_float_linear")===!1&&(g.magFilter===tn||g.magFilter===Zs||g.magFilter===is||g.magFilter===Kn||g.minFilter===tn||g.minFilter===Zs||g.minFilter===is||g.minFilter===Kn)&&console.warn("THREE.WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),i.texParameteri(y,i.TEXTURE_WRAP_S,ie[g.wrapS]),i.texParameteri(y,i.TEXTURE_WRAP_T,ie[g.wrapT]),(y===i.TEXTURE_3D||y===i.TEXTURE_2D_ARRAY)&&i.texParameteri(y,i.TEXTURE_WRAP_R,ie[g.wrapR]),i.texParameteri(y,i.TEXTURE_MAG_FILTER,ue[g.magFilter]),i.texParameteri(y,i.TEXTURE_MIN_FILTER,ue[g.minFilter]),g.compareFunction&&(i.texParameteri(y,i.TEXTURE_COMPARE_MODE,i.COMPARE_REF_TO_TEXTURE),i.texParameteri(y,i.TEXTURE_COMPARE_FUNC,xe[g.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){if(g.magFilter===ht||g.minFilter!==is&&g.minFilter!==Kn||g.type===fn&&e.has("OES_texture_float_linear")===!1)return;if(g.anisotropy>1||n.get(g).__currentAnisotropy){const O=e.get("EXT_texture_filter_anisotropic");i.texParameterf(y,O.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(g.anisotropy,s.getMaxAnisotropy())),n.get(g).__currentAnisotropy=g.anisotropy}}}function Ke(y,g){let O=!1;y.__webglInit===void 0&&(y.__webglInit=!0,g.addEventListener("dispose",R));const q=g.source;let B=f.get(q);B===void 0&&(B={},f.set(q,B));const V=Z(g);if(V!==y.__cacheKey){B[V]===void 0&&(B[V]={texture:i.createTexture(),usedTimes:0},o.memory.textures++,O=!0),B[V].usedTimes++;const le=B[y.__cacheKey];le!==void 0&&(B[y.__cacheKey].usedTimes--,le.usedTimes===0&&E(g)),y.__cacheKey=V,y.__webglTexture=B[V].texture}return O}function Qe(y,g,O){return Math.floor(Math.floor(y/O)/g)}function Ge(y,g,O,q){const V=y.updateRanges;if(V.length===0)t.texSubImage2D(i.TEXTURE_2D,0,0,0,g.width,g.height,O,q,g.data);else{V.sort((J,oe)=>J.start-oe.start);let le=0;for(let J=1;J<V.length;J++){const oe=V[le],we=V[J],ve=oe.start+oe.count,re=Qe(we.start,g.width,4),Te=Qe(oe.start,g.width,4);we.start<=ve+1&&re===Te&&Qe(we.start+we.count-1,g.width,4)===re?oe.count=Math.max(oe.count,we.start+we.count-oe.start):(++le,V[le]=we)}V.length=le+1;const ne=i.getParameter(i.UNPACK_ROW_LENGTH),Me=i.getParameter(i.UNPACK_SKIP_PIXELS),Ee=i.getParameter(i.UNPACK_SKIP_ROWS);i.pixelStorei(i.UNPACK_ROW_LENGTH,g.width);for(let J=0,oe=V.length;J<oe;J++){const we=V[J],ve=Math.floor(we.start/4),re=Math.ceil(we.count/4),Te=ve%g.width,D=Math.floor(ve/g.width),te=re,se=1;i.pixelStorei(i.UNPACK_SKIP_PIXELS,Te),i.pixelStorei(i.UNPACK_SKIP_ROWS,D),t.texSubImage2D(i.TEXTURE_2D,0,Te,D,te,se,O,q,g.data)}y.clearUpdateRanges(),i.pixelStorei(i.UNPACK_ROW_LENGTH,ne),i.pixelStorei(i.UNPACK_SKIP_PIXELS,Me),i.pixelStorei(i.UNPACK_SKIP_ROWS,Ee)}}function $(y,g,O){let q=i.TEXTURE_2D;(g.isDataArrayTexture||g.isCompressedArrayTexture)&&(q=i.TEXTURE_2D_ARRAY),g.isData3DTexture&&(q=i.TEXTURE_3D);const B=Ke(y,g),V=g.source;t.bindTexture(q,y.__webglTexture,i.TEXTURE0+O);const le=n.get(V);if(V.version!==le.__version||B===!0){t.activeTexture(i.TEXTURE0+O);const ne=Ve.getPrimaries(Ve.workingColorSpace),Me=g.colorSpace===Rn?null:Ve.getPrimaries(g.colorSpace),Ee=g.colorSpace===Rn||ne===Me?i.NONE:i.BROWSER_DEFAULT_WEBGL;i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,g.flipY),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,g.premultiplyAlpha),i.pixelStorei(i.UNPACK_ALIGNMENT,g.unpackAlignment),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,Ee);let J=v(g.image,!1,s.maxTextureSize);J=at(g,J);const oe=r.convert(g.format,g.colorSpace),we=r.convert(g.type);let ve=T(g.internalFormat,oe,we,g.colorSpace,g.isVideoTexture);Ne(q,g);let re;const Te=g.mipmaps,D=g.isVideoTexture!==!0,te=le.__version===void 0||B===!0,se=V.dataReady,me=C(g,J);if(g.isDepthTexture)ve=M(g.format===$i,g.type),te&&(D?t.texStorage2D(i.TEXTURE_2D,1,ve,J.width,J.height):t.texImage2D(i.TEXTURE_2D,0,ve,J.width,J.height,0,oe,we,null));else if(g.isDataTexture)if(Te.length>0){D&&te&&t.texStorage2D(i.TEXTURE_2D,me,ve,Te[0].width,Te[0].height);for(let Q=0,K=Te.length;Q<K;Q++)re=Te[Q],D?se&&t.texSubImage2D(i.TEXTURE_2D,Q,0,0,re.width,re.height,oe,we,re.data):t.texImage2D(i.TEXTURE_2D,Q,ve,re.width,re.height,0,oe,we,re.data);g.generateMipmaps=!1}else D?(te&&t.texStorage2D(i.TEXTURE_2D,me,ve,J.width,J.height),se&&Ge(g,J,oe,we)):t.texImage2D(i.TEXTURE_2D,0,ve,J.width,J.height,0,oe,we,J.data);else if(g.isCompressedTexture)if(g.isCompressedArrayTexture){D&&te&&t.texStorage3D(i.TEXTURE_2D_ARRAY,me,ve,Te[0].width,Te[0].height,J.depth);for(let Q=0,K=Te.length;Q<K;Q++)if(re=Te[Q],g.format!==Gt)if(oe!==null)if(D){if(se)if(g.layerUpdates.size>0){const ye=wo(re.width,re.height,g.format,g.type);for(const Le of g.layerUpdates){const tt=re.data.subarray(Le*ye/re.data.BYTES_PER_ELEMENT,(Le+1)*ye/re.data.BYTES_PER_ELEMENT);t.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,Q,0,0,Le,re.width,re.height,1,oe,tt)}g.clearLayerUpdates()}else t.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,Q,0,0,0,re.width,re.height,J.depth,oe,re.data)}else t.compressedTexImage3D(i.TEXTURE_2D_ARRAY,Q,ve,re.width,re.height,J.depth,0,re.data,0,0);else console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else D?se&&t.texSubImage3D(i.TEXTURE_2D_ARRAY,Q,0,0,0,re.width,re.height,J.depth,oe,we,re.data):t.texImage3D(i.TEXTURE_2D_ARRAY,Q,ve,re.width,re.height,J.depth,0,oe,we,re.data)}else{D&&te&&t.texStorage2D(i.TEXTURE_2D,me,ve,Te[0].width,Te[0].height);for(let Q=0,K=Te.length;Q<K;Q++)re=Te[Q],g.format!==Gt?oe!==null?D?se&&t.compressedTexSubImage2D(i.TEXTURE_2D,Q,0,0,re.width,re.height,oe,re.data):t.compressedTexImage2D(i.TEXTURE_2D,Q,ve,re.width,re.height,0,re.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):D?se&&t.texSubImage2D(i.TEXTURE_2D,Q,0,0,re.width,re.height,oe,we,re.data):t.texImage2D(i.TEXTURE_2D,Q,ve,re.width,re.height,0,oe,we,re.data)}else if(g.isDataArrayTexture)if(D){if(te&&t.texStorage3D(i.TEXTURE_2D_ARRAY,me,ve,J.width,J.height,J.depth),se)if(g.layerUpdates.size>0){const Q=wo(J.width,J.height,g.format,g.type);for(const K of g.layerUpdates){const ye=J.data.subarray(K*Q/J.data.BYTES_PER_ELEMENT,(K+1)*Q/J.data.BYTES_PER_ELEMENT);t.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,K,J.width,J.height,1,oe,we,ye)}g.clearLayerUpdates()}else t.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,0,J.width,J.height,J.depth,oe,we,J.data)}else t.texImage3D(i.TEXTURE_2D_ARRAY,0,ve,J.width,J.height,J.depth,0,oe,we,J.data);else if(g.isData3DTexture)D?(te&&t.texStorage3D(i.TEXTURE_3D,me,ve,J.width,J.height,J.depth),se&&t.texSubImage3D(i.TEXTURE_3D,0,0,0,0,J.width,J.height,J.depth,oe,we,J.data)):t.texImage3D(i.TEXTURE_3D,0,ve,J.width,J.height,J.depth,0,oe,we,J.data);else if(g.isFramebufferTexture){if(te)if(D)t.texStorage2D(i.TEXTURE_2D,me,ve,J.width,J.height);else{let Q=J.width,K=J.height;for(let ye=0;ye<me;ye++)t.texImage2D(i.TEXTURE_2D,ye,ve,Q,K,0,oe,we,null),Q>>=1,K>>=1}}else if(Te.length>0){if(D&&te){const Q=nt(Te[0]);t.texStorage2D(i.TEXTURE_2D,me,ve,Q.width,Q.height)}for(let Q=0,K=Te.length;Q<K;Q++)re=Te[Q],D?se&&t.texSubImage2D(i.TEXTURE_2D,Q,0,0,oe,we,re):t.texImage2D(i.TEXTURE_2D,Q,ve,oe,we,re);g.generateMipmaps=!1}else if(D){if(te){const Q=nt(J);t.texStorage2D(i.TEXTURE_2D,me,ve,Q.width,Q.height)}se&&t.texSubImage2D(i.TEXTURE_2D,0,0,0,oe,we,J)}else t.texImage2D(i.TEXTURE_2D,0,ve,oe,we,J);m(g)&&d(q),le.__version=V.version,g.onUpdate&&g.onUpdate(g)}y.__version=g.version}function j(y,g,O){if(g.image.length!==6)return;const q=Ke(y,g),B=g.source;t.bindTexture(i.TEXTURE_CUBE_MAP,y.__webglTexture,i.TEXTURE0+O);const V=n.get(B);if(B.version!==V.__version||q===!0){t.activeTexture(i.TEXTURE0+O);const le=Ve.getPrimaries(Ve.workingColorSpace),ne=g.colorSpace===Rn?null:Ve.getPrimaries(g.colorSpace),Me=g.colorSpace===Rn||le===ne?i.NONE:i.BROWSER_DEFAULT_WEBGL;i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,g.flipY),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,g.premultiplyAlpha),i.pixelStorei(i.UNPACK_ALIGNMENT,g.unpackAlignment),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,Me);const Ee=g.isCompressedTexture||g.image[0].isCompressedTexture,J=g.image[0]&&g.image[0].isDataTexture,oe=[];for(let K=0;K<6;K++)!Ee&&!J?oe[K]=v(g.image[K],!0,s.maxCubemapSize):oe[K]=J?g.image[K].image:g.image[K],oe[K]=at(g,oe[K]);const we=oe[0],ve=r.convert(g.format,g.colorSpace),re=r.convert(g.type),Te=T(g.internalFormat,ve,re,g.colorSpace),D=g.isVideoTexture!==!0,te=V.__version===void 0||q===!0,se=B.dataReady;let me=C(g,we);Ne(i.TEXTURE_CUBE_MAP,g);let Q;if(Ee){D&&te&&t.texStorage2D(i.TEXTURE_CUBE_MAP,me,Te,we.width,we.height);for(let K=0;K<6;K++){Q=oe[K].mipmaps;for(let ye=0;ye<Q.length;ye++){const Le=Q[ye];g.format!==Gt?ve!==null?D?se&&t.compressedTexSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,ye,0,0,Le.width,Le.height,ve,Le.data):t.compressedTexImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,ye,Te,Le.width,Le.height,0,Le.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):D?se&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,ye,0,0,Le.width,Le.height,ve,re,Le.data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,ye,Te,Le.width,Le.height,0,ve,re,Le.data)}}}else{if(Q=g.mipmaps,D&&te){Q.length>0&&me++;const K=nt(oe[0]);t.texStorage2D(i.TEXTURE_CUBE_MAP,me,Te,K.width,K.height)}for(let K=0;K<6;K++)if(J){D?se&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,0,0,0,oe[K].width,oe[K].height,ve,re,oe[K].data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,0,Te,oe[K].width,oe[K].height,0,ve,re,oe[K].data);for(let ye=0;ye<Q.length;ye++){const tt=Q[ye].image[K].image;D?se&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,ye+1,0,0,tt.width,tt.height,ve,re,tt.data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,ye+1,Te,tt.width,tt.height,0,ve,re,tt.data)}}else{D?se&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,0,0,0,ve,re,oe[K]):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,0,Te,ve,re,oe[K]);for(let ye=0;ye<Q.length;ye++){const Le=Q[ye];D?se&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,ye+1,0,0,ve,re,Le.image[K]):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,ye+1,Te,ve,re,Le.image[K])}}}m(g)&&d(i.TEXTURE_CUBE_MAP),V.__version=B.version,g.onUpdate&&g.onUpdate(g)}y.__version=g.version}function de(y,g,O,q,B,V){const le=r.convert(O.format,O.colorSpace),ne=r.convert(O.type),Me=T(O.internalFormat,le,ne,O.colorSpace),Ee=n.get(g),J=n.get(O);if(J.__renderTarget=g,!Ee.__hasExternalTextures){const oe=Math.max(1,g.width>>V),we=Math.max(1,g.height>>V);B===i.TEXTURE_3D||B===i.TEXTURE_2D_ARRAY?t.texImage3D(B,V,Me,oe,we,g.depth,0,le,ne,null):t.texImage2D(B,V,Me,oe,we,0,le,ne,null)}t.bindFramebuffer(i.FRAMEBUFFER,y),_e(g)?a.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,q,B,J.__webglTexture,0,qe(g)):(B===i.TEXTURE_2D||B>=i.TEXTURE_CUBE_MAP_POSITIVE_X&&B<=i.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&i.framebufferTexture2D(i.FRAMEBUFFER,q,B,J.__webglTexture,V),t.bindFramebuffer(i.FRAMEBUFFER,null)}function he(y,g,O){if(i.bindRenderbuffer(i.RENDERBUFFER,y),g.depthBuffer){const q=g.depthTexture,B=q&&q.isDepthTexture?q.type:null,V=M(g.stencilBuffer,B),le=g.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,ne=qe(g);_e(g)?a.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,ne,V,g.width,g.height):O?i.renderbufferStorageMultisample(i.RENDERBUFFER,ne,V,g.width,g.height):i.renderbufferStorage(i.RENDERBUFFER,V,g.width,g.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,le,i.RENDERBUFFER,y)}else{const q=g.textures;for(let B=0;B<q.length;B++){const V=q[B],le=r.convert(V.format,V.colorSpace),ne=r.convert(V.type),Me=T(V.internalFormat,le,ne,V.colorSpace),Ee=qe(g);O&&_e(g)===!1?i.renderbufferStorageMultisample(i.RENDERBUFFER,Ee,Me,g.width,g.height):_e(g)?a.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,Ee,Me,g.width,g.height):i.renderbufferStorage(i.RENDERBUFFER,Me,g.width,g.height)}}i.bindRenderbuffer(i.RENDERBUFFER,null)}function ge(y,g){if(g&&g.isWebGLCubeRenderTarget)throw new Error("Depth Texture with cube render targets is not supported");if(t.bindFramebuffer(i.FRAMEBUFFER,y),!(g.depthTexture&&g.depthTexture.isDepthTexture))throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");const q=n.get(g.depthTexture);q.__renderTarget=g,(!q.__webglTexture||g.depthTexture.image.width!==g.width||g.depthTexture.image.height!==g.height)&&(g.depthTexture.image.width=g.width,g.depthTexture.image.height=g.height,g.depthTexture.needsUpdate=!0),Y(g.depthTexture,0);const B=q.__webglTexture,V=qe(g);if(g.depthTexture.format===Yi)_e(g)?a.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,i.DEPTH_ATTACHMENT,i.TEXTURE_2D,B,0,V):i.framebufferTexture2D(i.FRAMEBUFFER,i.DEPTH_ATTACHMENT,i.TEXTURE_2D,B,0);else if(g.depthTexture.format===$i)_e(g)?a.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,i.DEPTH_STENCIL_ATTACHMENT,i.TEXTURE_2D,B,0,V):i.framebufferTexture2D(i.FRAMEBUFFER,i.DEPTH_STENCIL_ATTACHMENT,i.TEXTURE_2D,B,0);else throw new Error("Unknown depthTexture format")}function Be(y){const g=n.get(y),O=y.isWebGLCubeRenderTarget===!0;if(g.__boundDepthTexture!==y.depthTexture){const q=y.depthTexture;if(g.__depthDisposeCallback&&g.__depthDisposeCallback(),q){const B=()=>{delete g.__boundDepthTexture,delete g.__depthDisposeCallback,q.removeEventListener("dispose",B)};q.addEventListener("dispose",B),g.__depthDisposeCallback=B}g.__boundDepthTexture=q}if(y.depthTexture&&!g.__autoAllocateDepthBuffer){if(O)throw new Error("target.depthTexture not supported in Cube render targets");const q=y.texture.mipmaps;q&&q.length>0?ge(g.__webglFramebuffer[0],y):ge(g.__webglFramebuffer,y)}else if(O){g.__webglDepthbuffer=[];for(let q=0;q<6;q++)if(t.bindFramebuffer(i.FRAMEBUFFER,g.__webglFramebuffer[q]),g.__webglDepthbuffer[q]===void 0)g.__webglDepthbuffer[q]=i.createRenderbuffer(),he(g.__webglDepthbuffer[q],y,!1);else{const B=y.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,V=g.__webglDepthbuffer[q];i.bindRenderbuffer(i.RENDERBUFFER,V),i.framebufferRenderbuffer(i.FRAMEBUFFER,B,i.RENDERBUFFER,V)}}else{const q=y.texture.mipmaps;if(q&&q.length>0?t.bindFramebuffer(i.FRAMEBUFFER,g.__webglFramebuffer[0]):t.bindFramebuffer(i.FRAMEBUFFER,g.__webglFramebuffer),g.__webglDepthbuffer===void 0)g.__webglDepthbuffer=i.createRenderbuffer(),he(g.__webglDepthbuffer,y,!1);else{const B=y.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,V=g.__webglDepthbuffer;i.bindRenderbuffer(i.RENDERBUFFER,V),i.framebufferRenderbuffer(i.FRAMEBUFFER,B,i.RENDERBUFFER,V)}}t.bindFramebuffer(i.FRAMEBUFFER,null)}function lt(y,g,O){const q=n.get(y);g!==void 0&&de(q.__webglFramebuffer,y,y.texture,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,0),O!==void 0&&Be(y)}function b(y){const g=y.texture,O=n.get(y),q=n.get(g);y.addEventListener("dispose",P);const B=y.textures,V=y.isWebGLCubeRenderTarget===!0,le=B.length>1;if(le||(q.__webglTexture===void 0&&(q.__webglTexture=i.createTexture()),q.__version=g.version,o.memory.textures++),V){O.__webglFramebuffer=[];for(let ne=0;ne<6;ne++)if(g.mipmaps&&g.mipmaps.length>0){O.__webglFramebuffer[ne]=[];for(let Me=0;Me<g.mipmaps.length;Me++)O.__webglFramebuffer[ne][Me]=i.createFramebuffer()}else O.__webglFramebuffer[ne]=i.createFramebuffer()}else{if(g.mipmaps&&g.mipmaps.length>0){O.__webglFramebuffer=[];for(let ne=0;ne<g.mipmaps.length;ne++)O.__webglFramebuffer[ne]=i.createFramebuffer()}else O.__webglFramebuffer=i.createFramebuffer();if(le)for(let ne=0,Me=B.length;ne<Me;ne++){const Ee=n.get(B[ne]);Ee.__webglTexture===void 0&&(Ee.__webglTexture=i.createTexture(),o.memory.textures++)}if(y.samples>0&&_e(y)===!1){O.__webglMultisampledFramebuffer=i.createFramebuffer(),O.__webglColorRenderbuffer=[],t.bindFramebuffer(i.FRAMEBUFFER,O.__webglMultisampledFramebuffer);for(let ne=0;ne<B.length;ne++){const Me=B[ne];O.__webglColorRenderbuffer[ne]=i.createRenderbuffer(),i.bindRenderbuffer(i.RENDERBUFFER,O.__webglColorRenderbuffer[ne]);const Ee=r.convert(Me.format,Me.colorSpace),J=r.convert(Me.type),oe=T(Me.internalFormat,Ee,J,Me.colorSpace,y.isXRRenderTarget===!0),we=qe(y);i.renderbufferStorageMultisample(i.RENDERBUFFER,we,oe,y.width,y.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+ne,i.RENDERBUFFER,O.__webglColorRenderbuffer[ne])}i.bindRenderbuffer(i.RENDERBUFFER,null),y.depthBuffer&&(O.__webglDepthRenderbuffer=i.createRenderbuffer(),he(O.__webglDepthRenderbuffer,y,!0)),t.bindFramebuffer(i.FRAMEBUFFER,null)}}if(V){t.bindTexture(i.TEXTURE_CUBE_MAP,q.__webglTexture),Ne(i.TEXTURE_CUBE_MAP,g);for(let ne=0;ne<6;ne++)if(g.mipmaps&&g.mipmaps.length>0)for(let Me=0;Me<g.mipmaps.length;Me++)de(O.__webglFramebuffer[ne][Me],y,g,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+ne,Me);else de(O.__webglFramebuffer[ne],y,g,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+ne,0);m(g)&&d(i.TEXTURE_CUBE_MAP),t.unbindTexture()}else if(le){for(let ne=0,Me=B.length;ne<Me;ne++){const Ee=B[ne],J=n.get(Ee);let oe=i.TEXTURE_2D;(y.isWebGL3DRenderTarget||y.isWebGLArrayRenderTarget)&&(oe=y.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),t.bindTexture(oe,J.__webglTexture),Ne(oe,Ee),de(O.__webglFramebuffer,y,Ee,i.COLOR_ATTACHMENT0+ne,oe,0),m(Ee)&&d(oe)}t.unbindTexture()}else{let ne=i.TEXTURE_2D;if((y.isWebGL3DRenderTarget||y.isWebGLArrayRenderTarget)&&(ne=y.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),t.bindTexture(ne,q.__webglTexture),Ne(ne,g),g.mipmaps&&g.mipmaps.length>0)for(let Me=0;Me<g.mipmaps.length;Me++)de(O.__webglFramebuffer[Me],y,g,i.COLOR_ATTACHMENT0,ne,Me);else de(O.__webglFramebuffer,y,g,i.COLOR_ATTACHMENT0,ne,0);m(g)&&d(ne),t.unbindTexture()}y.depthBuffer&&Be(y)}function Ze(y){const g=y.textures;for(let O=0,q=g.length;O<q;O++){const B=g[O];if(m(B)){const V=w(y),le=n.get(B).__webglTexture;t.bindTexture(V,le),d(V),t.unbindTexture()}}}const De=[],be=[];function pe(y){if(y.samples>0){if(_e(y)===!1){const g=y.textures,O=y.width,q=y.height;let B=i.COLOR_BUFFER_BIT;const V=y.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,le=n.get(y),ne=g.length>1;if(ne)for(let Ee=0;Ee<g.length;Ee++)t.bindFramebuffer(i.FRAMEBUFFER,le.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+Ee,i.RENDERBUFFER,null),t.bindFramebuffer(i.FRAMEBUFFER,le.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+Ee,i.TEXTURE_2D,null,0);t.bindFramebuffer(i.READ_FRAMEBUFFER,le.__webglMultisampledFramebuffer);const Me=y.texture.mipmaps;Me&&Me.length>0?t.bindFramebuffer(i.DRAW_FRAMEBUFFER,le.__webglFramebuffer[0]):t.bindFramebuffer(i.DRAW_FRAMEBUFFER,le.__webglFramebuffer);for(let Ee=0;Ee<g.length;Ee++){if(y.resolveDepthBuffer&&(y.depthBuffer&&(B|=i.DEPTH_BUFFER_BIT),y.stencilBuffer&&y.resolveStencilBuffer&&(B|=i.STENCIL_BUFFER_BIT)),ne){i.framebufferRenderbuffer(i.READ_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.RENDERBUFFER,le.__webglColorRenderbuffer[Ee]);const J=n.get(g[Ee]).__webglTexture;i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,J,0)}i.blitFramebuffer(0,0,O,q,0,0,O,q,B,i.NEAREST),l===!0&&(De.length=0,be.length=0,De.push(i.COLOR_ATTACHMENT0+Ee),y.depthBuffer&&y.resolveDepthBuffer===!1&&(De.push(V),be.push(V),i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,be)),i.invalidateFramebuffer(i.READ_FRAMEBUFFER,De))}if(t.bindFramebuffer(i.READ_FRAMEBUFFER,null),t.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),ne)for(let Ee=0;Ee<g.length;Ee++){t.bindFramebuffer(i.FRAMEBUFFER,le.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+Ee,i.RENDERBUFFER,le.__webglColorRenderbuffer[Ee]);const J=n.get(g[Ee]).__webglTexture;t.bindFramebuffer(i.FRAMEBUFFER,le.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+Ee,i.TEXTURE_2D,J,0)}t.bindFramebuffer(i.DRAW_FRAMEBUFFER,le.__webglMultisampledFramebuffer)}else if(y.depthBuffer&&y.resolveDepthBuffer===!1&&l){const g=y.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,[g])}}}function qe(y){return Math.min(s.maxSamples,y.samples)}function _e(y){const g=n.get(y);return y.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&g.__useRenderToTexture!==!1}function Ue(y){const g=o.render.frame;h.get(y)!==g&&(h.set(y,g),y.update())}function at(y,g){const O=y.colorSpace,q=y.format,B=y.type;return y.isCompressedTexture===!0||y.isVideoTexture===!0||O!==Jn&&O!==Rn&&(Ve.getTransfer(O)===Je?(q!==Gt||B!==mn)&&console.warn("THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):console.error("THREE.WebGLTextures: Unsupported texture color space:",O)),g}function nt(y){return typeof HTMLImageElement<"u"&&y instanceof HTMLImageElement?(c.width=y.naturalWidth||y.width,c.height=y.naturalHeight||y.height):typeof VideoFrame<"u"&&y instanceof VideoFrame?(c.width=y.displayWidth,c.height=y.displayHeight):(c.width=y.width,c.height=y.height),c}this.allocateTextureUnit=X,this.resetTextureUnits=k,this.setTexture2D=Y,this.setTexture2DArray=G,this.setTexture3D=A,this.setTextureCube=W,this.rebindTextures=lt,this.setupRenderTarget=b,this.updateRenderTargetMipmap=Ze,this.updateMultisampleRenderTarget=pe,this.setupDepthRenderbuffer=Be,this.setupFrameBufferTexture=de,this.useMultisampledRTT=_e}function wm(i,e){function t(n,s=Rn){let r;const o=Ve.getTransfer(s);if(n===mn)return i.UNSIGNED_BYTE;if(n===Ta)return i.UNSIGNED_SHORT_4_4_4_4;if(n===ba)return i.UNSIGNED_SHORT_5_5_5_1;if(n===vl)return i.UNSIGNED_INT_5_9_9_9_REV;if(n===xl)return i.UNSIGNED_INT_10F_11F_11F_REV;if(n===gl)return i.BYTE;if(n===_l)return i.SHORT;if(n===Xi)return i.UNSIGNED_SHORT;if(n===ya)return i.INT;if(n===jn)return i.UNSIGNED_INT;if(n===fn)return i.FLOAT;if(n===ji)return i.HALF_FLOAT;if(n===Ml)return i.ALPHA;if(n===Sl)return i.RGB;if(n===Gt)return i.RGBA;if(n===Yi)return i.DEPTH_COMPONENT;if(n===$i)return i.DEPTH_STENCIL;if(n===El)return i.RED;if(n===wa)return i.RED_INTEGER;if(n===yl)return i.RG;if(n===Aa)return i.RG_INTEGER;if(n===Ra)return i.RGBA_INTEGER;if(n===Cs||n===Ps||n===Ds||n===Ls)if(o===Je)if(r=e.get("WEBGL_compressed_texture_s3tc_srgb"),r!==null){if(n===Cs)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===Ps)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===Ds)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===Ls)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(r=e.get("WEBGL_compressed_texture_s3tc"),r!==null){if(n===Cs)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===Ps)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===Ds)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===Ls)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===Xr||n===qr||n===Yr||n===$r)if(r=e.get("WEBGL_compressed_texture_pvrtc"),r!==null){if(n===Xr)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===qr)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===Yr)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===$r)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===Kr||n===Zr||n===jr)if(r=e.get("WEBGL_compressed_texture_etc"),r!==null){if(n===Kr||n===Zr)return o===Je?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(n===jr)return o===Je?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC}else return null;if(n===Jr||n===Qr||n===ea||n===ta||n===na||n===ia||n===sa||n===ra||n===aa||n===oa||n===la||n===ca||n===ha||n===ua)if(r=e.get("WEBGL_compressed_texture_astc"),r!==null){if(n===Jr)return o===Je?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===Qr)return o===Je?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===ea)return o===Je?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===ta)return o===Je?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===na)return o===Je?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===ia)return o===Je?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===sa)return o===Je?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===ra)return o===Je?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===aa)return o===Je?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===oa)return o===Je?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===la)return o===Je?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===ca)return o===Je?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===ha)return o===Je?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===ua)return o===Je?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===da||n===fa||n===pa)if(r=e.get("EXT_texture_compression_bptc"),r!==null){if(n===da)return o===Je?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===fa)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===pa)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===ma||n===ga||n===_a||n===va)if(r=e.get("EXT_texture_compression_rgtc"),r!==null){if(n===ma)return r.COMPRESSED_RED_RGTC1_EXT;if(n===ga)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===_a)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===va)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===qi?i.UNSIGNED_INT_24_8:i[n]!==void 0?i[n]:null}return{convert:t}}const Am=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,Rm=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`;class Cm{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){const n=new Ol(e.texture);(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=n}}getMesh(e){if(this.texture!==null&&this.mesh===null){const t=e.cameras[0].viewport,n=new Ct({vertexShader:Am,fragmentShader:Rm,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new bt(new Fn(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}}class Pm extends Ai{constructor(e,t){super();const n=this;let s=null,r=1,o=null,a="local-floor",l=1,c=null,h=null,u=null,f=null,p=null,_=null;const v=typeof XRWebGLBinding<"u",m=new Cm,d={},w=t.getContextAttributes();let T=null,M=null;const C=[],R=[],P=new $e;let N=null;const E=new kt;E.viewport=new ct;const S=new kt;S.viewport=new ct;const L=[E,S],k=new Zh;let X=null,Z=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function($){let j=C[$];return j===void 0&&(j=new _r,C[$]=j),j.getTargetRaySpace()},this.getControllerGrip=function($){let j=C[$];return j===void 0&&(j=new _r,C[$]=j),j.getGripSpace()},this.getHand=function($){let j=C[$];return j===void 0&&(j=new _r,C[$]=j),j.getHandSpace()};function Y($){const j=R.indexOf($.inputSource);if(j===-1)return;const de=C[j];de!==void 0&&(de.update($.inputSource,$.frame,c||o),de.dispatchEvent({type:$.type,data:$.inputSource}))}function G(){s.removeEventListener("select",Y),s.removeEventListener("selectstart",Y),s.removeEventListener("selectend",Y),s.removeEventListener("squeeze",Y),s.removeEventListener("squeezestart",Y),s.removeEventListener("squeezeend",Y),s.removeEventListener("end",G),s.removeEventListener("inputsourceschange",A);for(let $=0;$<C.length;$++){const j=R[$];j!==null&&(R[$]=null,C[$].disconnect(j))}X=null,Z=null,m.reset();for(const $ in d)delete d[$];e.setRenderTarget(T),p=null,f=null,u=null,s=null,M=null,Ge.stop(),n.isPresenting=!1,e.setPixelRatio(N),e.setSize(P.width,P.height,!1),n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function($){r=$,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function($){a=$,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||o},this.setReferenceSpace=function($){c=$},this.getBaseLayer=function(){return f!==null?f:p},this.getBinding=function(){return u===null&&v&&(u=new XRWebGLBinding(s,t)),u},this.getFrame=function(){return _},this.getSession=function(){return s},this.setSession=async function($){if(s=$,s!==null){if(T=e.getRenderTarget(),s.addEventListener("select",Y),s.addEventListener("selectstart",Y),s.addEventListener("selectend",Y),s.addEventListener("squeeze",Y),s.addEventListener("squeezestart",Y),s.addEventListener("squeezeend",Y),s.addEventListener("end",G),s.addEventListener("inputsourceschange",A),w.xrCompatible!==!0&&await t.makeXRCompatible(),N=e.getPixelRatio(),e.getSize(P),v&&"createProjectionLayer"in XRWebGLBinding.prototype){let de=null,he=null,ge=null;w.depth&&(ge=w.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,de=w.stencil?$i:Yi,he=w.stencil?qi:jn);const Be={colorFormat:t.RGBA8,depthFormat:ge,scaleFactor:r};u=this.getBinding(),f=u.createProjectionLayer(Be),s.updateRenderState({layers:[f]}),e.setPixelRatio(1),e.setSize(f.textureWidth,f.textureHeight,!1),M=new In(f.textureWidth,f.textureHeight,{format:Gt,type:mn,depthTexture:new Nl(f.textureWidth,f.textureHeight,he,void 0,void 0,void 0,void 0,void 0,void 0,de),stencilBuffer:w.stencil,colorSpace:e.outputColorSpace,samples:w.antialias?4:0,resolveDepthBuffer:f.ignoreDepthValues===!1,resolveStencilBuffer:f.ignoreDepthValues===!1})}else{const de={antialias:w.antialias,alpha:!0,depth:w.depth,stencil:w.stencil,framebufferScaleFactor:r};p=new XRWebGLLayer(s,t,de),s.updateRenderState({baseLayer:p}),e.setPixelRatio(1),e.setSize(p.framebufferWidth,p.framebufferHeight,!1),M=new In(p.framebufferWidth,p.framebufferHeight,{format:Gt,type:mn,colorSpace:e.outputColorSpace,stencilBuffer:w.stencil,resolveDepthBuffer:p.ignoreDepthValues===!1,resolveStencilBuffer:p.ignoreDepthValues===!1})}M.isXRRenderTarget=!0,this.setFoveation(l),c=null,o=await s.requestReferenceSpace(a),Ge.setContext(s),Ge.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(s!==null)return s.environmentBlendMode},this.getDepthTexture=function(){return m.getDepthTexture()};function A($){for(let j=0;j<$.removed.length;j++){const de=$.removed[j],he=R.indexOf(de);he>=0&&(R[he]=null,C[he].disconnect(de))}for(let j=0;j<$.added.length;j++){const de=$.added[j];let he=R.indexOf(de);if(he===-1){for(let Be=0;Be<C.length;Be++)if(Be>=R.length){R.push(de),he=Be;break}else if(R[Be]===null){R[Be]=de,he=Be;break}if(he===-1)break}const ge=C[he];ge&&ge.connect(de)}}const W=new F,ie=new F;function ue($,j,de){W.setFromMatrixPosition(j.matrixWorld),ie.setFromMatrixPosition(de.matrixWorld);const he=W.distanceTo(ie),ge=j.projectionMatrix.elements,Be=de.projectionMatrix.elements,lt=ge[14]/(ge[10]-1),b=ge[14]/(ge[10]+1),Ze=(ge[9]+1)/ge[5],De=(ge[9]-1)/ge[5],be=(ge[8]-1)/ge[0],pe=(Be[8]+1)/Be[0],qe=lt*be,_e=lt*pe,Ue=he/(-be+pe),at=Ue*-be;if(j.matrixWorld.decompose($.position,$.quaternion,$.scale),$.translateX(at),$.translateZ(Ue),$.matrixWorld.compose($.position,$.quaternion,$.scale),$.matrixWorldInverse.copy($.matrixWorld).invert(),ge[10]===-1)$.projectionMatrix.copy(j.projectionMatrix),$.projectionMatrixInverse.copy(j.projectionMatrixInverse);else{const nt=lt+Ue,y=b+Ue,g=qe-at,O=_e+(he-at),q=Ze*b/y*nt,B=De*b/y*nt;$.projectionMatrix.makePerspective(g,O,q,B,nt,y),$.projectionMatrixInverse.copy($.projectionMatrix).invert()}}function xe($,j){j===null?$.matrixWorld.copy($.matrix):$.matrixWorld.multiplyMatrices(j.matrixWorld,$.matrix),$.matrixWorldInverse.copy($.matrixWorld).invert()}this.updateCamera=function($){if(s===null)return;let j=$.near,de=$.far;m.texture!==null&&(m.depthNear>0&&(j=m.depthNear),m.depthFar>0&&(de=m.depthFar)),k.near=S.near=E.near=j,k.far=S.far=E.far=de,(X!==k.near||Z!==k.far)&&(s.updateRenderState({depthNear:k.near,depthFar:k.far}),X=k.near,Z=k.far),k.layers.mask=$.layers.mask|6,E.layers.mask=k.layers.mask&3,S.layers.mask=k.layers.mask&5;const he=$.parent,ge=k.cameras;xe(k,he);for(let Be=0;Be<ge.length;Be++)xe(ge[Be],he);ge.length===2?ue(k,E,S):k.projectionMatrix.copy(E.projectionMatrix),Ne($,k,he)};function Ne($,j,de){de===null?$.matrix.copy(j.matrixWorld):($.matrix.copy(de.matrixWorld),$.matrix.invert(),$.matrix.multiply(j.matrixWorld)),$.matrix.decompose($.position,$.quaternion,$.scale),$.updateMatrixWorld(!0),$.projectionMatrix.copy(j.projectionMatrix),$.projectionMatrixInverse.copy(j.projectionMatrixInverse),$.isPerspectiveCamera&&($.fov=Ki*2*Math.atan(1/$.projectionMatrix.elements[5]),$.zoom=1)}this.getCamera=function(){return k},this.getFoveation=function(){if(!(f===null&&p===null))return l},this.setFoveation=function($){l=$,f!==null&&(f.fixedFoveation=$),p!==null&&p.fixedFoveation!==void 0&&(p.fixedFoveation=$)},this.hasDepthSensing=function(){return m.texture!==null},this.getDepthSensingMesh=function(){return m.getMesh(k)},this.getCameraTexture=function($){return d[$]};let Ke=null;function Qe($,j){if(h=j.getViewerPose(c||o),_=j,h!==null){const de=h.views;p!==null&&(e.setRenderTargetFramebuffer(M,p.framebuffer),e.setRenderTarget(M));let he=!1;de.length!==k.cameras.length&&(k.cameras.length=0,he=!0);for(let b=0;b<de.length;b++){const Ze=de[b];let De=null;if(p!==null)De=p.getViewport(Ze);else{const pe=u.getViewSubImage(f,Ze);De=pe.viewport,b===0&&(e.setRenderTargetTextures(M,pe.colorTexture,pe.depthStencilTexture),e.setRenderTarget(M))}let be=L[b];be===void 0&&(be=new kt,be.layers.enable(b),be.viewport=new ct,L[b]=be),be.matrix.fromArray(Ze.transform.matrix),be.matrix.decompose(be.position,be.quaternion,be.scale),be.projectionMatrix.fromArray(Ze.projectionMatrix),be.projectionMatrixInverse.copy(be.projectionMatrix).invert(),be.viewport.set(De.x,De.y,De.width,De.height),b===0&&(k.matrix.copy(be.matrix),k.matrix.decompose(k.position,k.quaternion,k.scale)),he===!0&&k.cameras.push(be)}const ge=s.enabledFeatures;if(ge&&ge.includes("depth-sensing")&&s.depthUsage=="gpu-optimized"&&v){u=n.getBinding();const b=u.getDepthInformation(de[0]);b&&b.isValid&&b.texture&&m.init(b,s.renderState)}if(ge&&ge.includes("camera-access")&&v){e.state.unbindTexture(),u=n.getBinding();for(let b=0;b<de.length;b++){const Ze=de[b].camera;if(Ze){let De=d[Ze];De||(De=new Ol,d[Ze]=De);const be=u.getCameraImage(Ze);De.sourceTexture=be}}}}for(let de=0;de<C.length;de++){const he=R[de],ge=C[de];he!==null&&ge!==void 0&&ge.update(he,j,c||o)}Ke&&Ke($,j),j.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:j}),_=null}const Ge=new Bl;Ge.setAnimationLoop(Qe),this.setAnimationLoop=function($){Ke=$},this.dispose=function(){}}}const Vn=new gn,Dm=new ut;function Lm(i,e){function t(m,d){m.matrixAutoUpdate===!0&&m.updateMatrix(),d.value.copy(m.matrix)}function n(m,d){d.color.getRGB(m.fogColor.value,Dl(i)),d.isFog?(m.fogNear.value=d.near,m.fogFar.value=d.far):d.isFogExp2&&(m.fogDensity.value=d.density)}function s(m,d,w,T,M){d.isMeshBasicMaterial||d.isMeshLambertMaterial?r(m,d):d.isMeshToonMaterial?(r(m,d),u(m,d)):d.isMeshPhongMaterial?(r(m,d),h(m,d)):d.isMeshStandardMaterial?(r(m,d),f(m,d),d.isMeshPhysicalMaterial&&p(m,d,M)):d.isMeshMatcapMaterial?(r(m,d),_(m,d)):d.isMeshDepthMaterial?r(m,d):d.isMeshDistanceMaterial?(r(m,d),v(m,d)):d.isMeshNormalMaterial?r(m,d):d.isLineBasicMaterial?(o(m,d),d.isLineDashedMaterial&&a(m,d)):d.isPointsMaterial?l(m,d,w,T):d.isSpriteMaterial?c(m,d):d.isShadowMaterial?(m.color.value.copy(d.color),m.opacity.value=d.opacity):d.isShaderMaterial&&(d.uniformsNeedUpdate=!1)}function r(m,d){m.opacity.value=d.opacity,d.color&&m.diffuse.value.copy(d.color),d.emissive&&m.emissive.value.copy(d.emissive).multiplyScalar(d.emissiveIntensity),d.map&&(m.map.value=d.map,t(d.map,m.mapTransform)),d.alphaMap&&(m.alphaMap.value=d.alphaMap,t(d.alphaMap,m.alphaMapTransform)),d.bumpMap&&(m.bumpMap.value=d.bumpMap,t(d.bumpMap,m.bumpMapTransform),m.bumpScale.value=d.bumpScale,d.side===wt&&(m.bumpScale.value*=-1)),d.normalMap&&(m.normalMap.value=d.normalMap,t(d.normalMap,m.normalMapTransform),m.normalScale.value.copy(d.normalScale),d.side===wt&&m.normalScale.value.negate()),d.displacementMap&&(m.displacementMap.value=d.displacementMap,t(d.displacementMap,m.displacementMapTransform),m.displacementScale.value=d.displacementScale,m.displacementBias.value=d.displacementBias),d.emissiveMap&&(m.emissiveMap.value=d.emissiveMap,t(d.emissiveMap,m.emissiveMapTransform)),d.specularMap&&(m.specularMap.value=d.specularMap,t(d.specularMap,m.specularMapTransform)),d.alphaTest>0&&(m.alphaTest.value=d.alphaTest);const w=e.get(d),T=w.envMap,M=w.envMapRotation;T&&(m.envMap.value=T,Vn.copy(M),Vn.x*=-1,Vn.y*=-1,Vn.z*=-1,T.isCubeTexture&&T.isRenderTargetTexture===!1&&(Vn.y*=-1,Vn.z*=-1),m.envMapRotation.value.setFromMatrix4(Dm.makeRotationFromEuler(Vn)),m.flipEnvMap.value=T.isCubeTexture&&T.isRenderTargetTexture===!1?-1:1,m.reflectivity.value=d.reflectivity,m.ior.value=d.ior,m.refractionRatio.value=d.refractionRatio),d.lightMap&&(m.lightMap.value=d.lightMap,m.lightMapIntensity.value=d.lightMapIntensity,t(d.lightMap,m.lightMapTransform)),d.aoMap&&(m.aoMap.value=d.aoMap,m.aoMapIntensity.value=d.aoMapIntensity,t(d.aoMap,m.aoMapTransform))}function o(m,d){m.diffuse.value.copy(d.color),m.opacity.value=d.opacity,d.map&&(m.map.value=d.map,t(d.map,m.mapTransform))}function a(m,d){m.dashSize.value=d.dashSize,m.totalSize.value=d.dashSize+d.gapSize,m.scale.value=d.scale}function l(m,d,w,T){m.diffuse.value.copy(d.color),m.opacity.value=d.opacity,m.size.value=d.size*w,m.scale.value=T*.5,d.map&&(m.map.value=d.map,t(d.map,m.uvTransform)),d.alphaMap&&(m.alphaMap.value=d.alphaMap,t(d.alphaMap,m.alphaMapTransform)),d.alphaTest>0&&(m.alphaTest.value=d.alphaTest)}function c(m,d){m.diffuse.value.copy(d.color),m.opacity.value=d.opacity,m.rotation.value=d.rotation,d.map&&(m.map.value=d.map,t(d.map,m.mapTransform)),d.alphaMap&&(m.alphaMap.value=d.alphaMap,t(d.alphaMap,m.alphaMapTransform)),d.alphaTest>0&&(m.alphaTest.value=d.alphaTest)}function h(m,d){m.specular.value.copy(d.specular),m.shininess.value=Math.max(d.shininess,1e-4)}function u(m,d){d.gradientMap&&(m.gradientMap.value=d.gradientMap)}function f(m,d){m.metalness.value=d.metalness,d.metalnessMap&&(m.metalnessMap.value=d.metalnessMap,t(d.metalnessMap,m.metalnessMapTransform)),m.roughness.value=d.roughness,d.roughnessMap&&(m.roughnessMap.value=d.roughnessMap,t(d.roughnessMap,m.roughnessMapTransform)),d.envMap&&(m.envMapIntensity.value=d.envMapIntensity)}function p(m,d,w){m.ior.value=d.ior,d.sheen>0&&(m.sheenColor.value.copy(d.sheenColor).multiplyScalar(d.sheen),m.sheenRoughness.value=d.sheenRoughness,d.sheenColorMap&&(m.sheenColorMap.value=d.sheenColorMap,t(d.sheenColorMap,m.sheenColorMapTransform)),d.sheenRoughnessMap&&(m.sheenRoughnessMap.value=d.sheenRoughnessMap,t(d.sheenRoughnessMap,m.sheenRoughnessMapTransform))),d.clearcoat>0&&(m.clearcoat.value=d.clearcoat,m.clearcoatRoughness.value=d.clearcoatRoughness,d.clearcoatMap&&(m.clearcoatMap.value=d.clearcoatMap,t(d.clearcoatMap,m.clearcoatMapTransform)),d.clearcoatRoughnessMap&&(m.clearcoatRoughnessMap.value=d.clearcoatRoughnessMap,t(d.clearcoatRoughnessMap,m.clearcoatRoughnessMapTransform)),d.clearcoatNormalMap&&(m.clearcoatNormalMap.value=d.clearcoatNormalMap,t(d.clearcoatNormalMap,m.clearcoatNormalMapTransform),m.clearcoatNormalScale.value.copy(d.clearcoatNormalScale),d.side===wt&&m.clearcoatNormalScale.value.negate())),d.dispersion>0&&(m.dispersion.value=d.dispersion),d.iridescence>0&&(m.iridescence.value=d.iridescence,m.iridescenceIOR.value=d.iridescenceIOR,m.iridescenceThicknessMinimum.value=d.iridescenceThicknessRange[0],m.iridescenceThicknessMaximum.value=d.iridescenceThicknessRange[1],d.iridescenceMap&&(m.iridescenceMap.value=d.iridescenceMap,t(d.iridescenceMap,m.iridescenceMapTransform)),d.iridescenceThicknessMap&&(m.iridescenceThicknessMap.value=d.iridescenceThicknessMap,t(d.iridescenceThicknessMap,m.iridescenceThicknessMapTransform))),d.transmission>0&&(m.transmission.value=d.transmission,m.transmissionSamplerMap.value=w.texture,m.transmissionSamplerSize.value.set(w.width,w.height),d.transmissionMap&&(m.transmissionMap.value=d.transmissionMap,t(d.transmissionMap,m.transmissionMapTransform)),m.thickness.value=d.thickness,d.thicknessMap&&(m.thicknessMap.value=d.thicknessMap,t(d.thicknessMap,m.thicknessMapTransform)),m.attenuationDistance.value=d.attenuationDistance,m.attenuationColor.value.copy(d.attenuationColor)),d.anisotropy>0&&(m.anisotropyVector.value.set(d.anisotropy*Math.cos(d.anisotropyRotation),d.anisotropy*Math.sin(d.anisotropyRotation)),d.anisotropyMap&&(m.anisotropyMap.value=d.anisotropyMap,t(d.anisotropyMap,m.anisotropyMapTransform))),m.specularIntensity.value=d.specularIntensity,m.specularColor.value.copy(d.specularColor),d.specularColorMap&&(m.specularColorMap.value=d.specularColorMap,t(d.specularColorMap,m.specularColorMapTransform)),d.specularIntensityMap&&(m.specularIntensityMap.value=d.specularIntensityMap,t(d.specularIntensityMap,m.specularIntensityMapTransform))}function _(m,d){d.matcap&&(m.matcap.value=d.matcap)}function v(m,d){const w=e.get(d).light;m.referencePosition.value.setFromMatrixPosition(w.matrixWorld),m.nearDistance.value=w.shadow.camera.near,m.farDistance.value=w.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:s}}function Um(i,e,t,n){let s={},r={},o=[];const a=i.getParameter(i.MAX_UNIFORM_BUFFER_BINDINGS);function l(w,T){const M=T.program;n.uniformBlockBinding(w,M)}function c(w,T){let M=s[w.id];M===void 0&&(_(w),M=h(w),s[w.id]=M,w.addEventListener("dispose",m));const C=T.program;n.updateUBOMapping(w,C);const R=e.render.frame;r[w.id]!==R&&(f(w),r[w.id]=R)}function h(w){const T=u();w.__bindingPointIndex=T;const M=i.createBuffer(),C=w.__size,R=w.usage;return i.bindBuffer(i.UNIFORM_BUFFER,M),i.bufferData(i.UNIFORM_BUFFER,C,R),i.bindBuffer(i.UNIFORM_BUFFER,null),i.bindBufferBase(i.UNIFORM_BUFFER,T,M),M}function u(){for(let w=0;w<a;w++)if(o.indexOf(w)===-1)return o.push(w),w;return console.error("THREE.WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function f(w){const T=s[w.id],M=w.uniforms,C=w.__cache;i.bindBuffer(i.UNIFORM_BUFFER,T);for(let R=0,P=M.length;R<P;R++){const N=Array.isArray(M[R])?M[R]:[M[R]];for(let E=0,S=N.length;E<S;E++){const L=N[E];if(p(L,R,E,C)===!0){const k=L.__offset,X=Array.isArray(L.value)?L.value:[L.value];let Z=0;for(let Y=0;Y<X.length;Y++){const G=X[Y],A=v(G);typeof G=="number"||typeof G=="boolean"?(L.__data[0]=G,i.bufferSubData(i.UNIFORM_BUFFER,k+Z,L.__data)):G.isMatrix3?(L.__data[0]=G.elements[0],L.__data[1]=G.elements[1],L.__data[2]=G.elements[2],L.__data[3]=0,L.__data[4]=G.elements[3],L.__data[5]=G.elements[4],L.__data[6]=G.elements[5],L.__data[7]=0,L.__data[8]=G.elements[6],L.__data[9]=G.elements[7],L.__data[10]=G.elements[8],L.__data[11]=0):(G.toArray(L.__data,Z),Z+=A.storage/Float32Array.BYTES_PER_ELEMENT)}i.bufferSubData(i.UNIFORM_BUFFER,k,L.__data)}}}i.bindBuffer(i.UNIFORM_BUFFER,null)}function p(w,T,M,C){const R=w.value,P=T+"_"+M;if(C[P]===void 0)return typeof R=="number"||typeof R=="boolean"?C[P]=R:C[P]=R.clone(),!0;{const N=C[P];if(typeof R=="number"||typeof R=="boolean"){if(N!==R)return C[P]=R,!0}else if(N.equals(R)===!1)return N.copy(R),!0}return!1}function _(w){const T=w.uniforms;let M=0;const C=16;for(let P=0,N=T.length;P<N;P++){const E=Array.isArray(T[P])?T[P]:[T[P]];for(let S=0,L=E.length;S<L;S++){const k=E[S],X=Array.isArray(k.value)?k.value:[k.value];for(let Z=0,Y=X.length;Z<Y;Z++){const G=X[Z],A=v(G),W=M%C,ie=W%A.boundary,ue=W+ie;M+=ie,ue!==0&&C-ue<A.storage&&(M+=C-ue),k.__data=new Float32Array(A.storage/Float32Array.BYTES_PER_ELEMENT),k.__offset=M,M+=A.storage}}}const R=M%C;return R>0&&(M+=C-R),w.__size=M,w.__cache={},this}function v(w){const T={boundary:0,storage:0};return typeof w=="number"||typeof w=="boolean"?(T.boundary=4,T.storage=4):w.isVector2?(T.boundary=8,T.storage=8):w.isVector3||w.isColor?(T.boundary=16,T.storage=12):w.isVector4?(T.boundary=16,T.storage=16):w.isMatrix3?(T.boundary=48,T.storage=48):w.isMatrix4?(T.boundary=64,T.storage=64):w.isTexture?console.warn("THREE.WebGLRenderer: Texture samplers can not be part of an uniforms group."):console.warn("THREE.WebGLRenderer: Unsupported uniform value type.",w),T}function m(w){const T=w.target;T.removeEventListener("dispose",m);const M=o.indexOf(T.__bindingPointIndex);o.splice(M,1),i.deleteBuffer(s[T.id]),delete s[T.id],delete r[T.id]}function d(){for(const w in s)i.deleteBuffer(s[w]);o=[],s={},r={}}return{bind:l,update:c,dispose:d}}class Im{constructor(e={}){const{canvas:t=fh(),context:n=null,depth:s=!0,stencil:r=!1,alpha:o=!1,antialias:a=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:u=!1,reversedDepthBuffer:f=!1}=e;this.isWebGLRenderer=!0;let p;if(n!==null){if(typeof WebGLRenderingContext<"u"&&n instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");p=n.getContextAttributes().alpha}else p=o;const _=new Uint32Array(4),v=new Int32Array(4);let m=null,d=null;const w=[],T=[];this.domElement=t,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=Ln,this.toneMappingExposure=1,this.transmissionResolutionScale=1;const M=this;let C=!1;this._outputColorSpace=zt;let R=0,P=0,N=null,E=-1,S=null;const L=new ct,k=new ct;let X=null;const Z=new ze(0);let Y=0,G=t.width,A=t.height,W=1,ie=null,ue=null;const xe=new ct(0,0,G,A),Ne=new ct(0,0,G,A);let Ke=!1;const Qe=new Il;let Ge=!1,$=!1;const j=new ut,de=new F,he=new ct,ge={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};let Be=!1;function lt(){return N===null?W:1}let b=n;function Ze(x,U){return t.getContext(x,U)}try{const x={alpha:!0,depth:s,stencil:r,antialias:a,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:h,failIfMajorPerformanceCaveat:u};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${Ea}`),t.addEventListener("webglcontextlost",se,!1),t.addEventListener("webglcontextrestored",me,!1),t.addEventListener("webglcontextcreationerror",Q,!1),b===null){const U="webgl2";if(b=Ze(U,x),b===null)throw Ze(U)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}}catch(x){throw console.error("THREE.WebGLRenderer: "+x.message),x}let De,be,pe,qe,_e,Ue,at,nt,y,g,O,q,B,V,le,ne,Me,Ee,J,oe,we,ve,re,Te;function D(){De=new Wf(b),De.init(),ve=new wm(b,De),be=new Of(b,De,e,ve),pe=new Tm(b,De),be.reversedDepthBuffer&&f&&pe.buffers.depth.setReversed(!0),qe=new Yf(b),_e=new um,Ue=new bm(b,De,pe,_e,be,ve,qe),at=new zf(M),nt=new Vf(M),y=new Jh(b),re=new Ff(b,y),g=new Xf(b,y,qe,re),O=new Kf(b,g,y,qe),J=new $f(b,be,Ue),ne=new Bf(_e),q=new hm(M,at,nt,De,be,re,ne),B=new Lm(M,_e),V=new fm,le=new xm(De),Ee=new If(M,at,nt,pe,O,p,l),Me=new Em(M,O,be),Te=new Um(b,qe,be,pe),oe=new Nf(b,De,qe),we=new qf(b,De,qe),qe.programs=q.programs,M.capabilities=be,M.extensions=De,M.properties=_e,M.renderLists=V,M.shadowMap=Me,M.state=pe,M.info=qe}D();const te=new Pm(M,b);this.xr=te,this.getContext=function(){return b},this.getContextAttributes=function(){return b.getContextAttributes()},this.forceContextLoss=function(){const x=De.get("WEBGL_lose_context");x&&x.loseContext()},this.forceContextRestore=function(){const x=De.get("WEBGL_lose_context");x&&x.restoreContext()},this.getPixelRatio=function(){return W},this.setPixelRatio=function(x){x!==void 0&&(W=x,this.setSize(G,A,!1))},this.getSize=function(x){return x.set(G,A)},this.setSize=function(x,U,z=!0){if(te.isPresenting){console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting.");return}G=x,A=U,t.width=Math.floor(x*W),t.height=Math.floor(U*W),z===!0&&(t.style.width=x+"px",t.style.height=U+"px"),this.setViewport(0,0,x,U)},this.getDrawingBufferSize=function(x){return x.set(G*W,A*W).floor()},this.setDrawingBufferSize=function(x,U,z){G=x,A=U,W=z,t.width=Math.floor(x*z),t.height=Math.floor(U*z),this.setViewport(0,0,x,U)},this.getCurrentViewport=function(x){return x.copy(L)},this.getViewport=function(x){return x.copy(xe)},this.setViewport=function(x,U,z,H){x.isVector4?xe.set(x.x,x.y,x.z,x.w):xe.set(x,U,z,H),pe.viewport(L.copy(xe).multiplyScalar(W).round())},this.getScissor=function(x){return x.copy(Ne)},this.setScissor=function(x,U,z,H){x.isVector4?Ne.set(x.x,x.y,x.z,x.w):Ne.set(x,U,z,H),pe.scissor(k.copy(Ne).multiplyScalar(W).round())},this.getScissorTest=function(){return Ke},this.setScissorTest=function(x){pe.setScissorTest(Ke=x)},this.setOpaqueSort=function(x){ie=x},this.setTransparentSort=function(x){ue=x},this.getClearColor=function(x){return x.copy(Ee.getClearColor())},this.setClearColor=function(){Ee.setClearColor(...arguments)},this.getClearAlpha=function(){return Ee.getClearAlpha()},this.setClearAlpha=function(){Ee.setClearAlpha(...arguments)},this.clear=function(x=!0,U=!0,z=!0){let H=0;if(x){let I=!1;if(N!==null){const ee=N.texture.format;I=ee===Ra||ee===Aa||ee===wa}if(I){const ee=N.texture.type,ce=ee===mn||ee===jn||ee===Xi||ee===qi||ee===Ta||ee===ba,Se=Ee.getClearColor(),fe=Ee.getClearAlpha(),Ce=Se.r,Pe=Se.g,Ae=Se.b;ce?(_[0]=Ce,_[1]=Pe,_[2]=Ae,_[3]=fe,b.clearBufferuiv(b.COLOR,0,_)):(v[0]=Ce,v[1]=Pe,v[2]=Ae,v[3]=fe,b.clearBufferiv(b.COLOR,0,v))}else H|=b.COLOR_BUFFER_BIT}U&&(H|=b.DEPTH_BUFFER_BIT),z&&(H|=b.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),b.clear(H)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){t.removeEventListener("webglcontextlost",se,!1),t.removeEventListener("webglcontextrestored",me,!1),t.removeEventListener("webglcontextcreationerror",Q,!1),Ee.dispose(),V.dispose(),le.dispose(),_e.dispose(),at.dispose(),nt.dispose(),O.dispose(),re.dispose(),Te.dispose(),q.dispose(),te.dispose(),te.removeEventListener("sessionstart",Jt),te.removeEventListener("sessionend",Ha),Nn.stop()};function se(x){x.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),C=!0}function me(){console.log("THREE.WebGLRenderer: Context Restored."),C=!1;const x=qe.autoReset,U=Me.enabled,z=Me.autoUpdate,H=Me.needsUpdate,I=Me.type;D(),qe.autoReset=x,Me.enabled=U,Me.autoUpdate=z,Me.needsUpdate=H,Me.type=I}function Q(x){console.error("THREE.WebGLRenderer: A WebGL context could not be created. Reason: ",x.statusMessage)}function K(x){const U=x.target;U.removeEventListener("dispose",K),ye(U)}function ye(x){Le(x),_e.remove(x)}function Le(x){const U=_e.get(x).programs;U!==void 0&&(U.forEach(function(z){q.releaseProgram(z)}),x.isShaderMaterial&&q.releaseShaderCache(x))}this.renderBufferDirect=function(x,U,z,H,I,ee){U===null&&(U=ge);const ce=I.isMesh&&I.matrixWorld.determinant()<0,Se=tc(x,U,z,H,I);pe.setMaterial(H,ce);let fe=z.index,Ce=1;if(H.wireframe===!0){if(fe=g.getWireframeAttribute(z),fe===void 0)return;Ce=2}const Pe=z.drawRange,Ae=z.attributes.position;let ke=Pe.start*Ce,je=(Pe.start+Pe.count)*Ce;ee!==null&&(ke=Math.max(ke,ee.start*Ce),je=Math.min(je,(ee.start+ee.count)*Ce)),fe!==null?(ke=Math.max(ke,0),je=Math.min(je,fe.count)):Ae!=null&&(ke=Math.max(ke,0),je=Math.min(je,Ae.count));const ot=je-ke;if(ot<0||ot===1/0)return;re.setup(I,H,Se,z,fe);let it,et=oe;if(fe!==null&&(it=y.get(fe),et=we,et.setIndex(it)),I.isMesh)H.wireframe===!0?(pe.setLineWidth(H.wireframeLinewidth*lt()),et.setMode(b.LINES)):et.setMode(b.TRIANGLES);else if(I.isLine){let Re=H.linewidth;Re===void 0&&(Re=1),pe.setLineWidth(Re*lt()),I.isLineSegments?et.setMode(b.LINES):I.isLineLoop?et.setMode(b.LINE_LOOP):et.setMode(b.LINE_STRIP)}else I.isPoints?et.setMode(b.POINTS):I.isSprite&&et.setMode(b.TRIANGLES);if(I.isBatchedMesh)if(I._multiDrawInstances!==null)Zi("THREE.WebGLRenderer: renderMultiDrawInstances has been deprecated and will be removed in r184. Append to renderMultiDraw arguments and use indirection."),et.renderMultiDrawInstances(I._multiDrawStarts,I._multiDrawCounts,I._multiDrawCount,I._multiDrawInstances);else if(De.get("WEBGL_multi_draw"))et.renderMultiDraw(I._multiDrawStarts,I._multiDrawCounts,I._multiDrawCount);else{const Re=I._multiDrawStarts,st=I._multiDrawCounts,We=I._multiDrawCount,Pt=fe?y.get(fe).bytesPerElement:1,Qn=_e.get(H).currentProgram.getUniforms();for(let Dt=0;Dt<We;Dt++)Qn.setValue(b,"_gl_DrawID",Dt),et.render(Re[Dt]/Pt,st[Dt])}else if(I.isInstancedMesh)et.renderInstances(ke,ot,I.count);else if(z.isInstancedBufferGeometry){const Re=z._maxInstanceCount!==void 0?z._maxInstanceCount:1/0,st=Math.min(z.instanceCount,Re);et.renderInstances(ke,ot,st)}else et.render(ke,ot)};function tt(x,U,z){x.transparent===!0&&x.side===Ht&&x.forceSinglePass===!1?(x.side=wt,x.needsUpdate=!0,ns(x,U,z),x.side=Un,x.needsUpdate=!0,ns(x,U,z),x.side=Ht):ns(x,U,z)}this.compile=function(x,U,z=null){z===null&&(z=x),d=le.get(z),d.init(U),T.push(d),z.traverseVisible(function(I){I.isLight&&I.layers.test(U.layers)&&(d.pushLight(I),I.castShadow&&d.pushShadow(I))}),x!==z&&x.traverseVisible(function(I){I.isLight&&I.layers.test(U.layers)&&(d.pushLight(I),I.castShadow&&d.pushShadow(I))}),d.setupLights();const H=new Set;return x.traverse(function(I){if(!(I.isMesh||I.isPoints||I.isLine||I.isSprite))return;const ee=I.material;if(ee)if(Array.isArray(ee))for(let ce=0;ce<ee.length;ce++){const Se=ee[ce];tt(Se,z,I),H.add(Se)}else tt(ee,z,I),H.add(ee)}),d=T.pop(),H},this.compileAsync=function(x,U,z=null){const H=this.compile(x,U,z);return new Promise(I=>{function ee(){if(H.forEach(function(ce){_e.get(ce).currentProgram.isReady()&&H.delete(ce)}),H.size===0){I(x);return}setTimeout(ee,10)}De.get("KHR_parallel_shader_compile")!==null?ee():setTimeout(ee,10)})};let Ye=null;function an(x){Ye&&Ye(x)}function Jt(){Nn.stop()}function Ha(){Nn.start()}const Nn=new Bl;Nn.setAnimationLoop(an),typeof self<"u"&&Nn.setContext(self),this.setAnimationLoop=function(x){Ye=x,te.setAnimationLoop(x),x===null?Nn.stop():Nn.start()},te.addEventListener("sessionstart",Jt),te.addEventListener("sessionend",Ha),this.render=function(x,U){if(U!==void 0&&U.isCamera!==!0){console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(C===!0)return;if(x.matrixWorldAutoUpdate===!0&&x.updateMatrixWorld(),U.parent===null&&U.matrixWorldAutoUpdate===!0&&U.updateMatrixWorld(),te.enabled===!0&&te.isPresenting===!0&&(te.cameraAutoUpdate===!0&&te.updateCamera(U),U=te.getCamera()),x.isScene===!0&&x.onBeforeRender(M,x,U,N),d=le.get(x,T.length),d.init(U),T.push(d),j.multiplyMatrices(U.projectionMatrix,U.matrixWorldInverse),Qe.setFromProjectionMatrix(j,nn,U.reversedDepth),$=this.localClippingEnabled,Ge=ne.init(this.clippingPlanes,$),m=V.get(x,w.length),m.init(),w.push(m),te.enabled===!0&&te.isPresenting===!0){const ee=M.xr.getDepthSensingMesh();ee!==null&&$s(ee,U,-1/0,M.sortObjects)}$s(x,U,0,M.sortObjects),m.finish(),M.sortObjects===!0&&m.sort(ie,ue),Be=te.enabled===!1||te.isPresenting===!1||te.hasDepthSensing()===!1,Be&&Ee.addToRenderList(m,x),this.info.render.frame++,Ge===!0&&ne.beginShadows();const z=d.state.shadowsArray;Me.render(z,x,U),Ge===!0&&ne.endShadows(),this.info.autoReset===!0&&this.info.reset();const H=m.opaque,I=m.transmissive;if(d.setupLights(),U.isArrayCamera){const ee=U.cameras;if(I.length>0)for(let ce=0,Se=ee.length;ce<Se;ce++){const fe=ee[ce];Va(H,I,x,fe)}Be&&Ee.render(x);for(let ce=0,Se=ee.length;ce<Se;ce++){const fe=ee[ce];Ga(m,x,fe,fe.viewport)}}else I.length>0&&Va(H,I,x,U),Be&&Ee.render(x),Ga(m,x,U);N!==null&&P===0&&(Ue.updateMultisampleRenderTarget(N),Ue.updateRenderTargetMipmap(N)),x.isScene===!0&&x.onAfterRender(M,x,U),re.resetDefaultState(),E=-1,S=null,T.pop(),T.length>0?(d=T[T.length-1],Ge===!0&&ne.setGlobalState(M.clippingPlanes,d.state.camera)):d=null,w.pop(),w.length>0?m=w[w.length-1]:m=null};function $s(x,U,z,H){if(x.visible===!1)return;if(x.layers.test(U.layers)){if(x.isGroup)z=x.renderOrder;else if(x.isLOD)x.autoUpdate===!0&&x.update(U);else if(x.isLight)d.pushLight(x),x.castShadow&&d.pushShadow(x);else if(x.isSprite){if(!x.frustumCulled||Qe.intersectsSprite(x)){H&&he.setFromMatrixPosition(x.matrixWorld).applyMatrix4(j);const ce=O.update(x),Se=x.material;Se.visible&&m.push(x,ce,Se,z,he.z,null)}}else if((x.isMesh||x.isLine||x.isPoints)&&(!x.frustumCulled||Qe.intersectsObject(x))){const ce=O.update(x),Se=x.material;if(H&&(x.boundingSphere!==void 0?(x.boundingSphere===null&&x.computeBoundingSphere(),he.copy(x.boundingSphere.center)):(ce.boundingSphere===null&&ce.computeBoundingSphere(),he.copy(ce.boundingSphere.center)),he.applyMatrix4(x.matrixWorld).applyMatrix4(j)),Array.isArray(Se)){const fe=ce.groups;for(let Ce=0,Pe=fe.length;Ce<Pe;Ce++){const Ae=fe[Ce],ke=Se[Ae.materialIndex];ke&&ke.visible&&m.push(x,ce,ke,z,he.z,Ae)}}else Se.visible&&m.push(x,ce,Se,z,he.z,null)}}const ee=x.children;for(let ce=0,Se=ee.length;ce<Se;ce++)$s(ee[ce],U,z,H)}function Ga(x,U,z,H){const I=x.opaque,ee=x.transmissive,ce=x.transparent;d.setupLightsView(z),Ge===!0&&ne.setGlobalState(M.clippingPlanes,z),H&&pe.viewport(L.copy(H)),I.length>0&&ts(I,U,z),ee.length>0&&ts(ee,U,z),ce.length>0&&ts(ce,U,z),pe.buffers.depth.setTest(!0),pe.buffers.depth.setMask(!0),pe.buffers.color.setMask(!0),pe.setPolygonOffset(!1)}function Va(x,U,z,H){if((z.isScene===!0?z.overrideMaterial:null)!==null)return;d.state.transmissionRenderTarget[H.id]===void 0&&(d.state.transmissionRenderTarget[H.id]=new In(1,1,{generateMipmaps:!0,type:De.has("EXT_color_buffer_half_float")||De.has("EXT_color_buffer_float")?ji:mn,minFilter:Kn,samples:4,stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:Ve.workingColorSpace}));const ee=d.state.transmissionRenderTarget[H.id],ce=H.viewport||L;ee.setSize(ce.z*M.transmissionResolutionScale,ce.w*M.transmissionResolutionScale);const Se=M.getRenderTarget(),fe=M.getActiveCubeFace(),Ce=M.getActiveMipmapLevel();M.setRenderTarget(ee),M.getClearColor(Z),Y=M.getClearAlpha(),Y<1&&M.setClearColor(16777215,.5),M.clear(),Be&&Ee.render(z);const Pe=M.toneMapping;M.toneMapping=Ln;const Ae=H.viewport;if(H.viewport!==void 0&&(H.viewport=void 0),d.setupLightsView(H),Ge===!0&&ne.setGlobalState(M.clippingPlanes,H),ts(x,z,H),Ue.updateMultisampleRenderTarget(ee),Ue.updateRenderTargetMipmap(ee),De.has("WEBGL_multisampled_render_to_texture")===!1){let ke=!1;for(let je=0,ot=U.length;je<ot;je++){const it=U[je],et=it.object,Re=it.geometry,st=it.material,We=it.group;if(st.side===Ht&&et.layers.test(H.layers)){const Pt=st.side;st.side=wt,st.needsUpdate=!0,Wa(et,z,H,Re,st,We),st.side=Pt,st.needsUpdate=!0,ke=!0}}ke===!0&&(Ue.updateMultisampleRenderTarget(ee),Ue.updateRenderTargetMipmap(ee))}M.setRenderTarget(Se,fe,Ce),M.setClearColor(Z,Y),Ae!==void 0&&(H.viewport=Ae),M.toneMapping=Pe}function ts(x,U,z){const H=U.isScene===!0?U.overrideMaterial:null;for(let I=0,ee=x.length;I<ee;I++){const ce=x[I],Se=ce.object,fe=ce.geometry,Ce=ce.group;let Pe=ce.material;Pe.allowOverride===!0&&H!==null&&(Pe=H),Se.layers.test(z.layers)&&Wa(Se,U,z,fe,Pe,Ce)}}function Wa(x,U,z,H,I,ee){x.onBeforeRender(M,U,z,H,I,ee),x.modelViewMatrix.multiplyMatrices(z.matrixWorldInverse,x.matrixWorld),x.normalMatrix.getNormalMatrix(x.modelViewMatrix),I.onBeforeRender(M,U,z,H,x,ee),I.transparent===!0&&I.side===Ht&&I.forceSinglePass===!1?(I.side=wt,I.needsUpdate=!0,M.renderBufferDirect(z,U,H,I,x,ee),I.side=Un,I.needsUpdate=!0,M.renderBufferDirect(z,U,H,I,x,ee),I.side=Ht):M.renderBufferDirect(z,U,H,I,x,ee),x.onAfterRender(M,U,z,H,I,ee)}function ns(x,U,z){U.isScene!==!0&&(U=ge);const H=_e.get(x),I=d.state.lights,ee=d.state.shadowsArray,ce=I.state.version,Se=q.getParameters(x,I.state,ee,U,z),fe=q.getProgramCacheKey(Se);let Ce=H.programs;H.environment=x.isMeshStandardMaterial?U.environment:null,H.fog=U.fog,H.envMap=(x.isMeshStandardMaterial?nt:at).get(x.envMap||H.environment),H.envMapRotation=H.environment!==null&&x.envMap===null?U.environmentRotation:x.envMapRotation,Ce===void 0&&(x.addEventListener("dispose",K),Ce=new Map,H.programs=Ce);let Pe=Ce.get(fe);if(Pe!==void 0){if(H.currentProgram===Pe&&H.lightsStateVersion===ce)return qa(x,Se),Pe}else Se.uniforms=q.getUniforms(x),x.onBeforeCompile(Se,M),Pe=q.acquireProgram(Se,fe),Ce.set(fe,Pe),H.uniforms=Se.uniforms;const Ae=H.uniforms;return(!x.isShaderMaterial&&!x.isRawShaderMaterial||x.clipping===!0)&&(Ae.clippingPlanes=ne.uniform),qa(x,Se),H.needsLights=ic(x),H.lightsStateVersion=ce,H.needsLights&&(Ae.ambientLightColor.value=I.state.ambient,Ae.lightProbe.value=I.state.probe,Ae.directionalLights.value=I.state.directional,Ae.directionalLightShadows.value=I.state.directionalShadow,Ae.spotLights.value=I.state.spot,Ae.spotLightShadows.value=I.state.spotShadow,Ae.rectAreaLights.value=I.state.rectArea,Ae.ltc_1.value=I.state.rectAreaLTC1,Ae.ltc_2.value=I.state.rectAreaLTC2,Ae.pointLights.value=I.state.point,Ae.pointLightShadows.value=I.state.pointShadow,Ae.hemisphereLights.value=I.state.hemi,Ae.directionalShadowMap.value=I.state.directionalShadowMap,Ae.directionalShadowMatrix.value=I.state.directionalShadowMatrix,Ae.spotShadowMap.value=I.state.spotShadowMap,Ae.spotLightMatrix.value=I.state.spotLightMatrix,Ae.spotLightMap.value=I.state.spotLightMap,Ae.pointShadowMap.value=I.state.pointShadowMap,Ae.pointShadowMatrix.value=I.state.pointShadowMatrix),H.currentProgram=Pe,H.uniformsList=null,Pe}function Xa(x){if(x.uniformsList===null){const U=x.currentProgram.getUniforms();x.uniformsList=Us.seqWithValue(U.seq,x.uniforms)}return x.uniformsList}function qa(x,U){const z=_e.get(x);z.outputColorSpace=U.outputColorSpace,z.batching=U.batching,z.batchingColor=U.batchingColor,z.instancing=U.instancing,z.instancingColor=U.instancingColor,z.instancingMorph=U.instancingMorph,z.skinning=U.skinning,z.morphTargets=U.morphTargets,z.morphNormals=U.morphNormals,z.morphColors=U.morphColors,z.morphTargetsCount=U.morphTargetsCount,z.numClippingPlanes=U.numClippingPlanes,z.numIntersection=U.numClipIntersection,z.vertexAlphas=U.vertexAlphas,z.vertexTangents=U.vertexTangents,z.toneMapping=U.toneMapping}function tc(x,U,z,H,I){U.isScene!==!0&&(U=ge),Ue.resetTextureUnits();const ee=U.fog,ce=H.isMeshStandardMaterial?U.environment:null,Se=N===null?M.outputColorSpace:N.isXRRenderTarget===!0?N.texture.colorSpace:Jn,fe=(H.isMeshStandardMaterial?nt:at).get(H.envMap||ce),Ce=H.vertexColors===!0&&!!z.attributes.color&&z.attributes.color.itemSize===4,Pe=!!z.attributes.tangent&&(!!H.normalMap||H.anisotropy>0),Ae=!!z.morphAttributes.position,ke=!!z.morphAttributes.normal,je=!!z.morphAttributes.color;let ot=Ln;H.toneMapped&&(N===null||N.isXRRenderTarget===!0)&&(ot=M.toneMapping);const it=z.morphAttributes.position||z.morphAttributes.normal||z.morphAttributes.color,et=it!==void 0?it.length:0,Re=_e.get(H),st=d.state.lights;if(Ge===!0&&($===!0||x!==S)){const St=x===S&&H.id===E;ne.setState(H,x,St)}let We=!1;H.version===Re.__version?(Re.needsLights&&Re.lightsStateVersion!==st.state.version||Re.outputColorSpace!==Se||I.isBatchedMesh&&Re.batching===!1||!I.isBatchedMesh&&Re.batching===!0||I.isBatchedMesh&&Re.batchingColor===!0&&I.colorTexture===null||I.isBatchedMesh&&Re.batchingColor===!1&&I.colorTexture!==null||I.isInstancedMesh&&Re.instancing===!1||!I.isInstancedMesh&&Re.instancing===!0||I.isSkinnedMesh&&Re.skinning===!1||!I.isSkinnedMesh&&Re.skinning===!0||I.isInstancedMesh&&Re.instancingColor===!0&&I.instanceColor===null||I.isInstancedMesh&&Re.instancingColor===!1&&I.instanceColor!==null||I.isInstancedMesh&&Re.instancingMorph===!0&&I.morphTexture===null||I.isInstancedMesh&&Re.instancingMorph===!1&&I.morphTexture!==null||Re.envMap!==fe||H.fog===!0&&Re.fog!==ee||Re.numClippingPlanes!==void 0&&(Re.numClippingPlanes!==ne.numPlanes||Re.numIntersection!==ne.numIntersection)||Re.vertexAlphas!==Ce||Re.vertexTangents!==Pe||Re.morphTargets!==Ae||Re.morphNormals!==ke||Re.morphColors!==je||Re.toneMapping!==ot||Re.morphTargetsCount!==et)&&(We=!0):(We=!0,Re.__version=H.version);let Pt=Re.currentProgram;We===!0&&(Pt=ns(H,U,I));let Qn=!1,Dt=!1,Li=!1;const rt=Pt.getUniforms(),Ft=Re.uniforms;if(pe.useProgram(Pt.program)&&(Qn=!0,Dt=!0,Li=!0),H.id!==E&&(E=H.id,Dt=!0),Qn||S!==x){pe.buffers.depth.getReversed()&&x.reversedDepth!==!0&&(x._reversedDepth=!0,x.updateProjectionMatrix()),rt.setValue(b,"projectionMatrix",x.projectionMatrix),rt.setValue(b,"viewMatrix",x.matrixWorldInverse);const Rt=rt.map.cameraPosition;Rt!==void 0&&Rt.setValue(b,de.setFromMatrixPosition(x.matrixWorld)),be.logarithmicDepthBuffer&&rt.setValue(b,"logDepthBufFC",2/(Math.log(x.far+1)/Math.LN2)),(H.isMeshPhongMaterial||H.isMeshToonMaterial||H.isMeshLambertMaterial||H.isMeshBasicMaterial||H.isMeshStandardMaterial||H.isShaderMaterial)&&rt.setValue(b,"isOrthographic",x.isOrthographicCamera===!0),S!==x&&(S=x,Dt=!0,Li=!0)}if(I.isSkinnedMesh){rt.setOptional(b,I,"bindMatrix"),rt.setOptional(b,I,"bindMatrixInverse");const St=I.skeleton;St&&(St.boneTexture===null&&St.computeBoneTexture(),rt.setValue(b,"boneTexture",St.boneTexture,Ue))}I.isBatchedMesh&&(rt.setOptional(b,I,"batchingTexture"),rt.setValue(b,"batchingTexture",I._matricesTexture,Ue),rt.setOptional(b,I,"batchingIdTexture"),rt.setValue(b,"batchingIdTexture",I._indirectTexture,Ue),rt.setOptional(b,I,"batchingColorTexture"),I._colorsTexture!==null&&rt.setValue(b,"batchingColorTexture",I._colorsTexture,Ue));const Nt=z.morphAttributes;if((Nt.position!==void 0||Nt.normal!==void 0||Nt.color!==void 0)&&J.update(I,z,Pt),(Dt||Re.receiveShadow!==I.receiveShadow)&&(Re.receiveShadow=I.receiveShadow,rt.setValue(b,"receiveShadow",I.receiveShadow)),H.isMeshGouraudMaterial&&H.envMap!==null&&(Ft.envMap.value=fe,Ft.flipEnvMap.value=fe.isCubeTexture&&fe.isRenderTargetTexture===!1?-1:1),H.isMeshStandardMaterial&&H.envMap===null&&U.environment!==null&&(Ft.envMapIntensity.value=U.environmentIntensity),Dt&&(rt.setValue(b,"toneMappingExposure",M.toneMappingExposure),Re.needsLights&&nc(Ft,Li),ee&&H.fog===!0&&B.refreshFogUniforms(Ft,ee),B.refreshMaterialUniforms(Ft,H,W,A,d.state.transmissionRenderTarget[x.id]),Us.upload(b,Xa(Re),Ft,Ue)),H.isShaderMaterial&&H.uniformsNeedUpdate===!0&&(Us.upload(b,Xa(Re),Ft,Ue),H.uniformsNeedUpdate=!1),H.isSpriteMaterial&&rt.setValue(b,"center",I.center),rt.setValue(b,"modelViewMatrix",I.modelViewMatrix),rt.setValue(b,"normalMatrix",I.normalMatrix),rt.setValue(b,"modelMatrix",I.matrixWorld),H.isShaderMaterial||H.isRawShaderMaterial){const St=H.uniformsGroups;for(let Rt=0,Ks=St.length;Rt<Ks;Rt++){const On=St[Rt];Te.update(On,Pt),Te.bind(On,Pt)}}return Pt}function nc(x,U){x.ambientLightColor.needsUpdate=U,x.lightProbe.needsUpdate=U,x.directionalLights.needsUpdate=U,x.directionalLightShadows.needsUpdate=U,x.pointLights.needsUpdate=U,x.pointLightShadows.needsUpdate=U,x.spotLights.needsUpdate=U,x.spotLightShadows.needsUpdate=U,x.rectAreaLights.needsUpdate=U,x.hemisphereLights.needsUpdate=U}function ic(x){return x.isMeshLambertMaterial||x.isMeshToonMaterial||x.isMeshPhongMaterial||x.isMeshStandardMaterial||x.isShadowMaterial||x.isShaderMaterial&&x.lights===!0}this.getActiveCubeFace=function(){return R},this.getActiveMipmapLevel=function(){return P},this.getRenderTarget=function(){return N},this.setRenderTargetTextures=function(x,U,z){const H=_e.get(x);H.__autoAllocateDepthBuffer=x.resolveDepthBuffer===!1,H.__autoAllocateDepthBuffer===!1&&(H.__useRenderToTexture=!1),_e.get(x.texture).__webglTexture=U,_e.get(x.depthTexture).__webglTexture=H.__autoAllocateDepthBuffer?void 0:z,H.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(x,U){const z=_e.get(x);z.__webglFramebuffer=U,z.__useDefaultFramebuffer=U===void 0};const sc=b.createFramebuffer();this.setRenderTarget=function(x,U=0,z=0){N=x,R=U,P=z;let H=!0,I=null,ee=!1,ce=!1;if(x){const fe=_e.get(x);if(fe.__useDefaultFramebuffer!==void 0)pe.bindFramebuffer(b.FRAMEBUFFER,null),H=!1;else if(fe.__webglFramebuffer===void 0)Ue.setupRenderTarget(x);else if(fe.__hasExternalTextures)Ue.rebindTextures(x,_e.get(x.texture).__webglTexture,_e.get(x.depthTexture).__webglTexture);else if(x.depthBuffer){const Ae=x.depthTexture;if(fe.__boundDepthTexture!==Ae){if(Ae!==null&&_e.has(Ae)&&(x.width!==Ae.image.width||x.height!==Ae.image.height))throw new Error("WebGLRenderTarget: Attached DepthTexture is initialized to the incorrect size.");Ue.setupDepthRenderbuffer(x)}}const Ce=x.texture;(Ce.isData3DTexture||Ce.isDataArrayTexture||Ce.isCompressedArrayTexture)&&(ce=!0);const Pe=_e.get(x).__webglFramebuffer;x.isWebGLCubeRenderTarget?(Array.isArray(Pe[U])?I=Pe[U][z]:I=Pe[U],ee=!0):x.samples>0&&Ue.useMultisampledRTT(x)===!1?I=_e.get(x).__webglMultisampledFramebuffer:Array.isArray(Pe)?I=Pe[z]:I=Pe,L.copy(x.viewport),k.copy(x.scissor),X=x.scissorTest}else L.copy(xe).multiplyScalar(W).floor(),k.copy(Ne).multiplyScalar(W).floor(),X=Ke;if(z!==0&&(I=sc),pe.bindFramebuffer(b.FRAMEBUFFER,I)&&H&&pe.drawBuffers(x,I),pe.viewport(L),pe.scissor(k),pe.setScissorTest(X),ee){const fe=_e.get(x.texture);b.framebufferTexture2D(b.FRAMEBUFFER,b.COLOR_ATTACHMENT0,b.TEXTURE_CUBE_MAP_POSITIVE_X+U,fe.__webglTexture,z)}else if(ce){const fe=U;for(let Ce=0;Ce<x.textures.length;Ce++){const Pe=_e.get(x.textures[Ce]);b.framebufferTextureLayer(b.FRAMEBUFFER,b.COLOR_ATTACHMENT0+Ce,Pe.__webglTexture,z,fe)}}else if(x!==null&&z!==0){const fe=_e.get(x.texture);b.framebufferTexture2D(b.FRAMEBUFFER,b.COLOR_ATTACHMENT0,b.TEXTURE_2D,fe.__webglTexture,z)}E=-1},this.readRenderTargetPixels=function(x,U,z,H,I,ee,ce,Se=0){if(!(x&&x.isWebGLRenderTarget)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let fe=_e.get(x).__webglFramebuffer;if(x.isWebGLCubeRenderTarget&&ce!==void 0&&(fe=fe[ce]),fe){pe.bindFramebuffer(b.FRAMEBUFFER,fe);try{const Ce=x.textures[Se],Pe=Ce.format,Ae=Ce.type;if(!be.textureFormatReadable(Pe)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!be.textureTypeReadable(Ae)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}U>=0&&U<=x.width-H&&z>=0&&z<=x.height-I&&(x.textures.length>1&&b.readBuffer(b.COLOR_ATTACHMENT0+Se),b.readPixels(U,z,H,I,ve.convert(Pe),ve.convert(Ae),ee))}finally{const Ce=N!==null?_e.get(N).__webglFramebuffer:null;pe.bindFramebuffer(b.FRAMEBUFFER,Ce)}}},this.readRenderTargetPixelsAsync=async function(x,U,z,H,I,ee,ce,Se=0){if(!(x&&x.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let fe=_e.get(x).__webglFramebuffer;if(x.isWebGLCubeRenderTarget&&ce!==void 0&&(fe=fe[ce]),fe)if(U>=0&&U<=x.width-H&&z>=0&&z<=x.height-I){pe.bindFramebuffer(b.FRAMEBUFFER,fe);const Ce=x.textures[Se],Pe=Ce.format,Ae=Ce.type;if(!be.textureFormatReadable(Pe))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!be.textureTypeReadable(Ae))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");const ke=b.createBuffer();b.bindBuffer(b.PIXEL_PACK_BUFFER,ke),b.bufferData(b.PIXEL_PACK_BUFFER,ee.byteLength,b.STREAM_READ),x.textures.length>1&&b.readBuffer(b.COLOR_ATTACHMENT0+Se),b.readPixels(U,z,H,I,ve.convert(Pe),ve.convert(Ae),0);const je=N!==null?_e.get(N).__webglFramebuffer:null;pe.bindFramebuffer(b.FRAMEBUFFER,je);const ot=b.fenceSync(b.SYNC_GPU_COMMANDS_COMPLETE,0);return b.flush(),await ph(b,ot,4),b.bindBuffer(b.PIXEL_PACK_BUFFER,ke),b.getBufferSubData(b.PIXEL_PACK_BUFFER,0,ee),b.deleteBuffer(ke),b.deleteSync(ot),ee}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(x,U=null,z=0){const H=Math.pow(2,-z),I=Math.floor(x.image.width*H),ee=Math.floor(x.image.height*H),ce=U!==null?U.x:0,Se=U!==null?U.y:0;Ue.setTexture2D(x,0),b.copyTexSubImage2D(b.TEXTURE_2D,z,0,0,ce,Se,I,ee),pe.unbindTexture()};const rc=b.createFramebuffer(),ac=b.createFramebuffer();this.copyTextureToTexture=function(x,U,z=null,H=null,I=0,ee=null){ee===null&&(I!==0?(Zi("WebGLRenderer: copyTextureToTexture function signature has changed to support src and dst mipmap levels."),ee=I,I=0):ee=0);let ce,Se,fe,Ce,Pe,Ae,ke,je,ot;const it=x.isCompressedTexture?x.mipmaps[ee]:x.image;if(z!==null)ce=z.max.x-z.min.x,Se=z.max.y-z.min.y,fe=z.isBox3?z.max.z-z.min.z:1,Ce=z.min.x,Pe=z.min.y,Ae=z.isBox3?z.min.z:0;else{const Nt=Math.pow(2,-I);ce=Math.floor(it.width*Nt),Se=Math.floor(it.height*Nt),x.isDataArrayTexture?fe=it.depth:x.isData3DTexture?fe=Math.floor(it.depth*Nt):fe=1,Ce=0,Pe=0,Ae=0}H!==null?(ke=H.x,je=H.y,ot=H.z):(ke=0,je=0,ot=0);const et=ve.convert(U.format),Re=ve.convert(U.type);let st;U.isData3DTexture?(Ue.setTexture3D(U,0),st=b.TEXTURE_3D):U.isDataArrayTexture||U.isCompressedArrayTexture?(Ue.setTexture2DArray(U,0),st=b.TEXTURE_2D_ARRAY):(Ue.setTexture2D(U,0),st=b.TEXTURE_2D),b.pixelStorei(b.UNPACK_FLIP_Y_WEBGL,U.flipY),b.pixelStorei(b.UNPACK_PREMULTIPLY_ALPHA_WEBGL,U.premultiplyAlpha),b.pixelStorei(b.UNPACK_ALIGNMENT,U.unpackAlignment);const We=b.getParameter(b.UNPACK_ROW_LENGTH),Pt=b.getParameter(b.UNPACK_IMAGE_HEIGHT),Qn=b.getParameter(b.UNPACK_SKIP_PIXELS),Dt=b.getParameter(b.UNPACK_SKIP_ROWS),Li=b.getParameter(b.UNPACK_SKIP_IMAGES);b.pixelStorei(b.UNPACK_ROW_LENGTH,it.width),b.pixelStorei(b.UNPACK_IMAGE_HEIGHT,it.height),b.pixelStorei(b.UNPACK_SKIP_PIXELS,Ce),b.pixelStorei(b.UNPACK_SKIP_ROWS,Pe),b.pixelStorei(b.UNPACK_SKIP_IMAGES,Ae);const rt=x.isDataArrayTexture||x.isData3DTexture,Ft=U.isDataArrayTexture||U.isData3DTexture;if(x.isDepthTexture){const Nt=_e.get(x),St=_e.get(U),Rt=_e.get(Nt.__renderTarget),Ks=_e.get(St.__renderTarget);pe.bindFramebuffer(b.READ_FRAMEBUFFER,Rt.__webglFramebuffer),pe.bindFramebuffer(b.DRAW_FRAMEBUFFER,Ks.__webglFramebuffer);for(let On=0;On<fe;On++)rt&&(b.framebufferTextureLayer(b.READ_FRAMEBUFFER,b.COLOR_ATTACHMENT0,_e.get(x).__webglTexture,I,Ae+On),b.framebufferTextureLayer(b.DRAW_FRAMEBUFFER,b.COLOR_ATTACHMENT0,_e.get(U).__webglTexture,ee,ot+On)),b.blitFramebuffer(Ce,Pe,ce,Se,ke,je,ce,Se,b.DEPTH_BUFFER_BIT,b.NEAREST);pe.bindFramebuffer(b.READ_FRAMEBUFFER,null),pe.bindFramebuffer(b.DRAW_FRAMEBUFFER,null)}else if(I!==0||x.isRenderTargetTexture||_e.has(x)){const Nt=_e.get(x),St=_e.get(U);pe.bindFramebuffer(b.READ_FRAMEBUFFER,rc),pe.bindFramebuffer(b.DRAW_FRAMEBUFFER,ac);for(let Rt=0;Rt<fe;Rt++)rt?b.framebufferTextureLayer(b.READ_FRAMEBUFFER,b.COLOR_ATTACHMENT0,Nt.__webglTexture,I,Ae+Rt):b.framebufferTexture2D(b.READ_FRAMEBUFFER,b.COLOR_ATTACHMENT0,b.TEXTURE_2D,Nt.__webglTexture,I),Ft?b.framebufferTextureLayer(b.DRAW_FRAMEBUFFER,b.COLOR_ATTACHMENT0,St.__webglTexture,ee,ot+Rt):b.framebufferTexture2D(b.DRAW_FRAMEBUFFER,b.COLOR_ATTACHMENT0,b.TEXTURE_2D,St.__webglTexture,ee),I!==0?b.blitFramebuffer(Ce,Pe,ce,Se,ke,je,ce,Se,b.COLOR_BUFFER_BIT,b.NEAREST):Ft?b.copyTexSubImage3D(st,ee,ke,je,ot+Rt,Ce,Pe,ce,Se):b.copyTexSubImage2D(st,ee,ke,je,Ce,Pe,ce,Se);pe.bindFramebuffer(b.READ_FRAMEBUFFER,null),pe.bindFramebuffer(b.DRAW_FRAMEBUFFER,null)}else Ft?x.isDataTexture||x.isData3DTexture?b.texSubImage3D(st,ee,ke,je,ot,ce,Se,fe,et,Re,it.data):U.isCompressedArrayTexture?b.compressedTexSubImage3D(st,ee,ke,je,ot,ce,Se,fe,et,it.data):b.texSubImage3D(st,ee,ke,je,ot,ce,Se,fe,et,Re,it):x.isDataTexture?b.texSubImage2D(b.TEXTURE_2D,ee,ke,je,ce,Se,et,Re,it.data):x.isCompressedTexture?b.compressedTexSubImage2D(b.TEXTURE_2D,ee,ke,je,it.width,it.height,et,it.data):b.texSubImage2D(b.TEXTURE_2D,ee,ke,je,ce,Se,et,Re,it);b.pixelStorei(b.UNPACK_ROW_LENGTH,We),b.pixelStorei(b.UNPACK_IMAGE_HEIGHT,Pt),b.pixelStorei(b.UNPACK_SKIP_PIXELS,Qn),b.pixelStorei(b.UNPACK_SKIP_ROWS,Dt),b.pixelStorei(b.UNPACK_SKIP_IMAGES,Li),ee===0&&U.generateMipmaps&&b.generateMipmap(st),pe.unbindTexture()},this.initRenderTarget=function(x){_e.get(x).__webglFramebuffer===void 0&&Ue.setupRenderTarget(x)},this.initTexture=function(x){x.isCubeTexture?Ue.setTextureCube(x,0):x.isData3DTexture?Ue.setTexture3D(x,0):x.isDataArrayTexture||x.isCompressedArrayTexture?Ue.setTexture2DArray(x,0):Ue.setTexture2D(x,0),pe.unbindTexture()},this.resetState=function(){R=0,P=0,N=null,pe.reset(),re.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return nn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;const t=this.getContext();t.drawingBufferColorSpace=Ve._getDrawingBufferColorSpace(e),t.unpackColorSpace=Ve._getUnpackColorSpace()}}const Fm="EL NIÑO SWELL",Nm="el-nino-swell",Om="RIDE THE BIG WINTER.",Oa={name:Fm,slug:Nm,tagline:Om},Is=Oa.name,Vl=Oa.slug,Bm=Oa.tagline;class zm{client=null;queue=[];constructor(){const e="phc_DfnJkR875PZNUubdzNL52FKrn5zxvYeJwCErxgyWySLy",t="https://us.i.posthog.com";dl(()=>import("./module-BgzLZHoS.js"),[]).then(n=>{const s=n.default;s.init(e,{api_host:t,capture_pageview:!0,persistence:"localStorage+cookie",autocapture:!1}),this.client=s;for(const[r,o]of this.queue)this.client.capture(r,o);this.queue.length=0}).catch(()=>{})}track(e,t={}){const n=`${Vl}:${e}`;if(this.client){this.client.capture(n,t);return}this.queue.push([n,t])}}const bn=new zm,km=240,yn=240,Hm=150,$t=48,Hi=7,Wl=1.2,sn=32,rn=48,Cn=10,Xe=4/9,Gm=5/9,Ba=6/9,Xl=7/9,ql=8/9,Gs=.78,Yl=.86,$l=.82,Kl=.91,Vm={z:0,y:0,phase:0},Tn={z:0,y:0,phase:0},wr={z:0,y:0,phase:0},Ar={z:0,y:0,phase:0},Wm={position:new F,normal:new F,phase:0,steepness:0},jo=new Float64Array(Cn),Jo=new Float64Array(Cn);let bi=5;function Zt(i,e,t){return Math.max(e,Math.min(t,i))}function wi(i,e,t){const n=Zt((t-i)/(e-i),0,1);return n*n*(3-2*n)}function Rr(){return bi}function Xm(i){bi=i}function Wt(i){return Hi*i}function Zl(i){return Wt(i)-sn}function Vs(i){return Wt(i)-rn}function qm(i){return wi(.35,Gs,i)}function jl(i){return wi(Gs,Yl,i)}function za(i){return wi($l,Kl,i)}function Ym(i){return i<0?.35*wi(-40,0,i):i<sn?.35+.45*wi(0,sn,i):i<rn?.8+.2*((i-sn)/(rn-sn)):1+.6*Zt((i-rn)/12,0,1)}function Ys(i,e){return Ym(Wt(e)-i)}function Jl(i,e,t,n){const s=qm(e),r=jl(e),o=za(e),a=i,l=.55*a+.15*a*s+.15*a*r,c=.95*a+.05*a*s;t[0]=2.5*a,n[0]=-.15*a,t[1]=1.05*a,n[1]=.15*a,t[2]=.75*a-.05*a*s,n[2]=.5*a,t[3]=.6*a+.15*a*s,n[3]=.84*a,t[4]=l,n[4]=c,t[5]=l+.75*a*r,n[5]=c-.02*a*r,t[6]=l+.95*a*r,n[6]=c-.55*a*r-.5*a*o,t[7]=l+1*a*r,n[7]=c+.06*a-.28*a*r,t[8]=l-.05*a+.25*a*r,n[8]=c+.12*a,t[9]=-1.2*a,n[9]=-.1*a}function Qo(i,e,t,n,s){const r=s*s,o=r*s;return .5*(2*e+(-i+t)*s+(2*i-5*e+4*t-n)*r+(-i+3*e-3*t+n)*o)}function Ql(i,e,t,n,s,r,o,a){const l=Zt(t,0,1)*(Cn-1),c=Math.min(Cn-2,Math.floor(l)),h=l-c,u=Math.max(0,c-1),f=c,p=Math.min(Cn-1,c+1),_=Math.min(Cn-1,c+2);let v=Qo(i[u],i[f],i[p],i[_],h),m=Qo(e[u],e[f],e[p],e[_],h);const d=wi(1,1.6,s);if(d>0){const w=.42+.05*Math.sin(n*.28+o*3.1),T=(t-w)/.3,M=.55*r*Math.exp(-T*T)+Math.sin(n*.7+t*21+o*4)*.15*r*(1-Math.abs(T)*.5),C=(2.6-5.6*t)*r+Math.sin(n*.22+o*2)*.15*r;v+=(C-v)*d,m+=(Math.max(0,M)-m)*d}return a.z=v,a.y=m,a.phase=s,a}function en(i,e,t,n=Vm){const s=Ys(i,t);return Jl(bi,s,jo,Jo),Ql(jo,Jo,e,i,s,bi,t,n),n.z+=Wl*t,n}function Si(i,e,t,n=Wm){en(i,e,t,Tn),en(i+.05,e,t,wr),en(i,Zt(e+.003,0,1),t,Ar);const s=.05,r=wr.y-Tn.y,o=wr.z-Tn.z,a=Ar.y-Tn.y,l=Ar.z-Tn.z,c=r*l-o*a,h=-s*l,u=s*a,f=1/Math.max(1e-4,Math.hypot(c,h,u));return n.position.set(i,Tn.y,Tn.z),n.normal.set(c*f,h*f,u*f),n.normal.y<0&&n.normal.multiplyScalar(-1),n.phase=Tn.phase,n.steepness=Math.abs(a/Math.max(1e-4,Math.abs(l))),n}class $m{mesh;positions;normals;phases;controlZ=new Float64Array(Cn);controlY=new Float64Array(Cn);point={z:0,y:0,phase:0};constructor(e){const t=$t+1,n=(yn+1)*t,s=new It;this.positions=new Float32Array(n*3),this.normals=new Float32Array(n*3),this.phases=new Float32Array(n);const r=new Float32Array(n),o=new Uint32Array(yn*$t*6);let a=0;for(let l=0;l<yn;l+=1)for(let c=0;c<$t;c+=1){const h=l*t+c,u=h+t;o[a]=h,o[a+1]=u,o[a+2]=h+1,o[a+3]=u,o[a+4]=u+1,o[a+5]=h+1,a+=6}for(let l=0;l<=yn;l+=1)for(let c=0;c<=$t;c+=1)r[l*t+c]=c/$t;s.setAttribute("position",new gt(this.positions,3).setUsage(xi)),s.setAttribute("normal",new gt(this.normals,3).setUsage(xi)),s.setAttribute("phase",new gt(this.phases,1).setUsage(xi)),s.setAttribute("face",new gt(r,1)),s.setIndex(new gt(o,1)),this.mesh=new bt(s,e),this.mesh.frustumCulled=!1,this.update(0)}update(e){const t=$t+1,n=Wl*e,s=Wt(e)-Hm;let r=0;for(let a=0;a<=yn;a+=1){const l=s+a*(km/yn),c=Ys(l,e);Jl(bi,c,this.controlZ,this.controlY);for(let h=0;h<=$t;h+=1){Ql(this.controlZ,this.controlY,h/$t,l,c,bi,e,this.point);const u=r*3;this.positions[u]=l,this.positions[u+1]=this.point.y,this.positions[u+2]=this.point.z+n,this.phases[r]=c,r+=1}}for(let a=0;a<=yn;a+=1){const l=Math.max(0,a-1),c=Math.min(yn,a+1);for(let h=0;h<=$t;h+=1){const u=Math.max(0,h-1),f=Math.min($t,h+1),p=(l*t+h)*3,_=(c*t+h)*3,v=(a*t+u)*3,m=(a*t+f)*3,d=this.positions[_]-this.positions[p],w=this.positions[_+1]-this.positions[p+1],T=this.positions[_+2]-this.positions[p+2],M=this.positions[m+1]-this.positions[v+1],C=this.positions[m+2]-this.positions[v+2];let R=w*C-T*M,P=-d*C,N=d*M;const E=1/Math.max(1e-4,Math.hypot(R,P,N));R*=E,P*=E,N*=E,P<0&&h<$t*.6&&(R*=-1,P*=-1,N*=-1);const S=(a*t+h)*3;this.normals[S]=R,this.normals[S+1]=P,this.normals[S+2]=N}}const o=this.mesh.geometry;o.attributes.position.needsUpdate=!0,o.attributes.phase.needsUpdate=!0,o.attributes.normal.needsUpdate=!0}}class Km{camera;profileView=!1;barrelBlend=0;desired=new F;target=new F;profile={z:0,y:0,phase:0};constructor(e){this.camera=new kt(37,e,.1,1400)}snap(e,t){this.barrelBlend=0,this.compute(e,t),this.camera.position.copy(this.desired),this.camera.fov=37,this.camera.updateProjectionMatrix(),this.camera.lookAt(this.target)}update(e,t,n,s,r=!1,o=!1){if(this.profileView){const h=Rr(),u=Wt(t)-40;en(u,.5,t,this.profile),this.camera.position.set(u+.01,1.4*h,this.profile.z+7.5*h),this.camera.fov=42,this.camera.updateProjectionMatrix(),this.camera.lookAt(u,.55*h,this.profile.z-.5*h);return}const a=1-Math.exp(-e*3.5);this.barrelBlend+=((o?0:s)-this.barrelBlend)*a,this.compute(n,t,o);const l=Rr();if(n.y>.55*l||r){const h=n.y-.55*l+(r?.4*l:0);this.desired.y+=h*.9,this.target.y+=h*.95}const c=1-Math.exp(-5*e);this.camera.position.lerp(this.desired,c),this.camera.fov+=(Kt.lerp(37,43,this.barrelBlend)-this.camera.fov)*c,this.camera.updateProjectionMatrix(),this.camera.lookAt(this.target)}compute(e,t,n=!1){const s=Rr(),r=this.barrelBlend,o=Math.max(e.x+1.3*s,n?-1/0:Wt(t)-36),a=Math.max(e.x+1.2*s,Zl(t)+1.5*s);this.desired.set(Kt.lerp(o,a,r),Kt.lerp(.95*s,.82*s,r),e.z+Kt.lerp(3.1*s,2*s,r)),this.clampAboveWave(t);const l=n?e.x+.2*s:Math.max(e.x+.45*s,Wt(t)-44),c=e.x+.25*s;this.target.set(Kt.lerp(l,c,r),Kt.lerp(.72*s,.6*s,r),e.z-Kt.lerp(.2*s,.05*s,r))}clampAboveWave(e){let t=-100;for(let n=0;n<=24;n+=1)en(this.desired.x,n/24,e,this.profile),Math.abs(this.profile.z-this.desired.z)<1.2&&(t=Math.max(t,this.profile.y));this.desired.y=Math.max(this.desired.y,t+.35)}resize(e,t){this.camera.aspect=e/t,this.camera.updateProjectionMatrix()}}class Zm{element;visible=!1;constructor(e){this.element=document.createElement("pre"),this.element.id="debug",this.element.hidden=!0,e.append(this.element)}toggle(){this.visible=!this.visible,this.element.hidden=!this.visible}update(e,t,n){this.visible&&(this.element.textContent=`p ${t.toFixed(2)}  d ${e.distance.toFixed(1)}
u ${e.u.toFixed(2)}  speed ${e.speed.toFixed(1)}
pose ${e.pose}
air ${e.airborne}  tube ${e.insideBarrel}
barrel ${e.barrelPhase}  cover ${e.coverage.toFixed(2)}
fps ${n.toFixed(1)}

green rideable  magenta lip cover
red foam boundary  yellow rider bounds`)}}const gi=[{id:"pier",name:"THE PIER",place:"HUNTINGTON, CA",tagline:"RIDE THE LINE. BEAT THE PIER.",heights:[4.2,5,6],pier:!0,hazards:[{kind:"gull",weight:25},{kind:"fish",weight:20},{kind:"debris",weight:25},{kind:"swimmer",weight:20},{kind:"buoy",weight:10}],backdrop:[{atlas:"water",frame:"sun-0",x:150,y:34,z:-540,height:48},{atlas:"water",frame:"cloud-0",x:-140,y:62,z:-500,drift:.9,height:30},{atlas:"water",frame:"cloud-1",x:40,y:78,z:-520,drift:.6,height:24},{atlas:"water",frame:"cloud-2",x:240,y:70,z:-510,drift:.75,height:24},{atlas:"water",frame:"cloud-1",x:380,y:58,z:-500,drift:.5,height:18},{atlas:"water",frame:"mountain-0",x:30,y:0,z:-330,height:40},{atlas:"water",frame:"mountain-1",x:250,y:0,z:-340,height:36},{strip:!0,atlas:"water",frames:["palms-0","palms-1"],x0:-300,x1:300,y:0,z:-250,height:20,gap:30}]},{id:"trestles",name:"TRESTLES",place:"SAN CLEMENTE, CA",tagline:"COBBLESTONES, A CROWD, AND A LONG RIGHT.",heights:[4.6,5.4,6.4],pier:!1,hazards:[{kind:"gull",weight:15},{kind:"rocks",weight:25},{kind:"paddler",weight:20},{kind:"sitter",weight:15},{kind:"bodyboarder",weight:15},{kind:"buoy",weight:10}],backdrop:[{atlas:"trestles",frame:"tsun-0",x:-100,y:30,z:-520,height:46},{atlas:"trestles",frame:"tcloud-0",x:-260,y:62,z:-500,drift:.8,height:30},{atlas:"trestles",frame:"tcloud-1",x:20,y:80,z:-510,drift:.55,height:18},{atlas:"trestles",frame:"tcloud-0",x:300,y:58,z:-495,drift:.7,height:26},{atlas:"trestles",frame:"coast-0",x:-280,y:0,z:-440,height:16},{atlas:"trestles",frame:"coast-1",x:10,y:0,z:-445,height:16},{atlas:"trestles",frame:"tpier-0",x:250,y:0,z:-430,height:6},{strip:!0,atlas:"trestles",frames:["bluff-3","bluff-0","palmridge-1","bluff-2","palmridge-0","bluff-1"],x0:-300,x1:300,y:0,z:-230,height:42,gap:-4},{strip:!0,atlas:"trestles",frames:["crowd-0","tent-0","crowd-0","tent-1","crowd-0","tent-2"],x0:-60,x1:330,y:0,z:-196,height:6,gap:2},{atlas:"trestles",frame:"tower-0",x:350,y:0,z:-194,height:13},{atlas:"trestles",frame:"flags-0",x:380,y:0,z:-192,height:11},{atlas:"trestles",frame:"rocks-0",x:-120,y:-.4,z:-176,height:5},{atlas:"trestles",frame:"rocks-1",x:-70,y:-.4,z:-172,height:4},{atlas:"trestles",frame:"rocks-0",x:430,y:-.4,z:-174,height:5}]},{id:"hawaii",name:"HAWAII",place:"WAIKIKI, HI",tagline:"BIGGER. WARMER. WATCH FOR TURTLES.",heights:[5.2,6.2,7.4],pier:!1,hazards:[{kind:"gull",weight:10},{kind:"turtle",weight:25},{kind:"paddler",weight:20},{kind:"bodyboarder",weight:15},{kind:"fish",weight:15},{kind:"marker",weight:15}],backdrop:[{atlas:"hawaii",frame:"hsun-0",x:250,y:26,z:-540,height:52},{atlas:"hawaii",frame:"reflection-0",x:252,y:1,z:-500,height:18},{atlas:"hawaii",frame:"hcloud-0",x:-200,y:60,z:-520,drift:.7,height:32},{atlas:"hawaii",frame:"hcloud-1",x:90,y:78,z:-525,drift:.5,height:22},{atlas:"hawaii",frame:"hcloud-1",x:380,y:66,z:-515,drift:.6,height:24},{atlas:"hawaii",frame:"diamondhead-0",x:40,y:0,z:-260,height:60},{atlas:"hawaii",frame:"resort-0",x:-170,y:0,z:-240,height:22},{atlas:"hawaii",frame:"resort-1",x:-245,y:0,z:-232,height:14},{strip:!0,atlas:"hawaii",frames:["hpalms-0"],x0:-300,x1:-110,y:0,z:-220,height:18,gap:-6},{strip:!0,atlas:"hawaii",frames:["hpalms-0"],x0:300,x1:420,y:0,z:-224,height:16,gap:-6},{atlas:"hawaii",frame:"sailboat-0",x:-40,y:0,z:-170,drift:.5,height:9},{atlas:"hawaii",frame:"sailboat-1",x:160,y:0,z:-190,drift:.35,height:7},{atlas:"hawaii",frame:"sailboat-3",x:330,y:0,z:-160,drift:.6,height:8},{atlas:"hawaii",frame:"sailboat-2",x:-260,y:0,z:-150,drift:.45,height:6}]}],el="one-more-wave.unlocked";function jm(i){const e=gi.findIndex(t=>t.id===i);return e<0?0:e}const Jm=2.8,Qm=90,tl=3,eg=26,tg=3.2,nl="one-more-wave.best";function il(i){return i.id==="pier"?nl:`${nl}.${i.id}`}function ng(i){let e=2166136261;for(const t of i)e^=t.charCodeAt(0),e=Math.imul(e,16777619);return e>>>0}function ig(i=new Date){return ng(i.toISOString().slice(0,10))}function ec(i,e,t=""){const n=t.replace(/[^a-z0-9]/gi,"").slice(0,3).toUpperCase();return[i.toString(36),Math.round(e).toString(36),n].filter(Boolean).join(".")}function sg(i){const[e,t,n=""]=i.split(".");if(!e||!t)return null;const s=parseInt(e,36),r=parseInt(t,36);return!Number.isFinite(s)||!Number.isFinite(r)?null:{seed:s>>>0,score:r,initials:n.toUpperCase()}}class rg{phase="title";score=0;best=0;wave=1;heatClock=0;waveClock=0;phaseClock=0;combo=0;comboClock=0;popups=[];stamp=null;stats={tricks:0,longestRide:0,barrels:0,bestCombo:0};seed=ig();challengeScore=null;challengeInitials="";lastWipeReason="";level=0;unlocked=0;unlockedNow=null;lastComboShown=1;wipeoutNext="wave-complete";pierWarning=!1;riderScreen={x:320,y:180};hooded=!1;constructor(){try{this.unlocked=Math.min(gi.length-1,Number(localStorage.getItem(el)??0)||0)}catch{this.unlocked=0}const e=new URLSearchParams(window.location.search),t=jm(e.get("level"));this.selectLevel(t,!0);const n=e.get("c"),s=n?sg(n):null;s&&(this.seed=s.seed,this.challengeScore=s.score,this.challengeInitials=s.initials)}get levelDef(){return gi[this.level]}get nextLevel(){return this.level+1<gi.length?gi[this.level+1]:null}get waveHeight(){const e=this.levelDef.heights;return e[Math.min(e.length-1,this.wave-1)]}selectLevel(e,t=!1){const n=Math.max(0,Math.min(gi.length-1,e));if(n>this.unlocked&&!t)return!1;this.level=n;try{this.best=Number(localStorage.getItem(il(this.levelDef))??0)||0}catch{this.best=0}return!0}cycleLevel(){this.selectLevel((this.level+1)%(this.unlocked+1))}get timeLeft(){return Math.max(0,Qm-this.heatClock)}togglePause(){if(this.phase==="riding"){this.phase="paused";return}this.phase==="paused"&&(this.phase="riding")}startRun(){this.score=0,this.wave=1,this.heatClock=0,this.waveClock=0,this.combo=0,this.comboClock=0,this.stats.tricks=0,this.stats.longestRide=0,this.stats.barrels=0,this.stats.bestCombo=0,this.popups.length=0,this.lastWipeReason="",this.unlockedNow=null,this.enter("countdown")}enter(e,t=!1){this.phase=e,this.phaseClock=0,e==="countdown"&&(this.stamp={frame:"stamp-1",age:0,duration:.8}),e==="wave-complete"&&(this.stamp=t?null:{frame:"stamp-complete-0",age:0,duration:1.6}),e==="game-over"&&(this.stamp={frame:"stamp-gameover-0",age:t?-.7:0,duration:1.6}),e==="riding"&&(this.stamp={frame:"stamp-0",age:0,duration:.7})}popup(e,t=0,n){if(this.popups.find(o=>o.frame===e&&o.age<.5))return;const r=this.popups.filter(o=>o.age<.9);for(;r.length>=3;){const o=r.shift();o.age=Math.max(o.age,.9)}r.forEach((o,a)=>{o.stack=a}),this.popups.push({frame:e,offsetX:this.hooded?104:46,offsetY:this.hooded?-104:-74,stack:r.length,age:t,caption:n})}award(e,t){this.comboClock=tg,this.combo+=1;const n=Math.min(4,this.combo);this.score+=e*n,this.stats.tricks+=1,this.stats.bestCombo=Math.max(this.stats.bestCombo,n),this.popup(t),n>=2&&n!==this.lastComboShown&&(this.lastComboShown=n,this.popup(`popup-${3+n}`,-.3))}confirm(e,t){this.score+=e*Math.min(4,Math.max(1,this.combo)),this.popup(t,-.35)}update(e,t,n,s){if(this.riderScreen.x=s.x,this.riderScreen.y=s.y,this.hooded=t.barrelPhase!=="open",this.phase!=="paused"){this.phaseClock+=e,this.stamp&&(this.stamp.age+=e,this.stamp.age>=this.stamp.duration&&(this.stamp=null));for(const r of this.popups)r.age+=e;for(;this.popups.length>0&&this.popups[0].age>1.3;)this.popups.shift();if(this.phase==="countdown"){this.phaseClock>=.8&&this.phaseClock-e<.8&&(this.stamp={frame:"stamp-2",age:0,duration:.8}),this.phaseClock>=1.6&&this.enter("riding");return}if(this.phase==="riding"){this.heatClock+=e,this.waveClock+=e,t.wipedOut||(this.score+=e*(t.insideBarrel?40:10)),this.comboClock-=e,this.comboClock<=0&&(this.combo=0,this.lastComboShown=1);for(const r of n)r.type==="air"&&this.award(300,"popup-0"),r.type==="clean-landing"&&this.confirm(150,"popup-3"),r.type==="cutback"&&this.award(150,"popup-2"),r.type==="snap"&&this.award(120,"popup-8"),r.type==="barrel"&&(this.stats.barrels+=1,this.award(Math.round(120*r.seconds),r.seconds>=3?"popup-9":"popup-1")),r.type==="wipeout"&&(this.lastWipeReason=r.reason,this.combo=0,this.lastComboShown=1,this.popups.length=0,this.popup("popup-4",0,r.reason.toUpperCase()),this.stats.longestRide=Math.max(this.stats.longestRide,this.waveClock),this.wipeoutNext=this.wave>=tl||this.timeLeft<=0?"game-over":"wave-complete",this.enter("wipeout",!1));this.phase==="riding"&&this.waveClock>=eg&&(this.score+=500,this.stats.longestRide=Math.max(this.stats.longestRide,this.waveClock),this.enter(this.wave>=tl?"game-over":"wave-complete")),this.phase==="riding"&&this.timeLeft<=0&&this.enter("game-over");return}if(this.phase==="wipeout"&&this.phaseClock>=1.5){this.enter(this.wipeoutNext,this.wipeoutNext==="wave-complete");return}if(this.phase==="wave-complete"&&this.phaseClock>=1.8){this.wave+=1,this.waveClock=0,this.enter("countdown");return}if(this.phase==="game-over"&&this.phaseClock>=1.8){this.best=Math.max(this.best,Math.floor(this.score));try{localStorage.setItem(il(this.levelDef),String(this.best))}catch{}if((this.wave>=2||this.score>=1500)&&this.level===this.unlocked&&this.nextLevel){this.unlocked=this.level+1,this.unlockedNow=this.nextLevel;try{localStorage.setItem(el,String(this.unlocked))}catch{}}this.enter(this.unlockedNow?"advance":"results")}}}}const wn=.5;class An{constructor(e,t,n,s,r,o){this.key=e,this.texture=t,this.image=n,this.frames=s,this.width=r,this.height=o}key;texture;image;frames;width;height;static async load(e){const t=window.__SPRITES?.[e],n="/surf-game/".replace(/\/?$/,"/"),s=t?t.json:await(await fetch(`${n}sprites/${e}.json`)).json(),r={};for(const[c,h]of Object.entries(s.frames))r[c]=h.frame;const o=new Image,a=new Promise((c,h)=>{o.onload=()=>c(),o.onerror=()=>h(new Error(`sprite image failed: ${e}`))});o.src=t?t.png:`${n}sprites/${e}.png`,await a;const l=new vt(o);return l.magFilter=ht,l.minFilter=ht,l.generateMipmaps=!1,l.needsUpdate=!0,new An(e,l,o,r,s.meta.size.width??s.meta.size.w??o.naturalWidth,s.meta.size.height??s.meta.size.h??o.naturalHeight)}frame(e){const t=this.frames[e];if(!t)throw new Error(`Missing frame ${this.key}/${e}`);return t}}function ag(i,e){return new Ct({uniforms:{map:{value:i.texture},texel:{value:new $e(1/i.width,1/i.height)},outline:{value:e?1:0},outlineColor:{value:new ze("#0A1D2B")},ghost:{value:0},ghostTint:{value:new ze("#0B6C82")}},transparent:!0,side:Ht,vertexShader:`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,fragmentShader:`
      uniform sampler2D map;
      uniform vec2 texel;
      uniform float outline;
      uniform vec3 outlineColor;
      uniform float ghost;
      uniform vec3 ghostTint;
      varying vec2 vUv;
      void main() {
        vec4 c = texture2D(map, vUv);
        // ghost pass: drawn only where water covers the sprite; a screen-door of the tinted figure reads as
        // the rider seen through the curtain without ghosting the whole wave
        if (ghost > 0.5) {
          vec2 px = floor(gl_FragCoord.xy);
          if (c.a < 0.5) {
            // a solid outline keeps the covered figure readable against foam
            float a = texture2D(map, vUv + vec2(texel.x, 0.0)).a + texture2D(map, vUv - vec2(texel.x, 0.0)).a
                    + texture2D(map, vUv + vec2(0.0, texel.y)).a + texture2D(map, vUv - vec2(0.0, texel.y)).a;
            if (a >= 0.5) { gl_FragColor = vec4(outlineColor, 1.0); return; }
            discard;
          }
          if (mod(px.x + px.y, 2.0) < 0.5) discard;   // the curtain's holes are the even pixels; the ghost fills the odd ones
          gl_FragColor = vec4(mix(ghostTint, c.rgb, 0.7), 1.0);
          return;
        }
        if (c.a >= 0.5) { gl_FragColor = vec4(c.rgb, 1.0); return; }
        if (outline > 0.5) {
          float t = 1.0;
          float a = texture2D(map, vUv + vec2(texel.x * t, 0.0)).a + texture2D(map, vUv - vec2(texel.x * t, 0.0)).a
                  + texture2D(map, vUv + vec2(0.0, texel.y * t)).a + texture2D(map, vUv - vec2(0.0, texel.y * t)).a;
          if (a >= 0.5) { gl_FragColor = vec4(outlineColor, 1.0); return; }
        }
        discard;
      }
    `})}class Pn extends bt{constructor(e,t,n=wn,s=!1,r=!1){const o=new Fn(1,1);o.translate(0,.5,0),super(o,ag(e,s)),this.atlas=e,this.pixelScale=n,r&&(this.material.depthTest=!1,this.material.depthWrite=!1,this.renderOrder=10),this.frustumCulled=!1,this.setFrame(t)}atlas;pixelScale;frameName="";frameWidth=1;frameHeight=1;flipped=!1;baseQuaternion=new Ci;setDepthMode(e){const t=this.material;t.depthTest=e!=="onTop",t.depthWrite=e==="scene",t.depthFunc=e==="ghost"?Ns:Zn,t.uniforms.ghost.value=e==="ghost"?1:0,this.renderOrder=e==="scene"?1:e==="ghost"?12:10,t.needsUpdate=!0}setFrame(e){if(e===this.frameName)return;this.frameName=e;const t=this.atlas.frame(e);this.frameWidth=t.w,this.frameHeight=t.h,this.applyUv(t)}get currentFrame(){return this.frameName}setFlip(e){e!==this.flipped&&(this.flipped=e,this.applyUv(this.atlas.frame(this.frameName)))}applyUv(e){const t=this.geometry.attributes.uv,n=e.x/this.atlas.width,s=(e.x+e.w)/this.atlas.width,r=1-(e.y+e.h)/this.atlas.height,o=1-e.y/this.atlas.height,a=this.flipped?s:n,l=this.flipped?n:s;t.setXY(0,a,o),t.setXY(1,l,o),t.setXY(2,a,r),t.setXY(3,l,r),t.needsUpdate=!0}orient(e,t,n=0){const s=this.frameHeight*this.pixelScale*t,r=this.frameWidth*this.pixelScale*t;this.scale.set(r,s,1),this.baseQuaternion.copy(e.quaternion),this.quaternion.copy(this.baseQuaternion),n!==0&&this.rotateZ(n)}orientWorld(e,t,n=0){const s=this.frameWidth/this.frameHeight*t;this.scale.set(s,t,1),this.baseQuaternion.copy(e.quaternion),this.quaternion.copy(this.baseQuaternion),n!==0&&this.rotateZ(n)}}function Fs(i,e,t){return 2*e*Math.tan(Kt.degToRad(i.fov)/2)/t}class sl{constructor(e,t){this.frames=e,this.fps=t}frames;fps;elapsed=0;set(e){e!==this.frames&&(this.frames=e,this.elapsed=0)}advance(e){Number.isFinite(e)&&e>0&&(this.elapsed+=e);const t=this.frames.length,n=(Math.floor(this.elapsed*this.fps)%t+t)%t;return this.frames[n]}get finished(){return this.elapsed*this.fps>=this.frames.length}}const og=["#003a60","#014a72","#e6f9ff","#311434","#04263c","#018bb3","#015795","#01719a","#029fbb","#06c7c6","#ff5c6c","#f0f3f5","#00c3ed","#01dff8","#161314","#fcd306","#12324a","#03b4bd","#fcf5d4","#090606","#2b2a2f","#036145","#911a0c","#dbf9fa","#01abea","#0a1d2b","#5f3b1f","#012156","#03d477","#b8f1ff","#023074","#ff9a3d","#250703","#fed57b","#7f4a23","#97531f","#7decc8","#442f25","#fe898d","#0292d2","#fca702","#20ccd0","#08a9cf","#c26c18","#6a0308","#dd811b","#531a0a","#9aabc4","#fb1d4e","#fb3254","#fda355","#3c1006","#8ef7f2","#8b92ad","#0198f9","#08d2d8","#fa7b32","#127cc1","#c6f2f7","#fea575","#3e3a40","#e56231","#d4e2e7","#69240f","#a46226","#a3cada","#0b6c82","#fbdf2a","#7b83a0","#f97a03","#6ae8f2","#45ddc9","#0abcdc","#fa6a49","#c2d7df","#cc512e","#a4dce6","#2ed9ca","#b4fbd8","#b2432d","#142d17","#4fe1e7","#f69a23","#4ad9e1","#a04124","#fa2ac4","#8d3a27","#3b6b86","#317892","#75e3e1","#1b4661","#b7f598","#7ed0e8","#86a1bc","#fff0b0","#638098","#fdb967","#4b4a53","#32c9e4","#5b97b1","#256884","#39e2ec","#1bdbe7","#3da3c5","#0268b7","#e85023","#81261e","#5a2e37","#234517","#21334c","#72afbf","#058656","#0f8ea3","#1db6c9","#f8feff","#b7ecf8","#ffbe8a","#ff8d73","#f57cb3","#7d7ccf","#ffd447","#43d87d","#d93b72","#0b5fa5","#29c7f6","#b9844a","#8e5e34"],Ie=640,_t=360,lg=256,Et=32;class cg{constructor(e){this.renderer=e,this.target=new In(Ie,_t,{minFilter:ht,magFilter:ht,depthBuffer:!0,stencilBuffer:!1,generateMipmaps:!1});const t=og;this.paletteSize=Math.min(lg,t.length);const n=t.slice(0,this.paletteSize).map(a=>[parseInt(a.slice(1,3),16),parseInt(a.slice(3,5),16),parseInt(a.slice(5,7),16)]),s=new Uint8Array(Et*Et*Et*4);for(let a=0;a<Et;a+=1)for(let l=0;l<Et;l+=1)for(let c=0;c<Et;c+=1){const h=(c+.5)*(255/Et),u=(l+.5)*(255/Et),f=(a+.5)*(255/Et);let p=Number.POSITIVE_INFINITY,_=n[0];for(const m of n){const d=(m[0]-h)*.3,w=(m[1]-u)*.59,T=(m[2]-f)*.11,M=d*d+w*w+T*T;M<p&&(p=M,_=m)}const v=((a*Et+l)*Et+c)*4;s[v]=_[0],s[v+1]=_[1],s[v+2]=_[2],s[v+3]=255}const r=new zh(s,Et*Et,Et,Gt);r.magFilter=ht,r.minFilter=ht,r.needsUpdate=!0,this.material=new Ct({uniforms:{tDiffuse:{value:this.target.texture},tLut:{value:r},ditherStrength:{value:1/20},resolution:{value:new $e(Ie,_t)}},depthTest:!1,depthWrite:!1,vertexShader:`
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,fragmentShader:`
        uniform sampler2D tDiffuse;
        uniform sampler2D tLut;
        uniform float ditherStrength;
        uniform vec2 resolution;
        varying vec2 vUv;

        float bayer4(vec2 pixel) {
          int x = int(mod(pixel.x, 4.0));
          int y = int(mod(pixel.y, 4.0));
          int index = x + y * 4;
          float m = 0.0;
          if (index == 0) m = 0.0; else if (index == 1) m = 8.0; else if (index == 2) m = 2.0; else if (index == 3) m = 10.0;
          else if (index == 4) m = 12.0; else if (index == 5) m = 4.0; else if (index == 6) m = 14.0; else if (index == 7) m = 6.0;
          else if (index == 8) m = 3.0; else if (index == 9) m = 11.0; else if (index == 10) m = 1.0; else if (index == 11) m = 9.0;
          else if (index == 12) m = 15.0; else if (index == 13) m = 7.0; else if (index == 14) m = 13.0; else m = 5.0;
          return (m + 0.5) / 16.0 - 0.5;
        }

        void main() {
          vec2 pixel = floor(vUv * resolution);
          vec3 source = clamp(texture2D(tDiffuse, vUv).rgb + bayer4(pixel) * ditherStrength, 0.0, 1.0);
          float size = ${Et}.0;
          vec3 cell = floor(source * (size - 0.001));
          vec2 lutUv = vec2((cell.g * size + cell.r + 0.5) / (size * size), (cell.b + 0.5) / size);
          gl_FragColor = vec4(texture2D(tLut, lutUv).rgb, 1.0);
        }
      `});const o=new bt(new Fn(2,2),this.material);o.frustumCulled=!1,this.quadScene.add(o),this.resize(window.innerWidth,window.innerHeight)}renderer;target;paletteSize;quadScene=new Ua;quadCamera=new Fa(-1,1,1,-1,0,1);material;viewportX=0;viewportY=0;viewportWidth=Ie;viewportHeight=_t;resize(e,t){const n=Math.min(e/Ie,t/_t),s=Math.floor(n),r=s>=1&&s/n>=.8?s:Math.max(.5,n);this.viewportWidth=Math.round(Ie*r),this.viewportHeight=Math.round(_t*r),this.viewportX=Math.floor((e-this.viewportWidth)/2),this.viewportY=Math.floor((t-this.viewportHeight)/2),this.renderer.setSize(e,t,!1)}clientToTarget(e,t){const n=this.renderer.domElement.getBoundingClientRect(),s=this.viewportWidth/Ie,r=n.width/this.renderer.domElement.width,o=(e-n.left)/r,a=(t-n.top)/r,l=this.renderer.domElement.height-a;return{x:(o-this.viewportX)/s,y:_t-(l-this.viewportY)/s}}beginScene(){this.renderer.setRenderTarget(this.target),this.renderer.setViewport(0,0,Ie,_t),this.renderer.setScissorTest(!1),this.renderer.clear(!0,!0,!1)}present(){this.renderer.setRenderTarget(null),this.renderer.setScissorTest(!0),this.renderer.setScissor(this.viewportX,this.viewportY,this.viewportWidth,this.viewportHeight),this.renderer.setViewport(this.viewportX,this.viewportY,this.viewportWidth,this.viewportHeight),this.renderer.render(this.quadScene,this.quadCamera),this.renderer.setScissorTest(!1)}}const Sa=[{id:"up",frame:"circle-btn-0",label:"CLIMB",x:46,y:256,r:24},{id:"down",frame:"circle-btn-1",label:"DROP",x:46,y:318,r:24},{id:"cutback",frame:"circle-btn-2",label:"STALL",x:536,y:318,r:24},{id:"run",frame:"circle-btn-2",label:"RUN",x:594,y:318,r:24,flip:!0},{id:"pump",frame:"circle-btn-4",label:"PUMP",x:594,y:256,r:24,cropH:113}],hg={id:"level",x:130,y:114,w:380,h:30},Cr=[{id:"mute",x:520,y:62,w:44,h:46},{id:"help",x:558,y:62,w:44,h:46},{id:"pause",x:596,y:62,w:44,h:46}],ug='"Press Start 2P", monospace';class dg{constructor(e){this.ui=e,this.canvas.width=Ie,this.canvas.height=_t;const t=this.canvas.getContext("2d");if(!t)throw new Error("No 2d context");this.context=t,this.texture=new Yh(this.canvas),this.texture.magFilter=ht,this.texture.minFilter=ht,this.texture.generateMipmaps=!1;const n=new bt(new Fn(2,2),new La({map:this.texture,transparent:!0,depthTest:!1,depthWrite:!1}));n.frustumCulled=!1,this.scene.add(n)}ui;scene=new Ua;camera=new Fa(-1,1,1,-1,0,1);canvas=document.createElement("canvas");context;texture;plate(e,t,n,s,r){const o=this.ui.frame(e),a=10,l=Math.round(a*wn),c=this.ui.image,h=[[o.x,o.y,a,a,t,n,l,l],[o.x+a,o.y,o.w-a*2,a,t+l,n,s-l*2,l],[o.x+o.w-a,o.y,a,a,t+s-l,n,l,l],[o.x,o.y+a,a,o.h-a*2,t,n+l,l,r-l*2],[o.x+a,o.y+a,o.w-a*2,o.h-a*2,t+l,n+l,s-l*2,r-l*2],[o.x+o.w-a,o.y+a,a,o.h-a*2,t+s-l,n+l,l,r-l*2],[o.x,o.y+o.h-a,a,a,t,n+r-l,l,l],[o.x+a,o.y+o.h-a,o.w-a*2,a,t+l,n+r-l,s-l*2,l],[o.x+o.w-a,o.y+o.h-a,a,a,t+s-l,n+r-l,l,l]];for(const u of h)this.context.drawImage(c,...u)}sprite(e,t,n){const s=this.ui.frame(e);this.context.drawImage(this.ui.image,s.x,s.y,s.w,s.h,t,n,Math.round(s.w*wn),Math.round(s.h*wn))}text(e,t,n,s,r,o="left"){const a=this.context;a.font=`${s}px ${ug}`,a.textAlign=o,a.textBaseline="top",a.fillStyle="#0A1D2B",a.fillText(e,t+1,n+1),a.fillStyle=r,a.fillText(e,t,n)}bar(e,t,n,s,r,o){const a=this.context;a.fillStyle="#0A1D2B",a.fillRect(e,t,n,s),a.fillStyle="#12324A",a.fillRect(e+1,t+1,n-2,s-2),a.fillStyle=o,a.fillRect(e+2,t+2,Math.round((n-4)*Math.max(0,Math.min(1,r))),s-4)}spriteCentered(e,t,n,s=wn,r={}){const o=this.ui.frame(e),a=r.cropH?Math.min(o.h,r.cropH):o.h,l=Math.round(o.w*s),c=Math.round(a*s),h=Math.round(t-l/2),u=Math.round(n-c/2);if(!r.flip){this.context.drawImage(this.ui.image,o.x,o.y,o.w,a,h,u,l,c);return}this.context.save(),this.context.translate(h+l,u),this.context.scale(-1,1),this.context.drawImage(this.ui.image,o.x,o.y,o.w,a,0,0,l,c),this.context.restore()}touchButton(e,t,n,s,r){this.spriteCentered(e.frame,t,n,s,{flip:e.flip,cropH:e.cropH}),r&&this.text(e.label,t,n+e.r+2,8,"#F8FEFF","center")}drawPopups(e){const t=e.pierWarning?190:150;for(const n of e.popups){if(n.age<0)continue;const s=Math.min(1,n.age/.35),r=wn*(n.age<.12?.6:n.age<.24?.85:1),o=e.riderScreen.x+n.offsetX+n.stack*132,a=o>Ie-72,l=a?Math.min(Ie-72,Math.max(72,e.riderScreen.x+n.offsetX)):Math.max(72,o),c=a?n.stack*42:0,h=Math.max(a?88:t,Math.max(t,e.riderScreen.y+n.offsetY)-c)-s*12-Math.max(0,n.age-.8)*40;this.spriteCentered(n.frame,l,h,r),n.caption&&this.text(n.caption,l,h+26,8,"#FFD447","center")}}drawStamp(e){const t=e.stamp;if(!t||t.age<0)return;const n=t.age<.1?.7:t.age<.2?.9:1;this.spriteCentered(t.frame,Ie/2,_t/2-20,wn*1.4*n)}drawTitle(e){const t=this.context;this.plate("plate-dark",130,52,380,150),this.text(Is,Ie/2,74,24,"#F8FEFF","center"),this.text(Bm,Ie/2,104,8,"#B8F1FF","center"),this.text(`${e.levelDef.name}  //  ${e.levelDef.place}`,Ie/2,120,8,"#FFD447","center"),this.text(e.levelDef.tagline,Ie/2,134,8,"#B8F1FF","center");const n=e.nextLevel,s=e.unlocked>0?this.touch?"TAP THE BREAK NAME TO CHANGE BREAK":"L: CHANGE BREAK":n?`SURVIVE A WAVE TO UNLOCK ${n.name}`:"";s&&this.text(s,Ie/2,148,8,"#75E3E1","center"),Math.floor(e.phaseClock*2)%2===0&&this.text(this.touch?"TAP TO START":"CLICK THE GAME, THEN PRESS SPACE",Ie/2,160,8,"#FFD447","center"),e.challengeScore!==null&&(this.plate("plate-blue",170,212,300,30),this.text(`BEAT ${e.challengeInitials||"A FRIEND"}'S ${String(e.challengeScore).padStart(6,"0")}`,Ie/2,223,8,"#F8FEFF","center")),this.touch?["up","down","cutback","run","pump"].forEach((a,l)=>{const c=Sa.find(h=>h.id===a);c&&this.touchButton(c,128+l*96,262,.42,!0)}):(this.sprite("key-0",236,236),this.text("CLIMB",280,252,8,"#F8FEFF"),this.sprite("key-1",236,284),this.text("DROP",280,300,8,"#F8FEFF"),this.sprite("key-space-0",336,236),this.text("PUMP",450,252,8,"#F8FEFF"),this.sprite("key-2",336,284),this.text("STALL BACK",380,300,8,"#F8FEFF")),this.text("STALL INTO THE FOAM FOR A BARREL. CLIMB OVER THE LIP FOR AN AIR.",Ie/2,336,8,"#B8F1FF","center"),t.fillStyle="#B8F1FF",this.text("MADE BY QUIVER",Ie/2,350,8,"#75E3E1","center")}drawHelp(){this.plate("plate-dark",120,96,400,188),this.text("HOW TO SURF",Ie/2,108,16,"#F8FEFF","center"),(this.touch?[["STALL","BACK INTO THE BARREL"],["RUN","DOWN THE LINE, EXIT THE TUBE"],["CLIMB","OVER THE LIP = AIR"],["DROP","DOWN THE FACE"],["PUMP","HOLD FOR SPEED"]]:[["A / LEFT","STALL BACK INTO THE BARREL"],["D / RIGHT","RUN DOWN THE LINE, EXIT THE TUBE"],["W / UP","CLIMB. OVER THE LIP = AIR"],["S / DOWN","DROP DOWN THE FACE"],["SPACE","PUMP FOR SPEED"]]).forEach(([t,n],s)=>{const r=138+s*16;this.text(t,136,r,8,"#FFD447"),this.text(n,232,r,8,"#F8FEFF")}),this.text("STAY AHEAD OF THE FOAM.",Ie/2,222,8,"#B8F1FF","center"),this.text("HOLD THE MIDDLE OF THE FACE THROUGH THE PIER.",Ie/2,236,8,"#B8F1FF","center"),this.text(this.touch?"TOP RIGHT: SOUND, HELP, PAUSE":"P PAUSE   M MUTE   L CHANGE BREAK",Ie/2,254,8,"#75E3E1","center"),this.text(this.touch?"TAP TO CLOSE":"CLICK OR PRESS ? TO CLOSE",Ie/2,270,8,"#FFD447","center")}drawAdvance(e){const t=e.unlockedNow;t&&(this.plate("plate-dark",110,96,420,132),this.text("NEW BREAK UNLOCKED",Ie/2,110,16,"#FFD447","center"),this.text(`${t.name}  //  ${t.place}`,Ie/2,140,8,"#F8FEFF","center"),this.text(t.tagline,Ie/2,156,8,"#B8F1FF","center"),this.text(`${e.levelDef.name} SCORE  ${String(Math.floor(e.score)).padStart(6,"0")}`,Ie/2,178,8,"#75E3E1","center"),Math.floor(e.phaseClock*3)%2===0&&this.text("PADDLING OUT...",Ie/2,204,8,"#FFD447","center"))}drawResults(e){if(this.plate("plate-dark",110,18,420,200),this.text(e.lastWipeReason?"GAME OVER":"HEAT COMPLETE",Ie/2,32,16,"#F8FEFF","center"),e.lastWipeReason&&this.text(e.lastWipeReason.toUpperCase(),Ie/2,56,8,"#FF8D73","center"),this.text("SCORE",140,80,8,"#B8F1FF"),this.text(String(Math.floor(e.score)).padStart(6,"0"),500,76,16,"#FFD447","right"),this.text("BEST",140,106,8,"#B8F1FF"),this.text(String(Math.floor(e.best)).padStart(6,"0"),500,104,8,"#F8FEFF","right"),this.text("TRICKS LANDED",140,126,8,"#B8F1FF"),this.text(String(e.stats.tricks),500,126,8,"#F8FEFF","right"),this.text("BARRELS",140,144,8,"#B8F1FF"),this.text(String(e.stats.barrels),500,144,8,"#F8FEFF","right"),this.text("LONGEST RIDE",140,162,8,"#B8F1FF"),this.text(`${e.stats.longestRide.toFixed(1)} S`,500,162,8,"#F8FEFF","right"),this.text("BEST COMBO",140,180,8,"#B8F1FF"),this.text(`${e.stats.bestCombo}X`,500,180,8,"#F8FEFF","right"),e.unlockedNow&&this.text(`NEW BREAK UNLOCKED: ${e.unlockedNow.name}${this.touch?"":"  //  N TO SURF IT"}`,Ie/2,198,8,Math.floor(e.phaseClock*3)%2===0?"#FFD447":"#F8FEFF","center"),e.challengeScore!==null){const t=e.score>e.challengeScore;this.text(t?`YOU BEAT ${e.challengeInitials||"THEM"}!`:`${e.challengeInitials||"THEY"} STILL HOLD ${String(e.challengeScore).padStart(6,"0")}`,Ie/2,e.unlockedNow?210:200,8,t?"#43D87D":"#FF8D73","center")}}touch=!1;draw(e,t){this.touch=e.touch;const n=this.context;if(n.imageSmoothingEnabled=!1,n.clearRect(0,0,Ie,_t),t.phase==="title"){this.drawTitle(t),this.texture.needsUpdate=!0;return}if(t.phase==="results"){this.drawResults(t),this.texture.needsUpdate=!0;return}if(t.phase==="advance"){this.drawAdvance(t),this.texture.needsUpdate=!0;return}this.plate("plate-dark",12,10,132,46),this.text("SCORE",22,17,8,"#B8F1FF"),this.text(String(Math.floor(e.score)).padStart(6,"0"),22,30,16,"#F8FEFF"),n.fillStyle="#FFD447",n.fillRect(22,49,96,2),this.plate("plate-dark",12,58,132,20),this.text("BEST",22,64,8,"#F8FEFF"),this.text(String(Math.floor(e.best)).padStart(6,"0"),136,64,8,"#F8FEFF","right"),this.plate("plate-blue",158,10,322,26),this.text(`${e.levelName}  WAVE ${e.wave}/${e.waves}`,168,19,8,"#F8FEFF"),this.bar(340,16,128,12,e.waveProgress,"#FF8D73"),this.plate("plate-blue",158,40,322,28),this.text("DANGER / FOAM GAP",168,50,8,"#F8FEFF");const s=e.foamGap,r=s<.3?"#FF5C6C":s<.6?"#FFD447":"#29C7F6";this.bar(318,47,112,12,s,r),this.text(s<.3?"DANGER":s<.6?"WATCH":"SAFE",470,51,8,s<.3?"#FF5C6C":s<.6?"#FFD447":"#75E3E1","right"),this.plate("plate-dark",496,10,132,46),this.text("TIME",620,17,8,"#B8F1FF","right");const o=Math.floor(Math.max(0,e.timeLeft)/60),a=Math.floor(Math.max(0,e.timeLeft)%60);if(this.text(`${String(o).padStart(2,"0")}:${String(a).padStart(2,"0")}`,620,30,16,"#F8FEFF","right"),this.sprite(e.muted?"btn-mute-0":"btn-sound-0",520,62),this.sprite("btn-help-0",558,62),this.sprite("btn-pause-0",596,62),e.pierWarning&&this.spriteCentered("banner-pier-0",Ie/2,118,wn*(Math.floor(e.timeLeft*4)%2===0?1:.94)),e.touch)for(const l of Sa)this.touchButton(l,l.x,l.y,.38,!0);if(e.needsFocus&&Math.floor(e.timeLeft*2)%2===0&&this.text("CLICK THE GAME TO GIVE IT YOUR KEYBOARD",Ie/2,330,8,"#FFD447","center"),!e.help&&e.paused&&(this.plate("plate-dark",220,150,200,44),this.text("PAUSED",Ie/2,160,16,"#F8FEFF","center"),this.text(e.touch?"TAP PAUSE TO RESUME":"P TO RESUME",Ie/2,180,8,"#B8F1FF","center")),this.drawPopups(t),this.drawStamp(t),e.help&&this.drawHelp(),e.flash>0){n.fillStyle="#F8FEFF";const l=e.flash>.18?1:2;for(let c=0;c<_t;c+=l)for(let h=c/l%2===0?0:l;h<Ie;h+=l*2)n.fillRect(h,c,l,l)}this.texture.needsUpdate=!0}}class fg{state={climb:0,steer:0,pump:!1};up=!1;down=!1;left=!1;right=!1;space=!1;restartRequested=!1;heightRequest=0;debugToggleRequested=!1;profileToggleRequested=!1;startRequested=!1;challengeRequested=!1;findRequested=!1;muteRequested=!1;pauseRequested=!1;levelRequested=!1;nextLevelRequested=!1;sawKey=!1;touchButtons=[];hudButtons=[];helpRequested=!1;isTouch=typeof window<"u"&&("ontouchstart"in window||navigator.maxTouchPoints>0);pointers=new Map;toTarget=()=>({x:-1,y:-1});constructor(){window.addEventListener("keydown",this.onKeyDown),window.addEventListener("keyup",this.onKeyUp),window.addEventListener("blur",this.clear)}attachPointer(e,t){this.toTarget=t,e.tabIndex=0,e.style.outline="none",e.addEventListener("pointerdown",s=>{s.preventDefault(),e.focus(),window.focus();const r=this.toTarget(s.clientX,s.clientY),o=this.hudButtons.find(l=>r.x>=l.x&&r.x<=l.x+l.w&&r.y>=l.y&&r.y<=l.y+l.h);if(o){o.id==="mute"&&(this.muteRequested=!0),o.id==="help"&&(this.helpRequested=!0),o.id==="pause"&&(this.pauseRequested=!0),o.id==="level"&&(this.levelRequested=!0);return}const a=this.touchButtons.find(l=>Math.hypot(l.x-r.x,l.y-r.y)<=l.r);this.pointers.set(s.pointerId,a?.id??"none"),a||(this.startRequested=!0),this.refreshPointers()});const n=s=>{this.pointers.delete(s.pointerId),this.refreshPointers()};e.addEventListener("pointerup",n),e.addEventListener("pointercancel",n),e.addEventListener("pointerleave",n)}refreshPointers(){const e=new Set(this.pointers.values());this.touchUp=e.has("up"),this.touchDown=e.has("down"),this.touchPump=e.has("pump"),this.touchCutback=e.has("cutback"),this.touchRun=e.has("run"),this.refresh()}touchUp=!1;touchDown=!1;touchPump=!1;touchCutback=!1;touchRun=!1;onKeyDown=e=>{(e.code==="ArrowUp"||e.code==="ArrowDown"||e.code==="ArrowLeft"||e.code==="ArrowRight"||e.code==="Space")&&e.preventDefault(),!e.repeat&&((e.code==="KeyW"||e.code==="ArrowUp")&&(this.up=!0),(e.code==="KeyS"||e.code==="ArrowDown")&&(this.down=!0),(e.code==="KeyA"||e.code==="ArrowLeft")&&(this.left=!0),(e.code==="KeyD"||e.code==="ArrowRight")&&(this.right=!0),e.code==="Space"&&(this.space=!0),e.code==="KeyR"&&(this.restartRequested=!0),e.code==="KeyH"&&(this.debugToggleRequested=!0),e.code==="KeyO"&&(this.profileToggleRequested=!0),(e.code==="KeyP"||e.code==="Escape")&&(this.pauseRequested=!0),this.sawKey=!0,(e.code==="Space"||e.code==="Enter")&&(this.startRequested=!0),e.code==="KeyC"&&(this.challengeRequested=!0),e.code==="KeyF"&&(this.findRequested=!0),e.code==="KeyM"&&(this.muteRequested=!0),e.code==="KeyL"&&(this.levelRequested=!0),(e.code==="Slash"||e.code==="F1")&&(e.preventDefault(),this.helpRequested=!0),e.code==="KeyN"&&(this.nextLevelRequested=!0),e.code==="Digit1"&&(this.heightRequest=3.4),e.code==="Digit2"&&(this.heightRequest=5),e.code==="Digit3"&&(this.heightRequest=7),this.refresh())};onKeyUp=e=>{(e.code==="KeyW"||e.code==="ArrowUp")&&(this.up=!1),(e.code==="KeyS"||e.code==="ArrowDown")&&(this.down=!1),(e.code==="KeyA"||e.code==="ArrowLeft")&&(this.left=!1),(e.code==="KeyD"||e.code==="ArrowRight")&&(this.right=!1),e.code==="Space"&&(this.space=!1),this.refresh()};clear=()=>{this.up=this.down=this.left=this.right=this.space=!1,this.refresh()};refresh(){this.state.climb=Number(this.up||this.touchUp)-Number(this.down||this.touchDown),this.state.steer=Number(this.left||this.touchCutback)-Number(this.right||this.touchRun),this.state.pump=this.space||this.touchPump}consume(e){const t=this[e];return this[e]=!1,t}consumeRestart(){return this.consume("restartRequested")}consumeDebugToggle(){return this.consume("debugToggleRequested")}consumeProfileToggle(){return this.consume("profileToggleRequested")}consumeStart(){return this.consume("startRequested")}consumeChallenge(){return this.consume("challengeRequested")}consumeFind(){return this.consume("findRequested")}consumeMute(){return this.consume("muteRequested")}consumePause(){return this.consume("pauseRequested")}consumeLevel(){return this.consume("levelRequested")}consumeHelp(){return this.consume("helpRequested")}consumeNextLevel(){return this.consume("nextLevelRequested")}consumeHeight(){const e=this.heightRequest;return this.heightRequest=0,e}}const pg={gull:{atlas:"obstacles",frame:"gull-0"},fish:{atlas:"obstacles",frame:"marker-0"},debris:{atlas:"obstacles",frame:"debris-0"},swimmer:{atlas:"obstacles",frame:"swimmer-0"},buoy:{atlas:"obstacles",frame:"buoy-0"},turtle:{atlas:"hawaii",frame:"turtle-0"},paddler:{atlas:"hawaii",frame:"paddler-0"},bodyboarder:{atlas:"hawaii",frame:"bodyboarder-h-0"},marker:{atlas:"hawaii",frame:"marker-h-0"},rocks:{atlas:"trestles",frame:"rocks-0"},sitter:{atlas:"trestles",frame:"npc-sitting-0"}};function mg(i){let e=i>>>0;return()=>{e=e+1831565813>>>0;let t=e;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}}const Ws=[.28*Xe,.595*Xe,.91*Xe],gg=Ws[1]-Ws[0],rl=1,_g=.3,vg=.065,xg=new Set(["swimmer","paddler","bodyboarder","sitter","turtle","debris","rocks"]),Mg=34;class Wi{constructor(e,t){this.scene=e,this.atlases=t}scene;atlases;pierWarning=!1;closestPierPass=Number.POSITIVE_INFINITY;items=[];piers=[];sample={position:new F,normal:new F,phase:0,steepness:0};gullClock=0;alerts=[];get atlas(){return this.atlases.obstacles}clear(){for(const e of this.items)this.scene.remove(e.quad),e.quad.geometry.dispose();for(const e of this.alerts)this.scene.remove(e),e.geometry.dispose();this.alerts.length=0,this.items.length=0,this.piers.length=0,this.pierWarning=!1}showFlash(e,t){this.flash||(this.flash=new Pn(this.atlases.trestles,"impactsplash-0",.5,!1,!0),this.flash.renderOrder=11,this.scene.add(this.flash)),this.flash.position.copy(e),this.flash.position.y-=.2,this.flash.visible=!0,this.flashTimer=.55,this.flash.orient(t,Fs(t,t.position.distanceTo(e),_t)*.5)}add(e,t,n,s,r=0,o=-1,a){const l=e==="post"?this.atlas:this.atlases[a??pg[e].atlas],c=new Pn(l,t,e==="post"?.62:.6,!0,!0);this.scene.add(c);const h={kind:e,x:n,u:s,quad:c,clock:0,variant:r,pier:o,passed:!1};if(this.items.push(h),e!=="buoy"&&e!=="fish"&&e!=="marker"){const u=new Pn(this.atlas,"marker-alert-0",.5,!0,!0);u.visible=!1,this.scene.add(u),this.alerts.push(u),h.alert=u}return h}newWave(e,t,n,s){this.clear();const r=mg(e+t*7919),o=s.hazards.reduce((f,p)=>f+p.weight,0),a=()=>{let f=r()*o;for(const p of s.hazards)if(f-=p.weight,f<=0)return p.kind;return s.hazards[s.hazards.length-1].kind};let l=n+40;const c=n+240;let h=!1;const u=new URLSearchParams(window.location.search).has("pier");for(;l<c;){if(s.pier&&!h&&(l>n+95+t*20||u&&l>n+50)){const p=this.piers.length;this.piers.push({x:l,gapU:Ws[rl],warned:!1,passed:!1}),Ws.forEach((_,v)=>{v!==rl&&this.add("post",`post-${v%4}`,l,_,v,p)}),h=!0,l+=34;continue}const f=a();f==="gull"?this.add("gull","gull-0",l+20,Xe,Math.floor(r()*3)):f==="fish"?this.add("fish","marker-0",l,(.28+r()*.175)*Xe):f==="debris"?this.add("debris",`debris-${Math.floor(r()*9)}`,l,(.23+r()*.14)*Xe):f==="swimmer"?this.add("swimmer",r()<.5?"swimmer-0":"bodyboard-0",l,(.455+r()*.14)*Xe,r()<.5?0:1):f==="buoy"?this.add("buoy","buoy-0",l,.0875*Xe):f==="turtle"?this.add("turtle","turtle-0",l,(.24+r()*.12)*Xe):f==="paddler"?this.add("paddler",s.id==="trestles"?"paddler-t-0":"paddler-0",l,(.42+r()*.16)*Xe,0,-1,s.id==="trestles"?"trestles":"hawaii"):f==="bodyboarder"?this.add("bodyboarder",s.id==="trestles"?"bodyboarder-t-0":"bodyboarder-h-0",l,(.36+r()*.16)*Xe,0,-1,s.id==="trestles"?"trestles":"hawaii"):f==="marker"?this.add("marker","marker-h-0",l,.1*Xe):f==="rocks"?this.add("rocks",r()<.5?"rocks-0":"rocks-1",l,.16*Xe):f==="sitter"&&this.add("sitter","npc-sitting-0",l,(.5+r()*.14)*Xe),l+=16+r()*18}}static SOFT=new Set(["buoy","marker"]);static REASON={gull:"took a gull to the face",fish:"fish to the face",debris:"clipped by debris",swimmer:"hit a swimmer",buoy:"",turtle:"ran over a turtle",paddler:"hit a paddler",bodyboarder:"hit a bodyboarder",marker:"",rocks:"hit the cobblestones",sitter:"hit a surfer in the lineup",post:"hit the pier"};static POST_HEIGHT=1.9;flash=null;flashTimer=0;update(e,t,n,s,r,o,a){this.flash&&(this.flashTimer-=e,this.flash.visible=this.flashTimer>0,this.flash.visible&&this.flash.orient(a,Fs(a,a.position.distanceTo(this.flash.position),_t)*.5)),this.gullClock+=e;let l=null;this.pierWarning=!1;for(const c of this.piers){const h=c.x-n.x;h>0&&h<Mg&&(this.pierWarning=!0),!c.passed&&h<-1.2&&(c.passed=!0,this.closestPierPass=Math.min(this.closestPierPass,Math.abs(n.u-c.gapU)))}for(const c of this.items){if(c.clock+=e,c.kind==="gull"&&(c.x-=6*e),(c.kind==="swimmer"||c.kind==="paddler"||c.kind==="bodyboarder")&&(c.x-=1.2*e),c.kind==="turtle"&&(c.x-=.6*e),c.kind==="gull"&&c.quad.setFrame(`gull-${(Math.floor(this.gullClock*9)+c.variant*3)%9}`),c.kind==="buoy"&&c.quad.setFrame(`buoy-${Math.floor(c.clock*2)%2}`),c.kind==="swimmer"&&c.quad.setFrame(c.variant===0?`swimmer-${Math.floor(c.clock*4)%3}`:`bodyboard-${Math.floor(c.clock*4)%3}`),c.kind==="fish"){const d=c.x-n.x;d>9?c.quad.setFrame(`marker-${Math.floor(c.clock*6)%3}`):d>4?c.quad.setFrame("marker-alert-0"):d>-3?c.quad.setFrame(d>1?"fish-0":"fish-1"):c.quad.setFrame(`fish-splash-${Math.min(2,Math.floor((-3-d)*2))}`)}const h=c.kind==="fish"&&c.x-n.x<4&&c.x-n.x>-3;Si(c.x,c.kind==="gull"?Xe:c.u,t,this.sample),c.quad.position.copy(this.sample.position),c.quad.position.z+=.2,c.kind==="gull"&&(c.quad.position.y+=2.2+Math.sin(c.clock*3)*.3),(c.kind==="turtle"||c.kind==="marker")&&(c.quad.position.y+=Math.sin(c.clock*2.5+c.x)*.12),h&&(c.quad.position.y+=1.4*Math.sin(Math.PI*Kt.clamp((4-(c.x-n.x))/7,0,1)));const u=Fs(a,a.position.distanceTo(c.quad.position),_t);if(c.kind==="post"?c.quad.orientWorld(a,Wi.POST_HEIGHT):c.quad.orient(a,u),c.quad.setFlip(c.kind==="swimmer"||c.kind==="gull"||c.kind==="paddler"||c.kind==="bodyboarder"),c.alert){const d=c.x-n.x;c.alert.visible=!c.passed&&d>0&&d<16&&Math.floor(c.clock*6)%2===0,c.alert.position.copy(c.quad.position),c.alert.position.y+=c.quad.scale.y+.3,c.alert.orient(a,u)}if(l||n.wipedOut||c.passed)continue;const f=c.x-n.x;if(f<-2){c.passed=!0;continue}if(Wi.SOFT.has(c.kind)||c.kind==="fish"&&!h)continue;const p=c.quad.scale.x*.3,_=c.quad.scale.y*.8;if(Math.abs(f)>r+p)continue;const v=c.quad.position.y;(c.kind==="post"?Math.abs(n.u-c.u)<gg*_g:xg.has(c.kind)?!n.airborne&&Math.abs(n.u-c.u)<vg:v<s+o&&v+_>s)&&(l={reason:Wi.REASON[c.kind]},this.showFlash(c.quad.position,a))}return l}}const Bi={idle:["idle-0","idle-1","idle-2","idle-3"],pump:["pump-0","pump-1","pump-2","pump-3"],lowline:["lowline-0","lowline-1","lowline-2","lowline-3"],bottomturn:["bottomturn-0","bottomturn-1","bottomturn-2","bottomturn-3"],topturn:["topturn-0","topturn-1","topturn-2","topturn-3"],cutback:["cutback-init-0","cutback-init-1","cutback-init-2","cutback-init-3"],rebound:["cutback-rebound-0","cutback-rebound-1","cutback-rebound-2"],tuck:["tuck-0","tuck-1","tuck-2","tuck-3"],takeoff:["takeoff-0","takeoff-1","takeoff-2"],air:["air-0","air-1","air-2"],grab:["grab-0","grab-1","grab-2"],landing:["landing-wobble-0","landing-wobble-1","landing-wobble-2"],wobble:["landing-wobble-3","landing-wobble-4","landing-wobble-5"],wipeout:["wipeout-0","wipeout-1","wipeout-2","wipeout-3","wipeout-3"]},Rs=.66,al=.21*Xe,ol=1.05*Xe,Pr=.525*Xe,ll=.28*Xe,Sg=.875*Xe,Eg=.98*Xe,cl=.875*Xe,yg=.875*Xe,Tg=.525*Xe,bg=.735*Xe;class wg{state={x:0,u:Pr,speed:Hi,heading:0,airborne:!1,insideBarrel:!1,wipedOut:!1,pose:"idle",distance:36,wipeReason:"",run:0,barrelPhase:"open",coverage:0};renderPosition=new F;events=[];quad;ghostQuad;boardQuad;splashQuad;previousX=0;previousU=Pr;exitTimer=0;toCamera=new F;pumpCooldown=0;pumpAnim=0;wipeoutTimer=0;caughtTimer=0;landingTimer=0;airTimer=0;airY=0;airVelocityY=0;grabAir=!1;barrelSeconds=0;cutbackArmed=!1;cutbackCooldown=0;snapArmed=!1;snapClock=0;freezePhysics=!1;runSpeed=0;cycle=new sl(Bi.idle,10);tumble=new sl(Bi.wipeout,6);sample={position:new F,normal:new F,phase:0,steepness:0};constructor(e,t){this.quad=new Pn(t,"idle-0",Rs,!0,!1),this.quad.setDepthMode("scene"),this.ghostQuad=new Pn(t,"idle-0",Rs,!1,!1),this.ghostQuad.setDepthMode("ghost"),e.add(this.ghostQuad),this.boardQuad=new Pn(t,"board-loose-0",Rs,!0,!0),this.boardQuad.visible=!1,this.splashQuad=new Pn(t,"splash-0",Rs,!1,!0),this.splashQuad.visible=!1,e.add(this.quad),e.add(this.boardQuad),e.add(this.splashQuad),this.reset(0)}reset(e){this.state.x=Wt(e)-27,this.state.u=Pr,this.state.speed=Hi,this.runSpeed=0,this.state.heading=0,this.state.airborne=!1,this.state.insideBarrel=!1,this.state.wipedOut=!1,this.state.pose="idle",this.previousX=this.state.x,this.previousU=this.state.u,this.pumpCooldown=0,this.wipeoutTimer=0,this.caughtTimer=0,this.landingTimer=0,this.airTimer=0,this.barrelSeconds=0,this.cutbackArmed=!1,this.cutbackCooldown=0,this.snapArmed=!1,this.exitTimer=0,this.state.barrelPhase="open",this.state.coverage=0,this.boardQuad.visible=!1}setFrozen(e){this.freezePhysics=e}drainEvents(){return this.events.splice(0,this.events.length)}step(e,t,n){this.previousX=this.state.x,this.previousU=this.state.u;const s=this.state;if(s.distance=Wt(t)-s.x,s.wipedOut){this.wipeoutTimer-=e,s.x+=Hi*.6*e,this.wipeoutTimer<=0&&!this.freezePhysics&&this.reset(t);return}if(this.freezePhysics){s.x=Wt(t)-27,s.pose="idle";return}Si(s.x,s.u,t,this.sample),this.pumpCooldown=Math.max(0,this.pumpCooldown-e),this.pumpAnim=Math.max(0,this.pumpAnim-e),this.landingTimer=Math.max(0,this.landingTimer-e);const r=Zt((18-s.distance)/12,0,1),o=n.steer*-6.5-r*4;if(s.airborne)this.airTimer+=e,this.airVelocityY-=9.8*e,this.airY+=this.airVelocityY*e,s.u=Zt(s.u-.35*e,al+.08,ol),Si(s.x,s.u,t,this.sample),this.airVelocityY<0&&this.airY<=this.sample.position.y&&(s.airborne=!1,this.landingTimer=.45,this.sample.phase>1?this.wipeout("landed in the foam"):(this.events.push({type:"air"}),this.airTimer>.35&&this.events.push({type:"clean-landing"})));else{const c=s.u,h=(.35+Zt((this.runSpeed+4)/12,0,1)*.385)*Xe;s.u+=((h-s.u)*1.1+n.climb*.95)*e,s.u=Zt(s.u,al,ol+.04);const u=Math.max(0,c-s.u);this.runSpeed+=u*(6+Zt(this.sample.steepness,0,3)*4),n.pump&&this.pumpCooldown<=0&&s.u>ll&&s.u<Sg&&(this.runSpeed+=6,this.pumpCooldown=.35,this.pumpAnim=.4),this.runSpeed+=(o-this.runSpeed)*2*e,this.runSpeed=Zt(this.runSpeed,-8,13),s.speed=Hi+this.runSpeed,(s.u>Eg&&n.climb>0&&this.runSpeed>.5||s.u>cl&&n.pump&&this.pumpCooldown>.3)&&(s.airborne=!0,this.airTimer=0,this.airY=this.sample.position.y,this.airVelocityY=2.6+Math.min(4,this.runSpeed*.12),this.grabAir=this.runSpeed>7,this.events.push({type:"takeoff"}))}s.heading=this.runSpeed<-.8?-.9:0,s.run=this.runSpeed,s.x+=s.speed*e;const a=s.distance>sn+3&&s.distance<rn-2;s.insideBarrel=!s.airborne&&a&&s.u>ll&&s.u<yg,s.insideBarrel&&(this.barrelSeconds+=e),this.cutbackCooldown=Math.max(0,this.cutbackCooldown-e),this.runSpeed<-3&&(this.cutbackArmed=!0),this.cutbackArmed&&this.runSpeed>1&&this.cutbackCooldown<=0&&(this.cutbackArmed=!1,this.cutbackCooldown=1.5,this.events.push({type:"cutback"})),!s.airborne&&s.u>cl&&(this.snapArmed=!0,this.snapClock=0),this.snapArmed&&(this.snapClock+=e,s.u<Tg&&this.snapClock<1.1&&(this.snapArmed=!1,this.events.push({type:"snap"})),this.snapClock>=1.1&&(this.snapArmed=!1));const l=s.x<Vs(t)-1;this.caughtTimer=l?this.caughtTimer+e:0,this.updateBarrelPhase(e,t),this.caughtTimer>.5&&this.wipeout("caught by the foam"),s.pose=this.choosePose(n)}choosePose(e){const t=this.state;return t.wipedOut?"wipeout":t.airborne?this.airTimer<.15?"takeoff":this.grabAir?"grab":"air":this.landingTimer>.25?"landing":this.landingTimer>0?"wobble":t.insideBarrel?"tuck":this.runSpeed<-2.5?"cutback":this.cutbackArmed&&this.runSpeed>-2.5?"rebound":this.pumpAnim>0?"pump":e.climb>0?t.u>bg?"topturn":"bottomturn":e.climb<0?"lowline":this.runSpeed>4?"pump":"idle"}updateBarrelPhase(e,t){const n=this.state,s=Ys(n.x,t),r=jl(s),o=za(s);n.coverage=Math.max(r*.5,o);const a=n.barrelPhase;this.exitTimer=Math.max(0,this.exitTimer-e);let l="open";n.x<Vs(t)?l="collapse":n.insideBarrel&&o>.9?l="tube":o>.05||r>.5?l="cover-up":r>0&&(l="pitching");const c=a==="tube"||a==="cover-up",h=l==="pitching"||l==="open";c&&h&&this.runSpeed>0&&(this.exitTimer=.7,this.barrelSeconds>=1.2&&this.events.push({type:"barrel",seconds:this.barrelSeconds}),this.barrelSeconds=0),h&&this.exitTimer>0&&!n.airborne&&(l="exit"),n.barrelPhase=l}forceWipeout(e){this.state.wipedOut||this.wipeout(e)}wipeout(e){this.state.wipeReason=e,this.events.push({type:"wipeout",reason:e}),this.barrelSeconds=0,this.state.wipedOut=!0,this.state.insideBarrel=!1,this.state.airborne=!1,this.state.barrelPhase="open",this.wipeoutTimer=1.9}render(e,t,n,s){const r=Kt.lerp(this.previousX,this.state.x,e),o=Kt.lerp(this.previousU,this.state.u,e);Si(r,o,n,this.sample),this.renderPosition.copy(this.sample.position),this.state.airborne&&(this.renderPosition.y=Math.max(this.renderPosition.y,this.airY)),this.renderPosition.z+=.15,this.toCamera.copy(s.position).sub(this.renderPosition),this.toCamera.x=0,this.toCamera.normalize(),this.quad.position.copy(this.renderPosition).addScaledVector(this.toCamera,1),this.quad.setDepthMode(this.state.wipedOut?"onTop":"scene"),this.ghostQuad.visible=!this.state.wipedOut,this.state.wipedOut?(this.tumble.set(Bi.wipeout),this.quad.setFrame(this.tumble.advance(t))):(this.tumble.set(Bi.idle),this.cycle.set(Bi[this.state.pose]),this.quad.setFrame(this.cycle.advance(t))),this.quad.setFlip(this.state.heading<-.45),this.state.heading;const a=this.state.wipedOut||this.state.insideBarrel?0:Zt(Math.atan2(this.sample.normal.z,this.sample.normal.y)*.25,-.22,.22)*-1,l=Fs(s,s.position.distanceTo(this.quad.position),_t);this.quad.orient(s,l,a),this.ghostQuad.setFrame(this.quad.currentFrame),this.ghostQuad.setFlip(this.state.heading<-.45),this.ghostQuad.position.copy(this.quad.position),this.ghostQuad.quaternion.copy(this.quad.quaternion),this.ghostQuad.scale.copy(this.quad.scale),this.boardQuad.visible=this.state.wipedOut,this.state.wipedOut&&(this.boardQuad.position.set(this.renderPosition.x+1.2+(1.4-this.wipeoutTimer)*1.5,this.renderPosition.y+.4,this.renderPosition.z+.3),this.boardQuad.orient(s,l,-(1.4-this.wipeoutTimer)*2.2))}}class Ag{mesh;constructor(){const e=new Fn(900,900,180,180);e.rotateX(-Math.PI/2);const t=new Ct({uniforms:{time:{value:0}},side:Ht,vertexShader:`
        uniform float time;
        varying vec3 vWorldPosition;
        varying float vHeight;
        varying vec3 vNormal;

        vec3 gerstner(vec2 dir, float wavelength, float steepness, vec2 xz, float t, inout vec3 tangent, inout vec3 binormal) {
          float k = 6.28318 / wavelength;
          float c = sqrt(9.8 / k);
          vec2 d = normalize(dir);
          float f = k * (dot(d, xz) - c * t);
          float a = steepness / k;
          tangent += vec3(-d.x * d.x * steepness * sin(f), d.x * steepness * cos(f), -d.x * d.y * steepness * sin(f));
          binormal += vec3(-d.x * d.y * steepness * sin(f), d.y * steepness * cos(f), -d.y * d.y * steepness * sin(f));
          return vec3(d.x * a * cos(f), a * sin(f), d.y * a * cos(f));
        }

        void main() {
          vec3 p = position;
          vec3 tangent = vec3(1.0, 0.0, 0.0);
          vec3 binormal = vec3(0.0, 0.0, 1.0);
          vec2 xz = p.xz;
          p += gerstner(vec2(0.15, -1.0), 28.0, 0.12, xz, time, tangent, binormal);
          p += gerstner(vec2(-0.35, -1.0), 17.0, 0.10, xz, time, tangent, binormal);
          p += gerstner(vec2(0.6, -0.8), 9.0, 0.10, xz, time, tangent, binormal);
          p += gerstner(vec2(-0.7, -0.6), 4.0, 0.14, xz, time, tangent, binormal);
          vNormal = normalize(cross(binormal, tangent));
          vHeight = p.y;
          vWorldPosition = (modelMatrix * vec4(p, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,fragmentShader:`
        uniform float time;
        varying vec3 vWorldPosition;
        varying float vHeight;
        varying vec3 vNormal;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(41.31, 289.17))) * 43758.5453); }
        void main() {
          vec3 trough = vec3(0.043, 0.424, 0.510);
          vec3 lower = vec3(0.059, 0.557, 0.639);
          vec3 mid = vec3(0.114, 0.714, 0.788);
          vec3 upper = vec3(0.310, 0.882, 0.906);
          vec3 cream = vec3(1.0, 0.941, 0.690);
          float t = clamp(vHeight * 1.6 + 0.45, 0.0, 0.999);
          t += 0.08 * sin(vWorldPosition.x * 0.25 + time * 0.7);
          float band = floor(clamp(t, 0.0, 0.999) * 4.0);
          vec3 color = trough;
          if (band > 0.5) color = lower;
          if (band > 1.5) color = mid;
          if (band > 2.5) color = upper;
          vec3 sunDir = normalize(vec3(0.35, 0.28, -1.0));
          float facing = max(0.0, dot(normalize(vNormal), sunDir));
          float glitter = step(0.975, hash(floor(vec2(vWorldPosition.x * 1.6 - time * 4.0, vWorldPosition.z * 0.9)))) * smoothstep(0.55, 0.85, facing);
          float far = smoothstep(-60.0, -240.0, vWorldPosition.z);
          color = mix(color, cream, max(glitter, far * step(0.9, hash(floor(vec2(vWorldPosition.x * 0.7, vWorldPosition.z * 0.35 + time))))) );
          gl_FragColor = vec4(color, 1.0);
        }
      `});this.mesh=new bt(e,t),this.mesh.position.set(120,-.35,0)}update(e,t,n){this.mesh.material.uniforms.time.value=e,this.mesh.position.x=t,this.mesh.position.z=n}}class Rg{constructor(e,t){this.atlases=t;const n=new bt(new Ia(900,24,16),new Ct({side:wt,depthWrite:!1,vertexShader:`
          varying vec3 vDirection;
          void main() {
            vDirection = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,fragmentShader:`
          varying vec3 vDirection;
          void main() {
            vec3 lavender = vec3(0.490, 0.486, 0.812);
            vec3 pink = vec3(0.961, 0.486, 0.702);
            vec3 coral = vec3(1.0, 0.553, 0.451);
            vec3 peach = vec3(1.0, 0.745, 0.541);
            vec3 cream = vec3(1.0, 0.941, 0.690);
            float h = clamp(vDirection.y * 3.2 + 0.12, 0.0, 1.0);
            vec3 color = cream;
            if (h > 0.10) color = peach;
            if (h > 0.28) color = coral;
            if (h > 0.50) color = pink;
            if (h > 0.78) color = lavender;
            gl_FragColor = vec4(color, 1.0);
          }
        `}));n.renderOrder=-10,this.group.add(n);for(let s=0;s<3;s+=1){const r=this.add(t.obstacles,"gull-0",-80+s*120,18+s%2*8,-240-s*30,5+s*1.5,3.2);this.gulls.push(r)}e.add(this.group)}atlases;group=new zi;items=[];gulls=[];gullClock=0;add(e,t,n,s,r,o,a){const l=new Pn(e,t);l.material.depthWrite=!1,l.material.transparent=!0,this.group.add(l);const c={quad:l,x:n,y:s,z:r,drift:o,height:a};return this.items.push(c),c}setLevel(e){for(const n of this.items)this.gulls.includes(n)||(this.group.remove(n.quad),n.quad.geometry.dispose(),n.quad.material.dispose());this.items.length=0,this.items.push(...this.gulls);const t=[...e.backdrop].sort((n,s)=>n.z-s.z);for(const n of t){if(!("strip"in n)){this.add(this.atlases[n.atlas],n.frame,n.x,n.y,n.z,n.drift??0,n.height);continue}const s=this.atlases[n.atlas];let r=n.x0,o=0;for(;r<n.x1;){const a=n.frames[o%n.frames.length],l=s.frame(a),c=l.w/l.h*n.height;this.add(s,a,r+c/2,n.y,n.z,0,n.height),r+=c+(n.gap??0),o+=1}}}update(e,t,n){this.group.position.x=n.position.x,this.group.position.z=n.position.z,this.gullClock+=e;const s=`gull-${Math.floor(this.gullClock*9)%9}`;for(const r of this.gulls)r.quad.setFrame(s);for(const r of this.items){const o=(r.x+r.drift*t+300)%600-300;r.quad.position.set(o,r.y,r.z),r.quad.orientWorld(n,r.height)}}}const Cg=168,Dr=16,hl={E2:82.41,G2:98,A2:110,B2:123.47,D3:146.83,E3:164.81,G3:196,A3:220,B3:246.94,D4:293.66,E4:329.63,G4:392,A4:440,B4:493.88,D5:587.33,E5:659.25,G5:783.99},ul=["E","E","E","E","A","A","E","E","B","A","E","B"],Pg={E:["E2","E2","B2","E2","D3","E2","B2","G2"],A:["A2","A2","E3","A2","G3","A2","E3","D3"],B:["B2","B2","B2","A2","G2","A2","B2","D3"]},Dg={E:["E5","E5","E5","E5","D5","D5","B4","B4","G4","G4","A4","A4","B4","","D5","B4"],A:["A4","A4","A4","A4","G4","G4","E4","E4","D4","D4","E4","E4","G4","","A4","G4"],B:["B4","B4","B4","B4","A4","A4","G4","G4","E4","E4","G4","G4","A4","","B4","D5"]},Lg=["E5","G5","E5","D5","B4","D5","B4","A4","G4","A4","B4","D5","E5","","E5",""];class Ug{constructor(e,t){this.context=e,this.filter=e.createBiquadFilter(),this.filter.type="lowpass",this.filter.frequency.value=9e3,this.output=e.createGain(),this.output.gain.value=.28,this.filter.connect(this.output).connect(t),this.noise=e.createBuffer(1,e.sampleRate*.5,e.sampleRate);const n=this.noise.getChannelData(0);for(let s=0;s<n.length;s+=1)n[s]=Math.random()*2-1;this.nextTime=e.currentTime+.1,window.setInterval(()=>this.schedule(),40)}context;output;filter;noise;step=0;nextTime=0;scene="menu";lap=0;setScene(e){if(e===this.scene)return;this.scene=e;const t=this.context.currentTime;this.output.gain.setTargetAtTime(e==="ride"?.28:e==="menu"?.16:.1,t,.2),this.filter.frequency.setTargetAtTime(e==="paused"?500:9e3,t,.2)}setTube(e){this.scene!=="paused"&&this.filter.frequency.setTargetAtTime(e?900:9e3,this.context.currentTime,.15)}schedule(){const e=60/Cg/4;for(;this.nextTime<this.context.currentTime+.18;)this.play(this.step,this.nextTime,e),this.step+=1,this.step>=ul.length*Dr&&(this.step=0,this.lap+=1),this.nextTime+=e}tone(e,t,n,s,r,o=0){const a=this.context.createOscillator();if(a.type=s,a.frequency.setValueAtTime(e,t),o>0){const c=this.context.createOscillator();c.frequency.value=6;const h=this.context.createGain();h.gain.value=o,c.connect(h).connect(a.frequency),c.start(t),c.stop(t+n)}const l=this.context.createGain();l.gain.setValueAtTime(1e-4,t),l.gain.linearRampToValueAtTime(r,t+.008),l.gain.setValueAtTime(r,t+n*.6),l.gain.exponentialRampToValueAtTime(1e-4,t+n),a.connect(l).connect(this.filter),a.start(t),a.stop(t+n+.02)}hit(e,t,n,s){const r=this.context.createBufferSource();r.buffer=this.noise;const o=this.context.createBiquadFilter();o.type="highpass",o.frequency.value=s;const a=this.context.createGain();a.gain.setValueAtTime(n,e),a.gain.exponentialRampToValueAtTime(1e-4,e+t),r.connect(o).connect(a).connect(this.filter),r.start(e),r.stop(e+t)}play(e,t,n){const s=Math.floor(e/Dr),r=e%Dr,o=ul[s];r%8===0&&this.tone(70,t,.12,"sine",.5),r%8===4&&this.hit(t,.12,.35,1800),r%2===0&&this.hit(t,.03,.12,7e3),r%2===0&&this.tone(hl[Pg[o][r/2]],t,n*1.8,"triangle",.55);const l=this.lap%2===1&&s>=8?Lg[r]:Dg[o][r];l&&this.tone(hl[l],t,n*.9,"square",.12,r%4===0?0:3)}}class Ig{muted=!1;context=null;master=null;music=null;bed=null;bedFilter=null;unlock(){if(this.context)return;const e=window.AudioContext;e&&(this.context=new e,this.master=this.context.createGain(),this.master.gain.value=this.muted?0:.6,this.master.connect(this.context.destination),this.startBed(),this.music=new Ug(this.context,this.master))}setScene(e){this.music?.setScene(e)}setMuted(e){this.muted=e,this.master&&this.context&&this.master.gain.setTargetAtTime(e?0:.6,this.context.currentTime,.05)}startBed(){if(!this.context||!this.master)return;const t=this.context.createBuffer(1,this.context.sampleRate*4,this.context.sampleRate),n=t.getChannelData(0);let s=0;for(let o=0;o<n.length;o+=1){const a=Math.random()*2-1;s=(s+.02*a)/1.02,n[o]=s*3.5}this.bed=this.context.createBufferSource(),this.bed.buffer=t,this.bed.loop=!0,this.bedFilter=this.context.createBiquadFilter(),this.bedFilter.type="lowpass",this.bedFilter.frequency.value=700;const r=this.context.createGain();r.gain.value=.35,this.bed.connect(this.bedFilter).connect(r).connect(this.master),this.bed.start()}setTube(e){!this.bedFilter||!this.context||(this.bedFilter.frequency.setTargetAtTime(e?220:700,this.context.currentTime,.15),this.music?.setTube(e))}blip(e,t,n,s,r=0){if(!this.context||!this.master||this.muted)return;const o=this.context.currentTime,a=this.context.createOscillator();a.type=n,a.frequency.setValueAtTime(e,o),r!==0&&a.frequency.exponentialRampToValueAtTime(Math.max(30,e+r),o+t);const l=this.context.createGain();l.gain.setValueAtTime(s,o),l.gain.exponentialRampToValueAtTime(.001,o+t),a.connect(l).connect(this.master),a.start(o),a.stop(o+t)}pump(){this.blip(180,.18,"sawtooth",.12,220)}trick(e){this.blip(520+e*140,.16,"square",.14,300),this.blip(780+e*140,.22,"square",.1,400)}wipeout(){this.blip(120,.5,"triangle",.35,-80),this.blip(60,.6,"sine",.4,-30)}stamp(){this.blip(660,.12,"square",.12,200)}}const Fg="https://www.quiversurf.app";class Ng{constructor(e,t){this.game=t,this.root=document.createElement("section"),this.root.id="lead",this.root.hidden=!0,this.root.innerHTML=`
      <div class="lead-card">
        <div class="lead-actions">
          <button type="button" data-action="again">PLAY AGAIN</button>
          <button type="button" data-action="challenge">CHALLENGE A FRIEND</button>
          <button type="button" data-action="next" hidden>NEXT BREAK</button>
        </div>
        <h2>GET THE REAL ONE</h2>
        <p>Quiver finds your surf window at your home break: swell, wind, tide, and what the crew saw this morning.</p>
        <div class="lead-funnel">
          <a class="lead-primary" data-link="sign-up" target="_blank" rel="noopener">CREATE A FREE ACCOUNT</a>
          <a class="lead-link" data-link="app" target="_blank" rel="noopener">GET THE APP</a>
        </div>
        <p class="lead-signin">ALREADY ON QUIVER? <a data-link="sign-in" target="_blank" rel="noopener">SIGN IN</a></p>
        <div class="lead-status" aria-live="polite"></div>
      </div>`,e.append(this.root),this.status=this.root.querySelector(".lead-status"),this.nextButton=this.root.querySelector('[data-action="next"]'),this.signUp=this.root.querySelector('[data-link="sign-up"]'),this.signIn=this.root.querySelector('[data-link="sign-in"]'),this.getApp=this.root.querySelector('[data-link="app"]'),this.root.querySelector('[data-action="again"]')?.addEventListener("click",()=>this.onPlayAgain());for(const n of Array.from(this.root.querySelectorAll("a[data-link]")))n.addEventListener("click",()=>bn.track("funnel_click",{target:n.dataset.link??"",level:this.game.levelDef.id,score:Math.floor(this.game.score)}));this.nextButton.addEventListener("click",()=>this.onNextLevel()),this.root.querySelector('[data-action="challenge"]')?.addEventListener("click",()=>{const n=new Promise(s=>setTimeout(()=>s("failed"),1500));Promise.race([this.onChallenge(),n]).then(s=>{this.status.textContent=s==="copied"?"CHALLENGE LINK COPIED. SEND IT TO A FRIEND.":s==="shared"?"CHALLENGE SENT.":"COPY THIS LINK: "+this.challengeUrl()})})}game;root;status;nextButton;signUp;signIn;getApp;onPlayAgain=()=>{};onChallenge=async()=>"failed";onNextLevel=()=>{};quiverUrl(e){const t=new URL(e,Fg);return t.searchParams.set("utm_source",Vl),t.searchParams.set("utm_medium","game"),t.searchParams.set("utm_campaign",this.game.levelDef.id),t.searchParams.set("utm_content",`score-${Math.floor(this.game.score)}`),t.toString()}challengeUrl(){const e=new URL(window.location.href);return e.searchParams.set("c",ec(this.game.seed,this.game.score)),e.searchParams.set("level",this.game.levelDef.id),e.toString()}show(){this.root.hidden=!1;const e=this.game.nextLevel,t=e!==null&&this.game.unlocked>this.game.level;this.nextButton.hidden=!t,e&&t&&(this.nextButton.textContent=`SURF ${e.name}`),this.signUp.href=this.quiverUrl("/auth/sign-up"),this.signIn.href=this.quiverUrl("/auth/sign-in"),this.getApp.href=this.quiverUrl("/download")}hide(){this.root.hidden=!0,this.status.textContent=""}}const pi=700;class Og{points;positions=new Float32Array(pi*3);velocities=new Float32Array(pi*3);life=new Float32Array(pi);sample={position:new F,normal:new F,phase:0,steepness:0};cursor=0;randomState=305441741;constructor(){const e=new It;e.setAttribute("position",new gt(this.positions,3).setUsage(xi));const t=new Ct({transparent:!1,depthWrite:!0,vertexShader:`
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(90.0 / -mv.z, 1.5, 4.0);
          gl_Position = projectionMatrix * mv;
        }
      `,fragmentShader:`
        void main() {
          vec2 d = abs(gl_PointCoord - vec2(0.5));
          if (max(d.x, d.y) > 0.5) discard;
          gl_FragColor = vec4(0.973, 0.996, 1.0, 1.0);
        }
      `});this.points=new qh(e,t),this.points.frustumCulled=!1;for(let n=0;n<pi;n+=1)this.positions[n*3+1]=-100}random(){return this.randomState^=this.randomState<<13,this.randomState^=this.randomState>>>17,this.randomState^=this.randomState<<5,(this.randomState>>>0)/4294967296}spawn(e,t,n,s,r,o){const a=this.cursor,l=a*3;this.positions[l]=e,this.positions[l+1]=t,this.positions[l+2]=n,this.velocities[l]=s,this.velocities[l+1]=r,this.velocities[l+2]=o,this.life[a]=.5+this.random()*.3,this.cursor=(a+1)%pi}lastRun=0;burst(e){for(let t=0;t<26;t+=1)this.spawn(e.x+(this.random()-.5)*.8,e.y+this.random()*.4,e.z+(this.random()-.5)*.4,(this.random()-.3)*4,2+this.random()*4,(this.random()-.5)*3)}update(e,t,n,s,r,o,a=0){for(let h=0;h<4;h+=1){const u=Wt(t)-sn-2-this.random()*14;Si(u,Ba+.02,t,this.sample),this.spawn(this.sample.position.x,this.sample.position.y+.1,this.sample.position.z,(this.random()-.5)*2,.8+this.random()*2.2,1.5+this.random()*2.5)}const l=Math.abs(a-this.lastRun)>.02&&Math.abs(a)>2,c=Math.sign(a)!==Math.sign(this.lastRun)&&Math.abs(a-this.lastRun)>1.5;if(l)for(let h=0;h<4;h+=1)this.spawn(o.x,o.y+.1,o.z,-a*.4+(this.random()-.5)*2,1.5+this.random()*2.5,1+this.random()*2.5);if(c)for(let h=0;h<40;h+=1)this.spawn(o.x,o.y+.2,o.z,(this.random()-.5)*8,2+this.random()*4,1+this.random()*4);if(Math.abs(s)>.2&&r>6)for(let h=0;h<3;h+=1)this.spawn(o.x,o.y,o.z,-r*.15+this.random(),1.2+this.random()*2,(this.random()-.3)*3);this.lastRun=a;for(let h=0;h<pi;h+=1){if(this.life[h]<=0)continue;const u=h*3;this.life[h]-=e,this.velocities[u+1]-=9.8*e,this.positions[u]+=this.velocities[u]*e,this.positions[u+1]+=this.velocities[u+1]*e,this.positions[u+2]+=this.velocities[u+2]*e,this.life[h]<=0&&(this.positions[u+1]=-100)}this.points.geometry.attributes.position.needsUpdate=!0}}const Lr=1200;class Bg{lines;visible=!1;positions=new Float32Array(Lr*6);colors=new Float32Array(Lr*6);count=0;profile={z:0,y:0,phase:0};a=new F;b=new F;constructor(e){const t=new It;t.setAttribute("position",new gt(this.positions,3).setUsage(xi)),t.setAttribute("color",new gt(this.colors,3).setUsage(xi));const n=new Fl({vertexColors:!0,depthTest:!1,depthWrite:!1,transparent:!0});this.lines=new Wh(t,n),this.lines.renderOrder=20,this.lines.frustumCulled=!1,this.lines.visible=!1,e.add(this.lines)}segment(e,t,n,s,r,o,a){if(this.count>=Lr)return;const l=this.count*6;this.positions.set([e,t,n,s,r,o],l),this.colors.set([a.r,a.g,a.b,a.r,a.g,a.b],l),this.count+=1}profileCurve(e,t,n,s,r,o=10){for(let a=0;a<o;a+=1)en(e,t+(n-t)*a/o,s,this.profile),this.a.set(e,this.profile.y,this.profile.z),en(e,t+(n-t)*(a+1)/o,s,this.profile),this.b.set(e,this.profile.y,this.profile.z),this.segment(this.a.x,this.a.y,this.a.z,this.b.x,this.b.y,this.b.z,r)}axisCurve(e,t,n,s,r,o=2){for(let a=e;a<t;a+=o)en(a,n,s,this.profile),this.a.set(a,this.profile.y,this.profile.z),en(Math.min(t,a+o),n,s,this.profile),this.b.set(Math.min(t,a+o),this.profile.y,this.profile.z),this.segment(this.a.x,this.a.y,this.a.z,this.b.x,this.b.y,this.b.z,r)}patch(e,t,n,s,r,o){this.profileCurve(e,n,s,r,o),this.profileCurve(t,n,s,r,o),this.axisCurve(e,t,n,r,o),this.axisCurve(e,t,s,r,o),this.axisCurve(e,t,(n+s)/2,r,o)}update(e,t,n,s=1.1,r=1.7){if(this.lines.visible=this.visible,!this.visible)return;this.count=0;const o=Wt(e);this.patch(o-(rn-2),o-(sn+3),.28*Xe,.875*Xe,e,new ze("#3CFF7A"));let a=o-sn;for(let v=o-sn;v>o-rn;v-=.5)if(za(Ys(v,e))>.05){a=v;break}this.patch(o-rn,a,Ba,ql,e,new ze("#FF4FD8")),this.axisCurve(o-rn,a,Xl,e,new ze("#FF4FD8"));const l=Vs(e)-1,c=new ze("#FF5C6C");this.profileCurve(l,.02,Xe,e,c,14),en(l,0,e,this.profile),this.segment(l,this.profile.y,this.profile.z,l,this.profile.y+12,this.profile.z,c),this.segment(l,this.profile.y,this.profile.z,l,this.profile.y,this.profile.z+14,c);const h=new ze("#FFD447"),u=n.x,f=n.y,p=n.z;this.segment(u-s,f,p,u+s,f,p,h),this.segment(u-s,f+r,p,u+s,f+r,p,h),this.segment(u-s,f,p,u-s,f+r,p,h),this.segment(u+s,f,p,u+s,f+r,p,h);const _=this.lines.geometry;_.setDrawRange(0,this.count*2),_.attributes.position.needsUpdate=!0,_.attributes.color.needsUpdate=!0}}const Bt=i=>i.toFixed(6);function zg(){return new Ct({uniforms:{time:{value:0},waveHeight:{value:5},mouthX:{value:0},foamX:{value:0}},side:Ht,vertexShader:`
      attribute float phase;
      attribute float face;
      uniform float time;
      varying float vPhase;
      varying float vFace;
      varying vec3 vWorldPosition;

      void main() {
        vPhase = phase;
        vFace = face;
        vec3 p = position;
        // fine ripple across the face so the bands move; none on the lip so its edge stays crisp
        float onFace = 1.0 - smoothstep(${Bt(Xe-.03)}, ${Bt(Xe)}, face);
        float ripple = sin(p.x * 5.2 - time * 3.0 + face * 8.0) * 0.5 + sin(p.x * 2.1 + time * 1.7 - face * 5.0) * 0.5;
        p += normal * ripple * 0.035 * onFace;
        vWorldPosition = (modelMatrix * vec4(p, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,fragmentShader:`
      uniform float time;
      uniform float waveHeight;
      uniform float mouthX;
      uniform float foamX;
      varying float vPhase;
      varying float vFace;
      varying vec3 vWorldPosition;

      const float U_CREST = ${Bt(Xe)};
      const float U_CEILING = ${Bt(Gm)};
      const float U_TIP = ${Bt(Ba)};
      const float U_LIP_TOP = ${Bt(Xl)};
      const float U_PEAK = ${Bt(ql)};

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      float fbm(vec2 p) { return noise(p) * 0.55 + noise(p * 2.13 + 8.3) * 0.3 + noise(p * 4.31 + 19.1) * 0.15; }
      vec3 bandColor(float band, vec3 c0, vec3 c1, vec3 c2, vec3 c3, vec3 c4) {
        vec3 c = c0;
        if (band > 0.5) c = c1;
        if (band > 1.5) c = c2;
        if (band > 2.5) c = c3;
        if (band > 3.5) c = c4;
        return c;
      }

      void main() {
        vec3 trough = vec3(0.043, 0.424, 0.510);   // #0B6C82 tube interior / deep trough
        vec3 lower  = vec3(0.059, 0.557, 0.639);   // #0F8EA3 pocket shading
        vec3 mid    = vec3(0.114, 0.714, 0.788);   // #1DB6C9 main face
        vec3 upper  = vec3(0.310, 0.882, 0.906);   // #4FE1E7 sunlit water
        vec3 lip    = vec3(0.557, 0.969, 0.949);   // #8EF7F2 translucent lip highlight
        vec3 foamWhite = vec3(0.973, 0.996, 1.0);  // #F8FEFF
        vec3 foamCool  = vec3(0.902, 0.976, 1.0);  // #E6F9FF
        vec3 foamCyan  = vec3(0.718, 0.925, 0.973);// #B7ECF8
        vec3 foamBlue  = vec3(0.494, 0.816, 0.910);// #7ED0E8

        float x = vWorldPosition.x;
        float u = vFace;
        float height = clamp(vWorldPosition.y / max(0.1, waveHeight), -0.2, 1.3);
        float steep = smoothstep(0.35, ${Bt(Gs)}, vPhase);
        float pitch = smoothstep(${Bt(Gs)}, ${Bt(Yl)}, vPhase);
        float drop = smoothstep(${Bt($l)}, ${Bt(Kl)}, vPhase);
        float broken = smoothstep(1.0, 1.12, vPhase);
        bool onFace = u < U_CREST;
        bool onCeiling = u >= U_CREST && u < U_CEILING;
        bool onInnerCurtain = u >= U_CEILING && u < U_TIP;
        bool onOuterCurtain = u >= U_TIP && u < U_LIP_TOP;
        bool onRoll = u >= U_LIP_TOP && u < U_PEAK;
        vec2 px = floor(gl_FragCoord.xy);
        float sparse = step(0.5, 1.0 - min(1.0, mod(px.x + 2.0 * px.y, 4.0)));   // one pixel in four
        // distance into the tube from the mouth: light falls off along the axis
        float depthIn = clamp((mouthX - x) / 14.0, 0.0, 1.0);
        float tubeLight = 1.0 - depthIn * 0.7;

        vec3 color = mid;
        float clumps = fbm(vec2(x * 0.75 - time * 1.2, u * 22.0 + time * 0.3));
        float foamCoverage = 0.0;

        if (onFace) {
          // base tone by height up the face, then diagonal brush strokes sweeping up the wall like the sheet's tiles
          float f = u / U_CREST;
          float base = clamp(f * 0.9 + height * 0.1 - 0.05, 0.0, 0.999);
          float diag = x * 0.42 + f * 3.2 + 0.5 * sin(x * 0.25 + time * 0.5) + (noise(vec2(x * 0.2 - time * 0.35, f * 2.2)) - 0.5) * 1.2;
          float strokeShift = floor(fract(diag) * 3.0) - 1.0;
          // the rear wall inside the tube sits up to two bands darker (pocket shading), lifting toward the mouth
          float shade = pitch * (1.9 - 1.1 * tubeLight);
          float band = clamp(floor(base * 4.0) + strokeShift - shade, 0.0, 4.0);
          color = bandColor(band, trough, lower, mid, upper, lip);
          float edge = step(0.92, fract(diag)) * step(0.12, f);
          vec3 next = bandColor(band, lower, mid, upper, lip, foamCool);
          color = mix(color, next, edge * (1.0 - pitch * 0.6));
          // inside the tube the wall carries long streaks that follow the curve of the wall
          float wallStreak = step(0.74, noise(vec2(x * 0.6 - time * 1.8, f * 14.0))) * pitch;
          color = mix(color, band > 0.5 ? trough : lower, wallStreak * 0.85);
          // crest line: the top edge of the face catches the light before the lip throws
          float crestLine = smoothstep(0.92, 0.955, f) * (1.0 - smoothstep(0.98, 1.0, f));
          color = mix(color, lip, crestLine * smoothstep(0.35, 0.8, vPhase) * (1.0 - pitch));
          // feather of foam along the crest as the section steepens toward the mouth
          float feather = smoothstep(0.91, 0.96, f) * smoothstep(0.55, 0.78, vPhase) * (1.0 - pitch);
          foamCoverage = max(foamCoverage, feather * 0.55);
        } else if (onCeiling) {
          // ceiling of the tube: dark, saturated, with light streaks running along the axis
          float streak = step(0.76, noise(vec2(x * 0.7 - time * 2.2, u * 36.0)));
          color = mix(trough, lower, streak);
          color = mix(color, mid, smoothstep(0.55, 1.0, tubeLight) * 0.6);
        } else if (onInnerCurtain) {
          // inside of the curtain: backlit sheet, light coming through in bands toward the bottom
          float down = (u - U_CEILING) / (U_TIP - U_CEILING);
          float glow = step(0.66, noise(vec2(x * 0.5 - time * 1.4, down * 9.0)));
          color = mix(trough, lower, glow);
          color = mix(color, mid, glow * smoothstep(0.5, 1.0, down) * 0.6);
        } else if (onOuterCurtain) {
          // outer curtain: the translucent lip. Sunlit bands with diagonal highlight streaks; one pixel in
          // four is a hole so the dark tube shows through without ghosting the whole sheet
          float up = (u - U_TIP) / (U_LIP_TOP - U_TIP);   // 0 at the trough, 1 at the roll
          float band = clamp(floor(up * 2.0) + 1.0, 0.0, 4.0);
          color = bandColor(band, lower, mid, upper, lip, foamCool);
          float streak = step(0.74, noise(vec2((x + up * 5.0) * 0.9 - time * 1.2, up * 5.0)));
          color = mix(color, bandColor(band, mid, upper, lip, foamCool, foamCool), streak * (0.3 + up * 0.3));
          // see-through: every other pixel in the middle of a dropped curtain, one in four near its edges
          float checker = mod(px.x + px.y, 2.0);
          bool middle = up > 0.22 && up < 0.8;
          if (drop > 0.9 && ((middle && checker < 0.5) || (!middle && sparse > 0.5 && up > 0.08 && up < 0.92))) discard;
          // impact foam where the curtain lands; the roll above stays glassy
          foamCoverage = max(foamCoverage, (1.0 - smoothstep(0.08, 0.3, up)) * 0.6 * drop);
        } else if (onRoll) {
          // top of the lip roll: sunlit, foamed along the breaking edge
          float along = (u - U_LIP_TOP) / (U_PEAK - U_LIP_TOP);
          float band = clamp(floor(along * 2.0) + 1.0, 0.0, 4.0);
          color = bandColor(band, lower, mid, upper, lip, foamCool);
          float rollStreak = step(0.7, noise(vec2(x * 0.8 - time * 1.6, along * 6.0)));
          color = mix(color, bandColor(band, mid, upper, lip, foamCool, foamCool), rollStreak * 0.6);
          foamCoverage = max(foamCoverage, (1.0 - smoothstep(0.0, 0.3, along)) * 0.5 * pitch);
        } else {
          // back slope: inside the body or behind the crest
          color = mix(lower, trough, 0.5);
        }
        // the breaking edge: while the section is still pitching, the throwing tongue is a foamed roll
        float pitching = pitch * (1.0 - drop);
        if (onRoll) foamCoverage = max(foamCoverage, pitching * 0.6);
        if (onOuterCurtain) foamCoverage = max(foamCoverage, pitching * 0.45 * (1.0 - smoothstep(0.0, 0.6, (u - U_TIP) / (U_LIP_TOP - U_TIP))));
        if (onInnerCurtain) foamCoverage = max(foamCoverage, pitching * 0.25);

        // foam on the face after the section has closed, and the chase edge at the foam boundary
        float chase = 1.0 - smoothstep(0.0, 6.0, x - foamX);
        float foamNearTip = onOuterCurtain ? 1.0 - smoothstep(0.0, 0.5, (u - U_TIP) / (U_LIP_TOP - U_TIP)) : 0.0;
        float troughLine = (1.0 - smoothstep(0.02, 0.05, u)) * smoothstep(0.7, 0.9, vPhase);
        float coverage = max(max(broken, foamCoverage), max(troughLine * 0.6, chase * (onFace ? smoothstep(U_CREST - 0.2, U_CREST, u) : foamNearTip) * 0.8));
        float foam = max(step(0.58 - coverage * 0.32, clumps) * step(0.01, coverage), step(1.05, vPhase) * step(0.3, clumps));
        vec3 foamColor = foamBlue;
        if (clumps > 0.5) foamColor = foamCyan;
        if (clumps > 0.6) foamColor = foamCool;
        if (clumps > 0.7) foamColor = foamWhite;
        color = mix(color, foamColor, foam);

        // sparse sparkle on the open face
        float sparkle = step(0.985, hash(floor(vec2(x * 3.0 - time * 6.0, u * 40.0)))) * (1.0 - foam) * smoothstep(0.2, 0.5, u) * (1.0 - pitch) * float(onFace);
        color = mix(color, foamWhite, sparkle);
        gl_FragColor = vec4(color, 1.0);
      }
    `})}async function kg(){const i="https://9a9b828ed217cf8ae38f59b3e9fec9ab@o4510293516091392.ingest.us.sentry.io/4510293517205504",e=await dl(()=>import("./index-dTt6LNHL.js"),[]);e.init({dsn:i,environment:"production",release:"2489178",tracesSampleRate:0,replaysSessionSampleRate:0,replaysOnErrorSampleRate:0}),e.setTag("game","el-nino-swell")}Ve.enabled=!1;function ka(i){const e=document.querySelector("#app");if(!e)return;let t=document.querySelector("#fatal");t||(t=document.createElement("pre"),t.id="fatal",t.style.cssText="position:fixed;left:12px;top:12px;z-index:9;max-width:90vw;white-space:pre-wrap;font:12px/1.5 monospace;color:#F8FEFF;background:#D93B72;padding:10px 12px;border:2px solid #F8FEFF",e.append(t)),t.textContent+=`${i}
`}window.addEventListener("error",i=>ka(`error: ${i.message} @ ${i.filename}:${i.lineno}`));window.addEventListener("unhandledrejection",i=>ka(`rejection: ${String(i.reason?.message??i.reason)}`));async function Hg(){const i=document.querySelector("#app");if(!i)throw new Error("Missing #app");const e=document.createElement("div");if(e.id="loading",e.textContent=`LOADING ${Is}...`,e.style.cssText='position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);font:12px "Press Start 2P",monospace;color:#B8F1FF',i.append(e),!document.createElement("canvas").getContext("webgl2")&&!document.createElement("canvas").getContext("webgl"))throw new Error("WebGL is not available in this browser");const t=B=>{e.textContent=`LOADING ${Is}... ${B}`},n=(B,V,le)=>Promise.race([B,new Promise(ne=>setTimeout(()=>ne(le),V))]);t("FONT"),await n(document.fonts.load('16px "Press Start 2P"').catch(()=>[]),2500,[]),t("SPRITES");const[s,r,o,a,l,c]=await Promise.all([An.load("surfer"),An.load("water"),An.load("obstacles"),An.load("ui"),An.load("hawaii"),An.load("trestles")]),h={water:r,obstacles:o,hawaii:l,trestles:c};t("RENDERER");const u=new fg,f=new Im({antialias:!1,powerPreference:"high-performance"});f.setPixelRatio(1),f.outputColorSpace=Jn,f.autoClear=!1,f.setClearColor(16760458,1),i.append(f.domElement),t("PIPELINE");const p=new cg(f);u.attachPointer(f.domElement,(B,V)=>p.clientToTarget(B,V)),u.touchButtons=Sa,u.hudButtons=Cr,t("SCENE");const _=new Ua,v=new Rg(_,h),m=zg(),d=new $m(m);_.add(d.mesh);const w=new Ag;_.add(w.mesh);const T=new Og;_.add(T.points);const M=new wg(_,s),C=new Wi(_,h),R=new Km(Ie/_t),P=new dg(a),N=new URLSearchParams(window.location.search).has("debug"),E=new URLSearchParams(window.location.search).has("nohud"),S=new Zm(i),L=new Bg(_),k=document.createElement("div");k.id="diag",k.hidden=!new URLSearchParams(window.location.search).has("debug")||E,k.style.cssText="position:fixed;left:6px;bottom:4px;z-index:9;font:9px monospace;color:#B8F1FF;opacity:0.8;pointer-events:none",i.append(k);let X=0,Z="";window.addEventListener("error",B=>{Z=B.message});const Y={position:new F,normal:new F,phase:0,steepness:0},G={score:0,best:0,wave:1,waves:3,waveProgress:0,foamGap:1,timeLeft:90,muted:!1,flash:0,pierWarning:!1,touch:!1,levelName:"",help:!1,needsFocus:!1,paused:!1},A=new rg;v.setLevel(A.levelDef);let W=A.level;const ie=new Ig,ue=()=>{ie.unlock()};window.addEventListener("keydown",ue,{once:!0}),window.addEventListener("pointerdown",ue,{once:!0});const xe=new Ng(i,A);let Ne=!1,Ke=0,Qe="";const Ge={x:320,y:180},$=new F;let j=A.phase;const de=1/120;let he=8,ge=0,Be=performance.now()/1e3,lt=60,b=0,Ze=0,De=!1;window.__oneMoreWave={fps:lt,time:he,phase:0,distance:0,riderX:0,riderU:0,speed:0,pose:"idle",airborne:!1,insideBarrel:!1,wipedOut:!1,wipeReason:"",barrelPhase:"open",coverage:0,gamePhase:"title",wave:1,score:0,level:"pier",unlocked:0,ready:!1,trace:[]};function be(){he=8,ge=0,M.reset(he),M.drainEvents(),M.render(1,0,he,R.camera),R.snap(M.renderPosition,he)}function pe(B){Xm(B),m.uniforms.waveHeight.value=B}function qe(){A.startRun(),pe(A.waveHeight),be()}async function _e(){const B=new URL(window.location.href);B.searchParams.set("c",ec(A.seed,A.score)),B.searchParams.set("level",A.levelDef.id);const V=`I scored ${Math.floor(A.score)} in ${Is} at ${A.levelDef.name}. Same waves, same set. Beat it: ${B.toString()}`,le=await(async()=>{if(navigator.share)try{return await navigator.share({text:V,url:B.toString()}),"shared"}catch{}try{return await navigator.clipboard.writeText(V),"copied"}catch{return"failed"}})();return bn.track("challenge_share",{level:A.levelDef.id,score:Math.floor(A.score),outcome:le}),le}function Ue(){const B=window.__oneMoreWave;B.fps=lt,B.time=he,B.phase=Y.phase,B.distance=M.state.distance,B.riderX=M.state.x,B.riderU=M.state.u,B.speed=M.state.speed,B.pose=M.state.pose,B.airborne=M.state.airborne,B.insideBarrel=M.state.insideBarrel,B.wipedOut=M.state.wipedOut,B.wipeReason=M.state.wipeReason,B.barrelPhase=M.state.barrelPhase,B.coverage=M.state.coverage,B.gamePhase=A.phase,B.wave=A.wave,B.score=Math.floor(A.score),B.level=A.levelDef.id,B.unlocked=A.unlocked}let at=!1,nt=0;function y(){at=!1;const B=performance.now();if(B-nt<8){g();return}nt=B,O(B),g()}function g(){at||(at=!0,requestAnimationFrame(y))}window.setInterval(()=>{performance.now()-nt>40&&y()},16);function O(B){const V=B/1e3,le=Math.max(0,Math.min(.1,V-Be));Be=V,ge+=le,u.consumeRestart()&&be();const ne=u.consumeHeight();ne>0&&pe(ne),G.help&&u.consumeStart()?(G.help=!1,A.phase==="paused"&&A.togglePause()):u.consumeStart()&&(A.phase==="title"||A.phase==="results")?qe():u.consumeStart(),u.consumeChallenge()&&A.phase==="results"&&_e(),u.consumeLevel()&&(A.phase==="title"||A.phase==="results")&&A.cycleLevel(),u.consumeNextLevel()&&A.phase==="results"&&A.nextLevel&&A.selectLevel(A.level+1)&&qe(),A.phase==="advance"&&A.phaseClock>=Jm&&A.selectLevel(A.level+1)&&qe(),A.level!==W&&(W=A.level,v.setLevel(A.levelDef),pe(A.waveHeight),be()),u.hudButtons=A.phase==="title"?[...Cr,hg]:Cr,u.consumeFind()&&A.phase==="results"&&window.open(xe.quiverUrl("/auth/sign-up"),"_blank"),u.consumeMute()&&(G.muted=!G.muted,ie.setMuted(G.muted));const Me=u.consumeHelp();for(Me&&!G.help&&(A.phase==="riding"||A.phase==="paused")?(G.help=!0,A.phase==="riding"&&A.togglePause()):G.help&&(Me||u.consumePause()||A.phase!=="paused")?(G.help=!1,A.phase==="paused"&&A.togglePause()):u.consumePause()&&A.togglePause(),G.paused=A.phase==="paused",G.needsFocus=!u.sawKey&&!u.isTouch&&(A.phase==="riding"||A.phase==="countdown"),G.paused=A.phase==="paused",A.phase!==j&&(A.phase==="countdown"&&A.wave===1&&bn.track("game_start",{level:A.levelDef.id,challenge:A.challengeScore!==null}),A.phase==="wave-complete"&&!M.state.wipedOut&&bn.track("wave_complete",{level:A.levelDef.id,wave:A.wave}),(A.phase==="results"||A.phase==="advance")&&(bn.track("heat_end",{level:A.levelDef.id,score:Math.floor(A.score),waves:A.wave,tricks:A.stats.tricks,barrels:A.stats.barrels,best_combo:A.stats.bestCombo,longest_ride:Math.round(A.stats.longestRide),reason:A.lastWipeReason||"time"}),A.unlockedNow&&bn.track("break_unlocked",{level:A.unlockedNow.id})),A.phase==="countdown"&&(pe(A.waveHeight),be(),C.newWave(A.seed,A.wave-1,M.state.x,A.levelDef)),(A.phase==="title"||A.phase==="results")&&C.clear(),A.phase==="results"?xe.show():xe.hide(),j=A.phase),u.state.pump&&!Ne&&A.phase==="riding"&&ie.pump(),Ne=u.state.pump,M.setFrozen(A.phase!=="riding"&&A.phase!=="wipeout"),A.phase==="paused"&&(ge=0,Be=V),u.consumeDebugToggle()&&N&&(S.toggle(),L.visible=S.visible),u.consumeProfileToggle()&&(R.profileView=!R.profileView);ge>=de;)he+=de,M.step(de,he,u.state),ge-=de;const Ee=ge/de;d.update(he),m.uniforms.time.value=he,m.uniforms.mouthX.value=Zl(he),m.uniforms.foamX.value=Vs(he),M.render(Ee,le,he,R.camera),R.update(le,he,M.renderPosition,M.state.coverage,M.state.airborne,M.state.wipedOut),M.render(Ee,0,he,R.camera),w.update(he,R.camera.position.x,R.camera.position.z),v.update(le,he,R.camera),T.update(le,he,M.state.x,M.state.heading,M.state.speed,M.renderPosition,M.state.run),M.state.wipedOut&&!De&&(G.flash=.3),G.flash=Math.max(0,G.flash-le),De=M.state.wipedOut;const J=M.quad.scale.x*.3,oe=M.quad.scale.y*.85,we=C.update(le,he,M.state,M.renderPosition.y,J,oe,R.camera);we&&A.phase==="riding"&&window.__oneMoreWave.trace.push(`${he.toFixed(2)} hit ${we.reason} riderY=${M.renderPosition.y.toFixed(2)}`),we&&A.phase==="riding"&&M.forceWipeout(we.reason),G.pierWarning=A.phase==="riding"&&C.pierWarning,A.pierWarning=G.pierWarning,G.touch=u.isTouch,G.levelName=A.levelDef.name,$.copy(M.renderPosition).project(R.camera),Ge.x=Math.round(($.x+1)/2*Ie),Ge.y=Math.round((1-$.y)/2*_t)-40;const ve=M.drainEvents();for(const Te of ve)Te.type==="wipeout"?bn.track("wipeout",{level:A.levelDef.id,wave:A.wave,reason:Te.reason}):Te.type!=="takeoff"&&bn.track("trick",{level:A.levelDef.id,type:Te.type});for(const Te of ve)window.__oneMoreWave.trace.push(`${he.toFixed(2)} ${Te.type}${Te.type==="wipeout"?":"+Te.reason:""}`);if(ve.some(Te=>Te.type==="takeoff")&&T.burst(M.renderPosition),A.update(le,M.state,ve,Ge),A.popups.length>Ke){const Te=A.popups[A.popups.length-1];window.__oneMoreWave.trace.push(`${he.toFixed(2)} popup ${Te.frame}`),Te.frame==="popup-4"?ie.wipeout():ie.trick(Math.min(3,A.combo))}Ke=A.popups.length;const re=A.stamp?.frame??"";re&&re!==Qe&&ie.stamp(),Qe=re,ie.setTube(M.state.insideBarrel&&A.phase==="riding"),ie.setScene(A.phase==="riding"||A.phase==="countdown"||A.phase==="wipeout"?"ride":A.phase==="paused"?"paused":"menu"),G.score=A.score,G.best=A.best,G.wave=A.wave,G.waveProgress=Math.min(1,A.waveClock/26),G.foamGap=Math.max(0,Math.min(1,(rn-M.state.distance)/24)),G.timeLeft=A.timeLeft,P.draw(G,A),p.beginScene(),f.render(_,R.camera),E||f.render(P.scene,P.camera),p.present(),X+=1,X%15===0&&(k.textContent=`f=${X} dt=${le.toFixed(3)} phase=${A.phase} pc=${A.phaseClock.toFixed(2)} hidden=${document.hidden} ${Z}`),b+=1,Ze+=le,Ze>=.5&&(lt=b/Ze,b=0,Ze=0),Si(M.state.x,M.state.u,he,Y),S.update(M.state,Y.phase,lt),L.update(he,M.state,M.renderPosition,J,oe),Ue()}window.addEventListener("resize",()=>p.resize(window.innerWidth,window.innerHeight));const q=()=>{const B=u.isTouch&&window.innerHeight>window.innerWidth;document.body.classList.toggle("portrait",B),B&&A.phase==="riding"&&A.togglePause()};window.addEventListener("resize",q),q(),xe.onPlayAgain=qe,xe.onChallenge=_e,xe.onNextLevel=()=>{A.nextLevel&&A.selectLevel(A.level+1)&&qe()},window.__debug={scene:_,rider:M,camera:R.camera,sky:v,game:A,obstacles:C,sound:ie,hudState:G,input:u},be(),d.update(he),e.remove(),f.domElement.focus(),window.__oneMoreWave.ready=!0,g()}kg().catch(()=>{});Hg().catch(i=>ka(`boot: ${String(i?.stack??i)}`));
