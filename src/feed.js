(() => {
  document.getElementById('confirm').addEventListener('click', () => window.evPet?.confirmFeed());
  document.getElementById('cancel').addEventListener('click', () => window.evPet?.cancelFeed());
})();
