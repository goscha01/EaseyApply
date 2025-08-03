import { CONFIG } from '../../config/constants.js';
import { ErrorHandler, retryOperation, withTimeout } from '../../utils/error-handler.js';

/**
 * LinkedIn Job Scraper
 * Handles scraping job information from LinkedIn job pages
 */
export class JobScraper {
  constructor() {
    this.currentJob = null;
    this.jobLinks = [];
    this.init();
  }

  /**
   * Initialize the job scraper
   */
  init() {
    console.log('Job scraper initialized');
  }

  /**
   * Scrape job information from current page
   */
  async scrapeJobInfo() {
    try {
      const jobData = await retryOperation(async () => {
        return await this.extractJobData();
      }, {
        maxRetries: 3,
        delay: 1000,
        onRetry: (error, attempt) => {
          console.log(`Retrying job scraping, attempt ${attempt}:`, error.message);
        }
      });

      this.currentJob = jobData;
      return jobData;

    } catch (error) {
      await ErrorHandler.handleError(error, 'job-scraping');
      throw error;
    }
  }

  /**
   * Extract job data from the page
   */
  async extractJobData() {
    return new Promise((resolve, reject) => {
      try {
        // Wait for job content to load
        this.waitForJobContent().then(() => {
          const jobData = {
            title: this.extractJobTitle(),
            company: this.extractCompanyName(),
            location: this.extractJobLocation(),
            description: this.extractJobDescription(),
            requirements: this.extractJobRequirements(),
            url: window.location.href,
            timestamp: new Date().toISOString(),
            easyApply: this.hasEasyApply(),
            applicationStatus: 'pending'
          };

          resolve(jobData);
        }).catch(reject);

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Wait for job content to load
   */
  async waitForJobContent() {
    return new Promise((resolve, reject) => {
      const maxWaitTime = CONFIG.APPLICATION.MAX_WAIT_TIME;
      const checkInterval = 500;
      let elapsed = 0;

      const checkContent = () => {
        if (this.isJobContentLoaded()) {
          resolve();
        } else if (elapsed >= maxWaitTime) {
          reject(new Error('Job content failed to load within timeout'));
        } else {
          elapsed += checkInterval;
          setTimeout(checkContent, checkInterval);
        }
      };

      checkContent();
    });
  }

  /**
   * Check if job content is loaded
   */
  isJobContentLoaded() {
    const selectors = [
      '.job-details-jobs-unified-top-card__job-title',
      '.jobs-unified-top-card__job-title',
      '[data-test-id="job-details-job-title"]'
    ];

    return selectors.some(selector => {
      const element = document.querySelector(selector);
      return element && element.textContent.trim().length > 0;
    });
  }

  /**
   * Extract job title
   */
  extractJobTitle() {
    const selectors = [
      '.job-details-jobs-unified-top-card__job-title',
      '.jobs-unified-top-card__job-title',
      '[data-test-id="job-details-job-title"]',
      'h1[class*="job-title"]',
      '.job-details-jobs-unified-top-card__content-container h1'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const title = element.textContent.trim();
        if (title) return title;
      }
    }

    throw new Error('Job title not found');
  }

  /**
   * Extract company name
   */
  extractCompanyName() {
    const selectors = [
      '.job-details-jobs-unified-top-card__company-name',
      '.jobs-unified-top-card__company-name',
      '[data-test-id="job-details-company-name"]',
      '.job-details-jobs-unified-top-card__content-container a[href*="/company/"]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const company = element.textContent.trim();
        if (company) return company;
      }
    }

    return 'Unknown Company';
  }

  /**
   * Extract job location
   */
  extractJobLocation() {
    const selectors = [
      '.job-details-jobs-unified-top-card__bullet',
      '.jobs-unified-top-card__bullet',
      '[data-test-id="job-details-location"]',
      '.job-details-jobs-unified-top-card__content-container span[class*="location"]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const location = element.textContent.trim();
        if (location && !location.includes('•')) return location;
      }
    }

    return 'Remote';
  }

  /**
   * Extract job description
   * Uses shared JobUtils.extractJobDescription from shared-utils.js
   */
  extractJobDescription() {
    // Use shared JobUtils if available, otherwise fallback to local implementation
    if (typeof JobUtils !== 'undefined' && JobUtils.extractJobDescription) {
      return JobUtils.extractJobDescription({ jobId: 'current-page' });
    }
    
    // Fallback implementation
    const selectors = [
      '.jobs-description__content',
      '.job-details-jobs-unified-top-card__content-container .jobs-description',
      '[data-test-id="job-details-description"]',
      '.jobs-box__group .jobs-description'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const description = element.textContent.trim();
        if (description) return description;
      }
    }

    return '';
  }

