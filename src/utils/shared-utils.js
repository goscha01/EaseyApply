/**
 * Shared utilities for the EasyApply extension
 * Consolidates common functions used across multiple files
 */

/**
 * Storage utilities
 */
export class StorageUtils {
  /**
   * Get data from chrome.storage.local
   */
  static async getStorageData(key) {
    try {
      const result = await chrome.storage.local.get([key]);
      return result[key];
    } catch (error) {
      console.error('❌ Error getting storage data:', error);
      return null;
    }
  }

  /**
   * Set data in chrome.storage.local
   */
  static async setStorageData(key, value) {
    try {
      await chrome.storage.local.set({ [key]: value });
      return true;
    } catch (error) {
      console.error('❌ Error setting storage data:', error);
      return false;
    }
  }

  /**
   * Get multiple keys from storage
   */
  static async getFromStorage(keys) {
    try {
      return await chrome.storage.local.get(keys);
    } catch (error) {
      console.error('❌ Error getting from storage:', error);
      return {};
    }
  }

  /**
   * Set multiple keys in storage
   */
  static async setInStorage(data) {
    try {
      await chrome.storage.local.set(data);
      return true;
    } catch (error) {
      console.error('❌ Error setting in storage:', error);
      return false;
    }
  }
}

/**
 * Message utilities
 */
