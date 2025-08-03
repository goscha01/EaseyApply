// Configuration constants for the EasyApply extension
export const CONFIG = {
  // API Configuration
  API: {
    BASE_URL: 'https://quickapplyforjobs.com/api/',
    CV_URL: 'https://quickapplyforjobs.com/',
    TIMEOUT: 30000, // 30 seconds
    RETRY_ATTEMPTS: 3
  },
  
  // LinkedIn Configuration
  LINKEDIN: {
    BASE_URL: 'https://www.linkedin.com',
    JOB_SEARCH_URL: 'https://www.linkedin.com/jobs/search/',
    COOKIE_DOMAIN: 'https://www.linkedin.com/'
  },
  
  // Application Settings
  APPLICATION: {
    MAX_JOBS_PER_SESSION: 50,
    MIN_JOBS_PER_SESSION: 1,
    DEFAULT_DELAY: 2000, // 2 seconds between actions
    MAX_WAIT_TIME: 10000, // 10 seconds max wait
    RETRY_DELAY: 1000 // 1 second between retries
  },
  
  // Storage Keys
  STORAGE_KEYS: {
    JOB_DATA: 'jobData',
    USER_TOKEN: 'usertoken',
    APPLICATION_STATE: 'applicationState',
    SETTINGS: 'settings'
  },
  
  // Message Types
  MESSAGE_TYPES: {
    APPLY_LINKEDIN: 'applyLinkedin',
    SEARCH_JOBS: 'searchJobs',
    GATHER_JOBS: 'gatherJobs',
    START_APPLICATIONS: 'startApplications',
    STOP_PROCESS: 'stop_background_proccess',
    UPDATE_PROGRESS: 'updateProgress',
    ERROR_OCCURRED: 'errorOccurred',
    FORCE_RESET_STATE: 'forceResetState'
  },
  
  // Selectors for LinkedIn
  SELECTORS: {
    // Job listing page selectors
    JOB_CARDS: '.jobs-search-results__list-item',
    JOB_TITLE: '[data-test="job-title"]',
    JOB_COMPANY: '[data-test="job-company-name"]',
    JOB_LOCATION: '[data-test="job-location"]',
    JOB_LINK: 'a[href*="/jobs/view/"]',
    
    // Job details page selectors
    DETAILED_JOB_TITLE: '.job-details-jobs-unified-top-card__job-title h1',
    DETAILED_COMPANY_NAME: '.job-details-jobs-unified-top-card__company-name a',
    DETAILED_LOCATION: '.job-details-jobs-unified-top-card__primary-description-container span',
    DETAILED_DESCRIPTION: '.job-details-about-the-job-module__description .feed-shared-inline-show-more-text',
    DETAILED_REQUIREMENTS: '.job-details-about-the-job-module__requirements-list li',
    APPLY_BUTTON: '[data-control-name="jobdetails_topcard_inapply"]',
    NEXT_BUTTON: '[aria-label="Continue to next step"]',
    SUBMIT_BUTTON: '[aria-label="Submit your application"]',
    EASY_APPLY_BUTTON: '[data-control-name="jobdetails_topcard_inapply"]',
    CLOSE_BUTTON: '[aria-label="Dismiss"]',
    
    // Search form selectors
    SEARCH_INPUT: 'input[id^="jobs-search-box-keyword-id-ember"]',
    LOCATION_INPUT: 'input[id^="jobs-search-box-location-id-ember"]',
    SEARCH_BUTTON: '.jobs-search-box__submit-button'
  }
};

// Error messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error occurred. Please check your connection.',
  INVALID_INPUT: 'Please provide valid input data.',
  JOB_NOT_FOUND: 'No jobs found with the given criteria.',
  APPLICATION_FAILED: 'Failed to apply to job. Please try again.',
  TIMEOUT_ERROR: 'Operation timed out. Please try again.',
  PERMISSION_DENIED: 'Permission denied. Please check extension permissions.'
};

// Success messages
export const SUCCESS_MESSAGES = {
  APPLICATION_SUBMITTED: 'Application submitted successfully!',
  JOB_SAVED: 'Job saved successfully!',
  SETTINGS_UPDATED: 'Settings updated successfully!'
}; 