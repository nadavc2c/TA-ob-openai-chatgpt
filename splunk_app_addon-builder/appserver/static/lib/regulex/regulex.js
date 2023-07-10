if (typeof define !== 'function') define = require('amdefine')(module);
define('Kit',[],function () {
/*Kit*/

var AP=Array.prototype,
    slice=AP.slice,
    isBrowser=(function () {
      return this.toString()==="[object Window]";
    })();


/**
Build sorted Set from array.
This function will corrupt the original array
Proper usage:a=Set(a);
@param {ArrayLike} a
@return {Set} return new ArrayLike Set
*/
function Set(a,_sorted) {
  if (a._Set) return a;
  if (!_sorted) a=sortUnique(a);

  //@returns Boolean. Detect if x is in set.
  //`cmp` is custom compare functions return -1,0,1.
  // function cmp(x,item):Ordering(LT=-1|EQ=0|GT=1);
  a.contains=function (x,cmp) {return !!~bsearch(a,x,cmp)};
  a.indexOf=function (x,cmp) {return bsearch(a,x,cmp)};
  a.toArray=function () {return copyArray(a);};

  /** Union with another Set
  @param {Set|Array} b If b is an array,it will be corrupted by sortUnqiue
  @return {Set} return new Set */
  a.union=function (b) {
    b=Set(b);
    var n=a.length+b.length,c=new a.constructor(n);
    for (var i=0,j=0,k=0;k<n;k++) {//merge
      if (a[i]===b[j]) {c[k]=a[i++];j++;n--;}
      else if (a[i]<b[j]) c[k]=a[i++];
      else c[k]=b[j++];
    }
    c.length=n;
    return Set(c.length===n?c:copyArray(c,n),true);
  };

  a.inspect=a.toArray;
  a._Set=true;
  return a;
}


var LT=-1,EQ=0,GT=1;
function _cmp(a,b) {return a<b?LT:(a===b?EQ:GT)}
function bsearch(a,x,cmp) {
  var lo=0,n=a.length,hi=n-1,pivot,c;
  if (n<1) return -1;
  cmp=cmp||_cmp;//custom compare functions
  if (n===1) return cmp(x,a[lo])===EQ ? lo : -1;
  if (cmp(x,a[lo])===LT || cmp(x,a[hi])===GT) return -1;
  do {
    pivot=lo+((hi-lo+1)>>1);
    c=cmp(x,a[pivot]);
    if (c===EQ) return pivot;
    if (c===LT) hi=pivot-1;
    else lo=pivot+1;
  } while (lo<=hi);
  return -1;
}

/**
Return sorted Set.
This function will corrupt the original array
Proper usage: a=sortUnique(a);
@param {ArrayLike} a
@return {ArrayLike} new unique sorted array
*/
function sortUnique(a) {
  var n=a.length;
  if (n<=1) return a;
  //do a shell sort
  var k=1,hi=n/3|0,i,j,tmp;
  while (k < hi) k=k*3+1;
  while (k > 0) {
    for (i=k;i<n;i++) {
      for (j=i;j>=k && a[j]<a[j-k];j-=k) {
        tmp=a[j]; a[j]=a[j-k]; a[j-k]=tmp;
      }
    }
    k=k/3|0;
  }

  var last=a[0],x;
  for (i=1,j=1;i<n;i++) {
    x=a[i];
    if (x===last) continue;
    last=a[j++]=a[i];
  }
  a.length=j;
  return a.length===j?a:copyArray(a,j); //Typed Array length property only has a getter
}

function copyArray(a,size) {
  size=typeof size==='undefined'?a.length:size;
  var ret=new a.constructor(size),i=size;
  while(i--) ret[i]=a[i];
  return ret;
}

/**
Unique by toString.
This function will corrupt the original array but preserve the original order.
*/
function hashUnique(a) {
  var table={},i=0,j=0,l=a.length,x;
  for (;i<l;i++) {
    x=a[i];
    if (table.hasOwnProperty(x)) continue;
    table[x]=1;
    a[j++]=x;
  }
  a.length=j;
  return a;
}


/**
Object id unique.
This function will corrupt the original array.
Correct usage: a=idUnique(a);
@param {[Object]} NonPrimitive Array
*/
function idUnique(a) {
  var i,j,l=a.length,p,
      guid=(Math.random()*1E10).toString(32)+(+new Date).toString(32);
  for (i=j=0;i<l;i++) {
    p = a[i];
    if (p==null) continue;
    if (p.hasOwnProperty(guid)) continue;
    Object.defineProperty(p,guid,{
      value:1,enumerable:false
    });
    a[j++]=p;
  }
  i=j;
  while (i--) {//clean guid
    a[i][guid]=undefined;
  }
  a.length=j;
  return a;
}

/**
Classify charsets to non-overlapping sorted disjoint ranges.
@param {[Range]}
@return {ranges:DisjointRanges,map:OriginalRangesToDisjoinRangesMap}
Example: classify(['az','09','a','bb']) => {
  ranges:['a','b','cz','09'],
  map:{'az':['a','b','cz'],'09':['09'],'a':['a'],'b':['b']}
}
*/
function classify(ranges) {
  ranges=ranges.map(function (c) {return (!c[1])?c+c:c;});
  var i,j,k,l,r,n;
  ranges=sortUnique(ranges); n=ranges.length;
  var singleMap=Object.create(null),
      headMap=Object.create(null),
      tailMap=Object.create(null),head,tail;
  for (i=0;i<n;i++) {
    r=ranges[i]; tail=r[1]; headMap[r[0]]=true; tailMap[tail]=true;
    for (j=i;j<n;j++) {
      head=ranges[j][0];
      if (head>=tail) {
        if (head===tail) singleMap[tail]=true;
        break;
      }
    }
  }
  var chars=sortUnique(ranges.join('').split('')),
      results=Object.keys(singleMap),
      c=chars[0],tmpMap=Object.create(null),map=Object.create(null);
  for (i=0;i<n;i++) tmpMap[ranges[i]]=[];
  if (singleMap[c]) {
    for (i=0;i<n;i++) {
      r=ranges[i];
      if (r[0]===c) tmpMap[r].push(c);
      else if (r[0]>c) break;
    }
  }
  for (i=0,l=chars.length-1;i<l;i++) {
    head=chars[i]; tail=chars[i+1];
    if (tailMap[head]) head=succ(head);
    if (headMap[tail]) tail=pred(tail);
    if (head<=tail) {
      c=head===tail?head:(head+tail);
      for (j=0;j<n;j++) {
        r=ranges[j];
        if (r[0]>tail) break;
        if (r[0]<=head && tail<=r[1]) tmpMap[r].push(c),results.push(c);
      }
    }
    head=chars[i]; tail=chars[i+1]; //keep insert order,push single char later
    if (singleMap[tail]) {
      for (j=0;j<n;j++) {
        r=ranges[j];
        if (r[0]>tail) break;
        if (r[0]<=tail && tail<=r[1]) tmpMap[r].push(tail);
      }
    }
  }
  results=sortUnique(results);
  for (k in tmpMap) map[k[0]===k[1]?k[0]:k]=tmpMap[k];
  return {ranges:results,map:map};
}


//@deprecated
function ____classify(ranges) {
  var stack=[],map={},
      chars=sortUnique(ranges.join('').split(''));
  chars.reduce(function (prev,c) {
    var head,tail,choosed=[];
    ranges=ranges.filter(function (rg) {//side affects filter
      var start=rg[0],end=rg[1] || start;
      head = head || start==c;
      tail = tail || end==c;
      if (start<=c && c<=end) choosed.push(rg);
      if (end >= c ) return true;
    });
    if (!choosed.length) return c;
    var last=stack[stack.length-1],valid,newRange,
        start=(last && (last[1] || last[0])==prev)?succ(prev):prev,
        end=head?pred(c):c;
    if (start<=end) {
      newRange=start==end?start:start+end;
      choosed.forEach(function (rg) {
        if (rg[0]<=start && rg.slice(-1)>=end) {
          (map[rg]=map[rg] || []).push(newRange);
          valid=true;
        }
      });
      if (valid) stack.push(newRange);
    }
    if (head && tail) {
      stack.push(c);
      choosed.forEach(function (rg) {(map[rg]=map[rg] || []).push(c)});
    }
    return c;
  },chars[0]);

  return {ranges:stack,map:map};
}


/**
Convert exclude ranges to include ranges
Example: ^b-y, ['by'] to ["\0a","z\uffff"]
@param {[Range]}
@return Sorted disjoint ranges
*/
function negate(ranges /*:[Range rg]*/) {
  var MIN_CHAR="\u0000",
      // work around UglifyJS's bug
      // it will convert unicode escape to raw char
      // that will cause error in IE
      // because IE recognize "\uFFFF" in source code as "\uFFFD"
      MAX_CHAR=String.fromCharCode(0xFFFF);

  ranges=classify(ranges).ranges;
  var negated=[];
  if (!ranges.length) return negated;
  if (ranges[0][0]!==MIN_CHAR) ranges.unshift(MAX_CHAR);
  var hi=ranges.length-1;
  if ((ranges[hi][1] || ranges[hi][0])!==MAX_CHAR) ranges.push(MIN_CHAR);
  ranges.reduce(function (acc,r) {
    var start=succ(acc[1] || acc[0]),end=pred(r[0]);
    if (start<end) negated.push(start+end);
    if (start===end) negated.push(start);
    return r;
  });
  return negated;
}

/**
Parse simple regex style charset string like '^a-bcdf' to disjoint ranges.
Character classes like "\w\s" are not supported!
@param {String} charset  Valid regex charset [^a-z0-9_] input as "^a-z0-9_".
@return {[Range]} return sorted disjoint ranges
*/
function parseCharset(charset /*:String*/) {
  charset=charset.split('');
  var chars=[],ranges=[],
      exclude = charset[0]==='^' && charset.length > 1 && charset.shift();
  charset.forEach(function (c) {
    if (chars[0]=='-' && chars.length>1) {//chars=['-','a'],c=='z'
      if (chars[1] > c ) // z-a  is invalid
        throw new Error('Charset range out of order:'+chars[1]+'-'+c+'!');
      ranges.push(chars[1]+c);
      chars.splice(0,2);
    } else chars.unshift(c);
  });
  ranges=ranges.concat(chars);
  //convert exclude to include
  return exclude?negate(ranges):classify(ranges).ranges;
}

/**
Coalesce closed ranges.
['ac','d','ez'] will be coalesced to ['az']
@param {[Range]} ranges Sorted disjoint ranges return by `classify`.
@return {[Range]} Compressed ranges
*/
function coalesce(ranges) {
  if (!ranges.length) return [];
  var results=[ranges[0]];
  ranges.reduce(function (a,b) {
    var prev=results.length-1;
    if (a[a.length-1]===pred(b[0])) {
      return results[prev]=results[prev][0]+b[b.length-1];
    }
    results.push(b);
    return b;
  });
  return results.reduce(function (results,range) {
    if (range.length===2 && range[0]===pred(range[1])) {
      results.push(range[0]);
      results.push(range[1]);
    } else {
      results.push(range);
    }
    return results;
  },[]);
}

function chr(n) {return String.fromCharCode(n)}
function ord(c) {return c.charCodeAt(0)}
function pred(c) {return String.fromCharCode(c.charCodeAt(0)-1)}
function succ(c) {return String.fromCharCode(c.charCodeAt(0)+1)}

var printEscapeMap={
  "\n":"\\n","\t":"\\t","\f":"\\f",
  "\r":"\\r"," ":" ","\\":"\\\\"
};
// Convert string to printable,replace all control chars and unicode to hex escape
function toPrint(s,isRaw) {
  var ctrl=/[\x00-\x1F\x7F-\x9F]/,unicode=/[\u009F-\uFFFF]/;
  s=s.split('').map(function (c) {
    if (!isRaw && printEscapeMap.hasOwnProperty(c)) return printEscapeMap[c];
    else if (ctrl.test(c)) return '\\x'+ord(c).toString(16).toUpperCase();
    else if (unicode.test(c)) return '\\u'+('00'+ord(c).toString(16).toUpperCase()).slice(-4);
    return c;
  }).join('');
  return s;
}
//flatten two-dimensional array to one-dimension
function flatten2(a) {return [].concat.apply([],a)}
function repeats(s,n) {return new Array(n+1).join(s)}

function log() {
  var a=slice.call(arguments);
  Function.prototype.apply.apply(console.log,[console,a]);
}

function locals(f) {
  var src=f.toString();
  var re=/^\s+function\s+([a-zA-Z]\w+)\s*\(/mg;
  var fns=[],match;
  while (match=re.exec(src)) fns.push(match[1]);
  var methods=[],f;
  while (f=fns.pop()) methods.push(f+':'+f);
  return '{\n'+methods.join(',\n')+'\n}';
}

return {
  sortUnique:sortUnique,
  idUnique:idUnique,hashUnique:hashUnique,
  Set:Set, repeats:repeats,
  negate:negate,coalesce:coalesce,
  classify:classify,
  parseCharset:parseCharset,
  chr:chr,ord:ord,pred:pred,succ:succ,toPrint:toPrint,
  flatten2:flatten2,
  log:log,isBrowser:isBrowser,
  locals:locals
};

});

if (typeof define !== 'function') define = require('amdefine')(module);
define('NFA',['./Kit'],function (K) {

/**
A Naive NFA Implementation

Start state is always named 'start'
@param {NFAConfig|CompactNFAConfig} a
type NFAConfig = {compact:false,accepts:StateSet,trans:[Transition]}
type State = String
type StateSet = [State]
type Transition = {from:StateSet,to:StateSet,charset:Charset,action:Action,assert:Assert}
type Charset = String|[Range]
  Charset is similar to regex charset,supports negation and range but metacharacters
  Examples:
    includes: 'abc0-9','[^]'
    excludes: '^c-z0-9','^a^' //excluded 'a' and '^' two chars
    any char: '\0-\uffff'
  Or set charset to processed disjoint ranges:['ac','d','eh']
Set `charset` to empty string to enable empty move(ε-moves).

Action:
  Function(stack:Array,c:String,i:Int,state:String,inputs:String):Array
    stack: storage stack
    c: current char
    i: current index
    state: current state
    inputs: whole input string
  Optional return new stack

Only eMove transition allow `assert`
Actions and Asserts of eMove transition always execute before non-eMove transitions on current path.
Assert:
  Function(stack:Array,c:String,i:Int,state:String,inputs:String):Boolean
    Return True if assertion just success,if fail return false
    If success and need skip num chars,
      return the Int count to increase `i`,this feature is designed for backref.

Stack modifications in action only allow shift,unshift and return new stack.

NFAConfig example used to recognize numbers:{
  compact:false,accepts:'start'.
  trans:[{from:'start',to:'start',charset:'0-9'}]
}

CompactNFAConfig example,see `structure` function.
An automaton used to recognize triples:{
  compact:true,accepts:'start',
  trans:[
    ['start>start','0369'],['start>q1','147'],['start>q2','258'],
    ['q1>q1','0369'],['q1>q2','147'],['q1>start','258'],
    ['q2>q2','0369'],['q2>q1','258'],['q2>start','147'],
  ]
};

@return {
  input:Function
}
*/
function NFA(a) {
  a=a.compact?structure(a):a;
  var accepts={},i,trans=a.trans,
      // FMap={toState:Function}
      router={/*
        fromState : {
          eMove:[{to:State,action:Function,assert:Function,eMove:Bool}],
          eMoveStates:[State],// ε-move dest states
          charMove:{
            // expanded to include eMove
            Range:[{to:State,action:Function,assert:Function,eMove:Bool}],
            Char:[{to:State,action:Function,assert:Function,eMove:Bool}]
          },
          ranges:Set([Range]),
          // all trans keep original order in transitions list
          trans:[Transition]
        }
      */};

  for (i=0,n=a.accepts.length;i<n;i++) accepts[a.accepts[i]]=true; //add accept states

  var t;
  for (i=0,n=trans.length;i<n;i++) {//collect charsets
    t=trans[i];
    if (t.charset) t.ranges= typeof t.charset==='string'?K.parseCharset(t.charset):t.charset;
    else t.eMove=true;
    t.from.forEach(function(from) {
      var path=(router[from]=router[from] || {
        eMoveStates:[],eMove:[],charMove:{},trans:[],ranges:[]
      });
      if (t.eMove) path.eMoveStates=path.eMoveStates.concat(t.to);
      else path.ranges=path.ranges.concat(t.ranges);
      path.trans.push(t);
    });
  }
  var fromStates=Object.keys(router);
  fromStates.forEach(function (from) {
    var path=router[from],trans=path.trans,
        charMove=path.charMove,eMove=path.eMove,
        ranges=path.ranges;
    var cls=K.classify(ranges),rangeMap=cls.map;
    trans.forEach(function (t) {
      if (t.eMove) {
        t.to.forEach(function (toState) {
          eMove.push({to:toState,action:t.action,assert:t.assert,eMove:true});
        });
      } else {
        K.flatten2(t.ranges.map(function (r) {return rangeMap[r]})).forEach(function (r) {
          (charMove[r]=charMove[r] || []).push(t);
        });
      }
    });
    ranges=K.Set(cls.ranges.filter(function (rg) {return !!rg[1]}));//exclude single char
    path.ranges=ranges;
    // expand charMove to includes ε-move
    Object.keys(charMove).forEach(function (r) {
      var transChar=charMove[r];
      var transAll=[];
      trans.forEach(function (t) {
        t.to.forEach(function (toState) {
          if (t.eMove || ~transChar.indexOf(t)) transAll.push({to:toState,action:t.action,assert:t.assert,eMove:t.eMove});
        });
      });
      charMove[r]=transAll;
    });
    delete path.trans;
    delete path.eMoveStates;
  });

  return {
    accepts:accepts,
    router:router,
    input:input,
    assertDFA:assertDFA,
    accept:accept
  };
}

function accept(state) {
  return this.accepts.hasOwnProperty(state);
}

function assertDFA() {
  var router=this.router;
  var fromStates=Object.keys(router),path;
  for (var i=0,l=fromStates.length;i<l;i++) {
    path=router[fromStates[i]];
    if (path.eMove.length>1) {
      throw new Error("DFA Assertion Fail!\nFrom state `"+fromStates[i]+"` can goto to multi ε-move states!");
    }
    var charMove=path.charMove;
    var ranges=Object.keys(charMove);
    for (var k=0,n=ranges.length;k<n;k++) {
      var t=charMove[ranges[k]];
      if (t.length!==1) {
        K.log(charMove);
        throw new Error("DFA Assertion Fail!\nFrom state `"+fromStates[i]+"` via charset `"+ranges[k]+"` can goto to multi states!");
      }
    }
    if (ranges.length && path.eMove.length) {
      throw new Error("DFA Assertion Fail!\nFrom state `"+fromStates[i]+"` can goto extra ε-move state!");
    }
  }
  return true;
}


/**
return {
    stack:Array,
    acceptable:Boolean,
    lastIndex:Int,
    lastState:String
  }
*/
function input(s,startIndex,_debug) {
  startIndex=startIndex || 0;
  var _this=this;
  return _input(s,startIndex,'start',[],startIndex-1);
  function _input(s,startIndex,fromState,stack,lastIndex) {
    recur:do {
      var c,range,advanceIndex,lastResult;
      var path=_this.router[fromState];
      if (!path) break;
      var eMove=path.eMove,charMove=path.charMove,trans;
      if (startIndex<s.length) {
        c=s[startIndex];
        if (charMove.hasOwnProperty(c)) {
          trans=charMove[c];
        } else if (range=findRange(path.ranges,c)) {
          trans=charMove[range];
        } else {
          trans=eMove;
        }
      } else {
        trans=eMove;
      }

      var sp=stack.length,t,skip,ret,oldLastIndex=lastIndex;
      for (var j=0,n=trans.length;j<n;j++) {
        t=trans[j];
        advanceIndex=t.eMove?0:1;
        lastIndex=oldLastIndex;
        stack.splice(0,stack.length-sp);
        sp=stack.length; // backup stack length
        if (t.assert) {
          if ((skip=t.assert(stack,c,startIndex,fromState,s))===false) continue;
          // For backref skip num chars
          if (typeof skip==='number') {startIndex+=skip;lastIndex+=skip;}
        }
        if (t.action) stack=t.action(stack,c,startIndex,fromState,s) || stack;
        lastIndex=t.eMove?lastIndex:startIndex;
        _debug && K.log(c+":"+fromState+">"+t.to);
        if (j===n-1) {
          startIndex+=advanceIndex;
          fromState=t.to;
          continue recur; // Human flesh tail call optimize?
        } else {
          ret=_input(s,startIndex+advanceIndex,t.to,stack,lastIndex);
        }
        if (ret.acceptable) return ret;
        lastResult=ret;
      }
      if (lastResult) return lastResult;
      break;
    } while (true);

    return {
      stack:stack,lastIndex:lastIndex,lastState:fromState,
      acceptable:_this.accept(fromState)
    };
  }
}



/** ε-closure
return closureMap {fromState:[toState]}
eMoveMap = {fromState:{to:[State]}}
*/
function eClosure(eMoves,eMoveMap) {
  var closureMap={};
  eMoves.forEach(function (state) { // FK forEach pass extra args
    closure(state);
  });
  return closureMap;

  function closure(state,_chain) {
    if (closureMap.hasOwnProperty(state)) return closureMap[state];
    if (!eMoveMap.hasOwnProperty(state)) return false;
    _chain=_chain||[state];
    var dest=eMoveMap[state],
        queue=dest.to.slice(),
        toStates=[state],s,clos;
    while (queue.length) {
      s=queue.shift();
      if (~_chain.indexOf(s)) {
        throw new Error("Recursive ε-move:"+_chain.join(">")+">"+s+"!");
      }
      clos=closure(s,_chain);
      if (clos)  queue=clos.slice(1).concat(queue);
      toStates.push(s);
    }
    return closureMap[state]=toStates;
  }
}


function findRange(ranges,c/*:Char*/) {
  var i=ranges.indexOf(c,cmpRange);
  if (!~i) return false;
  return ranges[i];
}

function cmpRange(c,rg) {
  var head=rg[0],tail=rg[1];
  if (c>tail) return 1;
  if (c<head) return -1;
  return 0;
}

/**
Convert CompactNFAConfig to NFAConfig
@param {CompactNFAConfig} a
type CompactNFAConfig={compact:true,accepts:CompactStateSet,trans:[CompactTransition]}
type CompactStateSet = StateSet.join(",")
type CompactTransition = [CompactStateMap,Charset,Action,Assert]
type CompactStateMap = FromStateSet.join(",")+">"+ToStateSet.join(",")
*/
function structure(a) {
  a.accepts=a.accepts.split(',');
  var ts=a.trans,
      i=ts.length,t,s,from,to;
  while (i--) {
    t=ts[i];
    s=t[0].split('>');
    from=s[0].split(',');
    to=s[1].split(',');
    ts[i]={from:from,to:to,charset:t[1],action:t[2],assert:t[3]};
  }
  a.compact=false;
  return a;
}


return NFA;


});

if (typeof define !== 'function') define = require('amdefine')(module);
define('parse',['./NFA','./Kit'],function (NFA,K) {
/**
Parse Regex to AST
parse:Function(re:String)
parse.Constants
parse.exportConstants:Function
*/

var Constants={
  //Node Type Constants
  EXACT_NODE:"exact",
  CHARSET_NODE:"charset",
  CHOICE_NODE:"choice",
  GROUP_NODE:"group",
  ASSERT_NODE:"assert",
  DOT_NODE:"dot",
  BACKREF_NODE:"backref",
  EMPTY_NODE:"empty",
  //Assertion Type Constants
  AssertLookahead:"AssertLookahead",
  AssertNegativeLookahead:"AssertNegativeLookahead",
  AssertNonWordBoundary:"AssertNonWordBoundary",
  AssertWordBoundary:"AssertWordBoundary",
  AssertEnd:"AssertEnd",
  AssertBegin:"AssertBegin"
};

/**
AST:
  Node = { // Base Node interface
    type:NodeType,      // Node type string
    raw:String,         // Raw regex string
    repeat:{
      min:Int,max:Int,  // Repeat times. [min,max] means "{min,max}".
                        // Set max=Infinity forms a "{min,}" range
                        // Set max=undefined forms a "{min}" range
      nonGreedy:Boolean // If this repeat is non-greedy,viz. had a "?" quantifier
    },
    indices:[Int,Int]   // Raw string in original regex index range [start,end)
                        // You can use regexStr.slice(start,end) to retrieve node.raw string
  }

  NodeType = exact|dot|charset|choice|empty|group|assert|backref

  ExactNode = { // Literal match chars string
    type:"exact",
    chars:"c",
    raw:"c{1,2}"   // When repeat or escape,raw will diff from chars
  }
  DotNode = {type:"dot"} //viz. "." , dot match any char but newline "\n\r"

  // Because of IgnoreCase flag,
  // The client code need to compute disjoint ranges itself.
  CharsetNode = {
    type:"charset",
    exclude:Boolean,   // True only if it is "[^abc]" form
    classes:[Char],  // Named character classes. e.g. [\d].
                       // All names: d(Digit),D(Non-digit),w,W,s,S
    chars:String,      // Literal chars. e.g. [abc] repr as 'abc'
    ranges:[Range]     // Range: a-z repr as 'az'
  }

  ChoiceNode = {
    type:"choice",
    branches:[[Node]] // Choice more branches,e.g. /a|b|c/
  }

  EmptyNode = {  // This node will match any input,include empty string
    type:"empty" //new RegExp("") will give an empty node. /a|/ will give branches with an empty node
  }

  GroupNode = {
    type:"group",
    nonCapture:false, // true means:"(?:abc)",default is false
    num:Int, // If capture is true.It is group's int index(>=1).
    endParenIndex:Int, // /(a)+/ will generate only one node,so indices is [0,4],endParenIndex is 3
    sub:[Node]   // Sub pattern nodes
  }

  AssertNode = {
    type:"assert",
    assertionType:String, //See Assertion Type Constants
    sub:[Node]            //Optional,\b \B ^ $ Assertion this property is empty
  }
  Only AssertLookahead,AssertNegativeLookahead has `sub` property
  "(?=(abc))" repr as {
    type:"assert", assertionType:AssertLookahead,
    sub:[{
      type:"group",
      sub:[{type:"exact",raw:"abc"}]
    }]
  }

  BackrefNode = {
    type:"backref",
    num:Int     // Back references index.Correspond to group.num
  }

*/

function exportConstants() {
  var code=Object.keys(Constants).map(function (k) {
    return k+"="+JSON.stringify(Constants[k]);
  }).join(";");
  var Global=(function () {
    return this;
  })();
  Global.eval(code);
}
exportConstants();

function AST(a) {
  this.raw=a.raw;
  this.tree=a.tree;
  this.groupCount=a.groupCount;
}
/**
@param {Function} f   Visitor function accept node as one argument.
@param {String} nodeType Give the node type you want to visit,or omitted to visit all
*/
AST.prototype.traverse=function (f,nodeType) {
  travel(this.tree,f);
  function travel(stack,f) {
    stack.forEach(function (node) {
      if (!nodeType || node.type===nodeType) f(node);
      if (node.sub) travel(node.sub,f);
      else if (node.branches) node.branches.forEach(function (b) {travel(b,f)});
    });
  }
};


var G_DEBUG;
/**
@param {String}  re  input regex as string
@param {Object} [options]
  @option {Boolean} options.debug   If enable debug log
  @option {Boolean} options.strict  If enable strict mode
@return {Object}
{
  raw:String,     // original re
  groupCount:Int, //Total group count
  tree:Array      // AST Tree Stack
}
*/
function parse(re,_debug) {
  G_DEBUG=_debug;
  var parser=getNFAParser();

  var ret,stack,lastState;
  ret=parser.input(re,0,_debug);
  stack=ret.stack;
  stack=actions.endChoice(stack); // e.g. /a|b/
  lastState=ret.lastState;
  var valid=ret.acceptable && ret.lastIndex===re.length-1;//just syntax valid regex
  if (!valid) {
    var error;
    switch (lastState) {
      case 'charsetRangeEndWithNullChar':
        error={
          type:'CharsetRangeEndWithNullChar',
          message:"Charset range end with NUL char does not make sense!\n"+
                      "Because [a-\\0] is not a valid range.\n"+
                      "And [\\0-\\0] should be rewritten into [\\0].",
        };
        break;
      case 'repeatErrorFinal':
        error={
          type:'NothingRepeat',
          message:"Nothing to repeat!"
        };
        break;
      case 'digitFollowNullError':
        error={
          type:'DigitFollowNullError',
          message:"The '\\0' represents the <NUL> char and cannot be followed by a decimal digit!"
        };
        break;
      case 'charsetRangeEndClass':
        error={
          type:'CharsetRangeEndClass',
          message:'Charset range ends with class such as "\\w\\W\\d\\D\\s\\S" is invalid!'
        };
        break;
      case 'charsetOctEscape':
        error={
          type:'DecimalEscape',
          message:'Decimal escape appears in charset is invalid.Because it can\'t be explained as  backreference.And octal escape is deprecated!'
        };
        break;
      default:
        if (lastState.indexOf('charset')===0) {
          error={
            type:'UnclosedCharset',
            message:'Unterminated character class!'
          };
        } else if (re[ret.lastIndex]===')') {
          error={
            type:'UnmatchedParen',
            message:'Unmatched end parenthesis!'
          };
        } else {
          error={
            type:'UnexpectedChar',
            message:'Unexpected char!'
          }
          ret.lastIndex++;
        }
    }
    if (error) {
      error.lastIndex=ret.lastIndex;
      error.astStack=ret.stack;
      error.lastState=lastState;
      throw new RegexSyntaxError(error);
    }
  }

  if (stack._parentGroup) {
    throw new RegexSyntaxError({
      type:"UnterminatedGroup",
      message:"Unterminated group!",
      lastIndex:stack._parentGroup.indices[0],
      lastState:lastState,
      astStack:stack
    });
  }

  if (valid) {
    var groupCount=stack.groupCounter?stack.groupCounter.i:0;
    delete stack.groupCounter;
    var ast=new AST({
      raw:re,
      groupCount:groupCount,
      tree:stack
    });
    _fixNodes(stack,re,re.length);
    // Check charset ranges out of order error.(Because of charsetRangeEndEscape)
    ast.traverse(_checkCharsetRange,CHARSET_NODE);
    // Check any repeats after assertion. e.g. /a(?=b)+/ doesn't make sense.
    ast.traverse(_checkRepeat,ASSERT_NODE);
    _coalesceExactNode(stack);
    G_DEBUG=false;
    return ast;
  }



}

parse.Constants=Constants;
parse.exportConstants=exportConstants;
parse.RegexSyntaxError=RegexSyntaxError;
parse.getNFAParser=getNFAParser;

var _NFAParser;
function getNFAParser() {
  if (!_NFAParser) {
    _NFAParser=NFA(config,G_DEBUG);
  }
  return _NFAParser;
}

function _set(obj,prop,value) {
  Object.defineProperty(obj,prop,{
    value:value,enumerable:G_DEBUG,writable:true,configurable:true
  });
}

function _coalesceExactNode(stack) {
  var prev=stack[0];
  for (var i=1,j=1,l=stack.length,node;i<l;i++) {
    node=stack[i];
    if (node.type===EXACT_NODE) {
      if (prev.type===EXACT_NODE && !prev.repeat && !node.repeat) {
        prev.indices[1]=node.indices[1];
        prev.raw+=node.raw;
        prev.chars+=node.chars;
        continue;
      }
    } else if (node.sub) _coalesceExactNode(node.sub);
    else if (node.branches) node.branches.map(_coalesceExactNode);
    stack[j++]=node;
    prev=node;
  }
  if (prev) stack.length=j;
}

function _fixNodes(stack,re,endIndex) {
  if (!stack.length) {
    stack.push({type:EMPTY_NODE,indices:[endIndex,endIndex]});
    return;
  }
  stack.reduce(function (endIndex,node) {
    node.indices.push(endIndex);
    node.raw=re.slice(node.indices[0],endIndex);
    if (node.type===GROUP_NODE || (node.type===ASSERT_NODE && node.sub)) {
      _fixNodes(node.sub,re,node.endParenIndex);
    } else if (node.type===CHOICE_NODE) {
      node.branches.reduce(function (endIndex,branch) {
        _fixNodes(branch,re,endIndex);
        var head=branch[0]; // Reversed,so branch[0] is head.Dammit mystic code
        return (head?head.indices[0]:endIndex)-1; // skip '|'
      },endIndex);
      node.branches.reverse();
    } else if (node.type===EXACT_NODE) {
      node.chars = node.chars || node.raw;
    }
    return node.indices[0];
  },endIndex);
  stack.reverse();
}

function _checkRepeat(node) {
  if (node.repeat) {
    var astype = node.assertionType;
    var msg = 'Nothing to repeat! Repeat after assertion doesn\'t make sense!';
    if (astype === 'AssertLookahead'  || astype === 'AssertNegativeLookahead' ) {
      var assertifier = astype === 'AssertLookahead' ? '?=' : '?!';
      var pattern = '('+assertifier+'b)';
      msg += '\n/a'+pattern+'+/、/a'+pattern+'{1,n}/ are the same as /a'+pattern+'/。\n' +
              '/a'+pattern+'*/、/a'+pattern+'{0,n}/、/a'+pattern+'?/ are the same as /a/。';
    }

    throw new RegexSyntaxError({
      type:'NothingRepeat',
      lastIndex:node.indices[1]-1,
      message: msg
    })
  }
}

//check charset ranges out of order error.(Because of charsetRangeEndEscape)
// [z-\u54] had to defer check
function _checkCharsetRange(node) {
  node.ranges=K.sortUnique(node.ranges.map(function (range) {
    if (range[0]>range[1]) {
      throw new RegexSyntaxError({
        type:"OutOfOrder",
        lastIndex:range.lastIndex,
        message:"Range ["+range.join('-')+"] out of order in character class!"
      });
    }
    return range.join('');
  }));
}

function RegexSyntaxError(e) {
  this.name="RegexSyntaxError";
  this.type=e.type;
  this.lastIndex=e.lastIndex;
  this.lastState=e.lastState;
  this.astStack=e.astStack;
  this.message=e.message;
  Object.defineProperty(this,'stack',{
    value:new Error(e.message).stack,enumerable:false
  });
}
RegexSyntaxError.prototype.toString=function () {
  return this.name+' '+this.type+':'+this.message;
};



var escapeCharMap={n:"\n",r:"\r",t:"\t",v:"\v",f:"\f"};

// All indices' end will be fixed later by stack[i].indices.push(stack[i+1].indices[0])
// All raw string filled later by node.raw=s.slice(node.indices[0],node.indices[1])
// All nodes are unshift to stack, so they're reverse order.
var actions=(function _() {

  function exact(stack,c,i) { //any literal string.
    // ExactNode.chars will be filled later (than raw)
    // Escape actions and repeat actions will fill node.chars
    // node.chars = node.chars || node.raw
    var last=stack[0];
    if (!last || last.type!=EXACT_NODE || last.repeat || last.chars)
      stack.unshift({type:EXACT_NODE, indices:[i]});
  }
  function dot(stack,c,i) { //   /./
    stack.unshift({type:DOT_NODE,indices:[i]});
  }
  function nullChar(stack,c,i) {
    c="\0";
    exact(stack,c,i);
  }
  function assertBegin(stack,c,i) { //  /^/
    stack.unshift({
      type:ASSERT_NODE,
      indices:[i],
      assertionType:AssertBegin
    });
  }
  function assertEnd(stack,c,i,state,s) {
    stack.unshift({
      type:ASSERT_NODE,
      indices:[i],
      assertionType:AssertEnd
    });
  }
  function assertWordBoundary(stack,c,i) {//\b \B assertion
    stack.unshift({
      type:ASSERT_NODE,
      indices:[i-1],
      assertionType: c=='b'?AssertWordBoundary:AssertNonWordBoundary
    });
  }
  function repeatnStart(stack,c,i) { //  /a{/
    //Treat repeatn as normal exact node,do transfer in repeatnEnd action.
    //Because /a{+/ is valid.
    var last=stack[0];
    if (last.type===EXACT_NODE) {
      return;
    } else { // '[a-z]{' is valid
      stack.unshift({type:EXACT_NODE,indices:[i]});
    }
  }

  function repeatnComma(stack,c,i) { // /a{n,}/
    var last=stack[0];
    _set(last,'_commaIndex',i);
  }
  function repeatnEnd(stack,c,i,state,s) { // /a{n,m}/
    var last=stack[0],charEndIndex=s.lastIndexOf('{',i);
    var min=parseInt(s.slice(charEndIndex+1,last._commaIndex || i),10);
    var max;
    if (!last._commaIndex) { // /a{n}/
      max=min;
    } else {
      if (last._commaIndex+1==i) { // /a{n,}/
        max=Infinity;
      } else {
        max=parseInt(s.slice(last._commaIndex+1,i),10);
      }
      if (max < min) {
        throw new RegexSyntaxError({
          type:"OutOfOrder",lastState:state,
          lastIndex:i,astStack:stack,
          message:"Numbers out of order in {} quantifier!"
        });
      }
      delete last._commaIndex;
    }
    if (last.indices[0]>=charEndIndex) {
      stack.shift();
    }
    _repeat(stack,min,max,charEndIndex,s);
  }
  function repeat0(stack,c,i,state,s) { _repeat(stack,0,Infinity,i,s) } // e.g. /a*/
  function repeat01(stack,c,i,state,s) { _repeat(stack,0,1,i,s) } // e.g. /a?/
  function repeat1(stack,c,i,state,s) { _repeat(stack,1,Infinity,i,s) } // e.g. /a+/
  function _repeat(stack,min,max,charEndIndex,s) {
    var last=stack[0],repeat={min:min,max:max,nonGreedy:false},
        charIndex=charEndIndex-1;
    if (last.chars && last.chars.length===1) charIndex=last.indices[0];
    if (last.type===EXACT_NODE) { // exact node only repeat last char
      var a={
        type:EXACT_NODE,
        repeat:repeat,chars:last.chars?last.chars:s[charIndex],
        indices:[charIndex]
      };
      if (last.indices[0]===charIndex) stack.shift(); // e.g. /a{n}/ should be only single node
      stack.unshift(a);
    } else {
      last.repeat=repeat;
    }
    _set(repeat,'beginIndex',charEndIndex-stack[0].indices[0]);
  }
  function repeatNonGreedy(stack) { stack[0].repeat.nonGreedy=true}
  function normalEscape(stack,c,i) {
    if (escapeCharMap.hasOwnProperty(c)) c=escapeCharMap[c];
    stack.unshift({
      type:EXACT_NODE,chars:c,indices:[i-1]
    });
  }
  function charClassEscape(stack,c,i) {
    stack.unshift({
      type:CHARSET_NODE,indices:[i-1],chars:'',ranges:[],
      classes:[c],exclude:false
    });
  }
  function hexEscape(stack,c,i,state,s) {
    c=String.fromCharCode(parseInt(s[i-1]+c,16));
    stack.unshift({
      type:EXACT_NODE, chars:c,
      indices:[i-3] // \xAA length-1
    });
  }
  function unicodeEscape(stack,c,i,state,s) {
    c=String.fromCharCode(parseInt(s.slice(i-3,i+1),16));
    stack.unshift({
      type:EXACT_NODE, chars:c,
      indices:[i-5] // \u5409 length-1
    });
  }
  function groupStart(stack,c,i) {
    var counter=(stack.groupCounter=(stack.groupCounter || {i:0}));
    counter.i++;
    var group={
      type:GROUP_NODE,
      num: counter.i,
      sub:[], indices:[i],
      _parentStack:stack // Used to restore current stack when group end,viz. encounters ")"
    };
    stack=group.sub;
    _set(stack,'_parentGroup',group);
    stack.groupCounter=counter; //keep groupCounter persist and ref modifiable
    return stack;
  }
  function groupNonCapture(stack) { // /(?:)/
    var group=stack._parentGroup
    group.nonCapture=true;
    group.num=undefined;
    stack.groupCounter.i--;
  }
  function groupToAssertion(stack,c,i) { // Convert /(?!)/,/(?=)/ to AssertNode
    var group=stack._parentGroup;
    group.type=ASSERT_NODE;
    group.assertionType= c=='=' ? AssertLookahead : AssertNegativeLookahead ;
    // Caveat!!! Assertion group no need to capture
    group.num=undefined;
    stack.groupCounter.i--;
  }
  function groupEnd(stack,c,i,state,s) {
    stack=endChoice(stack); // restore group's stack from choice
    var group=stack._parentGroup;
    if (!group) {
      throw new RegexSyntaxError({
        type:'UnexpectedChar',
        lastIndex:i,
        lastState:state,
        astStack:stack,
        message:"Unexpected end parenthesis!"
      });
    }
    delete stack._parentGroup; // Be generous,I don't care sparse object performance.
    delete stack.groupCounter; // clean
    stack=group._parentStack;  // restore stack
    delete group._parentStack;
    stack.unshift(group);
    group.endParenIndex=i;
    return stack;
  }
  function choice(stack,c,i) { // encounters "|"
    //replace current stack with choices new branch stack
    var newStack=[],choice;
    if (stack._parentChoice) {
      choice=stack._parentChoice;
      choice.branches.unshift(newStack);
      _set(newStack,'_parentChoice',choice);
      _set(newStack,'_parentGroup',choice);
      newStack.groupCounter=stack.groupCounter; // keep track
      delete stack._parentChoice;
      delete stack.groupCounter;  // This stack is in choice.branches,so clean it
    } else { //  "/(a|)/" ,create new ChoiceNode
      var first=stack[stack.length-1]; // Because of stack is reverse order
      choice={
        type:CHOICE_NODE,indices:[(first?first.indices[0]:i-1)],
        branches:[]
      };
      _set(choice,'_parentStack',stack);
      choice.branches.unshift(stack.slice()); // contents before "|"
      stack.length=0;
      /* e.g. "/(a|b)/" is {
        type:'group',sub:[
          {type:'choice',branches:[
              [{type:'exact',chars:'a'}],
              [{type:'exact',chars:'b'}]
          ]}]}*/
      stack.unshift(choice); // must not clean groupCounter

      newStack.groupCounter=stack.groupCounter;
      _set(newStack,'_parentChoice',choice);
      _set(newStack,'_parentGroup',choice);
      choice.branches.unshift(newStack);
    }
    return newStack;
  }
  //if current stack is a choice's branch,return the original parent stack
  function endChoice(stack) {
    if (stack._parentChoice) {
      var choice=stack._parentChoice;
      delete stack._parentChoice;
      delete stack._parentGroup;
      delete stack.groupCounter;
      var parentStack=choice._parentStack;
      delete choice._parentStack;
      return parentStack;
    }
    return stack;
  }
  function charsetStart(stack,c,i) {
    stack.unshift({
      type:CHARSET_NODE,indices:[i],
      classes:[],ranges:[],chars:''
    });
  }
  function charsetExclude(stack) {stack[0].exclude=true}
  function charsetContent(stack,c,i) {stack[0].chars+=c}
  function charsetNormalEscape(stack,c,i) {
    if (escapeCharMap.hasOwnProperty(c)) c=escapeCharMap[c];
    stack[0].chars+=c;
  }
  function charsetNullChar(stack,c,i) {
    stack[0].chars+="\0";
  }
  function charsetClassEscape(stack,c) {
    stack[0].classes.push(c);
  }
  function charsetHexEscape(stack,c,i,state,s) {
    var last=stack[0];
    c=String.fromCharCode(parseInt(last.chars.slice(-1)+c,16));
    last.chars=last.chars.slice(0,-2); // also remove "xA"
    last.chars+=c;
  }
  function charsetUnicodeEscape(stack,c,i,state,s) {
    var last=stack[0];
    c=String.fromCharCode(parseInt(last.chars.slice(-3)+c,16));
    last.chars=last.chars.slice(0,-4); //remove "uABC"
    last.chars+=c;
  }

  function charsetRangeEnd(stack,c,i,state,s) {
    var charset=stack[0];
    var range=charset.chars.slice(-2);
    range=[range[0],c];
    range.lastIndex=i;
    charset.ranges.push(range);
    charset.chars=charset.chars.slice(0,-2);
  }
  function charsetRangeEndNormalEscape(stack,c) {
    if (escapeCharMap.hasOwnProperty(c)) c=escapeCharMap[c];
    charsetRangeEnd.apply(this,arguments);
  }
  // [\x30-\x78] first repr as {ranges:['\x30','x']}
  // [\u0000-\u4567] first repr as {ranges:['\0','u']}
  // If escape sequences are valid then replace range end with current char
  // stack[0].chars did not contain 'u' or 'x'
  function charsetRangeEndUnicodeEscape(stack,c,i) {
    var charset=stack[0];
    var code=charset.chars.slice(-3)+c;
    charset.chars=charset.chars.slice(0,-3); // So just remove previous three,no 'u'
    var range=charset.ranges.pop();
    c=String.fromCharCode(parseInt(code,16));
    range=[range[0],c];
    range.lastIndex=i;
    charset.ranges.push(range);
  }
  function charsetRangeEndHexEscape(stack,c,i) {
    var charset=stack[0];
    var code=charset.chars.slice(-1)+c;
    charset.chars=charset.chars.slice(0,-1); // last.chars does'nt contain 'x'
    var range=charset.ranges.pop();
    c=String.fromCharCode(parseInt(code,16));
    range=[range[0],c];
    range.lastIndex=i;
    charset.ranges.push(range);
  }


  /* Caveat!!!
  See:https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/RegExp
       \0  Matches a NUL character. Do not follow this with another digit.
  ECMA-262 Standard: 15.10.2.11 DecimalEscape
  NOTE
    If \ is followed by a decimal number n whose first digit is not 0, then the escape sequence is considered to be
    a backreference. It is an error if n is greater than the total number of left capturing parentheses in the entire regular
    expression. \0 represents the <NUL> character and cannot be followed by a decimal digit.

  But in both Chrome and Firefox, /\077/ matches "\077",e.g. String.fromCharCode(parseInt("77",8))
    /(g)\1/ matches "gg",it's OK.
    But /(g)\14/ matches "g\14","\14" is String.fromCharCode(parseInt("14",8))
    And /(g)\1456/ matches "g\145"+"6",/(g)\19/ matches "g\1"+"9". Who knows WTF?
    Considering that ECMAScript StrictMode did not support OctEscape,
    I'm not going to implement OctEscape.

  I will make it conform the Standard.(Also keep code simple)
  */
  function backref(stack,c,i,state) {
    var last=stack[0],n=parseInt(c,10),
        isFirstNum=state==='escape',
        counter=stack.groupCounter,
        cn=(counter && counter.i) || 0;

    if (!isFirstNum) { //previous node must be backref node
      n=parseInt(last.num+""+n,10);
    } else {
      last={type:BACKREF_NODE,indices:[i-1]};
      stack.unshift(last);
    }
    if (n>cn) {
      throw new RegexSyntaxError({
        type:'InvalidBackReference',lastIndex:i,astStack:stack,lastState:state,
        message:'Back reference number('+n+') greater than current groups count('+cn+').'
      });
    } else if (_isRecursive(n,stack)) {
      throw new RegexSyntaxError({
        type:'InvalidBackReference',lastIndex:i,astStack:stack,lastState:state,
        message:'Recursive back reference in group ('+n+') itself.'
      });
    }
    last.num=n;

    function _isRecursive(n,stack) {
      if (!stack._parentGroup) return false;
      if (stack._parentGroup.num==n) return n;
      return _isRecursive(n,stack._parentGroup._parentStack);
    }
  }

  //console.log(K.locals(_));

  return {
    exact:exact,dot:dot,nullChar:nullChar,assertBegin:assertBegin,
    assertEnd:assertEnd,assertWordBoundary:assertWordBoundary,
    repeatnStart:repeatnStart,repeatnComma:repeatnComma,repeatNonGreedy:repeatNonGreedy,
    repeatnEnd:repeatnEnd,repeat1:repeat1,repeat01:repeat01,repeat0:repeat0,
    charClassEscape:charClassEscape,normalEscape:normalEscape,
    unicodeEscape:unicodeEscape,hexEscape:hexEscape,charClassEscape:charClassEscape,
    groupStart:groupStart,groupNonCapture:groupNonCapture,backref:backref,
    groupToAssertion:groupToAssertion,groupEnd:groupEnd,
    choice:choice,endChoice:endChoice,
    charsetStart:charsetStart,charsetExclude:charsetExclude,
    charsetContent:charsetContent,charsetNullChar:charsetNullChar,
    charsetClassEscape:charsetClassEscape,
    charsetHexEscape:charsetHexEscape,
    charsetUnicodeEscape:charsetUnicodeEscape,
    charsetRangeEnd:charsetRangeEnd,charsetNormalEscape:charsetNormalEscape,
    charsetRangeEndNormalEscape:charsetRangeEndNormalEscape,
    charsetRangeEndUnicodeEscape:charsetRangeEndUnicodeEscape,
    charsetRangeEndHexEscape:charsetRangeEndHexEscape
  };

})();

var digit='0-9';
var hexDigit='0-9a-fA-F';

//EX,It is an exclusive charset
var exactEXCharset='^+*?^$.|(){[\\';

var charClassEscape='dDwWsS';
var unicodeEscape='u';
var hexEscape='x';
//var octDigit='0-7';
//var octEscape='0-7'; Never TODO. JavaScript doesn't support string OctEscape in strict mode.

// In charset,\b\B means "\b","\B",not word boundary
// NULL Escape followed digit should throw error
var normalEscapeInCharsetEX='^'+charClassEscape+unicodeEscape+hexEscape+'0-9';

// 'rntvf\\' escape ,others return raw
// Also need exclude \b\B assertion and backref
var normalEscapeEX=normalEscapeInCharsetEX+'bB1-9';

//var controlEscape;//Never TODO.Same reason as OctEscape.


var repeatnStates='repeatnStart,repeatn_1,repeatn_2,repeatnErrorStart,repeatnError_1,repeatnError_2';
var hexEscapeStates='hexEscape1,hexEscape2';
var unicodeEscapeStates='unicodeEscape1,unicodeEscape2,unicodeEscape3,unicodeEscape4';

var allHexEscapeStates=hexEscapeStates+','+unicodeEscapeStates;

var charsetIncompleteEscapeStates='charsetUnicodeEscape1,charsetUnicodeEscape2,charsetUnicodeEscape3,charsetUnicodeEscape4,charsetHexEscape1,charsetHexEscape2';

// [a-\u1z] means [a-u1z], [a-\u-z] means [-za-u]
// [a-\u0-9] means [a-u0-9]. WTF!
var charsetRangeEndIncompleteEscapeFirstStates='charsetRangeEndUnicodeEscape1,charsetRangeEndHexEscape1';

var charsetRangeEndIncompleteEscapeRemainStates='charsetRangeEndUnicodeEscape2,charsetRangeEndUnicodeEscape3,charsetRangeEndUnicodeEscape4,charsetRangeEndHexEscape2';

var charsetRangeEndIncompleteEscapeStates=charsetRangeEndIncompleteEscapeFirstStates+','+charsetRangeEndIncompleteEscapeRemainStates;

var config={
  compact:true,
  accepts:'start,begin,end,repeat0,repeat1,exact,repeatn,repeat01,repeatNonGreedy,choice,'+(repeatnStates+',nullChar,digitBackref,'+unicodeEscapeStates+','+hexEscapeStates),
  trans:[
    ['start,begin,end,exact,repeatNonGreedy,repeat0,repeat1,repeat01,groupStart,groupQualifiedStart,choice,repeatn>exact',exactEXCharset,actions.exact],
    // e.g. /\u54/ means /u54/
    [allHexEscapeStates+'>exact',exactEXCharset+hexDigit,actions.exact],
    // e.g. /\0abc/ is exact "\0abc",but /\012/ is an error
    ['nullChar>exact',exactEXCharset+digit,actions.exact],
    //[(repeatnStates+',nullChar,digitBackref,'+unicodeEscapeStates+','+hexEscapeStates)+'>exact',exactEXCharset+'']
    [(repeatnStates+',nullChar,digitBackref,'+unicodeEscapeStates+','+hexEscapeStates)+',start,begin,end,exact,repeatNonGreedy,repeat0,repeat1,repeat01,groupStart,groupQualifiedStart,choice,repeatn>exact','.',actions.dot],
    ['start,groupStart,groupQualifiedStart,end,begin,exact,repeat0,repeat1,repeat01,repeatn,repeatNonGreedy,choice,'+repeatnStates+',nullChar,digitBackref,'+unicodeEscapeStates+','+hexEscapeStates+'>begin','^',actions.assertBegin],
    [(repeatnStates+',nullChar,digitBackref,'+unicodeEscapeStates+','+hexEscapeStates)+',exact>repeatnStart','{',actions.repeatnStart],
    ['start,begin,end,groupQualifiedStart,groupStart,repeat0,repeat1,repeatn,repeat01,repeatNonGreedy,choice>repeatnErrorStart','{',actions.exact],//No repeat,treat as exact char e.g. /{/,/^{/,/a|{/
    ['repeatnStart>repeatn_1',digit,actions.exact], // Now maybe /a{1/
    ['repeatn_1>repeatn_1',digit,actions.exact], // Could be /a{11/
    ['repeatn_1>repeatn_2',',',actions.repeatnComma], // Now maybe /a{1,/
    ['repeatn_2>repeatn_2',digit,actions.exact], // Now maybe /a{1,3/
    ['repeatn_1,repeatn_2>repeatn','}',actions.repeatnEnd], //Totally end /a{1,3}/
    //Repeat treat as exact chars
    ['repeatnStart,repeatnErrorStart>exact','}',actions.exact], // e.g. /{}/,/a{}/
    //Add exclusion 0-9 and "}", e.g. /a{a/,/a{,/ are valid exact match
    ['repeatnStart,repeatnErrorStart>exact',exactEXCharset+'0-9}',actions.exact],

    // "/{}/" is valid exact match but /{1,2}/ is error repeat.
    // So must track it with states repeatnError_1,repeatnError_2
    ['repeatnErrorStart>repeatnError_1',digit,actions.exact],
    ['repeatnError_1>repeatnError_1',digit,actions.exact],
    ['repeatnError_1>repeatnError_2',',',actions.exact],
    ['repeatnError_2>repeatnError_2',digit,actions.exact],
    // repeatErrorFinal is an unacceptable state. Nothing to repeat error should be throwed
    ['repeatnError_2,repeatnError_1>repeatErrorFinal','}'],

    // "/a{2a/" and "/{2a/" are valid exact match
    ['repeatn_1,repeatnError_1>exact',exactEXCharset+digit+',}',actions.exact],
    // "/a{2,a/" and "/{3,a" are valid
    ['repeatn_2,repeatnError_2>exact',exactEXCharset+digit+'}',actions.exact],

    ['exact,'+(repeatnStates+',nullChar,digitBackref,'+unicodeEscapeStates+','+hexEscapeStates)+'>repeat0','*',actions.repeat0],
    ['exact,'+(repeatnStates+',nullChar,digitBackref,'+unicodeEscapeStates+','+hexEscapeStates)+'>repeat1','+',actions.repeat1],
    ['exact,'+(repeatnStates+',nullChar,digitBackref,'+unicodeEscapeStates+','+hexEscapeStates)+'>repeat01','?',actions.repeat01],
    ['choice>repeatErrorFinal','*+?'],
    ['repeat0,repeat1,repeat01,repeatn>repeatNonGreedy','?',actions.repeatNonGreedy],
    ['repeat0,repeat1,repeat01,repeatn>repeatErrorFinal','+*'],

    // Escape
    ['start,begin,end,groupStart,groupQualifiedStart,exact,repeatNonGreedy,repeat0,repeat1,repeat01,repeatn,choice,'+(repeatnStates+',nullChar,digitBackref,'+unicodeEscapeStates+','+hexEscapeStates)+'>escape','\\'],
    ['escape>nullChar','0',actions.nullChar],
    ['nullChar>digitFollowNullError','0-9'], // "/\0123/" is invalid in standard
    ['escape>exact',normalEscapeEX,actions.normalEscape],
    ['escape>exact','bB',actions.assertWordBoundary],
    ['escape>exact',charClassEscape,actions.charClassEscape],
    ['escape>unicodeEscape1',unicodeEscape,actions.exact],
    ['unicodeEscape1>unicodeEscape2',hexDigit,actions.exact],
    ['unicodeEscape2>unicodeEscape3',hexDigit,actions.exact],
    ['unicodeEscape3>unicodeEscape4',hexDigit,actions.exact],
    ['unicodeEscape4>exact',hexDigit,actions.unicodeEscape],
    ['escape>hexEscape1',hexEscape,actions.exact],
    ['hexEscape1>hexEscape2',hexDigit,actions.exact],
    ['hexEscape2>exact',hexDigit,actions.hexEscape],

    ['escape>digitBackref','1-9',actions.backref],
    ['digitBackref>digitBackref',digit,actions.backref],
    ['digitBackref>exact',exactEXCharset+digit,actions.exact],

    // Group start
    ['exact,begin,end,repeat0,repeat1,repeat01,repeatn,repeatNonGreedy,start,groupStart,groupQualifiedStart,choice,'+(repeatnStates+',nullChar,digitBackref,'+unicodeEscapeStates+','+hexEscapeStates)+'>groupStart','(',actions.groupStart],
    ['groupStart>groupQualify','?'],
    ['groupQualify>groupQualifiedStart',':',actions.groupNonCapture],//group non-capturing
    ['groupQualify>groupQualifiedStart','=',actions.groupToAssertion],//group positive lookahead
    ['groupQualify>groupQualifiedStart','!',actions.groupToAssertion],//group negative lookahead
    [(repeatnStates+',nullChar,digitBackref,'+unicodeEscapeStates+','+hexEscapeStates)+',groupStart,groupQualifiedStart,begin,end,exact,repeat1,repeat0,repeat01,repeatn,repeatNonGreedy,choice>exact',')',actions.groupEnd],//group end

    //choice
    ['start,begin,end,groupStart,groupQualifiedStart,exact,repeat0,repeat1,repeat01,repeatn,repeatNonGreedy,choice,'+(repeatnStates+',nullChar,digitBackref,'+unicodeEscapeStates+','+hexEscapeStates)+'>choice','|', actions.choice],

    ['start,groupStart,groupQualifiedStart,begin,exact,repeat0,repeat1,repeat01,repeatn,repeatNonGreedy,choice,'+(repeatnStates+',nullChar,digitBackref,'+unicodeEscapeStates+','+hexEscapeStates)+'>end','$',actions.assertEnd],

    // Charset [HA-HO]
    ['exact,begin,end,repeat0,repeat1,repeat01,repeatn,repeatNonGreedy,groupQualifiedStart,groupStart,start,choice,'+(repeatnStates+',nullChar,digitBackref,'+unicodeEscapeStates+','+hexEscapeStates)+'>charsetStart','[',actions.charsetStart],
    ['charsetStart>charsetExclude','^',actions.charsetExclude],
    ['charsetStart>charsetContent','^\\]^',actions.charsetContent],
    ['charsetExclude>charsetContent','^\\]',actions.charsetContent], // "[^^]" is valid
    ['charsetContent,charsetClass>charsetContent','^\\]-',actions.charsetContent],
    ['charsetClass>charsetContent','-',actions.charsetContent],


    // Charset Escape
    [charsetIncompleteEscapeStates+
      ',charsetStart,charsetContent,charsetClass,charsetExclude,charsetRangeEnd>charsetEscape','\\'],
    ['charsetEscape>charsetContent',normalEscapeInCharsetEX,actions.charsetNormalEscape],
    ['charsetEscape>charsetNullChar','0',actions.charsetNullChar],

    //Didn't allow oct escape
    ['charsetEscape>charsetOctEscape','1-9'],
    ['charsetRangeEndEscape>charsetOctEscape','1-9'],
    //Treat /[\012]/ as an error
    ['charsetNullChar>digitFollowNullError',digit],
    // Only null char not followed by digit is valid
    ['charsetNullChar>charsetContent','^0-9\\]-',actions.charsetContent],

    // charsetClass state should diff from charsetContent
    // Because /[\s-a]/ means /[-a\s]/
    ['charsetEscape>charsetClass',charClassEscape,actions.charsetClassEscape],

    ['charsetEscape>charsetUnicodeEscape1',unicodeEscape,actions.charsetContent],
    ['charsetUnicodeEscape1>charsetUnicodeEscape2',hexDigit,actions.charsetContent],
    ['charsetUnicodeEscape2>charsetUnicodeEscape3',hexDigit,actions.charsetContent],
    ['charsetUnicodeEscape3>charsetUnicodeEscape4',hexDigit,actions.charsetContent],
    ['charsetUnicodeEscape4>charsetContent',hexDigit,actions.charsetUnicodeEscape],
    ['charsetEscape>charsetHexEscape1',hexEscape,actions.charsetContent],
    ['charsetHexEscape1>charsetHexEscape2',hexDigit,actions.charsetContent],
    ['charsetHexEscape2>charsetContent',hexDigit,actions.charsetHexEscape],

    //  [a\u54-9] should be treat as [4-9au5]
    [charsetIncompleteEscapeStates+'>charsetContent','^\\]'+hexDigit+'-',actions.charsetContent],

    [charsetIncompleteEscapeStates+',charsetNullChar,charsetContent>charsetRangeStart','-',actions.charsetContent],
    ['charsetRangeStart>charsetRangeEnd','^\\]',actions.charsetRangeEnd],
    ['charsetRangeEnd>charsetContent','^\\]',actions.charsetContent],


    // Some troubles here, [0-\x39] means [0-9]
    ['charsetRangeStart>charsetRangeEndEscape','\\'],
    ['charsetRangeEndEscape>charsetRangeEnd',normalEscapeEX,actions.charsetRangeEndNormalEscape],
    // No need to care [a-\0],it is not a valid range so will throw OutOfOrder error.
    // But what about [\0-\0]? Insane!
    ['charsetRangeEndEscape>charsetRangeEndWithNullChar','0'],

    ['charsetRangeEndEscape>charsetRangeEndUnicodeEscape1',unicodeEscape,actions.charsetRangeEnd],
    ['charsetRangeEndUnicodeEscape1>charsetRangeEndUnicodeEscape2',hexDigit,actions.charsetContent],
    ['charsetRangeEndUnicodeEscape2>charsetRangeEndUnicodeEscape3',hexDigit,actions.charsetContent],
    ['charsetRangeEndUnicodeEscape3>charsetRangeEndUnicodeEscape4',hexDigit,actions.charsetContent],
    ['charsetRangeEndUnicodeEscape4>charsetRangeEnd',hexDigit,actions.charsetRangeEndUnicodeEscape],
    ['charsetRangeEndEscape>charsetRangeEndHexEscape1',hexEscape,actions.charsetRangeEnd],
    ['charsetRangeEndHexEscape1>charsetRangeEndHexEscape2',hexDigit,actions.charsetContent],
    ['charsetRangeEndHexEscape2>charsetRangeEnd',hexDigit,actions.charsetRangeEndHexEscape],
    // [0-\w] means [-0\w]? Should throw error!
    ['charsetRangeEndEscape>charsetRangeEndClass',charClassEscape],

    // [a-\uz] means [za-u],[a-\u-z] means [-za-u]
    [charsetRangeEndIncompleteEscapeFirstStates+'>charsetContent','^\\]'+hexDigit,actions.charsetContent],

    // [a-\u0-9] means [0-9a-u]
    [charsetRangeEndIncompleteEscapeRemainStates+'>charsetRangeStart','-',actions.charsetContent],
    [charsetIncompleteEscapeStates+','
      +charsetRangeEndIncompleteEscapeStates
      +',charsetNullChar,charsetRangeStart,charsetContent'
      +',charsetClass,charsetExclude,charsetRangeEnd>exact',
      ']']
  ]
};


return parse;
});

if (typeof define !== 'function') define = require('amdefine')(module);
define('RegExp',['./parse','./Kit','./NFA'],function (parse,K,NFA) {
/**
Mock RegExp class
*/
parse.exportConstants();
//options
RegExp.DEBUG=RegExp.D=1;
RegExp.MULTILINE=RegExp.M=2;
RegExp.GLOBAL=RegExp.G=4;
RegExp.IGNORECASE=RegExp.I=8;
function RegExp(re,options) {
  if (!(this instanceof RegExp)) return new RegExp(re,options);
  re=re+'';
  var opts={};
  if (typeof options==='string') {
    options=options.toLowerCase();
    if (~options.indexOf('i')) opts.ignoreCase=true;
    if (~options.indexOf('m')) opts.multiline=true;
    if (~options.indexOf('g')) opts.global=true;
    if (~options.indexOf('d')) opts.debug=true;
  } else {
    opts=options;
  }

  var ast=this.ast=parse(re);
  this.source=re;
  this.multiline=!!opts.multiline;
  this.global=!!opts.global;
  this.ignoreCase=!!opts.ignoreCase;
  this.debug=!!opts.debug;
  this.flags='';
  if (this.multiline) this.flags+='m';
  if (this.ignoreCase) this.flags+='i';
  if (this.global) this.flags+='g';
  _readonly(this,['source','options','multiline','global','ignoreCase','flags','debug']);

  var ignoreCase=this.ignoreCase;
  ast.traverse(function (node) {explainCharset(node,ignoreCase)},CHARSET_NODE);
  ast.traverse(function (node) {explainExact(node,ignoreCase)},EXACT_NODE);
  if (this.multiline) ast.traverse(multilineAssert,ASSERT_NODE);

}

RegExp.prototype={
  toString:function () {return '/'+this.source+'/'+this.flags;},
  test:function(s) {
    return this.exec(s)!==null;
  },
  exec:function (s,flag) {
    var nfa=this.getNFA(),ret;
    var startIndex=this.global?(this.lastIndex || 0):0,max=s.length;
    for (;startIndex<max;startIndex++) {
      ret=nfa.input(s,startIndex);
      if (ret.acceptable) break;
    }
    if (!ret || !ret.acceptable) {
      this.lastIndex=0;
      return null;
    }
    var groups=new Array(this.ast.groupCount+1);
    groups[0]=s.slice(startIndex,ret.lastIndex+1);
    var stack=ret.stack;
    for (var i=1,l=groups.length;i<l;i++) {
      groups[i]=getGroupContent(stack,i,s,flag);
    }
    this.lastIndex=ret.lastIndex+1;
    groups.index=startIndex;
    groups.input=s;
    return groups;
  },
  getNFA:function() {
    if (this._nfa) return this._nfa;
    var nfa,ast=this.ast;
    stateGUID=1;//reset state guid
    nfa=tree2NFA(ast.tree);
    nfa=NFA(nfa,this.debug);
    this._nfa=nfa;
    return nfa;
  }
};

function explainExact(node,ignoreCase) {// expand exact node to ignore case
  var ranges;
  ranges=node.chars.split('');
  if (ignoreCase) {
    ranges=ranges.map(function (c) {
      if (/[a-z]/.test(c)) return [c,c.toUpperCase()];
      else if (/[A-Z]/.test(c)) return [c,c.toLowerCase()];
      else return [c];
    });
  } else {
    ranges=ranges.map(function (c) {return [c]});
  }
  node.explained=ranges;
}

function multilineAssert(node) {
  var at=node.assertionType;
  if (at===AssertBegin || at===AssertEnd) node.multiline=true;
}

//var anyChar='\0\uffff';
var anyCharButNewline=K.parseCharset('^\n\r\u2028\u2029'); // \n \r \u2028 \u2029.But what's "\u2028" and "\u2029"
//Not used
var charClass2ranges={  //  e.g. \d\D\w\W\s\S
  d:['09'],
  w:['AZ','az','09','_'],
  s:' \f\n\r\t\v\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000'.split('')
};
['d','w','s'].forEach(function (cls) {// D W S,negate ranges
  charClass2ranges[cls.toUpperCase()]=K.negate(charClass2ranges[cls]);
});

function explainCharset(node,ignoreCase) {
  var ranges=node.chars.split('');
  ranges=ranges.concat(K.flatten2(node.classes.map(function(cls) {
    return charClass2ranges[cls];
  })));
  ranges=ranges.concat(node.ranges);
  if (ignoreCase) ranges=expandRangeIgnoreCase(ranges);
  ranges=K.classify(ranges).ranges;
  if (node.exclude) ranges=K.negate(ranges);
  ranges=K.coalesce(ranges); // compress ranges
  node.explained=ranges;
}

// expand ['Aa'] to ['az','Aa']
function expandRangeIgnoreCase(ranges) {
  return K.flatten2(ranges.map(function (r) {
    var parts=K.classify([r,'az','AZ']).map[r];
    return K.flatten2(parts.map(function (p) {
      if (/[a-z]/.test(p)) {
        return [p,p.toUpperCase()];
      } else if (/[A-Z]/.test(p)) {
        return [p,p.toLowerCase()];
      } else return [p];
    }));
  }));
}

function tree2NFA(stack,from) {
  var trans=[],accepts;
  from = from || ['start'];
  accepts=stack.reduce(function (from,node) {
    var a=node2NFA(node,from);
    trans=trans.concat(a.trans);
    return a.accepts;
  },from);
  return {accepts:accepts,trans:trans};
}

/*
return {trans:[Transition],accepts:[State]}
*/
function node2NFA(node,from) {
  if (node.repeat) {
    return repeatNFA(node,from);
  } else {
    return NFABuilders[node.type](node,from);
  }
}

function getGroupContent(stack,num,s,flag) {
  var start,end,match;
  for (var i=0,l=stack.length,item;i<l;i++) {
    item=stack[i];
    if (item.num===num) {
      if (item.type===GROUP_CAPTURE_END) {
        end=item.index;
      } else if (item.type===GROUP_CAPTURE_START) {
        start=item.index;
        break;
      }
    }
  }
  if (start===undefined || end===undefined) return;
  var content=s.slice(start,end);
  return flag?{
    content:s.slice(start,end),
    index:[start,end]
  }:content;
}

var stateGUID=0;
function newState() {return 'q'+(stateGUID++)}

var GROUP_CAPTURE_START='GroupCaptureStart';
var GROUP_CAPTURE_END='GroupCaptureEnd';

var NFABuilders=(function _() {
  function exact(node,from) {
    var ts=[],to,ranges=node.explained;
    ranges.forEach(function (range) {
      ts.push({from:from,to:(to=[newState()]),charset:range});
      from=to;
    });
    return {accepts:to,trans:ts};
  }

  function charset(node,from) {
    var to=[newState()];
    return {accepts:to,trans:[{from:from,to:to,charset:node.explained}]};
  }
  function dot(node,from) {
    var to=[newState()];
    return {accepts:to,trans:[{from:from,to:to,charset:anyCharButNewline}]};
  }

  function empty(node,from) {
    var to=[newState()];
    return {accepts:to,trans:[{from:from,to:to,charset:false}]};
  }

  function group(node,from) {
    var groupStart=[newState()];
    var ts=[{
      from:from,to:groupStart,charset:false,
      action:!node.nonCapture && function _groupStart(stack,c,i) {
        stack.unshift({type:GROUP_CAPTURE_START,num:node.num,index:i});
      }
    }];

    from=groupStart;
    var a=tree2NFA(node.sub,from);
    ts=ts.concat(a.trans);
    var groupEnd=[newState()];
    ts.push({
      from:a.accepts,to:groupEnd,charset:false,
      action:!node.nonCapture && function _groupEnd(stack,c,i) {
        stack.unshift({type:GROUP_CAPTURE_END,num:node.num,index:i});
      }
    });
    return {accepts:groupEnd,trans:ts};
  }

  function backref(node,from) {
    var to=[newState()],groupNum=node.num;
    return {
      accepts:to,
      trans:[{
        from:from,to:to,charset:false,
        assert:function _aBackref(stack,c,i,state,s) {
          // static invalid backref will throw parse error
          // dynamic invalid backref will treat as empty string
          // e.g. /(?:(\d)|-)\1/ will match "-"
          var match=getGroupContent(stack,groupNum,s);
          if (match===undefined) {
            match="";
          }
          if (s.slice(i,i+match.length)===match) {
            return match.length;
          }
          return false;
        }
      }
    ]};
  }

  function choice(node,from) {
    var ts=[],to=[];
    node.branches.forEach(function (branch) {
      var a=tree2NFA(branch,from);
      ts=ts.concat(a.trans);
      to=to.concat(a.accepts);
    });
    return {trans:ts,accepts:to};
  }

  function assert(node,from) {
    var f;
    switch (node.assertionType) {
      case AssertBegin:
        f=node.multiline?_assertLineBegin:_assertStrBegin;
        break;
      case AssertEnd:
        f=node.multiline?_assertLineEnd:_assertStrEnd;
        break;
      case AssertWordBoundary:
        f=function _WB(_,c,i,state,s) {return _isBoundary(i,s)};
        break;
      case AssertNonWordBoundary:
        f=function _NWB(_,c,i,state,s) {return !_isBoundary(i,s)};
        break;
      case AssertLookahead:
        f=_lookahead(node);
        break;
      case AssertNegativeLookahead:
        f=_negativeLookahead(node);
        break;
    }
    return _newAssert(node,from,f);

    function _newAssert(node,from,assert) {
      var to=[newState()];
      return {
        accepts:to,
        trans:[{
          from:from,to:to,charset:false,
          assert:assert
        }]
      };
    }
    function _lookahead(node) {
      var m=NFA(tree2NFA(node.sub,['start']));
      return function _Lookahead(stack,c,i,state,s) {
        var ret=m.input(s,i,null,stack);
        return ret.acceptable;
      };
    }
    function _negativeLookahead(node) {
      var f=_lookahead(node);
      return function _NLookahead() {return !f.apply(this,arguments)};
    }

    function _isBoundary(i,s) {return !!(_isWordChar(i-1,s) ^ _isWordChar(i,s))}
    function _isWordChar(i,s) {return i!==-1 && i!==s.length && /\w/.test(s[i])}
    function _assertLineBegin(_,c,i,state,s) {return i===0 || s[i-1]==="\n"}
    function _assertStrBegin(_,c,i,state,s) {return i===0}
    function _assertLineEnd(_,c,i,state,s) {return i===s.length || c==="\n"}
    function _assertStrEnd(_,c,i,state,s) {return i===s.length}
  }

  //console.log(K.locals(_));
  return {
    assert:assert,
    choice:choice,
    backref:backref,
    group:group,
    empty:empty,
    charset:charset,
    dot:dot,
    exact:exact
  };
})();

function repeatNFA(node,from) {
  var builder=NFABuilders[node.type];
  var a,i,trans=[],repeat=node.repeat,
      min=repeat.min,max=repeat.max;
  i=min;
  while (i--) {
    a=builder(node,from);
    trans=trans.concat(a.trans);
    from=a.accepts;
  }
  var moreTrans=[];
  var accepts=[].concat(from);
  if (isFinite(max)) {
    for (;max>min;max--) {
      a=builder(node,from);
      moreTrans=moreTrans.concat(a.trans);
      from=a.accepts;
      accepts=accepts.concat(a.accepts);
    }
  } else {
    var beforeStates=from.slice();
    a=builder(node,from);
    moreTrans=moreTrans.concat(a.trans);
    accepts=accepts.concat(a.accepts);
    moreTrans.push({
      from:a.accepts,to:beforeStates,charset:false
    });
  }
  var endState=[newState()];
  if (repeat.nonGreedy) {
    trans.push({
      from:accepts,to:endState,charset:false
    });
    trans=trans.concat(moreTrans);
  } else {
    trans=trans.concat(moreTrans);
    trans.push({
      from:accepts,to:endState,charset:false
    });
  }
  return {accepts:endState,trans:trans};
}

function _readonly(obj,attrs) {
  attrs.forEach(function (a) {
    Object.defineProperty(obj,a,{writable:false,enumerable:true});
  });
}

return RegExp;

});

if (typeof define !== 'function') define = require('amdefine')(module);
define('regulex',['./Kit','./NFA','./RegExp','./parse'],
function (Kit,NFA,RegExp,parse) {
  return { // I hate require.js
    Kit:Kit,
    NFA:NFA,
    RegExp:RegExp,
    parse:parse
  };
});
