const rad=Math.PI/180;
const normalize=q=>{const length=Math.hypot(...q);return q.map(x=>x/length);};
const multiply=(a,b)=>[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
// Device coordinates: intrinsic Z-X-Y; camera looks through the back of the phone.
export function orientationQuaternion(alpha,beta,gamma,screenAngle=0){
 if(![alpha,beta,gamma,screenAngle].every(Number.isFinite))return null;
 const x=beta*rad/2,y=alpha*rad/2,z=-gamma*rad/2,c1=Math.cos(x),c2=Math.cos(y),c3=Math.cos(z),s1=Math.sin(x),s2=Math.sin(y),s3=Math.sin(z);
 const q=[s1*c2*c3+c1*s2*s3,c1*s2*c3-s1*c2*s3,c1*c2*s3-s1*s2*c3,c1*c2*c3+s1*s2*s3];
 const back=[-Math.SQRT1_2,0,0,Math.SQRT1_2],a=-screenAngle*rad/2;
 return normalize(multiply(multiply(q,back),[0,0,Math.sin(a),Math.cos(a)]));
}
export const angularDistance=(a,b)=>2*Math.acos(Math.max(-1,Math.min(1,Math.abs(a.reduce((s,v,i)=>s+v*b[i],0)))));
export function createOrientationFilter(){let target=null,current=null,last=null,enabled=true;
 return {target(q){if(!q||q.length!==4||!q.every(Number.isFinite))return false;if(target&&enabled&&angularDistance(target,q)<.12*rad)return false;target=q.slice();if(!current)current=q.slice();return true;},setEnabled(value){enabled=!!value;},step(now){if(!current)return null;const dt=last===null?1/60:Math.max(0,Math.min(.1,(now-last)/1000));last=now;if(!enabled){current=target.slice();return current.slice();}let dot=current.reduce((s,v,i)=>s+v*target[i],0),goal=target;if(dot<0){dot=-dot;goal=target.map(x=>-x);}const angle=angularDistance(current,goal),tau=angle>4*rad?.022:.055,blend=1-Math.exp(-dt/tau);if(dot>.9995)current=normalize(current.map((v,i)=>v+(goal[i]-v)*blend));else{const theta=Math.acos(Math.min(1,dot)),sin=Math.sin(theta),a=Math.sin((1-blend)*theta)/sin,b=Math.sin(blend*theta)/sin;current=normalize(current.map((v,i)=>v*a+goal[i]*b));}return current.slice();}};
}
