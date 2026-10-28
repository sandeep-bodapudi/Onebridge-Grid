import React from 'react';

/*
 * D-UI-REDESIGN landing hero: one 10-second story on a loop. A visitor scans the QR standee on a
 * counter, the verified card opens on their phone, they share their details, and the lead lands
 * in the company's dashboard (38 becomes 39). It is the page's only ambient motion. With reduced
 * motion the end state shows, still. The stage is drawn at 660 x 560 and scaled down on phones.
 */
const CSS = `
@keyframes sl-beam{0%,4%{transform:translateY(0);opacity:0}6%{opacity:1}22%{transform:translateY(118px);opacity:1}26%,100%{opacity:0}}
@keyframes sl-bridge{0%,22%{transform:scaleX(0)}34%,88%{transform:scaleX(1)}96%,100%{transform:scaleX(0)}}
@keyframes sl-screen{0%,30%{opacity:1}36%,92%{opacity:0}100%{opacity:1}}
@keyframes sl-card{0%,32%{transform:translateY(100%);opacity:0}40%,92%{transform:none;opacity:1}100%{transform:translateY(100%);opacity:0}}
@keyframes sl-press{0%,54%{transform:none;box-shadow:none}57%{transform:scale(.96)}60%,92%{transform:none;box-shadow:0 0 0 4px rgba(246,135,19,.35)}100%{box-shadow:none}}
@keyframes sl-sent{0%,58%{opacity:0;transform:translateY(6px)}62%,92%{opacity:1;transform:none}100%{opacity:0}}
@keyframes sl-fly{0%,62%{opacity:0;transform:translate(0,0) scale(.8)}66%{opacity:1;transform:translate(0,0) scale(1)}80%{opacity:1;transform:translate(214px,-170px) scale(1)}84%,100%{opacity:0;transform:translate(214px,-170px) scale(.6)}}
@keyframes sl-old{0%,80%{opacity:1;transform:none}84%,96%{opacity:0;transform:translateY(-10px)}100%{opacity:1;transform:none}}
@keyframes sl-new{0%,80%{opacity:0;transform:translateY(10px)}84%,96%{opacity:1;transform:none}100%{opacity:0}}
@keyframes sl-ping{0%,82%{box-shadow:0 0 0 0 rgba(246,135,19,0)}86%{box-shadow:0 0 0 6px rgba(246,135,19,.35)}96%,100%{box-shadow:0 0 0 0 rgba(246,135,19,0)}}
.sl-beam{animation:sl-beam 10s linear infinite}
.sl-bridge{transform-origin:left;animation:sl-bridge 10s cubic-bezier(.2,.8,.2,1) infinite}
.sl-screen{animation:sl-screen 10s ease infinite}
.sl-card{animation:sl-card 10s cubic-bezier(.2,.8,.2,1) infinite}
.sl-press{animation:sl-press 10s ease infinite}
.sl-sent{animation:sl-sent 10s ease infinite}
.sl-fly{animation:sl-fly 10s cubic-bezier(.4,0,.2,1) infinite}
.sl-old{animation:sl-old 10s ease infinite}
.sl-new{animation:sl-new 10s ease infinite}
.sl-ping{animation:sl-ping 10s ease infinite}
.sl-wrap{height:560px}
.sl-stage{width:660px;height:560px;transform-origin:top left}
@media (max-width:719px){.sl-wrap{height:300px}.sl-stage{transform:scale(.52)}}
@media (min-width:720px) and (max-width:1023px){.sl-wrap{height:460px}.sl-stage{transform:scale(.82)}}
@media (prefers-reduced-motion: reduce){
  .sl-beam,.sl-fly,.sl-screen,.sl-sent,.sl-old{animation:none;opacity:0}
  .sl-bridge{animation:none;transform:none}
  .sl-card{animation:none;transform:none;opacity:1}
  .sl-press,.sl-ping{animation:none}
  .sl-new{animation:none;opacity:1;transform:none}
}
`;

/** 8 x 8 QR-like pattern (decorative). 1 = dark, 2 = orange. */
const QR = [
  '10110101',
  '01011010',
  '11002101',
  '01120010',
  '10101101',
  '01010110',
  '11011001',
  '01101011',
];

