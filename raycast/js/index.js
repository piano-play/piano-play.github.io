/*
  - Entirely Vanilla JS
  - All programmatic art/animation
  - All physics done (poorly) in-house
  - Programmed and Designed By Samy Bencherif
  - Please use Google Chrome
*/

if (!window.requestAnimationFrame) { // http://paulirish.com/2011/requestanimationframe-for-smart-animating/
    window.requestAnimationFrame = window.webkitRequestAnimationFrame || 
                                   window.mozRequestAnimationFrame    || 
                                   window.oRequestAnimationFrame      || 
                                   window.msRequestAnimationFrame     || 
                                   function(callback, element) {
                                     window.setTimeout(callback, 1000 / 60);
                                   }
  }

  function time() {
    return (window.performance && window.performance.now ? window.performance.now() : new Date().getTime())-startTime;
  }

//declare global variables here
var canvas;
var width;
var height;
var ctx;
var dt;
var last;
var mouseX;
var mouseY;

//0,0
var position;
var angle;
var angularVelocity;
var velocity;
var health;

var startTime;

var HAxis;
var VAxis;

var inverted;

var sceneAction;

//normally x:-300

//functions used here can be defined later and it'll work fine

var interactables;

//can't position walls to fix corners as that makes collisions inaccurate!
//I'll have to find a way via renderer to fix it
var map;

var camPosition;
var camScale;//0.4;

var quality = .3;

// ---- TODO list ---
//proto bullet, shootout
//perfect trigger to not see player behind stuff. See if you can get the light to stop as well
//Automate camera zoom
//Also a diff type of enemy could have ai
// laser shot should destroy laser and flare red shield
//speed up invert filter
//fix bug where enemy gets displaced on reload
//only use time() to calc dt. then drive another variable time using dt. This will make it easier to reset, and possible to pause

//game currently does not react well to losing focus

function hexToComponent(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
        a: 1
    } : null;
}

function rgbToComponent(rgb)
{
  rgb = rgb.replace('rgba', '').replace('rgb', '').replace('(', '').replace(')', '').split(',')
  var a = parseFloat(rgb[3]);
  if (a==NaN)
    a = 1;
  return {r: parseInt(rgb[0]), g: parseInt(rgb[1]), b: parseInt(rgb[2]), a: a}
}

function cm(x)
{
  if (inverted)
    {
      var component = x.startsWith('#') ? hexToComponent(x) : rgbToComponent(x)
      return 'rgba(' + (255-component.r) + ', ' + (255-component.g) + ', ' + (255-component.b) + ', ' + (component.a) + ')'
    }
  else
    return x;
}

function Interpolate(a, b, i)
{
  return {x: a.x*(1-i)+b.x*i, y:a.y*(1-i)+b.y*i}
}

function getPoint(points, i)
{
  if (i%1==0)
    return points[i];
  return Interpolate(points[Math.floor(i)], points[Math.floor(i)+1], i%1);
}

function range(a,b)
{
  return Array.apply(null, Array(b-a)).map(function (_, i) {return i+a;});
}

const LR = 10;

function laserAction(self)
{
  var e = self.points.length-1;
  var coll = collide(self.points[e],self.leadDirection,LR, [self.source], true);
  if (coll.collided)
    {
      self.bounces ++;
      if (self.bounces > 3)
        {  //shotTime chosen as UID because it is unique and unchanging
          interactables = interactables.filter(function (x){return x.shotTime != self.shotTime})
          return;
        }
      self.points.splice(self.points.length-1,0,self.points[e])
    }
  self.leadDirection = coll.velocity;
  self.points[e] = add(self.points[e], mul(self.speed*dt,self.leadDirection));
  if ((time()-self.shotTime)/1000>=self.length/self.speed)
    {
      var coll2 = collide(self.points[0],self.tailDirection,LR, [self.source], true);
      //if collided simply remove first existing point dropped by lead to dispose points properly
      if (coll2.collided)
        self.points = [self.points[0]].concat(self.points.slice(2,self.points.length))
      
      self.tailDirection = coll2.velocity;
      self.points[0] = add(self.points[0], mul(self.speed*dt,self.tailDirection));
    }
  
  
  //correct laser shortening here:
  var totalLength = 0;
  for (var i=0; i<self.points.length-1; i++)
    {
      totalLength += abs(sub(self.points[i], self.points[i+1]))
    }
  if (totalLength > self.length)
    self.bounces += 100*dt;
  //
  
}

