import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

export type MenuAction={
  id:string;label:string;icon:ReactNode;onClick:()=>void;disabled?:boolean;
  destructive?:boolean;dividerBefore?:boolean;
};
export type MenuDetails={x:number;y:number;title:string;actions:MenuAction[]};
export function ContextMenu({menu,onClose}:{
  menu:MenuDetails|null;onClose:()=>void;
}){
  const menuRef=useRef<HTMLDivElement|null>(null);
  useEffect(()=>{
    if(!menu)return;
    const close=(event:PointerEvent)=>{if(!menuRef.current?.contains(event.target as Node))onClose();};
    const esc=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();};
    const dismiss=()=>onClose();
    window.addEventListener('pointerdown',close,true);
    window.addEventListener('keydown',esc);
    window.addEventListener('resize',dismiss);
    window.addEventListener('scroll',dismiss,true);
    return ()=>{
      window.removeEventListener('pointerdown',close,true);
      window.removeEventListener('keydown',esc);
      window.removeEventListener('resize',dismiss);
      window.removeEventListener('scroll',dismiss,true);
    };
  },[menu,onClose]);
  if(!menu)return null;
  const menuHeight=35+menu.actions.length*39+menu.actions.filter(a=>a.dividerBefore).length*9;
  const width=247;
  const x=Math.max(8,Math.min(menu.x,window.innerWidth-width-12));
  const y=Math.max(35,Math.min(menu.y,window.innerHeight-menuHeight-12));
  return <div className="zuzu-context-menu" role="menu" aria-label={menu.title}
    ref={menuRef} style={{left:x,top:y}} onContextMenu={event=>event.preventDefault()}>
    <div className="zuzu-context-title">{menu.title}</div>
    {menu.actions.map(action=><div key={action.id}>
      {action.dividerBefore&&<div className="zuzu-context-divider"/>}
      <button type="button" role="menuitem" disabled={action.disabled}
        className={'zuzu-context-action '+(action.destructive?'danger':'')}
        onClick={() => {onClose();action.onClick();}}>
        <span className="zuzu-context-icon">{action.icon}</span>
        {action.label}
      </button>
    </div>)}
  </div>;
}
