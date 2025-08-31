document.addEventListener('DOMContentLoaded', async () => {
  const emailPreview = document.getElementById('emailPreview');
  const fillButton = document.getElementById('fillButton');
  const statusDiv = document.getElementById('status');
  const settingsLink = document.getElementById('settingsLink');
  
  let currentEmail = '';
  let userDomain = '';
  
  // Load user's email domain from storage
  async function loadUserDomain() {
    const result = await chrome.storage.sync.get(['emailDomain']);
    userDomain = result.emailDomain || '';
    return userDomain;
  }
  
  // Get the current tab's domain
  async function getCurrentDomain() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) return '';
    
    try {
      const url = new URL(tab.url);
      // Remove 'www.' prefix if present
      let domain = url.hostname.replace(/^www\./, '');
      return domain;
    } catch (e) {
      return '';
    }
  }
  
  // Generate email based on current domain and user domain
  async function generateEmail() {
    const domain = await getCurrentDomain();
    
    if (!userDomain) {
      emailPreview.innerHTML = '<div class="no-domain-set">Please set your email domain in settings</div>';
      fillButton.disabled = true;
      return '';
    }
    
    if (!domain) {
      emailPreview.textContent = 'Unable to get domain';
      fillButton.disabled = true;
      return '';
    }
    
    currentEmail = `${domain}@${userDomain}`;
    emailPreview.textContent = currentEmail;
    fillButton.disabled = false;
    return currentEmail;
  }
  
  // Fill the email in the current page
  async function fillEmail() {
    if (!currentEmail) return;
    
    statusDiv.textContent = 'Filling...';
    statusDiv.className = 'status';
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Send message to content script
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'fillEmail',
        email: currentEmail
      });
      
      if (response && response.success) {
        statusDiv.textContent = 'Email filled successfully!';
        statusDiv.className = 'status success';
        
        // Clear status after 2 seconds
        setTimeout(() => {
          statusDiv.textContent = '';
          statusDiv.className = 'status';
        }, 2000);
      } else {
        throw new Error(response?.error || 'Failed to fill email');
      }
    } catch (error) {
      statusDiv.textContent = 'Error: ' + error.message;
      statusDiv.className = 'status error';
      
      // Clear error after 3 seconds
      setTimeout(() => {
        statusDiv.textContent = '';
        statusDiv.className = 'status';
      }, 3000);
    }
  }
  
  // Event listeners
  fillButton.addEventListener('click', fillEmail);
  
  settingsLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
  
  // Initialize
  await loadUserDomain();
  await generateEmail();
  
  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync' && changes.emailDomain) {
      userDomain = changes.emailDomain.newValue || '';
      generateEmail();
    }
  });
});
