// Content Script for LinkedIn Job Automation
// Note: ES6 imports are not supported in content scripts, so we'll use inline constants

// Prevent duplicate initialization
if (window.easyApplyContentScriptInitialized) {
  console.log('🔄 EasyApply content script already initialized, skipping...');
} else {
  window.easyApplyContentScriptInitialized = true;
  console.log('🚀 Initializing EasyApply content script...');

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

// Smart form field learning and storage system
class SmartFormFiller {
  constructor() {
    this.fieldHistory = new Map();
    this.currentSession = new Map();
    this.init();
  }

  async init() {
    await this.loadFieldHistory();
    this.setupFieldMonitoring();
  }

  async loadFieldHistory() {
    try {
      // Check if extension context is valid
      if (!this.isExtensionContextValid()) {
        console.warn('⚠️ Extension context not valid, trying localStorage fallback');
        // Try localStorage as fallback
        try {
          const stored = localStorage.getItem('easyapply_field_history');
          if (stored) {
            const fieldHistoryObj = JSON.parse(stored);
            this.fieldHistory = new Map(Object.entries(fieldHistoryObj));
            console.log('✅ Loaded field history from localStorage:', this.fieldHistory.size, 'fields');
          } else {
            this.fieldHistory = new Map();
            console.log('✅ No field history found in localStorage, starting empty');
          }
        } catch (localError) {
          console.warn('⚠️ localStorage also failed, starting with empty field history');
          this.fieldHistory = new Map();
        }
        return;
      }

      const stored = await chrome.storage.local.get('fieldHistory');
      this.fieldHistory = new Map(Object.entries(stored.fieldHistory || {}));
      console.log('✅ Loaded field history:', this.fieldHistory.size, 'fields');
    } catch (error) {
      if (error.message.includes('Extension context invalidated')) {
        console.warn('⚠️ Extension context invalidated, trying localStorage fallback');
        // Try localStorage as fallback
        try {
          const stored = localStorage.getItem('easyapply_field_history');
          if (stored) {
            const fieldHistoryObj = JSON.parse(stored);
            this.fieldHistory = new Map(Object.entries(fieldHistoryObj));
            console.log('✅ Loaded field history from localStorage:', this.fieldHistory.size, 'fields');
          } else {
            this.fieldHistory = new Map();
            console.log('✅ No field history found in localStorage, starting empty');
          }
        } catch (localError) {
          console.warn('⚠️ localStorage also failed, starting with empty field history');
          this.fieldHistory = new Map();
        }
      } else {
        console.error('❌ Error loading field history:', error);
        this.fieldHistory = new Map();
      }
    }
  }

  async saveFieldHistory() {
    try {
      // Check if extension context is valid
      if (!this.isExtensionContextValid()) {
        console.warn('⚠️ Extension context not valid, trying localStorage fallback');
        // Try localStorage as fallback
        try {
          const fieldHistoryObj = Object.fromEntries(this.fieldHistory);
          localStorage.setItem('easyapply_field_history', JSON.stringify(fieldHistoryObj));
          console.log('✅ Saved field history to localStorage:', this.fieldHistory.size, 'fields');
        } catch (localError) {
          console.warn('⚠️ localStorage also failed, field history not saved');
        }
        return;
      }

      const fieldHistoryObj = Object.fromEntries(this.fieldHistory);
      await chrome.storage.local.set({ fieldHistory: fieldHistoryObj });
      console.log('✅ Saved field history:', this.fieldHistory.size, 'fields');
    } catch (error) {
      if (error.message.includes('Extension context invalidated')) {
        console.warn('⚠️ Extension context invalidated, trying localStorage fallback');
        // Try localStorage as fallback
        try {
          const fieldHistoryObj = Object.fromEntries(this.fieldHistory);
          localStorage.setItem('easyapply_field_history', JSON.stringify(fieldHistoryObj));
          console.log('✅ Saved field history to localStorage:', this.fieldHistory.size, 'fields');
        } catch (localError) {
          console.warn('⚠️ localStorage also failed, field history not saved');
        }
      } else {
        console.error('❌ Error saving field history:', error);
      }
    }
  }

  setupFieldMonitoring() {
    // Monitor for form field changes
    document.addEventListener('input', (event) => {
      this.handleFieldInput(event);
    }, true);

    // Monitor for radio button changes
    document.addEventListener('change', (event) => {
      if (event.target.type === 'radio') {
        this.handleRadioButtonChange(event);
      }
    }, true);

    // Monitor for form submissions to save current session
    document.addEventListener('submit', (event) => {
      this.saveCurrentSession();
    }, true);

    // Monitor for Next/Review button clicks
    document.addEventListener('click', (event) => {
      if (this.isNextOrReviewButton(event.target)) {
        this.saveCurrentSession();
      }
    }, true);
  }

  handleFieldInput(event) {
    const field = event.target;
    if (this.isFormField(field)) {
      const fieldInfo = this.extractFieldInfo(field);
      if (fieldInfo && field.value.trim()) {
        this.currentSession.set(fieldInfo.key, {
          ...fieldInfo,
          value: field.value.trim(),
          timestamp: Date.now()
        });
        console.log('📝 Field input detected:', fieldInfo.key, field.value);
      }
    }
  }

  handleRadioButtonChange(event) {
    const radioButton = event.target;
    if (radioButton.type === 'radio' && radioButton.checked) {
      const fieldInfo = this.extractFieldInfo(radioButton);
      if (fieldInfo) {
        // Get the selected option text
        const selectedOption = radioButton.closest('label')?.textContent?.trim() || 
                             radioButton.nextElementSibling?.textContent?.trim() || 
                             radioButton.value;
        
        this.currentSession.set(fieldInfo.key, {
          ...fieldInfo,
          value: selectedOption,
          timestamp: Date.now()
        });
        console.log('📝 Radio button selection detected:', fieldInfo.key, selectedOption);
      }
    }
  }

  isFormField(element) {
    return element.tagName === 'INPUT' || 
           element.tagName === 'SELECT' || 
           element.tagName === 'TEXTAREA';
  }

  isNextOrReviewButton(element) {
    const text = element.textContent?.toLowerCase() || '';
    const ariaLabel = element.getAttribute('aria-label')?.toLowerCase() || '';
    return text.includes('next') || text.includes('review') || 
           ariaLabel.includes('next') || ariaLabel.includes('review');
  }

  extractFieldInfo(field) {
    try {
      // Get field label/description
      const label = this.getFieldLabel(field);
      const placeholder = field.placeholder || '';
      const ariaLabel = field.getAttribute('aria-label') || '';
      const name = field.name || '';
      const id = field.id || '';
      const type = field.type || field.tagName.toLowerCase();
      
      // Get validation/requirement messages
      const validationMessage = this.getValidationMessage(field);
      
      // Create a unique key for this field
      const key = this.generateFieldKey(label, placeholder, ariaLabel, name, id, type, validationMessage);
      
      return {
        key,
        label,
        placeholder,
        ariaLabel,
        name,
        id,
        type,
        validationMessage,
        selector: this.generateFieldSelector(field)
      };
    } catch (error) {
      console.error('❌ Error extracting field info:', error);
      return null;
    }
  }

  getFieldLabel(field) {
    // Try to find the label for this field
    let label = '';
    
    // Check for associated label
    if (field.id) {
      const labelElement = document.querySelector(`label[for="${field.id}"]`);
      if (labelElement) {
        label = labelElement.textContent?.trim() || '';
      }
    }
    
    // Check for parent label
    if (!label) {
      const parentLabel = field.closest('label');
      if (parentLabel) {
        label = parentLabel.textContent?.trim() || '';
      }
    }
    
    // For radio buttons, check for group title
    if (!label && field.type === 'radio') {
      label = this.findRadioGroupTitle(field);
    }
    
    // Check for nearby text
    if (!label) {
      const nearbyText = this.findNearbyText(field);
      if (nearbyText) {
        label = nearbyText;
      }
    }
    
    return label;
  }

  findNearbyText(field) {
    // Look for text near the field
    const container = field.closest('.jobs-apply-form__field, .jobs-apply-form__section, .artdeco-form-field') || field.parentElement;
    if (container) {
      const textElements = container.querySelectorAll('label, span, div, p, h1, h2, h3, h4, h5, h6');
      for (const element of textElements) {
        const text = element.textContent?.trim();
        if (text && text.length > 0 && text.length < 200) {
          return text;
        }
      }
    }
    return '';
  }

  findRadioGroupTitle(field) {
    // For radio buttons, find the group title
    try {
      // Look for the radio group container
      const radioGroup = field.closest('.artdeco-form-field, .jobs-apply-form__field, [role="radiogroup"]') || field.parentElement;
      
      if (radioGroup) {
        // Look for title/legend elements
        const titleSelectors = [
          'legend',
          '.artdeco-form-field__label',
          '.jobs-apply-form__field-label',
          'label[class*="label"]',
          'span[aria-hidden="true"]',
          'div[class*="label"]',
          'p[class*="label"]',
          'h1, h2, h3, h4, h5, h6'
        ];
        
        for (const selector of titleSelectors) {
          const titleElement = radioGroup.querySelector(selector);
          if (titleElement) {
            const text = titleElement.textContent?.trim();
            if (text && text.length > 0 && text.length < 200) {
              console.log('✅ Found radio group title:', text);
              return text;
            }
          }
        }
        
        // Look for any text content in the group that might be the title
        const allTextElements = radioGroup.querySelectorAll('span, div, p, label, legend');
        for (const element of allTextElements) {
          const text = element.textContent?.trim();
          if (text && text.length > 0 && text.length < 200 && !text.includes('Yes') && !text.includes('No')) {
            // Check if this text appears before the radio buttons
            const radioButtons = radioGroup.querySelectorAll('input[type="radio"]');
            if (radioButtons.length > 0) {
              const firstRadio = radioButtons[0];
              if (element.compareDocumentPosition(firstRadio) & Node.DOCUMENT_POSITION_PRECEDING) {
                console.log('✅ Found radio group title (before radio buttons):', text);
                return text;
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ Error finding radio group title:', error);
    }
    
    return '';
  }

  getValidationMessage(field) {
    // Look for validation messages
    const validationSelectors = [
      '.artdeco-inline-feedback__message',
      '.artdeco-form-error',
      '.artdeco-form-help',
      '[role="alert"]',
      '.error-message',
      '.help-text'
    ];
    
    for (const selector of validationSelectors) {
      const messageElement = field.closest('*').querySelector(selector);
      if (messageElement) {
        return messageElement.textContent?.trim() || '';
      }
    }
    
    return '';
  }

  generateFieldKey(label, placeholder, ariaLabel, name, id, type, validationMessage) {
    // Create a unique key based on field characteristics
    const parts = [label, placeholder, ariaLabel, name, id, type, validationMessage]
      .filter(part => part && part.length > 0)
      .map(part => part.toLowerCase().replace(/[^a-z0-9]/g, ''));
    
    return parts.join('_') || `field_${Date.now()}`;
  }

  generateFieldSelector(field) {
    // Generate a CSS selector for this field
    if (field.id) {
      return `#${field.id}`;
    } else if (field.name) {
      return `[name="${field.name}"]`;
    } else {
      return `${field.tagName.toLowerCase()}[type="${field.type}"]`;
    }
  }

  async saveCurrentSession() {
    if (this.currentSession.size === 0) return;
    
    console.log('💾 Saving current session:', this.currentSession.size, 'fields');
    
    try {
      // Merge current session with field history
      for (const [key, fieldData] of this.currentSession) {
        this.fieldHistory.set(key, {
          ...fieldData,
          lastUsed: Date.now(),
          useCount: (this.fieldHistory.get(key)?.useCount || 0) + 1
        });
      }
      
      // Save to storage
      await this.saveFieldHistory();
      
      // Clear current session
      this.currentSession.clear();
    } catch (error) {
      console.warn('⚠️ Error saving current session:', error.message);
      // Don't throw error, just log warning
    }
  }

  async getStoredValue(field) {
    const fieldInfo = this.extractFieldInfo(field);
    if (!fieldInfo) return null;
    
    const storedField = this.fieldHistory.get(fieldInfo.key);
    if (storedField) {
      console.log('🎯 Found stored value for field:', fieldInfo.key, storedField.value);
      return storedField.value;
    }
    
    return null;
  }

  async autoFillField(field) {
    const storedValue = await this.getStoredValue(field);
    if (storedValue) {
      field.value = storedValue;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Add visual feedback
      field.classList.add('easyapply-auto-filled');
      
      console.log('✅ Auto-filled field:', field.name || field.id, 'with value:', storedValue);
      return true;
    }
    return false;
  }

  async autoFillAllFields() {
    const popup = this.getPopupContainer();
    const container = popup || document;
    
    const fields = container.querySelectorAll('input, select, textarea');
    let filledCount = 0;
    
    for (const field of fields) {
      if (await this.autoFillField(field)) {
        filledCount++;
        await this.delay(200); // Small delay between fields
      }
    }
    
    console.log(`✅ Auto-filled ${filledCount} fields`);
    return filledCount;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  isExtensionContextValid() {
    try {
      return typeof chrome !== 'undefined' && 
             chrome.storage && 
             chrome.storage.local &&
             chrome.runtime && 
             chrome.runtime.id;
    } catch (error) {
      return false;
    }
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
      if (popup) return popup;
    }
    
    return null;
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
      
      // First try to auto-fill with smart form filler
      const autoFilledCount = await smartFormFiller.autoFillAllFields();
      
      // Then fill remaining fields with user data
      const result = await this.fillFormFields();
      
      return { 
        success: true, 
        autoFilledCount,
        message: `Auto-filled ${autoFilledCount} fields, filled ${result.filledCount || 0} with user data`
      };
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

    let filledCount = 0;
    for (const field of fields) {
      if (field.value) {
        await this.fillFieldInContainer(field.selector, field.value, container);
        filledCount++;
      }
    }

    return { success: true, filledCount };
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
        
        // Save field information for learning
        const fieldInfo = smartFormFiller.extractFieldInfo(radio);
        if (fieldInfo) {
          const selectedOption = radio.closest('label')?.textContent?.trim() || 
                               radio.nextElementSibling?.textContent?.trim() || 
                               radio.value;
          
          smartFormFiller.currentSession.set(fieldInfo.key, {
            ...fieldInfo,
            value: selectedOption,
            timestamp: Date.now()
          });
          console.log('📝 Radio button field saved:', fieldInfo.key, selectedOption);
        }
        
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
    let question = '';
    
    // For radio buttons, use enhanced title detection
    if (element.type === 'radio') {
      question = smartFormFiller.findRadioGroupTitle(element);
    }
    
    // Fallback to basic methods
    if (!question) {
      const label = element.closest('label')?.textContent;
      const placeholder = element.placeholder;
      const ariaLabel = element.getAttribute('aria-label');
      const name = element.name;
      
      question = label || placeholder || ariaLabel || name || '';
    }
    
    return question;
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
        
        // Save current session before moving to next step
        await smartFormFiller.saveCurrentSession();
        
        // Find and click Next button
        const nextButton = this.findNextButton();
        if (!nextButton) {
          console.log('❌ Next button not found, checking for submit button...');
          
          // Check if we reached the final submit
          const submitButton = this.findSubmitButton();
          if (submitButton) {
            console.log('✅ Found final submit button, completing application...');
            console.log('🔍 Submit button details:', {
              text: submitButton.textContent,
              ariaLabel: submitButton.getAttribute('aria-label'),
              className: submitButton.className
            });
            
            // Click the submit button
            submitButton.click();
            console.log('✅ Submit button clicked');
            
            // Wait for submission to complete
            await this.waitForSubmissionComplete();
            console.log('✅ Application submission completed');
          } else {
            console.log('❌ No submit button found either, application may be complete');
          }
          break;
        }
        
        console.log('⏭️ Clicking Next button...');
        console.log('🔍 Next button details:', {
          text: nextButton.textContent,
          ariaLabel: nextButton.getAttribute('aria-label'),
          className: nextButton.className
        });
        
        // Click the next button
        nextButton.click();
        console.log('✅ Next button clicked');
        
        // Wait for next step to load
        await this.waitForNextStep();
        
        step++;
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
      'button[aria-label*="next"]',
      'button:contains("Next")',
      '.artdeco-button--primary:contains("Next")',
      'button[class*="primary"]:contains("Next")',
      'button[data-control-name="continue_unify"]',
      'button[data-control-name="submit_unify"]',
      '.artdeco-button--primary',
      'button.artdeco-button--primary'
    ];
    
    // First try to find in popup/modal
    const popupSelectors = [
      '.jobs-easy-apply-content',
      '.jobs-apply-modal',
      '.artdeco-modal',
      '[role="dialog"]',
      '.modal-content',
      '.jobs-apply-form'
    ];
    
    for (const popupSelector of popupSelectors) {
      const popup = document.querySelector(popupSelector);
      if (popup) {
        console.log('🔍 Searching for Next button in popup:', popupSelector);
        
        for (const selector of selectors) {
          try {
            const buttons = popup.querySelectorAll(selector);
            console.log(`🔍 Found ${buttons.length} buttons with selector "${selector}" in popup`);
            
            for (const button of buttons) {
              if (button && !button.disabled) {
                // Check if element is visible and not disabled
                const style = window.getComputedStyle(button);
                const isVisible = button.offsetParent !== null && 
                                style.display !== 'none' && 
                                style.visibility !== 'hidden' && 
                                style.opacity !== '0';
                
                if (isVisible) {
                  const text = button.textContent?.toLowerCase() || '';
                  const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
                  
                  console.log(`🔍 Button text: "${text}", aria-label: "${ariaLabel}"`);
                  
                  if (text.includes('next') || text.includes('continue') || 
                      ariaLabel.includes('next') || ariaLabel.includes('continue') ||
                      selector.includes('primary')) {
                    console.log('✅ Found Next button in popup:', button.textContent.trim());
                    return button;
                  }
                }
              }
            }
          } catch (error) {
            console.log(`❌ Error with selector "${selector}":`, error);
          }
        }
      }
    }
    
    // If not found in popup, try main document
    for (const selector of selectors) {
      try {
        const buttons = document.querySelectorAll(selector);
        console.log(`🔍 Found ${buttons.length} buttons with selector "${selector}" in main document`);
        
        for (const button of buttons) {
          if (button && !button.disabled) {
            // Check if element is visible and not disabled
            const style = window.getComputedStyle(button);
            const isVisible = button.offsetParent !== null && 
                            style.display !== 'none' && 
                            style.visibility !== 'hidden' && 
                            style.opacity !== '0';
            
            if (isVisible) {
              const text = button.textContent?.toLowerCase() || '';
              const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
              
              console.log(`🔍 Button text: "${text}", aria-label: "${ariaLabel}"`);
              
              if (text.includes('next') || text.includes('continue') || 
                  ariaLabel.includes('next') || ariaLabel.includes('continue') ||
                  selector.includes('primary')) {
                console.log('✅ Found Next button in main document:', button.textContent.trim());
                return button;
              }
            }
          }
        }
      } catch (error) {
        console.log(`❌ Error with selector "${selector}":`, error);
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
      'button:contains("Apply")',
      'button[aria-label*="Submit"]',
      'button[aria-label*="submit"]',
      'button[data-control-name="submit_unify"]',
      '.artdeco-button--primary:contains("Submit")',
      '.artdeco-button--primary:contains("Apply")'
    ];
    
    for (const selector of selectors) {
      try {
        const buttons = document.querySelectorAll(selector);
        console.log(`🔍 Found ${buttons.length} submit buttons with selector "${selector}"`);
        
        for (const button of buttons) {
          if (button && !button.disabled) {
            // Check if element is visible and not disabled
            const style = window.getComputedStyle(button);
            const isVisible = button.offsetParent !== null && 
                            style.display !== 'none' && 
                            style.visibility !== 'hidden' && 
                            style.opacity !== '0';
            
            if (isVisible) {
              const text = button.textContent?.toLowerCase() || '';
              const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
              
              console.log(`🔍 Submit button text: "${text}", aria-label: "${ariaLabel}"`);
              
              if (text.includes('submit') || text.includes('apply') || 
                  ariaLabel.includes('submit') || ariaLabel.includes('apply')) {
                console.log('✅ Found Submit button:', button.textContent.trim());
                return button;
              }
            }
          }
        }
      } catch (error) {
        console.log(`❌ Error with submit selector "${selector}":`, error);
      }
    }
    
    console.log('❌ Submit button not found');
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
            
            if (applyResult && applyResult.success) {
              console.log('✅ EasyApply process completed successfully');
              sendResponse(applyResult);
            } else {
              console.log('❌ EasyApply process failed:', applyResult?.error || applyResult?.message);
              sendResponse({ 
                success: false, 
                error: applyResult?.error || applyResult?.message || 'Unknown error during application process'
              });
            }
          } catch (error) {
            console.error('❌ Error in EasyApply process:', error);
            console.error('❌ Error stack:', error.stack);
            sendResponse({ 
              success: false, 
              error: `EasyApply process error: ${error.message}`,
              details: error.stack
            });
          }
          break;
          
        case 'debugEasyApply':
          console.log('🔍 Received debugEasyApply message');
          this.debugEasyApplyButton();
          sendResponse({ success: true, message: 'Debug completed - check console' });
          break;
          
        case 'testEasyApplyButton':
          console.log('🔍 Testing Easy Apply button detection...');
          try {
            const applyButton = await this.findApplyButton();
            if (applyButton) {
              console.log('✅ Easy Apply button found:', applyButton);
              sendResponse({ 
                success: true, 
                message: 'Easy Apply button found',
                buttonDetails: {
                  text: applyButton.textContent,
                  ariaLabel: applyButton.getAttribute('aria-label'),
                  className: applyButton.className,
                  id: applyButton.id
                }
              });
            } else {
              console.log('❌ Easy Apply button not found');
              sendResponse({ 
                success: false, 
                message: 'Easy Apply button not found on this page'
              });
            }
          } catch (error) {
            console.error('❌ Error testing Easy Apply button:', error);
            sendResponse({ 
              success: false, 
              error: `Error testing Easy Apply button: ${error.message}`
            });
          }
          break;
          
        case 'debugNextButton':
          console.log('🔍 Received debugNextButton message');
          const nextButton = formFiller.findNextButton();
          if (nextButton) {
            console.log('✅ Next button found:', nextButton);
            console.log('Button details:', {
              text: nextButton.textContent,
              ariaLabel: nextButton.getAttribute('aria-label'),
              className: nextButton.className,
              disabled: nextButton.disabled
            });
            sendResponse({ success: true, message: 'Next button found - check console' });
          } else {
            console.log('❌ Next button not found');
            sendResponse({ success: false, message: 'Next button not found - check console' });
          }
          break;

        case 'checkReady':
          // Check if the content script is ready
          const isReady = this.isInitialized || document.readyState === 'complete';
          console.log('🔍 Content script ready check:', {
            isInitialized: this.isInitialized,
            documentReadyState: document.readyState,
            isReady: isReady
          });
          sendResponse({ ready: isReady });
          break;
          
        case 'ping':
          console.log('🏓 Content script ping received');
          sendResponse({ success: true, message: 'Content script is alive!' });
          break;
          
        case 'debugFormDetection':
          console.log('🔍 Debugging form detection...');
          this.debugFormDetection();
          sendResponse({ success: true, message: 'Form detection debug completed - check console' });
          break;
          
        case 'debugFieldHistory':
          console.log('🔍 Debugging field history...');
          this.debugFieldHistory();
          sendResponse({ success: true, message: 'Field history debug completed - check console' });
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
      console.log('🚀 Starting job application process');
      console.log('📍 Current URL:', window.location.href);

      // Wait for page to fully load
      console.log('⏳ Waiting for page to fully load...');
      await this.waitForPageLoad();
      
      // Find and click Easy Apply button (with retry)
      let applyButton = await this.findApplyButton();
      if (!applyButton) {
        console.log('🔄 Button not found on first try, waiting and retrying...');
        await this.delay(2000); // Wait 2 seconds
        applyButton = await this.findApplyButton();
      }
      
      if (!applyButton) {
        console.log('❌ Easy Apply button not found on page');
        console.log('🔍 Page structure analysis:');
        
        // Analyze page structure for debugging
        const jobTitle = document.querySelector('h1, .jobs-unified-top-card__job-title, [data-test-id="job-details-job-title"]')?.textContent;
        const companyName = document.querySelector('.jobs-unified-top-card__company-name, [data-test-id="job-details-company-name"]')?.textContent;
        
        console.log('Job title:', jobTitle);
        console.log('Company name:', companyName);
        console.log('Page title:', document.title);
        
        // Check for common LinkedIn elements
        const hasJobDetails = document.querySelector('.jobs-unified-top-card') !== null;
        const hasApplySection = document.querySelector('[data-control-name="jobdetails_topcard_inapply"]') !== null;
        const hasButtons = document.querySelectorAll('button').length;
        
        console.log('Has job details card:', hasJobDetails);
        console.log('Has apply section:', hasApplySection);
        console.log('Total buttons on page:', hasButtons);
        
        // Show first few buttons for debugging
        const buttons = document.querySelectorAll('button');
        console.log('First 5 buttons on page:');
        for (let i = 0; i < Math.min(5, buttons.length); i++) {
          const btn = buttons[i];
          console.log(`  Button ${i + 1}: text="${btn.textContent?.trim()}", aria-label="${btn.getAttribute('aria-label')}", class="${btn.className}"`);
        }
        
        throw new Error('Easy Apply button not found');
      }

      // Click apply button
      console.log('🖱️ Clicking Easy Apply button...');
      await this.clickElement(applyButton);
      console.log('✅ Easy Apply button clicked');
      
      // Send progress update to sidepanel
      try {
        await chrome.runtime.sendMessage({
          type: 'updateApplicationProgress',
          data: { status: 'Easy Apply button clicked, waiting for form...' }
        });
      } catch (error) {
        console.log('⚠️ Could not send progress update:', error.message);
      }
      
      // Wait for application form to load
      console.log('⏳ Waiting for application form to load...');
      await this.waitForApplicationForm();
      console.log('✅ Application form loaded');
      
      // Send progress update to sidepanel
      try {
        await chrome.runtime.sendMessage({
          type: 'updateApplicationProgress',
          data: { status: 'Application form loaded, filling out form...' }
        });
      } catch (error) {
        console.log('⚠️ Could not send progress update:', error.message);
      }
      
      // Add delay to make process visible
      console.log('⏳ Processing application form...');
      await this.delay(2000);
      
      // Fill out the application form
      console.log('📝 Filling out application form...');
      const formResult = await formFiller.fillApplicationForm();
      
      if (!formResult.success) {
        throw new Error(formResult.error);
      }
      console.log('✅ Application form filled');
      
      // Send progress update to sidepanel
      try {
        await chrome.runtime.sendMessage({
          type: 'updateApplicationProgress',
          data: { status: 'Form filled, submitting application...' }
        });
      } catch (error) {
        console.log('⚠️ Could not send progress update:', error.message);
      }
      
      // Add delay to make process visible
      console.log('⏳ Submitting application...');
      await this.delay(2000);
      
      // Submit the application
      const submitResult = await formFiller.submitForm();
      
      if (!submitResult.success) {
        throw new Error(submitResult.error);
      }
      console.log('✅ Application submitted successfully');
      
      // Send progress update to sidepanel
      try {
        await chrome.runtime.sendMessage({
          type: 'updateApplicationProgress',
          data: { status: 'Application submitted successfully!' }
        });
      } catch (error) {
        console.log('⚠️ Could not send progress update:', error.message);
      }
      
      // Add final delay to ensure user sees completion
      console.log('⏳ Finalizing application...');
      await this.delay(2000);

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
   * Debug function to test Easy Apply button detection
   */
  debugEasyApplyButton() {
    console.log('🔍 Debugging Easy Apply button detection...');
    console.log('Current URL:', window.location.href);
    
    const selectors = [
      '[data-control-name="jobdetails_topcard_inapply"]',
      '[data-control-name="jobdetails_topcard_inapply"] button',
      'button[data-control-name="jobdetails_topcard_inapply"]',
      '.jobs-apply-button',
      '.jobs-apply-button button',
      'button.jobs-apply-button',
      '[data-control-name="jobdetails_topcard_inapply"] .artdeco-button',
      'button[aria-label*="Easy Apply"]',
      'button[aria-label*="Easy apply"]',
      'button[aria-label*="Apply"]',
      '.artdeco-button[aria-label*="Easy Apply"]',
      '.artdeco-button[aria-label*="Apply"]',
      'button[class*="apply"]'
    ];

    selectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        console.log(`🔍 Selector "${selector}": found ${elements.length} elements`);
        
        elements.forEach((element, index) => {
          const text = element.textContent?.toLowerCase() || '';
          const ariaLabel = element.getAttribute('aria-label')?.toLowerCase() || '';
          const isVisible = element.offsetParent !== null && !element.disabled;
          const style = window.getComputedStyle(element);
          const isDisplayed = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
          
          console.log(`  Element ${index + 1}: text="${text}", aria-label="${ariaLabel}", visible=${isVisible}, displayed=${isDisplayed}`);
        });
      } catch (error) {
        console.log(`❌ Error with selector "${selector}":`, error);
      }
    });
  }

  debugFormDetection() {
    console.log('🔍 Debugging form detection...');
    console.log('Current URL:', window.location.href);
    
    // Check for modals
    const modalSelectors = [
      '.jobs-easy-apply-content',
      '.jobs-apply-modal',
      '.artdeco-modal',
      '[role="dialog"]',
      '.modal-content',
      '.jobs-apply-form',
      '[data-test-id="application-form"]'
    ];
    
    console.log('🔍 Checking for modals:');
    modalSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      console.log(`  ${selector}: ${elements.length} elements`);
      elements.forEach((element, index) => {
        console.log(`    Element ${index + 1}:`, {
          className: element.className,
          id: element.id,
          tagName: element.tagName,
          visible: element.offsetParent !== null
        });
      });
    });
    
    // Check for form elements
    const formElementSelectors = [
      'input[type="text"]',
      'input[type="email"]',
      'input[type="tel"]',
      'input[type="url"]',
      'select',
      'textarea',
      'button[aria-label*="Next"]',
      'button[aria-label*="Submit"]',
      'button[aria-label*="Continue"]',
      '.artdeco-button--primary',
      'button.artdeco-button--primary'
    ];
    
    console.log('🔍 Checking for form elements:');
    formElementSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      console.log(`  ${selector}: ${elements.length} elements`);
      elements.forEach((element, index) => {
        console.log(`    Element ${index + 1}:`, {
          className: element.className,
          ariaLabel: element.getAttribute('aria-label'),
          textContent: element.textContent?.substring(0, 50),
          visible: element.offsetParent !== null
        });
      });
    });
    
    // Check for elements with "apply" or "form" in class names
    const applyElements = document.querySelectorAll('[class*="apply"]');
    const formElements = document.querySelectorAll('[class*="form"]');
    
    console.log(`🔍 Elements with "apply" in class: ${applyElements.length}`);
    console.log(`🔍 Elements with "form" in class: ${formElements.length}`);
    
    // Show all buttons on the page
    const allButtons = document.querySelectorAll('button');
    console.log(`🔍 Total buttons on page: ${allButtons.length}`);
    allButtons.forEach((button, index) => {
      const text = button.textContent?.trim() || '';
      const ariaLabel = button.getAttribute('aria-label') || '';
      if (text || ariaLabel) {
        console.log(`  Button ${index + 1}: text="${text}", aria-label="${ariaLabel}"`);
      }
    });
  }

  debugFieldHistory() {
    console.log('🔍 Debugging field history...');
    console.log('Current URL:', window.location.href);
    
    console.log('📋 Stored field history:');
    for (const [key, fieldData] of smartFormFiller.fieldHistory) {
      console.log(`  Key: ${key}`);
      console.log(`    Label: ${fieldData.label}`);
      console.log(`    Value: ${fieldData.value}`);
      console.log(`    Type: ${fieldData.type}`);
      console.log(`    Validation: ${fieldData.validationMessage}`);
      console.log(`    Use Count: ${fieldData.useCount}`);
      console.log(`    Last Used: ${new Date(fieldData.lastUsed).toLocaleString()}`);
      console.log('    ---');
    }
    
    console.log('📝 Current session:');
    for (const [key, fieldData] of smartFormFiller.currentSession) {
      console.log(`  Key: ${key}`);
      console.log(`    Label: ${fieldData.label}`);
      console.log(`    Value: ${fieldData.value}`);
      console.log(`    Type: ${fieldData.type}`);
      console.log('    ---');
    }
    
    // Show current form fields
    const popup = smartFormFiller.getPopupContainer();
    const container = popup || document;
    const fields = container.querySelectorAll('input, select, textarea');
    
    console.log(`🔍 Current form fields (${fields.length}):`);
    fields.forEach((field, index) => {
      const fieldInfo = smartFormFiller.extractFieldInfo(field);
      console.log(`  Field ${index + 1}:`);
      console.log(`    Key: ${fieldInfo?.key || 'N/A'}`);
      console.log(`    Label: ${fieldInfo?.label || 'N/A'}`);
      console.log(`    Type: ${fieldInfo?.type || 'N/A'}`);
      console.log(`    Current Value: ${field.value || 'N/A'}`);
      console.log(`    Has Stored Value: ${smartFormFiller.fieldHistory.has(fieldInfo?.key || '')}`);
      console.log('    ---');
    });

    // Create and show popup with field history data
    this.showFieldHistoryPopup();
  }

  showFieldHistoryPopup() {
    // Remove existing popup if any
    const existingPopup = document.getElementById('easyapply-field-history-popup');
    if (existingPopup) {
      existingPopup.remove();
    }

    // Create popup container
    const popup = document.createElement('div');
    popup.id = 'easyapply-field-history-popup';
    popup.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 80%;
      max-width: 800px;
      max-height: 80vh;
      background: white;
      border: 2px solid #22c55e;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
    `;

    // Create header
    const header = document.createElement('div');
    header.style.cssText = `
      background: #22c55e;
      color: white;
      padding: 15px 20px;
      font-size: 18px;
      font-weight: 600;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
    header.innerHTML = `
      <span>📋 Field History Data</span>
      <button id="easyapply-close-popup" style="
        background: none;
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background 0.2s;
      ">×</button>
    `;

    // Create content container
    const content = document.createElement('div');
    content.style.cssText = `
      padding: 20px;
      max-height: 60vh;
      overflow-y: auto;
    `;

    // Create tabs
    const tabsContainer = document.createElement('div');
    tabsContainer.style.cssText = `
      display: flex;
      margin-bottom: 20px;
      border-bottom: 2px solid #e5e7eb;
    `;

    const tabs = [
      { id: 'stored', label: '📦 Stored Fields', active: true },
      { id: 'current', label: '📝 Current Session', active: false },
      { id: 'form', label: '🔍 Current Form', active: false }
    ];

    tabs.forEach(tab => {
      const tabButton = document.createElement('button');
      tabButton.id = `tab-${tab.id}`;
      tabButton.textContent = tab.label;
      tabButton.style.cssText = `
        padding: 10px 20px;
        border: none;
        background: ${tab.active ? '#22c55e' : 'transparent'};
        color: ${tab.active ? 'white' : '#374151'};
        cursor: pointer;
        font-weight: ${tab.active ? '600' : '400'};
        border-radius: 8px 8px 0 0;
        transition: all 0.2s;
      `;
      tabsContainer.appendChild(tabButton);
    });

    // Create tab content
    const tabContent = document.createElement('div');
    tabContent.id = 'tab-content';

    // Stored fields content
    const storedContent = this.createStoredFieldsContent();
    storedContent.id = 'content-stored';
    storedContent.style.display = 'block';

    // Current session content
    const currentContent = this.createCurrentSessionContent();
    currentContent.id = 'content-current';
    currentContent.style.display = 'none';

    // Current form content
    const formContent = this.createCurrentFormContent();
    formContent.id = 'content-form';
    formContent.style.display = 'none';

    tabContent.appendChild(storedContent);
    tabContent.appendChild(currentContent);
    tabContent.appendChild(formContent);

    // Assemble popup
    popup.appendChild(header);
    popup.appendChild(tabsContainer);
    popup.appendChild(content);
    content.appendChild(tabContent);

    // Add to page
    document.body.appendChild(popup);

    // Add event listeners
    this.setupFieldHistoryPopupEvents();
  }

  createStoredFieldsContent() {
    const container = document.createElement('div');
    
    if (smartFormFiller.fieldHistory.size === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #6b7280;">
          <div style="font-size: 48px; margin-bottom: 16px;">📦</div>
          <h3 style="margin: 0 0 8px 0; color: #374151;">No stored fields yet</h3>
          <p style="margin: 0; font-size: 14px;">Fill out some forms manually and the data will be stored here for future auto-filling.</p>
        </div>
      `;
      return container;
    }

    const fieldsList = document.createElement('div');
    fieldsList.style.cssText = `
      display: grid;
      gap: 16px;
    `;

    for (const [key, fieldData] of smartFormFiller.fieldHistory) {
      const fieldCard = document.createElement('div');
      fieldCard.style.cssText = `
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 16px;
        background: #f9fafb;
      `;

      const lastUsed = new Date(fieldData.lastUsed).toLocaleString();
      
      fieldCard.innerHTML = `
        <div style="display: flex; justify-content: between; align-items: start; margin-bottom: 12px;">
          <div style="flex: 1;">
            <h4 style="margin: 0 0 8px 0; color: #374151; font-size: 16px;">
              ${fieldData.label || 'No Label'}
            </h4>
            <div style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">
              <strong>Value:</strong> <span style="color: #22c55e; font-weight: 600;">${fieldData.value}</span>
            </div>
            <div style="font-size: 12px; color: #9ca3af; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <div><strong>Type:</strong> ${fieldData.type}</div>
              <div><strong>Used:</strong> ${fieldData.useCount} times</div>
              <div><strong>Last Used:</strong> ${lastUsed}</div>
              <div><strong>Key:</strong> <span style="font-family: monospace; font-size: 10px;">${key.substring(0, 20)}...</span></div>
            </div>
          </div>
          <button class="delete-field-btn" data-key="${key}" style="
            background: #ef4444;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 4px 8px;
            font-size: 12px;
            cursor: pointer;
            transition: background 0.2s;
          ">Delete</button>
        </div>
        ${fieldData.validationMessage ? `
          <div style="
            background: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 4px;
            padding: 8px;
            margin-top: 8px;
            font-size: 12px;
            color: #92400e;
          ">
            <strong>Validation:</strong> ${fieldData.validationMessage}
          </div>
        ` : ''}
      `;

      fieldsList.appendChild(fieldCard);
    }

    container.appendChild(fieldsList);
    return container;
  }

  createCurrentSessionContent() {
    const container = document.createElement('div');
    
    if (smartFormFiller.currentSession.size === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #6b7280;">
          <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
          <h3 style="margin: 0 0 8px 0; color: #374151;">No current session data</h3>
          <p style="margin: 0; font-size: 14px;">Start filling out the current form to see session data here.</p>
        </div>
      `;
      return container;
    }

    const fieldsList = document.createElement('div');
    fieldsList.style.cssText = `
      display: grid;
      gap: 12px;
    `;

    for (const [key, fieldData] of smartFormFiller.currentSession) {
      const fieldCard = document.createElement('div');
      fieldCard.style.cssText = `
        border: 1px solid #dbeafe;
        border-radius: 6px;
        padding: 12px;
        background: #eff6ff;
      `;

      fieldCard.innerHTML = `
        <h4 style="margin: 0 0 6px 0; color: #1e40af; font-size: 14px;">
          ${fieldData.label || 'No Label'}
        </h4>
        <div style="font-size: 13px; color: #6b7280; margin-bottom: 6px;">
          <strong>Value:</strong> <span style="color: #3b82f6; font-weight: 600;">${fieldData.value}</span>
        </div>
        <div style="font-size: 11px; color: #9ca3af;">
          <strong>Type:</strong> ${fieldData.type} | <strong>Key:</strong> <span style="font-family: monospace;">${key.substring(0, 15)}...</span>
        </div>
      `;

      fieldsList.appendChild(fieldCard);
    }

    container.appendChild(fieldsList);
    return container;
  }

  createCurrentFormContent() {
    const container = document.createElement('div');
    
    const popup = smartFormFiller.getPopupContainer();
    const containerElement = popup || document;
    const fields = containerElement.querySelectorAll('input, select, textarea');
    
    if (fields.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #6b7280;">
          <div style="font-size: 48px; margin-bottom: 16px;">🔍</div>
          <h3 style="margin: 0 0 8px 0; color: #374151;">No form fields found</h3>
          <p style="margin: 0; font-size: 14px;">No input fields detected on the current page.</p>
        </div>
      `;
      return container;
    }

    const fieldsList = document.createElement('div');
    fieldsList.style.cssText = `
      display: grid;
      gap: 12px;
    `;

    fields.forEach((field, index) => {
      const fieldInfo = smartFormFiller.extractFieldInfo(field);
      const hasStoredValue = smartFormFiller.fieldHistory.has(fieldInfo?.key || '');
      
      const fieldCard = document.createElement('div');
      fieldCard.style.cssText = `
        border: 1px solid ${hasStoredValue ? '#22c55e' : '#e5e7eb'};
        border-radius: 6px;
        padding: 12px;
        background: ${hasStoredValue ? '#f0fdf4' : '#f9fafb'};
      `;

      fieldCard.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
          <h4 style="margin: 0; color: #374151; font-size: 14px;">
            Field ${index + 1}: ${fieldInfo?.label || 'No Label'}
          </h4>
          <span style="
            background: ${hasStoredValue ? '#22c55e' : '#6b7280'};
            color: white;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
          ">
            ${hasStoredValue ? '✅ Stored' : '❌ Not Stored'}
          </span>
        </div>
        <div style="font-size: 12px; color: #6b7280; margin-bottom: 6px;">
          <strong>Type:</strong> ${fieldInfo?.type || 'N/A'} | <strong>Current Value:</strong> <span style="color: #374151;">${field.value || 'Empty'}</span>
        </div>
        <div style="font-size: 11px; color: #9ca3af;">
          <strong>Key:</strong> <span style="font-family: monospace;">${fieldInfo?.key || 'N/A'}</span>
        </div>
      `;

      fieldsList.appendChild(fieldCard);
    });

    container.appendChild(fieldsList);
    return container;
  }

  setupFieldHistoryPopupEvents() {
    // Close button
    const closeBtn = document.getElementById('easyapply-close-popup');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        const popup = document.getElementById('easyapply-field-history-popup');
        if (popup) popup.remove();
      });
    }

    // Tab switching
    const tabs = ['stored', 'current', 'form'];
    tabs.forEach(tabId => {
      const tabBtn = document.getElementById(`tab-${tabId}`);
      if (tabBtn) {
        tabBtn.addEventListener('click', () => {
          // Update tab buttons
          tabs.forEach(id => {
            const btn = document.getElementById(`tab-${id}`);
            const content = document.getElementById(`content-${id}`);
            if (btn && content) {
              btn.style.background = id === tabId ? '#22c55e' : 'transparent';
              btn.style.color = id === tabId ? 'white' : '#374151';
              btn.style.fontWeight = id === tabId ? '600' : '400';
              content.style.display = id === tabId ? 'block' : 'none';
            }
          });
        });
      }
    });

    // Delete field buttons
    document.querySelectorAll('.delete-field-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const key = e.target.dataset.key;
        if (key && confirm(`Delete stored field "${key}"?`)) {
          smartFormFiller.fieldHistory.delete(key);
          await smartFormFiller.saveFieldHistory();
          
          // Refresh the popup
          this.showFieldHistoryPopup();
        }
      });
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      const popup = document.getElementById('easyapply-field-history-popup');
      if (popup && !popup.contains(e.target)) {
        popup.remove();
      }
    });
  }

  /**
   * Find Easy Apply button
   */
  async findApplyButton() {
    const selectors = [
      // Primary selectors
      '[data-control-name="jobdetails_topcard_inapply"]',
      '[data-control-name="jobdetails_topcard_inapply"] button',
      'button[data-control-name="jobdetails_topcard_inapply"]',
      '.jobs-apply-button',
      '.jobs-apply-button button',
      'button.jobs-apply-button',
      '[data-control-name="jobdetails_topcard_inapply"] .artdeco-button',
      
      // Aria-label based selectors
      'button[aria-label*="Easy Apply"]',
      'button[aria-label*="Easy apply"]',
      'button[aria-label*="Apply"]',
      '.artdeco-button[aria-label*="Easy Apply"]',
      '.artdeco-button[aria-label*="Apply"]',
      
      // Class-based selectors
      'button[class*="apply"]',
      '.artdeco-button[class*="apply"]',
      '[class*="apply"] button',
      
      // Data attributes
      '[data-control-name*="apply"]',
      '[data-control-name*="Apply"]',
      'button[data-control-name*="apply"]',
      'button[data-control-name*="Apply"]',
      
      // Text content selectors (broader search)
      'button:contains("Easy Apply")',
      'button:contains("Apply")',
      '.artdeco-button:contains("Easy Apply")',
      '.artdeco-button:contains("Apply")',
      
      // Role-based selectors
      '[role="button"][aria-label*="Apply"]',
      '[role="button"][aria-label*="Easy"]',
      
      // Specific LinkedIn selectors
      '[data-test-id="apply-button"]',
      '[data-test-id*="apply"]',
      '.jobs-unified-top-card__container--two-pane button',
      '.jobs-unified-top-card__content--two-pane button',
      '.jobs-unified-top-card button',
      
      // Fallback: any button with apply-related text
      'button',
      '.artdeco-button'
    ];

    console.log('🔍 Starting Easy Apply button search...');
    console.log('Current URL:', window.location.href);

    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        console.log(`🔍 Trying selector "${selector}": found ${elements.length} elements`);
        
        for (const element of elements) {
          if (element && element.offsetParent !== null && !element.disabled) {
            // Check if element is visible and not disabled
            const style = window.getComputedStyle(element);
            if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
              const text = element.textContent?.toLowerCase() || '';
              const ariaLabel = element.getAttribute('aria-label')?.toLowerCase() || '';
              const title = element.getAttribute('title')?.toLowerCase() || '';
              const dataControlName = element.getAttribute('data-control-name')?.toLowerCase() || '';
              
              console.log(`🔍 Button text: "${text}", aria-label: "${ariaLabel}", title: "${title}", data-control-name: "${dataControlName}"`);
              
              // Check for apply-related content
              const hasApplyText = text.includes('easy apply') || text.includes('apply') || 
                                  ariaLabel.includes('easy apply') || ariaLabel.includes('apply') ||
                                  title.includes('easy apply') || title.includes('apply') ||
                                  dataControlName.includes('apply');
              
              if (hasApplyText) {
                console.log('✅ Found EasyApply button:', element);
                console.log('Button details:', {
                  text: element.textContent,
                  ariaLabel: element.getAttribute('aria-label'),
                  title: element.getAttribute('title'),
                  dataControlName: element.getAttribute('data-control-name'),
                  className: element.className,
                  id: element.id
                });
                return element;
              }
            }
          }
        }
      } catch (error) {
        console.log(`❌ Error with selector "${selector}":`, error);
      }
    }

    // Fallback: search all buttons for apply-related text
    console.log('🔍 Trying fallback search for any button with apply text...');
    const allButtons = document.querySelectorAll('button, .artdeco-button, [role="button"]');
    console.log(`🔍 Found ${allButtons.length} total buttons on page`);
    
    for (const button of allButtons) {
      if (button && button.offsetParent !== null && !button.disabled) {
        const style = window.getComputedStyle(button);
        if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
          const text = button.textContent?.toLowerCase() || '';
          const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
          const title = button.getAttribute('title')?.toLowerCase() || '';
          
          if (text.includes('apply') || ariaLabel.includes('apply') || title.includes('apply')) {
            console.log('✅ Found potential apply button in fallback search:', button);
            console.log('Button details:', {
              text: button.textContent,
              ariaLabel: button.getAttribute('aria-label'),
              title: button.getAttribute('title'),
              className: button.className,
              id: button.id
            });
            return button;
          }
        }
      }
    }

    console.log('❌ No EasyApply button found with any selector');
    console.log('🔍 Page structure for debugging:');
    console.log('All buttons on page:', document.querySelectorAll('button').length);
    console.log('All artdeco-buttons on page:', document.querySelectorAll('.artdeco-button').length);
    console.log('All elements with data-control-name:', document.querySelectorAll('[data-control-name]').length);
    
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

      console.log('🔄 Waiting for application form to load...');

      const checkForm = () => {
        console.log(`🔍 Checking for application form (attempt ${Math.floor(elapsed / checkInterval) + 1})...`);
        
        // Look for any modal or dialog that might contain the application form
        const modalSelectors = [
          '.jobs-easy-apply-content',
          '.jobs-apply-modal',
          '.artdeco-modal',
          '[role="dialog"]',
          '.modal-content',
          '.jobs-apply-form',
          '[data-test-id="application-form"]'
        ];
        
        // Look for form elements that indicate the application form is loaded
        const formElementSelectors = [
          'input[type="text"]',
          'input[type="email"]',
          'input[type="tel"]',
          'input[type="url"]',
          'select',
          'textarea',
          'button[aria-label*="Next"]',
          'button[aria-label*="Submit"]',
          'button[aria-label*="Continue"]',
          '.artdeco-button--primary',
          'button.artdeco-button--primary'
        ];
        
        // Check for modals first
        let foundModal = false;
        modalSelectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            console.log(`✅ Found modal with selector: ${selector} (${elements.length} elements)`);
            foundModal = true;
          }
        });
        
        // Check for form elements
        let foundFormElements = false;
        formElementSelectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            console.log(`✅ Found form element with selector: ${selector} (${elements.length} elements)`);
            foundFormElements = true;
          }
        });
        
        // Also check for any elements with "apply" in their class names
        const applyElements = document.querySelectorAll('[class*="apply"]');
        if (applyElements.length > 0) {
          console.log(`✅ Found ${applyElements.length} elements with "apply" in class name`);
          foundFormElements = true;
        }
        
        // Check for any elements with "form" in their class names
        const formElements = document.querySelectorAll('[class*="form"]');
        if (formElements.length > 0) {
          console.log(`✅ Found ${formElements.length} elements with "form" in class name`);
          foundFormElements = true;
        }

        if (foundModal || foundFormElements) {
          console.log('✅ Application form loaded successfully!');
          resolve();
        } else if (elapsed >= maxWaitTime) {
          console.log('❌ Application form failed to load after timeout');
          console.log('🔍 Current page HTML for debugging:');
          console.log(document.body.innerHTML.substring(0, 3000)); // First 3000 chars for debugging
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
      const maxWaitTime = 10000; // 10 seconds
      const checkInterval = 500;
      let elapsed = 0;

      const checkPageLoad = () => {
        // Check if page is fully loaded
        if (document.readyState === 'complete') {
          // Additional wait for LinkedIn's dynamic content
          setTimeout(() => {
            console.log('✅ Page fully loaded');
            resolve();
          }, 1000);
          return;
        }

        // Check for LinkedIn job page specific elements
        const hasJobTitle = document.querySelector('h1, .jobs-unified-top-card__job-title, [data-test-id="job-details-job-title"]');
        const hasCompanyName = document.querySelector('.jobs-unified-top-card__company-name, [data-test-id="job-details-company-name"]');
        const hasApplySection = document.querySelector('[data-control-name="jobdetails_topcard_inapply"]');
        
        if (hasJobTitle && hasCompanyName && hasApplySection) {
          console.log('✅ LinkedIn job page elements loaded');
          resolve();
          return;
        }

        if (elapsed >= maxWaitTime) {
          console.log('⚠️ Page load timeout, proceeding anyway');
          resolve();
          return;
        }

        elapsed += checkInterval;
        setTimeout(checkPageLoad, checkInterval);
      };

      checkPageLoad();
    });
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Initialize smart form filler
const smartFormFiller = new SmartFormFiller();

// Initialize content script
const contentScript = new ContentScript();
contentScript.init().then(() => {
  console.log('✅ Content script initialization completed');
}).catch(error => {
  console.error('❌ Content script initialization failed:', error);
});

} // Close the if statement that prevents duplicate initialization 