export function ScanToLead() {
  return (
    <figure className="m-0 w-full min-w-0">
      <style>{CSS}</style>
      <div className="sl-wrap relative mx-auto w-full min-w-0 max-w-[660px] overflow-hidden" aria-hidden="true">
        <div className="sl-stage relative">
          {/* QR standee on the counter */}
          <div className="absolute left-0 top-[150px] flex h-[250px] w-[190px] flex-col gap-2.5 rounded-[18px] bg-[#FAF7F2] p-[18px] text-[#2B2728] shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
            <span className="text-xs font-bold">Sahyadri Steel Works</span>
            <span className="text-[11px] text-[#6B6466]">Scan to meet our sales team</span>
            <div className="relative grid h-32 w-32 grid-cols-8 gap-[3px] self-center overflow-hidden rounded-[10px] border border-[#E3D9C8] bg-white p-2">
              {QR.join('').split('').map((c, i) => (
                <span key={i} className={`rounded-[2px] ${c === '1' ? 'bg-[#2B2728]' : c === '2' ? 'bg-bridge-orange' : ''}`} />
              ))}
              <span className="sl-beam absolute inset-x-1 top-1 h-[3px] rounded bg-bridge-orange shadow-[0_0_12px_2px_rgba(246,135,19,0.6)]" />
            </div>
            <span className="text-center text-[11px] text-[#6B6466]">Pune head office counter</span>
          </div>

          {/* The span: the logo's line, connecting scan to phone */}
          <span className="sl-bridge absolute left-[196px] top-[272px] h-[3px] w-16 rounded bg-bridge-orange" />

          {/* Phone */}
          <div className="absolute left-[262px] top-10 h-[480px] w-[236px] rounded-[36px] border border-[#2B282A] bg-[#0B0A0B] p-2.5 shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
            <div className="relative h-full w-full overflow-hidden rounded-[28px] bg-[#FAF7F2]">
              <div className="sl-screen absolute inset-0 flex items-center justify-center bg-[#1B191A] text-xs text-[#8E8682]">Camera</div>
              <div className="sl-card absolute inset-0 flex flex-col text-[#2B2728]">
                <div className="relative bg-[#1F3A5F] px-4 pb-5 pt-[18px] text-[#FAF7F2]">
                  <div className="flex items-center justify-between text-[10px] font-bold">
                    <span>Sahyadri Steel Works</span>
                    <span className="rounded-md bg-[#8DB4E2] px-1.5 py-0.5 text-[#10233A]">Verified</span>
                  </div>
                  <div className="mt-3.5 flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#F2C48D] font-bold text-[#241A10]">MI</div>
                  <p className="mt-2.5 text-lg font-bold tracking-[-0.02em]">Meera Iyer</p>
                  <p className="mt-0.5 text-[11px] opacity-85">Head of sales, Pune</p>
                  <span className="absolute inset-x-0 bottom-0 h-1 bg-bridge-orange" />
                </div>
                <div className="flex flex-1 flex-col gap-2.5 p-3.5">
                  <div className="grid grid-cols-3 gap-1.5">
                    {['Chat', 'Email', 'Website'].map((l) => (
                      <span key={l} className="flex h-10 items-center justify-center rounded-[10px] bg-[#EFE8DC] text-[10px] font-bold">
                        {l}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-col gap-1.5 rounded-xl border border-[#E3D9C8] bg-white p-2.5">
                    <span className="text-[10px] font-bold">Share your details with Meera</span>
                    <span className="h-[22px] rounded-md bg-[#F4EFE6]" />
                    <span className="h-[22px] rounded-md bg-[#F4EFE6]" />
                    <span className="sl-press flex h-[30px] items-center justify-center rounded-lg bg-bridge-orange text-[10px] font-bold text-[#241A10]">Share details</span>
                    <span className="sl-sent text-center text-[10px] font-bold text-[#27704A]">Sent. Meera will get back to you.</span>
                  </div>
                  <span className="mt-auto flex h-9 items-center justify-center rounded-[10px] bg-[#2B2728] text-[11px] font-bold text-[#FAF7F2]">Save contact</span>
                </div>
              </div>
            </div>
          </div>

          {/* The lead travels to the dashboard */}
          <span className="sl-fly absolute left-[330px] top-[360px] rounded-full bg-bridge-orange px-2.5 py-1.5 text-xs font-bold text-[#241A10] shadow-[0_8px_24px_rgba(246,135,19,0.4)]">
            New lead
          </span>

          {/* Dashboard tile */}
          <div className="sl-ping absolute right-0 top-[150px] flex w-[190px] flex-col gap-2 rounded-[18px] border border-[#2B282A] bg-[#1B191A] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
            <span className="text-[11px] text-[#9C948F]">Leads this week</span>
            <span className="relative h-10 overflow-hidden">
              <span className="sl-old absolute left-0 top-0 text-[34px] font-bold tabular-nums tracking-[-0.03em]">38</span>
              <span className="sl-new absolute left-0 top-0 text-[34px] font-bold tabular-nums tracking-[-0.03em]">39</span>
            </span>
            <span className="text-[11px] text-[#B9B1AC]">Newest: from the Pune counter QR, for Meera</span>
            <span className="flex h-8 items-end gap-[3px]">
              {[30, 45, 38, 60, 52, 72].map((h) => (
                <span key={h} className="flex-1 rounded-[3px] bg-[#322E31]" style={{ height: `${h}%` }} />
              ))}
              <span className="h-full flex-1 rounded-[3px] bg-bridge-orange" />
            </span>
          </div>
        </div>
      </div>
      <figcaption className="mt-4 text-center text-sm text-warm-paper/60">
        Scan the counter QR, open the verified card, share details, and the lead lands in your dashboard.
      </figcaption>
    </figure>
  );
}