function drawLaser(self)
{
  ctx.lineWidth = 2;
  ctx.shadowColor = self.color;
  ctx.shadowBlur = (20+5*Math.sin(time()/100))*camScale;
  ctx.strokeStyle = cm("rgba(255,255,255, " + (1/(self.bounces+1) * (Math.sin(time())/2+1)) + ")");
  ctx.beginPath();
  
  var cPoint;
  //var a = self.t-self.length;
  //var b = self.t;
  
  //cPoint = getPoint(self.points, clamp(0, a, self.points.length-1));
  //cPoint = add(mul(camScale, sub(cPoint, camPosition)), {x:width/2, y:height/2});
  //ctx.lineTo(cPoint.x, cPoint.y);
  
  //console.debug(a + " " + b);
  
  //var theRange = range(Math.floor(a)+1,Math.floor(b)+1);
  
  /*for (var i in theRange)
    {
      cPoint = getPoint(self.points, clamp(0, theRange[i], self.points.length-1));
      cPoint = add(mul(camScale, sub(cPoint, camPosition)), {x:width/2, y:height/2});
      ctx.lineTo(cPoint.x, cPoint.y);
    }*/
  
  for (var i in self.points)
    {
      cPoint = getPoint(self.points, clamp(0, i, self.points.length-1));
      cPoint = add(mul(camScale, sub(cPoint, camPosition)), {x:width/2, y:height/2});
      ctx.lineTo(cPoint.x, cPoint.y);
    }
  
  //cPoint = getPoint(self.points, clamp(0, b, self.points.length-1));
  //cPoint = add(mul(camScale, sub(cPoint, camPosition)), {x:width/2, y:height/2});
  //ctx.lineTo(cPoint.x, cPoint.y);
  ctx.stroke();
}

function shoot(source,angle)
{
  //beam starts at origin
  // unit vec, v <-- angle
  //:loop
  //heads toward v until intersect any part of map
  //find normal
  //flip v by normal
  //goto loop
  
  //Have to do sweeping method, because of multiple hits on line seg[] coll
  
  angle += Math.random()/3-.5/3;
  
  interactables.push({points:[source.position,source.position], length:100, speed:500, color:cm("#c60000"), leadDirection: {x: Math.cos(angle), y: Math.sin(angle)}, tailDirection: {x: Math.cos(angle), y: Math.sin(angle)}, shotTime: time(), draw:function(){drawLaser(this)}, action:function(){laserAction(this)}, source:source, bounces:0});
  
  //reorder so enemy is ontop of laser
  
}

function ShootOut(self, playerPos,dt)
{
  //if player out of range shoot towards last angle
  //TODO: or.... deactivate?
  self.timeSinceShot += dt;
  //console.debug(self.shotLag)
  if (self.timeSinceShot>self.shotLag)
    {
      //vary angle (based on player vel?)
      //console.debug("shoot!!!")
      //console.debug(self);
      shoot(self,Math.atan2(playerPos.y-self.position.y, playerPos.x-self.position.x));
      //console.debug(self)
      self.timeSinceShot = 0;
    }
}

function WayPoint(points) //generates self initializing act method that follow waypoint rules
{
  function act(self, t, dt)
  {
    if (self.wpBasis)
      t = t%self.wpBasis.t
    var c=0;
    //console.debug(t);
    for (var i in points)
      {
        c += points[i].t;
        if (c>t)
          break;
        //acc points[i].t > t
      }
     if (!self.wpBasis || self.wpBasis.li!=i)
      {
        //lets store some information we don't want to keep recalculating in the object that is requesting WayPoint use
        //console.debug(self.position.x);
        if (self.wpBasis)
        {
        var lp = {x:self.wpBasis.x, y:self.wpBasis.y};
        var sp = add(points[mod(i-1, points.length)], lp);
        }
        else
          var sp = self.position;
        self.wpBasis = {x:sp.x, y:sp.y, a: self.angle, li:0}
        self.wpBasis.t = 0;
        for (var j in points)
        {
          self.wpBasis.t += points[j].t;
        }
      }
    var lt = (t-(c-points[i].t))/points[i].t
    self.position.x = self.wpBasis.x + points[i].x*lt;
    self.position.y = self.wpBasis.y + points[i].y*lt;
    self.angle = self.wpBasis.a + points[i].a*lt;
    self.wpBasis.li = i;
    //console.debug(i);
  }
  return act;
}

