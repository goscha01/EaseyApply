// Content Script for LinkedIn Job Automation
// Note: ES6 imports are not supported in content scripts, so we'll use inline constants

// Configuration constants
const CONFIG = {
  APPLICATION: {
    MAX_JOBS_PER_SESSION: 50,
    MIN_JOBS_PER_SESSION: 1,
    DEFAULT_DELAY: 2000,
    MAX_WAIT_TIME: 10000,
    RETRY_DELAY: 1000
  },
  SELECTORS: {
    JOB_TITLE: 'h1.job-details-jobs-unified-top-card__job-title',
    COMPANY_NAME: '.job-details-jobs-unified-top-card__company-name',
    LOCATION: '.job-details-jobs-unified-top-card__bullet',
    EASY_APPLY_BUTTON: 'button[aria-label*="Easy Apply"]',
    APPLY_BUTTON: 'button[aria-label*="Apply"]',
    SUBMIT_BUTTON: 'button[aria-label*="Submit"]',
    NEXT_BUTTON: 'button[aria-label*="Next"]',
    FORM_FIELDS: 'input, select, textarea',
    JOB_CARDS: '.job-card-container',
    JOB_LINKS: 'a[data-control-name="jobsearch_JobSearchCard"]'
  },
  MESSAGE_TYPES: {
    JOB_PROCESSED: 'jobProcessed',
    JOB_FAILED: 'jobFailed',
    NAVIGATION_COMPLETE: 'navigationComplete'
  }
};

// Simple error handler
class ErrorHandler {
  static async handleError(error, context) {
    console.error(`Error in ${context}:`, error);
    return {
      success: false,
      error: error.message,
      context: context
    };
  }
}

// Simple state manager
class StateManager {
  constructor() {
    this.state = {
      isProcessing: false,
      currentJob: null,
      progress: { current: 0, total: 0 }
    };
  }

  setState(newState) {
    this.state = { ...this.state, ...newState };
  }

  getState() {
    return this.state;
  }
}

// Job scraper functionality
class JobScraper {
  isJobDetailsPage() {
    return window.location.href.includes('/jobs/view/') || 
           document.querySelector(CONFIG.SELECTORS.JOB_TITLE) !== null;
  }

  isJobSearchPage() {
    return window.location.href.includes('/jobs/search') || 
           document.querySelector(CONFIG.SELECTORS.JOB_CARDS) !== null;
  }

  async scrapeJobInfo() {
    try {
      const jobTitle = document.querySelector(CONFIG.SELECTORS.JOB_TITLE)?.textContent?.trim();
      const companyName = document.querySelector(CONFIG.SELECTORS.COMPANY_NAME)?.textContent?.trim();
      const location = document.querySelector(CONFIG.SELECTORS.LOCATION)?.textContent?.trim();

      return {
        title: jobTitle || 'Unknown Job',
        company: companyName || 'Unknown Company',
        location: location || 'Unknown Location',
        url: window.location.href
      };
    } catch (error) {
      console.error('Error scraping job info:', error);
      return null;
    }
  }

  async collectJobLinks() {
    try {
      const jobLinks = document.querySelectorAll(CONFIG.SELECTORS.JOB_LINKS);
      return Array.from(jobLinks).map(link => link.href);
    } catch (error) {
      console.error('Error collecting job links:', error);
      return [];
    }
  }
}

// Form filler functionality
class FormFiller {
  constructor() {
    this.userData = null;
    this.init();
  }

  init() {
    console.log('Form filler initialized');
  }

  async loadUserData() {
    try {
      return new Promise((resolve) => {
        chrome.storage.local.get(['userData'], (result) => {
          this.userData = result.userData || {};
          resolve(this.userData);
        });
      });
    } catch (error) {
      console.error('Error loading user data:', error);
      return {};
    }
  }

  async fillApplicationForm() {
    try {
      await this.loadUserData();
      return await this.fillFormFields();
    } catch (error) {
      console.error('Error filling application form:', error);
      return { success: false, error: error.message };
    }
  }

