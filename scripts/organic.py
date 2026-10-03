"""Polygon envelopes and exact segment geometry for the directed atlas."""

def hull(points):
    pts=sorted(set(map(tuple,points)))
    def cross(o,a,b):return (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])
    lo=[];hi=[]
    for p in pts:
        while len(lo)>1 and cross(lo[-2],lo[-1],p)<=0:lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(hi)>1 and cross(hi[-2],hi[-1],p)<=0:hi.pop()
        hi.append(p)
    return [list(p) for p in lo[:-1]+hi[:-1]]

def octagon(r,pad=32):
    x,y,w,h=r['x']-pad,r['y']-pad,r['w']+2*pad,r['h']+2*pad;c=pad*.7
    return [[x+c,y],[x+w-c,y],[x+w,y+c],[x+w,y+h-c],[x+w-c,y+h],[x+c,y+h],[x,y+h-c],[x,y+c]]

def crosses_rect(a,b,r,shrink=.05):
    """Liang–Barsky segment/interior intersection, including diagonal segments."""
    xmin=r['x']+shrink;xmax=r['x']+r['w']-shrink
    ymin=r['y']+shrink;ymax=r['y']+r['h']-shrink
    if max(a[0],b[0])<=xmin or min(a[0],b[0])>=xmax or max(a[1],b[1])<=ymin or min(a[1],b[1])>=ymax:return False
    lo,hi=0.,1.
    for s,d,mn,mx in [(a[0],b[0]-a[0],xmin,xmax),(a[1],b[1]-a[1],ymin,ymax)]:
        if abs(d)<1e-10:
            if not mn<s<mx:return False
        else:
            u,v=(mn-s)/d,(mx-s)/d
            if u>v:u,v=v,u
            lo=max(lo,u);hi=min(hi,v)
            if lo>=hi:return False
    return hi>max(lo,0) and lo<1

def crossing(a,b,c,d):
    def orient(p,q,r):return (q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0])
    return orient(a,b,c)*orient(a,b,d)<-1e-6 and orient(c,d,a)*orient(c,d,b)<-1e-6
