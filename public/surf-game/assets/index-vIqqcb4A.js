(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))n(s);new MutationObserver(s=>{for(const r of s)if(r.type==="childList")for(const o of r.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&n(o)}).observe(document,{childList:!0,subtree:!0});function t(s){const r={};return s.integrity&&(r.integrity=s.integrity),s.referrerPolicy&&(r.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?r.credentials="include":s.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function n(s){if(s.ep)return;s.ep=!0;const r=t(s);fetch(s.href,r)}})();const oc="modulepreload",lc=function(i){return"/surf-game/"+i},Ya={},dl=function(e,t,n){let s=Promise.resolve();if(t&&t.length>0){let c=function(h){return Promise.all(h.map(d=>Promise.resolve(d).then(f=>({status:"fulfilled",value:f}),f=>({status:"rejected",reason:f}))))};var o=c;document.getElementsByTagName("link");const a=document.querySelector("meta[property=csp-nonce]"),l=a?.nonce||a?.getAttribute("nonce");s=c(t.map(h=>{if(h=lc(h),h in Ya)return;Ya[h]=!0;const d=h.endsWith(".css"),f=d?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${h}"]${f}`))return;const p=document.createElement("link");if(p.rel=d?"stylesheet":oc,d||(p.as="script"),p.crossOrigin="",p.href=h,l&&p.setAttribute("nonce",l),document.head.appendChild(p),d)return new Promise((_,v)=>{p.addEventListener("load",_),p.addEventListener("error",()=>v(new Error(`Unable to preload CSS for ${h}`)))})}))}function r(a){const l=new Event("vite:preloadError",{cancelable:!0});if(l.payload=a,window.dispatchEvent(l),!l.defaultPrevented)throw a}return s.then(a=>{for(const l of a||[])l.status==="rejected"&&r(l.reason);return e().catch(r)})};const Ea="180",cc=0,$a=1,hc=2,fl=1,uc=2,fn=3,Un=0,wt=1,Vt=2,Dn=0,vi=1,Ka=2,ja=3,Za=4,dc=5,qn=100,fc=101,pc=102,mc=103,gc=104,_c=200,vc=201,xc=202,Sc=203,Ur=204,Ir=205,Mc=206,Ec=207,yc=208,Tc=209,bc=210,wc=211,Ac=212,Rc=213,Cc=214,Fr=0,Nr=1,Or=2,Zn=3,Br=4,zr=5,Ns=6,kr=7,pl=0,Pc=1,Dc=2,Ln=0,Lc=1,Uc=2,Ic=3,Fc=4,Nc=5,Oc=6,Bc=7,ml=300,Ei=301,yi=302,Hr=303,Gr=304,Xs=306,Vr=1e3,Kn=1001,Wr=1002,ht=1003,zc=1004,is=1005,sn=1006,js=1007,jn=1008,gn=1009,gl=1010,_l=1011,Xi=1012,ya=1013,Jn=1014,pn=1015,Zi=1016,Ta=1017,ba=1018,qi=1020,vl=35902,xl=35899,Sl=1021,Ml=1022,Wt=1023,Yi=1026,$i=1027,El=1028,wa=1029,yl=1030,Aa=1031,Ra=1033,Cs=33776,Ps=33777,Ds=33778,Ls=33779,Xr=35840,qr=35841,Yr=35842,$r=35843,Kr=36196,jr=37492,Zr=37496,Jr=37808,Qr=37809,ea=37810,ta=37811,na=37812,ia=37813,sa=37814,ra=37815,aa=37816,oa=37817,la=37818,ca=37819,ha=37820,ua=37821,da=36492,fa=36494,pa=36495,ma=36283,ga=36284,_a=36285,va=36286,kc=3200,Hc=3201,Gc=0,Vc=1,Rn="",Ht="srgb",Qn="srgb-linear",Os="linear",Je="srgb",ti=7680,Ja=519,Wc=512,Xc=513,qc=514,Tl=515,Yc=516,$c=517,Kc=518,jc=519,Qa=35044,xi=35048,eo="300 es",rn=2e3,Bs=2001;class Ai{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});const n=this._listeners;n[e]===void 0&&(n[e]=[]),n[e].indexOf(t)===-1&&n[e].push(t)}hasEventListener(e,t){const n=this._listeners;return n===void 0?!1:n[e]!==void 0&&n[e].indexOf(t)!==-1}removeEventListener(e,t){const n=this._listeners;if(n===void 0)return;const s=n[e];if(s!==void 0){const r=s.indexOf(t);r!==-1&&s.splice(r,1)}}dispatchEvent(e){const t=this._listeners;if(t===void 0)return;const n=t[e.type];if(n!==void 0){e.target=this;const s=n.slice(0);for(let r=0,o=s.length;r<o;r++)s[r].call(this,e);e.target=null}}}const xt=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];let to=1234567;const Gi=Math.PI/180,Ki=180/Math.PI;function Ri(){const i=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(xt[i&255]+xt[i>>8&255]+xt[i>>16&255]+xt[i>>24&255]+"-"+xt[e&255]+xt[e>>8&255]+"-"+xt[e>>16&15|64]+xt[e>>24&255]+"-"+xt[t&63|128]+xt[t>>8&255]+"-"+xt[t>>16&255]+xt[t>>24&255]+xt[n&255]+xt[n>>8&255]+xt[n>>16&255]+xt[n>>24&255]).toLowerCase()}function Ge(i,e,t){return Math.max(e,Math.min(t,i))}function Ca(i,e){return(i%e+e)%e}function Zc(i,e,t,n,s){return n+(i-e)*(s-n)/(t-e)}function Jc(i,e,t){return i!==e?(t-i)/(e-i):0}function Vi(i,e,t){return(1-t)*i+t*e}function Qc(i,e,t,n){return Vi(i,e,1-Math.exp(-t*n))}function eh(i,e=1){return e-Math.abs(Ca(i,e*2)-e)}function th(i,e,t){return i<=e?0:i>=t?1:(i=(i-e)/(t-e),i*i*(3-2*i))}function nh(i,e,t){return i<=e?0:i>=t?1:(i=(i-e)/(t-e),i*i*i*(i*(i*6-15)+10))}function ih(i,e){return i+Math.floor(Math.random()*(e-i+1))}function sh(i,e){return i+Math.random()*(e-i)}function rh(i){return i*(.5-Math.random())}function ah(i){i!==void 0&&(to=i);let e=to+=1831565813;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}function oh(i){return i*Gi}function lh(i){return i*Ki}function ch(i){return(i&i-1)===0&&i!==0}function hh(i){return Math.pow(2,Math.ceil(Math.log(i)/Math.LN2))}function uh(i){return Math.pow(2,Math.floor(Math.log(i)/Math.LN2))}function dh(i,e,t,n,s){const r=Math.cos,o=Math.sin,a=r(t/2),l=o(t/2),c=r((e+n)/2),h=o((e+n)/2),d=r((e-n)/2),f=o((e-n)/2),p=r((n-e)/2),_=o((n-e)/2);switch(s){case"XYX":i.set(a*h,l*d,l*f,a*c);break;case"YZY":i.set(l*f,a*h,l*d,a*c);break;case"ZXZ":i.set(l*d,l*f,a*h,a*c);break;case"XZX":i.set(a*h,l*_,l*p,a*c);break;case"YXY":i.set(l*p,a*h,l*_,a*c);break;case"ZYZ":i.set(l*_,l*p,a*h,a*c);break;default:console.warn("THREE.MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+s)}}function gi(i,e){switch(e.constructor){case Float32Array:return i;case Uint32Array:return i/4294967295;case Uint16Array:return i/65535;case Uint8Array:return i/255;case Int32Array:return Math.max(i/2147483647,-1);case Int16Array:return Math.max(i/32767,-1);case Int8Array:return Math.max(i/127,-1);default:throw new Error("Invalid component type.")}}function yt(i,e){switch(e.constructor){case Float32Array:return i;case Uint32Array:return Math.round(i*4294967295);case Uint16Array:return Math.round(i*65535);case Uint8Array:return Math.round(i*255);case Int32Array:return Math.round(i*2147483647);case Int16Array:return Math.round(i*32767);case Int8Array:return Math.round(i*127);default:throw new Error("Invalid component type.")}}const jt={DEG2RAD:Gi,RAD2DEG:Ki,generateUUID:Ri,clamp:Ge,euclideanModulo:Ca,mapLinear:Zc,inverseLerp:Jc,lerp:Vi,damp:Qc,pingpong:eh,smoothstep:th,smootherstep:nh,randInt:ih,randFloat:sh,randFloatSpread:rh,seededRandom:ah,degToRad:oh,radToDeg:lh,isPowerOfTwo:ch,ceilPowerOfTwo:hh,floorPowerOfTwo:uh,setQuaternionFromProperEuler:dh,normalize:yt,denormalize:gi};class Ke{constructor(e=0,t=0){Ke.prototype.isVector2=!0,this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){const t=this.x,n=this.y,s=e.elements;return this.x=s[0]*t+s[3]*n+s[6],this.y=s[1]*t+s[4]*n+s[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=Ge(this.x,e.x,t.x),this.y=Ge(this.y,e.y,t.y),this}clampScalar(e,t){return this.x=Ge(this.x,e,t),this.y=Ge(this.y,e,t),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Ge(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const n=this.dot(e)/t;return Math.acos(Ge(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,n=this.y-e.y;return t*t+n*n}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){const n=Math.cos(t),s=Math.sin(t),r=this.x-e.x,o=this.y-e.y;return this.x=r*n-o*s+e.x,this.y=r*s+o*n+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}}class Ci{constructor(e=0,t=0,n=0,s=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=n,this._w=s}static slerpFlat(e,t,n,s,r,o,a){let l=n[s+0],c=n[s+1],h=n[s+2],d=n[s+3];const f=r[o+0],p=r[o+1],_=r[o+2],v=r[o+3];if(a===0){e[t+0]=l,e[t+1]=c,e[t+2]=h,e[t+3]=d;return}if(a===1){e[t+0]=f,e[t+1]=p,e[t+2]=_,e[t+3]=v;return}if(d!==v||l!==f||c!==p||h!==_){let m=1-a;const u=l*f+c*p+h*_+d*v,A=u>=0?1:-1,b=1-u*u;if(b>Number.EPSILON){const P=Math.sqrt(b),T=Math.atan2(P,u*A);m=Math.sin(m*T)/P,a=Math.sin(a*T)/P}const E=a*A;if(l=l*m+f*E,c=c*m+p*E,h=h*m+_*E,d=d*m+v*E,m===1-a){const P=1/Math.sqrt(l*l+c*c+h*h+d*d);l*=P,c*=P,h*=P,d*=P}}e[t]=l,e[t+1]=c,e[t+2]=h,e[t+3]=d}static multiplyQuaternionsFlat(e,t,n,s,r,o){const a=n[s],l=n[s+1],c=n[s+2],h=n[s+3],d=r[o],f=r[o+1],p=r[o+2],_=r[o+3];return e[t]=a*_+h*d+l*p-c*f,e[t+1]=l*_+h*f+c*d-a*p,e[t+2]=c*_+h*p+a*f-l*d,e[t+3]=h*_-a*d-l*f-c*p,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,n,s){return this._x=e,this._y=t,this._z=n,this._w=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){const n=e._x,s=e._y,r=e._z,o=e._order,a=Math.cos,l=Math.sin,c=a(n/2),h=a(s/2),d=a(r/2),f=l(n/2),p=l(s/2),_=l(r/2);switch(o){case"XYZ":this._x=f*h*d+c*p*_,this._y=c*p*d-f*h*_,this._z=c*h*_+f*p*d,this._w=c*h*d-f*p*_;break;case"YXZ":this._x=f*h*d+c*p*_,this._y=c*p*d-f*h*_,this._z=c*h*_-f*p*d,this._w=c*h*d+f*p*_;break;case"ZXY":this._x=f*h*d-c*p*_,this._y=c*p*d+f*h*_,this._z=c*h*_+f*p*d,this._w=c*h*d-f*p*_;break;case"ZYX":this._x=f*h*d-c*p*_,this._y=c*p*d+f*h*_,this._z=c*h*_-f*p*d,this._w=c*h*d+f*p*_;break;case"YZX":this._x=f*h*d+c*p*_,this._y=c*p*d+f*h*_,this._z=c*h*_-f*p*d,this._w=c*h*d-f*p*_;break;case"XZY":this._x=f*h*d-c*p*_,this._y=c*p*d-f*h*_,this._z=c*h*_+f*p*d,this._w=c*h*d+f*p*_;break;default:console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: "+o)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){const n=t/2,s=Math.sin(n);return this._x=e.x*s,this._y=e.y*s,this._z=e.z*s,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(e){const t=e.elements,n=t[0],s=t[4],r=t[8],o=t[1],a=t[5],l=t[9],c=t[2],h=t[6],d=t[10],f=n+a+d;if(f>0){const p=.5/Math.sqrt(f+1);this._w=.25/p,this._x=(h-l)*p,this._y=(r-c)*p,this._z=(o-s)*p}else if(n>a&&n>d){const p=2*Math.sqrt(1+n-a-d);this._w=(h-l)/p,this._x=.25*p,this._y=(s+o)/p,this._z=(r+c)/p}else if(a>d){const p=2*Math.sqrt(1+a-n-d);this._w=(r-c)/p,this._x=(s+o)/p,this._y=.25*p,this._z=(l+h)/p}else{const p=2*Math.sqrt(1+d-n-a);this._w=(o-s)/p,this._x=(r+c)/p,this._y=(l+h)/p,this._z=.25*p}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let n=e.dot(t)+1;return n<1e-8?(n=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=n):(this._x=0,this._y=-e.z,this._z=e.y,this._w=n)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=n),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(Ge(this.dot(e),-1,1)))}rotateTowards(e,t){const n=this.angleTo(e);if(n===0)return this;const s=Math.min(1,t/n);return this.slerp(e,s),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){const n=e._x,s=e._y,r=e._z,o=e._w,a=t._x,l=t._y,c=t._z,h=t._w;return this._x=n*h+o*a+s*c-r*l,this._y=s*h+o*l+r*a-n*c,this._z=r*h+o*c+n*l-s*a,this._w=o*h-n*a-s*l-r*c,this._onChangeCallback(),this}slerp(e,t){if(t===0)return this;if(t===1)return this.copy(e);const n=this._x,s=this._y,r=this._z,o=this._w;let a=o*e._w+n*e._x+s*e._y+r*e._z;if(a<0?(this._w=-e._w,this._x=-e._x,this._y=-e._y,this._z=-e._z,a=-a):this.copy(e),a>=1)return this._w=o,this._x=n,this._y=s,this._z=r,this;const l=1-a*a;if(l<=Number.EPSILON){const p=1-t;return this._w=p*o+t*this._w,this._x=p*n+t*this._x,this._y=p*s+t*this._y,this._z=p*r+t*this._z,this.normalize(),this}const c=Math.sqrt(l),h=Math.atan2(c,a),d=Math.sin((1-t)*h)/c,f=Math.sin(t*h)/c;return this._w=o*d+this._w*f,this._x=n*d+this._x*f,this._y=s*d+this._y*f,this._z=r*d+this._z*f,this._onChangeCallback(),this}slerpQuaternions(e,t,n){return this.copy(e).slerp(t,n)}random(){const e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),n=Math.random(),s=Math.sqrt(1-n),r=Math.sqrt(n);return this.set(s*Math.sin(e),s*Math.cos(e),r*Math.sin(t),r*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}class N{constructor(e=0,t=0,n=0){N.prototype.isVector3=!0,this.x=e,this.y=t,this.z=n}set(e,t,n){return n===void 0&&(n=this.z),this.x=e,this.y=t,this.z=n,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(no.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(no.setFromAxisAngle(e,t))}applyMatrix3(e){const t=this.x,n=this.y,s=this.z,r=e.elements;return this.x=r[0]*t+r[3]*n+r[6]*s,this.y=r[1]*t+r[4]*n+r[7]*s,this.z=r[2]*t+r[5]*n+r[8]*s,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){const t=this.x,n=this.y,s=this.z,r=e.elements,o=1/(r[3]*t+r[7]*n+r[11]*s+r[15]);return this.x=(r[0]*t+r[4]*n+r[8]*s+r[12])*o,this.y=(r[1]*t+r[5]*n+r[9]*s+r[13])*o,this.z=(r[2]*t+r[6]*n+r[10]*s+r[14])*o,this}applyQuaternion(e){const t=this.x,n=this.y,s=this.z,r=e.x,o=e.y,a=e.z,l=e.w,c=2*(o*s-a*n),h=2*(a*t-r*s),d=2*(r*n-o*t);return this.x=t+l*c+o*d-a*h,this.y=n+l*h+a*c-r*d,this.z=s+l*d+r*h-o*c,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){const t=this.x,n=this.y,s=this.z,r=e.elements;return this.x=r[0]*t+r[4]*n+r[8]*s,this.y=r[1]*t+r[5]*n+r[9]*s,this.z=r[2]*t+r[6]*n+r[10]*s,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=Ge(this.x,e.x,t.x),this.y=Ge(this.y,e.y,t.y),this.z=Ge(this.z,e.z,t.z),this}clampScalar(e,t){return this.x=Ge(this.x,e,t),this.y=Ge(this.y,e,t),this.z=Ge(this.z,e,t),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Ge(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){const n=e.x,s=e.y,r=e.z,o=t.x,a=t.y,l=t.z;return this.x=s*l-r*a,this.y=r*o-n*l,this.z=n*a-s*o,this}projectOnVector(e){const t=e.lengthSq();if(t===0)return this.set(0,0,0);const n=e.dot(this)/t;return this.copy(e).multiplyScalar(n)}projectOnPlane(e){return Zs.copy(this).projectOnVector(e),this.sub(Zs)}reflect(e){return this.sub(Zs.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const n=this.dot(e)/t;return Math.acos(Ge(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,n=this.y-e.y,s=this.z-e.z;return t*t+n*n+s*s}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,n){const s=Math.sin(t)*e;return this.x=s*Math.sin(n),this.y=Math.cos(t)*e,this.z=s*Math.cos(n),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,n){return this.x=e*Math.sin(t),this.y=n,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){const t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){const t=this.setFromMatrixColumn(e,0).length(),n=this.setFromMatrixColumn(e,1).length(),s=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=n,this.z=s,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){const e=Math.random()*Math.PI*2,t=Math.random()*2-1,n=Math.sqrt(1-t*t);return this.x=n*Math.cos(e),this.y=t,this.z=n*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}}const Zs=new N,no=new Ci;class Ne{constructor(e,t,n,s,r,o,a,l,c){Ne.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,n,s,r,o,a,l,c)}set(e,t,n,s,r,o,a,l,c){const h=this.elements;return h[0]=e,h[1]=s,h[2]=a,h[3]=t,h[4]=r,h[5]=l,h[6]=n,h[7]=o,h[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){const t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],this}extractBasis(e,t,n){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(e){const t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const n=e.elements,s=t.elements,r=this.elements,o=n[0],a=n[3],l=n[6],c=n[1],h=n[4],d=n[7],f=n[2],p=n[5],_=n[8],v=s[0],m=s[3],u=s[6],A=s[1],b=s[4],E=s[7],P=s[2],T=s[5],R=s[8];return r[0]=o*v+a*A+l*P,r[3]=o*m+a*b+l*T,r[6]=o*u+a*E+l*R,r[1]=c*v+h*A+d*P,r[4]=c*m+h*b+d*T,r[7]=c*u+h*E+d*R,r[2]=f*v+p*A+_*P,r[5]=f*m+p*b+_*T,r[8]=f*u+p*E+_*R,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){const e=this.elements,t=e[0],n=e[1],s=e[2],r=e[3],o=e[4],a=e[5],l=e[6],c=e[7],h=e[8];return t*o*h-t*a*c-n*r*h+n*a*l+s*r*c-s*o*l}invert(){const e=this.elements,t=e[0],n=e[1],s=e[2],r=e[3],o=e[4],a=e[5],l=e[6],c=e[7],h=e[8],d=h*o-a*c,f=a*l-h*r,p=c*r-o*l,_=t*d+n*f+s*p;if(_===0)return this.set(0,0,0,0,0,0,0,0,0);const v=1/_;return e[0]=d*v,e[1]=(s*c-h*n)*v,e[2]=(a*n-s*o)*v,e[3]=f*v,e[4]=(h*t-s*l)*v,e[5]=(s*r-a*t)*v,e[6]=p*v,e[7]=(n*l-c*t)*v,e[8]=(o*t-n*r)*v,this}transpose(){let e;const t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){const t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,n,s,r,o,a){const l=Math.cos(r),c=Math.sin(r);return this.set(n*l,n*c,-n*(l*o+c*a)+o+e,-s*c,s*l,-s*(-c*o+l*a)+a+t,0,0,1),this}scale(e,t){return this.premultiply(Js.makeScale(e,t)),this}rotate(e){return this.premultiply(Js.makeRotation(-e)),this}translate(e,t){return this.premultiply(Js.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,n,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){const t=this.elements,n=e.elements;for(let s=0;s<9;s++)if(t[s]!==n[s])return!1;return!0}fromArray(e,t=0){for(let n=0;n<9;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){const n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e}clone(){return new this.constructor().fromArray(this.elements)}}const Js=new Ne;function bl(i){for(let e=i.length-1;e>=0;--e)if(i[e]>=65535)return!0;return!1}function zs(i){return document.createElementNS("http://www.w3.org/1999/xhtml",i)}function fh(){const i=zs("canvas");return i.style.display="block",i}const io={};function ji(i){i in io||(io[i]=!0,console.warn(i))}function ph(i,e,t){return new Promise(function(n,s){function r(){switch(i.clientWaitSync(e,i.SYNC_FLUSH_COMMANDS_BIT,0)){case i.WAIT_FAILED:s();break;case i.TIMEOUT_EXPIRED:setTimeout(r,t);break;default:n()}}setTimeout(r,t)})}const so=new Ne().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),ro=new Ne().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function mh(){const i={enabled:!0,workingColorSpace:Qn,spaces:{},convert:function(s,r,o){return this.enabled===!1||r===o||!r||!o||(this.spaces[r].transfer===Je&&(s.r=mn(s.r),s.g=mn(s.g),s.b=mn(s.b)),this.spaces[r].primaries!==this.spaces[o].primaries&&(s.applyMatrix3(this.spaces[r].toXYZ),s.applyMatrix3(this.spaces[o].fromXYZ)),this.spaces[o].transfer===Je&&(s.r=Si(s.r),s.g=Si(s.g),s.b=Si(s.b))),s},workingToColorSpace:function(s,r){return this.convert(s,this.workingColorSpace,r)},colorSpaceToWorking:function(s,r){return this.convert(s,r,this.workingColorSpace)},getPrimaries:function(s){return this.spaces[s].primaries},getTransfer:function(s){return s===Rn?Os:this.spaces[s].transfer},getToneMappingMode:function(s){return this.spaces[s].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(s,r=this.workingColorSpace){return s.fromArray(this.spaces[r].luminanceCoefficients)},define:function(s){Object.assign(this.spaces,s)},_getMatrix:function(s,r,o){return s.copy(this.spaces[r].toXYZ).multiply(this.spaces[o].fromXYZ)},_getDrawingBufferColorSpace:function(s){return this.spaces[s].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(s=this.workingColorSpace){return this.spaces[s].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(s,r){return ji("THREE.ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),i.workingToColorSpace(s,r)},toWorkingColorSpace:function(s,r){return ji("THREE.ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),i.colorSpaceToWorking(s,r)}},e=[.64,.33,.3,.6,.15,.06],t=[.2126,.7152,.0722],n=[.3127,.329];return i.define({[Qn]:{primaries:e,whitePoint:n,transfer:Os,toXYZ:so,fromXYZ:ro,luminanceCoefficients:t,workingColorSpaceConfig:{unpackColorSpace:Ht},outputColorSpaceConfig:{drawingBufferColorSpace:Ht}},[Ht]:{primaries:e,whitePoint:n,transfer:Je,toXYZ:so,fromXYZ:ro,luminanceCoefficients:t,outputColorSpaceConfig:{drawingBufferColorSpace:Ht}}}),i}const Xe=mh();function mn(i){return i<.04045?i*.0773993808:Math.pow(i*.9478672986+.0521327014,2.4)}function Si(i){return i<.0031308?i*12.92:1.055*Math.pow(i,.41666)-.055}let ni;class gh{static getDataURL(e,t="image/png"){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let n;if(e instanceof HTMLCanvasElement)n=e;else{ni===void 0&&(ni=zs("canvas")),ni.width=e.width,ni.height=e.height;const s=ni.getContext("2d");e instanceof ImageData?s.putImageData(e,0,0):s.drawImage(e,0,0,e.width,e.height),n=ni}return n.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){const t=zs("canvas");t.width=e.width,t.height=e.height;const n=t.getContext("2d");n.drawImage(e,0,0,e.width,e.height);const s=n.getImageData(0,0,e.width,e.height),r=s.data;for(let o=0;o<r.length;o++)r[o]=mn(r[o]/255)*255;return n.putImageData(s,0,0),t}else if(e.data){const t=e.data.slice(0);for(let n=0;n<t.length;n++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[n]=Math.floor(mn(t[n]/255)*255):t[n]=mn(t[n]);return{data:t,width:e.width,height:e.height}}else return console.warn("THREE.ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}}let _h=0;class Pa{constructor(e=null){this.isSource=!0,Object.defineProperty(this,"id",{value:_h++}),this.uuid=Ri(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){const t=this.data;return typeof HTMLVideoElement<"u"&&t instanceof HTMLVideoElement?e.set(t.videoWidth,t.videoHeight,0):t instanceof VideoFrame?e.set(t.displayHeight,t.displayWidth,0):t!==null?e.set(t.width,t.height,t.depth||0):e.set(0,0,0),e}set needsUpdate(e){e===!0&&this.version++}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];const n={uuid:this.uuid,url:""},s=this.data;if(s!==null){let r;if(Array.isArray(s)){r=[];for(let o=0,a=s.length;o<a;o++)s[o].isDataTexture?r.push(Qs(s[o].image)):r.push(Qs(s[o]))}else r=Qs(s);n.url=r}return t||(e.images[this.uuid]=n),n}}function Qs(i){return typeof HTMLImageElement<"u"&&i instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&i instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&i instanceof ImageBitmap?gh.getDataURL(i):i.data?{data:Array.from(i.data),width:i.width,height:i.height,type:i.data.constructor.name}:(console.warn("THREE.Texture: Unable to serialize Texture."),{})}let vh=0;const er=new N;class vt extends Ai{constructor(e=vt.DEFAULT_IMAGE,t=vt.DEFAULT_MAPPING,n=Kn,s=Kn,r=sn,o=jn,a=Wt,l=gn,c=vt.DEFAULT_ANISOTROPY,h=Rn){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:vh++}),this.uuid=Ri(),this.name="",this.source=new Pa(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=n,this.wrapT=s,this.magFilter=r,this.minFilter=o,this.anisotropy=c,this.format=a,this.internalFormat=null,this.type=l,this.offset=new Ke(0,0),this.repeat=new Ke(1,1),this.center=new Ke(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Ne,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(e&&e.depth&&e.depth>1),this.pmremVersion=0}get width(){return this.source.getSize(er).x}get height(){return this.source.getSize(er).y}get depth(){return this.source.getSize(er).z}get image(){return this.source.data}set image(e=null){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(const t in e){const n=e[t];if(n===void 0){console.warn(`THREE.Texture.setValues(): parameter '${t}' has value of undefined.`);continue}const s=this[t];if(s===void 0){console.warn(`THREE.Texture.setValues(): property '${t}' does not exist.`);continue}s&&n&&s.isVector2&&n.isVector2||s&&n&&s.isVector3&&n.isVector3||s&&n&&s.isMatrix3&&n.isMatrix3?s.copy(n):this[t]=n}}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];const n={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),t||(e.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==ml)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case Vr:e.x=e.x-Math.floor(e.x);break;case Kn:e.x=e.x<0?0:1;break;case Wr:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case Vr:e.y=e.y-Math.floor(e.y);break;case Kn:e.y=e.y<0?0:1;break;case Wr:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}}vt.DEFAULT_IMAGE=null;vt.DEFAULT_MAPPING=ml;vt.DEFAULT_ANISOTROPY=1;class ct{constructor(e=0,t=0,n=0,s=1){ct.prototype.isVector4=!0,this.x=e,this.y=t,this.z=n,this.w=s}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,n,s){return this.x=e,this.y=t,this.z=n,this.w=s,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){const t=this.x,n=this.y,s=this.z,r=this.w,o=e.elements;return this.x=o[0]*t+o[4]*n+o[8]*s+o[12]*r,this.y=o[1]*t+o[5]*n+o[9]*s+o[13]*r,this.z=o[2]*t+o[6]*n+o[10]*s+o[14]*r,this.w=o[3]*t+o[7]*n+o[11]*s+o[15]*r,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);const t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,n,s,r;const l=e.elements,c=l[0],h=l[4],d=l[8],f=l[1],p=l[5],_=l[9],v=l[2],m=l[6],u=l[10];if(Math.abs(h-f)<.01&&Math.abs(d-v)<.01&&Math.abs(_-m)<.01){if(Math.abs(h+f)<.1&&Math.abs(d+v)<.1&&Math.abs(_+m)<.1&&Math.abs(c+p+u-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;const b=(c+1)/2,E=(p+1)/2,P=(u+1)/2,T=(h+f)/4,R=(d+v)/4,I=(_+m)/4;return b>E&&b>P?b<.01?(n=0,s=.707106781,r=.707106781):(n=Math.sqrt(b),s=T/n,r=R/n):E>P?E<.01?(n=.707106781,s=0,r=.707106781):(s=Math.sqrt(E),n=T/s,r=I/s):P<.01?(n=.707106781,s=.707106781,r=0):(r=Math.sqrt(P),n=R/r,s=I/r),this.set(n,s,r,t),this}let A=Math.sqrt((m-_)*(m-_)+(d-v)*(d-v)+(f-h)*(f-h));return Math.abs(A)<.001&&(A=1),this.x=(m-_)/A,this.y=(d-v)/A,this.z=(f-h)/A,this.w=Math.acos((c+p+u-1)/2),this}setFromMatrixPosition(e){const t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=Ge(this.x,e.x,t.x),this.y=Ge(this.y,e.y,t.y),this.z=Ge(this.z,e.z,t.z),this.w=Ge(this.w,e.w,t.w),this}clampScalar(e,t){return this.x=Ge(this.x,e,t),this.y=Ge(this.y,e,t),this.z=Ge(this.z,e,t),this.w=Ge(this.w,e,t),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Ge(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this.w=e.w+(t.w-e.w)*n,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}}class xh extends Ai{constructor(e=1,t=1,n={}){super(),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:sn,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1},n),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=n.depth,this.scissor=new ct(0,0,e,t),this.scissorTest=!1,this.viewport=new ct(0,0,e,t);const s={width:e,height:t,depth:n.depth},r=new vt(s);this.textures=[];const o=n.count;for(let a=0;a<o;a++)this.textures[a]=r.clone(),this.textures[a].isRenderTargetTexture=!0,this.textures[a].renderTarget=this;this._setTextureOptions(n),this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this._depthTexture=null,this.depthTexture=n.depthTexture,this.samples=n.samples,this.multiview=n.multiview}_setTextureOptions(e={}){const t={minFilter:sn,generateMipmaps:!1,flipY:!1,internalFormat:null};e.mapping!==void 0&&(t.mapping=e.mapping),e.wrapS!==void 0&&(t.wrapS=e.wrapS),e.wrapT!==void 0&&(t.wrapT=e.wrapT),e.wrapR!==void 0&&(t.wrapR=e.wrapR),e.magFilter!==void 0&&(t.magFilter=e.magFilter),e.minFilter!==void 0&&(t.minFilter=e.minFilter),e.format!==void 0&&(t.format=e.format),e.type!==void 0&&(t.type=e.type),e.anisotropy!==void 0&&(t.anisotropy=e.anisotropy),e.colorSpace!==void 0&&(t.colorSpace=e.colorSpace),e.flipY!==void 0&&(t.flipY=e.flipY),e.generateMipmaps!==void 0&&(t.generateMipmaps=e.generateMipmaps),e.internalFormat!==void 0&&(t.internalFormat=e.internalFormat);for(let n=0;n<this.textures.length;n++)this.textures[n].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){this._depthTexture!==null&&(this._depthTexture.renderTarget=null),e!==null&&(e.renderTarget=this),this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,n=1){if(this.width!==e||this.height!==t||this.depth!==n){this.width=e,this.height=t,this.depth=n;for(let s=0,r=this.textures.length;s<r;s++)this.textures[s].image.width=e,this.textures[s].image.height=t,this.textures[s].image.depth=n,this.textures[s].isArrayTexture=this.textures[s].image.depth>1;this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,n=e.textures.length;t<n;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;const s=Object.assign({},e.textures[t].image);this.textures[t].source=new Pa(s)}return this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,e.depthTexture!==null&&(this.depthTexture=e.depthTexture.clone()),this.samples=e.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}}class In extends xh{constructor(e=1,t=1,n={}){super(e,t,n),this.isWebGLRenderTarget=!0}}class wl extends vt{constructor(e=null,t=1,n=1,s=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:n,depth:s},this.magFilter=ht,this.minFilter=ht,this.wrapR=Kn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}}class Sh extends vt{constructor(e=null,t=1,n=1,s=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:n,depth:s},this.magFilter=ht,this.minFilter=ht,this.wrapR=Kn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class Ji{constructor(e=new N(1/0,1/0,1/0),t=new N(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t+=3)this.expandByPoint(qt.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,n=e.count;t<n;t++)this.expandByPoint(qt.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){const n=qt.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);const n=e.geometry;if(n!==void 0){const r=n.getAttribute("position");if(t===!0&&r!==void 0&&e.isInstancedMesh!==!0)for(let o=0,a=r.count;o<a;o++)e.isMesh===!0?e.getVertexPosition(o,qt):qt.fromBufferAttribute(r,o),qt.applyMatrix4(e.matrixWorld),this.expandByPoint(qt);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),ss.copy(e.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),ss.copy(n.boundingBox)),ss.applyMatrix4(e.matrixWorld),this.union(ss)}const s=e.children;for(let r=0,o=s.length;r<o;r++)this.expandByObject(s[r],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,qt),qt.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,n;return e.normal.x>0?(t=e.normal.x*this.min.x,n=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,n=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,n+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,n+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,n+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,n+=e.normal.z*this.min.z),t<=-e.constant&&n>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(Ui),rs.subVectors(this.max,Ui),ii.subVectors(e.a,Ui),si.subVectors(e.b,Ui),ri.subVectors(e.c,Ui),vn.subVectors(si,ii),xn.subVectors(ri,si),Bn.subVectors(ii,ri);let t=[0,-vn.z,vn.y,0,-xn.z,xn.y,0,-Bn.z,Bn.y,vn.z,0,-vn.x,xn.z,0,-xn.x,Bn.z,0,-Bn.x,-vn.y,vn.x,0,-xn.y,xn.x,0,-Bn.y,Bn.x,0];return!tr(t,ii,si,ri,rs)||(t=[1,0,0,0,1,0,0,0,1],!tr(t,ii,si,ri,rs))?!1:(as.crossVectors(vn,xn),t=[as.x,as.y,as.z],tr(t,ii,si,ri,rs))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,qt).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(qt).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(ln[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),ln[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),ln[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),ln[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),ln[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),ln[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),ln[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),ln[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(ln),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}}const ln=[new N,new N,new N,new N,new N,new N,new N,new N],qt=new N,ss=new Ji,ii=new N,si=new N,ri=new N,vn=new N,xn=new N,Bn=new N,Ui=new N,rs=new N,as=new N,zn=new N;function tr(i,e,t,n,s){for(let r=0,o=i.length-3;r<=o;r+=3){zn.fromArray(i,r);const a=s.x*Math.abs(zn.x)+s.y*Math.abs(zn.y)+s.z*Math.abs(zn.z),l=e.dot(zn),c=t.dot(zn),h=n.dot(zn);if(Math.max(-Math.max(l,c,h),Math.min(l,c,h))>a)return!1}return!0}const Mh=new Ji,Ii=new N,nr=new N;class Qi{constructor(e=new N,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){const n=this.center;t!==void 0?n.copy(t):Mh.setFromPoints(e).getCenter(n);let s=0;for(let r=0,o=e.length;r<o;r++)s=Math.max(s,n.distanceToSquared(e[r]));return this.radius=Math.sqrt(s),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){const t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){const n=this.center.distanceToSquared(e);return t.copy(e),n>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;Ii.subVectors(e,this.center);const t=Ii.lengthSq();if(t>this.radius*this.radius){const n=Math.sqrt(t),s=(n-this.radius)*.5;this.center.addScaledVector(Ii,s/n),this.radius+=s}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(nr.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(Ii.copy(e.center).add(nr)),this.expandByPoint(Ii.copy(e.center).sub(nr))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}}const cn=new N,ir=new N,os=new N,Sn=new N,sr=new N,ls=new N,rr=new N;class Da{constructor(e=new N,t=new N(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,cn)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);const n=t.dot(this.direction);return n<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){const t=cn.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(cn.copy(this.origin).addScaledVector(this.direction,t),cn.distanceToSquared(e))}distanceSqToSegment(e,t,n,s){ir.copy(e).add(t).multiplyScalar(.5),os.copy(t).sub(e).normalize(),Sn.copy(this.origin).sub(ir);const r=e.distanceTo(t)*.5,o=-this.direction.dot(os),a=Sn.dot(this.direction),l=-Sn.dot(os),c=Sn.lengthSq(),h=Math.abs(1-o*o);let d,f,p,_;if(h>0)if(d=o*l-a,f=o*a-l,_=r*h,d>=0)if(f>=-_)if(f<=_){const v=1/h;d*=v,f*=v,p=d*(d+o*f+2*a)+f*(o*d+f+2*l)+c}else f=r,d=Math.max(0,-(o*f+a)),p=-d*d+f*(f+2*l)+c;else f=-r,d=Math.max(0,-(o*f+a)),p=-d*d+f*(f+2*l)+c;else f<=-_?(d=Math.max(0,-(-o*r+a)),f=d>0?-r:Math.min(Math.max(-r,-l),r),p=-d*d+f*(f+2*l)+c):f<=_?(d=0,f=Math.min(Math.max(-r,-l),r),p=f*(f+2*l)+c):(d=Math.max(0,-(o*r+a)),f=d>0?r:Math.min(Math.max(-r,-l),r),p=-d*d+f*(f+2*l)+c);else f=o>0?-r:r,d=Math.max(0,-(o*f+a)),p=-d*d+f*(f+2*l)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,d),s&&s.copy(ir).addScaledVector(os,f),p}intersectSphere(e,t){cn.subVectors(e.center,this.origin);const n=cn.dot(this.direction),s=cn.dot(cn)-n*n,r=e.radius*e.radius;if(s>r)return null;const o=Math.sqrt(r-s),a=n-o,l=n+o;return l<0?null:a<0?this.at(l,t):this.at(a,t)}intersectsSphere(e){return e.radius<0?!1:this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){const t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;const n=-(this.origin.dot(e.normal)+e.constant)/t;return n>=0?n:null}intersectPlane(e,t){const n=this.distanceToPlane(e);return n===null?null:this.at(n,t)}intersectsPlane(e){const t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let n,s,r,o,a,l;const c=1/this.direction.x,h=1/this.direction.y,d=1/this.direction.z,f=this.origin;return c>=0?(n=(e.min.x-f.x)*c,s=(e.max.x-f.x)*c):(n=(e.max.x-f.x)*c,s=(e.min.x-f.x)*c),h>=0?(r=(e.min.y-f.y)*h,o=(e.max.y-f.y)*h):(r=(e.max.y-f.y)*h,o=(e.min.y-f.y)*h),n>o||r>s||((r>n||isNaN(n))&&(n=r),(o<s||isNaN(s))&&(s=o),d>=0?(a=(e.min.z-f.z)*d,l=(e.max.z-f.z)*d):(a=(e.max.z-f.z)*d,l=(e.min.z-f.z)*d),n>l||a>s)||((a>n||n!==n)&&(n=a),(l<s||s!==s)&&(s=l),s<0)?null:this.at(n>=0?n:s,t)}intersectsBox(e){return this.intersectBox(e,cn)!==null}intersectTriangle(e,t,n,s,r){sr.subVectors(t,e),ls.subVectors(n,e),rr.crossVectors(sr,ls);let o=this.direction.dot(rr),a;if(o>0){if(s)return null;a=1}else if(o<0)a=-1,o=-o;else return null;Sn.subVectors(this.origin,e);const l=a*this.direction.dot(ls.crossVectors(Sn,ls));if(l<0)return null;const c=a*this.direction.dot(sr.cross(Sn));if(c<0||l+c>o)return null;const h=-a*Sn.dot(rr);return h<0?null:this.at(h/o,r)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class ut{constructor(e,t,n,s,r,o,a,l,c,h,d,f,p,_,v,m){ut.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,n,s,r,o,a,l,c,h,d,f,p,_,v,m)}set(e,t,n,s,r,o,a,l,c,h,d,f,p,_,v,m){const u=this.elements;return u[0]=e,u[4]=t,u[8]=n,u[12]=s,u[1]=r,u[5]=o,u[9]=a,u[13]=l,u[2]=c,u[6]=h,u[10]=d,u[14]=f,u[3]=p,u[7]=_,u[11]=v,u[15]=m,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new ut().fromArray(this.elements)}copy(e){const t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],this}copyPosition(e){const t=this.elements,n=e.elements;return t[12]=n[12],t[13]=n[13],t[14]=n[14],this}setFromMatrix3(e){const t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,n){return e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this}makeBasis(e,t,n){return this.set(e.x,t.x,n.x,0,e.y,t.y,n.y,0,e.z,t.z,n.z,0,0,0,0,1),this}extractRotation(e){const t=this.elements,n=e.elements,s=1/ai.setFromMatrixColumn(e,0).length(),r=1/ai.setFromMatrixColumn(e,1).length(),o=1/ai.setFromMatrixColumn(e,2).length();return t[0]=n[0]*s,t[1]=n[1]*s,t[2]=n[2]*s,t[3]=0,t[4]=n[4]*r,t[5]=n[5]*r,t[6]=n[6]*r,t[7]=0,t[8]=n[8]*o,t[9]=n[9]*o,t[10]=n[10]*o,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){const t=this.elements,n=e.x,s=e.y,r=e.z,o=Math.cos(n),a=Math.sin(n),l=Math.cos(s),c=Math.sin(s),h=Math.cos(r),d=Math.sin(r);if(e.order==="XYZ"){const f=o*h,p=o*d,_=a*h,v=a*d;t[0]=l*h,t[4]=-l*d,t[8]=c,t[1]=p+_*c,t[5]=f-v*c,t[9]=-a*l,t[2]=v-f*c,t[6]=_+p*c,t[10]=o*l}else if(e.order==="YXZ"){const f=l*h,p=l*d,_=c*h,v=c*d;t[0]=f+v*a,t[4]=_*a-p,t[8]=o*c,t[1]=o*d,t[5]=o*h,t[9]=-a,t[2]=p*a-_,t[6]=v+f*a,t[10]=o*l}else if(e.order==="ZXY"){const f=l*h,p=l*d,_=c*h,v=c*d;t[0]=f-v*a,t[4]=-o*d,t[8]=_+p*a,t[1]=p+_*a,t[5]=o*h,t[9]=v-f*a,t[2]=-o*c,t[6]=a,t[10]=o*l}else if(e.order==="ZYX"){const f=o*h,p=o*d,_=a*h,v=a*d;t[0]=l*h,t[4]=_*c-p,t[8]=f*c+v,t[1]=l*d,t[5]=v*c+f,t[9]=p*c-_,t[2]=-c,t[6]=a*l,t[10]=o*l}else if(e.order==="YZX"){const f=o*l,p=o*c,_=a*l,v=a*c;t[0]=l*h,t[4]=v-f*d,t[8]=_*d+p,t[1]=d,t[5]=o*h,t[9]=-a*h,t[2]=-c*h,t[6]=p*d+_,t[10]=f-v*d}else if(e.order==="XZY"){const f=o*l,p=o*c,_=a*l,v=a*c;t[0]=l*h,t[4]=-d,t[8]=c*h,t[1]=f*d+v,t[5]=o*h,t[9]=p*d-_,t[2]=_*d-p,t[6]=a*h,t[10]=v*d+f}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(Eh,e,yh)}lookAt(e,t,n){const s=this.elements;return Ut.subVectors(e,t),Ut.lengthSq()===0&&(Ut.z=1),Ut.normalize(),Mn.crossVectors(n,Ut),Mn.lengthSq()===0&&(Math.abs(n.z)===1?Ut.x+=1e-4:Ut.z+=1e-4,Ut.normalize(),Mn.crossVectors(n,Ut)),Mn.normalize(),cs.crossVectors(Ut,Mn),s[0]=Mn.x,s[4]=cs.x,s[8]=Ut.x,s[1]=Mn.y,s[5]=cs.y,s[9]=Ut.y,s[2]=Mn.z,s[6]=cs.z,s[10]=Ut.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const n=e.elements,s=t.elements,r=this.elements,o=n[0],a=n[4],l=n[8],c=n[12],h=n[1],d=n[5],f=n[9],p=n[13],_=n[2],v=n[6],m=n[10],u=n[14],A=n[3],b=n[7],E=n[11],P=n[15],T=s[0],R=s[4],I=s[8],M=s[12],S=s[1],L=s[5],H=s[9],W=s[13],j=s[2],q=s[6],$=s[10],J=s[14],B=s[3],C=s[7],he=s[11],pe=s[15];return r[0]=o*T+a*S+l*j+c*B,r[4]=o*R+a*L+l*q+c*C,r[8]=o*I+a*H+l*$+c*he,r[12]=o*M+a*W+l*J+c*pe,r[1]=h*T+d*S+f*j+p*B,r[5]=h*R+d*L+f*q+p*C,r[9]=h*I+d*H+f*$+p*he,r[13]=h*M+d*W+f*J+p*pe,r[2]=_*T+v*S+m*j+u*B,r[6]=_*R+v*L+m*q+u*C,r[10]=_*I+v*H+m*$+u*he,r[14]=_*M+v*W+m*J+u*pe,r[3]=A*T+b*S+E*j+P*B,r[7]=A*R+b*L+E*q+P*C,r[11]=A*I+b*H+E*$+P*he,r[15]=A*M+b*W+E*J+P*pe,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){const e=this.elements,t=e[0],n=e[4],s=e[8],r=e[12],o=e[1],a=e[5],l=e[9],c=e[13],h=e[2],d=e[6],f=e[10],p=e[14],_=e[3],v=e[7],m=e[11],u=e[15];return _*(+r*l*d-s*c*d-r*a*f+n*c*f+s*a*p-n*l*p)+v*(+t*l*p-t*c*f+r*o*f-s*o*p+s*c*h-r*l*h)+m*(+t*c*d-t*a*p-r*o*d+n*o*p+r*a*h-n*c*h)+u*(-s*a*h-t*l*d+t*a*f+s*o*d-n*o*f+n*l*h)}transpose(){const e=this.elements;let t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,n){const s=this.elements;return e.isVector3?(s[12]=e.x,s[13]=e.y,s[14]=e.z):(s[12]=e,s[13]=t,s[14]=n),this}invert(){const e=this.elements,t=e[0],n=e[1],s=e[2],r=e[3],o=e[4],a=e[5],l=e[6],c=e[7],h=e[8],d=e[9],f=e[10],p=e[11],_=e[12],v=e[13],m=e[14],u=e[15],A=d*m*c-v*f*c+v*l*p-a*m*p-d*l*u+a*f*u,b=_*f*c-h*m*c-_*l*p+o*m*p+h*l*u-o*f*u,E=h*v*c-_*d*c+_*a*p-o*v*p-h*a*u+o*d*u,P=_*d*l-h*v*l-_*a*f+o*v*f+h*a*m-o*d*m,T=t*A+n*b+s*E+r*P;if(T===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);const R=1/T;return e[0]=A*R,e[1]=(v*f*r-d*m*r-v*s*p+n*m*p+d*s*u-n*f*u)*R,e[2]=(a*m*r-v*l*r+v*s*c-n*m*c-a*s*u+n*l*u)*R,e[3]=(d*l*r-a*f*r-d*s*c+n*f*c+a*s*p-n*l*p)*R,e[4]=b*R,e[5]=(h*m*r-_*f*r+_*s*p-t*m*p-h*s*u+t*f*u)*R,e[6]=(_*l*r-o*m*r-_*s*c+t*m*c+o*s*u-t*l*u)*R,e[7]=(o*f*r-h*l*r+h*s*c-t*f*c-o*s*p+t*l*p)*R,e[8]=E*R,e[9]=(_*d*r-h*v*r-_*n*p+t*v*p+h*n*u-t*d*u)*R,e[10]=(o*v*r-_*a*r+_*n*c-t*v*c-o*n*u+t*a*u)*R,e[11]=(h*a*r-o*d*r-h*n*c+t*d*c+o*n*p-t*a*p)*R,e[12]=P*R,e[13]=(h*v*s-_*d*s+_*n*f-t*v*f-h*n*m+t*d*m)*R,e[14]=(_*a*s-o*v*s-_*n*l+t*v*l+o*n*m-t*a*m)*R,e[15]=(o*d*s-h*a*s+h*n*l-t*d*l-o*n*f+t*a*f)*R,this}scale(e){const t=this.elements,n=e.x,s=e.y,r=e.z;return t[0]*=n,t[4]*=s,t[8]*=r,t[1]*=n,t[5]*=s,t[9]*=r,t[2]*=n,t[6]*=s,t[10]*=r,t[3]*=n,t[7]*=s,t[11]*=r,this}getMaxScaleOnAxis(){const e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],n=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],s=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,n,s))}makeTranslation(e,t,n){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,n,0,0,0,1),this}makeRotationX(e){const t=Math.cos(e),n=Math.sin(e);return this.set(1,0,0,0,0,t,-n,0,0,n,t,0,0,0,0,1),this}makeRotationY(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,0,n,0,0,1,0,0,-n,0,t,0,0,0,0,1),this}makeRotationZ(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,0,n,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){const n=Math.cos(t),s=Math.sin(t),r=1-n,o=e.x,a=e.y,l=e.z,c=r*o,h=r*a;return this.set(c*o+n,c*a-s*l,c*l+s*a,0,c*a+s*l,h*a+n,h*l-s*o,0,c*l-s*a,h*l+s*o,r*l*l+n,0,0,0,0,1),this}makeScale(e,t,n){return this.set(e,0,0,0,0,t,0,0,0,0,n,0,0,0,0,1),this}makeShear(e,t,n,s,r,o){return this.set(1,n,r,0,e,1,o,0,t,s,1,0,0,0,0,1),this}compose(e,t,n){const s=this.elements,r=t._x,o=t._y,a=t._z,l=t._w,c=r+r,h=o+o,d=a+a,f=r*c,p=r*h,_=r*d,v=o*h,m=o*d,u=a*d,A=l*c,b=l*h,E=l*d,P=n.x,T=n.y,R=n.z;return s[0]=(1-(v+u))*P,s[1]=(p+E)*P,s[2]=(_-b)*P,s[3]=0,s[4]=(p-E)*T,s[5]=(1-(f+u))*T,s[6]=(m+A)*T,s[7]=0,s[8]=(_+b)*R,s[9]=(m-A)*R,s[10]=(1-(f+v))*R,s[11]=0,s[12]=e.x,s[13]=e.y,s[14]=e.z,s[15]=1,this}decompose(e,t,n){const s=this.elements;let r=ai.set(s[0],s[1],s[2]).length();const o=ai.set(s[4],s[5],s[6]).length(),a=ai.set(s[8],s[9],s[10]).length();this.determinant()<0&&(r=-r),e.x=s[12],e.y=s[13],e.z=s[14],Yt.copy(this);const c=1/r,h=1/o,d=1/a;return Yt.elements[0]*=c,Yt.elements[1]*=c,Yt.elements[2]*=c,Yt.elements[4]*=h,Yt.elements[5]*=h,Yt.elements[6]*=h,Yt.elements[8]*=d,Yt.elements[9]*=d,Yt.elements[10]*=d,t.setFromRotationMatrix(Yt),n.x=r,n.y=o,n.z=a,this}makePerspective(e,t,n,s,r,o,a=rn,l=!1){const c=this.elements,h=2*r/(t-e),d=2*r/(n-s),f=(t+e)/(t-e),p=(n+s)/(n-s);let _,v;if(l)_=r/(o-r),v=o*r/(o-r);else if(a===rn)_=-(o+r)/(o-r),v=-2*o*r/(o-r);else if(a===Bs)_=-o/(o-r),v=-o*r/(o-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+a);return c[0]=h,c[4]=0,c[8]=f,c[12]=0,c[1]=0,c[5]=d,c[9]=p,c[13]=0,c[2]=0,c[6]=0,c[10]=_,c[14]=v,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(e,t,n,s,r,o,a=rn,l=!1){const c=this.elements,h=2/(t-e),d=2/(n-s),f=-(t+e)/(t-e),p=-(n+s)/(n-s);let _,v;if(l)_=1/(o-r),v=o/(o-r);else if(a===rn)_=-2/(o-r),v=-(o+r)/(o-r);else if(a===Bs)_=-1/(o-r),v=-r/(o-r);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+a);return c[0]=h,c[4]=0,c[8]=0,c[12]=f,c[1]=0,c[5]=d,c[9]=0,c[13]=p,c[2]=0,c[6]=0,c[10]=_,c[14]=v,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(e){const t=this.elements,n=e.elements;for(let s=0;s<16;s++)if(t[s]!==n[s])return!1;return!0}fromArray(e,t=0){for(let n=0;n<16;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){const n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e[t+9]=n[9],e[t+10]=n[10],e[t+11]=n[11],e[t+12]=n[12],e[t+13]=n[13],e[t+14]=n[14],e[t+15]=n[15],e}}const ai=new N,Yt=new ut,Eh=new N(0,0,0),yh=new N(1,1,1),Mn=new N,cs=new N,Ut=new N,ao=new ut,oo=new Ci;class _n{constructor(e=0,t=0,n=0,s=_n.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=n,this._order=s}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,n,s=this._order){return this._x=e,this._y=t,this._z=n,this._order=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,n=!0){const s=e.elements,r=s[0],o=s[4],a=s[8],l=s[1],c=s[5],h=s[9],d=s[2],f=s[6],p=s[10];switch(t){case"XYZ":this._y=Math.asin(Ge(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(-h,p),this._z=Math.atan2(-o,r)):(this._x=Math.atan2(f,c),this._z=0);break;case"YXZ":this._x=Math.asin(-Ge(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(a,p),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-d,r),this._z=0);break;case"ZXY":this._x=Math.asin(Ge(f,-1,1)),Math.abs(f)<.9999999?(this._y=Math.atan2(-d,p),this._z=Math.atan2(-o,c)):(this._y=0,this._z=Math.atan2(l,r));break;case"ZYX":this._y=Math.asin(-Ge(d,-1,1)),Math.abs(d)<.9999999?(this._x=Math.atan2(f,p),this._z=Math.atan2(l,r)):(this._x=0,this._z=Math.atan2(-o,c));break;case"YZX":this._z=Math.asin(Ge(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-h,c),this._y=Math.atan2(-d,r)):(this._x=0,this._y=Math.atan2(a,p));break;case"XZY":this._z=Math.asin(-Ge(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(f,c),this._y=Math.atan2(a,r)):(this._x=Math.atan2(-h,p),this._y=0);break;default:console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,n===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,n){return ao.makeRotationFromQuaternion(e),this.setFromRotationMatrix(ao,t,n)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return oo.setFromEuler(this),this.setFromQuaternion(oo,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}_n.DEFAULT_ORDER="XYZ";class Al{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}}let Th=0;const lo=new N,oi=new Ci,hn=new ut,hs=new N,Fi=new N,bh=new N,wh=new Ci,co=new N(1,0,0),ho=new N(0,1,0),uo=new N(0,0,1),fo={type:"added"},Ah={type:"removed"},li={type:"childadded",child:null},ar={type:"childremoved",child:null};class At extends Ai{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Th++}),this.uuid=Ri(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=At.DEFAULT_UP.clone();const e=new N,t=new _n,n=new Ci,s=new N(1,1,1);function r(){n.setFromEuler(t,!1)}function o(){t.setFromQuaternion(n,void 0,!1)}t._onChange(r),n._onChange(o),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:s},modelViewMatrix:{value:new ut},normalMatrix:{value:new Ne}}),this.matrix=new ut,this.matrixWorld=new ut,this.matrixAutoUpdate=At.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=At.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new Al,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.userData={}}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return oi.setFromAxisAngle(e,t),this.quaternion.multiply(oi),this}rotateOnWorldAxis(e,t){return oi.setFromAxisAngle(e,t),this.quaternion.premultiply(oi),this}rotateX(e){return this.rotateOnAxis(co,e)}rotateY(e){return this.rotateOnAxis(ho,e)}rotateZ(e){return this.rotateOnAxis(uo,e)}translateOnAxis(e,t){return lo.copy(e).applyQuaternion(this.quaternion),this.position.add(lo.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(co,e)}translateY(e){return this.translateOnAxis(ho,e)}translateZ(e){return this.translateOnAxis(uo,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(hn.copy(this.matrixWorld).invert())}lookAt(e,t,n){e.isVector3?hs.copy(e):hs.set(e,t,n);const s=this.parent;this.updateWorldMatrix(!0,!1),Fi.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?hn.lookAt(Fi,hs,this.up):hn.lookAt(hs,Fi,this.up),this.quaternion.setFromRotationMatrix(hn),s&&(hn.extractRotation(s.matrixWorld),oi.setFromRotationMatrix(hn),this.quaternion.premultiply(oi.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(console.error("THREE.Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(fo),li.child=e,this.dispatchEvent(li),li.child=null):console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}const t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(Ah),ar.child=e,this.dispatchEvent(ar),ar.child=null),this}removeFromParent(){const e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),hn.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),hn.multiply(e.parent.matrixWorld)),e.applyMatrix4(hn),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(fo),li.child=e,this.dispatchEvent(li),li.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let n=0,s=this.children.length;n<s;n++){const o=this.children[n].getObjectByProperty(e,t);if(o!==void 0)return o}}getObjectsByProperty(e,t,n=[]){this[e]===t&&n.push(this);const s=this.children;for(let r=0,o=s.length;r<o;r++)s[r].getObjectsByProperty(e,t,n);return n}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Fi,e,bh),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Fi,wh,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);const t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}traverse(e){e(this);const t=this.children;for(let n=0,s=t.length;n<s;n++)t[n].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);const t=this.children;for(let n=0,s=t.length;n<s;n++)t[n].traverseVisible(e)}traverseAncestors(e){const t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);const t=this.children;for(let n=0,s=t.length;n<s;n++)t[n].updateMatrixWorld(e)}updateWorldMatrix(e,t){const n=this.parent;if(e===!0&&n!==null&&n.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),t===!0){const s=this.children;for(let r=0,o=s.length;r<o;r++)s[r].updateWorldMatrix(!1,!0)}}toJSON(e){const t=e===void 0||typeof e=="string",n={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});const s={};s.uuid=this.uuid,s.type=this.type,this.name!==""&&(s.name=this.name),this.castShadow===!0&&(s.castShadow=!0),this.receiveShadow===!0&&(s.receiveShadow=!0),this.visible===!1&&(s.visible=!1),this.frustumCulled===!1&&(s.frustumCulled=!1),this.renderOrder!==0&&(s.renderOrder=this.renderOrder),Object.keys(this.userData).length>0&&(s.userData=this.userData),s.layers=this.layers.mask,s.matrix=this.matrix.toArray(),s.up=this.up.toArray(),this.matrixAutoUpdate===!1&&(s.matrixAutoUpdate=!1),this.isInstancedMesh&&(s.type="InstancedMesh",s.count=this.count,s.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(s.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(s.type="BatchedMesh",s.perObjectFrustumCulled=this.perObjectFrustumCulled,s.sortObjects=this.sortObjects,s.drawRanges=this._drawRanges,s.reservedRanges=this._reservedRanges,s.geometryInfo=this._geometryInfo.map(a=>({...a,boundingBox:a.boundingBox?a.boundingBox.toJSON():void 0,boundingSphere:a.boundingSphere?a.boundingSphere.toJSON():void 0})),s.instanceInfo=this._instanceInfo.map(a=>({...a})),s.availableInstanceIds=this._availableInstanceIds.slice(),s.availableGeometryIds=this._availableGeometryIds.slice(),s.nextIndexStart=this._nextIndexStart,s.nextVertexStart=this._nextVertexStart,s.geometryCount=this._geometryCount,s.maxInstanceCount=this._maxInstanceCount,s.maxVertexCount=this._maxVertexCount,s.maxIndexCount=this._maxIndexCount,s.geometryInitialized=this._geometryInitialized,s.matricesTexture=this._matricesTexture.toJSON(e),s.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null&&(s.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(s.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(s.boundingBox=this.boundingBox.toJSON()));function r(a,l){return a[l.uuid]===void 0&&(a[l.uuid]=l.toJSON(e)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?s.background=this.background.toJSON():this.background.isTexture&&(s.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(s.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){s.geometry=r(e.geometries,this.geometry);const a=this.geometry.parameters;if(a!==void 0&&a.shapes!==void 0){const l=a.shapes;if(Array.isArray(l))for(let c=0,h=l.length;c<h;c++){const d=l[c];r(e.shapes,d)}else r(e.shapes,l)}}if(this.isSkinnedMesh&&(s.bindMode=this.bindMode,s.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(e.skeletons,this.skeleton),s.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){const a=[];for(let l=0,c=this.material.length;l<c;l++)a.push(r(e.materials,this.material[l]));s.material=a}else s.material=r(e.materials,this.material);if(this.children.length>0){s.children=[];for(let a=0;a<this.children.length;a++)s.children.push(this.children[a].toJSON(e).object)}if(this.animations.length>0){s.animations=[];for(let a=0;a<this.animations.length;a++){const l=this.animations[a];s.animations.push(r(e.animations,l))}}if(t){const a=o(e.geometries),l=o(e.materials),c=o(e.textures),h=o(e.images),d=o(e.shapes),f=o(e.skeletons),p=o(e.animations),_=o(e.nodes);a.length>0&&(n.geometries=a),l.length>0&&(n.materials=l),c.length>0&&(n.textures=c),h.length>0&&(n.images=h),d.length>0&&(n.shapes=d),f.length>0&&(n.skeletons=f),p.length>0&&(n.animations=p),_.length>0&&(n.nodes=_)}return n.object=s,n;function o(a){const l=[];for(const c in a){const h=a[c];delete h.metadata,l.push(h)}return l}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let n=0;n<e.children.length;n++){const s=e.children[n];this.add(s.clone())}return this}}At.DEFAULT_UP=new N(0,1,0);At.DEFAULT_MATRIX_AUTO_UPDATE=!0;At.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;const $t=new N,un=new N,or=new N,dn=new N,ci=new N,hi=new N,po=new N,lr=new N,cr=new N,hr=new N,ur=new ct,dr=new ct,fr=new ct;class Zt{constructor(e=new N,t=new N,n=new N){this.a=e,this.b=t,this.c=n}static getNormal(e,t,n,s){s.subVectors(n,t),$t.subVectors(e,t),s.cross($t);const r=s.lengthSq();return r>0?s.multiplyScalar(1/Math.sqrt(r)):s.set(0,0,0)}static getBarycoord(e,t,n,s,r){$t.subVectors(s,t),un.subVectors(n,t),or.subVectors(e,t);const o=$t.dot($t),a=$t.dot(un),l=$t.dot(or),c=un.dot(un),h=un.dot(or),d=o*c-a*a;if(d===0)return r.set(0,0,0),null;const f=1/d,p=(c*l-a*h)*f,_=(o*h-a*l)*f;return r.set(1-p-_,_,p)}static containsPoint(e,t,n,s){return this.getBarycoord(e,t,n,s,dn)===null?!1:dn.x>=0&&dn.y>=0&&dn.x+dn.y<=1}static getInterpolation(e,t,n,s,r,o,a,l){return this.getBarycoord(e,t,n,s,dn)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(r,dn.x),l.addScaledVector(o,dn.y),l.addScaledVector(a,dn.z),l)}static getInterpolatedAttribute(e,t,n,s,r,o){return ur.setScalar(0),dr.setScalar(0),fr.setScalar(0),ur.fromBufferAttribute(e,t),dr.fromBufferAttribute(e,n),fr.fromBufferAttribute(e,s),o.setScalar(0),o.addScaledVector(ur,r.x),o.addScaledVector(dr,r.y),o.addScaledVector(fr,r.z),o}static isFrontFacing(e,t,n,s){return $t.subVectors(n,t),un.subVectors(e,t),$t.cross(un).dot(s)<0}set(e,t,n){return this.a.copy(e),this.b.copy(t),this.c.copy(n),this}setFromPointsAndIndices(e,t,n,s){return this.a.copy(e[t]),this.b.copy(e[n]),this.c.copy(e[s]),this}setFromAttributeAndIndices(e,t,n,s){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,n),this.c.fromBufferAttribute(e,s),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return $t.subVectors(this.c,this.b),un.subVectors(this.a,this.b),$t.cross(un).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return Zt.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return Zt.getBarycoord(e,this.a,this.b,this.c,t)}getInterpolation(e,t,n,s,r){return Zt.getInterpolation(e,this.a,this.b,this.c,t,n,s,r)}containsPoint(e){return Zt.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return Zt.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){const n=this.a,s=this.b,r=this.c;let o,a;ci.subVectors(s,n),hi.subVectors(r,n),lr.subVectors(e,n);const l=ci.dot(lr),c=hi.dot(lr);if(l<=0&&c<=0)return t.copy(n);cr.subVectors(e,s);const h=ci.dot(cr),d=hi.dot(cr);if(h>=0&&d<=h)return t.copy(s);const f=l*d-h*c;if(f<=0&&l>=0&&h<=0)return o=l/(l-h),t.copy(n).addScaledVector(ci,o);hr.subVectors(e,r);const p=ci.dot(hr),_=hi.dot(hr);if(_>=0&&p<=_)return t.copy(r);const v=p*c-l*_;if(v<=0&&c>=0&&_<=0)return a=c/(c-_),t.copy(n).addScaledVector(hi,a);const m=h*_-p*d;if(m<=0&&d-h>=0&&p-_>=0)return po.subVectors(r,s),a=(d-h)/(d-h+(p-_)),t.copy(s).addScaledVector(po,a);const u=1/(m+v+f);return o=v*u,a=f*u,t.copy(n).addScaledVector(ci,o).addScaledVector(hi,a)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}}const Rl={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},En={h:0,s:0,l:0},us={h:0,s:0,l:0};function pr(i,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?i+(e-i)*6*t:t<1/2?e:t<2/3?i+(e-i)*6*(2/3-t):i}class ze{constructor(e,t,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,n)}set(e,t,n){if(t===void 0&&n===void 0){const s=e;s&&s.isColor?this.copy(s):typeof s=="number"?this.setHex(s):typeof s=="string"&&this.setStyle(s)}else this.setRGB(e,t,n);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=Ht){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,Xe.colorSpaceToWorking(this,t),this}setRGB(e,t,n,s=Xe.workingColorSpace){return this.r=e,this.g=t,this.b=n,Xe.colorSpaceToWorking(this,s),this}setHSL(e,t,n,s=Xe.workingColorSpace){if(e=Ca(e,1),t=Ge(t,0,1),n=Ge(n,0,1),t===0)this.r=this.g=this.b=n;else{const r=n<=.5?n*(1+t):n+t-n*t,o=2*n-r;this.r=pr(o,r,e+1/3),this.g=pr(o,r,e),this.b=pr(o,r,e-1/3)}return Xe.colorSpaceToWorking(this,s),this}setStyle(e,t=Ht){function n(r){r!==void 0&&parseFloat(r)<1&&console.warn("THREE.Color: Alpha component of "+e+" will be ignored.")}let s;if(s=/^(\w+)\(([^\)]*)\)/.exec(e)){let r;const o=s[1],a=s[2];switch(o){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,t);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,t);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,t);break;default:console.warn("THREE.Color: Unknown color model "+e)}}else if(s=/^\#([A-Fa-f\d]+)$/.exec(e)){const r=s[1],o=r.length;if(o===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,t);if(o===6)return this.setHex(parseInt(r,16),t);console.warn("THREE.Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=Ht){const n=Rl[e.toLowerCase()];return n!==void 0?this.setHex(n,t):console.warn("THREE.Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=mn(e.r),this.g=mn(e.g),this.b=mn(e.b),this}copyLinearToSRGB(e){return this.r=Si(e.r),this.g=Si(e.g),this.b=Si(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=Ht){return Xe.workingToColorSpace(St.copy(this),e),Math.round(Ge(St.r*255,0,255))*65536+Math.round(Ge(St.g*255,0,255))*256+Math.round(Ge(St.b*255,0,255))}getHexString(e=Ht){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=Xe.workingColorSpace){Xe.workingToColorSpace(St.copy(this),t);const n=St.r,s=St.g,r=St.b,o=Math.max(n,s,r),a=Math.min(n,s,r);let l,c;const h=(a+o)/2;if(a===o)l=0,c=0;else{const d=o-a;switch(c=h<=.5?d/(o+a):d/(2-o-a),o){case n:l=(s-r)/d+(s<r?6:0);break;case s:l=(r-n)/d+2;break;case r:l=(n-s)/d+4;break}l/=6}return e.h=l,e.s=c,e.l=h,e}getRGB(e,t=Xe.workingColorSpace){return Xe.workingToColorSpace(St.copy(this),t),e.r=St.r,e.g=St.g,e.b=St.b,e}getStyle(e=Ht){Xe.workingToColorSpace(St.copy(this),e);const t=St.r,n=St.g,s=St.b;return e!==Ht?`color(${e} ${t.toFixed(3)} ${n.toFixed(3)} ${s.toFixed(3)})`:`rgb(${Math.round(t*255)},${Math.round(n*255)},${Math.round(s*255)})`}offsetHSL(e,t,n){return this.getHSL(En),this.setHSL(En.h+e,En.s+t,En.l+n)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,n){return this.r=e.r+(t.r-e.r)*n,this.g=e.g+(t.g-e.g)*n,this.b=e.b+(t.b-e.b)*n,this}lerpHSL(e,t){this.getHSL(En),e.getHSL(us);const n=Vi(En.h,us.h,t),s=Vi(En.s,us.s,t),r=Vi(En.l,us.l,t);return this.setHSL(n,s,r),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){const t=this.r,n=this.g,s=this.b,r=e.elements;return this.r=r[0]*t+r[3]*n+r[6]*s,this.g=r[1]*t+r[4]*n+r[7]*s,this.b=r[2]*t+r[5]*n+r[8]*s,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}const St=new ze;ze.NAMES=Rl;let Rh=0;class Pi extends Ai{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Rh++}),this.uuid=Ri(),this.name="",this.type="Material",this.blending=vi,this.side=Un,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=Ur,this.blendDst=Ir,this.blendEquation=qn,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new ze(0,0,0),this.blendAlpha=0,this.depthFunc=Zn,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=Ja,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=ti,this.stencilZFail=ti,this.stencilZPass=ti,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(const t in e){const n=e[t];if(n===void 0){console.warn(`THREE.Material: parameter '${t}' has value of undefined.`);continue}const s=this[t];if(s===void 0){console.warn(`THREE.Material: '${t}' is not a property of THREE.${this.type}.`);continue}s&&s.isColor?s.set(n):s&&s.isVector3&&n&&n.isVector3?s.copy(n):this[t]=n}}toJSON(e){const t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});const n={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,this.name!==""&&(n.name=this.name),this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(n.sheenColorMap=this.sheenColorMap.toJSON(e).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(n.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(e).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(e).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(e).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(e).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(e).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.shadowSide!==null&&(n.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),this.blending!==vi&&(n.blending=this.blending),this.side!==Un&&(n.side=this.side),this.vertexColors===!0&&(n.vertexColors=!0),this.opacity<1&&(n.opacity=this.opacity),this.transparent===!0&&(n.transparent=!0),this.blendSrc!==Ur&&(n.blendSrc=this.blendSrc),this.blendDst!==Ir&&(n.blendDst=this.blendDst),this.blendEquation!==qn&&(n.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(n.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(n.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(n.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(n.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(n.blendAlpha=this.blendAlpha),this.depthFunc!==Zn&&(n.depthFunc=this.depthFunc),this.depthTest===!1&&(n.depthTest=this.depthTest),this.depthWrite===!1&&(n.depthWrite=this.depthWrite),this.colorWrite===!1&&(n.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(n.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==Ja&&(n.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(n.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(n.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==ti&&(n.stencilFail=this.stencilFail),this.stencilZFail!==ti&&(n.stencilZFail=this.stencilZFail),this.stencilZPass!==ti&&(n.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(n.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(n.rotation=this.rotation),this.polygonOffset===!0&&(n.polygonOffset=!0),this.polygonOffsetFactor!==0&&(n.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(n.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(n.linewidth=this.linewidth),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.dithering===!0&&(n.dithering=!0),this.alphaTest>0&&(n.alphaTest=this.alphaTest),this.alphaHash===!0&&(n.alphaHash=!0),this.alphaToCoverage===!0&&(n.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(n.premultipliedAlpha=!0),this.forceSinglePass===!0&&(n.forceSinglePass=!0),this.wireframe===!0&&(n.wireframe=!0),this.wireframeLinewidth>1&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(n.flatShading=!0),this.visible===!1&&(n.visible=!1),this.toneMapped===!1&&(n.toneMapped=!1),this.fog===!1&&(n.fog=!1),Object.keys(this.userData).length>0&&(n.userData=this.userData);function s(r){const o=[];for(const a in r){const l=r[a];delete l.metadata,o.push(l)}return o}if(t){const r=s(e.textures),o=s(e.images);r.length>0&&(n.textures=r),o.length>0&&(n.images=o)}return n}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;const t=e.clippingPlanes;let n=null;if(t!==null){const s=t.length;n=new Array(s);for(let r=0;r!==s;++r)n[r]=t[r].clone()}return this.clippingPlanes=n,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}}class La extends Pi{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new ze(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new _n,this.combine=pl,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}}const dt=new N,ds=new Ke;let Ch=0;class gt{constructor(e,t,n=!1){if(Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:Ch++}),this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=n,this.usage=Qa,this.updateRanges=[],this.gpuType=pn,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,n){e*=this.itemSize,n*=t.itemSize;for(let s=0,r=this.itemSize;s<r;s++)this.array[e+s]=t.array[n+s];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,n=this.count;t<n;t++)ds.fromBufferAttribute(this,t),ds.applyMatrix3(e),this.setXY(t,ds.x,ds.y);else if(this.itemSize===3)for(let t=0,n=this.count;t<n;t++)dt.fromBufferAttribute(this,t),dt.applyMatrix3(e),this.setXYZ(t,dt.x,dt.y,dt.z);return this}applyMatrix4(e){for(let t=0,n=this.count;t<n;t++)dt.fromBufferAttribute(this,t),dt.applyMatrix4(e),this.setXYZ(t,dt.x,dt.y,dt.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)dt.fromBufferAttribute(this,t),dt.applyNormalMatrix(e),this.setXYZ(t,dt.x,dt.y,dt.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)dt.fromBufferAttribute(this,t),dt.transformDirection(e),this.setXYZ(t,dt.x,dt.y,dt.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let n=this.array[e*this.itemSize+t];return this.normalized&&(n=gi(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=yt(n,this.array)),this.array[e*this.itemSize+t]=n,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=gi(t,this.array)),t}setX(e,t){return this.normalized&&(t=yt(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=gi(t,this.array)),t}setY(e,t){return this.normalized&&(t=yt(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=gi(t,this.array)),t}setZ(e,t){return this.normalized&&(t=yt(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=gi(t,this.array)),t}setW(e,t){return this.normalized&&(t=yt(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,n){return e*=this.itemSize,this.normalized&&(t=yt(t,this.array),n=yt(n,this.array)),this.array[e+0]=t,this.array[e+1]=n,this}setXYZ(e,t,n,s){return e*=this.itemSize,this.normalized&&(t=yt(t,this.array),n=yt(n,this.array),s=yt(s,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=s,this}setXYZW(e,t,n,s,r){return e*=this.itemSize,this.normalized&&(t=yt(t,this.array),n=yt(n,this.array),s=yt(s,this.array),r=yt(r,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=s,this.array[e+3]=r,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){const e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(e.name=this.name),this.usage!==Qa&&(e.usage=this.usage),e}}class Cl extends gt{constructor(e,t,n){super(new Uint16Array(e),t,n)}}class Pl extends gt{constructor(e,t,n){super(new Uint32Array(e),t,n)}}class Xt extends gt{constructor(e,t,n){super(new Float32Array(e),t,n)}}let Ph=0;const Bt=new ut,mr=new At,ui=new N,It=new Ji,Ni=new Ji,mt=new N;class Ft extends Ai{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:Ph++}),this.uuid=Ri(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(bl(e)?Pl:Cl)(e,1):this.index=e,this}setIndirect(e){return this.indirect=e,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,n=0){this.groups.push({start:e,count:t,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){const t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);const n=this.attributes.normal;if(n!==void 0){const r=new Ne().getNormalMatrix(e);n.applyNormalMatrix(r),n.needsUpdate=!0}const s=this.attributes.tangent;return s!==void 0&&(s.transformDirection(e),s.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(e){return Bt.makeRotationFromQuaternion(e),this.applyMatrix4(Bt),this}rotateX(e){return Bt.makeRotationX(e),this.applyMatrix4(Bt),this}rotateY(e){return Bt.makeRotationY(e),this.applyMatrix4(Bt),this}rotateZ(e){return Bt.makeRotationZ(e),this.applyMatrix4(Bt),this}translate(e,t,n){return Bt.makeTranslation(e,t,n),this.applyMatrix4(Bt),this}scale(e,t,n){return Bt.makeScale(e,t,n),this.applyMatrix4(Bt),this}lookAt(e){return mr.lookAt(e),mr.updateMatrix(),this.applyMatrix4(mr.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(ui).negate(),this.translate(ui.x,ui.y,ui.z),this}setFromPoints(e){const t=this.getAttribute("position");if(t===void 0){const n=[];for(let s=0,r=e.length;s<r;s++){const o=e[s];n.push(o.x,o.y,o.z||0)}this.setAttribute("position",new Xt(n,3))}else{const n=Math.min(e.length,t.count);for(let s=0;s<n;s++){const r=e[s];t.setXYZ(s,r.x,r.y,r.z||0)}e.length>t.count&&console.warn("THREE.BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new Ji);const e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new N(-1/0,-1/0,-1/0),new N(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let n=0,s=t.length;n<s;n++){const r=t[n];It.setFromBufferAttribute(r),this.morphTargetsRelative?(mt.addVectors(this.boundingBox.min,It.min),this.boundingBox.expandByPoint(mt),mt.addVectors(this.boundingBox.max,It.max),this.boundingBox.expandByPoint(mt)):(this.boundingBox.expandByPoint(It.min),this.boundingBox.expandByPoint(It.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new Qi);const e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new N,1/0);return}if(e){const n=this.boundingSphere.center;if(It.setFromBufferAttribute(e),t)for(let r=0,o=t.length;r<o;r++){const a=t[r];Ni.setFromBufferAttribute(a),this.morphTargetsRelative?(mt.addVectors(It.min,Ni.min),It.expandByPoint(mt),mt.addVectors(It.max,Ni.max),It.expandByPoint(mt)):(It.expandByPoint(Ni.min),It.expandByPoint(Ni.max))}It.getCenter(n);let s=0;for(let r=0,o=e.count;r<o;r++)mt.fromBufferAttribute(e,r),s=Math.max(s,n.distanceToSquared(mt));if(t)for(let r=0,o=t.length;r<o;r++){const a=t[r],l=this.morphTargetsRelative;for(let c=0,h=a.count;c<h;c++)mt.fromBufferAttribute(a,c),l&&(ui.fromBufferAttribute(e,c),mt.add(ui)),s=Math.max(s,n.distanceToSquared(mt))}this.boundingSphere.radius=Math.sqrt(s),isNaN(this.boundingSphere.radius)&&console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){const e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}const n=t.position,s=t.normal,r=t.uv;this.hasAttribute("tangent")===!1&&this.setAttribute("tangent",new gt(new Float32Array(4*n.count),4));const o=this.getAttribute("tangent"),a=[],l=[];for(let I=0;I<n.count;I++)a[I]=new N,l[I]=new N;const c=new N,h=new N,d=new N,f=new Ke,p=new Ke,_=new Ke,v=new N,m=new N;function u(I,M,S){c.fromBufferAttribute(n,I),h.fromBufferAttribute(n,M),d.fromBufferAttribute(n,S),f.fromBufferAttribute(r,I),p.fromBufferAttribute(r,M),_.fromBufferAttribute(r,S),h.sub(c),d.sub(c),p.sub(f),_.sub(f);const L=1/(p.x*_.y-_.x*p.y);isFinite(L)&&(v.copy(h).multiplyScalar(_.y).addScaledVector(d,-p.y).multiplyScalar(L),m.copy(d).multiplyScalar(p.x).addScaledVector(h,-_.x).multiplyScalar(L),a[I].add(v),a[M].add(v),a[S].add(v),l[I].add(m),l[M].add(m),l[S].add(m))}let A=this.groups;A.length===0&&(A=[{start:0,count:e.count}]);for(let I=0,M=A.length;I<M;++I){const S=A[I],L=S.start,H=S.count;for(let W=L,j=L+H;W<j;W+=3)u(e.getX(W+0),e.getX(W+1),e.getX(W+2))}const b=new N,E=new N,P=new N,T=new N;function R(I){P.fromBufferAttribute(s,I),T.copy(P);const M=a[I];b.copy(M),b.sub(P.multiplyScalar(P.dot(M))).normalize(),E.crossVectors(T,M);const L=E.dot(l[I])<0?-1:1;o.setXYZW(I,b.x,b.y,b.z,L)}for(let I=0,M=A.length;I<M;++I){const S=A[I],L=S.start,H=S.count;for(let W=L,j=L+H;W<j;W+=3)R(e.getX(W+0)),R(e.getX(W+1)),R(e.getX(W+2))}}computeVertexNormals(){const e=this.index,t=this.getAttribute("position");if(t!==void 0){let n=this.getAttribute("normal");if(n===void 0)n=new gt(new Float32Array(t.count*3),3),this.setAttribute("normal",n);else for(let f=0,p=n.count;f<p;f++)n.setXYZ(f,0,0,0);const s=new N,r=new N,o=new N,a=new N,l=new N,c=new N,h=new N,d=new N;if(e)for(let f=0,p=e.count;f<p;f+=3){const _=e.getX(f+0),v=e.getX(f+1),m=e.getX(f+2);s.fromBufferAttribute(t,_),r.fromBufferAttribute(t,v),o.fromBufferAttribute(t,m),h.subVectors(o,r),d.subVectors(s,r),h.cross(d),a.fromBufferAttribute(n,_),l.fromBufferAttribute(n,v),c.fromBufferAttribute(n,m),a.add(h),l.add(h),c.add(h),n.setXYZ(_,a.x,a.y,a.z),n.setXYZ(v,l.x,l.y,l.z),n.setXYZ(m,c.x,c.y,c.z)}else for(let f=0,p=t.count;f<p;f+=3)s.fromBufferAttribute(t,f+0),r.fromBufferAttribute(t,f+1),o.fromBufferAttribute(t,f+2),h.subVectors(o,r),d.subVectors(s,r),h.cross(d),n.setXYZ(f+0,h.x,h.y,h.z),n.setXYZ(f+1,h.x,h.y,h.z),n.setXYZ(f+2,h.x,h.y,h.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){const e=this.attributes.normal;for(let t=0,n=e.count;t<n;t++)mt.fromBufferAttribute(e,t),mt.normalize(),e.setXYZ(t,mt.x,mt.y,mt.z)}toNonIndexed(){function e(a,l){const c=a.array,h=a.itemSize,d=a.normalized,f=new c.constructor(l.length*h);let p=0,_=0;for(let v=0,m=l.length;v<m;v++){a.isInterleavedBufferAttribute?p=l[v]*a.data.stride+a.offset:p=l[v]*h;for(let u=0;u<h;u++)f[_++]=c[p++]}return new gt(f,h,d)}if(this.index===null)return console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;const t=new Ft,n=this.index.array,s=this.attributes;for(const a in s){const l=s[a],c=e(l,n);t.setAttribute(a,c)}const r=this.morphAttributes;for(const a in r){const l=[],c=r[a];for(let h=0,d=c.length;h<d;h++){const f=c[h],p=e(f,n);l.push(p)}t.morphAttributes[a]=l}t.morphTargetsRelative=this.morphTargetsRelative;const o=this.groups;for(let a=0,l=o.length;a<l;a++){const c=o[a];t.addGroup(c.start,c.count,c.materialIndex)}return t}toJSON(){const e={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.type,this.name!==""&&(e.name=this.name),Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0){const l=this.parameters;for(const c in l)l[c]!==void 0&&(e[c]=l[c]);return e}e.data={attributes:{}};const t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});const n=this.attributes;for(const l in n){const c=n[l];e.data.attributes[l]=c.toJSON(e.data)}const s={};let r=!1;for(const l in this.morphAttributes){const c=this.morphAttributes[l],h=[];for(let d=0,f=c.length;d<f;d++){const p=c[d];h.push(p.toJSON(e.data))}h.length>0&&(s[l]=h,r=!0)}r&&(e.data.morphAttributes=s,e.data.morphTargetsRelative=this.morphTargetsRelative);const o=this.groups;o.length>0&&(e.data.groups=JSON.parse(JSON.stringify(o)));const a=this.boundingSphere;return a!==null&&(e.data.boundingSphere=a.toJSON()),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;const t={};this.name=e.name;const n=e.index;n!==null&&this.setIndex(n.clone());const s=e.attributes;for(const c in s){const h=s[c];this.setAttribute(c,h.clone(t))}const r=e.morphAttributes;for(const c in r){const h=[],d=r[c];for(let f=0,p=d.length;f<p;f++)h.push(d[f].clone(t));this.morphAttributes[c]=h}this.morphTargetsRelative=e.morphTargetsRelative;const o=e.groups;for(let c=0,h=o.length;c<h;c++){const d=o[c];this.addGroup(d.start,d.count,d.materialIndex)}const a=e.boundingBox;a!==null&&(this.boundingBox=a.clone());const l=e.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}}const mo=new ut,kn=new Da,fs=new Qi,go=new N,ps=new N,ms=new N,gs=new N,gr=new N,_s=new N,_o=new N,vs=new N;class bt extends At{constructor(e=new Ft,t=new La){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){const t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){const s=t[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,o=s.length;r<o;r++){const a=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=r}}}}getVertexPosition(e,t){const n=this.geometry,s=n.attributes.position,r=n.morphAttributes.position,o=n.morphTargetsRelative;t.fromBufferAttribute(s,e);const a=this.morphTargetInfluences;if(r&&a){_s.set(0,0,0);for(let l=0,c=r.length;l<c;l++){const h=a[l],d=r[l];h!==0&&(gr.fromBufferAttribute(d,e),o?_s.addScaledVector(gr,h):_s.addScaledVector(gr.sub(t),h))}t.add(_s)}return t}raycast(e,t){const n=this.geometry,s=this.material,r=this.matrixWorld;s!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),fs.copy(n.boundingSphere),fs.applyMatrix4(r),kn.copy(e.ray).recast(e.near),!(fs.containsPoint(kn.origin)===!1&&(kn.intersectSphere(fs,go)===null||kn.origin.distanceToSquared(go)>(e.far-e.near)**2))&&(mo.copy(r).invert(),kn.copy(e.ray).applyMatrix4(mo),!(n.boundingBox!==null&&kn.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(e,t,kn)))}_computeIntersections(e,t,n){let s;const r=this.geometry,o=this.material,a=r.index,l=r.attributes.position,c=r.attributes.uv,h=r.attributes.uv1,d=r.attributes.normal,f=r.groups,p=r.drawRange;if(a!==null)if(Array.isArray(o))for(let _=0,v=f.length;_<v;_++){const m=f[_],u=o[m.materialIndex],A=Math.max(m.start,p.start),b=Math.min(a.count,Math.min(m.start+m.count,p.start+p.count));for(let E=A,P=b;E<P;E+=3){const T=a.getX(E),R=a.getX(E+1),I=a.getX(E+2);s=xs(this,u,e,n,c,h,d,T,R,I),s&&(s.faceIndex=Math.floor(E/3),s.face.materialIndex=m.materialIndex,t.push(s))}}else{const _=Math.max(0,p.start),v=Math.min(a.count,p.start+p.count);for(let m=_,u=v;m<u;m+=3){const A=a.getX(m),b=a.getX(m+1),E=a.getX(m+2);s=xs(this,o,e,n,c,h,d,A,b,E),s&&(s.faceIndex=Math.floor(m/3),t.push(s))}}else if(l!==void 0)if(Array.isArray(o))for(let _=0,v=f.length;_<v;_++){const m=f[_],u=o[m.materialIndex],A=Math.max(m.start,p.start),b=Math.min(l.count,Math.min(m.start+m.count,p.start+p.count));for(let E=A,P=b;E<P;E+=3){const T=E,R=E+1,I=E+2;s=xs(this,u,e,n,c,h,d,T,R,I),s&&(s.faceIndex=Math.floor(E/3),s.face.materialIndex=m.materialIndex,t.push(s))}}else{const _=Math.max(0,p.start),v=Math.min(l.count,p.start+p.count);for(let m=_,u=v;m<u;m+=3){const A=m,b=m+1,E=m+2;s=xs(this,o,e,n,c,h,d,A,b,E),s&&(s.faceIndex=Math.floor(m/3),t.push(s))}}}}function Dh(i,e,t,n,s,r,o,a){let l;if(e.side===wt?l=n.intersectTriangle(o,r,s,!0,a):l=n.intersectTriangle(s,r,o,e.side===Un,a),l===null)return null;vs.copy(a),vs.applyMatrix4(i.matrixWorld);const c=t.ray.origin.distanceTo(vs);return c<t.near||c>t.far?null:{distance:c,point:vs.clone(),object:i}}function xs(i,e,t,n,s,r,o,a,l,c){i.getVertexPosition(a,ps),i.getVertexPosition(l,ms),i.getVertexPosition(c,gs);const h=Dh(i,e,t,n,ps,ms,gs,_o);if(h){const d=new N;Zt.getBarycoord(_o,ps,ms,gs,d),s&&(h.uv=Zt.getInterpolatedAttribute(s,a,l,c,d,new Ke)),r&&(h.uv1=Zt.getInterpolatedAttribute(r,a,l,c,d,new Ke)),o&&(h.normal=Zt.getInterpolatedAttribute(o,a,l,c,d,new N),h.normal.dot(n.direction)>0&&h.normal.multiplyScalar(-1));const f={a,b:l,c,normal:new N,materialIndex:0};Zt.getNormal(ps,ms,gs,f.normal),h.face=f,h.barycoord=d}return h}class es extends Ft{constructor(e=1,t=1,n=1,s=1,r=1,o=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:n,widthSegments:s,heightSegments:r,depthSegments:o};const a=this;s=Math.floor(s),r=Math.floor(r),o=Math.floor(o);const l=[],c=[],h=[],d=[];let f=0,p=0;_("z","y","x",-1,-1,n,t,e,o,r,0),_("z","y","x",1,-1,n,t,-e,o,r,1),_("x","z","y",1,1,e,n,t,s,o,2),_("x","z","y",1,-1,e,n,-t,s,o,3),_("x","y","z",1,-1,e,t,n,s,r,4),_("x","y","z",-1,-1,e,t,-n,s,r,5),this.setIndex(l),this.setAttribute("position",new Xt(c,3)),this.setAttribute("normal",new Xt(h,3)),this.setAttribute("uv",new Xt(d,2));function _(v,m,u,A,b,E,P,T,R,I,M){const S=E/R,L=P/I,H=E/2,W=P/2,j=T/2,q=R+1,$=I+1;let J=0,B=0;const C=new N;for(let he=0;he<$;he++){const pe=he*L-W;for(let Oe=0;Oe<q;Oe++){const Ve=Oe*S-H;C[v]=Ve*A,C[m]=pe*b,C[u]=j,c.push(C.x,C.y,C.z),C[v]=0,C[m]=0,C[u]=T>0?1:-1,h.push(C.x,C.y,C.z),d.push(Oe/R),d.push(1-he/I),J+=1}}for(let he=0;he<I;he++)for(let pe=0;pe<R;pe++){const Oe=f+pe+q*he,Ve=f+pe+q*(he+1),Qe=f+(pe+1)+q*(he+1),We=f+(pe+1)+q*he;l.push(Oe,Ve,We),l.push(Ve,Qe,We),B+=6}a.addGroup(p,B,M),p+=B,f+=J}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new es(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}}function Ti(i){const e={};for(const t in i){e[t]={};for(const n in i[t]){const s=i[t][n];s&&(s.isColor||s.isMatrix3||s.isMatrix4||s.isVector2||s.isVector3||s.isVector4||s.isTexture||s.isQuaternion)?s.isRenderTargetTexture?(console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][n]=null):e[t][n]=s.clone():Array.isArray(s)?e[t][n]=s.slice():e[t][n]=s}}return e}function Tt(i){const e={};for(let t=0;t<i.length;t++){const n=Ti(i[t]);for(const s in n)e[s]=n[s]}return e}function Lh(i){const e=[];for(let t=0;t<i.length;t++)e.push(i[t].clone());return e}function Dl(i){const e=i.getRenderTarget();return e===null?i.outputColorSpace:e.isXRRenderTarget===!0?e.texture.colorSpace:Xe.workingColorSpace}const Uh={clone:Ti,merge:Tt};var Ih=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,Fh=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class Pt extends Pi{constructor(e){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=Ih,this.fragmentShader=Fh,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=Ti(e.uniforms),this.uniformsGroups=Lh(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this}toJSON(e){const t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(const s in this.uniforms){const o=this.uniforms[s].value;o&&o.isTexture?t.uniforms[s]={type:"t",value:o.toJSON(e).uuid}:o&&o.isColor?t.uniforms[s]={type:"c",value:o.getHex()}:o&&o.isVector2?t.uniforms[s]={type:"v2",value:o.toArray()}:o&&o.isVector3?t.uniforms[s]={type:"v3",value:o.toArray()}:o&&o.isVector4?t.uniforms[s]={type:"v4",value:o.toArray()}:o&&o.isMatrix3?t.uniforms[s]={type:"m3",value:o.toArray()}:o&&o.isMatrix4?t.uniforms[s]={type:"m4",value:o.toArray()}:t.uniforms[s]={value:o}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;const n={};for(const s in this.extensions)this.extensions[s]===!0&&(n[s]=!0);return Object.keys(n).length>0&&(t.extensions=n),t}}class Ll extends At{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new ut,this.projectionMatrix=new ut,this.projectionMatrixInverse=new ut,this.coordinateSystem=rn,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix(e,t){super.updateWorldMatrix(e,t),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}}const yn=new N,vo=new Ke,xo=new Ke;class Gt extends Ll{constructor(e=50,t=1,n=.1,s=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=n,this.far=s,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){const t=.5*this.getFilmHeight()/e;this.fov=Ki*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){const e=Math.tan(Gi*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return Ki*2*Math.atan(Math.tan(Gi*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,n){yn.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(yn.x,yn.y).multiplyScalar(-e/yn.z),yn.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(yn.x,yn.y).multiplyScalar(-e/yn.z)}getViewSize(e,t){return this.getViewBounds(e,vo,xo),t.subVectors(xo,vo)}setViewOffset(e,t,n,s,r,o){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=this.near;let t=e*Math.tan(Gi*.5*this.fov)/this.zoom,n=2*t,s=this.aspect*n,r=-.5*s;const o=this.view;if(this.view!==null&&this.view.enabled){const l=o.fullWidth,c=o.fullHeight;r+=o.offsetX*s/l,t-=o.offsetY*n/c,s*=o.width/l,n*=o.height/c}const a=this.filmOffset;a!==0&&(r+=e*a/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+s,t,t-n,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}}const di=-90,fi=1;class Nh extends At{constructor(e,t,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;const s=new Gt(di,fi,e,t);s.layers=this.layers,this.add(s);const r=new Gt(di,fi,e,t);r.layers=this.layers,this.add(r);const o=new Gt(di,fi,e,t);o.layers=this.layers,this.add(o);const a=new Gt(di,fi,e,t);a.layers=this.layers,this.add(a);const l=new Gt(di,fi,e,t);l.layers=this.layers,this.add(l);const c=new Gt(di,fi,e,t);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){const e=this.coordinateSystem,t=this.children.concat(),[n,s,r,o,a,l]=t;for(const c of t)this.remove(c);if(e===rn)n.up.set(0,1,0),n.lookAt(1,0,0),s.up.set(0,1,0),s.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),o.up.set(0,0,1),o.lookAt(0,-1,0),a.up.set(0,1,0),a.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(e===Bs)n.up.set(0,-1,0),n.lookAt(-1,0,0),s.up.set(0,-1,0),s.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),o.up.set(0,0,-1),o.lookAt(0,-1,0),a.up.set(0,-1,0),a.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(const c of t)this.add(c),c.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();const{renderTarget:n,activeMipmapLevel:s}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());const[r,o,a,l,c,h]=this.children,d=e.getRenderTarget(),f=e.getActiveCubeFace(),p=e.getActiveMipmapLevel(),_=e.xr.enabled;e.xr.enabled=!1;const v=n.texture.generateMipmaps;n.texture.generateMipmaps=!1,e.setRenderTarget(n,0,s),e.render(t,r),e.setRenderTarget(n,1,s),e.render(t,o),e.setRenderTarget(n,2,s),e.render(t,a),e.setRenderTarget(n,3,s),e.render(t,l),e.setRenderTarget(n,4,s),e.render(t,c),n.texture.generateMipmaps=v,e.setRenderTarget(n,5,s),e.render(t,h),e.setRenderTarget(d,f,p),e.xr.enabled=_,n.texture.needsPMREMUpdate=!0}}class Ul extends vt{constructor(e=[],t=Ei,n,s,r,o,a,l,c,h){super(e,t,n,s,r,o,a,l,c,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}}class Oh extends In{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;const n={width:e,height:e,depth:1},s=[n,n,n,n,n,n];this.texture=new Ul(s),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;const n={uniforms:{tEquirect:{value:null}},vertexShader:`

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
			`},s=new es(5,5,5),r=new Pt({name:"CubemapFromEquirect",uniforms:Ti(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:wt,blending:Dn});r.uniforms.tEquirect.value=t;const o=new bt(s,r),a=t.minFilter;return t.minFilter===jn&&(t.minFilter=sn),new Nh(1,10,this).update(e,o),t.minFilter=a,o.geometry.dispose(),o.material.dispose(),this}clear(e,t=!0,n=!0,s=!0){const r=e.getRenderTarget();for(let o=0;o<6;o++)e.setRenderTarget(this,o),e.clear(t,n,s);e.setRenderTarget(r)}}class zi extends At{constructor(){super(),this.isGroup=!0,this.type="Group"}}const Bh={type:"move"};class _r{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new zi,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new zi,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new N,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new N),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new zi,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new N,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new N),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){const t=this._hand;if(t)for(const n of e.hand.values())this._getHandJoint(t,n)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,n){let s=null,r=null,o=null;const a=this._targetRay,l=this._grip,c=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(c&&e.hand){o=!0;for(const v of e.hand.values()){const m=t.getJointPose(v,n),u=this._getHandJoint(c,v);m!==null&&(u.matrix.fromArray(m.transform.matrix),u.matrix.decompose(u.position,u.rotation,u.scale),u.matrixWorldNeedsUpdate=!0,u.jointRadius=m.radius),u.visible=m!==null}const h=c.joints["index-finger-tip"],d=c.joints["thumb-tip"],f=h.position.distanceTo(d.position),p=.02,_=.005;c.inputState.pinching&&f>p+_?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!c.inputState.pinching&&f<=p-_&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else l!==null&&e.gripSpace&&(r=t.getPose(e.gripSpace,n),r!==null&&(l.matrix.fromArray(r.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,r.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(r.linearVelocity)):l.hasLinearVelocity=!1,r.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(r.angularVelocity)):l.hasAngularVelocity=!1));a!==null&&(s=t.getPose(e.targetRaySpace,n),s===null&&r!==null&&(s=r),s!==null&&(a.matrix.fromArray(s.transform.matrix),a.matrix.decompose(a.position,a.rotation,a.scale),a.matrixWorldNeedsUpdate=!0,s.linearVelocity?(a.hasLinearVelocity=!0,a.linearVelocity.copy(s.linearVelocity)):a.hasLinearVelocity=!1,s.angularVelocity?(a.hasAngularVelocity=!0,a.angularVelocity.copy(s.angularVelocity)):a.hasAngularVelocity=!1,this.dispatchEvent(Bh)))}return a!==null&&(a.visible=s!==null),l!==null&&(l.visible=r!==null),c!==null&&(c.visible=o!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){const n=new zi;n.matrixAutoUpdate=!1,n.visible=!1,e.joints[t.jointName]=n,e.add(n)}return e.joints[t.jointName]}}class Ua extends At{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new _n,this.environmentIntensity=1,this.environmentRotation=new _n,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){const t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(t.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(t.object.backgroundIntensity=this.backgroundIntensity),t.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(t.object.environmentIntensity=this.environmentIntensity),t.object.environmentRotation=this.environmentRotation.toArray(),t}}class zh extends vt{constructor(e=null,t=1,n=1,s,r,o,a,l,c=ht,h=ht,d,f){super(null,o,a,l,c,h,s,r,d,f),this.isDataTexture=!0,this.image={data:e,width:t,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}const vr=new N,kh=new N,Hh=new Ne;class Wn{constructor(e=new N(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,n,s){return this.normal.set(e,t,n),this.constant=s,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,n){const s=vr.subVectors(n,t).cross(kh.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(s,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){const e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t){const n=e.delta(vr),s=this.normal.dot(n);if(s===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;const r=-(e.start.dot(this.normal)+this.constant)/s;return r<0||r>1?null:t.copy(e.start).addScaledVector(n,r)}intersectsLine(e){const t=this.distanceToPoint(e.start),n=this.distanceToPoint(e.end);return t<0&&n>0||n<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){const n=t||Hh.getNormalMatrix(e),s=this.coplanarPoint(vr).applyMatrix4(e),r=this.normal.applyMatrix3(n).normalize();return this.constant=-s.dot(r),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}}const Hn=new Qi,Gh=new Ke(.5,.5),Ss=new N;class Il{constructor(e=new Wn,t=new Wn,n=new Wn,s=new Wn,r=new Wn,o=new Wn){this.planes=[e,t,n,s,r,o]}set(e,t,n,s,r,o){const a=this.planes;return a[0].copy(e),a[1].copy(t),a[2].copy(n),a[3].copy(s),a[4].copy(r),a[5].copy(o),this}copy(e){const t=this.planes;for(let n=0;n<6;n++)t[n].copy(e.planes[n]);return this}setFromProjectionMatrix(e,t=rn,n=!1){const s=this.planes,r=e.elements,o=r[0],a=r[1],l=r[2],c=r[3],h=r[4],d=r[5],f=r[6],p=r[7],_=r[8],v=r[9],m=r[10],u=r[11],A=r[12],b=r[13],E=r[14],P=r[15];if(s[0].setComponents(c-o,p-h,u-_,P-A).normalize(),s[1].setComponents(c+o,p+h,u+_,P+A).normalize(),s[2].setComponents(c+a,p+d,u+v,P+b).normalize(),s[3].setComponents(c-a,p-d,u-v,P-b).normalize(),n)s[4].setComponents(l,f,m,E).normalize(),s[5].setComponents(c-l,p-f,u-m,P-E).normalize();else if(s[4].setComponents(c-l,p-f,u-m,P-E).normalize(),t===rn)s[5].setComponents(c+l,p+f,u+m,P+E).normalize();else if(t===Bs)s[5].setComponents(l,f,m,E).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),Hn.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{const t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),Hn.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(Hn)}intersectsSprite(e){Hn.center.set(0,0,0);const t=Gh.distanceTo(e.center);return Hn.radius=.7071067811865476+t,Hn.applyMatrix4(e.matrixWorld),this.intersectsSphere(Hn)}intersectsSphere(e){const t=this.planes,n=e.center,s=-e.radius;for(let r=0;r<6;r++)if(t[r].distanceToPoint(n)<s)return!1;return!0}intersectsBox(e){const t=this.planes;for(let n=0;n<6;n++){const s=t[n];if(Ss.x=s.normal.x>0?e.max.x:e.min.x,Ss.y=s.normal.y>0?e.max.y:e.min.y,Ss.z=s.normal.z>0?e.max.z:e.min.z,s.distanceToPoint(Ss)<0)return!1}return!0}containsPoint(e){const t=this.planes;for(let n=0;n<6;n++)if(t[n].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}class Fl extends Pi{constructor(e){super(),this.isLineBasicMaterial=!0,this.type="LineBasicMaterial",this.color=new ze(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.linewidth=e.linewidth,this.linecap=e.linecap,this.linejoin=e.linejoin,this.fog=e.fog,this}}const ks=new N,Hs=new N,So=new ut,Oi=new Da,Ms=new Qi,xr=new N,Mo=new N;class Vh extends At{constructor(e=new Ft,t=new Fl){super(),this.isLine=!0,this.type="Line",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}computeLineDistances(){const e=this.geometry;if(e.index===null){const t=e.attributes.position,n=[0];for(let s=1,r=t.count;s<r;s++)ks.fromBufferAttribute(t,s-1),Hs.fromBufferAttribute(t,s),n[s]=n[s-1],n[s]+=ks.distanceTo(Hs);e.setAttribute("lineDistance",new Xt(n,1))}else console.warn("THREE.Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}raycast(e,t){const n=this.geometry,s=this.matrixWorld,r=e.params.Line.threshold,o=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Ms.copy(n.boundingSphere),Ms.applyMatrix4(s),Ms.radius+=r,e.ray.intersectsSphere(Ms)===!1)return;So.copy(s).invert(),Oi.copy(e.ray).applyMatrix4(So);const a=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=a*a,c=this.isLineSegments?2:1,h=n.index,f=n.attributes.position;if(h!==null){const p=Math.max(0,o.start),_=Math.min(h.count,o.start+o.count);for(let v=p,m=_-1;v<m;v+=c){const u=h.getX(v),A=h.getX(v+1),b=Es(this,e,Oi,l,u,A,v);b&&t.push(b)}if(this.isLineLoop){const v=h.getX(_-1),m=h.getX(p),u=Es(this,e,Oi,l,v,m,_-1);u&&t.push(u)}}else{const p=Math.max(0,o.start),_=Math.min(f.count,o.start+o.count);for(let v=p,m=_-1;v<m;v+=c){const u=Es(this,e,Oi,l,v,v+1,v);u&&t.push(u)}if(this.isLineLoop){const v=Es(this,e,Oi,l,_-1,p,_-1);v&&t.push(v)}}}updateMorphTargets(){const t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){const s=t[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,o=s.length;r<o;r++){const a=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=r}}}}}function Es(i,e,t,n,s,r,o){const a=i.geometry.attributes.position;if(ks.fromBufferAttribute(a,s),Hs.fromBufferAttribute(a,r),t.distanceSqToSegment(ks,Hs,xr,Mo)>n)return;xr.applyMatrix4(i.matrixWorld);const c=e.ray.origin.distanceTo(xr);if(!(c<e.near||c>e.far))return{distance:c,point:Mo.clone().applyMatrix4(i.matrixWorld),index:o,face:null,faceIndex:null,barycoord:null,object:i}}const Eo=new N,yo=new N;class Wh extends Vh{constructor(e,t){super(e,t),this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){const e=this.geometry;if(e.index===null){const t=e.attributes.position,n=[];for(let s=0,r=t.count;s<r;s+=2)Eo.fromBufferAttribute(t,s),yo.fromBufferAttribute(t,s+1),n[s]=s===0?0:n[s-1],n[s+1]=n[s]+Eo.distanceTo(yo);e.setAttribute("lineDistance",new Xt(n,1))}else console.warn("THREE.LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}}class Xh extends Pi{constructor(e){super(),this.isPointsMaterial=!0,this.type="PointsMaterial",this.color=new ze(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.size=e.size,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}}const To=new ut,xa=new Da,ys=new Qi,Ts=new N;class qh extends At{constructor(e=new Ft,t=new Xh){super(),this.isPoints=!0,this.type="Points",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}raycast(e,t){const n=this.geometry,s=this.matrixWorld,r=e.params.Points.threshold,o=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),ys.copy(n.boundingSphere),ys.applyMatrix4(s),ys.radius+=r,e.ray.intersectsSphere(ys)===!1)return;To.copy(s).invert(),xa.copy(e.ray).applyMatrix4(To);const a=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=a*a,c=n.index,d=n.attributes.position;if(c!==null){const f=Math.max(0,o.start),p=Math.min(c.count,o.start+o.count);for(let _=f,v=p;_<v;_++){const m=c.getX(_);Ts.fromBufferAttribute(d,m),bo(Ts,m,l,s,e,t,this)}}else{const f=Math.max(0,o.start),p=Math.min(d.count,o.start+o.count);for(let _=f,v=p;_<v;_++)Ts.fromBufferAttribute(d,_),bo(Ts,_,l,s,e,t,this)}}updateMorphTargets(){const t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){const s=t[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,o=s.length;r<o;r++){const a=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=r}}}}}function bo(i,e,t,n,s,r,o){const a=xa.distanceSqToPoint(i);if(a<t){const l=new N;xa.closestPointToPoint(i,l),l.applyMatrix4(n);const c=s.ray.origin.distanceTo(l);if(c<s.near||c>s.far)return;r.push({distance:c,distanceToRay:Math.sqrt(a),point:l,index:e,face:null,faceIndex:null,barycoord:null,object:o})}}class Yh extends vt{constructor(e,t,n,s,r,o,a,l,c){super(e,t,n,s,r,o,a,l,c),this.isCanvasTexture=!0,this.needsUpdate=!0}}class Nl extends vt{constructor(e,t,n=Jn,s,r,o,a=ht,l=ht,c,h=Yi,d=1){if(h!==Yi&&h!==$i)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");const f={width:e,height:t,depth:d};super(f,s,r,o,a,l,h,n,c),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new Pa(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){const t=super.toJSON(e);return this.compareFunction!==null&&(t.compareFunction=this.compareFunction),t}}class Ol extends vt{constructor(e=null){super(),this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}}class Fn extends Ft{constructor(e=1,t=1,n=1,s=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:n,heightSegments:s};const r=e/2,o=t/2,a=Math.floor(n),l=Math.floor(s),c=a+1,h=l+1,d=e/a,f=t/l,p=[],_=[],v=[],m=[];for(let u=0;u<h;u++){const A=u*f-o;for(let b=0;b<c;b++){const E=b*d-r;_.push(E,-A,0),v.push(0,0,1),m.push(b/a),m.push(1-u/l)}}for(let u=0;u<l;u++)for(let A=0;A<a;A++){const b=A+c*u,E=A+c*(u+1),P=A+1+c*(u+1),T=A+1+c*u;p.push(b,E,T),p.push(E,P,T)}this.setIndex(p),this.setAttribute("position",new Xt(_,3)),this.setAttribute("normal",new Xt(v,3)),this.setAttribute("uv",new Xt(m,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Fn(e.width,e.height,e.widthSegments,e.heightSegments)}}class Ia extends Ft{constructor(e=1,t=32,n=16,s=0,r=Math.PI*2,o=0,a=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:e,widthSegments:t,heightSegments:n,phiStart:s,phiLength:r,thetaStart:o,thetaLength:a},t=Math.max(3,Math.floor(t)),n=Math.max(2,Math.floor(n));const l=Math.min(o+a,Math.PI);let c=0;const h=[],d=new N,f=new N,p=[],_=[],v=[],m=[];for(let u=0;u<=n;u++){const A=[],b=u/n;let E=0;u===0&&o===0?E=.5/t:u===n&&l===Math.PI&&(E=-.5/t);for(let P=0;P<=t;P++){const T=P/t;d.x=-e*Math.cos(s+T*r)*Math.sin(o+b*a),d.y=e*Math.cos(o+b*a),d.z=e*Math.sin(s+T*r)*Math.sin(o+b*a),_.push(d.x,d.y,d.z),f.copy(d).normalize(),v.push(f.x,f.y,f.z),m.push(T+E,1-b),A.push(c++)}h.push(A)}for(let u=0;u<n;u++)for(let A=0;A<t;A++){const b=h[u][A+1],E=h[u][A],P=h[u+1][A],T=h[u+1][A+1];(u!==0||o>0)&&p.push(b,E,T),(u!==n-1||l<Math.PI)&&p.push(E,P,T)}this.setIndex(p),this.setAttribute("position",new Xt(_,3)),this.setAttribute("normal",new Xt(v,3)),this.setAttribute("uv",new Xt(m,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Ia(e.radius,e.widthSegments,e.heightSegments,e.phiStart,e.phiLength,e.thetaStart,e.thetaLength)}}class $h extends Pi{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=kc,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}}class Kh extends Pi{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}}class Fa extends Ll{constructor(e=-1,t=1,n=1,s=-1,r=.1,o=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=n,this.bottom=s,this.near=r,this.far=o,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,n,s,r,o){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,s=(this.top+this.bottom)/2;let r=n-e,o=n+e,a=s+t,l=s-t;if(this.view!==null&&this.view.enabled){const c=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=c*this.view.offsetX,o=r+c*this.view.width,a-=h*this.view.offsetY,l=a-h*this.view.height}this.projectionMatrix.makeOrthographic(r,o,a,l,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}}class jh extends Gt{constructor(e=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e}}function wo(i,e,t,n){const s=Zh(n);switch(t){case Sl:return i*e;case El:return i*e/s.components*s.byteLength;case wa:return i*e/s.components*s.byteLength;case yl:return i*e*2/s.components*s.byteLength;case Aa:return i*e*2/s.components*s.byteLength;case Ml:return i*e*3/s.components*s.byteLength;case Wt:return i*e*4/s.components*s.byteLength;case Ra:return i*e*4/s.components*s.byteLength;case Cs:case Ps:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*8;case Ds:case Ls:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case qr:case $r:return Math.max(i,16)*Math.max(e,8)/4;case Xr:case Yr:return Math.max(i,8)*Math.max(e,8)/2;case Kr:case jr:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*8;case Zr:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case Jr:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case Qr:return Math.floor((i+4)/5)*Math.floor((e+3)/4)*16;case ea:return Math.floor((i+4)/5)*Math.floor((e+4)/5)*16;case ta:return Math.floor((i+5)/6)*Math.floor((e+4)/5)*16;case na:return Math.floor((i+5)/6)*Math.floor((e+5)/6)*16;case ia:return Math.floor((i+7)/8)*Math.floor((e+4)/5)*16;case sa:return Math.floor((i+7)/8)*Math.floor((e+5)/6)*16;case ra:return Math.floor((i+7)/8)*Math.floor((e+7)/8)*16;case aa:return Math.floor((i+9)/10)*Math.floor((e+4)/5)*16;case oa:return Math.floor((i+9)/10)*Math.floor((e+5)/6)*16;case la:return Math.floor((i+9)/10)*Math.floor((e+7)/8)*16;case ca:return Math.floor((i+9)/10)*Math.floor((e+9)/10)*16;case ha:return Math.floor((i+11)/12)*Math.floor((e+9)/10)*16;case ua:return Math.floor((i+11)/12)*Math.floor((e+11)/12)*16;case da:case fa:case pa:return Math.ceil(i/4)*Math.ceil(e/4)*16;case ma:case ga:return Math.ceil(i/4)*Math.ceil(e/4)*8;case _a:case va:return Math.ceil(i/4)*Math.ceil(e/4)*16}throw new Error(`Unable to determine texture byte length for ${t} format.`)}function Zh(i){switch(i){case gn:case gl:return{byteLength:1,components:1};case Xi:case _l:case Zi:return{byteLength:2,components:1};case Ta:case ba:return{byteLength:2,components:4};case Jn:case ya:case pn:return{byteLength:4,components:1};case vl:case xl:return{byteLength:4,components:3}}throw new Error(`Unknown texture type ${i}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:Ea}}));typeof window<"u"&&(window.__THREE__?console.warn("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=Ea);function Bl(){let i=null,e=!1,t=null,n=null;function s(r,o){t(r,o),n=i.requestAnimationFrame(s)}return{start:function(){e!==!0&&t!==null&&(n=i.requestAnimationFrame(s),e=!0)},stop:function(){i.cancelAnimationFrame(n),e=!1},setAnimationLoop:function(r){t=r},setContext:function(r){i=r}}}function Jh(i){const e=new WeakMap;function t(a,l){const c=a.array,h=a.usage,d=c.byteLength,f=i.createBuffer();i.bindBuffer(l,f),i.bufferData(l,c,h),a.onUploadCallback();let p;if(c instanceof Float32Array)p=i.FLOAT;else if(typeof Float16Array<"u"&&c instanceof Float16Array)p=i.HALF_FLOAT;else if(c instanceof Uint16Array)a.isFloat16BufferAttribute?p=i.HALF_FLOAT:p=i.UNSIGNED_SHORT;else if(c instanceof Int16Array)p=i.SHORT;else if(c instanceof Uint32Array)p=i.UNSIGNED_INT;else if(c instanceof Int32Array)p=i.INT;else if(c instanceof Int8Array)p=i.BYTE;else if(c instanceof Uint8Array)p=i.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)p=i.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:f,type:p,bytesPerElement:c.BYTES_PER_ELEMENT,version:a.version,size:d}}function n(a,l,c){const h=l.array,d=l.updateRanges;if(i.bindBuffer(c,a),d.length===0)i.bufferSubData(c,0,h);else{d.sort((p,_)=>p.start-_.start);let f=0;for(let p=1;p<d.length;p++){const _=d[f],v=d[p];v.start<=_.start+_.count+1?_.count=Math.max(_.count,v.start+v.count-_.start):(++f,d[f]=v)}d.length=f+1;for(let p=0,_=d.length;p<_;p++){const v=d[p];i.bufferSubData(c,v.start*h.BYTES_PER_ELEMENT,h,v.start,v.count)}l.clearUpdateRanges()}l.onUploadCallback()}function s(a){return a.isInterleavedBufferAttribute&&(a=a.data),e.get(a)}function r(a){a.isInterleavedBufferAttribute&&(a=a.data);const l=e.get(a);l&&(i.deleteBuffer(l.buffer),e.delete(a))}function o(a,l){if(a.isInterleavedBufferAttribute&&(a=a.data),a.isGLBufferAttribute){const h=e.get(a);(!h||h.version<a.version)&&e.set(a,{buffer:a.buffer,type:a.type,bytesPerElement:a.elementSize,version:a.version});return}const c=e.get(a);if(c===void 0)e.set(a,t(a,l));else if(c.version<a.version){if(c.size!==a.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");n(c.buffer,a,l),c.version=a.version}}return{get:s,remove:r,update:o}}var Qh=`#ifdef USE_ALPHAHASH
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
#endif`,Su=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec3 vColor;
#endif`,Mu=`#if defined( USE_COLOR_ALPHA )
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,ju=`PhysicalMaterial material;
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
#endif`,Zu=`struct PhysicalMaterial {
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
#endif`,Sd=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,Md=`#ifdef USE_NORMALMAP
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
#endif`,jd=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,Zd=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
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
}`,Sf=`#define NORMAL
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
}`,Mf=`#define PHONG
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
}`,Be={alphahash_fragment:Qh,alphahash_pars_fragment:eu,alphamap_fragment:tu,alphamap_pars_fragment:nu,alphatest_fragment:iu,alphatest_pars_fragment:su,aomap_fragment:ru,aomap_pars_fragment:au,batching_pars_vertex:ou,batching_vertex:lu,begin_vertex:cu,beginnormal_vertex:hu,bsdfs:uu,iridescence_fragment:du,bumpmap_pars_fragment:fu,clipping_planes_fragment:pu,clipping_planes_pars_fragment:mu,clipping_planes_pars_vertex:gu,clipping_planes_vertex:_u,color_fragment:vu,color_pars_fragment:xu,color_pars_vertex:Su,color_vertex:Mu,common:Eu,cube_uv_reflection_fragment:yu,defaultnormal_vertex:Tu,displacementmap_pars_vertex:bu,displacementmap_vertex:wu,emissivemap_fragment:Au,emissivemap_pars_fragment:Ru,colorspace_fragment:Cu,colorspace_pars_fragment:Pu,envmap_fragment:Du,envmap_common_pars_fragment:Lu,envmap_pars_fragment:Uu,envmap_pars_vertex:Iu,envmap_physical_pars_fragment:Xu,envmap_vertex:Fu,fog_vertex:Nu,fog_pars_vertex:Ou,fog_fragment:Bu,fog_pars_fragment:zu,gradientmap_pars_fragment:ku,lightmap_pars_fragment:Hu,lights_lambert_fragment:Gu,lights_lambert_pars_fragment:Vu,lights_pars_begin:Wu,lights_toon_fragment:qu,lights_toon_pars_fragment:Yu,lights_phong_fragment:$u,lights_phong_pars_fragment:Ku,lights_physical_fragment:ju,lights_physical_pars_fragment:Zu,lights_fragment_begin:Ju,lights_fragment_maps:Qu,lights_fragment_end:ed,logdepthbuf_fragment:td,logdepthbuf_pars_fragment:nd,logdepthbuf_pars_vertex:id,logdepthbuf_vertex:sd,map_fragment:rd,map_pars_fragment:ad,map_particle_fragment:od,map_particle_pars_fragment:ld,metalnessmap_fragment:cd,metalnessmap_pars_fragment:hd,morphinstance_vertex:ud,morphcolor_vertex:dd,morphnormal_vertex:fd,morphtarget_pars_vertex:pd,morphtarget_vertex:md,normal_fragment_begin:gd,normal_fragment_maps:_d,normal_pars_fragment:vd,normal_pars_vertex:xd,normal_vertex:Sd,normalmap_pars_fragment:Md,clearcoat_normal_fragment_begin:Ed,clearcoat_normal_fragment_maps:yd,clearcoat_pars_fragment:Td,iridescence_pars_fragment:bd,opaque_fragment:wd,packing:Ad,premultiplied_alpha_fragment:Rd,project_vertex:Cd,dithering_fragment:Pd,dithering_pars_fragment:Dd,roughnessmap_fragment:Ld,roughnessmap_pars_fragment:Ud,shadowmap_pars_fragment:Id,shadowmap_pars_vertex:Fd,shadowmap_vertex:Nd,shadowmask_pars_fragment:Od,skinbase_vertex:Bd,skinning_pars_vertex:zd,skinning_vertex:kd,skinnormal_vertex:Hd,specularmap_fragment:Gd,specularmap_pars_fragment:Vd,tonemapping_fragment:Wd,tonemapping_pars_fragment:Xd,transmission_fragment:qd,transmission_pars_fragment:Yd,uv_pars_fragment:$d,uv_pars_vertex:Kd,uv_vertex:jd,worldpos_vertex:Zd,background_vert:Jd,background_frag:Qd,backgroundCube_vert:ef,backgroundCube_frag:tf,cube_vert:nf,cube_frag:sf,depth_vert:rf,depth_frag:af,distanceRGBA_vert:of,distanceRGBA_frag:lf,equirect_vert:cf,equirect_frag:hf,linedashed_vert:uf,linedashed_frag:df,meshbasic_vert:ff,meshbasic_frag:pf,meshlambert_vert:mf,meshlambert_frag:gf,meshmatcap_vert:_f,meshmatcap_frag:vf,meshnormal_vert:xf,meshnormal_frag:Sf,meshphong_vert:Mf,meshphong_frag:Ef,meshphysical_vert:yf,meshphysical_frag:Tf,meshtoon_vert:bf,meshtoon_frag:wf,points_vert:Af,points_frag:Rf,shadow_vert:Cf,shadow_frag:Pf,sprite_vert:Df,sprite_frag:Lf},ae={common:{diffuse:{value:new ze(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Ne},alphaMap:{value:null},alphaMapTransform:{value:new Ne},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Ne}},envmap:{envMap:{value:null},envMapRotation:{value:new Ne},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Ne}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Ne}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Ne},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Ne},normalScale:{value:new Ke(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Ne},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Ne}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Ne}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Ne}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new ze(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotShadowMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new ze(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Ne},alphaTest:{value:0},uvTransform:{value:new Ne}},sprite:{diffuse:{value:new ze(16777215)},opacity:{value:1},center:{value:new Ke(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Ne},alphaMap:{value:null},alphaMapTransform:{value:new Ne},alphaTest:{value:0}}},tn={basic:{uniforms:Tt([ae.common,ae.specularmap,ae.envmap,ae.aomap,ae.lightmap,ae.fog]),vertexShader:Be.meshbasic_vert,fragmentShader:Be.meshbasic_frag},lambert:{uniforms:Tt([ae.common,ae.specularmap,ae.envmap,ae.aomap,ae.lightmap,ae.emissivemap,ae.bumpmap,ae.normalmap,ae.displacementmap,ae.fog,ae.lights,{emissive:{value:new ze(0)}}]),vertexShader:Be.meshlambert_vert,fragmentShader:Be.meshlambert_frag},phong:{uniforms:Tt([ae.common,ae.specularmap,ae.envmap,ae.aomap,ae.lightmap,ae.emissivemap,ae.bumpmap,ae.normalmap,ae.displacementmap,ae.fog,ae.lights,{emissive:{value:new ze(0)},specular:{value:new ze(1118481)},shininess:{value:30}}]),vertexShader:Be.meshphong_vert,fragmentShader:Be.meshphong_frag},standard:{uniforms:Tt([ae.common,ae.envmap,ae.aomap,ae.lightmap,ae.emissivemap,ae.bumpmap,ae.normalmap,ae.displacementmap,ae.roughnessmap,ae.metalnessmap,ae.fog,ae.lights,{emissive:{value:new ze(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Be.meshphysical_vert,fragmentShader:Be.meshphysical_frag},toon:{uniforms:Tt([ae.common,ae.aomap,ae.lightmap,ae.emissivemap,ae.bumpmap,ae.normalmap,ae.displacementmap,ae.gradientmap,ae.fog,ae.lights,{emissive:{value:new ze(0)}}]),vertexShader:Be.meshtoon_vert,fragmentShader:Be.meshtoon_frag},matcap:{uniforms:Tt([ae.common,ae.bumpmap,ae.normalmap,ae.displacementmap,ae.fog,{matcap:{value:null}}]),vertexShader:Be.meshmatcap_vert,fragmentShader:Be.meshmatcap_frag},points:{uniforms:Tt([ae.points,ae.fog]),vertexShader:Be.points_vert,fragmentShader:Be.points_frag},dashed:{uniforms:Tt([ae.common,ae.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Be.linedashed_vert,fragmentShader:Be.linedashed_frag},depth:{uniforms:Tt([ae.common,ae.displacementmap]),vertexShader:Be.depth_vert,fragmentShader:Be.depth_frag},normal:{uniforms:Tt([ae.common,ae.bumpmap,ae.normalmap,ae.displacementmap,{opacity:{value:1}}]),vertexShader:Be.meshnormal_vert,fragmentShader:Be.meshnormal_frag},sprite:{uniforms:Tt([ae.sprite,ae.fog]),vertexShader:Be.sprite_vert,fragmentShader:Be.sprite_frag},background:{uniforms:{uvTransform:{value:new Ne},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Be.background_vert,fragmentShader:Be.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Ne}},vertexShader:Be.backgroundCube_vert,fragmentShader:Be.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Be.cube_vert,fragmentShader:Be.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Be.equirect_vert,fragmentShader:Be.equirect_frag},distanceRGBA:{uniforms:Tt([ae.common,ae.displacementmap,{referencePosition:{value:new N},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Be.distanceRGBA_vert,fragmentShader:Be.distanceRGBA_frag},shadow:{uniforms:Tt([ae.lights,ae.fog,{color:{value:new ze(0)},opacity:{value:1}}]),vertexShader:Be.shadow_vert,fragmentShader:Be.shadow_frag}};tn.physical={uniforms:Tt([tn.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Ne},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Ne},clearcoatNormalScale:{value:new Ke(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Ne},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Ne},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Ne},sheen:{value:0},sheenColor:{value:new ze(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Ne},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Ne},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Ne},transmissionSamplerSize:{value:new Ke},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Ne},attenuationDistance:{value:0},attenuationColor:{value:new ze(0)},specularColor:{value:new ze(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Ne},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Ne},anisotropyVector:{value:new Ke},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Ne}}]),vertexShader:Be.meshphysical_vert,fragmentShader:Be.meshphysical_frag};const bs={r:0,b:0,g:0},Gn=new _n,Uf=new ut;function If(i,e,t,n,s,r,o){const a=new ze(0);let l=r===!0?0:1,c,h,d=null,f=0,p=null;function _(b){let E=b.isScene===!0?b.background:null;return E&&E.isTexture&&(E=(b.backgroundBlurriness>0?t:e).get(E)),E}function v(b){let E=!1;const P=_(b);P===null?u(a,l):P&&P.isColor&&(u(P,1),E=!0);const T=i.xr.getEnvironmentBlendMode();T==="additive"?n.buffers.color.setClear(0,0,0,1,o):T==="alpha-blend"&&n.buffers.color.setClear(0,0,0,0,o),(i.autoClear||E)&&(n.buffers.depth.setTest(!0),n.buffers.depth.setMask(!0),n.buffers.color.setMask(!0),i.clear(i.autoClearColor,i.autoClearDepth,i.autoClearStencil))}function m(b,E){const P=_(E);P&&(P.isCubeTexture||P.mapping===Xs)?(h===void 0&&(h=new bt(new es(1,1,1),new Pt({name:"BackgroundCubeMaterial",uniforms:Ti(tn.backgroundCube.uniforms),vertexShader:tn.backgroundCube.vertexShader,fragmentShader:tn.backgroundCube.fragmentShader,side:wt,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),h.geometry.deleteAttribute("normal"),h.geometry.deleteAttribute("uv"),h.onBeforeRender=function(T,R,I){this.matrixWorld.copyPosition(I.matrixWorld)},Object.defineProperty(h.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),s.update(h)),Gn.copy(E.backgroundRotation),Gn.x*=-1,Gn.y*=-1,Gn.z*=-1,P.isCubeTexture&&P.isRenderTargetTexture===!1&&(Gn.y*=-1,Gn.z*=-1),h.material.uniforms.envMap.value=P,h.material.uniforms.flipEnvMap.value=P.isCubeTexture&&P.isRenderTargetTexture===!1?-1:1,h.material.uniforms.backgroundBlurriness.value=E.backgroundBlurriness,h.material.uniforms.backgroundIntensity.value=E.backgroundIntensity,h.material.uniforms.backgroundRotation.value.setFromMatrix4(Uf.makeRotationFromEuler(Gn)),h.material.toneMapped=Xe.getTransfer(P.colorSpace)!==Je,(d!==P||f!==P.version||p!==i.toneMapping)&&(h.material.needsUpdate=!0,d=P,f=P.version,p=i.toneMapping),h.layers.enableAll(),b.unshift(h,h.geometry,h.material,0,0,null)):P&&P.isTexture&&(c===void 0&&(c=new bt(new Fn(2,2),new Pt({name:"BackgroundMaterial",uniforms:Ti(tn.background.uniforms),vertexShader:tn.background.vertexShader,fragmentShader:tn.background.fragmentShader,side:Un,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),Object.defineProperty(c.material,"map",{get:function(){return this.uniforms.t2D.value}}),s.update(c)),c.material.uniforms.t2D.value=P,c.material.uniforms.backgroundIntensity.value=E.backgroundIntensity,c.material.toneMapped=Xe.getTransfer(P.colorSpace)!==Je,P.matrixAutoUpdate===!0&&P.updateMatrix(),c.material.uniforms.uvTransform.value.copy(P.matrix),(d!==P||f!==P.version||p!==i.toneMapping)&&(c.material.needsUpdate=!0,d=P,f=P.version,p=i.toneMapping),c.layers.enableAll(),b.unshift(c,c.geometry,c.material,0,0,null))}function u(b,E){b.getRGB(bs,Dl(i)),n.buffers.color.setClear(bs.r,bs.g,bs.b,E,o)}function A(){h!==void 0&&(h.geometry.dispose(),h.material.dispose(),h=void 0),c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0)}return{getClearColor:function(){return a},setClearColor:function(b,E=1){a.set(b),l=E,u(a,l)},getClearAlpha:function(){return l},setClearAlpha:function(b){l=b,u(a,l)},render:v,addToRenderList:m,dispose:A}}function Ff(i,e){const t=i.getParameter(i.MAX_VERTEX_ATTRIBS),n={},s=f(null);let r=s,o=!1;function a(S,L,H,W,j){let q=!1;const $=d(W,H,L);r!==$&&(r=$,c(r.object)),q=p(S,W,H,j),q&&_(S,W,H,j),j!==null&&e.update(j,i.ELEMENT_ARRAY_BUFFER),(q||o)&&(o=!1,E(S,L,H,W),j!==null&&i.bindBuffer(i.ELEMENT_ARRAY_BUFFER,e.get(j).buffer))}function l(){return i.createVertexArray()}function c(S){return i.bindVertexArray(S)}function h(S){return i.deleteVertexArray(S)}function d(S,L,H){const W=H.wireframe===!0;let j=n[S.id];j===void 0&&(j={},n[S.id]=j);let q=j[L.id];q===void 0&&(q={},j[L.id]=q);let $=q[W];return $===void 0&&($=f(l()),q[W]=$),$}function f(S){const L=[],H=[],W=[];for(let j=0;j<t;j++)L[j]=0,H[j]=0,W[j]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:L,enabledAttributes:H,attributeDivisors:W,object:S,attributes:{},index:null}}function p(S,L,H,W){const j=r.attributes,q=L.attributes;let $=0;const J=H.getAttributes();for(const B in J)if(J[B].location>=0){const he=j[B];let pe=q[B];if(pe===void 0&&(B==="instanceMatrix"&&S.instanceMatrix&&(pe=S.instanceMatrix),B==="instanceColor"&&S.instanceColor&&(pe=S.instanceColor)),he===void 0||he.attribute!==pe||pe&&he.data!==pe.data)return!0;$++}return r.attributesNum!==$||r.index!==W}function _(S,L,H,W){const j={},q=L.attributes;let $=0;const J=H.getAttributes();for(const B in J)if(J[B].location>=0){let he=q[B];he===void 0&&(B==="instanceMatrix"&&S.instanceMatrix&&(he=S.instanceMatrix),B==="instanceColor"&&S.instanceColor&&(he=S.instanceColor));const pe={};pe.attribute=he,he&&he.data&&(pe.data=he.data),j[B]=pe,$++}r.attributes=j,r.attributesNum=$,r.index=W}function v(){const S=r.newAttributes;for(let L=0,H=S.length;L<H;L++)S[L]=0}function m(S){u(S,0)}function u(S,L){const H=r.newAttributes,W=r.enabledAttributes,j=r.attributeDivisors;H[S]=1,W[S]===0&&(i.enableVertexAttribArray(S),W[S]=1),j[S]!==L&&(i.vertexAttribDivisor(S,L),j[S]=L)}function A(){const S=r.newAttributes,L=r.enabledAttributes;for(let H=0,W=L.length;H<W;H++)L[H]!==S[H]&&(i.disableVertexAttribArray(H),L[H]=0)}function b(S,L,H,W,j,q,$){$===!0?i.vertexAttribIPointer(S,L,H,j,q):i.vertexAttribPointer(S,L,H,W,j,q)}function E(S,L,H,W){v();const j=W.attributes,q=H.getAttributes(),$=L.defaultAttributeValues;for(const J in q){const B=q[J];if(B.location>=0){let C=j[J];if(C===void 0&&(J==="instanceMatrix"&&S.instanceMatrix&&(C=S.instanceMatrix),J==="instanceColor"&&S.instanceColor&&(C=S.instanceColor)),C!==void 0){const he=C.normalized,pe=C.itemSize,Oe=e.get(C);if(Oe===void 0)continue;const Ve=Oe.buffer,Qe=Oe.type,We=Oe.bytesPerElement,Y=Qe===i.INT||Qe===i.UNSIGNED_INT||C.gpuType===ya;if(C.isInterleavedBufferAttribute){const Q=C.data,de=Q.stride,Ce=C.offset;if(Q.isInstancedInterleavedBuffer){for(let ve=0;ve<B.locationSize;ve++)u(B.location+ve,Q.meshPerAttribute);S.isInstancedMesh!==!0&&W._maxInstanceCount===void 0&&(W._maxInstanceCount=Q.meshPerAttribute*Q.count)}else for(let ve=0;ve<B.locationSize;ve++)m(B.location+ve);i.bindBuffer(i.ARRAY_BUFFER,Ve);for(let ve=0;ve<B.locationSize;ve++)b(B.location+ve,pe/B.locationSize,Qe,he,de*We,(Ce+pe/B.locationSize*ve)*We,Y)}else{if(C.isInstancedBufferAttribute){for(let Q=0;Q<B.locationSize;Q++)u(B.location+Q,C.meshPerAttribute);S.isInstancedMesh!==!0&&W._maxInstanceCount===void 0&&(W._maxInstanceCount=C.meshPerAttribute*C.count)}else for(let Q=0;Q<B.locationSize;Q++)m(B.location+Q);i.bindBuffer(i.ARRAY_BUFFER,Ve);for(let Q=0;Q<B.locationSize;Q++)b(B.location+Q,pe/B.locationSize,Qe,he,pe*We,pe/B.locationSize*Q*We,Y)}}else if($!==void 0){const he=$[J];if(he!==void 0)switch(he.length){case 2:i.vertexAttrib2fv(B.location,he);break;case 3:i.vertexAttrib3fv(B.location,he);break;case 4:i.vertexAttrib4fv(B.location,he);break;default:i.vertexAttrib1fv(B.location,he)}}}}A()}function P(){I();for(const S in n){const L=n[S];for(const H in L){const W=L[H];for(const j in W)h(W[j].object),delete W[j];delete L[H]}delete n[S]}}function T(S){if(n[S.id]===void 0)return;const L=n[S.id];for(const H in L){const W=L[H];for(const j in W)h(W[j].object),delete W[j];delete L[H]}delete n[S.id]}function R(S){for(const L in n){const H=n[L];if(H[S.id]===void 0)continue;const W=H[S.id];for(const j in W)h(W[j].object),delete W[j];delete H[S.id]}}function I(){M(),o=!0,r!==s&&(r=s,c(r.object))}function M(){s.geometry=null,s.program=null,s.wireframe=!1}return{setup:a,reset:I,resetDefaultState:M,dispose:P,releaseStatesOfGeometry:T,releaseStatesOfProgram:R,initAttributes:v,enableAttribute:m,disableUnusedAttributes:A}}function Nf(i,e,t){let n;function s(c){n=c}function r(c,h){i.drawArrays(n,c,h),t.update(h,n,1)}function o(c,h,d){d!==0&&(i.drawArraysInstanced(n,c,h,d),t.update(h,n,d))}function a(c,h,d){if(d===0)return;e.get("WEBGL_multi_draw").multiDrawArraysWEBGL(n,c,0,h,0,d);let p=0;for(let _=0;_<d;_++)p+=h[_];t.update(p,n,1)}function l(c,h,d,f){if(d===0)return;const p=e.get("WEBGL_multi_draw");if(p===null)for(let _=0;_<c.length;_++)o(c[_],h[_],f[_]);else{p.multiDrawArraysInstancedWEBGL(n,c,0,h,0,f,0,d);let _=0;for(let v=0;v<d;v++)_+=h[v]*f[v];t.update(_,n,1)}}this.setMode=s,this.render=r,this.renderInstances=o,this.renderMultiDraw=a,this.renderMultiDrawInstances=l}function Of(i,e,t,n){let s;function r(){if(s!==void 0)return s;if(e.has("EXT_texture_filter_anisotropic")===!0){const R=e.get("EXT_texture_filter_anisotropic");s=i.getParameter(R.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else s=0;return s}function o(R){return!(R!==Wt&&n.convert(R)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_FORMAT))}function a(R){const I=R===Zi&&(e.has("EXT_color_buffer_half_float")||e.has("EXT_color_buffer_float"));return!(R!==gn&&n.convert(R)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_TYPE)&&R!==pn&&!I)}function l(R){if(R==="highp"){if(i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.HIGH_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.HIGH_FLOAT).precision>0)return"highp";R="mediump"}return R==="mediump"&&i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.MEDIUM_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=t.precision!==void 0?t.precision:"highp";const h=l(c);h!==c&&(console.warn("THREE.WebGLRenderer:",c,"not supported, using",h,"instead."),c=h);const d=t.logarithmicDepthBuffer===!0,f=t.reversedDepthBuffer===!0&&e.has("EXT_clip_control"),p=i.getParameter(i.MAX_TEXTURE_IMAGE_UNITS),_=i.getParameter(i.MAX_VERTEX_TEXTURE_IMAGE_UNITS),v=i.getParameter(i.MAX_TEXTURE_SIZE),m=i.getParameter(i.MAX_CUBE_MAP_TEXTURE_SIZE),u=i.getParameter(i.MAX_VERTEX_ATTRIBS),A=i.getParameter(i.MAX_VERTEX_UNIFORM_VECTORS),b=i.getParameter(i.MAX_VARYING_VECTORS),E=i.getParameter(i.MAX_FRAGMENT_UNIFORM_VECTORS),P=_>0,T=i.getParameter(i.MAX_SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:r,getMaxPrecision:l,textureFormatReadable:o,textureTypeReadable:a,precision:c,logarithmicDepthBuffer:d,reversedDepthBuffer:f,maxTextures:p,maxVertexTextures:_,maxTextureSize:v,maxCubemapSize:m,maxAttributes:u,maxVertexUniforms:A,maxVaryings:b,maxFragmentUniforms:E,vertexTextures:P,maxSamples:T}}function Bf(i){const e=this;let t=null,n=0,s=!1,r=!1;const o=new Wn,a=new Ne,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(d,f){const p=d.length!==0||f||n!==0||s;return s=f,n=d.length,p},this.beginShadows=function(){r=!0,h(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(d,f){t=h(d,f,0)},this.setState=function(d,f,p){const _=d.clippingPlanes,v=d.clipIntersection,m=d.clipShadows,u=i.get(d);if(!s||_===null||_.length===0||r&&!m)r?h(null):c();else{const A=r?0:n,b=A*4;let E=u.clippingState||null;l.value=E,E=h(_,f,b,p);for(let P=0;P!==b;++P)E[P]=t[P];u.clippingState=E,this.numIntersection=v?this.numPlanes:0,this.numPlanes+=A}};function c(){l.value!==t&&(l.value=t,l.needsUpdate=n>0),e.numPlanes=n,e.numIntersection=0}function h(d,f,p,_){const v=d!==null?d.length:0;let m=null;if(v!==0){if(m=l.value,_!==!0||m===null){const u=p+v*4,A=f.matrixWorldInverse;a.getNormalMatrix(A),(m===null||m.length<u)&&(m=new Float32Array(u));for(let b=0,E=p;b!==v;++b,E+=4)o.copy(d[b]).applyMatrix4(A,a),o.normal.toArray(m,E),m[E+3]=o.constant}l.value=m,l.needsUpdate=!0}return e.numPlanes=v,e.numIntersection=0,m}}function zf(i){let e=new WeakMap;function t(o,a){return a===Hr?o.mapping=Ei:a===Gr&&(o.mapping=yi),o}function n(o){if(o&&o.isTexture){const a=o.mapping;if(a===Hr||a===Gr)if(e.has(o)){const l=e.get(o).texture;return t(l,o.mapping)}else{const l=o.image;if(l&&l.height>0){const c=new Oh(l.height);return c.fromEquirectangularTexture(i,o),e.set(o,c),o.addEventListener("dispose",s),t(c.texture,o.mapping)}else return null}}return o}function s(o){const a=o.target;a.removeEventListener("dispose",s);const l=e.get(a);l!==void 0&&(e.delete(a),l.dispose())}function r(){e=new WeakMap}return{get:n,dispose:r}}const _i=4,Ao=[.125,.215,.35,.446,.526,.582],Yn=20,Sr=new Fa,Ro=new ze;let Mr=null,Er=0,yr=0,Tr=!1;const Xn=(1+Math.sqrt(5))/2,pi=1/Xn,Co=[new N(-Xn,pi,0),new N(Xn,pi,0),new N(-pi,0,Xn),new N(pi,0,Xn),new N(0,Xn,-pi),new N(0,Xn,pi),new N(-1,1,-1),new N(1,1,-1),new N(-1,1,1),new N(1,1,1)],kf=new N;class Po{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._lodPlanes=[],this._sizeLods=[],this._sigmas=[],this._blurMaterial=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._compileMaterial(this._blurMaterial)}fromScene(e,t=0,n=.1,s=100,r={}){const{size:o=256,position:a=kf}=r;Mr=this._renderer.getRenderTarget(),Er=this._renderer.getActiveCubeFace(),yr=this._renderer.getActiveMipmapLevel(),Tr=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(o);const l=this._allocateTargets();return l.depthBuffer=!0,this._sceneToCubeUV(e,n,s,l,a),t>0&&this._blur(l,0,0,t),this._applyPMREM(l),this._cleanup(l),l}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Uo(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Lo(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose()}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodPlanes.length;e++)this._lodPlanes[e].dispose()}_cleanup(e){this._renderer.setRenderTarget(Mr,Er,yr),this._renderer.xr.enabled=Tr,e.scissorTest=!1,ws(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===Ei||e.mapping===yi?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),Mr=this._renderer.getRenderTarget(),Er=this._renderer.getActiveCubeFace(),yr=this._renderer.getActiveMipmapLevel(),Tr=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;const n=t||this._allocateTargets();return this._textureToCubeUV(e,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){const e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,n={magFilter:sn,minFilter:sn,generateMipmaps:!1,type:Zi,format:Wt,colorSpace:Qn,depthBuffer:!1},s=Do(e,t,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=Do(e,t,n);const{_lodMax:r}=this;({sizeLods:this._sizeLods,lodPlanes:this._lodPlanes,sigmas:this._sigmas}=Hf(r)),this._blurMaterial=Gf(r,e,t)}return s}_compileMaterial(e){const t=new bt(this._lodPlanes[0],e);this._renderer.compile(t,Sr)}_sceneToCubeUV(e,t,n,s,r){const l=new Gt(90,1,t,n),c=[1,-1,1,1,1,1],h=[1,1,1,-1,-1,-1],d=this._renderer,f=d.autoClear,p=d.toneMapping;d.getClearColor(Ro),d.toneMapping=Ln,d.autoClear=!1,d.state.buffers.depth.getReversed()&&(d.setRenderTarget(s),d.clearDepth(),d.setRenderTarget(null));const v=new La({name:"PMREM.Background",side:wt,depthWrite:!1,depthTest:!1}),m=new bt(new es,v);let u=!1;const A=e.background;A?A.isColor&&(v.color.copy(A),e.background=null,u=!0):(v.color.copy(Ro),u=!0);for(let b=0;b<6;b++){const E=b%3;E===0?(l.up.set(0,c[b],0),l.position.set(r.x,r.y,r.z),l.lookAt(r.x+h[b],r.y,r.z)):E===1?(l.up.set(0,0,c[b]),l.position.set(r.x,r.y,r.z),l.lookAt(r.x,r.y+h[b],r.z)):(l.up.set(0,c[b],0),l.position.set(r.x,r.y,r.z),l.lookAt(r.x,r.y,r.z+h[b]));const P=this._cubeSize;ws(s,E*P,b>2?P:0,P,P),d.setRenderTarget(s),u&&d.render(m,l),d.render(e,l)}m.geometry.dispose(),m.material.dispose(),d.toneMapping=p,d.autoClear=f,e.background=A}_textureToCubeUV(e,t){const n=this._renderer,s=e.mapping===Ei||e.mapping===yi;s?(this._cubemapMaterial===null&&(this._cubemapMaterial=Uo()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Lo());const r=s?this._cubemapMaterial:this._equirectMaterial,o=new bt(this._lodPlanes[0],r),a=r.uniforms;a.envMap.value=e;const l=this._cubeSize;ws(t,0,0,3*l,2*l),n.setRenderTarget(t),n.render(o,Sr)}_applyPMREM(e){const t=this._renderer,n=t.autoClear;t.autoClear=!1;const s=this._lodPlanes.length;for(let r=1;r<s;r++){const o=Math.sqrt(this._sigmas[r]*this._sigmas[r]-this._sigmas[r-1]*this._sigmas[r-1]),a=Co[(s-r-1)%Co.length];this._blur(e,r-1,r,o,a)}t.autoClear=n}_blur(e,t,n,s,r){const o=this._pingPongRenderTarget;this._halfBlur(e,o,t,n,s,"latitudinal",r),this._halfBlur(o,e,n,n,s,"longitudinal",r)}_halfBlur(e,t,n,s,r,o,a){const l=this._renderer,c=this._blurMaterial;o!=="latitudinal"&&o!=="longitudinal"&&console.error("blur direction must be either latitudinal or longitudinal!");const h=3,d=new bt(this._lodPlanes[s],c),f=c.uniforms,p=this._sizeLods[n]-1,_=isFinite(r)?Math.PI/(2*p):2*Math.PI/(2*Yn-1),v=r/_,m=isFinite(r)?1+Math.floor(h*v):Yn;m>Yn&&console.warn(`sigmaRadians, ${r}, is too large and will clip, as it requested ${m} samples when the maximum is set to ${Yn}`);const u=[];let A=0;for(let R=0;R<Yn;++R){const I=R/v,M=Math.exp(-I*I/2);u.push(M),R===0?A+=M:R<m&&(A+=2*M)}for(let R=0;R<u.length;R++)u[R]=u[R]/A;f.envMap.value=e.texture,f.samples.value=m,f.weights.value=u,f.latitudinal.value=o==="latitudinal",a&&(f.poleAxis.value=a);const{_lodMax:b}=this;f.dTheta.value=_,f.mipInt.value=b-n;const E=this._sizeLods[s],P=3*E*(s>b-_i?s-b+_i:0),T=4*(this._cubeSize-E);ws(t,P,T,3*E,2*E),l.setRenderTarget(t),l.render(d,Sr)}}function Hf(i){const e=[],t=[],n=[];let s=i;const r=i-_i+1+Ao.length;for(let o=0;o<r;o++){const a=Math.pow(2,s);t.push(a);let l=1/a;o>i-_i?l=Ao[o-i+_i-1]:o===0&&(l=0),n.push(l);const c=1/(a-2),h=-c,d=1+c,f=[h,h,d,h,d,d,h,h,d,d,h,d],p=6,_=6,v=3,m=2,u=1,A=new Float32Array(v*_*p),b=new Float32Array(m*_*p),E=new Float32Array(u*_*p);for(let T=0;T<p;T++){const R=T%3*2/3-1,I=T>2?0:-1,M=[R,I,0,R+2/3,I,0,R+2/3,I+1,0,R,I,0,R+2/3,I+1,0,R,I+1,0];A.set(M,v*_*T),b.set(f,m*_*T);const S=[T,T,T,T,T,T];E.set(S,u*_*T)}const P=new Ft;P.setAttribute("position",new gt(A,v)),P.setAttribute("uv",new gt(b,m)),P.setAttribute("faceIndex",new gt(E,u)),e.push(P),s>_i&&s--}return{lodPlanes:e,sizeLods:t,sigmas:n}}function Do(i,e,t){const n=new In(i,e,t);return n.texture.mapping=Xs,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function ws(i,e,t,n,s){i.viewport.set(e,t,n,s),i.scissor.set(e,t,n,s)}function Gf(i,e,t){const n=new Float32Array(Yn),s=new N(0,1,0);return new Pt({name:"SphericalGaussianBlur",defines:{n:Yn,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:n},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:s}},vertexShader:Na(),fragmentShader:`

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
		`,blending:Dn,depthTest:!1,depthWrite:!1})}function Lo(){return new Pt({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:Na(),fragmentShader:`

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
		`,blending:Dn,depthTest:!1,depthWrite:!1})}function Uo(){return new Pt({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:Na(),fragmentShader:`

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
	`}function Vf(i){let e=new WeakMap,t=null;function n(a){if(a&&a.isTexture){const l=a.mapping,c=l===Hr||l===Gr,h=l===Ei||l===yi;if(c||h){let d=e.get(a);const f=d!==void 0?d.texture.pmremVersion:0;if(a.isRenderTargetTexture&&a.pmremVersion!==f)return t===null&&(t=new Po(i)),d=c?t.fromEquirectangular(a,d):t.fromCubemap(a,d),d.texture.pmremVersion=a.pmremVersion,e.set(a,d),d.texture;if(d!==void 0)return d.texture;{const p=a.image;return c&&p&&p.height>0||h&&p&&s(p)?(t===null&&(t=new Po(i)),d=c?t.fromEquirectangular(a):t.fromCubemap(a),d.texture.pmremVersion=a.pmremVersion,e.set(a,d),a.addEventListener("dispose",r),d.texture):null}}}return a}function s(a){let l=0;const c=6;for(let h=0;h<c;h++)a[h]!==void 0&&l++;return l===c}function r(a){const l=a.target;l.removeEventListener("dispose",r);const c=e.get(l);c!==void 0&&(e.delete(l),c.dispose())}function o(){e=new WeakMap,t!==null&&(t.dispose(),t=null)}return{get:n,dispose:o}}function Wf(i){const e={};function t(n){if(e[n]!==void 0)return e[n];let s;switch(n){case"WEBGL_depth_texture":s=i.getExtension("WEBGL_depth_texture")||i.getExtension("MOZ_WEBGL_depth_texture")||i.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":s=i.getExtension("EXT_texture_filter_anisotropic")||i.getExtension("MOZ_EXT_texture_filter_anisotropic")||i.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":s=i.getExtension("WEBGL_compressed_texture_s3tc")||i.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||i.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":s=i.getExtension("WEBGL_compressed_texture_pvrtc")||i.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:s=i.getExtension(n)}return e[n]=s,s}return{has:function(n){return t(n)!==null},init:function(){t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance"),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture"),t("WEBGL_render_shared_exponent")},get:function(n){const s=t(n);return s===null&&ji("THREE.WebGLRenderer: "+n+" extension not supported."),s}}}function Xf(i,e,t,n){const s={},r=new WeakMap;function o(d){const f=d.target;f.index!==null&&e.remove(f.index);for(const _ in f.attributes)e.remove(f.attributes[_]);f.removeEventListener("dispose",o),delete s[f.id];const p=r.get(f);p&&(e.remove(p),r.delete(f)),n.releaseStatesOfGeometry(f),f.isInstancedBufferGeometry===!0&&delete f._maxInstanceCount,t.memory.geometries--}function a(d,f){return s[f.id]===!0||(f.addEventListener("dispose",o),s[f.id]=!0,t.memory.geometries++),f}function l(d){const f=d.attributes;for(const p in f)e.update(f[p],i.ARRAY_BUFFER)}function c(d){const f=[],p=d.index,_=d.attributes.position;let v=0;if(p!==null){const A=p.array;v=p.version;for(let b=0,E=A.length;b<E;b+=3){const P=A[b+0],T=A[b+1],R=A[b+2];f.push(P,T,T,R,R,P)}}else if(_!==void 0){const A=_.array;v=_.version;for(let b=0,E=A.length/3-1;b<E;b+=3){const P=b+0,T=b+1,R=b+2;f.push(P,T,T,R,R,P)}}else return;const m=new(bl(f)?Pl:Cl)(f,1);m.version=v;const u=r.get(d);u&&e.remove(u),r.set(d,m)}function h(d){const f=r.get(d);if(f){const p=d.index;p!==null&&f.version<p.version&&c(d)}else c(d);return r.get(d)}return{get:a,update:l,getWireframeAttribute:h}}function qf(i,e,t){let n;function s(f){n=f}let r,o;function a(f){r=f.type,o=f.bytesPerElement}function l(f,p){i.drawElements(n,p,r,f*o),t.update(p,n,1)}function c(f,p,_){_!==0&&(i.drawElementsInstanced(n,p,r,f*o,_),t.update(p,n,_))}function h(f,p,_){if(_===0)return;e.get("WEBGL_multi_draw").multiDrawElementsWEBGL(n,p,0,r,f,0,_);let m=0;for(let u=0;u<_;u++)m+=p[u];t.update(m,n,1)}function d(f,p,_,v){if(_===0)return;const m=e.get("WEBGL_multi_draw");if(m===null)for(let u=0;u<f.length;u++)c(f[u]/o,p[u],v[u]);else{m.multiDrawElementsInstancedWEBGL(n,p,0,r,f,0,v,0,_);let u=0;for(let A=0;A<_;A++)u+=p[A]*v[A];t.update(u,n,1)}}this.setMode=s,this.setIndex=a,this.render=l,this.renderInstances=c,this.renderMultiDraw=h,this.renderMultiDrawInstances=d}function Yf(i){const e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function n(r,o,a){switch(t.calls++,o){case i.TRIANGLES:t.triangles+=a*(r/3);break;case i.LINES:t.lines+=a*(r/2);break;case i.LINE_STRIP:t.lines+=a*(r-1);break;case i.LINE_LOOP:t.lines+=a*r;break;case i.POINTS:t.points+=a*r;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",o);break}}function s(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:s,update:n}}function $f(i,e,t){const n=new WeakMap,s=new ct;function r(o,a,l){const c=o.morphTargetInfluences,h=a.morphAttributes.position||a.morphAttributes.normal||a.morphAttributes.color,d=h!==void 0?h.length:0;let f=n.get(a);if(f===void 0||f.count!==d){let S=function(){I.dispose(),n.delete(a),a.removeEventListener("dispose",S)};var p=S;f!==void 0&&f.texture.dispose();const _=a.morphAttributes.position!==void 0,v=a.morphAttributes.normal!==void 0,m=a.morphAttributes.color!==void 0,u=a.morphAttributes.position||[],A=a.morphAttributes.normal||[],b=a.morphAttributes.color||[];let E=0;_===!0&&(E=1),v===!0&&(E=2),m===!0&&(E=3);let P=a.attributes.position.count*E,T=1;P>e.maxTextureSize&&(T=Math.ceil(P/e.maxTextureSize),P=e.maxTextureSize);const R=new Float32Array(P*T*4*d),I=new wl(R,P,T,d);I.type=pn,I.needsUpdate=!0;const M=E*4;for(let L=0;L<d;L++){const H=u[L],W=A[L],j=b[L],q=P*T*4*L;for(let $=0;$<H.count;$++){const J=$*M;_===!0&&(s.fromBufferAttribute(H,$),R[q+J+0]=s.x,R[q+J+1]=s.y,R[q+J+2]=s.z,R[q+J+3]=0),v===!0&&(s.fromBufferAttribute(W,$),R[q+J+4]=s.x,R[q+J+5]=s.y,R[q+J+6]=s.z,R[q+J+7]=0),m===!0&&(s.fromBufferAttribute(j,$),R[q+J+8]=s.x,R[q+J+9]=s.y,R[q+J+10]=s.z,R[q+J+11]=j.itemSize===4?s.w:1)}}f={count:d,texture:I,size:new Ke(P,T)},n.set(a,f),a.addEventListener("dispose",S)}if(o.isInstancedMesh===!0&&o.morphTexture!==null)l.getUniforms().setValue(i,"morphTexture",o.morphTexture,t);else{let _=0;for(let m=0;m<c.length;m++)_+=c[m];const v=a.morphTargetsRelative?1:1-_;l.getUniforms().setValue(i,"morphTargetBaseInfluence",v),l.getUniforms().setValue(i,"morphTargetInfluences",c)}l.getUniforms().setValue(i,"morphTargetsTexture",f.texture,t),l.getUniforms().setValue(i,"morphTargetsTextureSize",f.size)}return{update:r}}function Kf(i,e,t,n){let s=new WeakMap;function r(l){const c=n.render.frame,h=l.geometry,d=e.get(l,h);if(s.get(d)!==c&&(e.update(d),s.set(d,c)),l.isInstancedMesh&&(l.hasEventListener("dispose",a)===!1&&l.addEventListener("dispose",a),s.get(l)!==c&&(t.update(l.instanceMatrix,i.ARRAY_BUFFER),l.instanceColor!==null&&t.update(l.instanceColor,i.ARRAY_BUFFER),s.set(l,c))),l.isSkinnedMesh){const f=l.skeleton;s.get(f)!==c&&(f.update(),s.set(f,c))}return d}function o(){s=new WeakMap}function a(l){const c=l.target;c.removeEventListener("dispose",a),t.remove(c.instanceMatrix),c.instanceColor!==null&&t.remove(c.instanceColor)}return{update:r,dispose:o}}const zl=new vt,Io=new Nl(1,1),kl=new wl,Hl=new Sh,Gl=new Ul,Fo=[],No=[],Oo=new Float32Array(16),Bo=new Float32Array(9),zo=new Float32Array(4);function Di(i,e,t){const n=i[0];if(n<=0||n>0)return i;const s=e*t;let r=Fo[s];if(r===void 0&&(r=new Float32Array(s),Fo[s]=r),e!==0){n.toArray(r,0);for(let o=1,a=0;o!==e;++o)a+=t,i[o].toArray(r,a)}return r}function ft(i,e){if(i.length!==e.length)return!1;for(let t=0,n=i.length;t<n;t++)if(i[t]!==e[t])return!1;return!0}function pt(i,e){for(let t=0,n=e.length;t<n;t++)i[t]=e[t]}function qs(i,e){let t=No[e];t===void 0&&(t=new Int32Array(e),No[e]=t);for(let n=0;n!==e;++n)t[n]=i.allocateTextureUnit();return t}function jf(i,e){const t=this.cache;t[0]!==e&&(i.uniform1f(this.addr,e),t[0]=e)}function Zf(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(ft(t,e))return;i.uniform2fv(this.addr,e),pt(t,e)}}function Jf(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(i.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(ft(t,e))return;i.uniform3fv(this.addr,e),pt(t,e)}}function Qf(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(ft(t,e))return;i.uniform4fv(this.addr,e),pt(t,e)}}function ep(i,e){const t=this.cache,n=e.elements;if(n===void 0){if(ft(t,e))return;i.uniformMatrix2fv(this.addr,!1,e),pt(t,e)}else{if(ft(t,n))return;zo.set(n),i.uniformMatrix2fv(this.addr,!1,zo),pt(t,n)}}function tp(i,e){const t=this.cache,n=e.elements;if(n===void 0){if(ft(t,e))return;i.uniformMatrix3fv(this.addr,!1,e),pt(t,e)}else{if(ft(t,n))return;Bo.set(n),i.uniformMatrix3fv(this.addr,!1,Bo),pt(t,n)}}function np(i,e){const t=this.cache,n=e.elements;if(n===void 0){if(ft(t,e))return;i.uniformMatrix4fv(this.addr,!1,e),pt(t,e)}else{if(ft(t,n))return;Oo.set(n),i.uniformMatrix4fv(this.addr,!1,Oo),pt(t,n)}}function ip(i,e){const t=this.cache;t[0]!==e&&(i.uniform1i(this.addr,e),t[0]=e)}function sp(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(ft(t,e))return;i.uniform2iv(this.addr,e),pt(t,e)}}function rp(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(ft(t,e))return;i.uniform3iv(this.addr,e),pt(t,e)}}function ap(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(ft(t,e))return;i.uniform4iv(this.addr,e),pt(t,e)}}function op(i,e){const t=this.cache;t[0]!==e&&(i.uniform1ui(this.addr,e),t[0]=e)}function lp(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(ft(t,e))return;i.uniform2uiv(this.addr,e),pt(t,e)}}function cp(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(ft(t,e))return;i.uniform3uiv(this.addr,e),pt(t,e)}}function hp(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(ft(t,e))return;i.uniform4uiv(this.addr,e),pt(t,e)}}function up(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s);let r;this.type===i.SAMPLER_2D_SHADOW?(Io.compareFunction=Tl,r=Io):r=zl,t.setTexture2D(e||r,s)}function dp(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),t.setTexture3D(e||Hl,s)}function fp(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),t.setTextureCube(e||Gl,s)}function pp(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),t.setTexture2DArray(e||kl,s)}function mp(i){switch(i){case 5126:return jf;case 35664:return Zf;case 35665:return Jf;case 35666:return Qf;case 35674:return ep;case 35675:return tp;case 35676:return np;case 5124:case 35670:return ip;case 35667:case 35671:return sp;case 35668:case 35672:return rp;case 35669:case 35673:return ap;case 5125:return op;case 36294:return lp;case 36295:return cp;case 36296:return hp;case 35678:case 36198:case 36298:case 36306:case 35682:return up;case 35679:case 36299:case 36307:return dp;case 35680:case 36300:case 36308:case 36293:return fp;case 36289:case 36303:case 36311:case 36292:return pp}}function gp(i,e){i.uniform1fv(this.addr,e)}function _p(i,e){const t=Di(e,this.size,2);i.uniform2fv(this.addr,t)}function vp(i,e){const t=Di(e,this.size,3);i.uniform3fv(this.addr,t)}function xp(i,e){const t=Di(e,this.size,4);i.uniform4fv(this.addr,t)}function Sp(i,e){const t=Di(e,this.size,4);i.uniformMatrix2fv(this.addr,!1,t)}function Mp(i,e){const t=Di(e,this.size,9);i.uniformMatrix3fv(this.addr,!1,t)}function Ep(i,e){const t=Di(e,this.size,16);i.uniformMatrix4fv(this.addr,!1,t)}function yp(i,e){i.uniform1iv(this.addr,e)}function Tp(i,e){i.uniform2iv(this.addr,e)}function bp(i,e){i.uniform3iv(this.addr,e)}function wp(i,e){i.uniform4iv(this.addr,e)}function Ap(i,e){i.uniform1uiv(this.addr,e)}function Rp(i,e){i.uniform2uiv(this.addr,e)}function Cp(i,e){i.uniform3uiv(this.addr,e)}function Pp(i,e){i.uniform4uiv(this.addr,e)}function Dp(i,e,t){const n=this.cache,s=e.length,r=qs(t,s);ft(n,r)||(i.uniform1iv(this.addr,r),pt(n,r));for(let o=0;o!==s;++o)t.setTexture2D(e[o]||zl,r[o])}function Lp(i,e,t){const n=this.cache,s=e.length,r=qs(t,s);ft(n,r)||(i.uniform1iv(this.addr,r),pt(n,r));for(let o=0;o!==s;++o)t.setTexture3D(e[o]||Hl,r[o])}function Up(i,e,t){const n=this.cache,s=e.length,r=qs(t,s);ft(n,r)||(i.uniform1iv(this.addr,r),pt(n,r));for(let o=0;o!==s;++o)t.setTextureCube(e[o]||Gl,r[o])}function Ip(i,e,t){const n=this.cache,s=e.length,r=qs(t,s);ft(n,r)||(i.uniform1iv(this.addr,r),pt(n,r));for(let o=0;o!==s;++o)t.setTexture2DArray(e[o]||kl,r[o])}function Fp(i){switch(i){case 5126:return gp;case 35664:return _p;case 35665:return vp;case 35666:return xp;case 35674:return Sp;case 35675:return Mp;case 35676:return Ep;case 5124:case 35670:return yp;case 35667:case 35671:return Tp;case 35668:case 35672:return bp;case 35669:case 35673:return wp;case 5125:return Ap;case 36294:return Rp;case 36295:return Cp;case 36296:return Pp;case 35678:case 36198:case 36298:case 36306:case 35682:return Dp;case 35679:case 36299:case 36307:return Lp;case 35680:case 36300:case 36308:case 36293:return Up;case 36289:case 36303:case 36311:case 36292:return Ip}}class Np{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.setValue=mp(t.type)}}class Op{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=Fp(t.type)}}class Bp{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,n){const s=this.seq;for(let r=0,o=s.length;r!==o;++r){const a=s[r];a.setValue(e,t[a.id],n)}}}const br=/(\w+)(\])?(\[|\.)?/g;function ko(i,e){i.seq.push(e),i.map[e.id]=e}function zp(i,e,t){const n=i.name,s=n.length;for(br.lastIndex=0;;){const r=br.exec(n),o=br.lastIndex;let a=r[1];const l=r[2]==="]",c=r[3];if(l&&(a=a|0),c===void 0||c==="["&&o+2===s){ko(t,c===void 0?new Np(a,i,e):new Op(a,i,e));break}else{let d=t.map[a];d===void 0&&(d=new Bp(a),ko(t,d)),t=d}}}class Us{constructor(e,t){this.seq=[],this.map={};const n=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let s=0;s<n;++s){const r=e.getActiveUniform(t,s),o=e.getUniformLocation(t,r.name);zp(r,o,this)}}setValue(e,t,n,s){const r=this.map[t];r!==void 0&&r.setValue(e,n,s)}setOptional(e,t,n){const s=t[n];s!==void 0&&this.setValue(e,n,s)}static upload(e,t,n,s){for(let r=0,o=t.length;r!==o;++r){const a=t[r],l=n[a.id];l.needsUpdate!==!1&&a.setValue(e,l.value,s)}}static seqWithValue(e,t){const n=[];for(let s=0,r=e.length;s!==r;++s){const o=e[s];o.id in t&&n.push(o)}return n}}function Ho(i,e,t){const n=i.createShader(e);return i.shaderSource(n,t),i.compileShader(n),n}const kp=37297;let Hp=0;function Gp(i,e){const t=i.split(`
`),n=[],s=Math.max(e-6,0),r=Math.min(e+6,t.length);for(let o=s;o<r;o++){const a=o+1;n.push(`${a===e?">":" "} ${a}: ${t[o]}`)}return n.join(`
`)}const Go=new Ne;function Vp(i){Xe._getMatrix(Go,Xe.workingColorSpace,i);const e=`mat3( ${Go.elements.map(t=>t.toFixed(4))} )`;switch(Xe.getTransfer(i)){case Os:return[e,"LinearTransferOETF"];case Je:return[e,"sRGBTransferOETF"];default:return console.warn("THREE.WebGLProgram: Unsupported color space: ",i),[e,"LinearTransferOETF"]}}function Vo(i,e,t){const n=i.getShaderParameter(e,i.COMPILE_STATUS),r=(i.getShaderInfoLog(e)||"").trim();if(n&&r==="")return"";const o=/ERROR: 0:(\d+)/.exec(r);if(o){const a=parseInt(o[1]);return t.toUpperCase()+`

`+r+`

`+Gp(i.getShaderSource(e),a)}else return r}function Wp(i,e){const t=Vp(e);return[`vec4 ${i}( vec4 value ) {`,`	return ${t[1]}( vec4( value.rgb * ${t[0]}, value.a ) );`,"}"].join(`
`)}function Xp(i,e){let t;switch(e){case Lc:t="Linear";break;case Uc:t="Reinhard";break;case Ic:t="Cineon";break;case Fc:t="ACESFilmic";break;case Oc:t="AgX";break;case Bc:t="Neutral";break;case Nc:t="Custom";break;default:console.warn("THREE.WebGLProgram: Unsupported toneMapping:",e),t="Linear"}return"vec3 "+i+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}const As=new N;function qp(){Xe.getLuminanceCoefficients(As);const i=As.x.toFixed(4),e=As.y.toFixed(4),t=As.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${i}, ${e}, ${t} );`,"	return dot( weights, rgb );","}"].join(`
`)}function Yp(i){return[i.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",i.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(ki).join(`
`)}function $p(i){const e=[];for(const t in i){const n=i[t];n!==!1&&e.push("#define "+t+" "+n)}return e.join(`
`)}function Kp(i,e){const t={},n=i.getProgramParameter(e,i.ACTIVE_ATTRIBUTES);for(let s=0;s<n;s++){const r=i.getActiveAttrib(e,s),o=r.name;let a=1;r.type===i.FLOAT_MAT2&&(a=2),r.type===i.FLOAT_MAT3&&(a=3),r.type===i.FLOAT_MAT4&&(a=4),t[o]={type:r.type,location:i.getAttribLocation(e,o),locationSize:a}}return t}function ki(i){return i!==""}function Wo(i,e){const t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return i.replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function Xo(i,e){return i.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}const jp=/^[ \t]*#include +<([\w\d./]+)>/gm;function Sa(i){return i.replace(jp,Jp)}const Zp=new Map;function Jp(i,e){let t=Be[e];if(t===void 0){const n=Zp.get(e);if(n!==void 0)t=Be[n],console.warn('THREE.WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',e,n);else throw new Error("Can not resolve #include <"+e+">")}return Sa(t)}const Qp=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function qo(i){return i.replace(Qp,em)}function em(i,e,t,n){let s="";for(let r=parseInt(e);r<parseInt(t);r++)s+=n.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return s}function Yo(i){let e=`precision ${i.precision} float;
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
#define LOW_PRECISION`),e}function tm(i){let e="SHADOWMAP_TYPE_BASIC";return i.shadowMapType===fl?e="SHADOWMAP_TYPE_PCF":i.shadowMapType===uc?e="SHADOWMAP_TYPE_PCF_SOFT":i.shadowMapType===fn&&(e="SHADOWMAP_TYPE_VSM"),e}function nm(i){let e="ENVMAP_TYPE_CUBE";if(i.envMap)switch(i.envMapMode){case Ei:case yi:e="ENVMAP_TYPE_CUBE";break;case Xs:e="ENVMAP_TYPE_CUBE_UV";break}return e}function im(i){let e="ENVMAP_MODE_REFLECTION";return i.envMap&&i.envMapMode===yi&&(e="ENVMAP_MODE_REFRACTION"),e}function sm(i){let e="ENVMAP_BLENDING_NONE";if(i.envMap)switch(i.combine){case pl:e="ENVMAP_BLENDING_MULTIPLY";break;case Pc:e="ENVMAP_BLENDING_MIX";break;case Dc:e="ENVMAP_BLENDING_ADD";break}return e}function rm(i){const e=i.envMapCubeUVHeight;if(e===null)return null;const t=Math.log2(e)-2,n=1/e;return{texelWidth:1/(3*Math.max(Math.pow(2,t),112)),texelHeight:n,maxMip:t}}function am(i,e,t,n){const s=i.getContext(),r=t.defines;let o=t.vertexShader,a=t.fragmentShader;const l=tm(t),c=nm(t),h=im(t),d=sm(t),f=rm(t),p=Yp(t),_=$p(r),v=s.createProgram();let m,u,A=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(m=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,_].filter(ki).join(`
`),m.length>0&&(m+=`
`),u=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,_].filter(ki).join(`
`),u.length>0&&(u+=`
`)):(m=[Yo(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,_,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.batchingColor?"#define USE_BATCHING_COLOR":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.instancingMorph?"#define USE_INSTANCING_MORPH":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+h:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(ki).join(`
`),u=[Yo(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,_,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+c:"",t.envMap?"#define "+h:"",t.envMap?"#define "+d:"",f?"#define CUBEUV_TEXEL_WIDTH "+f.texelWidth:"",f?"#define CUBEUV_TEXEL_HEIGHT "+f.texelHeight:"",f?"#define CUBEUV_MAX_MIP "+f.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.dispersion?"#define USE_DISPERSION":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor||t.batchingColor?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==Ln?"#define TONE_MAPPING":"",t.toneMapping!==Ln?Be.tonemapping_pars_fragment:"",t.toneMapping!==Ln?Xp("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",Be.colorspace_pars_fragment,Wp("linearToOutputTexel",t.outputColorSpace),qp(),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(ki).join(`
`)),o=Sa(o),o=Wo(o,t),o=Xo(o,t),a=Sa(a),a=Wo(a,t),a=Xo(a,t),o=qo(o),a=qo(a),t.isRawShaderMaterial!==!0&&(A=`#version 300 es
`,m=[p,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+m,u=["#define varying in",t.glslVersion===eo?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===eo?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+u);const b=A+m+o,E=A+u+a,P=Ho(s,s.VERTEX_SHADER,b),T=Ho(s,s.FRAGMENT_SHADER,E);s.attachShader(v,P),s.attachShader(v,T),t.index0AttributeName!==void 0?s.bindAttribLocation(v,0,t.index0AttributeName):t.morphTargets===!0&&s.bindAttribLocation(v,0,"position"),s.linkProgram(v);function R(L){if(i.debug.checkShaderErrors){const H=s.getProgramInfoLog(v)||"",W=s.getShaderInfoLog(P)||"",j=s.getShaderInfoLog(T)||"",q=H.trim(),$=W.trim(),J=j.trim();let B=!0,C=!0;if(s.getProgramParameter(v,s.LINK_STATUS)===!1)if(B=!1,typeof i.debug.onShaderError=="function")i.debug.onShaderError(s,v,P,T);else{const he=Vo(s,P,"vertex"),pe=Vo(s,T,"fragment");console.error("THREE.WebGLProgram: Shader Error "+s.getError()+" - VALIDATE_STATUS "+s.getProgramParameter(v,s.VALIDATE_STATUS)+`

Material Name: `+L.name+`
Material Type: `+L.type+`

Program Info Log: `+q+`
`+he+`
`+pe)}else q!==""?console.warn("THREE.WebGLProgram: Program Info Log:",q):($===""||J==="")&&(C=!1);C&&(L.diagnostics={runnable:B,programLog:q,vertexShader:{log:$,prefix:m},fragmentShader:{log:J,prefix:u}})}s.deleteShader(P),s.deleteShader(T),I=new Us(s,v),M=Kp(s,v)}let I;this.getUniforms=function(){return I===void 0&&R(this),I};let M;this.getAttributes=function(){return M===void 0&&R(this),M};let S=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return S===!1&&(S=s.getProgramParameter(v,kp)),S},this.destroy=function(){n.releaseStatesOfProgram(this),s.deleteProgram(v),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=Hp++,this.cacheKey=e,this.usedTimes=1,this.program=v,this.vertexShader=P,this.fragmentShader=T,this}let om=0;class lm{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e){const t=e.vertexShader,n=e.fragmentShader,s=this._getShaderStage(t),r=this._getShaderStage(n),o=this._getShaderCacheForMaterial(e);return o.has(s)===!1&&(o.add(s),s.usedTimes++),o.has(r)===!1&&(o.add(r),r.usedTimes++),this}remove(e){const t=this.materialCache.get(e);for(const n of t)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(e),this}getVertexShaderID(e){return this._getShaderStage(e.vertexShader).id}getFragmentShaderID(e){return this._getShaderStage(e.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){const t=this.materialCache;let n=t.get(e);return n===void 0&&(n=new Set,t.set(e,n)),n}_getShaderStage(e){const t=this.shaderCache;let n=t.get(e);return n===void 0&&(n=new cm(e),t.set(e,n)),n}}class cm{constructor(e){this.id=om++,this.code=e,this.usedTimes=0}}function hm(i,e,t,n,s,r,o){const a=new Al,l=new lm,c=new Set,h=[],d=s.logarithmicDepthBuffer,f=s.vertexTextures;let p=s.precision;const _={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function v(M){return c.add(M),M===0?"uv":`uv${M}`}function m(M,S,L,H,W){const j=H.fog,q=W.geometry,$=M.isMeshStandardMaterial?H.environment:null,J=(M.isMeshStandardMaterial?t:e).get(M.envMap||$),B=J&&J.mapping===Xs?J.image.height:null,C=_[M.type];M.precision!==null&&(p=s.getMaxPrecision(M.precision),p!==M.precision&&console.warn("THREE.WebGLProgram.getParameters:",M.precision,"not supported, using",p,"instead."));const he=q.morphAttributes.position||q.morphAttributes.normal||q.morphAttributes.color,pe=he!==void 0?he.length:0;let Oe=0;q.morphAttributes.position!==void 0&&(Oe=1),q.morphAttributes.normal!==void 0&&(Oe=2),q.morphAttributes.color!==void 0&&(Oe=3);let Ve,Qe,We,Y;if(C){const $e=tn[C];Ve=$e.vertexShader,Qe=$e.fragmentShader}else Ve=M.vertexShader,Qe=M.fragmentShader,l.update(M),We=l.getVertexShaderID(M),Y=l.getFragmentShaderID(M);const Q=i.getRenderTarget(),de=i.state.buffers.depth.getReversed(),Ce=W.isInstancedMesh===!0,ve=W.isBatchedMesh===!0,Se=!!M.map,st=!!M.matcap,w=!!J,je=!!M.aoMap,De=!!M.lightMap,be=!!M.bumpMap,_e=!!M.normalMap,Ye=!!M.displacementMap,me=!!M.emissiveMap,Le=!!M.metalnessMap,lt=!!M.roughnessMap,it=M.anisotropy>0,y=M.clearcoat>0,g=M.dispersion>0,O=M.iridescence>0,X=M.sheen>0,Z=M.transmission>0,V=it&&!!M.anisotropyMap,ye=y&&!!M.clearcoatMap,G=y&&!!M.clearcoatNormalMap,ue=y&&!!M.clearcoatRoughnessMap,le=O&&!!M.iridescenceMap,ee=O&&!!M.iridescenceThicknessMap,oe=X&&!!M.sheenColorMap,we=X&&!!M.sheenRoughnessMap,Me=!!M.specularMap,re=!!M.specularColorMap,Ue=!!M.specularIntensityMap,D=Z&&!!M.transmissionMap,ne=Z&&!!M.thicknessMap,te=!!M.gradientMap,ge=!!M.alphaMap,ie=M.alphaTest>0,K=!!M.alphaHash,Ee=!!M.extensions;let Ie=Ln;M.toneMapped&&(Q===null||Q.isXRRenderTarget===!0)&&(Ie=i.toneMapping);const tt={shaderID:C,shaderType:M.type,shaderName:M.name,vertexShader:Ve,fragmentShader:Qe,defines:M.defines,customVertexShaderID:We,customFragmentShaderID:Y,isRawShaderMaterial:M.isRawShaderMaterial===!0,glslVersion:M.glslVersion,precision:p,batching:ve,batchingColor:ve&&W._colorsTexture!==null,instancing:Ce,instancingColor:Ce&&W.instanceColor!==null,instancingMorph:Ce&&W.morphTexture!==null,supportsVertexTextures:f,outputColorSpace:Q===null?i.outputColorSpace:Q.isXRRenderTarget===!0?Q.texture.colorSpace:Qn,alphaToCoverage:!!M.alphaToCoverage,map:Se,matcap:st,envMap:w,envMapMode:w&&J.mapping,envMapCubeUVHeight:B,aoMap:je,lightMap:De,bumpMap:be,normalMap:_e,displacementMap:f&&Ye,emissiveMap:me,normalMapObjectSpace:_e&&M.normalMapType===Vc,normalMapTangentSpace:_e&&M.normalMapType===Gc,metalnessMap:Le,roughnessMap:lt,anisotropy:it,anisotropyMap:V,clearcoat:y,clearcoatMap:ye,clearcoatNormalMap:G,clearcoatRoughnessMap:ue,dispersion:g,iridescence:O,iridescenceMap:le,iridescenceThicknessMap:ee,sheen:X,sheenColorMap:oe,sheenRoughnessMap:we,specularMap:Me,specularColorMap:re,specularIntensityMap:Ue,transmission:Z,transmissionMap:D,thicknessMap:ne,gradientMap:te,opaque:M.transparent===!1&&M.blending===vi&&M.alphaToCoverage===!1,alphaMap:ge,alphaTest:ie,alphaHash:K,combine:M.combine,mapUv:Se&&v(M.map.channel),aoMapUv:je&&v(M.aoMap.channel),lightMapUv:De&&v(M.lightMap.channel),bumpMapUv:be&&v(M.bumpMap.channel),normalMapUv:_e&&v(M.normalMap.channel),displacementMapUv:Ye&&v(M.displacementMap.channel),emissiveMapUv:me&&v(M.emissiveMap.channel),metalnessMapUv:Le&&v(M.metalnessMap.channel),roughnessMapUv:lt&&v(M.roughnessMap.channel),anisotropyMapUv:V&&v(M.anisotropyMap.channel),clearcoatMapUv:ye&&v(M.clearcoatMap.channel),clearcoatNormalMapUv:G&&v(M.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:ue&&v(M.clearcoatRoughnessMap.channel),iridescenceMapUv:le&&v(M.iridescenceMap.channel),iridescenceThicknessMapUv:ee&&v(M.iridescenceThicknessMap.channel),sheenColorMapUv:oe&&v(M.sheenColorMap.channel),sheenRoughnessMapUv:we&&v(M.sheenRoughnessMap.channel),specularMapUv:Me&&v(M.specularMap.channel),specularColorMapUv:re&&v(M.specularColorMap.channel),specularIntensityMapUv:Ue&&v(M.specularIntensityMap.channel),transmissionMapUv:D&&v(M.transmissionMap.channel),thicknessMapUv:ne&&v(M.thicknessMap.channel),alphaMapUv:ge&&v(M.alphaMap.channel),vertexTangents:!!q.attributes.tangent&&(_e||it),vertexColors:M.vertexColors,vertexAlphas:M.vertexColors===!0&&!!q.attributes.color&&q.attributes.color.itemSize===4,pointsUvs:W.isPoints===!0&&!!q.attributes.uv&&(Se||ge),fog:!!j,useFog:M.fog===!0,fogExp2:!!j&&j.isFogExp2,flatShading:M.flatShading===!0&&M.wireframe===!1,sizeAttenuation:M.sizeAttenuation===!0,logarithmicDepthBuffer:d,reversedDepthBuffer:de,skinning:W.isSkinnedMesh===!0,morphTargets:q.morphAttributes.position!==void 0,morphNormals:q.morphAttributes.normal!==void 0,morphColors:q.morphAttributes.color!==void 0,morphTargetsCount:pe,morphTextureStride:Oe,numDirLights:S.directional.length,numPointLights:S.point.length,numSpotLights:S.spot.length,numSpotLightMaps:S.spotLightMap.length,numRectAreaLights:S.rectArea.length,numHemiLights:S.hemi.length,numDirLightShadows:S.directionalShadowMap.length,numPointLightShadows:S.pointShadowMap.length,numSpotLightShadows:S.spotShadowMap.length,numSpotLightShadowsWithMaps:S.numSpotLightShadowsWithMaps,numLightProbes:S.numLightProbes,numClippingPlanes:o.numPlanes,numClipIntersection:o.numIntersection,dithering:M.dithering,shadowMapEnabled:i.shadowMap.enabled&&L.length>0,shadowMapType:i.shadowMap.type,toneMapping:Ie,decodeVideoTexture:Se&&M.map.isVideoTexture===!0&&Xe.getTransfer(M.map.colorSpace)===Je,decodeVideoTextureEmissive:me&&M.emissiveMap.isVideoTexture===!0&&Xe.getTransfer(M.emissiveMap.colorSpace)===Je,premultipliedAlpha:M.premultipliedAlpha,doubleSided:M.side===Vt,flipSided:M.side===wt,useDepthPacking:M.depthPacking>=0,depthPacking:M.depthPacking||0,index0AttributeName:M.index0AttributeName,extensionClipCullDistance:Ee&&M.extensions.clipCullDistance===!0&&n.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(Ee&&M.extensions.multiDraw===!0||ve)&&n.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:n.has("KHR_parallel_shader_compile"),customProgramCacheKey:M.customProgramCacheKey()};return tt.vertexUv1s=c.has(1),tt.vertexUv2s=c.has(2),tt.vertexUv3s=c.has(3),c.clear(),tt}function u(M){const S=[];if(M.shaderID?S.push(M.shaderID):(S.push(M.customVertexShaderID),S.push(M.customFragmentShaderID)),M.defines!==void 0)for(const L in M.defines)S.push(L),S.push(M.defines[L]);return M.isRawShaderMaterial===!1&&(A(S,M),b(S,M),S.push(i.outputColorSpace)),S.push(M.customProgramCacheKey),S.join()}function A(M,S){M.push(S.precision),M.push(S.outputColorSpace),M.push(S.envMapMode),M.push(S.envMapCubeUVHeight),M.push(S.mapUv),M.push(S.alphaMapUv),M.push(S.lightMapUv),M.push(S.aoMapUv),M.push(S.bumpMapUv),M.push(S.normalMapUv),M.push(S.displacementMapUv),M.push(S.emissiveMapUv),M.push(S.metalnessMapUv),M.push(S.roughnessMapUv),M.push(S.anisotropyMapUv),M.push(S.clearcoatMapUv),M.push(S.clearcoatNormalMapUv),M.push(S.clearcoatRoughnessMapUv),M.push(S.iridescenceMapUv),M.push(S.iridescenceThicknessMapUv),M.push(S.sheenColorMapUv),M.push(S.sheenRoughnessMapUv),M.push(S.specularMapUv),M.push(S.specularColorMapUv),M.push(S.specularIntensityMapUv),M.push(S.transmissionMapUv),M.push(S.thicknessMapUv),M.push(S.combine),M.push(S.fogExp2),M.push(S.sizeAttenuation),M.push(S.morphTargetsCount),M.push(S.morphAttributeCount),M.push(S.numDirLights),M.push(S.numPointLights),M.push(S.numSpotLights),M.push(S.numSpotLightMaps),M.push(S.numHemiLights),M.push(S.numRectAreaLights),M.push(S.numDirLightShadows),M.push(S.numPointLightShadows),M.push(S.numSpotLightShadows),M.push(S.numSpotLightShadowsWithMaps),M.push(S.numLightProbes),M.push(S.shadowMapType),M.push(S.toneMapping),M.push(S.numClippingPlanes),M.push(S.numClipIntersection),M.push(S.depthPacking)}function b(M,S){a.disableAll(),S.supportsVertexTextures&&a.enable(0),S.instancing&&a.enable(1),S.instancingColor&&a.enable(2),S.instancingMorph&&a.enable(3),S.matcap&&a.enable(4),S.envMap&&a.enable(5),S.normalMapObjectSpace&&a.enable(6),S.normalMapTangentSpace&&a.enable(7),S.clearcoat&&a.enable(8),S.iridescence&&a.enable(9),S.alphaTest&&a.enable(10),S.vertexColors&&a.enable(11),S.vertexAlphas&&a.enable(12),S.vertexUv1s&&a.enable(13),S.vertexUv2s&&a.enable(14),S.vertexUv3s&&a.enable(15),S.vertexTangents&&a.enable(16),S.anisotropy&&a.enable(17),S.alphaHash&&a.enable(18),S.batching&&a.enable(19),S.dispersion&&a.enable(20),S.batchingColor&&a.enable(21),S.gradientMap&&a.enable(22),M.push(a.mask),a.disableAll(),S.fog&&a.enable(0),S.useFog&&a.enable(1),S.flatShading&&a.enable(2),S.logarithmicDepthBuffer&&a.enable(3),S.reversedDepthBuffer&&a.enable(4),S.skinning&&a.enable(5),S.morphTargets&&a.enable(6),S.morphNormals&&a.enable(7),S.morphColors&&a.enable(8),S.premultipliedAlpha&&a.enable(9),S.shadowMapEnabled&&a.enable(10),S.doubleSided&&a.enable(11),S.flipSided&&a.enable(12),S.useDepthPacking&&a.enable(13),S.dithering&&a.enable(14),S.transmission&&a.enable(15),S.sheen&&a.enable(16),S.opaque&&a.enable(17),S.pointsUvs&&a.enable(18),S.decodeVideoTexture&&a.enable(19),S.decodeVideoTextureEmissive&&a.enable(20),S.alphaToCoverage&&a.enable(21),M.push(a.mask)}function E(M){const S=_[M.type];let L;if(S){const H=tn[S];L=Uh.clone(H.uniforms)}else L=M.uniforms;return L}function P(M,S){let L;for(let H=0,W=h.length;H<W;H++){const j=h[H];if(j.cacheKey===S){L=j,++L.usedTimes;break}}return L===void 0&&(L=new am(i,S,M,r),h.push(L)),L}function T(M){if(--M.usedTimes===0){const S=h.indexOf(M);h[S]=h[h.length-1],h.pop(),M.destroy()}}function R(M){l.remove(M)}function I(){l.dispose()}return{getParameters:m,getProgramCacheKey:u,getUniforms:E,acquireProgram:P,releaseProgram:T,releaseShaderCache:R,programs:h,dispose:I}}function um(){let i=new WeakMap;function e(o){return i.has(o)}function t(o){let a=i.get(o);return a===void 0&&(a={},i.set(o,a)),a}function n(o){i.delete(o)}function s(o,a,l){i.get(o)[a]=l}function r(){i=new WeakMap}return{has:e,get:t,remove:n,update:s,dispose:r}}function dm(i,e){return i.groupOrder!==e.groupOrder?i.groupOrder-e.groupOrder:i.renderOrder!==e.renderOrder?i.renderOrder-e.renderOrder:i.material.id!==e.material.id?i.material.id-e.material.id:i.z!==e.z?i.z-e.z:i.id-e.id}function $o(i,e){return i.groupOrder!==e.groupOrder?i.groupOrder-e.groupOrder:i.renderOrder!==e.renderOrder?i.renderOrder-e.renderOrder:i.z!==e.z?e.z-i.z:i.id-e.id}function Ko(){const i=[];let e=0;const t=[],n=[],s=[];function r(){e=0,t.length=0,n.length=0,s.length=0}function o(d,f,p,_,v,m){let u=i[e];return u===void 0?(u={id:d.id,object:d,geometry:f,material:p,groupOrder:_,renderOrder:d.renderOrder,z:v,group:m},i[e]=u):(u.id=d.id,u.object=d,u.geometry=f,u.material=p,u.groupOrder=_,u.renderOrder=d.renderOrder,u.z=v,u.group=m),e++,u}function a(d,f,p,_,v,m){const u=o(d,f,p,_,v,m);p.transmission>0?n.push(u):p.transparent===!0?s.push(u):t.push(u)}function l(d,f,p,_,v,m){const u=o(d,f,p,_,v,m);p.transmission>0?n.unshift(u):p.transparent===!0?s.unshift(u):t.unshift(u)}function c(d,f){t.length>1&&t.sort(d||dm),n.length>1&&n.sort(f||$o),s.length>1&&s.sort(f||$o)}function h(){for(let d=e,f=i.length;d<f;d++){const p=i[d];if(p.id===null)break;p.id=null,p.object=null,p.geometry=null,p.material=null,p.group=null}}return{opaque:t,transmissive:n,transparent:s,init:r,push:a,unshift:l,finish:h,sort:c}}function fm(){let i=new WeakMap;function e(n,s){const r=i.get(n);let o;return r===void 0?(o=new Ko,i.set(n,[o])):s>=r.length?(o=new Ko,r.push(o)):o=r[s],o}function t(){i=new WeakMap}return{get:e,dispose:t}}function pm(){const i={};return{get:function(e){if(i[e.id]!==void 0)return i[e.id];let t;switch(e.type){case"DirectionalLight":t={direction:new N,color:new ze};break;case"SpotLight":t={position:new N,direction:new N,color:new ze,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new N,color:new ze,distance:0,decay:0};break;case"HemisphereLight":t={direction:new N,skyColor:new ze,groundColor:new ze};break;case"RectAreaLight":t={color:new ze,position:new N,halfWidth:new N,halfHeight:new N};break}return i[e.id]=t,t}}}function mm(){const i={};return{get:function(e){if(i[e.id]!==void 0)return i[e.id];let t;switch(e.type){case"DirectionalLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Ke};break;case"SpotLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Ke};break;case"PointLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Ke,shadowCameraNear:1,shadowCameraFar:1e3};break}return i[e.id]=t,t}}}let gm=0;function _m(i,e){return(e.castShadow?2:0)-(i.castShadow?2:0)+(e.map?1:0)-(i.map?1:0)}function vm(i){const e=new pm,t=mm(),n={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)n.probe.push(new N);const s=new N,r=new ut,o=new ut;function a(c){let h=0,d=0,f=0;for(let M=0;M<9;M++)n.probe[M].set(0,0,0);let p=0,_=0,v=0,m=0,u=0,A=0,b=0,E=0,P=0,T=0,R=0;c.sort(_m);for(let M=0,S=c.length;M<S;M++){const L=c[M],H=L.color,W=L.intensity,j=L.distance,q=L.shadow&&L.shadow.map?L.shadow.map.texture:null;if(L.isAmbientLight)h+=H.r*W,d+=H.g*W,f+=H.b*W;else if(L.isLightProbe){for(let $=0;$<9;$++)n.probe[$].addScaledVector(L.sh.coefficients[$],W);R++}else if(L.isDirectionalLight){const $=e.get(L);if($.color.copy(L.color).multiplyScalar(L.intensity),L.castShadow){const J=L.shadow,B=t.get(L);B.shadowIntensity=J.intensity,B.shadowBias=J.bias,B.shadowNormalBias=J.normalBias,B.shadowRadius=J.radius,B.shadowMapSize=J.mapSize,n.directionalShadow[p]=B,n.directionalShadowMap[p]=q,n.directionalShadowMatrix[p]=L.shadow.matrix,A++}n.directional[p]=$,p++}else if(L.isSpotLight){const $=e.get(L);$.position.setFromMatrixPosition(L.matrixWorld),$.color.copy(H).multiplyScalar(W),$.distance=j,$.coneCos=Math.cos(L.angle),$.penumbraCos=Math.cos(L.angle*(1-L.penumbra)),$.decay=L.decay,n.spot[v]=$;const J=L.shadow;if(L.map&&(n.spotLightMap[P]=L.map,P++,J.updateMatrices(L),L.castShadow&&T++),n.spotLightMatrix[v]=J.matrix,L.castShadow){const B=t.get(L);B.shadowIntensity=J.intensity,B.shadowBias=J.bias,B.shadowNormalBias=J.normalBias,B.shadowRadius=J.radius,B.shadowMapSize=J.mapSize,n.spotShadow[v]=B,n.spotShadowMap[v]=q,E++}v++}else if(L.isRectAreaLight){const $=e.get(L);$.color.copy(H).multiplyScalar(W),$.halfWidth.set(L.width*.5,0,0),$.halfHeight.set(0,L.height*.5,0),n.rectArea[m]=$,m++}else if(L.isPointLight){const $=e.get(L);if($.color.copy(L.color).multiplyScalar(L.intensity),$.distance=L.distance,$.decay=L.decay,L.castShadow){const J=L.shadow,B=t.get(L);B.shadowIntensity=J.intensity,B.shadowBias=J.bias,B.shadowNormalBias=J.normalBias,B.shadowRadius=J.radius,B.shadowMapSize=J.mapSize,B.shadowCameraNear=J.camera.near,B.shadowCameraFar=J.camera.far,n.pointShadow[_]=B,n.pointShadowMap[_]=q,n.pointShadowMatrix[_]=L.shadow.matrix,b++}n.point[_]=$,_++}else if(L.isHemisphereLight){const $=e.get(L);$.skyColor.copy(L.color).multiplyScalar(W),$.groundColor.copy(L.groundColor).multiplyScalar(W),n.hemi[u]=$,u++}}m>0&&(i.has("OES_texture_float_linear")===!0?(n.rectAreaLTC1=ae.LTC_FLOAT_1,n.rectAreaLTC2=ae.LTC_FLOAT_2):(n.rectAreaLTC1=ae.LTC_HALF_1,n.rectAreaLTC2=ae.LTC_HALF_2)),n.ambient[0]=h,n.ambient[1]=d,n.ambient[2]=f;const I=n.hash;(I.directionalLength!==p||I.pointLength!==_||I.spotLength!==v||I.rectAreaLength!==m||I.hemiLength!==u||I.numDirectionalShadows!==A||I.numPointShadows!==b||I.numSpotShadows!==E||I.numSpotMaps!==P||I.numLightProbes!==R)&&(n.directional.length=p,n.spot.length=v,n.rectArea.length=m,n.point.length=_,n.hemi.length=u,n.directionalShadow.length=A,n.directionalShadowMap.length=A,n.pointShadow.length=b,n.pointShadowMap.length=b,n.spotShadow.length=E,n.spotShadowMap.length=E,n.directionalShadowMatrix.length=A,n.pointShadowMatrix.length=b,n.spotLightMatrix.length=E+P-T,n.spotLightMap.length=P,n.numSpotLightShadowsWithMaps=T,n.numLightProbes=R,I.directionalLength=p,I.pointLength=_,I.spotLength=v,I.rectAreaLength=m,I.hemiLength=u,I.numDirectionalShadows=A,I.numPointShadows=b,I.numSpotShadows=E,I.numSpotMaps=P,I.numLightProbes=R,n.version=gm++)}function l(c,h){let d=0,f=0,p=0,_=0,v=0;const m=h.matrixWorldInverse;for(let u=0,A=c.length;u<A;u++){const b=c[u];if(b.isDirectionalLight){const E=n.directional[d];E.direction.setFromMatrixPosition(b.matrixWorld),s.setFromMatrixPosition(b.target.matrixWorld),E.direction.sub(s),E.direction.transformDirection(m),d++}else if(b.isSpotLight){const E=n.spot[p];E.position.setFromMatrixPosition(b.matrixWorld),E.position.applyMatrix4(m),E.direction.setFromMatrixPosition(b.matrixWorld),s.setFromMatrixPosition(b.target.matrixWorld),E.direction.sub(s),E.direction.transformDirection(m),p++}else if(b.isRectAreaLight){const E=n.rectArea[_];E.position.setFromMatrixPosition(b.matrixWorld),E.position.applyMatrix4(m),o.identity(),r.copy(b.matrixWorld),r.premultiply(m),o.extractRotation(r),E.halfWidth.set(b.width*.5,0,0),E.halfHeight.set(0,b.height*.5,0),E.halfWidth.applyMatrix4(o),E.halfHeight.applyMatrix4(o),_++}else if(b.isPointLight){const E=n.point[f];E.position.setFromMatrixPosition(b.matrixWorld),E.position.applyMatrix4(m),f++}else if(b.isHemisphereLight){const E=n.hemi[v];E.direction.setFromMatrixPosition(b.matrixWorld),E.direction.transformDirection(m),v++}}}return{setup:a,setupView:l,state:n}}function jo(i){const e=new vm(i),t=[],n=[];function s(h){c.camera=h,t.length=0,n.length=0}function r(h){t.push(h)}function o(h){n.push(h)}function a(){e.setup(t)}function l(h){e.setupView(t,h)}const c={lightsArray:t,shadowsArray:n,camera:null,lights:e,transmissionRenderTarget:{}};return{init:s,state:c,setupLights:a,setupLightsView:l,pushLight:r,pushShadow:o}}function xm(i){let e=new WeakMap;function t(s,r=0){const o=e.get(s);let a;return o===void 0?(a=new jo(i),e.set(s,[a])):r>=o.length?(a=new jo(i),o.push(a)):a=o[r],a}function n(){e=new WeakMap}return{get:t,dispose:n}}const Sm=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,Mm=`uniform sampler2D shadow_pass;
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
}`;function Em(i,e,t){let n=new Il;const s=new Ke,r=new Ke,o=new ct,a=new $h({depthPacking:Hc}),l=new Kh,c={},h=t.maxTextureSize,d={[Un]:wt,[wt]:Un,[Vt]:Vt},f=new Pt({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new Ke},radius:{value:4}},vertexShader:Sm,fragmentShader:Mm}),p=f.clone();p.defines.HORIZONTAL_PASS=1;const _=new Ft;_.setAttribute("position",new gt(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const v=new bt(_,f),m=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=fl;let u=this.type;this.render=function(T,R,I){if(m.enabled===!1||m.autoUpdate===!1&&m.needsUpdate===!1||T.length===0)return;const M=i.getRenderTarget(),S=i.getActiveCubeFace(),L=i.getActiveMipmapLevel(),H=i.state;H.setBlending(Dn),H.buffers.depth.getReversed()===!0?H.buffers.color.setClear(0,0,0,0):H.buffers.color.setClear(1,1,1,1),H.buffers.depth.setTest(!0),H.setScissorTest(!1);const W=u!==fn&&this.type===fn,j=u===fn&&this.type!==fn;for(let q=0,$=T.length;q<$;q++){const J=T[q],B=J.shadow;if(B===void 0){console.warn("THREE.WebGLShadowMap:",J,"has no shadow.");continue}if(B.autoUpdate===!1&&B.needsUpdate===!1)continue;s.copy(B.mapSize);const C=B.getFrameExtents();if(s.multiply(C),r.copy(B.mapSize),(s.x>h||s.y>h)&&(s.x>h&&(r.x=Math.floor(h/C.x),s.x=r.x*C.x,B.mapSize.x=r.x),s.y>h&&(r.y=Math.floor(h/C.y),s.y=r.y*C.y,B.mapSize.y=r.y)),B.map===null||W===!0||j===!0){const pe=this.type!==fn?{minFilter:ht,magFilter:ht}:{};B.map!==null&&B.map.dispose(),B.map=new In(s.x,s.y,pe),B.map.texture.name=J.name+".shadowMap",B.camera.updateProjectionMatrix()}i.setRenderTarget(B.map),i.clear();const he=B.getViewportCount();for(let pe=0;pe<he;pe++){const Oe=B.getViewport(pe);o.set(r.x*Oe.x,r.y*Oe.y,r.x*Oe.z,r.y*Oe.w),H.viewport(o),B.updateMatrices(J,pe),n=B.getFrustum(),E(R,I,B.camera,J,this.type)}B.isPointLightShadow!==!0&&this.type===fn&&A(B,I),B.needsUpdate=!1}u=this.type,m.needsUpdate=!1,i.setRenderTarget(M,S,L)};function A(T,R){const I=e.update(v);f.defines.VSM_SAMPLES!==T.blurSamples&&(f.defines.VSM_SAMPLES=T.blurSamples,p.defines.VSM_SAMPLES=T.blurSamples,f.needsUpdate=!0,p.needsUpdate=!0),T.mapPass===null&&(T.mapPass=new In(s.x,s.y)),f.uniforms.shadow_pass.value=T.map.texture,f.uniforms.resolution.value=T.mapSize,f.uniforms.radius.value=T.radius,i.setRenderTarget(T.mapPass),i.clear(),i.renderBufferDirect(R,null,I,f,v,null),p.uniforms.shadow_pass.value=T.mapPass.texture,p.uniforms.resolution.value=T.mapSize,p.uniforms.radius.value=T.radius,i.setRenderTarget(T.map),i.clear(),i.renderBufferDirect(R,null,I,p,v,null)}function b(T,R,I,M){let S=null;const L=I.isPointLight===!0?T.customDistanceMaterial:T.customDepthMaterial;if(L!==void 0)S=L;else if(S=I.isPointLight===!0?l:a,i.localClippingEnabled&&R.clipShadows===!0&&Array.isArray(R.clippingPlanes)&&R.clippingPlanes.length!==0||R.displacementMap&&R.displacementScale!==0||R.alphaMap&&R.alphaTest>0||R.map&&R.alphaTest>0||R.alphaToCoverage===!0){const H=S.uuid,W=R.uuid;let j=c[H];j===void 0&&(j={},c[H]=j);let q=j[W];q===void 0&&(q=S.clone(),j[W]=q,R.addEventListener("dispose",P)),S=q}if(S.visible=R.visible,S.wireframe=R.wireframe,M===fn?S.side=R.shadowSide!==null?R.shadowSide:R.side:S.side=R.shadowSide!==null?R.shadowSide:d[R.side],S.alphaMap=R.alphaMap,S.alphaTest=R.alphaToCoverage===!0?.5:R.alphaTest,S.map=R.map,S.clipShadows=R.clipShadows,S.clippingPlanes=R.clippingPlanes,S.clipIntersection=R.clipIntersection,S.displacementMap=R.displacementMap,S.displacementScale=R.displacementScale,S.displacementBias=R.displacementBias,S.wireframeLinewidth=R.wireframeLinewidth,S.linewidth=R.linewidth,I.isPointLight===!0&&S.isMeshDistanceMaterial===!0){const H=i.properties.get(S);H.light=I}return S}function E(T,R,I,M,S){if(T.visible===!1)return;if(T.layers.test(R.layers)&&(T.isMesh||T.isLine||T.isPoints)&&(T.castShadow||T.receiveShadow&&S===fn)&&(!T.frustumCulled||n.intersectsObject(T))){T.modelViewMatrix.multiplyMatrices(I.matrixWorldInverse,T.matrixWorld);const W=e.update(T),j=T.material;if(Array.isArray(j)){const q=W.groups;for(let $=0,J=q.length;$<J;$++){const B=q[$],C=j[B.materialIndex];if(C&&C.visible){const he=b(T,C,M,S);T.onBeforeShadow(i,T,R,I,W,he,B),i.renderBufferDirect(I,null,W,he,T,B),T.onAfterShadow(i,T,R,I,W,he,B)}}}else if(j.visible){const q=b(T,j,M,S);T.onBeforeShadow(i,T,R,I,W,q,null),i.renderBufferDirect(I,null,W,q,T,null),T.onAfterShadow(i,T,R,I,W,q,null)}}const H=T.children;for(let W=0,j=H.length;W<j;W++)E(H[W],R,I,M,S)}function P(T){T.target.removeEventListener("dispose",P);for(const I in c){const M=c[I],S=T.target.uuid;S in M&&(M[S].dispose(),delete M[S])}}}const ym={[Fr]:Nr,[Or]:Ns,[Br]:kr,[Zn]:zr,[Nr]:Fr,[Ns]:Or,[kr]:Br,[zr]:Zn};function Tm(i,e){function t(){let D=!1;const ne=new ct;let te=null;const ge=new ct(0,0,0,0);return{setMask:function(ie){te!==ie&&!D&&(i.colorMask(ie,ie,ie,ie),te=ie)},setLocked:function(ie){D=ie},setClear:function(ie,K,Ee,Ie,tt){tt===!0&&(ie*=Ie,K*=Ie,Ee*=Ie),ne.set(ie,K,Ee,Ie),ge.equals(ne)===!1&&(i.clearColor(ie,K,Ee,Ie),ge.copy(ne))},reset:function(){D=!1,te=null,ge.set(-1,0,0,0)}}}function n(){let D=!1,ne=!1,te=null,ge=null,ie=null;return{setReversed:function(K){if(ne!==K){const Ee=e.get("EXT_clip_control");K?Ee.clipControlEXT(Ee.LOWER_LEFT_EXT,Ee.ZERO_TO_ONE_EXT):Ee.clipControlEXT(Ee.LOWER_LEFT_EXT,Ee.NEGATIVE_ONE_TO_ONE_EXT),ne=K;const Ie=ie;ie=null,this.setClear(Ie)}},getReversed:function(){return ne},setTest:function(K){K?Q(i.DEPTH_TEST):de(i.DEPTH_TEST)},setMask:function(K){te!==K&&!D&&(i.depthMask(K),te=K)},setFunc:function(K){if(ne&&(K=ym[K]),ge!==K){switch(K){case Fr:i.depthFunc(i.NEVER);break;case Nr:i.depthFunc(i.ALWAYS);break;case Or:i.depthFunc(i.LESS);break;case Zn:i.depthFunc(i.LEQUAL);break;case Br:i.depthFunc(i.EQUAL);break;case zr:i.depthFunc(i.GEQUAL);break;case Ns:i.depthFunc(i.GREATER);break;case kr:i.depthFunc(i.NOTEQUAL);break;default:i.depthFunc(i.LEQUAL)}ge=K}},setLocked:function(K){D=K},setClear:function(K){ie!==K&&(ne&&(K=1-K),i.clearDepth(K),ie=K)},reset:function(){D=!1,te=null,ge=null,ie=null,ne=!1}}}function s(){let D=!1,ne=null,te=null,ge=null,ie=null,K=null,Ee=null,Ie=null,tt=null;return{setTest:function($e){D||($e?Q(i.STENCIL_TEST):de(i.STENCIL_TEST))},setMask:function($e){ne!==$e&&!D&&(i.stencilMask($e),ne=$e)},setFunc:function($e,on,Qt){(te!==$e||ge!==on||ie!==Qt)&&(i.stencilFunc($e,on,Qt),te=$e,ge=on,ie=Qt)},setOp:function($e,on,Qt){(K!==$e||Ee!==on||Ie!==Qt)&&(i.stencilOp($e,on,Qt),K=$e,Ee=on,Ie=Qt)},setLocked:function($e){D=$e},setClear:function($e){tt!==$e&&(i.clearStencil($e),tt=$e)},reset:function(){D=!1,ne=null,te=null,ge=null,ie=null,K=null,Ee=null,Ie=null,tt=null}}}const r=new t,o=new n,a=new s,l=new WeakMap,c=new WeakMap;let h={},d={},f=new WeakMap,p=[],_=null,v=!1,m=null,u=null,A=null,b=null,E=null,P=null,T=null,R=new ze(0,0,0),I=0,M=!1,S=null,L=null,H=null,W=null,j=null;const q=i.getParameter(i.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let $=!1,J=0;const B=i.getParameter(i.VERSION);B.indexOf("WebGL")!==-1?(J=parseFloat(/^WebGL (\d)/.exec(B)[1]),$=J>=1):B.indexOf("OpenGL ES")!==-1&&(J=parseFloat(/^OpenGL ES (\d)/.exec(B)[1]),$=J>=2);let C=null,he={};const pe=i.getParameter(i.SCISSOR_BOX),Oe=i.getParameter(i.VIEWPORT),Ve=new ct().fromArray(pe),Qe=new ct().fromArray(Oe);function We(D,ne,te,ge){const ie=new Uint8Array(4),K=i.createTexture();i.bindTexture(D,K),i.texParameteri(D,i.TEXTURE_MIN_FILTER,i.NEAREST),i.texParameteri(D,i.TEXTURE_MAG_FILTER,i.NEAREST);for(let Ee=0;Ee<te;Ee++)D===i.TEXTURE_3D||D===i.TEXTURE_2D_ARRAY?i.texImage3D(ne,0,i.RGBA,1,1,ge,0,i.RGBA,i.UNSIGNED_BYTE,ie):i.texImage2D(ne+Ee,0,i.RGBA,1,1,0,i.RGBA,i.UNSIGNED_BYTE,ie);return K}const Y={};Y[i.TEXTURE_2D]=We(i.TEXTURE_2D,i.TEXTURE_2D,1),Y[i.TEXTURE_CUBE_MAP]=We(i.TEXTURE_CUBE_MAP,i.TEXTURE_CUBE_MAP_POSITIVE_X,6),Y[i.TEXTURE_2D_ARRAY]=We(i.TEXTURE_2D_ARRAY,i.TEXTURE_2D_ARRAY,1,1),Y[i.TEXTURE_3D]=We(i.TEXTURE_3D,i.TEXTURE_3D,1,1),r.setClear(0,0,0,1),o.setClear(1),a.setClear(0),Q(i.DEPTH_TEST),o.setFunc(Zn),be(!1),_e($a),Q(i.CULL_FACE),je(Dn);function Q(D){h[D]!==!0&&(i.enable(D),h[D]=!0)}function de(D){h[D]!==!1&&(i.disable(D),h[D]=!1)}function Ce(D,ne){return d[D]!==ne?(i.bindFramebuffer(D,ne),d[D]=ne,D===i.DRAW_FRAMEBUFFER&&(d[i.FRAMEBUFFER]=ne),D===i.FRAMEBUFFER&&(d[i.DRAW_FRAMEBUFFER]=ne),!0):!1}function ve(D,ne){let te=p,ge=!1;if(D){te=f.get(ne),te===void 0&&(te=[],f.set(ne,te));const ie=D.textures;if(te.length!==ie.length||te[0]!==i.COLOR_ATTACHMENT0){for(let K=0,Ee=ie.length;K<Ee;K++)te[K]=i.COLOR_ATTACHMENT0+K;te.length=ie.length,ge=!0}}else te[0]!==i.BACK&&(te[0]=i.BACK,ge=!0);ge&&i.drawBuffers(te)}function Se(D){return _!==D?(i.useProgram(D),_=D,!0):!1}const st={[qn]:i.FUNC_ADD,[fc]:i.FUNC_SUBTRACT,[pc]:i.FUNC_REVERSE_SUBTRACT};st[mc]=i.MIN,st[gc]=i.MAX;const w={[_c]:i.ZERO,[vc]:i.ONE,[xc]:i.SRC_COLOR,[Ur]:i.SRC_ALPHA,[bc]:i.SRC_ALPHA_SATURATE,[yc]:i.DST_COLOR,[Mc]:i.DST_ALPHA,[Sc]:i.ONE_MINUS_SRC_COLOR,[Ir]:i.ONE_MINUS_SRC_ALPHA,[Tc]:i.ONE_MINUS_DST_COLOR,[Ec]:i.ONE_MINUS_DST_ALPHA,[wc]:i.CONSTANT_COLOR,[Ac]:i.ONE_MINUS_CONSTANT_COLOR,[Rc]:i.CONSTANT_ALPHA,[Cc]:i.ONE_MINUS_CONSTANT_ALPHA};function je(D,ne,te,ge,ie,K,Ee,Ie,tt,$e){if(D===Dn){v===!0&&(de(i.BLEND),v=!1);return}if(v===!1&&(Q(i.BLEND),v=!0),D!==dc){if(D!==m||$e!==M){if((u!==qn||E!==qn)&&(i.blendEquation(i.FUNC_ADD),u=qn,E=qn),$e)switch(D){case vi:i.blendFuncSeparate(i.ONE,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case Ka:i.blendFunc(i.ONE,i.ONE);break;case ja:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case Za:i.blendFuncSeparate(i.DST_COLOR,i.ONE_MINUS_SRC_ALPHA,i.ZERO,i.ONE);break;default:console.error("THREE.WebGLState: Invalid blending: ",D);break}else switch(D){case vi:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case Ka:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE,i.ONE,i.ONE);break;case ja:console.error("THREE.WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case Za:console.error("THREE.WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:console.error("THREE.WebGLState: Invalid blending: ",D);break}A=null,b=null,P=null,T=null,R.set(0,0,0),I=0,m=D,M=$e}return}ie=ie||ne,K=K||te,Ee=Ee||ge,(ne!==u||ie!==E)&&(i.blendEquationSeparate(st[ne],st[ie]),u=ne,E=ie),(te!==A||ge!==b||K!==P||Ee!==T)&&(i.blendFuncSeparate(w[te],w[ge],w[K],w[Ee]),A=te,b=ge,P=K,T=Ee),(Ie.equals(R)===!1||tt!==I)&&(i.blendColor(Ie.r,Ie.g,Ie.b,tt),R.copy(Ie),I=tt),m=D,M=!1}function De(D,ne){D.side===Vt?de(i.CULL_FACE):Q(i.CULL_FACE);let te=D.side===wt;ne&&(te=!te),be(te),D.blending===vi&&D.transparent===!1?je(Dn):je(D.blending,D.blendEquation,D.blendSrc,D.blendDst,D.blendEquationAlpha,D.blendSrcAlpha,D.blendDstAlpha,D.blendColor,D.blendAlpha,D.premultipliedAlpha),o.setFunc(D.depthFunc),o.setTest(D.depthTest),o.setMask(D.depthWrite),r.setMask(D.colorWrite);const ge=D.stencilWrite;a.setTest(ge),ge&&(a.setMask(D.stencilWriteMask),a.setFunc(D.stencilFunc,D.stencilRef,D.stencilFuncMask),a.setOp(D.stencilFail,D.stencilZFail,D.stencilZPass)),me(D.polygonOffset,D.polygonOffsetFactor,D.polygonOffsetUnits),D.alphaToCoverage===!0?Q(i.SAMPLE_ALPHA_TO_COVERAGE):de(i.SAMPLE_ALPHA_TO_COVERAGE)}function be(D){S!==D&&(D?i.frontFace(i.CW):i.frontFace(i.CCW),S=D)}function _e(D){D!==cc?(Q(i.CULL_FACE),D!==L&&(D===$a?i.cullFace(i.BACK):D===hc?i.cullFace(i.FRONT):i.cullFace(i.FRONT_AND_BACK))):de(i.CULL_FACE),L=D}function Ye(D){D!==H&&($&&i.lineWidth(D),H=D)}function me(D,ne,te){D?(Q(i.POLYGON_OFFSET_FILL),(W!==ne||j!==te)&&(i.polygonOffset(ne,te),W=ne,j=te)):de(i.POLYGON_OFFSET_FILL)}function Le(D){D?Q(i.SCISSOR_TEST):de(i.SCISSOR_TEST)}function lt(D){D===void 0&&(D=i.TEXTURE0+q-1),C!==D&&(i.activeTexture(D),C=D)}function it(D,ne,te){te===void 0&&(C===null?te=i.TEXTURE0+q-1:te=C);let ge=he[te];ge===void 0&&(ge={type:void 0,texture:void 0},he[te]=ge),(ge.type!==D||ge.texture!==ne)&&(C!==te&&(i.activeTexture(te),C=te),i.bindTexture(D,ne||Y[D]),ge.type=D,ge.texture=ne)}function y(){const D=he[C];D!==void 0&&D.type!==void 0&&(i.bindTexture(D.type,null),D.type=void 0,D.texture=void 0)}function g(){try{i.compressedTexImage2D(...arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function O(){try{i.compressedTexImage3D(...arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function X(){try{i.texSubImage2D(...arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function Z(){try{i.texSubImage3D(...arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function V(){try{i.compressedTexSubImage2D(...arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function ye(){try{i.compressedTexSubImage3D(...arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function G(){try{i.texStorage2D(...arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function ue(){try{i.texStorage3D(...arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function le(){try{i.texImage2D(...arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function ee(){try{i.texImage3D(...arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function oe(D){Ve.equals(D)===!1&&(i.scissor(D.x,D.y,D.z,D.w),Ve.copy(D))}function we(D){Qe.equals(D)===!1&&(i.viewport(D.x,D.y,D.z,D.w),Qe.copy(D))}function Me(D,ne){let te=c.get(ne);te===void 0&&(te=new WeakMap,c.set(ne,te));let ge=te.get(D);ge===void 0&&(ge=i.getUniformBlockIndex(ne,D.name),te.set(D,ge))}function re(D,ne){const ge=c.get(ne).get(D);l.get(ne)!==ge&&(i.uniformBlockBinding(ne,ge,D.__bindingPointIndex),l.set(ne,ge))}function Ue(){i.disable(i.BLEND),i.disable(i.CULL_FACE),i.disable(i.DEPTH_TEST),i.disable(i.POLYGON_OFFSET_FILL),i.disable(i.SCISSOR_TEST),i.disable(i.STENCIL_TEST),i.disable(i.SAMPLE_ALPHA_TO_COVERAGE),i.blendEquation(i.FUNC_ADD),i.blendFunc(i.ONE,i.ZERO),i.blendFuncSeparate(i.ONE,i.ZERO,i.ONE,i.ZERO),i.blendColor(0,0,0,0),i.colorMask(!0,!0,!0,!0),i.clearColor(0,0,0,0),i.depthMask(!0),i.depthFunc(i.LESS),o.setReversed(!1),i.clearDepth(1),i.stencilMask(4294967295),i.stencilFunc(i.ALWAYS,0,4294967295),i.stencilOp(i.KEEP,i.KEEP,i.KEEP),i.clearStencil(0),i.cullFace(i.BACK),i.frontFace(i.CCW),i.polygonOffset(0,0),i.activeTexture(i.TEXTURE0),i.bindFramebuffer(i.FRAMEBUFFER,null),i.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),i.bindFramebuffer(i.READ_FRAMEBUFFER,null),i.useProgram(null),i.lineWidth(1),i.scissor(0,0,i.canvas.width,i.canvas.height),i.viewport(0,0,i.canvas.width,i.canvas.height),h={},C=null,he={},d={},f=new WeakMap,p=[],_=null,v=!1,m=null,u=null,A=null,b=null,E=null,P=null,T=null,R=new ze(0,0,0),I=0,M=!1,S=null,L=null,H=null,W=null,j=null,Ve.set(0,0,i.canvas.width,i.canvas.height),Qe.set(0,0,i.canvas.width,i.canvas.height),r.reset(),o.reset(),a.reset()}return{buffers:{color:r,depth:o,stencil:a},enable:Q,disable:de,bindFramebuffer:Ce,drawBuffers:ve,useProgram:Se,setBlending:je,setMaterial:De,setFlipSided:be,setCullFace:_e,setLineWidth:Ye,setPolygonOffset:me,setScissorTest:Le,activeTexture:lt,bindTexture:it,unbindTexture:y,compressedTexImage2D:g,compressedTexImage3D:O,texImage2D:le,texImage3D:ee,updateUBOMapping:Me,uniformBlockBinding:re,texStorage2D:G,texStorage3D:ue,texSubImage2D:X,texSubImage3D:Z,compressedTexSubImage2D:V,compressedTexSubImage3D:ye,scissor:oe,viewport:we,reset:Ue}}function bm(i,e,t,n,s,r,o){const a=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new Ke,h=new WeakMap;let d;const f=new WeakMap;let p=!1;try{p=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function _(y,g){return p?new OffscreenCanvas(y,g):zs("canvas")}function v(y,g,O){let X=1;const Z=it(y);if((Z.width>O||Z.height>O)&&(X=O/Math.max(Z.width,Z.height)),X<1)if(typeof HTMLImageElement<"u"&&y instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&y instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&y instanceof ImageBitmap||typeof VideoFrame<"u"&&y instanceof VideoFrame){const V=Math.floor(X*Z.width),ye=Math.floor(X*Z.height);d===void 0&&(d=_(V,ye));const G=g?_(V,ye):d;return G.width=V,G.height=ye,G.getContext("2d").drawImage(y,0,0,V,ye),console.warn("THREE.WebGLRenderer: Texture has been resized from ("+Z.width+"x"+Z.height+") to ("+V+"x"+ye+")."),G}else return"data"in y&&console.warn("THREE.WebGLRenderer: Image in DataTexture is too big ("+Z.width+"x"+Z.height+")."),y;return y}function m(y){return y.generateMipmaps}function u(y){i.generateMipmap(y)}function A(y){return y.isWebGLCubeRenderTarget?i.TEXTURE_CUBE_MAP:y.isWebGL3DRenderTarget?i.TEXTURE_3D:y.isWebGLArrayRenderTarget||y.isCompressedArrayTexture?i.TEXTURE_2D_ARRAY:i.TEXTURE_2D}function b(y,g,O,X,Z=!1){if(y!==null){if(i[y]!==void 0)return i[y];console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '"+y+"'")}let V=g;if(g===i.RED&&(O===i.FLOAT&&(V=i.R32F),O===i.HALF_FLOAT&&(V=i.R16F),O===i.UNSIGNED_BYTE&&(V=i.R8)),g===i.RED_INTEGER&&(O===i.UNSIGNED_BYTE&&(V=i.R8UI),O===i.UNSIGNED_SHORT&&(V=i.R16UI),O===i.UNSIGNED_INT&&(V=i.R32UI),O===i.BYTE&&(V=i.R8I),O===i.SHORT&&(V=i.R16I),O===i.INT&&(V=i.R32I)),g===i.RG&&(O===i.FLOAT&&(V=i.RG32F),O===i.HALF_FLOAT&&(V=i.RG16F),O===i.UNSIGNED_BYTE&&(V=i.RG8)),g===i.RG_INTEGER&&(O===i.UNSIGNED_BYTE&&(V=i.RG8UI),O===i.UNSIGNED_SHORT&&(V=i.RG16UI),O===i.UNSIGNED_INT&&(V=i.RG32UI),O===i.BYTE&&(V=i.RG8I),O===i.SHORT&&(V=i.RG16I),O===i.INT&&(V=i.RG32I)),g===i.RGB_INTEGER&&(O===i.UNSIGNED_BYTE&&(V=i.RGB8UI),O===i.UNSIGNED_SHORT&&(V=i.RGB16UI),O===i.UNSIGNED_INT&&(V=i.RGB32UI),O===i.BYTE&&(V=i.RGB8I),O===i.SHORT&&(V=i.RGB16I),O===i.INT&&(V=i.RGB32I)),g===i.RGBA_INTEGER&&(O===i.UNSIGNED_BYTE&&(V=i.RGBA8UI),O===i.UNSIGNED_SHORT&&(V=i.RGBA16UI),O===i.UNSIGNED_INT&&(V=i.RGBA32UI),O===i.BYTE&&(V=i.RGBA8I),O===i.SHORT&&(V=i.RGBA16I),O===i.INT&&(V=i.RGBA32I)),g===i.RGB&&(O===i.UNSIGNED_INT_5_9_9_9_REV&&(V=i.RGB9_E5),O===i.UNSIGNED_INT_10F_11F_11F_REV&&(V=i.R11F_G11F_B10F)),g===i.RGBA){const ye=Z?Os:Xe.getTransfer(X);O===i.FLOAT&&(V=i.RGBA32F),O===i.HALF_FLOAT&&(V=i.RGBA16F),O===i.UNSIGNED_BYTE&&(V=ye===Je?i.SRGB8_ALPHA8:i.RGBA8),O===i.UNSIGNED_SHORT_4_4_4_4&&(V=i.RGBA4),O===i.UNSIGNED_SHORT_5_5_5_1&&(V=i.RGB5_A1)}return(V===i.R16F||V===i.R32F||V===i.RG16F||V===i.RG32F||V===i.RGBA16F||V===i.RGBA32F)&&e.get("EXT_color_buffer_float"),V}function E(y,g){let O;return y?g===null||g===Jn||g===qi?O=i.DEPTH24_STENCIL8:g===pn?O=i.DEPTH32F_STENCIL8:g===Xi&&(O=i.DEPTH24_STENCIL8,console.warn("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):g===null||g===Jn||g===qi?O=i.DEPTH_COMPONENT24:g===pn?O=i.DEPTH_COMPONENT32F:g===Xi&&(O=i.DEPTH_COMPONENT16),O}function P(y,g){return m(y)===!0||y.isFramebufferTexture&&y.minFilter!==ht&&y.minFilter!==sn?Math.log2(Math.max(g.width,g.height))+1:y.mipmaps!==void 0&&y.mipmaps.length>0?y.mipmaps.length:y.isCompressedTexture&&Array.isArray(y.image)?g.mipmaps.length:1}function T(y){const g=y.target;g.removeEventListener("dispose",T),I(g),g.isVideoTexture&&h.delete(g)}function R(y){const g=y.target;g.removeEventListener("dispose",R),S(g)}function I(y){const g=n.get(y);if(g.__webglInit===void 0)return;const O=y.source,X=f.get(O);if(X){const Z=X[g.__cacheKey];Z.usedTimes--,Z.usedTimes===0&&M(y),Object.keys(X).length===0&&f.delete(O)}n.remove(y)}function M(y){const g=n.get(y);i.deleteTexture(g.__webglTexture);const O=y.source,X=f.get(O);delete X[g.__cacheKey],o.memory.textures--}function S(y){const g=n.get(y);if(y.depthTexture&&(y.depthTexture.dispose(),n.remove(y.depthTexture)),y.isWebGLCubeRenderTarget)for(let X=0;X<6;X++){if(Array.isArray(g.__webglFramebuffer[X]))for(let Z=0;Z<g.__webglFramebuffer[X].length;Z++)i.deleteFramebuffer(g.__webglFramebuffer[X][Z]);else i.deleteFramebuffer(g.__webglFramebuffer[X]);g.__webglDepthbuffer&&i.deleteRenderbuffer(g.__webglDepthbuffer[X])}else{if(Array.isArray(g.__webglFramebuffer))for(let X=0;X<g.__webglFramebuffer.length;X++)i.deleteFramebuffer(g.__webglFramebuffer[X]);else i.deleteFramebuffer(g.__webglFramebuffer);if(g.__webglDepthbuffer&&i.deleteRenderbuffer(g.__webglDepthbuffer),g.__webglMultisampledFramebuffer&&i.deleteFramebuffer(g.__webglMultisampledFramebuffer),g.__webglColorRenderbuffer)for(let X=0;X<g.__webglColorRenderbuffer.length;X++)g.__webglColorRenderbuffer[X]&&i.deleteRenderbuffer(g.__webglColorRenderbuffer[X]);g.__webglDepthRenderbuffer&&i.deleteRenderbuffer(g.__webglDepthRenderbuffer)}const O=y.textures;for(let X=0,Z=O.length;X<Z;X++){const V=n.get(O[X]);V.__webglTexture&&(i.deleteTexture(V.__webglTexture),o.memory.textures--),n.remove(O[X])}n.remove(y)}let L=0;function H(){L=0}function W(){const y=L;return y>=s.maxTextures&&console.warn("THREE.WebGLTextures: Trying to use "+y+" texture units while this GPU supports only "+s.maxTextures),L+=1,y}function j(y){const g=[];return g.push(y.wrapS),g.push(y.wrapT),g.push(y.wrapR||0),g.push(y.magFilter),g.push(y.minFilter),g.push(y.anisotropy),g.push(y.internalFormat),g.push(y.format),g.push(y.type),g.push(y.generateMipmaps),g.push(y.premultiplyAlpha),g.push(y.flipY),g.push(y.unpackAlignment),g.push(y.colorSpace),g.join()}function q(y,g){const O=n.get(y);if(y.isVideoTexture&&Le(y),y.isRenderTargetTexture===!1&&y.isExternalTexture!==!0&&y.version>0&&O.__version!==y.version){const X=y.image;if(X===null)console.warn("THREE.WebGLRenderer: Texture marked for update but no image data found.");else if(X.complete===!1)console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete");else{Y(O,y,g);return}}else y.isExternalTexture&&(O.__webglTexture=y.sourceTexture?y.sourceTexture:null);t.bindTexture(i.TEXTURE_2D,O.__webglTexture,i.TEXTURE0+g)}function $(y,g){const O=n.get(y);if(y.isRenderTargetTexture===!1&&y.version>0&&O.__version!==y.version){Y(O,y,g);return}t.bindTexture(i.TEXTURE_2D_ARRAY,O.__webglTexture,i.TEXTURE0+g)}function J(y,g){const O=n.get(y);if(y.isRenderTargetTexture===!1&&y.version>0&&O.__version!==y.version){Y(O,y,g);return}t.bindTexture(i.TEXTURE_3D,O.__webglTexture,i.TEXTURE0+g)}function B(y,g){const O=n.get(y);if(y.version>0&&O.__version!==y.version){Q(O,y,g);return}t.bindTexture(i.TEXTURE_CUBE_MAP,O.__webglTexture,i.TEXTURE0+g)}const C={[Vr]:i.REPEAT,[Kn]:i.CLAMP_TO_EDGE,[Wr]:i.MIRRORED_REPEAT},he={[ht]:i.NEAREST,[zc]:i.NEAREST_MIPMAP_NEAREST,[is]:i.NEAREST_MIPMAP_LINEAR,[sn]:i.LINEAR,[js]:i.LINEAR_MIPMAP_NEAREST,[jn]:i.LINEAR_MIPMAP_LINEAR},pe={[Wc]:i.NEVER,[jc]:i.ALWAYS,[Xc]:i.LESS,[Tl]:i.LEQUAL,[qc]:i.EQUAL,[Kc]:i.GEQUAL,[Yc]:i.GREATER,[$c]:i.NOTEQUAL};function Oe(y,g){if(g.type===pn&&e.has("OES_texture_float_linear")===!1&&(g.magFilter===sn||g.magFilter===js||g.magFilter===is||g.magFilter===jn||g.minFilter===sn||g.minFilter===js||g.minFilter===is||g.minFilter===jn)&&console.warn("THREE.WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),i.texParameteri(y,i.TEXTURE_WRAP_S,C[g.wrapS]),i.texParameteri(y,i.TEXTURE_WRAP_T,C[g.wrapT]),(y===i.TEXTURE_3D||y===i.TEXTURE_2D_ARRAY)&&i.texParameteri(y,i.TEXTURE_WRAP_R,C[g.wrapR]),i.texParameteri(y,i.TEXTURE_MAG_FILTER,he[g.magFilter]),i.texParameteri(y,i.TEXTURE_MIN_FILTER,he[g.minFilter]),g.compareFunction&&(i.texParameteri(y,i.TEXTURE_COMPARE_MODE,i.COMPARE_REF_TO_TEXTURE),i.texParameteri(y,i.TEXTURE_COMPARE_FUNC,pe[g.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){if(g.magFilter===ht||g.minFilter!==is&&g.minFilter!==jn||g.type===pn&&e.has("OES_texture_float_linear")===!1)return;if(g.anisotropy>1||n.get(g).__currentAnisotropy){const O=e.get("EXT_texture_filter_anisotropic");i.texParameterf(y,O.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(g.anisotropy,s.getMaxAnisotropy())),n.get(g).__currentAnisotropy=g.anisotropy}}}function Ve(y,g){let O=!1;y.__webglInit===void 0&&(y.__webglInit=!0,g.addEventListener("dispose",T));const X=g.source;let Z=f.get(X);Z===void 0&&(Z={},f.set(X,Z));const V=j(g);if(V!==y.__cacheKey){Z[V]===void 0&&(Z[V]={texture:i.createTexture(),usedTimes:0},o.memory.textures++,O=!0),Z[V].usedTimes++;const ye=Z[y.__cacheKey];ye!==void 0&&(Z[y.__cacheKey].usedTimes--,ye.usedTimes===0&&M(g)),y.__cacheKey=V,y.__webglTexture=Z[V].texture}return O}function Qe(y,g,O){return Math.floor(Math.floor(y/O)/g)}function We(y,g,O,X){const V=y.updateRanges;if(V.length===0)t.texSubImage2D(i.TEXTURE_2D,0,0,0,g.width,g.height,O,X,g.data);else{V.sort((ee,oe)=>ee.start-oe.start);let ye=0;for(let ee=1;ee<V.length;ee++){const oe=V[ye],we=V[ee],Me=oe.start+oe.count,re=Qe(we.start,g.width,4),Ue=Qe(oe.start,g.width,4);we.start<=Me+1&&re===Ue&&Qe(we.start+we.count-1,g.width,4)===re?oe.count=Math.max(oe.count,we.start+we.count-oe.start):(++ye,V[ye]=we)}V.length=ye+1;const G=i.getParameter(i.UNPACK_ROW_LENGTH),ue=i.getParameter(i.UNPACK_SKIP_PIXELS),le=i.getParameter(i.UNPACK_SKIP_ROWS);i.pixelStorei(i.UNPACK_ROW_LENGTH,g.width);for(let ee=0,oe=V.length;ee<oe;ee++){const we=V[ee],Me=Math.floor(we.start/4),re=Math.ceil(we.count/4),Ue=Me%g.width,D=Math.floor(Me/g.width),ne=re,te=1;i.pixelStorei(i.UNPACK_SKIP_PIXELS,Ue),i.pixelStorei(i.UNPACK_SKIP_ROWS,D),t.texSubImage2D(i.TEXTURE_2D,0,Ue,D,ne,te,O,X,g.data)}y.clearUpdateRanges(),i.pixelStorei(i.UNPACK_ROW_LENGTH,G),i.pixelStorei(i.UNPACK_SKIP_PIXELS,ue),i.pixelStorei(i.UNPACK_SKIP_ROWS,le)}}function Y(y,g,O){let X=i.TEXTURE_2D;(g.isDataArrayTexture||g.isCompressedArrayTexture)&&(X=i.TEXTURE_2D_ARRAY),g.isData3DTexture&&(X=i.TEXTURE_3D);const Z=Ve(y,g),V=g.source;t.bindTexture(X,y.__webglTexture,i.TEXTURE0+O);const ye=n.get(V);if(V.version!==ye.__version||Z===!0){t.activeTexture(i.TEXTURE0+O);const G=Xe.getPrimaries(Xe.workingColorSpace),ue=g.colorSpace===Rn?null:Xe.getPrimaries(g.colorSpace),le=g.colorSpace===Rn||G===ue?i.NONE:i.BROWSER_DEFAULT_WEBGL;i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,g.flipY),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,g.premultiplyAlpha),i.pixelStorei(i.UNPACK_ALIGNMENT,g.unpackAlignment),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,le);let ee=v(g.image,!1,s.maxTextureSize);ee=lt(g,ee);const oe=r.convert(g.format,g.colorSpace),we=r.convert(g.type);let Me=b(g.internalFormat,oe,we,g.colorSpace,g.isVideoTexture);Oe(X,g);let re;const Ue=g.mipmaps,D=g.isVideoTexture!==!0,ne=ye.__version===void 0||Z===!0,te=V.dataReady,ge=P(g,ee);if(g.isDepthTexture)Me=E(g.format===$i,g.type),ne&&(D?t.texStorage2D(i.TEXTURE_2D,1,Me,ee.width,ee.height):t.texImage2D(i.TEXTURE_2D,0,Me,ee.width,ee.height,0,oe,we,null));else if(g.isDataTexture)if(Ue.length>0){D&&ne&&t.texStorage2D(i.TEXTURE_2D,ge,Me,Ue[0].width,Ue[0].height);for(let ie=0,K=Ue.length;ie<K;ie++)re=Ue[ie],D?te&&t.texSubImage2D(i.TEXTURE_2D,ie,0,0,re.width,re.height,oe,we,re.data):t.texImage2D(i.TEXTURE_2D,ie,Me,re.width,re.height,0,oe,we,re.data);g.generateMipmaps=!1}else D?(ne&&t.texStorage2D(i.TEXTURE_2D,ge,Me,ee.width,ee.height),te&&We(g,ee,oe,we)):t.texImage2D(i.TEXTURE_2D,0,Me,ee.width,ee.height,0,oe,we,ee.data);else if(g.isCompressedTexture)if(g.isCompressedArrayTexture){D&&ne&&t.texStorage3D(i.TEXTURE_2D_ARRAY,ge,Me,Ue[0].width,Ue[0].height,ee.depth);for(let ie=0,K=Ue.length;ie<K;ie++)if(re=Ue[ie],g.format!==Wt)if(oe!==null)if(D){if(te)if(g.layerUpdates.size>0){const Ee=wo(re.width,re.height,g.format,g.type);for(const Ie of g.layerUpdates){const tt=re.data.subarray(Ie*Ee/re.data.BYTES_PER_ELEMENT,(Ie+1)*Ee/re.data.BYTES_PER_ELEMENT);t.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,ie,0,0,Ie,re.width,re.height,1,oe,tt)}g.clearLayerUpdates()}else t.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,ie,0,0,0,re.width,re.height,ee.depth,oe,re.data)}else t.compressedTexImage3D(i.TEXTURE_2D_ARRAY,ie,Me,re.width,re.height,ee.depth,0,re.data,0,0);else console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else D?te&&t.texSubImage3D(i.TEXTURE_2D_ARRAY,ie,0,0,0,re.width,re.height,ee.depth,oe,we,re.data):t.texImage3D(i.TEXTURE_2D_ARRAY,ie,Me,re.width,re.height,ee.depth,0,oe,we,re.data)}else{D&&ne&&t.texStorage2D(i.TEXTURE_2D,ge,Me,Ue[0].width,Ue[0].height);for(let ie=0,K=Ue.length;ie<K;ie++)re=Ue[ie],g.format!==Wt?oe!==null?D?te&&t.compressedTexSubImage2D(i.TEXTURE_2D,ie,0,0,re.width,re.height,oe,re.data):t.compressedTexImage2D(i.TEXTURE_2D,ie,Me,re.width,re.height,0,re.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):D?te&&t.texSubImage2D(i.TEXTURE_2D,ie,0,0,re.width,re.height,oe,we,re.data):t.texImage2D(i.TEXTURE_2D,ie,Me,re.width,re.height,0,oe,we,re.data)}else if(g.isDataArrayTexture)if(D){if(ne&&t.texStorage3D(i.TEXTURE_2D_ARRAY,ge,Me,ee.width,ee.height,ee.depth),te)if(g.layerUpdates.size>0){const ie=wo(ee.width,ee.height,g.format,g.type);for(const K of g.layerUpdates){const Ee=ee.data.subarray(K*ie/ee.data.BYTES_PER_ELEMENT,(K+1)*ie/ee.data.BYTES_PER_ELEMENT);t.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,K,ee.width,ee.height,1,oe,we,Ee)}g.clearLayerUpdates()}else t.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,0,ee.width,ee.height,ee.depth,oe,we,ee.data)}else t.texImage3D(i.TEXTURE_2D_ARRAY,0,Me,ee.width,ee.height,ee.depth,0,oe,we,ee.data);else if(g.isData3DTexture)D?(ne&&t.texStorage3D(i.TEXTURE_3D,ge,Me,ee.width,ee.height,ee.depth),te&&t.texSubImage3D(i.TEXTURE_3D,0,0,0,0,ee.width,ee.height,ee.depth,oe,we,ee.data)):t.texImage3D(i.TEXTURE_3D,0,Me,ee.width,ee.height,ee.depth,0,oe,we,ee.data);else if(g.isFramebufferTexture){if(ne)if(D)t.texStorage2D(i.TEXTURE_2D,ge,Me,ee.width,ee.height);else{let ie=ee.width,K=ee.height;for(let Ee=0;Ee<ge;Ee++)t.texImage2D(i.TEXTURE_2D,Ee,Me,ie,K,0,oe,we,null),ie>>=1,K>>=1}}else if(Ue.length>0){if(D&&ne){const ie=it(Ue[0]);t.texStorage2D(i.TEXTURE_2D,ge,Me,ie.width,ie.height)}for(let ie=0,K=Ue.length;ie<K;ie++)re=Ue[ie],D?te&&t.texSubImage2D(i.TEXTURE_2D,ie,0,0,oe,we,re):t.texImage2D(i.TEXTURE_2D,ie,Me,oe,we,re);g.generateMipmaps=!1}else if(D){if(ne){const ie=it(ee);t.texStorage2D(i.TEXTURE_2D,ge,Me,ie.width,ie.height)}te&&t.texSubImage2D(i.TEXTURE_2D,0,0,0,oe,we,ee)}else t.texImage2D(i.TEXTURE_2D,0,Me,oe,we,ee);m(g)&&u(X),ye.__version=V.version,g.onUpdate&&g.onUpdate(g)}y.__version=g.version}function Q(y,g,O){if(g.image.length!==6)return;const X=Ve(y,g),Z=g.source;t.bindTexture(i.TEXTURE_CUBE_MAP,y.__webglTexture,i.TEXTURE0+O);const V=n.get(Z);if(Z.version!==V.__version||X===!0){t.activeTexture(i.TEXTURE0+O);const ye=Xe.getPrimaries(Xe.workingColorSpace),G=g.colorSpace===Rn?null:Xe.getPrimaries(g.colorSpace),ue=g.colorSpace===Rn||ye===G?i.NONE:i.BROWSER_DEFAULT_WEBGL;i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,g.flipY),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,g.premultiplyAlpha),i.pixelStorei(i.UNPACK_ALIGNMENT,g.unpackAlignment),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,ue);const le=g.isCompressedTexture||g.image[0].isCompressedTexture,ee=g.image[0]&&g.image[0].isDataTexture,oe=[];for(let K=0;K<6;K++)!le&&!ee?oe[K]=v(g.image[K],!0,s.maxCubemapSize):oe[K]=ee?g.image[K].image:g.image[K],oe[K]=lt(g,oe[K]);const we=oe[0],Me=r.convert(g.format,g.colorSpace),re=r.convert(g.type),Ue=b(g.internalFormat,Me,re,g.colorSpace),D=g.isVideoTexture!==!0,ne=V.__version===void 0||X===!0,te=Z.dataReady;let ge=P(g,we);Oe(i.TEXTURE_CUBE_MAP,g);let ie;if(le){D&&ne&&t.texStorage2D(i.TEXTURE_CUBE_MAP,ge,Ue,we.width,we.height);for(let K=0;K<6;K++){ie=oe[K].mipmaps;for(let Ee=0;Ee<ie.length;Ee++){const Ie=ie[Ee];g.format!==Wt?Me!==null?D?te&&t.compressedTexSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,Ee,0,0,Ie.width,Ie.height,Me,Ie.data):t.compressedTexImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,Ee,Ue,Ie.width,Ie.height,0,Ie.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):D?te&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,Ee,0,0,Ie.width,Ie.height,Me,re,Ie.data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,Ee,Ue,Ie.width,Ie.height,0,Me,re,Ie.data)}}}else{if(ie=g.mipmaps,D&&ne){ie.length>0&&ge++;const K=it(oe[0]);t.texStorage2D(i.TEXTURE_CUBE_MAP,ge,Ue,K.width,K.height)}for(let K=0;K<6;K++)if(ee){D?te&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,0,0,0,oe[K].width,oe[K].height,Me,re,oe[K].data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,0,Ue,oe[K].width,oe[K].height,0,Me,re,oe[K].data);for(let Ee=0;Ee<ie.length;Ee++){const tt=ie[Ee].image[K].image;D?te&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,Ee+1,0,0,tt.width,tt.height,Me,re,tt.data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,Ee+1,Ue,tt.width,tt.height,0,Me,re,tt.data)}}else{D?te&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,0,0,0,Me,re,oe[K]):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,0,Ue,Me,re,oe[K]);for(let Ee=0;Ee<ie.length;Ee++){const Ie=ie[Ee];D?te&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,Ee+1,0,0,Me,re,Ie.image[K]):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+K,Ee+1,Ue,Me,re,Ie.image[K])}}}m(g)&&u(i.TEXTURE_CUBE_MAP),V.__version=Z.version,g.onUpdate&&g.onUpdate(g)}y.__version=g.version}function de(y,g,O,X,Z,V){const ye=r.convert(O.format,O.colorSpace),G=r.convert(O.type),ue=b(O.internalFormat,ye,G,O.colorSpace),le=n.get(g),ee=n.get(O);if(ee.__renderTarget=g,!le.__hasExternalTextures){const oe=Math.max(1,g.width>>V),we=Math.max(1,g.height>>V);Z===i.TEXTURE_3D||Z===i.TEXTURE_2D_ARRAY?t.texImage3D(Z,V,ue,oe,we,g.depth,0,ye,G,null):t.texImage2D(Z,V,ue,oe,we,0,ye,G,null)}t.bindFramebuffer(i.FRAMEBUFFER,y),me(g)?a.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,X,Z,ee.__webglTexture,0,Ye(g)):(Z===i.TEXTURE_2D||Z>=i.TEXTURE_CUBE_MAP_POSITIVE_X&&Z<=i.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&i.framebufferTexture2D(i.FRAMEBUFFER,X,Z,ee.__webglTexture,V),t.bindFramebuffer(i.FRAMEBUFFER,null)}function Ce(y,g,O){if(i.bindRenderbuffer(i.RENDERBUFFER,y),g.depthBuffer){const X=g.depthTexture,Z=X&&X.isDepthTexture?X.type:null,V=E(g.stencilBuffer,Z),ye=g.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,G=Ye(g);me(g)?a.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,G,V,g.width,g.height):O?i.renderbufferStorageMultisample(i.RENDERBUFFER,G,V,g.width,g.height):i.renderbufferStorage(i.RENDERBUFFER,V,g.width,g.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,ye,i.RENDERBUFFER,y)}else{const X=g.textures;for(let Z=0;Z<X.length;Z++){const V=X[Z],ye=r.convert(V.format,V.colorSpace),G=r.convert(V.type),ue=b(V.internalFormat,ye,G,V.colorSpace),le=Ye(g);O&&me(g)===!1?i.renderbufferStorageMultisample(i.RENDERBUFFER,le,ue,g.width,g.height):me(g)?a.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,le,ue,g.width,g.height):i.renderbufferStorage(i.RENDERBUFFER,ue,g.width,g.height)}}i.bindRenderbuffer(i.RENDERBUFFER,null)}function ve(y,g){if(g&&g.isWebGLCubeRenderTarget)throw new Error("Depth Texture with cube render targets is not supported");if(t.bindFramebuffer(i.FRAMEBUFFER,y),!(g.depthTexture&&g.depthTexture.isDepthTexture))throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");const X=n.get(g.depthTexture);X.__renderTarget=g,(!X.__webglTexture||g.depthTexture.image.width!==g.width||g.depthTexture.image.height!==g.height)&&(g.depthTexture.image.width=g.width,g.depthTexture.image.height=g.height,g.depthTexture.needsUpdate=!0),q(g.depthTexture,0);const Z=X.__webglTexture,V=Ye(g);if(g.depthTexture.format===Yi)me(g)?a.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,i.DEPTH_ATTACHMENT,i.TEXTURE_2D,Z,0,V):i.framebufferTexture2D(i.FRAMEBUFFER,i.DEPTH_ATTACHMENT,i.TEXTURE_2D,Z,0);else if(g.depthTexture.format===$i)me(g)?a.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,i.DEPTH_STENCIL_ATTACHMENT,i.TEXTURE_2D,Z,0,V):i.framebufferTexture2D(i.FRAMEBUFFER,i.DEPTH_STENCIL_ATTACHMENT,i.TEXTURE_2D,Z,0);else throw new Error("Unknown depthTexture format")}function Se(y){const g=n.get(y),O=y.isWebGLCubeRenderTarget===!0;if(g.__boundDepthTexture!==y.depthTexture){const X=y.depthTexture;if(g.__depthDisposeCallback&&g.__depthDisposeCallback(),X){const Z=()=>{delete g.__boundDepthTexture,delete g.__depthDisposeCallback,X.removeEventListener("dispose",Z)};X.addEventListener("dispose",Z),g.__depthDisposeCallback=Z}g.__boundDepthTexture=X}if(y.depthTexture&&!g.__autoAllocateDepthBuffer){if(O)throw new Error("target.depthTexture not supported in Cube render targets");const X=y.texture.mipmaps;X&&X.length>0?ve(g.__webglFramebuffer[0],y):ve(g.__webglFramebuffer,y)}else if(O){g.__webglDepthbuffer=[];for(let X=0;X<6;X++)if(t.bindFramebuffer(i.FRAMEBUFFER,g.__webglFramebuffer[X]),g.__webglDepthbuffer[X]===void 0)g.__webglDepthbuffer[X]=i.createRenderbuffer(),Ce(g.__webglDepthbuffer[X],y,!1);else{const Z=y.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,V=g.__webglDepthbuffer[X];i.bindRenderbuffer(i.RENDERBUFFER,V),i.framebufferRenderbuffer(i.FRAMEBUFFER,Z,i.RENDERBUFFER,V)}}else{const X=y.texture.mipmaps;if(X&&X.length>0?t.bindFramebuffer(i.FRAMEBUFFER,g.__webglFramebuffer[0]):t.bindFramebuffer(i.FRAMEBUFFER,g.__webglFramebuffer),g.__webglDepthbuffer===void 0)g.__webglDepthbuffer=i.createRenderbuffer(),Ce(g.__webglDepthbuffer,y,!1);else{const Z=y.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,V=g.__webglDepthbuffer;i.bindRenderbuffer(i.RENDERBUFFER,V),i.framebufferRenderbuffer(i.FRAMEBUFFER,Z,i.RENDERBUFFER,V)}}t.bindFramebuffer(i.FRAMEBUFFER,null)}function st(y,g,O){const X=n.get(y);g!==void 0&&de(X.__webglFramebuffer,y,y.texture,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,0),O!==void 0&&Se(y)}function w(y){const g=y.texture,O=n.get(y),X=n.get(g);y.addEventListener("dispose",R);const Z=y.textures,V=y.isWebGLCubeRenderTarget===!0,ye=Z.length>1;if(ye||(X.__webglTexture===void 0&&(X.__webglTexture=i.createTexture()),X.__version=g.version,o.memory.textures++),V){O.__webglFramebuffer=[];for(let G=0;G<6;G++)if(g.mipmaps&&g.mipmaps.length>0){O.__webglFramebuffer[G]=[];for(let ue=0;ue<g.mipmaps.length;ue++)O.__webglFramebuffer[G][ue]=i.createFramebuffer()}else O.__webglFramebuffer[G]=i.createFramebuffer()}else{if(g.mipmaps&&g.mipmaps.length>0){O.__webglFramebuffer=[];for(let G=0;G<g.mipmaps.length;G++)O.__webglFramebuffer[G]=i.createFramebuffer()}else O.__webglFramebuffer=i.createFramebuffer();if(ye)for(let G=0,ue=Z.length;G<ue;G++){const le=n.get(Z[G]);le.__webglTexture===void 0&&(le.__webglTexture=i.createTexture(),o.memory.textures++)}if(y.samples>0&&me(y)===!1){O.__webglMultisampledFramebuffer=i.createFramebuffer(),O.__webglColorRenderbuffer=[],t.bindFramebuffer(i.FRAMEBUFFER,O.__webglMultisampledFramebuffer);for(let G=0;G<Z.length;G++){const ue=Z[G];O.__webglColorRenderbuffer[G]=i.createRenderbuffer(),i.bindRenderbuffer(i.RENDERBUFFER,O.__webglColorRenderbuffer[G]);const le=r.convert(ue.format,ue.colorSpace),ee=r.convert(ue.type),oe=b(ue.internalFormat,le,ee,ue.colorSpace,y.isXRRenderTarget===!0),we=Ye(y);i.renderbufferStorageMultisample(i.RENDERBUFFER,we,oe,y.width,y.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+G,i.RENDERBUFFER,O.__webglColorRenderbuffer[G])}i.bindRenderbuffer(i.RENDERBUFFER,null),y.depthBuffer&&(O.__webglDepthRenderbuffer=i.createRenderbuffer(),Ce(O.__webglDepthRenderbuffer,y,!0)),t.bindFramebuffer(i.FRAMEBUFFER,null)}}if(V){t.bindTexture(i.TEXTURE_CUBE_MAP,X.__webglTexture),Oe(i.TEXTURE_CUBE_MAP,g);for(let G=0;G<6;G++)if(g.mipmaps&&g.mipmaps.length>0)for(let ue=0;ue<g.mipmaps.length;ue++)de(O.__webglFramebuffer[G][ue],y,g,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+G,ue);else de(O.__webglFramebuffer[G],y,g,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+G,0);m(g)&&u(i.TEXTURE_CUBE_MAP),t.unbindTexture()}else if(ye){for(let G=0,ue=Z.length;G<ue;G++){const le=Z[G],ee=n.get(le);let oe=i.TEXTURE_2D;(y.isWebGL3DRenderTarget||y.isWebGLArrayRenderTarget)&&(oe=y.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),t.bindTexture(oe,ee.__webglTexture),Oe(oe,le),de(O.__webglFramebuffer,y,le,i.COLOR_ATTACHMENT0+G,oe,0),m(le)&&u(oe)}t.unbindTexture()}else{let G=i.TEXTURE_2D;if((y.isWebGL3DRenderTarget||y.isWebGLArrayRenderTarget)&&(G=y.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),t.bindTexture(G,X.__webglTexture),Oe(G,g),g.mipmaps&&g.mipmaps.length>0)for(let ue=0;ue<g.mipmaps.length;ue++)de(O.__webglFramebuffer[ue],y,g,i.COLOR_ATTACHMENT0,G,ue);else de(O.__webglFramebuffer,y,g,i.COLOR_ATTACHMENT0,G,0);m(g)&&u(G),t.unbindTexture()}y.depthBuffer&&Se(y)}function je(y){const g=y.textures;for(let O=0,X=g.length;O<X;O++){const Z=g[O];if(m(Z)){const V=A(y),ye=n.get(Z).__webglTexture;t.bindTexture(V,ye),u(V),t.unbindTexture()}}}const De=[],be=[];function _e(y){if(y.samples>0){if(me(y)===!1){const g=y.textures,O=y.width,X=y.height;let Z=i.COLOR_BUFFER_BIT;const V=y.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,ye=n.get(y),G=g.length>1;if(G)for(let le=0;le<g.length;le++)t.bindFramebuffer(i.FRAMEBUFFER,ye.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+le,i.RENDERBUFFER,null),t.bindFramebuffer(i.FRAMEBUFFER,ye.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+le,i.TEXTURE_2D,null,0);t.bindFramebuffer(i.READ_FRAMEBUFFER,ye.__webglMultisampledFramebuffer);const ue=y.texture.mipmaps;ue&&ue.length>0?t.bindFramebuffer(i.DRAW_FRAMEBUFFER,ye.__webglFramebuffer[0]):t.bindFramebuffer(i.DRAW_FRAMEBUFFER,ye.__webglFramebuffer);for(let le=0;le<g.length;le++){if(y.resolveDepthBuffer&&(y.depthBuffer&&(Z|=i.DEPTH_BUFFER_BIT),y.stencilBuffer&&y.resolveStencilBuffer&&(Z|=i.STENCIL_BUFFER_BIT)),G){i.framebufferRenderbuffer(i.READ_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.RENDERBUFFER,ye.__webglColorRenderbuffer[le]);const ee=n.get(g[le]).__webglTexture;i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,ee,0)}i.blitFramebuffer(0,0,O,X,0,0,O,X,Z,i.NEAREST),l===!0&&(De.length=0,be.length=0,De.push(i.COLOR_ATTACHMENT0+le),y.depthBuffer&&y.resolveDepthBuffer===!1&&(De.push(V),be.push(V),i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,be)),i.invalidateFramebuffer(i.READ_FRAMEBUFFER,De))}if(t.bindFramebuffer(i.READ_FRAMEBUFFER,null),t.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),G)for(let le=0;le<g.length;le++){t.bindFramebuffer(i.FRAMEBUFFER,ye.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+le,i.RENDERBUFFER,ye.__webglColorRenderbuffer[le]);const ee=n.get(g[le]).__webglTexture;t.bindFramebuffer(i.FRAMEBUFFER,ye.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+le,i.TEXTURE_2D,ee,0)}t.bindFramebuffer(i.DRAW_FRAMEBUFFER,ye.__webglMultisampledFramebuffer)}else if(y.depthBuffer&&y.resolveDepthBuffer===!1&&l){const g=y.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,[g])}}}function Ye(y){return Math.min(s.maxSamples,y.samples)}function me(y){const g=n.get(y);return y.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&g.__useRenderToTexture!==!1}function Le(y){const g=o.render.frame;h.get(y)!==g&&(h.set(y,g),y.update())}function lt(y,g){const O=y.colorSpace,X=y.format,Z=y.type;return y.isCompressedTexture===!0||y.isVideoTexture===!0||O!==Qn&&O!==Rn&&(Xe.getTransfer(O)===Je?(X!==Wt||Z!==gn)&&console.warn("THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):console.error("THREE.WebGLTextures: Unsupported texture color space:",O)),g}function it(y){return typeof HTMLImageElement<"u"&&y instanceof HTMLImageElement?(c.width=y.naturalWidth||y.width,c.height=y.naturalHeight||y.height):typeof VideoFrame<"u"&&y instanceof VideoFrame?(c.width=y.displayWidth,c.height=y.displayHeight):(c.width=y.width,c.height=y.height),c}this.allocateTextureUnit=W,this.resetTextureUnits=H,this.setTexture2D=q,this.setTexture2DArray=$,this.setTexture3D=J,this.setTextureCube=B,this.rebindTextures=st,this.setupRenderTarget=w,this.updateRenderTargetMipmap=je,this.updateMultisampleRenderTarget=_e,this.setupDepthRenderbuffer=Se,this.setupFrameBufferTexture=de,this.useMultisampledRTT=me}function wm(i,e){function t(n,s=Rn){let r;const o=Xe.getTransfer(s);if(n===gn)return i.UNSIGNED_BYTE;if(n===Ta)return i.UNSIGNED_SHORT_4_4_4_4;if(n===ba)return i.UNSIGNED_SHORT_5_5_5_1;if(n===vl)return i.UNSIGNED_INT_5_9_9_9_REV;if(n===xl)return i.UNSIGNED_INT_10F_11F_11F_REV;if(n===gl)return i.BYTE;if(n===_l)return i.SHORT;if(n===Xi)return i.UNSIGNED_SHORT;if(n===ya)return i.INT;if(n===Jn)return i.UNSIGNED_INT;if(n===pn)return i.FLOAT;if(n===Zi)return i.HALF_FLOAT;if(n===Sl)return i.ALPHA;if(n===Ml)return i.RGB;if(n===Wt)return i.RGBA;if(n===Yi)return i.DEPTH_COMPONENT;if(n===$i)return i.DEPTH_STENCIL;if(n===El)return i.RED;if(n===wa)return i.RED_INTEGER;if(n===yl)return i.RG;if(n===Aa)return i.RG_INTEGER;if(n===Ra)return i.RGBA_INTEGER;if(n===Cs||n===Ps||n===Ds||n===Ls)if(o===Je)if(r=e.get("WEBGL_compressed_texture_s3tc_srgb"),r!==null){if(n===Cs)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===Ps)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===Ds)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===Ls)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(r=e.get("WEBGL_compressed_texture_s3tc"),r!==null){if(n===Cs)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===Ps)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===Ds)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===Ls)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===Xr||n===qr||n===Yr||n===$r)if(r=e.get("WEBGL_compressed_texture_pvrtc"),r!==null){if(n===Xr)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===qr)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===Yr)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===$r)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===Kr||n===jr||n===Zr)if(r=e.get("WEBGL_compressed_texture_etc"),r!==null){if(n===Kr||n===jr)return o===Je?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(n===Zr)return o===Je?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC}else return null;if(n===Jr||n===Qr||n===ea||n===ta||n===na||n===ia||n===sa||n===ra||n===aa||n===oa||n===la||n===ca||n===ha||n===ua)if(r=e.get("WEBGL_compressed_texture_astc"),r!==null){if(n===Jr)return o===Je?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===Qr)return o===Je?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===ea)return o===Je?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===ta)return o===Je?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===na)return o===Je?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===ia)return o===Je?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===sa)return o===Je?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===ra)return o===Je?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===aa)return o===Je?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===oa)return o===Je?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===la)return o===Je?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===ca)return o===Je?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===ha)return o===Je?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===ua)return o===Je?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===da||n===fa||n===pa)if(r=e.get("EXT_texture_compression_bptc"),r!==null){if(n===da)return o===Je?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===fa)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===pa)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===ma||n===ga||n===_a||n===va)if(r=e.get("EXT_texture_compression_rgtc"),r!==null){if(n===ma)return r.COMPRESSED_RED_RGTC1_EXT;if(n===ga)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===_a)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===va)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===qi?i.UNSIGNED_INT_24_8:i[n]!==void 0?i[n]:null}return{convert:t}}const Am=`
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

}`;class Cm{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){const n=new Ol(e.texture);(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=n}}getMesh(e){if(this.texture!==null&&this.mesh===null){const t=e.cameras[0].viewport,n=new Pt({vertexShader:Am,fragmentShader:Rm,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new bt(new Fn(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}}class Pm extends Ai{constructor(e,t){super();const n=this;let s=null,r=1,o=null,a="local-floor",l=1,c=null,h=null,d=null,f=null,p=null,_=null;const v=typeof XRWebGLBinding<"u",m=new Cm,u={},A=t.getContextAttributes();let b=null,E=null;const P=[],T=[],R=new Ke;let I=null;const M=new Gt;M.viewport=new ct;const S=new Gt;S.viewport=new ct;const L=[M,S],H=new jh;let W=null,j=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(Y){let Q=P[Y];return Q===void 0&&(Q=new _r,P[Y]=Q),Q.getTargetRaySpace()},this.getControllerGrip=function(Y){let Q=P[Y];return Q===void 0&&(Q=new _r,P[Y]=Q),Q.getGripSpace()},this.getHand=function(Y){let Q=P[Y];return Q===void 0&&(Q=new _r,P[Y]=Q),Q.getHandSpace()};function q(Y){const Q=T.indexOf(Y.inputSource);if(Q===-1)return;const de=P[Q];de!==void 0&&(de.update(Y.inputSource,Y.frame,c||o),de.dispatchEvent({type:Y.type,data:Y.inputSource}))}function $(){s.removeEventListener("select",q),s.removeEventListener("selectstart",q),s.removeEventListener("selectend",q),s.removeEventListener("squeeze",q),s.removeEventListener("squeezestart",q),s.removeEventListener("squeezeend",q),s.removeEventListener("end",$),s.removeEventListener("inputsourceschange",J);for(let Y=0;Y<P.length;Y++){const Q=T[Y];Q!==null&&(T[Y]=null,P[Y].disconnect(Q))}W=null,j=null,m.reset();for(const Y in u)delete u[Y];e.setRenderTarget(b),p=null,f=null,d=null,s=null,E=null,We.stop(),n.isPresenting=!1,e.setPixelRatio(I),e.setSize(R.width,R.height,!1),n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(Y){r=Y,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(Y){a=Y,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||o},this.setReferenceSpace=function(Y){c=Y},this.getBaseLayer=function(){return f!==null?f:p},this.getBinding=function(){return d===null&&v&&(d=new XRWebGLBinding(s,t)),d},this.getFrame=function(){return _},this.getSession=function(){return s},this.setSession=async function(Y){if(s=Y,s!==null){if(b=e.getRenderTarget(),s.addEventListener("select",q),s.addEventListener("selectstart",q),s.addEventListener("selectend",q),s.addEventListener("squeeze",q),s.addEventListener("squeezestart",q),s.addEventListener("squeezeend",q),s.addEventListener("end",$),s.addEventListener("inputsourceschange",J),A.xrCompatible!==!0&&await t.makeXRCompatible(),I=e.getPixelRatio(),e.getSize(R),v&&"createProjectionLayer"in XRWebGLBinding.prototype){let de=null,Ce=null,ve=null;A.depth&&(ve=A.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,de=A.stencil?$i:Yi,Ce=A.stencil?qi:Jn);const Se={colorFormat:t.RGBA8,depthFormat:ve,scaleFactor:r};d=this.getBinding(),f=d.createProjectionLayer(Se),s.updateRenderState({layers:[f]}),e.setPixelRatio(1),e.setSize(f.textureWidth,f.textureHeight,!1),E=new In(f.textureWidth,f.textureHeight,{format:Wt,type:gn,depthTexture:new Nl(f.textureWidth,f.textureHeight,Ce,void 0,void 0,void 0,void 0,void 0,void 0,de),stencilBuffer:A.stencil,colorSpace:e.outputColorSpace,samples:A.antialias?4:0,resolveDepthBuffer:f.ignoreDepthValues===!1,resolveStencilBuffer:f.ignoreDepthValues===!1})}else{const de={antialias:A.antialias,alpha:!0,depth:A.depth,stencil:A.stencil,framebufferScaleFactor:r};p=new XRWebGLLayer(s,t,de),s.updateRenderState({baseLayer:p}),e.setPixelRatio(1),e.setSize(p.framebufferWidth,p.framebufferHeight,!1),E=new In(p.framebufferWidth,p.framebufferHeight,{format:Wt,type:gn,colorSpace:e.outputColorSpace,stencilBuffer:A.stencil,resolveDepthBuffer:p.ignoreDepthValues===!1,resolveStencilBuffer:p.ignoreDepthValues===!1})}E.isXRRenderTarget=!0,this.setFoveation(l),c=null,o=await s.requestReferenceSpace(a),We.setContext(s),We.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(s!==null)return s.environmentBlendMode},this.getDepthTexture=function(){return m.getDepthTexture()};function J(Y){for(let Q=0;Q<Y.removed.length;Q++){const de=Y.removed[Q],Ce=T.indexOf(de);Ce>=0&&(T[Ce]=null,P[Ce].disconnect(de))}for(let Q=0;Q<Y.added.length;Q++){const de=Y.added[Q];let Ce=T.indexOf(de);if(Ce===-1){for(let Se=0;Se<P.length;Se++)if(Se>=T.length){T.push(de),Ce=Se;break}else if(T[Se]===null){T[Se]=de,Ce=Se;break}if(Ce===-1)break}const ve=P[Ce];ve&&ve.connect(de)}}const B=new N,C=new N;function he(Y,Q,de){B.setFromMatrixPosition(Q.matrixWorld),C.setFromMatrixPosition(de.matrixWorld);const Ce=B.distanceTo(C),ve=Q.projectionMatrix.elements,Se=de.projectionMatrix.elements,st=ve[14]/(ve[10]-1),w=ve[14]/(ve[10]+1),je=(ve[9]+1)/ve[5],De=(ve[9]-1)/ve[5],be=(ve[8]-1)/ve[0],_e=(Se[8]+1)/Se[0],Ye=st*be,me=st*_e,Le=Ce/(-be+_e),lt=Le*-be;if(Q.matrixWorld.decompose(Y.position,Y.quaternion,Y.scale),Y.translateX(lt),Y.translateZ(Le),Y.matrixWorld.compose(Y.position,Y.quaternion,Y.scale),Y.matrixWorldInverse.copy(Y.matrixWorld).invert(),ve[10]===-1)Y.projectionMatrix.copy(Q.projectionMatrix),Y.projectionMatrixInverse.copy(Q.projectionMatrixInverse);else{const it=st+Le,y=w+Le,g=Ye-lt,O=me+(Ce-lt),X=je*w/y*it,Z=De*w/y*it;Y.projectionMatrix.makePerspective(g,O,X,Z,it,y),Y.projectionMatrixInverse.copy(Y.projectionMatrix).invert()}}function pe(Y,Q){Q===null?Y.matrixWorld.copy(Y.matrix):Y.matrixWorld.multiplyMatrices(Q.matrixWorld,Y.matrix),Y.matrixWorldInverse.copy(Y.matrixWorld).invert()}this.updateCamera=function(Y){if(s===null)return;let Q=Y.near,de=Y.far;m.texture!==null&&(m.depthNear>0&&(Q=m.depthNear),m.depthFar>0&&(de=m.depthFar)),H.near=S.near=M.near=Q,H.far=S.far=M.far=de,(W!==H.near||j!==H.far)&&(s.updateRenderState({depthNear:H.near,depthFar:H.far}),W=H.near,j=H.far),H.layers.mask=Y.layers.mask|6,M.layers.mask=H.layers.mask&3,S.layers.mask=H.layers.mask&5;const Ce=Y.parent,ve=H.cameras;pe(H,Ce);for(let Se=0;Se<ve.length;Se++)pe(ve[Se],Ce);ve.length===2?he(H,M,S):H.projectionMatrix.copy(M.projectionMatrix),Oe(Y,H,Ce)};function Oe(Y,Q,de){de===null?Y.matrix.copy(Q.matrixWorld):(Y.matrix.copy(de.matrixWorld),Y.matrix.invert(),Y.matrix.multiply(Q.matrixWorld)),Y.matrix.decompose(Y.position,Y.quaternion,Y.scale),Y.updateMatrixWorld(!0),Y.projectionMatrix.copy(Q.projectionMatrix),Y.projectionMatrixInverse.copy(Q.projectionMatrixInverse),Y.isPerspectiveCamera&&(Y.fov=Ki*2*Math.atan(1/Y.projectionMatrix.elements[5]),Y.zoom=1)}this.getCamera=function(){return H},this.getFoveation=function(){if(!(f===null&&p===null))return l},this.setFoveation=function(Y){l=Y,f!==null&&(f.fixedFoveation=Y),p!==null&&p.fixedFoveation!==void 0&&(p.fixedFoveation=Y)},this.hasDepthSensing=function(){return m.texture!==null},this.getDepthSensingMesh=function(){return m.getMesh(H)},this.getCameraTexture=function(Y){return u[Y]};let Ve=null;function Qe(Y,Q){if(h=Q.getViewerPose(c||o),_=Q,h!==null){const de=h.views;p!==null&&(e.setRenderTargetFramebuffer(E,p.framebuffer),e.setRenderTarget(E));let Ce=!1;de.length!==H.cameras.length&&(H.cameras.length=0,Ce=!0);for(let w=0;w<de.length;w++){const je=de[w];let De=null;if(p!==null)De=p.getViewport(je);else{const _e=d.getViewSubImage(f,je);De=_e.viewport,w===0&&(e.setRenderTargetTextures(E,_e.colorTexture,_e.depthStencilTexture),e.setRenderTarget(E))}let be=L[w];be===void 0&&(be=new Gt,be.layers.enable(w),be.viewport=new ct,L[w]=be),be.matrix.fromArray(je.transform.matrix),be.matrix.decompose(be.position,be.quaternion,be.scale),be.projectionMatrix.fromArray(je.projectionMatrix),be.projectionMatrixInverse.copy(be.projectionMatrix).invert(),be.viewport.set(De.x,De.y,De.width,De.height),w===0&&(H.matrix.copy(be.matrix),H.matrix.decompose(H.position,H.quaternion,H.scale)),Ce===!0&&H.cameras.push(be)}const ve=s.enabledFeatures;if(ve&&ve.includes("depth-sensing")&&s.depthUsage=="gpu-optimized"&&v){d=n.getBinding();const w=d.getDepthInformation(de[0]);w&&w.isValid&&w.texture&&m.init(w,s.renderState)}if(ve&&ve.includes("camera-access")&&v){e.state.unbindTexture(),d=n.getBinding();for(let w=0;w<de.length;w++){const je=de[w].camera;if(je){let De=u[je];De||(De=new Ol,u[je]=De);const be=d.getCameraImage(je);De.sourceTexture=be}}}}for(let de=0;de<P.length;de++){const Ce=T[de],ve=P[de];Ce!==null&&ve!==void 0&&ve.update(Ce,Q,c||o)}Ve&&Ve(Y,Q),Q.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:Q}),_=null}const We=new Bl;We.setAnimationLoop(Qe),this.setAnimationLoop=function(Y){Ve=Y},this.dispose=function(){}}}const Vn=new _n,Dm=new ut;function Lm(i,e){function t(m,u){m.matrixAutoUpdate===!0&&m.updateMatrix(),u.value.copy(m.matrix)}function n(m,u){u.color.getRGB(m.fogColor.value,Dl(i)),u.isFog?(m.fogNear.value=u.near,m.fogFar.value=u.far):u.isFogExp2&&(m.fogDensity.value=u.density)}function s(m,u,A,b,E){u.isMeshBasicMaterial||u.isMeshLambertMaterial?r(m,u):u.isMeshToonMaterial?(r(m,u),d(m,u)):u.isMeshPhongMaterial?(r(m,u),h(m,u)):u.isMeshStandardMaterial?(r(m,u),f(m,u),u.isMeshPhysicalMaterial&&p(m,u,E)):u.isMeshMatcapMaterial?(r(m,u),_(m,u)):u.isMeshDepthMaterial?r(m,u):u.isMeshDistanceMaterial?(r(m,u),v(m,u)):u.isMeshNormalMaterial?r(m,u):u.isLineBasicMaterial?(o(m,u),u.isLineDashedMaterial&&a(m,u)):u.isPointsMaterial?l(m,u,A,b):u.isSpriteMaterial?c(m,u):u.isShadowMaterial?(m.color.value.copy(u.color),m.opacity.value=u.opacity):u.isShaderMaterial&&(u.uniformsNeedUpdate=!1)}function r(m,u){m.opacity.value=u.opacity,u.color&&m.diffuse.value.copy(u.color),u.emissive&&m.emissive.value.copy(u.emissive).multiplyScalar(u.emissiveIntensity),u.map&&(m.map.value=u.map,t(u.map,m.mapTransform)),u.alphaMap&&(m.alphaMap.value=u.alphaMap,t(u.alphaMap,m.alphaMapTransform)),u.bumpMap&&(m.bumpMap.value=u.bumpMap,t(u.bumpMap,m.bumpMapTransform),m.bumpScale.value=u.bumpScale,u.side===wt&&(m.bumpScale.value*=-1)),u.normalMap&&(m.normalMap.value=u.normalMap,t(u.normalMap,m.normalMapTransform),m.normalScale.value.copy(u.normalScale),u.side===wt&&m.normalScale.value.negate()),u.displacementMap&&(m.displacementMap.value=u.displacementMap,t(u.displacementMap,m.displacementMapTransform),m.displacementScale.value=u.displacementScale,m.displacementBias.value=u.displacementBias),u.emissiveMap&&(m.emissiveMap.value=u.emissiveMap,t(u.emissiveMap,m.emissiveMapTransform)),u.specularMap&&(m.specularMap.value=u.specularMap,t(u.specularMap,m.specularMapTransform)),u.alphaTest>0&&(m.alphaTest.value=u.alphaTest);const A=e.get(u),b=A.envMap,E=A.envMapRotation;b&&(m.envMap.value=b,Vn.copy(E),Vn.x*=-1,Vn.y*=-1,Vn.z*=-1,b.isCubeTexture&&b.isRenderTargetTexture===!1&&(Vn.y*=-1,Vn.z*=-1),m.envMapRotation.value.setFromMatrix4(Dm.makeRotationFromEuler(Vn)),m.flipEnvMap.value=b.isCubeTexture&&b.isRenderTargetTexture===!1?-1:1,m.reflectivity.value=u.reflectivity,m.ior.value=u.ior,m.refractionRatio.value=u.refractionRatio),u.lightMap&&(m.lightMap.value=u.lightMap,m.lightMapIntensity.value=u.lightMapIntensity,t(u.lightMap,m.lightMapTransform)),u.aoMap&&(m.aoMap.value=u.aoMap,m.aoMapIntensity.value=u.aoMapIntensity,t(u.aoMap,m.aoMapTransform))}function o(m,u){m.diffuse.value.copy(u.color),m.opacity.value=u.opacity,u.map&&(m.map.value=u.map,t(u.map,m.mapTransform))}function a(m,u){m.dashSize.value=u.dashSize,m.totalSize.value=u.dashSize+u.gapSize,m.scale.value=u.scale}function l(m,u,A,b){m.diffuse.value.copy(u.color),m.opacity.value=u.opacity,m.size.value=u.size*A,m.scale.value=b*.5,u.map&&(m.map.value=u.map,t(u.map,m.uvTransform)),u.alphaMap&&(m.alphaMap.value=u.alphaMap,t(u.alphaMap,m.alphaMapTransform)),u.alphaTest>0&&(m.alphaTest.value=u.alphaTest)}function c(m,u){m.diffuse.value.copy(u.color),m.opacity.value=u.opacity,m.rotation.value=u.rotation,u.map&&(m.map.value=u.map,t(u.map,m.mapTransform)),u.alphaMap&&(m.alphaMap.value=u.alphaMap,t(u.alphaMap,m.alphaMapTransform)),u.alphaTest>0&&(m.alphaTest.value=u.alphaTest)}function h(m,u){m.specular.value.copy(u.specular),m.shininess.value=Math.max(u.shininess,1e-4)}function d(m,u){u.gradientMap&&(m.gradientMap.value=u.gradientMap)}function f(m,u){m.metalness.value=u.metalness,u.metalnessMap&&(m.metalnessMap.value=u.metalnessMap,t(u.metalnessMap,m.metalnessMapTransform)),m.roughness.value=u.roughness,u.roughnessMap&&(m.roughnessMap.value=u.roughnessMap,t(u.roughnessMap,m.roughnessMapTransform)),u.envMap&&(m.envMapIntensity.value=u.envMapIntensity)}function p(m,u,A){m.ior.value=u.ior,u.sheen>0&&(m.sheenColor.value.copy(u.sheenColor).multiplyScalar(u.sheen),m.sheenRoughness.value=u.sheenRoughness,u.sheenColorMap&&(m.sheenColorMap.value=u.sheenColorMap,t(u.sheenColorMap,m.sheenColorMapTransform)),u.sheenRoughnessMap&&(m.sheenRoughnessMap.value=u.sheenRoughnessMap,t(u.sheenRoughnessMap,m.sheenRoughnessMapTransform))),u.clearcoat>0&&(m.clearcoat.value=u.clearcoat,m.clearcoatRoughness.value=u.clearcoatRoughness,u.clearcoatMap&&(m.clearcoatMap.value=u.clearcoatMap,t(u.clearcoatMap,m.clearcoatMapTransform)),u.clearcoatRoughnessMap&&(m.clearcoatRoughnessMap.value=u.clearcoatRoughnessMap,t(u.clearcoatRoughnessMap,m.clearcoatRoughnessMapTransform)),u.clearcoatNormalMap&&(m.clearcoatNormalMap.value=u.clearcoatNormalMap,t(u.clearcoatNormalMap,m.clearcoatNormalMapTransform),m.clearcoatNormalScale.value.copy(u.clearcoatNormalScale),u.side===wt&&m.clearcoatNormalScale.value.negate())),u.dispersion>0&&(m.dispersion.value=u.dispersion),u.iridescence>0&&(m.iridescence.value=u.iridescence,m.iridescenceIOR.value=u.iridescenceIOR,m.iridescenceThicknessMinimum.value=u.iridescenceThicknessRange[0],m.iridescenceThicknessMaximum.value=u.iridescenceThicknessRange[1],u.iridescenceMap&&(m.iridescenceMap.value=u.iridescenceMap,t(u.iridescenceMap,m.iridescenceMapTransform)),u.iridescenceThicknessMap&&(m.iridescenceThicknessMap.value=u.iridescenceThicknessMap,t(u.iridescenceThicknessMap,m.iridescenceThicknessMapTransform))),u.transmission>0&&(m.transmission.value=u.transmission,m.transmissionSamplerMap.value=A.texture,m.transmissionSamplerSize.value.set(A.width,A.height),u.transmissionMap&&(m.transmissionMap.value=u.transmissionMap,t(u.transmissionMap,m.transmissionMapTransform)),m.thickness.value=u.thickness,u.thicknessMap&&(m.thicknessMap.value=u.thicknessMap,t(u.thicknessMap,m.thicknessMapTransform)),m.attenuationDistance.value=u.attenuationDistance,m.attenuationColor.value.copy(u.attenuationColor)),u.anisotropy>0&&(m.anisotropyVector.value.set(u.anisotropy*Math.cos(u.anisotropyRotation),u.anisotropy*Math.sin(u.anisotropyRotation)),u.anisotropyMap&&(m.anisotropyMap.value=u.anisotropyMap,t(u.anisotropyMap,m.anisotropyMapTransform))),m.specularIntensity.value=u.specularIntensity,m.specularColor.value.copy(u.specularColor),u.specularColorMap&&(m.specularColorMap.value=u.specularColorMap,t(u.specularColorMap,m.specularColorMapTransform)),u.specularIntensityMap&&(m.specularIntensityMap.value=u.specularIntensityMap,t(u.specularIntensityMap,m.specularIntensityMapTransform))}function _(m,u){u.matcap&&(m.matcap.value=u.matcap)}function v(m,u){const A=e.get(u).light;m.referencePosition.value.setFromMatrixPosition(A.matrixWorld),m.nearDistance.value=A.shadow.camera.near,m.farDistance.value=A.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:s}}function Um(i,e,t,n){let s={},r={},o=[];const a=i.getParameter(i.MAX_UNIFORM_BUFFER_BINDINGS);function l(A,b){const E=b.program;n.uniformBlockBinding(A,E)}function c(A,b){let E=s[A.id];E===void 0&&(_(A),E=h(A),s[A.id]=E,A.addEventListener("dispose",m));const P=b.program;n.updateUBOMapping(A,P);const T=e.render.frame;r[A.id]!==T&&(f(A),r[A.id]=T)}function h(A){const b=d();A.__bindingPointIndex=b;const E=i.createBuffer(),P=A.__size,T=A.usage;return i.bindBuffer(i.UNIFORM_BUFFER,E),i.bufferData(i.UNIFORM_BUFFER,P,T),i.bindBuffer(i.UNIFORM_BUFFER,null),i.bindBufferBase(i.UNIFORM_BUFFER,b,E),E}function d(){for(let A=0;A<a;A++)if(o.indexOf(A)===-1)return o.push(A),A;return console.error("THREE.WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function f(A){const b=s[A.id],E=A.uniforms,P=A.__cache;i.bindBuffer(i.UNIFORM_BUFFER,b);for(let T=0,R=E.length;T<R;T++){const I=Array.isArray(E[T])?E[T]:[E[T]];for(let M=0,S=I.length;M<S;M++){const L=I[M];if(p(L,T,M,P)===!0){const H=L.__offset,W=Array.isArray(L.value)?L.value:[L.value];let j=0;for(let q=0;q<W.length;q++){const $=W[q],J=v($);typeof $=="number"||typeof $=="boolean"?(L.__data[0]=$,i.bufferSubData(i.UNIFORM_BUFFER,H+j,L.__data)):$.isMatrix3?(L.__data[0]=$.elements[0],L.__data[1]=$.elements[1],L.__data[2]=$.elements[2],L.__data[3]=0,L.__data[4]=$.elements[3],L.__data[5]=$.elements[4],L.__data[6]=$.elements[5],L.__data[7]=0,L.__data[8]=$.elements[6],L.__data[9]=$.elements[7],L.__data[10]=$.elements[8],L.__data[11]=0):($.toArray(L.__data,j),j+=J.storage/Float32Array.BYTES_PER_ELEMENT)}i.bufferSubData(i.UNIFORM_BUFFER,H,L.__data)}}}i.bindBuffer(i.UNIFORM_BUFFER,null)}function p(A,b,E,P){const T=A.value,R=b+"_"+E;if(P[R]===void 0)return typeof T=="number"||typeof T=="boolean"?P[R]=T:P[R]=T.clone(),!0;{const I=P[R];if(typeof T=="number"||typeof T=="boolean"){if(I!==T)return P[R]=T,!0}else if(I.equals(T)===!1)return I.copy(T),!0}return!1}function _(A){const b=A.uniforms;let E=0;const P=16;for(let R=0,I=b.length;R<I;R++){const M=Array.isArray(b[R])?b[R]:[b[R]];for(let S=0,L=M.length;S<L;S++){const H=M[S],W=Array.isArray(H.value)?H.value:[H.value];for(let j=0,q=W.length;j<q;j++){const $=W[j],J=v($),B=E%P,C=B%J.boundary,he=B+C;E+=C,he!==0&&P-he<J.storage&&(E+=P-he),H.__data=new Float32Array(J.storage/Float32Array.BYTES_PER_ELEMENT),H.__offset=E,E+=J.storage}}}const T=E%P;return T>0&&(E+=P-T),A.__size=E,A.__cache={},this}function v(A){const b={boundary:0,storage:0};return typeof A=="number"||typeof A=="boolean"?(b.boundary=4,b.storage=4):A.isVector2?(b.boundary=8,b.storage=8):A.isVector3||A.isColor?(b.boundary=16,b.storage=12):A.isVector4?(b.boundary=16,b.storage=16):A.isMatrix3?(b.boundary=48,b.storage=48):A.isMatrix4?(b.boundary=64,b.storage=64):A.isTexture?console.warn("THREE.WebGLRenderer: Texture samplers can not be part of an uniforms group."):console.warn("THREE.WebGLRenderer: Unsupported uniform value type.",A),b}function m(A){const b=A.target;b.removeEventListener("dispose",m);const E=o.indexOf(b.__bindingPointIndex);o.splice(E,1),i.deleteBuffer(s[b.id]),delete s[b.id],delete r[b.id]}function u(){for(const A in s)i.deleteBuffer(s[A]);o=[],s={},r={}}return{bind:l,update:c,dispose:u}}class Im{constructor(e={}){const{canvas:t=fh(),context:n=null,depth:s=!0,stencil:r=!1,alpha:o=!1,antialias:a=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:d=!1,reversedDepthBuffer:f=!1}=e;this.isWebGLRenderer=!0;let p;if(n!==null){if(typeof WebGLRenderingContext<"u"&&n instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");p=n.getContextAttributes().alpha}else p=o;const _=new Uint32Array(4),v=new Int32Array(4);let m=null,u=null;const A=[],b=[];this.domElement=t,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=Ln,this.toneMappingExposure=1,this.transmissionResolutionScale=1;const E=this;let P=!1;this._outputColorSpace=Ht;let T=0,R=0,I=null,M=-1,S=null;const L=new ct,H=new ct;let W=null;const j=new ze(0);let q=0,$=t.width,J=t.height,B=1,C=null,he=null;const pe=new ct(0,0,$,J),Oe=new ct(0,0,$,J);let Ve=!1;const Qe=new Il;let We=!1,Y=!1;const Q=new ut,de=new N,Ce=new ct,ve={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};let Se=!1;function st(){return I===null?B:1}let w=n;function je(x,U){return t.getContext(x,U)}try{const x={alpha:!0,depth:s,stencil:r,antialias:a,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:h,failIfMajorPerformanceCaveat:d};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${Ea}`),t.addEventListener("webglcontextlost",te,!1),t.addEventListener("webglcontextrestored",ge,!1),t.addEventListener("webglcontextcreationerror",ie,!1),w===null){const U="webgl2";if(w=je(U,x),w===null)throw je(U)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}}catch(x){throw console.error("THREE.WebGLRenderer: "+x.message),x}let De,be,_e,Ye,me,Le,lt,it,y,g,O,X,Z,V,ye,G,ue,le,ee,oe,we,Me,re,Ue;function D(){De=new Wf(w),De.init(),Me=new wm(w,De),be=new Of(w,De,e,Me),_e=new Tm(w,De),be.reversedDepthBuffer&&f&&_e.buffers.depth.setReversed(!0),Ye=new Yf(w),me=new um,Le=new bm(w,De,_e,me,be,Me,Ye),lt=new zf(E),it=new Vf(E),y=new Jh(w),re=new Ff(w,y),g=new Xf(w,y,Ye,re),O=new Kf(w,g,y,Ye),ee=new $f(w,be,Le),G=new Bf(me),X=new hm(E,lt,it,De,be,re,G),Z=new Lm(E,me),V=new fm,ye=new xm(De),le=new If(E,lt,it,_e,O,p,l),ue=new Em(E,O,be),Ue=new Um(w,Ye,be,_e),oe=new Nf(w,De,Ye),we=new qf(w,De,Ye),Ye.programs=X.programs,E.capabilities=be,E.extensions=De,E.properties=me,E.renderLists=V,E.shadowMap=ue,E.state=_e,E.info=Ye}D();const ne=new Pm(E,w);this.xr=ne,this.getContext=function(){return w},this.getContextAttributes=function(){return w.getContextAttributes()},this.forceContextLoss=function(){const x=De.get("WEBGL_lose_context");x&&x.loseContext()},this.forceContextRestore=function(){const x=De.get("WEBGL_lose_context");x&&x.restoreContext()},this.getPixelRatio=function(){return B},this.setPixelRatio=function(x){x!==void 0&&(B=x,this.setSize($,J,!1))},this.getSize=function(x){return x.set($,J)},this.setSize=function(x,U,z=!0){if(ne.isPresenting){console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting.");return}$=x,J=U,t.width=Math.floor(x*B),t.height=Math.floor(U*B),z===!0&&(t.style.width=x+"px",t.style.height=U+"px"),this.setViewport(0,0,x,U)},this.getDrawingBufferSize=function(x){return x.set($*B,J*B).floor()},this.setDrawingBufferSize=function(x,U,z){$=x,J=U,B=z,t.width=Math.floor(x*z),t.height=Math.floor(U*z),this.setViewport(0,0,x,U)},this.getCurrentViewport=function(x){return x.copy(L)},this.getViewport=function(x){return x.copy(pe)},this.setViewport=function(x,U,z,k){x.isVector4?pe.set(x.x,x.y,x.z,x.w):pe.set(x,U,z,k),_e.viewport(L.copy(pe).multiplyScalar(B).round())},this.getScissor=function(x){return x.copy(Oe)},this.setScissor=function(x,U,z,k){x.isVector4?Oe.set(x.x,x.y,x.z,x.w):Oe.set(x,U,z,k),_e.scissor(H.copy(Oe).multiplyScalar(B).round())},this.getScissorTest=function(){return Ve},this.setScissorTest=function(x){_e.setScissorTest(Ve=x)},this.setOpaqueSort=function(x){C=x},this.setTransparentSort=function(x){he=x},this.getClearColor=function(x){return x.copy(le.getClearColor())},this.setClearColor=function(){le.setClearColor(...arguments)},this.getClearAlpha=function(){return le.getClearAlpha()},this.setClearAlpha=function(){le.setClearAlpha(...arguments)},this.clear=function(x=!0,U=!0,z=!0){let k=0;if(x){let F=!1;if(I!==null){const se=I.texture.format;F=se===Ra||se===Aa||se===wa}if(F){const se=I.texture.type,ce=se===gn||se===Jn||se===Xi||se===qi||se===Ta||se===ba,xe=le.getClearColor(),fe=le.getClearAlpha(),Re=xe.r,Pe=xe.g,Te=xe.b;ce?(_[0]=Re,_[1]=Pe,_[2]=Te,_[3]=fe,w.clearBufferuiv(w.COLOR,0,_)):(v[0]=Re,v[1]=Pe,v[2]=Te,v[3]=fe,w.clearBufferiv(w.COLOR,0,v))}else k|=w.COLOR_BUFFER_BIT}U&&(k|=w.DEPTH_BUFFER_BIT),z&&(k|=w.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),w.clear(k)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){t.removeEventListener("webglcontextlost",te,!1),t.removeEventListener("webglcontextrestored",ge,!1),t.removeEventListener("webglcontextcreationerror",ie,!1),le.dispose(),V.dispose(),ye.dispose(),me.dispose(),lt.dispose(),it.dispose(),O.dispose(),re.dispose(),Ue.dispose(),X.dispose(),ne.dispose(),ne.removeEventListener("sessionstart",Qt),ne.removeEventListener("sessionend",Ha),Nn.stop()};function te(x){x.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),P=!0}function ge(){console.log("THREE.WebGLRenderer: Context Restored."),P=!1;const x=Ye.autoReset,U=ue.enabled,z=ue.autoUpdate,k=ue.needsUpdate,F=ue.type;D(),Ye.autoReset=x,ue.enabled=U,ue.autoUpdate=z,ue.needsUpdate=k,ue.type=F}function ie(x){console.error("THREE.WebGLRenderer: A WebGL context could not be created. Reason: ",x.statusMessage)}function K(x){const U=x.target;U.removeEventListener("dispose",K),Ee(U)}function Ee(x){Ie(x),me.remove(x)}function Ie(x){const U=me.get(x).programs;U!==void 0&&(U.forEach(function(z){X.releaseProgram(z)}),x.isShaderMaterial&&X.releaseShaderCache(x))}this.renderBufferDirect=function(x,U,z,k,F,se){U===null&&(U=ve);const ce=F.isMesh&&F.matrixWorld.determinant()<0,xe=tc(x,U,z,k,F);_e.setMaterial(k,ce);let fe=z.index,Re=1;if(k.wireframe===!0){if(fe=g.getWireframeAttribute(z),fe===void 0)return;Re=2}const Pe=z.drawRange,Te=z.attributes.position;let ke=Pe.start*Re,Ze=(Pe.start+Pe.count)*Re;se!==null&&(ke=Math.max(ke,se.start*Re),Ze=Math.min(Ze,(se.start+se.count)*Re)),fe!==null?(ke=Math.max(ke,0),Ze=Math.min(Ze,fe.count)):Te!=null&&(ke=Math.max(ke,0),Ze=Math.min(Ze,Te.count));const ot=Ze-ke;if(ot<0||ot===1/0)return;re.setup(F,k,xe,z,fe);let nt,et=oe;if(fe!==null&&(nt=y.get(fe),et=we,et.setIndex(nt)),F.isMesh)k.wireframe===!0?(_e.setLineWidth(k.wireframeLinewidth*st()),et.setMode(w.LINES)):et.setMode(w.TRIANGLES);else if(F.isLine){let Ae=k.linewidth;Ae===void 0&&(Ae=1),_e.setLineWidth(Ae*st()),F.isLineSegments?et.setMode(w.LINES):F.isLineLoop?et.setMode(w.LINE_LOOP):et.setMode(w.LINE_STRIP)}else F.isPoints?et.setMode(w.POINTS):F.isSprite&&et.setMode(w.TRIANGLES);if(F.isBatchedMesh)if(F._multiDrawInstances!==null)ji("THREE.WebGLRenderer: renderMultiDrawInstances has been deprecated and will be removed in r184. Append to renderMultiDraw arguments and use indirection."),et.renderMultiDrawInstances(F._multiDrawStarts,F._multiDrawCounts,F._multiDrawCount,F._multiDrawInstances);else if(De.get("WEBGL_multi_draw"))et.renderMultiDraw(F._multiDrawStarts,F._multiDrawCounts,F._multiDrawCount);else{const Ae=F._multiDrawStarts,rt=F._multiDrawCounts,qe=F._multiDrawCount,Dt=fe?y.get(fe).bytesPerElement:1,ei=me.get(k).currentProgram.getUniforms();for(let Lt=0;Lt<qe;Lt++)ei.setValue(w,"_gl_DrawID",Lt),et.render(Ae[Lt]/Dt,rt[Lt])}else if(F.isInstancedMesh)et.renderInstances(ke,ot,F.count);else if(z.isInstancedBufferGeometry){const Ae=z._maxInstanceCount!==void 0?z._maxInstanceCount:1/0,rt=Math.min(z.instanceCount,Ae);et.renderInstances(ke,ot,rt)}else et.render(ke,ot)};function tt(x,U,z){x.transparent===!0&&x.side===Vt&&x.forceSinglePass===!1?(x.side=wt,x.needsUpdate=!0,ns(x,U,z),x.side=Un,x.needsUpdate=!0,ns(x,U,z),x.side=Vt):ns(x,U,z)}this.compile=function(x,U,z=null){z===null&&(z=x),u=ye.get(z),u.init(U),b.push(u),z.traverseVisible(function(F){F.isLight&&F.layers.test(U.layers)&&(u.pushLight(F),F.castShadow&&u.pushShadow(F))}),x!==z&&x.traverseVisible(function(F){F.isLight&&F.layers.test(U.layers)&&(u.pushLight(F),F.castShadow&&u.pushShadow(F))}),u.setupLights();const k=new Set;return x.traverse(function(F){if(!(F.isMesh||F.isPoints||F.isLine||F.isSprite))return;const se=F.material;if(se)if(Array.isArray(se))for(let ce=0;ce<se.length;ce++){const xe=se[ce];tt(xe,z,F),k.add(xe)}else tt(se,z,F),k.add(se)}),u=b.pop(),k},this.compileAsync=function(x,U,z=null){const k=this.compile(x,U,z);return new Promise(F=>{function se(){if(k.forEach(function(ce){me.get(ce).currentProgram.isReady()&&k.delete(ce)}),k.size===0){F(x);return}setTimeout(se,10)}De.get("KHR_parallel_shader_compile")!==null?se():setTimeout(se,10)})};let $e=null;function on(x){$e&&$e(x)}function Qt(){Nn.stop()}function Ha(){Nn.start()}const Nn=new Bl;Nn.setAnimationLoop(on),typeof self<"u"&&Nn.setContext(self),this.setAnimationLoop=function(x){$e=x,ne.setAnimationLoop(x),x===null?Nn.stop():Nn.start()},ne.addEventListener("sessionstart",Qt),ne.addEventListener("sessionend",Ha),this.render=function(x,U){if(U!==void 0&&U.isCamera!==!0){console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(P===!0)return;if(x.matrixWorldAutoUpdate===!0&&x.updateMatrixWorld(),U.parent===null&&U.matrixWorldAutoUpdate===!0&&U.updateMatrixWorld(),ne.enabled===!0&&ne.isPresenting===!0&&(ne.cameraAutoUpdate===!0&&ne.updateCamera(U),U=ne.getCamera()),x.isScene===!0&&x.onBeforeRender(E,x,U,I),u=ye.get(x,b.length),u.init(U),b.push(u),Q.multiplyMatrices(U.projectionMatrix,U.matrixWorldInverse),Qe.setFromProjectionMatrix(Q,rn,U.reversedDepth),Y=this.localClippingEnabled,We=G.init(this.clippingPlanes,Y),m=V.get(x,A.length),m.init(),A.push(m),ne.enabled===!0&&ne.isPresenting===!0){const se=E.xr.getDepthSensingMesh();se!==null&&$s(se,U,-1/0,E.sortObjects)}$s(x,U,0,E.sortObjects),m.finish(),E.sortObjects===!0&&m.sort(C,he),Se=ne.enabled===!1||ne.isPresenting===!1||ne.hasDepthSensing()===!1,Se&&le.addToRenderList(m,x),this.info.render.frame++,We===!0&&G.beginShadows();const z=u.state.shadowsArray;ue.render(z,x,U),We===!0&&G.endShadows(),this.info.autoReset===!0&&this.info.reset();const k=m.opaque,F=m.transmissive;if(u.setupLights(),U.isArrayCamera){const se=U.cameras;if(F.length>0)for(let ce=0,xe=se.length;ce<xe;ce++){const fe=se[ce];Va(k,F,x,fe)}Se&&le.render(x);for(let ce=0,xe=se.length;ce<xe;ce++){const fe=se[ce];Ga(m,x,fe,fe.viewport)}}else F.length>0&&Va(k,F,x,U),Se&&le.render(x),Ga(m,x,U);I!==null&&R===0&&(Le.updateMultisampleRenderTarget(I),Le.updateRenderTargetMipmap(I)),x.isScene===!0&&x.onAfterRender(E,x,U),re.resetDefaultState(),M=-1,S=null,b.pop(),b.length>0?(u=b[b.length-1],We===!0&&G.setGlobalState(E.clippingPlanes,u.state.camera)):u=null,A.pop(),A.length>0?m=A[A.length-1]:m=null};function $s(x,U,z,k){if(x.visible===!1)return;if(x.layers.test(U.layers)){if(x.isGroup)z=x.renderOrder;else if(x.isLOD)x.autoUpdate===!0&&x.update(U);else if(x.isLight)u.pushLight(x),x.castShadow&&u.pushShadow(x);else if(x.isSprite){if(!x.frustumCulled||Qe.intersectsSprite(x)){k&&Ce.setFromMatrixPosition(x.matrixWorld).applyMatrix4(Q);const ce=O.update(x),xe=x.material;xe.visible&&m.push(x,ce,xe,z,Ce.z,null)}}else if((x.isMesh||x.isLine||x.isPoints)&&(!x.frustumCulled||Qe.intersectsObject(x))){const ce=O.update(x),xe=x.material;if(k&&(x.boundingSphere!==void 0?(x.boundingSphere===null&&x.computeBoundingSphere(),Ce.copy(x.boundingSphere.center)):(ce.boundingSphere===null&&ce.computeBoundingSphere(),Ce.copy(ce.boundingSphere.center)),Ce.applyMatrix4(x.matrixWorld).applyMatrix4(Q)),Array.isArray(xe)){const fe=ce.groups;for(let Re=0,Pe=fe.length;Re<Pe;Re++){const Te=fe[Re],ke=xe[Te.materialIndex];ke&&ke.visible&&m.push(x,ce,ke,z,Ce.z,Te)}}else xe.visible&&m.push(x,ce,xe,z,Ce.z,null)}}const se=x.children;for(let ce=0,xe=se.length;ce<xe;ce++)$s(se[ce],U,z,k)}function Ga(x,U,z,k){const F=x.opaque,se=x.transmissive,ce=x.transparent;u.setupLightsView(z),We===!0&&G.setGlobalState(E.clippingPlanes,z),k&&_e.viewport(L.copy(k)),F.length>0&&ts(F,U,z),se.length>0&&ts(se,U,z),ce.length>0&&ts(ce,U,z),_e.buffers.depth.setTest(!0),_e.buffers.depth.setMask(!0),_e.buffers.color.setMask(!0),_e.setPolygonOffset(!1)}function Va(x,U,z,k){if((z.isScene===!0?z.overrideMaterial:null)!==null)return;u.state.transmissionRenderTarget[k.id]===void 0&&(u.state.transmissionRenderTarget[k.id]=new In(1,1,{generateMipmaps:!0,type:De.has("EXT_color_buffer_half_float")||De.has("EXT_color_buffer_float")?Zi:gn,minFilter:jn,samples:4,stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:Xe.workingColorSpace}));const se=u.state.transmissionRenderTarget[k.id],ce=k.viewport||L;se.setSize(ce.z*E.transmissionResolutionScale,ce.w*E.transmissionResolutionScale);const xe=E.getRenderTarget(),fe=E.getActiveCubeFace(),Re=E.getActiveMipmapLevel();E.setRenderTarget(se),E.getClearColor(j),q=E.getClearAlpha(),q<1&&E.setClearColor(16777215,.5),E.clear(),Se&&le.render(z);const Pe=E.toneMapping;E.toneMapping=Ln;const Te=k.viewport;if(k.viewport!==void 0&&(k.viewport=void 0),u.setupLightsView(k),We===!0&&G.setGlobalState(E.clippingPlanes,k),ts(x,z,k),Le.updateMultisampleRenderTarget(se),Le.updateRenderTargetMipmap(se),De.has("WEBGL_multisampled_render_to_texture")===!1){let ke=!1;for(let Ze=0,ot=U.length;Ze<ot;Ze++){const nt=U[Ze],et=nt.object,Ae=nt.geometry,rt=nt.material,qe=nt.group;if(rt.side===Vt&&et.layers.test(k.layers)){const Dt=rt.side;rt.side=wt,rt.needsUpdate=!0,Wa(et,z,k,Ae,rt,qe),rt.side=Dt,rt.needsUpdate=!0,ke=!0}}ke===!0&&(Le.updateMultisampleRenderTarget(se),Le.updateRenderTargetMipmap(se))}E.setRenderTarget(xe,fe,Re),E.setClearColor(j,q),Te!==void 0&&(k.viewport=Te),E.toneMapping=Pe}function ts(x,U,z){const k=U.isScene===!0?U.overrideMaterial:null;for(let F=0,se=x.length;F<se;F++){const ce=x[F],xe=ce.object,fe=ce.geometry,Re=ce.group;let Pe=ce.material;Pe.allowOverride===!0&&k!==null&&(Pe=k),xe.layers.test(z.layers)&&Wa(xe,U,z,fe,Pe,Re)}}function Wa(x,U,z,k,F,se){x.onBeforeRender(E,U,z,k,F,se),x.modelViewMatrix.multiplyMatrices(z.matrixWorldInverse,x.matrixWorld),x.normalMatrix.getNormalMatrix(x.modelViewMatrix),F.onBeforeRender(E,U,z,k,x,se),F.transparent===!0&&F.side===Vt&&F.forceSinglePass===!1?(F.side=wt,F.needsUpdate=!0,E.renderBufferDirect(z,U,k,F,x,se),F.side=Un,F.needsUpdate=!0,E.renderBufferDirect(z,U,k,F,x,se),F.side=Vt):E.renderBufferDirect(z,U,k,F,x,se),x.onAfterRender(E,U,z,k,F,se)}function ns(x,U,z){U.isScene!==!0&&(U=ve);const k=me.get(x),F=u.state.lights,se=u.state.shadowsArray,ce=F.state.version,xe=X.getParameters(x,F.state,se,U,z),fe=X.getProgramCacheKey(xe);let Re=k.programs;k.environment=x.isMeshStandardMaterial?U.environment:null,k.fog=U.fog,k.envMap=(x.isMeshStandardMaterial?it:lt).get(x.envMap||k.environment),k.envMapRotation=k.environment!==null&&x.envMap===null?U.environmentRotation:x.envMapRotation,Re===void 0&&(x.addEventListener("dispose",K),Re=new Map,k.programs=Re);let Pe=Re.get(fe);if(Pe!==void 0){if(k.currentProgram===Pe&&k.lightsStateVersion===ce)return qa(x,xe),Pe}else xe.uniforms=X.getUniforms(x),x.onBeforeCompile(xe,E),Pe=X.acquireProgram(xe,fe),Re.set(fe,Pe),k.uniforms=xe.uniforms;const Te=k.uniforms;return(!x.isShaderMaterial&&!x.isRawShaderMaterial||x.clipping===!0)&&(Te.clippingPlanes=G.uniform),qa(x,xe),k.needsLights=ic(x),k.lightsStateVersion=ce,k.needsLights&&(Te.ambientLightColor.value=F.state.ambient,Te.lightProbe.value=F.state.probe,Te.directionalLights.value=F.state.directional,Te.directionalLightShadows.value=F.state.directionalShadow,Te.spotLights.value=F.state.spot,Te.spotLightShadows.value=F.state.spotShadow,Te.rectAreaLights.value=F.state.rectArea,Te.ltc_1.value=F.state.rectAreaLTC1,Te.ltc_2.value=F.state.rectAreaLTC2,Te.pointLights.value=F.state.point,Te.pointLightShadows.value=F.state.pointShadow,Te.hemisphereLights.value=F.state.hemi,Te.directionalShadowMap.value=F.state.directionalShadowMap,Te.directionalShadowMatrix.value=F.state.directionalShadowMatrix,Te.spotShadowMap.value=F.state.spotShadowMap,Te.spotLightMatrix.value=F.state.spotLightMatrix,Te.spotLightMap.value=F.state.spotLightMap,Te.pointShadowMap.value=F.state.pointShadowMap,Te.pointShadowMatrix.value=F.state.pointShadowMatrix),k.currentProgram=Pe,k.uniformsList=null,Pe}function Xa(x){if(x.uniformsList===null){const U=x.currentProgram.getUniforms();x.uniformsList=Us.seqWithValue(U.seq,x.uniforms)}return x.uniformsList}function qa(x,U){const z=me.get(x);z.outputColorSpace=U.outputColorSpace,z.batching=U.batching,z.batchingColor=U.batchingColor,z.instancing=U.instancing,z.instancingColor=U.instancingColor,z.instancingMorph=U.instancingMorph,z.skinning=U.skinning,z.morphTargets=U.morphTargets,z.morphNormals=U.morphNormals,z.morphColors=U.morphColors,z.morphTargetsCount=U.morphTargetsCount,z.numClippingPlanes=U.numClippingPlanes,z.numIntersection=U.numClipIntersection,z.vertexAlphas=U.vertexAlphas,z.vertexTangents=U.vertexTangents,z.toneMapping=U.toneMapping}function tc(x,U,z,k,F){U.isScene!==!0&&(U=ve),Le.resetTextureUnits();const se=U.fog,ce=k.isMeshStandardMaterial?U.environment:null,xe=I===null?E.outputColorSpace:I.isXRRenderTarget===!0?I.texture.colorSpace:Qn,fe=(k.isMeshStandardMaterial?it:lt).get(k.envMap||ce),Re=k.vertexColors===!0&&!!z.attributes.color&&z.attributes.color.itemSize===4,Pe=!!z.attributes.tangent&&(!!k.normalMap||k.anisotropy>0),Te=!!z.morphAttributes.position,ke=!!z.morphAttributes.normal,Ze=!!z.morphAttributes.color;let ot=Ln;k.toneMapped&&(I===null||I.isXRRenderTarget===!0)&&(ot=E.toneMapping);const nt=z.morphAttributes.position||z.morphAttributes.normal||z.morphAttributes.color,et=nt!==void 0?nt.length:0,Ae=me.get(k),rt=u.state.lights;if(We===!0&&(Y===!0||x!==S)){const Mt=x===S&&k.id===M;G.setState(k,x,Mt)}let qe=!1;k.version===Ae.__version?(Ae.needsLights&&Ae.lightsStateVersion!==rt.state.version||Ae.outputColorSpace!==xe||F.isBatchedMesh&&Ae.batching===!1||!F.isBatchedMesh&&Ae.batching===!0||F.isBatchedMesh&&Ae.batchingColor===!0&&F.colorTexture===null||F.isBatchedMesh&&Ae.batchingColor===!1&&F.colorTexture!==null||F.isInstancedMesh&&Ae.instancing===!1||!F.isInstancedMesh&&Ae.instancing===!0||F.isSkinnedMesh&&Ae.skinning===!1||!F.isSkinnedMesh&&Ae.skinning===!0||F.isInstancedMesh&&Ae.instancingColor===!0&&F.instanceColor===null||F.isInstancedMesh&&Ae.instancingColor===!1&&F.instanceColor!==null||F.isInstancedMesh&&Ae.instancingMorph===!0&&F.morphTexture===null||F.isInstancedMesh&&Ae.instancingMorph===!1&&F.morphTexture!==null||Ae.envMap!==fe||k.fog===!0&&Ae.fog!==se||Ae.numClippingPlanes!==void 0&&(Ae.numClippingPlanes!==G.numPlanes||Ae.numIntersection!==G.numIntersection)||Ae.vertexAlphas!==Re||Ae.vertexTangents!==Pe||Ae.morphTargets!==Te||Ae.morphNormals!==ke||Ae.morphColors!==Ze||Ae.toneMapping!==ot||Ae.morphTargetsCount!==et)&&(qe=!0):(qe=!0,Ae.__version=k.version);let Dt=Ae.currentProgram;qe===!0&&(Dt=ns(k,U,F));let ei=!1,Lt=!1,Li=!1;const at=Dt.getUniforms(),Nt=Ae.uniforms;if(_e.useProgram(Dt.program)&&(ei=!0,Lt=!0,Li=!0),k.id!==M&&(M=k.id,Lt=!0),ei||S!==x){_e.buffers.depth.getReversed()&&x.reversedDepth!==!0&&(x._reversedDepth=!0,x.updateProjectionMatrix()),at.setValue(w,"projectionMatrix",x.projectionMatrix),at.setValue(w,"viewMatrix",x.matrixWorldInverse);const Rt=at.map.cameraPosition;Rt!==void 0&&Rt.setValue(w,de.setFromMatrixPosition(x.matrixWorld)),be.logarithmicDepthBuffer&&at.setValue(w,"logDepthBufFC",2/(Math.log(x.far+1)/Math.LN2)),(k.isMeshPhongMaterial||k.isMeshToonMaterial||k.isMeshLambertMaterial||k.isMeshBasicMaterial||k.isMeshStandardMaterial||k.isShaderMaterial)&&at.setValue(w,"isOrthographic",x.isOrthographicCamera===!0),S!==x&&(S=x,Lt=!0,Li=!0)}if(F.isSkinnedMesh){at.setOptional(w,F,"bindMatrix"),at.setOptional(w,F,"bindMatrixInverse");const Mt=F.skeleton;Mt&&(Mt.boneTexture===null&&Mt.computeBoneTexture(),at.setValue(w,"boneTexture",Mt.boneTexture,Le))}F.isBatchedMesh&&(at.setOptional(w,F,"batchingTexture"),at.setValue(w,"batchingTexture",F._matricesTexture,Le),at.setOptional(w,F,"batchingIdTexture"),at.setValue(w,"batchingIdTexture",F._indirectTexture,Le),at.setOptional(w,F,"batchingColorTexture"),F._colorsTexture!==null&&at.setValue(w,"batchingColorTexture",F._colorsTexture,Le));const Ot=z.morphAttributes;if((Ot.position!==void 0||Ot.normal!==void 0||Ot.color!==void 0)&&ee.update(F,z,Dt),(Lt||Ae.receiveShadow!==F.receiveShadow)&&(Ae.receiveShadow=F.receiveShadow,at.setValue(w,"receiveShadow",F.receiveShadow)),k.isMeshGouraudMaterial&&k.envMap!==null&&(Nt.envMap.value=fe,Nt.flipEnvMap.value=fe.isCubeTexture&&fe.isRenderTargetTexture===!1?-1:1),k.isMeshStandardMaterial&&k.envMap===null&&U.environment!==null&&(Nt.envMapIntensity.value=U.environmentIntensity),Lt&&(at.setValue(w,"toneMappingExposure",E.toneMappingExposure),Ae.needsLights&&nc(Nt,Li),se&&k.fog===!0&&Z.refreshFogUniforms(Nt,se),Z.refreshMaterialUniforms(Nt,k,B,J,u.state.transmissionRenderTarget[x.id]),Us.upload(w,Xa(Ae),Nt,Le)),k.isShaderMaterial&&k.uniformsNeedUpdate===!0&&(Us.upload(w,Xa(Ae),Nt,Le),k.uniformsNeedUpdate=!1),k.isSpriteMaterial&&at.setValue(w,"center",F.center),at.setValue(w,"modelViewMatrix",F.modelViewMatrix),at.setValue(w,"normalMatrix",F.normalMatrix),at.setValue(w,"modelMatrix",F.matrixWorld),k.isShaderMaterial||k.isRawShaderMaterial){const Mt=k.uniformsGroups;for(let Rt=0,Ks=Mt.length;Rt<Ks;Rt++){const On=Mt[Rt];Ue.update(On,Dt),Ue.bind(On,Dt)}}return Dt}function nc(x,U){x.ambientLightColor.needsUpdate=U,x.lightProbe.needsUpdate=U,x.directionalLights.needsUpdate=U,x.directionalLightShadows.needsUpdate=U,x.pointLights.needsUpdate=U,x.pointLightShadows.needsUpdate=U,x.spotLights.needsUpdate=U,x.spotLightShadows.needsUpdate=U,x.rectAreaLights.needsUpdate=U,x.hemisphereLights.needsUpdate=U}function ic(x){return x.isMeshLambertMaterial||x.isMeshToonMaterial||x.isMeshPhongMaterial||x.isMeshStandardMaterial||x.isShadowMaterial||x.isShaderMaterial&&x.lights===!0}this.getActiveCubeFace=function(){return T},this.getActiveMipmapLevel=function(){return R},this.getRenderTarget=function(){return I},this.setRenderTargetTextures=function(x,U,z){const k=me.get(x);k.__autoAllocateDepthBuffer=x.resolveDepthBuffer===!1,k.__autoAllocateDepthBuffer===!1&&(k.__useRenderToTexture=!1),me.get(x.texture).__webglTexture=U,me.get(x.depthTexture).__webglTexture=k.__autoAllocateDepthBuffer?void 0:z,k.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(x,U){const z=me.get(x);z.__webglFramebuffer=U,z.__useDefaultFramebuffer=U===void 0};const sc=w.createFramebuffer();this.setRenderTarget=function(x,U=0,z=0){I=x,T=U,R=z;let k=!0,F=null,se=!1,ce=!1;if(x){const fe=me.get(x);if(fe.__useDefaultFramebuffer!==void 0)_e.bindFramebuffer(w.FRAMEBUFFER,null),k=!1;else if(fe.__webglFramebuffer===void 0)Le.setupRenderTarget(x);else if(fe.__hasExternalTextures)Le.rebindTextures(x,me.get(x.texture).__webglTexture,me.get(x.depthTexture).__webglTexture);else if(x.depthBuffer){const Te=x.depthTexture;if(fe.__boundDepthTexture!==Te){if(Te!==null&&me.has(Te)&&(x.width!==Te.image.width||x.height!==Te.image.height))throw new Error("WebGLRenderTarget: Attached DepthTexture is initialized to the incorrect size.");Le.setupDepthRenderbuffer(x)}}const Re=x.texture;(Re.isData3DTexture||Re.isDataArrayTexture||Re.isCompressedArrayTexture)&&(ce=!0);const Pe=me.get(x).__webglFramebuffer;x.isWebGLCubeRenderTarget?(Array.isArray(Pe[U])?F=Pe[U][z]:F=Pe[U],se=!0):x.samples>0&&Le.useMultisampledRTT(x)===!1?F=me.get(x).__webglMultisampledFramebuffer:Array.isArray(Pe)?F=Pe[z]:F=Pe,L.copy(x.viewport),H.copy(x.scissor),W=x.scissorTest}else L.copy(pe).multiplyScalar(B).floor(),H.copy(Oe).multiplyScalar(B).floor(),W=Ve;if(z!==0&&(F=sc),_e.bindFramebuffer(w.FRAMEBUFFER,F)&&k&&_e.drawBuffers(x,F),_e.viewport(L),_e.scissor(H),_e.setScissorTest(W),se){const fe=me.get(x.texture);w.framebufferTexture2D(w.FRAMEBUFFER,w.COLOR_ATTACHMENT0,w.TEXTURE_CUBE_MAP_POSITIVE_X+U,fe.__webglTexture,z)}else if(ce){const fe=U;for(let Re=0;Re<x.textures.length;Re++){const Pe=me.get(x.textures[Re]);w.framebufferTextureLayer(w.FRAMEBUFFER,w.COLOR_ATTACHMENT0+Re,Pe.__webglTexture,z,fe)}}else if(x!==null&&z!==0){const fe=me.get(x.texture);w.framebufferTexture2D(w.FRAMEBUFFER,w.COLOR_ATTACHMENT0,w.TEXTURE_2D,fe.__webglTexture,z)}M=-1},this.readRenderTargetPixels=function(x,U,z,k,F,se,ce,xe=0){if(!(x&&x.isWebGLRenderTarget)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let fe=me.get(x).__webglFramebuffer;if(x.isWebGLCubeRenderTarget&&ce!==void 0&&(fe=fe[ce]),fe){_e.bindFramebuffer(w.FRAMEBUFFER,fe);try{const Re=x.textures[xe],Pe=Re.format,Te=Re.type;if(!be.textureFormatReadable(Pe)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!be.textureTypeReadable(Te)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}U>=0&&U<=x.width-k&&z>=0&&z<=x.height-F&&(x.textures.length>1&&w.readBuffer(w.COLOR_ATTACHMENT0+xe),w.readPixels(U,z,k,F,Me.convert(Pe),Me.convert(Te),se))}finally{const Re=I!==null?me.get(I).__webglFramebuffer:null;_e.bindFramebuffer(w.FRAMEBUFFER,Re)}}},this.readRenderTargetPixelsAsync=async function(x,U,z,k,F,se,ce,xe=0){if(!(x&&x.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let fe=me.get(x).__webglFramebuffer;if(x.isWebGLCubeRenderTarget&&ce!==void 0&&(fe=fe[ce]),fe)if(U>=0&&U<=x.width-k&&z>=0&&z<=x.height-F){_e.bindFramebuffer(w.FRAMEBUFFER,fe);const Re=x.textures[xe],Pe=Re.format,Te=Re.type;if(!be.textureFormatReadable(Pe))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!be.textureTypeReadable(Te))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");const ke=w.createBuffer();w.bindBuffer(w.PIXEL_PACK_BUFFER,ke),w.bufferData(w.PIXEL_PACK_BUFFER,se.byteLength,w.STREAM_READ),x.textures.length>1&&w.readBuffer(w.COLOR_ATTACHMENT0+xe),w.readPixels(U,z,k,F,Me.convert(Pe),Me.convert(Te),0);const Ze=I!==null?me.get(I).__webglFramebuffer:null;_e.bindFramebuffer(w.FRAMEBUFFER,Ze);const ot=w.fenceSync(w.SYNC_GPU_COMMANDS_COMPLETE,0);return w.flush(),await ph(w,ot,4),w.bindBuffer(w.PIXEL_PACK_BUFFER,ke),w.getBufferSubData(w.PIXEL_PACK_BUFFER,0,se),w.deleteBuffer(ke),w.deleteSync(ot),se}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(x,U=null,z=0){const k=Math.pow(2,-z),F=Math.floor(x.image.width*k),se=Math.floor(x.image.height*k),ce=U!==null?U.x:0,xe=U!==null?U.y:0;Le.setTexture2D(x,0),w.copyTexSubImage2D(w.TEXTURE_2D,z,0,0,ce,xe,F,se),_e.unbindTexture()};const rc=w.createFramebuffer(),ac=w.createFramebuffer();this.copyTextureToTexture=function(x,U,z=null,k=null,F=0,se=null){se===null&&(F!==0?(ji("WebGLRenderer: copyTextureToTexture function signature has changed to support src and dst mipmap levels."),se=F,F=0):se=0);let ce,xe,fe,Re,Pe,Te,ke,Ze,ot;const nt=x.isCompressedTexture?x.mipmaps[se]:x.image;if(z!==null)ce=z.max.x-z.min.x,xe=z.max.y-z.min.y,fe=z.isBox3?z.max.z-z.min.z:1,Re=z.min.x,Pe=z.min.y,Te=z.isBox3?z.min.z:0;else{const Ot=Math.pow(2,-F);ce=Math.floor(nt.width*Ot),xe=Math.floor(nt.height*Ot),x.isDataArrayTexture?fe=nt.depth:x.isData3DTexture?fe=Math.floor(nt.depth*Ot):fe=1,Re=0,Pe=0,Te=0}k!==null?(ke=k.x,Ze=k.y,ot=k.z):(ke=0,Ze=0,ot=0);const et=Me.convert(U.format),Ae=Me.convert(U.type);let rt;U.isData3DTexture?(Le.setTexture3D(U,0),rt=w.TEXTURE_3D):U.isDataArrayTexture||U.isCompressedArrayTexture?(Le.setTexture2DArray(U,0),rt=w.TEXTURE_2D_ARRAY):(Le.setTexture2D(U,0),rt=w.TEXTURE_2D),w.pixelStorei(w.UNPACK_FLIP_Y_WEBGL,U.flipY),w.pixelStorei(w.UNPACK_PREMULTIPLY_ALPHA_WEBGL,U.premultiplyAlpha),w.pixelStorei(w.UNPACK_ALIGNMENT,U.unpackAlignment);const qe=w.getParameter(w.UNPACK_ROW_LENGTH),Dt=w.getParameter(w.UNPACK_IMAGE_HEIGHT),ei=w.getParameter(w.UNPACK_SKIP_PIXELS),Lt=w.getParameter(w.UNPACK_SKIP_ROWS),Li=w.getParameter(w.UNPACK_SKIP_IMAGES);w.pixelStorei(w.UNPACK_ROW_LENGTH,nt.width),w.pixelStorei(w.UNPACK_IMAGE_HEIGHT,nt.height),w.pixelStorei(w.UNPACK_SKIP_PIXELS,Re),w.pixelStorei(w.UNPACK_SKIP_ROWS,Pe),w.pixelStorei(w.UNPACK_SKIP_IMAGES,Te);const at=x.isDataArrayTexture||x.isData3DTexture,Nt=U.isDataArrayTexture||U.isData3DTexture;if(x.isDepthTexture){const Ot=me.get(x),Mt=me.get(U),Rt=me.get(Ot.__renderTarget),Ks=me.get(Mt.__renderTarget);_e.bindFramebuffer(w.READ_FRAMEBUFFER,Rt.__webglFramebuffer),_e.bindFramebuffer(w.DRAW_FRAMEBUFFER,Ks.__webglFramebuffer);for(let On=0;On<fe;On++)at&&(w.framebufferTextureLayer(w.READ_FRAMEBUFFER,w.COLOR_ATTACHMENT0,me.get(x).__webglTexture,F,Te+On),w.framebufferTextureLayer(w.DRAW_FRAMEBUFFER,w.COLOR_ATTACHMENT0,me.get(U).__webglTexture,se,ot+On)),w.blitFramebuffer(Re,Pe,ce,xe,ke,Ze,ce,xe,w.DEPTH_BUFFER_BIT,w.NEAREST);_e.bindFramebuffer(w.READ_FRAMEBUFFER,null),_e.bindFramebuffer(w.DRAW_FRAMEBUFFER,null)}else if(F!==0||x.isRenderTargetTexture||me.has(x)){const Ot=me.get(x),Mt=me.get(U);_e.bindFramebuffer(w.READ_FRAMEBUFFER,rc),_e.bindFramebuffer(w.DRAW_FRAMEBUFFER,ac);for(let Rt=0;Rt<fe;Rt++)at?w.framebufferTextureLayer(w.READ_FRAMEBUFFER,w.COLOR_ATTACHMENT0,Ot.__webglTexture,F,Te+Rt):w.framebufferTexture2D(w.READ_FRAMEBUFFER,w.COLOR_ATTACHMENT0,w.TEXTURE_2D,Ot.__webglTexture,F),Nt?w.framebufferTextureLayer(w.DRAW_FRAMEBUFFER,w.COLOR_ATTACHMENT0,Mt.__webglTexture,se,ot+Rt):w.framebufferTexture2D(w.DRAW_FRAMEBUFFER,w.COLOR_ATTACHMENT0,w.TEXTURE_2D,Mt.__webglTexture,se),F!==0?w.blitFramebuffer(Re,Pe,ce,xe,ke,Ze,ce,xe,w.COLOR_BUFFER_BIT,w.NEAREST):Nt?w.copyTexSubImage3D(rt,se,ke,Ze,ot+Rt,Re,Pe,ce,xe):w.copyTexSubImage2D(rt,se,ke,Ze,Re,Pe,ce,xe);_e.bindFramebuffer(w.READ_FRAMEBUFFER,null),_e.bindFramebuffer(w.DRAW_FRAMEBUFFER,null)}else Nt?x.isDataTexture||x.isData3DTexture?w.texSubImage3D(rt,se,ke,Ze,ot,ce,xe,fe,et,Ae,nt.data):U.isCompressedArrayTexture?w.compressedTexSubImage3D(rt,se,ke,Ze,ot,ce,xe,fe,et,nt.data):w.texSubImage3D(rt,se,ke,Ze,ot,ce,xe,fe,et,Ae,nt):x.isDataTexture?w.texSubImage2D(w.TEXTURE_2D,se,ke,Ze,ce,xe,et,Ae,nt.data):x.isCompressedTexture?w.compressedTexSubImage2D(w.TEXTURE_2D,se,ke,Ze,nt.width,nt.height,et,nt.data):w.texSubImage2D(w.TEXTURE_2D,se,ke,Ze,ce,xe,et,Ae,nt);w.pixelStorei(w.UNPACK_ROW_LENGTH,qe),w.pixelStorei(w.UNPACK_IMAGE_HEIGHT,Dt),w.pixelStorei(w.UNPACK_SKIP_PIXELS,ei),w.pixelStorei(w.UNPACK_SKIP_ROWS,Lt),w.pixelStorei(w.UNPACK_SKIP_IMAGES,Li),se===0&&U.generateMipmaps&&w.generateMipmap(rt),_e.unbindTexture()},this.initRenderTarget=function(x){me.get(x).__webglFramebuffer===void 0&&Le.setupRenderTarget(x)},this.initTexture=function(x){x.isCubeTexture?Le.setTextureCube(x,0):x.isData3DTexture?Le.setTexture3D(x,0):x.isDataArrayTexture||x.isCompressedArrayTexture?Le.setTexture2DArray(x,0):Le.setTexture2D(x,0),_e.unbindTexture()},this.resetState=function(){T=0,R=0,I=null,_e.reset(),re.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return rn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;const t=this.getContext();t.drawingBufferColorSpace=Xe._getDrawingBufferColorSpace(e),t.unpackColorSpace=Xe._getUnpackColorSpace()}}const Fm="EL NIÑO SWELL",Nm="el-nino-swell",Om="RIDE THE BIG WINTER.",Oa={name:Fm,slug:Nm,tagline:Om},Is=Oa.name,Vl=Oa.slug,Bm=Oa.tagline;class zm{client=null;queue=[];constructor(){const e="phc_DfnJkR875PZNUubdzNL52FKrn5zxvYeJwCErxgyWySLy",t="https://us.i.posthog.com";dl(()=>import("./module-BgzLZHoS.js"),[]).then(n=>{const s=n.default;s.init(e,{api_host:t,capture_pageview:!0,persistence:"localStorage+cookie",autocapture:!1}),this.client=s;for(const[r,o]of this.queue)this.client.capture(r,o);this.queue.length=0}).catch(()=>{})}track(e,t={}){const n=`${Vl}:${e}`;if(this.client){this.client.capture(n,t);return}this.queue.push([n,t])}}const wn=new zm,km=240,Tn=240,Hm=150,Kt=48,Hi=8,Wl=1.2,Jt=32,an=48,Cn=10,He=4/9,Gm=5/9,Ba=6/9,Xl=7/9,ql=8/9,Gs=.78,Yl=.86,$l=.82,Kl=.91,Vm={z:0,y:0,phase:0},bn={z:0,y:0,phase:0},wr={z:0,y:0,phase:0},Ar={z:0,y:0,phase:0},Wm={position:new N,normal:new N,phase:0,steepness:0},Zo=new Float64Array(Cn),Jo=new Float64Array(Cn);let bi=5;function kt(i,e,t){return Math.max(e,Math.min(t,i))}function wi(i,e,t){const n=kt((t-i)/(e-i),0,1);return n*n*(3-2*n)}function Rr(){return bi}function Xm(i){bi=i}function Ct(i){return Hi*i}function jl(i){return Ct(i)-Jt}function Vs(i){return Ct(i)-an}function qm(i){return wi(.35,Gs,i)}function Zl(i){return wi(Gs,Yl,i)}function za(i){return wi($l,Kl,i)}function Ym(i){return i<0?.35*wi(-40,0,i):i<Jt?.35+.45*wi(0,Jt,i):i<an?.8+.2*((i-Jt)/(an-Jt)):1+.6*kt((i-an)/12,0,1)}function Ys(i,e){return Ym(Ct(e)-i)}function Jl(i,e,t,n){const s=qm(e),r=Zl(e),o=za(e),a=i,l=.55*a+.15*a*s+.15*a*r,c=.95*a+.05*a*s;t[0]=2.5*a,n[0]=-.15*a,t[1]=1.05*a,n[1]=.15*a,t[2]=.75*a-.05*a*s,n[2]=.5*a,t[3]=.6*a+.15*a*s,n[3]=.84*a,t[4]=l,n[4]=c,t[5]=l+.75*a*r,n[5]=c-.02*a*r,t[6]=l+.95*a*r,n[6]=c-.55*a*r-.5*a*o,t[7]=l+1*a*r,n[7]=c+.06*a-.28*a*r,t[8]=l-.05*a+.25*a*r,n[8]=c+.12*a,t[9]=-1.2*a,n[9]=-.1*a}function Qo(i,e,t,n,s){const r=s*s,o=r*s;return .5*(2*e+(-i+t)*s+(2*i-5*e+4*t-n)*r+(-i+3*e-3*t+n)*o)}function Ql(i,e,t,n,s,r,o,a){const l=kt(t,0,1)*(Cn-1),c=Math.min(Cn-2,Math.floor(l)),h=l-c,d=Math.max(0,c-1),f=c,p=Math.min(Cn-1,c+1),_=Math.min(Cn-1,c+2);let v=Qo(i[d],i[f],i[p],i[_],h),m=Qo(e[d],e[f],e[p],e[_],h);const u=wi(1,1.6,s);if(u>0){const A=.42+.05*Math.sin(n*.28+o*3.1),b=(t-A)/.3,E=.55*r*Math.exp(-b*b)+Math.sin(n*.7+t*21+o*4)*.15*r*(1-Math.abs(b)*.5),P=(2.6-5.6*t)*r+Math.sin(n*.22+o*2)*.15*r;v+=(P-v)*u,m+=(Math.max(0,E)-m)*u}return a.z=v,a.y=m,a.phase=s,a}function nn(i,e,t,n=Vm){const s=Ys(i,t);return Jl(bi,s,Zo,Jo),Ql(Zo,Jo,e,i,s,bi,t,n),n.z+=Wl*t,n}function Mi(i,e,t,n=Wm){nn(i,e,t,bn),nn(i+.05,e,t,wr),nn(i,kt(e+.003,0,1),t,Ar);const s=.05,r=wr.y-bn.y,o=wr.z-bn.z,a=Ar.y-bn.y,l=Ar.z-bn.z,c=r*l-o*a,h=-s*l,d=s*a,f=1/Math.max(1e-4,Math.hypot(c,h,d));return n.position.set(i,bn.y,bn.z),n.normal.set(c*f,h*f,d*f),n.normal.y<0&&n.normal.multiplyScalar(-1),n.phase=bn.phase,n.steepness=Math.abs(a/Math.max(1e-4,Math.abs(l))),n}class $m{mesh;positions;normals;phases;controlZ=new Float64Array(Cn);controlY=new Float64Array(Cn);point={z:0,y:0,phase:0};constructor(e){const t=Kt+1,n=(Tn+1)*t,s=new Ft;this.positions=new Float32Array(n*3),this.normals=new Float32Array(n*3),this.phases=new Float32Array(n);const r=new Float32Array(n),o=new Uint32Array(Tn*Kt*6);let a=0;for(let l=0;l<Tn;l+=1)for(let c=0;c<Kt;c+=1){const h=l*t+c,d=h+t;o[a]=h,o[a+1]=d,o[a+2]=h+1,o[a+3]=d,o[a+4]=d+1,o[a+5]=h+1,a+=6}for(let l=0;l<=Tn;l+=1)for(let c=0;c<=Kt;c+=1)r[l*t+c]=c/Kt;s.setAttribute("position",new gt(this.positions,3).setUsage(xi)),s.setAttribute("normal",new gt(this.normals,3).setUsage(xi)),s.setAttribute("phase",new gt(this.phases,1).setUsage(xi)),s.setAttribute("face",new gt(r,1)),s.setIndex(new gt(o,1)),this.mesh=new bt(s,e),this.mesh.frustumCulled=!1,this.update(0)}update(e){const t=Kt+1,n=Wl*e,s=Ct(e)-Hm;let r=0;for(let a=0;a<=Tn;a+=1){const l=s+a*(km/Tn),c=Ys(l,e);Jl(bi,c,this.controlZ,this.controlY);for(let h=0;h<=Kt;h+=1){Ql(this.controlZ,this.controlY,h/Kt,l,c,bi,e,this.point);const d=r*3;this.positions[d]=l,this.positions[d+1]=this.point.y,this.positions[d+2]=this.point.z+n,this.phases[r]=c,r+=1}}for(let a=0;a<=Tn;a+=1){const l=Math.max(0,a-1),c=Math.min(Tn,a+1);for(let h=0;h<=Kt;h+=1){const d=Math.max(0,h-1),f=Math.min(Kt,h+1),p=(l*t+h)*3,_=(c*t+h)*3,v=(a*t+d)*3,m=(a*t+f)*3,u=this.positions[_]-this.positions[p],A=this.positions[_+1]-this.positions[p+1],b=this.positions[_+2]-this.positions[p+2],E=this.positions[m+1]-this.positions[v+1],P=this.positions[m+2]-this.positions[v+2];let T=A*P-b*E,R=-u*P,I=u*E;const M=1/Math.max(1e-4,Math.hypot(T,R,I));T*=M,R*=M,I*=M,R<0&&h<Kt*.6&&(T*=-1,R*=-1,I*=-1);const S=(a*t+h)*3;this.normals[S]=T,this.normals[S+1]=R,this.normals[S+2]=I}}const o=this.mesh.geometry;o.attributes.position.needsUpdate=!0,o.attributes.phase.needsUpdate=!0,o.attributes.normal.needsUpdate=!0}}class Km{camera;profileView=!1;barrelBlend=0;desired=new N;target=new N;profile={z:0,y:0,phase:0};constructor(e){this.camera=new Gt(37,e,.1,1400)}snap(e,t){this.barrelBlend=0,this.compute(e,t),this.camera.position.copy(this.desired),this.camera.fov=37,this.camera.updateProjectionMatrix(),this.camera.lookAt(this.target)}update(e,t,n,s,r=!1,o=!1){if(this.profileView){const h=Rr(),d=Ct(t)-40;nn(d,.5,t,this.profile),this.camera.position.set(d+.01,1.4*h,this.profile.z+7.5*h),this.camera.fov=42,this.camera.updateProjectionMatrix(),this.camera.lookAt(d,.55*h,this.profile.z-.5*h);return}const a=1-Math.exp(-e*3.5);this.barrelBlend+=((o?0:s)-this.barrelBlend)*a,this.compute(n,t,o);const l=Rr();if(n.y>.55*l||r){const h=n.y-.55*l+(r?.4*l:0);this.desired.y+=h*.9,this.target.y+=h*.95}const c=1-Math.exp(-5*e);this.camera.position.lerp(this.desired,c),this.camera.fov+=(jt.lerp(37,43,this.barrelBlend)-this.camera.fov)*c,this.camera.updateProjectionMatrix(),this.camera.lookAt(this.target)}compute(e,t,n=!1){const s=Rr(),r=this.barrelBlend,o=Math.max(e.x+1.3*s,n?-1/0:Ct(t)-36),a=Math.max(e.x+1.2*s,jl(t)+1.5*s);this.desired.set(jt.lerp(o,a,r),jt.lerp(.95*s,.82*s,r),e.z+jt.lerp(3.1*s,2*s,r)),this.clampAboveWave(t);const l=n?e.x+.2*s:Math.max(e.x+.45*s,Ct(t)-44),c=e.x+.25*s;this.target.set(jt.lerp(l,c,r),jt.lerp(.72*s,.6*s,r),e.z-jt.lerp(.2*s,.05*s,r))}clampAboveWave(e){let t=-100;for(let n=0;n<=24;n+=1)nn(this.desired.x,n/24,e,this.profile),Math.abs(this.profile.z-this.desired.z)<1.2&&(t=Math.max(t,this.profile.y));this.desired.y=Math.max(this.desired.y,t+.35)}resize(e,t){this.camera.aspect=e/t,this.camera.updateProjectionMatrix()}}class jm{element;visible=!1;constructor(e){this.element=document.createElement("pre"),this.element.id="debug",this.element.hidden=!0,e.append(this.element)}toggle(){this.visible=!this.visible,this.element.hidden=!this.visible}update(e,t,n){this.visible&&(this.element.textContent=`p ${t.toFixed(2)}  d ${e.distance.toFixed(1)}
u ${e.u.toFixed(2)}  speed ${e.speed.toFixed(1)}
pose ${e.pose}
air ${e.airborne}  tube ${e.insideBarrel}
barrel ${e.barrelPhase}  cover ${e.coverage.toFixed(2)}
fps ${n.toFixed(1)}

green rideable  magenta lip cover
red foam boundary  yellow rider bounds`)}}const $n=[{id:"pier",name:"THE PIER",place:"HUNTINGTON, CA",tagline:"RIDE THE LINE. BEAT THE PIER.",heights:[4.2,5,6],pier:!0,hazards:[{kind:"gull",weight:25},{kind:"fish",weight:20},{kind:"debris",weight:25},{kind:"swimmer",weight:20},{kind:"buoy",weight:10}],backdrop:[{atlas:"water",frame:"sun-0",x:150,y:34,z:-540,height:48},{atlas:"water",frame:"cloud-0",x:-140,y:62,z:-500,drift:.9,height:30},{atlas:"water",frame:"cloud-1",x:40,y:78,z:-520,drift:.6,height:24},{atlas:"water",frame:"cloud-2",x:240,y:70,z:-510,drift:.75,height:24},{atlas:"water",frame:"cloud-1",x:380,y:58,z:-500,drift:.5,height:18},{atlas:"water",frame:"mountain-0",x:30,y:0,z:-330,height:40},{atlas:"water",frame:"mountain-1",x:250,y:0,z:-340,height:36},{strip:!0,atlas:"water",frames:["palms-0","palms-1"],x0:-300,x1:300,y:0,z:-250,height:20,gap:30}]},{id:"trestles",name:"TRESTLES",place:"SAN CLEMENTE, CA",tagline:"COBBLESTONES, A CROWD, AND A LONG RIGHT.",heights:[4.6,5.4,6.4],pier:!1,hazards:[{kind:"gull",weight:15},{kind:"rocks",weight:25},{kind:"paddler",weight:20},{kind:"sitter",weight:15},{kind:"bodyboarder",weight:15},{kind:"buoy",weight:10}],backdrop:[{atlas:"trestles",frame:"tsun-0",x:-100,y:30,z:-520,height:46},{atlas:"trestles",frame:"tcloud-0",x:-260,y:62,z:-500,drift:.8,height:30},{atlas:"trestles",frame:"tcloud-1",x:20,y:80,z:-510,drift:.55,height:18},{atlas:"trestles",frame:"tcloud-0",x:300,y:58,z:-495,drift:.7,height:26},{atlas:"trestles",frame:"coast-0",x:-280,y:0,z:-440,height:16},{atlas:"trestles",frame:"coast-1",x:10,y:0,z:-445,height:16},{atlas:"trestles",frame:"tpier-0",x:250,y:0,z:-430,height:6},{strip:!0,atlas:"trestles",frames:["bluff-3","bluff-0","palmridge-1","bluff-2","palmridge-0","bluff-1"],x0:-300,x1:300,y:0,z:-230,height:42,gap:-4},{strip:!0,atlas:"trestles",frames:["crowd-0","tent-0","crowd-0","tent-1","crowd-0","tent-2"],x0:-60,x1:330,y:0,z:-196,height:6,gap:2},{atlas:"trestles",frame:"tower-0",x:350,y:0,z:-194,height:13},{atlas:"trestles",frame:"flags-0",x:380,y:0,z:-192,height:11},{atlas:"trestles",frame:"rocks-0",x:-120,y:-.4,z:-176,height:5},{atlas:"trestles",frame:"rocks-1",x:-70,y:-.4,z:-172,height:4},{atlas:"trestles",frame:"rocks-0",x:430,y:-.4,z:-174,height:5}]},{id:"hawaii",name:"HAWAII",place:"WAIKIKI, HI",tagline:"BIGGER. WARMER. WATCH FOR TURTLES.",heights:[5.2,6.2,7.4],pier:!1,hazards:[{kind:"gull",weight:10},{kind:"turtle",weight:25},{kind:"paddler",weight:20},{kind:"bodyboarder",weight:15},{kind:"fish",weight:15},{kind:"marker",weight:15}],backdrop:[{atlas:"hawaii",frame:"hsun-0",x:250,y:26,z:-540,height:52},{atlas:"hawaii",frame:"reflection-0",x:252,y:1,z:-500,height:18},{atlas:"hawaii",frame:"hcloud-0",x:-200,y:60,z:-520,drift:.7,height:32},{atlas:"hawaii",frame:"hcloud-1",x:90,y:78,z:-525,drift:.5,height:22},{atlas:"hawaii",frame:"hcloud-1",x:380,y:66,z:-515,drift:.6,height:24},{atlas:"hawaii",frame:"diamondhead-0",x:40,y:0,z:-260,height:60},{atlas:"hawaii",frame:"resort-0",x:-170,y:0,z:-240,height:22},{atlas:"hawaii",frame:"resort-1",x:-245,y:0,z:-232,height:14},{strip:!0,atlas:"hawaii",frames:["hpalms-0"],x0:-300,x1:-110,y:0,z:-220,height:18,gap:-6},{strip:!0,atlas:"hawaii",frames:["hpalms-0"],x0:300,x1:420,y:0,z:-224,height:16,gap:-6},{atlas:"hawaii",frame:"sailboat-0",x:-40,y:0,z:-170,drift:.5,height:9},{atlas:"hawaii",frame:"sailboat-1",x:160,y:0,z:-190,drift:.35,height:7},{atlas:"hawaii",frame:"sailboat-3",x:330,y:0,z:-160,drift:.6,height:8},{atlas:"hawaii",frame:"sailboat-2",x:-260,y:0,z:-150,drift:.45,height:6}]},{id:"ocnj",name:"7TH STREET",place:"OCEAN CITY, NJ",tagline:"JERSEY SURF. BOARDWALK ENERGY.",heights:[4.4,5.2,6.2],pier:!0,hazards:[{kind:"gull",weight:15},{kind:"swimmer",weight:20},{kind:"bodyboarder",weight:15},{kind:"sitter",weight:15},{kind:"paddler",weight:10},{kind:"fish",weight:10},{kind:"jetski",weight:10},{kind:"buoy",weight:5}],sprites:{swimmer:{atlas:"ocnj",frame:"oswimmer-0"},bodyboarder:{atlas:"ocnj",frame:"obodyboarder-0"},sitter:{atlas:"ocnj",frame:"olineup-0"},paddler:{atlas:"ocnj",frame:"onpc-paddler-m-0"},jetski:{atlas:"ocnj",frame:"jetski-0"}},backdrop:[{atlas:"water",frame:"sun-0",x:-120,y:34,z:-540,height:48},{atlas:"water",frame:"cloud-0",x:60,y:62,z:-500,drift:.9,height:30},{atlas:"water",frame:"cloud-2",x:300,y:72,z:-510,drift:.7,height:24},{atlas:"water",frame:"cloud-1",x:-300,y:70,z:-505,drift:.55,height:20},{strip:!0,atlas:"kdh",frames:["houses-0","house-b-0","houses-0"],x0:-330,x1:-200,y:7,z:-238,height:14,gap:6},{atlas:"ocnj",frame:"boardwalk-0",x:-150,y:14,z:-226,height:28},{strip:!0,atlas:"kdh",frames:["house-b-0","houses-0","house-b-0"],x0:-105,x1:-20,y:7.5,z:-236,height:15,gap:6},{strip:!0,atlas:"kdh",frames:["houses-0","house-b-0"],x0:60,x1:230,y:7,z:-236,height:14,gap:8},{atlas:"ocnj",frame:"boat-0",x:-90,y:2.5,z:-210,drift:.4,height:5},{atlas:"ocnj",frame:"lifeguard-0",x:-48,y:5,z:-198,height:10},{atlas:"ocnj",frame:"lifeguard-stand-0",x:150,y:4,z:-194,height:8},{strip:!0,atlas:"ocnj",frames:["crowd-0","obeach-set-a-0","lesson-0","obeach-set-b-0"],x0:-230,x1:230,y:2.4,z:-188,height:4.8,gap:12}]},{id:"kdh",name:"KILL DEVIL HILLS",short:"KDH",place:"OUTER BANKS, NC",tagline:"SAND, SWELL, HISTORY.",heights:[4.8,5.8,6.8],pier:!1,hazards:[{kind:"gull",weight:10},{kind:"swimmer",weight:20},{kind:"sitter",weight:15},{kind:"paddler",weight:15},{kind:"kayak",weight:10},{kind:"jellyfish",weight:15},{kind:"debris",weight:10},{kind:"dolphin",weight:5}],sprites:{swimmer:{atlas:"kdh",frame:"kswimmer-0"},sitter:{atlas:"kdh",frame:"klineup-0"},paddler:{atlas:"kdh",frame:"knpc-paddler-f-0"},kayak:{atlas:"kdh",frame:"kayak-0"},jellyfish:{atlas:"kdh",frame:"jellyfish-0"},debris:{atlas:"kdh",frame:"driftwood-0"},dolphin:{atlas:"kdh",frame:"dolphin-0"}},backdrop:[{atlas:"water",frame:"sun-0",x:220,y:30,z:-540,height:46},{atlas:"water",frame:"cloud-1",x:-220,y:66,z:-505,drift:.7,height:26},{atlas:"water",frame:"cloud-0",x:120,y:78,z:-515,drift:.5,height:28},{atlas:"water",frame:"cloud-2",x:400,y:60,z:-500,drift:.65,height:22},{atlas:"kdh",frame:"pelican-0",x:-60,y:24,z:-300,drift:1.4,height:3.5},{atlas:"kdh",frame:"lighthouse-0",x:-96,y:15,z:-244,height:30},{strip:!0,atlas:"kdh",frames:["house-b-0","houses-0","house-b-0"],x0:-200,x1:-115,y:7.5,z:-238,height:15,gap:8},{strip:!0,atlas:"kdh",frames:["houses-0","house-b-0"],x0:-330,x1:-230,y:7.5,z:-238,height:15,gap:10},{strip:!0,atlas:"kdh",frames:["houses-0","house-b-0","houses-0"],x0:30,x1:240,y:7.5,z:-236,height:15,gap:14},{strip:!0,atlas:"kdh",frames:["dunegrass-0","dunefence-0","dunegrass-0","fence-b-0"],x0:-330,x1:330,y:2.6,z:-204,height:5.2,gap:4},{atlas:"kdh",frame:"stairs-0",x:-60,y:3.2,z:-200,height:6.4},{atlas:"kdh",frame:"umbrella-0",x:-130,y:2.2,z:-186,height:4.4},{atlas:"kdh",frame:"umbrella-0",x:120,y:2.2,z:-184,height:4.4}]}],el="one-more-wave.unlocked";function Zm(i){const e=$n.findIndex(t=>t.id===i);return e<0?0:e}const Jm=2.8,Qm=90,tl=3,eg=26,tg=3.2,nl="one-more-wave.best";function il(i){return i.id==="pier"?nl:`${nl}.${i.id}`}function ng(i){let e=2166136261;for(const t of i)e^=t.charCodeAt(0),e=Math.imul(e,16777619);return e>>>0}function ig(i=new Date){return ng(i.toISOString().slice(0,10))}function ec(i,e,t=""){const n=t.replace(/[^a-z0-9]/gi,"").slice(0,3).toUpperCase();return[i.toString(36),Math.round(e).toString(36),n].filter(Boolean).join(".")}function sg(i){const[e,t,n=""]=i.split(".");if(!e||!t)return null;const s=parseInt(e,36),r=parseInt(t,36);return!Number.isFinite(s)||!Number.isFinite(r)?null:{seed:s>>>0,score:r,initials:n.toUpperCase()}}class rg{phase="title";score=0;best=0;wave=1;heatClock=0;waveClock=0;phaseClock=0;combo=0;comboClock=0;popups=[];stamp=null;stats={tricks:0,longestRide:0,barrels:0,bestCombo:0};seed=ig();challengeScore=null;challengeInitials="";lastWipeReason="";level=0;unlocked=0;unlockedNow=null;lastComboShown=1;wipeoutNext="wave-complete";pierWarning=!1;riderScreen={x:320,y:180};hooded=!1;constructor(){try{this.unlocked=Math.min($n.length-1,Number(localStorage.getItem(el)??0)||0)}catch{this.unlocked=0}const e=new URLSearchParams(window.location.search),t=Zm(e.get("level"));this.selectLevel(t,!0);const n=e.get("c"),s=n?sg(n):null;s&&(this.seed=s.seed,this.challengeScore=s.score,this.challengeInitials=s.initials)}get levelDef(){return $n[this.level]}get nextLevel(){return this.level+1<$n.length?$n[this.level+1]:null}get playAgainLevel(){return this.nextLevel?this.level:0}get waveHeight(){const e=this.levelDef.heights;return e[Math.min(e.length-1,this.wave-1)]}selectLevel(e,t=!1){const n=Math.max(0,Math.min($n.length-1,e));if(n>this.unlocked&&!t)return!1;this.level=n;try{this.best=Number(localStorage.getItem(il(this.levelDef))??0)||0}catch{this.best=0}return!0}waveRidden=!1;heatEarned(){return this.waveRidden}finishHeat(){this.best=Math.max(this.best,Math.floor(this.score));try{localStorage.setItem(il(this.levelDef),String(this.best))}catch{}if(this.waveRidden&&this.level===this.unlocked&&this.nextLevel){this.unlocked=this.level+1,this.unlockedNow=this.nextLevel;try{localStorage.setItem(el,String(this.unlocked))}catch{}}}cycleLevel(){this.selectLevel((this.level+1)%(this.unlocked+1))}get timeLeft(){return Math.max(0,Qm-this.heatClock)}togglePause(){if(this.phase==="riding"){this.phase="paused";return}this.phase==="paused"&&(this.phase="riding")}startRun(){this.score=0,this.wave=1,this.heatClock=0,this.waveClock=0,this.combo=0,this.comboClock=0,this.stats.tricks=0,this.stats.longestRide=0,this.stats.barrels=0,this.stats.bestCombo=0,this.popups.length=0,this.lastWipeReason="",this.unlockedNow=null,this.waveRidden=!1,this.enter("countdown")}enter(e,t=!1){this.phase=e,this.phaseClock=0,e==="countdown"&&(this.stamp={frame:"stamp-1",age:0,duration:.8}),e==="wave-complete"&&(this.stamp=t?null:{frame:"stamp-complete-0",age:0,duration:1.6}),e==="game-over"&&(this.stamp=this.heatEarned()?t?null:{frame:"stamp-complete-0",age:0,duration:1.6}:{frame:"stamp-gameover-0",age:t?-.7:0,duration:1.6}),e==="riding"&&(this.stamp={frame:"stamp-0",age:0,duration:.7})}popup(e,t=0,n){if(this.popups.find(o=>o.frame===e&&o.age<.5))return;const r=this.popups.filter(o=>o.age<.9);for(;r.length>=3;){const o=r.shift();o.age=Math.max(o.age,.9)}r.forEach((o,a)=>{o.stack=a}),this.popups.push({frame:e,offsetX:this.hooded?104:46,offsetY:this.hooded?-104:-74,stack:r.length,age:t,caption:n})}award(e,t){this.comboClock=tg,this.combo+=1;const n=Math.min(4,this.combo);this.score+=e*n,this.stats.tricks+=1,this.stats.bestCombo=Math.max(this.stats.bestCombo,n),this.popup(t),n>=2&&n!==this.lastComboShown&&(this.lastComboShown=n,this.popup(`popup-${3+n}`,-.3))}confirm(e,t){this.score+=e*Math.min(4,Math.max(1,this.combo)),this.popup(t,-.35)}update(e,t,n,s){if(this.riderScreen.x=s.x,this.riderScreen.y=s.y,this.hooded=t.barrelPhase!=="open",this.phase!=="paused"){this.phaseClock+=e,this.stamp&&(this.stamp.age+=e,this.stamp.age>=this.stamp.duration&&(this.stamp=null));for(const r of this.popups)r.age+=e;for(;this.popups.length>0&&this.popups[0].age>1.3;)this.popups.shift();if(this.phase==="countdown"){this.phaseClock>=.8&&this.phaseClock-e<.8&&(this.stamp={frame:"stamp-2",age:0,duration:.8}),this.phaseClock>=1.6&&this.enter("riding");return}if(this.phase==="riding"){this.heatClock+=e,this.waveClock+=e,t.wipedOut||(this.score+=e*(t.insideBarrel?90:10)),this.comboClock-=e,this.comboClock<=0&&(this.combo=0,this.lastComboShown=1);for(const r of n)r.type==="air"&&this.award(300,"popup-0"),r.type==="clean-landing"&&this.confirm(150,"popup-3"),r.type==="cutback"&&this.award(150,"popup-2"),r.type==="snap"&&this.award(120,"popup-8"),r.type==="barrel"&&(this.stats.barrels+=1,this.award(Math.round(220*r.seconds),r.seconds>=3?"popup-9":"popup-1")),r.type==="wipeout"&&(this.lastWipeReason=r.reason,this.combo=0,this.lastComboShown=1,this.popups.length=0,this.popup("popup-4",0,r.reason.toUpperCase()),this.stats.longestRide=Math.max(this.stats.longestRide,this.waveClock),this.wipeoutNext=this.wave>=tl||this.timeLeft<=0?"game-over":"wave-complete",this.enter("wipeout",!1));this.phase==="riding"&&this.waveClock>=eg&&(this.score+=500,this.waveRidden=!0,this.stats.longestRide=Math.max(this.stats.longestRide,this.waveClock),this.enter(this.wave>=tl?"game-over":"wave-complete")),this.phase==="riding"&&this.timeLeft<=0&&this.enter("game-over");return}if(this.phase==="wipeout"&&this.phaseClock>=1.5){this.enter(this.wipeoutNext,this.wipeoutNext==="wave-complete");return}if(this.phase==="wave-complete"&&this.phaseClock>=1.8){if(this.waveRidden){this.finishHeat(),this.enter(this.nextLevel?"advance":"results");return}this.wave+=1,this.waveClock=0,this.enter("countdown");return}this.phase==="game-over"&&this.phaseClock>=1.8&&(this.finishHeat(),this.enter(this.waveRidden&&this.nextLevel?"advance":"results"))}}}const An=.5;class en{constructor(e,t,n,s,r,o){this.key=e,this.texture=t,this.image=n,this.frames=s,this.width=r,this.height=o}key;texture;image;frames;width;height;static async load(e){const t=window.__SPRITES?.[e],n="/surf-game/".replace(/\/?$/,"/"),s=t?t.json:await(await fetch(`${n}sprites/${e}.json`)).json(),r={};for(const[c,h]of Object.entries(s.frames))r[c]=h.frame;const o=new Image,a=new Promise((c,h)=>{o.onload=()=>c(),o.onerror=()=>h(new Error(`sprite image failed: ${e}`))});o.src=t?t.png:`${n}sprites/${e}.png`,await a;const l=new vt(o);return l.magFilter=ht,l.minFilter=ht,l.generateMipmaps=!1,l.needsUpdate=!0,new en(e,l,o,r,s.meta.size.width??s.meta.size.w??o.naturalWidth,s.meta.size.height??s.meta.size.h??o.naturalHeight)}frame(e){const t=this.frames[e];if(!t)throw new Error(`Missing frame ${this.key}/${e}`);return t}}function ag(i,e){return new Pt({uniforms:{map:{value:i.texture},texel:{value:new Ke(1/i.width,1/i.height)},outline:{value:e?1:0},outlineColor:{value:new ze("#0A1D2B")},ghost:{value:0},ghostTint:{value:new ze("#0B6C82")}},transparent:!0,side:Vt,vertexShader:`
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
    `})}class Pn extends bt{constructor(e,t,n=An,s=!1,r=!1){const o=new Fn(1,1);o.translate(0,.5,0),super(o,ag(e,s)),this.atlas=e,this.pixelScale=n,r&&(this.material.depthTest=!1,this.material.depthWrite=!1,this.renderOrder=10),this.frustumCulled=!1,this.setFrame(t)}atlas;pixelScale;frameName="";frameWidth=1;frameHeight=1;flipped=!1;baseQuaternion=new Ci;setDepthMode(e){const t=this.material;t.depthTest=e!=="onTop",t.depthWrite=e==="scene",t.depthFunc=e==="ghost"?Ns:Zn,t.uniforms.ghost.value=e==="ghost"?1:0,this.renderOrder=e==="scene"?1:e==="ghost"?12:10,t.needsUpdate=!0}setFrame(e){if(e===this.frameName)return;this.frameName=e;const t=this.atlas.frame(e);this.frameWidth=t.w,this.frameHeight=t.h,this.applyUv(t)}get currentFrame(){return this.frameName}setFlip(e){e!==this.flipped&&(this.flipped=e,this.applyUv(this.atlas.frame(this.frameName)))}applyUv(e){const t=this.geometry.attributes.uv,n=e.x/this.atlas.width,s=(e.x+e.w)/this.atlas.width,r=1-(e.y+e.h)/this.atlas.height,o=1-e.y/this.atlas.height,a=this.flipped?s:n,l=this.flipped?n:s;t.setXY(0,a,o),t.setXY(1,l,o),t.setXY(2,a,r),t.setXY(3,l,r),t.needsUpdate=!0}orient(e,t,n=0){const s=this.frameHeight*this.pixelScale*t,r=this.frameWidth*this.pixelScale*t;this.scale.set(r,s,1),this.baseQuaternion.copy(e.quaternion),this.quaternion.copy(this.baseQuaternion),n!==0&&this.rotateZ(n)}orientWorld(e,t,n=0){const s=this.frameWidth/this.frameHeight*t;this.scale.set(s,t,1),this.baseQuaternion.copy(e.quaternion),this.quaternion.copy(this.baseQuaternion),n!==0&&this.rotateZ(n)}}function Fs(i,e,t){return 2*e*Math.tan(jt.degToRad(i.fov)/2)/t}class sl{constructor(e,t){this.frames=e,this.fps=t}frames;fps;elapsed=0;set(e){e!==this.frames&&(this.frames=e,this.elapsed=0)}advance(e){Number.isFinite(e)&&e>0&&(this.elapsed+=e);const t=this.frames.length,n=(Math.floor(this.elapsed*this.fps)%t+t)%t;return this.frames[n]}get finished(){return this.elapsed*this.fps>=this.frames.length}}const og=["#003a60","#014a72","#e6f9ff","#311434","#04263c","#018bb3","#015795","#01719a","#029fbb","#06c7c6","#ff5c6c","#f0f3f5","#00c3ed","#01dff8","#161314","#fcd306","#12324a","#03b4bd","#fcf5d4","#090606","#2b2a2f","#036145","#911a0c","#dbf9fa","#01abea","#0a1d2b","#5f3b1f","#012156","#03d477","#b8f1ff","#023074","#ff9a3d","#250703","#fed57b","#7f4a23","#97531f","#7decc8","#442f25","#fe898d","#0292d2","#fca702","#20ccd0","#08a9cf","#c26c18","#6a0308","#dd811b","#531a0a","#9aabc4","#fb1d4e","#fb3254","#fda355","#3c1006","#8ef7f2","#8b92ad","#0198f9","#08d2d8","#fa7b32","#127cc1","#c6f2f7","#fea575","#3e3a40","#e56231","#d4e2e7","#69240f","#a46226","#a3cada","#0b6c82","#fbdf2a","#7b83a0","#f97a03","#6ae8f2","#45ddc9","#0abcdc","#fa6a49","#c2d7df","#cc512e","#a4dce6","#2ed9ca","#b4fbd8","#b2432d","#142d17","#4fe1e7","#f69a23","#4ad9e1","#a04124","#fa2ac4","#8d3a27","#3b6b86","#317892","#75e3e1","#1b4661","#b7f598","#7ed0e8","#86a1bc","#fff0b0","#638098","#fdb967","#4b4a53","#32c9e4","#5b97b1","#256884","#39e2ec","#1bdbe7","#3da3c5","#0268b7","#e85023","#81261e","#5a2e37","#234517","#21334c","#72afbf","#058656","#0f8ea3","#1db6c9","#f8feff","#b7ecf8","#ffbe8a","#ff8d73","#f57cb3","#7d7ccf","#ffd447","#43d87d","#d93b72","#0b5fa5","#29c7f6","#b9844a","#8e5e34"],Fe=640,_t=360,lg=256,Et=32;class cg{constructor(e){this.renderer=e,this.target=new In(Fe,_t,{minFilter:ht,magFilter:ht,depthBuffer:!0,stencilBuffer:!1,generateMipmaps:!1});const t=og;this.paletteSize=Math.min(lg,t.length);const n=t.slice(0,this.paletteSize).map(a=>[parseInt(a.slice(1,3),16),parseInt(a.slice(3,5),16),parseInt(a.slice(5,7),16)]),s=new Uint8Array(Et*Et*Et*4);for(let a=0;a<Et;a+=1)for(let l=0;l<Et;l+=1)for(let c=0;c<Et;c+=1){const h=(c+.5)*(255/Et),d=(l+.5)*(255/Et),f=(a+.5)*(255/Et);let p=Number.POSITIVE_INFINITY,_=n[0];for(const m of n){const u=(m[0]-h)*.3,A=(m[1]-d)*.59,b=(m[2]-f)*.11,E=u*u+A*A+b*b;E<p&&(p=E,_=m)}const v=((a*Et+l)*Et+c)*4;s[v]=_[0],s[v+1]=_[1],s[v+2]=_[2],s[v+3]=255}const r=new zh(s,Et*Et,Et,Wt);r.magFilter=ht,r.minFilter=ht,r.needsUpdate=!0,this.material=new Pt({uniforms:{tDiffuse:{value:this.target.texture},tLut:{value:r},ditherStrength:{value:1/20},resolution:{value:new Ke(Fe,_t)}},depthTest:!1,depthWrite:!1,vertexShader:`
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
      `});const o=new bt(new Fn(2,2),this.material);o.frustumCulled=!1,this.quadScene.add(o),this.resize(window.innerWidth,window.innerHeight)}renderer;target;paletteSize;quadScene=new Ua;quadCamera=new Fa(-1,1,1,-1,0,1);material;viewportX=0;viewportY=0;viewportWidth=Fe;viewportHeight=_t;resize(e,t){const n=Math.min(e/Fe,t/_t),s=Math.floor(n),r=s>=1&&s/n>=.8?s:Math.max(.5,n);this.viewportWidth=Math.round(Fe*r),this.viewportHeight=Math.round(_t*r),this.viewportX=Math.floor((e-this.viewportWidth)/2),this.viewportY=Math.floor((t-this.viewportHeight)/2),this.renderer.setSize(e,t,!1)}clientToTarget(e,t){const n=this.renderer.domElement.getBoundingClientRect(),s=this.viewportWidth/Fe,r=n.width/this.renderer.domElement.width,o=(e-n.left)/r,a=(t-n.top)/r,l=this.renderer.domElement.height-a;return{x:(o-this.viewportX)/s,y:_t-(l-this.viewportY)/s}}beginScene(){this.renderer.setRenderTarget(this.target),this.renderer.setViewport(0,0,Fe,_t),this.renderer.setScissorTest(!1),this.renderer.clear(!0,!0,!1)}present(){this.renderer.setRenderTarget(null),this.renderer.setScissorTest(!0),this.renderer.setScissor(this.viewportX,this.viewportY,this.viewportWidth,this.viewportHeight),this.renderer.setViewport(this.viewportX,this.viewportY,this.viewportWidth,this.viewportHeight),this.renderer.render(this.quadScene,this.quadCamera),this.renderer.setScissorTest(!1)}}const Ma=[{id:"up",frame:"circle-btn-0",label:"CLIMB",x:46,y:256,r:24},{id:"down",frame:"circle-btn-1",label:"DROP",x:46,y:318,r:24},{id:"cutback",frame:"circle-btn-2",label:"STALL",x:536,y:318,r:24},{id:"run",frame:"circle-btn-2",label:"RUN",x:594,y:318,r:24,flip:!0},{id:"pump",frame:"circle-btn-4",label:"PUMP",x:594,y:256,r:24,cropH:113}],hg={id:"level",x:130,y:114,w:380,h:30},Cr=[{id:"mute",x:520,y:62,w:44,h:46},{id:"help",x:558,y:62,w:44,h:46},{id:"pause",x:596,y:62,w:44,h:46}],ug='"Press Start 2P", monospace';class dg{constructor(e){this.ui=e,this.canvas.width=Fe,this.canvas.height=_t;const t=this.canvas.getContext("2d");if(!t)throw new Error("No 2d context");this.context=t,this.texture=new Yh(this.canvas),this.texture.magFilter=ht,this.texture.minFilter=ht,this.texture.generateMipmaps=!1;const n=new bt(new Fn(2,2),new La({map:this.texture,transparent:!0,depthTest:!1,depthWrite:!1}));n.frustumCulled=!1,this.scene.add(n)}ui;scene=new Ua;camera=new Fa(-1,1,1,-1,0,1);canvas=document.createElement("canvas");context;texture;plate(e,t,n,s,r){const o=this.ui.frame(e),a=10,l=Math.round(a*An),c=this.ui.image,h=[[o.x,o.y,a,a,t,n,l,l],[o.x+a,o.y,o.w-a*2,a,t+l,n,s-l*2,l],[o.x+o.w-a,o.y,a,a,t+s-l,n,l,l],[o.x,o.y+a,a,o.h-a*2,t,n+l,l,r-l*2],[o.x+a,o.y+a,o.w-a*2,o.h-a*2,t+l,n+l,s-l*2,r-l*2],[o.x+o.w-a,o.y+a,a,o.h-a*2,t+s-l,n+l,l,r-l*2],[o.x,o.y+o.h-a,a,a,t,n+r-l,l,l],[o.x+a,o.y+o.h-a,o.w-a*2,a,t+l,n+r-l,s-l*2,l],[o.x+o.w-a,o.y+o.h-a,a,a,t+s-l,n+r-l,l,l]];for(const d of h)this.context.drawImage(c,...d)}sprite(e,t,n){const s=this.ui.frame(e);this.context.drawImage(this.ui.image,s.x,s.y,s.w,s.h,t,n,Math.round(s.w*An),Math.round(s.h*An))}text(e,t,n,s,r,o="left"){const a=this.context;a.font=`${s}px ${ug}`,a.textAlign=o,a.textBaseline="top",a.fillStyle="#0A1D2B",a.fillText(e,t+1,n+1),a.fillStyle=r,a.fillText(e,t,n)}bar(e,t,n,s,r,o){const a=this.context;a.fillStyle="#0A1D2B",a.fillRect(e,t,n,s),a.fillStyle="#12324A",a.fillRect(e+1,t+1,n-2,s-2),a.fillStyle=o,a.fillRect(e+2,t+2,Math.round((n-4)*Math.max(0,Math.min(1,r))),s-4)}spriteCentered(e,t,n,s=An,r={}){const o=this.ui.frame(e),a=r.cropH?Math.min(o.h,r.cropH):o.h,l=Math.round(o.w*s),c=Math.round(a*s),h=Math.round(t-l/2),d=Math.round(n-c/2);if(!r.flip){this.context.drawImage(this.ui.image,o.x,o.y,o.w,a,h,d,l,c);return}this.context.save(),this.context.translate(h+l,d),this.context.scale(-1,1),this.context.drawImage(this.ui.image,o.x,o.y,o.w,a,0,0,l,c),this.context.restore()}touchButton(e,t,n,s,r){this.spriteCentered(e.frame,t,n,s,{flip:e.flip,cropH:e.cropH}),r&&this.text(e.label,t,n+e.r+2,8,"#F8FEFF","center")}drawPopups(e){const t=e.pierWarning?190:150;for(const n of e.popups){if(n.age<0)continue;const s=Math.min(1,n.age/.35),r=An*(n.age<.12?.6:n.age<.24?.85:1),o=e.riderScreen.x+n.offsetX+n.stack*132,a=o>Fe-72,l=a?Math.min(Fe-72,Math.max(72,e.riderScreen.x+n.offsetX)):Math.max(72,o),c=a?n.stack*42:0,h=Math.max(a?88:t,Math.max(t,e.riderScreen.y+n.offsetY)-c)-s*12-Math.max(0,n.age-.8)*40;this.spriteCentered(n.frame,l,h,r),n.caption&&this.text(n.caption,l,h+26,8,"#FFD447","center")}}drawStamp(e){const t=e.stamp;if(!t||t.age<0)return;const n=t.age<.1?.7:t.age<.2?.9:1;this.spriteCentered(t.frame,Fe/2,_t/2-20,An*1.4*n)}drawTitle(e){const t=this.context;this.plate("plate-dark",130,52,380,150),this.text(Is,Fe/2,74,24,"#F8FEFF","center"),this.text(Bm,Fe/2,104,8,"#B8F1FF","center"),this.text(`${e.levelDef.name}  //  ${e.levelDef.place}`,Fe/2,120,8,"#FFD447","center"),this.text(e.levelDef.tagline,Fe/2,134,8,"#B8F1FF","center");const n=e.nextLevel,s=e.unlocked>0?this.touch?"TAP THE BREAK NAME TO CHANGE BREAK":"L: CHANGE BREAK":n?`SURVIVE A WAVE TO UNLOCK ${n.name}`:"";s&&this.text(s,Fe/2,148,8,"#75E3E1","center"),Math.floor(e.phaseClock*2)%2===0&&this.text(this.touch?"TAP TO START":"CLICK THE GAME, THEN PRESS SPACE",Fe/2,160,8,"#FFD447","center"),e.challengeScore!==null&&(this.plate("plate-blue",170,212,300,30),this.text(`BEAT ${e.challengeInitials||"A FRIEND"}'S ${String(e.challengeScore).padStart(6,"0")}`,Fe/2,223,8,"#F8FEFF","center")),this.touch?["up","down","cutback","run","pump"].forEach((a,l)=>{const c=Ma.find(h=>h.id===a);c&&this.touchButton(c,128+l*96,262,.42,!0)}):(this.sprite("key-0",236,236),this.text("CLIMB",280,252,8,"#F8FEFF"),this.sprite("key-1",236,284),this.text("DROP",280,300,8,"#F8FEFF"),this.sprite("key-space-0",336,236),this.text("PUMP",450,252,8,"#F8FEFF"),this.sprite("key-2",336,284),this.text("STALL BACK",380,300,8,"#F8FEFF")),this.text("STALL INTO THE FOAM FOR A BARREL. CLIMB OVER THE LIP FOR AN AIR.",Fe/2,336,8,"#B8F1FF","center"),t.fillStyle="#B8F1FF",this.text("MADE BY QUIVER",Fe/2,350,8,"#75E3E1","center")}drawHelp(){this.plate("plate-dark",120,96,400,188),this.text("HOW TO SURF",Fe/2,108,16,"#F8FEFF","center"),(this.touch?[["STALL","BACK INTO THE BARREL"],["RUN","DOWN THE LINE, EXIT THE TUBE"],["CLIMB","OVER THE LIP = AIR"],["DROP","DOWN THE FACE"],["PUMP","HOLD FOR SPEED"]]:[["A / LEFT","STALL BACK INTO THE BARREL"],["D / RIGHT","RUN DOWN THE LINE, EXIT THE TUBE"],["W / UP","CLIMB. OVER THE LIP = AIR"],["S / DOWN","DROP DOWN THE FACE"],["SPACE","PUMP FOR SPEED"]]).forEach(([t,n],s)=>{const r=138+s*16;this.text(t,136,r,8,"#FFD447"),this.text(n,232,r,8,"#F8FEFF")}),this.text("STAY AHEAD OF THE FOAM.",Fe/2,222,8,"#B8F1FF","center"),this.text("HOLD THE MIDDLE OF THE FACE THROUGH THE PIER.",Fe/2,236,8,"#B8F1FF","center"),this.text(this.touch?"TOP RIGHT: SOUND, HELP, PAUSE":"P PAUSE   M MUTE   L CHANGE BREAK",Fe/2,254,8,"#75E3E1","center"),this.text(this.touch?"TAP TO CLOSE":"CLICK OR PRESS ? TO CLOSE",Fe/2,270,8,"#FFD447","center")}drawAdvance(e){const t=e.nextLevel;t&&(this.plate("plate-dark",110,96,420,132),this.text(e.unlockedNow?"NEW BREAK UNLOCKED":"NEXT BREAK",Fe/2,110,16,"#FFD447","center"),this.text(`${t.name}  //  ${t.place}`,Fe/2,140,8,"#F8FEFF","center"),this.text(t.tagline,Fe/2,156,8,"#B8F1FF","center"),this.text(`${e.levelDef.name} SCORE  ${String(Math.floor(e.score)).padStart(6,"0")}`,Fe/2,178,8,"#75E3E1","center"),Math.floor(e.phaseClock*3)%2===0&&this.text("PADDLING OUT...",Fe/2,204,8,"#FFD447","center"))}drawResults(e){if(this.plate("plate-dark",110,18,420,200),this.text(e.lastWipeReason?"GAME OVER":"HEAT COMPLETE",Fe/2,32,16,"#F8FEFF","center"),e.lastWipeReason&&this.text(e.lastWipeReason.toUpperCase(),Fe/2,56,8,"#FF8D73","center"),this.text("SCORE",140,80,8,"#B8F1FF"),this.text(String(Math.floor(e.score)).padStart(6,"0"),500,76,16,"#FFD447","right"),this.text("BEST",140,106,8,"#B8F1FF"),this.text(String(Math.floor(e.best)).padStart(6,"0"),500,104,8,"#F8FEFF","right"),this.text("TRICKS LANDED",140,126,8,"#B8F1FF"),this.text(String(e.stats.tricks),500,126,8,"#F8FEFF","right"),this.text("BARRELS",140,144,8,"#B8F1FF"),this.text(String(e.stats.barrels),500,144,8,"#F8FEFF","right"),this.text("LONGEST RIDE",140,162,8,"#B8F1FF"),this.text(`${e.stats.longestRide.toFixed(1)} S`,500,162,8,"#F8FEFF","right"),this.text("BEST COMBO",140,180,8,"#B8F1FF"),this.text(`${e.stats.bestCombo}X`,500,180,8,"#F8FEFF","right"),e.unlockedNow&&this.text(`NEW BREAK UNLOCKED: ${e.unlockedNow.name}${this.touch?"":"  //  N TO SURF IT"}`,Fe/2,198,8,Math.floor(e.phaseClock*3)%2===0?"#FFD447":"#F8FEFF","center"),e.challengeScore!==null){const t=e.score>e.challengeScore;this.text(t?`YOU BEAT ${e.challengeInitials||"THEM"}!`:`${e.challengeInitials||"THEY"} STILL HOLD ${String(e.challengeScore).padStart(6,"0")}`,Fe/2,e.unlockedNow?210:200,8,t?"#43D87D":"#FF8D73","center")}}touch=!1;draw(e,t){this.touch=e.touch;const n=this.context;if(n.imageSmoothingEnabled=!1,n.clearRect(0,0,Fe,_t),t.phase==="title"){this.drawTitle(t),this.texture.needsUpdate=!0;return}if(t.phase==="results"){this.drawResults(t),this.texture.needsUpdate=!0;return}if(t.phase==="advance"){this.drawAdvance(t),this.texture.needsUpdate=!0;return}this.plate("plate-dark",12,10,132,46),this.text("SCORE",22,17,8,"#B8F1FF"),this.text(String(Math.floor(e.score)).padStart(6,"0"),22,30,16,"#F8FEFF"),n.fillStyle="#FFD447",n.fillRect(22,49,96,2),this.plate("plate-dark",12,58,132,20),this.text("BEST",22,64,8,"#F8FEFF"),this.text(String(Math.floor(e.best)).padStart(6,"0"),136,64,8,"#F8FEFF","right"),this.plate("plate-blue",158,10,322,26),this.text(`${e.levelName}  WAVE ${e.wave}/${e.waves}`,168,19,8,"#F8FEFF"),this.bar(340,16,128,12,e.waveProgress,"#FF8D73"),this.plate("plate-blue",158,40,322,28),this.text("DANGER / FOAM GAP",168,50,8,"#F8FEFF");const s=e.foamGap,r=s<.3?"#FF5C6C":s<.6?"#FFD447":"#29C7F6";this.bar(318,47,112,12,s,r),this.text(s<.3?"DANGER":s<.6?"WATCH":"SAFE",470,51,8,s<.3?"#FF5C6C":s<.6?"#FFD447":"#75E3E1","right"),this.plate("plate-dark",496,10,132,46),this.text("TIME",620,17,8,"#B8F1FF","right");const o=Math.floor(Math.max(0,e.timeLeft)/60),a=Math.floor(Math.max(0,e.timeLeft)%60);if(this.text(`${String(o).padStart(2,"0")}:${String(a).padStart(2,"0")}`,620,30,16,"#F8FEFF","right"),this.sprite(e.muted?"btn-mute-0":"btn-sound-0",520,62),this.sprite("btn-help-0",558,62),this.sprite("btn-pause-0",596,62),e.pierWarning&&this.spriteCentered("banner-pier-0",Fe/2,118,An*(Math.floor(e.timeLeft*4)%2===0?1:.94)),e.touch)for(const l of Ma)this.touchButton(l,l.x,l.y,.38,!0);if(e.needsFocus&&Math.floor(e.timeLeft*2)%2===0&&this.text("CLICK THE GAME TO GIVE IT YOUR KEYBOARD",Fe/2,330,8,"#FFD447","center"),!e.help&&e.paused&&(this.plate("plate-dark",220,150,200,44),this.text("PAUSED",Fe/2,160,16,"#F8FEFF","center"),this.text(e.touch?"TAP PAUSE TO RESUME":"P TO RESUME",Fe/2,180,8,"#B8F1FF","center")),this.drawPopups(t),this.drawStamp(t),e.help&&this.drawHelp(),e.flash>0){n.fillStyle="#F8FEFF";const l=e.flash>.18?1:2;for(let c=0;c<_t;c+=l)for(let h=c/l%2===0?0:l;h<Fe;h+=l*2)n.fillRect(h,c,l,l)}this.texture.needsUpdate=!0}}class fg{state={climb:0,steer:0,pump:!1};up=!1;down=!1;left=!1;right=!1;space=!1;restartRequested=!1;heightRequest=0;debugToggleRequested=!1;profileToggleRequested=!1;startRequested=!1;challengeRequested=!1;findRequested=!1;muteRequested=!1;pauseRequested=!1;levelRequested=!1;nextLevelRequested=!1;sawKey=!1;touchButtons=[];hudButtons=[];helpRequested=!1;isTouch=typeof window<"u"&&("ontouchstart"in window||navigator.maxTouchPoints>0);pointers=new Map;toTarget=()=>({x:-1,y:-1});constructor(){window.addEventListener("keydown",this.onKeyDown),window.addEventListener("keyup",this.onKeyUp),window.addEventListener("blur",this.clear)}attachPointer(e,t){this.toTarget=t,e.tabIndex=0,e.style.outline="none",e.addEventListener("pointerdown",s=>{s.preventDefault(),e.focus(),window.focus();const r=this.toTarget(s.clientX,s.clientY),o=this.hudButtons.find(l=>r.x>=l.x&&r.x<=l.x+l.w&&r.y>=l.y&&r.y<=l.y+l.h);if(o){o.id==="mute"&&(this.muteRequested=!0),o.id==="help"&&(this.helpRequested=!0),o.id==="pause"&&(this.pauseRequested=!0),o.id==="level"&&(this.levelRequested=!0);return}const a=this.touchButtons.find(l=>Math.hypot(l.x-r.x,l.y-r.y)<=l.r);this.pointers.set(s.pointerId,a?.id??"none"),a||(this.startRequested=!0),this.refreshPointers()});const n=s=>{this.pointers.delete(s.pointerId),this.refreshPointers()};e.addEventListener("pointerup",n),e.addEventListener("pointercancel",n),e.addEventListener("pointerleave",n)}refreshPointers(){const e=new Set(this.pointers.values());this.touchUp=e.has("up"),this.touchDown=e.has("down"),this.touchPump=e.has("pump"),this.touchCutback=e.has("cutback"),this.touchRun=e.has("run"),this.refresh()}touchUp=!1;touchDown=!1;touchPump=!1;touchCutback=!1;touchRun=!1;onKeyDown=e=>{(e.code==="ArrowUp"||e.code==="ArrowDown"||e.code==="ArrowLeft"||e.code==="ArrowRight"||e.code==="Space")&&e.preventDefault(),!e.repeat&&((e.code==="KeyW"||e.code==="ArrowUp")&&(this.up=!0),(e.code==="KeyS"||e.code==="ArrowDown")&&(this.down=!0),(e.code==="KeyA"||e.code==="ArrowLeft")&&(this.left=!0),(e.code==="KeyD"||e.code==="ArrowRight")&&(this.right=!0),e.code==="Space"&&(this.space=!0),e.code==="KeyR"&&(this.restartRequested=!0),e.code==="KeyH"&&(this.debugToggleRequested=!0),e.code==="KeyO"&&(this.profileToggleRequested=!0),(e.code==="KeyP"||e.code==="Escape")&&(this.pauseRequested=!0),this.sawKey=!0,(e.code==="Space"||e.code==="Enter")&&(this.startRequested=!0),e.code==="KeyC"&&(this.challengeRequested=!0),e.code==="KeyF"&&(this.findRequested=!0),e.code==="KeyM"&&(this.muteRequested=!0),e.code==="KeyL"&&(this.levelRequested=!0),(e.code==="Slash"||e.code==="F1")&&(e.preventDefault(),this.helpRequested=!0),e.code==="KeyN"&&(this.nextLevelRequested=!0),e.code==="Digit1"&&(this.heightRequest=3.4),e.code==="Digit2"&&(this.heightRequest=5),e.code==="Digit3"&&(this.heightRequest=7),this.refresh())};onKeyUp=e=>{(e.code==="KeyW"||e.code==="ArrowUp")&&(this.up=!1),(e.code==="KeyS"||e.code==="ArrowDown")&&(this.down=!1),(e.code==="KeyA"||e.code==="ArrowLeft")&&(this.left=!1),(e.code==="KeyD"||e.code==="ArrowRight")&&(this.right=!1),e.code==="Space"&&(this.space=!1),this.refresh()};clear=()=>{this.up=this.down=this.left=this.right=this.space=!1,this.refresh()};refresh(){this.state.climb=Number(this.up||this.touchUp)-Number(this.down||this.touchDown),this.state.steer=Number(this.left||this.touchCutback)-Number(this.right||this.touchRun),this.state.pump=this.space||this.touchPump}consume(e){const t=this[e];return this[e]=!1,t}consumeRestart(){return this.consume("restartRequested")}consumeDebugToggle(){return this.consume("debugToggleRequested")}consumeProfileToggle(){return this.consume("profileToggleRequested")}consumeStart(){return this.consume("startRequested")}consumeChallenge(){return this.consume("challengeRequested")}consumeFind(){return this.consume("findRequested")}consumeMute(){return this.consume("muteRequested")}consumePause(){return this.consume("pauseRequested")}consumeLevel(){return this.consume("levelRequested")}consumeHelp(){return this.consume("helpRequested")}consumeNextLevel(){return this.consume("nextLevelRequested")}consumeHeight(){const e=this.heightRequest;return this.heightRequest=0,e}}const pg={gull:{atlas:"obstacles",frame:"gull-0"},fish:{atlas:"obstacles",frame:"marker-0"},debris:{atlas:"obstacles",frame:"debris-0"},swimmer:{atlas:"obstacles",frame:"swimmer-0"},buoy:{atlas:"obstacles",frame:"buoy-0"},turtle:{atlas:"hawaii",frame:"turtle-0"},paddler:{atlas:"hawaii",frame:"paddler-0"},bodyboarder:{atlas:"hawaii",frame:"bodyboarder-h-0"},marker:{atlas:"hawaii",frame:"marker-h-0"},rocks:{atlas:"trestles",frame:"rocks-0"},sitter:{atlas:"trestles",frame:"npc-sitting-0"},jetski:{atlas:"ocnj",frame:"jetski-0"},kayak:{atlas:"kdh",frame:"kayak-0"},dolphin:{atlas:"kdh",frame:"dolphin-0"},jellyfish:{atlas:"kdh",frame:"jellyfish-0"}};function mg(i){let e=i>>>0;return()=>{e=e+1831565813>>>0;let t=e;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}}const Ws=[.28*He,.595*He,.91*He],gg=Ws[1]-Ws[0],rl=1,_g=.3,vg=.065,xg=new Set(["swimmer","paddler","bodyboarder","sitter","turtle","debris","rocks","jetski","kayak","jellyfish"]),Sg=34;class Wi{constructor(e,t){this.scene=e,this.atlases=t}scene;atlases;pierWarning=!1;closestPierPass=Number.POSITIVE_INFINITY;items=[];piers=[];sample={position:new N,normal:new N,phase:0,steepness:0};gullClock=0;alerts=[];levelSprites={};get atlas(){return this.atlases.obstacles}clear(){for(const e of this.items)this.scene.remove(e.quad),e.quad.geometry.dispose();for(const e of this.alerts)this.scene.remove(e),e.geometry.dispose();this.alerts.length=0,this.items.length=0,this.piers.length=0,this.pierWarning=!1}showFlash(e,t){this.flash||(this.flash=new Pn(this.atlases.trestles,"impactsplash-0",.5,!1,!0),this.flash.renderOrder=11,this.scene.add(this.flash)),this.flash.position.copy(e),this.flash.position.y-=.2,this.flash.visible=!0,this.flashTimer=.55,this.flash.orient(t,Fs(t,t.position.distanceTo(e),_t)*.5)}add(e,t,n,s,r=0,o=-1,a){const l=e==="post"?void 0:this.levelSprites[e],c=l?this.atlases[l.atlas]:e==="post"?this.atlas:this.atlases[a??pg[e].atlas],h=new Pn(c,l?.frame??t,e==="post"?.62:.6,!0,!0);this.scene.add(h);const d={kind:e,x:n,u:s,quad:h,clock:0,variant:r,pier:o,passed:!1,fixed:l!==void 0};if(this.items.push(d),e!=="buoy"&&e!=="fish"&&e!=="marker"){const f=new Pn(this.atlas,"marker-alert-0",.5,!0,!0);f.visible=!1,this.scene.add(f),this.alerts.push(f),d.alert=f}return d}newWave(e,t,n,s){this.clear(),this.levelSprites=s.sprites??{};const r=mg(e+t*7919),o=s.hazards.reduce((f,p)=>f+p.weight,0),a=()=>{let f=r()*o;for(const p of s.hazards)if(f-=p.weight,f<=0)return p.kind;return s.hazards[s.hazards.length-1].kind};let l=n+40;const c=n+240;let h=!1;const d=new URLSearchParams(window.location.search).has("pier");for(;l<c;){if(s.pier&&!h&&(l>n+95+t*20||d&&l>n+50)){const p=this.piers.length;this.piers.push({x:l,gapU:Ws[rl],warned:!1,passed:!1}),Ws.forEach((_,v)=>{v!==rl&&this.add("post",`post-${v%4}`,l,_,v,p)}),h=!0,l+=34;continue}const f=a();f==="gull"?this.add("gull","gull-0",l+20,He,Math.floor(r()*3)):f==="fish"?this.add("fish","marker-0",l,(.28+r()*.175)*He):f==="debris"?this.add("debris",`debris-${Math.floor(r()*9)}`,l,(.23+r()*.14)*He):f==="swimmer"?this.add("swimmer",r()<.5?"swimmer-0":"bodyboard-0",l,(.455+r()*.14)*He,r()<.5?0:1):f==="buoy"?this.add("buoy","buoy-0",l,.0875*He):f==="turtle"?this.add("turtle","turtle-0",l,(.24+r()*.12)*He):f==="paddler"?this.add("paddler",s.id==="trestles"?"paddler-t-0":"paddler-0",l,(.42+r()*.16)*He,0,-1,s.id==="trestles"?"trestles":"hawaii"):f==="bodyboarder"?this.add("bodyboarder",s.id==="trestles"?"bodyboarder-t-0":"bodyboarder-h-0",l,(.36+r()*.16)*He,0,-1,s.id==="trestles"?"trestles":"hawaii"):f==="marker"?this.add("marker","marker-h-0",l,.1*He):f==="rocks"?this.add("rocks",r()<.5?"rocks-0":"rocks-1",l,.16*He):f==="jetski"?this.add("jetski","jetski-0",l+30,(.3+r()*.12)*He):f==="kayak"?this.add("kayak","kayak-0",l,(.38+r()*.16)*He):f==="jellyfish"?this.add("jellyfish","jellyfish-0",l,(.2+r()*.14)*He):f==="dolphin"?this.add("dolphin","dolphin-0",l,.12*He):f==="sitter"&&this.add("sitter","npc-sitting-0",l,(.5+r()*.14)*He),l+=16+r()*18}}static SOFT=new Set(["buoy","marker","dolphin"]);static REASON={gull:"took a gull to the face",fish:"fish to the face",debris:"clipped by debris",swimmer:"hit a swimmer",buoy:"",turtle:"ran over a turtle",paddler:"hit a paddler",bodyboarder:"hit a bodyboarder",marker:"",rocks:"hit the cobblestones",sitter:"hit a surfer in the lineup",post:"hit the pier",jetski:"run down by a jet ski",kayak:"hit a kayak",dolphin:"",jellyfish:"stung by a jellyfish"};static POST_HEIGHT=1.9;flash=null;flashTimer=0;update(e,t,n,s,r,o,a){this.flash&&(this.flashTimer-=e,this.flash.visible=this.flashTimer>0,this.flash.visible&&this.flash.orient(a,Fs(a,a.position.distanceTo(this.flash.position),_t)*.5)),this.gullClock+=e;let l=null;this.pierWarning=!1;for(const c of this.piers){const h=c.x-n.x;h>0&&h<Sg&&(this.pierWarning=!0),!c.passed&&h<-1.2&&(c.passed=!0,this.closestPierPass=Math.min(this.closestPierPass,Math.abs(n.u-c.gapU)))}for(const c of this.items){if(c.clock+=e,c.kind==="gull"&&(c.x-=6*e),(c.kind==="swimmer"||c.kind==="paddler"||c.kind==="bodyboarder")&&(c.x-=1.2*e),c.kind==="turtle"&&(c.x-=.6*e),c.kind==="jetski"&&(c.x-=5*e),c.kind==="kayak"&&(c.x-=1.6*e),c.kind==="gull"&&c.quad.setFrame(`gull-${(Math.floor(this.gullClock*9)+c.variant*3)%9}`),c.kind==="buoy"&&!c.fixed&&c.quad.setFrame(`buoy-${Math.floor(c.clock*2)%2}`),c.kind==="swimmer"&&!c.fixed&&c.quad.setFrame(c.variant===0?`swimmer-${Math.floor(c.clock*4)%3}`:`bodyboard-${Math.floor(c.clock*4)%3}`),c.kind==="fish"){const u=c.x-n.x;u>9?c.quad.setFrame(`marker-${Math.floor(c.clock*6)%3}`):u>4?c.quad.setFrame("marker-alert-0"):u>-3?c.quad.setFrame(u>1?"fish-0":"fish-1"):c.quad.setFrame(`fish-splash-${Math.min(2,Math.floor((-3-u)*2))}`)}const h=c.kind==="fish"&&c.x-n.x<4&&c.x-n.x>-3;Mi(c.x,c.kind==="gull"?He:c.u,t,this.sample),c.quad.position.copy(this.sample.position),c.quad.position.z+=.2,c.kind==="gull"&&(c.quad.position.y+=2.2+Math.sin(c.clock*3)*.3),(c.kind==="turtle"||c.kind==="marker")&&(c.quad.position.y+=Math.sin(c.clock*2.5+c.x)*.12),h&&(c.quad.position.y+=1.4*Math.sin(Math.PI*jt.clamp((4-(c.x-n.x))/7,0,1)));const d=Fs(a,a.position.distanceTo(c.quad.position),_t);if(c.kind==="post"?c.quad.orientWorld(a,Wi.POST_HEIGHT):c.quad.orient(a,d),c.quad.setFlip(c.kind==="swimmer"||c.kind==="gull"||c.kind==="paddler"||c.kind==="bodyboarder"||c.kind==="jetski"||c.kind==="kayak"),c.alert){const u=c.x-n.x;c.alert.visible=!c.passed&&u>0&&u<16&&Math.floor(c.clock*6)%2===0,c.alert.position.copy(c.quad.position),c.alert.position.y+=c.quad.scale.y+.3,c.alert.orient(a,d)}if(l||n.wipedOut||c.passed)continue;const f=c.x-n.x;if(f<-2){c.passed=!0;continue}if(Wi.SOFT.has(c.kind)||c.kind==="fish"&&!h)continue;const p=c.quad.scale.x*.3,_=c.quad.scale.y*.8;if(Math.abs(f)>r+p)continue;const v=c.quad.position.y;(c.kind==="post"?Math.abs(n.u-c.u)<gg*_g:xg.has(c.kind)?!n.airborne&&Math.abs(n.u-c.u)<vg:v<s+o&&v+_>s)&&(l={reason:Wi.REASON[c.kind]},this.showFlash(c.quad.position,a))}return l}}const Bi={idle:["idle-0","idle-1","idle-2","idle-3"],pump:["pump-0","pump-1","pump-2","pump-3"],lowline:["lowline-0","lowline-1","lowline-2","lowline-3"],bottomturn:["bottomturn-0","bottomturn-1","bottomturn-2","bottomturn-3"],topturn:["topturn-0","topturn-1","topturn-2","topturn-3"],cutback:["cutback-init-0","cutback-init-1","cutback-init-2","cutback-init-3"],rebound:["cutback-rebound-0","cutback-rebound-1","cutback-rebound-2"],tuck:["tuck-0","tuck-1","tuck-2","tuck-3"],takeoff:["takeoff-0","takeoff-1","takeoff-2"],air:["air-0","air-1","air-2"],grab:["grab-0","grab-1","grab-2"],landing:["landing-wobble-0","landing-wobble-1","landing-wobble-2"],wobble:["landing-wobble-3","landing-wobble-4","landing-wobble-5"],wipeout:["wipeout-0","wipeout-1","wipeout-2","wipeout-3","wipeout-3"]},Rs=.66,al=.21*He,ol=1.05*He,Pr=.525*He,Mg=4.5,ll=.28*He,Eg=.875*He,yg=.98*He,cl=.875*He,Tg=.875*He,bg=.525*He,wg=.735*He;class Ag{state={x:0,u:Pr,speed:Hi,heading:0,airborne:!1,insideBarrel:!1,wipedOut:!1,pose:"idle",distance:36,wipeReason:"",run:0,barrelPhase:"open",coverage:0};renderPosition=new N;events=[];quad;ghostQuad;boardQuad;splashQuad;previousX=0;previousU=Pr;exitTimer=0;toCamera=new N;pumpCooldown=0;pumpAnim=0;wipeoutTimer=0;caughtTimer=0;landingTimer=0;airTimer=0;airY=0;airVelocityY=0;grabAir=!1;barrelSeconds=0;cutbackArmed=!1;cutbackCooldown=0;snapArmed=!1;snapClock=0;freezePhysics=!1;runSpeed=0;cycle=new sl(Bi.idle,10);tumble=new sl(Bi.wipeout,6);sample={position:new N,normal:new N,phase:0,steepness:0};constructor(e,t){this.quad=new Pn(t,"idle-0",Rs,!0,!1),this.quad.setDepthMode("scene"),this.ghostQuad=new Pn(t,"idle-0",Rs,!1,!1),this.ghostQuad.setDepthMode("ghost"),e.add(this.ghostQuad),this.boardQuad=new Pn(t,"board-loose-0",Rs,!0,!0),this.boardQuad.visible=!1,this.splashQuad=new Pn(t,"splash-0",Rs,!1,!0),this.splashQuad.visible=!1,e.add(this.quad),e.add(this.boardQuad),e.add(this.splashQuad),this.reset(0)}reset(e){this.state.x=Ct(e)-27,this.state.u=Pr,this.state.speed=Hi,this.runSpeed=0,this.state.heading=0,this.state.airborne=!1,this.state.insideBarrel=!1,this.state.wipedOut=!1,this.state.pose="idle",this.previousX=this.state.x,this.previousU=this.state.u,this.pumpCooldown=0,this.wipeoutTimer=0,this.caughtTimer=0,this.landingTimer=0,this.airTimer=0,this.barrelSeconds=0,this.cutbackArmed=!1,this.cutbackCooldown=0,this.snapArmed=!1,this.exitTimer=0,this.state.barrelPhase="open",this.state.coverage=0,this.boardQuad.visible=!1}setFrozen(e){this.freezePhysics=e}drainEvents(){return this.events.splice(0,this.events.length)}step(e,t,n){this.previousX=this.state.x,this.previousU=this.state.u;const s=this.state;if(s.distance=Ct(t)-s.x,s.wipedOut){this.wipeoutTimer-=e,s.x+=Hi*.6*e,this.wipeoutTimer<=0&&!this.freezePhysics&&this.reset(t);return}if(this.freezePhysics){s.x=Ct(t)-27,s.pose="idle";return}Mi(s.x,s.u,t,this.sample),this.pumpCooldown=Math.max(0,this.pumpCooldown-e),this.pumpAnim=Math.max(0,this.pumpAnim-e),this.landingTimer=Math.max(0,this.landingTimer-e);const r=kt((24-s.distance)/12,0,1),o=kt((8-s.distance)/8,0,1),a=n.steer>0,l=s.distance>Jt&&n.steer<0?4:0,c=n.steer*(a?-6.5:-5)-r*4-o*8-(a?0:Mg)+l;if(s.airborne)this.airTimer+=e,this.airVelocityY-=9.8*e,this.airY+=this.airVelocityY*e,s.u=kt(s.u-.35*e,al+.08,ol),Mi(s.x,s.u,t,this.sample),this.airVelocityY<0&&this.airY<=this.sample.position.y&&(s.airborne=!1,this.landingTimer=.45,this.sample.phase>1?this.wipeout("landed in the foam"):(this.events.push({type:"air"}),this.airTimer>.35&&this.events.push({type:"clean-landing"})));else{const f=s.u,p=(.35+kt((this.runSpeed+4)/12,0,1)*.385)*He;s.u+=((p-s.u)*1.1+n.climb*.95)*e,s.u=kt(s.u,al,ol+.04);const _=Math.max(0,f-s.u);this.runSpeed+=_*(6+kt(this.sample.steepness,0,3)*4),n.pump&&this.pumpCooldown<=0&&s.u>ll&&s.u<Eg&&s.distance>4&&(this.runSpeed+=4.5,this.pumpCooldown=.35,this.pumpAnim=.4),this.runSpeed+=(c-this.runSpeed)*2*e,this.runSpeed=kt(this.runSpeed,-8,9),s.speed=Hi+this.runSpeed,(s.u>yg&&n.climb>0&&this.runSpeed>.5||s.u>cl&&n.pump&&this.pumpCooldown>.3)&&(s.airborne=!0,this.airTimer=0,this.airY=this.sample.position.y,this.airVelocityY=2.6+Math.min(4,this.runSpeed*.12),this.grabAir=this.runSpeed>7,this.events.push({type:"takeoff"}))}s.heading=this.runSpeed<-.8?-.9:0,s.run=this.runSpeed,s.x+=s.speed*e,s.x>Ct(t)+3&&(s.x=Ct(t)+3,this.runSpeed=Math.min(this.runSpeed,0));const h=s.distance>Jt+3&&s.distance<an-2;s.insideBarrel=!s.airborne&&h&&s.u>ll&&s.u<Tg,s.insideBarrel&&(this.barrelSeconds+=e),this.cutbackCooldown=Math.max(0,this.cutbackCooldown-e),this.runSpeed<-3&&(this.cutbackArmed=!0),this.cutbackArmed&&this.runSpeed>1&&this.cutbackCooldown<=0&&(this.cutbackArmed=!1,this.cutbackCooldown=1.5,this.events.push({type:"cutback"})),!s.airborne&&s.u>cl&&(this.snapArmed=!0,this.snapClock=0),this.snapArmed&&(this.snapClock+=e,s.u<bg&&this.snapClock<1.1&&(this.snapArmed=!1,this.events.push({type:"snap"})),this.snapClock>=1.1&&(this.snapArmed=!1));const d=s.x<Vs(t)-1;this.caughtTimer=d?this.caughtTimer+e:0,this.updateBarrelPhase(e,t),this.caughtTimer>.5&&this.wipeout("caught by the foam"),s.pose=this.choosePose(n)}choosePose(e){const t=this.state;return t.wipedOut?"wipeout":t.airborne?this.airTimer<.15?"takeoff":this.grabAir?"grab":"air":this.landingTimer>.25?"landing":this.landingTimer>0?"wobble":t.insideBarrel?"tuck":this.runSpeed<-2.5?"cutback":this.cutbackArmed&&this.runSpeed>-2.5?"rebound":this.pumpAnim>0?"pump":e.climb>0?t.u>wg?"topturn":"bottomturn":e.climb<0?"lowline":this.runSpeed>4?"pump":"idle"}updateBarrelPhase(e,t){const n=this.state,s=Ys(n.x,t),r=Zl(s),o=za(s);n.coverage=Math.max(r*.5,o);const a=n.barrelPhase;this.exitTimer=Math.max(0,this.exitTimer-e);let l="open";n.x<Vs(t)?l="collapse":n.insideBarrel&&o>.9?l="tube":o>.05||r>.5?l="cover-up":r>0&&(l="pitching");const c=a==="tube"||a==="cover-up",h=l==="pitching"||l==="open";c&&h&&this.runSpeed>0&&(this.exitTimer=.7,this.barrelSeconds>=1.2&&this.events.push({type:"barrel",seconds:this.barrelSeconds}),this.barrelSeconds=0),h&&this.exitTimer>0&&!n.airborne&&(l="exit"),n.barrelPhase=l}forceWipeout(e){this.state.wipedOut||this.wipeout(e)}wipeout(e){this.state.wipeReason=e,this.events.push({type:"wipeout",reason:e}),this.barrelSeconds=0,this.state.wipedOut=!0,this.state.insideBarrel=!1,this.state.airborne=!1,this.state.barrelPhase="open",this.wipeoutTimer=1.9}render(e,t,n,s){const r=jt.lerp(this.previousX,this.state.x,e),o=jt.lerp(this.previousU,this.state.u,e);Mi(r,o,n,this.sample),this.renderPosition.copy(this.sample.position),this.state.airborne&&(this.renderPosition.y=Math.max(this.renderPosition.y,this.airY)),this.renderPosition.z+=.15,this.toCamera.copy(s.position).sub(this.renderPosition),this.toCamera.x=0,this.toCamera.normalize(),this.quad.position.copy(this.renderPosition).addScaledVector(this.toCamera,1),this.quad.setDepthMode(this.state.wipedOut?"onTop":"scene"),this.ghostQuad.visible=!this.state.wipedOut,this.state.wipedOut?(this.tumble.set(Bi.wipeout),this.quad.setFrame(this.tumble.advance(t))):(this.tumble.set(Bi.idle),this.cycle.set(Bi[this.state.pose]),this.quad.setFrame(this.cycle.advance(t))),this.quad.setFlip(this.state.heading<-.45),this.state.heading;const a=this.state.wipedOut||this.state.insideBarrel?0:kt(Math.atan2(this.sample.normal.z,this.sample.normal.y)*.25,-.22,.22)*-1,l=Fs(s,s.position.distanceTo(this.quad.position),_t);this.quad.orient(s,l,a),this.ghostQuad.setFrame(this.quad.currentFrame),this.ghostQuad.setFlip(this.state.heading<-.45),this.ghostQuad.position.copy(this.quad.position),this.ghostQuad.quaternion.copy(this.quad.quaternion),this.ghostQuad.scale.copy(this.quad.scale),this.boardQuad.visible=this.state.wipedOut,this.state.wipedOut&&(this.boardQuad.position.set(this.renderPosition.x+1.2+(1.4-this.wipeoutTimer)*1.5,this.renderPosition.y+.4,this.renderPosition.z+.3),this.boardQuad.orient(s,l,-(1.4-this.wipeoutTimer)*2.2))}}class Rg{mesh;constructor(){const e=new Fn(900,900,180,180);e.rotateX(-Math.PI/2);const t=new Pt({uniforms:{time:{value:0}},side:Vt,vertexShader:`
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
      `});this.mesh=new bt(e,t),this.mesh.position.set(120,-.35,0)}update(e,t,n){this.mesh.material.uniforms.time.value=e,this.mesh.position.x=t,this.mesh.position.z=n}}class Cg{constructor(e,t){this.atlases=t;const n=new bt(new Ia(900,24,16),new Pt({side:wt,depthWrite:!1,vertexShader:`
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
        `}));n.renderOrder=-10,this.group.add(n);for(let s=0;s<3;s+=1){const r=this.add(t.obstacles,"gull-0",-80+s*120,18+s%2*8,-240-s*30,5+s*1.5,3.2);this.gulls.push(r)}e.add(this.group)}atlases;group=new zi;items=[];gulls=[];gullClock=0;add(e,t,n,s,r,o,a){const l=new Pn(e,t);l.material.depthWrite=!1,l.material.transparent=!0,this.group.add(l);const c={quad:l,x:n,y:s,z:r,drift:o,height:a};return this.items.push(c),c}setLevel(e){for(const n of this.items)this.gulls.includes(n)||(this.group.remove(n.quad),n.quad.geometry.dispose(),n.quad.material.dispose());this.items.length=0,this.items.push(...this.gulls);const t=[...e.backdrop].sort((n,s)=>n.z-s.z);for(const n of t){if(!("strip"in n)){this.add(this.atlases[n.atlas],n.frame,n.x,n.y,n.z,n.drift??0,n.height);continue}const s=this.atlases[n.atlas];let r=n.x0,o=0;for(;r<n.x1;){const a=n.frames[o%n.frames.length],l=s.frame(a),c=l.w/l.h*n.height;this.add(s,a,r+c/2,n.y,n.z,0,n.height),r+=c+(n.gap??0),o+=1}}}update(e,t,n){this.group.position.x=n.position.x,this.group.position.z=n.position.z,this.gullClock+=e;const s=`gull-${Math.floor(this.gullClock*9)%9}`;for(const r of this.gulls)r.quad.setFrame(s);for(const r of this.items){const o=(r.x+r.drift*t+300)%600-300;r.quad.position.set(o,r.y,r.z),r.quad.orientWorld(n,r.height)}}}const Pg=168,Dr=16,hl={E2:82.41,G2:98,A2:110,B2:123.47,D3:146.83,E3:164.81,G3:196,A3:220,B3:246.94,D4:293.66,E4:329.63,G4:392,A4:440,B4:493.88,D5:587.33,E5:659.25,G5:783.99},ul=["E","E","E","E","A","A","E","E","B","A","E","B"],Dg={E:["E2","E2","B2","E2","D3","E2","B2","G2"],A:["A2","A2","E3","A2","G3","A2","E3","D3"],B:["B2","B2","B2","A2","G2","A2","B2","D3"]},Lg={E:["E5","E5","E5","E5","D5","D5","B4","B4","G4","G4","A4","A4","B4","","D5","B4"],A:["A4","A4","A4","A4","G4","G4","E4","E4","D4","D4","E4","E4","G4","","A4","G4"],B:["B4","B4","B4","B4","A4","A4","G4","G4","E4","E4","G4","G4","A4","","B4","D5"]},Ug=["E5","G5","E5","D5","B4","D5","B4","A4","G4","A4","B4","D5","E5","","E5",""];class Ig{constructor(e,t){this.context=e,this.filter=e.createBiquadFilter(),this.filter.type="lowpass",this.filter.frequency.value=9e3,this.output=e.createGain(),this.output.gain.value=.28,this.filter.connect(this.output).connect(t),this.noise=e.createBuffer(1,e.sampleRate*.5,e.sampleRate);const n=this.noise.getChannelData(0);for(let s=0;s<n.length;s+=1)n[s]=Math.random()*2-1;this.nextTime=e.currentTime+.1,window.setInterval(()=>this.schedule(),40)}context;output;filter;noise;step=0;nextTime=0;scene="menu";lap=0;setScene(e){if(e===this.scene)return;this.scene=e;const t=this.context.currentTime;this.output.gain.setTargetAtTime(e==="ride"?.28:e==="menu"?.16:.1,t,.2),this.filter.frequency.setTargetAtTime(e==="paused"?500:9e3,t,.2)}setTube(e){this.scene!=="paused"&&this.filter.frequency.setTargetAtTime(e?900:9e3,this.context.currentTime,.15)}schedule(){const e=60/Pg/4;for(;this.nextTime<this.context.currentTime+.18;)this.play(this.step,this.nextTime,e),this.step+=1,this.step>=ul.length*Dr&&(this.step=0,this.lap+=1),this.nextTime+=e}tone(e,t,n,s,r,o=0){const a=this.context.createOscillator();if(a.type=s,a.frequency.setValueAtTime(e,t),o>0){const c=this.context.createOscillator();c.frequency.value=6;const h=this.context.createGain();h.gain.value=o,c.connect(h).connect(a.frequency),c.start(t),c.stop(t+n)}const l=this.context.createGain();l.gain.setValueAtTime(1e-4,t),l.gain.linearRampToValueAtTime(r,t+.008),l.gain.setValueAtTime(r,t+n*.6),l.gain.exponentialRampToValueAtTime(1e-4,t+n),a.connect(l).connect(this.filter),a.start(t),a.stop(t+n+.02)}hit(e,t,n,s){const r=this.context.createBufferSource();r.buffer=this.noise;const o=this.context.createBiquadFilter();o.type="highpass",o.frequency.value=s;const a=this.context.createGain();a.gain.setValueAtTime(n,e),a.gain.exponentialRampToValueAtTime(1e-4,e+t),r.connect(o).connect(a).connect(this.filter),r.start(e),r.stop(e+t)}play(e,t,n){const s=Math.floor(e/Dr),r=e%Dr,o=ul[s];r%8===0&&this.tone(70,t,.12,"sine",.5),r%8===4&&this.hit(t,.12,.35,1800),r%2===0&&this.hit(t,.03,.12,7e3),r%2===0&&this.tone(hl[Dg[o][r/2]],t,n*1.8,"triangle",.55);const l=this.lap%2===1&&s>=8?Ug[r]:Lg[o][r];l&&this.tone(hl[l],t,n*.9,"square",.12,r%4===0?0:3)}}class Fg{muted=!1;context=null;master=null;music=null;bed=null;bedFilter=null;unlock(){if(this.context)return;const e=window.AudioContext;e&&(this.context=new e,this.master=this.context.createGain(),this.master.gain.value=this.muted?0:.6,this.master.connect(this.context.destination),this.startBed(),this.music=new Ig(this.context,this.master))}setScene(e){this.music?.setScene(e)}setMuted(e){this.muted=e,this.master&&this.context&&this.master.gain.setTargetAtTime(e?0:.6,this.context.currentTime,.05)}startBed(){if(!this.context||!this.master)return;const t=this.context.createBuffer(1,this.context.sampleRate*4,this.context.sampleRate),n=t.getChannelData(0);let s=0;for(let o=0;o<n.length;o+=1){const a=Math.random()*2-1;s=(s+.02*a)/1.02,n[o]=s*3.5}this.bed=this.context.createBufferSource(),this.bed.buffer=t,this.bed.loop=!0,this.bedFilter=this.context.createBiquadFilter(),this.bedFilter.type="lowpass",this.bedFilter.frequency.value=700;const r=this.context.createGain();r.gain.value=.35,this.bed.connect(this.bedFilter).connect(r).connect(this.master),this.bed.start()}setTube(e){!this.bedFilter||!this.context||(this.bedFilter.frequency.setTargetAtTime(e?220:700,this.context.currentTime,.15),this.music?.setTube(e))}blip(e,t,n,s,r=0){if(!this.context||!this.master||this.muted)return;const o=this.context.currentTime,a=this.context.createOscillator();a.type=n,a.frequency.setValueAtTime(e,o),r!==0&&a.frequency.exponentialRampToValueAtTime(Math.max(30,e+r),o+t);const l=this.context.createGain();l.gain.setValueAtTime(s,o),l.gain.exponentialRampToValueAtTime(.001,o+t),a.connect(l).connect(this.master),a.start(o),a.stop(o+t)}pump(){this.blip(180,.18,"sawtooth",.12,220)}trick(e){this.blip(520+e*140,.16,"square",.14,300),this.blip(780+e*140,.22,"square",.1,400)}wipeout(){this.blip(120,.5,"triangle",.35,-80),this.blip(60,.6,"sine",.4,-30)}stamp(){this.blip(660,.12,"square",.12,200)}}const Ng="https://www.quiversurf.app";class Og{constructor(e,t){this.game=t,this.root=document.createElement("section"),this.root.id="lead",this.root.hidden=!0,this.root.innerHTML=`
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
      </div>`,e.append(this.root),this.status=this.root.querySelector(".lead-status"),this.nextButton=this.root.querySelector('[data-action="next"]'),this.againButton=this.root.querySelector('[data-action="again"]'),this.signUp=this.root.querySelector('[data-link="sign-up"]'),this.signIn=this.root.querySelector('[data-link="sign-in"]'),this.getApp=this.root.querySelector('[data-link="app"]'),this.root.querySelector('[data-action="again"]')?.addEventListener("click",()=>this.onPlayAgain());for(const n of Array.from(this.root.querySelectorAll("a[data-link]")))n.addEventListener("click",()=>wn.track("funnel_click",{target:n.dataset.link??"",level:this.game.levelDef.id,score:Math.floor(this.game.score)}));this.nextButton.addEventListener("click",()=>this.onNextLevel()),this.root.querySelector('[data-action="challenge"]')?.addEventListener("click",()=>{const n=new Promise(s=>setTimeout(()=>s("failed"),1500));Promise.race([this.onChallenge(),n]).then(s=>{this.status.textContent=s==="copied"?"CHALLENGE LINK COPIED. SEND IT TO A FRIEND.":s==="shared"?"CHALLENGE SENT.":"COPY THIS LINK: "+this.challengeUrl()})})}game;root;status;nextButton;againButton;signUp;signIn;getApp;onPlayAgain=()=>{};onChallenge=async()=>"failed";onNextLevel=()=>{};quiverUrl(e){const t=new URL(e,Ng);return t.searchParams.set("utm_source",Vl),t.searchParams.set("utm_medium","game"),t.searchParams.set("utm_campaign",this.game.levelDef.id),t.searchParams.set("utm_content",`score-${Math.floor(this.game.score)}`),t.toString()}challengeUrl(){const e=new URL(window.location.href);return e.searchParams.set("c",ec(this.game.seed,this.game.score)),e.searchParams.set("level",this.game.levelDef.id),e.toString()}show(){this.root.hidden=!1;const e=this.game.nextLevel,t=e!==null&&this.game.unlocked>this.game.level;this.nextButton.hidden=!t,e&&t&&(this.nextButton.textContent=`SURF ${e.name}`),this.againButton.textContent=e?"PLAY AGAIN":`SURF ${$n[0].name} AGAIN`,this.signUp.href=this.quiverUrl("/auth/sign-up"),this.signIn.href=this.quiverUrl("/auth/sign-in"),this.getApp.href=this.quiverUrl("/download")}hide(){this.root.hidden=!0,this.status.textContent=""}}const mi=700;class Bg{points;positions=new Float32Array(mi*3);velocities=new Float32Array(mi*3);life=new Float32Array(mi);sample={position:new N,normal:new N,phase:0,steepness:0};cursor=0;randomState=305441741;constructor(){const e=new Ft;e.setAttribute("position",new gt(this.positions,3).setUsage(xi));const t=new Pt({transparent:!1,depthWrite:!0,vertexShader:`
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
      `});this.points=new qh(e,t),this.points.frustumCulled=!1;for(let n=0;n<mi;n+=1)this.positions[n*3+1]=-100}random(){return this.randomState^=this.randomState<<13,this.randomState^=this.randomState>>>17,this.randomState^=this.randomState<<5,(this.randomState>>>0)/4294967296}spawn(e,t,n,s,r,o){const a=this.cursor,l=a*3;this.positions[l]=e,this.positions[l+1]=t,this.positions[l+2]=n,this.velocities[l]=s,this.velocities[l+1]=r,this.velocities[l+2]=o,this.life[a]=.5+this.random()*.3,this.cursor=(a+1)%mi}lastRun=0;burst(e){for(let t=0;t<26;t+=1)this.spawn(e.x+(this.random()-.5)*.8,e.y+this.random()*.4,e.z+(this.random()-.5)*.4,(this.random()-.3)*4,2+this.random()*4,(this.random()-.5)*3)}update(e,t,n,s,r,o,a=0){for(let h=0;h<4;h+=1){const d=Ct(t)-Jt-2-this.random()*14;Mi(d,Ba+.02,t,this.sample),this.spawn(this.sample.position.x,this.sample.position.y+.1,this.sample.position.z,(this.random()-.5)*2,.8+this.random()*2.2,1.5+this.random()*2.5)}const l=Math.abs(a-this.lastRun)>.02&&Math.abs(a)>2,c=Math.sign(a)!==Math.sign(this.lastRun)&&Math.abs(a-this.lastRun)>1.5;if(l)for(let h=0;h<4;h+=1)this.spawn(o.x,o.y+.1,o.z,-a*.4+(this.random()-.5)*2,1.5+this.random()*2.5,1+this.random()*2.5);if(c)for(let h=0;h<40;h+=1)this.spawn(o.x,o.y+.2,o.z,(this.random()-.5)*8,2+this.random()*4,1+this.random()*4);if(Math.abs(s)>.2&&r>6)for(let h=0;h<3;h+=1)this.spawn(o.x,o.y,o.z,-r*.15+this.random(),1.2+this.random()*2,(this.random()-.3)*3);this.lastRun=a;for(let h=0;h<mi;h+=1){if(this.life[h]<=0)continue;const d=h*3;this.life[h]-=e,this.velocities[d+1]-=9.8*e,this.positions[d]+=this.velocities[d]*e,this.positions[d+1]+=this.velocities[d+1]*e,this.positions[d+2]+=this.velocities[d+2]*e,this.life[h]<=0&&(this.positions[d+1]=-100)}this.points.geometry.attributes.position.needsUpdate=!0}}const Lr=1200;class zg{lines;visible=!1;positions=new Float32Array(Lr*6);colors=new Float32Array(Lr*6);count=0;profile={z:0,y:0,phase:0};a=new N;b=new N;constructor(e){const t=new Ft;t.setAttribute("position",new gt(this.positions,3).setUsage(xi)),t.setAttribute("color",new gt(this.colors,3).setUsage(xi));const n=new Fl({vertexColors:!0,depthTest:!1,depthWrite:!1,transparent:!0});this.lines=new Wh(t,n),this.lines.renderOrder=20,this.lines.frustumCulled=!1,this.lines.visible=!1,e.add(this.lines)}segment(e,t,n,s,r,o,a){if(this.count>=Lr)return;const l=this.count*6;this.positions.set([e,t,n,s,r,o],l),this.colors.set([a.r,a.g,a.b,a.r,a.g,a.b],l),this.count+=1}profileCurve(e,t,n,s,r,o=10){for(let a=0;a<o;a+=1)nn(e,t+(n-t)*a/o,s,this.profile),this.a.set(e,this.profile.y,this.profile.z),nn(e,t+(n-t)*(a+1)/o,s,this.profile),this.b.set(e,this.profile.y,this.profile.z),this.segment(this.a.x,this.a.y,this.a.z,this.b.x,this.b.y,this.b.z,r)}axisCurve(e,t,n,s,r,o=2){for(let a=e;a<t;a+=o)nn(a,n,s,this.profile),this.a.set(a,this.profile.y,this.profile.z),nn(Math.min(t,a+o),n,s,this.profile),this.b.set(Math.min(t,a+o),this.profile.y,this.profile.z),this.segment(this.a.x,this.a.y,this.a.z,this.b.x,this.b.y,this.b.z,r)}patch(e,t,n,s,r,o){this.profileCurve(e,n,s,r,o),this.profileCurve(t,n,s,r,o),this.axisCurve(e,t,n,r,o),this.axisCurve(e,t,s,r,o),this.axisCurve(e,t,(n+s)/2,r,o)}update(e,t,n,s=1.1,r=1.7){if(this.lines.visible=this.visible,!this.visible)return;this.count=0;const o=Ct(e);this.patch(o-(an-2),o-(Jt+3),.28*He,.875*He,e,new ze("#3CFF7A"));let a=o-Jt;for(let v=o-Jt;v>o-an;v-=.5)if(za(Ys(v,e))>.05){a=v;break}this.patch(o-an,a,Ba,ql,e,new ze("#FF4FD8")),this.axisCurve(o-an,a,Xl,e,new ze("#FF4FD8"));const l=Vs(e)-1,c=new ze("#FF5C6C");this.profileCurve(l,.02,He,e,c,14),nn(l,0,e,this.profile),this.segment(l,this.profile.y,this.profile.z,l,this.profile.y+12,this.profile.z,c),this.segment(l,this.profile.y,this.profile.z,l,this.profile.y,this.profile.z+14,c);const h=new ze("#FFD447"),d=n.x,f=n.y,p=n.z;this.segment(d-s,f,p,d+s,f,p,h),this.segment(d-s,f+r,p,d+s,f+r,p,h),this.segment(d-s,f,p,d-s,f+r,p,h),this.segment(d+s,f,p,d+s,f+r,p,h);const _=this.lines.geometry;_.setDrawRange(0,this.count*2),_.attributes.position.needsUpdate=!0,_.attributes.color.needsUpdate=!0}}const zt=i=>i.toFixed(6);function kg(){return new Pt({uniforms:{time:{value:0},waveHeight:{value:5},mouthX:{value:0},foamX:{value:0}},side:Vt,vertexShader:`
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
        float onFace = 1.0 - smoothstep(${zt(He-.03)}, ${zt(He)}, face);
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

      const float U_CREST = ${zt(He)};
      const float U_CEILING = ${zt(Gm)};
      const float U_TIP = ${zt(Ba)};
      const float U_LIP_TOP = ${zt(Xl)};
      const float U_PEAK = ${zt(ql)};

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
        float steep = smoothstep(0.35, ${zt(Gs)}, vPhase);
        float pitch = smoothstep(${zt(Gs)}, ${zt(Yl)}, vPhase);
        float drop = smoothstep(${zt($l)}, ${zt(Kl)}, vPhase);
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
    `})}async function Hg(){const i="https://9a9b828ed217cf8ae38f59b3e9fec9ab@o4510293516091392.ingest.us.sentry.io/4510293517205504",e=await dl(()=>import("./index-dTt6LNHL.js"),[]);e.init({dsn:i,environment:"production",release:"47c04a5",tracesSampleRate:0,replaysSessionSampleRate:0,replaysOnErrorSampleRate:0}),e.setTag("game","el-nino-swell")}Xe.enabled=!1;function ka(i){const e=document.querySelector("#app");if(!e)return;let t=document.querySelector("#fatal");t||(t=document.createElement("pre"),t.id="fatal",t.style.cssText="position:fixed;left:12px;top:12px;z-index:9;max-width:90vw;white-space:pre-wrap;font:12px/1.5 monospace;color:#F8FEFF;background:#D93B72;padding:10px 12px;border:2px solid #F8FEFF",e.append(t)),t.textContent+=`${i}
`}window.addEventListener("error",i=>ka(`error: ${i.message} @ ${i.filename}:${i.lineno}`));window.addEventListener("unhandledrejection",i=>ka(`rejection: ${String(i.reason?.message??i.reason)}`));async function Gg(){const i=document.querySelector("#app");if(!i)throw new Error("Missing #app");const e=document.createElement("div");if(e.id="loading",e.textContent=`LOADING ${Is}...`,e.style.cssText='position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);font:12px "Press Start 2P",monospace;color:#B8F1FF',i.append(e),!document.createElement("canvas").getContext("webgl2")&&!document.createElement("canvas").getContext("webgl"))throw new Error("WebGL is not available in this browser");const t=G=>{e.textContent=`LOADING ${Is}... ${G}`},n=(G,ue,le)=>Promise.race([G,new Promise(ee=>setTimeout(()=>ee(le),ue))]);t("FONT"),await n(document.fonts.load('16px "Press Start 2P"').catch(()=>[]),2500,[]),t("SPRITES");const[s,r,o,a,l,c,h,d]=await Promise.all([en.load("surfer"),en.load("water"),en.load("obstacles"),en.load("ui"),en.load("hawaii"),en.load("trestles"),en.load("ocnj"),en.load("kdh")]),f={water:r,obstacles:o,hawaii:l,trestles:c,ocnj:h,kdh:d};t("RENDERER");const p=new fg,_=new Im({antialias:!1,powerPreference:"high-performance"});_.setPixelRatio(1),_.outputColorSpace=Qn,_.autoClear=!1,_.setClearColor(16760458,1),i.append(_.domElement),t("PIPELINE");const v=new cg(_);p.attachPointer(_.domElement,(G,ue)=>v.clientToTarget(G,ue)),p.touchButtons=Ma,p.hudButtons=Cr,t("SCENE");const m=new Ua,u=new Cg(m,f),A=kg(),b=new $m(A);m.add(b.mesh);const E=new Rg;m.add(E.mesh);const P=new Bg;m.add(P.points);const T=new Ag(m,s),R=new Wi(m,f),I=new Km(Fe/_t),M=new dg(a),S=new URLSearchParams(window.location.search).has("debug"),L=new URLSearchParams(window.location.search).has("nohud"),H=new jm(i),W=new zg(m),j=document.createElement("div");j.id="diag",j.hidden=!new URLSearchParams(window.location.search).has("debug")||L,j.style.cssText="position:fixed;left:6px;bottom:4px;z-index:9;font:9px monospace;color:#B8F1FF;opacity:0.8;pointer-events:none",i.append(j);let q=0,$="";window.addEventListener("error",G=>{$=G.message});const J={position:new N,normal:new N,phase:0,steepness:0},B={score:0,best:0,wave:1,waves:3,waveProgress:0,foamGap:1,timeLeft:90,muted:!1,flash:0,pierWarning:!1,touch:!1,levelName:"",help:!1,needsFocus:!1,paused:!1},C=new rg;u.setLevel(C.levelDef);let he=C.level;const pe=new Fg,Oe=()=>{pe.unlock()};window.addEventListener("keydown",Oe,{once:!0}),window.addEventListener("pointerdown",Oe,{once:!0});const Ve=new Og(i,C);let Qe=!1,We=0,Y="";const Q={x:320,y:180},de=new N;let Ce=C.phase;const ve=1/120;let Se=8,st=0,w=performance.now()/1e3,je=60,De=0,be=0,_e=!1;window.__oneMoreWave={fps:je,time:Se,phase:0,distance:0,riderX:0,riderU:0,speed:0,pose:"idle",airborne:!1,insideBarrel:!1,wipedOut:!1,wipeReason:"",barrelPhase:"open",coverage:0,gamePhase:"title",wave:1,score:0,level:"pier",unlocked:0,ready:!1,trace:[]};function Ye(){Se=8,st=0,T.reset(Se),T.drainEvents(),T.render(1,0,Se,I.camera),I.snap(T.renderPosition,Se)}function me(G){Xm(G),A.uniforms.waveHeight.value=G}function Le(){C.startRun(),me(C.waveHeight),Ye()}function lt(){C.selectLevel(C.playAgainLevel,!0),Le()}async function it(){const G=new URL(window.location.href);G.searchParams.set("c",ec(C.seed,C.score)),G.searchParams.set("level",C.levelDef.id);const ue=`I scored ${Math.floor(C.score)} in ${Is} at ${C.levelDef.name}. Same waves, same set. Beat it: ${G.toString()}`,le=await(async()=>{if(navigator.share)try{return await navigator.share({text:ue,url:G.toString()}),"shared"}catch{}try{return await navigator.clipboard.writeText(ue),"copied"}catch{return"failed"}})();return wn.track("challenge_share",{level:C.levelDef.id,score:Math.floor(C.score),outcome:le}),le}function y(){const G=window.__oneMoreWave;G.fps=je,G.time=Se,G.phase=J.phase,G.distance=T.state.distance,G.riderX=T.state.x,G.riderU=T.state.u,G.speed=T.state.speed,G.pose=T.state.pose,G.airborne=T.state.airborne,G.insideBarrel=T.state.insideBarrel,G.wipedOut=T.state.wipedOut,G.wipeReason=T.state.wipeReason,G.barrelPhase=T.state.barrelPhase,G.coverage=T.state.coverage,G.gamePhase=C.phase,G.wave=C.wave,G.score=Math.floor(C.score),G.level=C.levelDef.id,G.unlocked=C.unlocked}let g=!1,O=0;function X(){g=!1;const G=performance.now();if(G-O<8){Z();return}O=G,V(G),Z()}function Z(){g||(g=!0,requestAnimationFrame(X))}window.setInterval(()=>{performance.now()-O>40&&X()},16);function V(G){const ue=G/1e3,le=Math.max(0,Math.min(.1,ue-w));w=ue,st+=le,p.consumeRestart()&&Ye();const ee=p.consumeHeight();ee>0&&me(ee),B.help&&p.consumeStart()?(B.help=!1,C.phase==="paused"&&C.togglePause()):p.consumeStart()&&C.phase==="title"?Le():p.consumeStart()&&C.phase==="results"?lt():p.consumeStart(),p.consumeChallenge()&&C.phase==="results"&&it(),p.consumeLevel()&&(C.phase==="title"||C.phase==="results")&&C.cycleLevel(),p.consumeNextLevel()&&C.phase==="results"&&C.nextLevel&&C.selectLevel(C.level+1)&&Le(),C.phase==="advance"&&C.phaseClock>=Jm&&C.selectLevel(C.level+1)&&Le(),C.level!==he&&(he=C.level,u.setLevel(C.levelDef),me(C.waveHeight),Ye()),p.hudButtons=C.phase==="title"?[...Cr,hg]:Cr,p.consumeFind()&&C.phase==="results"&&window.open(Ve.quiverUrl("/auth/sign-up"),"_blank"),p.consumeMute()&&(B.muted=!B.muted,pe.setMuted(B.muted));const oe=p.consumeHelp();for(oe&&!B.help&&(C.phase==="riding"||C.phase==="paused")?(B.help=!0,C.phase==="riding"&&C.togglePause()):B.help&&(oe||p.consumePause()||C.phase!=="paused")?(B.help=!1,C.phase==="paused"&&C.togglePause()):p.consumePause()&&C.togglePause(),B.paused=C.phase==="paused",B.needsFocus=!p.sawKey&&!p.isTouch&&(C.phase==="riding"||C.phase==="countdown"),B.paused=C.phase==="paused",C.phase!==Ce&&(C.phase==="countdown"&&C.wave===1&&wn.track("game_start",{level:C.levelDef.id,challenge:C.challengeScore!==null}),C.phase==="wave-complete"&&!T.state.wipedOut&&wn.track("wave_complete",{level:C.levelDef.id,wave:C.wave}),(C.phase==="results"||C.phase==="advance")&&(wn.track("heat_end",{level:C.levelDef.id,score:Math.floor(C.score),waves:C.wave,tricks:C.stats.tricks,barrels:C.stats.barrels,best_combo:C.stats.bestCombo,longest_ride:Math.round(C.stats.longestRide),reason:C.lastWipeReason||"time"}),C.unlockedNow&&wn.track("break_unlocked",{level:C.unlockedNow.id})),C.phase==="countdown"&&(me(C.waveHeight),Ye(),R.newWave(C.seed,C.wave-1,T.state.x,C.levelDef)),(C.phase==="title"||C.phase==="results")&&R.clear(),C.phase==="results"?Ve.show():Ve.hide(),Ce=C.phase),p.state.pump&&!Qe&&C.phase==="riding"&&pe.pump(),Qe=p.state.pump,T.setFrozen(C.phase!=="riding"&&C.phase!=="wipeout"),C.phase==="paused"&&(st=0,w=ue),p.consumeDebugToggle()&&S&&(H.toggle(),W.visible=H.visible),p.consumeProfileToggle()&&(I.profileView=!I.profileView);st>=ve;)Se+=ve,T.step(ve,Se,p.state),st-=ve;const we=st/ve;b.update(Se),A.uniforms.time.value=Se,A.uniforms.mouthX.value=jl(Se),A.uniforms.foamX.value=Vs(Se),T.render(we,le,Se,I.camera),I.update(le,Se,T.renderPosition,T.state.coverage,T.state.airborne,T.state.wipedOut),T.render(we,0,Se,I.camera),E.update(Se,I.camera.position.x,I.camera.position.z),u.update(le,Se,I.camera),P.update(le,Se,T.state.x,T.state.heading,T.state.speed,T.renderPosition,T.state.run),T.state.wipedOut&&!_e&&(B.flash=.3),B.flash=Math.max(0,B.flash-le),_e=T.state.wipedOut;const Me=T.quad.scale.x*.3,re=T.quad.scale.y*.85,Ue=R.update(le,Se,T.state,T.renderPosition.y,Me,re,I.camera);Ue&&C.phase==="riding"&&window.__oneMoreWave.trace.push(`${Se.toFixed(2)} hit ${Ue.reason} riderY=${T.renderPosition.y.toFixed(2)}`),Ue&&C.phase==="riding"&&T.forceWipeout(Ue.reason),B.pierWarning=C.phase==="riding"&&R.pierWarning,C.pierWarning=B.pierWarning,B.touch=p.isTouch,B.levelName=C.levelDef.short??C.levelDef.name,de.copy(T.renderPosition).project(I.camera),Q.x=Math.round((de.x+1)/2*Fe),Q.y=Math.round((1-de.y)/2*_t)-40;const D=T.drainEvents();for(const te of D)te.type==="wipeout"?wn.track("wipeout",{level:C.levelDef.id,wave:C.wave,reason:te.reason}):te.type!=="takeoff"&&wn.track("trick",{level:C.levelDef.id,type:te.type});for(const te of D)window.__oneMoreWave.trace.push(`${Se.toFixed(2)} ${te.type}${te.type==="wipeout"?":"+te.reason:""}`);if(D.some(te=>te.type==="takeoff")&&P.burst(T.renderPosition),C.update(le,T.state,D,Q),C.popups.length>We){const te=C.popups[C.popups.length-1];window.__oneMoreWave.trace.push(`${Se.toFixed(2)} popup ${te.frame}`),te.frame==="popup-4"?pe.wipeout():pe.trick(Math.min(3,C.combo))}We=C.popups.length;const ne=C.stamp?.frame??"";ne&&ne!==Y&&pe.stamp(),Y=ne,pe.setTube(T.state.insideBarrel&&C.phase==="riding"),pe.setScene(C.phase==="riding"||C.phase==="countdown"||C.phase==="wipeout"?"ride":C.phase==="paused"?"paused":"menu"),B.score=C.score,B.best=C.best,B.wave=C.wave,B.waveProgress=Math.min(1,C.waveClock/26),B.foamGap=Math.max(0,Math.min(1,(an-T.state.distance)/24)),B.timeLeft=C.timeLeft,M.draw(B,C),v.beginScene(),_.render(m,I.camera),L||_.render(M.scene,M.camera),v.present(),q+=1,q%15===0&&(j.textContent=`f=${q} dt=${le.toFixed(3)} phase=${C.phase} pc=${C.phaseClock.toFixed(2)} hidden=${document.hidden} ${$}`),De+=1,be+=le,be>=.5&&(je=De/be,De=0,be=0),Mi(T.state.x,T.state.u,Se,J),H.update(T.state,J.phase,je),W.update(Se,T.state,T.renderPosition,Me,re),y()}window.addEventListener("resize",()=>v.resize(window.innerWidth,window.innerHeight));const ye=()=>{const G=p.isTouch&&window.innerHeight>window.innerWidth;document.body.classList.toggle("portrait",G),G&&C.phase==="riding"&&C.togglePause()};window.addEventListener("resize",ye),ye(),Ve.onPlayAgain=lt,Ve.onChallenge=it,Ve.onNextLevel=()=>{C.nextLevel&&C.selectLevel(C.level+1)&&Le()},window.__debug={scene:m,rider:T,camera:I.camera,sky:u,game:C,obstacles:R,sound:pe,hudState:B,input:p},Ye(),b.update(Se),e.remove(),_.domElement.focus(),window.__oneMoreWave.ready=!0,Z()}Hg().catch(()=>{});Gg().catch(i=>ka(`boot: ${String(i?.stack??i)}`));