function drawEnemy(self)
{
  
  var r=144;
  var g=195;
  var b=212;
  
  var grd = ctx.createRadialGradient(camScale*(self.position.x-camPosition.x)+width/2,camScale*(self.position.y-camPosition.y)+height/2-20,0,camScale*(self.position.x-camPosition.x)+width/2,camScale*(self.position.y-camPosition.y)+height/2-20,camScale*360);
  
  grd.addColorStop(0, cm("rgba(255,0,0," + .14*(1+(.5+.5*Math.sin(time()/30))*self.lit) + ")"));
  grd.addColorStop(1, cm("rgba(128,0,0,0)"));
  
  ctx.shadowColor = cm("rgba(255,0,0," + (.45+.05*Math.sin(time()/300)) + ")");
  
  //Light
  if (!self.angry)
    {
  ctx.beginPath();
  ctx.fillStyle = grd;
  ctx.moveTo(camScale*(self.position.x-camPosition.x)+width/2-camScale*15*Math.cos(self.angle+Math.PI/2), camScale*(self.position.y-camPosition.y)+height/2-camScale*15*Math.sin(self.angle+Math.PI/2));
  ctx.lineTo(camScale*(self.position.x-camPosition.x)+width/2-400*Math.cos(self.angle+Math.PI/2)-400*Math.tan(self.view/2)*Math.cos(self.angle+Math.PI), camScale*(self.position.y-camPosition.y)+height/2-400*Math.sin(self.angle+Math.PI/2)-400*Math.tan(self.view/2)*Math.sin(self.angle+Math.PI));
  ctx.lineTo(camScale*(self.position.x-camPosition.x)+width/2-400*Math.cos(self.angle+Math.PI/2)+400*Math.tan(self.view/2)*Math.cos(self.angle+Math.PI), camScale*(self.position.y-camPosition.y)+height/2-400*Math.sin(self.angle+Math.PI/2)+400*Math.tan(self.view/2)*Math.sin(self.angle+Math.PI));
  ctx.fill();
    }
  
  //rectangle
  ctx.fillStyle = cm("#000000")
  ctx.shadowColor = cm("rgba(255,255,255," + 3*(.45+.05*Math.sin(time()/300)) + ")");
  ctx.fillRect(camScale*(-20+self.position.x-camPosition.x)+width/2,camScale*(-20+self.position.y-camPosition.y)+height/2,40*camScale,40*camScale);
  
  //triangle
  ctx.fillStyle = cm(self.angry ? "#df1f01" : "#f4bf00");
  ctx.strokeStyle = cm(self.angry ? "#df1f01" : "#f4bf00");
  ctx.shadowColor = cm(self.angry ? "rgba(223, 31, 1," + 3*(.45+.05*Math.sin(time()/300)) + ")" : "rgba(244, 191, 0," + 3*(.45+.05*Math.sin(time()/300)) + ")");
  ctx.lineJoin = "round";
  //ctx.fillRect(-5+self.position.x-camPosition.x+width/2,-5+self.position.y-camPosition.y+height/2,10,10);
  var lx=camScale*(self.position.x-camPosition.x)+width/2;
  var ly=camScale*(self.position.y-camPosition.y)+height/2;
  var ls=camScale;
  ctx.beginPath();
  ctx.moveTo(lx, ly-8*ls);
  ctx.lineTo(lx-7*ls, ly+7*ls);
  ctx.lineTo(lx+7*ls, ly+7*ls);
  ctx.closePath();
  ctx.stroke();
  ctx.fill();
  
  //exclamation
  ctx.shadowColor = "rgba(0,0,0,0)"; //no shadow
  ctx.strokeStyle = cm(self.angry ? "#FFFFFF" : "#000000");
  ctx.lineWidth = 3*ls;
  ctx.beginPath();
  ctx.moveTo(lx,ly-6*ls);
  ctx.lineTo(lx,ly+2.5*ls); //remember decimals are significant because these graphics can scale up via camScale
  
  ctx.moveTo(lx,ly+4*ls);
  ctx.lineTo(lx,ly+7*ls);
  ctx.stroke();
  
  
}

function changeRes(x)
{
  camScale *= x/quality;
  quality = x;
}

function resize()
{
  changeRes(1)
  width = canvas.width = quality*window.innerWidth;
  height = canvas.height = quality*window.innerHeight;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
}

//move initiazations to start func so you can reset game on death

