import { CONFIG } from '../../config/constants.js';
import { ErrorHandler, retryOperation } from '../../utils/error-handler.js';

/**
 * LinkedIn Form Filler
 * Handles filling out LinkedIn job application forms
 */
export class FormFiller {
  constructor() {
    this.userData = null;
    this.init();
  }

  /**
   * Initialize the form filler
   */
  init() {
    console.log('Form filler initialized');
  }

  /**
   * Load user data from storage
   */
  async loadUserData() {
    try {
      return new Promise((resolve) => {
        chrome.storage.local.get(['userData'], (result) => {
          this.userData = result.userData || {};
          resolve(this.userData);
        });
      });
    } catch (error) {
      await ErrorHandler.handleError(error, 'load-user-data');
      return {};
    }
  }

  /**
   * Fill application form
   */
  async fillApplicationForm() {
    try {
      await this.loadUserData();
      
      const result = await retryOperation(async () => {
        return await this.fillFormFields();
      }, {
        maxRetries: 3,
        delay: 1000,
        onRetry: (error, attempt) => {
          console.log(`Retrying form filling, attempt ${attempt}:`, error.message);
        }
      });

      return result;

    } catch (error) {
      await ErrorHandler.handleError(error, 'fill-application-form');
      throw error;
    }
  }

  /**
   * Fill form fields with user data
   */
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

  /**
   * Get the popup container for EasyApply
   */
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

  /**
   * Fill a field within a specific container
   */
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

  /**
   * Fill a single form field
   */
  async fillField(selector, value) {
    const element = document.querySelector(selector);
    if (element) {
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Add visual feedback
      element.classList.add('easyapply-form-field', 'filled');
      
      await this.delay(500); // Small delay between fields
    }
  }

  /**
   * Handle additional questions
   */
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

  /**
   * Handle radio button questions
   */
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

  /**
   * Handle checkbox questions
   */
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

  /**
   * Handle dropdown questions
   */
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

  /**
   * Handle text area questions
   */
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

  /**
   * Get question text from form element
   */
  getQuestionText(element) {
    // Try to find the question text in various ways
    const label = element.closest('label')?.textContent;
    const placeholder = element.placeholder;
    const ariaLabel = element.getAttribute('aria-label');
    const name = element.name;
    
    return label || placeholder || ariaLabel || name || '';
  }

  /**
   * Get answer for a specific question
   */
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

  /**
   * Submit the application form
   */
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
      await ErrorHandler.handleError(error, 'submit-form');
      return { success: false, error: error.message };
    }
  }

  /**
   * Fill the current step of the application
   */
  async fillCurrentStep() {
    try {
      // Fill basic form fields
      await this.fillFormFields();
      
      // Handle additional questions
      await this.handleAdditionalQuestions();
      
      // Handle radio buttons
      await this.handleRadioButtons();
      
      // Handle checkboxes
      await this.handleCheckboxes();
      
      // Handle dropdowns
      await this.handleDropdowns();
      
      // Handle text areas
      await this.handleTextAreas();
      
      // Small delay to ensure all fields are filled
      await this.delay(1000);
      
    } catch (error) {
      console.error('Error filling current step:', error);
    }
  }

  /**
   * Find Next button for LinkedIn EasyApply
   */
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

  /**
   * Wait for next step to load
   */
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

  /**
   * Find submit button
   */
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

  /**
   * Wait for form submission to complete
   */
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

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Create global instance
export const formFiller = new FormFiller(); 