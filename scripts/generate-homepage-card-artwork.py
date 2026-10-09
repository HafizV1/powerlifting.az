# Regenerate background artwork only. Original approved raster lettering/icons remain embedded unchanged.
from pathlib import Path
import base64
root=Path(__file__).resolve().parents[1]
source=root/'assets/images/2713846ed7f61cbbf5ef.png'
bitmap=base64.b64encode(source.read_bytes()).decode()
rects=[(47,412),(469,412),(890,414),(1313,414)]
foreground=[]
for i,(x,w) in enumerate(rects):
 left=x+25
 foreground += [f'<rect x="{left}" y="42" width="43" height="43"/>',f'<circle cx="{left+16}" cy="186" r="16"/>']
 widths=[(211,209,225),(108,111,85),(226,173,0),(182,170,88)][i]
 foreground += [f'<rect x="{left}" y="93" width="{widths[0]}" height="24"/>',f'<rect x="{left}" y="124" width="{widths[1]}" height="20"/>']
 if widths[2]:foreground += [f'<rect x="{left}" y="145" width="{widths[2]}" height="20"/>']
svg=f'''<svg xmlns="http://www.w3.org/2000/svg" width="1774" height="232" viewBox="0 0 1774 232">
<title>Əsas bölmələr</title><desc>Original approved Azerbaijani lettering and icons over custom powerlifting artwork.</desc>
<defs>
<image id="approved" width="1774" height="232" href="data:image/png;base64,{bitmap}"/>
<linearGradient id="panel" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#041b2b"/><stop offset="1" stop-color="#123548"/></linearGradient>
<linearGradient id="shade"><stop stop-color="#021724"/><stop offset=".44" stop-color="#021724" stop-opacity=".94"/><stop offset="1" stop-color="#021724" stop-opacity=".08"/></linearGradient>
<linearGradient id="metal" x1="0" x2="1"><stop stop-color="#365468"/><stop offset=".47" stop-color="#99a9ae"/><stop offset=".55" stop-color="#486270"/><stop offset="1" stop-color="#142f40"/></linearGradient>
<pattern id="grain" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 7.5H8" stroke="#ffffff" stroke-opacity=".025"/><circle cx="2" cy="2" r=".4" fill="#fff" opacity=".05"/></pattern>
<pattern id="knurl" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M-2 2L2-2M0 7L7 0M5 9L9 5M-2 5L2 9M0 0L7 7M5-2L9 2" fill="none" stroke="#829aa8" stroke-width=".45" opacity=".3"/></pattern>
<filter id="letter-ink" color-interpolation-filters="sRGB"><feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 1.2756 4.2912 .4332 0 -2.7"/></filter>
<clipPath id="lettering">{''.join(foreground)}</clipPath>
{''.join(f'<clipPath id="card{i}"><rect x="{x}" y="26" width="{w}" height="185" rx="10"/></clipPath>' for i,(x,w) in enumerate(rects))}
</defs>
<use href="#approved"/>
'''
art=[
# Platform, rack and barbell: restrained architectural detail, no invented calendar data.
'''<g transform="translate(185 0)"><path d="M6 169H226L255 190H-18Z" fill="#163e50" stroke="#507184" stroke-width=".8"/><path d="M16 169L0 190M219 169L245 190M25 176H232M5 183H243" fill="none" stroke="#627d8a" stroke-width=".5" opacity=".4"/><path d="M56 165V34H69V165M186 165V34H199V165" fill="none" stroke="#63808d" stroke-width="3"/><path d="M56 68H200M64 113H190" stroke="#607b89" stroke-width="1"/><g fill="#25485b"><circle cx="62" cy="53" r="2"/><circle cx="62" cy="83" r="2"/><circle cx="62" cy="103" r="2"/><circle cx="192" cy="53" r="2"/><circle cx="192" cy="83" r="2"/><circle cx="192" cy="103" r="2"/></g><rect x="19" y="86" width="219" height="5" rx="2" fill="url(#metal)"/><rect x="90" y="86" width="80" height="5" fill="url(#knurl)"/><g stroke="#7897a5" stroke-width=".8"><rect x="40" y="56" width="13" height="64" rx="6" fill="#27506a"/><rect x="27" y="61" width="12" height="54" rx="5" fill="#1a3748"/><rect x="202" y="56" width="13" height="64" rx="6" fill="#824248"/><rect x="216" y="61" width="12" height="54" rx="5" fill="#264e43"/></g><path d="M12 203H228" stroke="#e3b650" stroke-width="2" opacity=".45"/></g>''',
# Realistic medal proportions, ribbons in national colours, understated brushed metal.
'''<g transform="translate(233 0) rotate(-9 95 90)"><path d="M41 13L48 92H69L80 13" fill="#145889"/><path d="M56 13L60 92H69L80 13" fill="#773a46"/><path d="M80 13L70 92H80L92 13" fill="#2d6054"/><path d="M125 0L129 99H151L164 0" fill="#21465a"/><path d="M137 0L139 99H151L164 0" fill="#765443"/><circle cx="67" cy="94" r="8" fill="none" stroke="#bba372" stroke-width="4"/><circle cx="72" cy="142" r="47" fill="#846b3d" stroke="#d7bc7b" stroke-width="2"/><circle cx="72" cy="142" r="40" fill="#a18b57" stroke="#deca95"/><circle cx="72" cy="142" r="33" fill="none" stroke="#cdb783" stroke-width=".7"/><path d="M54 130H90M60 119V143M84 119V143M58 153H86" stroke="#dcc898" stroke-width="3"/><path d="M58 119H63M81 119H86" stroke="#e0cc9f" stroke-width="5"/><circle cx="142" cy="146" r="41" fill="#405565" stroke="#78909a" stroke-width="2"/><circle cx="142" cy="146" r="34" fill="none" stroke="#8596a0"/><path d="M128 143H156M132 134V153M152 134V153" stroke="#a5b2b7" stroke-width="2"/><path d="M55 181L83 99M118 178L154 114" stroke="#fff" opacity=".07" stroke-width="8"/></g>''',
# Stacked competition plates with machined rims and a steel sleeve.
'''<g transform="translate(311 111)"><ellipse cx="-30" rx="86" ry="83" fill="#142d3b" stroke="#345263"/><ellipse cx="-17" rx="85" ry="83" fill="#223c49" stroke="#3a5968"/><ellipse rx="83" ry="83" fill="#7a3038" stroke="#a45c60" stroke-width="2"/><ellipse rx="74" ry="74" fill="none" stroke="#ac6365" stroke-width=".7"/><ellipse rx="64" ry="64" fill="none" stroke="#55212a" stroke-width="2"/><ellipse rx="21" ry="21" fill="#173140" stroke="#b6a18a" stroke-width="2"/><path d="M-60-46Q0-82 60-46M-59 47Q0 81 59 47" fill="none" stroke="#c08279" stroke-width="1" opacity=".6"/><path d="M-82-7H-140M-82 5H-139" stroke="#84959d" stroke-width="2"/><rect x="-7" y="-11" width="115" height="22" rx="3" fill="url(#metal)"/><rect x="70" y="-11" width="33" height="22" fill="url(#knurl)"/><path d="M-12-68L15-75M-8 70L21 64M-72 18L-68 40" stroke="#c79b8a" stroke-width=".9" opacity=".45"/></g>''',
# Qualification as measured progression and an engraved barbell medallion.
'''<g transform="translate(211 0)"><path d="M5 174H180M30 52V171M82 52V171M134 52V171" fill="none" stroke="#466478" stroke-width=".5"/><rect x="22" y="125" width="28" height="48" rx="2" fill="#36596b"/><rect x="73" y="98" width="28" height="75" rx="2" fill="#526d78"/><rect x="124" y="66" width="28" height="107" rx="2" fill="#9b8352"/><path d="M22 125H50M73 98H101M124 66H152" stroke="#d8bc76" stroke-width="1"/><circle cx="142" cy="110" r="63" fill="#122f40" stroke="#a08b5b" stroke-width="1.2"/><circle cx="142" cy="110" r="54" fill="none" stroke="#596956" stroke-width=".6"/><path d="M110 113H174M116 100V126M126 96V130M158 96V130M168 100V126" stroke="#b9a370" stroke-width="4"/><path d="M119 147L126 150L124 143L130 138L123 138L120 132L117 138H110L116 143L114 150Z" fill="#c3ad75" opacity=".7"/><path d="M143 142L148 143L147 138L151 135H146L144 130L142 135H137L141 138L140 143Z" fill="#c3ad75" opacity=".7"/><path d="M160 135L164 137L163 133L167 130H163L161 126L159 130H155L158 133L158 137Z" fill="#c3ad75" opacity=".7"/></g>'''
]
for i,((x,w),drawing) in enumerate(zip(rects,art)):
 svg+=f'<g clip-path="url(#card{i})"><g transform="translate({x} 26)"><rect width="{w}" height="185" fill="url(#panel)"/>{drawing}<rect width="{w}" height="185" fill="url(#grain)"/><rect width="{w}" height="185" fill="url(#shade)"/></g></g>'
svg+=''.join(f'<rect x="{x+.5}" y="26.5" width="{w-1}" height="184" rx="9.5" fill="none" stroke="#3a5260" stroke-opacity=".5"/>' for x,w in rects)
svg+='<use href="#approved" filter="url(#letter-ink)" clip-path="url(#lettering)"/></svg>'
(root/'assets/images/hero-cards/sections.svg').write_text(svg)
