// Clip in homogeneous space before division. The crop basis is aligned with
// depth, so every corner of its enclosing rectangle has positive depth.
export function projectWindow(o,px,py,width,height,viewWidth,viewHeight){
 const dx=px.map((v,i)=>v-o[i]),dy=py.map((v,i)=>v-o[i]);
 const sample=([x,y])=>o.map((v,i)=>v+dx[i]*x+dy[i]*y);
 let poly=[[0,0],[width,0],[width,height],[0,height]];
 const planes=[q=>q[2]-.04,q=>q[2]+q[0],q=>q[2]-q[0],q=>q[2]+q[1],q=>q[2]-q[1]];
 for(const plane of planes){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],fa=plane(sample(a)),fb=plane(sample(b));if(fa>=0)out.push(a);if((fa>=0)!==(fb>=0)){const t=fa/(fa-fb);out.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}}poly=out;if(poly.length<3)return null;}
 const length=Math.hypot(dx[2],dy[2]),u=length>1e-10?[dx[2]/length,dy[2]/length]:[1,0],v=[-u[1],u[0]];
 const points=poly.map(p=>[p[0]*u[0]+p[1]*u[1],p[0]*v[0]+p[1]*v[1]]),min=points.reduce((a,p)=>a.map((x,i)=>Math.min(x,p[i])),[Infinity,Infinity]),max=points.reduce((a,p)=>a.map((x,i)=>Math.max(x,p[i])),[-Infinity,-Infinity]);
 const w=max[0]-min[0],h=max[1]-min[1];if(w<1e-5||h<1e-5)return null;
 const origin=sample([u[0]*min[0]+v[0]*min[1],u[1]*min[0]+v[1]*min[1]]),a=dx.map((x,i)=>x*u[0]+dy[i]*u[1]),b=dx.map((x,i)=>x*v[0]+dy[i]*v[1]);
 const screen=q=>[(q[0]+q[2])*viewWidth/2,(q[2]-q[1])*viewHeight/2,q[2]],s=screen(origin),sa=screen(a),sb=screen(b),n=s[2];
 if(!(n>0)||![...s,...sa,...sb].every(Number.isFinite))return null;
 return {width:w,height:h,inner:[u[0],v[0],u[1],v[1],-min[0],-min[1]],matrix:[sa[0]/n,sa[1]/n,0,sa[2]/n,sb[0]/n,sb[1]/n,0,sb[2]/n,0,0,1,0,s[0]/n,s[1]/n,0,1],polygon:points.map(p=>[p[0]-min[0],p[1]-min[1]])};
}
