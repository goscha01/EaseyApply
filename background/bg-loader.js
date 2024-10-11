try {
    importScripts('../config.js', 'background.js');
  
  } catch (e) {
  
    if(typeof(e) == "object"){
      console.log(e);
    }
  
  }