  async fillFormFields() {
    const fields = [
      { selector: 'input[name="name"]', value: this.userData.name },
      { selector: 'input[name="email"]', value: this.userData.email },
      { selector: 'input[name="phone"]', value: this.userData.phone },
      { selector: 'input[name="address"]', value: this.userData.address },
      { selector: 'input[name="city"]', value: this.userData.city },
      { selector: 'input[name="state"]', value: this.userData.state },
      { selector: 'input[name="zip"]', value: this.userData.zip }
    ];

    // Get the popup container
    const popup = this.getPopupContainer();
    const container = popup || document;

    for (const field of fields) {
      if (field.value) {
        await this.fillFieldInContainer(field.selector, field.value, container);
      }
    }

    return { success: true };
  }

  getPopupContainer() {
    const popupSelectors = [
      '.jobs-easy-apply-content',
      '.jobs-apply-modal',
      '.artdeco-modal',
      '[role="dialog"]',
      '.modal-content'
    ];
    
    for (const selector of popupSelectors) {
      const popup = document.querySelector(selector);
      if (popup) {
        console.log('✅ Found popup container:', selector);
        return popup;
      }
    }
    
    console.log('⚠️ No popup container found, using main document');
    return null;
  }

  async fillFieldInContainer(selector, value, container) {
    const element = container.querySelector(selector);
    if (element) {
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Add visual feedback
      element.classList.add('easyapply-form-field', 'filled');
      
      console.log(`✅ Filled field ${selector} with value: ${value}`);
      await this.delay(500); // Small delay between fields
    } else {
      console.log(`⚠️ Field not found: ${selector}`);
    }
  }

  async handleAdditionalQuestions() {
    // Handle radio buttons
    await this.handleRadioButtons();
    
    // Handle checkboxes
    await this.handleCheckboxes();
    
    // Handle dropdowns
    await this.handleDropdowns();
    
    // Handle text areas
    await this.handleTextAreas();
  }

