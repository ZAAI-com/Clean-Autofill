document.getElementById("fillEmail").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: fillEmail,
  });
});

function fillEmail() {
  const emailInput = document.querySelector("input[type='email']");
  if (!emailInput) {
    alert("No email input field found.");
    return;
  }

  const domain = window.location.hostname.replace('www.','');
  const email = `${domain}@manuelgruber.com`;

  emailInput.value = email;
}
