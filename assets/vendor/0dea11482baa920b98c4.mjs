/* esm.sh - cubing@0.59.1/dist/lib/cubing/chunks/search-dynamic-sgs-unofficial-QGGV4PCJ */
import{Alg as T}from"./394a90fc5d16352bddd1.mjs";function S(F,L){let B=[],R=[];for(let e of L.split(`
`)){let t=e.split(" ");if(!e.startsWith("SetOrder ")){if(e.startsWith("Alg ")){let r=T.fromString(e.substring(4));R.push({alg:r,transformation:F.algToTransformation(r)})}else if(e.startsWith("SubgroupSizes "))for(let r=1;r<t.length;r++)B.push(parseInt(t[r],10))}}let U={ordering:new Array(B.length)},l=[],g=0;l.push(0);let A=T.fromString(""),D=F.identityTransformation();for(let e=0;e<B.length;e++)g+=B[e],l.push(g),R.splice(g-1,0,{alg:A,transformation:D});if(R.length!==g)throw Error(`Bad sgs; expected ${g-B.length} algs but saw ${R.length-B.length}`);let n={};for(let e of F.definition.orbits)n[e.orbitName]=new Array(e.numPieces).fill(!1);for(let e=B.length-1;e>=0;e--){let t=[];for(let i=l[e];i<l[e+1];i++){let m=R[i].transformation;for(let f of F.definition.orbits)for(let a=0;a<f.numPieces;a++)(m.transformationData[f.orbitName].permutation[a]!==a||m.transformationData[f.orbitName].orientationDelta[a]!==0)&&(n[f.orbitName][a]||(t.push({orbitName:f.orbitName,permutationIdx:a}),n[f.orbitName][a]=!0))}let r={};for(let i=l[e];i<l[e+1];i++){let m=R[i].transformation.invert(),f="";for(let a=0;a<t.length;a++){let p=t[a];f=`${f} ${m.transformationData[p.orbitName].permutation[p.permutationIdx]} ${m.transformationData[p.orbitName].orientationDelta[p.permutationIdx]}`}r[f]=R[i],R[i].alg=R[i].alg.invert(),R[i].transformation=R[i].transformation.invert()}U.ordering[e]={pieceOrdering:t,lookup:r}}return U}import{puzzles as P}from"./2ed0aeb0abfa0f374088.mjs";import"./98933d3733d619f51e88.mjs";import"./ea37851fac95c2c40c2f.mjs";import{Alg as W}from"./394a90fc5d16352bddd1.mjs";import{randomUIntBelow as M}from"./372f209ee1a675c1cb65.mjs";function _(F){if(F<2)return F;let L=1;for(let B=2;B<=F;B++)L*=B;return L}function y(F,L){if(L<0||L>F)return 0;if(L===0||L===F)return 1;let B=1;for(let R=0;R<L;R++)B=B*(F-R)/(R+1)|0;return B}function E(F){F=F.slice();let L=F.length,B=_(L-1),R=0;for(;L>1;){L--;let U=F[0];R+=U*B;for(let l=0;l<L;l++){let g=F[l+1];F[l]=g-(g>U)}B/=L}return R}function H(F,L){let B=[],R=_(L-1);for(let U=0;U<L;U++)B[U]=F/R|0,F%=R,R/=L-1-U;for(let U=L-2;U>=0;U--)for(let l=U+1;l<L;l++)B[l]+=+(B[l]>=B[U]);return B}function j(F){let L=F.length,B=0;for(let R=0;R<L-1;R++)for(let U=R;U<L;U++)F[R]>F[U]&&(B^=1);return B}function J(F,L){let B=[],R=_(L-1)/2,U=0;for(let l=0;l<L-1;l++)B[l]=F/R|0,F%=R,R/=L-1-l;B[L-1]=0;for(let l=L-2;l>=0;l--)for(let g=l+1;g<L;g++)B[g]>=B[l]?B[g]++:U^=1;return U===1&&([B[L-2],B[L-1]]=[B[L-1],B[L-2]]),B}function N(F){return E(F)>>1}function O(F){let L=F.length,B=0;for(let g=0;g<L;g++)B+=+(F[g]===1);let R=L-B;if(R===0||B===0||L===1)return 0;let U=y(L-1,B),l=0;for(let g=0;R>0&&B>0&&L>1;g++)L--,F[g]===0?U=U*--R/L:(l+=U,U=U*B--/L);return l}function K(F,L,B){let R=B-L,U=y(B-1,L),l=[],g=B-1;for(let A=0;A<g;A++)B--,F<U?(l.push(0),U=U*--R/B):(l.push(1),F-=U,U=U*L--/B);return l.push(L),l}function d(F,L){let B=[];for(let R=0;R<L.length;R++)B[R]=F[L[R]];return B}function s(F,L){let B=[];for(let R=0;R<L;R++)B[R]=R;for(let R=0;R<F.length;R++)B[F[R]]=F[(R+1)%F.length];return B}function u(F,L){let B=Array(L).fill(0);for(let R in F)B[R]=F[R];return B}function Q(F,L){let B=Array(8).fill(0);for(let R=0;R<8;R++)B[R]=(F[1][R]+L[1][R])%3;return[d(F[0],L[0]),B]}var V=[s([0,1,4],12),u({0:2},8)],X=[s([1,2,5],12),u({1:2},8)],Y=[s([2,3,6],12),u({2:2},8)],Z=[s([3,0,7],12),u({3:2},8)],BB=[s([9,8,4],12),u({4:2},8)],LB=[s([10,9,5],12),u({5:2},8)],RB=[s([11,10,6],12),u({6:2},8)],FB=[s([8,11,7],12),u({7:2},8)],yB=[H(0,12),Array(8).fill(0)],c=[V,X,Y,Z,BB,LB,RB,FB],lB=["UL","U","UR","F","L","B","R","D"],v=[0,1,0,1,1,0,1,0];function UB(F){let L=["0","","'"];return F.map(([R,U])=>lB[R]+L[U]).join(" ")}function DB(){let F=J(Math.floor(M(_(12))/2),12),L=Array(8);for(let B=0;B<8;B++)L[B]=M(3);return[F,L]}function gB(){return AB(DB())}function AB(F){let L=eB(F),B=[I(),k()],R=[rB(),oB()],U=[$(),nB()],l=[iB(),tB()],g=fB(L,B,R),A,D=new Set,n=+new Date;for(let e=0;e<25;e++){let{value:t,done:r}=g.next(),i=F;for(let[h,G]of t)for(let x=0;x<G;x++)i=Q(i,c[h]);if(D.has(i.toString()))continue;D.add(i.toString());let m=N(i[0].slice(0,8)),f=0;for(let h=0;h<4;h++)f+=i[1][h]*3**h;let a=[m,f],p=A?A.length-t.length-1:999999,b=aB(a,U,l,p);if(b!==void 0&&((A===void 0||A.length>t.length+b.length)&&(A=t.concat(b)),new Date-n>300))break}return A}function eB(F){let L=0;for(let l=0;l<4;l++)L+=F[0].indexOf(l+8)*12**l;let B=0;for(let l=0;l<4;l++)B+=F[1][l+4]*3**l;let R=F[0].map(l=>Math.max(-1,l-8)),U=O(R.map(l=>+(l>=0)))*2+j(R.filter(l=>l>=0));return[L,B+81*U]}var o={};function C(){if(o.phase1cm)return o.phase1cm;let F=[];for(let L=0;L<81;L++){F[L]=Array(8);let B=[L%3,Math.floor(L/3)%3,Math.floor(L/9)%3,Math.floor(L/27)];F[L][0]=F[L][1]=F[L][2]=F[L][3]=L;for(let R=0;R<4;R++)B[R]=(B[R]+2)%3,F[L][4+R]=B[0]+B[1]*3+B[2]*9+B[3]*27,B[R]=(B[R]+1)%3}return o.phase1cm=F}function tB(){if(o.phase1cp)return o.phase1cp;let F=Array(81);for(let L=0;L<81;L++){let B=[L%3,Math.floor(L/3)%3,Math.floor(L/9)%3,Math.floor(L/27)];F[L]=(B[0]!==0)+(B[1]!==0)+(B[2]!==0)+(B[3]!==0)}return o.phase1cp=F}function I(){if(o.phase1em)return o.phase1em;let F=[];for(let B=0;B<12;B++){F[B]=[];for(let R=0;R<8;R++)F[B][R]=c[R][0].indexOf(B)}let L=Array(12**4);for(let B=0;B<12**4;B++){L[B]=Array(8);for(let R=0;R<8;R++){let U=0;for(let l=0;l<4;l++)U+=F[Math.floor(B/12**l)%12][R]*12**l;L[B][R]=U}}return o.phase1em=L}function rB(){return o.phase1ep?o.phase1ep:o.phase1ep=w(I(),[8+12*1713])}function k(){if(o.phase1sm)return o.phase1sm;let F=y(12,4),L=[];for(let U=0;U<F;U++){L[U]=[];let l=K(U,4,12),g=[];for(let A=0,D=0;A<12;A++)l[A]===0?g[A]=-1:g[A]=D++;for(let A=0;A<8;A++){let D=d(g,c[A][0]),n=d(l,c[A][0]),e=j(D.filter(t=>t>=0));L[U][A]=O(n)*2+e}}let B=C(),R=[];for(let U=0;U<F;U++)for(let l=0;l<81;l++){let g=R[l+81*(2*U)]=[],A=R[l+81*(2*U+1)]=[];for(let D=0;D<8;D++)g[D]=B[l][D]+81*L[U][D],A[D]=B[l][D]+81*(L[U][D]^1)}return o.phase1sm=R}function oB(){return o.phase1sp?o.phase1sp:o.phase1sp=w(k(),[0])}function nB(){if(o.phase2cm)return o.phase2cm;let F=C(),L=Array(81);for(let B=0;B<81;B++)L[B]=F[B].slice(4,8);return o.phase2cm=L}function $(){if(o.phase2em)return o.phase2em;let F=8,L=_(F)/2,B=Array(L),R=[0,1,2,3,4,5,6,7];for(let U=0;U<L;U++){B[U]=Array(4);for(let g=0;g<4;g++){let A=d(R,c[g][0].slice(0,8));B[U][g]=N(A)}if(U===L-1)break;let l=0;do for(let g=F-2;g>=0;g--){if(R[g]>R[g+1])continue;let A=g+1;for(let D=A;D<F;D++)R[D]>R[g]&&(A=D);[R[g],R[A]]=[R[A],R[g]],l^=1;for(let D=0;g+1+D<F-1-D;D++,l^=1)[R[g+1+D],R[F-1-D]]=[R[F-1-D],R[g+1+D]];break}while(l!==0)}return o.phase2em=B}function iB(){return o.phase2ep?o.phase2ep:o.phase2ep=w($(),[0])}function w(F,L){let B=F.length,R=F[0].length,U=Array(B).fill(-1),l=L.slice(),g=[],A=0;for(;l.length>0;){g.length=0;for(let D of l)if(U[D]===-1){U[D]=A;for(let n=0;n<R;n++){let e=F[D][n];for(;e!==D;)g.push(e),e=F[e][n]}}[l,g]=[g,l],A+=1}return U}function aB(F,L,B,R){R=R||999999;let U=F.length,l=0;for(let g=0;g<U;g++)l=Math.max(l,B[g][F[g]]);for(;l<=R;){let g=q(F,L,B,l,-1);if(g!==void 0)return g;l++}}function q(F,L,B,R,U){let l=F.length,g=L[0][0].length,A=0;for(let D=0;D<l;D++)A=Math.max(A,B[D][F[D]]);if(!(A>R)){if(R===0)return[];if(!(A===0&&R===1))for(let D=0;D<g;D++){if(D===U||D<U&&v[D]===v[U])continue;let n=F.slice();for(let t=0;t<l;t++)n[t]=L[t][F[t]][D];let e=1;for(;F.some((t,r)=>F[r]!==n[r]);){let t=q(n,L,B,R-1,D);if(t!==void 0)return[[D,e]].concat(t);for(let r=0;r<l;r++)n[r]=L[r][n[r]][D];e++}}}}function*fB(F,L,B){let R=F.length,U=0;for(let l=0;l<R;l++)U=Math.max(U,B[l][F[l]]);for(;;)yield*z(F,L,B,U,-1),U++}function*z(F,L,B,R,U){let l=F.length,g=L[0][0].length,A=0;for(let D=0;D<l;D++)A=Math.max(A,B[D][F[D]]);if(!(A>R)){if(R===0){yield[];return}if(!(A===0&&R===1))for(let D=0;D<g;D++){if(D===U||D<U&&v[D]===v[U])continue;let n=F.slice();for(let t=0;t<l;t++)n[t]=L[t][F[t]][D];let e=1;for(;F.some((t,r)=>F[r]!==n[r]);){let t=z(n,L,B,R-1,D);for(;;){let{value:r,done:i}=t.next();if(i)break;yield[[D,e]].concat(r)}for(let r=0;r<l;r++)n[r]=L[r][n[r]][D];e++}}}}async function wB(){return new W(UB(gB()))}var sB=null;async function xB(){return sB??=uB()}async function uB(){return S(await P.fto.kpuzzle(),`SubgroupSizes 24 12 11 12 12 11 10 9 11 8 10 9 7 8 10 10 6 9 8 5 7 6 5 4 4 8 7 3 6 6 360

Alg T
Alg B
Alg B T
Alg B'
Alg B' T
Alg U
Alg U T
Alg U'
Alg U' T
Alg B BL
Alg B BL T
Alg B BL'
Alg B BL' T
Alg B' BR
Alg B' BR T
Alg B' BR'
Alg B' BR' T
Alg U R'
Alg U R' T
Alg U' L
Alg U' L T
Alg B BL' D
Alg B BL' D T

Alg R
Alg R'
Alg R D
Alg R D'
Alg R BR
Alg R BR'
Alg R' F
Alg R' L
Alg R' L'
Alg B L B'
Alg U L' U'

Alg B U B'
Alg B U' B'
Alg B R B'
Alg B R' B'
Alg B' U' B
Alg B' U B L
Alg B' U B L'
Alg B' U' B BL'
Alg B U' B' BR
Alg B' R' B F

Alg BR
Alg BR'
Alg BR BL
Alg BR BL'
Alg BR' F
Alg BR' F'
Alg BR' D
Alg B BR B'
Alg U F U'
Alg BR BL L
Alg BR' D BR'

Alg B' BL B
Alg B' BL' B
Alg BR D' BR'
Alg B' BL B D'
Alg B' BL B BL
Alg B' BL B BL'
Alg B' BL L B
Alg B' BL' B F'
Alg B' BL' B L'
Alg B' BL' B BL'
Alg B' BL' L BL' B

Alg R' BR R
Alg R' BR' R
Alg BR BL' D BR
Alg R' BR D R
Alg R' BR D' R
Alg R' BR R BL
Alg B' D' BL D B
Alg BR B D' B' BR'
Alg BR BL' D BR L'
Alg BR BL' D BL BR

Alg U BR U'
Alg U BR' U'
Alg U' R U
Alg U' R' U
Alg U BR B' U'
Alg U BR' U' D
Alg U BR' U' D'
Alg U' R F' U
Alg U' R' U L'

Alg U B U'
Alg U B' U'
Alg U B U' L
Alg U B U' L'
Alg U B' U' BL'
Alg U B U' L F
Alg U B U' L F'
Alg U B' U' BL' D'

Alg B BL' L BL B'
Alg B BL' L' BL B'
Alg U B' D B U'
Alg U B' D' B U'
Alg U R D R' U'
Alg U R D' R' U'
Alg R' F L F' R
Alg R' F L' F' R
Alg B L' B F' D B
Alg U B' D' B U' D

Alg F
Alg F'
Alg F D
Alg F D'
Alg F' L
Alg F' L'
Alg F D' BL

Alg F BL F'
Alg F BL' F'
Alg BR' BL BR
Alg BR' BL' BR
Alg F BR F' BR'
Alg F BL F' BL'
Alg F BL' F' L
Alg F BL' L' F'
Alg F BR' BL BR F'

Alg F' BL F
Alg F' BL' F
Alg U BL U'
Alg U BL' U'
Alg F U' F' U
Alg F' BL F D'
Alg F' BL F BL'
Alg F' BL D F

Alg L
Alg L'
Alg L BL
Alg L BL'
Alg F' D F
Alg L BL D

Alg L' BL L
Alg L' BL' L
Alg L' BL D L
Alg L' BL D' L
Alg L' BL L BL'
Alg L' BL D' L BL
Alg L' BL D' L BL'

Alg L D L'
Alg L D' L'
Alg R' D R
Alg R' D' R
Alg L D L' D'
Alg L R L' R'
Alg L' B' L B
Alg R' D R BL
Alg L BL' L' BL L'

Alg U L' D L U'
Alg U B D B' U'
Alg U L' D' L U'
Alg U B D' B' U'
Alg R' D' BL' D R
Alg U B D' B' U' D
Alg U B' L B L' U'
Alg U B D B' U' BL'
Alg U B D' B' L' D' L U'

Alg F L F'
Alg F L' F'
Alg F L F' D
Alg F L F' D'
Alg F L' F' BL'

Alg L BL' D BL L'
Alg L BL' D' BL L'
Alg F D L D' L' F'
Alg F L D L' D' F'
Alg F L' B' L B F'
Alg F' D' R' D R F
Alg F D L D' L' F' BL'
Alg F' R' B' R' B R' F

Alg B D B'
Alg B D' B'
Alg L' D L
Alg L' D' L
Alg B D B' D'
Alg B' L B L'
Alg B D B' D' BL

Alg D
Alg D'
Alg D BL
Alg D BL'

Alg D BL' D BL D'
Alg D BL' D' BL D'
Alg B D R D' R' B'
Alg B R D R' D' B'
Alg D BL' D BL D' BL
Alg D BL' D BL D' BL'

Alg D BL D BL' D'
Alg D BL D' BL' D'
Alg B' BL' B BR D' BR'
Alg D BL D BL' D' BL
Alg D BL D BL' D' BL'

Alg D' BL D
Alg D' BL' D
Alg D' BL D BL
Alg D' BL D BL'

Alg B D' B' BL B D B'
Alg B D' B' BL' B D B'
Alg D' BL' D BL D' BL D

Alg B R' B' BL B R B'
Alg B R' B' BL' B R B'
Alg L R L' BL' L R' L'

Alg F BL' B' BL F' BL' B
Alg F' R' F BL F' R F
Alg F' R' F BL' F' R F
Alg BR R BR' BL' BR R' BR'
Alg F L' BL U BL' U' L F'
Alg F' U' F D F' U F D'
Alg F BL F' D F BL' F' BL D'

Alg F D F U' F' U D' F'
Alg F D F' BL F BL' D' F'
Alg F U D BL' U' BL D' F'
Alg F U' D F U F' D' F'
Alg F' BR L F BR' F' L' F
Alg U R BL' F BL F' R' U'

Alg BL
Alg BL'

Alg F U BL U' BL' F'
Alg F BL U BL' U' F'
Alg U BL BR BL' BR' U'
Alg BR F BL F' BL' BR'
Alg F U' F' U BL' U BL U'

Alg F U' F' D F U F' D'
Alg B' U' F U B U' F' U
Alg D F U' F' D' F U F'
Alg BR' U BR D' BR' U' BR D
Alg D' BR BL' F BL' F' BL BR' BL D

Alg D BL D F' U' B L' BL' L R' BR' R L' BL L B' U F D
Alg B D BR F' R' BR' R B' F D' BL D B BR' D' B'
Alg L B' BR' L F BR L' B BR' L U F U' BR' F L BL BR'
Alg L BL' D' BR' B R' U' R BR B' D BL' L'
Alg B BR B' D' B D B F' R' B' R BR' B' BR F BR' BL
Alg L' BL D L' D' L' D L' U' R' F' R U D'
Alg U' L BL L U' D R' BL B' BL F' BL' B R BL' U D' L U
Alg L BL BR' L U' D R' F' R BL' U BL D' BR L
Alg D L' R F' R' L BL' BR BL' B' BL B BR' F BL' F' D'
Alg B BL B BR' L R' U' R BR L' B
Alg L B' R' BR B F BL D' BL' D BL' B' F' BR' R U B L'
Alg D' L' BL F' D' BL' D B F' R' BR R B' F' BL' L D
Alg B D' R D' R' BL BR' B BR' B' BL' D' BR B R' B' R B' BL' D'
Alg U' L R' F U L' BL' L B BL' B' BL L U' L' F' R L' U
Alg F' D BL' BR' BL' BR B' U' F L F' U B D F L U BL' U' L'
Alg L' U BR' U D R' BL F R BL' U D' BR' L' BL' BR' L'
Alg U' L' U' D R' BL B' BL F BL' B R BL' U D' L' BL' L' U
Alg D F BL L' BL' B L' B' L' B L' B' L' BL L BL' F' D'
Alg F' BR' B BL' BR BL B' F L' F' L B BR' B' BR L' F L BL'
Alg F' L F' L U' D R' F R U D' L' BL' F L' F
Alg F U' F' BR F' R' BR' U F' L' BL F' D' BL'
Alg B BR' U R BR' R' BR U' B' BR
Alg F' BR' B BR' R BR' BL' BR R' BR BL B' BR F
Alg L' U BL B' U' BL U BL' B BR BL' BR' U' L
Alg BR BL' BR' BL L' BL BR BL' BR' L
Alg U BR' U' BR L' BL BR BL' BR' L
Alg U' L F BL' F' BL F' BR F BR' L' U
Alg F L F' BL D F' D' F BL' L'
Alg U BR' U BR L BL BR BL' BR' L' U
Alg F BR R BL' F' BL' F R' BL BR' BL F'
Alg D BL D B U BR' D BR' L' U' BR' U BR L D' BR U' B' D
Alg U BL' U' BL U BL D L' D BR D' L D BR U BR U D
Alg B' U F U' B' U F' BR' U' B L B' U BR U' B L' B BL
Alg B U' B BL U' BL L U' D R' F' R U' D' L' BL' U B
Alg B L R F D' BR' D F' R' BL' U' L U L' U BL L' B'
Alg D BL D F' BR' F BL' D R' BR' R F D' BL F' BR D
Alg L' D F' R' U BR L BL B' BL B BL' BR' L' U' R D' L
Alg F BL' U D L' U' BR R F' R' BR' U L D BL U' D BL F'
Alg BR' BL' U' L' BL D F' L' F' L F L U L' D' BR L BL
Alg B' L' BL U D R' F' R U D' L' BL L U BL' L B
Alg B BL' L U B' L BL' L B' U' B' L' D L' U' B L' B' D'
Alg B' R' L U L' R BR BL' B BR' B' BL B' BL' B'
Alg F L R BL B' U' B R' BL' L' BL F' BL BR' BL L BL' BR L'
Alg B' U' BL L U D R' F R U D' L' BL' U BL' B' U B'
Alg U BR BL' BR' D' B D' F' D B' D' F BL' U' BL' F' BL' F D'
Alg D' BL' D L BL L' D' BL D F' D F D' BL' D' BL D
Alg B' BL' B' BL L' B' BL' F' D F L F' D' F BL' L BL' B L B
Alg F BL' U D' BL' D' L' U' BR R F R' BR' U L U' D' BL F'
Alg U' D' B D F' D' BR' D' BR D BR B' BL' D F BL U BL'
Alg B BL BR D' BR L' R F R' BR' L D BL' BR' BL' B'
Alg L' F L' U BR' U' BR L F' BR' L U BR U'
Alg F' BL' D' BR' BL B' U' BL U B BL' BR D F
Alg F' D' BR' U R' U BL U' R U' BL' BR D F
Alg F U' BR F' U' BL' B U F BR' R F' U BL L
Alg B' BL' U' BL U B BL' B BL BR BL' BR' B' BL
Alg D' F' U BL U' L F U' F' U L' BL' F D
Alg F' BL' D' BR' BL BR' F' BR U' B' BR' U R' BR' F'
Alg B' U' B BL' B U' B BL' L U' L BL' L B
Alg F' D' F U' F U F' BL F' BL' D F
Alg F' D BR F' R F R' BR' F D'
Alg D BL D B BR' D L' BL' L' BL' BR' BL L BL L D' BR B' D
Alg B L BL L' BL' L' D F' R' BR R D' F L' BL' L' B'
Alg B BL' F' BL BR D' BR' F D' B' D L F' BL' F L D L D' BL
Alg B D' BR' D' BR' F D' BL' D' BL D BL F' D BR D' B'
Alg B D' B U B' D B F' BR' F L' F BR F' L U' B BL
Alg L BL' B' U BL L' BL L U L' BL' L BL' U' B BL' L'
Alg U D F' D BR BL' BR' BL B D' F D B' D BR BL BR' U'
Alg F' D BR L' U' R F' R' U BR' L D BR' BL BR D F
Alg BR' L BL L' BL' BR BL' F BL' L R BL B' U B R' BL' L' F'
Alg D BL BR D B F' R' U' BR' U R B' F D' BR' D'
Alg D' B BR' D L' BL' L' BL' BR BL L BL L D' BR B' D' BL' D'
Alg B U' R B' BL' B R' U' B BL' B' U' BL B' U' L U L'
Alg B D' B' D' BR' BL BR D' B' L B BR' U B U' BL' BR BL L' BL'
Alg B D BR' D' F BL' D' BL' D BL D F' BR D BR D B'
Alg D' B D F' D' BR' D' BR D BR BL BR' BL' BR B' BL' D F
Alg L BL B' U BL L' BL L U' L' BL' L BL' U' B BL L'
Alg B' U B' D' B U' B' D BL' U BL' U' BL' B' U BL' U'
Alg D' BR' B' L' U L' B' U B L U' L B BR D BL
Alg L' D L' F U' F' L D' L' F U BR F' L F BR' F' L BL'
Alg D BR D B F' R' U' BR U R B' F D' BR' BL' D'
Alg BR BL D F BR' BL BR BL' BR F' BR' D' BL' BR'
Alg BR' U' L' BL F' BL' F L BL' U BL BR
Alg D' BR' B' U BR U' BL U' BL' U BR' B BR D
Alg F U BR' U R U' BR B U' F' BL U' L' U BL' B'
Alg B U' L F BR F' L F' BR' F L U B'
Alg BR BL F BL' L F' BR' BL' F BL L' BL' F' BL
Alg U' BR' L BL' BR L U' BR' U L' BL L' U' BR U'
Alg L' F L' U BR' U' BR L F' L BL' BR BL BR'
Alg F' D' BR' BL U R' U BL' U' R U' BR D F
Alg F' BR' B F' U F BR U' BR' B' F BL BR BL'
Alg L B' U' R' BR B F BL D' BL D BL' B' F' BR' R B L'
Alg B F BL B L F BR' R' BL U' R BL' BR' F' L' F' BR' B
Alg U BR F' D F BR' U' L' BL L' BL' L U L B' BL L' B U'
Alg F' L B F BL B R U' R' B' BL' B' F' L BL L F
Alg D BL D B BR' D BR' D' BR D BR BL BR' BL' D' B' D
Alg D' BR' BL B BR B' BL' D BL D' B' BL B BR' BL' BR D
Alg D F' U BR U' L U' BR' U L' D B D' F D B' D BL
Alg L B BL' B L F R U' R' F' L' B' BL B' L' BL'
Alg B D' B U B' D F' BR F L' F BR' F' L B U' B BL
Alg B' BL L B' L' B' L B' BR' R' U' R BR L'
Alg D' F' U' B L' BL' L R' BR R L' BL L B' U F D' BL' D'
Alg B' F' BL' B' F U D' R BR R' BL U' BL' D B'
Alg F' BL' D BL F BL' D' B' U' B D F' D' B' F U B
Alg F' L' BL' L' B F BL B R U R' B' BL' B' F' L' F
Alg L' BL U' D F D' BL' D BL F' BL' D' BL D F' U D' BL L
Alg B' BR L R' U R BR F L' B' BL' B L F' BR L' B
Alg B' L B' BR' B L' B' D F' U F D' F U' F' BR B' BL'
Alg B' BR D' BL' BR' BL B L' R' L' R BR L D L BL BR' B BL
Alg L' D F' L F L' F D' L' BL' L' D BL' BR' BL' BR BL' D'
Alg B' F BR F BR L R' BL U R BL' BR L' B' BL' B' F
Alg F L' F' BR' B BR' F' BR B' BR' F' L F' BR'
Alg BR' B' BR BL' D' BR D BR' BL B
Alg L' F L' U BR' U' L U' BR U F' L
Alg F U' BR' R U' BR BL BR' U' BL' U' R' F' BR U
Alg B' BR' R' U' BL D' BL U BL' D R BL' BR B
Alg D BR' U' L BL' F' BL F L' BL U BL' BR D'
Alg F' BL' D' F BR' BL BR BL' BR F' BR' D BL F
Alg F' BR' BL' BR D' F' BR F BR' D BL F
Alg F' BR R' BR BL' BR' R BR' BL F
Alg B BR F' BR' B' F BL F BL' F'
Alg B D' B U B' D BL' F R' F BL F' R B F' U' B BL
Alg L BL' B' U L U L BL L B' BL B' U' BL' U' B' L' BL
Alg L' BL' U' D F D' BL' D BL F BL' D' BL D F' U D' BL' L
Alg F' L F' BL' D' BR' B R' U' R BR B' D BL' F L' F
Alg U D' BR' D BR' U' L U BR L' D' BR D L U' L' BL
Alg B' BR' B' BL B L F' BR' R' U' R BR F BR L' B
Alg U' F' D BR' F' BR D L D L' U D' B D' B' F D' BL F
Alg B F BL B F' L F BR' R' BL U' R BL' BR' F' BR' L' B
Alg F' D' BL B BR' BL BR BL' BR' D' BR' D BR D F D' B' D
Alg B' BR' B' BL B L F BR' R' U' R BR F' BR L' B
Alg L' F BR L' R' BR BL' BR' R BR' BL B' L F' L' B L' BL'
Alg B' U' BL' U D' BL' D F L' R U R' F' L U' BL U B
Alg D' B D BL BR BL' BR' D' BR' D BR D' BR B' D' BL' D'
Alg B' BR' L F' BR' R' U R BR F L' B' BL' B BR B
Alg L U L' D' BR' D L U' L' U D' BR D BR BL BR' BL' U' BL'
Alg F' L F' BL D' B BR' R' U R B' BR D BL F L' F
Alg B' L B' BR' B L' F' R F' BL F R' F BL' B' BR B' BL'
Alg F' L BL' BR' R' BL U R BR B L' B L B L' F BL' B
Alg L' F D' BR U' BR' D BR' U BR L' B' L F' L' B L' BL'
Alg B' BR' L F BR' R' U R BR F' L' B' BL' B BR B
Alg L F' D' F BR' BL BR BL' BR F' BR' D F L'
Alg F' BL' D F BL' F' BL D' BR' BL BR F
Alg B' BR' R' BL D' BL U' BL' D BL' U R BR B
Alg B' L BL' BR BL L' B' F BL F' BL' B BR' B
Alg F U' BR' R BR F' U BL L U BL' B U'
Alg B' BR B' BL F BL' B F' L BL' BR' BL L' B
Alg U' L BL' U' R U' BL' U R' U BL' L' U
Alg F U' BR' R' F' BR' F BL BR R BL' F' BR U
Alg B U' L' F' BR F L' F BR' F' L' U B'
Alg F' BR' B' F BR' BL' BR F BL B F' BL BR BL'
Alg B BL' U' L U BL' B' BL' B' L' BL U B' U' BL L BL L
Alg B R' U' B U R B' BR F D' B' D BL F' BL' BR' BL
Alg U BL U' B BL U BL U' BL D' B U B' D B U' B
Alg B BL B BL' B BR B' BL BR' R' L U' L' R B
Alg U' L BL' B BL B' L' F U B' R U R' U F' U B BL
Alg F' BL' D' BR' L' B' L B BL BR BL' B' L' B L D BL F BL
Alg L B' L' F U B' R BR B BR' R' BR BL' BR' BL B U' F' BL
Alg D' F BL B BR' B BR B' BL' D BL D' B' F' D
Alg B' L' BL F U F' L' U B U' L F U' F' BL' L BL' B BL B
Alg D BL D B U F' R' BR' R F U' B' D
Alg B BR B' D' BL BR D BR D B' BL' B D BR' BL' D' BL' D'
Alg B' R BR B' BR' R' B U' F' L B L' BL' F BL U BL'
Alg U BR BL' BR' D' B D' F' D B' BL' BR BL BR' D' F U' D'
Alg U' D' BR' U' BR' D' L' D BR' D' L D' BL' U' BL' U BL U'
Alg L' F' BR F' R F' R' L F' BR' D L BL' L' BL D' F BL'
Alg B D BL' D B U R BR R' U' B' D' BL D' B' BL
Alg B' U L' U B BL L' F' BL F D' B' U B D B' L B L'
Alg L BL' B' U L F R U' R' F' U L F' L B L' F
Alg L' D R' U BR L BL B' BL' B BL' BR' L' U' R F D' L
Alg D' B U F' R' BR R F U' B' D' BL' D'
Alg B D BL' B' U' BL L' D L D' BL' U B BL B' D'
Alg B U' BL' U' F U' B U B' F' U BL U' B U' B
Alg U BR' U L BL' L U' BR U BR' L' BL BR L' U
Alg F' D' BR' BL B' U' BL' U B BL' BR D BL F
Alg B' L' B' F BL' F' BL F' BR F BR' B L B
Alg F' BL' D' BR F' BR' F D BR' BL BR F
Alg F D' F' U' F' D' BR D F' D' BR' D' F' U
Alg BR' BL' U' BL L U' F U F' L' U BR
Alg F BR R U' BR B U BR' F BR BL' BR D BL F
Alg F' BR' F U' BL L' U BL' B' F' BL' BR D' BL F
Alg B' U L' B' U L' D F L F' D' L U' B L U' L B L'
Alg B BL B L F BR' R' U' R BR F' L' B
Alg B D' B BR' R' U' B' U R BR U' D' F L' F' U L' D' L
Alg L U' L' U B BL' U B BL B' U R B' BL B R' U B'
Alg D F' D BL U' R U' BL' U R' U B D' F D B' D BL
Alg B BL U B BR' L R' F' U' F R BR L' B' U' B'
Alg B' U' B F' D F D' B' U B D BL F' BL' D' BL F
Alg B D BR B F' U' R' BR' R U B' F BR' D' BL B'
Alg L B' F R BL' U' R' BL B F' L U BR' U' BL L U BR U'
Alg F' L F' BL L U' D R' F' R U D' L' F L' F
Alg L U L' F' BL' F L B BL' U BL' U' BL B' BL L U' L
Alg B' L F BR' R' U R BR F' L' B' BL' B'
Alg U BR' U' L' U' BR' F' BR F BR D R' F R U D' L' BL' L'
Alg B L BL L F' D R' BR' R F D' L BL L BL' L' B'
Alg F' BL' D F' D' B D' B' U' D L D BR' L' F BR D' F U
Alg B U B BR' L R' F' U F R BR L' B' U' BL' B'
Alg U B' L BL' B L' U' L' BL L BL' L U BR F' D' F BR' U'
Alg B BL' D BR B F' U' R' BR R U B' F BR' D' B'
Alg B BR B F BR' U BL' L R BR' R' L' F' U BR U BL B BL'
Alg B' BR' L R' U R BR L' B' BL' B'
Alg B' U BR' R L F' BR' F L' R' BR U' B' BR B'
Alg F' BL' F' BR R U' BR B F BR BL' D F U BL'
Alg F' BR' B' U BR' F BR' F' BR U' BR B BR F
Alg BR' BL' U' BL L' F' BL F BL' L U BR
Alg U' L BL U' R U' BL U R' U BL L' U
Alg F BR' F' U' L F BR U F' U' L' BL U BL'
Alg L' F U' BR' U L' U BR U' L F' L
Alg F' BR' B' U' BR' U F BR B U' BL U BR BL'
Alg F' BR' U BR D' BR U' BR' D F
Alg F BL' BR R BL' F' BL F R' BL BR' F'
Alg L BL' B BL' U BL U' BL B' L' F' BL F L U' L U L
Alg B F BL B F' L F' BR' R' BL U' R BL' BR' F BR' L' B
Alg F BL B' F' BR B' BR' B L F BL B' BR B BL' BR' F' L' B
Alg B F D' BL U R BL' BR' R' U' D B F' BL B
Alg L B' U B' BR B BR U' BR' B L' F BL' B F' BR' B' BL'
Alg U' L R' F L U L' BL' B BL B' L' BL L U' F' R L' U
Alg BR BL F BL' F' L' F' BR' L B BR B' L' F L B BR' B' BL
Alg B' BR' L F L' B' BL B L F' BR' R' U' R BR' L' B
Alg D L U' BR U L U' R BL' F' R' F BL F' BR' U L D BL D
Alg B F BL B F BR' L R' BL U' R BL' BR' L' F BR' B
Alg L B' L' U L' B' U L' D F L' F' D' L U' B L U' B
Alg B' BR L F' BR R' BL U R BL' BR F L' B' F BL' B' F'
Alg B' BL L B L' B' BL' L' U BL' U R' L' R U' BL U' L B
Alg B U' D' F D B BL' B' U D' R BR R' U' F' U D B'
Alg D F L F' L' F R L' BL B L B' BL' L R' F' L D'
Alg L BL D' B BR' R' U R B' BR D BL L'
Alg D F D' B' U' B U' D F' D' F U B' U B F' BL'
Alg D' BR' BL BR B' BL' B D BL' D' BL B BR' B' BL' BR D
Alg U BR' U' L U R' L R BR L' B' L' B L U' L' BL'
Alg BR' L R' U R BR B L' B L B L' BL' B
Alg B BR' B U BR' R L F' BR F L' R' BR U' B
Alg F' L B' BR' B L BL' L' B' BR B L BL L F
Alg D F U' F' U D' BR U' D' F U F' D BR'
Alg B' BL' BR D' BR' D BL BR' B BR
Alg B BL U' BR' L U BR' F' BL D BL BR F BR
Alg L' U BR BL BR' B' BL U' BL' U B BL' U' L
Alg U B' BL U' L' BL' U' F BR' R' BR U F'
Alg D BR' BL U' BL' L F' BL' F BL L' U BR D'
Alg BR L' BL BR' BL' L BL' BR BL BR'
Alg F BL F' BL' B F' BR F BR' B'
Alg D BR L' U' R F' R' U BR L BL B' BL B BL' BR D'
Alg D' BL' D BL D F' D' F D' BL' D L BL' L' D' BL D
Alg B F D' F' U' BL' B U B' BL F D B U' B' U B' F' BL
Alg B U F' D' R BR' R' U' D B BL B' U F U' B'
Alg B BL B L B BR' F BR B' BR' R' U' R F' BR L' B
Alg B BL B L F' U' F' U F BR' R' U' R BR' F BR' L' B
Alg B' U' B F' D F D' B' U B U' D BL' F' BL D' F U BL
Alg L F' BR B' F' R BL' U' R' BL B F' BR L BL BR L
Alg D F' D' BL F' D' F R BL B' L U L' B R' F' BL' D F
Alg B BL BR BL D' BR L' R F' R' BR' L D BR' BL' B'
Alg B' L B' BR' B L' BL' U BL U' B' BR B' U BL' U'
Alg D' B BR' F BL' F' D BR D' BL F' BR B' F D' BL' D'
Alg B D F' L' R F D BR' D' F' R BR' L D B' BL' D' F D'
Alg D L BL' F' R U R' B F' L BL' L' B' F' BL L' D'
Alg B' BR' L F R' U R BR B BR' F' BR B' L' B' BL' B'
Alg D L F BL F L BL' L D' BL' D' F' D' F' L BL D' BL'
Alg D F BL F' BR B' BL' B BL BR' BL L' R F R' L D'
Alg L BL' B' L B L B' L F R U R' B F'
Alg F' D' BL F R B' L U' L' B R' BL' F' D F BL' D F D'
Alg B' L' BL U' D' L' BL' L U' D R' F R U' BL' L B
Alg L' F L' BL U' BL' U L F' L U' BL U BL'
Alg D' F' BL L U' F U F' L' U BL' U' F D
Alg B' U F D F' U F D' F U B U' F U
Alg U B' BR' U R' U' R BR U' B
Alg F' BL' D F BL F' BR F' BR' F BL' D' BL F
Alg F' BR' BL' BR D BL' F BL F' D' BL F
Alg U' F R F' BL' F R' F BL F U
Alg F' BR F BR' L BL' BR' BL BR L'
Alg F U' B F U' BR U BR' U F' U' B' U F'
Alg D F' BR R F' R' F BR' D' F
Alg B D' B U B' D B U' B BR BL BR' D BL BR BL BR' BL D'
Alg B' U' L' D' F D' L' F' L D F' D L U B BL'
Alg D L' F R L' BL B L' B' BL' L R' F' L F L' F' D'
Alg D L' D' BL D F' D F D' BL' L BL D'
Alg D' B R U' B' F' BL' L BL L' BL B F U R' BR' B' D
Alg D L BL' F L BL L' B' F R U' R' B F BL L' D'
Alg D F' BL F BL U BL F' D B D' F D B' D BR BL BR' U'
Alg B F' BL B F' BR' F' L F R' U' R BL' BR BL F' L' B
Alg L F BR B' D BL D' R U' R' D BL' D' B BR' F' L BL L
Alg B F BL B F' BR' L R' U' R BL' BR BL L' B
Alg D' B U BR' D BR' L' U' BR U BR L D' BR U' B' D' BL' D'
Alg F' D' BR' BL' BR D' BR L' U' R F R' U BR' L D' F
Alg D F U D' BL U' B D' F BR F' D' F' D BR' D B' BL
Alg B U' D' F D BL' D' BR D' BR' D BL B' BL' B F' U D B'
Alg L' BL' L' F BR B' D BL D' R U R' D BL' D' B BR' F' L'
Alg B U F' U' B BL' B' U D' R BR R' D F U' B'
Alg B L BL' U' L U' L' U R BL F D' BR D F' R' L' B'
Alg B' L B' BR' B L' F' BL F BL' B' BR B' F U' F' U BL'
Alg D' B BR R U' B' F' BL' L BL' L' BL B F U R' B' D
Alg B BL' U' B BL' B D B D' B D B D' BL B' U BL B'
Alg U BR' U' BR L' F BR' L' U BR U' L F' L
Alg L' U BR BL BR' B U BR' U' BR B' BL' U' L
Alg BR BL D BR' BL' L BL' BR BL L' BL D' BL' BR'
Alg F' BL' D' BR' D BL BR' B U BR U' B' BR F
Alg F U' F' D F' U' B' U F' U' B U' F' D'
Alg B' U BR' R' U R U' BR B U'
Alg L U BL U' BL' L' BL L' F' BL' F BL L BL'
Alg U B' BL' BR' U F' BR' D' F BR' U BL' L' BL'
Alg F BL' L' F' BL D' F' BR U' R' F' U F' BR'
Alg U B U' BL L U' L' U BL' B'
Alg U BL U' B BR' B U BL' U' BL L B' BR B L' B
Alg B BL B L F' U' F U F BR' R' U' R BR' F' BR' L' B
Alg B BR D L' D' F' D F D' F' D' F D' BR' L D' B D B
Alg F' L B' L' F L' U' F R U R' F' L' U' B BL L'
Alg B' L' F U F L' F R U' R' U L F R U R' U B F' BL
Alg B U F' D' F' U R BR' R' U' F D B BL B' F U' B'
Alg F BL U BL' U' F' BL L U' L D BR L' U L U' BR' U D' L
Alg B U' D' B' F BL B BL' D' BR D BR' D BL D' F' U D B'
Alg B BL' D' B' D B BL D BR' BL BR' R D R' BR BL' BR D' B'
Alg B F U' F' D' F' U' R BL' BR' R' BL U' F D B BL B
Alg D BR' BL B' BL' B BL' BR' L' U' R F R' U BR' L D'
Alg B' F' U' F' BL' D' B BR' R' U R B' BR D F U B F
Alg B' D' B' D BR L' D F' D F D F' D' F D L D' BR' B'
Alg D' B F D BL' D' BL B BR' B' BR B' BL' F' D
Alg B D B' F BL L' BL' F' L BL L' BL' BR L R L' R' BR' L' D'
Alg B U B F' BL' B' D' F' U R BR R' U' F D F U' B'
Alg BR BL' L' F' BR U F' U' BR L' B' BR' L F' BR L' B L'
Alg D BL' L' BL D F' D' F D' BL' D L D'
Alg F' BL' B F U' B U B' D' F' BL' B U' B' BL U F D B'
Alg B' F' L BL' BR' R' BL U R BR L' B' F BL' B'
Alg BR BL' BR' BL L' F L' BL' BR BL BR' L F' L
Alg B BL BR' F U' L F U BR' F BL D BR' BL
Alg B' BL' B' U BR' U' BR BL' BR BL BR' B BL B
Alg BR' U' L F U' F' U L' BL' U BL BR
Alg B U BR R' BR U' B' BR U' B' U BR' R' BR
Alg B BR BL L BL BR' BL' L U' BL' U BL L BL' B'
Alg F' BR' B BL' BR' R BR' BL BR R' BR B' BR F
Alg F' BR' B U BR' U' B' BR BL' D' BR D BL F
Alg D' F' BR U' R' F' U F' BR' F BL' L' F' BL
Alg B BL U' L U L' BL' U B' U'
Alg L' F' R B F' BR L' D' F' D BR' L B' F R' F BL L
Alg D F BL L' BL' B L B' L B L B' L BL L BL' F' D'
Alg B BL B BR' L R' U' R BR L' B U BR' U' BR BL' BR BL BR'
Alg B' F R U' R' F' L' B L' B' L' B BL L'
Alg B' L' F D R' F' L' U L F R' U D' L' B BL L F' L
Alg D' L' BL F R' BR' R B' F D' BL D B F BL' L D
Alg B' BR' R' U' BL' U' L R' F R F' L' R U' BL BR B BL
Alg BR L BL BR L U' D R' BL F' R BL' U' D' BR U' L
Alg BR L B' L F R F U F' U' R' L' B L F' BR' L BL
Alg B F U D' R BL' BR' R' BL U' D B F' BL B
Alg L' BL L' D B D' BL' B' D' L R' D R BL' U' L U BL'
Alg L' D BL' U' R' BL F R U D' BR L' BL' BR' L'
Alg U BR' U' L' BL' U BR U' L' B' F R BL' U R' BL B F' L'
Alg BR L' BL' L' B' F R BL' U R' BL B F BR F BR L'
Alg B' F' L F BR BL B' BR' B BL' F' L' B' BR B BR' B F BL'
Alg B D BR B' D' BL' D B F' R' BR R F BR' D' B'
Alg D BL' L' BL' L BL L' BL F' BL' L' F L BL F BL' L D'
Alg U' D R' F R U L D' L D L D' BL' L
Alg U D' BR D' L' D R F BR F' BR' R' BR' D' L U' D' BL'
Alg B' F' BR' L R' BL U R BL' BR L' B' F BL' B'
Alg L' F BL' F' BL F' BR F BR' L
Alg L BL F' D F D' BL' F L' F'
Alg F' D' BR U BR' D BR' U' BR F
Alg BR' L BL' BR BL BR L' F' BR' F
Alg B BR F BR' B' BR F' R' BR' BL' BR R BR' BL
Alg BR' B U BR' R BR R' U' BR B'
Alg F' BL' BR R' BR BL BR' R BR' F
Alg BR L' BL BR' BL' BR' L U BR U'
Alg U BR' U' BR BL' BR BL BR'
`)}export{wB as getRandomRediCubeScramble,xB as sgsDataFTO};
