document.addEventListener('DOMContentLoaded', () => {
  const openButtonsWindow = document.getElementById('openButtonsWindow');

  openButtonsWindow.addEventListener('click', () => {
      chrome.windows.create({
          url: chrome.runtime.getURL("buttons.html"),
          type: "popup",
          width: 400,
          height: 300
      });
  });
});
