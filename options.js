document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('settingsForm');
  const emailDomainInput = document.getElementById('emailDomain');
  const statusDiv = document.getElementById('status');
  const clearButton = document.getElementById('clearButton');
  const previewBox = document.getElementById('previewBox');
  const exampleEmail = document.getElementById('exampleEmail');
  const exampleEmail2 = document.getElementById('exampleEmail2');
  
  // Load saved settings
  async function loadSettings() {
    const result = await chrome.storage.sync.get(['emailDomain']);
    if (result.emailDomain) {
      emailDomainInput.value = result.emailDomain;
      updatePreview();
      updateExamples();
    }
  }
  
  // Save settings
  async function saveSettings(e) {
    e.preventDefault();
    
    const domain = emailDomainInput.value.trim();
    
    // Validate domain
    if (!domain) {
      showStatus('Please enter a domain', 'error');
      return;
    }
    
    // Remove @ if user included it
    const cleanDomain = domain.replace(/^@/, '');
    
    // Basic domain validation
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(\.[a-zA-Z]{2,})+$/;
    if (!domainRegex.test(cleanDomain)) {
      showStatus('Please enter a valid domain (e.g., example.com)', 'error');
      return;
    }
    
    try {
      await chrome.storage.sync.set({ emailDomain: cleanDomain });
      emailDomainInput.value = cleanDomain;
      showStatus('Settings saved successfully!', 'success');
      updatePreview();
      updateExamples();
    } catch (error) {
      showStatus('Error saving settings: ' + error.message, 'error');
    }
  }
  
  // Clear settings
  async function clearSettings() {
    if (confirm('Are you sure you want to clear your email domain?')) {
      try {
        await chrome.storage.sync.remove(['emailDomain']);
        emailDomainInput.value = '';
        showStatus('Settings cleared', 'success');
        updatePreview();
        updateExamples();
      } catch (error) {
        showStatus('Error clearing settings: ' + error.message, 'error');
      }
    }
  }
  
  // Show status message
  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    
    // Hide status after 3 seconds
    setTimeout(() => {
      statusDiv.className = 'status';
    }, 3000);
  }
  
  // Update preview
  function updatePreview() {
    const domain = emailDomainInput.value.trim();
    if (domain) {
      // Get current tab domain for preview
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].url) {
          try {
            const url = new URL(tabs[0].url);
            const currentDomain = url.hostname.replace(/^www\./, '');
            previewBox.textContent = `${currentDomain}@${domain}`;
          } catch (e) {
            previewBox.textContent = `example.com@${domain}`;
          }
        } else {
          previewBox.textContent = `example.com@${domain}`;
        }
      });
    } else {
      previewBox.textContent = 'No domain set';
    }
  }
  
  // Update examples
  function updateExamples() {
    const domain = emailDomainInput.value.trim() || 'yourdomain.com';
    exampleEmail.textContent = `example.com@${domain}`;
    exampleEmail2.textContent = `github.com@${domain}`;
  }
  
  // Event listeners
  form.addEventListener('submit', saveSettings);
  clearButton.addEventListener('click', clearSettings);
  emailDomainInput.addEventListener('input', () => {
    updatePreview();
    updateExamples();
  });
  
  // Initialize
  await loadSettings();
});