  /**
   * Extract job requirements
   */
  extractJobRequirements() {
    const description = this.extractJobDescription();
    if (!description) return [];

    // Simple keyword extraction for requirements
    const requirementKeywords = [
      'requirements', 'qualifications', 'skills', 'experience',
      'must have', 'should have', 'preferred', 'minimum'
    ];

    const requirements = [];
    const sentences = description.split(/[.!?]+/);

    sentences.forEach(sentence => {
      const lowerSentence = sentence.toLowerCase();
      if (requirementKeywords.some(keyword => lowerSentence.includes(keyword))) {
        requirements.push(sentence.trim());
      }
    });

    return requirements.slice(0, 5); // Limit to 5 requirements
  }

  /**
   * Check if job has Easy Apply option
   */
  hasEasyApply() {
    const selectors = [
      '[data-control-name="jobdetails_topcard_inapply"]',
      '.jobs-apply-button',
      '[aria-label*="Easy Apply"]',
      'button[class*="apply"]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent.toLowerCase();
        if (text.includes('easy apply') || text.includes('apply')) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Find and collect job links from search results
   */
  async collectJobLinks() {
    try {
      const links = await retryOperation(async () => {
        return await this.extractJobLinks();
      }, {
        maxRetries: 2,
        delay: 1000
      });

      this.jobLinks = links;
      return links;

    } catch (error) {
      await ErrorHandler.handleError(error, 'collect-job-links');
      return [];
    }
  }

  /**
   * Extract job links from search results page
   */
  async extractJobLinks() {
    return new Promise((resolve) => {
      const links = [];
      const selectors = [
        'a[href*="/jobs/view/"]',
        '.job-card-container a[href*="/jobs/view/"]',
        '[data-test-id="job-card-link"]'
      ];

      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          const href = element.getAttribute('href');
          if (href && href.includes('/jobs/view/')) {
            const fullUrl = href.startsWith('http') ? href : `https://www.linkedin.com${href}`;
            if (!links.includes(fullUrl)) {
              links.push(fullUrl);
            }
          }
        });
      });

      resolve(links);
    });
  }

  /**
   * Scroll to load more jobs
   */
  async scrollToLoadMore() {
    return new Promise((resolve) => {
      let scrollCount = 0;
      const maxScrolls = 5;
      const scrollHeight = 1000;

      const scroll = () => {
        if (scrollCount >= maxScrolls) {
          resolve();
          return;
        }

        window.scrollBy(0, scrollHeight);
        scrollCount++;

        setTimeout(() => {
          // Check if new content loaded
          const currentHeight = document.body.scrollHeight;
          scroll();
        }, 2000);
      };

      scroll();
    });
  }

  /**
   * Get current job data
   */
  getCurrentJob() {
    return this.currentJob;
  }

  /**
   * Get collected job links
   */
  getJobLinks() {
    return this.jobLinks;
  }

  /**
   * Clear current job data
   */
  clearCurrentJob() {
    this.currentJob = null;
  }

  /**
   * Check if current page is a job details page
   */
  isJobDetailsPage() {
    return window.location.href.includes('/jobs/view/') || 
           window.location.href.includes('/jobs/details/');
  }

  /**
   * Check if current page is a job search page
   */
  isJobSearchPage() {
    return window.location.href.includes('/jobs/search') || 
           window.location.href.includes('/jobs/');
  }
}

// Create global instance
export const jobScraper = new JobScraper(); 