function start()
{
  resize();
  startTime = 0;
  startTime = time();
  last = time();
  
  position={x:-0*400,y:0};
  angle=0;
  angularVelocity=0;
  velocity={x:0,y:0};
  health = 100;

  HAxis=0;
  VAxis=0;

  inverted = false;

  //normally x:-300

  //functions used here can be defined later and it'll work fine
  
  //if (interactables)
  //console.debug(interactables[0].wpBasis);
  
  interactables = [
    {draw:function () {drawEnemy(this)}, position:{x:-250, y:-530}, collider:{w:40, h:40}, angle: Math.PI+.5, action:WayPoint([{x:-300,y:0,a:-1,t:3},{x:300,y:0,a:-1,t:3}]), lit:false, view:1.5, angry:false, delay:1, activity:0, shotLag:1, timeSinceShot:10, type:'enemy'},
        {draw:function () {drawEnemy(this)}, position:{x:600, y:-1300}, collider:{w:40, h:40}, angle: Math.PI+.5, action:WayPoint([{x:500,y:0,a:0,t:5},{x:0,y:100,a:0,t:1},{x:-500,y:0,a:0,t:5},{x:0,y:-100,a:0,t:1}]), lit:false, view:1.5, angry:false, delay:1, activity:0, shotLag:1, timeSinceShot:10, type:'enemy'},
        {draw:function () {drawEnemy(this)}, position:{x:-500, y:-1300}, collider:{w:40, h:40}, angle: Math.PI+.5, action:WayPoint([{x:400,y:0,a:0,t:4},{x:0,y:-400,a:0,t:4},{x:-400,y:400,a:0,t:5.7}]), lit:false, view:1.5, angry:false, delay:1, activity:0, shotLag:1, timeSinceShot:10, type:'enemy'}
  ];

  //can't position walls to fix corners as that makes collisions inaccurate!
  //I'll have to find a way via renderer to fix it
/*map = [
    {x:-700,y:-700},{x:-100,y:-700},
    {x:-700,y:-700},{x:-700,y:100},
    {x:-100,y:-600},{x:-100,y:-100},
    {x:-100,y:-100},{x:100,y:-100},
    {x:100,y:-100},{x:100,y:100},
    {x:-700,y:100},{x:100,y:100},
    {x:-100, y:-600}, {x:300, y:-600}];*/
  
  
  map = [{x:-100,y:-100},{x:100,y:-100},{x:100,y:-100},{x:100,y:100},{x:100,y:100},{x:-100,y:100},{x:-700,y:100},{x:-100,y:100},{x:-700,y:100},{x:-700,y:-700},{x:-100,y:-100},{x:-100,y:-600},{x:-700,y:-700},{x:-100,y:-700},{x:-100,y:-600},{x:400,y:-600},{x:400,y:-600},{x:400,y:-700},{x:0,y:-700},{x:100,y:-700},{x:200,y:-700},{x:300,y:-700},{x:-100,y:-700},{x:-100,y:-1000},{x:0,y:-700},{x:0,y:-1100},{x:0,y:-1100},{x:-800,y:-1100},{x:-100,y:-1000},{x:-800,y:-1000},{x:-800,y:-1000},{x:-900,y:-1000},{x:-900,y:-1000},{x:-900,y:-1500},{x:-800,y:-1100},{x:-800,y:-1400},{x:-900,y:-1500},{x:-600,y:-1500},{x:-800,y:-1400},{x:-500,y:-1200},{x:-500,y:-1200},{x:0,y:-1200},{x:0,y:-1200},{x:0,y:-1800},{x:0,y:-1800},{x:-900,y:-1800},{x:-900,y:-1800},{x:-600,y:-1600},{x:-600,y:-1600},{x:-1200,y:-1800},{x:-1200,y:-1800},{x:-1400,y:-1400},{x:-600,y:-1500},{x:-1100,y:-1600},{x:-1100,y:-1600},{x:-1200,y:-1400},{x:300,y:-700},{x:800,y:-1100},{x:400,y:-700},{x:900,y:-1100},{x:800,y:-1100},{x:500,y:-1100},{x:500,y:-1100},{x:500,y:-1400},{x:500,y:-1400},{x:1200,y:-1400},{x:900,y:-1100},{x:1200,y:-1100},{x:1200,y:-1100},{x:1200,y:-1400},{x:100,y:-700},{x:100,y:-1300},{x:200,y:-700},{x:200,y:-1200},{x:100,y:-1300},{x:500,y:-1700},{x:200,y:-1200},{x:600,y:-1600},{x:600,y:-1600},{x:1300,y:-1500},{x:500,y:-1700},{x:1300,y:-1700}];
  
 
  
  //map = [{x:400,y:100},{x:300,y:200},{x:400,y:100},{x:500,y:200},{x:500,y:200},{x:500,y:400},{x:500,y:400},{x:300,y:400},{x:300,y:400},{x:300,y:200}]
  
  
  camPosition = {x:0, y:0}
  //camScale = 1;//0.4; //don't reset this here so visual effect works

  
  
}

