document.getElementById('open').addEventListener('click', () => {
  browser.action.closePopup();
  browser.sidePanel.open();
});
