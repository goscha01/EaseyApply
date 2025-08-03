// Background Service Worker for EasyApply Extension
// Note: ES6 imports are not supported in service workers, so we'll use a simpler approach

// Configuration constants
const CONFIG = {
  API: {
    BASE_URL: 'https://quickapplyforjobs.com/api/',
    CV_URL: 'https://quickapplyforjobs.com/',
    TIMEOUT: 30000,
    RETRY_ATTEMPTS: 3
  },
  LINKEDIN: {
    BASE_URL: 'https://www.linkedin.com',
    JOB_SEARCH_URL: 'https://www.linkedin.com/jobs/search/',
    COOKIE_DOMAIN: 'https://www.linkedin.com/'
  },
  APPLICATION: {
    MAX_JOBS_PER_SESSION: 50,
    MIN_JOBS_PER_SESSION: 1,
    DEFAULT_DELAY: 2000,
    MAX_WAIT_TIME: 10000,
    RETRY_DELAY: 1000
  },
  STORAGE_KEYS: {
    JOB_DATA: 'jobData',
    USER_TOKEN: 'usertoken',
    APPLICATION_STATE: 'applicationState',
    SETTINGS: 'settings'
  },
  MESSAGE_TYPES: {
    APPLY_LINKEDIN: 'applyLinkedin',
    SEARCH_JOBS: 'searchJobs',
    STOP_PROCESS: 'stop_background_proccess',
    UPDATE_PROGRESS: 'updateProgress',
    ERROR_OCCURRED: 'errorOccurred',
    GATHER_JOBS: 'gatherJobs',
    START_APPLICATIONS: 'startApplications',
    GET_JOB_LIST: 'getJobList'
  }
};

// Error messages
const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error occurred. Please check your connection.',
  INVALID_INPUT: 'Please provide valid input data.',
  JOB_NOT_FOUND: 'No jobs found with the given criteria.',
  APPLICATION_FAILED: 'Failed to apply to job. Please try again.',
  TIMEOUT_ERROR: 'Operation timed out. Please try again.',
  PERMISSION_DENIED: 'Permission denied. Please check extension permissions.'
};

/**
 * Enhanced Background Service Worker
 */
class BackgroundServiceWorker {
  constructor() {
    this.isRunning = false;
    this.currentTabId = null;
    this.jobLinks = [];
    this.currentIndex = 0;
    this.currentGatheringData = null;
    this.init();
  }

  /**
   * Initialize the service worker
   */
  async init() {
    try {
      this.setupEventListeners();
      this.setupAlarms();
      await this.loadState();
      console.log('Background service worker initialized');
    } catch (error) {
      console.error('Background service worker initialization failed:', error);
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Extension installation
    chrome.runtime.onInstalled.addListener(() => {
      this.handleInstallation();
    });

    // Extension startup
    chrome.runtime.onStartup.addListener(() => {
      this.handleStartup();
    });

    // Action button click
    chrome.action.onClicked.addListener(() => {
      this.handleActionClick();
    });

    // Message handling
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async response
    });