function init()
{
  //$..
  //I forgot where this call was. I checked the entire outer scope
  //then i tried putting a syntax error so the console would reveal to me where it is
  //it was in the html.. of course...
  
  canvas = document.getElementById("game");
  ctx = canvas.getContext('2d');

  //initialize your game here
  //position = {x:0, y:0};
  camScale = quality;
  start();
  requestAnimationFrame(update, canvas);
}
init();

function transform(position, rotation, scale)
{
  return function(p){
    var a = Math.atan2(p.y, p.x)+rotation
    var r = Math.pow(Math.pow(p.x,2)+Math.pow(p.y,2),.5);
    return {x:scale*r*Math.cos(a)+position.x, y:scale*r*Math.sin(a)+position.y}};
}

function drawConvexMesh(points, position, rotation, scale)
{
    t = transform(position, rotation, scale);
    for (var i in points)
      {
        var point = t(points[i])
        ctx.lineTo(point.x, point.y)
      }
}

function drawShip(position, rotation, scale)
{
    ctx.beginPath();
    drawConvexMesh([{x:-40,y:50},{x:0,y:40},{x:0,y:-60}], position, rotation, scale)
    drawConvexMesh([{x:40,y:50},{x:0,y:40},{x:0,y:-60}], position, rotation, scale)
    ctx.fill();
}

function drawMap(map)
{
  ctx.beginPath();
  //ctx.strokeStyle = "#FF0000";
  //ctx.shadowColor = "#FF0000";
  for (var i in map)
    {
      ctx[i%2==1 ? 'lineTo' : 'moveTo'](camScale*(map[i].x-camPosition.x)+width/2, camScale*(map[i].y-camPosition.y)+height/2);
    }
  ctx.stroke();
}

function clamp(a,x,b)
{
  return Math.max(a,Math.min(b,x));
}

function sign(x)
{
  if (x<0)
    return -1;
  else if (x>0)
    return 1;
  else
    return 0;
}

function abs(vect)
{
  return Math.pow(Math.pow(vect.x,2)+Math.pow(vect.y,2),.5)
}

function dist(vect1, vect2)
{
  return Math.pow(Math.pow(vect2.x-vect1.x,2)+Math.pow(vect2.y-vect1.y,2),.5)
}

function nearestPointOnSegment(A,B,C)
{
  //(-(d-b)*(b-f)-(c-a)*(a-e))/((d-b)**2+(c-a)**2)
  var a = A.x;
  var b = A.y;
  var c = B.x;
  var d = B.y;
  var e = C.x;
  var f = C.y;
  var t = (-(d-b)*(b-f)-(c-a)*(a-e))/(Math.pow(d-b,2)+Math.pow(c-a,2))
  t = clamp(0,t,1);
  return {x:a+t*(c-a), y:b+t*(d-b)}
}

function within(l, x, h)
{
  return (l<=x && x<=h) || (l>=x && x>=h)
}

//taken from my Fling Physics project

// <fling>

function intersect(a, b)
{
  //If there are zero or infinitely many solutions return undefined
	if (a.w==0 && b.w==0)
		return undefined
  if (!(a.w==0 || b.w==0) && a.h/a.w == b.h/b.w)
    return undefined
    
	if (a.w==0)
    {
		var Fb = function(x){return (b.h/b.w)*x+(b.y-(b.x*b.h/b.w))}
		if ((within(a.y, Fb(a.x), a.y+a.h) || a.isInfinite) && (within(b.x, a.x, b.x+b.w) || a.isInfinite))
			return [a.x, Fb(a.x)]
		else
			return undefined
      }
	else if (b.w==0)
    {
		var Fa = function(x){return (a.h/a.w)*x+(a.y-(a.x*a.h/a.w))}
		if ((within(b.y, Fa(b.x), b.y+b.h) || b.isInfinite) && (within(a.x, b.x, a.x+a.w) || b.isInfinite))
			return [b.x, Fa(b.x)]
		else
			return undefined
    }
	else
    {
		var Sa = a.h/a.w
		var Ma = a.y-a.x*a.h/a.w
		var Sb = b.h/b.w
		var Mb = b.y-b.x*b.h/b.w
		var Fb = function(x){return (b.h/b.w)*x+(b.y-(b.x*b.h/b.w));}
		var Px = (Ma - Mb) / (Sb - Sa)
    //within last one
		if ((within(a.x,Px,a.x+a.w) || a.isInfinite) && (min(b.x, b.x+b.w) <= Px <= max(b.x, b.x + b.w) || b.isInfinite))
			return [Px, Fb(Px)]
		else
			return None
    }
}

// TODO: multiply this screen point graphic by quality

