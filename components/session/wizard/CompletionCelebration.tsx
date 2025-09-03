"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function CompletionCelebration(){
const router = useRouter();

useEffect(()=>{
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if(reduce){
const el = document.getElementById('celebration-pulse');
el?.animate([{transform:'scale(.96)',opacity:.6},{transform:'scale(1)',opacity:1}],{duration:400});
// Navigate to profile after reduced motion animation
setTimeout(() => {
router.push('/profile');
}, 600);
return;
}
import('canvas-confetti').then(({default: confetti})=> {
confetti({particleCount: 140, spread: 70, origin:{y:.6}});
// Navigate to profile after confetti celebration
setTimeout(() => {
router.push('/profile');
}, 2000);
}).catch(()=>{});
},[router]);
return <div id="celebration-pulse" aria-hidden className="fixed inset-0 pointer-events-none"/>;
}