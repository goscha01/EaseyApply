(function ($) {

    const Popup = {
      settings: {},
      init: function () {
        const $this = Popup;
        $this.bindEvents();
        chrome.storage.local.get(["usertoken"], function (result) {
          if (
            typeof result.usertoken != "undefined" &&
            result.usertoken != ""
          ) {
            $("#login_button").hide();
            $("#logout_button").show();
          }
          else{
            $("#login_button").show();
            $("#logout_button").hide();
          }
          console.log(result)
        });
        
      },
      bindEvents: function () {
        $("#logout_button").click(function () {
          alert();
          chrome.cookies.remove({
            url: 'https://quickapplyforjobs.com/',
            name: 'user_id'
          }, function(removedCookie) {
            if (removedCookie) {
              chrome.storage.local.set({ usertoken: '' }, function () {
              })
              window.open('https://quickapplyforjobs.com/logout', '_blank');
              console.log('Cookie removed successfully!');
            } else {
              console.log('Failed to remove the cookie.');
            }
          });
        });
        
        //end of events
      }
      
    //end of functions
    };
  
    $(document).ready(function () {
      Popup.init();
    });
})(jQuery);
  