export class MessageUtils {
  /**
   * Send message to background script
   */
  static async sendMessage(message) {
    try {
      return await chrome.runtime.sendMessage(message);
    } catch (error) {
      console.error('❌ Error sending message:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send message to tab
   */
  static async sendMessageToTab(tabId, message) {
    try {
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (error) {
      console.error('❌ Error sending message to tab:', error);
      return { success: false, error: error.message };
    }
  }
}

/**
 * UI utilities
 */
export class UIUtils {
  /**
   * Show error message
   */
  static showError(message, duration = 5000) {
    console.error('❌ Error:', message);
    
    // Create error element if it doesn't exist
    let errorElement = document.getElementById('error-message');
    if (!errorElement) {
      errorElement = document.createElement('div');
      errorElement.id = 'error-message';
      errorElement.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded shadow-lg z-50';
      document.body.appendChild(errorElement);
    }
    
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    
    // Auto-hide after duration
    setTimeout(() => {
      errorElement.style.display = 'none';
    }, duration);
  }

  /**
   * Show success message
   */
  static showSuccess(message, duration = 3000) {
    console.log('✅ Success:', message);
    
    // Create success element if it doesn't exist
    let successElement = document.getElementById('success-message');
    if (!successElement) {
      successElement = document.createElement('div');
      successElement.id = 'success-message';
      successElement.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50';
      document.body.appendChild(successElement);
    }
    
    successElement.textContent = message;
    successElement.style.display = 'block';
    
    // Auto-hide after duration
    setTimeout(() => {
      successElement.style.display = 'none';
    }, duration);
  }

  /**
   * Update status text
   */
  static updateStatus(status) {
    const statusElement = document.getElementById('status-text');
    if (statusElement) {
      statusElement.textContent = status;
    }
  }

  /**
   * Show loading state
   */
  static showLoading(text = 'Loading...') {
    const loadingElement = document.getElementById('loading-state');
    const mainContent = document.getElementById('main-content');
    
    if (loadingElement) loadingElement.style.display = 'flex';
    if (mainContent) mainContent.style.display = 'none';
  }

  /**
   * Hide loading state
   */
  static hideLoading() {
    const loadingElement = document.getElementById('loading-state');
    const mainContent = document.getElementById('main-content');
    
    if (loadingElement) loadingElement.style.display = 'none';
    if (mainContent) mainContent.style.display = 'flex';
  }
}

/**
 * Job utilities
 */
export class JobUtils {
  /**
   * Generate unique job ID
   */
  static generateJobId(text) {
    return btoa(text).replace(/[^a-zA-Z0-9]/g, '').substring(0, 10);
  }

  /**
   * Extract basic job info from DOM element
   */
  static extractBasicJobInfo(card) {
    try {
      // Extract job title
      const titleElement = card.querySelector('[data-testid="job-card-container"] h3, .job-card-container h3, .job-card__title, .job-search-card__title');
      const title = titleElement ? titleElement.textContent.trim() : 'Unknown Title';

      // Extract company name
      const companyElement = card.querySelector('[data-testid="job-card-container"] h4, .job-card-container h4, .job-card__subtitle, .job-search-card__subtitle');
      const company = companyElement ? companyElement.textContent.trim() : 'Unknown Company';

      // Extract location
      const locationElement = card.querySelector('[data-testid="job-card-container"] .job-card__location, .job-card-container .job-card__location, .job-search-card__location');
      const location = locationElement ? locationElement.textContent.trim() : 'Unknown Location';

      // Extract job URL
      const linkElement = card.querySelector('a[href*="/jobs/view/"]');
      const url = linkElement ? linkElement.href : null;

      // Generate unique ID
      const id = this.generateJobId(title + company + location);

      return {
        id: id,
        title: title,
        company: company,
        location: location,
        url: url,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error extracting job info:', error);
      return {
        id: this.generateJobId('unknown'),
        title: 'Unknown Title',
        company: 'Unknown Company',
        location: 'Unknown Location',
        url: null,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Extract job description from current page (consolidated version)
   */
  static async extractJobDescription(data) {
    try {
      const { jobId } = data;
      
      console.log('📄 Starting job description extraction for jobId:', jobId);
      console.log('📄 Current page URL:', window.location.href);
      
      // Check if we're on a job page
      if (!window.location.href.includes('/jobs/view/')) {
        console.log('❌ Not on a job detail page');
        return { success: false, description: null, error: 'Not on a job detail page' };
      }
      
      // Look for the job description container
      const descriptionSelectors = [
        '.job-details-about-the-job-module__description',
        '.jobs-description',
        '.job-description',
        '[data-test-id="job-description"]',
        '.description',
        '.jobs-box__html-content',
        '.jobs-description-content__text',
        '.job-view-layout .jobs-description',
        '.job-details-jobs-unified-top-card__job-description',
        '.jobs-unified-top-card__job-description',
        '.jobs-description__content',
        '.job-details-jobs-unified-top-card__content',
        '.jobs-box__html-content .jobs-box__html-content',
        '.jobs-description-content',
        '.job-details-about-the-job-module',
        '.jobs-unified-top-card__content',
        '.jobs-description__content__text',
        '.jobs-box__html-content p',
        '.jobs-description p',
        '.job-description p'
      ];
      
      // Also look for requirements section
      const requirementsSelectors = [
        '.job-details-about-the-job-module__section',
        '.job-details-about-the-job-module__requirements-list',
        '.requirements-list',
        '.job-requirements'
      ];
      
      let descriptionElement = null;
      for (const selector of descriptionSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          descriptionElement = elements[0];
          console.log('📄 Found description using selector:', selector);
          break;
        }
      }
      
      // If no description found, try to find any element with job-related content
      if (!descriptionElement) {
        console.log('📄 No description found with selectors, searching for job content...');
        const allElements = document.querySelectorAll('*');
        for (const element of allElements) {
          const text = element.textContent?.trim();
          if (text && text.length > 500 && 
              (text.includes('About the job') || text.includes('Job Description') || text.includes('Requirements') || text.includes('Responsibilities'))) {
            console.log('📄 Found potential job content element:', element.tagName, element.className);
            descriptionElement = element;
            break;
          }
        }
      }
      
      if (!descriptionElement) {
        console.log('❌ No job description found on page');
        return { success: false, description: null, error: 'No job description found' };
      }
      
      // Extract job information
      const jobTitle = document.querySelector('.job-details-jobs-unified-top-card__job-title h1')?.textContent?.trim() ||
                      document.querySelector('h1')?.textContent?.trim() ||
                      'Unknown Job Title';
      
      const companyName = document.querySelector('.job-details-jobs-unified-top-card__company-name a')?.textContent?.trim() ||
                         document.querySelector('.company-name')?.textContent?.trim() ||
                         'Unknown Company';
      
      const location = document.querySelector('.job-details-jobs-unified-top-card__tertiary-description-container')?.textContent?.trim() ||
                      document.querySelector('.location')?.textContent?.trim() ||
                      'Unknown Location';
      
      // Extract description text
      let descriptionText = descriptionElement.textContent?.trim() || '';
      
      // Try to extract requirements separately
      let requirementsText = '';
      for (const selector of requirementsSelectors) {
        const requirementsElement = document.querySelector(selector);
        if (requirementsElement) {
          requirementsText = requirementsElement.textContent?.trim() || '';
          break;
        }
      }
      
      // Clean up navigation text that might be included
      const navigationTexts = [
        'Skip to main content',
        'Skip to footer',
        'Skip to navigation',
        'Skip to search',
        'Skip to job search',
        'Skip to job results'
      ];
      
      navigationTexts.forEach(navText => {
        descriptionText = descriptionText.replace(new RegExp(navText, 'gi'), '');
        requirementsText = requirementsText.replace(new RegExp(navText, 'gi'), '');
      });
      
      // Clean up extra whitespace
      descriptionText = descriptionText.replace(/\s+/g, ' ').trim();
      requirementsText = requirementsText.replace(/\s+/g, ' ').trim();
      
      // Combine description and requirements
      let fullDescription = descriptionText;
      if (requirementsText) {
        fullDescription += '\n\n--- REQUIREMENTS ---\n' + requirementsText;
      }
      
      // Check if we have meaningful content
      if (fullDescription.length < 100) {
        console.log('❌ Description too short, might be navigation text');
        return { success: false, description: null, error: 'Description too short' };
      }
      
      // Create job description object
      const jobDescription = {
        id: jobId === 'current-page' ? this.generateJobId(jobTitle + companyName) : jobId,
        title: jobTitle,
        company: companyName,
        location: location,
        description: fullDescription,
        fetchedAt: new Date().toISOString(),
        url: window.location.href
      };
      
      console.log('✅ Job description extracted successfully');
      return { success: true, description: jobDescription };
      
    } catch (error) {
      console.error('❌ Error extracting job description:', error);
      return { success: false, description: null, error: error.message };
    }
  }
}

/**
 * Validation utilities
 */
export class ValidationUtils {
  /**
   * Validate job gathering data
   */
  static validateJobGatheringData(data) {
    if (!data) return false;
    if (!data.skills || data.skills.trim() === '') return false;
    if (!data.job_count || data.job_count < 1) return false;
    return true;
  }

  /**
   * Validate application data
   */
  static validateApplicationData(data) {
    if (!data) return false;
    if (!data.skills || data.skills.trim() === '') return false;
    if (!data.job_count || data.job_count < 1) return false;
    return true;
  }
}

/**
 * Constants
 */
export const MESSAGE_TYPES = {
  GATHER_JOBS: 'gatherJobs',
  START_APPLICATIONS: 'startApplications',
  FETCH_JOB_DESCRIPTION: 'fetchJobDescription',
  FETCH_ALL_DESCRIPTIONS: 'fetchAllJobDescriptions',
  EXTRACT_JOB_DESCRIPTION: 'extractJobDescription',
  CLICK_EASY_APPLY: 'clickEasyApply',
  GET_JOB_LIST: 'getJobList',
  DELETE_JOB: 'deleteJob',
  STOP_PROCESS: 'stopProcess',
  FORCE_RESET: 'forceResetState'
};

export const STORAGE_KEYS = {
  SETTINGS: 'settings',
  SAVED_JOB_DESCRIPTIONS: 'savedJobDescriptions',
  GATHERED_JOBS: 'gatheredJobs',
  JOB_GATHERING_SESSION: 'jobGatheringSession',
  APPLICATION_STATE: 'applicationState'
}; 