function drawHUD()
{
  
  var hbWidth = 400;
  //health = clamp(0, health+(1-2*(Math.sin(time()/1000)>0))*50*dt, 100); //toggle health
  
  health = clamp(0, health, 100);
  
  var hbBorder = 3;
  
  var active = false;//Math.sin(time()/500)>0; //toggle active
  
  ctx.beginPath();
  //ctx.lineCap = "round";
  //ctx.moveTo(width/2, 200);
  ctx.fillStyle = "rgba(100,100,100," + 0.04*(1+active*9) + ")"//10
  var n = 4000
  var a = .0606;
  //ctx.arc(width/2,-n-75+height,n,Math.PI/2-a,Math.PI/2+a);
  //ctx.stroke();
  ctx.fillRect(width/2-hbWidth/2-hbBorder, height-75-hbBorder, hbWidth+2*hbBorder,45+2*hbBorder)
  ctx.fill();
  
  ctx.beginPath();
  //ctx.lineCap = "round";
  //ctx.moveTo(width/2, 200);
  ctx.fillStyle = "rgba(" + 255 + "," + ~~(255*Math.pow(health/100,.5)) + "," + ~~(255*Math.pow(health/100,.6)) + "," + (0.16*(1+4*active)) + ")"//5
  var n = 4000
  var a=.06;
  ctx.fillRect(width/2-hbWidth/2, height-75, hbWidth*health/100,45)
  //ctx.arc(width/2,-n-75+height,n,Math.PI/2-a+time()/1000/200,Math.PI/2+a);
  //ctx.stroke();
}

function reflect(v, axis)
{
	var angleV = Math.atan2(v.y, v.x)
	var angleX = Math.atan2(axis.y, axis.x)
	var angleD = angleX-angleV
	var angleN = angleX+angleD
	length = abs(v);
	return {x:Math.cos(angleN)*length, y:Math.sin(angleN)*length}
}

// </fling>

function add(v1,v2)
{
   return {x: v1.x+v2.x, y: v1.y+v2.y}
}

function sub(v1, v2)
{
  return {x: v1.x-v2.x, y: v1.y-v2.y}
}

function mul(a, v)
{
  return {x: a*v.x, y: a*v.y}
}

function mod(a,n)
{
  return (a%n+n)%n
}

function collide(position, velocity, radius, excludes, classic)
{
  var collided = false;
  var hit;
  if (excludes==undefined)
    excludes = [];
  if (classic==undefined)
    classic = false;
  
  
  for (var i in interactables)
      {
        if (interactables[i].position && interactables[i].collider && !excludes.includes(interactables[i]))
  {
  var a, b, p;
          
          var signs = [[-1,-1,-1,1], [1,1,-1,1], [-1,1,-1,-1], [-1,1,1,1]];
          
        //x1x2y1y2  ---+ ++-+ -+-- -+++
          
          for (var s in signs)
            {
              a = add(interactables[i].position, {x:signs[s][0]*interactables[i].collider.w/2,y:signs[s][2]*interactables[i].collider.h/2});
              b = add(interactables[i].position, {x:signs[s][1]*interactables[i].collider.w/2,y:signs[s][3]*interactables[i].collider.h/2});
              p = nearestPointOnSegment(a,b,position);

              if (dist(p, position)<radius && (dist(add(position,velocity),p)<dist(sub(position,velocity),p)))
              {
                collided = true;
                hit = interactables[i]
                if (classic)
                  velocity = reflect({x: -velocity.x, y: -velocity.y}, sub(position, p));
                else
                  //I only have one physically driven body in this collision
                  //compromise accuracy for dynamic collisions:
                  velocity = mul(5000/Math.pow(abs(sub(position, interactables[i].position)),2),sub(position, interactables[i].position))

              }
            }
      }
  }
        for (var i=0; i<map.length-1; i+=2)
      {
        var p = nearestPointOnSegment(map[i],map[i+1],position);
        //console.debug(dist(p, position)<17);
        if (dist(p, position)<radius && (dist(add(position,velocity),p)<dist(sub(position,velocity),p)))
          {
            collided = true;
            hit = map[i]
              velocity = reflect({x: -velocity.x, y: -velocity.y}, sub(position, p));
          }
      }
  return {velocity: velocity, collided: collided, hit: hit}
}

var playerRadius = 22;