    // Tab updates
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      this.handleTabUpdate(tabId, changeInfo, tab);
    });

    // Note: Side panel API has restrictions in service workers
    // Using popup window approach instead for better compatibility

    // Alarm handling
    chrome.alarms.onAlarm.addListener((alarm) => {
      this.handleAlarm(alarm);
    });
  }

  /**
   * Setup alarms for periodic tasks
   */
  setupAlarms() {
    chrome.alarms.create('stateSync', { periodInMinutes: 1 });
    chrome.alarms.create('errorCleanup', { periodInMinutes: 30 });
  }

  /**
   * Handle extension installation
   */
  async handleInstallation() {
    try {
      console.log('🚀 EasyApply extension installed/updated');
      
      // Set up side panel behavior to open on action click
      if (chrome.sidePanel) {
        try {
          await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
          console.log('✅ Side panel behavior configured');
        } catch (error) {
          console.error('❌ Failed to set side panel behavior:', error);
        }
      } else {
        console.log('⚠️ Side panel API not available');
      }
      
      // Initialize storage
      await this.initializeStorage();
      
      console.log('✅ EasyApply extension initialization complete');
    } catch (error) {
      console.error('❌ Installation error:', error);
    }
  }

  /**
   * Handle extension startup
   */
  async handleStartup() {
    try {
      console.log('EasyApply extension started');
      await this.reloadLinkedInTabs();
    } catch (error) {
      console.error('Startup error:', error);
    }
  }

  /**
   * Handle action button click
   */
  async handleActionClick() {
    try {
      console.log('🔍 Action button clicked - opening EasyApply side panel...');
      
      if (chrome.sidePanel) {
        try {
          await chrome.sidePanel.open();
          console.log('✅ Side panel opened successfully');
        } catch (error) {
          console.error('❌ Failed to open side panel:', error);
          // Fallback to popup window
          await this.createSidePanelAlternative();
        }
      } else {
        console.log('⚠️ Side panel API not available, using popup window');
        await this.createSidePanelAlternative();
      }
    } catch (error) {
      console.error('❌ Action click error:', error);
      try {
        console.log('🔄 Trying alternative creation method...');
        const sidePanelUrl = chrome.runtime.getURL('src/sidepanel/sidepanel.html');
        const tab = await this.createTab(sidePanelUrl);
        console.log('✅ EasyApply interface created as tab:', tab.id);
      } catch (altError) {
        console.error('❌ Alternative method also failed:', altError);
        throw altError;
      }
    }
  }

  /**
   * Get current window ID
   */
  async getCurrentWindowId() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return tab?.windowId;
    } catch (error) {
      console.error('❌ Error getting current window ID:', error);
      return null;
    }
  }

  /**
   * Create EasyApply interface (popup window positioned like side panel)
   */
  async createSidePanelAlternative() {
    try {
      console.log('🚀 Creating EasyApply interface...');
      
      const sidePanelUrl = chrome.runtime.getURL('src/sidepanel/sidepanel.html');
      console.log('🌐 EasyApply interface URL:', sidePanelUrl);
      
      // Get screen dimensions
      const screenWidth = globalThis.screen?.width || 1920;
      const screenHeight = globalThis.screen?.height || 1080;
      
      // Calculate popup dimensions (like a side panel)
      const popupWidth = 400;
      const popupHeight = Math.min(800, screenHeight * 0.8);
      const popupLeft = screenWidth - popupWidth;
      const popupTop = Math.floor((screenHeight - popupHeight) / 2);
      
      console.log('📏 Popup dimensions:', {
        width: popupWidth,
        height: popupHeight,
        left: popupLeft,
        top: popupTop
      });
      
      // Create popup window positioned like a side panel
      const popupWindow = await chrome.windows.create({
        url: sidePanelUrl,
        type: 'popup',
        width: popupWidth,
        height: popupHeight,
        left: popupLeft,
        top: popupTop,
        focused: false // Don't steal focus from main window
      });
      
      console.log('✅ EasyApply interface created successfully:', popupWindow.id);
      
      // Store reference to the popup window
      this.sidePanel = { type: 'popup', windowId: popupWindow.id };
      
      // Try to resize the main browser window to make room
      try {
        const [mainTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (mainTab && mainTab.windowId !== popupWindow.id) {
          const mainWindow = await chrome.windows.get(mainTab.windowId);
          if (mainWindow) {
            const newMainWidth = Math.floor(screenWidth * 0.6);
            await chrome.windows.update(mainTab.windowId, {
              width: newMainWidth,
              height: screenHeight,
              left: 0,
              top: 0
            });
            console.log('✅ Main browser window resized to make room for EasyApply');
          }
        }
      } catch (windowError) {
        console.log('⚠️ Could not resize main browser window:', windowError);
      }
      
    } catch (error) {
      console.error('❌ Failed to create EasyApply interface:', error);
      
      // Fallback to creating a new tab
      try {
        console.log('🔄 Falling back to new tab...');
        const tab = await this.createTab(sidePanelUrl);
        console.log('✅ EasyApply interface created as tab:', tab.id);
      } catch (tabError) {
        console.error('❌ Tab creation also failed:', tabError);
        throw error;
      }
    }
  }



  /**
   * Handle incoming messages
   */
  async handleMessage(message, sender, sendResponse) {
    try {
      // Only log for important message types
      if (message.type === 'gatherJobs' || message.type === 'startApplications' || message.type === 'jobGathered') {
        console.log(`📨 ${message.type}: ${message.data ? JSON.stringify(message.data) : ''}`);
      }

      switch (message.type) {
        case CONFIG.MESSAGE_TYPES.APPLY_LINKEDIN:
          console.log('🚀 Starting LinkedIn application process...');
          await this.handleApplyLinkedIn(message.data);
          console.log('✅ LinkedIn application process started successfully');
          sendResponse({ success: true });
          break;

        case CONFIG.MESSAGE_TYPES.GATHER_JOBS:
          await this.handleGatherJobs(message.data);
          sendResponse({ success: true });
          break;

        case CONFIG.MESSAGE_TYPES.START_APPLICATIONS:
          console.log('🚀 Starting application process...');
          const startAppResult = await this.startApplications();
          console.log('✅ Application process completed');
          sendResponse(startAppResult);
          break;

        case CONFIG.MESSAGE_TYPES.STOP_PROCESS:
          console.log('⏹️ Stopping background process...');
          await this.handleStopProcess();
          console.log('✅ Background process stopped successfully');
          sendResponse({ success: true });
          break;

        case CONFIG.MESSAGE_TYPES.UPDATE_PROGRESS:
          console.log('📊 Updating progress...');
          await this.handleUpdateProgress(message.data);
          sendResponse({ success: true });
          break;

        case CONFIG.MESSAGE_TYPES.GET_JOB_LIST:
          const jobList = await this.getJobList();
          const progress = await this.getFromStorage(['currentGatheringProgress']);
          sendResponse({ 
            jobs: jobList.jobs || [], 
            gatheringComplete: jobList.gatheringComplete || false,
            progress: progress.currentGatheringProgress || null
          });
          break;

        case 'jobGathered':
          await this.addGatheredJob(message.job);
          
          // Store progress for the next getJobList request
          if (message.progress) {
            await this.setInStorage({ currentGatheringProgress: message.progress });
          }
          
          sendResponse({ success: true });
          break;

        case 'gatheringComplete':
          console.log('✅ Job gathering completed. Total jobs:', message.total);
          await this.completeJobGathering(message.jobs);
          
          // Clear progress
          await this.setInStorage({ currentGatheringProgress: null });
          
          sendResponse({ success: true });
          break;

        case 'getState':
          console.log('📊 Getting application state...');
          const state = await this.getApplicationState();
          console.log('📊 Application state:', state);
          sendResponse({ state });
          break;

        case 'getStats':
          console.log('📈 Getting session stats...');
          const stats = await this.getSessionStats();
          console.log('📈 Session stats:', stats);
          sendResponse({ stats });
          break;

        case 'deleteJob':
          console.log('🗑️ Deleting job from gathered list...');
          const deleteResult = await this.deleteJobFromList(message.jobId);
          sendResponse({ success: deleteResult });
          break;
          
        case 'jobDescriptionResult':
          // This message is handled by the promise-based system in fetchJobDescription
          // Log detailed debug information
          console.log('📄 Received job description result:', message.data);
          if (message.data.debug) {
            console.log('🔍 DEBUG INFO:');
            console.log('  Step 1:', message.data.debug.step1);
            console.log('  Step 2:', message.data.debug.step2);
            console.log('  Step 3:', message.data.debug.step3);
            console.log('  Step 4:', message.data.debug.step4);
            console.log('  Step 5:', message.data.debug.step5);
            console.log('  Found Job Card:', message.data.debug.foundJobCard);
            console.log('  Job Card Selector:', message.data.debug.jobCardSelector);
            console.log('  Scroll Attempts:', message.data.debug.scrollAttempts);
            console.log('  Click Success:', message.data.debug.clickSuccess);
            console.log('  Description Loaded:', message.data.debug.descriptionLoaded);
          }
          break;
          


        case 'fetchJobDescription':
          console.log('📄 Fetching job description...');
          const fetchResult = await this.fetchJobDescription(message.data);
          sendResponse({ success: fetchResult });
          break;
          
        case 'fetchAllJobDescriptions':
          console.log('📄 Fetching all job descriptions...');
          const fetchAllResult = await this.fetchAllJobDescriptions();
          sendResponse({ success: fetchAllResult });
          break;
          
        case 'startApplications':
          console.log('🚀 Starting applications...');
          const startResult = await this.startApplications(message.data);
          sendResponse({ success: startResult });
          break;
          
        case 'startSingleApplication':
          console.log('🚀 Starting single application...');
          const singleStartResult = await this.startSingleApplication(message.data);
          sendResponse(singleStartResult);
          break;
          
        case 'updateApplicationProgress':
          console.log('📊 Application progress update:', message.data);
          // Forward progress update to sidepanel
          try {
            const sidepanels = await chrome.sidePanel.getAll({ windowId: await this.getCurrentWindowId() });
            for (const sidepanel of sidepanels) {
              await chrome.tabs.sendMessage(sidepanel.tabId, {
                type: 'applicationProgressUpdate',
                data: message.data
              });
            }
          } catch (error) {
            console.log('⚠️ Could not forward progress update to sidepanel:', error.message);
          }
          sendResponse({ success: true });
          break;

        case 'clickNextButton':
          console.log('🚀 Clicking Next button in current tab');
          try {
            // Get the current active tab
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs.length === 0) {
              sendResponse({ success: false, error: 'No active tab found' });
              return;
            }
            
            const currentTab = tabs[0];
            console.log('🚀 Using tab ID:', currentTab.id);
            
            const clickResult = await this.clickNextButton(currentTab.id);
            sendResponse(clickResult);
          } catch (error) {
            console.error('❌ Error clicking Next button:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;
          
        case 'forceResetState':
          console.log('🔄 Force resetting state...');
          await this.forceResetState();
          console.log('✅ State reset successfully');
          sendResponse({ success: true });
          break;

        default:
          console.warn('❌ Unknown message type:', message.type);
          console.warn('❌ Available message types:', Object.values(CONFIG.MESSAGE_TYPES));
          sendResponse({ success: false, error: `Unknown message type: ${message.type}` });
      }
    } catch (error) {
      console.error('❌ Message handling error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Handle LinkedIn job application process
   */
  async handleApplyLinkedIn(data) {
    try {
      console.log('🔍 handleApplyLinkedIn called with data:', data);
      
      if (this.isRunning) {
        console.log('❌ Application process is already running');
        throw new Error('Application process is already running');
      }

      console.log('✅ Process not running, proceeding...');

      // Validate data
      console.log('🔍 Validating application data...');
      if (!this.validateApplicationData(data)) {
        console.log('❌ Application data validation failed');
        throw new Error('Invalid application data');
      }

      console.log('✅ Application data validated successfully');

      // Start session
      console.log('🚀 Starting application session...');
      await this.startSession(data);
      console.log('✅ Session started successfully');
      
      this.isRunning = true;
      console.log('✅ Process marked as running');

      // Open LinkedIn job search
      console.log('🌐 Opening LinkedIn job search...');
      await this.openLinkedInJobSearch(data);
      console.log('✅ LinkedIn job search opened successfully');

    } catch (error) {
      console.error('❌ Apply LinkedIn error:', error);
      console.error('❌ Error stack:', error.stack);
      await this.stopSession();
      this.isRunning = false;
      throw error; // Re-throw to be handled by the message handler
    }
  }

  /**
   * Handle stop process
   */
  async handleStopProcess() {
    try {
      console.log('🛑 Stopping application process...');
      
      this.isRunning = false;
      this.isGatheringJobs = false;
      
      await this.stopSession();
      await this.stopJobGatheringSession();
      await this.stopApplicationSession();
      
      // Close current tab if exists
      if (this.currentTabId) {
        await this.closeTab(this.currentTabId);
        this.currentTabId = null;
      }

      console.log('✅ Application process stopped');
    } catch (error) {
      console.error('Stop process error:', error);
    }
  }

  /**
   * Force reset all state (for manual cleanup)
   */
  async forceResetState() {
    try {
      console.log('🔄 Force resetting all application state...');
      
      this.isRunning = false;
      this.isGatheringJobs = false;
      this.currentTabId = null;
      this.currentIndex = 0;
      
      await this.cleanupStaleState();
      
      // Clear all saved job descriptions
      try {
        await chrome.storage.local.set({ savedJobDescriptions: {} });
        console.log('🗑️ Cleared all saved job descriptions');
      } catch (error) {
        console.error('❌ Error clearing saved descriptions:', error);
      }
      
      console.log('✅ All state reset successfully');
    } catch (error) {
      console.error('Force reset state error:', error);
    }
  }

  /**
   * Handle progress updates
   */
  async handleUpdateProgress(data) {
    try {
      await this.updateProgress(data.current, data.total);
      
      if (data.currentJob) {
        await this.setCurrentJob(data.currentJob);
      }
    } catch (error) {
      console.error('Update progress error:', error);
    }
  }

  /**
   * Handle tab updates
   */
  async handleTabUpdate(tabId, changeInfo, tab) {
    try {
      // Only handle LinkedIn job pages
      if (!tab.url || !tab.url.includes('linkedin.com/jobs')) {
        return;
      }

      // Handle page load completion
      if (changeInfo.status === 'complete' && tabId === this.currentTabId) {
        await this.handleJobPageLoad(tabId, tab);
      }

    } catch (error) {
      console.error('Tab update error:', error);
    }
  }

  /**
   * Handle alarm events
   */
  async handleAlarm(alarm) {
    try {
      switch (alarm.name) {
        case 'forActiveState':
          await this.syncUserState();
          break;
        case 'stateSync':
          await this.syncState();
          break;
        case 'errorCleanup':
          await this.cleanupErrors();
          break;
      }
    } catch (error) {
      console.error('Alarm handling error:', error);
    }
  }

  /**
   * Check current LinkedIn jobs page
   */
  async checkCurrentLinkedInPage(data) {
    try {
      console.log('🌐 Getting current active tab...');
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tabs.length === 0) {
        throw new Error('No active tab found');
      }
      
      const currentTab = tabs[0];
      
      // Check if we're on a LinkedIn jobs page
      if (!currentTab.url.includes('linkedin.com/jobs')) {
        console.log('⚠️ Not on LinkedIn jobs page, navigating to LinkedIn job search...');
        
        // Build LinkedIn job search URL
        const searchUrl = this.buildSearchUrl(data);
        
        // Navigate to LinkedIn job search
        await chrome.tabs.update(currentTab.id, { url: searchUrl });
        

        
        console.log('✅ Navigated to LinkedIn job search page');
      }
      
      // Check if we're on a job detail page (not a search page)
      if (currentTab.url.includes('/jobs/view/')) {
        console.log('📄 User is on a job detail page, redirecting to job search...');
        
        // Build a job search URL and navigate to it
        const searchUrl = this.buildSearchUrl(data);
        
        // Update the current tab to the search page
        await chrome.tabs.update(currentTab.id, { url: searchUrl });
        
        
        
        console.log('✅ Redirected to job search page');
      }
      
      this.currentTabId = currentTab.id;
      
      // Wait for the page to load and content script to be ready
      await this.waitForPageLoad(currentTab.id);
      const contentScriptReady = await this.waitForContentScriptReady(currentTab.id);
      
      if (contentScriptReady) {
        // Send message to content script to start gathering jobs
        try {
          const response = await this.sendMessageToTab(currentTab.id, {
            type: 'startGathering',
            data: { ...data, manual: true } // Add manual flag to indicate user-initiated request
          });
          
          if (!response || !response.success) {
            throw new Error('Failed to start job gathering: ' + (response?.error || 'Unknown error'));
          }
        } catch (error) {
          throw new Error('Failed to communicate with content script: ' + error.message);
        }
        
      } else {
        throw new Error('Content script not ready');
      }
      
    } catch (error) {
      console.error('❌ Check LinkedIn page error:', error);
      console.error('❌ Error stack:', error.stack);
      throw error;
    }
  }

  /**
   * Build LinkedIn search URL
   */
  buildSearchUrl(data = {}) {
    console.log('🔗 Building search URL with data:', data);
    
    const baseUrl = CONFIG.LINKEDIN.JOB_SEARCH_URL;
    const params = new URLSearchParams();
    
    // Add some randomization to get different job results
    const randomSuffixes = ['', ' developer', ' engineer', ' specialist', ' analyst'];
    const randomSuffix = randomSuffixes[Math.floor(Math.random() * randomSuffixes.length)];
    
    if (data.skills) {
      const keywords = data.skills + randomSuffix;
      params.append('keywords', keywords);
      console.log('🔗 Added keywords with randomization:', keywords);
    }
    
    if (data.job_location) {
      params.append('location', data.job_location);
      console.log('🔗 Added location:', data.job_location);
    }
    
    if (data.job_type) {
      const filterValue = this.getJobTypeFilter(data.job_type);
      params.append('f_WT', filterValue);
      console.log('🔗 Added job type filter:', data.job_type, '->', filterValue);
    }
    
    // Add random sorting parameter to get different job order
    const sortOptions = ['R', 'DD', 'TPR']; // Recent, Date Posted, Most Relevant
    const randomSort = sortOptions[Math.floor(Math.random() * sortOptions.length)];
    params.append('sortBy', randomSort);
    console.log('🔗 Added random sort parameter:', randomSort);
    
    const finalUrl = `${baseUrl}?${params.toString()}`;
    console.log('🔗 Final search URL:', finalUrl);
    
    return finalUrl;
  }

  /**
   * Get job type filter value
   */
  getJobTypeFilter(jobType) {
    const filters = {
      'Remote': '2',
      'Hybrid': '3',
      'On-Site': '1'
    };
    return filters[jobType] || '';
  }

  /**
   * Handle job page load
   */
  async handleJobPageLoad(tabId, tab) {
    try {
      if (!this.isRunning) {
        return;
      }

      // Wait for page to be fully loaded
      await this.waitForPageLoad(tabId);

      // Wait for content script to be ready
      const contentScriptReady = await this.waitForContentScriptReady(tabId);
      if (!contentScriptReady) {
        console.log('❌ Content script not ready, skipping job processing');
        return;
      }

      // Send message to content script
      await this.sendMessageToTab(tabId, {
        type: 'processJobPage',
        data: {
          currentIndex: this.currentIndex,
          totalJobs: await this.getTotalJobs()
        }
      });

    } catch (error) {
      console.error('Job page load error:', error);
      await this.handleJobError(tabId, error);
    }
  }

  /**
   * Wait for page to load
   */
  async waitForPageLoad(tabId) {
    return new Promise((resolve, reject) => {
      const checkLoad = () => {
        chrome.tabs.get(tabId, (tab) => {
          if (chrome.runtime.lastError) {
            console.log('Tab not found or error:', chrome.runtime.lastError.message);
            reject(new Error('Tab not found or error'));
            return;
          }
          
          if (tab && tab.status === 'complete') {
            resolve();
          } else {
            setTimeout(checkLoad, 100);
          }
        });
      };
      checkLoad();
    });
  }

  /**
   * Check if content script is ready
   */
  async isContentScriptReady(tabId) {
    try {
      console.log(`🔍 Checking if content script is ready for tab ${tabId}...`);
      const response = await this.sendMessageToTab(tabId, { type: 'checkReady' });
      const isReady = response && response.ready === true;
      console.log(`📡 Content script response:`, response, `Ready: ${isReady}`);
      return isReady;
    } catch (error) {
      console.log('❌ Content script not ready yet:', error.message);
      return false;
    }
  }

  /**
   * Wait for content script to be ready
   */
  async waitForContentScriptReady(tabId, maxAttempts = 30) {
    console.log(`🔄 Waiting for content script to be ready (max ${maxAttempts} attempts)...`);
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`🔍 Attempt ${attempt}/${maxAttempts} - checking content script readiness...`);
      
      if (await this.isContentScriptReady(tabId)) {
        console.log('✅ Content script is ready!');
        return true;
      }
      
      // Wait 1 second between attempts
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('❌ Content script not ready after all attempts');
    return false;
  }

  /**
   * Send message to tab with readiness check
   */
  async sendMessageToTab(tabId, message) {
    return new Promise((resolve, reject) => {
      // First check if tab exists
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError) {
          reject(new Error(`Tab ${tabId} not found: ${chrome.runtime.lastError.message}`));
          return;
        }
        
        const timeout = setTimeout(() => {
          reject(new Error('Message timeout - no response received'));
        }, 30000); // 30 second timeout for job description extraction
      
        chrome.tabs.sendMessage(tabId, message, (response) => {
          clearTimeout(timeout);
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
    });
  }
  
  /**
   * Send message to tab with custom timeout
   */
  async sendMessageToTabWithTimeout(tabId, message, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      // First check if tab exists
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError) {
          reject(new Error(`Tab ${tabId} not found: ${chrome.runtime.lastError.message}`));
          return;
        }
        
        const timeout = setTimeout(() => {
          reject(new Error(`Message timeout after ${timeoutMs}ms - no response received`));
        }, timeoutMs);
      
        chrome.tabs.sendMessage(tabId, message, (response) => {
          clearTimeout(timeout);
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
    });
  }

  /**
   * Handle job processing error
   */
  async handleJobError(tabId, error) {
    try {
      console.error('Job processing error:', error);
      
      // Mark job as failed
      const currentJob = await this.getCurrentJob();
      if (currentJob) {
        await this.markJobFailed({
          ...currentJob,
          error: error.message
        });
      }
      
      // Move to next job or stop
      await this.moveToNextJob();
      
    } catch (moveError) {
      console.error('Job error handling failed:', moveError);
    }
  }

  /**
   * Move to next job
   */
  async moveToNextJob() {
    try {
      this.currentIndex++;
      const totalJobs = await this.getTotalJobs();
      
      if (this.currentIndex >= totalJobs) {
        // All jobs processed
        await this.completeSession();
        return;
      }
      
      // Update progress
      await this.updateProgress(this.currentIndex, totalJobs);
      
      // Navigate to next job
      await this.navigateToNextJob();
      
    } catch (error) {
      console.error('Move to next job error:', error);
    }
  }

  /**
   * Navigate to next job
   */
  async navigateToNextJob() {
    try {
      if (!this.currentTabId) {
        throw new Error('No active tab');
      }
      
      // Send navigation message to content script
      await this.sendMessageToTab(this.currentTabId, {
        type: 'navigateToNextJob'
      });
      
    } catch (error) {
      console.error('Navigate to next job error:', error);
    }
  }

  /**
   * Complete application session
   */
  async completeSession() {
    try {
      this.isRunning = false;
      await this.stopSession();
      
      // Close current tab
      if (this.currentTabId) {
        await this.closeTab(this.currentTabId);
        this.currentTabId = null;
      }
      
      console.log('Application session completed');
      
    } catch (error) {
      console.error('Complete session error:', error);
    }
  }

  /**
   * Validate application data
   */
  validateApplicationData(data) {
    console.log('🔍 Validating application data:', data);
    
    if (!data) {
      console.log('❌ No data provided');
      return false;
    }
    
    if (!data.skills || typeof data.skills !== 'string' || data.skills.trim().length < 2) {
      console.log('❌ Skills validation failed:', {
        skills: data.skills,
        type: typeof data.skills,
        length: data.skills ? data.skills.length : 0
      });
      return false;
    }
    
    if (!data.job_count || data.job_count < CONFIG.APPLICATION.MIN_JOBS_PER_SESSION || data.job_count > CONFIG.APPLICATION.MAX_JOBS_PER_SESSION) {
      console.log('❌ Job count validation failed:', {
        job_count: data.job_count,
        min: CONFIG.APPLICATION.MIN_JOBS_PER_SESSION,
        max: CONFIG.APPLICATION.MAX_JOBS_PER_SESSION
      });
      return false;
    }
    
    console.log('✅ Application data validation passed');
    return true;
  }

  /**
   * Validate job gathering data
   */
  validateJobGatheringData(data) {
    if (!data) {
      return false;
    }
    
    if (!data.job_count || data.job_count < CONFIG.APPLICATION.MIN_JOBS_PER_SESSION || data.job_count > CONFIG.APPLICATION.MAX_JOBS_PER_SESSION) {
      return false;
    }
    
    return true;
  }

  /**
   * Initialize storage with default values
   */
  async initializeStorage() {
    try {
      const defaultSettings = {
        skills: '',
        job_location: '',
        job_count: 10,
        job_type: '',
        delay: CONFIG.APPLICATION.DEFAULT_DELAY
      };
      
      await this.setInStorage({ settings: defaultSettings });
      
      // Create initial alarm for state sync
      chrome.alarms.create('stateSync', { periodInMinutes: 1 });
      chrome.alarms.create('errorCleanup', { periodInMinutes: 30 });
      
      console.log('✅ Storage initialized with default settings');
    } catch (error) {
      console.error('❌ Storage initialization error:', error);
    }
  }

  /**
   * Sync user state
   */
  async syncUserState() {
    try {
      const cookie = await this.getCookie(CONFIG.LINKEDIN.COOKIE_DOMAIN, 'user_id');
      if (cookie) {
        await this.setInStorage({ usertoken: cookie.value });
      }
    } catch (error) {
      console.error('Sync user state error:', error);
    }
  }

  /**
   * Sync application state
   */
  async syncState() {
    try {
      const state = {
        isRunning: this.isRunning,
        currentIndex: this.currentIndex,
        currentTabId: this.currentTabId
      };
      await this.setInStorage({ applicationState: state });
    } catch (error) {
      console.error('Sync state error:', error);
    }
  }

  /**
   * Cleanup stale state
   */
  async cleanupStaleState() {
    try {
      console.log('🧹 Cleaning up stale application state');
      
      // Reset all running states
      await this.setInStorage({
        applicationState: {
          isRunning: false,
          endTime: new Date().toISOString()
        },
        jobGatheringSession: {
          isGathering: false,
          endTime: new Date().toISOString()
        },
        applicationSession: {
          isApplying: false,
          endTime: new Date().toISOString()
        }
      });
      
      // Close any open tabs
      if (this.currentTabId) {
        try {
          await this.closeTab(this.currentTabId);
          this.currentTabId = null;
        } catch (error) {
          console.error('Error closing stale tab:', error);
        }
      }
      
      console.log('✅ Stale state cleaned up');
    } catch (error) {
      console.error('Cleanup stale state error:', error);
    }
  }

  /**
   * Cleanup old errors
   */
  async cleanupErrors() {
    try {
      const errors = await this.getFromStorage(['errorLog']);
      if (errors.errorLog) {
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        const recentErrors = errors.errorLog.filter(error => 
          new Date(error.timestamp).getTime() > oneDayAgo
        );
        
        if (recentErrors.length !== errors.errorLog.length) {
          await this.setInStorage({ errorLog: recentErrors });
        }
      }
    } catch (error) {
      console.error('Cleanup errors error:', error);
    }
  }

  /**
   * Reload LinkedIn tabs
   */
  async reloadLinkedInTabs() {
    try {
      const tabs = await this.getLinkedInTabs();
      for (const tab of tabs) {
        await this.reloadTab(tab.id);
      }
    } catch (error) {
      console.error('Reload LinkedIn tabs error:', error);
    }
  }

  /**
   * Get LinkedIn tabs
   */
  async getLinkedInTabs() {
    return new Promise((resolve) => {
      chrome.tabs.query({ url: '*://*.linkedin.com/*' }, resolve);
    });
  }

  /**
   * Create new tab
   */
  async createTab(url) {
    return new Promise((resolve) => {
      chrome.tabs.create({ url, active: false }, resolve);
    });
  }

  /**
   * Close tab
   */
  async closeTab(tabId) {
    return new Promise((resolve) => {
      chrome.tabs.remove(tabId, resolve);
    });
  }

  /**
   * Get current tab URL
   */
  async getCurrentTabUrl(tabId) {
    return new Promise((resolve) => {
      chrome.tabs.get(tabId, (tab) => {
        resolve(tab ? tab.url : null);
      });
    });
  }

  /**
   * Reload tab
   */
  async reloadTab(tabId) {
    return new Promise((resolve) => {
      chrome.tabs.reload(tabId, resolve);
    });
  }

  /**
   * Get cookie
   */
  async getCookie(domain, name) {
    return new Promise((resolve) => {
      chrome.cookies.get({ url: domain, name }, resolve);
    });
  }

  /**
   * Set data in storage
   */
  async setInStorage(data) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Get data from storage
   */
  async getFromStorage(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, resolve);
    });
  }

  /**
   * Load state from storage
   */
  async loadState() {
    try {
      const result = await this.getFromStorage(['applicationState', 'jobGatheringSession', 'applicationSession']);
      
      // Check if there's a stale running state and clean it up
      if (result.applicationState && result.applicationState.isRunning) {
        const startTime = new Date(result.applicationState.startTime);
        const now = new Date();
        const timeDiff = now - startTime;
        
        // If the process has been "running" for more than 30 minutes, consider it stale
        if (timeDiff > 30 * 60 * 1000) {
          console.log('🧹 Cleaning up stale running state');
          await this.cleanupStaleState();
          this.isRunning = false;
          this.currentIndex = 0;
        } else {
          this.isRunning = result.applicationState.isRunning || false;
          this.currentIndex = result.applicationState.currentIndex || 0;
        }
      } else {
        this.isRunning = false;
        this.currentIndex = 0;
      }
      
      console.log('📊 Loaded state:', { isRunning: this.isRunning, currentIndex: this.currentIndex });
    } catch (error) {
      console.error('Load state error:', error);
      this.isRunning = false;
      this.currentIndex = 0;
    }
  }

  /**
   * Start session
   */
  async startSession(data) {
    try {
      const sessionData = {
        isRunning: true,
        startTime: new Date().toISOString(),
        settings: data,
        progress: {
          current: 0,
          total: data.job_count || 10,
          percentage: 0
        },
        applicationCount: 0,
        currentIndex: 0,
        jobLinks: [],
        appliedJobs: [],
        failedJobs: [],
        errors: []
      };
      
      await this.setInStorage({ applicationState: sessionData });
    } catch (error) {
      console.error('Start session error:', error);
    }
  }

  /**
   * Stop session
   */
  async stopSession() {
    try {
      const sessionData = {
        isRunning: false,
        endTime: new Date().toISOString()
      };
      
      await this.setInStorage({ applicationState: sessionData });
    } catch (error) {
      console.error('Stop session error:', error);
    }
  }

  /**
   * Update progress
   */
  async updateProgress(current, total) {
    try {
      const progress = {
        current,
        total,
        percentage: total > 0 ? Math.round((current / total) * 100) : 0
      };
      
      await this.setInStorage({ progress });
    } catch (error) {
      console.error('Update progress error:', error);
    }
  }

  /**
   * Get application state
   */
  async getApplicationState() {
    try {
      const result = await this.getFromStorage(['applicationState', 'progress']);
      return {
        ...result.applicationState,
        progress: result.progress
      };
    } catch (error) {
      console.error('Get application state error:', error);
      return {};
    }
  }

  /**
   * Get session stats
   */
  async getSessionStats() {
    try {
      const state = await this.getApplicationState();
      const duration = state.endTime && state.startTime 
        ? new Date(state.endTime) - new Date(state.startTime)
        : Date.now() - new Date(state.startTime);
      
      return {
        sessionId: `session_${Date.now()}`,
        duration: Math.round(duration / 1000),
        totalJobs: state.progress?.total || 0,
        appliedJobs: state.appliedJobs?.length || 0,
        failedJobs: state.failedJobs?.length || 0,
        successRate: state.progress?.total > 0 
          ? Math.round(((state.appliedJobs?.length || 0) / state.progress.total) * 100)
          : 0,
        errors: state.errors?.length || 0
      };
    } catch (error) {
      console.error('Get session stats error:', error);
      return {};
    }
  }

  /**
   * Get current job
   */
  async getCurrentJob() {
    try {
      const result = await this.getFromStorage(['currentJob']);
      return result.currentJob;
    } catch (error) {
      console.error('Get current job error:', error);
      return null;
    }
  }

  /**
   * Set current job
   */
  async setCurrentJob(jobData) {
    try {
      await this.setInStorage({ currentJob: jobData });
    } catch (error) {
      console.error('Set current job error:', error);
    }
  }

  /**
   * Mark job as applied
   */
  async markJobApplied(jobData) {
    try {
      const result = await this.getFromStorage(['appliedJobs']);
      const appliedJobs = result.appliedJobs || [];
      appliedJobs.push(jobData);
      await this.setInStorage({ appliedJobs });
    } catch (error) {
      console.error('Mark job applied error:', error);
    }
  }

  /**
   * Mark job as failed
   */
  async markJobFailed(jobData) {
    try {
      const result = await this.getFromStorage(['failedJobs']);
      const failedJobs = result.failedJobs || [];
      failedJobs.push(jobData);
      await this.setInStorage({ failedJobs });
    } catch (error) {
      console.error('Mark job failed error:', error);
    }
  }

  /**
   * Get total jobs
   */
  async getTotalJobs() {
    try {
      const result = await this.getFromStorage(['applicationState']);
      return result.applicationState?.progress?.total || 0;
    } catch (error) {
      console.error('Get total jobs error:', error);
      return 0;
    }
  }

  /**
   * Handle job gathering process
   */
  async handleGatherJobs(data) {
    try {
      // Check if process is running and handle it gracefully
      if (this.isRunning) {
        // Check if the running state is stale (more than 5 minutes old)
        const result = await this.getFromStorage(['applicationState']);
        if (result.applicationState && result.applicationState.startTime) {
          const startTime = new Date(result.applicationState.startTime);
          const now = new Date();
          const timeDiff = now - startTime;
          
          if (timeDiff > 5 * 60 * 1000) { // 5 minutes
            await this.cleanupStaleState();
            this.isRunning = false;
            this.isGatheringJobs = false;
          } else {
            throw new Error('Process is already running');
          }
        } else {
          await this.cleanupStaleState();
          this.isRunning = false;
          this.isGatheringJobs = false;
        }
      }

      // Validate data
      if (!this.validateJobGatheringData(data)) {
        throw new Error('Invalid job gathering data');
      }

      // Start job gathering session
      await this.startJobGatheringSession(data);
      
      this.isRunning = true;
      this.isGatheringJobs = true;

      // Check if we're on a LinkedIn jobs page
      this.currentGatheringData = data; // Store for manual injection if needed
      await this.checkCurrentLinkedInPage(data);

    } catch (error) {
      console.error('❌ Job gathering error:', error);
      await this.stopJobGatheringSession();
      this.isRunning = false;
      this.isGatheringJobs = false;
      throw error;
    }
  }

  /**
   * Handle start applications process (DEPRECATED - use startApplications instead)
   */
  async handleStartApplications() {
    console.log('⚠️ handleStartApplications is deprecated, use startApplications instead');
    return this.startApplications();
  }

  /**
   * Get job list from storage
   */
  async getJobList() {
    try {
      // First check session storage for jobs
      const session = await this.getFromStorage(['jobGatheringSession']);
      let jobs = [];
      let gatheringComplete = false;
      
      if (session.jobGatheringSession && session.jobGatheringSession.gatheredJobs) {
        jobs = session.jobGatheringSession.gatheredJobs;
        gatheringComplete = session.jobGatheringSession.gatheringComplete || false;
      } else {
        // Fallback to direct storage
        const result = await this.getFromStorage(['gatheredJobs', 'jobGatheringComplete']);
        jobs = result.gatheredJobs || [];
        gatheringComplete = result.jobGatheringComplete || false;
      }
      
      return {
        jobs: jobs,
        gatheringComplete: gatheringComplete
      };
    } catch (error) {
      console.error('❌ Get job list error:', error);
      return { jobs: [], gatheringComplete: false };
    }
  }

  /**
   * Start job gathering session
   */
  async startJobGatheringSession(data) {
    try {
      const sessionData = {
        isGathering: true,
        startTime: new Date().toISOString(),
        settings: data,
        gatheredJobs: [],
        gatheringComplete: false
      };
      
      await this.setInStorage({ 
        jobGatheringSession: sessionData,
        gatheredJobs: [],
        jobGatheringComplete: false
      });
      
      // Clear all saved job descriptions when starting a new session
      try {
        await chrome.storage.local.set({ savedJobDescriptions: {} });
        console.log('🗑️ Cleared all saved job descriptions');
      } catch (error) {
        console.error('❌ Error clearing saved descriptions:', error);
      }
      
      console.log('✅ Job gathering session started');
    } catch (error) {
      console.error('❌ Start job gathering session error:', error);
    }
  }

  /**
   * Stop job gathering session
   */
  async stopJobGatheringSession() {
    try {
      const sessionData = {
        isGathering: false,
        endTime: new Date().toISOString()
      };
      
      await this.setInStorage({ jobGatheringSession: sessionData });
      console.log('✅ Job gathering session stopped');
    } catch (error) {
      console.error('❌ Stop job gathering session error:', error);
    }
  }

  /**
   * Start application session
   */
  async startApplicationSession() {
    try {
      const sessionData = {
        isApplying: true,
        startTime: new Date().toISOString(),
        currentJobIndex: 0,
        appliedJobs: [],
        failedJobs: []
      };
      
      await this.setInStorage({ applicationSession: sessionData });
      console.log('✅ Application session started');
    } catch (error) {
      console.error('❌ Start application session error:', error);
    }
  }

  /**
   * Stop application session
   */
  async stopApplicationSession() {
    try {
      const sessionData = {
        isApplying: false,
        endTime: new Date().toISOString()
      };
      
      await this.setInStorage({ applicationSession: sessionData });
      console.log('✅ Application session stopped');
    } catch (error) {
      console.error('❌ Stop application session error:', error);
    }
  }

  /**
   * Process next job in the list
   */
  async processNextJob() {
    try {
      const jobList = await this.getJobList();
      const session = await this.getFromStorage(['applicationSession']);
      
      if (!session.applicationSession || !session.applicationSession.isApplying) {
        console.log('❌ Application session not active');
        return;
      }

      const currentIndex = session.applicationSession.currentJobIndex || 0;
      
      if (currentIndex >= jobList.jobs.length) {
        console.log('✅ All jobs processed, completing session');
        await this.completeApplicationSession();
        return;
      }

      const currentJob = jobList.jobs[currentIndex];
      console.log(`🔍 Processing job ${currentIndex + 1}/${jobList.jobs.length}:`, currentJob);

      // Navigate to the job page
      await this.navigateToJob(currentJob);
      
    } catch (error) {
      console.error('❌ Process next job error:', error);
      await this.handleJobError(null, error);
    }
  }

  /**
   * Navigate to a specific job
   */
  async navigateToJob(job) {
    try {
      console.log('🌐 Navigating to job:', job.url);
      
      if (this.currentTabId) {
        // Update existing tab
        await chrome.tabs.update(this.currentTabId, { url: job.url });
      } else {
        // Create new tab
        const tab = await this.createTab(job.url);
        this.currentTabId = tab.id;
      }
      
      console.log('✅ Navigation to job started');
      
    } catch (error) {
      console.error('❌ Navigate to job error:', error);
      throw error;
    }
  }

  /**
   * Complete application session
   */
  async completeApplicationSession() {
    try {
      this.isRunning = false;
      await this.stopApplicationSession();
      
      // Close current tab
      if (this.currentTabId) {
        await this.closeTab(this.currentTabId);
        this.currentTabId = null;
      }
      
      console.log('✅ Application session completed');
      
    } catch (error) {
      console.error('❌ Complete application session error:', error);
    }
  }

  /**
   * Add a job to the gathered job list
   */
  async addGatheredJob(job) {
    try {
      const session = await this.getFromStorage(['jobGatheringSession']);
      if (session.jobGatheringSession && session.jobGatheringSession.isGathering) {
        const gatheredJobs = session.jobGatheringSession.gatheredJobs || [];
        gatheredJobs.push(job);
        await this.setInStorage({ jobGatheringSession: { ...session.jobGatheringSession, gatheredJobs } });
      }
    } catch (error) {
      console.error('Add gathered job error:', error);
    }
  }

  /**
   * Delete a job from the gathered list
   */
  async deleteJobFromList(jobId) {
    try {
      console.log('🗑️ Deleting job from list:', jobId);
      
      // Get current gathered jobs from session
      const session = await this.getFromStorage(['jobGatheringSession']);
      let gatheredJobs = [];
      
      if (session.jobGatheringSession && session.jobGatheringSession.gatheredJobs) {
        gatheredJobs = session.jobGatheringSession.gatheredJobs;
      } else {
        // Fallback to direct gatheredJobs storage
        const result = await this.getFromStorage(['gatheredJobs']);
        gatheredJobs = result.gatheredJobs || [];
      }
      
      // Find and remove the job using multiple identifiers
      const initialLength = gatheredJobs.length;
      gatheredJobs = gatheredJobs.filter(job => {
        const jobIdMatch = job.id === jobId;
        const jobUrlMatch = job.url === jobId;
        const jobTitleCompanyMatch = `${job.title}-${job.company}` === jobId;
        
        // Keep jobs that don't match any identifier
        return !jobIdMatch && !jobUrlMatch && !jobTitleCompanyMatch;
      });
      
      if (gatheredJobs.length < initialLength) {
        // Update both storage locations to keep them in sync
        await this.setInStorage({ gatheredJobs });
        
        // Update session
        if (session.jobGatheringSession) {
          await this.setInStorage({ 
            jobGatheringSession: { 
              ...session.jobGatheringSession, 
              gatheredJobs: gatheredJobs
            }
          });
        }
        
        // Also remove the saved job description from chrome.storage.local
        try {
          const result = await chrome.storage.local.get(['savedJobDescriptions']);
          const savedDescriptions = result.savedJobDescriptions || {};
          
          if (savedDescriptions[jobId]) {
            delete savedDescriptions[jobId];
            await chrome.storage.local.set({ savedJobDescriptions: savedDescriptions });
            console.log('🗑️ Removed saved description for job:', jobId);
          }
        } catch (error) {
          console.error('❌ Error removing saved description:', error);
        }
        
        console.log('✅ Job deleted from list. Remaining jobs:', gatheredJobs.length);
        return true;
      } else {
        console.log('⚠️ Job not found in list. JobId:', jobId);
        console.log('⚠️ Available jobs:', gatheredJobs.map(j => ({ id: j.id, url: j.url, title: j.title, company: j.company })));
        return false;
      }
      
    } catch (error) {
      console.error('❌ Delete job from list error:', error);
      return false;
    }
  }
  
  

  /**
   * Start applying to a single job (current page)
   */
  async startSingleApplication(data = {}) {
    try {
      console.log('🚀 Starting single application process...');
      
      // Get current active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length === 0) {
        console.log('❌ No active tab found');
        return { success: false, message: 'No active tab found' };
      }
      
      const currentTab = tabs[0];
      const currentUrl = currentTab.url;
      
      // Check if we're on a LinkedIn job page
      if (!currentUrl.includes('linkedin.com/jobs/view/')) {
        console.log('❌ Not on a LinkedIn job page');
        return { success: false, message: 'Please navigate to a LinkedIn job page first' };
      }
      
      console.log('🚀 Starting application for job at:', currentUrl);
      
      // Check if content script is already ready before injecting
      const isAlreadyReady = await this.isContentScriptReady(currentTab.id);
      if (!isAlreadyReady) {
        // Inject content script if not already present
        try {
          await chrome.scripting.executeScript({
            target: { tabId: currentTab.id },
            files: ['src/content/content.js']
          });
          console.log('✅ Content script injected successfully');
        } catch (error) {
          console.log('⚠️ Content script injection failed (might already be present):', error.message);
        }
      } else {
        console.log('✅ Content script already ready, skipping injection');
      }
      
      // Wait for content script to be ready
      const contentScriptReady = await this.waitForContentScriptReady(currentTab.id);
      if (!contentScriptReady) {
        console.log('❌ Content script not ready');
        return { success: false, message: 'Content script not ready' };
      }
      
      // Start the complete application process
      console.log('📡 Sending clickEasyApply message to tab:', currentTab.id);
      
      try {
        const response = await this.sendMessageToTabWithTimeout(currentTab.id, {
          type: 'clickEasyApply',
          data: { jobUrl: currentUrl }
        }, 60000); // 60 second timeout for complete application process
        
        console.log('📡 Response from content script:', response);
        
        if (response && response.success) {
          console.log('✅ Successfully completed application process');
          return { 
            success: true, 
            message: 'Successfully applied to job'
          };
        } else {
          console.log('❌ Failed to apply to job:', response?.message || response?.error);
          return { 
            success: false, 
            message: response?.message || response?.error || 'Failed to apply to job'
          };
        }
      } catch (error) {
        console.error('❌ Error during application process:', error);
        return { 
          success: false, 
          message: `Application process failed: ${error.message}`
        };
      }
      
    } catch (error) {
      console.error('❌ Error starting single application:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Start applying to all gathered jobs
   */
  async startApplications(data = {}) {
    try {
      console.log('🚀 Starting applications process...');
      
      // Set running state first
      this.isRunning = true;
      console.log('✅ Set isRunning = true for applications');
      
      // Get current gathered jobs
      const jobList = await this.getJobList();
      if (!jobList.jobs || jobList.jobs.length === 0) {
        console.log('❌ No jobs to apply to');
        this.isRunning = false;
        return { success: false, message: 'No jobs to apply to' };
      }
      
      console.log(`🚀 Found ${jobList.jobs.length} jobs to apply to`);
      
      // Get current active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length === 0) {
        console.log('❌ No active tab found');
        this.isRunning = false;
        return { success: false, message: 'No active tab found' };
      }
      
      const currentTab = tabs[0];
      let appliedCount = 0;
      let totalJobs = jobList.jobs.length;
      
      // Process each job
      for (let i = 0; i < jobList.jobs.length; i++) {
        // Check if process has been stopped
        if (!this.isRunning) {
          console.log('⏹️ Application process stopped by user');
          break;
        }
        
        const job = jobList.jobs[i];
        
        if (!job.url) {
          console.log(`❌ No URL for job: ${job.title}`);
          continue;
        }
        
        console.log(`🚀 Applying to job ${i + 1}/${totalJobs}: ${job.title}`);
        
        try {
          // Check stop signal before each step
          if (!this.isRunning) {
            console.log('⏹️ Stopping before navigation');
            break;
          }
          
          // Check if we're already on the correct job page
          const currentUrl = await this.getCurrentTabUrl(currentTab.id);
          const isOnCorrectPage = currentUrl && currentUrl.includes(job.url);
          
          if (!isOnCorrectPage) {
            // Navigate to job page only if not already there
            console.log(`🔄 Navigating to job page: ${job.title}`);
            await chrome.tabs.update(currentTab.id, { url: job.url });
            
            // Check stop signal after navigation
            if (!this.isRunning) {
              console.log('⏹️ Stopping after navigation');
              break;
            }
            
            // Wait for page to load
            await this.waitForPageLoad(currentTab.id);
            
            // Check stop signal after page load
            if (!this.isRunning) {
              console.log('⏹️ Stopping after page load');
              break;
            }
          } else {
            console.log(`✅ Already on correct page for: ${job.title}`);
          }
          
          // Wait for content script to be ready
          const contentScriptReady = await this.waitForContentScriptReady(currentTab.id);
          if (!contentScriptReady) {
            console.log(`❌ Content script not ready for job: ${job.title}`);
            continue;
          }
          
          // Check stop signal before applying
          if (!this.isRunning) {
            console.log('⏹️ Stopping before application');
            break;
          }
          
          // Try to click EasyApply button
          const response = await this.sendMessageToTab(currentTab.id, {
            type: 'clickEasyApply',
            data: { jobId: job.id || job.url, jobTitle: job.title }
          });
          
          if (response && response.success) {
            appliedCount++;
            console.log(`✅ Successfully applied to: ${job.title}`);
          } else {
            console.log(`❌ Failed to apply to: ${job.title} - ${response?.message || 'Unknown error'}`);
          }
          
          // Check stop signal before delay
          if (!this.isRunning) {
            console.log('⏹️ Stopping before delay');
            break;
          }
          
          // Add a delay between applications to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 3000));
          
        } catch (error) {
          console.error(`❌ Error applying to ${job.title}:`, error);
        }
      }
      
      console.log(`✅ Application process complete. Applied: ${appliedCount}/${totalJobs}`);
      
      // Check if process was stopped by user
      if (!this.isRunning) {
        console.log('⏹️ Process was stopped by user');
        return { 
          success: false, 
          appliedCount: appliedCount,
          totalJobs: totalJobs,
          stopped: true,
          message: 'Process stopped by user'
        };
      }
      
      return { 
        success: appliedCount > 0, 
        appliedCount: appliedCount,
        totalJobs: totalJobs
      };
      
    } catch (error) {
      console.error('❌ Error starting applications:', error);
      this.isRunning = false;
      return { success: false, message: error.message };
    }
  }

  /**
   * Fetch all job descriptions for gathered jobs
   */
  async fetchAllJobDescriptions() {
    try {
      console.log('📄 Starting to fetch all job descriptions...');
      
      // Get current gathered jobs
      const jobList = await this.getJobList();
      if (!jobList.jobs || jobList.jobs.length === 0) {
        console.log('❌ No jobs to fetch descriptions for');
        return false;
      }
      
      console.log(`📄 Found ${jobList.jobs.length} jobs to fetch descriptions for`);
      
      // Get current active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length === 0) {
        console.log('❌ No active tab found');
        return false;
      }
      
      const currentTab = tabs[0];
      let successCount = 0;
      let totalJobs = jobList.jobs.length;
      
      // Process each job
      for (let i = 0; i < jobList.jobs.length; i++) {
        const job = jobList.jobs[i];
        const jobId = job.id || job.url || `${job.title}-${job.company}`;
        
        if (!job.url) {
          console.log(`❌ No URL for job: ${job.title}`);
          continue;
        }
        
        console.log(`📄 Fetching description ${i + 1}/${totalJobs}: ${job.title}`);
        
        try {
          // Navigate to job page
          await chrome.tabs.update(currentTab.id, { url: job.url });
          
          // Wait for page to load
          await this.waitForPageLoad(currentTab.id);
          
          // Wait for content script to be ready
          const contentScriptReady = await this.waitForContentScriptReady(currentTab.id);
          if (!contentScriptReady) {
            console.log(`❌ Content script not ready for job: ${job.title}`);
            continue;
          }
          
          // Extract description
          const response = await this.sendMessageToTab(currentTab.id, {
            type: 'extractJobDescription',
            data: { jobId: jobId, jobUrl: job.url }
          });
          
          if (response && response.success) {
            successCount++;
            console.log(`✅ Successfully fetched description for: ${job.title}`);
          } else {
            console.log(`❌ Failed to fetch description for: ${job.title}`);
          }
          
          // Add a small delay between jobs to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (error) {
          console.error(`❌ Error fetching description for ${job.title}:`, error);
        }
      }
      
      console.log(`✅ Fetch all descriptions complete. Success: ${successCount}/${totalJobs}`);
      return successCount > 0;
      
    } catch (error) {
      console.error('❌ Error fetching all job descriptions:', error);
      return false;
    }
  }

  /**
   * Fetch job description from LinkedIn job page
   */
  async fetchJobDescription(data) {
    try {
      const { jobId, jobUrl } = data;
      
      if (!jobUrl) {
        console.log('❌ No job URL provided');
        return false;
      }
      
      // Get current active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length === 0) {
        console.log('❌ No active tab found');
        return false;
      }
      
      const currentTab = tabs[0];
      
      console.log('📄 Starting job description extraction for:', jobId);
      
      // Create a promise that will be resolved when we get the result
      const resultPromise = new Promise((resolve, reject) => {
        // Set up a one-time listener for the result
        const messageListener = (message, sender, sendResponse) => {
          if (message.type === 'jobDescriptionResult' && message.data.jobId === jobId) {
            // Remove the listener
            chrome.runtime.onMessage.removeListener(messageListener);
            
            if (message.data.success) {
              console.log('✅ Job description extracted successfully');
              resolve(true);
            } else {
              console.log('❌ Failed to extract job description:', message.data.error);
              resolve(false);
            }
          }
        };
        
        // Add the listener
        chrome.runtime.onMessage.addListener(messageListener);
        
        // Set a timeout
        setTimeout(() => {
          chrome.runtime.onMessage.removeListener(messageListener);
          console.log('❌ Job description extraction timed out');
          resolve(false);
        }, 30000); // 30 second timeout
      });
      
      // Send message to content script to start the process
      try {
        const response = await this.sendMessageToTab(currentTab.id, {
          type: 'extractJobDescription',
          data: { jobId, jobUrl }
        });
        
        if (!response || !response.success) {
          console.log('❌ Failed to start job description extraction');
          return false;
        }
        
        // Wait for the result
        return await resultPromise;
      } catch (error) {
        console.error('❌ Error sending message to content script:', error);
        return false;
      }
      
    } catch (error) {
      console.error('❌ Error fetching job description:', error);
      return false;
    }
  }

  /**
   * Complete the job gathering process
   */
  async completeJobGathering(jobs) {
    try {
      console.log('✅ Completing job gathering with jobs:', jobs);
      
      // Update gathered jobs in storage
      await this.setInStorage({ 
        gatheredJobs: jobs,
        jobGatheringComplete: true
      });
      
      // Update session
      const session = await this.getFromStorage(['jobGatheringSession']);
      if (session.jobGatheringSession && session.jobGatheringSession.isGathering) {
        await this.setInStorage({ 
          jobGatheringSession: { 
            ...session.jobGatheringSession, 
            gatheredJobs: jobs,
            gatheringComplete: true,
            endTime: new Date().toISOString()
          }
        });
      }
      
      this.isRunning = false;
      this.isGatheringJobs = false;
      
      console.log('✅ Job gathering session completed. Total jobs:', jobs.length);
      
    } catch (error) {
      console.error('❌ Complete job gathering error:', error);
    }
  }

  /**
   * Get random delay between min and max milliseconds
   */
  getRandomDelay(min = 1000, max = 10000) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Click Next button in LinkedIn application modal
   */
  async clickNextButton(tabId) {
    try {
      console.log('🚀 Clicking Next button via background script injection...');
      
      const [clickResult] = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
          console.log('🚀 Direct Next button click in page context...');
          
          // Find modal and Next button
          const modal = document.querySelector('.jobs-easy-apply-modal__content, .artdeco-modal__content');
          if (!modal) {
            console.log('❌ No modal found for clicking');
            return { success: false, error: 'No modal found' };
          }
          
                        const modalButtons = modal.querySelectorAll('button');
              
              // First, look for Review button (final step)
              const reviewButtons = Array.from(modalButtons).filter(btn => {
                const text = btn.textContent?.toLowerCase() || '';
                const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
                const dataReviewAttr = btn.getAttribute('data-live-test-easy-apply-review-button');
                return text.includes('review') || ariaLabel.includes('review your application') || dataReviewAttr !== null;
              });
              
              if (reviewButtons.length > 0) {
                const reviewButton = reviewButtons[0];
                console.log('🎯 Found Review button (final step):', {
                  text: reviewButton.textContent?.trim(),
                  ariaLabel: reviewButton.getAttribute('aria-label'),
                  dataReviewAttr: reviewButton.getAttribute('data-live-test-easy-apply-review-button')
                });
                
                // Check if button is clickable
                if (reviewButton.disabled) {
                  console.log('❌ Review button is disabled');
                  return { success: false, error: 'Review button is disabled' };
                }
                
                if (reviewButton.offsetParent === null) {
                  console.log('❌ Review button is not visible');
                  return { success: false, error: 'Review button is not visible' };
                }
                
                // Scroll button into view
                reviewButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // Click the button
                try {
                  reviewButton.click();
                  console.log('✅ Review button clicked successfully');
                  return { success: true, message: 'Review button clicked successfully', type: 'review' };
                } catch (clickError) {
                  console.error('❌ Error clicking Review button:', clickError);
                  return { success: false, error: clickError.message };
                }
              }
              
              // If no Review button, look for Next button
              const nextButtons = Array.from(modalButtons).filter(btn => {
                const text = btn.textContent?.toLowerCase() || '';
                const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
                return text.includes('next') || ariaLabel.includes('next') || ariaLabel.includes('continue to next step');
              });
              
              if (nextButtons.length === 0) {
                console.log('❌ No Next or Review button found');
                return { success: false, error: 'No Next or Review button found' };
              }
              
              const nextButton = nextButtons[0];
          console.log('🚀 Found Next button:', {
            text: nextButton.textContent?.trim(),
            ariaLabel: nextButton.getAttribute('aria-label'),
            disabled: nextButton.disabled,
            visible: nextButton.offsetParent !== null
          });
          
          // Check if button is clickable
          if (nextButton.disabled) {
            console.log('❌ Next button is disabled');
            return { success: false, error: 'Next button is disabled' };
          }
          
          if (nextButton.offsetParent === null) {
            console.log('❌ Next button is not visible');
            return { success: false, error: 'Next button is not visible' };
          }
          
          // Scroll button into view
          nextButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Click the button
          try {
            nextButton.click();
            console.log('✅ Next button clicked successfully');
            return { success: true, message: 'Next button clicked successfully' };
          } catch (clickError) {
            console.error('❌ Error clicking Next button:', clickError);
            return { success: false, error: clickError.message };
          }
        }
      });
      
      console.log('🚀 Background click result:', clickResult.result);
      return clickResult.result;
      
    } catch (error) {
      console.error('❌ Error with background click injection:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Inject job gatherer script manually
   */
  async injectJobGathererScript(tabId) {
    try {
      console.log('🔧 Injecting job gatherer script manually...');
      
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['src/content/job-gatherer.js']
      });
      
      console.log('✅ Job gatherer script injected successfully');
      

      
      // Try sending the message again
      const response = await this.sendMessageToTab(tabId, {
        type: 'startGathering',
        data: this.currentGatheringData
      });
      
      if (response && response.success) {
        console.log('✅ Job gathering started successfully after manual injection');
      } else {
        console.log('❌ Job gathering still failed after manual injection:', response?.error);
      }
      
    } catch (error) {
      console.error('❌ Failed to inject job gatherer script:', error);
    }
  }


  

  

  

  





}

// Initialize the service worker
const serviceWorker = new BackgroundServiceWorker(); 