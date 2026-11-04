/* esm.sh - scramble-display@0.59.1 */
import{Alg as s}from"./04e16d7b4d3057c322ae.mjs";import{eventInfo as r}from"./4c1fa2d58b4e69a49660.mjs";import{TwistyPlayer as a}from"./e1065bc452c72d7531c5.mjs";var n=`
:host {
  width: 384px;
  height: 256px;
  display: grid;
}

.wrapper {
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: 1fr;
  place-content: center;
  overflow: hidden;
}

.wrapper > * {
  width: inherit;
  height: inherit;
  overflow: hidden;
}

twisty-player {
  width: 100%;
  height: 100%;
}
`,l="333",c=l,h=class extends HTMLElement{#s;#i=document.createElement("div");#e={eventID:null,scramble:new s,visualization:null,checkered:!1};#t=new a({controlPanel:"none",hintFacelets:"none",visualization:"2D",background:"none"});get player(){return this.#t}constructor(){super(),this.#s=this.attachShadow({mode:"closed"}),this.#i.classList.add("wrapper"),this.#s.appendChild(this.#i);let e=document.createElement("style");e.textContent=n,this.#s.appendChild(e)}connectedCallback(){this.#i.appendChild(this.#t)}set event(e){let t=r(e??c);this.#t.puzzle=t?.puzzleID??"3x3x3",this.#e.eventID=e}get event(){return this.#e.eventID}set scramble(e){let t=new s(e??"");this.#t.alg=t,this.#e.scramble=t,this.#i.setAttribute("title",t.toString())}get scramble(){return this.#e.scramble}set visualization(e){this.#t.visualization=e??"2D",this.#e.visualization=e}get visualization(){return this.#e.visualization}set checkered(e){let t=!!e;this.#t.background=t?"checkered":"none",this.#e.checkered=t}get checkered(){return this.#e.checkered}attributeChangedCallback(e,t,i){switch(e){case"event":{this.event=i;break}case"scramble":{this.scramble=i;break}case"visualization":{this.visualization=i;break}case"checkered":{this.checkered=i!==null;break}}}static get observedAttributes(){return["event","scramble","visualization","checkered"]}};customElements.define("scramble-display",h);export{h as ScrambleDisplay};
