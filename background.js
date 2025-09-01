// Handle extension icon clicks
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // Generate email for current tab
    const email = await generateEmailForTab(tab);
    
    if (!email) {
      // Show notification if no email domain is set
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'MailFiller',
        message: 'Please set your email domain in extension options first.'
      });
      
      // Open options page
      chrome.runtime.openOptionsPage();
      return;
    }
    
    // Send message to content script to fill the email
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'fillEmail',
      email: email
    });
    
    if (response && response.success) {
      // Show success notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'MailFiller',
        message: `Email filled: ${email}`
      });
    } else {
      throw new Error(response?.error || 'Failed to fill email');
    }
    
  } catch (error) {
    console.error('MailFiller error:', error);
    
    // Show error notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'MailFiller Error',
      message: error.message || 'Failed to fill email'
    });
  }
});

// Generate email based on current tab and user settings
async function generateEmailForTab(tab) {
  // Get user's email domain from storage
  const result = await chrome.storage.sync.get(['emailDomain']);
  const userDomain = result.emailDomain;

  if (!userDomain) {
    return null; // No domain configured
  }

  // Extract domain from tab URL
  if (!tab || !tab.url) {
    throw new Error('Unable to get current website domain');
  }

  try {
    const url = new URL(tab.url);
    // Extract only the main domain (without subdomains)
    let domain = extractMainDomain(url.hostname);

    // Generate email
    return `${domain}@${userDomain}`;
  } catch (e) {
    throw new Error('Unable to parse current website URL');
  }
}

// Extract main domain from hostname (remove subdomains)
function extractMainDomain(hostname) {
  // Handle localhost and IP addresses
  if (hostname === 'localhost' || hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    return hostname;
  }

  // Remove 'www.' prefix if present
  let domain = hostname.replace(/^www\./, '');

  // Split by dots
  const parts = domain.split('.');

  // Handle special TLDs (like .co.uk, .com.au)
  const specialTLDs = ['co.uk', 'com.au', 'com.br', 'co.jp', 'org.uk', 'net.au'];
  const lastTwoParts = parts.slice(-2).join('.');
  const lastThreeParts = parts.slice(-3).join('.');

  if (parts.length >= 3 && specialTLDs.includes(lastTwoParts)) {
    // For special TLDs like .co.uk, take last 3 parts
    return lastThreeParts;
  } else if (parts.length >= 2) {
    // For regular TLDs like .com, .org, take last 2 parts
    return lastTwoParts;
  } else {
    // Fallback to original domain
    return domain;
  }
}

// Install event - show welcome message
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'MailFiller Installed',
      message: 'Click the extension icon to fill emails! Configure your domain in options first.'
    });
    
    // Open options page on first install
    chrome.runtime.openOptionsPage();
  }
});
