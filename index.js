function setPageJS(content){
  var script = document.createElement('script');
  script.textContent = content;
  (document.head||document.documentElement).appendChild(script);
  script.remove();
}

// GET USER CHOICE FROM WEB PAGE
window.addEventListener("message", function(event){
  if(event.source != window){
    return;
  }
  if (event.data.type && event.data.domain && event.data.path){
    if(event.data.type != 'DECIDE_SERVICE_WORKERS'){
      return;
    }
    chrome.runtime.sendMessage({message: "ask", domain: event.data.domain, path: event.data.path});
  }
}, false);

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse){
  // User selected to block, clear all existing SWs
  if(request.message == "remove" && request.scriptURL !== null){
    var content = 'if("serviceWorker" in navigator){navigator.serviceWorker.getRegistrations().then(function(regs){';
        content += 'for(let reg of regs){';
          content += 'if(reg.active.scriptURL === "' + request.scriptURL + '"){';
            content += 'reg.unregister();'
          content += '}';
         content +='}'; 
      content += '})};'
    setPageJS(content);
    return;
  }
});

// Prevent registration by default. There is a small chance that registration happens before storage entry can be queried (almost never)
setPageJS('var __bsw_original__;if("serviceWorker" in navigator){__bsw_original__=navigator.serviceWorker.register;navigator.serviceWorker.register=function(path,options){return new Promise(function(res, rej){rej(Error("Blocked by Block Service Workers extension"))})}}');

var domain = document.domain;
// RETRIEVE STORED USER PREFERENCE
chrome.storage.sync.get(domain, function(data){
  var storedValue = {};
  if(data[domain] !== null){
    storedValue = data[domain];
  }
  var overrideServiceWorker = 'var __bsw_override__=function(path,opts){';
        overrideServiceWorker += 'var __bsw__storedPrefs__=' + JSON.stringify(storedValue) + ';';
        overrideServiceWorker += 'var realPath=(window.location.pathname+path).replace(/\\.\\//g, "/").replace(/\\/\\//g, "/");';
        overrideServiceWorker += 'if(__bsw__storedPrefs__ && typeof __bsw__storedPrefs__[realPath]!=="undefined"){';
          overrideServiceWorker += 'if(__bsw__storedPrefs__[realPath]){'; // already ALLOWED
            overrideServiceWorker += 'navigator.serviceWorker.register=__bsw_original__;';
            overrideServiceWorker += 'var exec=function(){navigator.serviceWorker.register(path, opts);navigator.serviceWorker.register=__bsw_override__};';
            overrideServiceWorker += 'return new Promise(function(res,rej){res(exec)});';            
          overrideServiceWorker += '}else{'; // already BLOCKED
            overrideServiceWorker += 'return new Promise(function(res,rej){rej(Error("A Service Worker has been blocked for this domain"))});';
          overrideServiceWorker += '}';
        overrideServiceWorker += '}else{'; // NOT YET DECIDED
          overrideServiceWorker += 'window.postMessage({type:"DECIDE_SERVICE_WORKERS",domain:window.location.hostname,path:window.location.pathname+path}, "*");';
          overrideServiceWorker += 'return new Promise(function(res, rej){rej(Error("Allow or Block this Service Worker for this domain"))})';
        overrideServiceWorker += '}';
      overrideServiceWorker += '};';
    overrideServiceWorker += 'if("serviceWorker" in navigator){navigator.serviceWorker.register=__bsw_override__}';
    setPageJS(overrideServiceWorker);
});