  async handleRadioButtons() {
    const popup = this.getPopupContainer();
    const container = popup || document;
    
    const radioGroups = container.querySelectorAll('input[type="radio"]');
    
    for (const radio of radioGroups) {
      const question = this.getQuestionText(radio);
      const answer = this.getAnswerForQuestion(question);
      
      if (answer && radio.value.toLowerCase().includes(answer.toLowerCase())) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
        console.log(`✅ Selected radio: "${question}" with value: "${radio.value}"`);
        await this.delay(300);
      }
    }
  }

  async handleCheckboxes() {
    const popup = this.getPopupContainer();
    const container = popup || document;
    
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    
    for (const checkbox of checkboxes) {
      const question = this.getQuestionText(checkbox);
      const answer = this.getAnswerForQuestion(question);
      
      if (answer && checkbox.value.toLowerCase().includes(answer.toLowerCase())) {
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        console.log(`✅ Checked checkbox: "${question}" with value: "${checkbox.value}"`);
        await this.delay(300);
      }
    }
  }

  async handleDropdowns() {
    const popup = this.getPopupContainer();
    const container = popup || document;
    
    const dropdowns = container.querySelectorAll('select');
    
    for (const dropdown of dropdowns) {
      const question = this.getQuestionText(dropdown);
      const answer = this.getAnswerForQuestion(question);
      
      if (answer) {
        const options = Array.from(dropdown.options);
        const matchingOption = options.find(option => 
          option.text.toLowerCase().includes(answer.toLowerCase())
        );
        
        if (matchingOption) {
          dropdown.value = matchingOption.value;
          dropdown.dispatchEvent(new Event('change', { bubbles: true }));
          console.log(`✅ Selected dropdown: "${question}" with option: "${matchingOption.text}"`);
          await this.delay(300);
        }
      }
    }
  }

  async handleTextAreas() {
    const popup = this.getPopupContainer();
    const container = popup || document;
    
    const textAreas = container.querySelectorAll('textarea');
    
    for (const textArea of textAreas) {
      const question = this.getQuestionText(textArea);
      const answer = this.getAnswerForQuestion(question);
      
      if (answer) {
        textArea.value = answer;
        textArea.dispatchEvent(new Event('input', { bubbles: true }));
        console.log(`✅ Filled textarea: "${question}" with: "${answer}"`);
        await this.delay(500);
      }
    }
  }

  getQuestionText(element) {
    // Try to find the question text in various ways
    const label = element.closest('label')?.textContent;
    const placeholder = element.placeholder;
    const ariaLabel = element.getAttribute('aria-label');
    const name = element.name;
    
    return label || placeholder || ariaLabel || name || '';
  }

  getAnswerForQuestion(question) {
    const lowerQuestion = question.toLowerCase();
    
    // Simple keyword matching for common questions
    if (lowerQuestion.includes('experience') || lowerQuestion.includes('years')) {
      return this.userData.experience || '5';
    }
    
    if (lowerQuestion.includes('salary') || lowerQuestion.includes('compensation')) {
      return this.userData.salary || '50000';
    }
    
    if (lowerQuestion.includes('location') || lowerQuestion.includes('city')) {
      return this.userData.city || '';
    }
    
    if (lowerQuestion.includes('remote') || lowerQuestion.includes('work from home')) {
      return 'Yes';
    }
    
    if (lowerQuestion.includes('visa') || lowerQuestion.includes('sponsorship')) {
      return 'No';
    }
    
    return '';
  }

  async submitForm() {
    try {
      console.log('🚀 Starting LinkedIn EasyApply submission process...');
      
      // Handle multi-step application process
      let step = 1;
      const maxSteps = 10; // Prevent infinite loops
      
      while (step <= maxSteps) {
        console.log(`📝 Processing application step ${step}...`);
        
        // Fill current step
        await this.fillCurrentStep();
        
        // Find and click Next button
        const nextButton = this.findNextButton();
        if (!nextButton) {
          console.log('❌ Next button not found, application may be complete');
          break;
        }
        
        console.log('⏭️ Clicking Next button...');
        nextButton.click();
        
        // Wait for next step to load
        await this.waitForNextStep();
        
        step++;
      }
      
      // Check if we reached the final submit
      const submitButton = this.findSubmitButton();
      if (submitButton) {
        console.log('✅ Found final submit button, completing application...');
        submitButton.click();
        await this.waitForSubmissionComplete();
      }
      
      return { success: true };
      
    } catch (error) {
      console.error('Error submitting form:', error);
      return { success: false, error: error.message };
    }
  }

  async fillCurrentStep() {
    try {
      // Fill basic form fields
      await this.fillFormFields();
      
      // Handle additional questions
      await this.handleAdditionalQuestions();
      
      // Small delay to ensure all fields are filled
      await this.delay(1000);
      
    } catch (error) {
      console.error('Error filling current step:', error);
    }
  }

  findNextButton() {
    const selectors = [
      '[data-easy-apply-next-button]',
      'button[aria-label*="Continue to next step"]',
      'button[aria-label*="Next"]',
      'button:contains("Next")',
      '.artdeco-button--primary:contains("Next")',
      'button[class*="primary"]:contains("Next")'
    ];
    
    // First try to find in popup/modal
    const popupSelectors = [
      '.jobs-easy-apply-content',
      '.jobs-apply-modal',
      '.artdeco-modal',
      '[role="dialog"]',
      '.modal-content'
    ];
    
    for (const popupSelector of popupSelectors) {
      const popup = document.querySelector(popupSelector);
      if (popup) {
        console.log('🔍 Searching for Next button in popup:', popupSelector);
        
        for (const selector of selectors) {
          const button = popup.querySelector(selector);
          if (button && button.visible && !button.disabled) {
            console.log('✅ Found Next button in popup:', button.textContent.trim());
            return button;
          }
        }
      }
    }
    
    // If not found in popup, try main document
    for (const selector of selectors) {
      const button = document.querySelector(selector);
      if (button && button.visible && !button.disabled) {
        console.log('✅ Found Next button in main document:', button.textContent.trim());
        return button;
      }
    }
    
    console.log('❌ Next button not found in popup or main document');
    return null;
  }

  async waitForNextStep() {
    return new Promise((resolve) => {
      const maxWaitTime = 5000;
      const checkInterval = 200;
      let elapsed = 0;
      
      const checkNextStep = () => {
        // Check if new form elements have loaded
        const newFormElements = document.querySelectorAll('.jobs-easy-apply-content input, .jobs-easy-apply-content select, .jobs-easy-apply-content textarea');
        
        if (newFormElements.length > 0) {
          console.log('✅ Next step loaded');
          resolve();
        } else if (elapsed >= maxWaitTime) {
          console.log('⚠️ Next step timeout, continuing...');
          resolve();
        } else {
          elapsed += checkInterval;
          setTimeout(checkNextStep, checkInterval);
        }
      };
      
      checkNextStep();
    });
  }

  findSubmitButton() {
    const selectors = [
      '[aria-label="Submit your application"]',
      'button[type="submit"]',
      '.jobs-apply-form__submit-button',
      'button:contains("Submit")',
      'button:contains("Apply")'
    ];
    
    for (const selector of selectors) {
      const button = document.querySelector(selector);
      if (button && button.visible) {
        return button;
      }
    }
    
    return null;
  }

  async waitForSubmissionComplete() {
    return new Promise((resolve, reject) => {
      const maxWaitTime = 10000;
      const checkInterval = 500;
      let elapsed = 0;
      
      const checkComplete = () => {
        // Check for success indicators
        const successIndicators = [
          '.jobs-apply-form__success',
          '[data-test-id="application-submitted"]',
          '.jobs-apply-form__submitted'
        ];
        
        const isComplete = successIndicators.some(selector => 
          document.querySelector(selector)
        );
        
        if (isComplete) {
          resolve();
        } else if (elapsed >= maxWaitTime) {
          reject(new Error('Form submission timeout'));
        } else {
          elapsed += checkInterval;
          setTimeout(checkComplete, checkInterval);
        }
      };
      
      checkComplete();
    });
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Navigation handler
class NavigationHandler {
  async navigateToNextJob() {
    try {
      // Simple navigation logic
      const nextButton = document.querySelector('button[aria-label*="Next"]');
      if (nextButton) {
        nextButton.click();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error navigating to next job:', error);
      return false;
    }
  }
}

// Initialize instances
const stateManager = new StateManager();
const jobScraper = new JobScraper();
const formFiller = new FormFiller();
const navigationHandler = new NavigationHandler();

/**
 * Main Content Script for LinkedIn Job Automation
 */
class ContentScript {
  constructor() {
    this.isProcessing = false;
    this.currentJob = null;
    this.isInitialized = false;
    this.init();
  }

  /**
   * Initialize the content script
   */
  async init() {
    try {
      console.log('EasyApply content script initializing...');
      
      // Listen for messages from background script
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        this.handleMessage(message, sender, sendResponse);
        return true; // Keep message channel open
      });

      // Initialize based on page type
      if (jobScraper.isJobDetailsPage()) {
        await this.initializeJobPage();
      } else if (jobScraper.isJobSearchPage()) {
        await this.initializeSearchPage();
      }

      this.isInitialized = true;
      console.log('EasyApply content script initialized successfully');

    } catch (error) {
      console.error('Content script initialization failed:', error);
    }
  }

  /**
   * Handle messages from background script
   */
  async handleMessage(message, sender, sendResponse) {
    try {
      console.log('Content script received message:', message.type);

      switch (message.type) {
        case 'processJobPage':
          await this.processJobPage(message.data);
          sendResponse({ success: true });
          break;

        case 'navigateToNextJob':
          await this.navigateToNextJob();
          sendResponse({ success: true });
          break;

        case 'getJobInfo':
          const jobInfo = await this.getJobInfo();
          sendResponse({ success: true, data: jobInfo });
          break;

        case 'applyToJob':
          const result = await this.applyToJob();
          sendResponse({ success: true, data: result });
          break;

        case 'clickEasyApply':
          console.log('🚀 Received clickEasyApply message');
          console.log('🚀 Message data:', message.data);
          console.log('🚀 Current URL:', window.location.href);
          console.log('🚀 Page title:', document.title);
          
          try {
            console.log('🚀 Starting EasyApply process...');
            const applyResult = await this.applyToJob();
            console.log('🚀 Apply result:', applyResult);
            sendResponse(applyResult);
          } catch (error) {
            console.error('❌ Error in EasyApply process:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'checkReady':
          // Check if the content script is ready
          const isReady = this.isInitialized || document.readyState === 'complete';
          sendResponse({ ready: isReady });
          break;

        default:
          console.warn('Unknown message type:', message.type);
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      if (ErrorHandler) {
        await ErrorHandler.handleError(error, 'content-message-handling');
      }
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Initialize job details page
   */
  async initializeJobPage() {
    try {
      console.log('Initializing job details page');
      
      // Wait for page to load
      await this.waitForPageLoad();
      
      // Scrape job information
      const jobData = await jobScraper.scrapeJobInfo();
      this.currentJob = jobData;
      
      // Update state if available
      if (stateManager) {
        stateManager.setState({ currentJob: jobData });
      }
      
      console.log('Job page initialized:', jobData.title);
      
    } catch (error) {
      console.error('Failed to initialize job page:', error);
      if (ErrorHandler) {
        await ErrorHandler.handleError(error, 'initialize-job-page');
      }
    }
  }

  /**
   * Initialize job search page
   */
  async initializeSearchPage() {
    try {
      console.log('Initializing job search page');
      
      // Wait for page to load
      await this.waitForPageLoad();
      
      // Collect job links
      const jobLinks = await jobScraper.collectJobLinks();
      
      // Update state if available
      if (stateManager) {
        stateManager.setState({ jobLinks });
      }
      
      console.log('Search page initialized, found', jobLinks.length, 'jobs');
      
    } catch (error) {
      console.error('Failed to initialize search page:', error);
      if (ErrorHandler) {
        await ErrorHandler.handleError(error, 'initialize-search-page');
      }
    }
  }

  /**
   * Process current job page
   */
  async processJobPage(data) {
    try {
      if (this.isProcessing) {
        console.log('Already processing a job, skipping');
        return;
      }

      this.isProcessing = true;
      console.log('Processing job page:', data);

      // Get job information
      const jobInfo = await this.getJobInfo();
      
      if (!jobInfo) {
        throw new Error('Failed to get job information');
      }

      // Check if job has Easy Apply
      if (!jobInfo.easyApply) {
        console.log('Job does not have Easy Apply, skipping');
        await this.skipJob();
        return;
      }

      // Apply to the job
      const result = await this.applyToJob();
      
      if (result.success) {
        console.log('Successfully applied to job:', jobInfo.title);
        if (stateManager) {
          stateManager.markJobApplied(jobInfo);
        }
      } else {
        console.log('Failed to apply to job:', jobInfo.title);
        if (stateManager) {
          stateManager.markJobFailed({
            ...jobInfo,
            error: result.error
          });
        }
      }

      // Update progress if state manager is available
      if (stateManager) {
        const currentProgress = stateManager.getState().progress.current + 1;
        stateManager.updateProgress(currentProgress);
      }

    } catch (error) {
      console.error('Error processing job page:', error);
      if (ErrorHandler) {
        await ErrorHandler.handleError(error, 'process-job-page');
      }
      if (stateManager) {
        stateManager.addError(error, 'job-processing');
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get current job information
   */
  async getJobInfo() {
    try {
      if (this.currentJob) {
        return this.currentJob;
      }

      const jobData = await jobScraper.scrapeJobInfo();
      this.currentJob = jobData;
      return jobData;

    } catch (error) {
      console.error('Error getting job info:', error);
      if (ErrorHandler) {
        await ErrorHandler.handleError(error, 'get-job-info');
      }
      return null;
    }
  }

  /**
   * Apply to current job
   */
  async applyToJob() {
    try {
      console.log('Starting job application process');

      // Find and click Easy Apply button
      const applyButton = await this.findApplyButton();
      if (!applyButton) {
        throw new Error('Easy Apply button not found');
      }

      // Click apply button
      await this.clickElement(applyButton);
      
      // Wait for application form to load
      await this.waitForApplicationForm();
      
      // Fill out the application form
      const formResult = await formFiller.fillApplicationForm();
      
      if (!formResult.success) {
        throw new Error(formResult.error);
      }
      
      // Submit the application
      const submitResult = await formFiller.submitForm();
      
      if (!submitResult.success) {
        throw new Error(submitResult.error);
      }

      return { success: true };

    } catch (error) {
      console.error('Error applying to job:', error);
      if (ErrorHandler) {
        await ErrorHandler.handleError(error, 'apply-to-job');
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Find Easy Apply button
   */
  async findApplyButton() {
    const selectors = [
      '[data-control-name="jobdetails_topcard_inapply"]',
      '.jobs-apply-button',
      '[aria-label*="Easy Apply"]',
      'button[class*="apply"]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.visible) {
        return element;
      }
    }

    return null;
  }

  /**
   * Click an element
   */
  async clickElement(element) {
    return new Promise((resolve) => {
      element.click();
      setTimeout(resolve, 1000);
    });
  }

  /**
   * Wait for application form to load
   */
  async waitForApplicationForm() {
    return new Promise((resolve, reject) => {
      const maxWaitTime = CONFIG ? CONFIG.APPLICATION.MAX_WAIT_TIME : 10000;
      const checkInterval = 500;
      let elapsed = 0;

      const checkForm = () => {
        const formSelectors = [
          '.jobs-easy-apply-content',
          '[data-test-id="application-form"]',
          '.jobs-apply-form'
        ];

        const formLoaded = formSelectors.some(selector => 
          document.querySelector(selector)
        );

        if (formLoaded) {
          resolve();
        } else if (elapsed >= maxWaitTime) {
          reject(new Error('Application form failed to load'));
        } else {
          elapsed += checkInterval;
          setTimeout(checkForm, checkInterval);
        }
      };

      checkForm();
    });
  }

  /**
   * Navigate to next job
   */
  async navigateToNextJob() {
    try {
      console.log('Navigating to next job');
      
      const result = await navigationHandler.navigateToNextJob();
      return result;

    } catch (error) {
      console.error('Error navigating to next job:', error);
      if (ErrorHandler) {
        await ErrorHandler.handleError(error, 'navigate-to-next-job');
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Skip current job
   */
  async skipJob() {
    try {
      console.log('Skipping current job');
      
      // Find close button
      const closeButton = document.querySelector('[aria-label="Dismiss"]') ||
                         document.querySelector('.jobs-apply-form__dismiss') ||
                         document.querySelector('[data-test-id="close-form"]');

      if (closeButton) {
        await this.clickElement(closeButton);
      }

    } catch (error) {
      console.error('Error skipping job:', error);
      if (ErrorHandler) {
        await ErrorHandler.handleError(error, 'skip-job');
      }
    }
  }

  /**
   * Wait for page to load
   */
  async waitForPageLoad() {
    return new Promise((resolve) => {
      if (document.readyState === 'complete') {
        resolve();
      } else {
        window.addEventListener('load', resolve);
      }
    });
  }
}

// Initialize content script
const contentScript = new ContentScript(); 