function update()
{
  ctx.clearRect(0, 0, width, height);
  dt = (time()-last)/1000;
  
  if (sceneAction)
    sceneAction(time()/1000, dt)
  
  //Game, Physics, and Rendering code goes here
  
  //Physics
  
    //Collisions
  
    var Coll = collide(position, velocity, playerRadius);
    velocity = Coll.velocity;
  
    //Misc Enemy Actions
  
      for (var i in interactables)
      {
        if (interactables[i]==undefined)
          break;
        
        //Run unconditional actions
        interactables[i].action(interactables[i], time()/1000, dt);
        
        //an objects action may destroy itself
        if (interactables[i]==undefined)
          break;
        
        if (interactables[i].position && interactables[i].collider)
        {
          //rotation demo
          //interactables[i].angle += dt;
          
          //this should go in the enemy's action, but I haven't created an action sequencee
          if (interactables[i].type=="enemy")
          {
          
          var pv = sub(position, interactables[i].position);
          
          var fa = Math.atan2(pv.y, pv.x);
          var la = mod(interactables[i].angle-Math.PI/2,2*Math.PI);
          
          var withinDirection = mod(fa - (la-interactables[i].view/2),2*Math.PI) <= mod(interactables[i].view,2*Math.PI);
          
          //in case I generalize radius, note that the trigger radius must be considerably smaller because the drawn portion is mostly transparent
          
          var withinDistance = abs(sub(position, interactables[i].position))<=300;
          
          if (withinDirection && withinDistance) //Light angle could be easily generalized. done.
              {
                interactables[i].lit = true;
                interactables[i].activity += dt;
                if (interactables[i].activity >= interactables[i].delay)
                  {
                interactables[i].angry = true;
                interactables[i].action = function(self,time,dt){ShootOut(self, position, dt)};
                  }
              }
           else
             {
               interactables[i].lit = false;
               if (interactables[i].activity < interactables[i].delay)
                 interactables[i].activity = 0;
             }
          
          }          
        }
        else if (interactables[i].shotTime!=undefined && interactables[i].points!=undefined)
          {
            //it's ballistic
            for (var j=0; j<interactables[i].points.length-1; j+=2)
            {
              var p = nearestPointOnSegment(interactables[i].points[j],interactables[i].points[j+1],position);
              //console.debug(dist(p, position)<17);
              if (dist(p, position)<playerRadius && (dist(add(position,velocity),p)<dist(sub(position,velocity),p)))
              {
                //player hit, player was hit
                
                //render red circ
                
                var rPos = add(mul(camScale, sub(position, camPosition)), {x: width/2, y: height/2});
                
                ctx.fillStyle = cm("rgba(255,120,170,0.4)");
                ctx.beginPath();
                ctx.arc(rPos.x, rPos.y, 20*camScale, 0, 2*Math.PI);
                ctx.fill();
                
                health -= 100*dt;
                
                if (health <= 0 && !sceneAction)
                  {
                    sceneAction = function(time, dt){
                    camPosition = add(camPosition, mul(1, {x:2*Math.random()-1,y:2*Math.random()-1}))
                    }
                    setTimeout(function(){
                      sceneAction = function(time, dt){
                      
                      if (camScale < 1000)
                      camScale *= 1.2+dt;
                      else
                        {
                          inverted = !inverted;
                          canvas.style.background = inverted ? "#EEEEEE" : "#111111";

                          camScale = .4;
                          if (!inverted)
                          {
                            start();
                            sceneAction = function ()
                            {
                              if (camScale < 1)
                                camScale *= 1.2+dt;
                              else
                                sceneAction = undefined;
                            }
                          }
                        }
                        
                        
                      }
                    }, 1000)
                  }
                
                //console.debug("I'm hit!")
                //collided = true;
                //hit = map[i]
                //velocity = reflect({x: -velocity.x, y: -velocity.y}, sub(position, p));
              }
            }
          }
      }
    //console.debug(velocity);
    //Kinematics

    angularVelocity += 10*HAxis*dt;
    angularVelocity = clamp(-7,angularVelocity,7);
    angularVelocity -= sign(angularVelocity)*5*dt;
    //this second way is smarter but I don't feel like reimplementing it for velocity as well
  
    //actually, idk if this would work
    //formula for non-physics based drag: v *= 1-dt/(time for any starting value of v to reduce to 0)
    //angularVelocity *= 1-dt/2;
    angle += angularVelocity*dt;

    velocity.y += 100*Math.sin(angle-Math.PI/2)*VAxis*dt;
    velocity.x += 100*Math.cos(angle-Math.PI/2)*VAxis*dt;
      if (abs(velocity)>300)
      {
        velocity = function(velocity)
        {var t = 300/abs(velocity)
        velocity.x *= t;
        velocity.y *= t;
        return velocity}(velocity);
      }
    velocity.x -= sign(velocity.x)*25*dt;
    velocity.y -= sign(velocity.y)*25*dt;

    position.x += velocity.x*dt;
    position.y += velocity.y*dt;
  
    //This animates camScale, automate zoom later
    //camScale = 1+1/2*(1+Math.sin(time()/1000-Math.PI/2));
  
  //Special Animations
  
  //it might be a good idea to use a timing variable for the stages of this animation instead so I can use camScale for other stuff too
  
  //old death anim
  
  /*
  if (health <= 0 && camScale < 1000)
    {
      camScale *= 1.2+dt;
      //camPosition = add(camPosition, mul(1/camScale, {x:2*Math.random()-1,y:2*Math.random()-1}))
    }
  else if (health <= 0)
    {
      //to invert colors somehow
      inverted = !inverted;
      canvas.style.background = inverted ? "#EEEEEE" : "#111111";
      
      camScale = .4;
      if (!inverted)
        {
          //back to normal
          //deaded death
          //(actual reset will be more thourough)
          start();
        }
      //(how does game reset?)
      //console.debug("zoomed")
    }
  else if (camScale < 1) 
    {
      camScale *= 1.2+dt;
      camScale = Math.min(camScale, 1);
    }*/
  
  //Rendering
    ctx.fillStyle = cm("#FFFFFF"); //obsolete
    ctx.strokeStyle = cm("#FFFFFF");
    ctx.lineWidth = 4*camScale;
  
    /*ctx.shadowColor = "rgba(255,255,255,.4)";
    ctx.fillRect(width/2-50,height/2-50,100,100); //center
    
    ctx.shadowColor = "rgba(0,0,255,.4)";
    ctx.fillRect(width/2-250,height/2-50,100,100); //left*/
  
    //console.debug(time());
  
    var rPos = add(mul(camScale, sub(position, camPosition)), {x: width/2, y: height/2});
  
    if (Coll.collided)
    {
    ctx.fillStyle = cm("rgba(120,170,255,0.4)");
    ctx.beginPath();
    ctx.arc(rPos.x, rPos.y, 20*camScale, 0, 2*Math.PI);
    ctx.fill();
    }
  
    ctx.shadowColor = cm("rgba(255,255,255," + 3*(.45+.05*Math.sin(time()/300)) + ")");
    ctx.fillStyle = cm("#EEEEEE"); //test
    ctx.shadowBlur = 10*camScale;
    
    //ctx.strokeStyle = "#000000";
    drawMap(map);
    for (var i in interactables)
      {
        interactables[i].draw();
      }
    ctx.fillStyle = cm("#EEEEEE");
    ctx.shadowBlur = 10*camScale;
    ctx.shadowColor = cm("rgba(255,255,255," + 3*(.45+.05*Math.sin(time()/300)) + ")");
    drawShip(rPos, angle, .3*camScale);
  
    drawHUD();
  
    //Post FX
  /*if (inverted) //very heavy //could be dramatically sped up with the color map function
    {
      
  var imageData = ctx.getImageData(0, 0, width, height);
  var data = imageData.data;

  for(var i = 0; i < data.length; i += 4) {
    // red
    data[i] = 255 - data[i];
    // green
    data[i + 1] = 255 - data[i + 1];
    // blue
    data[i + 2] = 255 - data[i + 2];
  }

  // overwrite original image
  ctx.putImageData(imageData, 0, 0);
    }*/
    
  requestAnimationFrame(update, canvas);
  last = time();
  camPosition = add(camPosition,mul(dt, sub(position, camPosition)));
  
  //cam shake affect, use when player dies
  //camPosition = add(camPosition, mul(1, {x:2*Math.random()-1,y:2*Math.random()-1}))
  
}

function onKey(event, keycode, down)
{
  if ((keycode==39 || keycode==69) || (keycode==37 || keycode==65))
    {
    HAxis = down*((keycode==39 || keycode==69)-(keycode==37 || keycode==65))
    }
  
    if ((keycode==38 || keycode==87) || (keycode==40 || keycode==83))
    {
    VAxis = down*((keycode==38 || keycode==87)-(keycode==40 || keycode==83))
    }
}

function onMouse(event, down)
{
}

document.addEventListener('keydown', function(ev) { ev.preventDefault(); return onKey(ev, ev.keyCode, true);  }, true);
document.addEventListener('keyup',   function(ev) { return onKey(ev, ev.keyCode, false); }, true);

document.addEventListener('mousedown', function(ev) { return onMouse(ev, true);  }, false);
document.addEventListener('mouseup',   function(ev) { return onMouse(ev, false); }, false);

document.addEventListener("mousemove", function(ev){mouseX=ev.clientX;mouseY=ev.clientY;})

window.onresize = resize;